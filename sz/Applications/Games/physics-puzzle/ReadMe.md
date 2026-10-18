# Physics Puzzle

A build-and-launch physics puzzle game for the »SynthelicZ« Desktop. Drag planks, steel blocks, spring pads, bumpers, fans, conveyors and magnets out of the tray, pull back the launcher like a slingshot and light every target. Forty levels in five worlds — Tinker Workshop, Greenhouse Garden, Cryo Lab, Volcano Forge and the low-gravity Orbit Station — bring glass that shatters, TNT that chain-reacts, portals, water, lava, ice, spinning gears, swinging hammers, pendulums, crates and boulders. Every level pays coins into a five-branch Tech Tree; Trick Shots, a seeded Daily Challenge and a free-building Sandbox round it off.

## How It Works

The game runs on its own rigid-body engine: circles and convex polygons with mass, rotation, restitution and friction per material (wood, steel, stone, rubber, glass, ice), separating-axis collision with clipped two-point contact manifolds, sequential impulses with accumulated clamping, linear position correction and per-body sleeping. It steps at a fixed 240 Hz with a fixed iteration order and no randomness, so the same parts and the same shot always give exactly the same flight. On top sit the gadgets: springs and bumpers that fire at a set speed, conveyor surfaces, glass that breaks above an impulse, TNT with a radial blast that sets off its neighbours, kinematic gears and hammers, rope pendulums, and force zones for fans, water (buoyancy and drag), magnets and portals.

A level is plain data: the launcher (optionally with a limited barrel arc), fixtures, targets, stars floating in the air, the tray's inventory and a par. A try is one live world that persists from shot to shot — knocked crates stay down, broken glass stays broken, lit targets stay lit and taken stars stay taken — and nothing moves between shots (machines only run while a ball is in flight), so a replay is exact. A shot ends when every target is lit, or when the balls are gone, stuck or out of time and the rest of the world has come to rest. Reset puts the world back and keeps the parts.

Three stars per level: solve it, solve it within par, and pick up every star. Every campaign level, every Trick Shot and the Daily Challenge are proven solvable: `tools/solve-levels.js` sweeps part layouts and shots (angle and launch speed) with the game's own physics in parallel workers, keeps the shot with the most alike neighbours so nothing balances on a knife edge, hangs the stars along the winning flight path and writes `solutions.js`; the tests replay every stored solution. The Daily Challenge picks a level by the date, hangs fresh stars on its known solution path and adds a spare part, so it is solvable by construction.

The game draws into a 1280 x 720 logical view, letterboxed with the backdrop bleeding into the bars, devicePixelRatio aware. The backdrop and every fixture that never changes are baked once per window size into one layer; moving bodies are cached sprites blitted at an angle, and only fan blades, belt treads, portal swirls, water and lava surfaces and glows animate per frame. No shadow blur, capped particle pools.

## Architecture

Plain scripts loaded in dependency order by `index.html`, no build step. The pure modules publish `SZ.PhysicsPuzzle<Name>` (Physics, Parts, Sim, Levels, Solutions, Progress, UI, Art, Scene, Fx, Screens); the controller modules share one context object, `SZ.PhysicsPuzzle.G`, which owns the live state (screen, run, results, save, stats, pointer, menu cursor, toast, view transform, baked layer) and is also the context the menu screens draw with. Each module states at its top what it owns and what it reads.

`js/engine/` — the simulation, pure logic, also run by the tests and the solver in node:

- `physics.js` — the rigid-body engine: shapes and mass properties, SAT and circle collision with manifolds, the impulse solver, sleeping, springs and bumpers, conveyors, breakable glass, TNT blasts, kinematic motors, rope joints, fan, water, magnet and portal zones, raycasts for the aiming guide, energy and state hashes for the tests.
- `parts.js` — the ten placeable parts (seven for the campaign tray, crates, glass and TNT for the Sandbox), the 21 fixture kinds levels are built from, and the placement rules (grid snap, 15° turns, field bounds, launcher clearance, no overlaps).
- `sim.js` — the puzzle rules on the physics: attempts that persist across shots, firing (with Twin Shot spreads), targets, stars, lava, the shot end and settle phases, Trick Shot rules (one shot, minimum ricochets), solution replays and the seeded Daily Challenge builder.

