import { CONFIG } from './config.js';

export class UI {
  constructor() {
    this.menuPulseTime = 0;
    this.scorePops = [];
    this.pbFlashTimer = 0;
    this.surfaceFlashes = [];
    this.particles = [];
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

    // Surface flashes
    for (const f of this.surfaceFlashes) {
      f.timer += dt;
    }
    this.surfaceFlashes = this.surfaceFlashes.filter(f => f.timer < 0.15);

    // Particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  addScorePop(x, y, score, isStreak, isClean) {
    let text = `+${score.toLocaleString()}`;
    if (isClean) text = `CLEAN! ${text}`;
    this.scorePops.push({ x, y, text, timer: 0, isStreak, isClean });
  }

  addSurfaceFlash(x, y) {
    this.surfaceFlashes.push({ x, y, timer: 0 });
  }

  spawnRingParticles(x, y, scale) {
    for (let i = 0; i < CONFIG.RING_SUCCESS_PARTICLES; i++) {
      const angle = (Math.PI * 2 / CONFIG.RING_SUCCESS_PARTICLES) * i + Math.random() * 0.3;
      const speed = CONFIG.PARTICLE_SPEED * scale * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: CONFIG.PARTICLE_LIFE,
        maxLife: CONFIG.PARTICLE_LIFE,
      });
    }
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

    // "tap to play" prompt
    const tapPulse = 0.15 + 0.15 * Math.sin(this.menuPulseTime * 2);
    ctx.save();
    ctx.globalAlpha = tapPulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(14 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('tap to play', gameWidth / 2, gameHeight / 2 + 35 * scale);
    ctx.restore();

    // Personal best below prompt
    if (personalBest > 0) {
      ctx.save();
      ctx.globalAlpha = CONFIG.PERSONAL_BEST_OPACITY;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(14 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`best: ${personalBest.toLocaleString()}`, gameWidth / 2, gameHeight / 2 + 60 * scale);
      ctx.restore();
    }

    // Leaderboard icon — bottom-right, trail glyph with breathing
    this.renderLeaderboardIcon(ctx, gameWidth, gameHeight, scale);
  }

  renderLeaderboardIcon(ctx, gameWidth, gameHeight, scale) {
    const x = gameWidth - 30 * scale;
    const y = gameHeight - 30 * scale;
    const s = 14 * scale;

    // Breathing opacity
    const breathe = 0.25 + 0.15 * Math.sin(this.menuPulseTime * 1.5);

    ctx.save();
    ctx.globalAlpha = breathe;
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
      ctx.font = `bold ${Math.round(pop.isClean ? 18 : 16) * scale}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pop.text, pop.x, pop.y - rise);
      ctx.restore();
    }
  }

  renderBounceMultiplier(ctx, ball, scale, bounceCount) {
    if (!ball || !ball.alive) return;
    const idx = Math.min(bounceCount, CONFIG.BOUNCE_MULTIPLIERS.length - 1);
    const mult = CONFIG.BOUNCE_MULTIPLIERS[idx];
    if (mult <= 1) return; // Don't show 1×

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = mult >= 5 ? CONFIG.RING_COLOR : '#ffffff';
    ctx.font = `${Math.round(10 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${mult}\u00d7`, ball.x, ball.y - ball.radius - 6 * scale);
    ctx.restore();
  }

  renderSurfaceFlashes(ctx, scale) {
    for (const f of this.surfaceFlashes) {
      const progress = f.timer / 0.15;
      const alpha = 0.6 * (1 - progress);
      const radius = (8 + 12 * progress) * scale;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderParticles(ctx, scale) {
    for (const p of this.particles) {
      const alpha = (p.life / p.maxLife) * 0.8;
      const radius = 2 * scale * (p.life / p.maxLife);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = CONFIG.RING_COLOR;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderPauseOverlay(ctx, gameWidth, gameHeight, scale) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(32 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', gameWidth / 2, gameHeight / 2);

    ctx.globalAlpha = 0.3;
    ctx.font = `${Math.round(14 * scale)}px monospace`;
    ctx.fillText('tap to resume', gameWidth / 2, gameHeight / 2 + 35 * scale);

    ctx.restore();
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

      // Personal best line
      if (scoreManager.isNewPersonalBest) {
        ctx.globalAlpha = fadeProgress * 0.7;
        ctx.fillStyle = CONFIG.RING_COLOR;
        ctx.font = `bold ${Math.round(14 * scale)}px monospace`;
        ctx.fillText('NEW BEST!', gameWidth / 2, gameHeight * 0.40 + 90 * scale);
      } else if (scoreManager.personalBest > 0) {
        ctx.globalAlpha = fadeProgress * 0.25;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(13 * scale)}px monospace`;
        ctx.fillText(`best: ${scoreManager.personalBest.toLocaleString()}`, gameWidth / 2, gameHeight * 0.40 + 90 * scale);
      }

      ctx.restore();
    }

    // Save + restart prompt
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
