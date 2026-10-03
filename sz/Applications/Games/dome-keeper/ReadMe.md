# Product Requirements Document

## Dome Keeper for SynthelicZ Desktop

**Document Status:** v1.2 (world update: day and night, seasons, biomes, drones, relocation)
**Product Type:** Single-player desktop action/strategy game
**Platform:** SynthelicZ Desktop
**Rendering:** HTML5 Canvas
**Input:** Keyboard + mouse, keyboard-only fallback where feasible
**Save/Persistence:** localStorage
**Target Session Length:** 10–25 minutes per run

---

## 1. Product Overview

**Dome Keeper** is a hybrid mine-and-defend game where the player alternates between two tightly linked activities:

1. **Surface defense:** protect a dome from timed enemy attack waves.
2. **Underground mining:** excavate a destructible mine, collect resources, and return them to the dome to purchase upgrades.

The core tension is time allocation. Every second spent mining is a second not spent preparing for the next attack. The player must balance greed, survival, and route planning.

The game is inspired by the loop and tension of *Dome Keeper*, but is scoped for implementation as a 2D canvas game on SynthelicZ Desktop.

---

## 2. Goals

### 2.1 Product Goals

* Deliver a complete, replayable “one more run” gameplay loop.
* Make switching between defense and mining intuitive and fast.
* Create strong feedback through particles, screen shake, glow, and readable UI.
* Keep the game lightweight enough to run well in the SynthelicZ Desktop environment.

### 2.2 Player Experience Goals

The player should feel:

* increasing pressure between waves
* satisfaction from efficient mining routes
* relief when returning to the dome with resources just in time
* visible power growth through upgrades
* punishment for poor planning, but not random unfairness

### 2.3 Non-Goals

The first version does **not** include:

* multiplayer
* procedural biome variety beyond one mine theme
* complex story or campaign mode
* meta-progression between runs
* multiple dome classes
* multiple weapon loadouts
* modding support
* online leaderboard backend

---

## 3. Target Audience

### Primary Audience

Players who enjoy:

* arcade survival games
* tower defense
* resource mining / efficiency planning
* short strategy/action runs

### Player Skill Assumption

* Comfortable with mouse and keyboard
* Familiar with basic real-time game loops
* No prior knowledge of *Dome Keeper* required

---

## 4. Core Gameplay Loop

The loop for a standard run is:

1. The dome lands on a seeded site (biome) and unpacks.
2. By day: go underground and dig toward resource clusters; drones haul cargo home.
3. Spend resources in the upgrade tree (or its quick panel on the surface).
4. Return to the surface before dusk - monsters attack after nightfall.
5. Survive the night (main swarm plus reinforcements); sunlight burns stragglers at dawn.
6. Seasons and weather change the swarm and the conditions every few days.
7. Find the site's Relocation Core deep in the mine; relocate when ready to a new biome with tougher monsters, keeping upgrades and most resources.
8. Lose when dome health reaches zero.

This loop must be understandable within the first 60 seconds of play.

---

## 5. Core Pillars

### 5.1 Tension Through Time

The clock is always relevant: daylight is mining time, nightfall brings the swarm. Mining decisions are constrained by the dusk warning, and seasons stretch or shorten the days.

### 5.2 Risk/Reward Movement

Going deeper yields better resources but increases return time.

### 5.3 Clear State Switching

Surface and underground are distinct modes with a smooth transition and no ambiguity about current state.

### 5.4 Readable Feedback

The player must immediately understand:

* when the dome is under threat
* what resources were collected
* what can be upgraded
* what caused damage or success

---

## 6. User Stories

### Core Gameplay
- [x] As a player, I can alternate between surface defense and underground mining so that I experience the tense mine-and-defend gameplay loop
- [x] As a player, I can see how long the day lasts until nightfall (and get a dusk warning) so that I can decide whether to continue mining or return to the surface
- [x] As a player, I can mine 16 rock strata for rarer resources; each of the six deepest strata brings its own ore, so that deeper mining is more rewarding but riskier in time cost
- [x] As a player, I can carry resources back to the dome deposit zone to add them to storage so that resource delivery requires physical effort
- [x] As a player, I can survive endless nights across many landing sites until my dome HP reaches zero so that the game is an endless survival challenge

### Surface Defense
- [x] As a player, I can aim the dome turret with mouse tracking and click to fire along the aim direction so that combat is manual and skill-based
- [x] As a player, I can use keyboard (Left/Right or A/D) to rotate the turret as a fallback so that keyboard-only play is possible
- [x] As a player, I can benefit from aim-assist that snaps fired shots to nearby enemies along the aim ray so that aiming is helpful without removing agency
- [x] As a player, I can see laser glow trails and impact sparks when shooting so that weapon fire feels impactful

### Underground Mining
- [x] As a player, I can move the miner with WASD/Arrow keys to dig adjacent tiles so that mining uses keyboard controls
- [x] As a player, I can click tiles to navigate underground via BFS pathfinding so that mouse-based navigation is also supported
- [x] As a player, I can mine different tile types (dirt, hard rock, ore) requiring different mining times so that not all tiles are equal
- [x] As a player, I see a progress bar while mining a block that shows how long until it breaks so that mining feels deliberate
- [x] As a player, deeper blocks take longer to mine (depth scaling) so that deep mining requires commitment
- [x] As a player, excess resources drop on the ground when my inventory is full so that I can return for them later
- [x] As a player, I can pick up dropped resources by walking over them so that nothing is permanently lost
- [x] As a player, I can see mining debris particles, dust clouds, and floating text on tile destruction so that mining has visual feedback
- [x] As a player, I can see an animated miner with pickaxe swing, idle bob, and directional facing so that the character feels alive

### Enemy System
- [x] As a player, I face eleven monster types: walkers, swarmer packs, flyers, armored crawlers, divers, burrowers, acid spitters, splitters, menders and the Behemoth and Hive Queen bosses, each with its own animated sprite, behaviour and sounds
- [x] As a player, I see the mix of monsters change with the threat level, the season, the weather and the moon, so that nights do not feel identical
- [x] As a player, I can face shielded monsters as the threat grows so that shield-breaking adds tactical depth
- [x] As a player, I can hover a monster to read its name, behaviour, HP, shield, armor and damage

### Night Attacks
- [x] As a player, monsters attack at nightfall with reinforcements later in the night so that daytime is for mining and building
- [x] As a player, I get a dusk warning 15 seconds before nightfall, on the surface and in the mine
- [x] As a player, I see full-moon nights bring bigger swarms and new-moon nights calmer ones
- [x] As a player, monsters still out at dawn burn in the sunlight (bosses resist)

