# Bomberman

A grid-based arcade game for the SynthelicZ Desktop. Navigate arenas, place bombs to destroy walls and defeat enemies, collect power-ups, and advance through increasingly challenging levels with explosive visual effects.

## User Stories

### Core Gameplay
- [x] As a player, I can navigate a grid-based arena using Arrow Keys or WASD with smooth lerp-interpolated movement between cells so that movement feels fluid
- [x] As a player, I can place bombs with the Space key that explode after a timed fuse in cardinal directions so that I can destroy walls and enemies
- [x] As a player, I can trigger chain explosions when bomb blasts reach adjacent bombs so that I can create devastating cascading combos
- [x] As a player, I can destroy breakable brick walls with bomb blasts to reveal hidden power-ups so that I can access new areas and upgrades
- [x] As a player, I can be killed by my own bomb explosions or by touching enemies so that I must plan my bomb placement carefully
- [x] As a player, I can push boulders horizontally into empty spaces (with Kick power-up) so that I can rearrange the battlefield

### Power-Ups
- [x] As a player, I can collect Extra Bombs (B) to increase my maximum simultaneous bomb count so that I can control more of the arena
- [x] As a player, I can collect Bigger Blast (F) to increase my explosion range so that my bombs are more destructive
- [x] As a player, I can collect Speed Boost (S) to move faster so that I can outmaneuver enemies
- [x] As a player, I can collect Kick (K) to push bombs one tile in the direction I walk into them so that I can reposition placed bombs
- [x] As a player, I can collect Remote Detonation (R) to manually trigger bomb explosions instead of waiting for the fuse so that I have precise timing control
- [x] As a player, I can collect Power Kick (P) to slide bombs across the ground until they hit an obstacle so that I can send bombs deep into corridors
- [x] As a player, I can collect Fly (W) to walk through bombs freely so that bombs no longer block my path
- [x] As a player, I can collect Glove (G) to throw bombs in a random direction over walls so that I can attack distant targets
- [x] As a player, I can collect Climb (C) to walk over destructible walls so that I can traverse the arena more freely

### Enemy System
- [x] As a player, I can face 7 enemy types with distinct behaviors (slow, normal, fast, climber, chaser, tank, ghost) so that each level presents unique tactical challenges
- [x] As a player, I can see new enemy types unlock at specific levels (climber at 3, chaser at 4, tank at 5, ghost at 7) so that difficulty progresses gradually
- [x] As a player, I can observe climber enemies that walk over destructible walls so that some enemies bypass my barriers
- [x] As a player, I can observe chaser enemies that actively pursue me so that I must keep moving
- [x] As a player, I can observe tank enemies with multiple HP that require extra hits so that some enemies are harder to kill
- [x] As a player, I can observe ghost enemies that phase through walls periodically so that no area is completely safe
- [x] As a player, I can defeat all enemies to advance to the next level so that I have a clear objective each level

### Progression
- [x] As a player, I can advance through procedurally generated levels with increasing wall density and enemy count so that the game becomes progressively harder
- [x] As a player, I can earn score points for defeating enemies with level-scaled multipliers so that later enemies are worth more
- [x] As a player, I can start with 3 lives and lose a life when hit by an explosion or enemy so that I have limited chances
- [x] As a player, I can see a "LEVEL X" floating text announcement when advancing so that level transitions are clear

### Visual Effects
- [x] As a player, I can see particle burst effects with orange/red circles and yellow sparks on bomb explosions so that explosions feel impactful
- [x] As a player, I can see brown confetti debris when destructible walls are destroyed so that wall destruction is satisfying
- [x] As a player, I can see screen shake on explosions that scales with blast range so that big blasts feel powerful
- [x] As a player, I can see floating score text when enemies are killed so that I know how many points I earned
- [x] As a player, I can see gold sparkle particles when collecting power-ups so that pickups feel rewarding
- [x] As a player, I can see sprite-based rendering with animated characters and terrain when sprites are loaded so that the game looks polished
- [x] As a player, I can see animated bomb sprites with pulsing size and color-changing fuse sparks so that bomb timing is visually clear

### Tutorial and Persistence
- [x] As a player, I can see a 2-page tutorial overlay on first play explaining controls and power-ups so that I learn the game without external docs
- [x] As a player, I can press H at any time to toggle the tutorial overlay so that I can review instructions mid-game
- [x] As a player, I can have my high scores (top 5) persisted via localStorage so that my best runs are remembered
- [x] As a player, I can have my tutorial-seen state persisted so that the tutorial only auto-shows once

### UI and Integration
- [x] As a player, I can access Game menu (New F2, Pause Esc, High Scores, Exit) and Help menu (How to Play, Controls, About) so that standard game management is accessible
- [x] As a player, I can pause and resume the game with Escape so that I can take breaks
- [x] As a player, I can start a new game with F2 so that I can quickly restart
- [x] As a player, I can see score, level, lives, and game state in the status bar so that key information is always visible

### Planned Features
- [ ] As a player, I can hear sound effects for explosions, power-up collection, and enemy death so that the game has audio feedback
- [ ] As a player, I can play in multiplayer mode against another human player so that I can compete with friends
- [ ] As a player, I can face a boss enemy at milestone levels so that progression has memorable encounters
- [ ] As a player, I can see a minimap of the arena so that I can plan my routes more effectively
- [ ] As a player, I can unlock cosmetic character skins so that I can personalize my appearance

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move player |
| Space | Place bomb |
| Escape | Pause / Resume |
| F2 | New Game |
| H | Toggle tutorial overlay |

## SEO Keywords

bomberman, browser game, free online game, grid game, bomb game, arcade game, SynthelicZ, WebOS game, HTML5 game, canvas game, puzzle action, power-ups
