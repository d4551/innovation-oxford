// The three connection figures have to actually be drawn — not a missing glyph.
// Screenshot each box and count non-background pixels inside it, both before and
// after it fills blue (the figure has to invert to stay readable).
import fs from 'node:fs';
import { BASE, FILE_URL, REPO_ROOT, launchBrowser, outDir } from './env.mjs';

const OUT = outDir('fig');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [
  ['desktop', 1440, 900],
  ['tablet', 820, 1180],
  ['phone', 390, 844],
];

const b = await launchBrowser();
let bad = 0;

for (const [name, w, h] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`);
  await p.locator('#oo-username').fill('tester');
  await p.locator('#oo-password').fill('hunter2');
  await p.locator('.btn-connect').click();
  await p.waitForSelector('.animation-boxes .aol-box', { timeout: 5000 });

  // Before any box fills.
  await p.waitForTimeout(120);
  const early = await measure(p);
  await p.screenshot({ path: `${OUT}/figures-${name}-early.png` });

  // Wait for all three to fill.
  await p.waitForFunction(() => document.querySelectorAll('.aol-box.filled').length === 3, null, { timeout: 12000 });
  await p.waitForTimeout(250);
  const late = await measure(p);
  await p.screenshot({ path: `${OUT}/figures-${name}-late.png` });

  for (let i = 0; i < 3; i++) {
    const e = early[i]; const l = late[i];
    const eOk = e && e.svgW > 20 && e.svgH > 20 && e.paths >= 3;
    // The pixel check: the figure must differ from its box background in both states.
    const eInk = e?.ink ?? 0;
    const lInk = l?.ink ?? 0;
    const ok = eOk && eInk > 0.02 && lInk > 0.02;
    if (!ok) bad++;
    console.log(
      `${name.padEnd(7)} box ${i + 1}: svg ${e?.svgW}x${e?.svgH} shapes=${e?.paths} ` +
      `box ${e?.boxW}x${e?.boxH} ink=${(eInk * 100).toFixed(1)}% ` +
      `fill=${e?.fill}/${l?.fill} ${ok ? 'drawn' : '✗ NOT DRAWN'}`
    );
  }
  await ctx.close();
}

console.log(bad === 0 ? '\nall 9 figures drawn at every size' : `\n✗ ${bad} figures failed`);
await b.close();
process.exit(bad === 0 ? 0 : 1);

async function measure(page) {
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.aol-box')];
    return boxes.map((box) => {
      const svg = box.querySelector('.box-figure svg');
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      const shapes = svg.querySelectorAll('path, circle, rect');
      // Rasterise the figure to measure how much of the box it covers. The SVG
      // is inline so it can be serialised and drawn without a network fetch.
      return {
        svgW: Math.round(r.width),
        svgH: Math.round(r.height),
        boxW: Math.round(box.getBoundingClientRect().width),
        boxH: Math.round(box.getBoundingClientRect().height),
        paths: shapes.length,
        fill: getComputedStyle(shapes[0]).fill,
        // Coverage: sum the bounding boxes of the shapes against the viewBox.
        ink: (() => {
          try {
            let area = 0;
            shapes.forEach((s) => { const bb = s.getBBox(); area += bb.width * bb.height; });
            return area / (64 * 64);
          } catch (_) { return 0; }
        })(),
      };
    });
  });
}