### Upgrade System
- [x] As a player, I buy every upgrade in one tree with five branches (Dome, Mining, Movement, Weapon, Drones) so that there is a single upgrade path
- [x] As a player, I can use the Next upgrades panel on the surface, which shows the next node of every branch with the tree's cost and state colours, to buy it with a click or open the tree on it
- [x] As a player, I find Drill Speed, Blast Mining, Scanner, Echo Location and Ground Radar in the Mining branch where they belong
- [x] As a player, my old quick-panel levels from earlier saves carry over as owned tree nodes

### Upgrade Tree Dialog
- [x] As a player, I can press U on the surface to open a full-screen upgrade tree overlay so that I see all available upgrades organized as a branching node graph
- [x] As a player, I can see five upgrade branches (Dome, Mining, Movement, Weapon, Drones) arranged as visual trees with parent-child node connections so that upgrade paths are clear
- [x] As a player, I can see each upgrade node with name, icon, cost (in iron/cobalt/water), current level, and max level so that I know exactly what each upgrade offers and costs
- [x] As a player, I can see available (affordable + prerequisites met) upgrades highlighted with bright borders and full opacity so that purchasable upgrades stand out
- [x] As a player, I can see locked upgrades (prerequisites not met) grayed out with a lock icon and dashed border so that I understand the prerequisite chain
- [x] As a player, I can see purchased/maxed upgrades with green checkmarks and green borders so that completed upgrades are visually distinct
- [x] As a player, I can see affordable but prerequisite-locked upgrades with orange borders so that I know which upgrades I could buy if only the chain were met
- [x] As a player, I can click an available upgrade node to purchase it with specific resource costs (iron, cobalt, water) so that upgrades use differentiated resource requirements
- [x] As a player, I can press U or Escape to close the upgrade dialog so that returning to gameplay is quick
- [x] As a player, the game pauses while the upgrade dialog is open so that I can plan upgrades without time pressure
- [x] As a player, I can see my current iron, cobalt, and water totals at the top of the dialog along with total upgrades purchased vs available so that resource planning is informed
- [x] As a player, I can scroll the upgrade tree if it extends beyond the screen so that all nodes remain accessible
- [x] As a player, I can switch between the whole tree and a single branch with tabs (click, Tab / Shift+Tab or 1-6) so that each branch is shown at a readable size
- [x] As a player, I can zoom smoothly with the mouse wheel or +/-, drag the tree with the left or right mouse button and press 0 to fit the current tab so that navigating a large tree is easy
- [x] As a player, I can select upgrades with the arrow keys or WASD and buy the selected one with Enter or Space so that the tree works without a mouse
- [x] As a player, I can see the tier of each upgrade chain as pips and a roman numeral, with connectors routed between the cards, so that progress along a chain is clear
- [x] As a player, I can see that basic upgrades cost iron only, advanced ones rarer ores, and the top tiers the deep-strata ores (titanium, sapphire, uranium, amethyst, fire opal, voidstone) so that deeper resource types are more valuable

### Gadget System
- [x] As a player, I can select one of four primary gadgets at game start (Shield Generator, Repellent Field, Orchard, Droneyard) so that each run has a unique strategic tool
- [x] As a player, I can discover 6 mine gadgets hidden in 2x2 golden chambers underground (Auto Cannon, Stun Laser, Blast Mining, Probe Scanner, Dome Armor, Condenser) so that exploration is rewarded with permanent run bonuses
- [x] As a player, I can press B to use Blast Mining charges to destroy a 3x3 area so that I can quickly clear large sections
- [x] As a player, I can press R to activate Repellent Field to slow all enemies to 40% for 5 seconds so that I have an emergency defense tool

### Unlockable Tool/Gadget System
- [x] As a player, I unlock the five tools (Drill Gadget, Blast Mining, Scanner, Reinforced Dome, Teleporter) as nodes of the upgrade tree
- [x] As a player, I can press number keys 1-5 to select or activate unlocked tools so that tool access is quick and intuitive
- [x] As a player, I can see active tool indicators in both the surface and underground HUD so that I always know which tools are available and their cooldown status

### Drones
- [x] As a player, I can buy a Drone Bay so that a courier drone flies through my tunnels to the keeper, takes the cargo home and picks up loose ore
- [x] As a player, I can upgrade drone thrusters (speed, pickup radius) and cargo, and add Mining Lasers so that couriers mine exposed ore near the keeper
- [x] As a player, I can add gun drones that guard the dome and a repair drone that welds it
- [x] As a player, I can add couriers with Drone Swarm; the Droneyard gadget gives a free courier and makes drones 50% faster

### World, Biomes and Weather
- [x] As a player, every run and every relocation lands on a seeded biome (Rocky Badlands, Dune Sea, Frozen Shelf, Alien Jungle, Ashen Caldera, Crystal Fields) with its own sky, mountains, ground, plants, weather odds and ore mix
- [x] As a player, I see the sun cross the sky by day and the moon by night through eight phases, with a day counter in the HUD
- [x] As a player, I live through four-day seasons: spring blossoms (more but weaker monsters), long summer days (faster monsters), autumn leaves and storms, and winter snow (short days, few but tough monsters)
- [x] As a player, I see rain, snowfall, blizzards (poor sight, slow monsters, a stiff turret), thunderstorms whose lightning hits monsters and sometimes the dome, and meteor showers that blast monsters and leave ore to collect
- [x] As a player, I get every change of season and weather announced and shown in the HUD

### Sites and Relocation
- [x] As a player, I see the dome descend on thrusters and unpack at the start of every run
- [x] As a player, I can find the site's Relocation Core in the lower strata (scanners point toward it)
- [x] As a player, I can press Relocate (or L) once the core is found, confirm, and watch the dome pack up, lift off, fly over the planet map and land on a new site
- [x] As a player, I keep all upgrades, drones and gadgets plus 75% of my resources; each new site starts 4 threat levels higher and its monsters are tougher
- [x] As a player, I can skip the landing and flight with a click, Space or Esc

### Visual Effects
- [x] As a player, I can see dome hit feedback with screen shake, flash, and shield impact arcs so that dome damage is immediately obvious
- [x] As a player, I can see resource reveal glow and ambient tile sparkles underground so that valuable tiles stand out
- [x] As a player, I can see a surface parallax starfield background so that the surface scene has atmospheric depth
- [x] As a player, I can see smooth scene transition animation between surface and underground so that switching views is seamless
- [x] As a player, I can see animated enemy sprites with damage flash effects so that enemies react visually to hits

### Tutorial and Persistence
- [x] As a player, I can see a 9-page help on first launch explaining the controls, day and night, seasons and weather, monsters, upgrades, drones, relocation, gadgets and tools so that I understand the game loop quickly
- [x] As a player, I can press H to toggle the tutorial overlay at any time so that I can review instructions
- [x] As a player, I can have my tutorial completion and high scores (top 5) persisted via localStorage so that my progress is remembered

