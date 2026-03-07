# Breakout

## Purpose

Classic brick-breaking arcade game where the player moves a paddle to bounce a ball and destroy rows of colored bricks. Features power-ups, progressive difficulty, diverse level layouts, and rich visual effects. Part of the SynthelicZ Desktop game collection.

## How It Works

Canvas-based game with two playfield sizes (small 480x560, large 1200x840) and HiDPI support. The window is resizable and maximizable -- the playfield scales to fit the window while preserving aspect ratio. The ball bounces off walls, the paddle, and bricks. Bricks award points and may drop power-ups. Clearing all destructible bricks advances to the next level with a unique layout. Game effects (particles, screen shake, floating text, confetti, electric arcs, glass brick rendering, starfield) come from the shared `game-effects.js` module.

## Architecture

- **`index.html`** -- Menu bar (Game/View/Help), canvas, status bar, dialogs (High Scores, Controls, About)
- **`levels.js`** -- Level layout definitions (12 hand-crafted levels + procedural generator)
- **`controller.js`** -- IIFE with game states, electric paddle, brick types, power-ups, collision, rendering
- **`styles.css`** -- Game layout and visual styling
- **Shared modules** -- `menu.js`, `dialog.js`, `game-effects.js`

## Features

### Playfield & Display
- Two playfield sizes: Small (480x560, 10 brick columns) and Large (1200x840, 25 brick columns)
- Selectable from View menu; switching starts a new game
- Window is resizable and maximizable; playfield stretches to fill while keeping aspect ratio
- Large field tiles the level patterns horizontally to fill the wider grid
- ResizeObserver-based display scaling for smooth fit

### Gameplay
- Paddle movement via keyboard (Left/Right, A/D) or mouse (pointer lock)
- Ball physics with angle-based paddle bouncing (hit position affects bounce angle)
- 12 hand-crafted levels with diverse brick patterns (Diamond, Fortress, Spiral, Heart, etc.)
- Procedural level generation after all defined levels are exhausted
- Ball speed increases per level (4.5 base, +0.3/level, max 9)
- Ball attaches to paddle before launch (Space or mouse click to launch)
- Combo counter for rapid brick hits (x2!, x3!, etc.) with bonus scoring
- Wall collision with proper edge bouncing

### Brick Types
- **Normal** -- Gradient-shaded colored bricks with inner border highlight, 1 hit to destroy
- **Glass (G)** -- Semi-transparent with animated diagonal glare sweep and specular highlight; ball passes through without bouncing, crystalline shatter effect on contact
- **Steel (S)** -- Metallic gradient with rivet dots, takes 2 hits; crack overlay appears at 1 HP, metallic particle burst
- **Indestructible (X)** -- Dark bricks with pulsing purple border and X pattern; cannot be destroyed, skipped in level-clear check

### Power-ups
- **Wide (W)** -- Expands paddle width (80 -> 120px) for 10 seconds
- **Multi (M)** -- Spawns 2 extra balls per existing ball
- **Slow (S)** -- Reduces ball speed to 60% for 10 seconds
- **Fire (F)** -- Ball turns orange and passes through bricks without bouncing for 8 seconds, flame trail particles
- **Laser (L)** -- Paddle gets two laser cannons on emitters, fire with Space/click for 10 seconds
- **Barrier (B)** -- Creates an energy barrier at the bottom that saves one ball
- 22% drop chance from destroyed bricks
- Pill-shaped capsules with inner glow, pulsing, and icon letter

### Visual Effects
- **Electric forcefield paddle** -- Two metallic emitter nodes with multiple jagged lightning arcs between them, energy field glow, spark particles
- **Comet ball trail** -- White/blue gradient trail (or orange/yellow flame trail for Fire power-up)
- **Glass brick rendering** -- Animated diagonal highlight sweep, specular highlight, edge refraction
- **Rich particle bursts** -- 20+ particles on brick destruction with type-specific effects (glass shards, steel sparks, colored bursts)
- **Combo text** -- Floating multiplier text with increasing size and color on rapid hits
- **Level transition** -- Bricks cascade in row-by-row from the top with fade-in animation
- **Ball launch charge glow** -- Pulsing glow on paddle grows while ball is attached
- **Game over chain explosion** -- Remaining bricks explode one by one in random order
- **Animated starfield background** -- Slow-drifting stars with twinkle effect for depth
- **Barrier energy line** -- Translucent gradient at bottom when barrier is active
- Screen shake on ball loss and steel brick hits
- Confetti and floating text on level completion

### Zen Mode
- Toggled from Game menu; infinite lives, no game over
- Ball auto-launches after loss and after level transitions — no need to press Space
- Lives display shows infinity symbol
- Score still tracked normally

### Game Management
- 3 lives per game (unless Zen Mode is on)
- Idle/Playing/Paused/Game Over/Level Transition states
- Level progression with unique layouts and increasing difficulty
- High scores persisted to localStorage (top 5, with reset option)
- Status bar showing score, lives, and level

### Controls
- Left/Right arrows or A/D for paddle movement
- Mouse movement (with pointer lock) for paddle control
- Space or mouse click to launch ball
- Space or mouse click to fire lasers (with L power-up)
- P to pause/resume
- F2 for new game
- Enter to restart after game over
- Escape to close dialogs

### Integration
- Menu bar with Game menu (New Game, Pause, High Scores, Exit), View menu (Small/Large Field), and Help menu (Controls, About)
- SZ OS window management (auto-resize, close via menu)
- Dialog system for high scores, controls reference, and about info

## User Stories

