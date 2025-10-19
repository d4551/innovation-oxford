// ============================================
// INTERNET EXPLORER (FAKE) MODULE
// Creates a Win95-style browser window with an iframe
// ============================================

class IEManager {
  constructor() {
    this.windowEl = null;
    this.addressInput = null;
    this.defaultUrl = 'https://lifelong-learning.ox.ac.uk/courses/emerging-technologies-for-social-innovation-and-entrepreneurship?code=O25P103COJ';
    this.snapshotSrc = 'media/oxford-page.png';
    this.taskbarId = 'internet-explorer';
    this.taskbarEntry = null;
  }

  open(url) {
    if (this.windowEl) {
      // Focus existing window
      this.windowEl.style.display = 'block';
      this.windowEl.style.zIndex = ++windowManager.zIndexCounter;
      if (url) this.navigate(url);
      return this.windowEl;
    }

    // Use window shell from WindowManager (DRY)
    const shell = windowManager.createWindowShell({
      title: 'Internet Explorer',
      className: 'ie-window',
      width: '900px',
      height: '600px',
      top: '80px',
      left: '140px',
      controls: { minimize: true, maximize: true, close: true }
    });
    const win = shell.windowEl;
    const titleBar = shell.titleBar;
    const body = shell.body;
    body.style.display = 'flex';
    body.style.flexDirection = 'column';

    const toolbar = document.createElement('div');
    toolbar.className = 'ie-toolbar';
    toolbar.innerHTML = `
      <div class="ie-toolbar-row">
        <span style="font-size:11px;margin-right:6px;">Oxford</span>
        <input class="input-95 ie-address" type="text" readonly />
        <button class="btn-95 ie-open-tab" title="Open in new tab">Open in Tab</button>
      </div>
    `;

    const frameWrap = document.createElement('div');
    frameWrap.className = 'ie-frame-wrap';
    frameWrap.style.flex = '1';
    frameWrap.style.background = '#ffffff';
    frameWrap.style.borderTop = '1px solid #808080';

    const scroll = document.createElement('div');
    scroll.className = 'ie-scroll';
    scroll.style.width = '100%';
    scroll.style.height = '100%';
    scroll.style.overflow = 'auto';
    scroll.style.background = '#ffffff';

    const img = document.createElement('img');
    img.className = 'ie-snapshot';
    img.src = this.snapshotSrc;
    img.alt = 'Oxford Course Page';
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = 'auto';

    scroll.appendChild(img);
    frameWrap.appendChild(scroll);
    body.appendChild(toolbar);
    body.appendChild(frameWrap);

    // Wire controls
    const [minBtn, maxBtn, closeBtn] = titleBar.querySelectorAll('.title-bar-btn');
    minBtn.addEventListener('click', () => this.minimize());
    maxBtn.addEventListener('click', () => this.toggleMaximize());
    closeBtn.addEventListener('click', () => this.close());

    // Activate on focus (click anywhere inside)
    win.addEventListener('mousedown', () => this.activate());

    // Address bar + open in tab (snapshot mode)
    this.addressInput = toolbar.querySelector('.ie-address');
    const openTabBtn = toolbar.querySelector('.ie-open-tab');
    this.windowEl = win;
    const target = url || this.defaultUrl;
    this.addressInput.value = target;
    const openInTab = () => window.open(target, '_blank', 'noopener');
    openTabBtn.addEventListener('click', openInTab);
    img.addEventListener('click', openInTab);

    // Register taskbar button
    if (window.taskbarManager) {
      this.taskbarEntry = window.taskbarManager.addWindow(this.taskbarId, 'Internet Explorer', {
        onToggle: () => this.toggleFromTaskbar(),
        iconClass: 'ie-icon'
      });
    }

    this.activate();
    return win;
  }

  // No navigation in snapshot mode
  navigate(url) { /* noop in simplified snapshot mode */ }

  minimize() {
    if (this.windowEl) this.windowEl.style.display = 'none';
    if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, false);
  }

  toggleMaximize() {
    if (!this.windowEl) return;
    const win = this.windowEl;
    const isMax = win.dataset.maximized === '1';
    if (isMax) {
      // restore
      win.style.top = win.dataset.prevTop || '80px';
      win.style.left = win.dataset.prevLeft || '140px';
      win.style.width = win.dataset.prevWidth || '900px';
      win.style.height = win.dataset.prevHeight || '600px';
      win.dataset.maximized = '0';
    } else {
      // store
      win.dataset.prevTop = win.style.top;
      win.dataset.prevLeft = win.style.left;
      win.dataset.prevWidth = win.style.width;
      win.dataset.prevHeight = win.style.height;
      // maximize
      win.style.top = '0px';
      win.style.left = '0px';
      win.style.width = `${window.innerWidth - 4}px`;
      win.style.height = `${window.innerHeight - 28 - 4}px`;
      win.dataset.maximized = '1';
    }
  }

  close() {
    if (!this.windowEl) return;
    if (windowManager) windowManager.closeWindow(this.windowEl);
    this.windowEl = null;
    this.addressInput = null;
    if (window.taskbarManager) window.taskbarManager.remove(this.taskbarId);
  }

  toggleFromTaskbar() {
    if (!this.windowEl) {
      this.open();
      return;
    }
    const hidden = this.windowEl.style.display === 'none';
    if (hidden) {
      this.windowEl.style.display = 'block';
      this.activate();
    } else {
      this.minimize();
    }
  }

  activate() {
    if (!this.windowEl) return;
    this.windowEl.style.zIndex = ++windowManager.zIndexCounter;
    if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, true);
  }

  
}

// Global instance created in main.js
