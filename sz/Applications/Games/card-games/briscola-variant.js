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

  const BRISCOLA_RANKS = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];

  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

  /* Trick-taking strength (high to low): A, 3, K, Q, J, 7, 6, 5, 4, 2 */
  const RANK_STRENGTH = { 'A': 10, '3': 9, 'K': 8, 'Q': 7, 'J': 6, '7': 5, '6': 4, '5': 3, '4': 2, '2': 1 };

  /* Point values */
  const RANK_POINTS = { 'A': 11, '3': 10, 'K': 4, 'Q': 3, 'J': 2, '7': 0, '6': 0, '5': 0, '4': 0, '2': 0 };

  const TOTAL_POINTS = 120;
  const WIN_THRESHOLD = 61;
  const HAND_LIMIT = 3;

  /* Phases */
  const PHASE_PLAY = 0;
  const PHASE_TRICK_DONE = 1;
  const PHASE_ROUND_OVER = 2;

  const TRICK_DONE_DELAY = 1.4;
  const AI_TURN_DELAY = 0.9;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let stock = [];
  let trumpCard = null;
  let trumpSuit = '';

  let trickCards = [];       // 0 or 1 or 2 cards on the table
  let trickPlayers = [];     // who played each card (0=player, 1=ai)
  let playerCaptured = [];
  let aiCaptured = [];
  let playerPoints = 0;
  let aiPoints = 0;
  let trickCount = 0;

  let currentTurn = 0;       // 0=player, 1=ai
  let trickLeader = 0;
  let phase = PHASE_PLAY;
  let trickWinner = -1;
  let trickDoneTimer = 0;

  let score = 0;
  let roundOver = false;
  let gameOver = false;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  let hoverCardIdx = -1;

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

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    if (trickCards.length < 2) return -1;
    const leadCard = trickCards[0];
    const followCard = trickCards[1];
    const leadSuit = leadCard.suit;

    /* If follow played trump and lead did not, follow wins */
    if (isTrump(followCard) && !isTrump(leadCard))
      return trickPlayers[1];

    /* If lead played trump and follow did not, lead wins */
    if (isTrump(leadCard) && !isTrump(followCard))
      return trickPlayers[0];

    /* Both same suit -- compare strength */
    if (followCard.suit === leadSuit)
      return cardStrength(followCard) > cardStrength(leadCard) ? trickPlayers[1] : trickPlayers[0];

    /* Both trump -- compare strength */
    if (isTrump(leadCard) && isTrump(followCard))
      return cardStrength(followCard) > cardStrength(leadCard) ? trickPlayers[1] : trickPlayers[0];

    /* Follow played off-suit non-trump -- lead wins */
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

  function canBeatLead(card) {
    if (trickCards.length === 0) return false;
    const leadCard = trickCards[0];

    if (isTrump(card) && !isTrump(leadCard)) return true;
    if (card.suit === leadCard.suit && cardStrength(card) > cardStrength(leadCard)) return true;
    if (isTrump(card) && isTrump(leadCard) && cardStrength(card) > cardStrength(leadCard)) return true;
    return false;
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChooseCard() {
    const hand = aiHand;
    if (hand.length === 0) return -1;
    if (hand.length === 1) return 0;

    const isLeading = trickCards.length === 0;

    if (isLeading) {
      /* Lead: prefer low-value non-trump cards */
      let bestIdx = 0;
      let bestScore = 999;
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        const val = cardPoints(c) * 20 + cardStrength(c) + (isTrump(c) ? 100 : 0);
        if (val < bestScore) {
          bestScore = val;
          bestIdx = i;
        }
      }
      /* Lead aces when safe: if stock is empty and the ace would not be at risk */
      if (stock.length === 0) {
        for (let i = 0; i < hand.length; ++i)
          if (hand[i].rank === 'A' && !isTrump(hand[i])) return i;
      }
      return bestIdx;
    }

    /* Following */
    const leadCard = trickCards[0];
    const leadPts = cardPoints(leadCard);

    /* If the trick is worthless (0 points), dump a low card */
    if (leadPts === 0) {
      let bestIdx = 0;
      let bestVal = 999;
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        const val = cardPoints(c) * 20 + cardStrength(c) + (isTrump(c) ? 200 : 0);
        if (val < bestVal) {
          bestVal = val;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    /* Trick has value -- try to win it */
    /* Find cheapest card that beats the lead */
    let winnerIdx = -1;
    let winnerCost = 999;

    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      if (!canBeatLeadWith(c, leadCard)) continue;
      const cost = cardPoints(c) * 20 + cardStrength(c) + (isTrump(c) ? 50 : 0);
      if (cost < winnerCost) {
        winnerCost = cost;
        winnerIdx = i;
      }
    }

    /* If we can win cheaply enough relative to the trick value, do it */
    if (winnerIdx >= 0 && (leadPts >= 3 || winnerCost < 60))
      return winnerIdx;

    /* Cannot or should not win -- play lowest value card */
    let lowestIdx = 0;
    let lowestVal = 999;
    for (let i = 0; i < hand.length; ++i) {
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

  /* ================================================================
     SETUP
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, BRISCOLA_RANKS));
    stock = d;
    playerHand = [];
    aiHand = [];
    playerCaptured = [];
    aiCaptured = [];
    playerPoints = 0;
    aiPoints = 0;
    trickCards = [];
    trickPlayers = [];
    trickCount = 0;
    trickWinner = -1;
    trickDoneTimer = 0;
    aiTurnTimer = 0;
    hoverCardIdx = -1;
    roundOver = false;
    gameOver = false;
    phase = PHASE_PLAY;

    /* Trump card is the bottom of the stock, shown face-up */
    trumpCard = stock[0];
    trumpCard.faceUp = true;
    trumpSuit = trumpCard.suit;

    /* Deal 3 cards each (pop from top) */
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

    if (_host) {
      for (let i = 0; i < playerHand.length; ++i)
        _host.dealCardAnim(playerHand[i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, playerHand.length), playerCardY(), i * 0.08);
    }
  }

  function setupBriscola() {
    roundOver = false;
    gameOver = false;
    dealRound();
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
      playerPoints += pts;
      for (const c of trickCards) playerCaptured.push(c);
      if (_host && pts > 0)
        _host.floatingText.add(CANVAS_W / 2, 280, 'You +' + pts + ' pts', { color: '#4f4', size: 16 });
    } else {
      aiPoints += pts;
      for (const c of trickCards) aiCaptured.push(c);
      if (_host && pts > 0)
        _host.floatingText.add(CANVAS_W / 2, 280, 'AI +' + pts + ' pts', { color: '#fa0', size: 16 });
    }

    ++trickCount;
    trickCards = [];
    trickPlayers = [];

    /* Draw from stock: winner draws first, then loser */
    if (stock.length > 0) {
      const winnerHand = trickWinner === 0 ? playerHand : aiHand;
      const loserHand = trickWinner === 0 ? aiHand : playerHand;

      winnerHand.push(stock.pop());
      if (stock.length > 0)
        loserHand.push(stock.pop());

      /* The last card drawn from stock is the trump card itself */
      for (const c of playerHand) c.faceUp = true;
      sortHand(playerHand);
      sortHand(aiHand);
    }

    /* Check if round is over */
    if (playerHand.length === 0 && aiHand.length === 0) {
      endRound();
      return;
    }

    /* Winner leads next trick */
    currentTurn = trickWinner;
    trickLeader = trickWinner;
    trickWinner = -1;
    phase = PHASE_PLAY;
    aiTurnTimer = 0;
  }

  function endRound() {
    roundOver = true;
    phase = PHASE_ROUND_OVER;

    if (playerPoints >= WIN_THRESHOLD) {
      gameOver = true;
      const margin = playerPoints - aiPoints;
      score += margin;
      if (_host) {
        _host.onScoreChanged(score);
        _host.floatingText.add(CANVAS_W / 2, 200, 'You win! (' + playerPoints + '-' + aiPoints + ')', { color: '#4f4', size: 24 });
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
      }
    } else if (aiPoints >= WIN_THRESHOLD) {
      gameOver = true;
      score += playerPoints - aiPoints;
      if (score < 0) score = 0;
      if (_host) {
        _host.onScoreChanged(score);
        _host.floatingText.add(CANVAS_W / 2, 200, 'AI wins! (' + aiPoints + '-' + playerPoints + ')', { color: '#f44', size: 24 });
      }
    } else {
      /* 60-60 draw */
      gameOver = true;
      if (_host) {
        _host.onScoreChanged(score);
        _host.floatingText.add(CANVAS_W / 2, 200, 'Draw! (' + playerPoints + '-' + aiPoints + ')', { color: '#ff0', size: 24 });
      }
    }
  }

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 400;
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

  const TRICK_AREA_X = CANVAS_W / 2 - 80;
  const TRICK_AREA_Y = 220;

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
    if (stock.length > 0) {
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
    } else {
      /* Empty stock */
      _ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
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
    const px = CANVAS_W - 180;
    const py = 10;
    const pw = 170;
    const ph = 100;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Points', px + 10, py + 8);

    _ctx.font = '12px sans-serif';
    _ctx.fillStyle = '#8f8';
    _ctx.textAlign = 'left';
    _ctx.fillText('You:', px + 10, py + 30);
    _ctx.textAlign = 'right';
    _ctx.fillText(playerPoints + ' / ' + TOTAL_POINTS, px + pw - 10, py + 30);

    _ctx.fillStyle = '#faa';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI:', px + 10, py + 50);
    _ctx.textAlign = 'right';
    _ctx.fillText(aiPoints + ' / ' + TOTAL_POINTS, px + pw - 10, py + 50);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Tricks: ' + trickCount + '/20', px + 10, py + 75);
    _ctx.textAlign = 'right';
    _ctx.fillText('Stock: ' + stock.length, px + pw - 10, py + 75);

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (phase === PHASE_PLAY && i === hoverCardIdx && currentTurn === 0)
        y -= 12;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      if (_host && _host.hintsEnabled && phase === PHASE_PLAY && currentTurn === 0) {
        if (trickCards.length === 0 || canBeatLead(hand[i]))
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }
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
    /* Subtle trick area outline */
    _ctx.save();
    _ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    _ctx.lineWidth = 2;
    CE.drawRoundedRect(_ctx, TRICK_AREA_X, TRICK_AREA_Y, 160, 180, 10);
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
      _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawRoundOverUI() {
    _ctx.save();
    const px = CANVAS_W / 2 - 150;
    const py = 160;
    const pw = 300;
    const ph = 180;

    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';

    let title;
    if (playerPoints > aiPoints)
      title = 'You Win!';
    else if (aiPoints > playerPoints)
      title = 'AI Wins!';
    else
      title = 'Draw!';

    _ctx.fillText(title, CANVAS_W / 2, py + 16);

    _ctx.font = '14px sans-serif';
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You: ' + playerPoints + ' points', CANVAS_W / 2, py + 50);
    _ctx.fillStyle = '#faa';
    _ctx.fillText('AI: ' + aiPoints + ' points', CANVAS_W / 2, py + 74);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Total game score: ' + score, CANVAS_W / 2, py + 108);

    _ctx.fillStyle = '#8f8';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Click to play again', CANVAS_W / 2, py + ph - 24);

    _ctx.restore();
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
    _ctx.fillText(playerCaptured.length + ' cards', pcx + CE.CARD_W * 0.25, pcy + CE.CARD_H * 0.5 + 6);

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
    _ctx.fillText(aiCaptured.length + ' cards', acx + CE.CARD_W * 0.25, acy + CE.CARD_H * 0.5 + 6);
  }

  function drawBriscola() {
    /* Title */
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Briscola', 10, 10);

    drawTrumpIndicator();
    drawStock();
    drawScorePanel();
    drawCapturedPiles();
    drawAIHand();
    drawTrickArea();
    drawPlayerHand();

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
      setupBriscola();
      if (_host) _host.onScoreChanged(score);
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawBriscola();
    },

    handleClick(mx, my) {
      if (phase === PHASE_ROUND_OVER) {
        roundOver = false;
        gameOver = false;
        dealRound();
        return;
      }

      if (phase !== PHASE_PLAY || currentTurn !== 0) return;
      if (roundOver || gameOver) return;

      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

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
        const idx = aiChooseCard();
        if (idx >= 0)
          playCard(1, idx);
      }
    },

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
      playerPoints = 0;
      aiPoints = 0;
      trickCount = 0;
      trickWinner = -1;
      roundOver = false;
      gameOver = false;
      phase = PHASE_PLAY;
      aiTurnTimer = 0;
      hoverCardIdx = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('briscola', module);

})();
