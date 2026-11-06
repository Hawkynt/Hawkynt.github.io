;(function() {
  'use strict';

  /* Pyramid: drawing of the pyramid, stock, waste, selection and hint glows, buttons
     and the result overlay. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.pyramid;
  const S = V.S;
  const {
    CE, CARD_W, CARD_H, CANVAS_W, CANVAS_H, PYRAMID_ROWS, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y,
    NEW_DEAL_BTN, HINT_BTN, pyramidValue, pyramidCardPos, isExposed, isPyramidCleared,
    hasValidPair, wasteHasValidPair
  } = V;

  /* ================================================================
   *  DRAWING - Selection Highlight
   * ================================================================ */

  function drawSelectionGlow(cx, x, y) {
    cx.save();
    cx.strokeStyle = '#ffff00';
    cx.lineWidth = 3;
    cx.shadowColor = '#ffff00';
    cx.shadowBlur = 10;
    CE.drawRoundedRect(cx, x - 2, y - 2, CARD_W + 4, CARD_H + 4, CE.CARD_RADIUS + 2);
    cx.stroke();
    cx.restore();
  }

  function drawHintGlow(cx, x, y) {
    cx.save();
    cx.strokeStyle = '#00ff88';
    cx.lineWidth = 2;
    cx.shadowColor = '#00ff88';
    cx.shadowBlur = 8;
    CE.drawRoundedRect(cx, x - 2, y - 2, CARD_W + 4, CARD_H + 4, CE.CARD_RADIUS + 2);
    cx.stroke();
    cx.restore();
  }

  /* ================================================================
   *  DRAWING - Button
   * ================================================================ */

  function drawButton(cx, x, y, w, h, label, opts) {
    const bg = (opts && opts.bg) || '#1a3a1a';
    const border = (opts && opts.border) || '#4a4';
    const textColor = (opts && opts.textColor) || '#fff';
    const fontSize = (opts && opts.fontSize) || 14;
    cx.fillStyle = bg;
    cx.strokeStyle = border;
    cx.lineWidth = 2;
    CE.drawRoundedRect(cx, x, y, w, h, 6);
    cx.fill();
    cx.stroke();
    cx.fillStyle = textColor;
    cx.font = 'bold ' + fontSize + 'px sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(label, x + w / 2, y + h / 2);
  }

  /* ================================================================
   *  MAIN DRAW
   * ================================================================ */

  function drawScene(cx, W, H) {
    // Draw pyramid
    for (let row = 0; row < PYRAMID_ROWS; ++row)
      for (let col = 0; col <= row; ++col) {
        const entry = S.pyramid[row][col];
        if (entry.removed)
          continue;
        if (entry.card._dealing)
          continue;

        const pos = pyramidCardPos(row, col);
        const exposed = isExposed(row, col);

        // Draw card
        CE.drawCardFace(cx, pos.x, pos.y, entry.card);

        // Dim non-exposed cards
        if (!exposed) {
          cx.save();
          cx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          CE.drawRoundedRect(cx, pos.x, pos.y, CARD_W, CARD_H, CE.CARD_RADIUS);
          cx.fill();
          cx.restore();
        }

        // Selection highlight
        if (S.selectedCard && S.selectedCard.source === 'pyramid' && S.selectedCard.row === row && S.selectedCard.col === col)
          drawSelectionGlow(cx, pos.x, pos.y);

        // Hint highlight
        if (S.hintTimer > 0 && S.hintPair) {
          for (const h of S.hintPair) {
            if (h && h.source === 'pyramid' && h.row === row && h.col === col)
              drawHintGlow(cx, pos.x, pos.y);
          }
        }

        // Hint glow for cards with valid pairs
        if (S._host && S._host.hintsEnabled && exposed && !S.roundOver && !S.gameOver && hasValidPair(row, col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
      }

    // Draw stock pile
    if (S.stock.length > 0) {
      CE.drawCardBack(cx, STOCK_X, STOCK_Y);

      // Show count
      cx.font = '11px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(S.stock.length + ' left', STOCK_X + CARD_W / 2, STOCK_Y + CARD_H + 4);
    } else {
      CE.drawEmptySlot(cx, STOCK_X, STOCK_Y, null);
      cx.font = '10px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText('Empty', STOCK_X + CARD_W / 2, STOCK_Y + CARD_H + 4);
    }

    // Draw waste pile
    if (S.waste.length > 0) {
      const top = S.waste[S.waste.length - 1];
      CE.drawCardFace(cx, WASTE_X, WASTE_Y, top);

      // Selection highlight on waste
      if (S.selectedCard && S.selectedCard.source === 'waste')
        drawSelectionGlow(cx, WASTE_X, WASTE_Y);

      // Hint highlight on waste
      if (S.hintTimer > 0 && S.hintPair) {
        for (const h of S.hintPair) {
          if (h && h.source === 'waste')
            drawHintGlow(cx, WASTE_X, WASTE_Y);
        }
      }

      // Hint glow for waste top card with valid pair
      if (S._host && S._host.hintsEnabled && !S.roundOver && !S.gameOver && wasteHasValidPair())
        CE.drawHintGlow(cx, WASTE_X, WASTE_Y, CARD_W, CARD_H, S._host.hintTime);
    } else
      CE.drawEmptySlot(cx, WASTE_X, WASTE_Y, null);

    // Labels
    cx.font = '11px sans-serif';
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.textAlign = 'center';
    cx.textBaseline = 'bottom';
    cx.fillText('Stock', STOCK_X + CARD_W / 2, STOCK_Y - 4);
    cx.fillText('Waste', WASTE_X + CARD_W / 2, WASTE_Y - 4);

    // Score display (top-right)
    cx.font = 'bold 16px sans-serif';
    cx.fillStyle = '#fa0';
    cx.textAlign = 'right';
    cx.textBaseline = 'top';
    cx.fillText('Score: ' + S.score, CANVAS_W - 20, 12);

    cx.font = '12px sans-serif';
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.fillText('Pairs: ' + S.pairsRemoved, CANVAS_W - 20, 34);
    cx.fillText('Moves: ' + S.moveCount, CANVAS_W - 20, 50);

    // Hint button
    if (!S.roundOver && !S.gameOver)
      drawButton(cx, HINT_BTN.x, HINT_BTN.y, HINT_BTN.w, HINT_BTN.h, 'Hint (H)', { bg: '#2a4a5a', border: '#6ac', fontSize: 11 });

    // Help text
    if (S.selectedCard && !S.roundOver && !S.gameOver) {
      const val = pyramidValue(S.selectedCard.card);
      const need = 13 - val;
      cx.font = '13px sans-serif';
      cx.fillStyle = '#ff8';
      cx.textAlign = 'center';
      cx.textBaseline = 'bottom';
      cx.fillText('Selected ' + S.selectedCard.card.rank + ' (value ' + val + ') \u2014 find a ' + need + ' to pair', CANVAS_W / 2, CANVAS_H - 8);
    } else if (!S.roundOver && !S.gameOver) {
      cx.font = '12px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'center';
      cx.textBaseline = 'bottom';
      cx.fillText('Remove pairs that sum to 13. Kings remove alone. Click stock to draw.', CANVAS_W / 2, CANVAS_H - 8);
    }

    // Game over / round over overlay
    if (S.roundOver || S.gameOver) {
      cx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      cx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      cx.font = 'bold 28px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';

      if (isPyramidCleared()) {
        cx.fillStyle = '#4f4';
        cx.fillText('Pyramid Cleared!', CANVAS_W / 2, CANVAS_H / 2 - 20);
      } else {
        cx.fillStyle = '#f66';
        cx.fillText('No More Moves', CANVAS_W / 2, CANVAS_H / 2 - 20);
      }

      cx.font = '16px sans-serif';
      cx.fillStyle = '#fa0';
      cx.fillText('Score: ' + S.score, CANVAS_W / 2, CANVAS_H / 2 + 10);

      drawButton(cx, NEW_DEAL_BTN.x, NEW_DEAL_BTN.y, NEW_DEAL_BTN.w, NEW_DEAL_BTN.h, 'Continue', { bg: '#2a5a2a', border: '#6c6' });
    }

    // Particles
    CE.updateAndDrawParticles(cx, S.particles);
  }

  Object.assign(V, { drawScene });

})();
