/**
 * Agent API — programmatic interface for AI agents to observe and play BOUNCE.
 *
 * Exposed as window.BounceAgent after the game loads.
 * Any script, bot, or AI agent can use this to:
 *   - Read full game state
 *   - Place surfaces (tap)
 *   - Start new runs
 *   - Query ring positions and ball physics
 *   - Subscribe to game events
 *   - Predict ball trajectory
 *   - Query scoring rules
 *
 * Usage from browser console or injected script:
 *
 *   const agent = window.BounceAgent;
 *   agent.tap(200, 400);           // place surface at (200, 400)
 *   const state = agent.getState(); // read game state
 *   agent.startRun();               // begin a new run from menu
 *
 * Usage from an external AI agent (e.g. via puppeteer/playwright):
 *
 *   await page.evaluate(() => window.BounceAgent.tap(200, 400));
 *   const state = await page.evaluate(() => window.BounceAgent.getState());
 *
 * Event subscription:
 *
 *   agent.on('bounce', (data) => console.log('Bounced!', data));
 *   agent.on('ringSuccess', (data) => console.log('Threaded!', data));
 *   agent.on('runEnd', (data) => console.log('Run ended', data));
 */

import { CONFIG } from './config.js';

export class AgentAPI {
  constructor(game) {
    this._game = game;
    this._listeners = {};
    this._silent = false;
  }

  // --- Event System ---

  /** Subscribe to game events: bounce, ringSuccess, ringFail, roundStart, runEnd, stateChange */
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  /** Unsubscribe from a game event */
  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  /** Emit event to all subscribers (called internally by game) */
  _emit(event, data) {
    const cbs = this._listeners[event];
    if (!cbs) return;
    for (const cb of cbs) {
      try { cb(data); } catch { /* agent errors must not break game */ }
    }
  }

  // --- State Queries ---

  /** Get full game state as a plain object */
  getState() {
    const g = this._game;
    const ball = g.ball;
    const gw = g.renderer.gameWidth;
    const gh = g.renderer.gameHeight;
    const scale = g.renderer.scale;

    const rings = g.ringManager.rings.map(r => ({
      cx: r.cx,
      cy: r.cy,
      radius: r.radius,
      gapCenter: r.gapCenter,
      gapAngle: r.gapAngle,
      active: r.active,
      gapRevealed: r.gapRevealed,
      innerRadius: r.innerRadius,
      outerRadius: r.outerRadius,
    }));

    const surfaces = g.surfaces.surfaces.map(s => ({
      x: s.x,
      y: s.y,
      halfLength: s.halfLength,
      hit: s.hit,
      decaying: s.decaying,
      removed: s.removed,
    }));

    return {
      state: g.state,
      round: g.scoreManager.round,
      score: g.scoreManager.score,
      streak: g.scoreManager.streak,
      bounceCount: g.scoreManager.bounceCount,
      personalBest: g.scoreManager.personalBest,
      gameTime: g.gameTime,
      paused: g.paused,
      gameWidth: gw,
      gameHeight: gh,
      scale: scale,
      ball: ball ? {
        x: ball.x,
        y: ball.y,
        vx: ball.vx,
        vy: ball.vy,
        radius: ball.radius,
        alive: ball.alive,
        opacity: ball.opacity,
      } : null,
      rings,
      surfaces,
      deadZoneTop: gh * CONFIG.DEAD_ZONE_TOP,
      deadZoneBottom: gh * (1 - CONFIG.DEAD_ZONE_BOTTOM),
    };
  }

  /** Get just the ball state (lightweight query) */
  getBall() {
    const ball = this._game.ball;
    if (!ball) return null;
    return {
      x: ball.x,
      y: ball.y,
      vx: ball.vx,
      vy: ball.vy,
      radius: ball.radius,
      alive: ball.alive,
    };
  }

  /** Get the active ring(s) */
  getRings() {
    return this._game.ringManager.rings
      .filter(r => r.active)
      .map(r => ({
        cx: r.cx,
        cy: r.cy,
        radius: r.radius,
        gapCenter: r.gapCenter,
        gapAngle: r.gapAngle,
        innerRadius: r.innerRadius,
        outerRadius: r.outerRadius,
      }));
  }

  /** Get scoring info: current multiplier, projected score for next ring, rules */
  getScoreInfo() {
    const sm = this._game.scoreManager;
    const bounceIdx = Math.min(sm.bounceCount, CONFIG.BOUNCE_MULTIPLIERS.length - 1);
    const bounceMult = CONFIG.BOUNCE_MULTIPLIERS[bounceIdx];
    const streakMult = 1.0 + sm.streak * CONFIG.STREAK_MULTIPLIER_STEP;
    const projectedScore = Math.round(CONFIG.BASE_RING_SCORE * bounceMult * streakMult);

    return {
      bounceCount: sm.bounceCount,
      bounceMultiplier: bounceMult,
      streakMultiplier: streakMult,
      projectedRingScore: projectedScore,
      currentScore: sm.score,
      streak: sm.streak,
      bounceMultipliers: [...CONFIG.BOUNCE_MULTIPLIERS],
      baseRingScore: CONFIG.BASE_RING_SCORE,
    };
  }

