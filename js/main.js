import { CONFIG } from './config.js';
import { Renderer } from './render.js';
import { Ball } from './ball.js';
import { SurfaceManager } from './surface.js';
import { InputManager } from './input.js';
import { UI } from './ui.js';
import { RingManager } from './ring.js';
import { ScoreManager } from './score.js';
import { AudioManager, vibrate as _vibrate } from './audio.js';
import { Leaderboard } from './leaderboard.js';
import { ReplayRecorder, ReplayPlayer } from './replay.js';
import { AIHooks } from './ai-hooks.js';
import { AgentAPI } from './agent.js';
import { LifetimeStats } from './lifetime.js';

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
    this.replayLoading = false;
    this.aiHooks = new AIHooks();
    this.lifetime = new LifetimeStats();
    this.runBounceTotal = 0;
    this.runRingsThreaded = 0;

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

    // Ring approach audio state
    this.approachAudioTriggered = false;

    // Environment state
    this.wind = 0;
    this.windTarget = 0;
    this.windTimer = 0;
    this.gravityPulse = false;
    this.gravityPulseTimer = 0;

    // Menu constellations
    this.constellations = [];
    this.constellationsLoaded = false;
    this.lastTrail = null;
    this.fetchConstellations();

    this.input.onTap = (x, y) => this.handleTap(x, y);
    this.ui.initMenuDust(this.lifetime);
    this.ghostTrails = this.lifetime.generateGhostTrails();

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

    // AI hooks: try to connect to window.BOUNCE_AI if present
    this.aiHooks.connect();

    // Expose Agent API for programmatic play
    window.BounceAgent = new AgentAPI(this);

    requestAnimationFrame((t) => this.loop(t));
  }

  _vibrate(pattern) {
    if (window.BounceAgent && window.BounceAgent.isSilent) return;
    _vibrate(pattern);
  }

  _playAudio(method, ...args) {
    if (window.BounceAgent && window.BounceAgent.isSilent) return;
    this.audio[method](...args);
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
          this.surfaces.place(x, y, this.renderer.scale, this.scoreManager.round, this.renderer.gameWidth);
          this.recorder.recordSurface(x, y, this.gameTime);
          this._playAudio('playPlace', y / this.renderer.gameHeight);
          this._vibrate(CONFIG.PLACE_VIBRATE);
          this.ui.addSurfaceFlash(x, y);
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
    const isPB = this.scoreManager.isNewPersonalBest;
    const saveX = isPB ? gameWidth / 2 : gameWidth - 40 * scale;
    const saveY = isPB ? gameHeight * 0.78 : gameHeight * 0.92;
    const hitW = (isPB ? 110 : 70) * scale;
    const hitH = (isPB ? 40 : 36) * scale;
    return x > saveX - hitW / 2 && x < saveX + hitW / 2 &&
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
    this.ui.triggerTransitionDip();
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
    this.runBounceTotal = 0;
    this.runRingsThreaded = 0;

    // AI hooks + Agent events
    this.aiHooks.connect();
    this.aiHooks.notifyRoundStart(this.scoreManager.round);
    if (window.BounceAgent) {
      window.BounceAgent._emit('roundStart', { round: this.scoreManager.round });
      window.BounceAgent._emit('stateChange', { from: 'MENU', to: 'DROPPING' });
    }
  }

  startNewRound() {
    this._playAudio('playRoundTransition');
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

    // Reset wind for new round
    this.wind = 0;
    this.windTarget = 0;
    this.windTimer = 0;

    // Chance of gravity pulse
    if (this.scoreManager.round >= CONFIG.GRAVITY_PULSE_INTRO_ROUND && Math.random() < CONFIG.GRAVITY_PULSE_CHANCE) {
      this.gravityPulse = true;
      this.gravityPulseTimer = CONFIG.GRAVITY_PULSE_DURATION;
      this.ui.showHint('low gravity!', this.renderer.gameWidth / 2, this.renderer.gameHeight * 0.2);
    }

    this.aiHooks.notifyRoundStart(this.scoreManager.round);
    if (window.BounceAgent) window.BounceAgent._emit('roundStart', { round: this.scoreManager.round });
    this.ui.triggerRoundSweep();

    // Round badge — visible on all rounds from R2+
    if (this.scoreManager.round >= 2) {
      this.ui.triggerRoundBadge(this.scoreManager.round);
    }
  }

  endRun(reason = 'floor') {
    this.state = State.RUN_OVER;
    this.runEndTimer = 0;
    this.runEndInputReady = false;
    this.runDuration = this.gameTime;

    if (reason === 'ring_kill') {
      this._playAudio('playRingKill');
    } else {
      this._playAudio('playEnd');
    }
    this._vibrate(CONFIG.END_VIBRATE);

    if (this.ball) {
      this.ball.alive = false;
      this.ball.freezeTrail(this.gameTime);
    }

    this.surfaces.fadeAll();
    this.scoreManager.checkPersonalBest();

    // Lifetime stats
    this.lifetime.recordRun({
      ringsThreaded: this.runRingsThreaded,
      totalBounces: this.runBounceTotal,
      longestStreak: this.scoreManager.longestStreak,
      round: this.scoreManager.round,
    });

    // AI hooks + Agent events
    const endData = {
      score: this.scoreManager.score,
      round: this.scoreManager.round,
      streak: this.scoreManager.longestStreak,
      duration: this.runDuration,
      reason,
      ringsThreaded: this.runRingsThreaded,
      totalBounces: this.runBounceTotal,
    };
    this.aiHooks.notifyRunEnd(endData);
    if (window.BounceAgent) {
      window.BounceAgent._emit('runEnd', endData);
      window.BounceAgent._emit('stateChange', { from: 'DROPPING', to: 'RUN_OVER' });
    }

    // Save trail for menu ghost
    if (this.ball && this.ball.trail.length > 2) {
      const gw = this.renderer.gameWidth;
      const gh = this.renderer.gameHeight;
      this.lastTrail = this.ball.trail.map(p => ({ x: p.x / gw, y: p.y / gh }));
    }
  }

  handleRingGap(result) {
    const { ring, ringIndex } = result;
    this.ringManager.onRingSuccess(ringIndex, this.ball, this.scoreManager.streak);
    this.ball.brightenTrail();
    this._playAudio('playRingChime', this.scoreManager.streak);
    this.runRingsThreaded++;
    this._vibrate(CONFIG.RING_VIBRATE);

    // Record ring success
    this.recorder.recordRingHit(ringIndex, this.gameTime, true);

    // Capture bounce count before score functions reset it
    const bouncesBeforeRing = this.scoreManager.bounceCount;

    let scoreGain = 0;
    if (this.ringManager.isDualRound) {
      if (ring.isRingA) {
        this.scoreManager.onDualRingASuccess();
      } else {
        scoreGain = this.scoreManager.onDualRingBSuccess();
        this.enterRingHit();
      }
    } else {
      scoreGain = this.scoreManager.onSingleRingSuccess();
      this.enterRingHit();
    }

    // "CLEAN!" if 0 bounces before threading
    const isClean = bouncesBeforeRing === 0;
    // Near-miss: ball passed through but close to edge (proximity < 0.3)
    const isClose = result.gapProximity < 0.3;

    // AI hooks + Agent events
    const ringResultData = {
      success: true, isClean, isClose,
      streak: this.scoreManager.streak,
      score: scoreGain,
      round: this.scoreManager.round,
      gapProximity: result.gapProximity,
    };
    this.aiHooks.notifyRingResult(ringResultData);
    if (window.BounceAgent) window.BounceAgent._emit('ringSuccess', ringResultData);

    if (scoreGain > 0) {
      // Show multiplier breakdown on first 5 ring successes
      const totalRings = this.scoreManager.streak + (this.scoreManager.round - 1);
      const multIdx = Math.min(bouncesBeforeRing, CONFIG.BOUNCE_MULTIPLIERS.length - 1);
      const mult = CONFIG.BOUNCE_MULTIPLIERS[multIdx];
      const showMult = totalRings <= 5 && mult > 1;
      this.ui.addScorePop(ring.cx, ring.cy, scoreGain, this.scoreManager.streak > 1, isClean, showMult ? mult : 0);
    }

    // CLEAN success effect — brief golden pulse
    if (isClean) {
      this.renderer.shake(0.5);
      this.ui.triggerCleanFlash();
    }

    // Near-miss audio shimmer
    if (isClose) {
      this._playAudio('playNearMissShimmer');
    }

    // Near-miss text
    if (isClose && !isClean) {
      this.ui.showHint('CLOSE!', ring.cx, ring.cy - ring.radius - 20 * this.renderer.scale);
    }

    // Ring success particles (escalate with streak)
    this.ui.spawnRingParticles(ring.cx, ring.cy, this.renderer.scale, this.scoreManager.streak);

    // Update trail color based on streak
    if (this.ball) {
      this.ball.setTrailColorForStreak(this.scoreManager.streak);
    }

    // Streak milestone visual
    if (this.scoreManager.streak === 5 || this.scoreManager.streak === 10) {
      this.ui.triggerStreakFlash(this.scoreManager.streak);
    }

    // Score explanation on very first ring success
    if (this.scoreManager.round <= 2 && this.scoreManager.streak === 1) {
      this.ui.showHint('fewer bounces = more points', ring.cx, ring.cy + ring.radius + 25 * this.renderer.scale);
    }

    // Check if we just exceeded personal best mid-run
    if (this.scoreManager.score > this.scoreManager.personalBest && this.scoreManager.personalBest > 0) {
      this.ui.triggerPBFlash();
      this._playAudio('playPBChime');
    }
  }

  handleRingArc(result) {
    result.ring.startShatter(result.collisionX, result.collisionY);
    // Record ring failure
    this.recorder.recordRingHit(result.ringIndex, this.gameTime, false);

    // AI hooks + Agent events
    const failData = {
      success: false, isClean: false, isClose: result.isNearGap,
      streak: this.scoreManager.streak,
      score: 0,
      round: this.scoreManager.round,
    };
    this.aiHooks.notifyRingResult(failData);
    if (window.BounceAgent) window.BounceAgent._emit('ringFail', failData);

    // Near-death: hit the arc but was close to the gap
    if (result.isNearGap) {
      this.ui.showHint('SO CLOSE!', result.ring.cx, result.ring.cy - result.ring.radius - 20 * this.renderer.scale);
    }

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
    this.replayLoading = true;

    const entry = await this.leaderboard.fetchReplayData(entryId);
    this.replayLoading = false;

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
    this.ui.update(dt);
    this.aiHooks.update(dt);

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

        // --- Environment: Wind ---
        if (this.scoreManager.round >= CONFIG.WIND_INTRO_ROUND) {
          this.windTimer += dt;
          if (this.windTimer >= CONFIG.WIND_CHANGE_INTERVAL) {
            this.windTimer = 0;
            this.windTarget = (Math.random() - 0.5) * 2 * CONFIG.WIND_STRENGTH_MAX;
          }
          // Smooth wind transition
          this.wind += (this.windTarget - this.wind) * dt * 2;
          this.ball.windForce = this.wind;
        }

        // --- Environment: Gravity pulse ---
        if (this.gravityPulse) {
          this.gravityPulseTimer -= dt;
          this.ball.envGravityMult = CONFIG.GRAVITY_PULSE_MULT;
          if (this.gravityPulseTimer <= 0) {
            this.gravityPulse = false;
            this.ball.envGravityMult = 1.0;
          }
        }

        this.ball.update(dt);
        this.ball.checkWalls(this.renderer.gameWidth);

        // Wall bounce feedback
        if (this.ball.wallHit) {
          this._playAudio('playWallBounce');
          this.ui.addWallImpact(this.ball.wallHit.x, this.ball.wallHit.y);
        }

        // AI hooks: send state every tick during play
        if (this.aiHooks.isConnected) {
          const aiState = this.aiHooks.buildState(this);
          this.aiHooks.notifyState(aiState);
          this.aiHooks.requestSurfaceHint(aiState, this.gameTime);
          // Request mood every 2 seconds
          if (Math.floor(this.gameTime * 0.5) !== Math.floor((this.gameTime - dt) * 0.5)) {
            this.aiHooks.requestMood();
          }
        }

        if (this.surfaces.checkCollision(this.ball)) {
          const isFirstBounce = this.scoreManager.bounceCount === 0 && this.scoreManager.round <= 2;
          this.scoreManager.onBounce();
          this.runBounceTotal++;
          const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy) / this.ball.scale;
          this._playAudio('playBounce', speed);
          this._vibrate(isFirstBounce ? 30 : CONFIG.BOUNCE_VIBRATE);
          // Speed-scaled shake
          const shakeIntensity = Math.min(speed / 600, 2.0);
          this.renderer.shake(isFirstBounce ? 2.0 : shakeIntensity);

          // First-bounce encouragement on R1
          if (isFirstBounce) {
            this.ui.showHint('nice!', this.ball.x, this.ball.y - this.ball.radius - 20 * this.renderer.scale);
          }

          // AI + Agent notifications
          const bounceData = { x: this.ball.x, y: this.ball.y, vx: this.ball.vx, vy: this.ball.vy, speed, bounceCount: this.scoreManager.bounceCount };
          this.aiHooks.notifyBounce(bounceData);
          if (window.BounceAgent) window.BounceAgent._emit('bounce', bounceData);
        }

        this.ball.addTrailPoint(this.gameTime);
        // Record ball position for replay (at same sample rate as trail)
        if (this.ball.trailCounter % CONFIG.REPLAY_SAMPLE_RATE === 0 && this.ball.alive) {
          this.recorder.recordBall(this.ball.x, this.ball.y, this.gameTime);
        }
        this.ball.updateTrail(this.gameTime);
        this.surfaces.update(dt);

        // Ring approach audio cue
        const activeRings = this.ringManager.rings.filter(r => r.active && r.gapRevealed);
        if (activeRings.length > 0 && this.ball) {
          const ring = activeRings[0];
          const dx = this.ball.x - ring.cx;
          const dy = this.ball.y - ring.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = CONFIG.RING_APPROACH_DISTANCE * this.renderer.scale;
          const approachFactor = Math.max(0, 1 - dist / maxDist);
          if (approachFactor > 0.5 && !this.approachAudioTriggered) {
            this.approachAudioTriggered = true;
            this._playAudio('playApproachTone', approachFactor);
          } else if (approachFactor < 0.2) {
            this.approachAudioTriggered = false;
          }
        }

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
          this.ui.addDeathSplash(this.ball.x, this.renderer.gameHeight, this.ball.trailColor);
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
          // Trail art: gradually brighten frozen trail
          if (this.ball.trailFrozen) {
            this.ball.updateTrailArt(dt);
          }
        }

        // Faster restart on round 1 — skip trail hold (nothing to admire)
        const trailHold = this.scoreManager.round <= 1 ? 0.2 : CONFIG.RUN_END_TRAIL_HOLD;
        const totalLock = CONFIG.RUN_END_PAUSE + trailHold +
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

    this.renderer.clear(this.scoreManager.round);
    this.renderer.drawVignette(this.scoreManager.round);

    if (this.state === State.MENU || this.state === State.LEADERBOARD) {
      // Render ghost trail from last run
      if (this.lastTrail && this.lastTrail.length > 1) {
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = CONFIG.BALL_COLOR;
        ctx.lineWidth = CONFIG.TRAIL_WIDTH * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.lastTrail[0].x * gameWidth, this.lastTrail[0].y * gameHeight);
        for (let i = 1; i < this.lastTrail.length; i++) {
          ctx.lineTo(this.lastTrail[i].x * gameWidth, this.lastTrail[i].y * gameHeight);
        }
        ctx.stroke();
        ctx.restore();
      }
      // Render ghost trails and constellations behind menu
      this.renderGhostTrails(ctx, gameWidth, gameHeight);
      this.renderConstellations(ctx, gameWidth, gameHeight);
      this.ui.renderMenu(ctx, gameWidth, gameHeight, scale, this.scoreManager.personalBest, this.lifetime);
      ctx.restore();
      return;
    }

    if (this.state === State.REPLAY) {
      if (this.replayLoading) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(14 * scale)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Loading replay...', gameWidth / 2, gameHeight / 2);
        ctx.restore();
      } else {
        this.replayPlayer.render(ctx, gameWidth, gameHeight, scale);
      }
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
      this.ringManager.renderRings(ctx, this.ball);
    }

    if (!inTrailHold) {
      this.surfaces.render(ctx);
    }

    if (this.ball && this.ball.opacity > 0 && !inTrailHold) {
      this.ball.render(ctx);
    }

    this.ringManager.renderFlash(ctx, gameWidth, gameHeight);
    this.ui.renderStreakFlash(ctx, gameWidth, gameHeight);
    this.ui.renderRoundSweep(ctx, gameWidth, gameHeight);
    this.ui.renderRoundBadge(ctx, gameWidth, gameHeight, scale);
    this.ui.renderCleanFlash(ctx, gameWidth, gameHeight);

    // Surface flashes
    if (!inTrailHold) {
      this.ui.renderSurfaceFlashes(ctx, scale);
      this.ui.renderWallImpacts(ctx, scale);
    }

    // Death splashes
    this.ui.renderDeathSplashes(ctx, scale);

    // Particles (ring success)
    this.ui.renderParticles(ctx, scale);

    // Hints
    this.ui.renderHints(ctx, scale);

    // AI overlay
    if (this.aiHooks.isConnected) {
      // Connection indicator — subtle blue dot top-right
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#88ccff';
      ctx.beginPath();
      ctx.arc(gameWidth - 12 * scale, 12 * scale, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Commentary text
      const commentary = this.aiHooks.getCommentary();
      if (commentary) {
        ctx.save();
        ctx.globalAlpha = Math.min(this.aiHooks._commentaryTimer / 0.3, 1) * 0.5;
        ctx.fillStyle = '#88ccff';
        ctx.font = `${Math.round(11 * scale)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(commentary, gameWidth / 2, 40 * scale);
        ctx.restore();
      }

      // AI surface hint ghost
      const hint = this.aiHooks.getSurfaceHint();
      if (hint && (this.state === State.DROPPING || this.state === State.RING_HIT)) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        const halfLen = (CONFIG.SURFACE_LENGTH * scale) / 2;
        ctx.beginPath();
        ctx.moveTo(hint.x - halfLen, hint.y);
        ctx.lineTo(hint.x + halfLen, hint.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // AI mood tint
      const mood = this.aiHooks.getMood();
      if (mood) {
        ctx.save();
        ctx.globalAlpha = mood.intensity;
        ctx.fillStyle = `rgb(${mood.r},${mood.g},${mood.b})`;
        ctx.fillRect(0, 0, gameWidth, gameHeight);
        ctx.restore();
      }
    }

    if (this.state === State.DROPPING || this.state === State.RING_HIT) {
      this.ui.renderScore(ctx, gameWidth, gameHeight, scale, this.scoreManager);
      // Bounce multiplier preview
      this.ui.renderBounceMultiplier(ctx, this.ball, scale, this.scoreManager.bounceCount);

      // Wind indicator
      if (Math.abs(this.wind) > 5) {
        ctx.save();
        const windAlpha = Math.min(Math.abs(this.wind) / CONFIG.WIND_STRENGTH_MAX, 1) * 0.2;
        ctx.globalAlpha = windAlpha;
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 1;
        const windDir = this.wind > 0 ? 1 : -1;
        const windX = gameWidth / 2 + windDir * 30 * scale;
        const windY = 8 * scale;
        for (let i = 0; i < 3; i++) {
          const ox = (i - 1) * 12 * scale;
          ctx.beginPath();
          ctx.moveTo(windX + ox - windDir * 6 * scale, windY);
          ctx.lineTo(windX + ox + windDir * 6 * scale, windY);
          ctx.lineTo(windX + ox + windDir * 3 * scale, windY - 3 * scale);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Ball type indicator
      if (this.ball && this.ball.ballType !== 'standard' && this.scoreManager.round >= CONFIG.BALL_TYPE_INTRO_ROUND) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(10 * scale)}px monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(this.ball.ballType, gameWidth - 12 * scale, 20 * scale);
        ctx.restore();
      }

      // Gravity pulse indicator
      if (this.gravityPulse) {
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.05 * Math.sin(this.gameTime * 6);
        ctx.fillStyle = '#aabbff';
        ctx.font = `${Math.round(10 * scale)}px monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('low-g', gameWidth - 12 * scale, 32 * scale);
        ctx.restore();
      }
      // Hint text on round 1
      if (this.scoreManager.round === 1 && this.ringManager.rings.length > 0) {
        const ring = this.ringManager.rings[0];
        if (ring.active) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = '#ffffff';
          ctx.font = `${Math.round(12 * scale)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText('thread the ring', ring.cx, ring.cy - ring.radius - 10 * scale);
          ctx.restore();
        }
      }
    }

    if (isRunOver) {
      this.ui.renderRunEnd(ctx, gameWidth, gameHeight, scale, this.scoreManager, this.runEndTimer, this.lifetime);
    }

    ctx.restore();

    // Transition dip
    this.ui.renderTransitionDip(ctx, gameWidth, gameHeight);

    // Pause overlay (rendered outside screen shake transform)
    if (this.paused && this.state !== State.MENU) {
      this.ui.renderPauseOverlay(ctx, gameWidth, gameHeight, scale, this.scoreManager);
    }
  }

  renderGhostTrails(ctx, gameWidth, gameHeight) {
    if (!this.ghostTrails || this.ghostTrails.length === 0) return;

    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = CONFIG.BALL_COLOR;
    ctx.lineWidth = CONFIG.TRAIL_WIDTH * this.renderer.scale;
    ctx.lineCap = 'round';

    for (const trail of this.ghostTrails) {
      if (trail.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(trail[0].x * gameWidth, trail[0].y * gameHeight);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x * gameWidth, trail[i].y * gameHeight);
      }
      ctx.stroke();
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

    // Agent speed multiplier for training
    const agentSpeed = (window.BounceAgent && window.BounceAgent.speedMultiplier) || 1;
    delta *= agentSpeed;

    delta = Math.min(delta, 6 * PHYSICS_STEP);
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
