/* Card back designs: a shared frame (white border, gradient panel, double rule,
   centre medallion) plus one pattern per design. Painted once per size into the
   sprite cache. Designs with `unlock` are earned (levels, achievements, seasons). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;
  const CT = SZ.CardThemes || (SZ.CardThemes = {});

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function lighten(hex, amt) {
    return CE.art && CE.art.shade ? CE.art.shade(hex, amt) : hex;
  }

  /* the frame every design shares; `pattern(cx, x, y, w, h, s)` fills the panel */
  function frame(base, rule, pattern, emblem) {
    return function(cx, x, y, w, h) {
      const s = Math.min(w / CE.CARD_W, h / CE.CARD_H);
      const r = CE.CARD_RADIUS * s + 0.5;
      CE.drawRoundedRect(cx, x, y, w, h, r);
      cx.fillStyle = '#fbfaf6';
      cx.fill();
      const m = Math.max(2, 4 * s);
      const px = x + m, py = y + m, pw = w - m * 2, ph = h - m * 2;
      cx.save();
      CE.drawRoundedRect(cx, px, py, pw, ph, Math.max(1, r - 1));
      const g = cx.createLinearGradient(px, py, px + pw, py + ph);
      g.addColorStop(0, lighten(base, 0.18));
      g.addColorStop(0.5, base);
      g.addColorStop(1, lighten(base, -0.3));
      cx.fillStyle = g;
      cx.fill();
      cx.clip();
      pattern(cx, px, py, pw, ph, s);
      /* sheen */
      const sh = cx.createLinearGradient(px, py, px + pw, py + ph * 0.6);
      sh.addColorStop(0, 'rgba(255,255,255,0.16)');
      sh.addColorStop(0.45, 'rgba(255,255,255,0)');
      cx.fillStyle = sh;
      cx.fillRect(px, py, pw, ph);
      cx.restore();
      /* double rule */
      cx.strokeStyle = rule;
      cx.lineWidth = Math.max(0.6, 1.1 * s);
      CE.drawRoundedRect(cx, px + 2.5 * s, py + 2.5 * s, pw - 5 * s, ph - 5 * s, Math.max(1, r - 2));
      cx.stroke();
      cx.lineWidth = Math.max(0.4, 0.5 * s);
      CE.drawRoundedRect(cx, px + 4.5 * s, py + 4.5 * s, pw - 9 * s, ph - 9 * s, Math.max(1, r - 3));
      cx.stroke();
      if (emblem !== false && s > 0.45) medallion(cx, x + w / 2, y + h / 2, s, base, rule, emblem);
      CE.drawRoundedRect(cx, x + 0.5, y + 0.5, w - 1, h - 1, r);
      cx.strokeStyle = 'rgba(30,30,30,0.6)';
      cx.lineWidth = 1;
      cx.stroke();
    };
  }

  function medallion(cx, mx, my, s, base, rule, emblem) {
    const rr = 13 * s;
    cx.fillStyle = lighten(base, -0.35);
    cx.beginPath();
    cx.ellipse(mx, my, rr, rr * 1.25, 0, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = rule;
    cx.lineWidth = 1.2 * s;
    cx.stroke();
    cx.fillStyle = rule;
    if (typeof emblem === 'function') emblem(cx, mx, my, s);
    else {
      cx.font = 'bold ' + (12 * s).toFixed(1) + 'px Georgia, serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(emblem || 'SZ', mx, my + 0.5 * s);
    }
  }

  /* ── patterns ── */
  function lattice(color, step) {
    return (cx, x, y, w, h, s) => {
      const st = step * s;
      cx.strokeStyle = color;
      cx.lineWidth = 0.7 * s;
      for (let d = -h; d < w + h; d += st) {
        cx.beginPath(); cx.moveTo(x + d, y); cx.lineTo(x + d + h, y + h); cx.stroke();
        cx.beginPath(); cx.moveTo(x + d, y + h); cx.lineTo(x + d + h, y); cx.stroke();
      }
    };
  }

  function tartan(c1, c2) {
    return (cx, x, y, w, h, s) => {
      const st = 14 * s;
      cx.fillStyle = c1;
      for (let i = 0; i < w; i += st) cx.fillRect(x + i, y, 4 * s, h);
      for (let j = 0; j < h; j += st) cx.fillRect(x, y + j, w, 4 * s);
      cx.fillStyle = c2;
      for (let i = 7 * s; i < w; i += st) cx.fillRect(x + i, y, 1 * s, h);
      for (let j = 7 * s; j < h; j += st) cx.fillRect(x, y + j, w, 1 * s);
    };
  }

  function scrolls(color) {
    return (cx, x, y, w, h, s) => {
      cx.strokeStyle = color;
      cx.lineWidth = 0.9 * s;
      const st = 18 * s;
      for (let j = 0; j < h + st; j += st)
        for (let i = 0; i < w + st; i += st) {
          const ox = x + i + ((j / st) % 2 ? st / 2 : 0), oy = y + j;
          cx.beginPath();
          cx.arc(ox, oy, st * 0.32, 0, Math.PI * 1.5);
          cx.stroke();
          cx.beginPath();
          cx.arc(ox + st * 0.32, oy, st * 0.14, Math.PI, Math.PI * 2.6);
          cx.stroke();
        }
    };
  }

  function rings(color) {
    return (cx, x, y, w, h, s) => {
      cx.strokeStyle = color;
      cx.lineWidth = 1.4 * s;
      const st = 16 * s;
      for (let j = 0; j < h + st; j += st)
        for (let i = 0; i < w + st; i += st) {
          cx.beginPath();
          cx.arc(x + i, y + j, st * 0.55, 0, Math.PI * 2);
          cx.stroke();
        }
    };
  }

  function stars(color, seed, n) {
    return (cx, x, y, w, h, s) => {
      const r = rng(seed);
      for (let i = 0; i < n; ++i) {
        const sx = x + r() * w, sy = y + r() * h, sz = (0.4 + r() * 1.4) * s;
        cx.fillStyle = color.replace('A', (0.35 + r() * 0.6).toFixed(2));
        cx.beginPath();
        cx.arc(sx, sy, sz, 0, Math.PI * 2);
        cx.fill();
      }
      cx.strokeStyle = color.replace('A', '0.25');
      cx.lineWidth = 0.6 * s;
      for (let k = 0; k < 3; ++k) {
        cx.beginPath();
        cx.ellipse(x + w / 2, y + h / 2, w * (0.25 + k * 0.14), h * (0.12 + k * 0.08), -0.5, 0, Math.PI * 2);
        cx.stroke();
      }
    };
  }

  function flames(c1, c2) {
    return (cx, x, y, w, h, s) => {
      const r = rng(4);
      for (let i = 0; i < 14; ++i) {
        const fx = x + r() * w, fh = (20 + r() * 40) * s, fw = (6 + r() * 8) * s;
        const gy = y + h;
        const g = cx.createLinearGradient(fx, gy, fx, gy - fh);
        g.addColorStop(0, c1);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = g;
        cx.beginPath();
        cx.moveTo(fx - fw, gy);
        cx.quadraticCurveTo(fx - fw, gy - fh * 0.6, fx, gy - fh);
        cx.quadraticCurveTo(fx + fw, gy - fh * 0.6, fx + fw, gy);
        cx.fill();
      }
      for (let i = 0; i < 30; ++i) {
        cx.fillStyle = c2;
        cx.globalAlpha = 0.3 + r() * 0.5;
        cx.fillRect(x + r() * w, y + r() * h * 0.7, 1.2 * s, 1.2 * s);
      }
      cx.globalAlpha = 1;
    };
  }

  function deco(color) {
    return (cx, x, y, w, h, s) => {
      cx.strokeStyle = color;
      cx.lineWidth = 0.8 * s;
      const st = 16 * s;
      for (let j = 0; j < h + st; j += st * 0.8)
        for (let i = 0; i < w + st; i += st) {
          const ox = x + i + ((Math.round(j / (st * 0.8))) % 2 ? st / 2 : 0);
          for (let k = 1; k <= 3; ++k) {
            cx.beginPath();
            cx.arc(ox, y + j, st * 0.18 * k, Math.PI, Math.PI * 2);
            cx.stroke();
          }
        }
    };
  }

  function scatter(draw, seed, n) {
    return (cx, x, y, w, h, s) => {
      const r = rng(seed);
      for (let i = 0; i < n; ++i) {
        cx.save();
        cx.translate(x + r() * w, y + r() * h);
        cx.rotate(r() * Math.PI * 2);
        draw(cx, (0.6 + r() * 0.8) * s, r);
        cx.restore();
      }
    };
  }

  const flake = (color) => (cx, s) => {
    cx.strokeStyle = color;
    cx.lineWidth = 0.8 * s;
    for (let k = 0; k < 3; ++k) {
      cx.rotate(Math.PI / 3);
      cx.beginPath(); cx.moveTo(-6 * s, 0); cx.lineTo(6 * s, 0); cx.stroke();
    }
  };
  const petal = (color) => (cx, s) => {
    cx.fillStyle = color;
    for (let k = 0; k < 5; ++k) {
      cx.rotate(Math.PI * 2 / 5);
      cx.beginPath(); cx.ellipse(0, -3.5 * s, 2 * s, 3.5 * s, 0, 0, Math.PI * 2); cx.fill();
    }
  };
  const leaf = (color) => (cx, s) => {
    cx.fillStyle = color;
    cx.beginPath();
    cx.moveTo(0, -7 * s);
    for (let k = 0; k < 5; ++k) {
      const a = -Math.PI / 2 + (k + 0.5) * Math.PI * 2 / 5;
      cx.lineTo(Math.cos(a) * 3 * s, Math.sin(a) * 3 * s);
      cx.lineTo(Math.cos(a + Math.PI / 5) * 7 * s, Math.sin(a + Math.PI / 5) * 7 * s);
    }
    cx.fill();
  };
  const shell = (color) => (cx, s) => {
    cx.strokeStyle = color;
    cx.lineWidth = 0.7 * s;
    for (let k = -2; k <= 2; ++k) {
      cx.beginPath(); cx.moveTo(0, 4 * s); cx.lineTo(k * 2.4 * s, -5 * s); cx.stroke();
    }
    cx.beginPath(); cx.arc(0, 0, 5.5 * s, Math.PI * 1.1, Math.PI * 1.9); cx.stroke();
  };
  const heart = (color) => (cx, s) => {
    cx.fillStyle = color;
    cx.beginPath();
    cx.moveTo(0, 3 * s);
    cx.bezierCurveTo(-6 * s, -2 * s, -3 * s, -6 * s, 0, -3 * s);
    cx.bezierCurveTo(3 * s, -6 * s, 6 * s, -2 * s, 0, 3 * s);
    cx.fill();
  };
  const holly = (cx, s, r) => {
    cx.fillStyle = 'rgba(60,160,80,0.55)';
    cx.beginPath(); cx.ellipse(-3 * s, 0, 4 * s, 1.8 * s, 0.4, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.ellipse(3 * s, 0, 4 * s, 1.8 * s, -0.4, 0, Math.PI * 2); cx.fill();
    cx.fillStyle = r() < 0.5 ? '#ff5252' : '#ffd54f';
    cx.beginPath(); cx.arc(0, 0, 1.6 * s, 0, Math.PI * 2); cx.fill();
  };
  const pumpkin = (cx, s) => {
    cx.fillStyle = 'rgba(255,140,30,0.75)';
    cx.beginPath(); cx.ellipse(0, 0, 5 * s, 4 * s, 0, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = 'rgba(120,50,0,0.6)';
    cx.lineWidth = 0.5 * s;
    cx.beginPath(); cx.ellipse(0, 0, 2 * s, 4 * s, 0, 0, Math.PI * 2); cx.stroke();
    cx.fillStyle = 'rgba(40,20,0,0.8)';
    cx.fillRect(-0.5 * s, -5.5 * s, 1 * s, 2 * s);
  };

  function rays(color) {
    return (cx, x, y, w, h, s) => {
      cx.fillStyle = color;
      const mx = x + w / 2, my = y + h / 2;
      for (let k = 0; k < 24; k += 2) {
        const a0 = k / 24 * Math.PI * 2, a1 = (k + 1) / 24 * Math.PI * 2;
        cx.beginPath();
        cx.moveTo(mx, my);
        cx.lineTo(mx + Math.cos(a0) * w * 1.2, my + Math.sin(a0) * w * 1.2);
        cx.lineTo(mx + Math.cos(a1) * w * 1.2, my + Math.sin(a1) * w * 1.2);
        cx.fill();
      }
    };
  }

  function scales(color) {
    return (cx, x, y, w, h, s) => {
      cx.strokeStyle = color;
      cx.lineWidth = 0.8 * s;
      const st = 9 * s;
      for (let j = 0, row = 0; j < h + st; j += st * 0.6, ++row)
        for (let i = 0; i < w + st; i += st) {
          cx.beginPath();
          cx.arc(x + i + (row % 2 ? st / 2 : 0), y + j, st / 2, 0, Math.PI);
          cx.stroke();
        }
    };
  }

  function feathers(c1, c2) {
    return (cx, x, y, w, h, s) => {
      const mx = x + w / 2, my = y + h * 0.85;
      for (let k = -6; k <= 6; ++k) {
        cx.save();
        cx.translate(mx, my);
        cx.rotate(k * 0.18);
        const g = cx.createLinearGradient(0, 0, 0, -h * 0.85);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        cx.fillStyle = g;
        cx.beginPath();
        cx.ellipse(0, -h * 0.42, 6 * s, h * 0.42, 0, 0, Math.PI * 2);
        cx.fill();
        cx.restore();
      }
    };
  }

  function facets(color) {
    return (cx, x, y, w, h, s) => {
      const r = rng(21);
      for (let i = 0; i < 26; ++i) {
        cx.fillStyle = color.replace('A', (0.04 + r() * 0.14).toFixed(3));
        cx.beginPath();
        cx.moveTo(x + r() * w, y + r() * h);
        cx.lineTo(x + r() * w, y + r() * h);
        cx.lineTo(x + r() * w, y + r() * h);
        cx.fill();
      }
    };
  }

  function custom(cx, x, y, w, h) {
    const base = CT.activeTheme ? CT.activeTheme.customBackColor : '#1a237e';
    frame(base, 'rgba(255,255,255,0.7)', lattice('rgba(255,255,255,0.16)', 9))(cx, x, y, w, h);
  }

  const DESIGNS = {
    navy_diamonds: { name: 'Navy Diamonds', preview: '#1a237e', draw: frame('#1c2a8c', '#c5cae9', lattice('rgba(160,180,255,0.35)', 9)) },
    red_tartan:    { name: 'Red Tartan', preview: '#8b1a1a', draw: frame('#8b1a1a', '#ffcdd2', tartan('rgba(0,0,0,0.25)', 'rgba(255,220,120,0.5)')) },
    green_classic: { name: 'Green Classic', preview: '#1b5e20', draw: frame('#1b5e20', '#c8e6c9', scrolls('rgba(200,255,200,0.25)')) },
    royal_gold:    { name: 'Royal Gold', preview: '#b8860b', draw: frame('#9a6e0a', '#fff3c4', lattice('rgba(255,236,150,0.4)', 12), '♛') },
    custom:        { name: 'Custom Color', preview: '#1a237e', draw: custom },
    sapphire:      { name: 'Sapphire Facets', preview: '#0d47a1', unlock: { level: 4 }, draw: frame('#0d47a1', '#bbdefb', facets('rgba(200,230,255,A)'), '◆') },
    jade:          { name: 'Jade Dragon', preview: '#00695c', unlock: { level: 8 }, draw: frame('#00695c', '#ffe082', scales('rgba(180,255,220,0.35)'), '龍') },
    obsidian:      { name: 'Obsidian', preview: '#1c1c22', unlock: { level: 12 }, draw: frame('#1a1a20', '#d4af37', deco('rgba(212,175,55,0.35)'), '♠') },
    phoenix:       { name: 'Phoenix', preview: '#bf360c', unlock: { level: 16 }, draw: frame('#8a1c06', '#ffd54f', feathers('rgba(255,120,30,0.65)', 'rgba(255,230,120,0.2)'), false) },
    filigree:      { name: 'Gold Filigree', preview: '#5d1020', unlock: { achievement: true }, draw: frame('#5d1020', '#ffd54f', scrolls('rgba(255,213,79,0.45)'), '♥') },
    celtic:        { name: 'Celtic Knot', preview: '#1b4d2e', unlock: { achievement: true }, draw: frame('#1b4d2e', '#e0f2c0', rings('rgba(230,255,200,0.3)'), '♣') },
    starfield:     { name: 'Starfield', preview: '#0b1030', unlock: { achievement: true }, draw: frame('#0b1030', '#b3c7ff', stars('rgba(255,255,255,A)', 8, 90), '✦') },
    ember:         { name: 'Ember', preview: '#3a0d05', unlock: { achievement: true }, draw: frame('#2a0a04', '#ffab40', flames('rgba(255,110,20,0.7)', '#ffd180'), false) },
    art_deco:      { name: 'Art Deco', preview: '#102a2a', unlock: { achievement: true }, draw: frame('#0f2a2a', '#e6c56a', deco('rgba(230,197,106,0.45)'), '♦') },
    snowflake:     { name: 'Snowflake', preview: '#1e4f7a', unlock: { season: 'winter' }, draw: frame('#1e4f7a', '#e3f2fd', scatter(flake('rgba(255,255,255,0.6)'), 2, 26), '❄') },
    sakura:        { name: 'Sakura', preview: '#8e3a5e', unlock: { season: 'spring' }, draw: frame('#7a2e50', '#ffd6e6', scatter(petal('rgba(255,200,225,0.55)'), 3, 26), false) },
    seashell:      { name: 'Seashell', preview: '#00838f', unlock: { season: 'summer' }, draw: frame('#00838f', '#fff3d6', scatter(shell('rgba(255,245,220,0.55)'), 4, 22), false) },
    maple:         { name: 'Maple', preview: '#8a3a08', unlock: { season: 'autumn' }, draw: frame('#7a3006', '#ffcc80', scatter(leaf('rgba(255,170,60,0.55)'), 5, 22), false) },
    festive:       { name: 'Yuletide', preview: '#7a1010', unlock: { event: 'yuletide' }, draw: frame('#7a1010', '#ffe082', scatter(holly, 6, 20), '★') },
    pumpkin:       { name: 'Hallows', preview: '#2a1440', unlock: { event: 'hallows' }, draw: frame('#2a1440', '#ffab40', scatter(pumpkin, 7, 18), '☾') },
    sweetheart:    { name: 'Sweetheart', preview: '#ad1457', unlock: { event: 'sweethearts' }, draw: frame('#ad1457', '#ffe4ec', scatter(heart('rgba(255,220,235,0.6)'), 8, 24), '♥') },
    sunburst:      { name: 'Sunburst', preview: '#e65100', unlock: { event: 'midsummer' }, draw: frame('#d84a00', '#fff59d', rays('rgba(255,236,120,0.25)'), '☀') }
  };

  CT.CARD_BACK_DESIGNS = DESIGNS;
})();
