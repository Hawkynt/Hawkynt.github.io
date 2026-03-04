# Minesweeper

A faithful recreation of the classic Windows Minesweeper game for the »SynthelicZ« desktop -- featuring Beginner, Intermediate, Expert, and Custom difficulty levels, a complete menu system, best times tracking, game statistics with win streaks, question mark support, and the iconic smiley face button. Uses cross-platform SVG icons (mine with metallic 3D radial gradient, flag with red linear gradient, bare skull for death) instead of emoji for consistent rendering. Features a full visual effects overhaul: canvas-based particle explosions and confetti via the shared `game-effects.js` module, difficulty-themed color palettes (meadow/steel/inferno), a cinematic multi-phase death animation ending with a pulsing skull, enhanced cell styling with 3D gradients, LED ghost digits, and victory celebrations.

## Product Requirements

### Purpose
Minesweeper brings the beloved classic Windows puzzle game to the »SynthelicZ« desktop, providing entertainment and a showcase of the desktop environment's ability to host fully interactive applications. It demonstrates that the »SynthelicZ« shell can run complete, self-contained games with persistent state, menu systems, and dialogs.

### Key Capabilities
- Classic mine-sweeping gameplay with left-click reveal, right-click flag, and chord reveal mechanics
- Four difficulty levels: Beginner (9x9), Intermediate (16x16), Expert (30x16), and user-defined Custom
- LED-style mine counter and timer with 3-digit display, red glow effect, and dim "888" ghost digits behind active numbers
- Iconic smiley face button reflecting game state (happy, surprised, cool, dead, skull) using SVG graphics
- Best times leaderboard with localStorage persistence and name entry prompts
- Game statistics tracking per difficulty: games played, wins, win percentage, current streak, best streak
- Full menu system with difficulty selection, question mark toggle, statistics, and dialogs
- Cross-platform SVG icons for mine (metallic 3D radial gradient), flag (red linear gradient), smiley faces, and bare skull (no emoji dependency)
- Canvas-based particle effects via shared `game-effects.js` module (same engine used by Space Invaders, Asteroids, Breakout)
- Difficulty themes: meadow (green tint, warm particles), steel (blue-gray tint, cyan particles), inferno (red/amber tint, fire particles)
- Cinematic multi-phase death animation: impact flash + screen shake + particle burst, chain detonation with staggered particle bursts, board darkens with hit mine glow, smiley shrinks/rotates away and skull grows/rotates in, skull pulses red indefinitely
- Enhanced cell styling: 3D gradient overlay on hidden cells, hover brightness + scale, press-down scale, revealed inset shadow
- Stronger dual text-shadow glow on number colors
- Scorched tan gradient on incorrectly flagged cells
- Flag drop-in animation from above with bounce
- Enhanced reveal/mine-appear animations with overshoot bounce
- Canvas confetti win celebration from 3 burst points with theme colors, gold flash, victory bounce on smiley
- Cell hover highlight on unrevealed cells
- Safe first click guarantee with a 3x3 safe zone around the initial reveal

### Design Reference
A faithful recreation of the classic Windows Minesweeper (winmine.exe) from Windows XP and earlier, preserving the original gameplay mechanics, visual style (raised/sunken cells, LED counters, smiley button), and menu structure.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Gameplay

- [x] As a user, I can left-click a cell to reveal it
- [x] As a user, I can see the first click is always safe (mines are placed after the first click with a 3x3 safe zone)
- [x] As a user, I can see numbers (1-8) indicating how many adjacent mines surround a revealed cell
- [x] As a user, I can see empty cells auto-reveal recursively (flood fill) when they have no adjacent mines
- [x] As a user, I can right-click a hidden cell to place a flag
- [x] As a user, I can right-click a flagged cell to change it to a question mark (when marks are enabled)
- [x] As a user, I can right-click a question mark cell to return it to hidden
- [x] As a user, I can right-click a flagged cell to unflag it directly (when marks are disabled)
- [x] As a user, I can chord (click both buttons or middle-click on a revealed number) to auto-reveal adjacent unflagged cells when the flag count matches the number
- [x] As a user, I can see the game end in a loss when I reveal a mine, with the hit mine highlighted
- [x] As a user, I can see all remaining mines revealed when I lose
- [x] As a user, I can see incorrectly placed flags marked with an X when I lose
- [x] As a user, I can win by revealing all non-mine cells
- [x] As a user, I can see remaining mines auto-flagged when I win

### Difficulty Levels

- [x] As a user, I can play Beginner (9x9, 10 mines)
- [x] As a user, I can play Intermediate (16x16, 40 mines)
- [x] As a user, I can play Expert (30x16, 99 mines)
- [x] As a user, I can define a Custom field with configurable height (9-24), width (9-30), and mines (10-667)
- [x] As a user, I can see validation errors in the custom dialog (e.g., too many mines for the field size)
- [x] As a user, I can press Enter in the custom dialog inputs to submit
- [x] As a user, I can see the window auto-resize to fit the selected difficulty

### Mine Counter and Timer

- [x] As a user, I can see a 3-digit LED mine counter showing remaining unflagged mines
- [x] As a user, I can see the mine counter go negative when I place more flags than mines
- [x] As a user, I can see a 3-digit LED timer counting seconds from the first click
- [x] As a user, I can see the timer stop when the game ends (win or loss)
- [x] As a user, I can see the timer max out at 999 seconds

