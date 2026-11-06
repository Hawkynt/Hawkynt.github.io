/* Gin Rummy input: clicks on stock, discard pile, cards and the knock button, and keyboard shortcuts. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ginrummy;
  const S = V.S;
  const { CANVAS_W, PHASE_PLAYER_DRAW, PHASE_PLAYER_DISCARD, STOCK_X, STOCK_Y, DISCARD_X,
    DISCARD_Y, KNOCK_BTN } = V;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    // Player draw phase: click stock or discard
    if (S.phase === PHASE_PLAYER_DRAW) {
      if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
        V.playerDrawStock();
        return;
      }
      if (CE.isInRect(mx, my, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H) && S.discardPile.length > 0) {
        V.playerDrawDiscard();
        return;
      }
      return;
    }

    // Player discard phase: click card in hand to select/discard, or knock
    if (S.phase === PHASE_PLAYER_DISCARD) {
      // Check knock button
      const dwVal = V.calcDeadwood(S.playerHand);
      if (dwVal <= 10 && S.selectedCardIndex >= 0 && CE.isInRect(mx, my, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h)) {
        V.playerKnock();
        return;
      }

      // Click on hand cards
      const handSpacing = Math.min(68, (CANVAS_W - 180) / Math.max(S.playerHand.length, 1));
      for (let i = S.playerHand.length - 1; i >= 0; --i) {
        const cx = 90 + i * handSpacing;
        const cy = (i === S.selectedCardIndex) ? 450 : 460;
        if (mx >= cx && mx <= cx + CE.CARD_W && my >= cy && my <= cy + CE.CARD_H) {
          if (i === S.selectedCardIndex) {
            // Second click on same card = discard it
            V.playerDiscard(i);
          } else
            S.selectedCardIndex = i;
          return;
        }
      }
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver) return;
    if (S.phase === PHASE_PLAYER_DISCARD) {
      if ((e.key === 'k' || e.key === 'K') && S.selectedCardIndex >= 0) {
        const dwVal = V.calcDeadwood(S.playerHand);
        if (dwVal <= 10)
          V.playerKnock();
      }
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
