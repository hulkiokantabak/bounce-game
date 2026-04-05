import { CONFIG, hexToRgba } from './config.js';

export class Ball {
  constructor(gameWidth, gameHeight, scale, round = 1, speedMult = 1.0, lastBallType = null) {
    this.scale = scale;
    this.round = round;
    this.speedMult = speedMult;

    // Determine ball type — variety from Round 1
    let typePool;
    if (round <= 1) typePool = CONFIG.BALL_R1_TYPES;
    else if (round === 2) typePool = CONFIG.BALL_R2_TYPES;
    else typePool = CONFIG.BALL_R3_PLUS_TYPES;

    this.ballType = this._weightedPick(typePool, lastBallType);

    // Apply ball type modifiers
    let radiusMult = 1.0;
    this.gravityMult = 1.0;
    this.ballRestitution = CONFIG.BALL_RESTITUTION;
    this.driftForce = 0;

    if (this.ballType === 'heavy') {
      radiusMult = CONFIG.BALL_HEAVY_RADIUS_MULT;
      this.gravityMult = CONFIG.BALL_HEAVY_GRAVITY_MULT;
      this.ballRestitution = CONFIG.BALL_HEAVY_RESTITUTION;
    } else if (this.ballType === 'bouncy') {
      this.ballRestitution = CONFIG.BALL_BOUNCY_RESTITUTION;
      this.gravityMult = CONFIG.BALL_BOUNCY_GRAVITY_MULT;
    } else if (this.ballType === 'small') {
      radiusMult = CONFIG.BALL_SMALL_RADIUS_MULT;
      this.speedMult *= CONFIG.BALL_SMALL_SPEED_MULT;
    } else if (this.ballType === 'floaty') {
      this.gravityMult = CONFIG.BALL_FLOATY_GRAVITY_MULT;
      this.driftForce = CONFIG.BALL_FLOATY_DRIFT;
    }

    this.radius = CONFIG.BALL_RADIUS * scale * radiusMult;
    // Glow boost at milestone round
    const glowMult = round >= CONFIG.GLOW_BOOST_ROUND ? 1.2 : 1.0;
    this.glowRadius = CONFIG.BALL_GLOW_RADIUS * scale * glowMult;

    // Spawn at top-center with random horizontal offset (widens after round 7)
    const offsetRange = round >= 8 ? CONFIG.BALL_OFFSET_WIDE : CONFIG.BALL_OFFSET_NARROW;
    const offset = (Math.random() * 2 - 1) * offsetRange * gameWidth;
    this.x = gameWidth / 2 + offset;
    this.y = gameHeight * 0.08;

    this.prevX = this.x;
    this.prevY = this.y;

    // Initial velocity: always (0, 0). Gravity is the only force.
    // Offset position provides variety — no hidden initial vx.
    this.vx = 0;
    this.vy = 0;

    // Spin — affects horizontal drift
    this.spin = 0;

    this.alive = true;
    this.opacity = 0; // Fade in
    this.fadeInTimer = 0;
    this.envGravityMult = 1.0;
    this.bounceImmunity = 0; // brief immunity after bounce prevents re-collision
    this.stuckTimer = 0; // failsafe: detect ball stuck in same position
    this.stuckAnchorY = this.y;

    // Trail
    this.trail = [];
    this.trailFrozen = false;
    this.trailCounter = 0;
    this.trailBrighten = 0;
    this.trailArtTimer = 0;

    // Base trail color warms with round progression
    const colorIdx = Math.min(round - 1, CONFIG.TRAIL_BASE_COLORS.length - 1);
    this.baseTrailColor = CONFIG.TRAIL_BASE_COLORS[Math.max(0, colorIdx)];
    this.trailColor = this.baseTrailColor;

    // Trail width boost at milestone
    this.trailWidthMult = round >= CONFIG.TRAIL_WIDTH_BOOST_ROUND ? 1.25 : 1.0;
  }

