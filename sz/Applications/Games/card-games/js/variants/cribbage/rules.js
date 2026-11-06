/* Cribbage: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.cribbage;
  const S = V.S;
  const { PEG_MAX } = V;

  const CARD_VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10 };
  const RANK_ORDER = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };

  /* ================================================================
   *  CARD UTILITIES
   * ================================================================ */

  function cardValue(card) {
    return CARD_VALUES[card.rank];
  }

  function rankOrder(card) {
    return RANK_ORDER[card.rank];
  }

  function sortHand(hand) {
    hand.sort((a, b) => rankOrder(a) - rankOrder(b));
  }

  /* ================================================================
   *  SCORING - FIFTEENS
   * ================================================================ */

  function countFifteens(cards) {
    let count = 0;
    const n = cards.length;
    for (let mask = 1; mask < (1 << n); ++mask) {
      let sum = 0;
      for (let i = 0; i < n; ++i)
        if (mask & (1 << i))
          sum += cardValue(cards[i]);
      if (sum === 15)
        ++count;
    }
    return count * 2;
  }

  /* ================================================================
   *  SCORING - PAIRS
   * ================================================================ */

  function countPairs(cards) {
    let pts = 0;
    for (let i = 0; i < cards.length; ++i)
      for (let j = i + 1; j < cards.length; ++j)
        if (cards[i].rank === cards[j].rank)
          pts += 2;
    return pts;
  }

  /* ================================================================
   *  SCORING - RUNS
   * ================================================================ */

  function countRuns(cards) {
    const orders = cards.map(c => rankOrder(c)).sort((a, b) => a - b);
    let pts = 0;
    let bestLen = 0;
    let bestCount = 0;

    // Find all runs of length 3+, accounting for duplicates
    // Use frequency-based approach
    const freq = {};
    for (const o of orders)
      freq[o] = (freq[o] || 0) + 1;

    const unique = [...new Set(orders)].sort((a, b) => a - b);

    // Find consecutive sequences among unique values
    let i = 0;
    while (i < unique.length) {
      let j = i;
      while (j < unique.length - 1 && unique[j + 1] === unique[j] + 1)
        ++j;
      const runLen = j - i + 1;
      if (runLen >= 3) {
        // Multiply by frequencies of each rank in the run
        let multiplier = 1;
        for (let k = i; k <= j; ++k)
          multiplier *= freq[unique[k]];
        const runPts = runLen * multiplier;
        if (runLen > bestLen) {
          bestLen = runLen;
          bestCount = runPts;
        } else if (runLen === bestLen)
          bestCount += runPts;
      }
      i = j + 1;
    }
    pts = bestCount;
    return pts;
  }

  /* ================================================================
   *  SCORING - FLUSH
   * ================================================================ */

  function countFlush(hand, starter, isCrib) {
    if (hand.length < 4)
      return 0;
    const suit = hand[0].suit;
    const allSame = hand.every(c => c.suit === suit);
    if (!allSame)
      return 0;
    if (isCrib) {
      // Crib flush requires all 5 same suit
      if (starter && starter.suit === suit)
        return 5;
      return 0;
    }
    if (starter && starter.suit === suit)
      return 5;
    return 4;
  }

  /* ================================================================
   *  SCORING - NOBS
   * ================================================================ */

  function countNobs(hand, starter) {
    if (!starter)
      return 0;
    for (const c of hand)
      if (c.rank === 'J' && c.suit === starter.suit)
        return 1;
    return 0;
  }

  /* ================================================================
   *  SCORING - TOTAL HAND SCORE
   * ================================================================ */

  function scoreHand(hand, starter, isCrib) {
    const cards = starter ? hand.concat(starter) : hand.slice();
    const fifteens = countFifteens(cards);
    const pairs = countPairs(cards);
    const runs = countRuns(cards);
    const flush = countFlush(hand, starter, isCrib);
    const nobs = countNobs(hand, starter);
    const total = fifteens + pairs + runs + flush + nobs;
    return {
      fifteens, pairs, runs, flush, nobs, total,
      breakdown: [
        fifteens > 0 ? 'Fifteens: ' + fifteens : null,
        pairs > 0 ? 'Pairs: ' + pairs : null,
        runs > 0 ? 'Runs: ' + runs : null,
        flush > 0 ? 'Flush: ' + flush : null,
        nobs > 0 ? 'Nobs: ' + nobs : null
      ].filter(Boolean)
    };
  }

  /* ================================================================
   *  PEGGING - SCORING
   * ================================================================ */

  function scorePegPlay(playedCards, newCard) {
    let pts = 0;
    const all = playedCards.concat(newCard);
    let sum = 0;
    for (const c of all)
      sum += cardValue(c);

    // Fifteen
    if (sum === 15)
      pts += 2;
    // Thirty-one
    if (sum === 31)
      pts += 2;

    // Pairs from the end
    const n = all.length;
    if (n >= 2) {
      let pairCount = 0;
      for (let i = n - 2; i >= 0; --i) {
        if (all[i].rank === newCard.rank)
          ++pairCount;
        else
          break;
      }
      if (pairCount === 1) pts += 2;       // pair
      else if (pairCount === 2) pts += 6;   // three of a kind
      else if (pairCount === 3) pts += 12;  // four of a kind
    }

    // Runs from the end (check if last 3,4,5... cards form a run)
    if (n >= 3) {
      let bestRun = 0;
      for (let len = n; len >= 3; --len) {
        const tail = all.slice(n - len);
        const orders = tail.map(c => rankOrder(c)).sort((a, b) => a - b);
        let isRun = true;
        for (let k = 1; k < orders.length; ++k) {
          if (orders[k] !== orders[k - 1] + 1) {
            isRun = false;
            break;
          }
        }
        if (isRun) {
          bestRun = len;
          break;
        }
      }
      if (bestRun >= 3)
        pts += bestRun;
    }

    return pts;
  }

  function canPlayPeg(hand) {
    for (const c of hand)
      if (S.pegCount + cardValue(c) <= PEG_MAX)
        return true;
    return false;
  }

  V.cardValue = cardValue;
  V.sortHand = sortHand;
  V.scoreHand = scoreHand;
  V.scorePegPlay = scorePegPlay;
  V.canPlayPeg = canPlayPeg;

})();
