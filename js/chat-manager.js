// ============================================
// CHAT MANAGER MODULE
// Handles all chat/messaging functionality
// ============================================

class ChatManager {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.currentChatUser = null;
        this.autoReplyDelay = 2000;
        this.typingMinMs = 900; // minimum visible typing time
        this.typingShowDelayMs = 400; // delay before showing typing to avoid flicker
        this.typingTimeoutId = null;
        this.typingEl = null;
        this.typingForUserKey = null;
        this.typingShowTimerId = null;
        this.taskbarId = 'chat';
        this.taskbarEntry = null;
        this.storageKey = 'aim.chat.v1';
        this.state = { conversations: {}, currentUser: null, meta: { counters: {}, thresholds: {}, delivered: {}, lastFillerIdx: {}, fillerBags: {}, colors: {} } };
        
        this.responses = [
            'lol nice!',
            'yeah totally!',
            'omg really??',
            'brb mom calling',
            'a/s/l? jk jk',
            'check out my away message!',
            'cool cool',
            'haha for real',
            'ttyl gotta go',
            'sweet!'
        ];
        // Extra 90s-flavored commentary
        this.responses90s = [
            'hold up, dial-up is lagging 😅',
            "napster's taking forever to download this track",
            'just burned a mix CD lol',
            'be right back — feeding my Tamagotchi',
            'my AIM away msg is fire rn',
            'new Geocities page just dropped 💾',
            'ICQ went bloop bloop again 😂',
            'Y2K bug? more like Y2-ok',
            'BRB mom needs the phone line 😭',
            'this Winamp skin slaps'
        ];
        // Special users final-link response config
        // Map by lowercase keys for robust matching
        this.specialUsers = {
            'sepinator': 'https://www.linkedin.com/in/sepi-chakaveh/',
            'selvatron': 'https://www.linkedin.com/in/rrselvakumar/',
            'xmarktheneil99x': 'https://www.linkedin.com/in/mhneill/',
            'xmarktheneill99x': 'https://www.linkedin.com/in/mhneill/',
            'randobrando': 'https://www.linkedin.com/in/stracos/',
            'randobrandon': 'https://www.linkedin.com/in/stracos/'
        };

