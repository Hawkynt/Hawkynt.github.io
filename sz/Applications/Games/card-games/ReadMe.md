# Card Games Suite

A collection of 72 card game variants with AI opponents, hint mode, card style theming, smooth card animations, and visual effects -- running inside the SynthelicZ Desktop WebOS. Games span solitaire, casino, shedding, trick-taking, rummy, simple/speed, and European categories, all sharing a unified card engine for rendering, hit testing, and animations.

## How It Works

The suite is built on a modular variant architecture. A central `controller.js` manages the game lifecycle: displaying a 6-column menu of all 72 variants, loading variant modules on demand via dynamic `<script>` injection, and delegating gameplay to each variant's module. All variants share `card-engine.js` for procedural card rendering (bezier suit symbols, proper pip layouts, face card artwork, diamond-pattern backs), hit testing, button drawing, deck creation, shuffle, and animation. A `card-themes.js` module provides customizable table backgrounds, card back designs, and card face templates, all persisted via localStorage. Each variant implements its own rules engine, AI logic, and game flow while the controller provides shared visual effects (deal animation, flip transitions, winning glow, chip sparkle, floating text, screen shake).

## User Stories

### Game Selection
- [x] As a player, I can browse 72 game variants organized in a 6-column grid menu with game names and short descriptions
- [x] As a player, I can click any variant to load it on demand (variant JS files loaded dynamically)
- [x] As a player, I can return to the game selection menu via the canvas Menu button, menu bar, or F2 key
- [x] As a player, I can see all variants grouped by category: Solitaire (12), Casino (7), Shedding (13), Trick-Taking (11), Rummy (8), Simple/Speed (11), European (10)

### Hint System
- [x] As a player, I can toggle hint mode to highlight playable cards with a golden glow effect
- [x] As a player, I can see hints work across all game types: solitaire moves, shedding matches, trick-taking legal plays, rummy melds
- [x] As a player, I can have my hint mode state persist via localStorage across sessions

### Auto-Sort Hand
- [x] As a player, I can toggle auto-sort to keep my hand sorted by suit and rank (or color and value for Uno-style games)
- [x] As a player, I can see auto-sort as a togglable canvas button for the 42+ variants that support hand sorting
- [x] As a player, I can have my auto-sort preference persist via localStorage

### Card Style Theming
- [x] As a player, I can choose from 6 table themes: Classic Green, Midnight Blue, Casino Red, Oak Table, White Marble, Royal Purple
- [x] As a player, I can choose from multiple card back designs (Navy Diamonds, custom color, and more)
- [x] As a player, I can choose from multiple card face templates (French standard and variants)
- [x] As a player, I can have all theme choices persist via localStorage and apply immediately
- [x] As a player, I can access the Card Style button on both the menu screen and during gameplay

### Mouse-Only Play
- [x] As a player, I can use clickable canvas buttons for every game action in all 72 games (Hit/Stand, Bet/Fold/Call/Raise, Knock, SNAP!, etc.)
- [x] As a player, I can play any variant without a keyboard since all interactions work via pointer/click

### Card Rendering Engine
- [x] As a player, I can see cards procedurally drawn with bezier curve suit symbols (spades, hearts, diamonds, clubs)
- [x] As a player, I can see multi-color rich suit pips with radial gradients, specular highlights, and thin outlines for French, 4-Color, and German templates (Minimal stays flat by design)
- [x] As a player, I can see larger cards (80x110 vs previous 71x96) with proportionally scaled pips and margins
- [x] As a player, I can see pip layouts follow standard playing card arrangements for ranks 2-10
- [x] As a player, I can see face cards (J, Q, K) with center artwork
- [x] As a player, I can see card backs with configurable designs (diamond patterns, solid colors, custom)
- [x] As a player, I can see cards at variable dimensions with proportionally scaled pips, text, and borders (e.g., 0.55x for AI hands)
- [x] As a player, I can click cards with pixel-accurate hit testing

