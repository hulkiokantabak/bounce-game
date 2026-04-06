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

    // Read CSS safe-area insets for notch / Dynamic Island handling
    const cs = getComputedStyle(document.documentElement);
    this.safeTop = parseFloat(cs.getPropertyValue('--sat')) || 0;
    this.safeBottom = parseFloat(cs.getPropertyValue('--sab')) || 0;

    this.canvas.width = Math.round(gw * dpr);
    this.canvas.height = Math.round(gh * dpr);
    this.canvas.style.width = gw + 'px';
    this.canvas.style.height = gh + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  shake(intensity) {
    this.shakeTimer = CONFIG.SCREEN_SHAKE_DURATION / 1000;
    this.shakeIntensity = intensity || 1.0;
  }

  updateShake(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const intensity = this.shakeTimer / (CONFIG.SCREEN_SHAKE_DURATION / 1000);
      this.shakeX = (Math.random() * 2 - 1) * CONFIG.SCREEN_SHAKE_PX * this.scale * intensity * (this.shakeIntensity || 1);
      this.shakeY = (Math.random() * 2 - 1) * CONFIG.SCREEN_SHAKE_PX * this.scale * intensity * (this.shakeIntensity || 1);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  clear(round) {
    const { ctx, gameWidth, gameHeight } = this;

    // Background warms subtly with progression
    let bgBottom = CONFIG.BG_COLOR;
    let bgTop = '#12121a';
    if (round >= CONFIG.BG_WARM_START_ROUND) {
      const t = Math.min((round - CONFIG.BG_WARM_START_ROUND) / (CONFIG.BG_WARM_FULL_ROUND - CONFIG.BG_WARM_START_ROUND), 1);
      bgBottom = this._lerpColor(CONFIG.BG_COLOR, CONFIG.BG_COLOR_WARM, t);
      bgTop = this._lerpColor('#12121a', '#14111e', t);
    }

    const grad = ctx.createLinearGradient(0, 0, 0, gameHeight);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
  }

  _lerpColor(a, b, t) {
    const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
  }

  drawVignette(round) {
    if (round < CONFIG.VIGNETTE_START_ROUND) return;
    const { ctx, gameWidth, gameHeight } = this;
    const cx = gameWidth / 2;
    const cy = gameHeight / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);

    const grad = ctx.createRadialGradient(cx, cy, maxR * 0.6, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${CONFIG.VIGNETTE_OPACITY})`);

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    ctx.restore();
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
