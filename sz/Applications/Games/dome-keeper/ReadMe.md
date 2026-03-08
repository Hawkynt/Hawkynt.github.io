# Product Requirements Document

## Dome Keeper for SynthelicZ Desktop

**Document Status:** v1.1 (updated to reflect implemented features)
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

1. Start with a basic dome and a small mine access shaft.
2. Go underground and dig toward resource clusters.
3. Carry resources back to the dome.
4. Spend resources on upgrades between or after waves.
5. Return to the surface before enemies arrive.
6. Defend against an enemy wave.
7. Survive, then repeat with increasing difficulty.
8. Lose when dome health reaches zero.

This loop must be understandable within the first 60 seconds of play.

---

## 5. Core Pillars

### 5.1 Tension Through Time

The wave timer is always relevant. Mining decisions must be constrained by impending attacks.

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
- [x] As a player, I can see a visible countdown timer until the next wave so that I can decide whether to continue mining or return to the surface
- [x] As a player, I can mine deeper for rarer resources (iron, water, cobalt) with depth-based rarity so that deeper mining is more rewarding but riskier in time cost
- [x] As a player, I can carry resources back to the dome deposit zone to add them to storage so that resource delivery requires physical effort
- [x] As a player, I can survive endless waves until my dome HP reaches zero so that the game is an endless survival challenge

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
- [x] As a player, I can face ground walker enemies that approach from left/right edges with animated legs and eye blinking so that ground threats are recognizable
- [x] As a player, I can face airborne flyer enemies with bat-like wings that approach from the upper sky so that aerial threats add variety
- [x] As a player, I can face armored enemy variants (wave 9+) with double HP and metallic appearance so that enemies get tougher
- [x] As a player, I can face shielded enemy variants (wave 11+) with blue energy shields that absorb damage before HP so that shield-breaking adds tactical depth
- [x] As a player, I can face boss enemies every 5 waves from wave 15 with 8x HP, shields, and crown visuals so that milestone waves are memorable encounters

### Wave System
- [x] As a player, I can experience 40-second intervals between waves with gradual difficulty scaling so that I have regular mining windows
- [x] As a player, I can see enemy HP scale by +3 per wave and speed scale by +2 per wave so that waves become progressively harder
- [x] As a player, I can see flyers introduced at wave 5 with ratio ramping to ~40% by wave 10 so that enemy composition evolves

### Upgrade System
- [x] As a player, I can open the upgrade menu with U while on the surface to spend resources so that upgrades are accessible between waves
- [x] As a player, I can upgrade weapon damage so that my turret becomes more lethal
- [x] As a player, I can upgrade fire rate so that I can shoot more frequently
- [x] As a player, I can upgrade dome HP so that my dome survives longer
- [x] As a player, I can upgrade drill speed so that I mine tiles faster
- [x] As a player, I can upgrade carry capacity so that I can haul more resources per trip
- [x] As a player, I can upgrade move speed so that underground traversal becomes faster
- [x] As a player, I can upgrade mining tools so that blocks break faster

### Upgrade Tree Dialog
- [x] As a player, I can press U on the surface to open a full-screen upgrade tree overlay so that I see all available upgrades organized as a branching node graph
- [x] As a player, I can see four upgrade branches (Dome, Mining, Movement, Weapon) arranged as visual trees with parent-child node connections so that upgrade paths are clear
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
- [x] As a player, I can still use the quick upgrade panel in the corner for basic upgrades or press U for the comprehensive tree view so that both quick and detailed upgrade paths are available
- [x] As a player, I can see that basic upgrades cost iron only, advanced upgrades cost iron + cobalt, and elite/gadget upgrades cost iron + cobalt + water so that deeper resource types are more valuable

### Gadget System
- [x] As a player, I can select one of four primary gadgets at game start (Shield Generator, Repellent Field, Orchard, Droneyard) so that each run has a unique strategic tool
- [x] As a player, I can discover 6 mine gadgets hidden in 2x2 golden chambers underground (Auto Cannon, Stun Laser, Blast Mining, Probe Scanner, Dome Armor, Condenser) so that exploration is rewarded with permanent run bonuses
- [x] As a player, I can press B to use Blast Mining charges to destroy a 3x3 area so that I can quickly clear large sections
- [x] As a player, I can press R to activate Repellent Field to slow all enemies to 40% for 5 seconds so that I have an emergency defense tool

