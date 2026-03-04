# Snake

## Purpose

Snake game with multiple game modes. Guide a growing snake to eat food while avoiding collisions. Choose from presets (Classic, Tron, Maze Runner, Battle Royale, Zen) or customize walls, obstacles, AI enemies, power-ups, field size, and speed. Part of the SynthelicZ Desktop game collection.

## How It Works

Canvas-based game with HiDPI support. The snake moves on a fixed-interval tick system with linear interpolation between ticks for smooth rendering. Grid size adapts to the selected field size (15x15, 20x20, or 80x60 at 20px logical cell size). The canvas scales to fill the available window viewport while preserving aspect ratio -- the window can be freely resized or maximized and the game scales to fit. A New Game options dialog appears at launch and on F2/Space, allowing full mode customization. Configuration persists to localStorage.

## Architecture

- **`index.html`** -- Menu bar (Game/Help), canvas, status bar (score/length/level/effects), dialogs (Options, High Scores, Controls, About)
- **`controller.js`** -- IIFE with game config system, tick-based movement, AI pathfinding (BFS), power-up engine, obstacle generation, interpolated rendering
- **`styles.css`** -- Game layout, options dialog fieldsets, status bar
- **Shared modules** -- `menu.js`, `dialog.js`, `game-effects.js`

## Features

### Game Modes & Options

Every new game opens an options dialog with:

**Quick Presets:**
- **Classic** -- solid walls, no obstacles, no enemies, no power-ups, medium, normal speed
- **Tron** -- wrap-around, no obstacles, 2 AI, no power-ups, medium, fast speed. Activates Tron visual mode (see below)
- **Maze Runner** -- solid walls, maze, no enemies, power-ups, large, normal speed
- **Battle Royale** -- wrap-around, random blocks, 3 AI, power-ups, large, fast speed
- **Zen** -- wrap-around, no obstacles, no enemies, power-ups, medium, slow speed

**Configurable Options:**
- Walls: solid (death on edge) or wrap-around (exit one side, enter opposite)
- Obstacles: none, random blocks, maze (symmetric corridors), or growing walls (adds a block every 3 foods)
- Enemies: 0-3 AI snakes with BFS pathfinding toward food
- Power-ups: toggle on/off (6 types with timed effects)
- Field size: small 15x15, medium 20x20, large 80x60
- Speed: slow (200ms), normal (150ms), fast (100ms), insane (60ms)

### Tron Mode

Selecting the Tron preset activates a distinct visual and gameplay mode inspired by Tron light cycles:

- **Dark neon aesthetic** -- near-black background (`#050510`) with enhanced neon grid
- **Enhanced neon grid** -- minor grid lines with subtle blue glow (`shadowBlur: 2`), major grid lines every 5 cells with prominent neon glow (`shadowBlur: 6`), bright glowing border (`shadowBlur: 8`)
- **Neon line trails** -- player trail in cyan (`#00e5ff`), AI trails in orange/purple/red, drawn as glowing 5px lines with `shadowBlur` neon effect
- **Motorcycle rider heads** -- top-down sporty rider sprite (pointed nose, handlebars, helmet) rendered via canvas paths, rotates with movement direction
- **Permanent trails** -- no tail shrinking; trails grow indefinitely as light cycle walls
- **Energy cube food** -- pulsing outlined cyan square with glow instead of the apple
- **Tron-styled overlays** -- cyan text with neon glow on darker overlay background, title shows "TRON" instead of "SNAKE"
- **Tron death particles** -- crash particles use the neon trail color of the crashed snake

All other game mechanics (AI pathfinding, collision, scoring, power-ups if enabled via custom config) remain the same. Switching to any other preset returns to standard snake rendering.

### Zen Mode

Selecting the Zen preset activates a nature-themed visual mode with a calm atmosphere:

- **Dark green background** -- very dark green (`#0a1a0a`) for a forest-at-night feel
- **Floating leaves** -- ~18 animated leaf shapes drifting across the screen in various greens, with sinusoidal horizontal wobble, rotation, and edge wrapping. Leaves drift even while paused
- **Leaf rendering** -- each leaf drawn as a colored ellipse with a central vein line and short stem
- **Green-tinted grid** -- subtle green grid lines (`rgba(34,139,34,0.06)`) with green border
- **Standard snake and food** -- green snake and apple food fit the nature theme naturally
- **Green-tinted overlays** -- overlay text in green (`#81c784` / `#4caf50`), title shows "ZEN" instead of "SNAKE"

