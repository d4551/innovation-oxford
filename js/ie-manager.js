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
    // The snapshot fills the window, so a phone needs a fraction of what a
    // maximized window on a 2560 display does. It used to be one 3.4MB PNG for
    // everybody, which is most of this app's weight for one picture.
    this.snapshotSrcset = [1024, 1600, 2560].map((w) => `media/oxford-page-${w}.webp ${w}w`).join(', ');
    this.snapshotSrc = 'media/oxford-page-1600.webp';
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
               srcset="${Utils.escapeAttr(this.snapshotSrcset)}" sizes="100vw"
               fetchpriority="high"
               width="1600" height="4840"
               alt="Screenshot of the Oxford course page. Opens the real page in a new tab."
               decoding="async" />
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
    this.matchSnapshotToWindow();
  }

  /**
   * The snapshot fills the window, not the viewport, so a static `sizes` would
   * be wrong in one direction or the other: too small once the window is
   * maximized, or needlessly large while it is not. Measure the element and
   * tell the browser the truth. Widening it re-selects a larger source;
   * narrowing keeps the one already fetched, which is what you want.
   */
  matchSnapshotToWindow() {
    const snapshot = this.$('.ie-snapshot');
    if (!snapshot) return;
    const width = Math.round(snapshot.getBoundingClientRect().width);
    if (width > 0) snapshot.sizes = `${width}px`;
  }

  onResize() { this.matchSnapshotToWindow(); }

  onShow(url) {
    if (url) this.navigate(url);
    // The window is laid out by the time this runs on first open, but a
    // restore from the taskbar can land before layout settles.
    requestAnimationFrame(() => this.matchSnapshotToWindow());
  }

  navigate(url) {
    this.currentUrl = url;
    if (this.addressInput) this.addressInput.value = url;
  }
}

window.IEManager = IEManager;
