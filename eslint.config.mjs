// Lint config for the site's plain-script modules.
//
// Everything here is a classic <script> (no bundler, no modules), so the
// cross-file class names below are real globals rather than imports. Run with:
//
//     npx eslint js/ main.js

const BROWSER_GLOBALS = [
  'window', 'document', 'console', 'navigator', 'location', 'history',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame',
  'sessionStorage', 'localStorage', 'fetch', 'URL', 'URLSearchParams',
  'Image', 'CustomEvent', 'Event', 'MouseEvent', 'PointerEvent',
  'CSS', 'getComputedStyle', 'matchMedia', 'AudioContext', 'visualViewport',
];

// Provided by vendored third-party bundles.
// `Dos`/`emulators` are deliberately absent: js-dos runs inside
// vendor/jsdos/player.html, not in the page.
const VENDOR_GLOBALS = ['Howl', 'Howler', 'Terminal', 'FitAddon'];

// Declared in one file of this project and consumed in others.
const PROJECT_GLOBALS = [
  'Utils', 'Buddies', 'AppWindow', 'windowManager', 'audioManager',
  'WindowManager', 'AudioManager', 'TaskbarManager', 'ChatManager',
  'MailManager', 'TerminalManager', 'MSDosManager', 'DialupIntro',
  'MediaPlayerManager', 'IEManager', 'PaintManager', 'FolderManager',
  'ChannelsManager', 'StartMenu', 'DesktopIconsManager',
];

const globals = Object.fromEntries(
  [...BROWSER_GLOBALS, ...VENDOR_GLOBALS, ...PROJECT_GLOBALS].map((name) => [name, 'readonly']),
);

export default [
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals },
    rules: {
      'no-undef': 'error',
      // `builtinGlobals: false` — the names above are declarations in their own
      // file, not redeclarations of a builtin.
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-implied-eval': 'error',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],
    },
  },
];
