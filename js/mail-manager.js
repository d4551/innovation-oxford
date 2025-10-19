// ============================================
// OXFORD MAIL (AOL Mail–style) MODULE
// Win95-style mail window with Inbox + reader
// ============================================

const MAIL_COLUMNS = [
  { key: 'from', label: 'From' },
  { key: 'subject', label: 'Subject' },
  { key: 'date', label: 'Date' }
];
const MAIL_DEFAULT_LIST_RATIO = 0.42;

class MailManager {
  constructor() {
    this.windowEl = null;
    this.bodyEl = null;
    this.listEl = null;
    this.readerEl = null;
    this.taskbarId = 'mail';
    this.taskbarEntry = null;
    this.currentFolder = 'Inbox';
    this.currentId = null;
    this.storageKey = 'oxmail.state.v1';
    this.previewOff = false;
  this.listRatio = MAIL_DEFAULT_LIST_RATIO;
    this.sortKey = 'date';
    this.sortDir = 'desc';

    // Seeded retro messages
    this.messages = [
      {
        id: 'nintendo-virtualboy',
        from: 'Nintendo <power@club.nintendo.com>',
        subject: 'SEE RED: Step into 3‑D with Virtual Boy™',
        date: 'Aug 14, 1995 9:13 AM',
        preview: 'Hot new 3‑D tech from Nintendo Power…',
        html: this.renderNintendoAd(),
        read: false
      },
      {
        id: 'pepsi-stuff',
        from: 'Pepsi <points@pepsistuff.com>',
        subject: 'PEPSI STUFF: Pop the top. Score the gear.',
        date: 'May 02, 1998 7:41 PM',
        preview: 'Caps = Points = Jackets, CDs, and more…',
        html: this.buildAd({
          banner: 'POP • POINTS • PRIZES',
          head: 'PEPSI STUFF',
          sub: 'Pop the top. Score the gear.',
          body: '<p>Grab a cold Pepsi, pop the cap, and rack up <strong>Points</strong>. Trade \u2019em for hot swag\u2014starter jackets, Discman\u00AE players, and limited‑edition CDs.</p><p>Hop online with your trusty 56k and punch in your codes. Boom. Gear on the way.</p>',
          bullets: ['Caps = Points = Stuff', 'Exclusive tour tees + CD samplers', 'Mail‑in or online redemption'],
          cta: 'Claim Your Stuff',
          fine: 'While supplies last. Internet access may be required. Ask permission before surfing.'
        }),
        read: false
      },
      {
        id: 'columbia-house',
        from: 'Columbia House <club@columbiahouse.com>',
        subject: '12 CDs for 1¢. No kidding.',
        date: 'Mar 03, 1997 5:19 PM',
        preview: 'Stuff your binder. Pay basically nothing today…',
        html: this.buildAd({
          banner: 'MAILBOX BOOMBOX',
          head: '12 CDs FOR 1\u00A2',
          sub: 'Stuff your binder. Pay basically nothing today.',
          body: '<p>Pick <strong>12 CDs</strong> for just <strong>1\u00A2</strong>. Smash Mouth? Oasis? Alanis? We got \u2019em.</p><p>Choose now, pay later. It\u2019s like your mixtape made itself.</p>',
          bullets: ['No kidding — twelve', 'Chart bangers included', 'Ships to your door'],
          cta: 'Join the Club',
          fine: 'Membership terms apply. Postage not included.'
        }),
        read: false
      },
      {
        id: 'tamagotchi',
        from: 'Bandai <hatch@tamagotchi.jp>',
        subject: 'Tamagotchi: The pocket pal that needs YOU',
        date: 'Nov 22, 1997 11:06 AM',
        preview: 'Feed it. Clean it. Love it. Repeat…',
        html: this.buildAd({
          banner: 'POCKET PIXELS',
          head: 'TAMAGOTCHI',
          sub: 'The pocket pal that needs YOU',
          body: '<p>Your backpack just got busier. <strong>Tamagotchi</strong> lives for your attention\u2014feed snacks between classes, scoop pixels (ew!), and keep the beeps happy.</p><p>Clip it, flaunt it, bond with it. Friends don\u2019t let friends go low‑battery.</p>',
          bullets: ['Snacks, play, sleep cycles', 'Keychain clip flaunt factor', 'Beep notifications so you never forget'],
          cta: 'Adopt One'
        }),
        read: false
      },
      {
        id: 'blockbuster',
        from: 'Blockbuster Video <bignight@blockbuster.com>',
        subject: 'Make it a Blockbuster night.',
        date: 'Jan 09, 1999 8:02 PM',
        preview: '2‑day rentals, fresh popcorn, rewind kindly…',
        html: this.buildAd({
          banner: 'FRIDAY NIGHT = MOVIE NIGHT',
          head: 'BLOCKBUSTER VIDEO',
          sub: 'Make it a Blockbuster night.',
          body: '<p>Grab a membership card and cruise the aisles. Pick up <em>Hot Tamales</em>, snag a VHS, and remember—<strong>Be Kind, Rewind</strong>.</p><p>Pro tip: Reserve early to beat the Friday rush.</p>',
          bullets: ['2‑day rentals', 'New releases weekly', 'Late fee reminder (uh oh)'],
          cta: 'Rent Tonight'
        }),
        read: false
      },
      {
        id: 'chatpal-95',
        from: 'FutureWare <hello@futureware.com>',
        subject: 'ChatPal 95: Your floppy‑disk AI buddy',
        date: 'Jun 07, 1996 4:12 PM',
        preview: 'Talk to your PC like it’s your pal…',
        html: this.buildAd({
          banner: 'FUTUREWARE PRESENTS',
          head: 'CHATPAL 95',
          sub: 'Artificial Conversation. Real Fun.',
          body: 'Slip the <strong>1.44MB</strong> disk in and say hello to your PC\u2019s new best friend. Type a question, get a wisecrack.',
          bullets: ['Runs on 486 (Pentium screams!)', 'Offline chat — save those minutes', 'Personalities: Skater Dude to Study Buddy'],
          cta: 'Install from Floppy'
        }),
        read: false
      },
      {
        id: 'robohelper-2000',
        from: 'RoboCo <beep@roboco.com>',
        subject: 'RoboHelper 2000: Your rolling desktop assistant',
        date: 'Sep 18, 1999 10:28 AM',
        preview: 'Wheels. Sensors. Attitude. Coffee compatible…',
        html: this.buildAd({
          banner: 'ROBOCO // NEXT‑GEN HOME HELP',
          head: 'ROBOHELPER 2000',
          sub: 'Because chores are so last century.',
          body: 'Your new motorized buddy patrols hallways, carries snacks, and beeps on command. Infrared sensors avoid socks and cats.',
          bullets: ['Auto‑dock charging', 'Clap‑to‑start voice trigger', 'Serial cable updates (futuristic!)'],
          cta: 'Roll Out'
        }),
        read: false
      },
      {
        id: 'neurotoast',
        from: 'NeuroToast Labs <hot@neurotoast.com>',
        subject: 'NeuroToast 2K: A neural network for your breakfast',
        date: 'Feb 11, 1999 6:59 AM',
        preview: 'Smarter toast via patented N.E.U.R.O. LOAF™ tech…',
        html: this.buildAd({
          banner: 'BREAKFAST // UPGRADED',
          head: 'NEUROTOAST 2K',
          sub: 'Deep‑crisp technology for perfect browns.',
          body: 'Our countertop neural net learns your crunch curve. From lightly golden to XTREME CRISP, it remembers your vibe.',
          bullets: ['Serial‑port firmware (9‑pin included)', 'Bagel Mode: edge intensity control', 'Auto‑pop victory chime'],
          cta: 'Get Toast Smart'
        }),
        read: false
      }
    ];
    this.sent = [];
  }

