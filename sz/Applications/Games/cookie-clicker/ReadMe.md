# Cookie Clicker

An idle game for the »SynthelicZ« Desktop. Grandma Rosa hands young Pip her little kitchen and one plain cookie. Click it, buy cursors and grandmas, and watch the treat grow through eight eras: plain cookie, chocolate-chip cookie, frosted sprinkle cookie, cupcake, layer cake, three-tier wedding cake, cosmic galaxy cake and finally a whole bakery planet - each with a transformation cinematic, its own production bonus and milestones. Eighteen producers bake in an animated bakery view, 138 upgrades multiply everything (decorations such as icing, sprinkles, a cherry, candles, gold leaf and starlight glaze show up on the treat), golden treats bring Frenzies and Cookie Storms, a two-page tech tree holds permanent research, and ascension trades the bakery for sugar crystals. From the Cupcake era on, the Sugar Garden behind the kitchen grows seventeen plants that ripen in real time, give bonuses while they stand and breed new kinds - up to a Crystal Rose that drops sugar crystals. After the first ascension, six Sanctum Trials restart the bakery under a hard rule for a permanent production bonus each. Timed and daily Bake-Offs, a quiet Zen Kitchen, seasonal events, daily quests, streaks, a collection of skins and themes and 137 achievements keep you coming back, and a procedural soundtrack follows the eras, the modes and the seasons. All art and music is generated in the browser.

## How It Works

The view is a 1280 x 720 plane fitted into the window; the kitchen wall, the counter and the seasonal particles fill any extra space of a wider or taller window. Pointer positions are mapped back into the plane on every event, so clicks stay exact after resizing or maximizing. The loop runs once per display refresh with a clamped time step; the bakery keeps baking on every screen.

Production is the sum over producers of base rate x count x tier upgrades (x2 each), multiplied by flavour upgrades and decorations, sugar crystals (+1% each), achievements (+1% each, more with milk), the era bonus, tech tree research, the daily streak (+2% per day, up to +20%) and running buffs. A click is worth the click power (mice, decorations, research) plus a share of production, times click buffs and the combo (fast clicks build a combo of up to 50 steps, +2% each). Producers cost 15% more per copy; bulk prices use the geometric sum, and Max buys as many as the bank allows. Golden treats appear every one to three minutes and roll one of seven outcomes: Lucky (15% of the bank, at most 15 minutes of production), Frenzy (x7 production), Click Frenzy (x777 clicks), Building Rush, Sugar Rush (recipe notes), Cookie Storm (falling treats to catch) and Combo Blast. During a season some of them take its shape - snowflake, egg, sun, leaf, pumpkin or present - and drop season tokens.

Each era has a run total to reach (1 thousand up to 1 quintillion) and three milestones. The first time an era is reached the cinematic plays: the old treat trembles in light, bursts, the new one lands on rotating rays, then the cast (Grandma Rosa, Pip, the rival Baron Crumbleton and the Sugar Oracle) comments. Recipe notes come from every half order of magnitude baked in a run, milestones, achievements, quests, golden treats and Bake-Offs; they buy the Test Kitchen page of the tech tree (Ovens, Hands, Fortune, Logistics, Science). After a trillion baked in total, ascension gives sugar crystals (the cube root of lifetime trillions); unspent crystals buy the Sugar Sanctum page (Heritage, Destiny, Ascension). The tree, achievements, collection and statistics survive ascension.

The Bake-Off is a fresh kitchen at twelve-fold speed for three minutes, scored by what it bakes, with a top-ten table; the Daily Bake-Off adds a modifier seeded by the local date (Grandma Gala, Golden Hour, Butterfingers, Wholesale Day, Drumline, Cursor Carnival, Rush Hour). The Zen Kitchen shows any era's treat without numbers or clocks: clicks burst sprinkles and play pentatonic chimes. Seasons follow the local date (winter, spring, summer, autumn, Halloween week, year-end) and change the kitchen's light, decorations, drifting particles and the golden treat; tokens fill a five-step track that unlocks a skin and a click style per season. Three daily quests and the consecutive-day streak reward regular visits.

