# Breakout

The brick breaker grown into an adventure for the »SynthelicZ« Desktop: **Prism Run**. Juno and her drone Bolt fly the paddle-ship Aurora into the five brick fortresses where the Gloom Engine has walled up the starlight - Neon Gardens, Glacier Citadel, Clockwork Foundry, Coral Abyss and the Gloom Engine itself, thirty stages, five guardian fights and cinematics. Beside the story wait Arcade, Blitz, Zen, the Daily Challenge and Boss Rush. Shards from every game buy a 25-node tech tree, gems buy paddles, balls and trails, and seasonal festivals, daily quests, streaks, player levels and 38 achievements bring something new every day. Every game saves itself, so Continue always picks up exactly where you left off.

## How It Works

**Play:** a 700 x 640 field with a 14-column brick grid. The paddle follows the mouse or a finger (or Left/Right, A/D); where the ball lands on it sets the bounce angle, up to about 60 degrees, and the ball never flies nearly flat. Bricks: six colours (one hit), steel (two), titan (three, stops even a fire ball), glass (the ball passes through), walls (never break), bombs (break their neighbours, chains included), regrowing bricks (come back after eight seconds and do not block the clear), gold targets (two hits, the goal of gold stages) and crystals (always drop a power-up). Breaking bricks without touching the paddle builds a combo that raises every brick's points. A ball that has not touched a brick for a while is nudged out of its loop.

**Power-ups** fall from broken bricks and are caught with the paddle: Wide, Multi (every ball splits into three), Slow, Fire (burns through bricks), Laser (twin cannons on Space or click), Barrier (saves a ball), Extra Life, and from the tech tree Magnet (balls stick), Mega Ball (huge, three times the damage) and Star Shower; Shrink and Haste are grey and best dodged.

**Engine:** a game is one plain object - bricks, paddle, balls, drops, lasers, stars, timers, score, lives, statistics and the seeded generator state - so it saves as JSON and replays the same. It runs on a fixed step of 1/240 s with balls moving in sub-steps no longer than half their radius against walls, bricks, the guardian and the paddle. Every step leaves events (bounce, hit, break, bomb, power, lost, life, cleared ...) that the game turns into sound, particles, words and call-outs. A paddle bot over the same engine predicts where the most urgent ball lands, angles it toward the lowest brick or the guardian and catches good drops; it plays the title demo and proves in the tests that every stage, guardian and mode can be finished.

**Story:** five fortresses of six stages. Stage kinds: clear every brick, break every gold target, clear against the clock, and the guardian. Each stage has three stars: finish it, beat the par time and meet its bonus goal (lose no ball, reach a combo, catch power-ups). Guardians float at the top inside an orbiting ring of shield bricks that grow back; hitting the body hurts them (two points, fire three, mega five; lasers chip). They shoot at the paddle - seeds and bolts stun, ice shrinks, ink clouds the field, void does both - and each has a move of its own: the Hedge Colossus sprouts a row of regrowing bricks, the Frost Warden refreezes its shield, the Gear Tyrant spins its ring hard and fires in threes, the Abyssal Kraken inks the field and the Gloom Engine pulls the balls toward its core when it rages at half health. Cinematics open the story, every fortress and every guardian fight, close every victory and end the game with a finale and credits.

**Modes:** Arcade (endless symmetric walls from a seeded generator, faster and tougher with every wall, three balls, top-ten table), Blitz (two minutes of endless walls with unlimited balls), Zen (no lives, no clock, calm music), the Daily Challenge (three minutes on one seed per local day with two mutators) and Boss Rush (all five guardians back to back, opens with two guardians beaten). Mutators: Turbo Ball, Slim Paddle, Bare Hands, Power Party, Blackout, Regrowth, Heavy Ball and Triple Start.

**Progress without a server:** everything lives in localStorage - the profile (shards, gems, XP and level, tech tree, stars and best times, collection, statistics, high scores, quests, streak, festival track) and the snapshot of the game in progress, written every three seconds, on pause and when the page hides. The old game's top-five table moves into Arcade on first launch. The festival running on the local date tints the fortresses, drifts its decor over every screen, collects tokens from every brick and fills a five-tier track that ends in a paddle and a ball trail.

**Rendering:** the 1280 x 720 plane is fitted into the window with the fortress filling any extra space. Bricks, cracks, paddles (a stretchable body and two emitter caps), balls, capsules, shots, backdrops, guardians, portraits, icons and particle shapes are painted once into cached sprites; no blur filters. Particles, texts and rings live in fixed pools. A busy frame (many balls, all power-ups, a guardian, a full particle pool) stays under 3,000 draw calls.

**Soundtrack:** the shared `SZ.GameMusic` composes a theme per fortress and a faster one per guardian, a menu theme, calm Zen and driving Blitz; combos, multiple balls and the last ball bring drums and lead in. Every action has a sound through `SZ.GameAudio`, the brick chime climbing a scale with the combo.

## Architecture

