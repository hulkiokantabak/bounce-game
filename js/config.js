export const CONFIG = {
  // Physics
  GRAVITY: 800,
  BALL_RADIUS: 14,
  BALL_RESTITUTION: 0.85,
  WALL_RESTITUTION: 0.9,
  MIN_SPEED: 100,
  MAX_SPEED: 1200,
  MAX_RUN_DURATION: 120,

  // Surfaces
  SURFACE_LENGTH: 80,
  SURFACE_THICKNESS: 4,
  SURFACE_DECAY_TIME: 0.3,

  // Ring
  RING_RADIUS: 30,
  RING_THICKNESS: 12,
  RING_GAP_ANGLE: 60,
  RING_PULSE_SPEED: 1.5,
  RING_SHATTER_FRAGMENTS_MIN: 6,
  RING_SHATTER_FRAGMENTS_MAX: 8,
  RING_SHATTER_DISTANCE: 150,
  RING_SHATTER_DURATION: 400,
  RING_MIN_REPOSITION_DISTANCE: 2.0, // in ring diameters

  // Progression — arrays must be same length
  // For rounds beyond array length, use last value
  SPEED_CURVE: [1.0, 1.0, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4],
  RING_SIZE_CURVE: [1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6],
  BALL_OFFSET_NARROW: 0.15,
  BALL_OFFSET_WIDE: 0.25,
  DUAL_RING_START_ROUND: 13,
  DUAL_RING_FREQUENCY: 3,
  DUAL_RING_ANGLE_OFFSET_MIN: 30,
  DUAL_RING_ANGLE_OFFSET_MAX: 60,

  // Scoring
  BASE_RING_SCORE: 100,
  // Index = bounceCount, clamped to length - 1
  BOUNCE_MULTIPLIERS: [5, 3, 2, 1],
  BOUNCE_COUNT_RESET_ON_RING: true,
  STREAK_MULTIPLIER_STEP: 0.1,
  STREAK_DISPLAY_THRESHOLD: 3,
  DUAL_RING_BONUS: 2.0,

  // Visual
  BG_COLOR: '#0a0a0f',
  BALL_COLOR: '#fff5e6',
  BALL_GLOW_RADIUS: 30,
  SURFACE_COLOR: '#ffffff',
  SURFACE_OPACITY: 0.8,
  RING_COLOR: '#ffcc66',
  TRAIL_START_OPACITY: 0.6,
  TRAIL_FADE_TIME: 5,
  TRAIL_WIDTH: 2,

  // Effects
  SCREEN_SHAKE_PX: 2,
  SCREEN_SHAKE_DURATION: 100,

  // Audio — tune SPEED_SCALE until pitch change is audible
  BOUNCE_SOUND_BASE_FREQ: 300,
  BOUNCE_SOUND_SPEED_SCALE: 0.5,
  RING_CHIME_FREQ: 523,
  RING_KILL_FREQ: 180,
  PLACE_SOUND_FREQ: 800,
  END_SOUND_FREQ: 150,

  // Haptics — PLACE_VIBRATE may need 15-20ms on real phones
  // iOS Safari: navigator.vibrate may not be supported; degrade gracefully
  PLACE_VIBRATE: 15,
  BOUNCE_VIBRATE: 20,
  RING_VIBRATE: [15, 50, 15],
  END_VIBRATE: 50,

  // Timing
  RING_HIT_PAUSE: 0.15,
  RUN_END_PAUSE: 0.5,
  RUN_END_TRAIL_HOLD: 1.0,
  RUN_END_SCORE_FADE: 0.5,
  RUN_END_PROMPT_DELAY: 1.0,

  // Replay
  REPLAY_SAMPLE_RATE: 3,
  REPLAY_SPEED_NORMAL: 1,
  REPLAY_SPEED_FAST: 2,

  // Supabase (leave empty to disable leaderboard backend)
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Leaderboard
  GALLERY_FETCH_COUNT: 50,
  GALLERY_COLUMNS: 3,
  GALLERY_GAP: 8,
  SUBMIT_COOLDOWN: 30,
  TRAIL_THUMBNAIL_SIZE: 100,

  // Menu
  MENU_TRAIL_OPACITY: 0.1,
  MENU_TRAIL_COUNT: 3,
  MENU_TRAIL_DRIFT_SPEED: 0.5,
  PERSONAL_BEST_OPACITY: 0.3,

  // Score pop
  SCORE_POP_DURATION: 0.8,
  SCORE_POP_RISE: 40,

  // Ball
  BALL_INITIAL_VX_RANGE: 40,

  // Ring approach glow
  RING_APPROACH_DISTANCE: 200,

  // Particles
  RING_SUCCESS_PARTICLES: 12,
  PARTICLE_SPEED: 150,
  PARTICLE_LIFE: 0.6,

  // Trail art
  TRAIL_ART_BRIGHTEN_DURATION: 1.5,

  // Touch
  DEAD_ZONE_TOP: 0.05,
  DEAD_ZONE_BOTTOM: 0.05,
};

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
