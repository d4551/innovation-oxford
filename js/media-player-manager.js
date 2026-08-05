// ============================================
// MEDIA PLAYER MANAGER
// A Windows-98-era media player for the site's audio and video clips.
// ============================================

const WMP_SEEK_STEP_S = 5;

class MediaPlayerManager extends AppWindow {
  constructor({ defaultAudio, windowTitle, fileRoot } = {}) {
    super({
      id: 'media-player',
      title: windowTitle || 'Oxford Media Player',
      className: 'media-player-window',
      iconClass: 'media-icon',
      width: 480,
      height: 380,
      controls: { minimize: true, maximize: true, close: true },
    });
    this.fileRoot = fileRoot || 'media/Oxford/';
    this.defaultAudio = this.resolveSource(defaultAudio || '#file:jingle.mp4');
    this.mediaEl = null;
    this.currentSource = null;
    this.currentType = 'audio';
    this.scrubbing = false;
    this.hasError = false;
    this.playlist = [];
    this.playlistName = '';
    // Audio visualiser
    this.audioCtx = null;
    this.analyser = null;
    this.analyserGain = null;
    this.mediaSourceNode = null;
    this.freqData = null;
    this.rafId = null;
  }

  openOxfordInnovation({ gesture } = {}) {
    return this.open({
      src: this.defaultAudio,
      title: 'OxfordInnovation.mp4',
      mediaType: 'video',
      autoplay: true,
      fromGesture: !!gesture,
    });
  }

  // AppWindow.open() forwards its arguments to onShow(); the request object
  // therefore travels the same path on first open and on re-open.
  onShow(request) {
    if (!request || !request.src) return;
    const src = this.resolveSource(request.src);
    this.loadSource({
      src,
      type: request.mediaType || this.detectMediaType(src),
      autoplay: request.autoplay !== false,
      titleOverride: request.title,
      fromGesture: !!request.fromGesture,
    });
  }

  renderBody(body) {
    body.classList.add('wmp-body');
    body.innerHTML = `
      <div class="wmp-chrome">
        <div class="wmp-screen" aria-label="Now playing display">
          <div class="wmp-visual" aria-hidden="true">
            <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
          </div>
          <div class="wmp-media-wrap"></div>
          <button type="button" class="btn-95 wmp-clickstart" hidden>Click to Play</button>
        </div>
        <div class="wmp-status-row">
          <span class="wmp-status-text" aria-live="polite">Ready</span>
          <span class="wmp-timer">00:00 / 00:00</span>
        </div>
        <div class="wmp-seek-row">
          <label class="visually-hidden" for="wmp-seek">Seek</label>
          <input id="wmp-seek" type="range" class="wmp-seek" min="0" max="0" value="0" step="1" />
        </div>
        <div class="wmp-controls" role="group" aria-label="Playback controls">
          <button type="button" class="btn-95 wmp-btn" data-act="rew" aria-label="Rewind 5 seconds">⏮</button>
          <button type="button" class="btn-95 wmp-btn" data-act="play" aria-label="Play" aria-pressed="false">▶</button>
          <button type="button" class="btn-95 wmp-btn" data-act="pause" aria-label="Pause" aria-pressed="false">⏸</button>
          <button type="button" class="btn-95 wmp-btn" data-act="stop" aria-label="Stop" aria-pressed="false">■</button>
          <button type="button" class="btn-95 wmp-btn" data-act="ff" aria-label="Forward 5 seconds">⏭</button>
          <div class="wmp-spacer"></div>
          <label class="wmp-vol-label" for="wmp-vol">Vol</label>
          <input id="wmp-vol" type="range" class="wmp-vol" min="0" max="1" step="0.01" value="1" aria-label="Volume" />
        </div>
        <div class="wmp-track-title" aria-live="polite">No media loaded</div>
        <div class="wmp-playlist" role="listbox" aria-label="Playlist"></div>
      </div>
    `;

    this.mediaContainer = this.$('.wmp-media-wrap');
    this.visualEl = this.$('.wmp-visual');
    this.visualBars = this.$$('.wmp-visual .bar');
    this.controlsEl = this.$('.wmp-controls');
    this.seekEl = this.$('.wmp-seek');
    this.volEl = this.$('.wmp-vol');
    this.playlistEl = this.$('.wmp-playlist');
    this.clickStartEl = this.$('.wmp-clickstart');
    this.statusEl = this.$('.wmp-status-text');
    this.timerEl = this.$('.wmp-timer');
    this.trackTitleEl = this.$('.wmp-track-title');

    Utils.on(this.controlsEl, 'click', '[data-act]', (e) => this.handleControl(e.currentTarget.dataset.act));
    Utils.on(this.playlistEl, 'click', '.pl-item', (e) => {
      const item = this.playlist[Number(e.currentTarget.dataset.idx)];
      if (item) this.open({ src: item.path, title: item.name, mediaType: item.type, autoplay: true, fromGesture: true });
    });

    this.clickStartEl.addEventListener('click', () => {
      if (this.mediaEl) this.mediaEl.play().then(() => this.hideClickToStart()).catch(() => {});
    });

    this.seekEl.addEventListener('input', () => {
      if (!this.mediaEl) return;
      this.scrubbing = true;
      const v = Number(this.seekEl.value || 0);
      if (Number.isFinite(this.mediaEl.duration) && this.mediaEl.duration > 0) {
        this.mediaEl.currentTime = Utils.clamp(v, 0, this.mediaEl.duration);
        this.updateTimerDisplay(true);
      }
    });
    this.seekEl.addEventListener('change', () => { this.scrubbing = false; });

    this.volEl.addEventListener('input', () => {
      if (!this.mediaEl) return;
      const vol = parseFloat(this.volEl.value);
      this.mediaEl.volume = Number.isNaN(vol) ? 1 : Utils.clamp(vol, 0, 1);
    });

    this.renderPlaylist();
  }

