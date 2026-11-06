# Endless Runner

The classic auto-runner grown into an adventure for the »SynthelicZ« Desktop. Run, jump, double jump, slide and dash with Nova the courier and Pip her lantern drone through five worlds to bring the five Spark Cores home and relight the Beacon of Lumen - or chase scores in Arcade, unwind in Zen, race your own ghost on the Daily Run and take on all five guardians in Boss Rush. Coins from every mode buy a 25-node tech tree, gems buy runners and outfits, and seasonal festivals, daily quests, streaks and achievements bring something new every day. Every run saves itself, so Continue always picks up exactly where you left off.

## How It Works

The runner moves forward on its own at a speed that climbs with distance. The course is generated ahead of the runner from a seeded stream of hand-shaped patterns - fences and crates to jump, overhang beams to slide under (or land on), walls that need a double jump or the ledges above, spikes, pits with and without stepping stones, springs, boost pads, saws and flyers that settle into a lane as you approach (a red ring means jump, blue means slide), falling rocks with a shadow warning, rollers, crumbling ledges and high gem routes. Every gap and spacing is scaled by the speed at that spot, so a pattern stays fair at any speed; moving obstacles move with the runner's distance rather than the clock, so a course plays the same at any frame rate. The same physics step drives the game, the title screen's demo runner and the solver the tests use to prove every pattern, every story stage, the Daily Run and long Arcade stretches can be finished.

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
  - `js/core/data-story.js` -- the cast and every cinematic
  - `js/core/data-items.js` -- the thirteen power-ups, the obstacle catalogue, beam geometry and pickup sizes
  - `js/core/data-tree.js` -- the five tech tree branches, 25 nodes and the cost curve
  - `js/core/data-cosmetics.js` -- six runners with perks, fourteen outfits, fourteen trails and their unlock rules
  - `js/core/data-goals.js` -- 34 achievements and the daily quest pool
  - `js/core/seasons.js` -- festivals by date, event ids, days left, course mutators, the weekly mutator and the Daily Run recipe
  - `js/core/physics.js` -- the pure step function (jumps, coyote time, jump cut, fast fall, slides under beams, dash, springs, boost pads, ledges, pits, flight) and every obstacle's hit box
  - `js/core/course.js` -- the seeded, speed-scaled pattern generator, speed and difficulty along a course, streaming and trimming
  - `js/core/solver.js` -- the look-ahead beam-search planner over the real physics and a whole-course driver
  - `js/core/rules.js` -- profile shape and migration, tree stats and purchases, cosmetics, combo tiers, XP and levels, rewards, stars, quests, streaks, festival tiers, high scores
  - `js/core/state.js` -- the one shared state object
  - `js/core/audio.js` -- throttled sound effects, the coin scale and the ambient chimes
  - `js/core/save.js` -- the only module touching localStorage: profile load/migrate/write and the run snapshot
  - `js/systems/fx.js` -- pooled particles, rings, floating texts, shake, flash, hit-stop and slow motion
  - `js/systems/stream.js` -- the run's physics environment, course upkeep, guardian drops and world changes
  - `js/systems/powers.js` -- switching power-ups on, timers, flight, giant growth, coin rain, the time scale and the move modifiers
  - `js/systems/hazards.js` -- smashing obstacles, near misses and the cues of moving obstacles
  - `js/systems/pickups.js` -- coins, gems, shards, tokens, power-up and spark orbs, the finish gate and the magnet
  - `js/systems/player.js` -- input to moves, step events to sound and dust, the trail, shields, stumbles, crashes and revives
  - `js/systems/bosses.js` -- the two chases and three duels, volleys, spark bolts, the shadow wall and Boss Rush hand-overs
  - `js/systems/progress.js` -- statistics, toasts, achievements, quests, streak gifts, festival rewards and settling a run
  - `js/systems/run.js` -- building, starting, resuming, updating, scoring, recording the ghost and ending a run
  - `js/systems/autopilot.js` -- the title demo runner driven by the planner
  - `js/systems/cine.js` -- the cinematic player
  - `js/systems/sim.js` -- one simulation step per screen, the demo run and the camera
  - `js/render/view.js` -- canvas fitting with letterbox bleed, resize and maximize, pointer mapping
  - `js/render/art-kit.js` -- the sprite cache, colour maths, noise and glow sprites
  - `js/render/backdrop-art.js` -- seamless parallax strips for every world, stars and aurora
  - `js/render/backdrop.js` -- sky, sun, parallax layers, weather, festival decor, tint and vignette
  - `js/render/runner-art.js` -- the jointed runner poses for all six runners and fourteen outfits
  - `js/render/prop-art.js` -- ground, pits, ledges, every obstacle per world, pads, gate, pickups, power-up icons and particle shapes
  - `js/render/boss-art.js` -- the five guardians and the shadow wall
  - `js/render/world.js` -- the camera transform and the course: ground, pits, ledges, pads, obstacles, pickups, best-distance flag
  - `js/render/actors.js` -- the runner, ghost, guardians, projectiles, telegraphs, darkness and the run scene order
  - `js/render/fx-render.js` -- particles, rings and floating texts
  - `js/render/hud.js` -- the in-run HUD, revive offer, banners, flash and toasts
  - `js/render/cine-render.js` -- the cinematic scenes, letterbox and typed dialogue
  - `js/render/frame.js` -- one frame: scene, HUD, screen, touch controls, fades
  - `js/ui/kit.js` -- text, panels, bars, stars, glyphs, currency counters and the logo
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
  - `js/ui/touch.js` -- tap and swipe controls and the touch pause button
  - `js/ui/status-bar.js` -- the window status bar and the High Scores dialog
  - `js/ui/input.js` -- keyboard, mouse and touch routing, autosave on page hide
  - `js/app.js` -- the fixed-step loop, menu bar wiring and start-up
