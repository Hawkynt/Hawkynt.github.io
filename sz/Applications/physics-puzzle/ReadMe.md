# Physics Puzzle

Build-and-launch physics puzzle game for the SynthelicZ Desktop. Aim and launch projectiles using angle and power control, place ramps, blocks, and springs to guide your shots across 15+ levels.

## User Stories

- **S-078**: As a player, I want to solve physics-based puzzles by building structures, launching objects, and manipulating gravity/momentum to reach goals, so that I experience creative physics gameplay.
- **S-079**: As a player, I want physics puzzle to have object-collision spark effects, solution-path glow trails, structure-collapse dust particles, and smooth physics-driven animations, so that physics interactions feel tangible.
- **S-000**: Cross-cutting visual polish (particles, glow, screen shake, floating text).

## Features

- **Gravity & Momentum Simulation**: Realistic projectile physics with gravity, velocity, and collision response
- **Angle & Power Aiming**: Click-and-drag to set launch angle and power
- **Placeable Objects**: Ramps (deflect upward), blocks (solid walls), springs (super-bounce)
- **15+ Puzzle Levels**: Progressively challenging with varied structures and goals
- **Star Rating**: 1-3 stars per level based on shot efficiency
- **Collision Spark Effects**: Spark particles burst on impact with structures and walls
- **Solution-Path Glow Trails**: Glowing trail follows projectile trajectory
- **Structure Collapse Dust**: Debris and dust particles when structures are destroyed
- **3-Star Confetti**: Celebration confetti on perfect completion
- **Screen Shake**: Impact feedback on collisions and destruction
- **Floating Text**: Score and status feedback displayed as floating text
- **High Scores**: Best star ratings saved to localStorage
- **Canvas Resize**: Adapts to window size changes

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

## Game Mechanics

- **Launcher**: Fixed position per level. Click and drag to set angle (clamped upward) and power.
- **Projectile**: Affected by gravity each frame. Bounces off walls, floor, and structures with restitution.
- **Ramps**: Deflect projectile upward with slight horizontal boost.
- **Blocks**: Solid barriers that bounce projectile back.
- **Springs**: Super-bounce pads that launch projectile high.
- **Structures**: Obstacles with hit points. Multiple hits or powerful shots destroy them, triggering dust particles.
- **Target**: Hit the star target to complete the level. Fewer shots = more stars.

## Architecture

- IIFE pattern with `window.SZ` namespace
- Canvas-based rendering at 700x500 with devicePixelRatio scaling
- Shared libraries: menu.js, dialog.js, game-effects.js (ParticleSystem, ScreenShake, FloatingText)
- OS integration: SetWindowText, RegisterWindowProc (WM_SIZE, WM_THEMECHANGED)
- localStorage persistence with `sz-physics-puzzle-` prefix

## SEO Keywords

physics puzzle, physics game, projectile game, launch game, browser game, web game, HTML5 game, canvas game, build and launch, angry birds style, gravity puzzle, ramp block spring, SynthelicZ, WebOS game