### UI and Integration
- [x] As a player, I can pause with Escape and restart with F2 so that runs are easy to control and retry
- [x] As a player, I can toggle between surface and underground with Space or Tab so that view switching is quick
- [x] As a player, I can see dome HP bar, day and time, season, moon phase, weather, site, threat, resource totals and score in the HUD so that critical info is always visible
- [x] As a player, I can see the window title update and the canvas scale responsively within the desktop container so that the game integrates with the SZ OS

### Planned Features
- [ ] As a player, I can upgrade weapon range so that my turret can hit enemies from farther away
- [x] As a player, I can upgrade miner move speed so that underground traversal is faster
- [x] As a player, I can encounter multiple biomes with distinct aesthetics so that runs have visual variety
- [ ] As a player, I can enter a seed to replay a specific run

---

## 7. Game Modes

### 7.1 Included in v1

* **Standard Run**: endless progression across landing sites until dome destruction

### 7.2 Excluded from v1

* challenge modifiers
* player-chosen seeds (sites are seeded internally)
* daily runs
* story mode

---

## 8. Functional Requirements

## 8.1 Game States

The game must support these states:

1. **Boot**
2. **Main Menu**
3. **Tutorial Overlay**
4. **In Run**
5. **Paused**
6. **Game Over**
7. **High Scores View**

### Acceptance Criteria

* Player can reach a run from the main menu in one action.
* Pause freezes wave timers, enemy motion, mining actions, particles except optional UI animation.
* Game Over appears immediately when dome HP reaches 0.
* Restart begins a fresh run with no state leakage.

---

## 8.2 Core Scenes

The game has two primary play scenes:

### Surface Scene

Shows:

* dome at ground level
* approaching enemies
* sky/background
* current wave timer / wave status
* dome HP
* weapon fire / impacts

### Underground Scene

Shows:

* destructible mine grid
* player miner
* carried resources
* path to surface
* resource nodes and mined tunnels

### Transition Requirement

Switching between surface and underground must use a smooth animated slide transition lasting **250–400 ms**.

### Acceptance Criteria

* Transition never blocks input for longer than animation duration.
* Current game simulation state remains consistent during transition.
* Player always knows which scene is active.

---

## 8.3 Player Character

The player controls a miner unit underground.

### Behavior

* Moves in 4 directions: left, right, up, down.
* Cannot pass through solid tiles unless digging through them.
* Can carry resources physically back to the dome.
* Has upgradeable movement/drill capability.

### Initial Stats

* Move speed: baseline value tuned so crossing starting mine area takes about 4–6 seconds
* Drill speed: slow enough that early expansion feels deliberate
* Carry capacity: 1 large resource unit or equivalent small stack
* Health: not applicable unless underground hazards are later introduced; in v1 only dome health matters

### Acceptance Criteria

* Movement feels responsive with no input lag beyond normal frame latency.
* Miner animation reflects movement direction.
* Carrying resources is visually obvious.

---

## 8.4 Underground Mining System

The underground is a tile grid of **165 columns x 224 rows** (40 px tiles): sixteen rock strata of 14 rows each, every one spanning the full width.

### Strata

| # | Stratum | Depth (rows) | Typical ores |
| -: | ------- | ------------ | ------------ |
| 1 | Sand | 0-13 | iron, copper |
| 2 | Loose Soil | 14-27 | iron, coal |
| 3 | Dirt | 28-41 | iron, copper, tin |
| 4 | Packed Dirt | 42-55 | water, coal |
| 5 | Clay | 56-69 | lead, silver |
| 6 | Gravel | 70-83 | water, cobalt |
| 7 | Soft Stone | 84-97 | silver, quartz |
| 8 | Stone | 98-111 | cobalt, gold |
| 9 | Hard Stone | 112-125 | cobalt, gold |
| 10 | Bedrock | 126-139 | quartz, emerald |
| 11 | Slate | 140-153 | **titanium** |
| 12 | Granite | 154-167 | **sapphire** |
| 13 | Basalt | 168-181 | **uranium** |
| 14 | Obsidian | 182-195 | **amethyst** |
| 15 | Magma Rock | 196-209 | **fire opal** |
| 16 | Abyssal Core | 210-223 | **voidstone** |

* The classic ores keep their depth curves over the upper ten strata and thin out below; each of the six deep strata adds its own ore.
* The deep strata have their own textures: slate cleavage, granite flecks, basalt columns, obsidian glints, magma fissures and abyssal veins.
* Each stratum starts with a jagged seam where the layer above reaches down.
* Mining time rises with every row (x0.5 at the surface to about x5 at the core) and per tile type; deep ores are the hardest.
* Ore found deeper is richer: up to +60% yield at the bottom.
* The site's biome biases the ore mix (e.g. gold in the Dune Sea, water in the Frozen Shelf).
* 10-14 gadget chambers are spread over all depths; the site's **Relocation Core** hides in the lower strata (see 8.17).

### Mining Rules

* Player must dig adjacent solid tiles to create tunnels.
* Different tile types require different mining time.
* Destroyed solid tiles become empty tunnel tiles.
* Ore is credited when mined; the carried amount is limited by the cargo capacity and freed when the keeper (or a courier drone) brings it home. Overflow drops on the ground.

### Acceptance Criteria

* Mining a tile always provides visible feedback: hit effect, debris, sound hook, or progress cue.
* Destroyed tiles are permanently removed for the duration of the site.
* Generation of the whole mine takes about 10 ms; rendering is culled to the visible tiles.

---

## 8.5 Resource System

### Resource Types

Twenty resources, each with its own pixel-art icon, colour and HUD counter:

* **Common**: iron, copper, tin, coal, water
* **Precious**: lead, silver, cobalt, gold, quartz, redstone
* **Gems**: emerald, diamond, ruby
* **Deep ores** (one per deep stratum): titanium (Ti), sapphire (Sa), uranium (U), amethyst (Am), fire opal (Op), voidstone (Vd)

### Requirements

* Each resource has a distinct colour, icon and pickup visual.
* Rarity is visible in map distribution and upgrade requirements: the top tiers of the upgrade chains and the late drone nodes cost deep ores.
* Meteor showers drop chunks of ore on the surface (iron to sapphire) that are collected with a click or by a docked courier drone.

### Acceptance Criteria

* Resource requirements for upgrades are understandable at a glance.
* The mine HUD lists every collected resource in two columns; the upgrade tree header shows all twenty.

---

## 8.6 Dome Defense System

The dome is the object the player protects.

### Dome Properties

* Has HP
* Sits on ground level, centered horizontally
* Can be upgraded
* Is destroyed when HP reaches 0

### Combat Behavior (Implemented)