  loadSource({ src, type, autoplay, titleOverride, fromGesture }) {
    const tag = type === 'video' ? 'video' : 'audio';
    if (!this.mediaEl || this.mediaEl.tagName.toLowerCase() !== tag) this.swapMediaElement(tag);
    if (!this.mediaEl) return;

    this.hasError = false;
    this.currentSource = src;
    this.currentType = type;
    this.mediaEl.src = src;
    this.mediaEl.load();

    this.windowEl.classList.toggle('media-player--video', type === 'video');
    this.visualEl.classList.toggle('hidden', type !== 'audio');
    if (this.trackTitleEl) this.trackTitleEl.textContent = titleOverride || this.extractFileName(src);

    this.setStatus('Loading');
    this.updateTimerDisplay();

    const tryPlay = () => {
      if (!autoplay || !this.mediaEl || this.hasError) return;
      const p = this.mediaEl.play();
      if (p && typeof p.catch === 'function') {
        // A rejection here is usually just the autoplay policy — offer the
        // click-to-play button. But if the source itself failed, the error
        // handler has already said so and must not be overwritten.
        p.catch(() => {
          if (this.hasError) return;
          this.setStatus('Ready');
          this.showClickToStart();
        });
      }
    };

    if (autoplay && fromGesture) tryPlay();

    // "Ready" is only true while nothing is playing yet; metadata can arrive
    // after playback has already started when the open came from a gesture.
    const markReady = () => {
      if (!this.hasError && this.mediaEl && this.mediaEl.paused) this.setStatus('Ready');
    };

    if (this.mediaEl.readyState >= 2) {
      markReady();
      tryPlay();
    } else {
      this.mediaEl.addEventListener('loadedmetadata', () => {
        markReady();
        this.updateTimerDisplay(true);
        this.updateSeekUI(true);
        if (this.mediaEl && this.mediaEl.paused) tryPlay();
      }, { once: true });
    }
    // A source the browser cannot decode fires `error`, then `pause`. Without
    // this flag the pause handler overwrites the message and the user is left
    // looking at "Paused" wondering why nothing happens.
    this.mediaEl.addEventListener('error', () => {
      this.hasError = true;
      this.hideClickToStart();
      this.updateUIState('stopped');
      this.setStatus("This browser can't play this file");
    }, { once: true });
  }