        // Per-buddy filler personality (normalized keys)
        this.buddyFiller = {
            'sepinator': [
                'my AIM away msg is fire rn',
                'zerg rush? kekeke',
                'LAN party later — bring your CRT',
                'installing Diablo II again lol',
                'BRB mom needs the phone line 😭',
                'custom Winamp skin looks so sick'
            ],
            'xmarktheneil99x': [
                'top 8 drama on Myspace again 😂',
                'new Geocities page — lots of iframes',
                'blink tag is a vibe',
                'switching my AIM font to Comic Sans',
                'Napster queue at 97%... for the last hour',
                'Winamp just “whips the llama’s…” you know the rest'
            ],
            'xmarktheneil99x': [
                'top 8 drama on Myspace again 😂',
                'new Geocities page — lots of iframes',
                'blink tag is a vibe',
                'switching my AIM font to Comic Sans',
                'Napster queue at 97%... for the last hour',
                'Winamp just “whips the llama’s…” you know the rest'
            ],
            'selvatron': [
                'writing a bot for mIRC channels',
                'charged my PalmPilot, stylus ready',
                'TI-83 graphing weird art again lol',
                'dot-com bubble memes are back',
                'ICQ number memorized like a phone #',
                'configuring RSS in my reader'
            ],
            'randobrando': [
                'AOL keywords still slap',
                'can’t stop hearing the dial-up tone',
                'tamagotchi survived the day, barely',
                'burning a new mix CD',
                '3.5” floppies for the win',
                'sharing pics on Photobucket like it’s 1999'
            ],
            'randobrandon': [
                'AOL keywords still slap',
                'can’t stop hearing the dial-up tone',
                'tamagotchi survived the day, barely',
                'burning a new mix CD',
                '3.5” floppies for the win',
                'sharing pics on Photobucket like it’s 1999'
            ]
        };
    }
    
    init() {
        // Set up message input event listener
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }

        // Make chat window draggable and wire controls
        const chatWindow = document.querySelector('.chat-window');
        if (chatWindow) {
            const titleBar = chatWindow.querySelector('.title-bar');
            if (titleBar) {
                windowManager.makeWindowDraggable(chatWindow, titleBar);
                const buttons = titleBar.querySelectorAll('.title-bar-btn');
                if (buttons && buttons.length >= 3) {
                    // Minimize
                    buttons[0].addEventListener('click', () => this.hide());
                    // Maximize (optional): bring to front
                    buttons[1].addEventListener('click', () => this.activate());
                    // Close -> fully close (remove taskbar entry)
                    buttons[2].addEventListener('click', () => this.close());
                }
            }
        }

        // Make buddy list draggable as well and wire its controls
        const buddyWindow = document.querySelector('.buddy-list');
        if (buddyWindow) {
            const titleBar = buddyWindow.querySelector('.title-bar');
            if (titleBar) {
                windowManager.makeWindowDraggable(buddyWindow, titleBar);
                const btns = Array.from(titleBar.querySelectorAll('.title-bar-btn'));
                const minBtn = titleBar.querySelector('.title-bar-btn[data-action="min"]') || btns[0];
                const closeBtn = titleBar.querySelector('.title-bar-btn[data-action="close"]') || btns[2];
                const maxBtn = titleBar.querySelector('.title-bar-btn[data-action="max"]') || btns[1];
                if (minBtn) minBtn.addEventListener('click', () => { buddyWindow.style.display = 'none'; });
                if (maxBtn) maxBtn.addEventListener('click', () => this.activate());
                if (closeBtn) closeBtn.addEventListener('click', () => this.close());
            }
        }

        // Register taskbar entry for Oxford Messenger (Chat)
        if (window.taskbarManager) {
            this.taskbarEntry = window.taskbarManager.addWindow(this.taskbarId, 'Oxford', {
                onToggle: () => this.toggleFromTaskbar(),
                iconClass: 'chat-icon'
            });
            const chatWindow = document.querySelector('.chat-window');
            const visible = chatWindow && getComputedStyle(chatWindow).display !== 'none';
            window.taskbarManager.setActive(this.taskbarId, !!visible);
        }

        // Load previous state (persisted per-session)
        this.loadState();
        if (!Object.keys(this.state.conversations).length) {
            this.seedFromDOM();
            this.saveState();
        }
        // Ensure per-buddy color mapping exists for this session
        this._ensureBuddyColors();
        const defaultUser = this.state.currentUser || (document.getElementById('chatWith')?.textContent || null);
        if (defaultUser) {
            this.openChat(defaultUser, { restoreOnly: true });
        }
    }
    
    sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Play send sound
        this.audioManager.playSend();
        
        const messagesDiv = document.getElementById('chatMessages');
        const now = new Date();
        const timeStr = this.formatTime(now);
        
        // Add user's message
        const messageDiv = this.createMessageElement('You', timeStr, message, '#0000ff');
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        input.value = '';
        
        // Persist
        if (this.currentChatUser) {
            this.appendToConversation(this.currentChatUser, { sender: 'You', text: message, time: timeStr });
            this.saveState();
        }
        
        // Increment per-user counter (based on user messages)
        try {
            const key = (this.currentChatUser || '').trim().toLowerCase();
            const meta = this.state.meta || (this.state.meta = { counters: {}, thresholds: {}, delivered: {}, last: {} });
            const counters = meta.counters || (meta.counters = {});
            const thresholds = meta.thresholds || (meta.thresholds = {});
            if (key) {
                if (thresholds[key] == null) thresholds[key] = 3 + Math.floor(Math.random() * 3); // 3..5
                counters[key] = (counters[key] || 0) + 1;
                this.saveState();
            }
        } catch (e) {}

        // Simulate response with typing indicator and delay
        const jitter = 500 + Math.floor(Math.random() * 800);
        // Ensure any previous typing indicator is cleared once user's message is posted
        this.hideTyping();
        this.scheduleBuddyReply(this.autoReplyDelay + jitter);
    }

    scheduleBuddyReply(totalDelayMs) {
        const username = (document.getElementById('chatWith')?.textContent || 'Friend');
        // Clear any pending timers
        if (this.typingTimeoutId) clearTimeout(this.typingTimeoutId);
        if (this.typingShowTimerId) clearTimeout(this.typingShowTimerId);
        // Compute reply delay with a natural-looking min time
        const randMin = 800 + Math.floor(Math.random() * 900); // 800..1700ms
        const replyDelay = Math.max(this.typingMinMs, Math.min((totalDelayMs | 0) - 100, randMin));
        // Only show typing if there is enough time before reply to avoid flicker
        const showDelay = Math.max(0, this.typingShowDelayMs | 0);
        const marginBeforeReply = 150; // ensure at least this much visible before reply
        if (replyDelay > showDelay + marginBeforeReply) {
            this.typingShowTimerId = setTimeout(() => {
                this.showTyping(username);
            }, showDelay);
        }
        this.typingTimeoutId = setTimeout(() => {
            this.hideTyping();
            this.receiveMessage();
        }, replyDelay);
    }

    receiveMessage() {
        // Safety: ensure typing indicator is gone in case of any race
        this.hideTyping();
        // Play receive sound
        this.audioManager.playReceive();
        
        const messagesDiv = document.getElementById('chatMessages');
        const now = new Date();
        const timeStr = this.formatTime(now);
        const chatWithElement = document.getElementById('chatWith');
        const username = chatWithElement ? chatWithElement.textContent : 'Friend';
        const key = (username || '').trim().toLowerCase();
        
        // Decide if we should deliver special 90s-link message
        const meta = this.state.meta || (this.state.meta = { counters: {}, thresholds: {}, delivered: {}, lastFillerIdx: {}, fillerBags: {} });
        const counters = meta.counters || (meta.counters = {});
        const thresholds = meta.thresholds || (meta.thresholds = {});
        const delivered = meta.delivered || (meta.delivered = {});
        const lastFillerIdx = meta.lastFillerIdx || (meta.lastFillerIdx = {});
        const fillerBags = meta.fillerBags || (meta.fillerBags = {});
        // Migrate any legacy keys to lowercase
        if (thresholds[username] != null && thresholds[key] == null) { thresholds[key] = thresholds[username]; delete thresholds[username]; }
        if (counters[username] != null && counters[key] == null) { counters[key] = counters[username]; delete counters[username]; }
        if (delivered[username] != null && delivered[key] == null) { delivered[key] = delivered[username]; delete delivered[username]; }

        if (thresholds[key] == null) {
            thresholds[key] = 3 + Math.floor(Math.random() * 3); // 3..5
        }
        if (counters[key] == null) counters[key] = 0;

        let replyText;
        let replyIsHtml = false;
        if (!delivered[key] && this.specialUsers[key] && counters[key] >= thresholds[key]) {
            const sites = ['Friendster', 'Myspace', 'Neopets'];
            const site = sites[Math.floor(Math.random() * sites.length)];
            const link = this.specialUsers[key];
            // Safe anchoring for known URLs only
            const safeHref = this.escapeHtml(link);
            replyText = `ok real talk — moving off ${this.escapeHtml(site)}. find me here: <a href="${safeHref}" target="_blank" rel="noopener">${safeHref}</a>`;
            replyIsHtml = true;
            delivered[key] = true;
        } else {
            // Random 90s filler with base responses, per-buddy personality preference
            const defaultPool = this.responses90s.concat(this.responses);
            const pool = (this.buddyFiller[key] && this.buddyFiller[key].length ? this.buddyFiller[key] : defaultPool);
            // Build or refill a shuffled bag of indexes for this user
            if (!Array.isArray(fillerBags[key]) || fillerBags[key].length === 0) {
                fillerBags[key] = this._shuffledIndexes(pool.length);
            }
            let idx = fillerBags[key].shift();
            // As a safety, avoid repeating the very last reply
            if (pool.length > 1 && idx === lastFillerIdx[key]) {
                // take next, push this one back
                fillerBags[key].push(idx);
                idx = fillerBags[key].shift();
            }
            lastFillerIdx[key] = idx;
            replyText = pool[idx];
            // Do NOT increment counters here; counters represent user-sent messages only
        }

        // Add buddy's message (use buddy color)
        const buddyColor = this._buddyColor(key);
        const responseDiv = this.createMessageElement(username, timeStr, replyText, buddyColor, { html: replyIsHtml });
        messagesDiv.appendChild(responseDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        // Persist
        if (this.currentChatUser) {
            this.appendToConversation(this.currentChatUser, { sender: username, text: replyText, time: timeStr, html: replyIsHtml });
            this.saveState();
        }
    }
    
    createMessageElement(sender, time, text, color, opts = {}) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        const safeSender = this.escapeHtml(sender);
        const timeHtml = this.escapeHtml(time);
        const contentHtml = opts.html ? text : this.escapeHtml(text);
        messageDiv.innerHTML = `
            <span class="message-sender" style="color: ${color};">${safeSender}:</span>
            <span class="message-time">(${timeHtml})</span>
            <div>${contentHtml}</div>
        `;
        return messageDiv;
    }
    
    openChat(username, opts = {}) {
        // Play signin sound (using receive sound for now)
        if (!opts.restoreOnly) this.audioManager.playReceive();

        this.currentChatUser = username;
        this.state.currentUser = username;

        // Clear any pending typing indicator when switching
        this.hideTyping();
        
        const chatWithElement = document.getElementById('chatWith');
        const chatToUserElement = document.getElementById('chatToUser');
        
        if (chatWithElement) chatWithElement.textContent = username;
        if (chatToUserElement) chatToUserElement.textContent = username;

        // Apply buddy theme (title icon + header name color)
        this.applyBuddyTheme(username);
        
        const messagesDiv = document.getElementById('chatMessages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            const conv = this.state.conversations[username];
            if (conv && conv.length) {
                const buddyKey = (username || '').trim().toLowerCase();
                const buddyColor = this._buddyColor(buddyKey);
                conv.forEach(m => {
                    const color = m.sender === 'You' ? '#0000ff' : buddyColor;
                    const msgEl = this.createMessageElement(m.sender, m.time || this.formatTime(new Date()), m.text, color, { html: !!m.html });
                    messagesDiv.appendChild(msgEl);
                });
            } else if (!opts.restoreOnly) {
                const now = new Date();
                const timeStr = this.formatTime(now);
                const welcome = { sender: username, text: 'hey! whats going on?', time: timeStr };
                this.state.conversations[username] = [welcome];
                const buddyKey = (username || '').trim().toLowerCase();
                const buddyColor = this._buddyColor(buddyKey);
                const welcomeMsg = this.createMessageElement(username, timeStr, welcome.text, buddyColor);
                messagesDiv.appendChild(welcomeMsg);
                this.saveState();
            }
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        this.saveState();

        // Ensure chat windows are visible and activated
        this.show();
    }

    show() {
        const chatWindow = document.querySelector('.chat-window');
        const buddyWindow = document.querySelector('.buddy-list');
        if (buddyWindow) buddyWindow.style.display = 'block';
        if (chatWindow) {
            chatWindow.style.display = 'block';
            this.activate();
        }
        if (!this.taskbarEntry && window.taskbarManager) {
            this.taskbarEntry = window.taskbarManager.addWindow(this.taskbarId, 'Oxford', {
                onToggle: () => this.toggleFromTaskbar(),
                iconClass: 'chat-icon'
            });
        }
    }

    hide() {
        const chatWindow = document.querySelector('.chat-window');
        const buddyWindow = document.querySelector('.buddy-list');
        if (buddyWindow) buddyWindow.style.display = 'none';
        if (chatWindow) chatWindow.style.display = 'none';
        if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, false);
        this.hideTyping();
    }

    close() {
        this.hide();
        if (window.taskbarManager) window.taskbarManager.remove(this.taskbarId);
        this.taskbarEntry = null;
    }

    toggleFromTaskbar() {
        const chatWindow = document.querySelector('.chat-window');
        if (!chatWindow) return;
        const hidden = chatWindow.style.display === 'none';
        if (hidden) this.show(); else this.hide();
    }

    activate() {
        const chatWindow = document.querySelector('.chat-window');
        if (!chatWindow) return;
        chatWindow.style.zIndex = ++windowManager.zIndexCounter;
        if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, true);
    }
    
    formatTime(date) {
        const hours = date.getHours() % 12 || 12;
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
        return `${hours}:${minutes}:${seconds} ${ampm}`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // -------- Persistence helpers --------
    loadState() {
        try {
            const raw = sessionStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                this.state = Object.assign({ conversations: {}, currentUser: null }, parsed);
            }
        } catch (e) {
            console.warn('AIM: failed to load chat state', e);
        }
    }

    saveState() {
        try {
            sessionStorage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (e) {
            console.warn('AIM: failed to save chat state', e);
        }
    }

    appendToConversation(username, message) {
        if (!this.state.conversations[username]) this.state.conversations[username] = [];
        this.state.conversations[username].push({
            sender: message.sender,
            text: message.text,
            time: message.time,
            html: !!message.html
        });
    }

    seedFromDOM() {
        try {
            const user = document.getElementById('chatWith')?.textContent || null;
            if (!user) return;
            const messages = [];
            document.querySelectorAll('#chatMessages .message').forEach(el => {
                const senderRaw = el.querySelector('.message-sender')?.textContent || '';
                const sender = senderRaw.replace(/:\s*$/, '').trim();
                const time = el.querySelector('.message-time')?.textContent?.replace(/[()]/g, '').trim() || '';
                const text = el.querySelector('div')?.textContent || '';
                messages.push({ sender, time, text });
            });
            if (messages.length) {
                this.state.conversations[user] = messages;
                this.state.currentUser = user;
            }
        } catch (e) {
            console.warn('AIM: failed to seed chat state from DOM', e);
        }
    }
    
    
    // ---- helpers ----
    _shuffledIndexes(n) {
        const arr = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    showTyping(username) {
        const messagesDiv = document.getElementById('chatMessages');
        if (!messagesDiv) return;
        if (!this.typingEl) {
            const el = document.createElement('div');
            el.className = 'message typing';
            el.id = 'chatTyping';
            this.typingEl = el;
        }
        const safeUser = this.escapeHtml(username || 'Friend');
        this.typingEl.innerHTML = `
            <span class="message-sender" style="color: #ff0000;">${safeUser}:</span>
            <span class="message-time">(typing)</span>
            <div><em>is typing…</em></div>
        `;
        if (!this.typingEl.parentNode) messagesDiv.appendChild(this.typingEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        // Reflect typing in buddy list
        const key = (username || '').trim().toLowerCase();
        this.typingForUserKey = key;
        this.setBuddyTyping(key, true);
    }

    hideTyping() {
        if (this.typingTimeoutId) {
            clearTimeout(this.typingTimeoutId);
            this.typingTimeoutId = null;
        }
        if (this.typingShowTimerId) {
            clearTimeout(this.typingShowTimerId);
            this.typingShowTimerId = null;
        }
        if (this.typingEl && this.typingEl.parentNode) {
            this.typingEl.parentNode.removeChild(this.typingEl);
        }
        if (this.typingForUserKey) {
            this.setBuddyTyping(this.typingForUserKey, false);
            this.typingForUserKey = null;
        }
    }

    setBuddyTyping(userKeyLower, active) {
        // Per request: do not show typing UI in the buddy list at all.
        // If any prior indicator exists (from older sessions), remove it.
        try {
            const items = document.querySelectorAll('.buddy-list .buddy-item');
            items.forEach(el => {
                const label = (el.textContent || '').trim().toLowerCase();
                if (label === userKeyLower) {
                    const wrap = el.querySelector('.typing-wrap');
                    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
                }
            });
        } catch (e) {}
    }

    _buddyColor(key) {
        const meta = this.state.meta || (this.state.meta = {});
        const colors = meta.colors || (meta.colors = {});
        // unify aliases
        const unifiedKey = (key === 'xmarktheneill99x') ? 'xmarktheneil99x' : (key === 'randobrandon' ? 'randobrando' : key);
        return colors[unifiedKey] || '#0000ff';
    }

    _ensureBuddyColors() {
        const meta = this.state.meta || (this.state.meta = {});
        const colors = meta.colors || (meta.colors = {});
        // Known normalized buddy keys (unified)
        const keys = ['sepinator', 'xmarktheneil99x', 'selvatron', 'randobrando'];
        const palette = ['#d00000', '#0040c0', '#008000', '#800080', '#c06000', '#008080'];
        // Assign if missing
        const used = new Set(Object.values(colors));
        let pi = 0;
        keys.forEach(k => {
            if (!colors[k]) {
                // pick next unused palette color
                while (pi < palette.length && used.has(palette[pi])) pi++;
                const col = palette[pi % palette.length];
                colors[k] = col;
                used.add(col);
            }
        });
        // Mirror aliases to same color
        colors['xmarktheneill99x'] = colors['xmarktheneil99x'];
        colors['randobrandon'] = colors['randobrando'];
        this.saveState();
    }

    applyBuddyTheme(username) {
        const key = (username || '').trim().toLowerCase();
        const color = this._buddyColor(key);
        try {
            const chatWin = document.querySelector('.chat-window');
            if (chatWin) {
                const icon = chatWin.querySelector('.title-bar .title-bar-icon');
                if (icon) icon.style.background = color;
                const toEl = chatWin.querySelector('#chatToUser');
                if (toEl) toEl.style.color = color;
            }
        } catch (e) { /* ignore */ }
    }
}

// Create global instance (will be initialized in main.js)
let chatManager = null;
