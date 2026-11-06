/* Three Card Poker: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const CHIP = SZ.CardGames.shared.casinoChips;
  const V = SZ.CardGames.v.threecard;
  const S = V.S;
  const { PHASE_BETTING, PHASE_DECISION, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H, CHIP_BTN_Y, DEAL_BTN,
    PLAY_BTN, FOLD_BTN } = V;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    if (S.phase === PHASE_BETTING) {
      /* ── Bet zone clicks ── */
      const targets = ['ante', 'pairplus'];
      for (let i = 0; i < 2; ++i) {
        const zx = V.betZoneX(i);
        if (CE.isInRect(mx, my, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H)) {
          V.placeBet(targets[i]);
          return;
        }
      }

      /* ── Chip selector clicks ── */
      const chip = CHIP.chipAt(mx, my, CHIP_BTN_Y);
      if (chip !== null) {
        S.selectedChip = chip;
        return;
      }

      /* ── Deal button ── */
      if (CE.isInRect(mx, my, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h)) {
        V.startDeal();
        return;
      }

      /* ── Clear button ── */
      if (S.anteBet > 0 || S.pairPlusBet > 0) {
        const clearX = DEAL_BTN.x + DEAL_BTN.w + 15;
        if (CE.isInRect(mx, my, clearX, DEAL_BTN.y, 70, DEAL_BTN.h)) {
          V.clearBets();
          return;
        }
      }
      return;
    }

    if (S.phase === PHASE_DECISION) {
      if (CE.isInRect(mx, my, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h)) {
        V.doPlay();
        return;
      }
      if (CE.isInRect(mx, my, FOLD_BTN.x, FOLD_BTN.y, FOLD_BTN.w, FOLD_BTN.h)) {
        V.doFold();
        return;
      }
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver) return;
    const k = e.key.toLowerCase();

    if (S.phase === PHASE_BETTING) {
      if (k === 'd') V.startDeal();
      else if (k === '1') S.selectedChip = 10;
      else if (k === '2') S.selectedChip = 25;
      else if (k === '3') S.selectedChip = 50;
      else if (k === '4') S.selectedChip = 100;
      else if (k === 'a') V.placeBet('ante');
      else if (k === 's') V.placeBet('pairplus');
      else if (k === 'c') V.clearBets();
      return;
    }

    if (S.phase === PHASE_DECISION) {
      if (k === 'p') V.doPlay();
      else if (k === 'f') V.doFold();
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
