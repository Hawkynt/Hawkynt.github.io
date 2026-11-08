# Game Overhaul

The bar every game in `sz/Applications/Games/` has to clear, where each game stands against it, and
the prompt to hand an agent for one game at a time.

The **reference implementations** are the second-wave overhauls (November 2026): **Endless Runner**,
**Snake**, **Pac-Man**, **Asteroids**, **Bomberman**, **Boulder Dash**, **Flappy Bird** and **Cookie
Clicker**. Read one of them (Endless Runner's `ReadMe.md` and `js/` tree are the most complete)
before overhauling another game: module layout, save format, seasons, quests, cinematics and the
test harness are already solved there.

## 📊 Where we stand

Legend: ✅ in place · ◐ partial / thin · ❌ missing · — does not fit the genre.
"Story" = campaign with cast and cinematics; "Seasons" = real-date festivals (not in-game weather);
"Goals" = achievements + daily quests + streak; "Cosmetics" = skins/outfits/trails/themes;
"Modes" = Arcade/Zen/Daily/Boss Rush or genre equivalents.

### Tier A — overhauled to the full bar (polish only)

| Game | Story | Tech tree | Seasons | Goals | Cosmetics | Modes | Autosave | Notes |
|---|---|---|---|---|---|---|---|---|
| Endless Runner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | the reference; in-level camera turns |
| Snake | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Pac-Man | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Asteroids | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Bomberman | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Boulder Dash | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Flappy Bird | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Cookie Clicker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ascension, Sugar Garden, Sanctum Trials, soundtrack |
| Tetris | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | The Spire of Lumen; Master mode; Blast, Pairs, Jewels; Versus CPU; soundtrack |
| Breakout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Prism Run; Duo and Arena co-op with CPU partners; soundtrack |
| Bubble Bobble | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Fizz and the Dry Lagoon; generated rooms; co-op with Pop; soundtrack |
| Minesweeper | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | The Bloomfield Expedition; solver-proven fields; faithful Classic; Versus CPU; soundtrack; browser test |

Remaining for Tier A: late-game prestige / endless scaling exists only in Cookie Clicker. Every
Tier A game now has a soundtrack (see Shared gaps - Music).

### Tier B — first-wave overhaul (October 2026), the "keep coming back" layer is missing

These got campaigns, a tech tree and new art, but stop there: no festivals, no achievements and
quests, mostly no cinematics, little to collect. They need a **top-up**, not a rewrite.

| Game | Story | Tech tree | Seasons | Goals | Cosmetics | Modes | Autosave | Gap to close |
|---|---|---|---|---|---|---|---|---|
| Space Mining | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | colony skins; Hangar (liveries, beams, plumes), festivals and soundtrack done; docking banks and the trip goes on |
| Card Games | ◐ | ❌ | ◐ | ◐ | ✅ | ✅ | ◐ | perk tree, festivals, quests/streak, per-variant mastery |
| Tower Defense | ◐ | ✅ | ❌ | ❌ | ◐ | ◐ | ✅ | festivals, achievements, quests, Daily/Endless, tower skins |
| Dome Keeper | ◐ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | story arc, modes, keepers/dome skins, goals, festivals |
| Space Combat | ❌ | ✅ | ❌ | ❌ | ◐ | ✅ | ◐ | cinematics + cast, goals, festivals, autosave |
| Space Invaders | ❌ | ✅ | ❌ | ❌ | ◐ | ◐ | ❌ | cinematics, goals, festivals, Zen/Daily, autosave |
| Platformer | ❌ | ✅ | ❌ | ❌ | ◐ | ✅ | ◐ | cinematics + cast, goals, festivals |
| Physics Puzzle | ❌ | ✅ | ❌ | ❌ | ◐ | ✅ | ◐ | cinematics, goals, festivals, level-pack collection |
| Fantasy Puzzle | ◐ | ✅ | ❌ | ❌ | ❌ | ✅ | ◐ | cinematics, goals, festivals, mage robes/staves |
| Cooking Game | ◐ | ✅ | ❌ | ❌ | ◐ | ✅ | ◐ | cinematics, goals, festival menus, kitchen themes |
| Space Racing | ❌ | ✅ | ❌ | ❌ | ❌ | ◐ | ❌ | story/rivals, ship liveries, goals, festivals, Daily/Time Trial ghosts |
| Space Farming | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | story/goals, festivals (in-game seasons ≠ events), decor, modes |

### Tier C — never overhauled (small, ~2–3k lines; only module split, sound, touch and digest tests)

Full overhaul needed (Tetris, Breakout, Bubble Bobble and Minesweeper are done, see Tier A). Suggested order:

| # | Game | Today | Overhaul hook |
|---|---|---|---|
| 4 | Rhythm Game | procedural music, combo | song campaign, note skins, lane FX, Daily song, difficulty mastery |
| 6 | Fantasy Cards | deck building, AI | campaign of duels, card collection/rarities, pack openings, card backs |
| 7 | Space Puzzle | gravity shots | solver-verified level worlds, ship skins |
| 8 | Mind Puzzle | shift puzzles | solver-verified worlds, narrative frame |
| 9 | Illusion Puzzle | rotate puzzles | solver-verified worlds, impossible-geometry art |

### Special case

- **Tactical Realms** — a tactical RPG still in active development with its own PRD (seasonal content,
  prestige and skins already planned). Do not apply this prompt; follow its PRD.

### Shared gaps (all tiers)

- **Music** (done, November 2026): `shared/game-music.js` arranges themes in ten styles (house,
  trance, electro, dnb, dubstep, chip, synthwave, funk, epic, ambient) into endless songs - intro,
  groove, build-up, drop, breakdown, every pass changing melody, harmony, form or key - and
  `variant(theme, key)` gives every level a song of its own. Every game except the Rhythm Game
  (whose songs are the gameplay) has a `music.js` with themes per world/mode, a song per level,
  intensity from its own danger cues and Music On/Off in its menu; `e2e/run.js soundtracks` checks
  them all in a browser, `e2e/run.js music` renders every style and saves WAVs to listen to.
- **CPU players**: a game whose bots are proven over the real engine can also seat them as CPU
  rivals or partners - Tetris Versus (step-by-step steering at four strengths), Breakout's partner
  paddles and Bubble Bobble's Pop show the pattern; candidates are the other games with bots.
- **Browser tests**: only Tetris, Breakout, Bubble Bobble, Minesweeper and the start menu have an
  `e2e/<game>.e2e.js` scenario; every game needs one (real clicks and keys, screenshots looked at).
- **Keyboard**: every action game should steer with the arrows and WASD alike (Tetris got WASD in
  November 2026); the desktop now hands the keyboard to a game's window when it opens.
- **Late game**: apart from Cookie Clicker's ascension there is no prestige / endless scaling, so
  players with everything bought have nothing left to chase.
- **Cross-game meta**: none (one profile, one trophy case across all games would be a strong pull).

---

## 🧾 The prompt

Copy everything below the line, replace `{GAME}` with the folder name (e.g. `tetris`) and
`{TIER}` with `A`, `B` or `C` from the table above.

---

```text
Overhaul the game in sz/Applications/Games/{GAME}/ (tier {TIER} in
sz/Applications/Games/overhaul.md) into a game people play for days and come back to for months -
from the first five minutes to the late game, where players with everything unlocked still have
something to chase.

## 0. Read first, do not start from zero

- AGENTS.md (repo root) and the global working agreement: SDD -> BDD -> TDD -> DDD, commit prefixes
  (+ - * # !), signed commits, no AI traces anywhere, ES-compatible with the surrounding code.
- The current game: ReadMe.md, index.html, js/, tests/. Write down what already works and what the
  players already have in their saves - nothing a player earned may be lost.
- The reference overhaul: sz/Applications/Games/endless-runner/ (ReadMe.md describes every module).
  Reuse its proven shapes: namespace + one module per concern (core/ systems/ render/ ui/), the one
  shared state object, save.js as the only localStorage module with migration and run snapshots,
  seasons.js, rules.js, pooled fx.js, cine.js + cine-render.js, the fake-DOM test harness and the
  scene budget tests. Also sz/Applications/shared/game-effects.js, game-audio.js, game-autopause.js,
  touch-controls.js.
- Tier A: polish pass only (sections 3, 5, 7 gaps). Tier B: keep the campaign, tree and art; add what
  the tier-B row says is missing. Tier C: full overhaul of everything below.

## 1. Spec first (SDD)

Rewrite {GAME}/ReadMe.md before code, in the reference layout: one-paragraph pitch, How It Works,
Story, Modes, Progress, Rendering, Architecture (every file with a one-line purpose), User Stories as
"- [ ] As a player, I can ..." (BDD; tick them as they pass), Controls table. Name the cast, the
worlds, the power-ups, the bosses, the festivals - this is the ubiquitous language the code uses.
Keep the original genre and core loop recognisable; it is an original game, never a copy of a
commercial title's names, characters, levels or art.

## 2. Core loop and game feel

- The core verb must feel great on its own: tight input (buffering, coyote time or the genre
  equivalent), hit-stop, squash and stretch, screen shake, slow motion on big moments, combo
  multipliers, near-miss rewards, readable telegraphs for every threat.
- Deterministic, seeded simulation on a fixed step; the same step drives the game, the title demo
  and a solver/bot that the tests use to prove every level, boss and daily seed is beatable.
- Difficulty ramps in introduced steps: each world adds one new mechanic, enemy or hazard, taught
  safely before it is tested.

## 3. Masterpiece presentation

- Graphics: painted, layered, animated art - parallax backdrops per world, weather, day/night or
  ambient light, animated characters with idle/move/hit/celebrate poses, world-specific props,
  boss art with phases. Procedural art is pre-rendered into a sprite cache; no shadowBlur in frames;
  composite static layers offscreen into one blit.
- Effects: pooled particle system (typed arrays, several shapes - sparks, embers, petals, snow,
  stars, smoke, debris, ribbons), shockwave rings, trails, glow sprites, light flashes, floating
  texts, vignette and festival tint; every pickup, hit, kill, combo tier, level clear and unlock has
  its own burst. Rich but budgeted: cap counts, skip off-screen, hold draw calls per frame.
- Animations everywhere in the UI: screen transitions, buttons, counters that roll, stars that land,
  unlock reveals with a chest/pack/card flip, tree nodes that ignite along their links.
- Cinematics: an intro, one per world, one before and after every boss, a finale and a credits roll,
  plus short transformation/unlock cinematics; letterbox, camera moves, typed dialogue with
  portraits, skippable (key completes the line, Escape skips), replayable from a gallery.
- Sound: every action has a sound via shared game-audio; add procedural music (per-world theme,
  boss variant, festival variant, calm Zen variant) that respects the shared sound switch.
- Works in any window size, maximized and on high-DPI with letterbox bleed; touch, mouse and
  keyboard all first-class.

## 4. Content that lasts

- Story: 4-6 worlds with 4-8 stages each and a boss per world, a named cast with personality, up to
  three stars per stage (finish / skill goal / hidden collectible), secrets and hidden stages.
- Modes: Story, Arcade/Endless with high-score table, Zen (no fail, calm), Daily (one seed per local
  day, two mutators, your ghost/best), Weekly Featured mutator, Boss Rush - or the genre's honest
  equivalents (Marathon/Sprint for block games, Trials for puzzles, Time Trial for racing).
- Puzzle games: every level solver-verified by the tests; a hint system; par moves.

## 5. Progression and meta - the reason to come back

- Currencies: a soft currency from every mode, a rare currency for cosmetics; never pay-to-win
  feeling, never a dead end.
- Tech tree: 20-30 nodes in 4-5 branches with visible links, prerequisites and a cost curve; opens
  from the title and from pause, applies immediately.
- Collection: 5+ characters/ships/pieces with small perks, 12+ skins/outfits, 12+ trails/effects,
  themes/boards/backdrops, festival-exclusive items with a rarity tier (common -> epic -> legendary);
  a wardrobe/hangar screen with live animated previews.
- Goals: 30+ achievements (incl. hidden ones and absurd late-game ones), 3 daily quests from a pool,
  weekly challenge, play streak with escalating gifts, XP and player level with a reward per level,
  lifetime statistics, a journal/codex/bestiary that fills as you play.
- Seasons (real local date, no server): Frostfall/winter, Lunar New Year, Valentine's, Bloom/Easter,
  Sunfest/summer, Harvest Moon, Hollow Night/Halloween, Starfall Eve/New Year. Each changes title
  scene, decor, tint and particles, drops festival tokens in every mode and fills a 5-tier reward
  track ending in an exclusive cosmetic; days-left counter on the title.
- Late game: prestige/ascension (reset for a permanent multiplier and a new star tier), endless
  scaling with leaderboards against yourself, mastery levels per world/character, Nightmare/Hard
  replays of the story with new modifiers, ultra-rare chase cosmetics, a 100% completion reward.
- Comeback loop: "welcome back" gift scaled by absence (capped), title card showing today's quests,
  daily seed, festival and the next unlock in reach.

## 6. Persistence

- Everything in localStorage through save.js only: versioned profile with migration from the old
  keys (high scores, coins, settings, tutorial flags carry over), run snapshot every few seconds, on
  pause and on page hide; Continue resumes exactly where the player left off after a reload.
- Corrupt or missing storage never crashes the game (private window, quota, cleared data).

## 7. Tests (TDD) and performance

- node tests under {GAME}/tests/ with the fake-DOM harness: levels/solver, systems, progression
  (tree, cosmetics, XP, achievements, quests, streak, prestige), seasons (every festival by date,
  rollover), save (migration, autosave, Continue mid-action), scene (every screen and every
  cinematic shot draws, draw-call budget under a full particle load, no shadowBlur, cached art).
- A browser scenario `Applications/Games/e2e/{GAME}.e2e.js` (see sz/ReadMe.md, Game end-to-end
  tests): every screen reached through real clicks and keys, a stage, a boss, the results, the
  window at other sizes, canvas-region checks and screenshots - then look at the screenshots.
- Write the failing test first per user story, then make it pass.
- Smooth at 60 fps in a maximized window; note the measured budget in ReadMe's Rendering section.

## 8. Wiring and delivery

- Update index.html (SEO meta, menus: Game, Tech Tree, Collection, Journal, Help, About), the
  manifest entry and the version stamp as previous overhauls did; sz/ReadMe.md game line and
  changelog; sitemap if a page is added.
- `node --check` every touched .js, run all {GAME} tests, open the game in a browser and play
  through intro, a stage, a boss, a cinematic, the tree, the collection and a festival (fake the
  date) before committing.
- Work on a feature branch feature/{GAME}-overhaul; commits grouped by concern with prefix lines
  only; merge into main when green, push, wait for CI and fix until green.

Report at the end: what was added per section, the ticked user stories, test output, and anything
left open as `!` lines.
```
