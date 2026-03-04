# Space Invaders -- Enhanced Edition

## Purpose

Arcade game where the player defends Earth from waves of alien invaders across three game modes. Features 12 unique wave formations, 8 power-up types, boss fights with multi-phase attack patterns, combo scoring with multipliers, special enemy types (divers and shielded), a drone helper, and a starfield background. Part of the SynthelicZ Desktop game collection.

## How It Works

Canvas-based game with proper aspect-ratio scaling. All game logic runs in a virtual 480x540 coordinate space that scales to any window size. A starfield background scrolls behind the action. Aliens spawn in varied formations, march side-to-side, and drop down at edges. Power-ups drop from destroyed aliens and UFOs. Boss fights occur at regular intervals with multiple attack patterns. Combo scoring rewards rapid kills with score multipliers.

## Architecture

- **`index.html`** -- Menu bar (Game/Help), canvas, status bar, dialogs (High Scores, Controls & Power-Ups, About)
- **`controller.js`** -- IIFE with wave formations, power-up system, boss AI, combo scoring, special enemy types, drone helper, alien drawing, collision detection, game states
- **`styles.css`** -- Game layout and visual styling
- **Shared modules** -- `menu.js`, `dialog.js`, `game-effects.js` (particles, screen shake, floating text, starfield, glow)

## Features

### Game Modes
- **Classic** -- Progressive levels with boss fights every 5 levels
- **Survival** -- Endless waves with no level transitions, faster difficulty ramp, more frequent power-ups
- **Boss Rush** -- Boss fight every level with escort aliens, double power-up frequency

### Wave Formations (12 unique patterns)
- Classic Grid, V-Formation, Diamond Strike, Arrow Assault, Cross Attack, Zigzag, Fortress, Wings, Scatter, Phalanx (with special enemies), Diver Squadron, Shield Wall
- Formations cycle per level; each announces its name on entry

### Power-Up System (8 types)
- **Triple Shot** (cyan) -- Fire 3 bullets in a spread pattern for 8 seconds
- **Rapid Fire** (yellow) -- Reduced cooldown (100ms vs 300ms), increased max bullets for 6 seconds
- **Shield** (blue) -- Blocks the next lethal hit (bullet or diver collision) for 5 seconds
- **Laser** (magenta) -- Piercing shots that pass through all aliens for 4 seconds
- **Slow-Mo** (light blue) -- Alien movement and shooting at 40% speed for 5 seconds
- **Extra Life** (pink) -- Instantly grants +1 life
- **Bomb** (orange) -- Instantly destroys all aliens on screen with massive explosion
- **Drone** (green) -- Helper ship that follows the player and auto-fires for 10 seconds
- Power-ups drop at 8% chance from regular aliens, 20% from special aliens, 100% from UFOs
- Active power-up timers shown as HUD icons in the top-right corner
- Power-ups can stack (e.g. Triple Shot + Rapid Fire + Laser simultaneously)
- Collecting an already-active power-up refreshes its timer to full duration

