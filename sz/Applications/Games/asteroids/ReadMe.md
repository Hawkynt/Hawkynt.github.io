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
- [x] As a player, I can steer my ship with arrow keys or WASD, thrust with inertia, and wrap around screen edges so that movement feels smooth and arcade-authentic
- [x] As a player, I can shoot bullets with Space (hold for auto-fire) so that I can destroy asteroids and enemies without mashing keys
- [x] As a player, I can see asteroids split into smaller pieces when destroyed (large to 2 medium to 2 small) so that each rock presents cascading threats
- [x] As a player, I can hyperspace teleport on Down/S with a cooldown so that I have a last-resort escape from tight situations
- [x] As a player, I can benefit from a brief invulnerability period after respawning so that I am not instantly killed in a cluttered field
- [x] As a player, I can control my ship with mouse aim and click-to-shoot as an alternative input method so that mouse-only play is supported

### Game Modes
- [x] As a player, I can choose from 4 game modes (Classic, Survival, Zen, Hardcore) on a mode select screen so that I can pick the experience that suits my mood
- [x] As a player, I can play Classic mode with 3 lives and progressive levels so that I get the traditional arcade experience
- [x] As a player, I can play Survival mode with 1 life and endlessly spawning, accelerating asteroids so that I can test my endurance
- [x] As a player, I can play Zen mode with infinite lives and a 3-minute timer so that I can practice and score-attack without frustration
- [x] As a player, I can play Hardcore mode with 1 life, faster asteroids, and 2x score so that I face a serious challenge with high reward

### Field Sizes
- [x] As a player, I can select a field size (Small/Medium/Large/Huge) on the mode select screen so that I can choose my preferred arena scale
- [x] As a player, I can have my field size choice persisted to localStorage so that it is remembered next time I play
- [x] As a player, I can see asteroid counts and star density scale with field area so that larger fields feel appropriately populated

### Rock Types
- [x] As a player, I can face Normal rocks (1 HP) from the start so that the early game is approachable
- [x] As a player, I can face Iron rocks (2 HP, grey shimmer) from level 3 so that I encounter tougher targets requiring multiple hits
- [x] As a player, I can face Crystal rocks (3 HP, blue glow and facets) from level 6 so that high-level play has durable, visually distinct obstacles
- [x] As a player, I can face Exploding rocks (2 HP, orange pulse) from level 9 that detonate in a large AoE and chain-react so that I must consider positioning before shooting
- [x] As a player, I can face Ice rocks (2 HP, frosted surface) from level 12 that leave a slow zone on death so that destroyed ice asteroids create lingering terrain hazards
- [x] As a player, I can face Lava rocks (3 HP, magma cracks) from level 15 that leave fire trails and spawn fire patches on death so that they create dangerous areas over time
- [x] As a player, I can face Electric rocks (2 HP, crackling arcs) from level 18 that arc lightning and trigger an EMP on death disabling powerups for 3 seconds so that they introduce a high-risk tactical element
- [x] As a player, I can see child asteroids inherit their parent's rock type when splitting so that the type-specific challenge persists through the cascade
- [x] As a player, I can see HP pips displayed below multi-hit asteroids so that I can gauge remaining damage

### Zone Effects
- [x] As a player, I can see ice zones (translucent blue circles) slow all entities passing through so that destroyed ice asteroids reshape the battlefield
- [x] As a player, I can see fire patches (flickering orange circles) damage me on contact with a brief cooldown so that lava hazards are dangerous but not instant-kill
- [x] As a player, I can see proximity mines (pulsing red dots with range indicators) detonate on proximity so that mine-layer enemies create persistent threats
- [x] As a player, I can see zones visually fade as they expire so that I can judge remaining duration at a glance

### Enemy Ships
- [x] As a player, I can face UFOs (large random-fire, small aimed-fire) from level 1 so that I have a classic secondary threat
- [x] As a player, I can face Drone enemies (kamikaze swarms) from level 5 that charge directly at me so that I must react quickly
- [x] As a player, I can face Gunship enemies (3 HP, burst fire, strafing) from level 8 so that I face tougher shooters
- [x] As a player, I can face Mine-Layer enemies (2 HP, drops mines) from level 11 so that the field becomes littered with proximity hazards
- [x] As a player, I can face Stealth enemies (2 HP, cloaking cycle) from level 14 that are only hittable when visible so that I must time my shots
- [x] As a player, I can face Boss enemies (8+ HP, shield, multi-attack) every 5 levels from level 10 so that I have memorable milestone encounters
- [x] As a player, I can see at most 3 non-boss enemies on screen at once so that the game remains challenging but not overwhelming

