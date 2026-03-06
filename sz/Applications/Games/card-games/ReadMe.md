# Card Games Suite

Card games collection featuring 69 game variants with AI opponents, hint mode, smooth card animations, and stunning visual effects — running inside the SynthelicZ Desktop WebOS.

## User Stories

- **S-070**: As a player, I want to choose from 69 card game variants so that I have variety in a single app.
- **S-071**: As a player, I want smooth card-deal animations, card-flip transitions, winning-hand glow effects, and chip sparkle particles so the games feel polished and satisfying.
- **S-072**: As a player, I want clickable buttons for all game actions (Hit/Stand, Bet/Fold/Call/Raise, Knock, SNAP!, etc.) so I can play entirely with the mouse.
- **S-073**: As a player, I want a "Back to Menu" option in both the menu bar and a canvas button so I can easily return to the game selection screen.
- **S-074**: As a player, I want Skip-Bo to use a two-step selection model (click card, then click destination) with discard piles so gameplay matches the real card game rules.
- [x] As a player, I want Uno to support house rules (stacking Draw Two/Wild Draw Four, jump-in on matching cards) so I can play with common variant rules.
- [x] As a player, I want Uno black wild cards to prompt a color choice dialog so I can pick which color continues play.
- [x] As a player, I want Skat to include a full bidding phase, proper role assignment (Declarer vs. Defenders), and accurate trick-based scoring so the game follows official Skat rules.
- [x] As a player, I want the standalone Solitaire, FreeCell, and Spider Solitaire apps removed from the desktop in favor of their card-games suite variants so there is a single unified card game collection.
- **S-000**: As the platform, all games integrate with the SZ Desktop via shared bootstrap, menu, dialog, and visual-effects libraries.

## Features

- **69 Game Variants**: Solitaire, FreeCell, Spider, Yukon, Pyramid, Golf, TriPeaks, Forty Thieves, Canfield, Clock, Baker's Dozen, Accordion, Poker, Blackjack, Baccarat, Texas Hold'em, Faro, Red Dog, Uno, Uno Flip, Uno All Wild, Liar's Uno, Uno Extreme, Uno Party, Dos, ONO 99, 8-Color Duo, Skip-Bo, Crazy Eights, Mau-Mau, President, Skat, Doppelkopf, Hearts, Spades, Euchre, Pinochle, Bridge, Oh Hell, Whist, Pitch, Sixty-Six, Canasta, Gin Rummy, Rummy 500, Phase 10, Tonk, Rummy, Kalooki, War, Memory, Go Fish, Old Maid, Snap, Speed, Cheat, Egyptian Rat Screw, Sevens, Spite & Malice, Beggar My Neighbor, Schwimmen, Durak, Briscola, Scopa, Cribbage, Piquet, Bezique, Cassino, Pishti (loaded as on-demand variant modules)
- **6-Column Menu**: Game selection screen displays all 69 variants in a 6-column grid layout
- **Hint Mode**: Toggleable golden glow on playable cards — works across all game types (shedding, trick-taking, solitaire, rummy, etc.). Persists via localStorage.
- **Mouse-Only Play**: All games have clickable canvas buttons — no keyboard required
- **Back to Menu**: Return to game selection via menu bar entry, canvas button, or F2
- **Unified Card Engine**: All 69 variants share `card-engine.js` for card rendering (procedural bezier suit symbols, proper pip layouts for 2-10, face card center artwork for J/Q/K, diamond-pattern card backs), hit testing, buttons, deck creation, shuffle, animations, hint glow, and particles — zero duplicated drawing code
- **Modular Variant Architecture**: All 69 variants are separate JS files loaded on demand via `SZ.CardGames.registerVariant()`, sharing the card engine
- **Drag-and-Drop**: Solitaire variants support full drag-and-drop card movement via pointermove/pointerup forwarding
- **Scalable Card Rendering**: Card engine supports variable card dimensions — variants can draw scaled cards (e.g., 0.55x for AI hands) with proportionally scaled pips, text, and borders
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
| Bet / Fold / Call / Raise buttons | Poker / Hold'em actions (clickable on canvas) |
| Knock button | Gin Rummy / Schwimmen / Tonk knock action |
| SNAP! / SLAP! button | Snap / Egyptian Rat Screw — click on matching patterns |
| Swap / Swap All | Schwimmen card exchange actions |
| Draw button | Draw from stock (Crazy Eights, Mau-Mau) |
| Take / Done | Durak defender / attacker actions |
| Play / Pass | President / Sevens card play actions |
| Bid buttons | Bridge / Oh Hell bidding (clickable) |
| Drop button | Tonk — drop to end round early |
| 1-7 | Play card from hand by position |
| H / S | Hit / Stand keyboard shortcut (Blackjack) |
| B / F / C / R | Bet / Fold / Call / Raise keyboard shortcut (Poker) |
| Spacebar | Egyptian Rat Screw — quick slap |
| Ctrl+Z | Undo (Solitaire, FreeCell, Spider, Forty Thieves, Canfield) |
| F2 | New game / Return to menu |
| Escape | Pause / Resume |
| ☰ Menu button | Return to game selection (top-right corner) |

