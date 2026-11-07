/* Card helpers shared by the rummy family: point values, rank order, hand sorting
   (plain and with jokers), the fanned player-hand layout and the joker face. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;

  /* ── Card values: A=1, 2-10=face, J/Q/K=10 ── */
  const CARD_VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10 };

  function cardValue(card) {
    return CARD_VALUES[card.rank];
  }

  function rankIndex(card) {
    return CE.RANKS.indexOf(card.rank);
  }

  /* Suit, then rank */
  function sortHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return rankIndex(a) - rankIndex(b);
    });
  }

  function isJoker(card) {
    return card.suit === 'joker';
  }

  /* Rank order where a joker has no rank */
  function rankIndexJokers(card) {
    if (card.suit === 'joker') return -1;
    return CE.RANKS.indexOf(card.rank);
  }

  /* Suit, then rank, jokers last */
  function sortHandJokers(hand) {
    hand.sort((a, b) => {
      if (a.suit === 'joker' && b.suit === 'joker') return 0;
      if (a.suit === 'joker') return 1;
      if (b.suit === 'joker') return -1;
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return rankIndexJokers(a) - rankIndexJokers(b);
    });
  }

  /* Left edge of card idx in a player hand of total cards, centred on the table */
  function playerCardX(idx, total) {
    const maxWidth = 650;
    const spacing = Math.min(60, maxWidth / Math.max(total, 1));
    const startX = (CANVAS_W - spacing * (total - 1) - CE.CARD_W) / 2;
    return startX + idx * spacing;
  }

  function drawJokerFace(cx, x, y, w, h) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    CE.drawRoundedRect(cx, x, y, cw, ch, cr);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#333';
    cx.lineWidth = 1;
    cx.stroke();

    // Purple inner
    const m = 4;
    CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
    cx.fillStyle = '#6a0dad';
    cx.fill();

    // Star symbol
    const ss = Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    cx.fillStyle = '#ffd700';
    cx.font = 'bold ' + Math.round(28 * ss) + 'px serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('\u2605', x + cw / 2, y + ch / 2 - 4 * ss);

    cx.fillStyle = '#fff';
    cx.font = 'bold ' + Math.round(10 * ss) + 'px sans-serif';
    cx.fillText('JOKER', x + cw / 2, y + ch / 2 + 16 * ss);
  }

  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};
  SZ.CardGames.shared.rummyCards = {
    CARD_VALUES, cardValue, rankIndex, sortHand, isJoker, rankIndexJokers, sortHandJokers, playerCardX, drawJokerFace
  };

})();