### Unlockable Tool/Gadget System
- [x] As a player, I can unlock 5 tools from the upgrade panel's "Tools" section by spending iron and cobalt so that I gain new tactical abilities during a run
- [x] As a player, I can unlock the Drill Gadget (25 iron) and press 1 to select it, giving 30% faster mining when digging consecutive tiles in the same column downward, so that deep vertical mining is efficient
- [x] As a player, I can unlock Blast Mining tool (30 iron) and press 2 to clear a 3x3 area around the miner at the cost of 10 iron per use with a 5-second cooldown, so that I can quickly excavate large sections
- [x] As a player, I can unlock the Scanner (35 iron + 10 cobalt) which passively reveals resource types within a 3-tile radius around the miner, so that I can plan mining routes efficiently
- [x] As a player, I can unlock Reinforced Dome (50 iron + 25 cobalt) which passively reduces all dome damage by 25%, so that my dome survives longer against tough waves
- [x] As a player, I can unlock the Teleporter (30 iron + 15 cobalt) and press 5 to instantly return to the dome surface with a 30-second cooldown, so that I can escape dangerous situations underground
- [x] As a player, I can press number keys 1-5 to select or activate unlocked tools so that tool access is quick and intuitive
- [x] As a player, I can see active tool indicators in both the surface and underground HUD so that I always know which tools are available and their cooldown status
- [x] As a player, I can click tools in the upgrade panel to unlock, select, or activate them so that mouse-based tool management is supported

### Visual Effects
- [x] As a player, I can see dome hit feedback with screen shake, flash, and shield impact arcs so that dome damage is immediately obvious
- [x] As a player, I can see resource reveal glow and ambient tile sparkles underground so that valuable tiles stand out
- [x] As a player, I can see a surface parallax starfield background so that the surface scene has atmospheric depth
- [x] As a player, I can see smooth scene transition animation between surface and underground so that switching views is seamless
- [x] As a player, I can see animated enemy sprites with damage flash effects so that enemies react visually to hits

### Tutorial and Persistence
- [x] As a player, I can see a 4-page tutorial on first launch explaining movement, upgrades, gadgets, and tools so that I understand the game loop quickly
- [x] As a player, I can press H to toggle the tutorial overlay at any time so that I can review instructions
- [x] As a player, I can have my tutorial completion and high scores (top 5) persisted via localStorage so that my progress is remembered

### UI and Integration
- [x] As a player, I can pause with Escape and restart with F2 so that runs are easy to control and retry
- [x] As a player, I can toggle between surface and underground with Space or Tab so that view switching is quick
- [x] As a player, I can see dome HP bar, wave countdown, resource totals, and score in the HUD so that critical info is always visible
- [x] As a player, I can see the window title update and the canvas scale responsively within the desktop container so that the game integrates with the SZ OS

### Planned Features
- [ ] As a player, I can face a distinct tank enemy type (slow, high HP, high damage) so that there are more diverse ground threats
- [ ] As a player, I can upgrade weapon range so that my turret can hit enemies from farther away
- [x] As a player, I can upgrade miner move speed so that underground traversal is faster
- [ ] As a player, I can encounter multiple mine biomes with distinct tile types and aesthetics so that runs have visual variety
- [ ] As a player, I can play seeded runs for reproducible mine layouts so that I can share and compare specific runs

---

## 7. Game Modes

### 7.1 Included in v1

* **Standard Run**: endless progression until dome destruction

### 7.2 Excluded from v1

* challenge modifiers
* seeded runs
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

The underground is a tile grid.

### Grid Requirements

* Finite width and depth for v1
* Top center connects to the dome
* Tiles initially hidden or solid except entry shaft area

### Tile Types

At minimum:

* Dirt / soft rock
* Hard rock
* Empty/passable tunnel
* Iron ore
* Water ore
* Cobalt ore

### Mining Rules

* Player must dig adjacent solid tiles to create tunnels.
* Different tile types require different mining time.
* Destroyed solid tiles become empty tunnel tiles.
* Ore tiles drop resource objects when fully mined.

### Resource Carrying

* Resource drops do not auto-bank.
* Player must physically carry or drag them back to the dome.
* Resource is added to storage only when delivered to the dome deposit zone.

### Acceptance Criteria

* Mining a tile always provides visible feedback: hit effect, debris, sound hook, or progress cue.
* Destroyed tiles are permanently removed for the duration of the run.
* Deposited resources are immediately reflected in HUD totals.

