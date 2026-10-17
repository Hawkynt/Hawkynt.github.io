;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

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

  /* ══════════════════════════════════════════════════════════════════
     SKIES  (painted at 960 x 540, drawn covering the visible rect)
     ══════════════════════════════════════════════════════════════════ */

  const SKY_W = 960, SKY_H = 540;

  function paintSky(world, rand) {
    /* painted in 960 x 540 units onto a full 1280 x 720 canvas, so the usual
       16:9 window blits it one to one */
    const c = makeCanvas(VIEW_W, VIEW_H);
    const g = c.getContext('2d');
    g.scale(VIEW_W / SKY_W, VIEW_H / SKY_H);
    const W = SKY_W, H = SKY_H;
    if (world === 0) {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#2d6cc9'], [0.38, '#5f9fe6'], [0.66, '#a9d2f2'], [0.85, '#f6e7c4'], [1, '#ffd9a0']]);
      g.fillRect(0, 0, W, H);
      /* the sun, with a broad warm bloom */
      g.fillStyle = radial(g, 720, 120, 0, 420, [[0, 'rgba(255,248,220,0.85)'], [0.12, 'rgba(255,236,170,0.45)'], [0.4, 'rgba(255,220,150,0.12)'], [1, 'rgba(255,220,150,0)']]);
      g.fillRect(0, 0, W, H);
      g.fillStyle = radial(g, 720, 120, 0, 40, [[0, '#ffffff'], [0.6, '#fff6d0'], [1, 'rgba(255,240,190,0)']]);
      g.beginPath(); g.arc(720, 120, 40, 0, TWO_PI); g.fill();
      /* wispy high cirrus */
      for (let i = 0; i < 14; ++i) {
        const y = 40 + rand() * 180, x = rand() * W, w = 120 + rand() * 260;
        g.fillStyle = 'rgba(255,255,255,' + (0.06 + rand() * 0.1).toFixed(3) + ')';
        g.beginPath(); g.ellipse(x, y, w, 4 + rand() * 6, -0.05, 0, TWO_PI); g.fill();
      }
    } else if (world === 1) {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#04060e'], [0.4, '#0a1626'], [0.75, '#123048'], [1, '#0c2234']]);
      g.fillRect(0, 0, W, H);
      /* far luminous chambers deep in the rock */
      const spots = [[200, 300, '#3a8ad8'], [520, 260, '#7a5ad8'], [800, 330, '#2ac0c8'], [640, 420, '#4a7ae8']];
      for (const s of spots) {
        g.fillStyle = radial(g, s[0], s[1], 0, 260, [[0, rgba(s[2], 0.35)], [0.5, rgba(s[2], 0.1)], [1, rgba(s[2], 0)]]);
        g.fillRect(0, 0, W, H);
      }
      stars(g, W, H, rand, 160, '#9ad8ff');
    } else if (world === 2) {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#070d26'], [0.35, '#1b2a62'], [0.62, '#4a4f92'], [0.82, '#c88aa8'], [1, '#ffc6a8']]);
      g.fillRect(0, 0, W, H);
      stars(g, W, H * 0.7, rand, 420, '#e8f0ff');
      /* a pale moon */
      g.fillStyle = radial(g, 230, 110, 0, 160, [[0, 'rgba(220,235,255,0.5)'], [0.3, 'rgba(200,220,255,0.12)'], [1, 'rgba(200,220,255,0)']]);
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#eef4ff';
      g.beginPath(); g.arc(230, 110, 26, 0, TWO_PI); g.fill();
      g.fillStyle = 'rgba(160,180,220,0.35)';
      g.beginPath(); g.arc(222, 104, 6, 0, TWO_PI); g.fill();
      g.beginPath(); g.arc(238, 118, 4, 0, TWO_PI); g.fill();
      g.beginPath(); g.arc(240, 100, 3, 0, TWO_PI); g.fill();
    } else if (world === 3) {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#0e0406'], [0.35, '#2e0c0c'], [0.65, '#6a1c10'], [0.88, '#c8461a'], [1, '#ff8a30']]);
      g.fillRect(0, 0, W, H);
      /* ash clouds lit from below */
      for (let i = 0; i < 26; ++i) {
        const x = rand() * W, y = 60 + rand() * 260, r = 60 + rand() * 120;
        const lit = y / H;
        g.fillStyle = radial(g, x, y, 0, r, [[0, rgba(mix('#2a0e0e', '#c8501e', lit), 0.45)], [1, rgba('#2a0e0e', 0)]]);
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.fillStyle = radial(g, 480, 560, 0, 520, [[0, 'rgba(255,170,60,0.55)'], [0.4, 'rgba(255,110,40,0.2)'], [1, 'rgba(255,90,30,0)']]);
      g.fillRect(0, 0, W, H);
      stars(g, W, H * 0.4, rand, 60, '#ffb070');
    } else {
      g.fillStyle = linear(g, 0, 0, 0, H, [[0, '#1c1448'], [0.3, '#4a3a98'], [0.58, '#a07ad0'], [0.8, '#f4b8b0'], [1, '#ffe2a8']]);
      g.fillRect(0, 0, W, H);
      stars(g, W, H * 0.45, rand, 180, '#fff0ff');
      /* a low golden sun */
      g.fillStyle = radial(g, 300, 400, 0, 480, [[0, 'rgba(255,240,190,0.8)'], [0.15, 'rgba(255,214,150,0.4)'], [0.5, 'rgba(255,180,160,0.1)'], [1, 'rgba(255,180,160,0)']]);
      g.fillRect(0, 0, W, H);
      g.fillStyle = radial(g, 300, 400, 0, 48, [[0, '#ffffff'], [0.7, '#fff0c0'], [1, 'rgba(255,230,170,0)']]);
      g.beginPath(); g.arc(300, 400, 48, 0, TWO_PI); g.fill();
      /* god rays fanning out of the sun */
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; ++i) {
        const a = -Math.PI * 0.95 + i * 0.12 + rand() * 0.06;
        g.fillStyle = 'rgba(255,230,180,0.05)';
        g.beginPath();
        g.moveTo(300, 400);
        g.lineTo(300 + Math.cos(a - 0.03) * 900, 400 + Math.sin(a - 0.03) * 900);
        g.lineTo(300 + Math.cos(a + 0.03) * 900, 400 + Math.sin(a + 0.03) * 900);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
    grain(g, W, H, rand, 2, 'rgba(255,255,255,0.025)', 'rgba(0,0,0,0.03)');
    return c;
  }

  /* ══════════════════════════════════════════════════════════════════
     STRIPS
     ══════════════════════════════════════════════════════════════════ */

  /* a strip: { img, y, h, f (parallax), vx (drift px/s), fill (below), fillTop (above) } */
  function strip(h) {
    const c = makeCanvas(STRIP_W, h);
    return { c: c, g: c.getContext('2d') };
  }

  /* far snowy or pale ranges with faceted light */
  function paintRange(rand, H, base, amp, body, far, light, dark, snow, rough, haze) {
    const s = strip(H);
    const g = s.g;
    const noise = loopNoise(rand, 6);
    const big = loopNoise(rand, 2);
    const ys = ridgeHeights(STRIP_W, base, amp, noise, rough, true);
    /* a slow swell lifts some massifs and sinks the passes between them */
    for (let i = 0; i < ys.length; ++i)
      ys[i] = base - (base - ys[i]) * (0.45 + 0.75 * big(i / ys.length, 0.3));
    ridgePath(g, ys, H);
    g.fillStyle = linear(g, 0, base - amp, 0, H, [[0, far], [1, body]]);
    g.fill();
    g.save();
    ridgePath(g, ys, H);
    g.clip();
    if (snow) {
      /* snow above a ragged altitude line, running down the gullies */
      const sn = loopNoise(rand, 6);
      let top = 1e9;
      for (const y of ys) top = Math.min(top, y);
      const alt = top + amp * 0.42;
      g.fillStyle = rgba(snow, 0.95);
      g.save();
      ridgePath(g, ys, H);
      g.clip();
      g.beginPath();
      g.moveTo(0, -10);
      for (let i = 0; i < ys.length; ++i) {
        const line = alt + (sn(i / ys.length, 0.7) - 0.5) * amp * 0.5;
        g.lineTo(i * 4, Math.max(ys[i] - 2, line));
      }
      g.lineTo(STRIP_W, -10);
      g.closePath();
      g.fill();
      g.restore();
    }
    /* light and shadow per peak, over rock and snow alike */
    ridgeShade(g, ys, amp * 0.95, dark, light, rand);
    /* atmospheric haze pooling at the foot */
    g.fillStyle = linear(g, 0, base - amp * 0.3, 0, H, [[0, rgba(haze, 0)], [1, rgba(haze, 0.55)]]);
    g.fillRect(0, 0, STRIP_W, H);
    grain(g, STRIP_W, H, rand, 3, 'rgba(255,255,255,0.04)', 'rgba(0,0,0,0.05)');
    g.restore();
    rimLight(g, ys, light, 0.35, 2);
    return { s: s, ys: ys };
  }

  function paintHills(rand, H, base, amp, top, bottom, rim, decorate) {
    const s = strip(H);
    const g = s.g;
    const ys = ridgeHeights(STRIP_W, base, amp, loopNoise(rand, 5), 0.45, false);
    ridgePath(g, ys, H);
    g.fillStyle = linear(g, 0, base - amp, 0, H, [[0, top], [1, bottom]]);
    g.fill();
    g.save();
    ridgePath(g, ys, H);
    g.clip();
    facetShade(g, ys, 60, '#ffffff', '#000000', 0.12);
    grain(g, STRIP_W, H, rand, 5, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.07)');
    g.restore();
    rimLight(g, ys, rim, 0.5, 2.5);
    if (decorate)
      decorate(g, ys, rand);
    return s;
  }

  /* a broadleaf tree: an irregular crown of blobs, shaded dark below, mid in
     the body and lit on the sun side (sunDir 1 = light from the right) */
  function treeClump(g, x, y, r, rand, dark, mid, light, sunDir) {
    const sd = sunDir || -1;
    g.fillStyle = mix(dark, '#2a1a0e', 0.5);
    g.beginPath();
    g.moveTo(x - r * 0.1, y + r * 0.1);
    g.lineTo(x - r * 0.05, y - r * 0.5);
    g.lineTo(x + r * 0.05, y - r * 0.5);
    g.lineTo(x + r * 0.11, y + r * 0.1);
    g.closePath();
    g.fill();
    const blobs = [];
    const n = 4 + Math.floor(rand() * 4);
    const tall = 0.8 + rand() * 0.5;
    for (let i = 0; i < n; ++i) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.6;
      const d = r * (0.2 + rand() * 0.45);
      blobs.push([Math.cos(a) * d, -r * 0.75 * tall + Math.sin(a) * d * tall, r * (0.38 + rand() * 0.3)]);
    }
    g.fillStyle = dark;
    for (const b of blobs) { g.beginPath(); g.arc(x + b[0], y + b[1], b[2], 0, TWO_PI); g.fill(); }
    g.fillStyle = mid;
    for (const b of blobs) { g.beginPath(); g.arc(x + b[0] + sd * b[2] * 0.12, y + b[1] - b[2] * 0.16, b[2] * 0.8, 0, TWO_PI); g.fill(); }
    g.fillStyle = light;
    for (const b of blobs) {
      if (b[0] * sd < -r * 0.25) continue;
      g.beginPath(); g.arc(x + b[0] + sd * b[2] * 0.3, y + b[1] - b[2] * 0.34, b[2] * 0.4, 0, TWO_PI); g.fill();
    }
  }

  /* a slender poplar */
  function poplar(g, x, y, h, dark, mid, light, sunDir) {
    const w = h * 0.17;
    g.fillStyle = mix(dark, '#2a1a0e', 0.5);
    g.fillRect(x - 2, y - h * 0.15, 4, h * 0.2);
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(x, y - h * 0.55, w, h * 0.48, 0, 0, TWO_PI); g.fill();
    g.fillStyle = mid;
    g.beginPath(); g.ellipse(x + sunDir * w * 0.15, y - h * 0.58, w * 0.78, h * 0.43, 0, 0, TWO_PI); g.fill();
    g.fillStyle = light;
    g.beginPath(); g.ellipse(x + sunDir * w * 0.45, y - h * 0.66, w * 0.3, h * 0.28, 0, 0, TWO_PI); g.fill();
  }

  /* a low round bush */
  function bush(g, x, y, r, rand, dark, mid, light, sunDir) {
    const blobs = [[-r * 0.6, -r * 0.35, r * 0.55], [0, -r * 0.55, r * 0.7], [r * 0.6, -r * 0.35, r * 0.55]];
    g.fillStyle = dark;
    for (const b of blobs) { g.beginPath(); g.arc(x + b[0], y + b[1], b[2], 0, TWO_PI); g.fill(); }
    g.fillStyle = mid;
    for (const b of blobs) { g.beginPath(); g.arc(x + b[0] + sunDir * b[2] * 0.1, y + b[1] - b[2] * 0.15, b[2] * 0.78, 0, TWO_PI); g.fill(); }
    g.fillStyle = light;
    g.beginPath(); g.arc(x + sunDir * r * 0.35, y - r * 0.8, r * 0.28, 0, TWO_PI); g.fill();
    if (rand() < 0.5) {
      g.fillStyle = rand() < 0.5 ? '#ffffff' : '#ff9ac0';
      for (let k = 0; k < 5; ++k)
        g.fillRect(x + (rand() - 0.5) * r * 1.6, y - r * (0.2 + rand() * 0.7), 2.5, 2.5);
    }
  }

  function pine(g, x, y, h, dark, mid, snow) {
    const w = h * 0.42;
    g.fillStyle = dark;
    g.fillRect(x - h * 0.03, y - h * 0.15, h * 0.06, h * 0.2);
    for (let k = 0; k < 4; ++k) {
      const ty = y - h * 0.15 - k * h * 0.22, tw = w * (1 - k * 0.2);
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(x, ty - h * 0.36);
      g.lineTo(x + tw / 2, ty);
      g.lineTo(x - tw / 2, ty);
      g.closePath();
      g.fill();
      g.fillStyle = mid;
      g.beginPath();
      g.moveTo(x, ty - h * 0.36);
      g.lineTo(x - tw / 2, ty);
      g.lineTo(x - tw * 0.1, ty);
      g.closePath();
      g.fill();
      if (snow) {
        g.fillStyle = snow;
        g.beginPath();
        g.moveTo(x, ty - h * 0.36);
        g.lineTo(x + tw * 0.2, ty - h * 0.22);
        g.lineTo(x - tw * 0.24, ty - h * 0.2);
        g.closePath();
        g.fill();
        g.fillRect(x - tw / 2, ty - 2, tw * 0.7, 2);
      }
    }
  }

  function cloudStrip(rand, H, count, yLo, yHi, sizeLo, sizeHi, top, mid, bottom) {
    const s = strip(H);
    for (let i = 0; i < count; ++i) {
      const x = (i + rand() * 0.6) * STRIP_W / count;
      const y = yLo + rand() * (yHi - yLo);
      const w = sizeLo + rand() * (sizeHi - sizeLo);
      wrapDraw(STRIP_W, x, w, function(xx) { puffCloud(s.g, xx, y, w, w * 0.32, mulberry(i * 31 + 7), top, mid, bottom); });
    }
    for (let i = 0; i < Math.ceil(count / 2); ++i) {
      const x = rand() * STRIP_W, y = yLo - 30 + rand() * (yHi - yLo + 40), w = sizeLo * (0.3 + rand() * 0.3);
      wrapDraw(STRIP_W, x, w, function(xx) { puffCloud(s.g, xx, y, w, w * 0.3, mulberry(i * 97 + 3), top, mid, bottom); });
    }
    return s;
  }

  /* grass strokes, flower specks and soft rolling bands below a crest */
  function meadowGround(g, ys, H, r) {
    for (let b = 0; b < 3; ++b) {
      const off = 40 + b * 70;
      g.fillStyle = b % 2 ? 'rgba(20,60,20,0.18)' : 'rgba(180,230,120,0.1)';
      g.beginPath();
      g.moveTo(0, H);
      for (let i = 0; i < ys.length; ++i)
        g.lineTo(i * 4, ys[i] + off + Math.sin(i * 0.05 + b * 2) * 14);
      g.lineTo(STRIP_W, H);
      g.closePath();
      g.fill();
    }
    for (let i = 0; i < 2600; ++i) {
      const x = r() * STRIP_W, y0 = ys[Math.floor(x / 4)];
      const y = y0 + 8 + r() * (H - y0);
      g.fillStyle = r() < 0.5 ? 'rgba(170,230,110,0.35)' : 'rgba(20,60,20,0.35)';
      g.fillRect(x, y, 1.5, 3 + r() * 5);
    }
    const petals = ['#ffffff', '#ffe46a', '#ff9ac0', '#c8a8ff'];
    for (let i = 0; i < 420; ++i) {
      const x = r() * STRIP_W, y0 = ys[Math.floor(x / 4)];
      const y = y0 + 12 + r() * (H - y0 - 12);
      g.fillStyle = petals[i % 4];
      g.globalAlpha = 0.45 + 0.5 * (y - y0) / (H - y0);
      g.fillRect(x, y, 2.5, 2.5);
    }
    g.globalAlpha = 1;
  }

  /* a sea of cloud: a row of big puffs over a solid, softly banded base */
  function seaStrip(rand, H, count, y, sizeLo, sizeHi, top, mid, bottom) {
    const s = cloudStrip(rand, H, count, y - 10, y + 10, sizeLo, sizeHi, top, mid, bottom);
    const g = s.g;
    g.fillStyle = linear(g, 0, y + 20, 0, H, [[0, mid], [1, bottom]]);
    g.fillRect(0, y + 20, STRIP_W, H - y - 20);
    for (let i = 0; i < count * 2; ++i) {
      const x = rand() * STRIP_W, yy = y + 50 + rand() * (H - y - 70), w = sizeLo * 0.5 + rand() * sizeLo * 0.5;
      wrapDraw(STRIP_W, x, w, function(xx) { puffCloud(g, xx, yy, w, w * 0.25, mulberry(i * 13 + 5), rgba('#ffffff', 0.5), rgba('#ffffff', 0.25), rgba('#b8a0d8', 0.2)); });
    }
    return s;
  }

  /* soft beams of light falling through cracks in a cave roof */
  function shaftStrip(rand, color) {
    const SH = 460;
    const s = strip(SH);
    const g = s.g;
    for (let i = 0; i < 6; ++i) {
      const x = (i + 0.2 + rand() * 0.6) * STRIP_W / 6, w = 30 + rand() * 50, lean = 120 + rand() * 120;
      wrapDraw(STRIP_W, x, w + lean, function(xx) {
        g.fillStyle = linear(g, 0, 0, 0, SH, [[0, rgba(color, 0.24)], [0.6, rgba(color, 0.07)], [1, rgba(color, 0)]]);
        g.beginPath();
        g.moveTo(xx - w * 0.3, 0);
        g.lineTo(xx + w * 0.3, 0);
        g.lineTo(xx + w + lean, SH);
        g.lineTo(xx - w + lean, SH);
        g.closePath();
        g.fill();
      });
    }
    return s;
  }

  /* ── world 0: Sunleaf Meadows ── */
  function buildMeadow(rand) {
    const L = [];
    L.push({ s: cloudStrip(rand, 340, 6, 150, 270, 140, 330, '#fffbea', '#eef3fb', '#a9b4d6'), y: 0, f: 0.04, vx: 6, alpha: 0.9 });
    const far = paintRange(rand, 380, 300, 210, '#7f9cc4', '#c8d8ee', '#f4f8ff', '#5a6e9a', '#f4f8ff', 0.55, '#c8dcf0');
    L.push({ s: far.s, y: 150, f: 0.08 });
    const mid = paintHills(rand, 360, 190, 90, '#86c45a', '#3e7a34', '#e8ff9a', function(g, ys, r) {
      /* distant tree clumps, hedgerows and a windmill on the crests */
      for (let i = 0; i < 26; ++i) {
        const x = r() * STRIP_W, k = Math.floor(x / 4);
        const size = 12 + r() * 10, seed = Math.floor(r() * 1e6);
        wrapDraw(STRIP_W, x, 40, function(xx) { treeClump(g, xx, ys[Math.min(ys.length - 1, Math.max(0, Math.floor(xx / 4)))] + 6, size, mulberry(seed), '#2f6a30', '#4a8e3c', '#7ab84e', 1); });
        void k;
      }
      for (let i = 0; i < 2; ++i) {
        const x = 300 + i * 760, y = ys[Math.floor(x / 4)] + 4;
        g.fillStyle = '#e8dcc0';
        g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x - 5, y - 46); g.lineTo(x + 5, y - 46); g.lineTo(x + 9, y); g.closePath(); g.fill();
        g.fillStyle = '#b8a888';
        g.fillRect(x + 1, y - 46, 4, 46);
        g.fillStyle = '#a84a3a';
        g.beginPath(); g.moveTo(x - 8, y - 46); g.lineTo(x, y - 56); g.lineTo(x + 8, y - 46); g.closePath(); g.fill();
        g.strokeStyle = '#6a5a48';
        g.lineWidth = 2.5;
        for (let b = 0; b < 4; ++b) {
          const a = b * Math.PI / 2 + 0.4;
          g.beginPath(); g.moveTo(x, y - 48); g.lineTo(x + Math.cos(a) * 26, y - 48 + Math.sin(a) * 26); g.stroke();
        }
      }
    });
    L.push({ s: mid, y: 290, f: 0.2 });
    const near = paintHills(rand, 420, 150, 50, '#4a9a3e', '#1f4a24', '#d8ff90', function(g, ys, r) {
      meadowGround(g, ys, 420, r);
      /* a mixed wood: oaks of every size, poplars and bushes in three greens,
         back row first; the sun stands to the right */
      const greens = [['#1c4a22', '#2e6e2e', '#5aa040'], ['#24502a', '#3c7a32', '#7ab84e'], ['#1a4430', '#2a6644', '#58a066']];
      const items = [];
      for (let x = 0; x < STRIP_W; x += 22 + r() * 34) {
        const k = r();
        items.push({ x: x, dy: 6 + r() * 30, kind: k < 0.16 ? 'poplar' : k < 0.34 ? 'bush' : 'oak', size: r(), pal: greens[Math.floor(r() * 3)], seed: Math.floor(r() * 1e6) });
      }
      items.sort((a, b) => a.dy - b.dy);
      for (const it of items) {
        const y = ys[Math.floor(it.x / 4)] + it.dy;
        const p = it.pal;
        wrapDraw(STRIP_W, it.x, 80, function(px) {
          const rr = mulberry(it.seed);
          if (it.kind === 'poplar')
            poplar(g, px, y, 80 + it.size * 60, p[0], p[1], p[2], 1);
          else if (it.kind === 'bush')
            bush(g, px, y, 14 + it.size * 14, rr, p[0], p[1], p[2], 1);
          else
            treeClump(g, px, y, 20 + it.size * 30, rr, p[0], p[1], p[2], 1);
        });
      }
      /* warm light from the sun side, and a darker grass base so the level
         terrain in front stands out */
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = linear(g, 0, 0, STRIP_W, 0, [[0, 'rgba(255,236,160,0.04)'], [0.6, 'rgba(255,236,160,0.12)'], [1, 'rgba(255,236,160,0.04)']]);
      g.fillRect(0, 0, STRIP_W, 420);
      g.fillStyle = linear(g, 0, 190, 0, 420, [[0, 'rgba(8,36,14,0)'], [0.4, 'rgba(8,36,14,0.35)'], [1, 'rgba(8,36,14,0.6)']]);
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
      grain(g, STRIP_W, 420, r, 2, 'rgba(255,255,220,0.05)', 'rgba(0,30,0,0.08)');
    });
    L.push({ s: near, y: 420, f: 0.38, fill: '#10301a' });
    return { layers: L, glows: [{ x: 0.75, y: 0.22, r: 220, color: '#fff2c0', pulse: 0.08, fixed: true }],
      palette: { ambient: '#fff6b0', fog: 'rgba(240,248,255,0.25)', light: '#fff2c0' },
      front: { top: null, bottom: '#c8e8a8', bottomA: 0.22, warm: null } };
  }

  /* ── world 1: Glimmer Caverns ── */
  function crystal(g, x, y, h, w, color, dir) {
    g.save();
    g.translate(x, y);
    if (dir < 0) g.scale(1, -1);
    g.fillStyle = radial(g, 0, -h * 0.5, 0, h * 1.1, [[0, rgba(color, 0.35)], [0.5, rgba(color, 0.1)], [1, rgba(color, 0)]]);
    g.fillRect(-h * 1.1, -h * 1.6, h * 2.2, h * 2.2);
    g.fillStyle = mix(color, '#102030', 0.45);
    g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w * 0.6, -h * 0.8); g.lineTo(0, -h); g.lineTo(w * 0.7, -h * 0.75); g.lineTo(w, 0); g.closePath(); g.fill();
    g.fillStyle = color;
    g.beginPath(); g.moveTo(-w * 0.6, -h * 0.8); g.lineTo(0, -h); g.lineTo(w * 0.1, 0); g.lineTo(-w, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.moveTo(-w * 0.45, -h * 0.7); g.lineTo(-w * 0.05, -h * 0.92); g.lineTo(-w * 0.2, -h * 0.4); g.closePath(); g.fill();
    g.restore();
  }

  function spikes(g, ys, H, rand, fromTop, body, light, minH, maxH, gap) {
    for (let x = 0; x < STRIP_W; x += gap * (0.6 + rand() * 0.8)) {
      const h = minH + rand() * (maxH - minH), w = h * (0.14 + rand() * 0.1);
      wrapDraw(STRIP_W, x, w, function(xx) {
        const by = fromTop ? 0 : H;
        const ty = fromTop ? h : H - h;
        g.fillStyle = body;
        g.beginPath(); g.moveTo(xx - w, by); g.quadraticCurveTo(xx - w * 0.3, (by + ty) / 2, xx, ty); g.quadraticCurveTo(xx + w * 0.4, (by + ty) / 2, xx + w, by); g.closePath(); g.fill();
        g.fillStyle = light;
        g.beginPath(); g.moveTo(xx - w * 0.7, by); g.quadraticCurveTo(xx - w * 0.25, (by + ty) / 2, xx, ty); g.lineTo(xx - w * 0.2, by); g.closePath(); g.fill();
      });
    }
    void ys;
  }

  function buildCaverns(rand) {
    const L = [];
    /* the far chamber wall: pillars and glowing crystal clusters */
    const far = strip(720);
    {
      const g = far.g;
      for (let i = 0; i < 9; ++i) {
        const x = (i + rand() * 0.5) * STRIP_W / 9, w = 40 + rand() * 70;
        wrapDraw(STRIP_W, x, w, function(xx) {
          g.fillStyle = linear(g, xx - w, 0, xx + w, 0, [[0, '#0e1c2c'], [0.4, '#1d3550'], [1, '#0c1824']]);
          g.beginPath();
          g.moveTo(xx - w * 0.6, 0);
          g.quadraticCurveTo(xx - w * 0.2, 360, xx - w, 720);
          g.lineTo(xx + w, 720);
          g.quadraticCurveTo(xx + w * 0.25, 360, xx + w * 0.6, 0);
          g.closePath();
          g.fill();
        });
      }
      spikes(g, null, 720, rand, true, '#13253a', '#21405e', 40, 150, 50);
      spikes(g, null, 720, rand, false, '#13253a', '#21405e', 50, 170, 46);
      const cols = ['#6ab8ff', '#b88aff', '#5ae0e0'];
      for (let i = 0; i < 16; ++i) {
        const x = rand() * STRIP_W, top = rand() < 0.4;
        const col = cols[i % 3];
        wrapDraw(STRIP_W, x, 40, function(xx) {
          for (let k = 0; k < 3; ++k)
            crystal(g, xx + (k - 1) * 12, top ? 20 + rand() * 60 : 700 - rand() * 50, 18 + rand() * 26, 6 + rand() * 4, col, top ? -1 : 1);
        });
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(10,22,38,0.45)';
      g.fillRect(0, 0, STRIP_W, 720);
      g.restore();
      grain(g, STRIP_W, 720, rand, 2, 'rgba(140,200,255,0.05)', 'rgba(0,0,0,0.08)');
    }
    L.push({ s: far, y: 0, f: 0.08, fill: '#0e1c2c', fillTop: '#0e1c2c', alpha: 1 });
    L.push({ s: shaftStrip(rand, '#8ad0ff'), y: 0, f: 0.12, alpha: 0.8, shimmer: true, add: true });
    /* the middle ceiling teeth and floor stalagmites */
    const top = strip(280);
    spikes(top.g, null, 280, rand, true, '#0c1726', '#1a3048', 60, 250, 70);
    top.g.fillStyle = '#0c1726';
    top.g.fillRect(0, 0, STRIP_W, 30);
    L.push({ s: top, y: -40, f: 0.22, fillTop: '#0c1726' });
    const floor = paintHills(rand, 340, 170, 70, '#1c3854', '#0a1420', '#6ac0ff', function(g, ys, r) {
      spikes(g, ys, 340, r, false, '#122336', '#22405c', 60, 220, 80);
      for (let i = 0; i < 10; ++i) {
        const x = r() * STRIP_W, y = ys[Math.floor(x / 4)] + 10;
        wrapDraw(STRIP_W, x, 30, function(xx) { crystal(g, xx, y, 26 + r() * 30, 8 + r() * 5, i % 2 ? '#6ab8ff' : '#b88aff', 1); });
      }
    });
    L.push({ s: floor, y: 400, f: 0.24, fill: '#0a1420' });
    /* near: stalagmite clusters and glowing fungus */
    const near = strip(440);
    {
      const g = near.g;
      for (let x = 0; x < STRIP_W; x += 50 + rand() * 90) {
        const h = 90 + rand() * 180, w = h * 0.16;
        wrapDraw(STRIP_W, x, w * 2, function(xx) {
          g.fillStyle = '#081322';
          g.beginPath(); g.moveTo(xx - w, 440); g.quadraticCurveTo(xx - w * 0.3, 440 - h * 0.5, xx, 440 - h); g.quadraticCurveTo(xx + w * 0.35, 440 - h * 0.5, xx + w, 440); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(110,190,255,0.3)';
          g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(xx - w * 0.8, 440 - h * 0.08); g.quadraticCurveTo(xx - w * 0.3, 440 - h * 0.5, xx, 440 - h); g.stroke();
        });
      }
      g.fillStyle = '#081322';
      g.fillRect(0, 400, STRIP_W, 40);
      for (let m = 0; m < 26; ++m) {
        const mx = rand() * STRIP_W, my = 396 + rand() * 30, sz = 4 + rand() * 6;
        g.fillStyle = 'rgba(90,240,200,0.14)';
        g.beginPath(); g.arc(mx, my - sz, sz * 3, 0, TWO_PI); g.fill();
        g.fillStyle = '#c8fff0';
        g.fillRect(mx - 1, my - sz, 2, sz + 2);
        g.fillStyle = m % 3 ? '#5af0c8' : '#9a8aff';
        g.beginPath(); g.ellipse(mx, my - sz, sz, sz * 0.6, 0, Math.PI, TWO_PI); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.fillRect(mx - sz * 0.5, my - sz * 1.4, sz * 0.4, 1.5);
      }
    }
    L.push({ s: near, y: 330, f: 0.42, fill: '#081322' });
    const glows = [];
    for (let i = 0; i < 6; ++i)
      glows.push({ x: rand(), y: 0.15 + rand() * 0.7, r: 60 + rand() * 80, color: i % 2 ? '#6ab8ff' : '#b88aff', pulse: 0.35, f: 0.08, speed: 0.7 + rand() });
    return { layers: L, glows: glows,
      palette: { ambient: '#8ad0ff', fog: 'rgba(40,90,140,0.25)', light: '#6ab8ff' },
      front: { top: '#02060c', topA: 0.55, bottom: '#123048', bottomA: 0.35 } };
  }

  /* ── world 2: Frostfang Peaks ── */
  function aurora(rand) {
    const s = strip(300);
    const g = s.g;
    const n = loopNoise(rand, 4);
    g.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; ++band) {
      const col = ['#4affb0', '#5ad8ff', '#b88aff'][band];
      for (let x = 0; x < STRIP_W; x += 3) {
        const u = x / STRIP_W;
        const y = 60 + n(u + band * 0.31, 0.5) * 120 + band * 18;
        const h = 60 + n(u * 2 + band, 0.6) * 120;
        const a = 0.1 + 0.22 * n(u * 3 + band * 0.7, 0.4);
        g.fillStyle = linear(g, 0, y, 0, y + h, [[0, rgba(col, 0)], [0.6, rgba(col, a)], [1, rgba(col, 0)]]);
        g.fillRect(x, y, 3, h);
      }
    }
    return s;
  }

  function buildPeaks(rand) {
    const L = [];
    L.push({ s: aurora(rand), y: 10, f: 0.02, vx: 4, alpha: 0.9, shimmer: true });
    const far = paintRange(rand, 460, 420, 340, '#6a7cb0', '#b8c4e8', '#ffffff', '#3a4680', '#f2f6ff', 0.6, '#d8b8d0');
    L.push({ s: far.s, y: 70, f: 0.06 });
    const mid = paintRange(rand, 380, 300, 200, '#41598c', '#8aa0cc', '#e8f4ff', '#22305a', '#e8f2ff', 0.5, '#8890c0');
    L.push({ s: mid.s, y: 230, f: 0.16 });
    const near = paintHills(rand, 420, 170, 60, '#dfe8f6', '#a8b8d8', '#ffffff', function(g, ys, r) {
      /* a snowy valley: blue shadow pooling below the treeline, wind-carved
         drifts with lit crests, frozen lakes catching the sky, glittering snow */
      g.save();
      ridgePath(g, ys, 420);
      g.clip();
      g.fillStyle = linear(g, 0, 170, 0, 420, [[0, 'rgba(70,90,160,0.3)'], [0.35, 'rgba(70,90,160,0.08)'], [1, 'rgba(40,60,120,0.25)']]);
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
      for (let b = 0; b < 5; ++b) {
        const off = 50 + b * 45, ph = r() * 6;
        const line = [];
        for (let i = 0; i < ys.length; ++i)
          line.push(ys[i] + off + Math.sin(i * 0.035 + ph) * 14 + Math.sin(i * 0.11 + ph * 2) * 5);
        /* the drift body, its blue lee shadow and a lit crest */
        g.fillStyle = 'rgba(236,242,255,0.55)';
        g.beginPath(); g.moveTo(0, 420);
        for (let i = 0; i < line.length; ++i) g.lineTo(i * 4, line[i]);
        g.lineTo(STRIP_W, 420); g.closePath(); g.fill();
        g.fillStyle = linear(g, 0, off + 150, 0, off + 210, [[0, 'rgba(90,112,180,0.28)'], [1, 'rgba(90,112,180,0)']]);
        g.beginPath(); g.moveTo(0, 420);
        for (let i = 0; i < line.length; ++i) g.lineTo(i * 4, line[i] + 3);
        g.lineTo(STRIP_W, 420); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = 1.5;
        g.beginPath();
        for (let i = 0; i < line.length; ++i) { if (i) g.lineTo(i * 4, line[i]); else g.moveTo(0, line[0]); }
        g.stroke();
        if (b === 1) {
          /* frozen lakes lying in this hollow */
          for (let k = 0; k < 2; ++k) {
            const lx = 300 + k * 760 + r() * 120, lw = 170 + r() * 110;
            const ly = line[Math.floor(lx / 4)] + 24;
            wrapDraw(STRIP_W, lx, lw, function(xx) {
              g.fillStyle = '#f2f6ff';
              g.beginPath(); g.ellipse(xx, ly, lw + 8, 19, 0, 0, TWO_PI); g.fill();
              g.fillStyle = linear(g, 0, ly - 14, 0, ly + 14, [[0, '#5a7ab8'], [0.5, '#8ab4e0'], [1, '#c8e0f8']]);
              g.beginPath(); g.ellipse(xx, ly, lw, 14, 0, 0, TWO_PI); g.fill();
              /* mirrored treeline and a glint of moonlight */
              g.fillStyle = 'rgba(22,36,60,0.3)';
              for (let t = 0; t < 12; ++t)
                g.fillRect(xx - lw * 0.8 + t * lw * 0.14, ly - 13, 4, 6 + (t * 7) % 8);
              g.fillStyle = 'rgba(255,255,255,0.7)';
              g.fillRect(xx - lw * 0.4, ly + 2, lw * 0.5, 1.5);
              g.fillRect(xx - lw * 0.2, ly + 6, lw * 0.3, 1);
            });
          }
        }
      }
      for (let i = 0; i < 700; ++i) {
        const x = r() * STRIP_W, y0 = ys[Math.floor(x / 4)];
        const y = y0 + 30 + r() * (420 - y0 - 30);
        if (r() < 0.12) {
          /* a glint */
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.fillRect(x - 3, y, 7, 1);
          g.fillRect(x, y - 3, 1, 7);
        } else {
          g.fillStyle = r() < 0.6 ? 'rgba(255,255,255,0.7)' : 'rgba(110,140,200,0.35)';
          g.fillRect(x, y, 2, 1.5);
        }
      }
      for (let x = 0; x < STRIP_W; x += 18 + r() * 26) {
        const y = ys[Math.floor(x / 4)] + 16, h = 70 + r() * 90;
        wrapDraw(STRIP_W, x, 40, function(xx) { pine(g, xx, y, h, '#16243c', '#2a3e5e', 'rgba(240,248,255,0.9)'); });
      }
    });
    L.push({ s: near, y: 380, f: 0.36, fill: '#a8b8d8' });
    /* slow distant snowfall */
    const snow = strip(720);
    for (let i = 0; i < 700; ++i) {
      const x = rand() * STRIP_W, y = rand() * 720, r = 0.6 + rand() * 1.8;
      snow.g.fillStyle = 'rgba(255,255,255,' + (0.3 + rand() * 0.5).toFixed(3) + ')';
      snow.g.beginPath(); snow.g.arc(x, y, r, 0, TWO_PI); snow.g.fill();
    }
    L.push({ s: snow, y: 0, f: 0.1, vx: -10, vy: 30, alpha: 0.7, rain: true });
    return { layers: L, glows: [{ x: 0.24, y: 0.2, r: 140, color: '#c8dcff', pulse: 0.05, fixed: true }],
      palette: { ambient: '#ffffff', fog: 'rgba(220,230,255,0.3)', light: '#c8dcff' },
      front: { top: null, bottom: '#e8f0ff', bottomA: 0.28 } };
  }

  /* ── world 3: Cinder Forge ── */
  function buildForge(rand) {
    const L = [];
    /* volcanoes with lava runs and craters */
    const far = strip(420);
    {
      const g = far.g;
      const cones = [[250, 160, 300], [820, 110, 380], [1300, 190, 280]];
      for (const cn of cones) {
        wrapDraw(STRIP_W, cn[0], cn[2] + 40, function(x) {
          const top = cn[1], w = cn[2];
          g.fillStyle = linear(g, 0, top, 0, 420, [[0, '#4a1c18'], [1, '#22100e']]);
          g.beginPath();
          g.moveTo(x - w, 420);
          g.quadraticCurveTo(x - w * 0.35, top + 90, x - 34, top);
          g.lineTo(x + 34, top);
          g.quadraticCurveTo(x + w * 0.35, top + 90, x + w, 420);
          g.closePath();
          g.fill();
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.beginPath(); g.moveTo(x + 10, top); g.lineTo(x + 34, top); g.quadraticCurveTo(x + w * 0.35, top + 90, x + w, 420); g.lineTo(x + w * 0.2, 420); g.closePath(); g.fill();
          /* glowing lava rivulets */
          g.strokeStyle = 'rgba(255,120,40,0.85)';
          g.lineCap = 'round';
          for (let k = 0; k < 4; ++k) {
            let px = x + (k - 1.5) * 16, py = top + 4;
            g.lineWidth = 3.5 - k * 0.5;
            g.beginPath();
            g.moveTo(px, py);
            while (py < 420) {
              py += 18;
              px += (rand() - 0.5) * 18 + (k - 1.5) * 4;
              g.lineTo(px, py);
            }
            g.stroke();
          }
          g.fillStyle = radial(g, x, top, 0, 70, [[0, 'rgba(255,200,90,0.9)'], [0.4, 'rgba(255,110,40,0.4)'], [1, 'rgba(255,90,30,0)']]);
          g.fillRect(x - 70, top - 70, 140, 140);
        });
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(80,24,16,0.35)';
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
    }
    L.push({ s: far, y: 130, f: 0.06 });
    /* basalt columns and forge towers with lit windows */
    const mid = strip(380);
    {
      const g = mid.g;
      for (let x = 0; x < STRIP_W;) {
        const w = 20 + rand() * 34, h = 90 + rand() * 200;
        const xx = x;
        g.fillStyle = linear(g, xx, 0, xx + w, 0, [[0, '#3a1814'], [0.5, '#2a100e'], [1, '#160808']]);
        g.fillRect(xx, 380 - h, w, h);
        g.fillStyle = 'rgba(255,120,50,0.25)';
        g.fillRect(xx, 380 - h, w, 3);
        if (rand() < 0.35) {
          for (let k = 0; k < 4; ++k) {
            g.fillStyle = rand() < 0.6 ? '#ffb04a' : '#ff7a2a';
            g.fillRect(xx + w * 0.3, 380 - h + 20 + k * 26, w * 0.4, 9);
          }
        }
        x += w + rand() * 8;
      }
      for (let i = 0; i < 3; ++i) {
        const x = 200 + i * 520, h = 300;
        g.fillStyle = '#1c0a0a';
        g.fillRect(x, 380 - h, 46, h);
        g.fillRect(x - 8, 380 - h, 62, 16);
        g.fillStyle = 'rgba(255,140,60,0.5)';
        g.fillRect(x + 4, 380 - h - 4, 38, 4);
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = linear(g, 0, 200, 0, 380, [[0, 'rgba(255,90,30,0)'], [1, 'rgba(255,90,30,0.35)']]);
      g.fillRect(0, 0, STRIP_W, 380);
      g.restore();
    }
    L.push({ s: mid, y: 250, f: 0.18 });
    /* near: crags and pipes underlit by lava */
    const near = paintHills(rand, 420, 190, 80, '#2a1210', '#0e0606', '#ff6a2a', function(g, ys, r) {
      for (let i = 0; i < 6; ++i) {
        const x = r() * STRIP_W, y = ys[Math.floor(x / 4)];
        wrapDraw(STRIP_W, x, 60, function(xx) {
          g.fillStyle = '#120808';
          g.fillRect(xx - 14, y - 160, 28, 180);
          g.fillRect(xx - 22, y - 168, 44, 14);
          g.fillStyle = 'rgba(255,110,40,0.55)';
          g.fillRect(xx - 14, y - 160, 3, 180);
          for (let b = 0; b < 4; ++b) {
            g.fillStyle = '#241010';
            g.fillRect(xx - 17, y - 130 + b * 36, 34, 6);
            g.fillStyle = 'rgba(255,140,60,0.4)';
            g.fillRect(xx - 17, y - 130 + b * 36, 34, 1);
          }
        });
      }
      /* glowing cracks in the slag below the crest */
      g.lineCap = 'round';
      for (let i = 0; i < 18; ++i) {
        let x = r() * STRIP_W, y = ys[Math.floor(x / 4)] + 30 + r() * 120;
        g.strokeStyle = 'rgba(255,' + (90 + Math.floor(r() * 80)) + ',30,0.75)';
        g.lineWidth = 1.5 + r() * 2;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; ++k) {
          x += 10 + r() * 24;
          y += (r() - 0.5) * 18;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = linear(g, 0, 200, 0, 420, [[0, 'rgba(255,100,30,0)'], [1, 'rgba(255,100,30,0.4)']]);
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
    });
    L.push({ s: near, y: 370, f: 0.38, fill: '#0e0606' });
    const glows = [];
    for (let i = 0; i < 3; ++i)
      glows.push({ x: [250, 820, 1300][i] / STRIP_W, y: 0, r: 160, color: '#ff8a3a', pulse: 0.4, f: 0.06, strip: true, sy: 130 + [160, 110, 190][i], speed: 1.3 + i * 0.4 });
    return { layers: L, glows: glows,
      palette: { ambient: '#ffb05a', fog: 'rgba(255,110,40,0.2)', light: '#ff8a3a' },
      front: { top: '#1a0606', topA: 0.35, bottom: '#ff5a1a', bottomA: 0.3 } };
  }

  /* ── world 4: Skyspire Citadel ── */
  function spire(g, x, base, h, w, body, light, gold) {
    g.fillStyle = body;
    g.fillRect(x - w / 2, base - h, w, h);
    g.fillStyle = light;
    g.fillRect(x - w / 2, base - h, w * 0.3, h);
    g.fillStyle = body;
    g.beginPath(); g.moveTo(x - w * 0.7, base - h); g.lineTo(x, base - h - w * 2.2); g.lineTo(x + w * 0.7, base - h); g.closePath(); g.fill();
    g.fillStyle = gold;
    g.beginPath(); g.moveTo(x - w * 0.15, base - h - w * 1.6); g.lineTo(x, base - h - w * 2.2); g.lineTo(x + w * 0.1, base - h - w * 1.6); g.closePath(); g.fill();
    g.fillRect(x - 1, base - h - w * 2.2 - 8, 2, 8);
    for (let k = 0; k < Math.floor(h / 24); ++k) {
      g.fillStyle = 'rgba(255,224,138,0.75)';
      g.fillRect(x - w * 0.12, base - h + 10 + k * 24, w * 0.24, 8);
    }
  }

  function island(g, x, y, w, rand, rock, grass, light) {
    const depth = w * (0.55 + rand() * 0.2);
    const pts = [];
    for (let k = 0; k <= 10; ++k) {
      const u = k / 10;
      pts.push([x - w / 2 + u * w, y + Math.pow(Math.sin(u * Math.PI), 0.8) * depth * (0.75 + rand() * 0.3)]);
    }
    g.beginPath();
    g.moveTo(x - w / 2, y);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.closePath();
    g.fillStyle = linear(g, x - w / 2, y, x + w / 2, y + depth, [[0, mix(rock, '#ffffff', 0.18)], [0.5, rock], [1, mix(rock, '#000000', 0.35)]]);
    g.fill();
    /* strata */
    g.save();
    g.clip();
    for (let k = 1; k < 6; ++k) {
      g.strokeStyle = k % 2 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.1)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - w / 2, y + k * depth / 7);
      g.quadraticCurveTo(x, y + k * depth / 7 + 8 * (rand() - 0.5), x + w / 2, y + k * depth / 7);
      g.stroke();
    }
    g.restore();
    /* hanging roots */
    g.strokeStyle = 'rgba(70,50,60,0.6)';
    g.lineWidth = 1.2;
    for (let k = 0; k < 6; ++k) {
      const rx = x - w * 0.4 + rand() * w * 0.8;
      g.beginPath(); g.moveTo(rx, y + depth * 0.3); g.quadraticCurveTo(rx + 4, y + depth * 0.6, rx - 2, y + depth * (0.7 + rand() * 0.4)); g.stroke();
    }
    /* lush top with tufts */
    g.fillStyle = mix(grass, '#000000', 0.25);
    g.beginPath(); g.ellipse(x, y + 2, w / 2 + 4, 9, 0, 0, TWO_PI); g.fill();
    g.fillStyle = grass;
    g.beginPath(); g.ellipse(x, y - 1, w / 2 + 2, 7, 0, 0, TWO_PI); g.fill();
    g.fillStyle = light;
    g.beginPath(); g.ellipse(x - w * 0.12, y - 4, w * 0.32, 2.5, 0, 0, TWO_PI); g.fill();
    for (let k = 0; k < 8; ++k) {
      const tx = x - w * 0.45 + rand() * w * 0.9;
      g.fillStyle = mix(grass, '#ffffff', 0.15);
      g.beginPath(); g.arc(tx, y - 4, 4 + rand() * 5, Math.PI, TWO_PI); g.fill();
    }
    if (rand() < 0.5) {
      g.fillStyle = 'rgba(220,235,255,0.55)';
      g.fillRect(x + w * 0.28, y + 2, 3, depth * 1.4);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(x + w * 0.28 + 1, y + 2, 1, depth * 1.4);
    }
  }

  function buildCitadel(rand) {
    const L = [];
    L.push({ s: cloudStrip(rand, 320, 7, 140, 260, 120, 280, '#fff2e6', '#f0dcef', '#a990c8'), y: 0, f: 0.03, vx: 5 });
    const far = strip(420);
    {
      const g = far.g;
      for (let i = 0; i < 5; ++i) {
        const x = (i + 0.3 + rand() * 0.4) * STRIP_W / 5, y = 220 + rand() * 80, w = 150 + rand() * 80;
        wrapDraw(STRIP_W, x, w, function(xx) {
          island(g, xx, y, w, mulberry(i * 17 + 3), '#9a88c8', '#c8d8a8', '#fff0c8');
          if (i % 2 === 0) {
            spire(g, xx - 20, y, 110 + rand() * 60, 18, '#c8b8e8', '#ece0ff', '#ffe08a');
            spire(g, xx + 26, y, 70 + rand() * 40, 14, '#b8a8e0', '#e0d4ff', '#ffe08a');
          }
        });
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(210,190,240,0.4)';
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
    }
    L.push({ s: far, y: 70, f: 0.07 });
    const mid = strip(420);
    {
      const g = mid.g;
      for (let i = 0; i < 4; ++i) {
        const x = (i + 0.5) * STRIP_W / 4 + (rand() - 0.5) * 120, y = 200 + rand() * 90, w = 180 + rand() * 120;
        wrapDraw(STRIP_W, x, w, function(xx) {
          island(g, xx, y, w, mulberry(i * 29 + 11), '#6e5c9c', '#8ac070', '#fff0b0');
          if (i === 1)
            spire(g, xx, y, 160, 26, '#a090d0', '#d8ccff', '#ffd75a');
        });
      }
    }
    L.push({ s: mid, y: 150, f: 0.15, bob: 6 });
    L.push({ s: seaStrip(rand, 480, 9, 300, 260, 420, '#fff8ff', '#efe0f6', '#c8b4e4'), y: 260, f: 0.3, vx: 10, fill: '#c8b4e4' });
    const sea = seaStrip(rand, 420, 7, 290, 300, 460, '#f6eefc', '#e2d6f0', '#a898c8');
    /* the near sea sinks into soft lavender shade so pale platforms in front stay readable */
    sea.g.save();
    sea.g.globalCompositeOperation = 'source-atop';
    sea.g.fillStyle = linear(sea.g, 0, 240, 0, 420, [[0, 'rgba(90,70,140,0)'], [0.5, 'rgba(90,70,140,0.25)'], [1, 'rgba(70,52,120,0.45)']]);
    sea.g.fillRect(0, 0, STRIP_W, 420);
    sea.g.restore();
    L.push({ s: sea, y: 350, f: 0.45, vx: 16, fill: '#8a78b0' });
    return { layers: L, glows: [{ x: 0.23, y: 0.55, r: 260, color: '#ffe0a0', pulse: 0.06, fixed: true }],
      palette: { ambient: '#fff0c0', fog: 'rgba(255,240,255,0.3)', light: '#ffe08a' },
      front: { top: null, bottom: '#fff4ff', bottomA: 0.35 } };
  }

  const BUILDERS = [buildMeadow, buildCaverns, buildPeaks, buildForge, buildCitadel];

  /* trims fully transparent rows off a strip (build time only) so no
     empty pixels are blended every frame; returns the rows cut off the top */
  function cropStrip(L) {
    const c = L.img;
    const g = c.getContext('2d');
    if (!g.getImageData || L.rain)
      return;
    const data = g.getImageData(0, 0, c.width, c.height).data;
    const rowHas = function(y) {
      for (let x = 0; x < c.width; x += 3)
        if (data[(y * c.width + x) * 4 + 3] > 2)
          return true;
      return false;
    };
    let top = 0, bottom = c.height - 1;
    while (top < bottom && !rowHas(top)) ++top;
    while (bottom > top && !rowHas(bottom)) --bottom;
    top = Math.max(0, top - 1);
    bottom = Math.min(c.height - 1, bottom + 1);
    if (top === 0 && bottom === c.height - 1)
      return;
    const n = makeCanvas(c.width, bottom - top + 1);
    n.getContext('2d').drawImage(c, 0, -top);
    L.img = n;
    L.y += top;
    L.h = n.height;
  }

  /* the thin atmosphere bands drawn over the level */
  const BAND_H = 230;
  function band(color, alpha, fromTop) {
    const c = makeCanvas(VIEW_W, BAND_H);
    const g = c.getContext('2d');
    g.fillStyle = linear(g, 0, 0, 0, BAND_H, fromTop
      ? [[0, rgba(color, alpha)], [0.5, rgba(color, alpha * 0.3)], [1, rgba(color, 0)]]
      : [[0, rgba(color, 0)], [0.5, rgba(color, alpha * 0.3)], [1, rgba(color, alpha)]]);
    g.fillRect(0, 0, VIEW_W, BAND_H);
    return c;
  }

  /* ══════════════════════════════════════════════════════════════════
     SCENE
     ══════════════════════════════════════════════════════════════════ */

  const cache = {};

  function create(world) {
    world = Math.max(0, Math.min(WORLD_COUNT - 1, world | 0));
    if (cache[world])
      return cache[world];
    const rand = mulberry(0x51ed + world * 7919);
    const sky = paintSky(world, rand);
    const def = BUILDERS[world](rand);
    const layers = def.layers.map(l => ({
      img: l.s.c, w: STRIP_W, h: l.s.c.height, y: l.y, f: l.f, vx: l.vx || 0, vy: l.vy || 0,
      fill: l.fill || null, fillTop: l.fillTop || null, alpha: l.alpha === undefined ? 1 : l.alpha,
      shimmer: !!l.shimmer, rain: !!l.rain, bob: l.bob || 0, add: !!l.add
    }));
    for (const L of layers)
      cropStrip(L);
    const glows = def.glows.map(gl => Object.assign({ img: glow(gl.color, gl.r) }, gl));
    const fr = def.front;
    const front = {
      top: fr.top ? band(fr.top, fr.topA, true) : null,
      bottom: fr.bottom ? band(fr.bottom, fr.bottomA, false) : null
    };

    /* device-pixel snapping: whole-pixel blits at scale 1 skip resampling */
    let ta = 1, te = 0, td = 1, tf = 0;
    function readTransform(ctx) {
      const m = ctx.getTransform ? ctx.getTransform() : null;
      ta = m && m.a ? m.a : 1; te = m ? m.e : 0; td = m && m.d ? m.d : 1; tf = m ? m.f : 0;
    }
    function snapX(x) { return (Math.round(x * ta + te) - te) / ta; }
    function snapY(y) { return (Math.round(y * td + tf) - tf) / td; }

    function drawSky(ctx, v) {
      const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
      const s = Math.max(1, vw / VIEW_W, vh / VIEW_H);
      const w = VIEW_W * s, h = VIEW_H * s;
      /* centred on the view, but never leaving a gap at an edge */
      let x = Math.min(v.x0, Math.max(v.x1 - w, VIEW_W / 2 - w / 2));
      let y = Math.min(v.y0, Math.max(v.y1 - h, VIEW_H / 2 - h / 2));
      x = snapX(x);
      y = snapY(y);
      ctx.drawImage(sky, x, y, s === 1 ? VIEW_W : w + 1, s === 1 ? VIEW_H : h + 1);
    }

    function drawLayer(ctx, L, v, camX, camY, t) {
      const W = L.w;
      let off = (camX * L.f + t * L.vx) % W;
      if (off < 0) off += W;
      let y = L.y - (camY - CAM_REF) * L.f * 0.5;
      if (L.bob)
        y += Math.sin(t * 0.6) * L.bob;
      const prevAlpha = ctx.globalAlpha;
      let a = L.alpha;
      if (L.shimmer)
        a *= 0.75 + 0.25 * Math.sin(t * 0.8);
      ctx.globalAlpha = prevAlpha * a;
      const prevOp = ctx.globalCompositeOperation;
      if (L.add)
        ctx.globalCompositeOperation = 'lighter';
      if (L.rain) {
        /* a falling sheet: tiles vertically as well */
        let oy = (t * L.vy) % L.h;
        for (let yy = v.y0 - L.h + ((oy - v.y0) % L.h + L.h) % L.h; yy < v.y1; yy += L.h)
          for (let x = v.x0 - ((v.x0 + off) % W + W) % W; x < v.x1; x += W)
            ctx.drawImage(L.img, snapX(x), snapY(yy), W, L.h);
        ctx.globalAlpha = prevAlpha;
        return;
      }
      y = snapY(y);
      for (let x = v.x0 - ((v.x0 + off) % W + W) % W; x < v.x1; x += W)
        ctx.drawImage(L.img, snapX(x), y, W, L.h);
      ctx.globalAlpha = prevAlpha;
      ctx.globalCompositeOperation = prevOp;
      if (L.fill && y + L.h < v.y1) {
        ctx.fillStyle = L.fill;
        ctx.fillRect(v.x0, y + L.h - 1, v.x1 - v.x0, v.y1 - (y + L.h) + 1);
      }
      if (L.fillTop && y > v.y0) {
        ctx.fillStyle = L.fillTop;
        ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, y - v.y0 + 1);
      }
    }

    function drawGlows(ctx, v, camX, camY, t) {
      const prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < glows.length; ++i) {
        const gl = glows[i];
        let x, y;
        if (gl.fixed) {
          x = gl.x * VIEW_W;
          y = gl.y * VIEW_H;
        } else if (gl.strip) {
          const W = STRIP_W;
          let base = gl.x * W - ((camX * gl.f) % W);
          base = v.x0 + (((base - v.x0) % W) + W) % W;
          x = base;
          y = gl.sy - (camY - CAM_REF) * gl.f * 0.5;
        } else {
          const W = VIEW_W * 1.5;
          x = v.x0 + ((((gl.x * W - camX * gl.f) - v.x0) % W) + W) % W;
          y = gl.y * VIEW_H;
        }
        const k = 1 - gl.pulse + gl.pulse * Math.sin(t * (gl.speed || 1) + i * 1.7);
        ctx.globalAlpha = prevA * k * 0.8;
        ctx.drawImage(gl.img, snapX(x - gl.img.width / 2), snapY(y - gl.img.height / 2), gl.img.width, gl.img.height);
      }
      ctx.globalCompositeOperation = prevOp;
      ctx.globalAlpha = prevA;
    }

    function drawBack(ctx, v, camX, camY, t) {
      camX = camX || 0;
      camY = camY === undefined ? CAM_REF : camY;
      t = t || 0;
      readTransform(ctx);
      drawSky(ctx, v);
      const firstStrip = world === 1 ? 0 : 1;
      for (let i = 0; i < layers.length; ++i) {
        if (i === firstStrip)
          drawGlows(ctx, v, camX, camY, t);
        drawLayer(ctx, layers[i], v, camX, camY, t);
      }
    }

    function drawFront(ctx, v, camX, camY, t) {
      void camX; void camY; void t;
      readTransform(ctx);
      const w = v.x1 - v.x0;
      const bw = w <= VIEW_W + 0.5 ? VIEW_W : w;
      const bx = snapX(w <= VIEW_W + 0.5 ? v.x0 + (w - VIEW_W) / 2 : v.x0);
      if (front.top)
        ctx.drawImage(front.top, bx, snapY(v.y0), bw, BAND_H);
      if (front.bottom)
        ctx.drawImage(front.bottom, bx, snapY(v.y1 - BAND_H), bw, BAND_H);
    }

    function drawMenu(ctx, v, t) {
      drawBack(ctx, v, t * 40, CAM_REF + Math.sin(t * 0.2) * 20, t);
    }

    const scene = Object.freeze({ world: world, palette: Object.freeze(def.palette), drawBack: drawBack, drawFront: drawFront, drawMenu: drawMenu });
    cache[world] = scene;
    return scene;
  }

  SZ.PlatformerScene = Object.freeze({ WORLD_COUNT, STRIP_W, create });
})();
