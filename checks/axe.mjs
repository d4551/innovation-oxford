import fs from 'node:fs';
import { BASE, FILE_URL, REPO_ROOT, axeSource, launchBrowser, outDir } from './env.mjs';
// axe-core is injected into the page as a plain script, so it is read off
// disk rather than imported — the browser, not this process, runs it.
const AXE = fs.readFileSync(axeSource(), 'utf8');
const b = await launchBrowser();
let total = 0;
for (const vp of [
  { n: 'desktop', w: 1440, h: 900, touch: false },
  { n: 'phone', w: 390, h: 844, touch: true },
]) {
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, isMobile: vp.touch });
  await p.goto(`${BASE}/index.html`);
  const scan = async (label) => {
    await p.addScriptTag({ content: AXE });
    const r = await p.evaluate(async () => {
      const res = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      });
      return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length,
        help: v.help, sample: v.nodes[0]?.html?.slice(0, 110) }));
    });
    total += r.length;
    console.log(`  [${vp.n}/${label}] violations: ${r.length}`);
    r.forEach(v => { console.log(`     ${v.impact ?? '?'} ${v.id} x${v.n} — ${v.help}`); console.log(`        ${v.sample}`); });
  };
  await scan('login');
  await p.fill('#oo-username','a'); await p.fill('#oo-password','b');
  await p.click('.btn-connect'); await p.waitForSelector('.btn-center');
  await p.click('.btn-center'); await p.waitForSelector('.desktop:not(.hidden)');
  await p.waitForTimeout(500);
  await scan('desktop');
  for (const app of ['mail', 'channels', 'paint', 'ie']) {
    await p.click('.start-btn'); await p.waitForTimeout(200);
    await p.click(`.menu-item[data-app="${app}"]`); await p.waitForTimeout(700);
  }
  await p.locator('.channels-window .channel-tile').first().click().catch(()=>{});
  await p.waitForTimeout(600);
  await scan('all-apps-open');
  await p.close();
}
console.log(`\nTOTAL AXE VIOLATIONS: ${total}`);
await b.close();