## Game Variants

### Solitaire (12 games)

**Solitaire** — Classic Klondike solitaire. Drag-and-drop cards between tableau, waste, and foundations. Draw-1/Draw-3 modes, undo, auto-complete, win animation.

**FreeCell** — All-cards-face-up strategy game. Click-to-select or drag cards between 4 free cells, 4 foundations, and 8 tableau columns. Supermove support, undo, win animation.

**Spider Solitaire** — Build same-suit runs from King to Ace across 10 tableau columns. 1/2/4 suit difficulty modes. Drag-and-drop, undo, scoring, win animation.

**Yukon** — Klondike variant where ANY face-up card group can be moved regardless of sequence. No stock pile — all 52 cards visible from the start. Build to foundations by suit A-K.

**Pyramid** — Remove pairs of exposed cards that sum to 13 from a 28-card pyramid layout. Kings remove alone. Stock/waste cycle for additional cards.

**Golf** — Clear 7 columns of 5 cards by playing onto a waste pile. Cards must be ±1 in rank. Quick, addictive solitaire variant.

**TriPeaks** — Clear three overlapping peaks by playing exposed cards ±1 from the waste pile. Streak bonuses for consecutive plays without using stock.

**Forty Thieves** — 2-deck (104-card) solitaire with 10 tableau columns of 4 face-up cards each. Build down by suit on tableau, single card moves only. 8 foundation piles build up by suit A-K. One of the hardest solitaires (~10% win rate).

**Canfield** — 52-card solitaire with a 13-card reserve pile. Foundation starter rank determined by first card drawn. Build up by suit with wrapping (K→A→2...). Draw 3 from stock, alternating-color tableau builds.

**Clock** — Clock Patience/Travelers. Deal all 52 cards into 13 piles of 4 arranged as a clock face (12 positions + center). Flip cards and place by rank — purely luck-based with beautiful circular layout.

**Baker's Dozen** — 13 columns of 4 face-up cards. Kings auto-moved to column bottoms. Build down regardless of suit, no empty column fills. Build 4 foundations up by suit A-K. ~75% win rate.

**Accordion** — All 52 cards in a row. Move cards onto 1-left or 3-left positions if matching suit or rank. Compress entire deck into one pile to win. Very difficult ~2% win rate.

### Casino (6 games)

**Poker** — Five-card draw with betting rounds. Hand rankings from High Card to Royal Flush. Clickable Bet/Fold/Call/Raise buttons.

**Blackjack** — Hit or stand to get as close to 21 as possible without going bust. Ace counts as 1 or 11. Clickable Hit/Stand buttons.

**Baccarat** — Bet on Player, Banker, or Tie. 8-deck shoe with standard baccarat drawing rules. Natural 8/9 wins instantly. Banker pays 1:1 minus 5% commission, Tie pays 8:1.

**Texas Hold'em** — 4-player community card poker. 2 hole cards + 5 community cards (Flop/Turn/River). Betting rounds with Check/Bet/Call/Raise/Fold/All-In. Small/big blinds rotate. Best 5 of 7 hand ranking.

