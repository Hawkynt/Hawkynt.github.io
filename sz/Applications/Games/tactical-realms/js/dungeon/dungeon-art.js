;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // 16x16 pixel sprites for dungeon dressing and interactive features,
  // painted once into an in-memory sheet ("props"). Transparent background,
  // drawn on top of the floor tiles.

  const T = 16;

  function px(ctx, x, y, color, w = 1, h = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function disc(ctx, cx, cy, rad, color) {
    for (let y = -rad; y <= rad; ++y)
      for (let x = -rad; x <= rad; ++x)
        if (x * x + y * y <= rad * rad + rad * 0.5)
          px(ctx, cx + x, cy + y, color);
  }

  function shadow(ctx, cx, cy, w) {
    px(ctx, cx - (w >> 1), cy, 'rgba(0,0,0,0.35)', w, 2);
  }

  // Each painter draws at (0, 0) of a translated context.
  const PAINTERS = {
    bones: c => { px(c, 3, 11, '#e8e2d0', 7, 2); px(c, 2, 10, '#e8e2d0', 2, 4); px(c, 9, 10, '#e8e2d0', 2, 4); disc(c, 11, 6, 2, '#ece6d4'); px(c, 10, 6, '#2a2228'); px(c, 12, 6, '#2a2228'); px(c, 4, 7, '#d8d2c0', 4, 1); },
    sarcophagus: c => { shadow(c, 8, 14, 12); px(c, 3, 2, '#6a6470', 10, 12); px(c, 4, 3, '#8a8494', 8, 10); px(c, 6, 5, '#b8a060', 4, 1); px(c, 7, 4, '#b8a060', 2, 4); px(c, 4, 12, '#4a4450', 8, 1); },
    candles: c => { for (const x of [4, 8, 11]) { px(c, x, 9, '#e8e0c8', 2, 5); px(c, x, 7, '#ffd24a', 2, 2); px(c, x, 6, '#fff6c0', 1, 1); } px(c, 3, 14, '#5a4a3a', 11, 1); },
    urn: c => { shadow(c, 8, 14, 8); px(c, 5, 5, '#9a6a3a', 6, 9); px(c, 4, 7, '#9a6a3a', 8, 5); px(c, 6, 3, '#7a5228', 4, 2); px(c, 5, 8, '#c89a5a', 6, 1); },
    mushrooms: c => { for (const [x, y, s] of [[4, 9, 3], [10, 10, 2], [7, 6, 2]]) { px(c, x, y + 1, '#e8dcc8', 1, 4); disc(c, x, y, s, '#c84a6a'); px(c, x - 1, y - 1, '#f4a8c0'); } },
    stalagmite: c => { shadow(c, 8, 14, 8); for (let y = 0; y < 12; ++y) px(c, 8 - (y >> 2), 2 + y, '#7a6a5e', 1 + (y >> 1), 1); px(c, 8, 3, '#a89a8a', 1, 6); },
    puddle: c => { for (let y = -2; y <= 2; ++y) px(c, 8 - 6 + Math.abs(y), 10 + y, '#3a5a6a', 12 - Math.abs(y) * 2, 1); px(c, 5, 9, '#7aa8c0', 3, 1); },
    crystals: c => { for (const [x, h, col] of [[4, 7, '#8ad8ff'], [8, 10, '#b88aff'], [11, 6, '#8ad8ff']]) { px(c, x, 14 - h, col, 2, h); px(c, x, 14 - h, '#ffffff', 1, 2); } },
    crates: c => { shadow(c, 8, 14, 12); px(c, 2, 5, '#8a6238', 9, 9); px(c, 2, 5, '#6a4a28', 9, 1); px(c, 2, 9, '#6a4a28', 9, 1); px(c, 6, 5, '#6a4a28', 1, 9); px(c, 9, 2, '#9a7248', 6, 6); px(c, 9, 2, '#6a4a28', 6, 1); },
    barrels: c => { for (const x of [3, 9]) { shadow(c, x + 2, 14, 6); px(c, x, 4, '#7a5230', 5, 10); px(c, x - 1, 6, '#7a5230', 7, 6); px(c, x - 1, 5, '#4a4a52', 7, 1); px(c, x - 1, 12, '#4a4a52', 7, 1); } },
    weapon_rack: c => { px(c, 2, 12, '#6a4a28', 12, 2); px(c, 3, 3, '#6a4a28', 1, 10); px(c, 12, 3, '#6a4a28', 1, 10); for (const x of [5, 8, 10]) { px(c, x, 2, '#d8e0e8', 1, 9); px(c, x - 1, 10, '#8a6238', 3, 1); } },
    banner: c => { px(c, 7, 1, '#6a4a28', 1, 14); px(c, 3, 2, '#a8302a', 9, 9); px(c, 3, 11, '#a8302a', 3, 2); px(c, 9, 11, '#a8302a', 3, 2); px(c, 6, 5, '#e8c14a', 3, 3); },
    gold: c => { for (const [x, y] of [[4, 10], [7, 9], [10, 11], [6, 12], [9, 7], [12, 9]]) { px(c, x, y, '#e8b830', 3, 2); px(c, x, y, '#fff09a', 1, 1); } },
    brimstone: c => { disc(c, 6, 10, 3, '#c8a828'); disc(c, 11, 11, 2, '#a88a18'); px(c, 5, 8, '#f4e05a', 2, 1); },
    chains: c => { for (let y = 1; y < 14; y += 3) { px(c, 5, y, '#6a6a72', 2, 2); px(c, 10, y + 1, '#6a6a72', 2, 2); } px(c, 4, 14, '#4a4a52', 9, 1); },
    lava_pool: c => { for (let y = -3; y <= 3; ++y) px(c, 8 - 6 + Math.abs(y), 9 + y, y % 2 ? '#ff7a1a' : '#e8501a', 12 - Math.abs(y) * 2, 1); px(c, 6, 8, '#ffd24a', 3, 1); },
    icicles: c => { px(c, 1, 1, '#c8e4f4', 14, 2); for (const [x, h] of [[2, 6], [5, 9], [8, 5], [11, 8], [13, 4]]) for (let y = 0; y < h; ++y) px(c, x, 3 + y, y > h - 3 ? '#ffffff' : '#a8d0ea', y > h - 3 ? 1 : 2, 1); },
    frozen_corpse: c => { px(c, 2, 8, '#a8d0ea', 12, 5); px(c, 3, 9, '#7a8aa0', 10, 3); disc(c, 12, 9, 2, '#b8b0a8'); px(c, 2, 8, '#e8f6ff', 12, 1); },
    snowdrift: c => { for (let y = 0; y < 5; ++y) px(c, 3 - y, 13 - y, '#eef2f8', 10 + y * 2, 1); px(c, 6, 8, '#ffffff', 4, 1); },
    bookshelf: c => { px(c, 2, 1, '#5a3a22', 12, 14); for (const y of [2, 7, 11]) for (let x = 3; x < 13; x += 2) px(c, x, y, ['#a83a3a', '#3a5aa8', '#3a8a4a', '#c8a03a'][(x + y) % 4], 1, 3); },
    rune_circle: c => { for (let a = 0; a < 24; ++a) px(c, 8 + Math.round(Math.cos(a / 24 * 6.283) * 6), 8 + Math.round(Math.sin(a / 24 * 6.283) * 6), '#8a5ad6'); px(c, 7, 4, '#c89aff', 2, 8); px(c, 4, 7, '#c89aff', 8, 2); },
    rubble: c => { for (const [x, y, w] of [[3, 10, 4], [8, 11, 3], [6, 8, 3], [11, 9, 3]]) { px(c, x, y, '#8a8478', w, 3); px(c, x, y, '#aaa498', w, 1); } },
    statue: c => { shadow(c, 8, 14, 10); px(c, 4, 12, '#7a7470', 8, 3); px(c, 6, 5, '#9a948a', 4, 7); disc(c, 8, 3, 2, '#9a948a'); px(c, 4, 6, '#8a847a', 2, 4); px(c, 10, 6, '#8a847a', 2, 4); px(c, 6, 5, '#b8b2a8', 1, 6); },
    vines: c => { for (let y = 0; y < 16; y += 2) { px(c, 3 + (y % 4 ? 1 : 0), y, '#3f7a34', 2, 2); px(c, 11 - (y % 4 ? 1 : 0), y + 1, '#4f8a3c', 2, 2); } },
    stump: c => { shadow(c, 8, 14, 10); px(c, 4, 7, '#7a5230', 8, 7); px(c, 4, 7, '#c8a070', 8, 2); px(c, 7, 7, '#9a7248', 2, 1); px(c, 3, 13, '#6a4a28', 2, 1); px(c, 11, 13, '#6a4a28', 2, 1); },
    flowers: c => { for (const [x, y, col] of [[4, 6, '#f4e05a'], [10, 5, '#e86a8a'], [7, 10, '#8ab8ff'], [12, 11, '#f4f4f4']]) { px(c, x, y + 2, '#4f8a3c', 1, 3); px(c, x - 1, y, col, 3, 1); px(c, x, y - 1, col, 1, 3); px(c, x, y, '#f8c040'); } },
    boulder: c => { shadow(c, 8, 14, 12); disc(c, 8, 9, 5, '#7a7470'); disc(c, 7, 8, 3, '#9a948a'); px(c, 5, 6, '#b8b2a8', 2, 1); },
    reeds: c => { for (const x of [3, 6, 9, 12]) { px(c, x, 4 + (x % 3), '#5a8a3a', 1, 11 - (x % 3)); px(c, x, 3 + (x % 3), '#8a6238', 1, 2); } },
    // overworld features
    palm: c => {
      shadow(c, 8, 15, 10);
      for (let y = 6; y < 15; ++y) px(c, 7 + (y > 10 ? 1 : 0), y, y % 3 ? '#9a6a38' : '#7a5228', 2, 1);
      // fronds: dark outline first, then bright leaves
      const fronds = [[-7, 2], [-5, -2], [-1, -4], [3, -3], [7, 1], [6, 4], [-6, 4]];
      for (const [col, size] of [['#1e4a1a', 2], ['#7ac83a', 1]])
        for (const [dx, dy] of fronds)
          for (let k = 1; k <= 5; ++k)
            px(c, 8 + Math.round(dx * k / 5) - (size >> 1), 5 + Math.round(dy * k / 5) + (k > 3 ? 1 : 0) - (size >> 1), col, size + 1, size + 1);
      px(c, 7, 4, '#a8e85a', 2, 2);
      px(c, 6, 6, '#6a4a22', 3, 2);
    },
    snow_pine: c => { shadow(c, 8, 15, 8); px(c, 7, 12, '#5a3a22', 2, 3); for (let y = 0; y < 11; ++y) { const w = 2 + Math.floor(y * 0.9); px(c, 8 - (w >> 1), 1 + y, y % 3 === 0 ? '#eef4fa' : '#2f5a46', w, 1); } px(c, 7, 1, '#ffffff', 2, 1); },
    acacia: c => { shadow(c, 8, 15, 10); px(c, 7, 7, '#6a4a28', 2, 8); px(c, 5, 7, '#6a4a28', 2, 1); for (let x = 1; x < 15; ++x) px(c, x, 4 + (x < 4 || x > 11 ? 1 : 0), x % 3 ? '#6a8a34' : '#4f6a28', 1, 3); },
    hillock: c => {
      // a grassy mound lit from the upper left
      for (let y = 0; y < 8; ++y) {
        const w = 15 - y * 2, x0 = 1 + y;
        px(c, x0, 14 - y, '#2f5a26', w, 1);
        px(c, x0 + 1, 14 - y, '#9ad868', Math.max(1, (w >> 1) - 1), 1);
        px(c, x0 + (w >> 1), 14 - y, '#5a9a40', Math.max(1, (w >> 1) - 1), 1);
      }
      px(c, 7, 7, '#c8f08a', 2, 1);
      px(c, 1, 15, 'rgba(0,0,0,0.3)', 15, 1);
    },
    mesa: c => { shadow(c, 8, 15, 14); px(c, 2, 6, '#a8583a', 12, 9); px(c, 3, 4, '#c8784a', 10, 3); px(c, 2, 9, '#7a3a22', 12, 1); px(c, 2, 12, '#8a4a2a', 12, 1); },
    vent: c => { disc(c, 8, 11, 3, '#2a2628'); px(c, 7, 10, '#ff7a2a', 2, 2); for (let i = 0; i < 4; ++i) px(c, 7 + (i % 2), 7 - i * 2, 'rgba(120,120,120,0.6)', 2, 2); },
    snow_rock: c => { shadow(c, 8, 14, 12); disc(c, 8, 10, 4, '#7a7a86'); px(c, 4, 6, '#f4f8fc', 8, 2); px(c, 5, 5, '#ffffff', 5, 1); },
    // the planes
    portal: c => {
      // standing stones around a swirling ring of light
      shadow(c, 8, 15, 14);
      px(c, 1, 4, '#6a6478', 2, 11); px(c, 13, 4, '#6a6478', 2, 11); px(c, 1, 3, '#8a849a', 14, 2);
      for (let a = 0; a < 28; ++a) {
        const t = a / 28 * 6.283;
        for (const [rad, col] of [[5, '#6a3ad8'], [4, '#a87aff'], [2, '#e8d8ff']])
          px(c, 8 + Math.round(Math.cos(t + rad) * rad), 9 + Math.round(Math.sin(t + rad) * rad * 1.1), col);
      }
      px(c, 7, 8, '#ffffff', 2, 2);
    },
    astral_shard: c => { for (let y = 0; y < 10; ++y) { const w = y < 5 ? 1 + y : 10 - y; px(c, 8 - (w >> 1), 2 + y, y < 5 ? '#d8d0ff' : '#8a80d8', w, 1); } px(c, 7, 4, '#ffffff', 1, 2); px(c, 4, 15, 'rgba(160,150,255,0.35)', 8, 1); },
    fey_tree: c => {
      shadow(c, 8, 15, 10);
      px(c, 7, 9, '#5a3a5a', 2, 6); px(c, 5, 13, '#5a3a5a', 2, 1); px(c, 9, 14, '#5a3a5a', 2, 1);
      disc(c, 8, 6, 5, '#2a8a7a'); disc(c, 7, 5, 3, '#4ac8a8');
      for (const [x, y, col] of [[4, 4, '#ff8af0'], [11, 6, '#b88aff'], [7, 8, '#8affea'], [9, 3, '#ffffff']]) px(c, x, y, col);
    },
    hell_spire: c => { shadow(c, 8, 15, 8); for (let y = 0; y < 13; ++y) { const w = 1 + Math.floor(y / 2.2); px(c, 8 - (w >> 1), 2 + y, y % 4 === 1 ? '#3a1410' : '#5a2018', w, 1); } px(c, 7, 9, '#ff7a1a', 1, 1); px(c, 8, 12, '#ffb03a', 1, 1); },
    cog: c => {
      for (let a = 0; a < 32; ++a) {
        const t = a / 32 * 6.283;
        const rad = (a >> 1) % 2 ? 6 : 5;
        for (let k = 3; k <= rad; ++k) px(c, 8 + Math.round(Math.cos(t) * k), 8 + Math.round(Math.sin(t) * k), k === rad ? '#7a5a22' : '#c8a050');
      }
      disc(c, 8, 8, 1, '#4a3a1a');
    },
    coral_fan: c => { for (const [x, col] of [[4, '#e86a6a'], [8, '#f0a050'], [12, '#d870c0']]) { px(c, x, 7, col, 1, 8); px(c, x - 2, 5, col, 1, 4); px(c, x + 2, 4, col, 1, 4); px(c, x - 2, 8, col, 5, 1); } },
    light_pillar: c => { px(c, 6, 0, 'rgba(255,248,210,0.55)', 4, 16); px(c, 7, 0, '#ffffff', 2, 16); px(c, 3, 14, '#fff0bc', 10, 2); },
    grey_tree: c => { shadow(c, 8, 15, 8); px(c, 7, 4, '#5a5856', 2, 11); px(c, 3, 6, '#5a5856', 4, 1); px(c, 3, 4, '#5a5856', 1, 2); px(c, 9, 8, '#5a5856', 4, 1); px(c, 12, 6, '#5a5856', 1, 2); px(c, 6, 2, '#5a5856', 1, 3); },
    // interactive features
    chest:c => { shadow(c, 8, 14, 12); px(c, 3, 6, '#8a5a2a', 10, 8); px(c, 3, 6, '#a87238', 10, 3); px(c, 3, 9, '#5a3a1a', 10, 1); px(c, 7, 8, '#e8c14a', 2, 3); px(c, 3, 6, '#5a3a1a', 1, 8); px(c, 12, 6, '#5a3a1a', 1, 8); },
    chest_open: c => { shadow(c, 8, 14, 12); px(c, 3, 8, '#8a5a2a', 10, 6); px(c, 3, 3, '#5a3a1a', 10, 4); px(c, 4, 7, '#1a1010', 8, 2); px(c, 3, 13, '#5a3a1a', 10, 1); },
    trap: c => { px(c, 2, 2, 'rgba(60,50,40,0.6)', 12, 12); for (let y = 4; y < 13; y += 4) for (let x = 4; x < 13; x += 4) { px(c, x, y, '#c8ccd4', 1, 2); px(c, x, y - 1, '#ffffff'); } },
    fountain: c => { shadow(c, 8, 14, 14); px(c, 2, 9, '#8a8a96', 12, 5); px(c, 3, 9, '#3a8ac8', 10, 3); px(c, 7, 3, '#8a8a96', 2, 7); px(c, 6, 2, '#7ac8f0', 4, 1); px(c, 5, 4, '#a8e0ff', 1, 3); px(c, 10, 4, '#a8e0ff', 1, 3); },
    shrine: c => { shadow(c, 8, 14, 12); px(c, 3, 10, '#8a847a', 10, 4); px(c, 5, 4, '#aaa498', 6, 6); px(c, 7, 1, '#ffe08a', 2, 4); px(c, 6, 2, '#ffe08a', 4, 1); px(c, 5, 10, '#c8c2b8', 6, 1); },
    hoard: c => { for (let y = 0; y < 6; ++y) px(c, 2 + y, 13 - y, '#e8b830', 12 - y * 2, 1); px(c, 6, 8, '#fff09a', 2, 1); px(c, 9, 9, '#a83a3a', 2, 2); px(c, 4, 11, '#3a8ac8', 2, 2); px(c, 11, 3, '#d8e0e8', 1, 7); },
    stairs_down: c => { for (let i = 0; i < 5; ++i) px(c, 2 + i, 3 + i * 2, i % 2 ? '#3a3440' : '#5a5462', 12 - i * 2, 2); px(c, 7, 13, '#141018', 2, 2); },
    stairs_up: c => { for (let i = 0; i < 5; ++i) px(c, 2 + i, 13 - i * 2, i % 2 ? '#8a8494' : '#aaa4b4', 12 - i * 2, 2); px(c, 7, 2, '#ffe8a8', 2, 1); },
  };

  const IDS = Object.freeze(Object.keys(PAINTERS));
  const COLS = 8;

  let _sheet = null;

  function sheet() {
    if (_sheet || typeof document === 'undefined')
      return _sheet;
    const cv = document.createElement('canvas');
    cv.width = COLS * T;
    cv.height = Math.ceil(IDS.length / COLS) * T;
    const ctx = cv.getContext('2d');
    if (!ctx)
      return null;
    IDS.forEach((id, i) => {
      ctx.save();
      ctx.translate((i % COLS) * T, Math.floor(i / COLS) * T);
      PAINTERS[id](ctx);
      ctx.restore();
    });
    _sheet = cv;
    return _sheet;
  }

  function rect(id) {
    const i = IDS.indexOf(id);
    if (i < 0)
      return null;
    return { x: (i % COLS) * T, y: Math.floor(i / COLS) * T, w: T, h: T, sheet: 'props' };
  }

  TR.DungeonArt = Object.freeze({
    TILE: T, IDS, rect, sheet,
    has: id => IDS.includes(id),
    get: id => (id === 'props' ? sheet() : null),
  });
})();
