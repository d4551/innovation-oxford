// ============================================
// OXFORD CHANNELS (AOL-style channels)
// A scrollable grid of channel tiles; each opens the slide deck at that slide.
// The deck itself is a separate AppWindow that is reused, not respawned.
// ============================================

class SlidesWindow extends AppWindow {
  constructor(channels) {
    super({
      id: 'slides',
      title: 'Innovation & You: A Survival Guide',
      taskbarTitle: 'Innovation & You',
      className: 'slides-window',
      iconClass: 'channels-icon',
      width: 820,
      height: 600,
    });
    this.channels = channels;
    this.slides = [];
    this.index = 0;
  }

  renderBody(body) {
    body.classList.add('slides-body');
    body.innerHTML = `
      <div class="slides-header">
        <div class="slides-brand">
          <img src="media/Oxford/logo.svg" class="slides-logo" alt="" aria-hidden="true" />
          <div class="slides-title">Innovation &amp; You</div>
        </div>
        <div class="slides-actions">
          <button type="button" class="btn-95" data-act="prev" aria-label="Previous slide">◀ Prev</button>
          <span class="slides-count" aria-live="polite">0 / 0</span>
          <button type="button" class="btn-95" data-act="next" aria-label="Next slide">Next ▶</button>
        </div>
      </div>
      <div class="slides-view" tabindex="0" role="group" aria-label="Slide content"></div>
    `;

    this.viewEl = this.$('.slides-view');
    this.countEl = this.$('.slides-count');
    this.$('[data-act="prev"]').addEventListener('click', () => this.go(-1));
    this.$('[data-act="next"]').addEventListener('click', () => this.go(1));

    // Arrow keys navigate whenever focus is anywhere inside the window.
    this.windowEl.setAttribute('tabindex', '-1');
    this.windowEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); this.go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(-1); }
    });

    // Media buttons are delegated, so re-rendering never orphans a handler.
    Utils.on(this.viewEl, 'click', '.media-play-btn', (e) => {
      const btn = e.currentTarget;
      if (!window.mediaPlayerManager) return;
      let src = btn.dataset.src || '';
      if (!src) return;
      if (!src.startsWith('#file:') && !/^https?:/i.test(src) && !src.startsWith('media/') && !src.startsWith('/')) {
        src = `#file:${src}`;
      }
      window.mediaPlayerManager.open({
        src,
        title: btn.dataset.title || src,
        mediaType: btn.dataset.type || 'video',
        autoplay: true,
        fromGesture: true,
      });
    });

    Utils.on(this.viewEl, 'click', '.slide-toggle-btn', (e) => {
      const btn = e.currentTarget;
      const wrap = btn.parentElement.querySelector('.slide-toggle-image');
      if (!wrap) return;
      const nowHidden = !wrap.hidden;
      wrap.hidden = nowHidden;
      btn.textContent = nowHidden ? btn.dataset.showLabel : btn.dataset.hideLabel;
      btn.setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
    });
  }

  onShow(deckName = 'innovation', initialIndex = 0) {
    this.slides = this.channels.getDeckSlides(deckName);
    this.index = Utils.clamp(parseInt(initialIndex, 10) || 0, 0, Math.max(this.slides.length - 1, 0));
    this.render();
    if (this.viewEl) this.viewEl.focus({ preventScroll: true });
  }

  go(delta) {
    if (!this.slides.length) return;
    this.index = (this.index + delta + this.slides.length) % this.slides.length;
    this.render();
  }

  render() {
    if (!this.viewEl) return;
    const total = this.slides.length;
    if (!total) {
      this.viewEl.innerHTML = `
        <div class="slide empty-slide">
          <div class="slide-title">No slides available</div>
          <div class="slide-text"><p>Check back soon for new content.</p></div>
        </div>`;
      this.countEl.textContent = '0 / 0';
      return;
    }

    const s = this.slides[this.index] || {};
    const esc = Utils.escapeHtml;
    const clip = s.clipart && window.Clipart ? window.Clipart.render(s.clipart.kind) : '';
    const img = s.image
      ? `<div class="slide-image"><img class="retro-asset" src="${Utils.escapeAttr(s.image)}" loading="lazy" decoding="async" alt="${Utils.escapeAttr(s.imageAlt || '')}" /></div>`
      : '';
    const paras = (s.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('');

    const mediaLinks = Array.isArray(s.mediaLinks)
      ? s.mediaLinks
      : (s.mediaFile ? [{ label: s.mediaFile, path: s.mediaFile, type: 'video' }] : []);
    const mediaHtml = mediaLinks.length
      ? `<div class="slide-media-links">${mediaLinks.map((link) => {
          const label = link.label || link.file || link.path || 'Play Clip';
          const src = link.path || link.file || '';
          return `<button type="button" class="btn-95 media-play-btn" data-src="${Utils.escapeAttr(src)}" data-title="${Utils.escapeAttr(label)}" data-type="${Utils.escapeAttr(link.type || 'video')}">${esc(label)}</button>`;
        }).join('')}</div>`
      : '';

    this.viewEl.innerHTML = `
      <div class="slide">
        <div class="slide-title">${esc(s.title)}</div>
        ${s.subtitle ? `<div class="slide-subtitle">${esc(s.subtitle)}</div>` : ''}
        ${clip}
        ${img}
        <div class="slide-text">${paras}</div>
        ${mediaHtml}
      </div>
    `;

    if (s.imageToggle) this.injectExhibitToggle(s.imageToggle);
    this.countEl.textContent = `${this.index + 1} / ${total}`;
    this.viewEl.scrollTop = 0;
  }

  injectExhibitToggle(cfg) {
    const paragraphs = Array.from(this.viewEl.querySelectorAll('.slide-text p'));
    const anchor = paragraphs.find((p) => /exhibit\s*a/i.test(p.textContent || ''));
    if (!anchor) return;

    const showLabel = cfg.label || 'Show Exhibit Image';
    const hideLabel = cfg.hideLabel || 'Hide Exhibit Image';
    const wrap = document.createElement('div');
    wrap.className = 'slide-toggle-block';
    wrap.innerHTML = `
      <button type="button" class="btn-95 slide-toggle-btn" aria-expanded="false"
              data-show-label="${Utils.escapeAttr(showLabel)}" data-hide-label="${Utils.escapeAttr(hideLabel)}">${Utils.escapeHtml(showLabel)}</button>
      <div class="slide-toggle-image" hidden>
        <img class="retro-asset" src="${Utils.escapeAttr(cfg.src || '')}" loading="lazy" decoding="async" alt="${Utils.escapeAttr(cfg.alt || showLabel)}" />
      </div>
    `;
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
  }
}