### Maze Runner Mode

Selecting the Maze Runner preset activates an ancient dungeon visual theme:

- **Brick tile background** -- pre-rendered running bond brick pattern with position-seeded color variation and mortar lines, drawn as a single `drawImage()` each frame for performance
- **Dark stone obstacles** -- maze walls rendered as dark stone blocks (`#5d4037`) with highlight/shadow edges instead of standard gray blocks
- **Torch flame head** -- animated flickering flame as the snake head, composed of 4 layered ellipses with oscillating sizes from `sin/cos` at different frequencies, plus a bright core
- **Ember trail body** -- body segments rendered as ember dots fading from orange (`#ff6d00`) to dark red (`#4e342e`) toward the tail, with subtle inner glow near the head
- **Golden spinning coin food** -- food rendered as an animated golden coin with scale-X oscillation (spin effect), inner ring, `$` symbol when face-on, and a circling glint sparkle
- **Orange tail trail particles** -- movement trail particles in orange (`rgba(255,109,0,0.4)`) instead of green
- **Ember death particles** -- death explosion uses orange/ember colors instead of red/green
- **Gold-themed overlays** -- overlay text in gold (`#ffd700`) on dark brown background, title shows "DUNGEON" instead of "SNAKE"

### AI Enemies

- 1-3 AI snakes with unique colors (orange, purple, cyan)
- BFS pathfinding toward nearest food each tick, random fallback when no path exists
- Grow when eating food, die on collision (walls/obstacles/any snake body/self)
- Respawn after 3-second delay at random empty location
- AI death awards player +50 bonus points with floating text

### Power-ups

One power-up on field at a time. Spawns 3s after previous collected/expired. 15s field lifetime (blinks last 3s). Six types:

| Icon | Name | Effect | Duration |
|------|------|--------|----------|
| Lightning | Speed+ | Move 40% faster | 8s |
| Clock | Slow | Move 40% slower | 8s |
| Star | Shield | Survive one collision (absorbs hit) | until used |
| Minus | Shrink | Lose up to 3 segments, +30 pts | instant |
| Diamond | Magnet | Food spawns adjacent to head | 10s |
| Circle | Ghost | Pass through own body | 5s |

Active effects shown in status bar with remaining time.

### Gameplay

- Snake starts at center with length 3, moving right
- Food spawns at random unoccupied positions (adjacent to head when magnet active)
- Eating food grows the snake by 1 segment and awards points (10 x level)
- Speed increases every 5 foods collected (base interval minus 10ms per level)
- Opposite-direction input blocked to prevent instant self-collision
- Obstacles rendered as dark gray inset blocks
- Canvas scales to fill window viewport, preserving aspect ratio (supports resize and maximize)

### Visual Effects

- Smooth interpolated movement between ticks (lerp with wrap-around handling)
- Snake head with animated eyes that follow direction
- Body gradient from bright to dark with tapering segments
- Shield indicator ring around head when shield active
- Ghost transparency when ghost active
- Food rendered as a detailed apple with pulsing glow
- Power-up items with colored glow, icon shapes, and blink before expiry
- Subtle grid overlay
- Particle burst on food/power-up collection (multicolored)
- Tail trail particles on movement
- Death particle explosion (red burst from head, green scatter from body)
- Screen shake on death
- Floating score/effect text
- "LEVEL X!" floating text on level-up

### Game Management

- New Game options dialog on launch, F2, and Space
- Pause/resume (P key) -- game auto-pauses when dialog opens
- Game over with final score display
- High scores persisted to localStorage (top 5, tracks score and length, with reset option)
- Game config persisted to localStorage across sessions
- Status bar showing score, length, level, and active power-up effects

### Controls

- Arrow keys or WASD for directional movement
- Space to open New Game dialog (from title screen or game over)
- F2 to open New Game dialog
- P to pause/resume
- Enter to accept the focused dialog (Start in options, OK elsewhere)
- Escape to close dialogs (Cancel on options dialog if game was paused)

