;(function() {
  'use strict';

  /* Golf: drawing of columns, stock, waste, highlights, move animations and the result
     overlay. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.golf;
  const S = V.S;
  const {
    CE, CARD_W, CARD_H, CARD_RADIUS, COLUMN_COUNT, COLUMNS_TOP, STOCK_X, STOCK_Y, WASTE_X,
    WASTE_Y, columnX, columnCardY, canPlayOnWaste
  } = V;
  const { drawRoundedRect, drawCardFace, drawEmptySlot } = SZ.CardGames.shared.solitaireFallback;

  function drawCardBack(cx, x, y) {
    if (CE && CE.drawCardBack)
      return CE.drawCardBack(cx, x, y);
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.fillStyle = '#1a237e';
    cx.fill();
    cx.strokeStyle = '#fff';
    cx.lineWidth = 1;
    cx.stroke();
  }

  /* ================================================================
   *  PLAYABLE HIGHLIGHT
   * ================================================================ */

  function drawPlayableHighlight(cx, x, y) {
    cx.save();
    cx.strokeStyle = '#4c4';
    cx.lineWidth = 2.5;
    cx.shadowColor = '#4c4';
    cx.shadowBlur = 6;
    if (CE && CE.drawRoundedRect) {
      CE.drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    } else
      drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    cx.stroke();
    cx.restore();
  }

  function drawHoverHighlight(cx, x, y) {
    cx.save();
    cx.strokeStyle = '#ff4';
    cx.lineWidth = 3;
    cx.shadowColor = '#ff4';
    cx.shadowBlur = 8;
    if (CE && CE.drawRoundedRect)
      CE.drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    else
      drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    cx.stroke();
    cx.restore();
  }

  function drawAnimations(cx) {
    const now = performance.now();
    for (let i = S.animatingCards.length - 1; i >= 0; --i) {
      const a = S.animatingCards[i];
      const elapsed = now - a.startTime;
      const t = Math.min(elapsed / a.duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const x = a.fromX + (a.toX - a.fromX) * ease;
      const y = a.fromY + (a.toY - a.fromY) * ease;
      drawCardFace(cx, x, y, a.card);
      if (t >= 1) {
        S.animatingCards.splice(i, 1);
        if (CE && CE.spawnSparkle)
          CE.spawnSparkle(S.particles, a.toX + CARD_W / 2, a.toY + CARD_H / 2);
        if (a.onDone)
          a.onDone();
      }
    }
  }

  /* ================================================================
   *  DRAWING
   * ================================================================ */

  function drawGolf(cx, W, H) {
    const animSet = new Set();
    for (const a of S.animatingCards)
      animSet.add(a.card);

    // Title
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText('Golf Solitaire', 10, 8);

    // Score (top-right)
    cx.fillStyle = '#fff';
    cx.font = 'bold 16px sans-serif';
    cx.textAlign = 'right';
    cx.textBaseline = 'top';
    cx.fillText('Score: ' + S.score, W - 20, 8);

    // Moves + cards remaining
    cx.font = '12px sans-serif';
    cx.fillStyle = 'rgba(255,255,255,0.7)';
    cx.textAlign = 'right';
    let totalColumnCards = 0;
    for (const col of S.columns)
      totalColumnCards += col.length;
    cx.fillText('Moves: ' + S.moveCount + '  |  Remaining: ' + totalColumnCards + '  |  Stock: ' + S.stock.length, W - 20, 28);

    // Columns
    for (let c = 0; c < COLUMN_COUNT; ++c) {
      const pile = S.columns[c];
      const cx_ = columnX(c);

      if (pile.length === 0) {
        drawEmptySlot(cx, cx_, COLUMNS_TOP, null);
        continue;
      }

      for (let r = 0; r < pile.length; ++r) {
        const card = pile[r];
        if (animSet.has(card))
          continue;
        const cy = columnCardY(r);
        drawCardFace(cx, cx_, cy, card);

        // Highlight bottom card if playable
        if (r === pile.length - 1 && canPlayOnWaste(card) && !S.roundOver) {
          if (c === S.hoverCol)
            drawHoverHighlight(cx, cx_, cy);
          else
            drawPlayableHighlight(cx, cx_, cy);
          if (S._host && S._host.hintsEnabled && !animSet.has(card))
            CE.drawHintGlow(cx, cx_, cy, CARD_W, CARD_H, S._host.hintTime);
        }
      }
    }

    // Stock pile
    if (S.stock.length > 0) {
      const stackCount = Math.min(Math.ceil(S.stock.length / 4), 4);
      for (let i = 0; i < stackCount; ++i)
        drawCardBack(cx, STOCK_X - i * 2, STOCK_Y - i * 2);

      cx.font = '10px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(S.stock.length + ' left', STOCK_X + CARD_W / 2, STOCK_Y + CARD_H + 4);
    } else
      drawEmptySlot(cx, STOCK_X, STOCK_Y, null);

    // Waste pile
    if (S.waste.length > 0) {
      const topWaste = S.waste[S.waste.length - 1];
      if (!animSet.has(topWaste))
        drawCardFace(cx, WASTE_X, WASTE_Y, topWaste);
    } else
      drawEmptySlot(cx, WASTE_X, WASTE_Y, null);

    // Animations
    drawAnimations(cx);

    // Particles
    if (CE && CE.updateAndDrawParticles)
      CE.updateAndDrawParticles(cx, S.particles);

    // Result message
    if (S.roundOver && S.resultMsg) {
      cx.save();

      cx.fillStyle = 'rgba(0,0,0,0.5)';
      const msgW = 420;
      const msgH = 80;
      const msgX = (W - msgW) / 2;
      const msgY = (H - msgH) / 2 + 40;
      drawRoundedRect(cx, msgX, msgY, msgW, msgH, 10);
      cx.fill();

      cx.fillStyle = '#fff';
      cx.font = 'bold 18px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(S.resultMsg, W / 2, msgY + 30);

      cx.font = '13px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.fillText('Click to continue', W / 2, msgY + 55);

      cx.restore();
    }

    // Instructions at bottom-right
    if (!S.roundOver) {
      cx.font = '11px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'right';
      cx.textBaseline = 'bottom';
      cx.fillText('Click bottom card to play  |  Click stock to draw  |  Ctrl+Z to undo', W - 10, H - 8);
    }
  }

  Object.assign(V, { drawGolf });

})();
