# Space Combat

A top-down space shooter for the SynthelicZ Desktop. Pilot your ship in intense dogfights against waves of enemies, upgrade weapons, and chase high scores with explosive visual effects.

## User Stories

- **S-003**: As a player, I want to pilot a spaceship in top-down dogfights with different enemy ship types and upgradeable weapons, so that I experience classic arcade space combat.
- **S-004**: As a player, I want space combat to have laser glow, explosion particles, shield shimmer, and screen shake, so that combat feels intense and satisfying.
- **S-000**: As a player, I want every game to have particle effects, glow, screen shake, and floating score text, so that games feel polished and exciting.

## Features

- **8-directional movement** with WASD/Arrow keys and thruster trail particles
- **3 weapon types**: Spread Shot (fan of 3), Laser (continuous beam), Missiles (homing projectiles)
- **Fire with Space/Z** with per-weapon cooldown rates
- **Multiple enemy types**: Scout (fast, weaving), Fighter (shoots back), Bomber (slow, tough, drops bombs)
- **Wave progression** with increasing difficulty (more enemies, faster, tougher)
- **Shield system** absorbs hits with shimmer visual effect
- **Score multiplier** for kill streaks
- **Weapon upgrade pickups** dropped by destroyed enemies
- **Particle effects**: explosions, thruster trails, shield shimmer, laser glow
- **Screen shake** on player/enemy hits
- **Floating score text** on enemy kills
- **High score persistence** via localStorage
- **Touch controls** (drag to move, tap to fire)
- **Menu bar**: Game (New F2, Pause Esc, High Scores, Exit) + Help (Controls, About)
- **Dialog system** for high scores, controls, and about

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move ship (8 directions) |
| Space / Z | Fire weapon |
| Escape | Pause / Resume |
| F2 | New Game |

Touch: Drag to move, tap to fire.

## Game Mechanics

- **Scoring**: Points per enemy kill (Scout=100, Fighter=200, Bomber=500), multiplied by streak
- **Streak**: Consecutive kills within 2 seconds increase multiplier (max 8x)
- **Waves**: Each wave spawns more enemies with higher speed; wave number displayed on screen
- **Shield**: Starts with 3 HP, absorbs damage, recharges between waves
- **Weapons**: Collect upgrade pickups to cycle through spread/laser/missile
- **Lives**: 3 lives, lose one on hit (if shield is down), game over at 0

## SEO Keywords

space combat, browser game, free online game, space shooter, top-down shooter, arcade game, SynthelicZ, WebOS game, HTML5 game, canvas game, dogfight, space battle
