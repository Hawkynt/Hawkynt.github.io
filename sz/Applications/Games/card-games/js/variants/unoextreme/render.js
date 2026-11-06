/* Uno Extreme: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoextreme'];
  const S = V.S;
  const { colorMap, colorChoiceRects, unoColors, CANVAS_H, CANVAS_W, targetChoiceRects, NUM_PLAYERS, playerPos } = V;

  function drawExtremeCard(x, y, w, h, card) {
    S._ctx.save();
    const isWild = (card.type === 'wild' || card.type === 'extreme') && card.color === 'wild';
    S._ctx.fillStyle = isWild ? '#000' : (colorMap[card.color] || '#000');
    S._ctx.strokeStyle = '#fff';
    S._ctx.lineWidth = 1;
    CE.drawRoundedRect(S._ctx, x, y, w, h, CE.CARD_RADIUS);
    S._ctx.fill();
    S._ctx.stroke();

    if (card.type === 'extreme') {
      // Rainbow gradient for extreme cards
      const grad = S._ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#e33');
      grad.addColorStop(0.25, '#ea0');
      grad.addColorStop(0.5, '#3a3');
      grad.addColorStop(0.75, '#33e');
      grad.addColorStop(1, '#e33');
      S._ctx.save();
      S._ctx.beginPath();
      CE.drawRoundedRect(S._ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      S._ctx.clip();
      S._ctx.fillStyle = grad;
      S._ctx.fillRect(x, y, w, h);
      S._ctx.restore();
      S._ctx.fillStyle = 'rgba(0,0,0,0.4)';
      CE.drawRoundedRect(S._ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      S._ctx.fill();
    } else if (isWild) {
      const hw = w / 2, hh = h / 2;
      S._ctx.save();
      S._ctx.beginPath();
      CE.drawRoundedRect(S._ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      S._ctx.clip();
      S._ctx.fillStyle = '#e33'; S._ctx.fillRect(x, y, hw, hh);
      S._ctx.fillStyle = '#33e'; S._ctx.fillRect(x + hw, y, hw, hh);
      S._ctx.fillStyle = '#ea0'; S._ctx.fillRect(x, y + hh, hw, hh);
      S._ctx.fillStyle = '#3a3'; S._ctx.fillRect(x + hw, y + hh, hw, hh);
      S._ctx.restore();
      S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
      CE.drawRoundedRect(S._ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      S._ctx.fill();
    } else {
      S._ctx.fillStyle = 'rgba(255,255,255,0.3)';
      S._ctx.beginPath();
      S._ctx.ellipse(x + w / 2, y + h / 2, w / 3, h / 2.5, -0.3, 0, Math.PI * 2);
      S._ctx.fill();
    }

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    const label = card.value === 'Wild Draw Four' ? '+4' : card.value === 'Wild' ? 'W' : card.value === 'Draw Two' ? '+2' : card.value === 'Extreme Hit' ? 'EX!' : card.value;
    S._ctx.fillText(label, x + w / 2, y + h / 2);
    S._ctx.restore();
  }

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
    const totalW = 4 * 60 + 3 * 12;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 15;
    for (let i = 0; i < 4; ++i) {
      const x = startX + i * 72;
      const col = unoColors[i];
      S._ctx.fillStyle = colorMap[col];
      CE.drawRoundedRect(S._ctx, x, y, 60, 60, 8);
      S._ctx.fill();
      S._ctx.strokeStyle = '#fff';
      S._ctx.lineWidth = 2;
      S._ctx.stroke();
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 12px sans-serif';
      S._ctx.fillText(col[0].toUpperCase() + col.slice(1), x + 30, y + 30);
      colorChoiceRects.push({ x, y, w: 60, h: 60, color: col });
    }
    S._ctx.restore();
  }

  function drawTargetChoiceOverlay() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Choose target for Extreme Hit:', CANVAS_W / 2, CANVAS_H / 2 - 60);
    targetChoiceRects.length = 0;
    const targets = [];
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (p !== S.pendingWildPlayer) targets.push(p);
    const btnW = 110, gap = 15;
    const totalW = targets.length * btnW + (targets.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2;
    for (let i = 0; i < targets.length; ++i) {
      const x = startX + i * (btnW + gap);
      const p = targets[i];
      S._ctx.fillStyle = '#4a4';
      CE.drawRoundedRect(S._ctx, x, y, btnW, 36, 6);
      S._ctx.fill();
      S._ctx.strokeStyle = '#fff';
      S._ctx.lineWidth = 1;
      S._ctx.stroke();
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 12px sans-serif';
      S._ctx.fillText((p === 0 ? 'You' : 'AI ' + p) + ' (' + S.hands[p].length + ')', x + btnW / 2, y + 18);
      targetChoiceRects.push({ x, y, w: btnW, h: 36, target: p });
    }
    S._ctx.restore();
  }

  function drawGame() {
    // Top card
    if (S.topCard) drawExtremeCard(CANVAS_W / 2 - CE.CARD_W / 2, 240, CE.CARD_W, CE.CARD_H, S.topCard);
    // Draw pile
    CE.drawCardBack(S._ctx, CANVAS_W / 2 - CE.CARD_W - 20, 240, CE.CARD_W, CE.CARD_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('' + S.deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 20, 350);

    // Launcher button
    const lx = CANVAS_W / 2 + CE.CARD_W + 20;
    const ly = 255;
    const lw = 70, lh = 50;
    const lScale = 1 + (S.launcherAnim > 0 ? Math.sin(S.launcherAnim * Math.PI * 4) * 0.1 : 0);
    S._ctx.save();
    S._ctx.translate(lx + lw / 2, ly + lh / 2);
    S._ctx.scale(lScale, lScale);
    S._ctx.fillStyle = '#d44';
    CE.drawRoundedRect(S._ctx, -lw / 2, -lh / 2, lw, lh, 8);
    S._ctx.fill();
    S._ctx.strokeStyle = '#fff';
    S._ctx.lineWidth = 2;
    S._ctx.stroke();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('LAUNCHER', 0, 0);
    S._ctx.restore();

    // Player hand
    for (let i = 0; i < S.hands[0].length; ++i) {
      if (S.hands[0][i]._dealing) continue;
      drawExtremeCard(80 + i * 55, 440, CE.CARD_W, CE.CARD_H, S.hands[0][i]);
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && !S.waitingForColorChoice && !S.waitingForTargetChoice && !S.roundOver && !S.gameOver && V.canPlay(S.hands[0][i]))
        CE.drawHintGlow(S._ctx, 80 + i * 55, 440, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }

    // AI hands
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pp = playerPos[p];
      S._ctx.fillStyle = S.currentPlayer === p ? '#ff0' : '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(pp.label + ' (' + S.hands[p].length + ')', pp.x, pp.y - 8);
      for (let i = 0; i < Math.min(S.hands[p].length, 7); ++i)
        CE.drawCardBack(S._ctx, pp.x - 30 + i * 18, pp.y + 4, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Direction
    S._ctx.fillStyle = '#888';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.direction === 1 ? '\u21BB' : '\u21BA', CANVAS_W / 2, 225);

    if (!S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.waitingForColorChoice && !S.waitingForTargetChoice) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your turn \u2014 play a card or click Launcher', CANVAS_W / 2, CANVAS_H - 15);
    }

    if (S.waitingForColorChoice) drawColorChoiceOverlay();
    if (S.waitingForTargetChoice) drawTargetChoiceOverlay();
  }

  Object.assign(V, { drawGame });

})();
