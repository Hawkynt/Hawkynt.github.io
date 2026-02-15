# Solitaire

The classic Klondike card game with canvas-rendered cards, drag-and-drop, draw-1 and draw-3 modes, auto-complete, and a celebratory win animation -- a faithful desktop staple for »SynthelicZ«.

## Product Requirements

### Purpose
Solitaire provides the quintessential single-player card game experience within the »SynthelicZ« desktop. As a staple of every desktop operating system since Windows 3.0, it gives users a familiar, relaxing game to play during breaks, and its presence reinforces the authentic desktop-OS feel of the environment.

### Key Capabilities
- Standard Klondike solitaire with a full 52-card deck, stock/waste, tableau, and foundations
- Draw 1 and Draw 3 dealing modes selectable from the game menu
- Drag-and-drop and double-click card interaction for intuitive play
- Multi-level undo supporting up to 100 moves
- Automatic win detection with auto-complete animation for remaining cards
- Canvas-rendered card faces with detailed suit symbols, pip layouts, and high-DPI support
- Move counter and game timer displayed in the status bar
- Celebratory bouncing-card animation on winning

### Design Reference
Modeled after the classic Microsoft Solitaire (sol.exe) from Windows 3.0 through Windows XP -- green felt background, canvas-drawn playing cards, drag-and-drop interaction, and the iconic bouncing-card victory animation.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Gameplay
- [x] As a user, I can play standard Klondike solitaire with a full 52-card deck
- [x] As a user, I can click the stock pile to deal cards to the waste pile
- [x] As a user, I can drag cards between tableau columns following alternating-color descending rules
- [x] As a user, I can move cards to the four foundation piles building from Ace to King by suit
- [x] As a user, I can move a King (or stack starting with a King) to an empty tableau column
- [x] As a user, I can flip face-down cards when they become the top card of a tableau column
- [ ] As a user, I can see a hint highlighting the next available move

### Card Interaction
- [x] As a user, I can drag and drop cards to move them
- [x] As a user, I can double-click a card to auto-move it to the correct foundation
- [x] As a user, I can drag a stack of face-up cards from one tableau column to another
- [ ] As a user, I can right-click to auto-move all possible cards to foundations
- [ ] As a user, I can single-click to select a card and then click a destination

### Draw Modes
- [x] As a user, I can play in Draw 1 mode (one card at a time from the stock)
- [x] As a user, I can play in Draw 3 mode (three cards at a time from the stock)
- [x] As a user, I can switch draw modes from the Game menu
- [ ] As a user, I can see the number of remaining cards in the stock pile

### Undo and Game Control
- [x] As a user, I can undo my last move
- [x] As a user, I can undo up to 100 moves
- [x] As a user, I can start a new game at any time
- [ ] As a user, I can restart the same deal without reshuffling
- [ ] As a user, I can redo an undone move

### Win Detection
- [x] As a user, I can see the game automatically detect when all cards can be moved to foundations
- [x] As a user, I can watch an auto-complete animation when the game is won
- [x] As a user, I can see a bouncing card celebration animation on winning
- [ ] As a user, I can see my win statistics (games played, games won, win percentage)

### Scoring and Timer
- [x] As a user, I can see the number of moves I have made
- [x] As a user, I can see a timer tracking how long the current game has taken
- [ ] As a user, I can see a score based on time, moves, and draw mode
- [ ] As a user, I can view a high-scores table of my best games

### Visual Quality
- [x] As a user, I can see detailed card faces with suit symbols and pip layouts
- [x] As a user, I can see a green felt background
- [x] As a user, I can see the canvas rendered at high DPI for crisp visuals
- [x] As a user, I can see card outlines for empty piles
- [ ] As a user, I can choose from different card back designs
- [ ] As a user, I can choose from different table background colors or textures

### Keyboard Shortcuts
- [x] As a user, I can press F2 to start a new game
- [x] As a user, I can press Ctrl+Z to undo a move
- [ ] As a user, I can use keyboard navigation to select and move cards without a mouse
