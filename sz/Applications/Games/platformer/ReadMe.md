# Platformer

A jump-and-run adventure for the »SynthelicZ« Desktop. Run, jump, wall-kick and dash through five worlds — Sunleaf Meadows, Glimmer Caverns, Frostfang Peaks, Cinder Forge and Skyspire Citadel — thirty levels in all, each world ending in a boss with three phases. Every level hides three gems, has a par time and pays coins and gems into a five-branch Tech Tree. Time Trial races the ghost of your best run, Endless chains fresh stages until your hearts run out, and the Daily Run builds one new course per day.

## How It Works

The hero runs on a fixed 120 Hz physics step, so every run is deterministic. Movement is tuned for feel: acceleration and braking (slippery on ice), a jump about three and a half tiles high with variable height (release early for a hop), apex hang, a heavier fall, coyote time after leaving a ledge, a jump buffer before landing, and corner correction that slides the hero past ceiling edges. One-way ledges can be jumped through and dropped through (Down + Jump), springs launch about eight tiles, and moving platforms carry their rider. The Tech Tree adds wall slides with wall kicks, a dash, a double jump and stronger air control.

Levels are 18 tiles tall and 90 to 240 tiles long. Each one is a chain of hand-made chunks: a start, a run of segments picked for the world and the level's difficulty, and a goal gate or a boss arena. Chunks are compact tile strings with entity markers (coins, gem spots, foes, turrets, platforms, lifts, checkpoints), and every chunk meets its neighbours on the same floor row. A deterministic builder seeds each campaign level, so the campaign never changes. It places three gems spread across the level, adds checkpoints at about 40 % and 70 %, and gives each world its flavour: a rocky roof in the caverns, frost on the peaks, lava in the forge's pits, floating ground in the citadel. Endless stages and the Daily Run feed the same builder other seeds.

Every campaign level is proven completable. A reachability bot drives the game's own `stepPlayer` with held inputs and searches toward the goal with the base move set (no upgrades); 87 of the 90 gems are reachable that way, and the other three need a Tech Tree move. Sampled Endless stages and Daily Runs pass the same check.

Hearts are lost to spikes, foes and shots. A pit or liquid costs a heart and puts the hero back on the last safe ground. With no hearts left the hero restarts from the last checkpoint, except in Endless, where the run ends. Stars come for reaching the goal, for finding all three gems (across any number of runs) and for beating the par time.

The game renders into a 1280 x 720 logical view, letterboxed to the window with the scenery bleeding into the bars and devicePixelRatio awareness. The world is drawn 1.2x larger, eases out for boss fights and zooms in for tall windows. The camera looks ahead in the running direction, follows vertically, and locks to the arena during a boss fight.

## Architecture

