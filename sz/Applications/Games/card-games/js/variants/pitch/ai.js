/* Pitch - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.pitch;
  const S = V.S;
  const { NUM_PLAYERS } = V;

  function aiBid(playerIdx) {
    const hand = S.hands[playerIdx];
    let bestSuit = null;
    let bestVal = 0;

    for (const s of CE.SUITS) {
      const val = V.evaluateSuitForBid(hand, s);
      if (val > bestVal) {
        bestVal = val;
        bestSuit = s;
      }
    }

    // Convert evaluation to bid
    if (bestVal >= 4.0) return { bid: 4, suit: bestSuit };
    if (bestVal >= 3.0) return { bid: 3, suit: bestSuit };
    if (bestVal >= 2.0) return { bid: 2, suit: bestSuit };

    // If dealer and everyone passed, must bid minimum
    if (playerIdx === S.dealer && !S.playerBidDone.slice(0, NUM_PLAYERS).some((d, i) => d && S.playerBids[i] > 0))
      return { bid: 1, suit: bestSuit || CE.SUITS[0] };

    return { bid: 0, suit: null }; // pass
  }

  /* ================================================================
     AI - PLAY
     ================================================================ */

  function aiChooseCard(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return -1;

    const valid = V.getValidIndices(hand);
    if (valid.length === 1) return valid[0];

    const isLeading = S.trickCards.length === 0;

    if (isLeading) {
      // Lead with high trump to draw them out
      const trumpIdxs = valid.filter(i => V.isTrump(hand[i]));
      if (trumpIdxs.length >= 2) {
        trumpIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        return trumpIdxs[0];
      }
      // Lead non-trump ace/king
      const highNonTrump = valid.filter(i => !V.isTrump(hand[i]) && (hand[i].rank === 'A' || hand[i].rank === 'K'));
      if (highNonTrump.length > 0) {
        highNonTrump.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        return highNonTrump[0];
      }
      // Lead lowest
      valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return valid[0];
    }

    // Following
    const leadSuit = S.trickCards[0].suit;
    const followIdxs = valid.filter(i => hand[i].suit === leadSuit);

    // Check if current winner is self (unlikely mid-trick but guard)
    const currentWinner = V.resolveTrickWinnerPartial();

    // Protect the Jack of trump: don't play it unless we must or can clearly win
    const jackOfTrumpIdx = valid.find(i => hand[i].suit === S.trumpSuit && hand[i].rank === 'J');

    if (followIdxs.length > 0) {
      // Try to win
      followIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      const bestFollow = followIdxs[0];

      // If we can win, play highest; but avoid Jack of trump if we have alternatives
      if (jackOfTrumpIdx !== undefined && followIdxs.length > 1 && followIdxs[0] === jackOfTrumpIdx) {
        // Play second-best if it can still win
        const secondBest = followIdxs[1];
        const winnerStr = S.trickCards.reduce((best, c) => {
          if (c.suit === leadSuit || V.isTrump(c)) return Math.max(best, V.cardStrength(c));
          return best;
        }, -1);
        if (V.cardStrength(hand[secondBest]) > winnerStr)
          return secondBest;
      }
      return bestFollow;
    }

    // Can't follow suit -- trump in or dump
    const trumpIdxs = valid.filter(i => V.isTrump(hand[i]));
    if (trumpIdxs.length > 0) {
      // Trump with lowest trump (save Jack if possible)
      trumpIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      if (trumpIdxs.length > 1 && trumpIdxs[0] === jackOfTrumpIdx)
        return trumpIdxs[1]; // save the Jack, trump with next lowest
      return trumpIdxs[0];
    }

    // Dump lowest
    valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
    return valid[0];
  }

  Object.assign(V, {
    aiBid, aiChooseCard
  });

})();
