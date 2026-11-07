/* Quick & Fun: face-down draw piles with a card count label and the half-turn card flip,
   shared by War and Beggar Neighbor. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};
  const CE = SZ.CardEngine;

  const CANVAS_H = 600;

  function drawPileWithCount(ctx, x, y, count, label) {
    if (count > 0) {
      // draw stacked look (up to 3 offset cards)
      const layers = Math.min(count, 3);
      for (let i = 0; i < layers - 1; ++i)
        CE.drawCardBack(ctx, x + i * 2, y + i * 2);
      CE.drawCardBack(ctx, x + (layers - 1) * 2, y + (layers - 1) * 2);
    } else {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      CE.drawRoundedRect(ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      ctx.stroke();
      ctx.restore();
    }
    // card count
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label + ': ' + count, x + CE.CARD_W / 2, y < CANVAS_H / 2 ? y - 14 : y + CE.CARD_H + 18);
    ctx.restore();
  }

  /* scaleX runs 1 -> 0 for the back, 0 -> 1 for the face (card null draws the back) */
  function drawFlippingCard(ctx, x, y, scaleX, card) {
    ctx.save();
    ctx.translate(x + CE.CARD_W / 2, y);
    ctx.scale(scaleX || 0.01, 1);
    ctx.translate(-CE.CARD_W / 2, 0);
    if (card)
      CE.drawCardFace(ctx, 0, 0, card);
    else
      CE.drawCardBack(ctx, 0, 0);
    ctx.restore();
  }

  SZ.CardGames.shared.quickPiles = { drawPileWithCount, drawFlippingCard };

})();
