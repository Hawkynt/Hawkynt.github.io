;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Five illustrated restaurant interiors for the Cooking Game career, one per
   * location. Every room is baked ONCE into cached canvases with a seeded rng:
   * textured materials (wood grain with knots, bevelled tiles with grout and
   * sheen, brick with mortar, veined marble, brushed steel), soft ambient
   * occlusion, warm light pools from the room's lamps and a vignette.
   *
   *   back     the whole opaque room (1280 x 720)
   *   front    the serving counter alone (y 312..404), drawn over the guests
   *            so they sit behind it
   *
   * A frame costs one full-screen blit plus small sprites for the ambient
   * life: passers-by and traffic outside the truck, the flickering diner neon
   * and jukebox, breathing bistro lamps and walkers in the Paris window,
   * drifting sakura petals and swaying lanterns, chandelier sparkle and
   * twinkling city lights, steam over the kitchen line. No gradients and no
   * blur per frame.
   *
   * Layout the painting is built around (the play view is 1280 x 720):
   *   y   0..318  back wall / window, guests sit in front of it
   *   y 318..404  the serving counter: top surface, brass or chrome lip, face
   *   y 404..590  kitchen backsplash with shelf, the ticket rail hangs at 452
   *   y 590..632  worktop the five stations stand on
   *   y 632..720  counter front with one instrument plate per station
   */

  const W = 1280, H = 720;
  const TWO_PI = Math.PI * 2;
  const FULL_VIEW = Object.freeze({ x0: 0, y0: 0, x1: W, y1: H });

  const WAIN_T = 236;                 // wainscot / lower wall behind the guests
  const CTR_T = 318, CTR_LIP = 380, CTR_FACE = 387, CTR_B = 404;
  const FRONT_T = 312;                // the front layer starts a little above the counter
  const KIT_T = 404, WORK_T = 590, WORK_EDGE = 624, FRONT_K = 632;
  const PLATE_T = 642, PLATE_B = 694;
  const ST_X0 = 40, ST_STEP = 245, ST_W = 150;

  const THEMES = {
    truck: { wall: '#dfe4e8', metal: '#b9c2c8', accent: '#ff9a3a', seat: '#ff9a3a' },
    diner: { wall: '#bfe6d8', accent: '#d8465a', seat: '#d8465a', floorA: '#f2ede2', floorB: '#d8465a' },
    bistro: { wall: '#8a4a32', accent: '#c0703a', seat: '#8a5a2a', wood: '#6a4226' },
    sushi: { wall: '#caa06a', accent: '#c0392b', seat: '#d8b078', wood: '#7a5230' },
    hotel: { wall: '#efe9dc', accent: '#d4af37', seat: '#efe6d2', marble: '#e6e0d2' }
  };
  const THEME_NAMES = ['truck', 'diner', 'bistro', 'sushi', 'hotel'];

  /* ── colour helpers ── */

  function hexToRgb(hex) {
    let h = String(hex === undefined || hex === null ? '' : hex).trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    const n = parseInt(h, 16);
    if (isNaN(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, a) {
    const c = hexToRgb(hex);
    const k = Math.max(0, Math.min(1, a));
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + k + ')';
  }

  /* f in [-1, 1]: negative darkens toward black, positive lightens toward white */
  function shade(hex, f) {
    const c = hexToRgb(hex);
    const target = f < 0 ? 0 : 255;
    const k = Math.min(1, Math.abs(f));
    const ch = function(v) {
      const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    };
    return '#' + ch(c.r + (target - c.r) * k) + ch(c.g + (target - c.g) * k) + ch(c.b + (target - c.b) * k);
  }

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return cv;
  }

  /* mulberry32: the same seeded rng the sister modules use */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     BAKE-TIME PAINTING HELPERS (gradients live only in the cache)
     ══════════════════════════════════════════════════════════════════ */

  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function lin(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; ++i) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }

  function vgrad(c, x, y, w, h, stops) {
    c.fillStyle = lin(c, x, y, x, y + h, stops);
    c.fillRect(x, y, w, h);
  }

  function hgrad(c, x, y, w, h, stops) {
    c.fillStyle = lin(c, x, y, x + w, y, stops);
    c.fillRect(x, y, w, h);
  }

  function dot(c, x, y, r, color) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, TWO_PI);
    c.fill();
  }

  function ellipse(c, x, y, rx, ry, color) {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TWO_PI);
    c.fill();
  }

  /* soft round glow (radial gradient) */
  function glow(c, x, y, r, color, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.4, rgba(color, a * 0.45));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* an additive light pool, elliptical */
  function lightPool(c, x, y, rx, ry, color, a) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.translate(x, y);
    c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.5, rgba(color, a * 0.35));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(-rx, -rx, rx * 2, rx * 2);
    c.restore();
  }

  /* a soft shadow band: dark at edge y0 fading over h (negative h fades up) */
  function shadowBand(c, x, y0, w, h, a) {
    const y1 = y0 + h;
    c.fillStyle = lin(c, 0, y0, 0, y1, [[0, 'rgba(10,4,0,' + a + ')'], [1, 'rgba(10,4,0,0)']]);
    c.fillRect(x, Math.min(y0, y1), w, Math.abs(h));
  }

  function noiseTile() {
    const cv = makeCanvas(128, 128);
    const c = cv.getContext('2d');
    if (!c.createImageData || !c.putImageData) return null;
    const img = c.createImageData(128, 128);
    const d = img.data;
    const rnd = mulberry32(99);
    for (let i = 0; i < d.length; i += 4) {
      const v = rnd();
      const on = v > 0.5;
      d[i] = d[i + 1] = d[i + 2] = on ? 255 : 0;
      d[i + 3] = Math.floor(Math.abs(v - 0.5) * 2 * 26);
    }
    c.putImageData(img, 0, 0);
    return cv;
  }

  let noise = null;
  /* fine film grain over a region so flat fills read as a material */
  function grainOver(c, x, y, w, h, a) {
    if (noise === null) noise = noiseTile() || false;
    if (!noise) return;
    const p = c.createPattern(noise, 'repeat');
    if (!p) return;
    c.save();
    c.globalAlpha = a;
    c.fillStyle = p;
    c.fillRect(x, y, w, h);
    c.restore();
  }

  /* ── materials ── */

  /* planks with seams, sine-warped grain, knots and a varnish sheen */
  function planks(c, x, y, w, h, base, rnd, o) {
    o = o || {};
    const vertical = !!o.vertical;
    const pw = o.plank || 28;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    const span = vertical ? w : h;
    for (let p = 0; p < span; p += pw) {
      const tone = shade(base, (rnd() - 0.5) * 0.2);
      const px = vertical ? x + p : x, py = vertical ? y : y + p;
      const ww = vertical ? pw : w, hh = vertical ? h : pw;
      c.fillStyle = vertical ? lin(c, px, 0, px + ww, 0, [[0, shade(tone, 0.06)], [1, shade(tone, -0.08)]])
        : lin(c, 0, py, 0, py + hh, [[0, shade(tone, 0.08)], [1, shade(tone, -0.1)]]);
      c.fillRect(px, py, ww, hh);
      /* grain lines following a gentle wave */
      const n = Math.max(3, Math.floor(pw / 4));
      for (let i = 0; i < n; ++i) {
        const off = (i + rnd() * 0.8) * pw / n;
        const amp = 1 + rnd() * 2.5, freq = 0.01 + rnd() * 0.02, ph = rnd() * 6;
        c.strokeStyle = rgba(shade(tone, rnd() < 0.7 ? -0.35 : 0.25), 0.18 + rnd() * 0.16);
        c.lineWidth = 0.6 + rnd() * 1.1;
        c.beginPath();
        const len = vertical ? h : w;
        for (let s = 0; s <= len; s += 12) {
          const d = off + Math.sin(s * freq + ph) * amp;
          if (vertical) { if (s === 0) c.moveTo(px + d, py + s); else c.lineTo(px + d, py + s); }
          else { if (s === 0) c.moveTo(px + s, py + d); else c.lineTo(px + s, py + d); }
        }
        c.stroke();
      }
      /* a knot now and then */
      if (rnd() < (o.knots !== undefined ? o.knots : 0.5)) {
        const kx = vertical ? px + pw * (0.3 + rnd() * 0.4) : px + rnd() * w;
        const ky = vertical ? py + rnd() * h : py + pw * (0.3 + rnd() * 0.4);
        for (let k = 3; k >= 1; --k) {
          c.strokeStyle = rgba(shade(tone, -0.45), 0.22);
          c.lineWidth = 1;
          c.beginPath();
          c.ellipse(kx, ky, (vertical ? 2 : 6) * k, (vertical ? 6 : 2) * k, 0, 0, TWO_PI);
          c.stroke();
        }
        ellipse(c, kx, ky, vertical ? 2 : 4, vertical ? 4 : 2, rgba(shade(tone, -0.5), 0.6));
      }
      /* the seam */
      c.fillStyle = rgba(shade(base, -0.6), 0.7);
      if (vertical) c.fillRect(px + pw - 1.5, py, 1.5, h);
      else c.fillRect(px, py + pw - 1.5, w, 1.5);
      c.fillStyle = rgba(shade(base, 0.4), 0.22);
      if (vertical) c.fillRect(px, py, 1, h);
      else c.fillRect(px, py, w, 1);
      /* staggered end joints */
      if (!vertical && o.joints !== false) {
        let jx = x + rnd() * 260;
        while (jx < x + w) {
          c.fillStyle = rgba(shade(base, -0.6), 0.6);
          c.fillRect(jx, py, 1.5, pw);
          jx += 200 + rnd() * 260;
        }
      }
    }
    c.restore();
    grainOver(c, x, y, w, h, 0.5);
  }

  /* bevelled tiles: grout, per-tile tone, top-left highlight, bottom shadow, glaze sheen */
  function tiles(c, x, y, w, h, base, grout, tw, th, rnd, o) {
    o = o || {};
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.fillStyle = grout;
    c.fillRect(x, y, w, h);
    const g = 2;
    let row = 0;
    for (let ty = y; ty < y + h; ty += th, ++row) {
      const off = o.offset ? (row % 2) * tw / 2 : 0;
      for (let tx = x - tw + off; tx < x + w; tx += tw) {
        const col = o.colors ? o.colors[(row + Math.round((tx - x) / tw)) % o.colors.length] : base;
        const tone = shade(col, (rnd() - 0.5) * (o.vary !== undefined ? o.vary : 0.08));
        const ix = tx + g, iy = ty + g, iw = tw - g * 2, ih = th - g * 2;
        c.fillStyle = lin(c, ix, iy, ix + iw * 0.4, iy + ih, [[0, shade(tone, 0.1)], [1, shade(tone, -0.06)]]);
        rr(c, ix, iy, iw, ih, o.round || 2);
        c.fill();
        c.fillStyle = rgba('#ffffff', o.glaze !== undefined ? o.glaze : 0.35);
        c.fillRect(ix + 2, iy + 1, iw - 4, 1.5);
        c.fillRect(ix + 1, iy + 2, 1.5, ih - 4);
        c.fillStyle = rgba('#000000', 0.12);
        c.fillRect(ix + 2, iy + ih - 2, iw - 3, 2);
        c.fillRect(ix + iw - 2, iy + 2, 2, ih - 3);
        if (o.glaze !== 0 && rnd() < 0.5) {
          c.fillStyle = rgba('#ffffff', 0.08 + rnd() * 0.1);
          c.beginPath();
          c.ellipse(ix + iw * (0.25 + rnd() * 0.5), iy + ih * 0.3, iw * 0.3, ih * 0.12, -0.3, 0, TWO_PI);
          c.fill();
        }
      }
    }
    c.restore();
    grainOver(c, x, y, w, h, 0.35);
  }

  /* running-bond brick: recessed mortar, per-brick gradient, speckles, chips */
  function bricks(c, x, y, w, h, base, mortar, rnd) {
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.fillStyle = mortar;
    c.fillRect(x, y, w, h);
    const bw = 62, bh = 22;
    for (let row = 0; y + row * bh < y + h; ++row) {
      const off = (row % 2) * bw / 2;
      for (let bx = x - bw; bx < x + w; bx += bw) {
        const px = bx + off + 2, py = y + row * bh + 2;
        const pw = bw - 4, ph = bh - 4;
        const tone = shade(base, (rnd() - 0.5) * 0.3);
        c.fillStyle = lin(c, 0, py, 0, py + ph, [[0, shade(tone, 0.1)], [1, shade(tone, -0.15)]]);
        rr(c, px, py, pw, ph, 2);
        c.fill();
        for (let s = 0; s < 6; ++s)
          dot(c, px + rnd() * pw, py + rnd() * ph, 0.6 + rnd() * 1.2, rgba(rnd() < 0.5 ? shade(tone, -0.4) : shade(tone, 0.3), 0.4));
        c.fillStyle = rgba('#ffffff', 0.12);
        c.fillRect(px + 2, py, pw - 4, 1.5);
        c.fillStyle = rgba('#000000', 0.25);
        c.fillRect(px + 1, py + ph - 1.5, pw - 2, 1.5);
        if (rnd() < 0.12) dot(c, px + (rnd() < 0.5 ? 3 : pw - 3), py + 3, 3, rgba(mortar, 0.9));
      }
    }
    c.restore();
    grainOver(c, x, y, w, h, 0.6);
  }

  /* marble: layered soft veins over a polished gradient */
  function marble(c, x, y, w, h, base, rnd, o) {
    o = o || {};
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    vgrad(c, x, y, w, h, [[0, shade(base, 0.12)], [0.6, base], [1, shade(base, -0.08)]]);
    for (let i = 0; i < 14; ++i)
      ellipse(c, x + rnd() * w, y + rnd() * h, 40 + rnd() * 120, 10 + rnd() * 30, rgba(rnd() < 0.5 ? '#ffffff' : shade(base, -0.15), 0.08));
    const veins = Math.floor(w * h / 14000) + 5;
    const col = o.vein || '#7a7468';
    for (let i = 0; i < veins; ++i) {
      const pts = [];
      let px = x + rnd() * w, py = y + rnd() * h;
      let ang = (rnd() - 0.5) * 1.2;
      pts.push([px, py]);
      for (let s = 0; s < 4; ++s) {
        const len = 60 + rnd() * 120;
        ang += (rnd() - 0.5) * 0.8;
        px += Math.cos(ang) * len;
        py += Math.sin(ang) * len * 0.5;
        pts.push([px, py]);
      }
      const passes = [[5 + rnd() * 4, 0.05], [2, 0.08], [0.7 + rnd() * 0.6, 0.22 + rnd() * 0.15]];
      for (let pass = 0; pass < passes.length; ++pass) {
        c.strokeStyle = rgba(col, passes[pass][1]);
        c.lineWidth = passes[pass][0];
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        for (let s = 1; s < pts.length; ++s) {
          const mx = (pts[s - 1][0] + pts[s][0]) / 2, my = (pts[s - 1][1] + pts[s][1]) / 2;
          c.quadraticCurveTo(pts[s - 1][0], pts[s - 1][1], mx, my);
        }
        c.stroke();
      }
      if (rnd() < 0.5) {
        const k = 1 + Math.floor(rnd() * 3);
        c.strokeStyle = rgba(col, 0.14);
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(pts[k][0], pts[k][1]);
        c.quadraticCurveTo(pts[k][0] + 20, pts[k][1] + 18 * (rnd() - 0.5), pts[k][0] + 50 + rnd() * 40, pts[k][1] + 40 * (rnd() - 0.5));
        c.stroke();
      }
    }
    if (o.gold) {
      for (let i = 0; i < 4; ++i) {
        c.strokeStyle = rgba('#d4af37', 0.25);
        c.lineWidth = 1;
        c.beginPath();
        const vx = x + rnd() * w, vy = y + rnd() * h;
        c.moveTo(vx, vy);
        c.bezierCurveTo(vx + 60, vy + (rnd() - 0.5) * 40, vx + 120, vy + (rnd() - 0.5) * 50, vx + 200, vy + (rnd() - 0.5) * 60);
        c.stroke();
      }
    }
    c.restore();
    grainOver(c, x, y, w, h, 0.25);
  }

  /* brushed steel: fine horizontal streaks and soft reflection bands */
  function steel(c, x, y, w, h, base, rnd, o) {
    o = o || {};
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    vgrad(c, x, y, w, h, [[0, shade(base, 0.22)], [0.45, base], [1, shade(base, -0.22)]]);
    for (let i = 0; i < h * 1.4; ++i) {
      const ly = y + rnd() * h;
      c.fillStyle = rgba(rnd() < 0.5 ? '#ffffff' : '#000000', 0.03 + rnd() * 0.05);
      c.fillRect(x + rnd() * w * 0.3 - 40, ly, w * (0.5 + rnd()), 1);
    }
    const bands = o.bands !== undefined ? o.bands : 3;
    for (let i = 0; i < bands; ++i) {
      const bx = x + rnd() * w;
      const bwid = 60 + rnd() * 140;
      c.fillStyle = lin(c, bx - bwid, 0, bx + bwid, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,' + (0.1 + rnd() * 0.12) + ')'], [1, 'rgba(255,255,255,0)']]);
      c.save();
      c.transform(1, 0, -0.6, 1, (y + h / 2) * 0.6, 0);
      c.fillRect(bx - bwid, y, bwid * 2, h);
      c.restore();
    }
    c.restore();
  }

  function rivets(c, x0, x1, y, step, r) {
    for (let x = x0; x <= x1; x += step) {
      dot(c, x + 0.6, y + 0.8, r, 'rgba(0,0,0,0.35)');
      c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, '#ffffff'], [0.5, '#a8b0b8'], [1, '#5a626a']]);
      c.beginPath();
      c.arc(x, y, r, 0, TWO_PI);
      c.fill();
    }
  }

  /* a horizontal trim bar: chrome / brass / gold / wood */
  function trim(c, x, y, w, h, kind) {
    const pal = {
      chrome: ['#ffffff', '#c8d0d8', '#7a848e', '#3a424a'],
      brass: ['#fff2b8', '#e2b450', '#a8741c', '#5a3a0a'],
      gold: ['#fff6c8', '#e8c450', '#b08a20', '#5a4210'],
      wood: ['#b88050', '#8a5a30', '#5a3618', '#2a1808'],
      red: ['#ff9a90', '#e04848', '#a02424', '#501010']
    }[kind] || ['#ffffff', '#c8d0d8', '#7a848e', '#3a424a'];
    vgrad(c, x, y, w, h, [[0, pal[0]], [0.3, pal[1]], [0.75, pal[2]], [1, pal[3]]]);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x, y + h, w, 1.5);
  }

  /* drop shadow under an object resting on a surface */
  function contactShadow(c, x, y, rx, ry, a) {
    c.save();
    c.translate(x, y);
    c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(10,4,0,' + a + ')');
    g.addColorStop(1, 'rgba(10,4,0,0)');
    c.fillStyle = g;
    c.fillRect(-rx, -rx, rx * 2, rx * 2);
    c.restore();
  }

  function vignette(c, x0, y0, w, h, a) {
    const g = c.createRadialGradient(W / 2, H * 0.46, H * 0.42, W / 2, H * 0.5, H * 0.98);
    g.addColorStop(0, 'rgba(12,6,2,0)');
    g.addColorStop(1, 'rgba(12,6,2,' + a + ')');
    c.fillStyle = g;
    c.fillRect(x0, y0, w, h);
  }

  /* ── props ── */

  function bottle(c, x, baseY, hgt, color, label) {
    const bw = 11, neck = hgt * 0.36;
    contactShadow(c, x + 2, baseY, 9, 3, 0.35);
    c.fillStyle = lin(c, x - bw / 2, 0, x + bw / 2, 0, [[0, shade(color, 0.25)], [0.35, color], [1, shade(color, -0.45)]]);
    rr(c, x - bw / 2, baseY - hgt + neck, bw, hgt - neck, 3.5);
    c.fill();
    c.beginPath();
    c.moveTo(x - bw / 2 + 1, baseY - hgt + neck + 2);
    c.quadraticCurveTo(x - 2.5, baseY - hgt + neck, x - 2.5, baseY - hgt + 4);
    c.lineTo(x + 2.5, baseY - hgt + 4);
    c.quadraticCurveTo(x + 2.5, baseY - hgt + neck, x + bw / 2 - 1, baseY - hgt + neck + 2);
    c.closePath();
    c.fill();
    c.fillStyle = shade(color, -0.4);
    c.fillRect(x - 3, baseY - hgt, 6, 5);
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillRect(x - bw / 2 + 2, baseY - hgt + neck + 3, 1.6, hgt - neck - 8);
    if (label !== false) {
      c.fillStyle = label || 'rgba(242,230,200,0.9)';
      c.fillRect(x - bw / 2 + 1, baseY - hgt * 0.5, bw - 2, hgt * 0.22);
      c.fillStyle = 'rgba(120,60,20,0.5)';
      c.fillRect(x - 3, baseY - hgt * 0.45, 6, 1.2);
    }
  }

  function jar(c, x, baseY, w, h, fill, lid) {
    contactShadow(c, x + 2, baseY, w * 0.7, 4, 0.35);
    c.fillStyle = lin(c, x - w / 2, 0, x + w / 2, 0, [[0, shade(fill, 0.15)], [0.4, fill], [1, shade(fill, -0.4)]]);
    rr(c, x - w / 2, baseY - h, w, h, 5);
    c.fill();
    c.fillStyle = rgba('#ffffff', 0.35);
    c.fillRect(x - w / 2 + 3, baseY - h + 5, 3, h - 10);
    c.fillStyle = lin(c, 0, baseY - h - 6, 0, baseY - h + 2, [[0, shade(lid, 0.3)], [1, shade(lid, -0.3)]]);
    rr(c, x - w / 2 - 1, baseY - h - 6, w + 2, 8, 2);
    c.fill();
    c.fillStyle = 'rgba(250,240,215,0.85)';
    c.fillRect(x - w * 0.3, baseY - h * 0.6, w * 0.6, h * 0.3);
  }

  function copperPot(c, x, y, r) {
    c.strokeStyle = '#3a2a1a';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y - r - 16);
    c.lineTo(x, y - r - 2);
    c.stroke();
    c.fillStyle = lin(c, x - r, 0, x + r, 0, [[0, '#ffc89a'], [0.3, '#d8784a'], [0.7, '#a04a24'], [1, '#5a2410']]);
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI);
    c.lineTo(x - r, y - r * 0.2);
    c.lineTo(x + r, y - r * 0.2);
    c.closePath();
    c.fill();
    ellipse(c, x, y - r * 0.2, r, r * 0.22, '#7a3418');
    c.fillStyle = '#a04a24';
    c.fillRect(x - 3, y - r * 0.2 - r - 4, 6, r + 2);
    c.fillStyle = 'rgba(255,240,210,0.55)';
    c.fillRect(x - r * 0.6, y - r * 0.05, r * 0.18, r * 0.6);
  }

  function hangingTool(c, x, y, kind) {
    c.strokeStyle = '#3a3a40';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, y + 4, 3, Math.PI, TWO_PI);
    c.stroke();
    const metal = lin(c, x - 6, 0, x + 6, 0, [[0, '#f2f4f6'], [0.5, '#a8b0b8'], [1, '#5a626a']]);
    c.fillStyle = '#4a3020';
    c.fillRect(x - 2, y + 6, 4, 26);
    c.fillStyle = metal;
    if (kind === 'spat') {
      rr(c, x - 8, y + 30, 16, 22, 3);
      c.fill();
    } else if (kind === 'ladle') {
      c.fillRect(x - 1.5, y + 30, 3, 14);
      c.beginPath();
      c.arc(x, y + 48, 8, 0, Math.PI);
      c.fill();
    } else if (kind === 'whisk') {
      for (let i = -2; i <= 2; ++i) {
        c.strokeStyle = '#c8d0d8';
        c.lineWidth = 1.2;
        c.beginPath();
        c.ellipse(x, y + 42, 2 + Math.abs(i) * 2.5, 14, 0, 0, TWO_PI);
        c.stroke();
      }
    } else {
      c.beginPath();
      c.moveTo(x - 2, y + 30);
      c.lineTo(x + 3, y + 30);
      c.lineTo(x + 3, y + 58);
      c.lineTo(x - 4, y + 50);
      c.closePath();
      c.fill();
    }
  }

  function plant(c, x, baseY, s, rnd, potColor) {
    contactShadow(c, x, baseY, 30 * s, 6, 0.35);
    c.fillStyle = lin(c, x - 18 * s, 0, x + 18 * s, 0, [[0, shade(potColor, 0.2)], [0.5, potColor], [1, shade(potColor, -0.45)]]);
    c.beginPath();
    c.moveTo(x - 18 * s, baseY - 30 * s);
    c.lineTo(x + 18 * s, baseY - 30 * s);
    c.lineTo(x + 13 * s, baseY);
    c.lineTo(x - 13 * s, baseY);
    c.closePath();
    c.fill();
    c.fillStyle = shade(potColor, 0.3);
    c.fillRect(x - 20 * s, baseY - 34 * s, 40 * s, 6 * s);
    for (let i = 0; i < 13; ++i) {
      const a = -Math.PI * (0.06 + 0.88 * i / 12);
      const len = (40 + rnd() * 22) * s;
      const ox = x, oy = baseY - 34 * s;
      const tx = ox + Math.cos(a) * len, ty = oy + Math.sin(a) * len * 0.95;
      c.strokeStyle = shade('#3f7a3a', (rnd() - 0.5) * 0.4);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(ox, oy);
      c.quadraticCurveTo(ox + Math.cos(a) * len * 0.5, oy + Math.sin(a) * len * 0.5 - 12 * s, tx, ty);
      c.stroke();
      c.fillStyle = shade(i % 2 ? '#4f8a3a' : '#67a44a', (rnd() - 0.5) * 0.3);
      c.beginPath();
      c.ellipse((ox + tx) / 2 + Math.cos(a) * 8, (oy + ty) / 2 - 6 * s, 12 * s, 4.5 * s, a, 0, TWO_PI);
      c.fill();
      c.beginPath();
      c.ellipse(tx, ty, 9 * s, 3.5 * s, a, 0, TWO_PI);
      c.fill();
    }
  }

  /* pendant lamp: cord, metal shade with rim light, glowing bulb */
  function pendant(c, x, top, len, shadeColor) {
    c.strokeStyle = '#1e1810';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, top);
    c.lineTo(x, top + len);
    c.stroke();
    const y = top + len;
    c.fillStyle = lin(c, x - 30, 0, x + 30, 0, [[0, shade(shadeColor, -0.45)], [0.3, shade(shadeColor, 0.25)], [0.6, shadeColor], [1, shade(shadeColor, -0.55)]]);
    c.beginPath();
    c.moveTo(x - 7, y);
    c.lineTo(x + 7, y);
    c.quadraticCurveTo(x + 18, y + 10, x + 30, y + 30);
    c.lineTo(x - 30, y + 30);
    c.quadraticCurveTo(x - 18, y + 10, x - 7, y);
    c.closePath();
    c.fill();
    ellipse(c, x, y + 30, 30, 5, '#fff2c8');
    glow(c, x, y + 34, 70, '#ffd27a', 0.55);
    dot(c, x, y + 33, 6, '#fffbe8');
  }

  function stringLights(c, x0, x1, y, sag, step) {
    c.strokeStyle = '#2a2420';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let x = x0; x <= x1; x += 10) {
      const k = ((x - x0) % (step * 4)) / (step * 4);
      const yy = y + Math.sin(k * Math.PI) * sag;
      if (x === x0) c.moveTo(x, yy); else c.lineTo(x, yy);
    }
    c.stroke();
    const pts = [];
    for (let x = x0 + step / 2; x < x1; x += step) {
      const k = ((x - x0) % (step * 4)) / (step * 4);
      const yy = y + Math.sin(k * Math.PI) * sag + 6;
      glow(c, x, yy, 16, '#ffd76a', 0.5);
      c.fillStyle = '#3a3028';
      c.fillRect(x - 2, yy - 6, 4, 3);
      ellipse(c, x, yy, 3.4, 4.4, '#fff2b0');
      pts.push([x, yy]);
    }
    return pts;
  }

  /* chalk text on a board, slightly rough */
  function chalkText(c, text, x, y, px, color, align) {
    c.font = 'bold ' + px + 'px "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive, sans-serif';
    c.textAlign = align || 'left';
    c.textBaseline = 'middle';
    c.fillStyle = rgba(color, 0.35);
    c.fillText(text, x + 0.8, y + 0.8);
    c.fillStyle = rgba(color, 0.9);
    c.fillText(text, x, y);
  }

  function chalkboard(c, x, y, w, h, rnd, title, lines) {
    contactShadow(c, x + w / 2, y + h + 4, w * 0.55, 10, 0.4);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    rr(c, x + 3, y + 5, w, h, 6);
    c.fill();
    c.fillStyle = lin(c, x, y, x, y + h, [[0, '#9a6a3a'], [1, '#5a3618']]);
    rr(c, x, y, w, h, 6);
    c.fill();
    planks(c, x, y, w, 9, '#8a5a30', rnd, { plank: 9, knots: 0, joints: false });
    c.fillStyle = lin(c, x, y, x, y + h, [[0, '#33433b'], [1, '#1c2722']]);
    rr(c, x + 9, y + 9, w - 18, h - 18, 3);
    c.fill();
    for (let i = 0; i < 10; ++i)
      ellipse(c, x + 9 + rnd() * (w - 18), y + 9 + rnd() * (h - 18), 18 + rnd() * 40, 5 + rnd() * 9, 'rgba(255,255,255,0.035)');
    chalkText(c, title, x + w / 2, y + 30, 22, '#f2ecd8', 'center');
    c.strokeStyle = 'rgba(242,236,216,0.6)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x + w / 2 - 44, y + 44);
    c.quadraticCurveTo(x + w / 2, y + 48, x + w / 2 + 44, y + 43);
    c.stroke();
    for (let i = 0; i < lines.length; ++i) {
      const ly = y + 66 + i * 22;
      if (ly > y + h - 16) break;
      chalkText(c, lines[i][0], x + 22, ly, 14, '#e8e2d0');
      chalkText(c, lines[i][1], x + w - 22, ly, 14, '#ffd76a', 'right');
    }
    c.fillStyle = '#7a5a3a';
    c.fillRect(x + 14, y + h - 9, w - 28, 5);
    c.fillStyle = '#f2ecd8';
    c.fillRect(x + 30, y + h - 12, 14, 3);
  }

  function windowGlass(c, x, y, w, h) {
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; ++i) {
      const bx = x + w * (0.12 + i * 0.32);
      c.fillStyle = 'rgba(255,255,255,' + (0.05 + (i % 2) * 0.03) + ')';
      c.beginPath();
      c.moveTo(bx, y);
      c.lineTo(bx + 40 + i * 12, y);
      c.lineTo(bx - 60 + i * 12, y + h);
      c.lineTo(bx - 100, y + h);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     SHARED ZONES: the serving counter, kitchen wall, worktop and front
     ══════════════════════════════════════════════════════════════════ */

  /* the serving counter, painted into both the room and the front layer */
  function paintCounter(c, rnd, m) {
    /* top surface */
    if (m.top === 'steel') steel(c, 0, CTR_T, W, CTR_LIP - CTR_T, '#c4ccd2', rnd, { bands: 4 });
    else if (m.top === 'marble') marble(c, 0, CTR_T, W, CTR_LIP - CTR_T, '#f4efe4', rnd, { gold: true });
    else if (m.top === 'formica') {
      vgrad(c, 0, CTR_T, W, CTR_LIP - CTR_T, [[0, '#e85a64'], [1, '#c8343e']]);
      for (let i = 0; i < 900; ++i) dot(c, rnd() * W, CTR_T + rnd() * (CTR_LIP - CTR_T), 0.6 + rnd() * 1.3, rgba(rnd() < 0.5 ? '#ffffff' : '#7a1a20', 0.25));
      grainOver(c, 0, CTR_T, W, CTR_LIP - CTR_T, 0.4);
    } else if (m.top === 'zinc') steel(c, 0, CTR_T, W, CTR_LIP - CTR_T, '#a8aca8', rnd, { bands: 3 });
    else planks(c, 0, CTR_T, W, CTR_LIP - CTR_T, m.wood || '#d8b078', rnd, { plank: CTR_LIP - CTR_T, knots: 0.1, joints: false });
    /* light falls on the top from above: brighter at the back, a sheen line */
    vgrad(c, 0, CTR_T, W, CTR_LIP - CTR_T, [[0, 'rgba(0,0,0,0.28)'], [0.18, 'rgba(0,0,0,0)'], [0.7, 'rgba(255,255,255,0.05)'], [1, 'rgba(255,255,255,0.14)']]);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(0, CTR_T, W, 2);
    c.fillStyle = 'rgba(255,255,255,0.28)';
    c.fillRect(0, CTR_T + 2, W, 1);
    /* lip and face */
    trim(c, 0, CTR_LIP, W, CTR_FACE - CTR_LIP, m.lip || 'chrome');
    if (m.face === 'steel') steel(c, 0, CTR_FACE, W, CTR_B - CTR_FACE, '#8a949c', rnd, { bands: 2 });
    else if (m.face === 'ribbed') {
      vgrad(c, 0, CTR_FACE, W, CTR_B - CTR_FACE, [[0, '#d8dee2'], [1, '#8a949c']]);
      for (let x = 0; x < W; x += 9) {
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(x, CTR_FACE, 2, CTR_B - CTR_FACE);
        c.fillStyle = 'rgba(255,255,255,0.45)';
        c.fillRect(x + 2, CTR_FACE, 2, CTR_B - CTR_FACE);
      }
    } else if (m.face === 'gold') {
      planks(c, 0, CTR_FACE, W, CTR_B - CTR_FACE, '#4a2418', rnd, { vertical: true, plank: 80, knots: 0 });
      c.fillStyle = '#d4af37';
      c.fillRect(0, CTR_FACE + 6, W, 2);
    } else planks(c, 0, CTR_FACE, W, CTR_B - CTR_FACE, m.faceWood || '#5a3418', rnd, { vertical: true, plank: 64, knots: 0.2 });
    vgrad(c, 0, CTR_FACE, W, CTR_B - CTR_FACE, [[0, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,0.35)']]);
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(0, CTR_B - 2, W, 2);
  }

  /* kitchen wall material between the counter and the worktop */
  function paintSplash(c, rnd, m) {
    const y = KIT_T, h = WORK_T - KIT_T;
    if (m.splash === 'steel') {
      steel(c, 0, y, W, h, '#b8c0c6', rnd, { bands: 5 });
      for (let x = 0; x < W; x += 256) {
        c.fillStyle = 'rgba(40,48,56,0.5)';
        c.fillRect(x, y, 2, h);
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.fillRect(x + 2, y, 1, h);
        rivets(c, x + 10, x + 10, y + 20, 1, 2);
      }
      for (let x = 10; x < W; x += 256) for (let ry = y + 20; ry < y + h; ry += 40) rivets(c, x, x, ry, 1, 2);
    } else if (m.splash === 'subway') tiles(c, 0, y, W, h, m.tile || '#f2f0ea', m.grout || '#bcb6aa', 64, 30, rnd, { offset: true });
    else if (m.splash === 'cream') tiles(c, 0, y, W, h, '#efe4cc', '#b8a888', 60, 28, rnd, { offset: true, vary: 0.1 });
    else if (m.splash === 'slate') tiles(c, 0, y, W, h, '#4a5058', '#2a2e34', 54, 54, rnd, { vary: 0.16, glaze: 0.12 });
    else marble(c, 0, y, W, h, '#ebe5d8', rnd, { gold: true });
    if (m.band) {
      c.fillStyle = m.band;
      for (let x = 0; x < W; x += 32) {
        c.fillStyle = shade(m.band, (rnd() - 0.5) * 0.12);
        c.fillRect(x + 1, y + 120, 30, 14);
      }
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillRect(0, y + 120, W, 1.5);
    }
    /* the counter above throws a soft shadow down the wall */
    shadowBand(c, 0, KIT_T, W, 40, 0.5);
  }

  /* the worktop the stations stand on and the counter front under it */
  function paintWorktop(c, rnd, m) {
    /* surface */
    if (m.work === 'steel') steel(c, 0, WORK_T, W, WORK_EDGE - WORK_T, '#ccd3d8', rnd, { bands: 5 });
    else if (m.work === 'butcher') planks(c, 0, WORK_T, W, WORK_EDGE - WORK_T, '#c89058', rnd, { plank: 9, knots: 0.1 });
    else if (m.work === 'marble') marble(c, 0, WORK_T, W, WORK_EDGE - WORK_T, '#f0ebe0', rnd, { gold: true });
    else planks(c, 0, WORK_T, W, WORK_EDGE - WORK_T, '#dcb682', rnd, { plank: 12, knots: 0.1 });
    vgrad(c, 0, WORK_T, W, WORK_EDGE - WORK_T, [[0, 'rgba(0,0,0,0.38)'], [0.3, 'rgba(0,0,0,0.05)'], [1, 'rgba(255,255,255,0.12)']]);
    trim(c, 0, WORK_EDGE, W, FRONT_K - WORK_EDGE, m.edge || 'chrome');
    /* the front: cabinet doors */
    const fy = FRONT_K, fh = H - FRONT_K;
    if (m.front === 'steel') steel(c, 0, fy, W, fh, '#9aa4ac', rnd, { bands: 4 });
    else if (m.front === 'red') {
      vgrad(c, 0, fy, W, fh, [[0, '#c8343e'], [1, '#7a1a22']]);
      grainOver(c, 0, fy, W, fh, 0.5);
    } else planks(c, 0, fy, W, fh, m.frontWood || '#5a3418', rnd, { vertical: true, plank: 40, knots: 0.3 });
    for (let x = -20; x < W; x += 160) {
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 2;
      c.strokeRect(x + 8, fy + 8, 144, fh - 4);
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.lineWidth = 1;
      c.strokeRect(x + 10, fy + 10, 140, fh - 8);
    }
    shadowBand(c, 0, fy, W, 26, 0.55);
    vgrad(c, 0, fy, W, fh, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]);
    /* one recessed instrument plate per station: bar, key and label sit on it */
    for (let i = 0; i < 5; ++i) {
      const px = ST_X0 + i * ST_STEP - 8, pw = ST_W + 16;
      c.fillStyle = 'rgba(0,0,0,0.45)';
      rr(c, px + 2, PLATE_T + 3, pw, PLATE_B - PLATE_T, 9);
      c.fill();
      c.fillStyle = lin(c, 0, PLATE_T, 0, PLATE_B, [[0, m.plateRim || '#e2b450'], [1, shade(m.plateRim || '#e2b450', -0.5)]]);
      rr(c, px, PLATE_T, pw, PLATE_B - PLATE_T, 9);
      c.fill();
      c.fillStyle = lin(c, 0, PLATE_T + 3, 0, PLATE_B - 3, [[0, '#120a06'], [1, '#2a1a10']]);
      rr(c, px + 3, PLATE_T + 3, pw - 6, PLATE_B - PLATE_T - 6, 7);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.06)';
      rr(c, px + 5, PLATE_T + 4, pw - 10, 10, 5);
      c.fill();
      for (let s = 0; s < 2; ++s) dot(c, px + 9 + s * (pw - 18), PLATE_T + (PLATE_B - PLATE_T) / 2, 2.2, '#c8a050');
    }
  }

  /* an extractor hood over the grill and stove, utensils on hooks in the gaps */
  function paintKitchenDecor(c, rnd, m) {
    const hood = m.hood || '#b8c0c6';
    const hx0 = 22, hx1 = 456, hy0 = 452, hy1 = 514;
    contactShadow(c, (hx0 + hx1) / 2, hy1 + 10, (hx1 - hx0) * 0.55, 12, 0.35);
    /* the duct up into the ceiling */
    c.fillStyle = lin(c, 340, 0, 420, 0, [[0, shade(hood, -0.3)], [0.35, shade(hood, 0.3)], [1, shade(hood, -0.45)]]);
    c.fillRect(340, KIT_T, 80, hy0 - KIT_T + 2);
    for (let y = KIT_T + 12; y < hy0; y += 14) {
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(340, y, 80, 2);
    }
    c.beginPath();
    c.moveTo(hx0 + 70, hy0);
    c.lineTo(hx1 - 70, hy0);
    c.lineTo(hx1, hy1);
    c.lineTo(hx0, hy1);
    c.closePath();
    c.fillStyle = lin(c, 0, hy0, 0, hy1, [[0, shade(hood, 0.25)], [0.6, hood], [1, shade(hood, -0.3)]]);
    c.fill();
    c.strokeStyle = rgba(shade(hood, -0.6), 0.8);
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = lin(c, hx0 + 50, 0, hx1 - 50, 0, [[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,255,255,0.35)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]);
    c.beginPath();
    c.moveTo(hx0 + 90, hy0 + 2);
    c.lineTo(hx0 + 200, hy0 + 2);
    c.lineTo(hx0 + 170, hy1 - 2);
    c.lineTo(hx0 + 40, hy1 - 2);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(hx0 + 2, hy1 - 6, hx1 - hx0 - 4, 6);
    trim(c, hx0 - 4, hy1, hx1 - hx0 + 8, 8, m.hoodTrim || 'chrome');
    for (let i = 0; i < 8; ++i) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      rr(c, hx0 + 76 + i * 38, hy0 + 26, 24, 4, 2);
      c.fill();
    }
    /* warm work lights under the hood */
    for (let i = 0; i < 2; ++i) {
      const lx = 115 + i * 245;
      ellipse(c, lx, hy1 + 9, 12, 3, '#fff6d8');
      lightPool(c, lx, hy1 + 70, 120, 90, '#ffe8b0', 0.22);
    }
    const tools = ['ladle', 'spat', 'whisk', 'skew'];
    const gaps = [482, 727, 972];
    for (let g = 0; g < gaps.length; ++g) {
      trim(c, gaps[g] - 36, 474, 72, 5, m.hoodTrim || 'chrome');
      for (let k = 0; k < 3; ++k) hangingTool(c, gaps[g] - 22 + k * 22, 478, tools[(g + k) % 4]);
    }
  }

  /* the ticket rail's backing and a shelf of props along the top of the wall */
  function paintShelf(c, rnd, m) {
    const sy = 434;
    contactShadow(c, W / 2, sy + 14, W * 0.6, 8, 0.25);
    trim(c, 0, sy, W, 8, m.shelf || 'wood');
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(0, sy + 8, W, 4);
    if (m.props) m.props(c, rnd, sy);
  }

  /* lighting pass: AO under the counter, light pools, warm tint, vignette */
  function lightRoom(c, x0, y0, w, h, m) {
    c.save();
    c.beginPath();
    c.rect(x0, y0, w, h);
    c.clip();
    const lights = m.lights || [];
    for (let i = 0; i < lights.length; ++i) {
      const L = lights[i];
      lightPool(c, L[0], L[1], L[2], L[3], L[4], L[5]);
    }
    if (m.tint) {
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = m.tint;
      c.fillRect(x0, y0, w, h);
      c.globalCompositeOperation = 'source-over';
    }
    vignette(c, x0, y0, w, h, m.vignette !== undefined ? m.vignette : 0.55);
    c.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     THE FIVE ROOMS: back wall and per-theme materials
     ══════════════════════════════════════════════════════════════════ */

  /* the truck: the serving hatch opens onto a sunny street */
  function building(c, x, baseY, w, h, col, rnd, o) {
    o = o || {};
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, shade(col, 0.08)], [1, shade(col, -0.12)]]);
    c.fillRect(x, baseY - h, w, h);
    c.fillStyle = shade(col, -0.3);
    c.fillRect(x - 3, baseY - h - 6, w + 6, 8);
    c.fillStyle = shade(col, 0.25);
    c.fillRect(x - 3, baseY - h - 6, w + 6, 2);
    const ww = o.ww || 14, wh = o.wh || 20, gx = o.gx || 26, gy = o.gy || 34;
    for (let wy = baseY - h + 14; wy < baseY - (o.shop ? 52 : 18); wy += gy) {
      for (let wx = x + 10; wx < x + w - ww - 6; wx += gx) {
        c.fillStyle = shade(col, -0.35);
        c.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        c.fillStyle = lin(c, 0, wy, 0, wy + wh, [[0, o.glass || '#9ec8e8'], [1, shade(o.glass || '#9ec8e8', -0.35)]]);
        c.fillRect(wx, wy, ww, wh);
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(wx + 2, wy + 2, 3, wh - 4);
        c.fillStyle = shade(col, 0.2);
        c.fillRect(wx - 3, wy + wh + 2, ww + 6, 3);
      }
    }
    if (o.shop) {
      c.fillStyle = shade(o.shop, -0.2);
      c.fillRect(x + 6, baseY - 50, w - 12, 50);
      c.fillStyle = lin(c, 0, baseY - 44, 0, baseY, [[0, '#ffe6b0'], [1, '#c89a5a']]);
      c.fillRect(x + 14, baseY - 40, w - 28, 40);
      for (let s = 0; s < (w - 12) / 16; ++s) {
        c.fillStyle = s % 2 ? '#fff6ea' : o.shop;
        c.beginPath();
        c.moveTo(x + 6 + s * 16, baseY - 58);
        c.lineTo(x + 22 + s * 16, baseY - 58);
        c.lineTo(x + 22 + s * 16, baseY - 46);
        c.quadraticCurveTo(x + 14 + s * 16, baseY - 40, x + 6 + s * 16, baseY - 46);
        c.closePath();
        c.fill();
      }
    }
  }

  function tree(c, x, baseY, s, rnd) {
    c.fillStyle = '#5a4630';
    c.fillRect(x - 4 * s, baseY - 60 * s, 8 * s, 60 * s);
    const blobs = [[0, -78, 30], [-22, -66, 22], [22, -64, 24], [-8, -96, 20], [14, -90, 18]];
    for (let i = 0; i < blobs.length; ++i) {
      const b = blobs[i];
      c.fillStyle = lin(c, x + b[0] * s - b[2] * s, baseY + b[1] * s - b[2] * s, x + b[0] * s + b[2] * s, baseY + b[1] * s + b[2] * s, [[0, '#8ad06a'], [0.5, '#4f9a3a'], [1, '#2a6a2a']]);
      c.beginPath();
      c.arc(x + b[0] * s, baseY + b[1] * s, b[2] * s, 0, TWO_PI);
      c.fill();
    }
    for (let i = 0; i < 18; ++i) dot(c, x + (rnd() - 0.5) * 60 * s, baseY - (60 + rnd() * 50) * s, 2.5 * s, rgba('#c8f0a0', 0.35));
  }

  function car(c, x, y, col, flip) {
    c.save();
    c.translate(x, y);
    if (flip) c.scale(-1, 1);
    contactShadow(c, 0, 18, 64, 7, 0.4);
    c.fillStyle = lin(c, 0, -26, 0, 14, [[0, shade(col, 0.35)], [0.5, col], [1, shade(col, -0.4)]]);
    c.beginPath();
    c.moveTo(-60, 10);
    c.lineTo(-60, -4);
    c.quadraticCurveTo(-58, -12, -44, -14);
    c.lineTo(-28, -16);
    c.quadraticCurveTo(-18, -34, 4, -34);
    c.lineTo(20, -34);
    c.quadraticCurveTo(34, -33, 42, -16);
    c.quadraticCurveTo(58, -14, 60, -4);
    c.lineTo(60, 10);
    c.closePath();
    c.fill();
    c.fillStyle = lin(c, 0, -32, 0, -16, [[0, '#d8ecf8'], [1, '#6a90b0']]);
    c.beginPath();
    c.moveTo(-22, -16);
    c.quadraticCurveTo(-14, -30, 2, -30);
    c.lineTo(4, -16);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(8, -16);
    c.lineTo(8, -30);
    c.lineTo(20, -30);
    c.quadraticCurveTo(30, -29, 37, -16);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(-50, -10, 96, 2);
    dot(c, 56, -4, 3, '#fff6c8');
    dot(c, -57, -4, 2.6, '#ff5a4a');
    for (let s = -1; s <= 1; s += 2) {
      dot(c, s * 36, 10, 10, '#1a1c20');
      dot(c, s * 36, 10, 5, '#8a9098');
      dot(c, s * 36 - 1.5, 8.5, 1.8, '#d8dee4');
    }
    c.restore();
  }

  function paintTruckBack(c, rnd) {
    /* street seen through the open hatch: sky, far skyline, shops, sidewalk */
    vgrad(c, 0, 0, W, CTR_T, [[0, '#5aa8e8'], [0.45, '#a8d4f2'], [0.75, '#f2e8d4'], [1, '#e8d8bc']]);
    glow(c, 1020, 40, 220, '#fff6d0', 0.55);
    for (let i = 0; i < 6; ++i) {
      const cx = 120 + i * 220 + rnd() * 60, cy = 36 + rnd() * 40;
      for (let b = 0; b < 5; ++b) ellipse(c, cx + (b - 2) * 22, cy + Math.abs(b - 2) * 4, 28 - Math.abs(b - 2) * 4, 14 - Math.abs(b - 2) * 2, 'rgba(255,255,255,0.75)');
      ellipse(c, cx, cy + 10, 60, 8, 'rgba(200,220,240,0.6)');
    }
    for (let x = 0; x < W; x += 50 + rnd() * 30) {
      const h = 70 + rnd() * 90;
      c.fillStyle = rgba('#8aa8c8', 0.55);
      c.fillRect(x, 190 - h, 46, h);
      c.fillStyle = rgba('#dce8f4', 0.35);
      for (let wy = 196 - h; wy < 180; wy += 12) for (let wx = x + 5; wx < x + 40; wx += 9) c.fillRect(wx, wy, 4, 6);
    }
    const cols = ['#c8604a', '#e8d4b0', '#6aa8a0', '#d89a4a', '#b8c8d8', '#a85a6a'];
    let bx = -30;
    let k = 0;
    while (bx < W) {
      const bw = 150 + rnd() * 90, bh = 120 + rnd() * 70;
      building(c, bx, 236, bw, bh, cols[k % cols.length], rnd, { shop: ['#e85a4a', '#3a8ad8', '#4ab86a', '#e8a03a'][k % 4] });
      bx += bw + 6;
      ++k;
    }
    for (let x = 90; x < W; x += 330) tree(c, x + rnd() * 60, 240, 1, rnd);
    /* road and sidewalk where the guests line up */
    vgrad(c, 0, 236, W, 22, [[0, '#6a6e74'], [1, '#4e5258']]);
    for (let x = 20; x < W; x += 90) {
      c.fillStyle = 'rgba(255,240,200,0.7)';
      c.fillRect(x, 246, 40, 3);
    }
    trim(c, 0, 256, W, 6, 'chrome');
    tiles(c, 0, 262, W, CTR_T - 262, '#d8d0c4', '#a89e90', 56, 28, rnd, { offset: true, glaze: 0.08, vary: 0.1 });
    vgrad(c, 0, 262, W, CTR_T - 262, [[0, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,0.25)']]);
    car(c, 360, 238, '#d84a3a', false);
    car(c, 980, 238, '#3a7ad8', true);
    /* the truck around the hatch: roof, awning underside, walls */
    steel(c, 0, 0, W, 22, '#e8ecef', rnd, { bands: 4 });
    rivets(c, 16, W, 12, 32, 2);
    trim(c, 0, 22, W, 6, 'chrome');
    /* awning seen from below */
    for (let s = 0; s < W / 64; ++s) {
      c.fillStyle = s % 2 ? '#fff4e4' : '#ff8a2a';
      c.beginPath();
      c.moveTo(s * 64, 28);
      c.lineTo(s * 64 + 64, 28);
      c.lineTo(s * 64 + 64, 52);
      c.quadraticCurveTo(s * 64 + 32, 66, s * 64, 52);
      c.closePath();
      c.fill();
    }
    vgrad(c, 0, 28, W, 38, [[0, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]);
    for (let side = 0; side < 2; ++side) {
      const x = side === 0 ? 0 : W - 34;
      steel(c, x, 22, 34, CTR_T - 22, '#d4dade', rnd, { bands: 1 });
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(side === 0 ? 33 : W - 34, 22, 2, CTR_T - 22);
      rivets(c, x + 17, x + 17, 40, 1, 2);
      for (let ry = 40; ry < CTR_T; ry += 34) rivets(c, x + 17, x + 17, ry, 1, 2);
    }
    /* menu board hanging in the hatch */
    c.strokeStyle = '#3a3a3a';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(70, 52);
    c.lineTo(80, 74);
    c.moveTo(240, 52);
    c.lineTo(230, 74);
    c.stroke();
    chalkboard(c, 56, 72, 200, 150, rnd, 'MENU', [['Burger', '14'], ['Salad', '12'], ['Tacos', '18']]);
    return stringLights(c, 40, W - 40, 58, 10, 64);
  }

  function paintDinerBack(c, rnd) {
    /* mint upper wall with a chrome strip, white wainscot tiles */
    vgrad(c, 0, 0, W, WAIN_T, [[0, '#9fd8c8'], [1, '#c4ecdf']]);
    grainOver(c, 0, 0, W, WAIN_T, 0.5);
    for (let x = 0; x < W; x += 6) {
      c.fillStyle = 'rgba(255,255,255,' + (x % 12 ? 0.03 : 0.05) + ')';
      c.fillRect(x, 0, 3, WAIN_T);
    }
    /* windows with venetian blinds onto a night street */
    const wins = [[230, 330], [720, 330]];
    for (let i = 0; i < wins.length; ++i) {
      const wx = wins[i][0], ww = wins[i][1], wy = 40, wh = 150;
      c.fillStyle = 'rgba(0,0,0,0.3)';
      rr(c, wx - 8, wy - 6, ww + 18, wh + 16, 8);
      c.fill();
      trim(c, wx - 10, wy - 10, ww + 20, wh + 20, 'chrome');
      vgrad(c, wx, wy, ww, wh, [[0, '#1a2a4a'], [0.7, '#3a3a6a'], [1, '#6a4a6a']]);
      for (let b = 0; b < 5; ++b) {
        const bh = 40 + rnd() * 60;
        c.fillStyle = '#141a2a';
        c.fillRect(wx + b * 70 + rnd() * 20, wy + wh - bh, 50, bh);
        for (let wy2 = wy + wh - bh + 6; wy2 < wy + wh - 6; wy2 += 10)
          for (let wx2 = wx + b * 70 + 6; wx2 < wx + b * 70 + 44; wx2 += 9)
            if (rnd() < 0.4) { c.fillStyle = rgba('#ffd27a', 0.5 + rnd() * 0.4); c.fillRect(wx2, wy2, 4, 5); }
      }
      glow(c, wx + ww * 0.7, wy + wh - 20, 60, '#ff4a8a', 0.4);
      for (let s = wy + 4; s < wy + wh; s += 9) {
        c.fillStyle = lin(c, 0, s, 0, s + 5, [[0, 'rgba(250,250,245,0.92)'], [1, 'rgba(190,190,180,0.92)']]);
        c.fillRect(wx, s, ww, s < wy + 62 ? 5 : 1.5);
      }
      windowGlass(c, wx, wy, ww, wh);
      c.fillStyle = '#d8dee2';
      c.fillRect(wx + ww / 2 - 1, wy, 2, wh);
    }
    /* neon sign housing; the tube itself lives in the ambient */
    c.fillStyle = 'rgba(0,0,0,0.35)';
    rr(c, 584, 66, 130, 92, 10);
    c.fill();
    c.fillStyle = lin(c, 0, 60, 0, 150, [[0, '#2a2f36'], [1, '#14181e']]);
    rr(c, 580, 60, 130, 92, 10);
    c.fill();
    c.strokeStyle = '#c8cdd2';
    c.lineWidth = 3;
    rr(c, 580, 60, 130, 92, 10);
    c.stroke();
    /* jukebox on the left */
    contactShadow(c, 120, WAIN_T + 2, 80, 10, 0.45);
    c.fillStyle = lin(c, 50, 0, 190, 0, [[0, '#5a1a14'], [0.4, '#a83a24'], [1, '#4a140e']]);
    rr(c, 50, 70, 140, 166, 60);
    c.fill();
    c.fillStyle = lin(c, 0, 80, 0, 140, [[0, '#ffe6a0'], [1, '#e8a03a']]);
    rr(c, 64, 84, 112, 64, 50);
    c.fill();
    c.fillStyle = '#3a6a8a';
    rr(c, 76, 150, 88, 36, 6);
    c.fill();
    for (let i = 0; i < 4; ++i) {
      c.fillStyle = ['#ffd23f', '#ff6b6b', '#6bd24a', '#4ac8ff'][i];
      c.fillRect(82, 156 + i * 7, 76, 3);
    }
    c.fillStyle = '#20181a';
    rr(c, 78, 192, 84, 36, 6);
    c.fill();
    for (let i = 0; i < 6; ++i) {
      c.strokeStyle = 'rgba(200,205,210,0.45)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(120, 210, 3 + i * 2.6, 0, TWO_PI);
      c.stroke();
    }
    trim(c, 50, 228, 140, 8, 'chrome');
    /* clock */
    dot(c, 1150, 80, 30, 'rgba(0,0,0,0.25)');
    dot(c, 1148, 78, 30, '#c8cdd2');
    dot(c, 1148, 78, 25, '#fbf8ee');
    for (let i = 0; i < 12; ++i) {
      const a = i / 12 * TWO_PI;
      dot(c, 1148 + Math.cos(a) * 20, 78 + Math.sin(a) * 20, 1.6, '#3a352e');
    }
    /* chrome strip and booth backs behind the guests */
    trim(c, 0, WAIN_T - 10, W, 10, 'chrome');
    for (let x = 0; x < W; x += 160) {
      c.fillStyle = lin(c, 0, WAIN_T, 0, CTR_T, [[0, '#e8505a'], [0.5, '#c42c38'], [1, '#7a141e']]);
      rr(c, x + 4, WAIN_T + 2, 152, CTR_T - WAIN_T + 10, 22);
      c.fill();
      for (let t = 0; t < 3; ++t) {
        const tx = x + 30 + t * 50;
        dot(c, tx, WAIN_T + 34, 3, 'rgba(80,0,10,0.6)');
        c.strokeStyle = 'rgba(80,0,10,0.35)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(tx, WAIN_T + 10);
        c.lineTo(tx, WAIN_T + 70);
        c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,0.25)';
      rr(c, x + 14, WAIN_T + 6, 132, 8, 4);
      c.fill();
    }
    return null;
  }

  function paintBistroBack(c, rnd) {
    bricks(c, 0, 0, W, WAIN_T, '#9a4a32', '#d4c4ae', rnd);
    vgrad(c, 0, 0, W, WAIN_T, [[0, 'rgba(20,8,0,0.35)'], [0.5, 'rgba(20,8,0,0)'], [1, 'rgba(20,8,0,0.2)']]);
    chalkboard(c, 46, 34, 270, 182, rnd, 'Le Menu', [['Salade', '12'], ['Pâtes', '22'], ['Steak frites', '34'], ['Crêpes', '16']]);
    /* the window onto a Paris street at dusk */
    const wx = 388, wy = 18, ww = 624, wh = 200;
    c.fillStyle = 'rgba(0,0,0,0.4)';
    rr(c, wx - 6, wy + 4, ww + 20, wh + 18, 10);
    c.fill();
    c.fillStyle = lin(c, 0, wy - 12, 0, wy + wh + 12, [[0, '#4a6a4a'], [1, '#22382a']]);
    rr(c, wx - 12, wy - 10, ww + 24, wh + 22, 10);
    c.fill();
    c.save();
    c.beginPath();
    c.rect(wx, wy, ww, wh);
    c.clip();
    vgrad(c, wx, wy, ww, wh, [[0, '#6a5a9a'], [0.35, '#e89a7a'], [0.7, '#f8c88a'], [1, '#e8a06a']]);
    glow(c, 900, 120, 120, '#fff0b0', 0.8);
    dot(c, 900, 120, 22, '#fff6d8');
    const facade = function(fx, fw, fh, col) {
      c.fillStyle = lin(c, fx, 0, fx + fw, 0, [[0, shade(col, 0.05)], [1, shade(col, -0.18)]]);
      c.fillRect(fx, 186 - fh, fw, fh);
      c.fillStyle = '#4a4a5a';
      c.beginPath();
      c.moveTo(fx - 4, 186 - fh);
      c.lineTo(fx + fw + 4, 186 - fh);
      c.lineTo(fx + fw - 6, 186 - fh - 22);
      c.lineTo(fx + 6, 186 - fh - 22);
      c.closePath();
      c.fill();
      for (let wy2 = 196 - fh; wy2 < 172; wy2 += 30) {
        for (let wx2 = fx + 12; wx2 < fx + fw - 18; wx2 += 30) {
          c.fillStyle = rnd() < 0.5 ? '#ffd890' : '#3a4a5a';
          c.fillRect(wx2, wy2, 14, 20);
          c.fillStyle = '#2a2a30';
          c.fillRect(wx2 - 3, wy2 + 20, 20, 3);
        }
      }
    };
    facade(wx - 10, 170, 150, '#e8dcc4');
    facade(wx + 470, 170, 160, '#ead8b8');
    c.fillStyle = rgba('#4a3a4a', 0.8);
    c.beginPath();
    c.moveTo(670, 186);
    c.quadraticCurveTo(684, 120, 690, 50);
    c.lineTo(698, 50);
    c.quadraticCurveTo(704, 120, 718, 186);
    c.lineTo(706, 186);
    c.quadraticCurveTo(700, 150, 694, 140);
    c.quadraticCurveTo(688, 150, 682, 186);
    c.closePath();
    c.fill();
    c.fillRect(676, 128, 36, 5);
    c.fillRect(682, 92, 24, 4);
    c.fillRect(691, 34, 6, 18);
    vgrad(c, wx, 186, ww, 32, [[0, '#8a7a6a'], [1, '#5a4a40']]);
    for (let lx = 470; lx < 1000; lx += 190) {
      c.strokeStyle = '#2a2520';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(lx, 190);
      c.lineTo(lx, 132);
      c.quadraticCurveTo(lx + 8, 124, lx + 16, 126);
      c.stroke();
      glow(c, lx + 17, 130, 30, '#ffd76a', 0.7);
      dot(c, lx + 17, 130, 4, '#fff6d8');
    }
    for (let tx = 540; tx < 1000; tx += 240) tree(c, tx, 190, 0.8, rnd);
    windowGlass(c, wx, wy, ww, wh);
    c.restore();
    c.fillStyle = '#22382a';
    c.fillRect(wx + ww / 2 - 3, wy, 6, wh);
    c.fillRect(wx, wy + wh * 0.45, ww, 5);
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.fillRect(wx + ww / 2 - 3, wy, 1.5, wh);
    /* striped awning inside the top of the window */
    for (let s = 0; s < ww / 40; ++s) {
      c.fillStyle = s % 2 ? '#f4ecd8' : '#b8302a';
      c.beginPath();
      c.moveTo(wx + s * 40, wy);
      c.lineTo(wx + s * 40 + 40, wy);
      c.lineTo(wx + s * 40 + 40, wy + 14);
      c.quadraticCurveTo(wx + s * 40 + 20, wy + 22, wx + s * 40, wy + 14);
      c.closePath();
      c.fill();
    }
    /* wine shelves on the right */
    for (let s = 0; s < 3; ++s) {
      const sy = 74 + s * 66;
      trim(c, 1040, sy, 230, 9, 'wood');
      contactShadow(c, 1155, sy + 12, 110, 5, 0.3);
      if (s < 2) for (let i = 0; i < 7; ++i)
        bottle(c, 1062 + i * 30, sy, 42 + (i % 3) * 6, ['#2a4a2a', '#5a1a24', '#1a2a4a', '#5a4a1a', '#3a5a3a'][(i + s * 2) % 5]);
      else for (let i = 0; i < 4; ++i) {
        const gx = 1066 + i * 50;
        c.strokeStyle = 'rgba(220,230,236,0.8)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(gx, sy);
        c.lineTo(gx, sy - 16);
        c.moveTo(gx - 9, sy - 30);
        c.quadraticCurveTo(gx, sy - 12, gx + 9, sy - 30);
        c.stroke();
      }
    }
    /* dark wood wainscot behind the guests */
    planks(c, 0, WAIN_T, W, CTR_T - WAIN_T, '#5a3420', rnd, { vertical: true, plank: 80, knots: 0.3 });
    trim(c, 0, WAIN_T - 8, W, 8, 'wood');
    for (let x = 0; x < W; x += 80) {
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 2;
      c.strokeRect(x + 10, WAIN_T + 12, 60, CTR_T - WAIN_T - 4);
      c.strokeStyle = 'rgba(255,220,180,0.1)';
      c.strokeRect(x + 12, WAIN_T + 14, 56, CTR_T - WAIN_T - 8);
    }
    pendant(c, 320, 0, 62, '#2a5a4a');
    pendant(c, 640, 0, 50, '#2a5a4a');
    pendant(c, 960, 0, 62, '#2a5a4a');
    return null;
  }

  function lantern(c, lx, ly, color) {
    c.strokeStyle = '#2a241e';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(lx, 0);
    c.lineTo(lx, ly - 36);
    c.stroke();
    glow(c, lx, ly, 70, '#ff9a4a', 0.55);
    c.fillStyle = '#2a1a0e';
    rr(c, lx - 12, ly - 42, 24, 8, 2);
    c.fill();
    rr(c, lx - 12, ly + 32, 24, 8, 2);
    c.fill();
    const g = c.createRadialGradient(lx - 6, ly - 6, 2, lx, ly, 36);
    g.addColorStop(0, '#ffd890');
    g.addColorStop(0.35, shade(color, 0.2));
    g.addColorStop(1, shade(color, -0.35));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(lx, ly, 28, 36, 0, 0, TWO_PI);
    c.fill();
    c.strokeStyle = 'rgba(80,16,10,0.55)';
    c.lineWidth = 1.2;
    for (let rb = -3; rb <= 3; ++rb) {
      c.beginPath();
      c.ellipse(lx, ly, 28 - Math.abs(rb) * 4, 36, 0, -Math.PI / 2, Math.PI / 2);
      c.stroke();
    }
    for (let k = -2; k <= 2; ++k) {
      c.beginPath();
      c.ellipse(lx, ly + k * 12, 28 * Math.cos(k * 0.35), 3, 0, 0, Math.PI);
      c.stroke();
    }
    c.fillStyle = 'rgba(30,10,4,0.7)';
    c.font = 'bold 18px serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('寿', lx, ly + 1);
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(lx, ly + 40);
    c.lineTo(lx, ly + 54);
    c.stroke();
  }

  function paintSushiBack(c, rnd) {
    /* hinoki slat wall */
    planks(c, 0, 0, W, WAIN_T, '#d4ac78', rnd, { vertical: true, plank: 38, knots: 0.15 });
    /* the shoji window onto a sakura garden */
    const wx = 150, wy = 26, ww = 980, wh = 180;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    rr(c, wx - 8, wy, ww + 22, wh + 20, 6);
    c.fill();
    c.fillStyle = lin(c, 0, wy - 12, 0, wy + wh + 12, [[0, '#5a3a1e'], [1, '#2e1c0e']]);
    rr(c, wx - 12, wy - 12, ww + 24, wh + 24, 6);
    c.fill();
    c.save();
    c.beginPath();
    c.rect(wx, wy, ww, wh);
    c.clip();
    vgrad(c, wx, wy, ww, wh, [[0, '#cfe4f4'], [0.6, '#f8ecee'], [1, '#f0e4dc']]);
    c.fillStyle = 'rgba(160,180,210,0.6)';
    c.beginPath();
    c.moveTo(wx, 150);
    c.lineTo(wx + 200, 90);
    c.lineTo(wx + 330, 130);
    c.lineTo(wx + 520, 70);
    c.lineTo(wx + 720, 140);
    c.lineTo(wx + ww, 110);
    c.lineTo(wx + ww, wy + wh);
    c.lineTo(wx, wy + wh);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath();
    c.moveTo(wx + 490, 80);
    c.lineTo(wx + 520, 70);
    c.lineTo(wx + 550, 81);
    c.lineTo(wx + 530, 86);
    c.lineTo(wx + 515, 80);
    c.closePath();
    c.fill();
    vgrad(c, wx, 160, ww, 50, [[0, '#a8c890'], [1, '#6a9a5a']]);
    /* torii */
    c.fillStyle = '#c8402e';
    c.fillRect(580, 118, 130, 7);
    c.fillStyle = '#2a1a14';
    c.fillRect(572, 112, 146, 6);
    c.fillStyle = '#c8402e';
    c.fillRect(592, 126, 8, 52);
    c.fillRect(690, 126, 8, 52);
    c.fillRect(588, 136, 114, 5);
    const blossom = function(bx, by, r) {
      c.fillStyle = '#5a3a2a';
      c.beginPath();
      c.moveTo(bx - 4, by + r * 2.2);
      c.quadraticCurveTo(bx - 2, by + r, bx - 10, by);
      c.lineTo(bx + 2, by + r * 0.4);
      c.lineTo(bx + 5, by + r * 2.2);
      c.closePath();
      c.fill();
      const pinks = ['#f7c8d8', '#f0a8c0', '#fbdce6', '#e890ac'];
      for (let i = 0; i < 26; ++i) {
        const a = rnd() * TWO_PI, d = rnd() * r;
        const px = bx + Math.cos(a) * d * 1.3, py = by + Math.sin(a) * d * 0.8;
        c.fillStyle = pinks[(rnd() * 4) | 0];
        c.beginPath();
        c.arc(px, py, r * (0.25 + rnd() * 0.25), 0, TWO_PI);
        c.fill();
      }
    };
    blossom(280, 100, 40);
    blossom(920, 92, 44);
    blossom(1060, 120, 30);
    for (let i = 0; i < 40; ++i) dot(c, wx + rnd() * ww, wy + rnd() * wh, 1.5 + rnd() * 2, rgba('#f7c8d8', 0.8));
    c.restore();
    /* shoji grid over the garden */
    c.fillStyle = '#3a2410';
    for (let gx = wx; gx <= wx + ww; gx += ww / 6) c.fillRect(gx - 2, wy, 4, wh);
    c.fillRect(wx, wy + 60, ww, 3);
    for (let gx = wx; gx < wx + ww; gx += ww / 12) c.fillRect(gx - 1, wy, 2, 60);
    windowGlass(c, wx, wy, ww, wh);
    /* hanging scroll on the right edge */
    c.fillStyle = '#efe6d0';
    c.fillRect(1176, 30, 70, 180);
    c.fillStyle = '#2a4a6a';
    c.fillRect(1172, 26, 78, 8);
    c.fillRect(1172, 206, 78, 8);
    c.fillStyle = '#2a1a10';
    c.font = 'bold 34px serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('鮨', 1211, 90);
    c.fillText('桜', 1211, 140);
    /* dark wainscot with bamboo below */
    planks(c, 0, WAIN_T, W, CTR_T - WAIN_T, '#4a2e18', rnd, { plank: 20, knots: 0.1 });
    for (let x = 0; x < W; x += 22) {
      c.fillStyle = lin(c, x, 0, x + 16, 0, [[0, '#a8b86a'], [0.5, '#7a9a4a'], [1, '#4a6a2a']]);
      c.fillRect(x, WAIN_T, 16, 40);
      c.fillStyle = 'rgba(40,50,20,0.6)';
      c.fillRect(x, WAIN_T + 18, 16, 3);
    }
    trim(c, 0, WAIN_T - 6, W, 6, 'wood');
    trim(c, 0, WAIN_T + 40, W, 5, 'wood');
    return null;
  }

  function chandelier(c, cx, cy) {
    c.strokeStyle = '#8a7a4a';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx, 0);
    c.lineTo(cx, cy - 46);
    c.stroke();
    glow(c, cx, cy, 160, '#ffd890', 0.45);
    const gold = lin(c, cx - 70, 0, cx + 70, 0, [[0, '#8a6a1a'], [0.3, '#ffe9a0'], [0.6, '#d4af37'], [1, '#7a5a10']]);
    c.strokeStyle = gold;
    c.lineWidth = 5;
    c.beginPath();
    c.ellipse(cx, cy, 70, 16, 0, 0, TWO_PI);
    c.stroke();
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(cx, cy - 28, 38, 9, 0, 0, TWO_PI);
    c.stroke();
    dot(c, cx, cy - 46, 7, '#d4af37');
    for (let i = 0; i < 10; ++i) {
      const a = i / 10 * TWO_PI;
      const ax = cx + Math.cos(a) * 70, ay = cy + Math.sin(a) * 16;
      c.strokeStyle = '#c8a040';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 38, cy - 28 + Math.sin(a) * 9);
      c.lineTo(ax, ay);
      c.stroke();
      c.fillStyle = '#f4f0e4';
      c.fillRect(ax - 2.5, ay - 14, 5, 12);
      glow(c, ax, ay - 18, 14, '#ffd76a', 0.7);
      ellipse(c, ax, ay - 18, 2.5, 4, '#fff6d0');
      for (let d = 0; d < 3; ++d) {
        c.fillStyle = 'rgba(220,240,255,' + (0.8 - d * 0.15) + ')';
        c.beginPath();
        c.moveTo(ax, ay + 3 + d * 9);
        c.lineTo(ax - 3, ay + 7 + d * 9);
        c.lineTo(ax, ay + 12 + d * 9);
        c.lineTo(ax + 3, ay + 7 + d * 9);
        c.closePath();
        c.fill();
      }
    }
  }

  function paintHotelBack(c, rnd) {
    marble(c, 0, 0, W, WAIN_T, '#efe9dc', rnd, { gold: true });
    /* pilasters */
    for (let i = 0; i < 4; ++i) {
      const px = 40 + i * 400;
      hgrad(c, px, 0, 40, WAIN_T, [[0, '#d8d0bc'], [0.3, '#fbf6ea'], [1, '#bab09a']]);
      trim(c, px - 6, 0, 52, 10, 'gold');
      trim(c, px - 6, WAIN_T - 16, 52, 10, 'gold');
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(px + 40, 0, 6, WAIN_T);
    }
    /* three arched windows onto the night city */
    const winX = [150, 510, 870];
    for (let i = 0; i < 3; ++i) {
      const wx = winX[i], ww = 260;
      const path = function() {
        c.beginPath();
        c.moveTo(wx, 214);
        c.lineTo(wx, 94);
        c.arc(wx + ww / 2, 94, ww / 2, Math.PI, 0);
        c.lineTo(wx + ww, 214);
        c.closePath();
      };
      c.save();
      path();
      c.clip();
      vgrad(c, wx, 0, ww, 214, [[0, '#060a18'], [0.6, '#14203a'], [1, '#2a3050']]);
      for (let s = 0; s < 70; ++s) dot(c, wx + rnd() * ww, 10 + rnd() * 110, 0.6 + rnd() * 1.1, rgba('#ffffff', 0.3 + rnd() * 0.6));
      if (i === 1) {
        glow(c, wx + 190, 60, 50, '#f2ecd8', 0.4);
        dot(c, wx + 190, 60, 15, '#f8f2e0');
        dot(c, wx + 183, 56, 13, '#0c1428');
      }
      for (let b = 0; b < 6; ++b) {
        const bx = wx - 10 + b * 48 + rnd() * 10;
        const bw = 36 + rnd() * 16, bh = 50 + rnd() * 80;
        c.fillStyle = shade('#0a101e', rnd() * 0.15);
        c.fillRect(bx, 214 - bh, bw, bh);
        for (let wy = 220 - bh; wy < 206; wy += 10)
          for (let wxp = bx + 4; wxp < bx + bw - 6; wxp += 8)
            if (rnd() < 0.42) { c.fillStyle = rgba('#ffd76a', 0.3 + rnd() * 0.6); c.fillRect(wxp, wy, 4, 5); }
      }
      windowGlass(c, wx, 0, ww, 214);
      c.restore();
      c.strokeStyle = '#c8a040';
      c.lineWidth = 8;
      path();
      c.stroke();
      c.strokeStyle = '#fff0b0';
      c.lineWidth = 2;
      path();
      c.stroke();
      c.strokeStyle = 'rgba(212,175,55,0.7)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(wx + ww / 2, 214);
      c.lineTo(wx + ww / 2, 0);
      c.moveTo(wx, 136);
      c.lineTo(wx + ww, 136);
      c.stroke();
      /* velvet drapes */
      for (let s = 0; s < 2; ++s) {
        const dx = s === 0 ? wx - 18 : wx + ww - 10;
        c.fillStyle = lin(c, dx, 0, dx + 28, 0, [[0, '#4a0a14'], [0.4, '#a01e30'], [1, '#3a0610']]);
        c.beginPath();
        c.moveTo(dx, 20);
        c.lineTo(dx + 28, 20);
        c.quadraticCurveTo(dx + (s ? 4 : 24), 120, dx + 26, 214);
        c.lineTo(dx + 2, 214);
        c.quadraticCurveTo(dx + (s ? 24 : 4), 120, dx, 20);
        c.closePath();
        c.fill();
        trim(c, dx - 2, 120, 32, 5, 'gold');
      }
    }
    chandelier(c, 640, 110);
    for (let i = 0; i < 3; ++i) {
      const sx = 445 + i * 360;
      if (sx > 1200) continue;
      glow(c, sx, 100, 46, '#ffd27a', 0.55);
      c.fillStyle = '#c8a040';
      c.beginPath();
      c.moveTo(sx - 8, 124);
      c.lineTo(sx + 8, 124);
      c.lineTo(sx + 5, 106);
      c.lineTo(sx - 5, 106);
      c.closePath();
      c.fill();
      ellipse(c, sx, 98, 4, 7, '#fff6d0');
    }
    /* mahogany wainscot with gold trim */
    planks(c, 0, WAIN_T, W, CTR_T - WAIN_T, '#5a2418', rnd, { vertical: true, plank: 100, knots: 0 });
    trim(c, 0, WAIN_T - 6, W, 8, 'gold');
    for (let x = 0; x < W; x += 100) {
      c.strokeStyle = 'rgba(212,175,55,0.55)';
      c.lineWidth = 1.5;
      c.strokeRect(x + 12, WAIN_T + 14, 76, CTR_T - WAIN_T - 6);
    }
    plant(c, 70, WAIN_T + 40, 1, rnd, '#c8a040');
    plant(c, 1212, WAIN_T + 40, 1, rnd, '#c8a040');
    return null;
  }

  /* shelf props per theme, standing on the shelf at sy */
  function propsTruck(c, rnd, sy) {
    const cols = ['#d83a2a', '#f2c81a', '#d83a2a', '#3a8a3a'];
    for (let i = 0; i < 4; ++i) bottle(c, 120 + i * 26, sy, 30, cols[i], false);
    for (let i = 0; i < 3; ++i) jar(c, 1090 + i * 40, sy, 26, 26, ['#e8b04a', '#8ab84a', '#c8603a'][i], '#c8ccd2');
  }

  function propsDiner(c, rnd, sy) {
    for (let i = 0; i < 4; ++i) {
      c.fillStyle = lin(c, 0, sy - 30, 0, sy, [[0, '#ffffff'], [1, '#d8d4c8']]);
      rr(c, 110 + i * 34, sy - 30, 24, 30, 4);
      c.fill();
      c.fillStyle = '#d8465a';
      c.fillRect(110 + i * 34, sy - 20, 24, 4);
    }
    for (let i = 0; i < 3; ++i) bottle(c, 1100 + i * 30, sy, 34, ['#c8302a', '#e8c81a', '#c8302a'][i], false);
  }

  function propsBistro(c, rnd, sy) {
    for (let i = 0; i < 4; ++i) copperPot(c, 130 + i * 62, sy - 2, 13 + (i % 2) * 3);
    for (let i = 0; i < 3; ++i) jar(c, 1080 + i * 46, sy, 30, 34, ['#e8d48a', '#a8c86a', '#d8783a'][i], '#8a5a30');
  }

  function propsSushi(c, rnd, sy) {
    for (let i = 0; i < 4; ++i) bottle(c, 120 + i * 30, sy, 36, ['#e8eef0', '#2a3a2a', '#e8eef0', '#5a2a1a'][i]);
    for (let i = 0; i < 3; ++i) {
      ellipse(c, 1100 + i * 44, sy - 6, 18, 8, '#2a2420');
      ellipse(c, 1100 + i * 44, sy - 9, 16, 5, ['#f4f0e4', '#c84a3a', '#f4f0e4'][i]);
    }
  }

  function propsHotel(c, rnd, sy) {
    for (let i = 0; i < 3; ++i) {
      const dx = 140 + i * 70;
      c.fillStyle = lin(c, dx - 24, 0, dx + 24, 0, [[0, '#ffffff'], [0.5, '#c8ccd2'], [1, '#6a7078']]);
      c.beginPath();
      c.arc(dx, sy, 24, Math.PI, TWO_PI);
      c.fill();
      dot(c, dx, sy - 26, 4, '#d4af37');
    }
    for (let i = 0; i < 4; ++i) bottle(c, 1080 + i * 32, sy, 40, ['#e8d48a', '#2a4a2a', '#e8d48a', '#5a1a24'][i], '#d4af37');
  }

  /* theme materials and lights */
  const MATS = {
    truck: {
      back: paintTruckBack,
      counter: { top: 'steel', lip: 'chrome', face: 'steel' },
      splash: 'steel', hood: '#7e8890', work: 'steel', edge: 'chrome', front: 'steel', plateRim: '#c8d0d8', shelf: 'chrome', props: propsTruck,
      lights: [[640, 470, 520, 120, '#e8f4ff', 0.18], [640, 300, 700, 80, '#fff6e0', 0.12]],
      tint: null, vignette: 0.5
    },
    diner: {
      back: paintDinerBack,
      counter: { top: 'formica', lip: 'chrome', face: 'ribbed' },
      splash: 'subway', band: '#d8465a', hood: '#d8dee2', work: 'steel', edge: 'chrome', front: 'red', plateRim: '#d8dee2', shelf: 'chrome', props: propsDiner,
      lights: [[645, 120, 180, 120, '#ff5a8a', 0.18], [300, 330, 300, 60, '#fff0d0', 0.12], [980, 330, 300, 60, '#fff0d0', 0.12], [640, 520, 600, 110, '#fff8e8', 0.1]],
      tint: '#fff4ec', vignette: 0.55
    },
    bistro: {
      back: paintBistroBack,
      counter: { top: 'zinc', lip: 'brass', face: 'wood', faceWood: '#4a2814' },
      splash: 'cream', hood: '#c87a4a', hoodTrim: 'brass', work: 'butcher', edge: 'brass', front: 'wood', frontWood: '#4a2814', plateRim: '#e2b450', shelf: 'wood', props: propsBistro,
      lights: [[320, 150, 220, 160, '#ffc070', 0.32], [640, 140, 220, 160, '#ffc070', 0.32], [960, 150, 220, 160, '#ffc070', 0.32],
        [320, 345, 200, 40, '#ffd090', 0.2], [640, 345, 200, 40, '#ffd090', 0.2], [960, 345, 200, 40, '#ffd090', 0.2], [640, 520, 640, 120, '#ffd8a0', 0.12]],
      tint: '#fff0dc', vignette: 0.62
    },
    sushi: {
      back: paintSushiBack,
      counter: { top: 'wood', wood: '#e8c896', lip: 'wood', face: 'wood', faceWood: '#3a2414' },
      splash: 'slate', hood: '#4a3424', hoodTrim: 'wood', work: 'hinoki', edge: 'wood', front: 'wood', frontWood: '#3a2414', plateRim: '#a87a4a', shelf: 'wood', props: propsSushi,
      lights: [[300, 96, 140, 140, '#ff8a4a', 0.28], [640, 96, 140, 140, '#ff8a4a', 0.28], [980, 96, 140, 140, '#ff8a4a', 0.28],
        [640, 340, 640, 50, '#fff0d8', 0.14], [640, 520, 600, 120, '#ffe8c8', 0.1]],
      tint: '#fff4e8', vignette: 0.58
    },
    hotel: {
      back: paintHotelBack,
      counter: { top: 'marble', lip: 'gold', face: 'gold' },
      splash: 'marble', hood: '#d8d0bc', hoodTrim: 'gold', work: 'marble', edge: 'gold', front: 'wood', frontWood: '#4a1e14', plateRim: '#e8c450', shelf: 'gold', props: propsHotel,
      lights: [[640, 110, 300, 170, '#ffd890', 0.3], [445, 100, 100, 100, '#ffd27a', 0.2], [805, 100, 100, 100, '#ffd27a', 0.2],
        [640, 345, 600, 50, '#fff0d0', 0.16], [640, 520, 640, 120, '#fff0d8', 0.12]],
      tint: '#fff6e6', vignette: 0.6
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     AMBIENT LIFE: cached sprites and a handful of blits per frame
     ══════════════════════════════════════════════════════════════════ */

  function glowSprite(color, size, a) {
    const cv = makeCanvas(size, size);
    const c = cv.getContext('2d');
    glow(c, size / 2, size / 2, size / 2, color, a === undefined ? 1 : a);
    return cv;
  }

  /* steam wisps rising off the kitchen line, shared by every theme */
  function buildSteam(rnd) {
    const sprite = makeCanvas(80, 110);
    const sc = sprite.getContext('2d');
    const blobs = [[40, 78, 30], [30, 54, 20], [50, 38, 16], [40, 20, 12]];
    for (let i = 0; i < blobs.length; ++i) {
      const b = blobs[i];
      const g = sc.createRadialGradient(b[0], b[1], 1, b[0], b[1], b[2]);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      sc.fillStyle = g;
      sc.fillRect(b[0] - b[2], b[1] - b[2], b[2] * 2, b[2] * 2);
    }
    const wisps = [];
    for (let i = 0; i < 4; ++i)
      wisps.push({ x: 160 + i * 300 + rnd() * 80, speed: 0.1 + rnd() * 0.08, phase: rnd(), sway: 8 + rnd() * 8 });
    return {
      draw: function(c, t) {
        for (let i = 0; i < wisps.length; ++i) {
          const wp = wisps[i];
          const p = (t * wp.speed + wp.phase) % 1;
          c.globalAlpha = Math.sin(p * Math.PI) * 0.14;
          c.drawImage(sprite, wp.x + Math.sin(t * 0.9 + wp.phase * 6) * wp.sway - 40, 560 - p * 150 - 90);
        }
        c.globalAlpha = 1;
      }
    };
  }

  /* blinking string lights shared by the truck */
  function buildTwinkle(points, color) {
    const sp = glowSprite(color, 40, 0.9);
    return function(c, t) {
      if (!points) return;
      const op = c.globalCompositeOperation;
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < points.length; i += 2) {
        const p = points[i];
        c.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7));
        c.drawImage(sp, p[0] - 20, p[1] - 20);
      }
      c.globalCompositeOperation = op;
      c.globalAlpha = 1;
    };
  }

  /* a tiny walking person silhouette in four frames */
  function walkerFrames(body, legs, skin, hat) {
    const frames = [];
    for (let f = 0; f < 4; ++f) {
      const cv = makeCanvas(30, 66);
      const c = cv.getContext('2d');
      const sw = [5, 0, -5, 0][f];
      contactShadow(c, 15, 63, 12, 3, 0.35);
      c.strokeStyle = legs;
      c.lineWidth = 5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(15, 40);
      c.lineTo(15 + sw, 62);
      c.moveTo(15, 40);
      c.lineTo(15 - sw, 62);
      c.stroke();
      c.fillStyle = body;
      rr(c, 8, 18, 14, 25, 5);
      c.fill();
      c.strokeStyle = shade(body, -0.25);
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(10, 22);
      c.lineTo(10 - sw * 0.7, 38);
      c.moveTo(20, 22);
      c.lineTo(20 + sw * 0.7, 38);
      c.stroke();
      dot(c, 15, 11, 7, skin);
      c.fillStyle = hat;
      c.beginPath();
      c.arc(15, 9, 7, Math.PI, TWO_PI);
      c.fill();
      frames.push(cv);
    }
    return frames;
  }

  function carSprite(color, flip) {
    const cv = makeCanvas(132, 64);
    const c = cv.getContext('2d');
    car(c, 66, 40, color, flip);
    return cv;
  }

  function buildTruckAmbient(rnd, lights) {
    const cars = [
      { img: carSprite('#f2c81a', false), x0: 100, dir: 1, speed: 70, y: 202 },
      { img: carSprite('#4ab86a', true), x0: 900, dir: -1, speed: 55, y: 196 }
    ];
    const people = [
      { f: walkerFrames('#3a6ad8', '#2a2a3a', '#f0c8a0', '#5a3214'), x0: 300, dir: 1, speed: 26, y: 176 },
      { f: walkerFrames('#d84a7a', '#3a3a4a', '#c88a5a', '#1a1a1a'), x0: 1000, dir: -1, speed: 22, y: 180 },
      { f: walkerFrames('#e8a03a', '#4a3a2a', '#8a5a3a', '#2a2a2a'), x0: 640, dir: 1, speed: 30, y: 178 }
    ];
    const twinkle = buildTwinkle(lights, '#ffd76a');
    return {
      draw: function(c, t) {
        for (let i = 0; i < cars.length; ++i) {
          const cr = cars[i];
          const span = W + 260;
          const x = ((cr.x0 + cr.dir * cr.speed * t + 130) % span + span) % span - 130;
          c.drawImage(cr.img, x - 66, cr.y);
        }
        for (let i = 0; i < people.length; ++i) {
          const pp = people[i];
          const span = W + 60;
          const x = ((pp.x0 + pp.dir * pp.speed * t + 30) % span + span) % span - 30;
          const fr = pp.f[Math.floor(t * 6 + i) % 4];
          if (pp.dir < 0) {
            c.save();
            c.translate(x, 0);
            c.scale(-1, 1);
            c.drawImage(fr, -15, pp.y);
            c.restore();
          } else c.drawImage(fr, x - 15, pp.y);
        }
        twinkle(c, t);
      }
    };
  }

  function buildDinerAmbient(rnd) {
    function signSprite(bright) {
      const cv = makeCanvas(150, 110);
      const cc = cv.getContext('2d');
      cc.font = 'italic bold 40px "Brush Script MT", "Segoe Script", cursive, sans-serif';
      cc.textAlign = 'center';
      cc.textBaseline = 'middle';
      cc.lineJoin = 'round';
      if (bright) {
        glow(cc, 75, 55, 75, '#ff3a7a', 0.45);
        cc.strokeStyle = 'rgba(255,90,140,0.4)';
        cc.lineWidth = 12;
        cc.strokeText('Diner', 75, 50);
      }
      cc.strokeStyle = bright ? '#ff5a8a' : '#6a2a3a';
      cc.lineWidth = 5;
      cc.strokeText('Diner', 75, 50);
      cc.strokeStyle = bright ? '#fff0f4' : '#8a4a56';
      cc.lineWidth = 2;
      cc.strokeText('Diner', 75, 50);
      cc.strokeStyle = bright ? '#5ae8ff' : '#2a4a5a';
      cc.lineWidth = 3;
      cc.beginPath();
      cc.moveTo(22, 80);
      cc.lineTo(128, 80);
      cc.stroke();
      return cv;
    }
    const bright = signSprite(true);
    const dim = signSprite(false);
    const bulbs = [glowSprite('#ffd23f', 24), glowSprite('#ff6b6b', 24), glowSprite('#6bd24a', 24), glowSprite('#4ac8ff', 24)];
    return {
      draw: function(c, t) {
        const step = Math.floor(t * 2.2);
        const flick = Math.floor(t * 13) % 17 === 4;
        const on = (step % 9 !== 5) && !flick;
        c.drawImage(on ? bright : dim, 570, 51);
        const op = c.globalCompositeOperation;
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; ++i) {
          c.globalAlpha = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * 4 + i * 1.6));
          c.drawImage(bulbs[(i + Math.floor(t * 2)) % 4], 108 - 12 + (i % 2) * 24, 96 + Math.floor(i / 2) * 22 - 12);
        }
        c.globalCompositeOperation = op;
        c.globalAlpha = 1;
        /* the clock's second hand */
        const a = Math.floor(t) / 60 * TWO_PI - Math.PI / 2;
        c.strokeStyle = '#c8302a';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(1148, 78);
        c.lineTo(1148 + Math.cos(a) * 20, 78 + Math.sin(a) * 20);
        c.moveTo(1148, 78);
        c.lineTo(1148 + Math.cos(t / 3600 * TWO_PI) * 13, 78 + Math.sin(t / 3600 * TWO_PI) * 13);
        c.stroke();
      }
    };
  }

  function buildBistroAmbient(rnd) {
    const halo = glowSprite('#ffc070', 160, 0.6);
    const lamps = [[320, 96, 0], [640, 84, 2.1], [960, 96, 4.2]];
    const walkers = [
      { f: walkerFrames('#3a3a4a', '#1a1a22', '#f0c8a0', '#2a2a2a'), x0: 420, dir: 1, speed: 18 },
      { f: walkerFrames('#a8304a', '#2a2a30', '#d8a07a', '#4a2a1a'), x0: 900, dir: -1, speed: 15 }
    ];
    return {
      draw: function(c, t) {
        c.save();
        c.beginPath();
        c.rect(388, 18, 624, 200);
        c.clip();
        for (let i = 0; i < walkers.length; ++i) {
          const w = walkers[i];
          const span = 680;
          const x = 360 + ((w.x0 - 360 + w.dir * w.speed * t) % span + span) % span;
          const fr = w.f[Math.floor(t * 5 + i) % 4];
          c.drawImage(fr, x - 12, 160, 24, 52);
        }
        c.restore();
        const op = c.globalCompositeOperation;
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < lamps.length; ++i) {
          const lp = lamps[i];
          c.globalAlpha = Math.max(0.1, 0.28 + 0.1 * Math.sin(t * 2.6 + lp[2]) + 0.05 * Math.sin(t * 7.1 + lp[2] * 3));
          c.drawImage(halo, lp[0] - 80, lp[1] - 80);
        }
        c.globalCompositeOperation = op;
        c.globalAlpha = 1;
      }
    };
  }

  function buildSushiAmbient(rnd) {
    const petals = [];
    const sprites = ['#f7c8d8', '#f0a8c0', '#fbdce6'].map(function(col) {
      const cv = makeCanvas(14, 10);
      const c = cv.getContext('2d');
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(1, 5);
      c.quadraticCurveTo(7, -2, 13, 4);
      c.quadraticCurveTo(7, 11, 1, 5);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillRect(4, 3, 4, 1.5);
      return cv;
    });
    for (let i = 0; i < 18; ++i)
      petals.push({ x: rnd() * (W + 40) - 20, y: rnd() * 360, vx: 14 + rnd() * 18, vy: 10 + rnd() * 12, ph: rnd() * 6, s: sprites[i % 3] });
    const halo = glowSprite('#ff9a4a', 140, 0.5);
    return {
      draw: function(c, t) {
        const op = c.globalCompositeOperation;
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; ++i) {
          c.globalAlpha = 0.35 + 0.12 * Math.sin(t * 1.7 + i * 2);
          c.drawImage(halo, 300 + i * 340 - 70 + Math.sin(t * 0.8 + i) * 3, 96 - 70);
        }
        c.globalCompositeOperation = op;
        c.globalAlpha = 0.9;
        for (let i = 0; i < petals.length; ++i) {
          const p = petals[i];
          const x = ((p.x + p.vx * t + Math.sin(t * 1.3 + p.ph) * 14 + 20) % (W + 40) + W + 40) % (W + 40) - 20;
          const y = ((p.y + p.vy * t + 20) % 380) - 20;
          c.drawImage(p.s, x, y, 14, 10 * Math.abs(Math.cos(t * 2 + p.ph)) + 3);
        }
        c.globalAlpha = 1;
      }
    };
  }

  function buildHotelAmbient(rnd) {
    const glint = makeCanvas(30, 30);
    const gc = glint.getContext('2d');
    glow(gc, 15, 15, 15, '#fffbe8', 0.6);
    gc.fillStyle = 'rgba(255,255,255,0.95)';
    gc.beginPath();
    gc.moveTo(15, 1);
    gc.lineTo(16.5, 13.5);
    gc.lineTo(29, 15);
    gc.lineTo(16.5, 16.5);
    gc.lineTo(15, 29);
    gc.lineTo(13.5, 16.5);
    gc.lineTo(1, 15);
    gc.lineTo(13.5, 13.5);
    gc.closePath();
    gc.fill();
    const spots = [];
    for (let i = 0; i < 10; ++i) {
      const a = i / 10 * TWO_PI;
      spots.push({ x: 640 + Math.cos(a) * 70, y: 126 + Math.sin(a) * 16, ph: rnd() * 6 });
    }
    const city = glowSprite('#ffd76a', 12, 1);
    const lights = [];
    for (let i = 0; i < 9; ++i) lights.push({ x: [150, 510, 870][i % 3] + 20 + rnd() * 220, y: 150 + rnd() * 56, ph: rnd() * 6 });
    const star = glowSprite('#ffffff', 22, 1);
    return {
      draw: function(c, t) {
        const op = c.globalCompositeOperation;
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < spots.length; ++i) {
          const sp = spots[i];
          const tw = Math.max(0, Math.sin(t * 1.4 + sp.ph));
          c.globalAlpha = 0.08 + Math.pow(tw, 6) * 0.9;
          c.drawImage(glint, sp.x - 15, sp.y - 15);
        }
        for (let i = 0; i < lights.length; ++i) {
          const L = lights[i];
          c.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(t * 0.7 + L.ph));
          c.drawImage(city, L.x - 6, L.y - 6);
        }
        /* a shooting star crossing the middle window now and then */
        const p = (t % 11) / 1.2;
        if (p < 1) {
          c.globalAlpha = Math.sin(p * Math.PI);
          for (let k = 0; k < 3; ++k) c.drawImage(star, 600 + p * 120 - k * 9 - 11, 40 + p * 40 - k * 3 - 11, 22 - k * 6, 22 - k * 6);
        }
        c.globalCompositeOperation = op;
        c.globalAlpha = 1;
      }
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     BUILD ONE INTERIOR (cached per theme)
     ══════════════════════════════════════════════════════════════════ */

  const built = {};

  function bake(name) {
    const theme = THEMES[name];
    const m = MATS[name];
    const rnd = mulberry32(THEME_NAMES.indexOf(name) * 7919 + 17);

    const bg = makeCanvas(W, H);
    const bc = bg.getContext('2d');
    const lights = m.back(bc, rnd, theme);
    paintSplash(bc, rnd, m);
    paintShelf(bc, rnd, m);
    paintKitchenDecor(bc, rnd, m);
    paintWorktop(bc, rnd, m);

    /* the serving counter: its own layer so guests sit behind it */
    const front = makeCanvas(W, CTR_B - FRONT_T);
    const fc = front.getContext('2d');
    fc.translate(0, -FRONT_T);
    /* the counter casts a contact shadow onto the wall behind */
    paintCounter(fc, mulberry32(THEME_NAMES.indexOf(name) * 131 + 5), m.counter);
    fc.save();
    fc.beginPath();
    fc.rect(0, FRONT_T, W, CTR_T - FRONT_T);
    fc.clip();
    fc.clearRect(0, FRONT_T, W, CTR_T - FRONT_T);
    shadowBand(fc, 0, CTR_T, W, -(CTR_T - FRONT_T), 0.28);
    fc.restore();

    bc.drawImage(front, 0, FRONT_T);
    lightRoom(bc, 0, 0, W, H, m);
    lightRoom(fc, 0, FRONT_T, W, CTR_B - FRONT_T, m);
    /* the shadow strip above the counter is soft in the room already */
    fc.clearRect(0, FRONT_T, W, CTR_T - FRONT_T);
    fc.save();
    fc.beginPath();
    fc.rect(0, FRONT_T, W, CTR_T - FRONT_T);
    fc.clip();
    shadowBand(fc, 0, CTR_T, W, -(CTR_T - FRONT_T), 0.3);
    fc.restore();

    /* a soft, dark, low-res copy of the room fills letterbox bands */
    const half = makeCanvas(320, 180);
    half.getContext('2d').drawImage(bg, 0, 0, 320, 180);
    const blur = makeCanvas(96, 54);
    const blc = blur.getContext('2d');
    blc.drawImage(half, 0, 0, 96, 54);
    blc.fillStyle = 'rgba(14,7,3,0.6)';
    blc.fillRect(0, 0, 96, 54);

    const steam = buildSteam(rnd);
    let ambient;
    if (name === 'truck') ambient = buildTruckAmbient(rnd, lights);
    else if (name === 'diner') ambient = buildDinerAmbient(rnd);
    else if (name === 'bistro') ambient = buildBistroAmbient(rnd);
    else if (name === 'sushi') ambient = buildSushiAmbient(rnd);
    else ambient = buildHotelAmbient(rnd);
    return { theme: theme, bg: bg, front: front, blur: blur, steam: steam, ambient: ambient };
  }

  function create(themeName) {
    const name = THEMES[themeName] ? themeName : 'truck';
    if (!built[name]) built[name] = bake(name);
    const room = built[name];

    function resolveView(view) {
      if (!view) return FULL_VIEW;
      const x0 = Number(view.x0), y0 = Number(view.y0), x1 = Number(view.x1), y1 = Number(view.y1);
      if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return FULL_VIEW;
      return { x0: x0, y0: y0, x1: x1, y1: y1 };
    }

    /* the room is always blitted 1:1 so it lines up with the stations and
       the counter; a view reaching past it (a window that is not 16:9) gets
       a blurred, darkened copy of the room scaled up to cover it, clipped to
       the letterbox bands, so no edge pixel is smeared into a long streak */
    function drawBands(c, v) {
      if (v.x0 >= 0 && v.y0 >= 0 && v.x1 <= W && v.y1 <= H) return;
      const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
      const s = Math.max(vw / W, vh / H);
      c.save();
      c.beginPath();
      c.rect(v.x0, v.y0, vw, vh);
      c.rect(0, 0, W, H);
      c.clip('evenodd');
      c.drawImage(room.blur, v.x0 + (vw - W * s) / 2, v.y0 + (vh - H * s) / 2, W * s, H * s);
      c.restore();
    }

    /* view is optional: without it only the 1280x720 play view is covered */
    function draw(c, t, view) {
      c.globalAlpha = 1;
      drawBands(c, resolveView(view));
      c.drawImage(room.bg, 0, 0);
      room.ambient.draw(c, t);
      room.steam.draw(c, t);
      c.globalAlpha = 1;
    }

    /* the serving counter over the seated guests */
    function drawFront(c) {
      c.drawImage(room.front, 0, FRONT_T);
    }

    return Object.freeze({
      theme: room.theme,
      draw: draw,
      drawFront: drawFront
    });
  }

  SZ.KitchenScene = Object.freeze({
    THEMES, create,
    LAYOUT: Object.freeze({ CTR_T, CTR_LIP, CTR_B, KIT_T, WORK_T, WORK_EDGE, FRONT_K, PLATE_T, PLATE_B })
  });
})();
