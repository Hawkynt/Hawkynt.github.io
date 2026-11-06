;(function() {
  'use strict';

  /* Baker's Dozen: table geometry - pile and card positions, hit testing and
     pointer coordinate conversion. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.bakersdozen;
  const S = V.S;
  const {
    CARD_W, CARD_H, FACE_UP_OFFSET, MARGIN_X, MARGIN_Y, TABLEAU_COUNT, FOUNDATION_COUNT, PILE_GAP,
    FOUNDATION_GAP, FOUNDATION_TOTAL_W, TABLEAU_TOP
  } = V;

  /* ================================================================
   *  LAYOUT HELPERS
   * ================================================================ */

  function foundationPos(i) {
    const totalW = S.canvasW / S.scale;
    const startX = (totalW - FOUNDATION_TOTAL_W) / 2;
    return { x: startX + i * (CARD_W + FOUNDATION_GAP), y: MARGIN_Y };
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

  Object.assign(V, { foundationPos, tableauPos, tableauCardPos, hitTest, toGame });

})();
