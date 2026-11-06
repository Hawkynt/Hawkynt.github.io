/* Kalooki input: clicks on piles, buttons and cards, and keyboard shortcuts. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.kalooki;
  const S = V.S;
  const { CANVAS_W, PHASE_DRAW, PHASE_MELD, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y, MELD_BTN,
    LAYOFF_BTN, DISCARD_BTN } = V;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }
    if (S.currentPlayer !== 0) return;

    // Draw phase
    if (S.phase === PHASE_DRAW) {
      if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H) && (S.stockPile.length > 0 || S.discardPile.length > 1)) {
        V.playerDrawStock();
        return;
      }
      if (CE.isInRect(mx, my, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H) && S.discardPile.length > 0) {
        V.playerDrawDiscard();
        return;
      }
      return;
    }

    // Meld phase -- check buttons
    if (S.phase === PHASE_MELD) {
      if (CE.isInRect(mx, my, MELD_BTN.x, MELD_BTN.y, MELD_BTN.w, MELD_BTN.h)) {
        V.playerMeld();
        return;
      }
      if (CE.isInRect(mx, my, LAYOFF_BTN.x, LAYOFF_BTN.y, LAYOFF_BTN.w, LAYOFF_BTN.h)) {
        V.playerLayOff();
        return;
      }
      if (CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
        V.playerDiscard();
        return;
      }

      // Click on hand cards for selection
      const hand = S.hands[0];
      const spacing = Math.min(65, (CANVAS_W - 80) / Math.max(hand.length, 1));
      for (let i = hand.length - 1; i >= 0; --i) {
        const x = 30 + i * spacing;
        const sel = S.selectedIndices.includes(i);
        const y = sel ? 408 : 418;
        if (mx >= x && mx <= x + CE.CARD_W * 0.9 && my >= y && my <= y + CE.CARD_H * 0.9) {
          if (sel)
            S.selectedIndices = S.selectedIndices.filter(si => si !== i);
          else
            S.selectedIndices.push(i);
          return;
        }
      }
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver || S.currentPlayer !== 0) return;
    if (S.phase === PHASE_MELD) {
      if (e.key === 'm' || e.key === 'M') V.playerMeld();
      else if (e.key === 'l' || e.key === 'L') V.playerLayOff();
      else if (e.key === 'd' || e.key === 'D') V.playerDiscard();
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
