# Asteroids: Starfall

The classic rock-shattering arcade shooter for the SynthelicZ Desktop, rebuilt. Rotate, thrust and fire on a wrapping field -- now with a five-chapter story campaign of 30 hand-designed missions and five titan bosses, Arcade, Zen, Daily and Boss Rush modes, thirteen power-ups, fourteen rock types, seven raider types, a 29-node tech tree, ship skins, trails and shot colours, achievements, daily quests, play streaks and seasonal events -- all drawn with procedural canvas art and saved in the browser, with the current run autosaved for Continue.

## How It Works

The game runs a fixed 60 Hz simulation and draws one frame per display refresh. The view is a 1280 x 720 plane fitted into the window, and that plane is also the play field: a torus where everything leaving one edge comes back on the other. When the window is wider or taller than 16:9 the letterbox bars are not black -- the backdrop fills them and every object is drawn at each wrapped copy that is visible, so the bars show the field continuing around the torus (a faint dashed line marks the seam). Pointer positions are mapped back into the plane on every event, so clicks, mouse aiming and touch stay exact after resizing or maximizing.

The ship flies like the original: rotate, thrust with inertia, brake, fire, jump through hyperspace. It can also turn toward the mouse pointer (left button fires, right thrusts) or a touch stick. Rocks are bucketed each step into a toroidal spatial grid; shots, blades, blasts, beams and the ship query it with wrap-aware distances. Each kill feeds a combo (up to x8 score) and charges Overdrive, a blast around the ship. Rock types have their own death effects -- volatile rocks explode, ice leaves frost that slows, magma drips fire, storm rocks chain lightning, void rocks bend shots and ships, gold showers stardust, seasonal rocks drop event tokens.

Story missions are hand-designed data (objective, opening rocks, reinforcement waves, raider schedule, hazard, par time) and are proven completable: a test lets the autopilot fly all thirty with the base ship. Arcade and Daily waves come from a generator (the Daily is seeded by the local date with two modifiers); titans join every eighth wave. The five titans are a core plus parts with phases at 65% and 30% health.

All art is procedural and painted once into cached canvases at twice its size: lumpy lit rocks with craters, ore, crystal facets, molten veins, frost, storm veins, swirls and seasonal looks; ships in four hulls and seventeen paint schemes; raiders and titans; capsules, tokens and icons; chapter backdrops (fbm nebulae, lit planets with rings, a black hole) with three drifting star tiles and seasonal decor computed from the clock. Per frame the game only blits sprites, draws additive glows and strokes; no blur filters are used. Effects come from pooled particles (glows with colour ramps, sparks batched per colour, smoke, rock chips, embers, seasonal shapes, shockwave rings) plus hit-stop, slow motion, camera shake and punch, screen flashes and floating score text. Rock shapes are pre-painted a few per frame before a level needs them. A busy scene with 65 rocks, five raiders, three active power-ups and about a thousand particles costs roughly 0.3 ms of simulation and 0.7 ms of drawing script per frame (`tests/art.test.js` checks it stays under 6 ms).

