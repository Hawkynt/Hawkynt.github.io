;(function() {
  'use strict';

  /* Accordion: drawing of the pile grid, highlights, count badges, move animations
     and the result overlay. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.accordion;
  const S = V.S;
  const { CE, CARD_W, CARD_H, CARD_RADIUS, slotX, slotY, topCard, validTargets, getHintPiles } = V;
  const { drawRoundedRect, drawCardFace, drawEmptySlot } = SZ.CardGames.shared.solitaireFallback;

  /* ================================================================
   *  HIGHLIGHTS
   * ================================================================ */

  function drawHighlight(cx, x, y, color, blur) {
    cx.save();
    cx.strokeStyle = color;
    cx.lineWidth = 2.5;
    cx.shadowColor = color;
    cx.shadowBlur = blur;
    if (CE && CE.drawRoundedRect)
      CE.drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    else
      drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    cx.stroke();
    cx.restore();
  }

  function drawSelectedHighlight(cx, x, y) {
    drawHighlight(cx, x, y, '#4cf', 10);
  }

  function drawTargetHighlight(cx, x, y) {
    drawHighlight(cx, x, y, '#4c4', 6);
  }

  function drawHoverHighlight(cx, x, y) {
    drawHighlight(cx, x, y, '#ff4', 8);
  }

  /* ================================================================
   *  PILE COUNT BADGE
   * ================================================================ */

  function drawPileBadge(cx, x, y, count) {
    if (count <= 1)
      return;
    const bx = x + CARD_W - 10;
    const by = y + 2;
    const text = '' + count;
    cx.font = 'bold 11px sans-serif';
    const tw = cx.measureText(text).width;
    const bw = Math.max(tw + 8, 18);
    const bh = 16;

    cx.fillStyle = 'rgba(0,0,0,0.7)';
    cx.beginPath();
    cx.arc(bx - bw / 2 + bw, by + bh / 2, bh / 2, -Math.PI / 2, Math.PI / 2);
    cx.arc(bx - bw / 2 + bh / 2, by + bh / 2, bh / 2, Math.PI / 2, -Math.PI / 2);
    cx.closePath();
    cx.fill();

    cx.fillStyle = '#fff';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(text, bx - bw / 2 + bw / 2 + 4, by + bh / 2);
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

  function drawAccordion(cx, W, H) {
    const animSet = new Set();
    for (const a of S.animatingCards)
      animSet.add(a.card);

    const hintPiles = (S._host && S._host.hintsEnabled && !S.roundOver) ? getHintPiles() : new Set();
    const targetSet = new Set();
    if (S.selected >= 0)
      for (const t of validTargets(S.selected))
        targetSet.add(t);

    // Title
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText('Accordion Solitaire', 10, 8);

    // Score (top-right)
    cx.fillStyle = '#fff';
    cx.font = 'bold 16px sans-serif';
    cx.textAlign = 'right';
    cx.textBaseline = 'top';
    cx.fillText('Score: ' + S.score, W - 20, 8);

    // Moves + piles remaining
    cx.font = '12px sans-serif';
    cx.fillStyle = 'rgba(255,255,255,0.7)';
    cx.textAlign = 'right';
    cx.fillText('Moves: ' + S.moveCount + '  |  Piles: ' + S.piles.length, W - 20, 28);

    // Draw piles
    for (let i = 0; i < S.piles.length; ++i) {
      const x = slotX(i);
      const y = slotY(i);
      const card = topCard(i);

      if (animSet.has(card))
        continue;

      drawCardFace(cx, x, y, card);
      drawPileBadge(cx, x, y, S.piles[i].length);

      // Selected highlight
      if (i === S.selected)
        drawSelectedHighlight(cx, x, y);
      // Valid target for selected pile
      else if (targetSet.has(i))
        drawTargetHighlight(cx, x, y);
      // Hover
      else if (i === S.hoverIdx && !S.roundOver)
        drawHoverHighlight(cx, x, y);

      // Hint glow
      if (hintPiles.has(i) && S.selected < 0 && CE && CE.drawHintGlow)
        CE.drawHintGlow(cx, x, y, CARD_W, CARD_H, S._host.hintTime);
    }

    // Animations
    drawAnimations(cx);

    // Particles
    if (CE && CE.updateAndDrawParticles)
      CE.updateAndDrawParticles(cx, S.particles);

    // Result message
    if (S.roundOver && S.resultMsg) {
      cx.save();

      cx.fillStyle = 'rgba(0,0,0,0.5)';
      const msgW = 460;
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

    // Instructions at bottom
    if (!S.roundOver) {
      cx.font = '11px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'right';
      cx.textBaseline = 'bottom';
      cx.fillText('Click to select, click target (1 or 3 left, same suit/rank) to move  |  Ctrl+Z to undo', W - 10, H - 8);
    }
  }

  Object.assign(V, { drawAccordion });

})();
