# Space Mining

A mining and trading game in space for the SynthelicZ Desktop. Fly a mining ship out of Kessler Station into five asteroid belts, laser rocks until they crack into smaller rocks and ore, reel the nuggets in with the tractor beam and haul them home past volatile rocks, radiation, solar storms, gravity wells and pirates. Sell ten ores into a market that moves, smelt bars, fill contracts, buy hulls, upgrades, station modules and mining drones, research a 32-node tech tree and chart the belts all the way to the Crown Heart. Gold Rush and a seeded Daily Belt round it off. All art is procedural canvas drawing.

## How It Works

The game runs a fixed 60 Hz simulation in world units and draws one frame per display refresh. The view is a 1280 x 720 plane fitted into the window: menus stay letterboxed inside it, while the belt, the scenery and the HUD use every extra pixel of a wider or taller window. Pointer positions are mapped back into the plane on every event, so clicks stay exact after resizing or maximizing.

A trip is one flight into a belt of 6,400 x 4,600 px. The belt is laid out from a seed: two warped bands of rubble plus clumps from value noise, open space round the dock, each rock's ore drawn from the belt's mix (rare ore boosted by research, uranium gathering in radiation fields). The ship flies with inertia; WASD thrusts in screen directions (or the right mouse button thrusts toward the cursor) and the nose turns to the thrust or the laser. The laser is a ray cast through a uniform spatial grid to the first rock, pirate or wreck. Damage heats a rock and chips ore off it; at zero hit points it cracks into two or three rocks one size smaller plus ore nuggets, with chunks, dust, sparks, a shockwave, screen shake and hit-stop for the big ones. Volatile rocks explode and set off their neighbours. Nuggets drift until the tractor beam reels them in, as long as the hold has space; mining drones pick their own rocks, drill, sweep up and fly their baskets home.

Docking (slowly, inside the dock ring) plays the docking sequence and ends the trip: the hold goes to the station warehouse, the bill for fuel and repairs is paid, and one market cycle passes. Each ore has a mean-reverting random-walk price factor, a saturation that your own sales push up and that recovers every cycle, booms and busts announced in the news, and a price history. A refinery smelts three ore into one bar worth more; contracts ask for ore or bars and pay credits plus research data. Credits buy hulls, hangar upgrades (six of them, ten levels each, rising costs), station modules (which appear on the station) and belt licences; research data, earned from rare ore, discoveries, contracts and achievements, buys the tech tree, whose purchases take effect at once - also from the pause menu mid-trip.

All art is painted once into cached canvases at twice its size: hulls from layered lit plates with five bank frames, asteroid bodies per size, variant and belt palette (regolith mottling, strata, craters with lit rims, terminator, rim light) with separate ore-vein, vein-glow and crack overlays, nuggets, the station in parts, pirates, wrecks, the gravity-well disc, and per-belt backdrops (domain-warped fbm nebulae, lit planets with bands and rings, moons, suns, a black hole, three star tiles and a far rubble layer). Per frame the game only blits sprites, draws additive glows and strokes; no blur filters are used. Effects are pooled particles (glows with colour ramps, sparks batched into one path per colour, smoke, rock dust, tumbling chunks, embers, rings, floating texts). A busy scene (pirates, storm, drones, hundreds of particles and nuggets) takes about 2.5 ms of script per frame.

Progress lives in one versioned save (credits, research, hulls, upgrades, tree, modules, licences, warehouse, market, contracts, achievements, statistics, bests, high scores). The first version's high-score list and tutorial flag are migrated once into it; veterans start with half their best haul as credits (up to 5,000).

## Architecture

The code lives in `js/` as plain scripts on the `SZ.SpaceMining` namespace, loaded in order by `index.html` (no build step, no modules). All shared game state sits in one object, `SZ.SpaceMining.state` (`G` in every module); each module states at its top what it owns and what it reads.

