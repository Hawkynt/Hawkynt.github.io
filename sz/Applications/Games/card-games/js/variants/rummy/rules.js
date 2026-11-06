/* Rummy rules: card penalties, set/run validation, lay-offs, meld search and hint detection. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.rummy;
  const S = V.S;
  const RC = SZ.CardGames.shared.rummyCards;

  /* ── Card penalty values: A=1, 2-10=face, J/Q/K=10 ── */
  function cardPenalty(card) {
    if (card.rank === 'A') return 1;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  /* ================================================================
     MELD VALIDATION
     ================================================================ */

  /* Check if cards form a valid set (3-4 cards of the same rank) */
  function isValidSet(cards) {
    if (cards.length < 3 || cards.length > 4) return false;
    const rank = cards[0].rank;
    for (const c of cards)
      if (c.rank !== rank) return false;
    // No duplicate suits
    const suits = new Set();
    for (const c of cards) {
      if (suits.has(c.suit)) return false;
      suits.add(c.suit);
    }
    return true;
  }

  /* Check if cards form a valid run (3+ consecutive same-suit cards) */
  function isValidRun(cards) {
    if (cards.length < 3) return false;
    const suit = cards[0].suit;
    for (const c of cards)
      if (c.suit !== suit) return false;
    const sorted = cards.slice().sort((a, b) => RC.rankIndex(a) - RC.rankIndex(b));
    for (let i = 1; i < sorted.length; ++i) {
      if (RC.rankIndex(sorted[i]) !== RC.rankIndex(sorted[i - 1]) + 1)
        return false;
      if (RC.rankIndex(sorted[i]) === RC.rankIndex(sorted[i - 1]))
        return false; // duplicate
    }
    return true;
  }

  function isValidMeld(cards) {
    return isValidSet(cards) || isValidRun(cards);
  }

  /* Check if a single card can be laid off on an existing table meld */
  function canLayOffOn(card, meld) {
    const testCards = meld.cards.concat(card);
    return isValidSet(testCards) || isValidRun(testCards);
  }

  function findLayOffTarget(card) {
    for (let i = 0; i < S.tableMelds.length; ++i)
      if (canLayOffOn(card, S.tableMelds[i])) return i;
    return -1;
  }

  /* ================================================================
     MELD DETECTION (for AI and hints)
     ================================================================ */

  function findAllSets(hand) {
    const byRank = {};
    for (let i = 0; i < hand.length; ++i) {
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }
    const results = [];
    for (const rank in byRank) {
      if (byRank[rank].length >= 3)
        results.push(byRank[rank].slice(0, Math.min(byRank[rank].length, 4)));
    }
    return results;
  }

  function findAllRuns(hand) {
    const bySuit = {};
    for (let i = 0; i < hand.length; ++i) {
      const s = hand[i].suit;
      if (!bySuit[s]) bySuit[s] = [];
      bySuit[s].push(i);
    }
    const results = [];
    for (const suit in bySuit) {
      const indices = bySuit[suit];
      indices.sort((a, b) => RC.rankIndex(hand[a]) - RC.rankIndex(hand[b]));
      for (let start = 0; start < indices.length; ++start) {
        const run = [indices[start]];
        for (let next = start + 1; next < indices.length; ++next) {
          if (RC.rankIndex(hand[indices[next]]) === RC.rankIndex(hand[run[run.length - 1]]) + 1)
            run.push(indices[next]);
          else
            break;
        }
        if (run.length >= 3)
          results.push(run.slice());
      }
    }
    return results;
  }

  /* Find the best non-overlapping melds that remove the most penalty points */
  function findBestMelds(hand) {
    const allMelds = [...findAllSets(hand), ...findAllRuns(hand)];
    if (allMelds.length === 0)
      return { melds: [], indices: new Set() };

    let bestRemoved = 0;
    let bestCombo = [];

    function search(meldIdx, used, combo) {
      let removed = 0;
      for (const idx of used) removed += cardPenalty(hand[idx]);
      if (removed > bestRemoved) {
        bestRemoved = removed;
        bestCombo = combo.slice();
      }
      for (let m = meldIdx; m < allMelds.length; ++m) {
        const meld = allMelds[m];
        let overlaps = false;
        for (const idx of meld) {
          if (used.has(idx)) { overlaps = true; break; }
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

    const usedIndices = new Set();
    const meldGroups = [];
    for (const mi of bestCombo) {
      const meld = allMelds[mi];
      meldGroups.push(meld.slice());
      for (const i of meld) usedIndices.add(i);
    }
    return { melds: meldGroups, indices: usedIndices };
  }

  /* Find the single best meld to play (for AI incremental melding) */
  function findBestSingleMeld(hand) {
    const allMelds = [...findAllSets(hand), ...findAllRuns(hand)];
    if (allMelds.length === 0) return null;
    let best = null;
    let bestVal = 0;
    for (const m of allMelds) {
      let val = 0;
      for (const idx of m) val += cardPenalty(hand[idx]);
      if (val > bestVal) {
        bestVal = val;
        best = m;
      }
    }
    return best;
  }

  /* ── Hint: does this card participate in a potential meld or lay-off? ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];

    // Check for 2+ cards of the same rank (potential set)
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Check for run potential (2+ consecutive same suit)
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].suit === card.suit) suitCards.push(RC.rankIndex(hand[i]));
    suitCards.sort((a, b) => a - b);
    const ci = RC.rankIndex(card);
    for (let s = 0; s < suitCards.length; ++s) {
      let runLen = 1;
      let inRun = suitCards[s] === ci;
      for (let n = s + 1; n < suitCards.length; ++n) {
        if (suitCards[n] === suitCards[n - 1] + 1) {
          ++runLen;
          if (suitCards[n] === ci) inRun = true;
        } else
          break;
      }
      if (runLen >= 2 && inRun) return true;
    }

    // Check if card can lay off on existing table melds
    for (const tm of S.tableMelds)
      if (canLayOffOn(card, tm)) return true;

    return false;
  }

  Object.assign(V, { cardPenalty, isValidMeld, findLayOffTarget, findBestSingleMeld, findBestMelds,
    cardHasHint });

})();
