# Card Games Suite

Classic card games collection featuring 10 game variants with AI opponents, smooth card animations, and stunning visual effects — running inside the SynthelicZ Desktop WebOS.

## User Stories

- **S-070**: As a player, I want to choose from 10 classic card game variants (Poker, Blackjack, Uno, Skip-Bo, Skat, Canasta, Doppelkopf, Solitaire, FreeCell, Spider Solitaire) so that I have variety in a single app.
- **S-071**: As a player, I want smooth card-deal animations, card-flip transitions, winning-hand glow effects, and chip sparkle particles so the games feel polished and satisfying.
- **S-072**: As a player, I want clickable buttons for all game actions (Hit/Stand, Bet/Fold/Call/Raise) so I can play entirely with the mouse.
- **S-073**: As a player, I want a "Back to Menu" option in both the menu bar and a canvas button so I can easily return to the game selection screen.
- **S-074**: As a player, I want Skip-Bo to use a two-step selection model (click card, then click destination) with discard piles so gameplay matches the real card game rules.
- [x] As a player, I want Uno to support house rules (stacking Draw Two/Wild Draw Four, jump-in on matching cards) so I can play with common variant rules.
- [x] As a player, I want Uno black wild cards to prompt a color choice dialog so I can pick which color continues play.
- [x] As a player, I want Skat to include a full bidding phase, proper role assignment (Declarer vs. Defenders), and accurate trick-based scoring so the game follows official Skat rules.
- [x] As a player, I want the standalone Solitaire, FreeCell, and Spider Solitaire apps removed from the desktop in favor of their card-games suite variants so there is a single unified card game collection.
- **S-000**: As the platform, all games integrate with the SZ Desktop via shared bootstrap, menu, dialog, and visual-effects libraries.

## Features

- **10 Game Variants**: Poker, Blackjack, Uno, Skip-Bo, Skat, Canasta, Doppelkopf + Solitaire, FreeCell, Spider Solitaire (loaded as on-demand variant modules)
- **2-Column Menu**: Game selection screen displays all 10 variants in a 2-column layout
- **Mouse-Only Play**: All games have clickable canvas buttons — no keyboard required
- **Back to Menu**: Return to game selection via menu bar entry, canvas button, or F2
- **Shared Card Engine**: Common `card-engine.js` provides card rendering, animation, particles, and layout utilities used by all variants
- **Modular Variant Architecture**: All 10 variants are separate JS files loaded on demand via `SZ.CardGames.registerVariant()`, sharing the card engine
- **Drag-and-Drop**: Solitaire variants support full drag-and-drop card movement via pointermove/pointerup forwarding
- **Shared Card Renderer**: All 52 cards rendered with suits (♠♥♦♣), ranks (A-K), and card backs
- **AI Opponents**: Per-variant AI that validates legal moves and plays strategically
- **Rules Engine**: Variant-specific rules — hit/stand/bust in Blackjack, hand rankings in Poker, color/number matching in Uno, etc.
- **Score Tracking**: Persistent high scores per variant via localStorage
- **Card Deal Animation**: Cards slide smoothly from deck to player positions
- **Card Flip Transition**: Scale-X flip animation reveals card face
- **Winning Hand Glow**: Winning cards glow with golden radiance
- **Chip Sparkle Effects**: Particle sparkles on chip stacks when winning
- **Floating Text**: Score changes and game events shown as floating text
- **Screen Shake**: Impact feedback on big wins or busts

## Controls

| Input | Action |
|-------|--------|
| Mouse Click | Select / play card |
| Mouse Drag | Move cards (Solitaire, FreeCell, Spider) |
| Hit / Stand buttons | Blackjack actions (clickable on canvas) |
| Bet / Fold / Call / Raise buttons | Poker actions (clickable on canvas) |
| 1-7 | Play card from hand by position |
| H / S | Hit / Stand keyboard shortcut (Blackjack) |
| B / F / C / R | Bet / Fold / Call / Raise keyboard shortcut (Poker) |
| Ctrl+Z | Undo (Solitaire, FreeCell, Spider) |
| F2 | New game / Return to menu |
| Escape | Pause / Resume |
| ☰ Menu button | Return to game selection (top-right corner) |

## Game Variants

### Blackjack
Hit or stand to get as close to 21 as possible without going bust. Ace counts as 1 or 11. Clickable Hit/Stand buttons on canvas.

### Poker
Five-card draw with betting rounds. Hand rankings from High Card to Royal Flush. Clickable Bet/Fold/Call/Raise buttons on canvas.

### Uno
Match cards by color or number. Special cards: Skip, Reverse, Draw Two, Wild, Wild Draw Four. Black wild cards prompt a color choice dialog. House rules support includes stacking Draw Two/Wild Draw Four and jump-in on matching cards.

### Skip-Bo
Sequential card game — build piles from 1 to 12. Two-step selection: click a card to select it (hand or stock pile), then click a build pile to play or a discard pile to end your turn. AI opponent takes turns automatically. First to empty their stock pile wins.

### Skat
German trick-taking game for 3 players. Full bidding phase with proper role assignment (Declarer vs. two Defenders) and accurate trick-based scoring following official Skat rules.

### Canasta
Rummy-style game forming melds of 7 cards. Wild cards and red threes are bonus.

### Doppelkopf
German trick-taking game with two hidden teams determined by Queens of Clubs.

### Solitaire (Module)
Classic Klondike solitaire adapted from the standalone app. Drag-and-drop cards between tableau, waste, and foundations. Draw-1/Draw-3 modes, undo, auto-complete, win animation with bouncing cards and fireworks.

### FreeCell (Module)
All-cards-face-up strategy game adapted from the standalone app. Click-to-select or drag cards between 4 free cells, 4 foundations, and 8 tableau columns. Supermove support, undo, deal animation, win animation.

### Spider Solitaire (Module)
Build same-suit runs from King to Ace across 10 tableau columns. 1/2/4 suit difficulty modes. Drag-and-drop, undo, scoring, deal animation, completion animation, win animation. Adapted from the standalone app.

## Architecture

- `index.html` — Entry point with SEO meta, menu bar, canvas, status bar, dialogs
- `card-engine.js` — Shared rendering engine: card drawing, animation system, particle effects, layout utilities, theme colors
- `controller.js` — Pure orchestrator: variant loading, menu, game lifecycle, postMessage bridge
- `blackjack-variant.js` — Blackjack variant module
- `poker-variant.js` — Poker variant module
- `uno-variant.js` — Uno variant module
- `skipbo-variant.js` — Skip-Bo variant module
- `skat-variant.js` — Skat variant module
- `canasta-variant.js` — Canasta variant module
- `doppelkopf-variant.js` — Doppelkopf variant module
- `solitaire-variant.js` — Klondike solitaire variant module
- `freecell-variant.js` — FreeCell variant module
- `spider-variant.js` — Spider Solitaire variant module
- `styles.css` — Layout and theming
- `icon.svg` — Desktop icon (cards + chips)

## SEO Keywords

card games, poker, blackjack, uno, skip-bo, skat, canasta, doppelkopf, solitaire, freecell, spider solitaire, browser card game, classic card games, AI card game, card game collection, SynthelicZ, WebOS game, card animations, card flip effect