**Sugar Garden:** opens when the Cupcake era is first reached (with a short cinematic) or for any bakery that has ascended. The plot starts at 3 x 3 and grows by one row and column for every four seeds known, up to 6 x 6. Planting costs a few minutes of production; a plant grows one garden tick per real minute - also while the page is closed, for up to a day - ripens, stays ripe for a while and withers. While ripe it adds its bonus (production, click power, golden-treat frequency or buff duration, combo cap); harvesting it ripe pays treats, recipe notes, a golden-treat effect or, for the Crystal Rose, a sugar crystal, and teaches its seed if it was new. Every tick an empty plot next to two ripe parents of a recipe may sprout their child (Butterwheat + Butterwheat -> Sugar Reed, ..., Golden Gourd + Star Vine -> Crystal Rose, Crystal Rose + Glowcap -> Void Orchid); Crumbweed creeps into empty plots, costs production and is itself a parent. Four soils trade growth speed, bonus strength and mutation chance. The garden lives in the profile and survives ascension.

**Sanctum Trials:** after the first ascension the ascension screen opens six trials - Hands Off (clicks bake nothing), Grandma Strike, Sugar Tax (prices x10), Slow Oven (producers /10, clicks x10), Lights Out (no golden treats) and Lean Kitchen (at most 25 of each producer). Beginning one takes any crystals waiting and starts over under the rule; reaching the trial's era (Layer Cake or Wedding Cake) completes it with a cinematic, keeps the best time, adds +10% production forever and lifts the rule so the bakery carries on. Three and six completed trials unlock the Sanctum Glass and Ascendant Crown skins and the Sugar Sanctum theme. A trial can be abandoned from the pause menu.

**Soundtrack:** the shared `SZ.GameMusic` composes every theme from a short description (tempo, key, scale, chords and layers) - eight era themes from a cosy kitchen tune to a cosmic anthem, a calm Zen Kitchen theme, a driving Bake-Off theme, a garden theme and a tense trial theme. The season colours them (bells in winter and at year end, a spooky scale at Halloween), Frenzies and storms bring the drums and lead in, and new seeds and finished trials play a short stinger. Music has its own switch (menu bar, pause menu) next to the shared sound switch.

**Save codes:** Game > Export Save shows the save as a text code (and copies it); Import Save takes such a code and replaces the current bakery.

All art is painted once into cached canvases: every era's treat per skin and decoration set (420 x 460 px), producer icons, units and scene strips, golden carriers, portraits, particles and the seasonal decor; per frame the game only blits, draws a few shapes and text, and uses no blur filters. Particles, floating texts and rings live in fixed pools. A busy bakery (all eighteen producers, buffs, a Cookie Storm, hundreds of particles, rapid clicking) takes about 2.3 ms of script per frame on average and 5 ms at the 95th percentile.

Progress lives in one versioned save (`sz-cookie-clicker-save`): the profile, the classic run and any Bake-Off in progress, written every five seconds, on pause and when the page hides. Loading fills in defaults for missing fields. Time away is baked at 50% efficiency for up to 8 hours (research raises both) and shown in a welcome-back report. The original game's save (`sz-cookie-clicker`) is converted once: cookies, run and lifetime totals, clicks, buildings, upgrades (mapped to their new tiers, mice and flavours), achievements, heavenly chips (as sugar crystals) and the prestige count carry over, plus welcome recipe notes; the old key is left untouched.

## Architecture

The code lives in `js/` as plain scripts on the `SZ.CookieClicker` namespace, loaded in order by `index.html` (no build step, no modules). All shared game state sits in one object, `SZ.CookieClicker.state` (`G` in every module).

- **`index.html`** -- Menu bar (Game: Title Screen, Pause, Tech Tree, Collection, Journal, Save Now, Exit; Help: How to Play, Controls, About), canvas, status bar, dialogs; loads the modules below in order
- **`styles.css`** -- Window chrome: game frame, canvas, status bar, controls table

