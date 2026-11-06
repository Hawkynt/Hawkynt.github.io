;(function() {
  'use strict';

  /* Canfield: drawing of the table, status bar and overlays. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.canfield;
  const S = V.S;
  const {
    CE, CARD_W, CARD_H, FACE_UP_OFFSET, FOUNDATION_COUNT, TABLEAU_COUNT, BASE_W, BASE_H,
    reservePos, foundationPos, stockPos, wastePos, tableauPos, tableauCardPos, wasteCardPos,
    rankLabel, hasAnyValidMove, isDragSource
  } = V;

  function drawAnimations(cx) {
    const now = performance.now();

    for (let i = S.animatingCards.length - 1; i >= 0; --i) {
      const a = S.animatingCards[i];
      const elapsed = now - a.startTime;
      const t = Math.min(elapsed / a.duration, 1);
      const e = CE.easeOutCubic(t);
      const x = a.fromX + (a.toX - a.fromX) * e;
      const y = a.fromY + (a.toY - a.fromY) * e;
      CE.drawCardFace(cx, x, y, a.card);
      if (t >= 1) {
        S.animatingCards.splice(i, 1);
        CE.spawnSparkle(S.particles, a.toX + CARD_W / 2, a.toY + CARD_H / 2);
        if (a.onDone)
          a.onDone();
      }
    }

    for (let i = S.flippingCards.length - 1; i >= 0; --i) {
      const f = S.flippingCards[i];
      const elapsed = now - f.startTime;
      const t = Math.min(elapsed / f.duration, 1);
      let scaleX;
      if (t < 0.5)
        scaleX = 1 - t * 2;
      else
        scaleX = (t - 0.5) * 2;
      cx.save();
      cx.translate(f.x + CARD_W / 2, f.y);
      cx.scale(scaleX, 1);
      if (t < 0.5)
        CE.drawCardBack(cx, -CARD_W / 2, 0);
      else
        CE.drawCardFace(cx, -CARD_W / 2, 0, f.card);
      cx.restore();
      if (t >= 1)
        S.flippingCards.splice(i, 1);
    }

    for (let i = S.dealAnimCards.length - 1; i >= 0; --i) {
      const d = S.dealAnimCards[i];
      const now2 = performance.now();
      if (now2 < d.startTime)
        continue;
      const elapsed = now2 - d.startTime;
      const t = Math.min(elapsed / d.duration, 1);
      const e = CE.easeOutCubic(t);
      const x = d.fromX + (d.toX - d.fromX) * e;
      const y = d.fromY + (d.toY - d.fromY) * e;

      let flipScale;
      if (t < 0.35)
        flipScale = 1;
      else if (t < 0.55)
        flipScale = 1 - (t - 0.35) / 0.2;
      else
        flipScale = (t - 0.55) / 0.45;

      cx.save();
      cx.translate(x + CARD_W / 2, y);
      cx.scale(Math.max(flipScale, 0.01), 1);
      if (t < 0.45)
        CE.drawCardBack(cx, -CARD_W / 2, 0);
      else
        CE.drawCardFace(cx, -CARD_W / 2, 0, d.card);
      cx.restore();

      if (t >= 1)
        S.dealAnimCards.splice(i, 1);
    }
  }

  function drawWinFrame(cx, scaledW, scaledH) {
    const now = performance.now();

    if (now - S.lastFireworkTime > 500) {
      CE.spawnFirework(S.particles, Math.random() * scaledW, Math.random() * scaledH * 0.6);
      S.lastFireworkTime = now;
    }

    CE.drawWinCards(cx, S.winAnimCards, scaledW, scaledH);
    CE.updateAndDrawParticles(cx, S.particles);
  }

  /* ================================================================
   *  STATUS BAR
   * ================================================================ */

  function drawStatusBar(cx, w, h) {
    const barY = h - 22;
    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.fillRect(0, barY, w, 22);

    cx.font = '12px sans-serif';
    cx.textBaseline = 'middle';
    cx.textAlign = 'left';
    cx.fillStyle = '#fff';
    cx.fillText(S.statusMsg, 8, barY + 11);

    cx.textAlign = 'center';
    const baseLabel = S.baseRank >= 0 ? 'Base: ' + rankLabel(S.baseRank) + '  |  ' : '';
    cx.fillText(baseLabel + 'Moves: ' + S.moveCount + '  |  Score: ' + S.score, w / 2, barY + 11);

    const mins = Math.floor(S.timerSeconds / 60);
    const secs = S.timerSeconds % 60;
    cx.textAlign = 'right';
    cx.fillText('Reserve: ' + S.reserve.length + '  |  Time: ' + mins + ':' + String(secs).padStart(2, '0'), w - 8, barY + 11);
  }

  /* ================================================================
   *  MAIN DRAW
   * ================================================================ */

  function drawAll(cx, W, H) {
    S.scale = Math.min(W / BASE_W, H / BASE_H);
    S.canvasW = W / S.scale;
    S.canvasH = H / S.scale;

    cx.save();
    cx.scale(S.scale, S.scale);

    const scaledW = S.canvasW;
    const scaledH = S.canvasH;

    const animSet = new Set();
    for (const d of S.dealAnimCards)
      animSet.add(d.card);
    for (const a of S.animatingCards)
      animSet.add(a.card);

    if (S.winAnimRunning) {
      drawWinFrame(cx, scaledW, scaledH);
      drawStatusBar(cx, scaledW, scaledH);
      cx.restore();
      return;
    }

    // Reserve pile
    const rp = reservePos();
    if (S.reserve.length === 0) {
      CE.drawEmptySlot(cx, rp.x, rp.y, null);
    } else {
      // Draw stacked cards to show depth
      const stackShow = Math.min(S.reserve.length, 4);
      for (let i = 0; i < stackShow - 1; ++i)
        CE.drawCardBack(cx, rp.x + i * 2, rp.y);
      const topReserve = S.reserve[S.reserve.length - 1];
      if (!isDragSource('reserve', 0) && !animSet.has(topReserve)) {
        if (topReserve.faceUp) {
          CE.drawCardFace(cx, rp.x + (stackShow - 1) * 2, rp.y, topReserve);
          if (S._host && S._host.hintsEnabled && !S.dragging && hasAnyValidMove(topReserve, -1))
            CE.drawHintGlow(cx, rp.x + (stackShow - 1) * 2, rp.y, CARD_W, CARD_H, S._host.hintTime);
        } else
          CE.drawCardBack(cx, rp.x + (stackShow - 1) * 2, rp.y);
      }
      // Reserve count label
      cx.font = '10px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(S.reserve.length + ' left', rp.x + CARD_W / 2, rp.y + CARD_H + 3);
    }

    // Stock pile
    const sp = stockPos();
    if (S.stock.length > 0)
      CE.drawCardBack(cx, sp.x, sp.y);
    else
      CE.drawEmptySlot(cx, sp.x, sp.y, '\u21BB');

    // Waste pile
    const wp = wastePos();
    if (S.waste.length === 0) {
      CE.drawEmptySlot(cx, wp.x, wp.y, null);
    } else {
      const visibleStart = Math.max(0, S.waste.length - 3);
      for (let i = visibleStart; i < S.waste.length; ++i) {
        if (isDragSource('waste', i))
          continue;
        if (animSet.has(S.waste[i]))
          continue;
        const pos = wasteCardPos(i);
        CE.drawCardFace(cx, pos.x, pos.y, S.waste[i]);
        if (i === S.waste.length - 1 && S._host && S._host.hintsEnabled && !S.dragging && hasAnyValidMove(S.waste[i], -1))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
      }
    }

    // Foundation piles
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (S.foundations[i].length === 0) {
        CE.drawEmptySlot(cx, fp.x, fp.y, null);
        // Show base rank label
        if (S.baseRank >= 0) {
          cx.fillStyle = 'rgba(255,255,255,0.35)';
          cx.font = 'bold 18px serif';
          cx.textAlign = 'center';
          cx.textBaseline = 'middle';
          cx.fillText(rankLabel(S.baseRank), fp.x + CARD_W / 2, fp.y + CARD_H / 2);
        }
      } else {
        const top = S.foundations[i][S.foundations[i].length - 1];
        if (!animSet.has(top))
          CE.drawCardFace(cx, fp.x, fp.y, top);
        else if (S.foundations[i].length > 1)
          CE.drawCardFace(cx, fp.x, fp.y, S.foundations[i][S.foundations[i].length - 2]);
        else {
          CE.drawEmptySlot(cx, fp.x, fp.y, null);
          if (S.baseRank >= 0) {
            cx.fillStyle = 'rgba(255,255,255,0.35)';
            cx.font = 'bold 18px serif';
            cx.textAlign = 'center';
            cx.textBaseline = 'middle';
            cx.fillText(rankLabel(S.baseRank), fp.x + CARD_W / 2, fp.y + CARD_H / 2);
          }
        }
      }
    }

    // Tableau columns
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const tp = tableauPos(col);
      if (S.tableau[col].length === 0) {
        CE.drawEmptySlot(cx, tp.x, tp.y, null);
        continue;
      }
      for (let i = 0; i < S.tableau[col].length; ++i) {
        if (isDragSource('tableau', col) && i >= S.dragging.sourceIndex)
          continue;
        if (animSet.has(S.tableau[col][i]))
          continue;
        const pos = tableauCardPos(col, i);
        CE.drawCardFace(cx, pos.x, pos.y, S.tableau[col][i]);
        if (i === S.tableau[col].length - 1 && S._host && S._host.hintsEnabled && !S.dragging && hasAnyValidMove(S.tableau[col][i], col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
      }
    }

    drawAnimations(cx);

    // Dragged cards
    if (S.dragging) {
      for (let i = 0; i < S.dragging.cards.length; ++i) {
        const dx = S.dragging.currentX - S.dragging.offsetX;
        const dy = S.dragging.currentY - S.dragging.offsetY + i * FACE_UP_OFFSET;
        CE.drawCardFace(cx, dx, dy, S.dragging.cards[i]);
      }
    }

    CE.updateAndDrawParticles(cx, S.particles);
    drawStatusBar(cx, scaledW, scaledH);

    cx.restore();
  }

  Object.assign(V, { drawAll });

})();
