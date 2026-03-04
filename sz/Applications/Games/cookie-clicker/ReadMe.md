# Cookie Clicker

An idle/incremental game where you click a giant cookie to earn cookies, buy buildings for auto-generation, purchase upgrades for multipliers, and prestige for permanent bonuses.

## Features

- Large clickable cookie with spring squish animation
- 14 building types (Cursor, Grandma, Farm, Mine, Factory, Bank, Temple, Wizard Tower, Shipment, Alchemy Lab, Portal, Time Machine, Antimatter Condenser, Prism)
- 55+ upgrades with click, building, and global multipliers
- Prestige system with heavenly chips (+1% CPS each)
- 60+ achievements across baking, clicking, building, CPS, prestige, and upgrade milestones
- Hover tooltips showing detailed info before purchase:
  - Building tooltips: description, per-unit CPS, total CPS from type, CPS delta preview, cost efficiency (cost per CPS)
  - Upgrade tooltips: description, effect, CPS/click delta preview, cost efficiency
  - Cookie tooltip: per-click value, total clicks
- Scrollable buildings panel with mouse wheel support
- Per-building CPS contribution shown inline on each building row
- Per-click value displayed below CPS in the stats area
- Offline progress calculation (capped at 8 hours, 50% efficiency)
- Auto-save every 30 seconds and on blur
- Large number formatting (K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc)
- Particle burst effects on click and purchase
- Floating "+N" text on cookie clicks
- Milestone confetti celebrations (1M, 1B, 1T, 1Qa, 1Qi, 1Sx)
- Smooth counter animation (lerp)
- Purchase glow effect on buildings
- SZ Desktop OS integration (menu bar, dialogs, window title, theme)

## User Stories

### S-076: Core Incremental Gameplay
As a player, I want to click a cookie for points, purchase buildings that auto-generate cookies, buy upgrades that boost production, and prestige for permanent bonuses, so that I experience satisfying exponential growth and always have a meaningful next goal.

### S-077: Visual Feedback and Polish
As a player, I want satisfying visual feedback for clicks, purchases, and milestones, so that every action feels impactful and progression is visually celebrated.

### S-078: Pre-Purchase Information
As a player, I want to see what each building and upgrade will do before I buy it, including CPS increase, cost efficiency, and effect description, so that I can make informed spending decisions.

### S-079: Tooltip Usability
As a player, I want tooltips to render correctly without visual glitches and to be offset so they do not block the upgrade or building buttons I am trying to interact with, so that I can read tooltip information without interference.

## Controls

| Input | Action |
|-------|--------|
| Left-click on big cookie | Earn cookies equal to click value |
| Left-click on building | Purchase one unit (if affordable) |
| Left-click on upgrade | Purchase the upgrade (if affordable) |
| Hover over building/upgrade | Show detailed tooltip with effects |
| Mouse wheel on buildings panel | Scroll through building list |
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

### Tooltip System
Hovering over any building or upgrade shows a detailed tooltip with:
- Item name and description
- Current stats (owned count, per-unit CPS)
- Projected stats after purchase (new CPS, CPS delta)
- Cost efficiency (cost per CPS gained)

## Buildings

| Building | Base Cost | Base CPS | Description |
|----------|-----------|----------|-------------|
| Cursor | 15 | 0.1 | Autoclicks once every 10 seconds |
| Grandma | 100 | 1 | A nice grandma to bake cookies |
| Farm | 1,100 | 8 | Grows cookie plants |
| Mine | 12,000 | 47 | Mines out cookie dough |
| Factory | 130,000 | 260 | Produces large quantities of cookies |
| Bank | 1,400,000 | 1,400 | Generates cookies from interest |
| Temple | 20,000,000 | 7,800 | Converts prayer into cookies |
| Wizard Tower | 330,000,000 | 44,000 | Conjures cookies with magic |
| Shipment | 5,100,000,000 | 260,000 | Imports cookies from the cookie planet |
| Alchemy Lab | 75,000,000,000 | 1,600,000 | Turns gold into cookies |
| Portal | 1,000,000,000,000 | 10,000,000 | Opens a door to the cookieverse |
| Time Machine | 14,000,000,000,000 | 65,000,000 | Brings cookies from the past |
| Antimatter Condenser | 170,000,000,000,000 | 430,000,000 | Condenses antimatter into cookies |
| Prism | 2,100,000,000,000,000 | 2,900,000,000 | Converts light into cookies |

## SEO Keywords

cookie clicker, idle game, incremental game, clicker game, browser idle game, cookie game, clicking game, prestige game, HTML5 clicker, casual idle game, building game, auto-generate cookies
