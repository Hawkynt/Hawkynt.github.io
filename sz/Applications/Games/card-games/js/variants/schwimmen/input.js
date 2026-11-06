/* Schwimmen: pointer and keyboard input of the human player. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.schwimmen;
  const S = V.S;
  const { CANVAS_W, SWAP1_BTN, SWAP_ALL_BTN, KNOCK_BTN } = V;

  function handleClick(mx, my) {
    if (S.gameOver) {
      if (S._host) S._host.onRoundOver(true);
      return;
    }

    if (S.roundOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    // Only handle clicks on player's turn
    if (S.currentTurn !== 0 || S.eliminated[0]) return;

    // ── Button: Swap 1 ──
    if (CE.isInRect(mx, my, SWAP1_BTN.x, SWAP1_BTN.y, SWAP1_BTN.w, SWAP1_BTN.h)) {
      S.swapMode = S.swapMode === 'swap1' ? 'none' : 'swap1';
      S.selectedHandCard = -1;
      S.selectedPoolCard = -1;
      return;
    }

    // ── Button: Swap All ──
    if (CE.isInRect(mx, my, SWAP_ALL_BTN.x, SWAP_ALL_BTN.y, SWAP_ALL_BTN.w, SWAP_ALL_BTN.h)) {
      V.performSwapAll(0);
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Swapped all 3!', { color: '#8cf', size: 18 });
      V.advanceTurn();
      return;
    }

    // ── Button: Knock / Pass ──
    if (CE.isInRect(mx, my, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h)) {
      if (S.hasKnocked < 0) {
        S.hasKnocked = 0;
        S.knockFinalTurns = 0;
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Knock!', { color: '#fa0', size: 22 });
      }
      V.advanceTurn();
      return;
    }

    // ── Swap-1 card selection ──
    if (S.swapMode === 'swap1') {
      // Check player hand cards
      for (let i = S.hands[0].length - 1; i >= 0; --i) {
        const px = V.playerCardX(i);
        const py = V.playerCardY();
        if (CE.isInRect(mx, my, px, py, CE.CARD_W, CE.CARD_H)) {
          S.selectedHandCard = i;
          // If both selected, do the swap
          if (S.selectedPoolCard >= 0) {
            V.performSwap1(0, S.selectedHandCard, S.selectedPoolCard);
            if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Swapped!', { color: '#8cf', size: 18 });
            S.swapMode = 'none';
            V.advanceTurn();
          }
          return;
        }
      }

      // Check pool cards
      for (let i = S.pool.length - 1; i >= 0; --i) {
        const px = V.poolCardX(i);
        const py = V.poolCardY();
        if (CE.isInRect(mx, my, px, py, CE.CARD_W, CE.CARD_H)) {
          S.selectedPoolCard = i;
          // If both selected, do the swap
          if (S.selectedHandCard >= 0) {
            V.performSwap1(0, S.selectedHandCard, S.selectedPoolCard);
            if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Swapped!', { color: '#8cf', size: 18 });
            S.swapMode = 'none';
            V.advanceTurn();
          }
          return;
        }
      }
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver || S.currentTurn !== 0 || S.eliminated[0]) return;
    if (e.key === '1' || e.key === 's') {
      S.swapMode = S.swapMode === 'swap1' ? 'none' : 'swap1';
      S.selectedHandCard = -1;
      S.selectedPoolCard = -1;
    } else if (e.key === '3' || e.key === 'a') {
      V.performSwapAll(0);
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Swapped all 3!', { color: '#8cf', size: 18 });
      V.advanceTurn();
    } else if (e.key === 'k' || e.key === 'K') {
      if (S.hasKnocked < 0) {
        S.hasKnocked = 0;
        S.knockFinalTurns = 0;
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Knock!', { color: '#fa0', size: 22 });
      }
      V.advanceTurn();
    }
  }

  V.handleClick = handleClick;
  V.handleKey = handleKey;

})();
