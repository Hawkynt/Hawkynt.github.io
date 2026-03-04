# Asteroids -- Enhanced Edition

## Purpose

Classic arcade-style space shooter with modern visuals, powerups, progressive difficulty, combo scoring, multiple enemy types, ally ships, and multiple game modes. Part of the SynthelicZ Desktop game collection.

## How It Works

Canvas-based game with selectable field sizes (520 to 1600) and HiDPI support. The player controls a ship through an asteroid field, destroying asteroids and enemy ships while collecting powerups and building combos. Game effects (particles, screen shake, floating score text, shockwaves, electric arcs, zone effects) provide rich visual feedback. A procedurally generated nebula background with drifting stars and warp-speed level transitions set the atmosphere. Progressive difficulty introduces tougher rock types, enemy ship types, boss fights, and ally fighters as levels advance.

## Architecture

- **`index.html`** -- Menu bar (Game/Help), canvas, status bar, dialogs (High Scores, Controls, About)
- **`controller.js`** -- IIFE with game loop, entity management (asteroids, enemies, allies, zones), collision detection, rendering, powerup/combo/mode/warp/rock-type/enemy/ally systems
- **`styles.css`** -- Game layout (flex for resizable window), status bar, dialog styling, powerup/rock/enemy icon styles
- **Shared modules** -- `menu.js`, `dialog.js`, `game-effects.js`

## Features

### Visuals
- Deep space background with procedural nebula clouds and radial gradient
- Drifting stars with varying colors (white, blue, gold, pink) and brightness -- parallax motion during gameplay
- Warp-speed star-streak animation between levels (stars radiate outward from center)
- Filled gradient asteroids with 7 rock types, each with unique visual effects (shimmer, glow, pulsing, magma cracks, frost, electric arcs)
- Damage visualization: crack patterns appear on hit, HP pips below multi-hit asteroids
- Metallic gradient ship with cockpit light and engine flame
- Bullet trails with directional gradients and cyan/red/green glow
- 6 enemy ship types with unique silhouettes and glow effects
- Ally fighter ships with green engine trails
- Zone effects: translucent ice fields, flickering fire patches, pulsing proximity mines
- Electric arcs between nearby electric asteroids using procedural lightning
- Boss HP bar and shield aura
- Shockwave rings on all explosions
- Screen flash on big impacts (ship death, large asteroid, nuke, explosions)
- Shield bubble around ship (shimmering blue ring)
- Glowing, spinning powerup collectibles with fade-out before despawn
- Animated game over screen with pulsing title

### Field Sizes
- **Small** (520) -- Original arcade size
- **Medium** (800) -- More room to maneuver
- **Large** (1200) -- Wide-open space
- **Huge** (1600) -- Massive arena for extended play
- Selected on mode screen via left/right arrow keys; persisted to localStorage
- Asteroid count and star density scale with field area

### Resizable Window
- Window is resizable and maximizable within the SZ OS
- Canvas scales to fill available space while maintaining square aspect ratio
- Flex layout with ResizeObserver for responsive sizing
- UI text scales proportionally with field size (uiS factor)

### Game Modes
- **Classic** -- 3 lives, progressive levels, extra life every 10,000 points
- **Survival** -- 1 life, endless asteroid spawning that speeds up over time, no levels
- **Zen** -- Infinite lives, 3-minute countdown timer, score attack
- **Hardcore** -- 1 life, 1.5x asteroid speed, more asteroids per wave, faster enemies, 2x score multiplier

