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
      // Set by apps whose manager creates a new instance for each launch, so
      // closing really does dispose of the object.
      forgetOnClose = false,
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
    this.forgetOnClose = forgetOnClose;

    this.windowEl = null;
    this.bodyEl = null;
    this.titleBarEl = null;
    this.returnFocusTo = null;

    // Registry so global actions (Show Desktop) can drive real lifecycle
    // methods instead of poking classes and skipping onHide().
    AppWindow.instances.add(this);
  }

  // ---------- lifecycle ----------

  /** Open the window, creating it on first call and restoring it afterwards. */
  open(...args) {
    this.rememberFocus();
    if (this.windowEl) {
      this.restore();
      this.onShow(...args);
      return this.windowEl;
    }

    const box = Utils.fitBox(this.preferredWidth, this.preferredHeight);
    const at = windowManager.nextCascadePosition(box.width, box.height);
    const shell = windowManager.createWindowShell({
      title: this.title,
      className: this.className,
      width: `${box.width}px`,
      height: `${box.height}px`,
      top: `${at.top}px`,
      left: `${at.left}px`,
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
    // Before onShow, so an app that wants a particular field focused can say so
    // there and win.
    this.focusWindow();
    this.onShow(...args);
    return this.windowEl;
  }

  // ---------- focus ----------

  /**
   * Where focus should go when this window closes. Captured on every open, so
   * a window reopened from the Start menu returns you to the Start menu and one
   * reopened from the taskbar returns you to the taskbar.
   */
  rememberFocus() {
    const el = document.activeElement;
    this.returnFocusTo = el && el !== document.body && !this.windowEl?.contains(el) ? el : null;
  }

  /**
   * Move focus to the window itself rather than to whichever control happens to
   * be first in the markup — which would be a title-bar button. The window is
   * `tabindex="-1"` and named, so it announces itself and the next Tab goes
   * into its content.
   */
  focusWindow() {
    if (!this.windowEl) return;
    try { this.windowEl.focus({ preventScroll: true }); } catch (_) { /* pre-options browsers */ }
  }

  /** True when focus currently sits inside this window. */
  holdsFocus() {
    return !!this.windowEl && this.windowEl.contains(document.activeElement);
  }

  /**
   * Hand focus back after this window goes away. Prefers wherever it came from,
   * then the front-most window still open, and finally the Start button — never
   * `<body>`, which would send the next Tab back to the top of the document.
   */
  releaseFocus() {
    const candidates = [
      this.returnFocusTo,
      ...[...AppWindow.instances]
        .filter((app) => app !== this && app.isOpen && !app.isHidden)
        .sort((a, b) => (parseInt(a.windowEl.style.zIndex, 10) || 0) - (parseInt(b.windowEl.style.zIndex, 10) || 0))
        .map((app) => app.windowEl)
        .reverse(),
      document.querySelector('.start-btn'),
    ];
    for (const el of candidates) {
      if (!el || !el.isConnected || el.closest('[inert]')) continue;
      if (el.offsetParent === null && el !== document.documentElement) continue;
      try { el.focus({ preventScroll: true }); } catch (_) { continue; }
      if (document.activeElement === el) return;
    }
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
    this.focusWindow();
  }

  minimize() {
    if (!this.windowEl) return;
    // Focus cannot stay in a window that is about to be display:none — the
    // browser would drop it on <body> and the next Tab would start over.
    const held = this.holdsFocus();
    this.windowEl.classList.add('window--hidden');
    this.setTaskbarActive(false);
    if (held) this.releaseFocus();
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

  /**
   * Taskbar button behaviour: open if closed, restore if minimized, raise if
   * merely covered, and minimize only when it is already the front window.
   */
  toggleFromTaskbar() {
    if (!this.windowEl) { this.open(); return; }
    if (this.isHidden) { this.restore(); return; }
    if (!windowManager.isTopmost(this.windowEl)) { this.activate(); return; }
    this.minimize();
  }

  close() {
    if (!this.windowEl) return;
    const held = this.holdsFocus();
    this.onClose();
    windowManager.closeWindow(this.windowEl);
    this.windowEl = null;
    this.bodyEl = null;
    this.titleBarEl = null;
    if (window.taskbarManager && this.id) window.taskbarManager.remove(this.id);
    // Managers that build a fresh instance per launch (the DOS games) would
    // otherwise leave every closed window in the registry for ever, and
    // Show Desktop would walk a list that only grows.
    if (this.forgetOnClose) AppWindow.instances.delete(this);
    if (held) this.releaseFocus();
  }

  // ---------- conveniences for subclasses ----------

  $(selector) { return this.bodyEl ? this.bodyEl.querySelector(selector) : null; }
  $$(selector) { return this.bodyEl ? Array.from(this.bodyEl.querySelectorAll(selector)) : []; }
  setTitle(text) {
    this.title = text;
    const label = this.titleBarEl && this.titleBarEl.querySelector('.title-bar-label');
    if (label) label.textContent = text;
    // The window is a named region; its name has to follow its title.
    if (this.windowEl) this.windowEl.setAttribute('aria-label', text);
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
