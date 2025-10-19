// ============================================
// PAINT MANAGER (Win95-style MS Paint)
// Opens a paint window and loads media/inno-paint.jpg
// ============================================

class PaintManager {
  constructor({ imagePath } = {}) {
    this.imagePath = imagePath || 'media/inno-paint.jpg';
    this.windowEl = null;
    this.bodyEl = null;
    this.canvasWrap = null;
    this.baseImgEl = null;
    this.drawCanvas = null;
    this.drawCtx = null;
    this.colorEl = null;
    this.sizeEl = null;
    this.tool = 'pencil';
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.taskbarId = 'paint';
    // History for undo/redo (draw layer only)
    this.history = [];
    this.historyIndex = -1;
    // Cursors for tools
    this.cursors = {
      pencil:
        "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"><path d=\"M1 11 L5 15 L15 5 L11 1 Z\" fill=\"%23000\"/><path d=\"M2 11 L5 14 L14 5 L11 2 Z\" fill=\"%23f4c542\"/></svg>') 0 16, crosshair",
      eraser:
        "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"><rect x=\"2\" y=\"8\" width=\"10\" height=\"6\" fill=\"%23d9a441\" stroke=\"%238b5a00\"/><rect x=\"4\" y=\"6\" width=\"8\" height=\"4\" fill=\"%23e6c177\" stroke=\"%238b5a00\"/></svg>') 0 16, not-allowed"
    };
  }