### Rock Types (Progressive Difficulty)
- **Normal** (all levels) -- 1 HP, standard points, brown/olive/red palettes
- **Iron** (level 3+) -- 2 HP, 1.5x points, grey/metallic palettes with animated shimmer highlight
- **Crystal** (level 6+) -- 3 HP, 2x points, blue/teal/purple palettes with glowing edges and internal facets
- **Exploding** (level 9+) -- 2 HP, 1.5x points, red/orange palettes with pulsing inner glow and ember cracks. Death triggers a large AoE explosion (120px radius) damaging all nearby asteroids, enemies, and the player. Chain reactions when exploding rocks destroy other exploding rocks.
- **Ice** (level 12+) -- 2 HP, 1.5x points, white/cyan palettes with frosted surface and occasional sparkle particles. Death creates a slow zone (80px radius, 5s) that reduces speed of all entities passing through.
- **Lava** (level 15+) -- 3 HP, 2x points, dark rock with glowing animated magma crack lines and ember particle trails. While alive, leaves small fire patches in its wake every 500ms. Death spawns 3-5 larger fire patches (25px radius, 3s) that damage the player on contact.
- **Electric** (level 18+) -- 2 HP, 2x points, pale yellow/white palette with crackling surface effects. Renders electric arcs to any asteroid or enemy within 100px. Death triggers an EMP pulse that disables all active powerups for 3 seconds.
- Hit flash on damage; crack patterns accumulate as HP decreases
- Children inherit parent rock type when asteroids split
- HP pips displayed below multi-hit asteroids

### Zone Effects
- **Ice zones** -- Translucent blue circles that slow all entities (asteroids, enemies, ship) passing through. Created by ice asteroid death.
- **Fire patches** -- Flickering orange/red circles that damage the player on contact (with brief invulnerability cooldown). Created by lava asteroid death and lava asteroid trails.
- **Proximity mines** -- Dropped by mine-layer enemies. Detonate on player or bullet proximity, dealing area damage. Pulsing red indicator with dotted range circle.
- Zones fade visually as their timer depletes and are removed when expired.

### Enemy Ships
- **UFO** (level 1+) -- Classic flying saucer. Large UFO fires randomly (200pts), small UFO fires aimed shots (1000pts). Crosses the screen horizontally.
- **Drone** (level 5+, 150pts) -- Small angular ship with red glow trail. Charges directly at the player (kamikaze). Spawns in groups of 2-3. Dies on contact.
- **Gunship** (level 8+, 500pts, 3 HP) -- Heavy angular ship with turret glow. Fires bursts of 3 aimed shots. Strafes while shooting.
- **Mine-Layer** (level 11+, 300pts, 2 HP) -- Boxy ship with yellow hazard coloring. Weaves across the field dropping proximity mines every 3 seconds.
- **Stealth** (level 14+, 800pts, 2 HP) -- Flickering purple ship. Cycles between visible (2s) and cloaked (2s). Fires aimed shot when becoming visible. Only hittable when visible.
- **Boss** (every 5 levels from 10, 2000pts base, 8+ HP scaling) -- Large imposing ship with shield aura and HP bar. Enters from top of screen. Cycles through 3 attack patterns: aimed burst, spread fire, and drone spawning. Must be killed before level asteroids spawn.
- Max 3 concurrent non-boss enemies; 1 boss at a time
- Nuke destroys all non-boss enemies

### Ally Ships
- Fighter ally spawns during warp transition every 5 levels (starting at level 5)
- "ALLY INCOMING!" announcement on spawn
- AI follows player at ~100px offset, rotates toward nearest target, fires every 800ms
- Green/teal color scheme with green engine trail and green bullet trails
- Can be destroyed by enemy bullets, asteroids, or collision (3 HP)
- On death: "ALLY LOST!" text, explosion, drops a powerup
- Max 2 concurrent allies

### Level Progression
| Level | New Content |
|-------|------------|
| 1 | 1 medium normal rock |
| 3 | Iron rocks appear |
| 5 | Drone enemies, first ally |
| 6 | Crystal rocks |
| 8 | Gunship enemies |
| 9 | Exploding rocks |
| 10 | First BOSS, ally |
| 11 | Mine-layer enemies |
| 12 | Ice rocks |
| 14 | Stealth enemies |
| 15 | Lava rocks, BOSS, ally |
| 18 | Electric rocks |
| 20+ | BOSS every 5 levels, all types mix |

