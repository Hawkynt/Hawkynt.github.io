# Endless Runner

The classic auto-runner grown into an adventure for the »SynthelicZ« Desktop. Run, jump, double jump, slide and dash with Nova the courier and Pip her lantern drone through five worlds to bring the five Spark Cores home and relight the Beacon of Lumen - or chase scores in Arcade, unwind in Zen, race your own ghost on the Daily Run and take on all five guardians in Boss Rush. Coins from every mode buy a 25-node tech tree, gems buy runners and outfits, and seasonal festivals, daily quests, streaks and achievements bring something new every day. The way can turn mid-level - back left when a bridge collapses, up a bell tower or a skyscraper facade, down a lava chimney or a crevasse - with the cast calling out every turn. Every run saves itself, so Continue always picks up exactly where you left off.

## How It Works

The runner moves forward on its own at a speed that climbs with distance. The course is generated ahead of the runner from a seeded stream of hand-shaped patterns - fences and crates to jump, overhang beams to slide under (or land on), walls that need a double jump or the ledges above, spikes, pits with and without stepping stones, springs, boost pads, saws and flyers that settle into a lane as you approach (a red ring means jump, blue means slide), falling rocks with a shadow warning, rollers, crumbling ledges and high gem routes. Every gap and spacing is scaled by the speed at that spot, so a pattern stays fair at any speed; moving obstacles move with the runner's distance rather than the clock, so a course plays the same at any frame rate. The same physics step drives the game, the title screen's demo runner and the solver the tests use to prove every pattern, every story stage, the Daily Run and long Arcade stretches can be finished.

**Turns:** the course can change direction in the middle of a level. The simulation never changes - the runner always runs along one axis with gravity toward the floor - only the view turns: a turn is a quarter rotation (climbing up or dropping down) or a mirror flip (turning round), eased over about a second around the runner while speed streaks sweep past (a white veil covers the instant a flip passes edge-on) and a whoosh rises or falls. Each turn sits on a stretch the generator keeps clear of obstacles, pits, pads and ledges from 0.6 s before to 0.7 s after the rotation, gold chevrons point the new way, and a line from the cast types itself out just before it ("The bridge is collapsing! Run back left!"). Every story stage of every world has its scripted turns (37 in all, all four directions); Arcade, Featured, Zen and the Daily Run turn now and then from the course seed, and each guardian has its own direction - Rime's avalanche thunders down a mountain face, Warden Mk-II is fought climbing its spire and the Hollow King turns the world round, which Boss Rush keeps by turning between guardians. Up and down have their own scenery for every world - a bell tower with arched windows, banners and a bell; a lava chimney; a frozen waterfall; a skyscraper facade with neon signs and an elevator shaft; the torn void of the Rift - and the ground becomes a wall slab with gaps for pits. Flyers, pickups, warnings, labels, floating texts and the duel guardians stay upright; the HUD never turns. The arrow keys and swipes follow the screen: the one pointing away from the floor jumps, toward it slides, along the run dashes (a hint explains it at the first climb); Space, W, S, D and Shift keep their meaning. Since the view is a pure function of the course and the runner's position, saves, Continue, ghosts and the Daily ghost need nothing extra and come back turned exactly as far as they were.

**Rendering:** the scenery (sky, parallax strips, the festival tint and the vignette) is composed each frame in an opaque offscreen canvas at view-plane resolution - the strips are painted at that resolution anyway - with whole-pixel, unscaled copies and a sky painted once per view size, so the screen gets one opaque blit instead of half a dozen full-screen translucent layers (screen overdraw went from about 5x to 1.3x). HUD panels and bar sheens are painted once and reused, particles off screen are skipped, and the backing store is held to about 2.4 million pixels.

Near misses, coins, gems, smashes and power-ups build a combo whose multiplier climbs to x4 (x5 with the Frenzy upgrade) and fades if you go quiet. Thirteen power-ups drop along the way: Magnet, Shield, Double Score, Jetpack, Giant, Slow-Mo, Ghost, Rocket, Coin Rain, Phoenix Feather (a revive), Spring Shoes, Gem Rush and Shockwave.

