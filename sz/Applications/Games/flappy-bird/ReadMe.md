# Flappy Bird

A one-button arcade game for the SynthelicZ Desktop. Tap to flap and guide a bird through an endless series of pipe gaps. Gravity pulls the bird down; each flap gives an upward impulse. The gap narrows, pipes speed up, and spacing tightens as the score climbs. Chase medal tiers and personal bests.

## How It Works

The bird sits at a fixed horizontal position and bobs gently in the ready state. On the first input the game begins: gravity accelerates the bird downward each frame, and pressing Space or clicking/tapping applies an upward velocity impulse. Pipes scroll in from the right with a randomized vertical gap position. When the bird's center passes a pipe, the score increments by one. Collision with any pipe or the ground ends the run (ceiling contact only clamps position). Every 12 points scored, the difficulty tier advances: the pipe gap shrinks, scroll speed increases, and pipe spacing tightens. After death, the bird tumbles for 0.5 seconds before the game-over screen appears showing the final score, personal best, and any earned medal.

## User Stories

### Core Gameplay
- [x] As a user, I can tap Space or click/tap the canvas to flap, receiving an upward velocity impulse of -7.5 px/frame
- [x] As a user, I can see my bird accelerate downward at 0.4 px/frame due to gravity, capped at a terminal velocity of 12 px/frame
- [x] As a user, I can see the bird rotate to reflect current velocity: tilts upward on flap (-30 degrees) and nose-dives when falling (up to +90 degrees)
- [x] As a user, I can score one point each time the bird passes fully through a pipe gap
- [x] As a user, I can see the game end instantly on contact with any pipe or the ground
- [x] As a user, I can see the bird clamped at the ceiling without dying, preventing escape above the screen
- [x] As a user, I can see a gentle bobbing animation on the ready screen before the first flap
- [x] As a user, I can restart immediately from the death screen by pressing Space or clicking

### Progressive Difficulty
- [x] As a user, I can experience difficulty increasing every 12 points scored (each tier advances simultaneously)
- [x] As a user, I can see the pipe gap shrink from 155px initial down to 100px minimum, reducing by 2px per difficulty tier
- [x] As a user, I can see scroll speed increase from 2.2 px/frame initial to 4.5 px/frame maximum, adding 0.15 per tier
- [x] As a user, I can see pipe spacing decrease from 300px initial to 210px minimum, reducing by 4px per tier
- [x] As a user, I can always have a safe margin of 60px from top/bottom for gap placement

### Medal System
- [x] As a user, I can earn a Bronze medal at 10+ points
- [x] As a user, I can earn a Silver medal at 25+ points
- [x] As a user, I can earn a Gold medal at 50+ points
- [x] As a user, I can earn a Platinum medal at 100+ points
- [x] As a user, I can see the earned medal displayed on the death screen with its distinctive color

### Visual Effects
- [x] As a user, I can see a puff of white/grey particles emitting downward from the bird on each flap
- [x] As a user, I can see golden sparkle particles at both edges of the pipe gap when scoring a point
- [x] As a user, I can see floating "+1" text rising from the bird on each score
- [x] As a user, I can see screen shake for 300ms on death
- [x] As a user, I can see a score pop animation (brief scale-up) when scoring
- [x] As a user, I can see a 0.5-second death tumble animation before the game-over screen

### Background and Scenery
- [x] As a user, I can see a sky gradient background from teal to light cyan
- [x] As a user, I can see a sun glow effect in the upper-right corner
- [x] As a user, I can see procedural clouds drifting at slow parallax speed
- [x] As a user, I can see two parallax background layers moving at 0.3x and 0.6x scroll speed
- [x] As a user, I can see rolling hills scrolling with the terrain
- [x] As a user, I can see a textured ground strip with scrolling pattern at the bottom of the screen
- [x] As a user, I can see pipes drawn with gradient shading and cap details

### Persistence and OS Integration
- [x] As a user, I can see my top 5 high scores persist via localStorage
- [x] As a user, I can see current score and personal best in the status bar
- [x] As a user, I can view and reset high scores from the dialog
- [x] As a user, I can access Game menu (New Game F2, Pause Esc, High Scores, Exit) and Help menu (Controls, About)
- [x] As a user, I can see the window title update ("Flappy Bird")
- [x] As a user, I can see the canvas scale on window resize
- [x] As a user, I can see game state (Ready, Playing, Paused, Game Over) in the status bar

### Planned
- [ ] As a user, I can hear sound effects for flapping, scoring, and dying
- [ ] As a user, I can choose from different bird character skins for visual customization
- [ ] As a user, I can experience a night/day visual cycle as my score increases
- [ ] As a user, I can see moving obstacles (e.g., rotating pipes) at higher difficulty tiers
- [ ] As a user, I can collect power-ups (e.g., slow-motion, shield) that spawn occasionally between pipes

## Controls

| Input | Action |
|---|---|
| Space | Flap (upward impulse) |
| Click / Tap | Flap (upward impulse) |
| Space / Click (on death screen) | Restart game |
| Escape | Pause / Resume |
| F2 | New Game (reset to ready state) |

## Technical Details

- Canvas-based rendering at 400x600 logical pixels with devicePixelRatio scaling
- IIFE pattern with `window.SZ` namespace; no build step required
- requestAnimationFrame game loop with delta-time capped at 50ms
- Physics normalized to 60 FPS via `dt * 60` step multiplier
- Bird hitbox scaled to 80% of visual size for a forgiving feel
- Pipe gap vertical position randomized within safe margins (60px from top and ground)
- 4 procedural cloud positions with parallax offset
- Ground height: 60px strip at canvas bottom
- Dying state lasts 0.5 seconds (bird tumbles with gravity) before transitioning to dead state
- Shared effects library: ParticleSystem, ScreenShake, FloatingText
- OS integration via SZ.Dlls.User32 (SetWindowText, RegisterWindowProc)
- localStorage persistence with `sz-flappy-bird-highscores` key

## Known Limitations

- No audio or sound effects
- No character skins or visual customization
- Bird is drawn procedurally (no sprite sheet); appearance is simple geometric shapes
- No night/day cycle or visual theme variation
- Difficulty scaling uses fixed intervals; no adaptive difficulty
