// ============================================
// WINDOW MANAGER MODULE
// Creates Win95-style window shells and handles dragging / resizing.
//
// Uses Pointer Events throughout, so mouse, touch and stylus all work with one
// code path. Listeners are attached per-gesture and torn down on release, so a
// window never leaks document-level handlers.
// ============================================

const WINDOW_MIN_W = 260;
const WINDOW_MIN_H = 160;

const RESIZE_HANDLES = [
  { dir: 'n', cursor: 'ns-resize' },
  { dir: 's', cursor: 'ns-resize' },
  { dir: 'e', cursor: 'ew-resize' },
  { dir: 'w', cursor: 'ew-resize' },
  { dir: 'ne', cursor: 'nesw-resize' },
  { dir: 'nw', cursor: 'nwse-resize' },
  { dir: 'se', cursor: 'nwse-resize' },
  { dir: 'sw', cursor: 'nesw-resize' },
];

class WindowManager {
  constructor() {
    this.windows = new Map();
    this.zIndexCounter = 1000;
  }

  init() {
    document.querySelectorAll('.window').forEach((win) => this.register(win));
  }

  /** Attach dragging + resizing to a window that already exists in the DOM. */
  register(win) {
    if (!win || this.windows.has(win)) return;
    const titleBar = win.querySelector('.title-bar');
    if (titleBar) this.makeWindowDraggable(win, titleBar);
    this.makeWindowResizable(win);
  }

  /** Raise a window above every other one. */
  bringToFront(win) {
    if (!win) return;
    win.style.zIndex = String(++this.zIndexCounter);
  }

  /**
   * Create a standard Win95-style window shell with title bar and body.
   * Returns { windowEl, titleBar, body, controls }.
   */
  createWindowShell({
    title = 'Window',
    className = '',
    width = '600px',
    height = '400px',
    top = '100px',
    left = '120px',
    controls = { minimize: true, maximize: true, close: true },
  } = {}) {
    const desktop = document.querySelector('.desktop') || document.body;
    const win = document.createElement('div');
    win.className = `window ${className}`.trim();
    Object.assign(win.style, {
      width, height, top, left,
      position: 'absolute',
      zIndex: String(++this.zIndexCounter),
    });

    // Remember the authored geometry so compact mode can restore it.
    win.dataset.baseWidth = width;
    win.dataset.baseHeight = height;
    win.dataset.baseTop = top;
    win.dataset.baseLeft = left;

    const titleBar = document.createElement('div');
    titleBar.className = 'title-bar';
    const btn = (action, glyph, label) =>
      `<button type="button" class="title-bar-btn" data-action="${action}" aria-label="${label}" title="${label}">${glyph}</button>`;
    const btnMin = controls.minimize ? btn('min', '_', 'Minimize') : '';
    const btnMax = controls.maximize ? btn('max', '□', 'Maximize') : '';
    const btnClose = controls.close ? btn('close', 'X', 'Close') : '';
    titleBar.innerHTML = `
      <div class="title-bar-text">
        <div class="title-bar-icon" aria-hidden="true"></div>
        <span class="title-bar-label"></span>
      </div>
      <div class="title-bar-controls">${btnMin}${btnMax}${btnClose}</div>
    `;
    titleBar.querySelector('.title-bar-label').textContent = title;

    const body = document.createElement('div');
    body.className = 'window-body';

    win.appendChild(titleBar);
    win.appendChild(body);
    desktop.appendChild(win);

    this.makeWindowDraggable(win, titleBar);
    this.makeWindowResizable(win);

    return {
      windowEl: win,
      titleBar,
      body,
      controls: titleBar.querySelectorAll('.title-bar-btn'),
    };
  }

  makeWindowDraggable(windowElement, handleElement) {
    if (!windowElement || !handleElement) return;
    if (handleElement.dataset.draggable === '1') return;
    handleElement.dataset.draggable = '1';

    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;

    const onPointerMove = (e) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      const maxX = window.innerWidth - windowElement.offsetWidth;
      const maxY = window.innerHeight - Utils.taskbarHeight() - windowElement.offsetHeight;
      windowElement.style.left = `${Utils.clamp(e.clientX - offsetX, 0, Math.max(0, maxX))}px`;
      windowElement.style.top = `${Utils.clamp(e.clientY - offsetY, 0, Math.max(0, maxY))}px`;
    };

    const endDrag = (e) => {
      if (pointerId === null || (e && e.pointerId !== pointerId)) return;
      try { handleElement.releasePointerCapture(pointerId); } catch (_) {}
      pointerId = null;
      handleElement.classList.remove('is-dragging');
      handleElement.removeEventListener('pointermove', onPointerMove);
      handleElement.removeEventListener('pointerup', endDrag);
      handleElement.removeEventListener('pointercancel', endDrag);
    };

    const onPointerDown = (e) => {
      // Buttons in the title bar are not drag handles.
      if (e.target.closest('.title-bar-btn')) return;
      // Compact mode pins windows to the viewport; dragging is meaningless.
      if (Utils.isCompact() || windowElement.dataset.maximized === '1') return;
      if (e.button !== undefined && e.button !== 0) return;

      pointerId = e.pointerId;
      offsetX = e.clientX - windowElement.offsetLeft;
      offsetY = e.clientY - windowElement.offsetTop;
      this.bringToFront(windowElement);
      handleElement.classList.add('is-dragging');
      try { handleElement.setPointerCapture(pointerId); } catch (_) {}
      handleElement.addEventListener('pointermove', onPointerMove);
      handleElement.addEventListener('pointerup', endDrag);
      handleElement.addEventListener('pointercancel', endDrag);
      e.preventDefault();
    };

