// ============================================
// OXFORD MAIL (AOL Mail–style) MODULE
// Win95-style mail window: sortable message list, reader pane, compose,
// reply, delete and a fake "check for new mail".
// ============================================

const MAIL_COLUMNS = [
  { key: 'from', label: 'From' },
  { key: 'subject', label: 'Subject' },
  { key: 'date', label: 'Date' },
];
const MAIL_DEFAULT_LIST_RATIO = 0.42;
const MAIL_MIN_LIST_PX = 140;
const MAIL_MIN_READER_PX = 240;

/** Build the retro ad markup every seeded message shares. */
function buildAd({ banner, head, sub, body, bullets = [], heroSrc, heroAlt, cta, fine }) {
  const esc = Utils.escapeHtml;
  const bulletsHtml = bullets.length
    ? `<ul class="ad-bullets">${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
    : '';
  const heroHtml = heroSrc
    ? `<div class="message-hero"><img class="message-hero-img" src="${Utils.escapeAttr(heroSrc)}" alt="${Utils.escapeAttr(heroAlt || '')}" loading="lazy" decoding="async"></div>`
    : '';
  // Seeded copy may contain trusted inline markup; plain strings are escaped.
  const bodyHtml = body ? (body.startsWith('<') ? body : `<p>${esc(body)}</p>`) : '';
  return `
    <div class="retro-ad">
      ${banner ? `<div class="ad-banner">${esc(banner)}</div>` : ''}
      <div class="message-body">
        ${head ? `<h1 class="ad-head">${esc(head)}</h1>` : ''}
        ${sub ? `<h2 class="ad-sub">${esc(sub)}</h2>` : ''}
        ${bodyHtml}
        ${bulletsHtml}
        ${heroHtml}
        ${cta ? `<div class="ad-cta">${esc(cta)}</div>` : ''}
        ${fine ? `<p class="ad-fine">${esc(fine)}</p>` : ''}
      </div>
    </div>
  `;
}

const NINTENDO_AD = `
  <div class="retro-ad vboy">
    <div class="ad-banner">NINTENDO POWER ALERT</div>
    <div class="message-body">
      <h1 class="ad-head">SEE RED. FEEL 3‑D. GET HYPED.</h1>
      <h2 class="ad-sub">Introducing the <span class="ad-mark">VIRTUAL BOY™</span></h2>
      <p>Strap in, hotshot. This is stereoscopic, stand‑up, head‑spinning <strong>3‑D</strong> from the crew that brought you pure fun in cartridge form. No glasses. No mercy. Just radical depth that jumps like a skateboard off a handrail.</p>
      <ul class="ad-bullets">
        <li>Turbo‑charged red visuals that POP</li>
        <li>Plug‑and‑play setup—drop in, zone out</li>
        <li>Exclusive launch titles built for 3‑D speed</li>
      </ul>
      <div class="message-hero">
        <img class="message-hero-img retro-asset" src="media/virtualboy.png" width="360" loading="lazy" decoding="async" alt="Nintendo Virtual Boy console on a stand with its controller" />
      </div>
      <p class="ad-copy">Power up. Dial your senses to eleven. <em>Virtual Boy</em> doesn’t just play games— it <strong>warps reality</strong>. Are you game enough?</p>
      <div class="ad-cta">Power Up Today</div>
      <p class="ad-fine">Availability varies by region. Take breaks and play responsibly.</p>
    </div>
  </div>
`;

const SEEDED_MESSAGES = [
  { id: 'nintendo-virtualboy', from: 'Nintendo <power@club.nintendo.com>', subject: 'SEE RED: Step into 3‑D with Virtual Boy™', date: 'Aug 14, 1995 9:13 AM', preview: 'Hot new 3‑D tech from Nintendo Power…', html: NINTENDO_AD },
  { id: 'pepsi-stuff', from: 'Pepsi <points@pepsistuff.com>', subject: 'PEPSI STUFF: Pop the top. Score the gear.', date: 'May 02, 1998 7:41 PM', preview: 'Caps = Points = Jackets, CDs, and more…', ad: { banner: 'POP • POINTS • PRIZES', head: 'PEPSI STUFF', sub: 'Pop the top. Score the gear.', body: '<p>Grab a cold Pepsi, pop the cap, and rack up <strong>Points</strong>. Trade ’em for hot swag—starter jackets, Discman® players, and limited‑edition CDs.</p><p>Hop online with your trusty 56k and punch in your codes. Boom. Gear on the way.</p>', bullets: ['Caps = Points = Stuff', 'Exclusive tour tees + CD samplers', 'Mail‑in or online redemption'], cta: 'Claim Your Stuff', fine: 'While supplies last. Internet access may be required. Ask permission before surfing.' } },
  { id: 'columbia-house', from: 'Columbia House <club@columbiahouse.com>', subject: '12 CDs for 1¢. No kidding.', date: 'Mar 03, 1997 5:19 PM', preview: 'Stuff your binder. Pay basically nothing today…', ad: { banner: 'MAILBOX BOOMBOX', head: '12 CDs FOR 1¢', sub: 'Stuff your binder. Pay basically nothing today.', body: '<p>Pick <strong>12 CDs</strong> for just <strong>1¢</strong>. Smash Mouth? Oasis? Alanis? We got ’em.</p><p>Choose now, pay later. It’s like your mixtape made itself.</p>', bullets: ['No kidding — twelve', 'Chart bangers included', 'Ships to your door'], cta: 'Join the Club', fine: 'Membership terms apply. Postage not included.' } },
  { id: 'tamagotchi', from: 'Bandai <hatch@tamagotchi.jp>', subject: 'Tamagotchi: The pocket pal that needs YOU', date: 'Nov 22, 1997 11:06 AM', preview: 'Feed it. Clean it. Love it. Repeat…', ad: { banner: 'POCKET PIXELS', head: 'TAMAGOTCHI', sub: 'The pocket pal that needs YOU', body: '<p>Your backpack just got busier. <strong>Tamagotchi</strong> lives for your attention—feed snacks between classes, scoop pixels (ew!), and keep the beeps happy.</p><p>Clip it, flaunt it, bond with it. Friends don’t let friends go low‑battery.</p>', bullets: ['Snacks, play, sleep cycles', 'Keychain clip flaunt factor', 'Beep notifications so you never forget'], cta: 'Adopt One' } },
  { id: 'blockbuster', from: 'Blockbuster Video <bignight@blockbuster.com>', subject: 'Make it a Blockbuster night.', date: 'Jan 09, 1999 8:02 PM', preview: '2‑day rentals, fresh popcorn, rewind kindly…', ad: { banner: 'FRIDAY NIGHT = MOVIE NIGHT', head: 'BLOCKBUSTER VIDEO', sub: 'Make it a Blockbuster night.', body: '<p>Grab a membership card and cruise the aisles. Pick up <em>Hot Tamales</em>, snag a VHS, and remember—<strong>Be Kind, Rewind</strong>.</p><p>Pro tip: Reserve early to beat the Friday rush.</p>', bullets: ['2‑day rentals', 'New releases weekly', 'Late fee reminder (uh oh)'], cta: 'Rent Tonight' } },
  { id: 'chatpal-95', from: 'FutureWare <hello@futureware.com>', subject: 'ChatPal 95: Your floppy‑disk AI buddy', date: 'Jun 07, 1996 4:12 PM', preview: 'Talk to your PC like it’s your pal…', ad: { banner: 'FUTUREWARE PRESENTS', head: 'CHATPAL 95', sub: 'Artificial Conversation. Real Fun.', body: 'Slip the <strong>1.44MB</strong> disk in and say hello to your PC’s new best friend. Type a question, get a wisecrack.', bullets: ['Runs on 486 (Pentium screams!)', 'Offline chat — save those minutes', 'Personalities: Skater Dude to Study Buddy'], cta: 'Install from Floppy' } },
  { id: 'robohelper-2000', from: 'RoboCo <beep@roboco.com>', subject: 'RoboHelper 2000: Your rolling desktop assistant', date: 'Sep 18, 1999 10:28 AM', preview: 'Wheels. Sensors. Attitude. Coffee compatible…', ad: { banner: 'ROBOCO // NEXT‑GEN HOME HELP', head: 'ROBOHELPER 2000', sub: 'Because chores are so last century.', body: 'Your new motorized buddy patrols hallways, carries snacks, and beeps on command. Infrared sensors avoid socks and cats.', bullets: ['Auto‑dock charging', 'Clap‑to‑start voice trigger', 'Serial cable updates (futuristic!)'], cta: 'Roll Out' } },
  { id: 'neurotoast', from: 'NeuroToast Labs <hot@neurotoast.com>', subject: 'NeuroToast 2K: A neural network for your breakfast', date: 'Feb 11, 1999 6:59 AM', preview: 'Smarter toast via patented N.E.U.R.O. LOAF™ tech…', ad: { banner: 'BREAKFAST // UPGRADED', head: 'NEUROTOAST 2K', sub: 'Deep‑crisp technology for perfect browns.', body: 'Our countertop neural net learns your crunch curve. From lightly golden to XTREME CRISP, it remembers your vibe.', bullets: ['Serial‑port firmware (9‑pin included)', 'Bagel Mode: edge intensity control', 'Auto‑pop victory chime'], cta: 'Get Toast Smart' } },
];

const RANDOM_AD_TEMPLATES = [
  { from: 'CyberPet Labs <bark@cyberpet.net>', subject: 'CyberPet Deluxe: Your screen‑tamed dino', ad: { banner: 'EXTREME DIGITAL PETS', head: 'CYBERPET DELUXE', sub: 'Bite‑size pixels. Big personality.', body: 'Hatch a raptor, feed it byte‑snacks, and show it off on the bus. Now with Night Mode and Sticker Sheet 2.0.', bullets: ['Infrared pet meetups', 'Secret code mini‑games', 'Comes with belt clip'], cta: 'Hatch One' } },
  { from: 'AOL Keyword Squad <promo@aol.com>', subject: 'New AOL Keywords: Type FAST, Find FASTER', ad: { banner: 'AOL POWER USER TIPS', head: 'NEW AOL KEYWORDS', sub: "Blink and you're there.", body: 'Skip the click‑fest. Just type the magic word and BOOM—INSTANT ACCESS.', bullets: ['KEYWORD: MOVIES', 'KEYWORD: GAMES', 'KEYWORD: WEATHER'], cta: 'Try a Keyword' } },
  { from: 'Jolt Cola <zap@jolt.com>', subject: 'All the sugar and twice the caffeine', ad: { banner: 'PULL AN ALL‑NIGHTER', head: 'JOLT COLA', sub: 'Code. Game. Repeat.', body: 'When your 56k is screaming past bedtime, fuel up with fizz.', bullets: ['24‑pack special', 'Neon can design', 'LAN party approved'], cta: 'Get Jolted' } },
  { from: 'Y2K Taskforce <fix@y2k-ready.gov>', subject: "Y2K Patch: Don't let the clock punk you", ad: { banner: 'YEAR 2000 READY', head: 'Y2K PATCH', sub: 'Millennium‑proof your PC.', body: 'Download the utility, flip the digits, relax. Your goldfish screensaver survives.', bullets: ['One‑click install', 'BIOS tip sheet', 'Free hotline'], cta: 'Patch Me' } },
  { from: 'NetNanny Plus <safe@familyweb.net>', subject: 'NetNanny Plus: Guard your 56k like a ninja', ad: { banner: 'PARENTAL POWER‑UPS', head: 'NETNANNY PLUS', sub: 'Surf smart. Surf safe.', body: 'Lock down those pop‑ups and block time‑vortex chat rooms. Configure with a single floppy.', bullets: ['Friendly setup wizard', 'Timer limits', 'Retro modem screech passthrough'], cta: 'Install Today' } },
  { from: 'SnackWave <wow@snackwave.com>', subject: 'Fruit Roll‑Up Extreme: New tie‑dye blast', ad: { banner: 'BLAST OF COLOR', head: 'FRUIT ROLL‑UP EXTREME', sub: 'Peel. Stick. Chomp.', body: 'Posters for your lunchbox and tongue tattoos included. Collect all 12 designs.', bullets: ['Limited edition tie‑dye', 'Hologram wrappers', 'School‑safe'], cta: 'Taste the Blast' } },
];

/** Materialise a message definition into one with rendered HTML. */
function hydrate(def) {
  return { read: false, ...def, html: def.html || buildAd(def.ad) };
}

class ComposeWindow extends AppWindow {
  constructor(mail, { to = '', subject = '', quoted = '' } = {}) {
    super({
      id: `compose-${Date.now()}`,
      title: 'Compose Message',
      taskbarTitle: 'Compose',
      className: 'compose-window',
      iconClass: 'mail-icon',
      width: 480,
      height: 360,
      controls: { minimize: true, maximize: false, close: true },
    });
    this.mail = mail;
    this.initial = { to, subject, quoted };
  }

  renderBody(body) {
    body.innerHTML = `
      <form class="form-95 compose-form">
        <div class="row"><label for="compose-to">To</label><input id="compose-to" class="input-95" type="text" data-field="to" autocomplete="off"></div>
        <div class="row"><label for="compose-subject">Subject</label><input id="compose-subject" class="input-95" type="text" data-field="subject" autocomplete="off"></div>
        <label class="visually-hidden" for="compose-body">Message</label>
        <textarea id="compose-body" class="input-95 compose-body"></textarea>
        <div class="compose-actions">
          <button type="submit" class="btn-95 btn-send">Send</button>
          <button type="button" class="btn-95 btn-cancel">Cancel</button>
        </div>
      </form>
    `;
    this.$('[data-field="to"]').value = this.initial.to;
    this.$('[data-field="subject"]').value = this.initial.subject;
    this.$('.compose-body').value = this.initial.quoted;

    this.$('.btn-cancel').addEventListener('click', () => this.close());
    this.$('.compose-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.mail.deliverSent({
        to: this.$('[data-field="to"]').value,
        subject: this.$('[data-field="subject"]').value,
        text: this.$('.compose-body').value,
      });
      this.close();
    });
  }
}

class MailManager extends AppWindow {
  constructor() {
    super({
      id: 'mail',
      title: 'Oxford Mail',
      className: 'mail-window',
      iconClass: 'mail-icon',
      width: 980,
      height: 620,
    });
    this.currentFolder = 'Inbox';
    this.currentId = null;
    this.storageKey = 'oxmail.state.v1';
    this.previewOff = false;
    this.listRatio = MAIL_DEFAULT_LIST_RATIO;
    this.sortKey = 'date';
    this.sortDir = 'desc';
    this.messages = SEEDED_MESSAGES.map(hydrate);
    this.sent = [];
    this.composeWindows = new Set();
  }

  renderBody(body) {
    const listHeader = MAIL_COLUMNS
      .map((c) => `<button type="button" class="sortable" data-key="${c.key}" aria-label="Sort by ${c.label}">${c.label}</button>`)
      .join('');
    const readerHeader = MAIL_COLUMNS
      .map((c) => `<div class="hdr-row"><span class="lbl">${c.label}:</span> <span class="val" data-hdr="${c.key}"></span></div>`)
      .join('');

    body.innerHTML = `
      <div class="mail-toolbar">
        <div class="actions">
          <button type="button" class="btn-95 btn-refresh" title="Check for new mail">Refresh</button>
          <button type="button" class="btn-95 btn-compose" title="Write a new message">Compose</button>
          <button type="button" class="btn-95 btn-reply" title="Reply to selected">Reply</button>
          <button type="button" class="btn-95 btn-delete" title="Delete selected">Delete</button>
          <button type="button" class="btn-95 btn-mark" title="Mark read/unread">Mark Read</button>
          <button type="button" class="btn-95 btn-preview" title="Toggle preview pane" aria-pressed="false">Preview Pane</button>
        </div>
        <div class="folders-inline mail-folders" role="tablist" aria-label="Mail folders">
          <button type="button" class="folder-item active" data-folder="Inbox" role="tab" aria-selected="true">Inbox</button>
          <button type="button" class="folder-item" data-folder="Sent" role="tab" aria-selected="false">Sent</button>
        </div>
        <span class="mail-status" role="status"></span>
      </div>
      <div class="mail-layout">
        <div class="mail-right">
          <div class="mail-list-header mail-columns">${listHeader}</div>
          <div class="mail-list mail-scrollable" role="listbox" aria-label="Message list" tabindex="0"></div>
          <div class="mail-resizer" role="separator" aria-orientation="vertical" tabindex="0"
               aria-label="Resize message list" title="Drag or use arrow keys to resize"></div>
          <div class="mail-reader">
            <div class="mail-reader-header">${readerHeader}</div>
            <div class="mail-reader-body mail-scrollable" tabindex="0"></div>
          </div>
        </div>
      </div>
    `;

    this.listEl = this.$('.mail-list');
    this.readerEl = this.$('.mail-reader-body');

    const actions = {
      '.btn-refresh': () => this.handleRefresh(),
      '.btn-compose': () => this.openCompose(),
      '.btn-reply': () => this.handleReply(),
      '.btn-delete': () => this.handleDelete(),
      '.btn-mark': () => this.toggleRead(),
      '.btn-preview': () => this.togglePreview(),
    };
    Object.entries(actions).forEach(([sel, fn]) => this.$(sel).addEventListener('click', fn));

    Utils.on(body, 'click', '.sortable', (e) => this.toggleSort(e.currentTarget.dataset.key));
    Utils.on(body, 'click', '.folder-item', (e) => this.selectFolder(e.currentTarget.dataset.folder));
    Utils.on(this.listEl, 'click', '.mail-list-item', (e) => this.openMessage(e.currentTarget.dataset.id));
    Utils.on(this.listEl, 'keydown', '.mail-list-item', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openMessage(e.currentTarget.dataset.id); }
    });
    this.listEl.addEventListener('keydown', (e) => this.handleListArrows(e));

    this.setupResizer();
    this.loadState();
    this.applyLayoutFromState();
    this.syncFolderButtons();
    this.renderList();
    this.updateHeaderSortIndicators();

    const list = this.getActiveList();
    if (list.length) this.openMessage((this.currentId && list.some((m) => m.id === this.currentId)) ? this.currentId : list[0].id);
    this.updateFolderBadges();
    this.playMailSound();
  }

  // ---------- list ----------
  renderList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    this.getSortedActiveList().forEach((m) => {
      const item = document.createElement('div');
      item.className = `mail-list-item mail-columns${m.read ? '' : ' unread'}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', m.id === this.currentId ? 'true' : 'false');
      item.setAttribute('tabindex', '0');
      item.dataset.id = m.id;
      MAIL_COLUMNS.forEach((col) => {
        const cell = document.createElement('div');
        cell.className = col.key;
        cell.textContent = m[col.key] == null ? '' : String(m[col.key]);
        item.appendChild(cell);
      });
      this.listEl.appendChild(item);
    });
    this.updateFolderBadges();
    this.updateMarkButton();
  }

  handleListArrows(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(this.listEl.querySelectorAll('.mail-list-item'));
    if (!items.length) return;
    const active = this.listEl.querySelector('.mail-list-item.active');
    let idx = active ? items.indexOf(active) : -1;
    idx = e.key === 'ArrowDown'
      ? Math.min(items.length - 1, idx + 1)
      : Math.max(0, idx - 1);
    e.preventDefault();
    this.openMessage(items[idx].dataset.id);
    items[idx].focus();
  }

  selectFolder(folder) {
    if (!folder) return;
    this.currentFolder = folder;
    this.syncFolderButtons();
    this.renderList();
    const list = this.getActiveList();
    if (list.length) this.openMessage(list[0].id);
    else if (this.readerEl) { this.readerEl.replaceChildren(); this.currentId = null; this.updateMarkButton(); }
    this.saveState();
  }

  syncFolderButtons() {
    this.$$('.folder-item').forEach((el) => {
      const active = el.dataset.folder === this.currentFolder;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  setupResizer() {
    const right = this.$('.mail-right');
    const resizer = this.$('.mail-resizer');
    if (!right || !resizer) return;

    const applyRatio = (r) => {
      this.listRatio = Utils.clamp(r, 0.2, 0.8);
      right.style.setProperty('--mail-list-w', `${Math.round(this.listRatio * 100)}%`);
    };

    let pointerId = null;
    let startX = 0;
    let startW = 0;
    let rightW = 0;

    const onMove = (e) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      const maxList = Math.max(MAIL_MIN_LIST_PX, rightW - MAIL_MIN_READER_PX);
      const newW = Utils.clamp(startW + (e.clientX - startX), MAIL_MIN_LIST_PX, maxList);
      applyRatio(newW / rightW);
    };
    const onUp = (e) => {
      if (pointerId === null || (e && e.pointerId !== pointerId)) return;
      try { resizer.releasePointerCapture(pointerId); } catch (_) {}
      pointerId = null;
      resizer.removeEventListener('pointermove', onMove);
      resizer.removeEventListener('pointerup', onUp);
      resizer.removeEventListener('pointercancel', onUp);
      this.saveState();
    };

    resizer.addEventListener('pointerdown', (e) => {
      if (Utils.isCompact()) return; // stacked layout has no split to drag
      e.preventDefault();
      pointerId = e.pointerId;
      rightW = right.getBoundingClientRect().width;
      startW = this.listEl.getBoundingClientRect().width;
      startX = e.clientX;
      try { resizer.setPointerCapture(pointerId); } catch (_) {}
      resizer.addEventListener('pointermove', onMove);
      resizer.addEventListener('pointerup', onUp);
      resizer.addEventListener('pointercancel', onUp);
    });

    resizer.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      applyRatio(this.listRatio + (e.key === 'ArrowLeft' ? -0.05 : 0.05));
      this.saveState();
    });
  }

  togglePreview() {
    this.previewOff = !this.previewOff;
    this.applyLayoutFromState();
    this.saveState();
  }

  applyLayoutFromState() {
    const right = this.$('.mail-right');
    if (right) {
      const ratio = Utils.clamp(Number.isFinite(this.listRatio) ? this.listRatio : MAIL_DEFAULT_LIST_RATIO, 0.2, 0.8);
      this.listRatio = ratio;
      right.style.setProperty('--mail-list-w', `${(ratio * 100).toFixed(1)}%`);
      right.classList.toggle('preview-off', this.previewOff);
    }
    const btn = this.$('.btn-preview');
    if (btn) btn.setAttribute('aria-pressed', this.previewOff ? 'true' : 'false');
  }

  // ---------- reader ----------
  openMessage(id) {
    const msg = this.getActiveList().find((m) => m.id === id);
    if (!msg) return;

    this.$$('.mail-list-item').forEach((el) => {
      const active = el.dataset.id === id;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    MAIL_COLUMNS.forEach((col) => {
      const el = this.$(`[data-hdr="${col.key}"]`);
      if (el) el.textContent = msg[col.key] || '';
    });

    if (this.readerEl) {
      this.readerEl.innerHTML = msg.html || buildAd({
        banner: 'MESSAGE',
        head: msg.subject || '(no subject)',
        sub: `From: ${msg.from || 'unknown'}`,
        body: msg.preview ? `<p>${Utils.escapeHtml(msg.preview)}</p>` : '<p>(No content)</p>',
      });
      this.readerEl.scrollTop = 0;
    }

    this.currentId = id;
    if (!msg.read) {
      msg.read = true;
      const row = this.listEl?.querySelector(`.mail-list-item[data-id="${CSS.escape(id)}"]`);
      if (row) row.classList.remove('unread');
      this.updateFolderBadges();
    }
    this.updateMarkButton();
    this.saveState();
  }

  // ---------- sorting ----------
  toggleSort(key) {
    if (!key || !MAIL_COLUMNS.some((c) => c.key === key)) return;
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = key; this.sortDir = key === 'date' ? 'desc' : 'asc'; }
    this.updateHeaderSortIndicators();
    this.renderList();
    this.saveState();
  }

  updateHeaderSortIndicators() {
    this.$$('.sortable').forEach((el) => {
      const sorted = el.dataset.key === this.sortKey;
      el.classList.toggle('sorted-asc', sorted && this.sortDir === 'asc');
      el.classList.toggle('sorted-desc', sorted && this.sortDir === 'desc');
      el.setAttribute('aria-sort', sorted ? (this.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    });
  }

  getSortedActiveList() {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const value = (m) => {
      if (this.sortKey === 'date') {
        if (m.dateMs) return m.dateMs;
        const t = Date.parse(m.date || '');
        return Number.isNaN(t) ? 0 : t;
      }
      return String(m[this.sortKey] || '').toLowerCase();
    };
    return this.getActiveList().slice().sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }

  // ---------- actions ----------
  getActiveList() { return this.currentFolder === 'Sent' ? this.sent : this.messages; }

  playMailSound() {
    const am = window.audioManager;
    if (!am) return;
    if (!am.initialized) am.init();
    am.playGotMail();
    setTimeout(() => am.playAlert(), 180);
  }

  handleRefresh() {
    this.setStatus('Checking for new mail...');
    setTimeout(() => {
      const n = Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.messages.unshift(this.generateRandomAd(i));
      this.renderList();
      if (n > 0) {
        this.openMessage(this.messages[0].id);
        this.playMailSound();
        this.setStatus(`${n} new message${n === 1 ? '' : 's'}.`, 1800);
        this.showToast(`${n} new message${n === 1 ? '' : 's'}`);
      } else {
        this.setStatus('No new messages.', 1200);
      }
    }, 600 + Math.floor(Math.random() * 700));
  }

  generateRandomAd(offset = 0) {
    const now = new Date();
    const pick = RANDOM_AD_TEMPLATES[Math.floor(Math.random() * RANDOM_AD_TEMPLATES.length)];
    return {
      ...hydrate(pick),
      id: `auto-${now.getTime()}-${offset}`,
      date: now.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      preview: 'New message',
      dateMs: now.getTime(),
    };
  }

  toggleRead() {
    const msg = this.getActiveList().find((m) => m.id === this.currentId);
    if (!msg) return;
    msg.read = !msg.read;
    const row = this.listEl?.querySelector(`.mail-list-item[data-id="${CSS.escape(msg.id)}"]`);
    if (row) row.classList.toggle('unread', !msg.read);
    this.updateFolderBadges();
    this.updateMarkButton();
    this.saveState();
  }

  updateMarkButton() {
    const btn = this.$('.btn-mark');
    if (!btn) return;
    const msg = this.getActiveList().find((m) => m.id === this.currentId);
    btn.textContent = msg && !msg.read ? 'Mark Read' : 'Mark Unread';
    btn.disabled = !msg;
    ['.btn-reply', '.btn-delete'].forEach((sel) => {
      const b = this.$(sel);
      if (b) b.disabled = !msg;
    });
  }

  updateFolderBadges() {
    const counts = { Inbox: this.messages.filter((m) => !m.read).length, Sent: this.sent.filter((m) => !m.read).length };
    Object.entries(counts).forEach(([folder, count]) => {
      const el = this.$(`.folder-item[data-folder="${folder}"]`);
      if (!el) return;
      el.replaceChildren(document.createTextNode(folder));
      if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = String(count);
        el.appendChild(badge);
        el.setAttribute('aria-label', `${folder}, ${count} unread`);
      } else {
        el.setAttribute('aria-label', folder);
      }
    });
  }

  setStatus(text, tempMs) {
    const el = this.$('.mail-status');
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
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 1800);
  }

  // ---------- compose ----------
  openCompose(opts) {
    const win = new ComposeWindow(this, opts);
    this.composeWindows.add(win);
    win.open();
    return win;
  }

  deliverSent({ to, subject, text }) {
    const now = new Date();
    const finalSubject = subject || '(no subject)';
    const msg = {
      id: `sent-${now.getTime()}`,
      from: 'You <you@example.com>',
      subject: finalSubject,
      date: now.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      preview: 'Sent message',
      read: true,
      dateMs: now.getTime(),
      html: buildAd({
        banner: 'SENT MESSAGE',
        head: finalSubject,
        sub: `To: ${to || 'unknown'}`,
        body: `<pre class="sent-body">${Utils.escapeHtml(text || '')}</pre>`,
      }),
    };
    this.sent.unshift(msg);
    this.selectFolder('Sent');
    this.openMessage(msg.id);
    this.playMailSound();
    this.setStatus('Mail sent!', 1500);
    this.showToast('Mail sent!');
    this.saveState();
  }

  handleReply() {
    const msg = this.getActiveList().find((m) => m.id === this.currentId);
    if (!msg) return;
    this.openCompose({
      to: msg.from,
      subject: `Re: ${msg.subject}`,
      quoted: `\n\n----- Original Message -----\nFrom: ${msg.from}\nSubject: ${msg.subject}\n\n`,
    });
  }

  handleDelete() {
    const list = this.getActiveList();
    const idx = list.findIndex((m) => m.id === this.currentId);
    if (idx < 0) return;
    list.splice(idx, 1);
    this.renderList();
    const next = list[Math.min(idx, list.length - 1)];
    if (next) {
      this.openMessage(next.id);
    } else {
      this.currentId = null;
      if (this.readerEl) this.readerEl.replaceChildren();
      MAIL_COLUMNS.forEach((c) => { const el = this.$(`[data-hdr="${c.key}"]`); if (el) el.textContent = ''; });
      this.updateMarkButton();
    }
    this.saveState();
  }

  // ---------- persistence ----------
  loadState() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      const map = s.readMap || {};
      [this.messages, this.sent].forEach((arr) =>
        arr.forEach((m) => { if (Object.prototype.hasOwnProperty.call(map, m.id)) m.read = !!map[m.id]; }));
      if (s.currentFolder) this.currentFolder = s.currentFolder;
      if (s.currentId) this.currentId = s.currentId;
      if (typeof s.previewOff === 'boolean') this.previewOff = s.previewOff;
      if (typeof s.listRatio === 'number') this.listRatio = s.listRatio;
      if (typeof s.sortKey === 'string' && MAIL_COLUMNS.some((c) => c.key === s.sortKey)) this.sortKey = s.sortKey;
      if (s.sortDir === 'asc' || s.sortDir === 'desc') this.sortDir = s.sortDir;
    } catch (err) {
      console.warn('Oxford Mail: could not restore state', err);
    }
  }

  saveState() {
    try {
      const readMap = {};
      [this.messages, this.sent].forEach((arr) => arr.forEach((m) => { readMap[m.id] = !!m.read; }));
      localStorage.setItem(this.storageKey, JSON.stringify({
        readMap,
        currentFolder: this.currentFolder,
        currentId: this.currentId,
        previewOff: this.previewOff,
        listRatio: this.listRatio,
        sortKey: this.sortKey,
        sortDir: this.sortDir,
      }));
    } catch (err) {
      console.warn('Oxford Mail: could not save state', err);
    }
  }

  onClose() {
    this.composeWindows.forEach((w) => w.close());
    this.composeWindows.clear();
    this.listEl = null;
    this.readerEl = null;
  }
}

window.MailManager = MailManager;