### Smiley Button

- [x] As a user, I can see a happy smiley face during normal gameplay
- [x] As a user, I can see a surprised face while pressing on the minefield
- [x] As a user, I can see a cool sunglasses face when I win
- [x] As a user, I can see a dead face when I lose, followed by a cinematic skull transition (shrink/rotate smiley away, grow/rotate skull in, skull pulses red)
- [x] As a user, I can click the smiley button to start a new game at any time

### Menu System

- [x] As a user, I can access Game and Help menus from the menu bar
- [x] As a user, I can start a new game from the Game menu (or press F2)
- [x] As a user, I can select difficulty level from the Game menu with a check mark on the current level
- [x] As a user, I can open the Custom field dialog from the Game menu
- [x] As a user, I can toggle question marks (?) on/off from the Game menu
- [x] As a user, I can view best times from the Game menu
- [x] As a user, I can view game statistics from the Game menu
- [x] As a user, I can exit the game from the Game menu
- [x] As a user, I can see the About dialog from the Help menu
- [x] As a user, I can hover between open menus to switch them
- [x] As a user, I can click outside the menu to close it

### Best Times

- [x] As a user, I can see a "Fastest Mine Sweepers" dialog showing best times for Beginner, Intermediate, and Expert
- [x] As a user, I can be prompted to enter my name when I achieve a new best time
- [x] As a user, I can see best times persisted in localStorage across sessions
- [x] As a user, I can reset all best times scores from the dialog
- [x] As a user, I can see default "Anonymous" with 999 seconds for unset records

### Dialogs

- [x] As a user, I can see an About dialog with the game title and description
- [x] As a user, I can see a Statistics dialog showing per-difficulty stats with a Reset button
- [x] As a user, I can close dialogs by clicking the X button, OK button, or clicking outside the dialog
- [x] As a user, I can close dialogs by pressing Escape

### Keyboard Support

- [x] As a user, I can press F2 to start a new game
- [x] As a user, I can press Escape to close open dialogs

### Display & Window

- [x] As a user, I can resize the game window and the playfield scales to fit while preserving aspect ratio
- [x] As a user, I can maximize the game window for a larger view
- [x] As a user, I can see the game scale up or down smoothly to fill the available space

### User Interface

- [x] As a user, I can see themed visual styles matching the current desktop skin
- [x] As a user, I can see color-coded numbers (different colors for 1-8)
- [x] As a user, I can see SVG-based icons for mines, flags, and smiley faces that render consistently across all platforms
- [x] As a user, I can see raised/sunken cell styling for hidden/revealed states
- [x] As a user, I can see a game statistics dialog (games played, wins, win percentage, current streak, best streak) per difficulty
- [x] As a user, I can reset my game statistics from the statistics dialog
- [ ] As a user, I can undo my last move
- [ ] As a user, I can see a replay of the completed game
- [ ] As a user, I can see a hint highlighting a safe cell to click
- [ ] As a user, I can see a sound effect when revealing cells, flagging, winning, or losing
- [x] As a user, I can see a canvas-based confetti animation from 3 burst points with theme colors when I win
- [x] As a user, I can see the game board shake when I hit a mine (CSS shake + canvas screen shake)
- [x] As a user, I can see canvas-based explosion particles burst from the mine I hit (30 particles)
- [x] As a user, I can see canvas-based chain explosion particles (8 each) cascade outward from the hit mine as other mines are revealed
- [x] As a user, I can see a red screen flash when I hit a mine and a gold flash when I win
- [x] As a user, I can see the board darken after all mines are revealed, with the hit mine glowing bright
- [x] As a user, I can see cells reveal with a cascading animation effect with overshoot bounce based on distance from my click
- [x] As a user, I can see flags drop in from above with a bounce animation when I place them
- [x] As a user, I can see mines stagger-reveal with enhanced overshoot animation ordered by distance from the hit mine when I lose
- [x] As a user, I can see the smiley button bounce when I click it to start a new game
- [x] As a user, I can see the smiley do a victory bounce with rotation wobble when I win
- [x] As a user, I can see a subtle hover highlight with brightness and scale on unrevealed cells
- [x] As a user, I can see a press-down scale effect on unrevealed cells
- [x] As a user, I can see LED counters with a red glow effect and dim "888" ghost digits behind active numbers
- [x] As a user, I can see number colors with stronger dual text-shadow glow for depth
- [x] As a user, I can see incorrectly placed flags on a scorched tan gradient background with a clear X overlay
- [x] As a user, I can see hidden cells with a subtle 3D gradient overlay for depth
- [x] As a user, I can see revealed cells with an inset shadow for depth
- [x] As a user, I can see a difficulty theme tint on the minefield (meadow green for Beginner, steel blue-gray for Intermediate, inferno red/amber for Expert)
- [x] As a user, I can see theme-colored particles and confetti matching my difficulty level
- [x] As a user, I can see the game frame with a floating drop shadow
- [x] As a user, I can exit the game from the Game menu
- [ ] As a user, I can see the board use custom mine and flag images matching the skin
