// ============================================
// TERMINAL MANAGER MODULE
// An MS-DOS style prompt backed by xterm.js.
//
// The FitAddon keeps the grid matched to the window at every size — including
// when the window is resized, maximized, or the device is rotated.
// ============================================

class TerminalManager extends AppWindow {
  constructor() {
    super({
      id: 'terminal',
      title: 'MS-DOS Prompt',
      className: 'terminal-window',
      iconClass: 'term-icon',
      width: 640,
      height: 420,
    });
    this.terminalInstance = null;
    this.fitAddon = null;
    this.commandBuffer = '';
    this.history = [];
    this.historyIndex = -1;
    this.onWindowResize = () => this.fit();
  }

  /** Back-compat alias: older call sites said createTerminal(). */
  createTerminal() { return this.open(); }

  /**
   * Fetch the terminal engine. xterm is ~480KB — more than the rest of the site
   * put together — and most visitors never open a prompt, so it is loaded the
   * first time one is actually needed instead of on every page load.
   */
  static loadEngine() {
    if (TerminalManager.enginePromise) return TerminalManager.enginePromise;
    TerminalManager.enginePromise = Promise.all([
      Utils.loadStyle('xterm-css', 'vendor/xterm/xterm.css'),
      Utils.loadScript('xterm-js', 'vendor/xterm/xterm.js')
        .then(() => Utils.loadScript('xterm-fit', 'vendor/xterm/addon-fit.js')),
    ]).catch((err) => {
      TerminalManager.enginePromise = null;
      throw err;
    });
    return TerminalManager.enginePromise;
  }

  renderBody(body) {
    body.classList.add('terminal-body-wrap');
    this.container = document.createElement('div');
    this.container.className = 'terminal-container';
    this.container.innerHTML = '<p class="terminal-fallback">Starting MS-DOS…</p>';
    body.appendChild(this.container);

    window.addEventListener('resize', this.onWindowResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this.onWindowResize);

    TerminalManager.loadEngine()
      .then(() => {
        if (!this.container) return; // closed while loading
        this.container.replaceChildren();
        this.initializeXterm(this.container);
        this.fit();
        this.terminalInstance?.focus();
      })
      .catch((err) => {
        console.error('TerminalManager: could not load the terminal engine', err);
        if (this.container) {
          this.container.innerHTML =
            '<p class="terminal-fallback" role="alert">Could not load the terminal engine. Check your connection and try again.</p>';
        }
      });
  }

  onShow() {
    // Fit after layout settles so the grid matches the real box.
    requestAnimationFrame(() => {
      this.fit();
      this.terminalInstance?.focus();
    });
  }

  onClose() {
    window.removeEventListener('resize', this.onWindowResize);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', this.onWindowResize);
    try { this.terminalInstance?.dispose(); } catch (_) {}
    this.terminalInstance = null;
    this.fitAddon = null;
    this.container = null;
  }

  onResize() { this.fit(); }

  fit() {
    if (!this.fitAddon || !this.terminalInstance) return;
    if (this.isHidden) return;
    try { this.fitAddon.fit(); } catch (_) {}
  }

  initializeXterm(container) {
    if (typeof Terminal === 'undefined') {
      container.innerHTML = '<p class="terminal-fallback">Terminal engine unavailable. Reload the page to try again.</p>';
      return;
    }

    this.terminalInstance = new Terminal({
      cursorBlink: !Utils.prefersReducedMotion(),
      fontSize: Utils.isCompact() ? 11 : 13,
      fontFamily: '"Courier New", Courier, monospace',
      theme: { background: '#000000', foreground: '#ffffff', cursor: '#ffffff', cursorAccent: '#000000' },
      scrollback: 500,
      convertEol: true,
    });

    if (typeof FitAddon !== 'undefined' && FitAddon.FitAddon) {
      this.fitAddon = new FitAddon.FitAddon();
      this.terminalInstance.loadAddon(this.fitAddon);
    }

    this.terminalInstance.open(container);
    this.fit();
    this.writeWelcomeMessage();
    this.setupCommandHandling();

    // Tapping the terminal on touch devices should raise the soft keyboard.
    container.addEventListener('click', () => this.terminalInstance?.focus());
  }

  writeWelcomeMessage() {
    const t = this.terminalInstance;
    t.writeln('Microsoft(R) Windows 95');
    t.writeln('   (C)Copyright Microsoft Corp 1981-1995.');
    t.writeln('');
    t.writeln('Welcome to the Oxford Terminal Simulator!');
    t.writeln('Tip: type "dos" to browse games, or "civ" / "oregon" to launch one.');
    t.writeln('Type "help" for available commands.');
    t.writeln('');
    this.prompt();
  }

  prompt() { this.terminalInstance.write('C:\\WINDOWS> '); }

