# Flappy Bird

A one-button arcade flyer for the SynthelicZ Desktop, drawn in a landscape
1280 x 720 view. Flap through gates in six biomes -- Sunny Meadow, Dune
Canyon, Frost Peaks, Twilight Woods, Neon City and Ember Volcano -- across
four modes: Adventure (24 stages in six worlds), Classic, Time Attack and
Daily Run. Gates move and close, each biome brings its own hazard, coins pay
for a fifteen-node Nest tech tree, and six birds with real perks wait in the
Aviary. Hearts, combos and power-ups sit between the bird and the ground.

## How It Works

The bird holds a fixed horizontal position at x 360 while the course scrolls
past it. Gravity pulls it down and every flap gives an upward impulse; the
view is letterboxed and everything is drawn in logical 1280 x 720 space, with
physics normalized to 60 fps. Gates are 72 px wide with capped ends, and
their openings are placed at least 72 px from the sky edge and the ground at
y 640 -- never further from the previous opening than the spacing allows.
Higher stages and deeper Classic tiers make the gap narrower, the scroll
faster and the spacing tighter, and add gates that slide up and down or
breathe shut.

Coins sit in every gap and in arcs between them; a pass through the middle of
a gap is PERFECT and builds a combo that multiplies coin payouts, while a
shave past a pipe pays a CLOSE bonus. Bubbles floating between the gates hand
out shield, magnet, slow-motion, ghost, double-coin and tiny-bird effects.
Each biome adds a hazard: wind gusts, falling icicles, bats, pulsing laser
beams and fireballs from the ground.

A hit costs a heart and grants a short invulnerability; the ground always
costs a heart, and outside Classic and Daily the bird bounces back off it
while a heart is left to spare. Losing the last heart ends the run in a
half-second tumble -- unless a Phoenix Feather brings the bird back once.
Coins collected during a run are banked to the save when it ends, and spent
in the Nest or the Aviary;
Adventure stars unlock the next stage, and clearing certain stages unlocks
birds. Everything -- coins, stars, per-mode bests, upgrades, birds and
lifetime stats -- persists in localStorage.

## User Stories

### Core Flight
- [x] As a user, I can flap with Space or by clicking/tapping the canvas, receiving an upward impulse of -9 px/frame
- [x] As a user, I can see the bird gain 0.48 px/frame of downward speed each frame, capped at a terminal velocity of 14.4 px/frame
- [x] As a user, I can fly in a landscape 1280 x 720 view with the bird fixed at x 360 and the ground at y 640
- [x] As a user, I can graze a gate cap and live, because the hitbox is a circle of 14 px radius rather than the bird's full shape
- [x] As a user, I can see the bird tilt up to -30 degrees on the rise and nose-dive to +90 degrees on the fall
- [x] As a user, I can be clamped at the ceiling without dying, preventing escape above the screen
- [x] As a user, I can see a bobbing bird, a dotted preview of the first flap's arc, a bouncing chevron and a pulsing "TAP!" on the ready screen
- [x] As a user, I can hold the flap key or button while falling to glide once the Glide upgrade is learned, sinking 35% slower with a faint trail under the wings
- [x] As a user, I can lose a heart to any hit, then get 1.2 seconds of invulnerability and an upward kick while a heart remains
- [x] As a user, I can see the ground always cost a heart, and bounce back off it in Adventure and Time Attack whenever a heart is left to spare
- [x] As a user, I can watch a half-second death tumble -- the first 0.45 seconds in slow motion with a slow camera push-in -- before the results panel
- [x] As a user, I can restart the current run at any time with F2 and pause with Escape

### Game Modes
- [x] As a user, I can choose Adventure, Classic, Time Attack or Daily Run from the title screen
- [x] As a user, I can fly an endless, randomly generated course in Classic, with medals and a top-5 high-score table
- [x] As a user, I can race a 60-second clock in Time Attack, where every hit costs 3 seconds instead of a heart
- [x] As a user, I can play the Daily Run, whose course is seeded from today's date so every player gets the same gates, coins and hazards
- [x] As a user, I can see my best score per mode in the status bar, on the ready panel and on the results panel
- [x] As a user, I can see the Daily best reset when the date rolls over to a new seed
- [x] As a user, I can quit a run in progress back to the world map (Adventure) or the title screen with Escape

