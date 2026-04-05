import { CONFIG, hexToRgba } from './config.js';

export class Ball {
  constructor(gameWidth, gameHeight, scale, round = 1, speedMult = 1.0) {
    this.scale = scale;
    this.round = round;
    this.speedMult = speedMult;

    // Determine ball type for this round
    this.ballType = 'standard';
    if (round >= CONFIG.BALL_TYPE_INTRO_ROUND) {
      const types = CONFIG.BALL_TYPES;
      this.ballType = types[Math.floor(Math.random() * types.length)];
    }

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

    // Initial velocity: small horizontal nudge so ball doesn't drop straight
    this.vx = (Math.random() * 2 - 1) * CONFIG.BALL_INITIAL_VX_RANGE * scale;
    this.vy = 0;

    // Spin — affects horizontal drift
    this.spin = 0;

    this.alive = true;
    this.opacity = 0; // Fade in
    this.fadeInTimer = 0;

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

    // Gravity scaled by speed curve (gentler on round 1) + ball type modifier
    const roundGravMult = this.round <= 1 ? CONFIG.GRAVITY_ROUND1_MULT : 1.0;
    const totalGravMult = roundGravMult * this.gravityMult * (this.envGravityMult || 1.0);
    this.vy += CONFIG.GRAVITY * this.scale * this.speedMult * totalGravMult * dt;

    // Wind force (set by environment system)
    if (this.windForce) {
      this.vx += this.windForce * this.scale * dt;
    }

    // Floaty drift — random horizontal nudges
    if (this.driftForce > 0) {
      this.vx += (Math.random() - 0.5) * this.driftForce * this.scale * dt;
    }

    // Spin affects horizontal velocity (friction-like)
    if (this.spin !== 0) {
      this.vx += this.spin * CONFIG.BALL_SPIN_FRICTION * this.scale * dt * 60;
      this.spin *= Math.pow(CONFIG.BALL_SPIN_DECAY, dt);
      if (Math.abs(this.spin) < 0.01) this.spin = 0;
    }

    // Speed cap
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const maxSpeed = CONFIG.MAX_SPEED * this.scale;
    if (speed > maxSpeed) {
      const factor = maxSpeed / speed;
      this.vx *= factor;
      this.vy *= factor;
    }

    // Position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Fade-in
    if (this.fadeInTimer < 0.2) {
      this.fadeInTimer += dt;
      this.opacity = Math.min(1, this.fadeInTimer / 0.2);
    }

    // Trail brighten decay
    if (this.trailBrighten > 0) {
      this.trailBrighten = Math.max(0, this.trailBrighten - dt);
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

    ctx.lineWidth = CONFIG.TRAIL_WIDTH * this.scale * (this.trailWidthMult || 1);
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
      heavy: '#ffbb88',
      bouncy: '#88ffbb',
      small: '#bbddff',
      floaty: '#ddbbff',
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

    ctx.restore();
  }
}
