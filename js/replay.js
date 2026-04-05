import { CONFIG, hexToRgba } from './config.js';

// --- Replay Recorder: captures ball, surface, ring data during live play ---

export class ReplayRecorder {
  constructor() {
    this.reset();
  }

  reset() {
    this.ball = [];
    this.surfaces = [];
    this.rings = [];
    this.gameWidth = 0;
    this.gameHeight = 0;
  }

  start(gameWidth, gameHeight) {
    this.reset();
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
  }

  recordBall(x, y, t) {
    this.ball.push({
      x: x / this.gameWidth,
      y: y / this.gameHeight,
      t,
    });
  }

  recordSurface(x, y, t) {
    this.surfaces.push({
      x: x / this.gameWidth,
      y: y / this.gameHeight,
      t,
    });
  }

  recordRingSpawn(ring, spawnT, ringIndex) {
    this.rings.push({
      x: ring.cx / this.gameWidth,
      y: ring.cy / this.gameHeight,
      gapAngle: ring.gapCenter * (180 / Math.PI),
      spawnT,
      hitT: null,
      success: null,
      ringIndex,
    });
  }

  recordRingHit(ringIndex, hitT, success) {
    // Find the most recent ring entry matching this ringIndex
    for (let i = this.rings.length - 1; i >= 0; i--) {
      if (this.rings[i].ringIndex === ringIndex && this.rings[i].hitT === null) {
        this.rings[i].hitT = hitT;
        this.rings[i].success = success;
        break;
      }
    }
  }

  getData() {
    return {
      ball: this.ball,
      surfaces: this.surfaces,
      rings: this.rings,
    };
  }
}

// --- Replay Player: plays back recorded data with interpolation ---

export class ReplayPlayer {
  constructor() {
    this.data = null;
    this.duration = 0;
    this.time = 0;
    this.playing = false;
    this.speed = CONFIG.REPLAY_SPEED_NORMAL;
    this.finished = false;

    // Derived state for rendering
    this.ballX = 0;
    this.ballY = 0;
    this.trail = [];
    this.activeSurfaces = [];

    // End sequence
    this.endTimer = 0;
    this.trailFrozen = false;
  }

  load(trailData, duration, gameWidth, gameHeight) {
    this.data = trailData;
    this.duration = duration;
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
    this.time = 0;
    this.playing = true;
    this.speed = CONFIG.REPLAY_SPEED_NORMAL;
    this.finished = false;
    this.endTimer = 0;
    this.trailFrozen = false;
    this.trail = [];
    this.activeSurfaces = [];

    // Pre-process ring data for playback
    this.ringStates = (trailData.rings || []).map(r => ({
      ...r,
      cx: r.x * gameWidth,
      cy: r.y * gameHeight,
      gapCenter: r.gapAngle * (Math.PI / 180),
      spawned: false,
      hit: false,
      shatterTimer: 0,
      shattering: false,
      shatterDone: false,
      shatterFragments: [],
      flashTimer: 0,
      flashing: false,
    }));
  }

  togglePlay() {
    this.playing = !this.playing;
  }

  cycleSpeed() {
    this.speed = this.speed === CONFIG.REPLAY_SPEED_NORMAL
      ? CONFIG.REPLAY_SPEED_FAST
      : CONFIG.REPLAY_SPEED_NORMAL;
  }

  update(dt) {
    if (!this.data || this.finished) return;
    if (!this.playing) return;

    this.time += dt * this.speed;

    // Update active surfaces
    this.updateSurfaces();

    // Update ring states
    this.updateRings(dt);

    // Interpolate ball position
    this.interpolateBall();

    // Build progressive trail
    if (!this.trailFrozen) {
      this.buildTrail();
    }

    // End sequence
    if (this.endTimer > 0) {
      this.endTimer += dt;
      const totalEnd = CONFIG.RUN_END_PAUSE + CONFIG.RUN_END_TRAIL_HOLD +
        CONFIG.RUN_END_SCORE_FADE + CONFIG.RUN_END_PROMPT_DELAY;
      if (this.endTimer >= totalEnd) {
        this.finished = true;
      }
    } else if (this.time >= this.duration) {
      this.endTimer = dt;
      this.freezeTrail();
    }
  }

