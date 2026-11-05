# Bomberman

The grid-and-bombs classic for the SynthelicZ Desktop, grown into *Spark Quest*: Baron Blackfuse has stolen the Spark Core of Fuse Village and split it into five Embers, and Pip blasts through Meadow Gardens, the Frostbite Caverns, the Ember Foundry, the Neon Circuit and the Shadow Keep to bring them home. 35 story stages with five bosses and comic cinematics, Arcade, Zen, a seeded Daily Challenge and Boss Rush, 15 power-ups, ten enemy kinds, a 25-node tech tree, a wardrobe of skins, bomb skins and trails, achievements, daily quests, a weekly challenge, play streaks and a seasonal event every season - all drawn with procedural canvas art and saved in the browser, with the current run continuing after a reload.

## How It Works

The game runs a fixed 60 Hz simulation and draws one frame per display refresh. The view is a 1280 x 720 plane fitted into the window; the 19 x 13 arena (48-pixel tiles) sits in its middle between the player card and the score card, and the world's scenery fills every extra pixel of a wider or taller window. Pointer positions are mapped back into the plane on every event, so clicks stay exact after resizing or maximizing.

Pip moves smoothly on the grid with lane assist: pressing toward an opening while slightly off its lane slides him around the corner. Bombs block movement once you step off them; Kick Boots send them sliding until something stops them, the Power Glove throws them three tiles over walls, Remote Fuse bombs wait for the detonate key, Pierce blasts punch through every brick in line, and steel crates take two blasts and stop any fire. A blast that reaches another bomb sets it off, and every bomb of one chain shares a blast group: enemies defeated by one group score 2x, 3x, 4x... per kill, and quick kills raise a combo multiplier up to x8. Each world adds a twist: steel crates in the Meadow, ice that keeps you sliding (steerable sideways at cell centres) in the Caverns, conveyor belts that carry players and resting bombs in the Foundry, paired teleport pads in the Neon Circuit and darkness in the Keep, where only Pip's glow, fire, bombs and the exit give light. When the stage timer runs out, wisps hunt the player; they never keep the exit shut.

Enemies move tile to tile with their own minds: puffballs drift, zappers turn toward the player at crossings, hoppers change course every tile, hunters path-find to the player, wisps float through bricks, brutes take three hits and grow faster, imps drop bombs, blobs split into bloblings and chargers rush when they see you; the smart ones see fuses about to blow most of the time. Bosses are large actors running an attack cycle - chase, burrow, falling rocks, summons, rings, ice shards, crosses, strafes, fire columns and rows, bomb rain, lasers, dashes and teleports - announced by blinking danger tiles that turn into fire a moment later; at half health they enrage with a faster, nastier cycle. Player fire hurts them, kicked bombs burst on contact, and a fallen boss leaves the exit and a pile of gems.

Story stages are the hand-drawn opener of each world and its boss arena plus five generated stages per world. The generator lays out pillars (classic, rooms, plaza, ring or cross), places the world's twist, bricks, the hidden exit, power-ups, gems and seasonal tokens, and enemies away from the spawn, then validates the result: no sealed pockets, a safe first bomb, the exit under a brick, enemies off the spawn's doorstep, teleporters in pairs. A failing layout is regenerated from the next seed. The tests prove every stage completable by letting a bot play the whole campaign in the real simulation.

The long game is driven by one versioned save in `localStorage`: gems from every mode buy tech tree levels (also from the pause menu, taking effect at once) and wardrobe items; stars, ranks, achievements, daily quests (the same three for everyone each day), a weekly featured challenge, the play streak bonus and the seasonal event track (snowflakes in winter, painted eggs in spring, seashells in summer, pumpkins in autumn, gifts at the year-end festival, each with its own decorations, particles, a bomb skin, a trail and a skin) all live there. The first version's high-score list and tutorial flag are migrated once, with a gem bonus for veterans. The current run is a plain JSON object that is saved every few seconds, on pause, at every stage and when the page is hidden or closed; the title offers Continue and restores it exactly.

