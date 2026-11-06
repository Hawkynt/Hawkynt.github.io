/* Beggar Neighbor: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const PILES = SZ.CardGames.shared.quickPiles;
  const V = SZ.CardGames.v.beggar;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, AI_PILE_X, AI_PILE_Y, PLAYER_PILE_X, PLAYER_PILE_Y, CENTER_X,
    CENTER_Y, NEXT_BTN, AUTO_BTN, PHASE_IDLE, PHASE_PLAY, FLIP_DURATION } = V;

  function drawCenterPile() {
    if (S.centerPile.length === 0) {
      S._ctx.save();
      S._ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, CENTER_X, CENTER_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.restore();
      return;
    }

    // Show up to 3 stacked cards + the top face-up card
    const topIdx = S.centerPile.length - 1;
    const stackStart = Math.max(0, topIdx - 2);

    for (let i = stackStart; i < topIdx; ++i) {
      const off = (i - stackStart) * 2;
      CE.drawCardBack(S._ctx, CENTER_X + off, CENTER_Y + off);
    }

    const topCard = S.centerPile[topIdx];
    const off = Math.min(topIdx - stackStart, 2) * 2;
    if (topCard.faceUp)
      CE.drawCardFace(S._ctx, CENTER_X + off, CENTER_Y + off, topCard);
    else
      CE.drawCardBack(S._ctx, CENTER_X + off, CENTER_Y + off);

    // Pile count
    S._ctx.save();
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Pile: ' + S.centerPile.length, CENTER_X + CE.CARD_W / 2, CENTER_Y - 14);
    S._ctx.restore();
  }

  function drawBeggar() {
    // Title
    S._ctx.save();
    S._ctx.fillStyle = '#ddd';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('BEGGAR MY NEIGHBOR', CANVAS_W / 2, 8);
    S._ctx.restore();

    // AI pile (top)
    PILES.drawPileWithCount(S._ctx, AI_PILE_X, AI_PILE_Y, S.aiPile.length, 'AI');

    // Player pile (bottom)
    PILES.drawPileWithCount(S._ctx, PLAYER_PILE_X, PLAYER_PILE_Y, S.playerPile.length, 'You');

    // Center pile
    if (S.phase === PHASE_PLAY) {
      // Draw all but the top card normally, then animate the top card
      if (S.centerPile.length > 1) {
        const saved = S.centerPile[S.centerPile.length - 1];
        S.centerPile.length -= 1;
        drawCenterPile();
        S.centerPile.push(saved);
      }
      const progress = Math.min(S.flipAnimProgress / FLIP_DURATION, 1);
      if (progress < 0.5) {
        const scaleX = 1 - progress * 2;
        PILES.drawFlippingCard(S._ctx, CENTER_X, CENTER_Y, scaleX, null);
      } else {
        const scaleX = (progress - 0.5) * 2;
        PILES.drawFlippingCard(S._ctx, CENTER_X, CENTER_Y, scaleX, S.currentCard);
      }
    } else {
      drawCenterPile();
    }

    // Turn indicator
    if (!S.gameOver && S.phase === PHASE_IDLE) {
      const turnLabel = S.isPlayerTurn ? "Your turn" : "AI's turn";
      const arrowY = S.isPlayerTurn ? PLAYER_PILE_Y - 30 : AI_PILE_Y + CE.CARD_H + 30;
      S._ctx.save();
      S._ctx.fillStyle = S.isPlayerTurn ? '#8f8' : '#f88';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(turnLabel, CANVAS_W / 2, arrowY);
      S._ctx.restore();
    }

    // Payment counter
    if (S.penaltyRemaining > 0 && !S.gameOver) {
      const paid = S.penaltyTotal - S.penaltyRemaining;
      const payLabel = 'Payment: ' + paid + ' of ' + S.penaltyTotal + ' (' + S.penaltyRemaining + ' remaining)';
      S._ctx.save();
      S._ctx.fillStyle = '#ffa';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(payLabel, CANVAS_W / 2, CENTER_Y + CE.CARD_H + 8);
      S._ctx.restore();
    }

    // Result text
    if (S.resultText) {
      S._ctx.save();
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 20px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      const textY = S.gameOver ? CANVAS_H / 2 : CENTER_Y + CE.CARD_H + 30;
      S._ctx.fillText(S.resultText, CANVAS_W / 2, textY);
      S._ctx.restore();
    }

    // Buttons (Next / Auto) when idle
    if (S.phase === PHASE_IDLE && !S.roundOver && !S.gameOver) {
      CE.drawButton(S._ctx, NEXT_BTN.x, NEXT_BTN.y, NEXT_BTN.w, NEXT_BTN.h, 'Next (N)', { bg: '#2a5a2a', border: '#6c6' });
      const autoBg = S.autoPlay ? '#5a2a2a' : '#2a2a5a';
      const autoBorder = S.autoPlay ? '#f66' : '#66f';
      const autoLabel = S.autoPlay ? 'Stop (A)' : 'Auto (A)';
      CE.drawButton(S._ctx, AUTO_BTN.x, AUTO_BTN.y, AUTO_BTN.w, AUTO_BTN.h, autoLabel, { bg: autoBg, border: autoBorder });

      if (!S.autoPlay) {
        S._ctx.save();
        S._ctx.fillStyle = '#aaa';
        S._ctx.font = '12px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.fillText('Press N or click Next to play a card', CANVAS_W / 2, NEXT_BTN.y + NEXT_BTN.h + 14);
        S._ctx.restore();
      }
    }

    // Game over prompt
    if (S.gameOver) {
      S._ctx.save();
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 28);
      S._ctx.restore();
    }
  }

  Object.assign(V, { drawBeggar });

})();
