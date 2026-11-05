/* Snake art: cached scale discs for every skin pattern (bands, stripes, spots, diamonds, galaxy
   specks, ember and rainbow ramps, LCD pixels), the head with blinking eyes and a flicking tongue,
   hats, a soft shadow, and the light-cycle skin drawn as a glowing line. drawChain lays a tapering
   body along any list of points with gulp bulges, so the player, rivals, the wyrm guardian and
   the collection previews all share it. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const { TAU, CELL } = NS.constants;
  const K = NS.artKit;
  const { find } = NS.cosmetics;

  const R0 = CELL * 0.46;
  const RAMP_STEPS = 10;

  /* a saturated colour for a hue in degrees (HSL with fixed saturation and lightness) */
  function hueHex(h) {
    const sat = 0.8, lig = 0.58;
    const a = sat * Math.min(lig, 1 - lig);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return Math.round(255 * (lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    const r = f(0), g = f(8), b = f(4);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  /* which disc variant segment k of n uses */
  function variant(skin, k, n) {
    switch (skin.pattern) {
      case 'bands': return Math.floor(k / 2) % 2;
      case 'stripes': return k % 2;
      case 'ember': return Math.min(RAMP_STEPS - 1, Math.floor(k / Math.max(1, n - 1) * RAMP_STEPS));
      case 'rainbow': return k % 12;
      case 'galaxy':
      case 'spots':
      case 'diamond': return k % 3;
      default: return 0;
    }
  }

  function discColor(skin, v) {
    switch (skin.pattern) {
      case 'bands':
      case 'stripes': return v ? skin.b : skin.a;
      case 'ember': return v < RAMP_STEPS / 2 ? K.mix(skin.c, skin.a, v / (RAMP_STEPS / 2)) : K.mix(skin.a, skin.b, (v - RAMP_STEPS / 2) / (RAMP_STEPS / 2));
      case 'rainbow': return hueHex(v * 30);
      default: return skin.a;
    }
  }

  function disc(skin, v) {
    return K.sprite('disc:' + skin.id + ':' + v, CELL, CELL, (g, w) => {
      const c = w / 2, r = w * 0.46;
      const col = discColor(skin, v);
      if (skin.pattern === 'pixel') {
        g.fillStyle = skin.a;
        g.fillRect(c - r * 0.9, c - r * 0.9, r * 1.8, r * 1.8);
        g.fillStyle = skin.b;
        g.fillRect(c - r * 0.5, c - r * 0.5, r, r);
        return;
      }
      const gr = g.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r);
      gr.addColorStop(0, K.shade(col, 0.45));
      gr.addColorStop(0.55, col);
      gr.addColorStop(1, K.shade(col, -0.45));
      g.fillStyle = gr;
      g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
      g.save();
      g.beginPath(); g.arc(c, c, r, 0, TAU); g.clip();
      if (skin.pattern === 'spots' && v !== 1) {
        g.fillStyle = K.rgba(skin.b, 0.85);
        g.beginPath(); g.arc(c + (v ? -4 : 4), c - 3, r * 0.32, 0, TAU); g.fill();
        g.beginPath(); g.arc(c - 5, c + 6, r * 0.18, 0, TAU); g.fill();
      } else if (skin.pattern === 'diamond') {
        g.fillStyle = K.rgba(skin.b, 0.9);
        const d = r * (v === 1 ? 0.45 : 0.6);
        K.poly(g, [[c, c - d], [c + d, c], [c, c + d], [c - d, c]]);
        g.fill();
        g.fillStyle = K.rgba(skin.c, 0.7);
        K.poly(g, [[c, c - d * 0.4], [c + d * 0.4, c], [c, c + d * 0.4], [c - d * 0.4, c]]);
        g.fill();
      } else if (skin.pattern === 'galaxy') {
        const rr = NS.rng.makeRng(v * 31 + skin.id.length);
        for (let s = 0; s < 6; ++s) {
          g.fillStyle = s % 3 ? K.rgba(skin.c, 0.9) : skin.b;
          const sz = 1 + rr() * 1.8;
          g.fillRect(c - r + rr() * r * 2, c - r + rr() * r * 2, sz, sz);
        }
      }
      /* scale sheen */
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(c, c + r * 0.25, r * 0.7, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      g.restore();
    });
  }

  function shadowDisc() {
    return K.sprite('sdisc', CELL, CELL, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.38)');
      gr.addColorStop(0.7, 'rgba(0,0,0,0.2)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
    });
  }

  /* the head faces +x */
  function head(skin, blink) {
    return K.sprite('head:' + skin.id + ':' + (blink ? 1 : 0), CELL * 1.5, CELL * 1.5, (g, w, h) => {
      const cx = w / 2, cy = h / 2, rx = CELL * 0.58, ry = CELL * 0.48;
      const col = skin.pattern === 'rainbow' ? hueHex(0) : skin.pattern === 'ember' ? K.mix(skin.c, skin.a, 0.55) : skin.a;
      if (skin.pattern === 'pixel') {
        g.fillStyle = skin.a;
        g.fillRect(cx - rx * 0.8, cy - ry, rx * 1.7, ry * 2);
        g.fillStyle = skin.eye;
        g.fillRect(cx + 2, cy - ry * 0.6, 5, 5);
        g.fillRect(cx + 2, cy + ry * 0.6 - 5, 5, 5);
        return;
      }
      const gr = g.createRadialGradient(cx - 4, cy - 6, 2, cx, cy, rx);
      gr.addColorStop(0, K.shade(col, 0.45));
      gr.addColorStop(0.6, col);
      gr.addColorStop(1, K.shade(col, -0.4));
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
      /* snout and brow */
      g.fillStyle = K.rgba(skin.c, 0.35);
      g.beginPath(); g.ellipse(cx + rx * 0.45, cy, rx * 0.42, ry * 0.55, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.arc(cx + rx * 0.82, cy - 4, 1.4, 0, TAU); g.arc(cx + rx * 0.82, cy + 4, 1.4, 0, TAU); g.fill();
      for (let s = -1; s <= 1; s += 2) {
        const ex = cx + rx * 0.18, ey = cy + s * ry * 0.52;
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(ex, ey, 6, blink ? 1.4 : 5.6, 0, 0, TAU); g.fill();
        if (!blink) {
          g.fillStyle = skin.eye;
          g.beginPath(); g.arc(ex + 1.6, ey, 3.6, 0, TAU); g.fill();
          g.fillStyle = '#101010';
          g.beginPath(); g.ellipse(ex + 2, ey, 1.2, 3, 0, 0, TAU); g.fill();
          g.fillStyle = '#ffffff';
          g.beginPath(); g.arc(ex + 0.4, ey - 1.6, 1.1, 0, TAU); g.fill();
        }
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 1;
        g.beginPath(); g.ellipse(ex, ey, 6, blink ? 1.4 : 5.6, 0, 0, TAU); g.stroke();
      }
    });
  }

  function hat(id) {
    if (id === 'none') return null;
    return K.sprite('hat:' + id, 44, 44, (g) => {
      g.lineJoin = 'round';
      switch (id) {
        case 'flower':
          for (let p = 0; p < 6; ++p) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(22 + Math.cos(p * 1.05) * 6, 26 + Math.sin(p * 1.05) * 6, 4.4, 0, TAU); g.fill(); }
          g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(22, 26, 4, 0, TAU); g.fill();
          break;
        case 'party':
          g.fillStyle = '#ff5a8a'; K.poly(g, [[12, 36], [22, 4], [32, 36]]); g.fill();
          g.fillStyle = '#ffd23a'; for (let k = 0; k < 3; ++k) { g.beginPath(); g.arc(18 + k * 4, 30 - k * 8, 2, 0, TAU); g.fill(); }
          g.fillStyle = '#6fd3ff'; g.beginPath(); g.arc(22, 5, 3.5, 0, TAU); g.fill();
          break;
        case 'crown': {
          const gr = g.createLinearGradient(0, 12, 0, 36);
          gr.addColorStop(0, '#fff2a0'); gr.addColorStop(1, '#c8920a');
          g.fillStyle = gr;
          K.poly(g, [[8, 36], [8, 16], [15, 25], [22, 10], [29, 25], [36, 16], [36, 36]]); g.fill();
          g.strokeStyle = '#7a5200'; g.lineWidth = 1.4; g.stroke();
          g.fillStyle = '#ff3a5a'; g.beginPath(); g.arc(22, 30, 3, 0, TAU); g.fill();
          break;
        }
        case 'shades':
          g.fillStyle = '#101018';
          K.roundRect(g, 4, 22, 15, 9, 3); g.fill(); K.roundRect(g, 25, 22, 15, 9, 3); g.fill();
          g.fillRect(18, 24, 8, 2);
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(7, 24, 5, 2); g.fillRect(28, 24, 5, 2);
          break;
        case 'tophat':
          g.fillStyle = '#1a1a22'; g.fillRect(6, 32, 32, 5); g.fillRect(12, 8, 20, 26);
          g.fillStyle = '#c03a3a'; g.fillRect(12, 27, 20, 4);
          break;
        case 'halo':
          g.strokeStyle = '#fff2a0'; g.lineWidth = 3.4; g.beginPath(); g.ellipse(22, 16, 13, 5, 0, 0, TAU); g.stroke();
          g.strokeStyle = 'rgba(255,240,160,0.4)'; g.lineWidth = 7; g.stroke();
          break;
        case 'horns':
          g.fillStyle = '#e8e0d0';
          K.poly(g, [[8, 34], [4, 12], [16, 30]]); g.fill(); K.poly(g, [[36, 34], [40, 12], [28, 30]]); g.fill();
          break;
        case 'beanie':
          g.fillStyle = '#3a6aff'; g.beginPath(); g.arc(22, 34, 15, Math.PI, 0); g.fill();
          g.fillStyle = '#ffffff'; g.fillRect(6, 32, 32, 6); g.beginPath(); g.arc(22, 16, 4.5, 0, TAU); g.fill();
          break;
        case 'wreath':
          for (let p = 0; p < 9; ++p) {
            const a = Math.PI + p * Math.PI / 8;
            g.fillStyle = p % 2 ? '#ff9ac0' : '#ffe07a';
            g.beginPath(); g.arc(22 + Math.cos(a) * 15, 34 + Math.sin(a) * 9, 4, 0, TAU); g.fill();
          }
          break;
        case 'straw':
          g.fillStyle = '#e8c870'; g.beginPath(); g.ellipse(22, 33, 20, 6, 0, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(22, 26, 11, 9, 0, Math.PI, 0); g.fill();
          g.fillStyle = '#c0402a'; g.fillRect(11, 28, 22, 3);
          break;
        case 'acorn':
          g.fillStyle = '#7a4a1a'; g.beginPath(); g.ellipse(22, 30, 15, 10, 0, Math.PI, 0); g.fill();
          g.strokeStyle = '#4a2a0a'; g.lineWidth = 1; for (let k = -2; k <= 2; ++k) { g.beginPath(); g.moveTo(22 + k * 5, 20); g.lineTo(22 + k * 5 + 3, 30); g.stroke(); }
          g.fillStyle = '#4a2a0a'; g.fillRect(20, 14, 4, 7);
          break;
        case 'witch':
          g.fillStyle = '#2a1a3a'; g.beginPath(); g.ellipse(22, 34, 20, 5, 0, 0, TAU); g.fill();
          K.poly(g, [[11, 34], [26, 2], [33, 34]]); g.fill();
          g.fillStyle = '#ff8a1a'; g.fillRect(12, 29, 21, 3);
          break;
        case 'santa':
          g.fillStyle = '#d82a2a'; K.poly(g, [[8, 34], [20, 6], [38, 16], [36, 34]]); g.fill();
          g.fillStyle = '#ffffff'; g.fillRect(6, 31, 32, 6); g.beginPath(); g.arc(38, 16, 4, 0, TAU); g.fill();
          break;
      }
    });
  }

  /* a light-cycle trail: glowing line through the points */
  function neonChain(ctx, xs, ys, n, skin) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const passes = [[12, 0.18], [6, 0.5], [2.4, 1]];
    for (let p = 0; p < passes.length; ++p) {
      ctx.strokeStyle = p === 2 ? skin.c : skin.a;
      ctx.globalAlpha = passes[p][1];
      ctx.lineWidth = passes[p][0];
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (let k = 1; k < n; ++k) {
        const jump = Math.abs(xs[k] - xs[k - 1]) + Math.abs(ys[k] - ys[k - 1]) > CELL * 1.6;
        if (jump) ctx.moveTo(xs[k], ys[k]); else ctx.lineTo(xs[k], ys[k]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* lays a body along points (head first). opts: angle, scale, gulps, alpha, blink, hat, from */
  function drawChain(ctx, xs, ys, n, skin, opts) {
    if (n <= 0) return;
    opts = opts || {};
    const sc = opts.scale || 1;
    const from = opts.from || 0;
    const sh = shadowDisc();
    if (skin.pattern === 'neon') {
      neonChain(ctx, xs, ys, n, skin);
    } else {
      for (let k = n - 1; k >= Math.max(1, from); --k) {
        const r = taper(k, n) * sc;
        K.blit(ctx, sh, xs[k] + 3 * sc, ys[k] + 5 * sc, r * 1.15);
      }
      for (let k = n - 1; k >= Math.max(1, from); --k) {
        let r = taper(k, n) * sc;
        if (opts.gulps) for (let gq = 0; gq < opts.gulps.length; ++gq) {
          const d = Math.abs(opts.gulps[gq] - k);
          if (d < 1.5) r *= 1 + 0.32 * (1 - d / 1.5);
        }
        const v = variant(skin, k, n);
        /* a filler disc halfway to the previous segment keeps the tube continuous */
        const px = xs[k - 1], py = ys[k - 1];
        if (Math.abs(px - xs[k]) + Math.abs(py - ys[k]) < CELL * 1.6)
          K.blit(ctx, disc(skin, v), (xs[k] + px) / 2, (ys[k] + py) / 2, (r + taper(k - 1, n) * sc) / 2 * 0.98);
        K.blit(ctx, disc(skin, v), xs[k], ys[k], r);
      }
    }
    if (from > 0) return;
    const ang = opts.angle || 0;
    if (skin.pattern !== 'neon') K.blit(ctx, sh, xs[0] + 3 * sc, ys[0] + 5 * sc, 1.3 * sc);
    if (opts.tongue) {
      const tx = xs[0] + Math.cos(ang) * CELL * 0.62 * sc, ty = ys[0] + Math.sin(ang) * CELL * 0.62 * sc;
      const L = opts.tongue * 12 * sc;
      ctx.strokeStyle = '#e0204a';
      ctx.lineWidth = 2 * sc;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      const ex = tx + Math.cos(ang) * L, ey = ty + Math.sin(ang) * L;
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex + Math.cos(ang - 0.5) * 4 * sc, ey + Math.sin(ang - 0.5) * 4 * sc);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(ang + 0.5) * 4 * sc, ey + Math.sin(ang + 0.5) * 4 * sc);
      ctx.stroke();
    }
    if (skin.pattern === 'neon') {
      ctx.globalCompositeOperation = 'lighter';
      K.blit(ctx, K.glow(skin.a), xs[0], ys[0], 0.9 * sc);
      ctx.globalCompositeOperation = 'source-over';
    }
    K.blitRot(ctx, head(skin, opts.blink), xs[0], ys[0], ang, sc * (opts.headScale || 1));
    const h = opts.hat ? hat(opts.hat) : null;
    if (h) K.blit(ctx, h, xs[0], ys[0] - CELL * 0.42 * sc, 0.62 * sc);
  }

  function taper(k, n) {
    const t = n <= 1 ? 0 : k / (n - 1);
    return 0.95 - t * 0.45;
  }

  function skinOf(id) {
    return find('skin', id);
  }

  /* a rival or guardian snake look from a colour */
  function tintSkin(color) {
    return { id: 'tint' + color, a: color, b: K.shade(color, -0.35), c: K.shade(color, 0.5), eye: '#ffe23a', pattern: 'bands' };
  }

  Object.assign(NS.snakeArt, {
    R0, disc, head, hat, drawChain, taper, skinOf, tintSkin, hueHex
  });
})();