`js/data/`:

- `levels-data.js` — the five worlds (gravity, materials, colours), the forty levels and the ten Trick Shots.
- `solutions.js` — a known solution for every level and Trick Shot (parts and shots), written by the solver tool; also used for the Blueprint hint and the Daily stars.

`js/core/`:

- `progression.js` — the v2 save and its migration, coins and rewards, the three stars, world and level unlocks with star gates, the 24-node Tech Tree (Launcher, Parts, Physics, Fortune, Style) and the stats it grants, ball skins and trails. Pure logic.
- `context.js` — the constants and the shared context `G`: canvas, drawing kit, module references, the effect systems (field, view and menu particles, shake, slow motion, flash, floating texts) and the live state.
- `save.js` — loading and writing the save in localStorage, refreshing the Tech Tree stats, the equipped skin and the local date.
- `sound.js` — synthesized sound effects, throttled per effect.

`js/play/` — one level being played:

- `run.js` — starting, resetting and leaving a run in each mode (campaign, trick, daily, sandbox), the tray inventory, the Daily level, and results with rewards when a level is won.
- `shot.js` — firing, the fixed-step loop of the live attempt with slow motion, Bullet Time and fast-forward, ball trails and the end of a shot.
- `events.js` — physics events turned into particles, sound, shake, flashes, slow motion and floating texts, near misses and the win burst.
- `build.js` — dragging parts from the tray, snapping and validating, selecting, turning and removing parts, and the selection handles.
- `aim.js` — slingshot and keyboard aiming within the barrel arc and the predicted flight with Ricochet Sight.

`js/render/`:

- `physics-ui.js` — the drawing kit: cached smoked-glass panels in a brass frame, text that always fits its box, chips, keycaps, meters and glossy headlines.
- `art/` — procedural textures and cached sprites for every body (`SZ.PhysicsPuzzleArt`), in five files loaded in order: `art-kit.js` (colour helpers, seeded random, the sprite cache at the device scale, blits and glows), `materials.js` (wood with grain and knots, stone, riveted steel, frosted ice, bevels and per-world ground), `body-sprites.js` (fixtures, crates, steel, glass, TNT, boulders, springs, bumpers, conveyors and treads, paddles, fans, magnets, planks, blocks and bobs), `actors.js` (five ball skins, targets, stars and the launcher) and `bodies.js` (drawing every body and zone with its animated details — fan blades, belt treads, portal swirls, water and lava surfaces, air columns — the tray icons and part previews; publishes the module).
- `scene-art.js` — the five painted backdrops (workshop with window, pegboard and lamps; greenhouse with hanging plants and sunbeams; cryo lab with a blizzard window, frosted pipes, monitors and tanks; forge with lava falls, chains and a crucible; orbit station with a nebula and a ringed planet), cached per window shape, plus their animated lights.
- `fx.js` — pooled sprite particles (additive glow pass, culled, capped) with presets for impacts by material, glass shards, explosions with shockwaves, splinters, dust, springs, bumpers, portals, splashes, lava, target hits, star pickups, muzzle blasts, ball trails, confetti, fireworks and each world's air, plus screen shake, eased slow motion, flashes and floating texts.
- `view.js` — the 1280 x 720 logical view letterboxed into the canvas, devicePixelRatio aware, and pointer mapping.
- `field.js` — the playing field: the baked static layer with shadows and blast scorches, live bodies, zones, targets and stars, the selection outline, launcher, aim guide, arc and pull band, ball trails, the Blueprint hint, the drag ghost and field particles; warms every sprite cache before a level starts.
- `hud.js` — the tray with its part cards, the launcher readout, Reset and Menu buttons, level, shot, star and target chips, the Bullet Time meter, the fast-forward chip, selection handles, the first-shot hint, the intro card and toasts.

`js/ui/`:

