# Space Farming

Casual farm simulation on a space station for the SynthelicZ Desktop. Grow crops through growth stages, tend livestock, survive space weather events and wild animals, manage seasons and day/night cycles, upgrade your farm, build infrastructure, upgrade buildings for enhanced effects, and sell produce for credits.

## User Stories

### Farm Management
- [x] As a player, I can plant crops on an 8x6 grid of farmable tiles so that I have a clear planting area
- [x] As a player, I can grow 12 crop types (Space Wheat, Star Fruit, Nebula Berry, Lunar Lettuce, Cosmic Corn, Crystal Melon, Solar Tomato, Void Mushroom, Plasma Pepper, Astral Flower, Lunar Moss, Solar Vine) each with unique growth times and sell prices so that I have farming variety
- [x] As a player, I can watch crops advance through visual growth stages with sparkle particle effects so that growth progress is visible and satisfying
- [x] As a player, I can harvest mature crops with a particle burst effect so that collection feels rewarding
- [x] As a player, I can select crop types with number keys (1-7+) so that planting is quick
- [x] As a player, I can click and drag to select multiple tiles for batch planting or harvesting so that managing large farms is efficient
- [x] As a player, I can right-click drag to pan the map view so that I can navigate larger farms easily
- [x] As a player, I can place buildings on rock tiles so that rocky terrain is still useful (only water blocks building placement)
- [x] As a player, I can experience a 4-season cycle (Spring/Summer/Autumn/Winter) changing every 4 days with growth and harvest modifiers so that farming strategy varies over time (Spring: +10% growth, Summer: +25% growth, Autumn: +15% harvest/-10% growth, Winter: -40% growth/no weather events)
- [x] As a player, I can see a visual day/night cycle where some crops only grow during the day (Solar Vine) or only at night (Lunar Moss) so that crop timing adds depth
- [x] As a player, I can see an inventory panel showing storage usage and capacity (50 + Silo bonuses) so that I know when to sell produce before storage fills up (harvesting is blocked when full)

### Livestock
- [x] As a player, I can tend 4 livestock types (Space Cow, Star Hen, Nebula Goat, Crystal Chick) that produce resources periodically so that I have another income source
- [x] As a player, I can feed livestock and collect produce when a ready indicator appears so that animals require active management
- [x] As a player, I can purchase livestock from the shop so that I can expand my animal farm

### Buildings
- [x] As a player, I can place 11 building types on the farm grid so that I can enhance my farm's capabilities
- [x] As a player, I can build Sprinklers that boost adjacent crop growth by +20% so that nearby crops grow faster
- [x] As a player, I can build Harvesters that auto-harvest adjacent mature crops every 2 seconds (uses 1 energy per harvest) so that collection is automated
- [x] As a player, I can build Greenhouses that protect adjacent crops from weather damage so that I shield my investment
- [x] As a player, I can build Silos that increase sell price by 10% globally and expand storage capacity by +50 per Silo so that I earn more and store more
- [x] As a player, I can build Solar Panels that generate 2 credits per cycle (30 seconds) and increase max energy by 25 and energy regen by 0.5/sec so that I have passive income and power
- [x] As a player, I can build Wind Turbines that generate 5 credits per cycle, boost adjacent growth by +10%, and provide +15 max energy and +0.3/s energy regen so that I have income, growth, and electricity benefits
- [x] As a player, I can build Compost Bins that boost adjacent tile fertility by +25% so that nearby soil is more productive
- [x] As a player, I can build Scarecrows that protect a 3x3 area from wild animals so that my crops are safe from pests
- [x] As a player, I can build Fences that block animal movement on the tile so that I can wall off sections of my farm
- [x] As a player, I can build Auto-Planter L1 (200cr) that plants my selected crop on adjacent empty farmland every 15 seconds so that planting is automated
- [x] As a player, I can build Auto-Planter L2 (500cr) that automatically plants whichever crop has the highest current market price so that I maximize profits hands-free

