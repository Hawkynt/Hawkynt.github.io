# Dome Keeper

Hybrid mine-and-defend game for the SynthelicZ Desktop. Protect your dome from alien waves on the surface while mining resources underground to fund upgrades.

## User Stories

- **S-051**: As a player, I want to defend a dome from waves of enemies by mining resources underground and returning to fight on the surface, so that I experience Dome Keeper-style gameplay.
- **S-052**: As a player, I want Dome Keeper to have laser/bullet glow effects, mining debris particles, dome-hit screen shake, and smooth transition between surface and underground, so that defense feels intense.
- **S-000**: Cross-cutting visual polish (particles, glow, screen shake, floating text).

## Features

- **Split View**: Toggle between surface dome defense and underground mining
- **Dome Defense**: Auto-targeting laser weapon fires at approaching enemies
- **Enemy Waves**: Increasingly difficult waves of alien attackers on a timer
- **Mining System**: Dig through underground grid to collect iron, water, and cobalt
- **Resource Types**: Iron (common), Water (medium), Cobalt (rare) with different values
- **Upgrade Tree**: Weapon damage, fire rate, dome HP, drill speed, carry capacity
- **Mining Animations**: Pickaxe swing animation, rock crumble effects, dust cloud particles on block destruction
- **Enhanced Tile Rendering**: Textured rock, dirt, and ore tiles with gradient fills and detail overlays
- **Improved Dome Visuals**: Metallic dome with rivets, glow effect, and damage indicators
- **Enemy Visual Improvements**: Distinct alien sprite designs with animation frames
- **Combat Effects**: Laser glow trails, impact sparks, explosion particles, screen shake on hits
- **Surface Scene**: Parallax starfield, detailed ground, improved dome rendering
- **Underground Scene**: Cave ambiance, resource glow/sparkle effects, improved drill cursor
- **Player Character Sprite**: Animated miner with directional movement
- **HUD Polish**: Gradient health/resource bars, clean upgrade panel
- **Tutorial overlay** — 2-page guide shown on first play, toggled with H key, persisted via localStorage
- **Canvas maximize** — canvas fills the entire parent container on resize for full-window gameplay
- **Underground transition animation** — smooth animated slide when switching between surface and underground views
- **Minecraft-style ore textures** — ore tiles rendered with pixel-art patterns inspired by Minecraft block textures
- **Dome at ground level** — dome sits on the ground surface instead of floating above it
- **Enemy spawn restricted to sides and sky** — enemies spawn from left/right edges and above, never from the ground
- **Smooth Transitions**: Animated slide between surface and underground views
- **High Scores**: Persistent leaderboard tracking waves survived and score
- **SEO Optimized**: Full meta tags, Open Graph, JSON-LD structured data

## Controls

| Input | Action |
|-------|--------|
| Click/Tap | Fire weapon (surface) / Mine block (underground) |
| Arrow Keys / WASD | Move drill cursor underground |
| Space / Tab | Toggle surface / underground view |
| U | Open upgrade menu |
| F2 | New game |
| Escape | Pause / Resume |
| H | Toggle tutorial overlay |

## Game Mechanics

- **Surface Phase**: Dome auto-fires laser at nearest enemy. Enemies approach from edges and attack the dome on contact.
- **Underground Phase**: Navigate drill cursor through a grid. Mine blocks to reveal resources. Carry resources back to surface.
- **Upgrades**: Spend collected resources at the upgrade panel to improve stats.
- **Wave Progression**: Each wave spawns more and tougher enemies. Timer between waves gives mining time.

## Architecture

- IIFE pattern with `window.SZ` namespace
- Canvas-based rendering at 700x500 with devicePixelRatio scaling
- Shared libraries: menu.js, dialog.js, game-effects.js (ParticleSystem, ScreenShake, FloatingText)
- OS integration: SetWindowText, RegisterWindowProc (WM_SIZE, WM_THEMECHANGED)
- localStorage persistence with `sz-dome-keeper-` prefix

## SEO Keywords

dome keeper, tower defense, mining game, browser game, web game, HTML5 game, canvas game, space defense, resource mining, upgrade system, wave defense, SynthelicZ, WebOS game
