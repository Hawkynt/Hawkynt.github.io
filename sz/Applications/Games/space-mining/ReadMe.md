# Space Mining

A space mining and economy game for the SynthelicZ Desktop. Pilot your mining rig through asteroid fields, drill for precious ores, sell resources at the station, and upgrade your equipment.

## User Stories

### Ship Controls
- [x] As a player, I can fly my mining rig using WASD/Arrow keys with thrust-based rotation and movement so that I have physics-based flight
- [x] As a player, I can use mouse-only controls by clicking and holding to fly toward the cursor so that I can play the entire game without a keyboard
- [x] As a player, I can see thruster trail particles when accelerating so that speed is visually communicated
- [x] As a player, I can see my ship clamped to world bounds so that I stay within the asteroid field

### Mining
- [x] As a player, I can hold Space near an asteroid to drill and extract ore with particle spray effects so that mining feels tactile and satisfying
- [x] As a player, I can click and hold on an asteroid with the mouse to fly there and drill automatically so that mining works with mouse controls
- [x] As a player, I can mine 4 ore types (Iron, Gold, Platinum, Crystal) each with distinct glow colors and values so that I can target valuable resources
- [x] As a player, I can see asteroid ore glow spots that indicate remaining resources so that I know how much is left
- [x] As a player, I can see depleted asteroids break apart with debris particles and screen shake so that depletion feels dramatic
- [x] As a player, I can see depleted asteroids respawn far from the player so that resources regenerate

### Cargo & Economy
- [x] As a player, I can see my cargo fill up with a limited capacity so that I must return to sell regularly
- [x] As a player, I can return to the central station and press E or click to sell ore for credits so that I earn income
- [x] As a player, I can experience dynamic market prices that fluctuate after each sale so that selling strategy matters
- [x] As a player, I can see floating profit text when selling so that I get immediate income feedback
- [x] As a player, I can see a HUD with cargo bar, credits counter, and hull health so that I always know my status

### Upgrades
- [x] As a player, I can purchase 5 upgrade types at the station shop (Drill Speed, Cargo Size, Engine Power, Hull Armor, Scanner) so that I can improve my equipment
- [x] As a player, I can see upgrade levels as visual pips and cost escalation so that progression is clear
- [x] As a player, I can navigate the shop with keyboard (1-5 keys, arrow keys, Enter) or mouse clicks so that purchasing is flexible
- [x] As a player, I can see the scanner upgrade reveal ore type labels and remaining percentage near asteroids so that I can target the best resources
- [x] As a player, I can upgrade hull armor so that I can survive longer

### Power-ups
- [x] As a player, I can collect 5 power-up types (Shield Boost, Speed Boost, Ore Magnet, Bonus Ore, Repair Kit) that spawn periodically so that I get helpful bonuses
- [x] As a player, I can see power-ups with colored glow, icon letters, bob animation, and fade before expiry so that they are visually distinct
- [x] As a player, I can see active power-up timers with duration bars in the HUD so that I know how long effects last
- [x] As a player, I can see the Ore Magnet pull nearby power-ups toward my ship so that collection is easier

### World & Atmosphere
- [x] As a player, I can fly through a large 3000x3000 scrolling world with the camera following my ship so that the field feels expansive
- [x] As a player, I can see a 3-layer parallax starfield with twinkling stars and colored halos so that depth is conveyed
- [x] As a player, I can see nebula patches that drift slowly in the background so that the space environment feels rich
- [x] As a player, I can see decorative background asteroids drifting with parallax so that the field feels populated
- [x] As a player, I can see shooting stars streaking across the view periodically so that the atmosphere is dynamic
- [x] As a player, I can see a minimap showing asteroids, power-ups, station, ship, and viewport so that I can navigate effectively

### Game Management
- [x] As a player, I can see a 4-page tutorial on first play explaining controls, mining, selling, upgrades, and power-ups so that I learn the game quickly
- [x] As a player, I can toggle the tutorial with H key so that I can review it anytime
- [x] As a player, I can see contextual hints near asteroids and the station so that I get guidance when needed
- [x] As a player, I can have high scores persisted to localStorage tracking credits and ore mined so that I can measure my performance
- [x] As a player, I can pause/resume with Escape so that I can take breaks
- [x] As a player, I can start a new game with F2 so that I can restart anytime
- [x] As a player, I can see the window title update with my current credits so that I can track progress at a glance

### Integration
- [x] As a player, I can see a menu bar with Game (New, Pause, High Scores, Exit) and Help (How to Play, Controls, About) so that all actions are discoverable
- [x] As a player, I can use dialog windows for high scores, controls, and about info so that information is organized

### Planned Features
- [ ] As a player, I can hear sound effects for drilling, selling, and collecting power-ups so that the game has audio feedback
- [ ] As a player, I can encounter space pirates that attack my ship so that mining has combat risks
- [ ] As a player, I can hire NPC miners to automate ore collection so that I can scale my operation
- [ ] As a player, I can discover rare asteroids with exceptional ore yields so that exploration is rewarding
- [ ] As a player, I can trade between multiple space stations with different prices so that the economy has more depth

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Fly mining rig (thrust + rotate) |
| Mouse click + hold | Fly toward cursor / Drill asteroid when near |
| Space | Activate drill (when near asteroid) |
| E | Sell cargo / Open shop (when at station) |
| 1-5 | Quick-buy upgrade in shop |
| Escape | Pause / Resume |
| F2 | New Game |
| H | Toggle tutorial overlay |

## SEO Keywords

space mining game, asteroid mining browser game, free online mining game, ore extraction game, space economy game, browser mining simulator, SynthelicZ game, web-based space game, asteroid drilling game, resource management space game
