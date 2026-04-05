/**
 * AI Hooks — optional integration layer for external AI providers.
 *
 * When no AI is configured, all methods are no-ops. The game plays identically.
 * To connect an AI, set window.BOUNCE_AI to an object implementing any subset of:
 *
 *   {
 *     onGameState(state)    — called every physics tick with full game state
 *     onRoundStart(round)   — called when a new round begins
 *     onRingResult(result)  — called after ring thread success or failure
 *     onRunEnd(stats)       — called when a run ends
 *     getSurfaceHint(state) — return {x, y} to suggest a surface placement (shown as ghost)
 *     getCommentary(event)  — return string for in-game commentary text
 *   }
 *
 * Example: connect a local LLM
 *   window.BOUNCE_AI = {
 *     onRunEnd(stats) { fetch('/api/analyze', { method: 'POST', body: JSON.stringify(stats) }); },
 *     getCommentary(event) { return event === 'streak_3' ? 'Nice streak!' : null; }
 *   };
 */

export class AIHooks {
  constructor() {
    this._provider = null;
    this._enabled = false;
    this._lastHintTime = 0;
    this._hintCooldown = 0.5; // seconds between hint requests
    this._surfaceHint = null;
    this._commentary = null;
    this._commentaryTimer = 0;
  }

  /** Check for and connect to an AI provider on window.BOUNCE_AI */
  connect() {
    if (typeof window !== 'undefined' && window.BOUNCE_AI && typeof window.BOUNCE_AI === 'object') {
      this._provider = window.BOUNCE_AI;
      this._enabled = true;
      return true;
    }
    this._enabled = false;
    this._provider = null;
    return false;
  }

  get isConnected() {
    return this._enabled && this._provider !== null;
  }

  /** Call provider method safely — never throws, never blocks gameplay */
  _call(method, ...args) {
    if (!this._enabled || !this._provider) return undefined;
    try {
      if (typeof this._provider[method] === 'function') {
        return this._provider[method](...args);
      }
    } catch {
      // AI errors must never break the game
    }
    return undefined;
  }

  /** Notify AI of current game state (called each physics tick) */
  notifyState(state) {
    this._call('onGameState', state);
  }

  /** Notify AI of round start */
  notifyRoundStart(round) {
    this._call('onRoundStart', round);

    // Request commentary
    const text = this._call('getCommentary', `round_${round}`);
    if (text && typeof text === 'string') {
      this._commentary = text.substring(0, 40);
      this._commentaryTimer = 2.0;
    }
  }

  /** Notify AI of ring result */
  notifyRingResult(result) {
    this._call('onRingResult', result);

    // Request commentary for notable events
    let event = result.success ? 'ring_success' : 'ring_fail';
    if (result.streak >= 3) event = `streak_${result.streak}`;
    if (result.isClean) event = 'clean';

    const text = this._call('getCommentary', event);
    if (text && typeof text === 'string') {
      this._commentary = text.substring(0, 40);
      this._commentaryTimer = 2.0;
    }
  }

  /** Notify AI of run end */
  notifyRunEnd(stats) {
    this._call('onRunEnd', stats);

    const text = this._call('getCommentary', 'run_end');
    if (text && typeof text === 'string') {
      this._commentary = text.substring(0, 40);
      this._commentaryTimer = 2.5;
    }
  }

  /** Request surface placement hint from AI */
  requestSurfaceHint(state, gameTime) {
    if (!this._enabled) return null;
    if (gameTime - this._lastHintTime < this._hintCooldown) return this._surfaceHint;

    this._lastHintTime = gameTime;
    const hint = this._call('getSurfaceHint', state);

    if (hint && typeof hint.x === 'number' && typeof hint.y === 'number') {
      this._surfaceHint = { x: hint.x, y: hint.y };
    } else {
      this._surfaceHint = null;
    }

    return this._surfaceHint;
  }

  /** Update timers */
  update(dt) {
    if (this._commentaryTimer > 0) {
      this._commentaryTimer -= dt;
      if (this._commentaryTimer <= 0) {
        this._commentary = null;
      }
    }
  }

  /** Get current commentary text (or null) */
  getCommentary() {
    return this._commentary;
  }

  /** Get current surface hint (or null) */
  getSurfaceHint() {
    return this._surfaceHint;
  }

  /** Build a game state snapshot for AI consumption */
  buildState(game) {
    const ball = game.ball;
    const ring = game.ringManager.rings[0];
    const gw = game.renderer.gameWidth;
    const gh = game.renderer.gameHeight;

    return {
      state: game.state,
      round: game.scoreManager.round,
      score: game.scoreManager.score,
      streak: game.scoreManager.streak,
      bounceCount: game.scoreManager.bounceCount,
      gameTime: game.gameTime,
      ball: ball ? {
        x: ball.x / gw,
        y: ball.y / gh,
        vx: ball.vx,
        vy: ball.vy,
        alive: ball.alive,
      } : null,
      ring: ring && ring.active ? {
        cx: ring.cx / gw,
        cy: ring.cy / gh,
        gapCenter: ring.gapCenter,
        gapAngle: ring.gapAngle,
        radius: ring.radius / gw,
      } : null,
      surfaces: game.surfaces.surfaces.map(s => ({
        x: s.x / gw,
        y: s.y / gh,
        hit: s.hit,
        decaying: s.decaying,
      })),
      gameWidth: gw,
      gameHeight: gh,
    };
  }
}
