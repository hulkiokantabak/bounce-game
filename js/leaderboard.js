import { CONFIG, hexToRgba } from './config.js';

export class Leaderboard {
  constructor() {
    this.entries = [];
    this.loading = false;
    this.currentSort = 'score';
    this.currentTime = 'all';
    this.playerId = this.getOrCreatePlayerId();
    this.lastSubmitTime = 0;

    this.onClose = null;
    this.onSaveComplete = null;
    this.onReplayRequest = null;
    this.pendingRunData = null;

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
      return localStorage.getItem('bounce_player_name') || 'Anonymous';
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
          <div class="gallery-sorts">
            <button data-sort="score" class="active">Score</button>
            <button data-sort="streak">Streak</button>
            <button data-sort="rounds">Rounds</button>
            <button data-sort="recent">Recent</button>
          </div>
          <div class="gallery-time-filters">
            <button data-time="all" class="active">All</button>
            <button data-time="week">Week</button>
            <button data-time="today">Today</button>
          </div>
        </div>
      </div>
      <div class="gallery-grid"></div>
      <div class="gallery-empty hidden">No trails yet.</div>
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
    if (this.currentTime === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      url.searchParams.set('created_at', `gte.${today.toISOString()}`);
    } else if (this.currentTime === 'week') {
      const week = new Date();
      week.setDate(week.getDate() - 7);
      url.searchParams.set('created_at', `gte.${week.toISOString()}`);
    }

    // Sort
    const sortMap = {
      score: 'score.desc',
      streak: 'longest_streak.desc',
      rounds: 'rounds.desc',
      recent: 'created_at.desc',
    };
    url.searchParams.set('order', sortMap[this.currentSort] || 'score.desc');
    url.searchParams.set('limit', String(CONFIG.GALLERY_FETCH_COUNT));

    const res = await fetch(url, {
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
    const grid = this.galleryEl.querySelector('.gallery-grid');
    const empty = this.galleryEl.querySelector('.gallery-empty');
    const loading = this.galleryEl.querySelector('.gallery-loading');

    loading.classList.add('hidden');

    if (this.entries.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = '';
    for (const entry of this.entries) {
      const cell = document.createElement('div');
      cell.className = 'gallery-cell';

      if (entry.trail_image && this.isValidImageData(entry.trail_image)) {
        const img = document.createElement('img');
        img.className = 'gallery-thumb';
        img.src = entry.trail_image;
        img.alt = '';
        cell.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'gallery-thumb-empty';
        cell.appendChild(placeholder);
      }

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'cell-score';
      scoreSpan.textContent = (typeof entry.score === 'number' ? entry.score : 0).toLocaleString();
      cell.appendChild(scoreSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'cell-name';
      nameSpan.textContent = entry.player_name || 'Anonymous';
      cell.appendChild(nameSpan);

      // Replay tap — store entry id for on-demand fetch
      if (entry.id) {
        cell.dataset.entryId = entry.id;
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
          if (this.onReplayRequest) this.onReplayRequest(entry.id);
        });
      }

      grid.appendChild(cell);
    }
  }

  showEmpty() {
    this.galleryEl.querySelector('.gallery-grid').innerHTML = '';
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
    const input = this.nameOverlay.querySelector('#player-name');
    input.value = this.getPlayerName();
    this.nameOverlay.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
  }

  hideNameInput() {
    this.nameOverlay.classList.add('hidden');
    this.pendingRunData = null;
    if (this.onSaveComplete) this.onSaveComplete();
  }

  async confirmSave() {
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
    if (this.onSaveComplete) this.onSaveComplete();
  }

  canSubmit() {
    return Date.now() - this.lastSubmitTime > CONFIG.SUBMIT_COOLDOWN * 1000;
  }

  async submitRun(data) {
    if (!this.isConfigured) return;

    try {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/bounce_runs`, {
        method: 'POST',
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        this.lastSubmitTime = Date.now();
      }
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
    // Only allow data:image/ URIs (generated thumbnails) and https URLs
    if (url.startsWith('data:image/')) return true;
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
