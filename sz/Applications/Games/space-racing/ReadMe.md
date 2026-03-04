# Space Racing

High-speed top-down spaceship racing with boost pads, hazards, AI opponents, and multiple tracks — built for the SynthelicZ Desktop.

## User Stories

### S-015 — Core Racing Gameplay
As a player, I want to race spaceships through obstacle courses with boost pads, hazards, and AI opponents across multiple tracks, so that I experience high-speed space racing.

**Acceptance Criteria:**
- Ship accelerates with Up/W, steers with Left/Right or A/D, brakes with Down/S
- Camera smoothly follows the player ship
- 3+ AI opponents race competitively with pathfinding
- 5+ tracks with different layouts
- Lap counting and position tracking
- Boost pads grant temporary speed increase
- Hazards (asteroid debris, energy barriers) cause slowdown on collision
- Race completion shows results with time and position
- High scores persisted to localStorage

### S-016 — Visual Effects
As a player, I want space racing to have speed-line effects, boost flame trails, collision sparks, and smooth camera following, so that racing feels fast and exciting.

**Acceptance Criteria:**
- Speed-line effects at high velocity
- Boost flame trails when hitting boost pads
- Collision spark particles on hazard hits
- Screen shake on crashes
- Confetti particles for podium finishes
- Floating text for lap times and position
- Glow effects via shadowBlur

### Track Hazards & Features
- [x] As a player, I want gravity wells on certain tracks that pull my ship off course so I must plan my racing line to avoid or use them strategically
- [x] As a player, I want wormhole portals that teleport my ship to another location on the track for shortcut opportunities and surprise positioning changes
- [x] As a player, I want a multi-layer parallax starfield background so that the sense of speed and depth is enhanced during racing
- [x] As a player, I want visible thrust particles emitting from my ship's engines when accelerating so that speed feedback is visually clear

### S-000 — Cross-cutting (OS Integration)
- Window title updates via SetWindowText
- WM_THEMECHANGED and WM_SIZE handling
- Menu bar with Game (New/Pause/High Scores/Exit) and Help (Controls/About)
- Dialog integration (high scores, controls, about)
- F2 for new game, Escape for pause

## Features

- Top-down spaceship racing on canvas
- **5 selectable ships** with different stats (speed, acceleration, handling, boost power, armor)
- **4-category upgrade system** (Engine, Thrusters, Hull, Boost) with 5 levels each, earned through racing credits
- **5 unique AI personalities** with distinct shapes, colors, and racing behavior (aggressive, defensive, balanced, erratic, calculated)
- **Reduced AI difficulty** — lower acceleration, reaction delay, random steering mistakes for fairer races
- 5+ distinct tracks with checkpoints and finish lines
- Boost pads with flame trail effects
- Hazard obstacles with collision sparks and screen shake
- **Gravity wells** that pull ships off course, requiring strategic racing lines
- **Wormhole portals** that teleport ships to other track locations for shortcuts
- **Parallax starfield** with multi-layer depth for enhanced speed perception
- **Thrust particles** emitting from ship engines during acceleration
- Lap system with position tracking
- Race results with confetti for podium finishes
- Speed-line visual effects at high velocity
- **Tutorial overlay** — 2-page guide shown on first play, toggled with H key, persisted via localStorage
- Smooth camera interpolation following the player
- High score persistence via localStorage
- Full SZ Desktop integration (menus, dialogs, window messages)

## Controls

| Key | Action |
|-----|--------|
| Up / W | Accelerate |
| Down / S | Brake / Reverse |
| Left / A | Steer left |
| Right / D | Steer right |
| F2 | New race |
| Escape | Pause / Resume |
| H | Toggle tutorial overlay |

## Game Mechanics

- **Acceleration**: Ship thrust increases speed in the facing direction with friction drag
- **Steering**: Rotates the ship angle; tighter turns at lower speeds
- **Boost Pads**: Temporary speed multiplier with flame trail particles
- **Hazards**: Collision detection reduces speed and triggers sparks + screen shake
- **Laps**: Cross checkpoints in order; complete all laps to finish the race
- **AI**: Opponents follow waypoints with slight randomization for natural racing behavior
- **Scoring**: Race time is the primary metric; position determines podium placement

## SEO Keywords

space racing game, browser racing game, top-down racing, spaceship racing, HTML5 racing game, canvas racing game, boost pads, AI opponents, space race, SynthelicZ Desktop game, web OS game, online racing game
