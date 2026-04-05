/**
 * Lifetime Stats — persistent player history stored in localStorage.
 * No backend required. Provides the "meaning of playing" through accumulated stats.
 */

const STORAGE_KEY = 'bounce_lifetime';

const DEFAULTS = {
  totalRings: 0,
  totalBounces: 0,
  totalRuns: 0,
  totalDistance: 0,
  bestStreak: 0,
  bestRound: 0,
};

export class LifetimeStats {
  constructor() {
    this.stats = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
      }
    } catch { /* ignore */ }
    return { ...DEFAULTS };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch { /* localStorage unavailable */ }
  }

  /** Call at end of each run with run summary */
  recordRun(data) {
    this.stats.totalRuns++;
    this.stats.totalRings += data.ringsThreaded || 0;
    this.stats.totalBounces += data.totalBounces || 0;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, data.longestStreak || 0);
    this.stats.bestRound = Math.max(this.stats.bestRound, data.round || 0);
    this.save();
  }

  /** Get a display-friendly stat for the menu rotator */
  getDisplayStats() {
    const s = this.stats;
    const lines = [];
    if (s.totalRuns > 0) lines.push(`${s.totalRuns} runs`);
    if (s.totalRings > 0) lines.push(`${s.totalRings} rings threaded`);
    if (s.bestStreak > 0) lines.push(`best streak: ${s.bestStreak}`);
    if (s.bestRound > 1) lines.push(`best round: ${s.bestRound}`);
    if (s.totalBounces > 0) lines.push(`${s.totalBounces} bounces`);
    return lines;
  }

  /** Generate procedural ghost trail paths for the menu */
  generateGhostTrails() {
    const runs = this.stats.totalRuns;
    if (runs < 3) return [];

    const count = Math.min(Math.floor(runs / 10) + 1, 4);
    const trails = [];

    for (let t = 0; t < count; t++) {
      const points = [];
      let x = 0.3 + Math.random() * 0.4;
      let y = 0.05 + Math.random() * 0.1;
      let vx = (Math.random() - 0.5) * 0.02;
      let vy = 0;
      const complexity = Math.min(this.stats.bestRound, 15);
      const steps = 30 + complexity * 5;

      for (let i = 0; i < steps; i++) {
        points.push({ x, y });
        vy += 0.003;
        x += vx;
        y += vy;

        // Bounce off walls
        if (x < 0.05 || x > 0.95) { vx = -vx * 0.8; x = Math.max(0.05, Math.min(0.95, x)); }

        // Simulate surface bounce
        if (vy > 0 && Math.random() < 0.15) {
          vy = -vy * 0.7;
          vx += (Math.random() - 0.5) * 0.01;
        }

        // Floor
        if (y > 0.95) break;
      }

      if (points.length > 5) {
        trails.push(points);
      }
    }

    return trails;
  }

  /** Get title color tier based on lifetime rings */
  getTitleTier() {
    const rings = this.stats.totalRings;
    if (rings >= 200) return 3; // amber
    if (rings >= 50) return 2;  // rich gold
    if (rings >= 10) return 1;  // warm gold
    return 0;                    // default gold
  }
}
