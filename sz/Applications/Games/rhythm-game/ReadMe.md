# Rhythm Game

A four-lane rhythm game for the »SynthelicZ« Desktop: **The Hush**. A silence has swallowed the music of Hush City district by district. Lyra Vale, a street DJ with a drone metronome called Metro, plays it back to life from the Neon Docks to the Crown Spire: thirty songs, five boss duels and cinematics. Every note is charted from the song you hear, because the songs are composed live by the desktop's own music engine. The chart is the music's own kick, snare, bass line and melody, never a pattern laid over a backing track.

Around the story sit Free Play with four difficulties per song, Marathon, the Daily Mix, Zen, Boss Rush, the Weekly Remix and the late-game Remix Tour. Discs from every song buy a 28-node tech tree, boosters and new songs. Crystals buy note skins, highways, hit effects and performers, and Record Crates hold surprises. Festivals, daily quests, a daily shop, play streaks, player levels, Fame and 46 achievements give a reason to come back every day. A song in progress saves itself, so Continue picks up at its last bar.

## How It Works

**Play:** notes fall down four lanes onto the hit line. Press the lane's key (D F J K by default, also the arrow keys and touch) as a note crosses the line. A hit is judged by how far it lies from the note's time: **Perfect** within 45 ms, **Great** within 90 ms, **Good** within 135 ms; anything later, or a note let past, is a **Miss**. The first districts widen these windows by up to a third, so the Docks are forgiving. Presses are timed from the key event's own timestamp, not the next frame, and a global audio offset (set by the calibration tap test) shifts every judgement. Every hit says Early or Late. Score = judgement value × combo multiplier (×1, ×2 from 10, ×3 from 25, ×4 from 50) × Surge.

**Groove:** the meter at the side fills with hits and drains with misses. If it runs empty, the song fails (Zen and the Relaxed switch cannot fail). Below a quarter, the edges glow red and the performer slumps.

**Charts from the music:** `core/chart.js` asks `SZ.GameMusic.compose(song, bar, 0.5)` for every bar of a song (the same pure function the player uses to schedule that bar) and picks the notes a difficulty plays:
- **Easy:** kick and snare on the beat.
- **Normal:** the melody, with drums filling its gaps.
- **Hard:** melody, bass and snare, with chords on the stabs.
- **Expert:** everything worth hitting, down to the arpeggio.

A melody's pitch climbs and falls across the lanes, drums sit in fixed lanes, and long notes become holds. A minimum gap in milliseconds per difficulty keeps fast songs playable, and an anti-jack rule moves repeated notes to a neighbouring lane. The chart and the audio come from the same bars at the same steady intensity, so they always agree.

**Note kinds** (each district teaches one, safely before it tests it):
- **Taps**
- **Holds:** keep the key down to the tail; letting go early breaks it.
- **Chords:** two lanes at once.
- **Hush notes:** dark notes that must *not* be pressed; they cost groove.
- **Drift notes:** they slide to the next lane in the last half of their fall, with an arrow telegraph.

**Power-ups:**
- **Star notes:** golden phrases in the drop. Hitting a whole phrase fills the **Surge** meter by a quarter. Space (or the Surge button) unleashes Surge: double score for eight beats, a brighter highway and the crowd on its feet.
- **Pickup notes:** carry an icon.
  - Shield: the next miss keeps the combo.
  - Heart: groove +25%.
  - Magnet: every window widens by half for eight seconds.
  - Multiplier: +1× for ten seconds.
- **Boosters:** bought in the shop and used before a song.
  - Safety Net: three misses forgiven.
  - Warm-Up: timing windows 25% wider for the first eight bars.
  - Disc Doubler.
  - Lucky Stars: more star phrases.
  - Second Wind: one fail turned into a rescue at 50% groove.
  - Focus: Perfect +10 ms.

**Bosses:** a duel song where the boss's health falls with every hit. Every eight bars it telegraphs an attack for one bar, then strikes:
- **Gristle the Bass Baron, Bass Drop:** notes rush at 1.6× speed.
- **Vesper the Glass Siren, Glass Fog:** the upper highway goes opaque.
- **Anvil-9, Hammerfall:** it hurls Hush notes into the lanes.
- **Madame Undertow, Riptide:** the highway sways.
- **The Hush:** takes turns with all four and adds **Silence**, two bars with the music gone where only the highway keeps time.

Below half health the boss rages and strikes every four bars. Bring its health to zero before the song ends to win; the health is set so about 80% of the notes must land.