**Story:** five worlds - Sunpetal Meadows, Ember Canyon, Frostpeak Pass, Neon Metro and the Hollow Rift - with four stages and a guardian each. Thornback the boar and Rime's avalanche chase you (keep your lead with boost pads and dashes; stumbles cost ground), the Dune Wyrm, Warden Mk-II and the Hollow King fight head-on with telegraphed volleys while you grab spark orbs that fire back. Stages give up to three stars (finish, 60% of the coins or at most one hit against a guardian, all three Spark Shards); your best run on each stage races alongside you as a ghost. Cinematics open the game, each world, each guardian fight and every victory.

**Modes:** Story, Arcade (endless through all five worlds, high-score table, best distance flagged on the course), Featured (Arcade with the week's mutator), Zen (crashes only bump you, calm chimes), the Daily Run (one seeded course per local day with two mutators and a ghost) and Boss Rush (all five guardians back to back, opens once two are free).

**Progress without a server:** everything lives in localStorage - the profile (wallet, tech tree, collection, stars, ghosts, stats, quests, streak, festival track) and the run snapshot, which is written every three seconds, on pause and when the page hides. The old game's high scores, coin total and tutorial flag are migrated on first launch. The festival running on the local date (Frostfall, Bloom Festival, Sunfest, Harvest Moon, Hollow Night, Starfall Eve) changes the title world, the decor and tint, drops tokens in every mode and fills a five-tier reward track with coins, gems, a trail and an outfit.

## Architecture

- `index.html` -- entry point with SEO meta, menu bar, canvas, status bar and the High Scores, Controls and About dialogs
- `styles.css` -- layout and theming of the window chrome
- `icon.svg` -- desktop icon
- `js/` -- the game under `SZ.EndlessRunner`, one module per concern, loaded in dependency order:
  - `js/core/namespace.js` -- creates the namespace and one empty object per module
  - `js/core/constants.js` -- view plane, ground line, physics, speeds, scoring and combo tiers, pool sizes, storage keys (new and old) and the UI palette
  - `js/core/rng.js` -- seeded generators with saveable state, hashing, local day and week keys, easing helpers
  - `js/core/data-worlds.js` -- the five worlds (palettes, weather, pattern weights, guardian) and their 25 stages
  - `js/core/data-story.js` -- the cast, every cinematic, each story stage's in-level turns with their lines, the guardians' directions and the line pool of seeded turns
  - `js/core/data-items.js` -- the thirteen power-ups, the obstacle catalogue, beam geometry and pickup sizes
  - `js/core/data-tree.js` -- the five tech tree branches, 25 nodes and the cost curve
  - `js/core/data-cosmetics.js` -- six runners with perks, fourteen outfits, fourteen trails and their unlock rules
  - `js/core/data-goals.js` -- 34 achievements and the daily quest pool
  - `js/core/seasons.js` -- festivals by date, event ids, days left, course mutators, the weekly mutator and the Daily Run recipe
  - `js/core/orient.js` -- run directions as views (quarter turns and a mirror), resolving a turn without needless flips, the view at any x with its eased angle, mirror and anchor, and arrows and swipes relative to the screen
  - `js/core/physics.js` -- the pure step function (jumps, coyote time, jump cut, fast fall, slides under beams, dash, springs, boost pads, ledges, pits, flight) and every obstacle's hit box
  - `js/core/course.js` -- the seeded, speed-scaled pattern generator, speed and difficulty along a course, scripted and seeded turns on cleared stretches, streaming and trimming
  - `js/core/solver.js` -- the look-ahead beam-search planner over the real physics and a whole-course driver
  - `js/core/rules.js` -- profile shape and migration, tree stats and purchases, cosmetics, combo tiers, XP and levels, rewards, stars, quests, streaks, festival tiers, high scores
  - `js/core/state.js` -- the one shared state object
  - `js/core/audio.js` -- throttled sound effects, the coin scale and the ambient chimes
  - `js/core/music.js` -- Soundtrack through the shared `SZ.GameMusic`: a theme per world (a bright house groove in the meadows, a hard electro drive through the canyon, a soaring trance line over the frost pass, a neon synthwave pulse in the metro, a breakneck drum & bass run through the Rift), a heavier theme for every guardian chase, a menu theme, calm Zen and a fast theme for Rush and the daily and weekly runs. Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop, breakdown, every pass a little different); every story stage plays a song of its own made from its world's theme. Guardians, long combos and the faster stretches raise the intensity: layers come in and the music pushes into the drop.
  - `js/core/save.js` -- the only module touching localStorage: profile load/migrate/write and the run snapshot
  - `js/systems/fx.js` -- pooled particles, rings, floating texts, shake, flash, hit-stop and slow motion
  - `js/systems/stream.js` -- the run's physics environment, course upkeep, guardian drops, world changes and Boss Rush's turns on a cleared stretch
  - `js/systems/powers.js` -- switching power-ups on, timers, flight, giant growth, coin rain, the time scale and the move modifiers
  - `js/systems/hazards.js` -- smashing obstacles, near misses and the cues of moving obstacles
  - `js/systems/pickups.js` -- coins, gems, shards, tokens, power-up and spark orbs, the finish gate and the magnet
  - `js/systems/player.js` -- input to moves, step events to sound and dust, the trail, shields, stumbles, crashes and revives
  - `js/systems/bosses.js` -- the two chases and three duels in their own directions, volleys, spark bolts, the shadow wall and Boss Rush hand-overs
  - `js/systems/progress.js` -- statistics, toasts, achievements, quests, streak gifts, festival rewards and settling a run
  - `js/systems/run.js` -- building (with its turns), starting, resuming, updating, scoring, the sound of a turn and the first climb's hint, recording the ghost and ending a run
  - `js/systems/autopilot.js` -- the title demo runner driven by the planner
  - `js/systems/cine.js` -- the cinematic player
  - `js/systems/sim.js` -- one simulation step per screen, the demo run and the camera (zoom, look-up, the view's turn, the scenery's on-screen scroll)
  - `js/render/view.js` -- canvas fitting with letterbox bleed, resize and maximize, pointer mapping
  - `js/render/art-kit.js` -- the sprite cache, colour maths, noise and glow sprites
  - `js/render/backdrop-art.js` -- seamless parallax strips for every world, stars and aurora
  - `js/render/vert-art.js` -- each world's climb and drop scenery (far wall, middle layer, near column, light) and the wall slab and ledge tiles
  - `js/render/backdrop.js` -- sky, sun, parallax layers or the vertical scene, crossfades, weather, festival decor, tint and vignette, composed offscreen into one blit
  - `js/render/runner-art.js` -- the jointed runner poses for all six runners and fourteen outfits
  - `js/render/prop-art.js` -- ground, pits, ledges, every obstacle per world, pads, gate, pickups, power-up icons and particle shapes
  - `js/render/boss-art.js` -- the five guardians and the shadow wall
  - `js/render/world.js` -- the turned and mirrored camera transform with the visible rect, upright drawing, and the course: ground or wall slab, pits, ledges, pads, turn chevrons, obstacles, pickups, best-distance flag
  - `js/render/actors.js` -- the runner, ghost, guardians, projectiles, telegraphs, darkness, the streaks of a turn and the run scene order
  - `js/render/fx-render.js` -- particles, rings and floating texts
  - `js/render/hud.js` -- the in-run HUD, the cast's turn lines, the first climb's hint, revive offer, banners, flash and toasts
  - `js/render/cine-render.js` -- the cinematic scenes, letterbox and typed dialogue
  - `js/render/frame.js` -- one frame: scene, HUD, screen, touch controls, fades
  - `js/ui/kit.js` -- text, cached panels, bars, stars, glyphs, currency counters and the logo
  - `js/ui/widgets.js` -- hit areas, buttons, keyboard cursor
  - `js/ui/screens.js` -- screen switching, pause/resume, story starts with their cinematics, Continue
  - `js/ui/title.js` -- the title with modes, profile, festival card and quests
  - `js/ui/map.js` -- the world map and stage cards
  - `js/ui/tree.js` -- the tech tree screen
  - `js/ui/wardrobe.js` -- the collection of runners, outfits and trails
  - `js/ui/journal.js` -- goals, achievements, statistics and high scores
  - `js/ui/results.js` -- the end-of-run screen
  - `js/ui/help.js` -- How to Play
  - `js/ui/pause.js` -- the pause menu
  - `js/ui/touch.js` -- tap and swipe controls (turning with the view) and the touch pause button
  - `js/ui/status-bar.js` -- the window status bar and the High Scores dialog
  - `js/ui/input.js` -- keyboard (arrows relative to the screen), mouse and touch routing, autosave on page hide
  - `js/app.js` -- the fixed-step loop, menu bar wiring and start-up
