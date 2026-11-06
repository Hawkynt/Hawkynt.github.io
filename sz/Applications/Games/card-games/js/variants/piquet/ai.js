/* Piquet: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.piquet;
  const S = V.S;
  const { RANK_ORDER } = V;

  /* ================================================================
     AI - EXCHANGE STRATEGY
     ================================================================ */

  function aiChooseDiscards(hand, maxDiscard) {
    // Score each card: higher is more valuable, lower gets discarded
    const scores = hand.map((card, idx) => {
      let val = V.cardStrength(card) * 3;
      // Bonus for cards in long suits
      const suitLen = V.getCardsOfSuit(hand, card.suit).length;
      val += suitLen * 2;
      // Bonus for high cards that form sets
      const sameRankCount = hand.filter(c => c.rank === card.rank).length;
      if (sameRankCount >= 3 && RANK_ORDER[card.rank] >= RANK_ORDER['10'])
        val += 10;
      // Bonus for cards in sequences
      const suitCards = V.getCardsOfSuit(hand, card.suit).map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
      const myOrd = RANK_ORDER[card.rank];
      const hasNeighbor = suitCards.some(o => Math.abs(o - myOrd) === 1);
      if (hasNeighbor) val += 4;
      return { idx, val };
    });

    scores.sort((a, b) => a.val - b.val);
    const count = Math.min(maxDiscard, Math.max(1, Math.min(3, maxDiscard)));
    const result = [];
    for (let i = 0; i < count; ++i)
      result.push(scores[i].idx);
    return result;
  }

  /* ================================================================
     AI - TRICK PLAY
     ================================================================ */

  function aiChooseCard() {
    if (S.aiHand.length === 0) return -1;
    const validIdxs = V.getValidIndices(S.aiHand);
    if (validIdxs.length === 1) return validIdxs[0];

    const isLeading = S.trickCards.length === 0;

    if (isLeading) {
      // Lead from longest suit, highest card
      let bestSuitLen = 0;
      let bestSuit = null;
      for (const suit of CE.SUITS) {
        const count = V.getCardsOfSuit(S.aiHand, suit).length;
        if (count > bestSuitLen) {
          bestSuitLen = count;
          bestSuit = suit;
        }
      }
      const suitIdxs = validIdxs.filter(i => S.aiHand[i].suit === bestSuit);
      if (suitIdxs.length > 0) {
        suitIdxs.sort((a, b) => V.cardStrength(S.aiHand[b]) - V.cardStrength(S.aiHand[a]));
        return suitIdxs[0];
      }
      validIdxs.sort((a, b) => V.cardStrength(S.aiHand[b]) - V.cardStrength(S.aiHand[a]));
      return validIdxs[0];
    }

    // Following: try to win with cheapest winning card, otherwise dump lowest
    const leadSuit = S.trickCards[0].card.suit;
    const leadStr = V.cardStrength(S.trickCards[0].card);
    const followIdxs = validIdxs.filter(i => S.aiHand[i].suit === leadSuit);

    if (followIdxs.length > 0) {
      const winners = followIdxs.filter(i => V.cardStrength(S.aiHand[i]) > leadStr);
      if (winners.length > 0) {
        winners.sort((a, b) => V.cardStrength(S.aiHand[a]) - V.cardStrength(S.aiHand[b]));
        return winners[0]; // cheapest winner
      }
      // Can't win, dump lowest
      followIdxs.sort((a, b) => V.cardStrength(S.aiHand[a]) - V.cardStrength(S.aiHand[b]));
      return followIdxs[0];
    }

    // Void in lead suit: dump lowest
    validIdxs.sort((a, b) => V.cardStrength(S.aiHand[a]) - V.cardStrength(S.aiHand[b]));
    return validIdxs[0];
  }

  V.aiChooseDiscards = aiChooseDiscards;
  V.aiChooseCard = aiChooseCard;

})();
