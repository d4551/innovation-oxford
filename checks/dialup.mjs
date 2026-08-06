// The dial-up sequence has to stay coherent whether or not there is sound:
// all three boxes fill before "Connected" appears.
import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';
const b = await launchBrowser();
for (const mode of ['audio', 'silent']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  if (mode === 'silent') {
    // Simulate the real fallback: Howler missing entirely.
    await p.addInitScript(() => { Object.defineProperty(window, 'Howl', { value: undefined, configurable: true }); });
  }
  await p.goto(`${BASE}/index.html`);
  await p.locator('#oo-username').fill('a'); await p.locator('#oo-password').fill('b');
  const t0 = Date.now();
  await p.locator('.btn-connect').click();
  await p.waitForSelector('.animation-boxes', { timeout: 5000 });
  let connectedAt = null; let filledAt = null;
  for (let i = 0; i < 200; i++) {
    const s = await p.evaluate(() => ({
      status: document.getElementById('dialup-status-text')?.textContent || '',
      filled: document.querySelectorAll('.aol-box.filled').length,
      gone: !document.getElementById('dialup-intro'),
    })).catch(() => ({ gone: true }));
    if (s.gone) break;
    if (s.filled === 3 && filledAt === null) filledAt = Date.now() - t0;
    if (/Connected/.test(s.status) && connectedAt === null) connectedAt = Date.now() - t0;
    if (connectedAt !== null && filledAt !== null) break;
    await p.waitForTimeout(80);
  }
  await p.waitForSelector('.desktop:not(.hidden)', { timeout: 25000 });
  const total = Date.now() - t0;
  const ok = filledAt !== null && connectedAt !== null && filledAt <= connectedAt + 150;
  console.log(`${mode.padEnd(7)} all three boxes filled at ${filledAt}ms, "Connected" at ${connectedAt}ms, desktop at ${total}ms  ${ok ? 'coherent' : '✗ status ran ahead of the animation'}`);
  await ctx.close();
}
await b.close();
