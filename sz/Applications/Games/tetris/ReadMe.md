# Tetris

The falling-block puzzle grown into an adventure for the »SynthelicZ« Desktop: **The Spire of Lumen**. Kip the young builder and Ollo the stone golem rebuild five crumbling realms and win the stolen keystones back from their guardians - Verdant Ruins, Crystal Hollows, Sunken Temple, Ember Forge and the Starlit Spire, thirty stages, five guardian fights and cinematics. Beside the story wait Marathon, Sprint, Ultra, Zen, the Daily Challenge, Boss Rush, Master, three more puzzle rule sets - Blast, Pairs and Jewels - and Versus against a CPU rival with any of them. Shards from every game buy a 25-node tech tree, gems buy block skins, frames and lock effects, and seasonal festivals, daily quests, streaks, player levels and 53 achievements bring something new every day. Every game saves itself, so Continue always picks up exactly where you left off.

## How It Works

**Play:** a ten-wide, twenty-tall well with two hidden rows above it. Pieces come from a shuffled bag of all seven shapes, rotate with the Super Rotation System and its wall kicks (plus a half turn), can be held once per piece, and are shown up to five ahead (three to start, more with the tech tree) with a ghost where they will land. Gravity follows the guideline curve per level (instant at level 20 and in Master); a landed piece can still slide or turn for half a second, up to fifteen times. Scoring follows the guideline: singles to quads, T-spins and T-spin minis (three-corner rule, the fifth kick upgrades a mini), back-to-back for consecutive quads and T-spins, combos and perfect clears, all times the level. Left and Right repeat after a delay (DAS) at a fast rate (ARR); both are adjustable.

**Engine:** a game is one plain object - board and tag arrays, the bag's seeded generator state, queue, piece, hold, lock and gravity bookkeeping, score, combo and statistics - so it saves as JSON, plays the same from a seed and runs on a fixed step of 1/120 s. Every step leaves events (move, rotate, lock, clear, level-up, garbage, top-out ...) that the game turns into sound, particles and words. A placement bot over the same engine (rotations and columns scored by height, holes, wells, bumpiness and lines, with a one-piece look-ahead) plays the title demo and proves in the tests that every stage, guardian and mode can be finished.

**Story:** five realms of six stages. Stage kinds: clear lines, reach a score in time, dig through every garbage row, clear every gem, survive rising garbage, reach a combo, and the guardian fight. Each stage has three stars: finish it, beat the par time, and meet its bonus goal (a quad, a T-spin, a combo, never holding, a perfect clear or taking no hits). Guardians have hit points; clears hurt them (lines, T-spins, back-to-back, combo and perfect clears hit harder) and first cancel the garbage they send - an attack is telegraphed, then its rows land two seconds later. Each has a special move: Grumbleroot's roots seize the hold slot, Shardmaw drops crystals, Maelora's tide fogs the preview, Vulkar's heat doubles gravity and the Hollow Mason mirrors the stack. At half health they rage. Cinematics open the story, every realm and every guardian fight, close every victory and end the game with a finale and credits; the cast also calls out quads, T-spins, perfect clears and danger during play.

**Modes:** Marathon (endless, a level every ten lines, top-ten table), Sprint (40 lines against the clock), Ultra (two minutes of score attack), Zen (no pressure and no game over - a full well melts its lower half), the Daily Challenge (three minutes on one seed per local day with two mutators), Boss Rush (all five guardians back to back, opens with two guardians beaten) and Master (instant gravity from the first piece, opens with three guardians or 150 Marathon lines).

