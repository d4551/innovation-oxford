# Oxford Messenger

A playable recreation of a 1999 desktop: an AOL-style instant messenger, mail
client, Paint, media player, MS-DOS prompt and two real DOS games — all running
in the browser from static files.

No build step, no framework, no CDN, no tracking. Open `index.html` and it runs.

The first load is ~306KB across 25 requests. The terminal engine (~480KB) and
the DOS runtime (~2.3MB) are fetched only when you actually open a prompt or a
game, so most visitors never download them. The page snapshot behind Internet
Explorer ships at three widths and the browser picks one — 223KB on an ordinary
laptop, where it used to be a single 3.4MB PNG for everybody.

## Running it

Any static file server works:

```sh
npx http-server -p 8099 -c-1 .
# then open http://127.0.0.1:8099
```

Opening `index.html` straight off disk mostly works, but the DOS games need a
real `http(s)://` origin because the emulator loads WebAssembly.

## What's in it

| App | Notes |
|---|---|
| **Oxford Messenger** | Buddy list + IM window. Buddies reply with per-personality 90s chatter and eventually share a real link. History persists for the session. |
| **Oxford Mail** | Sortable inbox, reader pane, compose/reply/delete, fake "check for new mail". Read state persists in `localStorage`. |
| **MS-DOS Prompt** | xterm.js with a command set (`help`, `dir`, `ver`, `dos`, `civ`, `oregon`, …), command history on ↑/↓, and auto-fit to the window. |
| **MS-DOS Games** | The Oregon Trail and Sid Meier's Civilization, running under DOSBox via js-dos. |
| **Oxford Paint** | Pencil/eraser, colour, brush size, undo/redo, save as PNG. Works with mouse, finger and stylus. |
| **Internet Explorer** | A period-accurate chrome around a snapshot of the real Oxford course page. |
| **Oxford Channels** | Channel tiles opening an "Innovation & You" slide deck. |
| **Media Player** | Windows-98-style player with seek, volume, playlist and a live audio visualiser. |

## Layout

The site has two layout modes, switched by a `matchMedia` listener in `main.js`
that toggles `body.is-compact`:

- **Wide** (>900px and >520px tall) — free-floating windows you can drag, resize
  from any edge or corner, maximize, minimize and stack.
- **Compact** (tablets and phones) — every window is pinned full-bleed above the
  taskbar and the taskbar becomes the window switcher. Dragging and resizing are
  disabled because they cannot work well under a thumb. Messenger splits the
  screen: buddy list on top, conversation below. **Start → Show Desktop** gets
  you back to the icons.

All pointer interaction (window drag, window resize, painting, the mail splitter)
uses Pointer Events, so mouse, touch and stylus run through one code path.

## Accessibility

- Every control is a real `<button>` with an accessible name, reachable and
  operable by keyboard, with a visible focus ring.
- Targets meet the WCAG 2.5.8 (AA) 24×24px minimum, and are enlarged on
  touch-primary devices.
- The CRT flicker runs at 0.25Hz — far below the 3-flashes-per-second limit in
  WCAG 2.3.1 — and all decorative motion is removed under
  `prefers-reduced-motion: reduce`.
- Live regions announce chat messages, mail status and player state.
- `prefers-contrast: more` and a print stylesheet are both supported.

## Project structure

```
index.html                 markup shell; every script is deferred
main.css                   all styles, in numbered sections (see file header)
main.js                    boot, layout mode, clock, keyboard shortcuts
js/
  utils.js                 escaping, event delegation, layout maths
  buddies.js               the buddy roster: one source of truth
  app-window.js            AppWindow base class — the window lifecycle
  window-manager.js        window shells, pointer drag + resize
  taskbar-manager.js       taskbar buttons
  audio-manager.js         Howler wrapper; degrades to silence
  dialup-intro.js          sign-in + connection sequence
  chat-manager.js          messenger
  mail-manager.js          mail + compose
  terminal-manager.js      xterm.js prompt
  msdos-manager.js         DOS game shelf + player frame windows
  media-player-manager.js  audio/video player
  ie-manager.js            fake browser
  paint-manager.js         paint
  folder-manager.js        folder windows
  channels-manager.js      channels + slide deck
  start-menu.js            Start menu
  desktop-icons.js         desktop icon grid
  clipart.js               inline SVG clipart
  slides-data.js           slide deck content
vendor/                    all third-party code (see vendor/VERSIONS.md)
  jsdos/player.html        the page the DOS games run inside
tools/                     build + verify scripts for the DOS game bundles
```