**Difficulty, playtested:** every stage names a target - how accurate a regular and a casual player are on it - rising through each district and across the story, with every duel a peak and every district's first song easing off while it teaches its new note kind. `data-worlds.js` calibrates each stage's chart level to its target by letting bot players with human-like hands play it (bisection over the level, a few milliseconds per run), so a fast song and a slow one feel as hard as their place in the story says. `tests/playtest.test.js` plays all thirty stages with four bot players and checks the curve:
- The pro clears everything.
- The regular player clears almost everything.
- The casual player clears the Docks and the Gardens but finds the Spire too hard without upgrades.
- The rookie clears the Docks and the first boss, then needs the tech tree and boosters.
- No stage is a sudden cliff, and notes per second rise from district to district.

## Story

Hush City's music has gone quiet, district by district. Auntie Reverb's pirate station, Radio Afterglow, is the last place still broadcasting. She sends Lyra and Metro out to play every district back to life and find the conductor of the silence.

| District | Style | Teaches | Boss |
|---|---|---|---|
| Neon Docks | house | taps | Gristle the Bass Baron |
| Glass Gardens | synthwave | holds | Vesper the Glass Siren |
| Rust Foundry | electro | chords | Anvil-9 |
| Undertow Club | drum & bass | Hush notes | Madame Undertow |
| Crown Spire | trance | drift notes | The Hush |

Each district has six stages: five songs and a boss duel. Each stage pays up to three stars: clear it, reach grade A, and meet its bonus goal (full combo, every star phrase, no boosters, 90% or 95% accuracy, every hold kept, a combo of a given length, or no Hush note touched; Relaxed mode earns no third star). Cinematics open the story, every district and every duel, close every victory, and end with a finale and a credits roll. The Journal replays them.

**Cast:**
- **Lyra Vale:** a sharp, warm street DJ.
- **Metro:** a drone metronome that counts everything out loud.
- **Auntie Reverb:** a gravel-voiced radio host.
- **The five bosses:** each one a district's sound turned sour.

## Modes

- **Story:** five districts, thirty stages, five bosses.
- **Free Play:** every unlocked song in Easy, Normal, Hard and Expert, with practice speeds of 0.75× and 0.9×. Each song keeps its best score and grade per difficulty, plus a mastery badge (Bronze to Diamond).
- **Marathon:** an endless medley; each song is faster and the groove refills less. Best songs and score are kept.
- **Daily Mix:** one song composed for the local day, with two mutators and your best result.
- **Zen:** calm songs, no fail, no score pressure.
- **Boss Rush:** all five duels back to back (opens after two bosses).
- **Weekly Remix:** a song and mutator that change every week.
- **Remix Tour:** the story again with Remix charts and two mutators per stage, with its own star tier (opens after the finale).

**Mutators:** Mirror, Hidden (notes fade before the line), Sudden (notes appear late), Double Time, Hush Storm, Fragile (groove drains twice as fast), No Surge, Sight Line (a narrower window of the highway). Each one raises the disc payout.

## Progress

- **Currencies:** **discs** come from every song; **crystals** come from stars, levels, achievements, quests and festivals.
- **Tech tree:** 28 nodes in five branches, bought with discs; it opens from the title and from pause.
  - **Timing:** windows, Early/Late help.
  - **Groove:** size, regeneration, a rescue.
  - **Surge:** fill, length, power.
  - **Fortune:** discs, crystals, crate luck.
  - **Stage:** XP, quests, tokens, booster slots.
- **Shop:**
  - Boosters, bought again and again.
  - New songs for Free Play in other styles (funk, chip, dubstep, fm16, epic, ambient).
  - Today's Offers: three cosmetics at a discount, rotating daily with a countdown.
  - **Record Crates:** three items revealed one by one with their rarity (common, rare, epic, legendary). Duplicates turn into discs, and a pity counter guarantees an epic within ten crates.
- **Collection:**
  - Six **performers**, each with a small perk, dancing beside the highway with idle, groove, hit, miss and cheer poses.
  - 15 note skins, 14 highways and 14 hit effects, some exclusive to festivals or to the 100% reward.
- **Goals:**
  - 46 achievements, some hidden.
  - Three daily quests a day and a weekly challenge.
  - A play streak whose gifts grow, with a crate every seventh day.
  - Player levels with a reward each (a crate every fifth).
  - Lifetime statistics.
  - The Journal: cast, districts, bosses, songs and cinematics.
