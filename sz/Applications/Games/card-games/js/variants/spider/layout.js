;(function() {
  'use strict';

  /* Spider: table geometry - pile and card positions, hit testing and
     pointer coordinate conversion. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spider;
  const S = V.S;
  const { CARD_W, CARD_H, FACE_DOWN_OFFSET, FACE_UP_OFFSET, MARGIN_X, MARGIN_Y, TABLEAU_COUNT } = V;

  /* ================================================================
   *  LAYOUT HELPERS
   * ================================================================ */

  function cardGap() {
    return Math.max(4, Math.floor((S.canvasW - MARGIN_X * 2 - TABLEAU_COUNT * CARD_W) / (TABLEAU_COUNT - 1)));
  }

  function pileGap() {
    return CARD_W + cardGap();
  }

  function tableauPos(col) {
    return { x: MARGIN_X + col * pileGap(), y: MARGIN_Y };
  }

  function tableauCardPos(col, index) {
    const base = tableauPos(col);
    let y = base.y;
    for (let i = 0; i < index; ++i)
      y += S.tableau[col][i].faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET;
    return { x: base.x, y };
  }

  function stockPos() {
    const gap = pileGap();
    const x = MARGIN_X + (TABLEAU_COUNT - 1) * gap;
    return { x, y: S.canvasH - CARD_H - MARGIN_Y };
  }

  function foundationPos(index) {
    const gap = Math.min(pileGap(), 30);
    return { x: MARGIN_X + index * gap, y: S.canvasH - CARD_H - MARGIN_Y };
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(px, py) {
    if (S.stock.length > 0) {
      const sp = stockPos();
      const dealsLeft = Math.min(Math.ceil(S.stock.length / TABLEAU_COUNT), 5);
      const leftMost = sp.x - (dealsLeft - 1) * 3;
      if (px >= leftMost && px < sp.x + CARD_W && py >= sp.y && py < sp.y + CARD_H)
        return { area: 'stock' };
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
        const h = (i === pile.length - 1) ? CARD_H : (pile[i].faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET);
        if (px >= pos.x && px < pos.x + CARD_W && py >= pos.y && py < pos.y + h)
          return { area: 'tableau', col, index: i, card: pile[i] };
      }
    }

    return null;
  }

  Object.assign(V, { tableauPos, tableauCardPos, stockPos, foundationPos, hitTest });

})();
