/* Card face artwork: paper, corner indices, pip layouts, ornate aces and the
   double-headed court portraits. Drawn once per card into the sprite cache
   (engine/sprites.js), so nothing here runs per frame. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;
  const ART = CE.art = CE.art || {};

  const GOLD = '#d9a520';
  const GOLD_DARK = '#8a6210';
  const SKIN = '#f3cfa6';
  const SKIN_SHADE = '#d9a77c';
  const ROYAL_BLUE = '#1f4d9c';
  const IVORY = '#fff8e8';

  function template() {
    const CT = SZ.CardThemes;
    return CT && CT.CARD_FACE_TEMPLATES ? CT.CARD_FACE_TEMPLATES[CT.activeTheme.cardFace] : null;
  }

  function templateKey() {
    const CT = SZ.CardThemes;
    return CT && CT.activeTheme ? CT.activeTheme.cardFace : 'french';
  }

  function displayRank(rank) {
    const tpl = template();
    return tpl && tpl.rankLabels && tpl.rankLabels[rank] ? tpl.rankLabels[rank] : String(rank == null ? '' : rank);
  }

  function isRed(color) {
    return /^#(d00|c|b|a|e|f)/i.test(color) || color === '#d00';
  }

  /* ── paper ── */
  function drawPaper(cx, x, y, w, h, r, bg) {
    CE.drawRoundedRect(cx, x, y, w, h, r);
    const g = cx.createLinearGradient(x, y, x + w * 0.3, y + h);
    g.addColorStop(0, bg === '#fff' ? '#ffffff' : bg);
    g.addColorStop(1, bg === '#fff' ? '#f1efe8' : shade(bg, -0.06));
    cx.fillStyle = g;
    cx.fill();
    /* faint fibre grain */
    cx.save();
    cx.clip();
    cx.globalAlpha = 0.05;
    cx.fillStyle = '#7a6a50';
    let s = (w * 131 + h * 71) | 0;
    for (let i = 0; i < 40; ++i) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const px = x + (s % 1000) / 1000 * w;
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const py = y + (s % 1000) / 1000 * h;
      cx.fillRect(px, py, 1.2, 0.6);
    }
    cx.restore();
    CE.drawRoundedRect(cx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    cx.strokeStyle = 'rgba(40,30,20,0.55)';
    cx.lineWidth = 1;
    cx.stroke();
  }

  function shade(hex, amt) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    const out = c.map(v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))));
    return '#' + out.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /* ── corner index: rank above a small suit, mirrored bottom-right ── */
  function drawIndex(cx, x, y, w, h, card, color, ss) {
    const label = displayRank(card.rank);
    const fs = Math.max(7, (label.length > 1 ? 13.5 : 15) * ss);
    const lx = x + 9 * ss;
    for (let k = 0; k < 2; ++k) {
      cx.save();
      if (k === 1) {
        cx.translate(x + w, y + h);
        cx.rotate(Math.PI);
        cx.translate(-x, -y);
      }
      cx.fillStyle = color;
      cx.font = 'bold ' + fs.toFixed(1) + 'px Georgia, "Times New Roman", serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      if (label.length > 1) {
        cx.save();
        cx.translate(lx, y + 4 * ss);
        cx.scale(0.78, 1);
        cx.fillText(label, 0, 0);
        cx.restore();
      } else
        cx.fillText(label, lx, y + 4 * ss);
      CE.drawSuitSymbol(cx, card.suit, lx, y + 4 * ss + fs + 5 * ss, 9 * ss);
      cx.restore();
    }
  }

  /* ── pips ── */
  function rankNumber(card) {
    const i = CE.RANKS.indexOf(card.rank);
    if (i >= 0) return i + 1;
    return card.value != null ? card.value + 1 : 0;
  }

  function drawPipsArt(cx, x, y, w, h, card, color, ss) {
    const n = rankNumber(card);
    const left = x + 18 * (w / CE.CARD_W);
    const top = y + 15 * (h / CE.CARD_H);
    const pw = w - 36 * (w / CE.CARD_W);
    const ph = h - 30 * (h / CE.CARD_H);
    const layout = CE.PIP_LAYOUTS[n];
    if (!layout) {
      cx.fillStyle = color;
      cx.font = 'bold ' + (30 * ss).toFixed(1) + 'px Georgia, serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(displayRank(card.rank), x + w / 2, y + h / 2);
      return;
    }
    const size = (n >= 9 ? 13 : 14.5) * ss;
    cx.fillStyle = color;
    for (const [rx, ry] of layout) {
      const px = left + pw * rx;
      const py = top + ph * ry;
      if (ry > 0.5) {
        cx.save();
        cx.translate(px, py);
        cx.rotate(Math.PI);
        CE.drawSuitSymbol(cx, card.suit, 0, 0, size);
        cx.restore();
      } else
        CE.drawSuitSymbol(cx, card.suit, px, py, size);
    }
  }

  /* ── aces: one big suit, the ace of spades gets the traditional filigree ── */
  function drawAce(cx, x, y, w, h, card, color, ss) {
    const mx = x + w / 2, my = y + h / 2;
    const suit = CE.resolveSuit(card.suit);
    if (suit === 'spades') {
      cx.save();
      cx.strokeStyle = shade(color === '#000' ? '#555555' : color, 0.2);
      cx.globalAlpha = 0.55;
      cx.lineWidth = 0.8 * ss;
      for (let i = 0; i < 12; ++i) {
        const a = i / 12 * Math.PI * 2;
        cx.beginPath();
        cx.ellipse(mx + Math.cos(a) * 15 * ss, my + Math.sin(a) * 15 * ss, 9 * ss, 4 * ss, a, 0, Math.PI * 2);
        cx.stroke();
      }
      cx.beginPath();
      cx.arc(mx, my, 26 * ss, 0, Math.PI * 2);
      cx.stroke();
      cx.restore();
    }
    cx.fillStyle = color;
    CE.drawSuitSymbol(cx, card.suit, mx, my, (suit === 'spades' ? 30 : 34) * ss);
  }

  /* ── court cards ── */
  const COURT_STYLE = {
    K: { robe: 'primary', trim: GOLD, item: 'sword', hair: '#6b4a2a', beard: true, crown: 'king' },
    Q: { robe: 'blue', trim: GOLD, item: 'flower', hair: '#c9922e', beard: false, crown: 'queen' },
    J: { robe: 'gold', trim: ROYAL_BLUE, item: 'halberd', hair: '#8a5a2a', beard: false, crown: 'cap' }
  };

  function drawHalfFigure(cx, fw, hh, rank, primary) {
    const st = COURT_STYLE[rank];
    const robeColor = st.robe === 'primary' ? primary : st.robe === 'blue' ? ROYAL_BLUE : GOLD;
    const robeAlt = st.robe === 'gold' ? primary : GOLD;
    const midX = fw / 2;

    /* robe with diagonal stripes */
    cx.beginPath();
    cx.moveTo(midX - fw * 0.36, hh * 0.62);
    cx.quadraticCurveTo(midX - fw * 0.5, hh * 0.8, midX - fw * 0.5, hh * 1.02);
    cx.lineTo(midX + fw * 0.5, hh * 1.02);
    cx.quadraticCurveTo(midX + fw * 0.5, hh * 0.8, midX + fw * 0.36, hh * 0.62);
    cx.closePath();
    cx.fillStyle = robeColor;
    cx.fill();
    cx.save();
    cx.clip();
    cx.strokeStyle = robeAlt;
    cx.lineWidth = fw * 0.05;
    for (let i = -6; i < 8; ++i) {
      cx.beginPath();
      cx.moveTo(midX + i * fw * 0.14, hh * 0.6);
      cx.lineTo(midX + i * fw * 0.14 - fw * 0.3, hh * 1.05);
      cx.stroke();
    }
    /* central placket */
    cx.fillStyle = st.trim;
    cx.fillRect(midX - fw * 0.07, hh * 0.62, fw * 0.14, hh * 0.42);
    cx.fillStyle = IVORY;
    for (let i = 0; i < 3; ++i) {
      cx.beginPath();
      cx.arc(midX, hh * (0.72 + i * 0.1), fw * 0.025, 0, Math.PI * 2);
      cx.fill();
    }
    cx.restore();
    cx.strokeStyle = 'rgba(0,0,0,0.6)';
    cx.lineWidth = 0.8;
    cx.stroke();

    /* ruff collar */
    cx.fillStyle = IVORY;
    cx.strokeStyle = 'rgba(0,0,0,0.45)';
    cx.lineWidth = 0.6;
    for (let i = -3; i <= 3; ++i) {
      cx.beginPath();
      cx.arc(midX + i * fw * 0.065, hh * 0.6, fw * 0.055, 0, Math.PI * 2);
      cx.fill();
      cx.stroke();
    }

    /* held item */
    cx.lineCap = 'round';
    if (st.item === 'sword') {
      const sx = midX + fw * 0.34;
      cx.strokeStyle = '#d8dde6';
      cx.lineWidth = fw * 0.04;
      cx.beginPath(); cx.moveTo(sx, hh * 0.05); cx.lineTo(sx, hh * 0.78); cx.stroke();
      cx.strokeStyle = GOLD_DARK;
      cx.lineWidth = fw * 0.05;
      cx.beginPath(); cx.moveTo(sx - fw * 0.09, hh * 0.72); cx.lineTo(sx + fw * 0.09, hh * 0.72); cx.stroke();
    } else if (st.item === 'flower') {
      const fx = midX - fw * 0.33, fy = hh * 0.42;
      cx.strokeStyle = '#2e7d32';
      cx.lineWidth = fw * 0.025;
      cx.beginPath(); cx.moveTo(fx, fy); cx.quadraticCurveTo(fx + fw * 0.06, hh * 0.6, fx + fw * 0.03, hh * 0.78); cx.stroke();
      for (let i = 0; i < 5; ++i) {
        const a = i / 5 * Math.PI * 2;
        cx.fillStyle = primary === '#000' || primary === '#111' ? '#c62828' : primary;
        cx.beginPath();
        cx.arc(fx + Math.cos(a) * fw * 0.045, fy + Math.sin(a) * fw * 0.045, fw * 0.04, 0, Math.PI * 2);
        cx.fill();
      }
      cx.fillStyle = GOLD;
      cx.beginPath(); cx.arc(fx, fy, fw * 0.03, 0, Math.PI * 2); cx.fill();
    } else {
      const hx = midX - fw * 0.36;
      cx.strokeStyle = '#7a5230';
      cx.lineWidth = fw * 0.03;
      cx.beginPath(); cx.moveTo(hx, hh * 0.02); cx.lineTo(hx, hh * 0.85); cx.stroke();
      cx.fillStyle = '#c9ced6';
      cx.beginPath();
      cx.moveTo(hx, hh * 0.08);
      cx.quadraticCurveTo(hx + fw * 0.16, hh * 0.12, hx + fw * 0.12, hh * 0.28);
      cx.lineTo(hx, hh * 0.24);
      cx.closePath();
      cx.fill();
      cx.strokeStyle = 'rgba(0,0,0,0.5)';
      cx.lineWidth = 0.6;
      cx.stroke();
    }
    cx.lineCap = 'butt';

    /* head */
    const hx = midX, hy = hh * 0.4, hr = fw * 0.13;
    if (rank === 'Q') {
      cx.fillStyle = st.hair;
      cx.beginPath();
      cx.ellipse(hx, hy + hr * 0.5, hr * 1.35, hr * 1.5, 0, 0, Math.PI * 2);
      cx.fill();
    }
    const fg = cx.createRadialGradient(hx - hr * 0.3, hy - hr * 0.3, hr * 0.1, hx, hy, hr);
    fg.addColorStop(0, '#fde3c3');
    fg.addColorStop(1, SKIN_SHADE);
    cx.fillStyle = fg;
    cx.beginPath();
    cx.ellipse(hx, hy, hr * 0.9, hr, 0, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = 'rgba(80,40,20,0.6)';
    cx.lineWidth = 0.6;
    cx.stroke();
    if (rank !== 'Q') {
      cx.fillStyle = st.hair;
      cx.beginPath();
      cx.ellipse(hx - hr * 0.85, hy + hr * 0.1, hr * 0.28, hr * 0.55, 0.2, 0, Math.PI * 2);
      cx.ellipse(hx + hr * 0.85, hy + hr * 0.1, hr * 0.28, hr * 0.55, -0.2, 0, Math.PI * 2);
      cx.fill();
    }
    if (st.beard) {
      cx.fillStyle = st.hair;
      cx.beginPath();
      cx.moveTo(hx - hr * 0.75, hy + hr * 0.2);
      cx.quadraticCurveTo(hx, hy + hr * 2.0, hx + hr * 0.75, hy + hr * 0.2);
      cx.quadraticCurveTo(hx, hy + hr * 0.75, hx - hr * 0.75, hy + hr * 0.2);
      cx.fill();
    }
    /* eyes, brows, mouth */
    cx.fillStyle = '#2a1a10';
    cx.beginPath();
    cx.arc(hx - hr * 0.33, hy - hr * 0.08, hr * 0.09, 0, Math.PI * 2);
    cx.arc(hx + hr * 0.33, hy - hr * 0.08, hr * 0.09, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = '#4a2a18';
    cx.lineWidth = 0.6;
    cx.beginPath();
    cx.moveTo(hx - hr * 0.5, hy - hr * 0.3); cx.lineTo(hx - hr * 0.18, hy - hr * 0.33);
    cx.moveTo(hx + hr * 0.5, hy - hr * 0.3); cx.lineTo(hx + hr * 0.18, hy - hr * 0.33);
    cx.stroke();
    if (!st.beard) {
      cx.strokeStyle = '#a8423a';
      cx.lineWidth = 0.9;
      cx.beginPath();
      cx.moveTo(hx - hr * 0.22, hy + hr * 0.45);
      cx.quadraticCurveTo(hx, hy + hr * 0.58, hx + hr * 0.22, hy + hr * 0.45);
      cx.stroke();
    }

    /* headwear */
    const top = hy - hr;
    cx.lineWidth = 0.6;
    cx.strokeStyle = GOLD_DARK;
    if (st.crown === 'king' || st.crown === 'queen') {
      const cw = hr * (st.crown === 'king' ? 2.0 : 1.7);
      const ch = hr * (st.crown === 'king' ? 1.05 : 0.8);
      const pts = st.crown === 'king' ? 5 : 3;
      cx.beginPath();
      cx.moveTo(hx - cw / 2, top + hr * 0.15);
      for (let i = 0; i <= pts * 2; ++i) {
        const px = hx - cw / 2 + cw * i / (pts * 2);
        const py = i % 2 === 0 ? top - ch : top - ch * 0.45;
        cx.lineTo(px, py);
      }
      cx.lineTo(hx + cw / 2, top + hr * 0.15);
      cx.closePath();
      const cg = cx.createLinearGradient(0, top - ch, 0, top + hr * 0.15);
      cg.addColorStop(0, '#ffe58a');
      cg.addColorStop(1, GOLD_DARK);
      cx.fillStyle = cg;
      cx.fill();
      cx.stroke();
      const gems = ['#c62828', ROYAL_BLUE, '#2e7d32'];
      for (let i = 0; i < 3; ++i) {
        cx.fillStyle = gems[i];
        cx.beginPath();
        cx.arc(hx + (i - 1) * cw * 0.28, top - ch * 0.12, hr * 0.12, 0, Math.PI * 2);
        cx.fill();
      }
      for (let i = 0; i <= pts * 2; i += 2) {
        cx.fillStyle = IVORY;
        cx.beginPath();
        cx.arc(hx - cw / 2 + cw * i / (pts * 2), top - ch, hr * 0.09, 0, Math.PI * 2);
        cx.fill();
      }
    } else {
      cx.beginPath();
      cx.ellipse(hx, top + hr * 0.05, hr * 1.25, hr * 0.5, -0.12, Math.PI, Math.PI * 2);
      cx.closePath();
      cx.fillStyle = primary === '#000' ? '#263238' : primary;
      cx.fill();
      cx.stroke();
      cx.strokeStyle = '#f6f6f6';
      cx.lineWidth = hr * 0.18;
      cx.lineCap = 'round';
      cx.beginPath();
      cx.moveTo(hx + hr * 0.6, top - hr * 0.2);
      cx.quadraticCurveTo(hx + hr * 1.6, top - hr * 1.2, hx + hr * 2.0, top - hr * 0.2);
      cx.stroke();
      cx.lineCap = 'butt';
    }
  }

  function drawCourt(cx, x, y, w, h, card, color, ss) {
    const tplKey = templateKey();
    const sx = w / CE.CARD_W, sy = h / CE.CARD_H;
    const fx = x + 15 * sx, fy = y + 13 * sy;
    const fw = w - 30 * sx, fh = h - 26 * sy;
    const primary = color === '#000' || color === '#444' ? '#1d2633' : color;

    if (tplKey === 'minimal') {
      cx.fillStyle = color;
      cx.font = 'bold ' + (34 * ss).toFixed(1) + 'px Georgia, serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(displayRank(card.rank), x + w / 2, y + h / 2 - 6 * ss);
      CE.drawSuitSymbol(cx, card.suit, x + w / 2, y + h / 2 + 22 * ss, 14 * ss);
      return;
    }

    /* frame */
    cx.save();
    cx.beginPath();
    cx.rect(fx, fy, fw, fh);
    const bg = cx.createLinearGradient(fx, fy, fx, fy + fh);
    bg.addColorStop(0, '#fbf3df');
    bg.addColorStop(0.5, '#efe2c2');
    bg.addColorStop(1, '#fbf3df');
    cx.fillStyle = bg;
    cx.fill();
    cx.clip();

    const hh = fh / 2;
    /* top half figure, then the same figure rotated for the bottom half */
    for (let k = 0; k < 2; ++k) {
      cx.save();
      if (k === 0)
        cx.translate(fx, fy);
      else {
        cx.translate(fx + fw, fy + fh);
        cx.rotate(Math.PI);
      }
      cx.beginPath();
      cx.rect(0, 0, fw, hh);
      cx.clip();
      drawHalfFigure(cx, fw, hh, card.rank, primary);
      cx.restore();
    }
    /* divider */
    cx.strokeStyle = GOLD_DARK;
    cx.lineWidth = 0.8;
    cx.beginPath();
    cx.moveTo(fx, fy + hh + fh * 0.04);
    cx.lineTo(fx + fw, fy + hh - fh * 0.04);
    cx.stroke();
    cx.restore();

    /* suit badges in the frame corners */
    cx.fillStyle = color;
    CE.drawSuitSymbol(cx, card.suit, fx + 7 * ss, fy + 8 * ss, 8 * ss);
    cx.save();
    cx.translate(fx + fw - 7 * ss, fy + fh - 8 * ss);
    cx.rotate(Math.PI);
    CE.drawSuitSymbol(cx, card.suit, 0, 0, 8 * ss);
    cx.restore();

    cx.strokeStyle = color;
    cx.lineWidth = 1.2;
    cx.strokeRect(fx, fy, fw, fh);
    cx.strokeStyle = GOLD;
    cx.lineWidth = 0.6;
    cx.strokeRect(fx + 1.6, fy + 1.6, fw - 3.2, fh - 3.2);
  }

  /* ── the full face ── */
  ART.drawFace = function(cx, x, y, card, w, h) {
    const tpl = template();
    const bg = tpl && tpl.cardBg ? tpl.cardBg : '#fff';
    const ss = Math.min(w / CE.CARD_W, h / CE.CARD_H);
    const r = CE.CARD_RADIUS * ss + 0.5;
    drawPaper(cx, x, y, w, h, r, bg);
    const color = CE.resolveSuitColor(card.suit);
    const n = rankNumber(card);
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K')
      drawCourt(cx, x, y, w, h, card, color, ss);
    else if (n === 1)
      drawAce(cx, x, y, w, h, card, color, ss);
    else
      drawPipsArt(cx, x, y, w, h, card, color, ss);
    drawIndex(cx, x, y, w, h, card, color, ss);
  };

  ART.shade = shade;
  ART.templateKey = templateKey;
  ART.isRed = isRed;
})();
