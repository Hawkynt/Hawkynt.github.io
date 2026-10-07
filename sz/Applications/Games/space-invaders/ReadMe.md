# Space Invaders -- Enhanced Edition

Arcade game where the player defends Earth across six sectors of space: a 30-stage campaign with six named bosses, plus Classic, Survival, Boss Rush and Daily modes. Features five ships with unique special abilities, a 16-upgrade armory tech tree bought with run credits, 8 power-up types, six alien species, combo scoring with multipliers up to x5, hand-painted sprites and six painterly sector backdrops. Part of the SynthelicZ Desktop game collection.

## How It Works

Canvas-based game with proper aspect-ratio scaling. All game logic runs in a virtual 1280 x 720 coordinate space that scales to any window size with letterboxing, simulated in fixed 60 Hz steps regardless of display refresh rate; the backdrop and the full-screen overlays reach past that field to the canvas edges, so on any other aspect ratio the bars show space instead of a flat band. Each sector has its own painterly backdrop (moon, Mars, asteroid belt, Jupiter, Saturn, mothership) painted once per theme into a cached 1280 x 720 canvas with a seeded generator, then blitted as one image per frame with scrolling star layers, drifting rocks and shooting stars on top -- a bar is filled by stretching the sky's outermost row or column and the star layers tile across it. Every sprite -- six alien species with two animation frames, five player ships with engine thrust steps, the escort drone, the bonus saucer, six bosses with battle-damaged variants, four bullet kinds and the power-up capsules -- is pre-painted at 2x resolution into cached canvases. The campaign (six sectors of five stages, star rules, credit rewards, seeded daily runs) lives in a pure data module that is unit-tested in node. Aliens spawn in twelve varied formations, march side-to-side, and drop down at edges; power-ups drop from destroyed aliens and UFOs; bosses fight with cycling attack patterns and an enrage phase below half health. Combo scoring rewards rapid kills with score multipliers, and kills charge the ship's special ability.

## Architecture

- **`index.html`** -- Menu bar (Game/Help), canvas, status bar, dialogs (High Scores, Controls & Power-Ups, About)
- **`controller.js`** -- IIFE with the game loop, five play modes, campaign stage flow, wave formations, power-up system, boss AI, combo scoring, ship specials and dash, hangar/armory/campaign-map/help screens, save and high scores, collision detection, game states
- **`campaign.js`** -- Pure campaign data and rules: six sectors, 30 stages with per-stage difficulty, star and unlock rules, credit rewards, seeded RNG and daily seeds (no DOM, unit-tested in node)
- **`sprite-art.js`** -- Pre-painted sprite kit: six alien species (two frames + hit flash), five ships (thrust steps), drone, UFO, six bosses (normal + damaged), player/alien/laser/orb bullets, power-up capsules, explosion flares
- **`backdrop-art.js`** -- Six sector backdrops painted once per theme into cached 1280 x 720 canvases with a seeded rng; scrolling star layers, drifting asteroids, shooting stars; an optional view covers the whole visible canvas
- **`invaders-ui.js`** -- Shared drawing kit: panels, auto-fitting text, chips, keycaps, meters, headlines
- **`styles.css`** -- Game layout and visual styling
- **`tests/`** -- Node-runnable tests for `campaign.js`, `sprite-art.js`, `backdrop-art.js` and `invaders-ui.js`
- **Shared modules** -- `menu.js`, `dialog.js`, `game-effects.js` (particles, screen shake, floating text, confetti), `game-autopause.js`, `game-audio.js` (synthesized sound effects, mute button)

## User Stories

