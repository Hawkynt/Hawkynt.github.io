;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Procedural 16x16 pixel tiles for underground combat terrain, which the
  // Kenney sheets only cover with flat floors. Each terrain gets several
  // seeded variants so a board never shows the same tile twice in a row.
  // Tiles are painted once into an in-memory sheet ("terrain").

  const T = 16;
  const VARIANTS = 4;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rgb(hex, f = 1) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function px(ctx, x, y, color, w = 1, h = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // --- painters (draw one tile at ox, oy) -------------------------------------

  // Irregular flagstones with mortar, bevel light and the odd crack.
  function flagstones(ctx, ox, oy, r, base, mortar, { moss = 0 } = {}) {
    px(ctx, ox, oy, mortar, T, T);
    const rows = [[0, 5], [5, 6], [11, 5]];
    let shift = Math.floor(r() * 6);
    for (const [y0, h] of rows) {
      let x = -shift;
      shift = (shift + 3 + Math.floor(r() * 4)) % 8;
      while (x < T) {
        const w = 5 + Math.floor(r() * 5);
        const x0 = Math.max(0, x + 1), x1 = Math.min(T, x + w);
        if (x1 - x0 >= 2) {
          const tone = 0.86 + r() * 0.24;
          px(ctx, ox + x0, oy + y0 + 1, rgb(base, tone), x1 - x0, h - 1);
          px(ctx, ox + x0, oy + y0 + 1, rgb(base, tone * 1.16), x1 - x0, 1);       // top bevel
          px(ctx, ox + x0, oy + y0 + h - 1, rgb(base, tone * 0.78), x1 - x0, 1);   // bottom shadow
          if (r() < 0.25) {
            const cx = x0 + 1 + Math.floor(r() * Math.max(1, x1 - x0 - 2));
            px(ctx, ox + cx, oy + y0 + 2, rgb(base, 0.6), 1, 2);
            px(ctx, ox + cx + 1, oy + y0 + 3, rgb(base, 0.6), 1, 1);
          }
          if (moss > 0 && r() < moss) {
            px(ctx, ox + x0, oy + y0 + h - 2, '#4f7a3a', 2, 1);
            px(ctx, ox + x0 + 1, oy + y0 + h - 3, '#6a9a4a', 1, 1);
          }
        }
        x += w;
      }
    }
  }

  // Packed earth with stones, grit and a few pebbles casting shadows.
  function roughGround(ctx, ox, oy, r, base) {
    for (let y = 0; y < T; ++y)
      for (let x = 0; x < T; ++x)
        px(ctx, ox + x, oy + y, rgb(base, 0.9 + r() * 0.16));
    for (let i = 0; i < 3; ++i) {
      const x = 1 + Math.floor(r() * 12), y = 1 + Math.floor(r() * 12);
      const w = 2 + Math.floor(r() * 3), h = 2 + Math.floor(r() * 2);
      px(ctx, ox + x, oy + y + h, rgb(base, 0.62), w, 1);              // shadow
      px(ctx, ox + x, oy + y, rgb('#8a8290', 0.85 + r() * 0.3), w, h);  // stone
      px(ctx, ox + x, oy + y, rgb('#8a8290', 1.25), w - 1, 1);           // highlight
    }
    for (let i = 0; i < 6; ++i)
      px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), rgb(base, 0.65));
  }

  function lavaTile(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#3a2420');
    // glowing veins
    let x = Math.floor(r() * T), y = 0;
    while (y < T) {
      px(ctx, ox + x, oy + y, '#ff7a1a', 1, 1);
      if (x + 1 < T)
        px(ctx, ox + x + 1, oy + y, '#ffc84a', 1, 1);
      x = Math.max(0, Math.min(T - 2, x + Math.floor(r() * 3) - 1));
      ++y;
    }
    for (let i = 0; i < 5; ++i)
      px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), '#ff9a3a');
  }

  function brickWall(ctx, ox, oy, r, base) {
    px(ctx, ox, oy, rgb(base, 0.55), T, T);
    for (let row = 0; row < 4; ++row) {
      const off = row % 2 ? 4 : 0;
      for (let x = -off; x < T; x += 8) {
        const x0 = Math.max(0, x), x1 = Math.min(T, x + 7);
        const tone = 0.9 + r() * 0.2;
        px(ctx, ox + x0, oy + row * 4, rgb(base, tone), x1 - x0, 3);
        px(ctx, ox + x0, oy + row * 4, rgb(base, tone * 1.2), x1 - x0, 1);
      }
    }
  }

  // Meadow grass: mottled greens, blade tufts, the odd flower.
  function grass(ctx, ox, oy, r, base, { flowers = 0.5, dry = 0 } = {}) {
    for (let y = 0; y < T; y += 2)
      for (let x = 0; x < T; x += 2)
        px(ctx, ox + x, oy + y, rgb(base, 0.92 + r() * 0.14), 2, 2);
    for (let i = 0; i < 7; ++i) {
      const x = Math.floor(r() * 15), y = 2 + Math.floor(r() * 13);
      px(ctx, ox + x, oy + y - 2, rgb(base, 1.28), 1, 2);
      px(ctx, ox + x + 1, oy + y - 1, rgb(base, 1.18), 1, 1);
      px(ctx, ox + x, oy + y, rgb(base, 0.72), 2, 1);
    }
    if (dry > 0)
      for (let i = 0; i < 6; ++i)
        px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), '#b8a860', 2, 1);
    if (r() < flowers) {
      const x = 2 + Math.floor(r() * 11), y = 2 + Math.floor(r() * 11);
      const petal = ['#f4e05a', '#f4f4f4', '#e86a8a', '#8ab8ff'][Math.floor(r() * 4)];
      px(ctx, ox + x - 1, oy + y, petal); px(ctx, ox + x + 1, oy + y, petal);
      px(ctx, ox + x, oy + y - 1, petal); px(ctx, ox + x, oy + y + 1, petal);
      px(ctx, ox + x, oy + y, '#f8c040');
    }
  }

  // Wheel-rutted dirt track.
  function dirtRoad(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#9a7a52');
    for (let i = 0; i < 4; ++i)
      px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), '#c8a878', 2, 1);
  }

  function sand(ctx, ox, oy, r) {
    for (let y = 0; y < T; ++y)
      for (let x = 0; x < T; x += 2)
        px(ctx, ox + x, oy + y, rgb('#d8bc80', 0.94 + r() * 0.1), 2, 1);
    for (let i = 0; i < 3; ++i) {
      const y = 2 + Math.floor(r() * 12), x = Math.floor(r() * 8);
      px(ctx, ox + x, oy + y, '#e8d098', 6, 1);
      px(ctx, ox + x + 1, oy + y + 1, '#b89a60', 5, 1);
    }
  }

  function snowField(ctx, ox, oy, r) {
    for (let y = 0; y < T; y += 2)
      for (let x = 0; x < T; x += 2)
        px(ctx, ox + x, oy + y, rgb('#e8eef8', 0.95 + r() * 0.06), 2, 2);
    for (let i = 0; i < 4; ++i) {
      const x = Math.floor(r() * 12), y = Math.floor(r() * 14);
      px(ctx, ox + x, oy + y, '#c8d4e6', 4, 1);
      px(ctx, ox + x + 1, oy + y - 1, '#ffffff', 2, 1);
    }
  }

  function swampGround(ctx, ox, oy, r) {
    grass(ctx, ox, oy, r, '#5a6a3a', { flowers: 0 });
    const x = 2 + Math.floor(r() * 7), y = 3 + Math.floor(r() * 8);
    const w = 5 + Math.floor(r() * 4);
    px(ctx, ox + x, oy + y, '#3a4a3a', w, 3);
    px(ctx, ox + x + 1, oy + y, '#5a7a6a', w - 2, 1);
    px(ctx, ox + x + w - 2, oy + y - 2, '#4a7a3a', 1, 3);
  }

  const PAINTERS = Object.freeze({
    plains:        (ctx, x, y, r) => grass(ctx, x, y, r, '#5f9e44'),
    // overworld grass: Kenney's grass colour so pond and shore tiles still blend
    meadow:        (ctx, x, y, r) => grass(ctx, x, y, r, '#8dc435', { flowers: 0.3 }),
    forest:        (ctx, x, y, r) => grass(ctx, x, y, r, '#4f8a3c', { flowers: 0.15 }),
    road:          (ctx, x, y, r) => dirtRoad(ctx, x, y, r),
    desert:        (ctx, x, y, r) => sand(ctx, x, y, r),
    snow:          (ctx, x, y, r) => snowField(ctx, x, y, r),
    swamp:         (ctx, x, y, r) => swampGround(ctx, x, y, r),
    mountain:      (ctx, x, y, r) => roughGround(ctx, x, y, r, '#7a7a72'),
    dungeon_floor: (ctx, x, y, r) => flagstones(ctx, x, y, r, '#7a6e72', '#3a3236'),
    cave:          (ctx, x, y, r) => roughGround(ctx, x, y, r, '#5a4a40'),
    ruins:         (ctx, x, y, r) => flagstones(ctx, x, y, r, '#8a8070', '#4a4438', { moss: 0.35 }),
    lava:          (ctx, x, y, r) => lavaTile(ctx, x, y, r),
    wall:          (ctx, x, y, r) => brickWall(ctx, x, y, r, '#6a6470'),
  });

  const IDS = Object.freeze(Object.keys(PAINTERS));

  let _sheet = null;

  function sheet() {
    if (_sheet || typeof document === 'undefined')
      return _sheet;
    const c = document.createElement('canvas');
    c.width = VARIANTS * T;
    c.height = IDS.length * T;
    const ctx = c.getContext('2d');
    if (!ctx)
      return null;
    IDS.forEach((id, row) => {
      for (let v = 0; v < VARIANTS; ++v)
        PAINTERS[id](ctx, v * T, row * T, rng((row + 1) * 7919 + v * 104729));
    });
    _sheet = c;
    return _sheet;
  }

  // Variant for a board cell: stable per position, varied between neighbours.
  function rect(id, col, row) {
    const r = IDS.indexOf(id);
    if (r < 0)
      return null;
    const h = Math.imul(col * 73856093 ^ row * 19349663, 0x9E3779B1) >>> 0;
    return { x: ((h >>> 7) % VARIANTS) * T, y: r * T, w: T, h: T, sheet: 'terrain' };
  }

  function has(id) {
    return IDS.includes(id);
  }

  TR.TerrainArt = Object.freeze({
    TILE: T, VARIANTS, IDS, has, rect, sheet,
    get: id => (id === 'terrain' ? sheet() : null),
  });
})();
