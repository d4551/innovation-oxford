// ============================================
// TERMINAL MANAGER MODULE
// Handles terminal emulator functionality
// ============================================

class TerminalManager {
    constructor() {
        this.terminalInstance = null;
        this.terminalWindow = null;
        this.commandBuffer = '';
        this.taskbarId = 'terminal';
        this.taskbarEntry = null;
    }
    
    createTerminal() {
        // Prevent multiple terminals
        if (document.querySelector('.terminal-window')) {
            // Focus existing and activate taskbar
            this.terminalWindow = document.querySelector('.terminal-window');
            this.activate();
            return this.terminalWindow;
        }
        
        // Create terminal window
        this.terminalWindow = document.createElement('div');
        this.terminalWindow.className = 'window terminal-window';
        this.terminalWindow.style.width = '600px';
        this.terminalWindow.style.height = '400px';
        this.terminalWindow.style.top = '100px';
        this.terminalWindow.style.left = '760px';
        this.terminalWindow.style.zIndex = '999';
        
        // Create title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'title-bar';
        titleBar.innerHTML = `
            <div class="title-bar-text">
                <div class="title-bar-icon"></div>
                MS-DOS Prompt
            </div>
            <div class="title-bar-controls">
                <button class="title-bar-btn" onclick="terminalManager.minimize()">_</button>
                <button class="title-bar-btn">□</button>
                <button class="title-bar-btn" onclick="terminalManager.close()">X</button>
            </div>
        `;
        
        // Create window body
        const windowBody = document.createElement('div');
        windowBody.className = 'window-body';
        windowBody.style.padding = '0';
        windowBody.style.height = 'calc(100% - 24px)';
        
        // Create terminal container
        const termContainer = document.createElement('div');
        termContainer.id = 'terminal-container';
        termContainer.style.height = '100%';
        termContainer.style.padding = '4px';
        termContainer.style.background = '#000000';
        
        windowBody.appendChild(termContainer);
        this.terminalWindow.appendChild(titleBar);
        this.terminalWindow.appendChild(windowBody);
        document.querySelector('.desktop').appendChild(this.terminalWindow);
        
        // Initialize xterm.js
        this.initializeXterm(termContainer);
        
        // Make terminal draggable
        if (window.windowManager) {
            window.windowManager.makeWindowDraggable(this.terminalWindow, titleBar);
        }
        // Register taskbar button
        if (window.taskbarManager) {
            this.taskbarEntry = window.taskbarManager.addWindow(this.taskbarId, 'MS-DOS Prompt', {
                onToggle: () => this.toggleFromTaskbar(),
                iconClass: 'term-icon'
            });
        }
        
        return this.terminalWindow;
    }
    
    initializeXterm(container) {
        if (typeof Terminal === 'undefined') {
            container.innerHTML = '<p style="color: white; padding: 10px;">xterm.js not loaded. Check your internet connection.</p>';
            return;
        }
        
        this.terminalInstance = new Terminal({
            cursorBlink: true,
            fontSize: 12,
            fontFamily: '"Courier New", Courier, monospace',
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#ffffff',
                cursorAccent: '#000000'
            },
            cols: 80,
            rows: 24
        });
        