### Building Upgrades
- [x] As a player, I can right-click a placed building to upgrade it (up to 5 times, from L1 to L6) at 50% of the original building cost per level so that I can improve existing infrastructure
- [x] As a player, I can see a level badge (L2, L3, etc.) on upgraded buildings so that I can visually identify their level
- [x] As a player, I can see upgrade cost and current level info in building tooltips so that I can plan upgrade investments
- [x] As a player, I can Shift+right-click to remove a building (instead of plain right-click, which now upgrades) so that removal is still possible
- [x] As a player, I can upgrade Sprinklers to increase range by +1 per level (max range 6) and growth bonus from +20% to +40% so that watering coverage expands
- [x] As a player, I can upgrade Harvesters to decrease harvest interval (2s to 0.5s) and increase range by +1 per level so that auto-harvesting becomes faster and wider
- [x] As a player, I can upgrade Greenhouses to increase protection radius by +1 per level and add a growth bonus (+5% per level) so that weather protection and growth scale up
- [x] As a player, I can upgrade Silos to increase storage capacity per silo (+50 to +175) and sell bonus from +10% to +20% so that storage and profit improve
- [x] As a player, I can upgrade Solar Panels to increase energy bonus (+25 to +75 max), energy regen (+0.5 to +1.5/s), and income (+2cr to +7cr per cycle) so that power generation scales
- [x] As a player, I can upgrade Wind Turbines to increase income (+5cr to +15cr per cycle), growth bonus (+10% to +35%), max energy (+15 to +90), and energy regen (+0.3 to +1.8/s) so that wind power scales with investment
- [x] As a player, I can upgrade Compost Bins to increase fertility bonus (+25% to +75%) and range by +1 per level so that soil improvement covers more area
- [x] As a player, I can upgrade Scarecrows to increase scare radius from 3x3 to 13x13 so that fewer scarecrows are needed for large farms
- [x] As a player, I can upgrade Fences so that L3+ slows animals and L5+ blocks AND damages animals so that fences become more powerful defenses
- [x] As a player, I can upgrade Auto-Planters to decrease plant interval (15s to 3s) and increase range by +1 per level so that automation becomes faster and wider
- [x] As a player, I can see upgraded buildings rendered with brighter borders, slightly larger icons, and a colored level badge in the top-right corner so that upgrade status is visually clear

### Wild Animals
- [x] As a player, I can encounter wild space mice that spawn periodically from the map edges so that there is a pest management challenge
- [x] As a player, I can watch space mice pathfind toward and eat my crops so that unprotected farms face real consequences
- [x] As a player, I can kill space mice by right-clicking on them to earn 10 credits with floating text and screen shake so that pest control is rewarding and visible
- [x] As a player, I can see animals blocked by Fences and scared away by Scarecrows so that buildings provide meaningful defense
- [x] As a player, I can see a pest control indicator (trap icon + reward amount) when hovering near wild animals so that the kill action is discoverable
- [x] As a player, I can see animals that are near crops highlighted with a red pulsing glow so that threatening pests are visually distinct

### Economy
- [x] As a player, I can sell all produce for credits so that I earn income from my farming
- [x] As a player, I can buy seeds and livestock from a shop system so that I can invest in my farm
- [x] As a player, I can see floating income text showing earnings and costs so that I get immediate financial feedback
- [x] As a player, I can experience dynamic price fluctuations over time so that selling strategy matters
- [x] As a player, I can start with 100 credits so that I have initial capital to begin farming
- [x] As a player, I can see the estimated total value of all stored produce in the inventory panel so that I know how much my stockpile is worth at current market prices

### Upgrades
- [x] As a player, I can purchase 8 upgrade types (Growth Boost, Yield Multiplier, Weather Shield, Auto-Harvester, Plot Expansion, Soil Quality, Market Access, Irrigation System) so that I can improve my farm's efficiency
- [x] As a player, I can expand my farm in rotating directions (South, West, East, North) through the Plot Expansion upgrade so that expansion is balanced in all directions
- [x] As a player, I can upgrade soil quality so that all tiles grow crops faster
- [x] As a player, I can purchase an auto-harvester that uses energy (1 per harvest, slower when energy is low) so that mature crops are collected automatically
- [x] As a player, I can upgrade market access so that sell prices increase

### Energy System
- [x] As a player, I can see an energy bar in the HUD showing current/max energy and regen rate so that I can track my farm's power supply
- [x] As a player, I can watch energy regenerate over time (1/sec base + solar panels + wind turbines) so that energy recovers passively
- [x] As a player, I can see Wind Turbines contribute to max energy (+15 per turbine per level) and energy regen (+0.3/s per turbine per level) so that wind power supplements solar panels
- [x] As a player, I can see auto-harvesters consume 1 energy per harvest action so that energy management adds strategic depth
- [x] As a player, I can see auto-harvest speed slow to 1/3 when energy drops below 20% so that energy scarcity has consequences

### Hoe Tool
- [x] As a player, I can select the Hoe tool from the toolbar or by pressing T so that I have access to soil management
- [x] As a player, I can left-click with the Hoe on farmland adjacent to water to boost fertility by +0.2 (capped at 1.5) so that I can improve soil near water sources
- [x] As a player, I can right-click with the Hoe on a tile with a crop to uproot it and receive 50% of the seed cost back so that I can recover partial investment from unwanted plants

### Silo Tooltip
- [x] As a player, I can see storage capacity details when hovering over a Silo building or the Silo button so that I understand the storage impact

### Directional Land Expansion
- [x] As a player, I can see land expand in alternating directions (South, West, East, North, then repeat) when purchasing Plot Expansion so that my farm grows in all directions
- [x] As a player, I can see new tiles generated with biome-aware terrain (WFC-inspired) that clusters water, rock, sand, and farmland naturally based on adjacent existing tiles so that expansion terrain feels organic