- `tests/` -- node tests: `harness.js` (fake DOM, canvas and storage), `course.test.js` (pattern and whole-course completability, generator invariants, determinism; `--fast` for a quick subset), `turns.test.js` (turn data, view maths, arrow and swipe mapping, scripted and seeded turns on clear stretches, the planner through every story turn), `bosses.test.js` (a bot beats every guardian in its direction and Boss Rush with its turns), `progression.test.js`, `seasons.test.js`, `save.test.js` (old-key migration, autosave, reload and Continue, a run saved mid-turn, the Daily ghost through its turns) and `scene.test.js` (every screen and cinematic, every direction and a frame mid-turn, draw-call budgets, no shadowBlur, cached art, one full-screen layer per frame)

## User Stories

### Running
- [x] As a player, I can run automatically while the speed climbs with distance
- [x] As a player, I can jump, double jump (triple with upgrades or Spring Shoes), cut a jump short, fast fall, slide and dash
- [x] As a player, I can slide under overhang beams and stay down while one is above me, or land on top of them
- [x] As a player, I can smash crates, fences and flyers with a dash
- [x] As a player, I can see moving obstacles settle into their lane before I reach them, and a shadow where a rock will fall
- [x] As a player, I can score near misses and build a combo multiplier up to x5
- [x] As a player, I can feel every action through particles, screen shake, hit-stop, squash and stretch and sounds
- [x] As a player, I can run right, left, up a wall or down a shaft when the way turns mid-level, with its own scenery for every world
- [x] As a player, I can see a turn coming (chevrons and a line from the cast) on a stretch kept clear of obstacles
- [x] As a player, I can press the arrow that points away from the floor to jump whichever way the screen is turned

