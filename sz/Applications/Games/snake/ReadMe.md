# Snake

The classic snake game grown into an adventure for the SynthelicZ Desktop. Follow Sola the garden snake through five worlds -- thirty levels with golden eggs to find and five guardian bosses to free -- to bring the stolen Sun Seeds home, or play endless Arcade, relaxing Zen, the seeded Daily Garden, Time Attack and Guardian Rush. Twelve power-ups, seven kinds of critters, ice, quicksand, spike traps, lava vents, laser gates, crates and portals, a 25-node tech tree, 20 skins, 14 trails, 14 hats and 8 board themes, six seasonal festivals, daily quests, streaks and 30 achievements -- all drawn with procedural canvas art, and every run saves itself.

## How It Works

The game runs a fixed 60 Hz simulation and draws one frame per display refresh. The view is a 1280 x 720 plane fitted into the window; the 30 x 17 board sits below a HUD strip and the theme's scenery fills every extra pixel of a wider or taller window. Pointer positions are mapped back into the plane on every event, so clicks stay exact after resizing or maximizing.

The snake still moves one cell per step. Turns are queued (up to three, never a reversal), the step clock speeds up with Dash and slows in quicksand, and the head cannot turn while it slides across ice. Between steps every body segment glides from its previous cell, so movement is smooth while the rules stay on the grid. What the head runs into decides everything: fruit grows it and builds a combo (every three fruit in time raise the multiplier), power-ups apply at once, Scale Armor turns a crash into a bounce, a Sun Shard lets it smash crates, eat critters and ram guardians, and in Zen biting your own body only sheds the tail as petals. An occupancy grid of snakes, critters and the guardian is rebuilt each step, so every collision is a single array read.

Levels are built from seeded layout motifs (open fields, pillars, rows, crosses, rings, zigzags, rooms, an arena and a braided maze) drawn with four-way symmetry, then hazards, portal pairs and crates are placed so nothing is ever cut off, unreachable pockets are walled in and three golden eggs are spread far from the start. Every story level is validated and then played to the end by the built-in autopilot in the tests -- the same breadth-first bot that plays the title-screen demo -- which proves all thirty levels, the five guardian fights included, can be cleared. Guardians telegraph every attack with flashing warning cells before it lands, and line attacks always run along the snake's heading so turning off them is always possible.

All art is procedural and painted once into cached canvases: scale discs for every skin pattern, heads with blinking eyes and hats, fruit and tokens, critters and guardians in two animation frames, board tiles per theme composed into one cached board layer (rebuilt only when a crate breaks), and full scenery per theme. Per frame the game only blits sprites, adds glows and strokes; no blur filters are used. Effects come from a pooled particle system in flat typed arrays (glows, leaves, petals, stars, hearts, snow, confetti, bats, bubbles), shockwave rings, floating score text with a pop, screen shake, hit-stop, slow motion on a guardian's defeat and screen flashes. A busy board -- a 70-segment snake, a dozen critters, every aura and 800 particles -- costs about 4 ms of script per frame in Chromium.

Progress lives in one versioned profile (scales, tree levels, story stars and best scores, freed guardians, owned and equipped cosmetics, achievements, statistics, streak, quests, festival tracks, Daily Garden bests, high scores). The old game's high-score list and options are carried over on first start (the Tron preset becomes the Light Cycle skin, veterans get the Pocket LCD board) and the old keys are left untouched. The run itself is plain data and is autosaved every three seconds, on pause, when the tab is hidden and when the page is left; Continue on the title restores it exactly, paused, and the tests prove a restored run plays on step for step like the original.

The calendar drives the rest without any server: one of six festivals runs at any date (Frostfall, Bloom Festival, Sunfest, Harvest Moon, Hollow Night, Starfall Eve) with its own decor, colour wash, token and a five-tier reward track of exclusive skins, trails and hats; three daily quests and the Daily Garden board are seeded by the local date; Arcade gets a new mutator every ISO week; and playing on consecutive days pays a growing streak gift.

