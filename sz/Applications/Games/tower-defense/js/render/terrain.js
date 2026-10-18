/* render/terrain.js -- biome terrain baked once per map, props, gates and animated liquids.
   Reads: constants, maps, env, pixelArt, artKit, paths and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, COLS, ROWS, makeRng, TWO_PI, WORLD_W, WORLD_H, clamp, parseHex } = NS.constants;
  const { MAPS } = NS.maps;
  const { ctx } = NS.env;
  const { OUTLINE, makeCanvas, pixelArt } = NS.pixelArt;
  const { AP, TILE, RAMPS, hash2, valueNoise, fbm, rampPick, px, block, disc, ellipseFill, poly, line,
      drawGlow, blitArt } = NS.artKit;

  /* ══════════════════════════════════════════════════════════════════
     TERRAIN -- every map is baked once into a pixel-art canvas: textured
     ground, roads with ragged edges, shores, cliffs, props and gates.
     Water, lava and ice move with scrolling textures drawn every frame.
     ══════════════════════════════════════════════════════════════════ */

  const TERRAIN = {
    meadow: {
      ground: ['#24461f', '#2f5a28', '#3b6d31', '#4a823a', '#5c9844', '#78b256'],
      path: ['#4e3520', '#664629', '#7c5733', '#93693e', '#a87d4c', '#c49864'], cobble: false,
      shore: '#6e5a36', feature: 'water', cliff: RAMPS.stone, blade: '#8cc864',
      decor: ['flower', 'flower2', 'tuft', 'tuft', 'pebble', 'mushroom'], tree: 'oak', boulder: 'mossrock'
    },
    desert: {
      ground: ['#9a6a34', '#b07c3e', '#c3904c', '#d4a35c', '#e2b86e', '#f0d08e'],
      path: ['#5e4a3a', '#715a46', '#866c54', '#9b8064', '#b09678', '#c8b090'], cobble: true,
      shore: '#e8d29a', feature: 'water', cliff: ['#5a3418', '#7a4824', '#9a6032', '#b87a44', '#d29a60', '#ecc084'], blade: '#f6dca0',
      decor: ['pebble', 'bones', 'drygrass', 'drygrass', 'pebble'], tree: 'cactus', boulder: 'sandrock'
    },
    tundra: {
      ground: ['#8ea6c2', '#a8bed6', '#c0d2e4', '#d6e4f0', '#e8f0f8', '#ffffff'],
      path: ['#46566c', '#56687f', '#687c94', '#7c91a9', '#92a7be', '#b0c4d8'], cobble: true,
      shore: '#f4f8fc', feature: 'ice', cliff: ['#2c3a4e', '#3e4e66', '#52647e', '#6a7e98', '#8aa0b8', '#b6c8dc'], blade: '#ffffff',
      decor: ['snowtuft', 'icecrystal', 'pebble', 'snowtuft'], tree: 'pine', boulder: 'snowrock'
    },
    volcano: {
      ground: ['#1a1214', '#241a1c', '#2f2224', '#3b2b2c', '#4a3634', '#5c4440'],
      path: ['#0e090e', '#171018', '#211722', '#2c1f2c', '#3a2938', '#4a3646'], cobble: true, seam: '#ff6a1a',
      shore: '#140c0c', feature: 'lava', cliff: ['#120c10', '#1e1418', '#2c1e22', '#3c2a2c', '#4e3838', '#644a46'], blade: '#6a4a40',
      decor: ['ember', 'pebble', 'crack', 'skull'], tree: 'deadtree', boulder: 'obsidian'
    },
    swamp: {
      ground: ['#1a2616', '#22321c', '#2c3f22', '#384e2a', '#476034', '#5b7640'],
      path: ['#2a1c10', '#3e2a18', '#553b22', '#6c4d2e', '#84603a', '#a07a4c'], planks: true,
      shore: '#2e2a18', feature: 'bog', cliff: ['#161b14', '#22291e', '#30392a', '#404b38', '#56644a', '#6f805e'], blade: '#8aae4e', bladeH: 2,
      decor: ['reed', 'reed', 'toadstool', 'fern', 'pebble', 'fern'], tree: 'willow', boulder: 'stump'
    },
    cavern: {
      ground: ['#121020', '#19162a', '#211d36', '#2a2544', '#353054', '#443d68'],
      path: ['#0c0b14', '#16141f', '#201d2c', '#2b283a', '#38344a', '#4a455e'], cobble: true, seam: '#6ae8ff',
      shore: '#6a5e9a', feature: 'chasm', cliff: ['#0c0a14', '#171424', '#231e36', '#302a4a', '#403860', '#544a7a'], blade: '#4e4678',
      decor: ['shard', 'shard2', 'glowcap', 'pebble', 'shard'], tree: 'crystal', boulder: 'stalagmite', glow: '#7ae8ff', deepGlow: '#8a5aff'
    }
  };

  /* ── Prop sprites ── */
  const PROP_ART = {
    oak: [16, 22, (g) => {
      px(g, 7, 14, 3, 8, RAMPS.wood[2]); px(g, 7, 14, 1, 8, RAMPS.wood[3]);
      disc(g, 8, 9, 7, RAMPS.leaf, 3);
      disc(g, 4.5, 11, 4, RAMPS.leaf, 2);
      disc(g, 11.5, 11, 4, RAMPS.leaf, 2);
      disc(g, 8, 6, 4.5, RAMPS.leaf, 4);
      px(g, 5, 4, 2, 1, RAMPS.leaf[5]); px(g, 9, 7, 1, 1, '#e85a5a'); px(g, 4, 10, 1, 1, '#e85a5a');
    }],
    pine: [14, 24, (g) => {
      px(g, 6, 19, 2, 5, RAMPS.wood[1]);
      for (let i = 0; i < 4; ++i) {
        const y = 3 + i * 4, w = 3 + i * 2;
        poly(g, [7, y - 3, 7 - w, y + 4, 7 + w, y + 4], RAMPS.pine[2 + (i % 2)]);
        px(g, 7 - w + 1, y + 3, w * 2 - 1, 1, RAMPS.snow[4]);
        px(g, 7 - Math.floor(w / 2), y + 2, Math.max(1, w), 1, RAMPS.snow[3]);
      }
      px(g, 6, 0, 2, 2, RAMPS.snow[5]);
    }],
    cactus: [12, 18, (g) => {
      const c = ['#1e4a24', '#2a6630', '#3a8440', '#52a454', '#78c470', '#a8e094'];
      px(g, 4, 2, 4, 16, c[2]); px(g, 4, 2, 1, 16, c[4]); px(g, 7, 2, 1, 16, c[1]);
      px(g, 0, 7, 3, 6, c[2]); px(g, 0, 11, 4, 2, c[2]); px(g, 0, 7, 1, 6, c[4]);
      px(g, 9, 4, 3, 6, c[2]); px(g, 8, 8, 4, 2, c[2]); px(g, 11, 4, 1, 6, c[1]);
      px(g, 5, 1, 2, 1, '#ff7aa8'); px(g, 5, 5, 1, 1, c[5]); px(g, 6, 10, 1, 1, c[5]); px(g, 5, 14, 1, 1, c[5]);
    }],
    deadtree: [16, 22, (g) => {
      const c = ['#0e0a0c', '#1c1418', '#2a2024', '#3a2c30', '#4c3c3e', '#5e4c4c'];
      px(g, 7, 8, 3, 14, c[2]); px(g, 7, 8, 1, 14, c[4]);
      line(g, 8, 12, 2, 5, c[2], 2); line(g, 9, 10, 14, 3, c[2], 2); line(g, 4, 8, 3, 2, c[3], 1); line(g, 12, 6, 13, 1, c[3], 1);
      px(g, 8, 15, 1, 1, '#ff6a1a'); px(g, 8, 18, 1, 1, '#ffa63a');
    }],
    mossrock: [14, 11, (g) => {
      disc(g, 7, 6.5, 6, RAMPS.stone, 3); disc(g, 3.5, 8, 3.2, RAMPS.stone, 2);
      px(g, 3, 1, 5, 2, RAMPS.leaf[3]); px(g, 4, 1, 3, 1, RAMPS.leaf[4]); px(g, 9, 4, 2, 1, RAMPS.leaf[3]);
    }],
    sandrock: [14, 11, (g) => {
      const c = TERRAIN.desert.cliff;
      disc(g, 7, 6.5, 6, c, 3); disc(g, 10.5, 8, 3.2, c, 2);
      px(g, 3, 5, 6, 1, c[1]); px(g, 4, 8, 4, 1, c[1]);
    }],
    snowrock: [14, 11, (g) => {
      const c = TERRAIN.tundra.cliff;
      disc(g, 7, 6.5, 6, c, 3); disc(g, 3.5, 8, 3.2, c, 2);
      ellipseFill(g, 6.5, 2.5, 4.5, 2, RAMPS.snow[4]); px(g, 4, 2, 3, 1, '#ffffff');
    }],
    obsidian: [12, 16, (g) => {
      const c = TERRAIN.volcano.cliff;
      poly(g, [5, 0, 10, 8, 9, 16, 1, 16, 2, 6], c[3]);
      poly(g, [5, 0, 6, 9, 4, 16, 1, 16, 2, 6], c[4]);
      poly(g, [9, 6, 12, 12, 11, 16, 8, 16], c[2]);
      px(g, 5, 9, 1, 3, '#ff6a1a');
    }],
    flower: [5, 5, (g) => {
      px(g, 2, 2, 1, 3, '#3a7a2a'); px(g, 1, 0, 3, 3, '#f4f4f4'); px(g, 2, 1, 1, 1, '#ffd84a');
    }],
    flower2: [5, 5, (g) => {
      px(g, 2, 2, 1, 3, '#3a7a2a'); px(g, 1, 0, 3, 3, '#e8507a'); px(g, 2, 1, 1, 1, '#ffe08a');
    }],
    tuft: [6, 4, (g) => {
      px(g, 0, 2, 1, 2, '#5c9844'); px(g, 2, 0, 1, 4, '#78b256'); px(g, 4, 1, 1, 3, '#5c9844'); px(g, 3, 2, 1, 2, '#4a823a');
    }],
    drygrass: [6, 4, (g) => {
      px(g, 0, 2, 1, 2, '#a8803e'); px(g, 2, 0, 1, 4, '#d8b06a'); px(g, 4, 1, 1, 3, '#b88c48');
    }],
    snowtuft: [7, 3, (g) => {
      ellipseFill(g, 3.5, 1.8, 3.4, 1.4, '#ffffff'); px(g, 1, 2, 5, 1, '#d6e4f0');
    }],
    pebble: [4, 3, (g) => {
      px(g, 0, 1, 3, 2, '#7a7a86'); px(g, 0, 1, 2, 1, '#a0a0ac'); px(g, 3, 2, 1, 1, '#4a4a56');
    }],
    mushroom: [5, 5, (g) => {
      px(g, 2, 3, 1, 2, '#e8e2d4'); px(g, 0, 1, 5, 2, '#d84a3a'); px(g, 1, 0, 3, 1, '#d84a3a'); px(g, 1, 1, 1, 1, '#ffffff'); px(g, 3, 2, 1, 1, '#ffffff');
    }],
    bones: [7, 4, (g) => {
      px(g, 0, 1, 7, 1, '#e8e2d4'); px(g, 0, 0, 1, 3, '#f6f2e2'); px(g, 6, 0, 1, 3, '#f6f2e2'); px(g, 2, 3, 3, 1, '#bcb6a0');
    }],
    icecrystal: [5, 7, (g) => {
      poly(g, [2, 0, 4, 4, 2, 7, 0, 4], '#8ac4e8'); px(g, 2, 1, 1, 4, '#e6f8ff');
    }],
    ember: [3, 3, (g) => {
      px(g, 1, 0, 1, 3, '#ff6a14'); px(g, 0, 1, 3, 1, '#ff6a14'); px(g, 1, 1, 1, 1, '#ffe48a');
    }],
    crack: [8, 4, (g) => {
      line(g, 0, 1, 3, 2, '#ff6a1a', 1); line(g, 3, 2, 7, 1, '#d03c0a', 1); px(g, 4, 3, 1, 1, '#ff6a1a');
    }],
    skull: [5, 5, (g) => {
      px(g, 0, 0, 5, 3, '#dcd6c0'); px(g, 1, 3, 3, 2, '#bcb6a0'); px(g, 1, 1, 1, 1, '#1a1214'); px(g, 3, 1, 1, 1, '#1a1214');
    }],
    // Mirewood: weeping willows, mossy stumps, reeds, ferns and sickly toadstools
    willow: [18, 22, (g) => {
      const L = ['#15240e', '#1d3314', '#28451b', '#365a24', '#4a7430', '#66903e'];
      px(g, 8, 11, 3, 11, RAMPS.wood[1]); px(g, 8, 11, 1, 11, RAMPS.wood[2]); px(g, 7, 20, 5, 2, RAMPS.wood[1]);
      disc(g, 9, 7, 7, L, 3);
      disc(g, 4.5, 9, 4, L, 2); disc(g, 13.5, 9, 4, L, 2);
      // Hanging fronds
      for (let i = 0; i < 8; ++i) {
        const x = 1 + i * 2, len = 5 + ((i * 7) % 5);
        px(g, x, 9, 1, len, L[i % 2 ? 2 : 3]);
        px(g, x, 9 + len - 1, 1, 1, L[4]);
      }
      px(g, 6, 2, 4, 1, L[5]); px(g, 11, 4, 2, 1, L[5]); px(g, 4, 6, 2, 1, L[4]);
    }],
    stump: [14, 11, (g) => {
      const w = RAMPS.wood;
      px(g, 2, 4, 10, 7, w[2]); px(g, 2, 4, 2, 7, w[3]); px(g, 10, 4, 2, 7, w[1]);
      px(g, 0, 9, 3, 2, w[1]); px(g, 11, 9, 3, 2, w[1]);
      ellipseFill(g, 7, 4, 5, 2, w[4]); ellipseFill(g, 7, 4, 3, 1.2, w[3]); px(g, 6, 4, 2, 1, w[2]);
      px(g, 2, 6, 4, 2, '#4a7430'); px(g, 3, 5, 2, 1, '#66903e'); px(g, 9, 8, 3, 2, '#365a24');
    }],
    reed: [5, 8, (g) => {
      px(g, 1, 2, 1, 6, '#5a7a30'); px(g, 3, 1, 1, 7, '#6e8e3a'); px(g, 2, 4, 1, 4, '#4a6428');
      px(g, 1, 1, 1, 2, '#6a4422'); px(g, 3, 0, 1, 2, '#7a5028');
    }],
    fern: [7, 5, (g) => {
      line(g, 3.5, 5, 0.5, 1, '#4a7430', 1); line(g, 3.5, 5, 6.5, 1, '#4a7430', 1); px(g, 3, 0, 1, 5, '#66903e');
      px(g, 1, 2, 1, 1, '#66903e'); px(g, 5, 2, 1, 1, '#66903e');
    }],
    toadstool: [5, 5, (g) => {
      px(g, 2, 3, 1, 2, '#d8d0b8'); px(g, 0, 1, 5, 2, '#8a5aa8'); px(g, 1, 0, 3, 1, '#a874c8'); px(g, 1, 1, 1, 1, '#e0c8f0'); px(g, 3, 2, 1, 1, '#e0c8f0');
    }],
    // Crystal Caverns: crystal clusters, stalagmites, shards and glowing caps
    crystal: [14, 20, (g) => {
      const c = ['#123a4a', '#1c5a70', '#2a86a0', '#4ab8d0', '#8ae4f4', '#e0fcff'];
      const v = ['#2a1648', '#3e2068', '#5a3092', '#7a48ba', '#a272e0', '#d6b8ff'];
      poly(g, [2, 9, 4, 6, 6, 9, 6, 20, 2, 20], v[2]); poly(g, [2, 9, 4, 6, 4, 20, 2, 20], v[4]);
      poly(g, [10, 7, 12, 4, 14, 8, 13, 20, 9, 20], c[2]); poly(g, [10, 7, 12, 4, 12, 20, 9, 20], c[3]);
      poly(g, [5, 4, 7.5, 0, 10, 4, 10, 20, 5, 20], c[3]); poly(g, [5, 4, 7.5, 0, 7.5, 20, 5, 20], c[4]);
      px(g, 6, 3, 1, 9, c[5]); px(g, 11, 7, 1, 5, c[4]); px(g, 3, 9, 1, 4, v[5]);
      px(g, 1, 18, 13, 2, '#1a1626');
    }],
    stalagmite: [10, 16, (g) => {
      const c = TERRAIN.cavern.cliff;
      poly(g, [5, 0, 9, 16, 1, 16], c[3]); poly(g, [5, 0, 5, 16, 1, 16], c[4]); poly(g, [7, 9, 9, 16, 6, 16], c[2]);
      px(g, 4, 5, 1, 2, c[5]); px(g, 3, 11, 2, 1, c[5]); px(g, 6, 13, 1, 2, '#6ae8ff');
    }],
    shard: [4, 6, (g) => {
      poly(g, [2, 0, 4, 3, 3, 6, 1, 6, 0, 3], '#4ab8d0'); px(g, 1, 1, 1, 4, '#cdf6ff');
    }],
    shard2: [4, 6, (g) => {
      poly(g, [2, 0, 4, 3, 3, 6, 1, 6, 0, 3], '#7a48ba'); px(g, 1, 1, 1, 4, '#d6b8ff');
    }],
    glowcap: [5, 5, (g) => {
      px(g, 2, 3, 1, 2, '#8a86a8'); px(g, 0, 1, 5, 2, '#3ab8e0'); px(g, 1, 0, 3, 1, '#7ae8ff'); px(g, 1, 1, 1, 1, '#e0fcff');
    }]
  };

  const propCache = {};
  function propArt(key) {
    let c = propCache[key];
    if (!c) {
      const [w, h, fn] = PROP_ART[key];
      const outline = ['flower', 'flower2', 'tuft', 'drygrass', 'snowtuft', 'pebble', 'ember', 'crack', 'reed', 'fern'].indexOf(key) >= 0 ? null : OUTLINE;
      c = propCache[key] = pixelArt(w, h, fn, outline);
    }
    return c;
  }

  /* ── Gates: a dark tunnel where enemies enter, a gatehouse where they leave ── */
  function gateArt(kind, biome) {
    const key = 'gate-' + kind + '-' + biome;
    if (propCache[key]) return propCache[key];
    const T = TERRAIN[biome];
    const st = T.cliff;
    let c;
    if (kind === 'spawn') {
      c = pixelArt(22, 22, (g) => {
        // Rock arch with a black mouth
        disc(g, 11, 11, 10.5, st, 3);
        disc(g, 11, 13, 7.5, ['#000000', '#05030a', '#0c0814', '#140c1e', '#1c1228', '#241834'], 2);
        px(g, 5, 19, 12, 3, st[1]);
        px(g, 3, 4, 3, 2, st[4]); px(g, 15, 3, 4, 2, st[4]);
        // Runes
        px(g, 3, 10, 1, 2, '#ff4a6a'); px(g, 18, 10, 1, 2, '#ff4a6a'); px(g, 10, 1, 2, 1, '#ff4a6a');
      });
    } else if (kind === 'exit') {
      c = pixelArt(26, 28, (g) => {
        const s = RAMPS.stone;
        // Two towers and a wall with an open gate
        block(g, 1, 8, 7, 20, s, 3); block(g, 18, 8, 7, 20, s, 3);
        block(g, 6, 13, 14, 15, s, 2);
        for (let i = 0; i < 3; ++i) { px(g, 1 + i * 3, 5, 2, 3, s[3]); px(g, 18 + i * 3, 5, 2, 3, s[3]); }
        for (let i = 0; i < 4; ++i) px(g, 7 + i * 3, 10, 2, 3, s[2]);
        px(g, 9, 17, 8, 11, '#120a08'); px(g, 10, 16, 6, 1, '#120a08');
        for (let i = 0; i < 3; ++i) px(g, 10 + i * 2, 18, 1, 10, '#3a2a1a');
        px(g, 3, 13, 2, 3, '#ffd75a'); px(g, 21, 13, 2, 3, '#ffd75a');
        px(g, 4, 0, 1, 6, RAMPS.wood[3]); px(g, 21, 0, 1, 6, RAMPS.wood[3]);
      });
    } else {
      c = pixelArt(34, 36, (g) => {
        const s = RAMPS.stone;
        // Central keep
        block(g, 2, 14, 30, 22, s, 2);
        block(g, 8, 4, 18, 22, s, 3);
        for (let i = 0; i < 5; ++i) px(g, 8 + i * 4, 1, 2, 3, s[3]);
        for (let i = 0; i < 8; ++i) px(g, 2 + i * 4, 11, 2, 3, s[2]);
        px(g, 13, 22, 8, 14, '#120a08'); px(g, 14, 21, 6, 1, '#120a08');
        px(g, 12, 9, 2, 3, '#ffd75a'); px(g, 20, 9, 2, 3, '#ffd75a');
        px(g, 16, 0, 1, 5, RAMPS.wood[3]);
      });
    }
    propCache[key] = c;
    return c;
  }

  /* ── The bake ── */
  const terrainCache = {};

  function getTerrain(mapIndex) {
    if (!terrainCache[mapIndex])
      terrainCache[mapIndex] = bakeTerrain(mapIndex);
    return terrainCache[mapIndex];
  }

  function bakeTerrain(mapIndex) {
    const m = MAPS[mapIndex];
    const T = TERRAIN[m.biome];
    const W = COLS * TILE, H = ROWS * TILE;
    const seed = mapIndex * 97 + 13;
    const cells = new Set();
    for (const wp of m.paths) NS.paths.walkPath(wp, (x, y) => cells.add(x + ',' + y));
    const feat = new Map();
    for (const [type, c0, r0, c1, r1] of m.features)
      for (let r = r0; r <= r1; ++r)
        for (let c = c0; c <= c1; ++c)
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS && !cells.has(c + ',' + r))
            feat.set(c + ',' + r, type);
    const props = NS.paths.blockedFor(m, cells);
    const kindAt = (c, r) => {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return 'out';
      const k = c + ',' + r;
      return cells.has(k) ? 'path' : (feat.get(k) || 'ground');
    };
    // Distance (art px) from a pixel to the edge of its own region kind
    // Outer corners are rounded with radius R
    const edgeDist = (x, y, kind, R) => {
      R = R || 6;
      const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
      const ex = x - c * TILE + 0.5, ey = y - r * TILE + 0.5;
      let d = 99;
      const other = (dc, dr) => { const k = kindAt(c + dc, r + dr); return k !== kind && k !== 'out'; };
      const L = other(-1, 0), Rt = other(1, 0), U = other(0, -1), D = other(0, 1);
      if (L) d = Math.min(d, ex);
      if (Rt) d = Math.min(d, TILE - ex);
      if (U) d = Math.min(d, ey);
      if (D) d = Math.min(d, TILE - ey);
      const corner = (ax, ay) => (ax < R && ay < R) ? R - Math.hypot(R - ax, R - ay) : 99;
      if (L && U) d = Math.min(d, corner(ex, ey));
      if (Rt && U) d = Math.min(d, corner(TILE - ex, ey));
      if (L && D) d = Math.min(d, corner(ex, TILE - ey));
      if (Rt && D) d = Math.min(d, corner(TILE - ex, TILE - ey));
      if (!L && !U && other(-1, -1)) d = Math.min(d, Math.hypot(ex, ey));
      if (!Rt && !U && other(1, -1)) d = Math.min(d, Math.hypot(TILE - ex, ey));
      if (!L && !D && other(-1, 1)) d = Math.min(d, Math.hypot(ex, TILE - ey));
      if (!Rt && !D && other(1, 1)) d = Math.min(d, Math.hypot(TILE - ex, TILE - ey));
      return d;
    };
    const canvas2 = makeCanvas(W, H);
    const g = canvas2.getContext('2d');
    const img = g.createImageData(W, H);
    const d = img.data;
    const rgbCache = {};
    const put = (x, y, hex) => {
      let rgb = rgbCache[hex];
      if (!rgb) rgb = rgbCache[hex] = parseHex(hex);
      const i = (y * W + x) * 4;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
    };
    const animated = [];   // [x, y, depth] for water / lava / ice pixels
    const foam = [];       // [x, y] shallow water along the shore
    const fr = RAMPS[T.feature] || RAMPS.water;
    for (let y = 0; y < H; ++y) {
      for (let x = 0; x < W; ++x) {
        const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
        let kind = kindAt(c, r);
        const n = fbm(x / 15, y / 15, seed);
        const h = hash2(x, y, seed);
        if (kind === 'path') {
          const ed = edgeDist(x, y, 'path') + (valueNoise(x / 2.6, y / 2.6, seed + 3) - 0.5) * 3.2;
          if (ed < 1.3) kind = 'groundEdge';
          else if (ed < 2.6) { put(x, y, T.path[0]); continue; }
          else {
            if (T.planks) {
              // Boardwalk: boards laid across the direction of travel, nailed down at the ends
              const horiz = kindAt(c - 1, r) === 'path' || kindAt(c + 1, r) === 'path';
              const vert = kindAt(c, r - 1) === 'path' || kindAt(c, r + 1) === 'path';
              const across = vert && !horiz ? y : x, along = vert && !horiz ? x : y;
              const board = Math.floor(across / 4);
              const sv = hash2(board, Math.floor(along / 16), seed + 1);
              if (across % 4 === 0) put(x, y, T.path[0]);
              else if (along % 16 === 3 && across % 4 === 2) put(x, y, T.path[5]);
              else {
                const grain = valueNoise(along / 5, board * 3.7, seed + 11);
                put(x, y, across % 4 === 1 ? T.path[4] : rampPick(T.path, 0.3 + sv * 0.45 + (grain - 0.5) * 0.35, x, y, 2, 4));
              }
            } else if (T.cobble) {
              const row = Math.floor(y / 5);
              const off = (row % 2) * 3;
              const sx = Math.floor((x + off) / 6);
              const mortar = (x + off) % 6 === 0 || y % 5 === 0;
              if (mortar) put(x, y, T.seam && hash2(sx, row, seed + 9) > 0.93 ? T.seam : T.path[1]);
              else {
                const sv = hash2(sx, row, seed + 1);
                const top = y % 5 === 1 || (x + off) % 6 === 1;
                put(x, y, top ? T.path[4] : rampPick(T.path, 0.25 + sv * 0.5 + (n - 0.5) * 0.3, x, y, 2, 4));
              }
            } else {
              let col = rampPick(T.path, n * 0.9 + h * 0.1, x, y, 1, 4);
              if (h > 0.972) col = T.path[5];
              else if (hash2(x, y - 1, seed) > 0.972) col = T.path[1];
              put(x, y, col);
            }
            continue;
          }
        }
        const featEd = (kind === 'water' || kind === 'ice' || kind === 'lava' || kind === 'bog' || kind === 'chasm' || kind === 'rock')
          ? edgeDist(x, y, kind, 10) + (valueNoise(x / 6, y / 6, seed + 5) - 0.5) * 6 + (valueNoise(x / 2, y / 2, seed + 4) - 0.5) * 1.5 - 1.2 : 99;
        if (featEd < 0.3) kind = 'groundEdge';
        if (kind === 'chasm') {
          // A lit rim, sheer layered walls, then darkness with a faint glow far below
          const ed = featEd;
          if (ed < 1.4) { put(x, y, T.shore); continue; }
          if (ed < 7.5) {
            // Layered rock, lit at the top and falling away into shadow
            const k = (ed - 1.4) / 6.1;
            const strata = valueNoise(x / 9, y / 1.6, seed + 8) - 0.5;
            put(x, y, rampPick(T.cliff, 0.9 - k * 0.85 + strata * 0.35, x, y, 0, 5));
            continue;
          }
          const depth = clamp((ed - 7) / 8, 0, 1);
          put(x, y, rampPick(fr, 0.55 - depth * 0.5 + (n - 0.5) * 0.25, x, y, 0, 5));
          animated.push(x, y, depth);
          continue;
        }
        if (kind === 'water' || kind === 'ice' || kind === 'lava' || kind === 'bog') {
          const ed = featEd;
          if (ed < 1.4) { put(x, y, kind === 'lava' ? '#0a0608' : T.shore); continue; }
          if (ed < 2.4) {
            put(x, y, kind === 'lava' ? fr[1] : fr[4]);
            if (kind === 'water') foam.push(x, y);
            continue;
          }
          if (kind === 'water' && ed < 3.6) foam.push(x, y);
          const depth = clamp((ed - 2) / 7, 0, 1);
          if (kind === 'bog' && depth > 0.25) {
            // Lily pads floating on the bog
            const lc = Math.floor(x / 9), lr = Math.floor(y / 8);
            const lh = hash2(lc, lr, seed + 31);
            if (lh > 0.72) {
              const ox = lc * 9 + 2 + hash2(lc, lr, seed + 32) * 5, oy = lr * 8 + 2 + hash2(lc, lr, seed + 33) * 4;
              const dx = x - ox, dy = (y - oy) * 1.3;
              const d2 = dx * dx + dy * dy;
              if (d2 < 7 && !(dx > 0 && Math.abs(dy) < dx * 0.5)) {
                put(x, y, d2 < 2 && dy < 0 ? '#7cb050' : lh > 0.95 && d2 < 1 ? '#f0c8e0' : '#4a8434');
                continue;
              }
            }
          }
          put(x, y, kind === 'ice'
            ? (hash2(Math.floor(x / 5), Math.floor(y / 4), seed) > 0.93 ? fr[4] : rampPick(fr, 0.75 - depth * 0.3 + (n - 0.5) * 0.25, x, y, 2, 4))
            : rampPick(fr, 0.6 - depth * 0.45 + (n - 0.5) * 0.2, x, y, 0, 3));
          animated.push(x, y, depth);
          continue;
        }
        if (kind === 'rock') {
          // Raised outcrop: top surface, cliff face along its southern edge
          let r1 = r;
          while (kindAt(c, r1 + 1) === 'rock') ++r1;
          const ed = featEd;
          if ((r1 + 1) * TILE - y <= 5 || edgeDist(x, y + 5, 'rock', 10) + (valueNoise(x / 6, (y + 5) / 6, seed + 5) - 0.5) * 6 - 1.2 < 0.3) {
            put(x, y, (x % 3 === 0 || ed < 1) ? T.cliff[0] : rampPick(T.cliff, 0.25 + n * 0.3, x, y, 0, 2));
            continue;
          }
          if (ed < 1.2) { put(x, y, T.cliff[1]); continue; }
          if (ed < 2.2) { put(x, y, T.cliff[5]); continue; }
          // Embossed rocky surface: lit from the top left
          const v1 = fbm(x / 5, y / 5, seed + 70), v0 = fbm((x - 1.5) / 5, (y - 1.5) / 5, seed + 70);
          const lit = (v1 - v0) * 9;
          let col = rampPick(T.cliff, 0.5 + lit * 0.5 + (v1 - 0.5) * 0.3, x, y, 1, 5);
          if (h > 0.985) col = T.cliff[1];
          put(x, y, col);
          continue;
        }
        // Ground
        const v = n * 0.85 + valueNoise(x / 4, y / 4, seed + 2) * 0.15;
        let col = rampPick(T.ground, 0.1 + (v - 0.2) * 1.2, x, y, 1, 4);
        if (h > 0.993) col = T.ground[5];
        else if (h < 0.006) col = T.ground[0];
        put(x, y, col);
      }
    }
    // Shadow under outcrops
    for (const [key, type] of feat) {
      if (type !== 'rock') continue;
      const [c, r] = key.split(',').map(Number);
      if (kindAt(c, r + 1) === 'rock') continue;
      for (let y = (r + 1) * TILE; y < Math.min(H, (r + 1) * TILE + 3); ++y)
        for (let x = c * TILE; x < (c + 1) * TILE; ++x) {
          if (kindAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 'ground') continue;
          const i = (y * W + x) * 4;
          d[i] *= 0.65; d[i + 1] *= 0.65; d[i + 2] *= 0.7;
        }
    }
    g.putImageData(img, 0, 0);

    // Grass blades / sparkles
    for (let i = 0; i < W * H / 70; ++i) {
      const x = Math.floor(hash2(i, 1, seed + 21) * W), y = Math.floor(hash2(i, 2, seed + 21) * H);
      if (kindAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 'ground') continue;
      px(g, x, y, 1, T.bladeH || (m.biome === 'meadow' ? 2 : 1), T.blade);
    }

    // Decorations and props, back to front
    const items = [];
    const rng = makeRng(seed * 3 + 1);
    for (let i = 0; i < 95; ++i) {
      const c = Math.floor(rng() * COLS), r = Math.floor(rng() * ROWS);
      if (kindAt(c, r) !== 'ground') continue;
      items.push({ key: T.decor[Math.floor(rng() * T.decor.length)], x: c * TILE + 2 + rng() * 12, y: r * TILE + 4 + rng() * 11 });
    }
    for (const [key, type] of props) {
      if (feat.has(key)) continue;
      const [c, r] = key.split(',').map(Number);
      const j = hash2(c, r, seed);
      items.push({ key: type === 'tree' ? T.tree : T.boulder, x: c * TILE + 8 + (j - 0.5) * 3, y: r * TILE + 15, big: true });
      if (type === 'tree' && j > 0.5) items.push({ key: T.decor[0], x: c * TILE + 2, y: r * TILE + 15 });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      const art = propArt(it.key);
      if (it.big) {
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.beginPath(); g.ellipse(Math.round(it.x), Math.round(it.y), 6, 2.5, 0, 0, TWO_PI); g.fill();
      }
      g.drawImage(art, Math.round(it.x - art.width / 2), Math.round(it.y - art.height + 1));
    }

    // Animated liquid: a mask of the liquid pixels plus two foam patterns
    // for the shore; the motion itself is drawn every frame from scrolling
    // tileable textures (see drawLiquid)
    let liquid = null;
    if (animated.length) {
      let minX = W, minY = H, maxX = 0, maxY = 0;
      for (let i = 0; i < animated.length; i += 3) {
        minX = Math.min(minX, animated[i]); maxX = Math.max(maxX, animated[i]);
        minY = Math.min(minY, animated[i + 1]); maxY = Math.max(maxY, animated[i + 1]);
      }
      const fw = maxX - minX + 1, fh = maxY - minY + 1;
      const mask = makeCanvas(fw, fh);
      const mg = mask.getContext('2d');
      const mi = mg.createImageData(fw, fh);
      for (let i = 0; i < animated.length; i += 3) {
        const j = ((animated[i + 1] - minY) * fw + (animated[i] - minX)) * 4;
        // Alpha carries depth: shallow water shows less of the deep shimmer
        mi.data[j] = mi.data[j + 1] = mi.data[j + 2] = 255;
        mi.data[j + 3] = Math.round(150 + animated[i + 2] * 105);
      }
      mg.putImageData(mi, 0, 0);
      const foams = [];
      if (foam.length)
        for (let f = 0; f < 2; ++f) {
          const fc = makeCanvas(W, H);
          const fg = fc.getContext('2d');
          fg.fillStyle = '#f2fbff';
          for (let i = 0; i < foam.length; i += 2)
            if (hash2(foam[i] >> 1, foam[i + 1] >> 1, seed + 61 + f * 7) > 0.55)
              fg.fillRect(foam[i], foam[i + 1], 1, 1);
          foams.push(fc);
        }
      liquid = { mask, x: minX, y: minY, w: fw, h: fh, foams, kind: T.feature };
    }
    // Glow points that flicker: lava, the deep of the chasms and crystal clusters
    const lights = [];
    if (T.feature === 'lava' || T.deepGlow)
      for (const [key, type] of feat)
        if (type === T.feature && hash2(key.length, key.charCodeAt(0) + key.charCodeAt(key.length - 1), seed) > (T.deepGlow ? 0.7 : 0.2)) {
          const [c, r] = key.split(',').map(Number);
          lights.push({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL, ph: hash2(c, r, seed) * TWO_PI, color: T.deepGlow || '#ff6a1a', r: 1.1 });
        }
    if (T.glow)
      for (const [key, type] of props)
        if (type === 'tree' && !feat.has(key)) {
          const [c, r] = key.split(',').map(Number);
          lights.push({ x: (c + 0.5) * CELL, y: (r + 0.2) * CELL, ph: hash2(c, r, seed) * TWO_PI, color: T.glow, r: 0.9 });
        }

    // Gates
    const gates = [];
    for (const wp of m.paths) {
      const s = wp[0], e = wp[wp.length - 1];
      if (!gates.some(q => q.kind === 'spawn' && q.c === s[0] && q.r === s[1]))
        gates.push({ kind: 'spawn', c: s[0], r: s[1] });
      const exitKind = NS.paths.isEdge(e) ? 'exit' : 'keep';
      if (!gates.some(q => q.kind === exitKind && q.c === e[0] && q.r === e[1]))
        gates.push({ kind: exitKind, c: e[0], r: e[1] });
    }
    return { base: canvas2, liquid, lights, gates, biome: m.biome };
  }

  /* ── Drawing the battlefield ground ── */
  function drawTerrain() {
    const t = getTerrain(G.currentMap);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(t.base, 0, 0, WORLD_W, WORLD_H);
    if (t.liquid) drawLiquid(t.liquid);
    for (const l of t.lights)
      drawGlow(l.color, l.x, l.y, CELL * l.r, 0.16 + 0.08 * Math.sin(G.animTime * 2 + l.ph));
  }

  /* ── Liquids: tileable textures scrolled with sub-pixel offsets and
     masked to the water / lava / ice of the map, redrawn every frame ── */
  const LIQ_TILE = 48;
  const liquidTex = {};

  // Periodic value noise so the texture tiles seamlessly
  function noiseP(x, y, p, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hash2(((a % p) + p) % p, ((b % p) + p) % p, seed);
    const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function liquidTexture(key) {
    if (liquidTex[key]) return liquidTex[key];
    const N = LIQ_TILE;
    const c = makeCanvas(N, N);
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    for (let y = 0; y < N; ++y)
      for (let x = 0; x < N; ++x) {
        const v = noiseP(x / 8, y / 8, N / 8, key.length * 13) * 0.65 + noiseP(x / 4, y / 4, N / 4, key.length * 29) * 0.35;
        let r = 0, gg = 0, b = 0, a = 0;
        if (key === 'caustic') {
          // Thin bright ridges where the noise crosses its middle
          const ridge = 1 - Math.abs(v - 0.5) * 2;
          a = ridge > 0.86 ? 200 : ridge > 0.74 ? 90 : 0;
          r = 190; gg = 236; b = 255;
        } else if (key === 'veins') {
          const ridge = 1 - Math.abs(v - 0.5) * 2;
          a = ridge > 0.7 ? 255 : ridge > 0.5 ? 140 : 0;
          r = 255; gg = ridge > 0.8 ? 236 : 168; b = ridge > 0.8 ? 138 : 40;
        } else if (key === 'scum') {
          // Drifting duckweed and algae on the bog
          a = v > 0.63 ? 200 : v > 0.57 ? 100 : 0;
          r = 132; gg = 168; b = 60;
        } else if (key === 'motes') {
          a = hash2(x, y, 77) > 0.996 ? 200 : hash2(x, y, 78) > 0.994 ? 90 : 0;
          r = 176; gg = 140; b = 255;
        } else if (key === 'crust') {
          a = v > 0.62 ? 235 : v > 0.56 ? 120 : 0;
          r = 42; gg = 14; b = 8;
        } else {
          a = hash2(x, y, 99) > 0.985 ? 255 : 0;
          r = gg = b = 255;
        }
        const i = (y * N + x) * 4;
        img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = a;
      }
    g.putImageData(img, 0, 0);
    liquidTex[key] = c;
    return c;
  }

  let liquidScratch = null;
  function drawLiquid(L) {
    const w = L.w * AP, h = L.h * AP;
    if (!liquidScratch) liquidScratch = makeCanvas(16, 16);
    if (liquidScratch.width < w || liquidScratch.height < h) {
      liquidScratch.width = Math.max(liquidScratch.width, Math.ceil(w));
      liquidScratch.height = Math.max(liquidScratch.height, Math.ceil(h));
    }
    const g = liquidScratch.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    const t = G.animTime;
    // Anchor the textures in the world so neighbouring pools line up
    const layer = (key, ox, oy, alpha, op) => {
      const pat = g.createPattern(liquidTexture(key), 'repeat');
      pat.setTransform(new DOMMatrix().translateSelf(ox - L.x * AP, oy - L.y * AP).scaleSelf(AP, AP));
      g.globalCompositeOperation = op || 'source-over';
      g.globalAlpha = alpha;
      g.fillStyle = pat;
      g.fillRect(0, 0, w, h);
    };
    if (L.kind === 'lava') {
      layer('veins', t * 6, t * 3.5, 0.6);
      layer('veins', -t * 4.5, t * 5, 0.25, 'lighter');
      layer('crust', t * 2.2, -t * 1.4, 0.95);
    } else if (L.kind === 'water') {
      layer('caustic', t * 7, t * 3, 0.65);
      layer('caustic', -t * 5.5, t * 4.5, 0.5, 'lighter');
    } else if (L.kind === 'bog') {
      layer('scum', t * 1.6, t * 0.7, 0.75);
      layer('glint', t * 0.4, -t * 2.2, 0.35, 'lighter');
    } else if (L.kind === 'chasm') {
      // Motes rising out of the deep
      layer('motes', t * 1.2, -t * 6, 1);
      layer('motes', -t * 0.8, -t * 3.5 + 17, 0.6, 'lighter');
    } else {
      layer('glint', t * 2, t * 1, 0.8);
    }
    g.globalCompositeOperation = 'destination-in';
    g.globalAlpha = 1;
    g.drawImage(L.mask, 0, 0, w, h);
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = L.kind === 'lava' || L.kind === 'bog' ? 'source-over' : 'lighter';
    ctx.globalAlpha = L.kind === 'water' ? 0.42 : L.kind === 'lava' ? 0.85 : L.kind === 'bog' ? 0.6 : 1;
    ctx.drawImage(liquidScratch, 0, 0, w, h, L.x * AP, L.y * AP, w, h);
    ctx.globalCompositeOperation = prev;
    ctx.globalAlpha = 1;
    // Foam along the shore breathes in and out
    if (L.foams.length) {
      const k = 0.5 + 0.5 * Math.sin(t * 1.7);
      ctx.globalAlpha = 0.25 + 0.55 * k;
      ctx.drawImage(L.foams[0], 0, 0, WORLD_W, WORLD_H);
      ctx.globalAlpha = 0.25 + 0.55 * (1 - k);
      ctx.drawImage(L.foams[1], 0, 0, WORLD_W, WORLD_H);
      ctx.globalAlpha = 1;
    }
  }
  // Gates are drawn with the actors so enemies appear from inside them
  function drawGates(front) {
    const t = getTerrain(G.currentMap);
    for (const gt of t.gates) {
      const x = (gt.c + 0.5) * CELL, y = (gt.r + 0.5) * CELL;
      const art = gateArt(gt.kind, t.biome);
      if (gt.kind === 'spawn') {
        if (front) continue;
        blitArt(art, x, y + CELL * 0.5 + 6, false, 1, 1);
        drawGlow('#ff3a5a', x, y + 2, CELL * (0.7 + 0.1 * Math.sin(G.animTime * 4)), 0.35 + (G.warningActive ? 0.4 * Math.abs(Math.sin(G.warningPulse)) : 0));
      } else {
        if (!front) continue;
        const scale = gt.kind === 'keep' ? 1 : 1;
        blitArt(art, x, y + CELL * 0.5 + 4, false, 1, scale);
        // Banners
        const wave = Math.sin(G.animTime * 4) * 1.5;
        const bx = gt.kind === 'keep' ? [x] : [x - 17 + 1, x + 17 - 1];
        const top = y + CELL * 0.5 + 4 - art.height * AP;
        for (const b of bx) {
          ctx.fillStyle = '#c8303a';
          ctx.beginPath();
          ctx.moveTo(b + 1, top + 1);
          ctx.lineTo(b + 11 + wave, top + 3);
          ctx.lineTo(b + 1, top + 8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffd75a';
          ctx.fillRect(b + 2, top + 3, 2, 2);
        }
      }
    }
  }

  NS.terrain = { TERRAIN, propArt, drawTerrain, drawGates };

})();
