;(function() {
  'use strict';

  /* FreeCell: table geometry - pile and card positions, hit testing and
     pointer coordinate conversion. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.freecell;
  const S = V.S;
  const {
    CARD_W, CARD_H, FACE_UP_OFFSET, MARGIN_X, PILE_GAP, FREECELL_COUNT, FOUNDATION_COUNT,
    TABLEAU_COUNT, TOP_ROW_Y, TABLEAU_TOP
  } = V;

  /* ================================================================
   *  LAYOUT: compute positions
   * ================================================================ */

  function freeCellPos(i) {
    return { x: MARGIN_X + i * PILE_GAP, y: TOP_ROW_Y };
  }

  function foundationPos(i) {
    return { x: MARGIN_X + (4 + i) * PILE_GAP, y: TOP_ROW_Y };
  }

  function tableauPos(col) {
    return { x: MARGIN_X + col * PILE_GAP, y: TABLEAU_TOP };
  }

  function tableauCardPos(col, index) {
    const base = tableauPos(col);
    return { x: base.x, y: base.y + index * FACE_UP_OFFSET };
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(px, py) {
    for (let i = 0; i < FREECELL_COUNT; ++i) {
      const pos = freeCellPos(i);
      if (px >= pos.x && px < pos.x + CARD_W && py >= pos.y && py < pos.y + CARD_H)
        return { area: S.freeCells[i] ? 'freecell' : 'freecell-empty', col: i };
    }

    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (px >= fp.x && px < fp.x + CARD_W && py >= fp.y && py < fp.y + CARD_H)
        return { area: 'foundation', index: i };
    }

    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = S.tableau[col];
      if (pile.length === 0) {
        const tp = tableauPos(col);
        if (px >= tp.x && px < tp.x + CARD_W && py >= tp.y && py < tp.y + CARD_H)
          return { area: 'tableau-empty', col };
        continue;
      }
      for (let i = pile.length - 1; i >= 0; --i) {
        const pos = tableauCardPos(col, i);
        const h = (i === pile.length - 1) ? CARD_H : FACE_UP_OFFSET;
        if (px >= pos.x && px < pos.x + CARD_W && py >= pos.y && py < pos.y + h)
          return { area: 'tableau', col, index: i, card: pile[i] };
      }
    }

    return null;
  }

  /* ================================================================
   *  COORDINATE CONVERSION
   * ================================================================ */

  function toGame(mx, my) {
    return { x: mx / S.scale, y: my / S.scale };
  }

  Object.assign(V, { freeCellPos, foundationPos, tableauPos, tableauCardPos, hitTest, toGame });

})();
