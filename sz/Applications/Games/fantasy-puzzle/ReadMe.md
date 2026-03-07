# Fantasy Puzzle

An elemental magic puzzle game for the SynthelicZ Desktop. Cast fire, water, earth, and air spells on a grid to burn wood, fill channels, create barriers, and push blocks. Discover hidden runes, solve 17 progressively challenging levels, and earn star ratings based on move efficiency.

## How It Works

Each level presents a grid-based puzzle with obstacles (wood, channels, movable blocks) and a goal tile. The player selects one of four elements and clicks grid tiles to cast that element. Fire burns wood tiles, water fills channel tiles to create walkable bridges, earth creates wall barriers on empty tiles, and air pushes movable blocks away from the grid center. Hidden runes are scattered across levels and are discovered by casting any element on or adjacent to them. A level is complete when all wood and channel obstacles are cleared, at which point remaining hidden runes auto-reveal and the goal becomes reachable. Star ratings (1-3) are awarded based on how close the player's move count is to the level's optimal solution.

## User Stories

### Elements and Interactions
- [x] As a user, I can select Fire (key 1/Q) to burn wood obstacle tiles, clearing them from the grid with flame burst and sparkle particles
- [x] As a user, I can select Water (key 2/W) to fill channel tiles, converting them to walkable filled tiles with water ripple particles
- [x] As a user, I can select Earth (key 3/E) to create wall barriers on empty tiles, blocking paths with earth crumble particles
- [x] As a user, I can select Air (key 4/R) to push movable block tiles away from the grid center with wind gust particles
- [x] As a user, I can see element-specific floating text ("Burn!", "Fill!", "Block path!", "Push!") on successful casts
- [x] As a user, I can see a smooth element-switch animation when changing the selected element

### Rune Discovery
- [x] As a user, I can discover hidden runes by casting any element on an adjacent tile (cardinal directions)
- [x] As a user, I can directly cast on a hidden rune tile to reveal it (counts as a move)
- [x] As a user, I can see sparkle particles, "Rune Found!" floating text, and screen shake when a rune is discovered
- [x] As a user, I can see remaining hidden runes auto-reveal with effects when all obstacles are cleared

### Puzzle Levels
- [x] As a user, I can progress through 17 puzzle levels with increasing complexity: from single-element introductions to multi-element combinations
- [x] As a user, I can encounter levels using individual elements (Ember Path, River Cross, Stone Barrier, Wind Maze) before combination puzzles
- [x] As a user, I can encounter late-game levels requiring all four elements and complex sequencing (Elemental Mastery, Ancient Archive, Crystal Labyrinth)
- [x] As a user, I can see level name, grid layout, and hint text for each puzzle
- [x] As a user, I can select any previously unlocked level from the level map

### Star Rating System
- [x] As a user, I can earn 3 stars by completing a level within the optimal move count
- [x] As a user, I can earn 2 stars by completing within 1.5x the optimal moves
- [x] As a user, I can earn 1 star for completing the level regardless of move count
- [x] As a user, I can see star ratings displayed with filled/empty star characters on level completion
- [x] As a user, I can see my best star ratings saved per level and persisted across sessions

### Level Completion
- [x] As a user, I can complete a level when all wood and channel obstacles are cleared and the goal tile is present
- [x] As a user, I can see a celebratory solution cascade with burst and sparkle particles across the grid
- [x] As a user, I can see floating text showing the level number and star rating
- [x] As a user, I can see screen shake on level completion
- [x] As a user, I can advance to the next level or return to level selection after completion

### Tutorial and Help
- [x] As a user, I can see a 4-page tutorial overlay on first play covering overview, elements, tile types, and controls
- [x] As a user, I can toggle the tutorial at any time by pressing H
- [x] As a user, I can see valid move highlighting when hovering over tiles with color-coded indicators showing legal interactions
- [x] As a user, I can see tile hover tooltips describing each tile type and which element applies
- [x] As a user, I can see an objectives panel displaying current level goals and progress
- [x] As a user, I can view optional level hints revealing the next suggested move
- [x] As a user, I can see a quick-reference panel for element keys and effects

### Visual Effects
- [x] As a user, I can see elemental particles specific to each element: flame bursts (fire), water ripples (water), earth crumbles (earth), wind gusts (air)
- [x] As a user, I can see discovered runes emit a magical glow effect via canvas shadowBlur
- [x] As a user, I can see hint overlay text fade in and out for each level
- [x] As a user, I can see screen shake on element casts and rune discoveries

### Persistence and OS Integration
- [x] As a user, I can see my level progress (current level, star ratings per level) persist via localStorage
- [x] As a user, I can see my high scores (level + stars) persist via localStorage with a top-10 leaderboard
- [x] As a user, I can view and reset high scores from the dialog
- [x] As a user, I can see the window title update with the current level name
- [x] As a user, I can access Game menu (New Game F2, Pause Esc, High Scores, Exit) and Help menu (How to Play, Controls, About)
- [x] As a user, I can see the canvas fill the entire parent container on resize for full-window gameplay

### Planned
- [ ] As a user, I can hear sound effects for element casts, rune discoveries, and level completion
- [ ] As a user, I can undo/redo my moves to experiment with different solutions
- [ ] As a user, I can create custom puzzles in a built-in level editor
- [ ] As a user, I can see procedurally generated bonus levels for infinite replayability
- [ ] As a user, I can choose the direction when pushing blocks with Air instead of automatic center-based direction

## Controls

| Input | Action |
|---|---|
| Click / Tap | Cast selected element on the clicked grid tile |
| 1 / Q | Select Fire element |
| 2 / W | Select Water element |
| 3 / E | Select Earth element |
| 4 / R | Select Air element |
| H | Toggle tutorial overlay |
| F2 | New Game / Restart current level |
| Escape | Pause / Resume |

## Technical Details

- Canvas-based rendering at 700x500 logical pixels with devicePixelRatio scaling
- IIFE pattern with `window.SZ` namespace; no build step required
- requestAnimationFrame game loop with delta-time capped at 50ms
- 10x8 grid with 48px tiles, offset by (30, 40) from canvas origin
- 9 tile types: Empty, Wall, Wood, Channel, Filled, Block, Earth Wall, Rune (hidden), Rune Active, Goal
- Air push direction computed relative to grid center (prefers horizontal push)
- 17 levels defined as grid arrays with optimal move counts and hint text
- Shared effects library: ParticleSystem, ScreenShake, FloatingText
- OS integration via SZ.Dlls.User32 (SetWindowText, RegisterWindowProc for WM_SIZE, WM_THEMECHANGED)
- localStorage persistence with `sz-fantasy-puzzle-` key prefix
- Tutorial seen state persisted separately to avoid re-showing

## Known Limitations

- No audio or sound effects
- No undo/redo mechanic for moves
- Air push direction is determined by position relative to grid center, not by player intent or click direction
- Levels are hand-designed with fixed grids; no procedural generation
- No level editor for creating custom puzzles