### Warp Transitions
- When all asteroids and enemies are destroyed, a warp-speed animation plays before the next level
- Stars accelerate outward from center, drawing streaks that intensify then fade
- "LEVEL X" text appears during warp with glow effect
- Ally announcements and boss fight announcements appear during warp
- Screen flash on warp completion; ship is invulnerable throughout
- Ship remains controllable during warp

### Progressive Difficulty
- Level 1 starts with just 1 medium rock (easy introduction)
- Level 2+ spawns increasing numbers of large rocks
- Asteroid speed increases 5% per level
- New rock types, enemy types, and allies are progressively introduced (see level progression table)
- Boss fights every 5 levels starting at level 10 -- asteroids don't spawn until boss is defeated
- Asteroid count scales with field size

### Powerups
Dropped randomly from destroyed asteroids (5% large, 12% medium, 18% small), enemies (30%), bosses (80%), and destroyed allies (50%). Float in space for 10 seconds.
- **Shield** (S, blue) -- Absorbs one hit, 15s duration, visible as a glowing ring around the ship
- **Triple Shot** (T, orange) -- Fires 3 bullets in a spread pattern, 12s duration
- **Rapid Fire** (R, red) -- Double bullet limit (8), faster auto-fire rate, 12s duration
- **Piercing** (P, purple) -- Bullets pass through asteroids without stopping, 10s duration (disabled during EMP)
- **Spread Shot** (W, green) -- Fires 5 bullets in a wide arc, 10s duration
- **Homing** (H, cyan) -- Bullets gently curve toward nearest asteroid/enemy, 10s duration (disabled during EMP)
- **Extra Life** (+, green) -- Instant +1 life
- **Nuke** (N, yellow) -- Destroys all on-screen asteroids and non-boss enemies instantly with screen flash

### Combo System
- Rapid kills within 1.5 seconds build a combo multiplier (x2 through x8)
- Multiplier applies to all scoring (asteroids, enemies)
- Combo displayed as animated text in the HUD with color progression (white to gold to red to purple)
- Breaking the combo chain (no kill for 1.5s) resets to x1

### Gameplay
- Ship rotation, thrust with inertia/friction, screen-edge wrapping
- Auto-fire when holding Space (180ms normal, 70ms with Rapid Fire)
- Hyperspace teleport with cooldown (500ms) and shockwave effect
- Three asteroid sizes with cascading splits (large -> 2 medium -> 2 small)
- Scoring: large = 20pts, medium = 50pts, small = 100pts (before rock type, combo, and mode multipliers)
- Multiple enemy ship types with unique AI patterns (see Enemy Ships section)
- Ally ships that assist the player (see Ally Ships section)
- Ship collision bypasses asteroid HP (instant destruction)
- Invulnerability period (2s) after respawning
- EMP from electric asteroid death temporarily disables duration powerups (3s)
- Zone effects from ice, lava, and mine-layer create environmental hazards

### Game Management
- Mode selection screen at startup (press 1-4)
- Field size picker on mode select (left/right arrows)
- Pause/resume (P key)
- New game (F2 returns to mode select)
- Game over screen with stats: asteroids destroyed, accuracy %, max combo, powerups collected
- High scores persisted to localStorage (top 5, with mode tracking and reset option)
- Status bar showing score, lives, level/time/wave, and current mode
- Active powerup timers displayed as on-canvas HUD bars
- EMP active warning indicator

### Controls
- Arrow keys or WASD for movement
- Space to shoot (hold for auto-fire)
- Down/S for hyperspace
- P to pause
- F2 for new game / mode select
- 1-4 to select game mode
- Left/Right arrows to change field size (mode select screen)
- Escape to close dialogs

### Integration
- Menu bar with Game menu (New Game, Pause, High Scores, Exit) and Help menu (Controls, About)
- SZ OS window management (resizable, maximizable, close via menu)
- Dialog system for high scores, controls reference, and about info

## User Stories

