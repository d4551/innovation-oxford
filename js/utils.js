// ============================================
// UTILS (DRY helpers)
// Provides small, reusable helpers for event binding, escaping and assets
// ============================================

(function () {
  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  // Event helper: supports delegation when selector is provided
  function on(root, event, selector, handler) {
    if (!root) return;
    if (typeof selector === 'function') {
      root.addEventListener(event, selector);
      return;
    }
    root.addEventListener(event, function (e) {
      const match = e.target && e.target.closest(selector);
      if (match && root.contains(match)) handler.call(match, e);
    });
  }

  // Promise-based image loader
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  window.Utils = { escapeHtml, on, loadImage, clamp };
})();