  /** Get current run statistics */
  getRunStats() {
    const g = this._game;
    return {
      round: g.scoreManager.round,
      score: g.scoreManager.score,
      streak: g.scoreManager.streak,
      longestStreak: g.scoreManager.longestStreak,
      bounceCount: g.scoreManager.bounceCount,
      totalBounces: g.runBounceTotal,
      ringsThreaded: g.runRingsThreaded,
      duration: g.gameTime,
      state: g.state,
    };
  }

  /** Get game dimensions */
  getDimensions() {
    return {
      width: this._game.renderer.gameWidth,
      height: this._game.renderer.gameHeight,
      scale: this._game.renderer.scale,
    };
  }

  // --- Actions ---

  /** Simulate a tap at canvas coordinates (x, y) */
  tap(x, y) {
    if (this._game.input && this._game.input.onTap) {
      this._game.input.onTap(x, y);
    }
  }

  /** Start a new run (only works from MENU or RUN_OVER when ready) */
  startRun() {
    const state = this._game.state;
    if (state === 'MENU') {
      this._game.startNewRun();
      return true;
    } else if (state === 'RUN_OVER' && this._game.runEndInputReady) {
      this._game.startNewRun();
      return true;
    }
    return false;
  }

  /** Place a surface at (x, y) — only works during DROPPING state */
  placeSurface(x, y) {
    if (this._game.state !== 'DROPPING' && this._game.state !== 'RING_HIT') return false;
    if (this._game.isInDeadZone(y)) return false;
    this.tap(x, y);
    return true;
  }

  /** Check if the game is ready to accept a restart */
  canRestart() {
    const state = this._game.state;
    if (state === 'MENU') return true;
    if (state === 'RUN_OVER' && this._game.runEndInputReady) return true;
    return false;
  }

  /** Check if the game is in a playable state */
  isPlaying() {
    return this._game.state === 'DROPPING' || this._game.state === 'RING_HIT';
  }

  // --- Silent Mode ---

  /** Enable/disable silent mode (suppresses audio and haptics for automated play) */
  setSilent(enabled) {
    this._silent = !!enabled;
  }

  get isSilent() {
    return this._silent;
  }

  // --- Prediction ---

  /** Predict ball position after dt seconds (simple forward simulation) */
  predictBall(dt) {
    const ball = this._game.ball;
    if (!ball || !ball.alive) return null;

    const scale = ball.scale;
    const gravMult = ball.round <= 1 ? CONFIG.GRAVITY_ROUND1_MULT : 1.0;
    const gravity = CONFIG.GRAVITY * scale * ball.speedMult * gravMult;

    let vx = ball.vx;
    let vy = ball.vy + gravity * dt;
    let x = ball.x + vx * dt;
    let y = ball.y + ball.vy * dt + 0.5 * gravity * dt * dt;

    // Wall bounces
    const gw = this._game.renderer.gameWidth;
    if (x - ball.radius < 0) { x = ball.radius; vx = Math.abs(vx) * CONFIG.WALL_RESTITUTION; }
    if (x + ball.radius > gw) { x = gw - ball.radius; vx = -Math.abs(vx) * CONFIG.WALL_RESTITUTION; }

    return { x, y, vx, vy };
  }

