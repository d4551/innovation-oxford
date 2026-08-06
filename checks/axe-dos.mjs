// Audit the DOS player itself. js-dos 8 renders its own controls — sidebar,
// save, on-screen keyboard, settings — inside the player frame, so a scan of
// the top document alone never sees the UI our users actually touch.
import fs from 'node:fs';
import { BASE, FILE_URL, REPO_ROOT, axeSource, launchBrowser, outDir } from './env.mjs';
// axe-core is injected into the page as a plain script, so it is read off
// disk rather than imported — the browser, not this process, runs it.
const AXE = fs.readFileSync(axeSource(), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const b = await launchBrowser();
let total = 0;
for (const vp of [
  { n: 'desktop', w: 1440, h: 900, touch: false },
  { n: 'phone', w: 390, h: 844, touch: true },
]) {
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, isMobile: vp.touch });
  await p.goto(`${BASE}/index.html`);
  await p.fill('#oo-username', 'a'); await p.fill('#oo-password', 'b');
  await p.click('.btn-connect'); await p.waitForSelector('.btn-center');
  await p.click('.btn-center'); await p.waitForSelector('.desktop:not(.hidden)');
  await p.waitForTimeout(400);
  await p.click('.start-btn'); await p.waitForTimeout(250);
  await p.click('.menu-item[data-app="dos"]'); await p.waitForTimeout(800);
  await p.locator('.dos-library__item[data-game="oregon"]').click();
  // Wait for the emulator to reach a video mode so its chrome is fully built.
  let f = null;
  for (let i = 0; i < 90; i++) {
    f = p.frames().find((fr) => fr.url().includes('player.html'));
    if (f) {
      const ok = await f.evaluate(() => { const c = document.querySelector('canvas'); return !!(c && c.width > 300); }).catch(() => false);
      if (ok) break;
    }
    await p.waitForTimeout(1000);
  }
  await p.waitForTimeout(3000);
  // Expand js-dos's sidebar and open its panels: the collapsed player shows
  // almost none of the UI a user actually touches.
  if (await f.locator('.sidebar-thin').count()) {
    await f.locator('.sidebar-thin > *').first().click();
    await p.waitForTimeout(1200);
  }

  const scanFrame = async (frame, label) => {
    await frame.evaluate(AXE);
    const r = await frame.evaluate(async (tags) => {
      const res = await axe.run(document, { runOnly: { type: 'tag', values: tags }, iframes: false });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help,
        nodes: v.nodes.slice(0, 4).map((n) => ({ html: n.html.slice(0, 150), target: n.target.join(' '), msg: (n.any[0] || n.all[0] || n.none[0] || {}).message })) }));
    }, TAGS);
    total += r.length;
    console.log(`  [${vp.n}/${label}] violations: ${r.length}`);
    r.forEach((v) => {
      console.log(`     ${v.impact ?? '?'} ${v.id} x${v.n} — ${v.help}`);
      v.nodes.forEach((n) => console.log(`        ${n.target}\n          ${n.html}\n          ${n.msg || ''}`));
    });
  };
  await scanFrame(p.mainFrame(), 'host-with-dos-open');
  if (f) {
    await scanFrame(f, 'player-sidebar');
    for (const [name, aria] of [['settings', 'Player settings'], ['speed', 'Speed and turbo settings'], ['keyboard', 'Toggle on-screen keyboard']]) {
      await f.locator(`[aria-label="${aria}"]`).click().catch(() => {});
      await p.waitForTimeout(1400);
      await scanFrame(f, `player-${name}`);
      await f.locator(`[aria-label="${aria}"]`).click().catch(() => {});
      await p.waitForTimeout(700);
    }
  } else console.log(`  [${vp.n}] NO PLAYER FRAME`);
  await p.close();
}
console.log(`\nTOTAL DOS AXE VIOLATIONS: ${total}`);
await b.close();