    handleElement.addEventListener('pointerdown', onPointerDown);

    const existing = this.windows.get(windowElement) || {};
    existing.cleanupDrag = () => {
      endDrag();
      handleElement.removeEventListener('pointerdown', onPointerDown);
      delete handleElement.dataset.draggable;
    };
    this.windows.set(windowElement, existing);
  }

  makeWindowResizable(windowElement) {
    if (!windowElement || windowElement.dataset.resizable === '1') return;
    windowElement.dataset.resizable = '1';

    RESIZE_HANDLES.forEach((h) => {
      const el = document.createElement('div');
      el.className = `resize-handle resize-${h.dir}`;
      el.style.cursor = h.cursor;
      windowElement.appendChild(el);
    });

    let pointerId = null;
    let dir = '';
    let startX = 0, startY = 0, startW = 0, startH = 0, startL = 0, startT = 0;
    let activeHandle = null;

    const onPointerMove = (e) => {
      if (!dir || e.pointerId !== pointerId) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newW = startW, newH = startH, newL = startL, newT = startT;

      if (dir.includes('e')) newW = Math.max(WINDOW_MIN_W, startW + dx);
      if (dir.includes('s')) newH = Math.max(WINDOW_MIN_H, startH + dy);
      if (dir.includes('w')) {
        newW = Math.max(WINDOW_MIN_W, startW - dx);
        newL = startL + (startW - newW);
      }
      if (dir.includes('n')) {
        newH = Math.max(WINDOW_MIN_H, startH - dy);
        newT = startT + (startH - newH);
      }

      newL = Math.max(0, newL);
      newT = Math.max(0, newT);
      newW = Math.min(newW, window.innerWidth - newL);
      newH = Math.min(newH, window.innerHeight - Utils.taskbarHeight() - newT);

      windowElement.style.width = `${newW}px`;
      windowElement.style.height = `${newH}px`;
      windowElement.style.left = `${newL}px`;
      windowElement.style.top = `${newT}px`;
      windowElement.dispatchEvent(new CustomEvent('window:resize', { bubbles: false }));
    };

    const endResize = (e) => {
      if (pointerId === null || (e && e.pointerId !== pointerId)) return;
      if (activeHandle) {
        try { activeHandle.releasePointerCapture(pointerId); } catch (_) {}
        activeHandle.removeEventListener('pointermove', onPointerMove);
        activeHandle.removeEventListener('pointerup', endResize);
        activeHandle.removeEventListener('pointercancel', endResize);
      }
      pointerId = null;
      dir = '';
      activeHandle = null;
      windowElement.dispatchEvent(new CustomEvent('window:resize-end', { bubbles: false }));
    };

    windowElement.querySelectorAll('.resize-handle').forEach((handle) => {
      handle.addEventListener('pointerdown', (e) => {
        if (Utils.isCompact() || windowElement.dataset.maximized === '1') return;
        if (e.button !== undefined && e.button !== 0) return;
        dir = Array.from(handle.classList)
          .find((c) => c.startsWith('resize-') && c !== 'resize-handle')
          .replace('resize-', '');
        pointerId = e.pointerId;
        activeHandle = handle;
        startX = e.clientX;
        startY = e.clientY;
        startW = windowElement.offsetWidth;
        startH = windowElement.offsetHeight;
        startL = windowElement.offsetLeft;
        startT = windowElement.offsetTop;
        this.bringToFront(windowElement);
        try { handle.setPointerCapture(pointerId); } catch (_) {}
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', endResize);
        handle.addEventListener('pointercancel', endResize);
        e.preventDefault();
      });
    });
  }

  /** Keep floating windows inside the viewport after a resize / rotation. */
  clampToViewport(win) {
    if (!win || Utils.isCompact() || win.dataset.maximized === '1') return;
    if (win.classList.contains('window--hidden')) return;
    // A window inside a hidden ancestor measures 0x0. Clamping it then would
    // stamp inline left/top of 0 and destroy the position it was laid out with.
    if (!win.offsetParent || !win.offsetWidth || !win.offsetHeight) return;
    const maxX = Math.max(0, window.innerWidth - win.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - Utils.taskbarHeight() - win.offsetHeight);
    const area = Utils.workArea();
    if (win.offsetWidth > area.width) win.style.width = `${area.width}px`;
    if (win.offsetHeight > area.height) win.style.height = `${area.height}px`;
    win.style.left = `${Utils.clamp(win.offsetLeft, 0, maxX)}px`;
    win.style.top = `${Utils.clamp(win.offsetTop, 0, maxY)}px`;
  }

  clampAllToViewport() {
    document.querySelectorAll('.desktop .window').forEach((w) => this.clampToViewport(w));
  }

  closeWindow(windowElement) {
    const data = this.windows.get(windowElement);
    if (data && data.cleanupDrag) data.cleanupDrag();
    this.windows.delete(windowElement);
    if (windowElement && windowElement.parentNode) windowElement.remove();
  }

  minimizeWindow(windowElement) {
    if (windowElement) windowElement.classList.add('window--hidden');
  }

  restoreWindow(windowElement) {
    if (!windowElement) return;
    windowElement.classList.remove('window--hidden');
    this.bringToFront(windowElement);
  }
}

// Global instance — exposed on window so every module resolves it the same way.
const windowManager = new WindowManager();
window.windowManager = windowManager;
