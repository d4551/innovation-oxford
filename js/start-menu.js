// ============================================
// START MENU MODULE
// Toggles a simple Win95-style Start menu and launches apps
// ============================================

class StartMenu {
  constructor(managers) {
    this.menuWin = null;
    this.menuBody = null;
    this.buttonEl = null;
    this.ieManager = managers?.ieManager || null;
    this.channelsManager = managers?.channelsManager || null;
    this.mailManager = managers?.mailManager || null;
    this.paintManager = managers?.paintManager || null;
    this.boundDocClick = null;
    this.width = 260;
    this.height = 300;
  }

  init() {
    this.buttonEl = document.querySelector('.start-btn');
    if (!this.buttonEl) return;

    // Create a windowed start menu using WindowManager (DRY)
    const top = this.computeTop();
    const shell = windowManager.createWindowShell({
      title: 'Start',
      className: 'start-menu-window',
      width: `${this.width}px`,
      height: `${this.height}px`,
      top: `${top}px`,
      left: '4px',
      controls: { minimize: false, maximize: false, close: true }
    });
    this.menuWin = shell.windowEl;
    this.menuBody = shell.body;
    this.menuBody.style.padding = '4px';
    // Wire close control
    const ctrlClose = this.menuWin.querySelector('.title-bar-btn[data-action="close"]');
    if (ctrlClose) ctrlClose.addEventListener('click', () => this.close());

    // Populate menu items
    this.menuBody.innerHTML = `
      <div class="start-menu-list">
        <div class="menu-item" data-app="aim">
          <span class="start-menu-icon chat-icon"></span>
          Oxford Messenger
        </div>
        <div class="menu-item" data-app="ie">
          <span class="start-menu-icon ie-icon"></span>
          Internet Explorer
        </div>
        <div class="menu-item" data-app="mail">
          <span class="start-menu-icon mail-icon"></span>
          Oxford Mail
        </div>
        <div class="menu-item" data-app="paint">
          <span class="start-menu-icon paint-icon"></span>
          Oxford Paint
        </div>
        <div class="menu-item" data-app="channels">
          <span class="start-menu-icon channels-icon"></span>
          Oxford Channels
        </div>
        <div class="menu-item" data-app="dos">
          <span class="start-menu-icon dos-icon"></span>
          MS-DOS Games
        </div>
      </div>
    `;

    // Initially hidden
    this.menuWin.classList.add('hidden');

    window.addEventListener('resize', () => this.reposition());

    // Toggle open/close
    this.buttonEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Menu item actions
    this.menuBody.addEventListener('click', (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      const app = item.getAttribute('data-app');
      if (app === 'aim' && window.chatManager) window.chatManager.show();
      if (app === 'ie' && this.ieManager) this.ieManager.open();
      if (app === 'mail' && this.mailManager) this.mailManager.open();
      if (app === 'paint' && this.paintManager) this.paintManager.open();
      if (app === 'channels' && this.channelsManager) this.channelsManager.open();
      if (app === 'dos') this.launchDosLibrary();
      this.close();
    });

    // Close on outside click
    this.boundDocClick = (e) => {
      if (this.menuWin.classList.contains('hidden')) return;
      if (e.target.closest('.start-menu-window') || e.target.closest('.start-btn')) return;
      this.close();
    };
    document.addEventListener('click', this.boundDocClick);
  }

  computeTop() {
    const taskbar = document.querySelector('.taskbar');
    const hb = (taskbar?.offsetHeight) || 28;
    return window.innerHeight - hb - this.height - 2; // small margin
  }

  reposition() {
    if (!this.menuWin) return;
    this.menuWin.style.top = `${this.computeTop()}px`;
  }

  toggle() {
    if (!this.menuWin) return;
    const hidden = this.menuWin.classList.contains('hidden');
    this.menuWin.classList.toggle('hidden', !hidden);
    if (!hidden) {
      // about to hide
      return;
    }
    // bring to front and reposition on show
    this.reposition();
    this.menuWin.style.zIndex = ++windowManager.zIndexCounter;
  }

  close() {
    if (!this.menuWin) return;
    this.menuWin.classList.add('hidden');
  }

  launchDosLibrary() {
    let manager = window.msdosManager || (typeof msdosManager !== 'undefined' ? msdosManager : null);
    if (!manager && typeof MSDosManager !== 'undefined') {
      try {
        manager = new MSDosManager();
        if (typeof manager.init === 'function') {
          manager.init();
        }
        if (typeof msdosManager !== 'undefined') {
          msdosManager = manager;
        }
        window.msdosManager = manager;
      } catch (err) {
        console.warn('StartMenu: unable to initialize MSDosManager', err);
      }
    }
    if (!manager) return;
    if (!window.msdosManager) {
      window.msdosManager = manager;
    }
    if (typeof manager.openLibrary === 'function') {
      manager.openLibrary();
    } else {
      manager.open('civ');
    }
  }
}

// Global instance created in main.js
