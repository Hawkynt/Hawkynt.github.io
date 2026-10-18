/* The procedural art kit: offscreen canvases and the sprite cache, colour maths, seeded value
   noise and fbm, and the shared glow, soft-smoke, bolt and ring sprites every effect is drawn
   from. Painting happens once per key; per-frame code only blits. Owns the sprite cache. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  /* sprites are painted at twice their logical size and drawn scaled down */
  const SCALE = 2;
  const cache = Object.create(null);
  let created = 0;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    ++created;
    return c;
  }

  /* A cached sprite: logical size w x h, painted by paint(ctx, w, h) in logical units */
  function sprite(key, w, h, paint) {
    let s = cache[key];
    if (s) return s;
    const c = makeCanvas(w * SCALE, h * SCALE);
    const g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    paint(g, w, h);
    s = cache[key] = { canvas: c, w: w, h: h, hw: w / 2, hh: h / 2 };
    return s;
  }

  function has(key) {
    return !!cache[key];
  }

  function stats() {
    return { created: created, keys: Object.keys(cache).length };
  }

  /* Draw a cached sprite centred on (x, y) */
  function blit(ctx, s, x, y, scale) {
    const k = scale || 1;
    ctx.drawImage(s.canvas, x - s.hw * k, y - s.hh * k, s.w * k, s.h * k);
  }

  /* Draw centred, rotated and optionally squashed (for rolls) */
  function blitRot(ctx, s, x, y, ang, scale, sy) {
    const k = scale || 1;
    ctx.translate(x, y);
    ctx.rotate(ang);
    if (sy !== undefined && sy !== 1) ctx.scale(1, sy);
    ctx.drawImage(s.canvas, -s.hw * k, -s.hh * k, s.w * k, s.h * k);
    if (sy !== undefined && sy !== 1) ctx.scale(1, 1 / sy);
    ctx.rotate(-ang);
    ctx.translate(-x, -y);
  }

  /* ── colours ── */
  function parse(hex) {
    let h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    const c = parse(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* k > 0 lightens toward white, k < 0 darkens toward black */
  function shade(hex, k) {
    const c = parse(hex);
    const t = k > 0 ? 255 : 0;
    const f = Math.abs(k);
    const r = Math.round(c[0] + (t - c[0]) * f), g = Math.round(c[1] + (t - c[1]) * f), b = Math.round(c[2] + (t - c[2]) * f);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function mix(a, b, t) {
    const x = parse(a), y = parse(b);
    const r = Math.round(x[0] + (y[0] - x[0]) * t), g = Math.round(x[1] + (y[1] - x[1]) * t), bl = Math.round(x[2] + (y[2] - x[2]) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  /* ── noise ── */
  function valueNoise(seed) {
    const perm = new Uint8Array(512);
    const rng = NS.rng.makeRng(seed);
    const vals = new Float32Array(256);
    for (let i = 0; i < 256; ++i) { perm[i] = i; vals[i] = rng(); }
    for (let i = 255; i > 0; --i) {
      const j = Math.floor(rng() * (i + 1));
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (let i = 0; i < 256; ++i) perm[i + 256] = perm[i];
    return function(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const X = xi & 255, Y = yi & 255;
      const a = vals[perm[perm[X] + Y]], b = vals[perm[perm[X + 1] + Y]];
      const c = vals[perm[perm[X] + Y + 1]], d = vals[perm[perm[X + 1] + Y + 1]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  function fbm(noise, x, y, oct) {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; ++i) {
      s += noise(x * f, y * f) * a;
      n += a;
      a *= 0.5;
      f *= 2.03;
    }
    return s / n;
  }

  function smooth(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  /* ── shared effect sprites ── */

  /* Soft light: a white-hot core fading through the colour to nothing (additive use) */
  function glow(color) {
    return sprite('glow:' + color, 64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba('#ffffff', 0.95));
      gr.addColorStop(0.12, rgba(color, 0.85));
      gr.addColorStop(0.4, rgba(color, 0.3));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    });
  }

  /* A smoke puff: a lumpy blob in the given colour (alpha use) */
  function puff(color) {
    return sprite('puff:' + color, 64, 64, (g) => {
      const n = valueNoise(NS.rng.hashString(color));
      for (let i = 0; i < 7; ++i) {
        const a = i * 0.9, d = i === 0 ? 0 : 10 + n(i, 1) * 6;
        const x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d, r = 14 + n(i, 3) * 10;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(color, 0.5));
        gr.addColorStop(1, rgba(color, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
      }
    });
  }

  /* An elongated energy bolt facing +x */
  function bolt(key, ramp, len, wid) {
    return sprite('bolt:' + key + ':' + len, len + wid * 2, wid * 2.4, (g, w, h) => {
      const cy = h / 2;
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, rgba(ramp[2], 0));
      gr.addColorStop(0.5, rgba(ramp[2], 0.55));
      gr.addColorStop(1, rgba(ramp[2], 0.75));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(w / 2, cy, w / 2, h / 2.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgba(ramp[1], 0.95);
      g.beginPath();
      g.ellipse(w * 0.58, cy, w * 0.36, h / 5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ramp[0];
      g.beginPath();
      g.ellipse(w * 0.64, cy, w * 0.24, h / 10, 0, 0, Math.PI * 2);
      g.fill();
    });
  }

  /* A round plasma orb with a bright core */
  function orb(key, ramp, r) {
    return sprite('orb:' + key + ':' + r, r * 4, r * 4, (g, w) => {
      const c = w / 2;
      const gr = g.createRadialGradient(c, c, 0, c, c, c);
      gr.addColorStop(0, ramp[0]);
      gr.addColorStop(0.22, ramp[1]);
      gr.addColorStop(0.45, rgba(ramp[2], 0.8));
      gr.addColorStop(1, rgba(ramp[2], 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
    });
  }

  /* A thin bright ring for shockwaves */
  function ringSprite(color) {
    return sprite('ring:' + color, 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64);
      gr.addColorStop(0, rgba(color, 0));
      gr.addColorStop(0.7, rgba(color, 0.5));
      gr.addColorStop(0.88, rgba('#ffffff', 0.85));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
  }

  /* A white silhouette of a sprite, for hit flashes */
  function silhouette(key, base) {
    return sprite('sil:' + key, base.w, base.h, (g, w, h) => {
      g.drawImage(base.canvas, 0, 0, w, h);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
  }

  function poly(g, pts) {
    g.beginPath();
    for (let i = 0; i < pts.length; ++i) {
      if (i === 0) g.moveTo(pts[i][0], pts[i][1]);
      else g.lineTo(pts[i][0], pts[i][1]);
    }
    g.closePath();
  }

  Object.assign(NS.artKit, {
    SCALE, makeCanvas, sprite, has, stats, blit, blitRot, parse, rgba, shade, mix, valueNoise, fbm, smooth,
    glow, puff, bolt, orb, ringSprite, silhouette, poly
  });
})();