**Rule sets:** Blast plays the falling blocks with bombs - about one piece in six carries one, and when its row clears it blows away every block within two cells, the columns collapse and any rows that fill clear too. Pairs and Jewels run on a separate colour-match engine with the same interface, in a six-wide, twelve-tall well. In Pairs a pair of blobs (four colours) turns around its lower blob with small kicks; after landing every blob falls on its own, and four or more touching blobs of a colour burst. In Jewels a column of three jewels (six colours, each with its own cut) cycles its order when turned, and three or more in a row across, down or diagonally shatter. In both, whatever falls into a new burst is the next link of a chain and scores far more (Pairs multiplies by 8, 16, 32... per link, Jewels by the square of the link), grey stones only break next to a burst, and gravity speeds up every 40 cleared cells. Each rule set is a mode of its own with a best score.

**Versus CPU:** a second, smaller board on the right where a CPU rival plays the same pieces from the same seed. Clears send garbage after the attack table - double 1, triple 2, quad 4, T-spin single/double/triple 2/4/6, mini double 1, back-to-back +1, combos up to +5, a perfect clear +10 - which first cancels your own incoming rows and lands on the other board after 1.5 seconds with one hole per attack. Both boards speed up every 25 seconds, and the first to top out loses. The rival is the placement bot steered like a hand on the controls (it waits, holds, turns and slides step by step) at four strengths: Rookie, Pro, Ace and Legend, which differ in thinking time, step speed, look-ahead and how often they settle for a worse spot. Versus takes any rule set: in Blast every bomb that goes off adds a row, in Pairs and Jewels bursts send grey stones instead of rows (Pairs: one per blob past the third and four per chain link; Jewels: one per jewel past the second and three per link). The rival plans its pieces with each engine's own placement bot. Wins count toward five achievements and a daily quest. Mutators: Overclock, Rising Tide, Empty Pockets, Power Party, Fog, Gem Fever, Earthquake and Ghost Blocks.

**Powers:** some pieces carry a glowing orb; clearing its row puts a power in a free slot, E uses it: Sweep (two bottom rows), Slow Time, I-Storm (three bars), and from the tech tree Quake (every column settles), Laser (the tallest column), Bomb (a 4 x 4 hole), Score Rush and Aegis (blocks an attack or a top-out).

**Progress without a server:** everything lives in localStorage - the profile (shards, gems, XP and level, tech tree, stars and best times, collection, statistics, high scores, quests, streak, festival track) and the snapshot of the game in progress, written every three seconds, on pause and when the page hides. The old game's top-five table moves into Marathon on first launch. The festival running on the local date (Frostfall, Bloom Festival, Sunfest, Harvest Moon, Hollow Night, Starfall Eve) tints the realms, drifts its decor over every screen, collects tokens from every clear and fills a five-tier track that ends in a block skin and a lock effect.

**Rendering:** the 1280 x 720 plane is fitted into the window with the realm filling any extra space; clicks are mapped back into the plane. Blocks, wells, backdrops, guardians, portraits, icons and particle shapes (also pre-turned in eight steps) are painted once into cached sprites, so a frame only blits; no blur filters. Particles, texts and rings live in fixed pools. A busy frame (full particle pool, a guardian, powers, words) stays under 3,000 draw calls.

**Soundtrack:** the shared `SZ.GameMusic` composes a theme per realm and a faster one per guardian, a menu theme, calm Zen, driving Sprint and Ultra and a tense Master theme; the stack height and danger bring drums and lead in. Every action has a sound through `SZ.GameAudio`.

## Architecture

