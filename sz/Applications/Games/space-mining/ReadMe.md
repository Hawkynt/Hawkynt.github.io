# Space Mining

A mining, base-building and real-time strategy game in space for the SynthelicZ Desktop. Fly a mining ship out of Kessler Station into five asteroid belts, laser rocks until they crack into smaller rocks and ore, reel the nuggets in with the tractor beam and haul them home past volatile rocks, radiation, solar storms, gravity wells and pirates. Sell 22 resources into a market that moves, smelt bars, fill contracts, buy hulls, upgrades, station modules and mining drones, and research a 52-node tech tree.

From the Verdant Shoals on you can found an outpost: 25 buildings on a build grid - rigs, siphons and harvesters on deposits, smelters, refineries and fabricators that turn ore into bars and components, power, storage, crew, turrets, shields, factories and labs - linked to the hub by power relays. Attack waves of pirates, alien swarms and the nanoprobe Lattice come for it, with a hive mothership per belt; you defend it with turrets, your ship and a fleet you command in formation from a zoomed-out tactical view. The outer belts are alive: the Bloom infects crews and can leave an outpost abandoned, the Lattice hijacks buildings and units. Distress calls, seasons, weekly anomaly belts, a daily contract streak and a captain's log keep the belts changing. Gold Rush, a seeded Daily Belt and a 15-wave Siege round it off. All art is procedural canvas drawing.

## How It Works

The game runs a fixed 60 Hz simulation in world units and draws one frame per display refresh. The view is a 1280 x 720 plane fitted into the window: menus stay letterboxed inside it, while the belt, the scenery and the HUD use every extra pixel of a wider or taller window. Pointer positions are mapped back into the plane on every event, so clicks stay exact after resizing or maximizing.

A trip is one flight into a belt of 6,400 x 4,600 px. The belt is laid out from a seed: two warped bands of rubble plus clumps from value noise, open space round the dock, each rock's ore drawn from the belt's mix (rare ore boosted by research, uranium gathering in radiation fields). The ship flies with inertia; W and S thrust along the nose and back, A and D turn the ship (or the right mouse button thrusts toward the cursor and the nose turns to the thrust). The laser fires along the nose and bends inside a cone of about 35 degrees to either side: the mouse aim is clamped to that cone, and Space locks onto the pirate or ore rock whose edge sits closest to the nose; while firing the ship only eases toward the aim at about 1 rad/s instead of snapping round. The laser is a ray cast through a uniform spatial grid to the first rock, pirate or wreck. Damage heats a rock and chips ore off it; at zero hit points it cracks into two or three rocks one size smaller plus ore nuggets, with chunks, dust, sparks, a shockwave, screen shake and hit-stop for the big ones. Volatile rocks explode and set off their neighbours. Nuggets drift until the tractor beam reels them in, as long as the hold has space; mining drones pick their own rocks, drill, sweep up and fly their baskets home - and when the hold has no room they haul the basket to the station, bank it and fly straight back out.

Docking (slowly, inside the dock ring) banks the hold in the station warehouse and refuels and repairs the ship for the usual bill, and the flight goes on. The trip ends only when the pilot returns home (Enter while docked, the Return home button, or the pause menu): the docking sequence plays, the last hold is settled, the report counts everything banked during the trip, and one market cycle passes. Each ore has a mean-reverting random-walk price factor, a saturation that your own sales push up and that recovers every cycle, booms and busts announced in the news, and a price history. A refinery smelts three ore into one bar worth more; contracts ask for ore or bars and pay credits plus research data. Credits buy hulls, hangar upgrades (six of them, ten levels each, rising costs), station modules (which appear on the station) and belt licences; research data, earned from rare ore, discoveries, contracts and achievements, buys the tech tree, whose purchases take effect at once - also from the pause menu mid-trip.

All art is painted once into cached canvases at twice its size: hulls from layered lit plates with five bank frames, asteroid bodies per size, variant and belt palette (regolith mottling, strata, craters with lit rims, terminator, rim light) with separate ore-vein, vein-glow and crack overlays, nuggets, the station in parts, pirates, wrecks, the gravity-well disc, and per-belt backdrops (domain-warped fbm nebulae, lit planets with bands and rings, moons, suns, a black hole, three star tiles and a far rubble layer). Per frame the game only blits sprites, draws additive glows and strokes; no blur filters are used. Effects are pooled particles (glows with colour ramps, sparks batched into one path per colour, smoke, rock dust, tumbling chunks, embers, rings, floating texts). A busy scene (pirates, storm, drones, hundreds of particles and nuggets) takes about 2.5 ms of script per frame.

### Operations

Every belt teaches one loop of its own and keeps the earlier ones running: the Kessler Drift is mining, the Amber Reach adds escorting freighters, the Verdant Shoals add outposts and attack waves, the Crimson Maw adds enemy outposts and warfare, the Void Crown asks for all of it. Outposts can be founded only in the Verdant Shoals and beyond (Siege brings its own). Each belt has a chain of operations, picked on the belt map: an objective (bank ore, bank ore worth credits, deliver one ore, launch drones, crack geodes and derelicts, shoot down pirates, deliver freighters), an optional time limit, threats sent by a pacing director, and a first-clear reward of credits, research and unlocks. Operations open one after another; the last one, the belt's capstone, is needed for the next belt's licence besides the earnings. Every operation carries the mood it is meant to strike - challenging, a breather, a surprise, harder, worse than you thought, a nightmare - and a belt never puts two peaks in a row: after a peak comes a breather or a surprise. Free mining trips stay open in every licensed belt.

