# Oxford Messenger

A playable recreation of a 1999 desktop: an AOL-style instant messenger, mail
client, Paint, media player, MS-DOS prompt and two real DOS games — all running
in the browser from static files.

No build step, no framework, no CDN, no tracking. Open `index.html` and it runs.

---

## Contents

- [Running it](#running-it)
- [What's in it](#whats-in-it)
- [Weight](#weight)
- [Layout](#layout)
- [Accessibility](#accessibility)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [The DOS games](#the-dos-games)
- [Checks](#checks)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Dependencies](#dependencies)
- [Browser support](#browser-support)
- [Licence](#licence)

---

## Running it

Any static file server works:

```sh
npx http-server -p 8099 -c-1 .
# then open http://127.0.0.1:8099
```

Opening `index.html` straight off disk mostly works, but the DOS games and all
the sound do not. A browser refuses to let a `file://` page read other local
files, so neither the game bundles nor the audio can be fetched. The DOS player
detects this and says so in the window, with the remedy, rather than spinning.

If you deploy this to GitHub Pages, keep the `.nojekyll` file. Without it Pages
runs the tree through Jekyll, which drops `vendor` — where the js-dos runtime and
its WebAssembly emulators live — and every DOS game 404s on a site that worked
perfectly in local testing.

There is nothing to install and nothing to build. The `package.json` exists only
for the checks; the site ships no dependency of its own and loads nothing at
runtime that is not in this repository. The `tools/` scripts need Python 3 and
the checks need Node, but neither is required to *run* the site.

## What's in it

Sign in with any name and password — it is a museum piece, not an account
system — and sit through (or skip) the dial-up sequence.

| App | What it does |
|---|---|
| **Oxford Messenger** | Buddy list plus an IM window. Thirteen buddies, four of them online; each replies in its own voice, types visibly before answering, and eventually shares a real link. The nine offline ones are disabled rather than hidden. History persists for the session. |
| **Oxford Mail** | Inbox and Sent, sortable by From/Subject/Date, reader pane with a toggleable preview, compose/reply/delete, mark read/unread, and a "check for new mail" that occasionally finds one. Read state persists in `localStorage`. |
| **MS-DOS Prompt** | xterm.js with a real command set (`help`, `dir`, `cls`, `ver`, `time`, `date`, `oxford`, `whoami`, `dos`, `civ`, `oregon`), history on ↑/↓, and auto-fit to the window at any size. |
| **MS-DOS Games** | The Oregon Trail and Sid Meier's Civilization, running under DOSBox via js-dos 8 — the actual games, playable to the end, with save state, speed control and an on-screen keyboard. |
| **Oxford Paint** | Pencil and eraser, colour picker, brush size, undo/redo and save-as-PNG, over a base photograph. Mouse, finger and stylus all work. |
| **Internet Explorer** | Period-accurate chrome around a snapshot of the real Oxford course page; clicking it opens the live page in a new tab. |
| **Oxford Channels** | Ten channel tiles opening an "Innovation & You" slide deck — ten slides with clipart, images and video links, wrapping at both ends. |
| **Media Player** | Windows-98-style player with seek, volume, a playlist that shows what is loaded, and a live audio visualiser driven by the Web Audio API. |
| **Folders** | Desktop folders whose contents open in the right app — clips go to the media player. |

## Weight

| When | What arrives |
|---|---|
| First load | ~306KB across 25 requests |
| Opening the terminal | ~480KB — the xterm.js engine and its stylesheet |
| Opening the DOS shelf | ~440KB — the js-dos runtime, prefetched at idle priority |
| Launching a game | ~1.7–1.9MB bundle plus ~1.7MB of DOSBox WebAssembly |
| Opening Internet Explorer | 223KB–822KB depending on the display |

Nothing above the first row is fetched until someone actually opens that app, so
most visitors never download any of it. The Internet Explorer snapshot ships at
three widths and the element reports its own measured width to the browser, so a
laptop takes 223KB where a 2× display takes 822KB. It used to be one 3.4MB PNG
for everybody.

## Layout

Two layout modes, switched by a `matchMedia` listener in `main.js` that toggles
`body.is-compact`:

- **Wide** (>900px and >520px tall) — free-floating windows you can drag, resize
  from any edge or corner, maximize, minimize and stack. New windows cascade so
  they never land exactly on top of each other.
- **Compact** (tablets and phones) — every window is pinned full-bleed above the
  taskbar and the taskbar becomes the window switcher. Dragging and resizing are
  disabled because they cannot work well under a thumb. Messenger splits the
  screen: buddy list on top, conversation below — side by side in landscape.
  **Start → Show Desktop** gets you back to the icons.

Windows are clamped back into view on resize and rotation, so nothing can end up
stranded off-screen. All pointer interaction — window drag, window resize,
painting, the mail splitter — goes through Pointer Events, so mouse, touch and
stylus run one code path rather than three.

## Accessibility

- Every control is a real `<button>` with an accessible name, reachable and
  operable by keyboard, with a visible focus ring.
- Each window is a named `region` and a focus target. Opening one moves focus to
  the window itself, so it announces its name and the next Tab lands inside it.
  Closing or minimizing hands focus back — to wherever it came from, then the
  front-most window still open, then the Start button. Never `<body>`.
- Targets meet the WCAG 2.5.8 (AA) 24×24px minimum, and are enlarged on
  touch-primary devices.
- All text meets WCAG 1.4.3 contrast, verified by computing real ratios against
  the composited background rather than trusting a scan that reports
  *incomplete* for anything it cannot resolve.
- The CRT flicker runs at 0.25Hz — far below the three-per-second limit in WCAG
  2.3.1 — and all decorative motion is removed under `prefers-reduced-motion`.
- Live regions announce chat messages, mail status, player state and terminal
  output.
- `prefers-contrast: more` and a print stylesheet are both supported.

Two pieces of third-party UI a visitor actually touches are held to the same
bar as the rest of the app:

- **The DOS player.** js-dos draws its controls as bare `<div>`s with click
  handlers — no role, no name, no tab stop, a 16px rail, and 20×20 radios. That
  is WCAG 2.1.1, 4.1.2 and 2.5.8 failing in the only UI a player has for saving,
  speed, full screen and the on-screen keyboard. `vendor/jsdos/player.html`
  adds all of it, and puts the game canvas first in the frame's tab order so
  Enter and Space reach DOSBox rather than a button.
- **The terminal.** xterm renders to a canvas and marks its rows `aria-hidden`,
  so a screen-reader user could type `help` and hear nothing. `TerminalManager`
  keeps a `role="log"` transcript of every line it writes, off-screen but
  announced.

## Architecture

Plain classic scripts — no bundler, no modules, no framework. Each file declares
a class on `window`; `main.js` constructs them all inside a `safely()` wrapper so
one failing module degrades one feature instead of taking the desktop down.

### The window lifecycle

Every windowed app extends `AppWindow`, which owns creating the shell, wiring the
three title-bar buttons, registering a taskbar button, focus handling, and
minimize/restore/maximize/close. Subclasses implement `renderBody()` and,
optionally, `onShow()`, `onHide()`, `onClose()` and `onResize()`. Adding an app
is a subclass, not another copy of the same six methods.

Window visibility is the `.window--hidden` class rather than an inline
`display`, so the compact layout can own `display` without fighting inline
styles written by dragging and resizing.

### Sizing

Windows are flex columns: the title bar is `flex: 0 0 auto` and the body takes
what is left. Nothing derives a height from a magic `calc()` against a title-bar
constant, which is what used to break whenever the real title bar measured
differently.

### Isolation

The DOS player runs inside a same-origin iframe rather than in the page. js-dos
ships a full Tailwind build whose preflight would strip every border the Windows
95 look is made of, and a layout that assumes it owns the document. The frame
gives it the viewport it expects and gives the app back a hard boundary; closing
the window removes the frame, which tears down the emulator, its worker, its
audio graph and its listeners in one step. See
[`vendor/VERSIONS.md`](vendor/VERSIONS.md).

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
games/                     *.jsdos bundles, built by tools/
media/                     images, audio, video
vendor/                    all third-party code (see vendor/VERSIONS.md)
  jsdos/player.html        the page the DOS games run inside
tools/
  build-jsdos-bundles.py   build games/*.jsdos from the plain game directories
  check-jsdos-bundles.py   verify each bundle starts the program it names
```

## The DOS games

`games/*.jsdos` are built from the plain game directories, then verified:

```sh
python3 tools/build-jsdos-bundles.py
python3 tools/check-jsdos-bundles.py
```

A bundle needs js-dos metadata a plain zip does not have: `.jsdos/dosbox.conf`,
`.jsdos/readme.txt`, `.jsdos/jsdos.json`, and an explicit `.jsdos/` **directory**
entry, without which the config never reaches the emulated filesystem and DOSBox
exits 101 before printing anything.

Run the check every time. A bundle can be perfectly well-formed and still boot to
nothing but a DOS prompt, because its `[autoexec]` names a program that is not in
the archive — and nothing visible in the player tells you which of the two you
are looking at. Measured against a bundle with a missing program, DOSBox's own
welcome banner scored *higher* on colour and on frame-to-frame change than either
real game, and its video mode matched Civilization's own text menu. The archive
is the only thing that can answer the question, so that is what the check reads.

### When a game will not start

The emulator runs in `vendor/jsdos/player.html`, a same-origin frame the host
talks to over `postMessage`. Three failures used to look identical from the
outside — a spinner reading "Loading DOS environment…" — and each now names
itself in the window within a few seconds:

| What happened | What you see |
| --- | --- |
| Page opened off disk (`file://`) | The reason, and the `python3 -m http.server` remedy. No Retry: it cannot help. |
| Bundle missing or 404 | The URL and the status the server returned. Retry offered. |
| `vendor/` never published | Which file is missing. No Retry. |

Three details make that work, and each was a bug on its own:

- **`ci-ready`, not `emu-ready`, means the game is running.** `emu-ready` fires
  as soon as the js-dos UI mounts and says nothing about whether the bundle will
  arrive — treating it as success let a failed download look like a booted game.
- **`postMessage` has no usable target origin for a `file://` page.** Chrome
  reports `location.origin` as `"file://"` there, but messages are matched
  against the document's real origin, which is opaque — so addressing it
  *silently* drops every message, with a console warning rather than a throw a
  `try`/`catch` could see. Both directions fall back to `"*"`; authenticity
  comes from checking the sending window's identity, not the origin string.
- **js-dos catches its own download failure and only logs it.** No exception, no
  rejection, nothing to listen for. The player asks the server the same question
  itself — but only once the answer is overdue, so a healthy launch never spends
  the extra request, and only a definitive negative is ever reported.

## Checks

The site itself has no dependencies and no build. The checks do, so they live
behind a `package.json` that the site never touches:

```sh
npm install                  # playwright, axe-core, pngjs, eslint, http-server
npx playwright install chromium
npm run serve                # http://127.0.0.1:8099, in another shell
```

Then, from fastest to slowest:

| Command | What it covers |
| --- | --- |
| `npm run lint` | ESLint over `js/`, `main.js` and `checks/` |
| `npm run check:bundles` | Each bundle starts the program it names (no browser needed) |
| `npm run check:dialup` | Sign-on with and without audio; the three figures are drawn and stay legible through the fill |
| `npm run check:dos` | Both games boot, take keystrokes, minimize, restore, relaunch; all three failure modes report correctly |
| `npm run check:axe` | axe-core over the whole site and inside the DOS player |
| `npm run check:keyboard` | Keyboard-only pass, checking where focus lands |
| `npm run check:play` | Fifteen scenarios driven end to end as a person would |
| `npm run check:audit` | Visual probes, tap targets, contrast and overflow at three viewports |
| `npm run check:interact` | The full suite — 211 steps across three viewports |

`npm run check:dos-file` is separate because it deliberately opens the site over
`file://` to prove the DOS player explains itself there rather than hanging.

Screenshots land in `checks/out/`, which is git-ignored. `BASE` overrides the
server URL, so the same checks run against a deploy:
`BASE=https://example.com npm run check:audit`.

The browser is not configurable. These checks assert on pixels — contrast
ratios, what the emulator drew, whether a control is covered — and against a
build that does not match the installed Playwright those numbers would look
authoritative while meaning nothing.

Beyond the first two, the site is verified by driving a real browser — headed
Chromium, real mouse, real touch events and real keystrokes, never scripted
calls into the page. JavaScript is used only to *read* state back for assertions.

At 1440×900, 820×1180 and 390×844:

- **Every app opened, used and closed** — a conversation held and answered, a
  message read, sorted, composed and found again in Sent, all ten slides paged
  through and wrapped at both ends, a stroke drawn in Paint and undone exactly,
  every terminal command run and its output checked, Civilization booted and
  driven three prompts deep by keyboard, then minimized, restored and closed.
- **A visual probe on every screenshot** — off-screen windows, text clipped by
  its own box or by an ancestor, controls under the taskbar, scrollers that
  extend past their window, controls covered by something else, real WCAG
  contrast ratios, and horizontal page overflow.
- **axe-core** (WCAG 2.0/2.1/2.2 A and AA, plus best-practice) on the sign-in
  screen, the bare desktop, with every app open, and inside the DOS player with
  its sidebar, settings, speed panel and on-screen keyboard open.
- **A keyboard-only pass** — sign in, reach the Start button, open every app,
  operate it and close it without touching the mouse, checking where focus lands
  at each step.
- **The dial-up sequence with and without audio**, because the two used to run
  off different clocks and the silent path announced "Connected" while the
  progress boxes were still filling.

Zero failures, zero visual defects, zero console errors, zero horizontal
overflow, zero axe violations.

Only Chromium is available in the environment used for those runs, so Firefox
and Safari have not been exercised automatically. Nothing in the code is
engine-specific — the APIs used (Pointer Events, `dvh`, `env()`, `matchMedia`,
`:focus-visible`, `inert`) are supported across all current engines.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `Ctrl`/`Cmd` + `T` | Open the MS-DOS prompt |
| `Esc` | Skip the dial-up sequence; close the Start menu |
| `Enter` | Send a chat message; activate the focused control |
| `↑` / `↓` | Command history in the terminal; move through the Start menu |
| `←` / `→` | Previous/next slide; resize the mail splitter when focused |
| `Ctrl` + `Z` / `Y` | Undo / redo in Paint |
| `Tab` | Into the focused window, then through its controls |

## Dependencies

Everything is vendored under `vendor/` — there are **no runtime requests to any
third party**, so the site works offline, behind a firewall, with an ad-blocker,
and is unaffected by CDN outages. It also means no SRI hashes to rotate and no
third party can observe visitors.

| Asset | Version |
|---|---|
| [`@xterm/xterm`](https://www.npmjs.com/package/@xterm/xterm) | 6.0.0 |
| [`@xterm/addon-fit`](https://www.npmjs.com/package/@xterm/addon-fit) | 0.11.0 |
| [`howler`](https://www.npmjs.com/package/howler) | 2.2.4 |
| [`js-dos`](https://js-dos.com/) | 8.4.1 |

Refresh instructions, the reasoning behind the DOS player's isolation, and what
`player.html` fixes on js-dos's behalf are all in
[`vendor/VERSIONS.md`](vendor/VERSIONS.md).

## Browser support

Current Chrome, Edge, Firefox and Safari, on desktop, tablet and phone.

The `.mp4` clips are H.264, so they need a browser built with that codec — every
mainstream browser has it, but a bare open-source Chromium build may not. When
the browser cannot decode a file the player says so, resets its readout, and
refuses to pretend the transport buttons are doing anything.

Without audio — muted, or Howler unavailable — every sound becomes a no-op that
still fires its completion callback, so nothing that chains on a sound can
stall. The dial-up sequence shortens to match rather than sitting in silence.

## Licence

For educational and nostalgic purposes only. AOL, AIM, Windows and the games are
trademarks of their respective owners.
