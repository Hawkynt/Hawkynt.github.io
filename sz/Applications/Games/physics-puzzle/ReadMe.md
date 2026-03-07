# Physics Puzzle

Build-and-launch physics puzzle game for the SynthelicZ Desktop. Aim and launch projectiles using angle and power control, place ramps, blocks, and springs to guide your shots across 15+ levels. Part of the SynthelicZ Desktop.

## How It Works

1. Click and drag from the launcher to set angle and power
2. Release to launch the projectile
3. Place ramps (1/R), blocks (2/B), or springs (3/S) to guide the shot
4. Hit the star target to complete each level
5. Fewer shots = more stars (1-3 star rating)

## User Stories

### Core Gameplay
- [x] As a user, I can aim and launch projectiles by clicking and dragging to set angle and power
- [x] As a user, I can see realistic projectile physics with gravity, velocity, and collision response
- [x] As a user, I can place ramps that deflect the projectile upward with a horizontal boost
- [x] As a user, I can place blocks as solid barriers that bounce the projectile back
- [x] As a user, I can place springs as super-bounce pads that launch the projectile high
- [x] As a user, I can drag-to-move previously placed ramps, blocks, and springs to reposition them
- [x] As a user, I can hit the star target to complete the level
- [x] As a user, I can play through 15+ puzzle levels with progressively challenging layouts

### Scoring & Rating
- [x] As a user, I can receive 1-3 stars per level based on shot efficiency
- [x] As a user, I can see my best star ratings saved to localStorage

### Visual Effects
- [x] As a user, I can see collision spark effects when the projectile impacts structures and walls
- [x] As a user, I can see solution-path glow trails following the projectile trajectory
- [x] As a user, I can see structure collapse dust and debris particles when structures are destroyed
- [x] As a user, I can see 3-star confetti celebration on perfect level completion
- [x] As a user, I can see screen shake impact feedback on collisions and destruction
- [x] As a user, I can see floating text for score and status feedback

### Enhanced Visual Assets
- [x] As a user, I can see a sky gradient with twinkling stars
- [x] As a user, I can see a metallic launcher with gradient finish
- [x] As a user, I can see an animated pulsing target with star
- [x] As a user, I can see beveled structures with crack damage overlay
- [x] As a user, I can see gradient-filled objects (metallic ramp, wooden block, animated spring)
- [x] As a user, I can see a rubber ball projectile with motion blur

### Tutorial & UI
- [x] As a user, I can see a 2-page tutorial overlay shown on first play, toggled with H key, persisted via localStorage
- [x] As a user, I can see the canvas maximize to fill the parent container for full-window gameplay

### OS Integration
- [x] As a user, I can use the menu bar (Game: New/Pause/High Scores/Exit, Help: How to Play/Controls/About)
- [x] As a user, I can use the dialog system for high scores, controls, and about
- [x] As a user, I can press F2 for new game / restart level, Escape for pause

### Planned
- [ ] As a user, I can hear sound effects for launches, collisions, and target hits
- [ ] As a user, I can create custom puzzles in a built-in level editor
- [ ] As a user, I can use additional object types (fans, portals, magnets) for more complex puzzles
- [ ] As a user, I can see a trajectory preview line while aiming to plan my shots
- [ ] As a user, I can undo my last shot to try a different approach

## Controls

| Input | Action |
|-------|--------|
| Click + Drag | Aim angle and power |
| Release | Launch projectile |
| 1 / R | Select ramp (build mode) |
| 2 / B | Select block (build mode) |
| 3 / S | Select spring (build mode) |
| F2 | New game / Restart level |
| Escape | Pause / Resume |
| H | Toggle tutorial overlay |

## Technical Details

- **Engine**: Vanilla JavaScript canvas 2D with IIFE pattern and `window.SZ` namespace
- **Canvas**: 700x500 with devicePixelRatio scaling
- **Physics**: Delta-time projectile simulation with gravity, velocity, and bounce restitution
- **Collision**: Circle-rectangle detection for projectile vs structures/walls
- **Effects**: SZ.GameEffects (ParticleSystem, ScreenShake, FloatingText)
- **Persistence**: localStorage with `sz-physics-puzzle-` prefix
- **OS integration**: SetWindowText, RegisterWindowProc (WM_SIZE, WM_THEMECHANGED)

## Known Limitations

- No sound effects
- Fixed canvas size (CSS scaled)
- No level editor

## SEO Keywords

physics puzzle, physics game, projectile game, launch game, browser game, web game, HTML5 game, canvas game, build and launch, angry birds style, gravity puzzle, ramp block spring, SynthelicZ, WebOS game
