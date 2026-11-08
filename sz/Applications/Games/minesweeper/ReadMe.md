# Minesweeper

The mine-clearing logic puzzle grown into an adventure for the »SynthelicZ« Desktop: **The Bloomfield Expedition**. Wren the young surveyor and Tock, her clockwork mole who can hear a mine ticking, clear the clockwork mines the Rustmonger sowed across five lands so Elder Maple can plant again - Meadowmere, Frostfen, the Ember Badlands, the Sunken Archive and the Rust Citadel, thirty fields, five guardian fights and cinematics. Every story field is proven solvable by logic alone. Beside the story wait a faithful **Classic** (Beginner, Intermediate, Expert and custom sizes with best times and streaks), the Daily Field, Zen, Rush, the Gauntlet and Versus races against a CPU surveyor. Shards from every game buy a 24-node tech tree, gems buy tile sets, flags and clearing effects, and seasonal festivals, daily quests, streaks, player levels and 42 achievements bring something new every day. Every game saves itself, so Continue always picks up exactly where you left off.

## How It Works

**Play:** the classic rules. Opening a cell shows how many of its eight neighbours hide a mine; a cell with no mines around it opens its neighbours too, flooding through every connected empty area. The first click is always safe - the mines are placed after it, never on it and, when the field has room, not on its eight neighbours either. Right-clicking plants a flag, then a question mark when marks are on, then nothing. Chording - both buttons, the middle button, or a click on an open number - opens a number's other neighbours once it has as many flags around it as it says. Opening every safe cell wins and flags the rest.

**Proven fields:** `core/board.js` holds a solver that plays a field the way a player reads it, with three rules tried in order: a number whose remaining mines equal its unknown neighbours makes them all mines (and one with no mines left makes them safe); when one number's unknown neighbours lie inside another's, the cells only the second one sees hold exactly the difference of their remaining mines (the subset rule, which solves the 1-2-1 and 1-2 patterns); and the global count (no mines left, or as many mines as unknown cells). A field is proven when the solver clears it from the first click alone. The story, the Daily Field, Zen and Rush draw seeded fields until one is proven - about 31 ms on average for an Expert-sized field. Classic stays random like the original unless proven fields are switched on.

**Engine:** a field is one plain object - size, mines, the board once placed, open cells, flags, gems, chests, defused mines, reburied cells, smoke patches, timers, score, shields and statistics - so it saves as JSON and replays the same from its seed. Every change leaves events (open, flag, chord, boom, shield, gem, chest, win, lose, bury ...) that the game turns into sound, particles, the opening ripple, words and call-outs. A bot over the same engine plays the solver's certain moves and only guesses the least risky cell when logic runs out; it sweeps the title demo, is the Versus rival and proves in the tests that every stage, guardian and mode can be cleared.

**Story:** five lands of six fields. Stage kinds: clear the field, collect every gem, beat the clock, and smoke (patches drift over the field and hide their numbers for a while). Each field has three stars: finish it, beat the par time and meet its bonus goal (never touch a mine, plant no flags, chord a number of times, use no powers, collect every gem). Guardians stand over a bigger field whose safe cells are their health, and their fuse burns while the field is in play - if it burns down, the field blows. Every few seconds they wind up and strike: the Burrowbeast reburies opened number cells, Rimewing freezes the flags, the Cinder Golem blows smoke, the Archivist knocks flags loose and the Rustmonger's Engine takes turns with all four; below half the field they rage. The mines never move, so careful reading always wins. Cinematics open the story, every land and every guardian fight, close every victory and end the game with a finale and credits.

**Treasure and powers:** gems and chests hide on safe cells and are collected as they open. Chests hold powers for the session - the Scanner opens a safe cell next to what you know, Sonar flags a mine next to what you know, the Lantern lights a 3 x 3 area (safe cells open, mines get flags) and the Shield survives one mine (the mine is defused and stays marked). The tech tree adds a head-start Scanner, extra chests, power slots, shields, a longer fuse, warmer gloves against frost and smoke, calmer guardians and a once-per-session Second Chance.

