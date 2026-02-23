# FreeCell

The classic FreeCell card game with seeded deals compatible with the original Windows numbering, supermove support, auto-complete, and a celebratory win animation -- strategic patience at its finest inside »SynthelicZ«.

## Product Requirements

### Purpose
FreeCell provides the beloved strategic solitaire variant within the »SynthelicZ« desktop, where every deal is face-up and nearly every game is solvable with the right strategy. Unlike Klondike solitaire which relies partly on luck, FreeCell rewards planning and foresight, making it the thinking person's card game and a must-have companion to the desktop's game suite.

### Key Capabilities
- Full FreeCell gameplay with 52 cards dealt face-up across 8 tableau columns
- Four free cells for temporary card storage and four foundation piles building Ace to King by suit
- Supermove mechanic allowing multi-card moves calculated from available free cells and empty columns
- Seeded deal generation compatible with the classic Microsoft FreeCell numbering (1 to 1,000,000)
- Click-to-select, drag-and-drop, and double-click card interaction with auto-complete
- Multi-level undo supporting up to 500 moves
- Game timer and move counter with bouncing-card victory animation
- Game selection dialog for choosing specific deal numbers or restarting the current deal

### Design Reference
Modeled after the classic Microsoft FreeCell (freecell.exe) from Windows 95 through Windows XP -- green felt background, canvas-drawn cards, the same numbered-deal RNG algorithm, click-or-drag interaction, and the signature cascading victory animation.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Gameplay
- [x] As a user, I can play FreeCell with all 52 cards dealt face-up into 8 tableau columns
- [x] As a user, I can move single cards to any of the 4 free cells as temporary storage
- [x] As a user, I can build foundation piles from Ace to King by suit
- [x] As a user, I can move cards between tableau columns in alternating-color descending order
- [x] As a user, I can move a card to an empty tableau column
- [x] As a user, I can move multiple cards at once using the supermove mechanic
- [x] As a user, I can see the supermove limit calculated from available free cells and empty columns
- [ ] As a user, I can see a hint highlighting a recommended move

### Card Interaction
- [x] As a user, I can click a card to select it and then click a destination to move it
- [x] As a user, I can drag and drop cards to move them
- [x] As a user, I can see the selected card highlighted with a yellow glow
- [x] As a user, I can double-click a card to auto-move it to the correct foundation
- [x] As a user, I can right-click to trigger safe auto-complete of all possible foundation moves
- [x] As a user, I can press 'A' to trigger auto-complete
- [ ] As a user, I can see valid drop targets highlighted when dragging a card

### Game Selection
- [x] As a user, I can start a new random game
- [x] As a user, I can select a specific game by number (1 to 1,000,000)
- [x] As a user, I can restart the current game deal from the beginning
- [x] As a user, I can see the current game number in the status bar
- [x] As a user, I can see deals generated with the classic Microsoft FreeCell RNG algorithm
- [ ] As a user, I can mark games as winnable or unwinnable in a personal log
- [ ] As a user, I can see my completion status for each game number

### Undo and Game Control
- [x] As a user, I can undo my last move
- [x] As a user, I can undo up to 500 moves
- [ ] As a user, I can redo an undone move
- [ ] As a user, I can see the number of remaining undo steps

### Win Detection
- [x] As a user, I can see the game detect when it is safe to auto-complete all remaining cards
- [x] As a user, I can watch an auto-complete animation move cards to foundations
- [x] As a user, I can see a bouncing card celebration animation on winning
- [x] As a user, I can see fireworks and particle effects burst during the celebration
- [x] As a user, I can see smooth easing animations when cards move to foundations or tableau with landing sparkles
- [x] As a user, I can see physics-based rotating cards with motion trails during the win animation
- [ ] As a user, I can see win statistics (games played, games won, win streak)

### Scoring and Timer
- [x] As a user, I can see the number of moves I have made
- [x] As a user, I can see a timer tracking the current game
- [ ] As a user, I can see a best-time leaderboard for completed games
- [ ] As a user, I can see a score combining moves and time

### Display & Window
- [x] As a user, I can resize the game window and the canvas scales to fill the available space
- [x] As a user, I can maximize the game window for a larger view
- [x] As a user, I can see the canvas rendered at the correct resolution for my display (HiDPI support)

### Visual Quality
- [x] As a user, I can see detailed card faces with suit symbols and pip layouts
- [x] As a user, I can see a green felt background
- [x] As a user, I can see the canvas rendered at high DPI for crisp visuals
- [x] As a user, I can see outlines for empty free cell and foundation positions
- [ ] As a user, I can choose from different card back designs
- [ ] As a user, I can choose from different table background colors or textures

### Keyboard Shortcuts
- [x] As a user, I can press F2 to start a new game
- [x] As a user, I can press F3 to open the Select Game dialog
- [x] As a user, I can press Ctrl+Z to undo a move
- [x] As a user, I can press Escape to deselect the current card
- [ ] As a user, I can use keyboard-only navigation to select columns and move cards
