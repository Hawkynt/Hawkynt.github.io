# Space Combat

Free-flight arcade dogfighting in large scrolling sectors for the SynthelicZ Desktop. Fly a 30-mission campaign across five sectors -- survival, assault, escort, defense and salvage missions, each sector closed by a multi-part boss -- or play Endless Survival, the seeded Daily Challenge and Boss Rush. Five ships with their own specials, six primary and four secondary weapons, ten enemy types, five hazards, a hangar and a 36-node tech tree, all drawn with procedural canvas art.

## How It Works

The game runs a fixed 60 Hz simulation in world units and draws one frame per display refresh. The view is a 1280 x 720 plane fitted into the window; menus stay letterboxed inside it, while the battle, the scenery and the HUD use every extra pixel of a wider or taller window, so the play field never shows bars. Pointer positions are mapped back into the plane on every event, so clicks stay exact after resizing or maximizing.

Each sector is a square arena (3,400 to 4,000 px) with a chase camera that looks ahead toward the aim and the velocity, leans toward a boss and shakes from accumulated trauma. The ship flies with inertia: WASD thrusts in screen directions while the nose follows the mouse (or the IJKL keyboard turret, or a touch stick), boosting builds engine heat, and a dodge roll gives a short window of invulnerability. Every hostile the player can hit sits in a uniform spatial grid rebuilt each step; shots, beams, rails, blasts and rams query it, so a battle with 130 ships and hundreds of shots takes about 2 ms of script time per frame.

Missions are generated from compact data: a mission table gives type, briefing and parameters, and a seeded generator lays out the sector (start, asteroids, minefields, nebulae, black hole, outposts, data cores, convoy route) and composes waves from a budget that grows per wave. Endless waves, the daily gauntlet (seeded by the local date, with one of five mutators) and the boss rush come from the same generator. Bosses are a core plus parts that follow the hull -- turrets, shield emitters, beam emitters, launchers, orbiting shards or serpent segments -- with core shields, weak points and three attack phases.

All art is procedural and painted once into cached canvases at twice its size: ships come from a layered hull painter (lit plates, outlines, rim light, panel lines, glass canopies, nozzles, gloss) that bakes five bank frames per ship and paint scheme; enemies, bosses, asteroids, capsules and the sector backdrops (domain-warped fbm nebulae, lit planets with rings, a sun with corona streamers, a black hole, three parallax star tiles) are painted the same way. Per frame the game only blits sprites, draws additive glows and strokes; no blur filters are used. Effects come from pooled particles (glows with colour ramps, sparks batched into one path per colour, smoke, tumbling debris, embers, shockwave rings) plus hit-stop, slow motion on boss kills, screen flashes and a damage vignette.

Progress lives in one versioned save (scrap, stars, best times, tree levels, ships, weapons, loadout, styles, bests, high scores, statistics). The first version's high-score list is migrated once into it, with a scrap bonus for veteran pilots.

## Architecture

The code lives in `js/` as plain scripts on the `SZ.SpaceCombat` namespace, loaded in order by `index.html` (no build step, no modules, works from `file://`). All shared game state sits in one object, `SZ.SpaceCombat.state` (`G` in every module); each module states at its top what it owns and what it reads.

