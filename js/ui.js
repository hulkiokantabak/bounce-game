import { CONFIG } from './config.js';

export class UI {
  constructor() {
    this.menuPulseTime = 0;
    this.scorePops = [];
    this.pbFlashTimer = 0;
    this.surfaceFlashes = [];
    this.particles = [];
    this.wallImpacts = [];
    this.deathSplashes = [];
    this.hints = [];
    this.transitionDip = 0;

    // Lifetime stat rotator for menu
    this.menuStatIndex = 0;
    this.menuStatTimer = 0;
    this.menuStatFade = 1;

    // Streak milestone flash
    this.streakFlash = null;

    // Menu dust particles
    this.menuDust = [];

    // Round transition sweep
    this.roundSweep = null;

    // Round badge
    this.roundBadge = null;

    // Clean flash
    this.cleanFlash = null;

    // Surface placement ripples
    this.ripples = [];

    // Bounce directional particles
    this.bounceParticles = [];

    // Background star field
    this.stars = [];
    this._initStars();
  }

  _initStars() {
    for (let i = 0; i < CONFIG.STAR_COUNT; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        size: 0.5 + Math.random() * CONFIG.STAR_MAX_SIZE,
        alpha: CONFIG.STAR_MIN_OPACITY + Math.random() * (CONFIG.STAR_MAX_OPACITY - CONFIG.STAR_MIN_OPACITY),
        twinkleSpeed: 0.5 + Math.random() * 2,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  updateMenu(dt) {
    this.menuPulseTime += dt;

    // Update dust particles
    for (const d of this.menuDust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      // Wrap
      if (d.x < -0.05) d.x = 1.05;
      if (d.x > 1.05) d.x = -0.05;
      if (d.y < -0.05) d.y = 1.05;
      if (d.y > 1.05) d.y = -0.05;
    }
  }

  initMenuDust(lifetime) {
    const runs = lifetime ? lifetime.stats.totalRuns : 0;
    let count = 0;
    if (runs >= 200) count = CONFIG.MENU_DUST_AFTER_200;
    else if (runs >= 50) count = CONFIG.MENU_DUST_AFTER_50;

    this.menuDust = [];
    for (let i = 0; i < count; i++) {
      this.menuDust.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.005,
        vy: (Math.random() - 0.5) * 0.003,
        size: 1 + Math.random() * 1.5,
        alpha: 0.03 + Math.random() * 0.05,
      });
    }
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

    // Wall impacts
    for (const w of this.wallImpacts) w.timer += dt;
    this.wallImpacts = this.wallImpacts.filter(w => w.timer < 0.15);

    // Death splashes
    for (const d of this.deathSplashes) d.timer += dt;
    this.deathSplashes = this.deathSplashes.filter(d => d.timer < 0.4);

    // Hints
    for (const h of this.hints) h.timer += dt;
    this.hints = this.hints.filter(h => h.timer < 2.0);

    // Ripples
    for (const r of this.ripples) r.timer += dt;
    this.ripples = this.ripples.filter(r => r.timer < CONFIG.SURFACE_RIPPLE_DURATION);

    // Bounce particles
    for (const bp of this.bounceParticles) {
      bp.x += bp.vx * dt;
      bp.y += bp.vy * dt;
      bp.life -= dt;
    }
    this.bounceParticles = this.bounceParticles.filter(bp => bp.life > 0);

    // Transition dip
    if (this.transitionDip > 0) {
      this.transitionDip = Math.max(0, this.transitionDip - dt * 12);
    }

    // Round sweep
    if (this.roundSweep) {
      this.roundSweep.timer += dt;
      if (this.roundSweep.timer >= CONFIG.ROUND_SWEEP_DURATION) {
        this.roundSweep = null;
      }
    }

    // Streak milestone flash
    if (this.streakFlash) {
      this.streakFlash.timer += dt;
      if (this.streakFlash.timer >= this.streakFlash.duration) {
        this.streakFlash = null;
      }
    }

    // Clean flash
    if (this.cleanFlash) {
      this.cleanFlash.timer += dt;
      if (this.cleanFlash.timer >= 0.3) {
        this.cleanFlash = null;
      }
    }

    // Round badge
    if (this.roundBadge) {
      this.roundBadge.timer += dt;
      if (this.roundBadge.timer >= CONFIG.ROUND_BADGE_DURATION) {
        this.roundBadge = null;
      }
    }

    // Menu stat rotation
    this.menuStatTimer += dt;
    const interval = CONFIG.MENU_STAT_ROTATE_INTERVAL;
    if (this.menuStatTimer >= interval) {
      this.menuStatTimer -= interval;
      this.menuStatIndex++;
    }
    // Fade in/out within cycle
    const cycleT = this.menuStatTimer / interval;
    if (cycleT < 0.1) {
      this.menuStatFade = cycleT / 0.1;
    } else if (cycleT > 0.9) {
      this.menuStatFade = (1 - cycleT) / 0.1;
    } else {
      this.menuStatFade = 1;
    }
  }