### Story
- [x] As a player, I can follow Nova and Pip through five worlds with a world map, cinematics and dialogue
- [x] As a player, I can play twenty stages with three stars each and three hidden Spark Shards
- [x] As a player, I can outrun Thornback and Rime's avalanche (down a mountain face) and defeat the Dune Wyrm, Warden Mk-II (climbing its spire) and the Hollow King (in a world turned round)
- [x] As a player, I can follow the story through the turns of every stage: collapsing bridges, bell towers, lava chimneys, elevator shafts and the Rift's falls
- [x] As a player, I can race the ghost of my best run on a stage

### Modes
- [x] As a player, I can play endless Arcade with a high-score table and my best distance flagged on the course
- [x] As a player, I can play the week's Featured run with a mutator
- [x] As a player, I can relax in Zen mode where crashes only bump me
- [x] As a player, I can play a new seeded Daily Run every day against my own ghost
- [x] As a player, I can fight all five guardians back to back in Boss Rush

### Progress
- [x] As a player, I can spend coins on a 25-node tech tree from the title and from the pause menu with immediate effect
- [x] As a player, I can collect six runners with perks, fourteen outfits and fourteen trails
- [x] As a player, I can earn achievements, complete three daily quests, keep a play streak and read my lifetime statistics
- [x] As a player, I can join seasonal festivals that change the scenery and pay out a reward track
- [x] As a player, I can level up my runner with XP from every run
- [x] As a player, I can leave at any moment and Continue exactly where I was - even half way through a turn - after reloading the page
- [x] As a player, I can keep my old high scores and coins from the previous version

### Controls and Window
- [x] As a player, I can play with the keyboard, the mouse or touch swipes
- [x] As a player, I can resize or maximize the window and the scenery fills it while clicks still land where I aim
- [x] As a player, I can play smoothly on high-density screens and big windows
- [x] As a player, I can open help, controls and high scores from the menu bar

## Controls

| Input | Action |
|---|---|
| Space / W / Up | Jump (again in the air: double jump; release early for a short hop) |
| S / Down | Slide on the ground, fast fall in the air |
| Shift / D / Right | Dash |
| Arrow keys when the way turns | Follow the screen: the arrow away from the floor jumps, toward it slides, along the run dashes |
| Left click / right click / middle click or wheel | Jump / slide / dash |
| Tap or swipe up / swipe down / swipe right | Jump / slide / dash (swipes turn with the view: away from the floor jumps) |
| Esc / P | Pause |
| T | Tech tree |
| H | How to Play |
| F2 | Title screen (the run is saved) |
