/* Yaniv rules: deck, card values, legal discards (single, set, run), drawable cards, turn order and hints. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.yaniv;
  const S = V.S;
  const { NUM_PLAYERS } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  /* ── Card values for scoring: A=1, 2-10=face, J/Q/K=10, Joker=0 ── */
  function cardValue(card) {
    if (card.suit === 'joker') return 0;
    if (card.rank === 'A') return 1;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  function handTotal(hand) {
    let total = 0;
    for (let i = 0; i < hand.length; ++i)
      total += cardValue(hand[i]);
    return total;
  }

  /* ================================================================
     DECK CREATION (52 + 2 jokers)
     ================================================================ */

  function createYanivDeck() {
    const deck = CE.createDeck();
    deck.push({ suit: 'joker', rank: 'JK', value: -1, faceUp: false, color: 'red' });
    deck.push({ suit: 'joker', rank: 'JK', value: -1, faceUp: false, color: 'red' });
    return deck;
  }

  /* ================================================================
     DISCARD VALIDATION
     ================================================================ */

  /* Single card: always valid */
  function isSingleDiscard(cards) {
    return cards.length === 1;
  }

  /* Set: 2+ cards of the same rank, no jokers */
  function isSetDiscard(cards) {
    if (cards.length < 2) return false;
    for (let i = 0; i < cards.length; ++i)
      if (cards[i].suit === 'joker') return false;
    const rank = cards[0].rank;
    for (let i = 1; i < cards.length; ++i)
      if (cards[i].rank !== rank) return false;
    return true;
  }

  /* Run: 3+ consecutive cards of the same suit (jokers act as wild) */
  function isRunDiscard(cards) {
    if (cards.length < 3) return false;

    // Separate jokers and non-jokers
    const jokers = [];
    const normals = [];
    for (let i = 0; i < cards.length; ++i) {
      if (cards[i].suit === 'joker')
        jokers.push(cards[i]);
      else
        normals.push(cards[i]);
    }

    // Need at least one normal card
    if (normals.length === 0) return false;

    // All normal cards must share the same suit
    const suit = normals[0].suit;
    for (let i = 1; i < normals.length; ++i)
      if (normals[i].suit !== suit) return false;

    // Sort normals by rank index
    normals.sort((a, b) => RC.rankIndexJokers(a) - RC.rankIndexJokers(b));

    // Check for duplicate ranks among normals
    for (let i = 1; i < normals.length; ++i)
      if (RC.rankIndexJokers(normals[i]) === RC.rankIndexJokers(normals[i - 1])) return false;

    // Count gaps between consecutive normals
    let gapsNeeded = 0;
    for (let i = 1; i < normals.length; ++i)
      gapsNeeded += RC.rankIndexJokers(normals[i]) - RC.rankIndexJokers(normals[i - 1]) - 1;

    // Jokers can fill gaps
    return jokers.length >= gapsNeeded;
  }

  function isValidDiscard(cards) {
    if (cards.length === 0) return false;
    return isSingleDiscard(cards) || isSetDiscard(cards) || isRunDiscard(cards);
  }

  /* ================================================================
     DRAW SOURCES
     ================================================================ */

  /* Can draw the first or last card of the discard group, or from stock */
  function getDrawableDiscardCards() {
    if (S.discardGroup.length === 0) return [];
    if (S.discardGroup.length === 1) return [0];
    return [0, S.discardGroup.length - 1];
  }

  /* ================================================================
     NEXT ACTIVE PLAYER
     ================================================================ */

  function nextActivePlayer(from) {
    let next = (from + 1) % NUM_PLAYERS;
    let safety = 0;
    while (S.eliminated[next] && safety < NUM_PLAYERS) {
      next = (next + 1) % NUM_PLAYERS;
      ++safety;
    }
    return next;
  }

  function countActivePlayers() {
    let count = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (!S.eliminated[p]) ++count;
    return count;
  }

  /* ================================================================
     HINT HELPER
     ================================================================ */

  function cardHasHint(hand, idx) {
    const card = hand[idx];

    // Check for 2+ same rank (potential set discard)
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].suit !== 'joker' && hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Jokers always hint (useful in runs)
    if (card.suit === 'joker') return true;

    // Check for consecutive same suit (potential run)
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].suit === card.suit && hand[i].suit !== 'joker')
        suitCards.push(RC.rankIndexJokers(hand[i]));
    }
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

    // High-value card hint (discard candidates)
    if (cardValue(card) >= 10) return true;

    return false;
  }

  Object.assign(V, { createYanivDeck, nextActivePlayer, handTotal, countActivePlayers,
    isValidDiscard, cardValue, getDrawableDiscardCards, cardHasHint });

})();
