/* 8-Color Duo: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['duo'];
  const S = V.S;
  const { duoColors, colorMap, CANVAS_W, COLOR_BTN_SIZE, colorChoiceRects, COLOR_BTN_GAP, CANVAS_H, NUM_PLAYERS } = V;

  /* ================================================================
     DRAWING HELPERS
     ================================================================ */

  function drawDuoCard(x, y, w, h, card) {
    S._ctx.save();
    const isWild = card.type === 'wild' && card.color === 'wild';
    S._ctx.fillStyle = isWild ? '#000' : (colorMap[card.color] || '#000');
    S._ctx.strokeStyle = '#fff';
    S._ctx.lineWidth = 1;
    CE.drawRoundedRect(S._ctx, x, y, w, h, CE.CARD_RADIUS);
    S._ctx.fill();
    S._ctx.stroke();

    if (isWild) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const radius = Math.min(w, h) * 0.38;
      S._ctx.save();
      S._ctx.beginPath();
      CE.drawRoundedRect(S._ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      S._ctx.clip();
      for (let i = 0; i < 8; ++i) {
        const startAngle = (i * Math.PI / 4) - Math.PI / 8;
        const endAngle = startAngle + Math.PI / 4;
        S._ctx.beginPath();
        S._ctx.moveTo(cx, cy);
        S._ctx.arc(cx, cy, radius, startAngle, endAngle);
        S._ctx.closePath();
        S._ctx.fillStyle = colorMap[duoColors[i]];
        S._ctx.fill();
      }
      S._ctx.restore();
      S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
      CE.drawRoundedRect(S._ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      S._ctx.fill();
    } else {
      S._ctx.fillStyle = 'rgba(255,255,255,0.3)';
      S._ctx.beginPath();
      S._ctx.ellipse(x + w / 2, y + h / 2, w / 3, h / 2.5, -0.3, 0, Math.PI * 2);
      S._ctx.fill();
    }

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    const label = card.value === 'Wild Draw Four' ? '+4'
      : card.value === 'Wild' ? 'W'
      : card.value === 'Draw Two' ? '+2'
      : card.value === 'Skip' ? '\u2298'
      : card.value === 'Reverse' ? '\u21C4'
      : card.value;
    S._ctx.fillText(label, x + w / 2, y + h / 2);
    S._ctx.restore();
  }

  /* ================================================================
     LAYOUT HELPERS
     ================================================================ */

  function getPlayerHandPos(playerIndex) {
    switch (playerIndex) {
      case 0: return { x: 80, y: 440, dx: 55, dy: 0, scale: 1 };
      case 1: return { x: 20, y: 100, dx: 0, dy: 22, scale: 0.6 };
      case 2: return { x: 250, y: 20, dx: 20, dy: 0, scale: 0.6 };
      case 3: return { x: CANVAS_W - 20 - CE.CARD_W * 0.6, y: 100, dx: 0, dy: 22, scale: 0.6 };
      default: return { x: 0, y: 0, dx: 0, dy: 0, scale: 1 };
    }
  }

  function getPlayerLabel(p) {
    if (p === 0) return 'You';
    return 'AI ' + p;
  }

  /* ================================================================
     COLOR CHOICE OVERLAY (4x2 grid of 8 colors)
     ================================================================ */

  function drawColorChoiceOverlay() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.65)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Choose a color:', CANVAS_W / 2, CANVAS_H / 2 - 90);

    colorChoiceRects.length = 0;

    const cols = 4;
    const rows = 2;
    const gridW = cols * COLOR_BTN_SIZE + (cols - 1) * COLOR_BTN_GAP;
    const gridH = rows * COLOR_BTN_SIZE + (rows - 1) * COLOR_BTN_GAP;
    const startX = (CANVAS_W - gridW) / 2;
    const startY = (CANVAS_H - gridH) / 2 - 20;

    for (let i = 0; i < duoColors.length; ++i) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const bx = startX + col * (COLOR_BTN_SIZE + COLOR_BTN_GAP);
      const by = startY + row * (COLOR_BTN_SIZE + COLOR_BTN_GAP);
      const clr = duoColors[i];

      S._ctx.fillStyle = colorMap[clr];
      CE.drawRoundedRect(S._ctx, bx, by, COLOR_BTN_SIZE, COLOR_BTN_SIZE, 8);
      S._ctx.fill();
      S._ctx.strokeStyle = '#fff';
      S._ctx.lineWidth = 2;
      S._ctx.stroke();

      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(clr[0].toUpperCase() + clr.slice(1), bx + COLOR_BTN_SIZE / 2, by + COLOR_BTN_SIZE / 2);

      colorChoiceRects.push({ x: bx, y: by, w: COLOR_BTN_SIZE, h: COLOR_BTN_SIZE, color: clr });
    }
    S._ctx.restore();
  }

  /* ================================================================
     DIRECTION INDICATOR
     ================================================================ */

  function drawDirectionIndicator() {
    S._ctx.save();
    const cx = CANVAS_W / 2 + 80;
    const cy = CANVAS_H / 2 - 10;
    const r = 18;

    S._ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    S._ctx.lineWidth = 2;
    S._ctx.beginPath();
    S._ctx.arc(cx, cy, r, 0, Math.PI * 2);
    S._ctx.stroke();

    S._ctx.strokeStyle = '#fff';
    S._ctx.lineWidth = 2.5;
    const base = S.direction === 1 ? -Math.PI / 2 : Math.PI / 2;
    S._ctx.beginPath();
    S._ctx.arc(cx, cy, r - 2, base - 1.2, base + 1.2);
    S._ctx.stroke();

    const tipAngle = base + 1.2;
    const tipX = cx + (r - 2) * Math.cos(tipAngle);
    const tipY = cy + (r - 2) * Math.sin(tipAngle);
    S._ctx.beginPath();
    S._ctx.moveTo(tipX, tipY);
    S._ctx.lineTo(tipX + 6 * Math.cos(tipAngle + 2.3), tipY + 6 * Math.sin(tipAngle + 2.3));
    S._ctx.moveTo(tipX, tipY);
    S._ctx.lineTo(tipX + 6 * Math.cos(tipAngle - 0.6), tipY + 6 * Math.sin(tipAngle - 0.6));
    S._ctx.stroke();

    S._ctx.fillStyle = 'rgba(255,255,255,0.4)';
    S._ctx.font = '9px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(S.direction === 1 ? 'CW' : 'CCW', cx, cy);
    S._ctx.restore();
  }

  /* ================================================================
     CURRENT PLAYER INDICATOR
     ================================================================ */

  function drawCurrentPlayerIndicator() {
    if (S.roundOver || S.gameOver) return;
    S._ctx.save();
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = 'bold 11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';

    switch (S.currentPlayer) {
      case 0: {
        const handW = S.hands[0].length * 55 + CE.CARD_W;
        S._ctx.fillText('\u25BC', 80 + handW / 2, 432);
        break;
      }
      case 1: {
        const pos = getPlayerHandPos(1);
        S._ctx.fillText('\u25B6', pos.x + CE.CARD_W * pos.scale + 8, pos.y + Math.min(S.hands[1].length, 10) * pos.dy / 2);
        break;
      }
      case 2: {
        const pos = getPlayerHandPos(2);
        S._ctx.fillText('\u25BC', pos.x + Math.min(S.hands[2].length, 10) * pos.dx / 2, pos.y + CE.CARD_H * pos.scale + 8);
        break;
      }
      case 3: {
        const pos = getPlayerHandPos(3);
        S._ctx.fillText('\u25C0', pos.x - 10, pos.y + Math.min(S.hands[3].length, 10) * pos.dy / 2);
        break;
      }
    }
    S._ctx.restore();
  }

  /* ================================================================
     DRAW
     ================================================================ */

  function drawDuo() {
    if (S.topCard)
      drawDuoCard(CANVAS_W / 2 - CE.CARD_W / 2, 240, CE.CARD_W, CE.CARD_H, S.topCard);

    const drawPileX = CANVAS_W / 2 - CE.CARD_W - 30;
    const drawPileY = 240;
    CE.drawCardBack(S._ctx, drawPileX, drawPileY, CE.CARD_W, CE.CARD_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('' + S.deck.length, drawPileX + CE.CARD_W / 2, drawPileY + CE.CARD_H + 14);

    if (S.drawStack > 0) {
      S._ctx.fillStyle = '#f44';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Stack: +' + S.drawStack, CANVAS_W / 2, 230);
    }

    for (let i = 0; i < S.hands[0].length; ++i) {
      if (S.hands[0][i]._dealing) continue;
      const x = 80 + i * 55;
      drawDuoCard(x, 440, CE.CARD_W, CE.CARD_H, S.hands[0][i]);
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && !S.waitingForColorChoice && !S.roundOver && !S.gameOver && V.canPlay(S.hands[0][i], S.topCard))
        CE.drawHintGlow(S._ctx, x, 440, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }

    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pos = getPlayerHandPos(p);
      const count = S.hands[p].length;
      const maxVisible = Math.min(count, 10);

      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '12px sans-serif';

      if (pos.dy === 0) {
        S._ctx.textAlign = 'left';
        S._ctx.fillText(getPlayerLabel(p) + ' (' + count + ')', pos.x, pos.y + CE.CARD_H * pos.scale + 14);
        for (let i = 0; i < maxVisible; ++i)
          CE.drawCardBack(S._ctx, pos.x + i * pos.dx, pos.y, CE.CARD_W * pos.scale, CE.CARD_H * pos.scale);
      } else {
        S._ctx.textAlign = p === 1 ? 'left' : 'right';
        const labelX = p === 1 ? pos.x : pos.x + CE.CARD_W * pos.scale;
        S._ctx.fillText(getPlayerLabel(p) + ' (' + count + ')', labelX, pos.y - 10);
        for (let i = 0; i < maxVisible; ++i)
          CE.drawCardBack(S._ctx, pos.x, pos.y + i * pos.dy, CE.CARD_W * pos.scale, CE.CARD_H * pos.scale);
      }
    }

    drawDirectionIndicator();
    drawCurrentPlayerIndicator();

    if (!S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.waitingForColorChoice) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your turn \u2014 click a card to play, or click deck to draw', CANVAS_W / 2, CANVAS_H - 15);
    }

    if (S.roundOver) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 15);
    }

    if (S.waitingForColorChoice)
      drawColorChoiceOverlay();
  }

  Object.assign(V, { getPlayerLabel, drawDuo });

})();
