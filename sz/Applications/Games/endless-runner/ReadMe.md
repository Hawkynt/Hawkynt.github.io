# Endless Runner

A fast-paced auto-runner game for the SynthelicZ Desktop. Sprint through procedurally generated obstacle courses across three lanes, dodging barriers by switching lanes, jumping, and sliding. Collect coins and power-ups as the speed ramps up and the visual theme shifts from day through sunset, night, and neon.

## How It Works

The player character runs forward automatically at an ever-increasing speed. The road is divided into three lanes. Obstacles spawn procedurally ahead, always leaving at least one safe lane. The player avoids obstacles by switching lanes, jumping over low barriers, or sliding under high barriers. Coins and power-ups appear along the way. The run ends on collision with an obstacle (unless a shield is active). Distance traveled and coins collected form the score. Speed increases continuously from 8 m/s up to a cap of 24 m/s, and the entire visual theme transitions through four tiers as speed climbs.

## User Stories

### Core Gameplay
- [x] As a player, I can run endlessly through a procedurally generated 3-lane course so that each run is unique
- [x] As a player, I can switch between three lanes with smooth 150ms animated transitions so that lane changes feel responsive
- [x] As a player, I can jump (700ms arc, 130px height) to clear low barriers so that I have vertical avoidance
- [x] As a player, I can slide (500ms duration, 40% height) to pass under high barriers so that I can duck obstacles
- [x] As a player, I can encounter three obstacle types (barrier-low, barrier-high, full-block) so that I must use different avoidance techniques
- [x] As a player, I can always find at least one safe lane when obstacles spawn so that the game is fair
- [x] As a player, I can see a death screen with final score and best distance when my run ends so that I know how I performed

### Coins and Scoring
- [x] As a player, I can collect coins worth 10 points each with sparkle effects and floating "+10" text so that scoring has visual feedback
- [x] As a player, I can earn 1 point per meter of distance traveled so that running farther is rewarded
- [x] As a player, I can have my total coin count persist across sessions via localStorage so that coins accumulate over time
- [x] As a player, I can see distance, coins, speed, and game state in the status bar so that key info is always visible

### Power-Ups
- [x] As a player, I can collect a Magnet power-up that attracts coins within 120px range for 8 seconds so that coin collection is easier
- [x] As a player, I can collect a Shield power-up that absorbs one collision for up to 15 seconds so that I get a safety net
- [x] As a player, I can collect a Score Multiplier power-up that doubles all scoring for 10 seconds so that high-speed sections are more rewarding
- [x] As a player, I can see power-up aura/shimmer visual effects and floating label text when collected so that pickups are noticeable

### Speed Progression and Visual Tiers
- [x] As a player, I can experience speed acceleration from 8 m/s to a maximum of 24 m/s so that the game becomes progressively faster
- [x] As a player, I can see the visual theme transition through four tiers (Day, Sunset, Night, Neon) as speed increases so that the environment evolves with difficulty
- [x] As a player, I can see speed-line effects at velocities above 12 m/s that intensify with speed so that high speed feels exhilarating

### Visual Effects
- [x] As a player, I can see screen shake on death with a red particle burst so that death feels impactful
- [x] As a player, I can see obstacle warning glow when approaching so that threats are telegraphed
- [x] As a player, I can see dust puffs from the running character so that the character feels grounded
- [x] As a player, I can see a parallax-scrolling road with lane markings and a skyline that shifts with the speed tier so that the world has depth

### Tutorial and Persistence
- [x] As a player, I can see a 2-page tutorial overlay on first play explaining controls and tips so that I learn the game quickly
- [x] As a player, I can press H at any time to re-open the tutorial overlay so that I can review instructions
- [x] As a player, I can navigate tutorial pages with arrow keys or Space/Enter so that navigation is flexible
- [x] As a player, I can have my top 5 high scores (distance + coins) persist via localStorage so that my best runs are tracked
- [x] As a player, I can view high scores, controls info, and about dialogs from the menu bar so that game info is accessible

### Input Methods
- [x] As a player, I can click/tap a different lane to switch to it, or click the current lane to jump so that mouse/touch input works
- [x] As a player, I can use touch controls (left third = lane left, right third = lane right, center = jump) so that the game works on touch devices

### OS Integration
- [x] As a player, I can access Game menu (New Game F2, Pause Esc, High Scores, Exit) and Help menu (How to Play, Controls, About) so that standard management is accessible
- [x] As a player, I can pause/resume with Escape and restart with F2 so that game flow is controllable
- [x] As a player, I can see dialog windows for high scores, controls, and about information so that detailed info is available
- [x] As a player, I can have the game respond to window resize events so that the display adapts to window changes

## Controls

| Input | Action |
|---|---|
| Arrow Left / A | Switch one lane to the left |
| Arrow Right / D | Switch one lane to the right |
| Arrow Up / W / Space | Jump |
| Arrow Down / S | Slide |
| H | Toggle tutorial overlay |
| Escape | Pause / Resume |
| F2 | New Game |
| Click/Tap left third | Switch lane left |
| Click/Tap right third | Switch lane right |
| Click/Tap center | Jump |
| Click different lane | Switch to that lane |
| Click current lane | Jump |

## Technical Details

- Canvas-based rendering at 400x600 logical pixels with devicePixelRatio scaling
- IIFE pattern with `window.SZ` namespace; no build step required
- requestAnimationFrame game loop with delta-time capped at 50ms
- Shared effects library: ParticleSystem, ScreenShake, FloatingText
- OS integration via SZ.Dlls.User32 (SetWindowText, RegisterWindowProc)
- localStorage persistence with `sz-endless-runner-` key prefix
- Pointer events for unified mouse/touch input
- Menu bar and dialog system via shared SZ.MenuBar and SZ.Dialog modules

### Planned Features
- [ ] As a player, I can hear sound effects for coin collection, obstacle hits, and speed tier transitions so that the game has audio feedback
- [ ] As a player, I can unlock cosmetic character skins or trails with accumulated coins so that coins have a spend mechanic
- [ ] As a player, I can encounter designed set-piece obstacle patterns alongside random ones so that some sections feel hand-crafted
- [ ] As a player, I can swipe down on touch devices to slide so that mobile controls are fully supported
- [ ] As a player, I can see milestone distance markers with special visual effects so that reaching distance goals feels celebratory

## Known Limitations

- No audio or sound effects
- No unlockable characters or cosmetic upgrades
- Coin total accumulates but has no spend mechanic
- Obstacle patterns are purely random within safety constraints; no designed set-pieces
- Touch slide gesture is not supported; slide requires keyboard input
