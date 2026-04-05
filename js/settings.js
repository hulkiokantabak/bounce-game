/**
 * Settings — manages player preferences and the settings UI panel.
 *
 * Persists to localStorage. Controls sound, haptics, AI demo mode.
 * The settings gear icon is rendered on the menu canvas.
 * The panel itself is a DOM overlay (#settings-overlay).
 */

const STORAGE_KEY = 'bounce_settings';

const DEFAULTS = {
  sound: true,
  haptics: true,
  aiDemo: false,
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS, ...this._load() };

    this.overlay = document.getElementById('settings-overlay');
    this.isOpen = false;
    this._onClose = null;

    this._initDOM();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Only accept known keys with correct types
        const result = {};
        for (const key of Object.keys(DEFAULTS)) {
          if (typeof parsed[key] === typeof DEFAULTS[key]) {
            result[key] = parsed[key];
          }
        }
        return result;
      }
    } catch { /* ignore */ }
    return {};
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch { /* ignore */ }
  }

  _initDOM() {
    if (!this.overlay) return;

    // Close button
    const closeBtn = this.overlay.querySelector('.settings-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Toggle buttons
    const toggles = this.overlay.querySelectorAll('.settings-toggle');
    for (const btn of toggles) {
      const key = btn.dataset.setting;
      if (!key) continue;

      // Set initial state
      this._updateToggleButton(btn, key);

      btn.addEventListener('click', () => {
        this.values[key] = !this.values[key];
        this._updateToggleButton(btn, key);
        this._save();
      });
    }

    // Player name input
    const nameInput = this.overlay.querySelector('#settings-player-name');
    if (nameInput) {
      // Load existing name
      try {
        const stored = localStorage.getItem('bounce_player_name');
        if (stored) nameInput.value = stored;
      } catch { /* ignore */ }

      // Save on blur or Enter
      const saveName = () => {
        const name = nameInput.value.replace(/[\x00-\x1f\x7f]/g, '').trim().substring(0, 20);
        if (name) {
          try { localStorage.setItem('bounce_player_name', name); } catch {}
        }
      };
      nameInput.addEventListener('blur', saveName);
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { saveName(); nameInput.blur(); }
      });
    }

    // Try-it buttons
    const tryItBtns = this.overlay.querySelectorAll('.settings-tryit');
    const outputEl = this.overlay.querySelector('#tryit-output');
    for (const btn of tryItBtns) {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this._handleTryIt(action, outputEl);
      });
    }
  }

  _handleTryIt(action, outputEl) {
    const agent = window.BounceAgent;
    if (!agent) {
      this._showOutput(outputEl, 'Game not loaded yet. Close settings and try again.');
      return;
    }

    switch (action) {
      case 'startRun':
        this.hide();
        setTimeout(() => {
          agent.startRun();
        }, 100);
        break;

      case 'aiDemo':
        this.values.aiDemo = true;
        this._save();
        // Update the toggle button if visible
        const aiBtn = this.overlay.querySelector('[data-setting="aiDemo"]');
        if (aiBtn) this._updateToggleButton(aiBtn, 'aiDemo');
        this.hide();
        break;

      case 'showState': {
        const summary = agent.getSummary();
        const text = JSON.stringify(summary, null, 2);
        this._showOutput(outputEl, text);
        break;
      }
    }
  }

  _showOutput(el, text) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
  }

  _updateToggleButton(btn, key) {
    const isOn = this.values[key];
    btn.textContent = isOn ? 'ON' : 'OFF';
    btn.classList.toggle('active', isOn);
  }

  show(onClose) {
    if (!this.overlay) return;
    this._onClose = onClose || null;

    // Refresh name input
    const nameInput = this.overlay.querySelector('#settings-player-name');
    if (nameInput) {
      try {
        const stored = localStorage.getItem('bounce_player_name');
        if (stored) nameInput.value = stored;
      } catch {}
    }

    // Hide try-it output
    const outputEl = this.overlay.querySelector('#tryit-output');
    if (outputEl) outputEl.classList.add('hidden');

    this.overlay.classList.remove('hidden');
    this.isOpen = true;
  }

  hide() {
    if (!this.overlay) return;
    this.overlay.classList.add('hidden');
    this.isOpen = false;
    if (this._onClose) {
      this._onClose();
      this._onClose = null;
    }
  }

  get soundEnabled() { return this.values.sound; }
  get hapticsEnabled() { return this.values.haptics; }
  get aiDemoEnabled() { return this.values.aiDemo; }

  // --- Canvas rendering: gear icon on menu ---

  renderGearIcon(ctx, gameWidth, gameHeight, scale, menuPulseTime, isFirstVisit) {
    const x = 30 * scale;
    const y = gameHeight - 30 * scale;
    const r = 10 * scale;

    // Brighter on first visit to draw attention
    const baseAlpha = isFirstVisit ? 0.35 : 0.2;
    const breathe = baseAlpha + 0.1 * Math.sin(menuPulseTime * 1.5 + 1);

    ctx.save();
    ctx.globalAlpha = breathe;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * scale;

    // Gear shape — circle with notches
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Gear teeth
    const teeth = 6;
    for (let i = 0; i < teeth; i++) {
      const angle = (Math.PI * 2 / teeth) * i;
      const ix = x + Math.cos(angle) * r * 0.35;
      const iy = y + Math.sin(angle) * r * 0.35;
      const ox = x + Math.cos(angle) * r * 0.75;
      const oy = y + Math.sin(angle) * r * 0.75;
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ox, oy);
      ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = breathe * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();

    // AI demo active indicator — blue dot
    if (this.values.aiDemo) {
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(menuPulseTime * 3);
      ctx.fillStyle = '#88ccff';
      ctx.beginPath();
      ctx.arc(x + r * 0.7, y - r * 0.7, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  isGearTap(x, y, gameWidth, gameHeight, scale) {
    const gx = 30 * scale;
    const gy = gameHeight - 30 * scale;
    const hitSize = 30 * scale;
    return x > gx - hitSize && x < gx + hitSize &&
           y > gy - hitSize && y < gy + hitSize;
  }
}
