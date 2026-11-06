/* Pitch - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.pitch;
  const S = V.S;
  const { STRENGTH_ORDER, NUM_PLAYERS } = V;

  const GAME_POINT_VALUES = { 'A': 4, 'K': 3, 'Q': 2, 'J': 1, '10': 10 };

  /* ================================================================
     UTILITIES
     ================================================================ */

  function leftOf(p) {
    return (p + 1) % NUM_PLAYERS;
  }

  function cardStrength(card) {
    return STRENGTH_ORDER.indexOf(card.rank);
  }

  function isTrump(card) {
    return card.suit === S.trumpSuit;
  }

  function gamePointValue(card) {
    return GAME_POINT_VALUES[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };
    hand.sort((a, b) => {
      const ta = isTrump(a) ? 1 : 0;
      const tb = isTrump(b) ? 1 : 0;
      if (ta !== tb) return ta - tb;
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
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

  function resolveTrickWinnerPartial() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(S.trickCards[0]);
    let bestIsTrump = isTrump(S.trickCards[0]);

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const cTrump = isTrump(c);
      const cStr = cardStrength(c);

      if (bestIsTrump) {
        if (cTrump && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      } else {
        if (cTrump) {
          bestIdx = i;
          bestStr = cStr;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      }
    }
    return S.trickPlayers[bestIdx];
  }

  /* ================================================================
     AI - BIDDING
     ================================================================ */

  function evaluateSuitForBid(hand, suit) {
    let value = 0;
    let count = 0;
    for (const c of hand) {
      if (c.suit !== suit) continue;
      ++count;
      if (c.rank === 'A') value += 1.5;
      else if (c.rank === 'K') value += 1.0;
      else if (c.rank === 'Q') value += 0.5;
      else if (c.rank === 'J') value += 1.2;
      else if (c.rank === '2') value += 0.8; // guaranteed low point
    }
    // Length bonus
    if (count >= 3) value += (count - 2) * 0.5;
    return value;
  }

  Object.assign(V, {
    leftOf, cardStrength, isTrump, gamePointValue, sortHand, isValidPlay,
    getValidIndices, resolveTrickWinner, resolveTrickWinnerPartial,
    evaluateSuitForBid
  });

})();
