# Endless Runner

A fast-paced side-scrolling auto-runner game for the SynthelicZ Desktop. Dodge obstacles by switching lanes, jumping and sliding while collecting coins and power-ups in an ever-accelerating run.

## User Stories

- **S-055**: As a player, I want to run endlessly through procedurally generated obstacle courses, collecting coins, using power-ups, and chasing high scores, so that I experience Temple Run-style gameplay.
- **S-056**: As a player, I want endless runner to have speed-line effects at high velocity, coin-collect sparkles, obstacle-near glow warnings, and smooth lane-switching animations, so that running feels fast and fluid.
- **S-000**: As a player, I want every game to have particle effects, glow, screen shake, and floating score text, so that games feel polished and exciting.

## Features

- **3-lane movement** with smooth 150ms lane-switch transitions
- **Jump mechanic** (600ms arc) clears low barriers
- **Slide mechanic** (500ms) clears high barriers
- **Procedural obstacle generation** with multiple types (barrier-low, barrier-high, full-block)
- **Guaranteed safe path** — at least one lane is always passable
- **Coin collection** (+10 points each, sparkle effects, floating text)
- **3 power-ups**: Magnet (8s coin attraction), Shield (absorbs one hit, up to 15s), Score Multiplier (2x for 10s)
- **Speed progression** from 8 m/s base with +0.08 m/s/s acceleration
- **4 visual speed tiers**: Day (0-12), Sunset (12-16), Night (16-20), Neon (20+)
- **Speed-line effects** at high velocity
- **Obstacle warning glow** when approaching
- **Power-up aura/shimmer** visual effects
- **Screen shake on death**, particle burst effects
- **Tutorial overlay** — 2-page guide shown on first play, toggled with H key, persisted via localStorage
- **High score persistence** via localStorage
- **Total coin persistence** across sessions
- **Click-to-lane movement** — click a different lane to switch to it, click the current lane to jump
- **Touch controls** (left/right/center tap regions)
- **Menu bar**: Game (New F2, Pause Esc, High Scores, Exit) + Help (How to Play, Controls, About)
- **Dialog system** for high scores, controls, and about

## Controls

| Key | Action |
|-----|--------|
| Arrow Left / A | Switch lane left |
| Arrow Right / D | Switch lane right |
| Arrow Up / W / Space | Jump |
| Arrow Down / S | Slide |
| Escape | Pause / Resume |
| F2 | New Game |
| H | Toggle tutorial overlay |

Touch: Left third = lane left, Right third = lane right, Center = jump.

## Game Mechanics

- **Scoring**: 1 point per meter traveled + 10 per coin collected (doubled with multiplier)
- **Speed**: Starts at 8 m/s, increases by 0.08 m/s per second, caps at 24 m/s
- **Obstacles**: Spawn procedurally; at higher speeds, up to 2 lanes blocked simultaneously
- **Collision**: barrier-low can be jumped over, barrier-high can be slid under, full-block requires lane switch
- **Shield**: Absorbs one collision and breaks with particle effect

## SEO Keywords

endless runner, browser game, free online game, obstacle dodge, lane runner, auto runner, collect coins, power-ups, SynthelicZ, WebOS game, HTML5 game, canvas game, arcade runner, side-scrolling runner
