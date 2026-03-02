# Card Games Suite

Classic card games collection featuring 7 game variants with AI opponents, smooth card animations, and stunning visual effects — running inside the SynthelicZ Desktop WebOS.

## User Stories

- **S-070**: As a player, I want to choose from 7 classic card game variants (Poker, Blackjack, Uno, SkipBo, Skat, Canasta, Doppelkopf) so that I have variety in a single app.
- **S-071**: As a player, I want smooth card-deal animations, card-flip transitions, winning-hand glow effects, and chip sparkle particles so the games feel polished and satisfying.
- **S-000**: As the platform, all games integrate with the SZ Desktop via shared bootstrap, menu, dialog, and visual-effects libraries.

## Features

- **7 Game Variants**: Poker (Texas Hold'em style), Blackjack (21), Uno, SkipBo, Skat, Canasta, Doppelkopf
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
| 1-7 | Play card from hand by position |
| H | Hit (Blackjack) |
| S | Stand (Blackjack) |
| B / F / C / R | Bet / Fold / Call / Raise (Poker) |
| F2 | New game / Return to menu |
| Escape | Pause / Resume |

## Game Variants

### Blackjack
Hit or stand to get as close to 21 as possible without going bust. Ace counts as 1 or 11.

### Poker
Five-card draw with betting rounds. Hand rankings from High Card to Royal Flush.

### Uno
Match cards by color or number. Special cards: Skip, Reverse, Draw Two, Wild, Wild Draw Four.

### SkipBo
Sequential card game — build piles from 1 to 12. First to empty their stock pile wins.

### Skat
German trick-taking game for 3 players. Declarer vs. two defenders.

### Canasta
Rummy-style game forming melds of 7 cards. Wild cards and red threes are bonus.

### Doppelkopf
German trick-taking game with two hidden teams determined by Queens of Clubs.

## Architecture

- `index.html` — Entry point with SEO meta, menu bar, canvas, status bar, dialogs
- `controller.js` — IIFE game engine: variant selector, card renderer, rules engines, AI, animations, effects
- `styles.css` — Layout and theming
- `icon.svg` — Desktop icon (cards + chips)

## SEO Keywords

card games, poker, blackjack, uno, skipbo, skat, canasta, doppelkopf, browser card game, classic card games, AI card game, card game collection, SynthelicZ, WebOS game, card animations, card flip effect
