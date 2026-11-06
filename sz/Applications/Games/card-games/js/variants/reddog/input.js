/* Red Dog: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const CHIP = SZ.CardGames.shared.casinoChips;
  const V = SZ.CardGames.v.reddog;
  const S = V.S;
  const { CANVAS_W, PHASE_BET, PHASE_SHOW_POSTS, CHIP_BTN_Y, DEAL_BTN, RAISE_BTN, CALL_BTN } = V;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    if (S.phase === PHASE_BET) {
      // Chip selector clicks
      const chip = CHIP.chipAt(mx, my, CHIP_BTN_Y);
      if (chip !== null) {
        S.selectedChip = chip;
        V.adjustBet(0); // clamp if needed
        return;
      }

      // +/- buttons
      const minusBtnX = CANVAS_W / 2 - 120;
      const plusBtnX = CANVAS_W / 2 + 70;
      if (CE.isInRect(mx, my, minusBtnX, 310, 50, 30)) {
        V.adjustBet(-S.selectedChip);
        return;
      }
      if (CE.isInRect(mx, my, plusBtnX, 310, 50, 30)) {
        V.adjustBet(S.selectedChip);
        return;
      }

      // Deal button
      if (CE.isInRect(mx, my, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h)) {
        V.startDeal();
        return;
      }

      // Clear button
      if (S.betAmount > 0) {
        const clearX = DEAL_BTN.x + DEAL_BTN.w + 15;
        if (CE.isInRect(mx, my, clearX, DEAL_BTN.y, 70, DEAL_BTN.h)) {
          V.clearBet();
          S.betAmount = 10; // reset to minimum
          return;
        }
      }
      return;
    }

    if (S.phase === PHASE_SHOW_POSTS) {
      const isPair = V.rankIndex(S.postCards[0]) === V.rankIndex(S.postCards[1]);
      const isConsecutive = !isPair && S.spread === 0;

      if (isPair) {
        // Draw button
        if (CE.isInRect(mx, my, CANVAS_W / 2 - 55, 460, 110, 36)) {
          V.playerCall();
          return;
        }
      } else if (isConsecutive) {
        // Continue button
        if (CE.isInRect(mx, my, CANVAS_W / 2 - 55, 460, 110, 36)) {
          V.playerCall();
          return;
        }
      } else {
        // Raise button
        if (CE.isInRect(mx, my, RAISE_BTN.x, RAISE_BTN.y, RAISE_BTN.w, RAISE_BTN.h)) {
          V.playerRaise();
          return;
        }
        // Call button
        if (CE.isInRect(mx, my, CALL_BTN.x, CALL_BTN.y, CALL_BTN.w, CALL_BTN.h)) {
          V.playerCall();
          return;
        }
      }
    }
  }

  Object.assign(V, { handleClick });

})();