The dome weapon uses manual aiming with assisted targeting.

#### Turret Weapon

* Turret sits atop the dome at its highest point
* **Mouse aiming**: turret barrel continuously tracks the mouse cursor
* **Keyboard aiming**: Left/Right or A/D rotate the barrel
* **Click to fire**: player clicks to fire a laser shot along the turret's aim direction
* **Aim assist**: fired shots snap to the nearest enemy within a cone along the aim ray (40px radius at target, 30px perpendicular corridor)
* Fire rate is upgradeable; cooldown between shots equals `1 / fireRate`
* Turret angle is clamped to the upper hemisphere plus ~23 degrees below horizontal, allowing shots at ground-level enemies

### Player Input on Surface

* Mouse position continuously aims the turret barrel
* Click fires toward current aim direction with aim-assist snapping
* Keyboard arrows or A/D rotate the turret when mouse is unavailable

### Acceptance Criteria

* Turret aiming is responsive and intuitive with both mouse and keyboard.
* Aim-assist provides helpful snapping without removing player agency.
* Dome damage feedback is strong: hit flash, screen shake, HP change, shield impact arcs.

---

## 8.7 Enemy System

Monsters attack at night.

### Roster

| Monster | Moves | First threat | Behaviour |
| ------- | ----- | -----------: | --------- |
| Walker | ground | 0 | Plods to the dome and bites it |
| Swarmer | ground | 2 | Tiny, fast, spawns in packs of 3-6 |
| Flyer | air | 3 | Flies straight at the dome |
| Armored Crawler | ground | 4 | Armor plates soak part of every hit (at least a quarter gets through) |
| Diver | air | 5 | Circles high, then dives at the dome and climbs back |
| Burrower | underground | 6 | Travels hidden as a moving dirt mound, pops up beside the dome; cannot be targeted while hidden |
| Spitter | ground, ranged | 7 | Stops about 330 px out and lobs acid globs; its sac swells before each shot |
| Splitter | ground | 8 | Bursts into three swarmers when killed |
| Mender | ground | 9 | Regenerates and heals monsters around it |
| Behemoth (boss) | ground | 10 | Huge, armored; stomps shockwaves that roll into the dome |
| Hive Queen (boss) | air | 15 | Hovers over the field dropping swarmers; dives in when wounded |

* Every type has its own code-drawn animated sprite (legs, wings, mandibles, sacs, crystals, crowns), hit flash, death effect in its colour and sounds.
* Shields appear on monsters from threat 11; bosses always carry one.
* Hovering a monster shows its name, behaviour, HP, shield, armor and damage.

### Spawn Rules

* Ground monsters come from the left and right edges, flyers from the upper sky, burrowers underground.
* The **threat level** is the number of nights at the current site plus 4 per relocation; it sets HP, damage, speed and which types may appear. Every relocation also multiplies HP by +30% and damage by +20%.
* The night's budget grows with the threat and is scaled by the moon (x0.8 new moon .. x1.25 full moon) and the season.
* The mix is weighted by season (spring: swarmers and splitters; summer: flyers, divers, spitters; autumn: burrowers, menders; winter: crawlers and menders) and weather (blizzards favour burrowers, storms ground the flyers).
* A boss comes every fifth night at a site once the threat reaches 10.

### Acceptance Criteria

* Monster silhouettes are distinguishable at gameplay speed.
* Spawn direction is readable.
* Difficulty increase comes from count, speed, HP, composition, or damage scaling.

---

## 8.8 Night Attacks (Wave System)

### Structure

* A day lasts 160 s; the share of daylight depends on the season (spring 60%, summer 70%, autumn 55%, winter 45%).
* The main swarm arrives at nightfall; reinforcements (about 45% of the main swarm, no boss) follow at 40% and 72% of the night.
* A dusk warning (banner and horn) sounds 15 s before nightfall; the HUD clock turns red.
* At dawn monsters still in the open burn away (7% of their HP per second in full daylight); bosses resist.

### Scaling (per night, before season and moon)

* Base HP 8 + 3 per threat level, damage 2 + 0.8 per level, speed 15 + 2 per level (capped at +25)
* Budget min(24, 2 + 0.8 x threat) monster units

### Acceptance Criteria

* Player can anticipate an incoming attack from the clock, the dusk warning and the setting sun.
* Attack start and end are unambiguous (banners for nightfall, reinforcements and a beaten swarm).
* Difficulty increase is noticeable but not a vertical brick wall.

---

## 8.9 Upgrade System

### Access

* **Next upgrades panel**: on the surface (top right) one row per branch shows the best next node - the cheapest one you can buy, otherwise the unlocked one closest to affordable - with the tree's card colours and cost row. Clicking buys it; a node you cannot afford yet opens the tree focused on it. A button (or **U**) opens the full tree.
* **Full upgrade tree**: press **U** on the surface to open the full-screen tree with five branches.
* Game pauses while the upgrade tree dialog is open; **U** or **Escape** closes it.

There is only one upgrade path: the panel is a view of the tree. Saves from before kept separate quick-upgrade levels; on loading they become the first nodes of the matching chain (e.g. Weapon Damage level 2 owns Damage I and II).

### Branches

| Branch | Nodes | Content |
| ------ | ----: | ------- |
| Dome | 25 | Shield capacity and recharge chains, regen, auto-repair, reinforced dome, expansion, energy shield, reflect, emergency shield, fortified base, last stand |
| Mining | 39 | Mining tools, carry capacity, **drill speed**, magnet, fortune, silk touch, ore detector, speed mining, auto-mine, tunnel bore, vein miner, **Blast Mining, Scanner, Echo Location, Ground Radar** |
| Movement | 19 | Move speed, teleporter (+cooldown), jetpack (+fuel), phase shift, double jump, wall climb, dash |
| Weapon | 27 | Fire rate, damage, turret speed, chain lightning, freeze ray, plasma cannon, multi-shot, homing, critical hit, explosive rounds |
| Drones | 18 | See 8.18 |

Drill Speed, Blast Mining and Scanner used to sit in the Weapon branch and Echo Location / Ground Radar in Movement; they are mining tools and live in the Mining branch now.

### Upgrade Rules

* Nodes have specific resource costs; the top tiers need deep-strata ores.
* Prerequisites must be met before child nodes unlock; purchases apply immediately.
* Cards show tier pips and a roman numeral, cost (green when affordable, red when not), and state: owned, can buy, need resources, locked.

### Acceptance Criteria

* Buying an upgrade gives instant visible/mechanical effect.
* Player can understand why an upgrade is locked or unavailable.
* The panel never offers a different upgrade than the tree.

---

## 8.10 Gadget System (Implemented)

### Primary Gadgets

At game start, the player selects one of four primary gadgets from a card-style selection screen:

