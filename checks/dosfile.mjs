// Does the DOS player work when the page is opened straight off disk?
// That is how most people "run" a static site, and it is the difference between
// my box and a bug report.
import fs from 'node:fs';
import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';
const OUT = outDir('dosf');
fs.mkdirSync(OUT, { recursive: true });

const b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: 1280, height: 820 } });
const p = await ctx.newPage();
p.on('console', (m) => { if (/error/i.test(m.type())) console.log('  CONSOLE-ERR:', m.text().slice(0, 220)); });
p.on('pageerror', (e) => console.log('  PAGEERROR:', String(e).slice(0, 220)));
p.on('requestfailed', (r) => console.log('  REQFAIL:', r.url().slice(-70), r.failure()?.errorText));

await p.goto(FILE_URL);
await p.locator('#oo-username').fill('t');
await p.locator('#oo-password').fill('t');
await p.locator('.btn-connect').click();
await p.waitForSelector('.desktop:not(.hidden)', { timeout: 30000 });
console.log('signed in over file://');

await p.locator('.start-btn').click();
await p.locator('[data-app="dos"]').first().click();
await p.waitForSelector('.dos-library__item', { timeout: 8000 });
await p.locator('.dos-library__item[data-game="civ"]').click();
console.log('clicked Civilization');

for (let i = 1; i <= 10; i++) {
  await p.waitForTimeout(3000);
  const state = await p.evaluate(() => ({
    status: document.querySelector('.dos-status')?.textContent?.trim() || null,
    statusHidden: document.querySelector('.dos-status')?.hidden,
    error: document.querySelector('.dos-error__msg')?.textContent || null,
    frame: !!document.querySelector('.dos-frame'),
  }));
  const fr = p.frames().find((f) => /player\.html/.test(f.url()));
  const canvas = fr ? await fr.evaluate(() => { const c = document.querySelector('canvas'); return c && c.width ? `${c.width}x${c.height}` : null; }).catch((e) => 'EVAL-BLOCKED: ' + e.message.slice(0, 60)) : null;
  console.log(`t+${i * 3}s status=${JSON.stringify(state.status)} err=${JSON.stringify(state.error)} frame=${state.frame} playerFrame=${!!fr} canvas=${canvas}`);
  await p.screenshot({ path: `${OUT}/file-${String(i).padStart(2, '0')}.png` });
  if (state.error || (canvas && canvas !== '0x0' && !String(canvas).startsWith('EVAL'))) break;
}
await p.screenshot({ path: `${OUT}/file-final.png` });
await b.close();
