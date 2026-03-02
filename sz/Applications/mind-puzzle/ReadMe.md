# Mind-Bending Puzzle

A surreal spatial manipulation and reality-warping puzzle game inspired by Antichamber and The Witness. Explore 17 rooms with hidden rules, non-Euclidean geometry, perspective shifting, and reality-warp distortion effects.

## User Stories

- **S-080**: As a player, I want to solve mind-bending puzzles involving spatial manipulation, non-Euclidean geometry, and reality-warping mechanics, so that I experience Antichamber/Witness-style brain teasers.
- **S-081**: As a player, I want mind-bending puzzle to have reality-warp distortion effects, solution-discovery glow, perspective-shift smooth transitions, and ambient particle atmospherics, so that puzzles feel surreal.
- **S-000**: As a player, I want consistent OS integration (window title, theme changes, resize handling, menu bar, dialogs).

## Features

- 17 surreal puzzle rooms with unique hidden rules
- Non-Euclidean geometry: doors lead to unexpected rooms
- Perspective shifting with smooth morph transitions (smoothstep easing)
- Reality-warp distortion effects (sine wave screen distortion)
- Solution-discovery glow highlights with particle bursts
- Ambient particle atmospherics in every room
- Screen shake on warp and discovery events
- Floating text feedback for player actions
- Progress persistence via localStorage
- High scores tracking (fastest completion times)
- Full SynthelicZ Desktop OS integration

## Controls

| Input | Action |
|---|---|
| Arrow Keys / WASD | Move player |
| E / Space | Interact with doors & objects |
| Q | Shift perspective |
| R | Reset room |
| F2 | New game / Restart |
| Escape | Pause / Resume |

## Game Mechanics

### Hidden Rules
Each room has a hidden rule the player must discover through experimentation. Walking into clue objects or passing through portals reveals the rule with a glow effect.

### Non-Euclidean Geometry
Doors and portals connect rooms in non-linear ways. Walking through a door may lead to a room several indices away or even loop back to the same room from a different perspective.

### Perspective Shifting
Press Q to cycle through perspective modes (Normal → Flipped → Rotated). Smooth transitions use smoothstep interpolation over 0.5 seconds.

### Reality Warp
Passing through portals triggers reality-warp distortion: sine-wave screen offset, particle bursts, and screen shake create a surreal transition effect.

## Architecture

- `index.html` — Entry point with SEO meta tags, JSON-LD, menu bar, canvas, dialogs
- `controller.js` — IIFE game logic: room system, physics, effects, OS integration
- `styles.css` — Layout and theming
- `icon.svg` — 48×48 app icon
- Shared dependencies: `menu.js`, `dialog.js`, `game-effects.js`

## SEO Keywords

mind-bending puzzle, spatial manipulation game, non-Euclidean geometry puzzle, reality-warping browser game, Antichamber-style puzzle, perspective shifting game, surreal puzzle rooms, brain teaser web game, SynthelicZ Desktop game, hidden rules puzzle
