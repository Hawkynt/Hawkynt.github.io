/* Bezique: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardY = SZ.CardGames.shared.euroLayout.duelPlayerCardY;

  const V = SZ.CardGames.v.bezique;
  const S = V.S;
  const { CANVAS_W, PHASE_PLAY, PHASE_MELD_SELECT, PHASE_ROUND_OVER } = V;

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

  /* ================================================================
     MELD SELECT HIT TESTING
     ================================================================ */

  function hitTestMeldOption(mx, my) {
    if (S.phase !== PHASE_MELD_SELECT) return -1;
    const px = CANVAS_W / 2 - 200;
    const py = 160;
    const pw = 400;
    const lineH = 32;

    for (let i = 0; i < S.pendingMeldOptions.length; ++i) {
      const bx = px + 20;
      const by = py + 44 + i * lineH;
      const bw = pw - 40;
      const bh = 26;
      if (CE.isInRect(mx, my, bx, by, bw, bh))
        return i;
    }

    // Skip button
    const skipY = py + 44 + S.pendingMeldOptions.length * lineH;
    const skipW = 100;
    const skipX = CANVAS_W / 2 - skipW / 2;
    if (CE.isInRect(mx, my, skipX, skipY, skipW, 26))
      return S.pendingMeldOptions.length; // skip sentinel

    return -1;
  }

  function handleClick(mx, my) {
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.gameOver) {
        S.playerTotalScore = 0;
        S.aiTotalScore = 0;
        S.score = 0;
        S.gameOver = false;
        if (S._host) S._host.onScoreChanged(S.score);
      }
      S.roundOver = false;
      V.dealRound();
      return;
    }

    // Meld selection
    if (S.phase === PHASE_MELD_SELECT) {
      const idx = hitTestMeldOption(mx, my);
      if (idx < 0) return;

      if (idx < S.pendingMeldOptions.length) {
        // Declare the chosen meld
        V.declareMeld(0, S.pendingMeldOptions[idx]);
        // After declaring, check for more melds
        const remaining = V.getAvailableMelds(0);
        if (remaining.length > 0) {
          S.pendingMeldOptions = remaining;
          return;
        }
      }

      // Done with melds -- proceed to next trick
      S.pendingMeldOptions = [];
      S.currentTurn = 0; // trick winner (player) leads
      S.trickLeader = 0;
      S.trickWinner = -1;
      S.phase = PHASE_PLAY;
      S.aiTurnTimer = 0;
      return;
    }

    if (S.phase !== PHASE_PLAY || S.currentTurn !== 0) return;
    if (S.roundOver || S.gameOver) return;

    const idx = hitTestPlayerCard(mx, my);
    if (idx < 0) return;

    // Validate in phase 2
    if (V.isPhase2() && S.trickCards.length > 0) {
      if (!V.isValidPlayPhase2(idx, S.playerHand)) {
        if (S._host)
          S._host.floatingText.add(mx, my - 20, 'Must follow suit and win if possible!', { color: '#f88', size: 14 });
        return;
      }
    }

    V.playCard(0, idx);
  }

  function handlePointerMove(mx, my) {
    S.hoverCardIdx = -1;
    S.hoverMeldBtn = -1;

    if (S.phase === PHASE_PLAY && S.currentTurn === 0)
      S.hoverCardIdx = hitTestPlayerCard(mx, my);

    if (S.phase === PHASE_MELD_SELECT)
      S.hoverMeldBtn = hitTestMeldOption(mx, my);
  }

  V.handleClick = handleClick;
  V.handlePointerMove = handlePointerMove;

})();
