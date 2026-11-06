/* ONO 99: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['ono99'];
  const S = V.S;
  const { CANVAS_H, CANVAS_W, playerPos, NUM_PLAYERS } = V;

  function drawOno99Card(x, y, w, h, card) {
    const label = card.value === 'Hold' ? 'H' : card.value === 'Reverse' ? '\u21C4' : card.value === 'Double Play' ? '\u00D72' : card.value === 'Minus 10' ? '-10' : card.value;
    CE.drawColorCard(S._ctx, x, y, w, h, { color: card.color || '#2a6', label }, card);
  }


  function drawGame() {
    // Running total
    const tc = S.runningTotal < 50 ? '#4f4' : S.runningTotal < 70 ? '#ff0' : S.runningTotal < 85 ? '#fa0' : '#f44';
    S._ctx.fillStyle = tc;
    S._ctx.font = 'bold 52px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(String(S.runningTotal), CANVAS_W / 2, CANVAS_H / 2 - 10);
    S._ctx.font = '13px sans-serif';
    S._ctx.fillStyle = '#aaa';
    S._ctx.fillText('Total (bust at 99)', CANVAS_W / 2, CANVAS_H / 2 + 28);

    // Discard
    if (S.discardPile.length > 0)
      drawOno99Card(CANVAS_W / 2 + 90, CANVAS_H / 2 - CE.CARD_H / 2, CE.CARD_W, CE.CARD_H, S.discardPile[S.discardPile.length - 1]);
    // Draw pile
    if (S.deck.length > 0)
      CE.drawCardBack(S._ctx, CANVAS_W / 2 - 90 - CE.CARD_W, CANVAS_H / 2 - CE.CARD_H / 2, CE.CARD_W, CE.CARD_H);

    // Player hand
    for (let i = 0; i < S.hands[0].length; ++i) {
      if (S.hands[0][i]._dealing) continue;
      drawOno99Card(250 + i * 70, 460, CE.CARD_W, CE.CARD_H, S.hands[0][i]);
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && !S.eliminated[0] && !S.roundOver && !S.gameOver && V.canPlay(S.hands[0][i]))
        CE.drawHintGlow(S._ctx, 250 + i * 70, 460, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }

    // AI hands + labels
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pp = playerPos[p];
      S._ctx.fillStyle = S.eliminated[p] ? '#666' : S.currentPlayer === p ? '#ff0' : '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(pp.label + ' (' + S.hands[p].length + ')', pp.x, pp.y - 10);
      if (S.eliminated[p]) {
        S._ctx.fillStyle = '#f44';
        S._ctx.font = 'bold 22px sans-serif';
        S._ctx.fillText('X', pp.x, pp.y + 25);
      } else
        for (let i = 0; i < Math.min(S.hands[p].length, 4); ++i)
          CE.drawCardBack(S._ctx, pp.x - 25 + i * 14, pp.y + 4, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }

    // Status
    if (S.eliminated[0]) {
      S._ctx.fillStyle = '#f44';
      S._ctx.font = 'bold 18px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('ELIMINATED', CANVAS_W / 2, 435);
    } else if (!S.roundOver && !S.gameOver && S.currentPlayer === 0) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 12);
    }

    // Direction arrow
    S._ctx.fillStyle = '#888';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.direction === 1 ? '\u21BB CW' : '\u21BA CCW', CANVAS_W / 2, CANVAS_H / 2 + 50);
  }

  Object.assign(V, { drawGame });

})();
