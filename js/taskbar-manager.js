// ============================================
// TASKBAR MANAGER
// Owns the taskbar window buttons (add, retitle, activate, remove).
// On compact viewports the taskbar is the primary window switcher, so buttons
// scroll horizontally instead of squeezing.
// ============================================

class TaskbarManager {
  constructor() {
    this.container = null;
    this.items = new Map(); // id -> { button, onToggle }
  }

  init() {
    this.container = document.querySelector('.taskbar-windows');
    if (this.container) return;

    const taskbar = document.querySelector('.taskbar');
    if (!taskbar) return;
    this.container = document.createElement('div');
    this.container.className = 'taskbar-windows';
    taskbar.insertBefore(this.container, taskbar.querySelector('.time-display') || null);
  }

  addWindow(id, title, options = {}) {
    if (!this.container) this.init();
    if (!this.container) return null;

    const existing = this.items.get(id);
    if (existing) {
      if (typeof options.onToggle === 'function') existing.onToggle = options.onToggle;
      this.setTitle(id, title);
      this.setActive(id, true);
      return existing;
    }

    const btn = document.createElement('button');
    btn.className = 'btn-95 task-btn';
    btn.type = 'button';
    btn.dataset.taskId = id;
    if (options.iconClass) {
      const icon = document.createElement('span');
      icon.className = `task-icon ${options.iconClass}`;
      icon.setAttribute('aria-hidden', 'true');
      btn.appendChild(icon);
    }
    const label = document.createElement('span');
    label.className = 'task-title';
    label.textContent = title;
    btn.appendChild(label);
    btn.setAttribute('aria-label', title);

    const entry = { button: btn, onToggle: options.onToggle };
    btn.addEventListener('click', () => {
      if (typeof entry.onToggle === 'function') entry.onToggle();
    });

    this.container.appendChild(btn);
    this.items.set(id, entry);
    this.setActive(id, true);
    return entry;
  }

  setTitle(id, title) {
    const entry = this.items.get(id);
    if (!entry) return;
    const label = entry.button.querySelector('.task-title');
    if (label) label.textContent = title;
    entry.button.setAttribute('aria-label', title);
  }

  setActive(id, active) {
    if (active) {
      for (const [otherId, entry] of this.items.entries()) {
        if (otherId !== id) {
          entry.button.classList.remove('active');
          entry.button.setAttribute('aria-pressed', 'false');
        }
      }
    }
    const entry = this.items.get(id);
    if (!entry) return;
    entry.button.classList.toggle('active', !!active);
    entry.button.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (active) entry.button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  remove(id) {
    const entry = this.items.get(id);
    if (!entry) return;
    entry.button.remove();
    this.items.delete(id);
  }
}

window.TaskbarManager = TaskbarManager;