### Visual Effects
- [x] As a player, I can see card deal animations with cards sliding smoothly from deck to player positions
- [x] As a player, I can see card flip transitions with scale-X animation revealing the card face
- [x] As a player, I can see winning hand glow with golden radiance on winning cards
- [x] As a player, I can see chip sparkle effects with particle sparkles on chip stacks when winning
- [x] As a player, I can see floating text for score changes and game events
- [x] As a player, I can see screen shake as impact feedback on big wins or busts
- [x] As a player, I can see confetti, bursts, and sparkle particle effects

### Score and Persistence
- [x] As a player, I can have my high scores tracked per variant via localStorage
- [x] As a player, I can see my score displayed during gameplay and updated on game events

### Solitaire Games (12)
- [x] As a player, I can play Klondike Solitaire with drag-and-drop between tableau, waste, and foundations, with draw-1/draw-3 modes, undo, auto-complete, and win animation
- [x] As a player, I can play FreeCell with all cards face-up, click-to-select or drag between 4 free cells, 4 foundations, and 8 tableau columns, with supermove support and undo
- [x] As a player, I can play Spider Solitaire building same-suit runs King-to-Ace across 10 columns with 1/2/4 suit difficulty modes, drag-and-drop, undo, and scoring
- [x] As a player, I can play Yukon moving any face-up card group regardless of sequence, with all 52 cards visible from the start
- [x] As a player, I can play Pyramid removing pairs of exposed cards summing to 13 from a 28-card pyramid layout, with Kings removing alone
- [x] As a player, I can play Golf clearing 7 columns by playing +/-1 rank onto a waste pile
- [x] As a player, I can play TriPeaks clearing three overlapping peaks with +/-1 plays and streak bonuses
- [x] As a player, I can play Forty Thieves (2-deck, 104 cards) with 10 tableau columns, single card moves, and 8 foundation piles
- [x] As a player, I can play Canfield with a 13-card reserve, random foundation starter rank, and draw-3 stock
- [x] As a player, I can play Clock Patience dealing 52 cards into 13 clock-face piles and flipping by rank
- [x] As a player, I can play Baker's Dozen with 13 columns, Kings auto-moved to bottoms, no suit restriction for tableau builds
- [x] As a player, I can play Accordion compressing all 52 cards into one pile by matching suit or rank at 1-left or 3-left positions

### Casino Games (7)
- [x] As a player, I can play Poker (five-card draw) with betting rounds, hand rankings from High Card to Royal Flush, and Bet/Fold/Call/Raise buttons
- [x] As a player, I can play Blackjack hitting or standing to reach 21, with Ace as 1 or 11, and clickable Hit/Stand buttons
- [x] As a player, I can play Baccarat betting on Player, Banker, or Tie with 8-deck shoe and standard drawing rules (Natural 8/9, Banker commission)
- [x] As a player, I can play Texas Hold'em (4 players) with 2 hole cards + 5 community cards, Flop/Turn/River, and Check/Bet/Call/Raise/Fold/All-In
- [x] As a player, I can play Faro with 13 betting positions per rank, dealer draws 2 cards (loser then winner), even money payout, and case keeper
- [x] As a player, I can play Red Dog betting whether the third card falls between two post cards, with spread-based payouts (1=5:1, 2=4:1, 3=2:1, 4+=1:1)
- [x] As a player, I can play Three Card Poker with Ante and Play bets plus Pair Plus bonus

