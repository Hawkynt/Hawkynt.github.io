# Platformer

A jump-and-run adventure for the »SynthelicZ« Desktop. Run, jump, wall-kick and dash through five worlds — Sunleaf Meadows, Glimmer Caverns, Frostfang Peaks, Cinder Forge and Skyspire Citadel — thirty levels in all, each world ending in a boss with three phases. Every level hides three gems, has a par time and pays coins and gems into a five-branch Tech Tree. Time Trial races the ghost of your best run, Endless chains fresh stages until your hearts run out, and the Daily Run builds one new course per day.

## How It Works

The hero runs on a fixed 120 Hz physics step, so every run is deterministic. Movement is tuned for feel: acceleration and braking (slippery on ice), a jump about three and a half tiles high with variable height (release early for a hop), apex hang, a heavier fall, coyote time after leaving a ledge, a jump buffer before landing, and corner correction that slides the hero past ceiling edges. One-way ledges can be jumped through and dropped through (Down + Jump), springs launch about eight tiles, and moving platforms carry their rider. The Tech Tree adds wall slides with wall kicks, a dash, a double jump and stronger air control.

Levels are 18 tiles tall and 90 to 240 tiles long. Each one is a chain of hand-made chunks: a start, a run of segments picked for the world and the level's difficulty, and a goal gate or a boss arena. Chunks are compact tile strings with entity markers (coins, gem spots, foes, turrets, platforms, lifts, checkpoints), and every chunk meets its neighbours on the same floor row. A deterministic builder seeds each campaign level, so the campaign never changes. It places three gems spread across the level, adds checkpoints at about 40 % and 70 %, and gives each world its flavour: a rocky roof in the caverns, frost on the peaks, lava in the forge's pits, floating ground in the citadel. Endless stages and the Daily Run feed the same builder other seeds.

Every campaign level is proven completable. A reachability bot drives the game's own `stepPlayer` with held inputs and searches toward the goal with the base move set (no upgrades); 87 of the 90 gems are reachable that way, and the other three need a Tech Tree move. Sampled Endless stages and Daily Runs pass the same check.

Hearts are lost to spikes, foes and shots. A pit or liquid costs a heart and puts the hero back on the last safe ground. With no hearts left the hero restarts from the last checkpoint, except in Endless, where the run ends. Stars come for reaching the goal, for finding all three gems (across any number of runs) and for beating the par time.

The game renders into a 1280 x 720 logical view, letterboxed to the window with the scenery bleeding into the bars and devicePixelRatio awareness. The world is drawn 1.2x larger, eases out for boss fights and zooms in for tall windows. The camera looks ahead in the running direction, follows vertically, and locks to the arena during a boss fight.

## Architecture

Plain scripts, no build step: `index.html` loads them in dependency order, each one an IIFE that registers itself on `window.SZ`. The code sits in three groups under `js/`: the rules, the art and the game itself.

**Rules** (`js/logic/`, pure, no DOM, shared with the tests and the bot)
- `physics.js` — tile codes, AABB sweeps against solids, one-way tiles and moving platforms, hazards (oriented spikes, liquids, falling out) and the player controller (coyote time, buffering, variable jump, apex hang, corner correction, wall slide and kick, double jump, dash, springs, ice, drop-through).
- `levels-data.js` — the five worlds, 46 hand-made chunks (28 shared, 15 world-specific, start/goal/arena), the seeded level builder with world transforms, gem and checkpoint placement and par times, and the campaign, Endless and Daily specs.
- `progression.js` — the v2 save and its migration, coins and gems, the 22-node Tech Tree (Movement, Survival, Fortune, Arsenal, Style) and the stats it grants, stars and rewards, unlocks, skins and trails, and the compact ghost encoding for Time Trial.
- `entities.js` — foes with seven behaviours (walker, charger, hopper, spiky, flyer, diver, turret), five bosses with three phases each (King Gloop, Crystal Golem, Old Rimeback, Magma Drake, The Storm Regent), projectiles (fireballs, shots, lobbed and homing boss attacks, ground waves, falling rocks and icicles, lightning) and moving platforms. It reports events to the game.

