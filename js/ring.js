import { CONFIG } from './config.js';

class Ring {
  constructor(cx, cy, radius, thickness, gapAngle, gapCenter, scale, isDual, isRingA) {
    this.cx = cx;
    this.cy = cy;
    this.radius = radius;
    this.thickness = thickness;
    this.gapAngle = gapAngle; // radians
    this.gapCenter = gapCenter; // radians
    this.scale = scale;
    this.isDual = isDual;
    this.isRingA = isRingA;

    this.innerRadius = radius - thickness / 2;
    this.outerRadius = radius + thickness / 2;

    this.active = true;
    this.success = false;
    this.pulseTime = Math.random() * 10;

    // Shatter
    this.shattering = false;
    this.shatterFragments = [];
    this.shatterTimer = 0;
    this.shatterDone = false;

    // Dual-ring B: gap hidden until Ring A threaded
    this.gapRevealed = !isDual || isRingA;
  }

  update(dt) {
    this.pulseTime += dt;

    if (this.shattering) {
      this.shatterTimer += dt * 1000;
      if (this.shatterTimer >= CONFIG.RING_SHATTER_DURATION) {
        this.shatterDone = true;
      }
    }
  }

  checkCollision(ball) {
    if (!this.active) return null;
    if (!this.gapRevealed) return null;

    const dx = ball.x - this.cx;
    const dy = ball.y - this.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Ball center must be within the annular zone
    if (dist < this.innerRadius || dist > this.outerRadius) return null;

    const angle = Math.atan2(dy, dx);
    return this.isInGap(angle) ? 'gap' : 'arc';
  }

  isInGap(angle) {
    let diff = angle - this.gapCenter;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < this.gapAngle / 2;
  }

  onSuccess() {
    this.active = false;
    this.success = true;
  }

