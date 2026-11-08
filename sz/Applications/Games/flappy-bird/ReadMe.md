# Flappy Bird

A one-button arcade flyer for the SynthelicZ Desktop, drawn in a landscape
1280 x 720 view: *Flappy Bird and the Season Feathers*. Corvus the Storm Crow
has scattered the six Season Feathers that keep the Sky Tree's seasons
turning, and Sunny flies through six lands -- Sunny Meadow, Dune Canyon, Frost
Peaks, Twilight Woods, Neon City and Ember Volcano -- to bring them home, with
a boss at the end of every land and cinematic scenes between the chapters.
Next to the story wait Classic, Arcade, Zen, Time Attack, a Daily Challenge
and Boss Rush; twelve power-ups, storm crows, a 27-node Nest tech tree, a
wardrobe of birds, hats and trails, seasonal events, daily quests, a day
streak, achievements and an autosave that resumes a run after a reload.

## How It Works

The bird holds a fixed horizontal position at x 360 while the course scrolls
past it. Gravity pulls it down and every flap gives an upward impulse; the
view is letterboxed (the scenery fills the bars at any aspect ratio) and
everything is drawn in logical 1280 x 720 space, with physics normalized to
60 fps. Gates are 72 px wide with capped ends; their openings keep 72 px from
the sky edge and the ground at y 640, never further from the previous opening
than the spacing allows. Later stages narrow the gaps, speed up the scroll,
and add gates that slide or breathe shut.

Coins sit in every gap and in arcs between them; a pass through the middle of
a gap is PERFECT, builds a combo that multiplies coins and fills the FEVER
meter -- full, it pays double for six seconds with a rainbow trail. Each land
adds its hazard (gusts, icicles, bats, sweeping laser scanners, fireballs),
and storm crows warn with a red "!" before they dive at the height the bird
was at. Bubbles between the gates hold twelve power-ups. The fourth stage of
every land ends in a boss arena: the boss hovers at the right, cycles its own
attack patterns and turns faster below half health, while sun orbs drift in --
every orb the bird touches launches a bolt at the boss.

Coins collected in any mode are banked when a run ends and spent in the Nest
(the tech tree, reachable from the title and the pause menu, effective at
once) or the Wardrobe. Seasonal events follow the local date and put tokens
between the pipes that fill an event track of coins, a trail, a hat and a
bird. Daily quests, a weekly challenge, a day-streak bonus and 37 achievements
pay out on the spot. Everything lives in localStorage: the v3 save (migrated
from the v2 save and the original high-score table), and the snapshot of the
run in flight, written every three seconds, on pause, on page hide and on
unload, so Continue on the title resumes exactly where the bird was (or, after
a cleared story stage, starts the next one).

## Architecture

Plain scripts, no build step: every file is an IIFE that fills one slot of the
`SZ.FlappyBird` namespace (or a small `SZ.Flappy*` module), and `index.html`
loads them in dependency order. All mutable game state lives in one long-lived
object, `SZ.FlappyBird.state` (`G`), that the modules read and write in place;
constants and data tables come from `NS.C`, the canvas, drawing kit, effect
systems and sound from `NS.services`.

Pure modules (no DOM, also loaded by the node tests):
- `js/core/course.js` - biomes, the 24 story stages (every fourth a boss stage), endless profiles (endless, Zen, Arcade) and the seeded generation of gates, coins, bubbles, hazards, crows and seasonal tokens, with snapshot / restore of the generator (`SZ.FlappyCourse`).
- `js/core/hazards.js` - icicles, bats, laser scanners, fireballs, gusts and storm crows as pure step / hit functions shared by the game and the test bot (`SZ.FlappyHazards`).
- `js/core/boss.js` - the seeded boss simulation: six bosses, their attack patterns, projectiles, telegraphed zones, sun orbs and bolts (`SZ.FlappyBoss`).
- `js/core/seasons.js` - seasonal events by date, season keys, the event track, the daily twist, daily quests, the weekly challenge and day differences (`SZ.FlappySeasons`).

