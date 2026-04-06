/**
 * AI Player — connects to LLM APIs to play BOUNCE autonomously.
 *
 * Supports multiple providers: Anthropic (Claude), OpenAI (GPT), Google (Gemini).
 * Player enters their API key and selects a provider/model in settings.
 * The game sends state every ~1.5s and the LLM responds with surface coordinates.
 */

const STORAGE_KEY = 'bounce_ai_config';

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fast)' },
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
    ],
    buildRequest(apiKey, model, systemPrompt, userMsg) {
      return {
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 60,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        }),
      };
    },
    parseResponse(data) {
      return data?.content?.[0]?.text || '';
    },
  },
  openai: {
    label: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
      { id: 'gpt-4o', label: 'GPT-4o' },
    ],
    buildRequest(apiKey, model, systemPrompt, userMsg) {
      return {
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 60,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
        }),
      };
    },
    parseResponse(data) {
      return data?.choices?.[0]?.message?.content || '';
    },
  },
  google: {
    label: 'Google',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash' },
    ],
    buildRequest(apiKey, model, systemPrompt, userMsg) {
      return {
        // Google uses URL-based auth
        urlOverride: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMsg }] }],
          generationConfig: { maxOutputTokens: 60 },
        }),
      };
    },
    parseResponse(data) {
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
  },
};

const SYSTEM_PROMPT = `You are playing BOUNCE, a one-thumb arcade game. A ball falls on screen and you place horizontal surfaces to bounce it through golden rings.

Each turn you receive the game state as JSON. Respond with ONLY a JSON object: {"x": <number>, "y": <number>} — the pixel coordinates where you want to place a surface.

Strategy:
- Place surfaces BELOW the ball to bounce it toward the ring's gap
- The gap direction is given in degrees (0=right, 90=down, -90=up, 180=left)
- Fewer bounces = higher score multiplier
- Surface decays after one hit, so place wisely
- Don't place in dead zones (top 5% or bottom 8% of screen)

Respond with ONLY the JSON coordinates. No explanation.`;

export class AIPlayer {
  constructor() {
    this.provider = 'anthropic';
    this.apiKey = '';
    this.modelId = '';
    this.enabled = false;
    this.thinking = false;
    this.lastCallTime = 0;
    this.callInterval = 1.5;
    this.error = null;
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.apiKey === 'string') this.apiKey = parsed.apiKey;
        if (typeof parsed.provider === 'string' && PROVIDERS[parsed.provider]) this.provider = parsed.provider;
        if (typeof parsed.modelId === 'string') this.modelId = parsed.modelId;
      }
    } catch { /* ignore */ }
    // Default to first model of provider if not set
    if (!this.modelId) {
      this.modelId = PROVIDERS[this.provider].models[0].id;
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        apiKey: this.apiKey,
        provider: this.provider,
        modelId: this.modelId,
      }));
    } catch { /* ignore */ }
  }

  get isConfigured() {
    return this.apiKey.length > 10;
  }

  get providerConfig() {
    return PROVIDERS[this.provider];
  }

  setProvider(provider) {
    if (PROVIDERS[provider]) {
      this.provider = provider;
      this.modelId = PROVIDERS[provider].models[0].id;
      this.error = null;
      this._save();
    }
  }

  setApiKey(key) {
    this.apiKey = key.trim();
    this.error = null;
    this._save();
  }

  setModel(modelId) {
    this.modelId = modelId;
    this._save();
  }

  start() {
    if (!this.isConfigured) return false;
    this.enabled = true;
    this.error = null;
    return true;
  }

  stop() {
    this.enabled = false;
    this.thinking = false;
  }

  /** Call at the start of each run so the first API call fires immediately. */
  resetForRun() {
    this.lastCallTime = -this.callInterval;
    this.thinking = false;
    this.error = null;
  }

  static getProviders() {
    return Object.entries(PROVIDERS).map(([key, p]) => ({
      key,
      label: p.label,
      models: p.models,
    }));
  }

  async update(gameTime, agent) {
    if (!this.enabled || !this.isConfigured) return null;
    if (this.thinking) return null;
    if (gameTime - this.lastCallTime < this.callInterval) return null;

    const state = agent.getState();
    if (state.state !== 'DROPPING' || !state.ball) return null;
    if (state.ball.vy <= 0) return null;

    this.lastCallTime = gameTime;
    this.thinking = true;
    this.error = null;

    try {
      const summary = agent.getSummary();
      const userMsg = JSON.stringify(summary);
      const prov = this.providerConfig;
      const req = prov.buildRequest(this.apiKey, this.modelId, SYSTEM_PROMPT, userMsg);
      const url = req.urlOverride || prov.url;

      const response = await fetch(url, {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.error = 'Invalid API key';
        } else {
          this.error = `API error (${response.status})`;
        }
        this.thinking = false;
        return null;
      }

      const data = await response.json();
      const text = prov.parseResponse(data);

      // Parse JSON coordinates from response
      const match = text.match(/\{\s*"x"\s*:\s*([\d.]+)\s*,\s*"y"\s*:\s*([\d.]+)\s*\}/);
      if (match) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        if (isFinite(x) && isFinite(y)) {
          this.thinking = false;
          return { x, y };
        }
      }

      this.thinking = false;
      return null;
    } catch {
      this.error = 'Network error';
      this.thinking = false;
      return null;
    }
  }
}
