# Space Invaders -- Enhanced Edition

Arcade game where the player defends Earth from waves of alien invaders across three game modes. Features 12 unique wave formations, 8 power-up types, boss fights with multi-phase attack patterns, combo scoring with multipliers, special enemy types, a drone helper, and a starfield background. Part of the SynthelicZ Desktop game collection.

## How It Works

Canvas-based game with proper aspect-ratio scaling. All game logic runs in a virtual 480x540 coordinate space that scales to any window size. A starfield background scrolls behind the action. Aliens spawn in varied formations, march side-to-side, and drop down at edges. Power-ups drop from destroyed aliens and UFOs. Boss fights occur at regular intervals with multiple attack patterns. Combo scoring rewards rapid kills with score multipliers.

## Architecture

- **`index.html`** -- Menu bar (Game/Help), canvas, status bar, dialogs (High Scores, Controls & Power-Ups, About)
- **`controller.js`** -- IIFE with wave formations, power-up system, boss AI, combo scoring, special enemy types, drone helper, alien drawing, collision detection, game states
- **`styles.css`** -- Game layout and visual styling
- **Shared modules** -- `menu.js`, `dialog.js`, `game-effects.js` (particles, screen shake, floating text, starfield, glow)

## User Stories

### Game Modes
- [x] As a player, I can choose between Classic, Survival, and Boss Rush modes so that I can play the style I enjoy
- [x] As a player, I can play Classic mode with progressive levels and boss fights every 5 levels so that I have structured progression
- [x] As a player, I can play Survival mode with endless waves and no level transitions so that the action never stops
- [x] As a player, I can play Boss Rush mode with a boss every level and double power-up frequency so that I face constant epic fights

### Wave Formations
- [x] As a player, I can face 12 different wave formations (Classic Grid, V-Formation, Diamond Strike, Arrow Assault, Cross Attack, Zigzag, Fortress, Wings, Scatter, Phalanx, Diver Squadron, Shield Wall) so that each level looks and plays differently
- [x] As a player, I can see wave formation names announced on entry so that I know what I'm facing

### Power-ups
- [x] As a player, I can collect 8 power-up types (Triple Shot, Rapid Fire, Shield, Laser, Slow-Mo, Extra Life, Bomb, Drone) so that gameplay stays fresh
- [x] As a player, I can stack power-ups (e.g. Triple Shot + Rapid Fire + Laser simultaneously) so that I can combine abilities
- [x] As a player, I can see active power-up timers as HUD icons in the top-right corner so that I know how long each lasts
- [x] As a player, I can collect an already-active power-up to refresh its timer so that pickups are always useful
- [x] As a player, I can use the Triple Shot for a 3-bullet spread pattern so that I cover more area
- [x] As a player, I can use Rapid Fire for reduced cooldown and increased max bullets so that I output more damage
- [x] As a player, I can use the Shield to block the next lethal hit so that I get a second chance
- [x] As a player, I can use the Laser for piercing shots through all aliens so that I can cut through formations
- [x] As a player, I can use Slow-Mo to reduce alien speed to 40% so that I get breathing room
- [x] As a player, I can use the Bomb to instantly destroy all aliens on screen so that I can clear overwhelming waves
- [x] As a player, I can use the Drone helper that follows me and auto-fires so that I have extra firepower

### Boss Fights
- [x] As a player, I can face bosses with a health bar and base HP that scales per boss number so that bosses grow tougher
- [x] As a player, I can see bosses change behavior at low health (Phase 2 with red hull, faster attacks, Spiral attack) so that fights escalate
- [x] As a player, I can see a dramatic WARNING entrance before boss fights so that they feel epic
- [x] As a player, I can see multi-stage explosion cascades and confetti on boss defeat so that victory feels satisfying
- [x] As a player, I can collect 3 power-up drops from defeated bosses so that boss kills are highly rewarding
- [x] As a player, I can face escort aliens alongside bosses so that the battlefield stays active

### Combo System
- [x] As a player, I can build a combo counter by killing aliens within 1.5 seconds of each other so that rapid play is rewarded
- [x] As a player, I can earn score multipliers (x1 through x5) based on combo length so that skilled play earns more points
- [x] As a player, I can see combo milestone announcements at x2, x3, x4, x5 thresholds so that I feel rewarded for streaks

### Special Enemies
- [x] As a player, I can face diver aliens that swoop toward me in sine-wave patterns with particle trails so that I must dodge dynamic threats
- [x] As a player, I can face shielded aliens with visible energy bubbles that require 2 hits to destroy so that I must adapt my strategy

### Core Gameplay
- [x] As a player, I can start with 3 lives and 4 destructible shield bunkers so that I have layered protection
- [x] As a player, I can move left/right and shoot upward to destroy alien formations so that the gameplay is classic and intuitive
- [x] As a player, I can see a UFO cross the top of the screen periodically with random point values so that I have bonus scoring opportunities
- [x] As a player, I can experience aliens speeding up as fewer remain so that each wave builds tension
- [x] As a player, I can lose instantly if aliens reach my row so that there is real consequence for letting them advance

### Visual Effects
- [x] As a player, I can see a scrolling starfield background with twinkling stars so that the space setting feels immersive
- [x] As a player, I can see particle explosions and screen flash on big events so that impacts feel dramatic
- [x] As a player, I can see screen shake on player death and boss defeat so that events feel impactful
- [x] As a player, I can see bullet trail particles so that shots feel dynamic
- [x] As a player, I can see confetti on level completion so that clearing a wave feels celebratory
- [x] As a player, I can see a pulsing animated title screen so that the game feels alive before I start

### Game Management
- [x] As a player, I can see high scores persisted to localStorage (top 10, with mode and level/wave tracking) so that I can compare across modes
- [x] As a player, I can pause/resume with P so that I can take breaks
- [x] As a player, I can start a new game with F2 and select modes with 1/2/3 keys so that starting is quick
- [x] As a player, I can see a status bar showing score, lives, and level/wave so that I always know my state
- [x] As a player, I can see the canvas scale to any window size with proper aspect ratio and letterboxing so that the game looks correct at any size

### Integration
- [x] As a player, I can see a menu bar with Game (New Game, Pause, High Scores, Exit) and Help (Controls & Power-Ups, About) so that all actions are discoverable

### Planned Features
- [ ] As a player, I can hear sound effects and music so that the game has audio atmosphere
- [ ] As a player, I can use touch/mobile controls so that the game works on touchscreen devices
- [ ] As a player, I can create custom wave layouts with a wave editor so that I can design my own challenges
- [ ] As a player, I can see an online leaderboard so that I can compete globally
- [ ] As a player, I can earn achievements for milestones so that I have secondary objectives
