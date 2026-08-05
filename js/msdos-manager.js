// ============================================
// MS-DOS MANAGER MODULE
// Wraps the vendored js-dos 8 runtime so classic games run in their own windows.
//
// The emulator itself lives in vendor/jsdos/player.html, loaded into an iframe
// on first launch — see that file for why it is isolated. Nothing about js-dos
// (its ~2MB runtime, its stylesheet, its document-level listeners) is loaded
// until someone actually opens a game.
//
// js-dos 8 supplies its own in-window chrome — save state, on-screen keyboard,
// fullscreen, speed, settings — which is what makes these games playable on a
// phone at all.
// ============================================

const DOS_GAMES = {
  civ: { id: 'civ', title: "Sid Meier's Civilization", note: 'MicroProse, 1991', resource: 'games/civ.jsdos' },
  oregon: { id: 'oregon', title: 'The Oregon Trail', note: 'MECC, 1990', resource: 'games/oregon.jsdos' },
};
const JSDOS_BASE = 'vendor/jsdos/';
// js-dos runs inside this frame; see the comment at the top of player.html for
// why it is not mounted directly in the page.
const JSDOS_PLAYER = `${JSDOS_BASE}player.html`;

class DosGameWindow extends AppWindow {
  constructor(manager, config) {
    super({
      id: `dos-${config.id}`,
      title: config.title,
      className: 'dos-window',
      iconClass: 'term-icon',
      width: 720,
      height: 560,
      controls: { minimize: true, maximize: true, close: true },
      // The manager builds a fresh window per launch, so closing must dispose
      // of this one rather than leave it in the registry.
      forgetOnClose: true,
    });
    this.manager = manager;
    this.config = config;
    this.frame = null;
    this.booted = false;
    this.bootTimer = null;
    this.onPlayerMessage = (e) => this.handlePlayerMessage(e);
  }

  renderBody(body) {
    body.classList.add('dos-body');
    // js-dos mounts its own layout and absolutely-positioned layers inside this
    // element, so it must stay a plain positioned block with a definite size.
    this.container = document.createElement('div');
    this.container.className = 'dos-canvas';
    this.status = document.createElement('div');
    this.status.className = 'dos-status';
    this.status.textContent = 'Loading DOS environment…';
    body.append(this.container, this.status);
    window.addEventListener('message', this.onPlayerMessage);
    this.run();
  }

  setStatus(text) {
    if (!this.status) return;
    this.status.textContent = text || '';
    this.status.hidden = !text;
  }

  run() {
    this.setStatus('Loading DOS environment…');
    this.container.replaceChildren();

    const frame = document.createElement('iframe');
    frame.className = 'dos-frame';
    frame.title = `${this.config.title} — DOS player`;
    // The bundle travels in the frame's name rather than its query string:
    // one stable player URL, and no encoded absolute URL to read past in the
    // address of every frame. Set before `src`, which is what navigates.
    frame.name = this.manager.resolveAsset(this.config.resource);
    frame.src = JSDOS_PLAYER;
    // The player needs these to offer fullscreen and to make any sound.
    frame.allow = 'fullscreen; autoplay; gamepad';
    frame.addEventListener('error', () => this.showError('Could not load the DOS player.'));
    this.container.appendChild(frame);
    this.frame = frame;

    // Nothing arrived after a generous wait: report it instead of sitting on a
    // spinner for ever.
    this.bootTimer = setTimeout(() => {
      if (!this.booted) this.showError('The DOS player did not start. Try again.');
    }, 90000);
  }

  /** Messages from the player frame (same-origin, and identified by source). */
  handlePlayerMessage(e) {
    if (e.origin !== window.location.origin) return;
    if (!e.data || e.data.source !== 'jsdos-player') return;
    if (!this.frame || e.source !== this.frame.contentWindow) return;

    if (e.data.type === 'error') {
      this.showError(e.data.detail || 'The DOS player reported an error.');
      return;
    }
    if (e.data.type === 'event' && (e.data.detail === 'emu-ready' || e.data.detail === 'ci-ready')) {
      this.booted = true;
      clearTimeout(this.bootTimer);
      this.setStatus('');
    }
  }

  postToPlayer(type) {
    try {
      this.frame?.contentWindow?.postMessage({ source: 'jsdos-host', type }, window.location.origin);
    } catch (_) { /* frame gone */ }
  }

  showError(message) {
    this.setStatus('');
    this.container.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'dos-error';
    wrap.setAttribute('role', 'alert');
    wrap.innerHTML = `
      <p class="dos-error__title">DOS player error</p>
      <p class="dos-error__msg"></p>
      <div class="dos-error__actions">
        <button type="button" class="btn-95" data-act="retry">Retry</button>
        <button type="button" class="btn-95" data-act="close">Close</button>
      </div>
    `;
    wrap.querySelector('.dos-error__msg').textContent = message;
    wrap.querySelector('[data-act="retry"]').addEventListener('click', () => {
      this.booted = false;
      clearTimeout(this.bootTimer);
      this.run();
    });
    wrap.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    this.container.appendChild(wrap);
  }

