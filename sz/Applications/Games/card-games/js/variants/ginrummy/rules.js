/* Gin Rummy rules: set/run search, best meld split, deadwood, lay-offs and hint detection. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.ginrummy;
  const RC = SZ.CardGames.shared.rummyCards;

  /* ── Hint helper: does this card participate in any potential meld? ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];
    // Check for 2+ cards of the same rank (potential set)
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Check for run of 3+ consecutive cards in the same suit
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].suit === card.suit) suitCards.push(RC.rankIndex(hand[i]));
    suitCards.sort((a, b) => a - b);
    const ci = RC.rankIndex(card);
    // Find where this card sits in consecutive sequences
    for (let start = 0; start < suitCards.length; ++start) {
      let runLen = 1;
      let inRun = suitCards[start] === ci;
      for (let next = start + 1; next < suitCards.length; ++next) {
        if (suitCards[next] === suitCards[next - 1] + 1) {
          ++runLen;
          if (suitCards[next] === ci) inRun = true;
        } else
          break;
      }
      if (runLen >= 3 && inRun) return true;
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     MELD DETECTION
     ══════════════════════════════════════════════════════════════════ */

  // Find all possible sets (3-4 cards of the same rank)
  function findSets(hand) {
    const byRank = {};
    for (let i = 0; i < hand.length; ++i) {
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }
    const sets = [];
    for (const rank in byRank) {
      const indices = byRank[rank];
      if (indices.length >= 3) {
        if (indices.length === 4) {
          // Can form a set of 4 or multiple sets of 3
          sets.push(indices.slice());
          // Also offer all combinations of 3
          for (let skip = 0; skip < 4; ++skip)
            sets.push(indices.filter((_, j) => j !== skip));
        } else
          sets.push(indices.slice());
      }
    }
    return sets;
  }

  // Find all possible runs (3+ consecutive same-suit cards)
  function findRuns(hand) {
    const bySuit = {};
    for (let i = 0; i < hand.length; ++i) {
      const s = hand[i].suit;
      if (!bySuit[s]) bySuit[s] = [];
      bySuit[s].push(i);
    }
    const runs = [];
    for (const suit in bySuit) {
      const indices = bySuit[suit];
      // Sort by rank index
      indices.sort((a, b) => RC.rankIndex(hand[a]) - RC.rankIndex(hand[b]));
      // Find all consecutive sequences of length >= 3
      for (let start = 0; start < indices.length; ++start) {
        const run = [indices[start]];
        for (let next = start + 1; next < indices.length; ++next) {
          if (RC.rankIndex(hand[indices[next]]) === RC.rankIndex(hand[run[run.length - 1]]) + 1)
            run.push(indices[next]);
          else
            break;
        }
        if (run.length >= 3) {
          // Add all sub-runs of length >= 3
          for (let len = 3; len <= run.length; ++len)
            for (let off = 0; off <= run.length - len; ++off)
              runs.push(run.slice(off, off + len));
        }
      }
    }
    return runs;
  }

  // Find the best combination of non-overlapping melds that minimizes deadwood
  function findBestMelds(hand) {
    const allMelds = [...findSets(hand), ...findRuns(hand)];
    if (allMelds.length === 0)
      return { melds: [], deadwood: hand.slice(), deadwoodValue: hand.reduce((s, c) => s + RC.cardValue(c), 0) };

    let bestDeadwood = Infinity;
    let bestCombo = [];

    // Recursive search with pruning (limited depth for performance)
    function search(meldIdx, used, combo) {
      // Calculate current deadwood
      let dw = 0;
      for (let i = 0; i < hand.length; ++i) {
        if (!used.has(i))
          dw += RC.cardValue(hand[i]);
      }
      if (dw < bestDeadwood) {
        bestDeadwood = dw;
        bestCombo = combo.slice();
      }
      if (dw === 0) return; // Perfect gin, no need to search further

      for (let m = meldIdx; m < allMelds.length; ++m) {
        const meld = allMelds[m];
        let overlaps = false;
        for (const idx of meld) {
          if (used.has(idx)) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;
        for (const idx of meld) used.add(idx);
        combo.push(m);
        search(m + 1, used, combo);
        combo.pop();
        for (const idx of meld) used.delete(idx);
      }
    }

    search(0, new Set(), []);

    const meldCards = [];
    const usedIndices = new Set();
    for (const mi of bestCombo) {
      const meld = allMelds[mi];
      const cards = meld.map(i => hand[i]);
      meldCards.push(cards);
      for (const i of meld) usedIndices.add(i);
    }
    const deadwood = [];
    for (let i = 0; i < hand.length; ++i) {
      if (!usedIndices.has(i))
        deadwood.push(hand[i]);
    }
    return {
      melds: meldCards,
      deadwood,
      deadwoodValue: deadwood.reduce((s, c) => s + RC.cardValue(c), 0)
    };
  }

  function calcDeadwood(hand) {
    return findBestMelds(hand).deadwoodValue;
  }

  // Check if a card can be laid off on existing melds
  function canLayOff(card, melds) {
    for (const meld of melds) {
      // Check if it extends a set
      if (meld.length >= 3 && meld.every(c => c.rank === meld[0].rank)) {
        if (card.rank === meld[0].rank && meld.length < 4)
          return true;
      }
      // Check if it extends a run
      const suitCards = meld.filter(c => c.suit === card.suit);
      if (suitCards.length === meld.length && meld.length >= 3) {
        const ranks = meld.map(c => RC.rankIndex(c)).sort((a, b) => a - b);
        const ci = RC.rankIndex(card);
        if (ci === ranks[0] - 1 || ci === ranks[ranks.length - 1] + 1)
          return true;
      }
    }
    return false;
  }

  Object.assign(V, { findBestMelds, canLayOff, calcDeadwood, cardHasHint });

})();
