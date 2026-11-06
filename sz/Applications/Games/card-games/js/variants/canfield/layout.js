;(function() {
  'use strict';

  /* Canfield: table geometry - pile and card positions, hit testing and
     pointer coordinate conversion. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.canfield;
  const S = V.S;
  const {
    CARD_W, CARD_H, FACE_UP_OFFSET, MARGIN_X, MARGIN_Y, PILE_GAP, FOUNDATION_COUNT, TABLEAU_COUNT
  } = V;

  /* ================================================================
   *  LAYOUT HELPERS
   * ================================================================ */

  function reservePos() {
    return { x: MARGIN_X, y: MARGIN_Y };
  }

  function foundationPos(i) {
    return { x: MARGIN_X + (2 + i) * PILE_GAP, y: MARGIN_Y };
  }

  function stockPos() {
    return { x: MARGIN_X, y: MARGIN_Y + CARD_H + 20 };
  }

  function wastePos() {
    return { x: MARGIN_X + PILE_GAP, y: MARGIN_Y + CARD_H + 20 };
  }

  function tableauPos(col) {
    return { x: MARGIN_X + (2 + col) * PILE_GAP, y: MARGIN_Y + CARD_H + 20 };
  }

  function tableauCardPos(col, index) {
    const base = tableauPos(col);
    return { x: base.x, y: base.y + index * FACE_UP_OFFSET };
  }

  function wasteCardPos(i) {
    const base = wastePos();
    const visibleStart = Math.max(0, S.waste.length - 3);
    const visibleIndex = i - visibleStart;
    if (visibleIndex < 0)
      return { x: base.x, y: base.y };
    return { x: base.x + visibleIndex * 16, y: base.y };
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(px, py) {
    // Reserve pile
    const rp = reservePos();
    if (px >= rp.x && px < rp.x + CARD_W && py >= rp.y && py < rp.y + CARD_H)
      return { area: 'reserve' };

    // Stock pile
    const sp = stockPos();
    if (px >= sp.x && px < sp.x + CARD_W && py >= sp.y && py < sp.y + CARD_H)
      return { area: 'stock' };

    // Waste pile
    if (S.waste.length > 0) {
      const visibleStart = Math.max(0, S.waste.length - 3);
      for (let i = S.waste.length - 1; i >= visibleStart; --i) {
        const pos = wasteCardPos(i);
        if (px >= pos.x && px < pos.x + CARD_W && py >= pos.y && py < pos.y + CARD_H)
          return { area: 'waste', index: i };
      }
    }

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

  function toInternal(mx, my) {
    return { x: mx / S.scale, y: my / S.scale };
  }

  Object.assign(V, {
    reservePos, foundationPos, stockPos, wastePos, tableauPos, tableauCardPos, wasteCardPos,
    hitTest, toInternal
  });

})();