  onHide() {
    // A minimized game should not keep burning CPU and playing sound.
    this.postToPlayer('pause');
  }

  onShow() {
    this.postToPlayer('resume');
  }

  onClose() {
    clearTimeout(this.bootTimer);
    window.removeEventListener('message', this.onPlayerMessage);
    // Removing the frame destroys the emulator, its worker, its audio graph and
    // its listeners in one step — a more complete teardown than any API call.
    this.postToPlayer('stop');
    this.frame?.remove();
    this.frame = null;
    this.booted = false;
    this.manager.instances.delete(this.config.id);
  }
}

class DosLibraryWindow extends AppWindow {
  constructor(manager) {
    super({
      id: 'dos-library',
      title: 'MS-DOS Games',
      className: 'dos-library-window',
      iconClass: 'term-icon',
      width: 520,
      // Sized to the shelf's contents rather than opening two thirds empty.
      height: 200,
      controls: { minimize: true, maximize: false, close: true },
    });
    this.manager = manager;
  }

  renderBody(body) {
    body.innerHTML = `
      <div class="dos-library">
        <p class="dos-library__intro">Choose a classic to load in the DOS player. Each game opens in its own window so you can multitask like it's 1995.</p>
        <div class="dos-library__grid"></div>
      </div>
    `;
    const grid = this.$('.dos-library__grid');
    Object.values(this.manager.games).forEach((game) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'btn-95 dos-library__item';
      item.dataset.game = game.id;
      item.innerHTML = '<span class="dos-library__item-title"></span><span class="dos-library__item-note"></span>';
      item.querySelector('.dos-library__item-title').textContent = game.title;
      // Who made it and when, not where the bundle lives — the path was only
      // ever interesting to whoever built the shelf.
      item.querySelector('.dos-library__item-note').textContent = game.note;
      grid.appendChild(item);
    });
    Utils.on(grid, 'click', '.dos-library__item', (e) => this.manager.open(e.currentTarget.dataset.game));
    // There is deliberately no hover/focus prefetch of the bundles here. It
    // was measured and it did not work: `pointerenter` fires on these buttons
    // the moment the shelf is inserted — no pointer anywhere near them — so
    // it downloaded a game nobody asked for; and the hint was never reused,
    // because the player frame fetches the bundle from its own document. The
    // net effect was 1.8MB of speculative traffic plus a full second copy of
    // whatever did get launched. The runtime is warmed instead, which the
    // frame does reuse.
  }
}

class MSDosManager {
  constructor() {
    this.games = DOS_GAMES;
    this.instances = new Map();
    this.library = null;
    this.assetCache = new Map();
    this.runtimePrefetched = false;
  }

  init() {
    // Do not eagerly load the runtime; wait for a real launch.
  }

  /**
   * Warm the two files the player frame loads — ~440KB at idle priority,
   * verified served from cache when the frame actually loads.
   *
   * No `as` attribute: without it the responses land in the ordinary HTTP
   * cache, which the frame's own requests hit. `as="fetch"` routes them
   * somewhere the frame never looks. player.html itself is not listed for the
   * same reason: a prefetched document is only offered to top-level
   * navigations, never to a frame, so the hint would be dead weight.
   */
  prefetchRuntime() {
    if (this.runtimePrefetched) return;
    this.runtimePrefetched = true;
    const head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;
    [`${JSDOS_BASE}js-dos.js`, `${JSDOS_BASE}js-dos.css`].forEach((href) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      head.appendChild(link);
    });
  }

  openLibrary() {
    this.prefetchRuntime();
    if (!this.library) this.library = new DosLibraryWindow(this);
    return this.library.open();
  }

  open(gameKey) {
    const config = this.games[gameKey];
    if (!config) {
      console.warn(`MSDosManager: unknown game key "${gameKey}"`);
      return null;
    }
    this.prefetchRuntime();
    let instance = this.instances.get(gameKey);
    if (!instance) {
      instance = new DosGameWindow(this, config);
      this.instances.set(gameKey, instance);
    }
    return instance.open();
  }

  resolveAsset(path) {
    if (!path) return path;
    if (this.assetCache.has(path)) return this.assetCache.get(path);
    let resolved = path;
    try {
      resolved = /^https?:/.test(path) ? path : new URL(path, document.baseURI).href;
    } catch (err) {
      console.warn('MSDosManager: could not resolve asset path', path, err);
    }
    this.assetCache.set(path, resolved);
    return resolved;
  }

  /**
   * Lazily create the shared manager. Both the terminal and the Start menu
   * route through here, so the singleton logic lives in exactly one place.
   */
  static shared() {
    if (!window.msdosManager) {
      window.msdosManager = new MSDosManager();
      window.msdosManager.init();
    }
    return window.msdosManager;
  }
}

window.MSDosManager = MSDosManager;
