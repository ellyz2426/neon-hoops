# Neon Hoops VR 🏀

A neon-lit VR basketball game built with [IWSDK](https://iwsdk.dev) (Immersive Web SDK). Plays in both VR headsets and desktop browsers.

**[Play Now →](https://ellyz2426.github.io/neon-hoops/)**

## Features

### 7 Game Modes
- **Free Throw** — 10 shots from the free throw line
- **Three-Point Contest** — 5 racks of 5, timed 60 seconds
- **Arcade** — Progressive difficulty with 30-second timer
- **H.O.R.S.E.** — Classic letter game vs AI opponent
- **Trick Shots** — 10 special challenges (swishes, bank shots, distance)
- **Daily Challenge** — Same 10-shot challenge for everyone, every day
- **Practice** — Unlimited shooting, no pressure

### Gameplay
- Arc-trajectory ball physics with 4-substep integration
- Rim collision, backboard bounce, floor bounce, ball spin
- Shot arc preview while charging
- Ball trail effects with additive blending
- Swish detection, bank shot detection
- Scoring: swish +3, clean make +2, distance bonuses, streak multipliers
- Streak system: HOT → ON FIRE → UNSTOPPABLE → LEGENDARY

### Customization
- 8 ball skins (Classic Orange, Neon Blue, Plasma Green, Hot Pink, Gold Rush, Void Purple, Ice White, Lava Core)
- 5 court themes (Neon Arena, Cyberpunk, Arctic Court, Solar Blaze, Toxic Green)
- Volume controls for master, SFX, and music

### Progression
- 20 achievements with localStorage persistence
- Top 20 leaderboard
- Career stats tracking (games, makes, streaks, high scores)
- Daily Challenge history

### Audio
- 17+ procedural Web Audio SFX (throw whoosh, swish, make fanfare, miss tone, rim hit, backboard hit, floor bounce, countdown, game start/end, achievement jingle, button click, net swoosh, charge hum, perfect shot chime, dribble, streak break, crowd cheer with whistles)
- Ambient electronic drone with LFO modulation

### Visual
- Holodeck environment with neon grid floor/ceiling
- 12 floating wireframe decorations (torus, box, sphere, cone)
- 40 ambient particles with pulsing opacity
- Particle celebrations on makes and burst rings on streaks
- Net physics animation on baskets
- Pulsing shot position marker

### VR + Browser
- Dual-runtime: XR headset + desktop browser
- VR: trigger charge/release to shoot, B button pause, laser pointer menus
- Browser: click-drag-up to charge, mouse aim, keyboard shortcuts (ESC, R, M, 1-7)
- All UI via PanelUI (.uikitml) — zero HTML DOM overlays

## Controls

### VR
| Action | Control |
|--------|---------|
| Charge shot | Hold right trigger |
| Release shot | Release trigger |
| Pause | B button |
| Navigate menus | Laser pointer + click |

### Browser
| Action | Control |
|--------|---------|
| Charge shot | Click + drag up |
| Aim | Move mouse left/right |
| Shoot | Release click |
| Pause/Resume | Escape |
| Quick restart | R (game over screen) |
| Back to menu | M (game over screen) |
| Quick mode select | 1-7 (title/mode screen) |

## Tech Stack
- IWSDK 0.4.1 (Immersive Web SDK)
- TypeScript
- Procedural Web Audio API
- PanelUI spatial UI system (16 .uikitml templates)
- Vite build system

## Development

```bash
npm install
npm run dev       # Start dev server with hot reload
npm run build     # Production build to dist/
```

## File Structure

```
src/
  index.ts      — Main entry, game loop, UI binding, input
  types.ts      — Types, config, achievements, game state manager
  audio.ts      — Procedural Web Audio SFX + ambient
  physics.ts    — Ball physics, trail renderer, arc preview
  particles.ts  — Particle system (celebration, sparks, bursts)
  court.ts      — Court geometry, hoop, lighting, environment
ui/
  16 .uikitml templates (title, modes, daily, hud, settings, stats, etc.)
```
