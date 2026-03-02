# Optical Illusion Puzzle

An isometric impossible-geometry puzzle game inspired by Monument Valley and M.C. Escher. Navigate Penrose stairs, rotate perspective to create and break paths, collect gems, and reach the goal across 16 surreal levels.

## User Stories

- **S-082**: As a player, I want to navigate impossible architectural spaces by manipulating perspective and viewpoint to create paths through optical illusions, so that I experience Monument Valley-style puzzle gameplay.
- **S-083**: As a player, I want optical illusion puzzle to have perspective-shift morph animations, path-complete glow trails, collectible sparkle effects, and smooth isometric transitions, so that illusions feel magical.
- **S-000**: As a player, I want consistent OS integration (window title, theme changes, resize handling, menu bar, dialogs).

## Features

- 16 isometric levels with impossible geometry (Penrose stairs, paradox bridges)
- Perspective rotation mechanic (Q/E keys) with smooth morph animation
- Illusion links: Penrose stair cells teleport player when perspective matches
- Collectible gems with sparkle particle effects on pickup
- Path-complete glow trails showing visited tiles
- Smooth isometric player movement with easing (smoothstep)
- Level completion with burst particles, sparkles, and floating text
- Screen shake on perspective shifts and level completion
- Ambient particle atmospherics
- Progress persistence via localStorage
- High scores tracking (fewest moves)
- Full SynthelicZ Desktop OS integration

## Controls

| Input | Action |
|---|---|
| Arrow Keys / WASD | Move player on grid |
| Q / E | Rotate perspective left / right |
| Space | Interact |
| F2 | New game / Restart |
| Escape | Pause / Resume |

## Game Mechanics

### Isometric Grid
Each level is a 5×5 isometric grid with tile types: floor (1), raised (2), Penrose stair (3), goal (4), and void (0). The isometric projection converts grid coordinates to screen positions using diamond-shaped tiles.

### Perspective Rotation
Press Q/E to cycle through 4 perspective angles. Penrose stair tiles have illusion links that only activate at specific perspectives. When the perspective matches, stepping onto a Penrose tile teleports the player to a connected location.

### Collectibles
Gems are scattered across levels. Collecting them triggers sparkle effects and contributes to the score.

### Path Glow Trail
Every visited tile is recorded and rendered as a glowing trail line, highlighting the solution path.

## Architecture

- `index.html` — Entry point with SEO meta tags, JSON-LD, menu bar, canvas, dialogs
- `controller.js` — IIFE game logic: isometric renderer, perspective rotation, collectibles, effects, OS integration
- `styles.css` — Layout and theming
- `icon.svg` — 48×48 app icon with Penrose triangle and isometric tiles
- Shared dependencies: `menu.js`, `dialog.js`, `game-effects.js`

## SEO Keywords

optical illusion puzzle, isometric puzzle game, Penrose stairs game, impossible geometry browser game, Monument Valley-style puzzle, perspective rotation puzzle, collectible sparkle effects, isometric transitions, SynthelicZ Desktop game, M.C. Escher puzzle
