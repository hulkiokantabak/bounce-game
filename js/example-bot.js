/**
 * Example Bot — demonstrates the BounceAgent API with a simple random-play strategy.
 *
 * This bot is NOT loaded by the game. To use it:
 *
 *   1. Open the game in a browser
 *   2. Open DevTools console
 *   3. Run:  import('/js/example-bot.js')
 *
 * Or from Puppeteer/Playwright:
 *
 *   await page.addScriptTag({ url: '/js/example-bot.js', type: 'module' });
 *
 * The bot will:
 *   - Start a run automatically
 *   - Place surfaces when the ball is falling
 *   - Nudge placement toward the ring gap
 *   - Restart after each run ends
 *   - Log decisions to the console
 *
 * Stop the bot:
 *   window.exampleBot.stop()
 */

class ExampleBot {
  constructor() {
    this.agent = window.BounceAgent;
    this.running = false;
    this._interval = null;
    this._unsubRunEnd = null;

    if (!this.agent) {
      console.error('[ExampleBot] window.BounceAgent not found. Is the game loaded?');
      return;
    }

    console.log('[ExampleBot] Starting. Stop with: window.exampleBot.stop()');
    this.start();
  }

  start() {
    this.running = true;
    this.agent.setSilent(true);

    // Auto-restart on run end
    this._unsubRunEnd = this.agent.on('runEnd', () => {
      setTimeout(() => {
        if (this.running && this.agent.canRestart()) {
          this.agent.startRun();
        }
      }, 500);
    });

    // Start first run
    if (this.agent.canRestart()) {
      this.agent.startRun();
    }

    // Decision loop at ~10Hz
    this._interval = setInterval(() => this._tick(), 100);
  }

  stop() {
    this.running = false;
    if (this._interval) clearInterval(this._interval);
    if (this._unsubRunEnd) this._unsubRunEnd();
    this.agent.setSilent(false);
    console.log('[ExampleBot] Stopped.');
  }

  _tick() {
    if (!this.running || !this.agent.isPlaying()) return;

    const ball = this.agent.getBall();
    if (!ball || !ball.alive || ball.vy <= 0) return; // only act when falling

    const dims = this.agent.getDimensions();
    const rings = this.agent.getRings();
    const config = this.agent.getConfig();

    // Predict where ball will be in ~0.4s
    const pred = this.agent.predictBall(0.4);
    if (!pred) return;

    let placeX = pred.x;
    let placeY = pred.y + 40 * config.scale;

    // Nudge toward ring if one exists
    if (rings.length > 0) {
      const ring = rings[0];
      const dx = ring.cx - placeX;
      placeX += dx * 0.3; // gentle nudge
    }

    // Clamp to screen
    placeX = Math.max(30, Math.min(dims.width - 30, placeX));
    placeY = Math.max(dims.height * 0.1, Math.min(dims.height * 0.9, placeY));

    // Validate before placing
    const check = this.agent.validatePlacement(placeX, placeY);
    if (!check.valid) return;

    // Add some randomness (it's a demo, not a pro)
    placeX += (Math.random() - 0.5) * 40;

    this.agent.placeSurface(placeX, placeY);
  }
}

// Auto-start when imported
window.exampleBot = new ExampleBot();