  // Build the mail window
  open() {
    if (this.windowEl) { this.windowEl.style.display = 'block'; this.activate(); return this.windowEl; }

    // Compute a landscape-oriented size and center it
    const vw = Math.max(800, window.innerWidth || 1024);
    const vh = Math.max(600, window.innerHeight || 768);
    const widthPx = Math.min(vw - 40, 980); // cap wider but fit viewport
    const heightPx = Math.min(vh - 80, 600); // landscape by default
    const leftPx = Math.max(8, Math.floor((vw - widthPx) / 2));
    const topPx = Math.max(28, Math.floor((vh - heightPx - 28) / 2));

    const shell = windowManager.createWindowShell({
      title: 'Oxford Mail', className: 'mail-window',
      width: `${widthPx}px`, height: `${heightPx}px`, top: `${topPx}px`, left: `${leftPx}px`,
      controls: { minimize: true, maximize: true, close: true }
    });
    this.windowEl = shell.windowEl; this.bodyEl = shell.body;

    // Layout
    const listHeaderHtml = MAIL_COLUMNS.map(col => `<div class="sortable" data-key="${col.key}">${col.label}</div>`).join('');
    const readerHeaderHtml = MAIL_COLUMNS.map(col => `<div class="hdr-row"><span class="lbl">${col.label}:</span> <span class="val" data-hdr="${col.key}"></span></div>`).join('');

    this.bodyEl.innerHTML = `
      <div class="mail-toolbar">
        <div class="actions">
          <button class="btn-95 btn-refresh" title="Refresh inbox">Refresh</button>
          <button class="btn-95 btn-compose" title="Write a new message">Compose</button>
          <button class="btn-95 btn-reply" title="Reply to selected">Reply</button>
          <button class="btn-95 btn-delete" title="Delete selected">Delete</button>
          <button class="btn-95 btn-mark" title="Mark read/unread">Mark Read</button>
          <button class="btn-95 btn-preview" title="Toggle preview pane" aria-pressed="false">Preview Pane</button>
        </div>
        <div class="folders-inline mail-folders">
          <div class="folder-item active" data-folder="Inbox">Inbox</div>
          <div class="folder-item" data-folder="Sent">Sent</div>
        </div>
        <span class="mail-status" aria-live="polite"></span>
      </div>
      <div class="mail-layout">
        <div class="mail-right">
          <div class="mail-list-header mail-columns">${listHeaderHtml}</div>
          <div class="mail-list mail-scrollable" role="listbox" aria-label="Message list" tabindex="0"></div>
          <div class="mail-resizer" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize"></div>
          <div class="mail-reader">
            <div class="mail-reader-header">${readerHeaderHtml}</div>
            <div class="mail-reader-body mail-scrollable" tabindex="0"></div>
          </div>
        </div>
      </div>
    `;

    this.listEl = this.bodyEl.querySelector('.mail-list');
    this.readerEl = this.bodyEl.querySelector('.mail-reader-body');
    this.bodyEl.querySelector('.btn-refresh')?.addEventListener('click', () => this.handleRefresh());
    this.bodyEl.querySelector('.btn-compose')?.addEventListener('click', () => this.openCompose());
    this.bodyEl.querySelector('.btn-reply')?.addEventListener('click', () => this.handleReply());
    this.bodyEl.querySelector('.btn-delete')?.addEventListener('click', () => this.handleDelete());
    this.bodyEl.querySelector('.btn-mark')?.addEventListener('click', () => this.toggleRead());
    this.bodyEl.querySelector('.btn-preview')?.addEventListener('click', () => this.togglePreview());
    // Sorting
    const header = this.bodyEl.querySelector('.mail-list-header');
    if (header) {
      header.addEventListener('click', (e) => {
        const cell = e.target.closest('.sortable');
        if (!cell) return;
        const key = cell.getAttribute('data-key');
        this.toggleSort(key);
      });
    }
    // Resizer setup (horizontal)
  this.setupResizer();
    // Folder switching
    const folders = this.bodyEl.querySelector('.mail-folders');
    if (folders) {
      folders.addEventListener('click', (e) => {
        const item = e.target.closest('.folder-item');
        if (!item) return;
        this.currentFolder = item.dataset.folder || 'Inbox';
        folders.querySelectorAll('.folder-item').forEach(el => el.classList.toggle('active', el === item));
        this.renderList();
        if (!this.getActiveList().length && this.readerEl) this.readerEl.innerHTML = '';
        this.saveState();
      });
    }

    // Title bar controls
    const [minBtn, maxBtn, closeBtn] = shell.titleBar.querySelectorAll('.title-bar-btn');
    if (minBtn) minBtn.addEventListener('click', () => this.minimize());
    if (maxBtn) maxBtn.addEventListener('click', () => this.toggleMaximize());
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Load saved state, fill list, open first
  this.loadState();
  this.applyLayoutFromState();
    // reflect saved active folder in UI
    this.bodyEl.querySelectorAll('.folder-item').forEach(el => el.classList.toggle('active', el.dataset.folder === this.currentFolder));
    this.renderList();
    this.updateHeaderSortIndicators();
    if (this.getActiveList().length) this.openMessage(this.getActiveList()[0].id);
    this.updateFolderBadges();

    // Taskbar entry
    if (window.taskbarManager) {
      this.taskbarEntry = window.taskbarManager.addWindow(this.taskbarId, 'Oxford Mail', {
        onToggle: () => this.toggleFromTaskbar(), iconClass: 'mail-icon'
      });
    }

    // Activate and play sounds (DRY-safe access)
    this.activate();
    this.playMailSound();

    return this.windowEl;
  }

