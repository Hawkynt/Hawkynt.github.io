;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Suit display names ── */
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };

  /* ── Game state ── */
  let playerHand = [];
  let aiHand = [];
  let stock = [];
  let discardPile = [];
  let currentSuit = null;
  let playerTurn = true;
  let drawCount = 0;
  const MAX_DRAWS = 3;
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';

  /* ── Suit chooser overlay ── */
  let waitingForSuitChoice = false;
  let pendingSuitPlayer = -1;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── AI timer ── */
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 1.0;

  /* ── Target score ── */
  const WIN_SCORE = 200;

  /* ================================================================
     HIGHLIGHT HELPER -- draws card face then overlays golden border for 8s
     ================================================================ */

  function drawCardWithHighlight(_ctx, x, y, card, w, h) {
    CE.drawCardFace(_ctx, x, y, card, w, h);
    if (card.rank === '8') {
      const cw = w || CE.CARD_W;
      const ch = h || CE.CARD_H;
      const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
      _ctx.save();
      _ctx.strokeStyle = '#da0';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, x + 2, y + 2, cw - 4, ch - 4, Math.max(cr - 1, 1));
      _ctx.stroke();
      _ctx.restore();
    }
  }

  /* ================================================================
     CARD SCORING
     ================================================================ */

  function cardPoints(card) {
    if (card.rank === '8') return 50;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    if (card.rank === 'A') return 1;
    return parseInt(card.rank, 10);
  }

  function handPoints(hand) {
    let total = 0;
    for (const c of hand)
      total += cardPoints(c);
    return total;
  }

  /* ================================================================
     RULES
     ================================================================ */

  function canPlay(card, topCard, requiredSuit) {
    if (card.rank === '8') return true;
    if (card.suit === requiredSuit) return true;
    if (card.rank === topCard.rank) return true;
    return false;
  }

  function hasPlayableCard(hand, topCard, requiredSuit) {
    for (const c of hand)
      if (canPlay(c, topCard, requiredSuit))
        return true;
    return false;
  }

  function recycleDiscard() {
    if (discardPile.length <= 1) return;
    const topCard = discardPile.pop();
    const recycled = discardPile.splice(0, discardPile.length);
    CE.shuffle(recycled);
    for (const c of recycled) {
      c.faceUp = false;
      stock.push(c);
    }
    discardPile.push(topCard);
    if (_host)
      _host.floatingText.add(CANVAS_W / 2 - 80, 290, 'Stock refilled', { color: '#8cf', size: 14 });
  }

  function drawFromStock() {
    if (stock.length === 0)
      recycleDiscard();
    if (stock.length === 0) return null;
    return stock.pop();
  }

  /* ================================================================
     GAME ACTIONS
     ================================================================ */

  function playCard(hand, index, isPlayer) {
    const card = hand.splice(index, 1)[0];
    card.faceUp = true;
    discardPile.push(card);

    if (_host)
      _host.dealCardAnim(card, isPlayer ? getPlayerCardX(index) : getAiCardX(index),
        isPlayer ? 460 : 20, CANVAS_W / 2 - CE.CARD_W / 2, 240, 0);

    if (card.rank === '8') {
      if (isPlayer) {
        waitingForSuitChoice = true;
        pendingSuitPlayer = 0;
        return;
      }
      // AI chooses suit
      const chosen = aiChooseSuit();
      currentSuit = chosen;
      if (_host) {
        const sym = SUIT_SYMBOLS[chosen] || '';
        const isRed = chosen === 'hearts' || chosen === 'diamonds';
        _host.floatingText.add(CANVAS_W / 2, 200, 'AI picks ' + SUIT_NAMES[chosen] + ' ' + sym,
          { color: isRed ? '#f88' : '#ccc', size: 16 });
      }
    } else
      currentSuit = card.suit;

    finishTurn(isPlayer, hand);
  }

  function finishTurn(isPlayer, hand) {
    drawCount = 0;
    if (hand.length === 0) {
      endRound(isPlayer);
      return;
    }
    playerTurn = !isPlayer;
    aiTurnTimer = 0;
  }

  function endRound(playerWon) {
    roundOver = true;
    if (playerWon) {
      const pts = handPoints(aiHand);
      score += pts;
      resultMsg = 'You win the round! +' + pts + ' pts';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN! +' + pts, { color: '#4f4', size: 28 });
        _host.addGlow(getPlayerCardX(0) - 10, 440, Math.max(playerHand.length, 1) * 55 + CE.CARD_W, CE.CARD_H, 2);
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
    } else {
      const pts = handPoints(playerHand);
      score -= Math.floor(pts / 2);
      resultMsg = 'AI wins the round! -' + Math.floor(pts / 2) + ' pts';
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 300, 'AI WINS', { color: '#f44', size: 28 });
    }
    if (score >= WIN_SCORE) {
      gameOver = true;
      resultMsg = 'YOU WIN THE GAME! Final score: ' + score;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 260, 'GAME OVER - YOU WIN!', { color: '#ff0', size: 24 });
    }
    if (_host) _host.onScoreChanged(score);
  }

  function playerDraw() {
    if (drawCount >= MAX_DRAWS) {
      // Pass turn
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 420, 'Pass!', { color: '#fa0', size: 16 });
      drawCount = 0;
      playerTurn = false;
      aiTurnTimer = 0;
      return;
    }
    const card = drawFromStock();
    if (!card) {
      // No cards anywhere, pass
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 420, 'No cards left, pass!', { color: '#fa0', size: 14 });
      drawCount = 0;
      playerTurn = false;
      aiTurnTimer = 0;
      return;
    }
    card.faceUp = true;
    playerHand.push(card);
    ++drawCount;
    if (_host)
      _host.dealCardAnim(card, CANVAS_W / 2 - 80, 240,
        getPlayerCardX(playerHand.length - 1), 460, 0);
    if (_host)
      _host.floatingText.add(CANVAS_W / 2, 420, 'Draw (' + drawCount + '/' + MAX_DRAWS + ')',
        { color: '#8cf', size: 14 });
  }

  /* ================================================================
     AI
     ================================================================ */

  function aiChooseSuit() {
    const counts = {};
    for (const s of CE.SUITS) counts[s] = 0;
    for (const c of aiHand)
      if (c.rank !== '8') ++counts[c.suit];
    let best = CE.SUITS[0];
    for (const s of CE.SUITS)
      if (counts[s] > counts[best]) best = s;
    return best;
  }

  function aiTurn() {
    if (roundOver || gameOver || waitingForSuitChoice || playerTurn) return;
    const topCard = discardPile[discardPile.length - 1];

    // Try to play a non-8 card first (suit match preferred)
    let suitMatches = [];
    let rankMatches = [];
    let eights = [];

    for (let i = 0; i < aiHand.length; ++i) {
      const c = aiHand[i];
      if (c.rank === '8') {
        eights.push(i);
        continue;
      }
      if (c.suit === currentSuit)
        suitMatches.push(i);
      else if (c.rank === topCard.rank)
        rankMatches.push(i);
    }

    // Prefer suit matches, then rank matches, then 8s
    if (suitMatches.length > 0) {
      playCard(aiHand, suitMatches[0], false);
      return;
    }
    if (rankMatches.length > 0) {
      playCard(aiHand, rankMatches[0], false);
      return;
    }
    if (eights.length > 0) {
      playCard(aiHand, eights[0], false);
      return;
    }

    // No playable card -- draw up to MAX_DRAWS
    let drew = 0;
    while (drew < MAX_DRAWS) {
      const card = drawFromStock();
      if (!card) break;
      card.faceUp = false;
      aiHand.push(card);
      ++drew;
      if (canPlay(card, topCard, currentSuit)) {
        // Play the newly drawn card if it works
        playCard(aiHand, aiHand.length - 1, false);
        return;
      }
    }

    // Still can't play after drawing, pass
    if (_host)
      _host.floatingText.add(CANVAS_W / 2, 80, 'AI passes', { color: '#fa0', size: 14 });
    drawCount = 0;
    playerTurn = true;
  }

  /* ================================================================
     LAYOUT HELPERS
     ================================================================ */

  function getPlayerCardX(index) {
    const totalCards = playerHand.length;
    const maxSpread = CANVAS_W - 120;
    const spacing = Math.min(55, (maxSpread - CE.CARD_W) / Math.max(totalCards - 1, 1));
    const totalWidth = (totalCards - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + index * spacing;
  }

  function getAiCardX(index) {
    const totalCards = aiHand.length;
    const spacing = Math.min(30, (400 - CE.CARD_W) / Math.max(totalCards - 1, 1));
    const totalWidth = (totalCards - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + index * spacing;
  }

  /* ── Button positions ── */
  const DRAW_BTN = { x: CANVAS_W / 2 + 80, y: 270, w: 90, h: 36 };
  const PASS_BTN = { x: CANVAS_W / 2 + 80, y: 312, w: 90, h: 30 };

  /* ================================================================
     SUIT CHOOSER OVERLAY
     ================================================================ */

  const SUIT_BTN_SIZE = 70;
  const SUIT_BTN_GAP = 16;
  const suitChoiceRects = [];

  function drawSuitChoiceOverlay() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.65)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 20px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Choose a suit:', CANVAS_W / 2, CANVAS_H / 2 - 70);

    suitChoiceRects.length = 0;
    const totalW = CE.SUITS.length * SUIT_BTN_SIZE + (CE.SUITS.length - 1) * SUIT_BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 25;

    for (let i = 0; i < CE.SUITS.length; ++i) {
      const x = startX + i * (SUIT_BTN_SIZE + SUIT_BTN_GAP);
      const suit = CE.SUITS[i];
      const sym = SUIT_SYMBOLS[suit] || '';
      const isRed = suit === 'hearts' || suit === 'diamonds';

      // Button background
      _ctx.fillStyle = isRed ? '#4a1a1a' : '#1a1a3a';
      _ctx.strokeStyle = isRed ? '#c44' : '#88a';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, x, y, SUIT_BTN_SIZE, SUIT_BTN_SIZE, 10);
      _ctx.fill();
      _ctx.stroke();

      // Suit symbol
      _ctx.fillStyle = isRed ? '#f44' : '#ddd';
      _ctx.font = '30px serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(sym, x + SUIT_BTN_SIZE / 2, y + SUIT_BTN_SIZE / 2 - 6);

      // Suit name
      _ctx.fillStyle = '#aaa';
      _ctx.font = '10px sans-serif';
      _ctx.fillText(SUIT_NAMES[suit], x + SUIT_BTN_SIZE / 2, y + SUIT_BTN_SIZE - 10);

      suitChoiceRects.push({ x, y, w: SUIT_BTN_SIZE, h: SUIT_BTN_SIZE, suit });
    }
    _ctx.restore();
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupCrazyEights() {
    stock = CE.shuffle(CE.createDeck());
    playerHand = [];
    aiHand = [];
    discardPile = [];
    currentSuit = null;
    playerTurn = true;
    drawCount = 0;
    roundOver = false;
    resultMsg = '';
    waitingForSuitChoice = false;
    pendingSuitPlayer = -1;
    aiTurnTimer = 0;

    // Deal 7 cards each
    for (let i = 0; i < 7; ++i) {
      const pc = stock.pop();
      pc.faceUp = true;
      playerHand.push(pc);
      if (_host)
        _host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, getPlayerCardX(i), 460, i * 0.1);

      const ac = stock.pop();
      ac.faceUp = false;
      aiHand.push(ac);
    }

    // Flip one card to start discard pile (not an 8)
    let starter = stock.pop();
    while (starter.rank === '8') {
      stock.unshift(starter);
      starter = stock.pop();
    }
    starter.faceUp = true;
    discardPile.push(starter);
    currentSuit = starter.suit;
  }

  /* ================================================================
     DRAW
     ================================================================ */

  function drawCrazyEights() {
    const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

    // -- Title / turn indicator --
    _ctx.fillStyle = playerTurn ? '#8f8' : '#f88';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(playerTurn ? 'Your Turn' : 'AI Thinking...', CANVAS_W / 2, 18);

    // -- AI hand (card backs) at top --
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('AI (' + aiHand.length + ' cards)', CANVAS_W / 2, 10 + CE.CARD_H * 0.6 + 25);
    for (let i = 0; i < aiHand.length; ++i) {
      const x = getAiCardX(i);
      CE.drawCardBack(_ctx, x, 30, CE.CARD_W * 0.7, CE.CARD_H * 0.7);
    }

    // -- Stock pile (left of center) --
    const stockX = CANVAS_W / 2 - CE.CARD_W - 30;
    const stockY = 245;
    if (stock.length > 0) {
      CE.drawCardBack(_ctx, stockX, stockY, CE.CARD_W, CE.CARD_H);
      _ctx.fillStyle = '#fff';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('' + stock.length, stockX + CE.CARD_W / 2, stockY + CE.CARD_H + 14);
    } else {
      _ctx.strokeStyle = '#555';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, stockX, stockY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.fillStyle = '#555';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Empty', stockX + CE.CARD_W / 2, stockY + CE.CARD_H / 2);
    }

    // -- Discard pile (center) --
    const discardX = CANVAS_W / 2 + 10;
    const discardY = 245;
    if (topCard)
      drawCardWithHighlight(_ctx, discardX, discardY, topCard, CE.CARD_W, CE.CARD_H);
    else {
      _ctx.strokeStyle = '#555';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, discardX, discardY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
    }

    // -- Current required suit indicator --
    if (currentSuit) {
      const indicatorX = discardX + CE.CARD_W + 16;
      const indicatorY = discardY + 10;
      const isRed = currentSuit === 'hearts' || currentSuit === 'diamonds';
      const sym = SUIT_SYMBOLS[currentSuit] || '';

      _ctx.fillStyle = 'rgba(0,0,0,0.4)';
      CE.drawRoundedRect(_ctx, indicatorX - 4, indicatorY - 4, 50, 60, 6);
      _ctx.fill();

      _ctx.fillStyle = isRed ? '#f66' : '#ccc';
      _ctx.font = '28px serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(sym, indicatorX + 21, indicatorY + 20);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '9px sans-serif';
      _ctx.fillText(SUIT_NAMES[currentSuit], indicatorX + 21, indicatorY + 44);
    }

    // -- Draw / Pass buttons (only on player turn) --
    if (playerTurn && !roundOver && !gameOver && !waitingForSuitChoice) {
      const canDraw = drawCount < MAX_DRAWS && (stock.length > 0 || discardPile.length > 1);
      if (canDraw)
        CE.drawButton(_ctx, DRAW_BTN.x, DRAW_BTN.y, DRAW_BTN.w, DRAW_BTN.h,
          'Draw (' + drawCount + '/' + MAX_DRAWS + ')', { bg: '#2a3a5a', border: '#68c' });

      if (drawCount >= MAX_DRAWS || (!canDraw && !hasPlayableCard(playerHand, topCard, currentSuit)))
        CE.drawButton(_ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass',
          { bg: '#5a3a2a', border: '#c86', fontSize: 12 });
    }

    // -- Player hand at bottom (fan) --
    for (let i = 0; i < playerHand.length; ++i) {
      if (playerHand[i]._dealing) continue;
      const x = getPlayerCardX(i);
      const playable = topCard && canPlay(playerHand[i], topCard, currentSuit);
      drawCardWithHighlight(_ctx, x, 460, playerHand[i], CE.CARD_W, CE.CARD_H);
      if (_host && _host.hintsEnabled && playerTurn && !waitingForSuitChoice && !roundOver && !gameOver && topCard && canPlay(playerHand[i], topCard, currentSuit))
        CE.drawHintGlow(_ctx, x, 460, CE.CARD_W, CE.CARD_H, _host.hintTime);
      if (playerTurn && playable && !waitingForSuitChoice) {
        _ctx.save();
        _ctx.strokeStyle = '#8f8';
        _ctx.lineWidth = 2;
        _ctx.shadowColor = '#8f8';
        _ctx.shadowBlur = 6;
        CE.drawRoundedRect(_ctx, x - 1, 459, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }

    // -- Score & info --
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Score: ' + score, 16, 22);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('First to ' + WIN_SCORE + ' wins', 16, 40);

    // -- Result message --
    if (roundOver && resultMsg) {
      _ctx.fillStyle = 'rgba(0,0,0,0.5)';
      CE.drawRoundedRect(_ctx, CANVAS_W / 2 - 200, CANVAS_H / 2 - 30, 400, 60, 10);
      _ctx.fill();
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 8);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '12px sans-serif';
      _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 16);
    }

    // -- Help text --
    if (!roundOver && !gameOver && playerTurn && !waitingForSuitChoice) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Play a matching suit/rank, an 8 (wild), or draw from stock', CANVAS_W / 2, CANVAS_H - 8);
    }

    // -- Suit choice overlay --
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
      gameOver = false;
      setupCrazyEights();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawCrazyEights();
    },

    handleClick(mx, my) {
      // Suit choice overlay
      if (waitingForSuitChoice) {
        for (const r of suitChoiceRects) {
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            waitingForSuitChoice = false;
            currentSuit = r.suit;
            if (_host) {
              const sym = SUIT_SYMBOLS[r.suit] || '';
              _host.floatingText.add(CANVAS_W / 2, 200, 'Suit: ' + SUIT_NAMES[r.suit] + ' ' + sym,
                { color: '#ff0', size: 16 });
            }
            finishTurn(pendingSuitPlayer === 0, pendingSuitPlayer === 0 ? playerHand : aiHand);
            pendingSuitPlayer = -1;
            return;
          }
        }
        return;
      }

      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      if (!playerTurn) return;

      const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

      // Draw button
      const canDrawMore = drawCount < MAX_DRAWS && (stock.length > 0 || discardPile.length > 1);
      if (canDrawMore && CE.isInRect(mx, my, DRAW_BTN.x, DRAW_BTN.y, DRAW_BTN.w, DRAW_BTN.h)) {
        playerDraw();
        return;
      }

      // Pass button
      if ((drawCount >= MAX_DRAWS || (!canDrawMore && !hasPlayableCard(playerHand, topCard, currentSuit))) &&
          CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 420, 'Pass!', { color: '#fa0', size: 16 });
        drawCount = 0;
        playerTurn = false;
        aiTurnTimer = 0;
        return;
      }

      // Stock pile click (same as draw)
      const stockX = CANVAS_W / 2 - CE.CARD_W - 30;
      const stockY = 245;
      if (canDrawMore && CE.isInRect(mx, my, stockX, stockY, CE.CARD_W, CE.CARD_H)) {
        playerDraw();
        return;
      }

      // Player card click
      for (let i = playerHand.length - 1; i >= 0; --i) {
        const cx = getPlayerCardX(i);
        if (mx >= cx && mx <= cx + CE.CARD_W && my >= 460 && my <= 460 + CE.CARD_H) {
          if (topCard && canPlay(playerHand[i], topCard, currentSuit))
            playCard(playerHand, i, true);
          else if (_host)
            _host.floatingText.add(mx, my - 20, 'Can\'t play!', { color: '#f88', size: 14 });
          return;
        }
      }
    },

    handleKey(e) {
      if (roundOver || gameOver || waitingForSuitChoice) return;
      if (!playerTurn) return;
      if (e.key === 'd' || e.key === 'D') {
        const canDrawMore = drawCount < MAX_DRAWS && (stock.length > 0 || discardPile.length > 1);
        if (canDrawMore)
          playerDraw();
      }
      // Number keys 1-9 to play cards
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= playerHand.length) {
        const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
        if (topCard && canPlay(playerHand[num - 1], topCard, currentSuit))
          playCard(playerHand, num - 1, true);
      }
    },

    tick(dt) {
      if (roundOver || gameOver || waitingForSuitChoice) return;
      if (!playerTurn) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          aiTurn();
        }
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      playerHand = [];
      aiHand = [];
      stock = [];
      discardPile = [];
      currentSuit = null;
      playerTurn = true;
      drawCount = 0;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      waitingForSuitChoice = false;
      pendingSuitPlayer = -1;
      aiTurnTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('crazy-eights', module);

})();
