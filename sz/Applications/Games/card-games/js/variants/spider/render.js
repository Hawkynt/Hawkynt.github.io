;(function() {
  'use strict';

  /* Spider: drawing of the table, status bar and overlays. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spider;
  const S = V.S;
  const {
    CE, CARD_W, CARD_H, FACE_UP_OFFSET, MARGIN_X, TABLEAU_COUNT, tableauPos, tableauCardPos,
    stockPos, foundationPos, findMoveableRunStart, spiderHasValidMove, isDragSource
  } = V;

  /* ================================================================
   *  STATUS BAR
   * ================================================================ */

  function drawStatusBar(cx) {
    const barY = S.canvasH - 16;
    cx.font = '11px sans-serif';
    cx.textBaseline = 'bottom';
    cx.textAlign = 'left';
    cx.fillStyle = 'rgba(255,255,255,0.8)';

    const mins = Math.floor(S.timerSeconds / 60);
    const secs = S.timerSeconds % 60;
    const timerStr = 'Time: ' + mins + ':' + String(secs).padStart(2, '0');
    const movesStr = 'Moves: ' + S.moveCount;
    const scoreStr = 'Score: ' + S.score;

    const infoText = S.statusMsg + '  |  ' + scoreStr + '  |  ' + movesStr + '  |  ' + timerStr;
    cx.fillText(infoText, MARGIN_X, barY);
  }

  /* ================================================================
   *  MAIN DRAW (scene without animations)
   * ================================================================ */

  function drawScene(cx) {
    const dealAnimSet = new Set();
    for (const d of S.dealAnimCards)
      dealAnimSet.add(d.card);

    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const tp = tableauPos(col);
      if (S.tableau[col].length === 0) {
        CE.drawEmptySlot(cx, tp.x, tp.y, null);
        continue;
      }
      const hintRunStart = (S._host && S._host.hintsEnabled && !S.dragging && spiderHasValidMove(col)) ? findMoveableRunStart(col) : -1;
      for (let i = 0; i < S.tableau[col].length; ++i) {
        if (isDragSource(col) && i >= S.dragging.sourceIndex)
          continue;
        if (dealAnimSet.has(S.tableau[col][i]))
          continue;
        const pos = tableauCardPos(col, i);
        CE.drawCard(cx, pos.x, pos.y, S.tableau[col][i]);
        if (i === hintRunStart)
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, S._host.hintTime);
      }
    }

    if (S.stock.length > 0) {
      const sp = stockPos();
      const dealsLeft = Math.ceil(S.stock.length / TABLEAU_COUNT);
      for (let i = 0; i < Math.min(dealsLeft, 5); ++i)
        CE.drawCardBack(cx, sp.x - i * 3, sp.y);

      cx.font = '10px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(dealsLeft + ' deal' + (dealsLeft > 1 ? 's' : ''), sp.x + CARD_W / 2 - (Math.min(dealsLeft, 5) - 1) * 1.5, sp.y + CARD_H + 3);
    }

    for (let i = 0; i < S.completedSuits; ++i) {
      const fp = foundationPos(i);
      CE.drawRoundedRect(cx, fp.x, fp.y, CARD_W, CARD_H, CE.CARD_RADIUS);
      cx.fillStyle = '#fff';
      cx.fill();
      cx.strokeStyle = '#333';
      cx.lineWidth = 1;
      cx.stroke();
      cx.font = 'bold 13px serif';
      cx.fillStyle = '#000';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText('\u2660', fp.x + CARD_W / 2, fp.y + CARD_H / 2);
      cx.font = '10px sans-serif';
      cx.fillText('K\u2192A', fp.x + CARD_W / 2, fp.y + CARD_H / 2 + 14);
    }

    if (S.dragging) {
      for (let i = 0; i < S.dragging.cards.length; ++i) {
        const dx = S.dragging.currentX - S.dragging.offsetX;
        const dy = S.dragging.currentY - S.dragging.offsetY + i * FACE_UP_OFFSET;
        CE.drawCard(cx, dx, dy, S.dragging.cards[i]);
      }
    }

    drawStatusBar(cx);
  }

  Object.assign(V, { drawStatusBar, drawScene });

})();
