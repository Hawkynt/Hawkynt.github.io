/* Speed: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.speed;
  const S = V.S;
  const { CARD_W, CENTER_Y, CENTER_LEFT_X, CENTER_RIGHT_X, AI_HAND_Y } = V;

  function aiHasValidMove() {
    const left = S.centerPiles[0].length > 0 ? S.centerPiles[0][S.centerPiles[0].length - 1] : null;
    const right = S.centerPiles[1].length > 0 ? S.centerPiles[1][S.centerPiles[1].length - 1] : null;
    for (const card of S.aiHand)
      if ((left && V.canPlayOn(card, left)) || (right && V.canPlayOn(card, right)))
        return true;
    return false;
  }

  function bothStuck() {
    return !V.playerHasValidMove() && !aiHasValidMove();
  }

  function aiTryPlay() {
    if (S.roundOver || S.gameOver) return;

    const left = S.centerPiles[0].length > 0 ? S.centerPiles[0][S.centerPiles[0].length - 1] : null;
    const right = S.centerPiles[1].length > 0 ? S.centerPiles[1][S.centerPiles[1].length - 1] : null;

    for (let i = 0; i < S.aiHand.length; ++i) {
      const card = S.aiHand[i];
      // Try left pile first
      if (left && V.canPlayOn(card, left)) {
        aiPlayCard(i, 0);
        return;
      }
      // Try right pile
      if (right && V.canPlayOn(card, right)) {
        aiPlayCard(i, 1);
        return;
      }
    }
    // No valid move -- AI does nothing this cycle
  }

  function aiPlayCard(handIndex, pileIndex) {
    const card = S.aiHand.splice(handIndex, 1)[0];
    card.faceUp = true;
    S.centerPiles[pileIndex].push(card);

    const targetX = pileIndex === 0 ? CENTER_LEFT_X : CENTER_RIGHT_X;
    const fromX = V.handCardX(handIndex, S.aiHand.length + 1);
    if (S._host)
      S._host.dealCardAnim(card, fromX, AI_HAND_Y, targetX, CENTER_Y, 0);

    V.refillAiHand();
    S.showFlipButton = false;
    S.stuckCheckTimer = 0;

    if (S._host)
      S._host.floatingText.add(targetX + CARD_W / 2, CENTER_Y - 8, 'AI plays!', { color: '#aaa', size: 12 });

    V.checkWin();
  }

  Object.assign(V, { bothStuck, aiTryPlay });

})();
