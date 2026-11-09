# Space Combat

A classic top-down vertical scrolling arcade shooter for the SynthelicZ Desktop. Fly a 30-mission campaign across five sectors -- survival, assault, escort, defense and salvage missions, each sector closed by a multi-part boss -- or play Endless Survival, the seeded Daily Challenge and Boss Rush. Five ships with their own specials, six primary and four secondary weapons, ten enemy types, five hazards, a hangar and a 36-node tech tree, all drawn with procedural canvas art.

## How It Works

The game runs a fixed 60 Hz simulation in world units and draws one frame per display refresh. The view is a 1280 x 720 plane fitted into the window; the 720 x 720 play field sits in its middle between two HUD panels, and the scenery fills every extra pixel of a wider or taller window. Pointer positions are mapped back into the plane on every event, so clicks and mouse steering stay exact after resizing or maximizing.

The play field is fixed and the sector scrolls past: three star layers and speed streaks stream down-screen while asteroids, mine strings, nebula patches, black holes and terrain sentries drift down with the scroll. The ship always faces up and flies in eight directions with near-instant response and no drift, confined to the field (the top band belongs to the bosses); it can follow the mouse pointer or a dragged finger instead. Shift focuses (slow, tighter and stronger shots, the true hitbox shown), C dashes sideways with a moment of invulnerability, and enemy shots only hit a small core hitbox -- near misses are grazes that score and charge the special. Every hostile inside the field sits in a uniform spatial grid rebuilt each step; shots, beams, rails, blasts and rams query it, so a battle with 120 ships and 700 shots takes about 4 ms of script time per frame.

Missions are generated from compact data: a mission table gives type, briefing and parameters, and a seeded generator lays out the stage (start, the first rocks on screen, when each outpost and data core scrolls in, convoy and station positions) and composes waves from a budget that grows per wave. Each wave is queued group by group into arcade formations -- rows and V shapes dropping in from the top, sweeps curling in from a side, diving pairs, swarmer columns, heavy ships sliding into station, cloakers slipping in from the flanks -- and every ship enters along its path, fights around its hover slot and finally leaves the field. Endless waves, the daily gauntlet (seeded by the local date, with one of five mutators) and the boss rush come from the same generator. Bosses descend from the top and hold the upper band (the serpent weaves through the whole field); they are a core plus parts that follow the hull -- turrets, shield emitters, beam emitters, launchers, orbiting shards or serpent segments -- with core shields, weak points and three attack phases.

All art is procedural and painted once into cached canvases at twice its size: ships come from a layered hull painter (lit plates, outlines, rim light, panel lines, glass canopies, nozzles, gloss) that bakes five bank frames per ship and paint scheme; enemies, bosses, asteroids, capsules and the sector backdrops (domain-warped fbm nebulae, lit planets with rings, a sun with corona streamers, a black hole, three parallax star tiles) are painted the same way. Per frame the game only blits sprites, draws additive glows and strokes; no blur filters are used. Effects come from pooled particles (glows with colour ramps, sparks batched into one path per colour, smoke, tumbling debris, embers, shockwave rings) plus hit-stop, slow motion on boss kills, screen flashes and a damage vignette.

Progress lives in one versioned save (scrap, stars, best times, tree levels, ships, weapons, loadout, styles, bests, high scores, statistics). The first version's high-score list is migrated once into it, with a scrap bonus for veteran pilots.

## Architecture

The code lives in `js/` as plain scripts on the `SZ.SpaceCombat` namespace, loaded in order by `index.html` (no build step, no modules, works from `file://`). All shared game state sits in one object, `SZ.SpaceCombat.state` (`G` in every module); each module states at its top what it owns and what it reads.

