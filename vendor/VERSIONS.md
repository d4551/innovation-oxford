# Vendored third-party assets

Everything the site needs at runtime is vendored. There are **no CDN or
third-party requests at runtime** — the site works offline, behind a firewall,
with an ad-blocker, and is immune to CDN outages. It also means no SRI hashes to
rotate and no third-party can observe visitors.

| Asset | Package | Version | Files |
|---|---|---|---|
| Terminal | [`@xterm/xterm`](https://www.npmjs.com/package/@xterm/xterm) | 6.0.0 | `vendor/xterm/xterm.js`, `vendor/xterm/xterm.css` |
| Terminal auto-fit | [`@xterm/addon-fit`](https://www.npmjs.com/package/@xterm/addon-fit) | 0.11.0 | `vendor/xterm/addon-fit.js` |
| Audio | [`howler`](https://www.npmjs.com/package/howler) | 2.2.4 | `vendor/howler/howler.core.min.js` |
| DOS emulator UI | [`js-dos`](https://js-dos.com/) | 6.22.60 | `vendor/jsdos/js-dos.js`, `vendor/jsdos/js-dos.css` |
| DOS emulator runtime | [`emulators`](https://www.npmjs.com/package/emulators) | 0.73.4 | `vendor/jsdos/wdosbox.*`, `vendor/jsdos/wlibzip.*` |

## Refreshing

```sh
npm i @xterm/xterm@latest @xterm/addon-fit@latest howler@latest
cp node_modules/@xterm/xterm/lib/xterm.js         vendor/xterm/xterm.js
cp node_modules/@xterm/xterm/css/xterm.css        vendor/xterm/xterm.css
cp node_modules/@xterm/addon-fit/lib/addon-fit.js vendor/xterm/addon-fit.js
cp node_modules/howler/dist/howler.core.min.js    vendor/howler/howler.core.min.js
```

Then update the version numbers above.

## The DOS emulator

`js-dos.js` (the loader and UI) embeds the `emulators` runtime API and reports the
exact runtime build it expects: `0.73.4 (75ba991718455e71b643a068b675e327)`. The
runtime files must be that same build, so `emulators` is pinned to 0.73.4 rather
than tracking latest:

```sh
npm i emulators@0.73.4
cp node_modules/emulators/dist/{wdosbox.js,wdosbox.wasm,wdosbox.shared.js,wdosbox.shared.wasm,wdosbox.shared.worker.js,wlibzip.js,wlibzip.wasm} vendor/jsdos/
```

Three things must line up for a game to start, and all three were broken before:

1. **`emulators.pathPrefix`** must point at `vendor/jsdos/`. It defaults to `""`,
   so the runtime asks the *site root* for `wdosbox.wasm` and 404s. Now set in
   `MSDosManager.configureRuntimePaths()`.
2. **The runtime must be complete.** `wlibzip.js` / `wlibzip.wasm` perform bundle
   extraction; they were missing, so no bundle could be read.
3. **The bundles need js-dos metadata**, including an explicit `.jsdos/`
   directory entry. See `tools/build-jsdos-bundles.py`.

Upgrading js-dos to 8.x means a different loader API *and* a different bundle
format, so it is a deliberate migration rather than a version bump.
