// ============================================
// OXFORD CHANNELS (FAKE AOL CHANNELS)
// Win95-style window with a scrollable grid of channel tiles
// ============================================

class ChannelsManager {
  constructor({ ieManager } = {}) {
    this.windowEl = null;
    this.bodyEl = null;
    this.taskbarId = 'channels';
    this.taskbarEntry = null;
    this.ieManager = ieManager || null;
  }

  open() {
    if (this.windowEl) {
      this.windowEl.style.display = 'block';
      this.activate();
      return this.windowEl;
    }

    const shell = windowManager.createWindowShell({
      title: 'Oxford Channels',
      className: 'channels-window',
      width: '760px',
      height: '560px',
      top: '70px',
      left: '120px',
      controls: { minimize: true, maximize: true, close: true }
    });
    const win = shell.windowEl;
    const titleBar = shell.titleBar;
    const body = shell.body;
    this.windowEl = win;
    this.bodyEl = body;

    body.style.display = 'flex';
    body.style.flexDirection = 'column';

    const header = document.createElement('div');
    header.className = 'channels-header';
    header.innerHTML = `
      <div class="channels-brand">
        <img src="media/Oxford/logo.svg" alt="Oxford" class="channels-logo"/>
        <div class="channels-title">Channels</div>
      </div>
      <div class="channels-deck-pill">Innovation &amp; You</div>
    `;

    const content = document.createElement('div');
    content.className = 'channels-content';

    // Build tiles from all slides in the 'innovation' deck
  const slides = this.getDeckSlides('innovation');
    const tilesHtml = slides.map((s, i) => {
      const title = s.title || `Slide ${i + 1}`;
      const subtitle = s.subtitle || '';
      const kind = (s.clipart && s.clipart.kind) ? s.clipart.kind : (s.image ? 'book' : 'bolt');
      return this.renderTile(title, subtitle, () => this.openSlidesDeck('innovation', i), kind);
    }).join('');

    content.innerHTML = `
      <div class="channels-grid">
        ${tilesHtml}
      </div>
    `;

    body.appendChild(header);
    body.appendChild(content);

    // Title bar controls
    const [minBtn, maxBtn, closeBtn] = titleBar.querySelectorAll('.title-bar-btn');
    minBtn.addEventListener('click', () => this.minimize());
    maxBtn.addEventListener('click', () => this.toggleMaximize());
    closeBtn.addEventListener('click', () => this.close());

    // Activate on focus
    win.addEventListener('mousedown', () => this.activate());

    // Taskbar entry
    if (window.taskbarManager) {
      this.taskbarEntry = window.taskbarManager.addWindow(this.taskbarId, 'Oxford Channels', {
        onToggle: () => this.toggleFromTaskbar(),
        iconClass: 'channels-icon'
      });
    }

    this.activate();
    return win;
  }

