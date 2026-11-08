# Pac-Man

The maze chase for the SynthelicZ Desktop, grown into a full campaign. The Hollow King has swallowed the five Lumens that light Pac-Land; with Pip, the last spark, Pac-Man eats his way through Neon Downtown, Sugarcane Gardens, Glacier Grid, Hollow Woods and Ember Core - twenty mazes, five bosses, cinematics between the chapters. Around the story sit Arcade score attack, a relaxing Zen mode, a seeded Daily Maze and Boss Rush; twelve power-ups, seven kinds of ghost, tile twists, a tech tree, skins, trails, maze themes, daily quests, a play streak, achievements and seasonal events. Runs save themselves and continue after a reload. All art is procedural canvas drawing.

## How It Works

The game runs a fixed 60 Hz simulation and draws one frame per display refresh. The view is a 1280 x 720 plane fitted into the window: the 28 x 31 tile maze sits in the middle with the HUD panels beside it, and each world's scenery fills every extra pixel of a wider or taller window. Pointer positions are mapped back into the plane on every event, so clicks stay exact after resizing or maximizing.

Movement is tile-exact: an actor travels along its direction and decides at every tile centre (wrapping through tunnels). Pac-Man takes a buffered turn as soon as the way opens, can reverse at any time (except on ice or right after an arrow pad), and with Slick Turns corners a third of a tile early. Blinky, Pinky, Inky and Clyde keep their original targeting, scatter/chase rhythm, house release and Cruise Elroy; the Gobbler hunts the nearest dots (eat it frightened for a jackpot), the Dasher charges down straight halls when it sees you, and the Phantom drifts straight through walls. Dots eaten in quick succession build a chain and fill the multiplier (up to x5, x8 with the tree); it drains when you dawdle and resets when you are caught.

Mazes are plain data. The original layout is kept; all others come from a seeded generator that opens and closes segments of a mirror-symmetric corridor lattice around the standard ghost house, keeping every node at two or more exits and the network connected, then places the world's twists (arrow pads, taffy, ice runs, portal pairs, fire vents) and the four power pellets. A validator proves each maze symmetric, fully reachable and free of dead ends, and a second pass treats pads and portals as one-way moves to prove there are no traps. Every story stage is additionally cleared by the autopilot in the real simulation in the tests. Boss stages use an open arena: the boss floats through the walls, telegraphs charges, fires shard rings, drops sticky puddles, calls minions or blinks away, and can only be bitten while Pac-Man is powered up - one bite per pellet, with pellets growing back.

