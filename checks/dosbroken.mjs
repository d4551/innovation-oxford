// The two deployment failures the player now has to name for itself:
// a bundle that 404s, and a player document that was never published (the
// classic "Jekyll dropped vendor/" on GitHub Pages). Serve the real site but
// withhold one path at a time and read what the user is told.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';

const ROOT = REPO_ROOT;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.json': 'application/json' };

let withhold = null;
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (withhold && url.includes(withhold)) { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('<h1>404</h1>'); return; }
  const file = path.join(ROOT, url === '/' ? '/index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(8123, r));

const b = await launchBrowser();
for (const [label, drop] of [['bundle 404 (games/civ.jsdos)', 'civ.jsdos'], ['player never published (vendor/)', 'vendor/jsdos/player.html']]) {
  withhold = drop;
  const ctx = await b.newContext({ viewport: { width: 1100, height: 760 } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8123/index.html');
  await p.locator('#oo-username').fill('t'); await p.locator('#oo-password').fill('t');
  await p.locator('.btn-connect').click();
  await p.waitForSelector('.desktop:not(.hidden)', { timeout: 30000 });
  await p.locator('.start-btn').click();
  await p.locator('[data-app="dos"]').first().click();
  await p.waitForSelector('.dos-library__item', { timeout: 8000 });
  const t0 = Date.now();
  await p.locator('.dos-library__item[data-game="civ"]').click();
  let msg = null, retry = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => ({
      msg: document.querySelector('.dos-error__msg')?.textContent || null,
      retry: !!document.querySelector('.dos-error [data-act="retry"]'),
      focused: document.activeElement?.textContent?.trim()?.slice(0, 12) || null,
    }));
    if (s.msg) { msg = s.msg; retry = s.retry; console.log(`\n${label}\n  reported after ${((Date.now() - t0) / 1000).toFixed(1)}s\n  retry offered: ${s.retry}\n  focus: ${s.focused}\n  "${s.msg}"`); break; }
  }
  if (!msg) console.log(`\n${label}\n  ✗ NOTHING REPORTED after 40s`);
  await p.screenshot({ path: `${outDir()}/dosf/broken-${drop.replace(/\W/g, '_')}.png` });
  await ctx.close();
}
await b.close();
server.close();
