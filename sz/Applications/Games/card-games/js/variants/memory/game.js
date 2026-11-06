/* Memory: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.memory;
  const S = V.S;
  const { CANVAS_W, FLIP_DURATION } = V;

  /* ================================================================
   *  SETUP / NEW GAME
   * ================================================================ */

  function newGame() {
    S.cards = V.createMemoryDeck();
    S.firstPick = -1;
    S.secondPick = -1;
    S.flipLockTimer = 0;
    S.moves = 0;
    S.matchesFound = 0;
    S.score = 200;
    S.roundOver = false;
    S.gameOver = false;

    if (S._host) {
      S._host.onScoreChanged(S.score);
      startDealAnimation();
    }
  }

  function startDealAnimation() {
    S.dealAnimActive = true;
    S.dealAnimCards = [];
    const now = performance.now();
    for (let i = 0; i < S.cards.length; ++i) {
      const pos = V.cardPos(i);
      S.dealAnimCards.push({
        index: i,
        fromX: CANVAS_W / 2 - CE.CARD_W / 2,
        fromY: -CE.CARD_H,
        toX: pos.x,
        toY: pos.y,
        startTime: now + i * 40,
        duration: 300
      });
    }
    if (S._host && S._host.dealCardAnim) {
      for (let i = 0; i < S.cards.length; ++i) {
        const pos = V.cardPos(i);
        S._host.dealCardAnim(S.cards[i], CANVAS_W / 2, -CE.CARD_H, pos.x, pos.y, i * 0.04);
      }
    }
  }

  /* ================================================================
   *  FLIP ANIMATION
   * ================================================================ */

  function startFlip(index, direction) {
    const card = S.cards[index];
    card.flipDirection = direction;
    card.flipStart = performance.now();
    card.flipProgress = 0;
  }

  function updateFlips(now) {
    for (let i = 0; i < S.cards.length; ++i) {
      const card = S.cards[i];
      if (!card.flipDirection)
        continue;
      const elapsed = now - card.flipStart;
      card.flipProgress = Math.min(elapsed / FLIP_DURATION, 1);
      if (card.flipProgress >= 1) {
        card.flipDirection = null;
        card.flipProgress = 0;
      }
    }
  }

  Object.assign(V, { newGame, startFlip, updateFlips });

})();