---

## 8.5 Resource System

### Resource Types

#### Iron

* Most common
* Used for most baseline upgrades
* Low per-node value

#### Water

* Less common
* Used for intermediate upgrades
* Medium per-node value

#### Cobalt

* Rare
* Used for advanced upgrades or premium costs
* High per-node value

### Requirements

* Each resource must have distinct color, icon, and pickup visual.
* Rarity must be visible in map distribution and upgrade requirements.

### Example Initial Economy

These values may be tuned during balancing:

* Iron node yields 1 unit
* Water node yields 1 unit
* Cobalt node yields 1 unit

### Acceptance Criteria

* Resource requirements for upgrades are understandable at a glance.
* No two resource types are visually confusable.

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

Enemies attack in waves.

### Spawn Rules

* Enemies spawn only from:

  * left edge
  * right edge
  * upper sky area
* Enemies never emerge from the ground

### Enemy Types (Implemented)

#### Ground Walker

* Moves horizontally along ground toward dome from left or right edges
* Spawns at dome Y-level with slight vertical variation
* Damages dome on contact
* Has animated legs with eye blinking
* **Armored variant** (wave 9+): double HP, metallic appearance, up to 35% chance
* **Shielded variant** (wave 11+): blue energy shield absorbs damage before HP, up to 20% chance

#### Airborne Flyer

* Approaches from the upper hemisphere at random angles
* 60% base HP of ground walkers, 30% faster movement
* Animated bat-like wings
* **Shielded variant** (wave 11+): same shield mechanic as ground walkers

#### Boss (wave 15+, every 5th wave)

* Spawns every 5 waves starting at wave 15
* 8x base HP with a 40% HP shield
* 50% base speed but large size (22-26px)
* Always armored, crown/horn visual indicator, red eyes
* Higher dome contact damage (3x base)

### Planned Enemy Types

#### Tank Unit

* Slow, high HP
* Higher dome contact damage
* Not yet implemented as a distinct type (boss fills similar role)

### Enemy Behavior Requirements

* All enemies path directly toward dome
* No advanced pathfinding required beyond simple movement logic
* Enemies attack by contact unless a special ranged unit is added later

### Acceptance Criteria

* Enemy silhouettes are distinguishable at gameplay speed.
* Spawn direction is readable.
* Difficulty increase comes from count, speed, HP, composition, or damage scaling.

---

## 8.8 Wave System

### Structure

The game alternates between downtime and attack waves.

### Wave Timing

* A visible countdown indicates next wave arrival.
* During wave, timer changes to wave status display.
* Brief recovery window after each wave before next countdown starts.

### Scaling

Each wave increases challenge through a combination of:

* more enemies
* more elite enemies
* higher enemy HP
* higher enemy speed
* shorter safe windows, if balanced appropriately

### Minimum Requirements

* At least 10 distinct wave configurations before repetition/scaling formula dominates
* Waves must not feel identical by wave 4

### Implemented Wave Progression Model

* Wave 1: one-shot difficulty, light ground walkers only (HP ~8-10)
* Waves 2-4: increasing ground walker count, no flyers
* Wave 5+: flyers introduced, ratio ramps from 0% to ~40% by wave 10
* Wave 9+: armored ground walkers appear (up to 35% chance)
* Wave 11+: shielded enemies appear on both types (up to 20% chance)
* Wave 15+: boss enemy every 5th wave (8x HP, shields, crown visual)
* HP scales by +3 per wave, speed scales by +2 per wave (capped at +25)
* Wave interval: 40 seconds between waves

### Acceptance Criteria

* Player can anticipate an incoming wave from timer and audiovisual cues.
* Wave start and end are unambiguous.
* Difficulty increase is noticeable but not a vertical brick wall.

---

## 8.9 Upgrade System

### Access

* **Quick panel**: small upgrade panel in the top-right corner of the surface view, click to purchase basic upgrades with generic resource costs
* **Full upgrade tree**: press **U** on the surface to open a full-screen overlay showing a branching upgrade tree with 4 branches
* Game pauses while the upgrade tree dialog is open
* Press **U** or **Escape** to close the dialog

For clarity in v1:

* Upgrades may only be purchased while the player is on the surface and not in transition.

### Upgrade Tree (Full Dialog)

The upgrade tree organizes all upgrades into four branches displayed as a visual node graph:

#### Dome Branch (defense)

