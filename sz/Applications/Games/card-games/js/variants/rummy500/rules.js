/* Rummy 500 rules: deck, card points, lay-off targets, meld search and hint detection. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.rummy500;
  const S = V.S;
  const RC = SZ.CardGames.shared.rummyCards;
  const RM = SZ.CardGames.shared.rummyMelds;

  /* ── Card point values for scoring ── */
  function cardPoints(card) {
    if (card.suit === 'joker') return 15;
    if (card.rank === 'A') return 15;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  /* ================================================================
     DECK CREATION (52 + 2 jokers)
     ================================================================ */

  function createRummy500Deck() {
    const deck = CE.createDeck();
    deck.push({ suit: 'joker', rank: 'Joker', value: -1, faceUp: false, color: 'red' });
    deck.push({ suit: 'joker', rank: 'Joker', value: -1, faceUp: false, color: 'red' });
    return deck;
  }

  function findLayOffTarget(card) {
    for (let i = 0; i < S.tableMelds.length; ++i)
      if (RM.canLayOffOn(card, S.tableMelds[i])) return i;
    return -1;
  }

  function findBestMeld(hand) {
    const allMelds = [...RM.findAllSets(hand), ...RM.findAllRuns(hand)];
    if (allMelds.length === 0) return null;
    // Pick highest-value meld
    let best = null;
    let bestVal = 0;
    for (const m of allMelds) {
      let val = 0;
      for (const idx of m) val += cardPoints(hand[idx]);
      if (val > bestVal) {
        bestVal = val;
        best = m;
      }
    }
    return best;
  }

  /* ── Hint: does this card participate in a potential meld? ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];
    if (RC.isJoker(card)) return true; // jokers always useful

    // Check for 2+ same rank
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (!RC.isJoker(hand[i]) && hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Check for run potential (2+ consecutive same suit)
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (!RC.isJoker(hand[i]) && hand[i].suit === card.suit)
        suitCards.push(RC.rankIndexJokers(hand[i]));
    suitCards.sort((a, b) => a - b);
    const ci = RC.rankIndexJokers(card);
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
      if (RM.canLayOffOn(card, tm)) return true;

    return false;
  }

  Object.assign(V, { createRummy500Deck, cardPoints, findLayOffTarget, findBestMeld, cardHasHint });

})();
