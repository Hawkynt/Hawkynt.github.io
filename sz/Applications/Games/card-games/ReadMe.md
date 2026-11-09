# Card Games Suite

A collection of 72 card game variants with AI opponents on one living card table: illustrated cards that glide, flip and fly in when dealt, a lobby with a featured game of the day, cinematics, and a player profile with levels, trophies and earnable tables and card backs. Everything runs inside the »SynthelicZ« Desktop WebOS and keeps the rules of every game untouched -- the motivation layer only celebrates, it never changes what a card does.

## How It Works

The suite is one engine plus 72 variant modules. The engine under `js/engine/` paints every card once into a sprite cache (paper texture, corner indices, pip layouts, ornate aces and double-headed court portraits; coloured action cards for the Uno-style games) and draws a frame as a few `drawImage` calls. Because variants draw cards by object, the engine's motion layer notices when the same card is drawn somewhere new and lets it glide there, lifted and tilted above the table; a card that appears where a card back lay flips over; a fresh deal flies in from the deck. Variants keep hit-testing their real positions, so no rule or AI code had to change.

The table fills the whole window: the 900x600 board is letterboxed and the felt, wood or stone surface bleeds into the bars at any aspect ratio; pointer positions are mapped back into board space after every resize. The suite's own layer adds a lobby, title cards, victory and defeat scenes, a level-up medallion, toasts, pooled particles (sparks, coins, confetti, dust, suit stars) without any per-frame blur, and banners for the variants' floating texts.

Results are noticed without touching the variants: from the host's round-over callback, from explicit win/lose banners and from result texts a variant paints. Each finished round is recorded once in the local profile (experience, per-game statistics, win and day streaks); levels, achievements and seasons unlock extra tables and card backs.

Each variant lives in its own folder, split by concern (state, rules, flow, AI, render, input, index) with one explicit state object, plus shared family helpers in `js/variants/common/`. A seeded golden-master test per variant proved the split behaviour-identical.

## User Stories

### Lobby
- [x] As a player, I can browse the 72 games by category tabs (with a count of how many I have conquered), my favourites and my recently played games
- [x] As a player, I can see each game as a tile with a painted miniature, my wins and plays, my best streak, a crown once I have won it and a NEW ribbon until I try it
- [x] As a player, I can star any game as a favourite
- [x] As a player, I can play the featured game of the day for double experience
- [x] As a player, I can return to the lobby via the table's Lobby button, the menu bar or F2

### Progress and Rewards (local only)
- [x] As a player, I earn experience for every finished round, more for wins, first wins, new games, win streaks and daily play, and level up with a medallion cinematic
- [x] As a player, I can collect 33 trophies (wins, variety, streaks, days in a row, categories, time of day) in the trophy cabinet
- [x] As a player, I can unlock 9 extra tables and 17 extra card backs by levels, trophies, the season I play in (winter, spring, summer, autumn) and short events (Yuletide, All Hallows, Sweethearts, Midsummer)
- [x] As a player, I can review my statistics: rounds, wins, win rate, streaks, days played, per-category records and most played games
- [x] As a player, I can keep my progress across sessions in this browser; nothing leaves the machine

### Cinematics and Feel
- [x] As a player, I see a short intro once a day: a riffle shuffle, a fan of royal cards and the gold title (any click or key skips it)
- [x] As a player, I see a title card with the game's emblem, name and tagline when a game starts, then the cards fly in from the deck
- [x] As a player, I see cards glide when they move, lift and tilt in flight, flip over when revealed and land with a little felt dust
- [x] As a player, I see a victory scene with light rays, confetti and an experience tally, a gentle defeat scene, and a compact banner after each round of multi-round games
- [x] As a player, I see big win/lose messages of the games as banners with a glow plate and sparkles, and coins burst when I win chips
- [x] As a player, I can turn card motion or card shadows off in Table & Cards

### Hint System
- [x] As a player, I can toggle hint mode to highlight playable cards with a golden glow effect
- [x] As a player, I can see hints work across all game types: solitaire moves, shedding matches, trick-taking legal plays, rummy melds
- [x] As a player, I can have my hint mode state persist via localStorage across sessions

