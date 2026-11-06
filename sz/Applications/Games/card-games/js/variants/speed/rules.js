/* Speed: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.speed;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, HAND_SIZE, CARD_W, CARD_H, CENTER_Y, CENTER_LEFT_X, CENTER_RIGHT_X,
    PLAYER_HAND_Y, RESERVE_LEFT_X, RESERVE_RIGHT_X, RESERVE_Y } = V;

  function canPlayOn(card, centerCard) {
    if (!card || !centerCard) return false;
    const diff = Math.abs(card.value - centerCard.value);
    return diff === 1 || diff === 12; // wrapping K-A
  }

  function playerHasValidMove() {
    const left = S.centerPiles[0].length > 0 ? S.centerPiles[0][S.centerPiles[0].length - 1] : null;
    const right = S.centerPiles[1].length > 0 ? S.centerPiles[1][S.centerPiles[1].length - 1] : null;
    for (const card of S.playerHand)
      if ((left && canPlayOn(card, left)) || (right && canPlayOn(card, right)))
        return true;
    return false;
  }

  function refillPlayerHand() {
    while (S.playerHand.length < HAND_SIZE && S.playerDraw.length > 0) {
      const c = S.playerDraw.pop();
      c.faceUp = true;
      S.playerHand.push(c);
    }
  }

  function refillAiHand() {
    while (S.aiHand.length < HAND_SIZE && S.aiDraw.length > 0) {
      const c = S.aiDraw.pop();
      c.faceUp = false; // AI cards stay face-down visually
      S.aiHand.push(c);
    }
  }

  function flipReserves() {
    if (!S.showFlipButton) return;

    // If both reserves are empty, reshuffle center piles into reserves
    if (S.playerReserve.length === 0 && S.aiReserve.length === 0) {
      reshuffleCenterIntoReserves();
      if (S.playerReserve.length === 0 && S.aiReserve.length === 0)
        return; // truly stuck, shouldn't happen with a 52-card deck in play
    }

    // Flip one from each reserve onto center piles
    if (S.playerReserve.length > 0) {
      const c = S.playerReserve.pop();
      c.faceUp = true;
      S.centerPiles[0].push(c);
      if (S._host)
        S._host.dealCardAnim(c, RESERVE_LEFT_X, RESERVE_Y, CENTER_LEFT_X, CENTER_Y, 0);
    }

    if (S.aiReserve.length > 0) {
      const c = S.aiReserve.pop();
      c.faceUp = true;
      S.centerPiles[1].push(c);
      if (S._host)
        S._host.dealCardAnim(c, RESERVE_RIGHT_X, RESERVE_Y, CENTER_RIGHT_X, CENTER_Y, 0.05);
    }

    S.showFlipButton = false;
    S.stuckCheckTimer = 0;
    V.resetAiTimer();

    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, CENTER_Y - 10, 'Flip!', { color: '#ff0', size: 20 });
  }

  function reshuffleCenterIntoReserves() {
    // Take all but top card from each center pile, shuffle, redistribute as reserves
    let pool = [];
    for (let i = 0; i < 2; ++i) {
      while (S.centerPiles[i].length > 1) {
        const c = S.centerPiles[i].shift();
        c.faceUp = false;
        pool.push(c);
      }
    }
    if (pool.length === 0) return;
    CE.shuffle(pool);

    const half = Math.ceil(pool.length / 2);
    S.playerReserve = pool.splice(0, half);
    S.aiReserve = pool;

    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, CENTER_Y + CARD_H + 8, 'Reserves reshuffled!', { color: '#8cf', size: 16 });
  }

  function checkWin() {
    // Player wins: hand and draw pile empty
    if (S.playerHand.length === 0 && S.playerDraw.length === 0) {
      const remaining = S.aiHand.length + S.aiDraw.length;
      S.score += remaining * 10 + 100;
      S.roundOver = true;
      S.gameOver = true;
      S.resultMsg = 'YOU WIN! +' + (remaining * 10 + 100) + ' pts';
      if (S._host) {
        S._host.onScoreChanged(S.score);
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
        S._host.onRoundOver(true);
      }
      return true;
    }

    // AI wins: hand and draw pile empty
    if (S.aiHand.length === 0 && S.aiDraw.length === 0) {
      const remaining = S.playerHand.length + S.playerDraw.length;
      S.score = Math.max(0, S.score - remaining * 5);
      S.roundOver = true;
      S.gameOver = true;
      S.resultMsg = 'AI WINS! You had ' + remaining + ' cards left.';
      if (S._host) {
        S._host.onScoreChanged(S.score);
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        S._host.onRoundOver(true);
      }
      return true;
    }

    return false;
  }

  function tryPlayCard(handIndex, pileIndex) {
    if (handIndex < 0 || handIndex >= S.playerHand.length) return false;
    if (pileIndex < 0 || pileIndex > 1) return false;
    if (S.centerPiles[pileIndex].length === 0) return false;

    const card = S.playerHand[handIndex];
    const top = S.centerPiles[pileIndex][S.centerPiles[pileIndex].length - 1];
    if (!canPlayOn(card, top)) return false;

    // Play it
    S.playerHand.splice(handIndex, 1);
    card.faceUp = true;
    S.centerPiles[pileIndex].push(card);

    const targetX = pileIndex === 0 ? CENTER_LEFT_X : CENTER_RIGHT_X;
    if (S._host)
      S._host.dealCardAnim(card, V.handCardX(handIndex, S.playerHand.length + 1), PLAYER_HAND_Y, targetX, CENTER_Y, 0);

    refillPlayerHand();
    S.selectedIndex = -1;
    S.showFlipButton = false;
    S.stuckCheckTimer = 0;

    if (S._host) {
      S._host.onScoreChanged(S.score);
      CE.spawnSparkle([], targetX + CARD_W / 2, CENTER_Y + CARD_H / 2);
    }

    checkWin();
    return true;
  }

  function isHintable(card) {
    if (!S._host || !S._host.hintsEnabled) return false;
    const left = S.centerPiles[0].length > 0 ? S.centerPiles[0][S.centerPiles[0].length - 1] : null;
    const right = S.centerPiles[1].length > 0 ? S.centerPiles[1][S.centerPiles[1].length - 1] : null;
    return (left && canPlayOn(card, left)) || (right && canPlayOn(card, right));
  }

  Object.assign(V, { canPlayOn, playerHasValidMove, refillAiHand, flipReserves, checkWin,
    tryPlayCard, isHintable });

})();