| Node             | Cost              | Prereqs      | Effect           |
| ---------------- | ----------------- | ------------ | ---------------- |
| Shield Cap. L1   | 20 Fe             | --           | +25 Max Dome HP  |
| Shield Cap. L2   | 35 Fe + 10 Co     | Shield L1    | +25 Max Dome HP  |
| Shield Cap. L3   | 50 Fe + 20 Co     | Shield L2    | +25 Max Dome HP  |
| Shield Rech. L1  | 25 Fe             | --           | Shield recharge  |
| Shield Rech. L2  | 40 Fe + 15 Co     | Rech. L1     | Shield recharge  |
| Reinforced Dome  | 50 Fe + 25 Co     | Shield L2    | -25% dome damage |

#### Mining Branch

| Node             | Cost              | Prereqs      | Effect           |
| ---------------- | ----------------- | ------------ | ---------------- |
| Mining Tools L1  | 15 Fe             | --           | -20% mine time   |
| Mining Tools L2  | 30 Fe + 10 Co     | Mining L1    | -20% mine time   |
| Mining Tools L3  | 50 Fe + 25 Co     | Mining L2    | -20% mine time   |
| Carry Cap. L1    | 20 Fe             | --           | +20 carry        |
| Carry Cap. L2    | 35 Fe + 15 Co     | Carry L1     | +20 carry        |
| Drill Gadget     | 25 Fe             | Mining L1    | 30% column bonus |

#### Movement Branch

| Node             | Cost              | Prereqs      | Effect           |
| ---------------- | ----------------- | ------------ | ---------------- |
| Move Speed L1    | 15 Fe             | --           | 15% faster       |
| Move Speed L2    | 25 Fe + 8 Co      | Speed L1     | 15% faster       |
| Move Speed L3    | 40 Fe + 15 Co     | Speed L2     | 15% faster       |
| Teleporter       | 30 Fe + 15 Co     | Speed L1     | Instant return   |

#### Weapon Branch

| Node             | Cost              | Prereqs      | Effect           |
| ---------------- | ----------------- | ------------ | ---------------- |
| Fire Rate L1     | 20 Fe             | --           | +0.3 fire rate   |
| Fire Rate L2     | 35 Fe + 12 Co     | Fire L1      | +0.3 fire rate   |
| Damage L1        | 25 Fe             | --           | +5 damage        |
| Damage L2        | 40 Fe + 15 Co     | Damage L1    | +5 damage        |
| Damage L3        | 60 Fe + 30 Co     | Damage L2    | +5 damage        |
| Drill Speed L1   | 20 Fe             | --           | Faster mining    |
| Drill Speed L2   | 35 Fe + 10 Co     | Drill L1     | Faster mining    |
| Blast Mining     | 30 Fe             | Damage L1    | 3x3 area clear   |
| Scanner          | 35 Fe + 10 Co     | Drill Spd L1 | Passive reveal   |

### Resource Costs by Tier

* **Basic upgrades** (L1 nodes): cost iron only
* **Advanced upgrades** (L2+ nodes): cost iron + cobalt
* **Elite/Gadget upgrades**: cost iron + cobalt (+ water for future elite nodes)

### Quick Upgrade Panel (Legacy)

The small corner panel offers generic per-stat upgrades using pooled resources:

### Upgrade Categories

#### Weapon

* Damage
* Fire rate
* Range or targeting speed

#### Dome

* Max HP
* damage resistance optional, not required for v1

#### Mining

* Drill speed
* move speed
* carry capacity

### Upgrade Rules

* Tree upgrades use specific resource costs (iron, cobalt, water)
* Quick panel upgrades use pooled generic resource costs
* Both systems stack -- tree and panel levels combine for stat effects
* Prerequisites must be met in the tree before child nodes unlock
* Purchased upgrades apply immediately
* Upgrade tree clearly shows:

  * current level and max level per node
  * specific resource cost per node
  * whether affordable (bright border)
  * whether prerequisites are met (lock icon if not)
  * purchased status (green checkmark)

### Example Progression Structure

Each stat has 3–5 levels in v1.

### Acceptance Criteria

* Buying an upgrade gives instant visible/mechanical effect.
* Player can understand why an upgrade is locked or unavailable.
* Upgrade panel does not obscure critical surface combat without pausing or safe access logic.

---

## 8.10 Gadget System (Implemented)

### Primary Gadgets

