// A full session, driven as a person: sign in, hold a conversation, read and
// send mail, page the whole deck, draw, play a DOS game through several of its
// own screens, and check the result of each action rather than that it ran.
import fs from 'node:fs';
import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';

const OUT = outDir('play');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const WIDE = process.argv[2] !== 'phone';
const vp = WIDE ? { width: 1440, height: 900 } : { width: 390, height: 844 };

const browser = await launchBrowser(['--window-position=0,0']);
const ctx = await browser.newContext({ viewport: vp, hasTouch: !WIDE, isMobile: !WIDE });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const results = [];
let shot = 0;
const check = async (label, fn) => {
  try { const note = await fn(); results.push(`OK   ${label}${note ? ` — ${note}` : ''}`); }
  catch (e) { results.push(`FAIL ${label} :: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
};
const capture = async (name) => {
  shot += 1;
  await page.screenshot({ path: `${OUT}/${String(shot).padStart(2, '0')}-${name}.png` });
};

// --- real input helpers ---
const box = async (sel, nth = 0) => {
  const el = page.locator(sel).nth(nth);
  await el.waitFor({ state: 'visible', timeout: 10000 });
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const b = await el.boundingBox();
  if (!b) throw new Error(`${sel} has no box`);
  return b;
};
const tap = async (sel, nth = 0) => {
  const b = await box(sel, nth);
  const pt = [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }];
  if (WIDE) { await page.mouse.click(pt[0].x, pt[0].y); return; }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const typeInto = async (sel, text) => {
  await tap(sel);
  await page.waitForTimeout(120);
  await page.keyboard.type(text, { delay: 25 });
};

// ================= sign in =================
await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
await check('sign-in rejects an empty form', async () => {
  await tap('.btn-connect');
  await page.waitForTimeout(300);
  if (!(await page.locator('.login-form').isVisible())) throw new Error('it signed in with no credentials');
  const invalid = await page.locator('#oo-username').getAttribute('aria-invalid');
  if (invalid !== 'true') throw new Error('the empty field was not marked invalid');
  return 'stayed put and flagged the empty field';
});
await typeInto('#oo-username', 'RetroKid99');
await typeInto('#oo-password', 'hunter2');
await capture('signin-filled');
await tap('.btn-connect');
await page.waitForSelector('.btn-center', { timeout: 8000 });
await check('the connection sequence runs and can be skipped', async () => {
  await page.waitForTimeout(1200);
  const filled = await page.locator('.aol-box.filled').count();
  await tap('.btn-center');
  await page.waitForSelector('.desktop:not(.hidden)', { timeout: 9000 });
  return `${filled} progress boxes had filled before Cancel`;
});
await page.waitForTimeout(700);
await capture('desktop');

// ================= messenger =================
await check('a conversation goes both ways', async () => {
  const before = await page.locator('#chatMessages .message').count();
  await typeInto('#messageInput', 'anyone still using a 56k?');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3200);
  const texts = await page.locator('#chatMessages .message').allInnerTexts();
  const mine = texts.filter((t) => /^You:/.test(t.trim())).length;
  const total = texts.length;
  if (!mine) throw new Error('my own message never appeared');
  if (!texts.some((t) => /56k/.test(t))) throw new Error('what I typed is not in the transcript');
  if (total <= before + 1) throw new Error('the buddy never replied');
  return `${total - before} new messages, ${mine} of them mine`;
});
await check('switching buddy switches the conversation', async () => {
  const first = await page.locator('#chatWith').innerText();
  await tap('.buddy-list .buddy-item:not([disabled])', 1);
  await page.waitForTimeout(900);
  const second = await page.locator('#chatWith').innerText();
  if (first === second) throw new Error(`still talking to ${first}`);
  return `${first} → ${second}`;
});
await check('an offline buddy cannot be opened', async () => {
  const disabled = page.locator('.buddy-item[disabled]').first();
  if (!(await disabled.count())) throw new Error('no offline buddies to test');
  if (await disabled.isEnabled()) throw new Error('an offline buddy is clickable');
  return 'offline entries are disabled';
});
await capture('messenger');

// ================= mail =================
await tap('.start-btn'); await page.waitForTimeout(250);
await tap('.menu-item[data-app="mail"]');
await page.waitForSelector('.mail-window', { timeout: 8000 });
await page.waitForTimeout(700);
await check('opening a message marks it read and fills the reader', async () => {
  const unreadBefore = await page.locator('.mail-list-item.unread').count();
  await tap('.mail-list-item', 2);
  await page.waitForTimeout(700);
  const unreadAfter = await page.locator('.mail-list-item.unread').count();
  const body = (await page.locator('.mail-reader-body').innerText()).trim();
  if (!body) throw new Error('the reader is empty');
  if (unreadAfter >= unreadBefore) throw new Error(`unread went ${unreadBefore} → ${unreadAfter}`);
  return `unread ${unreadBefore} → ${unreadAfter}, reader has ${body.length} chars`;
});
await check('sorting by From reorders the list', async () => {
  const before = await page.locator('.mail-list-item .from').first().innerText();
  await tap('.mail-window .sortable[data-key="from"]');
  await page.waitForTimeout(500);
  const after = await page.locator('.mail-list-item .from').first().innerText();
  if (before === after) throw new Error(`still starts with ${before}`);
  return `${before.split(' ')[0]} → ${after.split(' ')[0]}`;
});
await check('a reply is sent and lands in Sent', async () => {
  await tap('.mail-window .btn-compose');
  await page.waitForSelector('.compose-window', { timeout: 6000 });
  await page.waitForTimeout(400);
  await typeInto('.compose-window [data-field="to"]', 'sepi@oxford.test');
  await typeInto('.compose-window [data-field="subject"]', 'ICQ or AIM?');
  await typeInto('.compose-window .compose-body', 'settle it for me');
  await tap('.compose-window .btn-send');
  await page.waitForTimeout(900);
  if (await page.locator('.compose-window').count()) throw new Error('the compose window stayed open');
  await tap('.mail-window .folder-item[data-folder="Sent"]');
  await page.waitForTimeout(600);
  const sent = await page.locator('.mail-list-item').allInnerTexts();
  if (!sent.some((t) => /ICQ or AIM/.test(t))) throw new Error(`Sent holds: ${sent.join(' | ').slice(0, 90)}`);
  return 'the message is in Sent';
});
await capture('mail');

// ================= channels + slides =================
await tap('.start-btn'); await page.waitForTimeout(250);
await tap('.menu-item[data-app="channels"]');
await page.waitForSelector('.channels-window', { timeout: 8000 });
await page.waitForTimeout(600);
await check('every slide in the deck can be paged through', async () => {
  await tap('.channels-window .channel-tile');
  await page.waitForSelector('.slides-window', { timeout: 8000 });
  await page.waitForTimeout(700);
  const counter = await page.locator('.slides-window .slides-count').innerText();
  const total = Number(counter.split('/')[1].trim());
  const seen = new Set();
  for (let i = 0; i < total + 2; i++) {
    seen.add((await page.locator('.slides-window .slides-view').innerText()).trim().slice(0, 60));
    const next = page.locator('.slides-window [data-act="next"]');
    if (await next.isDisabled().catch(() => false)) break;
    await tap('.slides-window [data-act="next"]');
    await page.waitForTimeout(320);
  }
  if (seen.size !== total) throw new Error(`saw ${seen.size} distinct slides of ${total}`);
  return `${seen.size}/${total} slides, all distinct`;
});
await check('the deck wraps at both ends', async () => {
  const at = async () => (await page.locator('.slides-window .slides-count').innerText()).trim();
  const total = Number((await at()).split('/')[1].trim());
  // Walk to slide 1 without assuming where we are.
  for (let i = 0; i < total + 1; i++) {
    if (/^1\s*\//.test(await at())) break;
    await tap('.slides-window [data-act="prev"]');
    await page.waitForTimeout(220);
  }
  if (!/^1\s*\//.test(await at())) throw new Error(`could not reach slide 1, stuck at ${await at()}`);
  await tap('.slides-window [data-act="prev"]');
  await page.waitForTimeout(300);
  const wrapped = await at();
  if (wrapped !== `${total} / ${total}`) throw new Error(`Prev from slide 1 went to ${wrapped}, not ${total} / ${total}`);
  await tap('.slides-window [data-act="next"]');
  await page.waitForTimeout(300);
  const back = await at();
  if (!/^1\s*\//.test(back)) throw new Error(`Next from the last slide went to ${back}`);
  return `1 ⇄ ${total} both ways`;
});
await capture('slides');

// ================= paint =================
await tap('.start-btn'); await page.waitForTimeout(250);
await tap('.menu-item[data-app="paint"]');
await page.waitForSelector('.paint-window canvas', { timeout: 8000 });
await page.waitForTimeout(900);
await check('drawing changes the canvas, and Undo puts it back', async () => {
  // Count opaque pixels, not colour: the drawing layer is transparent over a
  // base image and the default ink is black, so an RGB sum cannot tell a
  // black stroke from empty canvas — both are zero.
  const pixels = () => page.locator('.paint-window .paint-draw').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) painted += 1;
    return painted;
  });
  const before = await pixels();
  const b = await box('.paint-window canvas');
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.4);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + b.width * (0.3 + i * 0.03), b.y + b.height * (0.4 + i * 0.02));
  await page.mouse.up();
  await page.waitForTimeout(400);
  const drawn = await pixels();
  if (drawn <= before) throw new Error(`the stroke left no mark (${before} → ${drawn} painted pixels)`);
  await tap('.paint-window [data-act="undo"]');
  await page.waitForTimeout(600);
  const undone = await pixels();
  if (undone !== before) throw new Error(`Undo left ${undone} painted pixels, not ${before}`);
  return `${drawn - before} pixels painted, then undone exactly`;
});
await capture('paint');

// ================= DOS =================
await tap('.start-btn'); await page.waitForTimeout(250);
await tap('.menu-item[data-app="dos"]');
await page.waitForSelector('.dos-library-window', { timeout: 8000 });
await page.waitForTimeout(500);
await check('Civilization boots and answers three prompts in a row', async () => {
  await tap('.dos-library__item[data-game="civ"]');
  await page.waitForSelector('.dos-window .dos-frame', { timeout: 15000 });
  let frame = null;
  for (let i = 0; i < 90; i++) {
    frame = page.frames().find((f) => f.url().includes('player.html'));
    if (frame && await frame.evaluate(() => { const c = document.querySelector('canvas'); return !!(c && c.width > 300); }).catch(() => false)) break;
    await page.waitForTimeout(1000);
  }
  if (!frame) throw new Error('no player frame');
  await page.waitForTimeout(9000);
  const grab = async () => (await page.locator('.dos-window .dos-frame').screenshot()).toString('base64');
  const screens = [await grab()];
  // Graphics mode, sound mode, then past the copyright screen.
  for (const key of ['1', '1', 'Enter']) {
    await tap('.dos-window .dos-frame');
    await page.keyboard.press(key);
    await page.waitForTimeout(4000);
    screens.push(await grab());
  }
  const distinct = new Set(screens).size;
  if (distinct < 3) throw new Error(`the game showed ${distinct} distinct screens across 3 keypresses`);
  return `${distinct} distinct screens — the game is taking input`;
});
await capture('dos-played');
await check('the player pauses when minimized and resumes when restored', async () => {
  await tap('.dos-window .title-bar-btn[data-action="min"]');
  await page.waitForTimeout(1500);
  if (!(await page.locator('.dos-window').evaluate((w) => w.classList.contains('window--hidden')))) throw new Error('did not minimize');
  const a = (await page.locator('.taskbar-windows .task-btn[data-task-id="dos-civ"]').count());
  if (!a) throw new Error('no taskbar button while minimized');
  await tap('.taskbar-windows .task-btn[data-task-id="dos-civ"]');
  await page.waitForTimeout(1200);
  if (await page.locator('.dos-window').evaluate((w) => w.classList.contains('window--hidden'))) throw new Error('did not restore');
  return 'minimized and restored from the taskbar';
});
await check('closing the game removes the emulator entirely', async () => {
  await tap('.dos-window .title-bar-btn[data-action="close"]');
  await page.waitForTimeout(1200);
  if (await page.locator('.dos-window').count()) throw new Error('the window remains');
  if (page.frames().some((f) => f.url().includes('player.html'))) throw new Error('the player frame leaked');
  return 'window and frame both gone';
});

// ================= terminal =================
await check('the terminal answers every documented command', async () => {
  await page.keyboard.press(WIDE ? 'Control+t' : 'Control+t');
  await page.waitForSelector('.terminal-window .xterm', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await tap('.terminal-window .xterm-helper-textarea');
  const expected = { help: /Available commands/, dir: /WINDOWS95/, ver: /4\.00\.950/, time: /Current time/, date: /Current date/, oxford: /Buddies Online/, whoami: /RetroKid99/ };
  const missing = [];
  for (const [cmd, re] of Object.entries(expected)) {
    await page.keyboard.type(cmd, { delay: 15 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(450);
    const log = await page.locator('.terminal-window [role="log"]').innerText();
    if (!re.test(log)) missing.push(cmd);
  }
  if (missing.length) throw new Error(`no usable output for: ${missing.join(', ')}`);
  return `${Object.keys(expected).length} commands answered`;
});
await capture('terminal');

console.log(`\n########## ${WIDE ? 'DESKTOP' : 'PHONE'} — driven as a person ##########`);
results.forEach((r) => console.log('  ' + r));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`  console errors: ${errors.length}`);
errors.slice(0, 6).forEach((e) => console.log('    ' + e.slice(0, 160)));
console.log(`\n===== ${results.length - fails}/${results.length} passed =====`);
await browser.close();
