;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.sceneKit || (NS.sceneKit = {});

  /*
   * Parallax backdrops for the Platformer's five worlds. Each world paints,
   * once and on first use, a sky (one 16:9 image stretched to cover the
   * visible rect), a few glow sprites and three to five horizontally tileable
   * strips: far ranges, middle hills or pillars, near silhouettes and drifting
   * extras (clouds, aurora, snow). Per frame only drawImage calls and a fill
   * or two are issued - no gradients, no shadow blur, no pixel reads.
   *
   *   const scene = SZ.PlatformerScene.create(world);
   *   scene.drawBack(ctx, v, camX, camY, t);   // behind the level
   *   scene.drawFront(ctx, v, camX, camY, t);  // thin atmosphere over it
   *   scene.drawMenu(ctx, v, t);               // slow auto-pan for menus
   *
   * v = { x0, y0, x1, y1 } is the visible rect in 1280 x 720 view units and
   * may reach past every edge of the view in odd window shapes.
   *
   * The scenery is split by stage: kit.js (this file: constants and paint helpers, shared through
   * SZ.Platformer.sceneKit), strips.js, worlds.js and scene.js, which publishes SZ.PlatformerScene.
   */

  const VIEW_W = 1280;
  const VIEW_H = 720;
  const STRIP_W = 1536;
  const CAM_REF = 100;   // the camera height at which the strips sit as painted
  const WORLD_COUNT = 5;
  const TWO_PI = Math.PI * 2;

  /* ── small helpers ── */

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function mulberry(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rgbOf(hex) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    const c = rgbOf(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function mix(a, b, k) {
    const x = rgbOf(a), y = rgbOf(b);
    const out = [0, 0, 0];
    for (let i = 0; i < 3; ++i)
      out[i] = Math.round(x[i] + (y[i] - x[i]) * k);
    return '#' + out.map(v => (v < 16 ? '0' : '') + v.toString(16)).join('');
  }

  /* periodic fractal noise over [0, 1): seamless when a strip wraps */
  function loopNoise(rand, octaves) {
    const tables = [];
    for (let o = 0; o < octaves; ++o) {
      const n = 4 << o;
      const t = [];
      for (let i = 0; i < n; ++i)
        t.push(rand());
      tables.push(t);
    }
    return function(u, rough) {
      u = ((u % 1) + 1) % 1;
      let sum = 0, amp = 1, norm = 0;
      const r = rough === undefined ? 0.5 : rough;
      for (let o = 0; o < tables.length; ++o) {
        const t = tables[o], n = t.length;
        const f = u * n, i = Math.floor(f), k = f - i;
        const s = (1 - Math.cos(k * Math.PI)) / 2;
        sum += (t[i % n] * (1 - s) + t[(i + 1) % n] * s) * amp;
        norm += amp;
        amp *= r;
      }
      return sum / norm;
    };
  }

  function linear(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; ++i)
      gr.addColorStop(stops[i][0], stops[i][1]);
    return gr;
  }

  function radial(g, x, y, r0, r1, stops) {
    const gr = g.createRadialGradient(x, y, r0, x, y, r1);
    for (let i = 0; i < stops.length; ++i)
      gr.addColorStop(stops[i][0], stops[i][1]);
    return gr;
  }

  /* soft round glow, one per colour */
  /* painted at the size it is drawn, so the blit needs no resampling */
  const glowCache = {};
  function glow(color, r) {
    r = Math.max(8, Math.round(r || 64));
    const key = color + r;
    let c = glowCache[key];
    if (!c) {
      c = makeCanvas(r * 2, r * 2);
      const g = c.getContext('2d');
      g.fillStyle = radial(g, r, r, 0, r, [[0, rgba(color, 0.9)], [0.2, rgba(color, 0.5)], [0.5, rgba(color, 0.16)], [1, rgba(color, 0)]]);
      g.fillRect(0, 0, r * 2, r * 2);
      glowCache[key] = c;
    }
    return c;
  }

  /* grain: tiny light and dark specks so no fill reads as flat */
  function grain(g, w, h, rand, amount, light, dark) {
    const n = Math.floor(w * h * amount / 1000);
    for (let i = 0; i < n; ++i) {
      const x = rand() * w, y = rand() * h;
      g.fillStyle = rand() < 0.5 ? light : dark;
      g.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 1.5);
    }
  }

  /* a ridge line across the strip; returns heights per 4 px column */
  function ridgeHeights(W, base, amp, noise, rough, sharp) {
    const ys = [];
    for (let x = 0; x <= W; x += 4) {
      let n = noise(x / W, rough);
      if (sharp) {
        /* ridged: crests fold into sharp peaks */
        const r = 1 - Math.abs(n * 2 - 1);
        n = 0.35 * n + 0.65 * Math.pow(r, 1.6);
      }
      ys.push(base - n * amp);
    }
    return ys;
  }

  function ridgePath(g, ys, H) {
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 0; i < ys.length; ++i)
      g.lineTo(i * 4, ys[i]);
    g.lineTo((ys.length - 1) * 4, H);
    g.closePath();
  }

  /* facet shading: slopes facing the light (rising to the right, light from
     the upper left) brighten, the others darken. The shade is painted at a
     quarter of the resolution and scaled up, so neighbouring columns melt into
     broad soft faces; it fades with depth below the crest. */
  function facetShade(g, ys, depth, lightCol, darkCol, strength) {
    const n = ys.length;
    const H = g.canvas ? g.canvas.height : 720;
    const sc = makeCanvas(n, Math.ceil(H / 4));
    const s = sc.getContext('2d');
    for (let i = 0; i < n - 1; ++i) {
      let sum = 0;
      for (let k = -6; k <= 6; ++k) {
        const a = (i + k + n - 1) % (n - 1), b = (a + 1) % (n - 1);
        sum += ys[b] - ys[a];
      }
      const k = Math.max(-1, Math.min(1, sum / 13 / 3));
      if (Math.abs(k) < 0.04)
        continue;
      const col = k < 0 ? lightCol : darkCol, a = strength * Math.abs(k);
      const top = ys[i] / 4, len = depth / 4;
      const steps = 6;
      for (let d = 0; d < steps; ++d) {
        s.fillStyle = rgba(col, (a * (1 - d / steps)).toFixed(3));
        s.fillRect(i, top - 1 + d * len / steps, 1, len / steps + 0.5);
      }
    }
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.drawImage(sc, 0, 0, n * 4, sc.height * 4);
    g.restore();
  }

  /* ridge shading for mountain ranges: every peak gets a lit left flank and a
     shadowed right flank meeting along a spine that runs down from the summit,
     with a few crevices; light comes from the upper left */
  function ridgeShade(g, ys, depth, shadow, light, rand) {
    const n = ys.length - 1;
    const at = i => ys[((i % n) + n) % n];
    const sm = [];
    for (let i = 0; i < n; ++i) {
      let sum = 0;
      for (let k = -4; k <= 4; ++k) sum += at(i + k);
      sm.push(sum / 9);
    }
    const sat = i => sm[((i % n) + n) % n];
    const peaks = [];
    for (let i = 0; i < n; ++i) {
      let top = true;
      for (let k = 1; k <= 14 && top; ++k)
        if (sat(i - k) < sm[i] || sat(i + k) <= sm[i]) top = false;
      if (top) peaks.push(i);
    }
    if (peaks.length < 2)
      return;
    function poly(pts, offs, y0, y1, col, a0) {
      for (const off of offs) {
        g.beginPath();
        g.moveTo(pts[0][0] + off, pts[0][1]);
        for (let i = 1; i < pts.length; ++i) g.lineTo(pts[i][0] + off, pts[i][1]);
        g.closePath();
        g.fillStyle = linear(g, 0, y0, 0, y1, [[0, rgba(col, a0)], [0.55, rgba(col, a0 * 0.45)], [1, rgba(col, 0)]]);
        g.fill();
      }
    }
    const offs = [0, -STRIP_W, STRIP_W];
    for (let j = 0; j < peaks.length; ++j) {
      const p = peaks[j];
      let q = peaks[(j + 1) % peaks.length];
      if (q <= p) q += n;
      let v = p;
      for (let i = p; i <= q; ++i) if (at(i) > at(v)) v = i;
      let u = peaks[(j - 1 + peaks.length) % peaks.length];
      if (u >= p) u -= n;
      let w = p;
      for (let i = u; i <= p; ++i) if (at(i) > at(w)) w = i;
      const px = p * 4, py = at(p);
      /* a wavering spine from the summit down and slightly right */
      const spine = [];
      const lean = (v - p) * 4 * (0.18 + rand() * 0.2);
      for (let k = 0; k <= 6; ++k) {
        const t = k / 6;
        spine.push([px + lean * t + (k && k < 6 ? (rand() - 0.5) * 10 : 0), py + depth * t]);
      }
      /* shadow: right flank down to the valley, back up the spine */
      const sh = [];
      for (let i = p; i <= v; ++i) sh.push([i * 4, at(i) - 1]);
      sh.push([v * 4 - (v - p) * 4 * 0.3, at(v) + depth]);
      for (let k = spine.length - 1; k >= 0; --k) sh.push(spine[k]);
      poly(sh, offs, py, py + depth, shadow, 0.5);
      /* light: left flank from the previous valley up to the summit */
      const li = [];
      for (let i = w; i <= p; ++i) li.push([i * 4, at(i) - 1]);
      for (let k = 0; k < spine.length; ++k) li.push(spine[k]);
      li.push([w * 4 + (p - w) * 4 * 0.3, at(w) + depth]);
      poly(li, offs, py, py + depth, light, 0.22);
      /* crevices running down the shadow flank */
      g.lineCap = 'round';
      for (let c = 0; c < 4; ++c) {
        const i = p + Math.floor(rand() * Math.max(1, v - p));
        const x0 = i * 4, y0 = at(i) + 2, len = 20 + rand() * depth * 0.5;
        g.strokeStyle = rgba(shadow, 0.18);
        g.lineWidth = 1 + rand() * 1.5;
        for (const off of offs) {
          g.beginPath();
          g.moveTo(x0 + off, y0);
          g.quadraticCurveTo(x0 + off + len * 0.15, y0 + len * 0.5, x0 + off + len * 0.1 + (rand() - 0.5) * 8, y0 + len);
          g.stroke();
        }
      }
    }
  }

  function rimLight(g, ys, color, alpha, width) {
    g.beginPath();
    for (let i = 0; i < ys.length; ++i) {
      if (i === 0) g.moveTo(0, ys[0] + width / 2);
      else g.lineTo(i * 4, ys[i] + width / 2);
    }
    g.lineWidth = width;
    g.strokeStyle = rgba(color, alpha);
    g.stroke();
  }

  /* run fn(x) for an object near the strip edges at x - W and x + W too */
  function wrapDraw(W, x, reach, fn) {
    fn(x);
    if (x < reach) fn(x + W);
    if (x > W - reach) fn(x - W);
  }

  /* a cumulus: a soft halo, a shaded belly with a rounded, ragged underside,
     a sunlit rim along the top and a few bright dabs; top / mid / bottom are
     the rim, body and belly colours */
  function puffCloud(g, x, y, w, h, rand, top, mid, bottom) {
    const blobs = [];
    const n = 6 + Math.floor(rand() * 6);
    for (let i = 0; i < n; ++i) {
      const k = i / (n - 1);
      const bx = x + (k - 0.5) * w * 0.8 + (rand() - 0.5) * w * 0.1;
      const r = h * (0.32 + 0.5 * Math.pow(Math.sin(k * Math.PI), 0.8)) * (0.75 + rand() * 0.5);
      blobs.push([bx, y - r * 0.35, r]);
    }
    /* a second, smaller tier on top for height */
    const tier = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < tier; ++i)
      blobs.push([x + (rand() - 0.5) * w * 0.4, y - h * (0.55 + rand() * 0.3), h * (0.3 + rand() * 0.2)]);
    const bx = x, by = y + h * 0.04, rx = w * 0.47, ry = h * 0.3;
    const under = [];
    for (let i = 0; i < 7; ++i)
      under.push([x + (i / 6 - 0.5) * w * 0.8, by + ry * (0.55 + rand() * 0.3), h * (0.1 + rand() * 0.1)]);
    /* the whole silhouette, shifted by dy, scaled, with the base lifted by baseDy */
    function shape(dy, scale, baseDy, ragged) {
      g.beginPath();
      for (const b of blobs) { g.moveTo(b[0] + b[2] * scale, b[1] + dy); g.arc(b[0], b[1] + dy, b[2] * scale, 0, TWO_PI); }
      g.moveTo(bx + rx * scale, by + dy + baseDy);
      g.ellipse(bx, by + dy + baseDy, rx * scale, ry * scale, 0, 0, TWO_PI);
      if (ragged)
        for (const u of under) { g.moveTo(u[0] + u[2], u[1] + dy); g.arc(u[0], u[1] + dy, u[2], 0, TWO_PI); }
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    shape(0, 1.08, 0, true);
    /* belly: the full, ragged silhouette in the shade colour */
    g.fillStyle = bottom;
    shape(0, 1, 0, true);
    /* lit rim, then the body lifted off the belly so a rounded crescent of
       shade stays along the underside and a bright edge along the top */
    g.fillStyle = top;
    shape(-h * 0.07, 0.98, -ry * 0.55, false);
    g.fillStyle = mid;
    shape(-h * 0.02, 0.94, -ry * 0.6, false);
    /* a soft blend between body and belly */
    g.globalAlpha = 0.35;
    g.fillStyle = bottom;
    shape(h * 0.02, 0.9, -ry * 0.2, false);
    g.globalAlpha = 1;
    g.fillStyle = mid;
    shape(-h * 0.06, 0.86, -ry * 0.8, false);
  }

  function stars(g, w, h, rand, count, color) {
    for (let i = 0; i < count; ++i) {
      const x = rand() * w, y = rand() * h * (0.3 + 0.7 * rand());
      const a = 0.25 + rand() * 0.75 * (1 - y / h);
      const s = rand() < 0.08 ? 2.2 : 1 + rand();
      g.fillStyle = rgba(color, a.toFixed(3));
      g.fillRect(x, y, s, s);
      if (s > 2) {
        g.fillStyle = rgba(color, (a * 0.35).toFixed(3));
        g.fillRect(x - 3, y + 0.6, 8, 1);
        g.fillRect(x + 0.6, y - 3, 1, 8);
      }
    }
  }

  Object.assign(Kit, { VIEW_W, VIEW_H, STRIP_W, CAM_REF, WORLD_COUNT, TWO_PI, makeCanvas, mulberry, rgba, mix, loopNoise, linear, radial, glow, grain, ridgeHeights, ridgePath, facetShade, ridgeShade, rimLight, wrapDraw, puffCloud, stars });
})();