  update(dt) {
    if (!this.alive) return;

    this.prevX = this.x;
    this.prevY = this.y;

    // Gravity: if ball type already reduces gravity, skip round 1 reduction (don't stack)
    const roundGravMult = this.round <= 1 ? CONFIG.GRAVITY_ROUND1_MULT : 1.0;
    const moodGravMult = this.moodGravityMult !== undefined ? this.moodGravityMult : 1.0;
    const envGrav = this.envGravityMult !== undefined ? this.envGravityMult : 1.0;
    const baseGrav = this.gravityMult < 1.0 ? this.gravityMult : roundGravMult * this.gravityMult;
    const rawGravMult = baseGrav * envGrav * moodGravMult;
    const totalGravMult = envGrav === 0 ? 0 : Math.max(CONFIG.BALL_MIN_GRAVITY_MULT, rawGravMult);
    this.vy += CONFIG.GRAVITY * this.scale * this.speedMult * totalGravMult * dt;

    // Wind force (set by environment system)
    if (this.windForce) {
      this.vx += this.windForce * this.scale * dt;
    }

    // Floaty drift — random horizontal nudges (+ mood slippery drift)
    const totalDrift = this.driftForce + (this.moodDrift || 0);
    if (totalDrift > 0) {
      this.vx += (Math.random() - 0.5) * totalDrift * this.scale * dt;
    }

    // Spin affects horizontal velocity (friction-like)
    if (this.spin !== 0) {
      this.vx += this.spin * CONFIG.BALL_SPIN_FRICTION * this.scale * dt * 60;
      this.spin *= Math.pow(CONFIG.BALL_SPIN_DECAY, dt);
      if (Math.abs(this.spin) < 0.01) this.spin = 0;
    }

    // Air drag — subtle resistance at high speeds (mood zen increases drag)
    const dragMult = this.moodDragMult || 1.0;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > 0) {
      const dragForce = CONFIG.AIR_DRAG * dragMult * speed * speed;
      const dragFactor = Math.max(0, 1 - (dragForce / speed) * dt);
      this.vx *= dragFactor;
      this.vy *= dragFactor;
    }

    // Speed cap
    const maxSpeed = CONFIG.MAX_SPEED * this.scale;
    if (speed > maxSpeed) {
      const factor = maxSpeed / speed;
      this.vx *= factor;
      this.vy *= factor;
    }

    // Position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Bounce immunity decay
    if (this.bounceImmunity > 0) {
      this.bounceImmunity = Math.max(0, this.bounceImmunity - dt);
    }

