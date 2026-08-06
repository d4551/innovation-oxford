// Real-interaction audit.
//
// Runs a HEADED Chromium (under Xvfb) and drives the app the way a person
// does: mouse clicks and drags, real touch events via CDP on the mobile
// profiles, and keyboard input. Nothing is driven through page.evaluate —
// JS is used only to *read* state back for assertions, never to call into
// the application.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';

// A coarse colour grid of the player frame, for telling whether the screen
// changed between two moments.
//
// Deliberately NOT used to judge whether a game booted. Measured against a
// bundle whose autoexec named a missing program, DOSBox's own welcome banner
// scored higher on colour and on frame-to-frame change than either real game,
// and the emulated video mode was the same as Civilization's own text menu.
// Nothing visible in the frame separates "the game is running" from "DOSBox
// dropped to C:\>" — that is what tools/check-jsdos-bundles.py is for.
function screenMetrics(buf) {
  // pngjs always hands back 8-bit RGBA, whatever the source encoding.
  const { width: w, height: h, data: px } = PNG.sync.read(buf);
  const grid = [];
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4;
      grid.push((px[i] >> 4 << 8) | (px[i + 1] >> 4 << 4) | (px[i + 2] >> 4));
    }
  }
  return { grid };
}
function screenDiff(a, b) {
  if (a.grid.length !== b.grid.length) return 1;
  let d = 0;
  for (let i = 0; i < a.grid.length; i++) if (a.grid[i] !== b.grid[i]) d += 1;
  return d / a.grid.length;
}

const PAGE = `${BASE}/index.html`;
const OUT = outDir('act');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const ONLY = process.argv[2];
const PROFILES = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, touch: false, compact: false },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, touch: true, compact: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, compact: true },
].filter((p) => !ONLY || p.name === ONLY);