### Core Gameplay
- [x] As a player, I can move the paddle with Left/Right arrows, A/D keys, or mouse (pointer lock) so that I can control the ball
- [x] As a player, I can break bricks by bouncing the ball into them so that I can score points
- [x] As a player, I can aim the ball based on where it hits the paddle so that I have directional control
- [x] As a player, I can launch the ball from the paddle with Space or mouse click so that I start each life on my terms
- [x] As a player, I can earn combo multipliers (x2!, x3!, etc.) for rapid brick hits so that skillful play is rewarded with bonus scoring
- [x] As a player, I can start with 3 lives and lose one when the ball falls past the paddle so that failure has consequences

### Brick Types
- [x] As a player, I can destroy normal gradient-shaded bricks in one hit so that basic bricks are straightforward
- [x] As a player, I can see glass bricks shatter with a crystalline effect when the ball passes through without bouncing so that they feel unique
- [x] As a player, I can hit steel bricks twice with crack overlays appearing at 1 HP so that some bricks require extra effort
- [x] As a player, I can encounter indestructible bricks with pulsing purple borders as obstacles so that I need to plan shots around them

### Power-Ups
- [x] As a player, I can collect a Wide paddle power-up (W) that expands my paddle for 10 seconds so that I can catch the ball more easily
- [x] As a player, I can collect a Multi-ball power-up (M) that spawns 2 extra balls per existing ball so that I can hit more bricks simultaneously
- [x] As a player, I can collect a Slow power-up (S) that reduces ball speed to 60% for 10 seconds so that I have more time to react
- [x] As a player, I can collect a Fire power-up (F) that lets the ball pass through bricks for 8 seconds with flame trail particles so that I can blast through rows
- [x] As a player, I can collect a Laser power-up (L) that adds cannons to my paddle for 10 seconds so that I can shoot bricks directly
- [x] As a player, I can collect a Barrier power-up (B) that creates an energy line at the bottom saving one ball so that I get a safety net
- [x] As a player, I can see pill-shaped power-up capsules with inner glow and pulsing so that they are easy to spot

### Level Design
- [x] As a player, I can play through 12 hand-crafted levels with diverse brick patterns (Diamond, Fortress, Spiral, Heart, etc.) so that each level feels fresh
- [x] As a player, I can play procedurally generated levels after the 12 designed ones are exhausted so that the game continues indefinitely
- [x] As a player, I can see the ball speed up each level (4.5 base, +0.3/level, max 9) so that difficulty increases progressively
- [x] As a player, I can see bricks cascade in row-by-row during level transitions with fade-in animation so that new levels load smoothly

### Visual Effects
- [x] As a player, I can see an electric forcefield paddle with jagged lightning arcs between metallic emitter nodes so that the game looks visually striking
- [x] As a player, I can see a comet-style ball trail with white/blue gradient (or orange/yellow flame trail for Fire) so that the ball looks dynamic
- [x] As a player, I can see rich particle bursts with type-specific effects (glass shards, steel sparks, colored bursts) when bricks break so that destruction is satisfying
- [x] As a player, I can see screen shake on ball loss and steel brick hits so that impacts feel weighty
- [x] As a player, I can see confetti and floating text on level completion so that finishing a level feels rewarding
- [x] As a player, I can see a game-over chain explosion where remaining bricks blow up in random order so that the end is dramatic
- [x] As a player, I can see an animated starfield background with twinkling stars so that the game has visual depth
- [x] As a player, I can see a ball launch charge glow that pulses while attached to the paddle so that I know it is ready

### Playfield and Display
- [x] As a player, I can choose between a Small (480x560) and Large (1200x840) playfield from the View menu so that I can pick my preferred arena size
- [x] As a player, I can resize and maximize the game window with the playfield scaling to fit while keeping aspect ratio so that it looks correct at any size
- [x] As a player, I can see the large field have more brick columns so that it fills the wider space properly

### Zen Mode
- [x] As a player, I can toggle Zen Mode from the Game menu for infinite lives and auto-launching ball so that I can relax without pressure
- [x] As a player, I can see the lives display show an infinity symbol in Zen Mode so that I know it is active
- [x] As a player, I can have the ball auto-launch after loss and level transitions in Zen Mode so that gameplay is uninterrupted

### UI and Integration
- [x] As a player, I can access Game menu (New Game, Pause, High Scores, Exit), View menu (Small/Large), and Help menu (Controls, About) so that standard management is accessible
- [x] As a player, I can pause and resume with P, restart with F2, and continue after game over with Enter so that game flow is controllable
- [x] As a player, I can have my top 5 high scores saved to localStorage with a reset option so that my best runs are remembered
- [x] As a player, I can use pointer lock for mouse control so that my cursor stays within the game

### Planned Features
- [ ] As a player, I can hear sound effects for brick destruction, power-up collection, and ball bouncing so that the game has audio feedback
- [ ] As a player, I can see a preview of the next level layout so that I can prepare my strategy
- [ ] As a player, I can encounter boss bricks that require special strategies to destroy so that certain levels have unique challenges
- [ ] As a player, I can select from multiple paddle styles or ball skins so that I can personalize my appearance
- [ ] As a player, I can see a tutorial overlay on first play explaining controls and brick types so that I learn the game quickly

## Known Limitations

- Glass brick glare animation is time-based, may look slightly different at varying frame rates
- Procedurally generated levels (beyond level 12) use a simple hash function; patterns may occasionally feel similar
- Laser bolts are simple vertical lines; no beam width collision with narrow gaps
- Barrier saves only a single ball; subsequent balls are not protected
