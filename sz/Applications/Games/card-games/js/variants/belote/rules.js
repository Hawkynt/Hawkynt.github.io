/* Belote: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const hasSuit = SZ.CardGames.shared.euroCards.hasSuit;

  const V = SZ.CardGames.v.belote;
  const S = V.S;
  const { NUM_PLAYERS, TEAM_A, TEAM_B, TRUMP_STRENGTH, PLAIN_STRENGTH } = V;

  /* ── Card point values ── */
  const TRUMP_POINTS = { 'J': 20, '9': 14, 'A': 11, '10': 10, 'K': 4, 'Q': 3, '8': 0, '7': 0 };
  const PLAIN_POINTS = { 'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2, '9': 0, '8': 0, '7': 0 };

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

  /* ================================================================
     CARD RANKING
     ================================================================ */

  function cardPoints(card) {
    if (card.suit === S.trumpSuit) return TRUMP_POINTS[card.rank] || 0;
    return PLAIN_POINTS[card.rank] || 0;
  }

  function cardStrength(card) {
    if (card.suit === S.trumpSuit) return 100 + (TRUMP_STRENGTH[card.rank] || 0);
    return PLAIN_STRENGTH[card.rank] || 0;
  }

  function cardStrengthInSuit(card, suit) {
    if (suit === S.trumpSuit) return 100 + (TRUMP_STRENGTH[card.rank] || 0);
    return PLAIN_STRENGTH[card.rank] || 0;
  }

  function sortHand(hand) {
    const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
    hand.sort((a, b) => {
      const aIsTrump = a.suit === S.trumpSuit;
      const bIsTrump = b.suit === S.trumpSuit;
      if (aIsTrump && !bIsTrump) return 1;
      if (bIsTrump && !aIsTrump) return -1;
      if (aIsTrump && bIsTrump) return TRUMP_STRENGTH[a.rank] - TRUMP_STRENGTH[b.rank];
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return PLAIN_STRENGTH[a.rank] - PLAIN_STRENGTH[b.rank];
    });
  }

  function hasHigherTrump(hand, currentHighest) {
    return hand.some(c => c.suit === S.trumpSuit && TRUMP_STRENGTH[c.rank] > currentHighest);
  }

  function currentWinnerIdx() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStr = cardStrengthInSuit(S.trickCards[0], leadSuit);
    let bestIsTrump = S.trickCards[0].suit === S.trumpSuit;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const cIsTrump = c.suit === S.trumpSuit;
      if (bestIsTrump) {
        if (cIsTrump && TRUMP_STRENGTH[c.rank] > TRUMP_STRENGTH[S.trickCards[bestIdx].rank]) {
          bestIdx = i;
          bestStr = cardStrengthInSuit(c, S.trumpSuit);
        }
      } else {
        if (cIsTrump) {
          bestIdx = i;
          bestStr = cardStrengthInSuit(c, S.trumpSuit);
          bestIsTrump = true;
        } else if (c.suit === leadSuit && PLAIN_STRENGTH[c.rank] > PLAIN_STRENGTH[S.trickCards[bestIdx].rank]) {
          bestIdx = i;
          bestStr = cardStrengthInSuit(c, leadSuit);
        }
      }
    }
    return bestIdx;
  }

  function currentWinningPlayer() {
    const idx = currentWinnerIdx();
    return idx >= 0 ? S.trickPlayers[idx] : -1;
  }

  function highestTrumpStrengthInTrick() {
    let best = -1;
    for (const c of S.trickCards)
      if (c.suit === S.trumpSuit && TRUMP_STRENGTH[c.rank] > best)
        best = TRUMP_STRENGTH[c.rank];
    return best;
  }

  function isValidPlay(card, hand, playerIdx) {
    if (S.trickCards.length === 0) return true;
    const leadSuit = S.trickCards[0].suit;

    // If lead suit is trump
    if (leadSuit === S.trumpSuit) {
      if (card.suit === S.trumpSuit) {
        // Must overtrump if possible
        const highestTrump = highestTrumpStrengthInTrick();
        if (hasHigherTrump(hand, highestTrump))
          return TRUMP_STRENGTH[card.rank] > highestTrump;
        // Can't overtrump, any trump is ok
        if (hasSuit(hand, S.trumpSuit))
          return card.suit === S.trumpSuit;
        return true;
      }
      // Don't have trump? Play anything
      if (!hasSuit(hand, S.trumpSuit)) return true;
      return false; // Must play trump if you have it
    }

    // Lead suit is not trump
    if (card.suit === leadSuit) return true;

    // Can't follow suit
    if (hasSuit(hand, leadSuit)) return false; // Must follow if able

    // Void in led suit: check if partner is winning
    const winnerPlayer = currentWinningPlayer();
    const partnerWinning = winnerPlayer >= 0 && teamOf(winnerPlayer) === teamOf(playerIdx);

    if (partnerWinning) {
      // Partner winning: can play anything (no obligation to trump)
      return true;
    }

    // Partner NOT winning: must trump if possible
    if (hasSuit(hand, S.trumpSuit)) {
      if (card.suit !== S.trumpSuit) return false;
      // Must overtrump if possible
      const highestTrump = highestTrumpStrengthInTrick();
      if (highestTrump >= 0 && hasHigherTrump(hand, highestTrump))
        return TRUMP_STRENGTH[card.rank] > highestTrump;
      return card.suit === S.trumpSuit; // play any trump
    }

    // No trump either: anything goes
    return true;
  }

  function getValidIndices(hand, playerIdx) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (isValidPlay(hand[i], hand, playerIdx))
        valid.push(i);
    if (valid.length === 0)
      for (let i = 0; i < hand.length; ++i) valid.push(i);
    return valid;
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrickWinner() {
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestIsTrump = S.trickCards[0].suit === S.trumpSuit;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const cIsTrump = c.suit === S.trumpSuit;

      if (bestIsTrump) {
        if (cIsTrump && TRUMP_STRENGTH[c.rank] > TRUMP_STRENGTH[S.trickCards[bestIdx].rank])
          bestIdx = i;
      } else {
        if (cIsTrump) {
          bestIdx = i;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && PLAIN_STRENGTH[c.rank] > PLAIN_STRENGTH[S.trickCards[bestIdx].rank])
          bestIdx = i;
      }
    }
    return S.trickPlayers[bestIdx];
  }

  /* ================================================================
     BELOTE / REBELOTE
     ================================================================ */

  function playerHasBelote(playerIdx) {
    const hand = S.hands[playerIdx];
    const hasKing = hand.some(c => c.suit === S.trumpSuit && c.rank === 'K');
    const hasQueen = hand.some(c => c.suit === S.trumpSuit && c.rank === 'Q');
    return hasKing && hasQueen;
  }

  /* ================================================================
     AI - BIDDING
     ================================================================ */

  function handPointsForSuit(hand, suit) {
    let pts = 0;
    for (const c of hand) {
      if (c.suit === suit)
        pts += TRUMP_POINTS[c.rank] || 0;
      else
        pts += PLAIN_POINTS[c.rank] || 0;
    }
    return pts;
  }

  function countCardsOfSuit(hand, suit) {
    let count = 0;
    for (const c of hand)
      if (c.suit === suit) ++count;
    return count;
  }

  function hasRankInSuit(hand, suit, rank) {
    return hand.some(c => c.suit === suit && c.rank === rank);
  }

  V.teamOf = teamOf;
  V.partnerOf = partnerOf;
  V.leftOf = leftOf;
  V.cardPoints = cardPoints;
  V.cardStrength = cardStrength;
  V.sortHand = sortHand;
  V.currentWinningPlayer = currentWinningPlayer;
  V.isValidPlay = isValidPlay;
  V.getValidIndices = getValidIndices;
  V.resolveTrickWinner = resolveTrickWinner;
  V.handPointsForSuit = handPointsForSuit;
  V.countCardsOfSuit = countCardsOfSuit;
  V.hasRankInSuit = hasRankInSuit;

})();