### Ally Ships
- [x] As a player, I can receive a fighter ally every 5 levels (from level 5) with an "ALLY INCOMING!" announcement so that I get reinforcements as difficulty increases
- [x] As a player, I can see my ally follow me, target the nearest threat, and fire autonomously so that it provides meaningful combat support
- [x] As a player, I can see allies are destructible (3 HP) and drop a powerup on death so that they are valuable but temporary
- [x] As a player, I can have at most 2 concurrent allies so that assistance is significant without trivializing the game

### Powerups
- [x] As a player, I can collect 8 powerup types (Shield, Triple Shot, Rapid Fire, Piercing, Spread Shot, Homing, Extra Life, Nuke) so that gameplay variety increases over time
- [x] As a player, I can see duration powerups displayed as on-canvas HUD bars so that I can track remaining time at a glance
- [x] As a player, I can see powerup collectibles glow, spin, and fade out before despawning so that they are visually clear and urgent
- [x] As a player, I can use the Nuke to destroy all on-screen asteroids and non-boss enemies so that it serves as a powerful screen-clear
- [x] As a player, I can see the EMP from electric asteroid death suppress active duration powerups for 3 seconds with a HUD warning so that I can plan around the vulnerability

### Combo System
- [x] As a player, I can build a combo multiplier (x2 through x8) by making rapid kills within 1.5 seconds so that skillful play is rewarded
- [x] As a player, I can see the combo HUD with animated text and color progression so that my streak feels exciting

### Warp Transitions
- [x] As a player, I can see a warp-speed star-streak animation between levels so that transitions feel dramatic
- [x] As a player, I can see "LEVEL X", "BOSS FIGHT!", or "ALLY INCOMING!" announcements during warp so that I know what to expect next
- [x] As a player, I can remain invulnerable and controllable during warp so that I can reposition safely

### Scoring and Progression
- [x] As a player, I can see score account for rock type, combo, and mode multipliers so that all difficulty factors contribute to my final score
- [x] As a player, I can have high scores persisted to localStorage (top 5) with mode tracking and reset option so that my best runs are remembered
- [x] As a player, I can see a game over screen with stats (asteroids destroyed, accuracy, max combo, powerups collected) so that I can review my performance
- [x] As a player, I can earn an extra life every 10,000 points in Classic mode so that sustained play is rewarded

### Visuals and Feedback
- [x] As a player, I can see each rock type with a unique color palette, glow, and surface effect so that I can instantly identify threats
- [x] As a player, I can see each enemy type with a distinct silhouette and color so that I can recognize their behavior on sight
- [x] As a player, I can see shockwave rings, screen flashes, and particle bursts on explosions so that destruction feels impactful
- [x] As a player, I can see electric arcs rendered between nearby electric asteroids so that the battlefield looks spectacular
- [x] As a player, I can see the boss's HP bar and shield aura so that I can track fight progress
- [x] As a player, I can see a dashed/dimmed shield bubble during EMP so that I have a visual cue that my shield is suppressed

### Window and UI
- [x] As a player, I can resize and maximize the game window within SZ OS with the canvas scaling to fit so that I can play at any window size
- [x] As a player, I can see a status bar showing score, lives, level/time/wave, and mode so that key info is always visible
- [x] As a player, I can access a Controls dialog listing all keys, rock types, enemy types, powerups, and allies so that I can learn the game without external docs
- [x] As a player, I can access menu bar for New Game, Pause, High Scores, and Exit so that standard game management is a click away

### Planned Features
- [ ] As a player, I can hear sound effects for shooting, explosions, powerup collection, and warp so that the game has audio feedback
- [ ] As a player, I can see powerup rarity scale by level so that later levels drop rarer powerups more often
- [ ] As a player, I can see high scores separated by game mode so that each mode has its own leaderboard
- [ ] As a player, I can see ally ships with improved AI (formations, coordination) so that allies feel more intelligent
- [ ] As a player, I can face an EMP resistance mechanic for certain powerups so that electric rocks have more nuanced counterplay

## Known Limitations

- No sound effects (browser audio requires user interaction to initialize)
- Powerup types are evenly weighted; no rarity scaling by level
- Survival mode difficulty ramp is linear (may become overwhelming after several minutes)
- High scores are not separated by mode (shared leaderboard)
- On very large field sizes (1600) with small windows, entities appear small
- EMP disables all duration powerups equally (no resistance mechanic)
- Ally AI is simple (follow + shoot nearest); no formation or coordination
