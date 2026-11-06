/* Briscola: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.briscola;
  const S = V.S;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChooseCard() {
    const hand = S.aiHand;
    if (hand.length === 0) return -1;
    if (hand.length === 1) return 0;

    const isLeading = S.trickCards.length === 0;

    if (isLeading) {
      /* Lead: prefer low-value non-trump cards */
      let bestIdx = 0;
      let bestScore = 999;
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        const val = V.cardPoints(c) * 20 + V.cardStrength(c) + (V.isTrump(c) ? 100 : 0);
        if (val < bestScore) {
          bestScore = val;
          bestIdx = i;
        }
      }
      /* Lead aces when safe: if stock is empty and the ace would not be at risk */
      if (S.stock.length === 0) {
        for (let i = 0; i < hand.length; ++i)
          if (hand[i].rank === 'A' && !V.isTrump(hand[i])) return i;
      }
      return bestIdx;
    }

    /* Following */
    const leadCard = S.trickCards[0];
    const leadPts = V.cardPoints(leadCard);

    /* If the trick is worthless (0 points), dump a low card */
    if (leadPts === 0) {
      let bestIdx = 0;
      let bestVal = 999;
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        const val = V.cardPoints(c) * 20 + V.cardStrength(c) + (V.isTrump(c) ? 200 : 0);
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
      if (!V.canBeatLeadWith(c, leadCard)) continue;
      const cost = V.cardPoints(c) * 20 + V.cardStrength(c) + (V.isTrump(c) ? 50 : 0);
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
      const val = V.cardPoints(c) * 20 + V.cardStrength(c) + (V.isTrump(c) ? 200 : 0);
      if (val < lowestVal) {
        lowestVal = val;
        lowestIdx = i;
      }
    }
    return lowestIdx;
  }

  V.aiChooseCard = aiChooseCard;

})();
