# Cooking Game

Restaurant time-management game where you cook dishes, serve customers under time pressure, earn tips, and upgrade your kitchen — running inside the SynthelicZ Desktop WebOS.

## User Stories

- **S-072**: As a player, I want to run a restaurant by taking orders, cooking dishes with timing-based mechanics, and serving customers before they lose patience, so that I experience cooking game pressure.
- **S-073**: As a player, I want cooking game to have sizzle/steam particle effects, perfect-cook glow, customer satisfaction floating text, and smooth order-serve animations, so that cooking feels lively.
- [x] As a player, I want a powerup system that grants temporary bonuses (speed boost, time freeze, auto-cook, double tips, extra patience) so that I have strategic tools to handle rush periods.
- **S-000**: As the platform, all games integrate with the SZ Desktop via shared bootstrap, menu, dialog, and visual-effects libraries.

## Features

- **5+ Recipes**: Burger, Pasta, Pizza, Salad, Sushi — each with 2-4 cooking steps
- **Timing-Based Cooking**: Hit the green zone for perfect cook, miss for burned dish
- **Customer System**: Customers arrive with orders and patience timers
- **Serving Mechanics**: Match cooked dish to the correct customer for tips
- **Day Progression**: Increasing customers and difficulty per day
- **Star Rating**: Earn 1-3 stars per day based on performance
- **Upgrade System**: Buy kitchen upgrades between days (faster cooking, more patience, better tips)
- **Weighted Recipe Selection**: Fair recipe distribution with streak prevention — avoids repeating the same recipe consecutively
- **Detailed Character Rendering**: Procedurally generated customer sprites with unique body, clothing, hair, and accessories
- **Enhanced Food Icons**: Distinct, recognizable food artwork for each recipe
- **Gradient-Based Graphics**: Rounded-rectangle UI elements with gradient fills and proper layering
- **Sizzle/Steam Effects**: Particle effects during cooking
- **Perfect-Cook Glow**: Golden glow on perfectly timed dishes
- **Screen Shake**: Impact feedback when a dish burns
- **Floating Text**: Customer satisfaction feedback and tip amounts
- **Powerup System**: Temporary bonuses (speed boost, time freeze, auto-cook, double tips, extra patience) spawn during gameplay for strategic advantage
- **High Scores**: Persistent best scores via localStorage

## Controls

| Input | Action |
|-------|--------|
| Mouse Click | Select station / serve customer |
| Space | Stop cooking timer (hit green zone) |
| 1-5 | Select recipe by number |
| F2 | New game / Restart |
| Escape | Pause / Resume |

## Recipes

### Burger (2 steps)
Grill patty → Assemble bun

### Pasta (3 steps)
Boil water → Cook pasta → Add sauce

### Pizza (3 steps)
Roll dough → Add toppings → Bake in oven

### Salad (2 steps)
Chop vegetables → Mix dressing

### Sushi (4 steps)
Prepare rice → Slice fish → Roll maki → Plate

## Architecture

- `index.html` — Entry point with SEO meta, menu bar, canvas, status bar, dialogs
- `controller.js` — IIFE game engine: customer spawner, recipe system, cooking minigame, serving, day progression, upgrades, effects
- `styles.css` — Layout and theming
- `icon.svg` — Desktop icon (pan + steam + star)

## SEO Keywords

cooking game, restaurant game, time management game, browser cooking game, cooking simulator, recipe game, kitchen game, serve customers, SynthelicZ, WebOS game, cooking minigame, sizzle effects, perfect cook