  open() {
    if (this.windowEl) {
      this.windowEl.style.display = 'block';
      this.activate();
      return this.windowEl;
    }

    const shell = windowManager.createWindowShell({
      title: 'Oxford Paint',
      className: 'paint-window',
      width: '780px', height: '560px', top: '70px', left: '120px',
      controls: { minimize: true, maximize: true, close: true }
    });
    const win = this.windowEl = shell.windowEl;
    const body = this.bodyEl = shell.body;

    body.innerHTML = `
      <div class="paint-toolbar">
        <div class="tools" role="group" aria-label="Tools">
          <button class="btn-95 paint-tool" data-tool="pencil" aria-pressed="true" aria-label="Pencil" title="Pencil"></button>
          <button class="btn-95 paint-tool" data-tool="eraser" aria-pressed="false" aria-label="Eraser" title="Eraser"></button>
        </div>
        <div class="options">
          <label>Color <input type="color" class="paint-color" value="#000000" aria-label="Color"></label>
          <label>Size <input type="range" class="paint-size" min="1" max="24" value="4" aria-label="Brush size"></label>
          <button class="btn-95" data-act="undo" title="Undo (Ctrl+Z)">Undo</button>
          <button class="btn-95" data-act="redo" title="Redo (Ctrl+Y)">Redo</button>
          <button class="btn-95" data-act="save" title="Save Image">Save</button>
        </div>
      </div>
      <div class="paint-canvas-wrap"><img class="paint-base" alt="Base"/><canvas class="paint-draw" aria-label="Drawing canvas"></canvas></div>
    `;

    this.canvasWrap = body.querySelector('.paint-canvas-wrap');
    this.baseImgEl = body.querySelector('.paint-base');
    this.drawCanvas = body.querySelector('.paint-draw');
    this.colorEl = body.querySelector('.paint-color');
    this.sizeEl = body.querySelector('.paint-size');
    this.drawCtx = this.drawCanvas.getContext('2d');

    // Wire tools
    body.querySelectorAll('.paint-tool').forEach(btn => {
      btn.addEventListener('click', () => {
        body.querySelectorAll('.paint-tool').forEach(b => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        this.tool = btn.getAttribute('data-tool');
        this.updateCursor();
      });
    });

    // Mouse/pointer drawing
    const getPos = (evt) => {
      const rect = this.drawCanvas.getBoundingClientRect();
      const x = (evt.clientX - rect.left) * (this.drawCanvas.width / rect.width);
      const y = (evt.clientY - rect.top) * (this.drawCanvas.height / rect.height);
      return { x, y };
    };
    const onDown = (e) => { this.isDrawing = true; const p = getPos(e); this.lastX = p.x; this.lastY = p.y; this.drawPoint(p.x, p.y, true); };
    const onMove = (e) => { if (!this.isDrawing) return; const p = getPos(e); this.drawLine(this.lastX, this.lastY, p.x, p.y); this.lastX = p.x; this.lastY = p.y; };
    const onUp = () => { if (!this.isDrawing) return; this.isDrawing = false; this.pushHistory(); };
    this.drawCanvas.addEventListener('mousedown', onDown);
    this.drawCanvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // Taskbar button
    if (window.taskbarManager) {
      window.taskbarManager.addWindow(this.taskbarId, 'Oxford Paint', {
        onToggle: () => this.toggleFromTaskbar(),
        iconClass: 'paint-icon'
      });
    }

    // Titlebar controls
    const [minBtn, maxBtn, closeBtn] = shell.controls || [];
    if (minBtn) minBtn.addEventListener('click', () => this.minimize());
    if (maxBtn) maxBtn.addEventListener('click', () => this.toggleMaximize());
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    win.addEventListener('mousedown', () => this.activate());

    // Load image and size canvases
    this.loadBaseImage(this.imagePath);

    // Initial cursor
    this.updateCursor();

    // Keep scaled to window in fit mode
    window.addEventListener('resize', () => { if (this.zoomMode === 'fit') this.updateScaleToFit(); });

    // Toolbar actions
    body.querySelector('[data-act="undo"]').addEventListener('click', () => this.undo());
    body.querySelector('[data-act="redo"]').addEventListener('click', () => this.redo());
    body.querySelector('[data-act="save"]').addEventListener('click', () => this.saveImage());

    // Keyboard shortcuts for undo/redo
    this.windowEl.addEventListener('keydown', (e) => {
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); this.undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && (e.key === 'Z' || e.key === 'z')))) { e.preventDefault(); this.redo(); }
    });

    return win;
  }

  loadBaseImage(src) {
    this.baseImgEl.onload = () => {
      const w = this.baseImgEl.naturalWidth;
      const h = this.baseImgEl.naturalHeight;
      this.naturalW = w; this.naturalH = h;
      // Keep internal pixels at natural size for crisp drawing
      this.drawCanvas.width = w;
      this.drawCanvas.height = h;
      // Fit display to current window size
      this.updateScaleToFit();
      // Initialize history with empty state
      this.clearHistory();
      this.pushHistory();
    };
    this.baseImgEl.onerror = (e) => {
      this.baseImgEl.alt = 'Failed to load inno-paint.jpg';
      // Helpful debug
      try { console.error('Oxford Paint: failed to load base image', src, e); } catch(_) {}
    };
    this.baseImgEl.src = src;
  }

  updateScaleToFit() {
    if (!this.canvasWrap || !this.baseImgEl || !this.drawCanvas || !this.naturalW || !this.naturalH) return;
    const wrapRect = this.canvasWrap.getBoundingClientRect();
    if (!wrapRect.width || !wrapRect.height) return;
    const scale = Math.min(wrapRect.width / this.naturalW, wrapRect.height / this.naturalH);
    const s = Math.max(0.1, Math.min(1, scale)); // downscale to fit; avoid upscaling above 100%
    const dispW = Math.round(this.naturalW * s);
    const dispH = Math.round(this.naturalH * s);
    this.baseImgEl.style.width = dispW + 'px';
    this.baseImgEl.style.height = dispH + 'px';
    this.drawCanvas.style.width = dispW + 'px';
    this.drawCanvas.style.height = dispH + 'px';
  }

  updateCursor() {
    if (!this.drawCanvas) return;
    const cur = this.tool === 'eraser' ? this.cursors.eraser : this.cursors.pencil;
    this.drawCanvas.style.cursor = cur;
  }

  drawLine(x1, y1, x2, y2) {
    const size = parseInt(this.sizeEl.value, 10) || 4;
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.lineWidth = size;
    const erasing = (this.tool === 'eraser');
    this.drawCtx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    this.drawCtx.strokeStyle = erasing ? 'rgba(0,0,0,1)' : this.colorEl.value;
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(x1, y1);
    this.drawCtx.lineTo(x2, y2);
    this.drawCtx.stroke();
    this.drawCtx.globalCompositeOperation = 'source-over';
  }

  drawPoint(x, y, start) {
    const size = parseInt(this.sizeEl.value, 10) || 4;
    const erasing = (this.tool === 'eraser');
    this.drawCtx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    this.drawCtx.fillStyle = erasing ? 'rgba(0,0,0,1)' : this.colorEl.value;
    this.drawCtx.beginPath();
    this.drawCtx.arc(x, y, Math.max(1, size / 2), 0, Math.PI * 2);
    this.drawCtx.fill();
    this.drawCtx.globalCompositeOperation = 'source-over';
  }

  // ---------- History / Export ----------
  clearHistory() { this.history = []; this.historyIndex = -1; }
  pushHistory() {
    try {
      const img = this.drawCtx.getImageData(0, 0, this.drawCanvas.width, this.drawCanvas.height);
      // Truncate redo stack then push
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(img);
      // Cap history to last 30 states
      if (this.history.length > 30) this.history.shift();
      this.historyIndex = this.history.length - 1;
    } catch (e) {}
  }
  restoreImageData(img) {
    try { this.drawCtx.putImageData(img, 0, 0); } catch (e) {}
  }
  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex -= 1;
    const img = this.history[this.historyIndex];
    if (img) this.restoreImageData(img);
  }
  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex += 1;
    const img = this.history[this.historyIndex];
    if (img) this.restoreImageData(img);
  }
  saveImage() {
    // Composite base image + draw layer into an offscreen canvas and download
    const w = this.drawCanvas.width;
    const h = this.drawCanvas.height;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ctx = off.getContext('2d');
    try {
      ctx.drawImage(this.baseImgEl, 0, 0, w, h);
      ctx.drawImage(this.drawCanvas, 0, 0);
      const url = off.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url; a.download = 'OxfordPaint.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
  }

  minimize() { if (this.windowEl) { this.windowEl.style.display = 'none'; if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, false); } }
  toggleMaximize() {
    const win = this.windowEl; if (!win) return; const isMax = win.dataset.maximized === '1';
    if (isMax) { win.style.top = win.dataset.prevTop || '70px'; win.style.left = win.dataset.prevLeft || '120px'; win.style.width = win.dataset.prevWidth || '780px'; win.style.height = win.dataset.prevHeight || '560px'; win.dataset.maximized = '0'; }
    else { win.dataset.prevTop = win.style.top; win.dataset.prevLeft = win.style.left; win.dataset.prevWidth = win.style.width; win.dataset.prevHeight = win.style.height; win.style.top = '0px'; win.style.left = '0px'; win.style.width = `${window.innerWidth - 4}px`; win.style.height = `${window.innerHeight - 28 - 4}px`; win.dataset.maximized = '1'; }
  }
  toggleFromTaskbar() { if (!this.windowEl) { this.open(); return; } const hidden = this.windowEl.style.display === 'none'; if (hidden) { this.windowEl.style.display = 'block'; this.activate(); } else { this.minimize(); } }
  activate() { if (!this.windowEl) return; this.windowEl.style.zIndex = ++windowManager.zIndexCounter; if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, true); }
  close() {
    if (!this.windowEl) return;
    // Close the window shell
    windowManager.closeWindow(this.windowEl);
    this.windowEl = null;
    this.bodyEl = null;
    this.canvasWrap = null;
    this.baseImgEl = null;
    this.drawCanvas = null;
    this.drawCtx = null;
    // Remove taskbar button so it doesn't linger
    if (window.taskbarManager) {
      window.taskbarManager.remove(this.taskbarId);
    }
  }
}

// Global in main.js
