/* The procedural art kit: offscreen canvases and the sprite cache (painted once per key at
   twice the size, only blitted per frame), colour maths, seeded value noise, and the shared
   glow and ring sprites every effect is drawn from. Owns the sprite cache. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

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

  /* A cached sprite of logical size w x h painted by paint(ctx, w, h) in logical units */
  function sprite(key, w, h, paint, scale) {
    let s = cache[key];
    if (s) return s;
    const k = scale || SCALE;
    const c = makeCanvas(w * k, h * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    paint(g, w, h);
    s = cache[key] = { canvas: c, w: w, h: h, hw: w / 2, hh: h / 2 };
    return s;
  }

  function has(key) {
    return !!cache[key];
  }

  function drop(prefix) {
    for (const k in cache) if (k.indexOf(prefix) === 0) delete cache[k];
  }

  function stats() {
    return { created: created, keys: Object.keys(cache).length };
  }

  function blit(ctx, s, x, y, scale) {
    const k = scale || 1;
    ctx.drawImage(s.canvas, x - s.hw * k, y - s.hh * k, s.w * k, s.h * k);
  }

  /* centred, rotated, optionally flipped and squashed (sx, sy) */
  function blitEx(ctx, s, x, y, ang, sx, sy) {
    ctx.save();
    ctx.translate(x, y);
    if (ang) ctx.rotate(ang);
    ctx.scale(sx, sy);
    ctx.drawImage(s.canvas, -s.hw, -s.hh, s.w, s.h);
    ctx.restore();
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

  /* ── shared effect sprites ── */
  function glow(color) {
    return sprite('glow:' + color, 64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba('#ffffff', 0.95));
      gr.addColorStop(0.14, rgba(color, 0.85));
      gr.addColorStop(0.42, rgba(color, 0.28));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }, 1);
  }

  /* a soft colour halo without the white core */
  function halo(color) {
    return sprite('halo:' + color, 64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(color, 0.55));
      gr.addColorStop(0.5, rgba(color, 0.2));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }, 1);
  }

  function ringSprite(color) {
    return sprite('ring:' + color, 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64);
      gr.addColorStop(0, rgba(color, 0));
      gr.addColorStop(0.7, rgba(color, 0.5));
      gr.addColorStop(0.88, rgba('#ffffff', 0.85));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }, 1);
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
  }

  function starPath(g, cx, cy, r, inner, n) {
    const k = n || 5;
    g.beginPath();
    for (let i = 0; i < k * 2; ++i) {
      const rr = i % 2 === 0 ? r : r * (inner || 0.45);
      const a = -Math.PI / 2 + i * Math.PI / k;
      if (i === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
  }

  Object.assign(NS.artKit, {
    SCALE, makeCanvas, sprite, has, drop, stats, blit, blitEx, parse, rgba, shade, mix, valueNoise,
    glow, halo, ringSprite, roundRect, starPath
  });
})();
