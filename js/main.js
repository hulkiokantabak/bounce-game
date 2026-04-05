import { CONFIG } from './config.js';
import { Renderer } from './render.js';
import { Ball } from './ball.js';
import { SurfaceManager } from './surface.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { RingManager } from './ring.js';
import { ScoreManager } from './score.js';

const State = {
  MENU: 'MENU',
  DROPPING: 'DROPPING',
  RING_HIT: 'RING_HIT',
  RUN_OVER: 'RUN_OVER',
  LEADERBOARD: 'LEADERBOARD',
};

const PHYSICS_STEP = 1 / 120;

class Game {
  constructor() {
    this.renderer = new Renderer();
    this.surfaces = new SurfaceManager();
    this.ui = new UI();
    this.input = new InputManager(this.renderer.canvas);
    this.ringManager = new RingManager();
    this.scoreManager = new ScoreManager();

    this.state = State.MENU;
    this.ball = null;
    this.gameTime = 0;
    this.lastTimestamp = 0;
    this.accumulated = 0;
    this.paused = false;

    // RING_HIT
    this.ringHitTimer = 0;

    // RUN_OVER
    this.runEndTimer = 0;
    this.runEndInputReady = false;

    this.input.onTap = (x, y) => this.handleTap(x, y);

    // Pause when hidden, resume when visible. Do not end run.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.paused = true;
      } else {
        this.paused = false;
        this.lastTimestamp = 0;
      }
    });

    requestAnimationFrame((t) => this.loop(t));
  }

  handleTap(x, y) {
    switch (this.state) {
      case State.MENU:
        this.startNewRun();
        break;

      case State.DROPPING:
      case State.RING_HIT:
        if (!this.isInDeadZone(y)) {
          this.surfaces.place(x, y, this.renderer.scale);
        }
        break;

      case State.RUN_OVER:
        if (this.runEndInputReady) {
          if (this.isSaveTap(x, y)) {
            // Phase 4: save flow. For now, restart.
            this.startNewRun();
          } else {
            this.startNewRun();
          }
        }
        break;
    }
  }

  isInDeadZone(y) {
    const h = this.renderer.gameHeight;
    return y < h * CONFIG.DEAD_ZONE_TOP || y > h * (1 - CONFIG.DEAD_ZONE_BOTTOM);
  }

  isSaveTap(x, y) {
    const { gameWidth, gameHeight, scale } = this.renderer;
    const saveRight = gameWidth - 20 * scale;
    const saveY = gameHeight * 0.92;
    const hitW = 80 * scale;
    const hitH = 40 * scale;
    return x > saveRight - hitW && x < saveRight + 10 * scale &&
           y > saveY - hitH / 2 && y < saveY + hitH / 2;
  }

  startNewRun() {
    this.scoreManager.reset();
    this.surfaces.clear();
    this.ringManager.clear();
    this.scoreManager.nextRound();

    const { gameWidth, gameHeight, scale } = this.renderer;
    const speedMult = this.ringManager.getSpeedCurve(this.scoreManager.round);
    this.ball = new Ball(gameWidth, gameHeight, scale, this.scoreManager.round, speedMult);
    this.ringManager.spawnForRound(this.scoreManager.round, gameWidth, gameHeight, scale);

    this.state = State.DROPPING;
    this.gameTime = 0;
    this.runEndTimer = 0;
    this.runEndInputReady = false;
    this.ringHitTimer = 0;
  }

  startNewRound() {
    this.scoreManager.nextRound();

    const { gameWidth, gameHeight, scale } = this.renderer;
    const speedMult = this.ringManager.getSpeedCurve(this.scoreManager.round);
    this.ball = new Ball(gameWidth, gameHeight, scale, this.scoreManager.round, speedMult);
    this.ringManager.spawnForRound(this.scoreManager.round, gameWidth, gameHeight, scale);

    this.state = State.DROPPING;
  }

  endRun() {
    this.state = State.RUN_OVER;
    this.runEndTimer = 0;
    this.runEndInputReady = false;

    if (this.ball) {
      this.ball.alive = false;
      this.ball.freezeTrail(this.gameTime);
    }

    this.surfaces.fadeAll();
    this.scoreManager.checkPersonalBest();
  }

  handleRingGap(result) {
    const { ring, ringIndex } = result;
    this.ringManager.onRingSuccess(ringIndex, this.ball);
    this.ball.brightenTrail();

    if (this.ringManager.isDualRound) {
      if (ring.isRingA) {
        // Ring A threaded — ball continues, bounce count resets
        this.scoreManager.onDualRingASuccess();
      } else {
        // Ring B threaded — round complete
        this.scoreManager.onDualRingBSuccess();
        this.enterRingHit();
      }
    } else {
      this.scoreManager.onSingleRingSuccess();
      this.enterRingHit();
    }
  }

  handleRingArc(result) {
    result.ring.startShatter(result.collisionX, result.collisionY);
    this.endRun();
  }

  enterRingHit() {
    this.state = State.RING_HIT;
    this.ringHitTimer = 0;
  }

  updatePhysics(dt) {
    this.scoreManager.update(dt);
    this.ringManager.update(dt);

    switch (this.state) {
      case State.MENU:
        this.ui.updateMenu(dt);
        break;

      case State.DROPPING:
        if (!this.ball) break;

        this.ball.update(dt);
        this.ball.checkWalls(this.renderer.gameWidth);

        // Surface collision → increment bounce count
        if (this.surfaces.checkCollision(this.ball)) {
          this.scoreManager.onBounce();
        }

        this.ball.addTrailPoint(this.gameTime);
        this.ball.updateTrail(this.gameTime);
        this.surfaces.update(dt);

        // Ring collision
        const ringResult = this.ringManager.checkCollision(this.ball);
        if (ringResult) {
          if (ringResult.type === 'gap') {
            this.handleRingGap(ringResult);
          } else {
            this.handleRingArc(ringResult);
          }
          break;
        }

        // Floor exit → run over
        if (this.ball.checkFloor(this.renderer.gameHeight)) {
          this.endRun();
        }

        // MAX_RUN_DURATION safety valve
        if (this.gameTime >= CONFIG.MAX_RUN_DURATION) {
          this.endRun();
        }
        break;

      case State.RING_HIT:
        this.ringHitTimer += dt;
        this.surfaces.update(dt);

        // Ball fades during pause
        if (this.ball) {
          this.ball.opacity = Math.max(0, 1 - this.ringHitTimer / CONFIG.RING_HIT_PAUSE);
          this.ball.updateTrail(this.gameTime);
        }

        if (this.ringHitTimer >= CONFIG.RING_HIT_PAUSE) {
          this.startNewRound();
        }
        break;

      case State.RUN_OVER:
        this.runEndTimer += dt;
        this.surfaces.update(dt);

        // Ball fades during 0.5s pause
        if (this.ball && this.runEndTimer < CONFIG.RUN_END_PAUSE) {
          this.ball.opacity = Math.max(0, 1 - this.runEndTimer / CONFIG.RUN_END_PAUSE);
        } else if (this.ball) {
          this.ball.opacity = 0;
        }

        // Input unlocked after full 7.5s sequence
        const totalLock = CONFIG.RUN_END_PAUSE + CONFIG.RUN_END_TRAIL_HOLD +
          CONFIG.RUN_END_SCORE_FADE + CONFIG.RUN_END_PROMPT_DELAY;
        if (!this.runEndInputReady && this.runEndTimer >= totalLock) {
          this.runEndInputReady = true;
        }
        break;
    }
  }

  render() {
    const { ctx, gameWidth, gameHeight, scale } = this.renderer;

    this.renderer.clear();

    if (this.state === State.MENU) {
      this.ui.renderMenu(ctx, gameWidth, gameHeight, scale, this.scoreManager.personalBest);
      return;
    }

    const isRunOver = this.state === State.RUN_OVER;
    const inTrailHold = isRunOver && this.runEndTimer >= CONFIG.RUN_END_PAUSE;

    // Death line (not during clean trail hold)
    if (!inTrailHold) {
      this.renderer.drawDeathLine();
    }

    // Trail (always visible)
    if (this.ball) {
      this.ball.renderTrail(ctx, this.gameTime);
    }

    // Rings
    if (isRunOver) {
      // During run-end Phase 1: show shatter only
      if (!inTrailHold) {
        this.ringManager.renderShatterOnly(ctx);
      }
    } else {
      this.ringManager.renderRings(ctx);
    }

    // Surfaces
    if (!inTrailHold) {
      this.surfaces.render(ctx);
    }

    // Ball
    if (this.ball && this.ball.opacity > 0 && !inTrailHold) {
      this.ball.render(ctx);
    }

    // Gold flash overlay
    this.ringManager.renderFlash(ctx, gameWidth, gameHeight);

    // Score during gameplay
    if (this.state === State.DROPPING || this.state === State.RING_HIT) {
      this.ui.renderScore(ctx, gameWidth, gameHeight, scale, this.scoreManager);
    }

    // Run-end overlay
    if (isRunOver) {
      this.ui.renderRunEnd(ctx, gameWidth, gameHeight, scale, this.scoreManager, this.runEndTimer);
    }
  }

  loop(timestamp) {
    if (this.paused) {
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    let delta = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Cap delta at 3 × PHYSICS_STEP to prevent spiral of death
    delta = Math.min(delta, 3 * PHYSICS_STEP);
    this.accumulated += delta;

    while (this.accumulated >= PHYSICS_STEP) {
      this.gameTime += PHYSICS_STEP;
      this.updatePhysics(PHYSICS_STEP);
      this.accumulated -= PHYSICS_STEP;
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}

new Game();
