/* Shared painting helpers for the suite's own screens: gold title text, ribbons,
   panels, glossy buttons, progress bars, light rays and category emblems. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const PA = NS.paint = NS.paint || {};

  const SERIF = 'Georgia, "Palatino Linotype", "Book Antiqua", serif';
  const SANS = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';
  PA.SERIF = SERIF;
  PA.SANS = SANS;

  PA.font = (size, weight, serif) => (weight || 'bold') + ' ' + Math.round(size) + 'px ' + (serif ? SERIF : SANS);

  /* gold foil text with a dark outline and an optional moving shine */
  PA.goldText = function(cx, text, x, y, size, opts) {
    opts = opts || {};
    cx.save();
    cx.font = PA.font(size, 'bold', opts.sans ? false : true);
    cx.textAlign = opts.align || 'center';
    cx.textBaseline = 'middle';
    cx.lineJoin = 'round';
    cx.lineWidth = Math.max(2, size * 0.12);
    cx.strokeStyle = opts.outline || 'rgba(40,20,0,0.85)';
    cx.strokeText(text, x, y);
    const g = cx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    const c = opts.colors || ['#fff6c8', '#ffd54f', '#c98a12', '#ffe9a0'];
    g.addColorStop(0, c[0]);
    g.addColorStop(0.45, c[1]);
    g.addColorStop(0.55, c[2]);
    g.addColorStop(1, c[3]);
    cx.fillStyle = g;
    cx.fillText(text, x, y);
    if (opts.shine != null && opts.shine >= 0 && opts.shine <= 1) {
      const w = cx.measureText(text).width;
      const left = opts.align === 'left' ? x : x - w / 2;
      const sx = left - 60 + (w + 120) * opts.shine;
      const sg = cx.createLinearGradient(sx - 30, 0, sx + 30, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.85)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      cx.globalCompositeOperation = 'source-atop';
      cx.fillStyle = sg;
      cx.fillText(text, x, y);
    }
    cx.restore();
  };

  PA.text = function(cx, text, x, y, size, color, opts) {
    opts = opts || {};
    cx.font = PA.font(size, opts.weight || 'bold', opts.serif);
    cx.textAlign = opts.align || 'center';
    cx.textBaseline = opts.baseline || 'middle';
    if (opts.shadow !== false) {
      cx.fillStyle = 'rgba(0,0,0,0.55)';
      cx.fillText(text, x + 1, y + 1.5);
    }
    cx.fillStyle = color;
    cx.fillText(text, x, y);
  };

  PA.fitText = function(cx, text, maxW, size, weight, serif) {
    let s = size;
    cx.font = PA.font(s, weight, serif);
    while (s > 7 && cx.measureText(text).width > maxW) {
      --s;
      cx.font = PA.font(s, weight, serif);
    }
    return s;
  };

  PA.panel = function(cx, x, y, w, h, opts) {
    opts = opts || {};
    const r = opts.radius || 10;
    cx.save();
    CE.drawRoundedRect(cx, x + 2, y + 4, w, h, r);
    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.fill();
    CE.drawRoundedRect(cx, x, y, w, h, r);
    const g = cx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, opts.top || 'rgba(34,30,26,0.94)');
    g.addColorStop(1, opts.bottom || 'rgba(16,14,12,0.96)');
    cx.fillStyle = g;
    cx.fill();
    cx.strokeStyle = opts.border || 'rgba(214,170,80,0.65)';
    cx.lineWidth = 1.5;
    cx.stroke();
    CE.drawRoundedRect(cx, x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 3));
    cx.strokeStyle = 'rgba(255,230,170,0.10)';
    cx.lineWidth = 1;
    cx.stroke();
    cx.restore();
  };

  PA.bar = function(cx, x, y, w, h, frac, opts) {
    opts = opts || {};
    CE.drawRoundedRect(cx, x, y, w, h, h / 2);
    cx.fillStyle = 'rgba(0,0,0,0.55)';
    cx.fill();
    const f = Math.max(0, Math.min(1, frac));
    if (f > 0) {
      CE.drawRoundedRect(cx, x + 1, y + 1, Math.max(h - 2, (w - 2) * f), h - 2, (h - 2) / 2);
      const g = cx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, opts.light || '#ffe58a');
      g.addColorStop(1, opts.dark || '#c98a12');
      cx.fillStyle = g;
      cx.fill();
    }
    CE.drawRoundedRect(cx, x, y, w, h, h / 2);
    cx.strokeStyle = 'rgba(255,220,140,0.45)';
    cx.lineWidth = 1;
    cx.stroke();
  };

  PA.rays = function(cx, x, y, radius, t, color, n) {
    n = n || 14;
    cx.save();
    cx.translate(x, y);
    cx.rotate(t * 0.25);
    const g = cx.createRadialGradient(0, 0, 0, 0, 0, radius);
    g.addColorStop(0, color || 'rgba(255,220,120,0.45)');
    g.addColorStop(1, 'rgba(255,220,120,0)');
    cx.fillStyle = g;
    for (let k = 0; k < n; ++k) {
      const a = k / n * Math.PI * 2;
      cx.beginPath();
      cx.moveTo(0, 0);
      cx.arc(0, 0, radius, a, a + Math.PI / n * 0.9);
      cx.closePath();
      cx.fill();
    }
    cx.restore();
  };

  PA.ribbon = function(cx, x, y, w, h, color) {
    const fold = h * 0.5;
    cx.save();
    cx.fillStyle = CE.art ? CE.art.shade(color, -0.45) : color;
    cx.beginPath();
    cx.moveTo(x - fold * 1.6, y + fold * 0.4);
    cx.lineTo(x + fold * 0.2, y + fold * 0.4);
    cx.lineTo(x + fold * 0.2, y + h + fold * 0.4);
    cx.lineTo(x - fold * 1.6, y + h + fold * 0.4);
    cx.lineTo(x - fold * 0.9, y + h / 2 + fold * 0.4);
    cx.closePath();
    cx.fill();
    cx.beginPath();
    cx.moveTo(x + w + fold * 1.6, y + fold * 0.4);
    cx.lineTo(x + w - fold * 0.2, y + fold * 0.4);
    cx.lineTo(x + w - fold * 0.2, y + h + fold * 0.4);
    cx.lineTo(x + w + fold * 1.6, y + h + fold * 0.4);
    cx.lineTo(x + w + fold * 0.9, y + h / 2 + fold * 0.4);
    cx.closePath();
    cx.fill();
    const g = cx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, CE.art ? CE.art.shade(color, 0.25) : color);
    g.addColorStop(1, color);
    cx.fillStyle = g;
    cx.fillRect(x, y, w, h);
    cx.strokeStyle = 'rgba(255,225,150,0.7)';
    cx.lineWidth = 1;
    cx.strokeRect(x + 0.5, y + 3.5, w - 1, h - 7);
    cx.restore();
  };

  /* glossy button used by the suite's own screens; hover lifts it */
  PA.button = function(cx, x, y, w, h, label, opts) {
    opts = opts || {};
    const hover = opts.hover;
    const base = opts.color || '#3a3226';
    cx.save();
    if (hover) cx.translate(0, -1);
    CE.drawRoundedRect(cx, x, y + 2, w, h, h * 0.3);
    cx.fillStyle = 'rgba(0,0,0,0.4)';
    cx.fill();
    CE.drawRoundedRect(cx, x, y, w, h, h * 0.3);
    const g = cx.createLinearGradient(0, y, 0, y + h);
    const shade = CE.art ? CE.art.shade : (c) => c;
    g.addColorStop(0, shade(base, hover ? 0.35 : 0.22));
    g.addColorStop(0.5, shade(base, hover ? 0.12 : 0));
    g.addColorStop(1, shade(base, -0.3));
    cx.fillStyle = g;
    cx.fill();
    cx.strokeStyle = opts.border || (hover ? 'rgba(255,220,130,0.95)' : 'rgba(214,170,80,0.7)');
    cx.lineWidth = 1.2;
    cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,0.12)';
    CE.drawRoundedRect(cx, x + 2, y + 2, w - 4, h * 0.42, h * 0.25);
    cx.fill();
    const size = opts.fontSize || Math.min(15, h * 0.48);
    PA.text(cx, label, x + w / 2, y + h / 2 + 0.5, size, opts.textColor || '#fff4d6');
    cx.restore();
  };

  /* category emblems: little painted icons for the lobby and title cards */
  PA.emblem = function(cx, kind, x, y, s, color) {
    cx.save();
    cx.translate(x, y);
    cx.fillStyle = color || '#ffd54f';
    cx.strokeStyle = color || '#ffd54f';
    cx.lineWidth = 1.4 * s;
    switch (kind) {
      case 'Solitaire':
        for (let i = 0; i < 3; ++i) {
          CE.drawRoundedRect(cx, -9 * s + i * 4 * s, -8 * s + i * 3 * s, 10 * s, 13 * s, 2 * s);
          cx.fillStyle = i === 2 ? (color || '#ffd54f') : 'rgba(0,0,0,0.5)';
          cx.fill();
          cx.stroke();
        }
        break;
      case 'Casino':
        for (let i = 0; i < 3; ++i) {
          cx.beginPath();
          cx.ellipse(0, 6 * s - i * 4 * s, 9 * s, 3.4 * s, 0, 0, Math.PI * 2);
          cx.fillStyle = i % 2 ? '#c62828' : (color || '#ffd54f');
          cx.fill();
          cx.stroke();
        }
        break;
      case 'Shedding':
        for (let i = -1; i <= 1; ++i) {
          cx.save();
          cx.rotate(i * 0.35);
          CE.drawRoundedRect(cx, -4.5 * s, -11 * s, 9 * s, 13 * s, 2 * s);
          cx.fillStyle = ['#e53935', '#fdd835', '#1e88e5'][i + 1];
          cx.fill();
          cx.restore();
        }
        break;
      case 'Trick-Taking':
        cx.beginPath();
        cx.moveTo(-9 * s, -6 * s); cx.lineTo(9 * s, -6 * s); cx.lineTo(6 * s, 2 * s);
        cx.quadraticCurveTo(0, 7 * s, -6 * s, 2 * s); cx.closePath();
        cx.fill();
        cx.fillRect(-1.5 * s, 4 * s, 3 * s, 5 * s);
        cx.fillRect(-6 * s, 8 * s, 12 * s, 2.5 * s);
        break;
      case 'Rummy':
        for (let i = 0; i < 3; ++i) {
          CE.drawRoundedRect(cx, -11 * s + i * 7.5 * s, -7 * s, 7 * s, 14 * s, 1.5 * s);
          cx.fillStyle = i === 1 ? '#fff' : (color || '#ffd54f');
          cx.fill();
        }
        break;
      case 'Quick & Fun':
        cx.beginPath();
        cx.moveTo(2 * s, -11 * s); cx.lineTo(-7 * s, 2 * s); cx.lineTo(0, 2 * s);
        cx.lineTo(-3 * s, 11 * s); cx.lineTo(8 * s, -3 * s); cx.lineTo(1 * s, -3 * s);
        cx.closePath();
        cx.fill();
        break;
      case 'European':
        cx.beginPath();
        cx.moveTo(-10 * s, 6 * s); cx.lineTo(-10 * s, -5 * s); cx.lineTo(-5 * s, 0);
        cx.lineTo(0, -9 * s); cx.lineTo(5 * s, 0); cx.lineTo(10 * s, -5 * s); cx.lineTo(10 * s, 6 * s);
        cx.closePath();
        cx.fill();
        break;
      default:
        cx.beginPath();
        cx.arc(0, 0, 8 * s, 0, Math.PI * 2);
        cx.fill();
    }
    cx.restore();
  };

  PA.ease = {
    out: (p) => 1 - Math.pow(1 - p, 3),
    inOut: (p) => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
    back: (p) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
  };
  PA.clamp01 = (v) => Math.max(0, Math.min(1, v));
})();
