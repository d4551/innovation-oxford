// ============================================
// START MENU MODULE
// A Win95-style Start menu anchored above the taskbar. Keyboard accessible:
// Escape closes, Up/Down move between items, Enter/Space launches.
// ============================================

const START_MENU_ITEMS = [
  { app: 'aim', label: 'Oxford Messenger', icon: 'chat-icon' },
  { app: 'ie', label: 'Internet Explorer', icon: 'ie-icon' },
  { app: 'mail', label: 'Oxford Mail', icon: 'mail-icon' },
  { app: 'paint', label: 'Oxford Paint', icon: 'paint-icon' },
  { app: 'channels', label: 'Oxford Channels', icon: 'channels-icon' },
  { app: 'dos', label: 'MS-DOS Games', icon: 'dos-icon' },
  // On a phone an open app covers the whole screen, so there has to be a way
  // back to the desktop icons that isn't "minimize each window in turn".
  { app: 'show-desktop', label: 'Show Desktop', icon: 'desktop-icon-glyph', separator: true },
];

class StartMenu {
  constructor(managers = {}) {
    this.managers = managers;
    this.menuEl = null;
    this.buttonEl = null;
    this.open = false;
  }

  init() {
    this.buttonEl = document.querySelector('.start-btn');
    if (!this.buttonEl) return;

    this.menuEl = document.createElement('div');
    this.menuEl.className = 'start-menu';
    this.menuEl.id = 'start-menu';
    this.menuEl.setAttribute('role', 'menu');
    this.menuEl.setAttribute('aria-label', 'Start menu');
    this.menuEl.hidden = true;
    this.menuEl.innerHTML = `
      <div class="start-menu-banner" aria-hidden="true"><span>Oxford</span>95</div>
      <div class="start-menu-list">
        ${START_MENU_ITEMS.map((item) => `
          <button type="button" class="menu-item${item.separator ? ' menu-item--sep' : ''}" role="menuitem" data-app="${item.app}">
            <span class="start-menu-icon ${item.icon}" aria-hidden="true"></span>
            <span class="menu-item-label">${Utils.escapeHtml(item.label)}</span>
          </button>`).join('')}
      </div>
    `;
    document.body.appendChild(this.menuEl);

    this.buttonEl.setAttribute('aria-haspopup', 'menu');
    this.buttonEl.setAttribute('aria-expanded', 'false');
    this.buttonEl.setAttribute('aria-controls', 'start-menu');
    this.buttonEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    Utils.on(this.menuEl, 'click', '.menu-item', (e) => {
      this.launch(e.currentTarget.dataset.app);
      this.close();
    });

    this.menuEl.addEventListener('keydown', (e) => this.handleKeys(e));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open) { this.close(); this.buttonEl.focus(); }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!this.open) return;
      if (e.target.closest('.start-menu') || e.target.closest('.start-btn')) return;
      this.close();
    });
  }

  handleKeys(e) {
    const items = Array.from(this.menuEl.querySelectorAll('.menu-item'));
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  }

  toggle() { if (this.open) this.close(); else this.show(); }

  show() {
    if (!this.menuEl) return;
    this.menuEl.hidden = false;
    this.open = true;
    this.buttonEl.setAttribute('aria-expanded', 'true');
    this.menuEl.querySelector('.menu-item')?.focus();
  }

  close() {
    if (!this.menuEl) return;
    this.menuEl.hidden = true;
    this.open = false;
    this.buttonEl.setAttribute('aria-expanded', 'false');
  }

  /**
   * Minimize every open window so the desktop icons are reachable again.
   * Routed through each app's own minimize() so side effects still run —
   * pausing the media player, for one.
   */
  showDesktop() {
    AppWindow.minimizeAll();
    this.managers.chatManager?.hide();
    document.querySelector('.desktop-icon')?.focus();
  }

  launch(app) {
    const { chatManager, ieManager, mailManager, paintManager, channelsManager } = this.managers;
    switch (app) {
      case 'aim': chatManager?.show(); break;
      case 'ie': ieManager?.open(); break;
      case 'mail': mailManager?.open(); break;
      case 'paint': paintManager?.open(); break;
      case 'channels': channelsManager?.open(); break;
      case 'dos': MSDosManager.shared()?.openLibrary(); break;
      case 'show-desktop': this.showDesktop(); break;
      default: break;
    }
  }
}

window.StartMenu = StartMenu;
