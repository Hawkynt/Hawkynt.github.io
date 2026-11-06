/* Scopa: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardX = SZ.CardGames.shared.euroLayout.fanCardX;

  const V = SZ.CardGames.v.scopa;
  const S = V.S;
  const { CANVAS_W, PHASE_PLAY, PHASE_CAPTURE, PHASE_ROUND_OVER, PLAYER_HAND_Y, CONFIRM_BTN } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.playerHand;
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
      if (i === S.selectedHandIdx) cy -= 18;

      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function hitTestTableCard(mx, my) {
    // Test in reverse for overlapping cards
    for (let i = S.table.length - 1; i >= 0; --i) {
      const pos = V.tableCardPos(i);
      if (CE.isInRect(mx, my, pos.x, pos.y, CE.CARD_W, CE.CARD_H))
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

    // Player's turn: select hand card
    if (S.phase === PHASE_PLAY) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      S.selectedHandIdx = idx;
      S.selectedTableIdxs = [];

      const card = S.playerHand[idx];
      const combos = V.findCaptureCombinations(V.captureValue(card), S.table);

      if (combos.length === 0) {
        // No captures: place on table immediately
        V.playerPlayCard(idx, []);
        return;
      }

      // If exactly one combination, auto-select it
      if (combos.length === 1) {
        V.playerPlayCard(idx, combos[0]);
        return;
      }

      // Multiple combos: enter capture selection mode
      S.phase = PHASE_CAPTURE;
      return;
    }

    // Capture selection mode
    if (S.phase === PHASE_CAPTURE && S.selectedHandIdx >= 0) {
      // Click on a different hand card: switch selection
      const handIdx = hitTestPlayerCard(mx, my);
      if (handIdx >= 0 && handIdx !== S.selectedHandIdx) {
        S.selectedHandIdx = handIdx;
        S.selectedTableIdxs = [];

        const card = S.playerHand[handIdx];
        const combos = V.findCaptureCombinations(V.captureValue(card), S.table);
        if (combos.length === 0) {
          V.playerPlayCard(handIdx, []);
          return;
        }
        if (combos.length === 1) {
          V.playerPlayCard(handIdx, combos[0]);
          return;
        }
        return;
      }

      // Click confirm button
      const cardVal = V.captureValue(S.playerHand[S.selectedHandIdx]);
      const currentSum = V.selectedTableSum();
      if (currentSum === cardVal && S.selectedTableIdxs.length > 0) {
        if (CE.isInRect(mx, my, CONFIRM_BTN.x, CONFIRM_BTN.y, CONFIRM_BTN.w, CONFIRM_BTN.h)) {
          V.playerPlayCard(S.selectedHandIdx, S.selectedTableIdxs.slice());
          return;
        }
      }

      // Click "place on table" (only available when no captures possible -- shouldn't happen in capture mode, but handle edge case)
      const combos = V.findCaptureCombinations(cardVal, S.table);
      if (combos.length === 0) {
        const placeBtn = { x: CANVAS_W / 2 - 55, y: CONFIRM_BTN.y, w: 110, h: 28 };
        if (CE.isInRect(mx, my, placeBtn.x, placeBtn.y, placeBtn.w, placeBtn.h)) {
          V.playerPlayCard(S.selectedHandIdx, []);
          return;
        }
      }

      // Click table card: toggle selection
      const tableIdx = hitTestTableCard(mx, my);
      if (tableIdx >= 0) {
        const pos = S.selectedTableIdxs.indexOf(tableIdx);
        if (pos >= 0)
          S.selectedTableIdxs.splice(pos, 1);
        else {
          // Only add if it wouldn't exceed the target value
          const newSum = currentSum + V.captureValue(S.table[tableIdx]);
          if (newSum <= cardVal)
            S.selectedTableIdxs.push(tableIdx);
          else if (S._host)
            S._host.floatingText.add(mx, my - 20, 'Sum would exceed ' + cardVal + '!', { color: '#f88', size: 12 });
        }

        // Auto-confirm if sum matches exactly
        const updatedSum = V.selectedTableSum();
        if (updatedSum === cardVal && S.selectedTableIdxs.length > 0) {
          // Verify this is a valid combination
          V.playerPlayCard(S.selectedHandIdx, S.selectedTableIdxs.slice());
        }
        return;
      }

      // Click elsewhere: cancel selection
      S.selectedHandIdx = -1;
      S.selectedTableIdxs = [];
      S.phase = PHASE_PLAY;
      return;
    }
  }

  function handlePointerMove(mx, my) {
    if (S.phase === PHASE_PLAY) {
      S.hoverHandIdx = hitTestPlayerCard(mx, my);
      S.hoverTableIdx = -1;
    } else if (S.phase === PHASE_CAPTURE) {
      S.hoverHandIdx = hitTestPlayerCard(mx, my);
      S.hoverTableIdx = hitTestTableCard(mx, my);
    } else {
      S.hoverHandIdx = -1;
      S.hoverTableIdx = -1;
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver) return;
    // Escape cancels selection
    if (e.key === 'Escape' && S.phase === PHASE_CAPTURE) {
      S.selectedHandIdx = -1;
      S.selectedTableIdxs = [];
      S.phase = PHASE_PLAY;
    }
  }

  V.handleClick = handleClick;
  V.handlePointerMove = handlePointerMove;
  V.handleKey = handleKey;

})();
