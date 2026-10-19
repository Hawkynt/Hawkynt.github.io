;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Scene art for the Fantasy Puzzle: five painterly realm backdrops, the four
   * element icons and eight spell effects.
   *
   * Every backdrop is painted ONCE into an opaque 1280 x 720 canvas with a
   * seeded rng, so a realm looks the same on every visit. A frame then costs one
   * blit -- that backdrop scaled up to cover whatever the canvas shows, the same
   * math the sister game's sky uses -- plus an ambient layer of tiny fillRects
   * and small cached sprites. No gradient, no blur and no full-screen
   * transparent image is produced per frame.
   *
   * The board sits in the left and centre of the logical screen (about x 40..880)
   * so the detailed scenery of every realm lives at the edges and on the right:
   * a temple, a crystal seam, stone arches, a waterfall island and the elemental
   * pillars. The middle stays a calm sky or haze the tiles can rest on.
   *
   * The element icons come as two cached 128 x 128 variants each (resting and
   * lit), the spell effects as cached 8-frame strips: an icon or a spell is one
   * drawImage and nothing else.
   */

  const W = 1280, H = 720;
  const TWO_PI = Math.PI * 2;
  const HALF_PI = Math.PI / 2;
  /* what draw() covers when the caller does not say: exactly the logical screen */
  const FULL_VIEW = Object.freeze({ x0: 0, y0: 0, x1: W, y1: H });
  const SPRITE = 128;
  const SPELL_FRAMES = 8;

  const REALM_SCENES = Object.freeze({
    0: Object.freeze({ name: 'Ember Grove', sky: '#8e3b34', accent: '#ffb36a', glow: '#ff7a3a' }),
    1: Object.freeze({ name: 'Tide Caverns', sky: '#14556a', accent: '#8ae0ff', glow: '#3ab4ff' }),
    2: Object.freeze({ name: 'Stone Peaks', sky: '#7fa8cc', accent: '#ffe0a0', glow: '#c9a36a' }),
    3: Object.freeze({ name: 'Sky Ruins', sky: '#79b4e4', accent: '#e8f8ff', glow: '#7ad0ff' }),
    4: Object.freeze({ name: 'Elemental Sanctum', sky: '#1c0c34', accent: '#e0a8ff', glow: '#c04cff' })
  });
  const REALM_COUNT = 5;

  const ELEMENT_COLORS = {
    fire: { core: '#7a1e0c', mid: '#ff7a3a', glow: '#ffb36a', mark: '#ffe6b8' },
    water: { core: '#0e3a68', mid: '#3ab4ff', glow: '#8ae0ff', mark: '#e2f6ff' },
    earth: { core: '#33240f', mid: '#8a6a3a', glow: '#c9a36a', mark: '#ffe0a8' },
    air: { core: '#2a4a68', mid: '#8fc8ee', glow: '#eaf8ff', mark: '#ffffff' }
  };
  const ELEMENT_NAMES = ['fire', 'water', 'earth', 'air'];

  const SPELL_KINDS = ['fireBurst', 'iceMelt', 'waterSplash', 'earthRise',
    'chasmFill', 'windGust', 'runeCollect', 'portalOpen'];

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

  function channel(v) {
    const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length < 2 ? '0' + s : s;
  }

  /* f in [-1, 1]: negative darkens toward black, positive lightens toward white */
  function shade(hex, f) {
    const c = hexToRgb(hex);
    const target = f < 0 ? 0 : 255;
    const k = Math.min(1, Math.abs(f));
    return '#' + channel(c.r + (target - c.r) * k) + channel(c.g + (target - c.g) * k) + channel(c.b + (target - c.b) * k);
  }

  function rgba(hex, a) {
    const c = hexToRgb(hex);
    const k = Math.max(0, Math.min(1, a));
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + k + ')';
  }

  /* ── small building blocks ── */

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return cv;
  }

  /* mulberry32: the same seeded rng the tile art uses */
  function mulberry32(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rr(rng, lo, hi) {
    return lo + (hi - lo) * rng();
  }

  function mod(a, n) {
    return ((a % n) + n) % n;
  }

  /* smooth value noise over [0, n], used for ridge lines and nebula edges */
  function valueNoise(rng, n) {
    const v = [];
    for (let i = 0; i <= n + 2; ++i) v.push(rng());
    return function(x) {
      const i = Math.max(0, Math.min(n + 1, Math.floor(x)));
      const f = x - i;
      const s = (1 - Math.cos(Math.max(0, Math.min(1, f)) * Math.PI)) / 2;
      return v[i] + (v[i + 1] - v[i]) * s;
    };
  }

  function fillBand(sc, x0, y0, x1, y1, stops) {
    const g = sc.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; ++i) g.addColorStop(stops[i][0], stops[i][1]);
    sc.fillStyle = g;
    sc.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  /* soft round glow fading to nothing: the workhorse of every light source */
  function glowDot(sc, x, y, r, color, alpha) {
    const g = sc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(0.45, rgba(color, alpha * 0.42));
    g.addColorStop(1, rgba(color, 0));
    sc.fillStyle = g;
    sc.beginPath();
    sc.arc(x, y, r, 0, TWO_PI);
    sc.fill();
  }

  function polyPath(sc, pts) {
    sc.beginPath();
    for (let i = 0; i < pts.length; ++i) {
      if (i === 0) sc.moveTo(pts[i][0], pts[i][1]);
      else sc.lineTo(pts[i][0], pts[i][1]);
    }
    sc.closePath();
  }

  function roundRectPath(sc, x, y, w, h, r) {
    const k = Math.min(r, w / 2, h / 2);
    sc.beginPath();
    sc.moveTo(x + k, y);
    sc.lineTo(x + w - k, y);
    sc.arcTo(x + w, y, x + w, y + k, k);
    sc.lineTo(x + w, y + h - k);
    sc.arcTo(x + w, y + h, x + w - k, y + h, k);
    sc.lineTo(x + k, y + h);
    sc.arcTo(x, y + h, x, y + h - k, k);
    sc.lineTo(x, y + k);
    sc.arcTo(x, y, x + k, y, k);
    sc.closePath();
  }

  /* a cloud or foliage mass: overlapping arcs, lighter on top than below */
  function puffMass(sc, rng, cx, cy, rx, ry, color, alpha, lobes) {
    for (let i = 0; i < lobes; ++i) {
      const a = rng() * TWO_PI;
      const d = Math.pow(rng(), 0.62);
      const x = cx + Math.cos(a) * rx * d;
      const y = cy + Math.sin(a) * ry * d * 0.72;
      const r = ry * (0.5 + rng() * 0.62);
      const lift = 1 - (y - (cy - ry)) / (2 * ry);
      sc.fillStyle = rgba(shade(color, lift * 0.22), alpha * (0.55 + rng() * 0.45));
      sc.beginPath();
      sc.arc(x, y, r, 0, TWO_PI);
      sc.fill();
    }
  }

  /* a ridge line sampled every 12 px: two octaves of noise plus optional grit */
  function ridgePoints(rng, x0, x1, topY, baseY, wave, grit) {
    const step = 12;
    const span = Math.ceil((x1 - x0) / step);
    const n1 = Math.ceil(span * step / wave) + 2;
    const n2 = Math.ceil(span * step / (wave * 0.34)) + 2;
    const nz1 = valueNoise(rng, n1);
    const nz2 = valueNoise(rng, n2);
    const pts = [];
    for (let i = 0; i <= span; ++i) {
      const x = x0 + i * step;
      const u = i * step;
      const k = 0.66 * nz1(u / wave) + 0.34 * nz2(u / (wave * 0.34));
      pts.push(x, baseY - (baseY - topY) * (0.22 + 0.78 * k) + (grit ? (rng() - 0.5) * grit : 0));
    }
    return pts;
  }

  function fillRidge(sc, pts, x0, x1, color) {
    sc.fillStyle = color;
    sc.beginPath();
    sc.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) sc.lineTo(pts[i], pts[i + 1]);
    sc.lineTo(x1, H + 8);
    sc.lineTo(x0, H + 8);
    sc.closePath();
    sc.fill();
  }

  function strokeRidge(sc, pts, color, width) {
    sc.strokeStyle = color;
    sc.lineWidth = width;
    sc.beginPath();
    sc.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) sc.lineTo(pts[i], pts[i + 1]);
    sc.stroke();
  }

  /* snow or light riding the crest of a ridge, only above the snow line */
  function crestLight(sc, pts, snowLine, color, width) {
    sc.strokeStyle = color;
    sc.lineWidth = width;
    let open = false;
    sc.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      if (pts[i + 1] < snowLine) {
        if (!open) { sc.moveTo(pts[i], pts[i + 1]); open = true; }
        else sc.lineTo(pts[i], pts[i + 1]);
      } else open = false;
    }
    sc.stroke();
  }

  /* a cloud band with two sine-curved edges */
  function wavyBand(sc, x0, x1, yTop, yBot, amp, freq, phase, color) {
    sc.fillStyle = color;
    sc.beginPath();
    sc.moveTo(x0, yTop + Math.sin(x0 * freq + phase) * amp);
    for (let x = x0 + 24; x <= x1; x += 24) sc.lineTo(x, yTop + Math.sin(x * freq + phase) * amp);
    for (let x = x1; x >= x0; x -= 24) sc.lineTo(x, yBot + Math.sin(x * freq * 0.7 + phase + 1.7) * amp);
    sc.closePath();
    sc.fill();
  }

  function starField(sc, rng, n, colors, y0, y1, alphaMax) {
    for (let i = 0; i < n; ++i) {
      const x = Math.floor(rng() * W);
      const y = Math.floor(rr(rng, y0, y1));
      const s = rng() < 0.86 ? 1 : 2;
      sc.fillStyle = rgba(colors[Math.floor(rng() * colors.length)], 0.16 + rng() * alphaMax);
      sc.fillRect(x, y, s, s);
    }
  }

  /* ── realm 0: Ember Grove, an autumn forest temple at dusk ── */

  function groveTree(sc, rng, x, baseY, h, w) {
    const trunk = '#150c14';
    const tw = 6.5 * w;
    sc.strokeStyle = trunk;
    sc.lineWidth = tw;
    sc.beginPath();
    sc.moveTo(x, baseY);
    sc.quadraticCurveTo(x + tw * 0.7, baseY - h * 0.55, x + tw * 0.2, baseY - h);
    sc.stroke();
    sc.lineWidth = Math.max(1.4, tw * 0.3);
    for (let b = 0; b < 4; ++b) {
      const by = baseY - h * (0.44 + b * 0.15);
      const dir = b % 2 ? 1 : -1;
      const bl = rr(rng, 26, 62) * w;
      sc.beginPath();
      sc.moveTo(x + tw * 0.3, by);
      sc.quadraticCurveTo(x + dir * bl * 0.62, by - 11 * w, x + dir * bl, by - 27 * w);
      sc.stroke();
    }
    const cy = baseY - h - 4 * w;
    for (let i = 0; i < 10; ++i) {
      sc.fillStyle = rgba(i % 3 ? '#571f14' : '#8a3418', 0.92);
      sc.beginPath();
      sc.arc(x + rr(rng, -46, 46) * w, cy + rr(rng, -30, 26) * w, rr(rng, 15, 33) * w, 0, TWO_PI);
      sc.fill();
    }
    /* the leaves on the sun side catch the last light */
    for (let i = 0; i < 6; ++i) {
      sc.fillStyle = rgba(i % 2 ? '#c8622a' : '#e8973a', 0.5);
      sc.beginPath();
      sc.arc(x + rr(rng, -26, 44) * w, cy + rr(rng, -22, 16) * w, rr(rng, 6, 14) * w, 0, TWO_PI);
      sc.fill();
    }
  }

  function groveLantern(sc, x, y) {
    glowDot(sc, x, y, 36, '#ffb36a', 0.5);
    sc.strokeStyle = rgba('#150c14', 0.85);
    sc.lineWidth = 1.5;
    sc.beginPath();
    sc.moveTo(x, y - 30);
    sc.lineTo(x, y - 9);
    sc.stroke();
    sc.fillStyle = '#2a1a18';
    roundRectPath(sc, x - 7, y - 9, 14, 18, 3);
    sc.fill();
    sc.fillStyle = '#ffd9a2';
    sc.fillRect(x - 4, y - 6, 8, 12);
    sc.fillStyle = '#fff4d4';
    sc.fillRect(x - 2, y - 4, 4, 8);
    sc.fillStyle = '#2a1a18';
    sc.fillRect(x - 9, y - 12, 18, 3);
    sc.fillRect(x - 6, y + 9, 12, 2);
  }

  function groveTemple(sc, rng) {
    const bx = 1082, base = 604;
    glowDot(sc, bx, base - 96, 210, '#ffb36a', 0.22);
    /* the stair up to the porch */
    for (let i = 0; i < 6; ++i) {
      sc.fillStyle = i % 2 ? '#2c1c26' : '#3a2630';
      sc.fillRect(bx - 78 + i * 6, base - i * 9, 156 - i * 12, 9);
    }
    const tiers = [[124, 66], [96, 56], [64, 46]];
    let y = base - 54;
    for (let i = 0; i < tiers.length; ++i) {
      const tw = tiers[i][0], th = tiers[i][1];
      sc.fillStyle = '#1d1122';
      sc.fillRect(bx - tw / 2, y - th, tw, th);
      /* lit windows and, on the lowest tier, an open door */
      const cols = i === 0 ? 3 : 2;
      for (let c = 0; c < cols; ++c) {
        const wx = bx - tw / 2 + (c + 0.5) * (tw / cols) - 8;
        const wy = y - th + 16;
        glowDot(sc, wx + 8, wy + 14, 34, '#ffb36a', 0.42);
        sc.fillStyle = '#ffc878';
        sc.fillRect(wx, wy, 16, 28);
        sc.fillStyle = '#fff0c0';
        sc.fillRect(wx + 3, wy + 4, 10, 20);
        sc.fillStyle = '#1d1122';
        sc.fillRect(wx + 7, wy, 2, 28);
      }
      /* a curved roof with lifted eaves */
      const ry = y - th;
      const over = tw / 2 + 30 - i * 4;
      polyPath(sc, [[bx - over, ry + 2], [bx - over * 0.55, ry - 12], [bx, ry - 26 - i * 5],
        [bx + over * 0.55, ry - 12], [bx + over, ry + 2]]);
      sc.fillStyle = '#2a1a2e';
      sc.fill();
      sc.strokeStyle = rgba('#ff9a4a', 0.3);
      sc.lineWidth = 1.6;
      sc.stroke();
      sc.fillStyle = '#2a1a2e';
      sc.fillRect(bx - 3, ry - 34 - i * 5, 6, 12);
      y = ry - 24 - i * 5;
    }
    /* hanging bell under the top eave */
    sc.fillStyle = '#c9a36a';
    sc.beginPath();
    sc.arc(bx, y + 26, 7, 0, TWO_PI);
    sc.fill();
  }

  function paintEmberGrove(sc, rng) {
    fillBand(sc, 0, 0, 0, H, [
      [0, '#170f2b'], [0.24, '#3d2049'], [0.48, '#8e3b34'],
      [0.66, '#d4692f'], [0.8, '#ffab5c'], [1, '#ffd9a2']
    ]);
    /* the low sun above the western ridge */
    glowDot(sc, 1058, 546, 340, '#ff9a4a', 0.4);
    glowDot(sc, 1058, 546, 150, '#ffd9a2', 0.58);
    sc.fillStyle = '#fff2cf';
    sc.beginPath();
    sc.arc(1058, 546, 26, 0, TWO_PI);
    sc.fill();
    /* stretched dusk cloud bands */
    for (let i = 0; i < 9; ++i) {
      const y = 236 + i * 30 + rr(rng, -10, 10);
      wavyBand(sc, -40, W + 40, y, y + rr(rng, 4, 12), rr(rng, 3, 9), 0.009 + rng() * 0.007,
        rng() * TWO_PI, rgba(i % 3 === 0 ? '#ffd9a2' : '#b8552e', 0.12 + rng() * 0.16));
    }
    /* two mountain ranges, the near one rim-lit by the sun */
    const far = ridgePoints(rng, -40, W + 40, 366, 470, 210, 9);
    fillRidge(sc, far, -40, W + 40, '#5c3a58');
    strokeRidge(sc, far, rgba('#c8735a', 0.32), 2);
    const near = ridgePoints(rng, -40, W + 40, 424, 556, 150, 15);
    fillRidge(sc, near, -40, W + 40, '#33203a');
    strokeRidge(sc, near, rgba('#ff9a4a', 0.28), 2.5);
    /* valley haze so the ranges do not stack like cut paper */
    fillBand(sc, 0, 496, 0, 626, [
      [0, rgba('#ff9a4a', 0)], [0.5, rgba('#ffb45e', 0.2)], [1, rgba('#ff8a3a', 0)]
    ]);
    groveTemple(sc, rng);
    /* the forest floor and the path leading to the temple */
    fillBand(sc, 0, 592, 0, H, [[0, '#3a2417'], [1, '#150d0b']]);
    polyPath(sc, [[286, H], [556, 664], [1006, 606], [1152, 606], [700, 692], [612, H]]);
    sc.fillStyle = rgba('#7a5230', 0.45);
    sc.fill();
    /* thin trunks across the middle, they stay quiet behind the board */
    for (let i = 0; i < 9; ++i)
      groveTree(sc, rng, 62 + i * 96 + rr(rng, -20, 20), 646, rr(rng, 200, 296), 0.5 + rng() * 0.22);
    for (let i = 0; i < 7; ++i)
      groveLantern(sc, 96 + i * 118 + rr(rng, -28, 28), rr(rng, 300, 428));
    /* grass tufts and windfalls */
    sc.strokeStyle = rgba('#241608', 0.7);
    sc.lineWidth = 1.4;
    for (let i = 0; i < 150; ++i) {
      const x = rng() * W, y = rr(rng, 612, H);
      sc.beginPath();
      sc.moveTo(x, y);
      sc.lineTo(x + rr(rng, -4, 4), y - rr(rng, 5, 14));
      sc.stroke();
    }
    for (let i = 0; i < 70; ++i) {
      sc.fillStyle = rgba(i % 3 ? '#a8481f' : '#e08a3a', 0.4);
      sc.beginPath();
      sc.ellipse(rng() * W, rr(rng, 604, H), rr(rng, 2, 5), rr(rng, 1, 2.4), rng() * Math.PI, 0, TWO_PI);
      sc.fill();
    }
    /* framing: heavy trunks at both edges and leaves in the corners */
    groveTree(sc, rng, 22, 728, 566, 1.5);
    groveTree(sc, rng, 1262, 728, 604, 1.6);
    puffMass(sc, rng, 120, 40, 190, 74, '#4a1c14', 0.85, 16);
    puffMass(sc, rng, 1160, 30, 210, 66, '#4a1c14', 0.8, 14);
    for (let i = 0; i < 26; ++i) {
      sc.fillStyle = rgba(i % 2 ? '#c8622a' : '#e8973a', 0.4);
      sc.beginPath();
      sc.arc(rr(rng, 20, 260), rr(rng, 10, 96), rr(rng, 4, 11), 0, TWO_PI);
      sc.fill();
    }
  }

  /* ── realm 1: Tide Caverns, a cave lit from the water above ── */

  function crystalCluster(sc, rng, x, baseY, scale, color, glowColor) {
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; ++i) {
      const h = rr(rng, 42, 128) * scale;
      const w = rr(rng, 7, 19) * scale;
      const cx = x + rr(rng, -30, 30) * scale;
      const lean = rr(rng, -0.3, 0.3);
      const tipX = cx + Math.sin(lean) * h;
      const tipY = baseY - Math.cos(lean) * h;
      glowDot(sc, tipX, tipY, 34 * scale, glowColor, 0.3);
      const g = sc.createLinearGradient(cx - w, baseY, cx + w * 0.4, tipY);
      g.addColorStop(0, rgba(shade(color, -0.6), 0.92));
      g.addColorStop(0.55, rgba(color, 0.85));
      g.addColorStop(1, rgba(shade(color, 0.55), 0.95));
      polyPath(sc, [[cx - w, baseY], [cx - w * 0.34, tipY + h * 0.2], [tipX, tipY],
        [cx + w * 0.46, tipY + h * 0.24], [cx + w, baseY]]);
      sc.fillStyle = g;
      sc.fill();
      sc.strokeStyle = rgba(shade(color, 0.75), 0.6);
      sc.lineWidth = 1.3;
      sc.beginPath();
      sc.moveTo(tipX, tipY);
      sc.lineTo(cx - w * 0.34, tipY + h * 0.2);
      sc.stroke();
    }
  }

  function caveRock(sc, rng, x0, x1, topY, baseY, color, wave) {
    const pts = ridgePoints(rng, x0, x1, topY, baseY, wave, 22);
    fillRidge(sc, pts, x0, x1, color);
    return pts;
  }

  function paintTideCaverns(sc, rng) {
    fillBand(sc, 0, 0, 0, H, [
      [0, '#3f93a8'], [0.22, '#1c6274'], [0.5, '#0b3a4c'], [0.78, '#06222f'], [1, '#03121a']
    ]);
    /* the surface seen through the cave mouth, a shimmering bright cap */
    glowDot(sc, 620, -70, 460, '#bff0ff', 0.34);
    for (let i = 0; i < 12; ++i) {
      sc.fillStyle = rgba('#e6fbff', 0.06 + rng() * 0.1);
      sc.beginPath();
      sc.ellipse(rr(rng, 120, 1140), rr(rng, -10, 60), rr(rng, 40, 150), rr(rng, 3, 9), 0, 0, TWO_PI);
      sc.fill();
    }
    /* light shafts slanting down through the water */
    for (let i = 0; i < 6; ++i) {
      const x = 90 + i * 200 + rr(rng, -50, 50);
      const topW = rr(rng, 26, 58), botW = topW * rr(rng, 2.2, 3.6);
      const drift = rr(rng, 90, 230) * (i % 2 ? 1 : -1);
      const reach = rr(rng, 470, 660);
      const g = sc.createLinearGradient(x, 0, x + drift, reach);
      g.addColorStop(0, rgba('#cff4ff', 0.24));
      g.addColorStop(0.55, rgba('#8ae0ff', 0.1));
      g.addColorStop(1, rgba('#8ae0ff', 0));
      polyPath(sc, [[x - topW / 2, -20], [x + topW / 2, -20],
        [x + drift + botW / 2, reach], [x + drift - botW / 2, reach]]);
      sc.fillStyle = g;
      sc.fill();
    }
    /* the far wall and the ceiling of the cave */
    caveRock(sc, rng, -40, W + 40, 300, 430, '#0a2a38', 260);
    const ceil = ridgePoints(rng, -40, W + 40, -60, 40, 170, 10);
    fillRidge(sc, ceil, -40, W + 40, '#04141d');
    /* stalactites hanging from it */
    for (let x = -20; x < W + 40; x += 34) {
      const len = rr(rng, 40, 210);
      const w = rr(rng, 9, 26);
      const px = x + rr(rng, -10, 10);
      polyPath(sc, [[px - w, 0], [px + w, 0], [px + w * 0.16, len], [px - w * 0.1, len * 0.92]]);
      sc.fillStyle = '#071e28';
      sc.fill();
      sc.strokeStyle = rgba('#8ae0ff', 0.12);
      sc.lineWidth = 1.2;
      sc.beginPath();
      sc.moveTo(px - w * 0.7, 4);
      sc.lineTo(px - w * 0.06, len * 0.86);
      sc.stroke();
      if (rng() < 0.22) {
        glowDot(sc, px, len, 26, '#8ae0ff', 0.3);
        sc.fillStyle = rgba('#bff0ff', 0.75);
        sc.beginPath();
        sc.arc(px, len - 2, 2.4, 0, TWO_PI);
        sc.fill();
      }
    }
    /* the cave floor, lit by its own crystals */
    const floor = ridgePoints(rng, -40, W + 40, 596, 660, 200, 16);
    fillRidge(sc, floor, -40, W + 40, '#06202c');
    strokeRidge(sc, floor, rgba('#8ae0ff', 0.16), 1.8);
    /* a still pool in the front, mirroring the glow above it */
    fillBand(sc, 0, 648, 0, H, [[0, rgba('#1a6a86', 0.75)], [1, rgba('#03121a', 0.95)]]);
    for (let i = 0; i < 40; ++i) {
      sc.fillStyle = rgba('#bff0ff', 0.05 + rng() * 0.12);
      sc.fillRect(rr(rng, -20, W), rr(rng, 652, H), rr(rng, 20, 120), 1.4);
    }
    /* crystal seams: the big cluster on the right, small ones kept off the board */
    crystalCluster(sc, rng, 1120, 660, 1.25, '#3ab4ff', '#8ae0ff');
    crystalCluster(sc, rng, 960, 640, 0.8, '#57d0e8', '#8ae0ff');
    crystalCluster(sc, rng, 1258, 690, 1.05, '#3ab4ff', '#8ae0ff');
    crystalCluster(sc, rng, 120, 668, 0.62, '#57d0e8', '#8ae0ff');
    crystalCluster(sc, rng, 470, 636, 0.42, '#3ab4ff', '#8ae0ff');
    /* a shelf of rock at the right edge, broken by the crystals */
    polyPath(sc, [[1150, H], [1140, 560], [1196, 500], [1290, 520], [1290, H]]);
    sc.fillStyle = '#04141d';
    sc.fill();
    polyPath(sc, [[0, H], [0, 520], [70, 486], [128, 548], [112, H]]);
    sc.fillStyle = '#04141d';
    sc.fill();
    /* caustic ripples wandering over the walls */
    sc.strokeStyle = rgba('#bff0ff', 0.09);
    sc.lineWidth = 2.2;
    for (let i = 0; i < 26; ++i) {
      const x = rng() * W, y = rr(rng, 380, 640);
      sc.beginPath();
      for (let k = 0; k < 4; ++k)
        sc.quadraticCurveTo(x + k * 26 + 12, y + (k % 2 ? -12 : 12), x + (k + 1) * 26, y);
      sc.stroke();
    }
    /* the mouth of the cave framing the top corners */
    puffMass(sc, rng, 40, 60, 220, 150, '#03121a', 0.9, 14);
    puffMass(sc, rng, 1250, 40, 240, 160, '#03121a', 0.9, 14);
  }

  /* ── realm 2: Stone Peaks, a high plateau under a cold sky ── */

  function stoneArch(sc, rng, cx, baseY, w, h, color) {
    const pier = Math.max(10, w * 0.13);
    const topY = baseY - h + w / 2;
    sc.fillStyle = color;
    sc.fillRect(cx - w / 2, topY, pier, baseY - topY);
    sc.fillRect(cx + w / 2 - pier, topY, pier, baseY - topY);
    sc.lineWidth = pier;
    sc.strokeStyle = color;
    sc.beginPath();
    sc.arc(cx, topY, w / 2 - pier / 2, Math.PI, 0);
    sc.stroke();
    /* voussoir joints and weathering */
    sc.strokeStyle = rgba(shade(color, -0.55), 0.55);
    sc.lineWidth = 1.4;
    const rad = w / 2 - pier / 2;
    for (let k = 1; k < 9; ++k) {
      const a = Math.PI + k / 9 * Math.PI;
      sc.beginPath();
      sc.moveTo(cx + Math.cos(a) * (rad - pier / 2), topY + Math.sin(a) * (rad - pier / 2));
      sc.lineTo(cx + Math.cos(a) * (rad + pier / 2), topY + Math.sin(a) * (rad + pier / 2));
      sc.stroke();
    }
    for (let r = 0; r < 3; ++r) {
      const y = topY + (baseY - topY) * (0.25 + r * 0.26);
      sc.beginPath();
      sc.moveTo(cx - w / 2, y);
      sc.lineTo(cx - w / 2 + pier, y);
      sc.moveTo(cx + w / 2 - pier, y);
      sc.lineTo(cx + w / 2, y);
      sc.stroke();
    }
    /* sun-side highlight and a rune band that still holds a little light */
    sc.strokeStyle = rgba('#ffe0a0', 0.3);
    sc.lineWidth = 2;
    sc.beginPath();
    sc.arc(cx, topY, rad + pier / 2 - 1, Math.PI * 1.06, Math.PI * 1.55);
    sc.stroke();
    sc.fillStyle = rgba('#c9a36a', 0.5);
    for (let k = 0; k < 4; ++k)
      sc.fillRect(cx - w / 2 + 2, topY + 18 + k * 26, pier - 4, 3);
    /* rubble at the feet of the arch */
    for (let k = 0; k < 9; ++k) {
      sc.fillStyle = rgba(shade(color, k % 2 ? -0.25 : 0.12), 0.9);
      sc.beginPath();
      sc.ellipse(cx + rr(rng, -w * 0.8, w * 0.8), baseY - rr(rng, 0, 8),
        rr(rng, 5, 16), rr(rng, 3, 8), rng() * Math.PI, 0, TWO_PI);
      sc.fill();
    }
  }

  function paintStonePeaks(sc, rng) {
    fillBand(sc, 0, 0, 0, H, [
      [0, '#2c5c92'], [0.34, '#6f9ec6'], [0.62, '#b8d4e8'], [0.84, '#dfeaf2'], [1, '#f2f6f8']
    ]);
    /* high thin sun and the haze it makes */
    glowDot(sc, 1010, 118, 300, '#fff4d8', 0.4);
    sc.fillStyle = '#fffaf0';
    sc.beginPath();
    sc.arc(1010, 118, 20, 0, TWO_PI);
    sc.fill();
    starField(sc, rng, 90, ['#ffffff', '#cfe0ff'], 0, 190, 0.22);
    /* three ranges of peaks, the far ones dissolved in distance */
    const r1 = ridgePoints(rng, -40, W + 40, 250, 372, 300, 6);
    fillRidge(sc, r1, -40, W + 40, rgba('#93aecb', 0.85));
    crestLight(sc, r1, 320, rgba('#ffffff', 0.55), 3);
    const r2 = ridgePoints(rng, -40, W + 40, 210, 430, 210, 12);
    fillRidge(sc, r2, -40, W + 40, '#6d86a6');
    crestLight(sc, r2, 300, '#f4f9ff', 6);
    strokeRidge(sc, r2, rgba('#3d5570', 0.5), 1.4);
    const r3 = ridgePoints(rng, -40, W + 40, 300, 500, 150, 18);
    fillRidge(sc, r3, -40, W + 40, '#46596f');
    crestLight(sc, r3, 380, '#eaf2fa', 8);
    /* shaded faces: short strokes running down from the crests */
    sc.strokeStyle = rgba('#2f3f52', 0.35);
    sc.lineWidth = 2;
    for (let i = 0; i < 90; ++i) {
      const k = 2 + Math.floor(rng() * (r3.length / 2 - 2));
      const x = r3[k * 2], y = r3[k * 2 + 1] + 6;
      if (y > 500) continue;
      sc.beginPath();
      sc.moveTo(x, y);
      sc.lineTo(x + rr(rng, -26, 26), y + rr(rng, 20, 70));
      sc.stroke();
    }
    /* the cloud sea filling the valleys */
    for (let i = 0; i < 5; ++i)
      wavyBand(sc, -40, W + 40, 452 + i * 26, 486 + i * 26, rr(rng, 6, 14), 0.008 + rng() * 0.006,
        rng() * TWO_PI, rgba(i % 2 ? '#ffffff' : '#c8d8e8', 0.3 + rng() * 0.3));
    for (let i = 0; i < 16; ++i)
      puffMass(sc, rng, rr(rng, -40, W + 40), rr(rng, 470, 560), rr(rng, 90, 220), rr(rng, 22, 46), '#ffffff', 0.5, 12);
    /* the plateau the arches stand on */
    const plat = ridgePoints(rng, -40, W + 40, 560, 610, 240, 10);
    fillRidge(sc, plat, -40, W + 40, '#5f5a50');
    strokeRidge(sc, plat, rgba('#c9c0ae', 0.5), 2);
    fillBand(sc, 0, 606, 0, H, [[0, '#4e4a42'], [1, '#22201c']]);
    stoneArch(sc, rng, 1090, 640, 210, 250, '#6e685c');
    stoneArch(sc, rng, 900, 632, 130, 168, '#5e584e');
    /* a broken pier on the left edge, so the plateau reads as a ruined ring */
    polyPath(sc, [[-10, H], [-10, 430], [26, 402], [62, 424], [70, H]]);
    sc.fillStyle = '#4a453c';
    sc.fill();
    sc.fillStyle = rgba('#8a8478', 0.6);
    sc.fillRect(-10, 430, 74, 6);
    /* snow drifting across the plateau, stones and rime */
    for (let i = 0; i < 46; ++i) {
      sc.fillStyle = rgba('#f4f9ff', 0.16 + rng() * 0.3);
      sc.beginPath();
      sc.ellipse(rng() * W, rr(rng, 612, H), rr(rng, 14, 60), rr(rng, 2, 5), 0, 0, TWO_PI);
      sc.fill();
    }
    for (let i = 0; i < 34; ++i) {
      sc.fillStyle = rgba(i % 3 ? '#6e685c' : '#8a8478', 0.85);
      sc.beginPath();
      sc.ellipse(rng() * W, rr(rng, 616, H), rr(rng, 4, 15), rr(rng, 3, 9), rng() * Math.PI, 0, TWO_PI);
      sc.fill();
    }
    /* foreground crags at both edges */
    polyPath(sc, [[-30, H], [-20, 520], [40, 470], [96, 540], [86, H]]);
    sc.fillStyle = '#2e2b26';
    sc.fill();
    polyPath(sc, [[W + 30, H], [W + 20, 486], [1180, 442], [1122, 528], [1136, H]]);
    sc.fillStyle = '#2e2b26';
    sc.fill();
    sc.strokeStyle = rgba('#c9c0ae', 0.35);
    sc.lineWidth = 2;
    sc.beginPath();
    sc.moveTo(-20, 520);
    sc.lineTo(40, 470);
    sc.lineTo(96, 540);
    sc.moveTo(W + 20, 486);
    sc.lineTo(1180, 442);
    sc.lineTo(1122, 528);
    sc.stroke();
  }

  /* ── realm 3: Sky Ruins, floating islands above the cloud sea at noon ── */

  function islandBody(sc, rng, cx, topY, rx, depth, grass, rock) {
    /* the rocky underside tapering to a point, with a few hanging roots */
    const tipX = cx + rr(rng, -rx * 0.2, rx * 0.2);
    const tipY = topY + depth;
    polyPath(sc, [[cx - rx, topY], [cx - rx * 0.62, topY + depth * 0.52], [tipX, tipY],
      [cx + rx * 0.58, topY + depth * 0.46], [cx + rx, topY]]);
    sc.fillStyle = rock;
    sc.fill();
    sc.strokeStyle = rgba(shade(rock, -0.4), 0.6);
    sc.lineWidth = 1.6;
    for (let i = 0; i < 7; ++i) {
      const x = cx + rr(rng, -rx * 0.8, rx * 0.8);
      sc.beginPath();
      sc.moveTo(x, topY + 4);
      sc.lineTo(x + rr(rng, -10, 10), topY + rr(rng, depth * 0.25, depth * 0.7));
      sc.stroke();
    }
    for (let i = 0; i < 4; ++i) {
      const x = cx + rr(rng, -rx * 0.7, rx * 0.7);
      sc.strokeStyle = rgba(shade(rock, -0.25), 0.5);
      sc.beginPath();
      sc.moveTo(x, tipY - rr(rng, 4, 22));
      sc.quadraticCurveTo(x + rr(rng, -8, 8), tipY + rr(rng, 10, 30), x + rr(rng, -14, 14), tipY + rr(rng, 26, 52));
      sc.stroke();
    }
    /* the grassy cap, lit from above */
    sc.fillStyle = grass;
    sc.beginPath();
    sc.ellipse(cx, topY, rx, rx * 0.19, 0, 0, TWO_PI);
    sc.fill();
    sc.fillStyle = rgba(shade(grass, 0.3), 0.55);
    sc.beginPath();
    sc.ellipse(cx - rx * 0.12, topY - rx * 0.05, rx * 0.72, rx * 0.1, 0, 0, TWO_PI);
    sc.fill();
    sc.fillStyle = rgba(shade(rock, -0.5), 0.5);
    sc.beginPath();
    sc.ellipse(cx, topY + rx * 0.14, rx * 0.98, rx * 0.07, 0, 0, Math.PI);
    sc.fill();
  }

  function waterfall(sc, rng, x, topY, bottomY, w) {
    const g = sc.createLinearGradient(x, topY, x, bottomY);
    g.addColorStop(0, rgba('#dff2ff', 0.9));
    g.addColorStop(0.55, rgba('#a8d8f4', 0.7));
    g.addColorStop(1, rgba('#eaf6ff', 0.25));
    sc.fillStyle = g;
    sc.beginPath();
    sc.moveTo(x - w / 2, topY);
    sc.quadraticCurveTo(x - w * 0.7, (topY + bottomY) / 2, x - w * 0.9, bottomY);
    sc.lineTo(x + w * 0.9, bottomY);
    sc.quadraticCurveTo(x + w * 0.7, (topY + bottomY) / 2, x + w / 2, topY);
    sc.closePath();
    sc.fill();
    sc.strokeStyle = rgba('#ffffff', 0.55);
    sc.lineWidth = 1.6;
    for (let i = 0; i < 7; ++i) {
      const sx = x + rr(rng, -w * 0.45, w * 0.45);
      sc.beginPath();
      sc.moveTo(sx, topY + rr(rng, 0, 20));
      sc.quadraticCurveTo(sx + rr(rng, -6, 6), (topY + bottomY) / 2, sx + rr(rng, -12, 12), bottomY - rr(rng, 0, 24));
      sc.stroke();
    }
    puffMass(sc, rng, x, bottomY, w * 1.7, 22, '#ffffff', 0.5, 10);
  }

  function ruinBlock(sc, x, y, w, h, color) {
    sc.fillStyle = color;
    sc.fillRect(x, y, w, h);
    sc.fillStyle = rgba('#ffffff', 0.28);
    sc.fillRect(x, y, w, 3);
    sc.fillStyle = rgba('#5a6478', 0.35);
    sc.fillRect(x + w - 3, y, 3, h);
    sc.strokeStyle = rgba('#5a6478', 0.3);
    sc.lineWidth = 1;
    for (let k = 1; k * 12 < h; ++k) {
      sc.beginPath();
      sc.moveTo(x, y + k * 12);
      sc.lineTo(x + w, y + k * 12);
      sc.stroke();
    }
  }

  function paintSkyRuins(sc, rng) {
    fillBand(sc, 0, 0, 0, H, [
      [0, '#2f76c4'], [0.34, '#68a8dc'], [0.62, '#a8d4f0'], [0.84, '#d8ecfa'], [1, '#eef8ff']
    ]);
    /* noon sun in the upper right, the whole sky is its light */
    glowDot(sc, 1128, 104, 340, '#ffffff', 0.45);
    glowDot(sc, 1128, 104, 120, '#fff8e0', 0.6);
    sc.fillStyle = '#fffdf4';
    sc.beginPath();
    sc.arc(1128, 104, 24, 0, TWO_PI);
    sc.fill();
    /* high thin clouds, barely there */
    for (let i = 0; i < 7; ++i)
      wavyBand(sc, -40, W + 40, 90 + i * 44 + rr(rng, -14, 14), 112 + i * 44, rr(rng, 4, 10),
        0.007 + rng() * 0.005, rng() * TWO_PI, rgba('#ffffff', 0.14 + rng() * 0.16));
    /* the cloud sea below, its tops lit by the sun */
    for (let i = 0; i < 6; ++i)
      wavyBand(sc, -40, W + 40, 512 + i * 34, 556 + i * 34, rr(rng, 8, 18), 0.006 + rng() * 0.005,
        rng() * TWO_PI, rgba(i % 2 ? '#ffffff' : '#cfe2f2', 0.42 + rng() * 0.3));
    for (let i = 0; i < 22; ++i)
      puffMass(sc, rng, rr(rng, -60, W + 60), rr(rng, 520, 700), rr(rng, 110, 260), rr(rng, 26, 58), '#ffffff', 0.6, 13);
    fillBand(sc, 0, 640, 0, H, [[0, rgba('#eef8ff', 0.2)], [1, rgba('#cfe2f2', 0.85)]]);
    /* the great island on the right: ruins, a courtyard and two waterfalls */
    islandBody(sc, rng, 1090, 402, 210, 250, '#7ab45e', '#6a6a78');
    ruinBlock(sc, 1010, 300, 26, 102, '#d8d2c4');
    ruinBlock(sc, 1062, 268, 26, 134, '#e0dacc');
    ruinBlock(sc, 1116, 316, 26, 86, '#d8d2c4');
    ruinBlock(sc, 1168, 288, 26, 114, '#dcd6c8');
    sc.fillStyle = '#e6e0d2';
    polyPath(sc, [[996, 300], [1206, 288], [1206, 276], [996, 288]]);
    sc.fill();
    ruinBlock(sc, 1004, 356, 196, 18, '#e0dac8');
    waterfall(sc, rng, 962, 404, 640, 26);
    waterfall(sc, rng, 1216, 410, 660, 20);
    /* moss and small trees on the island */
    for (let i = 0; i < 14; ++i) {
      const x = rr(rng, 900, 1280), y = rr(rng, 372, 404);
      sc.fillStyle = rgba(i % 3 ? '#4e8a44' : '#8ec06a', 0.85);
      sc.beginPath();
      sc.arc(x, y, rr(rng, 5, 14), 0, TWO_PI);
      sc.fill();
    }
    for (let i = 0; i < 4; ++i) {
      const x = rr(rng, 920, 1260), y = rr(rng, 356, 396);
      sc.strokeStyle = '#4a3a28';
      sc.lineWidth = 3;
      sc.beginPath();
      sc.moveTo(x, y);
      sc.lineTo(x + rr(rng, -3, 3), y - 22);
      sc.stroke();
      puffMass(sc, rng, x, y - 32, 20, 14, '#4e8a44', 0.9, 6);
    }
    /* two small islands high up, kept clear of the board */
    islandBody(sc, rng, 640, 150, 74, 92, '#8ec06a', '#7a7a88');
    ruinBlock(sc, 620, 108, 14, 42, '#dcd6c8');
    islandBody(sc, rng, 812, 232, 52, 66, '#7ab45e', '#6a6a78');
    waterfall(sc, rng, 830, 236, 330, 12);
    /* a broken aqueduct arch at the right edge, half out of frame */
    sc.fillStyle = '#cfc8b8';
    sc.fillRect(1244, 300, 36, 210);
    sc.lineWidth = 30;
    sc.strokeStyle = '#cfc8b8';
    sc.beginPath();
    sc.arc(1244, 300, 62, Math.PI * 0.5, Math.PI);
    sc.stroke();
    sc.fillStyle = rgba('#5a6478', 0.25);
    sc.fillRect(1244, 300, 36, 210);
    /* hanging vines from the island edges */
    sc.strokeStyle = rgba('#4e8a44', 0.6);
    sc.lineWidth = 2;
    for (let i = 0; i < 12; ++i) {
      const x = rr(rng, 900, 1280), y = rr(rng, 420, 470);
      sc.beginPath();
      sc.moveTo(x, y);
      sc.quadraticCurveTo(x + rr(rng, -10, 10), y + 40, x + rr(rng, -18, 18), y + rr(rng, 60, 120));
      sc.stroke();
    }
    /* a distant flock of birds, tiny and high */
    sc.strokeStyle = rgba('#3a5a7a', 0.5);
    sc.lineWidth = 1.6;
    for (let i = 0; i < 9; ++i) {
      const x = rr(rng, 260, 900), y = rr(rng, 120, 260), s = rr(rng, 4, 9);
      sc.beginPath();
      sc.moveTo(x - s, y);
      sc.quadraticCurveTo(x, y - s * 0.8, x + s, y);
      sc.stroke();
    }
  }

  /* ── realm 4: Elemental Sanctum, a cosmic hall with four elemental pillars ── */

  function sanctumPillar(sc, rng, x, element, topGlow) {
    const baseY = 640, w = 46;
    const col = ELEMENT_COLORS[element];
    /* the shaft, fluted, standing from the floor up into the dark */
    const g = sc.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, shade(col.core, -0.35));
    g.addColorStop(0.42, shade(col.mid, -0.62));
    g.addColorStop(0.62, shade(col.mid, -0.3));
    g.addColorStop(1, shade(col.core, -0.45));
    sc.fillStyle = g;
    sc.fillRect(x - w / 2, 96, w, baseY - 96);
    sc.strokeStyle = rgba(shade(col.mid, -0.75), 0.8);
    sc.lineWidth = 1.6;
    for (let k = -2; k <= 2; ++k) {
      sc.beginPath();
      sc.moveTo(x + k * 9, 110);
      sc.lineTo(x + k * 9, baseY - 10);
      sc.stroke();
    }
    /* capital and base */
    sc.fillStyle = shade(col.mid, -0.55);
    sc.fillRect(x - w / 2 - 9, 84, w + 18, 16);
    sc.fillRect(x - w / 2 - 13, baseY - 18, w + 26, 18);
    sc.fillStyle = rgba(col.glow, 0.35);
    sc.fillRect(x - w / 2 - 9, 84, w + 18, 3);
    /* the elemental sigil burning above the capital */
    glowDot(sc, x, 52, 74, col.glow, 0.5);
    glowDot(sc, x, 52, 30, shade(col.glow, 0.4), 0.75);
    sc.fillStyle = rgba(col.glow, 0.9);
    if (element === 'fire') {
      polyPath(sc, [[x, 22], [x + 15, 48], [x + 8, 74], [x - 8, 74], [x - 15, 48]]);
      sc.fill();
    } else if (element === 'water') {
      sc.beginPath();
      sc.arc(x, 54, 15, 0, TWO_PI);
      sc.fill();
      sc.strokeStyle = rgba(col.mark, 0.8);
      sc.lineWidth = 2;
      sc.beginPath();
      sc.arc(x, 54, 23, Math.PI * 0.15, Math.PI * 0.85);
      sc.stroke();
    } else if (element === 'earth') {
      polyPath(sc, [[x - 18, 72], [x - 6, 32], [x + 4, 54], [x + 12, 30], [x + 20, 72]]);
      sc.fill();
    } else {
      sc.strokeStyle = rgba(col.glow, 0.9);
      sc.lineWidth = 4;
      let a = 0, r = 5;
      sc.beginPath();
      sc.moveTo(x + r, 54);
      for (let k = 0; k < 4; ++k) {
        sc.arc(x, 54, r, a, a + Math.PI * 0.95);
        a += Math.PI * 0.95;
        r += 5;
      }
      sc.stroke();
    }
    if (topGlow) glowDot(sc, x, baseY - 60, 150, col.glow, 0.16);
    return { x: x, y: 52 };
  }

  function paintElementalSanctum(sc, rng) {
    fillBand(sc, 0, 0, 0, H, [
      [0, '#070313'], [0.34, '#1c0c34'], [0.66, '#160a2a'], [1, '#0a0418']
    ]);
    /* the nebula: broad soft bands of violet, magenta and cold teal */
    const tints = ['#6a1a9a', '#c04cff', '#2a6ad0', '#1ac0c8'];
    for (let i = 0; i < 14; ++i) {
      const cx = rr(rng, -80, W + 80), cy = rr(rng, -60, 520);
      const rx = rr(rng, 160, 420), ry = rr(rng, 90, 240);
      const col = tints[Math.floor(rng() * tints.length)];
      const a = 0.06 + rng() * 0.1;
      const g = sc.createRadialGradient(cx, cy, 0, cx, cy, rx);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.55, rgba(col, a * 0.4));
      g.addColorStop(1, rgba(col, 0));
      sc.save();
      sc.translate(cx, cy);
      sc.scale(1, ry / rx);
      sc.translate(-cx, -cy);
      sc.fillStyle = g;
      sc.beginPath();
      sc.arc(cx, cy, rx, 0, TWO_PI);
      sc.fill();
      sc.restore();
    }
    starField(sc, rng, 620, ['#ffffff', '#cfe0ff', '#ffe9c0'], 0, 620, 0.5);
    /* dust lanes across the nebula */
    for (let i = 0; i < 8; ++i)
      wavyBand(sc, -40, W + 40, 60 + i * 52, 96 + i * 52, rr(rng, 8, 22), 0.006 + rng() * 0.005,
        rng() * TWO_PI, rgba('#0a0418', 0.2 + rng() * 0.2));
    /* the hall floor in one-point perspective */
    fillBand(sc, 0, 556, 0, H, [[0, '#1a0f2c'], [1, '#08040f']]);
    sc.strokeStyle = rgba('#6a4a9a', 0.3);
    sc.lineWidth = 1.4;
    for (let k = -9; k <= 9; ++k) {
      sc.beginPath();
      sc.moveTo(640 + k * 26, 556);
      sc.lineTo(640 + k * 190, H);
      sc.stroke();
    }
    for (let r = 0; r < 5; ++r) {
      const y = 556 + (r + 1) * (r + 1) * 7;
      sc.strokeStyle = rgba('#6a4a9a', 0.26 - r * 0.03);
      sc.beginPath();
      sc.moveTo(-40, y);
      sc.lineTo(W + 40, y);
      sc.stroke();
    }
    /* the arcane circle burning on the floor to the right of the board */
    sc.save();
    sc.translate(1050, 648);
    sc.scale(1, 0.34);
    sc.strokeStyle = rgba('#c04cff', 0.5);
    sc.lineWidth = 4;
    sc.beginPath();
    sc.arc(0, 0, 150, 0, TWO_PI);
    sc.stroke();
    sc.lineWidth = 2;
    sc.beginPath();
    sc.arc(0, 0, 118, 0, TWO_PI);
    sc.stroke();
    sc.strokeStyle = rgba('#e0a8ff', 0.4);
    for (let k = 0; k < 12; ++k) {
      const a = k / 12 * TWO_PI;
      sc.beginPath();
      sc.moveTo(Math.cos(a) * 118, Math.sin(a) * 118);
      sc.lineTo(Math.cos(a + 0.5) * 150, Math.sin(a + 0.5) * 150);
      sc.stroke();
    }
    sc.restore();
    glowDot(sc, 1050, 648, 210, '#c04cff', 0.22);
    /* the four elemental pillars, the outer pair framing the whole hall */
    sanctumPillar(sc, rng, 74, 'fire', true);
    sanctumPillar(sc, rng, 330, 'earth', false);
    sanctumPillar(sc, rng, 950, 'water', true);
    sanctumPillar(sc, rng, 1206, 'air', true);
    /* light the pillars cast onto the floor */
    const pools = [[74, '#ff7a3a'], [330, '#c9a36a'], [950, '#3ab4ff'], [1206, '#bde6ff']];
    for (let i = 0; i < pools.length; ++i) {
      sc.save();
      sc.translate(pools[i][0], 646);
      sc.scale(1, 0.26);
      sc.translate(-pools[i][0], -646);
      glowDot(sc, pools[i][0], 646, 130, pools[i][1], 0.3);
      sc.restore();
    }
    /* hanging chains and floating rune slabs */
    sc.strokeStyle = rgba('#3a2a54', 0.85);
    sc.lineWidth = 2.4;
    for (let i = 0; i < 6; ++i) {
      const x = 150 + i * 190 + rr(rng, -30, 30);
      const len = rr(rng, 60, 210);
      sc.beginPath();
      sc.moveTo(x, 0);
      sc.lineTo(x, len);
      sc.stroke();
      sc.fillStyle = rgba('#c04cff', 0.5);
      sc.beginPath();
      sc.arc(x, len + 6, 5, 0, TWO_PI);
      sc.fill();
      glowDot(sc, x, len + 6, 26, '#c04cff', 0.3);
    }
    for (let i = 0; i < 5; ++i) {
      const x = rr(rng, 900, 1260), y = rr(rng, 180, 460);
      const w = rr(rng, 26, 54), h = rr(rng, 34, 70);
      sc.save();
      sc.translate(x, y);
      sc.rotate(rr(rng, -0.22, 0.22));
      sc.fillStyle = '#241436';
      sc.fillRect(-w / 2, -h / 2, w, h);
      sc.strokeStyle = rgba('#e0a8ff', 0.55);
      sc.lineWidth = 1.6;
      sc.strokeRect(-w / 2, -h / 2, w, h);
      sc.strokeStyle = rgba('#e0a8ff', 0.7);
      sc.beginPath();
      sc.moveTo(-w * 0.22, -h * 0.26);
      sc.lineTo(w * 0.2, -h * 0.04);
      sc.lineTo(-w * 0.14, h * 0.24);
      sc.stroke();
      sc.restore();
      glowDot(sc, x, y, 46, '#c04cff', 0.18);
    }
    /* the hall's own dark arch, framing the top corners */
    sc.fillStyle = '#08040f';
    polyPath(sc, [[-20, -20], [W + 20, -20], [W + 20, 74], [1000, 40], [640, 26], [280, 40], [-20, 74]]);
    sc.fill();
    sc.strokeStyle = rgba('#c04cff', 0.22);
    sc.lineWidth = 2;
    sc.beginPath();
    sc.moveTo(-20, 74);
    sc.quadraticCurveTo(640, 20, W + 20, 74);
    sc.stroke();
  }

  /* ── ambient layers ──
   * Dots are grouped by colour and alpha at build time, so a frame pays one
   * fillStyle per group and one fillRect per particle. Sprite particles are a
   * single cached blit each. Positions are normalised and mapped onto the
   * visible rect, so the layer covers the letterbox bars as well as the field.
   */

  function dotGroups(rng, n, colors, alphas, spLo, spHi, sizeMax) {
    const map = {};
    const groups = [];
    for (let i = 0; i < n; ++i) {
      const color = colors[Math.floor(rng() * colors.length)];
      const alpha = alphas[Math.floor(rng() * alphas.length)];
      const key = color + '|' + alpha;
      let g = map[key];
      if (!g) {
        g = map[key] = { style: rgba(color, alpha), pts: [] };
        groups.push(g);
      }
      g.pts.push({
        u: rng(), v: rng(), sp: rr(rng, spLo, spHi), sw: rr(rng, 0.25, 1.1),
        ph: rng() * TWO_PI, s: 1 + Math.floor(rng() * sizeMax)
      });
    }
    return groups;
  }

  /* dir -1 rises, +1 falls; drift slides the field sideways */
  function drawDotField(c, groups, t, v, dir, sway, drift) {
    const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
    for (let g = 0; g < groups.length; ++g) {
      const grp = groups[g];
      c.fillStyle = grp.style;
      const pts = grp.pts;
      for (let i = 0; i < pts.length; ++i) {
        const p = pts[i];
        const x = v.x0 + mod(p.u * vw + Math.sin(t * p.sw + p.ph) * sway + t * drift, vw);
        const y = v.y0 + mod(p.v * vh + dir * t * p.sp, vh);
        c.fillRect(x, y, p.s, p.s);
      }
    }
  }

  /* the twinkling stars of the sanctum: alpha is bucketed per frame so the
     number of fillStyle changes stays bounded */
  function drawTwinkle(c, stars, t, v) {
    const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
    const map = {};
    const order = [];
    for (let i = 0; i < stars.length; ++i) {
      const s = stars[i];
      const eff = s.a * (0.5 + 0.5 * Math.sin(t * s.rate + s.ph));
      const bucket = Math.max(1, Math.round(eff * 3)) / 3;
      const key = s.color + '|' + bucket;
      let g = map[key];
      if (!g) {
        g = map[key] = { style: rgba(s.color, bucket), pts: [] };
        order.push(g);
      }
      g.pts.push(s);
    }
    for (let g = 0; g < order.length; ++g) {
      const grp = order[g];
      c.fillStyle = grp.style;
      const pts = grp.pts;
      for (let i = 0; i < pts.length; ++i) {
        const s = pts[i];
        c.fillRect(v.x0 + mod(s.u * vw + t * 1.2, vw), v.y0 + mod(s.v * vh, vh), s.s, s.s);
      }
    }
  }

  function wispSprites(rng) {
    const out = [];
    for (let i = 0; i < 3; ++i) {
      const cv = makeCanvas(160, 56);
      const c = cv.getContext('2d');
      puffMass(c, rng, 80, 32, 66, 15, '#ffffff', 0.5, 12);
      puffMass(c, rng, 80, 26, 44, 9, '#eef8ff', 0.35, 7);
      out.push(cv);
    }
    return out;
  }

  function birdSprites() {
    const out = [];
    for (let p = 0; p < 2; ++p) {
      const cv = makeCanvas(28, 16);
      const c = cv.getContext('2d');
      c.strokeStyle = 'rgba(40,60,86,0.85)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(3, 10);
      c.quadraticCurveTo(9, p ? 3 : 13, 14, 9);
      c.quadraticCurveTo(19, p ? 3 : 13, 25, 10);
      c.stroke();
      out.push(cv);
    }
    return out;
  }

  function moteSprite(color) {
    const cv = makeCanvas(26, 26);
    const c = cv.getContext('2d');
    glowDot(c, 13, 13, 13, color, 0.9);
    c.fillStyle = rgba('#ffffff', 0.9);
    c.beginPath();
    c.arc(13, 13, 1.8, 0, TWO_PI);
    c.fill();
    return cv;
  }

  function buildAmbient(realm, rng) {
    if (realm === 0) {
      const embers = dotGroups(rng, 110, ['#ffb36a', '#ff7a3a', '#ffe6b8'], [0.35, 0.55, 0.75, 0.95], 14, 46, 2);
      return function(c, t, v) {
        drawDotField(c, embers, t, v, -1, 11, 0);
      };
    }
    if (realm === 1) {
      const bubbles = dotGroups(rng, 100, ['#bff0ff', '#8ae0ff', '#ffffff'], [0.25, 0.45, 0.65, 0.85], 18, 58, 2);
      return function(c, t, v) {
        drawDotField(c, bubbles, t, v, -1, 15, 0);
      };
    }
    if (realm === 2) {
      const snow = dotGroups(rng, 120, ['#ffffff', '#eaf2fa', '#cfe0ff'], [0.3, 0.5, 0.7, 0.9], 12, 34, 2);
      return function(c, t, v) {
        drawDotField(c, snow, t, v, 1, 18, 13);
      };
    }
    if (realm === 3) {
      const wisps = wispSprites(rng);
      const birds = birdSprites();
      const drift = [];
      for (let i = 0; i < 12; ++i)
        drift.push({ u: rng(), v: rr(rng, 0.06, 0.86), k: Math.floor(rng() * wisps.length), sp: rr(rng, 5, 17), a: rr(rng, 0.18, 0.5), s: rr(rng, 0.6, 1.5) });
      const flock = [];
      for (let i = 0; i < 6; ++i)
        flock.push({ u: rng(), v: rr(rng, 0.1, 0.4), sp: rr(rng, 26, 46), ph: rng() * TWO_PI, s: rr(rng, 0.7, 1.2) });
      return function(c, t, v) {
        const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
        for (let i = 0; i < drift.length; ++i) {
          const p = drift[i];
          const img = wisps[p.k];
          const dw = img.width * p.s, dh = img.height * p.s;
          c.save();
          c.globalAlpha = p.a;
          c.drawImage(img, v.x0 + mod(p.u * vw + t * p.sp, vw + dw) - dw / 2, v.y0 + p.v * vh - dh / 2, dw, dh);
          c.restore();
        }
        for (let i = 0; i < flock.length; ++i) {
          const p = flock[i];
          const img = birds[Math.floor(t * 5 + p.ph) % 2];
          const dw = img.width * p.s, dh = img.height * p.s;
          c.save();
          c.globalAlpha = 0.75;
          c.drawImage(img, v.x0 + mod(p.u * vw + t * p.sp, vw + dw) - dw / 2,
            v.y0 + p.v * vh + Math.sin(t * 1.4 + p.ph) * 9 - dh / 2, dw, dh);
          c.restore();
        }
      };
    }
    const stars = [];
    for (let i = 0; i < 130; ++i)
      stars.push({
        u: rng(), v: rng(), a: rr(rng, 0.35, 1), rate: rr(rng, 1.2, 3.4), ph: rng() * TWO_PI,
        color: ['#ffffff', '#cfe0ff', '#ffe9c0'][Math.floor(rng() * 3)], s: rng() < 0.8 ? 1 : 2
      });
    const anchors = [[74, 52], [330, 52], [950, 52], [1206, 52]];
    const motes = [];
    for (let i = 0; i < anchors.length; ++i) {
      const el = ELEMENT_NAMES[i];
      for (let k = 0; k < 4; ++k)
        motes.push({ a: anchors[i], el: el, r: rr(rng, 26, 62), ph: rng() * TWO_PI, sp: rr(rng, 0.5, 1.3), squash: rr(rng, 0.4, 0.8), s: rr(rng, 0.7, 1.5) });
    }
    const sprites = {};
    for (let i = 0; i < ELEMENT_NAMES.length; ++i)
      sprites[ELEMENT_NAMES[i]] = moteSprite(ELEMENT_COLORS[ELEMENT_NAMES[i]].glow);
    return function(c, t, v, ox, oy, scale) {
      drawTwinkle(c, stars, t, v);
      for (let i = 0; i < motes.length; ++i) {
        const p = motes[i];
        const ax = ox + p.a[0] * scale, ay = oy + p.a[1] * scale;
        const r = p.r * scale;
        const img = sprites[p.el];
        const dw = img.width * p.s, dh = img.height * p.s;
        c.save();
        c.globalAlpha = 0.55 + 0.35 * Math.sin(t * 2 + p.ph);
        c.drawImage(img, ax + Math.cos(t * p.sp + p.ph) * r - dw / 2,
          ay + Math.sin(t * p.sp + p.ph) * r * p.squash - dh / 2, dw, dh);
        c.restore();
      }
    };
  }

  /* ── one realm: the cached backdrop plus its ambient layer ── */

  function resolveView(view) {
    if (!view) return FULL_VIEW;
    const x0 = Number(view.x0), y0 = Number(view.y0), x1 = Number(view.x1), y1 = Number(view.y1);
    if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1) || x1 <= x0 || y1 <= y0) return FULL_VIEW;
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  function create(realm) {
    let key = Number(realm);
    if (REALM_SCENES[key] === undefined) key = 0;
    const scene = REALM_SCENES[key];
    const rng = mulberry32(key * 7919 + 13);

    /* the opaque backdrop: everything that never moves is baked in here */
    const back = makeCanvas(W, H);
    const bc = back.getContext('2d');
    if (key === 0) paintEmberGrove(bc, rng);
    else if (key === 1) paintTideCaverns(bc, rng);
    else if (key === 2) paintStonePeaks(bc, rng);
    else if (key === 3) paintSkyRuins(bc, rng);
    else paintElementalSanctum(bc, rng);

    const ambient = buildAmbient(key, rng);

    /* one frame: the backdrop scaled up to cover the visible rect, centred, so
       no edge pixel is smeared into a long streak, then the ambient layer */
    function draw(c, t, view) {
      c.globalAlpha = 1;
      const v = resolveView(view);
      let ox = 0, oy = 0, scale = 1;
      if (v.x0 === 0 && v.y0 === 0 && v.x1 === W && v.y1 === H) {
        c.drawImage(back, 0, 0);
      } else {
        const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
        scale = Math.max(vw / W, vh / H);
        const dw = W * scale, dh = H * scale;
        ox = v.x0 + (vw - dw) / 2;
        oy = v.y0 + (vh - dh) / 2;
        c.drawImage(back, ox, oy, dw, dh);
      }
      ambient(c, t || 0, v, ox, oy, scale);
      c.globalAlpha = 1;
    }

    return Object.freeze({ realm: key, name: scene.name, scene: scene, draw: draw });
  }

  /* ── element icons: a cut gem carrying its sigil, two cached variants ── */

  function gemPoints(cx, cy, r) {
    return [[cx, cy - r], [cx + r * 0.82, cy - r * 0.4], [cx + r * 0.66, cy + r * 0.64],
      [cx, cy + r], [cx - r * 0.66, cy + r * 0.64], [cx - r * 0.82, cy - r * 0.4]];
  }

  function gemPath(sc, cx, cy, r) {
    polyPath(sc, gemPoints(cx, cy, r));
  }

  function symbolFlame(sc, cx, cy, s, color) {
    sc.fillStyle = color;
    sc.beginPath();
    sc.moveTo(cx, cy - s);
    sc.bezierCurveTo(cx + s * 0.78, cy - s * 0.22, cx + s * 0.6, cy + s * 0.6, cx, cy + s * 0.82);
    sc.bezierCurveTo(cx - s * 0.6, cy + s * 0.6, cx - s * 0.78, cy - s * 0.22, cx, cy - s);
    sc.closePath();
    sc.fill();
    sc.fillStyle = rgba('#fff8e4', 0.85);
    sc.beginPath();
    sc.moveTo(cx, cy - s * 0.3);
    sc.bezierCurveTo(cx + s * 0.36, cy + s * 0.08, cx + s * 0.26, cy + s * 0.48, cx, cy + s * 0.6);
    sc.bezierCurveTo(cx - s * 0.26, cy + s * 0.48, cx - s * 0.36, cy + s * 0.08, cx, cy - s * 0.3);
    sc.closePath();
    sc.fill();
  }

  function symbolDroplet(sc, cx, cy, s, color) {
    sc.fillStyle = color;
    sc.beginPath();
    sc.moveTo(cx, cy - s);
    sc.bezierCurveTo(cx + s * 0.74, cy - s * 0.06, cx + s * 0.62, cy + s * 0.74, cx, cy + s * 0.84);
    sc.bezierCurveTo(cx - s * 0.62, cy + s * 0.74, cx - s * 0.74, cy - s * 0.06, cx, cy - s);
    sc.closePath();
    sc.fill();
    sc.strokeStyle = rgba('#0e3a68', 0.55);
    sc.lineWidth = s * 0.14;
    sc.beginPath();
    sc.arc(cx + s * 0.16, cy + s * 0.24, s * 0.4, Math.PI * 0.75, Math.PI * 1.5);
    sc.stroke();
  }

  function symbolMountain(sc, cx, cy, s, color) {
    polyPath(sc, [[cx - s, cy + s * 0.72], [cx - s * 0.34, cy - s * 0.52], [cx - s * 0.02, cy + s * 0.12],
      [cx + s * 0.3, cy - s * 0.86], [cx + s, cy + s * 0.72]]);
    sc.fillStyle = color;
    sc.fill();
    polyPath(sc, [[cx + s * 0.3, cy - s * 0.86], [cx + s * 0.52, cy - s * 0.2], [cx + s * 0.08, cy - s * 0.2]]);
    sc.fillStyle = rgba('#ffffff', 0.75);
    sc.fill();
    polyPath(sc, [[cx - s * 0.34, cy - s * 0.52], [cx - s * 0.16, cy - s * 0.14], [cx - s * 0.5, cy - s * 0.14]]);
    sc.fillStyle = rgba('#ffffff', 0.5);
    sc.fill();
  }

  function symbolSwirl(sc, cx, cy, s, color) {
    sc.strokeStyle = color;
    sc.lineWidth = s * 0.24;
    let a = -0.4, r = s * 0.2;
    sc.beginPath();
    sc.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    for (let k = 0; k < 4; ++k) {
      sc.arc(cx, cy, r, a, a + Math.PI * 0.92);
      a += Math.PI * 0.92;
      r += s * 0.2;
    }
    sc.stroke();
    sc.fillStyle = color;
    sc.beginPath();
    sc.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s * 0.16, 0, TWO_PI);
    sc.fill();
  }

  function paintIcon(ctx, element, active) {
    const pal = ELEMENT_COLORS[element];
    const cx = SPRITE / 2, cy = SPRITE / 2;
    const r = active ? 35 : 31;
    glowDot(ctx, cx, cy, active ? 62 : 48, pal.glow, active ? 0.6 : 0.28);
    /* the body of the gem */
    const g = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.46, r * 0.1, cx, cy, r * 1.2);
    g.addColorStop(0, shade(pal.mid, 0.62));
    g.addColorStop(0.48, pal.mid);
    g.addColorStop(1, shade(pal.core, -0.3));
    gemPath(ctx, cx, cy, r);
    ctx.fillStyle = g;
    ctx.fill();
    /* facet seams and the rim */
    ctx.strokeStyle = rgba('#ffffff', 0.16);
    ctx.lineWidth = 1;
    const pts = gemPoints(cx, cy, r);
    for (let k = 0; k < pts.length; ++k) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.1);
      ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(shade(pal.glow, 0.25), active ? 0.9 : 0.5);
    ctx.lineWidth = 2;
    gemPath(ctx, cx, cy, r);
    ctx.stroke();
    /* the table facet catching the light */
    polyPath(ctx, [[cx - r * 0.3, cy - r * 0.62], [cx + r * 0.34, cy - r * 0.5],
      [cx + r * 0.16, cy - r * 0.18], [cx - r * 0.4, cy - r * 0.28]]);
    ctx.fillStyle = rgba('#ffffff', active ? 0.4 : 0.26);
    ctx.fill();
    ctx.fillStyle = rgba(shade(pal.core, -0.4), 0.4);
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.62, r * 0.6, r * 0.24, 0, 0, TWO_PI);
    ctx.fill();
    /* the sigil */
    const s = active ? 21 : 18;
    if (element === 'fire') symbolFlame(ctx, cx, cy + 2, s, pal.mark);
    else if (element === 'water') symbolDroplet(ctx, cx, cy + 1, s, pal.mark);
    else if (element === 'earth') symbolMountain(ctx, cx, cy + 1, s, pal.mark);
    else symbolSwirl(ctx, cx, cy + 1, s, pal.mark);
    /* the lit variant: a ring and four sparks */
    if (active) {
      ctx.strokeStyle = rgba(pal.glow, 0.85);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 12, 0, TWO_PI);
      ctx.stroke();
      ctx.strokeStyle = rgba(pal.glow, 0.5);
      ctx.lineWidth = 2;
      for (let k = 0; k < 8; ++k) {
        const a = k / 8 * TWO_PI + 0.2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (r + 16), cy + Math.sin(a) * (r + 16));
        ctx.lineTo(cx + Math.cos(a) * (r + 23), cy + Math.sin(a) * (r + 23));
        ctx.stroke();
      }
      for (let k = 0; k < 4; ++k) {
        const a = k / 4 * TWO_PI + 0.6;
        glowDot(ctx, cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12), 12, pal.mark, 0.7);
      }
    }
  }

  const iconCache = {};

  function getIcon(element, active) {
    const el = ELEMENT_COLORS[element] ? element : 'fire';
    const key = el + (active ? ':lit' : ':rest');
    if (iconCache[key]) return iconCache[key];
    const cv = makeCanvas(SPRITE, SPRITE);
    paintIcon(cv.getContext('2d'), el, !!active);
    iconCache[key] = cv;
    return cv;
  }

  /* (cx, cy) is the centre of the icon */
  function drawElementIcon(ctx, element, cx, cy, size, active) {
    const s = Number(size) > 0 ? Number(size) : 64;
    ctx.drawImage(getIcon(element, active), cx - s / 2, cy - s / 2, s, s);
  }

  /* ── spell effects: eight cached strips of eight frames each ──
   * Every painter gets a context already centred on the frame and a progress u
   * in [0, 1]; the same seed per kind keeps the debris of one effect coherent
   * from the first frame to the last.
   */

  function spellFireBurst(fc, u) {
    const rng = mulberry32(0x0f10);
    const r = 14 + u * 46;
    for (let i = 0; i < 9; ++i) {
      const a = i / 9 * TWO_PI + u * 0.7;
      const d = r * (0.95 + u * 0.55);
      fc.fillStyle = rgba('#3a1a12', 0.34 * u);
      fc.beginPath();
      fc.arc(Math.cos(a) * d, Math.sin(a) * d, 11 + u * 13, 0, TWO_PI);
      fc.fill();
    }
    glowDot(fc, 0, 0, r * 1.3, '#ff7a3a', 0.8 - u * 0.35);
    glowDot(fc, 0, 0, r * 0.62, '#ffe6b8', 0.95 - u * 0.55);
    for (let i = 0; i < 11; ++i) {
      const a = i / 11 * TWO_PI + u * 0.9;
      const len = r * (0.8 + (i % 3) * 0.28);
      fc.fillStyle = rgba(i % 2 ? '#ff9a4a' : '#ff5a2a', 0.9 - u * 0.45);
      fc.beginPath();
      fc.moveTo(Math.cos(a - 0.19) * r * 0.34, Math.sin(a - 0.19) * r * 0.34);
      fc.quadraticCurveTo(Math.cos(a) * len * 1.15, Math.sin(a) * len * 1.15,
        Math.cos(a + 0.19) * r * 0.34, Math.sin(a + 0.19) * r * 0.34);
      fc.closePath();
      fc.fill();
    }
    for (let i = 0; i < 12; ++i) {
      const a = rng() * TWO_PI, d = r * (1.05 + rng() * 0.55);
      fc.fillStyle = rgba('#ffe6b8', 0.9 - u * 0.6);
      fc.beginPath();
      fc.arc(Math.cos(a) * d, Math.sin(a) * d, 1.5 + rng() * 1.8, 0, TWO_PI);
      fc.fill();
    }
  }

  function spellIceMelt(fc, u) {
    const rng = mulberry32(0x1c2e);
    const shards = [];
    for (let i = 0; i < 11; ++i)
      shards.push({ a: rng() * TWO_PI, d0: 4 + rng() * 12, sp: 14 + rng() * 42, s: 6 + rng() * 13, rot: rng() * TWO_PI, vr: (rng() - 0.5) * 2.4 });
    if (u < 0.6) {
      const k = 1 - u / 0.6;
      glowDot(fc, 0, 0, 40, '#8ae0ff', 0.35 * k);
      polyPath(fc, [[-24, -4], [-6, -28], [22, -8], [16, 22], [-18, 20]]);
      fc.fillStyle = rgba('#57d0e8', 0.35 + 0.45 * k);
      fc.fill();
      fc.strokeStyle = rgba('#e2f6ff', 0.7 * k + 0.2);
      fc.lineWidth = 1.6;
      fc.stroke();
      /* the cracks widening as it lets go */
      fc.strokeStyle = rgba('#ffffff', 0.3 + 0.6 * (u / 0.6));
      fc.lineWidth = 1 + u * 2;
      for (let i = 0; i < 4; ++i) {
        const a = i / 4 * TWO_PI + 0.4;
        fc.beginPath();
        fc.moveTo(0, 0);
        fc.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
        fc.lineTo(Math.cos(a + 0.4) * 26, Math.sin(a + 0.4) * 26);
        fc.stroke();
      }
    }
    for (let i = 0; i < shards.length; ++i) {
      const s = shards[i];
      const d = s.d0 + u * s.sp;
      const x = Math.cos(s.a) * d, y = Math.sin(s.a) * d - u * 6;
      fc.save();
      fc.translate(x, y);
      fc.rotate(s.rot + s.vr * u);
      polyPath(fc, [[0, -s.s * 0.6], [s.s * 0.5, s.s * 0.4], [-s.s * 0.45, s.s * 0.5]]);
      fc.fillStyle = rgba('#8ae0ff', 0.9 - u * 0.45);
      fc.fill();
      fc.strokeStyle = rgba('#e2f6ff', 0.8 - u * 0.4);
      fc.lineWidth = 1;
      fc.stroke();
      fc.restore();
    }
    if (u > 0.3) {
      const k = (u - 0.3) / 0.7;
      for (let i = 0; i < 7; ++i) {
        const a = rng() * TWO_PI;
        puffMass(fc, rng, Math.cos(a) * 22, -10 - k * 34 + Math.sin(a) * 10, 16 + k * 16, 12 + k * 10, '#eaf8ff', 0.3 * (1 - k * 0.5), 5);
      }
    }
  }

  function spellWaterSplash(fc, u) {
    const rng = mulberry32(0x3a40);
    const w = 16 + u * 42;
    const rise = 30 * Math.sin(Math.min(1, u * 1.15) * HALF_PI);
    glowDot(fc, 0, 8, w * 1.1, '#3ab4ff', 0.3);
    /* the ring the splash lifts off of */
    fc.strokeStyle = rgba('#8ae0ff', 0.75 - u * 0.35);
    fc.lineWidth = 4 - u * 2;
    fc.beginPath();
    fc.ellipse(0, 14, w, w * 0.3, 0, 0, TWO_PI);
    fc.stroke();
    /* the crown: a sheet lifted off the ring, prongs thrown upward */
    const prongs = 7;
    fc.beginPath();
    fc.moveTo(-w, 16);
    for (let i = 0; i < prongs; ++i) {
      const xa = -w + 2 * w * (i / prongs);
      const xb = -w + 2 * w * ((i + 0.5) / prongs);
      const xc = -w + 2 * w * ((i + 1) / prongs);
      const tip = 14 - rise * (0.8 + 0.5 * Math.abs(Math.sin(i * 2.1)));
      fc.lineTo(xa, 14 - rise * 0.14);
      fc.lineTo(xb, tip);
      fc.lineTo(xc, 14 - rise * 0.14);
    }
    fc.lineTo(w, 16);
    fc.closePath();
    fc.fillStyle = rgba('#57c0f0', 0.62 - u * 0.2);
    fc.fill();
    fc.strokeStyle = rgba('#e2f6ff', 0.85 - u * 0.3);
    fc.lineWidth = 1.8;
    fc.stroke();
    /* the water still lying in the middle of the ring */
    fc.fillStyle = rgba('#3a9ad8', 0.5 - u * 0.2);
    fc.beginPath();
    fc.ellipse(0, 15, w * 0.62, w * 0.18, 0, 0, TWO_PI);
    fc.fill();
    /* droplets thrown out of the rim */
    for (let i = 0; i < 12; ++i) {
      const a = Math.PI + rng() * Math.PI;
      const d = (w + 6 + u * rr(rng, 10, 34));
      const x = Math.cos(a) * d * 0.9, y = 10 + Math.sin(a) * d * 0.55 - u * 12;
      fc.fillStyle = rgba('#bff0ff', 0.85 - u * 0.4);
      fc.beginPath();
      fc.ellipse(x, y, 2.2 + rng() * 2.6, 3 + rng() * 3.4, rng() * Math.PI, 0, TWO_PI);
      fc.fill();
    }
    fc.fillStyle = rgba('#ffffff', 0.5 - u * 0.3);
    fc.beginPath();
    fc.ellipse(-w * 0.3, 12, w * 0.3, w * 0.08, 0, 0, TWO_PI);
    fc.fill();
  }

  function spellEarthRise(fc, u) {
    const rng = mulberry32(0x5137);
    const rocks = [];
    for (let i = 0; i < 7; ++i)
      rocks.push({ x: rr(rng, -34, 34), sp: rr(rng, 26, 52), s: rr(rng, 7, 16), rot: rng() * TWO_PI, vr: (rng() - 0.5) * 2, verts: 6 });
    /* the crack it comes out of */
    fc.strokeStyle = rgba('#3a2a18', 0.7 - u * 0.3);
    fc.lineWidth = 3;
    fc.beginPath();
    fc.moveTo(-20 - u * 26, 30);
    fc.lineTo(20 + u * 26, 30);
    fc.stroke();
    const lift = Math.sin(Math.min(1, u * 1.1) * HALF_PI);
    for (let i = 0; i < rocks.length; ++i) {
      const rk = rocks[i];
      const y = 26 - lift * rk.sp;
      fc.save();
      fc.translate(rk.x * (0.6 + lift * 0.6), y);
      fc.rotate(rk.rot + rk.vr * u);
      fc.beginPath();
      for (let k = 0; k < rk.verts; ++k) {
        const a = k / rk.verts * TWO_PI;
        const rad = rk.s * (0.7 + ((k * 37) % 11) / 26);
        if (k === 0) fc.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else fc.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      fc.closePath();
      fc.fillStyle = i % 2 ? '#6a5a44' : '#8a7458';
      fc.fill();
      fc.strokeStyle = rgba('#2a2016', 0.8);
      fc.lineWidth = 1.4;
      fc.stroke();
      fc.fillStyle = rgba('#c9b48a', 0.4);
      fc.beginPath();
      fc.arc(-rk.s * 0.3, -rk.s * 0.3, rk.s * 0.3, 0, TWO_PI);
      fc.fill();
      fc.restore();
    }
    /* dust */
    for (let i = 0; i < 10; ++i) {
      const a = rng() * TWO_PI;
      puffMass(fc, rng, Math.cos(a) * rr(rng, 10, 40), 18 - lift * rr(rng, 4, 30),
        12 + u * 16, 9 + u * 10, '#a89068', 0.26 * (1 - u * 0.4), 5);
    }
    for (let i = 0; i < 14; ++i) {
      fc.fillStyle = rgba('#c9b48a', 0.5 - u * 0.25);
      fc.fillRect(rr(rng, -44, 44), rr(rng, -30, 30) - lift * 10, 2, 2);
    }
  }

  function spellChasmFill(fc, u) {
    const rng = mulberry32(0x6b21);
    const pitW = 46, pitH = 16, baseY = 26;
    /* the pit itself */
    fc.beginPath();
    fc.ellipse(0, baseY, pitW, pitH, 0, 0, TWO_PI);
    fc.fillStyle = '#0d0a08';
    fc.fill();
    fc.strokeStyle = rgba('#4a3b2c', 0.9);
    fc.lineWidth = 2;
    fc.stroke();
    /* the rubble mound climbing into it */
    const fill = Math.min(1, u * 1.15);
    if (fill > 0.05) {
      fc.beginPath();
      fc.moveTo(-pitW, baseY);
      for (let i = 0; i <= 8; ++i) {
        const x = -pitW + 2 * pitW * (i / 8);
        const h = pitH * fill * (0.7 + 0.5 * Math.sin(i * 1.3 + 0.6));
        fc.lineTo(x, baseY - h);
      }
      fc.lineTo(pitW, baseY);
      fc.closePath();
      fc.fillStyle = '#5c4c38';
      fc.fill();
      fc.strokeStyle = rgba('#8a7458', 0.7);
      fc.lineWidth = 1.4;
      fc.stroke();
      for (let i = 0; i < 16; ++i) {
        const x = rr(rng, -pitW + 4, pitW - 4);
        const y = baseY - rr(rng, 0, pitH * fill * 0.9);
        fc.fillStyle = rgba(i % 3 ? '#8a7458' : '#3a2a18', 0.85);
        fc.beginPath();
        fc.arc(x, y, rr(rng, 2, 5), 0, TWO_PI);
        fc.fill();
      }
    }
    /* the last stones still dropping in, and the dust they raise */
    if (u < 0.75) {
      for (let i = 0; i < 5; ++i) {
        const x = rr(rng, -30, 30);
        const y = -34 + u * 60 + rr(rng, -8, 8);
        fc.fillStyle = '#6a5a44';
        fc.beginPath();
        fc.arc(x, y, rr(rng, 3, 6), 0, TWO_PI);
        fc.fill();
      }
    }
    for (let i = 0; i < 8; ++i)
      puffMass(fc, rng, rr(rng, -40, 40), baseY - 10 - u * 18, 14 + u * 14, 9 + u * 8, '#a89068', 0.22 * (1 - u * 0.5), 5);
  }

  function spellWindGust(fc, u) {
    const grow = 0.35 + u * 0.85;
    const alpha = 0.8 - u * 0.45;
    for (let k = 0; k < 3; ++k) {
      fc.strokeStyle = rgba(k === 1 ? '#ffffff' : '#cfeaff', alpha * (1 - k * 0.22));
      fc.lineWidth = 6 - u * 3 - k * 0.8;
      let a = k * 2.1 + u * 1.4, r = 7 * grow;
      fc.beginPath();
      fc.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      for (let s = 0; s < 4; ++s) {
        fc.arc(0, 0, r, a, a + Math.PI * 0.85);
        a += Math.PI * 0.85;
        r += 9 * grow;
      }
      fc.stroke();
    }
    /* the streaks the gust carries */
    const rng = mulberry32(0x77aa);
    for (let i = 0; i < 14; ++i) {
      const a = rng() * TWO_PI + u * 1.2;
      const d = rr(rng, 22, 56) * grow;
      fc.strokeStyle = rgba('#eaf8ff', alpha * 0.7);
      fc.lineWidth = 1.6;
      fc.beginPath();
      fc.moveTo(Math.cos(a) * d, Math.sin(a) * d);
      fc.lineTo(Math.cos(a + 0.5) * (d + rr(rng, 6, 16)), Math.sin(a + 0.5) * (d + rr(rng, 6, 16)));
      fc.stroke();
    }
    glowDot(fc, 0, 0, 26 * grow, '#bde6ff', 0.22);
  }

  function spellRuneCollect(fc, u) {
    const flare = Math.min(1, u * 1.6);
    glowDot(fc, 0, 0, 20 + u * 44, '#c04cff', 0.5 + 0.3 * flare);
    glowDot(fc, 0, 0, 10 + u * 18, '#f0d8ff', 0.85 - u * 0.3);
    /* the glyph itself, brightest in the first half */
    const g = 1 - u * 0.55;
    fc.strokeStyle = rgba('#f0e0ff', 0.9 * g + 0.1);
    fc.lineWidth = 3.4 - u * 1.4;
    fc.beginPath();
    fc.moveTo(-13, -18);
    fc.lineTo(11, -4);
    fc.lineTo(-9, 8);
    fc.lineTo(13, 20);
    fc.moveTo(-2, -22);
    fc.lineTo(-2, 22);
    fc.moveTo(-16, 2);
    fc.lineTo(16, -2);
    fc.stroke();
    /* the light ring it flares into, and rising sparks */
    fc.strokeStyle = rgba('#e0a8ff', 0.8 * (1 - u));
    fc.lineWidth = 4 - u * 3;
    fc.beginPath();
    fc.arc(0, 0, 12 + u * 46, 0, TWO_PI);
    fc.stroke();
    const rng = mulberry32(0x8c19);
    for (let i = 0; i < 12; ++i) {
      const x = rr(rng, -26, 26);
      const y = 24 - u * rr(rng, 34, 62);
      fc.fillStyle = rgba('#f0d8ff', 0.85 - u * 0.5);
      fc.beginPath();
      fc.arc(x, y, 1.4 + rng() * 2, 0, TWO_PI);
      fc.fill();
    }
  }

  function spellPortalOpen(fc, u) {
    const r = 10 + u * 48;
    glowDot(fc, 0, 0, r * 1.15, '#c04cff', 0.55 - u * 0.25);
    glowDot(fc, 0, 0, r * 0.55, '#f0d8ff', 0.8 - u * 0.45);
    /* the ring bursting outward, thinner as it grows */
    fc.strokeStyle = rgba('#e0a8ff', 0.95 - u * 0.5);
    fc.lineWidth = 9 - u * 7;
    fc.beginPath();
    fc.arc(0, 0, r, 0, TWO_PI);
    fc.stroke();
    fc.strokeStyle = rgba('#ffffff', 0.6 - u * 0.35);
    fc.lineWidth = 2;
    fc.beginPath();
    fc.arc(0, 0, r * 0.86, 0, TWO_PI);
    fc.stroke();
    /* the spokes of the opening */
    const rng = mulberry32(0x9d44);
    for (let i = 0; i < 12; ++i) {
      const a = i / 12 * TWO_PI + u * 0.5 + rng() * 0.1;
      fc.strokeStyle = rgba('#c04cff', 0.7 - u * 0.45);
      fc.lineWidth = 2.4;
      fc.beginPath();
      fc.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
      fc.lineTo(Math.cos(a) * r * (1.05 + rng() * 0.3), Math.sin(a) * r * (1.05 + rng() * 0.3));
      fc.stroke();
    }
    for (let i = 0; i < 10; ++i) {
      const a = rng() * TWO_PI;
      const d = r * (1.1 + rng() * 0.4);
      fc.fillStyle = rgba('#f0d8ff', 0.8 - u * 0.5);
      fc.beginPath();
      fc.arc(Math.cos(a) * d, Math.sin(a) * d, 1.4 + rng() * 1.8, 0, TWO_PI);
      fc.fill();
    }
  }

  const SPELL_PAINTERS = {
    fireBurst: spellFireBurst,
    iceMelt: spellIceMelt,
    waterSplash: spellWaterSplash,
    earthRise: spellEarthRise,
    chasmFill: spellChasmFill,
    windGust: spellWindGust,
    runeCollect: spellRuneCollect,
    portalOpen: spellPortalOpen
  };

  const spellCache = {};

  function getSpellStrip(kind) {
    const k = SPELL_PAINTERS[kind] ? kind : SPELL_KINDS[0];
    if (spellCache[k]) return spellCache[k];
    const cv = makeCanvas(SPELL_FRAMES * SPRITE, SPRITE);
    const fc = cv.getContext('2d');
    for (let f = 0; f < SPELL_FRAMES; ++f) {
      fc.save();
      fc.translate(f * SPRITE + SPRITE / 2, SPRITE / 2);
      SPELL_PAINTERS[k](fc, f / (SPELL_FRAMES - 1));
      fc.restore();
    }
    spellCache[k] = cv;
    return cv;
  }

  /* (cx, cy) is the centre of the effect; progress runs 0..1 over the strip */
  function drawSpell(ctx, kind, cx, cy, progress, size) {
    const s = Number(size) > 0 ? Number(size) : 64;
    let p = Number(progress);
    if (!isFinite(p)) p = 0;
    p = Math.max(0, Math.min(1, p));
    const frame = Math.min(SPELL_FRAMES - 1, Math.floor(p * SPELL_FRAMES));
    const strip = getSpellStrip(kind);
    let alpha = 1;
    if (p > 0.75) alpha = Math.max(0, 1 - (p - 0.75) / 0.25);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(strip, frame * SPRITE, 0, SPRITE, SPRITE, cx - s / 2, cy - s / 2, s, s);
    ctx.restore();
  }

  SZ.PuzzleScene = Object.freeze({ REALM_SCENES, create, drawElementIcon, drawSpell });
})();
