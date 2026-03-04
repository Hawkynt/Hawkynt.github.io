# Boulder Dash

A grid-based cave exploration game for the SynthelicZ Desktop. Dig through underground caves, collect gems, avoid falling boulders and enemies, and reach the exit before time runs out.

## User Stories

- **S-049**: As a player, I want to navigate grid-based caves, dig through dirt, collect gems while avoiding falling boulders and enemies, so that I experience strategic puzzle-action gameplay.
- **S-050**: As a player, I want Boulder Dash to have gem sparkles, boulder dust particles, death explosion glow, screen shake, and level-complete confetti, so that the game feels polished and exciting.
- **S-000**: As a player, I want every game to have particle effects, glow, screen shake, and floating score text, so that games feel polished and exciting.

## Features

- **Grid-based cave** with walls, dirt, boulders, gems, and an exit
- **Smooth grid movement** with Arrow Keys / WASD (lerp interpolation between cells)
- **Dirt digging** — move into dirt cells to clear them
- **Boulder physics** — boulders fall when unsupported, slide off rounded objects
- **Boulder crushing** — falling boulders kill the player or enemies
- **Push boulders** horizontally into empty spaces
- **Gem collection** with sparkle particle effects and floating score text
- **Gem quota** per level — collect enough gems to unlock the exit
- **Enemy AI** with wall-following movement patterns
- **Enemies killed** by falling boulders for bonus points
- **Level progression** with procedural cave generation and increasing difficulty
- **Time limit** per level with countdown timer
- **Time bonus** score for remaining seconds when completing a level
- **Lives system** with respawn and game over
- **Particle effects**: dig bursts, gem sparkles, boulder dust, death explosion, level confetti
- **Screen shake** on boulder crashes and player death
- **Floating score text** on gem collection and enemy kills
- **Gem glow** effect via shadowBlur rendering
- **Transparent crystal rendering** — gems render over cave background without opaque rectangles
- **Tutorial overlay** — 2-page guide shown on first play, toggled with H key, persisted via localStorage
- **High score persistence** via localStorage
- **Menu bar**: Game (New F2, Pause Esc, High Scores, Exit) + Help (How to Play, Controls, About)
- **Dialog system** for high scores, controls, and about

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move & dig |
| Escape | Pause / Resume |
| F2 | New Game |
| H | Toggle tutorial overlay |

## SEO Keywords

boulder dash, browser game, free online game, cave game, gem collector, puzzle game, SynthelicZ, WebOS game, HTML5 game, canvas game, boulder physics, dig game
