# Space Puzzle

A gravity-manipulation puzzle game set in deep space. Launch a probe through gravity wells, around asteroid fields, and into repair goals to fix your stranded spacecraft. Each level introduces new challenges with increasing complexity -- more gravity wells, denser asteroid fields, and tighter solutions.

## User Stories

### Core Puzzle Mechanics
- [x] As a player, I can drag from the probe to aim and launch it with variable force so that aiming feels intuitive and skill-based
- [x] As a player, I can see a dashed arrow indicator while aiming so that I know the launch direction and relative power
- [x] As a player, I can see launched probes follow realistic gravitational physics with curved trajectories around gravity wells so that the puzzle has depth
- [x] As a player, I can see probes bounce off asteroids with impact particles and screen shake so that collisions feel physical
- [x] As a player, I can see probes get absorbed by gravity wells with an explosion effect and "Absorbed!" text so that failure is communicated clearly
- [x] As a player, I can see probes that fly off-screen reset with a "Miss!" message so that I know I need to try again

### Levels & Progression
- [x] As a player, I can play through 12 handcrafted levels with progressive difficulty so that the challenge builds gradually
- [x] As a player, I can repair a different spacecraft component on each level (Navigation Module, Thruster Assembly, Hull Plating, Shield Generator, Fuel Cell, etc.) so that there is a narrative reason to solve each puzzle
- [x] As a player, I can see the repair objective displayed in the HUD so that I know what component I'm fixing
- [x] As a player, I can complete all 12 levels to see a "SPACECRAFT FULLY REPAIRED!" victory screen so that the game has a satisfying conclusion

### Star Rating System
- [x] As a player, I can earn 1-3 stars per level based on moves versus par so that I'm motivated to find optimal solutions
- [x] As a player, I can see my star rating and points displayed as floating text on level completion so that I get immediate feedback
- [x] As a player, I can earn time-based bonus points so that solving quickly is additionally rewarded

### Level Elements
- [x] As a player, I can see gravity wells with animated distortion rings, spiraling vortex effects, orbital debris, and glowing cores so that they look visually impressive
- [x] As a player, I can see gravitational lensing hint circles showing each well's influence radius so that I can predict trajectories
- [x] As a player, I can see asteroids rendered as irregular rotating polygons with craters, surface texture, and lighting shadows so that they look realistic
- [x] As a player, I can see the goal zone as a pulsing beacon with rotating dashed ring and "REPAIR" label so that the target is clearly visible
- [x] As a player, I can retry the current level with R key without losing progress so that experimentation is quick

### Visual Effects
- [x] As a player, I can see a glowing trail following the launched probe with engine trail dots so that the flight path is traced
- [x] As a player, I can see the probe rendered as a ship shape that rotates to face its velocity direction so that it looks like a spacecraft
- [x] As a player, I can see multi-color confetti particle bursts on level completion so that success feels celebratory
- [x] As a player, I can see a twinkling starfield with varied star sizes and nebula patches so that the space atmosphere is immersive
- [x] As a player, I can see shooting stars streak across the background so that the view feels dynamic
- [x] As a player, I can see screen shake on asteroid impacts and well absorption so that events feel impactful

### Game Management
- [x] As a player, I can see a title screen with instructions before starting so that I know how to play
- [x] As a player, I can pause/resume with Escape so that I can take breaks
- [x] As a player, I can start a new game with F2 so that I can restart from the beginning
- [x] As a player, I can have high scores persisted to localStorage (top 5, tracking score and level reached) so that I can track my best runs
- [x] As a player, I can see a HUD showing level number, moves, elapsed time, and total score so that I always know my progress
- [x] As a player, I can see a status bar with score, level, moves, and game state so that key information is at a glance

### Integration
- [x] As a player, I can see a menu bar with Game (New Game, Pause, High Scores, Exit) and Help (Controls, About) so that all actions are discoverable
- [x] As a player, I can use dialog windows for high scores, controls, and about info so that information is organized
- [x] As a player, I can see the window title update with current level and score so that progress is visible in the taskbar

### Planned Features
- [ ] As a player, I can hear sound effects for launching, collisions, and completing levels so that the game has audio feedback
- [ ] As a player, I can play procedurally generated bonus levels after completing the campaign so that replayability is extended
- [ ] As a player, I can use repulsive (anti-gravity) wells that push probes away so that puzzle variety increases
- [ ] As a player, I can see a trajectory prediction line while aiming so that I can better plan my shots
- [ ] As a player, I can share my level scores online so that I can compete with friends

## Controls

| Input | Action |
|---|---|
| Click & Drag from probe | Aim and launch probe |
| R | Retry current level |
| Escape | Pause / Resume |
| F2 | New Game |

## SEO Keywords

space puzzle game, gravity puzzle, physics puzzle, browser game, online puzzle game, gravity wells, asteroid field, spacecraft repair, drag and launch, orbital mechanics, free puzzle game, space navigation, gravity manipulation, web game, HTML5 canvas game