| Gadget            | Key | Effect                                                        |
| ----------------- | --- | ------------------------------------------------------------- |
| Shield Generator  | --  | Absorbs the first hit of each night; recharges at nightfall    |
| Repellent Field   | R   | Slows all enemies to 40% for 5 seconds (30s cooldown)         |
| Orchard           | --  | Grows fruit periodically; click tree to gain speed boost       |
| Droneyard         | --  | A free courier drone from the start; all drones work 50% faster |

### Mine Gadgets

Six gadgets are hidden in 2x2 golden chambers scattered underground. Mining into a chamber activates the gadget permanently for the run:

| Gadget         | Effect                                                              |
| -------------- | ------------------------------------------------------------------- |
| Auto Cannon    | Secondary turret on top of the dome; auto-fires at monsters          |
| Stun Laser     | Periodically stuns the nearest enemy for 2 seconds                   |
| Blast Mining   | Press B to destroy a 3x3 area around the miner (limited charges)     |
| Probe Scanner  | Reveals resource types (and the Relocation Core) nearby              |
| Dome Armor     | Adds +50 to maximum dome HP                                         |
| Condenser      | Generates +5 water every 30 seconds automatically                    |

### Tools

The five tools are nodes of the upgrade tree and keep their number keys:

| Tool             | Key | Branch | Effect |
| ---------------- | --- | ------ | ------ |
| Drill Gadget     | 1   | Mining | 30% faster when mining consecutive same-column tiles downward |
| Blast Mining     | 2   | Mining | Clears 3x3 area around the miner. Costs 10 iron per use, 5s cooldown |
| Scanner          | 3   | Mining | Passive: reveals resources within 3 tiles and points toward the Relocation Core |
| Reinforced Dome  | 4   | Dome   | Passive: dome takes 25% less damage |
| Teleporter       | 5   | Movement | Instantly return to the dome surface. 30s cooldown |

---

## 8.11 HUD and UI

### Must Display During Run

* Dome HP bar
* Day counter, time until nightfall or dawn, monsters attacking
* Season (day x of 4), moon phase and weather
* Site number, biome, threat level and Relocation Core status
* Current resource totals and score
* Pause state when paused

### Surface HUD

* Top left: clock panel (sun or moon dial, day, season chip, time meter, moon phase, weather); the Relocate button below it once the core is found
* Top right: score, resources, site, threat, core status; the Next upgrades panel below
* Bottom: dome integrity, gadget and drone status, key hints
* Centre top: announcement banners (nightfall, dawn, seasons, weather, bosses, relocation)

### Underground HUD

* Collected resources (two columns), cargo, depth and stratum
* Time line (turns red near dusk and at night)
* Tool and courier drone status

### Tutorial Overlay (Implemented)

* Nine-page guide shown on first launch:
  1. **How to Play**: controls and the day/night loop
  2. **Day & Night**: nightfall, moon phases, reinforcements, dawn
  3. **Seasons & Weather**: what each season and weather does, meteor ore
  4. **Monsters**: the roster and the bosses
  5. **Upgrades & Tips**: the single tree and the Next upgrades panel
  6. **Drones**: couriers, mining lasers, gun and repair drones
  7. **Relocation**: the Relocation Core, carry-over rules
  8. **Gadgets**: primary gadget selection, mine gadget chambers, activation keys
  9. **Tools**: tree tools and keyboard shortcuts 1-5
* Toggle with **H**
* Persist completion / dismissal with localStorage

### Acceptance Criteria

* Critical info remains readable at all times.
* Health/resource bars use distinct shapes/colors and labels.
* Tutorial can be revisited without restarting the game.

---

## 8.12 Scoring and High Scores

### Score Inputs

Score is based on:

* monsters killed (scaled by night and monster type)
* a relocation bonus of 500 x site number

### Game Over Summary

Show:

* nights survived and sites visited
* total score
* key stats:

  * resources mined
  * enemies destroyed
  * upgrades purchased
  * time survived

### Persistence

* Store local leaderboard in localStorage
* Keep top 10 runs
* Sort by score descending
* Resolve ties by higher wave, then more recent run

### Acceptance Criteria

* Scores persist across reloads.
* Corrupt or missing localStorage data fails safely and resets.

---

## 8.13 Audio Hooks

Even if full audio is not implemented yet, the architecture must support events for:

* mining hit
* tile break
* resource pickup
* resource deposit
* weapon fire
* enemy hit
* dome hit
* wave start
* wave end
* upgrade purchase
* game over

This matters because otherwise the code becomes an IIFE swamp with regret baked in.

Sounds use `SZ.GameAudio`: named effects per monster type (pitch-shifted deaths, mandible clicks, armor clanks, dive whistles, burrower thumps, acid spits), plus synthesized tones for the dusk horn, thunder, the queen's screech and the landing / lift-off thrusters.

---

## 8.14 Biomes

Every site gets a biome from its seed (a relocation never lands in the same biome twice in a row):

| Biome | Mountains | Plants | Sky decoration | Weather | Ore bias |
| ----- | --------- | ------ | -------------- | ------- | -------- |
| Rocky Badlands | jagged ridges | alien grass | ringed gas giant | balanced | iron, tin, titanium |
| Dune Sea | flat-topped mesas | cacti | - | dry, meteors | gold, copper, quartz (less water) |
| Frozen Shelf | snow-capped peaks | ice spikes | aurora at night | snow, blizzards | water, silver, sapphire |
| Alien Jungle | rolling hills | ferns | giant planet | rain, storms | emerald, copper, coal, uranium |
| Ashen Caldera | smoking volcano with glowing crater | ember vents | - | storms, meteors | redstone, ruby, coal, fire opal |
| Crystal Fields | crystal spires | glowing shards | shattered moon | balanced | quartz, diamond, amethyst, cobalt |

Each biome has day, dusk and night skies, mountains and ground painted once into offscreen canvases and blended by the time of day.

## 8.15 Day, Night and the Moon

* The sun rises on the left and sets on the right; the moon follows at night.
* Eight moon phases (one per day) drawn with lit crescent/gibbous shapes; the phase scales the night's swarm.
* Dawn and dusk tint the sky; stars, nebula and the biome's decoration fade with daylight.

## 8.16 Seasons and Weather

| Season | Days | Daylight | Swarm | Visuals |
| ------ | ---- | -------: | ----- | ------- |
| Spring | 1-4 | 60% | x1.45 count, x0.7 HP, smaller | blossoms on the plants |
| Summer | 5-8 | 70% | x1.15 speed | heat haze |
| Autumn | 9-12 | 55% | x1.1 count and HP | falling leaves, plants turn orange |
| Winter | 13-16 | 45% | x0.6 count, x1.75 HP, x1.3 damage | snow on the ground and the dome, frosted plants |

