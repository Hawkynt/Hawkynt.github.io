/* Speed: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.speed;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, CARD_W, CARD_H, CENTER_Y, CENTER_LEFT_X, CENTER_RIGHT_X,
    PLAYER_HAND_Y, AI_HAND_Y, PLAYER_DRAW_X, PLAYER_DRAW_Y, AI_DRAW_X, AI_DRAW_Y, RESERVE_LEFT_X,
    RESERVE_RIGHT_X, RESERVE_Y, FLIP_BTN } = V;

  function handCardX(index, handLen) {
    const totalW = handLen * CARD_W + (handLen - 1) * 10;
    const startX = CANVAS_W / 2 - totalW / 2;
    return startX + index * (CARD_W + 10);
  }

  function drawPileStack(x, y, count, label, labelBelow) {
    if (count > 0) {
      const layers = Math.min(count, 3);
      for (let i = 0; i < layers - 1; ++i)
        CE.drawCardBack(S._ctx, x + i * 2, y + i * 2);
      CE.drawCardBack(S._ctx, x + (layers - 1) * 2, y + (layers - 1) * 2);
    } else
      CE.drawEmptySlot(S._ctx, x, y);

    S._ctx.save();
    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    const labelY = labelBelow ? y + CARD_H + 14 : y - 8;
    S._ctx.fillText(label + ' (' + count + ')', x + CARD_W / 2, labelY);
    S._ctx.restore();
  }

  function drawCenterPile(x, y, pile, label) {
    if (pile.length > 0) {
      const top = pile[pile.length - 1];
      if (!top._dealing)
        CE.drawCardFace(S._ctx, x, y, top);
    } else
      CE.drawEmptySlot(S._ctx, x, y, label);
  }

  function drawSpeed() {
    /* ── Title ── */
    S._ctx.save();
    S._ctx.fillStyle = '#ddd';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('SPEED', CANVAS_W / 2, 8);
    S._ctx.restore();

    /* ── AI hand (face-down) ── */
    for (let i = 0; i < S.aiHand.length; ++i) {
      const x = handCardX(i, S.aiHand.length);
      CE.drawCardBack(S._ctx, x, AI_HAND_Y);
    }

    /* ── AI draw pile ── */
    drawPileStack(AI_DRAW_X, AI_DRAW_Y, S.aiDraw.length, 'AI Draw', false);

    /* ── AI reserve pile ── */
    drawPileStack(RESERVE_RIGHT_X, RESERVE_Y, S.aiReserve.length, 'Reserve', false);

    /* ── Center piles ── */
    drawCenterPile(CENTER_LEFT_X, CENTER_Y, S.centerPiles[0], 'L');
    drawCenterPile(CENTER_RIGHT_X, CENTER_Y, S.centerPiles[1], 'R');

    /* ── Center pile labels ── */
    S._ctx.save();
    S._ctx.fillStyle = '#888';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Left Pile', CENTER_LEFT_X + CARD_W / 2, CENTER_Y - 10);
    S._ctx.fillText('Right Pile', CENTER_RIGHT_X + CARD_W / 2, CENTER_Y - 10);
    S._ctx.restore();

    /* ── Player reserve pile ── */
    drawPileStack(RESERVE_LEFT_X, RESERVE_Y, S.playerReserve.length, 'Reserve', true);

    /* ── Flip button ── */
    if (S.showFlipButton && !S.roundOver && !S.gameOver) {
      CE.drawButton(S._ctx, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h, 'Flip (F)', {
        bg: '#8a4000', border: '#fa0', textColor: '#fff', fontSize: 14
      });
    }

    /* ── Player draw pile ── */
    drawPileStack(PLAYER_DRAW_X, PLAYER_DRAW_Y, S.playerDraw.length, 'Your Draw', true);

    /* ── Player hand (face-up) ── */
    for (let i = 0; i < S.playerHand.length; ++i) {
      const x = handCardX(i, S.playerHand.length);
      const y = S.selectedIndex === i ? PLAYER_HAND_Y - 12 : PLAYER_HAND_Y;
      CE.drawCardFace(S._ctx, x, y, S.playerHand[i]);

      // Selection highlight
      if (S.selectedIndex === i)
        CE.drawSelectionHighlight(S._ctx, x, y, CARD_H);

      // Hint glow
      if (S.selectedIndex < 0 && V.isHintable(S.playerHand[i]))
        CE.drawHintGlow(S._ctx, x, y, CARD_W, CARD_H, S._host ? S._host.hintTime : 0);
    }

    /* ── Highlight center piles when a card is selected ── */
    if (S.selectedIndex >= 0 && S.selectedIndex < S.playerHand.length) {
      const card = S.playerHand[S.selectedIndex];
      for (let p = 0; p < 2; ++p) {
        if (S.centerPiles[p].length === 0) continue;
        const top = S.centerPiles[p][S.centerPiles[p].length - 1];
        if (V.canPlayOn(card, top)) {
          const px = p === 0 ? CENTER_LEFT_X : CENTER_RIGHT_X;
          S._ctx.save();
          S._ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
          S._ctx.lineWidth = 3;
          S._ctx.shadowColor = '#0f0';
          S._ctx.shadowBlur = 8;
          CE.drawRoundedRect(S._ctx, px - 2, CENTER_Y - 2, CARD_W + 4, CARD_H + 4, CE.CARD_RADIUS + 1);
          S._ctx.stroke();
          S._ctx.restore();
        }
      }
    }

    /* ── Score / card counts ── */
    S._ctx.save();
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Score: ' + S.score, 16, CANVAS_H - 10);
    S._ctx.restore();

    S._ctx.save();
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Your cards: ' + (S.playerHand.length + S.playerDraw.length), CANVAS_W - 16, CANVAS_H - 22);
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('AI cards: ' + (S.aiHand.length + S.aiDraw.length), CANVAS_W - 16, CANVAS_H - 8);
    S._ctx.restore();

    /* ── Instructions ── */
    if (!S.roundOver && !S.gameOver && S.selectedIndex < 0 && !S.showFlipButton) {
      S._ctx.save();
      S._ctx.fillStyle = '#777';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click a card in your hand, then click a center pile (\u00b11 rank). Press 1-5 + L/R for keyboard play.', CANVAS_W / 2, CANVAS_H - 24);
      S._ctx.restore();
    }

    /* ── Game over overlay ── */
    if (S.roundOver || S.gameOver) {
      S._ctx.save();
      S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
      S._ctx.fillRect(0, CANVAS_H / 2 - 44, CANVAS_W, 88);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 24px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 10);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 18);
      S._ctx.restore();
    }
  }

  Object.assign(V, { handCardX, drawSpeed });

})();
