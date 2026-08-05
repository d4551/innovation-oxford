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
| DOS player | [`js-dos`](https://js-dos.com/) | 8.4.1 | `vendor/jsdos/js-dos.js`, `vendor/jsdos/js-dos.css` |
| DOS emulator runtime | [`emulators`](https://www.npmjs.com/package/emulators) | ships inside js-dos 8.4.1 | `vendor/jsdos/emulators/` |

## Refreshing

```sh
npm i @xterm/xterm@latest @xterm/addon-fit@latest howler@latest
cp node_modules/@xterm/xterm/lib/xterm.js         vendor/xterm/xterm.js
cp node_modules/@xterm/xterm/css/xterm.css        vendor/xterm/xterm.css
cp node_modules/@xterm/addon-fit/lib/addon-fit.js vendor/xterm/addon-fit.js
cp node_modules/howler/dist/howler.core.min.js    vendor/howler/howler.core.min.js
```

Then update the version numbers above.

## The DOS player

js-dos 8 ships the loader, the UI and the emulator runtime together, so there is
no separate `emulators` pin to keep in step any more. Only the plain DOSBox
backend is vendored — DOSBox-X is 7.9MB of WebAssembly against 1.4MB and neither
of these titles needs it — and `player.html` passes `backendLocked: true` so the
settings panel cannot switch to a backend that is not on disk.

```sh
npm i js-dos@latest
cp node_modules/js-dos/dist/js-dos.js  vendor/jsdos/js-dos.js
cp node_modules/js-dos/dist/js-dos.css vendor/jsdos/js-dos.css
mkdir -p vendor/jsdos/emulators
cp node_modules/js-dos/dist/emulators/{emulators.js,wdosbox.js,wdosbox.wasm,wlibzip.js,wlibzip.wasm} \
   vendor/jsdos/emulators/
```

After any upgrade, rebuild and verify the bundles, then run the interaction
suite: the player's own controls are patched by class name, and a version that
renames them must fail loudly rather than silently lose its labels.

```sh
python3 tools/build-jsdos-bundles.py
python3 tools/check-jsdos-bundles.py
```

### Why the player runs in an iframe

`vendor/jsdos/player.html` hosts js-dos; the app embeds that page rather than
mounting the emulator directly. Two reasons, both measured:

1. **`js-dos.css` is a full Tailwind build, preflight included.** Dropped into
   the page, `*,:before,:after{border-width:0}` strips the borders the entire
   Windows 95 look is built from. The app survived it only because our class
   selectors happened to out-rank `*` — luck, not isolation.
2. **Its layout assumes it owns the document.** Inside an app window it escaped
   its container and covered the title bar.

A same-origin frame gives js-dos the whole viewport it expects and gives the app
back a hard boundary. Closing the window removes the frame, which destroys the
emulator, its worker, its audio graph and its listeners in one step — a more
complete teardown than any API call. The host talks to it over `postMessage`
(`pause` / `resume` / `stop` out; `ready`, `event`, `error` back) and passes the
bundle URL in the frame's `name` rather than its query string, so the player has
one stable URL.

### What player.html fixes on js-dos's behalf

js-dos draws every control in its sidebar as a bare `<div>` with a click
handler. As shipped that is three separate failures, in the only UI a player has
for saving, speed, full screen and the on-screen keyboard:

- **WCAG 2.1.1 Keyboard (A)** — no tab stop and no key handling, so none of it
  can be reached without a mouse.
- **WCAG 4.1.2 Name, Role, Value (A)** — no role and no accessible name: on the
  six sidebar controls, on the soft keyboard's 55 keys, and on every toggle,
  radio and select in the settings and speed panels.
- **WCAG 2.5.8 Target Size (AA)** — the collapsed rail is 16px wide and the
  speed panel's radios are 20×20.

`player.html` upgrades the nodes in place as they appear — via a
`MutationObserver`, because js-dos rebuilds the sidebar as emulator state
changes — rather than patching a 320KB minified bundle. Each rule is keyed on
something js-dos renders deliberately: a class it sets, or the icon it draws.
The interaction suite then asserts that every control ends up with a role, a
name, a focus ring and a 24px target, so a version that renames things fails a
test instead of quietly regressing.

Tabbing into the frame used to land on the sidebar, where Enter and Space
activate a button — two keys these games need. The game surface is not
focusable in js-dos at all, so `player.html` makes the canvas a focus target
with `role="application"`, which both puts the game first in the frame's tab
order and tells assistive technology to pass keystrokes straight through.

The soft keyboard's keys get roles and names but are deliberately kept out of
the tab order: typing already works from a real keyboard, so 55 extra tab stops
would cost every keyboard user something and gain them nothing, while assistive
technology on a touch device reaches them anyway. Those keys answer to pointer
events only, so keyboard activation synthesises `pointerdown`/`pointerup`
instead of a click.

On a touch device the sidebar starts expanded rather than collapsed. Both games
open on a prompt that wants a keypress, and there the on-screen keyboard behind
that rail is the only keyboard there is.

## The game bundles

`games/*.jsdos` are built by `tools/build-jsdos-bundles.py` from the plain game
directories. A bundle needs its own metadata — `.jsdos/dosbox.conf`,
`.jsdos/readme.txt`, `.jsdos/jsdos.json`, and an explicit `.jsdos/` **directory**
entry, without which the config never lands on the emulated filesystem and
DOSBox exits 101 before printing anything.

`tools/check-jsdos-bundles.py` verifies that each bundle's `[autoexec]` names a
program the archive actually contains. That is not a theoretical check: a bundle
can be perfectly well-formed and still boot to nothing but a DOS prompt, and
nothing visible in the player distinguishes the two. Measured against a bundle
with a missing program, DOSBox's own welcome banner scored *higher* on colour
and on frame-to-frame change than either real game, and its video mode matched
Civilization's own text menu.
