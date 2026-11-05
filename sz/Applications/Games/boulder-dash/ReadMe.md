# Boulder Dash

A cave-digging puzzle-action game for the SynthelicZ Desktop in the spirit of the classic. The lamps of Emberfall went dark: as Pip Ferrow you dig through the five depths of Mount Ember -- the Amber Mines, the Frost Caverns, the Glowshroom Grotto, the Magma Forge and the Crystal Heart -- collecting gems under falling boulders, outwitting fireflies, butterflies, moles and ice bats, and facing a boss at the bottom of every depth. Besides the 40-cave story there are Arcade, Zen, Daily Cave and Time Attack modes, eleven power-ups, a 25-node tech tree, sixteen miner skins, seasonal events, daily quests and an autosave that lets you continue exactly where you stopped. All art is procedural canvas drawing.

## How It Works

The game runs a fixed 60 Hz step and draws one frame per display refresh. The cave itself lives on the classic cadence: every eight steps the grid is scanned top to bottom and each object takes its turn -- boulders, gems, ice and powder barrels fall, roll off rounded things and crush what they land on; ice keeps sliding once pushed; barrels go off and set off their neighbours; the magic wall turns falling boulders into gems and back; spore moss grows and crystallises into gems when trapped (or turns to boulders when it grows too large); creatures move; explosions run their course. The miner has its own move slot (shorter with Swift Boots, while the Stopwatch slows the cave instead). Objects remember how they moved in the last tick, so the renderer slides, drops and rolls them smoothly between ticks.

Every cave comes from a seeded generator fed by per-mode level parameters: caverns, brick and steel structures, scattered boulders, gems, ice and crystals, barrels, lava pools, a magic wall over a boulder shelf, a sealed moss chamber, creature pockets sealed in dirt, power-ups and seasonal tokens, the start and the exit. Loose objects settle, then a solver checks which cells can be dug without ever loosening a boulder or coming near a creature pocket. It softens only the blockages on the cheapest route to the exit, plants gems in safely reachable dirt until the quota is met (taking back any plant that would cut the route) and rerolls the seed if a layout cannot be made whole. Boss arenas are a dirt upper half with boulders resting on plugs above an open hall, plus dynamite to find; every hit on a boss drops another stick. An autopilot that steers by the same safety test plays the title screen's demo cave, and the tests use it to prove that every story cave can be finished in time without dying.

The view is a 1280 x 720 plane fitted into the window; the cave, its themed vista and the HUD fill every extra pixel of a wider or taller window, and pointer positions are mapped back into the plane on every event, so clicks and mouse steering stay exact after resizing or maximizing. Tiles, sprites, portraits, icons and vistas are painted once into cached canvases (dirt in sixteen edge shapes per texture, so tunnels get rounded corners and a seasonal lip of snow, grass, leaves or sand). Per frame the game only blits cached images, adds glows with cached gradient sprites (no blur filters), and lights dark caves through a light mask at one eighth resolution. Effects come from a pooled particle system (glowing motes, debris with gravity, smoke), shock rings, floating score text, screen shake, hit-stop and flashes.

Progress lives in one versioned save in `localStorage` (gold, tech tree, cosmetics, story stars and bests, high scores, statistics, achievements, quests, streak, season track); the first version's high-score list and tutorial flag are migrated into it. The running cave is written as a separate snapshot every four seconds, on pause, between caves and when the page is hidden or closed; Continue on the title rebuilds it cell for cell, including the random state, so it plays on exactly as it would have.

## Architecture

The code lives in `js/` as plain scripts on the `SZ.BoulderDash` namespace, loaded in order by `index.html` (no build step, no modules). All shared state sits in one object, `SZ.BoulderDash.state` (`G` in every module); the cave being played is one record (`run.cave`) with typed arrays for the grid, and each module states at its top what it owns.

