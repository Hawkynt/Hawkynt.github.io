;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Constants ── */
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const RANK_POINTS = { 'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 20, 'Q': 10, 'K': 10 };

  /* ── Game state ── */
  let hands = [[], []];          // 0 = player, 1 = AI
  let stock = [];
  let discardPile = [];
  let currentPlayer = 0;        // 0 = human, 1 = AI
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let drawObligation = 0;       // stacked +2s from 7s
  let skipNext = false;
  let extraTurn = false;         // Ace gives extra turn in 2-player
  let chosenSuit = null;         // suit chosen after Jack played
  let waitingForSuitChoice = false;
  let pendingJackPlayer = -1;
  let mauAnnounced = [false, false];
  let mauMauAnnounced = [false, false];

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── AI timer ── */
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 1.0;

  /* ================================================================
     CARD RULES
     ================================================================ */

  function topDiscard() {
    return discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  }

  function effectiveSuit() {
    if (chosenSuit)
      return chosenSuit;
    const top = topDiscard();
    return top ? top.suit : null;
  }

  function canPlay(card) {
    const top = topDiscard();
    if (!top) return true;

    // Under draw obligation only 7s can be stacked
    if (drawObligation > 0)
      return card.rank === '7';

    // Jack is wild -- can be played on anything (except on obligation)
    if (card.rank === 'J')
      return true;

    // If a Jack was played last, must match chosen suit (or play another Jack)
    if (chosenSuit)
      return card.suit === chosenSuit;

    // Match suit or rank
    return card.suit === top.suit || card.rank === top.rank;
  }

  function hasPlayableCard(hand) {
    for (const card of hand)
      if (canPlay(card))
        return true;
    return false;
  }

  function handPoints(hand) {
    let pts = 0;
    for (const card of hand)
      pts += (RANK_POINTS[card.rank] || 0);
    return pts;
  }

  /* ================================================================
     STOCK MANAGEMENT
     ================================================================ */

  function recycleDiscard() {
    if (discardPile.length <= 1) return;
    const top = discardPile.pop();
    stock = CE.shuffle(discardPile);
    discardPile = [top];
  }

  function drawFromStock(count) {
    const drawn = [];
    for (let i = 0; i < count; ++i) {
      if (stock.length === 0) recycleDiscard();
      if (stock.length === 0) break;
      drawn.push(stock.pop());
    }
    return drawn;
  }

  /* ================================================================
     PLAY LOGIC
     ================================================================ */

  function nextPlayer() {
    return currentPlayer === 0 ? 1 : 0;
  }

  function announceMau(playerIdx) {
    if (hands[playerIdx].length === 1 && !mauAnnounced[playerIdx]) {
      mauAnnounced[playerIdx] = true;
      if (_host) {
        const label = playerIdx === 0 ? 'Mau!' : 'AI: Mau!';
        _host.floatingText.add(CANVAS_W / 2, playerIdx === 0 ? 400 : 160, label, { color: '#ff0', size: 22 });
      }
    }
  }

  function announceMauMau(playerIdx) {
    if (hands[playerIdx].length === 0 && !mauMauAnnounced[playerIdx]) {
      mauMauAnnounced[playerIdx] = true;
      if (_host) {
        const label = playerIdx === 0 ? 'Mau-Mau!' : 'AI: Mau-Mau!';
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, label, { color: '#4f4', size: 28 });
      }
    }
  }

  function playCard(playerIdx, cardIndex) {
    if (waitingForSuitChoice) return false;
    const hand = hands[playerIdx];
    if (cardIndex < 0 || cardIndex >= hand.length) return false;
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;

    hand.splice(cardIndex, 1);
    discardPile.push(card);
    chosenSuit = null;

    // Animate the deal
    if (_host) {
      const srcX = playerIdx === 0 ? 80 + cardIndex * 55 : 80 + cardIndex * 20;
      const srcY = playerIdx === 0 ? 440 : 20;
      _host.dealCardAnim(card, srcX, srcY, CANVAS_W / 2 - CE.CARD_W / 2, 240, 0);
    }

    // Special card effects
    if (card.rank === '7') {
      drawObligation += 2;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 220, '+' + drawObligation + ' Draw!', { color: '#f88', size: 18 });
    } else if (card.rank === '8') {
      skipNext = true;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 220, 'Skip!', { color: '#fa0', size: 18 });
    } else if (card.rank === 'J') {
      // Jack is wild -- player picks suit
      if (playerIdx === 0) {
        waitingForSuitChoice = true;
        pendingJackPlayer = playerIdx;
        announceMau(playerIdx);
        return true;
      }
      // AI picks suit
      chosenSuit = aiChooseSuit();
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 220, 'Wish: ' + SUIT_NAMES[chosenSuit], { color: '#8af', size: 16 });
    } else if (card.rank === 'A') {
      // Ace = reverse = extra turn in 2-player
      extraTurn = true;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 220, 'Extra turn!', { color: '#af4', size: 16 });
    }

    // Check for Mau / Mau-Mau
    announceMau(playerIdx);

    if (hand.length === 0)
      return finishRound(playerIdx);

    advanceTurn();
    return true;
  }

  function finishRound(winnerIdx) {
    announceMauMau(winnerIdx);
    const loserIdx = winnerIdx === 0 ? 1 : 0;
    const pts = handPoints(hands[loserIdx]);

    if (winnerIdx === 0) {
      score += pts;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300,
          'YOU WIN! +' + pts + ' points', { color: '#4f4', size: 24 });
        _host.addGlow(80, 440, hands[0].length * 55 + CE.CARD_W, CE.CARD_H, 2);
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
    } else {
      score -= Math.floor(pts / 2);
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 300,
          'AI WINS! -' + Math.floor(pts / 2) + ' points', { color: '#f44', size: 24 });
    }

    roundOver = true;
    if (score <= -100) gameOver = true;
    if (_host) _host.onScoreChanged(score);
    return true;
  }

  function advanceTurn() {
    if (extraTurn) {
      extraTurn = false;
      // Same player goes again
      return;
    }

    if (skipNext) {
      skipNext = false;
      // Skip next player, current player goes again
      return;
    }

    currentPlayer = nextPlayer();
  }

  function playerDrawCards() {
    if (drawObligation > 0) {
      const drawn = drawFromStock(drawObligation);
      for (const c of drawn)
        hands[currentPlayer].push(c);
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, currentPlayer === 0 ? 400 : 160,
          'Draw ' + drawObligation + '!', { color: '#f88', size: 18 });
      drawObligation = 0;
      mauAnnounced[currentPlayer] = false;
      currentPlayer = nextPlayer();
    } else {
      const drawn = drawFromStock(1);
      for (const c of drawn)
        hands[currentPlayer].push(c);
      mauAnnounced[currentPlayer] = false;
      currentPlayer = nextPlayer();
    }
  }

  /* ================================================================
     SUIT CHOICE OVERLAY (after Jack)
     ================================================================ */

  const SUIT_BTN_SIZE = 60;
  const SUIT_BTN_GAP = 16;
  const suitChoiceRects = [];

  function drawSuitChoiceOverlay() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Choose a suit (Jack played):', CANVAS_W / 2, CANVAS_H / 2 - 65);

    suitChoiceRects.length = 0;
    const totalW = CE.SUITS.length * SUIT_BTN_SIZE + (CE.SUITS.length - 1) * SUIT_BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 20;

    for (let i = 0; i < CE.SUITS.length; ++i) {
      const x = startX + i * (SUIT_BTN_SIZE + SUIT_BTN_GAP);
      const suit = CE.SUITS[i];
      const suitColor = CE.SUIT_COLORS[suit];

      _ctx.fillStyle = '#fff';
      CE.drawRoundedRect(_ctx, x, y, SUIT_BTN_SIZE, SUIT_BTN_SIZE, 8);
      _ctx.fill();
      _ctx.strokeStyle = '#888';
      _ctx.lineWidth = 2;
      _ctx.stroke();

      _ctx.fillStyle = suitColor;
      _ctx.font = '28px serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(SUIT_SYMBOLS[suit], x + SUIT_BTN_SIZE / 2, y + SUIT_BTN_SIZE / 2 - 6);

      _ctx.font = '10px sans-serif';
      _ctx.fillText(SUIT_NAMES[suit], x + SUIT_BTN_SIZE / 2, y + SUIT_BTN_SIZE - 10);

      suitChoiceRects.push({ x, y, w: SUIT_BTN_SIZE, h: SUIT_BTN_SIZE, suit });
    }
    _ctx.restore();
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChooseSuit() {
    const hand = hands[1];
    const counts = {};
    for (const s of CE.SUITS) counts[s] = 0;
    for (const c of hand)
      if (c.rank !== 'J') ++counts[c.suit];
    let best = CE.SUITS[0];
    for (const s of CE.SUITS)
      if (counts[s] > counts[best]) best = s;
    return best;
  }

  function aiTurn() {
    if (roundOver || gameOver || waitingForSuitChoice) return;
    if (currentPlayer !== 1) return;

    const hand = hands[1];

    // Under draw obligation: try to stack a 7
    if (drawObligation > 0) {
      for (let i = 0; i < hand.length; ++i) {
        if (hand[i].rank === '7') {
          playCard(1, i);
          return;
        }
      }
      // Can't stack -- must draw
      playerDrawCards();
      return;
    }

    // Collect playable cards (excluding Jacks initially)
    const playable = [];
    const jacks = [];
    for (let i = 0; i < hand.length; ++i) {
      if (canPlay(hand[i])) {
        if (hand[i].rank === 'J')
          jacks.push(i);
        else
          playable.push(i);
      }
    }

    if (playable.length > 0) {
      // Strategic: prefer special cards (7, 8, A) when beneficial
      // Sort: prefer 7 if opponent has few cards, 8 to skip, then by rank value
      playable.sort((a, b) => {
        const ca = hand[a];
        const cb = hand[b];
        // Prefer 8 (skip) when opponent is close to winning
        if (hands[0].length <= 3) {
          if (ca.rank === '8' && cb.rank !== '8') return -1;
          if (cb.rank === '8' && ca.rank !== '8') return 1;
        }
        // Prefer 7 (draw 2) to burden opponent
        if (ca.rank === '7' && cb.rank !== '7') return -1;
        if (cb.rank === '7' && ca.rank !== '7') return 1;
        // Prefer higher point cards to shed them early
        return (RANK_POINTS[cb.rank] || 0) - (RANK_POINTS[ca.rank] || 0);
      });
      playCard(1, playable[0]);
      return;
    }

    // Use Jack only as last resort (strategic saving)
    if (jacks.length > 0) {
      playCard(1, jacks[0]);
      return;
    }

    // No playable card -- draw
    playerDrawCards();
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupMauMau() {
    const d = CE.shuffle(CE.createDeck());
    hands = [[], []];
    discardPile = [];
    stock = d;
    currentPlayer = 0;
    roundOver = false;
    gameOver = false;
    drawObligation = 0;
    skipNext = false;
    extraTurn = false;
    chosenSuit = null;
    waitingForSuitChoice = false;
    pendingJackPlayer = -1;
    mauAnnounced = [false, false];
    mauMauAnnounced = [false, false];
    aiTurnTimer = 0;

    // Deal 6 cards each
    for (let i = 0; i < 6; ++i) {
      hands[0].push(stock.pop());
      hands[1].push(stock.pop());
    }

    // Flip one card to start discard pile
    let startCard = stock.pop();
    // Ensure starting card is not a special card (7, 8, J, A)
    while (startCard.rank === '7' || startCard.rank === '8' || startCard.rank === 'J' || startCard.rank === 'A') {
      stock.unshift(startCard);
      CE.shuffle(stock);
      startCard = stock.pop();
    }
    discardPile.push(startCard);

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, 80 + i * 55, 440, i * 0.1);
    }
  }

  /* ================================================================
     DRAWING - LAYOUT CONSTANTS
     ================================================================ */

  const HAND_Y = 440;
  const HAND_X_START = 80;
  const HAND_SPACING = 55;
  const AI_HAND_Y = 20;
  const AI_HAND_X_START = 80;
  const AI_HAND_SPACING = 20;
  const DISCARD_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const DISCARD_Y = 240;
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W - 30;
  const STOCK_Y = 240;

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawMauMau() {
    // Title
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Mau-Mau', 20, 18);

    // AI hand (face down)
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI (' + hands[1].length + ' cards)', AI_HAND_X_START, AI_HAND_Y + CE.CARD_H * 0.6 + 16);
    for (let i = 0; i < hands[1].length; ++i)
      CE.drawCardBack(_ctx, AI_HAND_X_START + i * AI_HAND_SPACING, AI_HAND_Y, CE.CARD_W * 0.6, CE.CARD_H * 0.6);

    // Stock pile
    if (stock.length > 0) {
      CE.drawCardBack(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H);
      _ctx.fillStyle = '#fff';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('' + stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 14);
    } else {
      _ctx.strokeStyle = '#555';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.fillStyle = '#555';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }

    // Discard pile
    const top = topDiscard();
    if (top)
      CE.drawCardFace(_ctx, DISCARD_X, DISCARD_Y, top);
    else {
      _ctx.strokeStyle = '#555';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
    }

    // Draw obligation indicator
    if (drawObligation > 0) {
      _ctx.save();
      _ctx.fillStyle = '#f44';
      _ctx.font = 'bold 20px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('+' + drawObligation, DISCARD_X + CE.CARD_W + 30, DISCARD_Y + CE.CARD_H / 2);
      _ctx.restore();
    }

    // Chosen suit indicator (after Jack)
    if (chosenSuit) {
      _ctx.save();
      const indX = DISCARD_X + CE.CARD_W + 20;
      const indY = DISCARD_Y - 30;
      _ctx.fillStyle = '#1a3a1a';
      _ctx.strokeStyle = '#8af';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, indX, indY, 60, 26, 4);
      _ctx.fill();
      _ctx.stroke();
      _ctx.fillStyle = CE.SUIT_COLORS[chosenSuit];
      _ctx.font = 'bold 14px serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(SUIT_SYMBOLS[chosenSuit] + ' ' + SUIT_NAMES[chosenSuit], indX + 30, indY + 13);
      _ctx.restore();
    }

    // Player hand
    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Your Hand', HAND_X_START, HAND_Y - 10);
    for (let i = 0; i < hands[0].length; ++i) {
      if (hands[0][i]._dealing) continue;
      const x = HAND_X_START + i * HAND_SPACING;
      CE.drawCardFace(_ctx, x, HAND_Y, hands[0][i]);
      if (_host && _host.hintsEnabled && currentPlayer === 0 && !waitingForSuitChoice && !roundOver && !gameOver && canPlay(hands[0][i]))
        CE.drawHintGlow(_ctx, x, HAND_Y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Highlight playable cards when it's player's turn
      if (currentPlayer === 0 && !roundOver && !gameOver && !waitingForSuitChoice && canPlay(hands[0][i])) {
        _ctx.save();
        _ctx.strokeStyle = '#8f8';
        _ctx.lineWidth = 2;
        _ctx.shadowColor = '#8f8';
        _ctx.shadowBlur = 6;
        CE.drawRoundedRect(_ctx, x - 1, HAND_Y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }

    // Turn indicator
    if (!roundOver && !gameOver && !waitingForSuitChoice) {
      if (currentPlayer === 0) {
        _ctx.fillStyle = '#8f8';
        _ctx.font = '12px sans-serif';
        _ctx.textAlign = 'center';
        if (drawObligation > 0 && !hasPlayableCard(hands[0]))
          _ctx.fillText('You must draw ' + drawObligation + ' cards \u2014 click the stock pile', CANVAS_W / 2, CANVAS_H - 15);
        else if (drawObligation > 0)
          _ctx.fillText('Play a 7 to stack, or click stock to draw ' + drawObligation, CANVAS_W / 2, CANVAS_H - 15);
        else if (hasPlayableCard(hands[0]))
          _ctx.fillText('Your turn \u2014 click a card to play, or click stock to draw', CANVAS_W / 2, CANVAS_H - 15);
        else
          _ctx.fillText('No playable card \u2014 click stock to draw', CANVAS_W / 2, CANVAS_H - 15);
      } else {
        _ctx.fillStyle = '#f88';
        _ctx.font = '12px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.fillText('AI is thinking...', CANVAS_W / 2, CANVAS_H - 15);
      }
    }

    // Score display
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('Score: ' + score, CANVAS_W - 20, 18);

    // Current player indicator
    _ctx.fillStyle = currentPlayer === 0 ? '#8f8' : '#f88';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(currentPlayer === 0 ? '\u25BC Your Turn' : '\u25B2 AI Turn', CANVAS_W / 2, 220);

    // Round over message
    if (roundOver && !waitingForSuitChoice) {
      _ctx.fillStyle = 'rgba(0,0,0,0.4)';
      _ctx.fillRect(0, CANVAS_H / 2 - 30, CANVAS_W, 60);
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Click anywhere to continue', CANVAS_W / 2, CANVAS_H / 2);
    }

    // Suit choice overlay
    if (waitingForSuitChoice)
      drawSuitChoiceOverlay();
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupMauMau();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawMauMau();
    },

    handleClick(mx, my) {
      // Suit choice overlay
      if (waitingForSuitChoice) {
        for (const r of suitChoiceRects) {
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            waitingForSuitChoice = false;
            chosenSuit = r.suit;
            pendingJackPlayer = -1;
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 220, 'Wish: ' + SUIT_NAMES[chosenSuit], { color: '#8af', size: 16 });
            // Check if player won with that Jack
            if (hands[0].length === 0) {
              finishRound(0);
              return;
            }
            advanceTurn();
            return;
          }
        }
        return;
      }

      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      if (currentPlayer !== 0) return;

      // Player card click
      for (let i = hands[0].length - 1; i >= 0; --i) {
        const cx = HAND_X_START + i * HAND_SPACING;
        if (CE.isInRect(mx, my, cx, HAND_Y, CE.CARD_W, CE.CARD_H)) {
          if (!playCard(0, i))
            if (_host) _host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
          return;
        }
      }

      // Stock click (draw)
      if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
        if (drawObligation > 0 && hasPlayableCard(hands[0])) {
          // Player has a 7, should play it instead (but allow drawing anyway)
        }
        playerDrawCards();
        return;
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey(e) {
      if (roundOver || gameOver || waitingForSuitChoice) return;
      if (currentPlayer !== 0) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const idx = num - 1;
        if (idx < hands[0].length)
          playCard(0, idx);
      }
      if (e.key === 'd' || e.key === 'D') {
        // Draw shortcut
        if (stock.length > 0 || discardPile.length > 1)
          playerDrawCards();
      }
    },

    tick(dt) {
      if (roundOver || gameOver || waitingForSuitChoice) return;
      if (currentPlayer === 1) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          aiTurn();
        }
      }
    },

    cleanup() {
      hands = [[], []];
      stock = [];
      discardPile = [];
      roundOver = false;
      gameOver = false;
      drawObligation = 0;
      skipNext = false;
      extraTurn = false;
      chosenSuit = null;
      waitingForSuitChoice = false;
      pendingJackPlayer = -1;
      mauAnnounced = [false, false];
      mauMauAnnounced = [false, false];
      aiTurnTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('maumau', module);

})();
