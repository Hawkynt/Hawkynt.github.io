/* Coloured action cards for the Uno-style games (Uno family, Dos, ONO 99,
   8-Color Duo, Skip-Bo, Phase 10): a white rim, a glossy colour field, the
   tilted centre oval with the big label and corner indices; wilds get the
   four-colour oval on black. Cached as sprites and moved by engine/motion.js. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;

  const NAMED = {
    red: '#e53935', blue: '#1e63d6', green: '#2e9b3a', yellow: '#f4b400',
    purple: '#8e3fc0', orange: '#f57c00', pink: '#e8579a', teal: '#00a3a3',
    wild: '#151515', black: '#151515'
  };
  const WILD_QUADS = ['#e53935', '#1e63d6', '#f4b400', '#2e9b3a'];

  CE.colorOf = (c) => NAMED[c] || c || '#151515';

  function shade(c, a) {
    return CE.art && CE.art.shade ? CE.art.shade(c, a) : c;
  }

  function fitFont(cx, text, max, size) {
    let s = size;
    cx.font = 'bold ' + s + 'px "Segoe UI", "Trebuchet MS", Arial, sans-serif';
    while (s > 6 && cx.measureText(text).width > max) {
      --s;
      cx.font = 'bold ' + s + 'px "Segoe UI", "Trebuchet MS", Arial, sans-serif';
    }
    return s;
  }

  /* paints one card at the origin; spec: { color, label, wild, corner, ink } */
  function paint(cx, w, h, spec) {
    const s = Math.min(w / CE.CARD_W, h / CE.CARD_H);
    const r = CE.CARD_RADIUS * s + 1;
    const base = CE.colorOf(spec.color);
    CE.drawRoundedRect(cx, 0, 0, w, h, r);
    cx.fillStyle = '#fbfbf7';
    cx.fill();
    const m = Math.max(2, 4 * s);
    CE.drawRoundedRect(cx, m, m, w - m * 2, h - m * 2, Math.max(1, r - 1.5));
    const g = cx.createLinearGradient(0, 0, w * 0.4, h);
    g.addColorStop(0, shade(base, 0.22));
    g.addColorStop(0.55, base);
    g.addColorStop(1, shade(base, -0.28));
    cx.fillStyle = g;
    cx.fill();

    /* centre oval */
    cx.save();
    cx.translate(w / 2, h / 2);
    cx.rotate(-0.42);
    const ow = w * 0.34, oh = h * 0.42;
    if (spec.wild) {
      cx.beginPath();
      cx.ellipse(0, 0, ow, oh, 0, 0, Math.PI * 2);
      cx.clip();
      for (let q = 0; q < 4; ++q) {
        cx.fillStyle = WILD_QUADS[q];
        cx.beginPath();
        cx.moveTo(0, 0);
        cx.arc(0, 0, Math.max(ow, oh) * 1.2, q * Math.PI / 2 - Math.PI, (q + 1) * Math.PI / 2 - Math.PI);
        cx.closePath();
        cx.fill();
      }
    } else {
      cx.beginPath();
      cx.ellipse(0, 0, ow, oh, 0, 0, Math.PI * 2);
      cx.fillStyle = '#fbfbf7';
      cx.fill();
    }
    cx.restore();
    cx.save();
    cx.translate(w / 2, h / 2);
    cx.rotate(-0.42);
    cx.beginPath();
    cx.ellipse(0, 0, ow, oh, 0, 0, Math.PI * 2);
    cx.strokeStyle = 'rgba(0,0,0,0.25)';
    cx.lineWidth = 1;
    cx.stroke();
    cx.restore();

    /* big label */
    const label = String(spec.label == null ? '' : spec.label);
    const ink = spec.wild ? '#fff' : (spec.ink || base);
    const size = fitFont(cx, label, w * 0.62, Math.round((label.length > 2 ? 20 : 30) * s));
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.lineJoin = 'round';
    cx.lineWidth = Math.max(2, size * 0.16);
    cx.strokeStyle = spec.wild ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.35)';
    cx.strokeText(label, w / 2 + 1, h / 2 + 1.5);
    cx.fillStyle = ink;
    cx.fillText(label, w / 2, h / 2 + 0.5);
    if (spec.wild) {
      cx.lineWidth = 0.8;
      cx.strokeStyle = 'rgba(0,0,0,0.35)';
      cx.strokeText(label, w / 2, h / 2 + 0.5);
    }

    /* corners */
    const corner = String(spec.corner == null ? label : spec.corner);
    if (corner && s > 0.45) {
      fitFont(cx, corner, w * 0.36, Math.round(12 * s));
      cx.fillStyle = '#fff';
      cx.textAlign = 'left';
      cx.textBaseline = 'top';
      cx.fillText(corner, m + 3 * s, m + 2 * s);
      cx.save();
      cx.translate(w - m - 3 * s, h - m - 2 * s);
      cx.rotate(Math.PI);
      cx.fillText(corner, 0, 0);
      cx.restore();
    }
    /* sheen */
    CE.drawRoundedRect(cx, m, m, w - m * 2, (h - m * 2) * 0.45, Math.max(1, r - 1.5));
    const sh = cx.createLinearGradient(0, m, 0, h * 0.5);
    sh.addColorStop(0, 'rgba(255,255,255,0.22)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = sh;
    cx.fill();
    CE.drawRoundedRect(cx, 0.5, 0.5, w - 1, h - 1, r);
    cx.strokeStyle = 'rgba(0,0,0,0.45)';
    cx.lineWidth = 1;
    cx.stroke();
  }

  /* public: draw a coloured card; `card` (optional) lets it glide like the others */
  CE.drawColorCard = function(cx, x, y, w, h, spec, card) {
    w = w || CE.CARD_W;
    h = h || CE.CARD_H;
    const key = 'c|' + spec.color + '|' + spec.label + '|' + (spec.corner == null ? '' : spec.corner) + '|' + (spec.wild ? 1 : 0) + '|' + (spec.ink || '');
    CE.drawSpriteCard(cx, x, y, w, h, key, (g) => paint(g, w, h, spec), card);
  };
})();