- **`index.html`** -- Menu bar (Game: Title Screen, Pause, Tech Tree, High Scores, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, dialog tables

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.SpaceMining` namespace with one object per module, so modules can call modules that load after them
- **`constants.js`** -- View plane, simulation clock, world, grid and pool sizes, rock radii, flight, laser, tractor and dock tuning, feel timings, UI palette
- **`rng.js`** -- Seeded mulberry32 generators, string hashing, the local day key, angle and segment helpers
- **`data-ores.js`** -- Ten ores (value, rarity, colours, research yield, bar name) and five belts (ore mix, hazards, pirates, licence, colour theme)
- **`data-ships.js`** -- Four hulls, six hangar upgrades, five station modules, three pirate types
- **`data-tree.js`** -- The tech tree: six branches, 32 nodes with research costs, prerequisites, placement and per-level stats
- **`data-goals.js`** -- The three modes, 17 achievements and the statistics they watch
- **`rules.js`** -- Pure progression rules: the save shape and its migration, tree, upgrade, hull, module and licence purchases, derived ship stats, the Daily loadout, hold space, achievements, high scores
- **`economy.js`** -- Pure market rules: prices, saturation, selling, refining, contracts, the market cycle with news and history, forecasts, the service bill
- **`state.js`** -- The shared state object: screens, save and stats, the trip, entity lists, ship, camera, effects, feel timers, cinematic, input, per-screen UI
- **`save.js`** -- Loads and writes the v2 save (the only module touching `localStorage`) and refreshes the derived stats
- **`audio.js`** -- Sound effects through the shared `SZ.GameAudio`, throttled per name and attenuated by distance

Systems (`js/systems/`), one simulation concern each:

- **`grid.js`** -- The spatial grid (circle and segment queries, each object once), in-place list compaction, object pools
- **`fx.js`** -- Pooled particles and colour ramps, rock chunks and dust, rings, floating texts, explosions, shake, hit-stop, slow motion, flashes
- **`camera.js`** -- The chase camera with velocity and aim look-ahead, speed zoom, cinematic focus, shake; world and view mapping
- **`asteroids.js`** -- Seeded belt layout, rock hit points, damage, heat and chipping, fracture into children and nuggets, volatile chains, drift, respawning, geodes and the Crown Heart
- **`ship.js`** -- The mining ship: inertia flight, boost, banking, fuel, edges, bouncing off rocks with impact damage, shield and hull, blasts, exhaust
- **`mining.js`** -- The laser ray cast, fault cracks, the split beam, nuggets and salvage, the tractor beam, the hold, the scanner pulse, seismic charges
- **`hazards.js`** -- Radiation fields, gravity wells with infall, solar storms with warning and front
- **`pirates.js`** -- Pirate waves, skimmers that steal ore, raiders and gunships that shoot, rock avoidance, bolts, the point-defense turret, loot
- **`drones.js`** -- Mining drones: launch, target choice (Prospector AI), drilling, sweeping, returning, unloading, rebuilding
- **`trip.js`** -- A trip from launch to report: belt setup, specials, docking, fuel and hull, mode clocks, discoveries, wrecks, the Crown, settling the hold, results
- **`cinematics.js`** -- The sequencer for full-screen and in-world cinematics, their timed events and skipping
- **`sim.js`** -- One fixed step in order: input, hit-stop, slow motion, every system, the trip, effects, camera

Render (`js/render/`):

- **`art-kit.js`** -- Offscreen canvases, the sprite cache, colour maths, value noise and fbm, shared glow, smoke, bolt and ring sprites, hit-flash silhouettes
- **`view.js`** -- Canvas fitting, backing resolution cap, the visible plane rectangle, pointer mapping, resize and maximize
- **`ship-art.js`** -- The layered hull painter with five bank frames for the four hulls, nozzles and emitters, the mining drone
- **`rock-art.js`** -- Asteroid bodies, ore veins and vein glow, volatile veins, crack stages, nuggets, salvage, debris chips, the geode, the Crown Heart
- **`prop-art.js`** -- The dock, pirates, the derelict, the gravity well, radiation haze, the seismic charge, the icon set
- **`station-art.js`** -- Kessler Station in parts: hub, turning ring, and module arms that grow with their level
- **`backdrop-art.js`** -- Belt nebula layers, planets, moons, suns, the black hole, star tiles, the far rubble tile
- **`backdrop.js`** -- The per-frame parallax backdrop for the current belt and the speed-streaked dust
- **`fx-render.js`** -- Particles, sparks, rings and floating texts from cached sprites
- **`world.js`** -- The belt in draw order with culling: hazards, dock, rocks with glow and heat, wrecks, nuggets and tractor beams, drones, charges, pirates, bolts, the ship, lasers, the pulse, the storm
- **`hud.js`** -- Gauges, the ore hold, belt and clock, radar, ability slots, warnings, the dock arrow, hints, banners, reticle, letterbox, flash, toasts, achievement pop-ups
- **`cine-render.js`** -- The intro, launch, new belt and ending sequences; arrival, docking and discovery overlays
- **`frame.js`** -- One frame: cinematic or belt and HUD or menu scenery, the active screen, flash and toasts, cursor and draw timing

UI (`js/ui/`):

- **`kit.js`** -- Fonts, fitted and wrapped text, panels, segmented bars, locks, icons, credit and research amounts, the chrome logo
- **`widgets.js`** -- Hit areas registered while drawing, hover and keyboard cursor, directional navigation, buttons with a selected state
- **`screens.js`** -- Screen switching with return targets, pause and resume, starting the career and launches, toasts, achievement pop-ups
- **`status-bar.js`** -- The window status bar and the High Scores dialog
- **`touch.js`** -- Virtual fly and aim sticks and ability buttons for touch screens
- **`title.js`** -- The animated title with a rig drilling a gold-veined rock, the mode menu, pilot record and preview
- **`station.js`** -- The career hub: station art, header and news, the Market, Refinery and Contracts tabs, coin payouts
- **`shipyard.js`** -- The Shipyard tab (hulls, level-up upgrade cards) and the Modules tab
- **`map.js`** -- The belt map with planets, lanes, details, launching and buying licences
- **`tree.js`** -- The tech tree screen with links, states, detail panel and research that applies mid-trip
- **`help.js`** -- Five illustrated How to Play pages
- **`pause.js`** -- The pause menu with Tech Tree, How to Play, tow home and quit
- **`results.js`** -- The trip report or mode score with counted values and the next goal
- **`input.js`** -- Keyboard, mouse and touch input, flight intent with keyboard auto-aim, cinematic skipping, menu navigation, auto-pause

Bootstrap:

- **`js/app.js`** -- The fixed-step loop, the menu bar, background pre-painting of belt art, start-up

Tests (`tests/`, run with `node tests/<name>.test.js`):

- **`harness.js`** -- A recording fake canvas, minimal DOM and storage, a loader that runs the game scripts in `index.html` order, a stepper
- **`rules.test.js`** -- Tree, upgrades, hulls, modules, licences, derived stats, the Daily loadout, hold space, achievements
- **`economy.test.js`** -- Prices, saturation and recovery, drift bounds, news, history, refining, contracts, service costs
- **`save.test.js`** -- Migration of the old high scores and tutorial flag, repair of damaged saves, round trip, storage failures
- **`world.test.js`** -- Grid queries, seeded belts, fracture and yield, volatile chains, the laser, the tractor and a full hold, drones, docking, endings, belt hazards
- **`art.test.js`** -- Every sprite paints and is cached within budget, blit cost, a busy frame's draw-call budget, no blur filters, file sizes
- **`boot.test.js`** -- The whole game in the fake browser: every screen and cinematic, keys, pausing, research mid-trip, a tow, Gold Rush and Daily Belt scores

## User Stories

### Flight & Mining
- [x] As a player, I can fly my mining ship with inertia using WASD or the arrows, or thrust toward the cursor with the right mouse button
- [x] As a player, I can drill with the mining laser at the cursor, or with Space and auto-aim, and see the beam glow, the rock heat up and sparks and dust fly
- [x] As a player, I can crack asteroids of four sizes into smaller rocks and ore nuggets with chunks, dust, shockwaves, screen shake and hit-stop
- [x] As a player, I can reel nuggets into my hold with the tractor beam and see the hold fill by ore colour
- [x] As a player, I can bounce off rocks and take impact damage when I hit them too fast
- [x] As a player, I can boost, ping the belt with a scanner pulse and drop seismic charges once researched
- [x] As a player, I can launch mining drones that drill rocks on their own and bring the ore home
- [x] As a player, I can fly back into the dock ring to end a trip with a docking sequence

### Belts & Hazards
- [x] As a player, I can mine five belts - Kessler Drift, Amber Reach, Verdant Shoals, Crimson Maw and Void Crown - each with its own scenery, ore and hazards
- [x] As a player, I can mine ten ores of rising value and rarity, from iron and ice to iridium and void crystal
- [x] As a player, I can set off volatile rocks in chain reactions
- [x] As a player, I can brave radiation fields, solar storms and gravity wells
- [x] As a player, I can fight skimmers that steal from my hold and raiders and gunships that shoot, with my laser and a point-defense turret
- [x] As a player, I can manage fuel and hull; running dry costs half the hold, losing the ship costs all of it
- [x] As a player, I can discover crystal geodes and derelict freighters and crack them open for ore, salvage and research

### Economy
- [x] As a player, I can sell my warehouse at Kessler Station into a market whose prices drift, react to my sales and swing with booms and busts
- [x] As a player, I can see each ore's price history and, with the Scanner Array, a forecast
- [x] As a player, I can refine three ore into a more valuable bar
- [x] As a player, I can fulfil delivery contracts for credits and research data
- [x] As a player, I can buy four hulls and six upgrades that level up ten times with rising costs
- [x] As a player, I can build five station modules (refinery, drone bay, scanner array, trade hub, fuel depot) and see them on the station

### Progression & Modes
- [x] As a player, I can research a 32-node tech tree in Drilling, Engines, Logistics, Automation, Defense and Science, from the title, the station or the pause menu, with immediate effect
- [x] As a player, I can buy licences that open the next belt as my earnings grow
- [x] As a player, I can earn 17 achievements that pay research data
- [x] As a player, I can find and shatter the Crown Heart to complete the career
- [x] As a player, I can play Gold Rush (five minutes, sell at the dock as often as I like) and the seeded Daily Belt with a standard rig

### Cinematics
- [x] As a player, I can watch an intro of my first launch from Kessler Station
- [x] As a player, I can see a jump sequence when I launch and a warp arrival with the belt's name
- [x] As a player, I can watch my ship dock on autopilot
- [x] As a player, I can see discoveries in slow motion with a close-up and light rays
- [x] As a player, I can see a new belt charted when I buy its licence, and an ending with fireworks and my career statistics
- [x] As a player, I can skip any cinematic with a key, click or tap

### Screens & Controls
- [x] As a player, I can navigate every screen with the mouse or the keyboard
- [x] As a player, I can read five illustrated How to Play pages
- [x] As a player, I can play on a touch screen with a fly stick, an aim-and-drill stick and ability buttons
- [x] As a player, I can resize or maximize the window and keep exact click mapping, with the belt filling the extra space
- [x] As a player, I can have the game pause when the tab is hidden

### Persistence
- [x] As a player, I can keep credits, research, ships, upgrades, modules, licences, the warehouse, the market and statistics across sessions in one save
- [x] As a player, I can keep my old high scores, with starting credits for them
- [x] As a player, I can view and reset a top-10 high score list

### Planned Features
- [ ] As a player, I can trade at outposts in the far belts with their own prices
- [ ] As a player, I can fly escort contracts for other miners

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrow keys | Fly |
| Right mouse | Fly toward the cursor |
| Left mouse | Drill at the cursor |
| Space | Drill with auto-aim |
| Shift | Boost |
| Q | Scanner pulse |
| C | Seismic charge |
| F | Recall or launch drones |
| Esc / P | Pause |
| Tab | Next station tab |
| T / H | Tech tree / How to Play (menus) |
| B | Research the selected node |
| Any key / click | Skip a cinematic |
| F2 | Title screen |

## SEO Keywords

space mining game, asteroid mining browser game, free online mining game, space economy game, mining tycoon, tech tree, mining drones, ore refining, space trading game, SynthelicZ game