  setupCommandHandling() {
    this.commandBuffer = '';
    this.terminalInstance.onData((data) => {
      // Arrow keys arrive as escape sequences; use them for command history.
      if (data === '\x1b[A' || data === '\x1b[B') {
        this.recallHistory(data === '\x1b[A' ? -1 : 1);
        return;
      }
      if (data.charCodeAt(0) === 27) return; // ignore other escape sequences

      for (const ch of data) {
        const code = ch.charCodeAt(0);
        if (code >= 32 && code !== 127) {
          this.commandBuffer += ch;
          this.terminalInstance.write(ch);
        } else if (code === 127 || code === 8) {
          if (this.commandBuffer.length) {
            this.commandBuffer = this.commandBuffer.slice(0, -1);
            this.terminalInstance.write('\b \b');
          }
        } else if (code === 13 || code === 10) {
          this.terminalInstance.write('\r\n');
          const cmd = this.commandBuffer.trim();
          if (cmd) {
            this.history.push(cmd);
            if (this.history.length > 50) this.history.shift();
          }
          this.historyIndex = this.history.length;
          this.handleCommand(cmd);
          this.commandBuffer = '';
          this.prompt();
        }
      }
    });
  }

  recallHistory(delta) {
    if (!this.history.length) return;
    const next = Utils.clamp(this.historyIndex + delta, 0, this.history.length);
    this.historyIndex = next;
    const value = next === this.history.length ? '' : this.history[next];
    // Clear the current line, then reprint the prompt and the recalled command.
    this.terminalInstance.write('\r\x1b[K');
    this.prompt();
    this.terminalInstance.write(value);
    this.commandBuffer = value;
  }

  writeLines(lines) {
    lines.forEach((l) => this.terminalInstance.writeln(l));
    this.terminalInstance.writeln('');
  }

  handleCommand(cmd) {
    const command = cmd.toLowerCase();
    switch (command) {
      case '':
        break;

      case 'help':
        this.writeLines([
          'Available commands:',
          '  help     - Show this help message',
          '  dir      - List directory contents',
          '  cls      - Clear screen',
          '  ver      - Show version',
          '  time     - Display current time',
          '  date     - Display current date',
          '  oxford   - Messenger status',
          '  whoami   - Display current user',
          '  dos      - Open the MS-DOS game shelf',
          "  civ      - Launch Sid Meier's Civilization",
          '  oregon   - Launch The Oregon Trail',
        ]);
        break;

      case 'dir':
        this.writeLines([
          ' Volume in drive C is WINDOWS95',
          ' Directory of C:\\WINDOWS',
          '',
          'OXFORD   EXE     45,312  10-19-99  3:47p',
          'BUDDY    LST      1,024  10-19-99  2:15p',
          'CONFIG   SYS        128  10-19-99  1:00p',
          'AUTOEXEC BAT        256  10-19-99  1:00p',
          '        4 file(s)     46,720 bytes',
        ]);
        break;

      case 'cls':
        this.terminalInstance.clear();
        break;

      case 'ver':
        this.writeLines(['Windows 95 [Version 4.00.950]']);
        break;

      case 'time':
        this.writeLines([`Current time is: ${new Date().toLocaleTimeString()}`]);
        break;

      case 'date':
        this.writeLines([`Current date is: ${new Date().toLocaleDateString()}`]);
        break;

      case 'oxford':
        this.writeLines([
          'Oxford Messenger Status: Connected',
          'Buddies Online: 4',
          `Screen Name: ${this.getCurrentUser()}`,
          'Version: 4.7.2796',
        ]);
        break;

      case 'whoami':
        this.writeLines([this.getCurrentUser()]);
        break;

      case 'dos':
        this.launchDos(null);
        break;

      case 'civ':
        this.launchDos('civ', "Sid Meier's Civilization");
        break;

      case 'oregon':
        this.launchDos('oregon', 'The Oregon Trail');
        break;

      default:
        this.writeLines([`Bad command or file name: ${cmd}`]);
    }
  }

  launchDos(gameKey, label) {
    const manager = MSDosManager.shared();
    if (!manager) {
      this.writeLines(['MS-DOS subsystem unavailable. Please try again later.']);
      return;
    }
    if (gameKey) {
      manager.open(gameKey);
      this.writeLines([`Launching ${label} in a new window...`]);
    } else {
      manager.openLibrary();
      this.writeLines(['Opening the MS-DOS game shelf...']);
    }
  }

  getCurrentUser() {
    try {
      const stored = sessionStorage.getItem('ooUser');
      if (stored && stored.trim()) return stored.trim();
    } catch (err) {
      console.warn('TerminalManager: sessionStorage unavailable', err);
    }
    return 'User1999@aol.com';
  }

}

TerminalManager.enginePromise = null;
window.TerminalManager = TerminalManager;
