/* Uno All Wild: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unowild'];
  const S = V.S;
  const { CANVAS_W, DRAW_PILE_Y, DRAW_PILE_X, gapChoiceRects, targetChoiceRects } = V;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function handleClick(mx, my) {
    if (S.waitingForTargetChoice) {
      for (const r of targetChoiceRects) {
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.waitingForTargetChoice = false;
          if (S.targetAction === 'swap')
            V.executeSwap(S.targetSourcePlayer, r.target);
          else if (S.targetAction === 'targetdraw')
            V.executeTargetedDraw(r.target);
          S.targetAction = null;
          S.targetCard = null;
          if (!V.checkWin(S.targetSourcePlayer)) V.advancePlayer();
          S.targetSourcePlayer = -1;
          return;
        }
      }
      return;
    }

    if (S.waitingForGapChoice) {
      for (const r of gapChoiceRects) {
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.waitingForGapChoice = false;
          const from = S.gapSourcePlayer;
          S.gapSourcePlayer = -1;
          S.currentPlayer = from;
          for (let i = 0; i <= r.gapCount; ++i)
            S.currentPlayer = V.nextPlayer(S.currentPlayer);
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 200, 'Gap ' + r.gapCount + '!', { color: '#e3e', size: 16 });
          return;
        }
      }
      return;
    }

    if (S.roundOver || S.gameOver) {
      if (PL.settlePending(S)) return;
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    if (S.currentPlayer === 0) {
      const hand = S.hands[0];
      const total = hand.length;
      for (let i = total - 1; i >= 0; --i) {
        const cx = V.playerCardX(i, total);
        const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
        const hitW = rightEdge - cx;
        if (CE.isInRect(mx, my, cx, V.playerCardY(), hitW, CE.CARD_H)) {
          V.playCard(0, i);
          return;
        }
      }

      if (CE.isInRect(mx, my, DRAW_PILE_X, DRAW_PILE_Y, CE.CARD_W, CE.CARD_H)) {
        const drawn = V.drawFromDeck();
        if (drawn) {
          S.hands[0].push(drawn);
          if (S._host) S._host.floatingText.add(CANVAS_W / 2, 400, 'Drew a card', { color: '#aaa', size: 14 });
        }
        V.advancePlayer();
      }
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver || S.waitingForTargetChoice || S.waitingForGapChoice) return;
    if (S.currentPlayer !== 0) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9) {
      const idx = num - 1;
      if (idx < S.hands[0].length)
        V.playCard(0, idx);
    }
  }

  function handlePointerMove(mx, my) {
    if (S.currentPlayer !== 0 || S.waitingForTargetChoice || S.waitingForGapChoice) {
      S.hoverCardIdx = -1;
      return;
    }
    const hand = S.hands[0];
    const total = hand.length;
    S.hoverCardIdx = -1;
    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (CE.isInRect(mx, my, cx, V.playerCardY(), hitW, CE.CARD_H)) {
        S.hoverCardIdx = i;
        break;
      }
    }
  }

  Object.assign(V, { handleClick, handleKey, handlePointerMove });

})();
