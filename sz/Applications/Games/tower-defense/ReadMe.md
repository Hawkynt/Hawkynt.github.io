# Tower Defense

Pixel-art tower defense for the SynthelicZ Desktop. Hold twelve campaign maps across four biomes, where the waves never stop, with sixteen tower families that branch into two specializations, research permanent upgrades between battles and call in airstrikes when the line is about to break.

## User Stories

### Campaign & Maps
- [x] As a player, I can play a campaign of 12 maps in four biomes (Greenvale meadows, Sunscar Desert, Frostreach tundra, Ashen Wastes volcano) so that every map looks and plays differently
- [x] As a player, I can pick a map on a campaign screen that shows a preview, waves, starting gold, lives, difficulty, roads and my best result
- [x] As a player, I can earn up to three stars per map (based on the lives I keep) and unlock the next map by winning the previous one
- [x] As a player, I can defend maps with two roads, crossing roads, a road that coils into a central keep, lakes, mesas, frozen lakes and lava rivers that block building
- [x] As a player, I clear a map by holding its required waves; the waves never stop, so I can stay to grind gold and research while they grow, or press Next level (L) to move on — further maps pay more gold and research, and my best wave per map is recorded
- [x] As a player, I take research, relics, unlocked towers and a quarter of my gold (up to 500) along to the next map; towers stay behind
- [x] As a player, I watch my banner march across a world map to the next level, get a fly-over of each new map with its first wave and bosses, and a celebration when a map is cleared; every cutscene is skipped by any key, click or tap
- [x] As a player, I can continue an unfinished game from the title screen; the game saves itself automatically, even in the middle of a wave

### Towers
- [x] As a player, I can build sixteen tower families: Archer, Cannon, Frost, Tesla, Flamer, Venom, Laser, Sniper, Spike traps (on the road), Gold Mine, Mortar (long-range artillery), Storm (lightning from the sky), Wind (knocks enemies back), Missile (homing anti-air rockets), Beacon (inspires nearby towers) and Arcane (orbs that ignore armor and burn a share of maximum health)
- [x] As a player, I can upgrade a tower through tiers I-III, choose one of two specializations at tier IV (for example Longbow or Volley, Bombard or Shrapnel, Glacier or Blizzard) and master it at tier V
- [x] As a player, I can see every tower grow with its tier (wooden scaffold, stone, gold trim, family stone, crown) and its head turn towards its target
- [x] As a player, I can set each tower's targeting to First, Last, Strong or Close
- [x] As a player, I can inspect a tower to see damage, range, rate, DPS, kills and its special effects, and compare every upgrade before buying it
- [x] As a player, I can sell a tower for 60% of its cost, or get a full refund for towers built during the current break, and repair towers battered by heavy enemies

### Enemies & Waves
- [x] As a player, I can see the next wave's enemies with counts before I start it, and call a wave early for bonus gold
- [x] As a player, I can face grunts, runners, swarmlings, bats and hornet swarms that fly straight across the map, burrowing beetles, charging rhinos, armored brutes, slimes that split, regenerating ghouls, healing shamans, tower-jamming saboteurs, hexers that break slows, invisible phantoms, shield-casting wardens, wyverns and juggernauts, each with a clear counter, introduced step by step along the campaign
- [x] As a player, I can face crowned elite enemies that hurry their neighbours along
- [x] As a player, I can fight seven bosses introduced with a name card and a health bar: the Warlord (war cry jams towers), Slime King (splits), Lich King (summons), Troll Chieftain (regenerates), Dragon (flies), Sandworm (burrows) and Aegis Colossus (shield phases)

### Boss rewards
- [x] As a player, I win the Wind, Arcane and Storm towers only by defeating the Slime King, Lich King and Dragon, with a reveal moment
- [x] As a player, I collect ten relics from bosses (Fletcher's Quiver, Storm Coil, Merchant's Seal, Frost Heart, Hawk-Eye Lens, Master's Hammer, Hourglass of Ages, Dragon Scale, Ember Core, Starforged Steel) with permanent effects, shown in a relics panel (K); no duplicates until all are found

### Research (persistent)
- [x] As a player, I earn research points for every wave cleared, every map won and every new star
- [x] As a player, I can spend research in a zoomable tree with four branches: Arsenal (unlock towers, drill each family, unlock tier V mastery), Economy (starting gold, kill gold, interest, Gold Mine, salvage), Defense (lives, sturdier self-repairing towers, last stand, field medics, scouts) and Abilities

### Abilities
- [x] As a player, I can call an Airstrike on a spot I choose, freeze every enemy with Deep Freeze and earn double gold with Gold Rush, each with its own cooldown

### Presentation
- [x] As a player, I can see code-drawn pixel art: textured ground, ragged roads, animated water and lava, trees, cacti, pines and dead trees, cave gates and a gatehouse to defend
- [x] As a player, I can see walk cycles, wing beats, hit flashes, health, armor and shield bars, frozen, burning and poisoned enemies, and enemies that burst into pixels when they fall
- [x] As a player, I can see fireball explosions with debris, smoke and scorch marks, jagged chain lightning, heating laser beams, flame jets, poison clouds, muzzle flashes and screen shake on big hits
- [x] As a player, I can watch gold coins fly to the gold counter and read banners when a wave starts or is cleared
- [x] As a player, I can see ambient weather: pollen and butterflies, drifting dust, snowfall, embers and ash, and cloud shadows passing over the map
- [x] As a player, I can play in any window size; the HUD scales and panels fade when enemies or towers are behind them

### Sound
- [x] As a player, I can hear building, upgrades, sales, each tower family firing, impacts, shield breaks, crits, deaths, leaks, wave starts and clears, bosses and abilities, all throttled so a full board stays pleasant
- [x] As a player, I can mute all games with the shared sound button

### Controls
- [x] As a player, I can play with the mouse, with touch (tap to preview a tower, tap again to build) or entirely with the keyboard
- [x] As a player, I can read help pages about the basics, towers, enemies and controls

## Controls

| Input | Action |
|-------|--------|
| Click / tap | Build the chosen tower, select a tower, press buttons |
| Right click / Esc | Cancel building or aiming |
| 1-9, 0, Shift+1-6 | Choose a tower to build |
| Arrow keys / Enter | Move the build cursor / build or select there |
| U / I | Upgrade (at tier III: choose the left or right specialization) |
| T | Cycle targeting (Shift+T backwards) |
| S | Sell the selected tower |
| R | Repair the selected tower |
| Space | Start the next wave |
| N | Call the next wave early |
| F / Shift+F, + / - | Faster / slower (1x, 2x, 3x, 5x, 10x, 20x) |
| A | Auto-wave on/off (next wave one second after a clear) |
| Q / W / E | Airstrike / Deep Freeze / Gold Rush |
| H | Help |
| L | Next level (once the map is cleared) |
| K | Relics |
| Any key / click / tap | Skip a cutscene |
| Esc | Pause menu |
| F2 | New game |

Research screen: mouse wheel or +/- zooms, drag pans, arrow keys select, Enter buys, Tab or 1-5 switch branches, 0 fits the view.

## Saves

The game in progress is stored under `sz-tower-defense-save-v2` (older `-save-v1` games are converted on first load; towers that no longer fit a redesigned map are refunded). Stars, best waves, research, relics and boss trophies live separately under `sz-tower-defense-meta-v1`, so starting a new game never touches them.

## SEO Keywords

tower defense, pixel art, strategy game, browser game, campaign, tech tree, research, tower upgrades, specializations, boss battles, airstrike, canvas game, SynthelicZ Desktop, web application game