Weather (weighted by season and biome, 30-60 s each, announced on change):

* **Rain**: darker sky, splashes, monsters 10% slower
* **Snowfall**: snow piles up on the ground and dome and slows walkers
* **Blizzard**: white-out fog, monsters 30% slower, turret turns 40% slower and fires 25% slower
* **Thunderstorm**: lightning every few seconds strikes monsters (damage and stun), occasionally the dome
* **Meteor shower**: meteors blast monsters near the impact, sometimes hit the dome and leave ore chunks to collect

## 8.17 Sites and Relocation

* A run starts with the dome descending on thrusters, touching down in a cloud of dust and unpacking (legs, glass shell, turret, lights). Click, Space or Esc skips it.
* Each mine hides a **Relocation Core** in strata 7-8 on the first site (one stratum deeper per relocation). It looks like rock until the keeper is next to it, a Scanner is in range or a Probe Scanner reveals it; further away the scanner shows an arrow toward it.
* Mining the core shows the **Relocate** button (key **L**). It is disabled while monsters attack or more are coming that night, with the reason shown.
* After confirming: pack up, lift off, flight across the planet map, landing and unpacking on the new site.
* Carry-over: upgrades, drones, gadgets and score stay; 75% of every resource comes along; the dome is repaired; the new site is a new biome with a new mine and core. The threat restarts at the new site's baseline, 4 higher per relocation, and climbs again night by night.
* A save taken during the flight finishes the landing on Continue; otherwise Continue never replays it.

## 8.18 Drones

| Node | Effect |
| ---- | ------ |
| Drone Bay | A courier drone flies through the tunnels to the keeper, takes the cargo home and collects loose ore |
| Drone Thrusters I-III | +30% flight speed and +1 tile pickup radius per level |
| Drone Cargo I-III | +15 cargo per level (15 base) |
| Mining Laser I-III | Couriers laser-mine exposed ore within 4 (+2 per level) tiles of the keeper |
| Gun Drone I-III | A drone guarding the dome; level 2 hits harder and faster, level 3 adds a second gun drone |
| Repair Drone I-III | Welds the dome back together (0.5 HP/s, +0.45 per level) |
| Drone Swarm I-II | +1 courier each |

Couriers follow BFS paths through the tunnels, carry their own lights and show their cargo; idle couriers hover beside the dome. The mine HUD lists every courier's job.

## 8.19 Persistence

* The run is saved as `sz-dome-keeper-save-v2` (autosave every 5 s of play, on pause, page hide and key moments).
* Saves contain the site (seed, biome, index), the mine, the Relocation Core, world time, weather, snow, meteor ore and whether a landing is in progress.
* A `sz-dome-keeper-save-v1` run is migrated on Continue: upgrades, quick-panel levels (as tree nodes), tools, gadgets, resources, score and the night count are kept; the mine is generated anew for the bigger grid. Unreadable saves are discarded with a notice, never crashing the game.

---

## 9. Visual Requirements

## 9.1 Art Direction

Readable pixel-art or stylized 2D rendering with bright effects over a dark sci-fi environment.

### Surface

* parallax starfield
* ground line with depth and texture
* dome rendered as metallic structure with visible damage states

### Underground

* darker cave palette
* textured tiles
* ore glow/sparkle
* visible tunnel contrast

---

## 9.2 Effects Requirements

### Required Feedback Effects

* laser glow trail
* impact sparks
* mining debris particles
* dust cloud on block destruction
* resource pickup pop
* floating damage/resource text
* dome hit screen shake
* subtle camera or viewport feedback on major impacts

### Acceptance Criteria

* Effects enhance readability, not obscure gameplay.
* Screen shake duration must be brief and not nauseating.
* Effects performance must remain stable under wave load.

---

## 9.3 Animation Requirements

* Miner movement animation
* enemy movement animation
* dome damage feedback animation
* transition animation between scenes
* resource sparkle/idle effect
* optional firing/recoil animation for dome weapon

---

## 10. Controls

## 10.1 Implemented Control Scheme

| Input                        | Action                                              |
| ---------------------------- | --------------------------------------------------- |
| WASD / Arrow Keys            | Move miner / mine adjacent tile underground         |
| Mouse Click (underground)    | Click tile to navigate via BFS pathfinding           |
| Mouse Click (surface)        | Fire turret weapon along aim direction               |
| Mouse Move (surface)         | Continuously aim turret barrel toward cursor          |
| Left/Right or A/D (surface)  | Keyboard turret rotation                             |
| Space / Tab                  | Toggle surface / underground                         |
| U                            | Open/close full-screen upgrade tree dialog (surface) |
| Tab / Shift+Tab, 1-6 (tree)  | Switch upgrade tree tab (All, Dome, Mining, ...)     |
| Arrows / WASD (tree)         | Select an upgrade card                               |
| Enter / Space (tree)         | Buy the selected upgrade                             |
| Wheel, + / - (tree)          | Zoom the upgrade tree; 0 fits the current tab        |
| Drag (tree)                  | Pan the upgrade tree (left or right mouse button)    |
| R                            | Activate Repellent Field gadget (if available)        |
| B                            | Use Blast Mining charge (if available)                |
| 1                            | Select Drill Gadget tool (if unlocked)               |
| 2                            | Activate Blast Mining tool (if unlocked)             |
| 3                            | Scanner status (passive, if unlocked)                |
| 4                            | Reinforced Dome status (passive, if unlocked)        |
| 5                            | Activate Teleporter (if unlocked)                    |
| L                            | Relocate (after finding the Relocation Core)         |
| Shift + direction            | Dash through tunnels (after buying Dash)             |
| Click (surface ore chunk)    | Collect meteor ore                                   |
| Click / Space / Esc          | Skip the landing or relocation sequence              |
| Enter / Esc (confirmation)   | Lift off / stay                                      |
| Escape                       | Pause / Resume                                       |
| H                            | Toggle tutorial overlay                              |
| F2                           | Start new run / restart from menu or game over       |

### Input Model

* **Underground**: dual input -- keyboard movement (WASD/arrows move into adjacent tiles, automatically mining diggable tiles) and mouse click-to-navigate via BFS pathfinding. Clicking a diggable tile adjacent to the path destination queues a mine action on arrival.
* **Surface**: manual turret aiming with mouse tracking and click-to-fire. Aim-assist snaps to nearby enemies along the aim ray. Keyboard fallback via arrow keys or A/D for turret rotation.

---

## 11. Technical Requirements

## 11.1 Architecture

* JavaScript IIFE pattern under `window.SZ`
* Modular internal systems for:

  * game state
  * rendering
  * input
  * entity management
  * wave manager
  * mine generation
  * upgrades
  * persistence
  * effects

### Shared Libraries

