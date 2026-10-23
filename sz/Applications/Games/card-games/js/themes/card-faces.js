;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;
  const CT = SZ.CardThemes || (SZ.CardThemes = {});

  /* ================================================================
   *  SECTION D: CARD FACE TEMPLATES
   * ================================================================ */

  CT.CARD_FACE_TEMPLATES = {
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
        // Gras / Laub (Leaf) -- broad Bavarian leaf, clearly not a diamond
        const lw = s * 0.65;
        const lh = s * 0.85;

        // Gradient for leaf body
        const leafGrad = cx.createRadialGradient(0, -lh * 0.15, 0, 0, -lh * 0.15, lh);
        leafGrad.addColorStop(0, '#3cb043');
        leafGrad.addColorStop(1, '#1a6b1a');

        // Broad leaf body -- pointed tip at top, widest at upper-third,
        // tapers to narrow stem attachment at bottom
        cx.beginPath();
        cx.moveTo(0, -lh);
        cx.bezierCurveTo(-lw * 0.35, -lh * 0.95, -lw * 0.9, -lh * 0.5, -lw, -lh * 0.05);
        cx.bezierCurveTo(-lw * 0.95, lh * 0.3, -lw * 0.4, lh * 0.58, 0, lh * 0.65);
        cx.bezierCurveTo(lw * 0.4, lh * 0.58, lw * 0.95, lh * 0.3, lw, -lh * 0.05);
        cx.bezierCurveTo(lw * 0.9, -lh * 0.5, lw * 0.35, -lh * 0.95, 0, -lh);
        cx.closePath();
        cx.fillStyle = leafGrad;
        cx.fill();

        // Thin dark outline for definition
        cx.strokeStyle = '#1a6b1a';
        cx.lineWidth = 0.5;
        cx.stroke();

        // Center vein (lighter green overlay)
        cx.beginPath();
        cx.moveTo(0, -lh * 0.85);
        cx.lineTo(0, lh * 0.6);
        cx.strokeStyle = '#90ee90';
        cx.lineWidth = s * 0.07;
        cx.globalAlpha = 0.5;
        cx.stroke();
        cx.globalAlpha = 1;

        // Side veins -- curved, radiating outward from center vein
        cx.strokeStyle = '#90ee90';
        cx.lineWidth = s * 0.04;
        cx.globalAlpha = 0.4;
        const veinPairs = [
          { vy: -lh * 0.55, reach: 0.75 },
          { vy: -lh * 0.3,  reach: 0.9 },
          { vy: -lh * 0.05, reach: 0.85 },
          { vy:  lh * 0.2,  reach: 0.6 }
        ];
        for (const { vy, reach } of veinPairs) {
          cx.beginPath();
          cx.moveTo(0, vy);
          cx.quadraticCurveTo(lw * reach * 0.5, vy - lh * 0.02, lw * reach, vy - lh * 0.08);
          cx.stroke();
          cx.beginPath();
          cx.moveTo(0, vy);
          cx.quadraticCurveTo(-lw * reach * 0.5, vy - lh * 0.02, -lw * reach, vy - lh * 0.08);
          cx.stroke();
        }
        cx.globalAlpha = 1;

        // Stem at bottom
        cx.beginPath();
        cx.moveTo(0, lh * 0.65);
        cx.lineTo(0, lh * 0.65 + s * 0.25);
        cx.strokeStyle = '#1a6b1a';
        cx.lineWidth = s * 0.1;
        cx.lineCap = 'round';
        cx.stroke();
        cx.lineCap = 'butt';
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

  CT.drawGermanSuit = drawGermanSuit;
  CT.drawFrenchSuit = drawFrenchSuit;
  CT.drawFourColorSuit = drawFourColorSuit;

})();
