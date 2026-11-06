;(function() {
  'use strict';

  /* Yukon: table geometry - pile and card positions, hit testing and
     pointer coordinate conversion. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.yukon;
  const S = V.S;
  const {
    CARD_W, CARD_H, FACE_DOWN_OFFSET, FACE_UP_OFFSET, MARGIN_X, MARGIN_Y, PILE_GAP,
    FOUNDATION_COUNT, TABLEAU_COUNT
  } = V;

  /* ================================================================
   *  LAYOUT: compute positions
   * ================================================================ */

  function foundationPos(i) {
    return { x: MARGIN_X + (3 + i) * PILE_GAP, y: MARGIN_Y };
  }

  function tableauPos(col) {
    return { x: MARGIN_X + col * PILE_GAP, y: MARGIN_Y + CARD_H + 20 };
  }

  function tableauCardPos(col, index) {
    const base = tableauPos(col);
    let y = base.y;
    for (let i = 0; i < index; ++i)
      y += S.tableau[col][i].faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET;
    return { x: base.x, y };
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(px, py) {
    // Foundation piles
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (px >= fp.x && px < fp.x + CARD_W && py >= fp.y && py < fp.y + CARD_H)
        return { area: 'foundation', index: i };
    }

    // Tableau columns
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
        const h = (i === pile.length - 1) ? CARD_H : (pile[i].faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET);
        if (px >= pos.x && px < pos.x + CARD_W && py >= pos.y && py < pos.y + h)
          return { area: 'tableau', col, index: i, card: pile[i] };
      }
    }

    return null;
  }

  /* ================================================================
   *  COORDINATE CONVERSION
   * ================================================================ */

  function toInternal(mx, my) {
    return { x: mx / S.scale, y: my / S.scale };
  }

  Object.assign(V, { foundationPos, tableauPos, tableauCardPos, hitTest, toInternal });

})();
