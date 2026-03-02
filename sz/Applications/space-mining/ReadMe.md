# Space Mining

A space mining and economy game for the SynthelicZ Desktop. Pilot your mining rig through asteroid fields, drill for precious ores, sell resources at the station, and upgrade your equipment.

## User Stories

- **S-013**: As a player, I want to fly a mining rig to asteroids, drill for ore, sell at a station, and buy upgrades, so that I experience a satisfying resource extraction loop.
- **S-014**: As a player, I want drill particle sprays, ore glow effects, asteroid break debris, and screen shake, so that mining feels impactful and visually exciting.
- **S-000**: As a player, I want every game to have particle effects, glow, screen shake, and floating score text, so that games feel polished and exciting.

## Features

- **Free-flight mining rig** with WASD/Arrow key thrust-based movement and rotation
- **Drill mechanic**: hold Space near asteroids to extract ore with particle spray effects
- **4 ore types**: Iron (grey glow), Gold (yellow glow), Platinum (white glow), Crystal (cyan glow) -- each with distinct value and glow color
- **Cargo system** with limited capacity -- must return to station to sell
- **Station trading**: sell ore for credits with dynamic market prices
- **Equipment upgrades**: drill speed, cargo capacity, engine power, scanner range
- **Asteroid variety**: different sizes, ore types, and yield amounts
- **Large scrolling world** with camera following the ship
- **Visual effects**: drill particle sprays, ore glow (shadowBlur), asteroid break debris, screen shake, floating profit text
- **High score persistence** via localStorage
- **Menu bar**: Game (New F2, Pause Esc, High Scores, Exit) + Help (Controls, About)
- **Dialog system** for high scores, controls, and about

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Fly mining rig (thrust + rotate) |
| Space | Activate drill (when near asteroid) |
| E | Sell cargo / Open shop (when at station) |
| Escape | Pause / Resume |
| F2 | New Game |

## Game Mechanics

### Mining
Fly near an asteroid and hold Space to drill. Resources extract over time based on drill speed. Different asteroid types yield different ores. When an asteroid is fully depleted it breaks apart with debris particles and screen shake.

### Economy
Return to the central station to sell ore. Prices fluctuate dynamically. Use credits to purchase equipment upgrades that improve drill speed, cargo capacity, engine thrust, and scanner range.

### Upgrades
| Upgrade | Effect |
|---------|--------|
| Drill Speed | Faster resource extraction rate |
| Cargo Size | Increased cargo capacity |
| Engine Power | Faster ship acceleration |
| Scanner | Highlights nearby ore deposits |

## SEO Keywords

space mining game, asteroid mining browser game, free online mining game, ore extraction game, space economy game, browser mining simulator, SynthelicZ game, web-based space game, asteroid drilling game, resource management space game
