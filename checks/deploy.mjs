// Ask a deployment whether it is serving everything the site needs.
//
//   BASE=https://example.com/innovation-oxford node checks/deploy.mjs
//
// No browser, no dependencies beyond fetch. Every file the site loads at
// runtime gets a HEAD request, and anything that does not come back 200 is
// listed with its status. A host that drops one directory (Jekyll and the
// vendor folder being the usual culprit on GitHub Pages) shows up immediately
// rather than as a spinner in the DOS window.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, REPO_ROOT } from './env.mjs';

// What the first load pulls down is read out of index.html rather than listed
// here. A hand-kept list drifts the moment a script is added or a vendored file
// is renamed, and a deployment check that quietly stops covering a file is
// worse than no check.
function fromIndex() {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  return [...new Set(refs.filter((r) => !/^(https?:|#|data:|\.\/$)/.test(r) && r !== './'))];
}

const eager = fromIndex();
const split = (re) => eager.filter((f) => re.test(f));

// The rest is loaded on demand, so it is never in the markup. Kept in step with
// msdos-manager.js (JSDOS_BASE, DOS_GAMES) and terminal-manager.js.
const GROUPS = [
  ['page + app scripts', ['index.html', ...split(/^(main\.|js\/|favicon)/)]],
  ['audio', split(/vendor\/howler/)],
  ['terminal (lazy)', ['vendor/xterm/xterm.js', 'vendor/xterm/xterm.css', 'vendor/xterm/addon-fit.js']],
  ['DOS player (lazy)', ['vendor/jsdos/player.html', 'vendor/jsdos/js-dos.js', 'vendor/jsdos/js-dos.css']],
  ['DOS runtime (lazy)', [
    'vendor/jsdos/emulators/emulators.js',
    'vendor/jsdos/emulators/wdosbox.js',
    'vendor/jsdos/emulators/wdosbox.wasm',
    'vendor/jsdos/emulators/wlibzip.js',
    'vendor/jsdos/emulators/wlibzip.wasm',
  ]],
  ['games (lazy)', ['games/civ.jsdos', 'games/oregon.jsdos']],
];

// WebAssembly is instantiated by streaming, which some hosts break by serving
// .wasm as text/plain or application/octet-stream.
const WANTED_TYPE = { '.wasm': 'application/wasm' };

const base = BASE.replace(/\/+$/, '');
console.log(`checking ${base}\n`);

let missing = 0;
let mistyped = 0;

for (const [group, paths] of GROUPS) {
  const results = await Promise.all(paths.map(async (p) => {
    const url = `${base}/${p}`;
    try {
      // Some static hosts do not implement HEAD; fall back to a ranged GET,
      // which costs one byte rather than the whole file.
      let res = await fetch(url, { method: 'HEAD' });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
      }
      return { p, status: res.status, type: res.headers.get('content-type') || '' };
    } catch (err) {
      return { p, status: 0, type: '', err: err.message };
    }
  }));

  const bad = results.filter((r) => r.status !== 200 && r.status !== 206);
  const wrongType = results.filter((r) => {
    const ext = r.p.slice(r.p.lastIndexOf('.'));
    return WANTED_TYPE[ext] && r.status < 400 && !r.type.includes(WANTED_TYPE[ext]);
  });
  missing += bad.length;
  mistyped += wrongType.length;

  if (!bad.length && !wrongType.length) {
    console.log(`  ok    ${group} (${results.length} files)`);
    continue;
  }
  console.log(`  ✗     ${group}`);
  bad.forEach((r) => console.log(`          ${r.status || 'no response'}  ${r.p}${r.err ? '  (' + r.err + ')' : ''}`));
  wrongType.forEach((r) => console.log(`          served as "${r.type}", wants ${WANTED_TYPE[r.p.slice(r.p.lastIndexOf('.'))]}  ${r.p}`));
}

console.log('');
if (!missing && !mistyped) {
  console.log('everything the site loads is being served');
} else {
  if (missing) console.log(`${missing} file(s) missing.`);
  if (mistyped) console.log(`${mistyped} file(s) served with the wrong content type.`);
  const vendorGone = missing >= 8;
  if (vendorGone) {
    console.log('\nA whole directory looks absent. On GitHub Pages this is usually Jekyll,');
    console.log('which drops "vendor" unless a .nojekyll file is committed at the repo root.');
  }
}
process.exit(missing || mistyped ? 1 : 0);
