/* Skip-Bo: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['skipbo'];
  const S = V.S;
  const { CANVAS_H, CANVAS_W, SB_ENDTURN_BTN, SB_DISCARD_Y, SB_DISCARD_X, SB_HAND_Y, SB_HAND_X, SB_STOCK_Y, SB_STOCK_X, SB_BUILD_Y, SB_BUILD_X } = V;

  /* ══════════════════════════════════════════════════════════════════
     DRAWING HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function drawSkipBoCard(x, y, w, h, card) {
    const sb = card.type === 'skipbo';
    const v = +card.value;
    const color = sb ? '#f57c00' : v <= 4 ? '#1e63d6' : v <= 8 ? '#2e9b3a' : '#d32f2f';
    CE.drawColorCard(S._ctx, x, y, w, h, { color, label: sb ? 'SB' : String(card.value), corner: sb ? 'SB' : String(card.value), wild: sb }, card);
  }


  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawSkipBo() {
    S._ctx.fillStyle = S.skipBoPlayerTurn ? '#8f8' : '#f88';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.skipBoPlayerTurn ? 'Your Turn' : 'AI Playing...', CANVAS_W / 2, 22);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI (Stock: ' + S.skipBoStockPiles[1].length + ')', 200, 55);
    for (let i = 0; i < Math.min(S.aiHands[0].length, 5); ++i)
      CE.drawCardBack(S._ctx, 200 + i * 40, 68, CE.CARD_W * 0.7, CE.CARD_H * 0.7);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Build Piles', CANVAS_W / 2, SB_BUILD_Y - 10);
    for (let b = 0; b < 4; ++b) {
      const x = SB_BUILD_X + b * 80;
      if (S.skipBoBuildPiles[b].length > 0)
        drawSkipBoCard(x, SB_BUILD_Y, CE.CARD_W, CE.CARD_H, S.skipBoBuildPiles[b][S.skipBoBuildPiles[b].length - 1]);
      else {
        S._ctx.strokeStyle = '#555';
        S._ctx.lineWidth = 1;
        CE.drawRoundedRect(S._ctx, x, SB_BUILD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        S._ctx.stroke();
        S._ctx.fillStyle = '#555';
        S._ctx.font = '14px sans-serif';
        S._ctx.fillText('1', x + CE.CARD_W / 2, SB_BUILD_Y + CE.CARD_H / 2);
      }
    }
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Stock: ' + S.skipBoStockPiles[0].length, SB_STOCK_X, SB_STOCK_Y - 8);
    if (S.skipBoStockPiles[0].length > 0) {
      const topStock = S.skipBoStockPiles[0][S.skipBoStockPiles[0].length - 1];
      drawSkipBoCard(SB_STOCK_X, SB_STOCK_Y, CE.CARD_W, CE.CARD_H, topStock);
      if (S.skipBoSelectedSource === 'stock') {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 8;
        CE.drawRoundedRect(S._ctx, SB_STOCK_X - 2, SB_STOCK_Y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Your Hand', SB_HAND_X, SB_HAND_Y - 8);
    for (let i = 0; i < S.playerHand.length; ++i) {
      if (S.playerHand[i]._dealing) continue;
      const x = SB_HAND_X + i * 60;
      drawSkipBoCard(x, SB_HAND_Y, CE.CARD_W, CE.CARD_H, S.playerHand[i]);
      if (S._host && S._host.hintsEnabled && S.skipBoPlayerTurn && !S.roundOver && !S.gameOver && (V.canPlaySkipBo(S.playerHand[i], S.skipBoBuildPiles[0]) || V.canPlaySkipBo(S.playerHand[i], S.skipBoBuildPiles[1]) || V.canPlaySkipBo(S.playerHand[i], S.skipBoBuildPiles[2]) || V.canPlaySkipBo(S.playerHand[i], S.skipBoBuildPiles[3])))
        CE.drawHintGlow(S._ctx, x, SB_HAND_Y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      if (S.skipBoSelectedSource === 'hand' && S.skipBoSelectedCard === i) {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 8;
        CE.drawRoundedRect(S._ctx, x - 2, SB_HAND_Y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
    const handOrStockSelected = S.skipBoSelectedSource === 'hand' || S.skipBoSelectedSource === 'stock';
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Discard Piles', SB_DISCARD_X + 150, SB_DISCARD_Y - 8);
    for (let d = 0; d < 4; ++d) {
      const x = SB_DISCARD_X + d * 80;
      if (S.skipBoDiscardPiles[d].length > 0)
        drawSkipBoCard(x, SB_DISCARD_Y, CE.CARD_W, CE.CARD_H, S.skipBoDiscardPiles[d][S.skipBoDiscardPiles[d].length - 1]);
      else {
        S._ctx.strokeStyle = '#444';
        S._ctx.lineWidth = 1;
        CE.drawRoundedRect(S._ctx, x, SB_DISCARD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        S._ctx.stroke();
        S._ctx.fillStyle = '#444';
        S._ctx.font = '10px sans-serif';
        S._ctx.fillText('D' + (d + 1), x + CE.CARD_W / 2, SB_DISCARD_Y + CE.CARD_H / 2);
      }
      if (handOrStockSelected && S.skipBoPlayerTurn && !S.roundOver && !S.gameOver && S.skipBoSelectedSource !== 'discard') {
        S._ctx.save();
        S._ctx.strokeStyle = '#0f0';
        S._ctx.lineWidth = 2;
        S._ctx.shadowColor = '#0f0';
        S._ctx.shadowBlur = 6;
        CE.drawRoundedRect(S._ctx, x - 1, SB_DISCARD_Y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
    if (!S.roundOver && !S.gameOver && S.skipBoPlayerTurn && S.playerHand.length > 0)
      CE.drawButton(S._ctx, SB_ENDTURN_BTN.x, SB_ENDTURN_BTN.y, SB_ENDTURN_BTN.w, SB_ENDTURN_BTN.h, 'End Turn', { bg: '#825', border: '#c48', fontSize: 13 });
    if (!S.roundOver && !S.gameOver && S.skipBoPlayerTurn) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      if (S.skipBoSelectedSource)
        S._ctx.fillText('Click a build pile to play, or a discard pile / End Turn to end turn', CANVAS_W / 2, CANVAS_H - 12);
      else
        S._ctx.fillText('Select a card, then click a build pile or discard pile. End Turn discards for you.', CANVAS_W / 2, CANVAS_H - 12);
    }
  }

  Object.assign(V, { drawSkipBo });

})();