- **`index.html`** -- Menu bar (Game: Title Screen, Pause, Tech Tree, High Scores, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, dialog tables

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.SpaceCombat` namespace with one object per module, so modules can call modules that load after them
- **`constants.js`** -- View plane and play field, scroll speed, simulation clock, pool and grid sizes, player handling (speed response, hitbox, focus, dash, graze), enemy shot and boss scaling, combo steps, feel timings, UI palette
- **`rng.js`** -- Seeded mulberry32 generators, string hashing, the local day key, angle and segment helpers
- **`data-ships.js`** -- The five ships (arcade speed, dash cooldown) and their specials, six primaries, four secondaries, power-ups, skins, trails, engine colours, projectile colour ramps
- **`data-enemies.js`** -- Ten enemy types (behaviour, weapons, wave cost) and five bosses (parts, weak points, shields, phases)
- **`data-campaign.js`** -- Five sectors (art theme, roster, hazards), 30 missions, six mission types, four play modes
- **`data-tree.js`** -- The tech tree: five branches, 36 nodes with costs, prerequisites, grid placement and per-level stats
- **`rules.js`** -- Pure progression rules: default save and migration, tree states and purchases, styles, hangar purchases, derived ship stats (speed, dash, focus, graze), damage and armour maths, combo multiplier, stars, rewards, unlocks
- **`state.js`** -- The shared state object: screens, run and stage, entity lists, player, camera and scroll, feel timers, score and grazes, input, per-screen UI
- **`save.js`** -- Loads and writes the v2 save (the only module touching `localStorage`) and refreshes the derived stats
- **`audio.js`** -- Sound effects through the shared `SZ.GameAudio`, throttled per name and attenuated by distance
- **`music.js`** -- Soundtrack through the shared `SZ.GameMusic`: a theme per sector (a synthwave patrol through Kepler Reach, an electro dogfight in the Crimson Expanse, blazing trance at the Helios Corona, a dubstep grind in the Abyss Rift, an epic siege at the Void Citadel), a heavier theme for every boss, a menu theme and fast themes for Endless, the Daily and Boss Rush. Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop, breakdown, every pass a little different); every campaign mission plays a song of its own made from its world's theme. Bosses, crowded skies and a failing hull raise the intensity: layers come in and the music pushes into the drop.

Systems (`js/systems/`), one simulation concern each:

- **`grid.js`** -- The spatial grid (circle and segment queries, each object once), in-place list compaction, object pools
- **`waves.js`** -- Pure stage generation: campaign stages, endless waves, the daily gauntlet with mutators, the boss rush, wave composition from a budget, the stage layout (start, first rocks, outpost and core schedules, convoy and station)
- **`formations.js`** -- Pure arcade formations: rows, V shapes, side sweeps, dives, swarmer columns, flank entries and heavy-ship stations as timed entry paths into hover slots
- **`fx.js`** -- Pooled particles and their colour ramps, shockwave rings, floating texts, composite explosions, screen shake, hit-stop, slow motion, flashes
- **`camera.js`** -- The fixed field camera: the forward scroll, shake offsets, world-to-view mapping and the field test
- **`player.js`** -- The ship: stats from the save (re-applied live), 8-way arcade flight inside the field, pointer following, banking, focus, the dash, outside pushes, the five specials, shields, armour, Last Stand, death
- **`weapons.js`** -- Primaries firing up-screen (bolts, beam, rail, flak, ion arcs), secondaries (homing missiles, lobbed mines, EMP, drones), crits, focus and power-up multipliers, wingman drones in formation, target finding
- **`projectiles.js`** -- Pooled player and enemy shots: movement, homing, fuses, flak bursts, trails, time warp, culling at the field edge, clearing
- **`enemy-ai.js`** -- The ten behaviours while a ship fights: slot sway and bursts, dives, swarmer lanes, bombing runs, terrain and outpost sentries, outposts, swinging frigate shields, flanking cloakers, carrier bays, lancer beams
- **`enemies.js`** -- Enemy spawning on formation paths, the enter-fight-leave cycle, escaping the field, launched children, target choice, burst fire, the lancer beam, separation, stun
- **`bosses.js`** -- Boss descent from the top, the upper-band hover and the serpent's weave, parts, core shields and weak points, phase changes, the attack library, the death sequence
- **`hazards.js`** -- The hazard stream riding the scroll: asteroids that split and bump, mine strings, nebula patches that slow and hide, drifting black holes, solar flare bands
- **`pickups.js`** -- Scrap, power-ups and data cores: drops that fall with the scroll, magnet, the download while a core drifts past, collection
- **`combat.js`** -- Grid rebuild of everything inside the field, shot collisions against the small hitbox, grazing, body collisions, damage routing, frigate shield arcs, blasts and burning zones, kills, drops, score and combo
- **`missions.js`** -- Runs in all four modes, stage setup, the spawn queue that feeds waves in formation, outposts, data cores and terrain sentries scrolling in, objectives, convoy and station, multi-stage runs, payout into the save
- **`sim.js`** -- One fixed step in order: input, hit-stop, slow motion, every system, scroll and shake

Render (`js/render/`):

- **`art-kit.js`** -- Offscreen canvases, the sprite cache, colour maths, value noise and fbm, shared glow, smoke, bolt, orb and ring sprites, white hit-flash silhouettes
- **`ship-art.js`** -- The layered hull painter with five baked bank frames, and the five player ship designs
- **`enemy-art.js`** -- The ten enemy designs, boss cores and parts (including the Maw's open and shut jaws), freighter and relay station
- **`prop-art.js`** -- Asteroids, debris chips, scrap, power-up capsules, data cores, mines, missiles, nebula fog, the black hole, all UI icons
- **`backdrop-art.js`** -- Sector nebula layers, planets with bands, atmospheres and rings, moons, the sun, the citadel skyline, star tiles
- **`view.js`** -- Canvas fitting, backing resolution cap, the visible plane rectangle, pointer mapping, resize and maximize
- **`backdrop.js`** -- The per-frame backdrop for the current sector with stars streaming down-screen, and the speed streaks in the field
- **`actors.js`** -- Player (nose-up, dash roll, focus hitbox), drones, enemies (sentries on terrain pads), allies and bosses with engine flames, shields, cloak shimmer, telegraphs and health bars
- **`fx-render.js`** -- Particles, sparks, rings and floating texts from cached sprites
- **`world.js`** -- The play field in draw order, clipped and culled: speed streaks, hazards, the jump gate, pickups, ships, shots, beams, fog, flare bands
- **`hud.js`** -- The side panels framing the field (ship, hull and shield, special and dash gauges, ammo, timers, score, combo, grazes, scrap, objective, ally health, controls), the boss bar, threat markers for ships about to enter, banners, vignettes, pointer marker, flash and toasts
- **`frame.js`** -- One frame: backdrop, battle and HUD, the active screen, flash and toasts, cursor and draw timing

UI (`js/ui/`):

- **`kit.js`** -- Fonts, fitted and wrapped text, sci-fi panels, segmented bars, stars, locks, icons, scrap amounts, the chrome logo
- **`widgets.js`** -- Hit areas registered while drawing, hover and keyboard cursor, directional navigation, buttons
- **`screens.js`** -- Screen switching with return targets (title, map, briefing, pause), pause and resume, toasts
- **`status-bar.js`** -- The window status bar and the High Scores dialog
- **`touch.js`** -- Relative drag flight with auto-fire and four buttons (dash, secondary, special, focus) for touch screens
- **`title.js`** -- Animated title with a dogfight, the mode menu, pilot record and mode preview
- **`map.js`** -- Sector cards and the mission route with stars, locks, hazards and roster
- **`briefing.js`** -- Mission briefing with objective, star goals, reward, threats and loadout preview
- **`hangar.js`** -- Ships tab and Weapons tab with live firing demos, buying and equipping
- **`tree.js`** -- The tech tree screen with links, states, detail panel, buying and equipping styles, immediate effect mid-run
- **`results.js`** -- Results with popping stars, counted statistics, payout and next steps
- **`pause.js`** -- The pause menu with Tech Tree, How to Play, Restart and Abandon
- **`help.js`** -- Six illustrated How to Play pages (controls, arcade flight, weapons, enemies, bosses and hazards, modes)
- **`input.js`** -- Keyboard, mouse and touch input, per-step flight intent (move or follow the pointer, fire, focus, dash), menu navigation, auto-pause

Bootstrap:

- **`js/app.js`** -- The fixed-step loop, the menu bar, background pre-painting, start-up

Tests (`tests/`, run with `node tests/<name>.test.js`):

- **`harness.js`** -- A recording fake canvas, minimal DOM and storage, and a loader that runs the game scripts in `index.html` order
- **`grid.test.js`** -- Grid queries against brute force, edge clamping, compaction, pools
- **`combat-math.test.js`** -- Crits, armour, combo multiplier, derived stats, weapon DPS balance, enemy and boss data sanity
- **`waves.test.js`** -- All 30 stages valid and laid out inside the play field, wave budgets and rosters, endless escalation, daily seeding, boss rush
- **`arcade.test.js`** -- 8-way flight without drift, field bounds, nose-up, focus, dash, shots going up, pointer following, formations, the enter-fight-leave cycle, scrolling hazards, bosses entering from the top, grazing, saves from before the arcade view
- **`progression.test.js`** -- Tree data and purchases, styles, hangar purchases, stars, rewards, unlocks
- **`save.test.js`** -- Migration of the old high-score list, repair of damaged saves, round trip, storage failures
- **`art.test.js`** -- Every sprite paints and is cached, blit costs, painting budgets, no blur filters
- **`scene.test.js`** -- The whole game in the fake browser: every screen draws, every mode and mission starts, a heavy battle stays in budget, tree purchases apply mid-run, wins and losses pay out

## User Stories

### Flight & Feel
- [x] As a player, I can fly a classic top-down vertical shooter: my ship sits low in a fixed play field, always faces up and fires up-screen while the sector scrolls past so that it plays like an arcade shooter
- [x] As a player, I can move in eight directions with WASD or the arrow keys and the ship answers at once without drifting, held inside the play field so that dodging is precise
- [x] As a player, I can let the ship follow the mouse pointer and fire with the mouse buttons so that I can play mouse-only
- [x] As a player, I can hold Shift to focus: slow, precise flight with a tighter, stronger spread and the true hitbox shown so that I can thread bullet patterns
- [x] As a player, I can dash with C for a short burst sideways with invulnerability so that I can slip through bullet walls and solar flares
- [x] As a player, I can graze enemy shots that skim past my small hitbox for points and special charge so that daring play pays
- [x] As a player, I can see hit-stop on big kills, slow motion when a boss or my ship explodes, screen shake and flashes so that key moments land
- [x] As a player, I can see red markers at the field edge where ships are about to enter, and a WARNING when a boss approaches, so that nothing comes out of nowhere

### Campaign
- [x] As a player, I can fly a campaign of five sectors (Kepler Reach, Crimson Expanse, Helios Corona, Abyss Rift, Void Citadel) with six missions each so that the game has a long arc
- [x] As a player, I can play six mission types -- survival, assault on outposts that scroll in one by one, escorting a freighter flying ahead of me to its jump gate, defending a station below me, data-core salvage (stay with each drifting core while it downloads, every core trips an ambush) and boss fights -- so that missions stay varied
- [x] As a player, I can earn up to three stars per mission (finish, keep half the hull, beat the par time) so that I have reasons to replay
- [x] As a player, I can unlock missions in order and the next sector by beating its boss so that progress feels earned
- [x] As a player, I can read a briefing with objective, star goals, reward, threats and my loadout before launching so that I can prepare

### Enemies
- [x] As a player, I can face ten enemy types arriving in formations from the top and the sides: Raiders fly in rows, V shapes and sweeps and fire bursts from their slots, Hornets dive from the corners and loop round, Swarmers weave down in columns and ram, Hammerheads bomb me, stations and convoys, Sentries ride terrain pads and outposts, Outposts hold the top and launch swarmers, Bulwark frigates swing a shield arc, Phantoms cloak to my flank and decloak, Leviathan carriers open their bays, Lancers snipe after a red warning line
- [x] As a player, I can see ships fly in on curved entry paths, hold their slots and peel off in dives so that waves feel like an arcade shooter
- [x] As a player, I can see enemies show engine glows and flash white when hit so that every hit reads

### Bosses
- [x] As a player, I can fight five multi-part bosses that descend from the top and hold the upper band: the Warden (rotating bastion whose shield emitters guard the core), the Hydra (a serpent weaving through the field whose armoured head must be hit as it turns away), Solaris (a dreadnought with shield generators and sweeping beam emitters), the Maw (a gravity leviathan that pulls me up and is only vulnerable while its mouth is open) and the Overmind (a core shielded by six orbiting shards)
- [x] As a player, I can see each boss change phase at 60% and 30% health with new attacks (spirals, rings, fans, summons, mines, charges, beams, missile salvos, teleports) so that fights escalate
- [x] As a player, I can see a boss health bar with phase marks and hints on how to hurt the boss so that I learn each fight

### Hazards
- [x] As a player, I can break asteroids drifting down into smaller rocks and get bumped by them so that the field has texture
- [x] As a player, I can trip strings of drifting mines that blink faster before they blow so that I must watch my path
- [x] As a player, I can hide in nebula patches that slow ships and hide me from enemies so that cover matters
- [x] As a player, I can fly past black holes that drift across the field pulling ships, shots and scrap so that position matters
- [x] As a player, I can dodge solar flares: a band of the screen flashes, then burns, so I step out or dash through so that timing matters

### Ships, Weapons & Power-ups
- [x] As a player, I can fly five ships with different speed, armour, dash and a special each: Falcon (Overdrive), Wraith (Phase Blink up-screen), Bastion (Aegis, reflects shots), Tempest (Nova Burst) and Specter (Time Warp, with an escort drone and sharper graze sensors)
- [x] As a player, I can pick one of six primaries (Pulse Blaster, Scatter Cannon, Lance Beam, Rail Driver, Flak Mortar, Ion Arc) and one of four secondaries (Seeker Missiles, Proximity Mines, EMP Pulse, Attack Drones) in the hangar, with a live firing demo
- [x] As a player, I can pick up shield cells, hull repairs, overcharge, a tractor magnet and munitions dropped in combat so that fights ebb and flow
- [x] As a player, I can chain kills into combos for up to x7 score so that aggressive play pays

### Modes
- [x] As a player, I can play Endless Survival with escalating waves, a boss every fifth wave and new scenery every five so that I can chase a high score
- [x] As a player, I can play the Daily Challenge: four missions and a boss seeded by the date under one mutator (Glass Cannons, Swarm, Hazard Storm, Overclocked, Salvage Rights) so that every day brings a new shared run
- [x] As a player, I can play Boss Rush against all five bosses back to back once I have beaten the Warden

### Progression
- [x] As a player, I can earn scrap in every mode (pickups plus mission rewards or a score bonus) so that every run counts
- [x] As a player, I can spend scrap in a 36-node tech tree with Weapons, Defense, Engines (speed, dash, focus damage, dash ram and wake), Systems (graze sensors, drones, salvage) and Style branches so that my ship grows with me
- [x] As a player, I can open the tech tree from the title, the map, the hangar, the results and the pause menu, and see purchases take effect at once in the running mission
- [x] As a player, I can buy and equip paint schemes, engine trails and engine colours in the Style branch so that my ship looks like mine

### Art & Sound
- [x] As a player, I can see five painted sectors with layered nebulae, planets with rings and atmospheres, a sun, a distant black hole, a citadel skyline, and star layers and speed streaks streaming past so that each sector feels like a place I fly through
- [x] As a player, I can see detailed lit ships with engine flames, banking and dash rolls, shield bubbles that flare where they are hit, glowing bolts, beams, rails and lightning so that combat looks rich
- [x] As a player, I can see explosions with flashes, fireballs, sparks, embers, smoke, tumbling debris and shockwaves so that destruction feels big
- [x] As a player, I can hear synthesized effects for shots, beams, hits, explosions, pickups, combos and menus, quieter the further away they happen, and mute them with the corner button

### Screens & Controls
- [x] As a player, I can navigate every screen (title, sector map, briefing, hangar, tech tree, help, pause, results) with the mouse or the keyboard so that both work everywhere
- [x] As a player, I can read six illustrated How to Play pages so that I can learn the game in place
- [x] As a player, I can play on a touch screen by dragging anywhere (the ship follows my finger and fires on its own), with buttons for dash, secondary, special and focus
- [x] As a player, I can resize or maximize the window and keep exact click and pointer mapping, with the scenery filling the extra space
- [x] As a player, I can have the game pause when the tab is hidden, and pause or resume with Esc or P

### Persistence
- [x] As a player, I can keep scrap, stars, best times, upgrades, ships, weapons, styles, bests and statistics across sessions in one save, including saves from the free-flight version
- [x] As a player, I can keep my high scores from the earlier version of the game, with a scrap bonus for them
- [x] As a player, I can view and reset a top-10 high score list with mode and wave

### Planned Features
- [ ] As a player, I can play co-op with a second pilot on the same keyboard
- [ ] As a player, I can earn achievements for milestones

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrow keys | Move in 8 directions |
| Space / Z / Left mouse | Fire primary (hold) |
| X / Right mouse | Fire secondary |
| Shift | Focus: slow, precise, tighter and stronger shots |
| C / V | Dash (brief invulnerability) |
| Mouse | The ship follows the pointer |
| E / Q | Special ability |
| Esc / P | Pause |
| B | Buy the selected tech tree node |
| Tab | Switch hangar tab |
| F2 | Title screen |
| Touch | Drag to fly with auto-fire; buttons for dash, secondary, special and focus |

## 🏆 Goals and story

Through the shared `SZ.GameGoals` and `SZ.GameStory` (wired in `js/systems/meta.js`, saved under `sz-goals-space-combat` and `sz-story-space-combat`):

- [x] As a player, I earn 20 achievements (enemies, bosses, missions, stars, endless waves, best score, Dailies, the streak, quests, festivals, runs), each paying credits
- [x] As a player, I get three daily quests, a day streak and festival tracks during the six real-date festivals, paying credits and festival liveries
- [x] As a player, I can unlock and equip 12 liveries that repaint my ship over its hangar skin
- [x] As a player, I follow the campaign with Commander Vega, the pilot Wren, Doc Okafor and the Overmind: a prologue, an arrival in every sector, a word from every boss as it arrives and a finale; the battle holds while they talk, and every scene seen can be watched again under Game > Goals and Story