### Shedding (13 games)

**Uno** — Match cards by color or number. Special cards: Skip, Reverse, Draw Two, Wild, Wild Draw Four. House rules: stacking, No Mercy (+6/+10), Zero rotate, Seven swap, Jump-In.

**Uno Flip** — Double-sided cards with light and dark sides. Flip card reverses all cards globally. Light side: Skip, Reverse, Draw One. Dark side: Skip Everyone, Reverse, Draw Five. Wild Draw Color on dark side.

**Uno All Wild** — Every card is a wild action card. 112 cards with no color/number matching. Wild Draw Two, Wild Reverse, Wild Skip, Wild Forced Swap, Wild Targeted Draw Two, Wild Gap. Pure chaos.

**Liar's Uno** — Bluffing variant where players can play face-down and claim any color/value. Other players can challenge with "Liar!" — caught lying means picking up the discard pile; wrong accusation means drawing 4.

**Uno Extreme** — Random card launcher replaces manual drawing. Press the launcher when stuck — get 0-3 cards randomly. Extreme Hit cards target opponents to hit the launcher.

**Uno Party** — Large group variant with 6 players and 224-card double deck. Special Party Wilds: Everyone Draw, Trade Hands, Discard All, Pick Color.

**Dos** — Mattel's Uno sequel with dual discard piles and number matching. Play single cards or two-card combos that sum to a pile's number. Color match bonuses.

**ONO 99** — Elimination card game with a running total. Play cards that add to the total — bust at 99 and you're out. Special cards: Hold, Reverse, Double Play, Minus-10.

**8-Color Duo** — Custom shedding game with 8 colors (Red, Blue, Green, Yellow, Purple, Orange, Pink, Teal). 114 cards, match by color or number, 8-color wild choice overlay.

**Skip-Bo** — Sequential card game — build piles from 1 to 12. Two-step selection model with discard piles.

**Crazy Eights** — Match suit or rank of the discard pile. 8s are wild — play on anything and choose the new suit. Draw if stuck.

**Mau-Mau** — German shedding game with action cards: 7 = draw 2 (stackable), 8 = skip, Jack = wild suit choice, Ace = extra turn.

**President** — 4-player climbing game. Play 1-4 cards of same rank, higher than previous play. 2s are highest, 4-of-a-kind clears. First out = President, last = Scum. Card exchange between ranks in subsequent rounds.

### Trick-Taking (8 games)

**Skat** — German trick-taking game for 3 players. Full bidding phase with Declarer vs. Defenders and trick-based scoring.

**Doppelkopf** — German trick-taking game with two hidden teams determined by Queens of Clubs.

**Hearts** — 4-player trick-taking. Avoid hearts (1 point each) and Queen of Spades (13 points). Pass 3 cards each round. Shoot the moon for 0 points.

**Spades** — 4-player trick-taking with bidding. Spades always trump. Make your bid for 10× points. Bag penalties at 10 overtricks.

**Euchre** — 4-player (2v2 teams) trick-taking with trump selection. 24-card deck (9-A). Right and left bower system. First to 10 points wins.

**Pinochle** — 4-player (2v2) partnership game with melding + trick-taking. 48-card double deck. Bid for trump, declare melds for points, then play 12 tricks.

**Bridge** — 4-player partnership (NS vs EW) contract bidding and trick-taking. Sequential auction with level+strain bids. Declarer plays dummy's hand face-up. Simplified rubber bridge scoring with game/slam bonuses.

**Oh Hell** — 4-player trick-taking with variable hand sizes (1 up to 7 and back). Bid exact tricks — dealer restricted by "hook" rule. Score 10 + tricks bid for making exact bid.

### Rummy (5 games)

**Canasta** — Rummy-style game forming melds of 7 cards. Wild cards and red threes are bonus.

**Gin Rummy** — 2-player draw-and-discard. Form melds (sets of same rank, runs of same suit). Knock when deadwood ≤ 10, or go gin for bonus points.

