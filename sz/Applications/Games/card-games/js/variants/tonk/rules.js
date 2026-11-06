/* Tonk rules: hand totals, set/run validation, meld search and hint detection. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.tonk;
  const S = V.S;
  const RC = SZ.CardGames.shared.rummyCards;

  function handTotal(hand) {
    let total = 0;
    for (let i = 0; i < hand.length; ++i)
      total += RC.cardValue(hand[i]);
    return total;
  }

  /* ══════════════════════════════════════════════════════════════════
     MELD DETECTION
     ══════════════════════════════════════════════════════════════════ */

  /* Sets: 3-4 cards of the same rank */
  function isValidSet(cards) {
    if (cards.length < 3 || cards.length > 4) return false;
    const rank = cards[0].rank;
    const suits = new Set();
    for (let i = 0; i < cards.length; ++i) {
      if (cards[i].rank !== rank) return false;
      if (suits.has(cards[i].suit)) return false;
      suits.add(cards[i].suit);
    }
    return true;
  }

  /* Runs: 3+ consecutive cards of the same suit */
  function isValidRun(cards) {
    if (cards.length < 3) return false;
    const suit = cards[0].suit;
    for (let i = 0; i < cards.length; ++i)
      if (cards[i].suit !== suit) return false;
    const sorted = cards.slice().sort((a, b) => RC.rankIndex(a) - RC.rankIndex(b));
    for (let i = 1; i < sorted.length; ++i)
      if (RC.rankIndex(sorted[i]) !== RC.rankIndex(sorted[i - 1]) + 1) return false;
    return true;
  }

  function isValidMeld(cards) {
    return isValidSet(cards) || isValidRun(cards);
  }

  /* Can a card be added to an existing table meld? */
  function canExtendMeld(card, meld) {
    const testCards = meld.cards.concat(card);
    return isValidSet(testCards) || isValidRun(testCards);
  }

  /* Find all possible sets from hand indices */
  function findSetsInHand(hand) {
    const byRank = {};
    for (let i = 0; i < hand.length; ++i) {
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }
    const results = [];
    for (const rank in byRank)
      if (byRank[rank].length >= 3)
        results.push(byRank[rank].slice(0, Math.min(byRank[rank].length, 4)));
    return results;
  }

  /* Find all possible runs from hand indices */
  function findRunsInHand(hand) {
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

  function findBestMeld(hand) {
    const all = [...findSetsInHand(hand), ...findRunsInHand(hand)];
    if (all.length === 0) return null;
    let best = null;
    let bestLen = 0;
    for (const m of all) {
      if (m.length > bestLen) {
        bestLen = m.length;
        best = m;
      }
    }
    return best;
  }

  /* Find which table meld index this card can extend, or -1 */
  function findExtendTarget(card) {
    for (let i = 0; i < S.tableMelds.length; ++i)
      if (canExtendMeld(card, S.tableMelds[i])) return i;
    return -1;
  }

  /* ── Hint helper: does this card participate in a potential meld or extend one? ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];

    // Check for 2+ same rank in hand
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Check for run potential (2+ consecutive same suit)
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].suit === card.suit)
        suitCards.push(RC.rankIndex(hand[i]));
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

    // Check if card can extend an existing table meld
    if (findExtendTarget(card) >= 0) return true;

    return false;
  }

  Object.assign(V, { handTotal, isValidMeld, findExtendTarget, findBestMeld, cardHasHint });

})();
