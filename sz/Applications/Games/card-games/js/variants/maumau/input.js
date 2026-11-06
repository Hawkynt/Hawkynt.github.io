/* Mau-Mau: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['maumau'];
  const S = V.S;
  const { STOCK_Y, STOCK_X, HAND_Y, HAND_SPACING, HAND_X_START, SUIT_NAMES, CANVAS_W, suitChoiceRects } = V;

  function handleClick(mx, my) {
    // Suit choice overlay
    if (S.waitingForSuitChoice) {
      for (const r of suitChoiceRects) {
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.waitingForSuitChoice = false;
          S.chosenSuit = r.suit;
          S.pendingJackPlayer = -1;
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 220, 'Wish: ' + SUIT_NAMES[S.chosenSuit], { color: '#8af', size: 16 });
          // Check if player won with that Jack
          if (S.hands[0].length === 0) {
            V.finishRound(0);
            return;
          }
          V.advanceTurn();
          return;
        }
      }
      return;
    }

    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    if (S.currentPlayer !== 0) return;

    // Player card click
    for (let i = S.hands[0].length - 1; i >= 0; --i) {
      const cx = HAND_X_START + i * HAND_SPACING;
      if (CE.isInRect(mx, my, cx, HAND_Y, CE.CARD_W, CE.CARD_H)) {
        if (!V.playCard(0, i))
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
        return;
      }
    }

    // Stock click (draw)
    if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
      if (S.drawObligation > 0 && V.hasPlayableCard(S.hands[0])) {
        // Player has a 7, should play it instead (but allow drawing anyway)
      }
      V.playerDrawCards();
      return;
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver || S.waitingForSuitChoice) return;
    if (S.currentPlayer !== 0) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9) {
      const idx = num - 1;
      if (idx < S.hands[0].length)
        V.playCard(0, idx);
    }
    if (e.key === 'd' || e.key === 'D') {
      // Draw shortcut
      if (S.stock.length > 0 || S.discardPile.length > 1)
        V.playerDrawCards();
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
