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
   *  DRAWING - Card Back (theme design; the sprite cache wraps this)
   * ================================================================ */

  function drawCardBack(cx, x, y, w, h) {
    const CT = SZ.CardThemes;
    const design = CT && CT.CARD_BACK_DESIGNS && (CT.CARD_BACK_DESIGNS[CT.activeTheme.cardBack] || CT.CARD_BACK_DESIGNS.navy_diamonds);
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    if (design) {
      design.draw(cx, x, y, cw, ch);
      return;
    }
    drawRoundedRect(cx, x, y, cw, ch, CE.CARD_RADIUS);
    cx.fillStyle = '#1a237e';
    cx.fill();
  }

  /* ================================================================
   *  DRAWING - Slots, highlights, hint glow
   * ================================================================ */

  function drawEmptySlot(cx, x, y, label, w, h) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H) + 1;
    drawRoundedRect(cx, x, y, cw, ch, cr);
    cx.fillStyle = 'rgba(0,0,0,0.22)';
    cx.fill();
    drawRoundedRect(cx, x + 1.5, y + 1.5, cw - 3, ch - 3, Math.max(1, cr - 1));
    cx.strokeStyle = 'rgba(255,236,170,0.32)';
    cx.lineWidth = 1.4;
    cx.setLineDash && cx.setLineDash([5, 4]);
    cx.stroke();
    cx.setLineDash && cx.setLineDash([]);

    if (label) {
      const fontSize = Math.round(28 * Math.min(cw / CE.CARD_W, ch / CE.CARD_H));
      cx.font = fontSize + 'px Georgia, serif';
      cx.fillStyle = 'rgba(255,240,200,0.3)';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(label, x + cw / 2, y + ch / 2);
    }
  }

  function drawSelectionHighlight(cx, x, y, h, w) {
    const cw = w || CE.CARD_W;
    const cr = CE.CARD_RADIUS * (cw / CE.CARD_W) + 1;
    cx.save();
    drawRoundedRect(cx, x - 3, y - 3, cw + 6, h + 6, cr + 3);
    cx.strokeStyle = 'rgba(120,220,255,0.35)';
    cx.lineWidth = 5;
    cx.stroke();
    drawRoundedRect(cx, x - 1, y - 1, cw + 2, h + 2, cr + 1);
    cx.strokeStyle = '#8fe3ff';
    cx.lineWidth = 2;
    cx.stroke();
    cx.restore();
  }

  function drawHintGlow(cx, x, y, w, h, time) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * (cw / CE.CARD_W) + 1;
    const pulse = 0.5 + 0.5 * Math.sin((time || 0) * 4);
    cx.save();
    drawRoundedRect(cx, x - 4, y - 4, cw + 8, ch + 8, cr + 4);
    cx.strokeStyle = 'rgba(255, 210, 60, ' + (0.12 + 0.18 * pulse) + ')';
    cx.lineWidth = 6;
    cx.stroke();
    drawRoundedRect(cx, x - 1.5, y - 1.5, cw + 3, ch + 3, cr + 1.5);
    cx.strokeStyle = 'rgba(255, 226, 110, ' + (0.55 + 0.4 * pulse) + ')';
    cx.lineWidth = 2;
    cx.stroke();
    cx.restore();
  }

  /* ================================================================
   *  DRAWING - Green Felt Background
   * ================================================================ */

  function drawFelt(cx, w, h) {
    cx.fillStyle = CE.GREEN;
    cx.fillRect(0, 0, w, h);
  }

  /* ================================================================
   *  RECYCLE SYMBOL (for empty stock piles)
   * ================================================================ */

  function drawRecycleSymbol(cx, x, y, w, h) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    drawEmptySlot(cx, x, y, null, cw, ch);
    const centerX = x + cw / 2;
    const centerY = y + ch / 2;
    const r = 16 * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    cx.strokeStyle = 'rgba(255,236,170,0.5)';
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
   *  DRAWING - Button (glossy, lifts under the pointer)
   * ================================================================ */

  CE.pointer = { x: -1, y: -1 };

  function shadeColor(c, amt) {
    return CE.art && CE.art.shade && /^#/.test(c) ? CE.art.shade(c, amt) : c;
  }

  function drawButton(cx, x, y, w, h, label, opts) {
    const bg = (opts && opts.bg) || '#1a3a1a';
    const border = (opts && opts.border) || '#4a4';
    const textColor = (opts && opts.textColor) || '#fff';
    const fontSize = (opts && opts.fontSize) || 14;
    const p = CE.pointer;
    const hover = p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    const r = Math.min(8, h * 0.3);
    const lift = hover ? 1 : 0;
    drawRoundedRect(cx, x, y + 2, w, h, r);
    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.fill();
    drawRoundedRect(cx, x, y - lift, w, h, r);
    if (/^#/.test(bg)) {
      const g = cx.createLinearGradient(0, y - lift, 0, y - lift + h);
      g.addColorStop(0, shadeColor(bg, hover ? 0.38 : 0.24));
      g.addColorStop(0.55, shadeColor(bg, hover ? 0.1 : 0));
      g.addColorStop(1, shadeColor(bg, -0.32));
      cx.fillStyle = g;
    } else
      cx.fillStyle = bg;
    cx.fill();
    cx.strokeStyle = hover ? '#ffe7a0' : border;
    cx.lineWidth = 1.5;
    cx.stroke();
    drawRoundedRect(cx, x + 2, y - lift + 2, w - 4, h * 0.42, Math.max(1, r - 2));
    cx.fillStyle = 'rgba(255,255,255,0.13)';
    cx.fill();
    cx.font = 'bold ' + fontSize + 'px "Segoe UI", "Trebuchet MS", Arial, sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle = 'rgba(0,0,0,0.5)';
    cx.fillText(label, x + w / 2 + 0.5, y - lift + h / 2 + 1.5);
    cx.fillStyle = textColor;
    cx.fillText(label, x + w / 2, y - lift + h / 2);
  }

  function drawCardFace(cx, x, y, card, w, h) {
    CE.art.drawFace(cx, x, y, card, w || CE.CARD_W, h || CE.CARD_H);
  }

  function drawCard(cx, x, y, card, w, h) {
    if (card.faceUp)
      CE.drawCardFace(cx, x, y, card, w, h);
    else
      CE.drawCardBack(cx, x, y, w, h);
  }

  Object.assign(CE, {
    // Drawing primitives
    drawRoundedRect,
    drawSuitSymbol,
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