The pacing director follows a timeline of beats per operation (build-up, peak, relief, surprise) and a tension score made of the hull lost lately and the threats around the ship. Threats come in clusters off screen at the beat's pace (the belt's own pirate packs hold off while an operation runs); a player who is crushing it gets them up to a quarter sooner and bigger, one who is drowning up to a quarter later and smaller. An operation is won the moment its last objective is met (the reward is paid at once and the trip goes on), and failed when its time runs out, the ship is lost or the pilot returns home first; the trip report names the outcome. A save from before the operations keeps everything, except that outposts in the Kessler Drift and the Amber Reach are dismantled: their buildings and fleet come back as credits and their stock moves into the station warehouse.

### Escort

The Amber Reach adds freighters. Four trading posts sit at the edges of the belt - north, east, south and west, placed by the belt's seed - and lanes with a couple of bends run from the dock to each of them, cleared of rocks when an escort operation starts. A freighter undocks on the operation's schedule and follows its lane at a slow, steady pace (half speed inside a solar storm); its route is drawn faintly in the belt and marked on the radar, and an arrow on the screen edge points at every freighter in flight, red while one is under attack. Pirates lie in wait at choke points along the lanes and strike as a freighter passes: skimmers latch on and drain its cargo - up to fifteen percent each - then run, and shooting one down before it gets away brings the cargo back; raiders and gunships shoot its hull. Ambushers whose freighter docks give up the raid and leave. A freighter that reaches its post pays the operation's fee times the share of cargo still aboard; one that docks with less than half its cargo voids its contract and counts as lost, and so does one whose hull gives out. Several freighters heading in different directions at once make a fast hull, afterburners and long-range weapons pay off. Some freighters stop halfway and ask for ore to patch their reactor: fly up to them slowly with the belt's commonest ore in the hold and they take it and fly on. From the Hired Wing operation on, two fighters fly with every convoy: they guard the ship and dive on whatever attacks a freighter.

The Amber Reach operations: One Freighter (challenging), Long Lane (breather), Storm Crossing (surprise: a storm front and an ambush in it), Two Freighters in opposite directions (harder), Hired Wing (breather), Convoy of three on one lane (harder), Three Directions, all three to arrive, with a gunship in every ambush (worse than you think), Reactor Trouble (surprise: a freighter wants ore you mine on the way) and the capstone, the Long Haul (nightmare: four freighters, a storm front and armoured gunship leaders), which opens the Verdant Shoals licence. An escort operation fails once more freighters are lost than it allows.

### Outposts

Each belt has an outpost site: a 20 x 16 grid of 48 px cells with seeded ore, gas and crystal deposits, kept clear of rocks. In the command view (Tab) you found it with a Command Hub, then place buildings with a ghost preview that shows the footprint, the range and why a spot is refused. A building must be in link range of the hub or a power relay; the link network carries power and is also the path infection and nanoprobes travel. Buildings cost credits and outpost stock (fly slowly over the hub to unload your hold into it); what the stock lacks comes straight out of the ship's hold (mined ore and supplies) and flies over as cargo pods; a missing bar is smelted on the spot from three ore of its kind - from the hold first, then the outpost's ore, once the ore the cost asks for directly is set aside - and only components must be in stock or aboard. Buildings take time to build - two sites at a time, drawn as a blueprint filling in - and level up to three. Every few hundred milliseconds the outpost refreshes its network, hands crew to buildings by priority (defence and power first), balances power (consumers slow down in a deficit; fusion burns gas), and runs production: extractors pull from their deposit, the smelter and refinery turn three ore into a bar, the fabricator turns bars into seven components, the lab writes research data, the trade depot ships the best stock home. Every unit of stock that moves flies as a little cargo pod. Storage, housing and fleet supply come from the hub, warehouses and habitats. Between trips each outpost produces a little and costs upkeep.

### Tower defense in the Verdant Shoals

The Verdant Shoals turn the outpost into a tower defense. Two turrets join the laser, flak and missiles: the Tesla Coil throws lightning that jumps from its target to three more invaders close by (energy, best against swarms), and the Stasis Beam holds a beam on the heaviest invader in reach and slows it to under half speed while it lasts. The minimap and the radar mark the bearing the next wave comes from as soon as it is known - the Sensor Array tells it early, everyone sees it in the last 25 seconds - and a split wave shows both.

