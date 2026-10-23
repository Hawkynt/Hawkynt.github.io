;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;

  /* ================================================================
   *  DRAWING - Rounded Rectangle
   * ================================================================ */

  function drawRoundedRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.arcTo(x + w, y, x + w, y + r, r);
    cx.lineTo(x + w, y + h - r);
    cx.arcTo(x + w, y + h, x + w - r, y + h, r);
    cx.lineTo(x + r, y + h);
    cx.arcTo(x, y + h, x, y + h - r, r);
    cx.lineTo(x, y + r);
    cx.arcTo(x, y, x + r, y, r);
    cx.closePath();
  }

  /* ================================================================
   *  DRAWING - Suit Symbols
   * ================================================================ */

  function drawSuitSymbol(cx, suit, x, y, size) {
    const CT = SZ.CardThemes;
    if (CT) {
      const tpl = CT.CARD_FACE_TEMPLATES[CT.activeTheme.cardFace];
      if (tpl && tpl.drawSuit) {
        tpl.drawSuit(cx, suit, x, y, size);
        return;
      }
    }
    const resolved = CE.resolveSuit(suit);
    const hs = size / 2;
    cx.save();
    cx.translate(x, y);
    cx.beginPath();

    switch (resolved) {
      case 'hearts': {
        const w = hs;
        const h = hs;
        cx.moveTo(0, h * 0.4);
        cx.bezierCurveTo(-w * 0.1, -h * 0.1, -w, -h * 0.3, -w, h * 0.05);
        cx.bezierCurveTo(-w, h * 0.55, -w * 0.2, h * 0.7, 0, h);
        cx.bezierCurveTo(w * 0.2, h * 0.7, w, h * 0.55, w, h * 0.05);
        cx.bezierCurveTo(w, -h * 0.3, w * 0.1, -h * 0.1, 0, h * 0.4);
        break;
      }
      case 'diamonds': {
        cx.moveTo(0, -hs);
        cx.lineTo(hs * 0.6, 0);
        cx.lineTo(0, hs);
        cx.lineTo(-hs * 0.6, 0);
        cx.closePath();
        break;
      }
      case 'spades': {
        const w = hs;
        const h = hs;
        cx.moveTo(0, -h);
        cx.bezierCurveTo(-w * 0.2, -h * 0.7, -w, -h * 0.55, -w, -h * 0.05);
        cx.bezierCurveTo(-w, h * 0.3, -w * 0.1, h * 0.1, 0, -h * 0.15);
        cx.bezierCurveTo(w * 0.1, h * 0.1, w, h * 0.3, w, -h * 0.05);
        cx.bezierCurveTo(w, -h * 0.55, w * 0.2, -h * 0.7, 0, -h);
        cx.closePath();
        cx.fill();
        cx.beginPath();
        cx.moveTo(-hs * 0.15, -h * 0.1);
        cx.lineTo(-hs * 0.3, h);
        cx.lineTo(hs * 0.3, h);
        cx.lineTo(hs * 0.15, -h * 0.1);
        cx.closePath();
        break;
      }
      case 'clubs': {
        const r = hs * 0.38;
        cx.arc(0, -hs * 0.4, r, 0, Math.PI * 2);
        cx.closePath();
        cx.moveTo(-hs * 0.4 + r, hs * 0.05);
        cx.arc(-hs * 0.4, hs * 0.05, r, 0, Math.PI * 2);
        cx.closePath();
        cx.moveTo(hs * 0.4 + r, hs * 0.05);
        cx.arc(hs * 0.4, hs * 0.05, r, 0, Math.PI * 2);
        cx.closePath();
        cx.fill();
        cx.beginPath();
        cx.moveTo(-hs * 0.15, hs * 0.05);
        cx.lineTo(-hs * 0.3, hs);
        cx.lineTo(hs * 0.3, hs);
        cx.lineTo(hs * 0.15, hs * 0.05);
        cx.closePath();
        break;
      }
    }

    cx.fill();
    cx.restore();
  }

  /* ================================================================
   *  DRAWING - Pips
   * ================================================================ */

  function drawPips(cx, card, x, y, w, h) {
    const color = CE.resolveSuitColor(card.suit);
    const rankNum = (card.value != null ? card.value : CE.RANKS.indexOf(card.rank)) + 1;

    const pipLeft = x + 12;
    const pipTop = y + 24;
    const pipW = w - 24;
    const pipH = h - 48;

    cx.fillStyle = color;

    if (rankNum === 1) {
      drawSuitSymbol(cx, card.suit, pipLeft + pipW * 0.5, pipTop + pipH * 0.5, 28);
      return;
    }

    const layout = CE.PIP_LAYOUTS[rankNum];
    if (!layout)
      return;

    const pipSize = 13;

    for (const [relX, relY] of layout) {
      const px = pipLeft + pipW * relX;
      const py = pipTop + pipH * relY;

      if (relY > 0.5) {
        cx.save();
        cx.translate(px, py);
        cx.rotate(Math.PI);
        drawSuitSymbol(cx, card.suit, 0, 0, pipSize);
        cx.restore();
      } else
        drawSuitSymbol(cx, card.suit, px, py, pipSize);
    }
  }

  /* ================================================================
   *  DRAWING - Face Card Center
   * ================================================================ */

  function drawFaceCardCenter(cx, x, y, card, cw, ch) {
    const w0 = cw || CE.CARD_W;
    const h0 = ch || CE.CARD_H;
    const color = CE.resolveSuitColor(card.suit);
    const centerX = x + w0 / 2;
    const centerY = y + h0 / 2;
    const scaleX = w0 / CE.CARD_W;
    const scaleY = h0 / CE.CARD_H;
    const frameW = 40 * scaleX;
    const frameH = 52 * scaleY;

    drawRoundedRect(cx, centerX - frameW / 2, centerY - frameH / 2, frameW, frameH, 3);
    cx.fillStyle = color === '#d00' ? '#ffe8e8' : '#e8e8f0';
    cx.fill();
    cx.strokeStyle = color;
    cx.lineWidth = 2;
    cx.stroke();

    drawRoundedRect(cx, centerX - frameW / 2 + 3, centerY - frameH / 2 + 3, frameW - 6, frameH - 6, 2);
    cx.strokeStyle = color;
    cx.lineWidth = 0.5;
    cx.stroke();

    let displayRank = card.rank;
    const CT = SZ.CardThemes;
    if (CT) {
      const tpl = CT.CARD_FACE_TEMPLATES[CT.activeTheme.cardFace];
      if (tpl && tpl.rankLabels && tpl.rankLabels[card.rank])
        displayRank = tpl.rankLabels[card.rank];
    }

    const fontSize = Math.round(24 * Math.min(scaleX, scaleY));
    cx.font = 'bold ' + fontSize + 'px serif';
    cx.fillStyle = color;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(displayRank, centerX, centerY - 4 * scaleY);

    cx.fillStyle = color;
    drawSuitSymbol(cx, card.suit, centerX, centerY + 16 * scaleY, 12 * Math.min(scaleX, scaleY));
  }

  /* ================================================================
   *  DRAWING - Card Face
   * ================================================================ */

  function drawCardFace(cx, x, y, card, w, h) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    drawRoundedRect(cx, x, y, cw, ch, cr);

    let cardBg = '#fff';
    let displayRank = card.rank;
    const CT = SZ.CardThemes;
    if (CT) {
      const tpl = CT.CARD_FACE_TEMPLATES[CT.activeTheme.cardFace];
      if (tpl) {
        if (tpl.cardBg) cardBg = tpl.cardBg;
        if (tpl.rankLabels && tpl.rankLabels[card.rank])
          displayRank = tpl.rankLabels[card.rank];
      }
    }

    cx.fillStyle = cardBg;
    cx.fill();
    cx.strokeStyle = '#333';
    cx.lineWidth = 1;
    cx.stroke();

    const color = CE.resolveSuitColor(card.suit);
    const sx = cw / CE.CARD_W;
    const sy = ch / CE.CARD_H;
    const ss = Math.min(sx, sy);

    const fontSize = Math.round(13 * ss);
    cx.font = 'bold ' + fontSize + 'px serif';
    cx.fillStyle = color;
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText(displayRank, x + 4 * sx, y + 4 * sy);

    cx.fillStyle = color;
    drawSuitSymbol(cx, card.suit, x + 8 * sx, y + 24 * sy, 8 * ss);

    cx.save();
    cx.translate(x + cw - 4 * sx, y + ch - 4 * sy);
    cx.rotate(Math.PI);
    cx.font = 'bold ' + fontSize + 'px serif';
    cx.fillStyle = color;
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText(displayRank, 0, 0);
    cx.restore();

    cx.save();
    cx.translate(x + cw - 8 * sx, y + ch - 24 * sy);
    cx.rotate(Math.PI);
    cx.fillStyle = color;
    drawSuitSymbol(cx, card.suit, 0, 0, 8 * ss);
    cx.restore();

    cx.fillStyle = color;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K')
      drawFaceCardCenter(cx, x, y, card, cw, ch);
    else
      drawPips(cx, card, x, y, cw, ch);
  }

  /* ================================================================
   *  DRAWING - Card Back
   * ================================================================ */

  function drawCardBack(cx, x, y, w, h) {
    const CT = SZ.CardThemes;
    if (CT) {
      const design = CT.CARD_BACK_DESIGNS[CT.activeTheme.cardBack];
      if (design) {
        design.draw(cx, x, y, w || CE.CARD_W, h || CE.CARD_H);
        return;
      }
    }
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    drawRoundedRect(cx, x, y, cw, ch, cr);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#333';
    cx.lineWidth = 1;
    cx.stroke();

    const m = 3;
    drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
    cx.fillStyle = '#1a237e';
    cx.fill();

    cx.strokeStyle = '#3949ab';
    cx.lineWidth = 0.5;
    const step = 8;
    cx.save();
    cx.beginPath();
    drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
    cx.clip();
    for (let dy = y + m; dy < y + ch - m; dy += step) {
      for (let dx = x + m; dx < x + cw - m; dx += step) {
        const cx2 = dx + step / 2;
        const cy2 = dy + step / 2;
        cx.beginPath();
        cx.moveTo(cx2, cy2 - step / 2 + 1);
        cx.lineTo(cx2 + step / 2 - 1, cy2);
        cx.lineTo(cx2, cy2 + step / 2 - 1);
        cx.lineTo(cx2 - step / 2 + 1, cy2);
        cx.closePath();
        cx.stroke();
      }
    }
    cx.restore();

    drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
    cx.strokeStyle = '#c5cae9';
    cx.lineWidth = 1;
    cx.stroke();
  }

  /* ================================================================
   *  DRAWING - Card (face up or back) / Empty Slot / Selection
   * ================================================================ */

  function drawCard(cx, x, y, card, w, h) {
    if (card.faceUp)
      drawCardFace(cx, x, y, card, w, h);
    else
      drawCardBack(cx, x, y, w, h);
  }

  function drawEmptySlot(cx, x, y, label, w, h) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    drawRoundedRect(cx, x, y, cw, ch, cr);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();

    if (label) {
      const fontSize = Math.round(28 * Math.min(cw / CE.CARD_W, ch / CE.CARD_H));
      cx.font = fontSize + 'px serif';
      cx.fillStyle = 'rgba(255,255,255,0.3)';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(label, x + cw / 2, y + ch / 2);
    }
  }

  function drawSelectionHighlight(cx, x, y, h, w) {
    const cw = w || CE.CARD_W;
    const cr = CE.CARD_RADIUS * (cw / CE.CARD_W);
    cx.save();
    cx.strokeStyle = '#ffff00';
    cx.lineWidth = 3;
    cx.shadowColor = '#ffff00';
    cx.shadowBlur = 6;
    drawRoundedRect(cx, x - 1, y - 1, cw + 2, h + 2, cr + 1);
    cx.stroke();
    cx.restore();
  }

  function drawHintGlow(cx, x, y, w, h, time) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * (cw / CE.CARD_W);
    const pulse = 0.4 + 0.3 * Math.sin((time || 0) * 4);
    cx.save();
    cx.strokeStyle = 'rgba(255, 255, 0, ' + pulse + ')';
    cx.lineWidth = 2;
    cx.shadowColor = '#ffff00';
    cx.shadowBlur = 4 + 3 * Math.sin((time || 0) * 4);
    drawRoundedRect(cx, x - 1, y - 1, cw + 2, ch + 2, cr + 1);
    cx.stroke();
    cx.restore();
  }

  /* ================================================================
   *  DRAWING - Green Felt Background
   * ================================================================ */

  function drawFelt(cx, w, h) {
    cx.fillStyle = CE.GREEN;
    cx.fillRect(0, 0, w, h);
    cx.fillStyle = CE.DARK_GREEN;
    cx.fillRect(0, 0, w, 2);
    cx.fillRect(0, 0, 2, h);
  }

  /* ================================================================
   *  RECYCLE SYMBOL (for empty stock piles)
   * ================================================================ */

  function drawRecycleSymbol(cx, x, y, w, h) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    drawRoundedRect(cx, x, y, cw, ch, cr);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();

    const centerX = x + cw / 2;
    const centerY = y + ch / 2;
    const r = 16;

    cx.strokeStyle = 'rgba(255,255,255,0.35)';
    cx.lineWidth = 3;
    cx.lineCap = 'round';
    cx.beginPath();
    cx.arc(centerX, centerY, r, -Math.PI * 0.7, Math.PI * 0.7);
    cx.stroke();

    const angle = Math.PI * 0.7;
    const ax = centerX + r * Math.cos(angle);
    const ay = centerY + r * Math.sin(angle);
    cx.beginPath();
    cx.moveTo(ax - 6, ay - 3);
    cx.lineTo(ax, ay);
    cx.lineTo(ax - 6, ay + 5);
    cx.stroke();
    cx.lineCap = 'butt';
  }

  /* ================================================================
   *  DRAWING - Button
   * ================================================================ */

  function drawButton(cx, x, y, w, h, label, opts) {
    const bg = (opts && opts.bg) || '#1a3a1a';
    const border = (opts && opts.border) || '#4a4';
    const textColor = (opts && opts.textColor) || '#fff';
    const fontSize = (opts && opts.fontSize) || 14;
    cx.fillStyle = bg;
    cx.strokeStyle = border;
    cx.lineWidth = 2;
    drawRoundedRect(cx, x, y, w, h, 6);
    cx.fill();
    cx.stroke();
    cx.fillStyle = textColor;
    cx.font = 'bold ' + fontSize + 'px sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(label, x + w / 2, y + h / 2);
  }

  Object.assign(CE, {
    // Drawing primitives
    drawRoundedRect,
    drawSuitSymbol,
    drawPips,
    drawFaceCardCenter,
    drawCardFace,
    drawCardBack,
    drawCard,
    drawEmptySlot,
    drawSelectionHighlight,
    drawHintGlow,
    drawRecycleSymbol,
    drawFelt,
    drawButton
  });

})();
