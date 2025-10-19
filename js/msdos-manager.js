// ============================================
// MS-DOS MANAGER MODULE
// Wraps js-dos (DosBox) emulator for launching classic games
// ============================================

const MSDOS_ASSET_BASE_URL = (() => {
    if (typeof document === 'undefined') return '';
    try {
        const origin = window.location.origin || '';
        if (document.currentScript && document.currentScript.src) {
            const scriptUrl = new URL(document.currentScript.src, origin);
            return scriptUrl.origin + '/';
        }
        return origin + '/';
    } catch (err) {
        console.warn('MSDosManager: unable to resolve script base URL', err);
    }
    return (typeof document !== 'undefined' ? document.baseURI : '') || '';
})();

class MSDosManager {
    constructor() {
        this.instances = new Map();
        this.games = {
            civ: {
                id: 'civ',
                title: "Sid Meier's Civilization",
                resource: 'games/civ.jsdos'
            },
            oregon: {
                id: 'oregon',
                title: 'The Oregon Trail',
                resource: 'games/oregon.jsdos'
            }
        };
        this.assetBaseUrl = MSDOS_ASSET_BASE_URL;
        this.assetCache = new Map();
        this.libraryWindow = null;
        this.libraryTaskbarId = 'dos-library';
        this.libraryTaskbarEntry = null;
        this.preloadLinks = [];
        this.runtimePreloaded = false;
        this.runtimeLoading = null;
        // Some static hosts cannot serve WebAssembly; prefer pure JS runtime.
        // Toggle via URL: ?dos=wasm to force WASM on capable hosts.
        const q = (typeof location !== 'undefined' ? new URLSearchParams(location.search) : null);
        this.forcePureJs = !q || (q.get('dos') !== 'wasm');
    }

    init() {
        // Do not eagerly load heavy runtime; defer to first use
        this.preloadGameArchives();
    }

    // Lazily inject js-dos runtime from local vendor assets
    loadRuntime() {
        if (typeof Dos !== 'undefined') return Promise.resolve();
        if (this.runtimeLoading) return this.runtimeLoading;
        this.runtimeLoading = new Promise((resolve, reject) => {
            const head = document.head || document.getElementsByTagName('head')[0];
            if (!head) { reject(new Error('No document head to inject runtime')); return; }
            const ensure = (id, src) => new Promise((res, rej) => {
                if (document.getElementById(id)) return res();
                const s = document.createElement('script');
                s.id = id; s.async = true; s.src = src; s.onload = () => res(); s.onerror = (e) => rej(new Error('Failed to load ' + src));
                head.appendChild(s);
            });
            const base = 'vendor/jsdos/';
            // Load core only; Dos() will fetch the runtime (wdosbox.js or dosbox.js) from the configured url.
            ensure('jsdos-core', base + 'js-dos.js')
                .then(() => resolve())
                .catch(reject);
        });
        return this.runtimeLoading;
    }

    openLibrary() {
        this.preloadGameArchives();
        if (this.libraryWindow) {
            this.restoreLibrary();
            return this.libraryWindow;
        }

        const shell = windowManager.createWindowShell({
            title: 'MS-DOS Games',
            className: 'dos-library-window',
            width: '520px',
            height: '360px',
            top: '160px',
            left: '260px',
            controls: { minimize: true, maximize: false, close: true }
        });

        this.libraryWindow = shell.windowEl;
        const { body, titleBar } = shell;
        body.style.padding = '12px';
        body.innerHTML = `
            <div class="dos-library">
                <p class="dos-library__intro">Choose a classic to load in the DOS player. Each game opens in its own window so you can multitask like it's 1995.</p>
                <div class="dos-library__grid"></div>
            </div>
        `;

        const grid = body.querySelector('.dos-library__grid');
        Object.values(this.games).forEach(game => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'btn-95 dos-library__item';
            item.dataset.game = game.id;
            item.innerHTML = `
                <span class="dos-library__item-title">${game.title}</span>
                <span class="dos-library__item-note">${game.resource}</span>
            `;
            item.addEventListener('click', () => {
                this.open(game.id);
                this.restore(game.id);
            });
            grid.appendChild(item);
        });

        titleBar.querySelectorAll('.title-bar-btn').forEach(btn => {
            const action = btn.dataset.action;
            if (action === 'min') {
                btn.addEventListener('click', () => this.minimizeLibrary());
            } else if (action === 'close') {
                btn.addEventListener('click', () => this.closeLibrary());
            }
        });

        if (window.taskbarManager) {
            this.libraryTaskbarEntry = window.taskbarManager.addWindow(this.libraryTaskbarId, 'MS-DOS Games', {
                iconClass: 'term-icon',
                onToggle: () => this.toggleLibrary()
            });
            window.taskbarManager.setActive(this.libraryTaskbarId, true);
        }