  swapMediaElement(tagName) {
    this.teardownMedia();
    if (!this.mediaContainer) return;
    this.hasError = false;

    const el = document.createElement(tagName);
    el.className = `wmp-media wmp-media-${tagName}`;
    el.controls = false;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.addEventListener('play', () => { this.setStatus('Playing'); this.updateUIState('playing'); this.startVisualizer(); });
    el.addEventListener('pause', () => {
      if (el.ended || this.hasError) return;
      this.setStatus('Paused');
      this.updateUIState('paused');
      this.stopVisualizer(false);
    });
    el.addEventListener('ended', () => {
      this.setStatus('Stopped');
      this.updateUIState('stopped');
      this.updateTimerDisplay(true);
      this.stopVisualizer(true);
    });
    el.addEventListener('timeupdate', () => { this.updateTimerDisplay(); this.updateSeekUI(); });
    el.addEventListener('loadeddata', () => { this.updateTimerDisplay(true); this.updateSeekUI(true); });

    this.mediaContainer.innerHTML = '';
    this.mediaContainer.appendChild(el);
    this.mediaEl = el;
  }

  teardownMedia() {
    if (!this.mediaEl) return;
    try {
      this.mediaEl.pause();
      this.mediaEl.removeAttribute('src');
      this.mediaEl.load();
    } catch (_) {}
    this.mediaEl = null;
  }

  handleControl(action) {
    if (!this.mediaEl) return;
    const media = this.mediaEl;
    switch (action) {
      case 'play':
        media.play().catch(() => this.showClickToStart());
        this.hideClickToStart();
        break;
      case 'pause':
        media.pause();
        break;
      case 'stop':
        media.pause();
        media.currentTime = 0;
        this.setStatus('Stopped');
        this.updateUIState('stopped');
        this.updateTimerDisplay(true);
        break;
      case 'rew':
        media.currentTime = Math.max(0, media.currentTime - WMP_SEEK_STEP_S);
        this.flashControl('rew');
        break;
      case 'ff':
        media.currentTime = Number.isFinite(media.duration)
          ? Math.min(media.duration, media.currentTime + WMP_SEEK_STEP_S)
          : media.currentTime + WMP_SEEK_STEP_S;
        this.flashControl('ff');
        break;
      default:
        break;
    }
  }

  getBtn(act) { return this.controlsEl ? this.controlsEl.querySelector(`[data-act="${act}"]`) : null; }

  updateUIState(state) {
    if (!this.windowEl) return;
    this.windowEl.classList.remove('wmp-state-playing', 'wmp-state-paused', 'wmp-state-stopped');
    ['play', 'pause', 'stop'].forEach((a) => {
      const b = this.getBtn(a);
      if (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); }
    });
    const mark = (a) => {
      const b = this.getBtn(a);
      if (b) { b.classList.add('active'); b.setAttribute('aria-pressed', 'true'); }
    };