  renderList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    this.getSortedActiveList().forEach((m) => {
      const item = document.createElement('div');
      item.className = 'mail-list-item mail-columns' + (m.read ? '' : ' unread');
      item.setAttribute('role', 'option');
      item.setAttribute('tabindex', '0');
      item.dataset.id = m.id;
      item.innerHTML = MAIL_COLUMNS.map(col => {
        const raw = m[col.key];
        const value = this.escape(raw == null ? '' : String(raw));
        return `<div class="${col.key}">${value}</div>`;
      }).join('');
      const open = () => this.openMessage(m.id);
      item.addEventListener('click', open);
      item.addEventListener('dblclick', open);
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      this.listEl.appendChild(item);
    });
    this.updateFolderBadges();
    this.updateMarkButton();
    // Keyboard navigation
    this.listEl.onkeydown = (e) => {
      const items = Array.from(this.listEl.querySelectorAll('.mail-list-item'));
      if (!items.length) return;
      const active = this.listEl.querySelector('.mail-list-item.active');
      let idx = active ? items.indexOf(active) : -1;
      if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); this.openMessage(items[idx].dataset.id); e.preventDefault(); }
      if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); this.openMessage(items[idx].dataset.id); e.preventDefault(); }
    };
  }

  setupResizer() {
    const right = this.bodyEl?.querySelector('.mail-right');
    const resizer = this.bodyEl?.querySelector('.mail-resizer');
    if (!right || !resizer) return;
    const applyRatio = (r) => {
      this.listRatio = Math.max(0.2, Math.min(0.8, r));
      right.style.setProperty('--mail-list-w', `${Math.round(this.listRatio * 100)}%`);
    };
  let dragging = false; let startX = 0; let startW = 0; let rightW = 0;
    const onMove = (e) => {
      if (!dragging) return; e.preventDefault();
      const dx = e.clientX - startX;
      const minList = 140; const minReader = 240;
      const maxList = Math.max(minList, rightW - minReader);
      const newWpx = Math.max(minList, Math.min(maxList, startW + dx));
      applyRatio(newWpx / rightW);
    };
    const onUp = () => { if (!dragging) return; dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); this.saveState(); };
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
  const rect = right.getBoundingClientRect();
  rightW = rect.width;
      const list = this.bodyEl.querySelector('.mail-list');
      startW = list.getBoundingClientRect().width; startX = e.clientX; dragging = true;
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
    });
    // Keyboard adjust (Left/Right)
    resizer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const delta = (e.key === 'ArrowLeft' ? -0.05 : 0.05);
        applyRatio(this.listRatio + delta);
        this.saveState();
        e.preventDefault();
      }
    });
  }

  togglePreview() {
    this.previewOff = !this.previewOff;
    this.applyLayoutFromState();
    this.saveState();
  }

  applyLayoutFromState() {
    const right = this.bodyEl?.querySelector('.mail-right');
    const previewBtn = this.bodyEl?.querySelector('.btn-preview');
    if (right) {
      const ratio = (typeof this.listRatio === 'number' && Number.isFinite(this.listRatio)) ? this.listRatio : MAIL_DEFAULT_LIST_RATIO;
      const clamped = Math.max(0.2, Math.min(0.8, ratio));
      if (clamped !== this.listRatio) this.listRatio = clamped;
      const percent = (clamped * 100).toFixed(1).replace(/\.0$/, '');
      right.style.setProperty('--mail-list-w', `${percent}%`);
      right.classList.toggle('preview-off', !!this.previewOff);
      right.dataset.preview = this.previewOff ? 'off' : 'on';
    }
    if (previewBtn) previewBtn.setAttribute('aria-pressed', this.previewOff ? 'true' : 'false');
  }

  openMessage(id) {
    const msg = this.getActiveList().find(m => m.id === id); if (!msg) return;
    this.listEl?.querySelectorAll('.mail-list-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));
    const setHdr = (k, v) => { const el = this.bodyEl?.querySelector(`[data-hdr="${k}"]`); if (el) el.textContent = v; };
    setHdr('from', msg.from); setHdr('subject', msg.subject); setHdr('date', msg.date);
    // Ensure reader reference and load content with a safe fallback
    if (!this.readerEl && this.bodyEl) this.readerEl = this.bodyEl.querySelector('.mail-reader-body');
    if (this.readerEl) {
      const html = (msg && typeof msg.html === 'string' && msg.html.trim().length)
        ? msg.html
        : this.buildAd({
            banner: 'MESSAGE',
            head: msg.subject || '(no subject)',
            sub: `From: ${this.escapeInline(msg.from || 'unknown')}`,
            body: (msg.preview ? `<p>${this.escapeInline(msg.preview)}</p>` : '<p>(No content)</p>')
          });
      this.readerEl.innerHTML = html;
      this.readerEl.scrollTop = 0;
    }
    this.currentId = id;
    if (!msg.read) {
      msg.read = true;
      const row = this.listEl?.querySelector(`.mail-list-item[data-id="${id}"]`);
      if (row) row.classList.remove('unread');
      this.updateFolderBadges();
      this.updateMarkButton();
    }
    this.saveState();
  }

  // Sorting helpers
  toggleSort(key) {
    if (!key || !MAIL_COLUMNS.some(col => col.key === key)) return;
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = key === 'date' ? 'desc' : 'asc';
    }
    this.updateHeaderSortIndicators();
    this.renderList();
    this.saveState();
  }

  updateHeaderSortIndicators() {
    const header = this.bodyEl?.querySelector('.mail-list-header');
    if (!header) return;
    header.querySelectorAll('.sortable').forEach(el => {
      el.classList.remove('sorted-asc', 'sorted-desc');
      const k = el.getAttribute('data-key');
      if (k === this.sortKey) el.classList.add(this.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    });
  }

  getSortedActiveList() {
    const arr = this.getActiveList().slice();
    const key = this.sortKey || 'date';
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const toMs = (m) => {
      if (m.dateMs) return m.dateMs;
      const t = Date.parse(m.date || '');
      return isNaN(t) ? 0 : t;
    };
    const val = (m) => {
      if (key === 'from') return (m.from || '').toLowerCase();
      if (key === 'subject') return (m.subject || '').toLowerCase();
      if (key === 'date') return toMs(m);
      return (m.subject || '').toLowerCase();
    };
    arr.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }

  // Nintendo ad block with proper scaling and 90s voice
  renderNintendoAd() {
    return `
      <div class="retro-ad vboy">
        <div class="ad-banner">NINTENDO POWER ALERT</div>
        <div class="ad-body">
          <h1 class="ad-head">SEE RED. FEEL 3‑D. GET HYPED.</h1>
          <h2 class="ad-sub">Introducing the <span class="ad-mark">VIRTUAL BOY™</span></h2>
          <p>Strap in, hotshot. This is stereoscopic, stand‑up, head‑spinning <strong>3‑D</strong> from the crew that brought you pure fun in cartridge form. No glasses. No mercy. Just radical depth that jumps like a skateboard off a handrail.</p>
          <ul class="ad-bullets">
            <li>Turbo‑charged red visuals that POP</li>
            <li>Plug‑and‑play setup—drop in, zone out</li>
            <li>Exclusive launch titles built for 3‑D speed</li>
          </ul>
          <div class="ad-hero">
            <img class="ad-hero-img retro-asset" src="media/virtualboy.png" width="360" loading="lazy" decoding="async" alt="Nintendo Virtual Boy console on stand with controller" />
          </div>
          <p class="ad-copy">Power up. Dial your senses to eleven. <em>Virtual Boy</em> doesn’t just play games— it <strong>warps reality</strong>. Are you game enough?</p>
          <div class="ad-cta">Power Up Today</div>
          <p class="ad-fine">Availability varies by region. Take breaks and play responsibly.</p>
        </div>
      </div>
    `;
  }

  // DRY builder for retro ad markup
  buildAd({ banner, head, sub, body, bullets = [], heroSrc, heroAlt, cta, fine }) {
    const bulletsHtml = bullets && bullets.length ? `<ul class="ad-bullets">${bullets.map(b => `<li>${this.escapeInline(b)}</li>`).join('')}</ul>` : '';
    const heroHtml = heroSrc ? `<div class="ad-hero"><img class="ad-hero-img" src="${this.escapeAttr(heroSrc)}" alt="${this.escapeAttr(heroAlt || '')}"></div>` : '';
    const bodyHtml = body ? (body.startsWith('<') ? body : `<p>${this.escapeInline(body)}</p>`) : '';
    const ctaHtml = cta ? `<div class="ad-cta">${this.escapeInline(cta)}</div>` : '';
    const fineHtml = fine ? `<p class="ad-fine">${this.escapeInline(fine)}</p>` : '';
    return `
      <div class="retro-ad">
        ${banner ? `<div class="ad-banner">${this.escapeInline(banner)}</div>` : ''}
        <div class="ad-body">
          ${head ? `<h1 class="ad-head">${this.escapeInline(head)}</h1>` : ''}
          ${sub ? `<h2 class="ad-sub">${this.escapeInline(sub)}</h2>` : ''}
          ${bodyHtml}
          ${bulletsHtml}
          ${heroHtml}
          ${ctaHtml}
          ${fineHtml}
        </div>
      </div>
    `;
  }

  // Utility helpers
  getActiveList() { return this.currentFolder === 'Sent' ? this.sent : this.messages; }
  playMailSound() {
    try {
      const am = (typeof audioManager !== 'undefined') ? audioManager : (window.audioManager || null);
      if (am && !am.initialized && am.init) am.init();
      if (am && am.playGotMail) am.playGotMail();
      setTimeout(() => { try { am && am.playAlert && am.playAlert(); } catch (e) {} }, 180);
    } catch (e) {}
  }

  // Simulate server refresh: add 0–3 new messages
  handleRefresh() {
    this.setStatus('Checking for new mail...');
    const delay = 600 + Math.floor(Math.random() * 700);
    setTimeout(() => {
      const n = Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.messages.unshift(this.generateRandomAd());
      this.renderList();
      if (n > 0) {
        this.openMessage(this.messages[0].id);
        this.playMailSound();
        this.setStatus(`${n} new message${n === 1 ? '' : 's'}.`, 1800);
        this.showToast(`${n} new message${n === 1 ? '' : 's'}`);
      } else {
        this.setStatus('No new messages.', 1200);
      }
    }, delay);
  }

  // Random ad generator using the same DRY builder
  generateRandomAd() {
    const now = new Date();
    const datestr = now.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const templates = [
      () => ({
        from: 'CyberPet Labs <bark@cyberpet.net>',
        subject: 'CyberPet Deluxe: Your screen‑tamed dino',
        html: this.buildAd({
          banner: 'EXTREME DIGITAL PETS', head: 'CYBERPET DELUXE', sub: 'Bite‑size pixels. Big personality.',
          body: 'Hatch a raptor, feed it byte‑snacks, and show it off on the bus. Now with Night Mode and Sticker Sheet 2.0.',
          bullets: ['Infrared pet meetups', 'Secret code mini‑games', 'Comes with belt clip'], cta: 'Hatch One'
        })
      }),
      () => ({
        from: 'AOL Keyword Squad <promo@aol.com>',
        subject: 'New AOL Keywords: Type FAST, Find FASTER',
        html: this.buildAd({
          banner: 'AOL POWER USER TIPS', head: 'NEW AOL KEYWORDS', sub: 'Blink and you\'re there.',
          body: 'Skip the click‑fest. Just type the magic word and BOOM—INSTANT ACCESS.',
          bullets: ['KEYWORD: MOVIES', 'KEYWORD: GAMES', 'KEYWORD: WEATHER'], cta: 'Try a Keyword'
        })
      }),
      () => ({
        from: 'Jolt Cola <zap@jolt.com>',
        subject: 'All the sugar and twice the caffeine',
        html: this.buildAd({
          banner: 'PULL AN ALL‑NIGHTER', head: 'JOLT COLA', sub: 'Code. Game. Repeat.',
          body: 'When your 56k is screaming past bedtime, fuel up with fizz.',
          bullets: ['24‑pack special', 'Neon can design', 'LAN party approved'], cta: 'Get Jolted'
        })
      }),
      () => ({
        from: 'Y2K Taskforce <fix@y2k-ready.gov>',
        subject: 'Y2K Patch: Don\'t let the clock punk you',
        html: this.buildAd({
          banner: 'YEAR 2000 READY', head: 'Y2K PATCH', sub: 'Millennium‑proof your PC.',
          body: 'Download the utility, flip the digits, relax. Your goldfish screensaver survives.',
          bullets: ['One‑click install', 'BIOS tip sheet', 'Free hotline'], cta: 'Patch Me'
        })
      }),
      () => ({
        from: 'NetNanny Plus <safe@familyweb.net>',
        subject: 'NetNanny Plus: Guard your 56k like a ninja',
        html: this.buildAd({
          banner: 'PARENTAL POWER‑UPS', head: 'NETNANNY PLUS', sub: 'Surf smart. Surf safe.',
          body: 'Lock down those pop‑ups and block time‑vortex chat rooms. Configure with a single floppy.',
          bullets: ['Friendly setup wizard', 'Timer limits', 'Retro modem screech passthrough'], cta: 'Install Today'
        })
      }),
      () => ({
        from: 'SnackWave <wow@snackwave.com>',
        subject: 'Fruit Roll‑Up Extreme: New tie‑dye blast',
        html: this.buildAd({
          banner: 'BLAST OF COLOR', head: 'FRUIT ROLL‑UP EXTREME', sub: 'Peel. Stick. Chomp.',
          body: 'Posters for your lunchbox and tongue tattoos included. Collect all 12 designs.',
          bullets: ['Limited edition tie‑dye', 'Hologram wrappers', 'School‑safe'], cta: 'Taste the Blast'
        })
      })
    ];
    const pick = templates[Math.floor(Math.random() * templates.length)]();
    return {
      id: `auto-${Date.now()}`,
      from: pick.from,
      subject: pick.subject,
      date: datestr,
      preview: 'New message',
      html: pick.html,
      read: false,
      dateMs: now.getTime()
    };
  }

  // (Runtime image conversion removed; we now reference a pre-compressed asset.)

  toggleRead() {
    const id = this.currentId; if (!id) return;
    const msg = this.getActiveList().find(m => m.id === id); if (!msg) return;
    msg.read = !msg.read;
    const row = this.listEl?.querySelector(`.mail-list-item[data-id="${id}"]`);
    if (row) row.classList.toggle('unread', !msg.read);
    this.updateFolderBadges();
    this.updateMarkButton();
    this.saveState();
  }

  updateMarkButton() {
    const btn = this.bodyEl?.querySelector('.btn-mark');
    if (!btn) return;
    const id = this.currentId;
    const msg = id ? this.getActiveList().find(m => m.id === id) : null;
    btn.textContent = msg && !msg.read ? 'Mark Read' : 'Mark Unread';
    btn.disabled = !msg;
  }

  updateFolderBadges() {
    const inboxUnread = this.messages.filter(m => !m.read).length;
    const sentUnread = this.sent.filter(m => !m.read).length;
    const setBadge = (folder, count) => {
      const el = this.bodyEl?.querySelector(`.folder-item[data-folder="${folder}"]`);
      if (!el) return;
      const name = folder;
      const badge = count > 0 ? ` <span class=\"badge\">${count}</span>` : '';
      el.innerHTML = name + badge;
    };
    setBadge('Inbox', inboxUnread);
    setBadge('Sent', sentUnread);
  }

  setStatus(text, tempMs) {
    const el = this.bodyEl?.querySelector('.mail-status');
    if (!el) return;
    el.textContent = text || '';
    if (tempMs) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, tempMs);
  }

  showToast(text) {
    if (!this.windowEl) return;
    const toast = document.createElement('div');
    toast.className = 'mail-toast';
    toast.textContent = text;
    this.windowEl.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 1800);
  }

  // Persistence of read states and UI selection
  loadState() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      const map = s.readMap || {};
      const apply = (arr) => arr.forEach(m => { if (map.hasOwnProperty(m.id)) m.read = !!map[m.id]; });
      apply(this.messages);
      apply(this.sent);
      if (s.currentFolder) this.currentFolder = s.currentFolder;
      if (s.currentId) this.currentId = s.currentId;
      if (typeof s.previewOff === 'boolean') this.previewOff = s.previewOff;
      if (typeof s.listRatio === 'number') this.listRatio = s.listRatio;
      if (typeof s.sortKey === 'string') this.sortKey = s.sortKey;
      if (typeof s.sortDir === 'string') this.sortDir = s.sortDir;
    } catch (e) {}
  }

  saveState() {
    try {
      const map = {};
      const put = (arr) => arr.forEach(m => map[m.id] = !!m.read);
      put(this.messages);
      put(this.sent);
      const s = { readMap: map, currentFolder: this.currentFolder, currentId: this.currentId, previewOff: this.previewOff, listRatio: this.listRatio, sortKey: this.sortKey, sortDir: this.sortDir };
      localStorage.setItem(this.storageKey, JSON.stringify(s));
    } catch (e) {}
  }

  // Compose / Reply / Delete
  openCompose(opts = {}) {
    const to = opts.to || '';
    const subject = opts.subject || '';
    const quoted = opts.quoted || '';
    const shell = windowManager.createWindowShell({
      title: 'Compose Message', className: 'compose-window', width: '460px', height: '320px', top: '140px', left: '220px',
      controls: { minimize: true, maximize: false, close: true }
    });
    const win = shell.windowEl; const body = shell.body;
    // Wire title bar controls robustly by action (works with or without maximize)
    const tb = shell.titleBar;
    const minBtn = tb.querySelector('.title-bar-btn[data-action="min"]') || tb.querySelectorAll('.title-bar-btn')[0];
    const closeBtn = tb.querySelector('.title-bar-btn[data-action="close"]') || tb.querySelectorAll('.title-bar-btn')[1];
    if (minBtn) minBtn.addEventListener('click', () => windowManager.minimizeWindow(win));
    if (closeBtn) closeBtn.addEventListener('click', () => windowManager.closeWindow(win));
    body.style.padding = '8px';
    body.innerHTML = `
      <div class="form-95">
        <div class="row"><label style="width:60px;">To</label><input class="input-95" type="text" value="${this.escapeAttr(to)}" data-field="to"></div>
        <div class="row"><label style="width:60px;">Subject</label><input class="input-95" type="text" value="${this.escapeAttr(subject)}" data-field="subject"></div>
        <textarea class="input-95" style="width:100%;height:170px;resize:none;">${quoted}</textarea>
        <div style="margin-top:6px;display:flex;gap:6px;justify-content:flex-end;">
          <button class="btn-95 btn-send">Send</button>
          <button class="btn-95 btn-cancel">Cancel</button>
        </div>
      </div>
    `;
    const getVal = sel => body.querySelector(sel)?.value || '';
    body.querySelector('.btn-cancel')?.addEventListener('click', () => windowManager.closeWindow(win));
    body.querySelector('.btn-send')?.addEventListener('click', () => {
      const sentMsg = {
        id: `sent-${Date.now()}`,
        from: 'You <you@example.com>',
        subject: getVal('input[data-field="subject"]') || '(no subject)',
        date: new Date().toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
        preview: 'Sent message',
        html: this.buildAd({ banner: 'SENT MESSAGE', head: getVal('input[data-field="subject"]') || '(no subject)', sub: `To: ${this.escapeInline(getVal('input[data-field="to"]') || 'unknown')}`, body: `<pre style="white-space:pre-wrap">${this.escapeInline(body.querySelector('textarea')?.value || '')}</pre>` })
      };
      sentMsg.read = true;
      sentMsg.dateMs = Date.now();
      this.sent.unshift(sentMsg);
      this.currentFolder = 'Sent';
      this.bodyEl.querySelectorAll('.folder-item').forEach(el => el.classList.toggle('active', el.dataset.folder === 'Sent'));
      this.renderList();
      this.openMessage(sentMsg.id);
      this.playMailSound();
      this.setStatus('Mail sent!', 1500);
      this.showToast('Mail sent!');
      windowManager.closeWindow(win);
      this.saveState();
    });
  }

  handleReply() {
    const id = this.currentId; if (!id) return;
    const msg = this.getActiveList().find(m => m.id === id); if (!msg) return;
    const quoted = `\n\n----- Original Message -----\nFrom: ${msg.from}\nSubject: ${msg.subject}\n\n`;
    this.openCompose({ to: msg.from, subject: `Re: ${msg.subject}`, quoted });
  }

  handleDelete() {
    const id = this.currentId; if (!id) return;
    const list = this.getActiveList();
    const idx = list.findIndex(m => m.id === id);
    if (idx >= 0) list.splice(idx, 1);
    this.renderList();
    const next = this.getActiveList()[Math.min(idx, this.getActiveList().length - 1)];
    if (next) this.openMessage(next.id); else if (this.readerEl) this.readerEl.innerHTML = '';
    this.saveState();
  }

  minimize() { if (this.windowEl) { this.windowEl.style.display = 'none'; if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, false); } }
  toggleMaximize() {
    if (!this.windowEl) return; const win = this.windowEl; const isMax = win.dataset.maximized === '1';
    if (isMax) { win.style.top = win.dataset.prevTop || '100px'; win.style.left = win.dataset.prevLeft || '180px'; win.style.width = win.dataset.prevWidth || '820px'; win.style.height = win.dataset.prevHeight || '560px'; win.dataset.maximized = '0'; }
    else { win.dataset.prevTop = win.style.top; win.dataset.prevLeft = win.style.left; win.dataset.prevWidth = win.style.width; win.dataset.prevHeight = win.style.height; win.style.top = '0px'; win.style.left = '0px'; win.style.width = `${window.innerWidth - 4}px`; win.style.height = `${window.innerHeight - 28 - 4}px`; win.dataset.maximized = '1'; }
  }
  toggleFromTaskbar() { if (!this.windowEl) { this.open(); return; } const hidden = this.windowEl.style.display === 'none'; if (hidden) { this.windowEl.style.display = 'block'; this.activate(); } else { this.minimize(); } }
  activate() { if (!this.windowEl) return; this.windowEl.style.zIndex = ++windowManager.zIndexCounter; if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, true); }
  close() { if (!this.windowEl) return; windowManager.closeWindow(this.windowEl); this.windowEl = null; this.bodyEl = null; this.listEl = null; this.readerEl = null; if (window.taskbarManager) window.taskbarManager.remove(this.taskbarId); }
  escape(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  escapeInline(t) { return this.escape(String(t)); }
  escapeAttr(t) { return this.escape(String(t)).replace(/"/g, '&quot;'); }
}

// Global instance created in main.js
