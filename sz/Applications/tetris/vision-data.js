;(function(){window.__visionMd=`# Tetris

The classic block-stacking puzzle game with standard rotation, ghost piece, next-piece preview, NES-style scoring, and high score tracking -- fast, addictive fun inside »SynthelicZ«.

## Product Requirements

### Purpose
Tetris delivers the timeless block-stacking puzzle experience as a built-in game within the »SynthelicZ« desktop. It provides quick entertainment and a familiar casual gaming option, giving users a reason to enjoy the desktop environment beyond productivity tasks. The implementation follows established Tetris guidelines for authentic gameplay feel.

### Key Capabilities
- Standard Tetris gameplay with all 7 tetromino shapes on a 10x20 board
- Piece rotation using the Super Rotation System (SRS) with wall kicks
- Ghost piece projection and next-piece preview
- NES-style scoring with level progression and increasing speed
- Persistent high score tracking with local storage
- Game flow control with pause, restart, and game-over handling
- Keyboard-driven controls with a reference dialog

### Design Reference
Modeled after the classic NES Tetris and modern Tetris Guideline implementations -- the standard 10-wide, 20-tall playfield with 7-bag randomization, SRS rotation, ghost piece, and NES-era scoring rules.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Gameplay
- [x] As a user, I can see tetrominoes fall from the top of the board
- [x] As a user, I can move pieces left and right
- [x] As a user, I can rotate pieces clockwise and counter-clockwise
- [x] As a user, I can soft-drop pieces for faster descent
- [x] As a user, I can hard-drop pieces to instantly place them
- [x] As a user, I can see a ghost piece showing where the current piece will land
- [x] As a user, I can see completed lines cleared from the board
- [x] As a user, I can see a line-clear animation when rows are completed
- [ ] As a user, I can hold a piece in reserve and swap it with the current piece
- [ ] As a user, I can see a T-spin bonus when performing T-spin moves

### Piece System
- [x] As a user, I can see all 7 standard tetromino shapes (I, O, T, S, Z, J, L)
- [x] As a user, I can see the next piece in a preview panel
- [x] As a user, I can experience fair piece distribution through the 7-bag randomizer
- [x] As a user, I can rely on the Super Rotation System (SRS) for wall kicks
- [ ] As a user, I can see a preview of the next 3-5 pieces instead of just one
- [ ] As a user, I can choose from different randomizer modes (pure random, 7-bag, 14-bag)

### Scoring and Progression
- [x] As a user, I can see my current score, level, and lines cleared
- [x] As a user, I can earn points using NES-style scoring (more points for more lines at once)
- [x] As a user, I can see the game speed increase as I level up
- [x] As a user, I can earn bonus points for soft and hard drops
- [ ] As a user, I can earn combo bonuses for consecutive line clears
- [ ] As a user, I can earn back-to-back bonuses for consecutive Tetris clears

### High Scores
- [x] As a user, I can view a list of my best scores
- [x] As a user, I can have my scores saved to local storage
- [x] As a user, I can reset the high scores table
- [ ] As a user, I can enter my name when achieving a high score
- [ ] As a user, I can see the date and time of each high score entry

### Game Flow
- [x] As a user, I can start a new game at any time
- [x] As a user, I can pause and resume the game
- [x] As a user, I can see a Game Over overlay when the board fills up
- [x] As a user, I can restart after a Game Over by pressing Enter
- [ ] As a user, I can choose a starting level
- [ ] As a user, I can play a marathon mode with a fixed number of lines to clear

### Controls
- [x] As a user, I can see a controls reference dialog
- [x] As a user, I can use arrow keys for movement
- [x] As a user, I can use Z/X for rotation
- [x] As a user, I can use Space for hard drop
- [x] As a user, I can use P to pause
- [x] As a user, I can use F2 to start a new game
- [ ] As a user, I can remap controls to my preferred keys
- [ ] As a user, I can use touch controls on mobile devices

### Visual and Audio
- [x] As a user, I can see each tetromino in a distinct color
- [x] As a user, I can see a clear board with gridlines
- [ ] As a user, I can hear sound effects for drops, line clears, and game over
- [ ] As a user, I can hear background music while playing
- [ ] As a user, I can choose from different visual themes or skins
- [ ] As a user, I can see particle effects when lines are cleared
`})();