The Verdant operations: Found the Outpost (challenging: a hub, two turrets and the first wave), Hold the Line (breather: four waves), Radiation Season (surprise: radiation clouds drift over the outpost and slow every plant and lab (rigs, siphons, harvesters, smelters, refineries, fabricators, sensors, labs and medical bays) inside them that no powered shield dome covers - a thin haze that burns a hull at a third of a field's strength - while the smelters must turn out bars), First Bloom (harder: an outbreak breaks out in a crew building during the waves - end it), Siege Breakers (harder: bombers and siege ships lead the waves - build flak and hold), Split Front (worse than you think: five waves that split and come from two bearings at once), Supply Run (surprise: two supply freighters must reach the hub through an ambush while the waves keep coming) and the capstone, Mothership (nightmare: the third wave brings the hive mothership), which opens the Crimson Maw licence. In these operations the waves keep their own pace and strength (a retry does not make them harder), the Lattice stays out of them (it comes with the Crimson Maw), the Bloom reaches the outpost (on swarmer bites, in cargo and as belt outbreaks) only from First Bloom on, and losing the hub fails the operation. Wave swarmers go for the outpost and its fleet and turn on the ship only when it comes close.

### Supplies

The outer belts carry little or none of the iron, copper and ice that buildings need, so outposts there are supplied from home. The station's Supply tab sells iron, copper and ice as ore and as bars at a markup over the market price, straight into the warehouse, and holds the cargo manifest: a standing order of ore, bars and components loaded from the warehouse into the hold at every career launch, as far as the hold and the warehouse allow. Docked mid-trip, the Supplies button opens the same list to load or unload on the spot (the trip waits). Supplies ride apart from mined ore: they take hold space (ore packs as usual, a bar or component takes one slot), docking never banks them and they never count as a haul or toward an operation. Flying over a hub unloads them into the outpost stock with the ore, and a building, upgrade or unit takes what the stock lacks from the supplies first, then from mined ore. Whatever is still aboard when the trip ends goes back to the warehouse - half of it after a tow, none of it if the ship is lost.

The hub also orders supply freighters: pick a pack on the hub's panel - iron or copper, each as ore and some bars, or a builder's mix of both with ice - and pay the station's supply prices plus a freight fee. A freighter undocks at the station and flies a lane to the hub, at most two at a time; in belts with pirates an ambush may wait along the way (the more pirates the belt has, the likelier, at most four shipments in five), and skimmers drain the load as they would any freighter. What arrives goes into the outpost stock, scaled by the cargo still aboard; a freighter that is shot down is lost with its load, and one still on its way when the trip ends turns back and puts its load into the station warehouse.

### Weapons and the combat model

Beside the mining laser every hull carries weapon hardpoints - one on the Prospector, two on the Wasp and the Hauler, three on the Leviathan - fired with 1, 2 and 3 in the pilot view (or their touch buttons). Nine weapons fill them, each with three levels (more damage, shorter cooldown): the Pulse Cannon (energy bolts, handed out by Claim Jumpers), and with the Amber Reach the Scatter Flak (a cone of pellets), the Missile Rack (homing salvos that burst) and the Tether Tow (grabs a rock behind the ship and flings it into the enemy); with the Verdant Shoals the Rail Lance (hold to charge, pierces everything in line) and the EMP Mine (strips shields, stuns, scrambles the Lattice); with the Crimson Maw the Gravity Net (holds enemies in place) and the Cloak Field (pirates and invaders lose you until you fire); with the Void Crown the Drone Swarm (four attack drones for a while). Pulse, flak and missiles fire while their key is held, the lance charges while held and fires on release, the rest act on a press. The Shipyard's Hardpoints page buys, levels and mounts them.

Every hit the player's side lands - the laser, the hardpoints, units, turrets and the point defense - counts its damage type against the target's armour: energy, kinetic, explosive, flak and EMP against light, armoured, shielded, swarm, structure and bio. Flak shreds swarms and light hulls and bounces off armour, kinetic punches armour and splashes off shields, explosives crack structures, armour and swarms, energy burns shields and bio, EMP strips shields and does little else. From wave 5 on the wave composer leans toward the enemies that resist the outpost's current mix of units and turrets, so one kind of gun stops being enough.


While you are in a belt with an outpost a wave timer runs; the next wave is composed ahead from a point budget that grows with the wave number, the belt's danger and what the outpost is worth, and the Sensor Array shows it early. Waves come from one bearing in clusters: swarmers that bite, raiders that strafe, bombers that dive on soft buildings, shielded frigates, siege ships that shell from beyond turret range, brood carriers, Lattice swarms that corrupt what they touch, and at wave 8 a hive mothership. Turrets (laser, flak, missiles) take targets by preference, shield domes soak damage for the buildings under them, repair bays and repair drones mend. Units are built in the shipyard and drone factory: fighters, gunboats, escort frigates, transports, mining drones, repair drones and purge tenders. Orders - move, attack-move, attack, escort, patrol, hold, mine, repair, purge, return - are shaped into a line, wedge, box or circle facing the way the group travels, units take the nearest slots, the group keeps its slowest member's speed, Shift queues waypoints, factories have rally points, idle units guard their post, and kills earn veterancy ranks. Units and invaders use their own spatial grids; target picking is throttled.

### Life, infection and the Lattice

Gas pockets and Bloom clouds drift in the belts (fly through to scoop them); living rocks burst with spores when drilled, crystalline ones shed swarmers, hive nests sleep in hollow rocks. Bio-matter contaminates the hold. Unloaded at a hub without a cargo scan it seeds infection, which grows logistically in staffed buildings, spreads along links, slows work and kills crew - when the last crew dies the outpost is abandoned, scavengers strip it and after three cycles it becomes a hive. Quarantine cuts a building from the links, the medical bay treats nearby crew (and with serum vaccinates the outpost), sterilising kills the spores and some crew. Lattice corruption replicates inside a building and spreads along links; at 100% the building turns: turrets fire on your fleet, factories make Lattice drones, reactors drain the grid, and corrupted units desert. Purges (a circuit each), purge tenders and the hub's EMP clean it; vaccine and firewall research slow both. Distress calls lead to silent stations guarded by a hive or Lattice drones; clear them, dock, and bring the survivors to an outpost as crew. Seasons (by local date), a weekly anomaly belt with its own rules and pay, the daily and weekly contracts with a streak, and seven captain's log chapters played as cinematics complete the loop.

### Hangar, festivals and soundtrack

The station's Hangar tab collects 15 liveries (paint schemes laid over any hull), 11 mining-beam colours and 11 thruster plumes. Each opens from the start, with credits or research, with achievements, belt licences, by breaking the Crown, or on a festival track. Six seasons a year (Perihelion Lights, Frostbelt, Spring Bloom, Solar Solstice, Perseid Drift, Void Night) each run a six-tier track: every finished trip pays tokens by the value of its haul, and the track pays credits, research and that season's own livery, beam and plume. The soundtrack is in the style of the 16-bit consoles - FM bass, brass, leads and bells, PSG square arpeggios, punchy drums with tom fills - composed live by the shared `SZ.GameMusic` (all themes are original). Every belt has one theme, a career trip a variant of its own, and the theme follows what the pilot is doing: calm while mining or docked, a walking groove while cruising, a tense march when a wave or an ambush is coming, a storm is warned or an operation's director is about to strike, the full battle arrangement while pirates or invaders are close or the outpost is under attack, and a heavier phrygian version when a mothership is in the belt. Changes land on the next bar line; the music climbs at once but calms down only after some quiet seconds, so one passing skimmer does not toss it around. Pause-and-plan thins the band. Won and failed operations and repelled waves play a short phrase over the music. The station, the menus, Gold Rush and the Daily Belt and Siege have their own themes in the same style.

Progress lives in one versioned save (credits, research, hulls, upgrades, tree, modules, licences, warehouse with components, market, contracts, achievements, statistics, bests, high scores, outposts with their buildings, stock, crew and fleet, the log, the streak, and an autosave of the trip in flight so Continue resumes exactly where you left). The first version's high-score list and tutorial flag are migrated once into it; veterans start with half their best haul as credits (up to 5,000). Saves from before the outposts load with empty sites and keep their market prices. In a battle of 44 buildings and 180 ships the game spends about 0.3 ms of script on a simulation step and 1.5 ms on drawing calls per frame.

## Architecture

The code lives in `js/` as plain scripts on the `SZ.SpaceMining` namespace, loaded in order by `index.html` (no build step, no modules). All shared game state sits in one object, `SZ.SpaceMining.state` (`G` in every module); each module states at its top what it owns and what it reads.

- **`index.html`** -- Menu bar (Game: Title Screen, Pause, Tech Tree, High Scores, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, dialog tables

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.SpaceMining` namespace with one object per module, so modules can call modules that load after them
- **`constants.js`** -- View plane, simulation clock, world, grid and pool sizes, rock radii, flight, laser, tractor and dock tuning, feel timings, UI palette
- **`rng.js`** -- Seeded mulberry32 generators, string hashing, the local day key, angle and segment helpers
- **`data-ores.js`** -- 22 resources in seven kinds (value, rarity, colours, research yield, bar name) and five belts (rock ore mix, gases, life and nanoprobe pressure, hazards, pirates, licence, colour theme)
- **`data-ships.js`** -- Four hulls, six hangar upgrades, five station modules, three pirate types
- **`data-tree.js`** -- The tech tree on two pages: eleven branches, 52 nodes with research costs, prerequisites, placement and per-level stats
- **`data-goals.js`** -- The four modes, 29 achievements and the statistics they watch
- **`data-weapons.js`** -- The nine hardpoint weapons (type, firing mode, cooldown, damage, range, unlock, price), their levels and the hardpoints of each hull
- **`data-colony.js`** -- Seven components and their recipes, what the plants smelt, six build categories and the 25 buildings
- **`data-fleet.js`** -- Seven unit types, ten hostile types with wave costs and unlocks, the boss wave, four formations, veterancy ranks
- **`data-ops.js`** -- The operations of every belt: mood, objectives, time limit, threats, pacing beats and rewards, and the moods
- **`data-events.js`** -- Belt events, seasons, weekly anomalies and the seven captain's log chapters
- **`rules.js`** -- Pure progression rules: the save shape and its migration, tree, upgrade, hull, module and licence purchases, derived ship and colony stats, the Daily loadout, hold space, achievements, high scores
- **`escort.js`** -- Pure escort rules: the trading posts at the belt edges, lanes with bends, points along a lane, choke points, where each freighter of a schedule goes, the pay for a delivery, the cargo latched skimmers drain
- **`supply.js`** -- Pure supply rules: what the station sells and at what markup, the supply freighter packs and their price, buying, the cargo manifest and its repair, hold slots of supplies, fitting a manifest into the hold, moving supplies between warehouse and hold
- **`economy.js`** -- Pure market rules: prices, saturation, selling ore, bars and components, refining, contracts (ore, bars, components, waves), the daily and weekly contracts and the streak, the market cycle with news and history, forecasts, the service bill
- **`colony.js`** -- Pure outpost rules: sites and deposits, the saved outpost and its repair, placement, the link network, power, crew, storage, housing and supply, costs and upgrades (paid from stock, the hold covering missing ore), value, upkeep, wave scaling and composition
- **`production.js`** -- Pure production chains per step, the while-away yield and the market cycle of every outpost (upkeep, scavengers, hives)
- **`outbreak.js`** -- Pure crew, infection and corruption model: arrivals, growth, spread, quarantine, treatment, deaths, abandonment, hijacking, purge, EMP, reclaiming
- **`ops.js`** -- Pure operation rules: the chain per belt, what opens, the capstone gate, the loops a belt allows, objective progress, recording a result and its reward, the mood rule
- **`pacing.js`** -- Pure pacing director: beats on the timeline, the tension score, threat pace and size
- **`combat.js`** -- Pure combat model: damage types against armour classes, the type of each shot kind, an army's damage mix and the counter-pick weight of an enemy against it
- **`calendar.js`** -- Pure date rules: seasons, ISO weeks and the anomaly belt, trip modifiers, daily and weekly contracts, streaks, the seeded event schedule
- **`data-cosmetics.js`** -- Liveries, beams, plumes with their unlocks, and the festival track tiers
- **`cosmetics.js`** -- Collection rules: owning, buying, equipping, livery colours, the festival track and its rewards, repair of stored data
- **`music.js`** -- The soundtrack: one theme per belt, mode and screen in the 16-bit FM style, the trip's variant, the mood the game is in (calm, explore, tension, combat, boss) with its hysteresis, and the arrangement, section and intensity each mood plays
- **`state.js`** -- The shared state object: screens, save and stats, the trip, entity lists, ship, camera, effects, feel timers, cinematic, input, per-screen UI
- **`save.js`** -- Loads and writes the v2 save (the only module touching `localStorage`) and refreshes the derived stats
- **`audio.js`** -- Sound effects through the shared `SZ.GameAudio`, throttled per name and attenuated by distance

Systems (`js/systems/`), one simulation concern each:

- **`grid.js`** -- The spatial grid (circle and segment queries, each object once), in-place list compaction, object pools
- **`fx.js`** -- Pooled particles and colour ramps, rock chunks and dust, rings, floating texts, explosions, shake, hit-stop, slow motion, flashes
- **`camera.js`** -- The chase camera with velocity and aim look-ahead, speed zoom, cinematic focus, shake; world and view mapping
- **`asteroids.js`** -- Seeded belt layout, rock hit points, damage, heat and chipping, fracture into children and nuggets, volatile chains, drift, respawning, geodes and the Crown Heart
- **`ship.js`** -- The mining ship: inertia flight, boost, banking, fuel, edges, bouncing off rocks with impact damage, shield and hull, blasts, exhaust
- **`mining.js`** -- The laser cone, its lock and the ray cast, fault cracks, the split beam, nuggets and salvage, the tractor beam, the hold, the scanner pulse, seismic charges
- **`hazards.js`** -- Radiation fields, gravity wells with infall, solar storms with warning and front
- **`freighters.js`** -- Escort in a trip: the trading posts and lanes, freighters undocking, following their lane, ambushes at choke points, reactor stops, hull damage, delivery and pay, supply freighters to the hub, the hired wing
- **`pirates.js`** -- Pirate waves, skimmers that steal ore or latch onto freighters, raiders and gunships that shoot, rock avoidance, bolts, the point-defense turret, loot
- **`drones.js`** -- Mining drones: launch, target choice (Prospector AI), drilling, sweeping, returning, unloading, hauling to the station when the hold is full, rebuilding
- **`formations.js`** -- Formation slots (line, wedge, box, circle), rotation, matching units to slots, group speed
- **`orders.js`** -- Issuing orders in formation, queued waypoints, patrol legs, escort stations, when an order is done
- **`base.js`** -- The outpost in a trip: founding, placing, upgrading, demolishing, quarantine, sterilise, purge, EMP, construction, the beat (network, crew, power, production, outbreak, a radiation season over the plants), factories, unloading at the hub, damage, alerts, cargo pods
- **`turrets.js`** -- The outpost's defences each step: laser, flak and missile turrets, the Tesla Coil's chain lightning, the Stasis Beam's slow, shield domes, repair bays
- **`hardpoints.js`** -- The ship's weapons in flight: triggers, cooldowns and charge, bolts, pellets, missiles and slugs, the tether, mines, nets, the cloak and the drone swarm, hits through the combat model
- **`units.js`** -- Units: spawning, ranks, steering with separation and rock avoidance, orders, auto-engagement, mining, repair, purge and transport jobs, desertion, rogue units
- **`enemies.js`** -- Invaders and every shot: behaviours per type, guards, migrations, the hostile grid and target picking, bolts, shells, flak, missiles, artillery, bombs, damage, loot, the EMP
- **`waves.js`** -- The wave timer, preview, warning, arrival in clusters, the mothership, clearing, retreat of stragglers, Siege victory
- **`life.js`** -- Gas pockets and Bloom clouds, living rocks, hive nests, contamination
- **`events.js`** -- The trip's event schedule, the distress mission, reactions to outbreaks and hijacks, the captain's log
- **`operation.js`** -- The operation in a trip: its clock, objectives, the threats the director sends, winning and failing
- **`command.js`** -- The command view: camera, pause-and-plan, selection, groups, formations, smart orders, placement
- **`resume.js`** -- Autosave snapshot of a running trip and its exact restore
- **`trip.js`** -- A trip from launch to report: belt setup, outpost and fleet, specials, banking at the dock, returning home, fuel and hull, mode clocks, Siege, autosave, discoveries, wrecks, the Crown, settling the hold, the outposts' cycle, results
- **`cinematics.js`** -- The sequencer for full-screen and in-world cinematics, their timed events and skipping
- **`sim.js`** -- One fixed step in order: input, command camera (pause-and-plan stops here), hit-stop, slow motion, every system, the trip, effects, camera

Render (`js/render/`):

- **`art-kit.js`** -- Offscreen canvases, the sprite cache, colour maths, value noise and fbm, shared glow, smoke, bolt and ring sprites, hit-flash silhouettes
- **`view.js`** -- Canvas fitting, backing resolution cap, the visible plane rectangle, pointer mapping, resize and maximize
- **`ship-art.js`** -- The layered hull painter with five bank frames for the four hulls, nozzles and emitters, the mining drone
- **`rock-art.js`** -- Asteroid bodies, ore veins and vein glow, volatile veins, crack stages, nuggets, salvage, debris chips, the geode, the Crown Heart
- **`prop-art.js`** -- The dock, pirates, the freighter, the trading post, the derelict, the gravity well, radiation haze, the seismic charge, the icon set
- **`station-art.js`** -- Kessler Station in parts: hub, turning ring, and module arms that grow with their level
- **`backdrop-art.js`** -- Belt nebula layers, planets, moons, suns, the black hole, star tiles, the far rubble tile
- **`colony-art.js`** -- The 25 buildings per level, dark and hijacked variants, turret heads, dish, drill and torus, deposits, the strategy icons
- **`fleet-art.js`** -- The seven unit types and their deserter look, the ten hostile types, gas and Bloom clouds, the silent station
- **`backdrop.js`** -- The per-frame parallax backdrop for the current belt and the speed-streaked dust
- **`fx-render.js`** -- Particles, sparks, rings and floating texts from cached sprites
- **`world.js`** -- The belt in draw order with culling: hazards, clouds, dock, outpost, rocks with glow and heat (cheaper zoomed out), wrecks, nuggets and tractor beams, drones, charges, pirates, fleets, bolts, the ship, lasers, domes and pods, the command overlay, the pulse, the storm
- **`base-render.js`** -- The outpost: site, grid, deposits, energy links, buildings with moving parts, construction, dark, infected and hijacked looks, ranges, shield domes, cargo pods, beams, placement preview, the silent station
- **`fleet-render.js`** -- Clouds, units, invaders, shots, team rings, selection, order paths, markers, the drag box
- **`op-hud.js`** -- The operation tracker in flight: name, mood, objectives with progress, the clock, the convoy's cargo and hull, and the outcome
- **`escort-render.js`** -- The lanes, the trading posts, freighters with their cargo and hull bars, the hired wing, edge arrows toward freighters
- **`weapon-render.js`** -- Weapon shots, mines, nets, the tether line, swarm drones and the cloak shimmer
- **`hud.js`** -- Gauges, the ore hold, belt and clock, radar, ability slots, warnings, the dock arrow, hints, banners, reticle, letterbox, flash, toasts, achievement pop-ups
- **`cine-render.js`** -- The intro, launch, new belt, ending and captain's log sequences; arrival, docking, discovery and outpost overlays
- **`frame.js`** -- One frame: cinematic or belt and flight or command HUD or menu scenery, the active screen, flash and toasts, cursor and draw timing

UI (`js/ui/`):

- **`kit.js`** -- Fonts, fitted and wrapped text, panels, segmented bars, locks, icons, credit and research amounts, the chrome logo
- **`widgets.js`** -- Hit areas registered while drawing, hover and keyboard cursor, directional navigation, buttons with a selected state
- **`screens.js`** -- Screen switching with return targets, pause and resume, starting the career and launches, toasts, achievement pop-ups
- **`status-bar.js`** -- The window status bar and the High Scores dialog
- **`touch.js`** -- Virtual fly and aim sticks and ability buttons for touch screens
- **`title.js`** -- The animated title with a rig drilling a gold-veined rock, Continue, the mode menu, pilot record and preview
- **`station.js`** -- The career hub: station art, header and news, the Market, Refinery and Contracts tabs, coin payouts
- **`supply.js`** -- The Supply tab and the docked Supplies screen: buying basics, the manifest with load and unload buttons, the hold gauge
- **`hangar.js`** -- The Hangar tab: liveries, beams and plumes with live previews, buying and equipping, the festival track
- **`colonies.js`** -- The Colonies tab (daily contract and streak, anomaly, season, every outpost) and the Log tab
- **`shipyard.js`** -- The Shipyard tab (hulls, level-up upgrade cards) and the Modules tab
- **`map.js`** -- The belt map with planets, lanes, details, the operations list and brief, launching and buying licences
- **`tree.js`** -- The tech tree screen on two pages with links, states, detail panel and research that applies mid-trip
- **`help.js`** -- Eight illustrated How to Play pages
- **`pause.js`** -- The pause menu with Tech Tree, How to Play, tow home and quit
- **`results.js`** -- The trip report or mode score with counted values and the next goal
- **`command-hud.js`** -- The command view HUD: resource bar, stock strip, wave clock and preview, boss bar, alerts, minimap, view buttons, tooltips; the pilot view's outpost widget
- **`build-menu.js`** -- Build categories and tiles with costs and tooltips
- **`sel-panel.js`** -- The selection panel: building status and actions, unit counts, formations and orders
- **`command-input.js`** -- Mouse and keys of the command view and the fleet keys of the pilot view
- **`input.js`** -- Keyboard, mouse and touch input, flight intent with keyboard auto-aim, cinematic skipping, menu navigation, auto-pause

Bootstrap:

- **`js/app.js`** -- The fixed-step loop, the menu bar, background pre-painting of belt, outpost and fleet art, autosave on hide, start-up

Tests (`tests/`, run with `node tests/<name>.test.js`):

- **`harness.js`** -- A recording fake canvas, minimal DOM and storage, a loader that runs the game scripts in `index.html` order, a stepper
- **`ops.test.js`** -- The operation chains and their moods, opening, the capstone gate, loops per belt, objective progress, results and rewards, the pacing director
- **`campaign.test.js`** -- A bot plays the Kessler operations in the running game and prints the measured tension per operation
- **`music.test.js`** -- The moods from what is happening, climbing at once and calming slowly, one theme across moods, switches on the bar line, the themes per screen and mode
- **`combat.test.js`** -- The damage table, shot kinds, army mixes, the counter-pick and its waves, weapons in the save, buying, levelling, mounting and unlocks
- **`weapons.test.js`** -- Every weapon in flight against pirates and invaders, the keys and their modes, the combat model on units and turrets
- **`rules.test.js`** -- Tree, upgrades, hulls, modules, licences, derived stats, the Daily loadout, hold space, achievements
- **`economy.test.js`** -- Prices, saturation and recovery, drift bounds, news, history, refining, contracts, service costs
- **`logistics.test.js`** -- Block presses and packed ore, loading the hold at a hub; buying basics, the manifest at launch, supplies apart from the haul, unloading them at a hub and building from them, their return home
- **`save.test.js`** -- Migration of the old high scores and tutorial flag, repair of damaged saves, round trip, storage failures
- **`flight.test.js`** -- The laser cone and its lock, the slow turn while firing, banking at the dock without ending the trip, drones hauling to the station, returning home
- **`world.test.js`** -- Grid queries, seeded belts, fracture and yield, volatile chains, the laser, the tractor and a full hold, drones, docking, endings, belt hazards
- **`art.test.js`** -- Every sprite paints and is cached within budget, blit cost, a busy frame's draw-call budget, no blur filters, file sizes
- **`boot.test.js`** -- The whole game in the fake browser: every screen and cinematic, keys, pausing, research mid-trip, a tow, Gold Rush and Daily Belt scores
- **`colony.test.js`** -- Sites and deposits, placement, links and power, crew, production chains, costs, the outposts' cycle, wave scaling and composition, loading pre-colony saves
- **`fleet.test.js`** -- Formation slots, rotation and matching, group speed, orders: move, waypoints, patrol, escort, attack, return, repair
- **`outbreak.test.js`** -- Crew, infection growth and spread, quarantine, treatment, deaths and abandonment, corruption, hijacking, firewall, purge, EMP, reclaiming
- **`calendar.test.js`** -- Seasons, ISO weeks, anomalies and modifiers, streaks, daily and weekly contracts, the event schedule
- **`strategy.test.js`** -- A bot plays the strategy layer: unload, found, build, a fleet, formations, groups, five waves, an outbreak, a hijack, autosave and Continue, Siege, a big battle's frame cost

## User Stories

### Flight & Mining
- [x] As a player, I can fly my mining ship with inertia ship-relative: W/S thrust along the nose and A/D turn it, or thrust toward the cursor with the right mouse button
- [x] As a player, I can drill with the mining laser along the nose (bending toward the cursor or, with Space, the ore nearest the nose) without the ship spinning round, and see the beam glow, the rock heat up and sparks and dust fly
- [x] As a player, I can crack asteroids of four sizes into smaller rocks and ore nuggets with chunks, dust, shockwaves, screen shake and hit-stop
- [x] As a player, I can reel nuggets into my hold with the tractor beam and see the hold fill by ore colour
- [x] As a player, I can bounce off rocks and take impact damage when I hit them too fast
- [x] As a player, I can boost, ping the belt with a scanner pulse and drop seismic charges once researched
- [x] As a player, I can launch mining drones that drill rocks on their own and bring the ore home
- [x] As a player, I can fly into the dock ring to bank the hold and keep mining, and end the trip only when I choose to return home
- [x] As a player, my drones haul to the station by themselves when my hold is full

### Belts & Hazards
- [x] As a player, I can mine five belts - Kessler Drift, Amber Reach, Verdant Shoals, Crimson Maw and Void Crown - each with its own scenery, ore and hazards
- [x] As a player, I can gather 22 resources: bulk ore, precious metals, crystals and exotic matter from rocks, nebula gases by flying through pockets, scrap from wrecks and kills, bio-matter from living rocks and Bloom clouds
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

### Operations
- [x] As a player, I can pick operations per belt on the belt map, see their mood, objectives, limit and reward, and launch one
- [x] As a player, I can play the Kessler Drift's six operations - First Haul, Copper Contract, Drone Bay, Geode Hunt, Claim Jumpers and the Kessler Charter
- [x] As a player, I can play the Amber Reach's nine escort operations, from One Freighter to the Long Haul
- [x] As a player, I can play the Verdant Shoals' eight tower-defense operations, from Found the Outpost to the Mothership
- [x] As a player, I can follow the objectives and the clock of an operation in flight and see it won or failed
- [x] As a player, I can only buy the next belt's licence after the capstone operation of the belt before it
- [x] As a player, I can face pirates sent by a pacing director that builds up, peaks, lets me breathe and surprises me, and eases or presses with how I am doing
- [x] As a player, I can found outposts from the Verdant Shoals on, and get my old Kessler and Amber outposts back as credits and warehouse stock

### Escort
- [x] As a player, I can escort freighters from the dock along lanes to trading posts at the belt edges and get paid by the cargo they deliver
- [x] As a player, I can fight off ambushes at choke points, shoot down skimmers that drain a freighter's cargo to win it back, and keep raiders off its hull
- [x] As a player, I can follow every freighter on the radar, by edge arrows and in the operation tracker, and see one under attack
- [x] As a player, I can protect several freighters heading in different directions at once, through solar storms
- [x] As a player, I can hand ore to a freighter stuck halfway so it can fly on
- [x] As a player, I can fly with a hired wing of two fighters that guards me and my freighters

### Outposts
- [x] As a player, I can found an outpost in any belt from the command view and expand it on a build grid with a placement preview
- [x] As a player, I can build 23 kinds of buildings - hub, warehouse, habitat, power relay, trade depot, mining rig, gas siphon, crystal harvester, smelter, refinery, fabricator, solar array, fusion reactor, laser turret, flak tower, missile battery, Tesla coil, stasis beam, shield generator, drone factory, shipyard, repair bay, sensor array, research lab and medical bay - each with its own role, icon and three levels
- [x] As a player, I can link buildings to the hub with relays and keep the grid powered, staffed and stocked, and see power, storage, crew and alerts at a glance
- [x] As a player, I can unload my hold at the hub and watch ore flow as cargo pods through smelters and fabricators into bars and components
- [x] As a player, I can build, upgrade and queue units with what is still in my ship's hold when the outpost stock runs short, bars smelted on the spot from ore
- [x] As a player, I can ship the best stock home with the trade depot or transports and earn research in the lab

### Tower Defense
- [x] As a player, I can build a Tesla Coil that chains lightning through swarms and a Stasis Beam that slows the heaviest invader
- [x] As a player, I can see the bearing of the next wave on the minimap and the radar, both bearings of a split wave
- [x] As a player, I can keep an outpost running through a radiation season under shield domes, and stamp out an outbreak during the waves

### Supplies
- [x] As a player, I can buy iron, copper and ice (ore and bars) at the station to build outposts in belts that have none
- [x] As a player, I can set a cargo manifest that loads ore, bars and components from the warehouse at every launch, and change the load while docked
- [x] As a player, I can unload supplies at my hub, build straight from them, and get what I did not use back at the end of the trip
- [x] As a player, I can order supply freighters from my hub and escort them from the station to the outpost

### Weapons
- [x] As a player, I can mount up to three weapons beside the mining laser and fire them with 1, 2 and 3: Pulse Cannon, Scatter Flak, Missile Rack, Tether Tow, Rail Lance, EMP Mine, Gravity Net, Cloak Field and Drone Swarm
- [x] As a player, I can buy, level and mount weapons on the Shipyard's Hardpoints page as the belts open
- [x] As a player, I can see damage types matter: flak for swarms, kinetic for armour, explosives for structures, energy and EMP for shields
- [x] As a player, I can face later waves that counter the guns my outpost relies on

### Waves & Fleet
- [x] As a player, I can defend an outpost against waves of pirates, alien swarms and the Lattice that grow with the outpost and the belt, with a warning and a preview
- [x] As a player, I can face swarmers, raiders, bombers, shielded frigates, siege ships, brood carriers, nanoprobe swarms, Lattice drones and a hive mothership per belt
- [x] As a player, I can build fighters, gunboats, escort frigates, transports, mining drones, repair drones and purge tenders
- [x] As a player, I can select units by click, drag box, double-click and groups 1-9, and order them to move, attack-move, attack, escort, patrol, hold, mine, repair, purge or return
- [x] As a player, I can move units in line, wedge, box or circle formation with waypoints and rally points, and see them earn veterancy
- [x] As a player, I can switch between the pilot view and a zoomed-out command view with a minimap, build menu, selection panel, alerts and pause-and-plan, and command my fleet from the cockpit

### Life in the Belts
- [x] As a player, I can find living rocks, Bloom clouds, gas pockets and dormant hive nests, and harvest bio-matter at a risk
- [x] As a player, I can fight infection in my crews with quarantine, medical bays, serum, sterilising, purge tenders and vaccine research - or lose an outpost to it
- [x] As a player, I can purge Lattice corruption before it turns my turrets, factories, reactors and units against me
- [x] As a player, I can answer distress calls, clear silent stations and bring survivors home or to my outposts as crew, and reclaim abandoned outposts
- [x] As a player, I can play seasons, a weekly anomaly belt with its own rules, a daily contract streak and weekly contracts, and read the captain's log as the story of the Bloom and the Lattice unfolds

### Progression & Modes
- [x] As a player, I can research a 52-node tech tree in Drilling, Engines, Logistics, Automation, Defense and Science for the ship and Construction, Fortification, Fleet, Biosecurity and Industry for the colony, with immediate effect
- [x] As a player, I can buy licences that open the next belt as my earnings grow
- [x] As a player, I can earn 29 achievements that pay research data
- [x] As a player, I can find and shatter the Crown Heart to complete the career
- [x] As a player, I can play Gold Rush (five minutes, sell at the dock as often as I like) and the seeded Daily Belt with a standard rig
- [x] As a player, I can play Siege: hold a starter outpost through 15 waves with two motherships for a score

### Soundtrack
- [x] As a player, I can hear a 16-bit style soundtrack that stays calm while I mine, grooves while I cruise, tenses up before a wave or an ambush and breaks into battle music when the fighting starts
- [x] As a player, I can hear a heavier boss arrangement while a mothership is in the belt and a short phrase when I win or lose an operation or repel a wave

### Cinematics
- [x] As a player, I can watch an intro of my first launch from Kessler Station
- [x] As a player, I can see a jump sequence when I launch and a warp arrival with the belt's name
- [x] As a player, I can watch my ship dock on autopilot
- [x] As a player, I can see discoveries in slow motion with a close-up and light rays
- [x] As a player, I can see a new belt charted when I buy its licence, and an ending with fireworks and my career statistics
- [x] As a player, I can watch my first outpost founded, my first wave repelled, motherships arriving and falling, my first outbreak and the Lattice waking
- [x] As a player, I can skip any cinematic with a key, click or tap

### Screens & Controls
- [x] As a player, I can navigate every screen with the mouse or the keyboard
- [x] As a player, I can read eight illustrated How to Play pages
- [x] As a player, I can play on a touch screen with a fly stick, an aim-and-drill stick and ability buttons
- [x] As a player, I can resize or maximize the window and keep exact click mapping, with the belt filling the extra space
- [x] As a player, I can have the game pause when the tab is hidden

### Persistence
- [x] As a player, I can keep credits, research, ships, upgrades, modules, licences, the warehouse, the market and statistics across sessions in one save
- [x] As a player, I can keep my old high scores, with starting credits for them
- [x] As a player, I can view and reset a top-10 high score list
- [x] As a player, I can close the game mid-trip and Continue exactly where I was
- [x] As a player, I can load a save from before the outposts and find every site waiting

### Planned Features
- [ ] As a player, I can trade between my outposts with their own prices
- [ ] As a player, I can play the command view fully on a touch screen (taps select and order; there are no touch gestures for box selection or groups yet)

## Controls

| Key | Action |
|-----|--------|
| W / S or Up / Down | Thrust forward / reverse |
| A / D or Left / Right | Turn the ship |
| Right mouse | Fly toward the cursor |
| Left mouse | Drill at the cursor |
| Space | Drill with auto-aim |
| Shift | Boost |
| Q | Scanner pulse |
| C | Seismic charge |
| F | Recall or launch drones |
| Esc / P | Pause |
| Tab | Command view (in flight), next station tab, tree page |
| G / R / E | Fleet: escort me, return, attack where I aim (in flight) |
| Left click / drag | Select units or a building (command view) |
| Right click | Move, attack, escort, mine, repair, rally (Shift queues) |
| Z / X / C / V | Line, wedge, box, circle formation |
| F / Q / E / R / G | Attack-move, patrol, escort, return, hold (command view) |
| 1 / 2 / 3 | Fire hardpoint 1, 2, 3 (pilot view; hold for pulse, flak, missiles, hold and release for the lance) |
| Shift+1-9 | Recall a control group (pilot view) |
| 1-9 / Ctrl+1-9 | Recall / set a control group (command view) |
| Ctrl+A | Select every combat unit |
| Space | Pause and plan (command view) |
| B / U / Delete | Build category / upgrade / demolish (command view) |
| Wheel / + / - | Zoom the command view |
| T / H | Tech tree / How to Play (menus) |
| B | Research the selected node |
| Any key / click | Skip a cinematic |
| F2 | Title screen |

## SEO Keywords

space mining game, asteroid mining browser game, free online mining game, space economy game, mining tycoon, base building game, space real-time strategy, tower defense waves, fleet formations, tech tree, mining drones, ore refining, colony management, space trading game, SynthelicZ game
