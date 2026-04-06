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
      if (!key || !Object.prototype.hasOwnProperty.call(DEFAULTS, key)) continue;

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

  initAIPlayer(aiPlayer) {
    if (!this.overlay) return;
    this._aiPlayer = aiPlayer;

    const providerSelect = this.overlay.querySelector('#ai-provider-select');
    const modelSelect = this.overlay.querySelector('#ai-model-select');
    const modelRow = this.overlay.querySelector('#ai-model-row');
    const customModelInput = this.overlay.querySelector('#ai-custom-model');
    const customModelRow = this.overlay.querySelector('#ai-custom-model-row');
    const customUrlInput = this.overlay.querySelector('#ai-custom-url');
    const customUrlRow = this.overlay.querySelector('#ai-custom-url-row');
    const apiKeyInput = this.overlay.querySelector('#ai-api-key');
    const playToggle = this.overlay.querySelector('#ai-play-toggle');
    const statusEl = this.overlay.querySelector('#ai-status');

    if (!providerSelect || !modelSelect || !apiKeyInput || !playToggle) return;

    // Dynamically import provider list
    const providers = aiPlayer.constructor.getProviders();

    // Populate provider dropdown
    for (const p of providers) {
      const opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = p.label;
      providerSelect.appendChild(opt);
    }
    providerSelect.value = aiPlayer.provider;

    // Show/hide custom provider fields
    const updateCustomVisibility = () => {
      const isCustom = aiPlayer.provider === 'custom';
      if (modelRow) modelRow.hidden = isCustom;
      if (customModelRow) customModelRow.hidden = !isCustom;
      if (customUrlRow) customUrlRow.hidden = !isCustom;
    };
    updateCustomVisibility();

    // Populate model dropdown for current provider
    const populateModels = () => {
      modelSelect.innerHTML = '';
      const prov = providers.find(p => p.key === aiPlayer.provider);
      if (prov) {
        for (const m of prov.models) {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.label;
          modelSelect.appendChild(opt);
        }
      }
      modelSelect.value = aiPlayer.modelId;
    };
    populateModels();

    // Load stored values into inputs
    if (aiPlayer.apiKey) apiKeyInput.value = aiPlayer.apiKey;
    if (customUrlInput && aiPlayer.customUrl) customUrlInput.value = aiPlayer.customUrl;
    if (customModelInput && aiPlayer.provider === 'custom' && aiPlayer.modelId !== 'custom') {
      customModelInput.value = aiPlayer.modelId;
    }

    // Provider change
    providerSelect.addEventListener('change', () => {
      aiPlayer.setProvider(providerSelect.value);
      populateModels();
      updateCustomVisibility();
    });

    // Model change (standard dropdown)
    modelSelect.addEventListener('change', () => {
      aiPlayer.setModel(modelSelect.value);
    });

    // Custom model name input
    if (customModelInput) {
      const saveCustomModel = () => {
        const val = customModelInput.value.trim();
        if (val) aiPlayer.setModel(val);
        this._updateAIStatus(statusEl);
      };
      customModelInput.addEventListener('blur', saveCustomModel);
      customModelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { saveCustomModel(); customModelInput.blur(); }
      });
    }

    // Custom base URL input
    if (customUrlInput) {
      const saveCustomUrl = () => {
        aiPlayer.setCustomUrl(customUrlInput.value);
        this._updateAIStatus(statusEl);
      };
      customUrlInput.addEventListener('blur', saveCustomUrl);
      customUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { saveCustomUrl(); customUrlInput.blur(); }
      });
    }

    // API key save
    const saveKey = () => {
      aiPlayer.setApiKey(apiKeyInput.value);
      this._updateAIStatus(statusEl);
    };
    apiKeyInput.addEventListener('blur', saveKey);
    apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { saveKey(); apiKeyInput.blur(); }
    });

    // Play toggle
    const updateToggle = () => {
      playToggle.textContent = aiPlayer.enabled ? 'ON' : 'OFF';
      playToggle.classList.toggle('active', aiPlayer.enabled);
    };
    updateToggle();

    playToggle.addEventListener('click', () => {
      if (aiPlayer.enabled) {
        aiPlayer.stop();
      } else {
        if (!aiPlayer.isConfigured) {
          if (statusEl) statusEl.textContent = 'Enter an API key first.';
          return;
        }
        aiPlayer.start();
        this.hide();
      }
      updateToggle();
      this._updateAIStatus(statusEl);
    });

    this._aiStatusEl = statusEl;
    this._aiPlayToggle = playToggle;
    this._aiUpdateToggle = updateToggle;
  }

  _updateAIStatus(el) {
    if (!el || !this._aiPlayer) return;
    const ai = this._aiPlayer;
    if (ai.error) {
      el.textContent = ai.error;
    } else if (ai.enabled) {
      el.textContent = 'AI is playing. Tap X to stop.';
    } else if (ai.isConfigured) {
      el.textContent = 'Ready. Toggle ON to let AI play.';
    } else if (ai.provider === 'custom') {
      el.textContent = 'Enter a base URL and model name.';
    } else {
      el.textContent = '';
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

    // Refresh AI player status
    if (this._aiPlayer && this._aiUpdateToggle) {
      this._aiUpdateToggle();
      this._updateAIStatus(this._aiStatusEl);
    }

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

  renderSettingsButton(ctx, gameWidth, gameHeight, scale, menuPulseTime, isFirstVisit) {
    const x = gameWidth / 2;
    const y = gameHeight / 2 + 120 * scale;

    // Clear, readable button — not a hidden icon
    const breathe = 0.35 + 0.1 * Math.sin(menuPulseTime * 1.5 + 1);

    ctx.save();
    ctx.globalAlpha = breathe;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(13 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let label = 'settings';
    if (this.values.aiDemo) label = 'settings · auto-play on';

    ctx.fillText(label, x, y);

    // Underline for button affordance
    const textWidth = ctx.measureText(label).width;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.5 * scale;
    ctx.globalAlpha = breathe * 0.4;
    ctx.beginPath();
    ctx.moveTo(x - textWidth / 2, y + 9 * scale);
    ctx.lineTo(x + textWidth / 2, y + 9 * scale);
    ctx.stroke();

    ctx.restore();
  }

  isSettingsTap(x, y, gameWidth, gameHeight, scale) {
    const bx = gameWidth / 2;
    const by = gameHeight / 2 + 120 * scale;
    const hitW = 80 * scale;
    const hitH = 25 * scale;
    return x > bx - hitW && x < bx + hitW &&
           y > by - hitH && y < by + hitH;
  }

  // --- Exit button during gameplay ---

  renderExitButton(ctx, gameWidth, gameHeight, scale, safeTop) {
    // Top-right corner — offset by safe area for notch/Dynamic Island
    const notchOffset = safeTop || 0;
    const x = gameWidth - 28 * scale;
    const y = 28 * scale + notchOffset;
    const size = 10 * scale;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * scale;
    ctx.lineCap = 'round';

    // X shape for quit
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.stroke();

    ctx.restore();
  }

  isExitTap(x, y, gameWidth, scale, safeTop) {
    const notchOffset = safeTop || 0;
    const ex = gameWidth - 28 * scale;
    const ey = 28 * scale + notchOffset;
    const hitSize = 50 * scale;
    return x > ex - hitSize && x < ex + hitSize &&
           y > ey - hitSize && y < ey + hitSize;
  }
}
