/* Table surfaces: felt, wood and stone painted once per size into a cached
   canvas (light pool, fibre noise, printed table line, vignette). Themes with
   an `unlock` entry are earned by playing (meta/profile.js decides). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;
  const CT = SZ.CardThemes || (SZ.CardThemes = {});

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  let noiseTile = null;
  function noise(cx) {
    if (!noiseTile) {
      noiseTile = document.createElement('canvas');
      noiseTile.width = 96;
      noiseTile.height = 96;
      const g = noiseTile.getContext('2d');
      const r = rng(77);
      if (g) {
        for (let i = 0; i < 2600; ++i) {
          const v = r() < 0.5 ? 0 : 255;
          g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.05 + r() * 0.12).toFixed(3) + ')';
          g.fillRect(Math.floor(r() * 96), Math.floor(r() * 96), 1, 1 + (r() < 0.3 ? 1 : 0));
        }
      }
    }
    return cx.createPattern ? cx.createPattern(noiseTile, 'repeat') : null;
  }

  function vignette(cx, w, h, strength) {
    const g = cx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);
  }

  function felt(c) {
    return function(cx, w, h) {
      const g = cx.createRadialGradient(w / 2, h * 0.45, 30, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      g.addColorStop(0, c.light);
      g.addColorStop(0.6, c.base);
      g.addColorStop(1, c.dark);
      cx.fillStyle = g;
      cx.fillRect(0, 0, w, h);
      const p = noise(cx);
      if (p) {
        cx.save();
        cx.globalAlpha = 0.55;
        cx.fillStyle = p;
        cx.fillRect(0, 0, w, h);
        cx.restore();
      }
      /* a printed racetrack line like a casino layout */
      cx.save();
      cx.strokeStyle = c.line || 'rgba(255,230,160,0.07)';
      cx.lineWidth = 2;
      CE.drawRoundedRect(cx, w / 2 - 330, h / 2 - 205, 660, 410, 190);
      cx.stroke();
      cx.lineWidth = 0.8;
      CE.drawRoundedRect(cx, w / 2 - 322, h / 2 - 197, 644, 394, 182);
      cx.stroke();
      cx.restore();
      if (c.decor) c.decor(cx, w, h);
      vignette(cx, w, h, c.vignette || 0.55);
    };
  }

  function wood(c) {
    return function(cx, w, h) {
      cx.fillStyle = c.base;
      cx.fillRect(0, 0, w, h);
      const r = rng(c.seed || 11);
      const plank = 74;
      for (let y = 0; y < h; y += plank) {
        const tone = (r() - 0.5) * 0.14;
        cx.fillStyle = tone > 0 ? 'rgba(255,220,170,' + tone.toFixed(3) + ')' : 'rgba(0,0,0,' + (-tone).toFixed(3) + ')';
        cx.fillRect(0, y, w, plank);
        cx.strokeStyle = 'rgba(0,0,0,0.35)';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.moveTo(0, y + 0.5); cx.lineTo(w, y + 0.5); cx.stroke();
        for (let k = 0; k < 14; ++k) {
          const gy = y + 4 + r() * (plank - 8);
          cx.strokeStyle = 'rgba(' + c.grain + ',' + (0.08 + r() * 0.16).toFixed(3) + ')';
          cx.lineWidth = 0.6 + r() * 1.2;
          cx.beginPath();
          cx.moveTo(0, gy);
          for (let x = 0; x <= w; x += 60)
            cx.lineTo(x, gy + Math.sin(x / (90 + r() * 60) + k) * (1.5 + r() * 2));
          cx.stroke();
        }
        if (r() < 0.6) {
          const kx = r() * w, ky = y + plank / 2;
          cx.strokeStyle = 'rgba(' + c.grain + ',0.25)';
          cx.lineWidth = 1;
          for (let i = 1; i < 4; ++i) {
            cx.beginPath();
            cx.ellipse(kx, ky, 6 * i, 2.4 * i, 0, 0, Math.PI * 2);
            cx.stroke();
          }
        }
      }
      const gl = cx.createLinearGradient(0, 0, 0, h);
      gl.addColorStop(0, 'rgba(255,240,210,0.10)');
      gl.addColorStop(0.5, 'rgba(255,240,210,0)');
      gl.addColorStop(1, 'rgba(0,0,0,0.12)');
      cx.fillStyle = gl;
      cx.fillRect(0, 0, w, h);
      vignette(cx, w, h, 0.5);
    };
  }

  function stone(c) {
    return function(cx, w, h) {
      const g = cx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, c.light);
      g.addColorStop(1, c.base);
      cx.fillStyle = g;
      cx.fillRect(0, 0, w, h);
      const r = rng(c.seed || 5);
      for (let i = 0; i < 26; ++i) {
        cx.strokeStyle = c.vein.replace('A', (0.06 + r() * 0.16).toFixed(3));
        cx.lineWidth = 0.5 + r() * 2.2;
        cx.beginPath();
        let x = r() * w, y = r() * h;
        cx.moveTo(x, y);
        for (let k = 0; k < 5; ++k) {
          const nx = x + (r() - 0.3) * 260, ny = y + (r() - 0.5) * 160;
          cx.quadraticCurveTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 120, nx, ny);
          x = nx; y = ny;
        }
        cx.stroke();
      }
      vignette(cx, w, h, c.vignette || 0.3);
    };
  }

  function snowDecor(cx, w, h) {
    const r = rng(3);
    cx.strokeStyle = 'rgba(255,255,255,0.10)';
    cx.lineWidth = 1;
    for (let i = 0; i < 46; ++i) {
      const x = r() * w, y = r() * h, s = 5 + r() * 12;
      for (let k = 0; k < 3; ++k) {
        const a = k * Math.PI / 3;
        cx.beginPath();
        cx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
        cx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        cx.stroke();
      }
    }
  }

  function leafDecor(color) {
    return function(cx, w, h) {
      const r = rng(9);
      for (let i = 0; i < 40; ++i) {
        const x = r() * w, y = r() * h, s = 5 + r() * 9;
        cx.save();
        cx.translate(x, y);
        cx.rotate(r() * Math.PI * 2);
        cx.fillStyle = color.replace('A', (0.05 + r() * 0.08).toFixed(3));
        cx.beginPath();
        cx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
        cx.fill();
        cx.restore();
      }
    };
  }

  function auroraDecor(cx, w, h) {
    const bands = [['rgba(80,255,190,0.10)', 0.25], ['rgba(120,140,255,0.09)', 0.4], ['rgba(220,120,255,0.07)', 0.55]];
    for (const [col, fy] of bands) {
      const g = cx.createLinearGradient(0, h * (fy - 0.15), 0, h * (fy + 0.15));
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g;
      cx.beginPath();
      cx.moveTo(0, h * fy);
      for (let x = 0; x <= w; x += 40)
        cx.lineTo(x, h * fy + Math.sin(x / 120 + fy * 9) * 40);
      cx.lineTo(w, h * (fy + 0.2));
      cx.lineTo(0, h * (fy + 0.2));
      cx.closePath();
      cx.fill();
    }
  }

  const PAINTERS = {
    green:    { name: 'Classic Green',  preview: '#1d5a26', paint: felt({ light: '#2c7a36', base: '#1b5a24', dark: '#0b2c10' }) },
    blue:     { name: 'Midnight Blue',  preview: '#163063', paint: felt({ light: '#24468a', base: '#152c5c', dark: '#070f24' }) },
    red:      { name: 'Casino Red',     preview: '#6a1a1a', paint: felt({ light: '#8a2424', base: '#5e1616', dark: '#240606' }) },
    wood:     { name: 'Oak Table',      preview: '#7a4b28', paint: wood({ base: '#7a4b28', grain: '60,30,10', seed: 11 }) },
    marble:   { name: 'White Marble',   preview: '#e8e4df', paint: stone({ light: '#f4f1ec', base: '#d8d2c8', vein: 'rgba(90,90,100,A)', vignette: 0.28 }) },
    purple:   { name: 'Royal Purple',   preview: '#3a1f5e', paint: felt({ light: '#55307e', base: '#371c58', dark: '#140822' }) },
    teal:     { name: 'Velvet Lagoon',  preview: '#0f4c52', unlock: { level: 3 },  paint: felt({ light: '#1b7078', base: '#0f4a50', dark: '#031a1d', line: 'rgba(160,255,240,0.08)' }) },
    mahogany: { name: 'Mahogany Club',  preview: '#5a2a18', unlock: { level: 6 },  paint: wood({ base: '#5a2716', grain: '30,8,2', seed: 23 }) },
    onyx:     { name: 'Black Onyx',     preview: '#1c1c22', unlock: { level: 9 },  paint: stone({ light: '#2c2c34', base: '#121216', vein: 'rgba(200,170,90,A)', vignette: 0.45 }) },
    aurora:   { name: 'Aurora Night',   preview: '#10203a', unlock: { level: 13 }, paint: felt({ light: '#1c3354', base: '#0f1d36', dark: '#03070f', decor: auroraDecor, line: 'rgba(160,220,255,0.06)' }) },
    emperor:  { name: 'Emperor Gold',   preview: '#4a3410', unlock: { level: 18 }, paint: felt({ light: '#7a5a1c', base: '#4a3410', dark: '#1a1004', line: 'rgba(255,220,120,0.14)' }) },
    frost:    { name: 'Winter Frost',   preview: '#24506e', unlock: { season: 'winter' }, paint: felt({ light: '#3a7096', base: '#22506e', dark: '#081a28', decor: snowDecor }) },
    blossom:  { name: 'Spring Blossom', preview: '#3e5a2c', unlock: { season: 'spring' }, paint: felt({ light: '#5a7a3c', base: '#3c5a2a', dark: '#14200c', decor: leafDecor('rgba(255,170,200,A)') }) },
    lagoon:   { name: 'Summer Lagoon',  preview: '#0a5a6a', unlock: { season: 'summer' }, paint: felt({ light: '#1aa0b0', base: '#0a5a6a', dark: '#022228', decor: leafDecor('rgba(255,240,180,A)') }) },
    harvest:  { name: 'Autumn Harvest', preview: '#5a3412', unlock: { season: 'autumn' }, paint: felt({ light: '#8a5420', base: '#5a3412', dark: '#1e0f04', decor: leafDecor('rgba(255,140,40,A)') }) }
  };

  const cache = new Map();
  function cached(id, w, h) {
    const res = Math.min(2, Math.max(1, Math.round((CE.pixelScale || 1) * 2) / 2));
    const key = id + '|' + Math.round(w) + 'x' + Math.round(h) + '@' + res;
    let c = cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * res));
      c.height = Math.max(1, Math.ceil(h * res));
      const g = c.getContext('2d');
      if (g) {
        g.scale(res, res);
        PAINTERS[id].paint(g, w, h);
      }
      cache.set(key, c);
      if (cache.size > 12) cache.delete(cache.keys().next().value);
    }
    return c;
  }

  CT.TABLE_THEMES = {};
  for (const id of Object.keys(PAINTERS)) {
    const p = PAINTERS[id];
    CT.TABLE_THEMES[id] = {
      name: p.name,
      preview: p.preview,
      unlock: p.unlock || null,
      draw(cx, w, h) {
        cx.drawImage(cached(id, w, h), 0, 0, w, h);
      },
      paint: p.paint
    };
  }
})();