All art is procedural and painted once into cached canvases: themed tiles per world with seasonal decorations, the bomber in thirteen skins (four facings, four walk frames), ten enemies with animation frames, five bosses, bombs per skin, fire pieces at three intensities, power-up tiles, vector icons and five world backdrops plus the village and lab scenes. Each level's floor and stone layer is baked into one canvas. Per frame the game blits sprites and draws additive glows; no blur filters are used. Effects come from a fixed particle pool (sparks, embers, smoke, debris, confetti, leaves, stars) with shockwave rings, hit-stop, screen shake, flashes, squash and stretch, banners and floating score text.

## Architecture

The code lives in `js/` as plain scripts on the `SZ.Bomberman` namespace, loaded in order by `index.html` (no build step, no modules). All shared state sits in one object, `SZ.Bomberman.state` (`G` in every module); each module states at its top what it owns.

- **`index.html`** -- Menu bar (Game: Title Screen, Pause, Tech Tree, Wardrobe, High Scores, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, dialog tables

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.Bomberman` namespace with one object per module, so modules can call modules that load after them
- **`constants.js`** -- View plane and arena placement, tile codes, simulation clock, bomb, fire, movement, dash and power-up timings, scoring, autosave cadence, storage keys, UI palette
- **`rng.js`** -- Seeded mulberry32 generators (also resumable from a saved state number), string hashing, local day, day-number and week keys, easing helpers
- **`data-story.js`** -- The cast, the five worlds (palettes, twists, enemy mixes, bosses), the hand-designed maps and the twelve cinematic scripts
- **`data-content.js`** -- The 15 power-ups and the curses, ten enemy kinds, five bosses with their attack cycles, the daily modifiers
- **`data-meta.js`** -- Tech tree branches and nodes, skins, bomb skins, trails, achievements, quest templates, seasons, event tiers and ranks
- **`season.js`** -- Calendar logic: season and season key for a date, days left, the daily challenge seed and modifiers, the weekly challenge
- **`rules.js`** -- Pure rules: the fresh save and its repair and migration, tree costs, states and perks, story unlocks and stars, gem payouts, ranks, cosmetics, achievements, streaks, quests, the event track, score tables, the combo multiplier
- **`state.js`** -- The shared state object: screens and return targets, save, perks, season, the run, effect pools, feel timers, input, hit areas, per-screen UI
- **`save.js`** -- The only module touching `localStorage`: loads and writes the v2 save, refreshes perks, opens the session for a date (season, streak, quests, weekly, event) and keeps the autosaved run for Continue

Systems (`js/systems/`), one simulation concern each:

- **`levelgen.js`** -- Map parsing, seeded layout generation with twists, hidden items and enemy placement, the validator, and the stage lists of every mode
- **`arena.js`** -- Tile queries, per-step caches (bomb and enemy occupancy, teleporter pairs), walkability per mover, breaking bricks and crates and revealing what they hid
- **`fx.js`** -- The particle pool, rings, floating texts, shake, hit-stop, flashes, banners and the sound wrapper (quieter in Zen)
- **`bombs.js`** -- Placing bombs (player, Mega Bomb, imps, bosses), fuses, remote detonation, kick slides, glove throws, belts, detonation into fire arms with chains and pierce, fire timers
- **`items.js`** -- Pickups: spawning, burning, magnet pull, collection and every power-up, gem, token and curse effect
- **`player.js`** -- The loadout from perks, grid movement with lane and corner assist, ice, belts, teleporters, kick and throw, intents, dash, curses, trail, damage, shield, Phoenix, Zen bumps, death and respawn
- **`enemies.js`** -- Spawning, tile-to-tile movement, the nine AI kinds with danger awareness, Time Freeze, damage, death, chain and combo scoring, splitting and loot
- **`bosses.js`** -- Boss actors, attack cycles and phases, telegraphed fire, rocks and lasers, crushing bricks, damage and the dying sequence
- **`run.js`** -- Starting each mode, building and entering stages with their cinematics, the objective, timers and Hurry Up, scoring, stage clears with stars and gems, game over, Save & Quit, Abandon and Continue
- **`tracker.js`** -- Lifetime stats and records, seasonal tokens, play time, the achievement and unlock check with toasts
- **`sim.js`** -- One fixed step in order, the damage pass, the Zen ambience and floating seasonal tokens

Render (`js/render/`):

- **`view.js`** -- Canvas sizing, letterboxed plane transform, visible rect and pointer mapping
- **`art-kit.js`** -- Offscreen canvases, the keyed sprite cache, colour math, glows, rounded rectangles, shiny balls
- **`icons.js`** -- Vector icons for power-ups, perks, menus and tokens, cached per colour and size
- **`tile-art.js`** -- World tiles, belts, teleporters, the exit, seasonal decorations and the baked floor-and-stone layer
- **`actor-art.js`** -- The bomber in every skin and pose, Professor Fuse, and the ten enemies
- **`boss-art.js`** -- The five bosses and white hit-flash silhouettes
- **`item-art.js`** -- Bombs per skin, fire pieces, power-up tiles, gems, seasonal tokens, shadows
- **`backdrop.js`** -- The seven scenes painted once at 1600 x 900, live touches, the seasonal tint and ambient particles
- **`world.js`** -- The arena frame and layers, animated tiles, exit, telegraphs, pickups, row-sorted bricks, bombs, enemies, player and boss, fire, Radar and darkness
- **`fx-render.js`** -- Particles (normal then additive), rings and floating texts, culled to the view
- **`hud.js`** -- Player card, score card, top bar with timer or boss health, READY/GO, banners, flash and toasts
- **`cine-render.js`** -- Cinematic shots: scene, stage floor, animated actors, letterbox, speech box with portrait and typed text, Skip
- **`frame.js`** -- One frame: cinematic, arena or menu backdrop, the active screen, the confirmation modal, flash and toasts, draw timing

UI (`js/ui/`):

- **`kit.js`** -- Fonts, fitted and wrapped text, panels, bars, stars, gem counters, the logo, buttons and hit areas with the keyboard cursor
- **`screens.js`** -- Screen switching with return targets, pause and resume, the confirmation modal, toasts
- **`modes.js`** -- Mode descriptions and the guard before a new run replaces a saved one
- **`cine.js`** -- Cinematic playback: typing, shot effects, advance and skip
- **`title.js`** -- Title screen: animated logo and vignette, profile, Continue, modes, event card, quests, daily and weekly cards, menu buttons
- **`map.js`** -- World map with realm badges, stage nodes, stars and briefing
- **`tree.js`** -- Tech tree screen with live purchases
- **`wardrobe.js`** -- Skins, bombs and trails with previews, unlock conditions, buying and equipping
- **`goals.js`** -- Quests, weekly challenge and streak; achievements; the event track with claims
- **`stats.js`** -- Lifetime statistics and the score tables per mode
- **`results.js`** -- Stage and run results with stars, score count-up, gems and the way on
- **`pause.js`** -- Pause menu with tree, wardrobe, goals, help, Save & Quit and Abandon
- **`help.js`** -- Five How to Play pages
- **`touch.js`** -- Thumb pad and BOMB/BOOM/MEGA/DASH buttons for touch screens
- **`input.js`** -- Keyboard, mouse (click to walk, click Pip to bomb) and touch routing, menu navigation, auto-pause
- **`status-bar.js`** -- The window status bar and the High Scores dialog
- **`js/app.js`** -- Session start, the fixed-step loop, art pre-warming, saving on hide and unload, the menu bar

Tests (`tests/`, run each with `node tests/<name>.test.js`):

- **`harness.js`** -- Fake canvas, DOM, storage and clock; loads the scripts in `index.html` order
- **`bot.js`** -- A bot that plays through the real simulation (proof mode and a careful mode)
- **`boot.test.js`** -- Boots the game, opens every screen, plays every mode, every cinematic and every menu action
- **`completability.test.js`** -- Validates all 35 story stages and has the bot clear the whole campaign, ten arcade arenas, three Zen gardens, the daily set and the boss rush
- **`mechanics.test.js`** -- Blasts, chains, kick, throw, remote, pierce, crates, ice, belts, teleporters, burning pickups, the exit, scoring, damage, shield, respawn, Phoenix, Zen, Hurry Up and boss damage
- **`rules.test.js`** -- Tree, perks, stars, unlocks, payouts, ranks, cosmetics, achievements, streaks, quests, the event track and score tables
- **`save.test.js`** -- Migration of the old keys, save repair, storage errors, and autosave and Continue across a reload
- **`season.test.js`** -- Season boundaries and keys, the daily challenge and the weekly challenge
- **`art.test.js`** -- Every sprite paints, cache size, draw-call budgets of a busy dark arena and every screen, no `shadowBlur`

## User Stories

### Moving & Bombing
- [x] As a player, I can move Pip smoothly on the grid and slip around corners when I press toward an opening slightly off its lane
- [x] As a player, I can drop bombs that explode into four fire arms after a fuse, burning bricks, enemies and myself
- [x] As a player, I can set off chains of bombs and score 2x, 3x, 4x per enemy defeated by one chain
- [x] As a player, I can keep defeating enemies quickly to raise a combo multiplier up to x8
- [x] As a player, I can click a tile to walk there and click Pip to drop a bomb, or use a thumb pad and buttons on a touch screen

### Power-ups
- [x] As a player, I can find Bomb Up, Fire Up, Roller Skates, Kick Boots, Power Glove, Remote Fuse, Pierce Bomb, Bubble Shield, Wall Walker, Bomb Hopper, Full Fire, Time Freeze, Gem Magnet and Extra Life under bricks
- [x] As a player, I can risk a Cursed Skull that scrambles me for ten seconds unless I blast an enemy to lift it
- [x] As a player, I must grab power-ups quickly because fire burns them

### Worlds & Twists
- [x] As a player, I can blast steel crates that take two hits, slide across ice, ride conveyor belts, hop between teleport pads and find my way in the dark
- [x] As a player, I can find the exit under a brick and leave once every enemy is gone, before Hurry Up sends wisps after me

### Enemies & Bosses
- [x] As a player, I can face puffballs, zappers, hoppers, hunters, wisps, brutes, imps, blobs and chargers that each behave differently
- [x] As a player, I can fight King Gnarl, Rimefang, Clinker, MB-9 and Baron Blackfuse, read their glowing danger tiles and watch them enrage at half health

### Story
- [x] As a player, I can follow Pip, Nova and Professor Fuse through an intro, five chapter openers, five boss entrances and a finale, skipping any of them
- [x] As a player, I can choose stages on a world map and earn up to three stars per stage for clearing it, taking no damage and beating par time

### Modes
- [x] As a player, I can play endless Arcade arenas with a boss every fifth arena and a top-10 table
- [x] As a player, I can relax in Zen gardens where nothing hurts me, soft notes play and gems are everywhere
- [x] As a player, I can take on today's Daily Challenge with three modifiers and one life
- [x] As a player, I can fight all five bosses in a Boss Rush against the clock

### Progression & Retention
- [x] As a player, I can spend gems from every mode on a five-branch tech tree, also from the pause menu with immediate effect
- [x] As a player, I can collect and wear skins, bomb skins and trails in the wardrobe
- [x] As a player, I can complete daily quests, a weekly featured challenge and 28 achievements for gems
- [x] As a player, I can earn a growing bonus for playing on consecutive days
- [x] As a player, I can collect seasonal tokens during each season's event and claim its rewards, while the arenas wear the season's look
- [x] As a player, I can watch my rank rise and read my lifetime statistics and high scores

### Saving
- [x] As a player, I can close or reload the page at any moment and Continue my run exactly where I left it
- [x] As a player, I can Save & Quit from the pause menu or abandon a run and keep its gems
- [x] As a returning player, I keep my old high scores, and veterans get a gem bonus

### Planned Features
- [ ] As a player, I can battle a friend on the same keyboard
- [ ] As a player, I can build my own arena and share it as a code

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move |
| Space / Z | Drop a bomb (with the glove: throw it) |
| X / E | Detonate remote bombs |
| C | Mega Bomb (tech tree) |
| Shift | Dash (tech tree) |
| Escape / P | Pause menu |
| B | Buy the selected tech tree node |
| Tab | Switch wardrobe / goals tab |
| F2 | Title screen (the run is saved) |
| H | How to Play |
| Mouse | Click a tile to walk there, click Pip or right-click to drop a bomb |
| Touch | Thumb pad on the left, BOMB / BOOM buttons on the right |

## SEO Keywords

bomberman, bomb game, browser game, free online game, arcade game, boss fights, tech tree, zen mode, daily challenge, seasonal events, SynthelicZ, HTML5 game, canvas game
