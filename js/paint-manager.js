// ============================================
// PAINT MANAGER (Win95-style MS Paint)
// Draw on a transparent canvas laid over a base image, then save the
// composite. Drawing uses Pointer Events, so it works with mouse, finger and
// stylus (including pressure-insensitive touch) on one code path.
// ============================================

const PAINT_HISTORY_LIMIT = 30;

class PaintManager extends AppWindow {
  constructor({ imagePath } = {}) {
    super({
      id: 'paint',
      title: 'Oxford Paint',
      className: 'paint-window',
      iconClass: 'paint-icon',
      width: 780,
      height: 560,
    });
    this.imagePath = imagePath || 'media/inno-paint.jpg';
    this.tool = 'pencil';
    this.drawingPointerId = null;
    this.lastX = 0;
    this.lastY = 0;
    this.naturalW = 0;
    this.naturalH = 0;
    this.history = [];
    this.historyIndex = -1;
    this.onWindowResize = () => this.updateScaleToFit();
    this.cursors = {
      pencil: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"><path d=\"M1 11 L5 15 L15 5 L11 1 Z\" fill=\"%23000\"/><path d=\"M2 11 L5 14 L14 5 L11 2 Z\" fill=\"%23f4c542\"/></svg>') 0 16, crosshair",
      eraser: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\"><rect x=\"2\" y=\"8\" width=\"10\" height=\"6\" fill=\"%23d9a441\" stroke=\"%238b5a00\"/><rect x=\"4\" y=\"6\" width=\"8\" height=\"4\" fill=\"%23e6c177\" stroke=\"%238b5a00\"/></svg>') 0 16, cell",
    };
  }

