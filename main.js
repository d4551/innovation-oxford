// ============================================
// MAIN APPLICATION
// Coordinates all modules and initializes the app
// ============================================

// ============================================
// TIME UPDATE
// ============================================

function updateTime() {
    const now = new Date();
    const hours = now.getHours() % 12 || 12;
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    const timeDisplay = document.getElementById('timeDisplay');
    if (timeDisplay) {
        timeDisplay.textContent = `${hours}:${minutes} ${ampm}`;
    }
}

// ============================================
// GLOBAL FUNCTIONS (Called from HTML)
// ============================================

function sendMessage() {
    if (chatManager) {
        chatManager.sendMessage();
    }
}

function openChat(username) {
    if (chatManager) {
        chatManager.openChat(username);
    }
}

function createTerminalWindow() {
    if (terminalManager) {
        terminalManager.createTerminal();
    }
}

function closeTerminal() {
    if (terminalManager) {
        terminalManager.close();
    }
}

function minimizeTerminal() {
    if (terminalManager) {
        terminalManager.minimize();
    }
}





// ============================================
// INITIALIZATION
// ============================================

// Function to initialize the application after user interaction
function initializeApplication() {
    console.log('🎮 Initializing Oxford Messenger...');
    
    // Initialize Window Manager
    windowManager.init();

    // Initialize taskbar before app modules so they can register
    if (!window.taskbarManager) {
        window.taskbarManager = new TaskbarManager();
        window.taskbarManager.init();
    }

    // Initialize Chat Manager (AIM)
    chatManager = new ChatManager(audioManager);
    chatManager.init();

    // Initialize Terminal Manager
    terminalManager = new TerminalManager();
    
    // Update time immediately and every minute
    updateTime();
    setInterval(updateTime, 60000);
    
    // Add keyboard shortcut to open terminal (Ctrl+T)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            if (!document.querySelector('.terminal-window')) {
                createTerminalWindow();
            }
        }
        
        // ESC to skip dialup intro
        if (e.key === 'Escape' && window.dialupIntro && document.getElementById('dialup-intro')) {
            window.dialupIntro.skip();
        }
    });
    
    // Initialize app modules that don't require audio
    if (!window.ieManager) {
        window.ieManager = new IEManager();
    }
    if (!window.mailManager) {
        window.mailManager = new MailManager();
    }
    if (!window.channelsManager) {
        window.channelsManager = new ChannelsManager({ ieManager: window.ieManager });
    }
    if (!window.mailManager) {
        window.mailManager = new MailManager();
    }
    if (!window.folderManager) {
        window.folderManager = new FolderManager();
    }
    if (!window.mediaPlayerManager) {
        window.mediaPlayerManager = new MediaPlayerManager({ windowTitle: 'Oxford Media Player' });
    }
    if (!window.paintManager) {
        window.paintManager = new PaintManager({ imagePath: 'media/inno-paint.jpg' });
    }
    if (!window.startMenu) {
        window.startMenu = new StartMenu({ ieManager: window.ieManager, channelsManager: window.channelsManager, mailManager: window.mailManager, paintManager: window.paintManager });
        window.startMenu.init();
    }
    if (!window.desktopIcons) {
        window.desktopIcons = new DesktopIconsManager({ ieManager: window.ieManager, channelsManager: window.channelsManager, mailManager: window.mailManager, folderManager: window.folderManager, mediaPlayerManager: window.mediaPlayerManager, paintManager: window.paintManager });
        window.desktopIcons.init();
    }

    console.log('✅ Oxford Messenger initialized successfully!');
    // Desktop will be shown after dial-up completes (handled by DialupIntro)
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Hide desktop until dial-up completes
    const desktop = document.querySelector('.desktop');
    if (desktop) desktop.classList.add('hidden');

    // Prepare dial-up/login flow
    window.dialupIntro = new DialupIntro(audioManager);
    window.dialupIntro.showLoginScreen();

    // Do not auto-open Mail before login; user can launch it later

    // Expose helper to reset dial-up for testing
    // window.resetDialup = () => window.dialupIntro.reset();
});