- `physics.js` — tile codes, AABB sweeps against solids, one-way tiles and moving platforms, hazards (oriented spikes, liquids, falling out) and the player controller (coyote time, buffering, variable jump, apex hang, corner correction, wall slide and kick, double jump, dash, springs, ice, drop-through). Pure logic, shared by the game, the tests and the bot.
- `levels-data.js` — the five worlds, 46 hand-made chunks (28 shared, 15 world-specific, start/goal/arena), the seeded level builder with world transforms, gem and checkpoint placement and par times, and the campaign, Endless and Daily specs.
- `entities.js` — foes with seven behaviours (walker, charger, hopper, spiky, flyer, diver, turret), five bosses with three phases each (King Gloop, Crystal Golem, Old Rimeback, Magma Drake, The Storm Regent), projectiles (fireballs, shots, lobbed and homing boss attacks, ground waves, falling rocks and icicles, lightning) and moving platforms. Pure logic; it reports events to the controller.
- `progression.js` — the v2 save and its migration, coins and gems, the 22-node Tech Tree (Movement, Survival, Fortune, Arsenal, Style) and the stats it grants, stars and rewards, unlocks, skins and trails, and the compact ghost encoding for Time Trial.
- `platformer-ui.js` — the drawing kit: cached glass panels with a gilded rim, text that always fits its box, chips, keycaps, meters and glossy headlines.
- `sprite-art.js` — cached procedural sprites at 2x resolution: the hero in nine animated poses for six skins, the seven foe types reskinned for each world, five bosses, items, blocks, platforms, projectiles and UI icons.
- `tile-art.js` — per-world seamless textures and terrain baked into 16-tile chunk canvases (LRU cached, baked ahead of the camera): rounded outer corners, grass/moss/snow/ash/gilded caps, rim shading, occlusion in pockets, seeded decorations and hanging growth, ledges, oriented spikes, liquids with animated surfaces and fading secret walls.
- `scene-art.js` — layered parallax backdrops for the five worlds (one cached sky plus tileable strips) with animated light, aurora, lava glow and cloud seas, a foreground atmosphere band and a panning menu variant.
- `fx.js` — pooled sprite particles (capped, culled off-screen, additive pass for glows), presets for dust, landings, jumps, dashes, coins, gems, stomps, defeats, splashes, checkpoints, explosions, debris, shockwaves, trails and each world's air, plus trauma screen shake, hit-stop, screen flashes and floating texts.
- `controller.js` — the game: state machine and screens (title diorama, world map, level intro card, HUD, pause, help, results, Tech Tree, wardrobe), fixed-step loop, input (keyboard, mouse, touch), camera, pickups, combat, bosses, modes, persistence and window integration.
- `tests/` — node suites: `physics.test.js` (movement rules), `levels-data.test.js` (chunk and level validation plus the completability proof), `solver.js` (the reachability bot), `entities.test.js` (foe behaviours, boss phases and defeat), `progression.test.js` (tree, rewards, save migration, ghosts), and `platformer-ui`, `sprite-art`, `tile-art`, `scene-art` and `fx` tests that hold the drawing budgets against a recording fake canvas (`fakecanvas.js`).

The page also uses the shared desktop libraries `../../shared/game-audio.js` (synthesized sound), `game-autopause.js`, `touch-controls.js`, `menu.js` and `dialog.js`.

## User Stories

### Moving
- [x] As a user, I can run with Arrow keys or A / D and feel the hero accelerate and brake, and slide on ice
- [x] As a user, I can jump with Space, Up, W or Z, holding for a full jump or tapping for a hop
- [x] As a user, I can still jump a moment after running off a ledge, and a jump pressed just before landing still counts
- [x] As a user, I can graze a ceiling corner and slide past it instead of bonking
- [x] As a user, I can jump up through ledges and drop down through them with Down + Jump
- [x] As a user, I can bounce high off springs and ride sliding platforms and lifts
- [x] As a user, I can slide down walls, and with Wall Kick kick off them to climb
- [x] As a user, I can dash with Shift or X and jump twice in the air once I unlock Dash and Cloud Step

### Levels & Worlds
- [x] As a user, I can play 30 levels in five worlds of six: Sunleaf Meadows, Glimmer Caverns, Frostfang Peaks, Cinder Forge and Skyspire Citadel
- [x] As a user, I can see each world's own terrain, ledges, spikes, liquids, decorations and parallax backdrop
- [x] As a user, I can find coin blocks, power blocks, crates, crumbling blocks, springs, one-way ledges, moving platforms and lifts
- [x] As a user, I can raise checkpoint banners and restart from the last one
- [x] As a user, I can hunt three hidden gems per level, some behind secret walls that fade as I walk in
- [x] As a user, I can trust that every level can be finished with the starting moves

### Foes & Bosses
- [x] As a user, I can stomp walkers, chargers that wind up and charge, hoppers, flyers, divers that swoop and turrets that fire, and chain stomps into combos
- [x] As a user, I can deal with spiky foes that hurt when stomped by burning them or flattening them with a shockwave
- [x] As a user, I can fight a boss at the end of every world in a gated arena, with a health bar and three phases that add new attacks
- [x] As a user, I can read boss attacks from their tells: wind-ups, shadows where rocks and icicles will fall, and flashing columns before lightning

### Power-ups & Hearts
- [x] As a user, I can grab fireballs, an invincibility star or a heart from power blocks
- [x] As a user, I can throw bouncing fireballs with C or F
- [x] As a user, I can lose hearts to spikes, foes and shots, and lose one and return to safe ground when I fall into a pit or liquid

