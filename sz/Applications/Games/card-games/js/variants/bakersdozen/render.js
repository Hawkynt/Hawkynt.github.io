;(function() {
  'use strict';

  /* Baker's Dozen: drawing of the table, status bar and overlays. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.bakersdozen;
  const S = V.S;
  const {
    CE, CARD_W, CARD_H, TABLEAU_COUNT, FOUNDATION_COUNT, BASE_W, BASE_H, foundationPos,
    tableauPos, tableauCardPos, hasAnyValidMove, isDragSource
  } = V;

  /* ================================================================
   *  MAIN DRAW
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
      cx.fillText('You won! Score: ' + S.score + '  Moves: ' + S.moveCount, scaledW / 2, 4);

      cx.restore();
      return;
    }

    // --- Normal game draw ---
    const animSet = new Set();
    for (const a of S.animatingCards)
      animSet.add(a.card);

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
        // Draw dimmed empty slot (cannot be filled)
        CE.drawEmptySlot(cx, tp.x, tp.y, null);
        cx.fillStyle = 'rgba(255,0,0,0.15)';
        cx.fillRect(tp.x + 1, tp.y + 1, CARD_W - 2, CARD_H - 2);
        continue;
      }
      for (let i = 0; i < S.tableau[col].length; ++i) {
        if (isDragSource('tableau', col) && i >= S.dragging.sourceIndex)
          continue;
        const pos = tableauCardPos(col, i);
        const card = S.tableau[col][i];
        if (!animSet.has(card))
          CE.drawCardFace(cx, pos.x, pos.y, card);
        if (i === S.tableau[col].length - 1 && S._host && S._host.hintsEnabled && !S.dragging && !animSet.has(card) && hasAnyValidMove(card, col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
      }
      if (S.selection && S.selection.col === col) {
        const selPos = tableauCardPos(col, S.tableau[col].length - 1);
        CE.drawSelectionHighlight(cx, selPos.x, selPos.y, CARD_H);
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

    // Draw dragged card on top
    if (S.dragging) {
      const dx = S.dragging.currentX - S.dragging.offsetX;
      const dy = S.dragging.currentY - S.dragging.offsetY;
      CE.drawCardFace(cx, dx, dy, S.dragging.card);
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

    let foundTotal = 0;
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      foundTotal += S.foundations[i].length;

    cx.fillText('Score: ' + S.score + '  |  Moves: ' + S.moveCount + '  |  ' + timeStr + '  |  Foundation: ' + foundTotal + '/52', 4, h - 2);
  }

  Object.assign(V, { drawScene });

})();
