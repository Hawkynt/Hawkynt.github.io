/* Schwimmen: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.schwimmen;
  const S = V.S;
  const { CANVAS_W } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiPlay(playerIdx) {
    const hand = S.hands[playerIdx];
    const val = V.handValue(hand);

    // Knock if hand value >= 28
    if (val >= 28 && S.hasKnocked < 0) {
      S.hasKnocked = playerIdx;
      S.knockFinalTurns = 0;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 280, 'AI ' + playerIdx + ' knocks!', { color: '#fa0', size: 20 });
      V.advanceTurn();
      return;
    }

    // Swap all 3 if hand value < 18
    if (val < 18) {
      V.performSwapAll(playerIdx);
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 280, 'AI ' + playerIdx + ' swaps all 3', { color: '#8cf', size: 16 });
      V.advanceTurn();
      return;
    }

    // Try to swap 1 card to maximize same-suit total
    let bestImprovement = 0;
    let bestHandIdx = -1;
    let bestPoolIdx = -1;

    for (let hi = 0; hi < 3; ++hi) {
      for (let pi = 0; pi < 3; ++pi) {
        // Simulate swap
        const origCard = hand[hi];
        const poolCard = S.pool[pi];
        hand[hi] = poolCard;
        const newVal = V.handValue(hand);
        hand[hi] = origCard;
        const improvement = newVal - val;
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestHandIdx = hi;
          bestPoolIdx = pi;
        }
      }
    }

    if (bestHandIdx >= 0 && bestImprovement > 0) {
      V.performSwap1(playerIdx, bestHandIdx, bestPoolIdx);
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 280, 'AI ' + playerIdx + ' swaps 1 card', { color: '#8cf', size: 16 });
      V.advanceTurn();
      return;
    }

    // No good swap available: knock if possible, otherwise swap a random card
    if (S.hasKnocked < 0 && val >= 22) {
      S.hasKnocked = playerIdx;
      S.knockFinalTurns = 0;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 280, 'AI ' + playerIdx + ' knocks!', { color: '#fa0', size: 20 });
      V.advanceTurn();
      return;
    }

    // Swap weakest hand card for best pool card
    let weakestHi = 0;
    let weakestVal = V.cardValue(hand[0]);
    for (let hi = 1; hi < 3; ++hi) {
      if (V.cardValue(hand[hi]) < weakestVal) {
        weakestVal = V.cardValue(hand[hi]);
        weakestHi = hi;
      }
    }
    let bestPi = 0;
    let bestPVal = V.cardValue(S.pool[0]);
    for (let pi = 1; pi < 3; ++pi) {
      if (V.cardValue(S.pool[pi]) > bestPVal) {
        bestPVal = V.cardValue(S.pool[pi]);
        bestPi = pi;
      }
    }
    V.performSwap1(playerIdx, weakestHi, bestPi);
    V.advanceTurn();
  }

  V.aiPlay = aiPlay;

})();