- `index.html` -- menu bar, canvas, status bar, Controls and About dialogs, SEO text; loads the modules in order
- `styles.css` -- window chrome
- `js/` -- the game under `SZ.Tetris`, one module per concern:
  - `js/core/namespace.js` -- the namespace with one empty object per module
  - `js/core/constants.js` -- view plane and layout, board size, timings, the shapes, the SRS kick tables, guideline scoring, pools, storage keys, palette
  - `js/core/rng.js` -- seeded generators with saveable state, hashing, day and week keys, easing
  - `js/core/engine.js` -- the pure playfield engine (bag, movement, kicks, hold, drops, gravity, lock delay, T-spins, clears, scoring, garbage, crystals, mirror, cascade, sweep, laser, bomb, Blast bombs)
  - `js/core/bot.js` -- the placement bot with look-ahead
  - `js/core/match.js` -- the colour-match engine for Pairs and Jewels (pieces, kicks, falling apart, bursts, chains, stones, gravity) and its chain-simulating placement bot
  - `js/core/data-worlds.js` -- the five realms, their 30 stages and guardians
  - `js/core/data-story.js` -- the cast, every cinematic and the call-outs
  - `js/core/data-meta.js` -- powers, tech tree, block skins, frames, lock effects, modes, achievements, quests
  - `js/core/seasons.js` -- festivals by date and their track, mutators, the Daily Challenge recipe
  - `js/core/progress.js` -- profile rules: migration, tree, XP, stars, unlocking, cosmetics, quests, streak, festival, achievements, scores, payouts
  - `js/core/state.js` -- the shared state object
  - `js/core/save.js` -- the only module touching localStorage (profile and game snapshot)
  - `js/core/audio.js` -- sound effects per engine event
  - `js/core/music.js` -- the themes and their choice per screen
  - `js/systems/fx.js` -- pooled particles, texts, rings, shake, flash, hit-stop
  - `js/systems/boss.js` -- guardian fights: attacks, cancelling, specials, rage, damage
  - `js/systems/powers.js` -- orbs to powers and their effects
  - `js/systems/versus.js` -- Versus: the attack table, sending, cancelling and landing garbage, the CPU rival's strengths and its step-by-step steering, the speed-up
  - `js/systems/run.js` -- a session: building any mode or stage, objectives, stars, revives, the fixed-step tick, Boss Rush
  - `js/systems/play.js` -- sessions on screen: starting with cinematics, Continue, events to juice and call-outs, finishing into results, autosave
  - `js/systems/cine.js` -- the cinematic player
  - `js/systems/demo.js` -- the title demo
  - `js/render/view.js` -- canvas fitting, resize, pointer mapping
  - `js/render/art-kit.js` -- sprite cache, colours, glow, shapes
  - `js/render/blocks.js` -- every block skin, garbage, crystals, orbs, gems, ghost
  - `js/render/backdrop.js` -- realm backdrops, ambience, festival decor, vignette and danger glow
  - `js/render/boss-art.js` -- portraits and guardians
  - `js/render/board-render.js` -- the well, blocks, bombs, clears, ghost, piece, garbage meter, hold and next
  - `js/render/match-render.js` -- the Pairs and Jewels well: blobs with bridges, jewels, stones, bursts, ghost, piece, stone meter, next
  - `js/render/fx-render.js` -- particles, rings, texts, flash
  - `js/render/hud.js` -- powers, objective, stats, guardian panel, effects, combo, call-outs, touch buttons
  - `js/render/cine-render.js` -- letterbox, cards, dialogue, guardian reveals, victories, credits, the count
  - `js/render/frame.js` -- one frame
  - `js/ui/kit.js` -- text, panels, bars, icons, stars, chips
  - `js/ui/widgets.js` -- hit areas, buttons, keyboard cursor
  - `js/ui/screens.js` -- screen machine, pause, toasts, confirmation
  - `js/ui/title.js` -- the title and the modes screen
  - `js/ui/map.js` -- the story map
  - `js/ui/panels.js` -- tech tree, collection, journal, results, pause, how to play
  - `js/ui/input.js` -- keyboard with DAS/ARR, touch gestures, mouse
  - `js/ui/status-bar.js` -- the window status bar
  - `js/app.js` -- boot, date context, the loop, menu bar
