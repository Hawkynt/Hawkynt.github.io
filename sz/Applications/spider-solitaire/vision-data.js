;(function(){window.__visionMd=`# Spider Solitaire

A faithful recreation of the classic Windows Spider Solitaire card game for the »SynthelicZ« desktop, rendered entirely on a canvas with drag-and-drop card movement, multiple difficulty levels, and satisfying win animations.

## Product Requirements

### Purpose
Spider Solitaire provides a classic single-player card game experience within the »SynthelicZ« desktop environment. It serves as both entertainment and a demonstration of canvas-based game rendering, offering the familiar gameplay that millions of Windows users know and love. The app gives the desktop a polished, complete feel by including the kind of built-in game that users expect from a traditional desktop OS.

### Key Capabilities
- Full Spider Solitaire gameplay with 104-card deck, 10 tableau columns, stock dealing, and foundation completion
- Three difficulty levels (1-suit, 2-suit, 4-suit) with in-game difficulty switching
- Canvas-rendered card graphics with suit symbols, rank labels, pip layouts, and face card designs
- Drag-and-drop card movement with smooth pointer tracking and visual feedback
- Scoring system, move counter, and game timer displayed in a status bar
- Undo support for reversing moves
- Animated suit completion sequences and bouncing card win celebration
- Responsive canvas layout that adapts to window resizing with crisp device-pixel-ratio rendering

### Design Reference
Modeled after the classic Spider Solitaire included with Microsoft Windows XP and later versions, faithfully recreating the green felt table, card visuals, and gameplay mechanics.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Gameplay
- [x] As a user, I can start a new game with a shuffled 104-card deck dealt into 10 tableau columns
- [x] As a user, I can drag face-up card runs of the same suit from one tableau column to another
- [x] As a user, I can place a card on top of another card that is exactly one rank higher (regardless of suit)
- [x] As a user, I can only move valid same-suit descending runs as a group
- [x] As a user, I can see face-down cards automatically flip when they become the top card in a column
- [x] As a user, I can deal one card from the stock pile to each tableau column when no empty columns exist
- [x] As a user, I see a completed K-to-A same-suit sequence automatically removed and animated to the foundation area
- [x] As a user, I win the game when all 8 suit sequences are completed
- [x] As a user, I can drop cards onto empty tableau columns

### Difficulty Levels
- [x] As a user, I can choose 1-suit (Easy) difficulty using only Spades
- [x] As a user, I can choose 2-suit (Medium) difficulty using Spades and Hearts
- [x] As a user, I can choose 4-suit (Hard) difficulty using all four suits
- [x] As a user, I can select difficulty from a dialog when starting a new game
- [x] As a user, I can change difficulty from the Game menu's Difficulty submenu
- [x] As a user, I see the current difficulty indicated with a checkmark in the menu

### Scoring and Statistics
- [x] As a user, I can see my current score displayed in the status bar
- [x] As a user, I can see the number of moves I have made
- [x] As a user, I can see a timer tracking how long the game has been running
- [x] As a user, I see my score increase with each move and completed sequence
- [ ] As a user, I want to see a high scores table that persists between sessions
- [ ] As a user, I want to see win/loss statistics tracked across games

### Undo and Game Controls
- [x] As a user, I can undo my last move with Ctrl+Z
- [x] As a user, I can undo moves via the Game menu
- [x] As a user, I can start a new game with F2
- [x] As a user, I can exit the application from the Game menu

### Visual Feedback
- [x] As a user, I can see cards rendered with suit symbols, rank labels, and pip layouts
- [x] As a user, I can see face cards (J, Q, K) with distinct center designs
- [x] As a user, I can see red suits (hearts, diamonds) and black suits (spades, clubs) in appropriate colors
- [x] As a user, I can see a decorative card back pattern for face-down cards
- [x] As a user, I can see an animation when a completed suit sequence is removed
- [x] As a user, I can see a bouncing card win animation when I complete the game
- [x] As a user, I can see the number of remaining stock deals displayed below the stock pile
- [x] As a user, I can see empty tableau slots marked with a subtle outline
- [x] As a user, I see a green felt table background
- [ ] As a user, I want to see a hint system that suggests possible moves
- [ ] As a user, I want to see card movement animations when dealing from the stock

### Interaction
- [x] As a user, I can drag cards with smooth pointer tracking
- [x] As a user, I can click the stock pile to deal cards
- [x] As a user, I see an error message when trying to deal with empty columns
- [x] As a user, I can see dragged cards rendered on top of all other elements
- [x] As a user, I can release a drag on an invalid target and have the cards return to their original position
- [x] As a user, I can right-click the canvas without triggering a context menu
- [ ] As a user, I want to double-click a card to auto-move it to the best valid position
- [ ] As a user, I want to see card hover highlights indicating valid drop targets

### Responsive Layout
- [x] As a user, I can see the game canvas resize to fit the window
- [x] As a user, I can see card spacing adjust dynamically based on canvas width
- [x] As a user, I can see the game render at the correct device pixel ratio for crisp graphics

### Menus and Dialogs
- [x] As a user, I can access a Game menu with New Game, Difficulty, Undo, and Exit options
- [x] As a user, I can access a Help menu with an About dialog
- [x] As a user, I can see keyboard shortcuts listed in the menu items
- [x] As a user, I can close dialogs by pressing Escape
- [x] As a user, I can close dialogs by clicking outside them

### Accessibility
- [ ] As a user, I want keyboard-only navigation to select and move cards
- [ ] As a user, I want screen reader announcements for game state changes
- [ ] As a user, I want adjustable card sizes for better visibility
`})();
