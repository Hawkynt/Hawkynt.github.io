# Space Farming

Casual pixel-art farm simulation on an alien planet for the SynthelicZ Desktop. Grow crops through their growth stages and favourite seasons, raise space critters, research a five-branch tech tree, fill trader orders, keep pests and storms away, and turn produce into credits.

## Architecture

Plain browser scripts without a build step. Every file is an IIFE that adds its functions and constants to `SZ.SpaceFarming`; `index.html` loads them in dependency order, and a file takes what it needs from earlier files at load time (`const { ... } = NS`) while the few calls into later files go through `NS.name(...)`. Everything more than one file reads or writes lives in one long-lived state object, `SZ.SpaceFarming.state` (`G` in every file), grouped by the file that owns it; state only one file uses stays private in that file. Each file starts with a comment naming what it does, the state it owns and the shared state it reads.

**Core**
- `js/core/constants.js` — grid, tile, state and storage constants; crop, livestock and building definitions; weather kinds, tools, seasons and timings.
- `js/core/state.js` — the shared game state object.
- `js/core/dom.js` — canvas, context and status bar handles, canvas sizing for the window and pixel ratio, the window title.
- `js/core/tech.js` — the tech tree: five branches of nodes and chains, levels, prerequisites, costs, unlocks and buying.
- `js/core/rules.js` — values derived from upgrades and buildings: prices, growth and yield multipliers, storage, energy, building levels, ranges and bonuses, and the per-tile cache of building effects.
- `js/core/save.js` — high scores, autosave, save validation, restore and migration of old saves, continue, new game, resetting a fresh farm and ending a farm that can no longer earn anything.

**World and systems**
- `js/world/farm.js` — actions on a tile: plant, harvest, clear rocks, the hoe.
- `js/world/expansion.js` — new land: tile generation for a new strip, adding it on the next side, buying it from the field or the tree.
- `js/systems/crops.js` — crop growth and automatic harvesting by drones and harvesters.
- `js/systems/livestock.js` — pen production, collecting produce, buying animals, pen placement on the field perimeter.
- `js/systems/economy.js` — selling, seeds, placing and removing buildings, price drift, solar and wind income.
- `js/systems/weather.js` — seasonal weather events, forecast and rain maker, meteors and lightning, the eased visual weather state.
- `js/systems/automation.js` — auto-collectors, auto-planters, their shuffled work orders, energy regeneration.
- `js/systems/mice.js` — wild space mice, scarecrows, fences and pest zappers.
- `js/systems/goals.js` — goals, statistics and trader orders.
- `js/systems/simulation.js` — the day cycle and the per-frame simulation step that runs every system.

**Rendering**
- `js/render/particles.js` — pooled particles and the screen shake.
- `js/render/pixel-art.js` — the 16x16 pixel painter, palette and sprite baker.
- `js/render/sprite-painters.js` — the painters of every sprite.
- `js/render/sprites.js` — the sprite cache and sprite drawing.
- `js/render/text.js` — fonts, icon text and cached text layouts that fit their boxes.
- `js/render/world-common.js` — hashes, easing, colour mixing, light by time of day, tile textures, meadow decorations, glow sprites.
- `js/render/lighting.js` — the night light mask and the seasonal ambience particles.
- `js/render/sky.js` — sky gradient, stars, planets, sun, moon and mountains.
- `js/render/ground.js` — the cached meadow, its decorations and the field fence.
- `js/render/field.js` — tiles, soil nutrients, crops, rocks and the expansion strip.
- `js/render/buildings.js` — animated buildings and joined fences.
- `js/render/pens.js` — pens with wandering animals, zapper arcs and mice.
- `js/render/weather-fx.js` — craters, scorch marks, meteors, aurora, dust and the screen-space weather.
- `js/render/scene.js` — the world pass and the drag selection.
- `js/render/juice.js` — produce and coins flying to their counters, building drop-in, confetti, animal voices, chimes.
- `js/render/frame.js` — composes a frame (world, HUD, dialogs, screens, tooltip, cursor preview) and updates the status bar.

