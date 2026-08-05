// ============================================
// AUDIO MANAGER MODULE
// Wraps Howler for every sound effect in the app.
//
// Degrades gracefully: if Howler is unavailable or a file fails to decode,
// playback becomes a no-op that still fires its completion callback, so
// callers that chain on `onEnd` never stall and the app never dies for the
// want of a sound.
// ============================================

const SOUND_SOURCES = {
  messageSend: { src: 'media/sounds/aim-send.mp3', volume: 0.7 },
  messageReceive: { src: 'media/sounds/aim-in.mp3', volume: 0.7 },
  dialup: { src: 'media/sounds/dial-up-modem-sound.mp3', volume: 0.6, html5: true },
  welcome: { src: 'media/sounds/welcome.mp3', volume: 0.8 },
  gotMail: { src: 'media/sounds/you-ve-got-mail.mp3', volume: 0.8 },
  alert: { src: 'media/sounds/alert.mp3', volume: 0.8 },
};

class AudioManager {
  constructor() {
    this.sounds = {};
    this.initialized = false;
    this.available = false;
    this.muted = false;
  }

  init() {
    if (this.initialized) return this.available;
    this.initialized = true;

    if (typeof Howl === 'undefined') {
      console.warn('AudioManager: Howler unavailable — running silently.');
      return false;
    }

    Object.entries(SOUND_SOURCES).forEach(([key, cfg]) => {
      try {
        this.sounds[key] = new Howl({
          src: [cfg.src],
          volume: cfg.volume,
          html5: !!cfg.html5,
          preload: true,
          onloaderror: (_id, err) => console.warn(`AudioManager: failed to load ${cfg.src}`, err),
          onplayerror: (_id, err) => console.warn(`AudioManager: failed to play ${cfg.src}`, err),
        });
      } catch (err) {
        console.warn(`AudioManager: could not create sound "${key}"`, err);
        this.sounds[key] = null;
      }
    });

    this.available = true;
    return true;
  }

  /** Play once. `onEnd` always runs — immediately if there is nothing to play. */
  playSound(howl, onEnd) {
    if (!howl || this.muted) {
      if (onEnd) onEnd();
      return null;
    }
    try {
      const id = howl.play();
      if (onEnd) howl.once('end', onEnd, id);
      return id;
    } catch (err) {
      console.warn('AudioManager: playback failed', err);
      if (onEnd) onEnd();
      return null;
    }
  }

  /** True when this sound would actually be heard. */
  canPlay(key) {
    return !this.muted && !!this.sounds[key];
  }

  /**
   * Play with a hard cap in milliseconds. `onComplete` fires on natural end or
   * when the cap elapses, whichever comes first — exactly once.
   *
   * With nothing to play the cap is still honoured rather than shortened: a
   * caller pacing an animation against it has one timeline either way. Callers
   * that want a brisker silent path should ask `canPlay()` and pass a shorter
   * cap, which is a decision only they can make.
   */
  playWithCap(howl, capMs, onComplete) {
    if (!howl || this.muted) {
      if (onComplete) setTimeout(() => onComplete(), Math.max(0, capMs || 0));
      return null;
    }

    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (onComplete) onComplete();
    };

    try {
      const id = howl.play();
      howl.once('end', finish, id);
      if (capMs > 0) {
        timer = setTimeout(() => {
          if (!done) {
            try { howl.stop(id); } catch (_) {}
            finish();
          }
        }, capMs);
      }
      return id;
    } catch (err) {
      console.warn('AudioManager: capped playback failed', err);
      finish();
      return null;
    }
  }

  playSend() { return this.playSound(this.sounds.messageSend); }
  playReceive() { return this.playSound(this.sounds.messageReceive); }
  playDialup(onEnd) { return this.playSound(this.sounds.dialup, onEnd); }
  playDialupWithCap(capMs, onEnd) { return this.playWithCap(this.sounds.dialup, capMs, onEnd); }
  playWelcome(onEnd) { return this.playSound(this.sounds.welcome, onEnd); }
  playGotMail(onEnd) { return this.playSound(this.sounds.gotMail, onEnd); }
  playAlert(onEnd) { return this.playSound(this.sounds.alert, onEnd); }

  /** Duration of a loaded sound in ms, or 0 when unknown. */
  durationMs(key) {
    const howl = this.sounds[key];
    try {
      const d = howl && typeof howl.duration === 'function' ? howl.duration() : 0;
      return d ? Math.round(d * 1000) : 0;
    } catch (_) {
      return 0;
    }
  }

  stopAll() {
    Object.values(this.sounds).forEach((s) => {
      if (s) { try { s.stop(); } catch (_) {} }
    });
  }

  setVolume(volume) {
    if (typeof Howler !== 'undefined') Howler.volume(Utils.clamp(volume, 0, 1));
  }

  mute(muted) {
    this.muted = !!muted;
    if (typeof Howler !== 'undefined') Howler.mute(this.muted);
  }
}

const audioManager = new AudioManager();
window.audioManager = audioManager;