  startShatter(collisionX, collisionY) {
    this.active = false;
    this.shattering = true;

    const count = Math.floor(Math.random() *
      (CONFIG.RING_SHATTER_FRAGMENTS_MAX - CONFIG.RING_SHATTER_FRAGMENTS_MIN + 1)) +
      CONFIG.RING_SHATTER_FRAGMENTS_MIN;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const arcLen = (Math.PI * 2 / count) * 0.6;
      this.shatterFragments.push({
        angle,
        arcLen,
        startX: collisionX,
        startY: collisionY,
        dirAngle: angle,
      });
    }
  }

  revealGap(gapCenter) {
    this.gapCenter = gapCenter;
    this.gapRevealed = true;
  }

  render(ctx, approachFactor) {
    if (this.shatterDone) return;

    if (this.shattering) {
      this.renderShatter(ctx);
      return;
    }

    if (!this.active) return;

    // Pulse: 60-100% opacity on arc body
    const t = this.pulseTime * CONFIG.RING_PULSE_SPEED;
    const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
    let brightness = (this.isDual && this.isRingA) ? Math.min(pulse + 0.15, 1.0) : pulse;

    // Approach glow: ring brightens as ball gets closer
    if (approachFactor > 0) {
      brightness = Math.min(1.0, brightness + approachFactor * 0.4);
    }

    const gapStart = this.gapCenter - this.gapAngle / 2;
    const gapEnd = this.gapCenter + this.gapAngle / 2;

    ctx.save();
    ctx.strokeStyle = CONFIG.RING_COLOR;
    ctx.lineWidth = this.thickness;
    ctx.lineCap = 'butt';

    if (this.gapRevealed) {
      // Gap direction indicator — faint dotted line pointing toward gap
      if (approachFactor < 0.5) {
        const indicatorLen = this.radius * 2.5;
        const gapDirX = Math.cos(this.gapCenter);
        const gapDirY = Math.sin(this.gapCenter);
        ctx.globalAlpha = 0.08;
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.cx + gapDirX * this.radius * 1.2, this.cy + gapDirY * this.radius * 1.2);
        ctx.lineTo(this.cx + gapDirX * indicatorLen, this.cy + gapDirY * indicatorLen);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = this.thickness;
      }

      // Arc (non-gap) at pulsing opacity
      ctx.globalAlpha = brightness;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.radius, gapEnd, gapStart + Math.PI * 2);
      ctx.stroke();

      // Gap edges at 100% opacity — bright dots
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = CONFIG.RING_COLOR;
      const dotR = this.thickness * 0.35;

      const sx = this.cx + Math.cos(gapStart) * this.radius;
      const sy = this.cy + Math.sin(gapStart) * this.radius;
      ctx.beginPath();
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
      ctx.fill();

      const ex = this.cx + Math.cos(gapEnd) * this.radius;
      const ey = this.cy + Math.sin(gapEnd) * this.radius;
      ctx.beginPath();
      ctx.arc(ex, ey, dotR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Ring B before A threaded: full ring, dimmer
      ctx.globalAlpha = brightness * 0.4;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderShatter(ctx) {
    const progress = Math.min(this.shatterTimer / CONFIG.RING_SHATTER_DURATION, 1);
    const opacity = 1 - progress;
    const distance = CONFIG.RING_SHATTER_DISTANCE * this.scale * progress;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = CONFIG.RING_COLOR;
    ctx.lineWidth = this.thickness * 0.5;
    ctx.lineCap = 'round';

    for (const frag of this.shatterFragments) {
      const fx = frag.startX + Math.cos(frag.dirAngle) * distance;
      const fy = frag.startY + Math.sin(frag.dirAngle) * distance;

      ctx.beginPath();
      ctx.arc(fx, fy, this.radius * 0.25, frag.angle, frag.angle + frag.arcLen);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export class RingManager {
  constructor() {
    this.rings = [];
    this.lastPosition = null;
    this.flashTimer = 0;
    this.flashing = false;
    this.isDualRound = false;
    this.ringAThreaded = false;
  }

  spawnForRound(round, gameWidth, gameHeight, scale) {
    this.rings = [];
    this.flashing = false;
    this.flashTimer = 0;
    this.ringAThreaded = false;

    const sizeMult = this.getSizeCurve(round);
    const ringRadius = CONFIG.RING_RADIUS * scale * sizeMult;
    const thickness = CONFIG.RING_THICKNESS * scale;
    const gapAngle = CONFIG.RING_GAP_ANGLE * (Math.PI / 180);

    this.isDualRound = round >= CONFIG.DUAL_RING_START_ROUND &&
      (round - CONFIG.DUAL_RING_START_ROUND) % CONFIG.DUAL_RING_FREQUENCY === 0;

    // Gap direction based on round tier
    let gapCenter;
    if (round <= 3) {
      gapCenter = -Math.PI / 2; // upward
    } else if (round <= 7) {
      const dirs = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4,
        Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
      gapCenter = dirs[Math.floor(Math.random() * dirs.length)];
    } else {
      gapCenter = Math.random() * Math.PI * 2 - Math.PI;
    }

    // Position zone based on round tier
    let minYRatio, maxYRatio;
    if (round <= 3) { minYRatio = 0.67; maxYRatio = 0.90; }
    else if (round <= 7) { minYRatio = 0.55; maxYRatio = 0.90; }
    else { minYRatio = 0.35; maxYRatio = 0.90; }

    const margin = ringRadius + thickness;
    const minX = margin;
    const maxX = gameWidth - margin;
    const minY = Math.max(gameHeight * minYRatio, margin + gameHeight * CONFIG.DEAD_ZONE_TOP);
    const maxY = Math.min(gameHeight * maxYRatio, gameHeight * (1 - CONFIG.DEAD_ZONE_BOTTOM) - margin);

    const pos = this.findPosition(minX, maxX, minY, maxY, ringRadius, this.lastPosition);
    this.rings.push(new Ring(pos.x, pos.y, ringRadius, thickness, gapAngle, gapCenter, scale, this.isDualRound, true));

    if (this.isDualRound) {
      const posB = this.findPosition(minX, maxX, minY, maxY, ringRadius, pos);
      this.rings.push(new Ring(posB.x, posB.y, ringRadius, thickness, gapAngle, 0, scale, true, false));
    }

    this.lastPosition = pos;
  }

  findPosition(minX, maxX, minY, maxY, ringRadius, refPos) {
    const minDist = CONFIG.RING_MIN_REPOSITION_DISTANCE * ringRadius * 2;
    let bestPos = null;
    let bestDist = 0;

    for (let i = 0; i < 10; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      if (refPos) {
        const dx = x - refPos.x;
        const dy = y - refPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= minDist) return { x, y };
        if (dist > bestDist) { bestDist = dist; bestPos = { x, y }; }
      } else {
        return { x, y };
      }
    }

    return bestPos || { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  getSizeCurve(round) {
    const idx = Math.min(round - 1, CONFIG.RING_SIZE_CURVE.length - 1);
    return CONFIG.RING_SIZE_CURVE[Math.max(0, idx)];
  }

  getSpeedCurve(round) {
    const idx = Math.min(round - 1, CONFIG.SPEED_CURVE.length - 1);
    return CONFIG.SPEED_CURVE[Math.max(0, idx)];
  }

  update(dt) {
    for (const ring of this.rings) {
      ring.update(dt);
    }

    if (this.flashing) {
      this.flashTimer += dt;
      if (this.flashTimer > 0.35) {
        this.flashing = false;
      }
    }
  }

  checkCollision(ball) {
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (!ring.active || !ring.gapRevealed) continue;

      const result = ring.checkCollision(ball);
      if (result) {
        return { type: result, ring, ringIndex: i, collisionX: ball.x, collisionY: ball.y };
      }
    }
    return null;
  }

  onRingSuccess(ringIndex, ball) {
    const ring = this.rings[ringIndex];
    ring.onSuccess();
    this.flashing = true;
    this.flashTimer = 0;

    // If Ring A of dual round, reveal Ring B's gap based on exit angle
    if (ring.isDual && ring.isRingA && this.rings.length > 1) {
      this.ringAThreaded = true;
      const ringB = this.rings[1];
      const exitAngle = Math.atan2(ball.vy, ball.vx);
      const offsetRange = CONFIG.DUAL_RING_ANGLE_OFFSET_MAX - CONFIG.DUAL_RING_ANGLE_OFFSET_MIN;
      const offset = (CONFIG.DUAL_RING_ANGLE_OFFSET_MIN + Math.random() * offsetRange) * (Math.PI / 180);
      const sign = Math.random() < 0.5 ? 1 : -1;
      ringB.revealGap(exitAngle + sign * offset);
    }
  }

  renderRings(ctx, ball) {
    for (const ring of this.rings) {
      let approachFactor = 0;
      if (ball && ring.active) {
        const dx = ball.x - ring.cx;
        const dy = ball.y - ring.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = CONFIG.RING_APPROACH_DISTANCE * (ball.scale || 1);
        approachFactor = Math.max(0, 1 - dist / maxDist);
      }
      ring.render(ctx, approachFactor);
    }
  }

  renderShatterOnly(ctx) {
    for (const ring of this.rings) {
      if (ring.shattering && !ring.shatterDone) {
        ring.render(ctx);
      }
    }
  }

  renderFlash(ctx, gameWidth, gameHeight) {
    if (!this.flashing) return;
    const flashAlpha = Math.max(0, 0.4 * (1 - this.flashTimer / 0.35));
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = CONFIG.RING_COLOR;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    ctx.restore();
  }

  clear() {
    this.rings = [];
    this.flashing = false;
    this.flashTimer = 0;
  }
}
