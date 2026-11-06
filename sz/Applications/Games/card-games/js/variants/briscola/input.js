/* Briscola: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardY = SZ.CardGames.shared.euroLayout.duelPlayerCardY;

  const V = SZ.CardGames.v.briscola;
  const S = V.S;
  const { PHASE_PLAY, PHASE_ROUND_OVER } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const total = S.playerHand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      const cy = playerCardY();
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    if (S.phase === PHASE_ROUND_OVER) {
      S.roundOver = false;
      S.gameOver = false;
      V.dealRound();
      return;
    }

    if (S.phase !== PHASE_PLAY || S.currentTurn !== 0) return;
    if (S.roundOver || S.gameOver) return;

    const idx = hitTestPlayerCard(mx, my);
    if (idx < 0) return;

    V.playCard(0, idx);
  }

  function handlePointerMove(mx, my) {
    if (S.phase === PHASE_PLAY && S.currentTurn === 0)
      S.hoverCardIdx = hitTestPlayerCard(mx, my);
    else
      S.hoverCardIdx = -1;
  }

  V.handleClick = handleClick;
  V.handlePointerMove = handlePointerMove;

})();