Core (`js/core/`):

- **`namespace.js`** -- The `SZ.CookieClicker` namespace with one object per module, so modules can call modules that load after them
- **`constants.js`** -- View plane and layout regions, loop clamps, save and offline windows, cost scaling, combo, golden and Bake-Off timing, UI palette
- **`rng.js`** -- Seeded mulberry32 generators and string hashing
- **`format.js`** -- Short (K, M ... Vg, then scientific) and long ("3.007 billion") number formats, rates, durations, clocks
- **`data-buildings.js`** -- The 18 producers (ids of the original 14 kept), palettes, flavour text, five tier names each
- **`data-treats.js`** -- The eight eras with thresholds, bonuses, milestones and cast lines; the cast; the six decorations; 15 skins, 9 click styles and 5 kitchen themes with their unlock rules
- **`data-upgrades.js`** -- The generated upgrade table (90 tiers, 8 mice, 22 flavours and era recipes, 6 decorations, 4 golden charms, 5 milks, 3 combo tools) and the map from the original upgrade ids
- **`data-tree.js`** -- The tech tree on two pages: eight branches, 32 nodes with 98 levels, costs, prerequisites and stats
- **`data-garden.js`** -- The garden's 17 plants (growth, life, ripe bonus, harvest, rarity, shape), the 15 mutation recipes and the four soils
- **`data-trials.js`** -- The six Sanctum Trials with their rule (run modifiers) and goal era
- **`data-achievements.js`** -- 137 achievements (the original 59 with their ids, plus eras, golden treats, combos, modes, quests, streaks, seasons, tree, crystals, collection, garden and trials)
- **`data-events.js`** -- Golden outcomes, seasonal carriers, the season track, quest templates and Daily Bake-Off modifiers
- **`calendar.js`** -- Pure date rules: day keys and gaps, seasons, the streak, daily quests and the daily modifier
- **`economy.js`** -- Pure rules: fresh profiles and runs, tree levels, costs and stats, upgrade aggregates, production and click formulas, bulk costs, buffs, eras, recipe-note marks, crystals, offline gains, upgrade reveal conditions
- **`state.js`** -- The shared state object: screen, profile, runs, derived stats, season and day, UI bookkeeping, input, hit areas, cinematic, shake
- **`save.js`** -- The versioned save, loading with defaults, the migration of the original save (the only module touching `localStorage`)
- **`audio.js`** -- Sound through the shared `SZ.GameAudio`, rate-limited per name, with a volume scale and calm chimes
- **`music.js`** -- The themes for `SZ.GameMusic` (eight eras, Zen, Bake-Off, garden, trial), their seasonal colouring, the intensity and the theme for the current screen

Systems (`js/systems/`):

- **`fx.js`** -- Pooled particles, floating texts and rings; screen shake, flash and hit-stop
- **`production.js`** -- The per-run tick: baking with buffs, buff timers, combo decay, Ghost Hands, recipe notes, evolving eras, the Bake-Off clock
- **`clicking.js`** -- Treat clicks: value, combo, squash, particles in the chosen style, merged floating numbers, sounds, quest credit
- **`golden.js`** -- Golden treat spawning, seasonal carriers, catching, the seven outcomes and the Cookie Storm drops
- **`purchasing.js`** -- Buy amounts, buying and selling producers, revealed upgrades, buying upgrades
- **`progression.js`** -- Achievements, era evolution, milestones, daily quests and streak, season tokens and track, cosmetic unlocks
- **`prestige.js`** -- Pending crystals, the next crystal, ascension
- **`garden.js`** -- Plot size, unlocking, ripe bonuses, planting, harvesting and pulling, mutations and weeds per tick, catching up on time away, soils
- **`trials.js`** -- Beginning, completing and abandoning a Sanctum Trial
- **`modes.js`** -- Bake-Off and Daily Bake-Off (start, score, reward, give up) and the Zen Kitchen
- **`cinematics.js`** -- Shot lists for the intro, the seven transformations, ascension and the Bake-Off countdown; advancing and skipping

