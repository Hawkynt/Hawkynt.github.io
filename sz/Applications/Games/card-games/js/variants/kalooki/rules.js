/* Kalooki rules: deck, penalties and meld values, meld points, joker replacement, meld search and hints. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.kalooki;
  const S = V.S;
  const RC = SZ.CardGames.shared.rummyCards;
  const RM = SZ.CardGames.shared.rummyMelds;

  function cardPenalty(card) {
    if (RC.isJoker(card)) return 50;
    if (card.rank === 'A') return 11;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  function cardMeldValue(card, substituteRank) {
    if (RC.isJoker(card))
      return substituteRank ? meldValueOfRank(substituteRank) : 0;
    if (card.rank === 'A') return 11; // A counts as 11 in melds for initial threshold
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  function meldValueOfRank(rank) {
    if (rank === 'A') return 11;
    if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
    const n = parseInt(rank);
    return isNaN(n) ? 0 : n;
  }

  function handPenalty(hand) {
    let total = 0;
    for (const c of hand) total += cardPenalty(c);
    return total;
  }

  /* ══════════════════════════════════════════════════════════════════
     DECK CREATION (52 + 2 jokers)
     ══════════════════════════════════════════════════════════════════ */

  function createKalookiDeck() {
    const deck = CE.createDeck();
    deck.push({ suit: 'joker', rank: 'Joker', value: -1, faceUp: false, color: 'red' });
    deck.push({ suit: 'joker', rank: 'Joker', value: -1, faceUp: false, color: 'red' });
    return deck;
  }

  /* ── Calculate the meld point value (for initial meld threshold check) ── */
  function meldPointValue(cards) {
    let total = 0;
    const nonJokers = cards.filter(c => !RC.isJoker(c));
    for (const c of nonJokers) total += cardMeldValue(c);

    // Jokers count as the card they substitute for
    if (RM.isValidSet(cards)) {
      const rank = nonJokers[0].rank;
      const jokerCount = cards.length - nonJokers.length;
      total += jokerCount * meldValueOfRank(rank);
    } else if (RM.isValidRun(cards)) {
      // Determine which ranks the jokers fill in
      const sorted = nonJokers.slice().sort((a, b) => RC.rankIndexJokers(a) - RC.rankIndexJokers(b));
      const occupiedRanks = new Set(sorted.map(c => RC.rankIndexJokers(c)));
      const minRank = RC.rankIndexJokers(sorted[0]);
      const maxNeeded = minRank + cards.length - 1;
      for (let r = minRank; r <= maxNeeded && r < CE.RANKS.length; ++r) {
        if (!occupiedRanks.has(r))
          total += meldValueOfRank(CE.RANKS[r]);
      }
    }
    return total;
  }

  /* ── Can a real card replace a joker in a meld? ── */
  function canReplaceJoker(card, meld) {
    if (RC.isJoker(card)) return false;
    const jokerIdx = meld.cards.findIndex(c => RC.isJoker(c));
    if (jokerIdx < 0) return false;
    // Try replacing the joker with the card
    const testCards = meld.cards.slice();
    testCards[jokerIdx] = card;
    return RM.isValidSet(testCards) || RM.isValidRun(testCards);
  }

  function findBestMelds(hand) {
    const allMelds = [...RM.findAllSets(hand), ...RM.findAllRuns(hand)];
    if (allMelds.length === 0)
      return { melds: [], remaining: hand.slice(), penalty: handPenalty(hand) };

    let bestPenalty = Infinity;
    let bestCombo = [];

    function search(meldIdx, used, combo) {
      let pen = 0;
      for (let i = 0; i < hand.length; ++i)
        if (!used.has(i)) pen += cardPenalty(hand[i]);
      if (pen < bestPenalty) {
        bestPenalty = pen;
        bestCombo = combo.slice();
      }
      if (pen === 0) return;
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

    const meldCards = [];
    const usedIndices = new Set();
    for (const mi of bestCombo) {
      const meld = allMelds[mi];
      meldCards.push(meld.map(i => hand[i]));
      for (const i of meld) usedIndices.add(i);
    }
    const remaining = [];
    for (let i = 0; i < hand.length; ++i)
      if (!usedIndices.has(i)) remaining.push(hand[i]);
    return { melds: meldCards, remaining, penalty: bestPenalty };
  }

  /* ── Hint helper ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];
    // Check sets
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (!RC.isJoker(hand[i]) && hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;
    if (RC.isJoker(card)) return true; // jokers always hintable

    // Check runs
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (!RC.isJoker(hand[i]) && hand[i].suit === card.suit)
        suitCards.push(RC.rankIndexJokers(hand[i]));
    suitCards.sort((a, b) => a - b);
    const ci = RC.rankIndexJokers(card);
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

    // Check joker replacement opportunities on table melds
    for (const tm of S.tableMelds)
      if (canReplaceJoker(card, tm)) return true;

    return false;
  }

  Object.assign(V, { createKalookiDeck, meldPointValue, canReplaceJoker, handPenalty,
    findBestMelds, cardPenalty, cardHasHint });

})();
