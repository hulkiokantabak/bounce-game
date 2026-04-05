import { CONFIG } from './config.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { return; }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBounce(speed) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freq = CONFIG.BOUNCE_SOUND_BASE_FREQ + speed * CONFIG.BOUNCE_SOUND_SPEED_SCALE * 1.5;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Percussive thock: quick pitch drop
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 2, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.02);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.5, 20), now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playWallBounce() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Primary impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.04);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);

    // Resonant tail
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(130, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain2.gain.setValueAtTime(0.04, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.08);
  }

  playPlace(yRatio) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Spatial audio: pitch varies by y-position (higher near top, lower near bottom)
    const t = 1 - Math.max(0, Math.min(1, yRatio || 0.5));
    const freq = CONFIG.PLACE_SOUND_FREQ_LOW + t * (CONFIG.PLACE_SOUND_FREQ_HIGH - CONFIG.PLACE_SOUND_FREQ_LOW);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playRingChime(streak) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Pitch rises with streak for escalating excitement
    const pitchMult = 1 + (streak || 0) * 0.05;
    const baseFreq = CONFIG.RING_CHIME_FREQ * pitchMult;

    // Fundamental — always plays
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Overtone (octave above, softer) — always plays
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * 2, now);
    gain2.gain.setValueAtTime(0.1, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.15);

    // Major third — unlocks at streak 4+ (chord progression)
    if ((streak || 0) >= 4) {
      const osc3 = this.ctx.createOscillator();
      const gain3 = this.ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(baseFreq * 1.26, now); // major third
      gain3.gain.setValueAtTime(0.08, now);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc3.connect(gain3);
      gain3.connect(this.ctx.destination);
      osc3.start(now);
      osc3.stop(now + 0.18);
    }

    // Perfect fifth — unlocks at streak 7+ (full chord)
    if ((streak || 0) >= 7) {
      const osc4 = this.ctx.createOscillator();
      const gain4 = this.ctx.createGain();
      osc4.type = 'sine';
      osc4.frequency.setValueAtTime(baseFreq * 1.5, now); // perfect fifth
      gain4.gain.setValueAtTime(0.06, now);
      gain4.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc4.connect(gain4);
      gain4.connect(this.ctx.destination);
      osc4.start(now);
      osc4.stop(now + 0.2);
    }
  }

  /** Subtle rising tone as ball approaches ring — called once when approachFactor first exceeds threshold */
  playApproachTone(approachFactor) {
    if (!this.ctx) return;
    if (this._approachPlaying) return;
    this._approachPlaying = true;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 400 + approachFactor * 200;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq + 150, now + 0.25);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    setTimeout(() => { this._approachPlaying = false; }, 300);
  }

  /** Brief ascending pair of notes for new personal best mid-run */
  playPBChime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(660, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.25);
  }

  playNearMissShimmer() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playRingKill() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(CONFIG.RING_KILL_FREQ, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(CONFIG.RING_KILL_FREQ * 0.3, 20), now + 0.4);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playRoundTransition() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playEnd() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Primary tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(CONFIG.END_SOUND_FREQ, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // Detuned second oscillator — hollow resonance
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(CONFIG.END_SOUND_FREQ * 1.02, now);
    gain2.gain.setValueAtTime(0.1, now);
    gain2.gain.linearRampToValueAtTime(0, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.6);
  }
}

// Haptics — graceful degradation for iOS Safari
export function vibrate(pattern) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // navigator.vibrate not supported (iOS Safari)
  }
}
