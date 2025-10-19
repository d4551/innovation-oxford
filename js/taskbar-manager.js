// ============================================
// TASKBAR MANAGER
// Manages taskbar window buttons (add, activate, remove)
// ============================================

class TaskbarManager {
  constructor() {
    this.container = null;
    this.items = new Map(); // id -> {button, onToggle}
  }

  init() {
    // Find or create container
    this.container = document.querySelector('.taskbar-windows');
    if (!this.container) {
      const taskbar = document.querySelector('.taskbar');
      if (taskbar) {
        this.container = document.createElement('div');
        this.container.className = 'taskbar-windows';
        // insert before time display
        const time = taskbar.querySelector('.time-display');
        taskbar.insertBefore(this.container, time || null);
      }
    }
  }

  addWindow(id, title, options) {
    if (!this.container) this.init();
    const opts = options || {};
    if (this.items.has(id)) {
      this.setTitle(id, title);
      this.setActive(id, true);
      return this.items.get(id);
    }
    const btn = document.createElement('button');
    btn.className = 'btn-95 task-btn';
    btn.type = 'button';
    const iconClass = opts.iconClass ? ` ${opts.iconClass}` : '';
    btn.innerHTML = `${opts.iconClass ? `<span class="task-icon${iconClass}"></span>` : ''}<span class="task-title"></span>`;
    const titleSpan = btn.querySelector('.task-title');
    titleSpan.textContent = title;
    btn.addEventListener('click', () => {
      if (opts && typeof opts.onToggle === 'function') {
        opts.onToggle();
      }
    });
    this.container.appendChild(btn);
    const entry = { button: btn, onToggle: opts?.onToggle };
    this.items.set(id, entry);
    this.setActive(id, true);
    return entry;
  }

  setTitle(id, title) {
    const entry = this.items.get(id);
    if (entry) {
      const t = entry.button.querySelector('.task-title');
      if (t) t.textContent = title; else entry.button.textContent = title;
    }
  }

  setActive(id, active) {
    // deactivate others if activating this one
    if (active) {
      for (const [otherId, e] of this.items.entries()) {
        if (otherId !== id) e.button.classList.remove('active');
      }
    }
    const entry = this.items.get(id);
    if (entry) {
      entry.button.classList.toggle('active', !!active);
    }
  }

  remove(id) {
    const entry = this.items.get(id);
    if (entry) {
      entry.button.remove();
      this.items.delete(id);
    }
  }
}

// Global instance created in main.js
