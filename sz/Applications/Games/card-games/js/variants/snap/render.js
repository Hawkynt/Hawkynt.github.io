/* Snap: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.snap;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, FLIP_INTERVAL, SNAP_WINDOW_DURATION, SNAP_RESULT_DURATION, SNAP_BTN } = V;

  function drawSnap() {
    /* ── Title ── */
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('SNAP!', CANVAS_W / 2, 22);

    /* ── AI deck (top) ── */
    const aiDeckX = CANVAS_W / 2 - CE.CARD_W / 2;
    const aiDeckY = 40;
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('AI (' + S.aiDeck.length + ' cards)', CANVAS_W / 2, aiDeckY - 6);
    if (S.aiDeck.length > 0) {
      if (S.aiDeck.length > 2)
        CE.drawCardBack(S._ctx, aiDeckX + 3, aiDeckY + 3);
      if (S.aiDeck.length > 1)
        CE.drawCardBack(S._ctx, aiDeckX + 1.5, aiDeckY + 1.5);
      CE.drawCardBack(S._ctx, aiDeckX, aiDeckY);
    } else {
      S._ctx.strokeStyle = '#555';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, aiDeckX, aiDeckY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.fillStyle = '#555';
      S._ctx.font = '12px sans-serif';
      S._ctx.fillText('Empty', aiDeckX + CE.CARD_W / 2, aiDeckY + CE.CARD_H / 2);
    }

    /* ── Central pile (middle) ── */
    const pileX = CANVAS_W / 2 - CE.CARD_W / 2;
    const pileY = CANVAS_H / 2 - CE.CARD_H / 2 - 10;

    S._ctx.fillStyle = '#999';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Pile (' + S.centralPile.length + ')', CANVAS_W / 2, pileY - 8);

    if (S.centralPile.length === 0) {
      S._ctx.strokeStyle = '#555';
      S._ctx.lineWidth = 1;
      S._ctx.setLineDash([4, 4]);
      CE.drawRoundedRect(S._ctx, pileX, pileY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.setLineDash([]);
    } else {
      if (S.centralPile.length >= 2) {
        const secondCard = S.centralPile[S.centralPile.length - 2];
        CE.drawCardFace(S._ctx, pileX - 18, pileY + 4, secondCard);
      }
      const topCard = S.centralPile[S.centralPile.length - 1];
      if (topCard._dealing)
        ;
      else
        CE.drawCardFace(S._ctx, pileX + 8, pileY - 4, topCard);

      /* ── Match highlight ── */
      if (V.hasSnapMatch() && !S.isPaused) {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 12;
        CE.drawRoundedRect(S._ctx, pileX - 22, pileY - 8, CE.CARD_W + 34, CE.CARD_H + 16, CE.CARD_RADIUS + 2);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }

    /* ── Player deck (bottom) ── */
    const playerDeckX = CANVAS_W / 2 - CE.CARD_W / 2;
    const playerDeckY = CANVAS_H - CE.CARD_H - 50;
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('You (' + S.playerDeck.length + ' cards)', CANVAS_W / 2, playerDeckY + CE.CARD_H + 18);
    if (S.playerDeck.length > 0) {
      if (S.playerDeck.length > 2)
        CE.drawCardBack(S._ctx, playerDeckX + 3, playerDeckY + 3);
      if (S.playerDeck.length > 1)
        CE.drawCardBack(S._ctx, playerDeckX + 1.5, playerDeckY + 1.5);
      CE.drawCardBack(S._ctx, playerDeckX, playerDeckY);
    } else {
      S._ctx.strokeStyle = '#555';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, playerDeckX, playerDeckY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.fillStyle = '#555';
      S._ctx.font = '12px sans-serif';
      S._ctx.fillText('Empty', playerDeckX + CE.CARD_W / 2, playerDeckY + CE.CARD_H / 2);
    }

    /* ── Whose turn indicator ── */
    if (!S.roundOver && !S.gameOver && !S.snapWindowOpen && !S.isPaused) {
      const turnLabel = S.isPlayerTurn ? 'Your card next...' : 'AI flipping...';
      S._ctx.fillStyle = S.isPlayerTurn ? '#8f8' : '#f88';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(turnLabel, CANVAS_W / 2, CANVAS_H / 2 + CE.CARD_H / 2 + 24);

      /* ── Flip timer bar ── */
      const barW = 120;
      const barH = 4;
      const barX = CANVAS_W / 2 - barW / 2;
      const barY = CANVAS_H / 2 + CE.CARD_H / 2 + 30;
      const progress = Math.min(S.flipTimer / FLIP_INTERVAL, 1);
      S._ctx.fillStyle = '#333';
      S._ctx.fillRect(barX, barY, barW, barH);
      S._ctx.fillStyle = '#6a6';
      S._ctx.fillRect(barX, barY, barW * progress, barH);
    }

    /* ── SNAP button (pulsing) ── */
    if (S.snapWindowOpen && V.hasSnapMatch() && !S.isPaused) {
      const pulse = 1 + 0.08 * Math.sin(S.snapPulsePhase * 8);
      const bw = SNAP_BTN.w * pulse;
      const bh = SNAP_BTN.h * pulse;
      const bx = SNAP_BTN.x + (SNAP_BTN.w - bw) / 2;
      const by = SNAP_BTN.y + (SNAP_BTN.h - bh) / 2;

      S._ctx.save();
      S._ctx.shadowColor = '#f00';
      S._ctx.shadowBlur = 16 + 8 * Math.sin(S.snapPulsePhase * 8);
      CE.drawButton(S._ctx, bx, by, bw, bh, 'SNAP! (Space)', {
        bg: '#c00',
        border: '#f44',
        textColor: '#fff',
        fontSize: 18
      });
      S._ctx.restore();

      /* ── Snap window timer bar ── */
      const remaining = 1 - S.snapWindowTimer / SNAP_WINDOW_DURATION;
      const twBarW = 140;
      const twBarH = 6;
      const twBarX = CANVAS_W / 2 - twBarW / 2;
      const twBarY = SNAP_BTN.y + SNAP_BTN.h + 10;
      S._ctx.fillStyle = '#333';
      S._ctx.fillRect(twBarX, twBarY, twBarW, twBarH);
      S._ctx.fillStyle = remaining > 0.3 ? '#f44' : '#f00';
      S._ctx.fillRect(twBarX, twBarY, twBarW * Math.max(remaining, 0), twBarH);
    }

    /* ── Last snap result ── */
    if (S.lastSnapResultTimer < SNAP_RESULT_DURATION && S.lastSnapResult) {
      const alpha = 1 - S.lastSnapResultTimer / SNAP_RESULT_DURATION;
      S._ctx.save();
      S._ctx.globalAlpha = alpha;
      const isGood = S.lastSnapResult === 'SNAP!';
      S._ctx.fillStyle = isGood ? '#4f4' : '#f44';
      S._ctx.font = 'bold 22px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.lastSnapResult, CANVAS_W / 2, CANVAS_H / 2 + CE.CARD_H / 2 + 56);
      S._ctx.restore();
    }

    /* ── Reaction time display ── */
    if (S.showReactionTime && S.reactionDisplayTimer < 2.0) {
      const alpha = S.reactionDisplayTimer < 1.5 ? 1 : 1 - (S.reactionDisplayTimer - 1.5) / 0.5;
      S._ctx.save();
      S._ctx.globalAlpha = Math.max(alpha, 0);
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Reaction: ' + (S.lastReactionTime * 1000).toFixed(0) + 'ms', CANVAS_W / 2, CANVAS_H / 2 + CE.CARD_H / 2 + 76);
      S._ctx.restore();
    }

    /* ── Score display ── */
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Cards: ' + S.playerDeck.length, 20, 28);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('AI: ' + S.aiDeck.length, CANVAS_W - 20, 28);

    /* ── Card count bar ── */
    const barTotalW = 200;
    const barTotalH = 8;
    const barTotalX = CANVAS_W / 2 - barTotalW / 2;
    const barTotalY = CANVAS_H - 14;
    const totalCards = S.playerDeck.length + S.aiDeck.length + S.centralPile.length;
    const playerRatio = totalCards > 0 ? S.playerDeck.length / totalCards : 0.5;
    S._ctx.fillStyle = '#333';
    S._ctx.fillRect(barTotalX, barTotalY, barTotalW, barTotalH);
    S._ctx.fillStyle = '#4a4';
    S._ctx.fillRect(barTotalX, barTotalY, barTotalW * playerRatio, barTotalH);
    S._ctx.fillStyle = '#a44';
    const aiRatio = totalCards > 0 ? S.aiDeck.length / totalCards : 0.5;
    S._ctx.fillRect(barTotalX + barTotalW * (1 - aiRatio), barTotalY, barTotalW * aiRatio, barTotalH);

    /* ── Instructions ── */
    if (!S.roundOver && !S.gameOver) {
      S._ctx.fillStyle = '#777';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Cards flip automatically. Press SPACE or click SNAP! when ranks match.', CANVAS_W / 2, CANVAS_H - 26);
    }

    /* ── Game over message ── */
    if (S.roundOver || S.gameOver) {
      S._ctx.save();
      S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
      S._ctx.fillRect(0, CANVAS_H / 2 - 40, CANVAS_W, 80);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 24px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 8);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 20);
      S._ctx.restore();
    }
  }

  Object.assign(V, { drawSnap });

})();
