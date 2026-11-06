/* Baccarat: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const CHIP = SZ.CardGames.shared.casinoChips;
  const V = SZ.CardGames.v.baccarat;
  const S = V.S;
  const { PHASE_BETTING, BET_PLAYER, BET_BANKER, BET_TIE, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H,
    CHIP_BTN_Y, DEAL_BTN } = V;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    if (S.phase === PHASE_BETTING) {
      // Bet zone clicks
      const targets = [BET_PLAYER, BET_TIE, BET_BANKER];
      for (let i = 0; i < 3; ++i) {
        const zx = V.betZoneX(i);
        if (CE.isInRect(mx, my, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H)) {
          V.placeBet(targets[i]);
          return;
        }
      }

      // Chip selector clicks
      const chip = CHIP.chipAt(mx, my, CHIP_BTN_Y);
      if (chip !== null) {
        S.selectedChip = chip;
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
          return;
        }
      }
    }
  }

  Object.assign(V, { handleClick });

})();
