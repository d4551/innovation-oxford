// ============================================
// AUDIO MANAGER MODULE
// Handles all sound effects for the AIM application
// ============================================

class AudioManager {
    constructor() {
        this.sounds = {
            messageSend: null,
            messageReceive: null,
            dialup: null,
            welcome: null,
            gotMail: null,
            alert: null
        };
        
        this.initialized = false;
    }
    
    // Initialize all sound effects
    init() {
        if (this.initialized) return;
        
        // Message send sound
        this.sounds.messageSend = new Howl({
            src: ['media/sounds/aim-send.mp3'],
            volume: 0.7,
            onloaderror: (id, error) => {
                console.warn('Failed to load aim-send.mp3:', error);
            }
        });
        
        // Message receive sound
        this.sounds.messageReceive = new Howl({
            src: ['media/sounds/aim-in.mp3'],
            volume: 0.7,
            onloaderror: (id, error) => {
                console.warn('Failed to load aim-in.mp3:', error);
            }
        });
        
        // Dial-up modem sound
        this.sounds.dialup = new Howl({
            src: ['media/sounds/dial-up-modem-sound.mp3'],
            volume: 0.6,
            html5: true, // Enable HTML5 audio for better compatibility
            preload: true,
            onload: () => {
                console.log('✅ Dial-up sound loaded successfully');
            },
            onloaderror: (id, error) => {
                console.error('❌ Failed to load dial-up-modem-sound.mp3:', error);
            },
            onplayerror: (id, error) => {
                console.error('❌ Failed to play dial-up sound:', error);
            }
        });
        
        // Welcome sound
        this.sounds.welcome = new Howl({
            src: ['media/sounds/welcome.mp3'],
            volume: 0.8,
            onloaderror: (id, error) => {
                console.warn('Failed to load welcome.mp3:', error);
            }
        });
        
        // You've got mail sound
        this.sounds.gotMail = new Howl({
            src: ['media/sounds/you-ve-got-mail.mp3'],
            volume: 0.8,
            onloaderror: (id, error) => {
                console.warn('Failed to load you-ve-got-mail.mp3:', error);
            }
        });
        
        // General alert (requested)
        this.sounds.alert = new Howl({
            src: ['media/sounds/alert.mp3'],
            volume: 0.8,
            onloaderror: (id, error) => {
                console.warn('Failed to load alert.mp3:', error);
            }
        });
        
        this.initialized = true;
        console.log('AudioManager initialized with real sound files');
    }
    
    // Generic one-off play helper (DRY)
    playSound(howl, onEnd) {
        if (!howl) {
            if (onEnd) onEnd();
            return null;
        }
        const id = howl.play();
        if (onEnd) {
            howl.once('end', onEnd, id);
        }
        return id;
    }

    // Play with optional cap (ms). Calls onComplete on end or when cap elapses.
    playWithCap(howl, capMs, onComplete) {
        if (!howl) {
            if (onComplete) onComplete();
            return null;
        }
        const id = howl.play();
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            try { howl.off('end', onEnd, id); } catch (e) {}
            if (onComplete) onComplete();
        };
        const onEnd = () => finish();
        howl.once('end', onEnd, id);
        if (capMs && capMs > 0) {
            setTimeout(() => {
                if (!done) {
                    try { howl.stop(id); } catch (e) {}
                    finish();
                }
            }, capMs);
        }
        return id;
    }

    // Specific helpers using the DRY primitives
    playSend() { this.playSound(this.sounds.messageSend); }
    playReceive() { this.playSound(this.sounds.messageReceive); }
    playDialup(onEnd) { return this.playSound(this.sounds.dialup, onEnd); }
    playDialupWithCap(capMs, onEnd) { return this.playWithCap(this.sounds.dialup, capMs, onEnd); }
    playWelcome(onEnd) { return this.playSound(this.sounds.welcome, onEnd); }
    playGotMail(onEnd) { return this.playSound(this.sounds.gotMail, onEnd); }
    playAlert(onEnd) { return this.playSound(this.sounds.alert, onEnd); }
    
    // Stop all sounds
    stopAll() {
        Object.values(this.sounds).forEach(sound => {
            if (sound) {
                sound.stop();
            }
        });
    }
    
    // Set global volume (0.0 to 1.0)
    setVolume(volume) {
        Howler.volume(volume);
    }
    
    // Mute/unmute all sounds
    mute(muted) {
        Howler.mute(muted);
    }
}

// Export singleton instance
const audioManager = new AudioManager();