// --- read-only visual probe (measurement, not interaction) ------------------
const VISUAL_PROBE = () => {
  const problems = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    if (el.closest('.window--hidden, [hidden], .hidden, [inert], [aria-hidden="true"]')) return false;
    // Text placed off-screen for screen readers is meant to be unreadable and
    // clipped — judging it as layout would flag every live region and skip
    // link in the app.
    if (el.closest('.visually-hidden')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').filter(Boolean)[0] || '-'}`;
  const scrollParent = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) || /(auto|scroll)/.test(s.overflowX)) return n;
    }
    return null;
  };

  document.querySelectorAll('.desktop .window, .taskbar, .start-menu, .dialup-window').forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
      problems.push(`OFFSCREEN ${label(el)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  });

  // Controls sitting under the taskbar with no scroller that could reveal them.
  const taskbar = document.querySelector('.taskbar');
  if (taskbar) {
    const tb = taskbar.getBoundingClientRect();
    document.querySelectorAll('button, input, [tabindex="0"]').forEach((el) => {
      if (!visible(el) || el.closest('.taskbar')) return;
      const r = el.getBoundingClientRect();
      if (r.top < tb.top || r.top >= vh) return;
      const sp = scrollParent(el);
      const reachable = sp && sp.scrollHeight > sp.clientHeight + 4;
      if (!reachable) problems.push(`UNREACHABLE-UNDER-TASKBAR ${label(el)} top=${Math.round(r.top)} taskbarTop=${Math.round(tb.top)}`);
    });
  }

  document.querySelectorAll('.window-body *, .taskbar *, .start-menu *').forEach((el) => {
    if (!visible(el) || !el.firstChild || el.children.length > 0) return;
    const s = getComputedStyle(el);
    if (s.overflow !== 'visible' && s.overflow !== 'clip') return;
    if (s.textOverflow === 'ellipsis') return;
    if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
      problems.push(`CLIPPED-TEXT ${label(el)} "${(el.textContent || '').trim().slice(0, 36)}" ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
    }
  });

  document.querySelectorAll('button, a[href], input, select').forEach((el) => {
    if (!visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) problems.push(`TINY ${label(el)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
  });

  // Text cut off by an ancestor rather than by its own box. `text-overflow`
  // does nothing to a flex container's children, so a label can be sliced with
  // no ellipsis and — under a centred alignment — lose its *beginning*, which
  // is the half that identifies it.
  document.querySelectorAll('.window-body *, .taskbar *, .start-menu *').forEach((el) => {
    if (!visible(el) || el.children.length > 0 || !(el.textContent || '').trim()) return;
    const parent = el.parentElement;
    if (!parent) return;
    const ps = getComputedStyle(parent);
    if (ps.overflowX !== 'hidden' && ps.overflowX !== 'clip') return;
    const r = el.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    const cutLeft = pr.left - r.left;
    const cutRight = r.right - pr.right;
    if (cutLeft <= 1 && cutRight <= 1) return;
    const own = getComputedStyle(el);
    if (own.textOverflow === 'ellipsis' && own.overflow !== 'visible' && cutLeft <= 1) return;
    problems.push(`CUT-BY-ANCESTOR ${label(el)} "${(el.textContent || '').trim().slice(0, 30)}" loses ${Math.max(0, Math.round(cutLeft))}px at the start and ${Math.max(0, Math.round(cutRight))}px at the end inside ${label(parent)}`);
  });

  // Real WCAG 1.4.3 contrast, not a "looks about the same" heuristic. axe
  // returns *incomplete* — and so, silently, no violation — for text whose
  // background it cannot resolve, which is where the failures were hiding.
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const relLum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const l1 = relLum(a); const l2 = relLum(b);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  };
  document.querySelectorAll('body *').forEach((el) => {
    if (!visible(el) || el.children.length > 0 || !(el.textContent || '').trim()) return;
    const s = getComputedStyle(el);
    const fg = parse(s.color).slice(0, 3);
    if (fg.length < 3) return;
    let bg = null;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const st = getComputedStyle(n);
      // Text over artwork cannot be judged from computed styles alone.
      if (st.backgroundImage && st.backgroundImage !== 'none') return;
      const c = parse(st.backgroundColor);
      if (c.length >= 3 && (c[3] === undefined || c[3] >= 0.95)) { bg = c.slice(0, 3); break; }
    }
    if (!bg) return;
    const size = parseFloat(s.fontSize);
    const bold = (parseInt(s.fontWeight, 10) || 400) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const got = contrast(fg, bg);
    if (got < need) {
      problems.push(`LOW-CONTRAST ${got.toFixed(2)}:1 (needs ${need}) ${label(el)} "${(el.textContent || '').trim().slice(0, 26)}" ${s.color} on rgb(${bg.join(',')}) @${size}px`);
    }
  });

  document.querySelectorAll('.desktop .window').forEach((win) => {
    if (!visible(win)) return;
    const wr = win.getBoundingClientRect();
    const body = win.querySelector(':scope > .window-body');
    if (body) {
      const spill = Math.round(body.getBoundingClientRect().bottom - wr.bottom);
      if (spill > 1) problems.push(`BODY-OVERFLOWS-WINDOW ${label(win)} by ${spill}px`);
    }
    win.querySelectorAll('*').forEach((el) => {
      if (!visible(el)) return;
      const st = getComputedStyle(el);
      if (!/(auto|scroll)/.test(st.overflowY)) return;
      const r = el.getBoundingClientRect();
      const spill = Math.round(r.bottom - wr.bottom);
      if (spill > 2) problems.push(`SCROLLER-CLIPPED ${label(el)} extends ${spill}px past ${label(win)}; its scrollbar can never appear`);
    });
  });

  // Every control in the frontmost window and in the taskbar must actually be
  // hit-testable at its own centre. Catches overlays (toasts, badges, popups)
  // parked on top of buttons.
  const front = [...document.querySelectorAll('.desktop .window')]
    .filter((w) => visible(w))
    .sort((a, b) => (parseInt(a.style.zIndex, 10) || 0) - (parseInt(b.style.zIndex, 10) || 0))
    .pop();
  const menu = document.querySelector('.start-menu');
  const menuOpen = menu && visible(menu);
  // While the Start menu is up it is meant to cover the desktop, so only its
  // own items and the taskbar are expected to be hit-testable.
  [menuOpen ? null : front, document.querySelector('.taskbar'), menu]
    .filter((root) => root && visible(root))
    .forEach((root) => {
      root.querySelectorAll('button:not([disabled]), input, [tabindex="0"]').forEach((el) => {
        if (!visible(el)) return;
        const r = el.getBoundingClientRect();
        const x = r.x + r.width / 2;
        const y = r.y + r.height / 2;
        if (x < 0 || y < 0 || x > vw || y > vh) return;
        // An element scrolled outside its own scroller is clipped, not
        // obscured — that is what a scroll container is for.
        const sp = scrollParent(el);
        if (sp) {
          const sr = sp.getBoundingClientRect();
          if (x < sr.left + 1 || x > sr.right - 1 || y < sr.top + 1 || y > sr.bottom - 1) return;
        }
        const hit = document.elementFromPoint(x, y);
        if (hit && !el.contains(hit) && hit !== el) {
          problems.push(`OBSCURED-CONTROL ${label(el)} is covered by ${label(hit)}`);
        }
      });
    });

  if (document.documentElement.scrollWidth > vw + 1) {
    problems.push(`PAGE-OVERFLOW doc=${document.documentElement.scrollWidth} viewport=${vw}`);
  }
  return [...new Set(problems)];
};

const report = {};

for (const prof of PROFILES) {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({
    viewport: prof.viewport, hasTouch: prof.touch, isMobile: prof.touch,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  const cdp = await ctx.newCDPSession(page);

  const errors = [];
  const failed = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  // Attribute network failures to the step that was running, so an abort
  // caused by our own teardown is distinguishable from a broken request.
  let currentStep = 'boot';
  const T0 = Date.now();
  const stepLog = [];
  page.on('requestfailed', (r) => {
    let owner = 'gone';
    try { owner = r.frame() ? (r.frame().url().split('/').pop() || 'top') : 'detached'; } catch { owner = 'detached'; }
    failed.push(`FAILED ${r.url()} :: ${r.failure()?.errorText} [${r.resourceType()} in ${owner}] (during: ${currentStep} @${Date.now() - T0}ms)`);
  });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()} (during: ${currentStep})`); });
  // A game bundle is ~1.8MB. Count every request for one so a launch that
  // quietly downloads it twice — or a speculative fetch of a game nobody
  // opened — fails the run instead of hiding in the traffic.
  const bundleRequests = [];
  page.on('request', (r) => { if (r.url().endsWith('.jsdos')) bundleRequests.push(r.url().split('/').pop()); });
  // Byte-level truth for the game bundles. js-dos consumes the whole response
  // and then releases the stream, which Chromium records as ERR_ABORTED even
  // though every byte arrived — so judge these on bytes delivered against
  // Content-Length, not on the terminal status.
  const bundleBytes = [];
  const bundleShort = [];
  {
    const inflight = new Map();
    cdp.send('Network.enable').catch(() => {});
    cdp.on('Network.requestWillBeSent', (e) => { if (e.request.url.endsWith('.jsdos')) inflight.set(e.requestId, { url: e.request.url.split('/').pop(), bytes: 0, expected: 0 }); });
    cdp.on('Network.responseReceived', (e) => { const r = inflight.get(e.requestId); if (r) r.expected = Number(e.response.headers['content-length'] || e.response.headers['Content-Length'] || 0); });
    cdp.on('Network.dataReceived', (e) => { const r = inflight.get(e.requestId); if (r) r.bytes += e.dataLength; });
    const settle = (id, how) => {
      const r = inflight.get(id);
      if (!r) return;
      const whole = r.expected > 0 && r.bytes >= r.expected;
      bundleBytes.push(`${r.url} ${r.bytes}/${r.expected}B ${how}${whole ? ' — complete' : ''}`);
      if (!whole) bundleShort.push(`${r.url} delivered ${r.bytes} of ${r.expected} bytes (${how})`);
    };
    cdp.on('Network.loadingFinished', (e) => settle(e.requestId, 'finished'));
    cdp.on('Network.loadingFailed', (e) => settle(e.requestId, e.errorText));
  }

  const steps = [];
  const visual = [];
  let shotN = 0;
  const step = async (label, fn) => {
    currentStep = label;
    stepLog.push(`${Date.now() - T0}ms  START ${label}`);
    try { await fn(); steps.push(`OK   ${label}`); }
    catch (e) { steps.push(`FAIL ${label} :: ${String(e.message).split('\n')[0].slice(0, 175)}`); }
    stepLog.push(`${Date.now() - T0}ms  END   ${label}`);
  };
  const capture = async (name) => {
    stepLog.push(`${Date.now() - T0}ms  SHOT  ${name}`);
    shotN += 1;
    try { await page.screenshot({ path: `${OUT}/${prof.name}-${String(shotN).padStart(2, '0')}-${name}.png` }); } catch {}
    try { (await page.evaluate(VISUAL_PROBE)).forEach((f) => visual.push(`[${name}] ${f}`)); }
    catch (e) { visual.push(`[${name}] PROBE-ERROR ${e.message.slice(0, 70)}`); }
  };

  // ------------------------------------------------------------------
  // Real input helpers. Touch profiles get genuine touch events via CDP.
  // ------------------------------------------------------------------
  const centre = async (sel, nth = 0) => {
    const box = await page.locator(sel).nth(nth).boundingBox();
    if (!box) throw new Error(`${sel} has no box`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  };
  const touch = async (type, points) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y })) });

  /** A real tap (touch) or click (mouse) on the element's centre. */
  const press = async (sel, nth = 0) => {
    await page.locator(sel).nth(nth).scrollIntoViewIfNeeded().catch(() => {});
    const { x, y } = await centre(sel, nth);
    if (prof.touch) {
      await touch('touchStart', [{ x, y }]);
      await page.waitForTimeout(40);
      await touch('touchEnd', []);
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(30);
      await page.mouse.up();
    }
    await page.waitForTimeout(120);
  };
  /** Open something: double-click on pointer devices, single tap on touch. */
  const activate = async (sel, nth = 0) => {
    if (prof.touch) { await press(sel, nth); return; }
    const { x, y } = await centre(sel, nth);
    await page.mouse.dblclick(x, y);
    await page.waitForTimeout(150);
  };
  /** A real drag: touch move sequence or mouse drag. */
  const drag = async (from, to, steps = 14) => {
    if (prof.touch) {
      await touch('touchStart', [from]);
      for (let i = 1; i <= steps; i++) {
        await touch('touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]);
        await page.waitForTimeout(12);
      }
      await touch('touchEnd', []);
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
      }
      await page.mouse.up();
    }
    await page.waitForTimeout(200);
  };
  /** Type into a field by focusing it with a real press first. */
  const typeInto = async (sel, text) => {
    await press(sel);
    await page.keyboard.type(text, { delay: 12 });
  };
  /** Drag a range input's thumb to a fraction of its track. */
  const setSlider = async (sel, fraction) => {
    const box = await page.locator(sel).boundingBox();
    const y = box.y + box.height / 2;
    await drag({ x: box.x + 6, y }, { x: box.x + Math.max(6, box.width * fraction), y }, 8);
  };
  /** Is this the frontmost visible window? (read-only stacking measurement) */
  const isFront = async (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.classList.contains('window--hidden')) return false;
    const z = parseInt(el.style.zIndex, 10) || 0;
    return ![...document.querySelectorAll('.desktop .window')].some((o) =>
      o !== el && !o.classList.contains('window--hidden') && (parseInt(o.style.zIndex, 10) || 0) > z);
  }, sel);
  const isHidden = async (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    return !el || el.classList.contains('window--hidden');
  }, sel);
  /** Bring a window forward using only its taskbar button. */
  const raise = async (sel, taskId) => {
    for (let i = 0; i < 3; i++) {
      if (await isFront(sel)) return;
      await press(`.taskbar-windows .task-btn[data-task-id="${taskId}"]`);
      await page.waitForTimeout(300);
    }
    if (!(await isFront(sel))) throw new Error(`${sel} never came to the front via its taskbar button`);
  };
  const openApp = async (app, sel) => {
    await press('.start-btn');
    await page.waitForTimeout(250);
    await press(`.menu-item[data-app="${app}"]`);
    await page.waitForSelector(sel, { timeout: 9000 });
    await page.waitForTimeout(500);
  };

  // ================= sign-in =================
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await capture('login');

  await step('sign-in: empty submit is refused', async () => {
    await press('.btn-connect');
    await page.waitForTimeout(250);
    if (!(await page.locator('#dialup-intro').count())) throw new Error('let through with empty fields');
  });
  await step('sign-in: typing and submitting works', async () => {
    await typeInto('#oo-username', 'RetroKid99');
    await typeInto('#oo-password', 'hunter2');
    await press('.btn-connect');
    await page.waitForSelector('.btn-center', { timeout: 6000 });
  });
  await capture('dialup');
  await step('dial-up: progress boxes fill, Cancel skips', async () => {
    await page.waitForFunction(() => document.querySelectorAll('.aol-box.filled').length >= 1, { timeout: 7000 });
    await press('.btn-center');
    await page.waitForSelector('.desktop:not(.hidden)', { timeout: 6000 });
    await page.waitForTimeout(600);
  });
  await capture('desktop');

  // ================= messenger =================
  await step('chat: Send button posts and gets a reply', async () => {
    const before = await page.locator('#chatMessages .message').count();
    await typeInto('#messageInput', 'hey is this thing on');
    await press('.chat-input button[type="submit"]');
    await page.waitForTimeout(3000);
    const after = await page.locator('#chatMessages .message').count();
    if (after < before + 2) throw new Error(`${before} -> ${after}`);
    if (await page.locator('#chatTyping').count()) throw new Error('typing indicator stuck');
  });
  await step('chat: Enter key also sends', async () => {
    const before = await page.locator('#chatMessages .message').count();
    await typeInto('#messageInput', 'second message');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2800);
    if ((await page.locator('#chatMessages .message').count()) < before + 2) throw new Error('Enter did not send');
  });
  await step('chat: every online buddy is selectable', async () => {
    for (const name of ['xMarkTheNeil99x', 'SelvaTron', 'RandoBrando', 'Sepinator']) {
      await press(`.buddy-item[data-buddy="${name}"]`);
      await page.waitForTimeout(350);
      if ((await page.textContent('#chatToUser')) !== name) throw new Error(`header did not switch to ${name}`);
    }
  });
  await step('chat: offline buddies are inert', async () => {
    if (!(await page.locator('.buddy-item[data-buddy="RetroGamer"]').isDisabled())) throw new Error('offline buddy enabled');
  });
  await capture('chat');
  await step('chat: minimize via title bar, restore via taskbar', async () => {
    await press('.chat-window .title-bar-btn[data-action="min"]');
    await page.waitForTimeout(350);
    if (!(await isHidden('.chat-window'))) throw new Error('did not minimize');
    await press('.taskbar-windows .task-btn[data-task-id="chat"]');
    await page.waitForTimeout(350);
    if (await isHidden('.chat-window')) throw new Error('did not restore');
  });

  // ================= terminal =================
  await step('terminal: opens from the taskbar', async () => {
    await press('.taskbar-dos');
    await page.waitForSelector('.terminal-window', { timeout: 8000 });
    await page.waitForSelector('.xterm-screen', { timeout: 15000 });
    await page.waitForTimeout(600);
  });
  await step('terminal: typed commands work', async () => {
    await press('.terminal-container');
    await page.keyboard.type('help', { delay: 20 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.type('ver', { delay: 20 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.type('flurb', { delay: 20 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const t = await page.locator('.terminal-window').innerText();
    if (!/Available commands/.test(t)) throw new Error('help missing');
    if (!/Version 4\.00\.950/.test(t)) throw new Error('ver missing');
    if (!/Bad command/.test(t)) throw new Error('error message missing');
  });
  await step('terminal: output reaches assistive technology', async () => {
    // xterm renders to a canvas and marks its rows aria-hidden, so the visible
    // transcript is invisible to a screen reader. The app keeps its own log.
    const log = await page.evaluate(() => {
      const el = document.querySelector('.terminal-window [role="log"][aria-live]');
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        label: el.getAttribute('aria-label') || '',
        lines: el.childElementCount,
        text: el.textContent,
        onScreen: el.getBoundingClientRect().width > 4,
        hidden: s.display === 'none' || s.visibility === 'hidden',
      };
    });
    if (!log) throw new Error('the terminal has no live region — its output is never announced');
    if (!log.label) throw new Error('the live region has no name');
    if (log.hidden) throw new Error('the live region is hidden from assistive technology too');
    if (log.onScreen) throw new Error('the live region is showing on screen');
    if (!/Available commands/.test(log.text)) throw new Error('help output never reached the live region');
    if (!/Version 4\.00\.950/.test(log.text)) throw new Error('ver output never reached the live region');
    if (!/Bad command/.test(log.text)) throw new Error('the error message never reached the live region');
    if (log.lines < 10) throw new Error(`only ${log.lines} lines were announced`);
  });
  await step('terminal: ArrowUp recalls history', async () => {
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);
    const t = (await page.locator('.terminal-window').innerText()).trim();
    if (!/flurb$/.test(t)) throw new Error('history not recalled');
    for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
  });
  // Captured before `cls`, so the screenshot shows a terminal that has been
  // used rather than an empty prompt.
  await capture('terminal');
  await step('terminal: cls clears the screen and says so', async () => {
    await page.keyboard.type('cls');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const after = (await page.locator('.terminal-window').innerText()).trim();
    if (/Available commands|Bad command/.test(after)) throw new Error('cls left the old output on screen');
    if (!/C:\\WINDOWS>/.test(after)) throw new Error('cls left no prompt');
    const log = await page.evaluate(() => {
      const el = document.querySelector('.terminal-window [role="log"][aria-live]');
      return { text: el?.textContent || '', lines: el?.childElementCount ?? -1 };
    });
    if (!/Screen cleared/.test(log.text)) throw new Error('cls was never announced');
    if (/Available commands/.test(log.text)) throw new Error('the live region still holds the cleared output');
  });
  await capture('terminal-cleared');

  if (!prof.compact) {
    await step('terminal: dragged by its title bar', async () => {
      const b0 = await page.locator('.terminal-window').boundingBox();
      const bar = await page.locator('.terminal-window .title-bar').boundingBox();
      await drag({ x: bar.x + 60, y: bar.y + bar.height / 2 }, { x: bar.x + 160, y: bar.y + 110 });
      const b1 = await page.locator('.terminal-window').boundingBox();
      if (Math.abs(b1.x - b0.x) < 20 || Math.abs(b1.y - b0.y) < 20) throw new Error(`did not move: ${b0.x},${b0.y} -> ${b1.x},${b1.y}`);
    });
    await step('terminal: resized from every corner handle', async () => {
      for (const [dir, dx, dy] of [['se', 90, 60], ['sw', -60, 40], ['ne', 50, -30], ['nw', -40, -20]]) {
        const before = await page.locator('.terminal-window').boundingBox();
        const h = await page.locator(`.terminal-window .resize-${dir}`).boundingBox();
        await drag({ x: h.x + h.width / 2, y: h.y + h.height / 2 }, { x: h.x + h.width / 2 + dx, y: h.y + h.height / 2 + dy }, 10);
        const after = await page.locator('.terminal-window').boundingBox();
        if (Math.abs(after.width - before.width) < 10 && Math.abs(after.height - before.height) < 10) {
          throw new Error(`${dir} handle did nothing`);
        }
      }
    });
    await step('terminal: maximize then restore', async () => {
      const before = await page.locator('.terminal-window').boundingBox();
      await press('.terminal-window .title-bar-btn[data-action="max"]');
      await page.waitForTimeout(400);
      const max = await page.locator('.terminal-window').boundingBox();
      if (max.width < prof.viewport.width - 4) throw new Error(`only ${max.width} wide`);
      await press('.terminal-window .title-bar-btn[data-action="max"]');
      await page.waitForTimeout(400);
      const back = await page.locator('.terminal-window').boundingBox();
      if (Math.abs(back.width - before.width) > 4) throw new Error(`restored to ${back.width}, expected ${before.width}`);
    });
    await step('terminal: double-clicking the title bar maximizes', async () => {
      const bar = await page.locator('.terminal-window .title-bar').boundingBox();
      await page.mouse.dblclick(bar.x + 60, bar.y + bar.height / 2);
      await page.waitForTimeout(400);
      const box = await page.locator('.terminal-window').boundingBox();
      if (box.width < prof.viewport.width - 4) throw new Error('did not maximize');
      await page.mouse.dblclick(bar.x + 60, bar.y + bar.height / 2);
      await page.waitForTimeout(400);
    });
    await step('window cannot be dragged off-screen', async () => {
      const bar = await page.locator('.terminal-window .title-bar').boundingBox();
      await drag({ x: bar.x + 40, y: bar.y + bar.height / 2 }, { x: -400, y: -400 }, 10);
      const b = await page.locator('.terminal-window').boundingBox();
      if (b.x < -1 || b.y < -1) throw new Error(`escaped to ${b.x},${b.y}`);
    });
  } else {
    await step('compact: window is pinned full-bleed', async () => {
      const b = await page.locator('.terminal-window').boundingBox();
      if (Math.abs(b.width - prof.viewport.width) > 2) throw new Error(`width ${b.width}`);
      if (b.x > 1) throw new Error(`offset ${b.x}`);
    });
    await step('compact: a touch drag on the title bar does not move it', async () => {
      const b0 = await page.locator('.terminal-window').boundingBox();
      const bar = await page.locator('.terminal-window .title-bar').boundingBox();
      await drag({ x: bar.x + 40, y: bar.y + bar.height / 2 }, { x: bar.x + 180, y: bar.y + 150 });
      const b1 = await page.locator('.terminal-window').boundingBox();
      if (Math.abs(b1.x - b0.x) > 2) throw new Error('window drifted under a touch drag');
    });
  }

  await step('windows take and give back focus', async () => {
    // A window that opens without taking focus leaves a keyboard user tabbing
    // from the top of the document to reach what they just opened; one that
    // closes without handing focus back drops them on <body>.
    const focused = () => page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { where: 'BODY' };
      return {
        where: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').filter(Boolean)[0] || '-'}`,
        inWindow: !!el.closest('.desktop .window:not(.window--hidden)'),
        name: el.getAttribute('aria-label') || '',
      };
    });
    await press('.start-btn');
    await page.waitForTimeout(250);
    await press('.menu-item[data-app="mail"]');
    await page.waitForSelector('.mail-window', { timeout: 8000 });
    await page.waitForTimeout(500);
    const onOpen = await focused();
    if (!onOpen.inWindow) throw new Error(`opening a window left focus at ${onOpen.where}`);
    if (!onOpen.name) throw new Error('the focused window announces no name');

    await press('.mail-window .title-bar-btn[data-action="min"]');
    await page.waitForTimeout(500);
    const onMin = await focused();
    if (onMin.where === 'BODY') throw new Error('minimizing dropped focus to <body>');

    await press('.taskbar-windows .task-btn[data-task-id="mail"]');
    await page.waitForTimeout(500);
    const onRestore = await focused();
    if (!onRestore.inWindow) throw new Error(`restoring left focus at ${onRestore.where}`);

    await press('.mail-window .title-bar-btn[data-action="close"]');
    await page.waitForTimeout(500);
    const onClose = await focused();
    if (onClose.where === 'BODY') throw new Error('closing dropped focus to <body>');
  });
  await step('terminal: closes and clears its taskbar button', async () => {
    await press('.terminal-window .title-bar-btn[data-action="close"]');
    await page.waitForTimeout(400);
    if (await page.locator('.terminal-window').count()) throw new Error('window remains');
    if (await page.locator('.task-btn[data-task-id="terminal"]').count()) throw new Error('taskbar button remains');
  });

  // ================= start menu =================
  await step('start menu: opens and arrow keys move through it', async () => {
    await press('.start-btn');
    await page.waitForTimeout(300);
    if (await page.locator('.start-menu').isHidden()) throw new Error('did not open');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    const focused = await page.evaluate(() => document.activeElement?.dataset?.app);
    if (!focused) throw new Error('arrow keys did not move focus inside the menu');
  });
  // Captured with the menu open — the point of the shot.
  await capture('startmenu');
  await step('start menu: Escape closes it and gives focus back', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    if (await page.locator('.start-menu').isVisible()) throw new Error('Escape did not close it');
    const back = await page.evaluate(() => document.activeElement?.className || 'BODY');
    if (!/start-btn/.test(back)) throw new Error(`Escape left focus at ${back}, not the Start button`);
  });
  await step('start menu: a press outside closes it', async () => {
    await press('.start-btn');
    await page.waitForTimeout(250);
    if (prof.touch) { await touch('touchStart', [{ x: prof.viewport.width - 20, y: 60 }]); await touch('touchEnd', []); }
    else await page.mouse.click(prof.viewport.width - 20, 60);
    await page.waitForTimeout(300);
    if (await page.locator('.start-menu').isVisible()) throw new Error('stayed open');
  });

  // ================= apps =================
  for (const [app, sel] of [['ie', '.ie-window'], ['mail', '.mail-window'], ['paint', '.paint-window'], ['channels', '.channels-window'], ['dos', '.dos-library-window']]) {
    await step(`start menu launches ${app}`, async () => { await openApp(app, sel); });
    await capture(app);
  }

  await step('taskbar: pressing a covered window raises it', async () => {
    await raise('.mail-window', 'mail');
    await raise('.ie-window', 'internet-explorer');
    if (await isFront('.mail-window')) throw new Error('mail was not covered; test not exercising the rule');
    await press('.taskbar-windows .task-btn[data-task-id="mail"]');
    await page.waitForTimeout(400);
    if (await isHidden('.mail-window')) throw new Error('covered window was minimized instead of raised');
    if (!(await isFront('.mail-window'))) throw new Error('covered window was not raised');
  });
  await step('taskbar: pressing the front window minimizes it', async () => {
    await press('.taskbar-windows .task-btn[data-task-id="mail"]');
    await page.waitForTimeout(400);
    if (!(await isHidden('.mail-window'))) throw new Error('front window did not minimize');
    await press('.taskbar-windows .task-btn[data-task-id="mail"]');
    await page.waitForTimeout(400);
  });

  // ================= mail =================
  await step('mail: comes to the front', async () => { await raise('.mail-window', 'mail'); });
  await step('mail: pressing a row opens it in the reader', async () => {
    await press('.mail-list-item', 2);
    await page.waitForTimeout(400);
    const subject = await page.locator('.mail-list-item.active .subject').innerText();
    const header = await page.locator('.mail-window [data-hdr="subject"]').innerText();
    if (!header.trim() || header.trim() !== subject.trim()) throw new Error(`row "${subject}" vs reader "${header}"`);
  });
  await step('mail: list and reader scroll to their end', async () => {
    for (const sel of ['.mail-window .mail-list', '.mail-window .mail-reader-body']) {
      const box = await page.locator(sel).boundingBox();
      const before = await page.locator(sel).evaluate((el) => el.scrollTop);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 4000);
      await page.waitForTimeout(400);
      const info = await page.locator(sel).evaluate((el) => ({ top: el.scrollTop, sh: el.scrollHeight, ch: el.clientHeight }));
      if (info.sh <= info.ch + 2) continue; // nothing to scroll, fine
      if (info.top <= before) throw new Error(`${sel} did not scroll (${before} -> ${info.top}, ${info.sh} of ${info.ch})`);
      if (info.top + info.ch < info.sh - 4) throw new Error(`${sel} could not reach the end`);
    }
  });
  await step('mail: column headers sort both ways', async () => {
    const first = () => page.locator('.mail-list-item .from').first().innerText();
    await press('.mail-window .sortable[data-key="from"]');
    await page.waitForTimeout(350);
    const a = await first();
    const la = await page.getAttribute('.mail-window .sortable[data-key="from"]', 'aria-label');
    await press('.mail-window .sortable[data-key="from"]');
    await page.waitForTimeout(350);
    const b = await first();
    const lb = await page.getAttribute('.mail-window .sortable[data-key="from"]', 'aria-label');
    if (a === b) throw new Error('order unchanged');
    if (!/ascending/.test(la) || !/descending/.test(lb)) throw new Error(`labels "${la}" / "${lb}"`);
  });
  await step('mail: keyboard arrows walk the list', async () => {
    await press('.mail-list-item', 0);
    await page.waitForTimeout(250);
    const before = await page.locator('.mail-list-item.active .subject').innerText();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(350);
    const after = await page.locator('.mail-list-item.active .subject').innerText();
    if (before === after) throw new Error('ArrowDown did not move');
  });
  await step('mail: Mark Unread toggles the row', async () => {
    const wasUnread = await page.locator('.mail-list-item.active').evaluate((el) => el.classList.contains('unread'));
    await press('.mail-window .btn-mark');
    await page.waitForTimeout(300);
    const nowUnread = await page.locator('.mail-list-item.active').evaluate((el) => el.classList.contains('unread'));
    if (wasUnread === nowUnread) throw new Error('unread state unchanged');
  });
  await step('mail: Compose then Cancel sends nothing', async () => {
    await press('.mail-window .folder-item[data-folder="Sent"]');
    await page.waitForTimeout(300);
    const before = await page.locator('.mail-list-item').count();
    await press('.mail-window .folder-item[data-folder="Inbox"]');
    await page.waitForTimeout(300);
    await press('.mail-window .btn-compose');
    await page.waitForSelector('.compose-window');
    await press('.compose-window .btn-cancel');
    await page.waitForTimeout(350);
    if (await page.locator('.compose-window').count()) throw new Error('compose stayed open');
    await press('.mail-window .folder-item[data-folder="Sent"]');
    await page.waitForTimeout(300);
    if ((await page.locator('.mail-list-item').count()) !== before) throw new Error('a message was sent anyway');
    await press('.mail-window .folder-item[data-folder="Inbox"]');
    await page.waitForTimeout(300);
  });
  await step('mail: Compose, type, Send lands in Sent', async () => {
    await press('.mail-window .btn-compose');
    await page.waitForSelector('.compose-window');
    await typeInto('.compose-window [data-field="to"]', 'sepi@oxford.test');
    await typeInto('.compose-window [data-field="subject"]', 'yo from 1999');
    await typeInto('.compose-window .compose-body', 'sup');
    await capture('compose');
    await press('.compose-window .btn-send');
    await page.waitForTimeout(700);
    if (await page.locator('.compose-window').count()) throw new Error('compose did not close');
    if ((await page.getAttribute('.mail-window .folder-item[data-folder="Sent"]', 'aria-selected')) !== 'true') throw new Error('did not switch to Sent');
    if (!(await page.locator('.mail-window [data-hdr="subject"]').innerText()).includes('yo from 1999')) throw new Error('reader shows the wrong message');
  });
  await step('mail: Delete removes the row and reselects', async () => {
    await press('.mail-window .folder-item[data-folder="Inbox"]');
    await page.waitForTimeout(350);
    const before = await page.locator('.mail-list-item').count();
    await press('.mail-window .btn-delete');
    await page.waitForTimeout(400);
    if ((await page.locator('.mail-list-item').count()) !== before - 1) throw new Error('nothing deleted');
    if (!(await page.locator('.mail-list-item.active').count())) throw new Error('nothing reselected');
  });
  await step('mail: Preview Pane hides and shows the reader', async () => {
    await press('.mail-window .btn-preview');
    await page.waitForTimeout(350);
    if (await page.locator('.mail-reader').isVisible()) throw new Error('reader still visible');
    await press('.mail-window .btn-preview');
    await page.waitForTimeout(350);
    if (!(await page.locator('.mail-reader').isVisible())) throw new Error('reader did not return');
  });
  await step('mail: Reply prefills the compose window', async () => {
    await press('.mail-window .btn-reply');
    await page.waitForSelector('.compose-window');
    const subject = await page.locator('.compose-window [data-field="subject"]').inputValue();
    if (!/^Re: /.test(subject)) throw new Error(`subject is "${subject}"`);
    await press('.compose-window .btn-cancel');
    await page.waitForTimeout(300);
  });
  await step('mail: Refresh keeps the list usable', async () => {
    await press('.mail-window .btn-refresh');
    await page.waitForTimeout(2400);
    if (!(await page.locator('.mail-list-item').count())) throw new Error('list emptied');
  });
  if (!prof.compact) {
    await step('mail: splitter drags', async () => {
      const before = await page.locator('.mail-list').boundingBox();
      const bar = await page.locator('.mail-resizer').boundingBox();
      await drag({ x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 }, { x: bar.x + bar.width / 2 + 90, y: bar.y + bar.height / 2 }, 10);
      const after = await page.locator('.mail-list').boundingBox();
      if (Math.abs(after.width - before.width) < 20) throw new Error(`width ${before.width} -> ${after.width}`);
    });
  }
  await capture('mail-worked');

  // ================= channels + slides =================
  await step('channels: a tile opens the deck', async () => {
    await raise('.channels-window', 'channels');
    await press('.channels-window .channel-tile', 0);
    await page.waitForSelector('.slides-window', { timeout: 8000 });
    await page.waitForTimeout(500);
  });
  await step('slides: Next/Prev buttons and arrow keys', async () => {
    const count = () => page.locator('.slides-count').innerText();
    const a = await count();
    await press('.slides-window [data-act="next"]');
    await page.waitForTimeout(300);
    if ((await count()) === a) throw new Error(`Next stuck at ${a}`);
    await press('.slides-view');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    await press('.slides-window [data-act="prev"]');
    await page.waitForTimeout(300);
    if ((await count()) !== a) throw new Error(`did not return to ${a}`);
  });
  await step('slides: a second tile reuses the same window', async () => {
    await raise('.channels-window', 'channels');
    await press('.channels-window .channel-tile', 2);
    await page.waitForTimeout(500);
    if ((await page.locator('.slides-window').count()) !== 1) throw new Error('a second deck window opened');
  });
  await capture('slides');

  // ================= paint =================
  await step('paint: drawing with a real drag marks the canvas', async () => {
    await raise('.paint-window', 'paint');
    await page.waitForTimeout(500);
    const box = await page.locator('.paint-window .paint-draw').boundingBox();
    if (!box) throw new Error('canvas has no box');
    const painted = () => page.locator('.paint-window .paint-draw').evaluate((cv) => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
      return false;
    });
    await drag({ x: box.x + 25, y: box.y + 25 },
               { x: box.x + Math.min(150, box.width - 15), y: box.y + Math.min(110, box.height - 15) }, 16);
    if (!(await painted())) throw new Error(`no pixels drawn by a ${prof.touch ? 'touch' : 'mouse'} drag`);
  });
  await step('paint: Undo then Redo', async () => {
    const painted = () => page.locator('.paint-window .paint-draw').evaluate((cv) => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
      return false;
    });
    await press('.paint-window [data-act="undo"]');
    await page.waitForTimeout(350);
    if (await painted()) throw new Error('undo left pixels');
    await press('.paint-window [data-act="redo"]');
    await page.waitForTimeout(350);
    if (!(await painted())) throw new Error('redo did not restore');
  });
  await step('paint: brush size slider drags', async () => {
    const before = await page.locator('.paint-window .paint-size').inputValue();
    await setSlider('.paint-window .paint-size', 0.85);
    const after = await page.locator('.paint-window .paint-size').inputValue();
    if (before === after) throw new Error(`slider stuck at ${before}`);
  });
  await step('paint: eraser tool selects and erases', async () => {
    await press('.paint-window .paint-tool[data-tool="eraser"]');
    await page.waitForTimeout(250);
    if ((await page.getAttribute('.paint-window .paint-tool[data-tool="eraser"]', 'aria-pressed')) !== 'true') throw new Error('not selected');
    const box = await page.locator('.paint-window .paint-draw').boundingBox();
    await drag({ x: box.x + 25, y: box.y + 25 },
               { x: box.x + Math.min(150, box.width - 15), y: box.y + Math.min(110, box.height - 15) }, 16);
    await press('.paint-window .paint-tool[data-tool="pencil"]');
    await page.waitForTimeout(200);
    if ((await page.getAttribute('.paint-window .paint-tool[data-tool="pencil"]', 'aria-pressed')) !== 'true') throw new Error('pencil not reselected');
  });
  await capture('paint');

  // ================= desktop icons, folder, media =================
  await step('Show Desktop clears the screen', async () => {
    await press('.start-btn');
    await page.waitForTimeout(250);
    await press('.menu-item[data-app="show-desktop"]');
    await page.waitForTimeout(500);
    const open = await page.evaluate(() => [...document.querySelectorAll('.desktop .window')]
      .filter((w) => !w.classList.contains('window--hidden')).length);
    if (open) throw new Error(`${open} windows still showing`);
  });
  await capture('show-desktop');
  await step('desktop icon opens the Homework folder', async () => {
    await activate('.desktop-icon[data-id="homework"]');
    await page.waitForSelector('.folder-window', { timeout: 8000 });
    await page.waitForTimeout(400);
    if ((await page.locator('.folder-window .file-item').count()) !== 4) throw new Error('wrong file count');
    // Files start at the top of the pane. Centring them was invisible in a
    // small desktop window and left them stranded mid-screen full-bleed.
    const top = await page.evaluate(() => {
      const pane = document.querySelector('.folder-window .folder-content').getBoundingClientRect();
      const first = document.querySelector('.folder-window .file-item').getBoundingClientRect();
      return Math.round(first.top - pane.top);
    });
    if (top > 40) throw new Error(`the file grid starts ${top}px down an empty pane`);
  });
  await capture('folder');
  await step('folder: opening a clip launches the media player', async () => {
    await activate('.folder-window .file-item', 1);
    await page.waitForSelector('.media-player-window', { timeout: 9000 });
    await page.waitForTimeout(2500);
    const title = await page.locator('.wmp-track-title').innerText();
    if (!title.includes('.mp4')) throw new Error(`title is "${title}"`);
  });
  await step('media player: the folder playlist is listed and fits', async () => {
    const n = await page.locator('.wmp-playlist .pl-item').count();
    if (n !== 4) throw new Error(`playlist has ${n} items, expected 4`);
    const spill = await page.evaluate(() => {
      const win = document.querySelector('.media-player-window').getBoundingClientRect();
      const list = document.querySelector('.wmp-playlist');
      // Items may scroll inside the playlist; what must not happen is the
      // playlist box itself hanging outside the window.
      return Math.round(list.getBoundingClientRect().bottom - win.bottom);
    });
    if (spill > 1) throw new Error(`playlist box hangs ${spill}px outside the window`);
  });
  await step('media player: transport buttons respond', async () => {
    const seen = new Set();
    for (const act of ['play', 'pause', 'stop', 'rew', 'ff']) {
      await press(`.media-player-window [data-act="${act}"]`);
      await page.waitForTimeout(250);
      seen.add(await page.evaluate(() => {
        const w = document.querySelector('.media-player-window');
        return [...w.classList].find((c) => c.startsWith('wmp-state-')) || 'none';
      }));
    }
    const after = await page.evaluate(() => ({
      broken: !!document.querySelector('.media-player-window .wmp-media')?.error,
      status: (document.querySelector('.media-player-window .wmp-status-text')?.textContent || '').trim(),
      timer: (document.querySelector('.wmp-timer')?.textContent || '').trim(),
    }));
    if (after.broken) {
      // A source that cannot decode must not be made to look like it is
      // playing: the buttons stay honest and the message stands.
      if (seen.size !== 1 || !seen.has('wmp-state-stopped')) {
        throw new Error(`an unplayable file drove the player through ${[...seen].join(', ')}`);
      }
      if (!/can't play|cannot play|unsupported|error/i.test(after.status)) {
        throw new Error(`pressing play on an unplayable file replaced the message with "${after.status}"`);
      }
      if (!/^--:-- \/ --:--$/.test(after.timer)) throw new Error(`timer reads "${after.timer}" for a file that never loaded`);
      return;
    }
    if (seen.size < 2) throw new Error(`the player never changed state (stayed ${[...seen]})`);
    if (!/^\d\d:\d\d \/ /.test(after.timer)) throw new Error(`timer reads "${after.timer}"`);
  });
  await step('media player: volume slider drags', async () => {
    const before = await page.locator('.media-player-window .wmp-vol').inputValue();
    await setSlider('.media-player-window .wmp-vol', 0.3);
    const after = await page.locator('.media-player-window .wmp-vol').inputValue();
    if (before === after) throw new Error(`volume stuck at ${before}`);
  });
  await step('media player: a playlist entry loads', async () => {
    const before = await page.locator('.wmp-track-title').innerText();
    await press('.wmp-playlist .pl-item', 2);
    await page.waitForTimeout(1200);
    const after = await page.locator('.wmp-track-title').innerText();
    if (before === after) throw new Error(`track stayed "${before}"`);
    // The playlist is a listbox; exactly one option has to say it is the one
    // playing, on screen and in the accessibility tree.
    const sel = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.media-player-window .pl-item')];
      const chosen = items.filter((el) => el.getAttribute('aria-selected') === 'true');
      return {
        count: chosen.length,
        marked: chosen.filter((el) => el.classList.contains('pl-item--current')).length,
        activedescendant: document.querySelector('.wmp-playlist')?.getAttribute('aria-activedescendant') || '',
        chosenId: chosen[0]?.id || '',
      };
    });
    if (sel.count !== 1) throw new Error(`${sel.count} playlist entries claim to be the current track`);
    if (sel.marked !== 1) throw new Error('the current track is announced but not shown');
    if (sel.activedescendant !== sel.chosenId) throw new Error(`aria-activedescendant is "${sel.activedescendant}", not the selected option`);
  });
  await step('media player: an unplayable track says so instead of hanging', async () => {
    // This Chromium has no H.264, so the .mp4 clips genuinely cannot decode.
    // That is the environment's limit — but the player still has to tell the
    // user rather than sit on "Loading…" or "Paused" for ever.
    //
    // Wait for it to reach an outcome before judging which one. Deciding a
    // track "neither loaded nor errored" the instant after pressing play tests
    // how fast this machine is, not what the player does — and a large clip on
    // the phone pass is exactly where that misfires.
    await page.waitForFunction(() => {
      const m = document.querySelector('.media-player-window .wmp-media');
      return !!m && (!!m.error || m.readyState >= 2);
    }, null, { timeout: 20000 }).catch(() => { /* fall through and report what it settled on */ });
    const state = await page.evaluate(() => {
      const media = document.querySelector('.media-player-window .wmp-media');
      return {
        found: !!media,
        src: (media?.currentSrc || '').split('/').pop(),
        broken: !!media?.error,
        ready: media?.readyState ?? -1,
        status: (document.querySelector('.media-player-window .wmp-status-text')?.textContent || '').trim(),
        spinner: !!document.querySelector('.media-player-window .wmp-clickstart:not([hidden])'),
        timer: (document.querySelector('.media-player-window .wmp-timer')?.textContent || '').trim(),
        currentTime: media?.currentTime,
      };
    });
    if (!state.found) throw new Error('no media element in the player');
    if (state.broken) {
      if (!/can't play|cannot play|unsupported|error/i.test(state.status)) {
        throw new Error(`${state.src} failed to decode but the player says "${state.status}"`);
      }
      if (state.spinner) throw new Error('a failed source still shows the click-to-play prompt');
      if (/^0[0-9]:[0-9][0-9]/.test(state.timer) && !/^00:00/.test(state.timer)) {
        throw new Error(`${state.src} never started but reads "${state.timer}" — the last track's position (currentTime ${state.currentTime}, readyState ${state.ready})`);
      }
      return;
    }
    // No error: then the track must actually have loaded. Either way the
    // player has to end up somewhere other than "Loading".
    if (state.ready < 2) throw new Error(`${state.src} neither loaded nor errored (readyState ${state.ready}, status "${state.status}")`);
    if (/^loading/i.test(state.status)) throw new Error(`loaded but still says "${state.status}"`);
  });
  await capture('media');

  // ================= internet explorer =================
  await step('internet explorer: address shows the course URL', async () => {
    await raise('.ie-window', 'internet-explorer');
    const url = await page.locator('.ie-address').inputValue();
    if (!/lifelong-learning\.ox\.ac\.uk/.test(url)) throw new Error(`address is "${url}"`);
    if (!(await page.locator('.ie-snapshot').isVisible())) throw new Error('snapshot not visible');
  });
  await capture('ie-worked');

  // ================= DOS =================
  await step('DOS: every shipped bundle starts the program it claims to', async () => {
    // Screen pixels cannot tell a running game from a DOS prompt, so check the
    // archives themselves: this is the failure that shipped a Civilization
    // bundle whose autoexec ran Oregon Trail's executable.
    try {
      execFileSync('python3', [`${REPO_ROOT}/tools/check-jsdos-bundles.py`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      throw new Error((e.stderr || e.stdout || e.message).trim().split('\n').join(' | '));
    }
  });
  await step('DOS: opening the shelf downloads no game', async () => {
    await raise('.dos-library-window', 'dos-library');
    if (bundleRequests.length) throw new Error(`shelf fetched ${bundleRequests.join(', ')} before anything was launched`);
  });
  await step('DOS: a game boots to a video mode', async () => {
    await raise('.dos-library-window', 'dos-library');
    await press('.dos-library-window .dos-library__item[data-game="oregon"]');
    await page.waitForSelector('.dos-window', { timeout: 15000 });
    await page.waitForSelector('.dos-window .dos-frame', { timeout: 15000 });
    // js-dos 8 boots straight into the game; wait for the emulator to set a
    // real video mode inside its own frame.
    let size = null;
    for (let i = 0; i < 90 && !size; i++) {
      const f = page.frames().find((fr) => fr.url().includes('player.html'));
      if (f) {
        size = await f.evaluate(() => {
          const c = document.querySelector('canvas');
          return c && c.width > 300 && c.height > 150 ? `${c.width}x${c.height}` : null;
        }).catch(() => null);
      }
      if (!size) await page.waitForTimeout(1000);
    }
    if (!size) throw new Error('the emulator never reached a video mode');
    await page.waitForTimeout(6000);

    // The emulator has to be listening. Compare the change a keypress makes
    // against the drift of an idle screen, so a blinking cursor cannot pass
    // for a response.
    const shot = () => page.locator('.dos-window .dos-frame').screenshot();
    const before = screenMetrics(await shot());
    await page.waitForTimeout(2500);
    const idle = screenMetrics(await shot());
    await press('.dos-window .dos-frame');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3500);
    const after = screenMetrics(await shot());
    const drift = screenDiff(before, idle);
    const reaction = screenDiff(before, after);
    // Judge the keypress against the screen's own idle movement, additively:
    // a multiple does not work because these title screens animate, so the
    // idle baseline is anything from 0.2% (a blinking cursor) to 10% (Oregon
    // Trail's wagon). A response has to clear that baseline by a wide margin.
    if (reaction < 0.02 || reaction < drift + 0.05) {
      throw new Error(`a keypress changed ${(100 * reaction).toFixed(1)}% of the screen against ${(100 * drift).toFixed(1)}% idle drift — the game is not reading input`);
    }

    const oregon = bundleRequests.filter((u) => u === 'oregon.jsdos');
    if (oregon.length !== 1) throw new Error(`oregon.jsdos requested ${oregon.length}×`);
    if (bundleRequests.length !== 1) throw new Error(`also fetched ${bundleRequests.filter((u) => u !== 'oregon.jsdos').join(', ')}`);
    const frames = page.frames().filter((f) => f.url().includes('player.html')).length;
    if (frames !== 1) throw new Error(`${frames} player frames for one game`);
  });
  await step('DOS: the game is reachable and playable from the keyboard', async () => {
    // Tab has to walk past the window chrome and into the player frame, and
    // keystrokes have to land in the emulator once it is there.
    await page.evaluate(() => document.querySelector('.dos-window')?.focus());
    let reached = false;
    for (let i = 0; i < 8 && !reached; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(150);
      reached = await page.evaluate(() => document.activeElement?.classList?.contains('dos-frame'));
    }
    if (!reached) throw new Error('Tab never reached the player frame');
    // The first stop inside the frame must be the game, not a control — Enter
    // and Space are keys these games use, and on a button they would never
    // reach DOSBox.
    const frame = page.frames().find((fr) => fr.url().includes('player.html'));
    const first = await frame.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, role: el?.getAttribute('role'), name: el?.getAttribute('aria-label') || '' };
    });
    if (first.tag !== 'CANVAS') throw new Error(`tabbing into the player lands on ${first.tag}.${first.role || '-'} "${first.name}", not the game`);
    if (!first.name) throw new Error('the game screen has no accessible name');
    const shot = () => page.locator('.dos-window .dos-frame').screenshot();
    const start = screenMetrics(await shot());
    await page.waitForTimeout(2200);
    const still = screenMetrics(await shot());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    const moved = screenMetrics(await shot());
    const idle = screenDiff(start, still);
    const acted = screenDiff(start, moved);
    if (acted < 0.02 || acted < idle + 0.05) {
      throw new Error(`typing into the focused frame changed ${(100 * acted).toFixed(1)}% against ${(100 * idle).toFixed(1)}% idle`);
    }
  });
  await step('DOS: the window keeps its own title bar and chrome', async () => {
    const ok = await page.evaluate(() => {
      const win = document.querySelector('.dos-window');
      const tb = win.querySelector('.title-bar').getBoundingClientRect();
      const hit = document.elementFromPoint(tb.x + 8, tb.y + tb.height / 2);
      const frame = win.querySelector('.dos-frame').getBoundingClientRect();
      const wr = win.getBoundingClientRect();
      return {
        titleBarOwned: !!hit && !!hit.closest('.title-bar'),
        frameInside: frame.right <= wr.right + 2 && frame.bottom <= wr.bottom + 2 && frame.top >= wr.top - 2,
      };
    });
    if (!ok.titleBarOwned) throw new Error('the player covered the window title bar');
    if (!ok.frameInside) throw new Error('the player frame escaped the window');
  });
  await step('DOS: the player cannot restyle the desktop', async () => {
    // js-dos ships a Tailwind preflight that zeroes every border; the frame is
    // what keeps it off the Windows 95 chrome.
    // Compact mode deliberately drops three of the four window borders, so
    // assert on the bottom edge — the one the app keeps in both layouts.
    const chrome = await page.evaluate(() => {
      const g = (sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : null; };
      return {
        taskbarBorder: g('.taskbar .btn-95', 'borderTopWidth'),
        windowBorder: g('.dos-window', 'borderBottomWidth'),
        font: getComputedStyle(document.body).fontFamily,
      };
    });
    if (chrome.taskbarBorder !== '2px') throw new Error(`taskbar button border is ${chrome.taskbarBorder}`);
    if (chrome.windowBorder !== '2px') throw new Error(`window border is ${chrome.windowBorder}`);
    if (!/MS Sans Serif/.test(chrome.font)) throw new Error(`body font is ${chrome.font}`);
  });
  // js-dos draws its own controls as unlabelled divs with click handlers.
  // player.html upgrades them; these steps hold that upgrade to the same
  // standard as the rest of the app, and fail loudly if a js-dos version bump
  // renames something the upgrade keys on.
  const player = () => page.frames().find((fr) => fr.url().includes('player.html'));
  const CONTROL_AUDIT = () => {
    const bad = [];
    const seen = [];
    const check = (el, what, needsTabStop) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (!r.width || !r.height || s.display === 'none' || s.visibility === 'hidden') return;
      const isField = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
      const owning = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
      const name = (el.getAttribute('aria-label')
        || (owning || el.closest('label') ? (owning || el.closest('label')).textContent : '')
        || (isField ? '' : el.textContent) || '').trim();
      const id = `${what} .${String(el.className || '').split(' ').filter(Boolean).slice(0, 2).join('.')}`;
      seen.push(id);
      if (!el.getAttribute('role') && !isField && el.tagName !== 'BUTTON') bad.push(`no role: ${id}`);
      if (!name) bad.push(`no accessible name: ${id}`);
      if (needsTabStop && el.tabIndex < 0) bad.push(`not focusable: ${id}`);
      if (r.width < 24 || r.height < 24) bad.push(`target ${Math.round(r.width)}x${Math.round(r.height)}: ${id}`);
    };
    document.querySelectorAll('.sidebar-thin > div').forEach((el) => check(el, 'rail', true));
    document.querySelectorAll('.sidebar-button').forEach((el) => check(el, 'sidebar', true));
    document.querySelectorAll('.jsdos-rso input, .jsdos-rso select, .jsdos-rso textarea').forEach((el) => check(el, 'field', true));
    // The soft keys are deliberately outside the tab order.
    document.querySelectorAll('.soft-keyboard kbd').forEach((el) => check(el, 'key', false));
    return { bad: [...new Set(bad)], count: seen.length };
  };

  await step("DOS: the player's own controls are labelled and keyboard-operable", async () => {
    const f = player();
    if (!f) throw new Error('no player frame');
    let audit = await f.evaluate(CONTROL_AUDIT);
    if (audit.bad.length) throw new Error(`initial: ${audit.bad.join('; ')}`);
    // On touch the sidebar starts open, because there it is the only keyboard
    // the player has. With a mouse it starts collapsed, and expanding it from
    // the keyboard is the whole point of the fix.
    if (await f.locator('.sidebar-thin').count()) {
      await f.locator('.sidebar-thin > [role="button"]').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1200);
      if (!(await f.locator('.sidebar').count())) throw new Error('Enter on the rail did not expand the sidebar');
    } else if (prof.touch === false) {
      throw new Error('a pointer device should get the collapsed rail');
    }
    audit = await f.evaluate(CONTROL_AUDIT);
    if (audit.bad.length) throw new Error(`expanded: ${audit.bad.join('; ')}`);
    const named = await f.locator('.sidebar-button[aria-label]').count();
    if (named < 4) throw new Error(`only ${named} sidebar controls carry a label — js-dos markup probably changed`);
    const ring = await f.evaluate(() => {
      const el = document.querySelector('[aria-label="Toggle full screen"]');
      el.focus();
      return getComputedStyle(document.activeElement).outlineWidth;
    });
    if (ring === '0px') throw new Error('focused player control shows no outline');
  });

  await step("DOS: the player's panels name every field", async () => {
    const f = player();
    for (const label of ['Player settings', 'Speed and turbo settings']) {
      await f.locator(`[aria-label="${label}"]`).click();
      await page.waitForTimeout(1300);
      const audit = await f.evaluate(CONTROL_AUDIT);
      if (audit.bad.length) throw new Error(`${label}: ${audit.bad.join('; ')}`);
      await f.locator(`[aria-label="${label}"]`).click();
      await page.waitForTimeout(700);
    }
  });

  await step('DOS: the on-screen keyboard is labelled and works from the keyboard', async () => {
    const f = player();
    await f.locator('[aria-label="Toggle on-screen keyboard"]').click();
    await page.waitForTimeout(1400);
    const before = await f.locator('.soft-keyboard kbd').count();
    if (before < 20) throw new Error(`only ${before} keys appeared`);
    const audit = await f.evaluate(CONTROL_AUDIT);
    if (audit.bad.length) throw new Error(audit.bad.join('; '));
    // js-dos's keys answer to pointer events only, so keyboard activation has
    // to synthesise them; the layout key changes the key set, which shows it.
    await f.locator('[aria-label="Switch keyboard layout"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1400);
    const after = await f.locator('.soft-keyboard kbd').count();
    if (after === before) throw new Error('Enter on a soft key did nothing');
    await f.locator('[aria-label="Toggle on-screen keyboard"]').click();
    await page.waitForTimeout(800);
  });

  await step('DOS: minimize pauses, restore resumes, close tears down', async () => {
    await press('.dos-window .title-bar-btn[data-action="min"]');
    await page.waitForTimeout(600);
    if (!(await isHidden('.dos-window'))) throw new Error('did not minimize');
    await press('.taskbar-windows .task-btn[data-task-id="dos-oregon"]');
    await page.waitForTimeout(600);
    if (await isHidden('.dos-window')) throw new Error('did not restore');
    await press('.dos-window .title-bar-btn[data-action="close"]');
    await page.waitForTimeout(800);
    if (await page.locator('.dos-window').count()) throw new Error('window remains');
    if (page.frames().some((fr) => fr.url().includes('player.html'))) throw new Error('player frame leaked after close');
    if (await page.locator('.task-btn[data-task-id="dos-oregon"]').count()) throw new Error('taskbar button remains');
  });
  await step('DOS: relaunching after close works', async () => {
    await raise('.dos-library-window', 'dos-library');
    await press('.dos-library-window .dos-library__item[data-game="civ"]');
    await page.waitForSelector('.dos-window', { timeout: 15000 });
    let size = null;
    for (let i = 0; i < 90 && !size; i++) {
      const f = page.frames().find((fr) => fr.url().includes('player.html'));
      if (f) size = await f.evaluate(() => { const c = document.querySelector('canvas'); return c && c.width > 300 ? `${c.width}x${c.height}` : null; }).catch(() => null);
      if (!size) await page.waitForTimeout(1000);
    }
    if (!size) throw new Error('second game never reached a video mode');
    await page.waitForTimeout(2500);
    const civ = bundleRequests.filter((u) => u === 'civ.jsdos');
    if (civ.length !== 1) throw new Error(`civ.jsdos requested ${civ.length}×`);
    const frames = page.frames().filter((f) => f.url().includes('player.html')).length;
    if (frames !== 1) throw new Error(`${frames} player frames after relaunch`);
  });
  await capture('dos-running');

  // ================= persistence + rotation =================
  await step('signing in again restores the conversation', async () => {
    await page.reload({ waitUntil: 'load' });
    await typeInto('#oo-username', 'RetroKid99');
    await typeInto('#oo-password', 'hunter2');
    await press('.btn-connect');
    await page.waitForSelector('.btn-center');
    await press('.btn-center');
    await page.waitForSelector('.desktop:not(.hidden)', { timeout: 7000 });
    await page.waitForTimeout(600);
    if ((await page.locator('#chatMessages .message').count()) < 5) throw new Error('history lost');
  });
  await step('rotating keeps everything usable', async () => {
    await page.setViewportSize({ width: prof.viewport.height, height: prof.viewport.width });
    await page.waitForTimeout(900);
    const off = await page.evaluate(() => [...document.querySelectorAll('.desktop .window')]
      .filter((w) => !w.classList.contains('window--hidden'))
      .filter((w) => { const r = w.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1 || r.left < -1; })
      .map((w) => w.className.split(' ')[1]));
    if (off.length) throw new Error(`off-screen: ${off.join(', ')}`);
  });
  await capture('rotated');
  await step('rotating back still works', async () => {
    await page.setViewportSize(prof.viewport);
    await page.waitForTimeout(700);
    await typeInto('#messageInput', 'still works after rotating');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2600);
  });
  await capture('final');

  fs.writeFileSync(`${OUT}/${prof.name}-timeline.txt`, stepLog.join('\n'));
  report[prof.name] = { bundleBytes, bundleShort, steps, visual, errors: [...new Set(errors)], failed: [...new Set(failed)] };
  await browser.close();
}

fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
let tf = 0;
let tv = 0;
for (const [k, v] of Object.entries(report)) {
  const fails = v.steps.filter((s) => s.startsWith('FAIL'));
  tf += fails.length;
  tv += v.visual.length + (v.bundleShort || []).length;
  console.log(`\n########## ${k.toUpperCase()} (headed, real input) ##########`);
  console.log(`steps: ${v.steps.length - fails.length} passed, ${fails.length} failed`);
  fails.forEach((s) => console.log('  ' + s));
  console.log(`visual defects: ${v.visual.length}`);
  v.visual.slice(0, 20).forEach((s) => console.log('  ' + s));
  // Things this machine cannot do, rather than things the site got wrong.
  // Listed, never hidden — but not counted against the app.
  //   Xvfb has no sound card: the AudioContext reports sampleRate 0, and
  //     js-dos says so before degrading to silence.
  //   This Chromium build ships without the proprietary codecs, so H.264
  //     .mp4 playback aborts. The media player reports that to the user.
  //   A .jsdos abort after the whole body arrived is js-dos releasing the
  //     response stream; bundle transfers are judged on bytes below.
  const ENVIRONMENT = /ScriptProcessorNode|WebGL|GroupMarkerNotSet|GPU stall|texImage2D|Gtk|dbus|gpu_|sampleRate === 0/i;
  const CODEC_LIMITED = /\.mp4/;
  const envErr = v.errors.filter((e) => ENVIRONMENT.test(e));
  const realErr = v.errors.filter((e) => !ENVIRONMENT.test(e));
  console.log(`console errors: ${realErr.length}`);
  realErr.slice(0, 10).forEach((e) => console.log('  ' + e.slice(0, 190)));
  if (envErr.length) {
    console.log(`  (plus ${envErr.length} from this machine's missing audio/GPU: ${envErr.map((e) => e.slice(0, 60)).join(' | ')})`);
  }
  console.log('bundle transfers:');
  (v.bundleBytes || []).forEach((t) => console.log('  ' + t));
  (v.bundleShort || []).forEach((t) => console.log('  INCOMPLETE ' + t));
  const realFail = v.failed.filter((f) => !CODEC_LIMITED.test(f) && !/\.jsdos/.test(f));
  const codecFail = v.failed.filter((f) => CODEC_LIMITED.test(f));
  console.log(`failed requests: ${realFail.length}`);
  realFail.forEach((f) => console.log('  ' + f.slice(0, 170)));
  if (codecFail.length) {
    console.log(`  (plus ${codecFail.length} .mp4 aborted — this Chromium has no H.264)`);
  }
}
console.log(`\n===== FAILED STEPS: ${tf} | VISUAL DEFECTS: ${tv} =====`);
