;(function() {
  'use strict';

  /* TriPeaks: drawing of the peaks, stock, waste, highlights and particles. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.tripeaks;
  const S = V.S;
  const {
    CE, CANVAS_W, CANVAS_H, isAdjacentRank, ROW3_Y, isExposed, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y
  } = V;

  /* ================================================================
   *  DRAWING HELPERS
   * ================================================================ */

  function drawCardHighlight(x, y) {
    S._ctx.save();
    S._ctx.strokeStyle = '#ff0';
    S._ctx.lineWidth = 3;
    S._ctx.shadowColor = '#ff0';
    S._ctx.shadowBlur = 8;
    CE.drawRoundedRect(S._ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
    S._ctx.stroke();
    S._ctx.restore();
  }

  function drawParticles() {
    for (const p of S.particles) {
      S._ctx.save();
      S._ctx.globalAlpha = Math.max(0, p.alpha);
      S._ctx.fillStyle = p.color;
      S._ctx.shadowColor = p.color;
      S._ctx.shadowBlur = 6;
      S._ctx.beginPath();
      S._ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      S._ctx.fill();
      S._ctx.restore();
    }
  }

  /* ================================================================
   *  DRAWING - MAIN
   * ================================================================ */

  function drawGame() {
    // Green felt background
    S._ctx.fillStyle = '#1a7a2e';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    S._ctx.fillStyle = '#126622';
    S._ctx.fillRect(0, 0, CANVAS_W, 2);
    S._ctx.fillRect(0, 0, 2, CANVAS_H);

    // Draw peak cards (back-to-front: row 0 first, then row 1, etc.)
    const wasteTop = S.waste.length > 0 ? S.waste[S.waste.length - 1] : null;

    for (let row = 0; row <= 3; ++row) {
      for (let i = 0; i < S.peaks.length; ++i) {
        const slot = S.peaks[i];
        if (slot.row !== row || slot.removed)
          continue;

        if (slot.faceUp) {
          CE.drawCardFace(S._ctx, slot.x, slot.y, slot.card);
          // Highlight playable cards
          if (wasteTop && isExposed(i) && isAdjacentRank(slot.card.rank, wasteTop.rank)) {
            drawCardHighlight(slot.x, slot.y);
            if (S._host && S._host.hintsEnabled && !S.roundOver)
              CE.drawHintGlow(S._ctx, slot.x, slot.y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
          }
        } else
          CE.drawCardBack(S._ctx, slot.x, slot.y);
      }
    }

    // Draw stock pile
    if (S.stock.length > 0) {
      // Draw stacked backs to show depth
      const depth = Math.min(S.stock.length, 4);
      for (let i = 0; i < depth; ++i)
        CE.drawCardBack(S._ctx, STOCK_X - i * 2, STOCK_Y - i * 2);

      // Show remaining count
      S._ctx.fillStyle = '#fff';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(S.stock.length + ' left', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 4);
    } else {
      // Empty stock
      S._ctx.save();
      S._ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.restore();

      S._ctx.fillStyle = 'rgba(255,255,255,0.3)';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('Empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }

    // Draw waste pile
    if (S.waste.length > 0) {
      const top = S.waste[S.waste.length - 1];
      CE.drawCardFace(S._ctx, WASTE_X, WASTE_Y, top);
    } else {
      S._ctx.save();
      S._ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, WASTE_X, WASTE_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.restore();
    }

    // Draw particles
    drawParticles();

    // Draw streak counter
    if (S.streak > 1) {
      S._ctx.save();
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 28px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.shadowColor = '#ff0';
      S._ctx.shadowBlur = 12;
      S._ctx.fillText('STREAK x' + S.streak, CANVAS_W / 2, ROW3_Y + CE.CARD_H + 50);
      S._ctx.restore();
    }

    // Draw score
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Score: ' + S.score, CANVAS_W - 30, 15);

    // Draw remaining peak cards count
    const remaining = S.peaks.filter(p => !p.removed).length;
    S._ctx.fillStyle = 'rgba(255,255,255,0.7)';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Cards in peaks: ' + remaining, CANVAS_W - 30, 40);

    // Draw result message
    if (S.resultMsg) {
      S._ctx.save();
      S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
      S._ctx.fillRect(0, CANVAS_H / 2 - 50, CANVAS_W, 100);

      S._ctx.fillStyle = S.peaksCleared ? '#4f4' : '#fa0';
      S._ctx.font = 'bold 24px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 15);

      S._ctx.fillStyle = '#fff';
      S._ctx.font = '16px sans-serif';
      S._ctx.fillText('Click to start a new round', CANVAS_W / 2, CANVAS_H / 2 + 20);
      S._ctx.restore();
    }

    // Draw undo hint
    if (!S.roundOver && S.undoHistory.length > 0) {
      S._ctx.fillStyle = 'rgba(255,255,255,0.4)';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText('Ctrl+Z to undo', 10, CANVAS_H - 8);
    }

    // New game hint
    S._ctx.fillStyle = 'rgba(255,255,255,0.4)';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('F2 - New Game', CANVAS_W - 10, CANVAS_H - 8);
  }

  Object.assign(V, { drawGame });

})();