- `index.html` -- menu bar, canvas, status bar, Controls and About dialogs, SEO text; loads the modules in order
- `styles.css` -- window chrome
- `js/` -- the game under `SZ.Breakout`, one module per concern:
  - `js/core/namespace.js`, `constants.js` (field, grid, paddle, ball, drops, brick kinds, power-ups, palette), `rng.js`
  - `js/core/engine.js` -- the pure field engine (layouts, bricks, ball physics, paddle, power-ups, lasers, stars, regrowth, lives)
  - `js/core/bot.js` -- the paddle bot
  - `js/core/data-worlds.js` -- five fortresses, 30 stages with their layouts, five guardians
  - `js/core/data-story.js` -- the cast, every cinematic and the call-outs
  - `js/core/data-meta.js` -- tech tree, paddles, balls, trails, modes, achievements, quests
  - `js/core/seasons.js` -- festivals by date and their track, mutators, the Daily Challenge recipe
  - `js/core/progress.js` -- profile rules: migration, tree, drop list, XP, stars, unlocking, cosmetics, quests, streak, festival, achievements, scores, payouts
  - `js/core/state.js`, `save.js` (the only module touching localStorage), `audio.js`, `music.js`
  - `js/systems/fx.js` -- pooled particles, texts, rings, shake, flash, hit-stop
  - `js/systems/boss.js` -- guardians: movement, shield ring, damage, shots, specials, rage
  - `js/systems/run.js` -- a session: building any mode or stage, the wall generator, objectives, stars, revives, the fixed-step tick, Boss Rush
  - `js/systems/play.js` -- sessions on screen: starting with cinematics, Continue, events to juice and call-outs, trails, finishing into results, autosave
  - `js/systems/cine.js`, `demo.js`
  - `js/render/view.js`, `art-kit.js`, `sprites.js`, `backdrop.js`, `boss-art.js`, `field-render.js`, `fx-render.js`, `hud.js`, `cine-render.js`, `frame.js`
  - `js/ui/kit.js`, `widgets.js`, `screens.js`, `title.js` (title and modes), `map.js`, `panels.js` (tech tree, collection, journal, results, pause, how to play), `input.js`, `status-bar.js`
  - `js/app.js` -- boot, date context, the loop, menu bar
- `tests/` -- node tests: `harness.js`, `run.test.js` (every brick kind, paddle angles, power-ups, barrier, lives, the bot finishing every stage and guardian, stars, guardian shots and rage, endless walls, timed modes, Boss Rush, mutators, revive, JSON), `scene.test.js` (boot, story, keyboard and mouse play, pause, results, every screen, cinematic, mode and fortress, draw-call budget, no shadowBlur, warm frames paint nothing new), `meta.test.js` (migration, saving, Continue, tree, drop list, cosmetics, quests, streak, festivals, daily, XP, achievements, payouts)

## User Stories

### Play
- [x] As a player, I can steer the paddle with the mouse, a finger or the keyboard and aim by where the ball lands
- [x] As a player, I can break colour, steel, titan, glass, bomb, regrowing, gold and crystal bricks and bounce off walls
- [x] As a player, I can catch twelve power-ups, dodge the bad ones and build combos
- [x] As a player, I can feel every hit through particles, flashes, shakes, words and sounds

### Story
- [x] As a player, I can follow Juno and Bolt through five fortresses with cinematics, a map and dialogue
- [x] As a player, I can play thirty stages of four kinds with three stars each
- [x] As a player, I can fight five guardians with shield rings, shots and special moves that rage at half health
- [x] As a player, I can see a finale and credits

### Modes
- [x] As a player, I can play Arcade, Blitz, Zen, the Daily Challenge and Boss Rush
- [x] As a player, I can play the same Daily Challenge wall as everyone today with two mutators

### Progress
- [x] As a player, I can spend shards on a 25-node tech tree that changes my next game
- [x] As a player, I can collect paddles, balls and trails with gems, stars, levels, achievements, Boss Rush and festivals
- [x] As a player, I can finish daily quests, keep a streak, level up and earn achievements
- [x] As a player, I can join seasonal festivals that change the look and pay out a reward track
- [x] As a player, I can leave at any time and Continue the same game after a reload
- [x] As a player, I can keep my old high scores

### Controls and Window
- [x] As a player, I can resize or maximize the window and the fortress fills it while the paddle follows my pointer
- [x] As a player, I can switch mouse steering off and tune its speed, and switch the music off on its own

## Controls

| Input | Action |
|---|---|
| Mouse / finger | Steer the paddle |
| Left / Right, A / D | Move the paddle |
| Click / tap / Space | Launch the ball, fire lasers |
| Esc / P | Pause |
| Click / any key | Next cinematic line (Esc skips) |
| F2 | Title screen (the game is saved) |

## SEO Keywords

breakout, brick breaker, arkanoid style, free online arcade game, paddle and ball, power-ups, boss fights, story mode, daily challenge, tech tree, paddle skins, seasonal events, »SynthelicZ« game