## Architecture

The code lives in `js/` as plain scripts on the `SZ.Snake` namespace, loaded in order by `index.html` (no build step, no modules). All shared game state sits in one object, `SZ.Snake.state` (`G` in every module); each module states at its top what it owns.

- **`index.html`** -- Menu bar (Game: Title Screen, Pause, Tech Tree, Collection, Journal, High Scores, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, dialog tables

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.Snake` namespace with one object per module
- **`constants.js`** -- View plane, board size and placement, simulation clock, snake and combo timings, pool sizes, storage keys, UI palette and fonts
- **`rng.js`** -- Seeded generators whose state is one number, string hashing, local day and ISO week keys, day distances, clamp, lerp and easing
- **`data-worlds.js`** -- Seven board themes and the five worlds with six level recipes each (motif, fruit goal, speed, critters, hazards, crates, portals) and the five guardians
- **`data-story.js`** -- The cast and every cinematic as a list of shots with scene, speaker and line
- **`data-items.js`** -- Tile legend and hazard timing, fruit kinds, the twelve power-ups, the seven critters, the six modes
- **`data-tree.js`** -- The tech tree: five branches, 25 nodes with costs per level, prerequisites, grid slots and stats
- **`data-cosmetics.js`** -- Skins, trails, hats and board themes with their unlock rules
- **`data-goals.js`** -- Achievements, the daily quest pool, streak gifts and the statistics list
- **`seasons.js`** -- The six festivals from the local date, event ids, days left, the reward track, weekly mutators and the Daily Garden recipe
- **`levels.js`** -- Seeded board building (motifs, hazards, portals, crates, sealed pockets, eggs), the timed hazard clock, neighbours through wrap edges and portals, and the level validator
- **`rules.js`** -- Pure progression rules: default save and migration, tree states, purchases and stats, combo and fruit scoring, stars, scale rewards, story unlocks, cosmetic unlocks, the streak, quests and festival tiers
- **`state.js`** -- The shared state object: screens and return targets, profile and stats, the run, calendar, feel timers, input, hit areas, per-screen UI
- **`audio.js`** -- Sound effects through the shared `SZ.GameAudio`, the rising fruit scale for combos and the soft chime ambience
- **`save.js`** -- The only module touching `localStorage`: the v2 profile with migration, the run snapshot, and the derived stats

Systems (`js/systems/`), one simulation concern each:

- **`fx.js`** -- Pooled particles in typed arrays, rings, floating texts, shake, flash, hit-stop and slow motion
- **`board.js`** -- Tiles of the current run, the hazard clock state, guardian and imp marks (warnings turning into strikes, rocks, ice or crates), the occupancy grid, free-cell picking
- **`food.js`** -- Fruit, gems, festival tokens, Sun Shards and Fruit Rain; the magnet; eating with combo, growth and scores
- **`powerups.js`** -- The power-up on the board and every effect, timed or instant
- **`enemies.js`** -- Critter spawning, step clocks and the seven behaviours, including rival snakes with path finding
- **`bosses.js`** -- The five guardians as state machines with telegraphed attacks, recoils and phases
- **`combat.js`** -- Venom spits, crate smashing, defeating critters, Quake and hazard strikes
- **`snake.js`** -- The player's snake: turn queue, step clock, one grid step with everything the head can meet, armour, Zen cuts, death and the cosmetic trail
- **`autopilot.js`** -- The breadth-first bot for the demo and the completability tests, aware of ice slides, portals, strikes and guardians
- **`progress.js`** -- Statistics, quests, achievements, festival tokens and tiers, the streak gift, scale income and the toast queue
- **`run.js`** -- Building runs for every mode, countdowns, the exit gate, Arcade stages, clocks, deaths and respawns, guardians falling, results and rewards, Save & Quit and restoring a snapshot
- **`cine.js`** -- Plays cinematics shot by shot with typewriter text, skipping and hand-back
- **`sim.js`** -- One fixed step: the calendar, feel timers and every system in order

Render (`js/render/`):

- **`view.js`** -- The canvas fitted to the window (letterboxed plane, capped backing resolution), resize and maximize, pointer mapping
- **`art-kit.js`** -- Offscreen canvases, the sprite cache, colour maths, noise, glow, smoke and ring sprites, silhouettes
- **`tile-art.js`** -- Floor, wall, crate, rock, ice, quicksand and hazard-base tiles per theme, composed into the cached board layer
- **`snake-art.js`** -- Scale discs for every skin pattern, heads, hats, the light-cycle line, and the tapering body chain used by every snake
- **`item-art.js`** -- Fruit, gems, eggs, shards, festival tokens, power-up orbs, the exit gate, the icon set and particle shapes
- **`creature-art.js`** -- The critters and the guardians (with dirt mound and flight shadow)
- **`backdrop.js`** -- Scenery per theme covering the whole window, drifting clouds and glows, the festival decor and colour wash
- **`world.js`** -- The board in play: traps, portals, warnings and strikes, the gate, fruit, power-ups, venom, critters, rivals, the guardian, the player's snake with its auras, Firefly Night darkness
- **`fx-render.js`** -- Particles in two layers, rings and floating texts
- **`hud.js`** -- Score, combo meter, goal, guardian health, timers, lives, armour, venom and power-up timers; banners, countdown, captions, flash and toasts
- **`cine-render.js`** -- The cinematic scenes, bars, dialogue box, portraits and typewriter text
- **`frame.js`** -- One frame: the right background, the active screen, touch buttons, fades, flash and toasts

UI (`js/ui/`):

- **`kit.js`** -- Text, panels, bars, stars, locks, icons, the scale counter and the logo
- **`widgets.js`** -- Hit areas registered while drawing, the keyboard cursor, buttons
- **`screens.js`** -- Screen switching, return targets, pause and resume, leaving to the title
- **`title.js`** -- The title over the demo board: Continue, the modes, profile and quests, the festival card
- **`map.js`** -- The world map with world tabs, the level trail and the level card
- **`tree.js`** -- The tech tree screen with immediate effect mid-run
- **`wardrobe.js`** -- The collection: skins, trails, hats and boards with previews, buying and equipping
- **`journal.js`** -- Quests, streak and festival track; achievements; statistics and high scores
- **`results.js`** -- The end of a run: headline, stars, score, numbers, scales and the way on
- **`pause.js`** -- The pause menu with Save & Quit and a confirmed End Run
- **`help.js`** -- Five illustrated How to Play pages
- **`touch.js`** -- Swipe turning and the on-screen venom and pause buttons
- **`status-bar.js`** -- The window status bar and the High Scores dialog
- **`input.js`** -- Keyboard, mouse and touch, cinematic skipping, autosave when the page hides or closes
- **`app.js`** -- Start-up, the menu bar and the fixed-step loop

Tests (`tests/`, run with `node tests/<name>.test.js`):

- **`harness.js`** -- A recording fake canvas, minimal DOM and storage, and the script loader
- **`levels.test.js`** -- Every story level validates, every motif builds valid boards, and the autopilot clears all thirty levels including the five guardians
- **`progression.test.js`** -- Tree costs, states and stats; scoring, stars and rewards; story unlocks; cosmetics; streaks; quests; festival dates, event ids and tracks; weekly and daily seeds
- **`save.test.js`** -- Migration of the old keys, loading and repairing the profile, and exact restoration of autosaved runs
- **`systems.test.js`** -- Every power-up, armour, Zen cuts, venom, critter behaviours, Arcade stages, the clocks of Time Attack and the Daily Garden, and a full Guardian Rush cleared by the autopilot
- **`scene.test.js`** -- Boot, every screen and cinematic, modes from the keyboard, the draw-call budget of a busy board, no `shadowBlur`, a bounded sprite cache

## User Stories

### Playing
- [x] As a player, I can steer with the arrow keys or WASD, queue quick turns and never reverse into myself by accident
- [x] As a player, I can see my snake glide smoothly between cells with blinking eyes, a flicking tongue and a bulge travelling down after every bite
- [x] As a player, I can build combos by eating quickly and watch the multiplier, the rising pitch and the bursts grow with them
- [x] As a player, I can spit venom with Space to break crates, defeat critters and chip guardians
- [x] As a player, I can click beside the snake's head or swipe on a touch screen to turn

### Story
- [x] As a player, I can follow Sola's journey through five worlds with an intro, chapter arrivals, guardian reveals, guardians freed and a finale, and skip any of it with a key, click or tap
- [x] As a player, I can choose levels on a world map, see their goals, critters and hazards, and earn three stars per level: clear, all golden eggs, no crash
- [x] As a player, I can eat the fruit goal and then reach the exit gate, deciding whether to grab the last eggs first
- [x] As a player, I can fight five guardians with their own attacks - a burrowing mole, a stinging scorpion, a diving owl, a fire wyrm and the Hollow Eclipse - by eating Sun Shards and ramming them while I shine

### Modes
- [x] As a player, I can play endless Arcade with stages that speed up, change scenery, add crates and critters, and a weekly mutator
- [x] As a player, I can relax in Zen with no crashes or clock, where biting my tail just sheds petals, to soft chimes
- [x] As a player, I can play a new seeded Daily Garden every day, with two mutators and my best score kept per day
- [x] As a player, I can race Time Attack, where golden apples buy seconds
- [x] As a player, I can face every guardian I have freed back to back in Guardian Rush

### Power-ups, Critters and Hazards
- [x] As a player, I can pick up twelve power-ups: Dash, Time Warp, Scale Armor, Magnet, Phase, Molt, Golden Fangs, Fruit Rain, Quake, Frost Nova, Sun Shard and Venom Sac
- [x] As a player, I can meet ants to eat, marching beetles, hornets flying over walls, fruit-stealing hedgehogs, rival snakes, frost wisps and fire imps
- [x] As a player, I can navigate ice, quicksand, spike traps, lava vents, laser gates, crates and portals, each with a clear warning before it hurts

### Progression and Collection
- [x] As a player, I can earn scales in every mode and spend them on a 25-node tech tree from the title or the pause menu, with immediate effect
- [x] As a player, I can collect and equip 20 skins, 14 trails, 14 hats and 8 board themes, bought with scales or earned through stars, guardians, achievements and festivals
- [x] As a player, I can unlock 30 achievements with scale rewards and read my lifetime statistics and high scores in the journal

### Coming Back
- [x] As a player, I can close the game at any moment and continue my run exactly where I left it
- [x] As a player, I can play three new daily quests each day and get a growing gift for every day in a row
- [x] As a player, I can enjoy the running festival's decor and collect its tokens for exclusive skins, trails and hats
- [x] As a player, I can keep my high scores and favourite look from the old version of the game

### Screens and Controls
- [x] As a player, I can resize or maximize the window and keep exact click mapping, with the scenery filling the extra space
- [x] As a player, I can have the game pause and save when the tab is hidden
- [x] As a player, I can read five illustrated How to Play pages

### Planned Features
- [ ] As a player, I can race a friend on the same keyboard
- [ ] As a player, I can design my own levels

## Controls

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Turn the snake |
| Space | Spit venom |
| Mouse | Click beside the head to turn that way; right click spits |
| Touch | Swipe to turn; buttons for venom and pause |
| Esc / P | Pause |
| T | Tech tree |
| B | Buy the selected tech tree node |
| H | How to Play |
| Enter / Space | Choose in menus, continue in cinematics |
| F2 | Title screen (the run is saved) |
