// ============================================
// CHAT MANAGER MODULE
// The AIM half of the app: a buddy list plus an instant-message window.
// The roster, colours and reply personalities all come from js/buddies.js.
// ============================================

const CHAT_STORAGE_KEY = 'aim.chat.v2';
const YOU_COLOR = '#0000ff';
const TYPING_MIN_MS = 900;
const TYPING_SHOW_DELAY_MS = 400;

class ChatManager {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.currentChatUser = null;
    this.taskbarId = 'chat';
    this.timers = { reply: null, showTyping: null };
    this.typingEl = null;
    this.state = {
      conversations: {},
      currentUser: null,
      meta: { counters: {}, thresholds: {}, delivered: {}, fillerBags: {}, lastFillerIdx: {} },
    };
  }

  init() {
    this.renderBuddyList();
    this.bindChatWindow();
    this.bindBuddyWindow();
    this.registerTaskbar();

    this.loadState();
    const initial = this.state.currentUser || Buddies.online[0]?.name;
    if (initial) {
      // First visit: seed a short exchange so the window isn't a blank box.
      if (!this.state.conversations[initial]?.length) {
        this.state.conversations[initial] = this.starterConversation(initial);
        this.saveState();
      }
      this.openChat(initial, { restoreOnly: true });
    }
  }

  starterConversation(name) {
    const base = new Date();
    const at = (minutesAgo) => this.formatTime(new Date(base.getTime() - minutesAgo * 60000));
    return [
      { sender: name, text: 'hey whats up! u there?', time: at(3) },
      { sender: 'You', text: 'yeah just chillin, listening to some CDs', time: at(2) },
      { sender: name, text: 'cool cool. wanna play some starcraft later?', time: at(1) },
    ];
  }

  // ---------- rendering ----------

  renderBuddyList() {
    const container = document.querySelector('.buddy-list .buddy-groups');
    if (!container) return;

    // A real <ul>/<li>/<button> tree. Putting role="listitem" on the button
    // itself would override its button role, so assistive tech would no longer
    // announce it as something you can activate.
    const group = (label, buddies, extraClass = '') => `
      <section class="buddy-group">
        <h2 class="buddy-group-header">▼ ${label} (${buddies.length})</h2>
        <ul class="buddy-list-items ${extraClass}">
          ${buddies.map((b) => `
            <li>
              <button type="button" class="buddy-item buddy-item--${b.status}"
                      data-buddy="${Utils.escapeAttr(b.name)}" ${b.status === 'offline' ? 'disabled' : ''}>
                <span class="status-icon status-${b.status}" aria-hidden="true"></span>
                <span class="buddy-name">${Utils.escapeHtml(b.name)}</span>
                <span class="visually-hidden">, ${b.status}</span>
              </button>
            </li>`).join('')}
        </ul>
      </section>`;

    container.innerHTML = group('Online', Buddies.online) + group('Offline', Buddies.offline, 'is-offline');

    Utils.on(container, 'click', '.buddy-item', (e) => {
      const name = e.currentTarget.dataset.buddy;
      if (name && Buddies.find(name)) this.openChat(name);
    });
  }

  bindChatWindow() {
    const input = document.getElementById('messageInput');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
      });
    }
    const form = document.querySelector('.chat-input');
    if (form) {
      form.addEventListener('submit', (e) => { e.preventDefault(); this.sendMessage(); });
    }

    const win = document.querySelector('.chat-window');
    if (!win) return;
    windowManager.register(win);
    const titleBar = win.querySelector('.title-bar');
    Utils.on(titleBar, 'click', '.title-bar-btn', (e) => {
      const action = e.currentTarget.dataset.action;
      if (action === 'min') this.hide();
      else if (action === 'max') this.toggleMaximize(win);
      else if (action === 'close') this.close();
    });
    win.addEventListener('pointerdown', () => this.activate(), { capture: true });
  }

  bindBuddyWindow() {
    const win = document.querySelector('.buddy-list');
    if (!win) return;
    windowManager.register(win);
    const titleBar = win.querySelector('.title-bar');
    Utils.on(titleBar, 'click', '.title-bar-btn', (e) => {
      const action = e.currentTarget.dataset.action;
      if (action === 'min') win.classList.add('window--hidden');
      else if (action === 'max') this.toggleMaximize(win);
      else if (action === 'close') this.close();
    });
  }

  toggleMaximize(win) {
    if (win.dataset.maximized === '1') {
      win.style.top = win.dataset.prevTop || '';
      win.style.left = win.dataset.prevLeft || '';
      win.style.width = win.dataset.prevWidth || '';
      win.style.height = win.dataset.prevHeight || '';
      win.dataset.maximized = '0';
    } else {
      win.dataset.prevTop = win.style.top;
      win.dataset.prevLeft = win.style.left;
      win.dataset.prevWidth = win.style.width;
      win.dataset.prevHeight = win.style.height;
      const area = Utils.workArea();
      Object.assign(win.style, { top: '0px', left: '0px', width: `${area.width}px`, height: `${area.height}px` });
      win.dataset.maximized = '1';
    }
  }

  registerTaskbar() {
    if (!window.taskbarManager) return;
    window.taskbarManager.addWindow(this.taskbarId, 'Oxford', {
      iconClass: 'chat-icon',
      onToggle: () => this.toggleFromTaskbar(),
    });
    window.taskbarManager.setActive(this.taskbarId, !this.isHidden);
  }

  // ---------- messaging ----------

  sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;

    this.audioManager.playSend();
    input.value = '';

    const time = this.formatTime(new Date());
    this.appendMessage('You', time, message, YOU_COLOR);

    if (this.currentChatUser) {
      this.recordMessage(this.currentChatUser, { sender: 'You', text: message, time });
      this.bumpCounter(this.currentChatUser);
      this.saveState();
    }

    this.hideTyping();
    this.scheduleBuddyReply();
  }

  scheduleBuddyReply() {
    const user = this.currentChatUser;
    if (!user) return;
    this.clearTimers();

    const replyDelay = Math.max(TYPING_MIN_MS, 800 + Math.floor(Math.random() * 900));
    if (replyDelay > TYPING_SHOW_DELAY_MS + 150) {
      this.timers.showTyping = setTimeout(() => this.showTyping(user), TYPING_SHOW_DELAY_MS);
    }
    this.timers.reply = setTimeout(() => {
      this.hideTyping();
      this.receiveMessage(user);
    }, replyDelay);
  }

  receiveMessage(user) {
    this.audioManager.playReceive();

    const time = this.formatTime(new Date());
    const { text, isHtml } = this.composeReply(user);
    this.appendMessage(user, time, text, Buddies.colorFor(user), { html: isHtml });
    this.recordMessage(user, { sender: user, text, time, html: isHtml });
    this.saveState();
  }

  /**
   * Pick the buddy's reply. After a few messages each online buddy shares a
   * real link once; otherwise they draw from a shuffled bag of filler so the
   * same line never repeats until the whole pool has been used.
   */
  composeReply(user) {
    const k = Buddies.key(user);
    const meta = this.state.meta;
    const link = Buddies.linkFor(user);

    if (link && !meta.delivered[k] && (meta.counters[k] || 0) >= this.thresholdFor(k)) {
      meta.delivered[k] = true;
      const site = ['Friendster', 'Myspace', 'Neopets'][Math.floor(Math.random() * 3)];
      const safeLink = Utils.escapeAttr(link);
      return {
        text: `ok real talk — moving off ${Utils.escapeHtml(site)}. find me here: <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${Utils.escapeHtml(link)}</a>`,
        isHtml: true,
      };
    }

    const pool = Buddies.fillerFor(user);
    let bag = meta.fillerBags[k];
    if (!Array.isArray(bag) || !bag.length) bag = meta.fillerBags[k] = this.shuffledIndexes(pool.length);
    let idx = bag.shift();
    if (pool.length > 1 && idx === meta.lastFillerIdx[k]) {
      bag.push(idx);
      idx = bag.shift();
    }
    meta.lastFillerIdx[k] = idx;
    return { text: pool[idx], isHtml: false };
  }

  thresholdFor(k) {
    if (this.state.meta.thresholds[k] == null) {
      this.state.meta.thresholds[k] = 3 + Math.floor(Math.random() * 3); // 3..5
    }
    return this.state.meta.thresholds[k];
  }

  bumpCounter(user) {
    const k = Buddies.key(user);
    this.thresholdFor(k);
    this.state.meta.counters[k] = (this.state.meta.counters[k] || 0) + 1;
  }

  appendMessage(sender, time, text, color, opts = {}) {
    const messages = document.getElementById('chatMessages');
    if (!messages) return;
    messages.appendChild(this.createMessageElement(sender, time, text, color, opts));
    messages.scrollTop = messages.scrollHeight;
  }

  createMessageElement(sender, time, text, color, opts = {}) {
    const el = document.createElement('div');
    el.className = 'message';

    const senderEl = document.createElement('span');
    senderEl.className = 'message-sender';
    senderEl.style.color = color;
    senderEl.textContent = `${sender}:`;

    const timeEl = document.createElement('span');
    timeEl.className = 'message-time';
    timeEl.textContent = `(${time})`;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'message-text';
    // Only replies this module builds itself are marked as HTML; anything the
    // user typed goes through textContent.
    if (opts.html) bodyEl.innerHTML = text;
    else bodyEl.textContent = text;

    el.append(senderEl, timeEl, bodyEl);
    return el;
  }

  // ---------- conversation switching ----------

  openChat(username, opts = {}) {
    const buddy = Buddies.find(username);
    const name = buddy ? buddy.name : username;
    if (!opts.restoreOnly) this.audioManager.playReceive();

    this.currentChatUser = name;
    this.state.currentUser = name;
    this.clearTimers();
    this.hideTyping();

    const color = Buddies.colorFor(name);
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText('chatWith', name);
    setText('chatToUser', name);
    this.applyBuddyTheme(color);
    this.markActiveBuddy(name);

    const messages = document.getElementById('chatMessages');
    if (messages) {
      messages.replaceChildren();
      let conv = this.state.conversations[name];
      if ((!conv || !conv.length) && !opts.restoreOnly) {
        conv = [{ sender: name, text: 'hey! whats going on?', time: this.formatTime(new Date()) }];
        this.state.conversations[name] = conv;
      }
      (conv || []).forEach((m) => {
        messages.appendChild(this.createMessageElement(
          m.sender,
          m.time || this.formatTime(new Date()),
          m.text,
          m.sender === 'You' ? YOU_COLOR : color,
          { html: !!m.html },
        ));
      });
      messages.scrollTop = messages.scrollHeight;
    }

    this.saveState();
    this.show();
  }

  markActiveBuddy(name) {
    document.querySelectorAll('.buddy-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.buddy === name);
      el.setAttribute('aria-current', el.dataset.buddy === name ? 'true' : 'false');
    });
  }

  applyBuddyTheme(color) {
    const win = document.querySelector('.chat-window');
    if (!win) return;
    const icon = win.querySelector('.title-bar-icon');
    if (icon) icon.style.background = color;
    const to = win.querySelector('#chatToUser');
    if (to) to.style.color = color;
  }

  // ---------- typing indicator ----------

  showTyping(username) {
    const messages = document.getElementById('chatMessages');
    if (!messages) return;
    if (!this.typingEl) {
      this.typingEl = document.createElement('div');
      this.typingEl.className = 'message typing';
      this.typingEl.id = 'chatTyping';
      this.typingEl.setAttribute('role', 'status');
    }
    this.typingEl.replaceChildren();
    const who = document.createElement('span');
    who.className = 'message-sender';
    who.style.color = Buddies.colorFor(username);
    who.textContent = `${username}:`;
    const body = document.createElement('div');
    body.innerHTML = '<em>is typing…</em>';
    this.typingEl.append(who, body);

    if (!this.typingEl.parentNode) messages.appendChild(this.typingEl);
    messages.scrollTop = messages.scrollHeight;
  }

  hideTyping() {
    if (this.typingEl?.parentNode) this.typingEl.parentNode.removeChild(this.typingEl);
  }

  clearTimers() {
    Object.keys(this.timers).forEach((k) => {
      if (this.timers[k]) { clearTimeout(this.timers[k]); this.timers[k] = null; }
    });
  }

  // ---------- window state ----------

  get isHidden() {
    const win = document.querySelector('.chat-window');
    return !win || win.classList.contains('window--hidden');
  }

  show() {
    ['.buddy-list', '.chat-window'].forEach((sel) => {
      document.querySelector(sel)?.classList.remove('window--hidden');
    });
    this.activate();
    if (window.taskbarManager && !window.taskbarManager.items.has(this.taskbarId)) this.registerTaskbar();
  }

  hide() {
    ['.buddy-list', '.chat-window'].forEach((sel) => {
      document.querySelector(sel)?.classList.add('window--hidden');
    });
    window.taskbarManager?.setActive(this.taskbarId, false);
    this.clearTimers();
    this.hideTyping();
  }

  close() {
    this.hide();
    window.taskbarManager?.remove(this.taskbarId);
  }

  toggleFromTaskbar() {
    if (this.isHidden) this.show(); else this.hide();
  }

  activate() {
    const win = document.querySelector('.chat-window');
    if (win) windowManager.bringToFront(win);
    window.taskbarManager?.setActive(this.taskbarId, true);
  }

  // ---------- persistence ----------

  recordMessage(username, message) {
    if (!this.state.conversations[username]) this.state.conversations[username] = [];
    this.state.conversations[username].push({
      sender: message.sender,
      text: message.text,
      time: message.time,
      html: !!message.html,
    });
  }

  loadState() {
    try {
      const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      this.state = {
        conversations: parsed.conversations || {},
        currentUser: parsed.currentUser || null,
        meta: {
          counters: {}, thresholds: {}, delivered: {}, fillerBags: {}, lastFillerIdx: {},
          ...(parsed.meta || {}),
        },
      };
    } catch (err) {
      console.warn('Oxford Messenger: could not restore chat state', err);
    }
  }

  saveState() {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) {
      console.warn('Oxford Messenger: could not save chat state', err);
    }
  }

  // ---------- helpers ----------

  shuffledIndexes(n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  formatTime(date) {
    const hours = date.getHours() % 12 || 12;
    const pad = (n) => String(n).padStart(2, '0');
    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
    return `${hours}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`;
  }
}

window.ChatManager = ChatManager;