### Auto-Sort Hand
- [x] As a player, I can toggle auto-sort to keep my hand sorted by suit and rank (or color and value for Uno-style games)
- [x] As a player, I can see auto-sort as a togglable canvas button for the 42+ variants that support hand sorting
- [x] As a player, I can have my auto-sort preference persist via localStorage

### Table & Cards
- [x] As a player, I can choose from 15 tables (6 free, 9 earnable) painted as felt with a printed table line, oak and mahogany planks, or marble and onyx
- [x] As a player, I can choose from 22 card backs (5 free, 17 earnable) with a framed pattern and centre medallion, or a back in a custom colour
- [x] As a player, I can choose from 4 card face styles (French, 4-Color, German with U/O/D, Minimal) shown as live previews
- [x] As a player, I can see locked items with the way to earn them
- [x] As a player, I can open Table & Cards from the lobby or the table's Style button; all choices persist via localStorage

### Mouse-Only Play
- [x] As a player, I can use clickable canvas buttons for every game action in all 72 games (Hit/Stand, Bet/Fold/Call/Raise, Knock, SNAP!, etc.)
- [x] As a player, I can play any variant without a keyboard since all interactions work via pointer/click

### Card Rendering Engine
- [x] As a player, I can see cards with paper texture, crisp corner indices, standard pip layouts, an ornate ace of spades and double-headed king, queen and jack portraits (crowns, ruffs, robes, sword, flower and halberd)
- [x] As a player, I can see coloured action cards (Uno family, Dos, 8-Color Duo, ONO 99, Skip-Bo) with a glossy field, the tilted white oval, four-colour wild ovals and corner indices
- [x] As a player, I can see soft shadows under every card and cards at any size stay sharp on high-DPI screens
- [x] As a player, I can click cards with pixel-accurate hit testing on the real card positions

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
- [x] As a player, I can play every Uno-style round out for the places: finished players leave the turn order, the others play on (faster once I am out) until the top three are decided, and a Siegertreppchen cinematic shows gold, silver and bronze with podium experience for 2nd and 3rd
- [x] As a player, I can play Dos with dual discard piles, single or two-card combo number matching, and color match bonuses
- [x] As a player, I can play ONO 99 with a running total, busting at 99, and special cards (Hold, Reverse, Double Play, Minus-10)
- [x] As a player, I can play 8-Color Duo with 8 colors (Red, Blue, Green, Yellow, Purple, Orange, Pink, Teal), 114 cards, and 8-color wild choice overlay
- [x] As a player, I can play Skip-Bo building sequential piles 1-12 with two-step selection model and discard piles
- [x] As a player, I can play Crazy Eights matching suit or rank, with 8s as wild and suit choice, and draw-if-stuck
- [x] As a player, I can play Mau-Mau (German shedding) with action cards: 7=draw 2 (stackable), 8=skip, Jack=wild suit, Ace=extra turn
- [x] As a player, I can play President (4 players) shedding by playing higher-ranked cards, with 2s highest, 4-of-a-kind clears, and President/Scum ranking with card exchange

### Trick-Taking Games (11)
- [x] As a player, I can play Skat (3 players) with full bidding phase, Declarer vs. Defenders roles, and trick-based scoring
- [x] As a player, I can play Doppelkopf (4 players, 48 cards) with the full trump order (both Dullen), hidden Re and Kontra teams found by the Queens of Clubs, a silent solo, 121-point wins, 90/60/30/schwarz and extra points (Fuchs, Karlchen, Doppelkopf) over an 8-round match
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
| Lobby button | Return to the lobby (top-right corner) |
| Arrow Up / Down | Lobby: switch category tab |
| Any click or key | Skip the intro, a title card or a result scene |
| Sort button | Toggle auto-sort for player's hand (top-right, when supported) |
| Style button | Open Table & Cards (tables, backs, faces, motion and shadow options) |

## Technical Details

