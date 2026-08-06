// Hammer the DOS player the way a user would abuse it: both games, real
// keystrokes into the emulator, close and relaunch, minimize and restore, and
// the same again on a phone. Anything that leaves the window without a live
// canvas is a failure.
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';
const OUT = outDir('dosh');
fs.mkdirSync(OUT, { recursive: true });

const fails = [];
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'ok  ' : '✗ FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(name);
};

const b = await launchBrowser(['--autoplay-policy=no-user-gesture-required']);

for (const [label, vp, touch] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  console.log(`\n=== ${label} ===`);
  const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP${r.status()} ${r.url()}`); });

  await p.goto(`${BASE}/index.html`);
  await p.locator('#oo-username').fill('t');
  await p.locator('#oo-password').fill('t');
  await p.locator('.btn-connect').click();
  await p.waitForSelector('.desktop:not(.hidden)', { timeout: 30000 });

  const openShelf = async () => {
    await p.locator('.start-btn').click();
    await p.locator('[data-app="dos"]').first().click();
    await p.waitForSelector('.dos-library__item', { timeout: 8000 });
  };

  for (const game of ['civ', 'oregon']) {
    console.log(`-- ${game} --`);
    await openShelf();
    await p.locator(`.dos-library__item[data-game="${game}"]`).click();
    const winSel = `.window.dos-window[aria-label="${game === 'civ' ? "Sid Meier's Civilization" : 'The Oregon Trail'}"]`;
    await p.waitForSelector(winSel, { timeout: 10000 });

    // Boot to a live canvas.
    const fr = await waitFrame(p, 60000);
    check(`${game}: player frame loaded`, !!fr);
    if (!fr) continue;
    const canvas = await waitCanvas(fr, 60000);
    check(`${game}: canvas live`, !!canvas, canvas || '');

    // Give the game time to reach a title screen, then look at real pixels.
    await p.waitForTimeout(14000);
    await p.screenshot({ path: `${OUT}/${label}-${game}-boot.png` });
    const before = await frameInk(fr);
    check(`${game}: drawing something`, before.nonBlack > 0.02, `${(before.nonBlack * 100).toFixed(1)}% lit`);

    // Real keystrokes into the emulator canvas.
    await fr.locator('canvas').click({ position: { x: 60, y: 60 } }).catch(() => {});
    for (const k of ['Enter', 'Space', 'Enter', 'ArrowDown', 'Enter']) {
      await p.keyboard.press(k);
      await p.waitForTimeout(700);
    }
    await p.waitForTimeout(2500);
    const after = await frameInk(fr);
    await p.screenshot({ path: `${OUT}/${label}-${game}-after-keys.png` });
    check(`${game}: reacts to keys`, Math.abs(after.hash - before.hash) > 0, `hash ${before.hash} -> ${after.hash}`);

    // Minimize and restore — the frame must survive.
    const minBtn = p.locator(`${winSel} .title-bar-btn[data-action="min"]`).first();
    if (await minBtn.count()) {
      await minBtn.click();
      await p.waitForTimeout(900);
      const hidden = await p.locator(winSel).evaluate((e) => e.classList.contains('hidden') || getComputedStyle(e).display === 'none');
      check(`${game}: minimizes`, hidden);
      await p.locator(`.taskbar-windows [data-task-id="dos-${game}"]`).first().click();
      await p.waitForTimeout(1200);
      const back = await frameInk(fr).catch(() => null);
      check(`${game}: restores with a live canvas`, !!back && back.nonBlack > 0.01, back ? `${(back.nonBlack * 100).toFixed(1)}% lit` : 'frame gone');
    }

    // Close, then launch again — the classic teardown bug.
    await p.locator(`${winSel} .title-bar-btn[data-action="close"]`).click();
    await p.waitForTimeout(1200);
    check(`${game}: closes`, (await p.locator(winSel).count()) === 0);

    await openShelf();
    await p.locator(`.dos-library__item[data-game="${game}"]`).click();
    await p.waitForSelector(winSel, { timeout: 10000 });
    const fr2 = await waitFrame(p, 60000);
    const c2 = fr2 ? await waitCanvas(fr2, 60000) : null;
    check(`${game}: relaunches after close`, !!c2, c2 || 'no canvas');
    await p.waitForTimeout(9000);
    const relit = fr2 ? await frameInk(fr2) : { nonBlack: 0 };
    check(`${game}: relaunch draws`, relit.nonBlack > 0.02, `${(relit.nonBlack * 100).toFixed(1)}% lit`);
    await p.screenshot({ path: `${OUT}/${label}-${game}-relaunch.png` });
    await p.locator(`${winSel} .title-bar-btn[data-action="close"]`).click();
    await p.waitForTimeout(800);
  }

  const real = errs.filter((e) => !/sampleRate === 0|SwiftShader|WebGL|GroupMarker|favicon/i.test(e));
  check(`${label}: no console errors`, real.length === 0, real.slice(0, 4).join(' | '));
  await ctx.close();
}

console.log(fails.length ? `\n✗ ${fails.length} failures: ${fails.join(', ')}` : '\nall DOS player checks passed');
await b.close();
process.exit(fails.length ? 1 : 0);

async function waitFrame(p, ms) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const f = p.frames().find((x) => /player\.html/.test(x.url()));
    if (f) return f;
    await p.waitForTimeout(400);
  }
  return null;
}
async function waitCanvas(fr, ms) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const c = await fr.evaluate(() => { const c = document.querySelector('canvas'); return c && c.width ? `${c.width}x${c.height}` : null; }).catch(() => null);
    if (c) return c;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
// A WebGL canvas without preserveDrawingBuffer reads back as transparent black,
// so drawImage sees nothing. Screenshot the element instead — the compositor
// has the real pixels — and measure those.
async function frameInk(fr) {
  try {
    const buf = await fr.locator('canvas').first().screenshot({ timeout: 8000 });
    const png = PNG.sync.read(buf);
    let lit = 0, hash = 0, n = 0;
    const step = 4 * Math.max(1, Math.floor(png.width / 200));
    for (let y = 0; y < png.height; y += Math.max(1, Math.floor(png.height / 120))) {
      for (let x = 0; x < png.width * 4; x += step) {
        const i = (png.width * y * 4) + x;
        const v = png.data[i] + png.data[i + 1] + png.data[i + 2];
        if (v > 40) lit++;
        hash = (hash * 31 + v) | 0;
        n++;
      }
    }
    return { nonBlack: n ? lit / n : 0, hash };
  } catch (e) {
    return { nonBlack: 0, hash: 0, err: e.message.slice(0, 60) };
  }
}
