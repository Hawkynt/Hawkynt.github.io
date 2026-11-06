;(function() {
  'use strict';

  /* Clock: drawing of the clock face, piles, buttons and the result overlay. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.clock;
  const S = V.S;
  const {
    CE, CANVAS_W, CANVAS_H, CARD_W, CARD_H, PILE_COUNT, CW, CH, CR, CLOCK_CX, CLOCK_CY,
    CLOCK_RADIUS, FAN_OFFSET, rankToPile, pilePosition, PILE_LABELS, AUTO_BTN, NEXT_BTN,
    MOVE_DURATION, countFaceUp, isPileComplete
  } = V;
  const { drawRoundedRect } = SZ.CardGames.shared.solitaireFallback;

  function drawCardFace(cx, x, y, card, w, h) {
    if (CE && CE.drawCardFace)
      return CE.drawCardFace(cx, x, y, card, w || CARD_W, h || CARD_H);
    const cw = w || CARD_W;
    const ch = h || CARD_H;
    drawRoundedRect(cx, x, y, cw, ch, CR);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#aaa';
    cx.lineWidth = 1;
    cx.stroke();
    const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#c00' : '#222';
    cx.fillStyle = color;
    cx.font = 'bold ' + Math.round(14 * (cw / CARD_W)) + 'px serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText(card.rank, x + 4, y + 3);
  }

  function drawCardBack(cx, x, y, w, h) {
    if (CE && CE.drawCardBack)
      return CE.drawCardBack(cx, x, y, w || CARD_W, h || CARD_H);
    const cw = w || CARD_W;
    const ch = h || CARD_H;
    drawRoundedRect(cx, x, y, cw, ch, CR);
    cx.fillStyle = '#1a237e';
    cx.fill();
    cx.strokeStyle = '#fff';
    cx.lineWidth = 1;
    cx.stroke();
  }

  function drawEmptySlot(cx, x, y, label, w, h) {
    if (CE && CE.drawEmptySlot)
      return CE.drawEmptySlot(cx, x, y, label, w || CARD_W, h || CARD_H);
    const cw = w || CARD_W;
    const ch = h || CARD_H;
    drawRoundedRect(cx, x, y, cw, ch, CR);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();
    if (label) {
      cx.font = Math.round(18 * (cw / CARD_W)) + 'px serif';
      cx.fillStyle = 'rgba(255,255,255,0.3)';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(label, x + cw / 2, y + ch / 2);
    }
  }

  function drawButton(cx, x, y, w, h, label, opts) {
    if (CE && CE.drawButton)
      return CE.drawButton(cx, x, y, w, h, label, opts);
    cx.save();
    drawRoundedRect(cx, x, y, w, h, 5);
    cx.fillStyle = (opts && opts.bg) || '#2a5a2a';
    cx.fill();
    cx.strokeStyle = (opts && opts.border) || '#6c6';
    cx.lineWidth = 1.5;
    cx.stroke();
    cx.fillStyle = '#fff';
    cx.font = 'bold 13px sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(label, x + w / 2, y + h / 2);
    cx.restore();
  }

  /* ================================================================
   *  DRAWING
   * ================================================================ */

  function drawClock(cx, W, H) {
    // Title
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText('Clock Solitaire (Clock Patience)', 10, 8);

    // Score (top-right)
    cx.fillStyle = '#fff';
    cx.font = 'bold 16px sans-serif';
    cx.textAlign = 'right';
    cx.textBaseline = 'top';
    cx.fillText('Cards placed: ' + S.cardsPlaced + ' / 52', W - 20, 8);

    // Draw clock face circle (decorative)
    cx.save();
    cx.beginPath();
    cx.arc(CLOCK_CX, CLOCK_CY, CLOCK_RADIUS + CW / 2 + 15, 0, Math.PI * 2);
    cx.strokeStyle = 'rgba(255,255,255,0.08)';
    cx.lineWidth = 2;
    cx.stroke();
    cx.restore();

    // Draw hour tick marks and labels
    for (let h = 1; h <= 12; ++h) {
      const angle = -Math.PI / 2 + (h / 12) * 2 * Math.PI;
      const labelR = CLOCK_RADIUS + CW / 2 + 22;
      const lx = CLOCK_CX + Math.cos(angle) * labelR;
      const ly = CLOCK_CY + Math.sin(angle) * labelR;
      cx.save();
      cx.fillStyle = 'rgba(255,255,255,0.25)';
      cx.font = 'bold 11px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(h.toString(), lx, ly);
      cx.restore();
    }

    // Draw each pile
    for (let p = 0; p < PILE_COUNT; ++p) {
      const pos = pilePosition(p);
      const pile = S.piles[p];
      const baseX = pos.x - CW / 2;
      const baseY = pos.y - CH / 2;

      if (pile.length === 0) {
        drawEmptySlot(cx, baseX, baseY, PILE_LABELS[p], CW, CH);
        continue;
      }

      // Draw stacked cards
      for (let i = 0; i < pile.length; ++i) {
        const card = pile[i];
        const cx_ = baseX + i * FAN_OFFSET;
        const cy = baseY + i * FAN_OFFSET;

        if (S.animCard === card && S.animating)
          continue; // skip card being animated

        if (card.faceUp)
          drawCardFace(cx, cx_, cy, card, CW, CH);
        else
          drawCardBack(cx, cx_, cy, CW, CH);
      }

      // Completion indicator
      if (isPileComplete(p)) {
        cx.save();
        cx.fillStyle = 'rgba(0,200,0,0.2)';
        drawRoundedRect(cx, baseX - 2, baseY - 2, CW + (pile.length - 1) * FAN_OFFSET + 4, CH + (pile.length - 1) * FAN_OFFSET + 4, CR + 2);
        cx.fill();
        cx.restore();
      }

      // Pile label below
      cx.save();
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.font = '10px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      const countUp = countFaceUp(pile);
      cx.fillText(PILE_LABELS[p] + ' (' + countUp + '/4)', pos.x, baseY + CH + (pile.length - 1) * FAN_OFFSET + 4);
      cx.restore();
    }

    // Draw animating card
    if (S.animating && S.animCard) {
      const t = Math.min(S.animProgress / MOVE_DURATION, 1);
      const ease = CE ? CE.easeOutCubic(t) : (1 - Math.pow(1 - t, 3));
      const ax = S.animFromX + (S.animToX - S.animFromX) * ease;
      const ay = S.animFromY + (S.animToY - S.animFromY) * ease;
      drawCardFace(cx, ax, ay, S.animCard, CW, CH);
    }

    // Current card indicator (highlight the card that needs to be placed)
    if (S.currentCard && !S.animating && !S.roundOver) {
      const targetPile = rankToPile(S.currentCard.rank);
      const targetPos = pilePosition(targetPile);
      cx.save();
      cx.strokeStyle = '#ff4';
      cx.lineWidth = 3;
      cx.shadowColor = '#ff4';
      cx.shadowBlur = 10;
      const tp = S.piles[targetPile];
      const tx = targetPos.x - CW / 2;
      const ty = targetPos.y - CH / 2;
      drawRoundedRect(cx, tx - 2, ty - 2, CW + (tp.length - 1) * FAN_OFFSET + 4, CH + (tp.length - 1) * FAN_OFFSET + 4, CR + 2);
      cx.stroke();
      cx.restore();

      // Show what card is being placed
      cx.save();
      cx.fillStyle = '#ff4';
      cx.font = 'bold 14px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'bottom';
      cx.fillText('Place: ' + S.currentCard.rank + ' of ' + S.currentCard.suit, CANVAS_W / 2, CANVAS_H - 60);
      cx.restore();
    }

    // Buttons
    if (!S.roundOver) {
      const autoBg = S.autoPlaying ? { bg: '#8a2a2a', border: '#f66' } : { bg: '#2a5a2a', border: '#6c6' };
      const autoLabel = S.autoPlaying ? 'Stop' : 'Auto Play';
      drawButton(cx, AUTO_BTN.x, AUTO_BTN.y, AUTO_BTN.w, AUTO_BTN.h, autoLabel, autoBg);
      if (!S.autoPlaying)
        drawButton(cx, NEXT_BTN.x, NEXT_BTN.y, NEXT_BTN.w, NEXT_BTN.h, 'Next (N)', { bg: '#2a5a2a', border: '#6c6' });
    }

    // Instructions
    if (!S.roundOver && !S.autoPlaying) {
      cx.save();
      cx.font = '11px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'left';
      cx.textBaseline = 'bottom';
      cx.fillText('Press N or click Next to step  |  Auto Play for continuous play', 10, H - 8);
      cx.restore();
    }

    // Result message overlay
    if (S.roundOver && S.resultMsg) {
      cx.save();
      cx.fillStyle = 'rgba(0,0,0,0.55)';
      const msgW = 440;
      const msgH = 80;
      const msgX = (W - msgW) / 2;
      const msgY = (H - msgH) / 2 + 60;
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
  }

  Object.assign(V, { drawClock });

})();
