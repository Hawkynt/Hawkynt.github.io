# Bubble Bobble

A single-screen platformer for the SynthelicZ Desktop. Shoot bubbles to trap enemies, pop them for points, and collect fruit items for bonus score. Features platform physics with screen wrapping, power-ups, wind-based level flow, and increasing difficulty across procedurally generated levels.

## How It Works

The player controls a character on a 512x448 canvas with platforming physics (gravity at 600, jump force of -320). Each level is a single screen with walls, a floor, and 5 rows of alternating platforms. Enemies patrol the platforms and the player must shoot bubbles to trap them, then touch the trapped bubbles to pop them. Popping enemies spawns fruit items worth bonus points. When all enemies in a level are defeated, the next level generates with more enemies, faster movement, wind effects, and shorter bubble lifespans. The player has 3 lives and earns a brief invincibility window after dying. The game ends when all lives are lost, and the score is saved to a persistent high score table.

## User Stories

### Core Gameplay
- [x] As a player, I can move left and right at 150 px/s using arrow keys or A/D so that I can navigate the level
- [x] As a player, I can jump with Up arrow or W key against gravity so that I can reach higher platforms
- [x] As a player, I can shoot bubbles in the facing direction using Space, Z, or X keys with a cooldown so that I can trap enemies
- [x] As a player, I can land on platforms via one-way collision detection so that I only stop when falling from above
- [x] As a player, I can wrap from bottom to top of the screen when falling through the floor so that the level is interconnected
- [x] As a player, I can see a 4-frame walking animation that cycles while moving so that the character feels animated

### Bubble Mechanics
- [x] As a player, I can see bubbles travel in the facing direction at 200 px/s with vertical wobble so that shots have momentum
- [x] As a player, I can see bubbles transition to a float phase drifting upward at -30 px/s so that bubbles rise after firing
- [x] As a player, I can see floating bubbles wobble horizontally and be affected by level wind flow so that bubble positioning is dynamic
- [x] As a player, I can see bubbles collide with platforms and bounce off walls so that bubbles interact with the environment
- [x] As a player, I can see bubble lifespan decrease with each level (base 8s, -0.3/level, min 3s) so that trapping enemies becomes harder
- [x] As a player, I can see trapped enemies released when their bubble expires so that I must pop bubbles quickly
- [x] As a player, I can stand on floating bubbles as temporary platforms so that bubbles serve a dual purpose

### Enemy System
- [x] As a player, I can face enemies that spawn in increasing numbers per level (3 + level, capped at 10) so that difficulty ramps up
- [x] As a player, I can see enemies patrol horizontally with increasing speed per level so that later levels are faster-paced
- [x] As a player, I can trap enemies by hitting them with a bubble during the shoot phase so that I can set up pops
- [x] As a player, I can see trapped enemies float with their containing bubble so that I can guide them
- [x] As a player, I can die by touching an untrapped enemy (unless invincible) so that enemies are dangerous

### Scoring and Items
- [x] As a player, I can pop trapped bubbles by touching them for 100 points each with particle bursts so that defeating enemies is satisfying
- [x] As a player, I can collect fruit items dropped by popped enemies for 200 points with sparkle effects so that bonus scoring exists
- [x] As a player, I can see score, level, and lives in the status bar so that key information is always visible
- [x] As a player, I can have my high scores (top 5) persisted via localStorage so that my best runs are tracked

### Power-Ups
- [x] As a player, I can collect speed power-ups that increase movement speed by 1.5x for 10 seconds so that I can move faster
- [x] As a player, I can collect range power-ups that extend bubble travel distance by 1.5x for 10 seconds so that I can reach farther enemies
- [x] As a player, I can see golden sparkle particles and "POWER UP!" floating text when collecting power-ups so that pickups are noticeable

### Level Progression
- [x] As a player, I can advance through levels with 5 rows of platforms and alternating offsets so that each level has a structured layout
- [x] As a player, I can experience increasing wind flow per level that affects bubble movement so that later levels require adapting strategy
- [x] As a player, I can see level-complete confetti bursts at 5 random positions when all enemies are cleared so that completing a level feels rewarding

