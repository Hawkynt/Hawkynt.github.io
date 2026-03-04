# Pac-Man

## Purpose

Classic arcade maze chase game where the player navigates Pac-Man through a maze, eating dots and power pellets while avoiding four ghosts with distinct AI personalities. Features world themes that change every 4 levels, a powerup system, boss encounters, rich visual effects, and resizable window support. Part of the SynthelicZ Desktop game collection.

## How It Works

Canvas-based game rendered at 448x496 (28x31 tile grid, 16px tiles) with HiDPI support and dynamic canvas scaling via ResizeObserver. The maze is defined as a 2D array with wall, dot, power pellet, empty, ghost house, and gate tile types. Walls are pre-rendered to an offscreen cache with glow effects for performance. Four ghosts (Blinky, Pinky, Inky, Clyde) use authentic chase/scatter AI algorithms with Cruise Elroy speed bonuses. Game effects come from the shared `game-effects.js` module.

## Architecture

- **`index.html`** -- Menu bar (Game/Help), canvas, status bar (score/lives/level/effects), dialogs (High Scores, Controls, About)
- **`controller.js`** -- IIFE with maze logic, Pac-Man movement, ghost AI, collision detection, powerup system, boss encounters, level progression, game states, rendering
- **`styles.css`** -- Flex layout for resizable canvas and visual styling
- **Shared modules** -- `menu.js`, `dialog.js`, `game-effects.js`

## Features

### Resizable Window

- Window is resizable and maximizable via the SZ OS window manager
- Canvas scales to fill the game frame while preserving the correct 448:496 aspect ratio
- ResizeObserver automatically adjusts display size on window resize
- Internal rendering resolution stays fixed at 448x496 with HiDPI scaling for crisp visuals at any display size

### World Theme System

- 8 distinct color themes cycle every 4 levels (1 world = 4 levels)
- Themes: Classic Blue, Red, Green, Magenta, Yellow, Cyan, Orange, Purple
- Each theme defines wall color, wall glow, background, and dot color
- Maze cache is rebuilt on theme change for glowing wall rendering

### Gameplay

- Full maze with dots (10pts each) and 4 power pellets (50pts each)
- 4 ghosts with authentic AI behaviors:
  - **Blinky (Red)** -- Targets Pac-Man directly; gains Cruise Elroy speed boost when few dots remain
  - **Pinky (Pink)** -- Targets 4 tiles ahead of Pac-Man (with original up-left bug)
  - **Inky (Cyan)** -- Uses Blinky's position to calculate target via vector doubling
  - **Clyde (Orange)** -- Chases when far (>8 tiles), scatters when close