        this.terminalInstance.open(container);
        this.writeWelcomeMessage();
        this.setupCommandHandling();
    }
    
    writeWelcomeMessage() {
        this.terminalInstance.writeln('Microsoft(R) Windows 95');
        this.terminalInstance.writeln('   (C)Copyright Microsoft Corp 1981-1995.');
        this.terminalInstance.writeln('');
        this.terminalInstance.writeln('C:\\WINDOWS>_');
        this.terminalInstance.writeln('');
        this.terminalInstance.writeln('Welcome to the Oxford Terminal Simulator!');
    this.terminalInstance.writeln('Tip: type "dos" to browse games or launch "civ"/"oregon" directly.');
        this.terminalInstance.writeln('Type "help" for available commands.');
        this.terminalInstance.writeln('');
        this.terminalInstance.write('C:\\WINDOWS> ');
    }
    
    setupCommandHandling() {
        this.commandBuffer = '';
        
        this.terminalInstance.onData(data => {
            const code = data.charCodeAt(0);
            
            // Handle printable characters
            if (code >= 32 && code < 127) {
                this.commandBuffer += data;
                this.terminalInstance.write(data);
            }
            // Handle backspace
            else if (code === 127 || code === 8) {
                if (this.commandBuffer.length > 0) {
                    this.commandBuffer = this.commandBuffer.slice(0, -1);
                    this.terminalInstance.write('\b \b');
                }
            }
            // Handle enter
            else if (code === 13) {
                this.terminalInstance.writeln('');
                this.handleCommand(this.commandBuffer.trim());
                this.commandBuffer = '';
                this.terminalInstance.write('C:\\WINDOWS> ');
            }
        });
    }
    
    handleCommand(cmd) {
        const command = cmd.toLowerCase();
        
        switch(command) {
            case 'help':
                this.terminalInstance.writeln('Available commands:');
                this.terminalInstance.writeln('  help     - Show this help message');
                this.terminalInstance.writeln('  dir      - List directory contents');
                this.terminalInstance.writeln('  cls      - Clear screen');
                this.terminalInstance.writeln('  ver      - Show version');
                this.terminalInstance.writeln('  time     - Display current time');
                this.terminalInstance.writeln('  date     - Display current date');
                this.terminalInstance.writeln('  oxford   - Messenger status');
                this.terminalInstance.writeln('  whoami   - Display current user');
                this.terminalInstance.writeln('  civ      - Launch Sid Meier\'s Civilization');
                this.terminalInstance.writeln('  oregon   - Launch The Oregon Trail');
                this.terminalInstance.writeln('');
                break;
                
            case 'dir':
                this.terminalInstance.writeln(' Volume in drive C is WINDOWS95');
                this.terminalInstance.writeln(' Directory of C:\\WINDOWS');
                this.terminalInstance.writeln('');
                this.terminalInstance.writeln('OXFORD   EXE     45,312  10-19-99  3:47p');
                this.terminalInstance.writeln('BUDDY    LST      1,024  10-19-99  2:15p');
                this.terminalInstance.writeln('CONFIG   SYS        128  10-19-99  1:00p');
                this.terminalInstance.writeln('AUTOEXEC BAT        256  10-19-99  1:00p');
                this.terminalInstance.writeln('        4 file(s)     46,720 bytes');
                this.terminalInstance.writeln('');
                break;
                
            case 'cls':
                this.terminalInstance.clear();
                break;
                
            case 'ver':
                this.terminalInstance.writeln('Windows 95 [Version 4.00.950]');
                this.terminalInstance.writeln('');
                break;
                
            case 'time':
                const now = new Date();
                this.terminalInstance.writeln('Current time is: ' + now.toLocaleTimeString());
                this.terminalInstance.writeln('');
                break;
                
            case 'date':
                const today = new Date();
                this.terminalInstance.writeln('Current date is: ' + today.toLocaleDateString());
                this.terminalInstance.writeln('');
                break;
                
            case 'oxford':
                this.terminalInstance.writeln('Oxford Messenger Status: Connected');
                this.terminalInstance.writeln('Buddies Online: 3');
                this.terminalInstance.writeln('Screen Name: User1999');
                this.terminalInstance.writeln('Version: 4.7.2796');
                this.terminalInstance.writeln('');
                break;
                
            case 'whoami':
                this.terminalInstance.writeln(this.getCurrentUser());
                this.terminalInstance.writeln('');
                break;

            case 'dos':
                this.launchDosLibrary();
                break;

            case 'civ':
                this.launchDosGame('civ', "Sid Meier's Civilization");
                break;

            case 'oregon':
                this.launchDosGame('oregon', 'The Oregon Trail');
                break;
                
            case '':
                break;
                
            default:
                this.terminalInstance.writeln(`Bad command or file name: ${cmd}`);
                this.terminalInstance.writeln('');
        }
    }

    getDosManager() {
        let manager = window.msdosManager || (typeof msdosManager !== 'undefined' ? msdosManager : null);
        if (!manager && typeof MSDosManager !== 'undefined') {
            try {
                manager = new MSDosManager();
                if (typeof manager.init === 'function') {
                    manager.init();
                }
                if (typeof msdosManager !== 'undefined') {
                    msdosManager = manager;
                }
                window.msdosManager = manager;
            } catch (err) {
                console.warn('TerminalManager: unable to initialize MSDosManager on demand', err);
            }
        }
        if (manager) {
            if (!window.msdosManager) {
                window.msdosManager = manager;
            }
        }
        return manager;
    }

    launchDosLibrary() {
        const manager = this.getDosManager();
        if (manager && typeof manager.openLibrary === 'function') {
            manager.openLibrary();
            this.terminalInstance.writeln('Opening the MS-DOS game shelf...');
        } else if (manager) {
            this.terminalInstance.writeln('MS-DOS subsystem ready, but the library view is unavailable.');
        } else {
            this.terminalInstance.writeln('MS-DOS subsystem unavailable. Please try again later.');
        }
        this.terminalInstance.writeln('');
    }

    launchDosGame(gameKey, label) {
        const manager = this.getDosManager();
        if (manager) {
            manager.open(gameKey);
            this.terminalInstance.writeln(`Launching ${label} in a new window...`);
        } else {
            this.terminalInstance.writeln('MS-DOS subsystem unavailable. Please try again later.');
        }
        this.terminalInstance.writeln('');
    }

    getCurrentUser() {
        try {
            const stored = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('ooUser') : null;
            if (stored && stored.trim()) {
                return stored.trim();
            }
        } catch (err) {
            console.warn('TerminalManager: unable to access sessionStorage', err);
        }
        return 'User1999@aol.com';
    }
    
    close() {
        if (this.terminalWindow) {
            this.terminalWindow.remove();
            this.terminalInstance = null;
            this.terminalWindow = null;
            if (window.taskbarManager) window.taskbarManager.remove(this.taskbarId);
        }
    }
    
    minimize() {
        if (this.terminalWindow) {
            this.terminalWindow.style.display = 'none';
            if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, false);
        }
    }
    
    restore() {
        if (this.terminalWindow) {
            this.terminalWindow.style.display = 'block';
            this.activate();
        }
    }

    toggleFromTaskbar() {
        if (!this.terminalWindow) {
            this.createTerminal();
            return;
        }
        const hidden = this.terminalWindow.style.display === 'none';
        if (hidden) this.restore(); else this.minimize();
    }

    activate() {
        if (!this.terminalWindow) return;
        this.terminalWindow.style.zIndex = ++windowManager.zIndexCounter;
        if (window.taskbarManager) window.taskbarManager.setActive(this.taskbarId, true);
    }
}

// Create global instance
let terminalManager = null;
