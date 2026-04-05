export const CONFIG = {
  // Physics
  GRAVITY: 800,
  GRAVITY_ROUND1_MULT: 0.6,
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
  SURFACE_DECAY_TIME_ROUND1: 0.6,
  SURFACE_LENGTH_SMALL_SCREEN_MULT: 1.25,

  // Ring
  RING_RADIUS: 30,
  RING_THICKNESS: 12,
  RING_GAP_ANGLE: 60,
  RING_GAP_ANGLE_ROUND1: 90,
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
  RING_GAP_INDICATOR_OPACITY: 0.15,
  RING_GAP_INDICATOR_LENGTH: 3.5,

  // Particles
  RING_SUCCESS_PARTICLES: 12,
  PARTICLE_SPEED: 150,
  PARTICLE_LIFE: 0.6,

  // Trail art
  TRAIL_ART_BRIGHTEN_DURATION: 2.5,

  // Touch
  DEAD_ZONE_TOP: 0.05,
  DEAD_ZONE_BOTTOM: 0.05,

  // Progression visuals
  BG_COLOR_WARM: '#0d0a12',       // warm indigo tint for later rounds
  BG_WARM_START_ROUND: 4,
  BG_WARM_FULL_ROUND: 20,
  TRAIL_BASE_COLORS: ['#fff5e6', '#fff5e6', '#fff5e6', '#fff0d0', '#fff0d0', '#fff0d0', '#ffe8b8', '#ffe0a0'],
  GLOW_BOOST_ROUND: 5,            // ball glow +20% at this round
  TRAIL_WIDTH_BOOST_ROUND: 10,    // trail width 2 → 2.5 at this round
  RING_PULSE_SPEED_MAX: 1.8,
  RING_PULSE_SPEED_RAMP_ROUND: 10,

  // Streak milestones
  STREAK_MILESTONE_5_FLASH_TINT: '#ffcc66',
  STREAK_MILESTONE_10_FLASH_TINT: '#ffaa44',
  STREAK_MILESTONE_10_FLASH_DURATION: 0.5,

  // Lifetime stats menu
  MENU_STAT_ROTATE_INTERVAL: 4.0,
  MENU_STAT_FADE_TIME: 0.5,

  // Round 2: escalating success
  PARTICLE_STREAK_BONUS: 4,        // +4 particles per streak level
  PARTICLE_MAX: 28,
  SUCCESS_FLASH_BASE: 0.4,
  SUCCESS_FLASH_STREAK_STEP: 0.05,
  SUCCESS_FLASH_MAX: 0.7,

  // Round 2: ring evolution
  RING_OUTER_GLOW_ROUND: 8,
  RING_DOT_PULSE_ROUND: 12,

  // Round 2: vignette
  VIGNETTE_START_ROUND: 10,
  VIGNETTE_OPACITY: 0.03,

  // Round 2: menu dust
  MENU_DUST_AFTER_50: 4,
  MENU_DUST_AFTER_200: 10,
  MENU_DUST_SPEED: 8,

  // Round 2: round transition sweep
  ROUND_SWEEP_DURATION: 0.3,
  ROUND_SWEEP_OPACITY: 0.05,

  // Round 3: surface spawn animation
  SURFACE_SPAWN_DURATION: 0.05,       // 50ms scale-in

  // Round 3: spatial placement audio
  PLACE_SOUND_FREQ_LOW: 600,
  PLACE_SOUND_FREQ_HIGH: 1000,

  // Round 3: round badge
  ROUND_BADGE_DURATION: 1.2,
  ROUND_BADGE_SIZE: 28,
};

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
