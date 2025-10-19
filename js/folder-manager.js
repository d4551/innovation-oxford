// ============================================
// FOLDER MANAGER
// Handles Win95-style folder windows (e.g., Homework)
// ============================================

class FolderManager {
  constructor() {
    this.windows = new Map(); // id -> windowEl
  }

  openHomework() {
    return this.openFolder('homework', 'Homework');
  }

  openFolder(id, title) {
    const winId = `folder-${id}`;
    const existing = this.windows.get(winId);
    if (existing) {
      existing.style.display = 'block';
      this.activate(existing, winId);
      return existing;
    }

    const shell = windowManager.createWindowShell({
      title,
      className: `folder-window folder-${id}`,
      width: '520px', height: '380px', top: '110px', left: '180px',
      controls: { minimize: true, maximize: true, close: true }
    });
    const win = shell.windowEl;
    const titleBar = shell.titleBar;
    const body = shell.body;

    // Layout
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.innerHTML = `
      <div class="folder-toolbar">
        <span class="path">C:\\Desktop\\${this.escape(title)}</span>
      </div>
      <div class="folder-content"><div class="files-grid" role="list"></div></div>
    `;

    // Populate Homework folder files if applicable
    if (id === 'homework') {
      const files = [
        { name: 'xfiles.mp4', path: 'media/xfiles.mp4', type: 'video' },
        { name: 'intro.mp4', path: 'media/intro.mp4', type: 'video' },
        { name: 'innovation.mp4', path: 'media/innovation.mp4', type: 'video' },
        { name: 'end.mp4', path: 'media/end.mp4', type: 'video' },
      ];
      this.renderFiles(body.querySelector('.files-grid'), files);
      if (window.mediaPlayerManager && typeof window.mediaPlayerManager.setPlaylist === 'function') {
        window.mediaPlayerManager.setPlaylist('Homework', files);
      }
    }

    // Taskbar button
    if (window.taskbarManager) {
      window.taskbarManager.addWindow(winId, title, {
        onToggle: () => this.toggleFromTaskbar(win, winId),
        iconClass: 'folder-icon'
      });
    }

    // Controls
    const [minBtn, maxBtn, closeBtn] = titleBar.querySelectorAll('.title-bar-btn');
    if (minBtn) minBtn.addEventListener('click', () => this.minimize(win, winId));
    if (maxBtn) maxBtn.addEventListener('click', () => this.toggleMaximize(win));
    if (closeBtn) closeBtn.addEventListener('click', () => this.close(win, winId));

    // Focus
    win.addEventListener('mousedown', () => this.activate(win, winId));

    this.windows.set(winId, win);
    this.activate(win, winId);
    return win;
  }

  renderFiles(container, items = []) {
    if (!container) return;
    if (!items.length) {
      container.innerHTML = '<div class="empty">This folder is empty. Add files later.</div>';
      return;
    }
    container.innerHTML = '';
    items.forEach((file) => {
      const el = document.createElement('div');
      el.className = `file-item ${file.type || 'file'}`;
      el.setAttribute('role', 'listitem');
      el.setAttribute('tabindex', '0');
      el.innerHTML = `
        <div class="file-icon ${file.type === 'video' ? 'file-icon-video' : 'file-icon-generic'}"></div>
        <div class="file-name" title="${this.escape(file.name)}">${this.escape(file.name)}</div>
      `;
      const open = () => {
        if (window.mediaPlayerManager) {
          // Pass fromGesture so browsers allow immediate playback
          window.mediaPlayerManager.open({ src: file.path, title: file.name, mediaType: file.type, autoplay: true, fromGesture: true });
        }
      };
      el.addEventListener('dblclick', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
      container.appendChild(el);
    });
  }

  minimize(win, id) {
    if (!win) return;
    win.style.display = 'none';
    if (window.taskbarManager) window.taskbarManager.setActive(id, false);
  }

  toggleMaximize(win) {
    if (!win) return;
    const isMax = win.dataset.maximized === '1';
    if (isMax) {
      win.style.top = win.dataset.prevTop || '110px';
      win.style.left = win.dataset.prevLeft || '180px';
      win.style.width = win.dataset.prevWidth || '520px';
      win.style.height = win.dataset.prevHeight || '380px';
      win.dataset.maximized = '0';
    } else {
      win.dataset.prevTop = win.style.top;
      win.dataset.prevLeft = win.style.left;
      win.dataset.prevWidth = win.style.width;
      win.dataset.prevHeight = win.style.height;
      win.style.top = '0px';
      win.style.left = '0px';
      win.style.width = `${window.innerWidth - 4}px`;
      win.style.height = `${window.innerHeight - 28 - 4}px`;
      win.dataset.maximized = '1';
    }
  }

  close(win, id) {
    if (!win) return;
    windowManager.closeWindow(win);
    this.windows.delete(id);
    if (window.taskbarManager) window.taskbarManager.remove(id);
  }

  toggleFromTaskbar(win, id) {
    if (!win) return;
    const hidden = win.style.display === 'none';
    if (hidden) { win.style.display = 'block'; this.activate(win, id); }
    else { this.minimize(win, id); }
  }

  activate(win, id) {
    if (!win) return;
    win.style.zIndex = ++windowManager.zIndexCounter;
    if (window.taskbarManager) window.taskbarManager.setActive(id, true);
  }

  escape(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
}

// Global instance created in main.js
