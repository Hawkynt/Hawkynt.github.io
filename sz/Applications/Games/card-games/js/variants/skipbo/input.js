/* Skip-Bo: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['skipbo'];
  const S = V.S;
  const { SB_STOCK_Y, SB_STOCK_X, SB_HAND_Y, SB_HAND_X, SB_DISCARD_Y, SB_DISCARD_X, SB_BUILD_Y, SB_BUILD_X, SB_ENDTURN_BTN } = V;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }
    if (!S.skipBoPlayerTurn) return;

    // End Turn button
    if (S.playerHand.length > 0 && CE.isInRect(mx, my, SB_ENDTURN_BTN.x, SB_ENDTURN_BTN.y, SB_ENDTURN_BTN.w, SB_ENDTURN_BTN.h)) {
      V.autoEndTurn();
      return;
    }

    if (!S.skipBoSelectedSource) {
      for (let i = S.playerHand.length - 1; i >= 0; --i) {
        const cx = SB_HAND_X + i * 60;
        if (CE.isInRect(mx, my, cx, SB_HAND_Y, CE.CARD_W, CE.CARD_H)) {
          S.skipBoSelectedCard = i;
          S.skipBoSelectedSource = 'hand';
          return;
        }
      }
      if (S.skipBoStockPiles[0].length > 0 &&
          CE.isInRect(mx, my, SB_STOCK_X, SB_STOCK_Y, CE.CARD_W, CE.CARD_H)) {
        S.skipBoSelectedCard = S.skipBoStockPiles[0].length - 1;
        S.skipBoSelectedSource = 'stock';
        return;
      }
      for (let d = 0; d < 4; ++d) {
        if (S.skipBoDiscardPiles[d].length > 0) {
          const dx = SB_DISCARD_X + d * 80;
          if (CE.isInRect(mx, my, dx, SB_DISCARD_Y, CE.CARD_W, CE.CARD_H)) {
            S.skipBoSelectedCard = d;
            S.skipBoSelectedSource = 'discard';
            return;
          }
        }
      }
      return;
    }

    let selectedCard = null;
    if (S.skipBoSelectedSource === 'hand' && S.skipBoSelectedCard < S.playerHand.length)
      selectedCard = S.playerHand[S.skipBoSelectedCard];
    else if (S.skipBoSelectedSource === 'stock' && S.skipBoStockPiles[0].length > 0)
      selectedCard = S.skipBoStockPiles[0][S.skipBoStockPiles[0].length - 1];
    else if (S.skipBoSelectedSource === 'discard' && S.skipBoDiscardPiles[S.skipBoSelectedCard].length > 0)
      selectedCard = S.skipBoDiscardPiles[S.skipBoSelectedCard][S.skipBoDiscardPiles[S.skipBoSelectedCard].length - 1];

    if (!selectedCard) {
      S.skipBoSelectedCard = -1;
      S.skipBoSelectedSource = null;
      return;
    }

    for (let b = 0; b < 4; ++b) {
      const bx = SB_BUILD_X + b * 80;
      if (CE.isInRect(mx, my, bx, SB_BUILD_Y, CE.CARD_W, CE.CARD_H)) {
        if (!V.skipBoPlayToBuild(selectedCard, S.skipBoSelectedSource, S.skipBoSelectedCard, b)) {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
        }
        return;
      }
    }

    if (S.skipBoSelectedSource !== 'discard') {
      for (let d = 0; d < 4; ++d) {
        const dx = SB_DISCARD_X + d * 80;
        if (CE.isInRect(mx, my, dx, SB_DISCARD_Y, CE.CARD_W, CE.CARD_H)) {
          V.skipBoDiscardTo(selectedCard, S.skipBoSelectedSource, S.skipBoSelectedCard, d);
          return;
        }
      }
    }

    if (S.skipBoSelectedSource === 'hand') {
      const cx = SB_HAND_X + S.skipBoSelectedCard * 60;
      if (CE.isInRect(mx, my, cx, SB_HAND_Y, CE.CARD_W, CE.CARD_H)) {
        S.skipBoSelectedCard = -1;
        S.skipBoSelectedSource = null;
        return;
      }
    }
    if (S.skipBoSelectedSource === 'stock' &&
        CE.isInRect(mx, my, SB_STOCK_X, SB_STOCK_Y, CE.CARD_W, CE.CARD_H)) {
      S.skipBoSelectedCard = -1;
      S.skipBoSelectedSource = null;
      return;
    }

    for (let i = S.playerHand.length - 1; i >= 0; --i) {
      const cx = SB_HAND_X + i * 60;
      if (CE.isInRect(mx, my, cx, SB_HAND_Y, CE.CARD_W, CE.CARD_H)) {
        S.skipBoSelectedCard = i;
        S.skipBoSelectedSource = 'hand';
        return;
      }
    }
    if (S.skipBoStockPiles[0].length > 0 &&
        CE.isInRect(mx, my, SB_STOCK_X, SB_STOCK_Y, CE.CARD_W, CE.CARD_H)) {
      S.skipBoSelectedCard = S.skipBoStockPiles[0].length - 1;
      S.skipBoSelectedSource = 'stock';
    }
  }

  Object.assign(V, { handleClick });

})();
