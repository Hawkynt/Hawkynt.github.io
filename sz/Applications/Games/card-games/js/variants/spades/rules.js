/* Spades - deck, legal plays, trick resolution and scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.spades;
  const S = V.S;
  const { TRUMP_SUIT, TEAM_NS, TEAM_EW } = V;

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

  function isValidPlay(card, hand) {
    const leadSuit = S.trickCards.length > 0 ? S.trickCards[0].suit : null;

    // Leading
    if (!leadSuit) {
      // Spades can't be led until broken (unless hand is all spades)
      if (card.suit === TRUMP_SUIT && !S.spadesBroken) {
        const hasNonSpade = hand.some(c => c.suit !== TRUMP_SUIT);
        return !hasNonSpade;
      }
      return true;
    }

    // Following
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    if (hasLeadSuit)
      return card.suit === leadSuit;

    // Can't follow suit -- any card is fine (including spades)
    return true;
  }

  function determineTrickWinner() {
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStrength = cardStrength(S.trickCards[0]);
    let bestIsTrump = S.trickCards[0].suit === TRUMP_SUIT;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const isTrump = c.suit === TRUMP_SUIT;
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

  function sortHand(hand) {
    const suitOrder = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return cardStrength(a) - cardStrength(b);
    });
  }

  function determineTrickWinnerPartial() {
    if (S.trickCards.length === 0) return -1;
    const leadSuit = S.trickCards[0].suit;
    let bestIdx = 0;
    let bestStrength = cardStrength(S.trickCards[0]);
    let bestIsTrump = S.trickCards[0].suit === TRUMP_SUIT;

    for (let i = 1; i < S.trickCards.length; ++i) {
      const c = S.trickCards[i];
      const isTrump = c.suit === TRUMP_SUIT;
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
    for (const c of S.trickCards) {
      if (c.suit === leadSuit && cardStrength(c) > best)
        best = cardStrength(c);
    }
    return best;
  }

  function trickHasTrump() {
    return S.trickCards.some(c => c.suit === TRUMP_SUIT);
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function scoreRound() {
    for (let team = 0; team < 2; ++team) {
      const p1 = team === TEAM_NS ? 0 : 1;
      const p2 = team === TEAM_NS ? 2 : 3;
      const teamBid = S.bids[p1] + S.bids[p2];
      const teamTricks = S.tricksWon[p1] + S.tricksWon[p2];

      // Handle nil bids individually
      let nilBonus = 0;
      for (const p of [p1, p2]) {
        if (S.bids[p] === 0) {
          if (S.tricksWon[p] === 0)
            nilBonus += 100;
          else
            nilBonus -= 100;
        }
      }

      // Non-nil scoring
      const nonNilBid = (S.bids[p1] === 0 ? 0 : S.bids[p1]) + (S.bids[p2] === 0 ? 0 : S.bids[p2]);
      const nonNilTricks = (S.bids[p1] === 0 ? 0 : S.tricksWon[p1]) + (S.bids[p2] === 0 ? 0 : S.tricksWon[p2]);

      if (nonNilBid > 0) {
        if (nonNilTricks >= nonNilBid) {
          const over = nonNilTricks - nonNilBid;
          S.teamScores[team] += nonNilBid * 10 + over;
          S.teamBags[team] += over;
          // Sandbag penalty
          if (S.teamBags[team] >= 10) {
            S.teamScores[team] -= 100;
            S.teamBags[team] -= 10;
          }
        } else {
          // Failed to make bid
          S.teamScores[team] -= nonNilBid * 10;
        }
      }

      S.teamScores[team] += nilBonus;
    }

    S.score = S.teamScores[TEAM_NS];
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function checkGameOver() {
    if (S.teamScores[TEAM_NS] >= 500 || S.teamScores[TEAM_EW] >= 500) {
      S.gameOver = true;
      return;
    }
    if (S.teamScores[TEAM_NS] <= -200 || S.teamScores[TEAM_EW] <= -200) {
      S.gameOver = true;
      return;
    }
  }

  Object.assign(V, {
    cardStrength, teamOf, isValidPlay, determineTrickWinner, sortHand,
    determineTrickWinnerPartial, currentTrickBestStrength, trickHasTrump,
    scoreRound, checkGameOver
  });

})();