At game start, the player selects one of four primary gadgets from a card-style selection screen:

| Gadget            | Key | Effect                                                        |
| ----------------- | --- | ------------------------------------------------------------- |
| Shield Generator  | --  | Absorbs the first hit of each wave; recharges each wave start |
| Repellent Field   | R   | Slows all enemies to 40% for 5 seconds (30s cooldown)         |
| Orchard           | --  | Grows fruit periodically; click tree to gain speed boost       |
| Droneyard         | --  | Drone periodically delivers carried resources to the dome      |

### Mine Gadgets

Six gadgets are hidden in 2x2 golden chambers scattered underground. Walking over a revealed chamber activates the gadget permanently for the run:

| Gadget         | Effect                                                              |
| -------------- | ------------------------------------------------------------------- |
| Auto Cannon    | Secondary turret on the dome's left side; auto-fires at enemies      |
| Stun Laser     | Periodically stuns the nearest enemy for 2 seconds                   |
| Blast Mining   | Press B to destroy a 3x3 area around the miner (limited charges)     |
| Probe Scanner  | Reveals resource types of nearby unrevealed tiles                    |
| Dome Armor     | Adds +50 to maximum dome HP                                         |
| Condenser      | Generates +5 water every 30 seconds automatically                    |

### Gadget Chambers

* 2-4 chambers generated per run, placed in valid 2x2 open areas
* Each chamber contains a unique random mine gadget
* Chambers appear as golden `TILE_GADGET` tiles when revealed
* Walking into the chamber picks up the gadget with a notification

### Unlockable Tools (Implemented)

Five tools can be unlocked from the upgrade panel's "Tools" section during gameplay by spending iron and cobalt:

| Tool             | Key | Cost              | Effect                                                              |
| ---------------- | --- | ----------------- | ------------------------------------------------------------------- |
| Drill Gadget     | 1   | 25 iron           | Select to mine. 30% faster when mining consecutive same-column tiles downward |
| Blast Mining     | 2   | 30 iron           | Clears 3x3 area around miner. Costs 10 iron per use, 5s cooldown   |
| Scanner          | 3   | 35 iron + 10 Co   | Passive: reveals resource types within 3-tile radius around miner   |
| Reinforced Dome  | 4   | 50 iron + 25 Co   | Passive: dome takes 25% less damage from all enemies                |
| Teleporter       | 5   | 30 iron + 15 Co   | Instantly return to dome surface. Deposits carried resources. 30s cooldown |

* Tools are unlocked permanently for the current run
* Active tools (Drill) are selected/deselected by pressing their key or clicking in the panel
* Passive tools (Scanner, Reinforced Dome) activate immediately on unlock
* Activation tools (Blast Mining, Teleporter) fire on key press and have cooldowns
* Tool status is shown in both surface and underground HUDs

---

## 8.11 HUD and UI

### Must Display During Run

* Dome HP bar
* Next wave countdown or active wave indicator
* Current resource totals: Iron, Water, Cobalt
* Current score
* Pause state when paused

### Surface HUD

* Dome status
* wave info
* upgrade prompt or button hint

### Underground HUD

* carried resources
* path/surface direction indicator optional but strongly recommended
* wave countdown remains visible

### Tutorial Overlay (Implemented)

* Four-page guide shown on first launch:
  1. **How to Play**: basic movement, mining, and view toggle controls
  2. **Upgrades & Tips**: upgrade shop, resource types, wave preparation
  3. **Gadgets**: primary gadget selection, mine gadget chambers, activation keys
  4. **Tools**: unlockable tools from upgrade panel, keyboard shortcuts 1-5
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

* waves survived
* enemies killed
* resources deposited
* optional survival bonus

### Game Over Summary

Show:

* final wave reached
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
| R                            | Activate Repellent Field gadget (if available)        |
| B                            | Use Blast Mining charge (if available)                |
| 1                            | Select Drill Gadget tool (if unlocked)               |
| 2                            | Activate Blast Mining tool (if unlocked)             |
| 3                            | Scanner status (passive, if unlocked)                |
| 4                            | Reinforced Dome status (passive, if unlocked)        |
| 5                            | Activate Teleporter (if unlocked)                    |
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

### v1 Generation Rules

* Mine is generated at run start
* Entry point at top center below dome
* Resource density increases moderately with depth
* Iron appears at shallow and medium depths
* Water appears from medium depth onward
* Cobalt appears mostly in deeper zones
* No impossible-to-reach enclosed mandatory areas

