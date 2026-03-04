# Tower Defense

Path-based tower defense game for the SynthelicZ Desktop. Place towers along enemy paths, upgrade them through 3 tiers, and defend your base against escalating waves of enemies across 12 unique maps.

## User Stories

- **S-090**: As a player, I want to place defensive towers along paths to stop waves of enemies from reaching a goal, with different tower types, upgrades, and enemy varieties, so that I experience tower defense strategy.
- **S-091**: As a player, I want tower defense to have projectile glow trails, enemy-death burst particles, tower-upgrade sparkle effects, and smooth enemy path-following animations, so that defense feels strategic and exciting.
- **S-000**: Shared visual effects (ParticleSystem, ScreenShake, FloatingText).

## Features

- **9 Tower Types**: Arrow, Cannon (splash damage), Frost (slowing), Lightning (chain), Laser (high damage), Poison (damage-over-time), Tesla (area chain lightning), Mortar (long-range splash), Flame (short-range continuous)
- **3-Tier Upgrade System**: Each tower upgrades through 3 tiers with increasing damage, range, and fire rate
- **8 Enemy Types**: Normal, Fast, Armored, Flying, Boss, Healer (regenerates nearby enemies), Swarm (spawns in groups), Shield (absorbs damage for nearby enemies)
- **Auto-wave mode** — toggle automatic wave sending without clicking to start each wave
- **Mouse-only controls** — all actions available via mouse clicks, no keyboard required
- **Pre-wave warnings** — animated countdown and path visualization before each wave starts
- **Path visualization** — highlighted enemy path showing where enemies will walk
- **Wave Spawner**: Escalating waves with increasing enemy count and scaling HP
- **Economy**: Gold from kills, interest bonus between waves, tower selling for partial refund
- **12 Maps**: Serpentine, Crossroads, Spiral, Zigzag, Diamond, Fortress, Canyon, Labyrinth, Twin Paths, Gauntlet, Wasteland, Final Stand
- **Fast-Forward**: Toggle 1x/2x/3x game speed with Space
- **Fixed first-click crash** — resolved a bug where clicking the canvas before the first wave caused a runtime error
- **Visual Effects**: Projectile glow trails, enemy-death burst particles, tower-placement construction sparkle, upgrade sparkle, boss-kill screen shake, floating gold text, improved tower/enemy rendering
- **Persistence**: High scores saved to localStorage

## Controls

| Input | Action |
|-------|--------|
| Mouse Click | Place tower / Select tower |
| 1-9 | Select tower type (Arrow, Cannon, Frost, Lightning, Laser, Poison, Tesla, Mortar, Flame) |
| U | Upgrade selected tower |
| S | Sell selected tower |
| Space | Start wave / Fast-forward |
| F2 | New game / Restart |
| Escape | Pause / Resume |

## Game Mechanics

### Tower Properties

| Tower | Cost | Damage | Range | Fire Rate | Special |
|-------|------|--------|-------|-----------|---------|
| Arrow | 50g | 10 | 120 | 0.8s | — |
| Cannon | 80g | 35 | 90 | 1.5s | Splash 30px |
| Frost | 70g | 8 | 100 | 1.0s | Slow 50% |
| Lightning | 120g | 25 | 140 | 1.2s | Chain 2 |
| Laser | 150g | 50 | 160 | 2.0s | — |
| Poison | 90g | 5 | 110 | 1.0s | DoT 3s |
| Tesla | 200g | 30 | 130 | 1.5s | Chain 3, AoE |
| Mortar | 160g | 45 | 200 | 2.5s | Splash 50px |
| Flame | 100g | 15 | 60 | 0.3s | Continuous |

### Upgrades

- **Tier 2**: 60% base cost, 1.4x damage, 1.1x range
- **Tier 3**: 100% base cost, 1.8x damage, 1.2x range

### Enemies

- **Normal**: Balanced HP and speed
- **Fast**: Low HP, high speed
- **Armored**: High HP, slow speed
- **Flying**: Low HP, medium speed
- **Boss**: Very high HP, slow, appears every 5 waves
- **Healer**: Regenerates HP of nearby enemies
- **Swarm**: Low HP, spawns in groups of 3-5
- **Shield**: Projects a damage-absorbing shield for nearby enemies

## Architecture

- IIFE pattern with `window.SZ` global namespace
- Canvas-based rendering at 800×560
- 25×17 grid, 32px cells
- Path-following with linear interpolation between waypoints
- OS integration via SZ.Dlls.User32 (SetWindowText, RegisterWindowProc)
- Shared effects: ParticleSystem, ScreenShake, FloatingText

## SEO Keywords

tower defense, strategy game, browser game, path defense, tower upgrade, enemy waves, boss battles, projectile glow, splash damage, frost tower, lightning tower, laser tower, canvas game, SynthelicZ Desktop, web application game
