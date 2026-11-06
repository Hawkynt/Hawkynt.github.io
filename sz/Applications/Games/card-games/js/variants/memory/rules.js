/* Memory: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.memory;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, TOTAL_PAIRS } = V;

  /* ================================================================
   *  DECK CREATION
   * ================================================================ */

  function createMemoryDeck() {
    const pool = [];
    // Build 12 pairs: use 12 distinct ranks, 2 cards each (one from each of 2 suits)
    for (let r = 0; r < TOTAL_PAIRS; ++r) {
      const rank = CE.RANKS[r];
      const c1 = CE.makeCard('spades', rank);
      c1.matched = false;
      c1.fadeStart = 0;
      c1.flipProgress = 0;
      c1.flipDirection = null;
      c1.flipStart = 0;
      pool.push(c1);
      const c2 = CE.makeCard('hearts', rank);
      c2.matched = false;
      c2.fadeStart = 0;
      c2.flipProgress = 0;
      c2.flipDirection = null;
      c2.flipStart = 0;
      pool.push(c2);
    }
    CE.shuffle(pool);
    return pool;
  }

  /* ================================================================
   *  MATCH / MISMATCH LOGIC
   * ================================================================ */

  function checkMatch() {
    if (S.firstPick < 0 || S.secondPick < 0)
      return;

    const a = S.cards[S.firstPick];
    const b = S.cards[S.secondPick];
    ++S.moves;

    if (a.rank === b.rank) {
      // Match found
      a.matched = true;
      b.matched = true;
      a.fadeStart = performance.now();
      b.fadeStart = performance.now();
      ++S.matchesFound;
      S.score += 10;

      if (S._host) {
        const posA = V.cardPos(S.firstPick);
        const posB = V.cardPos(S.secondPick);
        S._host.floatingText.add(
          (posA.x + posB.x + CE.CARD_W) / 2,
          Math.min(posA.y, posB.y) - 10,
          'Match! +10',
          { color: '#4f4', size: 20 }
        );
        S._host.onScoreChanged(S.score);
      }

      S.firstPick = -1;
      S.secondPick = -1;

      // Check if all matched
      if (S.matchesFound >= TOTAL_PAIRS) {
        // Bonus for fewer moves: ideal = 12 moves, each extra move costs -2
        const extraMoves = Math.max(0, S.moves - TOTAL_PAIRS);
        const bonus = Math.max(0, 50 - extraMoves * 2);
        S.score += bonus;
        S.roundOver = true;
        S.gameOver = true;

        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'All Pairs Found!', { color: '#ff0', size: 28 });
          if (bonus > 0)
            S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Bonus: +' + bonus, { color: '#4ff', size: 22 });
          S._host.onScoreChanged(S.score);
          S._host.onRoundOver(true);
        }
      }
    } else {
      // No match -- penalize
      S.score = Math.max(0, S.score - 2);
      if (S._host) {
        const posA = V.cardPos(S.firstPick);
        const posB = V.cardPos(S.secondPick);
        S._host.floatingText.add(
          (posA.x + posB.x + CE.CARD_W) / 2,
          Math.min(posA.y, posB.y) - 10,
          'No match',
          { color: '#f88', size: 18 }
        );
        S._host.onScoreChanged(S.score);
      }

      // Start timer to flip both back
      S.flipLockTimer = 1000;
    }
  }

  function flipBackUnmatched() {
    if (S.firstPick >= 0 && !S.cards[S.firstPick].matched) {
      S.cards[S.firstPick].faceUp = false;
      V.startFlip(S.firstPick, 'down');
    }
    if (S.secondPick >= 0 && !S.cards[S.secondPick].matched) {
      S.cards[S.secondPick].faceUp = false;
      V.startFlip(S.secondPick, 'down');
    }
    S.firstPick = -1;
    S.secondPick = -1;
  }

  /* ================================================================
   *  EASING
   * ================================================================ */

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  Object.assign(V, { createMemoryDeck, checkMatch, flipBackUnmatched, easeOutCubic });

})();
