;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const HAND_SIZE = 5;
  const DRAW_PILE_SIZE = 18;
  const RESERVE_SIZE = 3;
  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;

  /* ── AI timing ── */
  const AI_MIN_DELAY = 0.4;
  const AI_MAX_DELAY = 0.8;

  /* ── Layout ── */
  const CENTER_Y = CANVAS_H / 2 - CARD_H / 2;
  const CENTER_GAP = 30;
  const CENTER_LEFT_X = CANVAS_W / 2 - CARD_W - CENTER_GAP / 2;
  const CENTER_RIGHT_X = CANVAS_W / 2 + CENTER_GAP / 2;

  const PLAYER_HAND_Y = CANVAS_H - CARD_H - 40;
  const AI_HAND_Y = 40;

  const PLAYER_DRAW_X = 40;
  const PLAYER_DRAW_Y = PLAYER_HAND_Y;
  const AI_DRAW_X = 40;
  const AI_DRAW_Y = AI_HAND_Y;

  const RESERVE_LEFT_X = 60;
  const RESERVE_RIGHT_X = CANVAS_W - 60 - CARD_W;
  const RESERVE_Y = CENTER_Y;

  const FLIP_BTN = { x: CANVAS_W / 2 - 50, y: CENTER_Y + CARD_H + 16, w: 100, h: 32 };

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let playerHand = [];
  let playerDraw = [];
  let playerReserve = [];

  let aiHand = [];
  let aiDraw = [];
  let aiReserve = [];

  let centerPiles = [[], []]; // two center piles (arrays of cards, top = last)

  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';

  /* ── Selection ── */
  let selectedIndex = -1; // index in playerHand, -1 = none

  /* ── AI timer ── */
  let aiTimer = 0;
  let aiDelay = 0;

  /* ── Stuck detection ── */
  let showFlipButton = false;
  let stuckCheckTimer = 0;
  const STUCK_CHECK_INTERVAL = 0.6;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ══════════════════════════════════════════════════════════════════
     CARD VALIDATION
     ══════════════════════════════════════════════════════════════════ */

  function canPlayOn(card, centerCard) {
    if (!card || !centerCard) return false;
    const diff = Math.abs(card.value - centerCard.value);
    return diff === 1 || diff === 12; // wrapping K-A
  }

  /* ══════════════════════════════════════════════════════════════════
     HAND LAYOUT HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function handCardX(index, handLen) {
    const totalW = handLen * CARD_W + (handLen - 1) * 10;
    const startX = CANVAS_W / 2 - totalW / 2;
    return startX + index * (CARD_W + 10);
  }

  /* ══════════════════════════════════════════════════════════════════
     STUCK DETECTION
     ══════════════════════════════════════════════════════════════════ */

  function playerHasValidMove() {
    const left = centerPiles[0].length > 0 ? centerPiles[0][centerPiles[0].length - 1] : null;
    const right = centerPiles[1].length > 0 ? centerPiles[1][centerPiles[1].length - 1] : null;
    for (const card of playerHand)
      if ((left && canPlayOn(card, left)) || (right && canPlayOn(card, right)))
        return true;
    return false;
  }

  function aiHasValidMove() {
    const left = centerPiles[0].length > 0 ? centerPiles[0][centerPiles[0].length - 1] : null;
    const right = centerPiles[1].length > 0 ? centerPiles[1][centerPiles[1].length - 1] : null;
    for (const card of aiHand)
      if ((left && canPlayOn(card, left)) || (right && canPlayOn(card, right)))
        return true;
    return false;
  }

  function bothStuck() {
    return !playerHasValidMove() && !aiHasValidMove();
  }

  /* ══════════════════════════════════════════════════════════════════
     REFILL HAND
     ══════════════════════════════════════════════════════════════════ */

  function refillPlayerHand() {
    while (playerHand.length < HAND_SIZE && playerDraw.length > 0) {
      const c = playerDraw.pop();
      c.faceUp = true;
      playerHand.push(c);
    }
  }

  function refillAiHand() {
    while (aiHand.length < HAND_SIZE && aiDraw.length > 0) {
      const c = aiDraw.pop();
      c.faceUp = false; // AI cards stay face-down visually
      aiHand.push(c);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     FLIP RESERVES
     ══════════════════════════════════════════════════════════════════ */

  function flipReserves() {
    if (!showFlipButton) return;

    // If both reserves are empty, reshuffle center piles into reserves
    if (playerReserve.length === 0 && aiReserve.length === 0) {
      reshuffleCenterIntoReserves();
      if (playerReserve.length === 0 && aiReserve.length === 0)
        return; // truly stuck, shouldn't happen with a 52-card deck in play
    }

    // Flip one from each reserve onto center piles
    if (playerReserve.length > 0) {
      const c = playerReserve.pop();
      c.faceUp = true;
      centerPiles[0].push(c);
      if (_host)
        _host.dealCardAnim(c, RESERVE_LEFT_X, RESERVE_Y, CENTER_LEFT_X, CENTER_Y, 0);
    }

    if (aiReserve.length > 0) {
      const c = aiReserve.pop();
      c.faceUp = true;
      centerPiles[1].push(c);
      if (_host)
        _host.dealCardAnim(c, RESERVE_RIGHT_X, RESERVE_Y, CENTER_RIGHT_X, CENTER_Y, 0.05);
    }

    showFlipButton = false;
    stuckCheckTimer = 0;
    resetAiTimer();

    if (_host)
      _host.floatingText.add(CANVAS_W / 2, CENTER_Y - 10, 'Flip!', { color: '#ff0', size: 20 });
  }

  function reshuffleCenterIntoReserves() {
    // Take all but top card from each center pile, shuffle, redistribute as reserves
    let pool = [];
    for (let i = 0; i < 2; ++i) {
      while (centerPiles[i].length > 1) {
        const c = centerPiles[i].shift();
        c.faceUp = false;
        pool.push(c);
      }
    }
    if (pool.length === 0) return;
    CE.shuffle(pool);

    const half = Math.ceil(pool.length / 2);
    playerReserve = pool.splice(0, half);
    aiReserve = pool;

    if (_host)
      _host.floatingText.add(CANVAS_W / 2, CENTER_Y + CARD_H + 8, 'Reserves reshuffled!', { color: '#8cf', size: 16 });
  }

  /* ══════════════════════════════════════════════════════════════════
     WIN/LOSS DETECTION
     ══════════════════════════════════════════════════════════════════ */

  function checkWin() {
    // Player wins: hand and draw pile empty
    if (playerHand.length === 0 && playerDraw.length === 0) {
      const remaining = aiHand.length + aiDraw.length;
      score += remaining * 10 + 100;
      roundOver = true;
      gameOver = true;
      resultMsg = 'YOU WIN! +' + (remaining * 10 + 100) + ' pts';
      if (_host) {
        _host.onScoreChanged(score);
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
        _host.onRoundOver(true);
      }
      return true;
    }

    // AI wins: hand and draw pile empty
    if (aiHand.length === 0 && aiDraw.length === 0) {
      const remaining = playerHand.length + playerDraw.length;
      score = Math.max(0, score - remaining * 5);
      roundOver = true;
      gameOver = true;
      resultMsg = 'AI WINS! You had ' + remaining + ' cards left.';
      if (_host) {
        _host.onScoreChanged(score);
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        _host.onRoundOver(true);
      }
      return true;
    }

    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function tryPlayCard(handIndex, pileIndex) {
    if (handIndex < 0 || handIndex >= playerHand.length) return false;
    if (pileIndex < 0 || pileIndex > 1) return false;
    if (centerPiles[pileIndex].length === 0) return false;

    const card = playerHand[handIndex];
    const top = centerPiles[pileIndex][centerPiles[pileIndex].length - 1];
    if (!canPlayOn(card, top)) return false;

    // Play it
    playerHand.splice(handIndex, 1);
    card.faceUp = true;
    centerPiles[pileIndex].push(card);

    const targetX = pileIndex === 0 ? CENTER_LEFT_X : CENTER_RIGHT_X;
    if (_host)
      _host.dealCardAnim(card, handCardX(handIndex, playerHand.length + 1), PLAYER_HAND_Y, targetX, CENTER_Y, 0);

    refillPlayerHand();
    selectedIndex = -1;
    showFlipButton = false;
    stuckCheckTimer = 0;

    if (_host) {
      _host.onScoreChanged(score);
      CE.spawnSparkle([], targetX + CARD_W / 2, CENTER_Y + CARD_H / 2);
    }

    checkWin();
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════
     AI LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function resetAiTimer() {
    aiDelay = AI_MIN_DELAY + Math.random() * (AI_MAX_DELAY - AI_MIN_DELAY);
    aiTimer = 0;
  }

  function aiTryPlay() {
    if (roundOver || gameOver) return;

    const left = centerPiles[0].length > 0 ? centerPiles[0][centerPiles[0].length - 1] : null;
    const right = centerPiles[1].length > 0 ? centerPiles[1][centerPiles[1].length - 1] : null;

    for (let i = 0; i < aiHand.length; ++i) {
      const card = aiHand[i];
      // Try left pile first
      if (left && canPlayOn(card, left)) {
        aiPlayCard(i, 0);
        return;
      }
      // Try right pile
      if (right && canPlayOn(card, right)) {
        aiPlayCard(i, 1);
        return;
      }
    }
    // No valid move -- AI does nothing this cycle
  }

  function aiPlayCard(handIndex, pileIndex) {
    const card = aiHand.splice(handIndex, 1)[0];
    card.faceUp = true;
    centerPiles[pileIndex].push(card);

    const targetX = pileIndex === 0 ? CENTER_LEFT_X : CENTER_RIGHT_X;
    const fromX = handCardX(handIndex, aiHand.length + 1);
    if (_host)
      _host.dealCardAnim(card, fromX, AI_HAND_Y, targetX, CENTER_Y, 0);

    refillAiHand();
    showFlipButton = false;
    stuckCheckTimer = 0;

    if (_host)
      _host.floatingText.add(targetX + CARD_W / 2, CENTER_Y - 8, 'AI plays!', { color: '#aaa', size: 12 });

    checkWin();
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupSpeed() {
    const deck = CE.shuffle(CE.createDeck());

    // Split into two 26-card halves
    const half1 = deck.slice(0, 26);
    const half2 = deck.slice(26, 52);

    // Player: 15 draw, 5 hand, 3 reserve (from half1 -- 23 cards used, 3 go to reserve)
    playerDraw = half1.slice(0, DRAW_PILE_SIZE);
    playerHand = half1.slice(DRAW_PILE_SIZE, DRAW_PILE_SIZE + HAND_SIZE);
    playerReserve = half1.slice(DRAW_PILE_SIZE + HAND_SIZE, DRAW_PILE_SIZE + HAND_SIZE + RESERVE_SIZE);

    // Remaining cards from half1 go to reserve (should be exactly 3)
    for (const c of playerHand)
      c.faceUp = true;
    for (const c of playerReserve)
      c.faceUp = false;

    // AI: 15 draw, 5 hand, 3 reserve (from half2)
    aiDraw = half2.slice(0, DRAW_PILE_SIZE);
    aiHand = half2.slice(DRAW_PILE_SIZE, DRAW_PILE_SIZE + HAND_SIZE);
    aiReserve = half2.slice(DRAW_PILE_SIZE + HAND_SIZE, DRAW_PILE_SIZE + HAND_SIZE + RESERVE_SIZE);

    for (const c of aiHand)
      c.faceUp = false;
    for (const c of aiReserve)
      c.faceUp = false;

    // Start center piles: flip one card from each reserve
    centerPiles = [[], []];
    if (playerReserve.length > 0) {
      const c = playerReserve.pop();
      c.faceUp = true;
      centerPiles[0].push(c);
    }
    if (aiReserve.length > 0) {
      const c = aiReserve.pop();
      c.faceUp = true;
      centerPiles[1].push(c);
    }

    selectedIndex = -1;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    showFlipButton = false;
    stuckCheckTimer = 0;
    resetAiTimer();

    // Deal animation
    if (_host) {
      for (let i = 0; i < playerHand.length; ++i)
        _host.dealCardAnim(playerHand[i], CANVAS_W / 2, CANVAS_H + CARD_H, handCardX(i, HAND_SIZE), PLAYER_HAND_Y, i * 0.07);
      for (let i = 0; i < aiHand.length; ++i)
        _host.dealCardAnim(aiHand[i], CANVAS_W / 2, -CARD_H, handCardX(i, HAND_SIZE), AI_HAND_Y, (i + HAND_SIZE) * 0.07);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function drawPileStack(x, y, count, label, labelBelow) {
    if (count > 0) {
      const layers = Math.min(count, 3);
      for (let i = 0; i < layers - 1; ++i)
        CE.drawCardBack(_ctx, x + i * 2, y + i * 2);
      CE.drawCardBack(_ctx, x + (layers - 1) * 2, y + (layers - 1) * 2);
    } else
      CE.drawEmptySlot(_ctx, x, y);

    _ctx.save();
    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    const labelY = labelBelow ? y + CARD_H + 14 : y - 8;
    _ctx.fillText(label + ' (' + count + ')', x + CARD_W / 2, labelY);
    _ctx.restore();
  }

  function drawCenterPile(x, y, pile, label) {
    if (pile.length > 0) {
      const top = pile[pile.length - 1];
      if (!top._dealing)
        CE.drawCardFace(_ctx, x, y, top);
    } else
      CE.drawEmptySlot(_ctx, x, y, label);
  }

  /* ══════════════════════════════════════════════════════════════════
     HINT DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function isHintable(card) {
    if (!_host || !_host.hintsEnabled) return false;
    const left = centerPiles[0].length > 0 ? centerPiles[0][centerPiles[0].length - 1] : null;
    const right = centerPiles[1].length > 0 ? centerPiles[1][centerPiles[1].length - 1] : null;
    return (left && canPlayOn(card, left)) || (right && canPlayOn(card, right));
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawSpeed() {
    /* ── Title ── */
    _ctx.save();
    _ctx.fillStyle = '#ddd';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText('SPEED', CANVAS_W / 2, 8);
    _ctx.restore();

    /* ── AI hand (face-down) ── */
    for (let i = 0; i < aiHand.length; ++i) {
      const x = handCardX(i, aiHand.length);
      CE.drawCardBack(_ctx, x, AI_HAND_Y);
    }

    /* ── AI draw pile ── */
    drawPileStack(AI_DRAW_X, AI_DRAW_Y, aiDraw.length, 'AI Draw', false);

    /* ── AI reserve pile ── */
    drawPileStack(RESERVE_RIGHT_X, RESERVE_Y, aiReserve.length, 'Reserve', false);

    /* ── Center piles ── */
    drawCenterPile(CENTER_LEFT_X, CENTER_Y, centerPiles[0], 'L');
    drawCenterPile(CENTER_RIGHT_X, CENTER_Y, centerPiles[1], 'R');

    /* ── Center pile labels ── */
    _ctx.save();
    _ctx.fillStyle = '#888';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Left Pile', CENTER_LEFT_X + CARD_W / 2, CENTER_Y - 10);
    _ctx.fillText('Right Pile', CENTER_RIGHT_X + CARD_W / 2, CENTER_Y - 10);
    _ctx.restore();

    /* ── Player reserve pile ── */
    drawPileStack(RESERVE_LEFT_X, RESERVE_Y, playerReserve.length, 'Reserve', true);

    /* ── Flip button ── */
    if (showFlipButton && !roundOver && !gameOver) {
      CE.drawButton(_ctx, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h, 'Flip (F)', {
        bg: '#8a4000', border: '#fa0', textColor: '#fff', fontSize: 14
      });
    }

    /* ── Player draw pile ── */
    drawPileStack(PLAYER_DRAW_X, PLAYER_DRAW_Y, playerDraw.length, 'Your Draw', true);

    /* ── Player hand (face-up) ── */
    for (let i = 0; i < playerHand.length; ++i) {
      const x = handCardX(i, playerHand.length);
      const y = selectedIndex === i ? PLAYER_HAND_Y - 12 : PLAYER_HAND_Y;
      CE.drawCardFace(_ctx, x, y, playerHand[i]);

      // Selection highlight
      if (selectedIndex === i)
        CE.drawSelectionHighlight(_ctx, x, y, CARD_H);

      // Hint glow
      if (selectedIndex < 0 && isHintable(playerHand[i]))
        CE.drawHintGlow(_ctx, x, y, CARD_W, CARD_H, _host ? _host.hintTime : 0);
    }

    /* ── Highlight center piles when a card is selected ── */
    if (selectedIndex >= 0 && selectedIndex < playerHand.length) {
      const card = playerHand[selectedIndex];
      for (let p = 0; p < 2; ++p) {
        if (centerPiles[p].length === 0) continue;
        const top = centerPiles[p][centerPiles[p].length - 1];
        if (canPlayOn(card, top)) {
          const px = p === 0 ? CENTER_LEFT_X : CENTER_RIGHT_X;
          _ctx.save();
          _ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
          _ctx.lineWidth = 3;
          _ctx.shadowColor = '#0f0';
          _ctx.shadowBlur = 8;
          CE.drawRoundedRect(_ctx, px - 2, CENTER_Y - 2, CARD_W + 4, CARD_H + 4, CE.CARD_RADIUS + 1);
          _ctx.stroke();
          _ctx.restore();
        }
      }
    }

    /* ── Score / card counts ── */
    _ctx.save();
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Score: ' + score, 16, CANVAS_H - 10);
    _ctx.restore();

    _ctx.save();
    _ctx.fillStyle = '#8f8';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('Your cards: ' + (playerHand.length + playerDraw.length), CANVAS_W - 16, CANVAS_H - 22);
    _ctx.fillStyle = '#f88';
    _ctx.fillText('AI cards: ' + (aiHand.length + aiDraw.length), CANVAS_W - 16, CANVAS_H - 8);
    _ctx.restore();

    /* ── Instructions ── */
    if (!roundOver && !gameOver && selectedIndex < 0 && !showFlipButton) {
      _ctx.save();
      _ctx.fillStyle = '#777';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Click a card in your hand, then click a center pile (\u00b11 rank). Press 1-5 + L/R for keyboard play.', CANVAS_W / 2, CANVAS_H - 24);
      _ctx.restore();
    }

    /* ── Game over overlay ── */
    if (roundOver || gameOver) {
      _ctx.save();
      _ctx.fillStyle = 'rgba(0,0,0,0.5)';
      _ctx.fillRect(0, CANVAS_H / 2 - 44, CANVAS_W, 88);
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 24px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 10);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '14px sans-serif';
      _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 18);
      _ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  function handleClickImpl(mx, my) {
    if (roundOver || gameOver) {
      if (_host) _host.onRoundOver(gameOver);
      return;
    }

    // Flip button
    if (showFlipButton && CE.isInRect(mx, my, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h)) {
      flipReserves();
      return;
    }

    // Click on center pile when card is selected
    if (selectedIndex >= 0) {
      if (CE.isInRect(mx, my, CENTER_LEFT_X, CENTER_Y, CARD_W, CARD_H)) {
        if (tryPlayCard(selectedIndex, 0)) return;
      }
      if (CE.isInRect(mx, my, CENTER_RIGHT_X, CENTER_Y, CARD_W, CARD_H)) {
        if (tryPlayCard(selectedIndex, 1)) return;
      }
    }

    // Click on player hand card
    for (let i = 0; i < playerHand.length; ++i) {
      const x = handCardX(i, playerHand.length);
      const y = selectedIndex === i ? PLAYER_HAND_Y - 12 : PLAYER_HAND_Y;
      if (CE.isInRect(mx, my, x, y, CARD_W, CARD_H)) {
        if (selectedIndex === i) {
          selectedIndex = -1; // deselect
        } else {
          selectedIndex = i;
          // Auto-play: if only one valid pile, play immediately
          const leftValid = centerPiles[0].length > 0 && canPlayOn(playerHand[i], centerPiles[0][centerPiles[0].length - 1]);
          const rightValid = centerPiles[1].length > 0 && canPlayOn(playerHand[i], centerPiles[1][centerPiles[1].length - 1]);
          if (leftValid && !rightValid) {
            tryPlayCard(i, 0);
            return;
          }
          if (!leftValid && rightValid) {
            tryPlayCard(i, 1);
            return;
          }
          // Both valid or neither -- keep selected for pile click
        }
        return;
      }
    }

    // Click elsewhere deselects
    selectedIndex = -1;
  }

  function handleKeyImpl(e) {
    if (roundOver || gameOver) return;

    // F = flip
    if (e.key === 'f' || e.key === 'F') {
      if (showFlipButton)
        flipReserves();
      return;
    }

    // 1-5 selects card in hand
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 5) {
      const idx = num - 1;
      if (idx < playerHand.length) {
        if (selectedIndex === idx)
          selectedIndex = -1;
        else
          selectedIndex = idx;
      }
      return;
    }

    // L/R or Left/Right to play selected card on a pile
    if (selectedIndex >= 0) {
      if (e.key === 'l' || e.key === 'L' || e.key === 'ArrowLeft') {
        tryPlayCard(selectedIndex, 0);
        return;
      }
      if (e.key === 'r' || e.key === 'R' || e.key === 'ArrowRight') {
        tryPlayCard(selectedIndex, 1);
        return;
      }
    }

    // Space = flip if stuck
    if (e.key === ' ' && showFlipButton) {
      flipReserves();
      return;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     TICK
     ══════════════════════════════════════════════════════════════════ */

  function tickImpl(dt) {
    if (roundOver || gameOver) return;

    // AI plays on a timer
    aiTimer += dt;
    if (aiTimer >= aiDelay) {
      aiTryPlay();
      resetAiTimer();
    }

    // Stuck check
    stuckCheckTimer += dt;
    if (stuckCheckTimer >= STUCK_CHECK_INTERVAL) {
      stuckCheckTimer = 0;
      if (bothStuck())
        showFlipButton = true;
      else
        showFlipButton = false;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupSpeed();
      if (_host) _host.onScoreChanged(score);
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawSpeed();
    },

    handleClick(mx, my) {
      handleClickImpl(mx, my);
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      handleKeyImpl(e);
    },

    tick(dt) {
      tickImpl(dt);
    },

    cleanup() {
      playerHand = [];
      playerDraw = [];
      playerReserve = [];
      aiHand = [];
      aiDraw = [];
      aiReserve = [];
      centerPiles = [[], []];
      selectedIndex = -1;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      showFlipButton = false;
      stuckCheckTimer = 0;
      aiTimer = 0;
      aiDelay = 0;
      score = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('speed', module);

})();