Art (cached offscreen canvases, drawn with a few blits per frame):
- `js/art/bird-art.js` - fourteen birds with seven painters, squash, stretch and flip (`SZ.FlappyBirdArt`).
- `js/art/cosmetic-art.js` - fourteen hats anchored to the bird's head (`SZ.FlappyCosmeticArt`).
- `js/art/boss-art.js` - the six bosses in two wing frames, their projectiles, sun orbs and the beam / geyser / lightning zones (`SZ.FlappyBossArt`).
- `js/art/season-art.js` - event tokens, rolling ground decor, pipe toppers and the Halloween moon (`SZ.FlappySeasonArt`).
- `js/art/story-art.js` - the dawn and storm skies, the Sky Tree in leaf and in blossom, the glowing Season Feathers (`SZ.FlappyStoryArt`).
- `js/art/scene-kit.js` - scenery sizes, biome themes, gate styles, bubble tints, colour helpers, the seeded RNG and seamless strip painting.
- `js/art/scene-backdrop.js` - sky, far / mid / near silhouette strips, clouds and the ground tile, painted once per biome.
- `js/art/power-icons.js` - the icons of the six newer power-up bubbles.
- `js/art/scene-sprites.js` - gate body and cap per biome, shared icicle, bat, laser emitter, fireball, coin and bubble sprites.
- `js/art/scene-art.js` - `SZ.FlappySceneArt.create(biome)`: builds a biome's caches and returns its cheap draw functions.
- `js/render/flappy-ui.js` - the drawing kit: panels, text that fits its box, chips, meters, headlines and key hints (`SZ.FlappyUI`).

Core:
- `js/systems/particles.js` - a pooled particle system (1200 reusable particles, sprite per shape and colour) (`SZ.FlappyParticles`).
- `js/core/namespace.js` - the `SZ.FlappyBird` namespace, its module slots and the load order.
- `js/core/constants.js` - canvas, physics, bird and course numbers, the twelve power-ups, medals, modes, arcade scoring, the Stage Clear panel, the Nest tree and the state names.
- `js/core/data-cosmetics.js` - the wardrobe catalogue: birds with perks, hats, trails, scenery themes and how each unlocks.
- `js/core/data-goals.js` - the achievements and the lifetime statistics.
- `js/core/data-story.js` - the cast, the Season Feathers, the chapters, the boss taunts and every cinematic as shot lists.
- `js/core/state.js` - `G`, the one mutable state object.
- `js/core/services.js` - canvas and 2D context, the drawing kit, status-bar cells, particles, screen shake, floating text and the rate-limited `sfx`.
- `js/core/save.js` - the Classic table, the v3 save with migration and repair, and the run snapshot in localStorage.
- `js/core/progress.js` - tech-tree levels and purchases, the wardrobe (state, hints, buy / wear), stage unlocks, stars and per-mode bests.
- `js/core/rules.js` - rules derived from upgrades, bird, mode and twist: gravity, hearts, speed, power-up times, radii, coin value, fever gain, crow and wind scales.

Systems:
- `js/systems/goals.js` - stats, daily quests, the weekly challenge, the day streak, the seasonal track, achievements and toasts.
- `js/systems/run.js` - run lifecycle: start, resume from a snapshot, flap, hits (shield, wingmate, ghost, revive), death and the settlement (coins, interest, bests, stars, arcade table).
- `js/systems/powers.js` - granting power-ups, their timers, the Sky Rush autopilot, the Wingmate, Rocket Beak smashing, Gold Rush and FEVER.
- `js/systems/bossfight.js` - starts and steps the boss simulation, turns its events into effects, and settles a defeat (victory cinematic, Boss Rush rounds).
- `js/systems/effects.js` - feathers, biome and seasonal weather, fireworks, coin rings, pipe debris, cosmetic trails and the Stage Clear star reveal.
- `js/systems/cinematics.js` - the cinematic player: shots, typed speech, sound cues, skip.
- `js/systems/autosave.js` - the run snapshot: timed, on pause, on page hide and unload; the Continue label.
- `js/systems/flight.js` - the per-frame update: state dispatch, hit-stop, bird physics, the course clock, Zen ambience, boss arena start, timers and biome changes.
- `js/systems/contact.js` - the bird against the course: gates (score, arcade points and multiplier, PERFECT, CLOSE, Zen chimes), coins, bubbles, tokens and hazards.

Render:
- `js/render/view.js` - canvas sizing and letterboxing (refit whenever the iframe changes size), the visible rect, pointer mapping, the scene cache and `draw()`.
- `js/render/shapes.js` - hearts, stars, locks, the coin chip and the dim backdrop.
- `js/render/effects.js` - drawing of feathers, weather, coin rings, debris and the full-screen flash and fade.
- `js/render/world.js` - the running world with seasonal dressing, gates, hazards, crows, pickups, the boss arena, the bird with hat and squash / stretch, the Wingmate and the screen tints.
- `js/render/hud.js` - score or points, multiplier, combo, fever meter, coins, hearts, tokens, clock, power-up chips, boss bar and entrance card, pause button, banners, READY panel and toasts.
- `js/render/cine-render.js` - draws a cinematic shot: backdrop, actors, effects, letterbox, caption, speech panel with portrait, title card, skip hint.