### Weather Events
- [x] As a player, I can experience solar flares that boost crop growth speed so that weather adds positive variety
- [x] As a player, I can experience meteor showers that damage or destroy crops so that I face farming hazards
- [x] As a player, I can see weather visual overlays with glow effects so that weather events are visually distinct
- [x] As a player, I can purchase weather resistance upgrades to reduce meteor damage so that I can protect my crops

### Visual Effects
- [x] As a player, I can see planting animations with scale bounce and sparkle burst so that planting feels satisfying
- [x] As a player, I can see crop growth sparkle effects at each stage change so that progress is celebrated
- [x] As a player, I can see harvest particle bursts when collecting mature crops so that harvesting feels rewarding
- [x] As a player, I can see per-tile drag selection highlights (green for plant, gold for harvest, red for no action) so that I know what will happen on each tile
- [x] As a player, I can see a day/night cycle with a day counter, season indicator, and darkened night overlay so that time passage and seasons are visually distinct

### Game Management
- [x] As a player, I can see a tutorial overlay on first play that explains farming mechanics so that I learn the game quickly
- [x] As a player, I can toggle the tutorial with H key so that I can review it anytime
- [x] As a player, I can have high scores tracking credits earned and days survived so that I can measure my performance
- [x] As a player, I can pause/resume with Escape so that I can take breaks
- [x] As a player, I can start a new game with F2 so that I can restart anytime
- [x] As a player, I can maximize the game window for a larger farm view with responsive canvas resizing so that I can see more detail

### Tooltips & UI
- [x] As a player, I can see tooltips when hovering over crops, livestock, shop items, and UI elements so that I understand costs, growth times, and statuses at a glance

### Integration
- [x] As a player, I can see a menu bar with Game and Help menus so that all actions are discoverable
- [x] As a player, I can use dialog windows for high scores, controls, and about info so that information is organized

### Planned Features
- [ ] As a player, I can hear ambient sound effects and music so that the farm atmosphere is more immersive
- [ ] As a player, I can unlock decorative items for my farm so that I can personalize its appearance
- [ ] As a player, I can trade with visiting space merchants at special prices so that the economy has more depth
- [ ] As a player, I can complete seasonal farming challenges for bonus rewards so that I have recurring objectives
- [ ] As a player, I can cross-breed crops to discover new varieties so that farming has an experimental element

## Controls

| Input | Action |
|-------|--------|
| Click/Tap tile | Plant selected crop / Harvest mature crop |
| Click + Drag | Drag selection to plant/harvest multiple tiles at once |
| Right-click + Drag | Pan the map view |
| Short Right-click on building | Upgrade building (costs 50% of base price) |
| Short Right-click on animal | Kill wild animal for 10 credits |
| Shift + Right-click on building | Remove building |
| Ctrl + Left-click Drag | Pan the map view (alternative) |
| Mouse Wheel | Zoom in/out (0.5x-2.0x) |
| Home | Reset zoom and pan |
| Click/Tap livestock | Feed and collect produce |
| 1-0+ | Select crop type (12 types) |
| B | Toggle building placement mode |
| T | Toggle Hoe tool |
| S | Sell all produce |
| U | Toggle upgrade shop |
| F2 | New game |
| Escape | Pause / Resume |
| H | Toggle tutorial overlay |

## Building Upgrade Reference

All buildings can be upgraded from L1 to L6 (5 upgrades). Each upgrade costs 50% of the original building cost.

| Building | L1 (Base) | L6 (Max) |
|----------|-----------|----------|
| Sprinkler | +20% growth, range 1 | +40% growth, range 6 |
| Harvester | 2.0s interval, range 1 | 0.5s interval, range 6 |
| Greenhouse | Protection range 1, +0% growth | Protection range 6, +25% growth |
| Silo | +50 storage, +10% sell | +175 storage, +20% sell |
| Solar Panel | +2cr/cycle, +25 energy, +0.5/s regen | +7cr/cycle, +75 energy, +1.5/s regen |
| Wind Turbine | +5cr/cycle, +10% growth, +15 energy, +0.3/s regen | +15cr/cycle, +35% growth, +90 energy, +1.8/s regen |
| Compost Bin | +25% fertility, range 1 | +75% fertility, range 6 |
| Scarecrow | 3x3 scare area | 13x13 scare area |
| Fence | Blocks animals | Blocks AND damages animals |
| Auto-Planter | 15s interval, range 1 | 3s interval, range 6 |

## SEO Keywords

space farming game, browser farming simulator, space station farm, crop growing game, livestock management, space weather farming, casual farming game, SynthelicZ desktop game, HTML5 farming game, idle farm game, building upgrades