### Adventure Worlds & Stars
- [x] As a user, I can play 24 Adventure stages arranged as six worlds of four stages each, worth 72 stars in total
- [x] As a user, I can see each world as a card painted with its biome's sky, with a lock and the name of the world to clear first
- [x] As a user, I can unlock the next stage as soon as the previous one holds at least one star
- [x] As a user, I can fly stages of 18 to 40 gates, growing by four per stage and two per world
- [x] As a user, I can feel the campaign ramp: gate gaps narrow from 205 px to 136 px, scroll speed climbs from 2.70 to 4.54 px/frame and spacing tightens from 380 px to 288 px across the 24 stages
- [x] As a user, I can earn up to three stars per stage -- one for finishing, one for collecting at least 60% of the coins, one for a hit-free run
- [x] As a user, I can watch the stars pop in one by one on the Stage Clear panel, each with its own chime, above coin, hit and combo tallies
- [x] As a user, I can go straight to the next stage, replay the current one or return to the world map from the clear panel
- [x] As a user, I can see my progress as a flag-topped meter along the top of the screen during an Adventure stage

### Biomes & Hazards
- [x] As a user, I can fly six biomes: Sunny Meadow, Dune Canyon, Frost Peaks, Twilight Woods, Neon City and Ember Volcano
- [x] As a user, I can see each biome with its own sky gradient, sun, three parallax silhouette layers, clouds, ground texture and gate style (pipes, pillars, ice, logs, neon, basalt)
- [x] As a user, I can see biome weather drift across the screen: leaves, blowing sand, snow, fireflies, rain and rising embers
- [x] As a user, I can see the endless modes change biome every 25 gates, announced by a banner that slides down for 2.5 seconds
- [x] As a user, I can be pushed up or down by a 180 px-wide wind gust in Dune Canyon, and buy Storm Rider to blunt it by 40% per level
- [x] As a user, I can dodge icicles of 70 to 120 px in Frost Peaks, which rattle for 0.35 seconds before dropping and shatter on the ground
- [x] As a user, I can dodge bats in Twilight Woods that fly leftward at 1.4 px/frame while bobbing on a 50 to 90 px sine
- [x] As a user, I can time the pulsing laser beams in Neon City, which burn across the gap for 1.0 to 1.4 seconds and rest for 1.2 to 1.8 seconds
- [x] As a user, I can duck the fireballs of Ember Volcano, launched every 2.2 to 3.0 seconds up to 45-70% of the 640 px playfield
- [x] As a user, I can see at most one hazard between a pair of gates, from the second world onward (up to 65% of pairs) and from the second tier in the endless modes (up to 60%)
- [x] As a user, I can meet gates that slide up and down (up to 60% chance, 2.2 to 3.8 second period) or breathe shut by up to 40 px, never both at once
- [x] As a user, I can pass through hazards unharmed while ghosted -- they keep moving, they just cannot hurt

### Coins & Combos
- [x] As a user, I can collect three coins in every gate gap, plus five-coin arcs between the pairs that carry no bubble or hazard
- [x] As a user, I can pick a coin up within 26 px of the bird
- [x] As a user, I can earn PERFECT by passing within 22% of the gap's centre, which raises the combo counter
- [x] As a user, I can multiply coin payouts x2 at combo 5, x3 at combo 10 and x4 at combo 20, with a banner at each step
- [x] As a user, I can see a hit break the combo, and the Combo Keeper upgrade spend a save instead
- [x] As a user, I can earn a bonus coin for a CLOSE pass -- under 7 px of clearance and no hit inside that gate
- [x] As a user, I can see fractional coin values accumulate, so a Golden Touch bonus is never lost to rounding
- [x] As a user, I can see the coin counter bump, gold rings bloom and the pickup chime climb in pitch on a quick streak of coins
- [x] As a user, I can see the coins earned in a run banked into my total on the results panel

