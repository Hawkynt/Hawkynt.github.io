;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const SIXTYSIX_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];

  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

  /* Trick-taking strength (high to low): A, 10, K, Q, J, 9 */
  const RANK_STRENGTH = { 'A': 6, '10': 5, 'K': 4, 'Q': 3, 'J': 2, '9': 1 };

  /* Point values */
  const RANK_POINTS = { 'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0 };

  const TOTAL_CARD_POINTS = 120;
  const TARGET_POINTS = 66;
  const HAND_LIMIT = 6;
  const MATCH_TARGET = 7;

  /* Marriage values */
  const MARRIAGE_NORMAL = 20;
  const MARRIAGE_TRUMP = 40;

  /* Phases */
  const PHASE_PLAY = 0;
  const PHASE_TRICK_DONE = 1;
  const PHASE_ROUND_OVER = 2;

  const TRICK_DONE_DELAY = 1.2;
  const AI_TURN_DELAY = 0.8;

  /* Close button layout */
  const CLOSE_BTN = { x: 20, y: 420, w: 80, h: 30 };

  /* Marriage button layout */
  const MARRIAGE_BTN = { x: 20, y: 460, w: 100, h: 30 };

  /* ================================================================
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let stock = [];
  let trumpCard = null;
  let trumpSuit = '';

  let trickCards = [];
  let trickPlayers = [];
  let playerCaptured = [];
  let aiCaptured = [];
  let playerTrickPoints = 0;
  let aiTrickPoints = 0;
  let playerTricksTaken = 0;
  let aiTricksTaken = 0;
  let trickCount = 0;

  let currentTurn = 0;       // 0=player, 1=ai
  let trickLeader = 0;
  let phase = PHASE_PLAY;
  let trickWinner = -1;
  let trickDoneTimer = 0;

  let stockClosed = false;
  let closedBy = -1;         // who closed the stock (-1 = nobody)
  let stockClosedPointsAtClose = [0, 0]; // points when stock was closed

  let playerGamePoints = 0;
  let aiGamePoints = 0;
  let score = 0;

  let roundOver = false;
  let gameOver = false;
  let matchOver = false;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  let hoverCardIdx = -1;

  /* Marriage declaration state */
  let marriagePending = false;      // player can declare a marriage this turn
  let marriageSuit = '';             // suit of pending marriage
  let marriageShownTimer = 0;       // visual feedback timer
  let marriageShownSuit = '';       // suit being shown
  let marriageShownBy = -1;         // who declared it
  let aiDeclaredMarriage = false;   // flag for AI marriage declaration this turn

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardStrength(card) {
    return RANK_STRENGTH[card.rank] || 0;
  }

  function cardPoints(card) {
    return RANK_POINTS[card.rank] || 0;
  }

  function isTrump(card) {
    return card.suit === trumpSuit;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      if (a.suit === trumpSuit && b.suit !== trumpSuit) return 1;
      if (b.suit === trumpSuit && a.suit !== trumpSuit) return -1;
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  function isStockOpen() {
    return stock.length > 0 && !stockClosed;
  }

  function isStrictPlay() {
    return !isStockOpen();
  }

  /* ================================================================
     MARRIAGE DETECTION
     ================================================================ */

  function findMarriages(hand) {
    const marriages = [];
    for (const suit of CE.SUITS) {
      const hasK = hand.some(c => c.rank === 'K' && c.suit === suit);
      const hasQ = hand.some(c => c.rank === 'Q' && c.suit === suit);
      if (hasK && hasQ)
        marriages.push(suit);
    }
    return marriages;
  }

  function marriageValue(suit) {
    return suit === trumpSuit ? MARRIAGE_TRUMP : MARRIAGE_NORMAL;
  }

  /* ================================================================
     LEGAL MOVES (Phase 2 / closed stock)
     ================================================================ */

  function getLegalCards(hand, leadCard) {
    if (!leadCard) return hand.map((_, i) => i);

    /* Phase 1 (stock open): any card is legal */
    if (isStockOpen())
      return hand.map((_, i) => i);

    /* Phase 2 / closed: must follow suit, must head the trick, must trump if void */
    const leadSuit = leadCard.suit;
    const leadStr = cardStrength(leadCard);

    /* Cards of the led suit */
    const sameSuit = [];
    const sameSuitHigher = [];
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].suit === leadSuit) {
        sameSuit.push(i);
        if (cardStrength(hand[i]) > leadStr)
          sameSuitHigher.push(i);
      }
    }

    /* Must follow suit and play higher if possible */
    if (sameSuitHigher.length > 0) return sameSuitHigher;
    if (sameSuit.length > 0) return sameSuit;

    /* Void in led suit: must trump if possible */
    const trumpCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (isTrump(hand[i]))
        trumpCards.push(i);

    if (trumpCards.length > 0) return trumpCards;

    /* No suit, no trump: any card */
    return hand.map((_, i) => i);
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    if (trickCards.length < 2) return -1;
    const leadCard = trickCards[0];
    const followCard = trickCards[1];
    const leadSuit = leadCard.suit;

    if (isTrump(followCard) && !isTrump(leadCard))
      return trickPlayers[1];

    if (isTrump(leadCard) && !isTrump(followCard))
      return trickPlayers[0];

    if (followCard.suit === leadSuit)
      return cardStrength(followCard) > cardStrength(leadCard) ? trickPlayers[1] : trickPlayers[0];

    if (isTrump(leadCard) && isTrump(followCard))
      return cardStrength(followCard) > cardStrength(leadCard) ? trickPlayers[1] : trickPlayers[0];

    return trickPlayers[0];
  }

  function trickPointValue() {
    let pts = 0;
    for (const c of trickCards)
      pts += cardPoints(c);
    return pts;
  }

  /* ================================================================
     HINT LOGIC
     ================================================================ */

  function getHintIndices() {
    if (trickCards.length === 0) {
      /* Leading: all cards are playable */
      return playerHand.map((_, i) => i);
    }
    return getLegalCards(playerHand, trickCards[0]);
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChooseCard() {
    const hand = aiHand;
    if (hand.length === 0) return -1;
    if (hand.length === 1) return 0;

    const isLeading = trickCards.length === 0;
    const legal = isLeading ? hand.map((_, i) => i) : getLegalCards(hand, trickCards[0]);

    if (legal.length === 1) return legal[0];

    if (isLeading) {
      /* Lead: prefer low-value non-trump. In strict play, lead aces of long suits */
      if (isStrictPlay()) {
        for (const i of legal)
          if (hand[i].rank === 'A' && !isTrump(hand[i])) return i;
      }
      let bestIdx = legal[0];
      let bestScore = 999;
      for (const i of legal) {
        const c = hand[i];
        const val = cardPoints(c) * 20 + cardStrength(c) + (isTrump(c) ? 100 : 0);
        if (val < bestScore) {
          bestScore = val;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    /* Following */
    const leadCard = trickCards[0];
    const leadPts = cardPoints(leadCard);

    /* If trick is worthless, dump lowest */
    if (leadPts === 0) {
      let bestIdx = legal[0];
      let bestVal = 999;
      for (const i of legal) {
        const c = hand[i];
        const val = cardPoints(c) * 20 + cardStrength(c) + (isTrump(c) ? 200 : 0);
        if (val < bestVal) {
          bestVal = val;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    /* Try to win cheaply */
    let winnerIdx = -1;
    let winnerCost = 999;
    for (const i of legal) {
      const c = hand[i];
      if (!canBeatLeadWith(c, leadCard)) continue;
      const cost = cardPoints(c) * 20 + cardStrength(c) + (isTrump(c) ? 50 : 0);
      if (cost < winnerCost) {
        winnerCost = cost;
        winnerIdx = i;
      }
    }

    if (winnerIdx >= 0 && (leadPts >= 3 || winnerCost < 60))
      return winnerIdx;

    /* Cannot or should not win -- play lowest */
    let lowestIdx = legal[0];
    let lowestVal = 999;
    for (const i of legal) {
      const c = hand[i];
      const val = cardPoints(c) * 20 + cardStrength(c) + (isTrump(c) ? 200 : 0);
      if (val < lowestVal) {
        lowestVal = val;
        lowestIdx = i;
      }
    }
    return lowestIdx;
  }

  function canBeatLeadWith(card, leadCard) {
    if (isTrump(card) && !isTrump(leadCard)) return true;
    if (card.suit === leadCard.suit && cardStrength(card) > cardStrength(leadCard)) return true;
    if (isTrump(card) && isTrump(leadCard) && cardStrength(card) > cardStrength(leadCard)) return true;
    return false;
  }

  /* AI: should we close the stock? */
  function aiShouldClose() {
    if (stockClosed || stock.length === 0) return false;

    /* Estimate hand strength */
    let handPts = aiTrickPoints;
    let trumpCount = 0;
    let highCards = 0;
    for (const c of aiHand) {
      handPts += cardPoints(c);
      if (isTrump(c)) ++trumpCount;
      if (cardStrength(c) >= 5) ++highCards; // 10 or A
    }

    /* Close if we likely have 66+ points with our hand */
    if (handPts >= TARGET_POINTS && trumpCount >= 2) return true;
    if (handPts >= TARGET_POINTS + 10 && highCards >= 2) return true;
    return false;
  }

  /* AI: should we declare a marriage? */
  function aiCheckMarriage() {
    if (trickCards.length > 0) return null; // must be leading
    const marriages = findMarriages(aiHand);
    if (marriages.length === 0) return null;

    /* Prefer trump marriage, then highest value */
    for (const suit of marriages)
      if (suit === trumpSuit) return suit;
    return marriages[0];
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, SIXTYSIX_RANKS));
    stock = d;
    playerHand = [];
    aiHand = [];
    playerCaptured = [];
    aiCaptured = [];
    playerTrickPoints = 0;
    aiTrickPoints = 0;
    playerTricksTaken = 0;
    aiTricksTaken = 0;
    trickCards = [];
    trickPlayers = [];
    trickCount = 0;
    trickWinner = -1;
    trickDoneTimer = 0;
    aiTurnTimer = 0;
    hoverCardIdx = -1;
    roundOver = false;
    stockClosed = false;
    closedBy = -1;
    stockClosedPointsAtClose = [0, 0];
    marriagePending = false;
    marriageSuit = '';
    marriageShownTimer = 0;
    marriageShownSuit = '';
    marriageShownBy = -1;
    aiDeclaredMarriage = false;
    phase = PHASE_PLAY;

    /* Trump card is the bottom of the stock, shown face-up */
    trumpCard = stock[0];
    trumpCard.faceUp = true;
    trumpSuit = trumpCard.suit;

    /* Deal 6 cards each */
    for (let i = 0; i < HAND_LIMIT; ++i) {
      playerHand.push(stock.pop());
      aiHand.push(stock.pop());
    }

    for (const c of playerHand) c.faceUp = true;
    sortHand(playerHand);
    sortHand(aiHand);

    /* Non-dealer leads (player leads first round) */
    currentTurn = 0;
    trickLeader = 0;

    checkPlayerMarriage();

    if (_host)
      for (let i = 0; i < playerHand.length; ++i)
        _host.dealCardAnim(playerHand[i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, playerHand.length), playerCardY(), i * 0.08);
  }

  function setupSixtySix() {
    roundOver = false;
    gameOver = false;
    matchOver = false;
    dealRound();
  }

  /* ================================================================
     MARRIAGE MANAGEMENT
     ================================================================ */

  function checkPlayerMarriage() {
    if (currentTurn !== 0 || trickCards.length > 0) {
      marriagePending = false;
      marriageSuit = '';
      return;
    }
    const marriages = findMarriages(playerHand);
    if (marriages.length > 0) {
      marriagePending = true;
      /* Prefer trump marriage */
      marriageSuit = marriages.includes(trumpSuit) ? trumpSuit : marriages[0];
    } else {
      marriagePending = false;
      marriageSuit = '';
    }
  }

  function declareMarriage(who, suit) {
    const pts = marriageValue(suit);
    if (who === 0) {
      playerTrickPoints += pts;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 350, 'Marriage! +' + pts, { color: '#ff0', size: 20 });
    } else {
      aiTrickPoints += pts;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, 'AI Marriage! +' + pts, { color: '#fa0', size: 20 });
    }
    marriageShownTimer = 2.0;
    marriageShownSuit = suit;
    marriageShownBy = who;

    /* Check if declaring player reached 66 */
    checkReach66(who);
  }

  function checkReach66(who) {
    const pts = who === 0 ? playerTrickPoints : aiTrickPoints;
    if (pts >= TARGET_POINTS) {
      /* Immediate win declaration -- end the round */
      endRound(who);
    }
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(who, cardIdx) {
    const hand = who === 0 ? playerHand : aiHand;
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;

    trickCards.push(card);
    trickPlayers.push(who);

    if (trickCards.length >= 2) {
      phase = PHASE_TRICK_DONE;
      trickWinner = resolveTrickWinner();
      trickDoneTimer = 0;
      return;
    }

    /* Next player's turn */
    currentTurn = 1 - currentTurn;
  }

  function finishTrick() {
    const pts = trickPointValue();

    if (trickWinner === 0) {
      playerTrickPoints += pts;
      ++playerTricksTaken;
      for (const c of trickCards) playerCaptured.push(c);
      if (_host && pts > 0)
        _host.floatingText.add(CANVAS_W / 2, 280, 'You +' + pts + ' pts', { color: '#4f4', size: 16 });
    } else {
      aiTrickPoints += pts;
      ++aiTricksTaken;
      for (const c of trickCards) aiCaptured.push(c);
      if (_host && pts > 0)
        _host.floatingText.add(CANVAS_W / 2, 280, 'AI +' + pts + ' pts', { color: '#fa0', size: 16 });
    }

    ++trickCount;
    trickCards = [];
    trickPlayers = [];

    /* Check if someone reached 66 */
    if (playerTrickPoints >= TARGET_POINTS && !roundOver) {
      endRound(0);
      return;
    }
    if (aiTrickPoints >= TARGET_POINTS && !roundOver) {
      endRound(1);
      return;
    }

    /* Draw from stock (only if stock is open) */
    if (isStockOpen() && stock.length > 0) {
      const winnerHand = trickWinner === 0 ? playerHand : aiHand;
      const loserHand = trickWinner === 0 ? aiHand : playerHand;

      winnerHand.push(stock.pop());
      if (stock.length > 0)
        loserHand.push(stock.pop());

      for (const c of playerHand) c.faceUp = true;
      sortHand(playerHand);
      sortHand(aiHand);
    }

    /* Check if round is over (all cards played) */
    if (playerHand.length === 0 && aiHand.length === 0 && !roundOver) {
      /* last trick bonus: winner of last trick gets 10 points (in some rules) */
      /* Standard 66 doesn't have last trick bonus, but we check for winner */
      endRoundNoReach();
      return;
    }

    /* Winner leads next trick */
    currentTurn = trickWinner;
    trickLeader = trickWinner;
    trickWinner = -1;
    phase = PHASE_PLAY;
    aiTurnTimer = 0;
    aiDeclaredMarriage = false;

    sortHand(playerHand);
    sortHand(aiHand);

    /* Check if player can declare marriage */
    if (currentTurn === 0)
      checkPlayerMarriage();
    else
      marriagePending = false;
  }

  function closeStock(who) {
    if (stockClosed || stock.length === 0) return;
    stockClosed = true;
    closedBy = who;
    stockClosedPointsAtClose = [playerTrickPoints, aiTrickPoints];
    if (trumpCard) trumpCard.faceUp = false;

    if (_host) {
      const label = who === 0 ? 'You closed' : 'AI closed';
      _host.floatingText.add(CANVAS_W / 2, 260, label + ' the stock!', { color: '#ff8', size: 18 });
    }
  }

  function endRound(winner) {
    if (roundOver) return;
    roundOver = true;
    phase = PHASE_ROUND_OVER;

    const loser = 1 - winner;
    const loserPts = loser === 0 ? playerTrickPoints : aiTrickPoints;
    const loserTricks = loser === 0 ? playerTricksTaken : aiTricksTaken;

    let gamePointsWon = 1;
    if (loserTricks === 0)
      gamePointsWon = 3;
    else if (loserPts < 33)
      gamePointsWon = 2;

    /* If the closer failed to reach 66, the opponent gets the game points */
    if (stockClosed && closedBy === loser) {
      /* Closer failed -- opponent gets at least 2, or 3 if no tricks */
      gamePointsWon = loserTricks === 0 ? 3 : 2;
      /* But actually the winner is the opponent of the closer */
      /* This case means the closer didn't reach 66, so the other player wins */
    }

    if (winner === 0) {
      playerGamePoints += gamePointsWon;
      score += gamePointsWon;
      if (_host) {
        _host.onScoreChanged(score);
        _host.floatingText.add(CANVAS_W / 2, 180, 'You win ' + gamePointsWon + ' game point' + (gamePointsWon > 1 ? 's' : '') + '!', { color: '#4f4', size: 22 });
        if (gamePointsWon >= 3) _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
      }
    } else {
      aiGamePoints += gamePointsWon;
      if (score > 0) score = Math.max(0, score - gamePointsWon);
      if (_host) {
        _host.onScoreChanged(score);
        _host.floatingText.add(CANVAS_W / 2, 180, 'AI wins ' + gamePointsWon + ' game point' + (gamePointsWon > 1 ? 's' : '') + '!', { color: '#f44', size: 22 });
      }
    }

    if (playerGamePoints >= MATCH_TARGET || aiGamePoints >= MATCH_TARGET)
      matchOver = true;
  }

  function endRoundNoReach() {
    /* Neither player declared 66 -- all cards exhausted */
    /* The player with more trick points wins */
    if (playerTrickPoints > aiTrickPoints)
      endRound(0);
    else if (aiTrickPoints > playerTrickPoints)
      endRound(1);
    else {
      /* Tie in points -- the non-dealer (player, in our case) wins by convention */
      endRound(0);
    }
  }

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 420;
    const fanWidth = Math.min(maxWidth, total * 80);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 25;
  }

  function aiCardX(idx, total) {
    const maxWidth = 300;
    const fanWidth = Math.min(maxWidth, total * 45);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function aiCardY() {
    return 20;
  }

  const STOCK_X = 100;
  const STOCK_Y = 240;

  function trickCardPos(who) {
    if (who === 0)
      return { x: CANVAS_W / 2 - CE.CARD_W / 2 + 20, y: 310 };
    return { x: CANVAS_W / 2 - CE.CARD_W / 2 - 20, y: 210 };
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const total = playerHand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      const cy = playerCardY();
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawStock() {
    if (stock.length > 0 && !stockClosed) {
      /* Trump card shown sideways beneath the stock pile */
      _ctx.save();
      _ctx.translate(STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
      _ctx.rotate(Math.PI / 2);
      if (trumpCard && trumpCard.faceUp)
        CE.drawCardFace(_ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, trumpCard, CE.CARD_H, CE.CARD_W);
      else
        CE.drawCardBack(_ctx, -CE.CARD_H / 2, -CE.CARD_W / 2, CE.CARD_H, CE.CARD_W);
      _ctx.restore();

      /* Stock pile on top */
      if (stock.length > 1)
        CE.drawCardBack(_ctx, STOCK_X, STOCK_Y);

      /* Card count */
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText(stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 8);
    } else if (stockClosed && stock.length > 0) {
      /* Stock is closed -- show face-down pile with "Closed" label */
      CE.drawCardBack(_ctx, STOCK_X, STOCK_Y);
      _ctx.fillStyle = '#f88';
      _ctx.font = 'bold 12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText('Closed', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 8);
    } else {
      /* Empty stock */
      _ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, 5);
      _ctx.stroke();
      _ctx.fillStyle = 'rgba(255,255,255,0.2)';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }
  }

  function drawTrumpIndicator() {
    const x = 20;
    const y = 190;
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Trump:', x, y);
    const color = CE.resolveSuitColor(trumpSuit);
    _ctx.fillStyle = color;
    _ctx.font = 'bold 24px serif';
    _ctx.fillText(SUIT_SYMBOLS[trumpSuit] || trumpSuit, x + 52, y - 4);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText(SUIT_NAMES[trumpSuit] || trumpSuit, x + 78, y + 2);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 10;
    const pw = 190;
    const ph = 130;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Sixty-Six', px + 10, py + 8);

    /* Trick points */
    _ctx.font = '12px sans-serif';
    _ctx.fillStyle = '#8f8';
    _ctx.textAlign = 'left';
    _ctx.fillText('You:', px + 10, py + 30);
    _ctx.textAlign = 'right';
    _ctx.fillText(playerTrickPoints + ' / ' + TARGET_POINTS, px + pw - 10, py + 30);

    _ctx.fillStyle = '#faa';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI:', px + 10, py + 50);
    _ctx.textAlign = 'right';
    _ctx.fillText(aiTrickPoints + ' / ' + TARGET_POINTS, px + pw - 10, py + 50);

    /* Game points (match) */
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Match (' + MATCH_TARGET + ' to win)', px + 10, py + 75);

    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#8f8';
    _ctx.textAlign = 'left';
    _ctx.fillText('You:', px + 10, py + 93);
    _ctx.textAlign = 'right';
    _ctx.fillText(playerGamePoints + ' GP', px + pw - 10, py + 93);

    _ctx.fillStyle = '#faa';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI:', px + 10, py + 108);
    _ctx.textAlign = 'right';
    _ctx.fillText(aiGamePoints + ' GP', px + pw - 10, py + 108);

    _ctx.restore();
  }

  function drawCloseButton() {
    if (stockClosed || stock.length === 0 || phase !== PHASE_PLAY || currentTurn !== 0 || roundOver)
      return;
    CE.drawButton(_ctx, CLOSE_BTN.x, CLOSE_BTN.y, CLOSE_BTN.w, CLOSE_BTN.h, 'Close', {
      bg: '#5a2a2a',
      border: '#c66',
      fontSize: 12
    });
  }

  function drawMarriageButton() {
    if (!marriagePending || phase !== PHASE_PLAY || currentTurn !== 0 || trickCards.length > 0 || roundOver)
      return;
    const label = 'Marry ' + (SUIT_SYMBOLS[marriageSuit] || marriageSuit);
    CE.drawButton(_ctx, MARRIAGE_BTN.x, MARRIAGE_BTN.y, MARRIAGE_BTN.w, MARRIAGE_BTN.h, label, {
      bg: '#3a3a1a',
      border: '#cc4',
      fontSize: 12
    });
  }

  function drawMarriageShow() {
    if (marriageShownTimer <= 0) return;
    const alpha = Math.min(1, marriageShownTimer);
    const y = marriageShownBy === 0 ? 350 : 150;

    _ctx.save();
    _ctx.globalAlpha = alpha;
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    const sym = SUIT_SYMBOLS[marriageShownSuit] || marriageShownSuit;
    _ctx.fillText('K' + sym + ' + Q' + sym + ' = ' + marriageValue(marriageShownSuit) + ' pts', CANVAS_W / 2, y);
    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) return;

    const hintSet = new Set();
    if (_host && _host.hintsEnabled && phase === PHASE_PLAY && currentTurn === 0 && !roundOver) {
      for (const i of getHintIndices())
        hintSet.add(i);
    }

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (phase === PHASE_PLAY && i === hoverCardIdx && currentTurn === 0)
        y -= 12;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      if (hintSet.has(i))
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }
  }

  function drawAIHand() {
    const total = aiHand.length;
    if (total === 0) return;

    const isTurn = currentTurn === 1 && phase === PHASE_PLAY;
    _ctx.fillStyle = isTurn ? '#ff0' : '#aaa';
    _ctx.font = isTurn ? 'bold 11px sans-serif' : '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('AI (' + total + ')', CANVAS_W / 2, 5);

    for (let i = 0; i < total; ++i) {
      const x = aiCardX(i, total);
      const y = aiCardY();
      CE.drawCardBack(_ctx, x, y, CE.CARD_W * 0.6, CE.CARD_H * 0.6);
    }
  }

  function drawTrickArea() {
    _ctx.save();
    _ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    _ctx.lineWidth = 2;
    CE.drawRoundedRect(_ctx, CANVAS_W / 2 - 80, 200, 160, 180, 10);
    _ctx.stroke();
    _ctx.restore();

    for (let i = 0; i < trickCards.length; ++i) {
      const pos = trickCardPos(trickPlayers[i]);
      CE.drawCardFace(_ctx, pos.x, pos.y, trickCards[i]);
    }

    if (phase === PHASE_TRICK_DONE && trickWinner >= 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      const who = trickWinner === 0 ? 'You take' : 'AI takes';
      const pts = trickPointValue();
      const label = who + ' (' + pts + ' pts)';
      _ctx.fillText(label, CANVAS_W / 2, 195);
    }
  }

  function drawPlayingUI() {
    if (currentTurn === 0 && phase === PHASE_PLAY && !roundOver) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      let msg = 'Your turn \u2014 click a card to play';
      if (isStrictPlay() && trickCards.length > 0)
        msg = 'Your turn \u2014 must follow suit rules';
      _ctx.fillText(msg, CANVAS_W / 2, CANVAS_H - 8);
    }

    /* Phase indicator */
    _ctx.fillStyle = isStrictPlay() ? '#f88' : '#8f8';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText(isStrictPlay() ? 'Strict play (must follow suit)' : 'Open play (any card)', 20, 220);
  }

  function drawCapturedPiles() {
    /* Player captured pile */
    const pcx = CANVAS_W - 100;
    const pcy = CANVAS_H - CE.CARD_H - 30;
    if (playerCaptured.length > 0) {
      const layers = Math.min(playerCaptured.length, 3);
      for (let i = 0; i < layers; ++i)
        CE.drawCardBack(_ctx, pcx + i * 2, pcy + i * 2, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }
    _ctx.fillStyle = '#8f8';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(playerTricksTaken + ' tricks', pcx + CE.CARD_W * 0.25, pcy + CE.CARD_H * 0.5 + 6);

    /* AI captured pile */
    const acx = CANVAS_W - 100;
    const acy = 20;
    if (aiCaptured.length > 0) {
      const layers = Math.min(aiCaptured.length, 3);
      for (let i = 0; i < layers; ++i)
        CE.drawCardBack(_ctx, acx + i * 2, acy + i * 2, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }
    _ctx.fillStyle = '#faa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(aiTricksTaken + ' tricks', acx + CE.CARD_W * 0.25, acy + CE.CARD_H * 0.5 + 6);
  }

  function drawRoundOverUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 170;
    const py = 140;
    const pw = 340;
    const ph = 220;

    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';

    let title;
    if (playerTrickPoints > aiTrickPoints)
      title = 'You Win the Deal!';
    else if (aiTrickPoints > playerTrickPoints)
      title = 'AI Wins the Deal!';
    else
      title = 'Draw!';

    _ctx.fillText(title, CANVAS_W / 2, py + 16);

    _ctx.font = '14px sans-serif';
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You: ' + playerTrickPoints + ' trick pts', CANVAS_W / 2, py + 50);
    _ctx.fillStyle = '#faa';
    _ctx.fillText('AI: ' + aiTrickPoints + ' trick pts', CANVAS_W / 2, py + 74);

    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.fillText('Game Points \u2014 You: ' + playerGamePoints + '  AI: ' + aiGamePoints, CANVAS_W / 2, py + 105);

    if (matchOver) {
      _ctx.fillStyle = playerGamePoints >= MATCH_TARGET ? '#4f4' : '#f44';
      _ctx.font = 'bold 16px sans-serif';
      const matchWinner = playerGamePoints >= MATCH_TARGET ? 'You win the match!' : 'AI wins the match!';
      _ctx.fillText(matchWinner, CANVAS_W / 2, py + 135);
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Score: ' + score, CANVAS_W / 2, py + 165);

    _ctx.fillStyle = '#8f8';
    _ctx.font = '12px sans-serif';
    const clickMsg = matchOver ? 'Click for new match' : 'Click for next deal';
    _ctx.fillText(clickMsg, CANVAS_W / 2, py + ph - 24);

    _ctx.restore();
  }

  function drawSixtySix() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Sixty-Six (Schnapsen)', 10, 10);

    drawTrumpIndicator();
    drawStock();
    drawScorePanel();
    drawCapturedPiles();
    drawAIHand();
    drawTrickArea();
    drawPlayerHand();
    drawMarriageShow();
    drawCloseButton();
    drawMarriageButton();

    if (phase === PHASE_PLAY)
      drawPlayingUI();
    else if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      playerGamePoints = 0;
      aiGamePoints = 0;
      setupSixtySix();
      if (_host) _host.onScoreChanged(score);
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawSixtySix();
    },

    handleClick(mx, my) {
      if (phase === PHASE_ROUND_OVER) {
        if (matchOver) {
          playerGamePoints = 0;
          aiGamePoints = 0;
          matchOver = false;
        }
        roundOver = false;
        gameOver = false;
        dealRound();
        return;
      }

      if (phase !== PHASE_PLAY || currentTurn !== 0) return;
      if (roundOver || gameOver) return;

      /* Close button */
      if (!stockClosed && stock.length > 0) {
        if (CE.isInRect(mx, my, CLOSE_BTN.x, CLOSE_BTN.y, CLOSE_BTN.w, CLOSE_BTN.h)) {
          closeStock(0);
          return;
        }
      }

      /* Marriage button */
      if (marriagePending && trickCards.length === 0) {
        if (CE.isInRect(mx, my, MARRIAGE_BTN.x, MARRIAGE_BTN.y, MARRIAGE_BTN.w, MARRIAGE_BTN.h)) {
          declareMarriage(0, marriageSuit);
          marriagePending = false;
          /* After declaring, check if player has other marriages */
          const remaining = findMarriages(playerHand);
          if (remaining.length > 0) {
            marriagePending = true;
            marriageSuit = remaining.includes(trumpSuit) ? trumpSuit : remaining[0];
          }
          return;
        }
      }

      /* Card play */
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      /* Validate legal move in strict play */
      if (isStrictPlay() && trickCards.length > 0) {
        const legal = getLegalCards(playerHand, trickCards[0]);
        if (!legal.includes(idx)) return;
      }

      marriagePending = false;
      playCard(0, idx);
    },

    handlePointerMove(mx, my) {
      if (phase === PHASE_PLAY && currentTurn === 0)
        hoverCardIdx = hitTestPlayerCard(mx, my);
      else
        hoverCardIdx = -1;
    },

    handlePointerUp() {},

    handleKey(e) {},

    tick(dt) {
      /* Marriage show timer */
      if (marriageShownTimer > 0)
        marriageShownTimer -= dt;

      if (phase === PHASE_ROUND_OVER) return;

      if (phase === PHASE_TRICK_DONE) {
        trickDoneTimer += dt;
        if (trickDoneTimer >= TRICK_DONE_DELAY)
          finishTrick();
        return;
      }

      if (phase !== PHASE_PLAY) return;
      if (currentTurn !== 1) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;

        /* AI: consider closing the stock */
        if (trickCards.length === 0 && aiShouldClose())
          closeStock(1);

        /* AI: consider declaring marriage (when leading) */
        if (trickCards.length === 0 && !aiDeclaredMarriage) {
          const mSuit = aiCheckMarriage();
          if (mSuit) {
            declareMarriage(1, mSuit);
            aiDeclaredMarriage = true;
            /* Don't play card yet -- wait another tick */
            aiTurnTimer = -AI_TURN_DELAY * 0.5;
            return;
          }
        }

        const idx = aiChooseCard();
        if (idx >= 0)
          playCard(1, idx);
      }
    },

    sortPlayerHand() { sortHand(playerHand); },

    cleanup() {
      playerHand = [];
      aiHand = [];
      stock = [];
      playerCaptured = [];
      aiCaptured = [];
      trickCards = [];
      trickPlayers = [];
      trumpCard = null;
      trumpSuit = '';
      playerTrickPoints = 0;
      aiTrickPoints = 0;
      playerTricksTaken = 0;
      aiTricksTaken = 0;
      trickCount = 0;
      trickWinner = -1;
      roundOver = false;
      gameOver = false;
      matchOver = false;
      stockClosed = false;
      closedBy = -1;
      marriagePending = false;
      marriageSuit = '';
      marriageShownTimer = 0;
      marriageShownSuit = '';
      marriageShownBy = -1;
      aiDeclaredMarriage = false;
      playerGamePoints = 0;
      aiGamePoints = 0;
      phase = PHASE_PLAY;
      aiTurnTimer = 0;
      hoverCardIdx = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return matchOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('sixtysix', module);

})();
