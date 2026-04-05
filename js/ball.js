import { CONFIG, hexToRgba } from './config.js';

export class Ball {
  constructor(gameWidth, gameHeight, scale, round = 1, speedMult = 1.0) {
    this.scale = scale;
    this.radius = CONFIG.BALL_RADIUS * scale;
    this.glowRadius = CONFIG.BALL_GLOW_RADIUS * scale;
    this.speedMult = speedMult;

    // Spawn at top-center with random horizontal offset (widens after round 7)
    const offsetRange = round >= 8 ? CONFIG.BALL_OFFSET_WIDE : CONFIG.BALL_OFFSET_NARROW;
    const offset = (Math.random() * 2 - 1) * offsetRange * gameWidth;
    this.x = gameWidth / 2 + offset;
    this.y = this.radius * 2;

    this.prevX = this.x;
    this.prevY = this.y;

    // Initial velocity: small horizontal nudge so ball doesn't drop straight
    this.vx = (Math.random() * 2 - 1) * CONFIG.BALL_INITIAL_VX_RANGE * scale;
    this.vy = 0;

    this.alive = true;
    this.opacity = 1;

    // Trail
    this.trail = [];
    this.trailFrozen = false;
    this.trailCounter = 0;
    this.trailBrighten = 0;
    this.trailColor = CONFIG.BALL_COLOR;
    this.trailArtTimer = 0;
  }

  update(dt) {
    if (!this.alive) return;

    this.prevX = this.x;
    this.prevY = this.y;

    // Gravity scaled by speed curve
    this.vy += CONFIG.GRAVITY * this.scale * this.speedMult * dt;

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

    // Trail brighten decay
    if (this.trailBrighten > 0) {
      this.trailBrighten = Math.max(0, this.trailBrighten - dt);
    }
  }

  checkWalls(gameWidth) {
    // Silent, invisible, zero feedback
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx) * CONFIG.WALL_RESTITUTION;
    } else if (this.x + this.radius > gameWidth) {
      this.x = gameWidth - this.radius;
      this.vx = -Math.abs(this.vx) * CONFIG.WALL_RESTITUTION;
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
      this.trailColor = CONFIG.BALL_COLOR;
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

    ctx.lineWidth = CONFIG.TRAIL_WIDTH * this.scale;
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

    ctx.save();
    ctx.globalAlpha = this.opacity;

    // Outer glow
    const glowGrad = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.glowRadius
    );
    glowGrad.addColorStop(0, hexToRgba(CONFIG.BALL_COLOR, 0.4));
    glowGrad.addColorStop(0.4, hexToRgba(CONFIG.BALL_COLOR, 0.15));
    glowGrad.addColorStop(1, hexToRgba(CONFIG.BALL_COLOR, 0));

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Solid ball with feathered edge
    const ballGrad = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.radius
    );
    ballGrad.addColorStop(0, CONFIG.BALL_COLOR);
    ballGrad.addColorStop(0.85, CONFIG.BALL_COLOR);
    ballGrad.addColorStop(1, hexToRgba(CONFIG.BALL_COLOR, 0.4));

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    ctx.restore();
  }
}
