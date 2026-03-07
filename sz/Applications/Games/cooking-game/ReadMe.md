# Cooking Game

Restaurant time-management game where you cook dishes, serve customers under time pressure, earn tips, and upgrade your kitchen -- running inside the SynthelicZ Desktop WebOS.

## User Stories

### Core Gameplay
- [x] As a player, I can select from 6 recipes (Burger, Pasta, Pizza, Salad, Sushi, Steak) each with 2-4 cooking steps so that I have varied dishes to prepare
- [x] As a player, I can cook dishes using timing-based mechanics where I hit the green zone for a perfect cook so that skill determines quality
- [x] As a player, I can see a cooking timer bar with a green zone and must press Space to stop at the right moment so that each step is a mini-challenge
- [x] As a player, I can burn a dish if I miss the green zone so that poor timing has consequences
- [x] As a player, I can see customers arrive with specific orders and patience timers so that I feel time pressure
- [x] As a player, I can serve completed dishes to matching customers for tips so that I earn money for upgrades
- [x] As a player, I can see customer satisfaction feedback via floating text so that I know how well I performed

### Recipes
- [x] As a player, I can cook a Burger (2 steps: grill patty, assemble bun) as an easy dish so that beginners can succeed
- [x] As a player, I can cook Pasta (3 steps: boil water, cook pasta, add sauce) as a medium dish so that I face moderate timing challenges
- [x] As a player, I can cook Pizza (3 steps: roll dough, add toppings, bake in oven) as a medium dish so that I have recipe variety
- [x] As a player, I can cook a Salad (2 steps: chop vegetables, mix dressing) as an easy dish so that quick orders are available
- [x] As a player, I can cook Sushi (4 steps: prepare rice, slice fish, roll maki, plate) as a hard dish so that expert players are challenged
- [x] As a player, I can cook Steak (3 steps: season meat, grill steak, plate and garnish) as a hard dish so that there is top-tier difficulty

### Day Progression
- [x] As a player, I can advance through days with increasing customer count and difficulty so that the game gets progressively harder
- [x] As a player, I can earn a star rating (1-3 stars) per day based on performance so that I have a quality benchmark
- [x] As a player, I can see a day-over summary showing my earnings and rating so that I can review my performance

### Upgrade System
- [x] As a player, I can buy Faster Cooking upgrade to cook 20% faster so that I can handle more orders
- [x] As a player, I can buy Comfy Seats upgrade to make customers wait longer so that I have more time per order
- [x] As a player, I can buy Charm School upgrade for +25% tip bonus so that I earn more per dish
- [x] As a player, I can buy Extra Station upgrade to cook two dishes at once so that I can multitask
- [x] As a player, I can buy Neon Sign upgrade to attract more customers so that I get more opportunities for tips

### Power-Up System
- [x] As a player, I can collect temporary power-ups that spawn during gameplay (speed boost, time freeze, auto-cook, double tips, extra patience) so that I have strategic tools for rush periods
- [x] As a player, I can see active power-up badges displayed in the top-right corner so that I know which bonuses are active

### Visual Effects
- [x] As a player, I can see sizzle and steam particle effects during cooking so that the kitchen feels lively
- [x] As a player, I can see a golden glow on perfectly timed dishes so that perfect cooks are celebrated
- [x] As a player, I can see screen shake when a dish burns so that failures feel impactful
- [x] As a player, I can see floating text for tip amounts and customer satisfaction so that feedback is immediate
- [x] As a player, I can see detailed procedurally generated customer sprites with unique body, clothing, hair, and accessories so that each customer looks distinct
- [x] As a player, I can see gradient-based rounded-rectangle UI elements so that the game looks polished

### Recipe Fairness
- [x] As a player, I can experience weighted recipe selection with streak prevention so that the same recipe does not repeat excessively

### Persistence
- [x] As a player, I can have my high scores persisted via localStorage so that my best runs are tracked

### UI and Integration
- [x] As a player, I can access Game menu (New Game F2, Pause Esc, High Scores, Exit) and Help menu so that standard game management is accessible
- [x] As a player, I can select recipes by clicking or pressing 1-5 so that dish selection is quick
- [x] As a player, I can pause and resume with Escape and restart with F2 so that game flow is controllable

### Planned Features
- [ ] As a player, I can hear sizzle and chopping sound effects while cooking so that the kitchen has audio ambiance
- [ ] As a player, I can unlock new recipes by reaching higher days so that progression reveals new content
- [ ] As a player, I can see customer types with different patience levels and tip amounts so that serving has more strategy
- [ ] As a player, I can decorate my restaurant with earned currency so that I can personalize my environment
- [ ] As a player, I can face special rush-hour events with bonus rewards so that certain days have unique challenges

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
Grill patty -> Assemble bun

### Pasta (3 steps)
Boil water -> Cook pasta -> Add sauce

### Pizza (3 steps)
Roll dough -> Add toppings -> Bake in oven

### Salad (2 steps)
Chop vegetables -> Mix dressing

### Sushi (4 steps)
Prepare rice -> Slice fish -> Roll maki -> Plate

### Steak (3 steps)
Season meat -> Grill steak -> Plate & Garnish

## Architecture

- `index.html` -- Entry point with SEO meta, menu bar, canvas, status bar, dialogs
- `controller.js` -- IIFE game engine: customer spawner, recipe system, cooking minigame, serving, day progression, upgrades, effects
- `styles.css` -- Layout and theming
- `icon.svg` -- Desktop icon (pan + steam + star)

## SEO Keywords

cooking game, restaurant game, time management game, browser cooking game, cooking simulator, recipe game, kitchen game, serve customers, SynthelicZ, WebOS game, cooking minigame, sizzle effects, perfect cook