### Stars & Rewards
- [x] As a user, I can earn three stars per level: goal, all gems and par time
- [x] As a user, I can watch the results panel pop in the stars, count up the coins and show the time, best time, gems and knock-outs
- [x] As a user, I can earn coins in every mode, gems from new gem finds, and bonuses for first clears and new stars

### Tech Tree
- [x] As a user, I can spend coins and gems in a Tech Tree with five branches: Movement, Survival, Fortune, Arsenal and Style
- [x] As a user, I can unlock Wall Kick, Air Control, Dash and Cloud Step; Heart Containers, Second Wind, Hearth Flag and Bubble Shield; Coin Magnet, Golden Touch, Lucky Blocks and Gem Radar; Ember Heart, Stomp Shockwave and Giant Slayer; and skins and trails
- [x] As a user, I can open the Tech Tree from the title, the map, the results and the pause menu in the middle of a level, and upgrades take effect at once
- [x] As a user, I can see requirements, costs, ranks and connections between nodes, with locked, affordable and maxed states

### Modes
- [x] As a user, I can play Adventure on a world map with stars, best times and gems for each level, and unlock the next world by beating its boss
- [x] As a user, I can race any cleared level in Time Trial against the ghost of my best run, with best times shown on the map
- [x] As a user, I can play Endless: stage after stage of new courses through every world, keeping my hearts, until I am knocked out
- [x] As a user, I can play a Daily Run: one long seeded course per day with a first-clear bonus and a best time

### Wardrobe
- [x] As a user, I can wear six hero skins and choose spark, prism or shadow trails once unlocked

### Visual Effects
- [x] As a user, I can see the hero squash and stretch, kick up dust, leave afterimages when dashing and trails when styled
- [x] As a user, I can see particles for jumps, landings, stomps, coins, gems, splashes, explosions, checkpoints and the goal, with screen shake, hit-stop and flashes on big moments
- [x] As a user, I can see each world's air: petals, cave motes and drips, snow, embers and ash, and sky wisps

### Sound
- [x] As a user, I can hear synthesized sound for jumps, stomps, coins, gems, hits, springs, dashes, bosses and wins, and mute it from the speaker button

### Menus & Controls
- [x] As a user, I can use the keyboard, the mouse or touch everywhere; touch screens get a stick and Jump, Dash, Fire and pause buttons during play
- [x] As a user, I can read a five-page How to Play screen (Basics, Moves, Things, Foes, Modes) that opens by itself on the first visit
- [x] As a user, I can pause with Escape or P, restart with R, open the Tech Tree with T and help with H; F2 returns to the title
- [x] As a user, I can resize or maximize the window at any aspect ratio: the view letterboxes with the scenery in the bars, the HUD sticks to the corners and clicks land where I point
- [x] As a user, I can see coins, level, hearts and state in the status bar and the level name in the window title, and the game pauses when the tab is hidden

### Persistence
- [x] As a user, my coins, gems, level records, best times, ghosts, tree ranks, skins, trails, Endless best and daily result persist in localStorage
- [x] As a user, my five best Endless and Daily runs appear in the High Scores dialog
- [x] As a user, a corrupt or old save falls back cleanly to defaults

## Controls

| Key | Action |
|-----|--------|
| Arrow Left / A, Arrow Right / D | Run |
| Space / Arrow Up / W / Z | Jump (hold for higher); wall kick with the upgrade |
| Arrow Down / S + Jump | Drop through a ledge |
| Shift / X | Dash (Tech Tree) |
| C / F | Fireball |
| Escape / P | Pause menu, or back in menus |
| R | Restart the level |
| T | Tech Tree |
| H | How to Play |
| F2 | Title screen |
| Arrows + Enter | Menus; Q / E change world on the map |

## SEO Keywords

platformer, jump and run, browser game, free online game, side-scrolling, wall jump, dash, boss fight, time trial, ghost race, endless runner, daily challenge, tech tree, SynthelicZ, WebOS game, HTML5 game, canvas game
