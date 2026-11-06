/* Bezique: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.bezique;
  const S = V.S;
  const { BRISQUE_POINTS } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChooseCard() {
    const hand = S.aiHand;
    if (hand.length === 0) return -1;
    if (hand.length === 1) return 0;

    const isLeading = S.trickCards.length === 0;
    const phase2 = V.isPhase2();

    if (phase2) {
      const valid = V.getValidIndicesPhase2(hand);
      if (valid.length === 1) return valid[0];

      if (isLeading) {
        // Lead with highest cards in phase 2 to win tricks
        valid.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        // Prefer leading trump aces/tens
        for (const i of valid)
          if (hand[i].rank === 'A' && V.isTrump(hand[i])) return i;
        for (const i of valid)
          if (hand[i].rank === '10' && V.isTrump(hand[i])) return i;
        return valid[0];
      }

      // Following in phase 2: must follow suit/win -- pick cheapest winner
      const leadCard = S.trickCards[0];
      let cheapestWinner = -1;
      let cheapestCost = 999;
      for (const i of valid) {
        const c = hand[i];
        const wouldWin = V.canBeatCard(c, leadCard);
        if (wouldWin) {
          const cost = V.cardStrength(c) + (V.isTrump(c) ? 50 : 0);
          if (cost < cheapestCost) {
            cheapestCost = cost;
            cheapestWinner = i;
          }
        }
      }
      if (cheapestWinner >= 0) return cheapestWinner;

      // Can't win: play lowest
      valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return valid[0];
    }

    // Phase 1: no obligation to follow suit
    if (isLeading) {
      // Check if we have melds to protect -- keep meld cards
      const melds = V.getAvailableMelds(1);
      const meldCardIds = new Set();
      for (const m of melds)
        for (const c of m.cards)
          meldCardIds.add(V.cardId(c));

      // Lead low non-meld, non-trump cards
      let bestIdx = 0;
      let bestScore = 999;
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        let val = V.cardStrength(c);
        if (V.isTrump(c)) val += 100;
        if (meldCardIds.has(V.cardId(c))) val += 200;
        if (BRISQUE_POINTS[c.rank]) val += 50;
        if (val < bestScore) {
          bestScore = val;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    // Following in phase 1: try to win valuable tricks
    const leadCard = S.trickCards[0];
    const leadPts = BRISQUE_POINTS[leadCard.rank] || 0;

    if (leadPts > 0) {
      // Trick has value: try to win cheaply
      let bestIdx = -1;
      let bestCost = 999;
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        if (!V.canBeatCard(c, leadCard)) continue;
        const cost = V.cardStrength(c) + (V.isTrump(c) ? 50 : 0);
        if (cost < bestCost) {
          bestCost = cost;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) return bestIdx;
    }

    // Dump lowest value card
    const melds = V.getAvailableMelds(1);
    const meldCardIds = new Set();
    for (const m of melds)
      for (const c of m.cards)
        meldCardIds.add(V.cardId(c));

    let lowestIdx = 0;
    let lowestVal = 999;
    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      let val = V.cardStrength(c);
      if (V.isTrump(c)) val += 100;
      if (meldCardIds.has(V.cardId(c))) val += 200;
      if (BRISQUE_POINTS[c.rank]) val += 30;
      if (val < lowestVal) {
        lowestVal = val;
        lowestIdx = i;
      }
    }
    return lowestIdx;
  }

  function aiSelectMeld() {
    const melds = V.getAvailableMelds(1);
    if (melds.length === 0) return null;
    // Pick highest value meld
    melds.sort((a, b) => b.points - a.points);
    return melds[0];
  }

  /* ================================================================
     AI PHASE 2 HELPER
     ================================================================ */

  function aiChooseCardPhase2(validIdxs) {
    const hand = S.aiHand;
    if (validIdxs.length === 1) return validIdxs[0];

    const isLeading = S.trickCards.length === 0;
    if (isLeading) {
      // Lead aces and tens to secure brisques
      for (const i of validIdxs)
        if (hand[i].rank === 'A') return i;
      for (const i of validIdxs)
        if (hand[i].rank === '10') return i;
      // Lead highest
      validIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      return validIdxs[0];
    }

    // Following: pick cheapest winner
    const leadCard = S.trickCards[0];
    let cheapestWinner = -1;
    let cheapestCost = 999;
    for (const i of validIdxs) {
      const c = hand[i];
      if (V.canBeatCard(c, leadCard)) {
        const cost = V.cardStrength(c) + (V.isTrump(c) ? 50 : 0);
        if (cost < cheapestCost) {
          cheapestCost = cost;
          cheapestWinner = i;
        }
      }
    }
    if (cheapestWinner >= 0) return cheapestWinner;

    // Can't win: play lowest
    validIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
    return validIdxs[0];
  }

  V.aiChooseCard = aiChooseCard;
  V.aiSelectMeld = aiSelectMeld;
  V.aiChooseCardPhase2 = aiChooseCardPhase2;

})();