* `menu.js`
* `dialog.js`
* `game-effects.js`

  * `ParticleSystem`
  * `ScreenShake`
  * `FloatingText`

### OS Integration

* `SetWindowText`
* `RegisterWindowProc`

  * `WM_SIZE`
  * `WM_THEMECHANGED`

### Persistence Prefix

* `sz-dome-keeper-`

---

## 11.2 Rendering

* Canvas-based rendering
* Base logical resolution: **700x500**
* Must scale using `devicePixelRatio`
* Canvas maximizes to fill parent container on resize

### Acceptance Criteria

* No major blurring on high-DPI displays beyond chosen art style
* Letterboxing or scaling behavior is intentional and consistent
* Resize does not corrupt gameplay state

---

## 11.3 Performance

Target:

* 60 FPS on typical SynthelicZ Desktop target hardware
* No major frame drops during moderate particle effects and mid-game wave load

### Performance Constraints

* Particle counts should be capped
* Offscreen entities may use simplified update logic
* Mine rendering should avoid unnecessary full-grid recomputation each frame

---

## 12. Mine Generation Requirements

Your draft says “grid” and “resource types,” but not how the mine is laid out. That leaves engineering inventing the game.

### Generation Rules

* The mine is generated from the site's seed when the dome lands
* Entry point at top center below dome
* Ore veins grow from seed cells; type weights follow depth, stratum and biome
* Every deep stratum is dominated by its signature ore
* 10-14 gadget chambers, one per depth band
* One Relocation Core in the lower strata
* No impossible-to-reach enclosed mandatory areas (everything is diggable)

### Acceptance Criteria

* Early game always has reachable iron within short distance
* At least one medium-value cluster appears before dangerous depth
* Deep mining is meaningfully rewarded

---

## 13. Balancing Requirements

Exact numbers can be tuned later, but the game must satisfy these balancing goals:

### Early Game

* The first day gives about 90 seconds of daylight before the first night
* Night 1 is a new-moon spring night: two or three walkers; swarmers appear from night 2
* Player can survive the first nights without upgrades if they return in time
* First upgrade can be purchased after a short successful mining trip

### Later Sites

* Every site starts 4 threat levels above the previous site's start, with monsters 30% tougher and 20% harder hitting per relocation, so later sites ramp up quickly
* Staying at a site keeps raising the threat one night at a time; relocating restarts that climb from the next site's higher baseline, so leaving trades 25% of the resources and a harder baseline for a fresh mine and a reset of the nightly climb

### Mid Game

* Player must choose between weapon survivability and mining efficiency
* Deeper nodes become necessary for optimal scaling

### Failure Curve

* Most first-time players should understand the loop before losing
* Loss should usually be attributable to:

  * staying underground too long
  * weak upgrade choices
  * poor resource routing

Not:

* unreadable enemy behavior
* sudden unfair damage spikes
* invisible timers

---

## 14. Content Scope for v1

## 14.1 Implemented Content

* 1 dome with manual-aim turret weapon, landing / packing / flight animations
* 6 seeded biomes with day, dusk and night art
* Mine of 165 x 224 tiles in 16 strata, 20 resource types (6 deep-stratum ores)
* 11 monster types including 2 bosses
* Day/night cycle with 8 moon phases, 4 seasons, 6 weather states (clear, rain, snow, blizzard, thunderstorm, meteor shower)
* One upgrade tree with 128 nodes across 5 branches (Dome, Mining, Movement, Weapon, Drones) and a Next upgrades panel
* Courier, gun and repair drones
* Relocation Cores and endless relocation between sites
* 4 primary gadgets (Shield Generator, Repellent Field, Orchard, Droneyard)
* 6 mine gadgets found in 2x2 underground chambers
* 5 tools in the upgrade tree (Drill Gadget, Blast Mining, Scanner, Reinforced Dome, Teleporter)
* 9-page help with localStorage persistence
* Local high scores (top 5) with nights and sites
* Autosave and Continue (save format v2 with v1 migration)
* BFS pathfinding for mouse-based navigation and drone routes

## 14.2 Planned Content

* Weapon range upgrade
* Challenge modifiers / elite night modifiers
* Player-entered seeds for reproducible runs

### Planned Additional Gadgets (inspired by original Dome Keeper)

**Surface Gadgets:**
* Buzz Saw — continuous damage to nearby monsters on the dome surface
* Shockwave Hammer — manual shockwave creation with stun effect
* Missile Launcher — target-seeking manual combat ability
* Spire — destroys incoming enemy projectiles

**Mine/Cellar Gadgets:**
* Drillbert — autonomous creature that drills straight lines
* Drilling Rig — deep mining with optional side driller, breaks bedrock
* Furnace — produces smoke that delays monster attacks
* Iron Worms — portable extractors for efficient iron harvesting
* Lift — automated resource transport via orbs
* Mushroom Farm — produces speed and mining buff mushrooms
* Resource Converter — converts between water and iron
* Teleporter — two-way portal between dome and mine

**Keeper Suit Gadgets:**
* Prospecting Meter — HUD meter showing distance to nearest resources
* Resource Packer — compresses multiple resources into bundles
* Suit Blaster — explosive mining from the player's suit

**Primary Gadget Upgrade Trees (branching, mutually exclusive choices):**

* Shield:
  * Electro Blast / Invulnerability / Reflection active abilities
  * Shield Strength line (40 → 60 → 80 → 100 HP absorb)
* Repellent:
  * Wither line (weakens enemies, reducing damage dealt)
  * Debilitate line (slows monsters, increasing wave delay)
  * Overcharge Repellent (use water to boost repellent strength)
* Orchard:
  * Fruit line (Fruit 1 → 2 → 3: increased buff duration, mining strength, growth speed)
  * Snare Roots line (traps medium monsters) OR Vine Canopy line (projectile shield on dome)
  * Overcharge Orchard (use water to boost orchard battle ability)
* Droneyard:
  * Battle Grid (defensive formation) or Parasitic Drones
  * Transport Drone line (speed, carry capacity)
  * Combat Drone line (damage, fire rate)

**Mine Gadget Upgrade Trees:**
* Auto Cannon: rapid fire vs. shotgun configurations
* Stun Laser: duration vs. chain stun
* Blast Mining: charge capacity, explosion radius
* Probe Scanner: range vs. duration
* Dome Armor: HP amount vs. regen rate
* Condenser: yield vs. speed

---

## 15. Out of Scope

* Online multiplayer
* Online leaderboards
* cloud saves
* campaign progression
* achievements platform integration
* controller support, unless separately specified
* localization beyond base language
* mobile/touch optimization as primary target

---

## 16. UX / Clarity Rules

The game must avoid these failure modes:

