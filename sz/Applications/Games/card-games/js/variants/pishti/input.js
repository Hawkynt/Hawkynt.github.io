/* Pishti: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.pishti;
  const S = V.S;
  const { PHASE_PLAY, PHASE_ROUND_OVER, PLAYER_HAND_Y } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.playerHand;
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
      if (i === S.hoverHandIdx) cy -= 10;

      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    // Round over / game over
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.gameOver) {
        S.cumulativePlayer = 0;
        S.cumulativeAI = 0;
        S.roundNumber = 0;
        S.score = 0;
        S.gameOver = false;
        if (S._host) S._host.onScoreChanged(S.score);
      }
      S.roundOver = false;
      V.setupRound();
      return;
    }

    if (S.roundOver || S.gameOver) return;

    // Player's turn: select a card to play
    if (S.phase === PHASE_PLAY) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;
      V.playerPlayCard(idx);
    }
  }

  function handlePointerMove(mx, my) {
    if (S.phase === PHASE_PLAY)
      S.hoverHandIdx = hitTestPlayerCard(mx, my);
    else
      S.hoverHandIdx = -1;
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver) return;
    // Number keys 1-4 to play cards
    if (S.phase === PHASE_PLAY) {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= S.playerHand.length)
        V.playerPlayCard(num - 1);
    }
  }

  V.handleClick = handleClick;
  V.handlePointerMove = handlePointerMove;
  V.handleKey = handleKey;

})();
