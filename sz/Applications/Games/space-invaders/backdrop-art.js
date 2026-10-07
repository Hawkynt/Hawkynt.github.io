;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Six painterly space backdrops, one per campaign sector. The entire sky -
   * deep gradient, nebula band, static stars and the celestial body - is
   * painted ONCE into an opaque 1280x720 canvas with a seeded rng, so every
   * sector looks the same on every visit. A frame then costs one blit - the
   * sky scaled up to cover the canvas when the window is not 16:9 and the
   * canvas shows past the play field; the scrolling stars are tiny fillRects
   * grouped by colour and alpha bucket, the drifting rocks and shooting stars
   * are cached sprites. No gradients, no blur and no full-screen transparent
   * images per frame - the same budget the sister game measured as cheap.
   */

  const W = 1280, H = 720;
  const TWO_PI = Math.PI * 2;
  const STAR_COLORS = ['#ffffff', '#cfe0ff', '#ffe9c0'];
  /* what draw() covers when the caller does not say: exactly the play field */
  const FULL_VIEW = Object.freeze({ x0: 0, y0: 0, x1: W, y1: H });

  const THEMES = {
    moon: { sky: ['#05070f', '#141a2e'], nebula: ['#3a4a8a', '#6a7ab0'], body: 'moon' },
    mars: { sky: ['#0d0506', '#2a0f0c'], nebula: ['#8a2a1a', '#d0603a'], body: 'mars' },
    asteroids: { sky: ['#06060a', '#1c1712'], nebula: ['#5a4a3a', '#8a6a4a'], body: 'asteroids' },
    jupiter: { sky: ['#07050a', '#24160e'], nebula: ['#8a5a2a', '#c08a4a'], body: 'jupiter' },
    saturn: { sky: ['#05060a', '#1a1a14'], nebula: ['#7a6a3a', '#b0a06a'], body: 'saturn' },
    mothership: { sky: ['#07030e', '#1c0a2e'], nebula: ['#6a1a9a', '#c04cff'], body: 'mothership' }
  };
  const THEME_NAMES = ['moon', 'mars', 'asteroids', 'jupiter', 'saturn', 'mothership'];

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

  /* mulberry32: the same seeded rng the campaign data uses */
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

  /* fill the region between two sine-curved edges: a cloud band with a wavy border */
  function wavyBand(c, x0, x1, yTop, yBot, amp, freq, phase, color) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x0, yTop + Math.sin(x0 * freq + phase) * amp);
    for (let x = x0 + 24; x <= x1; x += 24)
      c.lineTo(x, yTop + Math.sin(x * freq + phase) * amp);
    for (let x = x1; x >= x0; x -= 24)
      c.lineTo(x, yBot + Math.sin(x * freq * 0.7 + phase + 1.7) * amp);
    c.closePath();
    c.fill();
  }

  /* ── the celestial bodies, painted straight into the sky canvas ── */

  function paintMoon(sc, rnd) {
    const cx = 1150, cy = 760, r = 260;
    sc.save();
    sc.beginPath();
    sc.arc(cx, cy, r, 0, TWO_PI);
    sc.clip();
    const body = sc.createRadialGradient(cx - r * 0.5, cy - r * 0.5, r * 0.12, cx, cy, r);
    body.addColorStop(0, '#dde2ec');
    body.addColorStop(0.5, '#a8afc0');
    body.addColorStop(1, '#262c3c');
    sc.fillStyle = body;
    sc.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    for (let i = 0; i < 15; ++i) {
      const ca = rnd() * TWO_PI;
      const cd = rnd() * r * 0.9;
      const x = cx + Math.cos(ca) * cd;
      const y = cy + Math.sin(ca) * cd;
      const cr = 9 + rnd() * 36;
      sc.fillStyle = rgba('#20242f', 0.30 + rnd() * 0.22);
      sc.beginPath();
      sc.ellipse(x, y, cr, cr * (0.72 + rnd() * 0.28), rnd() * Math.PI, 0, TWO_PI);
      sc.fill();
      sc.strokeStyle = rgba('#eef1f8', 0.26);
      sc.lineWidth = 2;
      sc.beginPath();
      sc.arc(x, y, cr, 0, Math.PI * 0.62);
      sc.stroke();
    }
    const term = sc.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    term.addColorStop(0, 'rgba(0,0,0,0)');
    term.addColorStop(0.5, 'rgba(0,0,0,0)');
    term.addColorStop(1, 'rgba(3,5,10,0.78)');
    sc.fillStyle = term;
    sc.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    sc.restore();
    sc.strokeStyle = rgba('#9fbfff', 0.16);
    sc.lineWidth = 9;
    sc.beginPath();
    sc.arc(cx, cy, r + 4, Math.PI * 0.98, Math.PI * 1.82);
    sc.stroke();
    sc.strokeStyle = rgba('#cfe0ff', 0.5);
    sc.lineWidth = 3;
    sc.beginPath();
    sc.arc(cx, cy, r - 1, Math.PI * 1.04, Math.PI * 1.76);
    sc.stroke();
  }

  function paintMars(sc, rnd) {
    const cx = 120, cy = 820, r = 300;
    sc.save();
    sc.beginPath();
    sc.arc(cx, cy, r, 0, TWO_PI);
    sc.clip();
    const body = sc.createRadialGradient(cx + r * 0.45, cy - r * 0.5, r * 0.1, cx, cy, r);
    body.addColorStop(0, '#e8814e');
    body.addColorStop(0.55, '#a84a28');
    body.addColorStop(1, '#2c100a');
    sc.fillStyle = body;
    sc.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    for (let b = 0; b < 7; ++b) {
      const by = cy - r + (b + 0.5) * (2 * r / 7);
      wavyBand(sc, cx - r, cx + r, by - 24, by + 6, 8 + rnd() * 9, 0.009 + rnd() * 0.008, rnd() * TWO_PI,
        rgba(b & 1 ? '#d0603a' : '#6c2412', 0.14 + rnd() * 0.10));
    }
    for (let i = 0; i < 5; ++i) {
      const x = cx - r * 0.4 + rnd() * r * 1.1;
      const y = cy - r * 0.75 + rnd() * r * 0.7;
      sc.fillStyle = rgba('#4a1a0c', 0.26 + rnd() * 0.16);
      sc.beginPath();
      sc.ellipse(x, y, 34 + rnd() * 52, 16 + rnd() * 22, rnd() * Math.PI, 0, TWO_PI);
      sc.fill();
    }
    sc.fillStyle = rgba('#f2ecff', 0.8);
    sc.beginPath();
    sc.ellipse(cx + r * 0.16, cy - r + 20, 96, 26, -0.12, 0, TWO_PI);
    sc.fill();
    const term = sc.createLinearGradient(cx + r, cy - r, cx - r, cy + r);
    term.addColorStop(0, 'rgba(0,0,0,0)');
    term.addColorStop(0.55, 'rgba(0,0,0,0)');
    term.addColorStop(1, 'rgba(8,2,2,0.72)');
    sc.fillStyle = term;
    sc.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    sc.restore();
    sc.strokeStyle = rgba('#ff9a5a', 0.45);
    sc.lineWidth = 3;
    sc.beginPath();
    sc.arc(cx, cy, r - 1, -Math.PI * 0.62, Math.PI * 0.12);
    sc.stroke();
    sc.strokeStyle = rgba('#ff7a3a', 0.14);
    sc.lineWidth = 8;
    sc.beginPath();
    sc.arc(cx, cy, r + 4, -Math.PI * 0.68, Math.PI * 0.18);
    sc.stroke();
    /* Phobos, a small potato-shaped moon lit from the upper right */
    const px = 420, py = 520, pr = 14;
    const pg = sc.createRadialGradient(px + 5, py - 6, 2, px, py, pr);
    pg.addColorStop(0, shade('#9a8a78', 0.25));
    pg.addColorStop(1, shade('#9a8a78', -0.65));
    sc.fillStyle = pg;
    sc.beginPath();
    sc.arc(px, py, pr, 0, TWO_PI);
    sc.fill();
    sc.fillStyle = rgba('#241f18', 0.5);
    sc.beginPath();
    sc.arc(px - 4, py + 3, 3.5, 0, TWO_PI);
    sc.fill();
  }

  function paintAsteroidBelt(sc, rnd, theme) {
    const sx = 1150, sy = 80;
    const glow = sc.createRadialGradient(sx, sy, 0, sx, sy, 260);
    glow.addColorStop(0, rgba('#fff2cc', 0.85));
    glow.addColorStop(0.22, rgba('#ffe4ae', 0.32));
    glow.addColorStop(1, rgba('#fff2cc', 0));
    sc.fillStyle = glow;
    sc.beginPath();
    sc.arc(sx, sy, 260, 0, TWO_PI);
    sc.fill();
    sc.fillStyle = rgba('#fffbe8', 0.9);
    sc.beginPath();
    sc.arc(sx, sy, 15, 0, TWO_PI);
    sc.fill();
    for (let i = 0; i < 900; ++i) {
      const x = rnd() * W;
      const y = 360 + (rnd() + rnd() + rnd() - 1.5) * 150;
      const s = rnd() < 0.82 ? 1 : 2;
      sc.fillStyle = rgba(theme.nebula[i % 2], 0.10 + rnd() * 0.32);
      sc.fillRect(x, y, s, s);
    }
  }

  function paintJupiter(sc, rnd) {
    const cx = 1060, cy = 900, r = 420;
    sc.save();
    sc.beginPath();
    sc.arc(cx, cy, r, 0, TWO_PI);
    sc.clip();
    const body = sc.createRadialGradient(cx - r * 0.4, cy - r * 0.55, r * 0.15, cx, cy, r);
    body.addColorStop(0, '#f0e2c2');
    body.addColorStop(0.55, '#c89a5e');
    body.addColorStop(1, '#3c2814');
    sc.fillStyle = body;
    sc.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    const bandColors = ['#efe1c0', '#d9b988', '#c98a4c', '#a86a34', '#8a4c26', '#e6cfa4', '#b8794a', '#c98a4c', '#96592e'];
    for (let b = 0; b < bandColors.length; ++b) {
      const yTop = cy - r + b * (2 * r / bandColors.length);
      wavyBand(sc, cx - r, cx + r, yTop, yTop + 2 * r / bandColors.length,
        7 + rnd() * 11, 0.006 + rnd() * 0.007, rnd() * TWO_PI, rgba(bandColors[b], 0.42));
    }
    /* the Great Red Spot, an oval storm with a lighter swirl */
    const gx = 950, gy = 640;
    sc.fillStyle = rgba('#a83c22', 0.85);
    sc.beginPath();
    sc.ellipse(gx, gy, 78, 44, -0.1, 0, TWO_PI);
    sc.fill();
    sc.fillStyle = rgba('#c85a34', 0.7);
    sc.beginPath();
    sc.ellipse(gx - 8, gy - 4, 48, 26, -0.1, 0, TWO_PI);
    sc.fill();
    sc.strokeStyle = rgba('#e8b088', 0.35);
    sc.lineWidth = 3;
    sc.beginPath();
    sc.ellipse(gx, gy, 64, 34, -0.1, 0, TWO_PI);
    sc.stroke();
    const limb = sc.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    limb.addColorStop(0, 'rgba(0,0,0,0)');
    limb.addColorStop(1, 'rgba(10,5,2,0.55)');
    sc.fillStyle = limb;
    sc.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    sc.restore();
    sc.strokeStyle = rgba('#ffe6c0', 0.22);
    sc.lineWidth = 3;
    sc.beginPath();
    sc.arc(cx, cy, r - 1, Math.PI * 1.05, Math.PI * 1.7);
    sc.stroke();
  }

  function paintSaturn(sc, rnd) {
    const cx = 1050, cy = 560, r = 170;
    const tilt = -0.34;
    const squash = 0.34;
    const rings = [
      [1.28, 1.40, '#b09058', 0.35],
      [1.44, 1.66, '#e0c890', 0.62],
      [1.70, 1.76, '#c8a868', 0.30],
      [1.82, 2.06, '#d8bc80', 0.55],
      [2.12, 2.20, '#a8874a', 0.28]
    ];
    function ringHalf(back) {
      sc.save();
      sc.translate(cx, cy);
      sc.rotate(tilt);
      const a0 = back ? Math.PI : 0;
      const a1 = back ? TWO_PI : Math.PI;
      for (let i = 0; i < rings.length; ++i) {
        const ring = rings[i];
        const rx1 = ring[0] * r, rx2 = ring[1] * r;
        sc.beginPath();
        sc.ellipse(0, 0, rx2, rx2 * squash, 0, a0, a1);
        sc.ellipse(0, 0, rx1, rx1 * squash, 0, a1, a0, true);
        sc.closePath();
        sc.fillStyle = rgba(ring[2], ring[3]);
        sc.fill();
      }
      sc.restore();
    }
    ringHalf(true);
    sc.save();
    sc.beginPath();
    sc.arc(cx, cy, r, 0, TWO_PI);
    sc.clip();
    const body = sc.createRadialGradient(cx - r * 0.4, cy - r * 0.5, r * 0.15, cx, cy, r);
    body.addColorStop(0, '#f4e6b8');
    body.addColorStop(0.55, '#d4b46e');
    body.addColorStop(1, '#5c4822');
    sc.fillStyle = body;
    sc.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    const bandColors = ['#f0e0b0', '#d8bc78', '#c0a058', '#e8d49c', '#b89850'];
    for (let b = 0; b < bandColors.length; ++b) {
      const yTop = cy - r + b * (2 * r / bandColors.length);
      wavyBand(sc, cx - r, cx + r, yTop, yTop + 2 * r / bandColors.length,
        5 + rnd() * 7, 0.012 + rnd() * 0.01, rnd() * TWO_PI, rgba(bandColors[b], 0.4));
    }
    /* the ring plane casts a thin shadow across the globe */
    sc.save();
    sc.translate(cx, cy);
    sc.rotate(tilt);
    sc.fillStyle = 'rgba(20,12,4,0.30)';
    sc.fillRect(-r, 6, 2 * r, 12);
    sc.restore();
    const limb = sc.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    limb.addColorStop(0, 'rgba(0,0,0,0)');
    limb.addColorStop(1, 'rgba(12,8,2,0.5)');
    sc.fillStyle = limb;
    sc.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    sc.restore();
    ringHalf(false);
  }

  function paintMothership(sc, rnd, theme) {
    const vpX = 640, vpY = -560;
    const edgeY = function(x) {
      const t = (x - 640) / 640;
      return 384 - 128 * t * t;
    };
    function hullPath(c) {
      c.beginPath();
      c.moveTo(-40, -40);
      c.lineTo(W + 40, -40);
      c.lineTo(W + 40, edgeY(W + 40));
      c.quadraticCurveTo(640, edgeY(640) + 34, -40, edgeY(-40));
      c.closePath();
    }
    sc.save();
    hullPath(sc);
    sc.clip();
    const hull = sc.createLinearGradient(0, 0, 0, 420);
    hull.addColorStop(0, '#2c1a44');
    hull.addColorStop(0.6, '#180d28');
    hull.addColorStop(1, '#0c0616');
    sc.fillStyle = hull;
    sc.fillRect(-40, -40, W + 80, 480);
    /* plate seams: arcs parallel to the lower hull edge */
    sc.strokeStyle = rgba('#4a3468', 0.55);
    sc.lineWidth = 2;
    for (let f = 0.3; f < 1; f += 0.17) {
      sc.beginPath();
      for (let x = -40; x <= W + 40; x += 40) {
        const y = vpY + (edgeY(x) - vpY) * f;
        if (x === -40) sc.moveTo(x, y);
        else sc.lineTo(x, y);
      }
      sc.stroke();
    }
    /* perspective ribs converging to the vanishing point above the screen */
    sc.strokeStyle = rgba('#3a2854', 0.5);
    for (let k = -7; k <= 7; ++k) {
      const x = 640 + k * 96;
      sc.beginPath();
      sc.moveTo(vpX + (x - vpX) * 0.06, vpY + (edgeY(x) - vpY) * 0.06);
      sc.lineTo(x, edgeY(x) + 20);
      sc.stroke();
    }
    /* glowing violet window strips along two seams */
    for (let s = 0; s < 2; ++s) {
      const f = 0.66 + s * 0.18;
      for (let k = -9; k <= 9; ++k) {
        const x = 640 + k * 68;
        const y = vpY + (edgeY(x) - vpY) * f;
        const wg = sc.createRadialGradient(x, y, 0, x, y, 14);
        wg.addColorStop(0, rgba(theme.nebula[1], 0.5));
        wg.addColorStop(1, rgba(theme.nebula[1], 0));
        sc.fillStyle = wg;
        sc.fillRect(x - 14, y - 14, 28, 28);
        sc.fillStyle = rgba('#d890ff', 0.85);
        sc.fillRect(x - 5, y - 2, 10, 4);
      }
    }
    /* three big engine ports near the lower edge */
    const ports = [[400, 300], [640, 344], [880, 300]];
    for (let i = 0; i < ports.length; ++i) {
      const px = ports[i][0], py = ports[i][1];
      const eg = sc.createRadialGradient(px, py, 4, px, py, 74);
      eg.addColorStop(0, '#f2d4ff');
      eg.addColorStop(0.3, rgba(theme.nebula[1], 0.85));
      eg.addColorStop(1, rgba(theme.nebula[1], 0));
      sc.fillStyle = eg;
      sc.beginPath();
      sc.arc(px, py, 74, 0, TWO_PI);
      sc.fill();
      sc.strokeStyle = rgba('#120a1e', 0.9);
      sc.lineWidth = 6;
      sc.beginPath();
      sc.arc(px, py, 30, 0, TWO_PI);
      sc.stroke();
      sc.fillStyle = rgba('#eab8ff', 0.9);
      sc.beginPath();
      sc.arc(px, py, 16, 0, TWO_PI);
      sc.fill();
    }
    sc.restore();
    /* violet rim light along the hull edge */
    hullPath(sc);
    sc.strokeStyle = rgba(theme.nebula[1], 0.30);
    sc.lineWidth = 3;
    sc.stroke();
    sc.strokeStyle = rgba(theme.nebula[1], 0.10);
    sc.lineWidth = 10;
    sc.stroke();
  }

  /* ── build one backdrop ── */

  function create(themeName) {
    const name = THEMES[themeName] ? themeName : 'moon';
    const theme = THEMES[name];
    const rnd = mulberry32(THEME_NAMES.indexOf(name) + 1);

    /* the opaque sky: gradient, nebula band, static stars, celestial body */
    const sky = makeCanvas(W, H);
    const sc = sky.getContext('2d');
    const grad = sc.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.sky[0]);
    grad.addColorStop(1, theme.sky[1]);
    sc.fillStyle = grad;
    sc.fillRect(0, 0, W, H);
    const bx0 = -120, by0 = 640, bx1 = 1400, by1 = 120;
    const bdx = bx1 - bx0, bdy = by1 - by0;
    const blen = Math.sqrt(bdx * bdx + bdy * bdy);
    const bnx = -bdy / blen, bny = bdx / blen;
    const clouds = 10 + Math.floor(rnd() * 5);
    for (let i = 0; i < clouds; ++i) {
      const u = rnd();
      const off = (rnd() - 0.5) * 320;
      const cx = bx0 + bdx * u + bnx * off;
      const cy = by0 + bdy * u + bny * off;
      const cr = 120 + rnd() * 240;
      const col = theme.nebula[i % 2];
      const a = 0.06 + rnd() * 0.10;
      const g = sc.createRadialGradient(cx, cy, 0, cx, cy, cr);
      g.addColorStop(0, rgba(col, a));
      g.addColorStop(0.5, rgba(col, a * 0.45));
      g.addColorStop(1, rgba(col, 0));
      sc.fillStyle = g;
      sc.beginPath();
      sc.arc(cx, cy, cr, 0, TWO_PI);
      sc.fill();
    }
    for (let i = 0; i < 400; ++i) {
      sc.fillStyle = rgba(STAR_COLORS[Math.floor(rnd() * STAR_COLORS.length)], 0.2 + rnd() * 0.4);
      sc.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1);
    }
    if (theme.body === 'moon') paintMoon(sc, rnd);
    else if (theme.body === 'mars') paintMars(sc, rnd);
    else if (theme.body === 'asteroids') paintAsteroidBelt(sc, rnd, theme);
    else if (theme.body === 'jupiter') paintJupiter(sc, rnd);
    else if (theme.body === 'saturn') paintSaturn(sc, rnd);
    else paintMothership(sc, rnd, theme);

    /* scrolling star dots, grouped by colour and alpha bucket at build time */
    const layerA = [];
    const layerB = [];
    (function() {
      const mapA = {};
      for (let i = 0; i < 140; ++i) {
        const color = STAR_COLORS[Math.floor(rnd() * STAR_COLORS.length)];
        const alpha = 0.5 + rnd() * 0.5;
        const bucket = Math.round(alpha * 4) / 4;
        const key = color + '|' + bucket;
        if (!mapA[key]) {
          mapA[key] = { style: rgba(color, bucket), pts: [] };
          layerA.push(mapA[key]);
        }
        mapA[key].pts.push(Math.floor(rnd() * W), Math.floor(rnd() * H));
      }
    })();
    const bStars = [];
    for (let i = 0; i < 70; ++i) {
      bStars.push({
        x: Math.floor(rnd() * W),
        y: Math.floor(rnd() * H),
        color: STAR_COLORS[Math.floor(rnd() * STAR_COLORS.length)],
        alpha: 0.5 + rnd() * 0.5
      });
    }

    /* theme extras: cached sprites only */
    const rocks = [];
    if (theme.body === 'asteroids') {
      const sprites = [];
      for (let i = 0; i < 6; ++i) {
        const size = 30 + Math.floor(rnd() * 60);
        const pad = 10;
        const cv = makeCanvas(size + 2 * pad, size + 2 * pad);
        const rc = cv.getContext('2d');
        const ccx = cv.width / 2, ccy = cv.height / 2, rr = size / 2;
        const verts = 7 + Math.floor(rnd() * 5);
        const outline = [];
        for (let v = 0; v < verts; ++v) {
          const a = v / verts * TWO_PI;
          const rad = rr * (0.72 + rnd() * 0.28);
          outline.push(ccx + Math.cos(a) * rad, ccy + Math.sin(a) * rad);
        }
        const path = function() {
          rc.beginPath();
          rc.moveTo(outline[0], outline[1]);
          for (let v = 2; v < outline.length; v += 2)
            rc.lineTo(outline[v], outline[v + 1]);
          rc.closePath();
        };
        const rg = rc.createRadialGradient(ccx - rr * 0.4, ccy - rr * 0.4, rr * 0.2, ccx, ccy, rr);
        rg.addColorStop(0, shade('#8a6a4a', 0.35));
        rg.addColorStop(1, shade('#8a6a4a', -0.5));
        path();
        rc.fillStyle = rg;
        rc.fill();
        rc.strokeStyle = shade('#8a6a4a', -0.75);
        rc.lineWidth = 2;
        path();
        rc.stroke();
        for (let c = 0; c < 4; ++c) {
          const a = rnd() * TWO_PI;
          const d = rnd() * rr * 0.6;
          rc.fillStyle = rgba('#241c12', 0.4);
          rc.beginPath();
          rc.arc(ccx + Math.cos(a) * d, ccy + Math.sin(a) * d, 2 + rnd() * 5, 0, TWO_PI);
          rc.fill();
        }
        rc.fillStyle = rgba('#c8b088', 0.35);
        rc.beginPath();
        rc.arc(ccx - rr * 0.35, ccy - rr * 0.35, rr * 0.22, 0, TWO_PI);
        rc.fill();
        sprites.push(cv);
      }
      for (let i = 0; i < 9; ++i) {
        const sprite = sprites[i % sprites.length];
        rocks.push({
          img: sprite,
          x: rnd() * (W + 240) - 120,
          y: rnd() * (H + 240) - 120,
          vx: (rnd() - 0.5) * 14,
          vy: 8 + rnd() * 16,
          rot: rnd() * TWO_PI,
          vrot: (rnd() - 0.5) * 0.7
        });
      }
    }
    const meteors = [];
    if (theme.body !== 'asteroids' && theme.body !== 'mothership') {
      const streak = makeCanvas(140, 20);
      const tc = streak.getContext('2d');
      const sg = tc.createLinearGradient(0, 10, 140, 10);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.72, 'rgba(255,248,232,0.55)');
      sg.addColorStop(1, '#ffffff');
      tc.fillStyle = sg;
      tc.fillRect(0, 8, 140, 4);
      tc.fillStyle = '#ffffff';
      tc.beginPath();
      tc.arc(136, 10, 2.4, 0, TWO_PI);
      tc.fill();
      const count = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < count; ++i) {
        meteors.push({
          img: streak,
          x0: rnd() * W,
          y0: rnd() * H * 0.5,
          dir: (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.4),
          span: 380 + rnd() * 260,
          cycle: 6.4 + rnd() * 1.6,
          phase: rnd() * 7
        });
      }
    }

    /* the area to cover: the play field, extended to what the canvas shows */
    function resolveView(view) {
      if (!view) return FULL_VIEW;
      const x0 = Number(view.x0), y0 = Number(view.y0), x1 = Number(view.x1), y1 = Number(view.y1);
      if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return FULL_VIEW;
      return { x0: x0, y0: y0, x1: x1, y1: y1 };
    }

    /* the cached sky already fills the play field; a view reaching past it gets
       the whole sky scaled up to cover it, centred, so no edge pixel is smeared
       into a long streak */
    function drawSkyInto(c, v) {
      if (v.x0 === 0 && v.y0 === 0 && v.x1 === W && v.y1 === H) {
        c.drawImage(sky, 0, 0);
        return;
      }
      const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
      const s = Math.max(vw / W, vh / H);
      const dw = W * s, dh = H * s;
      c.drawImage(sky, v.x0 + (vw - dw) / 2, v.y0 + (vh - dh) / 2, dw, dh);
    }

    /* the star field repeats every W x H, so a view that reaches past the play
       field gets the wrapped copies of every dot as well */
    function tiledDot(c, x, y, size, v) {
      const k0 = Math.ceil((v.x0 - x) / W), k1 = Math.ceil((v.x1 - x) / W) - 1;
      const m0 = Math.ceil((v.y0 - y) / H), m1 = Math.ceil((v.y1 - y) / H) - 1;
      for (let m = m0; m <= m1; ++m)
        for (let k = k0; k <= k1; ++k)
          c.fillRect(x + k * W, y + m * H, size, size);
    }

    function drawStars(c, t, v) {
      const dyA = t * 6, dyB = t * 18;
      for (let g = 0; g < layerA.length; ++g) {
        const grp = layerA[g];
        c.fillStyle = grp.style;
        const pts = grp.pts;
        for (let i = 0; i < pts.length; i += 2) {
          let y = pts[i + 1] + dyA;
          y = ((y % H) + H) % H;
          tiledDot(c, pts[i], y, 1, v);
        }
      }
      const groups = {};
      for (let i = 0; i < bStars.length; ++i) {
        const s = bStars[i];
        const eff = s.alpha * (0.75 + 0.25 * Math.sin(t * 3 + i));
        const bucket = Math.max(0.25, Math.round(eff * 4) / 4);
        const key = s.color + '|' + bucket;
        let grp = groups[key];
        if (!grp) {
          grp = groups[key] = { style: rgba(s.color, bucket), pts: [] };
        }
        grp.pts.push(s);
      }
      const keys = Object.keys(groups);
      for (let k = 0; k < keys.length; ++k) {
        const grp = groups[keys[k]];
        c.fillStyle = grp.style;
        const pts = grp.pts;
        for (let j = 0; j < pts.length; ++j) {
          const s = pts[j];
          let y = s.y + dyB;
          y = ((y % H) + H) % H;
          tiledDot(c, s.x, y, 2, v);
        }
      }
    }

    function drawExtras(c, t) {
      for (let i = 0; i < rocks.length; ++i) {
        const rk = rocks[i];
        const spanX = W + 240, spanY = H + 240;
        let x = rk.x + rk.vx * t;
        let y = rk.y + rk.vy * t;
        x = ((x + 120) % spanX + spanX) % spanX - 120;
        y = ((y + 120) % spanY + spanY) % spanY - 120;
        c.save();
        c.translate(x, y);
        c.rotate(rk.rot + rk.vrot * t);
        c.drawImage(rk.img, -rk.img.width / 2, -rk.img.height / 2);
        c.restore();
      }
      for (let i = 0; i < meteors.length; ++i) {
        const m = meteors[i];
        const local = (t + m.phase) % m.cycle;
        if (local >= 0.8) continue;
        const p = local / 0.8;
        const dx = Math.cos(m.dir) * m.span * p;
        const dy = Math.sin(Math.abs(m.dir) * 1.1) * m.span * 0.55 * p;
        c.save();
        c.globalAlpha = Math.sin(p * Math.PI);
        c.translate(m.x0 + dx, m.y0 + dy);
        c.rotate(m.dir);
        c.drawImage(m.img, -m.img.width, -m.img.height / 2);
        c.restore();
      }
    }

    function drawSky(c) {
      c.drawImage(sky, 0, 0);
    }

    /* view is optional: without it only the 1280x720 play field is covered */
    function draw(c, t, view) {
      c.globalAlpha = 1;
      const v = resolveView(view);
      drawSkyInto(c, v);
      drawStars(c, t, v);
      drawExtras(c, t);
      c.globalAlpha = 1;
    }

    return Object.freeze({
      theme: theme,
      drawSky: drawSky,
      draw: draw
    });
  }

  SZ.InvaderBackdrop = Object.freeze({ THEMES, create });
})();
