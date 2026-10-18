;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const PARTS = SZ.FlappySceneParts || (SZ.FlappySceneParts = {});

  /* Shared pieces of the biome scenery: sizes, THEMES, GATE_STYLES and BUBBLE_TINTS,
     colour helpers, the seeded RNG, seamless silhouette profiles and strip painting. */


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

  PARTS.kit = {
    TWO_PI, SCREEN_W, SCREEN_H, GROUND_Y, GROUND_H, GROUND_TILE, PERIOD, FAR_H, MID_H, NEAR_H, CLOUD_W,
    CLOUD_H, CLOUD_LOOP, GATE_W, GATE_TILE, CAP_W, CAP_H, ICICLE_W, ICICLE_H, BAT_W, BAT_H, FIRE_W, FIRE_H,
    FIRE_BALL, COIN_SIZE, BUBBLE_SIZE, BIOMES, THEMES, GATE_STYLES, BUBBLE_TINTS, rgba, shade, shadeRgba,
    makeCanvas, mulberry32, waveTop, blockTop, makeBlocks, coneTop, wrapX, traceProfile, paintStrip,
    crestBand, triangle
  };
})();
