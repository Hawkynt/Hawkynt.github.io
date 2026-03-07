;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;

  /* ================================================================
   *  SECTION A: STORAGE & ACTIVE THEME STATE
   * ================================================================ */

  const STORAGE_TABLE = 'sz-card-games-table';
  const STORAGE_CARDBACK = 'sz-card-games-cardback';
  const STORAGE_CARDFACE = 'sz-card-games-cardface';
  const STORAGE_BACKCOLOR = 'sz-card-games-backcolor';

  const activeTheme = {
    table: 'green',
    cardBack: 'navy_diamonds',
    cardFace: 'french',
    customBackColor: '#1a237e'
  };

  function loadTheme() {
    try {
      const t = localStorage.getItem(STORAGE_TABLE);
      const b = localStorage.getItem(STORAGE_CARDBACK);
      const f = localStorage.getItem(STORAGE_CARDFACE);
      const c = localStorage.getItem(STORAGE_BACKCOLOR);
      if (t && TABLE_THEMES[t]) activeTheme.table = t;
      if (b && CARD_BACK_DESIGNS[b]) activeTheme.cardBack = b;
      if (f && CARD_FACE_TEMPLATES[f]) activeTheme.cardFace = f;
      if (c) activeTheme.customBackColor = c;
    } catch (_) {}
  }

  function saveTheme() {
    try {
      localStorage.setItem(STORAGE_TABLE, activeTheme.table);
      localStorage.setItem(STORAGE_CARDBACK, activeTheme.cardBack);
      localStorage.setItem(STORAGE_CARDFACE, activeTheme.cardFace);
      localStorage.setItem(STORAGE_BACKCOLOR, activeTheme.customBackColor);
    } catch (_) {}
  }

  function setTheme(opts) {
    if (opts.table && TABLE_THEMES[opts.table]) activeTheme.table = opts.table;
    if (opts.cardBack && CARD_BACK_DESIGNS[opts.cardBack]) activeTheme.cardBack = opts.cardBack;
    if (opts.cardFace && CARD_FACE_TEMPLATES[opts.cardFace]) activeTheme.cardFace = opts.cardFace;
    if (opts.customBackColor) activeTheme.customBackColor = opts.customBackColor;
    saveTheme();
  }

  /* ================================================================
   *  SECTION B: TABLE THEMES
   * ================================================================ */

  const TABLE_THEMES = {
    green: {
      name: 'Classic Green',
      preview: '#1a4a1a',
      draw(cx, w, h) {
        const diag = Math.sqrt(w * w + h * h) / 2;
        const grad = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, diag);
        grad.addColorStop(0, '#1a4a1a');
        grad.addColorStop(0.85, '#0e350e');
        grad.addColorStop(1, '#0a2a0a');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, w, h);
      }
    },
    blue: {
      name: 'Midnight Blue',
      preview: '#0d1b3e',
      draw(cx, w, h) {
        const diag = Math.sqrt(w * w + h * h) / 2;
        const grad = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, diag);
        grad.addColorStop(0, '#1a2d5a');
        grad.addColorStop(0.85, '#0d1b3e');
        grad.addColorStop(1, '#081228');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, w, h);
      }
    },
    red: {
      name: 'Casino Red',
      preview: '#5a1a1a',
      draw(cx, w, h) {
        const diag = Math.sqrt(w * w + h * h) / 2;
        const grad = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, diag);
        grad.addColorStop(0, '#5a1a1a');
        grad.addColorStop(0.85, '#3e0d0d');
        grad.addColorStop(1, '#280808');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, w, h);
      }
    },
    wood: {
      name: 'Oak Table',
      preview: '#6b4226',
      draw(cx, w, h) {
        cx.fillStyle = '#6b4226';
        cx.fillRect(0, 0, w, h);
        cx.strokeStyle = 'rgba(90, 55, 20, 0.3)';
        cx.lineWidth = 1;
        for (let y = 0; y < h; y += 3) {
          cx.beginPath();
          cx.moveTo(0, y);
          for (let x = 0; x < w; x += 10)
            cx.lineTo(x, y + Math.sin(x * 0.02 + y * 0.1) * 2);
          cx.stroke();
        }
        const vig = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.sqrt(w * w + h * h) / 2);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.35)');
        cx.fillStyle = vig;
        cx.fillRect(0, 0, w, h);
      }
    },
    marble: {
      name: 'White Marble',
      preview: '#e8e4df',
      draw(cx, w, h) {
        cx.fillStyle = '#e8e4df';
        cx.fillRect(0, 0, w, h);
        cx.strokeStyle = 'rgba(180, 170, 155, 0.15)';
        cx.lineWidth = 2;
        for (let i = 0; i < 12; ++i) {
          cx.beginPath();
          const startY = Math.random() * h;
          cx.moveTo(0, startY);
          for (let x = 0; x < w; x += 8)
            cx.lineTo(x, startY + Math.sin(x * 0.01 + i * 2) * 30 + Math.sin(x * 0.03 + i) * 15);
          cx.stroke();
        }
        const shade = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.sqrt(w * w + h * h) / 2);
        shade.addColorStop(0, 'rgba(0,0,0,0)');
        shade.addColorStop(1, 'rgba(0,0,0,0.12)');
        cx.fillStyle = shade;
        cx.fillRect(0, 0, w, h);
      }
    },
    purple: {
      name: 'Royal Purple',
      preview: '#2d1a4a',
      draw(cx, w, h) {
        const diag = Math.sqrt(w * w + h * h) / 2;
        const grad = cx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, diag);
        grad.addColorStop(0, '#3d2a5a');
        grad.addColorStop(0.85, '#2d1a4a');
        grad.addColorStop(1, '#1a0d30');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, w, h);
      }
    }
  };

  /* ================================================================
   *  SECTION C: CARD BACK DESIGNS
   * ================================================================ */

  function _drawBackBase(cx, x, y, w, h, fillColor) {
    const cr = CE.CARD_RADIUS * Math.min(w / CE.CARD_W, h / CE.CARD_H);
    CE.drawRoundedRect(cx, x, y, w, h, cr);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#333';
    cx.lineWidth = 1;
    cx.stroke();

    const m = 3;
    CE.drawRoundedRect(cx, x + m, y + m, w - m * 2, h - m * 2, Math.max(cr - 1, 1));
    cx.fillStyle = fillColor;
    cx.fill();
    return { m, cr };
  }

  const CARD_BACK_DESIGNS = {
    navy_diamonds: {
      name: 'Navy Diamonds',
      preview: '#1a237e',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
        CE.drawRoundedRect(cx, x, y, cw, ch, cr);
        cx.fillStyle = '#fff';
        cx.fill();
        cx.strokeStyle = '#333';
        cx.lineWidth = 1;
        cx.stroke();

        const m = 3;
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.fillStyle = '#1a237e';
        cx.fill();

        cx.strokeStyle = '#3949ab';
        cx.lineWidth = 0.5;
        const step = 8;
        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
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

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = '#c5cae9';
        cx.lineWidth = 1;
        cx.stroke();
      }
    },
    red_tartan: {
      name: 'Red Tartan',
      preview: '#8b1a1a',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const { m, cr } = _drawBackBase(cx, x, y, cw, ch, '#8b1a1a');

        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.clip();

        cx.strokeStyle = 'rgba(200, 50, 50, 0.4)';
        cx.lineWidth = 2;
        const step = 10;
        for (let dy = y + m; dy < y + ch; dy += step) {
          cx.beginPath();
          cx.moveTo(x + m, dy);
          cx.lineTo(x + cw - m, dy);
          cx.stroke();
        }
        for (let dx = x + m; dx < x + cw; dx += step) {
          cx.beginPath();
          cx.moveTo(dx, y + m);
          cx.lineTo(dx, y + ch - m);
          cx.stroke();
        }
        cx.strokeStyle = 'rgba(255, 200, 100, 0.2)';
        cx.lineWidth = 1;
        for (let dy = y + m + 5; dy < y + ch; dy += step) {
          cx.beginPath();
          cx.moveTo(x + m, dy);
          cx.lineTo(x + cw - m, dy);
          cx.stroke();
        }
        for (let dx = x + m + 5; dx < x + cw; dx += step) {
          cx.beginPath();
          cx.moveTo(dx, y + m);
          cx.lineTo(dx, y + ch - m);
          cx.stroke();
        }
        cx.restore();

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = '#e57373';
        cx.lineWidth = 1;
        cx.stroke();
      }
    },
    green_classic: {
      name: 'Green Classic',
      preview: '#1b5e20',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const { m, cr } = _drawBackBase(cx, x, y, cw, ch, '#1b5e20');

        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.clip();

        cx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        cx.lineWidth = 1.5;
        const inset = 8;
        CE.drawRoundedRect(cx, x + m + inset, y + m + inset, cw - m * 2 - inset * 2, ch - m * 2 - inset * 2, 3);
        cx.stroke();
        CE.drawRoundedRect(cx, x + m + inset + 3, y + m + inset + 3, cw - m * 2 - inset * 2 - 6, ch - m * 2 - inset * 2 - 6, 2);
        cx.stroke();

        cx.restore();

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = '#81c784';
        cx.lineWidth = 1;
        cx.stroke();
      }
    },
    royal_gold: {
      name: 'Royal Gold',
      preview: '#b8860b',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const { m, cr } = _drawBackBase(cx, x, y, cw, ch, '#b8860b');

        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.clip();

        cx.strokeStyle = 'rgba(255, 223, 100, 0.35)';
        cx.lineWidth = 0.5;
        const step = 12;
        for (let dy = y + m; dy < y + ch; dy += step) {
          for (let dx = x + m; dx < x + cw; dx += step) {
            const mx = dx + step / 2;
            const my = dy + step / 2;
            cx.beginPath();
            cx.moveTo(mx, my - step / 2 + 1);
            cx.lineTo(mx + step / 2 - 1, my);
            cx.lineTo(mx, my + step / 2 - 1);
            cx.lineTo(mx - step / 2 + 1, my);
            cx.closePath();
            cx.stroke();
          }
        }

        cx.restore();

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = '#ffd54f';
        cx.lineWidth = 1;
        cx.stroke();
      }
    },
    custom: {
      name: 'Custom Color',
      preview: '#1a237e',
      draw(cx, x, y, w, h) {
        const cw = w || CE.CARD_W;
        const ch = h || CE.CARD_H;
        const color = activeTheme.customBackColor;
        const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
        CE.drawRoundedRect(cx, x, y, cw, ch, cr);
        cx.fillStyle = '#fff';
        cx.fill();
        cx.strokeStyle = '#333';
        cx.lineWidth = 1;
        cx.stroke();

        const m = 3;
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.fillStyle = color;
        cx.fill();

        cx.save();
        cx.beginPath();
        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.clip();

        cx.strokeStyle = 'rgba(255,255,255,0.18)';
        cx.lineWidth = 0.5;
        const step = 8;
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

        CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
        cx.strokeStyle = 'rgba(255,255,255,0.4)';
        cx.lineWidth = 1;
        cx.stroke();
      }
    }
  };

  /* ================================================================
   *  SECTION D: CARD FACE TEMPLATES
   * ================================================================ */

  const CARD_FACE_TEMPLATES = {
    french: {
      name: 'French (Standard)',
      suitColors: { spades: '#000', hearts: '#d00', diamonds: '#d00', clubs: '#000' },
      rankLabels: null,
      drawSuit: drawFrenchSuit,
      cardBg: '#fff'
    },
    fourColor: {
      name: '4-Color',
      suitColors: { spades: '#000', hearts: '#d00', diamonds: '#0055cc', clubs: '#008800' },
      rankLabels: null,
      drawSuit: drawFourColorSuit,
      cardBg: '#fff'
    },
    german: {
      name: 'German',
      suitColors: { spades: '#228b22', hearts: '#d00', diamonds: '#daa520', clubs: '#5c3317' },
      rankLabels: { A: 'D', J: 'U', Q: 'O' },
      drawSuit: drawGermanSuit,
      cardBg: '#fffde8'
    },
    minimal: {
      name: 'Minimal',
      suitColors: { spades: '#444', hearts: '#a04040', diamonds: '#a04040', clubs: '#444' },
      rankLabels: null,
      drawSuit: null,
      cardBg: '#f8f8f0'
    }
  };

  /* ================================================================
   *  SECTION E: GERMAN SUIT SYMBOL PATHS
   * ================================================================ */

  function drawGermanSuit(cx, suit, x, y, size) {
    const resolved = CE.resolveSuit(suit);
    const s = size / 2;
    cx.save();
    cx.translate(x, y);

    switch (resolved) {
      case 'spades': {
        // Gras / Laub (Leaf) -- narrow elongated blade-shaped leaf
        const lw = s * 0.28;
        const lh = s * 0.92;

        // Gradient for leaf body
        const leafGrad = cx.createRadialGradient(0, 0, 0, 0, 0, lh);
        leafGrad.addColorStop(0, '#3cb043');
        leafGrad.addColorStop(1, '#1a6b1a');

        // Main leaf blade
        cx.beginPath();
        cx.moveTo(0, -lh);
        cx.bezierCurveTo(-lw * 0.4, -lh * 0.7, -lw, -lh * 0.25, -lw, 0);
        cx.bezierCurveTo(-lw, lh * 0.25, -lw * 0.5, lh * 0.7, 0, lh);
        cx.bezierCurveTo(lw * 0.5, lh * 0.7, lw, lh * 0.25, lw, 0);
        cx.bezierCurveTo(lw, -lh * 0.25, lw * 0.4, -lh * 0.7, 0, -lh);
        cx.closePath();
        cx.fillStyle = leafGrad;
        cx.fill();

        // Center vein (lighter green overlay)
        cx.beginPath();
        cx.moveTo(0, -lh * 0.85);
        cx.lineTo(0, lh * 0.85);
        cx.strokeStyle = '#90ee90';
        cx.lineWidth = s * 0.06;
        cx.globalAlpha = 0.5;
        cx.stroke();
        cx.globalAlpha = 1;

        // Side veins (lighter green)
        cx.strokeStyle = '#90ee90';
        cx.lineWidth = s * 0.04;
        cx.globalAlpha = 0.4;
        for (let i = -3; i <= 3; ++i) {
          if (i === 0) continue;
          const vy = i * lh * 0.22;
          const dir = i < 0 ? -1 : 1;
          cx.beginPath();
          cx.moveTo(0, vy);
          cx.lineTo(lw * 0.7 * dir, vy - lh * 0.08);
          cx.stroke();
          cx.beginPath();
          cx.moveTo(0, vy);
          cx.lineTo(-lw * 0.7 * dir, vy - lh * 0.08);
          cx.stroke();
        }
        cx.globalAlpha = 1;

        // Short stem at bottom
        cx.beginPath();
        cx.moveTo(0, lh);
        cx.lineTo(0, lh + s * 0.12);
        cx.strokeStyle = '#1a6b1a';
        cx.lineWidth = s * 0.08;
        cx.stroke();
        break;
      }
      case 'hearts': {
        // Herz (Heart) -- traditional heart with gradient
        const w = s * 0.9;
        const h = s * 0.9;

        const heartGrad = cx.createRadialGradient(0, 0, 0, 0, 0, h);
        heartGrad.addColorStop(0, '#ff2020');
        heartGrad.addColorStop(1, '#8b0000');

        cx.beginPath();
        cx.moveTo(0, -h * 0.35);
        cx.bezierCurveTo(-w * 0.05, -h * 0.55, -w * 0.65, -h * 0.9, -w, -h * 0.35);
        cx.bezierCurveTo(-w, h * 0.15, -w * 0.4, h * 0.55, 0, h);
        cx.bezierCurveTo(w * 0.4, h * 0.55, w, h * 0.15, w, -h * 0.35);
        cx.bezierCurveTo(w * 0.65, -h * 0.9, w * 0.05, -h * 0.55, 0, -h * 0.35);
        cx.closePath();
        cx.fillStyle = heartGrad;
        cx.fill();
        cx.strokeStyle = '#8b0000';
        cx.lineWidth = 0.5;
        cx.stroke();

        // Highlight on upper-left lobe
        cx.beginPath();
        cx.arc(-w * 0.35, -h * 0.4, s * 0.12, 0, Math.PI * 2);
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        cx.fill();
        break;
      }
      case 'diamonds': {
        // Schellen (Hawk-bell) -- round spherical jingle bell with gradient
        const r = s * 0.6;

        // Gold gradient
        const bellGrad = cx.createRadialGradient(0, s * 0.1, 0, 0, s * 0.1, r);
        bellGrad.addColorStop(0, '#ffd700');
        bellGrad.addColorStop(1, '#b8860b');

        // Main spherical body
        cx.beginPath();
        cx.arc(0, s * 0.1, r, 0, Math.PI * 2);
        cx.fillStyle = bellGrad;
        cx.fill();

        // Horizontal band (darker gold)
        cx.beginPath();
        cx.moveTo(-r, s * 0.1);
        cx.lineTo(r, s * 0.1);
        cx.strokeStyle = '#8b6914';
        cx.lineWidth = s * 0.1;
        cx.globalAlpha = 0.4;
        cx.stroke();
        cx.globalAlpha = 1;

        // Slit / opening at bottom
        cx.beginPath();
        cx.ellipse(0, s * 0.1 + r * 0.35, r * 0.55, r * 0.18, 0, 0, Math.PI);
        cx.fillStyle = '#8b6914';
        cx.globalAlpha = 0.35;
        cx.fill();
        cx.globalAlpha = 1;

        // Small loop / ring at top
        cx.beginPath();
        cx.arc(0, s * 0.1 - r - s * 0.08, s * 0.12, 0, Math.PI * 2);
        cx.strokeStyle = '#b8860b';
        cx.lineWidth = s * 0.08;
        cx.stroke();

        // Metallic highlight (white spot, upper-left)
        cx.beginPath();
        cx.arc(-r * 0.25, s * 0.1 - r * 0.3, r * 0.2, 0, Math.PI * 2);
        cx.fillStyle = 'rgba(255,255,255,0.4)';
        cx.fill();
        break;
      }
      case 'clubs': {
        // Eichel (Acorn) -- two-tone with gradients
        const nutW = s * 0.38;
        const nutH = s * 0.5;
        const capW = s * 0.48;
        const capH = s * 0.28;
        const nutY = s * 0.2;
        const capY = nutY - nutH * 0.55;

        // Nut body gradient (brown)
        const nutGrad = cx.createRadialGradient(0, nutY + nutH * 0.3, 0, 0, nutY + nutH * 0.3, nutH);
        nutGrad.addColorStop(0, '#8b5e3c');
        nutGrad.addColorStop(1, '#3c1f0a');

        // Acorn nut (rounded bottom part)
        cx.beginPath();
        cx.moveTo(-nutW, nutY - nutH * 0.1);
        cx.bezierCurveTo(-nutW, nutY + nutH * 0.5, -nutW * 0.5, nutY + nutH, 0, nutY + nutH);
        cx.bezierCurveTo(nutW * 0.5, nutY + nutH, nutW, nutY + nutH * 0.5, nutW, nutY - nutH * 0.1);
        cx.closePath();
        cx.fillStyle = nutGrad;
        cx.fill();

        // Cupule gradient (darker brown)
        const capGrad = cx.createRadialGradient(0, capY, 0, 0, capY, capH * 1.5);
        capGrad.addColorStop(0, '#5c3317');
        capGrad.addColorStop(1, '#2c1507');

        // Cupule / cap
        cx.beginPath();
        cx.moveTo(-capW, capY + capH * 0.5);
        cx.bezierCurveTo(-capW, capY - capH * 0.3, -capW * 0.5, capY - capH, 0, capY - capH);
        cx.bezierCurveTo(capW * 0.5, capY - capH, capW, capY - capH * 0.3, capW, capY + capH * 0.5);
        cx.lineTo(-capW, capY + capH * 0.5);
        cx.closePath();
        cx.fillStyle = capGrad;
        cx.fill();

        // Cross-hatch texture on cupule (lighter lines)
        cx.save();
        cx.beginPath();
        cx.moveTo(-capW, capY + capH * 0.5);
        cx.bezierCurveTo(-capW, capY - capH * 0.3, -capW * 0.5, capY - capH, 0, capY - capH);
        cx.bezierCurveTo(capW * 0.5, capY - capH, capW, capY - capH * 0.3, capW, capY + capH * 0.5);
        cx.lineTo(-capW, capY + capH * 0.5);
        cx.clip();

        cx.strokeStyle = '#8b6b4a';
        cx.lineWidth = s * 0.03;
        cx.globalAlpha = 0.5;
        const step = s * 0.1;
        for (let ly = capY - capH; ly <= capY + capH; ly += step) {
          cx.beginPath();
          cx.moveTo(-capW, ly);
          cx.lineTo(capW, ly);
          cx.stroke();
        }
        for (let lx = -capW; lx <= capW; lx += step) {
          cx.beginPath();
          cx.moveTo(lx, capY - capH);
          cx.lineTo(lx, capY + capH);
          cx.stroke();
        }
        cx.globalAlpha = 1;
        cx.restore();

        // Short stem on top
        cx.beginPath();
        cx.moveTo(-s * 0.06, capY - capH);
        cx.lineTo(0, capY - capH - s * 0.2);
        cx.lineTo(s * 0.06, capY - capH);
        cx.closePath();
        cx.fillStyle = '#3c1f0a';
        cx.fill();
        break;
      }
    }

    cx.restore();
  }

  /* ================================================================
   *  SECTION E2: FRENCH & 4-COLOR RICH SUIT SYMBOLS
   * ================================================================ */

  function _drawRichSuit(cx, suit, x, y, size, baseColor, darkColor, outlineColor) {
    const resolved = CE.resolveSuit(suit);
    const hs = size / 2;
    cx.save();
    cx.translate(x, y);

    const grad = cx.createRadialGradient(0, 0, 0, 0, 0, hs);
    grad.addColorStop(0, baseColor);
    grad.addColorStop(1, darkColor);

    switch (resolved) {
      case 'hearts': {
        const w = hs, h = hs;
        cx.beginPath();
        cx.moveTo(0, h * 0.4);
        cx.bezierCurveTo(-w * 0.1, -h * 0.1, -w, -h * 0.3, -w, h * 0.05);
        cx.bezierCurveTo(-w, h * 0.55, -w * 0.2, h * 0.7, 0, h);
        cx.bezierCurveTo(w * 0.2, h * 0.7, w, h * 0.55, w, h * 0.05);
        cx.bezierCurveTo(w, -h * 0.3, w * 0.1, -h * 0.1, 0, h * 0.4);
        cx.fillStyle = grad;
        cx.fill();
        cx.strokeStyle = outlineColor;
        cx.lineWidth = 0.5;
        cx.stroke();
        cx.beginPath();
        cx.arc(-w * 0.4, -h * 0.05, hs * 0.15, 0, Math.PI * 2);
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        cx.fill();
        break;
      }
      case 'diamonds': {
        cx.beginPath();
        cx.moveTo(0, -hs);
        cx.lineTo(hs * 0.6, 0);
        cx.lineTo(0, hs);
        cx.lineTo(-hs * 0.6, 0);
        cx.closePath();
        cx.fillStyle = grad;
        cx.fill();
        cx.strokeStyle = outlineColor;
        cx.lineWidth = 0.5;
        cx.stroke();
        cx.beginPath();
        cx.arc(0, -hs * 0.3, hs * 0.12, 0, Math.PI * 2);
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        cx.fill();
        break;
      }
      case 'spades': {
        const w = hs, h = hs;
        cx.beginPath();
        cx.moveTo(0, -h);
        cx.bezierCurveTo(-w * 0.2, -h * 0.7, -w, -h * 0.55, -w, -h * 0.05);
        cx.bezierCurveTo(-w, h * 0.3, -w * 0.1, h * 0.1, 0, -h * 0.15);
        cx.bezierCurveTo(w * 0.1, h * 0.1, w, h * 0.3, w, -h * 0.05);
        cx.bezierCurveTo(w, -h * 0.55, w * 0.2, -h * 0.7, 0, -h);
        cx.closePath();
        cx.fillStyle = grad;
        cx.fill();
        cx.strokeStyle = outlineColor;
        cx.lineWidth = 0.5;
        cx.stroke();
        cx.beginPath();
        cx.moveTo(-hs * 0.15, -h * 0.1);
        cx.lineTo(-hs * 0.3, h);
        cx.lineTo(hs * 0.3, h);
        cx.lineTo(hs * 0.15, -h * 0.1);
        cx.closePath();
        cx.fillStyle = grad;
        cx.fill();
        cx.beginPath();
        cx.arc(0, -h * 0.5, hs * 0.15, 0, Math.PI * 2);
        cx.fillStyle = 'rgba(255,255,255,0.25)';
        cx.fill();
        break;
      }
      case 'clubs': {
        const r = hs * 0.38;
        cx.beginPath();
        cx.arc(0, -hs * 0.4, r, 0, Math.PI * 2);
        cx.fillStyle = grad;
        cx.fill();
        cx.strokeStyle = outlineColor;
        cx.lineWidth = 0.5;
        cx.stroke();
        cx.beginPath();
        cx.arc(-hs * 0.4, hs * 0.05, r, 0, Math.PI * 2);
        cx.fillStyle = grad;
        cx.fill();
        cx.stroke();
        cx.beginPath();
        cx.arc(hs * 0.4, hs * 0.05, r, 0, Math.PI * 2);
        cx.fillStyle = grad;
        cx.fill();
        cx.stroke();
        cx.beginPath();
        cx.moveTo(-hs * 0.15, hs * 0.05);
        cx.lineTo(-hs * 0.3, hs);
        cx.lineTo(hs * 0.3, hs);
        cx.lineTo(hs * 0.15, hs * 0.05);
        cx.closePath();
        cx.fillStyle = grad;
        cx.fill();
        cx.beginPath();
        cx.arc(0, -hs * 0.5, hs * 0.12, 0, Math.PI * 2);
        cx.fillStyle = 'rgba(255,255,255,0.25)';
        cx.fill();
        break;
      }
    }

    cx.restore();
  }

  function drawFrenchSuit(cx, suit, x, y, size) {
    const resolved = CE.resolveSuit(suit);
    const isRed = (resolved === 'hearts' || resolved === 'diamonds');
    _drawRichSuit(cx, suit, x, y, size,
      isRed ? '#ff2020' : '#333',
      isRed ? '#8b0000' : '#000',
      isRed ? '#8b0000' : '#222'
    );
  }

  function drawFourColorSuit(cx, suit, x, y, size) {
    const resolved = CE.resolveSuit(suit);
    const colors = {
      spades:   ['#333',    '#000',    '#222'],
      hearts:   ['#ff2020', '#8b0000', '#8b0000'],
      diamonds: ['#2277ee', '#003388', '#003388'],
      clubs:    ['#22aa22', '#005500', '#005500']
    };
    const c = colors[resolved] || colors.spades;
    _drawRichSuit(cx, suit, x, y, size, c[0], c[1], c[2]);
  }

  /* ================================================================
   *  SECTION F: SHIMMER EFFECTS
   * ================================================================ */

  const shimmerCards = [];

  function addShimmer(x, y, w, h, type) {
    shimmerCards.push({
      x, y,
      w: w || CE.CARD_W,
      h: h || CE.CARD_H,
      t: 0,
      duration: type === 'pulse' ? 1.5 : 0.8,
      type: type || 'sparkle'
    });
  }

  function updateShimmers(dt) {
    for (let i = shimmerCards.length - 1; i >= 0; --i) {
      shimmerCards[i].t += dt;
      if (shimmerCards[i].t >= shimmerCards[i].duration)
        shimmerCards.splice(i, 1);
    }
  }

  function drawShimmers(cx) {
    for (const s of shimmerCards) {
      const progress = s.t / s.duration;
      if (progress < 0 || progress > 1) continue;

      cx.save();
      const cr = CE.CARD_RADIUS * Math.min(s.w / CE.CARD_W, s.h / CE.CARD_H);
      cx.beginPath();
      CE.drawRoundedRect(cx, s.x, s.y, s.w, s.h, cr);
      cx.clip();

      if (s.type === 'sparkle') {
        // Diagonal light sweep across card face
        const sweepX = s.x - s.w + progress * (s.w * 3);
        const grad = cx.createLinearGradient(sweepX - 20, s.y, sweepX + 20, s.y + s.h);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.4, 'rgba(255,255,255,' + (0.35 * (1 - progress)) + ')');
        grad.addColorStop(0.5, 'rgba(255,255,255,' + (0.5 * (1 - progress)) + ')');
        grad.addColorStop(0.6, 'rgba(255,255,255,' + (0.35 * (1 - progress)) + ')');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        cx.fillStyle = grad;
        cx.fillRect(s.x, s.y, s.w, s.h);
      } else {
        // Pulse -- expanding gold glow ring
        const alpha = 0.6 * (1 - progress);
        const radius = Math.max(s.w, s.h) * 0.3 * (1 + progress);
        cx.shadowColor = '#fc0';
        cx.shadowBlur = 15 + 10 * Math.sin(progress * Math.PI);
        cx.strokeStyle = 'rgba(255, 200, 0, ' + alpha + ')';
        cx.lineWidth = 3 * (1 - progress);
        cx.beginPath();
        cx.arc(s.x + s.w / 2, s.y + s.h / 2, radius, 0, Math.PI * 2);
        cx.stroke();
      }

      cx.restore();
    }
  }

  /* ================================================================
   *  SECTION G: SETTINGS PANEL UI
   * ================================================================ */

  let settingsPanelOpen = false;

  const PANEL_W = 520;
  const PANEL_H = 420;
  const TILE_W = 60;
  const TILE_H = 44;
  const TILE_GAP = 8;
  const ROW_START_X = 110;
  const CUSTOM_COLORS = ['#1a237e', '#8b1a1a', '#1b5e20', '#b8860b', '#4a148c', '#004d40', '#bf360c', '#263238'];

  function _drawPanelTile(cx, px, py, tw, th, color, label, isActive) {
    CE.drawRoundedRect(cx, px, py, tw, th, 4);
    cx.fillStyle = color;
    cx.fill();
    if (isActive) {
      cx.strokeStyle = '#ffff00';
      cx.lineWidth = 3;
    } else {
      cx.strokeStyle = 'rgba(255,255,255,0.3)';
      cx.lineWidth = 1;
    }
    cx.stroke();
    if (label) {
      cx.font = '8px sans-serif';
      cx.fillStyle = '#ccc';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(label, px + tw / 2, py + th + 2);
    }
  }

  function drawSettingsPanel(cx, W, H) {
    if (!settingsPanelOpen) return;

    // Dimmed backdrop
    cx.fillStyle = 'rgba(0,0,0,0.55)';
    cx.fillRect(0, 0, W, H);

    const px = (W - PANEL_W) / 2;
    const py = (H - PANEL_H) / 2;

    // Panel background
    CE.drawRoundedRect(cx, px, py, PANEL_W, PANEL_H, 10);
    cx.fillStyle = '#1e1e1e';
    cx.fill();
    cx.strokeStyle = '#555';
    cx.lineWidth = 2;
    cx.stroke();

    // Title
    cx.font = 'bold 18px sans-serif';
    cx.fillStyle = '#fff';
    cx.textAlign = 'center';
    cx.textBaseline = 'top';
    cx.fillText('Card Style Settings', W / 2, py + 14);

    let rowY = py + 50;
    const labelX = px + 16;

    // ── Table row ──
    cx.font = 'bold 12px sans-serif';
    cx.fillStyle = '#aaa';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText('Table:', labelX, rowY + TILE_H / 2);

    const tableKeys = Object.keys(TABLE_THEMES);
    for (let i = 0; i < tableKeys.length; ++i) {
      const key = tableKeys[i];
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      _drawPanelTile(cx, tx, rowY, TILE_W, TILE_H, TABLE_THEMES[key].preview, TABLE_THEMES[key].name.split(' ')[0], activeTheme.table === key);
    }

    rowY += TILE_H + 24;

    // ── Card Back row ──
    cx.font = 'bold 12px sans-serif';
    cx.fillStyle = '#aaa';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText('Card Back:', labelX, rowY + TILE_H / 2);

    const backKeys = Object.keys(CARD_BACK_DESIGNS);
    for (let i = 0; i < backKeys.length; ++i) {
      const key = backKeys[i];
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      const previewColor = key === 'custom' ? activeTheme.customBackColor : CARD_BACK_DESIGNS[key].preview;
      _drawPanelTile(cx, tx, rowY, TILE_W, TILE_H, previewColor, CARD_BACK_DESIGNS[key].name.split(' ')[0], activeTheme.cardBack === key);
    }

    rowY += TILE_H + 24;

    // ── Card Face row ──
    cx.font = 'bold 12px sans-serif';
    cx.fillStyle = '#aaa';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText('Card Face:', labelX, rowY + TILE_H / 2);

    const faceKeys = Object.keys(CARD_FACE_TEMPLATES);
    for (let i = 0; i < faceKeys.length; ++i) {
      const key = faceKeys[i];
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      const tpl = CARD_FACE_TEMPLATES[key];
      CE.drawRoundedRect(cx, tx, rowY, TILE_W, TILE_H, 4);
      cx.fillStyle = tpl.cardBg;
      cx.fill();
      // Draw a small suit icon preview
      const sc = tpl.suitColors;
      cx.fillStyle = sc.hearts;
      cx.font = '14px serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText('\u2665', tx + TILE_W * 0.3, rowY + TILE_H * 0.4);
      cx.fillStyle = sc.spades;
      cx.fillText('\u2660', tx + TILE_W * 0.7, rowY + TILE_H * 0.4);
      if (activeTheme.cardFace === key) {
        cx.strokeStyle = '#ffff00';
        cx.lineWidth = 3;
      } else {
        cx.strokeStyle = 'rgba(255,255,255,0.3)';
        cx.lineWidth = 1;
      }
      CE.drawRoundedRect(cx, tx, rowY, TILE_W, TILE_H, 4);
      cx.stroke();
      cx.font = '8px sans-serif';
      cx.fillStyle = '#ccc';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(tpl.name.split(' ')[0], tx + TILE_W / 2, rowY + TILE_H + 2);
    }

    rowY += TILE_H + 24;

    // ── Custom Color row (only when custom back selected) ──
    if (activeTheme.cardBack === 'custom') {
      cx.font = 'bold 12px sans-serif';
      cx.fillStyle = '#aaa';
      cx.textAlign = 'left';
      cx.textBaseline = 'middle';
      cx.fillText('Color:', labelX, rowY + 20);

      const swatchSize = 28;
      const swatchGap = 6;
      for (let i = 0; i < CUSTOM_COLORS.length; ++i) {
        const sx = px + ROW_START_X + i * (swatchSize + swatchGap);
        cx.fillStyle = CUSTOM_COLORS[i];
        CE.drawRoundedRect(cx, sx, rowY + 6, swatchSize, swatchSize, 4);
        cx.fill();
        if (activeTheme.customBackColor === CUSTOM_COLORS[i]) {
          cx.strokeStyle = '#ffff00';
          cx.lineWidth = 2;
        } else {
          cx.strokeStyle = 'rgba(255,255,255,0.3)';
          cx.lineWidth = 1;
        }
        CE.drawRoundedRect(cx, sx, rowY + 6, swatchSize, swatchSize, 4);
        cx.stroke();
      }
      rowY += 48;
    }

    // ── Preview section ──
    cx.font = 'bold 12px sans-serif';
    cx.fillStyle = '#aaa';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText('Preview:', labelX, rowY + CE.CARD_H * 0.55 / 2);

    const previewScale = 0.55;
    const pw = Math.round(CE.CARD_W * previewScale);
    const ph = Math.round(CE.CARD_H * previewScale);
    const previewX = px + ROW_START_X;

    // Sample face card
    const sampleCard = { suit: 'hearts', rank: 'Q', faceUp: true, color: 'red', value: 11 };
    cx.save();
    cx.translate(previewX, rowY);
    cx.scale(previewScale, previewScale);
    CE.drawCardFace(cx, 0, 0, sampleCard);
    cx.restore();

    // Sample card back
    cx.save();
    cx.translate(previewX + pw + 16, rowY);
    cx.scale(previewScale, previewScale);
    CARD_BACK_DESIGNS[activeTheme.cardBack].draw(cx, 0, 0, CE.CARD_W, CE.CARD_H);
    cx.restore();

    // ── Close button ──
    const closeBtnW = 80;
    const closeBtnH = 30;
    const closeBtnX = W / 2 - closeBtnW / 2;
    const closeBtnY = py + PANEL_H - 46;
    CE.drawButton(cx, closeBtnX, closeBtnY, closeBtnW, closeBtnH, 'Close', { bg: '#333', border: '#888', fontSize: 13 });
  }

  function handleSettingsClick(mx, my) {
    if (!settingsPanelOpen) return false;

    const W = 900;
    const H = 600;
    const px = (W - PANEL_W) / 2;
    const py = (H - PANEL_H) / 2;

    // Outside panel -- close
    if (!CE.isInRect(mx, my, px, py, PANEL_W, PANEL_H)) {
      settingsPanelOpen = false;
      return true;
    }

    let rowY = py + 50;

    // ── Table row hit test ──
    const tableKeys = Object.keys(TABLE_THEMES);
    for (let i = 0; i < tableKeys.length; ++i) {
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      if (CE.isInRect(mx, my, tx, rowY, TILE_W, TILE_H)) {
        setTheme({ table: tableKeys[i] });
        return true;
      }
    }

    rowY += TILE_H + 24;

    // ── Card Back row hit test ──
    const backKeys = Object.keys(CARD_BACK_DESIGNS);
    for (let i = 0; i < backKeys.length; ++i) {
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      if (CE.isInRect(mx, my, tx, rowY, TILE_W, TILE_H)) {
        setTheme({ cardBack: backKeys[i] });
        return true;
      }
    }

    rowY += TILE_H + 24;

    // ── Card Face row hit test ──
    const faceKeys = Object.keys(CARD_FACE_TEMPLATES);
    for (let i = 0; i < faceKeys.length; ++i) {
      const tx = px + ROW_START_X + i * (TILE_W + TILE_GAP);
      if (CE.isInRect(mx, my, tx, rowY, TILE_W, TILE_H)) {
        setTheme({ cardFace: faceKeys[i] });
        return true;
      }
    }

    rowY += TILE_H + 24;

    // ── Custom Color swatch hit test ──
    if (activeTheme.cardBack === 'custom') {
      const swatchSize = 28;
      const swatchGap = 6;
      for (let i = 0; i < CUSTOM_COLORS.length; ++i) {
        const sx = px + ROW_START_X + i * (swatchSize + swatchGap);
        if (CE.isInRect(mx, my, sx, rowY + 6, swatchSize, swatchSize)) {
          setTheme({ customBackColor: CUSTOM_COLORS[i] });
          return true;
        }
      }
      rowY += 48;
    }

    // ── Close button hit test ──
    const closeBtnW = 80;
    const closeBtnH = 30;
    const closeBtnX = W / 2 - closeBtnW / 2;
    const closeBtnY = py + PANEL_H - 46;
    if (CE.isInRect(mx, my, closeBtnX, closeBtnY, closeBtnW, closeBtnH)) {
      settingsPanelOpen = false;
      return true;
    }

    return true;
  }

  /* ================================================================
   *  SECTION H: PUBLIC API EXPORT
   * ================================================================ */

  SZ.CardThemes = {
    TABLE_THEMES,
    CARD_BACK_DESIGNS,
    CARD_FACE_TEMPLATES,
    activeTheme,
    loadTheme,
    saveTheme,
    setTheme,
    drawGermanSuit,
    drawFrenchSuit,
    drawFourColorSuit,
    get settingsPanelOpen() { return settingsPanelOpen; },
    set settingsPanelOpen(v) { settingsPanelOpen = v; },
    drawSettingsPanel,
    handleSettingsClick,
    addShimmer,
    updateShimmers,
    drawShimmers
  };

})();