- Board: 900x600 logical units letterboxed into the full window with DPR scaling; the table bleeds into the bars
- Game loop uses requestAnimationFrame with delta-time capped at 50ms
- Variant modules loaded on demand via dynamic `<script>` injection and `SZ.CardGames.registerVariant()` callback
- Card engine accepts both named suits (`'spades'`) and unicode (`'\u2660'`) transparently
- All card rendering is procedural (no image assets for cards)
- Hit testing uses AABB rectangle checks with card-level precision
- localStorage keys prefixed with `sz-card-games-` for high scores, hints, auto-sort, theme settings, card motion options and the player profile
- Cards, backs, shadows, tables and lobby miniatures are painted once into cached canvases; a frame draws in about 1 ms in every variant

## Architecture

Plain browser JavaScript, IIFE modules on `SZ.CardEngine`, `SZ.CardThemes` and `SZ.CardGames`, loaded in dependency order by `index.html` (no build step).

- `index.html` -- entry point with SEO meta, menu bar, canvas, status bar, dialogs and the script list
- `js/engine/` -- the card engine shared by all variants
  - `core.js` -- suits, ranks, card metrics, pip layouts, deck creation and shuffle
  - `draw.js` -- rounded rectangles, suit symbols, empty slots, selection and hint glows, glossy hover buttons
  - `fx.js` -- the variants' particle helpers (cached glow sprites, no blur) and the solitaire win cascade
  - `card-art.js` -- card face artwork: paper, indices, pips, ornate aces, double-headed court portraits
  - `motion.js` -- automatic card motion by object identity: glides, flips, pops and the deal fly-in
  - `sprites.js` -- the sprite cache for faces, backs and shadows and the public `drawCardFace` / `drawCardBack` / `drawCard` / `drawSpriteCard`
  - `color-cards.js` -- the coloured action cards of the Uno-style games
- `js/themes/` -- `state.js` (active theme, persistence), `table-themes.js` (15 cached tables), `card-backs.js` (22 framed back designs), `card-faces.js` (French, 4-Color, German, Minimal suit painters), `shimmer.js` (sweep and pulse highlights), `settings.js` (the Table & Cards panel with previews and locks)
- `js/core/` -- `namespace.js`, `constants.js` (board size, states, storage keys, the 72-variant catalogue and categories), `state.js` (the one shared state object), `dom.js` (full-window canvas, letterboxed board, pointer mapping), `effects.js` (particles, shake, floating texts and their sounds), `animations.js` (host deal flights and glows), `variants.js` (registry and on-demand loading), `host.js` (the object handed to every variant), `game.js` (game start, title cards, reset, AI tick), `os.js` (window title and resize)
- `js/stage/` -- the suite's own presentation: `paint.js` (gold text, panels, ribbons, bars, rays, category emblems), `fx.js` (pooled sparks, coins, confetti, dust and rings), `floaters.js` (popping texts and banners), `scenes.js` (intro, title card, victory/defeat, level-up, toasts)
- `js/meta/` -- `profile.js` (experience, levels, per-game statistics, streaks, daily featured game, seasons and unlocks in localStorage), `achievements.js` (33 trophies), `outcomes.js` (notices round results and starts the scenes)
- `js/ui/` -- `lobby.js` (tabs, featured game, tiles), `screens.js` (trophy cabinet, statistics), `status.js` (status bar, high scores), `input.js` (board-space pointer and keyboard routing), `draw.js` (frame composition and overlays), `menu.js` (menu-bar actions)
- `js/variants/<id>/` -- one folder per game, split by concern: `state.js` (constants and the one state object on `SZ.CardGames.v.<id>`), `rules.js`, `flow.js` / `game.js` (dealing, turns, round end), `ai.js`, `layout.js` / `anim.js` (solitaires), `render.js`, `input.js`, and `index.js` (the module object and `registerVariant`)
- `js/variants/common/` -- family helpers: solitaire fallback drawing, casino chips, quick-game piles and hands, shedding hand sorting and drawing, trick-taking rules and paint, rummy cards and melds, European card and layout helpers
- `js/app.js` -- loaded last: the frame loop, profile events and start-up
- `tests/` -- `podium.test.js` drives all six Uno-style games seat by seat and checks the finishing order, skipped finishers and the single podium per round; `harness.js` replays the real script list in a sandboxed browser stub and streams every observable effect into a digest; `boot.test.js` pins a lobby-to-table session; `variants.test.js` pins a seeded session per variant (`variants-baseline.json`); `doppelkopf.test.js` checks the Doppelkopf rules
- `styles.css`, `icon.svg` -- layout and desktop icon

