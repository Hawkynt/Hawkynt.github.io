;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Biome scenery for the flappy game. THEMES holds the six biome palettes;
   * create(biome) paints one opaque sky, three seamless silhouette strips
   * (far / mid / near), five cloud sprites and one ground tile into offscreen
   * canvases once, and the returned draw functions only blit. A frame is thus
   * a single full-screen image (the sky) plus cached strips that are only as
   * tall as their content - no gradients, no shadow blur and no shape work
   * happen per frame.
   *
   * The course objects follow the same rule: GATE_STYLES gives every biome a
   * pipe/pillar palette, and one 72 x 128 body tile plus one 88 x 30 cap are
   * built per biome. Icicles, bats, laser emitters, fireballs, the eight coin
   * frames and the six power-up bubbles are built once and shared by all
   * biomes. Only the gust streaks and the laser beam are drawn per frame, and
   * those are plain strokes.
   *
   * Everything is drawn in the game's logical 1280 x 720 space; the ground
   * top sits at y 640. The silhouette strips are PERIOD px wide and repeat
   * exactly, so they tile seamlessly at any parallax offset.
   *
   * Sky, backdrop and ground take an optional visible rect { x0, y0, x1, y1 }:
   * the logical area a canvas really shows when its aspect ratio is not 16:9.
   * Omitting it keeps the plain 1280 x 720 area, so the scenery never stops at
   * the game border and the letterbox bars are filled with scenery too.
   */

  const TWO_PI = Math.PI * 2;
  const SCREEN_W = 1280;
  const SCREEN_H = 720;
  const GROUND_Y = 640;
  const GROUND_H = 80;
  const GROUND_TILE = 256;
  const PERIOD = 1024;
  const FAR_H = 300;
  const MID_H = 220;
  const NEAR_H = 140;
  const CLOUD_W = 240;
  const CLOUD_H = 110;
  const CLOUD_LOOP = 2400;
  const GATE_W = 72;
  const GATE_TILE = 128;
  const CAP_W = 88;
  const CAP_H = 30;
  const ICICLE_W = 28;
  const ICICLE_H = 96;
  const BAT_W = 46;
  const BAT_H = 28;
  const FIRE_W = 64;
  const FIRE_H = 96;
  const FIRE_BALL = 32;               // the ball centre inside the fireball sprite
  const COIN_SIZE = 36;
  const BUBBLE_SIZE = 64;

  const BIOMES = ['meadow', 'desert', 'frost', 'forest', 'city', 'volcano'];

  const THEMES = {
    meadow: {
      sky: ['#4fb8ec', '#bfeaff'], sun: { x: 1040, y: 130, r: 46, color: '#fff6c8', glow: '#ffe98a' }, night: false,
      far: '#9cc6e0', mid: '#79c06a', near: '#3d9447', groundTop: '#5cb83c', ground: '#d9c48a', groundDark: '#c4ad70',
      cloud: '#ffffff', weather: { kind: 'leaves', color: '#7cc36a', rate: 0.6 }
    },
    desert: {
      sky: ['#f39a5a', '#ffe2b0'], sun: { x: 980, y: 150, r: 70, color: '#fff2cc', glow: '#ffd08a' }, night: false,
      far: '#d98c5f', mid: '#e7ae79', near: '#6d8f3c', groundTop: '#f0cc86', ground: '#e3b96e', groundDark: '#cf9f52',
      cloud: '#fff1dc', weather: { kind: 'sand', color: '#f2d29b', rate: 1.4 }
    },
    frost: {
      sky: ['#8ccaf2', '#eaf6ff'], sun: { x: 1060, y: 120, r: 40, color: '#ffffff', glow: '#dff1ff' }, night: false,
      far: '#cfe4f5', mid: '#7aa7c0', near: '#3e6f88', groundTop: '#ffffff', ground: '#e6f1fa', groundDark: '#c5daea',
      cloud: '#ffffff', weather: { kind: 'snow', color: '#ffffff', rate: 1.6 }
    },
    forest: {
      sky: ['#24184a', '#d07a84'], sun: { x: 1000, y: 140, r: 38, color: '#fff3d6', glow: '#ffd2a8' }, night: true,
      far: '#3e2c60', mid: '#2a1f46', near: '#17122b', groundTop: '#3f6b3a', ground: '#2c4429', groundDark: '#213420',
      cloud: '#b48aa8', weather: { kind: 'fireflies', color: '#d8ff6a', rate: 0.5 }
    },
    city: {
      sky: ['#0a0f2e', '#3a1c5c'], sun: { x: 1080, y: 110, r: 30, color: '#e8ecff', glow: '#8a9cff' }, night: true,
      far: '#1d2350', mid: '#14183a', near: '#0b0d24', groundTop: '#3a3e52', ground: '#2a2d3a', groundDark: '#1f2230',
      cloud: '#3a3a6a', weather: { kind: 'rain', color: '#9ab8ff', rate: 2.0 }
    },
    volcano: {
      sky: ['#2a0a0a', '#ff7436'], sun: { x: 1020, y: 160, r: 60, color: '#ffd2a0', glow: '#ff7a3a' }, night: false,
      far: '#4a1c1c', mid: '#2e1414', near: '#1a0b0b', groundTop: '#4a2a22', ground: '#2b1b1b', groundDark: '#1e1212',
      cloud: '#5a3030', weather: { kind: 'embers', color: '#ff8a3a', rate: 1.2 }
    }
  };

  /* per-biome gate (pipe/pillar) palettes; kind selects the surface texture */
  const GATE_STYLES = {
    meadow:  { body: '#5aa832', light: '#9be05a', dark: '#2f6e1c', cap: '#4f9a2a', kind: 'pipe' },
    desert:  { body: '#d99a5b', light: '#f2c58a', dark: '#8c5a2e', cap: '#c98a4b', kind: 'pillar' },
    frost:   { body: '#9fd8f0', light: '#e8fbff', dark: '#4f9ac0', cap: '#bfe6f7', kind: 'ice' },
    forest:  { body: '#7a5a3a', light: '#a8804f', dark: '#4a3420', cap: '#4f8a3a', kind: 'log' },
    city:    { body: '#262b55', light: '#4a5296', dark: '#12152e', cap: '#2e3466', kind: 'neon', neon: ['#3af2ff', '#ff3ad8'] },
    volcano: { body: '#3a2626', light: '#6a4646', dark: '#1c1010', cap: '#4a3030', kind: 'basalt', glow: '#ff5a1a' }
  };

  const BUBBLE_TINTS = {
    shield: '#4aa3ff', magnet: '#ff4a4a', slow: '#b06aff',
    ghost: '#bff4ff', double: '#ffc21a', tiny: '#5ad06a'
  };

  /* ── Color helpers ── */

  function hexToRgb(hex) {
    const h = hex.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/, '#$1$1$2$2$3$3');
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16)
    };
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  /* amount > 0 mixes toward white, amount < 0 toward black */
  function mix(hex, amount) {
    const c = hexToRgb(hex);
    const target = amount > 0 ? 255 : 0;
    const f = (v) => Math.round(v + (target - v) * Math.abs(amount));
    return { r: f(c.r), g: f(c.g), b: f(c.b) };
  }

  function shade(hex, amount) {
    const c = mix(hex, amount);
    return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
  }

  function shadeRgba(hex, amount, alpha) {
    const c = mix(hex, amount);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return cv;
  }

  /* deterministic RNG so a biome always looks the same */
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

  /* ── Seamless ridge: k are integers, so the sum repeats every period px ── */

  function ridge(x, period, waves) {
    let sum = 0;
    for (let i = 0; i < waves.length; ++i) {
      const w = waves[i];
      sum += w[0] * Math.sin(TWO_PI * w[1] * x / period + w[2]);
    }
    return sum;
  }

  /* a profile from a wave sum: the crest sits `base` px above the strip bottom */
  function waveTop(height, base, waves) {
    return function(x) {
      return height - (base + ridge(x, PERIOD, waves));
    };
  }

  /* a profile from a list of rectangles (city skylines), wrapped at the seam */
  function blockTop(height, blocks) {
    return function(x) {
      let t = height;
      for (let i = 0; i < blocks.length; ++i) {
        const b = blocks[i];
        if (x >= b.x && x < b.x + b.w && b.top < t) t = b.top;
        const bx = b.x - PERIOD;
        if (x >= bx && x < bx + b.w && b.top < t) t = b.top;
      }
      return t;
    };
  }

  function makeBlocks(rng, minW, maxW, minH, maxH, height) {
    const blocks = [];
    let x = 0;
    while (x < PERIOD) {
      const w = minW + Math.floor(rng() * (maxW - minW));
      const h = minH + Math.floor(rng() * (maxH - minH));
      blocks.push({ x: x, w: w, top: height - h, h: h });
      x += w + Math.floor(rng() * 14);
    }
    return blocks;
  }

  /* a profile from truncated triangular cones (volcanoes), wrapped at the seam */
  function coneTop(height, cones) {
    return function(x) {
      let t = height;
      for (let i = 0; i < cones.length; ++i) {
        const k = cones[i];
        for (let o = 0; o < 2; ++o) {
          const cx = k.cx - o * PERIOD;
          const d = Math.abs(x - cx);
          if (d > k.hw) continue;
          const crater = k.crater || 0;
          const y = d <= crater ? k.top : k.top + (d - crater) / (k.hw - crater) * (height - k.top);
          if (y < t) t = y;
        }
      }
      return t;
    };
  }

  /* run fn at x and at both wrapped offsets, so seam-crossing props stay whole */
  function wrapX(x, fn) {
    fn(x);
    fn(x - PERIOD);
    fn(x + PERIOD);
  }

  /* ── Strip painting: gradient silhouette + lighter rim along the crest ── */

  function traceProfile(c, top) {
    c.beginPath();
    c.moveTo(0, top(0));
    for (let x = 1; x <= PERIOD; ++x) c.lineTo(x, top(x));
  }

  function paintStrip(c, height, top, color) {
    const g = c.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, shade(color, 0.12));
    g.addColorStop(1, shade(color, -0.1));
    traceProfile(c, top);
    c.lineTo(PERIOD, height);
    c.lineTo(0, height);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    traceProfile(c, top);
    c.strokeStyle = shadeRgba(color, 0.25, 0.6);
    c.lineWidth = 2;
    c.stroke();
  }

  /* a snow band hugging the crest where it rises above `limit` */
  function crestBand(c, top, limit, depth, style) {
    c.fillStyle = style;
    let x = 0;
    while (x <= PERIOD) {
      while (x <= PERIOD && top(x) > limit) ++x;
      if (x > PERIOD) break;
      const a = x;
      const pts = [];
      while (x <= PERIOD && top(x) <= limit) { pts.push(x); ++x; }
      const span = Math.max(1, pts[pts.length - 1] - a);
      c.beginPath();
      for (let i = 0; i < pts.length; ++i) {
        if (i === 0) c.moveTo(pts[i], top(pts[i]));
        else c.lineTo(pts[i], top(pts[i]));
      }
      for (let i = pts.length - 1; i >= 0; --i) {
        const px = pts[i];
        c.lineTo(px, top(px) + depth * Math.sin(Math.PI * (px - a) / span));
      }
      c.closePath();
      c.fill();
    }
  }

  function triangle(c, x, apexY, baseY, halfW) {
    c.beginPath();
    c.moveTo(x, apexY);
    c.lineTo(x - halfW, baseY);
    c.lineTo(x + halfW, baseY);
    c.closePath();
    c.fill();
  }

  /* ── Sky ── */

  function buildSky(theme, rng) {
    const cv = makeCanvas(SCREEN_W, SCREEN_H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, SCREEN_H);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);

    if (theme.night) {
      for (let i = 0; i < 140; ++i) {
        c.globalAlpha = 0.4 + rng() * 0.6;
        c.fillStyle = '#ffffff';
        const s = rng() < 0.5 ? 1 : 2;
        c.fillRect(rng() * SCREEN_W, rng() * SCREEN_H * 0.6, s, s);
      }
      c.globalAlpha = 1;
    }

    const sun = theme.sun;
    const glow = c.createRadialGradient(sun.x, sun.y, sun.r * 0.4, sun.x, sun.y, sun.r * 3.2);
    glow.addColorStop(0, rgba(sun.glow, theme.night ? 0.32 : 0.55));
    glow.addColorStop(1, rgba(sun.glow, 0));
    c.fillStyle = glow;
    c.beginPath();
    c.arc(sun.x, sun.y, sun.r * 3.2, 0, TWO_PI);
    c.fill();

    const disc = c.createRadialGradient(sun.x - sun.r * 0.3, sun.y - sun.r * 0.3, sun.r * 0.2, sun.x, sun.y, sun.r);
    disc.addColorStop(0, sun.color);
    disc.addColorStop(1, shade(sun.color, -0.08));
    c.fillStyle = disc;
    c.beginPath();
    c.arc(sun.x, sun.y, sun.r, 0, TWO_PI);
    c.fill();

    if (theme.night) {
      c.fillStyle = shadeRgba(sun.color, -0.28, 0.45);
      for (let i = 0; i < 3; ++i) {
        const a = rng() * TWO_PI;
        const d = rng() * sun.r * 0.55;
        c.beginPath();
        c.arc(sun.x + Math.cos(a) * d, sun.y + Math.sin(a) * d, sun.r * (0.12 + rng() * 0.14), 0, TWO_PI);
        c.fill();
      }
    }

    if (theme.weather.kind === 'sand') {
      const haze = c.createLinearGradient(0, 420, 0, 520);
      haze.addColorStop(0, rgba(theme.sky[1], 0));
      haze.addColorStop(0.5, shadeRgba(theme.sky[1], 0.1, 0.45));
      haze.addColorStop(1, rgba(theme.sky[1], 0));
      c.fillStyle = haze;
      c.fillRect(0, 420, SCREEN_W, 100);
    }

    if (theme.weather.kind === 'embers') {
      c.fillStyle = rgba('#1a0505', 0.25);
      for (let i = 0; i < 3; ++i) {
        c.beginPath();
        c.ellipse(300 + i * 340, 80 + i * 85, 620, 42, 0, 0, TWO_PI);
        c.fill();
      }
    }

    return cv;
  }

  /* ── Far strip: the horizon line ── */

  function buildFar(biome, theme, rng) {
    const cv = makeCanvas(PERIOD, FAR_H);
    const c = cv.getContext('2d');
    let top;
    let blocks = null;

    if (biome === 'city') {
      blocks = makeBlocks(rng, 30, 90, 120, 260, FAR_H);
      top = blockTop(FAR_H, blocks);
    } else if (biome === 'volcano') {
      top = coneTop(FAR_H, [
        { cx: 520, hw: 430, top: 46, crater: 46 },
        { cx: 130, hw: 190, top: 150 },
        { cx: 900, hw: 240, top: 118 }
      ]);
    } else if (biome === 'desert') {
      const raw = waveTop(FAR_H, 150, [[72, 1, 0.6], [38, 2, 2.9], [14, 4, 1.8]]);
      top = function(x) { return Math.max(raw(x), 92); }; /* peaks clamp to the plateau level */
    } else if (biome === 'frost') {
      top = waveTop(FAR_H, 160, [[60, 2, 0.4], [34, 3, 1.9], [15, 5, 3.2], [7, 9, 0.7]]);
    } else if (biome === 'forest') {
      top = waveTop(FAR_H, 150, [[36, 1, 2.4], [22, 2, 0.9], [12, 4, 2.0], [6, 8, 5.1], [3, 13, 1.1]]);
    } else {
      top = waveTop(FAR_H, 150, [[42, 1, 0.8], [24, 2, 2.2], [11, 3, 4.1], [5, 6, 1.4]]);
    }

    paintStrip(c, FAR_H, top, theme.far);

    if (biome === 'frost') crestBand(c, top, 105, 26, 'rgba(255,255,255,0.85)');

    if (blocks) {
      /* the window pattern is decided once per building so both seam copies match */
      for (let i = 0; i < blocks.length; ++i) {
        const b = blocks[i];
        const cells = [];
        const cols = Math.floor((b.w - 6) / 6);
        const rows = Math.floor((b.h - 12) / 8);
        for (let r = 0; r < rows; ++r) {
          for (let col = 0; col < cols; ++col) {
            if (rng() >= 0.25) continue;
            cells.push({ dx: 3 + col * 6, dy: 8 + r * 8, color: rng() < 0.5 ? '#ffd96a' : '#6ae4ff' });
          }
        }
        wrapX(b.x + b.w / 2, function(cx) {
          const bx = cx - b.w / 2;
          if (bx > PERIOD || bx + b.w < 0) return;
          c.globalAlpha = 0.85;
          for (let k = 0; k < cells.length; ++k) {
            c.fillStyle = cells[k].color;
            c.fillRect(bx + cells[k].dx, b.top + cells[k].dy, 2, 3);
          }
          c.globalAlpha = 1;
        });
      }
    }

    if (biome === 'volcano') {
      const crater = c.createRadialGradient(520, 46, 4, 520, 46, 120);
      crater.addColorStop(0, rgba('#ffd2a0', 0.75));
      crater.addColorStop(0.35, rgba('#ff7a3a', 0.5));
      crater.addColorStop(1, rgba('#ff7a3a', 0));
      c.fillStyle = crater;
      c.beginPath();
      c.arc(520, 46, 120, 0, TWO_PI);
      c.fill();
    }

    /* atmospheric fog over the lower half of the far strip, clipped to the silhouette */
    c.save();
    traceProfile(c, top);
    c.lineTo(PERIOD, FAR_H);
    c.lineTo(0, FAR_H);
    c.closePath();
    c.clip();
    c.fillStyle = rgba(theme.sky[1], 0.35);
    c.fillRect(0, FAR_H * 0.5, PERIOD, FAR_H * 0.5);
    c.restore();

    return cv;
  }

  /* ── Mid strip: closer, darker shapes ── */

  function buildMid(biome, theme, rng) {
    const cv = makeCanvas(PERIOD, MID_H);
    const c = cv.getContext('2d');
    let top;
    let blocks = null;

    if (biome === 'city') {
      blocks = makeBlocks(rng, 60, 140, 90, 190, MID_H);
      top = blockTop(MID_H, blocks);
    } else if (biome === 'volcano') {
      top = waveTop(MID_H, 88, [[22, 1, 0.8], [10, 3, 2.2]]);
    } else if (biome === 'desert') {
      top = waveTop(MID_H, 112, [[40, 1, 0.5], [22, 2, 2.7], [9, 3, 4.9]]);
    } else if (biome === 'frost') {
      top = waveTop(MID_H, 100, [[26, 1, 2.9], [12, 3, 1.3]]);
    } else if (biome === 'forest') {
      top = waveTop(MID_H, 118, [[30, 1, 0.3], [14, 2, 2.2], [6, 5, 4.4]]);
    } else {
      top = waveTop(MID_H, 108, [[34, 1, 1.7], [18, 2, 4.2], [8, 4, 0.6]]);
    }

    paintStrip(c, MID_H, top, theme.mid);

    if (biome === 'meadow') {
      const trees = [];
      for (let i = 0; i < 7; ++i) trees.push({ x: rng() * PERIOD, r: 12 + rng() * 7 });
      for (let i = 0; i < trees.length; ++i) {
        const tr = trees[i];
        wrapX(tr.x, function(px) {
          const gy = top(px);
          c.fillStyle = shade(theme.mid, 0.06);
          c.beginPath();
          c.arc(px, gy - tr.r - 6, tr.r, 0, TWO_PI);
          c.fill();
          c.fillStyle = shade(theme.mid, -0.25);
          c.fillRect(px - 2, gy - 8, 4, 8);
        });
      }
    } else if (biome === 'frost') {
      const pines = [];
      for (let i = 0; i < 12; ++i) pines.push({ x: rng() * PERIOD, h: 46 + rng() * 26 });
      for (let i = 0; i < pines.length; ++i) {
        const p = pines[i];
        wrapX(p.x, function(px) {
          const gy = top(px) + 4;
          c.fillStyle = shade(theme.mid, -0.14);
          for (let k = 0; k < 3; ++k) {
            const ty = gy - p.h * (k + 1) / 3;
            triangle(c, px, ty - p.h * 0.16, ty + p.h * 0.16, (p.h * 0.42) * (1 - k * 0.26));
          }
          c.fillStyle = 'rgba(255,255,255,0.8)';
          c.fillRect(px - 2, gy - p.h - 8, 4, 4);
        });
      }
    } else if (biome === 'forest') {
      const pines = [];
      for (let i = 0; i < 14; ++i) pines.push({ x: rng() * PERIOD, h: 70 + rng() * 50, hw: 11 + rng() * 7 });
      for (let i = 0; i < pines.length; ++i) {
        const p = pines[i];
        wrapX(p.x, function(px) {
          c.fillStyle = shade(theme.mid, -0.08);
          triangle(c, px, top(px) + 6 - p.h, top(px) + 6, p.hw);
        });
      }
    } else if (blocks) {
      for (let i = 0; i < blocks.length; ++i) {
        const b = blocks[i];
        if (rng() < 0.45) continue;
        const neon = rng() < 0.5 ? '#ff4cd8' : '#4cf0ff';
        const w = 14 + Math.floor(rng() * Math.max(6, b.w - 30));
        const dy = 16 + rng() * Math.max(4, b.h - 44);
        wrapX(b.x + b.w / 2, function(cx) {
          const bx = cx - b.w / 2;
          if (bx > PERIOD || bx + b.w < 0) return;
          const sx = bx + (b.w - w) / 2;
          const sy = b.top + dy;
          c.globalAlpha = 0.18;
          c.fillStyle = neon;
          c.fillRect(sx, sy, w, 9);
          c.globalAlpha = 0.85;
          c.strokeStyle = neon;
          c.lineWidth = 2;
          c.strokeRect(sx, sy, w, 9);
          c.globalAlpha = 1;
        });
      }
    } else if (biome === 'volcano') {
      const spires = [];
      for (let i = 0; i < 9; ++i) spires.push({ x: rng() * PERIOD, h: 90 + rng() * 70, hw: 13 + rng() * 17 });
      for (let i = 0; i < spires.length; ++i) {
        const s = spires[i];
        wrapX(s.x, function(px) {
          const gy = top(px) + 8;
          c.fillStyle = shade(theme.mid, -0.12);
          triangle(c, px, gy - s.h, gy, s.hw);
          c.strokeStyle = rgba('#ff7a3a', 0.7);
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(px, gy - s.h + 8);
          c.lineTo(px - 4, gy - s.h * 0.45);
          c.lineTo(px + 3, gy - 6);
          c.stroke();
          c.strokeStyle = rgba('#ffb27a', 0.6);
          c.lineWidth = 0.7;
          c.stroke();
        });
      }
    }

    return cv;
  }

  /* ── Near strip: the closest band, right above the ground ── */

  function buildNear(biome, theme, rng) {
    const cv = makeCanvas(PERIOD, NEAR_H);
    const c = cv.getContext('2d');
    let top;
    let blocks = null;

    if (biome === 'city') {
      blocks = makeBlocks(rng, 90, 200, 50, 100, NEAR_H);
      top = blockTop(NEAR_H, blocks);
    } else if (biome === 'desert') {
      top = waveTop(NEAR_H, 62, [[14, 1, 2.2], [7, 3, 0.9]]);
    } else if (biome === 'frost') {
      top = waveTop(NEAR_H, 66, [[16, 1, 0.4], [8, 2, 3.1]]);
    } else if (biome === 'volcano') {
      top = waveTop(NEAR_H, 60, [[15, 1, 1.4], [7, 3, 4.6]]);
    } else if (biome === 'forest') {
      top = waveTop(NEAR_H, 64, [[14, 1, 3.3], [7, 4, 1.2]]);
    } else {
      top = waveTop(NEAR_H, 68, [[16, 1, 1.9], [9, 3, 0.7], [4, 7, 2.8]]);
    }

    paintStrip(c, NEAR_H, top, theme.near);

    if (biome === 'meadow') {
      const bushes = [];
      for (let i = 0; i < 10; ++i) bushes.push({ x: rng() * PERIOD, r: 14 + rng() * 12 });
      for (let i = 0; i < bushes.length; ++i) {
        const b = bushes[i];
        wrapX(b.x, function(px) {
          const gy = top(px) + 3;
          c.fillStyle = shade(theme.near, -0.1);
          c.beginPath();
          c.arc(px, gy, b.r, Math.PI, TWO_PI);
          c.fill();
        });
      }
      const petals = ['#ff6a8a', '#ffd94a', '#ffffff', '#ff9ad8'];
      const flowers = [];
      for (let i = 0; i < 40; ++i) flowers.push({ x: rng() * PERIOD, dy: 4 + rng() * 10, color: petals[i % petals.length] });
      for (let i = 0; i < flowers.length; ++i) {
        const f = flowers[i];
        wrapX(f.x, function(px) {
          c.fillStyle = f.color;
          c.globalAlpha = 0.9;
          c.fillRect(px, top(px) + f.dy, 2, 2);
          c.globalAlpha = 1;
        });
      }
    } else if (biome === 'desert') {
      const cacti = [];
      for (let i = 0; i < 6; ++i) cacti.push({ x: rng() * PERIOD, h: 44 + rng() * 30 });
      for (let i = 0; i < cacti.length; ++i) {
        const k = cacti[i];
        wrapX(k.x, function(px) {
          const gy = top(px) + 4;
          const h = k.h;
          c.fillStyle = shade(theme.near, 0.05);
          c.fillRect(px - 4, gy - h, 8, h);
          c.beginPath();
          c.arc(px, gy - h, 4, 0, TWO_PI);
          c.fill();
          c.fillRect(px - 16, gy - h * 0.62, 8, h * 0.34);
          c.fillRect(px - 16, gy - h * 0.62, 12, 7);
          c.fillRect(px + 8, gy - h * 0.44, 8, h * 0.24);
          c.fillRect(px + 4, gy - h * 0.44, 12, 7);
          c.strokeStyle = shadeRgba(theme.near, 0.3, 0.5);
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(px - 2, gy - h + 4);
          c.lineTo(px - 2, gy - 4);
          c.stroke();
        });
      }
      const rocks = [];
      for (let i = 0; i < 8; ++i) rocks.push({ x: rng() * PERIOD, rx: 10 + rng() * 10, ry: 5 + rng() * 5 });
      for (let i = 0; i < rocks.length; ++i) {
        const r = rocks[i];
        wrapX(r.x, function(px) {
          c.fillStyle = '#9a8468';
          c.beginPath();
          c.ellipse(px, top(px) + 6, r.rx, r.ry, 0, 0, TWO_PI);
          c.fill();
        });
      }
    } else if (biome === 'frost') {
      const firs = [];
      for (let i = 0; i < 10; ++i) firs.push({ x: rng() * PERIOD, h: 52 + rng() * 34 });
      for (let i = 0; i < firs.length; ++i) {
        const f = firs[i];
        wrapX(f.x, function(px) {
          const gy = top(px) + 6;
          c.fillStyle = shade(theme.near, -0.12);
          triangle(c, px, gy - f.h, gy, f.h * 0.32);
          c.fillStyle = 'rgba(255,255,255,0.75)';
          triangle(c, px, gy - f.h, gy - f.h * 0.45, f.h * 0.18);
        });
      }
    } else if (biome === 'forest') {
      c.strokeStyle = shadeRgba(theme.near, 0.35, 0.7);
      c.lineWidth = 1.5;
      const ferns = [];
      for (let i = 0; i < 16; ++i) ferns.push(rng() * PERIOD);
      for (let i = 0; i < ferns.length; ++i) {
        wrapX(ferns[i], function(px) {
          const gy = top(px) + 8;
          for (let k = -1; k <= 1; ++k) {
            c.beginPath();
            c.moveTo(px, gy);
            c.quadraticCurveTo(px + k * 10, gy - 14, px + k * 16, gy - 20);
            c.stroke();
          }
        });
      }
      const shrooms = [];
      for (let i = 0; i < 8; ++i) shrooms.push({ x: rng() * PERIOD, r: 4 + rng() * 3 });
      for (let i = 0; i < shrooms.length; ++i) {
        const m = shrooms[i];
        wrapX(m.x, function(px) {
          const gy = top(px) + 10;
          const halo = c.createRadialGradient(px, gy - 6, 1, px, gy - 6, m.r * 3);
          halo.addColorStop(0, rgba('#7affd8', 0.4));
          halo.addColorStop(1, rgba('#7affd8', 0));
          c.fillStyle = halo;
          c.beginPath();
          c.arc(px, gy - 6, m.r * 3, 0, TWO_PI);
          c.fill();
          c.fillStyle = '#e8e0c8';
          c.fillRect(px - 1.5, gy - 6, 3, 7);
          c.fillStyle = '#7affd8';
          c.beginPath();
          c.arc(px, gy - 6, m.r, Math.PI, TWO_PI);
          c.fill();
        });
      }
    } else if (blocks) {
      for (let i = 0; i < blocks.length; ++i) {
        const b = blocks[i];
        wrapX(b.x + b.w / 2, function(cx) {
          const bx = cx - b.w / 2;
          if (bx > PERIOD || bx + b.w < 0) return;
          c.strokeStyle = shadeRgba(theme.near, 0.3, 0.8);
          c.lineWidth = 2;
          for (let k = 0; k < 2; ++k) {
            const ax = bx + b.w * (0.25 + k * 0.5);
            const ah = 14 + (k ? 10 : 0);
            c.beginPath();
            c.moveTo(ax, b.top);
            c.lineTo(ax, b.top - ah);
            c.stroke();
          }
          const lx = bx + b.w * 0.75;
          const ly = b.top - 24;
          const halo = c.createRadialGradient(lx, ly, 1, lx, ly, 10);
          halo.addColorStop(0, rgba('#ff4d4d', 0.7));
          halo.addColorStop(1, rgba('#ff4d4d', 0));
          c.fillStyle = halo;
          c.beginPath();
          c.arc(lx, ly, 10, 0, TWO_PI);
          c.fill();
          c.fillStyle = '#ff6a6a';
          c.beginPath();
          c.arc(lx, ly, 2.5, 0, TWO_PI);
          c.fill();
        });
      }
    } else if (biome === 'volcano') {
      const rocks = [];
      for (let i = 0; i < 9; ++i) rocks.push({ x: rng() * PERIOD, w: 22 + rng() * 26, h: 18 + rng() * 22 });
      for (let i = 0; i < rocks.length; ++i) {
        const k = rocks[i];
        wrapX(k.x, function(px) {
          const gy = top(px) + 10;
          c.fillStyle = shade(theme.near, 0.06);
          c.beginPath();
          c.moveTo(px - k.w / 2, gy);
          c.lineTo(px - k.w * 0.3, gy - k.h);
          c.lineTo(px + k.w * 0.25, gy - k.h * 0.8);
          c.lineTo(px + k.w / 2, gy);
          c.closePath();
          c.fill();
          c.strokeStyle = rgba('#ff5a1a', 0.85);
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(px - k.w * 0.3, gy - k.h + 3);
          c.lineTo(px - k.w * 0.05, gy - k.h * 0.4);
          c.lineTo(px + k.w * 0.2, gy);
          c.stroke();
          c.strokeStyle = rgba('#ffb27a', 0.7);
          c.lineWidth = 0.8;
          c.stroke();
        });
      }
    }

    return cv;
  }

  /* ── Cloud sprites ── */

  function buildCloud(theme, rng) {
    const cv = makeCanvas(CLOUD_W, CLOUD_H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, CLOUD_H);
    g.addColorStop(0, shade(theme.cloud, 0.3));
    g.addColorStop(1, shade(theme.cloud, -0.12));
    c.fillStyle = g;
    c.globalAlpha = 0.9;
    const n = 6 + Math.floor(rng() * 4);
    for (let i = 0; i < n; ++i) {
      const x = 40 + rng() * (CLOUD_W - 80);
      const y = 40 + rng() * 40;
      const r = 26 + rng() * 22;
      c.beginPath();
      c.arc(x, y, r, 0, TWO_PI);
      c.fill();
    }
    c.globalAlpha = 1;
    return cv;
  }

  /* ── Ground tile ── */

  function buildGround(biome, theme, rng) {
    const cv = makeCanvas(GROUND_TILE, GROUND_H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, GROUND_H);
    g.addColorStop(0, theme.ground);
    g.addColorStop(1, theme.groundDark);
    c.fillStyle = g;
    c.fillRect(0, 0, GROUND_TILE, GROUND_H);
    c.fillStyle = theme.groundTop;
    c.fillRect(0, 0, GROUND_TILE, 10);
    c.fillStyle = shade(theme.groundTop, -0.25);
    c.fillRect(0, 10, GROUND_TILE, 2);

    /* details are drawn at both wrapped offsets so the tile seams stay clean */
    const wrapTile = function(x, fn) {
      fn(x);
      fn(x - GROUND_TILE);
      fn(x + GROUND_TILE);
    };

    if (biome === 'meadow') {
      const blades = [];
      for (let i = 0; i < 26; ++i) blades.push({ x: rng() * GROUND_TILE, lean: (rng() - 0.5) * 4, tip: 4 + rng() * 4, light: i & 1 });
      for (let i = 0; i < blades.length; ++i) {
        const b = blades[i];
        wrapTile(b.x, function(px) {
          c.strokeStyle = b.light ? shadeRgba(theme.groundTop, 0.2, 0.8) : shadeRgba(theme.groundTop, -0.25, 0.8);
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(px, 12);
          c.lineTo(px + b.lean, b.tip);
          c.stroke();
        });
      }
      const pebbles = [];
      for (let i = 0; i < 10; ++i) pebbles.push({ x: rng() * GROUND_TILE, y: 30 + rng() * 40, rx: 3 + rng() * 3, ry: 2 + rng() * 2 });
      for (let i = 0; i < pebbles.length; ++i) {
        const p = pebbles[i];
        wrapTile(p.x, function(px) {
          c.fillStyle = shadeRgba(theme.groundDark, -0.15, 0.7);
          c.beginPath();
          c.ellipse(px, p.y, p.rx, p.ry, 0, 0, TWO_PI);
          c.fill();
        });
      }
    } else if (biome === 'desert') {
      c.strokeStyle = shadeRgba(theme.groundDark, 0.1, 0.5);
      c.lineWidth = 1.5;
      for (let i = 0; i < 8; ++i) {
        const x = rng() * GROUND_TILE;
        const y = 24 + i * 6;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 30, y - 4, x + 60, y);
        c.stroke();
      }
    } else if (biome === 'frost') {
      for (let i = 0; i < 40; ++i) {
        const x = rng() * GROUND_TILE;
        const y = 16 + rng() * 58;
        c.fillStyle = 'rgba(255,255,255,' + (0.5 + rng() * 0.5).toFixed(2) + ')';
        wrapTile(x, function(px) { c.fillRect(px, y, 2, 2); });
      }
      c.strokeStyle = shadeRgba(theme.groundDark, -0.2, 0.6);
      c.lineWidth = 1;
      for (let i = 0; i < 5; ++i) {
        const x = rng() * GROUND_TILE;
        wrapTile(x, function(px) {
          c.beginPath();
          c.moveTo(px, 20);
          c.lineTo(px + 14, 40);
          c.lineTo(px + 6, 62);
          c.stroke();
        });
      }
    } else if (biome === 'forest') {
      const tufts = [];
      for (let i = 0; i < 14; ++i) tufts.push({ x: rng() * GROUND_TILE, y: 14 + rng() * 8, r: 4 + rng() * 4 });
      for (let i = 0; i < tufts.length; ++i) {
        const t = tufts[i];
        wrapTile(t.x, function(px) {
          c.fillStyle = shadeRgba(theme.groundTop, 0.2, 0.7);
          c.beginPath();
          c.arc(px, t.y, t.r, Math.PI, TWO_PI);
          c.fill();
        });
      }
      c.strokeStyle = shadeRgba(theme.groundDark, -0.2, 0.7);
      c.lineWidth = 2;
      for (let i = 0; i < 6; ++i) {
        const x = rng() * GROUND_TILE;
        wrapTile(x, function(px) {
          c.beginPath();
          c.moveTo(px, 26);
          c.quadraticCurveTo(px + 12, 34, px + 26, 30);
          c.stroke();
        });
      }
    } else if (biome === 'city') {
      c.fillStyle = 'rgba(240,210,90,0.75)';
      for (let x = 0; x < GROUND_TILE; x += 64) c.fillRect(x, 40, 32, 4);
      for (let i = 0; i < 30; ++i) {
        const x = rng() * GROUND_TILE;
        const y = 16 + rng() * 58;
        c.fillStyle = shadeRgba(theme.groundDark, 0.2, 0.4);
        wrapTile(x, function(px) { c.fillRect(px, y, 2, 2); });
      }
    } else if (biome === 'volcano') {
      c.strokeStyle = shadeRgba(theme.groundDark, -0.3, 0.8);
      c.lineWidth = 1;
      for (let i = 0; i < 10; ++i) {
        const x = rng() * GROUND_TILE;
        wrapTile(x, function(px) {
          c.beginPath();
          c.moveTo(px, 16);
          c.lineTo(px + 10, 34);
          c.lineTo(px - 6, 52);
          c.lineTo(px + 8, 72);
          c.stroke();
        });
      }
      for (let i = 0; i < 5; ++i) {
        const x = rng() * GROUND_TILE;
        wrapTile(x, function(px) {
          c.strokeStyle = rgba('#ff5a1a', 0.8);
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(px, 22 + i * 9);
          c.lineTo(px + 18, 26 + i * 9);
          c.lineTo(px + 34, 21 + i * 9);
          c.stroke();
          c.strokeStyle = rgba('#ffb27a', 0.7);
          c.lineWidth = 0.8;
          c.stroke();
        });
      }
    }

    return cv;
  }

  /* ── Gates: a body tile that repeats vertically + one overhanging cap ── */

  /* the lava vein starts and ends at the same x so it continues across tiles */
  function veinPath(c) {
    c.beginPath();
    c.moveTo(40, 0);
    c.lineTo(30, 26);
    c.lineTo(44, 58);
    c.lineTo(32, 92);
    c.lineTo(40, GATE_TILE);
  }

  function capCrackPath(c) {
    c.beginPath();
    c.moveTo(10, 24);
    c.lineTo(26, 16);
    c.lineTo(44, 22);
    c.lineTo(62, 14);
    c.lineTo(78, 20);
  }

  function buildGateBody(style, rng) {
    const cv = makeCanvas(GATE_W, GATE_TILE);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, GATE_W, 0);
    g.addColorStop(0, style.dark);
    g.addColorStop(0.35, style.light);
    g.addColorStop(0.6, style.body);
    g.addColorStop(1, style.dark);
    c.fillStyle = g;
    c.fillRect(0, 0, GATE_W, GATE_TILE);

    const kind = style.kind;
    if (kind === 'pipe') {
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.fillRect(16, 0, 4, GATE_TILE);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(22, 0, 2, GATE_TILE);
    } else if (kind === 'pillar') {
      /* bands sit at 16 + 32k so the spacing stays even across the tile seam */
      for (let y = 16; y < GATE_TILE; y += 32) {
        c.fillStyle = shadeRgba(style.dark, -0.2, 0.8);
        c.fillRect(2, y, GATE_W - 4, 2);
        c.fillStyle = shadeRgba(style.light, 0.2, 0.5);
        c.fillRect(2, y + 2, GATE_W - 4, 1);
      }
    } else if (kind === 'ice') {
      c.strokeStyle = 'rgba(255,255,255,0.3)';
      c.lineWidth = 6;
      for (let i = 0; i < 3; ++i) {
        const x = 8 + i * 22;
        c.beginPath();
        c.moveTo(x, 10 + i * 14);
        c.lineTo(x + 26, 70 + i * 18);
        c.stroke();
      }
      c.strokeStyle = shadeRgba(style.dark, -0.1, 0.6);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(50, 12);
      c.lineTo(42, 44);
      c.lineTo(54, 78);
      c.lineTo(46, 110);
      c.stroke();
    } else if (kind === 'log') {
      c.strokeStyle = shadeRgba(style.dark, -0.15, 0.7);
      c.lineWidth = 1.5;
      for (let i = 0; i < 4; ++i) {
        const x = 12 + i * 15;
        c.beginPath();
        c.moveTo(x, 0);
        c.bezierCurveTo(x + 3, 40, x - 3, 88, x, GATE_TILE);
        c.stroke();
      }
      for (let i = 0; i < 2; ++i) {
        const kx = 20 + i * 30;
        const ky = 34 + i * 56;
        c.fillStyle = shadeRgba(style.dark, -0.1, 0.8);
        c.beginPath();
        c.ellipse(kx, ky, 5, 7, 0, 0, TWO_PI);
        c.fill();
        c.strokeStyle = shadeRgba(style.light, 0.1, 0.5);
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(kx, ky, 2.5, 4, 0, 0, TWO_PI);
        c.stroke();
      }
    } else if (kind === 'neon') {
      c.fillStyle = shadeRgba(style.dark, -0.3, 0.9);
      c.fillRect(2, 62, GATE_W - 4, 2);
      c.fillStyle = shadeRgba(style.light, 0.25, 0.5);
      c.fillRect(2, 64, GATE_W - 4, 1);
      c.fillStyle = style.neon[0];
      c.fillRect(3, 0, 3, GATE_TILE);
      c.fillStyle = style.neon[1];
      c.fillRect(GATE_W - 6, 0, 3, GATE_TILE);
    } else { /* basalt */
      c.strokeStyle = shadeRgba(style.dark, -0.25, 0.8);
      c.lineWidth = 1.5;
      for (let row = 0; row < 4; ++row) {
        const y = 16 + row * 32;
        for (let col = 0; col < 3; ++col) {
          const x = 10 + col * 20 + (row % 2 ? 10 : 0);
          c.beginPath();
          for (let k = 0; k < 6; ++k) {
            const a = TWO_PI * (k + 0.5) / 6;
            const px = x + Math.cos(a) * 11;
            const py = y + Math.sin(a) * 11;
            if (k === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.closePath();
          c.stroke();
        }
      }
      c.strokeStyle = rgba(style.glow, 0.35);
      c.lineWidth = 7;
      veinPath(c);
      c.stroke();
      c.strokeStyle = style.glow;
      c.lineWidth = 2.5;
      veinPath(c);
      c.stroke();
      c.strokeStyle = '#ffd2a0';
      c.lineWidth = 1;
      veinPath(c);
      c.stroke();
    }

    /* only vertical edge outlines - horizontal ones would seam every tile */
    c.fillStyle = shade(style.dark, -0.35);
    c.fillRect(0, 0, 2, GATE_TILE);
    c.fillRect(GATE_W - 2, 0, 2, GATE_TILE);
    return cv;
  }

  function buildGateCap(style, rng) {
    const cv = makeCanvas(CAP_W, CAP_H);
    const c = cv.getContext('2d');
    const kind = style.kind;
    const g = c.createLinearGradient(0, 0, CAP_W, 0);
    g.addColorStop(0, shade(style.cap, -0.4));
    g.addColorStop(0.35, shade(style.cap, 0.3));
    g.addColorStop(0.62, style.cap);
    g.addColorStop(1, shade(style.cap, -0.4));
    c.fillStyle = g;
    c.fillRect(0, 0, CAP_W, CAP_H);
    c.strokeStyle = shade(style.cap, -0.5);
    c.lineWidth = 2;
    c.strokeRect(1, 1, CAP_W - 2, CAP_H - 2);
    c.fillStyle = shadeRgba(style.cap, 0.55, 0.75);
    c.fillRect(4, 3, CAP_W - 8, 2);

    if (kind === 'log') {
      /* moss rim with grass tips poking over the top edge */
      c.strokeStyle = shade('#5aa832', 0.15);
      c.lineWidth = 2;
      for (let i = 0; i < 10; ++i) {
        const x = 6 + i * 8;
        c.beginPath();
        c.moveTo(x, 4);
        c.lineTo(x + (i % 2 ? 2 : -2), 0);
        c.stroke();
      }
    } else if (kind === 'neon') {
      c.fillStyle = rgba(style.neon[0], 0.3);
      c.fillRect(4, 22, CAP_W - 8, 6);
      c.fillStyle = style.neon[0];
      c.fillRect(4, 24, CAP_W - 8, 2);
    } else if (kind === 'ice') {
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(2, CAP_H - 9, CAP_W - 4, 2);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.fillRect(2, CAP_H - 7, CAP_W - 4, 5);
    } else if (kind === 'basalt') {
      c.strokeStyle = rgba(style.glow, 0.4);
      c.lineWidth = 5;
      capCrackPath(c);
      c.stroke();
      c.strokeStyle = style.glow;
      c.lineWidth = 2;
      capCrackPath(c);
      c.stroke();
    } else if (kind === 'pillar') {
      c.fillStyle = shadeRgba(style.cap, -0.35, 0.8);
      c.fillRect(4, CAP_H - 8, CAP_W - 8, 2);
    }
    return cv;
  }

  /* ── Shared hazard sprites (built once, used by every biome) ── */

  function buildIcicle() {
    const cv = makeCanvas(ICICLE_W, ICICLE_H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, ICICLE_W, 0);
    g.addColorStop(0, '#e8fbff');
    g.addColorStop(0.45, '#9fd8f0');
    g.addColorStop(1, '#4f9ac0');
    c.beginPath();
    c.moveTo(ICICLE_W / 2, ICICLE_H);
    c.lineTo(3, 6);
    c.lineTo(ICICLE_W - 3, 6);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(79,154,192,0.9)';
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(7, 12);
    c.lineTo(ICICLE_W / 2 - 1, ICICLE_H - 12);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(ICICLE_W, 0);
    c.lineTo(ICICLE_W, 6);
    c.lineTo(ICICLE_W * 0.75, 10);
    c.lineTo(ICICLE_W * 0.5, 5);
    c.lineTo(ICICLE_W * 0.25, 11);
    c.lineTo(0, 6);
    c.closePath();
    c.fill();
    return cv;
  }

  function buildBat(frame) {
    const cv = makeCanvas(BAT_W, BAT_H);
    const c = cv.getContext('2d');
    const up = frame === 0;
    const cx = BAT_W / 2;
    const cy = 15;
    c.fillStyle = '#241a32';
    for (let s = -1; s <= 1; s += 2) {
      c.beginPath();
      c.moveTo(cx + s * 5, cy - 2);
      c.quadraticCurveTo(cx + s * 14, cy + (up ? -12 : 10), cx + s * 21, cy + (up ? -10 : 8));
      c.quadraticCurveTo(cx + s * 16, cy + 2, cx + s * 18, cy + 6);
      c.quadraticCurveTo(cx + s * 10, cy + 4, cx + s * 5, cy + 4);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(150,130,190,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cx + s * 6, cy);
      c.lineTo(cx + s * 19, cy + (up ? -8 : 6));
      c.moveTo(cx + s * 6, cy + 2);
      c.lineTo(cx + s * 16, cy + 4);
      c.stroke();
    }
    c.fillStyle = '#2a1e3a';
    c.beginPath();
    c.ellipse(cx, cy + 2, 6, 7, 0, 0, TWO_PI);
    c.fill();
    c.beginPath();
    c.arc(cx, cy - 5, 5.5, 0, TWO_PI);
    c.fill();
    c.beginPath();
    c.moveTo(cx - 5, cy - 8);
    c.lineTo(cx - 3, cy - 13);
    c.lineTo(cx - 1, cy - 8);
    c.moveTo(cx + 5, cy - 8);
    c.lineTo(cx + 3, cy - 13);
    c.lineTo(cx + 1, cy - 8);
    c.fill();
    for (let s = -1; s <= 1; s += 2) {
      const ex = cx + s * 2.5;
      const ey = cy - 5;
      const halo = c.createRadialGradient(ex, ey, 0.5, ex, ey, 4);
      halo.addColorStop(0, 'rgba(255,58,58,0.8)');
      halo.addColorStop(1, 'rgba(255,58,58,0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(ex, ey, 4, 0, TWO_PI);
      c.fill();
      c.fillStyle = '#ff3a3a';
      c.beginPath();
      c.arc(ex, ey, 1.3, 0, TWO_PI);
      c.fill();
    }
    return cv;
  }

  function buildEmitter(lens) {
    const cv = makeCanvas(24, 16);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, '#8a90a0');
    g.addColorStop(0.5, '#5a6070');
    g.addColorStop(1, '#33384a');
    c.fillStyle = g;
    c.fillRect(0, 0, 24, 16);
    c.strokeStyle = '#20242e';
    c.lineWidth = 2;
    c.strokeRect(1, 1, 22, 14);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(3, 2, 18, 2);
    const halo = c.createRadialGradient(12, 8, 1, 12, 8, 7);
    halo.addColorStop(0, lens);
    halo.addColorStop(1, rgba(lens, 0));
    c.fillStyle = halo;
    c.beginPath();
    c.arc(12, 8, 7, 0, TWO_PI);
    c.fill();
    c.fillStyle = lens;
    c.beginPath();
    c.arc(12, 8, 3, 0, TWO_PI);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(11, 7, 1, 0, TWO_PI);
    c.fill();
    return cv;
  }

  /* a ball of fire with a tail: the ball sits at (FIRE_BALL, FIRE_BALL) inside the
   * sprite and the flame tail points DOWN, so the sprite reads for a rising fireball */
  function buildFireball() {
    const cv = makeCanvas(FIRE_W, FIRE_H);
    const c = cv.getContext('2d');
    const bx = FIRE_BALL, by = FIRE_BALL;
    const glow = c.createRadialGradient(bx, by, 4, bx, by, 30);
    glow.addColorStop(0, rgba('#ff7a1a', 0.45));
    glow.addColorStop(1, rgba('#ff7a1a', 0));
    c.fillStyle = glow;
    c.beginPath();
    c.arc(bx, by, 30, 0, TWO_PI);
    c.fill();
    // three overlapping teardrops hanging below the ball, the middle one longest
    const flames = [
      { dx: -8, w: 6, len: 26 },
      { dx: 0, w: 9, len: 40 },
      { dx: 8, w: 6, len: 26 }
    ];
    for (let i = 0; i < flames.length; ++i) {
      const f = flames[i];
      const y0 = by + 8;
      const y1 = y0 + f.len;
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(255,170,60,0.85)');
      g.addColorStop(0.5, 'rgba(255,74,16,0.5)');
      g.addColorStop(1, 'rgba(255,40,10,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(bx + f.dx - f.w, y0);
      c.quadraticCurveTo(bx + f.dx - f.w * 0.45, y0 + f.len * 0.62, bx + f.dx, y1);
      c.quadraticCurveTo(bx + f.dx + f.w * 0.45, y0 + f.len * 0.62, bx + f.dx + f.w, y0);
      c.closePath();
      c.fill();
    }
    const body = c.createRadialGradient(bx, by, 2, bx, by, 17);
    body.addColorStop(0, '#fff6c0');
    body.addColorStop(0.55, '#ffb020');
    body.addColorStop(1, '#ff4a10');
    c.fillStyle = body;
    c.beginPath();
    c.arc(bx, by, 17, 0, TWO_PI);
    c.fill();
    return cv;
  }

  /* ── Coins: eight spin frames, squashed by |cos| ── */

  function starPath(c, cx, cy, ro, ri, points) {
    c.beginPath();
    for (let k = 0; k < points * 2; ++k) {
      const r = (k & 1) ? ri : ro;
      const a = -Math.PI / 2 + k * Math.PI / points;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  }

  function buildCoinFrame(k) {
    const cv = makeCanvas(COIN_SIZE, COIN_SIZE);
    const c = cv.getContext('2d');
    const sx = Math.max(0.15, Math.abs(Math.cos(k * Math.PI / 8)));
    const cx = COIN_SIZE / 2;
    const cy = COIN_SIZE / 2;
    const r = 16;
    const g = c.createRadialGradient(cx - r * 0.3 * sx, cy - r * 0.35, r * 0.15, cx, cy, r);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(0.55, '#ffc21a');
    g.addColorStop(1, '#d48a00');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, r * sx, r, 0, 0, TWO_PI);
    c.fill();
    c.strokeStyle = '#a86800';
    c.lineWidth = 2;
    c.stroke();
    if (sx > 0.45) {
      starPath(c, cx, cy, 8 * sx, 3.4 * sx, 5);
      c.fillStyle = '#e8a800';
      c.fill();
      starPath(c, cx - 0.8, cy - 0.8, 8 * sx, 3.4 * sx, 5);
      c.strokeStyle = 'rgba(255,240,170,0.9)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    c.arc(cx - r * 0.45 * sx, cy - r * 0.5, 2.2, 0, TWO_PI);
    c.fill();
    return cv;
  }

  /* ── Power-up bubbles: translucent sphere + icon ── */

  function drawBubbleIcon(c, kind, tint) {
    const cx = BUBBLE_SIZE / 2;
    const cy = BUBBLE_SIZE / 2;
    if (kind === 'shield') {
      c.fillStyle = tint;
      c.beginPath();
      c.moveTo(cx - 12, cy - 14);
      c.lineTo(cx + 12, cy - 14);
      c.lineTo(cx + 12, cy + 2);
      c.quadraticCurveTo(cx + 12, cy + 12, cx, cy + 16);
      c.quadraticCurveTo(cx - 12, cy + 12, cx - 12, cy + 2);
      c.closePath();
      c.fill();
      c.strokeStyle = shade(tint, -0.4);
      c.lineWidth = 2;
      c.stroke();
      starPath(c, cx, cy - 1, 7, 3, 5);
      c.fillStyle = '#ffffff';
      c.fill();
    } else if (kind === 'magnet') {
      c.strokeStyle = tint;
      c.lineWidth = 7;
      c.beginPath();
      c.arc(cx, cy - 2, 10, Math.PI, TWO_PI);
      c.stroke();
      c.beginPath();
      c.moveTo(cx - 10, cy - 2);
      c.lineTo(cx - 10, cy + 10);
      c.moveTo(cx + 10, cy - 2);
      c.lineTo(cx + 10, cy + 10);
      c.stroke();
      c.strokeStyle = '#c8ccd8';
      c.beginPath();
      c.moveTo(cx - 10, cy + 10);
      c.lineTo(cx - 10, cy + 14);
      c.moveTo(cx + 10, cy + 10);
      c.lineTo(cx + 10, cy + 14);
      c.stroke();
    } else if (kind === 'slow') {
      c.fillStyle = '#f4f8ff';
      c.beginPath();
      c.arc(cx, cy, 13, 0, TWO_PI);
      c.fill();
      c.strokeStyle = tint;
      c.lineWidth = 3;
      c.stroke();
      c.strokeStyle = '#3a2a5a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx, cy - 8);
      c.moveTo(cx, cy);
      c.lineTo(cx + 6, cy + 3);
      c.stroke();
    } else if (kind === 'ghost') {
      c.fillStyle = tint;
      c.beginPath();
      c.arc(cx, cy - 2, 11, Math.PI, TWO_PI);
      c.lineTo(cx + 11, cy + 10);
      c.lineTo(cx + 6, cy + 5);
      c.lineTo(cx + 2, cy + 10);
      c.lineTo(cx - 2, cy + 5);
      c.lineTo(cx - 6, cy + 10);
      c.lineTo(cx - 11, cy + 5);
      c.closePath();
      c.fill();
      c.fillStyle = '#2a3a4a';
      c.beginPath();
      c.arc(cx - 4, cy - 3, 2, 0, TWO_PI);
      c.arc(cx + 4, cy - 3, 2, 0, TWO_PI);
      c.fill();
    } else if (kind === 'double') {
      c.font = 'bold 24px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 4;
      c.strokeStyle = '#5a3a00';
      c.strokeText('x2', cx, cy + 1);
      c.fillStyle = tint;
      c.fillText('x2', cx, cy + 1);
    } else { /* tiny */
      c.fillStyle = tint;
      c.beginPath();
      c.ellipse(cx, cy, 9, 7, 0, 0, TWO_PI);
      c.fill();
      c.beginPath();
      c.moveTo(cx + 6, cy - 2);
      c.lineTo(cx + 14, cy - 6);
      c.lineTo(cx + 8, cy + 2);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(cx - 9, cy - 1);
      c.lineTo(cx - 15, cy - 4);
      c.lineTo(cx - 15, cy + 2);
      c.closePath();
      c.fill();
      c.strokeStyle = '#1e5a2a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx - 14, cy + 10);
      c.lineTo(cx - 8, cy + 6);
      c.lineTo(cx - 11, cy + 5);
      c.moveTo(cx - 8, cy + 6);
      c.lineTo(cx - 9, cy + 9);
      c.moveTo(cx + 14, cy + 10);
      c.lineTo(cx + 8, cy + 6);
      c.lineTo(cx + 11, cy + 5);
      c.moveTo(cx + 8, cy + 6);
      c.lineTo(cx + 9, cy + 9);
      c.stroke();
    }
  }

  function buildBubble(kind) {
    const cv = makeCanvas(BUBBLE_SIZE, BUBBLE_SIZE);
    const c = cv.getContext('2d');
    const tint = BUBBLE_TINTS[kind];
    const cx = BUBBLE_SIZE / 2;
    const cy = BUBBLE_SIZE / 2;
    const r = 28;
    const g = c.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, rgba(tint, 0.25));
    g.addColorStop(1, rgba(tint, 0.6));
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, TWO_PI);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, r - 6, Math.PI * 1.05, Math.PI * 1.45);
    c.stroke();
    drawBubbleIcon(c, kind, tint);
    return cv;
  }

  /* built on first use, then shared by every biome's draw functions */
  let shared = null;

  function getShared() {
    if (shared) return shared;
    const coins = [];
    for (let k = 0; k < 8; ++k) coins.push(buildCoinFrame(k));
    const bubbles = {};
    for (const kind in BUBBLE_TINTS) bubbles[kind] = buildBubble(kind);
    shared = {
      icicle: buildIcicle(),
      bats: [buildBat(0), buildBat(1)],
      emitters: [buildEmitter('#ff3a3a'), buildEmitter('#3af2ff')],
      fireball: buildFireball(),
      coins: coins,
      bubbles: bubbles
    };
    return shared;
  }

  /* ── Per-biome cache set + the cheap per-frame draw functions ── */

  function beamLine(c, x, y1, y2) {
    c.beginPath();
    c.moveTo(x, y1);
    c.lineTo(x, y2);
    c.stroke();
  }

  /* hazards receive screen coordinates already computed by the game */
  function drawHazard(c, hz, t) {
    const sh = getShared();
    if (hz.type === 'gust') {
      const dir = hz.dir >= 0 ? 1 : -1;
      const w = Math.max(40, hz.w);
      const strength = hz.strength === undefined ? 0.6 : hz.strength;
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 7; ++i) {
        const len = 60 + (i * 37) % 61;
        const x = hz.sx + 6 + (i * 97) % Math.max(1, w - len - 14);
        const phase = (t * 220 + i * 97) % 580;
        const y = (dir > 0 ? 40 : 620) + dir * phase;
        c.lineWidth = 1.5 + strength * 1.5 + (i % 2);
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + len * 0.5, y + dir * 12, x + len, y);
        c.stroke();
        const ax = x + len + 4;
        c.beginPath();
        c.moveTo(ax - 5, y - dir * 5);
        c.lineTo(ax, y + dir * 2);
        c.lineTo(ax + 5, y - dir * 5);
        c.stroke();
      }
    } else if (hz.type === 'icicle') {
      const len = Math.max(20, hz.len);
      c.drawImage(sh.icicle, 0, 0, ICICLE_W, ICICLE_H, hz.sx - ICICLE_W / 2, hz.sy - len, ICICLE_W, len);
    } else if (hz.type === 'bat') {
      let f = hz.frame === undefined ? Math.floor(t * 8) % 2 : hz.frame;
      f = ((f % 2) + 2) % 2;
      c.drawImage(sh.bats[f], hz.sx - BAT_W / 2, hz.sy - BAT_H / 2);
    } else if (hz.type === 'laser') {
      const bx = hz.sx + 36;
      c.drawImage(sh.emitters[0], bx - 12, hz.y1 - 8);
      c.drawImage(sh.emitters[1], bx - 12, hz.y2 - 8);
      if (hz.on) {
        c.strokeStyle = rgba('#ff2a6a', 0.25);
        c.lineWidth = 10;
        beamLine(c, bx, hz.y1, hz.y2);
        c.strokeStyle = rgba('#ff2a6a', 0.6);
        c.lineWidth = 5;
        beamLine(c, bx, hz.y1, hz.y2);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        beamLine(c, bx, hz.y1, hz.y2);
      } else if (hz.warn) {
        c.strokeStyle = rgba('#ff2a6a', 0.5 + 0.5 * Math.sin(t * 30));
        c.lineWidth = 2;
        c.setLineDash([6, 8]);
        beamLine(c, bx, hz.y1, hz.y2);
        c.setLineDash([]);
      }
    } else if (hz.type === 'fireball') {
      // the sprite is blitted centred on the ball; a falling one hangs upside down
      c.save();
      c.translate(hz.sx, hz.sy);
      if (hz.vy > 0)
        c.rotate(Math.PI);
      c.drawImage(sh.fireball, -FIRE_BALL, -FIRE_BALL);
      c.restore();
      // two sparks flicker around the ball
      c.fillStyle = '#ffd23f';
      for (let k = 0; k < 2; ++k) {
        const px = hz.sx + (k === 0 ? -1 : 1) * (16 + 5 * Math.sin(t * 20 + k * 2.1));
        const py = hz.sy - 8 + 12 * Math.sin(t * 13 + k * 1.7);
        c.beginPath();
        c.arc(px, py, 2, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  function drawCoin(c, x, y, t) {
    const sh = getShared();
    let f = Math.floor(t * 12) % 8;
    if (f < 0) f += 8;
    c.drawImage(sh.coins[f], x - COIN_SIZE / 2, y - COIN_SIZE / 2);
  }

  function drawBubble(c, kind, x, y, t) {
    const sh = getShared();
    const img = sh.bubbles[kind] || sh.bubbles.shield;
    const s = 1 + 0.04 * Math.sin(t * 5);
    const w = BUBBLE_SIZE * s;
    c.drawImage(img, x - w / 2, y + Math.sin(t * 3) * 4 - w / 2, w, w);
  }

  /* the logical area a draw call has to cover — the game area unless the caller
   * hands in the rect the canvas shows (wider or taller than 16:9) */
  function fullView(view) {
    return view || { x0: 0, y0: 0, x1: SCREEN_W, y1: SCREEN_H };
  }

  function create(biomeId) {
    const biome = THEMES[biomeId] ? biomeId : 'meadow';
    const theme = THEMES[biome];
    const gateStyle = GATE_STYLES[biome];
    const rng = mulberry32(0x9e37 + 2654435761 * (BIOMES.indexOf(biome) + 1));

    const sky = buildSky(theme, rng);
    const far = buildFar(biome, theme, rng);
    const mid = buildMid(biome, theme, rng);
    const near = buildNear(biome, theme, rng);
    const ground = buildGround(biome, theme, rng);
    const gateBody = buildGateBody(gateStyle, rng);
    const gateCap = buildGateCap(gateStyle, rng);

    const clouds = [];
    for (let i = 0; i < 5; ++i) clouds.push(buildCloud(theme, rng));

    const placement = [];
    for (let i = 0; i < 7; ++i) {
      placement.push({
        sprite: clouds[Math.floor(rng() * clouds.length)],
        x: rng() * CLOUD_LOOP,
        y: 40 + rng() * 220,
        scale: 0.6 + rng() * 0.6
      });
    }

    /* the sky image, plus its outermost columns and rows stretched over the
     * bars a non-16:9 canvas shows; below the game area the ground continues */
    function drawSky(c, view) {
      const v = fullView(view);
      c.drawImage(sky, 0, 0);
      if (v.x0 < 0) c.drawImage(sky, 0, 0, 1, SCREEN_H, v.x0, 0, -v.x0, SCREEN_H);
      if (v.x1 > SCREEN_W) c.drawImage(sky, SCREEN_W - 1, 0, 1, SCREEN_H, SCREEN_W, 0, v.x1 - SCREEN_W, SCREEN_H);
      if (v.y0 < 0) c.drawImage(sky, 0, 0, SCREEN_W, 1, v.x0, v.y0, v.x1 - v.x0, -v.y0);
    }

    function drawStrip(c, img, height, scroll, v) {
      let x = -(scroll % PERIOD);
      while (x > v.x0) x -= PERIOD;
      for (; x < v.x1; x += PERIOD)
        c.drawImage(img, x, GROUND_Y - height);
    }

    function drawBackdrop(c, dist, t, view) {
      const v = fullView(view);
      for (let i = 0; i < placement.length; ++i) {
        const p = placement[i];
        const w = CLOUD_W * p.scale;
        const h = CLOUD_H * p.scale;
        const x = ((p.x - dist * 0.06) % CLOUD_LOOP + CLOUD_LOOP) % CLOUD_LOOP;
        if (x < v.x1) c.drawImage(p.sprite, x, p.y, w, h);
        else if (x - CLOUD_LOOP + w > v.x0) c.drawImage(p.sprite, x - CLOUD_LOOP, p.y, w, h);
      }
      drawStrip(c, far, FAR_H, dist * 0.15, v);
      drawStrip(c, mid, MID_H, dist * 0.35, v);
      drawStrip(c, near, NEAR_H, dist * 0.6, v);
    }

    function drawGround(c, dist, view) {
      const v = fullView(view);
      let x = -(dist % GROUND_TILE);
      while (x > v.x0) x -= GROUND_TILE;
      for (; x < v.x1; x += GROUND_TILE)
        c.drawImage(ground, x, GROUND_Y);
      if (v.y1 > SCREEN_H) {
        c.fillStyle = theme.groundDark;
        c.fillRect(v.x0, SCREEN_H, v.x1 - v.x0, v.y1 - SCREEN_H);
      }
    }

    /* the body tile is blitted per 128 px; the last one is clipped by the
     * 9-argument drawImage so no tile edge shows at the cap or the ground */
    function tileBody(c, x, y0, y1) {
      let y = y0;
      while (y < y1) {
        const h = Math.min(GATE_TILE, y1 - y);
        if (h === GATE_TILE) c.drawImage(gateBody, x, y);
        else c.drawImage(gateBody, 0, 0, GATE_W, h, x, y, GATE_W, h);
        y += h;
      }
    }

    function drawGate(c, x, topBottom, botTop) {
      const capTopY = topBottom - CAP_H;
      tileBody(c, x, 0, capTopY);
      c.drawImage(gateCap, x - 8, capTopY);
      c.drawImage(gateCap, x - 8, botTop);
      tileBody(c, x, botTop + CAP_H, GROUND_Y);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(x - 8, topBottom - 2, CAP_W, 2);
      c.fillRect(x - 8, botTop, CAP_W, 2);
    }

    return Object.freeze({
      theme: theme,
      gateStyle: gateStyle,
      drawSky: drawSky,
      drawBackdrop: drawBackdrop,
      drawGround: drawGround,
      drawGate: drawGate,
      drawHazard: drawHazard,
      drawCoin: drawCoin,
      drawBubble: drawBubble
    });
  }

  SZ.FlappySceneArt = Object.freeze({ THEMES: THEMES, create: create });
})();
