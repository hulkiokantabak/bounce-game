/**
 * Agent API — programmatic interface for AI agents to observe and play BOUNCE.
 *
 * Exposed as window.BounceAgent after the game loads.
 * Any script, bot, or AI agent can use this to:
 *   - Read full game state
 *   - Place surfaces (tap)
 *   - Start new runs
 *   - Query ring positions and ball physics
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
 */

export class AgentAPI {
  constructor(game) {
    this._game = game;
  }

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
      deadZoneTop: gh * 0.05,
      deadZoneBottom: gh * 0.95,
    };
  }

  /** Simulate a tap at canvas coordinates (x, y) */
  tap(x, y) {
    if (this._game.input && this._game.input.onTap) {
      this._game.input.onTap(x, y);
    }
  }

  /** Start a new run (only works from MENU or RUN_OVER states) */
  startRun() {
    const state = this._game.state;
    if (state === 'MENU') {
      this._game.startNewRun();
    } else if (state === 'RUN_OVER' && this._game.runEndInputReady) {
      this._game.startNewRun();
    }
  }

  /** Place a surface at (x, y) — only works during DROPPING state */
  placeSurface(x, y) {
    if (this._game.state !== 'DROPPING' && this._game.state !== 'RING_HIT') return false;
    if (this._game.isInDeadZone(y)) return false;
    this.tap(x, y);
    return true;
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

  /** Predict ball position after dt seconds (simple forward simulation) */
  predictBall(dt) {
    const ball = this._game.ball;
    if (!ball || !ball.alive) return null;

    const scale = ball.scale;
    const gravMult = ball.round <= 1 ? 0.6 : 1.0;
    const gravity = 800 * scale * ball.speedMult * gravMult;

    let vx = ball.vx;
    let vy = ball.vy + gravity * dt;
    let x = ball.x + vx * dt;
    let y = ball.y + ball.vy * dt + 0.5 * gravity * dt * dt;

    // Wall bounces
    const gw = this._game.renderer.gameWidth;
    if (x - ball.radius < 0) { x = ball.radius; vx = Math.abs(vx) * 0.9; }
    if (x + ball.radius > gw) { x = gw - ball.radius; vx = -Math.abs(vx) * 0.9; }

    return { x, y, vx, vy };
  }

  /** Check if the game is in a playable state */
  isPlaying() {
    return this._game.state === 'DROPPING' || this._game.state === 'RING_HIT';
  }

  /** Get game dimensions */
  getDimensions() {
    return {
      width: this._game.renderer.gameWidth,
      height: this._game.renderer.gameHeight,
      scale: this._game.renderer.scale,
    };
  }
}
