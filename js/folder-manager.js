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
      <div class="folder-content"><ul class="files-grid"></ul></div>
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
      container.innerHTML = '<li class="empty">This folder is empty.</li>';
      return;
    }

    container.innerHTML = '';
    this.files.forEach((file) => {
      const li = document.createElement('li');
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `file-item ${file.type || 'file'}`;
      el.setAttribute('aria-label', `Open ${file.name}`);
      el.innerHTML = `
        <span class="file-icon ${file.type === 'video' ? 'file-icon-video' : 'file-icon-generic'}" aria-hidden="true"></span>
        <span class="file-name"></span>
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
      // Enter/Space already activate a <button>; no keydown handler needed.
      li.appendChild(el);
      container.appendChild(li);
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
