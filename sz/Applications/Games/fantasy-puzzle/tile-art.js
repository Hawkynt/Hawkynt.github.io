;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Tile art for the Fantasy Puzzle: five realms, eleven tile kinds and an
   * animated mage. Every tile and every hero frame is painted ONCE into a cached
   * canvas at 2x resolution -- bevels, ambient occlusion, texture noise, carved
   * glyphs and glows are all baked in there. The per-frame draw functions only
   * blit, so a whole board stays cheap: no blur filters, no gradients and at
   * most two drawImage calls per element per frame.
   *
   * getTile(theme, code, variant) hands back a 128 x 128 canvas; drawTile blits
   * it at (x, y) as a 64 x 64 tile. The variant (0..3) picks a seeded variation
   * so floors and walls never look stamped, and water carries an animation frame.
   */

  const TWO_PI = Math.PI * 2;
  const SCALE = 2;
  const TILE = 64;
  const CANVAS = TILE * SCALE;   // 128

  const T = {
    FLOOR: 0, WALL: 1, WOOD: 2, CHANNEL: 3, WATER: 4,
    BOULDER: 5, STONE: 6, CHASM: 7, ICE: 8, GOAL: 9, RUNE: 10
  };

  const THEMES = Object.freeze({
    0: Object.freeze({
      name: 'Ember Grove', floor: '#6a5a44', floorAlt: '#5c4e3a', wall: '#4a3b2c',
      wallTop: '#7a6448', accent: '#ff7a3a', water: '#3a8ad0', glow: '#ffb36a'
    }),
    1: Object.freeze({
      name: 'Tide Caverns', floor: '#3e5a66', floorAlt: '#34505c', wall: '#24363e',
      wallTop: '#4a6a78', accent: '#3ab4ff', water: '#2a9ae0', glow: '#8ae0ff'
    }),
    2: Object.freeze({
      name: 'Stone Peaks', floor: '#7a7468', floorAlt: '#6c665a', wall: '#4e4a42',
      wallTop: '#9a9284', accent: '#c9a36a', water: '#4a90c8', glow: '#ffe0a0'
    }),
    3: Object.freeze({
      name: 'Sky Ruins', floor: '#c8c0b0', floorAlt: '#b8b0a0', wall: '#8a8a9a',
      wallTop: '#e0dcd0', accent: '#7ad0ff', water: '#5ab0e8', glow: '#e8f8ff'
    }),
    4: Object.freeze({
      name: 'Elemental Sanctum', floor: '#3a2a4a', floorAlt: '#32243f', wall: '#221830',
      wallTop: '#4e3a64', accent: '#c04cff', water: '#4a7ae0', glow: '#e0a8ff'
    })
  });

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

  function hexToRgba(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  /* blend two colours, t = 0 gives a, t = 1 gives b */
  function mix(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return '#' + channel(a.r + (b.r - a.r) * t) + channel(a.g + (b.g - a.g) * t) + channel(a.b + (b.b - a.b) * t);
  }

  function themeOf(theme) {
    return THEMES[theme] !== undefined ? THEMES[theme] : THEMES[0];
  }

  /* ── deterministic noise: the same tile always paints the same way ── */

  function seeded(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return function() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rr(rng, lo, hi) {
    return lo + (hi - lo) * rng();
  }

  /* ── shared painting helpers ── */

  function roundRectPath(ctx, x, y, w, h, r) {
    const k = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + w - k, y);
    ctx.arcTo(x + w, y, x + w, y + k, k);
    ctx.lineTo(x + w, y + h - k);
    ctx.arcTo(x + w, y + h, x + w - k, y + h, k);
    ctx.lineTo(x + k, y + h);
    ctx.arcTo(x, y + h, x, y + h - k, k);
    ctx.lineTo(x, y + k);
    ctx.arcTo(x, y, x + k, y, k);
    ctx.closePath();
  }

  function polyPath(ctx, pts) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; ++i) {
      if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
      else ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
  }

  /* Soft baked glow: a radial gradient fading to transparent. */
  function glowDot(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexToRgba(color, alpha));
    g.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
  }

  /* A scatter of tiny dots: moss, embers, grit, frost. */
  function speckle(ctx, rng, x, y, w, h, n, color, alpha, rmin, rmax) {
    ctx.fillStyle = hexToRgba(color, alpha);
    for (let i = 0; i < n; ++i) {
      ctx.beginPath();
      ctx.arc(x + rng() * w, y + rng() * h, rmin + rng() * (rmax - rmin), 0, TWO_PI);
      ctx.fill();
    }
  }

  /* A short jagged fissure walking away from (x, y) at angle ang. */
  function crack(ctx, rng, x, y, len, ang, color, width) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    let px = x, py = y, a = ang;
    for (let i = 0; i < 3; ++i) {
      a += rr(rng, -0.55, 0.55);
      px += Math.cos(a) * len / 3;
      py += Math.sin(a) * len / 3;
      ctx.lineTo(px, py);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  /* Soft shadow along the tile edges -- the board reads as raised stone. */
  function innerAO(ctx, depth) {
    let g = ctx.createLinearGradient(0, 0, 0, 11);
    g.addColorStop(0, 'rgba(0,0,0,' + (depth * 0.6).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TILE, 11);
    g = ctx.createLinearGradient(0, 0, 11, 0);
    g.addColorStop(0, 'rgba(0,0,0,' + (depth * 0.6).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 11, TILE);
    g = ctx.createLinearGradient(0, TILE, 0, TILE - 13);
    g.addColorStop(0, 'rgba(0,0,0,' + depth.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, TILE - 13, TILE, 13);
    g = ctx.createLinearGradient(TILE, 0, TILE - 13, 0);
    g.addColorStop(0, 'rgba(0,0,0,' + depth.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(TILE - 13, 0, 13, TILE);
  }

  /* Six rune glyphs as polylines in a -1..1 box. */
  const GLYPHS = [
    [[[0, 1], [0, -1]], [[0, -0.6], [0.8, -1]], [[0, -0.1], [0.8, -0.5]]],
    [[[-0.8, 0], [0, -1], [0.8, 0], [0, 1], [-0.8, 0]], [[-0.8, 0], [0.8, 0]]],
    [[[-0.7, -1], [0.7, -1], [0, 0], [0.7, 1], [-0.7, 1]]],
    [[[0.9, 0], [0.45, 0.78], [-0.45, 0.78], [-0.9, 0], [-0.45, -0.78], [0.45, -0.78], [0.9, 0]], [[0, -1], [0, 1]]],
    [[[0, 1], [0, -1]], [[-0.7, -0.3], [0, -1], [0.7, -0.3]], [[-0.45, 0.45], [0.45, 0.45]]],
    [[[-0.8, 0.6], [-0.3, -0.6], [0.2, 0.6], [0.7, -0.6]]]
  ];

  function glyphPath(ctx, glyph, cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < glyph.length; ++i) {
      const line = glyph[i];
      for (let k = 0; k < line.length; ++k) {
        const x = cx + line[k][0] * s, y = cy + line[k][1] * s;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
  }

  /* A glyph cut into stone: lit lip, dark recess, optional faint glow. */
  function carveGlyph(ctx, glyph, cx, cy, s, lipColor, glowColor, glowAlpha) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    glyphPath(ctx, glyph, cx + 0.9, cy + 1.1, s);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = hexToRgba(lipColor, 0.45);
    ctx.stroke();
    glyphPath(ctx, glyph, cx, cy, s);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();
    if (glowColor) {
      glyphPath(ctx, glyph, cx, cy, s);
      ctx.lineWidth = 1;
      ctx.strokeStyle = hexToRgba(glowColor, glowAlpha);
      ctx.stroke();
    }
  }

  /* ── flagstones: the ground every other tile sits on ── */

  const FLAG_LAYOUTS = [
    [[3, 3, 58, 27], [3, 34, 58, 27]],
    [[3, 3, 27, 58], [34, 3, 27, 58]],
    [[3, 3, 34, 58], [41, 3, 20, 27], [41, 34, 20, 27]],
    [[3, 3, 27, 27], [34, 3, 27, 27], [3, 34, 27, 27], [34, 34, 27, 27]]
  ];

  function flagstone(ctx, x, y, w, h, fill, rng) {
    roundRectPath(ctx, x, y, w, h, 3);
    const g = ctx.createLinearGradient(x, y, x + w * 0.35, y + h);
    g.addColorStop(0, shade(fill, 0.18));
    g.addColorStop(0.5, fill);
    g.addColorStop(1, shade(fill, -0.18));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = hexToRgba(shade(fill, 0.55), 0.45);
    ctx.beginPath();
    ctx.moveTo(x + 2, y + h - 4);
    ctx.lineTo(x + 2.5, y + 2.5);
    ctx.lineTo(x + w - 4, y + 2);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba(shade(fill, -0.6), 0.5);
    ctx.beginPath();
    ctx.moveTo(x + w - 2, y + 4);
    ctx.lineTo(x + w - 2.5, y + h - 2.5);
    ctx.lineTo(x + 4, y + h - 2);
    ctx.stroke();
    if (rng() < 0.35) {
      crack(ctx, rng, x + rr(rng, 4, w - 4), y + rr(rng, 4, h - 4), rr(rng, 5, 10), rr(rng, 0, TWO_PI),
        hexToRgba(shade(fill, -0.55), 0.5), 0.8);
    }
    ctx.restore();
    const chips = Math.floor(rng() * 2);
    for (let i = 0; i < chips; ++i) {
      const cx = x + rr(rng, 3, w - 5), cy = y + rr(rng, 3, h - 5);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + rr(rng, 1.5, 3.5), cy + rr(rng, -1.5, 1.5));
      ctx.lineTo(cx + rr(rng, 0, 1.5), cy + rr(rng, 1.5, 3.5));
      ctx.closePath();
      ctx.fillStyle = hexToRgba(shade(fill, -0.5), 0.45);
      ctx.fill();
    }
  }

  function paintFloor(ctx, th, rng, variant) {
    ctx.fillStyle = shade(th.floor, -0.32);
    ctx.fillRect(0, 0, TILE, TILE);
    const rects = FLAG_LAYOUTS[variant & 3];
    for (let i = 0; i < rects.length; ++i) {
      const r = rects[i];
      flagstone(ctx, r[0] + rr(rng, -1.5, 1.5), r[1] + rr(rng, -1.5, 1.5), r[2], r[3],
        i % 2 ? th.floorAlt : shade(th.floor, 0.08), rng);
    }
    speckle(ctx, rng, 4, 4, 56, 56, 4, th.accent, 0.22, 0.6, 1.2);
    speckle(ctx, rng, 4, 4, 56, 56, 5, shade(th.floor, -0.35), 0.4, 0.4, 1.0);
    innerAO(ctx, 0.18);
  }

  /* ── wall: a solid raised block -- tall dark front face under a lit top,
        and the shadow it throws at its foot onto the walkway ── */

  function paintWall(ctx, th, rng, variant) {
    ctx.fillStyle = shade(th.wall, -0.75);
    ctx.fillRect(0, 0, TILE, TILE);
    const x0 = 2, x1 = 62, topY = 2, faceY = 14, faceBot = 54;
    // contact shadow along the foot of the block
    let g = ctx.createLinearGradient(0, faceBot, 0, TILE);
    g.addColorStop(0, 'rgba(0,0,0,0.7)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.36)');
    g.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(0, faceBot, TILE, TILE - faceBot);
    // front face: tall, dark, plainly masonry
    roundRectPath(ctx, x0, faceY, x1 - x0, faceBot - faceY, 2);
    g = ctx.createLinearGradient(0, faceY, 0, faceBot);
    g.addColorStop(0, shade(th.wall, -0.05));
    g.addColorStop(0.55, shade(th.wall, -0.3));
    g.addColorStop(1, shade(th.wall, -0.62));
    ctx.fillStyle = g;
    ctx.fill();
    // lit top face, thin enough that the face below it reads as height
    roundRectPath(ctx, x0, topY, x1 - x0, faceY - topY + 2, 3);
    g = ctx.createLinearGradient(0, topY, 0, faceY + 2);
    g.addColorStop(0, shade(th.wallTop, 0.42));
    g.addColorStop(1, shade(th.wallTop, 0.05));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = hexToRgba(shade(th.wallTop, 0.8), 0.6);
    ctx.beginPath();
    ctx.moveTo(x0 + 3, topY + 2);
    ctx.lineTo(x1 - 4, topY + 1.5);
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.moveTo(x0 + 1, faceY + 1);
    ctx.lineTo(x1 - 1, faceY + 1);
    ctx.stroke();
    // masonry seams on the front face
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(shade(th.wall, -0.7), 0.6);
    ctx.beginPath();
    ctx.moveTo(32, faceY + 3);
    ctx.lineTo(32, faceBot - 2);
    ctx.moveTo(x0 + 2, (faceY + faceBot) / 2);
    ctx.lineTo(x1 - 2, (faceY + faceBot) / 2);
    ctx.stroke();
    // a carved seal on one variant in four, nothing else on the faces
    if (variant === 2)
      carveGlyph(ctx, GLYPHS[4], 32, 36, 9, shade(th.wallTop, 0.4), null, 0);
    speckle(ctx, rng, 4, faceY + 3, 56, faceBot - faceY - 6, 10, shade(th.wall, 0.35), 0.14, 0.5, 1.4);
    speckle(ctx, rng, 4, topY, 56, faceY - topY, 5, shade(th.wallTop, -0.4), 0.16, 0.5, 1.2);
    innerAO(ctx, 0.12);
  }

  /* ── wood: a pile of cut logs with bark grain and growth rings ── */

  function logRings(ctx, cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TWO_PI);
    const g = ctx.createRadialGradient(cx - 1, cy - 1, 1, cx, cy, rx);
    g.addColorStop(0, '#e6c894');
    g.addColorStop(0.6, '#c8a06a');
    g.addColorStop(1, '#8a6238');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#3e2a18';
    ctx.stroke();
    for (let i = 1; i <= 2; ++i) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * i / 3.2, ry * i / 3.2, 0, 0, TWO_PI);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(110,70,35,0.7)';
      ctx.stroke();
    }
  }

  function logH(ctx, x, y, w, h, rng) {
    roundRectPath(ctx, x, y, w, h, h / 2);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#8a6238');
    g.addColorStop(0.35, '#6a4a2a');
    g.addColorStop(1, '#3e2a18');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#2e1e10';
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(30,18,8,0.35)';
    for (let i = 0; i < 5; ++i) {
      const gy = y + h * (0.15 + 0.7 * rng());
      ctx.beginPath();
      ctx.moveTo(x + 3, gy);
      ctx.bezierCurveTo(x + w * 0.3, gy + rr(rng, -2, 2), x + w * 0.7, gy + rr(rng, -2, 2), x + w - 3, gy);
      ctx.stroke();
    }
    ctx.restore();
    logRings(ctx, x + w - h * 0.4, y + h / 2, h * 0.32, h * 0.4);
  }

  function paintWood(ctx, th, rng, variant) {
    paintFloor(ctx, th, rng, variant);
    ctx.save();
    if ((variant & 1) === 1) {
      ctx.translate(32, 32);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-32, -32);
    }
    ctx.beginPath();
    ctx.ellipse(33, 55, 24, 6, 0, 0, TWO_PI);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    logH(ctx, 6, 40, 26, 16, rng);
    logH(ctx, 32, 40, 26, 16, rng);
    logH(ctx, 13, 24, 38, 16, rng);
    ctx.restore();
    speckle(ctx, rng, 8, 50, 48, 12, 4, '#6a4a2a', 0.5, 0.5, 1.2);
    innerAO(ctx, 0.12);
  }

  /* ── channel: a dry carved trench sunk into the flagstones ── */

  const CH_X = 8, CH_Y = 8, CH_W = 48, CH_H = 48;

  function trenchPath(ctx) {
    roundRectPath(ctx, CH_X, CH_Y, CH_W, CH_H, 5);
  }

  function paintChannel(ctx, th, rng, variant) {
    paintFloor(ctx, th, rng, variant);
    roundRectPath(ctx, CH_X - 3, CH_Y - 3, CH_W + 6, CH_H + 6, 6);
    ctx.fillStyle = hexToRgba(shade(th.floor, 0.3), 0.45);
    ctx.fill();
    trenchPath(ctx);
    const g = ctx.createLinearGradient(0, CH_Y, 0, CH_Y + CH_H);
    g.addColorStop(0, shade(th.floor, -0.66));
    g.addColorStop(0.55, shade(th.floor, -0.48));
    g.addColorStop(1, shade(th.floor, -0.3));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    trenchPath(ctx);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(CH_X, CH_Y, CH_W, 8);
    ctx.fillRect(CH_X, CH_Y, 8, CH_H);
    const lg = ctx.createLinearGradient(0, CH_Y + CH_H - 12, 0, CH_Y + CH_H);
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(1, hexToRgba(shade(th.floor, 0.35), 0.4));
    ctx.fillStyle = lg;
    ctx.fillRect(CH_X, CH_Y + CH_H - 12, CH_W, 12);
    for (let i = 0; i < 4; ++i) {
      crack(ctx, rng, rr(rng, CH_X + 8, CH_X + CH_W - 8), rr(rng, CH_Y + 10, CH_Y + CH_H - 10),
        9, rr(rng, 0, TWO_PI), hexToRgba(shade(th.floor, -0.85), 0.7), 0.9);
    }
    speckle(ctx, rng, CH_X + 6, CH_Y + 10, CH_W - 12, CH_H - 16, 6, shade(th.floor, -0.3), 0.4, 0.4, 1.1);
    ctx.restore();
    innerAO(ctx, 0.12);
  }

  /* ── water: the same trench filled, four ripple frames ── */

  function paintWater(ctx, th, rng, frame) {
    paintChannel(ctx, th, rng, 0);
    roundRectPath(ctx, CH_X + 2, CH_Y + 2, CH_W - 4, CH_H - 4, 4);
    const g = ctx.createLinearGradient(0, CH_Y, 0, CH_Y + CH_H);
    g.addColorStop(0, shade(th.water, -0.4));
    g.addColorStop(0.4, th.water);
    g.addColorStop(1, shade(th.water, 0.2));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    roundRectPath(ctx, CH_X + 2, CH_Y + 2, CH_W - 4, CH_H - 4, 4);
    ctx.clip();
    const phase = frame * TWO_PI / 4;
    for (let i = 0; i < 3; ++i) {
      const ry = CH_Y + 12 + i * 12;
      ctx.beginPath();
      for (let k = 0; k <= 14; ++k) {
        const t = k / 14;
        const px = CH_X + 4 + t * (CH_W - 8);
        const py = ry + Math.sin(t * 7 + phase + i * 1.3) * 2.2;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = hexToRgba(shade(th.water, 0.55), 0.32);
      ctx.stroke();
    }
    const hx = CH_X + 8 + (CH_W - 16) * ((frame + 0.5) / 4);
    glowDot(ctx, hx, CH_Y + 14, 9, '#ffffff', 0.35);
    glowDot(ctx, CH_X + CH_W - 8 - (hx - CH_X), CH_Y + 34, 7, shade(th.water, 0.7), 0.3);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = hexToRgba(th.glow, 0.3);
    roundRectPath(ctx, CH_X + 2.5, CH_Y + 2.5, CH_W - 5, CH_H - 5, 4);
    ctx.stroke();
    ctx.restore();
    innerAO(ctx, 0.12);
  }

  /* ── boulder: a round rune-carved stone sitting on the ground ── */

  function paintBoulder(ctx, th, rng, variant) {
    paintFloor(ctx, th, rng, variant);
    const cx = 31 + rr(rng, -2, 2), cy = 32, r = 20;
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy + r - 2, r * 0.95, r * 0.4, 0, 0, TWO_PI);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    const g = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.15, cx, cy, r * 1.1);
    g.addColorStop(0, shade(th.wallTop, 0.4));
    g.addColorStop(0.5, th.wallTop);
    g.addColorStop(1, shade(th.wall, -0.2));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = shade(th.wall, -0.45);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.clip();
    const facets = [
      [[cx - r, cy - 4], [cx - 3, cy - r], [cx + 2, cy - 2]],
      [[cx + 2, cy - 2], [cx + r, cy - 6], [cx + r * 0.4, cy + r]]
    ];
    for (let i = 0; i < facets.length; ++i) {
      polyPath(ctx, facets[i]);
      ctx.fillStyle = i === 0 ? hexToRgba(shade(th.wallTop, 0.55), 0.35) : hexToRgba(shade(th.wall, -0.4), 0.4);
      ctx.fill();
    }
    const moss = mix('#4e7a44', th.floor, 0.45);
    for (let i = 0; i < 3; ++i) {
      ctx.beginPath();
      ctx.ellipse(cx + rr(rng, -r * 0.8, r * 0.3), cy + rr(rng, r * 0.1, r * 0.8),
        rr(rng, 3, 6), rr(rng, 2, 4), rr(rng, 0, 1), 0, TWO_PI);
      ctx.fillStyle = hexToRgba(moss, 0.55);
      ctx.fill();
    }
    speckle(ctx, rng, cx - r, cy - r, 2 * r, 2 * r, 8, shade(th.wall, -0.5), 0.25, 0.4, 1.1);
    carveGlyph(ctx, GLYPHS[(variant + 2) % GLYPHS.length], cx, cy - 1, 9, shade(th.wall, -0.6), th.glow, 0.35);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.5, Math.PI * 1.05, Math.PI * 1.55);
    ctx.lineWidth = 2;
    ctx.strokeStyle = hexToRgba(shade(th.wallTop, 0.8), 0.5);
    ctx.stroke();
    innerAO(ctx, 0.12);
  }

  /* ── stone: an earth-raised pillar -- a rough brown-grey rock column, wide
        at the foot, lopsided on top, cracked rather than cut ── */

  function paintStone(ctx, th, rng, variant) {
    paintFloor(ctx, th, rng, variant);
    const rock = mix(th.wallTop, '#6b5334', 0.55);
    const cx = 32, baseY = 54, topY = 12;
    ctx.beginPath();
    ctx.ellipse(cx + 2, baseY, 20, 6, 0, 0, TWO_PI);
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fill();
    // irregular boulder-like silhouette
    const pts = [
      [cx - 19 + rr(rng, -2, 2), baseY - 1],
      [cx - 16 + rr(rng, -2, 2), baseY - 13],
      [cx - 12 + rr(rng, -3, 3), topY + 6 + rr(rng, -2, 3)],
      [cx - 5 + rr(rng, -3, 3), topY + rr(rng, -2, 2)],
      [cx + 4 + rr(rng, -2, 3), topY - 1 + rr(rng, -1, 3)],
      [cx + 12 + rr(rng, -2, 3), topY + 7 + rr(rng, -2, 3)],
      [cx + 15 + rr(rng, -2, 2), baseY - 12],
      [cx + 18 + rr(rng, -2, 2), baseY - 1]
    ];
    polyPath(ctx, pts);
    const g = ctx.createLinearGradient(cx - 16, topY, cx + 16, baseY);
    g.addColorStop(0, shade(rock, 0.22));
    g.addColorStop(0.45, rock);
    g.addColorStop(1, shade(rock, -0.45));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = shade(rock, -0.6);
    ctx.stroke();
    ctx.save();
    polyPath(ctx, pts);
    ctx.clip();
    // one lit side, one shaded side -- a column, not a faceted wheel
    polyPath(ctx, [[cx - 20, baseY], [cx - 2, baseY], [cx - 4, topY - 2], [cx - 14, topY - 2]]);
    ctx.fillStyle = hexToRgba(shade(rock, 0.3), 0.3);
    ctx.fill();
    polyPath(ctx, [[cx + 4, baseY], [cx + 20, baseY], [cx + 16, topY - 2], [cx + 6, topY - 2]]);
    ctx.fillStyle = hexToRgba(shade(rock, -0.5), 0.38);
    ctx.fill();
    // cracks across the column and a seam down it
    for (let i = 0; i < 3; ++i) {
      const y = topY + 8 + i * 12 + rr(rng, -3, 3);
      crack(ctx, rng, cx - 14 + rr(rng, 0, 6), y, 22, rr(rng, -0.25, 0.25),
        hexToRgba(shade(rock, -0.75), 0.55), 1);
    }
    crack(ctx, rng, cx - 2 + rr(rng, -3, 3), topY + 4, 30, Math.PI / 2 + rr(rng, -0.3, 0.3),
      hexToRgba(shade(rock, -0.7), 0.45), 0.9);
    speckle(ctx, rng, cx - 18, topY, 36, baseY - topY, 12, shade(rock, -0.45), 0.3, 0.4, 1.2);
    speckle(ctx, rng, cx - 16, topY + 4, 30, baseY - topY - 8, 6, shade(rock, 0.5), 0.2, 0.4, 1.0);
    ctx.restore();
    // lit rim along the top of the column
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = hexToRgba(shade(rock, 0.65), 0.55);
    ctx.beginPath();
    ctx.moveTo(pts[2][0], pts[2][1]);
    ctx.lineTo(pts[3][0], pts[3][1]);
    ctx.lineTo(pts[4][0], pts[4][1]);
    ctx.lineTo(pts[5][0], pts[5][1]);
    ctx.stroke();
    innerAO(ctx, 0.12);
  }

  /* ── chasm: a broken pit with depth and an overhanging rim ── */

  function paintChasm(ctx, th, rng, variant) {
    paintFloor(ctx, th, rng, variant);
    const cx = 32, cy = 32, n = 11;
    const pts = [];
    for (let i = 0; i < n; ++i) {
      const a = (i / n) * TWO_PI;
      const rad = 22 + rr(rng, -4, 4);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    polyPath(ctx, pts);
    ctx.lineWidth = 3;
    ctx.strokeStyle = hexToRgba(shade(th.floor, 0.4), 0.5);
    ctx.stroke();
    polyPath(ctx, pts);
    const g = ctx.createRadialGradient(cx, cy - 6, 3, cx, cy, 26);
    g.addColorStop(0, '#04030a');
    g.addColorStop(0.55, '#0a0812');
    g.addColorStop(1, shade(th.wall, -0.55));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    polyPath(ctx, pts);
    ctx.clip();
    const og = ctx.createLinearGradient(0, cy - 24, 0, cy - 6);
    og.addColorStop(0, 'rgba(0,0,0,0.85)');
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, TILE, TILE);
    glowDot(ctx, cx, cy + 8, 10, th.glow, 0.12);
    ctx.restore();
    for (let i = 0; i < 4; ++i) {
      const a = rr(rng, 0, TWO_PI);
      crack(ctx, rng, cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 10, a,
        hexToRgba(shade(th.floor, -0.6), 0.6), 1);
    }
    for (let i = 0; i < 2; ++i) {
      const a = rr(rng, 0, TWO_PI), rad = rr(rng, 24, 28);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, rr(rng, 1.5, 2.6), 0, TWO_PI);
      ctx.fillStyle = th.wallTop;
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = shade(th.wall, -0.4);
      ctx.stroke();
    }
    innerAO(ctx, 0.14);
  }

  /* ── ice: a translucent block with facets and a cold glow ── */

  function paintIce(ctx, th, rng, variant) {
    paintFloor(ctx, th, rng, variant);
    const cold = '#bfe8ff';
    glowDot(ctx, 32, 32, 30, cold, 0.22);
    ctx.beginPath();
    ctx.ellipse(34, 50, 18, 6, 0, 0, TWO_PI);
    ctx.fillStyle = 'rgba(10,20,40,0.3)';
    ctx.fill();
    const hex = [[20, 14], [44, 14], [53, 31], [44, 49], [20, 49], [11, 31]];
    polyPath(ctx, hex);
    const g = ctx.createLinearGradient(11, 14, 53, 49);
    g.addColorStop(0, 'rgba(235,250,255,0.9)');
    g.addColorStop(0.45, 'rgba(150,205,240,0.72)');
    g.addColorStop(1, 'rgba(90,150,205,0.8)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = hexToRgba(cold, 0.9);
    ctx.stroke();
    ctx.save();
    polyPath(ctx, hex);
    ctx.clip();
    const facets = [[[20, 14], [32, 31], [11, 31]], [[44, 14], [53, 31], [32, 31]], [[20, 49], [32, 31], [44, 49]]];
    for (let i = 0; i < facets.length; ++i) {
      polyPath(ctx, facets[i]);
      ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(120,180,230,0.35)';
      ctx.fill();
    }
    crack(ctx, rng, 24, 20, 16, 1.2, 'rgba(255,255,255,0.5)', 1);
    crack(ctx, rng, 40, 24, 14, 2.2, 'rgba(255,255,255,0.4)', 0.8);
    speckle(ctx, rng, 14, 16, 36, 30, 8, '#ffffff', 0.35, 0.4, 1.1);
    ctx.restore();
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(17, 20);
    ctx.lineTo(24, 16);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(16, 26);
    ctx.lineTo(20, 23);
    ctx.stroke();
    glowDot(ctx, 32, 32, 14, th.glow, 0.1);
    innerAO(ctx, 0.12);
  }

  /* ── goal: a glowing circle base; the swirl itself is drawPortal ── */

  function paintGoal(ctx, th, rng, variant) {
    paintFloor(ctx, th, rng, variant);
    const cx = 32, cy = 32;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    g.addColorStop(0, hexToRgba(th.glow, 0.55));
    g.addColorStop(0.6, hexToRgba(th.glow, 0.2));
    g.addColorStop(1, hexToRgba(th.glow, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, TWO_PI);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, TWO_PI);
    ctx.lineWidth = 4;
    ctx.strokeStyle = hexToRgba(shade(th.floor, -0.65), 0.85);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = hexToRgba(th.glow, 0.5);
    ctx.stroke();
    for (let i = 0; i < 4; ++i) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * 21, cy + Math.sin(a) * 21, 2.2, 0, TWO_PI);
      ctx.fillStyle = hexToRgba(th.glow, 0.75);
      ctx.fill();
    }
    innerAO(ctx, 0.12);
  }

  /* ── rune: a seal carved faintly into the flagstones ── */

  function paintRune(ctx, th, rng, variant) {
    paintFloor(ctx, th, rng, variant);
    carveGlyph(ctx, GLYPHS[variant % GLYPHS.length], 32, 32, 16, shade(th.floor, -0.7), th.glow, 0.3);
    glowDot(ctx, 32, 32, 16, th.glow, 0.1);
  }

  function paintTile(ctx, th, code, variant, frame, rng) {
    switch (code) {
      case T.WALL: paintWall(ctx, th, rng, variant); break;
      case T.WOOD: paintWood(ctx, th, rng, variant); break;
      case T.CHANNEL: paintChannel(ctx, th, rng, variant); break;
      case T.WATER: paintWater(ctx, th, rng, frame); break;
      case T.BOULDER: paintBoulder(ctx, th, rng, variant); break;
      case T.STONE: paintStone(ctx, th, rng, variant); break;
      case T.CHASM: paintChasm(ctx, th, rng, variant); break;
      case T.ICE: paintIce(ctx, th, rng, variant); break;
      case T.GOAL: paintGoal(ctx, th, rng, variant); break;
      case T.RUNE: paintRune(ctx, th, rng, variant); break;
      default: paintFloor(ctx, th, rng, variant); break;
    }
  }

  /* ── the tile cache: paint once, blit forever ── */

  const tileCache = {};

  function codeOf(code) {
    const c = code | 0;
    return c >= 0 && c <= 10 ? c : T.FLOOR;
  }

  function wrap4(n) {
    const v = (n | 0) % 4;
    return v < 0 ? v + 4 : v;
  }

  function getTileFrame(theme, code, variant, frame) {
    const th = themeOf(theme);
    const c = codeOf(code);
    const v = wrap4(variant === undefined ? 0 : variant);
    const f = c === T.WATER ? wrap4(frame === undefined ? 0 : frame) : 0;
    const key = th.name + ':' + c + ':' + v + ':' + f;
    const hit = tileCache[key];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS;
    canvas.height = CANVAS;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    const rng = seeded(th.name.length * 7919 + c * 131 + v * 17 + f * 5 + 11);
    paintTile(ctx, th, c, v, f, rng);
    tileCache[key] = canvas;
    return canvas;
  }

  function getTile(theme, code, variant) {
    return getTileFrame(theme, code, variant, 0);
  }

  /* (x, y) is the tile top-left; frame animates water only. */
  function drawTile(ctx, theme, code, x, y, variant, frame) {
    const c = codeOf(code);
    const f = c === T.WATER ? wrap4(frame === undefined ? 0 : frame) : 0;
    ctx.drawImage(getTileFrame(theme, c, variant, f), x, y, TILE, TILE);
  }

  /* ── rune glow: a soft pulse plus the lit seal once collected ── */

  const runeGlowCache = {};

  function getRuneGlow(th) {
    const hit = runeGlowCache[th.name];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS;
    canvas.height = CANVAS;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    glowDot(ctx, 32, 32, 30, th.glow, 0.7);
    glowDot(ctx, 32, 32, 15, '#ffffff', 0.3);
    runeGlowCache[th.name] = canvas;
    return canvas;
  }

  function getRuneGlyph(th) {
    const key = 'g' + th.name;
    const hit = runeGlowCache[key];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS;
    canvas.height = CANVAS;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    glyphPath(ctx, GLYPHS[0], 32, 32, 15);
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = hexToRgba(th.glow, 0.9);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    runeGlowCache[key] = canvas;
    return canvas;
  }

  /* (x, y) is the tile centre; t animates the pulse. */
  function drawRuneGlow(ctx, theme, x, y, t, collected) {
    const th = themeOf(theme);
    const time = t || 0;
    const pulse = 0.34 + 0.14 * Math.sin(time * 3.2);
    ctx.save();
    ctx.globalAlpha = collected ? Math.min(1, pulse + 0.45) : pulse;
    ctx.drawImage(getRuneGlow(th), x - 40, y - 40, 80, 80);
    if (collected) {
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(time * 5);
      ctx.drawImage(getRuneGlyph(th), x - 26, y - 26, 52, 52);
    }
    ctx.restore();
  }

  /* ── portal: eight cached spiral frames in the realm glow colour ── */

  const portalCache = {};

  function paintPortal(ctx, th, frame) {
    ctx.translate(32, 32);
    ctx.rotate(frame * TWO_PI / 8);
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, TWO_PI);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = hexToRgba(th.glow, 0.85);
    ctx.stroke();
    for (let a = 0; a < 3; ++a) {
      ctx.beginPath();
      for (let k = 0; k <= 24; ++k) {
        const p = k / 24;
        const ang = p * 3.4 + a * TWO_PI / 3;
        const rad = 3 + p * 20;
        const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.lineWidth = 3 - a * 0.6;
      ctx.strokeStyle = a === 0 ? 'rgba(255,255,255,0.75)' : hexToRgba(th.glow, 0.6);
      ctx.stroke();
    }
    glowDot(ctx, 0, 0, 9, '#ffffff', 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TWO_PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  function getPortalFrames(th) {
    const hit = portalCache[th.name];
    if (hit) return hit;
    const frames = [];
    for (let f = 0; f < 8; ++f) {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS;
      canvas.height = CANVAS;
      const ctx = canvas.getContext('2d');
      ctx.scale(SCALE, SCALE);
      paintPortal(ctx, th, f);
      frames.push(canvas);
    }
    portalCache[th.name] = frames;
    return frames;
  }

  function getPortalGlow(th) {
    const key = 'g' + th.name;
    const hit = portalCache[key];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS;
    canvas.height = CANVAS;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    glowDot(ctx, 32, 32, 32, th.glow, 0.6);
    portalCache[key] = canvas;
    return canvas;
  }

  /* (x, y) is the tile centre; an open portal burns brighter and wider. */
  function drawPortal(ctx, theme, x, y, t, open) {
    const th = themeOf(theme);
    let f = Math.floor((t || 0) * 8) % 8;
    if (f < 0) f += 8;
    const s = open ? 1.18 : 0.86;
    const w = TILE * s;
    ctx.save();
    ctx.globalAlpha = open ? 0.85 : 0.4;
    ctx.drawImage(getPortalGlow(th), x - 34 * s, y - 34 * s, 68 * s, 68 * s);
    ctx.globalAlpha = open ? 1 : 0.55;
    ctx.drawImage(getPortalFrames(th)[f], x - w / 2, y - w / 2, w, w);
    ctx.restore();
  }

  /* ── the mage: 4 directions x (idle 2, walk 4, cast 2) frames per robe ── */

  const HERO_W = 48, HERO_H = 64;
  const HERO_PAD_X = 8, HERO_PAD_TOP = 10, HERO_PAD_BOTTOM = 6;
  const HERO_SW = (HERO_W + 2 * HERO_PAD_X) * SCALE;   // 128
  const HERO_SH = (HERO_H + HERO_PAD_TOP + HERO_PAD_BOTTOM) * SCALE;   // 160
  const HERO_LW = HERO_SW / SCALE, HERO_LH = HERO_SH / SCALE;          // 64 x 80
  const FEET_DROP = 16;
  const DEFAULT_ROBE = '#5a4ae0';
  const DIR_NAMES = ['down', 'up', 'left', 'right'];
  const HERO_POSES = { idle: 2, walk: 4, cast: 2 };
  const HERO_FPS = { idle: 2, walk: 10, cast: 8 };
  const WALK_BOB = [0, -1, 0, -1];
  const WALK_STEP = [0, 4, 0, -4];

  function robePath(ctx, hw, sh, hem, flareW) {
    ctx.beginPath();
    ctx.moveTo(-hw * 0.72, sh);
    ctx.quadraticCurveTo(-hw - flareW, (sh + hem) / 2, -hw - flareW, hem);
    ctx.quadraticCurveTo(0, hem + 3 + flareW, hw + flareW, hem);
    ctx.quadraticCurveTo(hw + flareW, (sh + hem) / 2, hw * 0.72, sh);
    ctx.closePath();
  }

  /* The mage is painted in a 48 x 64 box whose bottom centre is the feet. */
  function paintMage(ctx, robe, dir, pose, frame) {
    const dark = shade(robe, -0.5);
    const light = shade(robe, 0.32);
    const trim = '#e8c86a';
    const skin = '#e8c4a0';
    const wood = '#7a5230', woodDark = '#3e2a18';
    const gem = '#5ad8ff', gemGlow = '#c8f2ff';
    const side = dir === 'left' || dir === 'right';
    const back = dir === 'up';
    const bob = pose === 'walk' ? WALK_BOB[frame] : (pose === 'idle' && frame === 1 ? -1 : 0);
    const step = pose === 'walk' ? WALK_STEP[frame] : 0;
    const flare = pose === 'cast' ? (frame === 1 ? 1 : 0.5) : 0;
    const hw = side ? 9 : 13;
    const hem = -3 - (pose === 'cast' ? 1 : 0);
    const sh = -40;
    const flareW = flare * 3;

    ctx.beginPath();
    ctx.ellipse(0, 1, side ? 11 : 14, 4.5, 0, 0, TWO_PI);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    ctx.save();
    ctx.translate(0, bob);

    if (step !== 0) {
      ctx.fillStyle = '#3a2a20';
      roundRectPath(ctx, -8 + step * 0.5, -6, 7, 6, 2);
      ctx.fill();
      roundRectPath(ctx, 1 - step * 0.5, -6, 7, 6, 2);
      ctx.fill();
    }

    robePath(ctx, hw, sh, hem, flareW);
    const rg = ctx.createLinearGradient(-hw, sh, hw * 0.8, hem);
    rg.addColorStop(0, light);
    rg.addColorStop(0.45, robe);
    rg.addColorStop(1, dark);
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = dark;
    ctx.stroke();

    ctx.save();
    robePath(ctx, hw, sh, hem, flareW);
    ctx.clip();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = hexToRgba(dark, 0.55);
    for (let i = 0; i < 2; ++i) {
      const fx = -hw * 0.4 + i * hw * 0.8 + step * 0.3;
      ctx.beginPath();
      ctx.moveTo(fx, sh + 6);
      ctx.quadraticCurveTo(fx + 1.5, (sh + hem) / 2, fx - 1, hem - 1);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = hexToRgba(trim, 0.8);
    ctx.beginPath();
    ctx.moveTo(-hw - flareW, hem - 2.5);
    ctx.quadraticCurveTo(0, hem + 2.5 + flareW, hw + flareW, hem - 2.5);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = hexToRgba(trim, 0.85);
    ctx.fillRect(-hw * 0.8, -22, hw * 1.6, 3);
    ctx.fillStyle = shade(trim, -0.45);
    ctx.fillRect(-2, -23, 4, 5);

    const handX = hw + (side ? 3 : 1);
    const handY = -28 + (pose === 'cast' ? -4 : 0);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hw * 0.5, sh + 4);
    ctx.quadraticCurveTo(hw + 2, sh + 10, handX, handY);
    ctx.lineWidth = 5;
    ctx.strokeStyle = robe;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(dark, 0.6);
    ctx.stroke();
    if (!side) {
      ctx.beginPath();
      ctx.moveTo(-hw * 0.5, sh + 4);
      ctx.quadraticCurveTo(-hw - 1, sh + 12, -hw - 1, -24);
      ctx.lineWidth = 5;
      ctx.strokeStyle = shade(robe, -0.15);
      ctx.stroke();
    }

    const gx = handX + 3, gy = handY - 26 - (pose === 'cast' ? 6 : 0);
    ctx.beginPath();
    ctx.moveTo(handX - 1, handY + 8);
    ctx.lineTo(gx, gy + 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = woodDark;
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = wood;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx - 3, gy + 4);
    ctx.quadraticCurveTo(gx, gy - 2, gx + 3, gy + 4);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#c8a86a';
    ctx.stroke();
    glowDot(ctx, gx, gy, 6 + flare * 7, gemGlow, 0.45 + flare * 0.35);
    ctx.beginPath();
    ctx.arc(gx, gy, 2.8 + flare * 0.8, 0, TWO_PI);
    ctx.fillStyle = gem;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gx - 0.9, gy - 0.9, 1.1, 0, TWO_PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    if (flare > 0.8) {
      for (let i = 0; i < 3; ++i) {
        const a = TWO_PI * i / 3 + 0.6;
        ctx.beginPath();
        ctx.arc(gx + Math.cos(a) * 7, gy + Math.sin(a) * 7, 1.1, 0, TWO_PI);
        ctx.fillStyle = hexToRgba(gemGlow, 0.8);
        ctx.fill();
      }
    }

    ctx.beginPath();
    ctx.arc(0, -45, 6.2, 0, TWO_PI);
    ctx.fillStyle = back ? shade(robe, -0.2) : skin;
    ctx.fill();
    if (back) {
      ctx.beginPath();
      ctx.moveTo(-8, -40);
      ctx.quadraticCurveTo(-9, -52, 0, -53);
      ctx.quadraticCurveTo(9, -52, 8, -40);
      ctx.quadraticCurveTo(0, -45, -8, -40);
      ctx.closePath();
      ctx.fillStyle = shade(robe, -0.3);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#2a2030';
      const ex = side ? 2.6 : 2.4;
      if (side) {
        ctx.beginPath();
        ctx.arc(ex, -46, 1, 0, TWO_PI);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(-ex, -46, 1, 0, TWO_PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex, -46, 1, 0, TWO_PI);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(-4.5, -43);
      ctx.quadraticCurveTo(-5, -36, 0, -34.5);
      ctx.quadraticCurveTo(5, -36, 4.5, -43);
      ctx.closePath();
      ctx.fillStyle = '#e6e2da';
      ctx.fill();
    }

    const brimY = -49;
    const tipX = side ? 5 : 3, tipY = -66 + (pose === 'cast' ? -2 : 0);
    ctx.beginPath();
    ctx.ellipse(0, brimY, hw + 4, 3, 0, 0, TWO_PI);
    ctx.fillStyle = shade(robe, -0.55);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-(hw + 1), brimY);
    ctx.quadraticCurveTo(-hw * 0.5, brimY - 9, tipX * 0.3, tipY + 7);
    ctx.quadraticCurveTo(tipX, tipY, tipX + 3.5, tipY + 8);
    ctx.quadraticCurveTo(hw * 0.6, brimY - 8, hw + 1, brimY);
    ctx.closePath();
    const hg = ctx.createLinearGradient(-hw, tipY, hw, brimY);
    hg.addColorStop(0, shade(robe, 0.12));
    hg.addColorStop(0.6, shade(robe, -0.2));
    hg.addColorStop(1, shade(robe, -0.55));
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = dark;
    ctx.stroke();
    ctx.fillStyle = hexToRgba(trim, 0.85);
    ctx.fillRect(-hw, brimY - 4, hw * 2, 3);
    ctx.beginPath();
    ctx.moveTo(tipX * 0.2, brimY - 15);
    ctx.lineTo(tipX * 0.2 + 1.6, brimY - 12);
    ctx.lineTo(tipX * 0.2, brimY - 9);
    ctx.lineTo(tipX * 0.2 - 1.6, brimY - 12);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(trim, 0.7);
    ctx.fill();

    ctx.restore();
  }

  const heroCache = {};

  function getHero(robe, dir, pose, frame) {
    const key = robe + ':' + dir + ':' + pose + ':' + frame;
    const hit = heroCache[key];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = HERO_SW;
    canvas.height = HERO_SH;
    const ctx = canvas.getContext('2d');
    ctx.translate(HERO_SW / 2, (HERO_PAD_TOP + HERO_H) * SCALE);
    ctx.scale(SCALE, SCALE);
    if (dir === 'left') ctx.scale(-1, 1);
    paintMage(ctx, robe, dir === 'left' ? 'right' : dir, pose, frame);
    heroCache[key] = canvas;
    return canvas;
  }

  /* (x, y) is the centre of the tile the mage stands on. */
  function drawHero(ctx, x, y, dir, pose, t, robe) {
    const d = DIR_NAMES.indexOf(dir) >= 0 ? dir : 'down';
    const p = HERO_POSES[pose] !== undefined ? pose : 'idle';
    const n = HERO_POSES[p];
    let f = Math.floor((t || 0) * HERO_FPS[p]) % n;
    if (f < 0) f += n;
    const img = getHero(robe || DEFAULT_ROBE, d, p, f);
    ctx.drawImage(img, x - HERO_LW / 2, y + FEET_DROP - (HERO_PAD_TOP + HERO_H), HERO_LW, HERO_LH);
  }

  SZ.PuzzleArt = Object.freeze({
    TILE, THEMES, getTile, drawTile, drawHero, drawRuneGlow, drawPortal
  });
})();
