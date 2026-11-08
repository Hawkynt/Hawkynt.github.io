/* Shared procedural-art helpers: offscreen canvases cached by key (with creation statistics
   for the draw-budget tests), colour maths (shade, mix, rgba), additive glow sprites, blitting
   a sprite centred, rounded rectangles and seeded scatter. All expensive art is painted once
   into these caches; per-frame code only blits. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const { TAU } = NS.constants;

  const cache = {};
  const counters = { created: 0, hits: 0 };

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /* painter(ctx, w, h) runs once per key; the canvas is returned from then on */
  function sprite(key, w, h, painter) {
    let c = cache[key];
    if (c) {
      ++counters.hits;
      return c;
    }
    c = canvas(w, h);
    painter(c.getContext('2d'), w, h);
    cache[key] = c;
    ++counters.created;
    return c;
  }

  function drop(prefix) {
    for (const k in cache) if (k.indexOf(prefix) === 0) delete cache[k];
  }

  function stats() {
    return { created: counters.created, hits: counters.hits, size: Object.keys(cache).length };
  }

  function hex(c) {
    if (c[0] !== '#') return [255, 255, 255];
    if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16)];
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }

  function toHex(r, g, b) {
    const h = v => {
      const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    };
    return '#' + h(r) + h(g) + h(b);
  }

  /* amt -1..1: towards black or white */
  function shade(c, amt) {
    const v = hex(c);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return toHex(v[0] + (t - v[0]) * p, v[1] + (t - v[1]) * p, v[2] + (t - v[2]) * p);
  }

  function mix(a, b, t) {
    const x = hex(a), y = hex(b);
    return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }

  function rgba(c, a) {
    const v = hex(c);
    return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')';
  }

  /* a soft radial glow, 128 px, for additive blits */
  function glow(color) {
    return sprite('glow:' + color, 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, rgba(color, 0.9));
      gr.addColorStop(0.35, rgba(color, 0.35));
      gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
  }

  /* centred blit with optional scale */
  function blit(ctx, img, x, y, scale) {
    const s = scale || 1;
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circle(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  function ellipse(ctx, x, y, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  /* a wobbly closed outline */
  function blob(g, x, y, r, wob, seed, n) {
    n = n || 40;
    g.beginPath();
    for (let i = 0; i <= n; ++i) {
      const a = i / n * TAU;
      const rr = r * (1 + wob * (Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 7 + seed * 2.3) * 0.3 + Math.sin(a * 11 + seed * 0.7) * 0.2));
      g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
  }

  /* a five-point star path */
  function star(ctx, x, y, r, inner, points) {
    const n = points || 5;
    ctx.beginPath();
    for (let i = 0; i < n * 2; ++i) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const rr = i % 2 ? r * (inner || 0.45) : r;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  Object.assign(NS.artKit, { cache, canvas, sprite, drop, stats, hex, shade, mix, rgba, glow, blit, roundRect, circle, ellipse, star, blob });
})();
