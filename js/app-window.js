// ============================================
// APP WINDOW BASE CLASS
// Every windowed app (Mail, IE, Paint, Channels, Folders, Media Player, DOS,
// Slides, Terminal) shares the same lifecycle: create a shell, wire the three
// title-bar buttons, register a taskbar button, then minimize / restore /
// maximize / close. That lifecycle lives here once instead of in each manager.
//
// Subclasses implement `renderBody(body, shell)` and, optionally, `onShow()`,
// `onHide()`, `onClose()` and `onResize()`.
// ============================================

class AppWindow {
  constructor(options = {}) {
    const {
      id,
      title = 'Window',
      taskbarTitle,
      className = '',
      iconClass = '',
      width = 600,
      height = 400,
      controls = { minimize: true, maximize: true, close: true },
      resizable = true,
    } = options;

    this.id = id;
    this.title = title;
    this.taskbarTitle = taskbarTitle || title;
    this.className = className;
    this.iconClass = iconClass;
    this.preferredWidth = width;
    this.preferredHeight = height;
    this.controlsConfig = controls;
    this.resizable = resizable;

    this.windowEl = null;
    this.bodyEl = null;
    this.titleBarEl = null;

    // Registry so global actions (Show Desktop) can drive real lifecycle
    // methods instead of poking classes and skipping onHide().
    AppWindow.instances.add(this);
  }

  // ---------- lifecycle ----------

  /** Open the window, creating it on first call and restoring it afterwards. */
  open(...args) {
    if (this.windowEl) {
      this.restore();
      this.onShow(...args);
      return this.windowEl;
    }

    const box = Utils.fitBox(this.preferredWidth, this.preferredHeight);
    const shell = windowManager.createWindowShell({
      title: this.title,
      className: this.className,
      width: `${box.width}px`,
      height: `${box.height}px`,
      top: `${box.top}px`,
      left: `${box.left}px`,
      controls: this.controlsConfig,
    });

    this.windowEl = shell.windowEl;
    this.bodyEl = shell.body;
    this.titleBarEl = shell.titleBar;
    if (!this.resizable) this.windowEl.dataset.noResize = '1';

    this.bindControls(shell.titleBar);
    this.windowEl.addEventListener('pointerdown', () => this.activate(), { capture: true });
    this.windowEl.addEventListener('window:resize', () => this.onResize());

    this.renderBody(this.bodyEl, shell);
    this.registerTaskbar();
    this.activate();
    this.onShow(...args);
    return this.windowEl;
  }

  /** Subclasses fill the window body here. */
  renderBody(/* body, shell */) {}

  /** Called every time the window becomes visible (including first open). */
  onShow() {}

  /** Called when the window is minimized or hidden. */
  onHide() {}

  /** Called just before the window element is destroyed. */
  onClose() {}

  /** Called when the user resizes the window. */
  onResize() {}

  // ---------- title bar + taskbar ----------

  bindControls(titleBar) {
    Utils.on(titleBar, 'click', '.title-bar-btn', (e) => {
      const action = e.currentTarget.dataset.action;
      if (action === 'min') this.minimize();
      else if (action === 'max') this.toggleMaximize();
      else if (action === 'close') this.close();
    });
    // Double-clicking the title bar toggles maximize, like Windows.
    titleBar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.title-bar-btn')) return;
      if (this.controlsConfig.maximize) this.toggleMaximize();
    });
  }

  registerTaskbar() {
    if (!window.taskbarManager || !this.id) return;
    window.taskbarManager.addWindow(this.id, this.taskbarTitle, {
      iconClass: this.iconClass,
      onToggle: () => this.toggleFromTaskbar(),
    });
  }

  setTaskbarActive(active) {
    if (window.taskbarManager && this.id) {
      window.taskbarManager.setActive(this.id, active);
    }
  }

  // ---------- window state ----------

  get isOpen() { return !!this.windowEl; }

  get isHidden() {
    return !this.windowEl || this.windowEl.classList.contains('window--hidden');
  }

  activate() {
    if (!this.windowEl) return;
    windowManager.bringToFront(this.windowEl);
    this.setTaskbarActive(true);
  }

  restore() {
    if (!this.windowEl) return;
    // Visibility is a class, not an inline style, so the compact layout can own
    // `display` without fighting inline geometry written by drag/resize.
    this.windowEl.classList.remove('window--hidden');
    this.activate();
  }

  minimize() {
    if (!this.windowEl) return;
    this.windowEl.classList.add('window--hidden');
    this.setTaskbarActive(false);
    this.onHide();
  }

  toggleMaximize() {
    const win = this.windowEl;
    if (!win) return;
    if (win.dataset.maximized === '1') {
      win.style.top = win.dataset.prevTop || win.dataset.baseTop || '80px';
      win.style.left = win.dataset.prevLeft || win.dataset.baseLeft || '120px';
      win.style.width = win.dataset.prevWidth || win.dataset.baseWidth || '640px';
      win.style.height = win.dataset.prevHeight || win.dataset.baseHeight || '480px';
      win.dataset.maximized = '0';
    } else {
      win.dataset.prevTop = win.style.top;
      win.dataset.prevLeft = win.style.left;
      win.dataset.prevWidth = win.style.width;
      win.dataset.prevHeight = win.style.height;
      const area = Utils.workArea();
      win.style.top = '0px';
      win.style.left = '0px';
      win.style.width = `${area.width}px`;
      win.style.height = `${area.height}px`;
      win.dataset.maximized = '1';
    }
    this.onResize();
  }

  toggleFromTaskbar() {
    if (!this.windowEl) { this.open(); return; }
    if (this.isHidden) this.restore(); else this.minimize();
  }

  close() {
    if (!this.windowEl) return;
    this.onClose();
    windowManager.closeWindow(this.windowEl);
    this.windowEl = null;
    this.bodyEl = null;
    this.titleBarEl = null;
    if (window.taskbarManager && this.id) window.taskbarManager.remove(this.id);
  }

  // ---------- conveniences for subclasses ----------

  $(selector) { return this.bodyEl ? this.bodyEl.querySelector(selector) : null; }
  $$(selector) { return this.bodyEl ? Array.from(this.bodyEl.querySelectorAll(selector)) : []; }
  setTitle(text) {
    this.title = text;
    const label = this.titleBarEl && this.titleBarEl.querySelector('.title-bar-label');
    if (label) label.textContent = text;
  }
}

AppWindow.instances = new Set();

/** Minimize every open window, honouring each app's onHide(). */
AppWindow.minimizeAll = function minimizeAll() {
  AppWindow.instances.forEach((app) => {
    if (app.isOpen && !app.isHidden) app.minimize();
  });
};

window.AppWindow = AppWindow;
