/* Sixty-Six - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.sixtysix;
  const S = V.S;
  const { CANVAS_W, TARGET_POINTS } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChooseCard() {
    const hand = S.aiHand;
    if (hand.length === 0) return -1;
    if (hand.length === 1) return 0;

    const isLeading = S.trickCards.length === 0;
    const legal = isLeading ? hand.map((_, i) => i) : V.getLegalCards(hand, S.trickCards[0]);

    if (legal.length === 1) return legal[0];

    if (isLeading) {
      /* Lead: prefer low-value non-trump. In strict play, lead aces of long suits */
      if (V.isStrictPlay()) {
        for (const i of legal)
          if (hand[i].rank === 'A' && !V.isTrump(hand[i])) return i;
      }
      let bestIdx = legal[0];
      let bestScore = 999;
      for (const i of legal) {
        const c = hand[i];
        const val = V.cardPoints(c) * 20 + V.cardStrength(c) + (V.isTrump(c) ? 100 : 0);
        if (val < bestScore) {
          bestScore = val;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    /* Following */
    const leadCard = S.trickCards[0];
    const leadPts = V.cardPoints(leadCard);

    /* If trick is worthless, dump lowest */
    if (leadPts === 0) {
      let bestIdx = legal[0];
      let bestVal = 999;
      for (const i of legal) {
        const c = hand[i];
        const val = V.cardPoints(c) * 20 + V.cardStrength(c) + (V.isTrump(c) ? 200 : 0);
        if (val < bestVal) {
          bestVal = val;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    /* Try to win cheaply */
    let winnerIdx = -1;
    let winnerCost = 999;
    for (const i of legal) {
      const c = hand[i];
      if (!V.canBeatLeadWith(c, leadCard)) continue;
      const cost = V.cardPoints(c) * 20 + V.cardStrength(c) + (V.isTrump(c) ? 50 : 0);
      if (cost < winnerCost) {
        winnerCost = cost;
        winnerIdx = i;
      }
    }

    if (winnerIdx >= 0 && (leadPts >= 3 || winnerCost < 60))
      return winnerIdx;

    /* Cannot or should not win -- play lowest */
    let lowestIdx = legal[0];
    let lowestVal = 999;
    for (const i of legal) {
      const c = hand[i];
      const val = V.cardPoints(c) * 20 + V.cardStrength(c) + (V.isTrump(c) ? 200 : 0);
      if (val < lowestVal) {
        lowestVal = val;
        lowestIdx = i;
      }
    }
    return lowestIdx;
  }

  /* AI: should we close the stock? */
  function aiShouldClose() {
    if (S.stockClosed || S.stock.length === 0) return false;

    /* Estimate hand strength */
    let handPts = S.aiTrickPoints;
    let trumpCount = 0;
    let highCards = 0;
    for (const c of S.aiHand) {
      handPts += V.cardPoints(c);
      if (V.isTrump(c)) ++trumpCount;
      if (V.cardStrength(c) >= 5) ++highCards; // 10 or A
    }

    /* Close if we likely have 66+ points with our hand */
    if (handPts >= TARGET_POINTS && trumpCount >= 2) return true;
    if (handPts >= TARGET_POINTS + 10 && highCards >= 2) return true;
    return false;
  }

  /* AI: should we declare a marriage? */
  function aiCheckMarriage() {
    if (S.trickCards.length > 0) return null; // must be leading
    const marriages = V.findMarriages(S.aiHand);
    if (marriages.length === 0) return null;

    /* Prefer trump marriage, then highest value */
    for (const suit of marriages)
      if (suit === S.trumpSuit) return suit;
    return marriages[0];
  }

  function aiCardX(idx, total) {
    const maxWidth = 300;
    const fanWidth = Math.min(maxWidth, total * 45);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function aiCardY() {
    return 20;
  }

  Object.assign(V, {
    aiChooseCard, aiShouldClose, aiCheckMarriage, aiCardX, aiCardY
  });

})();
