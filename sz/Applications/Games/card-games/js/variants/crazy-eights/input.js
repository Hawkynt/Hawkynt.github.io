/* Crazy Eights: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['crazy-eights'];
  const S = V.S;
  const { CANVAS_W, PASS_BTN, MAX_DRAWS, DRAW_BTN, SUIT_NAMES, SUIT_SYMBOLS, suitChoiceRects } = V;

  function handleClick(mx, my) {
    // Suit choice overlay
    if (S.waitingForSuitChoice) {
      for (const r of suitChoiceRects) {
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.waitingForSuitChoice = false;
          S.currentSuit = r.suit;
          if (S._host) {
            const sym = SUIT_SYMBOLS[r.suit] || '';
            S._host.floatingText.add(CANVAS_W / 2, 200, 'Suit: ' + SUIT_NAMES[r.suit] + ' ' + sym,
              { color: '#ff0', size: 16 });
          }
          V.finishTurn(S.pendingSuitPlayer === 0, S.pendingSuitPlayer === 0 ? S.playerHand : S.aiHand);
          S.pendingSuitPlayer = -1;
          return;
        }
      }
      return;
    }

    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    if (!S.playerTurn) return;

    const topCard = S.discardPile.length > 0 ? S.discardPile[S.discardPile.length - 1] : null;

    // Draw button
    const canDrawMore = S.drawCount < MAX_DRAWS && (S.stock.length > 0 || S.discardPile.length > 1);
    if (canDrawMore && CE.isInRect(mx, my, DRAW_BTN.x, DRAW_BTN.y, DRAW_BTN.w, DRAW_BTN.h)) {
      V.playerDraw();
      return;
    }

    // Pass button
    if ((S.drawCount >= MAX_DRAWS || (!canDrawMore && !V.hasPlayableCard(S.playerHand, topCard, S.currentSuit))) &&
        CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 420, 'Pass!', { color: '#fa0', size: 16 });
      S.drawCount = 0;
      S.playerTurn = false;
      S.aiTurnTimer = 0;
      return;
    }

    // Stock pile click (same as draw)
    const stockX = CANVAS_W / 2 - CE.CARD_W - 30;
    const stockY = 245;
    if (canDrawMore && CE.isInRect(mx, my, stockX, stockY, CE.CARD_W, CE.CARD_H)) {
      V.playerDraw();
      return;
    }

    // Player card click
    for (let i = S.playerHand.length - 1; i >= 0; --i) {
      const cx = V.getPlayerCardX(i);
      if (mx >= cx && mx <= cx + CE.CARD_W && my >= 460 && my <= 460 + CE.CARD_H) {
        if (topCard && V.canPlay(S.playerHand[i], topCard, S.currentSuit))
          V.playCard(S.playerHand, i, true);
        else if (S._host)
          S._host.floatingText.add(mx, my - 20, 'Can\'t play!', { color: '#f88', size: 14 });
        return;
      }
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver || S.waitingForSuitChoice) return;
    if (!S.playerTurn) return;
    if (e.key === 'd' || e.key === 'D') {
      const canDrawMore = S.drawCount < MAX_DRAWS && (S.stock.length > 0 || S.discardPile.length > 1);
      if (canDrawMore)
        V.playerDraw();
    }
    // Number keys 1-9 to play cards
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9 && num <= S.playerHand.length) {
      const topCard = S.discardPile.length > 0 ? S.discardPile[S.discardPile.length - 1] : null;
      if (topCard && V.canPlay(S.playerHand[num - 1], topCard, S.currentSuit))
        V.playCard(S.playerHand, num - 1, true);
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
