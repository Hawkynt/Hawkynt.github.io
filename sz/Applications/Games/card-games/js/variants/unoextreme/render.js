/* Uno Extreme: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoextreme'];
  const S = V.S;
  const { colorMap, colorChoiceRects, unoColors, CANVAS_H, CANVAS_W, targetChoiceRects, NUM_PLAYERS, playerPos } = V;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function drawExtremeCard(x, y, w, h, card) {
    const isWild = (card.type === 'wild' || card.type === 'extreme') && card.color === 'wild';
    const label = card.value === 'Wild Draw Four' ? '+4' : card.value === 'Wild' ? 'W' : card.value === 'Draw Two' ? '+2' : card.value === 'Extreme Hit' ? 'EX!' : card.value === 'Skip' ? '\u2298' : card.value === 'Reverse' ? '\u21C4' : card.value;
    CE.drawColorCard(S._ctx, x, y, w, h, { color: isWild ? 'wild' : card.color, label, wild: card.type === 'wild', rainbow: card.type === 'extreme', ink: card.type === 'extreme' ? '#ffffff' : undefined }, card);
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
      if (p !== S.pendingWildPlayer && !PL.isFinished(S, p)) targets.push(p);
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

    PL.drawPlaceBadge(S._ctx, S, 0, 80 + CE.CARD_W / 2, 440 + CE.CARD_H / 2, 'center', 26);

    // AI hands
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pp = playerPos[p];
      S._ctx.fillStyle = S.currentPlayer === p ? '#ff0' : '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(pp.label + ' (' + S.hands[p].length + ')', pp.x, pp.y - 8);
      if (PL.drawPlaceBadge(S._ctx, S, p, pp.x, pp.y + 4 + CE.CARD_H * 0.275, 'center', 22)) continue;
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

    PL.drawFinishedStatus(S._ctx, S, CANVAS_W / 2, CANVAS_H - 15);

    if (S.waitingForColorChoice) drawColorChoiceOverlay();
    if (S.waitingForTargetChoice) drawTargetChoiceOverlay();
  }

  Object.assign(V, { drawGame });

})();
