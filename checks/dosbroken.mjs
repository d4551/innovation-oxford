// Every deployment failure the player has to name for itself.
//
// Serve the real site, withhold one path at a time, and read what the user is
// told. Each case has to produce a message that names the missing file, within
// a few seconds, and offer Retry only where retrying could possibly help.
//
// The runtime cases exist because a missing file used to be reported as a
// broken browser: js-dos says "Unable to download 'emulators/wdosbox.wasm'",
// and a loose /wasm/ test read that filename as a WebAssembly failure. Anyone
// following that message would go looking at their browser instead of their
// deployment. `mustNotSay` below is the guard.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, launchBrowser, outDir } from './env.mjs';

const ROOT = REPO_ROOT;
const PORT = 8123;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.json': 'application/json' };

// [label, path withheld, must appear in the message, Retry offered?]
const CASES = [
  ['bundle 404', 'games/civ.jsdos', 'civ.jsdos', true],
  ['player never published', 'vendor/jsdos/player.html', 'player.html', false],
  ['runtime: emulators.js', 'emulators/emulators.js', 'emulators.js', true],
  ['runtime: wdosbox.js', 'emulators/wdosbox.js', 'wdosbox.js', true],
  ['runtime: wdosbox.wasm', 'emulators/wdosbox.wasm', 'wdosbox.wasm', true],
  ['runtime: wlibzip.js', 'emulators/wlibzip.js', 'wlibzip.js', true],
  ['runtime: wlibzip.wasm', 'emulators/wlibzip.wasm', 'wlibzip.wasm', true],
];

// A missing file is a deployment problem. Saying any of this sends the reader
// somewhere there is nothing to find.
const mustNotSay = /this browser|your browser|browser could not|check the connection/i;

const DEADLINE_S = 15;
const fails = [];
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'ok  ' : '✗ FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(name);
};

let withhold = null;
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (withhold && url.endsWith(withhold)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
  const file = path.join(ROOT, url === '/' ? '/index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const b = await launchBrowser();

for (const [label, drop, expect, retryable] of CASES) {
  withhold = drop;
  const ctx = await b.newContext({ viewport: { width: 1100, height: 760 } });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${PORT}/index.html`);
  await p.locator('#oo-username').fill('t');
  await p.locator('#oo-password').fill('t');
  await p.locator('.btn-connect').click();
  await p.waitForSelector('.desktop:not(.hidden)', { timeout: 30000 });
  await p.locator('.start-btn').click();
  await p.locator('[data-app="dos"]').first().click();
  await p.waitForSelector('.dos-library__item', { timeout: 8000 });

  const t0 = Date.now();
  await p.locator('.dos-library__item[data-game="civ"]').click();

  let s = null;
  for (let i = 0; i < DEADLINE_S; i++) {
    await p.waitForTimeout(1000);
    s = await p.evaluate(() => ({
      msg: document.querySelector('.dos-error__msg')?.textContent || null,
      retry: !!document.querySelector('.dos-error [data-act="retry"]'),
      focused: document.activeElement?.textContent?.trim()?.slice(0, 12) || null,
    }));
    if (s.msg) break;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${label} (404 on ${drop})`);

  if (!s || !s.msg) {
    check(`${label}: reports within ${DEADLINE_S}s`, false, `nothing after ${DEADLINE_S}s`);
  } else {
    console.log(`  "${s.msg}"`);
    check(`${label}: reports within ${DEADLINE_S}s`, true, `${secs}s`);
    check(`${label}: names ${expect}`, s.msg.includes(expect), s.msg.includes(expect) ? '' : 'message does not mention it');
    check(`${label}: does not blame the browser`, !mustNotSay.test(s.msg));
    check(`${label}: Retry ${retryable ? 'offered' : 'withheld'}`, s.retry === retryable, `focus on "${s.focused}"`);
  }
  await p.screenshot({ path: `${outDir('broken')}/${drop.replace(/\W/g, '_')}.png` });
  await ctx.close();
}

console.log(fails.length ? `\n✗ ${fails.length} failed: ${fails.join(', ')}` : `\nall ${CASES.length} deployment failures name themselves`);
await b.close();
server.close();
process.exit(fails.length ? 1 : 0);
