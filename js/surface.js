import { CONFIG } from './config.js';

class Surface {
  constructor(x, y, scale, decayTime, lengthMult) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.halfLength = (CONFIG.SURFACE_LENGTH * scale * (lengthMult || 1)) / 2;
    this.halfThickness = (CONFIG.SURFACE_THICKNESS * scale) / 2;
    this.decayTime = decayTime || CONFIG.SURFACE_DECAY_TIME;

    this.hit = false;
    this.decaying = false;
    this.decayTimer = 0;
    this.opacity = CONFIG.SURFACE_OPACITY;
    this.removed = false;

    // Crack data (set on hit)
    this.impactX = 0;
    this.cracks = [];

    // Run-end fade
    this.fading = false;
    this.fadeTimer = 0;
  }

  onHit(impactX) {
    if (this.hit) return;
    this.hit = true;
    this.decaying = true;
    this.impactX = impactX;

    // Generate cracks radiating from impact point like ice
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * 2 - 1) * Math.PI * 0.7;
      const length = (8 + Math.random() * 20) * this.scale;
      this.cracks.push({ angle, length });
    }
  }

  update(dt) {
    if (this.removed) return;

    if (this.decaying) {
      this.decayTimer += dt;
      this.opacity = CONFIG.SURFACE_OPACITY * Math.max(0, 1 - this.decayTimer / this.decayTime);
      if (this.decayTimer >= this.decayTime) {
        this.removed = true;
      }
    } else if (this.fading) {
      this.fadeTimer += dt;
      this.opacity = CONFIG.SURFACE_OPACITY * Math.max(0, 1 - this.fadeTimer / CONFIG.RUN_END_PAUSE);
      if (this.fadeTimer >= CONFIG.RUN_END_PAUSE) {
        this.removed = true;
      }
    }
  }

  startFade() {
    if (this.decaying || this.removed) return;
    this.fading = true;
  }

  render(ctx) {
    if (this.removed || this.opacity <= 0) return;

    const left = this.x - this.halfLength;
    const top = this.y - this.halfThickness;
    const width = this.halfLength * 2;
    const height = this.halfThickness * 2;
    const radius = Math.min(this.halfThickness, this.halfLength);

    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = CONFIG.SURFACE_COLOR;

    // Rounded rectangle (capsule)
    ctx.beginPath();
    ctx.moveTo(left + radius, top);
    ctx.lineTo(left + width - radius, top);
    ctx.arc(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(left + radius, top + height);
    ctx.arc(left + radius, top + radius, radius, Math.PI / 2, Math.PI * 3 / 2);
    ctx.closePath();
    ctx.fill();

    // Cracks from impact point
    if (this.hit && this.cracks.length > 0) {
      const growth = Math.min(this.decayTimer / (this.decayTime * 0.4), 1);
      ctx.strokeStyle = CONFIG.SURFACE_COLOR;
      ctx.lineWidth = 1;

      for (const crack of this.cracks) {
        const len = crack.length * growth;
        ctx.beginPath();
        ctx.moveTo(this.impactX, this.y);
        ctx.lineTo(
          this.impactX + Math.cos(crack.angle) * len,
          this.y + Math.sin(crack.angle) * len
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

export class SurfaceManager {
  constructor() {
    this.surfaces = [];
  }

  place(x, y, scale, round, gameWidth) {
    const decayTime = round <= 1 ? CONFIG.SURFACE_DECAY_TIME_ROUND1 : CONFIG.SURFACE_DECAY_TIME;
    const lengthMult = (gameWidth && gameWidth < 400) ? CONFIG.SURFACE_LENGTH_SMALL_SCREEN_MULT : 1;
    this.surfaces.push(new Surface(x, y, scale, decayTime, lengthMult));
  }

  update(dt) {
    for (const s of this.surfaces) {
      s.update(dt);
    }
    this.surfaces = this.surfaces.filter(s => !s.removed);
  }

  checkCollision(ball) {
    const ballRadius = ball.radius;

    for (const surface of this.surfaces) {
      if (surface.hit || surface.removed || surface.fading) continue;

      // One-sided: bounce from above only (ball moving down)
      if (ball.vy <= 0) continue;

      const ballBottom = ball.y + ballRadius;
      const prevBallBottom = ball.prevY + ballRadius;
      const surfaceTop = surface.y - surface.halfThickness;

      // Ball crossed surface top from above this frame
      if (prevBallBottom <= surfaceTop && ballBottom >= surfaceTop) {
        // Horizontal overlap (ball circle vs surface rect)
        if (ball.x + ballRadius >= surface.x - surface.halfLength &&
            ball.x - ballRadius <= surface.x + surface.halfLength) {

          // Impact point clamped to surface range
          const impactX = Math.max(
            surface.x - surface.halfLength,
            Math.min(ball.x, surface.x + surface.halfLength)
          );

          // Position correction — push ball above surface
          ball.y = surfaceTop - ballRadius;

          // Reflect vy with restitution
          ball.vy = -Math.abs(ball.vy) * CONFIG.BALL_RESTITUTION;

          // Boost to MIN_SPEED if below
          const minSpeed = CONFIG.MIN_SPEED * ball.scale;
          if (Math.abs(ball.vy) < minSpeed) {
            ball.vy = -minSpeed;
          }

          surface.onHit(impactX);
          return true;
        }
      }
    }

    return false;
  }

  fadeAll() {
    for (const s of this.surfaces) {
      s.startFade();
    }
  }

  render(ctx) {
    for (const s of this.surfaces) {
      s.render(ctx);
    }
  }

  clear() {
    this.surfaces = [];
  }
}