- **`index.html`** -- Menu bar (Game: Title Screen, Pause, Tech Tree, Wardrobe, Journal, High Scores, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, dialog tables

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.BoulderDash` namespace with one object per module, so modules can call modules that load after them
- **`constants.js`** -- View plane, cell size, the 60 Hz step and the cave and miner cadences, cell type ids with their traits (falls, rounded, rolls, creature, blast-proof, walkable), directions, storage keys, scoring, UI palette
- **`rng.js`** -- Seeded generator with a storable one-number state, string hashing, local date, day and week keys
- **`data-story.js`** -- The cast, eight palettes (five depths plus Zen, Retro and Neon tile sets), the five chapters with their eight caves, the dialogue between chapters, the cinematic scripts
- **`data-items.js`** -- The eleven power-ups, the seasonal token, daily modifiers, the four creatures and the five bosses
- **`data-meta.js`** -- Game modes, the tech tree (five branches, 25 nodes), 16 skins, 12 trails, 6 tile sets, 30 achievements, the daily quest pool, the six seasons and the event track
- **`state.js`** -- The shared state object: clock, screen and curtain, save, perks, season, run, cinematic, dialogue, results, event queue, hit areas, toast, input, per-screen UI, demo cave, timings
- **`progression.js`** -- Pure progression rules: default save and migration, tree perks and purchases, gold, stats, achievements, unlocks, daily quests, streaks, seasons and their keys, the event track, story unlocks and stars, the daily seed and modifier
- **`save.js`** -- Loads and writes the save and the run snapshot (the only module touching `localStorage`), refreshes the perks

Systems (`js/systems/`), one simulation concern each:

- **`levels.js`** -- Level parameters for the 40 story caves, Arcade (a boss every tenth cave), Zen, the Daily Cave with its modifier and Time Attack; builds a cave and rerolls a layout that cannot be made whole
- **`cavegen.js`** -- The cave record, the generator (structures, scatter, lava, magic wall, moss chamber, creature pockets, items, start, exit, settling, dirt backing) and the boss arena layout
- **`solver.js`** -- The digging safety test, creature pocket and mole reach maps, the safe reachability analysis, the cheapest route to the exit, the repair and the solvability check
- **`physics.js`** -- The cave tick: falling, rolling, crushing, shields, sliding ice, barrels and chains, magic wall, lava, moss, explosions, dynamite fuses, the exit opening
- **`creatures.js`** -- Fireflies (left wall), butterflies (right wall), ice bats (straight, turn right), dozing moles that dig after the miner, contact explosions
- **`boss.js`** -- The 2x2 bosses: crawling and digging toward the miner, falling rocks, ice blocks, summoned moles, teleports, damage, dynamite drops, defeat
- **`player.js`** -- Walking, digging, drilling, collecting, pushing after a strain, grabbing, the exit, power-up effects, dynamite, the gem magnet
- **`bot.js`** -- The autopilot: breadth-first routes over proven-safe cells, danger maps, patience, fleeing, baiting bosses with dynamite
- **`fx.js`** -- Pooled particles, rings, floating text, shake, hit-stop, flashes, the dig trail, the event-to-effect-and-sound table, the Zen ambience
- **`run.js`** -- Runs in every mode: building caves with perks, scoring and the combo multiplier, gold, stats, quests, tokens, the clock, deaths, lives, clears, game over, high scores, the snapshot and its exact restore
- **`sim.js`** -- One cave step (power-up timers, the miner's slot, dynamite, magnet, the cave tick) and the top-level update per screen with the autosave timer

Render (`js/render/`):

- **`view.js`** -- The canvas fitted to the window with letterbox bleed, capped backing resolution, pointer mapping into the plane
- **`art-kit.js`** -- Offscreen canvases, colour maths, value noise and fbm, layout randoms, cached glow sprites, rounded rectangles, polygons, orbs, stars
- **`tile-art.js`** -- Cached tiles per tile set and season: two dirt textures in sixteen edge shapes, brick, steel, four boulders, gem and crystal frames, the exit and its portal, magic wall, moss, lava, ice, barrels, explosions
- **`sprite-art.js`** -- The miner for every skin in eleven poses, mirrored, with eleven hat styles, and the dialogue portraits
- **`creature-art.js`** -- Creature frames, the five bosses in two frames plus a hit flash, power-up and token icons, item bubbles
- **`backdrop.js`** -- Themed vistas with seasonal decorations, the cave back wall, seasonal garlands, ambient particles
- **`world.js`** -- The cave view: smooth camera with shake, cells with interpolated motion, snow caps, dynamite, the boss, the miner with squash and stretch and auras, the glow pass, the darkness mask
- **`fx-render.js`** -- Particles, rings, floating text and the screen flash
- **`hud.js`** -- The top band (quota, clock, score and combo, lives, dynamite, hard hats, gold), power-up rings, boss bar, banners, the Scout exit pointer, the minimap, toasts and the screen curtain
- **`frame.js`** -- One frame: the cave and HUD or the menu backdrop, the active screen, touch controls, flash, toast, curtain; draw timing

UI (`js/ui/`):

- **`kit.js`** -- Fonts, fitted and wrapped text, carved panels, buttons registering hit areas, bars, stars, gold labels, the cached logo
- **`screens.js`** -- Screen switching with a curtain, toasts, starting modes (with the story's cinematics and dialogue), Continue, pause, overlays, what follows a result
- **`cinema.js`** -- The cinematic player (eleven scene painters, letterbox bars, typed captions, skip on any key, click or tap) and the dialogue panels with portraits
- **`title.js`** -- The title: the autopilot's demo cave, the logo and seasonal ribbon, the main menu, the event and quest cards
- **`map.js`** -- The world map: Mount Ember's five depths, the trail of eight caves with stars, the cave card with Play
- **`tree.js`** -- The tech tree screen with links, level pips, costs, the detail card and Buy
- **`wardrobe.js`** -- Skins, trails and tile sets with previews, unlock hints and gold prices
- **`journal.js`** -- Quests and streak, achievements, the seasonal track and calendar, statistics, records
- **`overlays.js`** -- The pause menu and the results screen (stars, score, rank, gold, achievements)
- **`help.js`** -- Seven illustrated How to Play pages
- **`touch.js`** -- The on-screen pad, swipe-and-hold, BOMB, GRAB and pause buttons
- **`input.js`** -- Keyboard, mouse and touch routing, the direction stack, the per-step intent, menu navigation, auto-pause
- **`dom.js`** -- The window menu bar actions, the status bar and the high score dialog
- **`app.js`** -- Calendar refresh, the fixed-step loop, the once-a-second housekeeping (achievements, quests, play time, status bar), saving on hide and unload

Tests (`tests/`, run with `node tests/<name>.test.js`):

- **`harness.js`** -- A counting fake canvas, a minimal DOM and storage, and a loader running the scripts in `index.html` order
- **`play.js`** -- Plays one cave with the autopilot until it is won, lost or out of time
- **`levels.test.js`** -- Every story cave is statically solvable and finished by the autopilot in time and alive; sampled Arcade, Zen, Time Attack and Daily caves
- **`rules.test.js`** -- The cave rules on hand-drawn caves
- **`progression.test.js`** -- Tree, gold, achievements, quests, streaks, seasons, the event track, story unlocks and stars, the daily seed
- **`save.test.js`** -- Migration of the old keys, exact snapshot restore, Continue across a reload
- **`art.test.js`** -- Every screen, cinematic, mode and season draws; no shadowBlur; warm caches; a draw-call budget

## User Stories

### Digging & Physics
- [x] As a player, I can dig through dirt, collect gems and walk out of the exit once the quota is met so that every cave has a clear goal
- [x] As a player, I can see boulders and gems fall, roll off rounded things and crush what they land on, sliding smoothly between ticks, so that the cave feels physical
- [x] As a player, I can stand under a resting boulder safely and dodge it when it starts to fall so that the classic tricks work
- [x] As a player, I can push boulders, barrels and ice sideways after a short strain so that pushing feels weighty
- [x] As a player, I can grab (dig or collect beside me) without moving so that I can loosen a boulder from a safe spot
- [x] As a player, I can use magic walls, powder barrel chains, sliding ice, lava that boulders cool into brick and spore moss that crystallises when trapped so that caves have puzzles beyond digging
- [x] As a player, I can collect big crystals worth five gems so that exploration pays off

### Creatures & Bosses
- [x] As a player, I can face fireflies that follow walls on their left, butterflies that turn into gems when crushed, ice bats that fly straight and moles that wake when I come near so that every creature asks for its own tactic
- [x] As a player, I can crush creatures with boulders, sliding ice and dynamite for points so that the environment is my weapon
- [x] As a player, I can fight five bosses (Old Chomp, the Rime Wyrm, the Spore Mother, Cinderjaw and the Hollow King) with their own specials by dropping boulders and dynamite on them so that each depth ends in a showdown

### Story
- [x] As a player, I can follow Pip Ferrow, Granny Marla, Bolt and the Hollow King through five chapters of eight caves (six caves, a bonus cave, a boss) so that the game has a journey
- [x] As a player, I can watch an intro, chapter openers, boss entrances and a finale with credits, and skip any of them with a key, click or tap, so that the story is told without getting in the way
- [x] As a player, I can read dialogue panels with portraits between chapters so that the cast comes alive
- [x] As a player, I can pick caves on a world map of Mount Ember and earn up to three stars per cave (clear, par time, gem goal) so that I have reasons to replay
- [x] As a player, I can rely on every story cave being finishable, proven by an automated solver and autopilot, so that no cave is unfair

### Modes
- [x] As a player, I can play Arcade: endless caves with rising danger, bonus caves, a boss every tenth cave, three lives, a combo multiplier and a high score table
- [x] As a player, I can relax in Zen mode with no clock, no creatures, no death and soft generative chimes
- [x] As a player, I can play the Daily Cave, the same for everyone on a given day, with a daily twist (Lights Out, Gem Rain, Swarm, Quickstep, Powder Day, Glass Miner, Giant Cave), and keep my best of each day
- [x] As a player, I can play Time Attack where every gem buys a second and every exit ten

### Power-ups
- [x] As a player, I can find eleven power-ups -- Dynamite, Hard Hat, Hourglass, Gem Magnet, Power Drill, Frost Charm, Bright Lantern, Swift Boots, Lucky Clover, Stopwatch and Miner's Lamp -- each with its own icon, effect and timer ring

### Progression & Retention
- [x] As a player, I can earn gold in every mode and spend it in a five-branch, 25-node tech tree, reachable from the title and the pause menu, with immediate effect
- [x] As a player, I can unlock and wear 16 miner skins, 12 dig trails and 6 tile sets in the wardrobe
- [x] As a player, I can join seasonal events (Starfall Festival, Lantern Night, Frostlight, Bloom Days, Sunstone Summer, Harvest Moon) with their own decorations, tokens in every cave and an event track with gold, a trail and a skin
- [x] As a player, I can complete three new daily quests every day, grow a play streak for a daily gold bonus and unlock 30 achievements
- [x] As a player, I can read my lifetime statistics and records in the journal
- [x] As a player, I can close the window at any time and Continue exactly where I was, because the run saves itself every few seconds, on pause, between caves and when the page is hidden
- [x] As a player, I can keep my high scores from the earlier version of the game

### Look & Feel
- [x] As a player, I can see five themed depths with their own palettes, vistas, ambient particles and darkness lit by my lamp
- [x] As a player, I can enjoy particles, debris, shock rings, screen shake, hit-stop, flashes, floating scores, squash and stretch and sounds for every event
- [x] As a player, I can watch the autopilot dig a demo cave behind the title screen

### Controls
- [x] As a player, I can play with the keyboard, steer with the mouse or use an on-screen pad and swipes on a touch screen
- [x] As a player, I can resize or maximize the window and every click still lands where I point

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move & dig |
| Shift + direction | Grab: dig or collect without moving |
| Space | Drop dynamite |
| Escape / P | Pause menu |
| F2 | Title screen (the run is saved) |
| H | How to Play |
| Mouse | Hold to walk toward the pointer, right click for dynamite |
| Touch | On-screen pad or swipe and hold; BOMB, GRAB and pause buttons |

## SEO Keywords

boulder dash, browser game, free online game, cave game, gem collector, puzzle game, digging game, boulder physics, story mode, boss fights, daily challenge, zen mode, tech tree, seasonal events, SynthelicZ, WebOS game, HTML5 game, canvas game
