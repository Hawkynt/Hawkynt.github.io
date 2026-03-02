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

### S-000 — Cross-cutting (OS Integration)
- Window title updates via SetWindowText
- WM_THEMECHANGED and WM_SIZE handling
- Menu bar with Game (New/Pause/High Scores/Exit) and Help (Controls/About)
- Dialog integration (high scores, controls, about)
- F2 for new game, Escape for pause

## Features

- Top-down spaceship racing on canvas
- 5+ distinct tracks with checkpoints and finish lines
- 3+ AI opponents with waypoint-based steering
- Boost pads with flame trail effects
- Hazard obstacles with collision sparks and screen shake
- Lap system with position tracking
- Race results with confetti for podium finishes
- Speed-line visual effects at high velocity
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