**Rummy 500** — Classic draw-and-meld rummy for 3 players. Pick up from discard pile, lay down sets/runs, lay off on existing melds. First to 500 points wins.

**Phase 10** — Complete 10 specific phase objectives in order. 108 custom cards with Wilds and Skips. Phases include sets, runs, and color collections.

**Tonk** — Quick knock rummy for 3 players. 5-card hands with instant "Tonk!" win at 49-50 points. Spread melds (sets/runs), knock/drop to end rounds early. Double penalty for failed drops.

### Simple/Speed (9 games)

**War** — Flip cards simultaneously, highest wins. Ties trigger WAR: 3 face-down + 1 face-up. Win all 52 cards.

**Memory** — 24 cards (12 pairs) in a 6×4 grid, all face-down. Flip 2 per turn to find matching pairs.

**Go Fish** — Ask opponent for ranks you hold. "Go Fish!" if they don't have any. Collect books of 4-of-a-kind.

**Old Maid** — Remove one Queen, deal all cards. Discard pairs, draw from opponent. Don't get stuck with the unpaired Queen!

**Snap** — Cards flip automatically. Click "SNAP!" when consecutive cards match ranks. Fastest reaction wins the pile.

**Speed** — 2-player simultaneous card race. Play cards ±1 from center piles. AI opponent plays on a timer. First to empty hand wins.

**Cheat (BS)** — 4-player bluffing game. Play 1-4 cards face-down claiming a specific rank. Other players can call "Cheat!" — wrong claims pick up the pile.

**Egyptian Rat Screw** — 4-player speed/reaction game. Flip cards to center pile. Slap on doubles, sandwiches, or top-bottom matches. Face card challenges (A=4, K=3, Q=2, J=1 chances). False slaps penalized.

**Sevens (Fan Tan)** — 4-player placement game. Build suit rows outward from 7s — play 6,5,4,3,2,A left or 8,9,10,J,Q,K right. Strategic blocking. First to empty hand wins.

### European (5 games)

**Schwimmen (31)** — German pub game for 4 players. Exchange cards from a center pool to get 31 in one suit or 3-of-a-kind. Knock to trigger final round. Lose lives when you have the lowest hand.

**Durak** — Russian attack/defense game. Attacker plays cards, defender must beat with higher same-suit or trump. Undefended cards are picked up. Last player holding cards is the Durak (fool).

**Briscola** — Italian 2-player trump trick-taking game. 40-card deck (no 8s, 9s, 10s). No requirement to follow suit. Card values: A=11, 3=10, K=4, Q=3, J=2. Score 61+ of 120 total points to win.

**Scopa** — Italian 2-player fishing game. Play cards to capture table cards by matching value sums. Score for most cards, most diamonds, 7 of diamonds (Sette Bello), best Primiera, and scopas (clearing the table).

**Cribbage** — 2-player pegging board game. Discard to crib, peg points during play (15s, 31s, pairs, runs), then score hands. Fifteens, pairs, runs, flushes, and nobs. First to 121 on the pegging board wins.

## Architecture

