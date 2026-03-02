# Space Puzzle

A gravity-manipulation puzzle game set in deep space. Launch a probe through gravity wells, around asteroid fields, and into repair goals to fix your stranded spacecraft. Each level introduces new challenges with increasing complexity — more gravity wells, denser asteroid fields, and tighter solutions.

## Features

- **Gravity Wells**: Curved trajectories with real-time gravitational physics — wells distort object paths with visual ripple effects
- **Drag & Launch**: Intuitive click-and-drag mechanic to aim and launch probes with variable force
- **12 Handcrafted Levels**: Progressive difficulty from tutorial to gauntlet, each with unique well/asteroid layouts
- **Asteroid Fields**: Bounce off asteroids with impact particles and screen shake
- **Spacecraft Repair Objectives**: Each level repairs a ship component — repair all 12 to complete the game
- **Star Rating System**: 1-3 stars per level based on moves vs par and elapsed time
- **Glow Trail Effects**: Launched objects leave glowing trails as they navigate through space
- **Gravity Well Distortion**: Animated ripple rings and radial gradient glow on gravity wells
- **Particle Cascades**: Solution celebrations with multi-color confetti bursts
- **Floating Score Text**: Points and repair status displayed as floating text
- **Screen Shake**: Impact feedback on asteroid collisions and well absorption
- **Twinkling Star Background**: Animated starfield for deep-space atmosphere
- **High Score Persistence**: Best scores saved to localStorage across sessions
- **Full SZ Desktop Integration**: Menu bar, dialogs, window title updates, theme support

## User Stories

- **S-011**: As a player, I want to solve gravity-manipulation and navigation puzzles in space environments with asteroid fields and spacecraft repairs, so that I experience creative space puzzles.
- **S-012**: As a player, I want space puzzles to have gravity-well distortion effects, solution-reveal particle cascades, asteroid glow trails, and smooth object movement, so that puzzles feel satisfying to solve.
- **S-000**: As a player, I want every game to have particle effects, glow, screen shake, and floating score text, so that games feel polished and exciting.

## Controls

| Input | Action |
|---|---|
| Click & Drag from probe | Aim and launch probe |
| R | Retry current level |
| Escape | Pause / Resume |
| F2 | New Game |

## Technical Architecture

- **Engine**: Vanilla JavaScript canvas 2D with IIFE pattern
- **Physics**: Delta-time based gravitational simulation with inverse-square law
- **Collision**: Circle-circle detection with reflection (asteroids) and absorption (wells)
- **Effects**: SZ.GameEffects shared library (ParticleSystem, ScreenShake, FloatingText)
- **Input**: Pointer events with setPointerCapture for smooth drag-and-release
- **State Machine**: READY → PLAYING → AIMING → LAUNCHED → SOLVED → GAME_OVER, with PAUSED overlay
- **Persistence**: localStorage with try-catch error handling

## SEO Keywords

space puzzle game, gravity puzzle, physics puzzle, browser game, online puzzle game, gravity wells, asteroid field, spacecraft repair, drag and launch, orbital mechanics, free puzzle game, space navigation, gravity manipulation, web game, HTML5 canvas game
