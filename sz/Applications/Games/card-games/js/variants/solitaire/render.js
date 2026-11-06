;(function() {
  'use strict';

  /* Solitaire (Klondike): drawing of the table, status bar and overlays. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.solitaire;
  const S = V.S;
  const {
    CE, CARD_W, CARD_H, FACE_UP_OFFSET, FOUNDATION_COUNT, TABLEAU_COUNT, BASE_W, BASE_H, stockPos,
    wastePos, foundationPos, tableauPos, tableauCardPos, wasteCardPos, isDragSource,
    hasAnyValidMove
  } = V;

  /* ================================================================
   *  STATUS BAR (drawn on canvas)
   * ================================================================ */

  function drawStatusBar(cx) {
    const barY = S.canvasH - 22;
    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.fillRect(0, barY, S.canvasW, 22);

    cx.font = '12px sans-serif';
    cx.textBaseline = 'middle';
    cx.textAlign = 'left';

    cx.fillStyle = '#fff';
    cx.fillText(S.statusMsg, 8, barY + 11);

    cx.textAlign = 'center';
    cx.fillText('Moves: ' + S.moveCount, S.canvasW / 2, barY + 11);

    const mins = Math.floor(S.timerSeconds / 60);
    const secs = S.timerSeconds % 60;
    cx.textAlign = 'right';
    cx.fillText('Time: ' + mins + ':' + String(secs).padStart(2, '0'), S.canvasW - 8, barY + 11);
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

    const animSet = new Set();
    for (const d of S.dealAnimCards)
      animSet.add(d.card);
    for (const a of S.animatingCards)
      animSet.add(a.card);

    if (S.winAnimRunning) {
      drawWinFrame(cx);
      drawStatusBar(cx);
      cx.restore();
      return;
    }

    // Stock pile
    const sp = stockPos();
    if (S.stock.length > 0)
      CE.drawCardBack(cx, sp.x, sp.y);
    else
      CE.drawRecycleSymbol(cx, sp.x, sp.y);

    // Waste pile
    const wp = wastePos();
    if (S.waste.length === 0) {
      CE.drawEmptySlot(cx, wp.x, wp.y, null);
    } else {
      if (S.drawMode === 1) {
        const top = S.waste[S.waste.length - 1];
        if (!isDragSource('waste', S.waste.length - 1) && !animSet.has(top)) {
          CE.drawCard(cx, wp.x, wp.y, top);
          if (S._host && S._host.hintsEnabled && !S.dragging && hasAnyValidMove(top, -1))
            CE.drawHintGlow(cx, wp.x, wp.y, CARD_W, CARD_H, S._host.hintTime);
        }
      } else {
        const visibleStart = Math.max(0, S.waste.length - 3);
        for (let i = visibleStart; i < S.waste.length; ++i) {
          if (isDragSource('waste', i))
            continue;
          if (animSet.has(S.waste[i]))
            continue;
          const pos = wasteCardPos(i);
          CE.drawCard(cx, pos.x, pos.y, S.waste[i]);
          if (i === S.waste.length - 1 && S._host && S._host.hintsEnabled && !S.dragging && hasAnyValidMove(S.waste[i], -1))
            CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
        }
      }
    }

    // Foundation piles
    const foundSuits = ['spades', 'hearts', 'diamonds', 'clubs'];
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (S.foundations[i].length === 0) {
        CE.drawEmptySlot(cx, fp.x, fp.y, null);
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        CE.drawSuitSymbol(cx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
      } else {
        const top = S.foundations[i][S.foundations[i].length - 1];
        if (!animSet.has(top))
          CE.drawCard(cx, fp.x, fp.y, top);
        else if (S.foundations[i].length > 1)
          CE.drawCard(cx, fp.x, fp.y, S.foundations[i][S.foundations[i].length - 2]);
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
        CE.drawCard(cx, pos.x, pos.y, S.tableau[col][i]);
        if (S._host && S._host.hintsEnabled && !S.dragging && !animSet.has(S.tableau[col][i]) && S.tableau[col][i].faceUp && i === S.tableau[col].length - 1 && hasAnyValidMove(S.tableau[col][i], col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
      }
    }

    drawAnimations(cx);

    // Draw dragged cards on top
    if (S.dragging) {
      for (let i = 0; i < S.dragging.cards.length; ++i) {
        const dx = S.dragging.currentX - S.dragging.offsetX;
        const dy = S.dragging.currentY - S.dragging.offsetY + i * FACE_UP_OFFSET;
        CE.drawCard(cx, dx, dy, S.dragging.cards[i]);
      }
    }

    CE.drawParticles(cx, S.particles);
    drawStatusBar(cx);

    cx.restore();
  }

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

  function drawWinFrame(cx) {
    const now = performance.now();

    if (now - S.lastFireworkTime > 500) {
      CE.spawnFirework(S.particles, Math.random() * S.canvasW, Math.random() * S.canvasH * 0.6);
      S.lastFireworkTime = now;
    }

    CE.drawWinCards(cx, S.winAnimCards, S.canvasW, S.canvasH);
    CE.updateParticles(S.particles);
    CE.drawParticles(cx, S.particles);
  }

  Object.assign(V, { drawAll });

})();