**Interface**
- `js/ui/widgets.js` — panels, meters, chips, key hints, headlines and the scrim.
- `js/ui/regions.js` — clickable regions registered while drawing, buttons and the tooltip state.
- `js/ui/dialog-state.js` — the open dialog and pausing.
- `js/ui/view.js` — camera and pointer: world and screen conversion, zoom, pan, fitting the farm, the keyboard cursor.
- `js/ui/hud-layout.js` — HUD panel layout for every width, the farm area between the panels, panel fading, banners, storage and weather info.
- `js/ui/feedback.js` — banner, pop texts and toasts.
- `js/ui/tooltip.js` — hover tracking, tooltip drawing and all tooltip texts.
- `js/ui/tech-tree.js` — tech tree layout, camera, tabs, focus, buying and keyboard control.
- `js/ui/tree-draw.js` — tech tree drawing.
- `js/ui/quick-panel.js` — the Next upgrades panel.
- `js/ui/hud-panels.js` — farm, storage and clock panels.
- `js/ui/dock.js` — the tool dock, selection, action hint, soil legend and zoom chip.
- `js/ui/dialogs.js` — the dialog frame and the livestock dialog.
- `js/ui/goal-market.js` — the goals and orders panel and the market dialog.
- `js/ui/help.js` — the How to play pages.
- `js/ui/screens.js` — building inspector, pause, Season Over and title screens.
- `js/ui/input.js` — keyboard, pointer, touch and wheel input.
- `js/app.js` — the game loop with the frame-time monitor, menu actions, window messages and start-up.

The page also uses the shared desktop libraries `../../shared/menu.js`, `dialog.js`, `game-effects.js`, `game-autopause.js` and `game-audio.js`.

## User Stories

### Farm Management
- [x] As a player, I can plant crops on an 8x6 field of farmable tiles so that I have a clear planting area
- [x] As a player, I can grow 14 crop types (Space Wheat, Star Fruit, Nebula Berry, Lunar Lettuce, Cosmic Corn, Crystal Melon, Solar Tomato, Void Mushroom, Plasma Pepper, Astral Flower, Lunar Moss, Solar Vine, Comet Pumpkin, Frost Kale) each with unique growth times and sell prices so that I have farming variety
- [x] As a player, I start with four crops and unlock the others in the tech tree so that new crops feel earned
- [x] As a player, I can watch crops sway in the wind and visibly grow from sprout to ripe plant so that growth progress is clear
- [x] As a player, I can see ripe crops glow and sparkle so that I know what is ready to harvest
- [x] As a player, I can select crop types with number keys so that planting is quick
- [x] As a player, I can click and drag to plant or harvest a whole area at once so that managing large farms is efficient
- [x] As a player, I can pan the view with right-drag or Ctrl+drag and zoom with the wheel so that I can navigate larger farms
- [x] As a player, I can place buildings on rock tiles so that rocky terrain is still useful (only water blocks building placement)
- [x] As a player, I can experience a 4-season cycle (Spring/Summer/Autumn/Winter) changing every 4 days with growth and harvest modifiers so that farming strategy varies over time (Spring: +10% growth, Summer: +25% growth, Autumn: +15% harvest/-10% growth, Winter: -40% growth)
- [x] As a player, I can grow each crop in its favourite season for +30% growth so that the seasons shape what I plant
- [x] As a player, I can see a day/night cycle where some crops only grow during the day (Solar Vine) or only at night (Lunar Moss) so that crop timing adds depth
- [x] As a player, I can see watered soil darken next to water, sprinklers and in the rain so that I can read the field at a glance
- [x] As a player, I can read every plot's nutrients at a glance (pale poor soil, dark rich soil, nutrient pips under empty plots) and press N for a colour overlay with a legend so that I know where crops grow best
- [x] As a player, I can see rocks as boulders that block crops, with a red cross and a hint when I try to plant on them, so that obstacles are obvious
- [x] As a player, I can see storage usage and capacity (50 + Silos + Warehousing) so that I know when to sell produce before storage fills up (harvesting stops when full)

### Livestock
- [x] As a player, I can raise 6 livestock types (Star Hen, Crystal Chick, Nebula Goat, Space Cow, Moon Rabbit, Star Bees) that produce resources periodically so that I have another income source
- [x] As a player, I can watch my animals wander, graze and hop around their pens so that the farm feels alive
- [x] As a player, I can collect produce when a bubble pops up over a pen so that animals require active management
- [x] As a player, I can keep Star Bees whose hives make crops within two tiles grow 15% faster so that animals and crops work together

