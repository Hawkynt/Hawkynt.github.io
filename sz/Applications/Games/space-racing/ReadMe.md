# Space Racing

Top-down spaceship racing with drifting, boost, item combat, a four-cup career and a workshop tech tree -- built for the SynthelicZ Desktop.

## User Stories

### Tracks & Art
- [x] As a player, I can race on 8 themed tracks (Nebula Circuit, Ion Storm Speedway, Pulsar Drift, Asteroid Alley, Solar Flare Loop, Comet Canyon, Quasar Ring, Void Serpent) so that courses have variety
- [x] As a player, I can drive every track as a mirrored reverse variant so that familiar layouts get a second life
- [x] As a player, I can see per-track road and background art in its own theme colors so that each circuit reads differently
- [x] As a player, I can hit boost pads, dodge asteroid, barrier and flare hazards, ride gravity wells and take wormhole shortcuts so that every lap has features to work with

### Racing & Physics
- [x] As a player, I can accelerate with Up/W, brake with Down/S and steer with Left/Right or A/D so that controls feel intuitive
- [x] As a player, I can hold the mouse button to steer toward the cursor while the throttle stays on, with the same engine flame and exhaust as keyboard throttle, so that mouse-only play is supported
- [x] As a player, I can hold Space while steering to drift, with a blue mini-turbo after a short slide and an orange mega turbo after a long one so that corners pay off
- [x] As a player, I can watch the boost meter fill from drifting and from the slipstream behind an opponent, and spend it on a Shift boost so that speed management matters
- [x] As a player, I can nail a perfect start by accelerating right at GO, or stall the launch by holding the throttle too early so that the start is a real moment
- [x] As a player, I feel drag off the road and bounce off the barrier at the track edge so that staying on the racing line matters
- [x] As a player, I see a WRONG WAY banner when I drive against the lap direction so that mistakes are obvious
- [x] As a player, I race a set number of laps with live position tracking and lap splits so that races have structure

### Items
- [x] As a player, I can drive through item boxes to pick up a missile, mine, shield, EMP or turbo so that racing has a combat layer
- [x] As a player, I can use the held item with E or the right mouse button so that items are quick to fire
- [x] As a player, items are weighted by my race position -- leaders get mines, chasers get missiles and turbos -- so that the field stays close
- [x] As a player, I can buy the Item Rack in the Workshop to carry a second item so that item strategy deepens
- [x] As a player, item boxes refill a few seconds after pickup so that the same stretch stays contested

### AI Opponents
- [x] As a player, I race against 3 of 5 AI personalities (Blaze, Comet, Nebula, Pulse, Drift) with distinct speed, cornering and aggression so that races feel different
- [x] As a player, the AI brakes for corners, makes occasional steering mistakes and uses items so that opponents behave like racers
- [x] As a player, AI strength scales per cup so that the career ramps up

### Career & Cups
- [x] As a player, I can play a career of four cups -- Bronze, Silver, Gold, Platinum -- with four races each so that there is a long progression arc
- [x] As a player, I score championship points 10/6/4/3 per race and the cup standings give the top three a gold, silver or bronze trophy so that consistency pays
- [x] As a player, finishing a cup in the top three unlocks the next cup so that progress is gated by racing
- [x] As a player, the Gold and Platinum cups run their tracks in reverse, and a Gold trophy also unlocks reverse tracks in Quick Race so that reverse driving is a reward
- [x] As a player, my in-progress cup is saved and can be continued from the Career screen so that a cup can span sessions

### Workshop Tech Tree
- [x] As a player, I can spend race credits in a tech tree with five branches -- Engine, Handling, Hull, Boost, Arsenal -- so that I build a ship for my style
- [x] As a player, I can buy leveled nodes with prerequisites covering top speed, acceleration, steering, drift charging, off-road grip, spin-out recovery, barrier bumps, shield time, boost power and cost, launch control, item luck, missiles, EMP radius, twin mines and a second item slot so that the tree has real choices
- [x] As a player, two nodes additionally require a cup trophy so that the tree ties into the career
- [x] As a player, I earn credits from finishing position (500/300/150/50, scaled per cup) plus bonuses for perfect starts, mega turbos, hits and clean races so that racing well pays

### Garage & Ships
- [x] As a player, I can choose from 5 ships with different speed, acceleration, handling and boost stats so that I pick a playstyle
- [x] As a player, I unlock ships by cup trophies or by buying them with credits so that the garage grows with the career
- [x] As a player, I see each ship's stat bars with the Workshop bonus shown as a lighter extension so that upgrades are visible

### HUD
- [x] As a player, I see position, lap counter, race clock and best lap so that the race state is always readable
- [x] As a player, I see a speedometer, the boost meter with its cost tick and the drift charge bar so that the speed systems are visible
- [x] As a player, I see a minimap of the track and a live standings list so that I know where everyone is
- [x] As a player, I see my held item in an item slot plus countdown, wrong-way and final-lap notices so that the race talks to me

### Screens & Menus
- [x] As a player, I move through Title, Career, Cup Intro, Quick Race, Garage, Workshop, Results and Standings screens so that the game is fully navigable
- [x] As a player, every screen works with keyboard (arrows/WASD, Enter, Esc) and mouse so that either input is enough
- [x] As a player, I can pause with Escape and resume, restart or quit to the menu so that races are interruptible
- [x] As a player, I can start a fresh quick race with F2 during a race, and reach the Garage and Workshop from the title screen or the Game menu so that the screens are close at hand

