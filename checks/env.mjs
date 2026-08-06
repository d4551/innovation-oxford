// Shared configuration for the browser checks.
//
// Every check drives a real headed browser against a real server, so each needs
// to know where the site is being served and where to put its screenshots.
// Both are derived here rather than repeated, and both can be overridden from
// the environment so the same scripts can run against a local server, a staging
// deploy, or a fresh clone.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/** The repository root — this file lives in `checks/`. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where the site is served. `npm run serve` puts it here. */
export const BASE = process.env.BASE || 'http://127.0.0.1:8099';

/** The same site opened straight off disk, which several checks deliberately test. */
export const FILE_URL = `file://${path.join(REPO_ROOT, 'index.html')}`;

/**
 * A directory for a check's screenshots, created on demand.
 * `outDir()` is the shared root; `outDir('dos')` is a named subdirectory.
 * Everything lands under `checks/out/`, which is git-ignored.
 */
export function outDir(name) {
  const dir = name ? path.join(REPO_ROOT, 'checks', 'out', name) : path.join(REPO_ROOT, 'checks', 'out');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Launch the browser every check uses.
 *
 * Headed, always: these checks exist to catch what a person would see, and a
 * headless browser composites differently enough that screenshot probes and
 * WebGL readbacks stop meaning what they appear to mean.
 *
 * Deliberately no way to point this at some other browser on the machine. These
 * checks assert on pixels — contrast ratios, what the emulator drew, whether a
 * control is covered — and against a build that does not match the installed
 * Playwright those numbers look authoritative while meaning nothing. The
 * browser is pinned with the package: `npm install && npx playwright install
 * chromium`, and if that has not been run, failing here is the correct outcome.
 */
export function launchBrowser(extraArgs = []) {
  return chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', ...extraArgs],
  });
}

/**
 * Path to axe-core's bundled script. It is injected into the page and run by
 * the browser, not imported into this process, so what is wanted is a file path
 * rather than a module — but `import.meta.resolve` is still the right way to
 * find it, since it honours wherever npm actually put it.
 */
export function axeSource() {
  try {
    return fileURLToPath(import.meta.resolve('axe-core/axe.min.js'));
  } catch (err) {
    throw new Error('axe-core is not installed — run `npm install` in the repository root first.');
  }
}
