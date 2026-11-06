/* Oh Hell - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.ohhell;
  const S = V.S;
  const { NUM_PLAYERS } = V;

  const RANK_ORDER = T.RANK_ORDER;

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  function isTrump(card) {
    return S.trumpSuit && card.suit === S.trumpSuit;
  }

  /* ================================================================
     VALIDITY
     ================================================================ */

  function isValidPlay(card, hand) {
    return T.followsSuit(card, hand, S.trickCards);
  }

  function getValidIndices(hand) {
    return T.validIndices(hand, isValidPlay);
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    return T.trumpTrickWinner(S.trickCards, S.trickPlayers, cardStrength, isTrump);
  }

  /* ================================================================
     BIDDING RULES -- "HOOK" CONSTRAINT
     ================================================================ */

  function isLastBidder(playerIdx) {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (S.bidsDone[i]) ++count;
    return count === NUM_PLAYERS - 1;
  }

  function forbiddenBid() {
    if (!isLastBidder(S.biddingPlayer)) return -1;
    const gap = S.handSize - S.totalBidsSoFar;
    return gap >= 0 ? gap : -1;
  }

  function currentTrickBest() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = S.trickCards[0].suit;
    let best = -1;
    for (const c of S.trickCards)
      if (c.suit === leadSuit && cardStrength(c) > best)
        best = cardStrength(c);
    return best;
  }

  function trickHasTrump() {
    return S.trumpSuit && S.trickCards.some(c => c.suit === S.trumpSuit);
  }

  Object.assign(V, {
    cardStrength, sortHand, isTrump, isValidPlay, getValidIndices,
    resolveTrickWinner, forbiddenBid, currentTrickBest, trickHasTrump
  });

})();
