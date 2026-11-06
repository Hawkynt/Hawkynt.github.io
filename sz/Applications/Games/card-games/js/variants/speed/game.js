/* Speed: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.speed;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, HAND_SIZE, DRAW_PILE_SIZE, RESERVE_SIZE, CARD_H, AI_MIN_DELAY,
    AI_MAX_DELAY, PLAYER_HAND_Y, AI_HAND_Y, STUCK_CHECK_INTERVAL } = V;

  function resetAiTimer() {
    S.aiDelay = AI_MIN_DELAY + Math.random() * (AI_MAX_DELAY - AI_MIN_DELAY);
    S.aiTimer = 0;
  }

  function setupSpeed() {
    const deck = CE.shuffle(CE.createDeck());

    // Split into two 26-card halves
    const half1 = deck.slice(0, 26);
    const half2 = deck.slice(26, 52);

    // Player: 15 draw, 5 hand, 3 reserve (from half1 -- 23 cards used, 3 go to reserve)
    S.playerDraw = half1.slice(0, DRAW_PILE_SIZE);
    S.playerHand = half1.slice(DRAW_PILE_SIZE, DRAW_PILE_SIZE + HAND_SIZE);
    S.playerReserve = half1.slice(DRAW_PILE_SIZE + HAND_SIZE, DRAW_PILE_SIZE + HAND_SIZE + RESERVE_SIZE);

    // Remaining cards from half1 go to reserve (should be exactly 3)
    for (const c of S.playerHand)
      c.faceUp = true;
    for (const c of S.playerReserve)
      c.faceUp = false;

    // AI: 15 draw, 5 hand, 3 reserve (from half2)
    S.aiDraw = half2.slice(0, DRAW_PILE_SIZE);
    S.aiHand = half2.slice(DRAW_PILE_SIZE, DRAW_PILE_SIZE + HAND_SIZE);
    S.aiReserve = half2.slice(DRAW_PILE_SIZE + HAND_SIZE, DRAW_PILE_SIZE + HAND_SIZE + RESERVE_SIZE);

    for (const c of S.aiHand)
      c.faceUp = false;
    for (const c of S.aiReserve)
      c.faceUp = false;

    // Start center piles: flip one card from each reserve
    S.centerPiles = [[], []];
    if (S.playerReserve.length > 0) {
      const c = S.playerReserve.pop();
      c.faceUp = true;
      S.centerPiles[0].push(c);
    }
    if (S.aiReserve.length > 0) {
      const c = S.aiReserve.pop();
      c.faceUp = true;
      S.centerPiles[1].push(c);
    }

    S.selectedIndex = -1;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.showFlipButton = false;
    S.stuckCheckTimer = 0;
    resetAiTimer();

    // Deal animation
    if (S._host) {
      for (let i = 0; i < S.playerHand.length; ++i)
        S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, CANVAS_H + CARD_H, V.handCardX(i, HAND_SIZE), PLAYER_HAND_Y, i * 0.07);
      for (let i = 0; i < S.aiHand.length; ++i)
        S._host.dealCardAnim(S.aiHand[i], CANVAS_W / 2, -CARD_H, V.handCardX(i, HAND_SIZE), AI_HAND_Y, (i + HAND_SIZE) * 0.07);
    }
  }

  function tickImpl(dt) {
    if (S.roundOver || S.gameOver) return;

    // AI plays on a timer
    S.aiTimer += dt;
    if (S.aiTimer >= S.aiDelay) {
      V.aiTryPlay();
      resetAiTimer();
    }

    // Stuck check
    S.stuckCheckTimer += dt;
    if (S.stuckCheckTimer >= STUCK_CHECK_INTERVAL) {
      S.stuckCheckTimer = 0;
      if (V.bothStuck())
        S.showFlipButton = true;
      else
        S.showFlipButton = false;
    }
  }

  Object.assign(V, { resetAiTimer, setupSpeed, tickImpl });

})();
