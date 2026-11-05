/* Procedural art helpers shared by every painter: offscreen canvases, colour maths (hex to rgba,
   lighten, darken, mix), a seeded value noise for textures, soft glow sprites cached per colour
   (the replacement for shadowBlur), rounded rectangles and polygon paths. Draws only into the
   canvases it is given; owns the glow sprite cache. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function parse(hex) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function hex(r, g, b) {
    const c = (v) => {
      const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    };
    return '#' + c(r) + c(g) + c(b);
  }

  function rgba(col, a) {
    const p = parse(col);
    return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')';
  }

  function mix(a, b, t) {
    const p = parse(a), q = parse(b);
    return hex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
  }

  function lighten(col, t) { return mix(col, '#ffffff', t); }
  function darken(col, t) { return mix(col, '#000000', t); }

  /* deterministic hash noise in 0..1 */
  function hash2(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function smooth(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fbm(x, y, s) {
    return smooth(x, y, s) * 0.55 + smooth(x * 2.1, y * 2.1, s + 7) * 0.3 + smooth(x * 4.3, y * 4.3, s + 13) * 0.15;
  }

  /* a seeded generator for art layout */
  function rand(seed) {
    let s = seed >>> 0 || 1;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const glowCache = {};
  /* a soft radial glow sprite (64 px) for additive light; cached per colour */
  function glow(col) {
    let g = glowCache[col];
    if (g) return g;
    g = canvas(64, 64);
    const x = g.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(col, 1));
    gr.addColorStop(0.25, rgba(col, 0.55));
    gr.addColorStop(0.6, rgba(col, 0.14));
    gr.addColorStop(1, rgba(col, 0));
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    glowCache[col] = g;
    return g;
  }

  function roundRect(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.lineTo(px + w - r, py);
    x.arcTo(px + w, py, px + w, py + r, r);
    x.lineTo(px + w, py + h - r);
    x.arcTo(px + w, py + h, px + w - r, py + h, r);
    x.lineTo(px + r, py + h);
    x.arcTo(px, py + h, px, py + h - r, r);
    x.lineTo(px, py + r);
    x.arcTo(px, py, px + r, py, r);
    x.closePath();
  }

  function poly(x, pts) {
    x.beginPath();
    x.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
    x.closePath();
  }

  /* a shaded sphere-ish blob with highlight, used for boulders, heads and orbs */
  function orb(x, cx, cy, r, base, hi, lo) {
    const gr = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    gr.addColorStop(0, hi);
    gr.addColorStop(0.55, base);
    gr.addColorStop(1, lo);
    x.fillStyle = gr;
    x.beginPath();
    x.arc(cx, cy, r, 0, C.TAU);
    x.fill();
  }

  /* a star / sparkle path */
  function star(x, cx, cy, r1, r2, n) {
    x.beginPath();
    for (let i = 0; i < n * 2; ++i) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const r = i % 2 ? r2 : r1;
      if (i) x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    x.closePath();
  }

  Object.assign(NS.artKit, { canvas, parse, hex, rgba, mix, lighten, darken, hash2, smooth, fbm, rand, glow, roundRect, poly, orb, star });
})();
