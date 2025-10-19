// ============================================
// DIALUP INTRO MODULE
// Handles the AOL dial-up connection sequence
// ============================================

class DialupIntro {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.introContainer = null;
        this.hasPlayed = false;
        this.timers = [];
    }
    
    show() {
        // Check if already shown in this session
        if (this.hasPlayed || sessionStorage.getItem('dialupShown')) {
            return false;
        }
        
        this.hasPlayed = true;
        sessionStorage.setItem('dialupShown', 'true');
        
        // Show login screen first
        this.showLoginScreen();
        
        return true;
    }
    
    showLoginScreen() {
        // Create intro overlay - reusing existing window structure
        this.introContainer = document.createElement('div');
        this.introContainer.id = 'dialup-intro';
        this.introContainer.className = 'dialup-intro';
        
        this.introContainer.innerHTML = `
            <div class="window dialup-window">
                <div class="title-bar">
                    <div class="title-bar-text">Welcome to Oxford Online</div>
                    <div class="title-bar-controls">
                        <!-- No skip on login to avoid loop -->
                    </div>
                </div>
                <div class="window-body">
                    <div class="logo-container">
                        <img src="media/Oxford/logo.svg" alt="Oxford Logo" class="logo-img">
                        <div class="logo-text">OXFORD<br><span class="logo-online">Online</span></div>
                    </div>
                    <form class="form-95" onsubmit="return window.dialupIntro.handleLoginSubmit(event)">
                        <div class="row">
                            <label for="oo-username">Screen Name</label>
                            <input id="oo-username" class="input-95" type="text" autocomplete="username" required>
                        </div>
                        <div class="row">
                            <label for="oo-password">Password</label>
                            <input id="oo-password" class="input-95" type="password" autocomplete="current-password" required>
                        </div>
                        <div class="button-row" style="margin-top: 10px;">
                            <button type="submit" class="btn-95 btn-connect">Sign In</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.introContainer);
    }
    
    handleLoginSubmit(e) {
        e.preventDefault();
        const user = (document.getElementById('oo-username')?.value || '').trim();
        const pass = (document.getElementById('oo-password')?.value || '').trim();
        if (!user || !pass) return false;

        // Persist for the session (fake auth)
        sessionStorage.setItem('ooUser', user);

        // Initialize app components now that we have user interaction
        try {
            if (this.audioManager && !this.audioManager.initialized) {
                this.audioManager.init();
            }
            if (typeof initializeApplication === 'function') {
                initializeApplication();
            }
        } catch (err) {
            console.warn('Init after login failed', err);
        }

        // Move to connection sequence
        this.connect();
        return false;
    }

    connect() {
        // Remove login screen and show connection sequence
        if (this.introContainer) {
            this.introContainer.remove();
        }
        
        // Create connection animation screen
        this.introContainer = document.createElement('div');
        this.introContainer.id = 'dialup-intro';
        this.introContainer.className = 'dialup-intro';
        
        this.introContainer.innerHTML = `
            <div class="window dialup-window">
                <div class="title-bar">
                    <div class="title-bar-text">Welcome to Oxford Online</div>
                    <div class="title-bar-controls">
                        <button class="btn-95" onclick="window.dialupIntro.skip()" aria-label="Skip" title="Skip (ESC)">×</button>
                    </div>
                </div>
                <div class="window-body">
                    <div class="logo-container logo-container-large">
                        <img src="media/Oxford/logo.svg" alt="Oxford Logo" class="logo-img logo-img-large">
                        <div class="logo-text logo-text-large">OXFORD<br><span class="logo-online logo-online-large">Online</span></div>
                    </div>
                    <div class="status-message">
                        <span id="dialup-status-text">Connecting To Oxford Online...</span>
                    </div>
                    <div class="animation-boxes">
                        <div class="aol-box" id="aol-box-1">
                            <div class="box-emoji">🏃</div>
                        </div>
                        <div class="aol-box" id="aol-box-2">
                            <div class="box-emoji">🏃💨</div>
                        </div>
                        <div class="aol-box" id="aol-box-3">
                            <div class="box-emoji">👥</div>
                        </div>
                    </div>
                    <div class="progress-line"></div>
                    <button class="btn-95 btn-center" onclick="window.dialupIntro.skip()">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.introContainer);
        
        // Start the connection sequence
        this.startSequence();
    }
    
    startSequence() {
        const statusText = document.getElementById('dialup-status-text');
        const box1 = document.getElementById('aol-box-1');
        const box2 = document.getElementById('aol-box-2');
        const box3 = document.getElementById('aol-box-3');

        const dial = this.audioManager && this.audioManager.sounds ? this.audioManager.sounds.dialup : null;
        let dialDurationMs = 0;
        try {
            const d = dial && dial.duration ? dial.duration() : 0;
            dialDurationMs = d ? Math.round(d * 1000) : 0;
        } catch (e) {
            dialDurationMs = 0;
        }

        // Cap dial-up max length to keep UX snappy, but let it fully play if shorter
        const MAX_DIALUP_MS = 9000;
        const targetDialMs = dialDurationMs > 0 ? Math.min(dialDurationMs, MAX_DIALUP_MS) : MAX_DIALUP_MS;

        console.log('🔊 Playing dial-up sound...', { targetDialMs, dialDurationMs });

        // Schedule proportional animation fills relative to target dial duration
        const schedule = (fn, ms) => { const id = setTimeout(fn, ms); this.timers.push(id); return id; };
        const p1 = Math.max(200, Math.floor(targetDialMs * 0.11));
        const p2 = Math.max(400, Math.floor(targetDialMs * 0.44));
        const p3 = Math.max(600, Math.floor(targetDialMs * 0.77));

        schedule(() => { statusText.textContent = 'Connecting To Oxford Online...'; if (box1) box1.classList.add('filled'); }, p1);
        schedule(() => { if (box2) box2.classList.add('filled'); }, p2);
        schedule(() => { if (box3) box3.classList.add('filled'); }, p3);

        // Chain: Dial-up (end or cap) -> Welcome (end) -> You've Got Mail (end) -> Fade
        const WAIT_AFTER_DIAL_MS = 1500; // small pause before Welcome
        const afterDial = () => {
            console.log('✅ Dial-up complete');
            if (statusText) statusText.textContent = 'Connected. Preparing welcome...';
            schedule(() => {
                if (statusText) statusText.textContent = 'Welcome!';
                this.audioManager.playWelcome(() => {
                    console.log('✅ Welcome sound played');
                    this.audioManager.playGotMail(() => {
                        console.log('✅ You\'ve Got Mail sound played');
                        schedule(() => this.fadeOut(), 500);
                    });
                });
            }, WAIT_AFTER_DIAL_MS);
        };

        if (this.audioManager && this.audioManager.playDialupWithCap) {
            this.audioManager.playDialupWithCap(targetDialMs, afterDial);
        } else if (this.audioManager && this.audioManager.playDialup) {
            // Fallback: no cap support
            this.audioManager.playDialup(afterDial);
        } else {
            console.error('❌ Audio manager or dialup sound not initialized');
            // Proceed anyway after target duration
            schedule(afterDial, targetDialMs);
        }
    }
    
    fadeOut() {
        if (this.introContainer) {
            this.introContainer.classList.add('fade-out');
            
            setTimeout(() => {
                if (this.introContainer && this.introContainer.parentNode) {
                    this.introContainer.remove();
                }
                this.introContainer = null;
                // Clear any pending timers
                try { this.timers.forEach(id => clearTimeout(id)); } catch (e) {}
                this.timers = [];
                // Reveal desktop/dashboard when sequence finishes
                const desktop = document.querySelector('.desktop');
                if (desktop) desktop.classList.remove('hidden');
            }, 1000);
        }
    }
    
    skip() {
        // Allow users to skip the intro
        this.audioManager.stopAll();
        this.fadeOut();
    }
    
    // Reset for testing (removes session storage flag)
    reset() {
        sessionStorage.removeItem('dialupShown');
        this.hasPlayed = false;
    }
}

// Instance is created on window in main.js
