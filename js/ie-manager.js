// ============================================
// INTERNET EXPLORER (FAKE) MODULE
// A Win95 browser chrome around a static snapshot of the Oxford course page.
// Clicking the page or "Open in Tab" opens the real course in a new tab.
// ============================================

class IEManager extends AppWindow {
  constructor() {
    super({
      id: 'internet-explorer',
      title: 'Internet Explorer',
      className: 'ie-window',
      iconClass: 'ie-icon',
      width: 900,
      height: 600,
    });
    this.defaultUrl = 'https://lifelong-learning.ox.ac.uk/courses/emerging-technologies-for-social-innovation-and-entrepreneurship?code=O25P103COJ';
    this.snapshotSrc = 'media/oxford-page.png';
    this.currentUrl = this.defaultUrl;
  }

  renderBody(body) {
    body.innerHTML = `
      <div class="ie-toolbar">
        <div class="ie-toolbar-row">
          <span class="ie-brand">Oxford</span>
          <label class="visually-hidden" for="ie-address">Address</label>
          <input id="ie-address" class="input-95 ie-address" type="text" readonly />
          <button type="button" class="btn-95 ie-open-tab">Open in Tab</button>
        </div>
      </div>
      <div class="ie-frame-wrap">
        <div class="ie-scroll">
          <img class="ie-snapshot" src="${Utils.escapeAttr(this.snapshotSrc)}"
               alt="Screenshot of the Oxford course page. Opens the real page in a new tab."
               loading="lazy" decoding="async" />
        </div>
      </div>
    `;

    this.addressInput = this.$('.ie-address');
    this.addressInput.value = this.currentUrl;

    const openInTab = () => window.open(this.currentUrl, '_blank', 'noopener,noreferrer');
    this.$('.ie-open-tab').addEventListener('click', openInTab);

    const snapshot = this.$('.ie-snapshot');
    snapshot.addEventListener('click', openInTab);
    snapshot.setAttribute('role', 'link');
    snapshot.setAttribute('tabindex', '0');
    snapshot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInTab(); }
    });
  }

  onShow(url) {
    if (url) this.navigate(url);
  }

  navigate(url) {
    this.currentUrl = url;
    if (this.addressInput) this.addressInput.value = url;
  }
}

window.IEManager = IEManager;
