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

### Core Gameplay
- [x] As a player, I can click a large cookie with a spring squish animation to earn cookies so that I have an engaging primary interaction
- [x] As a player, I can purchase 14 building types (Cursor through Prism) that auto-generate cookies per second so that production grows passively
- [x] As a player, I can buy 55+ upgrades with click, building, and global multipliers so that I can boost production strategically
- [x] As a player, I can prestige to earn heavenly chips (+1% CPS each) so that restarting provides permanent bonuses
- [x] As a player, I can see building costs scale exponentially (baseCost x 1.15^owned) so that each purchase is a meaningful decision

### Visual Feedback
- [x] As a player, I can see particle burst effects on clicks and purchases so that actions feel impactful
- [x] As a player, I can see floating "+N" text on cookie clicks so that I know how much I earned
- [x] As a player, I can see milestone confetti celebrations at 1M, 1B, 1T, 1Qa, 1Qi, and 1Sx cookies so that big milestones are celebrated
- [x] As a player, I can see a smooth counter animation (lerp) for the cookie total so that numbers change fluidly
- [x] As a player, I can see a purchase glow effect on buildings so that buying feels satisfying

### Information and Tooltips
- [x] As a player, I can hover over buildings to see description, per-unit CPS, total CPS from type, CPS delta preview, and cost efficiency so that I can make informed purchases
- [x] As a player, I can hover over upgrades to see description, effect, CPS/click delta preview, and cost efficiency so that I understand upgrade value
- [x] As a player, I can hover over the cookie to see per-click value and total clicks so that I know my click stats
- [x] As a player, I can see tooltips offset from buttons so that they do not block the items I am interacting with

### Progression and Achievements
- [x] As a player, I can earn 60+ achievements across baking, clicking, building, CPS, prestige, and upgrade milestones so that I have many goals to pursue
- [x] As a player, I can see per-building CPS contribution inline on each building row so that I know which buildings are most productive
- [x] As a player, I can see per-click value displayed below CPS in the stats area so that I know my click power
- [x] As a player, I can see large numbers formatted with suffixes (K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc) so that big numbers are readable

### Persistence and Offline
- [x] As a player, I can have my game auto-saved every 30 seconds and on window blur so that I never lose progress
- [x] As a player, I can earn offline progress (capped at 8 hours, 50% efficiency) when returning to the game so that time away is not wasted
- [x] As a player, I can scroll through the buildings panel with mouse wheel so that all 14 buildings are accessible

### UI and Integration
- [x] As a player, I can access the game through the SZ Desktop OS with menu bar, dialogs, and window title integration so that it fits the desktop environment
- [x] As a player, I can start a new game with F2 or open the menu with Escape so that game management is accessible

### Planned Features
- [ ] As a player, I can hear sound effects for clicks, purchases, and achievements so that the game has audio feedback
- [ ] As a player, I can see a golden cookie that appears randomly for bonus cookies so that there are surprise events
- [ ] As a player, I can unlock seasonal content or special events so that the game has periodic variety
- [ ] As a player, I can see detailed statistics tracking (total clicks, time played, buildings bought) so that I can review my history
- [ ] As a player, I can export and import my save data so that I can back up my progress

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