UI:
- `js/ui/menu.js` - hit areas, the shared keyboard / mouse cursor, buttons, the Back button and the seasonal menu backdrop.
- `js/ui/navigation.js` - screen changes, story entry with chapter scenes, mode starts, Continue, pause, window title and status bar.
- `js/ui/title.js` - the title screen with the hero birds, the main menu and the "today" panel (event, track, streak, twist, quests).
- `js/ui/modes.js` - the mode select cards with their vignettes and bests.
- `js/ui/map.js` - the story world map: six painted lands, the trail of stage nodes, boss crests, feathers and the stage panel.
- `js/ui/nest.js` - the Nest tech-tree screen: tabs, card layout, selection and the Back button.
- `js/ui/aviary.js` - the Wardrobe: Birds, Hats, Trails and Themes tabs, the pedestal preview and the item grid.
- `js/ui/goals-ui.js` - Goals & Stats: quests, achievements, statistics with the arcade top 10, and the season track.
- `js/ui/help.js` - the seven help pages.
- `js/ui/results.js` - pause menu (with Nest and Wardrobe), Game Over and Stage Clear panels.
- `js/ui/input.js` - keyboard, mouse and touch for every screen, cinematic skip, auto-pause, autosave hooks and resize.
- `js/app.js` - the game loop (with a smoothed frame time), menu bar, dialogs, OS integration and start-up.

Tests (`node tests/<name>.test.js`):
- `tests/harness.js` - a fake canvas, DOM and storage, and a loader for the real scripts in `index.html` order.
- `tests/flight-bot.js` - the completability bot: flies the real course, hazard and boss modules with the base bird, checking every decision with rollouts and a depth-first search fallback.
- `tests/completability.test.js` - all 24 story stages (6 boss fights included), 120 pipes of the endless, Zen and Arcade courses and 30 Daily Challenge dates are flown clean.
- `tests/course.test.js` - stage structure, bounds, determinism, snapshot / restore, tokens, ids, bubble kinds, laser gates.
- `tests/save.test.js` - migration from v2 and the old table, repair, round trip, storage failures, autosave and Continue.
- `tests/seasons.test.js` - the event of every boundary day, season keys, days left, track tiers, twists, quests, weeks, day differences.
- `tests/progression.test.js` - tree costs and immediate effects, wardrobe, achievements and unlocks, quests, streaks over real dates, the season track, power-ups, settlement.
- `tests/scenario.test.js` - every mode and land flies, a boss fight and Boss Rush run to the end, every cinematic and screen draws, and the busy-frame draw budget.
- `tests/bird-art.test.js`, `tests/scene-art.test.js`, `tests/flappy-ui.test.js` - sprite caches, blit budgets and the drawing kit.

The page also uses the shared desktop libraries `../../shared/game-effects.js` (screen shake, floating text), `game-audio.js`, `game-autopause.js`, `menu.js` and `dialog.js`.

## User Stories

### Core Flight
- [x] As a player, I can flap with Space, W, Up, Enter, a click or a tap, receiving an upward impulse of -9 px/frame
- [x] As a player, I can see the bird gain 0.48 px/frame of downward speed each frame, capped at 14.4 px/frame
- [x] As a player, I can graze a gate cap and live, because the hitbox is a circle of 14 px radius
- [x] As a player, I can see the bird stretch tall on every flap, settle back and lean into its dive
- [x] As a player, I can hold the flap while falling to glide once the Glide upgrade is learned
- [x] As a player, I can lose a heart to a hit, then get a moment of invulnerability while a heart remains
- [x] As a player, I can watch a short slow-motion death tumble with a camera push-in before the results panel
- [x] As a player, I can pause with Escape, P or the on-screen pause button, and restart with F2

