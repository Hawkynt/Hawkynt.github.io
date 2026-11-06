/* Pinochle - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.pinochle;
  const S = V.S;
  const { TEAM_A, TEAM_B, hasSuit } = V;

  const SUIT_SHORT = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const PINOCHLE_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_ORDER = { '9': 0, 'J': 1, 'Q': 2, 'K': 3, '10': 4, 'A': 5 };
  const TRICK_POINTS = { 'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0 };

  /* ================================================================
     TEAM HELPERS
     ================================================================ */

  function teamOf(player) {
    return (player === 0 || player === 2) ? TEAM_A : TEAM_B;
  }

  /* ================================================================
     DECK CREATION (48-card Pinochle deck)
     ================================================================ */

  function createPinochleDeck() {
    const half = CE.createDeckFromRanks(CE.SUITS, PINOCHLE_RANKS);
    const other = CE.createDeckFromRanks(CE.SUITS, PINOCHLE_RANKS);
    return half.concat(other);
  }

  /* ================================================================
     CARD UTILITY
     ================================================================ */

  function cardStrength(card) {
    return RANK_ORDER[card.rank] || 0;
  }

  function cardTrickValue(card) {
    return TRICK_POINTS[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    });
  }

  function countRankInSuit(hand, rank, suit) {
    return hand.filter(c => c.rank === rank && c.suit === suit).length;
  }

  function countRankAcrossSuits(hand, rank) {
    const suits = new Set();
    for (const c of hand)
      if (c.rank === rank)
        suits.add(c.suit);
    return suits.size;
  }

  /* ================================================================
     TRICK RULES - VALIDITY
     ================================================================ */

  function currentWinningStrength() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = S.trickCards[0].suit;
    let bestStr = -1;
    let bestIsTrump = false;

    for (const c of S.trickCards) {
      const isTrump = c.suit === S.trumpSuit;
      const str = cardStrength(c);
      if (bestStr < 0) {
        bestStr = str;
        bestIsTrump = isTrump;
      } else if (bestIsTrump) {
        if (isTrump && str > bestStr)
          bestStr = str;
      } else {
        if (isTrump) {
          bestStr = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStr)
          bestStr = str;
      }
    }
    return bestStr;
  }

  function currentWinnerIsTrump() {
    if (S.trickCards.length === 0) return false;
    const leadSuit = S.trickCards[0].suit;
    let bestStr = -1;
    let bestIsTrump = false;

    for (const c of S.trickCards) {
      const isTrump = c.suit === S.trumpSuit;
      const str = cardStrength(c);
      if (bestStr < 0) {
        bestStr = str;
        bestIsTrump = isTrump;
      } else if (bestIsTrump) {
        if (isTrump && str > bestStr)
          bestStr = str;
      } else {
        if (isTrump) {
          bestStr = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStr)
          bestStr = str;
      }
    }
    return bestIsTrump;
  }

  function isValidPlay(card, hand) {
    if (S.trickCards.length === 0) return true;
    const leadSuit = S.trickCards[0].suit;
    const hasLead = hasSuit(hand, leadSuit);

    if (hasLead) {
      if (card.suit !== leadSuit) return false;
      const bestStr = currentWinningStrength();
      const winIsTrump = currentWinnerIsTrump();
      if (!winIsTrump || leadSuit === S.trumpSuit) {
        const higherCards = hand.filter(c => c.suit === leadSuit && cardStrength(c) > bestStr);
        if (higherCards.length > 0)
          return cardStrength(card) > bestStr;
      }
      return true;
    }

    const hasTrump = hasSuit(hand, S.trumpSuit);
    if (hasTrump && card.suit !== S.trumpSuit) return false;
    if (hasTrump && card.suit === S.trumpSuit) {
      const winIsTrump = currentWinnerIsTrump();
      if (winIsTrump) {
        const bestStr = currentWinningStrength();
        const higherTrumps = hand.filter(c => c.suit === S.trumpSuit && cardStrength(c) > bestStr);
        if (higherTrumps.length > 0)
          return cardStrength(card) > bestStr;
      }
      return true;
    }

    return true;
  }

  function getValidIndices(hand) {
    return T.validIndices(hand, isValidPlay);
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function determineTrickWinner() {
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(S.trickCards[0]);
    let bestIsTrump = S.trickCards[0].suit === S.trumpSuit;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const isTrump = c.suit === S.trumpSuit;
      const str = cardStrength(c);

      if (bestIsTrump) {
        if (isTrump && str > bestStr) {
          bestIdx = i;
          bestStr = str;
        }
      } else {
        if (isTrump) {
          bestIdx = i;
          bestStr = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStr) {
          bestIdx = i;
          bestStr = str;
        }
      }
    }
    return S.trickPlayers[bestIdx];
  }

  function computeTrickPoints() {
    let pts = 0;
    for (const c of S.trickCards)
      pts += cardTrickValue(c);
    return pts;
  }

  /* ================================================================
     MELDING
     ================================================================ */

  function computeMelds(hand) {
    const melds = [];
    let total = 0;

    // Marriages: K+Q same suit
    for (const suit of CE.SUITS) {
      const kings = countRankInSuit(hand, 'K', suit);
      const queens = countRankInSuit(hand, 'Q', suit);
      const marriages = Math.min(kings, queens);
      for (let i = 0; i < marriages; ++i) {
        const pts = suit === S.trumpSuit ? 40 : 20;
        const name = suit === S.trumpSuit ? 'Royal Marriage' : 'Marriage';
        melds.push({ name: name + ' (' + SUIT_SHORT[suit] + ')', points: pts });
        total += pts;
      }
    }

    // Pinochle: J of diamonds + Q of spades
    const jDiamonds = countRankInSuit(hand, 'J', 'diamonds');
    const qSpades = countRankInSuit(hand, 'Q', 'spades');
    const pinochles = Math.min(jDiamonds, qSpades);
    if (pinochles >= 2) {
      melds.push({ name: 'Double Pinochle', points: 300 });
      total += 300;
    } else if (pinochles === 1) {
      melds.push({ name: 'Pinochle', points: 40 });
      total += 40;
    }

    // Run in trump: A-10-K-Q-J of trump
    if (S.trumpSuit) {
      const hasA = countRankInSuit(hand, 'A', S.trumpSuit) > 0;
      const has10 = countRankInSuit(hand, '10', S.trumpSuit) > 0;
      const hasK = countRankInSuit(hand, 'K', S.trumpSuit) > 0;
      const hasQ = countRankInSuit(hand, 'Q', S.trumpSuit) > 0;
      const hasJ = countRankInSuit(hand, 'J', S.trumpSuit) > 0;
      if (hasA && has10 && hasK && hasQ && hasJ) {
        melds.push({ name: 'Run in Trump', points: 150 });
        total += 150;
      }
    }

    // Around melds
    const arounds = [
      { rank: 'A', name: 'Aces Around', points: 100 },
      { rank: 'K', name: 'Kings Around', points: 80 },
      { rank: 'Q', name: 'Queens Around', points: 60 },
      { rank: 'J', name: 'Jacks Around', points: 40 }
    ];
    for (const { rank, name, points } of arounds) {
      const suitCount = countRankAcrossSuits(hand, rank);
      if (suitCount === 4) {
        melds.push({ name, points });
        total += points;
      }
    }

    return { melds, total };
  }

  /* ================================================================
     AI TRICK PLAY
     ================================================================ */

  function determineTrickWinnerPartial() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrength(S.trickCards[0]);
    let bestIsTrump = S.trickCards[0].suit === S.trumpSuit;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const isTrump = c.suit === S.trumpSuit;
      const str = cardStrength(c);

      if (bestIsTrump) {
        if (isTrump && str > bestStr) { bestIdx = i; bestStr = str; }
      } else {
        if (isTrump) { bestIdx = i; bestStr = str; bestIsTrump = true; }
        else if (c.suit === leadSuit && str > bestStr) { bestIdx = i; bestStr = str; }
      }
    }
    return S.trickPlayers[bestIdx];
  }

  Object.assign(V, {
    teamOf, createPinochleDeck, cardStrength, cardTrickValue, sortHand,
    countRankInSuit, countRankAcrossSuits, isValidPlay, getValidIndices,
    determineTrickWinner, computeTrickPoints, computeMelds,
    determineTrickWinnerPartial
  });

})();
