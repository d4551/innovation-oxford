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
// Opened off disk, this page and its frame each get an opaque origin that no
// string addresses — Chrome reports `location.origin` as "file://" but
// postMessage matches against the real one, so targeting it drops the message
// silently. Both directions fall back to "*", which is safe here because the
// identity of the frame is checked separately and nothing exchanged is secret.
// See the matching note in vendor/jsdos/player.html.
const OPAQUE_ORIGIN = window.location.protocol === 'file:';
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
    this.answered = false;
    this.bootTimer = null;
    this.helloTimer = null;
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
    this.booted = false;
    this.answered = false;
    clearTimeout(this.bootTimer);
    clearTimeout(this.helloTimer);
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

    // The player greets us as its first act, so silence means the frame loaded
    // something that is not the player — a 404 page, most often, because the
    // vendored runtime never reached the server. An iframe fires no `error`
    // event for an HTTP error status, so the only way to tell that apart from a
    // slow load is to ask the server directly. Do it once the greeting is
    // overdue rather than up front: a healthy launch has already answered and
    // never spends the request.
    const missingPlayer = `Could not load the DOS player (${JSDOS_PLAYER}). Check that the vendor folder was published with the site.`;
    this.helloTimer = setTimeout(() => {
      if (this.answered || this.frame !== frame) return;
      try {
        fetch(JSDOS_PLAYER, { method: 'HEAD' }).then(
          (res) => {
            if (!res.ok && !this.answered && this.frame === frame) this.showError(missingPlayer, { retryable: false });
          },
          () => { /* offline, or off disk where the player diagnoses it better */ },
        );
      } catch (_) { /* no fetch here; the backstop below still covers it */ }
      // Reachable but still silent: something loaded that is not our player.
      this.helloTimer = setTimeout(() => {
        if (!this.answered && this.frame === frame) this.showError(missingPlayer, { retryable: false });
      }, 17000);
    }, 3000);

    // Loaded, greeted, and still not running after a generous wait. The player
    // reports its own failures long before this; it is the last backstop.
    this.bootTimer = setTimeout(() => {
      if (!this.booted) this.showError('The DOS player did not start. Try again.');
    }, 90000);
  }

  /** Messages from the player frame (same-origin, and identified by source). */
  handlePlayerMessage(e) {
    // Off disk the sender's origin arrives as the opaque "null", which matches
    // nothing. The frame-identity check below is what actually proves this came
    // from our player.
    if (!OPAQUE_ORIGIN && e.origin !== window.location.origin) return;
    if (!e.data || e.data.source !== 'jsdos-player') return;
    if (!this.frame || e.source !== this.frame.contentWindow) return;

    // Any message at all proves the player document itself loaded.
    this.answered = true;
    clearTimeout(this.helloTimer);

    if (e.data.type === 'error') {
      clearTimeout(this.bootTimer);
      // The player has already worked out what went wrong and whether trying
      // again could possibly help. Reading the page off disk never gets better.
      this.showError(e.data.detail || 'The DOS player reported an error.', {
        retryable: window.location.protocol !== 'file:',
      });
      return;
    }
    if (e.data.type !== 'event') return;
    // "emu-ready" only means the player's own UI mounted; the bundle may still
    // fail to download. "ci-ready" is the game actually running.
    if (e.data.detail === 'emu-ready') {
      this.setStatus('Loading game data…');
    } else if (e.data.detail === 'ci-ready') {
      this.booted = true;
      clearTimeout(this.bootTimer);
      this.setStatus('');
    }
  }

  postToPlayer(type) {
    const target = OPAQUE_ORIGIN ? '*' : window.location.origin;
    try {
      this.frame?.contentWindow?.postMessage({ source: 'jsdos-host', type }, target);
    } catch (_) { /* frame gone */ }
  }

  /**
   * Replace the frame with what went wrong. `retryable` is false for failures
   * that a second attempt cannot change — offering a button that is certain to
   * fail again is worse than offering none.
   */
  showError(message, { retryable = true } = {}) {
    this.setStatus('');
    clearTimeout(this.helloTimer);
    clearTimeout(this.bootTimer);
    this.container.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'dos-error';
    wrap.setAttribute('role', 'alert');
    wrap.innerHTML = `
      <p class="dos-error__title">DOS player error</p>
      <p class="dos-error__msg"></p>
      <div class="dos-error__actions">
        ${retryable ? '<button type="button" class="btn-95" data-act="retry">Retry</button>' : ''}
        <button type="button" class="btn-95" data-act="close">Close</button>
      </div>
    `;
    wrap.querySelector('.dos-error__msg').textContent = message;
    wrap.querySelector('[data-act="retry"]')?.addEventListener('click', () => {
      this.booted = false;
      this.answered = false;
      this.run();
    });
    wrap.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    this.container.appendChild(wrap);
    // Announce it: the window may not hold focus when this arrives.
    wrap.querySelector('[data-act="retry"], [data-act="close"]')?.focus();
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
    clearTimeout(this.helloTimer);
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