- `screens.js` — the menu screens: the title with a live physics contraption, the world map, the Trick Shot board, the Tech Tree, five illustrated How to Play pages, the pause menu and the results with the star reveal.
- `menu-kit.js` — hit areas registered while drawing, the hover and keyboard cursor, animated buttons, activation and the dimming veil.
- `flow.js` — switching screens, the screens instance with the actions it may call, opening and closing the map, Trick Shots, Tech Tree and How to Play, pause and resume, and the Escape chain.
- `input.js` — keyboard, mouse and touch: aiming, firing, building, toggles and Bullet Time in a level, cursor and activation in menus.
- `os.js` — the menu bar actions, the Progress, Controls and About dialogs with the save reset, the window title and resizing.

- `js/app.js` — the bootstrap and the frame loop: wiring, loading the save, then each frame the level or the current screen, view particles, flashes, the screen fade and the status bar.
- `tools/solve-levels.js` — the solution finder (worker-thread grid search over layouts and shots, star hanging).
- `tests/` — node suites: `physics.test.js` (free fall, bounces, energy, stacking, determinism, gadgets, zones, joints, raycasts, tunnelling, speed), `sim.test.js` (attempts, persistence, rules, lava, Twin Shot, parts, placement, fixtures, frozen machines), `levels-data.test.js` (validation and the replay of all 40 solutions, the Trick Shots and 30 Daily Challenges), `progression.test.js` (tree, stats, rewards, economy, unlocks, daily, migration), and `physics-ui`, `body-art`, `scene-art` and `fx` tests that hold the drawing budgets against a recording fake canvas (`fakecanvas.js`).

The page also uses the shared desktop libraries `../../shared/game-audio.js` (synthesized sound), `game-autopause.js`, `menu.js` and `dialog.js`.

## User Stories

### Aiming & Firing
- [x] As a user, I don't wait for a missed ball to roll out: once a shot can no longer change much it fast-forwards (6x, hold F to fast-forward any shot), and pulling back to aim ends the roll-out at once so I can fire the next shot
- [x] As a user, I can press anywhere on the field and pull back like a slingshot to set the angle and power, and let go to fire
- [x] As a user, I can aim with the arrow keys and fire with Space or Enter
- [x] As a user, I can see the predicted flight as dots, a longer guide with Long Sight and bounces with Ricochet Sight
- [x] As a user, I can see the barrel's allowed arc on levels that limit it
- [x] As a user, I can watch the last shot's ghost trail to aim against (Ghost Trail)
- [x] As a user, I can fire two or three balls at once with Twin Shot and toggle it with M

### Building
- [x] As a user, I can drag planks, steel blocks, spring pads, bumpers, fans, conveyors and magnets from the tray onto the field
- [x] As a user, I can see parts snap to a grid, glow green where they fit and red where they would overlap, with the reason
- [x] As a user, I can tap a part to select it and turn it with the round handles, a second tap or Q / E, in 15° steps
- [x] As a user, I can remove a part with its X handle, Delete, or by dragging it back onto the tray
- [x] As a user, I can change my parts between shots without losing what the earlier shots did

### Physics & Gadgets
- [x] As a user, I can see the ball roll, bounce and spin with friction and bounciness that depend on wood, steel, stone, rubber, glass and ice
- [x] As a user, I can knock over crates, boulders and steel blocks that tumble, stack and stay where they fall
- [x] As a user, I can shatter glass with a hard hit and set off TNT that throws everything nearby and sets off other TNT
- [x] As a user, I can use springs, bumpers, conveyors, fans, magnets and portals, and fight water, lava, ice, spinning gears, swinging hammers and pendulums
- [x] As a user, I can play in low gravity on the Orbit Station
- [x] As a user, I can trust that machines only move while a shot is in flight, so the same shot always does the same thing

