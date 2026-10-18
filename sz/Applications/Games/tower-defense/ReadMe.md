# Tower Defense

Pixel-art tower defense for the SynthelicZ Desktop. Hold twenty-four campaign maps across six regions, where the waves never stop, with sixteen tower families that branch into two specializations, research permanent upgrades between battles and call in airstrikes when the line is about to break.

## User Stories

### Campaign & Maps
- [x] As a player, I can play a campaign of 24 maps in six regions of four maps each (Greenvale meadows, Mirewood swamp, Sunscar Desert, Crystal Caverns, Frostreach tundra, Ashen Wastes volcano) so that every map looks and plays differently
- [x] As a player, I can pick a map on a campaign screen that shows a preview, waves, starting gold, lives, difficulty, roads and my best result, with the regions on pages when they do not fit side by side
- [x] As a player, I can earn up to three stars per map (based on the lives I keep) and unlock the next map by winning the previous one
- [x] As a player, I can defend maps with long switchbacks, roads that fork and meet again, two or three entrances that merge, crossing roads, a road that forks to two exits, keeps in the middle of the map, and lakes, bogs, mesas, chasms, frozen lakes and lava rivers that block building
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
- [x] As a player, I can open the research tree from the pause menu, the HUD or Shift+R during a map, buy research and continue the paused map with the new research applied

### Abilities
- [x] As a player, I can call an Airstrike on a spot I choose, freeze every enemy with Deep Freeze and earn double gold with Gold Rush, each with its own cooldown

### Presentation
- [x] As a player, I can see code-drawn pixel art: textured ground, ragged roads, plank boardwalks, crystal-veined flagstones, animated water, bogs with lily pads, chasms and lava, trees, willows, cacti, pines, crystal clusters and dead trees, cave gates and a gatehouse to defend
- [x] As a player, I can see walk cycles, wing beats, hit flashes, health, armor and shield bars, frozen, burning and poisoned enemies, and enemies that burst into pixels when they fall
- [x] As a player, I can see fireball explosions with debris, smoke and scorch marks, jagged chain lightning, heating laser beams, flame jets, poison clouds, muzzle flashes and screen shake on big hits
- [x] As a player, I can watch gold coins fly to the gold counter and read banners when a wave starts or is cleared
- [x] As a player, I can see ambient weather: pollen and butterflies, fireflies and swamp mist, drifting dust, glittering crystals, snowfall, embers and ash, and cloud shadows passing over the map
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

Campaign map: arrow keys choose a map, Enter plays it, PgUp/PgDn, Tab or the mouse wheel switch region pages.

Research screen: mouse wheel or +/- zooms, drag pans, arrow keys select, Enter buys, Tab or 1-5 switch branches, 0 fits the view.

## Saves

The game in progress is stored under `sz-tower-defense-save-v2` (older `-save-v1` games are converted on first load; towers that no longer fit a redesigned map are refunded). Stars, best waves, research, relics and boss trophies live separately under `sz-tower-defense-meta-v1`, so starting a new game never touches them. Maps are stored by their index; maps added later are appended and placed into the campaign by its play order, so older progress and saved games keep pointing at the same maps.

## Architecture

Plain browser scripts without a build step. Every file is one IIFE that adds its part to `SZ.TowerDefense`; `index.html` loads them in dependency order, so a module takes what it needs from modules loaded before it at start-up (`const { CELL } = NS.constants`) and calls modules loaded after it through the namespace (`NS.actions.togglePause()`). State that more than one module reads or writes lives in one long-lived object, `SZ.TowerDefense.state` (`G` in the code), declared in `js/core/state.js` with the owning module named for each group; everything else stays private to its module. Each file starts with a comment naming what it owns and what it reads.