### Acceptance Criteria

* Early game always has reachable iron within short distance
* At least one medium-value cluster appears before dangerous depth
* Deep mining is meaningfully rewarded

---

## 13. Balancing Requirements

Exact numbers can be tuned later, but the game must satisfy these balancing goals:

### Early Game

* Player can survive first wave without upgrades if they return in time
* First upgrade can be purchased after a short successful mining trip

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

* 1 dome with manual-aim turret weapon
* 1 underground biome (14x10 tile grid)
* 3 resource types (iron, water, cobalt) with depth-based rarity
* 2 base enemy types (ground walker, airborne flyer) with armored/shielded variants
* Boss enemies every 5 waves from wave 15
* 7 upgrades (weapon damage, fire rate, dome HP, drill speed, carry capacity, move speed, mining tools) via quick panel
* Full-screen upgrade tree dialog with 24 nodes across 4 branches (Dome, Mining, Movement, Weapon), branching prerequisites, specific iron/cobalt/water costs
* 4 primary gadgets (Shield Generator, Repellent Field, Orchard, Droneyard)
* 6 mine gadgets found in 2x2 underground chambers (Auto Cannon, Stun Laser, Blast Mining, Probe Scanner, Dome Armor, Condenser)
* 5 unlockable tools integrated into upgrade tree (Drill Gadget, Blast Mining, Scanner, Reinforced Dome, Teleporter)
* 4-page tutorial with localStorage persistence
* Local high scores (top 5)
* Full visual feedback (particles, screen shake, floating text, glow effects, starfield)
* BFS pathfinding for mouse-based underground navigation
* Gadget selection screen at game start
* Keyboard shortcuts 1-5 for tool selection/activation

## 14.2 Planned Content

* Tank enemy type (distinct from boss)
* Weapon range upgrade
* Multiple mine themes / biomes
* Challenge modifiers / elite wave modifiers
* Seeded runs for reproducible gameplay

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

   * **Resolved: endless survival.** Game continues until dome HP reaches 0.

5. **Does the player avatar exist on the surface, or only underground?**

   * **Resolved: underground only.** Player controls miner underground; dome turret handles surface defense via manual aim.

---

## 19. Implemented Feature List

* Dual-scene gameplay: surface defense and underground mining
* Smooth scene transition animation (fade-out/fade-in)
* Destructible underground tile grid (14x10)
* Three resources (iron, water, cobalt) with depth-based rarity
* Resource hauling and dome deposit mechanic with carry capacity and overflow drops
* Timed enemy waves (40s interval) with gradual difficulty scaling
* Manual-aim dome turret weapon with mouse tracking and aim-assist
* Two enemy types (ground walker, airborne flyer) with armored/shielded/boss variants
* Gradual difficulty: one-shot wave 1, armored wave 9+, shielded wave 11+, bosses wave 15+
* 7 upgrades: weapon damage, fire rate, dome HP, drill speed, carry capacity, move speed, mining tools
* Full-screen upgrade tree dialog (U key) with 4 branches (Dome, Mining, Movement, Weapon), 24 nodes, branching prerequisites, specific resource costs (iron/cobalt/water), visual node graph with connection lines, hover highlights, and scroll support
* Quick upgrade panel in corner for fast purchases + full tree for comprehensive planning
* Game pauses during upgrade dialog; close with U or Escape
* Gadget selection screen at game start (4 primary gadgets)
* 6 mine gadgets found in hidden 2x2 underground chambers
* 5 unlockable tools integrated into upgrade tree (Drill Gadget, Blast Mining, Scanner, Reinforced Dome, Teleporter)
* Keyboard shortcuts 1-5 for tool selection and activation
* Tool HUD indicators on both surface and underground views
* BFS pathfinding for mouse-based underground navigation
* Animated miner with pickaxe swing, idle bob, and directional facing
* Animated enemy sprites with legs, wings, eye blinking, and damage flash
* Dome hit feedback with screen shake, flash, and shield impact arcs
* Time-based mining with depth and tile-type scaling, visible progress bar
* Dropped resources on the ground when inventory is full, picked up by walking over
* Laser glow, impact sparks, mining debris particles, dust clouds, floating text
* Resource reveal glow and ambient tile sparkles underground
* Surface parallax starfield background
* Four-page tutorial with localStorage persistence
* Pause, restart, and local high scores (top 5)
* Responsive canvas scaling in desktop container (fills parent via flexbox)
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