- **Festivals** (from the local date alone): Frostfall, Bloom, Sunfest, Harvest Moon, Hollow Night and Starfall Eve. Each one tints the city, drifts its decor over every screen, adds a festival song to Free Play while it runs, drops tokens in every mode and fills a six-tier track (discs, a note skin, crystals, a hit effect, a highway, a crate). The title shows the days left.
- **Late game:**
  - Remix Tour stars and Marathon records.
  - Song mastery.
  - **Fame:** from player level 30, go on tour. The level resets, and each Fame star adds +10% discs and XP permanently (up to ten), with a badge on the profile.
  - A legendary reward for 100% completion.
- **Coming back:**
  - A welcome-back gift that grows with the days away (capped).
  - The title shows today's quests, the festival, the Daily Mix and the next unlock within reach.
  - Results point out a near miss ("1,240 points from an S").
  - A personal-best bar shows during play whether you are ahead of or behind your best run.

**Persistence:** `save.js` alone touches localStorage. It keeps the profile (versioned and filled with defaults) and a snapshot of the song in progress, written every few seconds, on pause and when the page hides. Continue restarts that song at the bar it reached, with the score, combo and groove it had. The old game's per-song high scores become Free Play records and pay a welcome gift once.

## Rendering

The 1280 × 720 plane is fitted into the window, and the district backdrop fills any extra space. The highway is drawn in perspective: lanes narrow toward the horizon, notes grow as they fall, and the hit line pulses on the beat.

- **Backdrops:** parallax layers per district (skyline, lights, props) with beat-reactive windows, a bobbing crowd and weather.
- **Characters:** the performer and the boss stand at the sides and animate in time.

Notes, receptors, backdrops, portraits, icons and particle shapes are cached sprites. No shadowBlur is used in frames; glows are additive sprite blits. A pooled particle system (sparks, stars, music notes, embers, petals, leaves, snow, confetti, bats, bolts) and expanding rings are budgeted: the busiest frame in the tests (a duel with Surge, low groove, pressed lanes and 800 particles) takes about 1,250 draw calls, under the 2,500 limit.

**Sound:** the songs are the shared `SZ.GameMusic` styles playing their own arrangements. Hits, misses, holds, Surge and pickups have their own sounds through `SZ.GameAudio`. Menus have a theme of their own, and the music switch in the menu turns the menu music off (song audio is part of play, so a song always plays unless the sound is muted).

## Architecture