### Integration

- Menu bar with Game menu (New Game..., Pause, High Scores, Exit) and Help menu (Controls, About)
- SZ OS window management (auto-resize for field size, close via menu)
- Dialog system for options, high scores, controls reference, and about info

## User Stories

### Game Setup & Configuration

- As a player, I want to choose from quick presets (Classic, Tron, Maze Runner, Battle Royale, Zen) so that I can jump into a curated experience without configuring every option.
- As a player, I want to customize walls, obstacles, enemies, power-ups, field size, and speed individually so that I can create my own game mode.
- As a player, I want my game configuration to persist across sessions so that I don't have to reconfigure every time I play.
- As a player, I want the options dialog to appear on launch, F2, and Space so that I can always start a new game easily.
- As a player, I want to accept dialogs with Enter so that I can start games quickly from the keyboard.
- As a player, I want to close dialogs with Escape so that I can cancel and return to a paused game.

### Core Gameplay

- As a player, I want to guide a snake that grows when eating food so that I have a clear objective and increasing difficulty.
- As a player, I want food to spawn at random unoccupied positions so that each game feels different.
- As a player, I want the game speed to increase every 5 foods collected so that the challenge ramps up as I progress.
- As a player, I want opposite-direction input to be blocked so that I can't accidentally reverse into myself.
- As a player, I want an input queue (up to 3 inputs) so that rapid direction changes are registered even between ticks.
- As a player, I want to score points based on the current level (10 x level per food) so that later foods are worth more.

### Wall & Obstacle Modes

- As a player, I want solid walls that kill on contact so that edge awareness is part of the challenge.
- As a player, I want wrap-around walls where I exit one side and enter the opposite so that the field feels infinite.
- As a player, I want random block obstacles so that I must navigate around unpredictable hazards.
- As a player, I want maze obstacles with symmetric corridors so that I can play a maze-navigation variant.
- As a player, I want growing walls that add a block every 3 foods so that the field becomes progressively harder.

### Field Size & Viewport

- As a player, I want to choose between small (15x15), medium (20x20), and large (80x60) field sizes so that I can pick the scale I prefer.
- As a player, I want the canvas to scale to fill the window viewport while preserving aspect ratio so that the game looks good at any window size.
- As a player, I want to resize and maximize the game window so that I can play at whatever size suits my screen.

### AI Enemies

- As a player, I want 1-3 AI snakes with BFS pathfinding so that I have competitive opponents seeking food.
- As a player, I want AI snakes to die on collision and respawn after 3 seconds so that the field stays dynamic.
- As a player, I want to earn +50 bonus points when an AI snake dies so that there is a reward for outlasting enemies.
- As a player, I want AI snakes to have distinct colors (orange, purple, cyan) so that I can tell them apart.

### Power-ups

- As a player, I want one power-up on the field at a time, spawning 3 seconds after the previous one, so that power-ups feel special without cluttering the field.
- As a player, I want power-ups to blink during their last 3 seconds and disappear after 15 seconds so that I know when they're about to expire.
- As a player, I want a Speed+ power-up (lightning icon) that makes me 40% faster for 8 seconds so that I can collect food more aggressively.
- As a player, I want a Slow power-up (clock icon) that makes me 40% slower for 8 seconds so that I get breathing room in tight situations.
- As a player, I want a Shield power-up (star icon) that absorbs one collision so that I get a second chance.
- As a player, I want a Shrink power-up (minus icon) that removes up to 3 segments and awards 30 points so that I can trim my tail.
- As a player, I want a Magnet power-up (diamond icon) that spawns food adjacent to my head for 10 seconds so that I can eat rapidly.
- As a player, I want a Ghost power-up (circle icon) that lets me pass through my own body for 5 seconds so that I can escape tight coils.
- As a player, I want active effects shown in the status bar with remaining time so that I know what's active and when it expires.

### Tron Mode