Render (`js/render/`):

- **`view.js`** -- Canvas fitting, letterboxing, backing resolution cap, pointer mapping
- **`art-kit.js`** -- The sprite cache with statistics, colour maths, glow sprites, blits and shape helpers
- **`planet-art.js`** -- The bakery planet: chocolate sea, frosted continents, towns and city lights, weather, the cake-tower capital, cookie and sugar-dust rings
- **`treat-art.js`** -- The other seven treat painters and the decorations fitted to each shape; candle and twinkle anchors
- **`building-art.js`** -- The 18 unit painters, store icons and scene strips
- **`garden-art.js`** -- Soil tiles and every plant in four growth phases
- **`backdrop.js`** -- Kitchen themes, the counter, the season's light, decor and drifting particles, the vignette
- **`scene-render.js`** -- The animated bakery view, one strip per owned producer
- **`fx-render.js`** -- Particle sprites, rings, floating texts, the flash
- **`hud.js`** -- The treat with its live animation, counter, currency and era strip, Bake-Off clock, combo meter, buffs, golden treats
- **`cine-render.js`** -- Portraits, title cards, dialogue panels, the transformation, ascension and countdown
- **`frame.js`** -- One frame: backdrop, screen, panels, cinematic and overlays, with only the top layer clickable

UI (`js/ui/`):

- **`kit.js`** -- Text, panels, bars, locks and the cached vector icons
- **`widgets.js`** -- Hit areas registered while drawing, buttons, keyboard cursor, activation
- **`screens.js`** -- The screen machine, toasts, the offline report and confirmations
- **`store.js`** -- Producers and Upgrades tabs, buy amounts, rows, grid, scrolling and tooltips
- **`title.js`** -- The animated title screen and its menu
- **`tree.js`** -- The tech tree screen
- **`collection.js`** -- Skins, click styles, themes and the era gallery
- **`journal.js`** -- Achievements, quests and milestones, season track, statistics, Bake-Off scores
- **`garden.js`** -- The Sugar Garden screen: the plot, the seed log, details, soils, shovel and Harvest All
- **`pause.js`** -- Pause menu, ascension screen, Sanctum Trials, Bake-Off results, how to play, Zen Kitchen controls
- **`status-bar.js`** -- The window status bar
- **`input.js`** -- Pointer, wheel, drag and keyboard handling per screen
- **`js/app.js`** -- Boot (load or migrate, offline baking and garden growth, day and season), the loop, autosave, menu bar, save codes, full reset

Tests (`tests/`, run with `node tests/<name>.test.js`): `harness.js` (fake canvas, DOM, storage and clock; loads the scripts in page order), `economy.test.js`, `save.test.js` (migration of the original save, round trip, defaults, offline cap, reset), `calendar.test.js`, `progression.test.js` (eras, golden outcomes, seasons, quests, tree, ascension, Bake-Off), `art.test.js` (paint and cache budgets, busy-frame draw budget, no blur), `boot.test.js` (every screen), `garden.test.js` (unlocking, planting, growth over time, bonuses, harvests, mutations, weeds, soils, withering, catch-up, ascension and save, the screen), `trials.test.js` (every trial rule, completion and abandoning, unlocks, the soundtrack and the shared composer, save codes).

## User Stories

### Baking
- [x] As a player, I can click the treat (or press Space) to bake, with squash, crumbs in my chosen style and a growing floating number
- [x] As a player, I can click quickly to build a combo that makes clicks stronger, with a meter and a fanfare every 25 steps
- [x] As a player, I can buy 18 producers from Cursor to Cake Singularity, each with its own art and animated bakery scene
- [x] As a player, I can buy 1, 10, 100 or as many as I can afford, and sell one back with a right-click
- [x] As a player, I can see what each producer bakes, its share and how long it takes to pay back

