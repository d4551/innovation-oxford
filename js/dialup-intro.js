// ============================================
// DIALUP INTRO MODULE
// Sign-in screen, then the AOL-style connection sequence, then the desktop.
//
// The sequence is time-boxed: whether or not the audio plays, whether or not it
// loads, the user always reaches the desktop. A stuck sound can never strand
// someone on the connection screen.
// ============================================

const MAX_DIALUP_MS = 9000;
const WAIT_AFTER_DIAL_MS = 1200;
const FADE_MS = 700;
// Absolute ceiling from "Sign In" to desktop, regardless of audio state.
const HARD_TIMEOUT_MS = 20000;

class DialupIntro {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.container = null;
    this.timers = [];
    this.finished = false;
    this.onDone = null;
  }

  schedule(fn, ms) {
    const id = setTimeout(fn, ms);
    this.timers.push(id);
    return id;
  }

  clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  showLoginScreen() {
    this.container = document.createElement('div');
    this.container.id = 'dialup-intro';
    this.container.className = 'dialup-intro';
    this.container.innerHTML = `
      <div class="window dialup-window" role="dialog" aria-modal="true" aria-labelledby="dialup-title">
        <div class="title-bar">
          <div class="title-bar-text"><span id="dialup-title">Welcome to Oxford Online</span></div>
        </div>
        <div class="window-body">
          <div class="logo-container">
            <img src="media/Oxford/logo.svg" alt="" aria-hidden="true" class="logo-img">
            <div class="logo-text">OXFORD<br><span class="logo-online">Online</span></div>
          </div>
          <form class="form-95 login-form" novalidate>
            <div class="row">
              <label for="oo-username">Screen Name</label>
              <input id="oo-username" class="input-95" type="text" autocomplete="username" required autocapitalize="none" spellcheck="false">
            </div>
            <div class="row">
              <label for="oo-password">Password</label>
              <input id="oo-password" class="input-95" type="password" autocomplete="current-password" required>
            </div>
            <p class="login-hint">Any name and password will do — this is a museum piece.</p>
            <div class="button-row">
              <button type="submit" class="btn-95 btn-connect">Sign In</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(this.container);

    this.container.querySelector('.login-form').addEventListener('submit', (e) => this.handleLoginSubmit(e));
    // Focus the first field so keyboard and screen-reader users start in place.
    requestAnimationFrame(() => this.container.querySelector('#oo-username')?.focus());
  }

  handleLoginSubmit(e) {
    e.preventDefault();
    const user = (document.getElementById('oo-username')?.value || '').trim();
    const pass = (document.getElementById('oo-password')?.value || '').trim();
    if (!user || !pass) {
      const missing = document.getElementById(user ? 'oo-password' : 'oo-username');
      missing?.focus();
      missing?.setAttribute('aria-invalid', 'true');
      return false;
    }

    try { sessionStorage.setItem('ooUser', user); } catch (_) {}

    // Audio must be created from inside the gesture for autoplay policies —
    // but a failure here must never stop the app from booting.
    try {
      if (this.audioManager && !this.audioManager.initialized) this.audioManager.init();
    } catch (err) {
      console.warn('DialupIntro: audio init failed, continuing without sound', err);
    }

    if (typeof this.onDone === 'function') {
      try { this.onDone(); } catch (err) { console.error('DialupIntro: app init failed', err); }
    }

    this.connect();
    return false;
  }

  connect() {
    this.container?.remove();

    this.container = document.createElement('div');
    this.container.id = 'dialup-intro';
    this.container.className = 'dialup-intro';
    this.container.innerHTML = `
      <div class="window dialup-window" role="dialog" aria-modal="true" aria-labelledby="dialup-connect-title">
        <div class="title-bar">
          <div class="title-bar-text"><span id="dialup-connect-title">Welcome to Oxford Online</span></div>
          <div class="title-bar-controls">
            <button type="button" class="title-bar-btn" data-act="skip" aria-label="Skip the connection sequence" title="Skip (Esc)">X</button>
          </div>
        </div>
        <div class="window-body">
          <div class="logo-container logo-container-large">
            <img src="media/Oxford/logo.svg" alt="" aria-hidden="true" class="logo-img logo-img-large">
            <div class="logo-text logo-text-large">OXFORD<br><span class="logo-online logo-online-large">Online</span></div>
          </div>
          <p class="status-message"><span id="dialup-status-text" role="status">Connecting To Oxford Online...</span></p>
          <div class="animation-boxes" aria-hidden="true">
            <div class="aol-box"><div class="box-emoji">🏃</div></div>
            <div class="aol-box"><div class="box-emoji">🏃💨</div></div>
            <div class="aol-box"><div class="box-emoji">👥</div></div>
          </div>
          <div class="progress-line" aria-hidden="true"></div>
          <button type="button" class="btn-95 btn-center" data-act="skip">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.container);

    Utils.on(this.container, 'click', '[data-act="skip"]', () => this.skip());
    this.container.querySelector('.btn-center')?.focus();
    this.startSequence();
  }

  startSequence() {
    const statusText = this.container.querySelector('#dialup-status-text');
    const boxes = Array.from(this.container.querySelectorAll('.aol-box'));

    const dialDuration = this.audioManager?.durationMs?.('dialup') || 0;
    const targetDialMs = dialDuration > 0 ? Math.min(dialDuration, MAX_DIALUP_MS) : MAX_DIALUP_MS;

    // Fill the three boxes proportionally across the dial-up sound.
    [0.11, 0.44, 0.77].forEach((pct, i) => {
      this.schedule(() => boxes[i]?.classList.add('filled'), Math.max(200 * (i + 1), Math.floor(targetDialMs * pct)));
    });

    const afterDial = () => {
      if (this.finished) return;
      if (statusText) statusText.textContent = 'Connected. Preparing welcome...';
      this.schedule(() => {
        if (statusText) statusText.textContent = 'Welcome!';
        this.audioManager.playWelcome(() => {
          this.audioManager.playGotMail(() => this.schedule(() => this.fadeOut(), 400));
        });
      }, WAIT_AFTER_DIAL_MS);
    };

    this.audioManager.playDialupWithCap(targetDialMs, afterDial);

    // Belt and braces: never leave anyone stuck on the connection screen.
    this.schedule(() => this.fadeOut(), HARD_TIMEOUT_MS);
  }

  fadeOut() {
    if (this.finished) return;
    this.finished = true;
    this.clearTimers();

    const reveal = () => {
      this.container?.remove();
      this.container = null;
      const desktop = document.querySelector('.desktop');
      if (desktop) {
        desktop.classList.remove('hidden');
        desktop.removeAttribute('aria-hidden');
        desktop.inert = false;
      }
      document.body.classList.add('is-signed-in');
      const taskbar = document.querySelector('.taskbar');
      if (taskbar) {
        taskbar.removeAttribute('aria-hidden');
        taskbar.inert = false;
      }
      // Move focus somewhere sensible now the dialog is gone.
      document.querySelector('.buddy-list .buddy-item:not([disabled])')?.focus();
    };

    if (!this.container || Utils.prefersReducedMotion()) { reveal(); return; }
    this.container.classList.add('fade-out');
    setTimeout(reveal, FADE_MS);
  }

  skip() {
    this.audioManager.stopAll();
    this.fadeOut();
  }

  reset() {
    try { sessionStorage.removeItem('ooUser'); } catch (_) {}
    this.finished = false;
  }
}

window.DialupIntro = DialupIntro;