- Ghost mode alternation: Scatter (7s) / Chase (20s) cycling with authentic timing
- Frightened mode from power pellets (duration scales per level: 6s down to 2s)
- Ghost eating with escalating points: 200, 400, 800, 1600 (affected by score multiplier)
- Eaten ghosts return to ghost house as eyes
- Ghost house with staggered release timers
- Tunnel wrapping on the sides of the maze with ghost speed reduction in tunnels
- Directional restriction zones (ghosts can't go up at certain intersections)

### Level Progression

- 5-tier level configuration controlling Pac-Man speed, ghost speed, frightened duration, tunnel speed, and Cruise Elroy thresholds
- Cruise Elroy: Blinky gets faster when remaining dots fall below thresholds (elroy1 and elroy2 tiers)
- Tunnel speed: ghosts slow down in tunnel zones (x < 6 or x > 21)
- Frightened duration decreases per level tier (6000ms → 2000ms)
- Intermission screen plays between worlds with animated Pac-Man/ghost chase scene

### Powerup System

- Powerup items spawn on random empty tiles after 30 dots eaten, every 15 seconds
- Items blink when about to expire (after 7s of 10s lifetime) and disappear at 10s
- 6 powerup types:
  - **Speed+** (yellow lightning) -- Pac-Man moves 40% faster for 5s
  - **Freeze** (cyan snowflake) -- All non-eaten ghosts freeze in place for 4s
  - **2x Score** (orange star) -- All scoring doubled for 8s
  - **Extra Life** (green heart) -- Immediately grants 1 extra life
  - **Magnet** (magenta diamond) -- Auto-collects dots within 3-tile Manhattan distance for 6s
  - **Phase** (white circle) -- Pac-Man can walk through walls for 3s (semi-transparent visual)
- Active effects displayed in status bar with remaining duration
- Effects cleared on death

### Boss Encounters

- Boss fight triggers every 4th level (end of each world)
- 4 boss types cycling: Shadow King (summon), Phantom Queen (teleport), Spectral Lord (freeze), Clyde Supreme (split)
- Boss is a 2.5x sized ghost with crown, floating above the maze, chasing Pac-Man
- Boss HP scales: 8 base + 4 per boss number
- Boss uses its special ability every ~5 seconds, then becomes stunned for 1.5s
- Eating a power pellet while boss is stunned makes the boss vulnerable
- Touching a vulnerable boss deals 1 HP damage (2s invulnerability cooldown)
- At half HP, boss enters Phase 2: faster movement, shorter ability cooldown
- Boss abilities:
  - **Summon** -- Spawns 2 mini-ghost minions that chase Pac-Man for 8s
  - **Teleport** -- Boss warps to a random position with particle burst
  - **Freeze** -- Slows Pac-Man to 50% speed for 3s
  - **Split** -- Creates 2 minion copies that chase for 6s
- Minions can be eaten during frightened mode for 200 points
- Defeating boss awards 5000 x boss number points, triggers massive celebration effects
- Maze refills with dots if cleared during boss fight (ensures power pellets stay available)
- Boss intro screen with "WARNING" flash and boss name reveal
- Boss victory screen before advancing to next world

### Fruit System

- Fruit spawns at 70 and 170 dots eaten
- 8 fruit types with level-based progression: Cherry (100), Strawberry (300), Orange (500), Apple (700), Melon (1000), Galaxian (2000), Bell (3000), Key (5000)
- 9-second timeout per fruit appearance
- Fruit has pulsing glow and bobbing animation

### Enhanced Visual Effects

- **Glowing maze walls**: Pre-rendered to offscreen cache with shadowBlur for efficient per-frame rendering
- **Golden Pac-Man aura**: drawGlow wrapper for golden glow effect
- **Pac-Man trail**: Golden trail particles emitted every 3 frames while moving
- **Ghost glow**: Normal ghosts have subtle shadow glow matching their color
- **Frightened ghost aura**: Blue glow around frightened ghosts
- **Dot chain system**: Consecutive dots eaten within 500ms build a chain; sparkle count scales with chain length; confetti burst at 5/10/20/50 chain thresholds with floating "Nx CHAIN!" text
- **Electric arcs**: Brief lightning arc from Pac-Man to eaten ghost
- **Ghost eating effects**: 25-particle burst + confetti + screen shake (4, 200ms) + electric arc
- **Death effects**: 50-particle golden burst + screen shake (12, 600ms)
- **Level complete celebration**: Confetti center burst + sparkle bursts in corners + floating "LEVEL COMPLETE!" text + maze blue/white flash
- **Power pellet pulsing glow**: Animated size and glow intensity
- **Fruit pulsing and bobbing**: Sinusoidal vertical bob + size pulse with glow
- **Powerup item rendering**: Pulsing glow with blinking near expiry; unique icon per type (lightning, snowflake, star, heart, diamond, circle)
- **Boss rendering**: Large ghost body with crown, tracking eyes, glow aura, wavy skirt; pulsing in Phase 2; stunned flicker; HP bar with color gradient
- **Phasing visual**: Semi-transparent flickering Pac-Man during Phase powerup
- Animated Pac-Man mouth (opening/closing with direction rotation)
- Ghost body with wavy animated skirt
- Direction-tracking ghost eyes
- Frightened ghost with squiggly mouth and blue body
- Flashing blue/white warning before frightened mode ends
- Dying animation (Pac-Man shrinks)

### Game Management

- 3 lives per game
- Game states: idle, ready, playing, dying, paused, gameover, levelcomplete, intermission, bossIntro, bossVictory
- "READY!" text before each life starts
- Level progression with configurable speed/difficulty tiers
- High scores persisted to localStorage (top 5, with reset option)
- Status bar showing score, lives, level, and active powerup effects

### Controls

- Arrow keys or WASD for directional movement
- Queued direction input (direction change buffers for next intersection)
- P to pause/resume
- Space to start game / restart after game over
- F2 for new game
- Escape to close dialogs

### Integration

- Menu bar with Game menu (New Game, Pause, High Scores, Exit) and Help menu (Controls, About)
- SZ OS window management (resizable, maximizable, close via menu)
- Dialog system for high scores, controls reference, and about info

## User Stories

- As a player, I want to navigate Pac-Man through the maze so I can eat all the dots
- As a player, I want four ghosts with different AI personalities so the game has strategic depth
- As a player, I want power pellets to turn ghosts blue so I can eat them for bonus points
- As a player, I want ghost eating points to escalate (200-1600) so I'm rewarded for chaining
- As a player, I want eaten ghosts to return to the ghost house as eyes so they can respawn
- As a player, I want a flashing warning before frightened mode ends so I know when to retreat
- As a player, I want fruit to appear for bonus points so there are extra scoring opportunities
- As a player, I want the maze to flash when I complete a level so it feels celebratory
- As a player, I want tunnel wrapping so I can use the side passages as escape routes
- As a player, I want queued directional input so I can plan turns in advance
- As a player, I want my high scores saved so I can track my best performances
- As a player, I want a "READY!" countdown so I can prepare before each life begins
- As a player, I want a dying animation so life loss has visual feedback
- As a player, I want the window to be resizable so I can play at any size
- As a player, I want world themes to change every 4 levels so the game stays visually fresh
- As a player, I want glowing walls and particle effects so the game looks modern and polished
- As a player, I want dot chains to reward fast eating with visual celebrations
- As a player, I want electric arcs when eating ghosts for dramatic impact
- As a player, I want powerup items to spawn so I get temporary strategic advantages
- As a player, I want a speed boost powerup so I can outrun ghosts when needed
- As a player, I want a freeze powerup so I can safely navigate through ghosts
- As a player, I want a score multiplier powerup so I can maximize my score
- As a player, I want an extra life powerup as a rare survival bonus
- As a player, I want a magnet powerup to vacuum nearby dots automatically
- As a player, I want a phase powerup to walk through walls as a shortcut
- As a player, I want active powerup effects shown in the status bar so I know what's active
- As a player, I want difficulty to scale per level (ghost speed, frightened duration, Cruise Elroy) so later levels are challenging
- As a player, I want intermission screens between worlds for a brief visual break
- As a player, I want boss fights every 4 levels for an exciting challenge
- As a player, I want bosses to have unique abilities so each fight feels different
- As a player, I want a boss HP bar so I can track my progress during the fight
- As a player, I want bosses to enter Phase 2 at half health for escalating tension
- As a player, I want massive celebration effects when defeating a boss for a sense of accomplishment

## Known Limitations

- Boss movement is free-floating (not tile-constrained) since 2.5x size cannot navigate standard corridors
- Powerup spawn positions exclude the ghost house area but may rarely spawn in hard-to-reach corridor sections
- Phase powerup allows Pac-Man through walls but not through the ghost house gate
- Magnet powerup only pulls regular dots, not power pellets
- Boss freeze ability slows Pac-Man but does not affect powerup timers
- Electric arc visual is purely decorative (randomized path each frame)