### Quick Panel Upgrades (legacy, pooled resource costs)

| Category | Upgrade        | Base Cost | Per Level | Effect                       |
| -------- | -------------- | --------: | --------: | ---------------------------- |
| Weapon   | Weapon Damage  |        30 |        20 | Increases laser damage        |
| Weapon   | Fire Rate      |        25 |        15 | Reduces fire cooldown         |
| Dome     | Dome HP        |        40 |        25 | Increases maximum dome HP     |
| Mining   | Drill Speed    |        20 |        10 | Faster tile mining            |
| Mining   | Carry Capacity |        20 |        10 | Carry more resource units     |
| Mining   | Move Speed     |        25 |        15 | 15% faster movement per level |
| Mining   | Mining Tools   |        35 |        20 | 20% faster mining per level   |

### Upgrade Tree (specific resource costs, branching prerequisites)

| Branch   | Node            | Iron | Cobalt | Water | Prereqs        | Type   | Effect                          |
| -------- | --------------- | ---: | -----: | ----: | -------------- | ------ | ------------------------------- |
| Dome     | Shield Cap. L1  |   20 |      0 |     0 | --             | stat   | +25 Max Dome HP                 |
| Dome     | Shield Cap. L2  |   35 |     10 |     0 | Shield L1      | stat   | +25 Max Dome HP                 |
| Dome     | Shield Cap. L3  |   50 |     20 |     0 | Shield L2      | stat   | +25 Max Dome HP                 |
| Dome     | Shield Rech. L1 |   25 |      0 |     0 | --             | stat   | Shield recharge bonus           |
| Dome     | Shield Rech. L2 |   40 |     15 |     0 | Rech. L1       | stat   | Shield recharge bonus           |
| Dome     | Reinforced Dome |   50 |     25 |     0 | Shield L2      | gadget | -25% dome damage                |
| Mining   | Mining Tools L1 |   15 |      0 |     0 | --             | stat   | -20% mine time                  |
| Mining   | Mining Tools L2 |   30 |     10 |     0 | Mining L1      | stat   | -20% mine time                  |
| Mining   | Mining Tools L3 |   50 |     25 |     0 | Mining L2      | stat   | -20% mine time                  |
| Mining   | Carry Cap. L1   |   20 |      0 |     0 | --             | stat   | +20 carry capacity              |
| Mining   | Carry Cap. L2   |   35 |     15 |     0 | Carry L1       | stat   | +20 carry capacity              |
| Mining   | Drill Gadget    |   25 |      0 |     0 | Mining L1      | gadget | 30% faster column mining        |
| Movement | Move Speed L1   |   15 |      0 |     0 | --             | stat   | 15% faster movement             |
| Movement | Move Speed L2   |   25 |      8 |     0 | Speed L1       | stat   | 15% faster movement             |
| Movement | Move Speed L3   |   40 |     15 |     0 | Speed L2       | stat   | 15% faster movement             |
| Movement | Teleporter      |   30 |     15 |     0 | Speed L1       | gadget | Instant surface return          |
| Weapon   | Fire Rate L1    |   20 |      0 |     0 | --             | stat   | +0.3 fire rate                  |
| Weapon   | Fire Rate L2    |   35 |     12 |     0 | Fire L1        | stat   | +0.3 fire rate                  |
| Weapon   | Damage L1       |   25 |      0 |     0 | --             | stat   | +5 weapon damage                |
| Weapon   | Damage L2       |   40 |     15 |     0 | Damage L1      | stat   | +5 weapon damage                |
| Weapon   | Damage L3       |   60 |     30 |     0 | Damage L2      | stat   | +5 weapon damage                |
| Weapon   | Drill Speed L1  |   20 |      0 |     0 | --             | stat   | Faster tile mining              |
| Weapon   | Drill Speed L2  |   35 |     10 |     0 | Drill Spd L1   | stat   | Faster tile mining              |
| Weapon   | Blast Mining    |   30 |      0 |     0 | Damage L1      | gadget | 3x3 area blast (10 Fe per use)  |
| Weapon   | Scanner         |   35 |     10 |     0 | Drill Spd L1   | gadget | Passive 3-tile ore reveal       |

### Planned Upgrades

| Category | Upgrade    | Status      |
| -------- | ---------- | ----------- |
| Weapon   | Range      | Not yet     |
