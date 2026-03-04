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

- As a player, I want to move the paddle with keyboard or mouse so I can control the ball
- As a player, I want to break bricks by bouncing the ball into them so I can score points
- As a player, I want the ball angle to change based on where it hits the paddle so I can aim
- As a player, I want power-ups to drop from bricks so the gameplay has variety
- As a player, I want a wide paddle power-up so I can catch the ball more easily
- As a player, I want a multi-ball power-up so I can hit more bricks simultaneously
- As a player, I want a slow-motion power-up so I have more time to react
- As a player, I want a fire ball power-up so I can blast through multiple bricks
- As a player, I want a laser power-up so I can shoot bricks directly
- As a player, I want a barrier power-up so I get a safety net for one ball
- As a player, I want different level layouts so each level feels fresh
- As a player, I want glass bricks that shatter when hit for satisfying visual feedback
- As a player, I want steel bricks that take 2 hits so some bricks feel more challenging
- As a player, I want indestructible bricks as obstacles so I need to plan my shots
- As a player, I want an electric forcefield paddle so the game looks visually striking
- As a player, I want to see rich particle effects when bricks break so the game feels satisfying
- As a player, I want combo scoring for rapid hits so skillful play is rewarded
- As a player, I want the ball to speed up each level so the game gets progressively harder
- As a player, I want to use pointer lock for mouse control so I can play without the cursor leaving the game
- As a player, I want confetti when I complete a level so it feels rewarding
- As a player, I want my high scores saved so I can track my best performances
- As a player, I want to pause the game so I can take a break
- As a player, I want smooth level transitions with brick entry animations
- As a player, I want to choose between a small and large playfield so I can pick the experience I prefer
- As a player, I want the large field to have more brick columns so it fills the wider space
- As a player, I want to resize and maximize the game window so it fits my screen
- As a player, I want the playfield to scale to the window size while keeping its aspect ratio so it always looks correct
- As a player, I want a zen mode with infinite lives so I can relax without pressure
- As a player, I want the ball to auto-launch in zen mode so I never have to press Space
- As a player, I want zen mode to auto-launch after level transitions so gameplay is uninterrupted
- As a player, I want the lives display to show an infinity symbol in zen mode so I know it is active
- As a player, I want to toggle zen mode from the Game menu at any time during a session
- As a player, I want a starfield background so the game has visual depth
- As a player, I want a game-over chain explosion so remaining bricks blow up dramatically
- As a player, I want a ball charge glow while it is attached to the paddle so I can see it powering up
- As a player, I want pill-shaped power-up capsules with glow and pulsing so they are easy to spot
- As a player, I want paddle impact sparks when the ball bounces so collisions feel impactful
- As a player, I want a comet-style ball trail so the ball looks dynamic in motion

## Known Limitations

- Glass brick glare animation is time-based, may look slightly different at varying frame rates
- Procedurally generated levels (beyond level 12) use a simple hash function; patterns may occasionally feel similar
- Laser bolts are simple vertical lines; no beam width collision with narrow gaps
- Barrier saves only a single ball; subsequent balls are not protected