### Shedding Games (13)
- [x] As a player, I can play Uno matching by color or number, with Skip, Reverse, Draw Two, Wild, Wild Draw Four, and house rules (stacking, No Mercy, Zero rotate, Seven swap, Jump-In)
- [x] As a player, I can play Uno Flip with double-sided light/dark cards, Flip card reversing all cards globally, and dark-side actions (Skip Everyone, Draw Five, Wild Draw Color)
- [x] As a player, I can play Uno All Wild with 112 all-wild action cards (Wild Draw Two, Wild Reverse, Wild Skip, Wild Forced Swap, Wild Targeted Draw Two, Wild Gap)
- [x] As a player, I can play Liar's Uno playing face-down cards and bluffing, with "Liar!" challenges (caught lying = pick up pile, wrong challenge = draw 4)
- [x] As a player, I can play Uno Extreme with random card launcher replacing manual drawing (0-3 cards per press) and Extreme Hit cards
- [x] As a player, I can play Uno Party (6 players, 224-card double deck) with special Party Wilds: Everyone Draw, Trade Hands, Discard All, Pick Color
- [x] As a player, I can play Dos with dual discard piles, single or two-card combo number matching, and color match bonuses
- [x] As a player, I can play ONO 99 with a running total, busting at 99, and special cards (Hold, Reverse, Double Play, Minus-10)
- [x] As a player, I can play 8-Color Duo with 8 colors (Red, Blue, Green, Yellow, Purple, Orange, Pink, Teal), 114 cards, and 8-color wild choice overlay
- [x] As a player, I can play Skip-Bo building sequential piles 1-12 with two-step selection model and discard piles
- [x] As a player, I can play Crazy Eights matching suit or rank, with 8s as wild and suit choice, and draw-if-stuck
- [x] As a player, I can play Mau-Mau (German shedding) with action cards: 7=draw 2 (stackable), 8=skip, Jack=wild suit, Ace=extra turn
- [x] As a player, I can play President (4 players) shedding by playing higher-ranked cards, with 2s highest, 4-of-a-kind clears, and President/Scum ranking with card exchange

### Trick-Taking Games (11)
- [x] As a player, I can play Skat (3 players) with full bidding phase, Declarer vs. Defenders roles, and trick-based scoring
- [x] As a player, I can play Doppelkopf (4 players) with hidden teams determined by Queens of Clubs
- [x] As a player, I can play Hearts (4 players) avoiding hearts (1 pt each) and Queen of Spades (13 pts), with 3-card passing and shoot-the-moon
- [x] As a player, I can play Spades (4 players) bidding tricks with spades always trump, 10x points for making bid, bag penalties at 10 overtricks
- [x] As a player, I can play Euchre (2v2 teams) with 24-card deck (9-A), trump selection, right/left bower system, first to 10 points
- [x] As a player, I can play Pinochle (2v2 partnership) with 48-card double deck, bidding for trump, meld declarations, and 12 trick plays
- [x] As a player, I can play Bridge (2v2 NS vs EW) with sequential auction bidding, declarer playing dummy's hand face-up, and simplified rubber bridge scoring
- [x] As a player, I can play Oh Hell (4 players) with variable hand sizes (1 up to 7 and back), exact bid scoring (10 + tricks), and dealer hook rule
- [x] As a player, I can play Whist (2v2 classic) with 13 cards each, last dealt card as trump, follow-suit rules, and first partnership to 5 wins
- [x] As a player, I can play Pitch (4 players) bidding 1-4 to name trump, with four scoring points (High, Low, Jack, Game), first to 11
- [x] As a player, I can play Sixty-Six (2-player Austrian) with 24-card deck, two phases (open stock/closed), marriages (20/40), first to 66 trick points, match to 7 game points

### Rummy Games (8)
- [x] As a player, I can play Canasta forming melds of 7 cards with wild cards and red three bonuses
- [x] As a player, I can play Gin Rummy (2-player) drawing/discarding to form melds, knocking at deadwood <=10, or going gin for bonus
- [x] As a player, I can play Rummy 500 (3 players) drawing, melding sets/runs, and laying off on existing melds, first to 500
- [x] As a player, I can play Phase 10 completing 10 phase objectives in order with 108 custom cards (Wilds and Skips)
- [x] As a player, I can play Tonk (3 players) with 5-card hands, instant Tonk at 49-50, spreading melds, and knock/drop with double penalty for failed drops
- [x] As a player, I can play Rummy (3 players) drawing, forming sets/runs, laying off, with penalty points for remaining cards (A=1, face=10)
- [x] As a player, I can play Kalooki (Jamaican rummy) with 54 cards including jokers, initial melds totaling 51+, and Kalooki (going out in one turn) for double penalty
- [x] As a player, I can play Yaniv discarding combos and calling at 7 or less hand value

