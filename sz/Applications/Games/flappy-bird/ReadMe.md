# Flappy Bird

A simple yet addictive one-button arcade game for the SynthelicZ Desktop. Tap to flap and navigate through an endless series of pipe gaps to chase an ever-higher score.

## Features

- One-button tap-to-flap gameplay with gravity physics
- Scrolling pipe obstacles with randomized gap heights
- Progressive difficulty: gap narrows and speed increases every 10 points
- Medal tier system: Bronze (10+), Silver (25+), Gold (50+), Platinum (100+)
- Parallax background scrolling with multiple layers
- Particle effects: flap puff, pipe-pass sparkles, death screen shake
- Floating score text and score pop animation
- High score persistence via localStorage
- Full SZ Desktop integration: window title, theme support, menu bar, dialogs
- Canvas scales on window resize

## User Stories

### S-045: Core Flappy Gameplay
**As a** player, **I want** to control a bird's altitude by tapping to flap through an endless series of pipe gaps, **so that** I can chase an ever-higher score in a simple, satisfying reflex challenge.

**Acceptance Criteria:**
- Given the game is running, when the player presses Space or clicks/taps the canvas, then the bird receives an upward velocity impulse
- Given no input is received, when a frame advances, then the bird accelerates downward due to gravity
- Given pipes are scrolling, when the bird passes fully through a pipe gap, then the score increments by one
- Given the bird touches a pipe or the ground, when collision is detected, then the game ends immediately
- Given the bird rises above the top of the canvas, then it is clamped (does not die from ceiling contact)
- Given the game ends, when the death screen appears, then the final score and personal best are displayed

### S-046: Visual Polish and Effects
**As a** player, **I want** smooth parallax scrolling, particle effects on flap and pipe-pass, and a screen shake on death, **so that** the game feels alive and responsive to my actions.

**Acceptance Criteria:**
- Given the bird flaps, a small puff of white/grey particles emits downward from the bird
- Given the bird passes through a pipe gap, sparkle particles appear at the gap edges
- Given the bird collides, the screen shakes horizontally for 300ms
- At least two parallax layers move at different speeds
- The bird sprite rotates to reflect its current velocity angle

## Controls

| Input | Action |
|-------|--------|
| Space | Flap (gain upward velocity) |
| Click / Tap | Flap (gain upward velocity) |
| Space / Click (on death screen) | Restart game |
| Escape | Pause / Resume |
| F2 | New Game |

## Game Mechanics

### Physics
- Gravity: ~0.5 px/frame acceleration
- Flap impulse: ~-8 px/frame upward velocity
- Terminal velocity: 12 px/frame downward
- Bird rotation: mapped from velocity (-30deg flap to +90deg dive)

### Progressive Difficulty
- Starting pipe gap: 120px, reducing by 2px every 10 points (min 80px)
- Scroll speed: starts 3 px/frame, increases by 0.2 every 10 points (max 5 px/frame)
- Pipe spacing: starts 250px, decreases by 5px every 10 points (min 180px)

### Collision
- Bird hitbox: 80% of visual size for forgiving feel
- Pipe hitbox: exact rectangle
- Ground: instant death on contact
- Ceiling: clamp only, no death

## SEO Keywords

flappy bird, browser game, html5 arcade, tap to fly, pipe dodge game, endless flyer, high score game, canvas game, retro arcade, one-button game, free online game, web game
