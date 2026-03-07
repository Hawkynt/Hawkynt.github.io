# Mind-Bending Puzzle

A surreal spatial manipulation and reality-warping puzzle game inspired by Antichamber and The Witness. Explore 17 rooms with hidden rules, non-Euclidean geometry, perspective shifting, and reality-warp distortion effects. Part of the SynthelicZ Desktop.

## How It Works

1. Move through rooms using Arrow Keys or WASD
2. Interact with objects using E or Space
3. Discover each room's hidden rule through experimentation
4. Shift perspective with Q to cycle through Normal/Flipped/Rotated modes
5. Pass through portals to trigger reality-warp effects and travel to unexpected rooms
6. Progress is saved to localStorage

## User Stories

### Core Gameplay
- [x] As a user, I can move through 17 surreal puzzle rooms using Arrow Keys or WASD
- [x] As a user, I can interact with doors and objects using E or Space
- [x] As a user, I can discover each room's hidden rule through experimentation
- [x] As a user, I can reset the current room with R
- [x] As a user, I can see solid-object collision detection preventing walking through walls and platforms

### Interactive Objects (8 types)
- [x] As a user, I can interact with fracture objects
- [x] As a user, I can interact with echo objects
- [x] As a user, I can interact with nexus orb objects
- [x] As a user, I can interact with shadow objects
- [x] As a user, I can interact with color tile objects
- [x] As a user, I can interact with phantom bridge objects
- [x] As a user, I can interact with clue objects that reveal room rules with glow effects
- [x] As a user, I can interact with goal objects to complete rooms

### Non-Euclidean Geometry
- [x] As a user, I can walk through doors that lead to unexpected rooms (non-linear connections)
- [x] As a user, I can experience rooms connecting in non-Euclidean ways (loops, skips)

### Perspective Shifting
- [x] As a user, I can cycle through perspective modes (Normal, Flipped, Rotated) with Q
- [x] As a user, I can see smooth morph transitions between perspectives using smoothstep interpolation over 0.5 seconds

### Visual Effects
- [x] As a user, I can see reality-warp distortion effects (sine-wave screen distortion) when passing through portals
- [x] As a user, I can see solution-discovery glow highlights with particle bursts
- [x] As a user, I can see ambient particle atmospherics in every room
- [x] As a user, I can see screen shake on warp and discovery events
- [x] As a user, I can see floating text feedback for player actions

### Persistence
- [x] As a user, I can have my progress saved via localStorage
- [x] As a user, I can see high scores tracking fastest completion times

### OS Integration
- [x] As a user, I can see the canvas maximize to the parent container for full-window gameplay
- [x] As a user, I can use the menu bar and dialog system
- [x] As a user, I can press F2 for new game, Escape for pause

### Planned
- [ ] As a user, I can hear sound effects for warps, discoveries, and perspective shifts
- [ ] As a user, I can see a room map showing discovered connections
- [ ] As a user, I can earn achievements for solving rooms under par moves
- [ ] As a user, I can see a hint system revealing partial solutions for rooms I am stuck on
- [ ] As a user, I can encounter additional room types with new interactive object mechanics

## Controls

| Input | Action |
|---|---|
| Arrow Keys / WASD | Move player |
| E / Space | Interact with doors and objects |
| Q | Shift perspective |
| R | Reset room |
| F2 | New game / Restart |
| Escape | Pause / Resume |

## Technical Details

- **Engine**: Vanilla JavaScript canvas 2D with IIFE pattern and `window.SZ` namespace
- **Room system**: 17 rooms with unique layouts, hidden rules, and object placement
- **Physics**: Solid-object collision detection for walls, platforms, and interactive objects
- **Perspective**: 3 modes (Normal, Flipped, Rotated) with smoothstep morph transitions
- **Effects**: SZ.GameEffects (ParticleSystem, ScreenShake, FloatingText)
- **Persistence**: localStorage for progress and high scores
- **OS integration**: SetWindowText, RegisterWindowProc (WM_SIZE, WM_THEMECHANGED)

## Known Limitations

- No sound effects
- No room map or navigation guide

## SEO Keywords

mind-bending puzzle, spatial manipulation game, non-Euclidean geometry puzzle, reality-warping browser game, Antichamber-style puzzle, perspective shifting game, surreal puzzle rooms, brain teaser web game, SynthelicZ Desktop game, hidden rules puzzle
