// ============================================
// UTILS (DRY helpers)
// Small, reusable helpers for escaping, event binding, layout and assets.
// Every module uses these instead of rolling its own copy.
// ============================================

(function () {
  // Height of the taskbar. Measured from the element when it exists, so the
  // safe-area inset on notched phones is always included; the CSS custom
  // property is the fallback before layout.
  function taskbarHeight() {
    const el = document.querySelector('.taskbar');
    if (el) {
      const h = el.getBoundingClientRect().height;
      if (h > 0) return Math.round(h);
    }
    const n = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-h'), 10);
    return Number.isFinite(n) ? n : 32;
  }

  // Escape for text position in HTML.
  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  // Escape for a double-quoted attribute value.
  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
  }

  /**
   * Event helper. With a selector it delegates from `root`.
   *
   * During a delegated call, `event.currentTarget` is retargeted to the matched
   * element — the same thing a listener bound directly to that element would
   * see — so handlers can read `e.currentTarget.dataset` without caring whether
   * they are delegated. Without this, `currentTarget` is the delegation root and
   * every dataset lookup silently returns undefined.
   *
   * Returns an unbind function.
   */
  function on(root, event, selector, handler, options) {
    if (!root) return () => {};
    if (typeof selector === 'function') {
      root.addEventListener(event, selector, handler);
      return () => root.removeEventListener(event, selector, handler);
    }
    const wrapped = function (e) {
      const match = e.target && e.target.closest && e.target.closest(selector);
      if (!match || !root.contains(match)) return;
      const original = Object.getOwnPropertyDescriptor(e, 'currentTarget');
      Object.defineProperty(e, 'currentTarget', { value: match, configurable: true });
      try {
        handler.call(match, e);
      } finally {
        if (original) Object.defineProperty(e, 'currentTarget', original);
        else delete e.currentTarget;
      }
    };
    root.addEventListener(event, wrapped, options);
    return () => root.removeEventListener(event, wrapped, options);
  }

  // Promise-based image loader.
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // True when the viewport is too small for free-floating windows, so apps
  // render full-bleed instead. Mirrors the `--compact` breakpoint in main.css.
  function isCompact() {
    return document.body.classList.contains('is-compact');
  }

  // True on touch-primary devices (no reliable hover).
  function isTouch() {
    return window.matchMedia('(hover: none)').matches;
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Usable desktop area, excluding the taskbar.
  function workArea() {
    return {
      width: window.innerWidth,
      height: Math.max(120, window.innerHeight - taskbarHeight()),
    };
  }

  // Centre a window box of the given size inside the work area, shrinking it to
  // fit when the viewport is smaller than the requested size.
  function fitBox(preferredW, preferredH, margin = 16) {
    const area = workArea();
    const width = Math.min(preferredW, area.width - margin * 2);
    const height = Math.min(preferredH, area.height - margin * 2);
    return {
      width: Math.max(240, width),
      height: Math.max(160, height),
      left: Math.max(margin / 2, Math.round((area.width - width) / 2)),
      top: Math.max(margin / 2, Math.round((area.height - height) / 2)),
    };
  }

  window.Utils = {
    escapeHtml,
    escapeAttr,
    on,
    loadImage,
    clamp,
    isCompact,
    isTouch,
    prefersReducedMotion,
    taskbarHeight,
    workArea,
    fitBox,
  };
})();