### Levels & Stars
- [x] As a user, I can play 40 levels in five worlds of eight: Tinker Workshop, Greenhouse Garden, Cryo Lab, Volcano Forge and Orbit Station
- [x] As a user, I can earn three stars per level: solve it, beat the par and pick up every star in the air
- [x] As a user, I can light several targets over several shots; lit targets and taken stars stay
- [x] As a user, I can trust that every level, Trick Shot and Daily Challenge has been solved by replaying a stored solution
- [x] As a user, I can open each world with enough stars and the previous world's last level solved

### Modes
- [x] As a user, I can play the Campaign on a world map with stars, best shots and the tray of each level
- [x] As a user, I can take on ten Trick Shots: everything in one shot, a minimum number of ricochets, or no parts at all
- [x] As a user, I can play a Daily Challenge with fresh stars, a spare part and a first-clear bonus
- [x] As a user, I can build freely in the Sandbox with every part I own and drag the target anywhere

### Tech Tree
- [x] As a user, I can spend coins in a Tech Tree with five branches: Launcher, Parts, Physics, Fortune and Style
- [x] As a user, I can unlock Power Cell, Long Sight, Ricochet Sight and Twin Shot; Spare Plank, Spare Spring, Machinist, Demolition Kit and Blueprint; Bullet Time, Rubber Core, Ghost Trail and Steady Hand; Coin Purse, Star Bounty, Daily Ticket and Showman; and four ball skins and three trails
- [x] As a user, I can open the Tech Tree from the title, the map, the results and the pause menu in the middle of a level, and upgrades take effect at once
- [x] As a user, I can equip owned ball skins and trails from the Style branch
- [x] As a user, I can press B for a Blueprint hint showing where a known solution's parts go

### Visual Effects
- [x] As a user, I can see painted, lit worlds that fill any window shape, textured wood, stone, steel, ice and glass, glowing targets and spinning stars
- [x] As a user, I can see sparks, dust, glass shards, splinters, explosions with shockwaves, splashes, sizzling lava, portal flashes and muzzle smoke
- [x] As a user, I can see time slow down on near misses, target hits and blasts, and hold Space for Bullet Time
- [x] As a user, I can see a star reveal, a coin count-up, confetti and fireworks when I solve a level

### Sound
- [x] As a user, I can hear synthesized sound for shots, bounces, springs, bumpers, glass, TNT, portals, splashes, stars, targets and wins, and mute it from the speaker button

### Menus & Controls
- [x] As a user, I can use the mouse, touch or the keyboard everywhere
- [x] As a user, I can read five illustrated How to Play pages that open by themselves on the first visit
- [x] As a user, I can pause with Escape or P, reset with R, open the Tech Tree with T and help with H; F2 returns to the title
- [x] As a user, I can resize or maximize the window at any aspect ratio: the view letterboxes with the scenery in the bars and clicks land where I point
- [x] As a user, I can see the level, shots, stars and coins in the status bar and the level name in the window title, and the game pauses when the tab is hidden

### Persistence
- [x] As a user, my coins, stars, best shots, tricks, daily result, upgrades, skin and trail persist in localStorage
- [x] As a user, I can see my progress per world in the Progress dialog and reset it there
- [x] As a user, a corrupt or old save falls back cleanly to defaults

## Controls

| Input | Action |
|-------|--------|
| Drag on the field | Pull back to aim; release to fire |
| Arrows / A D W | Turn the barrel and set the power |
| Space / Enter | Fire; hold Space in flight for Bullet Time |
| Drag from the tray | Place a part; drag back onto the tray to remove |
| Tap a part, Q / E | Select it and turn it |
| Delete, Tab, 1 - 9 | Remove the part, select the next part, drop a part mid-field |
| R | Reset the level (parts stay) |
| B / M | Blueprint hint / Twin Shot on-off |
| Escape / P | Pause menu, or back in menus |
| T / H | Tech Tree / How to Play |
| F2 | Title screen |
| Arrows + Enter, Q / E | Menus; change world on the map |

## SEO Keywords

physics puzzle, physics game, build and launch, slingshot game, projectile puzzle, rube goldberg, contraption game, springs and ramps, portals, TNT, glass, browser game, HTML5 game, canvas game, daily challenge, tech tree, SynthelicZ, WebOS game