### Simple/Speed Games (11)
- [x] As a player, I can play War flipping cards simultaneously with ties triggering 3-face-down + 1-face-up wars
- [x] As a player, I can play Memory matching 12 pairs in a 6x4 grid by flipping 2 cards per turn
- [x] As a player, I can play Go Fish asking for ranks and collecting books of 4-of-a-kind
- [x] As a player, I can play Old Maid discarding pairs and drawing from opponent, avoiding the unpaired Queen
- [x] As a player, I can play Snap clicking "SNAP!" when consecutive cards match ranks
- [x] As a player, I can play Speed (2-player) racing to empty hand by playing +/-1 from center piles, with AI on a timer
- [x] As a player, I can play Cheat (4 players) playing 1-4 face-down cards claiming a rank, with "Cheat!" challenges
- [x] As a player, I can play Egyptian Rat Screw (4 players) slapping on doubles, sandwiches, or top-bottom matches, with face card challenges (A=4, K=3, Q=2, J=1)
- [x] As a player, I can play Sevens (4 players) building suit rows outward from 7s with strategic blocking
- [x] As a player, I can play Spite and Malice (2 players) building shared center piles A-K from hand, pay-off pile, or 4 discard piles, with jokers wild
- [x] As a player, I can play Beggar My Neighbor (2 players) flipping cards with face card payment obligations (A=4, K=3, Q=2, J=1)

### European Games (10)
- [x] As a player, I can play Schwimmen/31 (4 players) exchanging cards from a center pool to get 31 in one suit or 3-of-a-kind, with knock and life system
- [x] As a player, I can play Durak (Russian) attacking and defending with higher same-suit or trump cards, with undefended cards picked up
- [x] As a player, I can play Briscola (Italian 2-player) with 40-card deck, no follow-suit requirement, card values A=11/3=10/K=4/Q=3/J=2, scoring 61+ of 120
- [x] As a player, I can play Scopa (Italian 2-player) capturing table cards by value sum, scoring for most cards, most diamonds, Sette Bello, Primiera, and scopas
- [x] As a player, I can play Cribbage (2-player) with discard to crib, pegging (15s, 31s, pairs, runs), hand scoring, and first to 121 on the pegging board
- [x] As a player, I can play Piquet (16th-century French 2-player) with 32-card deck, talon exchange, 3 declaration phases (Point, Sequence, Set), Pique/Repique bonuses, first to 100
- [x] As a player, I can play Bezique (French 2-player) with 64-card deck, two-phase play (open stock/closed), marriages, bezique melds, first to 1000
- [x] As a player, I can play Cassino (2-player) capturing table cards by value or building sums, scoring for most cards, most spades, Big/Little Cassino, aces, sweeps, first to 21
- [x] As a player, I can play Pishti (Turkish 2-player) capturing by matching rank, Jacks capture any pile, Pishti bonus for single-card pile capture, first to 151
- [x] As a player, I can play Belote (French trick-taking) with declarations

## Controls

| Input | Action |
|-------|--------|
| Mouse Click | Select / play card, activate buttons |
| Mouse Drag | Move cards (Solitaire, FreeCell, Spider) |
| Hit / Stand buttons | Blackjack actions (clickable on canvas) |
| Bet / Fold / Call / Raise buttons | Poker / Hold'em actions (clickable on canvas) |
| Knock button | Gin Rummy / Schwimmen / Tonk knock action |
| SNAP! / SLAP! button | Snap / Egyptian Rat Screw reaction action |
| Swap / Swap All | Schwimmen card exchange actions |
| Draw button | Draw from stock (Crazy Eights, Mau-Mau) |
| Take / Done | Durak defender / attacker actions |
| Play / Pass | President / Sevens card play actions |
| Bid buttons | Bridge / Oh Hell bidding (clickable) |
| Drop button | Tonk -- drop to end round early |
| 1-7 | Play card from hand by position |
| H / S | Hit / Stand keyboard shortcut (Blackjack) |
| B / F / C / R | Bet / Fold / Call / Raise keyboard shortcut (Poker) |
| Spacebar | Egyptian Rat Screw -- quick slap |
| Ctrl+Z | Undo (Solitaire, FreeCell, Spider, Forty Thieves, Canfield) |
| F2 | New game / Return to menu |
| Escape | Pause / Resume |
| Menu button | Return to game selection (top-right corner) |
| Sort button | Toggle auto-sort for player's hand (top-right, when supported) |
| Style button | Open card style theme picker |

