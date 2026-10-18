/* render/art-kit.js -- palettes, noise and pixel primitives for the code-drawn art, glows and shadows.
   Reads: constants, env, pixelArt. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const { CELL, TWO_PI, clamp, parseHex, shade } = NS.constants;
  const { ctx } = NS.env;
  const { makeCanvas } = NS.pixelArt;

  /* ══════════════════════════════════════════════════════════════════
     ART TOOLKIT -- palettes, noise and small helpers for code-drawn
     pixel art. One art pixel is two world units: a tile is 16 x 16.
     ══════════════════════════════════════════════════════════════════ */

  const AP = 2;                 // world units per art pixel
  const TILE = CELL / AP;       // art pixels per tile

  const RAMPS = {
    wood:   ['#3a2414', '#5a3820', '#7a4e2c', '#9a663a', '#bb824c', '#d8a466'],
    stone:  ['#33333f', '#4a4a58', '#62627280', '#7c7c8c', '#9a9aa8', '#c0c0cc'],
    metal:  ['#1e2433', '#30384a', '#475266', '#647088', '#8c98b0', '#c4ccdc'],
    gold:   ['#5a3c0c', '#8a5e14', '#b8861f', '#e0b030', '#ffd860', '#fff2b0'],
    iron:   ['#141418', '#24242c', '#383842', '#50505c', '#70707e', '#9a9aa8'],
    brick:  ['#4a1e16', '#6e2c1e', '#8e3c28', '#ae5236', '#c86c48', '#e08c64'],
    marble: ['#7a7480', '#9a96a2', '#b8b4c0', '#d4d0dc', '#ece8f2', '#ffffff'],
    leaf:   ['#173a1c', '#22522a', '#2e6a34', '#3e8442', '#58a052', '#7cbc64'],
    pine:   ['#0f2a26', '#163a33', '#1e4c42', '#2a6052', '#3a7662', '#4e8c74'],
    snow:   ['#8aa2bc', '#a6bcd2', '#c2d4e6', '#dae6f2', '#eef4fa', '#ffffff'],
    ice:    ['#2a5f8c', '#3f7eb0', '#5a9cd0', '#80bce6', '#b0dcf6', '#e6f8ff'],
    lava:   ['#4a0e06', '#8a1e08', '#d03c0a', '#ff6a14', '#ffa63a', '#ffe48a'],
    water:  ['#173468', '#1f4888', '#2a5fae', '#3a7ad0', '#62a0e6', '#a8d4f6'],
    bog:    ['#0a1511', '#0f2019', '#163024', '#1f402f', '#3c6650', '#5e8a5e'],
    chasm:  ['#020106', '#07040f', '#0e0919', '#181028', '#241a3c', '#332552'],
    venom:  ['#163a10', '#22581a', '#348a26', '#4cb43a', '#7ce35a', '#c4ff9a'],
    flesh:  ['#5a3020', '#7a4430', '#9a5c40', '#ba7854', '#d4986c', '#ecbc94'],
    cloth:  ['#2a1838', '#3e2450', '#56346c', '#704a8a', '#8e64a8', '#b08cc8'],
    bone:   ['#5a5448', '#7a7464', '#9c9682', '#bcb6a0', '#dcd6c0', '#f6f2e2']
  };
  RAMPS.stone[2] = '#626272';

  // A 6-step ramp around any base colour
  const rampCache = {};
  function rampOf(hex) {
    let r = rampCache[hex];
    if (!r)
      r = rampCache[hex] = [shade(hex, -0.7), shade(hex, -0.48), shade(hex, -0.25), hex, shade(hex, 0.3), shade(hex, 0.62)];
    return r;
  }

  /* ── Noise ── */
  function hash2(x, y, seed) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1442695041;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  function valueNoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function fbm(x, y, seed) {
    return valueNoise(x, y, seed) * 0.55 + valueNoise(x * 2.1, y * 2.1, seed + 7) * 0.3 + valueNoise(x * 4.3, y * 4.3, seed + 13) * 0.15;
  }

  // 4x4 ordered dither threshold in [0,1)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) {
    return BAYER[(y & 3) * 4 + (x & 3)] / 16;
  }

  // Pick a ramp entry from a 0..1 value with ordered dithering between steps
  function rampPick(ramp, v, x, y, lo, hi) {
    lo = lo || 0;
    hi = hi === undefined ? ramp.length - 1 : hi;
    const f = lo + clamp(v, 0, 0.999) * (hi - lo + 1) - 0.5;
    let i = Math.floor(f);
    if (f - i > bayer(x, y)) ++i;
    return ramp[clamp(i, lo, hi)];
  }

  /* ── Drawing helpers (art pixels) ── */
  function px(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  }

  // Bevelled block: light top/left edge, dark bottom/right edge
  function block(g, x, y, w, h, ramp, k) {
    k = k === undefined ? 3 : k;
    px(g, x, y, w, h, ramp[k]);
    px(g, x, y, w, 1, ramp[k + 1] || ramp[k]);
    px(g, x, y, 1, h, ramp[k + 1] || ramp[k]);
    px(g, x, y + h - 1, w, 1, ramp[k - 1]);
    px(g, x + w - 1, y, 1, h, ramp[k - 1]);
  }

  function disc(g, cx, cy, r, ramp, k) {
    k = k === undefined ? 3 : k;
    g.fillStyle = ramp[k - 1];
    g.beginPath(); g.arc(cx, cy, r, 0, TWO_PI); g.fill();
    g.fillStyle = ramp[k];
    g.beginPath(); g.arc(cx - r * 0.12, cy - r * 0.15, r * 0.82, 0, TWO_PI); g.fill();
    g.fillStyle = ramp[k + 1] || ramp[k];
    g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.38, r * 0.34, 0, TWO_PI); g.fill();
  }

  function ellipseFill(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, TWO_PI); g.fill();
  }

  function poly(g, pts, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  }

  function line(g, x0, y0, x1, y1, c, w) {
    g.strokeStyle = c;
    g.lineWidth = w || 1;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }

  /* ── Cached soft glows (one gradient per colour, drawn additively) ── */
  const glowCache = {};
  function getGlow(color) {
    let c = glowCache[color];
    if (!c) {
      c = glowCache[color] = makeCanvas(64, 64);
      const g = c.getContext('2d');
      const [r, gg, b] = parseHex(color);
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
      grad.addColorStop(0.35, `rgba(${r},${gg},${b},0.45)`);
      grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    return c;
  }

  function drawGlow(color, x, y, r, alpha) {
    if (alpha <= 0.01 || r <= 0) return;
    const prev = ctx.globalCompositeOperation, pa = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pa * Math.min(1, alpha);
    ctx.drawImage(getGlow(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = pa;
    ctx.globalCompositeOperation = prev;
  }

  // Soft dark blob used for ground shadows
  let shadowBlob = null;
  function drawShadow(x, y, rx, ry, alpha) {
    if (!shadowBlob) {
      shadowBlob = makeCanvas(32, 16);
      const g = shadowBlob.getContext('2d');
      const grad = g.createRadialGradient(16, 8, 0, 16, 8, 16);
      grad.addColorStop(0, 'rgba(0,0,0,0.55)');
      grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.save(); g.scale(1, 0.5); g.fillRect(0, 0, 32, 32); g.restore();
    }
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * (alpha === undefined ? 1 : alpha);
    ctx.drawImage(shadowBlob, x - rx, y - ry, rx * 2, ry * 2);
    ctx.globalAlpha = pa;
  }

  // Pixel sprite drawn at world position (cx, bottom) with art pixel scale
  function blitArt(img, cx, bottomY, flip, alpha, scale) {
    if (!img) return;
    const s = AP * (scale || 1);
    const w = img.width * s, h = img.height * s;
    const pa = ctx.globalAlpha;
    if (alpha !== undefined) ctx.globalAlpha = pa * alpha;
    if (flip) {
      ctx.save();
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, bottomY - h, w, h);
      ctx.restore();
    } else
      ctx.drawImage(img, cx - w / 2, bottomY - h, w, h);
    ctx.globalAlpha = pa;
  }

  // White silhouette of a sprite (hit flashes)
  const flashCache = new WeakMap();
  function flashOf(img) {
    let f = flashCache.get(img);
    if (!f) {
      f = makeCanvas(img.width, img.height);
      const g = f.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, f.width, f.height);
      flashCache.set(img, f);
    }
    return f;
  }

  NS.artKit = { AP, TILE, RAMPS, rampOf, hash2, valueNoise, fbm, rampPick, px, block, disc, ellipseFill,
      poly, line, drawGlow, drawShadow, blitArt, flashOf };

})();