### Game Modes
- [x] As a player, I can choose between Campaign, Classic, Survival, Boss Rush and Daily modes from the title screen so that I can play the style I enjoy
- [x] As a player, I can play Classic mode with progressive levels and a boss fight every 5 levels so that I have structured progression
- [x] As a player, I can play Survival mode with endless waves, no bosses and a 1.5x power-up drop rate so that the action never stops
- [x] As a player, I can play Boss Rush mode with a boss every level and a 2x power-up drop rate so that I face constant epic fights
- [x] As a player, I can play a Daily mode where the whole day shares one seeded random run so that everyone fights the same fleet
- [x] As a player, I can see my best score per mode (and today's Daily score) on the title screen so that I know what to beat

### Campaign
- [x] As a player, I can fight through 30 stages in six sectors -- Lunar Orbit, Mars Front, Asteroid Belt, Jupiter Storm, Saturn Rings and the Mothership -- so that the fight has a journey
- [x] As a player, I can fight the sector's named boss in stage 5 of each sector so that every sector ends in a set-piece battle
- [x] As a player, I can earn up to 3 stars per stage (90 in total): one for clearing, one for losing no life, and one for reaching a x3 combo (or beating the boss within 90 seconds on boss stages) so that there is replay value
- [x] As a player, I can unlock the next stage by taking at least one star on the previous one, and the next sector by starring on the previous sector's boss stage so that progression is explicit
- [x] As a player, I can see the campaign map with all six sectors, per-stage star counts and locked sectors showing which boss to defeat so that I always know where I stand
- [x] As a player, I can replay any unlocked stage to improve its stars so that grinding is optional
- [x] As a player, I can watch difficulty climb stage by stage: march speed +6% and fire rate +5% per stage, and from sector 3 onward a growing share of the bottom row is armored so that the campaign keeps pressing
- [x] As a player, I can earn credits from every cleared stage (score/10 plus a bonus of 50 + 25 per sector + 20 per star) so that playing pays for the Hangar and Armory

### Wave Formations
- [x] As a player, I can face 12 different wave formations (Classic Grid, V-Formation, Diamond Strike, Arrow Assault, Cross Attack, Zigzag, Fortress, Wings, Scatter, Phalanx, Diver Squadron, Shield Wall) so that each level looks and plays differently
- [x] As a player, I can see wave formation names announced on entry so that I know what I'm facing

### Enemies
- [x] As a player, I can face six alien species -- Squid (30 points), Crab (20), Octopus (10), Diver (50), Warden (40) and Armored (60) -- each with its own painted design so that the fleet reads at a glance
- [x] As a player, I can face Diver aliens that leave the formation and swoop at me in sine-wave curves with particle trails (up to 2 at a time) so that I must dodge dynamic threats
- [x] As a player, I can face Warden aliens with a visible energy bubble that absorbs one hit so that I must adapt my strategy
- [x] As a player, I can face Armored aliens that take 2 hits so that the front rows punish sloppy aim
- [x] As a player, I can see a bonus UFO cross the top of the screen every 10-25 seconds with random point values (50-300) and a guaranteed power-up drop so that I have bonus scoring opportunities
- [x] As a player, I can hear a different death cry pitch per species so that kills sound distinct
- [x] As a player, I can experience aliens speeding up as fewer remain (march interval shrinks from 800 ms toward 60 ms) so that each wave builds tension

### Bosses
- [x] As a player, I can face six named bosses -- Crater Warden, Rust Colossus, Rock Hive, Storm Leviathan, Ring Sentinel and The Overmind -- each with its own painted design so that every fight feels unique
- [x] As a player, I can see campaign boss health scale from 30 HP in Lunar Orbit to 140 HP at the Mothership (other modes start at 15 and grow +5 per boss) so that bosses grow tougher
- [x] As a player, I can see a dramatic WARNING entrance with scrolling hazard stripes, klaxons and the boss descending behind a growing shadow so that fights feel epic
- [x] As a player, I can see bosses cycle three attack patterns -- a 5-shot spread fan, an aimed volley and a 7-shot rain -- so that I must keep moving
- [x] As a player, I can see bosses change behavior below half health (enrage: faster movement, attacks every 1.2 s instead of 2 s, an added 8-shot spiral, battle-damaged hull) so that fights escalate
- [x] As a player, I can face escort aliens marching below the boss (up to 3 in later sectors) so that the battlefield stays active
- [x] As a player, I can collect 3 power-up drops and maxHp x 100 points from a defeated boss after a 1.6 s explosion cascade so that boss kills are highly rewarding

### Power-ups
- [x] As a player, I can collect 8 power-up types (Triple Shot, Rapid Fire, Shield, Laser, Slow-Mo, Extra Life, Bomb, Drone) so that gameplay stays fresh
- [x] As a player, I can use the Triple Shot (8 s) for a 3-bullet fan pattern so that I cover more area
- [x] As a player, I can use Rapid Fire (6 s) to cut the shot cooldown from 300 ms to 100 ms and raise my on-screen bullet cap from 2 to 4 so that I output more damage
- [x] As a player, I can use the Shield (5 s) to block the next lethal hit so that I get a second chance
- [x] As a player, I can use the Laser (4 s) for piercing shots through all aliens so that I can cut through formations
- [x] As a player, I can use Slow-Mo (5 s) to reduce alien speed to 40% so that I get breathing room
- [x] As a player, I can use the Bomb to instantly destroy all aliens and divers on screen so that I can clear overwhelming waves
- [x] As a player, I can use the Drone (10 s) that follows me and auto-fires every 0.8 s so that I have extra firepower
- [x] As a player, I can stack power-ups (e.g. Triple Shot + Rapid Fire + Laser simultaneously) and refresh an active one by collecting it again so that pickups are always useful
- [x] As a player, I can see active power-up timers as capsule icons with ring gauges in the top-right HUD so that I know how long each lasts
- [x] As a player, I can see drop chances scale -- 8% from normal aliens, 20% from divers, always from the UFO, 3 from bosses, plus mode and upgrade multipliers -- so that busy runs stay supplied

### Ships & Specials
- [x] As a player, I can fly five ships in the Hangar, each with stat bars for speed, fire rate, damage and hull so that I can pick a playstyle
- [x] As a player, I can fly the Interceptor (balanced, 3 hull, free) whose Overdrive special gives 4 s of triple rapid fire
- [x] As a player, I can buy the Striker (1.25x damage, 1500 credits) whose Railgun special paints an 18 px piercing beam column for 1.2 s
- [x] As a player, I can buy the Guardian (extra hull, 4 total, 2500 credits) whose Barrier special grows a 70 px dome that eats enemy shots for 5 s
- [x] As a player, I can unlock the Phantom (1.25x speed) by clearing stage 3-5; its Phase special makes me untouchable for 3 s while the enemy slows down
- [x] As a player, I can unlock the Titan (1.6x damage heavy gunship) by clearing stage 5-5; its Nova special fires a 380 px shockwave that wipes nearby aliens and hits the boss ten times as hard
- [x] As a player, I can carry special charges earned in the stage before a boss into that boss fight (they stay ready for retries until the boss is beaten); in Classic, Daily and Boss Rush charges always carry on through the run
- [x] As a player, I can charge the special meter (+4 per kill, +1 per boss hit) until it converts to a charge so that specials are earned, not given
- [x] As a player, I can fire the special with E, Shift or right mouse button so that it is always at hand

### Armory
- [x] As a player, I can spend run credits on 16 permanent upgrades across five branches (Weapons, Defense, Engine, Power, Special) in a tech tree with prerequisites so that every run makes my fleet stronger
- [x] As a player, I can buy Rapid Cycler (Weapons, 200/400/800) to fire 15% faster per level
- [x] As a player, I can buy Plasma Rounds (Weapons, 300/700/1400) for +40% damage per level
- [x] As a player, I can buy Accelerators (Weapons, 250/500) so my shots fly 15% faster per level
- [x] As a player, I can buy Twin Cannons (Weapons, 1500, needs Rapid Cycler II) so every shot fires two parallel bolts
- [x] As a player, I can buy Extra Hull (Defense, 600/1500) for +1 life per level
- [x] As a player, I can buy Hardened Bunkers (Defense, 300/700) so bunker blocks take one more hit per level
- [x] As a player, I can buy Deflector (Defense, 1200, needs Extra Hull I) to start every run with a Shield
- [x] As a player, I can buy Thrusters (Engine, 150/300/600) to move 8% faster per level
- [x] As a player, I can buy Dash Jets (Engine, 900, needs Thrusters I) to double-tap left/right into a 140 px dash with 0.3 s of invulnerability
- [x] As a player, I can buy Long Charge (Power, 250/550/1100) so power-ups last 20% longer per level
- [x] As a player, I can buy Salvage Scanner (Power, 400/900) for 25% more power-up drops per level
- [x] As a player, I can buy Tractor Beam (Power, 700, needs Salvage Scanner I) so falling power-ups drift toward me
- [x] As a player, I can buy Capacitors (Special, 300/700/1400) so the special charges 20% faster per level
- [x] As a player, I can buy Amplifier (Special, 600/1300, needs Capacitors I) so the special lasts 30% longer and hits harder per level
- [x] As a player, I can buy Wingman (Special, 1500, needs Capacitors II) to start every run with a drone for 12 s
- [x] As a player, I can buy Twin Charge (Special, 2500, needs Amplifier I + Capacitors III) to store two special charges at once

### Combo System
- [x] As a player, I can build a combo counter by killing aliens within 1.5 seconds of each other so that rapid play is rewarded
- [x] As a player, I can earn score multipliers x1 through x5 -- x2 at 3 chained kills, x3 at 5, x4 at 8, x5 at 12 -- so that skilled play earns more points
- [x] As a player, I can see combo milestone pop-ups at x2, x3, x4 and x5 plus a HUD chip with a draining timer bar so that I feel rewarded for streaks

### Visual Effects
- [x] As a player, I can see six painterly sector backdrops with scrolling star layers, drifting asteroids and shooting stars so that every sector has its own place
- [x] As a player, I can see hand-painted sprites: aliens animate two frames while marching, ships show engine thrust, bosses show battle damage when enraged so that the game looks drawn, not pasted
- [x] As a player, I can see explosion flares, tumbling debris shards and expanding shockwave rings on every kill so that impacts feel dramatic
- [x] As a player, I can see screen shake and a brief hit-stop freeze on heavy impacts, and slow-motion for the first beat after my ship dies so that events feel impactful
- [x] As a player, I can see screen flashes, a light sweep on wave clear and confetti on victories so that milestones read clearly
- [x] As a player, I can see engine trails while moving and bullet trail particles so that motion feels dynamic
- [x] As a player, I can see five energy-crystal bunker walls that darken block by block as they erode so that cover visibly degrades
- [x] As a player, I can see a title screen with a pulsing headline, a slowly marching row of all six species and my own ship at full thrust so that the game feels alive before I start

### Sound
- [x] As a player, I can hear synthesized arcade sound effects for shots, hits, explosions, power-ups, coins and menu clicks so that the game has audio atmosphere
- [x] As a player, I can hear the alien march as a four-pitch thud rhythm so that the fleet has a heartbeat
- [x] As a player, I can hear species-specific death cries, UFO sonar blips and three klaxons during a boss entrance so that the audio carries information
- [x] As a player, I can hear a rising star-pop jingle per earned star on the stage-clear screen plus win and lose fanfares so that outcomes are celebrated
- [x] As a player, I can mute everything with the corner speaker button, remembered across games, so that I can play quietly

### Menus & Controls
- [x] As a player, I can move with arrow keys, A/D or the mouse so that either input feels natural
- [x] As a player, I can fire with Space, Up or mouse click, and fire my ship's special with E, Shift or right click so that combat needs few keys
- [x] As a player, I can double-tap left/right to dash once I own the Dash Jets upgrade so that movement can be upgraded
- [x] As a player, I can pause/resume with P or Esc and press F2 to return to the title screen so that I am never stuck
- [x] As a player, I can navigate every screen (title, campaign map, hangar, armory, help) with cursor keys and Enter or with mouse clicks so that the game is fully playable without a mouse and fully clickable with one
- [x] As a player, I can browse a four-page Help screen (Controls, Power-ups, Enemies, Progress) with live sprite previews so that I can learn the game in place

### Game Management / Persistence
- [x] As a player, I can have my credits, stage stars, owned ships, selected ship, armory levels, per-mode best scores and lifetime stats saved to localStorage so that progress survives reloads
- [x] As a player, I can see arcade runs (Classic, Survival, Boss Rush) land in a top-10 high score list with mode and level/wave, viewable and resettable in a dialog so that I can compare across modes
- [x] As a player, I can have the game auto-pause when the tab is hidden or loses focus so that I never lose a run to an alt-tab
- [x] As a player, I can see a status bar showing score or credits, lives, and level/wave or the current screen so that I always know my state
- [x] As a player, I can see the canvas scale to any window size with proper aspect ratio and letterboxing so that the game looks correct at any size
- [x] As a player, I can play with a fixed 60 Hz simulation regardless of my display refresh rate so that gameplay is identical on every machine

### Planned Features
- [ ] As a player, I can use touch/mobile controls so that the game works on touchscreen devices
- [ ] As a player, I can create custom wave layouts with a wave editor so that I can design my own challenges
- [ ] As a player, I can see an online leaderboard so that I can compete globally
- [ ] As a player, I can earn achievements for milestones so that I have secondary objectives