- `index.html` — Entry point with SEO meta, menu bar, canvas, status bar, dialogs
- `card-engine.js` — Unified rendering engine used by all 69 variants: card face/back drawing with bezier suit symbols and pip layouts, variable-size card support, rounded rectangles, buttons, hit testing, hint glow, deck creation (standard and custom rank sets), shuffle, animation system, particle effects, win animations, theme colors. Accepts both named suits (`'spades'`) and unicode (`'\u2660'`) transparently.
- `controller.js` — Pure orchestrator: variant loading, 5-column menu, hint toggle with persistence, game lifecycle, host effects (deal animation, flip, glow, sparkle), postMessage bridge. Delegates all card drawing to card-engine.js.
- `blackjack-variant.js` — Blackjack variant module
- `poker-variant.js` — Poker variant module
- `baccarat-variant.js` — Baccarat casino variant module
- `holdem-variant.js` — Texas Hold'em community card poker variant module
- `uno-variant.js` — Uno variant module (with house rules: No Mercy, Zero, Seven, Jump-In)
- `unoflip-variant.js` — Uno Flip variant module (double-sided light/dark cards)
- `unowild-variant.js` — Uno All Wild variant module (all wild action cards)
- `liarsuno-variant.js` — Liar's Uno variant module (bluffing and challenges)
- `unoextreme-variant.js` — Uno Extreme variant module (random launcher draws)
- `unoparty-variant.js` — Uno Party variant module (6 players, party wilds)
- `dos-variant.js` — Dos variant module (dual piles, number matching)
- `ono99-variant.js` — ONO 99 variant module (running total, elimination)
- `duo-variant.js` — 8-Color Duo variant module (8-color shedding)
- `skipbo-variant.js` — Skip-Bo variant module
- `president-variant.js` — President (Scum) climbing/shedding variant module
- `skat-variant.js` — Skat variant module
- `canasta-variant.js` — Canasta variant module
- `doppelkopf-variant.js` — Doppelkopf variant module
- `solitaire-variant.js` — Klondike solitaire variant module
- `freecell-variant.js` — FreeCell variant module
- `spider-variant.js` — Spider Solitaire variant module
- `yukon-variant.js` — Yukon solitaire variant module
- `pyramid-variant.js` — Pyramid solitaire variant module
- `golf-variant.js` — Golf solitaire variant module
- `tripeaks-variant.js` — TriPeaks solitaire variant module
- `fortythieves-variant.js` — Forty Thieves 2-deck solitaire variant module
- `canfield-variant.js` — Canfield solitaire variant module
- `hearts-variant.js` — Hearts trick-taking variant module
- `spades-variant.js` — Spades trick-taking variant module
- `euchre-variant.js` — Euchre trick-taking variant module
- `pinochle-variant.js` — Pinochle melds + trick-taking variant module
- `bridge-variant.js` — Contract Bridge partnership bidding + trick-taking variant module
- `ohhell-variant.js` — Oh Hell variable-hand trick-taking variant module
- `crazy-eights-variant.js` — Crazy Eights shedding variant module
- `maumau-variant.js` — Mau-Mau shedding variant module
- `ginrummy-variant.js` — Gin Rummy variant module
- `rummy500-variant.js` — Rummy 500 variant module
- `phase10-variant.js` — Phase 10 variant module
- `tonk-variant.js` — Tonk quick knock rummy variant module
- `war-variant.js` — War simple card game variant module
- `memory-variant.js` — Memory matching variant module
- `gofish-variant.js` — Go Fish variant module
- `oldmaid-variant.js` — Old Maid variant module
- `snap-variant.js` — Snap reaction game variant module
- `speed-variant.js` — Speed simultaneous card race variant module
- `cheat-variant.js` — Cheat (BS) bluffing variant module
- `ratscrew-variant.js` — Egyptian Rat Screw speed/slap variant module
- `sevens-variant.js` — Sevens (Fan Tan) placement variant module
- `schwimmen-variant.js` — Schwimmen (31) variant module
- `durak-variant.js` — Durak variant module
- `briscola-variant.js` — Briscola Italian trump trick-taking variant module
- `scopa-variant.js` — Scopa Italian fishing variant module
- `cribbage-variant.js` — Cribbage pegging board scoring variant module
- `styles.css` — Layout and theming
- `icon.svg` — Desktop icon (cards + chips)

## SEO Keywords

card games, poker, blackjack, baccarat, texas holdem, uno, uno flip, uno all wild, liars uno, uno extreme, uno party, dos, ono 99, 8-color duo, skip-bo, skat, canasta, doppelkopf, solitaire, freecell, spider solitaire, yukon, pyramid, golf solitaire, tripeaks, forty thieves, canfield, hearts, spades, euchre, pinochle, bridge, oh hell, gin rummy, rummy 500, phase 10, tonk, war, memory, go fish, old maid, snap, speed, cheat, egyptian rat screw, sevens, fan tan, schwimmen, durak, briscola, scopa, cribbage, president, browser card game, classic card games, AI card game, card game collection, hint mode, SynthelicZ, WebOS game, card animations