  /**
   * Predict ball path over multiple steps, accounting for gravity, walls, and existing surfaces.
   * Returns array of {x, y, vx, vy, t, bounced} positions.
   */
  predictPath(steps = 60, stepDt = 1 / 60) {
    const ball = this._game.ball;
    if (!ball || !ball.alive) return [];

    const scale = ball.scale;
    const gravMult = ball.round <= 1 ? CONFIG.GRAVITY_ROUND1_MULT : 1.0;
    const gravity = CONFIG.GRAVITY * scale * ball.speedMult * gravMult;
    const gw = this._game.renderer.gameWidth;
    const gh = this._game.renderer.gameHeight;

    // Snapshot active surfaces for collision
    const surfaces = this._game.surfaces.surfaces
      .filter(s => !s.hit && !s.removed && !s.fading)
      .map(s => ({
        x: s.x, y: s.y,
        halfLength: s.halfLength,
        halfThickness: s.halfThickness || CONFIG.SURFACE_THICKNESS * scale / 2,
      }));

    let x = ball.x, y = ball.y;
    let vx = ball.vx, vy = ball.vy;
    let t = 0;
    const path = [{ x, y, vx, vy, t: 0, bounced: false }];

    for (let i = 0; i < steps; i++) {
      const prevY = y;
      vy += gravity * stepDt;
      x += vx * stepDt;
      y += vy * stepDt;
      t += stepDt;

      // Wall bounces
      if (x - ball.radius < 0) { x = ball.radius; vx = Math.abs(vx) * CONFIG.WALL_RESTITUTION; }
      if (x + ball.radius > gw) { x = gw - ball.radius; vx = -Math.abs(vx) * CONFIG.WALL_RESTITUTION; }

      // Surface collision check
      let bounced = false;
      if (vy > 0) {
        for (const s of surfaces) {
          const surfTop = s.y - s.halfThickness;
          const prevBottom = prevY + ball.radius;
          const curBottom = y + ball.radius;
          if (prevBottom <= surfTop && curBottom >= surfTop) {
            if (x + ball.radius >= s.x - s.halfLength &&
                x - ball.radius <= s.x + s.halfLength) {
              y = surfTop - ball.radius;
              vy = -Math.abs(vy) * CONFIG.BALL_RESTITUTION;
              bounced = true;
              break;
            }
          }
        }
      }

      // Floor — end prediction
      if (y > gh + ball.radius) {
        path.push({ x, y: gh, vx, vy, t, bounced: false, floor: true });
        break;
      }

      path.push({ x, y, vx, vy, t, bounced });
    }

    return path;
  }

  // --- Configuration ---

  /** Get physics constants needed for agent simulation */
  getConfig() {
    const g = this._game;
    const round = g.scoreManager.round;
    const speedMult = g.ringManager.getSpeedCurve(round);
    const scale = g.renderer.scale;

    return {
      gravity: CONFIG.GRAVITY,
      gravityRound1Mult: CONFIG.GRAVITY_ROUND1_MULT,
      ballRadius: CONFIG.BALL_RADIUS,
      ballRestitution: CONFIG.BALL_RESTITUTION,
      wallRestitution: CONFIG.WALL_RESTITUTION,
      surfaceLength: CONFIG.SURFACE_LENGTH,
      surfaceThickness: CONFIG.SURFACE_THICKNESS,
      surfaceDecayTime: round <= 1 ? CONFIG.SURFACE_DECAY_TIME_ROUND1 : CONFIG.SURFACE_DECAY_TIME,
      ringGapAngle: round <= 2 ? CONFIG.RING_GAP_ANGLE_ROUND1 : CONFIG.RING_GAP_ANGLE,
      ringRadius: CONFIG.RING_RADIUS,
      ringThickness: CONFIG.RING_THICKNESS,
      minSpeed: CONFIG.MIN_SPEED,
      maxSpeed: CONFIG.MAX_SPEED,
      speedMultiplier: speedMult,
      scale: scale,
      currentRound: round,
      deadZoneTop: CONFIG.DEAD_ZONE_TOP,
      deadZoneBottom: CONFIG.DEAD_ZONE_BOTTOM,
      bounceMultipliers: [...CONFIG.BOUNCE_MULTIPLIERS],
      baseRingScore: CONFIG.BASE_RING_SCORE,
      streakMultiplierStep: CONFIG.STREAK_MULTIPLIER_STEP,
    };
  }

  /** Validate whether a surface placement at (x, y) would be accepted */
  validatePlacement(x, y) {
    const state = this._game.state;
    if (state !== 'DROPPING' && state !== 'RING_HIT') {
      return { valid: false, reason: 'not_playing' };
    }
    const gh = this._game.renderer.gameHeight;
    if (y < gh * CONFIG.DEAD_ZONE_TOP) {
      return { valid: false, reason: 'dead_zone_top' };
    }
    if (y > gh * (1 - CONFIG.DEAD_ZONE_BOTTOM)) {
      return { valid: false, reason: 'dead_zone_bottom' };
    }
    return { valid: true, reason: null };
  }

  /**
   * Analyze whether the ball's predicted path will pass through the active ring gap.
   * Returns { willThread, missDirection, distanceToRing, predictedAngle, gapCenter }
   */
  analyzeRingApproach() {
    const ball = this._game.ball;
    if (!ball || !ball.alive) return null;

    const rings = this._game.ringManager.rings.filter(r => r.active && r.gapRevealed);
    if (rings.length === 0) return null;

    const ring = rings[0];
    const path = this.predictPath(120, 1 / 60);

    // Find where path intersects the ring's annular zone
    for (let i = 1; i < path.length; i++) {
      const p = path[i];
      const dx = p.x - ring.cx;
      const dy = p.y - ring.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= ring.innerRadius && dist <= ring.outerRadius) {
        const angle = Math.atan2(dy, dx);
        let diff = angle - ring.gapCenter;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const inGap = Math.abs(diff) < ring.gapAngle / 2;
        return {
          willThread: inGap,
          missDirection: diff > 0 ? 'clockwise' : 'counterclockwise',
          angleDiff: diff,
          predictedAngle: angle,
          gapCenter: ring.gapCenter,
          gapAngle: ring.gapAngle,
          timeToRing: path[i].t,
          ringCenter: { x: ring.cx, y: ring.cy },
        };
      }
    }

