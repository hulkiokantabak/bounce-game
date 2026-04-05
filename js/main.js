import { CONFIG } from './config.js';
import { Renderer } from './render.js';
import { Ball } from './ball.js';
import { SurfaceManager } from './surface.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { RingManager } from './ring.js';
import { ScoreManager } from './score.js';
import { AudioManager, vibrate } from './audio.js';
import { Leaderboard } from './leaderboard.js';
import { ReplayRecorder, ReplayPlayer } from './replay.js';

const State = {
  MENU: 'MENU',
  DROPPING: 'DROPPING',
  RING_HIT: 'RING_HIT',
  RUN_OVER: 'RUN_OVER',
  LEADERBOARD: 'LEADERBOARD',
  REPLAY: 'REPLAY',
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
    this.audio = new AudioManager();
    this.leaderboard = new Leaderboard();
    this.recorder = new ReplayRecorder();
    this.replayPlayer = new ReplayPlayer();

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
    this.runDuration = 0;

    // Menu constellations
    this.constellations = [];
    this.constellationsLoaded = false;
    this.fetchConstellations();

    this.input.onTap = (x, y) => this.handleTap(x, y);

    // Leaderboard replay callback
    this.leaderboard.onReplayRequest = (entryId) => this.startReplay(entryId);

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
    this.audio.init();

    switch (this.state) {
      case State.MENU:
        if (this.ui.isLeaderboardIconTap(x, y, this.renderer)) {
          this.state = State.LEADERBOARD;
          this.leaderboard.onClose = () => { this.state = State.MENU; };
          this.leaderboard.show();
        } else {
          this.startNewRun();
        }
        break;

      case State.DROPPING:
      case State.RING_HIT:
        if (!this.isInDeadZone(y)) {
          this.surfaces.place(x, y, this.renderer.scale);
          this.recorder.recordSurface(x, y, this.gameTime);
          this.audio.playPlace();
          vibrate(CONFIG.PLACE_VIBRATE);
        }
        break;

      case State.RUN_OVER:
        if (this.runEndInputReady) {
          if (this.isSaveTap(x, y)) {
            this.handleSaveTap();
          } else {
            this.startNewRun();
          }
        }
        break;

      case State.LEADERBOARD:
        // Handled by gallery DOM events
        break;

      case State.REPLAY:
        this.handleReplayTap(x, y);
        break;
    }
  }

  handleReplayTap(x, y) {
    const { gameWidth, gameHeight, scale } = this.renderer;
    const margin = 16 * scale;
    const controlSize = 30 * scale;

    // Play/pause — top-left area
    if (x < margin + controlSize && y < margin + controlSize) {
      this.replayPlayer.togglePlay();
      return;
    }

    // Speed — top-right area
    if (x > gameWidth - margin - controlSize && y < margin + controlSize) {
      this.replayPlayer.cycleSpeed();
      return;
    }

    // If replay finished, tap anywhere to return
    if (this.replayPlayer.finished) {
      this.state = State.MENU;
      this.fetchConstellations();
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

  handleSaveTap() {
    const runData = {
      score: this.scoreManager.score,
      rounds: this.scoreManager.round,
      longestStreak: this.scoreManager.longestStreak,
      duration: this.runDuration,
      trail: this.ball ? this.ball.trail : [],
      trailData: this.recorder.getData(),
      gameWidth: this.renderer.gameWidth,
      gameHeight: this.renderer.gameHeight,
    };

    this.leaderboard.onSaveComplete = () => {
      this.startNewRun();
    };
    this.leaderboard.startSaveFlow(runData);
  }

  startNewRun() {
    this.scoreManager.reset();
    this.surfaces.clear();
    this.ringManager.clear();
    this.scoreManager.nextRound();

    const { gameWidth, gameHeight, scale } = this.renderer;
    this.recorder.start(gameWidth, gameHeight);

    const speedMult = this.ringManager.getSpeedCurve(this.scoreManager.round);
    this.ball = new Ball(gameWidth, gameHeight, scale, this.scoreManager.round, speedMult);
    this.ringManager.spawnForRound(this.scoreManager.round, gameWidth, gameHeight, scale);

    // Record initial ring spawns
    for (let i = 0; i < this.ringManager.rings.length; i++) {
      this.recorder.recordRingSpawn(this.ringManager.rings[i], 0, i);
    }

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

    // Record ring spawns for new round
    for (let i = 0; i < this.ringManager.rings.length; i++) {
      this.recorder.recordRingSpawn(this.ringManager.rings[i], this.gameTime, i);
    }

    this.state = State.DROPPING;
  }

  endRun(reason = 'floor') {
    this.state = State.RUN_OVER;
    this.runEndTimer = 0;
    this.runEndInputReady = false;
    this.runDuration = this.gameTime;

    if (reason === 'ring_kill') {
      this.audio.playRingKill();
    } else {
      this.audio.playEnd();
    }
    vibrate(CONFIG.END_VIBRATE);

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
    this.audio.playRingChime();
    vibrate(CONFIG.RING_VIBRATE);

    // Record ring success
    this.recorder.recordRingHit(ringIndex, this.gameTime, true);

    if (this.ringManager.isDualRound) {
      if (ring.isRingA) {
        this.scoreManager.onDualRingASuccess();
      } else {
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
    // Record ring failure
    this.recorder.recordRingHit(result.ringIndex, this.gameTime, false);
    this.endRun('ring_kill');
  }

  enterRingHit() {
    this.state = State.RING_HIT;
    this.ringHitTimer = 0;
  }

  // --- Replay ---

  async startReplay(entryId) {
    // Suppress onClose callback — we're going to REPLAY, not MENU
    const prevOnClose = this.leaderboard.onClose;
    this.leaderboard.onClose = null;
    this.leaderboard.hide();
    this.leaderboard.onClose = prevOnClose;
    this.state = State.REPLAY;

    const entry = await this.leaderboard.fetchReplayData(entryId);
    if (!entry || !entry.trail_data || !entry.trail_data.ball) {
      this.state = State.MENU;
      return;
    }

    const { gameWidth, gameHeight } = this.renderer;
    this.replayPlayer.load(entry.trail_data, entry.duration || 30, gameWidth, gameHeight);
  }

  // --- Menu Constellations ---

  async fetchConstellations() {
    if (!this.leaderboard.isConfigured) {
      this.constellations = [];
      this.constellationsLoaded = true;
      return;
    }

    try {
      const url = new URL(`${CONFIG.SUPABASE_URL}/rest/v1/bounce_runs`);
      url.searchParams.set('select', 'trail_image');
      url.searchParams.set('order', 'created_at.desc');
      url.searchParams.set('limit', String(CONFIG.MENU_TRAIL_COUNT));

      const res = await fetch(url, {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
      });

      if (!res.ok) { this.constellations = []; return; }
      const data = await res.json();
      if (!Array.isArray(data)) { this.constellations = []; return; }

      this.constellations = [];
      for (const entry of data) {
        if (entry.trail_image && typeof entry.trail_image === 'string' && entry.trail_image.startsWith('data:image/')) {
          const img = new Image();
          img.src = entry.trail_image;
          this.constellations.push({
            img,
            x: 0.15 + Math.random() * 0.7,
            y: 0.1 + Math.random() * 0.5,
            drift: (Math.random() - 0.5) * CONFIG.MENU_TRAIL_DRIFT_SPEED,
            driftY: (Math.random() - 0.5) * CONFIG.MENU_TRAIL_DRIFT_SPEED * 0.3,
          });
        }
      }
      this.constellationsLoaded = true;
    } catch {
      this.constellations = [];
      this.constellationsLoaded = true;
    }
  }

  // --- Physics ---

  updatePhysics(dt) {
    this.scoreManager.update(dt);
    this.ringManager.update(dt);
    this.renderer.updateShake(dt);

    switch (this.state) {
      case State.MENU:
        this.ui.updateMenu(dt);
        // Drift constellations
        for (const c of this.constellations) {
          c.x += c.drift * dt * 0.01;
          c.y += c.driftY * dt * 0.01;
          // Wrap around
          if (c.x < -0.1) c.x = 1.1;
          if (c.x > 1.1) c.x = -0.1;
        }
        break;

      case State.DROPPING:
        if (!this.ball) break;

        this.ball.update(dt);
        this.ball.checkWalls(this.renderer.gameWidth);

        if (this.surfaces.checkCollision(this.ball)) {
          this.scoreManager.onBounce();
          const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy) / this.ball.scale;
          this.audio.playBounce(speed);
          vibrate(CONFIG.BOUNCE_VIBRATE);
          this.renderer.shake();
        }

        this.ball.addTrailPoint(this.gameTime);
        // Record ball position for replay (at same sample rate as trail)
        if (this.ball.trailCounter % CONFIG.REPLAY_SAMPLE_RATE === 0 && this.ball.alive) {
          this.recorder.recordBall(this.ball.x, this.ball.y, this.gameTime);
        }
        this.ball.updateTrail(this.gameTime);
        this.surfaces.update(dt);

        const ringResult = this.ringManager.checkCollision(this.ball);
        if (ringResult) {
          if (ringResult.type === 'gap') {
            this.handleRingGap(ringResult);
          } else {
            this.handleRingArc(ringResult);
          }
          break;
        }

        if (this.ball.checkFloor(this.renderer.gameHeight)) {
          this.endRun('floor');
        }

        if (this.gameTime >= CONFIG.MAX_RUN_DURATION) {
          this.endRun('floor');
        }
        break;

      case State.RING_HIT:
        this.ringHitTimer += dt;
        this.surfaces.update(dt);

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

        if (this.ball && this.runEndTimer < CONFIG.RUN_END_PAUSE) {
          this.ball.opacity = Math.max(0, 1 - this.runEndTimer / CONFIG.RUN_END_PAUSE);
        } else if (this.ball) {
          this.ball.opacity = 0;
        }

        const totalLock = CONFIG.RUN_END_PAUSE + CONFIG.RUN_END_TRAIL_HOLD +
          CONFIG.RUN_END_SCORE_FADE + CONFIG.RUN_END_PROMPT_DELAY;
        if (!this.runEndInputReady && this.runEndTimer >= totalLock) {
          this.runEndInputReady = true;
        }
        break;

      case State.REPLAY:
        this.replayPlayer.update(dt);
        if (this.replayPlayer.finished) {
          // Stay in REPLAY state — tap to exit handled in handleReplayTap
        }
        break;
    }
  }

  render() {
    const { ctx, gameWidth, gameHeight, scale } = this.renderer;

    // Apply screen shake
    ctx.save();
    ctx.translate(this.renderer.shakeX, this.renderer.shakeY);

    this.renderer.clear();

    if (this.state === State.MENU || this.state === State.LEADERBOARD) {
      // Render constellations behind menu
      this.renderConstellations(ctx, gameWidth, gameHeight);
      this.ui.renderMenu(ctx, gameWidth, gameHeight, scale, this.scoreManager.personalBest);
      ctx.restore();
      return;
    }

    if (this.state === State.REPLAY) {
      this.replayPlayer.render(ctx, gameWidth, gameHeight, scale);
      ctx.restore();
      return;
    }

    const isRunOver = this.state === State.RUN_OVER;
    const inTrailHold = isRunOver && this.runEndTimer >= CONFIG.RUN_END_PAUSE;

    if (!inTrailHold) {
      this.renderer.drawDeathLine();
    }

    if (this.ball) {
      this.ball.renderTrail(ctx, this.gameTime);
    }

    if (isRunOver) {
      if (!inTrailHold) {
        this.ringManager.renderShatterOnly(ctx);
      }
    } else {
      this.ringManager.renderRings(ctx);
    }

    if (!inTrailHold) {
      this.surfaces.render(ctx);
    }

    if (this.ball && this.ball.opacity > 0 && !inTrailHold) {
      this.ball.render(ctx);
    }

    this.ringManager.renderFlash(ctx, gameWidth, gameHeight);

    if (this.state === State.DROPPING || this.state === State.RING_HIT) {
      this.ui.renderScore(ctx, gameWidth, gameHeight, scale, this.scoreManager);
    }

    if (isRunOver) {
      this.ui.renderRunEnd(ctx, gameWidth, gameHeight, scale, this.scoreManager, this.runEndTimer);
    }

    ctx.restore();
  }

  renderConstellations(ctx, gameWidth, gameHeight) {
    if (this.constellations.length === 0) return;

    const size = CONFIG.TRAIL_THUMBNAIL_SIZE;

    ctx.save();
    ctx.globalAlpha = CONFIG.MENU_TRAIL_OPACITY;

    for (const c of this.constellations) {
      if (!c.img.complete || !c.img.naturalWidth) continue;
      const drawX = c.x * gameWidth - size / 2;
      const drawY = c.y * gameHeight - size / 2;
      ctx.drawImage(c.img, drawX, drawY, size, size);
    }

    ctx.restore();
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