  addScorePop(x, y, score, isStreak, isClean, mult) {
    let text = `+${score.toLocaleString()}`;
    if (mult > 0) text += ` (${mult}\u00d7)`;
    if (isClean) text = `CLEAN! ${text}`;
    // Offset stacking: shift up by number of active pops to prevent overlap
    const stackOffset = this.scorePops.length * 18;
    this.scorePops.push({ x, y: y - stackOffset, text, timer: 0, isStreak, isClean });
  }

  addSurfaceFlash(x, y, color) {
    this.surfaceFlashes.push({ x, y, timer: 0, color: color || '#ffffff' });
  }

  spawnRingParticles(x, y, scale, streak) {
    const count = Math.min(
      CONFIG.RING_SUCCESS_PARTICLES + (streak || 0) * CONFIG.PARTICLE_STREAK_BONUS,
      CONFIG.PARTICLE_MAX
    );
    const speedMult = 1 + (streak || 0) * 0.08;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      const speed = CONFIG.PARTICLE_SPEED * scale * (0.5 + Math.random() * 0.5) * speedMult;
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

  addWallImpact(x, y) {
    this.wallImpacts.push({ x, y, timer: 0 });
  }

  addDeathSplash(x, y, color) {
    this.deathSplashes.push({ x, y, timer: 0, color: color || '#ffffff' });
  }

  showHint(text, x, y) {
    this.hints.push({ text, x, y, timer: 0 });
  }

  addRipple(x, y) {
    this.ripples.push({ x, y, timer: 0 });
  }

  addBounceParticles(x, y, vx, vy, scale) {
    // Directional spray — particles go opposite to ball velocity
    const baseAngle = Math.atan2(-vy, -vx);
    const count = CONFIG.BOUNCE_PARTICLE_COUNT;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * Math.PI * 0.6;
      const angle = baseAngle + spread;
      const speed = CONFIG.BOUNCE_PARTICLE_SPEED * scale * (0.5 + Math.random() * 0.5);
      this.bounceParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: CONFIG.BOUNCE_PARTICLE_LIFE,
        maxLife: CONFIG.BOUNCE_PARTICLE_LIFE,
      });
    }
  }

  triggerTransitionDip() {
    this.transitionDip = 1.0;
  }

  triggerRoundSweep() {
    this.roundSweep = { timer: 0 };
  }

  triggerPBFlash() {
    this.pbFlashTimer = 1.0;
  }

  triggerCleanFlash() {
    this.cleanFlash = { timer: 0 };
  }

  triggerRoundBadge(round) {
    this.roundBadge = { round, timer: 0 };
  }

  triggerStreakFlash(streak) {
    if (streak === 5) {
      this.streakFlash = { tint: CONFIG.STREAK_MILESTONE_5_FLASH_TINT, duration: 0.35, timer: 0 };
    } else if (streak >= 10) {
      this.streakFlash = { tint: CONFIG.STREAK_MILESTONE_10_FLASH_TINT, duration: CONFIG.STREAK_MILESTONE_10_FLASH_DURATION, timer: 0 };
    }
  }

  renderMenu(ctx, gameWidth, gameHeight, scale, personalBest, lifetime) {
    // Pulsing "BOUNCE" — 60-100% opacity, color evolves with lifetime
    const t = this.menuPulseTime * CONFIG.RING_PULSE_SPEED * 0.5;
    const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));

    const titleColors = ['#ffcc66', '#ffc44d', '#ffbb33', '#ffaa22'];
    const titleTier = lifetime ? lifetime.getTitleTier() : 0;

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = titleColors[titleTier];
    ctx.font = `bold ${Math.round(48 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOUNCE', gameWidth / 2, gameHeight / 2);
    ctx.restore();

    // "tap to play" prompt — varies for returning players
    const tapPulse = 0.15 + 0.15 * Math.sin(this.menuPulseTime * 2);
    const runs = lifetime ? lifetime.stats.totalRuns : 0;
    const tapText = runs === 0 ? 'tap to play' : runs < 5 ? 'try again' : 'one more';
    ctx.save();
    ctx.globalAlpha = tapPulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(14 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tapText, gameWidth / 2, gameHeight / 2 + 35 * scale);
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

    // Lifetime stat rotator
    if (lifetime) {
      const stats = lifetime.getDisplayStats();
      if (stats.length > 0) {
        const idx = this.menuStatIndex % stats.length;
        ctx.save();
        ctx.globalAlpha = 0.15 * this.menuStatFade;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(11 * scale)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stats[idx], gameWidth / 2, gameHeight / 2 + 85 * scale);
        ctx.restore();
      }
    }

    // Menu dust
    for (const d of this.menuDust) {
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(d.x * gameWidth, d.y * gameHeight, d.size * scale, 0, Math.PI * 2);
      ctx.fill();
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

    // Round indicator — hidden on rounds 1-2 to reduce noise for beginners
    const roundY = margin + size + 4 * scale;
    if (scoreManager.round >= 3) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(12 * scale)}px monospace`;
      ctx.fillText(`R${scoreManager.round}`, margin, roundY);
    }

    // Streak at threshold 3+
    if (scoreManager.streak >= CONFIG.STREAK_DISPLAY_THRESHOLD) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(13 * scale)}px monospace`;
      const streakX = scoreManager.round >= 3 ? margin + 30 * scale : margin;
      ctx.fillText(`\u00d7${scoreManager.streak} streak`, streakX, roundY);
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
      ctx.fillStyle = f.color || '#ffffff';
      ctx.beginPath();
      ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderParticles(ctx, scale) {
    if (this.particles.length === 0) return;
    ctx.save();
    ctx.fillStyle = CONFIG.RING_COLOR;
    for (const p of this.particles) {
      const lifeRatio = p.life / p.maxLife;
      ctx.globalAlpha = lifeRatio * 0.8;
      const radius = 2 * scale * lifeRatio;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderWallImpacts(ctx, scale) {
    for (const w of this.wallImpacts) {
      const progress = w.timer / 0.15;
      const alpha = 0.4 * (1 - progress);
      const radius = (3 + 5 * progress) * scale;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderDeathSplashes(ctx, scale) {
    for (const d of this.deathSplashes) {
      const progress = d.timer / 0.4;
      const alpha = 0.3 * (1 - progress);
      const width = (30 + 60 * progress) * scale;
      const height = (2 + 4 * progress) * scale;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = d.color || '#ffffff';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  renderHints(ctx, scale) {
    for (const h of this.hints) {
      const fadeIn = Math.min(h.timer / 0.3, 1);
      const fadeOut = h.timer > 1.5 ? 1 - (h.timer - 1.5) / 0.5 : 1;
      const alpha = 0.25 * fadeIn * fadeOut;
      if (alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(11 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(h.text, h.x, h.y);
      ctx.restore();
    }
  }

  renderTransitionDip(ctx, gameWidth, gameHeight) {
    if (this.transitionDip <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.transitionDip * 0.3;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    ctx.restore();
  }

  renderRoundSweep(ctx, gameWidth, gameHeight) {
    if (!this.roundSweep) return;
    const progress = this.roundSweep.timer / CONFIG.ROUND_SWEEP_DURATION;
    const y = progress * gameHeight;
    const alpha = CONFIG.ROUND_SWEEP_OPACITY * (1 - progress);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(gameWidth, y);
    ctx.stroke();
    ctx.restore();
  }

  renderCleanFlash(ctx, gameWidth, gameHeight) {
    if (!this.cleanFlash) return;
    const progress = this.cleanFlash.timer / 0.3;
    // Golden radial pulse from center — distinct from regular ring flash
    const alpha = 0.2 * (1 - progress);
    const cx = gameWidth / 2;
    const cy = gameHeight / 2;
    const radius = Math.max(gameWidth, gameHeight) * (0.2 + 0.8 * progress);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(255, 204, 102, ${alpha})`);
    grad.addColorStop(1, 'rgba(255, 204, 102, 0)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    ctx.restore();
  }

  renderRoundBadge(ctx, gameWidth, gameHeight, scale) {
    if (!this.roundBadge) return;
    const { round, timer } = this.roundBadge;
    const duration = CONFIG.ROUND_BADGE_DURATION;
    const progress = timer / duration;

    // Fade: quick in, hold, slow out
    let alpha;
    if (progress < 0.1) {
      alpha = progress / 0.1;
    } else if (progress > 0.7) {
      alpha = (1 - progress) / 0.3;
    } else {
      alpha = 1;
    }
    alpha *= 0.5;

    const size = Math.round(CONFIG.ROUND_BADGE_SIZE * scale);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`R${round}`, gameWidth / 2, gameHeight * 0.12);
    ctx.restore();
  }

  renderStreakFlash(ctx, gameWidth, gameHeight) {
    if (!this.streakFlash) return;
    const progress = this.streakFlash.timer / this.streakFlash.duration;
    const alpha = 0.3 * (1 - progress);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.streakFlash.tint;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    ctx.restore();
  }

  renderPauseOverlay(ctx, gameWidth, gameHeight, scale, scoreManager) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(28 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', gameWidth / 2, gameHeight / 2 - 15 * scale);

    // Show current score
    if (scoreManager && scoreManager.score > 0) {
      ctx.globalAlpha = 0.3;
      ctx.font = `${Math.round(16 * scale)}px monospace`;
      ctx.fillText(scoreManager.score.toLocaleString(), gameWidth / 2, gameHeight / 2 + 15 * scale);
    }

    ctx.globalAlpha = 0.25;
    ctx.font = `${Math.round(13 * scale)}px monospace`;
    ctx.fillText('return to resume', gameWidth / 2, gameHeight / 2 + 45 * scale);

    ctx.restore();
  }

  renderRipples(ctx, scale) {
    for (const r of this.ripples) {
      const progress = r.timer / CONFIG.SURFACE_RIPPLE_DURATION;
      const alpha = 0.15 * (1 - progress);
      const radius = CONFIG.SURFACE_RIPPLE_MAX_RADIUS * scale * progress;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderBounceParticles(ctx, scale) {
    if (this.bounceParticles.length === 0) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (const bp of this.bounceParticles) {
      const lifeRatio = bp.life / bp.maxLife;
      ctx.globalAlpha = lifeRatio * 0.4;
      const radius = 1.5 * scale * lifeRatio;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderStars(ctx, gameWidth, gameHeight, scale, gameTime) {
    ctx.save();
    for (const star of this.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(gameTime * star.twinkleSpeed + star.twinklePhase);
      ctx.globalAlpha = star.alpha * twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x * gameWidth, star.y * gameHeight, star.size * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderRunEnd(ctx, gameWidth, gameHeight, scale, scoreManager, timer, lifetime, runDuration) {
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
      ctx.fillText(scoreManager.score.toLocaleString(), gameWidth / 2, gameHeight * 0.35);

      // Rounds + duration
      ctx.globalAlpha = fadeProgress * 0.5;
      ctx.font = `${Math.round(16 * scale)}px monospace`;
      ctx.fillText(`${scoreManager.round} ${scoreManager.round === 1 ? 'round' : 'rounds'}`, gameWidth / 2, gameHeight * 0.35 + 40 * scale);

      if (runDuration > 0) {
        ctx.globalAlpha = fadeProgress * 0.3;
        ctx.font = `${Math.round(13 * scale)}px monospace`;
        ctx.fillText(`${Math.round(runDuration)}s`, gameWidth / 2, gameHeight * 0.35 + 62 * scale);
      }

      // Personal best line
      const extraY = 0;
      if (scoreManager.isNewPersonalBest) {
        ctx.globalAlpha = fadeProgress * 0.7;
        ctx.fillStyle = CONFIG.RING_COLOR;
        ctx.font = `bold ${Math.round(14 * scale)}px monospace`;
        ctx.fillText('NEW BEST!', gameWidth / 2, gameHeight * 0.35 + 90 * scale + extraY);
      } else if (scoreManager.personalBest > 0) {
        ctx.globalAlpha = fadeProgress * 0.25;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(13 * scale)}px monospace`;
        ctx.fillText(`best: ${scoreManager.personalBest.toLocaleString()}`, gameWidth / 2, gameHeight * 0.35 + 90 * scale + extraY);
      }

      // Forward hook — give player a reason to retry
      const bestRound = lifetime ? lifetime.stats.bestRound : 0;
      if (bestRound > 0 && scoreManager.round < bestRound) {
        const diff = bestRound - scoreManager.round;
        ctx.globalAlpha = fadeProgress * 0.2;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(11 * scale)}px monospace`;
        ctx.fillText(`${diff} round${diff > 1 ? 's' : ''} from your best`, gameWidth / 2, gameHeight * 0.35 + 110 * scale + extraY);
      }

      // Context-sensitive lifetime stat
      if (lifetime && lifetime.stats.totalRuns > 0) {
        let lifetimeLine = `${lifetime.stats.totalRings} rings threaded`;
        // Show most relevant stat
        if (scoreManager.longestStreak >= 3 && lifetime.stats.bestStreak > 0) {
          lifetimeLine = `best streak ever: ${lifetime.stats.bestStreak}`;
        } else if (scoreManager.round >= 3 && lifetime.stats.bestRound > 0) {
          lifetimeLine = `best round ever: ${lifetime.stats.bestRound}`;
        }
        ctx.globalAlpha = fadeProgress * 0.15;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(11 * scale)}px monospace`;
        ctx.fillText(lifetimeLine, gameWidth / 2, gameHeight * 0.35 + 130 * scale + extraY);
      }

      ctx.restore();
    }

    // Save + restart prompt with tappable button outlines
    if (timer >= p4End) {
      ctx.save();

      const isPB = scoreManager.isNewPersonalBest;

      // Restart button with capsule
      const restartY = isPB ? gameHeight * 0.88 : gameHeight * 0.85;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(14 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('tap to restart', gameWidth / 2, restartY);

      // Capsule outline around restart
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.12;
      const rw = 120 * scale;
      const rh = 28 * scale;
      const rr = rh / 2;
      ctx.beginPath();
      ctx.moveTo(gameWidth / 2 - rw / 2 + rr, restartY - rh / 2);
      ctx.lineTo(gameWidth / 2 + rw / 2 - rr, restartY - rh / 2);
      ctx.arc(gameWidth / 2 + rw / 2 - rr, restartY, rr, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(gameWidth / 2 - rw / 2 + rr, restartY + rh / 2);
      ctx.arc(gameWidth / 2 - rw / 2 + rr, restartY, rr, Math.PI / 2, Math.PI * 3 / 2);
      ctx.closePath();
      ctx.stroke();

      // Save button — centered + golden on PB, bottom-right otherwise
      const saveX = isPB ? gameWidth / 2 : gameWidth - 40 * scale;
      const saveY = isPB ? gameHeight * 0.78 : gameHeight * 0.92;
      const saveColor = isPB ? CONFIG.RING_COLOR : '#ffffff';
      const saveLabel = isPB ? 'Save Run' : 'Save';

      ctx.globalAlpha = isPB ? 0.5 : 0.3;
      ctx.textAlign = 'center';
      ctx.fillStyle = saveColor;
      ctx.font = `${isPB ? 'bold ' : ''}${Math.round((isPB ? 16 : 14) * scale)}px monospace`;
      ctx.fillText(saveLabel, saveX, saveY);

      ctx.strokeStyle = saveColor;
      ctx.globalAlpha = isPB ? 0.25 : 0.15;
      const sw = (isPB ? 100 : 60) * scale;
      const sh = (isPB ? 30 : 26) * scale;
      const sr = sh / 2;
      ctx.beginPath();
      ctx.moveTo(saveX - sw / 2 + sr, saveY - sh / 2);
      ctx.lineTo(saveX + sw / 2 - sr, saveY - sh / 2);
      ctx.arc(saveX + sw / 2 - sr, saveY, sr, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(saveX - sw / 2 + sr, saveY + sh / 2);
      ctx.arc(saveX - sw / 2 + sr, saveY, sr, Math.PI / 2, Math.PI * 3 / 2);
      ctx.closePath();
      ctx.stroke();

      ctx.restore();
    }
  }
}