### Buildings
- [x] As a player, I can place 14 building types on the farm grid so that I can enhance my farm's capabilities
- [x] As a player, I can build Sprinklers that water and speed up nearby crops by +20%
- [x] As a player, I can build Harvesters that auto-harvest nearby mature crops (1 energy per harvest)
- [x] As a player, I can build Greenhouses that protect nearby crops from meteors and lightning
- [x] As a player, I can build Silos that raise crop prices by 10% and storage by +50
- [x] As a player, I can build Solar Panels that earn credits and charge energy by day
- [x] As a player, I can build Wind Turbines that earn credits, speed up nearby crops and charge energy, fastest at night and in storms
- [x] As a player, I can build Compost Bins that boost nearby fertility by +25%
- [x] As a player, I can build Scarecrows that keep space mice out of the area around them
- [x] As a player, I can build Fences that join up with their neighbours and block mice
- [x] As a player, I can build Auto-Planters (L1 plants my selected crop, L2 the best-paying crop) so that planting is automated
- [x] As a player, I can build Auto-Collectors next to the pens so that produce is collected automatically
- [x] As a player, I can build Grow Lamps that light crops at night (+15% growth, day crops keep growing)
- [x] As a player, I can build Pest Zappers that zap mice coming into range for a small bounty
- [x] As a player, I can watch buildings drop into place and animate (turbine blades, sprinkler spray, glinting panels, compost steam, conveyor belts, lamps and sparks)

### Building Upgrades
- [x] As a player, I can click a building to open an inspector with its stats, an Upgrade button and a Remove button
- [x] As a player, I can right-click a building to upgrade it directly (up to level 6) and Shift+right-click to remove it
- [x] As a player, I can see gold pips under upgraded buildings so that their level is visible on the field
- [x] As a player, upgrades raise range, speed and bonuses as listed in the reference below

### Tech Tree
- [x] As a player, I can open a tech tree (U) with Agriculture, Husbandry, Engineering, Science and Commerce branches so that progress has direction
- [x] As a player, I pay for upgrades with credits and produce so that harvests matter beyond selling
- [x] As a player, I can unlock crops, animals and buildings in the tree so that new content arrives over time
- [x] As a player, I can buy stat upgrades such as Growth Boost, Rich Soil, Bountiful Harvest, Animal Care, Premium Produce, Power Grid, Irrigation, Weather Shield, Market Access and Warehousing
- [x] As a player, I can buy automation and utility upgrades such as Harvest Drones, Seed Bank, Efficient Construction, Weather Forecast, Rain Maker, Pest Repellent, Frost Hardiness, Meteor Harvesting, Market Insight, Price Floor, Bulk Broker and Trade Network
- [x] As a player, I can expand my field by clicking the glowing + strip beside it (or pressing E), which shows where the new plots go and what they cost; the same repeatable Expand Field upgrade sits in the Engineering branch and shows up in Next upgrades whenever it is affordable
- [x] As a player, I can zoom, pan and switch branches in the tree and buy with mouse or keyboard
- [x] As a player, I can see every card as owned, buyable, short of resources or locked, with tiers, pips and costs
- [x] As a player, I can use the Next upgrades panel to buy the best next upgrade of every branch with one click
- [x] As a player, my farm from before the tech tree keeps its upgrades and unlocks when I continue it

### Goals, Orders & Market
- [x] As a player, I can follow a chain of goals with credit rewards so that I always know what to aim for
- [x] As a player, I can fill trader orders for batches of produce that pay well above market prices before they expire
- [x] As a player, I can open the market (M) to sell single crops, compare prices and deliver orders

### Wild Animals
- [x] As a player, I can encounter wild space mice that sneak in from the edges and eat crops (they only come while crops stand on the field)
- [x] As a player, I can click a mouse to chase it off for 10 credits
- [x] As a player, I can see a red "!" over mice that are about to eat a crop

### Economy
- [x] As a player, I can sell all produce for credits and watch the coins fly into my counter
- [x] As a player, I can see market prices drift every minute, with ▲/▼ markers in the dock
- [x] As a player, I can start with 100 credits so that I have initial capital to begin farming

### Energy System
- [x] As a player, I can see energy and its charge rate in the farm panel
- [x] As a player, I can charge energy with solar panels (by day), wind turbines (more at night and in storms) and the Power Grid upgrades
- [x] As a player, I can see harvesters and drones slow down below 20% energy

### Hoe Tool
- [x] As a player, I can enrich soil beside water (+20% fertility) and turn sand into farmland with the hoe
- [x] As a player, I can right-click a crop with the hoe to uproot it for half its seed cost
- [x] As a player, I can break up a rock with the hoe for 25 credits so that rocky plots can be farmed

### Weather
- [x] As a player, I can experience weather that follows the seasons: rain, solar flares, thunderstorms, dust storms, snowfall and meteor showers
- [x] As a player, I can watch meteors and lightning strike real spots on the farm, leaving glowing craters and scorch marks
- [x] As a player, I can see rain splash on the field, snow drift down, dust sweep across and auroras dance during solar flares