### Audio
- [x] As a player, I hear a procedural engine hum that follows my speed, a drift hiss and a barrier scrape so that the ship speaks through sound
- [x] As a player, I hear slipstream sweeps, item sounds, lap chimes and a win fanfare so that events are signalled
- [x] As a player, I can mute everything with the mute button so that sound is optional

### Saves & Records
- [x] As a player, my credits, tech tree, trophies, cup progress, best laps, unlocked ships and tracks persist in a versioned save so that progress carries between sessions
- [x] As a player, an old save is migrated automatically and its ship upgrades are refunded as credits so that nothing is lost
- [x] As a player, I can see high scores per track and best laps per track variant so that records survive

### Planned Features
- [ ] As a player, I can watch ghost replays of my best laps so that I can learn the racing line
- [ ] As a player, I can compare times on online leaderboards so that records are competitive
- [ ] As a player, I can hear background music so that the racing atmosphere is more immersive
- [ ] As a player, I can race on procedurally generated tracks so that replayability is extended

## Controls

| Key | Action |
|-----|--------|
| Up / W | Accelerate |
| Down / S | Brake / Reverse |
| Left / A | Steer left |
| Right / D | Steer right |
| Mouse (hold button) | Steer toward cursor, throttle stays on |
| Right mouse | Use held item |
| Space | Drift (hold while steering) |
| Shift | Boost (spends boost meter) |
| E | Use held item |
| Escape | Pause / Resume / Back |
| H | Toggle help overlay |
| F2 | New quick race |

## Architecture

Plain browser scripts, no build step. Every game module is an IIFE that adds one object to `SZ.SpaceRacing`; `index.html` loads them in dependency order (each file only uses names of files above it at load time, later modules are reached through `SZ.SpaceRacing.module(name)` at call time). All shared mutable values live in one long-lived object, `SZ.SpaceRacing.state` (named `G` in every module); systems read and write it with plain property access.

| File | Responsibility |
|------|----------------|
| `index.html` | Page, menu bar, dialogs and the ordered script list |
| `styles.css` | Page layout |
| `js/core/track-geometry.js` | `SZ.RacingTrack.build`: Catmull-Rom track geometry, sampling and locating |
| `js/core/tracks-data.js` | `SZ.RacingTracks`: the 8 track definitions and their features |
| `js/render/track-art.js` | `SZ.RacingTrackArt`: themed road and background art with cached sprites |
| `js/render/ship-art.js` | `SZ.RacingShipArt`: cached, shaded ship sprites for the five hull shapes |
| `js/ui/racing-ui.js` | `SZ.RacingUI`: panel, text fitting, chips, keycaps, meters and headlines |
| `js/core/constants.js` | Canvas size, screen states, storage keys and every tuning number; defines `SZ.SpaceRacing.module` |
| `js/core/defs.js` | Ships, Workshop tree, AI personalities, cups, tutorial pages, theme colors, reverse-track variants |
| `js/core/util.js` | 60 Hz frame scaling of per-frame rates and spawn counts, time / ordinal / roman-number formatting |
| `js/core/runtime.js` | Canvas, 2D context, UI kit, status-bar elements, OS window API, particle / shake / text effects |
| `js/core/state.js` | The shared state object `G` |
| `js/core/save.js` | High scores, versioned career save, old-save migration |
| `js/core/progress.js` | Workshop tree rules and purchases, tree bonuses on ship stats, ship unlocks |
| `js/systems/career.js` | Cup flow, standings, cup points and trophies, best laps, race rewards |
| `js/systems/track.js` | A racer's track progress, off-road drag and the barrier |
| `js/systems/race-setup.js` | Builds the track and its features, start grid, per-race reset |
| `js/systems/player.js` | Player ship: launch, steering, drifting, boost, mouse steering, slipstream |
| `js/systems/ai.js` | AI opponents: racing line, mistakes, braking, rubber band, finish |
| `js/systems/features.js` | Boost pads, hazards, gravity wells and wormholes |
| `js/systems/items.js` | Item boxes, item use by player and AI, missiles, mines, EMP, shields, hits |
| `js/systems/race.js` | Laps and splits, live place, wrong way, race finish |
| `js/systems/race-audio.js` | Engine hum, drift hiss and barrier scrape |
| `js/systems/effects.js` | Particles, speed streaks, trails, skids, themed ambience, lap flashes, confetti |
| `js/render/view.js` | Canvas sizing and letterbox, camera follow and zoom, world/screen transforms |
| `js/render/world.js` | Drawing of the race world: road, features, items, ships, trails and effects |
| `js/render/hud.js` | Race HUD: place, laps, speedometer, boost meter, minimap, standings, item slots |
| `js/ui/flow.js` | Screen changes, pause, Workshop entry and exit, window title |
| `js/ui/menu-kit.js` | Menu hit areas, cursor, buttons, trophies, locks, track previews |
| `js/ui/screens.js` | Title, career, cup intro, quick race and garage screens |
| `js/ui/results.js` | Results, cup standings, pause panel and help overlay |
| `js/ui/tree-screen.js` | Workshop tech-tree screen and its keyboard selection |
| `js/ui/input.js` | Keyboard, pointer and auto-pause listeners |
| `js/app.js` | Update and draw order, status bar, game loop, menu actions, OS integration, startup |
| `tests/*.test.js` | Node tests for geometry, track data, reverse variants, track art, ship art and the UI kit |

## SEO Keywords

space racing game, browser racing game, top-down racing, spaceship racing, HTML5 racing game, canvas racing game, drifting, mini-turbo, boost, slipstream, item combat, career mode, cups, tech tree, reverse tracks, AI opponents, space race, SynthelicZ Desktop game, web OS game, online racing game
