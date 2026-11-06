/* Euchre - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.euchre;
  const S = V.S;
  const { SAME_COLOR } = V;

  function aiShouldOrderUp(playerIdx, suit) {
    const hand = S.hands[playerIdx];
    const count = V.countTrumpInHand(hand, suit);
    if (count >= 3 && V.hasFaceInSuit(hand, suit)) return true;
    if (count >= 4) return true;
    return false;
  }

  function aiShouldGoAlone(playerIdx, suit) {
    const hand = S.hands[playerIdx];
    const count = V.countTrumpInHand(hand, suit);
    const hasRight = hand.some(c => c.rank === 'J' && c.suit === suit);
    const hasLeft = hand.some(c => c.rank === 'J' && c.suit === SAME_COLOR[suit]);
    return count >= 4 && hasRight && hasLeft;
  }

  function aiPickTrumpRound2(playerIdx) {
    const hand = S.hands[playerIdx];
    const kittyS = S.kittyCard ? S.kittyCard.suit : null;
    let bestSuit = null;
    let bestCount = 0;
    for (const s of CE.SUITS) {
      if (s === kittyS) continue;
      const cnt = V.countTrumpInHand(hand, s);
      if (cnt > bestCount && V.hasFaceInSuit(hand, s)) {
        bestCount = cnt;
        bestSuit = s;
      }
    }
    if (bestSuit && bestCount >= 3) return bestSuit;
    // Stuck dealer must pick something
    if (S.biddingPlayer === S.dealer) {
      for (const s of CE.SUITS) {
        if (s === kittyS) continue;
        const cnt = V.countTrumpInHand(hand, s);
        if (cnt > bestCount || !bestSuit) {
          bestCount = cnt;
          bestSuit = s;
        }
      }
      return bestSuit;
    }
    return null;
  }

  function aiDiscardWorst(playerIdx) {
    const hand = S.hands[playerIdx];
    let worstIdx = 0;
    let worstStr = Infinity;
    for (let i = 0; i < hand.length; ++i) {
      const str = V.cardStrength(hand[i]);
      if (str < worstStr) {
        worstStr = str;
        worstIdx = i;
      }
    }
    return worstIdx;
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
    const partnerIdx = V.partnerOf(playerIdx);

    if (isLeading) {
      // Lead with high trump if we have many
      const trumpIdxs = valid.filter(i => V.isTrump(hand[i]));
      if (trumpIdxs.length >= 3) {
        trumpIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        return trumpIdxs[0];
      }
      // Otherwise lead non-trump ace/king
      const highNonTrump = valid.filter(i => !V.isTrump(hand[i]) && (hand[i].rank === 'A' || hand[i].rank === 'K'));
      if (highNonTrump.length > 0) {
        highNonTrump.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        return highNonTrump[0];
      }
      // Lead lowest
      valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return valid[0];
    }

    // Check if partner is winning
    let partnerWinning = false;
    if (S.trickCards.length > 0) {
      const tempWinner = V.resolveTrickWinnerPartial();
      partnerWinning = V.teamOf(tempWinner) === V.teamOf(playerIdx);
    }

    const leadSuit = V.effectiveSuit(S.trickCards[0]);
    const followIdxs = valid.filter(i => V.effectiveSuit(hand[i]) === leadSuit);

    if (followIdxs.length > 0) {
      if (partnerWinning) {
        // Play lowest
        followIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        return followIdxs[0];
      }
      // Try to win
      followIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      return followIdxs[0];
    }

    // Can't follow suit
    if (partnerWinning) {
      // Dump lowest non-trump
      const nonTrump = valid.filter(i => !V.isTrump(hand[i]));
      const dump = nonTrump.length > 0 ? nonTrump : valid;
      dump.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return dump[0];
    }

    // Trump in with lowest trump
    const trumpIdxs = valid.filter(i => V.isTrump(hand[i]));
    if (trumpIdxs.length > 0) {
      trumpIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return trumpIdxs[0];
    }

    valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
    return valid[0];
  }

  Object.assign(V, {
    aiShouldOrderUp, aiShouldGoAlone, aiPickTrumpRound2, aiDiscardWorst,
    aiChooseCard
  });

})();
