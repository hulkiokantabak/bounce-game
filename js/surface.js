import { CONFIG } from './config.js';

class Surface {
  constructor(x, y, scale, decayTime, lengthMult, surfaceType) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.halfLength = (CONFIG.SURFACE_LENGTH * scale * (lengthMult || 1)) / 2;
    this.halfThickness = (CONFIG.SURFACE_THICKNESS * scale) / 2;
    this.decayTime = decayTime || CONFIG.SURFACE_DECAY_TIME;
    this.surfaceType = surfaceType || 'normal';

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

    // Spawn animation
    this.spawnTimer = 0;
    this.spawnDuration = CONFIG.SURFACE_SPAWN_DURATION;
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

    // Spawn animation
    if (this.spawnTimer < this.spawnDuration) {
      this.spawnTimer += dt;
    }

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

    // Spawn scale: 80% -> 100% over spawn duration
    const spawnScale = this.spawnTimer >= this.spawnDuration ? 1.0
      : 0.8 + 0.2 * (this.spawnTimer / this.spawnDuration);

    const hl = this.halfLength * spawnScale;
    const ht = this.halfThickness * spawnScale;
    const left = this.x - hl;
    const top = this.y - ht;
    const width = hl * 2;
    const height = ht * 2;
    const radius = Math.min(ht, hl);

    ctx.save();
    ctx.globalAlpha = this.opacity;

    // Color by surface type — muted tints, still mostly white
    const typeColors = {
      normal: CONFIG.SURFACE_COLOR,
      spring: '#ddffe8',
      ice: '#ddeeff',
      sticky: '#ffe8d8',
      angled_left: '#eeddf8',
      angled_right: '#eeddf8',
    };
    ctx.fillStyle = typeColors[this.surfaceType] || CONFIG.SURFACE_COLOR;

    // Rounded rectangle (capsule)
    ctx.beginPath();
    ctx.moveTo(left + radius, top);
    ctx.lineTo(left + width - radius, top);
    ctx.arc(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(left + radius, top + height);
    ctx.arc(left + radius, top + radius, radius, Math.PI / 2, Math.PI * 3 / 2);
    ctx.closePath();
    ctx.fill();

    // Type indicator marks
    if (this.surfaceType === 'spring') {
      // Zigzag line on spring
      ctx.strokeStyle = '#66dd99';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = this.opacity * 0.7;
      ctx.beginPath();
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const px = left + (width / steps) * i;
        const py = this.y + (i % 2 === 0 ? -2 : 2) * this.scale;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (this.surfaceType === 'ice') {
      // Shimmer dots
      ctx.fillStyle = '#aaddff';
      ctx.globalAlpha = this.opacity * 0.5;
      for (let i = 0; i < 3; i++) {
        const dx = left + width * (0.2 + 0.3 * i);
        ctx.beginPath();
        ctx.arc(dx, this.y, 1 * this.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.surfaceType === 'angled_left' || this.surfaceType === 'angled_right') {
      // Arrow indicator
      const dir = this.surfaceType === 'angled_left' ? -1 : 1;
      ctx.strokeStyle = '#cc99ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = this.opacity * 0.6;
      const cx = this.x;
      const arrowLen = 6 * this.scale;
      ctx.beginPath();
      ctx.moveTo(cx - dir * arrowLen, this.y);
      ctx.lineTo(cx + dir * arrowLen, this.y);
      ctx.lineTo(cx + dir * arrowLen - dir * 3 * this.scale, this.y - 3 * this.scale);
      ctx.stroke();
    }

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

    // Determine surface type based on round
    let surfaceType = 'normal';
    if (round >= CONFIG.SURFACE_TYPE_INTRO_ROUND) {
      const rampT = Math.min((round - CONFIG.SURFACE_TYPE_INTRO_ROUND) /
        (CONFIG.SURFACE_TYPE_CHANCE_RAMP_ROUND - CONFIG.SURFACE_TYPE_INTRO_ROUND), 1);
      const chance = CONFIG.SURFACE_TYPE_CHANCE_BASE + rampT * (CONFIG.SURFACE_TYPE_CHANCE_MAX - CONFIG.SURFACE_TYPE_CHANCE_BASE);
      if (Math.random() < chance) {
        // Pick a random special type (skip 'normal' at index 0)
        const types = CONFIG.SURFACE_TYPES;
        surfaceType = types[1 + Math.floor(Math.random() * (types.length - 1))];
      }
    }

    this.surfaces.push(new Surface(x, y, scale, decayTime, lengthMult, surfaceType));
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

          // --- DEFLECTION: offset from center creates horizontal force ---
          const offset = (ball.x - surface.x) / surface.halfLength; // -1 to 1
          let deflectVx = offset * CONFIG.SURFACE_DEFLECT_STRENGTH * Math.abs(ball.vy);
          deflectVx = Math.max(-CONFIG.SURFACE_DEFLECT_MAX_VX * ball.scale,
                     Math.min(CONFIG.SURFACE_DEFLECT_MAX_VX * ball.scale, deflectVx));

          // --- Surface type modifiers ---
          const type = surface.surfaceType;
          let restitution = ball.ballRestitution || CONFIG.BALL_RESTITUTION;

          if (type === 'spring') {
            restitution = CONFIG.SURFACE_SPRING_RESTITUTION;
          } else if (type === 'ice') {
            deflectVx *= CONFIG.SURFACE_ICE_DEFLECT_MULT;
            // Ice also adds randomness
            deflectVx += (Math.random() - 0.5) * 100 * ball.scale;
          } else if (type === 'sticky') {
            restitution = CONFIG.SURFACE_STICKY_RESTITUTION;
            ball.vx *= CONFIG.SURFACE_STICKY_VX_DAMP;
            deflectVx *= 0.3;
          } else if (type === 'angled_left') {
            deflectVx -= CONFIG.SURFACE_ANGLED_VX_BOOST * ball.scale;
          } else if (type === 'angled_right') {
            deflectVx += CONFIG.SURFACE_ANGLED_VX_BOOST * ball.scale;
          }

          // Apply deflection to vx
          ball.vx += deflectVx;

          // Reflect vy with restitution
          ball.vy = -Math.abs(ball.vy) * restitution;

          // Apply spin from offset — stronger spin for more dynamic movement
          if (ball.spin !== undefined) {
            ball.spin += offset * 5;
          }

          // Boost to MIN_SPEED if below
          const minSpeed = CONFIG.MIN_SPEED * ball.scale;
          if (Math.abs(ball.vy) < minSpeed) {
            ball.vy = -minSpeed;
          }

          surface.onHit(impactX);
          this.lastHitType = type;
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