### Visual Effects
- [x] As a player, I can see the farm on a meadow under a parallax sky with planets, mountains, sun, moon and stars
- [x] As a player, I can see seasonal ground and trees: spring blossoms, summer haze and fireflies, autumn leaves, winter snow and ice
- [x] As a player, I can see night fall with lamps, greenhouses and glowing crops lighting up the dark
- [x] As a player, I can see harvested produce fly into storage, coins fly into the credit counter and confetti for upgrades and goals
- [x] As a player, I can see a ghost of the selected crop or building and the building's range under the cursor

### Game Management
- [x] As a player, I can read an illustrated How to play guide (H) on first launch and anytime
- [x] As a player, I can continue my autosaved farm from the title screen, with a confirmation before a new farm replaces it
- [x] As a player, I can pause with Escape and the game pauses itself when its window is hidden
- [x] As a player, I get a warning when my credits no longer buy the cheapest seed and nothing is left to sell
- [x] As a player, my farm ends with a Season Over screen once it can never earn again (no credits for the cheapest seed, nothing in storage, no crop on the field, and no animals, solar or wind income, stardust, mouse to chase or goal that pays by itself); it shows my days, season, earnings, harvests, orders, goals and upgrades, records the farm in the high scores, and offers New farm and High scores
- [x] As a player, a finished farm is not offered to continue after a reload
- [x] As a player, I can maximize or resize the window and every panel and label still fits

### Tooltips & UI
- [x] As a player, I can see tooltips on crops, buildings, pens, mice, tree cards and every button
- [x] As a player, I can see the HUD panels fade when pests or ready animals are behind them

### Sound
- [x] As a player, I can hear planting, harvesting, selling, building, upgrades, animals, weather, goals and soft dawn and dusk chimes

### Planned Features
- [ ] As a player, I can unlock decorative items for my farm so that I can personalize its appearance
- [ ] As a player, I can cross-breed crops to discover new varieties so that farming has an experimental element

## Controls

| Input | Action |
|-------|--------|
| Click / Tap | Plant, harvest, collect produce, chase off mice, inspect a building |
| Drag | Plant or harvest an area |
| Right-drag / Ctrl+drag / two fingers | Pan the view |
| Mouse wheel / + - / pinch | Zoom |
| Home | Fit the whole farm |
| Right-click building | Upgrade building |
| Shift + Right-click building | Remove building |
| Arrow keys, Space / Enter | Move the tile cursor and act on the tile |
| 1-9, 0 | Pick a crop (or a building in build mode) |
| P / B / T | Seeds / Build / Hoe |
| N | Nutrient overlay |
| E | Expand the field |
| S | Sell all produce |
| M | Market and orders |
| L | Livestock |
| U | Tech tree (arrows, Enter, Tab and wheel inside) |
| H | How to play |
| Escape | Pause / resume / close a panel |
| F2 | New game |

## Building Upgrade Reference

All buildings can be upgraded from L1 to L6 (5 upgrades). Each upgrade costs 50% of the original building cost.

| Building | L1 (Base) | L6 (Max) |
|----------|-----------|----------|
| Sprinkler | +20% growth, range 1 | +40% growth, range 6 |
| Harvester | 2.0s interval, range 1 | 0.5s interval, range 6 |
| Greenhouse | Protection range 1, +0% growth | Protection range 6, +25% growth |
| Silo | +50 storage, +10% sell | +175 storage, +20% sell |
| Solar Panel | +2cr/cycle, +30 energy, +1.0/s regen | +7cr/cycle, +105 energy, +3.0/s regen |
| Wind Turbine | +5cr/cycle, +10% growth, +20 energy, +0.5/s regen | +15cr/cycle, +35% growth, +120 energy, +3.0/s regen |
| Compost Bin | +25% fertility, range 1 | +75% fertility, range 6 |
| Scarecrow | 3x3 scare area | 13x13 scare area |
| Fence | Blocks animals | Blocks AND zaps animals |
| Auto-Planter | 15s interval, range 1 | 3s interval, range 6 |
| Auto-Collector | 8s interval, range 1 | 1s interval, range 6 |
| Grow Lamp | +15% night growth, range 1 | +40% night growth, range 6 |
| Pest Zapper | Range 2 | Range 7 |

## SEO Keywords

space farming game, browser farming simulator, alien farm planet, crop growing game, livestock management, tech tree farming game, space weather farming, casual farming game, pixel art farm, SynthelicZ desktop game, HTML5 farming game, building upgrades
