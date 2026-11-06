/* Sevens: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.sevens;
  const S = V.S;

  function aiChooseCard(playerIdx) {
    const hand = S.hands[playerIdx];
    const valid = V.getValidPlays(hand);
    if (valid.length === 0) return -1;
    if (valid.length === 1) return valid[0];

    // Score each valid play: prefer plays that open fewer options for opponents
    let bestIdx = valid[0];
    let bestScore = -Infinity;

    for (const vi of valid) {
      const card = hand[vi];
      const ri = V.rankIdx(card);
      const suit = card.suit;
      let evalScore = 0;

      // Prefer playing 7s early (opens the row)
      if (ri === 6) {
        evalScore += 15;
        // Prefer suits where we hold adjacent cards
        const has6 = hand.some(c => c.suit === suit && V.rankIdx(c) === 5);
        const has8 = hand.some(c => c.suit === suit && V.rankIdx(c) === 7);
        if (has6) evalScore += 5;
        if (has8) evalScore += 5;
      }

      // Prefer extending toward cards we hold (unblocks our own hand)
      const row = S.suitRows[suit];
      if (row) {
        const nextLow = ri - 1;
        const nextHigh = ri + 1;
        const weHaveNext = hand.some(c =>
          c.suit === suit && (V.rankIdx(c) === nextLow || V.rankIdx(c) === nextHigh)
        );
        if (weHaveNext) evalScore += 8;

        // Penalize opening directions where opponents probably benefit
        // (if we don't hold the next card, opponents might)
        if (!weHaveNext) evalScore -= 3;
      }

      // Prefer playing extreme cards (A, K) to clear blocking potential
      if (ri === 0 || ri === 12) evalScore += 4;
      if (ri === 1 || ri === 11) evalScore += 2;

      // Prefer playing cards from suits where we hold the most cards
      const suitCount = hand.filter(c => c.suit === suit).length;
      evalScore += suitCount;

      if (evalScore > bestScore) {
        bestScore = evalScore;
        bestIdx = vi;
      }
    }

    return bestIdx;
  }

  Object.assign(V, { aiChooseCard });

})();
