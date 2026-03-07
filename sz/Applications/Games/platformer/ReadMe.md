# Platformer

A side-scrolling platformer for the SynthelicZ Desktop. Run, jump, collect coins, stomp enemies, grab power-ups, and defeat bosses across procedurally generated levels with scrolling camera. Part of the SynthelicZ Desktop.

## How It Works

1. Move left/right with Arrow Keys or A/D, jump with Up/W/Space
2. Collect coins for points and stomp on enemies to defeat them
3. Grab power-ups (double jump, invincibility, fireball) for temporary abilities
4. Defeat bosses every 5 levels
5. Progress through levels of increasing difficulty with more enemies and longer terrain

## User Stories

### Core Gameplay
- [x] As a user, I can run left and right using Arrow Keys or A/D
- [x] As a user, I can jump using Arrow Up, W, or Space with gravity physics
- [x] As a user, I can land on platforms and walk along terrain
- [x] As a user, I can see smooth camera scrolling following the player
- [x] As a user, I can see a parallax background scrolling behind the level

### Enemies
- [x] As a user, I can encounter multiple enemy types: walkers, flyers, and shooters with AI
- [x] As a user, I can stomp on enemies by jumping on them to defeat them with particle burst
- [x] As a user, I can lose a life when hitting an enemy from the side or being shot

### Coins & Scoring
- [x] As a user, I can collect coins with sparkle particles and floating score text
- [x] As a user, I can see my score increase on coin collection and enemy defeat

### Power-ups
- [x] As a user, I can grab a double jump power-up for an extra mid-air jump
- [x] As a user, I can grab an invincibility power-up with glow aura effect
- [x] As a user, I can grab a fireball power-up and press Z to shoot fireballs
- [x] As a user, I can see power-up activation glow effects

### Boss Fights
- [x] As a user, I can fight a boss every 5 levels
- [x] As a user, I can see boss health bars during boss fights
- [x] As a user, I can feel screen shake during boss encounters

### Progression
- [x] As a user, I can progress through levels with increasing difficulty (more enemies, longer levels)
- [x] As a user, I can see a lives system with invincibility on respawn

### Visual Effects
- [x] As a user, I can see coin-collect sparkle particles
- [x] As a user, I can see enemy-defeat particle bursts
- [x] As a user, I can see screen shake on boss hits and player damage
- [x] As a user, I can see floating score text

### Tutorial & UI
- [x] As a user, I can see a 2-page tutorial overlay shown on first play, toggled with H key, persisted via localStorage
- [x] As a user, I can see high score persistence via localStorage
- [x] As a user, I can use the menu bar (Game: New/Pause/High Scores/Exit, Help: How to Play/Controls/About)
- [x] As a user, I can use the dialog system for high scores, controls, and about

### OS Integration
- [x] As a user, I can press F2 for new game, Escape for pause
- [x] As a user, I can see window title updates

### Planned
- [ ] As a user, I can hear sound effects for jumping, coin collection, and enemy defeat
- [ ] As a user, I can grab additional power-up types (speed boost, magnet)
- [ ] As a user, I can access a level select screen to replay completed levels
- [ ] As a user, I can perform wall-jumping to reach new areas
- [ ] As a user, I can see themed visual environments that change as I progress through levels

## Controls

| Key | Action |
|-----|--------|
| Arrow Left / A | Move left |
| Arrow Right / D | Move right |
| Arrow Up / W / Space | Jump |
| Z | Fireball (with power-up) |
| Escape | Pause / Resume |
| F2 | New Game |
| H | Toggle tutorial overlay |

## Technical Details

- **Engine**: Vanilla JavaScript canvas 2D with IIFE pattern and `window.SZ` namespace
- **Physics**: Gravity, platform landing, and collision response
- **Camera**: Smooth scrolling following player position
- **Level generation**: Procedural levels with increasing difficulty parameters
- **Effects**: SZ.GameEffects (ParticleSystem, ScreenShake, FloatingText)
- **Persistence**: localStorage for high scores
- **OS integration**: SetWindowText, RegisterWindowProc

## Known Limitations

- No sound effects
- No level select screen
- Procedural levels may occasionally generate unfair enemy placement

## SEO Keywords

platformer, browser game, free online game, side-scrolling, jump and run, coin collect, enemy stomp, boss fight, arcade game, SynthelicZ, WebOS game, HTML5 game, canvas game, retro game