### Power-ups
- [x] As a user, I can pop power-up bubbles that float between the gates, one every 6 gates in Adventure and every 7 in the endless modes
- [x] As a user, I can take a Shield, which eats the next non-ground hit and shows as a ring around the bird
- [x] As a user, I can take a Magnet, which drags coins in from 190 px for 8 seconds
- [x] As a user, I can take Slow-mo, which runs the whole world at 60% speed for 5 seconds behind a purple vignette
- [x] As a user, I can take Ghost, which lets me pass through gates and hazards -- but not the ground -- for 4 seconds
- [x] As a user, I can take Double Coins, which pays every coin twice for 10 seconds
- [x] As a user, I can take Tiny, which shrinks the bird and its hitbox to 65% for 8 seconds
- [x] As a user, I can see active power-ups as bubble chips with a countdown ring in the top-right corner
- [x] As a user, I can see each pickup announced with a name, a colored burst and a matching screen flash

### Nest Tech Tree
- [x] As a user, I can spend banked coins in a Nest tech tree of 15 upgrades across five branches: Wings, Armor, Magnet, Power and Spirit
- [x] As a user, I can buy Light Feathers (3 levels, 150/300/600) to weaken gravity by 4% per level
- [x] As a user, I can buy Glide (800, needs Light Feathers I) to hold the flap while falling and sink 35% slower
- [x] As a user, I can buy Storm Rider (2 levels, 400/900) to be pushed 40% less by wind gusts per level
- [x] As a user, I can buy Extra Heart (2 levels, 500/1500) for one more heart per level
- [x] As a user, I can buy Starting Shield (1200, needs Extra Heart I) to begin every run with a shield
- [x] As a user, I can buy Thick Down (2 levels, 300/700) for 0.4 seconds more safety after a hit per level
- [x] As a user, I can buy Coin Magnet (3 levels, 200/450/900) to pull in coins within 60 px per level
- [x] As a user, I can buy Golden Touch (3 levels, 400/900/1600) for 10% more coins per level
- [x] As a user, I can buy Super Magnet (2 levels, 500/1000) to extend the Magnet power-up's range by 50% per level
- [x] As a user, I can buy Long Lasting (3 levels, 300/650/1200) so power-ups last 20% longer per level
- [x] As a user, I can buy Bubble Luck (2 levels, 600/1300) so bubbles appear 25% more often per level
- [x] As a user, I can buy Starter Kit (2000, needs Long Lasting II and Bubble Luck I) to begin every run with a random power-up
- [x] As a user, I can buy Eagle Eye (3 levels, 250/550/1000) to widen the PERFECT zone by 15% per level
- [x] As a user, I can buy Combo Keeper (2 levels, 700/1500) so an imperfect pass keeps the combo, once per level each run
- [x] As a user, I can buy Phoenix Feather (3000, needs Eagle Eye II) to come back to life once per run
- [x] As a user, I can see each node's level as pips and a roman-numeral counter, its next cost with a coin, and locked nodes name what they require
- [x] As a user, I can switch branches with Tab or keys 1-5, move with the arrow keys and buy with Enter, Space or a click

### Aviary Birds
- [x] As a user, I can choose among six birds in the Aviary, each with its own perk
- [x] As a user, I can fly Sunny, the free balanced all-rounder
- [x] As a user, I can buy Ruby for 400 coins: light, with gravity 6% weaker
- [x] As a user, I can buy Jay for 900 coins: shiny eyes add 50 px of coin magnet
- [x] As a user, I can unlock Pip by clearing stage 2-4: lucky, +15% coins
- [x] As a user, I can unlock Snowy by clearing stage 4-4: tough, +1 heart
- [x] As a user, I can unlock Phoenix by clearing stage 6-4: reborn, revive once per run
- [x] As a user, I can see stage-unlocked birds come free once their stage is cleared, while the others are bought with coins
- [x] As a user, I can preview the selected bird large on a glowing pedestal, with the six birds in a row below showing price, ownership or lock
- [x] As a user, I can see birds gliding across the title screen as decoration, with a large copy of the selected bird among them

### Visual Effects
- [x] As a user, I can see a puff of particles and two loose feathers on every flap, with up to 60 feathers drifting and tumbling on screen
- [x] As a user, I can see gold sparkles at both gap edges and a floating "+1" when a gate is passed
- [x] As a user, I can see a beat of frozen frame, a white flash and a feather burst when a hit lands, and a red flash on death
- [x] As a user, I can see an afterimage trail while the combo is at 10 or higher or the world runs in slow motion
- [x] As a user, I can see the score pop on each pass and the last heart breathe when there were more to lose
- [x] As a user, I can see confetti and hear a fanfare when a new best is set or a stage is cleared
- [x] As a user, I can see the medal -- Bronze, Silver, Gold or Platinum -- with slowly rotating light rays on the Classic and Daily results panel
- [x] As a user, I can see buyable upgrade cards breathe with a pulsing outline and flash white when bought
- [x] As a user, I can see the menus drift over a biome backdrop that cycles through all six every 12 seconds

