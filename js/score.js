import { CONFIG } from './config.js';

export class ScoreManager {
  constructor() {
    this.score = 0;
    this.round = 0;
    this.bounceCount = 0;
    this.streak = 0;
    this.longestStreak = 0;
    this.personalBest = this.loadPersonalBest();
    this.isNewPersonalBest = false;

    // Score pulse animation
    this.scorePulse = 0;
    this.lastScoreGain = 0;

    // Dual-ring accumulated base score for Ring A
    this.dualBaseA = 0;
  }

  reset() {
    this.score = 0;
    this.round = 0;
    this.bounceCount = 0;
    this.streak = 0;
    this.longestStreak = 0;
    this.isNewPersonalBest = false;
    this.dualBaseA = 0;
  }

  nextRound() {
    this.round++;
    this.bounceCount = 0;
    this.dualBaseA = 0;
  }

  onBounce() {
    this.bounceCount++;
  }

  getBounceMultiplier() {
    const idx = Math.min(this.bounceCount, CONFIG.BOUNCE_MULTIPLIERS.length - 1);
    return CONFIG.BOUNCE_MULTIPLIERS[idx];
  }

  onSingleRingSuccess() {
    const bounceMult = this.getBounceMultiplier();
    const streakMult = 1.0 + this.streak * CONFIG.STREAK_MULTIPLIER_STEP;
    const ringScore = Math.round(CONFIG.BASE_RING_SCORE * bounceMult * streakMult);
    this.score += ringScore;
    this.streak++;
    this.longestStreak = Math.max(this.longestStreak, this.streak);
    this.lastScoreGain = ringScore;
    this.scorePulse = 1.0;
    this.bounceCount = 0;
    return ringScore;
  }

  onDualRingASuccess() {
    this.dualBaseA = CONFIG.BASE_RING_SCORE * this.getBounceMultiplier();
    this.bounceCount = 0;
  }

  onDualRingBSuccess() {
    const baseB = CONFIG.BASE_RING_SCORE * this.getBounceMultiplier();
    const streakMult = 1.0 + this.streak * CONFIG.STREAK_MULTIPLIER_STEP;
    const total = Math.round((this.dualBaseA + baseB) * CONFIG.DUAL_RING_BONUS * streakMult);
    this.score += total;
    this.streak++;
    this.longestStreak = Math.max(this.longestStreak, this.streak);
    this.lastScoreGain = total;
    this.scorePulse = 1.0;
    this.bounceCount = 0;
    return total;
  }

  update(dt) {
    if (this.scorePulse > 0) {
      this.scorePulse = Math.max(0, this.scorePulse - dt * 4);
    }
  }

  checkPersonalBest() {
    if (this.score > this.personalBest) {
      this.personalBest = this.score;
      this.isNewPersonalBest = true;
      this.savePersonalBest();
      return true;
    }
    return false;
  }

  loadPersonalBest() {
    try {
      return parseInt(localStorage.getItem('bounce_personal_best') || '0', 10);
    } catch {
      return 0;
    }
  }

  savePersonalBest() {
    try {
      localStorage.setItem('bounce_personal_best', String(this.personalBest));
    } catch { /* localStorage unavailable */ }
  }
}
