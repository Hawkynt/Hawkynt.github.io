# Tetris

The classic block-stacking puzzle game with standard rotation, ghost piece, next-piece preview, NES-style scoring, and high score tracking -- fast, addictive fun inside the SynthelicZ Desktop.

## Product Requirements

### Purpose
Tetris delivers the timeless block-stacking puzzle experience as a built-in game within the SynthelicZ desktop. It provides quick entertainment and a familiar casual gaming option, giving users a reason to enjoy the desktop environment beyond productivity tasks. The implementation follows established Tetris guidelines for authentic gameplay feel.

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
- Runs inside an iframe within the SynthelicZ desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the SynthelicZ theme engine

## User Stories

### Core Gameplay
- [x] As a player, I can see tetrominoes fall from the top of the board so that I have pieces to place
- [x] As a player, I can move pieces left and right so that I can position them
- [x] As a player, I can rotate pieces clockwise and counter-clockwise so that I can fit them into gaps
- [x] As a player, I can soft-drop pieces for faster descent so that I can speed up play
- [x] As a player, I can hard-drop pieces to instantly place them so that I can commit quickly
- [x] As a player, I can see a ghost piece showing where the current piece will land so that I can plan placement
- [x] As a player, I can see completed lines cleared from the board so that I make room for more pieces
- [x] As a player, I can see a line-clear animation when rows are completed so that clears feel rewarding
- [ ] As a player, I can hold a piece in reserve and swap it with the current piece so that I have more strategic options
- [ ] As a player, I can see a T-spin bonus when performing T-spin moves so that advanced techniques are rewarded

### Piece System
- [x] As a player, I can see all 7 standard tetromino shapes (I, O, T, S, Z, J, L) so that I have the full piece set
- [x] As a player, I can see the next piece in a preview panel so that I can plan ahead
- [x] As a player, I can experience fair piece distribution through the 7-bag randomizer so that piece order is balanced
- [x] As a player, I can rely on the Super Rotation System (SRS) for wall kicks so that rotation near walls works correctly
- [ ] As a player, I can see a preview of the next 3-5 pieces instead of just one so that I can plan further ahead
- [ ] As a player, I can choose from different randomizer modes (pure random, 7-bag, 14-bag) so that I can vary the challenge

### Scoring and Progression
- [x] As a player, I can see my current score, level, and lines cleared so that I know my progress
- [x] As a player, I can earn points using NES-style scoring (more points for more lines at once) so that multi-line clears are valuable
- [x] As a player, I can see the game speed increase as I level up so that difficulty ramps over time
- [x] As a player, I can earn bonus points for soft and hard drops so that fast play is rewarded
- [ ] As a player, I can earn combo bonuses for consecutive line clears so that sustained performance is rewarded
- [ ] As a player, I can earn back-to-back bonuses for consecutive Tetris clears so that expert play is distinguished

### High Scores
- [x] As a player, I can view a list of my best scores so that I can track my performance
- [x] As a player, I can have my scores saved to local storage so that they persist between sessions
- [x] As a player, I can reset the high scores table so that I can start fresh
- [ ] As a player, I can enter my name when achieving a high score so that entries are personalized
- [ ] As a player, I can see the date and time of each high score entry so that I know when I achieved them

### Game Flow
- [x] As a player, I can start a new game at any time with F2 so that restarting is quick
- [x] As a player, I can pause and resume the game with P so that I can take breaks
- [x] As a player, I can see a Game Over overlay when the board fills up so that the end is clearly communicated
- [x] As a player, I can restart after a Game Over by pressing Enter so that I can try again quickly
- [ ] As a player, I can choose a starting level so that I can begin at higher difficulty
- [ ] As a player, I can play a marathon mode with a fixed number of lines to clear so that I have a defined goal

### Controls
- [x] As a player, I can see a controls reference dialog so that I know the key bindings
- [x] As a player, I can use arrow keys for movement so that controls are standard
- [x] As a player, I can use Z/X for clockwise/counter-clockwise rotation so that rotation has two directions
- [x] As a player, I can use Space for hard drop so that quick placement is one key press
- [x] As a player, I can use P to pause so that pausing is easy to remember
- [x] As a player, I can use F2 to start a new game so that restarting is quick
- [x] As a player, I can use touch/swipe controls on mobile (swipe left/right to move, tap to rotate, swipe down to drop) so that the game works on touch devices
- [ ] As a player, I can remap controls to my preferred keys so that I can customize the input layout

### Visual Effects
- [x] As a player, I can see each tetromino in a distinct color so that pieces are visually differentiated
- [x] As a player, I can see a clear board with gridlines so that cell boundaries are visible
- [x] As a player, I can see a brief flash effect when a piece locks onto the board so that locking is visually confirmed
- [x] As a player, I can feel haptic-like feedback through screen shake animations when hard-dropping pieces so that drops feel impactful
- [x] As a player, I can see a level-up announcement with flashing level display, pulsing border, and floating "LEVEL UP!" text so that progression is celebrated
- [x] As a player, I can see particle effects when lines are cleared so that clears feel explosive
- [ ] As a player, I can hear sound effects for drops, line clears, and game over so that the game has audio feedback
- [ ] As a player, I can hear background music while playing so that the atmosphere is enhanced
- [ ] As a player, I can choose from different visual themes or skins so that the appearance is customizable

### Integration
- [x] As a player, I can see a menu bar with Game (New Game, Pause, High Scores, Exit) and Help (Controls, About) so that all actions are discoverable
- [x] As a player, I can use dialog windows for high scores, controls, and about info so that information is organized