- `tests/` -- node tests: `harness.js` (fake DOM, canvas, storage and clock), `engine.test.js` (bag, kicks, T-spins, scoring, hold, lock delay, levels, top-out, Zen, garbage and powers, a 400-piece bot game, JSON), `run.test.js` (the bot finishes every stage and guardian and every mode, stars, guardian mechanics, powers, revives, mutators), `scene.test.js` (boot, story, keyboard play, pause, every screen and cinematic, every mode and realm, draw-call budget, no shadowBlur, warm frames paint nothing new), `match.test.js` (spawning, pair turns and kicks, jewel cycling, falling apart, bursts of four and lines of three, stones, chains and their scoring, rival stones, gravity, the bot playing long games with chains, JSON), `rules.test.js` (each rule set on its engine, a Blast bomb going off and the collapse, solo runs as score runs, Versus with every rule, stone attacks, the Rookie and Legend tests per rule, JSON), `versus.test.js` (attack table, same pieces on both boards, sending, cancelling and landing, the rival steers and plays, speed-up, a quick player beats the Rookie, the Legend beats a slow player, JSON replay), `meta.test.js` (migration, saving, Continue, tree, cosmetics, quests, streak, festivals, daily, XP, achievements, payouts)

## User Stories

### Play
- [x] As a player, I can move, turn both ways and half way, soft drop and hard drop pieces with SRS wall kicks
- [x] As a player, I can hold a piece once per drop and see up to five pieces ahead and a ghost of the landing spot
- [x] As a player, I can slide or turn a landed piece for half a second, up to fifteen times
- [x] As a player, I can score quads, T-spins, minis, back-to-back clears, combos and perfect clears, each with its own effect
- [x] As a player, I can feel every clear through particles, flashes, shakes, hit-stop, words and sounds
- [x] As a player, I can tune the auto-repeat delay and switch the ghost off

### Story
- [x] As a player, I can follow Kip and Ollo through five realms with cinematics, a map and dialogue
- [x] As a player, I can play thirty stages of seven kinds with three stars each
- [x] As a player, I can fight five guardians that attack with garbage and special moves and rage at half health
- [x] As a player, I can cancel incoming garbage with clears and see a finale and credits

### Modes
- [x] As a player, I can play Marathon, Sprint, Ultra, Zen, the Daily Challenge, Boss Rush and Master
- [x] As a player, I can play Versus against a CPU rival of four strengths, sending and cancelling garbage
- [x] As a player, I can play Blast, Pairs and Jewels on their own or in Versus
- [x] As a player, I can play the same Daily Challenge as everyone today with two mutators

### Progress
- [x] As a player, I can earn powers from orbs and use them with E
- [x] As a player, I can spend shards on a 25-node tech tree that changes my next game
- [x] As a player, I can collect block skins, frames and lock effects with gems, stars, levels, achievements and festivals
- [x] As a player, I can finish daily quests, keep a streak, level up and earn achievements
- [x] As a player, I can join seasonal festivals that change the look and pay out a reward track
- [x] As a player, I can leave at any time and Continue the same game after a reload
- [x] As a player, I can keep my old high scores

### Controls and Window
- [x] As a player, I can play with the keyboard, the mouse or touch gestures and buttons
- [x] As a player, I can resize or maximize the window and the realm fills it while clicks land where I aim
- [x] As a player, I can switch the music off on its own

## Controls

| Input | Action |
|---|---|
| Left / Right | Move (hold to repeat) |
| Down | Soft drop |
| Space | Hard drop |
| Up / X | Turn clockwise |
| Z / Ctrl | Turn counter-clockwise |
| A | Half turn |
| C / Shift | Hold |
| E | Use a power |
| Esc / P | Pause |
| Touch | Tap turns, drag sideways moves, drag down soft drops, flick down drops, flick up holds |
| Click / any key | Next cinematic line (Esc skips) |
| F2 | Title screen (the game is saved) |

## SEO Keywords

tetris, block puzzle, falling blocks, free online puzzle game, T-spin, combo, sprint 40 lines, marathon, ultra, zen mode, daily challenge, boss fight puzzle, story mode, tech tree, block skins, seasonal events, »SynthelicZ« game
