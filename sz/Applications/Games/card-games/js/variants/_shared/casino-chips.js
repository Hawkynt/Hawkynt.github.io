/* Casino tables: the chip denominations and the centred row of chip selector buttons
   (layout, drawing and hit test), shared by Baccarat, Red Dog and Three Card Poker. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CHIPS = [10, 25, 50, 100];
  const CHIP_COLORS = { 10: '#2266cc', 25: '#22aa44', 50: '#cc4422', 100: '#222222' };
  const CHIP_BTN_W = 50;
  const CHIP_BTN_H = 34;
  const CHIP_BTN_GAP = 12;

  function chipBtnX(index) {
    const totalW = CHIPS.length * CHIP_BTN_W + (CHIPS.length - 1) * CHIP_BTN_GAP;
    return (CANVAS_W - totalW) / 2 + index * (CHIP_BTN_W + CHIP_BTN_GAP);
  }

  /* the row of chip buttons at height y, the selected chip framed */
  function drawChipButtons(ctx, y, selectedChip) {
    for (let i = 0; i < CHIPS.length; ++i) {
      const cx = chipBtnX(i);
      const isSelected = selectedChip === CHIPS[i];
      const bg = CHIP_COLORS[CHIPS[i]];
      const border = isSelected ? '#fc0' : '#888';
      CE.drawButton(ctx, cx, y, CHIP_BTN_W, CHIP_BTN_H, '$' + CHIPS[i], { bg, border, fontSize: 12 });
      if (isSelected) {
        ctx.strokeStyle = '#fc0';
        ctx.lineWidth = 2;
        CE.drawRoundedRect(ctx, cx - 2, y - 2, CHIP_BTN_W + 4, CHIP_BTN_H + 4, 8);
        ctx.stroke();
      }
    }
  }

  /* the chip value under (mx, my) in the row at height y, or null */
  function chipAt(mx, my, y) {
    for (let i = 0; i < CHIPS.length; ++i) {
      const cx = chipBtnX(i);
      if (CE.isInRect(mx, my, cx, y, CHIP_BTN_W, CHIP_BTN_H))
        return CHIPS[i];
    }
    return null;
  }

  SZ.CardGames.shared.casinoChips = { CHIPS, CHIP_COLORS, chipBtnX, drawChipButtons, chipAt };

})();
