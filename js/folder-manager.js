// ============================================
// FOLDER MANAGER
// Win95-style folder windows. Each folder is its own AppWindow instance,
// tracked by id so re-opening focuses the existing window.
// ============================================

const FOLDER_CONTENTS = {
  homework: {
    title: 'Homework',
    files: [
      { name: 'xfiles.mp4', path: 'media/xfiles.mp4', type: 'video' },
      { name: 'intro.mp4', path: 'media/intro.mp4', type: 'video' },
      { name: 'innovation.mp4', path: 'media/innovation.mp4', type: 'video' },
      { name: 'end.mp4', path: 'media/end.mp4', type: 'video' },
    ],
  },
};

class FolderWindow extends AppWindow {
  constructor(key, config) {
    super({
      id: `folder-${key}`,
      title: config.title,
      className: `folder-window folder-${key}`,
      iconClass: 'folder-icon',
      width: 520,
      height: 380,
    });
    this.key = key;
    this.files = config.files || [];
  }

  renderBody(body) {
    body.innerHTML = `
      <div class="folder-toolbar">
        <span class="path"></span>
      </div>
      <div class="folder-content"><div class="files-grid" role="list"></div></div>
    `;
    this.$('.path').textContent = `C:\\Desktop\\${this.title}`;
    this.renderFiles(this.$('.files-grid'));

    if (this.files.length && window.mediaPlayerManager) {
      window.mediaPlayerManager.setPlaylist(this.title, this.files);
    }
  }

  renderFiles(container) {
    if (!container) return;
    if (!this.files.length) {
      container.innerHTML = '<div class="empty">This folder is empty.</div>';
      return;
    }

    container.innerHTML = '';
    this.files.forEach((file) => {
      const el = document.createElement('div');
      el.className = `file-item ${file.type || 'file'}`;
      el.setAttribute('role', 'listitem');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `Open ${file.name}`);
      el.innerHTML = `
        <div class="file-icon ${file.type === 'video' ? 'file-icon-video' : 'file-icon-generic'}" aria-hidden="true"></div>
        <div class="file-name"></div>
      `;
      const nameEl = el.querySelector('.file-name');
      nameEl.textContent = file.name;
      nameEl.title = file.name;

      const open = () => {
        if (!window.mediaPlayerManager) return;
        window.mediaPlayerManager.open({
          src: file.path,
          title: file.name,
          mediaType: file.type,
          autoplay: true,
          fromGesture: true,
        });
      };

      // Double-click on pointer devices; a single tap on touch, where
      // double-tap is reserved by the platform for zoom.
      el.addEventListener('dblclick', open);
      el.addEventListener('click', () => { if (Utils.isTouch()) open(); });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      container.appendChild(el);
    });
  }
}

class FolderManager {
  constructor() {
    this.folders = new Map(); // key -> FolderWindow
  }

  openHomework() { return this.openFolder('homework'); }

  openFolder(key) {
    const config = FOLDER_CONTENTS[key];
    if (!config) {
      console.warn(`FolderManager: unknown folder "${key}"`);
      return null;
    }
    let folder = this.folders.get(key);
    if (!folder) {
      folder = new FolderWindow(key, config);
      this.folders.set(key, folder);
    }
    return folder.open();
  }
}

window.FolderManager = FolderManager;
