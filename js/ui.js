import { CONFIG } from './config.js';

export class UI {
  constructor() {
    this.menuPulseTime = 0;
    this.scorePops = [];
    this.pbFlashTimer = 0;
  }

  updateMenu(dt) {
    this.menuPulseTime += dt;
  }

  update(dt) {
    // Update score pops
    for (const pop of this.scorePops) {
      pop.timer += dt;
    }
    this.scorePops = this.scorePops.filter(p => p.timer < CONFIG.SCORE_POP_DURATION);

    // Personal best flash decay
    if (this.pbFlashTimer > 0) {
      this.pbFlashTimer = Math.max(0, this.pbFlashTimer - dt);
    }
  }

  addScorePop(x, y, score, isStreak) {
    const text = isStreak ? `+${score.toLocaleString()}` : `+${score.toLocaleString()}`;
    this.scorePops.push({ x, y, text, timer: 0, isStreak });
  }

  triggerPBFlash() {
    this.pbFlashTimer = 1.0;
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

    // Leaderboard icon — bottom-right, trail glyph
    this.renderLeaderboardIcon(ctx, gameWidth, gameHeight, scale);
  }

  renderLeaderboardIcon(ctx, gameWidth, gameHeight, scale) {
    const x = gameWidth - 30 * scale;
    const y = gameHeight - 30 * scale;
    const s = 14 * scale;

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = CONFIG.BALL_COLOR;
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = 'round';

    // Small trail glyph
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y + s * 0.3);
    ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.5, x + s * 0.2, y);
    ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.4, x + s * 0.7, y - s * 0.15);
    ctx.stroke();

    // Dot at end
    ctx.fillStyle = CONFIG.BALL_COLOR;
    ctx.beginPath();
    ctx.arc(x + s * 0.7, y - s * 0.15, 2 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  isLeaderboardIconTap(x, y, renderer) {
    const { gameWidth, gameHeight, scale } = renderer;
    const iconX = gameWidth - 30 * scale;
    const iconY = gameHeight - 30 * scale;
    const hitSize = 35 * scale;
    return x > iconX - hitSize && x < iconX + hitSize &&
           y > iconY - hitSize && y < iconY + hitSize;
  }

  renderScore(ctx, gameWidth, gameHeight, scale, scoreManager) {
    const margin = 20 * scale;

    // Score — top-left, monospace, brighter at 70%, pulse on update
    const baseSize = Math.round(18 * scale);
    const pulseExtra = scoreManager.scorePulse * Math.min(scoreManager.lastScoreGain / 100, 3) * 4 * scale;
    const size = baseSize + pulseExtra;

    ctx.save();
    ctx.globalAlpha = 0.7;

    // Personal best flash: gold color when PB exceeded
    if (this.pbFlashTimer > 0) {
      ctx.fillStyle = CONFIG.RING_COLOR;
      ctx.globalAlpha = 0.7 + 0.3 * this.pbFlashTimer;
    } else {
      ctx.fillStyle = '#ffffff';
    }

    ctx.font = `${Math.round(size)}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(scoreManager.score.toLocaleString(), margin, margin);

    // Round indicator — subtle, below score
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(12 * scale)}px monospace`;
    const roundY = margin + size + 4 * scale;
    ctx.fillText(`R${scoreManager.round}`, margin, roundY);

    // Streak at threshold 3+
    if (scoreManager.streak >= CONFIG.STREAK_DISPLAY_THRESHOLD) {
      ctx.globalAlpha = 0.3;
      ctx.font = `${Math.round(13 * scale)}px monospace`;
      ctx.fillText(`\u00d7${scoreManager.streak} streak`, margin + 30 * scale, roundY);
    }

    ctx.restore();

    // Score pops
    this.renderScorePops(ctx, scale);
  }

  renderScorePops(ctx, scale) {
    for (const pop of this.scorePops) {
      const progress = pop.timer / CONFIG.SCORE_POP_DURATION;
      const alpha = 1 - progress;
      const rise = CONFIG.SCORE_POP_RISE * scale * progress;

      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = CONFIG.RING_COLOR;
      ctx.font = `bold ${Math.round(16 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pop.text, pop.x, pop.y - rise);
      ctx.restore();
    }
  }

  renderRunEnd(ctx, gameWidth, gameHeight, scale, scoreManager, timer) {
    const p1End = CONFIG.RUN_END_PAUSE;
    const p2End = p1End + CONFIG.RUN_END_TRAIL_HOLD;
    const p3End = p2End + CONFIG.RUN_END_SCORE_FADE;
    const p4End = p3End + CONFIG.RUN_END_PROMPT_DELAY;

    // Phase 3: score fade-in
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

      // Longest streak
      if (scoreManager.longestStreak >= CONFIG.STREAK_DISPLAY_THRESHOLD) {
        ctx.fillText(`${scoreManager.longestStreak} streak`, gameWidth / 2, gameHeight * 0.40 + 65 * scale);
      }

      ctx.restore();
    }

    // After 7.5s: Save + restart
    if (timer >= p4End) {
      ctx.save();

      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(14 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('tap to restart', gameWidth / 2, gameHeight * 0.85);

      // Save — bottom-right, gold if personal best
      ctx.textAlign = 'right';
      ctx.fillStyle = scoreManager.isNewPersonalBest ? CONFIG.RING_COLOR : '#ffffff';
      ctx.fillText('Save', gameWidth - 20 * scale, gameHeight * 0.92);

      ctx.restore();
    }
  }
}
