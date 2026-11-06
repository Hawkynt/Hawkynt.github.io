/* Dos: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['dos'];
  const S = V.S;
  const { colorMap, CANVAS_W, CANVAS_H, NUM_PLAYERS } = V;

  function drawDosCard(x, y, w, h, card, highlight) {
    CE.drawColorCard(S._ctx, x, y, w, h, { color: card.type === 'wild' ? 'wild' : (colorMap[card.color] ? card.color : '#555'), label: card.type === 'wild' ? '#' : String(card.value), wild: card.type === 'wild', corner: card.type === 'wild' ? 'W2' : String(card.value), highlight }, card);
  }


  function drawGame() {
    // Two center piles
    for (let p = 0; p < 2; ++p) {
      const px = CANVAS_W / 2 - 80 + p * 100;
      const py = 230;
      if (S.centerPiles[p])
        drawDosCard(px, py, CE.CARD_W, CE.CARD_H, S.centerPiles[p], false);
      else
        CE.drawEmptySlot(S._ctx, px, py, CE.CARD_W, CE.CARD_H);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Pile ' + (p + 1), px + CE.CARD_W / 2, py - 8);
    }

    // Draw pile
    CE.drawCardBack(S._ctx, CANVAS_W / 2 - CE.CARD_W - 120, 240, CE.CARD_W, CE.CARD_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('' + S.deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 120, 350);

    // Player hand
    for (let i = 0; i < S.hands[0].length; ++i) {
      if (S.hands[0][i]._dealing) continue;
      const x = 100 + i * 55;
      const sel = S.selectedCards.indexOf(i) >= 0;
      drawDosCard(x, sel ? 425 : 440, CE.CARD_W, CE.CARD_H, S.hands[0][i], sel);
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && !S.roundOver && !S.gameOver && (V.canMatchSingle(S.hands[0][i], S.centerPiles[0]) || V.canMatchSingle(S.hands[0][i], S.centerPiles[1])))
        CE.drawHintGlow(S._ctx, x, sel ? 425 : 440, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }

    // AI hands
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const y = 20 + (p - 1) * 100;
      S._ctx.textAlign = 'left';
      S._ctx.fillText('AI ' + p + ' (' + S.hands[p].length + ' cards)', 60, y + CE.CARD_H * 0.6 + 15);
      for (let i = 0; i < Math.min(S.hands[p].length, 7); ++i)
        CE.drawCardBack(S._ctx, 60 + i * 18, y, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Instructions
    if (!S.roundOver && !S.gameOver && S.currentPlayer === 0) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      if (S.selectedCards.length === 0)
        S._ctx.fillText('Click card(s) to select, then click a pile to play. Click deck to draw.', CANVAS_W / 2, CANVAS_H - 12);
      else
        S._ctx.fillText('Click a pile to play selected card(s), or click another card for double match.', CANVAS_W / 2, CANVAS_H - 12);
    }

    // Confirm/Cancel when cards selected
    if (S.selectedCards.length > 0 && S.currentPlayer === 0) {
      CE.drawButton(S._ctx, CANVAS_W - 180, 440, 70, 28, 'Clear', { bg: '#633', border: '#a66', fontSize: 11 });
    }
  }

  Object.assign(V, { drawGame });

})();
