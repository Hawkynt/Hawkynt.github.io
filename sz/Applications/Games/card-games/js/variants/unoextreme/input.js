/* Uno Extreme: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoextreme'];
  const S = V.S;
  const { CANVAS_W, colorChoiceRects, targetChoiceRects } = V;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function handleClick(mx, my) {
    if (S.waitingForTargetChoice) {
      for (const r of targetChoiceRects)
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.waitingForTargetChoice = false;
          V.extremeHit(r.target);
          V.checkWin(S.pendingWildPlayer);
          S.pendingWildPlayer = -1;
          return;
        }
      return;
    }
    if (S.waitingForColorChoice) {
      for (const r of colorChoiceRects)
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.waitingForColorChoice = false;
          V.finishWildPlay(S.pendingWildCard, S.pendingWildPlayer, r.color);
          S.pendingWildCard = null;
          S.pendingWildPlayer = -1;
          return;
        }
      return;
    }
    if (S.roundOver || S.gameOver) {
      if (PL.settlePending(S)) return;
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }
    if (S.currentPlayer !== 0) return;

    // Launcher click
    const lx = CANVAS_W / 2 + CE.CARD_W + 20;
    if (CE.isInRect(mx, my, lx, 255, 70, 50)) {
      V.launcherDraw(0);
      S.currentPlayer = V.nextSeat(S.currentPlayer);
      return;
    }

    // Card click
    for (let i = S.hands[0].length - 1; i >= 0; --i) {
      const cx = 80 + i * 55;
      if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
        if (!V.playCard(0, i))
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
        return;
      }
    }
  }

  Object.assign(V, { handleClick });

})();
