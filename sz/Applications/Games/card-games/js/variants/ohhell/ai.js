/* Oh Hell - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.ohhell;
  const S = V.S;

  /* ================================================================
     AI LOGIC -- BIDDING
     ================================================================ */

  function aiBid(playerIdx) {
    const hand = S.hands[playerIdx];
    let bid = 0;

    for (const c of hand) {
      if (c.rank === 'A') ++bid;
      if (c.rank === 'K' && hand.filter(h => h.suit === c.suit).length >= 2) bid += 0.5;
      if (V.isTrump(c) && V.cardStrength(c) >= 11) ++bid;
    }

    const trumpCount = S.trumpSuit ? hand.filter(c => c.suit === S.trumpSuit).length : 0;
    if (trumpCount >= 3) bid += 0.5;

    bid = Math.round(bid);
    bid = Math.max(0, Math.min(bid, S.handSize));

    /* Respect hook rule if last bidder */
    const forbidden = V.forbiddenBid();
    if (forbidden >= 0 && bid === forbidden) {
      if (bid > 0) --bid;
      else ++bid;
      bid = Math.max(0, Math.min(bid, S.handSize));
    }

    return bid;
  }

  /* ================================================================
     AI LOGIC -- PLAY
     ================================================================ */

  function aiChooseCard(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return -1;

    const valid = V.getValidIndices(hand);
    if (valid.length === 1) return valid[0];

    const needed = S.bids[playerIdx] - S.tricksWon[playerIdx];
    const isLeading = S.trickCards.length === 0;
    const leadSuit = isLeading ? null : S.trickCards[0].suit;

    /* If bid already met, dump lowest cards */
    if (needed <= 0) {
      valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      /* Prefer non-trump losers */
      const nonTrump = valid.filter(i => !V.isTrump(hand[i]));
      return nonTrump.length > 0 ? nonTrump[0] : valid[0];
    }

    /* Need more tricks */
    if (isLeading) {
      /* Lead high non-trump winner, or high trump */
      const nonTrump = valid.filter(i => !V.isTrump(hand[i]));
      if (nonTrump.length > 0) {
        nonTrump.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        if (hand[nonTrump[0]].rank === 'A' || hand[nonTrump[0]].rank === 'K')
          return nonTrump[0];
      }
      /* Lead trump to pull them out */
      const trumpIdxs = valid.filter(i => V.isTrump(hand[i]));
      if (trumpIdxs.length > 0) {
        trumpIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        return trumpIdxs[0];
      }
      valid.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      return valid[0];
    }

    /* Following */
    const followIdxs = valid.filter(i => hand[i].suit === leadSuit);
    if (followIdxs.length > 0) {
      /* Try to win with smallest winner */
      const currentBest = V.currentTrickBest();
      const winners = followIdxs.filter(i => V.cardStrength(hand[i]) > currentBest && !V.trickHasTrump());
      if (winners.length > 0) {
        winners.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        return winners[0];
      }
      /* Can't beat, dump lowest */
      followIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return followIdxs[0];
    }

    /* Void in led suit -- trump in if needed */
    const trumpIdxs = valid.filter(i => V.isTrump(hand[i]));
    if (trumpIdxs.length > 0 && needed > 0) {
      trumpIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return trumpIdxs[0];
    }

    /* Dump lowest */
    valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
    return valid[0];
  }

  Object.assign(V, {
    aiBid, aiChooseCard
  });

})();
