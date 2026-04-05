export const CONFIG = {
  // Physics
  GRAVITY: 800,
  GRAVITY_ROUND1_MULT: 0.6,
  BALL_RADIUS: 14,
  BALL_RESTITUTION: 0.85,
  WALL_RESTITUTION: 0.9,
  MIN_SPEED: 280,
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
  RING_HIT_PAUSE: 0.3,
  RUN_END_PAUSE: 0.5,
  RUN_END_TRAIL_HOLD: 1.5,
  RUN_END_SCORE_FADE: 1.0,
  RUN_END_PROMPT_DELAY: 2.0,

  // Replay
  REPLAY_SAMPLE_RATE: 3,
  REPLAY_SPEED_NORMAL: 1,
  REPLAY_SPEED_FAST: 2,

  // Supabase
  SUPABASE_URL: 'https://wtfmprxgbyafqhoypjak.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_26jTgHN8dNfy0NLhzchvkQ_ZxAoaUGp',

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

  // Surface auto-decay: unhit surfaces fade after this time
  SURFACE_AUTO_DECAY_TIME: 4.0,       // seconds before unhit surfaces start fading

  // Round 3: surface spawn animation
  SURFACE_SPAWN_DURATION: 0.05,       // 50ms scale-in

  // Round 3: spatial placement audio
  PLACE_SOUND_FREQ_LOW: 600,
  PLACE_SOUND_FREQ_HIGH: 1000,

  // Round 3: round badge
  ROUND_BADGE_DURATION: 1.2,
  ROUND_BADGE_SIZE: 28,

  // Phase 4: Bounce dynamics
  SURFACE_DEFLECT_STRENGTH: 0.85,    // how much offset from center affects vx
  SURFACE_DEFLECT_MAX_VX: 500,       // max vx gained from deflection
  BALL_SPIN_FRICTION: 0.2,            // how much spin affects vx over time
  BALL_SPIN_DECAY: 0.90,             // spin decay per second (multiplied each frame)

  // Phase 4: Surface types
  SURFACE_TYPES: ['normal', 'spring', 'ice', 'sticky', 'angled_left', 'angled_right'],
  SURFACE_SPRING_RESTITUTION: 1.3,   // bouncy!
  SURFACE_ICE_DEFLECT_MULT: 2.5,     // extra sideways on ice
  SURFACE_STICKY_RESTITUTION: 0.5,   // dampens bounce
  SURFACE_STICKY_VX_DAMP: 0.3,       // kills horizontal speed
  SURFACE_ANGLED_VX_BOOST: 250,      // angled surfaces kick ball sideways
  SURFACE_TYPE_INTRO_ROUND: 1,       // special surfaces from the start
  SURFACE_TYPE_CHANCE_BASE: 0.2,     // 20% chance of special surface at intro
  SURFACE_TYPE_CHANCE_MAX: 0.5,      // 50% max
  SURFACE_TYPE_CHANCE_RAMP_ROUND: 10,
  SURFACE_R1_GUARANTEED_COUNT: 2,
  SURFACE_R1_GUARANTEED_FIRST: 'spring',
  SURFACE_R1_GUARANTEED_POOL: ['ice', 'angled_left', 'angled_right'],
  SURFACE_R1_CHANCE: 0.15,
  SURFACE_R2_CHANCE: 0.20,

  // Phase 4: Ball types — variety from Round 1
  BALL_TYPES: ['standard', 'heavy', 'bouncy', 'small', 'floaty'],
  BALL_R1_TYPES: ['standard', 'bouncy'],
  BALL_R2_TYPES: ['standard', 'bouncy', 'floaty'],
  BALL_R3_PLUS_TYPES: ['standard', 'heavy', 'bouncy', 'small', 'floaty'],
  BALL_MIN_GRAVITY_MULT: 0.4,
  BALL_REPEAT_WEIGHT: 0.3,
  BALL_HEAVY_GRAVITY_MULT: 1.4,
  BALL_HEAVY_RESTITUTION: 0.7,
  BALL_HEAVY_RADIUS_MULT: 1.3,
  BALL_BOUNCY_RESTITUTION: 1.0,
  BALL_BOUNCY_GRAVITY_MULT: 0.85,
  BALL_SMALL_RADIUS_MULT: 0.7,
  BALL_SMALL_SPEED_MULT: 1.15,
  BALL_FLOATY_GRAVITY_MULT: 0.65,
  BALL_FLOATY_DRIFT: 30,             // random horizontal drift per second

  // Phase 4: Environmental effects
  WIND_INTRO_ROUND: 5,
  WIND_STRENGTH_MAX: 60,
  WIND_CHANGE_INTERVAL: 3.0,         // seconds between wind shifts
  GRAVITY_PULSE_INTRO_ROUND: 7,
  GRAVITY_PULSE_CHANCE: 0.15,        // per round
  GRAVITY_PULSE_DURATION: 2.0,
  GRAVITY_PULSE_MULT: 0.4,           // temporary low gravity

  // Phase 4: Ring events
  RING_EVENT_INTRO_ROUND: 6,
  RING_EVENT_CHANCE: 0.12,           // per round
  RING_DRIFT_SPEED: 15,              // px/s for drifting ring
  RING_GAP_ROTATE_SPEED: 0.5,        // rad/s for rotating gap
  RING_PULSE_SIZE_AMOUNT: 0.15,      // ±15% size oscillation
  RING_PULSE_SIZE_SPEED: 1.5,

  // Phase 4: Ring positioning — from top 1/3 downward
  RING_MIN_Y_RATIO: 0.33,
  RING_MAX_Y_RATIO: 0.85,

  // Phase 5: Gameplay depth
  SURFACE_COMBO_WINDOW: 0.4,          // seconds — place within this to get combo
  SURFACE_COMBO_DECAY_BONUS: 0.15,    // +15% decay time per combo level
  SURFACE_COMBO_MAX: 3,               // max combo level
  MAX_SURFACES: 12,                   // max surfaces on screen
  CEILING_RESTITUTION: 0.6,           // ball bouncing off top
  RING_DRIFT_VELOCITY_TRANSFER: 0.3,  // % of ring drift velocity transferred to ball on success

  // Phase 5: Physics polish
  AIR_DRAG: 0.0004,                   // subtle air resistance at high speeds
  RING_GRAVITY_WELL_STRENGTH: 25,     // attraction force when ball near ring
  RING_GRAVITY_WELL_RADIUS: 1.8,      // in ring radii
  MAX_PHYSICS_CATCHUP: 10,            // max physics ticks per frame to prevent spiral of death

  // Phase 6: Trajectory preview
  TRAJECTORY_PREVIEW_STEPS: 20,        // dotted arc steps
  TRAJECTORY_PREVIEW_STEP_DT: 0.025,   // time per step
  TRAJECTORY_PREVIEW_OPACITY: 0.06,    // very subtle

  // Phase 6: Ring gap glow pulse
  RING_GAP_GLOW_RADIUS: 8,            // glow around gap edges
  RING_GAP_GLOW_OPACITY: 0.2,

  // Phase 6: Surface placement ripple
  SURFACE_RIPPLE_DURATION: 0.3,
  SURFACE_RIPPLE_MAX_RADIUS: 40,

  // Phase 6: Directional bounce particles
  BOUNCE_PARTICLE_COUNT: 4,
  BOUNCE_PARTICLE_SPEED: 80,
  BOUNCE_PARTICLE_LIFE: 0.3,

  // Phase 6: Background stars
  STAR_COUNT: 30,
  STAR_MAX_SIZE: 1.5,
  STAR_MIN_OPACITY: 0.02,
  STAR_MAX_OPACITY: 0.06,

  // Phase 6: Score breakdown
  SCORE_BREAKDOWN_SHOW_BOUNCES: true,

  // Phase 6: First-run tutorial
  TUTORIAL_HINT_R1_DELAY: 1.0,        // seconds before showing R1 hint

  // Phase 7: Danger Zone — escalating chaos when ball is low
  DANGER_ZONE_ENABLE_TIME: 1.0,
  DANGER_ZONE_WARNING_Y: 0.70,
  DANGER_ZONE_DANGER_Y: 0.82,
  DANGER_ZONE_EXTREME_Y: 0.90,
  DANGER_ZONE_RESET_Y: 0.65,
  DANGER_ZONE_WARNING_SPEED_BOOST: 1.08,
  DANGER_ZONE_NUDGE_INTERVAL: 0.3,
  DANGER_ZONE_NUDGE_VX_RANGE: 200,
  DANGER_ZONE_NUDGE_VY_BOOST: -150,
  DANGER_ZONE_NUDGE_GRAVITY_MULT: 0.5,
  DANGER_ZONE_NUDGE_GRAVITY_DURATION: 0.4,
  DANGER_ZONE_EXTREME_ZERO_G_DURATION: 0.6,
  DANGER_ZONE_EXTREME_GUST_VY: -400,
  DANGER_ZONE_EXTREME_SIZE_PULSE: 1.5,
  DANGER_ZONE_EXTREME_SIZE_DURATION: 0.3,
  DANGER_ZONE_RESCUE_BONUS: 25,
  DANGER_ZONE_SAVED_BONUS: 50,
  DANGER_ZONE_SURFACE_POOL: ['spring', 'spring', 'ice', 'angled_left', 'angled_right'],
  DANGER_ZONE_MUTATE_Y_RATIO: 0.70,

  // Phase 7: Ball mood shifts — temporary physics modifiers
  MOOD_BOUNCE_TRIGGER_MIN: 6,
  MOOD_BOUNCE_TRIGGER_MAX: 10,
  MOOD_RING_TRIGGER: true,
  MOOD_DURATION: 2.5,
  MOOD_TYPES: ['excited', 'heavy', 'slippery', 'zen'],
  MOOD_EXCITED_RESTITUTION_BONUS: 0.15,
  MOOD_EXCITED_GRAVITY_MULT: 0.85,
  MOOD_HEAVY_GRAVITY_MULT: 1.3,
  MOOD_HEAVY_RESTITUTION_PENALTY: 0.1,
  MOOD_SLIPPERY_DRIFT: 40,
  MOOD_SLIPPERY_SPIN_DECAY: 0.7,
  MOOD_ZEN_GRAVITY_MULT: 0.6,
  MOOD_ZEN_AIR_DRAG_MULT: 2.0,
  MOOD_FLASH_DURATION: 0.15,
  MOOD_GLOW_BLEND: 0.2,
  MOOD_COLORS: { excited: '#ffdd44', heavy: '#ff8866', slippery: '#66ddff', zen: '#aaddaa' },
};

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
