/* 8-Color Duo: opponent decisions and turn pacing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['duo'];
  const S = V.S;
  const { AI_TURN_DELAY } = V;

  function aiTurn() {
    if (S.roundOver || S.gameOver || S.waitingForColorChoice) return;

    if (S.drawStack > 0) {
      const hand = S.hands[S.currentPlayer];
      for (let i = 0; i < hand.length; ++i) {
        if (V.canPlay(hand[i], S.topCard)) {
          V.playCard(S.currentPlayer, i);
          return;
        }
      }
      V.applyDrawStack(S.currentPlayer);
      V.advancePlayer();
      return;
    }

    const hand = S.hands[S.currentPlayer];
    let bestIdx = -1;
    let bestPriority = -1;
    for (let i = 0; i < hand.length; ++i) {
      if (!V.canPlay(hand[i], S.topCard)) continue;
      let priority = 1;
      if (hand[i].type === 'action') priority = 3;
      else if (hand[i].type === 'number') priority = 2;
      else if (hand[i].value === 'Wild') priority = 0;
      else if (hand[i].value === 'Wild Draw Four') priority = 4;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      V.playCard(S.currentPlayer, bestIdx);
      return;
    }

    V.refillDeck();
    if (S.deck.length > 0)
      hand.push(S.deck.pop());
    V.advancePlayer();
  }

  function tick(dt) {
    if (S.roundOver || S.gameOver || S.waitingForColorChoice) return;
    if (S.currentPlayer !== 0) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        aiTurn();
      }
    }
  }

  Object.assign(V, { tick });

})();
