/**
 * AI Player — connects to LLM APIs to play BOUNCE autonomously.
 *
 * Supports Anthropic, OpenAI, Google, Groq, Mistral, DeepSeek, xAI, and any
 * Custom OpenAI-compatible endpoint (Ollama, LM Studio, Together.ai, etc.).
 * Player enters their API key and selects a provider/model in settings.
 * The game sends state every ~0.4s and the LLM responds with surface coordinates.
 */

const STORAGE_KEY = 'bounce_ai_config';

// Shared OpenAI-compatible request builder — used by OpenAI, Groq, Mistral, DeepSeek, xAI, Custom
function _oaiRequest(apiKey, model, systemPrompt, userMsg) {
  return {
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 25,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
    }),
  };
}

function _oaiParse(data) {
  return data?.choices?.[0]?.message?.content || '';
}

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
          max_tokens: 25,
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
    buildRequest: _oaiRequest,
    parseResponse: _oaiParse,
  },
  groq: {
    label: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: [
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fastest)' },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
    buildRequest: _oaiRequest,
    parseResponse: _oaiParse,
  },
  mistral: {
    label: 'Mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    models: [
      { id: 'mistral-small-latest', label: 'Mistral Small (fast)' },
      { id: 'mistral-large-latest', label: 'Mistral Large' },
    ],
    buildRequest: _oaiRequest,
    parseResponse: _oaiParse,
  },
  deepseek: {
    label: 'DeepSeek',
    url: 'https://api.deepseek.com/chat/completions',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V3' },
    ],
    buildRequest: _oaiRequest,
    parseResponse: _oaiParse,
  },
  xai: {
    label: 'xAI / Grok',
    url: 'https://api.x.ai/v1/chat/completions',
    models: [
      { id: 'grok-2-mini', label: 'Grok 2 Mini (fast)' },
      { id: 'grok-2-latest', label: 'Grok 2' },
    ],
    buildRequest: _oaiRequest,
    parseResponse: _oaiParse,
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
        urlOverride: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMsg }] }],
          generationConfig: { maxOutputTokens: 25 },
        }),
      };
    },
    parseResponse(data) {
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    url: '', // set by user
    models: [{ id: 'custom', label: 'Enter model name below' }],
    buildRequest: _oaiRequest,
    parseResponse: _oaiParse,
  },
};

const SYSTEM_PROMPT = `You are playing BOUNCE, a one-thumb arcade game. A ball falls from the top of the screen. You place horizontal surfaces to bounce it through a golden ring gap.

Each turn you receive game state JSON. Respond with ONLY: {"x": <number>, "y": <number>}

The JSON contains:
- ball.x, ball.y — current ball position
- ball.predicted.x, ball.predicted.y — where the ball will be in 0.4 seconds
- ring.gapX, ring.gapY — the pixel position the ball must pass through to score
- liveSurfaces — surfaces already placed (don't stack on them)
- screen.w, screen.h — screen dimensions

HOW TO PLAY:
1. Place the surface slightly below ball.predicted (intercept the falling ball)
2. Offset the surface X toward ring.gapX so the ball bounces in that direction
3. Good placement: x near ball.predicted.x + half the distance toward ring.gapX, y = ball.predicted.y + 40

CONSTRAINTS:
- y must be between screen.h * 0.07 and screen.h * 0.92
- x must be between 30 and screen.w - 30
- Don't place at same position as a liveSurface

Respond with ONLY the JSON. No explanation.`;

export class AIPlayer {
  constructor() {
    this.provider = 'anthropic';
    this.apiKey = '';
    this.modelId = '';
    this.customUrl = '';   // used when provider === 'custom'
    this.enabled = false;
    this.thinking = false;
    this.lastCallTime = 0;
    this.callInterval = 0.4; // reduced from 0.8 — faster follow-up for slower models
    this.error = null;
    this._runGen = 0; // increments each resetForRun to invalidate stale Promises
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
        if (typeof parsed.customUrl === 'string') this.customUrl = parsed.customUrl;
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
        customUrl: this.customUrl,
      }));
    } catch { /* ignore */ }
  }

  get isConfigured() {
    if (this.provider === 'custom') {
      // Custom provider only needs a URL (local models may not need a key)
      return this.customUrl.length > 5 && this.modelId.length > 0 && this.modelId !== 'custom';
    }
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

  setCustomUrl(url) {
    const trimmed = url.trim();
    if (trimmed) {
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          this.error = 'URL must use http:// or https://';
          return;
        }
      } catch {
        this.error = 'Invalid URL';
        return;
      }
    }
    this.customUrl = trimmed;
    this.error = null;
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
    this._runGen++;
  }

  static getProviders() {
    return Object.entries(PROVIDERS).map(([key, p]) => ({
      key,
      label: p.label,
      models: p.models,
    }));
  }

  async update(gameTime, agent, { allowStationary = false } = {}) {
    if (!this.enabled || !this.isConfigured) return null;
    if (this.thinking) return null;
    if (gameTime - this.lastCallTime < this.callInterval) return null;

    const state = agent.getState();
    if (state.state !== 'DROPPING' || !state.ball) return null;
    // Skip when ball is rising — unless we're in the waiting state (vy=0 at spawn)
    if (!allowStationary && state.ball.vy <= 0) return null;

    this.lastCallTime = gameTime;
    this.thinking = true;
    this.error = null;

    // Capture generation so stale Promises from prior rounds are discarded
    const gen = this._runGen;

    try {
      const summary = agent.getSummary();
      const userMsg = JSON.stringify(summary);
      const prov = this.providerConfig;
      const req = prov.buildRequest(this.apiKey, this.modelId, SYSTEM_PROMPT, userMsg);

      // Custom provider uses user-supplied URL; others use provider default or urlOverride
      const url = (this.provider === 'custom' && this.customUrl)
        ? this.customUrl
        : (req.urlOverride || prov.url);

      const response = await fetch(url, {
        method: 'POST',
        headers: req.headers,
        body: req.body,
      });

      if (gen !== this._runGen) { this.thinking = false; return null; } // stale

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
      if (gen !== this._runGen) { this.thinking = false; return null; } // stale

      const text = prov.parseResponse(data);

      // Parse JSON coordinates from response
      const match = text.match(/\{\s*"x"\s*:\s*(-?[\d.]+)\s*,\s*"y"\s*:\s*(-?[\d.]+)\s*\}/);
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
