// ============================================
// MEDIA PLAYER MANAGER
// Simulates a Windows 98 era media player for audio and video clips
// ============================================

class MediaPlayerManager {
  constructor({ defaultAudio, windowTitle, fileRoot } = {}) {
    this.fileRoot = fileRoot || 'media/Oxford/';
    this.defaultAudio = this.resolveSource(defaultAudio || '#file:jingle.mp4');
    this.windowTitle = windowTitle || 'Oxford Media Player';
    this.windowEl = null;
    this.bodyEl = null;
    this.mediaContainer = null;
    this.statusEl = null;
    this.timerEl = null;
    this.trackTitleEl = null;
    this.mediaEl = null;
    this.taskbarEntry = null;
    this.taskbarId = 'media-player';
    this.currentSource = null;
    this.currentType = 'audio';
    this.scrubbing = false;
    this.playlist = [];
    this.playlistName = '';
    this.playlistEl = null;
    // Audio visualization
    this.audioCtx = null;
    this.analyser = null;
    this.analyserGain = null;
    this.mediaSourceNode = null;
    this.freqData = null;
    this.rafId = null;
    this.visualBars = null;
  }

  openOxfordInnovation({ gesture } = {}) {
    this.open({
      src: this.defaultAudio,
      title: 'OxfordInnovation.mp4',
      mediaType: 'video',
      autoplay: true,
      fromGesture: !!gesture
    });
  }

  open({ src, title, mediaType, autoplay = true, fromGesture = false } = {}) {
    if (!src) return;
    const resolvedSrc = this.resolveSource(src);
    const type = mediaType || this.detectMediaType(resolvedSrc);
    if (!this.windowEl) {
      this.createWindow();
    }
    this.showWindow();
    this.loadSource({ src: resolvedSrc, type, autoplay, titleOverride: title, fromGesture });
  }

  createWindow() {
    const shell = windowManager.createWindowShell({
      title: this.windowTitle,
      className: 'media-player-window',
      width: '420px',
      height: '340px',
      top: '140px',
      left: '140px',
      controls: { minimize: true, maximize: false, close: true }
    });

    this.windowEl = shell.windowEl;
    this.bodyEl = shell.body;
    this.windowEl.dataset.maximized = '0';

    this.bodyEl.classList.add('wmp-body');
    this.bodyEl.innerHTML = `
      <div class="wmp-chrome">
        <div class="wmp-screen" aria-live="polite" aria-label="Now playing display">
          <div class="wmp-visual" aria-hidden="true">
            <div class="bar b1"></div>
            <div class="bar b2"></div>
            <div class="bar b3"></div>
            <div class="bar b4"></div>
            <div class="bar b5"></div>
          </div>
          <div class="wmp-media-wrap"></div>
          <button type="button" class="btn-95 wmp-clickstart" aria-label="Click to play" hidden>Click to Play</button>
        </div>
        <div class="wmp-status-row">
          <span class="wmp-status-text">Ready</span>
          <span class="wmp-timer">00:00 / 00:00</span>
        </div>
        <div class="wmp-seek-row">
          <input type="range" class="wmp-seek" min="0" max="0" value="0" step="1" aria-label="Seek" />
        </div>
        <div class="wmp-controls" role="group" aria-label="Playback controls">
          <button type="button" class="btn-95 wmp-btn" data-act="rew" aria-label="Rewind">⏮</button>
          <button type="button" class="btn-95 wmp-btn" data-act="play" aria-label="Play">▶</button>
          <button type="button" class="btn-95 wmp-btn" data-act="pause" aria-label="Pause">⏸</button>
          <button type="button" class="btn-95 wmp-btn" data-act="stop" aria-label="Stop">■</button>
          <button type="button" class="btn-95 wmp-btn" data-act="ff" aria-label="Fast forward">⏭</button>
          <div class="wmp-spacer"></div>
          <label class="wmp-vol-label" for="wmp-vol">Vol</label>
          <input id="wmp-vol" type="range" class="wmp-vol" min="0" max="1" step="0.01" value="1" aria-label="Volume" />
        </div>
        <div class="wmp-track-title" aria-live="polite">No media loaded</div>
        <div class="wmp-playlist" role="listbox" aria-label="Playlist"></div>
      </div>
    `;

    this.mediaContainer = this.bodyEl.querySelector('.wmp-media-wrap');
    this.visualEl = this.bodyEl.querySelector('.wmp-visual');
    this.visualBars = Array.from(this.visualEl.querySelectorAll('.bar'));
    this.controlsEl = this.bodyEl.querySelector('.wmp-controls');
    this.seekEl = this.bodyEl.querySelector('.wmp-seek');
    this.volEl = this.bodyEl.querySelector('.wmp-vol');
    this.playlistEl = this.bodyEl.querySelector('.wmp-playlist');
    this.clickStartEl = this.bodyEl.querySelector('.wmp-clickstart');
    this.statusEl = this.bodyEl.querySelector('.wmp-status-text');
    this.timerEl = this.bodyEl.querySelector('.wmp-timer');
    this.trackTitleEl = this.bodyEl.querySelector('.wmp-track-title');

    const controls = this.controlsEl;
    controls.addEventListener('click', (evt) => {
      const btn = evt.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      this.handleControl(act);
    });

    // Wire title bar controls robustly (maximize may be absent)
    const minBtn = this.windowEl.querySelector('.title-bar-btn[data-action="min"]');
    const closeBtn = this.windowEl.querySelector('.title-bar-btn[data-action="close"]');
    if (minBtn) minBtn.addEventListener('click', () => this.minimize());
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    this.windowEl.addEventListener('mousedown', () => this.activate());

    if (window.taskbarManager) {
      this.taskbarEntry = window.taskbarManager.addWindow(this.taskbarId, this.windowTitle, {
        onToggle: () => this.toggleFromTaskbar(),
        iconClass: 'media-icon'
      });
    }

    // Seek/Volume wiring
    if (this.seekEl) {
      this.seekEl.addEventListener('input', () => {
        if (!this.mediaEl) return;
        this.scrubbing = true;
        const v = Number(this.seekEl.value || 0);
        if (isFinite(this.mediaEl.duration) && this.mediaEl.duration > 0) {
          this.mediaEl.currentTime = Math.max(0, Math.min(this.mediaEl.duration, v));
          this.updateTimerDisplay(true);
        }
      });
      this.seekEl.addEventListener('change', () => { this.scrubbing = false; });
    }
    if (this.volEl) {
      this.volEl.addEventListener('input', () => {
        if (!this.mediaEl) return;
        const vol = parseFloat(this.volEl.value);
        this.mediaEl.volume = isNaN(vol) ? 1 : Math.max(0, Math.min(1, vol));
      });
    }
  }

