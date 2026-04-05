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
 *     onBounce(data)        — called when ball bounces off a surface
 *     onRunEnd(stats)       — called when a run ends
 *     onSurfacePlaced(data) — called when player places a surface ({x, y, time})
 *     getSurfaceHint(state) — return {x, y} or Promise<{x, y}> to suggest surface placement
 *     getCommentary(event)  — return string or Promise<string> for in-game commentary
 *   }
 *
 * All callbacks are fire-and-forget. Promises are supported — results apply next frame.
 * AI errors never break the game.
 *
 * Example: connect a local LLM
 *   window.BOUNCE_AI = {
 *     onRunEnd(stats) { fetch('/api/analyze', { method: 'POST', body: JSON.stringify(stats) }); },
 *     async getCommentary(event) {
 *       if (event === 'streak_5') return 'Great streak!';
 *       return null;
 *     }
 *   };
 */

export class AIHooks {
  constructor() {
    this._provider = null;
    this._enabled = false;
    this._lastHintTime = 0;
    this._hintCooldown = 0.5;
    this._surfaceHint = null;
    this._commentary = null;
    this._commentaryTimer = 0;
    this._pendingHint = false;
    this._pendingCommentary = false;
    this._mood = null;
    this._moodTimer = 0;
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

  /** Call provider method safely — supports sync and async returns */
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

  /** Handle a return value that might be a Promise */
  _resolveAsync(result, callback) {
    if (result && typeof result.then === 'function') {
      result.then(val => { try { callback(val); } catch {} }).catch(() => {});
    } else {
      try { callback(result); } catch {}
    }
  }

  /** Notify AI of current game state (called each physics tick) */
  notifyState(state) {
    this._call('onGameState', state);
  }

  /** Notify AI of round start */
  notifyRoundStart(round) {
    this._call('onRoundStart', round);
    this._requestCommentary(`round_${round}`);
  }

  /** Notify AI of ring result */
  notifyRingResult(result) {
    this._call('onRingResult', result);

    let event = result.success ? 'ring_success' : 'ring_fail';
    if (result.streak >= 3) event = `streak_${result.streak}`;
    if (result.isClean) event = 'clean';

    this._requestCommentary(event);
  }

  /** Notify AI of ball bounce */
  notifyBounce(data) {
    this._call('onBounce', data);
  }

  /** Notify AI of run end */
  notifyRunEnd(stats) {
    this._call('onRunEnd', stats);
    this._requestCommentary('run_end', 2.5);
  }

  /** Request commentary — supports async providers */
  _requestCommentary(event, duration = 2.0) {
    if (this._pendingCommentary) return;
    const result = this._call('getCommentary', event);
    if (result === undefined) return;

    this._pendingCommentary = true;
    this._resolveAsync(result, (text) => {
      this._pendingCommentary = false;
      if (text && typeof text === 'string') {
        this._commentary = text.substring(0, 60);
        this._commentaryTimer = duration;
      }
    });
  }

  /** Request surface placement hint from AI — supports async */
  requestSurfaceHint(state, gameTime) {
    if (!this._enabled) return null;
    if (gameTime - this._lastHintTime < this._hintCooldown) return this._surfaceHint;
    if (this._pendingHint) return this._surfaceHint;

    this._lastHintTime = gameTime;
    const result = this._call('getSurfaceHint', state);
    if (result === undefined) return this._surfaceHint;

    this._pendingHint = true;
    this._resolveAsync(result, (hint) => {
      this._pendingHint = false;
      if (hint && typeof hint.x === 'number' && typeof hint.y === 'number') {
        this._surfaceHint = { x: hint.x, y: hint.y };
      } else {
        this._surfaceHint = null;
      }
    });

    return this._surfaceHint;
  }

  /** Request mood tint from AI */
  requestMood() {
    if (!this._enabled) return;
    const result = this._call('getMood');
    if (result === undefined) return;
    this._resolveAsync(result, (mood) => {
      if (mood && typeof mood.r === 'number' && typeof mood.g === 'number' && typeof mood.b === 'number') {
        this._mood = {
          r: Math.max(0, Math.min(255, Math.round(mood.r))),
          g: Math.max(0, Math.min(255, Math.round(mood.g))),
          b: Math.max(0, Math.min(255, Math.round(mood.b))),
          intensity: Math.max(0, Math.min(0.03, mood.intensity || 0.01)),
        };
        this._moodTimer = 3.0;
      }
    });
  }

  /** Update timers */
  update(dt) {
    if (this._commentaryTimer > 0) {
      this._commentaryTimer -= dt;
      if (this._commentaryTimer <= 0) {
        this._commentary = null;
      }
    }
    if (this._moodTimer > 0) {
      this._moodTimer -= dt;
      if (this._moodTimer <= 0) {
        this._mood = null;
      }
    }
  }

  getMood() { return this._mood; }

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
    const gw = game.renderer.gameWidth;
    const gh = game.renderer.gameHeight;

    const rings = game.ringManager.rings.filter(r => r.active).map(r => ({
      cx: r.cx / gw,
      cy: r.cy / gh,
      gapCenter: r.gapCenter,
      gapAngle: r.gapAngle,
      radius: r.radius / gw,
    }));

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
      rings,
      surfaces: game.surfaces.surfaces.filter(s => !s.removed).map(s => ({
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
