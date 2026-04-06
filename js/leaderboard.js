import { CONFIG } from './config.js';

/** Fetch with timeout — prevents hanging on bad mobile connections */
function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export class Leaderboard {
  constructor() {
    this.entries = [];
    this.currentSort = 'score';
    this.currentTime = 'week';
    this.playerId = this.getOrCreatePlayerId();
    this.lastSubmitTime = 0;

    this.onClose = null;
    this.onSaveComplete = null;
    this.onReplayRequest = null;
    this.pendingRunData = null;
    this.saving = false;

    this.createGalleryDOM();
    this.createNameInputDOM();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!this.nameOverlay.classList.contains('hidden')) {
          this.hideNameInput();
        } else if (!this.galleryEl.classList.contains('hidden')) {
          this.hide();
        }
      }
    });
  }

  get isConfigured() {
    return CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY;
  }

  getOrCreatePlayerId() {
    try {
      let id = localStorage.getItem('bounce_player_id');
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('bounce_player_id', id);
      }
      return id;
    } catch {
      return 'anonymous';
    }
  }

  getPlayerName() {
    try {
      const stored = localStorage.getItem('bounce_player_name');
      return stored ? this.sanitizeName(stored) : 'Anonymous';
    } catch {
      return 'Anonymous';
    }
  }

  setPlayerName(name) {
    try {
      localStorage.setItem('bounce_player_name', name);
    } catch { /* localStorage unavailable */ }
  }

  // --- Gallery DOM ---

  createGalleryDOM() {
    this.galleryEl = document.createElement('div');
    this.galleryEl.id = 'gallery';
    this.galleryEl.className = 'overlay hidden';
    this.galleryEl.innerHTML = `
      <div class="gallery-header">
        <button class="gallery-close">\u00d7</button>
        <div class="gallery-filters">
          <div class="gallery-time-filters">
            <button data-time="week" class="active">This Week</button>
            <button data-time="month">This Month</button>
            <button data-time="all">All Time</button>
          </div>
          <div class="gallery-sorts">
            <button data-sort="score" class="active">Score</button>
            <button data-sort="streak">Streak</button>
            <button data-sort="rounds">Rounds</button>
          </div>
        </div>
      </div>
      <div class="gallery-list"></div>
      <div class="gallery-empty hidden">No scores yet. Play and save to appear here!</div>
      <div class="gallery-loading hidden">Loading...</div>
    `;
    document.body.appendChild(this.galleryEl);

    // Close button
    this.galleryEl.querySelector('.gallery-close').addEventListener('click', () => this.hide());

    // Sort buttons
    this.galleryEl.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.galleryEl.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentSort = btn.dataset.sort;
        this.fetchAndRender();
      });
    });

    // Time filter buttons
    this.galleryEl.querySelectorAll('[data-time]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.galleryEl.querySelectorAll('[data-time]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTime = btn.dataset.time;
        this.fetchAndRender();
      });
    });
  }

  // --- Name Input DOM ---

  createNameInputDOM() {
    this.nameOverlay = document.createElement('div');
    this.nameOverlay.id = 'name-overlay';
    this.nameOverlay.className = 'overlay hidden';
    this.nameOverlay.innerHTML = `
      <div class="name-form">
        <input type="text" id="player-name" maxlength="20" placeholder="Anonymous" autocomplete="off">
        <div class="name-buttons">
          <button class="name-save">Save</button>
          <button class="name-cancel">\u00d7</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.nameOverlay);

    const input = this.nameOverlay.querySelector('#player-name');
    const saveBtn = this.nameOverlay.querySelector('.name-save');
    const cancelBtn = this.nameOverlay.querySelector('.name-cancel');

    saveBtn.addEventListener('click', () => this.confirmSave());
    cancelBtn.addEventListener('click', () => this.hideNameInput());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.confirmSave();
    });
  }

  // --- Gallery ---

  async show() {
    this.galleryEl.classList.remove('hidden');
    await this.fetchAndRender();
  }

  hide() {
    this.galleryEl.classList.add('hidden');
    if (this.onClose) this.onClose();
  }

  async fetchAndRender() {
    if (!this.isConfigured) {
      this.showEmpty();
      return;
    }

    this.showLoading();

    try {
      this.entries = await this.fetchEntries();
      this.renderGrid();
    } catch {
      this.showEmpty();
    }
  }

  async fetchEntries() {
    const url = new URL(`${CONFIG.SUPABASE_URL}/rest/v1/bounce_runs`);
    url.searchParams.set('select', 'id,player_id,player_name,score,rounds,longest_streak,duration,trail_image,created_at');

    // Time filter
    if (this.currentTime === 'week') {
      const week = new Date();
      week.setDate(week.getDate() - 7);
      url.searchParams.set('created_at', `gte.${week.toISOString()}`);
    } else if (this.currentTime === 'month') {
      const month = new Date();
      month.setDate(month.getDate() - 30);
      url.searchParams.set('created_at', `gte.${month.toISOString()}`);
    }
    // 'all' = no time filter

    // Sort
    const sortMap = {
      score: 'score.desc',
      streak: 'longest_streak.desc',
      rounds: 'rounds.desc',
    };
    url.searchParams.set('order', sortMap[this.currentSort] || 'score.desc');
    url.searchParams.set('limit', '50');

    const res = await fetchWithTimeout(url, {
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data;
  }

  renderGrid() {
    const list = this.galleryEl.querySelector('.gallery-list');
    const empty = this.galleryEl.querySelector('.gallery-empty');
    const loading = this.galleryEl.querySelector('.gallery-loading');

    loading.classList.add('hidden');

    if (this.entries.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    list.innerHTML = '';

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const row = document.createElement('div');
      row.className = 'lb-row';
      const isMe = entry.player_id === this.playerId;
      if (isMe) row.classList.add('lb-row-me');

      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.textContent = `#${i + 1}`;
      row.appendChild(rank);

      // Thumbnail
      if (entry.trail_image && this.isValidImageData(entry.trail_image)) {
        const img = document.createElement('img');
        img.className = 'lb-thumb';
        img.src = entry.trail_image;
        img.alt = '';
        row.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'lb-thumb lb-thumb-empty';
        row.appendChild(placeholder);
      }

      const info = document.createElement('div');
      info.className = 'lb-info';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'lb-name';
      nameSpan.textContent = this.sanitizeName(entry.player_name);
      info.appendChild(nameSpan);

      const details = document.createElement('span');
      details.className = 'lb-details';
      const scoreVal = typeof entry.score === 'number' ? entry.score : 0;
      const roundsVal = typeof entry.rounds === 'number' ? entry.rounds : 0;
      const streakVal = typeof entry.longest_streak === 'number' ? entry.longest_streak : 0;
      details.textContent = `${scoreVal.toLocaleString()} pts · R${roundsVal} · ${streakVal} streak`;
      info.appendChild(details);

      row.appendChild(info);

      // Replay tap
      if (entry.id) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
          if (this.onReplayRequest) this.onReplayRequest(entry.id);
        });
      }

      list.appendChild(row);
    }
  }

  showEmpty() {
    this.galleryEl.querySelector('.gallery-list').innerHTML = '';
    this.galleryEl.querySelector('.gallery-loading').classList.add('hidden');
    this.galleryEl.querySelector('.gallery-empty').classList.remove('hidden');
  }

  showLoading() {
    this.galleryEl.querySelector('.gallery-empty').classList.add('hidden');
    this.galleryEl.querySelector('.gallery-loading').classList.remove('hidden');
  }

  // --- Save Flow ---

  startSaveFlow(runData) {
    this.pendingRunData = runData;

    // If player already has a name set (not first time), skip the name prompt
    const existingName = this.getPlayerName();
    if (existingName !== 'Anonymous' && localStorage.getItem('bounce_player_name')) {
      // Quick save — no prompt needed
      this.quickSave(existingName);
      return;
    }

    // First time — ask for name
    const input = this.nameOverlay.querySelector('#player-name');
    input.value = existingName;
    this.nameOverlay.classList.remove('hidden');
    setTimeout(() => input.focus(), 150);
  }

  async quickSave(name) {
    if (this.saving) return;
    this.saving = true;

    if (this.pendingRunData && this.isConfigured && this.canSubmit()) {
      const data = this.pendingRunData;
      const thumbnail = this.generateThumbnail(data.trail, data.gameWidth, data.gameHeight);

      await this.submitRun({
        player_id: this.playerId,
        player_name: name,
        score: data.score,
        rounds: data.rounds,
        longest_streak: data.longestStreak,
        duration: Math.round(data.duration * 100) / 100,
        trail_image: thumbnail,
        trail_data: data.trailData || { ball: [], surfaces: [], rings: [] },
      });
    }

    this.pendingRunData = null;
    this.saving = false;
    if (this.onSaveComplete) this.onSaveComplete();
  }

  hideNameInput() {
    this.nameOverlay.classList.add('hidden');
    this.pendingRunData = null;
    if (this.onSaveComplete) this.onSaveComplete();
  }

  async confirmSave() {
    // Prevent double-submit
    if (this.saving) return;
    this.saving = true;

    const input = this.nameOverlay.querySelector('#player-name');
    const name = this.sanitizeName(input.value);
    this.setPlayerName(name);

    if (this.pendingRunData && this.isConfigured && this.canSubmit()) {
      const data = this.pendingRunData;
      const thumbnail = this.generateThumbnail(data.trail, data.gameWidth, data.gameHeight);

      await this.submitRun({
        player_id: this.playerId,
        player_name: name,
        score: data.score,
        rounds: data.rounds,
        longest_streak: data.longestStreak,
        duration: Math.round(data.duration * 100) / 100,
        trail_image: thumbnail,
        trail_data: data.trailData || { ball: [], surfaces: [], rings: [] },
      });
    }

    this.nameOverlay.classList.add('hidden');
    this.pendingRunData = null;
    this.saving = false;
    if (this.onSaveComplete) this.onSaveComplete();
  }

  canSubmit() {
    return Date.now() - this.lastSubmitTime > CONFIG.SUBMIT_COOLDOWN * 1000;
  }

  async submitRun(data) {
    if (!this.isConfigured) return;

    // Set submit time before fetch to prevent concurrent submissions
    this.lastSubmitTime = Date.now();

    try {
      await fetchWithTimeout(`${CONFIG.SUPABASE_URL}/rest/v1/bounce_runs`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(data),
      });
    } catch {
      // Silent fail — save flow completes regardless
    }
  }

  // --- Thumbnail ---

  generateThumbnail(trail, gameWidth, gameHeight) {
    const size = CONFIG.TRAIL_THUMBNAIL_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Dark background
    ctx.fillStyle = CONFIG.BG_COLOR;
    ctx.fillRect(0, 0, size, size);

    if (!trail || trail.length < 2) return canvas.toDataURL('image/png', 0.5);

    const scaleX = size / gameWidth;
    const scaleY = size / gameHeight;

    ctx.strokeStyle = CONFIG.BALL_COLOR;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.8;

    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      ctx.beginPath();
      ctx.moveTo(p0.x * scaleX, p0.y * scaleY);
      ctx.lineTo(p1.x * scaleX, p1.y * scaleY);
      ctx.stroke();
    }

    return canvas.toDataURL('image/png', 0.5);
  }

  // --- Util ---

  isValidImageData(url) {
    if (typeof url !== 'string') return false;
    // Only allow safe raster data URIs (block SVG which can contain scripts)
    if (url.startsWith('data:image/png') || url.startsWith('data:image/jpeg') ||
        url.startsWith('data:image/webp') || url.startsWith('data:image/gif')) return true;
    // Block data:image/svg+xml and all other data URIs
    if (url.startsWith('data:')) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  sanitizeName(name) {
    if (typeof name !== 'string') return 'Anonymous';
    // Strip control characters, trim, enforce length
    const cleaned = name.replace(/[\x00-\x1f\x7f]/g, '').trim();
    if (cleaned.length === 0) return 'Anonymous';
    return cleaned.substring(0, 20);
  }

  // --- Replay fetch (on-demand, full entry with trail_data) ---

  async fetchReplayData(entryId) {
    if (!this.isConfigured) return null;
    if (typeof entryId !== 'string' || !/^[a-f0-9-]{36}$/i.test(entryId)) return null;
    try {
      const url = new URL(`${CONFIG.SUPABASE_URL}/rest/v1/bounce_runs`);
      url.searchParams.set('select', '*');
      url.searchParams.set('id', `eq.${entryId}`);
      url.searchParams.set('limit', '1');

      const res = await fetch(url, {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      return data[0];
    } catch {
      return null;
    }
  }
}