| File | Responsibility |
|------|----------------|
| `js/core/constants.js` | Grid size, tiers, game states, storage keys, wave timing, layout sizes and small pure helpers (clamp, number checks, seeded RNG, colour maths). |
| `js/core/state.js` | The shared state object G: the run in progress plus every field more than one module touches. |
| `js/data/tower-types.js` | The sixteen tower families with tiers and specializations, and the targeting modes. |
| `js/data/enemy-types.js` | Monster and boss definitions. |
| `js/data/maps.js` | Biomes, the 24 campaign maps, their campaign order and regions. |
| `js/core/env.js` | The canvas, status-bar elements, the desktop window hooks and title, and throttled sound helpers. |
| `js/ui/pixel-art.js` | Offscreen canvases, pixelation and the pixel-art HUD icons. |
| `js/render/art-kit.js` | Palettes, noise and pixel primitives for the code-drawn art, glows and shadows. |
| `js/render/layout.js` | Canvas sizing, UI units and the world and UI transforms. |
| `js/ui/text.js` | Fonts and text that is measured, fitted, ellipsized and wrapped into its box. |
| `js/ui/widgets.js` | Panels, meters, chips, key hints, buttons, hit regions, tooltips and the HUD fade. |
| `js/render/effects.js` | Pooled particles, floating text, decals, flying coins, banners, the boss card, transitions and screen shake. |
| `js/world/research.js` | The persistent research tree: nodes, levels, buying and research points. |
| `js/world/boss-rewards.js` | Boss tower unlocks and relics with their icons. |
| `js/world/abilities.js` | Airstrike, deep freeze and gold rush: research nodes, cooldowns and effects. |
| `js/core/progress.js` | High scores and campaign progress (meta): stars, best waves, research, relics. |
| `js/render/terrain.js` | Biome terrain baked once per map, props, gates and animated liquids. |
| `js/render/tower-art.js` | Tower bases, rotating heads, traps and mines, cached per tier and branch, and tower icons for the UI. |
| `js/render/enemy-art.js` | Side-view enemy sprites, their animation frames and enemy icons for the UI. |
| `js/world/paths.js` | Road polylines, blocked cells, air routes and loading a map into a fresh battlefield. |
| `js/world/towers.js` | Tower stats, the tower grid, placement, upgrades, selling, repair and targeting mode. |
| `js/world/waves.js` | Wave generation, starting and calling waves, income, the spawner and the build-phase countdown. |
| `js/world/combat.js` | Damage and slows, the enemy spatial grid and target selection. |
| `js/world/tower-attacks.js` | How every tower family fires, aura buffs and the per-step tower update. |
| `js/world/projectiles.js` | Projectiles, missiles, explosions, poison clouds, burning and icy ground, short-lived beams. |
| `js/world/enemies.js` | Enemy movement, abilities, deaths, leaks and sweeping the dead. |
| `js/world/simulation.js` | Game speeds and the fixed-step battle simulation. |
| `js/world/savegame.js` | The saved game: autosave, serializing, reading, the format-1 migration and continuing a run. |
| `js/render/battlefield.js` | Drawing the map: terrain, depth-sorted towers and enemies, corpses, shots and beams. |
| `js/render/weather.js` | Ambient weather and drifting cloud shadows per biome. |
| `js/ui/research-screen.js` | The zoomable research screen with its camera, cards and keyboard control. |
| `js/ui/ability-bar.js` | Airstrike planes, aiming overlays and the ability buttons. |
| `js/ui/relics-panel.js` | The relics overlay. |
| `js/ui/cinematics.js` | World-map travel, map fly-over intros, outros and reward reveals. |
| `js/ui/hud.js` | Top bar (lives, gold, wave, next wave, speeds), next-level button and boss bar. |
| `js/ui/build-bar.js` | The build bar with one card per tower family. |
| `js/ui/inspector.js` | Stats, targeting, upgrade paths and selling of the selected tower. |
| `js/ui/map-overlays.js` | Placement ghost, keyboard cursor, selection brackets and enemy tooltips. |
| `js/ui/screens.js` | Title, pause and end screens. |
| `js/ui/map-select.js` | The campaign map screen with region pages, thumbnails and details. |
| `js/ui/help.js` | The help pages. |
| `js/app/frame.js` | Composing one frame and the status bar. |
| `js/app/loop.js` | The requestAnimationFrame loop. |
| `js/app/actions.js` | Pause, next level, restart, quit, speed, auto-wave and map clicks. |
| `js/app/input.js` | Mouse, touch and keyboard. |
| `js/app/menu.js` | Menu-bar actions, resizing and desktop window messages. |
| `js/app/main.js` | Start-up: dialogs, menu bar, first layout, loading scores, progress and the saved game, and the first frame. |

## SEO Keywords

tower defense, pixel art, strategy game, browser game, campaign, tech tree, research, tower upgrades, specializations, boss battles, airstrike, canvas game, SynthelicZ Desktop, web application game