### Core Gameplay
- As a player, I want to steer my ship with arrow keys or WASD, thrust with inertia, and wrap around screen edges so movement feels smooth and arcade-authentic.
- As a player, I want to shoot bullets with Space (hold for auto-fire) so I can destroy asteroids and enemies without mashing keys.
- As a player, I want asteroids to split into smaller pieces when destroyed (large->2 medium->2 small) so each rock presents cascading threats.
- As a player, I want a hyperspace teleport on Down/S with a cooldown so I have a last-resort escape from tight situations.
- As a player, I want a brief invulnerability period after respawning so I am not instantly killed in a cluttered field.

### Game Modes
- As a player, I want to choose from 4 game modes (Classic, Survival, Zen, Hardcore) on a mode select screen so I can pick the experience that suits my mood.
- As a player, I want Classic mode with 3 lives and progressive levels so I get the traditional arcade experience.
- As a player, I want Survival mode with 1 life and endlessly spawning, accelerating asteroids so I can test my endurance.
- As a player, I want Zen mode with infinite lives and a 3-minute timer so I can practice and score-attack without frustration.
- As a player, I want Hardcore mode with 1 life, faster asteroids, and 2x score so I face a serious challenge with high reward.

### Field Sizes
- As a player, I want to select a field size (Small/Medium/Large/Huge) on the mode select screen so I can choose my preferred arena scale.
- As a player, I want my field size choice persisted to localStorage so it is remembered next time I play.
- As a player, I want asteroid counts and star density to scale with field area so larger fields feel appropriately populated.

### Rock Types
- As a player, I want Normal rocks (1 HP) from the start so the early game is approachable.
- As a player, I want Iron rocks (2 HP, grey shimmer) appearing from level 3 so I face tougher targets that require multiple hits.
- As a player, I want Crystal rocks (3 HP, blue glow and facets) appearing from level 6 so high-level play has durable, visually distinct obstacles.
- As a player, I want Exploding rocks (2 HP, orange pulse) from level 9 that detonate in a large AoE on death, chain-reacting with nearby exploding rocks, so I must consider positioning before shooting.
- As a player, I want Ice rocks (2 HP, frosted surface) from level 12 that leave a slow zone on death so destroyed ice asteroids create lingering terrain hazards.
- As a player, I want Lava rocks (3 HP, magma cracks) from level 15 that leave fire trails while alive and spawn fire patches on death so they create dangerous areas over time.
- As a player, I want Electric rocks (2 HP, crackling arcs) from level 18 that arc lightning to nearby objects and trigger an EMP on death disabling my powerups for 3 seconds so they introduce a high-risk tactical element.
- As a player, I want child asteroids to inherit their parent's rock type when splitting so the type-specific challenge persists through the cascade.
- As a player, I want HP pips displayed below multi-hit asteroids so I can see how much damage remains.

### Zone Effects
- As a player, I want ice zones (translucent blue circles) to slow all entities passing through so destroyed ice asteroids reshape the battlefield.
- As a player, I want fire patches (flickering orange circles) to damage me on contact with a brief cooldown so lava hazards are dangerous but not instant-kill.
- As a player, I want proximity mines (pulsing red dots with range indicators) to detonate when I or my bullets get too close so mine-layer enemies create persistent threats.
- As a player, I want zones to visually fade as they expire so I can judge remaining duration at a glance.

### Enemy Ships
- As a player, I want UFOs (large random-fire, small aimed-fire) from level 1 crossing the screen so I face a classic secondary threat.
- As a player, I want Drone enemies (kamikaze swarms of 2-3) from level 5 that charge directly at me so I must react quickly to fast-moving threats.
- As a player, I want Gunship enemies (3 HP, burst fire, strafing) from level 8 so I face a tougher, more aggressive shooter.
- As a player, I want Mine-Layer enemies (2 HP, drops mines) from level 11 so the field becomes littered with proximity hazards.
- As a player, I want Stealth enemies (2 HP, cloaking cycle) from level 14 that are only hittable when visible so I must time my shots.
- As a player, I want Boss enemies (8+ HP, shield, multi-attack) every 5 levels starting at 10 that block asteroid spawning until defeated so I face memorable milestone encounters.
- As a player, I want at most 3 non-boss enemies on screen at once so the game remains challenging but not overwhelming.
- As a player, I want enemy type variety to scale with level so each session feels progressively more diverse.

