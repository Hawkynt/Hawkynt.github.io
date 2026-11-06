/* Hearts - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.hearts;
  const S = V.S;
  const { RANK_ORDER, HEART, SPADE, NUM_PLAYERS, PASS_LEFT, hasSuit } = V;

  const DIAMOND = 'diamonds';
  const CLUB = 'clubs';
  const PASS_RIGHT = 1;
  const PASS_ACROSS = 2;

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardKey(card) {
    return card.rank + card.suit;
  }

  function isQueenOfSpades(card) {
    return card.rank === 'Q' && card.suit === SPADE;
  }

  function isHeart(card) {
    return card.suit === HEART;
  }

  function isPenaltyCard(card) {
    return isHeart(card) || isQueenOfSpades(card);
  }

  function cardPenalty(card) {
    if (isHeart(card)) return 1;
    if (isQueenOfSpades(card)) return 13;
    return 0;
  }

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { [CLUB]: 0, [DIAMOND]: 1, [SPADE]: 2, [HEART]: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    });
  }

  function isTwoOfClubs(card) {
    return card.rank === '2' && card.suit === CLUB;
  }

  function findTwoOfClubs() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (const c of S.hands[p])
        if (isTwoOfClubs(c)) return p;
    return 0;
  }

  function hasOnlyHearts(hand) {
    return hand.every(c => c.suit === HEART);
  }

  /* ================================================================
     RULES - VALIDITY
     ================================================================ */

  function isValidPlay(card, hand, leadSuit, isFirstTrick, isLeading) {
    if (isLeading) {
      if (isFirstTrick)
        return isTwoOfClubs(card);
      if (card.suit === HEART && !S.heartsBroken)
        return hasOnlyHearts(hand);
      return true;
    }

    if (leadSuit && hasSuit(hand, leadSuit))
      return card.suit === leadSuit;

    if (isFirstTrick)
      return !isPenaltyCard(card);

    return true;
  }

  function getValidCards(hand, leadSuit, isFirstTrick, isLeading) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand, leadSuit, isFirstTrick, isLeading))
        valid.push(i);

    if (valid.length === 0) {
      for (let i = 0; i < hand.length; ++i)
        valid.push(i);
    }
    return valid;
  }

  /* ================================================================
     RULES - TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStrength = cardStrength(S.trickCards[0]);
    for (let i = 1; i < S.trickCards.length; ++i) {
      if (S.trickCards[i].suit === leadSuit && cardStrength(S.trickCards[i]) > bestStrength) {
        bestStrength = cardStrength(S.trickCards[i]);
        bestIdx = i;
      }
    }
    return S.trickPlayers[bestIdx];
  }

  function computeTrickPenalty() {
    let penalty = 0;
    for (const c of S.trickCards)
      penalty += cardPenalty(c);
    return penalty;
  }

  function getPassTarget(from) {
    if (S.passDirection === PASS_LEFT) return (from + 1) % NUM_PLAYERS;
    if (S.passDirection === PASS_RIGHT) return (from + 3) % NUM_PLAYERS;
    if (S.passDirection === PASS_ACROSS) return (from + 2) % NUM_PLAYERS;
    return from;
  }

  Object.assign(V, {
    isQueenOfSpades, isHeart, isPenaltyCard, cardStrength, sortHand,
    isTwoOfClubs, findTwoOfClubs, hasOnlyHearts, isValidPlay,
    getValidCards, resolveTrickWinner, computeTrickPenalty, getPassTarget
  });

})();