### Story
- [x] As a player, I can watch an intro of the Sky Tree, its six Season Feathers and Corvus the Storm Crow scattering them
- [x] As a player, I can meet the cast: Sunny, Elder Hoot, Pip, Ruby, Jay and Corvus, each with a portrait and voice blips
- [x] As a player, I can play six chapters (The Honey Thief, Sea of Sand, The Frozen Throne, Where the Moths Dance, Iron Wings, Heart of the Storm), each opened by a chapter title and a dialogue scene
- [x] As a player, I can travel a world map of six painted lands with a trail of 24 stage nodes, boss crests and the feathers I have recovered
- [x] As a player, I can fight a boss at the end of every land: Queen Buzzella, Dunejaw, Glacius, Duskmoth, MK-7 Crowbot and Corvus, each entering with a name card and a taunt
- [x] As a player, I can dodge each boss's own attacks: aimed stingers and drones, sand geysers and lobs, ice fans and icicle rain, spore rings and homing spores, laser sweeps and missiles, feather fans, lightning and crow swarms
- [x] As a player, I can strike back by touching sun orbs, each firing a bolt at the boss, and see the boss turn ENRAGED below half health
- [x] As a player, I can enter boss arenas with two extra hearts from the Sky Tree
- [x] As a player, I can watch a victory scene for every recovered feather and a finale where the seasons return and Corvus is offered a branch
- [x] As a player, I can skip any cinematic with any key, click or tap, and rewatch the intro and chapter scenes from the map
- [x] As a player, I can earn three stars per stage: finish, collect 60% of the coins, take no hits

### Modes
- [x] As a player, I can play Classic: the original endless course with medals (Bronze 10, Silver 25, Gold 50, Platinum 100) and a top-5 table
- [x] As a player, I can play Arcade: points for pipes, PERFECTs, coins, close shaves and tokens, a multiplier that rises every five clean pipes up to x8, FEVER doubling, crows, a power-up every four pipes and a top-10 table
- [x] As a player, I can play Zen: wide gaps, translucent soft pipes that only bump me, a slow pastel wash, drifting light motes, a pentatonic chime for every pipe and soft chords, ended from the pause menu
- [x] As a player, I can race a 60-second clock in Time Attack, where every hit costs 3 seconds
- [x] As a player, I can play the Daily Challenge, seeded by the local date, with a daily twist: Feather Fall, Gale Day, Needle's Eye, Gold Fever, Bubble Party, Night Flight, Crow Storm or Turbo
- [x] As a player, I can play Boss Rush against every boss I have beaten, back to back, for the best time

### Power-ups
- [x] As a player, I can pop twelve kinds of bubbles: Shield, Magnet, Slow-Mo, Ghost, Double Coins, Tiny, Rocket Beak (smash through pipes), Sky Rush (untouchable autopilot dash), Extra Heart, Frost Time (moving pipes and hazards freeze), Gold Rush (every pipe showers coins) and Wingmate (a friend grabs coins and, upgraded, takes a hit)
- [x] As a player, I can see active power-ups as chips with countdown rings that blink before they run out
- [x] As a player, I can fill the FEVER meter with PERFECT passes for six seconds of double coins and points

### Hazards & Course
- [x] As a player, I can fly six biomes with their own sky, parallax layers, gate style and weather
- [x] As a player, I can slip past laser scanners that sweep the gap of a roomier gate, gusts, falling icicles, bats and fireballs
- [x] As a player, I can dodge storm crows that caw, flash a warning and dive at the height I was flying
- [x] As a player, I can rely on every story stage, boss fight and Daily course having been flown clean by an automated bot

### Nest Tech Tree
- [x] As a player, I can spend coins in a Nest of 27 upgrades in six branches: Wings, Armor, Magnet, Power, Spirit and Fortune
- [x] As a player, I can open the Nest from the title, the pause menu and the results panel, and see bought upgrades act at once (an extra heart fills up mid-run)
- [x] As a player, I can buy upgrades for the new power-ups (Jet Stream, Hard Beak, Deep Frost, Loyal Wingmate, Mother Lode), crows (Crow Scarer), FEVER (Fever Pitch) and the meta game (Quest Hunter, Homing Instinct, Festive Spirit, Sun Caller, Nest Egg)
- [x] As a player, I can switch branches with Tab or 1-6, move with the arrows and buy with Enter or a click

### Wardrobe & Collection
- [x] As a player, I can choose among 14 birds with perks (Sunny, Ruby, Jay, Pip, Snowy, Phoenix, Goldie, Corvus and six festive seasonal birds)
- [x] As a player, I can wear 14 hats and 12 trails, bought with coins or unlocked by achievements and seasonal events
- [x] As a player, I can preview a look on a pedestal where the bird loops with its trail, and see every locked item's unlock hint
- [x] As a player, I can see my hat in every mode, on the map and in the story scenes
- [x] As a player, I can keep a seasonal event's scenery as a theme all year once I collected ten of its tokens, or let the scenery follow the calendar