    // Failsafe: detect ball stuck in roughly the same Y position
    // Gravity increases vy every frame so velocity checks don't work —
    // instead track whether the ball's Y has barely moved over 0.3s
    if (Math.abs(this.y - this.stuckAnchorY) < 5 * this.scale) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.3) {
        this.vy = -CONFIG.MIN_SPEED * this.scale * 1.5;
        this.stuckTimer = 0;
        this.stuckAnchorY = this.y;
      }
    } else {
      this.stuckTimer = 0;
      this.stuckAnchorY = this.y;
    }

    // Fade-in
    if (this.fadeInTimer < 0.2) {
      this.fadeInTimer += dt;
      this.opacity = Math.min(1, this.fadeInTimer / 0.2);
    }

    // Trail brighten decay
    if (this.trailBrighten > 0) {
      this.trailBrighten = Math.max(0, this.trailBrighten - dt);
    }

    // Mood timer decay
    if (this.moodTimer > 0) {
      this.moodTimer -= dt;
      this.moodFlashTimer = Math.max(0, (this.moodFlashTimer || 0) - dt);
      if (this.moodTimer <= 0) {
        this.clearMood();
      }
    }
  }

  checkWalls(gameWidth) {
    this.wallHit = null;
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx) * CONFIG.WALL_RESTITUTION;
      this.wallHit = { x: 0, y: this.y };
    } else if (this.x + this.radius > gameWidth) {
      this.x = gameWidth - this.radius;
      this.vx = -Math.abs(this.vx) * CONFIG.WALL_RESTITUTION;
      this.wallHit = { x: gameWidth, y: this.y };
    }
    // Ceiling bounce — prevents ball from leaving top of screen
    if (this.y - this.radius < 0 && this.vy < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy) * CONFIG.CEILING_RESTITUTION;
      this.wallHit = { x: this.x, y: 0 };
    }
  }

  checkFloor(gameHeight) {
    return this.y > gameHeight + this.radius;
  }

  brightenTrail() {
    this.trailBrighten = 0.2;
  }

  setTrailColorForStreak(streak) {
    if (streak >= 5) {
      this.trailColor = CONFIG.RING_COLOR; // full gold
    } else if (streak >= 3) {
      this.trailColor = '#ffe0a0'; // warm gold
    } else if (streak >= 1) {
      this.trailColor = '#fff0d0'; // warm white
    } else {
      this.trailColor = this.baseTrailColor || CONFIG.BALL_COLOR;
    }
  }

  updateTrailArt(dt) {
    this.trailArtTimer += dt;
    const progress = Math.min(this.trailArtTimer / CONFIG.TRAIL_ART_BRIGHTEN_DURATION, 1);
    for (const p of this.trail) {
      const baseOpacity = p.opacity || 0;
      p.displayOpacity = baseOpacity + (CONFIG.TRAIL_START_OPACITY - baseOpacity) * progress * 0.6;
    }
  }

  addTrailPoint(time) {
    if (this.trailFrozen || !this.alive) return;
    this.trailCounter++;
    if (this.trailCounter % CONFIG.REPLAY_SAMPLE_RATE !== 0) return;
    this.trail.push({ x: this.x, y: this.y, t: time });
    // Cap trail array to prevent memory exhaustion on very long runs
    if (this.trail.length > 3000) {
      this.trail = this.trail.slice(-2000);
    }
  }

  updateTrail(currentTime) {
    if (this.trailFrozen) return;
    this.trail = this.trail.filter(p => (currentTime - p.t) < CONFIG.TRAIL_FADE_TIME);
  }

  freezeTrail(currentTime) {
    this.trailFrozen = true;
    for (const p of this.trail) {
      const age = currentTime - p.t;
      p.opacity = CONFIG.TRAIL_START_OPACITY * Math.max(0, 1 - age / CONFIG.TRAIL_FADE_TIME);
    }
  }

  getTrailPointOpacity(point, currentTime) {
    if (this.trailFrozen) return point.opacity || 0;
    const age = currentTime - point.t;
    let opacity = CONFIG.TRAIL_START_OPACITY * Math.max(0, 1 - age / CONFIG.TRAIL_FADE_TIME);
    if (this.trailBrighten > 0) {
      opacity = Math.min(CONFIG.TRAIL_START_OPACITY, opacity * 1.5);
    }
    return opacity;
  }

  renderTrail(ctx, currentTime) {
    if (this.trail.length < 2) return;

    // Momentum-based trail width: faster = wider (1x to 1.5x)
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const speedFactor = 1 + Math.min(speed / (CONFIG.MAX_SPEED * this.scale), 1) * 0.5;
    ctx.lineWidth = CONFIG.TRAIL_WIDTH * this.scale * (this.trailWidthMult || 1) * speedFactor;
    ctx.lineCap = 'round';

    const color = this.trailColor || CONFIG.BALL_COLOR;

    for (let i = 1; i < this.trail.length; i++) {
      const p0 = this.trail[i - 1];
      const p1 = this.trail[i];

      let opacity;
      if (this.trailFrozen && p1.displayOpacity !== undefined) {
        opacity = p1.displayOpacity;
      } else {
        opacity = this.getTrailPointOpacity(p1, currentTime);
      }
      if (opacity <= 0.001) continue;

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = hexToRgba(color, opacity);
      ctx.stroke();
    }
  }

  render(ctx) {
    if (this.opacity <= 0) return;

    // Ball type colors
    const typeColors = {
      standard: CONFIG.BALL_COLOR,
      heavy: '#ffe8d0',
      bouncy: '#d8f5e0',
      small: '#dde8f5',
      floaty: '#e8ddf5',
    };
    const ballColor = typeColors[this.ballType] || CONFIG.BALL_COLOR;

    ctx.save();
    ctx.globalAlpha = this.opacity;

    // Outer glow
    const glowGrad = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.glowRadius
    );
    glowGrad.addColorStop(0, hexToRgba(ballColor, 0.4));
    glowGrad.addColorStop(0.4, hexToRgba(ballColor, 0.15));
    glowGrad.addColorStop(1, hexToRgba(ballColor, 0));

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Solid ball with feathered edge
    const ballGrad = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.radius
    );
    ballGrad.addColorStop(0, ballColor);
    ballGrad.addColorStop(0.85, ballColor);
    ballGrad.addColorStop(1, hexToRgba(ballColor, 0.4));

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Ball type ring indicator — subtle colored ring for non-standard types
    if (this.ballType !== 'standard') {
      const ringColors = { heavy: '#ffcc88', bouncy: '#88eebb', small: '#99bbee', floaty: '#bb99ee' };
      ctx.strokeStyle = ringColors[this.ballType] || '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = this.opacity * 0.4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = this.opacity;
    }

    // Spin indicator — rotating line inside ball
    if (this.spin && Math.abs(this.spin) > 0.1) {
      const spinAngle = (this.spin > 0 ? 1 : -1) * (Date.now() / 100);
      ctx.strokeStyle = hexToRgba('#ffffff', 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(
        this.x + Math.cos(spinAngle) * this.radius * 0.5,
        this.y + Math.sin(spinAngle) * this.radius * 0.5
      );
      ctx.lineTo(
        this.x - Math.cos(spinAngle) * this.radius * 0.5,
        this.y - Math.sin(spinAngle) * this.radius * 0.5
      );
      ctx.stroke();
    }

    // Mood glow ring
    if (this.mood && this.moodFlashTimer > 0) {
      const moodColor = CONFIG.MOOD_COLORS[this.mood] || '#ffffff';
      ctx.strokeStyle = moodColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = this.opacity * this.moodFlashTimer / CONFIG.MOOD_FLASH_DURATION * 0.6;
      const flashRadius = this.radius + 8 * this.scale * (1 - this.moodFlashTimer / CONFIG.MOOD_FLASH_DURATION);
      ctx.beginPath();
      ctx.arc(this.x, this.y, flashRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // --- Weighted ball type picker ---
  _weightedPick(types, lastType) {
    const weights = types.map(t => t === lastType ? CONFIG.BALL_REPEAT_WEIGHT : 1.0);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) return types[i];
    }
    return types[types.length - 1];
  }

  // --- Mood system ---
  applyMood(moodType) {
    this.mood = moodType;
    this.moodTimer = CONFIG.MOOD_DURATION;
    this.moodFlashTimer = CONFIG.MOOD_FLASH_DURATION;

    // Reset mood modifiers
    this.moodGravityMult = 1.0;
    this.moodRestitutionBonus = 0;
    this.moodDrift = 0;
    this.moodDragMult = 1.0;

    switch (moodType) {
      case 'excited':
        this.moodGravityMult = CONFIG.MOOD_EXCITED_GRAVITY_MULT;
        this.moodRestitutionBonus = CONFIG.MOOD_EXCITED_RESTITUTION_BONUS;
        break;
      case 'heavy':
        this.moodGravityMult = CONFIG.MOOD_HEAVY_GRAVITY_MULT;
        this.moodRestitutionBonus = -CONFIG.MOOD_HEAVY_RESTITUTION_PENALTY;
        break;
      case 'slippery':
        this.moodDrift = CONFIG.MOOD_SLIPPERY_DRIFT;
        break;
      case 'zen':
        this.moodGravityMult = CONFIG.MOOD_ZEN_GRAVITY_MULT;
        this.moodDragMult = CONFIG.MOOD_ZEN_AIR_DRAG_MULT;
        break;
    }
  }

  clearMood() {
    this.mood = null;
    this.moodTimer = 0;
    this.moodGravityMult = 1.0;
    this.moodRestitutionBonus = 0;
    this.moodDrift = 0;
    this.moodDragMult = 1.0;
  }

  getEffectiveRestitution() {
    return this.ballRestitution + (this.moodRestitutionBonus || 0);
  }
}
