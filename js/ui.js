import { CONFIG } from './config.js';

export class UI {
  constructor() {
    this.menuPulseTime = 0;
  }

  updateMenu(dt) {
    this.menuPulseTime += dt;
  }

  renderMenu(ctx, gameWidth, gameHeight, scale, personalBest) {
    // Pulsing "BOUNCE" — 60-100% opacity, gold
    const t = this.menuPulseTime * CONFIG.RING_PULSE_SPEED * 0.5;
    const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = CONFIG.RING_COLOR;
    ctx.font = `bold ${Math.round(48 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOUNCE', gameWidth / 2, gameHeight / 2);
    ctx.restore();

    // Personal best below title
    if (personalBest > 0) {
      ctx.save();
      ctx.globalAlpha = CONFIG.PERSONAL_BEST_OPACITY;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(14 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`best: ${personalBest.toLocaleString()}`, gameWidth / 2, gameHeight / 2 + 40 * scale);
      ctx.restore();
    }
  }

  renderScore(ctx, gameWidth, gameHeight, scale, scoreManager) {
    const margin = 20 * scale;

    // Score — top-left, monospace, white at 40%, pulse on update
    const baseSize = Math.round(18 * scale);
    const pulseExtra = scoreManager.scorePulse * Math.min(scoreManager.lastScoreGain / 100, 3) * 4 * scale;
    const size = baseSize + pulseExtra;

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(size)}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(scoreManager.score.toLocaleString(), margin, margin);

    // Streak display — fade in at threshold (3+)
    if (scoreManager.streak >= CONFIG.STREAK_DISPLAY_THRESHOLD) {
      ctx.globalAlpha = 0.3;
      ctx.font = `${Math.round(13 * scale)}px monospace`;
      ctx.fillText(`×${scoreManager.streak} streak`, margin, margin + size + 4 * scale);
    }

    ctx.restore();
  }

  renderRunEnd(ctx, gameWidth, gameHeight, scale, scoreManager, timer) {
    const p1End = CONFIG.RUN_END_PAUSE;
    const p2End = p1End + CONFIG.RUN_END_TRAIL_HOLD;
    const p3End = p2End + CONFIG.RUN_END_SCORE_FADE;
    const p4End = p3End + CONFIG.RUN_END_PROMPT_DELAY;

    // Phase 3: score fade-in (after trail hold)
    if (timer >= p2End) {
      const fadeProgress = Math.min((timer - p2End) / CONFIG.RUN_END_SCORE_FADE, 1);

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Total score
      ctx.globalAlpha = fadeProgress * 0.8;
      ctx.font = `bold ${Math.round(36 * scale)}px monospace`;
      ctx.fillText(scoreManager.score.toLocaleString(), gameWidth / 2, gameHeight * 0.40);

      // Rounds
      ctx.globalAlpha = fadeProgress * 0.5;
      ctx.font = `${Math.round(16 * scale)}px monospace`;
      ctx.fillText(`${scoreManager.round} rounds`, gameWidth / 2, gameHeight * 0.40 + 40 * scale);

      // Longest streak (if notable)
      if (scoreManager.longestStreak >= CONFIG.STREAK_DISPLAY_THRESHOLD) {
        ctx.fillText(`${scoreManager.longestStreak} streak`, gameWidth / 2, gameHeight * 0.40 + 65 * scale);
      }

      ctx.restore();
    }

    // After full 7.5s: Save text + tap to restart
    if (timer >= p4End) {
      ctx.save();

      // "tap to restart" — center
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(14 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('tap to restart', gameWidth / 2, gameHeight * 0.85);

      // "Save" — bottom-right, 30% monospace, gold if personal best
      ctx.textAlign = 'right';
      ctx.fillStyle = scoreManager.isNewPersonalBest ? CONFIG.RING_COLOR : '#ffffff';
      ctx.fillText('Save', gameWidth - 20 * scale, gameHeight * 0.92);

      ctx.restore();
    }
  }
}