### Sound
- [x] As a user, I can hear synthesized effects for flapping, gate passes, coins, power-ups, hits, death, victory and defeat
- [x] As a user, I can hear a level-up fanfare every 12 gates passed
- [x] As a user, I can hear the coin chime climb in pitch on a quick streak and the PERFECT blip rise with the combo
- [x] As a user, I can hear hazards: laser hum, icicle drop, fireball launch and gust whoosh
- [x] As a user, I can mute everything with the speaker button in the corner, and the choice is remembered between visits
- [x] As a user, I can hear the same effect at most once per 45 ms, so a busy screen never turns into a wall of noise

### Menus & Controls
- [x] As a user, I can reach Title, World Map, Nest, Aviary and Help screens, plus Ready, Paused, Game Over and Stage Clear panels
- [x] As a user, I can move every menu with the arrow keys or WASD and confirm with Enter or Space
- [x] As a user, I can press Escape to pause a run, back out of a menu or leave a results panel
- [x] As a user, I can open the four-page Help book from any menu with H, and page through it with Left/Right
- [x] As a user, I can pause and choose Resume, Restart or Quit to Menu
- [x] As a user, I can play entirely with the mouse or a finger: click to flap, hold to glide, click cards and buttons
- [x] As a user, I can see the status bar report the score, the best for the current mode and the state (Title, Adventure, Nest, Aviary, Help, Ready, Playing, Paused, Game Over, Stage Clear)

### Persistence and OS Integration
- [x] As a user, I can see coins, stage stars, per-mode bests, tech-tree levels, owned birds, the selected bird and lifetime stats (runs, gates, coins) saved in localStorage under `sz-flappy-bird-save-v2`
- [x] As a user, I can see the Classic top-5 high-score table kept alongside the save, viewable and resettable from the Game menu, with its best migrated into the save
- [x] As a user, I can see the window title follow the game: "Flappy Bird" in the menus, "Flappy Bird -- <mode or stage name>" during a run
- [x] As a user, I can access the Game menu (New Game F2, Pause Esc, High Scores, Exit) and the Help menu (Controls, About)
- [x] As a user, I can see the 1280 x 720 view letterboxed and scaled to the window, with the backing store capped at about 1.5 pixels per logical pixel
- [x] As a user, I can see the run pause itself when the window loses focus or is hidden

## Controls

| Input | Action |
|---|---|
| Space / Click / Tap | Flap (hold while falling to glide, once learned) |
| Escape | Pause / Resume, back out of a menu, quit a results panel |
| Arrow keys / WASD | Move through menus, the tree and the Aviary |
| Enter / Space | Select, buy, confirm |
| Tab or 1-5 | Switch tech-tree branch |
| H | Open / close Help |
| F2 | Restart the current run |

## Technical Details

- Canvas rendering in a logical 1280 x 720 space, letterboxed with devicePixelRatio scaling capped near 1.5 backing pixels per logical pixel
- IIFE pattern with `window.SZ` namespace; no build step required
- Course generation is pure data in `course.js` (seeded, testable); scenery and sprites are prebuilt offscreen canvases in `scene-art.js` and `bird-art.js`
- requestAnimationFrame game loop with delta-time capped at 50 ms and physics normalized to 60 fps via a `dt * 60` step multiplier
- Circular 14 px bird hitbox against the four rectangles of each gate (two columns, two caps)
- Gate openings placed with a 72 px margin from sky and ground, and a bounded jump from the previous opening
- Endless difficulty advances every 12 gates: gap 190 to 122 px, speed 2.70 to 5.40 px/frame, spacing 360 to 252 px, biome every 25 gates
- Daily and Adventure courses are seeded (date hash / stage id), so the same seed always yields the same course
- localStorage keys: `sz-flappy-bird-save-v2` for the save, `sz-flappy-bird-highscores` for the Classic table
- OS integration via SZ.Dlls.User32 (SetWindowText, RegisterWindowProc, DestroyWindow)