- **`index.html`** -- Menu bar (Game: Title Screen, Pause, Tech Tree, High Scores, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, dialog tables

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.SpaceCombat` namespace with one object per module, so modules can call modules that load after them
- **`constants.js`** -- View plane, simulation clock, pool and grid sizes, player handling, combo steps, feel timings, UI palette
- **`rng.js`** -- Seeded mulberry32 generators, string hashing, the local day key, angle and segment helpers
- **`data-ships.js`** -- The five ships and their specials, six primaries, four secondaries, power-ups, skins, trails, engine colours, projectile colour ramps
- **`data-enemies.js`** -- Ten enemy types (behaviour, weapons, wave cost) and five bosses (parts, weak points, shields, phases)
- **`data-campaign.js`** -- Five sectors (art theme, roster, hazards), 30 missions, six mission types, four play modes
- **`data-tree.js`** -- The tech tree: five branches, 36 nodes with costs, prerequisites, grid placement and per-level stats
- **`rules.js`** -- Pure progression rules: default save and migration, tree states and purchases, styles, hangar purchases, derived ship stats, damage and armour maths, combo multiplier, stars, rewards, unlocks
- **`state.js`** -- The shared state object: screens, run and stage, entity lists, player, camera, feel timers, score, input, per-screen UI
- **`save.js`** -- Loads and writes the v2 save (the only module touching `localStorage`) and refreshes the derived stats
- **`audio.js`** -- Sound effects through the shared `SZ.GameAudio`, throttled per name and attenuated by distance

Systems (`js/systems/`), one simulation concern each:

- **`grid.js`** -- The spatial grid (circle and segment queries, each object once), in-place list compaction, object pools
- **`waves.js`** -- Pure stage generation: campaign stages, endless waves, the daily gauntlet with mutators, the boss rush, wave composition from a budget, the sector layout, spawn points
- **`fx.js`** -- Pooled particles and their colour ramps, shockwave rings, floating texts, composite explosions, screen shake, hit-stop, slow motion, flashes
- **`camera.js`** -- The chase camera with look-ahead, boss framing, easing and shake offsets; world-to-view mapping
- **`player.js`** -- The ship: stats from the save (re-applied live), inertia flight, banking, boost heat, dodge roll, the five specials, shields, armour, Last Stand, death
- **`weapons.js`** -- Primaries (bolts, beam, rail, flak, ion arcs), secondaries (missiles, mines, EMP, drones), crits and multipliers, wingman drones, target finding
- **`projectiles.js`** -- Pooled player and enemy shots: movement, homing, fuses, flak bursts, trails, time warp, clearing
- **`enemies.js`** -- Enemy spawning with warp-in, target choice, the ten behaviours, burst fire, separation, stun
- **`bosses.js`** -- Boss intro, movement styles, parts, core shields and weak points, phase changes, the attack library, the death sequence
- **`hazards.js`** -- Asteroids that split and bump, proximity mines, nebulae that slow and hide, black hole gravity, solar flares
- **`pickups.js`** -- Scrap, power-ups and data cores: drops, drift, magnet, the core download, collection
- **`combat.js`** -- Grid rebuild, shot and body collisions, damage routing, frigate shield arcs, blasts and burning zones, kills, drops, score and combo
- **`missions.js`** -- Runs in all four modes, stage setup, the wave spawner, objectives, convoy and station, multi-stage runs, payout into the save
- **`sim.js`** -- One fixed step in order: input, hit-stop, slow motion, every system, camera

Render (`js/render/`):

- **`art-kit.js`** -- Offscreen canvases, the sprite cache, colour maths, value noise and fbm, shared glow, smoke, bolt, orb and ring sprites, white hit-flash silhouettes
- **`ship-art.js`** -- The layered hull painter with five baked bank frames, and the five player ship designs
- **`enemy-art.js`** -- The ten enemy designs, boss cores and parts (including the Maw's open and shut jaws), freighter and relay station
- **`prop-art.js`** -- Asteroids, debris chips, scrap, power-up capsules, data cores, mines, missiles, nebula fog, the black hole, all UI icons
- **`backdrop-art.js`** -- Sector nebula layers, planets with bands, atmospheres and rings, moons, the sun, the citadel skyline, star tiles
- **`view.js`** -- Canvas fitting, backing resolution cap, the visible plane rectangle, pointer mapping, resize and maximize
- **`backdrop.js`** -- The per-frame parallax backdrop for the current sector and the speed-streaked dust
- **`actors.js`** -- Player, drones, enemies, allies and bosses with engine flames, shields, cloak shimmer, telegraphs and health bars
- **`fx-render.js`** -- Particles, sparks, rings and floating texts from cached sprites
- **`world.js`** -- The battle scene in draw order with culling: sector edge, hazards, pickups, ships, shots, beams, fog, flares
- **`hud.js`** -- Status bars, cooldown rings, objective, score and combo, boss bar, radar, off-screen indicators, banners, vignettes, reticle, flash and toasts
- **`frame.js`** -- One frame: backdrop, battle and HUD, the active screen, flash and toasts, cursor and draw timing

UI (`js/ui/`):

- **`kit.js`** -- Fonts, fitted and wrapped text, sci-fi panels, segmented bars, stars, locks, icons, scrap amounts, the chrome logo
- **`widgets.js`** -- Hit areas registered while drawing, hover and keyboard cursor, directional navigation, buttons
- **`screens.js`** -- Screen switching with return targets (title, map, briefing, pause), pause and resume, toasts
- **`status-bar.js`** -- The window status bar and the High Scores dialog
- **`touch.js`** -- Virtual move and aim sticks and four action buttons for touch screens
- **`title.js`** -- Animated title with a dogfight, the mode menu, pilot record and mode preview
- **`map.js`** -- Sector cards and the mission route with stars, locks, hazards and roster
- **`briefing.js`** -- Mission briefing with objective, star goals, reward, threats and loadout preview
- **`hangar.js`** -- Ships tab and Weapons tab with live firing demos, buying and equipping
- **`tree.js`** -- The tech tree screen with links, states, detail panel, buying and equipping styles, immediate effect mid-run
- **`results.js`** -- Results with popping stars, counted statistics, payout and next steps
- **`pause.js`** -- The pause menu with Tech Tree, How to Play, Restart and Abandon
- **`help.js`** -- Six illustrated How to Play pages
- **`input.js`** -- Keyboard, mouse and touch input, per-step flight intent, menu navigation, auto-pause

Bootstrap:

- **`js/app.js`** -- The fixed-step loop, the menu bar, background pre-painting, start-up

Tests (`tests/`, run with `node tests/<name>.test.js`):

- **`harness.js`** -- A recording fake canvas, minimal DOM and storage, and a loader that runs the game scripts in `index.html` order
- **`grid.test.js`** -- Grid queries against brute force, edge clamping, compaction, pools
- **`combat-math.test.js`** -- Crits, armour, combo multiplier, derived stats, weapon DPS balance, enemy and boss data sanity
- **`waves.test.js`** -- All 30 stages valid and safely laid out, wave budgets and rosters, endless escalation, daily seeding, boss rush
- **`progression.test.js`** -- Tree data and purchases, styles, hangar purchases, stars, rewards, unlocks
- **`save.test.js`** -- Migration of the old high-score list, repair of damaged saves, round trip, storage failures
- **`art.test.js`** -- Every sprite paints and is cached, blit costs, painting budgets, no blur filters
- **`scene.test.js`** -- The whole game in the fake browser: every screen draws, every mode and mission starts, a heavy battle stays in budget, tree purchases apply mid-run, wins and losses pay out

## User Stories

### Flight & Feel
- [x] As a player, I can thrust and strafe with WASD or the arrow keys while my ship keeps its momentum and drifts so that flying feels like space
- [x] As a player, I can aim with the mouse while the nose turns smoothly toward the cursor and the hull banks into turns so that dogfights feel twin-stick
- [x] As a player, I can aim and fire with the IJKL keyboard turret so that I can play without a mouse
- [x] As a player, I can boost with Shift until the engines overheat and must cool down so that speed is a resource
- [x] As a player, I can dodge-roll with Space for a short invulnerability window so that I can slip through bullets, beams and solar flares
- [x] As a player, I can see a chase camera that looks ahead of me, frames bosses and shakes on impacts so that the action stays readable and punchy
- [x] As a player, I can see hit-stop on big kills, slow motion when a boss or my ship explodes, and screen flashes so that key moments land
- [x] As a player, I can see a radar with sector edge, nebulae, black holes, enemies, objectives and allies, and arrows at the screen edge pointing to off-screen threats and goals so that I always know where to go

### Campaign
- [x] As a player, I can fly a campaign of five sectors (Kepler Reach, Crimson Expanse, Helios Corona, Abyss Rift, Void Citadel) with six missions each so that the game has a long arc
- [x] As a player, I can play six mission types -- survival, assault on outposts, convoy escort, station defense, data-core salvage (hold position while each core downloads, every core trips an ambush) and boss fights -- so that missions stay varied
- [x] As a player, I can earn up to three stars per mission (finish, keep half the hull, beat the par time) so that I have reasons to replay
- [x] As a player, I can unlock missions in order and the next sector by beating its boss so that progress feels earned
- [x] As a player, I can read a briefing with objective, star goals, reward, threats and my loadout before launching so that I can prepare

### Enemies
- [x] As a player, I can face ten enemy types with distinct behaviours: Raiders strafe around me, Hornets pursue and overshoot, Swarmers ram and explode, Hammerheads bomb stations and convoys, Sentries track me, Outposts launch swarmers, Bulwark frigates block shots with a front shield arc, Phantoms cloak and decloak behind me, Leviathan carriers launch fighters, Lancers snipe after a red warning line
- [x] As a player, I can see enemies warp in, show engine glows and flash white when hit so that every hit reads

### Bosses
- [x] As a player, I can fight five multi-part bosses: the Warden (rotating bastion whose shield emitters guard the core), the Hydra (a serpent with an armoured head that must be hit from the side or behind), Solaris (a dreadnought with rear shield generators and sweeping beam emitters), the Maw (a gravity leviathan that is only vulnerable while its mouth is open) and the Overmind (a core shielded by six orbiting shards)
- [x] As a player, I can see each boss change phase at 60% and 30% health with new attacks (spirals, rings, fans, summons, mines, charges, beams, missile salvos, teleports) so that fights escalate
- [x] As a player, I can see a boss health bar with phase marks and hints on how to hurt the boss so that I learn each fight

### Hazards
- [x] As a player, I can break asteroids into smaller rocks and get bumped by them so that the field has texture
- [x] As a player, I can trip minefields that blink faster before they blow so that I must watch my path
- [x] As a player, I can hide in nebulae that slow ships and blind the radar so that cover matters
- [x] As a player, I can fight near a black hole that pulls ships, shots and scrap so that position matters
- [x] As a player, I can dodge solar flares that sweep the whole sector after a warning so that timing matters

### Ships, Weapons & Power-ups
- [x] As a player, I can fly five ships with different stats and a special each: Falcon (Overdrive), Wraith (Phase Blink), Bastion (Aegis, reflects shots), Tempest (Nova Burst) and Specter (Time Warp, with an escort drone)
- [x] As a player, I can pick one of six primaries (Pulse Blaster, Scatter Cannon, Lance Beam, Rail Driver, Flak Mortar, Ion Arc) and one of four secondaries (Seeker Missiles, Proximity Mines, EMP Pulse, Attack Drones) in the hangar, with a live firing demo
- [x] As a player, I can pick up shield cells, hull repairs, overcharge, a tractor magnet and munitions dropped in combat so that fights ebb and flow
- [x] As a player, I can chain kills into combos for up to x7 score so that aggressive play pays

### Modes
- [x] As a player, I can play Endless Survival with escalating waves, a boss every fifth wave and new scenery every five so that I can chase a high score
- [x] As a player, I can play the Daily Challenge: four missions and a boss seeded by the date under one mutator (Glass Cannons, Swarm, Hazard Storm, Overclocked, Salvage Rights) so that every day brings a new shared run
- [x] As a player, I can play Boss Rush against all five bosses back to back once I have beaten the Warden

### Progression
- [x] As a player, I can earn scrap in every mode (pickups plus mission rewards or a score bonus) so that every run counts
- [x] As a player, I can spend scrap in a 36-node tech tree with Weapons, Defense, Engines, Systems and Style branches so that my ship grows with me
- [x] As a player, I can open the tech tree from the title, the map, the hangar, the results and the pause menu, and see purchases take effect at once in the running mission
- [x] As a player, I can buy and equip paint schemes, engine trails and engine colours in the Style branch so that my ship looks like mine

### Art & Sound
- [x] As a player, I can see five painted sectors with layered nebulae, planets with rings and atmospheres, a sun, a distant black hole, a citadel skyline, parallax stars and dust so that each sector feels like a place
- [x] As a player, I can see detailed lit ships with engine flames, banking and dodge rolls, shield bubbles that flare where they are hit, glowing bolts, beams, rails and lightning so that combat looks rich
- [x] As a player, I can see explosions with flashes, fireballs, sparks, embers, smoke, tumbling debris and shockwaves so that destruction feels big
- [x] As a player, I can hear synthesized effects for shots, beams, hits, explosions, pickups, combos and menus, quieter the further away they happen, and mute them with the corner button

### Screens & Controls
- [x] As a player, I can navigate every screen (title, sector map, briefing, hangar, tech tree, help, pause, results) with the mouse or the keyboard so that both work everywhere
- [x] As a player, I can read six illustrated How to Play pages so that I can learn the game in place
- [x] As a player, I can play on a touch screen with virtual move and aim sticks and buttons for boost, roll, secondary and special
- [x] As a player, I can resize or maximize the window and keep exact click mapping, with the battle filling the extra space
- [x] As a player, I can have the game pause when the tab is hidden, and pause or resume with Esc or P

### Persistence
- [x] As a player, I can keep scrap, stars, best times, upgrades, ships, weapons, styles, bests and statistics across sessions in one save
- [x] As a player, I can keep my high scores from the earlier version of the game, with a scrap bonus for them
- [x] As a player, I can view and reset a top-10 high score list with mode and wave

### Planned Features
- [ ] As a player, I can play co-op with a second pilot on the same keyboard
- [ ] As a player, I can earn achievements for milestones

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrow keys | Thrust and strafe |
| Mouse | Aim |
| Left mouse | Fire primary |
| Right mouse / X / C | Fire secondary |
| I J K L | Keyboard turret (aim and fire) |
| Shift | Boost |
| Space | Dodge roll |
| E / Q | Special ability |
| Esc / P | Pause |
| B | Buy the selected tech tree node |
| Tab | Switch hangar tab |
| F2 | Title screen |