All art is painted once into cached canvases: the maze layer per maze and look (rounded wall shapes from the tile grid, a soft glow, a bright rim, a gradient body with the world's texture), Pac-Man in sixteen skins with seven mouth frames, ghosts per colour and kind with two skirt frames, eyes per direction, frightened bodies, the five bosses with scared and hit-flash variants, capsules, fruit, tokens, icons and six painted backdrops with seasonal decor. Per frame the game only blits sprites, draws additive glows and a few paths; no blur filters are used. Effects are pooled particles (glows, sparks, chunks, confetti, trail shapes), shockwave rings, floating scores, screen shake, hit-stop, slow motion, flashes, an iris wipe and squash-and-stretch. A busy frame (every power-up active, hundreds of particles) issues about 1,500 canvas calls and takes under 2 ms of script.

Progress lives in one versioned profile in `localStorage` (shards, tree, cosmetics, story stars, bests, high scores, statistics, achievements, quests, streak, season track); the first version's high-score list is migrated into it once, with a shard bonus for veterans. The current run is a separate plain-data record saved every four seconds, on pause, after every maze and when the page is hidden or closed; Continue on the title restores it exactly.

## Architecture

The code lives in `js/` as plain scripts on the `SZ.Pacman` namespace, loaded in order by `index.html` (no build step, no modules). All shared state sits in one object, `SZ.Pacman.state` (`G` in every module); each module states at its top what it owns.

- **`index.html`** -- Menu bar (Game: Title Screen, Continue, Pause, Tech Tree, Wardrobe, Goals, High Scores, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, dialog tables

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.Pacman` namespace with one object per module, so modules can call modules that load after them
- **`constants.js`** -- View plane and maze placement, simulation clock, tile, wall, dot, feature and direction codes, speeds, timings, scoring, pool sizes, UI palette
- **`rng.js`** -- Seeded mulberry32 generators, string hashing, local day, day-number and week keys, easing
- **`data-worlds.js`** -- The cast, five worlds (palette, backdrop, twists, roster, four maze seeds, boss), five bosses and every cinematic script
- **`data-items.js`** -- Twelve power-ups, seven ghost kinds, the fruit ladder, the five modes and six daily modifiers
- **`data-tree.js`** -- The tech tree: five branches, 25 nodes with costs, prerequisites, placement and per-level text
- **`data-cosmetics.js`** -- Sixteen skins, twelve trails, six maze themes with their unlocks, six seasonal events with dates, tokens and reward tracks
- **`data-goals.js`** -- 28 achievements, the daily quest templates, the lifetime statistics, the streak bonus
- **`mazes.js`** -- The classic layout, the lattice generator, twist placement, the validator and the one-way play check
- **`rules.js`** -- Pure rules: the profile and its migration, tree states and derived stats, difficulty per maze, shard payouts, high scores, cosmetics, stats, quests, streak, achievements
- **`seasons.js`** -- The running event from the local date, event keys across new year, days left, reward tiers, the daily maze and weekly twist
- **`state.js`** -- The shared state object
- **`save.js`** -- The only module touching `localStorage`: profile load, migration and write, the run autosave, day roll-over
- **`audio.js`** -- Sound effects through `SZ.GameAudio`, the alternating chomp, Zen's soft chimes
- **`music.js`** -- Soundtrack through the shared `SZ.GameMusic`: a theme per world (electro downtown, a sugary chiptune in the gardens, trance across the glacier grid, a dark synthwave in the hollow woods, a dubstep rumble in the ember core), a heavier theme for every boss, a menu theme, calm Zen and a fast theme for Boss Rush and the Daily. Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop, breakdown, every pass a little different); every story maze plays a song of its own made from its world's theme. Bosses, power pellets and the last life raise the intensity: layers come in and the music pushes into the drop.

Systems (`js/systems/`), one simulation concern each:

- **`grid.js`** -- Tile lookups with tunnel wrap, walkability per walker, the travel routine with decisions at tile centres, breadth-first distance maps
- **`fx.js`** -- Pooled particles, rings, floating texts, shake, flashes, hit-stop, slow motion
- **`level.js`** -- Building a maze for the mode and stage, the phase machine, scatter/chase and fright clocks, scoring with the multiplier, being caught (shield, Second Wind, Zen bump, a life)
- **`pac.js`** -- Pac-Man: speed, turns, reversing, cornering, pads, ice, taffy, portals, eating, the chain, the magnet, the blaster, trails
- **`ghosts.js`** -- The house, classic targeting, Elroy, the Gobbler, Dasher and Phantom, fright, freezing, stuns, eating ghosts, the touch with Pac-Man
- **`powerups.js`** -- Switching power-ups on, banners, timers, the Boo Bomb blast, the Decoy
- **`pickups.js`** -- Power-up capsules, bonus fruit and seasonal tokens: spawning, blinking, collecting, the event track
- **`hazards.js`** -- Blaster shots, boss shards and puddles, fire vents, the boss arena's pellets growing back
- **`boss.js`** -- Boss fights: entrance, hunting and fleeing, the attack cycle, bites, chip damage, enrage, the slow-motion death
- **`run.js`** -- A run per mode, Continue, per-step clocks and autosave, advancing after a maze (chapters, relightings, the ending), shard payouts, the final tally
- **`autopilot.js`** -- The attract-mode player: a danger map from every threat and a safe breadth-first search to the next goal (also used to prove levels completable)
- **`cinematics.js`** -- The cinematic sequencer: shots, sound cues, typing, skipping, remembering what was seen
- **`sim.js`** -- One fixed step: clocks, cinematics, input or autopilot, hit-stop, slow motion, the run and the maze

Render (`js/render/`):

- **`art-kit.js`** -- Offscreen canvases, the sprite cache, colour maths, value noise, glow, halo and ring sprites
- **`view.js`** -- Canvas fitting, backing resolution cap, the visible plane, pointer mapping, resize and maximize
- **`maze-art.js`** -- The cached maze layer (floor, wall shapes, glow, rim, texture, gate, twists), dot and pellet sprites
- **`actor-art.js`** -- Pac-Man skins and mouth frames, the death, ghost bodies per kind, eyes, frightened bodies, ice, the bosses
- **`item-art.js`** -- The glyph icon set, power-up capsules, fruit, seasonal tokens, trail and weather shapes
- **`backdrop.js`** -- Six painted backdrops, seasonal decor, pooled ambient weather
- **`fx-render.js`** -- Particles, rings and floating texts
- **`world.js`** -- The play field: the look (world, theme, season), bezel, maze, dots, twists, items, decoy, ghosts, boss, Pac-Man, shots, darkness
- **`hud.js`** -- The side panels, boss bar, call-outs and banners, plus flash, wipe, toasts and achievement pop-ups
- **`cine-render.js`** -- Cinematic scenes: Pac-Land, the theft, talking heads, chapter cards, boss entrances, relightings, credits, the intermission
- **`frame.js`** -- One frame: cinematic or world and HUD, then the active screen and overlays

UI (`js/ui/`):

- **`kit.js`** -- Text, fitted and wrapped text, cached neon panels, bars, stars, locks, icons, shards, the logo
- **`widgets.js`** -- Hit areas registered while drawing, buttons, tabs, the keyboard cursor
- **`screens.js`** -- Screen switching, pause and resume, return targets, starting each mode with its cinematics, Continue, toasts, pop-ups
- **`status-bar.js`** -- The window status bar and the High Scores dialog
- **`touch.js`** -- Swipe steering, the on-screen pad and pause button
- **`title.js`** -- The title over the attract demo: Continue, modes, shortcuts, player card, season and daily panels, confirm box
- **`map.js`** -- The world map with islands, stars, stage buttons
- **`tree.js`** -- The tech tree screen with immediate effect mid-run
- **`wardrobe.js`** -- Skins, trails and maze themes: equip, buy, unlock hints, live preview
- **`goals.js`** -- Quests and streak, achievements, lifetime records and high scores
- **`season.js`** -- The seasonal event: track, calendar, weekly twist
- **`help.js`** -- Five illustrated How to Play pages
- **`pause.js`** -- The pause menu
- **`results.js`** -- The end of a run
- **`input.js`** -- Keyboard, mouse and touch routing, buffered turns, saving on page hide
- **`app.js`** -- The loop, the menu bar, art pre-painting, start-up

Tests (`tests/`, run with `node tests/<name>.test.js`):

- **`harness.js`** -- A recording fake canvas, a minimal DOM and storage, the loader in `index.html` order, stepping and the autopilot playing a maze
- **`boot.test.js`** -- Every screen, tab and cinematic, every mode starting, the tree from the pause menu with immediate effect, no shadowBlur per frame
- **`mazes.test.js`** -- The classic maze, 400 generated mazes with every twist, boss arenas, determinism, all 25 story stages valid, and the autopilot clearing every one in the real simulation
- **`progression.test.js`** -- Tree states, costs and stats, difficulty, shards, high scores, cosmetics, quests, streak, achievements
- **`save.test.js`** -- Migration of the old high scores, repair of damaged profiles, round trip, autosave and exact Continue after a reload, storage failures
- **`seasons.test.js`** -- Event boundaries, keys across new year, days left, reward tiers, daily and weekly seeds
- **`art.test.js`** -- Every sprite paints and is cached, draw-call budgets for busy play, darkness, a boss and every menu, no canvases created per frame

## User Stories

### Maze & Ghosts
- [x] As a player, I can steer Pac-Man with the arrows or WASD, with turns remembered until the corner
- [x] As a player, I can eat dots and power pellets and turn the tables on frightened ghosts for 200, 400, 800 and 1600 points
- [x] As a player, I can face Blinky, Pinky, Inky and Clyde with their original personalities, plus the dot-stealing Gobbler, the charging Dasher and the wall-drifting Phantom
- [x] As a player, I can wrap through tunnels and use arrow pads, taffy, ice, portals, darkness and fire vents
- [x] As a player, I can build a dot chain and a multiplier of up to x8

### Power-ups
- [x] As a player, I can collect twelve power-ups: Turbo Sneakers, Freeze Ray, Double Points, Dot Magnet, Bubble Shield, Ghost Walk, Pellet Blaster, Boo Bomb, Mega Chomp, Decoy Pac, Time Warp and Extra Heart
- [x] As a player, I can see what is active with icons and timers and a banner when it starts
- [x] As a player, I can eat bonus fruit from cherry to key

### Story
- [x] As a player, I can follow Pac-Man and Pip through five worlds of four mazes and a boss each on a world map with stars
- [x] As a player, I can watch an intro, chapter openings with dialogue, boss entrances, relightings and an ending with credits
- [x] As a player, I can fight five bosses that charge, shoot, drop puddles, summon minions and blink, and bite them while powered up
- [x] As a player, I can skip any cinematic with a key, click or tap

### Modes
- [x] As a player, I can play Arcade with endless mazes, rising speed, intermissions and a high-score table
- [x] As a player, I can relax in Zen mode with no game over, slow ghosts and soft chimes
- [x] As a player, I can play the Daily Maze, the same three mazes and modifiers for everyone on a day
- [x] As a player, I can play Boss Rush once the second world is cleared
- [x] As a player, I can switch on the weekly Arcade twist

### Progression
- [x] As a player, I can spend shards earned in every mode on a 25-node tech tree from the title or the pause menu, with immediate effect
- [x] As a player, I can complete three daily quests and keep a play streak for growing shard bonuses
- [x] As a player, I can unlock 28 achievements and see my lifetime records
- [x] As a player, I can collect sixteen skins, twelve trails and six maze themes in the wardrobe

### Seasons
- [x] As a player, I can play six seasonal events through the year (Starlight Festival, Night of Lanterns, Frostfall, Bloom Parade, Sunsplash, Harvest Moon) with their own scenery, weather and maze colours
- [x] As a player, I can collect the season's tokens in every mode and earn its exclusive skin and trail on a reward track

### Persistence & Controls
- [x] As a player, I can close the page at any time and continue my run exactly where it was
- [x] As a player, I can keep my old high scores, with shards for them
- [x] As a player, I can play with the keyboard, the mouse or a touch screen (swipe or on-screen pad)
- [x] As a player, I can resize or maximize the window with exact click mapping and the scenery filling the extra space
- [x] As a player, I can have the game pause when the tab is hidden

### Planned Features
- [ ] As a player, I can design my own mazes and share them as a code

## Controls

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Steer Pac-Man |
| Mouse button (held) | Steer toward the pointer |
| Swipe / on-screen pad | Steer on touch screens |
| Esc / P / Space | Pause |
| T | Tech tree |
| H | How to Play (menus) |
| B | Buy the selected tech node |
| Arrows + Enter | Navigate menus |
| Any key / click | Skip a cinematic |
| F2 | Title screen (the run stays saved) |

## SEO Keywords

pac-man, pacman online, free maze game, arcade maze chase, pac-man story mode, pac-man boss fights, browser arcade game, power-ups, tech tree, seasonal events, SynthelicZ game