### Planned Features
- [ ] As a player, I can select AI difficulty levels (easy, medium, hard) per variant so that I can adjust the challenge
- [ ] As a player, I can use drag-and-drop for all card games (not just solitaire) so that interaction is more intuitive

## Known Limitations

- AI difficulty is fixed per variant; no adjustable difficulty levels
- Drag-and-drop is only available for solitaire variants; other games use click-to-select
- No multiplayer support; all opponents are AI-controlled
- Card engine renders procedurally; no photorealistic card images
- Doppelkopf plays the normal game only: no announcements, no Hochzeit and no chosen solos
- Some complex variants (Bridge bidding, Pinochle melds) use simplified rule sets compared to tournament play

## 🏆 Goals, mastery and story

Through the shared `SZ.GameGoals` and `SZ.GameStory` (wired in `js/core/meta.js`, saved under `sz-goals-card-games` and `sz-story-card-games`), on top of the profile's levels and unlocks:

- [x] As a player, I master each of the seven families of games by winning every game in it once, and the collection by winning all 72; 19 achievements (wins, rounds, games won, family mastery, the streak, quests, festivals) pay XP
- [x] As a player, I get three daily quests (including winning a game I have never won) and festival tracks during the six real-date festivals, paying XP and festival felts
- [x] As a player, I can earn 11 felt tables that join the Table & Cards panel (locked there until earned) and lay them on the table from the Goals panel
- [x] As a player, I meet the regulars of the Gilded Ace card room - Madame Lune, Old Pete, Lucky Lou and Countess Sable - in a welcome on the first deal, a word at the first game of every family and a finale once every family is mastered; every scene can be watched again under Game > Goals, Mastery and Story

## 🎵 Soundtrack

The soundtrack comes from the shared `SZ.GameMusic` engine: a theme per family of games (a calm ambient for patience games, a smooth house groove at the casino tables, a bouncy chiptune for shedding games, a thoughtful synthwave for trick-taking, an easy funk for rummy, a quick electro for snap and speed games, an epic dance for the European classics) and a cosy menu theme in the lobby. Each theme is arranged by the shared engine into an endless song (intro, groove, build-up, drop, breakdown, every pass a little different); every game in a family plays a song of its own made from the family's theme. A finished round lifts the music for a moment. The theme logic lives in `js/core/music.js`; Game > Music On/Off switches it (shared by every game).

## SEO Keywords

card games, poker, blackjack, baccarat, texas holdem, three card poker, faro, red dog, acey deucey, uno, uno flip, uno all wild, liars uno, uno extreme, uno party, dos, ono 99, 8-color duo, skip-bo, skat, canasta, doppelkopf, solitaire, freecell, spider solitaire, yukon, pyramid, golf solitaire, tripeaks, forty thieves, canfield, clock patience, bakers dozen, accordion solitaire, hearts, spades, euchre, pinochle, bridge, oh hell, whist, pitch, all fours, sixty-six, schnapsen, gin rummy, rummy 500, phase 10, tonk, rummy, kalooki, kaluki, yaniv, war, memory, go fish, old maid, snap, speed, cheat, egyptian rat screw, sevens, fan tan, spite and malice, beggar my neighbor, schwimmen, durak, briscola, scopa, cribbage, piquet, bezique, cassino, pishti, belote, president, browser card game, classic card games, AI card game, card game collection, hint mode, card themes, SynthelicZ, WebOS game, card animations