### Boss Fights
- Boss appears as a large mothership with hull, cockpit, and engine glow
- Health bar displayed at the top of the screen
- Base HP: 15 + 5 per boss number (e.g. boss #3 = 30 HP)
- Phase 1 attack patterns: Spread (5-bullet fan), Aimed (3 bullets at player), Rain (7 falling bullets)
- Phase 2 (below 50% HP): Hull turns red, engines glow orange, faster movement and attacks, gains Spiral attack (8-bullet circle)
- Boss entrance: WARNING flash, descend animation
- Boss defeat: Multi-stage explosion cascade, confetti, screen shake, 3 power-up drops, score bonus (maxHP x 100)
- Escort aliens spawn alongside boss in varied formations

### Combo System
- Each alien kill within 1.5 seconds of the last increments the combo counter
- Score multiplier: x1 (0-2 kills), x2 (3-4), x3 (5-7), x4 (8-11), x5 (12+)
- Visual indicator shows multiplier and timer bar at top of screen
- Milestone announcements at x2, x3, x4, x5 thresholds
- Floating text shows multiplied score during active combos

### Special Enemy Types
- **Diver aliens** (orange, 50 pts) -- Break from formation and swoop toward the player in a sine-wave pattern; leave particle trails; blocked by shield power-up
- **Shielded aliens** (cyan, 40 pts) -- Surrounded by a translucent energy shield; require 2 hits (first hit breaks shield, second kills); higher power-up drop chance (20%)
- Divers and shielded aliens appear in specific formations (Phalanx, Diver Squadron, Shield Wall) and can appear in any formation from level 3+

### Visual Effects
- Scrolling starfield background with twinkling stars
- Particle explosions on alien/player/UFO/boss destruction
- Screen flash on big events (bomb, boss hit, shield break, player death)
- Screen shake on player death and boss defeat
- Glow effect on all bullets, UFO, and boss ship
- Bullet trail particles
- Floating score text on UFO kills, combo milestones, boss hits
- Confetti on level completion
- Pulsing title text on mode selection screen
- Energy shield bubble around shielded player (pulsing)
- Drone helper ship with glow
- Power-up icons with colored glow and bob animation

### Gameplay
- 3 lives per game
- Player can have 2 bullets on screen (4 with rapid fire, 6 with triple shot)
- Shoot cooldown: 300ms (100ms with rapid fire)
- 4 destructible shield bunkers with pixel-accurate damage
- Shields absorb both player and alien bullets
- Aliens reaching player row causes instant death with 0 lives
- UFO crosses top of screen every 10-25 seconds with random point value (50-300)
- Alien movement speed increases as fewer remain
- Alien shoot interval decreases per level (min 400ms)
- Canvas scales to any window size with proper aspect ratio and letterboxing

### Game Management
- Game states: idle, playing, paused, dying, levelComplete, bossIntro, bossVictory, gameover
- Mode selection on title screen with animated starfield
- Death respawn after 2-second delay
- Level completion celebration with confetti
- High scores persisted to localStorage (top 10, with mode and level/wave tracking)
- Status bar showing score, lives, and level/wave

### Controls
- Left/Right arrows or A/D for movement
- Space or Up arrow to shoot
- P to pause/resume
- F2 for mode selection
- 1/2/3 to select game mode
- Enter to start with last used mode
- Escape to close dialogs

### Integration
- Menu bar with Game menu (New Game, Pause, High Scores, Exit) and Help menu (Controls & Power-Ups, About)
- SZ OS window management (close via menu)
- Responsive canvas scaling with aspect-ratio preservation
- Dialog system for high scores, controls, and about info

## Planned Features

- Sound effects and music
- Touch/mobile controls
- Custom wave editor
- Online leaderboard
- Achievement system

## Known Bugs

- None currently known

## User Stories

- As a player, I want to choose between Classic, Survival, and Boss Rush modes so I can play the style I enjoy
- As a player, I want power-ups to drop from destroyed aliens so gameplay stays fresh and exciting
- As a player, I want a combo system so I'm rewarded for rapid kills
- As a player, I want boss fights with multiple attack patterns so I have epic confrontations
- As a player, I want special enemies (divers, shielded) so each wave feels different
- As a player, I want a drone helper so I have extra firepower
- As a player, I want the shield power-up to save me from one hit so I get a second chance
- As a player, I want the bomb power-up to clear the screen when I'm overwhelmed
- As a player, I want piercing laser shots so I can cut through dense formations
- As a player, I want slow-motion to give me breathing room against tough waves
- As a player, I want different wave formations so each level looks and plays differently
- As a player, I want a starfield background so the game looks polished
- As a player, I want screen shake and particle effects so the game feels impactful
- As a player, I want the game to scale to any window size so I can play in any configuration
- As a player, I want my high scores to track game mode so I can compare across modes
- As a player, I want wave announcements so I know what formation I'm facing
- As a player, I want fluid animations so the game feels smooth and polished
- As a player, I want varied explosion effects so each destruction feels unique
- As a player, I want bullet trail particles so shots feel dynamic
- As a player, I want a pulsing animated title screen so the game feels alive before I start
- As a player, I want a starfield background so the space setting feels immersive
- As a player, I want screen flash on big events so explosions and power-ups feel impactful
- As a player, I want confetti on level completion so clearing a wave feels celebratory
- As a player, I want the boss to have a dramatic WARNING entrance so boss fights feel epic
- As a player, I want the boss to have a multi-stage explosion on death so defeating it feels satisfying
- As a player, I want power-ups to stack so I can combine abilities for overpowered moments
- As a player, I want active power-up timers in the HUD so I know how long each lasts
- As a player, I want the rapid fire power-up to also increase max bullets so the effect feels meaningful
- As a player, I want triple shot combined with laser to pierce through entire formations
- As a player, I want the drone to follow me and auto-fire so it feels like a real helper
- As a player, I want the boss to change behavior at low health so the fight escalates
- As a player, I want boss attack patterns to vary so each encounter requires different dodging
- As a player, I want escort aliens during boss fights so the battlefield stays active
- As a player, I want survival mode to seamlessly spawn the next wave so the action never stops
- As a player, I want boss rush mode to have double power-up frequency so I can keep up with constant bosses
- As a player, I want diver aliens to leave particle trails so I can track their swooping path
- As a player, I want shielded aliens to have a visible energy bubble so I know they need two hits
- As a player, I want the shield power-up bubble to pulse around my ship so I can see I'm protected
- As a player, I want combo milestone announcements so I feel rewarded for kill streaks
- As a player, I want the combo multiplier display to grow with higher combos so it feels escalating
- As a player, I want aliens reaching my row to be an instant game over regardless of shield so there's real consequence
- As a player, I want the canvas to maintain aspect ratio with letterboxing so the game looks correct at any size
- As a player, I want 12 different formations so each level presents a new visual pattern
- As a player, I want boss fights to drop 3 power-ups so defeating a boss feels highly rewarding
