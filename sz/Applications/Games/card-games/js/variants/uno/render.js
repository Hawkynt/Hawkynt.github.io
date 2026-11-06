/* Uno: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['uno'];
  const S = V.S;
  const { colorMap, COLOR_BTN_SIZE, colorChoiceRects, unoColors, COLOR_BTN_GAP, CANVAS_H, CANVAS_W, swapChoiceRects, settingsRects, NUM_PLAYERS } = V;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  /* ================================================================
     DRAWING HELPERS
     ================================================================ */

  function drawUnoCard(x, y, w, h, card) {
    const isWild = card.type === 'wild' && card.color === 'wild';
    const label = card.value === 'Wild Draw Four' ? '+4' : card.value === 'Wild' ? 'W' : card.value === 'Draw Two' ? '+2' : card.value === 'Draw Six' ? '+6' : card.value === 'Draw Ten' ? '+10' : card.value === 'Skip' ? '\u2298' : card.value === 'Reverse' ? '\u21C4' : card.value;
    CE.drawColorCard(S._ctx, x, y, w, h, { color: isWild ? 'wild' : card.color, label, wild: card.type === 'wild' }, card);
  }


  /* ================================================================
     COLOR CHOICE OVERLAY
     ================================================================ */

  function drawColorChoiceOverlay() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Choose a color:', CANVAS_W / 2, CANVAS_H / 2 - 60);

    colorChoiceRects.length = 0;
    const totalW = unoColors.length * COLOR_BTN_SIZE + (unoColors.length - 1) * COLOR_BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 15;

    for (let i = 0; i < unoColors.length; ++i) {
      const x = startX + i * (COLOR_BTN_SIZE + COLOR_BTN_GAP);
      const col = unoColors[i];
      S._ctx.fillStyle = colorMap[col];
      CE.drawRoundedRect(S._ctx, x, y, COLOR_BTN_SIZE, COLOR_BTN_SIZE, 8);
      S._ctx.fill();
      S._ctx.strokeStyle = '#fff';
      S._ctx.lineWidth = 2;
      S._ctx.stroke();

      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 12px sans-serif';
      S._ctx.fillText(col[0].toUpperCase() + col.slice(1), x + COLOR_BTN_SIZE / 2, y + COLOR_BTN_SIZE / 2);

      colorChoiceRects.push({ x, y, w: COLOR_BTN_SIZE, h: COLOR_BTN_SIZE, color: col });
    }
    S._ctx.restore();
  }

  /* ================================================================
     SEVEN-SWAP CHOICE OVERLAY
     ================================================================ */

  function drawSwapChoiceOverlay() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Swap hands with:', CANVAS_W / 2, CANVAS_H / 2 - 50);

    swapChoiceRects.length = 0;
    const btnW = 120;
    const btnH = 40;
    const gap = 20;
    const targets = [];
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (p !== S.swapChoicePlayer && !PL.isFinished(S, p))
        targets.push(p);
    const totalW = targets.length * btnW + (targets.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2;

    for (let i = 0; i < targets.length; ++i) {
      const x = startX + i * (btnW + gap);
      const p = targets[i];
      const label = p === 0 ? 'You' : 'AI ' + p + ' (' + S.unoHands[p].length + ')';
      S._ctx.fillStyle = '#4a4';
      CE.drawRoundedRect(S._ctx, x, y, btnW, btnH, 6);
      S._ctx.fill();
      S._ctx.strokeStyle = '#fff';
      S._ctx.lineWidth = 1;
      S._ctx.stroke();
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.fillText(label, x + btnW / 2, y + btnH / 2);
      swapChoiceRects.push({ x, y, w: btnW, h: btnH, target: p });
    }
    S._ctx.restore();
  }

  /* ================================================================
     HOUSE RULES SETTINGS OVERLAY
     ================================================================ */

  function drawSettingsOverlay() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.7)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const bw = 380;
    const bh = 370;
    const bx = (CANVAS_W - bw) / 2;
    const by = (CANVAS_H - bh) / 2;

    S._ctx.fillStyle = '#1a3a1a';
    S._ctx.strokeStyle = '#4a4';
    S._ctx.lineWidth = 2;
    CE.drawRoundedRect(S._ctx, bx, by, bw, bh, 10);
    S._ctx.fill();
    S._ctx.stroke();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Uno House Rules', CANVAS_W / 2, by + 28);

    const rules = [
      { key: 'stackPlus4', label: 'Stack +4 on +4' },
      { key: 'stackPlus2OnPlus4', label: 'Stack +2 on +4' },
      { key: 'stackPlus2', label: 'Stack +2 on +2' },
      { key: 'wildOnWild', label: 'Wild on Wild' },
      { key: 'noMercy', label: 'No Mercy (+6, +10, all stacking)' },
      { key: 'zeroRotate', label: 'Zero rotates all hands' },
      { key: 'sevenSwap', label: 'Seven swaps hands' },
      { key: 'jumpIn', label: 'Jump-In (exact match out of turn)' },
    ];

    S._ctx.font = '13px sans-serif';
    S._ctx.textAlign = 'left';

    settingsRects.length = 0;
    for (let i = 0; i < rules.length; ++i) {
      const rx = bx + 30;
      const ry = by + 58 + i * 32;
      const checked = S.houseRules[rules[i].key];

      S._ctx.strokeStyle = '#fff';
      S._ctx.lineWidth = 1.5;
      S._ctx.fillStyle = checked ? '#4a4' : '#333';
      S._ctx.fillRect(rx, ry, 18, 18);
      S._ctx.strokeRect(rx, ry, 18, 18);
      if (checked) {
        S._ctx.strokeStyle = '#fff';
        S._ctx.lineWidth = 2;
        S._ctx.beginPath();
        S._ctx.moveTo(rx + 3, ry + 9);
        S._ctx.lineTo(rx + 7, ry + 14);
        S._ctx.lineTo(rx + 15, ry + 4);
        S._ctx.stroke();
      }

      S._ctx.fillStyle = '#fff';
      S._ctx.fillText(rules[i].label, rx + 28, ry + 13);
      settingsRects.push({ x: rx, y: ry, w: 200, h: 18, key: rules[i].key });
    }

    // Close button
    const closeX = bx + bw / 2 - 40;
    const closeY = by + bh - 44;
    S._ctx.fillStyle = '#4a4';
    CE.drawRoundedRect(S._ctx, closeX, closeY, 80, 28, 4);
    S._ctx.fill();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Close', closeX + 40, closeY + 15);
    settingsRects.push({ x: closeX, y: closeY, w: 80, h: 28, key: '_close' });

    S._ctx.restore();
  }

  /* ================================================================
     DRAW
     ================================================================ */

  function drawUno() {
    if (S.unoTopCard)
      drawUnoCard(CANVAS_W / 2 - CE.CARD_W / 2, 240, CE.CARD_W, CE.CARD_H, S.unoTopCard);
    CE.drawCardBack(S._ctx, CANVAS_W / 2 - CE.CARD_W - 20, 240, CE.CARD_W, CE.CARD_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('' + S.unoDeck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 20, 350);

    // Draw stack indicator
    if (S.drawStack > 0) {
      S._ctx.fillStyle = '#f44';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.fillText('Stack: +' + S.drawStack, CANVAS_W / 2, 230);
    }

    for (let i = 0; i < S.unoHands[0].length; ++i) {
      if (S.unoHands[0][i]._dealing) continue;
      const x = 80 + i * 55;
      drawUnoCard(x, 440, CE.CARD_W, CE.CARD_H, S.unoHands[0][i]);
      if (S._host && S._host.hintsEnabled && S.unoCurrentPlayer === 0 && !S.waitingForColorChoice && !S.waitingForSwapChoice && !S.roundOver && !S.gameOver && V.canPlayUno(S.unoHands[0][i], S.unoTopCard))
        CE.drawHintGlow(S._ctx, x, 440, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }
    PL.drawPlaceBadge(S._ctx, S, 0, 80 + CE.CARD_W / 2, 440 + CE.CARD_H / 2, 'center', 26);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    for (let p = 1; p < S.unoHands.length; ++p) {
      const y = 20 + (p - 1) * 120;
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText('AI ' + p + ' (' + S.unoHands[p].length + ' cards)', 60, y + CE.CARD_H + 15);
      if (PL.drawPlaceBadge(S._ctx, S, p, 60, y + CE.CARD_H * 0.3, 'left', 22)) continue;
      for (let i = 0; i < Math.min(S.unoHands[p].length, 7); ++i)
        CE.drawCardBack(S._ctx, 60 + i * 20, y, CE.CARD_W * 0.6, CE.CARD_H * 0.6);
    }

    // Settings button
    S._ctx.fillStyle = '#888';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('\u2699 Rules', CANVAS_W - 12, 18);

    if (!S.roundOver && !S.gameOver && S.unoCurrentPlayer === 0 && !S.waitingForColorChoice) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your turn \u2014 click a card to play, or click deck to draw', CANVAS_W / 2, CANVAS_H - 15);
    }
    PL.drawFinishedStatus(S._ctx, S, CANVAS_W / 2, CANVAS_H - 15);

    if (S.waitingForColorChoice)
      drawColorChoiceOverlay();

    if (S.waitingForSwapChoice)
      drawSwapChoiceOverlay();

    if (S.showingSettings)
      drawSettingsOverlay();
  }

  Object.assign(V, { drawUno });

})();
