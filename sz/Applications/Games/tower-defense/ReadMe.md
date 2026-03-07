# Tower Defense

Path-based tower defense game for the SynthelicZ Desktop. Place towers along enemy paths, upgrade them through 3 tiers, and defend your base against escalating waves of enemies across 12 unique maps.

## User Stories

### Tower Placement & Types
- [x] As a player, I can place 13 tower types (Arrow, Cannon, Frost, Lightning, Laser, Poison, Tesla, Mortar, Flame, Ice, Fire, Chain Lightning, Sniper, Spikes) so that I have diverse strategic options
- [x] As a player, I can select tower types with number keys (1-9+) or by clicking the bottom palette so that placement is quick
- [x] As a player, I can see each tower's cost, damage, range, fire rate, and special ability before placing so that I can make informed decisions
- [x] As a player, I can place Cannon and Mortar towers for splash damage so that I can handle groups of enemies
- [x] As a player, I can place Frost and Ice towers that slow or freeze enemies so that I can control enemy speed
- [x] As a player, I can place Lightning, Tesla, and Chain Lightning towers that chain between enemies so that clustered enemies are punished
- [x] As a player, I can place Poison and Fire towers for damage-over-time effects so that enemies take sustained damage
- [x] As a player, I can place Sniper towers for long-range high-damage single-target shots so that I can pick off tough enemies
- [x] As a player, I can place Spike traps on the path as ground traps so that enemies take damage while walking
- [x] As a player, I can place Flame towers for short-range continuous area damage with burn effect so that chokepoints are covered

### Upgrades & Economy
- [x] As a player, I can upgrade each tower through 3 tiers with increasing damage (1.4x/1.8x/2.4x) and range (1.1x/1.2x/1.35x) so that towers grow stronger
- [x] As a player, I can press U to upgrade a selected tower so that upgrading is quick
- [x] As a player, I can sell towers with S for a partial refund so that I can reconfigure my defense
- [x] As a player, I can earn gold from killing enemies so that I can fund my tower purchases
- [x] As a player, I can see construction sparkle effects when placing towers and upgrade sparkle effects when upgrading so that building feels satisfying

### Enemies
- [x] As a player, I can face 8 enemy types (Normal, Fast, Armored, Flying, Boss, Healer, Swarm, Shield) so that each wave requires different strategies
- [x] As a player, I can face Healer enemies that regenerate HP of nearby enemies so that I must prioritize targets
- [x] As a player, I can face Swarm enemies that spawn in groups of low-HP units so that I need area damage
- [x] As a player, I can face Shield enemies that project a damage-absorbing shield for nearby enemies so that I must break formations
- [x] As a player, I can face Boss enemies every 5 waves with very high HP so that I have periodic tough challenges

### Waves & Progression
- [x] As a player, I can face escalating waves with increasing enemy count and scaling HP so that difficulty builds gradually
- [x] As a player, I can see pre-wave warnings with animated countdown and path visualization so that I can prepare for incoming enemies
- [x] As a player, I can toggle auto-wave mode to automatically send the next wave so that I don't need to click between waves
- [x] As a player, I can toggle fast-forward (1x/2x/3x game speed) with Space so that I can speed up slow waves
- [x] As a player, I can see the path highlighted showing where enemies will walk so that I know where to place towers

### Maps
- [x] As a player, I can play on 12 maps (Serpentine, Crossroads, Spiral, Zigzag, Diamond, Fortress, Canyon, Labyrinth, Twin Paths, Gauntlet, Wasteland, Final Stand) so that each game feels different
- [x] As a player, I can see each map has different starting gold, lives, and total waves so that maps have varying difficulty

### Visual Effects
- [x] As a player, I can see projectile glow trails so that shots look visually impressive
- [x] As a player, I can see enemy-death burst particles so that kills feel satisfying
- [x] As a player, I can see boss-kill screen shake so that defeating bosses feels impactful
- [x] As a player, I can see floating gold text when earning bounties so that I get immediate income feedback
- [x] As a player, I can see smooth enemy path-following animations so that movement looks fluid

### Game Management
- [x] As a player, I can use mouse-only controls for all actions (placing, selecting, upgrading, selling towers) so that no keyboard is required
- [x] As a player, I can have high scores saved to localStorage so that I can track my best performances
- [x] As a player, I can pause/resume with Escape so that I can take breaks
- [x] As a player, I can start a new game with F2 so that I can restart anytime
- [x] As a player, I can see a status bar showing wave number, gold, and lives so that I always know my state

### Integration
- [x] As a player, I can see a menu bar with Game (New, Pause, High Scores, Exit) and Help (Controls, About) so that all actions are discoverable
- [x] As a player, I can use dialog windows for high scores, controls, and about info so that information is organized
- [x] As a player, I can see the window title update with game state so that progress is visible in the taskbar

### Planned Features
- [ ] As a player, I can hear sound effects for tower firing, enemy deaths, and wave starts so that the game has audio feedback
- [ ] As a player, I can create custom maps with a map editor so that I can design my own levels
- [ ] As a player, I can play an endless mode that continues beyond the map's wave count so that I can test my limits
- [ ] As a player, I can see tower synergy bonuses when placing complementary towers near each other so that placement strategy has more depth
- [ ] As a player, I can face environmental hazards on certain maps (lava pools, ice patches) so that terrain adds another strategic layer

## Controls

| Input | Action |
|-------|--------|
| Mouse Click | Place tower / Select tower |
| 1-9+ | Select tower type |
| U | Upgrade selected tower |
| S | Sell selected tower |
| Space | Start wave / Fast-forward (1x/2x/3x) |
| F2 | New game / Restart |
| Escape | Pause / Resume |

## SEO Keywords

tower defense, strategy game, browser game, path defense, tower upgrade, enemy waves, boss battles, projectile glow, splash damage, frost tower, lightning tower, laser tower, canvas game, SynthelicZ Desktop, web application game
