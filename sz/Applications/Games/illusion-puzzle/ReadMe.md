# Optical Illusion Puzzle

An isometric impossible-geometry puzzle game for the SynthelicZ Desktop, inspired by Monument Valley and M.C. Escher. Navigate 16 surreal levels featuring Penrose stairs and paradox bridges. Rotate the perspective to create and break paths, collect gems scattered across impossible architecture, and reach the goal tile in as few moves as possible.

## How It Works

Each level is a 5x5 isometric grid with tiles at different elevations: floor, raised platforms, Penrose stair cells, goal tiles, and void spaces. The player moves one tile at a time in cardinal directions. Penrose stair tiles contain illusion links that only activate at specific perspective angles. When the player steps onto a Penrose tile whose illusion link matches the current perspective, they are teleported to a connected location. Rotating the perspective (4 angles, cycling with Q/E) changes which Penrose paths are walkable and which teleports are active. The goal is to collect all gems on the level and reach the goal tile. The game tracks move count and level progress, with high scores ranked by fewest moves.

## User Stories

### Core Movement
- [x] As a user, I can move one tile at a time in four cardinal directions using Arrow Keys or WASD
- [x] As a user, I can see smooth isometric movement with easing (smoothstep interpolation) between tile positions
- [x] As a user, I can see that void tiles (type 0) and grid edges block my movement
- [x] As a user, I can walk on floor tiles (type 1), raised tiles (type 2), and goal tiles (type 4)
- [x] As a user, I can see my movement blocked during an active move animation (move progress must complete)

### Perspective Rotation
- [x] As a user, I can rotate perspective left (Q) or right (E) through 4 angles (0, 1, 2, 3)
- [x] As a user, I can see a smooth morph animation during perspective transitions with smoothstep easing
- [x] As a user, I can see screen shake and burst particles centered on the canvas during rotation
- [x] As a user, I can see floating "Rotate Left" or "Rotate Right" text on perspective change
- [x] As a user, I can see my rotation blocked while a previous rotation animation is still in progress

### Penrose Stairs and Illusion Links
- [x] As a user, I can encounter Penrose stair tiles (type 3) that are walkable only at specific perspective angles
- [x] As a user, I can be teleported to a linked destination tile when stepping onto a Penrose stair whose illusion link matches the current perspective
- [x] As a user, I can see "Warp!" floating text, purple burst particles, and screen shake on teleportation
- [x] As a user, I can deduce which perspective angle activates each Penrose link to solve the puzzle
- [x] As a user, I can encounter levels with zero, one, two, or three illusion links of varying complexity

### Collectible Gems
- [x] As a user, I can collect gems by moving onto their tile position
- [x] As a user, I can see golden sparkle particles, orange burst particles, "Gem!" floating text, and screen shake on gem collection
- [x] As a user, I can see my collected gem count displayed in the status bar
- [x] As a user, I can see uncollected gems rendered as floating diamond shapes on the isometric grid

### Level Progression
- [x] As a user, I can progress through 16 levels of increasing difficulty, from "First Steps" (simple floor grid) to "Final Illusion" (multiple Penrose links across all perspectives)
- [x] As a user, I can see level names: First Steps, The Rise, Penrose Gateway, Escher Bridge, Spiral Tower, Double Illusion, Floating Paths, The Paradox, Mirror Stairs, Gravity Well, Impossible Fork, Cascade, Mobius Walk, The Void, Architect's Dream, Final Illusion
- [x] As a user, I can complete a level by reaching the goal tile (type 4), triggering green burst particles, golden sparkles, floating completion text, and screen shake
- [x] As a user, I can see move count and level number on completion
- [x] As a user, I can advance to the next level by pressing any key or clicking after completion
- [x] As a user, I can see "ALL LEVELS COMPLETE!" with confetti particles after finishing all 16 levels

### Path Trail
- [x] As a user, I can see a glowing trail rendered on every visited tile, highlighting the solution path taken
- [x] As a user, I can see the trail reset when a new level is loaded

### Persistence and High Scores
- [x] As a user, I can see my level progress (current level, per-level move count and gem count) persist via localStorage
- [x] As a user, I can see my top 10 high scores (ranked by fewest moves per level) persist via localStorage
- [x] As a user, I can view and reset high scores from the dialog
- [x] As a user, I can see the game resume at the last reached level on reload

### OS Integration
- [x] As a user, I can see the window title update with the current level number and name, or "All Complete!" on finishing
- [x] As a user, I can access Game menu (New Game F2, Pause Esc, High Scores, Exit) and Help menu (Controls, About)
- [x] As a user, I can pause/resume with Escape, restart all progress with F2
- [x] As a user, I can see the canvas respond to window resize events
- [x] As a user, I can click/tap the canvas on ready, game-over, or level-complete screens to proceed

### Visual Rendering
- [x] As a user, I can see an isometric diamond-tile grid with 64x32 pixel tiles converted from grid coordinates
- [x] As a user, I can see raised tiles (type 2) drawn with elevation offset and side faces for 3D depth
- [x] As a user, I can see Penrose stair tiles drawn with a distinctive stair-step pattern
- [x] As a user, I can see the player character as an animated figure on the isometric grid
- [x] As a user, I can see ambient particle atmospherics during gameplay

### Planned
- [ ] As a user, I can hear sound effects for movement, perspective rotation, warps, and gem collection
- [ ] As a user, I can create custom puzzles in a built-in level editor
- [ ] As a user, I can undo/redo my moves to experiment with different solutions
- [ ] As a user, I can see a hint system or move suggestion to help with difficult puzzles
- [ ] As a user, I can play levels with variable grid sizes for greater puzzle variety

## Controls

| Input | Action |
|---|---|
| Arrow Up / W | Move player up (row - 1) |
| Arrow Down / S | Move player down (row + 1) |
| Arrow Left / A | Move player left (col - 1) |
| Arrow Right / D | Move player right (col + 1) |
| Q | Rotate perspective left |
| E | Rotate perspective right |
| F2 | New Game (reset all progress) |
| Escape | Pause / Resume |
| Click / Tap | Proceed on ready, level-complete, or game-over screens |

## Technical Details

- Canvas-based rendering at 700x500 logical pixels with devicePixelRatio scaling
- IIFE pattern with `window.SZ` namespace; no build step required
- requestAnimationFrame game loop with delta-time capped at 50ms
- Isometric projection: `isoX = (col - row) * 32 + 350`, `isoY = (col + row) * 16 + 60`
- Tile elevation offsets: raised tiles subtract `elevation * TILE_H` from screen Y
- Player movement speed: 6 units/second with smoothstep easing
- Perspective rotation speed: 3 units/second with smoothstep easing
- 5 tile types: void (0), floor (1), raised (2), Penrose stair (3), goal (4)
- 16 levels with grid layouts, player start positions, collectible positions, and illusion link definitions
- Each illusion link specifies: source position, destination position, and required perspective angle
- Shared effects library: ParticleSystem, ScreenShake, FloatingText
- OS integration via SZ.Dlls.User32 (SetWindowText, RegisterWindowProc)
- localStorage persistence with `sz-illusion-puzzle-` key prefix

## Known Limitations

- No audio or sound effects
- No level editor for creating custom puzzles
- Perspective rotation is purely visual/logical; the isometric view does not physically rotate the camera
- No undo/redo mechanic for moves
- Grid is always 5x5; no variable grid sizes across levels
- No hint system or move suggestion
