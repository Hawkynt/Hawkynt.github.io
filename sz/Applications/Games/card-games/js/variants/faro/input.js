/* Faro: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.faro;
  const S = V.S;
  const { PHASE_BETTING, RANKS, CELL_W, CELL_H, CHIP_DENOMINATIONS, CHIP_BTN_Y, CHIP_BTN_W,
    CHIP_BTN_H, DEAL_BTN, CLEAR_BTN, HIGHCARD_BTN } = V;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    if (S.phase === PHASE_BETTING) {
      // Rank cell clicks
      for (let i = 0; i < RANKS.length; ++i) {
        const { x, y } = V.cellPos(i);
        if (CE.isInRect(mx, my, x, y, CELL_W, CELL_H)) {
          if (S.caseKeeper[RANKS[i]] > 0)
            V.placeBetOnRank(RANKS[i]);
          return;
        }
      }

      // High card bet
      if (CE.isInRect(mx, my, HIGHCARD_BTN.x, HIGHCARD_BTN.y, HIGHCARD_BTN.w, HIGHCARD_BTN.h)) {
        V.placeBetHighCard();
        return;
      }

      // Chip selector clicks
      for (let i = 0; i < CHIP_DENOMINATIONS.length; ++i) {
        const cx = V.chipBtnX(i);
        if (CE.isInRect(mx, my, cx, CHIP_BTN_Y, CHIP_BTN_W, CHIP_BTN_H)) {
          S.selectedChip = CHIP_DENOMINATIONS[i];
          return;
        }
      }

      // Deal button
      if (CE.isInRect(mx, my, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h)) {
        V.startDeal();
        return;
      }

      // Clear button
      if (V.totalBets() > 0 && CE.isInRect(mx, my, CLEAR_BTN.x, CLEAR_BTN.y, CLEAR_BTN.w, CLEAR_BTN.h)) {
        V.clearAllBets();
        return;
      }
    }
  }

  Object.assign(V, { handleClick });

})();