**Modes:** Classic (the original Beginner 9 x 9 with 10 mines, Intermediate 16 x 16 with 40 and Expert 30 x 16 with 99, plus custom sizes up to 30 x 24; best times, a top-five table, wins and streaks per difficulty; no powers, shields or treasure), the Daily Field (one proven field per local day with two twists), Zen (endless proven fields, no clock, a mine only costs points), Rush (three minutes of small proven fields, a mine costs ten seconds), the Gauntlet (all five guardians back to back, opens with two guardians beaten) and Versus (a race against a CPU surveyor). Twists: Thick Sowing, Smoke, Lantern Night (numbers show only near the pointer), No Flags, Gem Rush, Wide Field, Against the Clock and Tremors.

**Versus CPU:** both fields come from the same seed around the same opening click in the middle, opened for both, and the first to clear wins. A mine does not end the race; it stuns its finder for four seconds and is defused. The rival is the solver bot at one of four speeds - Rookie, Pro, Ace and Legend - thinking before every move, with Rookie and Pro stopping to re-read the field now and then; its field is shown small beside yours.

## Progress Without a Server

Everything lives in localStorage - the profile and the snapshot of the game in progress, written every three seconds, on pause and when the page hides. The old game's best times and per-difficulty statistics move into Classic on first launch. The festival running on the local date tints the lands, drifts its decor over every screen, collects tokens from every field and fills a six-tier track with a tile set, a clearing effect and a flag.

**Rendering:** the 1280 x 720 plane is fitted into the window with the land filling any extra space; fields are centred with cells as big as fit (up to 46 px). Cells, numbers, flags, mines, mounds, smoke, backdrops, guardians, portraits, icons and particle shapes are cached sprites in seven tile styles (classic bevel, grass, crystal, stone, metal, wood, neon); no blur filters. A busy frame stays under 3,000 draw calls.

**Soundtrack:** the shared `SZ.GameMusic` composes a theme per land and a darker one per guardian, a menu theme, a sparse thinking theme for Classic, calm Zen and a driving theme for Rush and Versus; a burning fuse and a close race bring drums and lead in.

## Architecture

- `index.html` -- menu bar (New, the three Classic sizes, Story, Modes, Tech Tree, Collection, Journal), canvas, status bar, Controls and About dialogs, SEO text; loads the modules in order
- `styles.css` -- window chrome
- `js/` -- the game under `SZ.Minesweeper`, one module per concern:
  - `js/core/namespace.js`, `constants.js` (view plane, board area, Classic sizes, number colours, powers, storage keys), `rng.js`
  - `js/core/board.js` -- neighbours, mine placement after the first click, numbers, the three-rule solver, the least-risk guess, proven-field generation
  - `js/core/engine.js` -- the pure field engine (reveal and flood, flags and marks, chords, shields, gems and chests, powers, reburying, unflagging, smoke)
  - `js/core/bot.js` -- the solver-driven player bot
  - `js/core/data-worlds.js` (the five lands, 30 stages and guardians), `data-story.js` (cast, cinematics, call-outs), `data-meta.js` (tech tree, tile sets, flags, effects, modes, achievements, quests), `seasons.js` (festivals, twists, the Daily recipe)
  - `js/core/progress.js` -- profile rules: legacy migration, tree, XP, stars, cosmetics, quests, streak, festival, achievements, scores, payouts
  - `js/core/state.js`, `save.js` (the only module touching localStorage), `audio.js`, `music.js`
  - `js/systems/fx.js` (pooled particles, texts, rings, shake, flash, hit-stop), `boss.js` (guardians: fuse, wind-up, strikes, rage), `versus.js` (the race and the CPU rival), `run.js` (sessions for every mode, powers, twists, judging), `play.js` (on screen: start, restart, Continue, actions, juice, results, autosave), `cine.js`, `demo.js`
  - `js/render/view.js`, `art-kit.js`, `tiles.js` (cell art per tile set and size), `backdrop.js`, `boss-art.js` (portraits and guardians), `board-render.js` (the field, pressing, ripple, smoke, Lantern Night, a rival's small field), `fx-render.js`, `hud.js` (Tock's face, goal, digital counters, powers, guardian or rival panel, call-outs), `cine-render.js`, `frame.js`
  - `js/ui/kit.js`, `widgets.js`, `screens.js`, `title.js` (title, modes and the Classic screen), `map.js`, `panels.js` (tree, collection, journal, results, pause, help), `input.js` (classic mouse, keyboard cursor, touch), `status-bar.js`
  - `js/app.js` -- boot, date context, the loop, menu bar