### The window lifecycle

Every windowed app extends `AppWindow`, which owns creating the shell, wiring
the three title-bar buttons, registering a taskbar button, and
minimize/restore/maximize/close. Subclasses implement `renderBody()` and,
optionally, `onShow()`, `onHide()`, `onClose()` and `onResize()`. Adding an app
is a subclass, not another copy of the same six methods.

Window visibility is the `.window--hidden` class rather than an inline
`display`, so the compact layout can own `display` without fighting inline
styles written by dragging and resizing.

Each window is a named `region` and a focus target. Opening one moves focus to
the window itself — not to whichever control happens to be first in the markup,
which would be a title-bar button — so it announces its name and the next Tab
lands inside it. Closing or minimizing hands focus back to wherever it came
from, then the front-most window still open, then the Start button. Never
`<body>`, which would send the next Tab to the top of the document.

## Checks

```sh
npx eslint js/ main.js               # config in eslint.config.mjs
python3 tools/check-jsdos-bundles.py # each game bundle starts the program it names
```

The site was verified in a real browser at 1440x900, 820x1180 and 390x844 —
every app clicked, dragged and typed through with genuine mouse, touch and
keyboard input rather than scripted calls into the page — plus axe-core scans
(WCAG 2.0/2.1/2.2 A and AA, and best-practice) on the sign-in screen, the bare
desktop, with every app open, and inside the DOS player with its sidebar,
settings, speed panel and on-screen keyboard open. Zero violations, zero console
errors, zero horizontal overflow.

The two pieces of third-party UI a visitor actually touches are held to the same
bar as the rest of the app:

- **The DOS player.** js-dos draws its controls as bare divs with click
  handlers — no role, no name, no tab stop, and a 16px rail. `player.html` adds
  all of it; see [`vendor/VERSIONS.md`](vendor/VERSIONS.md).
- **The terminal.** xterm renders to a canvas and marks its rows `aria-hidden`,
  so its output reaches no screen reader at all. `TerminalManager` keeps a
  `role="log"` transcript of every line it writes, off-screen but announced.

Only Chromium is available in the environment used for those runs, so Firefox
and Safari have not been exercised automatically. Nothing in the code is
engine-specific — the APIs used (Pointer Events, `dvh`, `env()`, `matchMedia`,
`:focus-visible`) are supported across all current engines.

## Dependencies

Everything is vendored under `vendor/` — there are no runtime requests to any
third party, so the site works offline, behind a firewall, with an ad-blocker,
and is unaffected by CDN outages. Versions and refresh instructions are in
[`vendor/VERSIONS.md`](vendor/VERSIONS.md).

## The DOS game bundles

`games/*.jsdos` are built from the plain game directories, then verified:

```sh
python3 tools/build-jsdos-bundles.py
python3 tools/check-jsdos-bundles.py
```

They need js-dos metadata (`.jsdos/dosbox.conf`, `.jsdos/readme.txt`,
`.jsdos/jsdos.json`, and an explicit `.jsdos/` directory entry) that a plain zip
does not have. The check is worth running every time: a bundle can be perfectly
well-formed and still boot to nothing but a DOS prompt, because its `[autoexec]`
names a program that is not in the archive — and nothing visible in the player
tells you which of the two you are looking at. See `vendor/VERSIONS.md` for the
full story.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl`/`Cmd` + `T` | Open the MS-DOS prompt |
| `Esc` | Skip the dial-up sequence; close the Start menu |
| `Enter` | Send a chat message |
| `↑` / `↓` | Command history in the terminal; message list in Mail |
| `←` / `→` | Previous/next slide; resize the mail splitter when focused |
| `Ctrl` + `Z` / `Y` | Undo / redo in Paint |

## Browser support

Current Chrome, Edge, Firefox and Safari, on desktop, tablet and phone.

The `.mp4` clips are H.264, so they need a browser built with that codec —
every mainstream browser has it, but a bare open-source Chromium build may not.
When the browser cannot decode a file the player says so rather than sitting on
a spinner.

## Licence

For educational and nostalgic purposes only. AOL, AIM, Windows and the games are
trademarks of their respective owners.