  renderBody(body) {
    body.innerHTML = `
      <div class="paint-toolbar">
        <div class="tools" role="group" aria-label="Tools">
          <button type="button" class="btn-95 paint-tool" data-tool="pencil" aria-pressed="true" aria-label="Pencil" title="Pencil"></button>
          <button type="button" class="btn-95 paint-tool" data-tool="eraser" aria-pressed="false" aria-label="Eraser" title="Eraser"></button>
        </div>
        <div class="options">
          <label class="paint-opt">Color <input type="color" class="paint-color" value="#000000" aria-label="Colour" /></label>
          <label class="paint-opt">Size <input type="range" class="paint-size" min="1" max="24" value="4" aria-label="Brush size" /></label>
          <button type="button" class="btn-95" data-act="undo" title="Undo (Ctrl+Z)">Undo</button>
          <button type="button" class="btn-95" data-act="redo" title="Redo (Ctrl+Y)">Redo</button>
          <button type="button" class="btn-95" data-act="save" title="Save image">Save</button>
        </div>
      </div>
      <div class="paint-canvas-wrap">
        <img class="paint-base" alt="" aria-hidden="true" />
        <canvas class="paint-draw" aria-label="Drawing canvas" role="img"></canvas>
      </div>
    `;

    this.canvasWrap = this.$('.paint-canvas-wrap');
    this.baseImgEl = this.$('.paint-base');
    this.drawCanvas = this.$('.paint-draw');
    this.colorEl = this.$('.paint-color');
    this.sizeEl = this.$('.paint-size');
    this.drawCtx = this.drawCanvas.getContext('2d', { willReadFrequently: true });

    Utils.on(body, 'click', '.paint-tool', (e) => {
      this.$$('.paint-tool').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      e.currentTarget.setAttribute('aria-pressed', 'true');
      this.tool = e.currentTarget.dataset.tool;
      this.updateCursor();
    });

    Utils.on(body, 'click', '[data-act]', (e) => {
      const act = e.currentTarget.dataset.act;
      if (act === 'undo') this.undo();
      else if (act === 'redo') this.redo();
      else if (act === 'save') this.saveImage();
    });

    this.bindDrawing();

    this.windowEl.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); this.redo(); }
    });

    this.loadBaseImage(this.imagePath);
    this.updateCursor();
    window.addEventListener('resize', this.onWindowResize);
  }

  onResize() { this.updateScaleToFit(); }

  bindDrawing() {
    const canvas = this.drawCanvas;
    // Stop the browser from scrolling/zooming while a stroke is in progress.
    canvas.style.touchAction = 'none';

    const pos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const onPointerMove = (e) => {
      if (e.pointerId !== this.drawingPointerId) return;
      e.preventDefault();
      // Coalesced events keep fast strokes smooth instead of polygonal.
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      events.forEach((ev) => {
        const p = pos(ev);
        this.drawLine(this.lastX, this.lastY, p.x, p.y);
        this.lastX = p.x;
        this.lastY = p.y;
      });
    };

    const endStroke = (e) => {
      if (this.drawingPointerId === null || (e && e.pointerId !== this.drawingPointerId)) return;
      try { canvas.releasePointerCapture(this.drawingPointerId); } catch (_) {}
      this.drawingPointerId = null;
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endStroke);
      canvas.removeEventListener('pointercancel', endStroke);
      this.pushHistory();
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      this.drawingPointerId = e.pointerId;
      const p = pos(e);
      this.lastX = p.x;
      this.lastY = p.y;
      this.drawPoint(p.x, p.y);
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', endStroke);
      canvas.addEventListener('pointercancel', endStroke);
    });
  }

  loadBaseImage(src) {
    this.baseImgEl.onload = () => {
      this.naturalW = this.baseImgEl.naturalWidth;
      this.naturalH = this.baseImgEl.naturalHeight;
      this.drawCanvas.width = this.naturalW;
      this.drawCanvas.height = this.naturalH;
      this.updateScaleToFit();
      this.clearHistory();
      this.pushHistory();
    };
    this.baseImgEl.onerror = (e) => {
      console.error('Oxford Paint: failed to load base image', src, e);
      if (this.canvasWrap) {
        this.canvasWrap.insertAdjacentHTML('afterbegin',
          '<p class="paint-error" role="alert">Could not load the base image. You can still draw on a blank canvas.</p>');
      }
      // Fall back to a usable blank canvas rather than a dead window.
      this.naturalW = 800;
      this.naturalH = 600;
      this.drawCanvas.width = this.naturalW;
      this.drawCanvas.height = this.naturalH;
      this.updateScaleToFit();
      this.clearHistory();
      this.pushHistory();
    };
    this.baseImgEl.src = src;
  }

  updateScaleToFit() {
    if (!this.canvasWrap || !this.naturalW || !this.naturalH) return;
    const rect = this.canvasWrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Utils.clamp(Math.min(rect.width / this.naturalW, rect.height / this.naturalH), 0.05, 1);
    const w = `${Math.round(this.naturalW * scale)}px`;
    const h = `${Math.round(this.naturalH * scale)}px`;
    [this.baseImgEl, this.drawCanvas].forEach((el) => {
      if (!el) return;
      el.style.width = w;
      el.style.height = h;
    });
  }

  updateCursor() {
    if (!this.drawCanvas) return;
    // Custom cursors are pointless on touch; keep the default there.
    this.drawCanvas.style.cursor = Utils.isTouch()
      ? 'crosshair'
      : (this.tool === 'eraser' ? this.cursors.eraser : this.cursors.pencil);
  }

  get brushSize() { return parseInt(this.sizeEl.value, 10) || 4; }
  get erasing() { return this.tool === 'eraser'; }

  drawLine(x1, y1, x2, y2) {
    const ctx = this.drawCtx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.brushSize;
    ctx.globalCompositeOperation = this.erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = this.erasing ? 'rgba(0,0,0,1)' : this.colorEl.value;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  drawPoint(x, y) {
    const ctx = this.drawCtx;
    ctx.globalCompositeOperation = this.erasing ? 'destination-out' : 'source-over';
    ctx.fillStyle = this.erasing ? 'rgba(0,0,0,1)' : this.colorEl.value;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, this.brushSize / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- history ----------
  clearHistory() { this.history = []; this.historyIndex = -1; }

  pushHistory() {
    try {
      const img = this.drawCtx.getImageData(0, 0, this.drawCanvas.width, this.drawCanvas.height);
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(img);
      if (this.history.length > PAINT_HISTORY_LIMIT) this.history.shift();
      this.historyIndex = this.history.length - 1;
    } catch (err) {
      console.warn('Oxford Paint: could not snapshot canvas', err);
    }
  }

  applyHistory(index) {
    const img = this.history[index];
    if (!img) return;
    try { this.drawCtx.putImageData(img, 0, 0); } catch (_) {}
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.applyHistory(--this.historyIndex);
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.applyHistory(++this.historyIndex);
  }

  saveImage() {
    const { width: w, height: h } = this.drawCanvas;
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    try {
      if (this.baseImgEl.naturalWidth) ctx.drawImage(this.baseImgEl, 0, 0, w, h);
      ctx.drawImage(this.drawCanvas, 0, 0);
      const a = document.createElement('a');
      a.href = off.toDataURL('image/png');
      a.download = 'OxfordPaint.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.warn('Oxford Paint: save failed', err);
    }
  }

  onClose() {
    window.removeEventListener('resize', this.onWindowResize);
    this.clearHistory();
    this.drawCanvas = null;
    this.drawCtx = null;
    this.canvasWrap = null;
    this.baseImgEl = null;
  }
}

window.PaintManager = PaintManager;
