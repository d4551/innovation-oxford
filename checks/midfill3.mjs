// For every pixel on the figure's edge, step outward and record the FIRST
// colour that is not the figure. That is the boundary a person actually sees.
// If the outline is doing its job it is white there, and the figure reads
// against any background behind it.
import { PNG } from 'pngjs';
import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';
const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
const ratio = (a, b) => { const [x, y] = [lum(...a), lum(...b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const isNavy = (r, g, b) => r < 40 && g < 40 && b > 90 && b < 165;

const b0 = await launchBrowser();
const ctx = await b0.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(`${BASE}/index.html`);
await p.locator('#oo-username').fill('t'); await p.locator('#oo-password').fill('t');
await p.locator('.btn-connect').click();
await p.waitForSelector('.aol-box', { timeout: 5000 });
await p.waitForFunction(() => document.querySelector('.aol-box')?.classList.contains('filled'), null, { timeout: 8000 });

let worst = 99;
for (const stage of ['start', 'quarter', 'half', 'most', 'full']) {
  await p.waitForTimeout(700);
  const png = PNG.sync.read(await p.locator('.aol-box').first().screenshot());
  const M = 8;
  const at = (x, y) => { const i = (png.width * y + x) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
  let edges = 0; const ratios = [];
  for (let y = M; y < png.height - M; y++) for (let x = M; x < png.width - M; x++) {
    if (!isNavy(...at(x, y))) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isNavy(...at(x + dx, y + dy))) continue;   // interior, not an edge
      // Step out until the colour settles (past antialiasing).
      let c = null;
      for (let d = 2; d <= 6; d++) { const q = at(x + dx * d, y + dy * d); if (!isNavy(...q)) { c = q; break; } }
      if (!c) continue;
      edges++; ratios.push(ratio([0, 0, 128], c));
    }
  }
  ratios.sort((a, b) => a - b);
  // The 5th percentile: ignore a stray antialiased pixel, catch a real problem.
  const p5 = ratios[Math.floor(ratios.length * 0.05)] || 99;
  const below3 = ratios.filter((r) => r < 3).length / ratios.length;
  worst = Math.min(worst, p5);
  console.log(`${stage.padEnd(8)} ${edges} edge px  5th-pct contrast ${p5.toFixed(2)}:1  median ${ratios[ratios.length >> 1].toFixed(2)}:1  ${(below3 * 100).toFixed(1)}% of the edge below 3:1`);
}
console.log(`\nworst 5th-percentile edge contrast across the fill: ${worst.toFixed(2)}:1  ${worst >= 3 ? 'passes WCAG 1.4.11' : '✗ below 3:1'}`);
await b0.close();
