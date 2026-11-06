;(function() {
  'use strict';

  /* Pyramid: hit testing and the select-a-pair click logic. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.pyramid;
  const S = V.S;
  const {
    CARD_W, CARD_H, CANVAS_W, CANVAS_H, PYRAMID_ROWS, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y,
    NEW_DEAL_BTN, HINT_BTN, pyramidValue, pyramidCardPos, isExposed, drawFromStock, removePair,
    findHint
  } = V;

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(mx, my) {
    // Check pyramid cards (bottom rows first for overlap priority)
    for (let row = PYRAMID_ROWS - 1; row >= 0; --row)
      for (let col = row; col >= 0; --col) {
        if (S.pyramid[row][col].removed)
          continue;
        if (!isExposed(row, col))
          continue;
        const pos = pyramidCardPos(row, col);
        if (mx >= pos.x && mx < pos.x + CARD_W && my >= pos.y && my < pos.y + CARD_H)
          return { area: 'pyramid', row, col, card: S.pyramid[row][col].card };
      }

    // Check waste top
    if (S.waste.length > 0) {
      if (mx >= WASTE_X && mx < WASTE_X + CARD_W && my >= WASTE_Y && my < WASTE_Y + CARD_H)
        return { area: 'waste', card: S.waste[S.waste.length - 1] };
    }

    // Check stock
    if (S.stock.length > 0) {
      if (mx >= STOCK_X && mx < STOCK_X + CARD_W && my >= STOCK_Y && my < STOCK_Y + CARD_H)
        return { area: 'stock' };
    }

    // Check hint button
    if (mx >= HINT_BTN.x && mx < HINT_BTN.x + HINT_BTN.w && my >= HINT_BTN.y && my < HINT_BTN.y + HINT_BTN.h)
      return { area: 'hint' };

    // Check new deal button (only when game is over)
    if ((S.roundOver || S.gameOver) && mx >= NEW_DEAL_BTN.x && mx < NEW_DEAL_BTN.x + NEW_DEAL_BTN.w && my >= NEW_DEAL_BTN.y && my < NEW_DEAL_BTN.y + NEW_DEAL_BTN.h)
      return { area: 'newdeal' };

    return null;
  }

  /* ================================================================
   *  SELECTION LOGIC
   * ================================================================ */

  function handleSelection(hit) {
    if (hit.area === 'stock') {
      drawFromStock();
      return;
    }

    if (hit.area === 'hint') {
      const hint = findHint();
      if (hint) {
        S.hintPair = hint;
        S.hintTimer = 2.0;
      } else {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'No moves available', { color: '#f88', size: 18 });
      }
      return;
    }

    if (hit.area === 'newdeal') {
      if (S._host)
        S._host.onRoundOver(S.gameOver);
      return;
    }

    const card = hit.card;
    const val = pyramidValue(card);

    // King removes itself immediately
    if (val === 13) {
      const sel = hit.area === 'pyramid'
        ? { source: 'pyramid', row: hit.row, col: hit.col }
        : { source: 'waste' };
      removePair(sel, null);
      return;
    }

    const newSel = hit.area === 'pyramid'
      ? { source: 'pyramid', row: hit.row, col: hit.col, card }
      : { source: 'waste', card };

    // If there is already a selected card
    if (S.selectedCard) {
      const selVal = pyramidValue(S.selectedCard.card);
      const hitVal = val;

      // Same card clicked again: deselect
      if (isSameSelection(S.selectedCard, newSel)) {
        S.selectedCard = null;
        return;
      }

      // Check if they sum to 13
      if (selVal + hitVal === 13) {
        const a = { source: S.selectedCard.source };
        if (S.selectedCard.source === 'pyramid') {
          a.row = S.selectedCard.row;
          a.col = S.selectedCard.col;
        }
        const b = { source: newSel.source };
        if (newSel.source === 'pyramid') {
          b.row = newSel.row;
          b.col = newSel.col;
        }
        removePair(a, b);
        return;
      }

      // Not a valid pair; select the new card instead
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H - 100, 'Must sum to 13!', { color: '#f88', size: 16 });
      S.selectedCard = newSel;
      return;
    }

    // No previous selection
    S.selectedCard = newSel;
  }

  function isSameSelection(a, b) {
    if (a.source !== b.source)
      return false;
    if (a.source === 'pyramid')
      return a.row === b.row && a.col === b.col;
    return true; // both waste
  }

  Object.assign(V, { hitTest, handleSelection });

})();