- `tests/` -- node tests: `harness.js` (fake DOM, canvas and storage), `course.test.js` (pattern and whole-course completability, generator invariants, determinism; `--fast` for a quick subset), `bosses.test.js` (a bot beats every guardian and Boss Rush), `progression.test.js`, `seasons.test.js`, `save.test.js` (old-key migration, autosave, reload and Continue) and `scene.test.js` (every screen and cinematic, draw-call budgets, no shadowBlur, cached art)

## User Stories

### Running
- [x] As a player, I can run automatically while the speed climbs with distance
- [x] As a player, I can jump, double jump (triple with upgrades or Spring Shoes), cut a jump short, fast fall, slide and dash
- [x] As a player, I can slide under overhang beams and stay down while one is above me, or land on top of them
- [x] As a player, I can smash crates, fences and flyers with a dash
- [x] As a player, I can see moving obstacles settle into their lane before I reach them, and a shadow where a rock will fall
- [x] As a player, I can score near misses and build a combo multiplier up to x5
- [x] As a player, I can feel every action through particles, screen shake, hit-stop, squash and stretch and sounds

### Story
- [x] As a player, I can follow Nova and Pip through five worlds with a world map, cinematics and dialogue
- [x] As a player, I can play twenty stages with three stars each and three hidden Spark Shards
- [x] As a player, I can outrun Thornback and Rime's avalanche and defeat the Dune Wyrm, Warden Mk-II and the Hollow King
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
- [x] As a player, I can leave at any moment and Continue exactly where I was, even after reloading the page
- [x] As a player, I can keep my old high scores and coins from the previous version

### Controls and Window
- [x] As a player, I can play with the keyboard, the mouse or touch swipes
- [x] As a player, I can resize or maximize the window and the scenery fills it while clicks still land where I aim
- [x] As a player, I can open help, controls and high scores from the menu bar

## Controls

| Input | Action |
|---|---|
| Space / W / Up | Jump (again in the air: double jump; release early for a short hop) |
| S / Down | Slide on the ground, fast fall in the air |
| Shift / D / Right | Dash |
| Left click / right click / middle click or wheel | Jump / slide / dash |
| Tap or swipe up / swipe down / swipe right | Jump / slide / dash |
| Esc / P | Pause |
| T | Tech tree |
| H | How to Play |
| F2 | Title screen (the run is saved) |