### Seasons, Quests & Achievements
- [x] As a player, I can play through six seasonal events by local date: Winter Wonderflap, Year-End Fireworks, Blossom Festival, Summer Splash, Harvest Moon and Spooky Flight
- [x] As a player, I can see each event change the scenery: a colour wash, rolling decor (snowmen, rockets, egg baskets, beach umbrellas, hay bales, jack-o'-lanterns), pipe toppers, its own weather and fireworks
- [x] As a player, I can collect the event's tokens to climb a seven-tier track paying coins, a trail, a hat, a bird and a Season Champion badge
- [x] As a player, I can complete three daily quests and a weekly featured challenge, with a bonus for all three
- [x] As a player, I can earn a growing coin bonus for playing on consecutive days
- [x] As a player, I can earn 37 achievements that pay coins and unlock wardrobe items, announced by toasts
- [x] As a player, I can read lifetime statistics, my bests in every mode and the Arcade top 10

### Visual Effects & Sound
- [x] As a player, I can see pooled particles, feathers, coin rings, shock rings, pipe debris, screen shake, hit-stop and flashes
- [x] As a player, I can see afterimages while the combo is hot, in slow motion, rushing or in FEVER
- [x] As a player, I can see floating score text, a popping score, breathing hearts and stars that pop in on the Stage Clear panel
- [x] As a player, I can hear synthesized sounds for every event, rate-limited so a busy screen never turns into noise, and mute them

### Persistence & Retention
- [x] As a player, I can close the window or reload the page mid-run and press Continue to resume at the same spot, on the same course, with the same power-ups
- [x] As a player, I can press Continue after clearing a story stage to fly straight on to the next one
- [x] As a player, I can keep my old high scores, coins, stars, upgrades and birds from the previous save version
- [x] As a player, I can keep everything in my browser only - no server is involved

### Menus & Controls
- [x] As a player, I can use every screen with the keyboard, the mouse or a touch screen, with Back buttons for touch
- [x] As a player, I can resize or maximize the window and still click exactly what I point at
- [x] As a player, I can read seven help pages from any menu with H

## Controls

| Input | Action |
|---|---|
| Space / W / Up / Enter / Click / Tap | Flap (hold while falling to glide, once learned) |
| Escape / P / pause button | Pause / Resume, back out of a menu, leave a results panel |
| Arrow keys / WASD | Move through menus, the map, the tree and the wardrobe |
| Enter / Space | Select, buy, wear, confirm |
| Tab / 1-6 | Switch tabs and tech-tree branches |
| Any key / click / tap | Skip a cinematic |
| H | Help |
| F2 | Restart the current run |

## Technical Details

- Canvas rendering in a logical 1280 x 720 space, letterboxed with the scenery stretched into the bars, backing store capped near 1.5 pixels per logical pixel, refit whenever the iframe's size changes
- IIFE modules in the `SZ.FlappyBird` namespace and pure `SZ.Flappy*` modules; no build step
- All art in cached offscreen canvases; no shadow blur; pooled particles; culling to the visible course window
- Course, hazards, bosses and seasons are pure, seeded and testable; story and Daily courses are seeded (stage id / date)
- localStorage keys: `sz-flappy-bird-save-v3` (the save), `sz-flappy-bird-run-v1` (the run in flight), `sz-flappy-bird-highscores` (the Classic table); `sz-flappy-bird-save-v2` is read once for migration and left as a backup
- OS integration via SZ.Dlls.User32 (SetWindowText, RegisterWindowProc, DestroyWindow)

## 🎵 Soundtrack

The soundtrack comes from the shared `SZ.GameMusic` engine: a theme per biome (a bright house groove over the meadow, a dusty electro drive across the desert, glassy trance through the frost, a funky bounce in the forest, synthwave over the city, a dubstep rumble at the volcano), a heavier theme for every boss, a menu theme, calm Zen and a fast theme for Time Attack, Boss Rush and the Daily. Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop, breakdown, every pass a little different); every adventure stage plays a song of its own made from its biome's theme, and endless flights change song with the biome. Bosses, combos, fever and the last heart raise the intensity: layers come in and the music pushes into the drop. The theme logic lives in `js/core/music.js`; Game > Music On/Off switches it (shared by every game).