    if (state === 'playing') {
      this.windowEl.classList.add('wmp-state-playing');
      mark('play');
      this.setVisualActive(true);
      this.hideClickToStart();
    } else if (state === 'paused') {
      this.windowEl.classList.add('wmp-state-paused');
      mark('pause');
      this.setVisualActive(false);
    } else {
      this.windowEl.classList.add('wmp-state-stopped');
      mark('stop');
      this.setVisualActive(false);
      this.showClickToStart();
    }
  }

  showClickToStart() {
    if (this.clickStartEl && !this.hasError) this.clickStartEl.hidden = false;
  }
  hideClickToStart() { if (this.clickStartEl) this.clickStartEl.hidden = true; }

  flashControl(act) {
    const btn = this.getBtn(act);
    if (!btn) return;
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 150);
  }

  setVisualActive(active) {
    if (this.visualEl) this.visualEl.classList.toggle('wmp-visual--active', !!active);
  }

  // -------- audio visualiser --------
  ensureAnalyser() {
    if (!this.mediaEl || this.mediaEl.tagName.toLowerCase() !== 'audio') return;
    if (!this.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try { this.audioCtx = new Ctx(); } catch (_) { return; }
    }
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});

    try {
      if (!this.analyser) {
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        this.analyserGain = this.audioCtx.createGain();
        this.analyserGain.gain.value = 0; // silent branch: analysis only
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      }
      // createMediaElementSource may be called only once per element.
      if (this.mediaSourceNode?.mediaElement !== this.mediaEl) {
        try { this.mediaSourceNode?.disconnect(); } catch (_) {}
        this.mediaSourceNode = this.audioCtx.createMediaElementSource(this.mediaEl);
        this.mediaSourceNode.connect(this.analyser);
        this.mediaSourceNode.connect(this.audioCtx.destination);
        this.analyser.connect(this.analyserGain);
        this.analyserGain.connect(this.audioCtx.destination);
      }
    } catch (err) {
      console.warn('MediaPlayer: visualiser unavailable', err);
    }
  }

  startVisualizer() {
    if (!this.visualEl || !this.mediaEl || this.mediaEl.tagName.toLowerCase() !== 'audio') return;
    if (Utils.prefersReducedMotion()) return;
    this.ensureAnalyser();
    this.setVisualActive(true);

    const bars = this.visualBars || [];
    const loop = () => {
      if (!this.analyser || !this.freqData) return;
      this.analyser.getByteFrequencyData(this.freqData);
      const n = bars.length || 5;
      const seg = Math.floor(this.freqData.length / n) || 1;
      for (let i = 0; i < n; i++) {
        let sum = 0;
        const start = i * seg;
        const end = Math.min(this.freqData.length, start + seg);
        for (let j = start; j < end; j++) sum += this.freqData[j];
        const avg = sum / Math.max(1, end - start);
        if (bars[i]) bars[i].style.height = `${Utils.clamp(Math.round((avg / 255) * 64), 8, 64)}px`;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(loop);
  }

  stopVisualizer(resetBars) {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.setVisualActive(false);
    if (resetBars && this.visualBars) this.visualBars.forEach((b) => { b.style.height = '10px'; });
  }

  // -------- helpers --------
  detectMediaType(src) {
    const clean = (src || '').split('?')[0].split('#')[0];
    const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
    return ['mp4', 'webm', 'ogv', 'mov', 'm4v'].includes(ext) ? 'video' : 'audio';
  }

  extractFileName(src) {
    if (!src) return 'Unknown Media';
    const clean = src.split('?')[0].split('#')[0];
    return clean.substring(clean.lastIndexOf('/') + 1) || clean;
  }

  resolveSource(value) {
    if (!value) return value;
    if (value.startsWith('#file:')) {
      const fileName = value.slice(6).trim();
      return fileName ? `${this.fileRoot}${fileName}` : value;
    }
    return value;
  }

  setStatus(text) { if (this.statusEl) this.statusEl.textContent = text; }

  updateTimerDisplay(force) {
    if (!this.timerEl || !this.mediaEl) return;
    const current = this.mediaEl.currentTime || 0;
    const duration = Number.isFinite(this.mediaEl.duration) ? this.mediaEl.duration : 0;
    if (!force && !duration && !current) {
      this.timerEl.textContent = '00:00 / 00:00';
      return;
    }
    this.timerEl.textContent = `${this.formatTime(current)} / ${duration ? this.formatTime(duration) : '--:--'}`;
  }

  updateSeekUI(force) {
    if (!this.seekEl || !this.mediaEl) return;
    const duration = Number.isFinite(this.mediaEl.duration) ? Math.floor(this.mediaEl.duration) : 0;
    if (duration <= 0) {
      this.seekEl.max = '0';
      this.seekEl.value = '0';
      return;
    }
    this.seekEl.max = String(duration);
    if (this.scrubbing && !force) return;
    this.seekEl.value = String(Math.floor(this.mediaEl.currentTime || 0));
  }

  formatTime(value) {
    const total = Math.max(0, Math.floor(value));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  setPlaylist(name, items) {
    this.playlistName = name || '';
    this.playlist = Array.isArray(items) ? items.slice() : [];
    this.renderPlaylist();
  }

  renderPlaylist() {
    if (!this.playlistEl) return;
    this.playlistEl.innerHTML = this.playlist.map((it, idx) => {
      const file = Utils.escapeHtml(it.name || this.extractFileName(it.path));
      return `<div class="pl-item" role="option" tabindex="0" data-idx="${idx}" title="${file}">${file}</div>`;
    }).join('');
  }

  // Taskbar click with no window open should start the default clip.
  toggleFromTaskbar() {
    if (!this.windowEl) { this.openOxfordInnovation({ gesture: true }); return; }
    super.toggleFromTaskbar();
  }

  onHide() { if (this.mediaEl && !this.mediaEl.paused) this.mediaEl.pause(); }

  onClose() {
    this.stopVisualizer(true);
    this.teardownMedia();
    try { this.mediaSourceNode?.disconnect(); } catch (_) {}
    try { this.audioCtx?.close(); } catch (_) {}
    this.mediaSourceNode = null;
    this.analyser = null;
    this.audioCtx = null;
  }
}

window.MediaPlayerManager = MediaPlayerManager;