- `tests/` -- node tests: `harness.js` (fake DOM, canvas, storage and clock), `board.test.js` (placement, numbers, the solver's rules and honesty, proven fields up to Expert, reveal, flags and marks, chords, mines and shields, winning, gems and chests, powers, reburying, unflagging, smoke, frozen flags, the bot clearing proven Expert fields without a guess and finishing classic ones, JSON), `run.test.js` (every story field proven, the bot clearing every stage and guardian while they strike, stars, guardian wind-ups, frost, smoke, fuses and rage, chests and every power, Second Chance, Classic sizes, the Daily, Zen, Rush, the Gauntlet, Versus fairness and outcomes, JSON), `scene.test.js` (boot, story, classic mouse play with pressing, flags and chords, keyboard cursor, pause, results, Classic with a best time, every screen, cinematic, mode, tile set, flag, land and guardian, draw-call budget, no shadowBlur, warm frames paint nothing new), `meta.test.js` (legacy migration, saving, Continue, tree, cosmetics, quests, streak, festivals, daily, XP, achievements, payouts)
- `../e2e/minesweeper.e2e.js` -- the browser scenario (see `sz/ReadMe.md`, Game end-to-end tests)

## User Stories

### Play
- [x] As a player, I can open cells, flag them, use question marks and chord numbers with the classic mouse controls
- [x] As a player, my first click is always safe and opens an area
- [x] As a player, I can play with the keyboard (cursor, open, flag, chord) or by touch (tap, long press, flag mode)
- [x] As a player, I can start a new game from Tock's face or with F2

### Story
- [x] As a player, I can clear thirty fields across five lands, each proven solvable by logic alone
- [x] As a player, I can earn three stars per stage for clearing it, beating par and meeting its bonus goal
- [x] As a player, I can fight five guardians that strike while their fuse burns
- [x] As a player, I can watch cinematics for the story, each land and each guardian

### Modes
- [x] As a player, I can play Classic Beginner, Intermediate, Expert and custom sizes with best times and streaks
- [x] As a player, I can switch on proven fields in Classic
- [x] As a player, I can play the Daily Field, Zen, Rush, the Gauntlet and Versus against four CPU rivals

### Progress
- [x] As a returning player, my old best times and statistics carry over into Classic
- [x] As a player, I can buy tech tree upgrades with shards and collect tile sets, flags and effects
- [x] As a player, I can finish daily quests, keep a streak, level up and unlock achievements
- [x] As a player, I can fill seasonal festival tracks for exclusive rewards
- [x] As a player, I can continue an unfinished game exactly where I left it

### Controls and Window
- [x] As a player, I can resize or maximize the window and the field fills it while clicks land where I aim
- [x] As a player, I can switch the music off on its own

## Controls

| Input | Action |
|---|---|
| Left click | Open a cell (on an open number: chord) |
| Right click | Flag, then question mark (when marks are on), then nothing |
| Both buttons / middle button | Chord |
| Arrows / WASD | Move the cell cursor |
| Space / Enter | Open at the cursor (chord on numbers) |
| F / C | Flag / chord at the cursor |
| E, 1-5 | Use a power |
| F2 | New game |
| Esc / P | Pause |
| Touch | Tap opens, long press flags, the flag-mode switch makes taps flag; tap a number to chord |
| Click / any key | Next cinematic line (Esc skips) |

## SEO Keywords

minesweeper, free online minesweeper, no guess minesweeper, logic puzzle, classic minesweeper expert, story mode, boss fights, daily puzzle, versus cpu, tech tree, seasonal events, »SynthelicZ« game
