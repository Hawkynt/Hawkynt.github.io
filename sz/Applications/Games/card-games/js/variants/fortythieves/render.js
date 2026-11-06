;(function() {
  'use strict';

  /* Forty Thieves: drawing of the table, status bar and overlays. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.fortythieves;
  const S = V.S;
  const {
    CE, CARD_W, CARD_H, MARGIN_X, TABLEAU_COUNT, FOUNDATION_COUNT, BASE_W, BASE_H, stockPos,
    wastePos, foundationPos, tableauPos, tableauCardPos, hasAnyValidMove, isDragSource
  } = V;

  /* ================================================================
   *  STATUS BAR
   * ================================================================ */

  function drawStatusBar(cx, w, h) {
    const barY = h - 18;
    cx.font = '11px sans-serif';
    cx.textBaseline = 'bottom';
    cx.textAlign = 'left';
    cx.fillStyle = 'rgba(255,255,255,0.8)';

    const mins = Math.floor(S.timerSeconds / 60);
    const secs = S.timerSeconds % 60;
    const timeStr = 'Time: ' + mins + ':' + String(secs).padStart(2, '0');
    const movesStr = 'Moves: ' + S.moveCount;
    const scoreStr = 'Score: ' + S.score;
    const stockStr = 'Stock: ' + S.stock.length;

    const infoText = S.statusMsg + '  |  ' + scoreStr + '  |  ' + movesStr + '  |  ' + stockStr + '  |  ' + timeStr;
    cx.fillText(infoText, MARGIN_X, barY);
  }

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
      // Draw empty slots during deal
      const sp = stockPos();
      CE.drawCardBack(cx, sp.x, sp.y);
      const wp = wastePos();
      CE.drawEmptySlot(cx, wp.x, wp.y, null);

      const foundSuits = ['spades', 'hearts', 'diamonds', 'clubs', 'spades', 'hearts', 'diamonds', 'clubs'];
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

      drawStatusBar(cx, scaledW, scaledH);
      cx.restore();
      return;
    }

    // --- Win animation ---
    if (S.winAnimRunning) {
      if (now - S.lastFireworkTime > 500) {
        CE.spawnFirework(S.particles, Math.random() * scaledW, Math.random() * scaledH * 0.6);
        S.lastFireworkTime = now;
      }

      CE.drawWinCards(cx, S.winAnimCards, scaledW, scaledH);
      CE.updateAndDrawParticles(cx, S.particles);

      cx.fillStyle = '#fff';
      cx.font = 'bold 16px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(S.statusMsg, scaledW / 2, 4);

      cx.restore();
      return;
    }

    // --- Normal game draw ---
    const animSet = new Set();
    for (const a of S.animatingCards)
      animSet.add(a.card);

    // Stock pile
    const sp = stockPos();
    if (S.stock.length > 0) {
      const stackCount = Math.min(Math.ceil(S.stock.length / 10), 4);
      for (let i = 0; i < stackCount; ++i)
        CE.drawCardBack(cx, sp.x - i * 2, sp.y);
      cx.font = '10px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(S.stock.length, sp.x + CARD_W / 2, sp.y + CARD_H + 3);
    } else
      CE.drawEmptySlot(cx, sp.x, sp.y, null);

    // Waste pile
    const wp = wastePos();
    if (S.waste.length === 0) {
      CE.drawEmptySlot(cx, wp.x, wp.y, null);
    } else {
      const top = S.waste[S.waste.length - 1];
      if (!isDragSource('waste', S.waste.length - 1) && !animSet.has(top)) {
        CE.drawCardFace(cx, wp.x, wp.y, top);
        if (S._host && S._host.hintsEnabled && !S.dragging && hasAnyValidMove(top, -1))
          CE.drawHintGlow(cx, wp.x, wp.y, CARD_W, CARD_H, S._host.hintTime);
      }
    }

    // Foundation piles
    const foundSuits = ['spades', 'hearts', 'diamonds', 'clubs', 'spades', 'hearts', 'diamonds', 'clubs'];
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
        if (animSet.has(S.tableau[col][i]))
          continue;
        const pos = tableauCardPos(col, i);
        CE.drawCardFace(cx, pos.x, pos.y, S.tableau[col][i]);
        // Hint glow on top card only
        if (i === S.tableau[col].length - 1 && S._host && S._host.hintsEnabled && !S.dragging && hasAnyValidMove(S.tableau[col][i], col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
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
      CE.drawCardFace(cx, dx, dy, S.dragging.cards[0]);
    }

    CE.updateAndDrawParticles(cx, S.particles);
    drawStatusBar(cx, scaledW, scaledH);

    cx.restore();
  }

  Object.assign(V, { drawScene });

})();