        this.libraryWindow.style.zIndex = ++windowManager.zIndexCounter;
        return this.libraryWindow;
    }

    open(gameKey) {
        const config = this.games[gameKey];
        if (!config) {
            console.warn(`MSDosManager: unknown game key "${gameKey}"`);
            return null;
        }

        this.preloadGameArchives();

        // Restore existing instance if already running
        if (this.instances.has(gameKey)) {
            this.restore(gameKey);
            return this.instances.get(gameKey).windowEl;
        }

        const shell = windowManager.createWindowShell({
            title: config.title,
            className: 'dos-window',
            width: '680px',
            height: '520px',
            top: '120px',
            left: '420px',
            controls: { minimize: true, maximize: false, close: true }
        });
        const { windowEl, body, titleBar } = shell;
        body.style.background = '#000';

        const container = document.createElement('div');
        container.className = 'dos-canvas';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.background = '#000';
        container.style.color = '#fff';
        container.style.fontFamily = '"Courier New", monospace';
        container.style.fontSize = '12px';
        container.textContent = 'Loading DOS environment...';
        body.appendChild(container);

        const instance = {
            key: gameKey,
            config,
            windowEl,
            container,
            taskbarId: `dos-${gameKey}`,
            taskbarEntry: null,
            emulator: null,
            commandInterface: null
        };
        this.instances.set(gameKey, instance);

        // Wire title bar controls
        titleBar.querySelectorAll('.title-bar-btn').forEach(btn => {
            const action = btn.dataset.action;
            if (action === 'min') {
                btn.addEventListener('click', () => this.minimize(gameKey));
            } else if (action === 'close') {
                btn.addEventListener('click', () => this.close(gameKey));
            }
        });

        // Register with taskbar if available
        if (window.taskbarManager) {
            instance.taskbarEntry = window.taskbarManager.addWindow(instance.taskbarId, config.title, {
                iconClass: 'term-icon',
                onToggle: () => this.toggle(gameKey)
            });
            window.taskbarManager.setActive(instance.taskbarId, true);
        }

        windowEl.style.zIndex = ++windowManager.zIndexCounter;

        this.runGame(instance);
        return windowEl;
    }

    minimizeLibrary() {
        if (!this.libraryWindow) return;
        this.libraryWindow.style.display = 'none';
        if (window.taskbarManager) {
            window.taskbarManager.setActive(this.libraryTaskbarId, false);
        }
    }

    restoreLibrary() {
        if (!this.libraryWindow) return;
        this.libraryWindow.style.display = 'block';
        this.libraryWindow.style.zIndex = ++windowManager.zIndexCounter;
        if (window.taskbarManager) {
            window.taskbarManager.setActive(this.libraryTaskbarId, true);
        }
    }

    toggleLibrary() {
        if (!this.libraryWindow) {
            this.openLibrary();
            return;
        }
        const hidden = this.libraryWindow.style.display === 'none';
        if (hidden) {
            this.restoreLibrary();
        } else {
            this.minimizeLibrary();
        }
    }

    closeLibrary() {
        if (!this.libraryWindow) return;
        windowManager.closeWindow(this.libraryWindow);
        this.libraryWindow = null;
        if (window.taskbarManager) {
            window.taskbarManager.remove(this.libraryTaskbarId);
        }
        this.libraryTaskbarEntry = null;
    }

    runGame(instance) {
        if (typeof Dos === 'undefined') {
            // Load runtime on demand from local vendor assets
            instance.container.textContent = 'Loading DOS runtime...';
            this.loadRuntime().then(() => this.runGame(instance)).catch(err => {
                this.showError(instance, (err && err.message) || 'Unable to load DOS runtime');
            });
            return;
        }

        try {
            if (typeof Dos === 'undefined') {
                this.showError(instance, 'JS-DOS library failed to load. Ensure vendor/jsdos/js-dos.js is available.');
                return;
            }
            console.log('MSDosManager: initializing emulator', { game: instance.key });
            const base = 'vendor/jsdos/';
            const runtimeUrl = this.forcePureJs ? (base + 'dosbox.js') : (base + 'wdosbox.js');
            const options = { wdosboxUrl: runtimeUrl };
            if (!this.forcePureJs) {
                options.locateFile = (p) => {
                    if (!p) return p;
                    if (p.endsWith('.wasm')) return base + 'wdosbox.wasm';
                    if (p === 'wdosbox.js' || p.endsWith('/wdosbox.js')) return base + 'wdosbox.js';
                    return base + p;
                };
            }
            instance.emulator = Dos(instance.container, options);
            const resourceUrl = this.resolveAsset(instance.config.resource);
            console.log('MSDosManager: running game bundle', { game: instance.key, resourceUrl });
            const runPromise = instance.emulator.run(resourceUrl);
            runPromise.then((ci) => {
                instance.commandInterface = ci;
                console.log('MSDosManager: game initialized successfully');
            }).catch((err) => {
                console.error('MSDosManager: game execution failed', err, { resourceUrl, runtimeUrl });
                // If wasm failed and we weren't already on pure JS, fallback once
                if (!this.forcePureJs) {
                    console.warn('MSDosManager: falling back to pure JS runtime');
                    this.forcePureJs = true;
                    this.runGame(instance);
                    return;
                }
                const msg = (err && err.message) ? err.message : 'Unable to launch DOS program.';
                this.showError(instance, msg + '\nTip: Ensure vendor/jsdos/dosbox.js is present for pure-JS runtime.');
            });
        } catch (err) {
            console.error('MSDosManager: emulator creation failed', err);
            const msg = (err && err.message) ? err.message : 'Unable to initialize DOS emulator.';
            this.showError(instance, msg);
        }
    }

    minimize(gameKey) {
        const instance = this.instances.get(gameKey);
        if (!instance) return;
        instance.windowEl.style.display = 'none';
        if (window.taskbarManager) {
            window.taskbarManager.setActive(instance.taskbarId, false);
        }
    }

    restore(gameKey) {
        const instance = this.instances.get(gameKey);
        if (!instance) return;
        instance.windowEl.style.display = 'block';
        instance.windowEl.style.zIndex = ++windowManager.zIndexCounter;
        if (window.taskbarManager) {
            window.taskbarManager.setActive(instance.taskbarId, true);
        }
    }

    toggle(gameKey) {
        const instance = this.instances.get(gameKey);
        if (!instance) {
            this.open(gameKey);
            return;
        }
        const hidden = instance.windowEl.style.display === 'none';
        if (hidden) {
            this.restore(gameKey);
        } else {
            this.minimize(gameKey);
        }
    }

    close(gameKey) {
        const instance = this.instances.get(gameKey);
        if (!instance) return;

        if (instance.commandInterface && typeof instance.commandInterface.exit === 'function') {
            try {
                instance.commandInterface.exit();
            } catch (e) {
                console.warn('MSDosManager: command interface exit failed', e);
            }
        } else if (instance.emulator && typeof instance.emulator.stop === 'function') {
            try {
                instance.emulator.stop();
            } catch (e) {
                console.warn('MSDosManager: emulator stop failed', e);
            }
        }

        if (instance.windowEl && instance.windowEl.parentNode) {
            windowManager.closeWindow(instance.windowEl);
        }

        if (window.taskbarManager) {
            window.taskbarManager.remove(instance.taskbarId);
        }

        this.instances.delete(gameKey);
    }

    preloadGameArchives() {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (!head) return;

        const addLink = (href, as, type) => {
            if (!href) return;
            const existing = this.preloadLinks.find(link => link.dataset.src === href);
            if (existing) return;
            const resolvedHref = this.resolveAsset(href);
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resolvedHref;
            if (as) link.as = as;
            if (type) link.type = type;
            link.crossOrigin = 'anonymous';
            link.dataset.src = href;
            head.appendChild(link);
            this.preloadLinks.push(link);
        };

        // Runtime assets are now fetched by js-dos relative to its own script; only preload games here.

        Object.values(this.games).forEach(game => {
            addLink(game.resource, 'fetch', 'application/octet-stream');
        });
    }

    resolveAsset(path) {
        if (!path) return path;
        if (this.assetCache.has(path)) {
            return this.assetCache.get(path);
        }
        let resolved = path;
        try {
            const base = this.assetBaseUrl || (typeof document !== 'undefined' ? document.baseURI : '');
            if (/^https?:/.test(path)) {
                resolved = path;
            } else if (base) {
                resolved = new URL(path, base).href;
            } else {
                resolved = path.startsWith('/') ? path : `/${path}`;
            }
        } catch (err) {
            console.warn('MSDosManager: Unable to resolve asset path, using fallback', path, err);
            resolved = path;
        }
        this.assetCache.set(path, resolved);
        return resolved;
    }

    // ----- inline helpers -----
    escape(text) {
        try { return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); } catch { return String(text); }
    }

    showError(instance, message) {
        const safe = this.escape(message || 'Unknown error');
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;background:#000;color:#fff;font-family:"Courier New",monospace;font-size:12px;padding:12px;text-align:center;';
        wrap.innerHTML = `
            <div style="margin-bottom:8px;">DOS player error</div>
            <div style="color:#ff8080;max-width:520px;margin-bottom:10px;">${safe}</div>
            <div style="display:flex;gap:8px;">
                <button class="btn-95" data-act="retry">Retry</button>
                <button class="btn-95" data-act="close">Close</button>
            </div>
        `;
        instance.container.innerHTML = '';
        instance.container.appendChild(wrap);
        const onRetry = () => { try { this.runGame(instance); } catch (e) { console.warn('Retry failed', e); } };
        const onClose = () => { try { this.close(instance.key); } catch (e) {} };
        wrap.querySelector('[data-act="retry"]').addEventListener('click', onRetry);
        wrap.querySelector('[data-act="close"]').addEventListener('click', onClose);
    }
}

// Create global reference (initialized in main.js)
var msdosManager = null;
window.msdosManager = window.msdosManager || null;
