// The host<->player control channel must obey the host and nobody else.
//
// Off disk both documents get an opaque origin that no postMessage target
// string addresses, so the origin comparison cannot carry the guarantee there —
// see the note in vendor/jsdos/player.html. What carries it instead is the
// identity of the sending window, and this check exists to hold that to account.
//
// It deliberately never reimplements the trust test. Asserting on a copy of the
// rule proves only that the copy agrees with itself: an earlier version of this
// file did exactly that and passed cleanly against a player with the check
// removed. What is measured here is the emulator's own behaviour — a forged
// "stop" must leave it running, and a real one must not, because without that
// second half "still running" is not evidence of anything.
import { PNG } from 'pngjs';
import { BASE, launchBrowser, outDir } from './env.mjs';

const OUT = outDir('origin');
const fails = [];
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'ok  ' : '✗ FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(name);
};

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/index.html`);
await page.locator('#oo-username').fill('t');
await page.locator('#oo-password').fill('t');
await page.locator('.btn-connect').click();
await page.waitForSelector('.desktop:not(.hidden)', { timeout: 30000 });
await page.locator('.start-btn').click();
await page.locator('[data-app="dos"]').first().click();
await page.waitForSelector('.dos-library__item', { timeout: 8000 });
await page.locator('.dos-library__item[data-game="oregon"]').click();

// Boot all the way to a drawing emulator: a stopped one and a not-yet-started
// one look identical, and only one of those is a finding.
const frame = await waitFor(page, () => page.frames().find((f) => /player\.html/.test(f.url())), 60000);
check('player frame loaded', !!frame);
if (!frame) { await finish(); }
await waitFor(page, async () => (await canvasSize(frame)) !== null, 60000);
await page.waitForTimeout(12000);

const running = await isAlive(frame);
check('emulator is running before the attempt', running.alive, running.why);

// A third window reaches the player the way another document actually can:
// a popup holds `opener`, and `opener.frames[0]` is a WindowProxy that stays
// addressable across origins. A script running there makes `e.source` that
// window rather than the host, which is the whole point.
const popup = await openPopup(page, `${BASE}/index.html`);
check('third window has a handle to the player frame', !!popup);
const forged = popup ? await popup.evaluate(() => {
  const target = window.opener && window.opener.frames && window.opener.frames[0];
  if (!target) return 'no handle to the frame';
  try {
    target.postMessage({ source: 'jsdos-host', type: 'stop' }, '*');
    return 'sent';
  } catch (err) { return 'threw: ' + err.message; }
}) : 'no popup';
await page.waitForTimeout(4000);

const survived = await isAlive(frame);
check('a third window\'s "stop" is ignored', survived.alive, `postMessage ${forged}; ${survived.why}`);
await page.screenshot({ path: `${OUT}/after-forged-stop.png` });

// The control. Without it, "still running" could just mean this check cannot
// detect a stop at all — which is precisely how the previous version passed
// against a player with no protection whatsoever.
await page.evaluate(() => {
  const f = document.querySelector('.dos-frame');
  f.contentWindow.postMessage({ source: 'jsdos-host', type: 'stop' }, window.location.origin);
});
await page.waitForTimeout(4000);
const stopped = await isAlive(frame);
check('the host\'s own "stop" does stop it (proves this check can see one)', !stopped.alive, stopped.why);
await page.screenshot({ path: `${OUT}/after-real-stop.png` });

await finish();

async function finish() {
  console.log(fails.length
    ? `\n✗ ${fails.length} failed: ${fails.join(', ')}`
    : '\nthe control channel obeys the host and ignores a third window');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
}

async function canvasSize(fr) {
  return fr.evaluate(() => {
    const c = document.querySelector('canvas');
    return c && c.width ? `${c.width}x${c.height}` : null;
  }).catch(() => null);
}

/**
 * Alive means the emulator is still painting. Two samples a second apart: a
 * running game changes, a stopped one is frozen or gone. Read by screenshot,
 * because a WebGL canvas without preserveDrawingBuffer reads back as
 * transparent black through drawImage.
 */
async function isAlive(fr) {
  const a = await sample(fr);
  if (a === null) return { alive: false, why: 'canvas gone' };
  await new Promise((r) => setTimeout(r, 1200));
  const b = await sample(fr);
  if (b === null) return { alive: false, why: 'canvas disappeared between samples' };
  const changed = a !== b;
  return { alive: changed, why: changed ? 'canvas still painting' : 'canvas frozen (identical frames)' };
}

async function sample(fr) {
  try {
    const buf = await fr.locator('canvas').first().screenshot({ timeout: 8000 });
    const png = PNG.sync.read(buf);
    let hash = 0;
    for (let i = 0; i < png.data.length; i += 997) hash = (hash * 31 + png.data[i]) | 0;
    return hash;
  } catch (_) { return null; }
}

async function openPopup(p, url) {
  const [popup] = await Promise.all([
    p.waitForEvent('popup', { timeout: 10000 }).catch(() => null),
    p.evaluate((u) => window.open(u, 'third-window', 'width=400,height=300'), url),
  ]);
  if (popup) await popup.waitForLoadState('domcontentloaded').catch(() => {});
  return popup;
}

async function waitFor(p, fn, ms) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const v = await fn();
    if (v) return v;
    await p.waitForTimeout(400);
  }
  return null;
}
