/* Sixty-Six - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.sixtysix;
  const S = V.S;
  const { PHASE_PLAY, PHASE_ROUND_OVER, CLOSE_BTN, MARRIAGE_BTN } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const total = S.playerHand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      const cy = V.playerCardY();
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.matchOver) {
        S.playerGamePoints = 0;
        S.aiGamePoints = 0;
        S.matchOver = false;
      }
      S.roundOver = false;
      S.gameOver = false;
      V.dealRound();
      return;
    }

    if (S.phase !== PHASE_PLAY || S.currentTurn !== 0) return;
    if (S.roundOver || S.gameOver) return;

    /* Close button */
    if (!S.stockClosed && S.stock.length > 0) {
      if (CE.isInRect(mx, my, CLOSE_BTN.x, CLOSE_BTN.y, CLOSE_BTN.w, CLOSE_BTN.h)) {
        V.closeStock(0);
        return;
      }
    }

    /* Marriage button */
    if (S.marriagePending && S.trickCards.length === 0) {
      if (CE.isInRect(mx, my, MARRIAGE_BTN.x, MARRIAGE_BTN.y, MARRIAGE_BTN.w, MARRIAGE_BTN.h)) {
        V.declareMarriage(0, S.marriageSuit);
        S.marriagePending = false;
        /* After declaring, check if player has other marriages */
        const remaining = V.findMarriages(S.playerHand);
        if (remaining.length > 0) {
          S.marriagePending = true;
          S.marriageSuit = remaining.includes(S.trumpSuit) ? S.trumpSuit : remaining[0];
        }
        return;
      }
    }

    /* Card play */
    const idx = hitTestPlayerCard(mx, my);
    if (idx < 0) return;

    /* Validate legal move in strict play */
    if (V.isStrictPlay() && S.trickCards.length > 0) {
      const legal = V.getLegalCards(S.playerHand, S.trickCards[0]);
      if (!legal.includes(idx)) return;
    }

    S.marriagePending = false;
    V.playCard(0, idx);
  }

  function handlePointerMove(mx, my) {
    if (S.phase === PHASE_PLAY && S.currentTurn === 0)
      S.hoverCardIdx = hitTestPlayerCard(mx, my);
    else
      S.hoverCardIdx = -1;
  }

  Object.assign(V, {
    handleClick, handlePointerMove
  });

})();
