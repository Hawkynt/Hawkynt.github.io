/* Whist - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.whist;
  const S = V.S;
  const { WINNING_SCORE, BOOK_SIZE, TEAM_NS, TEAM_EW } = V;

  const STRENGTH_ORDER = T.STRENGTH_ORDER;

  /* ================================================================
     CARD LOGIC
     ================================================================ */

  function cardStrength(card) {
    return STRENGTH_ORDER.indexOf(card.rank);
  }

  function teamOf(player) {
    return (player === 0 || player === 2) ? TEAM_NS : TEAM_EW;
  }

  function sortHand(hand) {
    const suitOrder = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  function isValidPlay(card, hand) {
    return T.followsSuit(card, hand, S.trickCards);
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
    let bestStrength = cardStrength(S.trickCards[0]);
    let bestIsTrump = S.trickCards[0].suit === S.trumpSuit;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const isTrump = c.suit === S.trumpSuit;
      const str = cardStrength(c);

      if (bestIsTrump) {
        if (isTrump && str > bestStrength) {
          bestIdx = i;
          bestStrength = str;
        }
      } else {
        if (isTrump) {
          bestIdx = i;
          bestStrength = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStrength) {
          bestIdx = i;
          bestStrength = str;
        }
      }
    }
    return S.trickPlayers[bestIdx];
  }

  function determineTrickWinnerPartial() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStrength = cardStrength(S.trickCards[0]);
    let bestIsTrump = S.trickCards[0].suit === S.trumpSuit;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const isTrump = c.suit === S.trumpSuit;
      const str = cardStrength(c);

      if (bestIsTrump) {
        if (isTrump && str > bestStrength) {
          bestIdx = i;
          bestStrength = str;
        }
      } else {
        if (isTrump) {
          bestIdx = i;
          bestStrength = str;
          bestIsTrump = true;
        } else if (c.suit === leadSuit && str > bestStrength) {
          bestIdx = i;
          bestStrength = str;
        }
      }
    }
    return S.trickPlayers[bestIdx];
  }

  function currentTrickBestStrength() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = S.trickCards[0].suit;
    let best = -1;
    for (const c of S.trickCards)
      if (c.suit === leadSuit && cardStrength(c) > best)
        best = cardStrength(c);
    return best;
  }

  function trickHasTrump() {
    return S.trickCards.some(c => c.suit === S.trumpSuit);
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function scoreRound() {
    const nsTricks = S.tricksWon[0] + S.tricksWon[2];
    const ewTricks = S.tricksWon[1] + S.tricksWon[3];

    // Each trick beyond 6 (the "book") scores 1 point
    if (nsTricks > BOOK_SIZE)
      S.teamScores[TEAM_NS] += nsTricks - BOOK_SIZE;
    if (ewTricks > BOOK_SIZE)
      S.teamScores[TEAM_EW] += ewTricks - BOOK_SIZE;

    S.score = S.teamScores[TEAM_NS];
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function checkGameOver() {
    if (S.teamScores[TEAM_NS] >= WINNING_SCORE || S.teamScores[TEAM_EW] >= WINNING_SCORE)
      S.gameOver = true;
  }

  Object.assign(V, {
    cardStrength, teamOf, sortHand, isValidPlay, getValidIndices,
    determineTrickWinner, determineTrickWinnerPartial,
    currentTrickBestStrength, trickHasTrump, scoreRound, checkGameOver
  });

})();