### The Treat
- [x] As a player, I can watch the treat evolve through eight eras, each with a transformation cinematic and a production bonus
- [x] As a player, I can buy decorations - icing, sprinkles, a cherry, candles, gold leaf, starlight glaze - and see them on the treat
- [x] As a player, I can complete three milestones per era for recipe notes

### Upgrades and Events
- [x] As a player, I can buy 138 upgrades: producer tiers, mice, flavours, era recipes, decorations, golden charms, milks and combo tools
- [x] As a player, I can catch golden treats for Lucky piles, Frenzy, Click Frenzy, Building Rush, Sugar Rush, Cookie Storms and Combo Blasts
- [x] As a player, I can see running buffs with their timers

### Tech Tree and Ascension
- [x] As a player, I can research 32 nodes on two pages from the title, the bakery or the pause menu, taking effect at once
- [x] As a player, I can ascend for sugar crystals that boost production forever and buy the Sugar Sanctum

### Modes
- [x] As a player, I can play a three-minute Bake-Off for a top-ten score and recipe notes
- [x] As a player, I can play the Daily Bake-Off with a modifier that changes every day
- [x] As a player, I can relax in the Zen Kitchen with any era's treat, sprinkles and chimes

### Coming Back
- [x] As a player, I can close the page and continue exactly where I was; the bakery saves every few seconds
- [x] As a player, I can come back to offline baking (capped, shown in a welcome-back report)
- [x] As a player, I can keep my old Cookie Clicker progress, converted into the new game
- [x] As a player, I can do three daily quests and grow a daily streak
- [x] As a player, I can enjoy seasonal events with themed golden treats, tokens and rewards
- [x] As a player, I can collect 15 treat skins, 9 click styles and 5 kitchen themes and replay era transformations
- [x] As a player, I can earn 119 achievements and read my lifetime statistics

### Screens and Controls
- [x] As a player, I can play with mouse, touch (tap, drag to scroll) or keyboard (arrows and Enter in menus)
- [x] As a player, I can resize or maximize the window and clicks stay exact
- [x] As a player, I can skip any cinematic with a key, or step through it by clicking

### Late Game
- [x] As a player, I can tend a Sugar Garden whose plants ripen in real time, give bonuses and breed new kinds when two ripe parents stand side by side
- [x] As a player, I can discover 17 seeds up to a legendary Crystal Rose and Void Orchid, and watch the plot grow to 6 x 6
- [x] As a player, I can choose a soil that trades growth speed, bonus strength and mutation chance
- [x] As a player, I can take on six Sanctum Trials after ascending, each adding +10% production forever and unlocking rare cosmetics
- [x] As a player, I can export and import my save as text

### Sound
- [x] As a player, I can hear a soundtrack that changes with every era, the Bake-Off, the Zen Kitchen, the garden, trials and the season
- [x] As a player, I can switch the music off on its own, and it stays off in every game

## Controls

| Key | Action |
|-----|--------|
| Click / tap the treat, Space, Enter | Bake |
| Click a golden treat | Catch it |
| Click a store row / right-click | Buy / sell one |
| B | Cycle the buy amount |
| Tab | Producers / Upgrades (tree: switch page) |
| Wheel / drag | Scroll the store and the bakery view |
| T / C / J / G | Tech tree / Collection / Journal / Sugar Garden |
| Garden: click / right-click / S | Plant or harvest / pull a plant / shovel |
| B (tree) | Research the selected node |
| Esc / P | Pause, back from panels |
| Arrows + Enter | Navigate menus |
| Click / any key | Next cinematic shot / skip |
| F2 | Title screen |

## SEO Keywords

cookie clicker, idle game, incremental game, clicker game, free online idle game, browser clicker, bakery game, cake clicker, tech tree, prestige, ascension, golden cookie, seasonal events, sugar garden, plant mutations, challenge runs, procedural music, »SynthelicZ« game
