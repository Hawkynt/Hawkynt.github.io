/* 8-Color Duo: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['duo'];
  const S = V.S;
  const { CANVAS_W, colorChoiceRects } = V;

  function handleClick(mx, my) {
    if (S.waitingForColorChoice) {
      for (const r of colorChoiceRects) {
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.waitingForColorChoice = false;
          V.finishWildPlay(S.pendingWildCard, S.pendingWildPlayer, r.color);
          S.pendingWildCard = null;
          S.pendingWildPlayer = -1;
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

    for (let i = S.hands[0].length - 1; i >= 0; --i) {
      const cx = 80 + i * 55;
      if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
        if (!V.playCard(0, i))
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
        return;
      }
    }

    const dpx = CANVAS_W / 2 - CE.CARD_W - 30;
    const dpy = 240;
    if (CE.isInRect(mx, my, dpx, dpy, CE.CARD_W, CE.CARD_H)) {
      if (S.drawStack > 0) {
        V.applyDrawStack(0);
        V.advancePlayer();
      } else {
        V.refillDeck();
        if (S.deck.length > 0)
          S.hands[0].push(S.deck.pop());
        V.advancePlayer();
      }
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver || S.waitingForColorChoice) return;
    if (S.currentPlayer !== 0) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9) {
      const idx = num - 1;
      if (idx < S.hands[0].length)
        V.playCard(0, idx);
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
