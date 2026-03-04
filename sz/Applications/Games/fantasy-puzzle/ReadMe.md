# Fantasy Puzzle

Elemental magic puzzle game for the SynthelicZ Desktop. Manipulate fire, water, earth, and air to solve 15+ enchanted puzzles and decipher ancient runes.

## User Stories

- **S-035**: As a player, I want to solve puzzles by manipulating elemental magic (fire/water/earth/air), navigate enchanted environments, and decipher ancient runes, so that I experience magical puzzle-solving.
- **S-036**: As a player, I want fantasy puzzles to have elemental particle effects (flames, water ripples, earth crumbles, wind gusts), rune glow, and solution cascade animations, so that puzzles feel magical.
- **S-000**: Cross-cutting visual polish (particles, glow, screen shake, floating text).

## Features

- **Four Elements**: Fire, Water, Earth, Air — each with unique puzzle interactions
- **Element Interactions**: Fire burns wood, Water fills channels, Earth creates barriers, Air pushes objects
- **15+ Puzzle Levels**: Progressively challenging with varied mechanics
- **Rune Discovery**: Hidden runes glow and reveal when activated by correct element
- **4-page tutorial overlay** — shown on first play, explains controls, elements, and strategy; toggled with H key
- **Valid move highlighting** — hovering over tiles shows which moves are legal with color-coded indicators
- **Objectives panel** — displays current level goals and progress
- **Level hints** — optional hint system reveals the next suggested move
- **Tile hover tooltips** — hover any tile to see its type and which element applies
- **Star Rating**: 1-3 stars per level based on move efficiency
- **Elemental Particles**: Flame bursts, water ripples, earth crumbles, wind gusts
- **Rune Glow Effects**: Discovered runes emit magical glow via shadowBlur
- **Solution Cascade**: Celebratory particle cascade when puzzle is solved
- **Level Selection**: Choose any unlocked level from the level map
- **Canvas maximize** — canvas fills the entire parent container on resize for full-window gameplay
- **In-game instructions** — contextual instructions displayed within the game canvas to guide new players
- **Persistence**: Progress and star ratings saved to localStorage

## Controls

| Input | Action |
|-------|--------|
| Click/Tap | Cast selected element on tile |
| 1 / Q | Select Fire |
| 2 / W | Select Water |
| 3 / E | Select Earth |
| 4 / R | Select Air |
| F2 | New game / Restart level |
| Escape | Pause / Resume |
| H | Toggle tutorial overlay |

## Game Mechanics

- **Fire**: Burns wood obstacles, revealing paths. Creates flame particles.
- **Water**: Fills channels and trenches, creating bridges. Water ripple particles follow flow.
- **Earth**: Creates wall barriers to block paths or redirect flow. Earth crumble particles.
- **Air**: Pushes movable objects in the cast direction. Wind gust particles trail.
- **Runes**: Hidden in levels, discovered by casting the correct element nearby. Glow when found.
- **Stars**: 3 stars = optimal moves, 2 stars = good, 1 star = completed.

## Architecture

- IIFE pattern with `window.SZ` namespace
- Canvas-based rendering at 700x500 with devicePixelRatio scaling
- Shared libraries: menu.js, dialog.js, game-effects.js (ParticleSystem, ScreenShake, FloatingText)
- OS integration: SetWindowText, RegisterWindowProc (WM_SIZE, WM_THEMECHANGED)
- localStorage persistence with `sz-fantasy-puzzle-` prefix

## SEO Keywords

fantasy puzzle, elemental magic game, puzzle game, browser game, web game, HTML5 game, canvas game, fire water earth air, rune puzzle, magic puzzle, SynthelicZ, WebOS game