### Lives and Death
- [x] As a player, I can start with 3 lives so that I have multiple chances
- [x] As a player, I can see a red particle burst and screen shake when dying so that death feels impactful
- [x] As a player, I can respawn with 1.5 seconds of invincibility after death so that I am not instantly killed again
- [x] As a player, I can see the game enter Game Over state with high score recording when all lives are lost so that the run has closure

### Visual Effects
- [x] As a player, I can see a vertical gradient background with twinkling sparkle dots so that the environment feels alive
- [x] As a player, I can see platforms rendered as colored brick patterns so that the level has visual texture
- [x] As a player, I can see particle effects for trapping (blue), popping (cyan), enemy escape (red), and wall bouncing so that all interactions have feedback

### Tutorial System
- [x] As a player, I can see a 2-page tutorial overlay on first play explaining controls and tips so that I learn the game quickly
- [x] As a player, I can press H at any time to toggle the tutorial overlay so that I can review instructions
- [x] As a player, I can have my tutorial-seen state persisted via localStorage so that it only auto-shows once

### UI and Integration
- [x] As a player, I can access Game menu (New Game F2, Pause Esc, High Scores, Exit) and Help menu (How to Play, Controls, About) so that standard management is accessible
- [x] As a player, I can see the window title update to show current level/score or "Game Over" so that the title bar reflects game state
- [x] As a player, I can pause/resume with Escape and start a new game with F2 so that game flow is controllable
- [x] As a player, I can click the canvas on the READY or DEAD screen to start/restart so that I can begin without keyboard

### Planned Features
- [ ] As a player, I can face multiple enemy types with different behaviors (flying, jumping, fast) so that enemies present diverse threats
- [ ] As a player, I can encounter boss enemies on milestone levels so that progression has memorable encounters
- [ ] As a player, I can play cooperatively with a second player so that the game supports its classic two-player mode
- [ ] As a player, I can collect a fire power-up that lets bubbles pierce through enemies so that there is more power-up variety
- [ ] As a player, I can hear sound effects for shooting, popping, and enemy trapping so that the game has audio feedback

## Controls

| Key | Action |
|-----|--------|
| Arrow Left / A | Move left |
| Arrow Right / D | Move right |
| Arrow Up / W | Jump |
| Space / Z / X | Shoot bubble |
| Escape | Pause / Resume |
| F2 | New Game |
| H | Toggle tutorial overlay |

## Technical Details

- Canvas size: 512x448 pixels
- Game loop uses requestAnimationFrame with delta-time capped at 50ms (MAX_DT)
- Physics: Gravity 600 px/s^2, Jump force -320, Player speed 150 px/s, Bubble speed 200 px/s
- AABB collision detection for all entity interactions
- Platform landing uses previous-frame bottom position to detect one-way collisions
- localStorage keys: `sz-bubble-bobble-highscores`, `sz-bubble-bobble-tutorial-seen`
- IIFE pattern with SZ.GameEffects.ParticleSystem, ScreenShake, and FloatingText

## Architecture

- `index.html` -- Entry point with SEO meta, menu bar, canvas, status bar, dialogs
- `controller.js` -- IIFE game engine: player physics, bubble mechanics, enemy AI, level generation, power-ups, scoring, effects
- `styles.css` -- Layout and theming
- `icon.svg` -- Desktop icon

## Known Limitations

- Enemy AI is simple horizontal patrol with gravity; no pathfinding or player-seeking behavior
- Platform layouts use a fixed 5-row pattern with alternating offsets; no randomized or hand-designed layouts
- Fire power-up type exists in the spawn pool but only speed and range have distinct gameplay effects
- No cooperative two-player mode (original Bubble Bobble was two-player)
- No boss enemies or special level events

## SEO Keywords

bubble bobble, browser game, free online game, platformer, bubble shooter, trap enemies, arcade game, SynthelicZ, WebOS game, HTML5 game, canvas game, retro game
