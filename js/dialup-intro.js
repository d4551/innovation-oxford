// ============================================
// DIALUP INTRO MODULE
// Sign-in screen, then the AOL-style connection sequence, then the desktop.
//
// The sequence is time-boxed: whether or not the audio plays, whether or not it
// loads, the user always reaches the desktop. A stuck sound can never strand
// someone on the connection screen.
// ============================================

// The three figures of the connection sequence, drawn rather than typed.
//
// These were emoji (🏃 / 🏃💨 / 👥). The app's font stack is a Windows 95
// one — MS Sans Serif and friends — with nothing behind it that carries
// colour emoji, so on any machine without a system emoji font the centre of
// the sign-on screen rendered as three empty boxes. Inline SVG has no font to
// miss and no file to fetch, and matches how the rest of the app draws its
// clipart.
const DIAL_FIGURES = [
  // Dialling: someone running for the phone.
  `<svg viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
     <circle cx="38" cy="12" r="7"/>
     <path d="M34 21 L44 26 L40 38 L46 52 L40 55 L33 41 L26 47 L20 44 L27 33 L24 24 Z"/>
     <path d="M44 26 L56 31 L54 36 L41 32 Z"/>
   </svg>`,
  // Connecting: the same runner, now with speed lines behind them.
  `<svg viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
     <circle cx="42" cy="12" r="7"/>
     <path d="M38 21 L48 26 L44 38 L50 52 L44 55 L37 41 L30 47 L24 44 L31 33 L28 24 Z"/>
     <path d="M48 26 L60 31 L58 36 L45 32 Z"/>
     <rect x="2" y="20" width="18" height="4" rx="2"/>
     <rect x="6" y="31" width="14" height="4" rx="2"/>
     <rect x="0" y="42" width="20" height="4" rx="2"/>
   </svg>`,
  // Connected: two people, together.
  `<svg viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
     <circle cx="22" cy="17" r="9"/>
     <path d="M22 29 c-9 0 -15 6 -15 14 v9 h30 v-9 c0 -8 -6 -14 -15 -14 Z"/>
     <circle cx="45" cy="20" r="7"/>
     <path d="M45 30 c-7 0 -12 5 -12 11 v11 h24 v-11 c0 -6 -5 -11 -12 -11 Z"/>
   </svg>`,
];

const MAX_DIALUP_MS = 9000;
// With no sound to wait for there is nothing to pace against — but the three
// progress boxes still have to fill before "Connected" appears, or the screen
// contradicts itself. Long enough to read, short enough not to be a wait.
const SILENT_DIALUP_MS = 2400;
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
            ${DIAL_FIGURES.map((svg) => `<div class="aol-box"><div class="box-figure">${svg}</div></div>`).join('')}
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

    // One timeline drives both the boxes and the hand-off to "Connected", so
    // they can never disagree. Muted or without Howler there is no sound to
    // pace against, and nine seconds of silence is not a connection sequence.
    const audible = this.audioManager?.canPlay?.('dialup');
    const dialDuration = this.audioManager?.durationMs?.('dialup') || 0;
    const targetDialMs = audible
      ? (dialDuration > 0 ? Math.min(dialDuration, MAX_DIALUP_MS) : MAX_DIALUP_MS)
      : SILENT_DIALUP_MS;

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