* Player forgets wave timer exists
* Player cannot tell how to deposit resources
* Player cannot tell which upgrades are affordable
* Surface and underground states feel mechanically disconnected
* Combat feedback is weak or visually noisy
* Visual polish hurts readability

### Required UX Aids

* obvious deposit feedback at dome
* visible wave warning before attack starts
* clear low-health dome warning
* first-time tutorial explaining:

  * mine
  * return
  * upgrade
  * survive waves

---

## 17. Acceptance Criteria Summary

The game is considered feature-complete for v1 when:

1. A player can start a run, mine resources, deposit them, buy upgrades, survive multiple waves, and lose cleanly.
2. Surface combat, underground mining, and transition flow all work without ambiguity.
3. Enemy waves scale over time and remain readable.
4. Resource collection and upgrade progression create visible power growth.
5. Tutorial, pause, restart, and high-score persistence function correctly.
6. Visual feedback meets minimum polish requirements without breaking performance.

---

## 18. Resolved Design Decisions

These decisions have been resolved and implemented:

1. **Is surface combat fully automatic or partially manual?**

   * **Resolved: manual aiming with aim assist.** Player aims the turret with mouse/keyboard and clicks to fire. Aim-assist snaps to nearby enemies along the aim ray.

2. **How exactly is mining controlled?**

   * **Resolved: dual input.** Keyboard (WASD/arrows) moves into adjacent tiles and mines on contact. Mouse click navigates via BFS pathfinding, with queued mine actions on arrival.

3. **Can upgrades be bought only on surface, or anywhere?**

   * **Resolved: surface only.** Upgrade menu opens with U key while on surface.

4. **Is score endless until death, or is there a win condition?**

   * **Resolved: endless survival across sites.** A site ends when the player relocates after finding its Relocation Core; the run continues on the next site until dome HP reaches 0.

6. **When does a level end?**

   * **Resolved: when the player chooses.** Finding the site's Relocation Core unlocks relocation; the player decides when to leave (never during an attack).

7. **What carries over to a new site?**

   * **Resolved:** upgrades, drones, gadgets and score; 75% of every resource; a repaired dome. Each site's threat starts 4 higher than the last and climbs per night.

5. **Does the player avatar exist on the surface, or only underground?**

   * **Resolved: underground only.** Player controls miner underground; dome turret handles surface defense via manual aim.

---

## 19. Implemented Feature List

* Dual-scene gameplay: surface defense and underground mining with a sliding fade transition
* Landing sequence at the start of every run; pack up, lift-off, flight and landing on relocation
* Six seeded biomes with blended day, dusk and night art, parallax mountains, animated plants and sky decorations
* Day/night cycle with sun, eight-phase moon, dusk warning and sunlight at dawn
* Four seasons with gameplay effects and visuals (blossoms, heat haze, falling leaves, snow on ground and dome)
* Weather: rain, snowfall, blizzard fog, thunderstorms with lightning strikes, meteor showers with collectible ore
* Destructible mine of 165 x 224 tiles in 16 textured strata with 20 resources
* Eleven monster types with their own sprites, behaviours and sounds; bosses every fifth night
* One upgrade tree (128 nodes, 5 branches) with tabs, zoom, keyboard control and a Next upgrades quick panel
* Courier, mining, gun and repair drones
* Relocation Cores with scanner hints and a Relocate button with confirmation
* Manual-aim dome turret with mouse tracking and aim-assist
* Gadget selection screen (4 primary gadgets), 6 mine gadgets in hidden chambers, 5 tree tools on keys 1-5
* BFS pathfinding for mouse-based underground navigation and drone routes
* Animated miner, monsters and drones; dome hit feedback; particles, glow, floating text, screen shake
* HUD: clock panel, season, moon, weather, site, threat, core status, banners for every change
* Autosave, Continue, v1 save migration, local high scores with sites
* Responsive canvas scaling, frame-rate independent timing, auto-pause on hidden tab
* OS integration: window title updates, WM_SIZE/WM_THEMECHANGED handling

---

## 20. SEO / Metadata Requirements

Only keep this if the game is being published on a web-facing page. Otherwise it does not belong in the gameplay PRD.

### If included:

* Meta title
* Meta description
* Open Graph tags
* JSON-LD structured data
* Keywords relevant to tower defense, mining, browser/canvas game, SynthelicZ

This is deployment/publishing scope, not core game design scope. Separate it unless there is a real reason to mix them.

---

## 21. Appendix: Implemented Upgrade Tables

The full tree (128 nodes) is defined in `UPGRADE_TREE` in `controller.js`; the in-game tree shows every cost. Highlights:

| Branch   | Chain / node        | Tiers | First cost        | Top tier cost                         |
| -------- | ------------------- | ----: | ----------------- | ------------------------------------- |
| Dome     | Shield Capacity     |     7 | 20 iron           | 8 sapphire, 12 titanium, 15 diamond   |
| Dome     | Last Stand          |     1 | -                 | 3 voidstone, 5 fire opal, 15 ruby     |
| Mining   | Mining Tools        |     7 | 15 iron           | 6 uranium, 10 titanium, 12 diamond    |
| Mining   | Drill Speed         |     5 | 20 iron           | 6 titanium, 20 gold, 15 redstone      |
| Mining   | Carry Capacity      |     5 | 20 iron           | 8 titanium, 25 gold, 20 lead          |
| Movement | Move Speed          |     7 | 15 iron           | 10 titanium, 6 sapphire, 8 emerald    |
| Weapon   | Damage              |     7 | 25 iron           | 6 amethyst, 6 uranium, 15 ruby        |
| Weapon   | Fire Rate           |     6 | 20 iron           | 4 fire opal, 8 sapphire, 10 ruby      |
| Drones   | Drone Bay           |     1 | 30 iron, 12 copper | -                                    |
| Drones   | Drone Thrusters     |     3 | 25 iron, 10 tin   | 15 gold, 6 titanium, 10 quartz        |
| Drones   | Drone Cargo         |     3 | 30 iron, 15 copper | 15 gold, 5 sapphire, 20 lead         |
| Drones   | Mining Laser        |     3 | 40 iron, 20 coal, 15 copper | 5 uranium, 8 titanium, 20 gold |
| Drones   | Gun Drone           |     3 | 45 iron, 20 copper, 15 coal | 6 uranium, 10 ruby, 20 gold   |
| Drones   | Repair Drone        |     3 | 40 iron, 25 water, 15 copper | 6 sapphire, 10 emerald, 40 water |
| Drones   | Drone Swarm         |     2 | 20 gold, 8 titanium, 25 cobalt | 6 amethyst, 4 fire opal, 2 voidstone |

### Planned Upgrades

| Category | Upgrade    | Status      |
| -------- | ---------- | ----------- |
| Weapon   | Range      | Not yet     |
