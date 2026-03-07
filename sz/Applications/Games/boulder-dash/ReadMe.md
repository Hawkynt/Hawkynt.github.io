# Boulder Dash

A grid-based cave exploration game for the SynthelicZ Desktop. Dig through underground caves, collect gems, avoid falling boulders and enemies, and reach the exit before time runs out.

## User Stories

### Core Gameplay
- [x] As a player, I can move through the cave using Arrow Keys or WASD with smooth lerp-interpolated movement so that navigation feels fluid
- [x] As a player, I can dig through dirt tiles by moving into them so that I can carve paths through the cave
- [x] As a player, I can collect gems that award 100 points each with sparkle effects and floating score text so that I have a clear scoring objective
- [x] As a player, I can push boulders horizontally into empty spaces so that I can rearrange the cave layout
- [x] As a player, I can reach the exit once I have collected enough gems to unlock it so that each level has a clear completion condition
- [x] As a player, I can see the exit unlock with golden sparkle particles when the gem quota is met so that I know it is available

### Boulder Physics
- [x] As a player, I can see boulders fall when unsupported (tile below is empty) with animated fall transitions so that the cave feels physically realistic
- [x] As a player, I can be crushed by falling boulders so that I must watch for danger above
- [x] As a player, I can see boulders slide off rounded objects (other boulders or gems) to either side so that chain reactions can occur
- [x] As a player, I can see boulder landing dust particles and screen shake so that impacts feel weighty

### Enemy System
- [x] As a player, I can face enemies with wall-following movement AI so that I encounter unpredictable threats
- [x] As a player, I can see enemies killed by falling boulders for 500 bonus points with particle bursts and floating score text so that I can use the environment against them
- [x] As a player, I can be killed by touching an enemy so that I must plan my movements carefully
- [x] As a player, I can face increasing numbers of enemies per level (2 + level, capped at 8) so that difficulty ramps up

### Level Progression
- [x] As a player, I can advance through procedurally generated cave levels with increasing difficulty so that each level presents fresh challenges
- [x] As a player, I can see gem quota requirements increase per level (8 + level x 2, capped at 30) so that later levels demand more exploration
- [x] As a player, I can earn a time bonus for remaining seconds when completing a level so that speed is rewarded
- [x] As a player, I can see the time limit decrease per level (150s down to 60s minimum) so that urgency increases

### Lives and Death
- [x] As a player, I can start with 3 lives and lose a life when killed so that I have limited chances
- [x] As a player, I can see a death explosion particle effect and screen shake when I die so that death feels impactful
- [x] As a player, I can respawn at the start position after dying if I have remaining lives so that I can continue

### Visual Effects
- [x] As a player, I can see dirt digging produces brown particle bursts so that clearing terrain is satisfying
- [x] As a player, I can see gem collection produces cyan sparkle particles so that pickups feel rewarding
- [x] As a player, I can see gems rendered with a translucent glow effect via shadowBlur so that gems are visually distinct
- [x] As a player, I can see dirt tiles fade out with a smooth alpha transition when dug so that terrain removal is animated
- [x] As a player, I can see boulder falling and sliding animations so that physics feels smooth rather than instant
- [x] As a player, I can see level-complete confetti celebrations so that finishing a level feels rewarding

### Tutorial and Persistence
- [x] As a player, I can see a 2-page tutorial overlay on first play explaining movement, digging, and tips so that I learn the game quickly
- [x] As a player, I can press H at any time to toggle the tutorial overlay so that I can review instructions
- [x] As a player, I can have my tutorial-seen state persisted via localStorage so that it only auto-shows once
- [x] As a player, I can have my high scores (top 5) persisted via localStorage so that my best runs are tracked

### UI and Integration
- [x] As a player, I can access Game menu (New F2, Pause Esc, High Scores, Exit) and Help menu (How to Play, Controls, About) so that standard game management is accessible
- [x] As a player, I can pause and resume the game with Escape so that I can take breaks
- [x] As a player, I can start a new game with F2 so that I can quickly restart
- [x] As a player, I can see score, level, lives, time remaining, and gem count in the status bar so that key information is always visible

### Planned Features
- [ ] As a player, I can hear sound effects for digging, gem collection, boulder crashes, and enemy death so that the game has audio feedback
- [ ] As a player, I can encounter special gem types worth bonus points so that exploration has more variety
- [ ] As a player, I can face multiple enemy types with different movement patterns so that enemies present diverse threats
- [ ] As a player, I can discover hidden bonus rooms behind false walls so that exploration is deeper
- [ ] As a player, I can play hand-crafted levels alongside procedural ones so that level design has more variety

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move & dig |
| Escape | Pause / Resume |
| F2 | New Game |
| H | Toggle tutorial overlay |

## SEO Keywords

boulder dash, browser game, free online game, cave game, gem collector, puzzle game, SynthelicZ, WebOS game, HTML5 game, canvas game, boulder physics, dig game