- `index.html`: menu bar (Game: title, pause, song list, story map, modes, tech tree, shop, collection, journal, settings, menu music, erase, exit; Help), canvas, status bar, Controls and About dialogs, SEO text; loads the modules in order.
- `styles.css`: window chrome.
- `js/`: the game under `SZ.RhythmGame`, one module per concern:
  - `js/core/namespace.js`, `constants.js` (plane, highway, timing windows, scores, keys, palette, storage keys), `rng.js`
  - `js/core/data-songs.js`: the song themes (districts, bosses, shop, festivals, Zen, menu) as `SZ.GameMusic` song descriptions
  - `js/core/chart.js`: charts from composed bars (difficulty selection, lane mapping, holds, chords, Hush and drift notes, star phrases, pickups, boss attacks); pure
  - `js/core/engine.js`: the pure song engine (judging with offsets and windows, combo, multiplier, groove, holds, Hush notes, Surge, pickups, boosters, boss health and attacks, events)
  - `js/core/bot.js`: a player bot with a human-like hand (timing spread, reading speed, lapses, Hush presses, early hold releases, the harm of a duel's attacks), used by the title demo, by the tests and by the stage calibration
  - `js/core/data-worlds.js` (districts, stages, bosses, the difficulty targets and the per-stage calibration), `data-story.js` (cast, cinematics, call-outs), `data-meta.js` (tree, performers, skins, highways, effects, boosters, shop, modes, achievements, quests), `seasons.js` (festivals, mutators, Daily and Weekly recipes)
  - `js/core/progress.js`: profile rules (legacy migration, tree, XP and Fame, stars, mastery, cosmetics, shop, crates with pity, quests, weekly challenge, streak, welcome back, festival, achievements, payouts)
  - `js/core/state.js`, `save.js` (the only module touching localStorage), `audio.js`, `music.js` (song playback in sync, menu themes)
  - `js/systems/fx.js` (pooled particles, texts, rings, shake, flash, beat pulse), `conductor.js` (the song clock from the audio context, with frame time as the fallback), `play.js` (sessions for every mode, input to the engine, juice, results, autosave, Continue), `cine.js`, `demo.js`
  - `js/render/view.js`, `art-kit.js`, `backdrop.js` (district parallax and weather), `highway.js` (perspective lanes, receptors, notes, holds and boss effects), `notes-art.js` (note skins), `actors.js` (performers, bosses, portraits), `hud.js`, `fx-render.js`, `cine-render.js`, `frame.js`
  - `js/ui/kit.js`, `widgets.js`, `screens.js`, `title.js` (title and modes), `map.js` (districts), `library.js` (Free Play and the booster picker), `shop.js` (shop and crate reveal), `panels.js` (tree, collection, journal, results, pause, help), `settings.js` (speed, offset, the calibration tap test, Relaxed), `input.js` (keys, mouse, touch lanes), `status-bar.js`
  - `js/app.js`: boot, date context, the loop, menu bar
- `tests/`: node tests with `harness.js` (fake DOM, canvas, storage and clock):
  - `chart.test.js`: charts match the composed bars, difficulty densities, minimum gaps, holds and chords, anti-jack, determinism, every stage's chart
  - `engine.test.js`: judging, offsets, combo, groove and fail, holds, Hush notes, drift, Surge, pickups, boosters, bosses and attacks, the bot clearing every story stage and boss
  - `meta.test.js`: migration, saving and broken storage, tree, shop, crates and pity, cosmetics, quests, streak, welcome back, festivals, Daily and Weekly, XP, Fame, completion, achievements, payouts
  - `playtest.test.js`: the difficulty curve played by four bot players (pro, regular, casual, rookie) on every stage: targets hit, who clears what, every duel a peak, every district opening easier, no cliffs, notes per second rising (`PRINT=1` prints the table)
  - `scene.test.js`: boot, story, play with key events, pause, results, Retry, Continue after a reload, calibration, a crate, every screen, cinematic, mode, attack, mutator, skin, highway, effect and performer, the draw-call budget, no shadowBlur, warm frames
- `../e2e/rhythm-game.e2e.js`: the browser scenario (see `sz/ReadMe.md`, Game end-to-end tests).

## User Stories

### Play
- [x] As a player, I can hit notes in four lanes with D F J K, the arrow keys, the mouse or touch, judged Perfect, Great, Good or Miss with Early/Late
- [x] As a player, I hear the song the notes are charted from, and the chart always matches it
- [x] As a player, I can hold long notes, hit chords, avoid Hush notes and follow drift notes
- [x] As a player, I can collect star phrases and unleash Surge, and catch shield, heart, magnet and multiplier pickups
- [x] As a player, I can calibrate my audio offset with a tap test and set my scroll speed

### Story
- [x] As a player, I can play thirty songs across five districts, each district teaching one new note kind
- [x] As a player, I can earn three stars per stage
- [x] As a player, I can duel five bosses whose attacks are telegraphed
- [x] As a player, I can watch cinematics for the story, each district and each boss, and replay them

### Modes
- [x] As a player, I can play any unlocked song in Free Play in four difficulties with practice speeds
- [x] As a player, I can play Marathon, the Daily Mix, Zen, Boss Rush, the Weekly Remix and the Remix Tour

### Progress
- [x] As a returning player, my old high scores carry over into Free Play
- [x] As a player, I can buy tech tree upgrades, boosters and songs with discs
- [x] As a player, I can open Record Crates and collect performers, note skins, highways and hit effects
- [x] As a player, I can finish daily quests and the weekly challenge, keep a streak, level up, go on tour for Fame and unlock achievements
- [x] As a player, I can fill seasonal festival tracks and play their festival songs
- [x] As a player, I can continue an unfinished song from the bar it reached

### Controls and Window
- [x] As a player, I can resize or maximize the window and the highway fills it
- [x] As a player, I can switch the menu music off on its own

## Controls

| Input | Action |
|---|---|
| D F J K / ← ↓ ↑ → | Hit lanes 1-4 (hold for long notes) |
| Space | Unleash Surge |
| Mouse / touch | Press a lane on the highway; tap the Surge button |
| Esc / P | Pause |
| R (paused or results) | Retry the song |
| Arrows / Enter | Move through menus and choose |
| F2 | Back to the song list |
| Click / any key | Next cinematic line (Esc skips) |

## SEO Keywords

rhythm game, free online rhythm game, music game, four lane rhythm, note highway, procedural music, story mode, boss duels, daily song, marathon mode, tech tree, seasonal events, »SynthelicZ« game