    // Path doesn't reach ring (falls to floor first)
    return {
      willThread: false,
      missDirection: 'floor',
      angleDiff: null,
      predictedAngle: null,
      gapCenter: ring.gapCenter,
      gapAngle: ring.gapAngle,
      timeToRing: null,
      ringCenter: { x: ring.cx, y: ring.cy },
    };
  }

  /**
   * Returns a Promise that resolves when the game enters the specified state.
   * Usage: await agent.waitForState('DROPPING');
   */
  waitForState(targetState, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (this._game.state === targetState) {
        resolve(targetState);
        return;
      }

      const unsub = this.on('stateChange', (data) => {
        if (data.to === targetState) {
          unsub();
          clearTimeout(timer);
          resolve(targetState);
        }
      });

      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Timed out waiting for state: ${targetState}`));
      }, timeoutMs);
    });
  }

  /** Set game speed multiplier for training (1 = normal, 2 = 2x, 4 = 4x) */
  setSpeed(multiplier) {
    this._speedMultiplier = Math.max(0.25, Math.min(multiplier, 8));
  }

  get speedMultiplier() {
    return this._speedMultiplier || 1;
  }

  // --- Enhanced AI Methods ---

  /** Get a compact game summary for LLM-friendly consumption */
  getSummary() {
    const g = this._game;
    const ball = g.ball;
    const rings = g.ringManager.rings.filter(r => r.active && r.gapRevealed);
    const ring = rings[0];
    const gw = g.renderer.gameWidth;
    const gh = g.renderer.gameHeight;

    return {
      playing: g.state === 'DROPPING',
      round: g.scoreManager.round,
      score: g.scoreManager.score,
      streak: g.scoreManager.streak,
      ball: ball && ball.alive ? {
        x: Math.round(ball.x),
        y: Math.round(ball.y),
        vx: Math.round(ball.vx),
        vy: Math.round(ball.vy),
        type: ball.ballType,
        falling: ball.vy > 0,
      } : null,
      ring: ring ? {
        x: Math.round(ring.cx),
        y: Math.round(ring.cy),
        gapDeg: Math.round(ring.gapCenter * 180 / Math.PI),
        event: ring.event,
      } : null,
      surfaces: g.surfaces.surfaces.filter(s => !s.removed && !s.hit).length,
      screen: { w: gw, h: gh },
    };
  }

  /** Tutorial mode — auto-places a surface under the ball to guide it toward the ring */
  autoPlace() {
    const g = this._game;
    if (g.state !== 'DROPPING') return false;
    const ball = g.ball;
    if (!ball || !ball.alive || ball.vy <= 0) return false;

    const rings = g.ringManager.rings.filter(r => r.active && r.gapRevealed);
    if (rings.length === 0) return false;
    const ring = rings[0];
    const gw = g.renderer.gameWidth;
    const gh = g.renderer.gameHeight;

    // Predict where ball will be in ~0.5s (further ahead for better placement)
    const lookAhead = 0.45;
    const gravity = CONFIG.GRAVITY * ball.scale * (ball.speedMult || 1) * (ball.gravityMult || 1);
    const predX = ball.x + ball.vx * lookAhead;
    const predY = ball.y + ball.vy * lookAhead + 0.5 * gravity * lookAhead * lookAhead;

    // Offset surface toward ring — stronger when ball is far from ring
    const dx = ring.cx - predX;
    const offsetStrength = Math.min(Math.abs(dx) / gw, 0.5) * 0.6;
    const nudge = Math.sign(dx) * offsetStrength * gw * 0.15;

    // Place surface ahead of ball (below its predicted position)
    const placeX = Math.max(30, Math.min(gw - 30, predX + nudge));
    const placeY = Math.max(gh * 0.12, Math.min(gh * 0.88, predY + 60 * ball.scale));

    // Don't place if surface would be below the ring (waste)
    if (placeY > ring.cy + ring.outerRadius + 50) return false;

    return this.placeSurface(placeX, placeY);
  }

  /** Notify AI hook when player places a surface */
  _notifySurfacePlaced(x, y) {
    if (this._game.aiHooks && this._game.aiHooks.isConnected) {
      this._game.aiHooks._call('onSurfacePlaced', { x, y, time: this._game.gameTime });
    }
  }
}
