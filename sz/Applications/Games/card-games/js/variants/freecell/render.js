;(function() {
  'use strict';

  /* FreeCell: drawing of the table, status bar and overlays. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.freecell;
  const S = V.S;
  const {
    CE, CARD_W, CARD_H, CARD_GAP, FACE_UP_OFFSET, MARGIN_X, PILE_GAP, FREECELL_COUNT,
    FOUNDATION_COUNT, TABLEAU_COUNT, BASE_W, BASE_H, TOP_ROW_Y, freeCellPos, foundationPos,
    tableauPos, tableauCardPos, hasAnyValidMove, isDragSource
  } = V;

  /* ================================================================
   *  MAIN DRAW (called by host each frame)
   * ================================================================ */

  function drawScene(cx, W, H) {
    S.canvasW = W;
    S.canvasH = H;
    S.scale = Math.min(W / BASE_W, H / BASE_H);

    cx.save();
    cx.scale(S.scale, S.scale);

    const scaledW = W / S.scale;
    const scaledH = H / S.scale;

    const now = performance.now();

    // --- Deal animation ---
    if (S.dealAnimRunning && S.dealAnimCards.length > 0) {
      for (let i = 0; i < FREECELL_COUNT; ++i) {
        const pos = freeCellPos(i);
        CE.drawEmptySlot(cx, pos.x, pos.y, null);
      }
      const foundSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
      for (let i = 0; i < FOUNDATION_COUNT; ++i) {
        const fp = foundationPos(i);
        CE.drawEmptySlot(cx, fp.x, fp.y, null);
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        CE.drawSuitSymbol(cx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
      }
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const tp = tableauPos(col);
        CE.drawEmptySlot(cx, tp.x, tp.y, null);
      }

      let allDone = true;
      for (const d of S.dealAnimCards) {
        if (now < d.startTime) {
          allDone = false;
          continue;
        }
        const elapsed = now - d.startTime;
        const t = Math.min(elapsed / d.duration, 1);
        const e = CE.easeOutCubic(t);
        const x = d.fromX + (d.toX - d.fromX) * e;
        const y = d.fromY + (d.toY - d.fromY) * e;
        CE.drawCardFace(cx, x, y, d.card);
        if (t < 1)
          allDone = false;
      }

      if (allDone) {
        S.dealAnimRunning = false;
        S.dealAnimCards = [];
      }

      drawStatusOverlay(cx, scaledW, scaledH);
      cx.restore();
      return;
    }

    // --- Win animation ---
    if (S.winAnimRunning) {
      if (now - S.lastFireworkTime > 500) {
        CE.spawnFirework(S.particles, Math.random() * scaledW, Math.random() * scaledH * 0.6);
        S.lastFireworkTime = now;
      }

      const anyAlive = CE.drawWinCards(cx, S.winAnimCards, scaledW, scaledH);
      CE.updateAndDrawParticles(cx, S.particles);

      if (!anyAlive && S.winAnimCards.length > 0 && S.particles.length === 0)
        S.winAnimRunning = false;

      cx.fillStyle = '#fff';
      cx.font = 'bold 16px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText('You won Game #' + S.gameNumber + ' in ' + S.moveCount + ' moves!', scaledW / 2, 4);

      cx.restore();
      return;
    }

    // --- Normal game draw ---
    const animSet = new Set();
    for (const a of S.animatingCards)
      animSet.add(a.card);

    // Separator line
    cx.strokeStyle = 'rgba(255,255,255,0.1)';
    cx.lineWidth = 1;
    const sepX = MARGIN_X + 4 * PILE_GAP - CARD_GAP / 2;
    cx.beginPath();
    cx.moveTo(sepX, TOP_ROW_Y + 4);
    cx.lineTo(sepX, TOP_ROW_Y + CARD_H - 4);
    cx.stroke();

    // Free cells
    for (let i = 0; i < FREECELL_COUNT; ++i) {
      const pos = freeCellPos(i);
      if (S.freeCells[i]) {
        if (!isDragSource('freecell', i)) {
          CE.drawCardFace(cx, pos.x, pos.y, S.freeCells[i]);
          if (S.selection && S.selection.source === 'freecell' && S.selection.col === i)
            CE.drawSelectionHighlight(cx, pos.x, pos.y, CARD_H);
          else if (S._host && S._host.hintsEnabled && !S.dragging && !animSet.has(S.freeCells[i]) && hasAnyValidMove(S.freeCells[i], -1))
            CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
        }
      } else
        CE.drawEmptySlot(cx, pos.x, pos.y, null);
    }

    // Foundation piles
    const foundSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (S.foundations[i].length === 0) {
        CE.drawEmptySlot(cx, fp.x, fp.y, null);
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        CE.drawSuitSymbol(cx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
      } else {
        const top = S.foundations[i][S.foundations[i].length - 1];
        if (!animSet.has(top))
          CE.drawCardFace(cx, fp.x, fp.y, top);
        else if (S.foundations[i].length > 1)
          CE.drawCardFace(cx, fp.x, fp.y, S.foundations[i][S.foundations[i].length - 2]);
        else {
          CE.drawEmptySlot(cx, fp.x, fp.y, null);
          cx.fillStyle = 'rgba(255,255,255,0.3)';
          CE.drawSuitSymbol(cx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
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
        const pos = tableauCardPos(col, i);
        CE.drawCardFace(cx, pos.x, pos.y, S.tableau[col][i]);
        if (i === S.tableau[col].length - 1 && S._host && S._host.hintsEnabled && !S.dragging && !animSet.has(S.tableau[col][i]) && hasAnyValidMove(S.tableau[col][i], col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
      }
      if (S.selection && S.selection.source === 'tableau' && S.selection.col === col) {
        const selPos = tableauCardPos(col, S.selection.index);
        const stackH = (S.tableau[col].length - 1 - S.selection.index) * FACE_UP_OFFSET + CARD_H;
        CE.drawSelectionHighlight(cx, selPos.x, selPos.y, stackH);
      }
    }

    // Draw animating cards
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

    // Draw dragged cards on top
    if (S.dragging) {
      for (let i = 0; i < S.dragging.cards.length; ++i) {
        const dx = S.dragging.currentX - S.dragging.offsetX;
        const dy = S.dragging.currentY - S.dragging.offsetY + i * FACE_UP_OFFSET;
        CE.drawCardFace(cx, dx, dy, S.dragging.cards[i]);
      }
    }

    CE.updateAndDrawParticles(cx, S.particles);
    drawStatusOverlay(cx, scaledW, scaledH);

    cx.restore();
  }

  function drawStatusOverlay(cx, w, h) {
    cx.fillStyle = 'rgba(255,255,255,0.7)';
    cx.font = '11px sans-serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'bottom';

    const mins = Math.floor(S.timerSeconds / 60);
    const secs = S.timerSeconds % 60;
    const timeStr = 'Time: ' + mins + ':' + String(secs).padStart(2, '0');

    cx.fillText('Game #' + S.gameNumber + '  |  Moves: ' + S.moveCount + '  |  ' + timeStr, 4, h - 2);
  }

  Object.assign(V, { drawScene });

})();
