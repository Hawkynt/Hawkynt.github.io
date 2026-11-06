/* Cribbage: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.cribbage;
  const S = V.S;
  const { PEG_MAX, PHASE_DISCARD, PHASE_PEGGING, PHASE_SHOW, PHASE_CRIB_SHOW, PHASE_ROUND_OVER,
    HAND_Y, DISCARD_BTN, CONTINUE_BTN } = V;

  /* ================================================================
   *  CLICK HANDLING
   * ================================================================ */

  function handleGameClick(mx, my) {
    if (S.gameOver) {
      if (S.phase === PHASE_ROUND_OVER && CE.isInRect(mx, my, CONTINUE_BTN.x, 310, CONTINUE_BTN.w, CONTINUE_BTN.h)) {
        // New game
        S.playerScore = 0;
        S.aiScore = 0;
        S.playerPrevScore = 0;
        S.aiPrevScore = 0;
        S.score = 0;
        S.gameOver = false;
        S.dealerIsPlayer = false;
        if (S._host) S._host.onScoreChanged(S.score);
        V.dealRound();
      }
      return;
    }

    if (S.phase === PHASE_DISCARD) {
      // Check discard button
      if (S.selectedIndices.length === 2 && CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
        V.doPlayerDiscard();
        return;
      }
      // Check card selection
      const spacing = Math.min(75, (560 - 90) / Math.max(S.playerHand.length, 1));
      for (let i = S.playerHand.length - 1; i >= 0; --i) {
        const x = 90 + i * spacing;
        const sel = S.selectedIndices.includes(i);
        const y = sel ? HAND_Y - 15 : HAND_Y;
        if (CE.isInRect(mx, my, x, y, CE.CARD_W, CE.CARD_H)) {
          if (sel)
            S.selectedIndices = S.selectedIndices.filter(idx => idx !== i);
          else if (S.selectedIndices.length < 2)
            S.selectedIndices.push(i);
          return;
        }
      }
      return;
    }

    if (S.phase === PHASE_PEGGING && S.currentPegger === 0) {
      // Player can't play — auto-go
      if (S.playerPegHand.length > 0 && !V.canPlayPeg(S.playerPegHand)) {
        S.playerSaidGo = true;
        S.pegMsg = 'You say Go';
        if (S.aiPegHand.length > 0 && V.canPlayPeg(S.aiPegHand)) {
          S.currentPegger = 1;
          S.pendingAiAction = true;
          S.aiTimer = 0;
        } else {
          // Both stuck, last card
          V.addAiScore(0); // no points for "go" if nobody played
          if (S.pegCount < 31 && S.pegCards.length > 0) {
            // Last card point
            V.addPlayerScore(1);
            S.pegMsg += ' +1 last card';
          }
          V.resetPegRound();
          V.checkPeggingEnd();
        }
        return;
      }
      // Check card click
      const spacing = Math.min(75, (560 - 90) / Math.max(S.playerPegHand.length, 1));
      for (let i = S.playerPegHand.length - 1; i >= 0; --i) {
        const x = 90 + i * spacing;
        const playable = S.pegCount + V.cardValue(S.playerPegHand[i]) <= PEG_MAX;
        const y = HAND_Y;
        if (CE.isInRect(mx, my, x, y, CE.CARD_W, CE.CARD_H) && playable) {
          V.playPegCard(true, i);
          return;
        }
      }
      return;
    }

    if (S.phase === PHASE_SHOW || S.phase === PHASE_CRIB_SHOW) {
      if (CE.isInRect(mx, my, CONTINUE_BTN.x, CONTINUE_BTN.y, CONTINUE_BTN.w, CONTINUE_BTN.h)) {
        ++S.showPhaseIdx;
        if (S.showPhaseIdx < S.showBreakdown.length) {
          V.applyShowScore(S.showPhaseIdx);
          if (S.showPhaseIdx === S.showBreakdown.length - 1)
            S.phase = PHASE_CRIB_SHOW;
        } else
          V.finishRound();
      }
      return;
    }

    if (S.phase === PHASE_ROUND_OVER) {
      const btnY = S.gameOver ? 310 : 260;
      if (CE.isInRect(mx, my, CONTINUE_BTN.x, btnY, CONTINUE_BTN.w, CONTINUE_BTN.h)) {
        if (S.gameOver) {
          S.playerScore = 0;
          S.aiScore = 0;
          S.playerPrevScore = 0;
          S.aiPrevScore = 0;
          S.score = 0;
          S.gameOver = false;
          S.dealerIsPlayer = false;
          if (S._host) S._host.onScoreChanged(S.score);
        }
        V.dealRound();
      }
      return;
    }
  }

  function handlePointerMove(mx, my) {
    S.hoverCardIdx = -1;
    if (S.phase === PHASE_DISCARD) {
      const spacing = Math.min(75, (560 - 90) / Math.max(S.playerHand.length, 1));
      for (let i = S.playerHand.length - 1; i >= 0; --i) {
        const x = 90 + i * spacing;
        const sel = S.selectedIndices.includes(i);
        const y = sel ? HAND_Y - 15 : HAND_Y;
        if (CE.isInRect(mx, my, x, y, CE.CARD_W, CE.CARD_H)) {
          S.hoverCardIdx = i;
          break;
        }
      }
    } else if (S.phase === PHASE_PEGGING && S.currentPegger === 0) {
      const spacing = Math.min(75, (560 - 90) / Math.max(S.playerPegHand.length, 1));
      for (let i = S.playerPegHand.length - 1; i >= 0; --i) {
        const x = 90 + i * spacing;
        if (CE.isInRect(mx, my, x, HAND_Y, CE.CARD_W, CE.CARD_H)) {
          S.hoverCardIdx = i;
          break;
        }
      }
    }
  }

  function handleKey(e) {
    if (e.key === 'F2') {
      e.preventDefault();
      S.playerScore = 0;
      S.aiScore = 0;
      S.playerPrevScore = 0;
      S.aiPrevScore = 0;
      S.score = 0;
      S.gameOver = false;
      S.dealerIsPlayer = false;
      if (S._host) S._host.onScoreChanged(S.score);
      V.dealRound();
    }
    if (S.phase === PHASE_DISCARD && (e.key === 'Enter' || e.key === 'd' || e.key === 'D')) {
      if (S.selectedIndices.length === 2)
        V.doPlayerDiscard();
    }
  }

  V.handleGameClick = handleGameClick;
  V.handlePointerMove = handlePointerMove;
  V.handleKey = handleKey;

})();
