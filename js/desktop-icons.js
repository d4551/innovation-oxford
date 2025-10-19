// ============================================
// DESKTOP ICONS MANAGER
// Renders desktop icons and handles double-click to launch apps
// ============================================

class DesktopIconsManager {
  constructor({ ieManager, channelsManager, mailManager, folderManager, mediaPlayerManager, paintManager } = {}) {
    this.ieManager = ieManager;
    this.channelsManager = channelsManager;
    this.mailManager = mailManager;
    this.folderManager = folderManager;
    this.mediaPlayerManager = mediaPlayerManager || null;
    this.paintManager = paintManager || null;
    this.container = null;
    this.icons = [];
  }

  init() {
    const desktop = document.querySelector('.desktop');
    if (!desktop) return;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'desktop-icons';
    desktop.appendChild(this.container);

    // Define icons
    this.icons = [
      {
        id: 'homework',
        label: 'Homework',
        iconClass: 'folder-icon',
        onOpen: () => this.openHomework()
      },
      {
        id: 'internet-explorer',
        label: 'Internet Explorer',
        iconClass: 'ie-icon',
        onOpen: () => this.openInternetExplorer()
      },
      {
        id: 'oxford-mail',
        label: 'Oxford Mail',
        iconClass: 'mail-icon',
        onOpen: () => this.openMail()
      },
      {
        id: 'paint',
        label: 'Oxford Paint',
        iconClass: 'paint-icon',
        onOpen: () => this.openPaint()
      },
      {
        id: 'channels',
        label: 'Oxford Channels',
        iconClass: 'channels-icon',
        onOpen: () => this.openChannels()
      },
      {
        id: 'aim',
        label: 'Oxford Messenger',
        iconClass: 'aim-icon',
        onOpen: () => this.openAIM()
      },
      {
        id: 'media-player',
        label: 'OxfordInnovation.mp4',
        iconClass: 'media-icon',
        onOpen: () => this.openMediaPlayer()
      }
    ];

    this.renderIcons();
  }

  renderIcons() {
    this.container.innerHTML = '';
    this.icons.forEach((cfg, idx) => {
      const item = document.createElement('div');
      item.className = 'desktop-icon';
      item.setAttribute('data-id', cfg.id);
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', cfg.label);

      // Icon glyph + label
      item.innerHTML = `
        <div class="icon ${cfg.iconClass}"></div>
        <div class="label">${cfg.label}</div>
      `;

      // Click to select, double-click to open
      const openFn = () => {
        this.clearSelection();
        item.classList.add('selected');
        const icon = this.icons.find(i => i.id === cfg.id);
        if (icon && typeof icon.onOpen === 'function') icon.onOpen();
      };

      item.addEventListener('click', (e) => {
        this.clearSelection();
        item.classList.add('selected');
        item.focus();
      });
      item.addEventListener('dblclick', (e) => {
        e.preventDefault();
        openFn();
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFn();
        }
      });

      this.container.appendChild(item);
    });
  }

  clearSelection() {
    this.container.querySelectorAll('.desktop-icon.selected').forEach(el => el.classList.remove('selected'));
  }

  openInternetExplorer() {
    if (this.ieManager) {
      this.ieManager.open();
    }
  }

  openChannels() {
    if (this.channelsManager) {
      this.channelsManager.open();
    }
  }

  openHomework() {
    if (this.folderManager) {
      this.folderManager.openHomework();
    }
  }

  openAIM() {
    // Toggle AIM app (Buddy List + Chat) without losing messages
    const buddy = document.querySelector('.buddy-list');
    const chat = document.querySelector('.chat-window');
    const isHidden = chat ? (getComputedStyle(chat).display === 'none') : true;
    // If hidden, show both; otherwise hide both
    if (isHidden) {
      if (buddy) {
        buddy.style.display = 'block';
        buddy.style.zIndex = ++windowManager.zIndexCounter;
      }
      if (chat) {
        chat.style.display = 'block';
        chat.style.zIndex = ++windowManager.zIndexCounter;
      }
      if (window.taskbarManager) window.taskbarManager.setActive('chat', true);
    } else {
      if (buddy) buddy.style.display = 'none';
      if (chat) chat.style.display = 'none';
      if (window.taskbarManager) window.taskbarManager.setActive('chat', false);
    }
  }

  openMail() {
    if (window.mailManager) {
      window.mailManager.open();
    }
  }

  openPaint() {
    const manager = this.paintManager || window.paintManager;
    if (manager) manager.open();
  }

  openMediaPlayer() {
    const manager = this.mediaPlayerManager || window.mediaPlayerManager;
    if (manager && typeof manager.openOxfordInnovation === 'function') {
      // Pass a gesture hint so autoplay isn't blocked by browsers
      manager.openOxfordInnovation({ gesture: true });
    }
  }
}

// Global instance created in main.js
