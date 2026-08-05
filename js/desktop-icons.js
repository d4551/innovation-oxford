// ============================================
// DESKTOP ICONS MANAGER
// Renders the desktop icon grid. Icons open on double-click with a pointer and
// on a single tap on touch devices, where double-tap belongs to the platform.
// ============================================

class DesktopIconsManager {
  constructor(managers = {}) {
    this.managers = managers;
    this.container = null;
    this.icons = [
      { id: 'homework', label: 'Homework', iconClass: 'folder-icon', open: () => this.managers.folderManager?.openHomework() },
      { id: 'internet-explorer', label: 'Internet Explorer', iconClass: 'ie-icon', open: () => this.managers.ieManager?.open() },
      { id: 'oxford-mail', label: 'Oxford Mail', iconClass: 'mail-icon', open: () => this.managers.mailManager?.open() },
      { id: 'paint', label: 'Oxford Paint', iconClass: 'paint-icon', open: () => this.managers.paintManager?.open() },
      { id: 'channels', label: 'Oxford Channels', iconClass: 'channels-icon', open: () => this.managers.channelsManager?.open() },
      { id: 'aim', label: 'Oxford Messenger', iconClass: 'aim-icon', open: () => this.managers.chatManager?.toggleFromTaskbar() },
      { id: 'media-player', label: 'OxfordInnovation.mp4', iconClass: 'media-icon', open: () => this.managers.mediaPlayerManager?.openOxfordInnovation({ gesture: true }) },
    ];
  }

  init() {
    const desktop = document.querySelector('.desktop');
    if (!desktop) return;

    this.container = document.createElement('ul');
    this.container.className = 'desktop-icons';
    this.container.setAttribute('aria-label', 'Desktop shortcuts');
    desktop.appendChild(this.container);
    this.render();

    Utils.on(this.container, 'click', '.desktop-icon', (e) => {
      this.select(e.currentTarget);
      if (Utils.isTouch()) this.launch(e.currentTarget.dataset.id);
    });
    Utils.on(this.container, 'dblclick', '.desktop-icon', (e) => {
      e.preventDefault();
      this.launch(e.currentTarget.dataset.id);
    });
    Utils.on(this.container, 'keydown', '.desktop-icon', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.select(e.currentTarget);
        this.launch(e.currentTarget.dataset.id);
      }
    });
  }

  render() {
    this.container.replaceChildren();
    this.icons.forEach((cfg) => {
      const li = document.createElement('li');
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'desktop-icon';
      item.dataset.id = cfg.id;
      item.setAttribute('aria-label', `Open ${cfg.label}`);
      item.innerHTML = '<span class="icon" aria-hidden="true"></span><span class="label"></span>';
      item.querySelector('.icon').classList.add(cfg.iconClass);
      item.querySelector('.label').textContent = cfg.label;
      li.appendChild(item);
      this.container.appendChild(li);
    });
  }

  select(el) {
    this.container.querySelectorAll('.desktop-icon.selected').forEach((n) => n.classList.remove('selected'));
    el.classList.add('selected');
  }

  launch(id) {
    const icon = this.icons.find((i) => i.id === id);
    if (icon) icon.open();
  }
}

window.DesktopIconsManager = DesktopIconsManager;