## Technical Details

- Canvas size: 900x600 pixels with DPR scaling
- Game loop uses requestAnimationFrame with delta-time capped at 50ms
- Variant modules loaded on demand via dynamic `<script>` injection and `SZ.CardGames.registerVariant()` callback
- Card engine accepts both named suits (`'spades'`) and unicode (`'\u2660'`) transparently
- All card rendering is procedural (no image assets for cards)
- Hit testing uses AABB rectangle checks with card-level precision
- localStorage keys prefixed with `sz-card-games-` for high scores, hints, auto-sort, and theme settings

## Architecture

- `index.html` -- Entry point with SEO meta, menu bar, canvas, status bar, dialogs
- `card-engine.js` -- Unified rendering engine: card face/back drawing (80x110 cards) with bezier suit symbols and pip layouts, variable-size support, rounded rectangles, buttons, hit testing, hint glow, deck creation, shuffle, animation system, particle effects, win animations, theme colors
- `card-themes.js` -- Customizable visual themes: 6 table backgrounds, multiple card back designs, card face templates (French/4-Color with gradient pips, German with gradient Bavarian shapes, Minimal flat), theme picker overlay with preview tiles, all persisted via localStorage
- `controller.js` -- Orchestrator: variant loading, category-grouped fieldset menu (7 categories, alphabetically sorted, auto-shrinking labels), hint/sort toggles, game lifecycle, host effects (deal animation, flip, glow, sparkle), postMessage bridge
- 72 variant files (`*-variant.js`) -- Each implements rules, AI, game flow, and rendering for one card game
- `styles.css` -- Layout and theming
- `icon.svg` -- Desktop icon (cards + chips)

### Planned Features
- [ ] As a player, I can select AI difficulty levels (easy, medium, hard) per variant so that I can adjust the challenge
- [ ] As a player, I can use drag-and-drop for all card games (not just solitaire) so that interaction is more intuitive
- [ ] As a player, I can hear sound effects for card dealing, flipping, and shuffling so that the games have audio feedback
- [ ] As a player, I can see animated card dealing with physics-based motion so that deals look more realistic
- [ ] As a player, I can view game statistics and win/loss records per variant so that I can track my progress across all games

## Known Limitations

- AI difficulty is fixed per variant; no adjustable difficulty levels
- Drag-and-drop is only available for solitaire variants; other games use click-to-select
- No multiplayer support; all opponents are AI-controlled
- Card engine renders procedurally; no photorealistic card images
- Some complex variants (Bridge bidding, Pinochle melds) use simplified rule sets compared to tournament play

## SEO Keywords

card games, poker, blackjack, baccarat, texas holdem, three card poker, faro, red dog, acey deucey, uno, uno flip, uno all wild, liars uno, uno extreme, uno party, dos, ono 99, 8-color duo, skip-bo, skat, canasta, doppelkopf, solitaire, freecell, spider solitaire, yukon, pyramid, golf solitaire, tripeaks, forty thieves, canfield, clock patience, bakers dozen, accordion solitaire, hearts, spades, euchre, pinochle, bridge, oh hell, whist, pitch, all fours, sixty-six, schnapsen, gin rummy, rummy 500, phase 10, tonk, rummy, kalooki, kaluki, yaniv, war, memory, go fish, old maid, snap, speed, cheat, egyptian rat screw, sevens, fan tan, spite and malice, beggar my neighbor, schwimmen, durak, briscola, scopa, cribbage, piquet, bezique, cassino, pishti, belote, president, browser card game, classic card games, AI card game, card game collection, hint mode, card themes, SynthelicZ, WebOS game, card animations