### Ally Ships
- As a player, I want a fighter ally to warp in every 5 levels (from level 5) with an "ALLY INCOMING!" announcement so I receive reinforcements as difficulty increases.
- As a player, I want my ally to follow me at a distance, target the nearest asteroid or enemy, and fire autonomously so it provides meaningful combat support.
- As a player, I want allies to be destructible (3 HP) so they are a valuable but temporary resource.
- As a player, I want destroyed allies to drop a powerup so their loss at least yields a consolation reward.
- As a player, I want at most 2 concurrent allies so assistance is significant without trivializing the game.

### Powerups
- As a player, I want 8 powerup types (Shield, Triple Shot, Rapid Fire, Piercing, Spread Shot, Homing, Extra Life, Nuke) dropped from destroyed entities so gameplay variety increases over time.
- As a player, I want duration powerups displayed as on-canvas HUD bars so I can see remaining time at a glance.
- As a player, I want powerup collectibles to glow, spin, and fade out before despawning so they are visually clear and urgent.
- As a player, I want the Nuke to destroy all on-screen asteroids and non-boss enemies so it serves as a powerful screen-clear.
- As a player, I want the EMP from electric asteroid death to suppress all active duration powerups for 3 seconds (including shield protection, piercing, homing, and shot modifiers) with a visible HUD warning so I understand and can plan around the temporary vulnerability.

### Combo System
- As a player, I want rapid kills within 1.5 seconds to build a combo multiplier (x2 through x8) so skillful play is rewarded with higher scores.
- As a player, I want the combo HUD to show animated text with color progression so my streak feels exciting.

### Warp Transitions
- As a player, I want a warp-speed star-streak animation between levels so level transitions feel dramatic.
- As a player, I want "LEVEL X" text during warp and "BOSS FIGHT!" or "ALLY INCOMING!" announcements so I know what to expect next.
- As a player, I want to remain invulnerable and controllable during warp so I can reposition safely.

### Scoring and Progression
- As a player, I want score to account for rock type multiplier, combo multiplier, and mode multiplier so all difficulty factors contribute to my final score.
- As a player, I want high scores persisted to localStorage (top 5) with mode tracking and a reset option so my best runs are remembered.
- As a player, I want a game over screen showing stats (asteroids destroyed, accuracy, max combo, powerups collected) so I can review my performance.
- As a player, I want an extra life every 10,000 points in Classic mode so sustained play is rewarded.

### Visuals and Feedback
- As a player, I want each rock type to have a unique color palette, glow, and surface effect so I can instantly identify threats.
- As a player, I want each enemy type to have a distinct silhouette and color so I can recognize their behavior on sight.
- As a player, I want shockwave rings, screen flashes, and particle bursts on explosions so destruction feels impactful.
- As a player, I want electric arcs rendered between nearby electric asteroids so the battlefield looks spectacular.
- As a player, I want the boss's HP bar and shield aura to be clearly visible so I can track fight progress.
- As a player, I want a dashed/dimmed shield bubble during EMP so I have a visual cue that my shield is suppressed.

### Window and UI
- As a player, I want the game window to be resizable and maximizable within SZ OS with the canvas scaling to fit so I can play at any window size.
- As a player, I want a status bar showing score, lives, level/time/wave, and mode so key info is always visible.
- As a player, I want a Controls dialog listing all keys, rock types, enemy types, powerups, and allies so I can learn the game without external docs.
- As a player, I want menu bar access to New Game, Pause, High Scores, and Exit so standard game management is a click away.

## Known Limitations

- No sound effects (browser audio requires user interaction to initialize)
- Powerup types are evenly weighted; no rarity scaling by level
- Survival mode difficulty ramp is linear (may become overwhelming after several minutes)
- High scores are not separated by mode (shared leaderboard)
- On very large field sizes (1600) with small windows, entities appear small
- EMP disables all duration powerups equally (no resistance mechanic)
- Ally AI is simple (follow + shoot nearest); no formation or coordination
