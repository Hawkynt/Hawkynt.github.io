# Bomberman

A grid-based arcade game for the SynthelicZ Desktop. Navigate arenas, place bombs to destroy walls and defeat enemies, collect power-ups, and advance through increasingly challenging levels with explosive visual effects.

## User Stories

- **S-053**: As a player, I want to navigate a grid-based arena, place bombs to destroy walls and defeat enemies, and collect power-ups, so that I experience strategic arcade action.
- **S-054**: As a player, I want Bomberman to have explosion fire glow, power-up sparkles, death particle bursts, and screen shake on chain explosions, so that the game feels intense.
- **S-000**: As a player, I want every game to have particle effects, glow, screen shake, and floating score text, so that games feel polished and exciting.

## Features

- **Grid-based arena** with indestructible walls, destructible bricks, and walkable tiles
- **Smooth grid movement** with WASD/Arrow keys (lerp interpolation between cells)
- **Bomb placement** with Space key, timed fuse, and cardinal direction explosions
- **Chain explosions** — bombs detonate adjacent bombs for cascading blasts
- **Destructible walls** reveal hidden power-ups when destroyed
- **5 power-up types**: Extra Bombs, Bigger Blast, Speed Boost, Kick, Remote Detonation
- **3+ AI enemies** with wandering movement behavior
- **Lives system** with respawn and game over
- **Multiple arena layouts** via procedural level generator with increasing difficulty
- **Score tracking** with points for enemy kills
- **Particle effects**: explosion bursts, wall destruction, death particles, power-up sparkles
- **Screen shake** on explosions and chain reactions
- **Floating score text** on enemy kills
- **Fire glow** effect on explosion cells
- **High score persistence** via localStorage
- **Menu bar**: Game (New F2, Pause Esc, High Scores, Exit) + Help (Controls, About)
- **Dialog system** for high scores, controls, and about

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move player |
| Space | Place bomb |
| Escape | Pause / Resume |
| F2 | New Game |

## SEO Keywords

bomberman, browser game, free online game, grid game, bomb game, arcade game, SynthelicZ, WebOS game, HTML5 game, canvas game, puzzle action, power-ups