- As a player, I want the Tron preset to activate a dark neon aesthetic with a near-black background so that it feels like Tron.
- As a player, I want an enhanced neon grid with subtle minor lines and prominent glowing major lines every 5 cells so that the grid looks like a digital arena.
- As a player, I want neon glowing line trails (cyan for player, orange/purple/red for AI) so that the light cycle look is convincing.
- As a player, I want top-down motorcycle rider heads that rotate with movement direction so that the snakes look like light cycles.
- As a player, I want permanent trails that never shrink so that they act as light cycle walls.
- As a player, I want food rendered as a pulsing cyan energy cube so that it fits the Tron aesthetic.
- As a player, I want Tron-styled overlays with cyan neon text and a "TRON" title so that the UI matches the theme.
- As a player, I want crash particles in the neon trail color of the crashed snake so that deaths look dramatic.
- As a player, I want switching to any other preset to return to standard snake rendering so that Tron mode is opt-in.

### Zen Mode

- As a player, I want the Zen preset to show a dark green nature background so that the atmosphere feels calm and peaceful.
- As a player, I want floating animated leaves drifting across the screen in various shades of green so that the nature theme is immersive.
- As a player, I want leaves to drift with sinusoidal wobble and rotation even while paused so that the background always feels alive.
- As a player, I want a subtle green-tinted grid so that the cell boundaries are visible but unobtrusive.
- As a player, I want green-tinted overlay text with a "ZEN" title so that the UI matches the nature theme.

### Maze Runner Mode

- As a player, I want the Maze Runner preset to show a brick tile dungeon background with running bond pattern so that the level feels like an ancient dungeon.
- As a player, I want maze obstacles rendered as dark stone blocks with highlight/shadow edges so that walls look like dungeon stonework.
- As a player, I want the snake head rendered as an animated flickering torch flame so that it feels like exploring a dungeon with a torch.
- As a player, I want the snake body rendered as ember dots fading from orange to dark red toward the tail so that it looks like a glowing ember trail.
- As a player, I want food rendered as a golden spinning coin with a dollar sign so that collecting food feels like finding treasure.
- As a player, I want orange/ember-colored death particles instead of red/green so that death effects match the dungeon theme.
- As a player, I want gold-themed overlay text with a "DUNGEON" title so that the UI matches the dungeon aesthetic.

### Visual Effects

- As a player, I want smooth interpolated movement between ticks so that the snake glides rather than jumps.
- As a player, I want the snake head to have animated eyes that follow the movement direction so that it looks alive.
- As a player, I want the snake to blink its eyes periodically so that it feels animated and lively.
- As a player, I want a body gradient from bright to dark with tapering segments so that the snake has visual depth.
- As a player, I want a shield indicator ring around the head when shield is active so that I know I'm protected.
- As a player, I want ghost transparency when ghost is active so that the effect is visually obvious.
- As a player, I want food rendered as a detailed apple with a pulsing glow so that it stands out on the field.
- As a player, I want a visible grid overlay and border around the playfield so that I can see the cell boundaries on the dark background.
- As a player, I want particle bursts on food and power-up collection so that pickups feel rewarding.
- As a player, I want tail trail particles on movement so that the snake leaves a subtle wake.
- As a player, I want a death particle explosion and screen shake so that game over feels impactful.
- As a player, I want floating score and effect text so that I get immediate feedback on points earned and effects collected.
- As a player, I want "LEVEL X!" floating text on level-up so that progression is celebrated.

### Game Management

- As a player, I want to pause and resume with the P key so that I can take breaks mid-game.
- As a player, I want the game to auto-pause when a dialog opens so that I don't lose progress while navigating menus.
- As a player, I want a game over screen showing my final score so that I know how I did.
- As a player, I want high scores persisted to localStorage (top 5, tracking score and length) so that I can track my best runs.
- As a player, I want a reset option for high scores so that I can start fresh.
- As a player, I want a status bar showing score, length, level, and active effects so that I always know my current state.

### Controls

- As a player, I want to move with arrow keys or WASD so that I can use whichever feels natural.
- As a player, I want Space to open the New Game dialog from the title screen or game over so that restarting is quick.
- As a player, I want F2 to open the New Game dialog at any time so that I can restart mid-game.

### Integration

- As a player, I want a menu bar with Game (New Game, Pause, High Scores, Exit) and Help (Controls, About) so that all actions are discoverable.
- As a player, I want the game to run inside the SZ OS window system with proper window management so that it integrates with the desktop environment.
- As a player, I want dialog windows for options, high scores, controls reference, and about info so that information is organized and accessible.
