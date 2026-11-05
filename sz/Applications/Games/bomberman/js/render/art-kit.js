/* Shared art helpers: offscreen canvases, a keyed sprite cache with a size budget, colour math
   (shade, mix, rgba), cached radial glow sprites, rounded rectangles, seeded speckle noise and
   centred blits. Every procedural sprite in the game is painted once through here.
   Owns the sprite cache. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const R = NS.rng;

  const cache = new Map();
  const stats = { built: 0, hits: 0 };

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /* Returns the cached sprite for key, painting it with paint(ctx, canvas) on first use */
  function sprite(key, w, h, paint) {
    let s = cache.get(key);
    if (s) { ++stats.hits; return s; }
    s = canvas(w, h);
    paint(s.getContext('2d'), s);
    cache.set(key, s);
    ++stats.built;
    if (cache.size > 2600) {
      /* drop the oldest quarter; they repaint on demand */
      let n = 0;
      for (const k of cache.keys()) { cache.delete(k); if (++n > 650) break; }
    }
    return s;
  }

  function hex(c) {
    if (c[0] !== '#') return [255, 255, 255];
    if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16)];
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }

  function toHex(r, g, b) {
    const h = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    return '#' + h(r) + h(g) + h(b);
  }

  /* amt > 0 lightens toward white, < 0 darkens toward black */
  function shade(c, amt) {
    const [r, g, b] = hex(c);
    if (amt >= 0) return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    return toHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  }

  function mix(a, b, t) {
    const x = hex(a), y = hex(b);
    return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }

  function rgba(c, a) {
    const [r, g, b] = hex(c);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* A soft radial glow, 128 px wide, to be drawn additively */
  function glow(color) {
    return sprite('glow:' + color, 128, 128, (x) => {
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, rgba(color, 0.9));
      g.addColorStop(0.35, rgba(color, 0.35));
      g.addColorStop(1, rgba(color, 0));
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
    });
  }

  function roundRect(x, px, py, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }

  /* Seeded speckles: n dots of colour within a rectangle */
  function speckle(x, seed, px, py, w, h, n, color, size) {
    const rng = R.makeRng(seed);
    x.fillStyle = color;
    for (let i = 0; i < n; ++i) {
      const s = (size || 2) * (0.5 + rng());
      x.fillRect(px + rng() * (w - s), py + rng() * (h - s), s, s);
    }
  }

  /* Draws sprite s centred at (x, y) with a uniform scale */
  function blit(ctx, s, x, y, scale) {
    const k = scale || 1;
    ctx.drawImage(s, x - s.width * k / 2, y - s.height * k / 2, s.width * k, s.height * k);
  }

  function ellipse(x, cx, cy, rx, ry, fill) {
    x.fillStyle = fill;
    x.beginPath();
    x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    x.fill();
  }

  function circle(x, cx, cy, r, fill) {
    x.fillStyle = fill;
    x.beginPath();
    x.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2);
    x.fill();
  }

  /* A shiny ball: base colour, darker rim, highlight */
  function ball(x, cx, cy, r, color) {
    const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, shade(color, 0.45));
    g.addColorStop(0.55, color);
    g.addColorStop(1, shade(color, -0.45));
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }

  Object.assign(NS.artKit, {
    cache, stats, canvas, sprite, hex, shade, mix, rgba, glow, roundRect, speckle, blit, ellipse, circle, ball
  });
})();