class ChannelsManager extends AppWindow {
  constructor({ ieManager } = {}) {
    super({
      id: 'channels',
      title: 'Oxford Channels',
      className: 'channels-window',
      iconClass: 'channels-icon',
      width: 760,
      height: 560,
    });
    this.ieManager = ieManager || null;
    this.slidesWindow = null;
  }

  renderBody(body) {
    const slides = this.getDeckSlides('innovation');
    const tiles = slides.map((s, i) => {
      const title = s.title || `Slide ${i + 1}`;
      const subtitle = s.subtitle ? s.subtitle.split('\n')[0].slice(0, 60) : '';
      const kind = s.clipart?.kind || (s.image ? 'book' : 'bolt');
      const clip = window.Clipart ? `<div class="tile-clipart" aria-hidden="true">${window.Clipart.render(kind)}</div>` : '';
      return `
        <button type="button" class="channel-tile" data-index="${i}">
          <span class="tile-content">
            ${clip}
            <span class="tile-text">
              <span class="tile-title">${Utils.escapeHtml(title)}</span>
              ${subtitle ? `<span class="tile-sub">${Utils.escapeHtml(subtitle)}</span>` : ''}
              <span class="tile-cta">Learn more →</span>
            </span>
          </span>
        </button>`;
    }).join('');

    body.innerHTML = `
      <div class="channels-header">
        <div class="channels-brand">
          <img src="media/Oxford/logo.svg" alt="" aria-hidden="true" class="channels-logo" />
          <div class="channels-title">Channels</div>
        </div>
        <div class="channels-deck-pill">Innovation &amp; You</div>
      </div>
      <div class="channels-content">
        <div class="channels-grid">${tiles || '<p class="dos-library__intro">No channels available.</p>'}</div>
      </div>
    `;

    // Delegation, so tiles need no per-element ids or deferred wiring.
    Utils.on(body, 'click', '.channel-tile', (e) => {
      this.openSlidesDeck('innovation', Number(e.currentTarget.dataset.index) || 0);
    });
  }

  openSlidesDeck(deckName = 'innovation', index = 0) {
    if (!this.slidesWindow) this.slidesWindow = new SlidesWindow(this);
    return this.slidesWindow.open(deckName, index);
  }

  openIE(url) {
    if (this.ieManager) this.ieManager.open(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }

  getDeckSlides(deckName) {
    const deck = window.SlidesLibrary && window.SlidesLibrary[deckName];
    return Array.isArray(deck) ? deck : [];
  }
}

window.ChannelsManager = ChannelsManager;
window.SlidesWindow = SlidesWindow;
