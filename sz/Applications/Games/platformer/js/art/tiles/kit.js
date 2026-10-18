;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.tileKit || (NS.tileKit = {});

  /*
   * Level terrain for the Platformer. Each world has a seamless rock/earth
   * texture, a surface cap (grass, moss, snow, ash, gilded marble), its own
   * ledges, spikes, liquids and surface decorations. Static tiles are baked
   * into chunk canvases 16 tiles wide (LRU cached, a chunk at most per frame
   * baked ahead of the camera): rounded outer corners, cap bands wrapping
   * around edges, rim shading, outlines, ambient occlusion under overhangs
   * and seeded decorations. Per frame the level costs one drawImage per
   * visible chunk plus the animated liquid surfaces and fading secret walls.
   *
   *   const tiles = SZ.PlatformerTiles.create(level, { scale: 1.25 });
   *   tiles.prepare(rect);                 // bake chunks near the camera
   *   tiles.draw(ctx, rect);               // world-space rect { x0, y0, x1, y1 }
   *   tiles.drawLive(ctx, rect, t, fakeAlpha);
   *   tiles.refresh(c, r);                 // a tile changed (crate, gate, ...)
   *
   * The terrain is split by stage: kit.js (this file: constants, world themes, helpers and the
   * seamless textures, shared through SZ.Platformer.tileKit), cells.js and tiles.js, which
   * publishes SZ.PlatformerTiles.
   */

  const TS = 48;
  const CHUNK_COLS = 16;
  const CHUNK_W = CHUNK_COLS * TS;
  const MAX_CHUNKS = 7;
  const TEX = 256;
  const TWO_PI = Math.PI * 2;

  /* tile codes (mirrors SZ.PlatformerPhysics.T) */
  const EMPTY = 0, SOLID = 1, ONEWAY = 2, SPIKE = 3, LIQUID = 5, ICE = 6, FAKE = 7;

  const THEMES = [
    { /* Sunleaf Meadows */
      base: '#7a4c2a', light: '#a06a3c', dark: '#4e2e16', stone: ['#9c7a58', '#7e5e40', '#b08a62'], speck: '#3a200e',
      cap: '#4fae34', capLight: '#94e05c', capDark: '#2a7020', outline: '#2a1608', rim: '#3a2210',
      ledge: 'wood', spike: '#c8ccd8', liquid: ['#4ab8f0', '#1a6ab0', '#0a3a78'], surface: '#bff0ff', hot: false,
      deco: 'meadow', hang: 'roots'
    },
    { /* Glimmer Caverns */
      base: '#363e58', light: '#4e5a7c', dark: '#1e2236', stone: ['#56627e', '#424c68', '#6a7898'], speck: '#141826',
      cap: '#2f8a7a', capLight: '#62d8b8', capDark: '#1a5a50', outline: '#0c0e1a', rim: '#1a1e30',
      ledge: 'slab', spike: '#a8e8ff', liquid: ['#38c8e8', '#1a6a98', '#0a2e58'], surface: '#c8f8ff', hot: false,
      deco: 'caverns', hang: 'stalactite', vein: '#6ae0ff'
    },
    { /* Frostfang Peaks */
      base: '#5e6e86', light: '#8494ae', dark: '#3a4660', stone: ['#8a9ab4', '#6a7a94', '#a2b2c8'], speck: '#2a3446',
      cap: '#eef6ff', capLight: '#ffffff', capDark: '#a8c4e0', outline: '#1e2838', rim: '#2e3a50',
      ledge: 'icewood', spike: '#e0f4ff', liquid: ['#8ad8f8', '#3a90c8', '#1a4a80'], surface: '#ffffff', hot: false,
      deco: 'peaks', hang: 'icicle'
    },
    { /* Cinder Forge */
      base: '#2c2024', light: '#44323a', dark: '#160e10', stone: ['#4a383c', '#38282c', '#5a4448'], speck: '#0c0606',
      cap: '#5a4a4a', capLight: '#8a7470', capDark: '#3a2c2c', outline: '#080404', rim: '#120a0a',
      ledge: 'girder', spike: '#b0a8a8', liquid: ['#ffd04a', '#ff6a1a', '#a8200a'], surface: '#fff0a0', hot: true,
      deco: 'forge', hang: 'drip', vein: '#ff6a1a'
    },
    { /* Skyspire Citadel */
      base: '#cfc6e2', light: '#ece6f8', dark: '#9a8eb8', stone: ['#ddd6ee', '#bcb2d4', '#f2eefa'], speck: '#8a7eaa',
      cap: '#e8c060', capLight: '#fff0b0', capDark: '#a87a2a', outline: '#4a3a6a', rim: '#7a6a9a',
      ledge: 'cloud', spike: '#ffe08a', liquid: ['#b8a8ff', '#6a50c8', '#2a1a6a'], surface: '#ffffff', hot: false,
      deco: 'citadel', hang: 'cloud', brick: true
    }
  ];

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function rgb(hex) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    const c = rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function mix(a, b, k) {
    const x = rgb(a), y = rgb(b);
    const f = (i) => Math.round(x[i] + (y[i] - x[i]) * k).toString(16).padStart(2, '0');
    return '#' + f(0) + f(1) + f(2);
  }

  /* deterministic per-cell randomness */
  function cellRand(c, r, salt) {
    let h = (c * 73856093) ^ (r * 19349663) ^ ((salt || 0) * 83492791);
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    h ^= h >>> 15;
    return ((h >>> 0) % 100000) / 100000;
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

  /* ══════════════════════════════════════════════════════════════════
     TEXTURES: one seamless 256 x 256 fill per world
     ══════════════════════════════════════════════════════════════════ */

  const textureCache = {};

  function wrapDraw(g, x, y, r, fn) {
    for (const ox of [-TEX, 0, TEX])
      for (const oy of [-TEX, 0, TEX])
        if (x + ox + r > 0 && x + ox - r < TEX && y + oy + r > 0 && y + oy - r < TEX)
          fn(x + ox, y + oy);
  }

  function paintTexture(world) {
    const th = THEMES[world];
    const c = makeCanvas(TEX, TEX);
    const g = c.getContext('2d');
    const rand = mulberry(1000 + world * 77);
    g.fillStyle = th.base;
    g.fillRect(0, 0, TEX, TEX);
    if (th.brick) {
      /* marble masonry: offset courses, each block with its own tint and a gilded seam */
      const bh = 32, bw = 64;
      for (let row = 0; row < TEX / bh; ++row) {
        const off = row % 2 ? bw / 2 : 0;
        for (let col = -1; col < TEX / bw + 1; ++col) {
          const x = col * bw + off, y = row * bh;
          const tint = mix(th.stone[(row * 3 + col * 7 + 9) % 3], '#ffffff', rand() * 0.2);
          const lg = g.createLinearGradient(0, y, 0, y + bh);
          lg.addColorStop(0, mix(tint, '#ffffff', 0.3));
          lg.addColorStop(1, mix(tint, th.dark, 0.25));
          g.fillStyle = lg;
          g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
          /* veins */
          g.strokeStyle = rgba(th.speck, 0.25);
          g.lineWidth = 1;
          g.beginPath();
          let vx = x + rand() * bw, vy = y + 2;
          g.moveTo(vx, vy);
          for (let k = 0; k < 4; ++k) {
            vx += (rand() - 0.5) * 18;
            vy += bh / 4;
            g.lineTo(vx, vy);
          }
          g.stroke();
        }
        g.fillStyle = rgba(th.rim, 0.7);
        g.fillRect(0, row * bh, TEX, 1.5);
        g.fillStyle = rgba(th.capLight, 0.5);
        g.fillRect(0, row * bh + 1.5, TEX, 1);
      }
      for (let row = 0; row < TEX / bh; ++row) {
        const off = row % 2 ? bw / 2 : 0;
        for (let col = 0; col <= TEX / bw; ++col) {
          g.fillStyle = rgba(th.rim, 0.6);
          g.fillRect(col * bw + off - 1, row * bh, 1.5, bh);
        }
      }
      return c;
    }
    /* soft strata */
    for (let k = 0; k < 6; ++k) {
      const y = rand() * TEX;
      g.fillStyle = rgba(k % 2 ? th.light : th.dark, 0.12);
      for (const oy of [-TEX, 0, TEX]) {
        g.beginPath();
        g.moveTo(0, y + oy);
        for (let x = 0; x <= TEX; x += 32)
          g.lineTo(x, y + oy + Math.sin(x / TEX * TWO_PI * 2 + k) * 6);
        g.lineTo(TEX, y + oy + 18);
        g.lineTo(0, y + oy + 18);
        g.closePath();
        g.fill();
      }
    }
    /* stones and pebbles, wrapped across the edges */
    for (let k = 0; k < 46; ++k) {
      const x = rand() * TEX, y = rand() * TEX;
      const rx = 5 + rand() * 13, ry = rx * (0.55 + rand() * 0.35);
      const col = th.stone[(rand() * th.stone.length) | 0];
      const rot = rand() * Math.PI;
      wrapDraw(g, x, y, rx + 4, function(px, py) {
        g.save();
        g.translate(px, py);
        g.rotate(rot);
        g.fillStyle = rgba(th.dark, 0.55);
        g.beginPath();
        g.ellipse(1.5, 2.5, rx, ry, 0, 0, TWO_PI);
        g.fill();
        const rg = g.createRadialGradient(-rx * 0.3, -ry * 0.4, 1, 0, 0, rx);
        rg.addColorStop(0, mix(col, '#ffffff', 0.25));
        rg.addColorStop(1, mix(col, th.dark, 0.3));
        g.fillStyle = rg;
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, 0, TWO_PI);
        g.fill();
        g.restore();
      });
    }
    /* crystal or ember veins */
    if (th.vein) {
      for (let k = 0; k < 7; ++k) {
        let x = rand() * TEX, y = rand() * TEX;
        const pts = [[x, y]];
        for (let s = 0; s < 5; ++s) {
          x += (rand() - 0.5) * 40;
          y += 10 + rand() * 18;
          pts.push([x, y]);
        }
        for (const oy of [-TEX, 0])
          for (const ox of [-TEX, 0, TEX]) {
            g.strokeStyle = rgba(th.vein, 0.35);
            g.lineWidth = 4;
            g.beginPath();
            pts.forEach((p, i) => (i ? g.lineTo(p[0] + ox, p[1] + oy) : g.moveTo(p[0] + ox, p[1] + oy)));
            g.stroke();
            g.strokeStyle = rgba(th.vein, 0.9);
            g.lineWidth = 1.4;
            g.stroke();
          }
      }
    }
    /* speckles */
    for (let k = 0; k < 420; ++k) {
      g.fillStyle = rgba(rand() < 0.5 ? th.speck : th.light, 0.25 + rand() * 0.3);
      g.fillRect(rand() * TEX, rand() * TEX, 1 + rand() * 1.6, 1 + rand() * 1.6);
    }
    return c;
  }

  function texture(world) {
    if (!textureCache[world])
      textureCache[world] = paintTexture(world);
    return textureCache[world];
  }

  Object.assign(Kit, { TS, CHUNK_COLS, CHUNK_W, MAX_CHUNKS, TWO_PI, EMPTY, SOLID, ONEWAY, SPIKE, LIQUID, ICE, FAKE, THEMES, makeCanvas, rgba, mix, cellRand, texture });
})();