  interpolateBall() {
    const points = this.data.ball;
    if (!points || points.length === 0) return;

    // Find surrounding samples
    let i = 0;
    while (i < points.length - 1 && points[i + 1].t <= this.time) i++;

    if (i >= points.length - 1) {
      const last = points[points.length - 1];
      this.ballX = last.x * this.gameWidth;
      this.ballY = last.y * this.gameHeight;
      return;
    }

    const p0 = points[i];
    const p1 = points[i + 1];
    const frac = (this.time - p0.t) / (p1.t - p0.t || 1);
    const t = Math.max(0, Math.min(1, frac));

    this.ballX = (p0.x + (p1.x - p0.x) * t) * this.gameWidth;
    this.ballY = (p0.y + (p1.y - p0.y) * t) * this.gameHeight;
  }

  buildTrail() {
    const points = this.data.ball;
    if (!points) return;

    this.trail = [];
    for (const p of points) {
      if (p.t > this.time) break;
      this.trail.push({
        x: p.x * this.gameWidth,
        y: p.y * this.gameHeight,
        t: p.t,
      });
    }
  }

  freezeTrail() {
    this.trailFrozen = true;
    // Freeze opacity for each trail point
    for (const p of this.trail) {
      const age = this.time - p.t;
      p.opacity = CONFIG.TRAIL_START_OPACITY * Math.max(0, 1 - age / CONFIG.TRAIL_FADE_TIME);
    }
  }

  updateSurfaces() {
    const surfaces = this.data.surfaces || [];
    this.activeSurfaces = [];

    for (const s of surfaces) {
      if (s.t > this.time) continue;
      const age = this.time - s.t;
      // Surface visible for SURFACE_DECAY_TIME after placement
      if (age < CONFIG.SURFACE_DECAY_TIME + 0.5) {
        this.activeSurfaces.push({
          x: s.x * this.gameWidth,
          y: s.y * this.gameHeight,
          age,
        });
      }
    }
  }

  updateRings(dt) {
    for (const r of this.ringStates) {
      // Spawn ring when time reaches spawnT
      if (!r.spawned && this.time >= r.spawnT) {
        r.spawned = true;
      }

      // Hit/shatter at hitT
      if (r.spawned && !r.hit && r.hitT !== null && this.time >= r.hitT) {
        r.hit = true;
        if (r.success) {
          r.flashing = true;
          r.flashTimer = 0;
        } else {
          r.shattering = true;
          r.shatterTimer = 0;
          // Generate shatter fragments
          const count = CONFIG.RING_SHATTER_FRAGMENTS_MIN +
            Math.floor(Math.random() * (CONFIG.RING_SHATTER_FRAGMENTS_MAX - CONFIG.RING_SHATTER_FRAGMENTS_MIN + 1));
          for (let i = 0; i < count; i++) {
            r.shatterFragments.push({
              angle: Math.random() * Math.PI * 2,
              dirAngle: Math.random() * Math.PI * 2,
              arcLen: (Math.PI * 2 / count) * 0.6,
            });
          }
        }
      }

      // Update shatter animation
      if (r.shattering && !r.shatterDone) {
        r.shatterTimer += dt * this.speed * 1000;
        if (r.shatterTimer >= CONFIG.RING_SHATTER_DURATION) {
          r.shatterDone = true;
        }
      }

      // Update flash
      if (r.flashing) {
        r.flashTimer += dt * this.speed;
        if (r.flashTimer > 0.2) r.flashing = false;
      }
    }
  }

  // --- Rendering ---

