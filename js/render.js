import { CONFIG } from './config.js';

export class Renderer {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.gameWidth = 0;
    this.gameHeight = 0;
    this.scale = 1;

    // Screen shake
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTimer = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    let gw, gh;
    if (vw <= vh) {
      gw = vw;
      gh = vh;
    } else {
      // Landscape — letterbox to portrait
      gh = vh;
      gw = Math.floor(gh * (9 / 16));
    }

    this.gameWidth = gw;
    this.gameHeight = gh;
    this.scale = Math.min(gw, gh) / 375;

    this.canvas.width = Math.round(gw * dpr);
    this.canvas.height = Math.round(gh * dpr);
    this.canvas.style.width = gw + 'px';
    this.canvas.style.height = gh + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  shake() {
    this.shakeTimer = CONFIG.SCREEN_SHAKE_DURATION / 1000;
  }

  updateShake(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const intensity = this.shakeTimer / (CONFIG.SCREEN_SHAKE_DURATION / 1000);
      this.shakeX = (Math.random() * 2 - 1) * CONFIG.SCREEN_SHAKE_PX * this.scale * intensity;
      this.shakeY = (Math.random() * 2 - 1) * CONFIG.SCREEN_SHAKE_PX * this.scale * intensity;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  clear() {
    const { ctx, gameWidth, gameHeight } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, gameHeight);
    grad.addColorStop(0, '#12121a');
    grad.addColorStop(1, CONFIG.BG_COLOR);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
  }

  drawDeathLine() {
    const { ctx, gameWidth, gameHeight } = this;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gameHeight - 0.5);
    ctx.lineTo(gameWidth, gameHeight - 0.5);
    ctx.stroke();
  }
}