Everything lives in `localStorage` under two keys: the versioned save (stardust, tree, stars and best times, cosmetics, achievements, statistics, high scores, bests, daily quests, streak, per-season event tracks, settings) and the autosaved run snapshot (mode, level spec, ship, every world list, score, combo and the seeded generator's position), written every four seconds of play, on pause, between waves and when the page hides. The first version's high-score list is migrated once into the save, with a stardust bonus for veterans.

## Architecture

The code lives in `js/` as plain scripts on the `SZ.Asteroids` namespace, loaded in order by `index.html` (no build step, no modules). All shared game state sits in one object, `SZ.Asteroids.state` (`G` in every module); each module states at its top what it owns and what it reads.

- **`index.html`** -- Menu bar (Game: Title Screen, Pause, Tech Tree, Hangar, Goals, High Scores, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, dialog tables

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.Asteroids` namespace with one object per module, so modules can call modules that load after them
- **`constants.js`** -- View plane and wrapping field, simulation clock, pools and grid cell, flight and weapon tuning, rock sizes and scores, combo and overdrive, autosave cadence, UI palette
- **`rng.js`** -- Seeded mulberry32 generators with saveable state, string hashing, local day and ISO week keys, wrap-aware deltas, angle helpers
- **`data-rocks.js`** -- Fourteen rock types (hit points, score and stardust multipliers, palettes, death effects, arcade unlock wave) including six seasonal ones
- **`data-enemies.js`** -- Seven raider types and the five titans
- **`data-powerups.js`** -- Thirteen power-ups (icon, colour, duration, drop weight) and the eight Daily modifiers
- **`data-campaign.js`** -- The cast, five chapters (theme, map position, briefing and debriefing dialogue) with six missions each, the opening dialogue, the five modes
- **`data-tree.js`** -- The tech tree: five branches, 29 nodes with costs, prerequisites, placement and per-level stats
- **`data-cosmetics.js`** -- Seventeen ship skins, eleven trails and eight shot colours, each with how it unlocks
- **`data-goals.js`** -- 35 achievements, the daily quest pool, the lifetime records list
- **`seasons.js`** -- Calendar logic: seasons and festivals by local date, per-season track keys, track tiers and rewards, the Daily spec, daily quests, the weekly featured chapter, the play streak
- **`rules.js`** -- Pure rules: save shape, repair and migration of the old keys, tree states and purchases, derived ship stats, cosmetics, scoring and combo, rock hit points, stars and rewards, unlock order, arcade waves, achievements, high scores
- **`state.js`** -- The shared state object: screens and return targets, save, calendar, run, entity lists, feel timers, scoring, input, per-screen UI
- **`save.js`** -- Loads and writes the save and the run snapshot (the only module touching `localStorage`), refreshes stats and the calendar (daily rollover at local midnight)
- **`audio.js`** -- Sound effects through the shared `SZ.GameAudio`, throttled per name, quieter in Zen where kills play a pentatonic melody
- **`music.js`** -- Soundtrack through the shared `SZ.GameMusic`: a theme per chapter (a cold synthwave drift through the Kuiper belt, a dubstep grind in the Ember Belt, soaring trance in the Crystal Reach), a heavier theme for every boss, a menu theme, calm Zen and a fast theme for Rush and the Daily. Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop, breakdown, every pass a little different); every story level plays a song of its own made from its world's theme. Bosses, combos and the last ship raise the intensity: layers come in and the music pushes into the drop.

Systems (`js/systems/`), one simulation concern each:

- **`grid.js`** -- The toroidal spatial grid (wrapping circle queries, each object once), object pools, in-place list compaction
- **`fx.js`** -- Pooled particles, rings and floating texts; shake, camera punch, hit-stop, slow motion, flash and banners
- **`ship.js`** -- Flight (rotate or aim, thrust, brake, drag, frost), engine trails per style, hyperspace with safe landing, overdrive, getting hit (shield, last stand, Zen knock-back, losing a ship) and respawning
- **`weapons.js`** -- The cannon with every modifier (twin barrels, tri-shot, rapid, lance, seekers, ricochet, criticals), the Sunbeam, wingdrones, orbit blades, shot motion for both sides
- **`rocks.js`** -- Spawning at the edges, drifting and tumbling, magma drips, damage, shattering into children with each type's death effect, stardust, shards, tokens and drops
- **`enemies.js`** -- The seven raiders' behaviour, damage, death and loot
- **`bosses.js`** -- The five titans: entry, parts, phases, attack patterns, open/shielded cores, death sequence
- **`powerups.js`** -- Drops, capsules, shards and tokens, stardust motes and the tractor reach, collecting, each power-up's effect and expiry
- **`hazards.js`** -- Frost and fire patches, mines, black holes and the friendly Singularity, gravity bending, implosions, the Maw's pull, lightning strikes, comets, arc fading
- **`collision.js`** -- The collision pass: shots against rocks, raiders, titan parts and mines; the ship against everything that hurts; blades, blasts, the Sunbeam, nearest-target queries
- **`waves.js`** -- Starting runs in every mode, setting up levels and waves, raider schedules, reinforcements, pods, Zen refills and ambience, objectives
- **`progress.js`** -- Score and combo, overdrive charge, stardust, statistics and quests, seasonal tokens and track rewards, ships lost and game over, titans, level and wave completion, high scores, streak, achievements
- **`snapshot.js`** -- The autosaved run: taking, writing on a cadence, describing and restoring it exactly
- **`cinematics.js`** -- The cinematic sequencer and the story flow into a mission (opening, chapter arrival, briefing, titan reveal) and out of a chapter (debriefing, finale), the season opening
- **`bot.js`** -- The autopilot that flies the title's attract scene and the completability tests
- **`sim.js`** -- The fixed step: the run's seeded generator, the chrono world clock, hit-stop and slow motion, the system order, the attract scene, toasts, autosave

Rendering (`js/render/`):

- **`art-kit.js`** -- Offscreen canvases and the sprite cache, colour maths, value noise and fbm, shared glow, puff, bolt, orb and ring sprites, silhouettes
- **`rock-art.js`** -- Rocks per type, size and shape variant, crack overlays per damage stage, shine colours
- **`ship-art.js`** -- Four hulls in every skin, hit-flash silhouettes, the shield bubble, wingdrones, escape pods
- **`enemy-art.js`** -- Raiders, titans and their parts, the Maw's gullet, eyes
- **`prop-art.js`** -- The icon set, capsules, shards, seasonal tokens, mines, enemy shots, blades, holes, frost and fire patches, chips, seasonal decor shapes
- **`view.js`** -- Canvas sizing, letterboxing, resolution cap and pointer mapping into the plane
- **`backdrop.js`** -- Chapter and title backdrops: fbm nebula, drifting star tiles, twinkles, the planet, the season's tint and decor
- **`world.js`** -- The field, every object at each visible wrapped copy, under shake and punch
- **`fx-render.js`** -- Particles, sparks, rings and floating texts
- **`hud.js`** -- Score and combo, objective panel, titan health, ships, stardust, overdrive gauge, power-up timers, hyperspace gauge, banners, flash and toasts
- **`cine-render.js`** -- The cinematics with letterbox bars and captions, Haven Station's art
- **`frame.js`** -- One frame in draw order, screen fades, the draw-time measurement

UI (`js/ui/`):

- **`kit.js`** -- Text, panels, bars, stars, locks, icons, the stardust amount and the logo
- **`widgets.js`** -- Hit areas registered while drawing, the keyboard cursor, buttons
- **`screens.js`** -- Screen switching with return targets, pause (autosaves), resume, Continue, quit and abandon, toasts
- **`title.js`** -- The title over the attract scene: Continue, the modes, the Today card
- **`map.js`** -- The world map with chapters, mission cards and briefing replays
- **`story.js`** -- Dialogue as comic panels with painted portraits and typewriter text
- **`tree.js`** -- The tech tree screen
- **`wardrobe.js`** -- The hangar: skins, trails and shot colours with a live preview
- **`goals.js`** -- Daily quests and streak, the season track and calendar, achievements, records, high scores
- **`results.js`** -- Mission and run results and the way on
- **`pause.js`** -- The pause menu
- **`help.js`** -- Five illustrated How to Play pages
- **`touch.js`** -- The touch stick and buttons
- **`status-bar.js`** -- The window status bar and the High Scores dialog
- **`input.js`** -- Keyboard, mouse and touch, flight intents, menu navigation, saving when the page hides
- **`app.js`** -- The loop, the menu bar, pre-painting, the season opening and start-up

Tests (`tests/`, run with `node tests/<name>.test.js`):

- **`harness.js`** -- A recording fake canvas, a minimal DOM, storage and an optional fixed date; loads the scripts in `index.html` order
- **`boot.test.js`** -- Boots and drives every screen, mode, cinematic and the story flow across a chapter's end
- **`levels.test.js`** -- Validates all 30 missions and lets the autopilot complete each one with the base ship
- **`rules.test.js`** -- Tree, stats, cosmetics, scoring, stars, unlocks, arcade waves, achievements, high scores
- **`save.test.js`** -- Migration of the old keys, save repair, the autosave round trip and Continue, storage failures
- **`seasons.test.js`** -- Seasons and festivals by date, track keys and rewards, Daily and quests, weeks, streaks; booting into every season
- **`art.test.js`** -- Every sprite paints once within budget, blits cost one call, no `shadowBlur`, module size, and the busy-scene frame budget

## User Stories

### Flight & Feel
- [x] As a player, I can rotate, thrust with inertia, brake and fire on a field that wraps at every edge so that it plays like the arcade original
- [x] As a player, I can aim with the mouse (the ship turns toward the pointer, left button fires, right button thrusts) so that I can play mouse-only
- [x] As a player, I can jump through hyperspace to escape, with a cooldown, so that I have a last resort
- [x] As a player, I can build combos up to x8 score and unleash Overdrive, a blast around my ship, when the gauge is full so that aggressive play pays
- [x] As a player, I can feel hits through hit-stop, slow motion, camera shake and punch, flashes, squashing sprites and floating score text so that every moment lands

### Story
- [x] As a player, I can fly the Starfall campaign: five chapters (Kuiper Drift, Ember Belt, Crystal Reach, Storm Nebula, The Maw) of six missions each on a world map so that the game has a long arc
- [x] As a player, I can play clear, survive, gather-shards, rescue-pods and titan missions so that missions stay varied
- [x] As a player, I can meet Nova, her ship mind KITE, Commander Varga and the Shardmind in dialogue panels before and after each chapter, and replay them from the map
- [x] As a player, I can watch an opening, a warp arrival for each chapter, a reveal for each titan and a finale, and skip any of them with a key, click or tap
- [x] As a player, I can earn three stars per mission (clear, lose no ship, beat par) so that I have reasons to replay
- [x] As a player, I can trust that every mission can be finished: an automated pilot completes all thirty in the tests

### Rocks, Raiders & Titans
- [x] As a player, I can shatter fourteen rock types: stone, iron, crystal (splits in three), volatile (explodes), ice (frost slows), magma (fire), storm (chain lightning), void (bends shots), gold (stardust) and six seasonal rocks
- [x] As a player, I can fight saucers, sniper saucers, hunter packs, gunships, mine-layers, phantoms and splitters, each with its own behaviour
- [x] As a player, I can face five titans with parts and phases: the Glacier Titan behind orbiting plates, the Magma Wyrm and its segments, the Prism Warden's sweeping beams, the Tempest Core shielded by pylons and lightning, and the Maw that opens to pull me in
- [x] As a player, I can deal with hazards: frost, fire, mines, black holes, lightning strikes and comets

### Power-ups
- [x] As a player, I can collect thirteen power-ups -- Shield, Tri-Shot, Rapid Fire, Lance Rounds, Seeker Swarm, Sunbeam, Orbit Blades, Chrono Field, Tractor, Score x2, Nova Bomb, Singularity and Extra Ship -- with their own icons and timers
- [x] As a player, I can stack timed power-ups so that they combine

### Modes
- [x] As a player, I can play Arcade: endless waves, three ships, an extra ship every 10,000 points, titans every eighth wave and a top-10 high-score table
- [x] As a player, I can relax in Zen: no death, no clock, slower rocks, quiet sound and a melody from my kills
- [x] As a player, I can play the Daily: one ship, a field and two modifiers seeded by the local date, with today's best
- [x] As a player, I can play Boss Rush against all five titans once I have beaten one

### Progression
- [x] As a player, I can earn stardust in every mode, banked the moment I touch it, so that every run counts
- [x] As a player, I can spend it in a 29-node tech tree (Cannons, Hull, Engines, Salvage, Overdrive) from the title, results or pause menu, with immediate effect
- [x] As a player, I can collect ship skins, trails and shot colours in the Hangar, bought with stardust or unlocked by achievements, story chapters and seasonal events
- [x] As a player, I can chase 35 achievements, three daily quests and a play streak with growing bonuses, and see my lifetime records

### Seasons
- [x] As a player, I can play in Deep Winter, Bloomtide, Solar Maximum and Amberfall, and in the Haunted Belt and Starfall festivals, each with its own tint, drifting decor, seasonal rocks and an opening
- [x] As a player, I can climb each season's eight-tier event track with tokens for stardust, a trail, a ship skin, a shot colour and a champion badge
- [x] As a player, I can see a featured chapter each week with extra stardust and a double-stardust rock type

### Screens & Controls
- [x] As a player, I can navigate every screen with the mouse or the keyboard
- [x] As a player, I can read five illustrated How to Play pages
- [x] As a player, I can play on a touch screen with a steering stick, automatic fire and buttons for hyperspace, overdrive and pause
- [x] As a player, I can resize or maximize the window and keep exact pointer mapping, with the field wrapping into the extra space

### Persistence
- [x] As a player, I can close the window at any moment and Continue exactly where I was: the run autosaves every few seconds, on pause, between waves and when the page hides
- [x] As a player, I can keep my high scores from the earlier version of the game, with a stardust bonus for them
- [x] As a player, I can keep everything in this browser only; nothing is sent to a server

### Planned Features
- [ ] As a player, I can play co-op with a second ship on the same keyboard

## Controls

| Key | Action |
|-----|--------|
| A / D or Left / Right | Rotate |
| W or Up | Thrust |
| S or Down | Brake |
| Space (hold) | Fire |
| Shift or X | Hyperspace jump |
| E or Q | Overdrive (when charged) |
| Mouse | Aim at the pointer; left button fires, right button thrusts |
| Esc or P | Pause menu |
| B | Buy the selected tech tree node |
| Tab | Switch tabs in the hangar and goals |
| H | How to Play (title) |
| F2 | Title screen (the run is kept for Continue) |
| Touch | Drag on the left to steer and thrust; guns fire on their own; HYPER, OVER and pause buttons |
