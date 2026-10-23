;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  const SUIT_COLORS = { spades: '#000', hearts: '#d00', diamonds: '#d00', clubs: '#000' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* ── Unicode suit bridge ── */
  const UNICODE_TO_NAME = {
    '\u2660': 'spades', '\u2665': 'hearts',
    '\u2666': 'diamonds', '\u2663': 'clubs'
  };

  function resolveSuit(suit) {
    return UNICODE_TO_NAME[suit] || suit;
  }

  function resolveSuitColor(suit) {
    const CT = SZ.CardThemes;
    if (CT) {
      const tpl = CT.CARD_FACE_TEMPLATES[CT.activeTheme.cardFace];
      if (tpl && tpl.suitColors)
        return tpl.suitColors[resolveSuit(suit)] || '#000';
    }
    return SUIT_COLORS[resolveSuit(suit)] || '#000';
  }

  const CARD_W = 80;
  const CARD_H = 110;
  const CARD_RADIUS = 5;

  const GREEN = '#1a7a2e';
  const DARK_GREEN = '#126622';

  const FIREWORK_COLORS = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800', '#ff0088', '#88ff00', '#ffffff'];

  /* ================================================================
   *  PIP LAYOUTS (for number cards)
   * ================================================================ */

  const PIP_LAYOUTS = {
    1:  [[0.5, 0.5]],
    2:  [[0.5, 0.2], [0.5, 0.8]],
    3:  [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]],
    4:  [[0.3, 0.2], [0.7, 0.2], [0.3, 0.8], [0.7, 0.8]],
    5:  [[0.3, 0.2], [0.7, 0.2], [0.5, 0.5], [0.3, 0.8], [0.7, 0.8]],
    6:  [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
    7:  [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
    8:  [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.5, 0.65], [0.3, 0.8], [0.7, 0.8]],
    9:  [[0.3, 0.18], [0.7, 0.18], [0.3, 0.38], [0.7, 0.38], [0.5, 0.5], [0.3, 0.62], [0.7, 0.62], [0.3, 0.82], [0.7, 0.82]],
    10: [[0.3, 0.18], [0.7, 0.18], [0.5, 0.28], [0.3, 0.38], [0.7, 0.38], [0.3, 0.62], [0.7, 0.62], [0.5, 0.72], [0.3, 0.82], [0.7, 0.82]]
  };

  /* ================================================================
   *  CARD OBJECT FACTORY
   * ================================================================ */

  function makeCard(suit, rank) {
    const resolved = resolveSuit(suit);
    return {
      suit: resolved,
      rank,
      value: RANKS.indexOf(rank),
      faceUp: false,
      color: (resolved === 'hearts' || resolved === 'diamonds') ? 'red' : 'black'
    };
  }

  /* ================================================================
   *  DECK CREATION & SHUFFLE
   * ================================================================ */

  function createDeck() {
    const deck = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        deck.push(makeCard(suit, rank));
    return deck;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* ================================================================
   *  DECK - From Arbitrary Ranks
   * ================================================================ */

  function createDeckFromRanks(suits, ranks) {
    const deck = [];
    for (const suit of suits)
      for (const rank of ranks) {
        const resolved = resolveSuit(suit);
        deck.push({
          suit: resolved,
          rank,
          value: RANKS.indexOf(rank),
          faceUp: false,
          color: (resolved === 'hearts' || resolved === 'diamonds') ? 'red' : 'black'
        });
      }
    return deck;
  }

  /* ================================================================
   *  EASING
   * ================================================================ */

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /* ================================================================
   *  UTILITY - Hit Test
   * ================================================================ */

  function isInRect(mx, my, x, y, w, h) {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  /* ================================================================
   *  PUBLIC API
   * ================================================================ */

  SZ.CardEngine = {
    // Constants
    SUITS,
    SUIT_COLORS,
    RANKS,
    CARD_W,
    CARD_H,
    CARD_RADIUS,
    GREEN,
    DARK_GREEN,
    FIREWORK_COLORS,
    PIP_LAYOUTS,

    // Card factory
    makeCard,

    // Deck
    createDeck,
    createDeckFromRanks,
    shuffle,

    // Easing
    easeOutCubic,

    // Utility
    isInRect,
    resolveSuit,
    resolveSuitColor
  };

})();
