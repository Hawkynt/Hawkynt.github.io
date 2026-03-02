# Cookie Clicker

An idle/incremental game where you click a giant cookie to earn cookies, buy buildings for auto-generation, purchase upgrades for multipliers, and prestige for permanent bonuses.

## Features

- Large clickable cookie with spring squish animation
- 8 building types (Cursor, Grandma, Farm, Mine, Factory, Bank, Temple, Wizard Tower)
- 25 upgrades with click, building, and global multipliers
- Prestige system with heavenly chips (+1% CPS each)
- 32 achievements across baking, clicking, building, CPS, and prestige milestones
- Offline progress calculation (capped at 8 hours, 50% efficiency)
- Auto-save every 30 seconds and on blur
- Large number formatting (K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc)
- Particle burst effects on click and purchase
- Floating "+N" text on cookie clicks
- Milestone confetti celebrations (1M, 1B, 1T, 1Qa, 1Qi)
- Smooth counter animation (lerp)
- Purchase glow effect on buildings
- SZ Desktop OS integration (menu bar, dialogs, window title, theme)

## User Stories

### S-076: Core Incremental Gameplay
As a player, I want to click a cookie for points, purchase buildings that auto-generate cookies, buy upgrades that boost production, and prestige for permanent bonuses, so that I experience satisfying exponential growth and always have a meaningful next goal.

### S-077: Visual Feedback and Polish
As a player, I want satisfying visual feedback for clicks, purchases, and milestones, so that every action feels impactful and progression is visually celebrated.

## Controls

| Input | Action |
|-------|--------|
| Left-click on big cookie | Earn cookies equal to click value |
| Left-click on building | Purchase one unit (if affordable) |
| Left-click on upgrade | Purchase the upgrade (if affordable) |
| Escape | Open menu |
| F2 | New Game |

## Game Mechanics

### Cookie Production
Total CPS = sum of (buildingCount x baseCPS x buildingMultiplier) x globalMultiplier x (1 + heavenlyChips x 0.01) x achievementBonus.

### Building Cost Scaling
Each building costs: baseCost x 1.15^owned. Exponential scaling ensures buildings remain meaningful purchases.

### Prestige
Heavenly chips earned = floor(cbrt(lifetimeCookies / 1e12)) - previousChips. Each chip provides +1% CPS.

### Offline Production
On return: min(elapsedSeconds, 28800) x lastCPS x 0.5 cookies awarded at 50% efficiency.

## SEO Keywords

cookie clicker, idle game, incremental game, clicker game, browser idle game, cookie game, clicking game, prestige game, HTML5 clicker, casual idle game, building game, auto-generate cookies