**Art** (`js/art/`, self-contained drawing libraries that know nothing of the game state)
- `platformer-ui.js` — the drawing kit: cached glass panels with a gilded rim, text that always fits its box, chips, keycaps, meters and glossy headlines.
- `sprites/` — cached procedural sprites at 2x resolution, published as `SZ.PlatformerSprites`: `kit.js` (frame tables, the sprite cache, paint helpers and expressive eyes), `hero.js` (nine animated poses for six skins), `foes.js` (seven foe types reskinned per world), `bosses.js` (five bosses), `items.js` (pickups, blocks, props, platforms, projectiles) and `icons.js` (UI icons and the public API).
- `tiles/` — terrain, published as `SZ.PlatformerTiles`: `kit.js` (world themes, helpers and the seamless textures), `cells.js` (bake-time cell painters: rounded outer corners, grass/moss/snow/ash/gilded caps, rim shading, occlusion in pockets, seeded decorations and hanging growth, ledges, oriented spikes, liquids) and `tiles.js` (16-tile chunk canvases, LRU cached and baked ahead of the camera, animated liquid surfaces, fading secret walls, menu previews).
- `scene/` — layered parallax backdrops, published as `SZ.PlatformerScene`: `kit.js` (noise, gradients, ridges, clouds, stars), `strips.js` (tileable ranges, hills, trees, cloud seas, light shafts), `worlds.js` (the five world builders and atmosphere bands) and `scene.js` (the cached sky, animated light, aurora, lava glow, the foreground band and the panning menu variant).
- `fx.js` — pooled sprite particles (capped, culled off-screen, additive pass for glows), presets for dust, landings, jumps, dashes, coins, gems, stomps, defeats, splashes, checkpoints, explosions, debris, shockwaves, trails and each world's air, plus trauma screen shake, hit-stop, screen flashes and floating texts.

**The game** (namespace `SZ.Platformer`). All shared, mutable state lives in one object, `SZ.Platformer.state` (called `G` in every file); each module fills `SZ.Platformer.module('<name>')` with the functions other modules call, and its header comment names the state it owns and reads.
- `js/core/config.js` — the namespace, the module registry and the tuning constants (view size, zoom, step limits, timings, storage keys, gem and boss-shot colours).
- `js/core/context.js` — the shared state `G`: canvas and drawing kit, particle pools, shake/hit-stop/flash, input sets, current screen, the running level, results, toasts, menu cursor and per-screen state.
- `js/core/view.js` — the 1280 x 720 logical view, letterboxed with devicePixelRatio awareness, the world zoom and pointer mapping.
- `js/core/sound.js` — sound effects through the shared synthesizer, throttled per effect.
- `js/core/util.js` — the local date key and the time format.
- `js/core/storage.js` — the save and the high scores in localStorage, and the High Scores dialog table.
- `js/core/input.js` — the key map and the per-step input snapshot.
- `js/core/session.js` — screen switching, toasts, applying Tech Tree stats at once, and starting levels in Adventure, Time Trial, Endless and Daily modes.
- `js/play/events.js` — the world the entity logic sees and the sound, particles and shakes its events trigger.
- `js/play/step.js` — the fixed 120 Hz step: accumulator, system order, safe respawn ground and the hero's movement effects.
- `js/play/camera.js` — look-ahead, vertical follow, arena lock and zoom.
- `js/play/blocks.js` — coin and power blocks, crates, foes bonked from below and crumbling floors.
- `js/play/combat.js` — fireballs, hurting, pits, knock-outs and respawns, stomps and shockwaves, shots.
- `js/play/boss.js` — the arena gate, hitting the boss, its death and rewards.
- `js/play/pickups.js` — coins and the magnet, gems, power-ups, checkpoints, the goal trigger and ghost recording.
- `js/play/finish.js` — level clear, Daily Run and Endless results and rewards.
- `js/render/kit.js` — sprite, glow and icon drawing shared by every screen.
- `js/render/world.js` — the level picture: backdrop, terrain, dynamic tiles, pickups, foes, boss, ghost, hero with squash, trails and afterimages, shots and the gem radar.
- `js/render/hud.js` — the HUD, boss bar, toasts, level intro card, knock-out veil and screen fade.
- `js/ui/menu-kit.js` — hit areas, keyboard cursor, animated buttons, veils, the menu backdrop and currency chips.
- `js/ui/title.js`, `map.js`, `tree.js`, `wardrobe.js`, `help.js`, `pause.js`, `results.js` — the title diorama, the world map, the Tech Tree, the Wardrobe, How to Play, the pause menu and the results panel.
- `js/ui/controls.js` — keyboard, mouse and touch input for play and every menu.
- `js/app.js` — the frame loop and screen dispatch, the status bar, the menu bar, window integration and start-up.

**Tests** (`tests/`) — node suites: `physics.test.js` (movement rules), `levels-data.test.js` (chunk and level validation plus the completability proof), `solver.js` (the reachability bot), `entities.test.js` (foe behaviours, boss phases and defeat), `progression.test.js` (tree, rewards, save migration, ghosts), and `platformer-ui`, `sprite-art`, `tile-art`, `scene-art` and `fx` tests that hold the drawing budgets against a recording fake canvas (`fakecanvas.js`).

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
