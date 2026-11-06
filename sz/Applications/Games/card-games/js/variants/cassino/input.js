/* Cassino: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardX = SZ.CardGames.shared.euroLayout.fanCardX;

  const V = SZ.CardGames.v.cassino;
  const S = V.S;
  const { PHASE_PLAY, PHASE_SELECT_TABLE, PHASE_ROUND_OVER, PLAYER_HAND_Y, CAPTURE_BTN, BUILD_BTN,
    TRAIL_BTN } = V;

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

      // If only one combination and no possible builds, auto-capture
      if (combos.length === 1 && V.findPossibleBuilds(card, S.playerHand).length === 0) {
        V.playerPlayCapture(idx, combos[0]);
        return;
      }

      // Enter table selection mode
      S.phase = PHASE_SELECT_TABLE;
      return;
    }

    // Table selection mode
    if (S.phase === PHASE_SELECT_TABLE && S.selectedHandIdx >= 0) {
      // Click on a different hand card: switch selection
      const handIdx = hitTestPlayerCard(mx, my);
      if (handIdx >= 0 && handIdx !== S.selectedHandIdx) {
        S.selectedHandIdx = handIdx;
        S.selectedTableIdxs = [];

        const card = S.playerHand[handIdx];
        const combos = V.findCaptureCombinations(V.captureValue(card), S.table);
        if (combos.length === 1 && V.findPossibleBuilds(card, S.playerHand).length === 0) {
          V.playerPlayCapture(handIdx, combos[0]);
          return;
        }
        return;
      }

      // Click Capture button
      if (V.canPlayerCapture() && CE.isInRect(mx, my, CAPTURE_BTN.x, CAPTURE_BTN.y, CAPTURE_BTN.w, CAPTURE_BTN.h)) {
        V.playerPlayCapture(S.selectedHandIdx, S.selectedTableIdxs.slice());
        return;
      }

      // Click Build button
      if (V.canPlayerBuild() && CE.isInRect(mx, my, BUILD_BTN.x, BUILD_BTN.y, BUILD_BTN.w, BUILD_BTN.h)) {
        const bv = V.buildValueForSelection();
        V.playerPlayBuild(S.selectedHandIdx, S.selectedTableIdxs.slice(), bv);
        return;
      }

      // Click Trail button
      if (V.canPlayerTrail() && CE.isInRect(mx, my, TRAIL_BTN.x, TRAIL_BTN.y, TRAIL_BTN.w, TRAIL_BTN.h)) {
        V.playerPlayTrail(S.selectedHandIdx);
        return;
      }

      // Click table card: toggle selection
      const tableIdx = hitTestTableCard(mx, my);
      if (tableIdx >= 0) {
        const pos = S.selectedTableIdxs.indexOf(tableIdx);
        if (pos >= 0)
          S.selectedTableIdxs.splice(pos, 1);
        else
          S.selectedTableIdxs.push(tableIdx);
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
    } else if (S.phase === PHASE_SELECT_TABLE) {
      S.hoverHandIdx = hitTestPlayerCard(mx, my);
      S.hoverTableIdx = hitTestTableCard(mx, my);
    } else {
      S.hoverHandIdx = -1;
      S.hoverTableIdx = -1;
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver) return;
    if (e.key === 'Escape' && S.phase === PHASE_SELECT_TABLE) {
      S.selectedHandIdx = -1;
      S.selectedTableIdxs = [];
      S.phase = PHASE_PLAY;
    }
  }

  V.handleClick = handleClick;
  V.handlePointerMove = handlePointerMove;
  V.handleKey = handleKey;

})();