  renderTile(title, subtitle, onClick, clipartKind) {
    const id = `tile-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g,'')}`;
    // Return markup; click is delegated after insertion
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', onClick);
    }, 0);
    const clip = (window.Clipart && clipartKind) ? `<div class="tile-clipart">${window.Clipart.render(clipartKind)}</div>` : '';
    // Limit subtitle to one line for clarity
    const subDisplay = subtitle ? subtitle.split('\n')[0].substring(0, 60) : '';
    return `
      <div class="channel-tile" id="${id}">
        <div class="tile-content">
          ${clip}
          <div class="tile-text">
            <div class="tile-title">${this.escapeHtml(title)}</div>
            ${subDisplay ? `<div class="tile-sub">${this.escapeHtml(subDisplay)}</div>` : ''}
            <div class="tile-cta">Learn more →</div>
          </div>
        </div>
      </div>
    `;
  }

  openMiniWindow({ title, bodyHtml, url }) {
    if (!this.bodyEl) return;
    const container = this.bodyEl.querySelector('.channels-content');
    if (!container) return;

    const mini = document.createElement('div');
    mini.className = 'window mini-window';
    mini.style.width = '460px';
    mini.style.height = '340px';
    mini.style.left = (20 + Math.floor(Math.random() * 60)) + 'px';
    mini.style.top = (20 + Math.floor(Math.random() * 40)) + 'px';
    mini.style.position = 'absolute';
    mini.style.zIndex = '5';

    const titleBar = document.createElement('div');
    titleBar.className = 'title-bar';
    titleBar.innerHTML = `
      <div class="title-bar-text"><div class="title-bar-icon"></div> ${this.escapeHtml(title)}</div>
      <div class="title-bar-controls">
        <button class="title-bar-btn" data-act="min">_</button>
        <button class="title-bar-btn" data-act="max">□</button>
        <button class="title-bar-btn" data-act="close">X</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'window-body';
    body.style.height = 'calc(100% - 24px)';
    body.style.boxSizing = 'border-box';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';

    const content = document.createElement('div');
    content.className = 'mini-content';
    content.style.flex = '1';
    content.style.minHeight = '0';
    content.style.overflow = 'auto';
    content.style.background = '#ffffff';
    content.style.border = '2px solid #808080';
    content.style.padding = '8px';
    content.innerHTML = bodyHtml || '';

    const actions = document.createElement('div');
    actions.className = 'mini-actions';
    actions.style.padding = '6px 0 0 0';
    actions.innerHTML = `<button class="btn-95" data-open-ie>Open in Internet Explorer</button>`;

    body.appendChild(content);
    body.appendChild(actions);
    mini.appendChild(titleBar);
    mini.appendChild(body);
    container.appendChild(mini);

    // Dragging
    try { windowManager.makeWindowDraggable(mini, titleBar); } catch (e) {}

    // Controls
    // Robust control binding
    const minBtn = titleBar.querySelector('[data-act="min"]');
    const maxBtn = titleBar.querySelector('[data-act="max"]');
    const closeBtn = titleBar.querySelector('[data-act="close"]');
    if (minBtn) minBtn.addEventListener('click', (e) => { e.stopPropagation(); mini.style.display = 'none'; });
    if (maxBtn) maxBtn.addEventListener('click', (e) => { e.stopPropagation(); mini.style.zIndex = '10'; });
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); mini.remove(); });

    // Open in IE
    actions.querySelector('[data-open-ie]').addEventListener('click', () => {
      if (url) this.openIE(url);
    });

    // Focus on mousedown
    mini.addEventListener('mousedown', () => { mini.style.zIndex = '10'; });
  }

  escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  // ---------------- Slides Deck ----------------
  openSlidesDeck(deckName, initialIndex = 0) {
    // Build a slides window using shell
    const shell = windowManager.createWindowShell({
      title: 'Innovation & You: A Survival Guide',
      className: 'slides-window',
      width: '820px', height: '600px', top: '60px', left: '90px',
      controls: { minimize: true, maximize: true, close: true }
    });
    const win = shell.windowEl; const body = shell.body; const titleBar = shell.titleBar;
    body.classList.add('slides-body');
    const slides = this.getDeckSlides(deckName);
    const totalSlides = slides.length;
    body.innerHTML = `
      <div class="slides-header">
        <div class="slides-brand">
          <img src="media/Oxford/logo.svg" class="slides-logo" alt="Oxford"/>
          <div class="slides-title">Innovation & You</div>
        </div>
        <div class="slides-actions">
          <button class="btn-95" data-act="prev">◀ Prev</button>
          <span class="slides-count">${totalSlides ? '1' : '0'} / ${totalSlides}</span>
          <button class="btn-95" data-act="next">Next ▶</button>
        </div>
      </div>
      <div class="slides-view"></div>
    `;
    const view = body.querySelector('.slides-view');
    let index = Math.min(Math.max(parseInt(initialIndex, 10) || 0, 0), Math.max(totalSlides - 1, 0));
    const render = () => {
      if (!totalSlides) {
        view.innerHTML = `
          <div class="slide empty-slide">
            <div class="slide-title">No slides available</div>
            <div class="slide-text"><p>Check back soon for new content.</p></div>
          </div>
        `;
        body.querySelector('.slides-count').textContent = '0 / 0';
        return;
      }
      const s = slides[index] || {};
      const clip = s.clipart ? (window.Clipart ? window.Clipart.render(s.clipart.kind) : '') : '';
      const img = s.image ? `<div class="slide-image"><img class="retro-asset" src="${s.image}" width="360" loading="lazy" decoding="async" alt=""/></div>` : '';
      const paras = (s.paragraphs || []).map(p => `<p>${this.escapeHtml(p)}</p>`).join('');
      const mediaLinks = Array.isArray(s.mediaLinks) ? s.mediaLinks : (s.mediaFile ? [{ label: s.mediaFile, path: s.mediaFile, type: 'video' }] : []);
      const mediaHtml = mediaLinks.length ? `
        <div class="slide-media-links">
          ${mediaLinks.map(link => {
            const label = link && (link.label || link.file || link.path) ? link.label || link.file || link.path : 'Play Clip';
            const srcValue = link && (link.path || link.file) ? (link.path || link.file) : '';
            const mediaType = link && link.type ? link.type : 'video';
            return `<button class="btn-95 media-play-btn" data-src="${this.escapeHtml(srcValue)}" data-title="${this.escapeHtml(label)}" data-type="${this.escapeHtml(mediaType)}">${this.escapeHtml(label)}</button>`;
          }).join('')}
        </div>
      ` : '';
      
      view.innerHTML = `
        <div class="slide">
          <div class="slide-title">${this.escapeHtml(s.title)}</div>
          ${s.subtitle ? `<div class=\"slide-subtitle\">${this.escapeHtml(s.subtitle)}</div>` : ''}
          ${clip}
          ${img}
          <div class="slide-text">${paras}</div>
          ${mediaHtml}
        </div>
      `;

      // Wire media buttons to the media player (same flow as folder double-click)
      view.querySelectorAll('.media-play-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!window.mediaPlayerManager) return;
          let src = btn.getAttribute('data-src') || '';
          if (!src) return;
          const title = btn.getAttribute('data-title') || src;
          const mediaType = btn.getAttribute('data-type') || 'video';
          if (!src.startsWith('#file:') && !/^https?:/i.test(src) && !src.startsWith('media/') && !src.startsWith('/')) {
            src = `#file:${src}`;
          }
          window.mediaPlayerManager.open({ src, title, mediaType, autoplay: true, fromGesture: true });
        });
      });

      // Optional Exhibit toggle images (e.g., Slide 6 Virtual Boy)
      if (s.imageToggle) {
        const paragraphs = Array.from(view.querySelectorAll('.slide-text p'));
        const exhibitPara = paragraphs.find(p => /exhibit\s*a/i.test(p.textContent || ''));
        if (exhibitPara) {
          const toggleWrap = document.createElement('div');
          toggleWrap.className = 'slide-toggle-block';
          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'btn-95 slide-toggle-btn';
          const showLabel = s.imageToggle.label || 'Show Exhibit Image';
          const hideLabel = s.imageToggle.hideLabel || 'Hide Exhibit Image';
          toggleBtn.textContent = showLabel;

          const imageWrap = document.createElement('div');
          imageWrap.className = 'slide-toggle-image';
          imageWrap.style.display = 'none';
          const imgEl = document.createElement('img');
          imgEl.src = s.imageToggle.src || '';
          imgEl.className = 'retro-asset';
          imgEl.setAttribute('width', '360');
          imgEl.loading = 'lazy';
          imgEl.decoding = 'async';
          imgEl.alt = s.imageToggle.alt || showLabel;
          imageWrap.appendChild(imgEl);

          toggleBtn.addEventListener('click', () => {
            const isHidden = imageWrap.style.display === 'none';
            imageWrap.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? hideLabel : showLabel;
          });

          toggleWrap.appendChild(toggleBtn);
          toggleWrap.appendChild(imageWrap);
          exhibitPara.parentNode.insertBefore(toggleWrap, exhibitPara.nextSibling);
        }
      }
      
      body.querySelector('.slides-count').textContent = `${index + 1} / ${totalSlides}`;
    };
    const prev = () => {
      if (!totalSlides) return;
      index = (index - 1 + totalSlides) % totalSlides;
      render();
    };
    const next = () => {
      if (!totalSlides) return;
      index = (index + 1) % totalSlides;
      render();
    };
    body.querySelector('[data-act="prev"]').addEventListener('click', prev);
    body.querySelector('[data-act="next"]').addEventListener('click', next);
    titleBar.addEventListener('dblclick', next);
    win.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); });
    
    // Close button
    const closeBtn = titleBar.querySelector('.title-bar-btn[class*="close"]') || titleBar.querySelectorAll('.title-bar-btn')[2];
    if (closeBtn) closeBtn.addEventListener('click', () => windowManager.closeWindow(win));
    
    // Focus for keyboard navigation
    win.setAttribute('tabindex', '0'); win.focus();
    render();
  }

  openIE(url) {
    if (this.ieManager) {
      this.ieManager.open(url);
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  getDeckSlides(deckName) {
    const library = window.SlidesLibrary;
    const deck = library && library[deckName];
    return Array.isArray(deck) ? deck : [];
  }

  minimize() { if (this.windowEl) { this.windowEl.style.display = 'none'; if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, false); } }
  toggleMaximize() {
    if (!this.windowEl) return;
    const win = this.windowEl;
    const isMax = win.dataset.maximized === '1';
    if (isMax) {
      win.style.top = win.dataset.prevTop || '70px';
      win.style.left = win.dataset.prevLeft || '120px';
      win.style.width = win.dataset.prevWidth || '760px';
      win.style.height = win.dataset.prevHeight || '560px';
      win.dataset.maximized = '0';
    } else {
      win.dataset.prevTop = win.style.top;
      win.dataset.prevLeft = win.style.left;
      win.dataset.prevWidth = win.style.width;
      win.dataset.prevHeight = win.style.height;
      win.style.top = '0px';
      win.style.left = '0px';
      win.style.width = `${window.innerWidth - 4}px`;
      win.style.height = `${window.innerHeight - 28 - 4}px`;
      win.dataset.maximized = '1';
    }
  }
  toggleFromTaskbar() {
    if (!this.windowEl) { this.open(); return; }
    const hidden = this.windowEl.style.display === 'none';
    if (hidden) { this.windowEl.style.display = 'block'; this.activate(); } else { this.minimize(); }
  }
  activate() { if (!this.windowEl) return; this.windowEl.style.zIndex = ++windowManager.zIndexCounter; if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, true); }
  close() { if (!this.windowEl) return; windowManager.closeWindow(this.windowEl); this.windowEl = null; this.bodyEl = null; if (window.taskbarManager) window.taskbarManager.remove(this.taskbarId); }
}

// Global instance created in main.js
