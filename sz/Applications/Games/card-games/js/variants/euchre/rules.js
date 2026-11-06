/* Euchre - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.euchre;
  const S = V.S;
  const { SAME_COLOR, NUM_PLAYERS, TEAM_A, TEAM_B } = V;

  const NON_TRUMP_ORDER = { '9': 0, '10': 1, 'J': 2, 'Q': 3, 'K': 4, 'A': 5 };
  const TRUMP_ORDER = { '9': 0, '10': 1, 'Q': 2, 'K': 3, 'A': 4 }; // J handled separately as bowers

  /* ================================================================
     TEAM / PLAYER UTILITIES
     ================================================================ */

  function teamOf(p) {
    return (p === 0 || p === 2) ? TEAM_A : TEAM_B;
  }

  function partnerOf(p) {
    return (p + 2) % NUM_PLAYERS;
  }

  function leftOf(p) {
    return (p + 1) % NUM_PLAYERS;
  }

  function isSkipped(p) {
    return p === S.sittingOutPlayer;
  }

  function nextActivePlayer(p) {
    let next = leftOf(p);
    while (isSkipped(next)) next = leftOf(next);
    return next;
  }

  /* ================================================================
     CARD RANKING - EUCHRE SPECIFIC
     ================================================================ */

  function isRightBower(card) {
    return card.rank === 'J' && card.suit === S.trumpSuit;
  }

  function isLeftBower(card) {
    return card.rank === 'J' && card.suit === SAME_COLOR[S.trumpSuit];
  }

  function effectiveSuit(card) {
    if (isLeftBower(card)) return S.trumpSuit;
    return card.suit;
  }

  function isTrump(card) {
    return effectiveSuit(card) === S.trumpSuit;
  }

  function cardStrength(card) {
    if (isRightBower(card)) return 100;
    if (isLeftBower(card)) return 99;
    if (isTrump(card)) return 10 + (TRUMP_ORDER[card.rank] || 0);
    return NON_TRUMP_ORDER[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      const sa = effectiveSuit(a);
      const sb = effectiveSuit(b);
      if (sa === S.trumpSuit && sb !== S.trumpSuit) return 1;
      if (sb === S.trumpSuit && sa !== S.trumpSuit) return -1;
      if (sa === S.trumpSuit && sb === S.trumpSuit) return cardStrength(a) - cardStrength(b);
      const sd = suitOrder[sa] - suitOrder[sb];
      if (sd !== 0) return sd;
      return (NON_TRUMP_ORDER[a.rank] || 0) - (NON_TRUMP_ORDER[b.rank] || 0);
    });
  }

  /* ================================================================
     VALIDITY
     ================================================================ */

  function hasSuit(hand, suit) {
    return hand.some(c => effectiveSuit(c) === suit);
  }

  function isValidPlay(card, hand) {
    if (S.trickCards.length === 0) return true;
    const leadSuit = effectiveSuit(S.trickCards[0]);
    if (hasSuit(hand, leadSuit)) return effectiveSuit(card) === leadSuit;
    return true;
  }

  function getValidIndices(hand) {
    return T.validIndices(hand, isValidPlay);
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    const leadSuit = effectiveSuit(S.trickCards[0]);
    let bestIdx = 0;
    let bestStr = cardStrength(S.trickCards[0]);
    let bestIsTrump = isTrump(S.trickCards[0]);

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const cTrump = isTrump(c);
      const cStr = cardStrength(c);
      const cFollows = effectiveSuit(c) === leadSuit;

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
        } else if (cFollows && cStr > bestStr) {
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

  function countTrumpInHand(hand, suit) {
    let count = 0;
    for (const c of hand) {
      if (c.suit === suit || (c.rank === 'J' && c.suit === SAME_COLOR[suit]))
        ++count;
    }
    return count;
  }

  function hasFaceInSuit(hand, suit) {
    for (const c of hand) {
      if (c.suit === suit && (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K' || c.rank === 'A'))
        return true;
      if (c.rank === 'J' && c.suit === SAME_COLOR[suit])
        return true;
    }
    return false;
  }

  function resolveTrickWinnerPartial() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = effectiveSuit(S.trickCards[0]);
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
        } else if (effectiveSuit(c) === leadSuit && cStr > bestStr) {
          bestIdx = i;
          bestStr = cStr;
        }
      }
    }
    return S.trickPlayers[bestIdx];
  }

  Object.assign(V, {
    teamOf, partnerOf, leftOf, isSkipped, nextActivePlayer, effectiveSuit,
    isTrump, cardStrength, sortHand, isValidPlay, getValidIndices,
    resolveTrickWinner, countTrumpInHand, hasFaceInSuit,
    resolveTrickWinnerPartial
  });

})();
