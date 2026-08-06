// Full interaction audit: click and type through every app at 3 viewports.
import fs from 'node:fs';
import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';

const PAGE = `${BASE}/index.html`;
const OUT = outDir('shots');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false, compact: false },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, compact: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, compact: true },
];

const report = {};

for (const vp of VIEWPORTS) {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({
    viewport: vp.viewport,
    hasTouch: vp.hasTouch,
    isMobile: vp.isMobile,
    deviceScaleFactor: vp.isMobile ? 2 : 1,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);

  const errors = [];
  const failed = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => failed.push(`FAILED ${r.url()} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

  const steps = [];
  const step = async (label, fn) => {
    try { await fn(); steps.push(`OK   ${label}`); }
    catch (e) { steps.push(`FAIL ${label} :: ${String(e.message).split('\n')[0].slice(0, 180)}`); }
  };
  const shot = async (n) => { try { await page.screenshot({ path: `${OUT}/${vp.name}-${n}.png` }); } catch {} };
  const overflowNow = () => page.evaluate(() => ({
    docW: document.documentElement.scrollWidth, winW: window.innerWidth,
  }));
  const ov = {};
  const checkOverflow = async (label) => { ov[label] = await overflowNow(); };
  // Taskbar buttons toggle, so only click when the window is actually hidden.
  const ensureVisible = async (sel, taskId) => {
    const hidden = await page.evaluate((s2) => {
      const el = document.querySelector(s2);
      return !el || el.classList.contains('window--hidden');
    }, sel);
    if (hidden) await page.click(`.taskbar-windows .task-btn[data-task-id="${taskId}"]`);
    else await page.evaluate((s2) => document.querySelector(s2)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), sel);
    await page.waitForTimeout(350);
  };

  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await shot('01-login');
  await checkOverflow('login');

  await step('login: layout mode is correct', async () => {
    const isCompact = await page.evaluate(() => document.body.classList.contains('is-compact'));
    if (isCompact !== vp.compact) throw new Error(`expected is-compact=${vp.compact}, got ${isCompact}`);
  });
  await step('login: focus lands on username', async () => {
    const id = await page.evaluate(() => document.activeElement?.id);
    if (id !== 'oo-username') throw new Error(`focus is on "${id}"`);
  });
  await step('login: empty submit is rejected', async () => {
    await page.click('.btn-connect');
    await page.waitForTimeout(200);
    if (!(await page.locator('#dialup-intro').count())) throw new Error('login dismissed with empty fields');
  });
  await step('login: type + submit', async () => {
    await page.fill('#oo-username', 'RetroKid99');
    await page.fill('#oo-password', 'hunter2');
    await page.click('.btn-connect');
    await page.waitForSelector('.btn-center', { timeout: 5000 });
  });
  await shot('02-dialup');
  await checkOverflow('dialup');

  await step('dialup: skip', async () => {
    await page.click('.btn-center');
    await page.waitForSelector('.desktop:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(400);
  });
  await shot('03-desktop');
  await checkOverflow('desktop');

  await step('desktop: buddy list rendered from data', async () => {
    const n = await page.locator('.buddy-item').count();
    if (n !== 13) throw new Error(`expected 13 buddies, got ${n}`);
    const offline = await page.locator('.buddy-item[disabled]').count();
    if (offline !== 9) throw new Error(`expected 9 disabled offline buddies, got ${offline}`);
  });

  await step('chat: type + send + auto-reply', async () => {
    const before = await page.locator('#chatMessages .message').count();
    await page.fill('#messageInput', 'hey is this thing on');
    await page.click('.chat-input button[type="submit"]');
    await page.waitForTimeout(2800);
    const after = await page.locator('#chatMessages .message').count();
    if (after < before + 2) throw new Error(`messages ${before} -> ${after}; expected +2`);
    if (await page.locator('#chatTyping').count()) throw new Error('typing indicator was left behind');
  });
  await step('chat: Enter key sends', async () => {
    const before = await page.locator('#chatMessages .message').count();
    await page.fill('#messageInput', 'second one');
    await page.press('#messageInput', 'Enter');
    await page.waitForTimeout(2600);
    if ((await page.locator('#chatMessages .message').count()) < before + 2) throw new Error('Enter did not send');
  });
  await step('chat: switch buddy keeps history', async () => {
    await page.click('.buddy-item[data-buddy="SelvaTron"]');
    await page.waitForTimeout(400);
    if ((await page.textContent('#chatToUser')) !== 'SelvaTron') throw new Error('header did not update');
    await page.click('.buddy-item[data-buddy="Sepinator"]');
    await page.waitForTimeout(400);
    const n = await page.locator('#chatMessages .message').count();
    if (n < 4) throw new Error(`history lost on switch back: ${n} messages`);
  });
  await step('chat: offline buddy is not clickable', async () => {
    const disabled = await page.locator('.buddy-item[data-buddy="RetroGamer"]').isDisabled();
    if (!disabled) throw new Error('offline buddy is enabled');
  });
  await shot('04-chat');

  await step('terminal: open from taskbar', async () => {
    await page.click('.taskbar-dos');
    await page.waitForSelector('.terminal-window', { timeout: 6000 });
    await page.waitForTimeout(700);
  });
  await step('terminal: xterm rendered and fitted', async () => {
    const info = await page.evaluate(() => {
      const c = document.querySelector('.terminal-container');
      const s = document.querySelector('.xterm-screen');
      if (!c || !s) return null;
      return { cw: c.clientWidth, ch: c.clientHeight, sw: s.clientWidth, sh: s.clientHeight };
    });
    if (!info) throw new Error('xterm did not render');
    // Fitted grid should fill most of its container, not sit at a fixed 80x24.
    if (info.sw < info.cw * 0.6) throw new Error(`xterm not fitted: screen ${info.sw} vs container ${info.cw}`);
  });
  await step('terminal: type "help"', async () => {
    await page.click('.terminal-container');
    await page.keyboard.type('help');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const text = await page.locator('.terminal-window').innerText();
    if (!/Available commands/i.test(text)) throw new Error('help output missing');
  });
  await step('terminal: bad command reports', async () => {
    await page.keyboard.type('flurb');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const text = await page.locator('.terminal-window').innerText();
    if (!/Bad command/i.test(text)) throw new Error('no error for unknown command');
  });
  await shot('05-terminal');

  if (!vp.compact) {
    await step('terminal: drag by title bar (pointer)', async () => {
      const win = page.locator('.terminal-window');
      const before = await win.boundingBox();
      const bb = await page.locator('.terminal-window .title-bar').boundingBox();
      await page.mouse.move(bb.x + 60, bb.y + bb.height / 2);
      await page.mouse.down();
      await page.mouse.move(bb.x + 60 - 80, bb.y + bb.height / 2 + 60, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      const after = await win.boundingBox();
      if (Math.abs(after.x - before.x) < 20 || Math.abs(after.y - before.y) < 20) {
        throw new Error(`did not move: ${before.x},${before.y} -> ${after.x},${after.y}`);
      }
    });
    await step('terminal: resize from SE handle', async () => {
      const win = page.locator('.terminal-window');
      const before = await win.boundingBox();
      const h = await page.locator('.terminal-window .resize-se').boundingBox();
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
      await page.mouse.down();
      await page.mouse.move(h.x + 120, h.y + 90, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const after = await win.boundingBox();
      if (after.width < before.width + 50) throw new Error(`width ${before.width} -> ${after.width}`);
    });
  } else {
    await step('compact: window is pinned full-bleed', async () => {
      const box = await page.locator('.terminal-window').boundingBox();
      const vpW = vp.viewport.width;
      if (Math.abs(box.width - vpW) > 2) throw new Error(`width ${box.width} != viewport ${vpW}`);
      if (box.x > 1) throw new Error(`window offset left by ${box.x}`);
    });
    await step('compact: resize handles are hidden', async () => {
      const visible = await page.locator('.terminal-window .resize-se').isVisible();
      if (visible) throw new Error('resize handle visible in compact mode');
    });
    await step('compact: drag does not move the window', async () => {
      const win = page.locator('.terminal-window');
      const before = await win.boundingBox();
      const bb = await page.locator('.terminal-window .title-bar').boundingBox();
      await page.mouse.move(bb.x + 40, bb.y + bb.height / 2);
      await page.mouse.down();
      await page.mouse.move(bb.x + 140, bb.y + 120, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(200);
      const after = await win.boundingBox();
      if (Math.abs(after.x - before.x) > 2) throw new Error('window drifted in compact mode');
    });
  }

  await step('terminal: minimize then restore from taskbar', async () => {
    await page.click('.terminal-window .title-bar-btn[data-action="min"]');
    await page.waitForTimeout(250);
    if (await page.locator('.terminal-window').isVisible()) throw new Error('still visible after minimize');
    await page.click('.taskbar-windows .task-btn[data-task-id="terminal"]');
    await page.waitForTimeout(250);
    if (!(await page.locator('.terminal-window').isVisible())) throw new Error('did not restore');
  });
  await step('terminal: close removes taskbar button', async () => {
    await page.click('.terminal-window .title-bar-btn[data-action="close"]');
    await page.waitForTimeout(300);
    if (await page.locator('.terminal-window').count()) throw new Error('window still present');
    if (await page.locator('.task-btn[data-task-id="terminal"]').count()) throw new Error('taskbar button lingered');
  });

  await step('start menu: opens and is keyboard reachable', async () => {
    await page.click('.start-btn');
    await page.waitForTimeout(300);
    if (await page.locator('.start-menu').isHidden()) throw new Error('menu hidden after click');
    const expanded = await page.getAttribute('.start-btn', 'aria-expanded');
    if (expanded !== 'true') throw new Error(`aria-expanded=${expanded}`);
    const focused = await page.evaluate(() => document.activeElement?.dataset?.app);
    if (!focused) throw new Error('focus did not enter the menu');
  });
  await shot('06-startmenu');
  await step('start menu: Escape closes', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    if (await page.locator('.start-menu').isVisible()) throw new Error('menu stayed open');
  });

  const apps = [
    ['ie', '.ie-window'],
    ['mail', '.mail-window'],
    ['paint', '.paint-window'],
    ['channels', '.channels-window'],
    ['dos', '.dos-library-window'],
  ];
  for (const [app, sel] of apps) {
    await step(`start menu -> ${app}`, async () => {
      await page.click('.start-btn');
      await page.waitForTimeout(200);
      await page.click(`.menu-item[data-app="${app}"]`);
      await page.waitForSelector(sel, { timeout: 6000 });
      await page.waitForTimeout(400);
    });
    await shot(`07-${app}`);
    await checkOverflow(app);
  }

  await step('mail: bring to front', async () => { await ensureVisible('.mail-window', 'mail'); });
  await step('mail: list populated + reader shows content', async () => {
    const n = await page.locator('.mail-list-item').count();
    if (n < 8) throw new Error(`only ${n} messages`);
    const html = await page.locator('.mail-reader-body').innerHTML();
    if (html.length < 100) throw new Error('reader empty');
  });
  await step('mail: sort by From toggles direction and reorders', async () => {
    const firstFrom = () => page.locator('.mail-list-item .from').first().innerText();
    const label = () => page.getAttribute('.mail-window .sortable[data-key="from"]', 'aria-label');
    await page.click('.mail-window .sortable[data-key="from"]');
    await page.waitForTimeout(250);
    const [labelA, rowA] = [await label(), await firstFrom()];
    await page.click('.mail-window .sortable[data-key="from"]');
    await page.waitForTimeout(250);
    const [labelB, rowB] = [await label(), await firstFrom()];
    // Sort state lives in the accessible name (aria-sort is invalid on a button).
    if (!/ascending/.test(labelA) || !/descending/.test(labelB)) {
      throw new Error(`accessible name did not reflect sort: "${labelA}" -> "${labelB}"`);
    }
    if (rowA === rowB) throw new Error(`list did not reorder; first row stayed "${rowA}"`);
  });
  await step('mail: compose + send lands in Sent', async () => {
    await page.click('.mail-window .btn-compose');
    await page.waitForSelector('.compose-window', { timeout: 5000 });
    await page.fill('.compose-window [data-field="to"]', 'sepi@oxford.test');
    await page.fill('.compose-window [data-field="subject"]', 'yo');
    await page.fill('.compose-window .compose-body', 'sup from 1999');
    await page.click('.compose-window .btn-send');
    await page.waitForTimeout(600);
    if (await page.locator('.compose-window').count()) throw new Error('compose window did not close');
    const folder = await page.getAttribute('.mail-window .folder-item[data-folder="Sent"]', 'aria-selected');
    if (folder !== 'true') throw new Error('did not switch to Sent');
    const subj = await page.locator('.mail-window [data-hdr="subject"]').innerText();
    if (!subj.includes('yo')) throw new Error(`reader shows "${subj}"`);
  });
  await step('mail: back to Inbox + delete', async () => {
    await page.click('.mail-window .folder-item[data-folder="Inbox"]');
    await page.waitForTimeout(300);
    const before = await page.locator('.mail-list-item').count();
    await page.click('.mail-window .btn-delete');
    await page.waitForTimeout(300);
    const after = await page.locator('.mail-list-item').count();
    if (after !== before - 1) throw new Error(`${before} -> ${after}`);
  });
  await step('mail: refresh runs', async () => {
    await page.click('.mail-window .btn-refresh');
    await page.waitForTimeout(2000);
    const status = await page.locator('.mail-window .mail-status').innerText().catch(() => '');
    if (!(await page.locator('.mail-list-item').count())) throw new Error('list emptied by refresh');
    void status;
  });
  await step('mail: toggle preview pane', async () => {
    await page.click('.mail-window .btn-preview');
    await page.waitForTimeout(250);
    const pressed = await page.getAttribute('.mail-window .btn-preview', 'aria-pressed');
    if (pressed !== 'true') throw new Error('aria-pressed not set');
    await page.click('.mail-window .btn-preview');
    await page.waitForTimeout(200);
  });
  await shot('08-mail');

  await step('channels: tile opens the slide deck', async () => {
    await ensureVisible('.channels-window', 'channels');
    await page.locator('.channels-window .channel-tile').first().click();
    await page.waitForSelector('.slides-window', { timeout: 5000 });
    await page.waitForTimeout(400);
  });
  await step('slides: next / prev update the counter', async () => {
    const first = await page.locator('.slides-count').innerText();
    await page.click('.slides-window [data-act="next"]');
    await page.waitForTimeout(250);
    const second = await page.locator('.slides-count').innerText();
    if (first === second) throw new Error(`counter stuck at ${first}`);
    await page.click('.slides-window [data-act="prev"]');
    await page.waitForTimeout(250);
    if ((await page.locator('.slides-count').innerText()) !== first) throw new Error('prev did not return');
  });
  await step('slides: second tile reuses one window', async () => {
    await ensureVisible('.channels-window', 'channels');
    await page.locator('.channels-window .channel-tile').nth(1).click();
    await page.waitForTimeout(400);
    const n = await page.locator('.slides-window').count();
    if (n !== 1) throw new Error(`${n} slide windows open`);
  });
  await shot('09-slides');

  await step('paint: draw a stroke', async () => {
    await ensureVisible('.paint-window', 'paint');
    await page.waitForTimeout(400);
    const c = page.locator('.paint-window .paint-draw');
    const bb = await c.boundingBox();
    if (!bb) throw new Error('canvas not laid out');
    await page.mouse.move(bb.x + 30, bb.y + 30);
    await page.mouse.down();
    await page.mouse.move(bb.x + Math.min(140, bb.width - 10), bb.y + Math.min(100, bb.height - 10), { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const painted = await c.evaluate((cv) => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
      return false;
    });
    if (!painted) throw new Error('no pixels drawn');
  });
  await step('paint: undo clears the stroke', async () => {
    await page.click('.paint-window [data-act="undo"]');
    await page.waitForTimeout(250);
    const painted = await page.locator('.paint-window .paint-draw').evaluate((cv) => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
      return false;
    });
    if (painted) throw new Error('undo left pixels behind');
  });
  await step('paint: eraser tool selectable', async () => {
    await page.click('.paint-window .paint-tool[data-tool="eraser"]');
    await page.waitForTimeout(150);
    const p = await page.getAttribute('.paint-window .paint-tool[data-tool="eraser"]', 'aria-pressed');
    if (p !== 'true') throw new Error('eraser not pressed');
  });
  await shot('10-paint');

  await step('desktop icon: Homework folder opens', async () => {
    // Use the product's own "Show Desktop" to reach the icons.
    await page.click('.start-btn');
    await page.waitForTimeout(200);
    await page.click('.menu-item[data-app="show-desktop"]');
    await page.waitForTimeout(300);
    const icon = page.locator('.desktop-icon[data-id="homework"]');
    if (vp.compact) await icon.click(); else await icon.dblclick();
    await page.waitForSelector('.folder-window', { timeout: 5000 });
    const files = await page.locator('.folder-window .file-item').count();
    if (files !== 4) throw new Error(`expected 4 files, got ${files}`);
  });
  await step('media player: opens and loads a clip', async () => {
    await page.click('.start-btn');
    await page.waitForTimeout(200);
    await page.click('.menu-item[data-app="show-desktop"]');
    await page.waitForTimeout(300);
    const icon = page.locator('.desktop-icon[data-id="media-player"]');
    if (vp.compact) await icon.click(); else await icon.dblclick();
    await page.waitForSelector('.media-player-window', { timeout: 6000 });
    await page.waitForTimeout(2000);
    const title = await page.locator('.wmp-track-title').innerText();
    if (!title.includes('.mp4')) throw new Error(`track title is "${title}"`);
    const status = await page.locator('.wmp-status-text').innerText();
    if (/cannot play/i.test(status)) throw new Error(`media error: ${status}`);
  });
  await step('media player: pause + seek controls respond', async () => {
    await page.click('.media-player-window [data-act="pause"]');
    await page.waitForTimeout(300);
    await page.click('.media-player-window [data-act="ff"]');
    await page.waitForTimeout(300);
    const t = await page.locator('.wmp-timer').innerText();
    // A browser without the codec cannot decode these clips at all. The player
    // is required to say so rather than pretend, so accept that reading here —
    // interact.mjs is what holds the honest-failure behaviour to account.
    const broken = await page.evaluate(() => !!document.querySelector('.media-player-window .wmp-media')?.error);
    if (broken) {
      if (!/^--:-- \/ --:--$/.test(t.trim())) throw new Error(`timer reads "${t}" for a file that never loaded`);
      return;
    }
    if (!/\d\d:\d\d \/ /.test(t)) throw new Error(`timer reads "${t}"`);
  });
  await shot('11-media');
  await checkOverflow('media');

  await step('DOS: launch a game and reach a video mode', async () => {
    await ensureVisible('.dos-library-window', 'dos-library');
    await page.click('.dos-library-window .dos-library__item[data-game="oregon"]');
    await page.waitForSelector('.dos-window', { timeout: 10000 });
    // The emulator lives in its own same-origin frame, so the canvas is not in
    // this document. Autostart means there is no click-to-start overlay.
    let frame = null;
    for (let i = 0; i < 60 && !frame; i++) {
      frame = page.frames().find((f) => f.url().includes('player.html'));
      if (!frame) await page.waitForTimeout(500);
    }
    if (!frame) throw new Error('the DOS player frame never loaded');
    // The canvas starts at the 300x150 HTML default; DOSBox resizes it once the
    // game sets a video mode, so that is the signal the game actually booted.
    let size = null;
    for (let i = 0; i < 120; i++) {
      size = await frame.evaluate(() => {
        const c = document.querySelector('canvas');
        return c && c.width > 300 && c.height > 150 ? `${c.width}x${c.height}` : null;
      }).catch(() => null);
      if (size) break;
      await page.waitForTimeout(500);
    }
    if (!size) throw new Error('the game never set a video mode');
    if (!/^\d{3,}x\d{3,}$/.test(size)) throw new Error(`unexpected canvas size ${size}`);
  });
  await shot('12-dos');

  await step('taskbar: buttons for every open window', async () => {
    const n = await page.locator('.taskbar-windows .task-btn').count();
    if (n < 5) throw new Error(`only ${n} taskbar buttons`);
  });
  await checkOverflow('final');
  await shot('13-final');

  // ---- static quality checks ----
  const smallTargets = await page.evaluate(() => {
    const min = 24; // WCAG 2.5.8 Target Size (Minimum), Level AA
    const out = new Set();
    document.querySelectorAll('button, [role="button"], a[href], input, .buddy-item, .menu-item, .file-item, .folder-item, .mail-list-item, .desktop-icon, .pl-item').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (getComputedStyle(el).visibility === 'hidden') return;
      if (r.width < min || r.height < min) {
        out.add(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)} (min ${min})`);
      }
    });
    return [...out];
  });

  const a11y = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('alt')) issues.push(`img without alt: ${i.src.slice(-40)}`); });
    document.querySelectorAll('button').forEach((b) => {
      const label = (b.textContent || '').trim() || b.getAttribute('aria-label') || b.title;
      if (!label) issues.push(`button without accessible name: .${(b.className || '').split(' ')[0]}`);
    });
    document.querySelectorAll('input').forEach((i) => {
      const id = i.id;
      const labelled = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || i.getAttribute('aria-label') || i.closest('label');
      if (!labelled) issues.push(`input without label: #${id || '(no id)'}`);
    });
    return [...new Set(issues)];
  });

  report[vp.name] = { steps, errors: [...new Set(errors)], failed: [...new Set(failed)], overflow: ov, smallTargets, a11y };
  await browser.close();
}

fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

let totalFail = 0;
for (const [k, v] of Object.entries(report)) {
  console.log(`\n########## ${k.toUpperCase()} ##########`);
  const fails = v.steps.filter((s) => s.startsWith('FAIL'));
  totalFail += fails.length;
  console.log(`steps: ${v.steps.length - fails.length} passed, ${fails.length} failed`);
  fails.forEach((s) => console.log('  ' + s));
  const ovs = Object.entries(v.overflow).filter(([, o]) => o.docW > o.winW + 1);
  console.log(`horizontal overflow: ${ovs.length ? ovs.map(([n, o]) => `${n} (${o.docW}>${o.winW})`).join(', ') : 'none'}`);
  console.log(`console errors/warnings: ${v.errors.length}`);
  v.errors.slice(0, 12).forEach((e) => console.log('  ' + e.slice(0, 200)));
  console.log(`failed requests: ${v.failed.length}`);
  v.failed.slice(0, 10).forEach((e) => console.log('  ' + e.slice(0, 160)));
  console.log(`tap targets below minimum: ${v.smallTargets.length}`);
  v.smallTargets.slice(0, 12).forEach((e) => console.log('  ' + e));
  console.log(`a11y issues: ${v.a11y.length}`);
  v.a11y.slice(0, 12).forEach((e) => console.log('  ' + e));
}
console.log(`\n===== TOTAL FAILED STEPS: ${totalFail} =====`);
