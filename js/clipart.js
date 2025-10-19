// ============================================
// CLIPART RENDERER (Retro)
// Provides small, CSS-box styled clipart snippets for reuse
// ============================================


(function () {
  const CLIPART_META = {
    faucet: { label: 'Water Saver Graphic', theme: 'aquatic' },
    book: { label: 'Study Stack Graphic', theme: 'print' },
    bolt: { label: 'Power Burst Graphic', theme: 'electric' },
    generic: { label: 'Oxford Clip Library', theme: 'generic' }
  };

  function wrap(kindKey, markup) {
    const meta = CLIPART_META[kindKey] || CLIPART_META.generic;
    return `
      <div class="clipart-box clipart-theme-${meta.theme}">
        ${markup.trim()}
        <div class="clipart-label"><span class="clipart-label-text">${meta.label}</span></div>
      </div>
    `.trim();
  }

  function render(kind) {
    const key = (kind || 'generic').toLowerCase();
    switch (key) {
      case 'faucet':
        return wrap('faucet', `
          <div class="clipart faucet">
            <div class="faucet-neck"></div>
            <div class="faucet-head"></div>
            <div class="faucet-drop"></div>
          </div>
        `);
      case 'book':
        return wrap('book', `
          <div class="clipart book">
            <div class="book-cover"></div>
            <div class="book-pages"></div>
          </div>
        `);
      case 'bolt':
        return wrap('bolt', `
          <div class="clipart bolt">
            <div class="bolt-shape"></div>
          </div>
        `);
      default:
        return wrap('generic', `
          <div class="clipart generic"></div>
        `);
    }
  }

  window.Clipart = { render };
})();