  showWindow() {
    if (!this.windowEl) return;
    this.windowEl.style.display = 'block';
    this.activate();
  }

  loadSource({ src, type, autoplay, titleOverride, fromGesture }) {
    const tag = type === 'video' ? 'video' : 'audio';
    if (!this.mediaEl || this.mediaEl.tagName.toLowerCase() !== tag) {
      this.swapMediaElement(tag);
    }

    if (!this.mediaEl) return;

    this.currentSource = src;
    this.currentType = type;
    this.mediaEl.src = src;
    this.mediaEl.load();
    try {
      this.mediaEl.currentTime = 0;
    } catch (e) {}

    this.windowEl.classList.toggle('media-player--video', type === 'video');
    this.updateVisualVisibility(type);
    if (this.trackTitleEl) {
      const titleText = titleOverride || this.extractFileName(src);
      this.trackTitleEl.textContent = titleText;
    }

    this.setStatus('Loading');
    this.updateTimerDisplay();

    const tryPlay = () => {
      if (!autoplay) return;
      const maybePromise = this.mediaEl.play();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {
          this.setStatus('Ready');
          this.showClickToStart();
        });
      }
    };

    // Try immediate play if opened from a user gesture
    if (autoplay && fromGesture) {
      tryPlay();
    }

    if (this.mediaEl.readyState >= 2) {
      this.setStatus('Ready');
      tryPlay();
    } else {
      this.mediaEl.addEventListener('loadedmetadata', () => {
        this.setStatus('Ready');
        this.updateTimerDisplay(true);
        if (this.mediaEl.paused) tryPlay();
      }, { once: true });
    }
  }

  swapMediaElement(tagName) {
    if (this.mediaEl) {
      this.teardownMedia();
    }
    if (!this.mediaContainer) return;
  const el = document.createElement(tagName);
  const isVideo = tagName === 'video';
  el.className = `wmp-media ${isVideo ? 'wmp-media-video' : 'wmp-media-audio'}`;
    // Disable native controls to avoid duplicate UI
    el.controls = false;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.addEventListener('play', () => { this.setStatus('Playing'); this.updateUIState('playing'); this.startVisualizer(); });
    el.addEventListener('pause', () => {
      if (el.ended) return;
      this.setStatus('Paused');
      this.updateUIState('paused');
      this.stopVisualizer(false);
    });
    el.addEventListener('ended', () => { this.setStatus('Stopped'); this.updateUIState('stopped'); this.updateTimerDisplay(true); this.stopVisualizer(true); });
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
    } catch (e) {}
    this.mediaEl = null;
  }

  handleControl(action) {
    if (!this.mediaEl) return;
    switch (action) {
      case 'play':
        this.mediaEl.play().catch(() => {});
        this.updateUIState('playing');
        this.hideClickToStart();
        break;
      case 'pause':
        this.mediaEl.pause();
        this.updateUIState('paused');
        break;
      case 'stop':
        this.mediaEl.pause();
        this.mediaEl.currentTime = 0;
        this.setStatus('Stopped');
        this.updateUIState('stopped');
        this.updateTimerDisplay(true);
        this.showClickToStart();
        break;
      case 'rew':
        this.mediaEl.currentTime = Math.max(0, this.mediaEl.currentTime - 5);
        this.flashControl('rew');
        break;
      case 'ff':
        if (isFinite(this.mediaEl.duration)) {
          this.mediaEl.currentTime = Math.min(this.mediaEl.duration, this.mediaEl.currentTime + 5);
        } else {
          this.mediaEl.currentTime += 5;
        }
        this.flashControl('ff');
        break;
      default:
        break;
    }
  }

  getBtn(act) {
    if (!this.controlsEl) return null;
    return this.controlsEl.querySelector(`[data-act="${act}"]`);
  }

  updateUIState(state) {
    if (!this.windowEl) return;
    this.windowEl.classList.remove('wmp-state-playing', 'wmp-state-paused', 'wmp-state-stopped');
    const playBtn = this.getBtn('play');
    const pauseBtn = this.getBtn('pause');
    const stopBtn = this.getBtn('stop');
    [playBtn, pauseBtn, stopBtn].forEach(b => { if (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); } });
    switch (state) {
      case 'playing':
        this.windowEl.classList.add('wmp-state-playing');
        if (playBtn) { playBtn.classList.add('active'); playBtn.setAttribute('aria-pressed', 'true'); }
        this.setVisualActive(true);
        this.hideClickToStart();
        break;
      case 'paused':
        this.windowEl.classList.add('wmp-state-paused');
        if (pauseBtn) { pauseBtn.classList.add('active'); pauseBtn.setAttribute('aria-pressed', 'true'); }
        this.setVisualActive(false);
        break;
      default:
        this.windowEl.classList.add('wmp-state-stopped');
        if (stopBtn) { stopBtn.classList.add('active'); stopBtn.setAttribute('aria-pressed', 'true'); }
        this.setVisualActive(false);
        this.showClickToStart();
        break;
    }
  }

  showClickToStart() {
    if (!this.clickStartEl) return;
    this.clickStartEl.hidden = false;
    if (!this._boundClickStart) {
      this._boundClickStart = () => {
        if (!this.mediaEl) return;
        this.mediaEl.play().then(() => this.hideClickToStart()).catch(() => {});
      };
      this.clickStartEl.addEventListener('click', this._boundClickStart);
    }
  }
  hideClickToStart() { if (this.clickStartEl) this.clickStartEl.hidden = true; }

  flashControl(act) {
    const btn = this.getBtn(act);
    if (!btn) return;
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 150);
  }

  updateVisualVisibility(type) {
    if (!this.visualEl) return;
    const show = (type === 'audio');
    this.visualEl.classList.toggle('hidden', !show);
  }

  setVisualActive(active) {
    if (!this.visualEl) return;
    this.visualEl.classList.toggle('wmp-visual--active', !!active);
  }

  // -------- Audio visualizer (reactive) --------
  ensureAnalyser() {
    if (!this.mediaEl || this.mediaEl.tagName.toLowerCase() !== 'audio') return;
    if (!this.audioCtx) {
      try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    try {
      if (!this.analyser) {
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        this.analyserGain = this.audioCtx.createGain();
        this.analyserGain.gain.value = 0.0; // mute this branch
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      }
      if (this.mediaSourceNode) {
        try { this.mediaSourceNode.disconnect(); } catch(e) {}
      }
      this.mediaSourceNode = this.audioCtx.createMediaElementSource(this.mediaEl);
      this.mediaSourceNode.connect(this.analyser);
      this.analyser.connect(this.analyserGain);
      this.analyserGain.connect(this.audioCtx.destination);
    } catch (e) { /* ignore */ }
  }

  startVisualizer() {
    if (!this.visualEl || !this.mediaEl || this.mediaEl.tagName.toLowerCase() !== 'audio') return;
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
        const s = i * seg;
        const e = Math.min(this.freqData.length, s + seg);
        for (let j = s; j < e; j++) sum += this.freqData[j];
        const avg = sum / (e - s);
        const h = Math.max(8, Math.min(64, Math.round((avg / 255) * 64)));
        if (bars[i]) bars[i].style.height = h + 'px';
      }
      this.rafId = requestAnimationFrame(loop);
    };
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(loop);
  }

  stopVisualizer(resetBars) {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.setVisualActive(false);
    if (resetBars && this.visualBars) this.visualBars.forEach(b => b.style.height = '10px');
  }

  minimize() {
    if (!this.windowEl) return;
    this.windowEl.style.display = 'none';
    if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, false);
  }

  close() {
    if (!this.windowEl) return;
    if (this.mediaEl) {
      try { this.mediaEl.pause(); } catch (e) {}
    }
    if (window.taskbarManager) window.taskbarManager.remove(this.taskbarId);
    windowManager.closeWindow(this.windowEl);
    this.windowEl = null;
    this.bodyEl = null;
    this.mediaContainer = null;
    this.statusEl = null;
    this.timerEl = null;
    this.trackTitleEl = null;
    this.mediaEl = null;
    this.taskbarEntry = null;
  }

  toggleFromTaskbar() {
    if (!this.windowEl) {
      // Opening from a user click in the taskbar; allow immediate play
      this.openOxfordInnovation({ gesture: true });
      return;
    }
    const hidden = this.windowEl.style.display === 'none';
    if (hidden) this.showWindow(); else this.minimize();
  }

  activate() {
    if (!this.windowEl) return;
    this.windowEl.style.zIndex = ++windowManager.zIndexCounter;
    if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, true);
  }

  detectMediaType(src) {
    const match = (src || '').split('?')[0].split('#')[0];
    const ext = match.slice(match.lastIndexOf('.') + 1).toLowerCase();
    if (['mp4', 'webm', 'ogv', 'mov'].includes(ext)) return 'video';
    return 'audio';
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
      if (!fileName) return value;
      return `${this.fileRoot}${fileName}`;
    }
    return value;
  }

  setStatus(text) {
    if (this.statusEl) {
      this.statusEl.textContent = text;
    }
  }

  updateTimerDisplay(force) {
    if (!this.timerEl || !this.mediaEl) return;
    const current = this.mediaEl.currentTime || 0;
    const duration = isFinite(this.mediaEl.duration) ? this.mediaEl.duration : 0;
    if (!force && !duration && !current) {
      this.timerEl.textContent = '00:00 / 00:00';
      return;
    }
    const currentText = this.formatTime(current);
    const durationText = duration ? this.formatTime(duration) : '--:--';
    this.timerEl.textContent = `${currentText} / ${durationText}`;
  }

  updateSeekUI(force) {
    if (!this.seekEl || !this.mediaEl) return;
    const duration = isFinite(this.mediaEl.duration) ? Math.floor(this.mediaEl.duration) : 0;
    if (duration <= 0) {
      this.seekEl.max = 0; this.seekEl.value = 0; return;
    }
    this.seekEl.max = String(duration);
    if (this.scrubbing && !force) return;
    this.seekEl.value = String(Math.floor(this.mediaEl.currentTime || 0));
  }

  // Playlist API (optional)
  setPlaylist(name, items) {
    this.playlistName = name || '';
    this.playlist = Array.isArray(items) ? items.slice() : [];
    this.renderPlaylist();
  }

  renderPlaylist() {
    if (!this.playlistEl) return;
    if (!this.playlist || !this.playlist.length) {
      this.playlistEl.innerHTML = '';
      return;
    }
    this.playlistEl.innerHTML = this.playlist.map((it, idx) => {
      const file = this.escape(it.name || this.extractFileName(it.path));
      return `<div class="pl-item" role="option" data-idx="${idx}" title="${file}">${file}</div>`;
    }).join('');
    this.playlistEl.querySelectorAll('.pl-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-idx'));
        const it = this.playlist[idx];
        if (it) this.open({ src: it.path, title: it.name, mediaType: it.type, autoplay: true });
      });
    });
  }

  escape(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  formatTime(value) {
    const total = Math.max(0, Math.floor(value));
    const minutes = Math.floor(total / 60).toString().padStart(2, '0');
    const seconds = (total % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
}

// Global instance placeholder
let mediaPlayerManager = null;
