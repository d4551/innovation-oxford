// ============================================
// MS-DOS MANAGER MODULE
// Wraps the vendored js-dos (DOSBox) runtime so classic games run in their own
// windows. The runtime is ~8MB, so it is injected lazily on first launch
// rather than loaded with the page.
// ============================================

const DOS_GAMES = {
  civ: { id: 'civ', title: "Sid Meier's Civilization", resource: 'games/civ.jsdos' },
  oregon: { id: 'oregon', title: 'The Oregon Trail', resource: 'games/oregon.jsdos' },
};
const JSDOS_BASE = 'vendor/jsdos/';

class DosGameWindow extends AppWindow {
  constructor(manager, config) {
    super({
      id: `dos-${config.id}`,
      title: config.title,
      className: 'dos-window',
      iconClass: 'term-icon',
      width: 680,
      height: 520,
      controls: { minimize: true, maximize: true, close: true },
    });
    this.manager = manager;
    this.config = config;
    this.emulator = null;
    this.commandInterface = null;
  }

  renderBody(body) {
    body.classList.add('dos-body');
    // js-dos lays out its own flex tree and absolutely-positioned overlays
    // inside this element, so it must stay a plain positioned block. Status
    // text lives in a sibling overlay rather than as a child text node.
    this.container = document.createElement('div');
    this.container.className = 'dos-canvas';
    this.status = document.createElement('div');
    this.status.className = 'dos-status';
    this.status.textContent = 'Loading DOS environment…';
    body.append(this.container, this.status);
    this.run();
  }

  setStatus(text) {
    if (!this.status) return;
    this.status.textContent = text || '';
    this.status.hidden = !text;
  }

  run() {
    if (typeof Dos === 'undefined') {
      this.setStatus('Loading DOS runtime…');
      this.manager.loadRuntime()
        .then(() => this.run())
        .catch((err) => this.showError(err?.message || 'Unable to load the DOS runtime.'));
      return;
    }

    try {
      this.manager.configureRuntimePaths();
      // js-dos renders its own loader; hide ours so the two do not overlap.
      this.setStatus('');
      this.container.replaceChildren();
      this.emulator = Dos(this.container, {});
      const resourceUrl = this.manager.resolveAsset(this.config.resource);
      this.emulator.run(resourceUrl)
        .then((ci) => { this.commandInterface = ci; })
        .catch((err) => {
          console.error('MSDosManager: game execution failed', err, { resourceUrl });
          this.showError(err?.message || 'Unable to launch this DOS program.');
        });
    } catch (err) {
      console.error('MSDosManager: emulator creation failed', err);
      this.showError(err?.message || 'Unable to initialise the DOS emulator.');
    }
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
      this.container.replaceChildren();
      this.setStatus('Loading DOS environment…');
      this.run();
    });
    wrap.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    this.container.appendChild(wrap);
  }

  onClose() {
    try {
      if (this.commandInterface?.exit) this.commandInterface.exit();
      else if (this.emulator?.stop) this.emulator.stop();
    } catch (err) {
      console.warn('MSDosManager: emulator shutdown failed', err);
    }
    this.emulator = null;
    this.commandInterface = null;
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
      height: 360,
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
      item.querySelector('.dos-library__item-note').textContent = game.resource;
      grid.appendChild(item);
    });
    Utils.on(grid, 'click', '.dos-library__item', (e) => this.manager.open(e.currentTarget.dataset.game));
  }
}

class MSDosManager {
  constructor() {
    this.games = DOS_GAMES;
    this.instances = new Map();
    this.library = null;
    this.assetCache = new Map();
    this.preloadLinks = new Set();
    this.runtimeLoading = null;
  }

  /**
   * Point the emulator loader at our vendored runtime.
   *
   * The loader resolves `wdosbox.js`, `wdosbox.wasm` and `wlibzip.*` against
   * `pathPrefix`, which defaults to "" — i.e. the site root. Without this every
   * runtime asset 404s and no game can start.
   */
  configureRuntimePaths() {
    if (typeof emulators === 'undefined') return;
    emulators.pathPrefix = JSDOS_BASE;
  }

  init() {
    // Do not eagerly load the ~8MB runtime; wait for a real launch.
  }

  loadRuntime() {
    if (typeof Dos !== 'undefined') return Promise.resolve();
    if (this.runtimeLoading) return this.runtimeLoading;

    this.runtimeLoading = new Promise((resolve, reject) => {
      const head = document.head || document.getElementsByTagName('head')[0];
      if (!head) { reject(new Error('No document head to inject the runtime into')); return; }
      if (document.getElementById('jsdos-core')) { resolve(); return; }
      const s = document.createElement('script');
      s.id = 'jsdos-core';
      s.async = true;
      s.src = `${JSDOS_BASE}js-dos.js`;
      s.onload = () => resolve();
      s.onerror = () => {
        this.runtimeLoading = null;
        reject(new Error(`Failed to load ${s.src}`));
      };
      head.appendChild(s);
    });
    return this.runtimeLoading;
  }

  openLibrary() {
    this.preloadGameArchives();
    if (!this.library) this.library = new DosLibraryWindow(this);
    return this.library.open();
  }

  open(gameKey) {
    const config = this.games[gameKey];
    if (!config) {
      console.warn(`MSDosManager: unknown game key "${gameKey}"`);
      return null;
    }
    this.preloadGameArchives();
    let instance = this.instances.get(gameKey);
    if (!instance) {
      instance = new DosGameWindow(this, config);
      this.instances.set(gameKey, instance);
    }
    return instance.open();
  }

  preloadGameArchives() {
    const head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;
    Object.values(this.games).forEach((game) => {
      if (this.preloadLinks.has(game.resource)) return;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = this.resolveAsset(game.resource);
      link.as = 'fetch';
      link.crossOrigin = 'anonymous';
      head.appendChild(link);
      this.preloadLinks.add(game.resource);
    });
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
