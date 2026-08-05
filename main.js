// ============================================
// MAIN APPLICATION
// Boots the modules and wires the cross-cutting behaviour: the clock, the
// compact/desktop layout switch, global keyboard shortcuts.
// ============================================

const CLOCK_INTERVAL_MS = 30000;
// Below this width (or height, in landscape) free-floating windows stop making
// sense and every app renders full-bleed instead. Kept in sync with main.css.
const COMPACT_QUERY = '(max-width: 900px), (max-height: 520px)';

// ---------- clock ----------

function updateTime() {
  const el = document.getElementById('timeDisplay');
  if (!el) return;
  const now = new Date();
  const hours = now.getHours() % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
  el.textContent = `${hours}:${minutes} ${ampm}`;
  el.dateTime = now.toISOString();
}

// ---------- layout mode ----------

function applyLayoutMode(matches) {
  document.body.classList.toggle('is-compact', matches);
  // Floating windows can end up off-screen after a rotation or resize.
  windowManager.clampAllToViewport();
}

function watchLayoutMode() {
  const mq = window.matchMedia(COMPACT_QUERY);
  applyLayoutMode(mq.matches);
  mq.addEventListener('change', (e) => applyLayoutMode(e.matches));
  window.addEventListener('resize', () => windowManager.clampAllToViewport());
  window.addEventListener('orientationchange', () => {
    setTimeout(() => windowManager.clampAllToViewport(), 200);
  });
}

// ---------- keyboard shortcuts ----------

function bindShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd+T opens the MS-DOS prompt.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !e.shiftKey) {
      e.preventDefault();
      window.terminalManager?.open();
    }
    // Escape skips the dial-up sequence.
    if (e.key === 'Escape' && document.getElementById('dialup-intro')) {
      window.dialupIntro?.skip();
    }
  });
}

// ---------- boot ----------

/**
 * Construct every module. Each one is isolated so a single failure degrades
 * one feature rather than taking the whole desktop down with it.
 */
function initializeApplication() {
  const safely = (label, fn) => {
    try { return fn(); } catch (err) {
      console.error(`Oxford: "${label}" failed to initialise`, err);
      return null;
    }
  };

  windowManager.init();

  window.taskbarManager = safely('taskbar', () => {
    const t = new TaskbarManager();
    t.init();
    return t;
  });

  window.chatManager = safely('messenger', () => {
    const c = new ChatManager(audioManager);
    c.init();
    return c;
  });

  window.terminalManager = safely('terminal', () => new TerminalManager());
  window.ieManager = safely('internet explorer', () => new IEManager());
  window.mailManager = safely('mail', () => new MailManager());
  window.channelsManager = safely('channels', () => new ChannelsManager({ ieManager: window.ieManager }));
  window.folderManager = safely('folders', () => new FolderManager());
  window.mediaPlayerManager = safely('media player', () => new MediaPlayerManager({ windowTitle: 'Oxford Media Player' }));
  window.paintManager = safely('paint', () => new PaintManager({ imagePath: 'media/inno-paint.jpg' }));

  safely('start menu', () => {
    window.startMenu = new StartMenu({
      chatManager: window.chatManager,
      ieManager: window.ieManager,
      mailManager: window.mailManager,
      paintManager: window.paintManager,
      channelsManager: window.channelsManager,
    });
    window.startMenu.init();
  });

  safely('desktop icons', () => {
    window.desktopIcons = new DesktopIconsManager({
      chatManager: window.chatManager,
      ieManager: window.ieManager,
      mailManager: window.mailManager,
      paintManager: window.paintManager,
      channelsManager: window.channelsManager,
      folderManager: window.folderManager,
      mediaPlayerManager: window.mediaPlayerManager,
    });
    window.desktopIcons.init();
  });

  document.querySelector('.taskbar-dos')?.addEventListener('click', () => window.terminalManager?.open());

  updateTime();
  setInterval(updateTime, CLOCK_INTERVAL_MS);
}

document.addEventListener('DOMContentLoaded', () => {
  watchLayoutMode();
  bindShortcuts();
  updateTime();

  const desktop = document.querySelector('.desktop');
  if (desktop) {
    desktop.classList.add('hidden');
    desktop.setAttribute('aria-hidden', 'true');
  }
  document.querySelector('.taskbar')?.setAttribute('aria-hidden', 'true');

  window.dialupIntro = new DialupIntro(audioManager);
  // The intro owns the gesture; it calls back once the user has signed in.
  window.dialupIntro.onDone = initializeApplication;
  window.dialupIntro.showLoginScreen();
});
