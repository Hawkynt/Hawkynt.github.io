/* Baccarat: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const CHIP = SZ.CardGames.shared.casinoChips;
  const V = SZ.CardGames.v.baccarat;
  const S = V.S;
  const { CANVAS_W, PHASE_BETTING, BET_PLAYER, BET_BANKER, BET_TIE, HAND_Y, PLAYER_HAND_X,
    BANKER_HAND_X, CARD_GAP, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H, BET_ZONE_GAP, CHIP_BTN_Y, DEAL_BTN } = V;

  function betZoneX(index) {
    const totalW = 3 * BET_ZONE_W + 2 * BET_ZONE_GAP;
    return (CANVAS_W - totalW) / 2 + index * (BET_ZONE_W + BET_ZONE_GAP);
  }

  function drawBaccarat() {
    // Title
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Baccarat', CANVAS_W / 2, 35);

    // Shoe count & chips (top right)
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Chips: ' + S.score, CANVAS_W - 40, 60);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Shoe: ' + S.shoe.length, CANVAS_W - 40, 78);

    // Hand labels
    S._ctx.fillStyle = '#cdf';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Player', PLAYER_HAND_X + CE.CARD_W + CARD_GAP / 2, HAND_Y - 20);
    S._ctx.fillText('Banker', BANKER_HAND_X + CE.CARD_W + CARD_GAP / 2, HAND_Y - 20);

    // Player hand
    if (S.playerHand.length > 0) {
      for (let i = 0; i < S.playerHand.length; ++i) {
        if (S.playerHand[i]._dealing) continue;
        CE.drawCardFace(S._ctx, PLAYER_HAND_X + i * (CE.CARD_W + CARD_GAP), HAND_Y, S.playerHand[i]);
      }
      const pTotal = V.handTotal(S.playerHand);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 18px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('' + pTotal, PLAYER_HAND_X + CE.CARD_W + CARD_GAP / 2, HAND_Y + CE.CARD_H + 24);
    } else {
      CE.drawEmptySlot(S._ctx, PLAYER_HAND_X, HAND_Y);
      CE.drawEmptySlot(S._ctx, PLAYER_HAND_X + CE.CARD_W + CARD_GAP, HAND_Y);
    }

    // Banker hand
    if (S.bankerHand.length > 0) {
      for (let i = 0; i < S.bankerHand.length; ++i) {
        if (S.bankerHand[i]._dealing) continue;
        CE.drawCardFace(S._ctx, BANKER_HAND_X + i * (CE.CARD_W + CARD_GAP), HAND_Y, S.bankerHand[i]);
      }
      const bTotal = V.handTotal(S.bankerHand);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 18px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('' + bTotal, BANKER_HAND_X + CE.CARD_W + CARD_GAP / 2, HAND_Y + CE.CARD_H + 24);
    } else {
      CE.drawEmptySlot(S._ctx, BANKER_HAND_X, HAND_Y);
      CE.drawEmptySlot(S._ctx, BANKER_HAND_X + CE.CARD_W + CARD_GAP, HAND_Y);
    }

    // Result text
    if (S.resultMsg) {
      S._ctx.fillStyle = '#ff8';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, HAND_Y + CE.CARD_H + 55);
    }

    // Betting area
    drawBettingArea();
  }

  function drawBettingArea() {
    const zones = [
      { target: BET_PLAYER, label: 'Player\n1 : 1', idx: 0 },
      { target: BET_TIE,    label: 'Tie\n8 : 1',    idx: 1 },
      { target: BET_BANKER, label: 'Banker\n1:1 -5%', idx: 2 }
    ];

    for (const z of zones) {
      const zx = betZoneX(z.idx);
      const selected = S.betTarget === z.target && S.betAmount > 0;
      const bg = selected ? 'rgba(255,200,0,0.25)' : 'rgba(255,255,255,0.08)';
      const border = selected ? '#fa0' : 'rgba(255,255,255,0.3)';

      CE.drawRoundedRect(S._ctx, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H, 8);
      S._ctx.fillStyle = bg;
      S._ctx.fill();
      S._ctx.strokeStyle = border;
      S._ctx.lineWidth = selected ? 2.5 : 1.5;
      S._ctx.stroke();

      const lines = z.label.split('\n');
      S._ctx.fillStyle = selected ? '#fc0' : '#ccc';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(lines[0], zx + BET_ZONE_W / 2, BET_ZONE_Y + 22);
      S._ctx.font = '11px sans-serif';
      S._ctx.fillStyle = selected ? '#da0' : '#999';
      S._ctx.fillText(lines[1], zx + BET_ZONE_W / 2, BET_ZONE_Y + 40);

      if (selected) {
        S._ctx.fillStyle = '#fc0';
        S._ctx.font = 'bold 12px sans-serif';
        S._ctx.fillText('$' + S.betAmount, zx + BET_ZONE_W / 2, BET_ZONE_Y + 55);
      }
    }

    // Chip selector buttons
    if (S.phase === PHASE_BETTING) {
      CHIP.drawChipButtons(S._ctx, CHIP_BTN_Y, S.selectedChip);

      // Deal button
      const canDeal = S.betTarget && S.betAmount > 0;
      CE.drawButton(
        S._ctx, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h,
        'Deal (D)',
        { bg: canDeal ? '#2a5a2a' : '#333', border: canDeal ? '#6c6' : '#555', fontSize: 14 }
      );

      // Clear button
      if (S.betAmount > 0) {
        const clearX = DEAL_BTN.x + DEAL_BTN.w + 15;
        CE.drawButton(S._ctx, clearX, DEAL_BTN.y, 70, DEAL_BTN.h, 'Clear', { bg: '#5a2a2a', border: '#c66', fontSize: 12 });
      }
    }

    // Instructions during betting
    if (S.phase === PHASE_BETTING && !S.betTarget) {
      S._ctx.fillStyle = '#888';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click a bet zone, then Deal', CANVAS_W / 2, BET_ZONE_Y - 12);
    }
  }

  Object.assign(V, { betZoneX, drawBaccarat });

})();