  render(ctx, gameWidth, gameHeight, scale) {
    if (!this.data) return;

    const inEndSequence = this.endTimer > 0;
    const inTrailHold = inEndSequence && this.endTimer >= CONFIG.RUN_END_PAUSE;

    // Death line
    if (!inTrailHold) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, gameHeight - 0.5);
      ctx.lineTo(gameWidth, gameHeight - 0.5);
      ctx.stroke();
    }

    // Trail
    this.renderTrail(ctx, scale);

    // Rings
    if (!inTrailHold) {
      this.renderRings(ctx, scale, gameWidth, gameHeight);
    }

    // Surfaces
    if (!inTrailHold) {
      this.renderSurfaces(ctx, scale);
    }

    // Ball
    if (!inTrailHold) {
      let ballOpacity = 1;
      if (inEndSequence) {
        ballOpacity = Math.max(0, 1 - this.endTimer / CONFIG.RUN_END_PAUSE);
      }
      if (ballOpacity > 0) {
        this.renderBall(ctx, scale, ballOpacity);
      }
    }

    // Ring flash overlay
    this.renderFlash(ctx, gameWidth, gameHeight);

    // Controls overlay
    this.renderControls(ctx, gameWidth, gameHeight, scale);
  }

  renderTrail(ctx, scale) {
    if (this.trail.length < 2) return;

    ctx.lineWidth = CONFIG.TRAIL_WIDTH * scale;
    ctx.lineCap = 'round';

    for (let i = 1; i < this.trail.length; i++) {
      const p0 = this.trail[i - 1];
      const p1 = this.trail[i];

      let opacity;
      if (this.trailFrozen) {
        opacity = p1.opacity || 0;
      } else {
        const age = this.time - p1.t;
        opacity = CONFIG.TRAIL_START_OPACITY * Math.max(0, 1 - age / CONFIG.TRAIL_FADE_TIME);
      }
      if (opacity <= 0.001) continue;

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = hexToRgba(CONFIG.BALL_COLOR, opacity);
      ctx.stroke();
    }
  }

  renderBall(ctx, scale, opacity) {
    const radius = CONFIG.BALL_RADIUS * scale;
    const glowRadius = CONFIG.BALL_GLOW_RADIUS * scale;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Glow
    const glowGrad = ctx.createRadialGradient(
      this.ballX, this.ballY, 0,
      this.ballX, this.ballY, glowRadius
    );
    glowGrad.addColorStop(0, hexToRgba(CONFIG.BALL_COLOR, 0.4));
    glowGrad.addColorStop(0.4, hexToRgba(CONFIG.BALL_COLOR, 0.15));
    glowGrad.addColorStop(1, hexToRgba(CONFIG.BALL_COLOR, 0));

    ctx.beginPath();
    ctx.arc(this.ballX, this.ballY, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Solid ball
    const ballGrad = ctx.createRadialGradient(
      this.ballX, this.ballY, 0,
      this.ballX, this.ballY, radius
    );
    ballGrad.addColorStop(0, CONFIG.BALL_COLOR);
    ballGrad.addColorStop(0.85, CONFIG.BALL_COLOR);
    ballGrad.addColorStop(1, hexToRgba(CONFIG.BALL_COLOR, 0.4));

    ctx.beginPath();
    ctx.arc(this.ballX, this.ballY, radius, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    ctx.restore();
  }

  renderSurfaces(ctx, scale) {
    const halfLength = (CONFIG.SURFACE_LENGTH * scale) / 2;
    const halfThickness = (CONFIG.SURFACE_THICKNESS * scale) / 2;

    for (const s of this.activeSurfaces) {
      let opacity;
      if (s.age < 0.05) {
        opacity = CONFIG.SURFACE_OPACITY;
      } else {
        // Decay after appearing
        const decayAge = Math.max(0, s.age - 0.05);
        opacity = CONFIG.SURFACE_OPACITY * Math.max(0, 1 - decayAge / CONFIG.SURFACE_DECAY_TIME);
      }
      if (opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = CONFIG.SURFACE_COLOR;

      const left = s.x - halfLength;
      const top = s.y - halfThickness;
      const width = halfLength * 2;
      const height = halfThickness * 2;
      const radius = Math.min(halfThickness, halfLength);

      ctx.beginPath();
      ctx.moveTo(left + radius, top);
      ctx.lineTo(left + width - radius, top);
      ctx.arc(left + width - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(left + radius, top + height);
      ctx.arc(left + radius, top + radius, radius, Math.PI / 2, Math.PI * 3 / 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  renderRings(ctx, scale, gameWidth, gameHeight) {
    const thickness = CONFIG.RING_THICKNESS * scale;

    for (const r of this.ringStates) {
      if (!r.spawned) continue;
      if (r.shatterDone) continue;

      // Shatter animation
      if (r.shattering) {
        const progress = Math.min(r.shatterTimer / CONFIG.RING_SHATTER_DURATION, 1);
        const opacity = 1 - progress;
        const distance = CONFIG.RING_SHATTER_DISTANCE * scale * progress;
        const ringRadius = CONFIG.RING_RADIUS * scale;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = CONFIG.RING_COLOR;
        ctx.lineWidth = thickness * 0.5;
        ctx.lineCap = 'round';

        for (const frag of r.shatterFragments) {
          const fx = r.cx + Math.cos(frag.dirAngle) * distance;
          const fy = r.cy + Math.sin(frag.dirAngle) * distance;
          ctx.beginPath();
          ctx.arc(fx, fy, ringRadius * 0.25, frag.angle, frag.angle + frag.arcLen);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }

      // Already hit successfully — don't render
      if (r.hit && r.success) continue;

      // Normal ring rendering
      const ringRadius = CONFIG.RING_RADIUS * scale;
      const t = (this.time - r.spawnT) * CONFIG.RING_PULSE_SPEED;
      const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
      const gapAngleRad = CONFIG.RING_GAP_ANGLE * (Math.PI / 180);
      const gapStart = r.gapCenter - gapAngleRad / 2;
      const gapEnd = r.gapCenter + gapAngleRad / 2;

      ctx.save();
      ctx.strokeStyle = CONFIG.RING_COLOR;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'butt';
      ctx.globalAlpha = pulse;

      ctx.beginPath();
      ctx.arc(r.cx, r.cy, ringRadius, gapEnd, gapStart + Math.PI * 2);
      ctx.stroke();

      // Gap edge dots
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = CONFIG.RING_COLOR;
      const dotR = thickness * 0.35;

      const sx = r.cx + Math.cos(gapStart) * ringRadius;
      const sy = r.cy + Math.sin(gapStart) * ringRadius;
      ctx.beginPath();
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
      ctx.fill();

      const ex = r.cx + Math.cos(gapEnd) * ringRadius;
      const ey = r.cy + Math.sin(gapEnd) * ringRadius;
      ctx.beginPath();
      ctx.arc(ex, ey, dotR, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  renderFlash(ctx, gameWidth, gameHeight) {
    for (const r of this.ringStates) {
      if (!r.flashing) continue;
      const flashAlpha = Math.max(0, 0.3 * (1 - r.flashTimer / 0.2));
      ctx.save();
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = CONFIG.RING_COLOR;
      ctx.fillRect(0, 0, gameWidth, gameHeight);
      ctx.restore();
    }
  }

  renderControls(ctx, gameWidth, gameHeight, scale) {
    if (this.endTimer > 0) return;

    const margin = 16 * scale;
    const size = Math.round(12 * scale);

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${size}px monospace`;

    // Play/Pause — top-left
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.playing ? '\u23f8' : '\u25b6', margin, margin);

    // Speed — top-right
    ctx.textAlign = 'right';
    ctx.fillText(`${this.speed}\u00d7`, gameWidth - margin, margin);

    ctx.restore();
  }
}
