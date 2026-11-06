/* Joker-aware meld rules shared by Rummy 500 and Kalooki: valid sets and runs,
   lay-off checks and the set/run candidates a hand contains. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const RC = SZ.CardGames.shared.rummyCards;

  /* Check if cards form a valid set (3-4 same rank, jokers fill gaps) */
  function isValidSet(cards) {
    if (cards.length < 3 || cards.length > 4) return false;
    const nonJokers = cards.filter(c => !RC.isJoker(c));
    if (nonJokers.length === 0) return false;
    const rank = nonJokers[0].rank;
    for (const c of nonJokers)
      if (c.rank !== rank) return false;
    // Check for duplicate suits among non-jokers
    const suits = new Set();
    for (const c of nonJokers) {
      if (suits.has(c.suit)) return false;
      suits.add(c.suit);
    }
    return true;
  }

  /* Check if cards form a valid run (3+ consecutive same suit, jokers fill gaps) */
  function isValidRun(cards) {
    if (cards.length < 3) return false;
    const nonJokers = cards.filter(c => !RC.isJoker(c));
    if (nonJokers.length === 0) return false;
    // All non-jokers must be same suit
    const suit = nonJokers[0].suit;
    for (const c of nonJokers)
      if (c.suit !== suit) return false;

    // Sort non-jokers by rank
    const sorted = nonJokers.slice().sort((a, b) => RC.rankIndexJokers(a) - RC.rankIndexJokers(b));
    const jokerCount = cards.length - nonJokers.length;
    let jokersUsed = 0;

    // Build the sequence
    let prev = RC.rankIndexJokers(sorted[0]);
    for (let i = 1; i < sorted.length; ++i) {
      const cur = RC.rankIndexJokers(sorted[i]);
      const gap = cur - prev - 1;
      if (gap < 0) return false; // duplicate rank
      jokersUsed += gap;
      if (jokersUsed > jokerCount) return false;
      prev = cur;
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

  /* ================================================================
     MELD DETECTION (for AI and hints)
     ================================================================ */

  function findAllSets(hand) {
    const byRank = {};
    for (let i = 0; i < hand.length; ++i) {
      if (RC.isJoker(hand[i])) continue;
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }
    const results = [];
    for (const rank in byRank) {
      if (byRank[rank].length >= 3)
        results.push(byRank[rank].slice(0, Math.min(byRank[rank].length, 4)));
      else if (byRank[rank].length === 2) {
        // Check if a joker can complete it
        const jokerIdx = hand.findIndex(c => RC.isJoker(c));
        if (jokerIdx >= 0 && !byRank[rank].includes(jokerIdx))
          results.push([...byRank[rank], jokerIdx]);
      }
    }
    return results;
  }

  function findAllRuns(hand) {
    const bySuit = {};
    for (let i = 0; i < hand.length; ++i) {
      if (RC.isJoker(hand[i])) continue;
      const s = hand[i].suit;
      if (!bySuit[s]) bySuit[s] = [];
      bySuit[s].push(i);
    }
    const results = [];
    for (const suit in bySuit) {
      const indices = bySuit[suit];
      indices.sort((a, b) => RC.rankIndexJokers(hand[a]) - RC.rankIndexJokers(hand[b]));
      for (let start = 0; start < indices.length; ++start) {
        const run = [indices[start]];
        for (let next = start + 1; next < indices.length; ++next) {
          if (RC.rankIndexJokers(hand[indices[next]]) === RC.rankIndexJokers(hand[run[run.length - 1]]) + 1)
            run.push(indices[next]);
          else
            break;
        }
        if (run.length >= 3)
          results.push(run.slice());
        else if (run.length === 2) {
          // Try adding a joker
          const jokerIdx = hand.findIndex((c, idx) => RC.isJoker(c) && !run.includes(idx));
          if (jokerIdx >= 0)
            results.push([...run, jokerIdx]);
        }
      }
    }
    return results;
  }

  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};
  SZ.CardGames.shared.rummyMelds = { isValidSet, isValidRun, isValidMeld, canLayOffOn, findAllSets, findAllRuns };

})();
