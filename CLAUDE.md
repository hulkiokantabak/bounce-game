# Bounce

One-thumb arcade browser game. The ball drops. You tap. It bounces. The trail stays.

## Stack
- Vanilla JavaScript, ES modules
- HTML5 Canvas (all rendering)
- Web Audio API (sound effects and haptics)
- No framework, no build step

## How to Run
- Open `index.html` directly in browser — no build required
- Runs on desktop, tablet, and mobile (touch-enabled, responsive canvas)
- PWA-capable (meta tags in `index.html`)

## Deployment
- GitHub repo: https://github.com/hulkiokantabak/bounce-game
- Live site: https://hulkiokantabak.github.io/bounce-game/
- Deploy: push to `main` — GitHub Pages serves `index.html` directly

## Architecture
Each game system is a separate ES module:

- `js/main.js` — game loop, state machine, core logic (59 KB — the heart of the game)
- `js/ball.js` — physics simulation
- `js/surface.js` — surface placement and collision detection
- `js/ring.js` — ring target mechanics
- `js/config.js` — all game constants and configuration values
- `js/render.js` — canvas drawing
- `js/input.js` — touch and click event handling
- `js/ui.js` — UI panels and overlays
- `js/audio.js` — sound effects and haptic feedback
- `js/leaderboard.js` — score tracking
- `js/replay.js` — game recording and playback
- `js/score.js` — scoring logic
- `js/lifetime.js` — cumulative player stats
- `js/settings.js` — settings panel
- `js/agent.js` — developer API (`window.BOUNCE_AI`) for external control (~18 KB)
- `js/ai-player.js` — LLM player integration adapter
- `js/ai-hooks.js` — hooks for AI integration points
- `js/example-bot.js` — rule-based demo bot for auto-play

## Notes
- **State machine**: MENU → DROPPING → RING_HIT → RUN_OVER → LEADERBOARD → REPLAY — all transitions in `main.js`
- **Physics timestep**: Fixed at 120 FPS (1/120 s) — deterministic behaviour across devices
- **AI API**: `window.BOUNCE_AI` exposes `placeSurface()` and game state so external LLM agents (Claude, OpenAI, etc.) can play the game programmatically — designed as a first-class feature
- **Leaderboard and replay** persist to `localStorage`
- GoatCounter analytics at bottom of `index.html`
