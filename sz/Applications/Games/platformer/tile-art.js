;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

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

  /* ══════════════════════════════════════════════════════════════════
     CELL PAINTERS (bake time only)
     ══════════════════════════════════════════════════════════════════ */

  function isTerrain(code) {
    return code === SOLID || code === ICE || code === FAKE;
  }

  function terrainAt(level, c, r) {
    if (c < 0 || c >= level.cols)
      return true;
    if (r < 0)
      return false;
    if (r >= level.rows)
      return true;
    return isTerrain(level.tiles[r * level.cols + c]);
  }

  function codeAt(level, c, r) {
    if (c < 0 || c >= level.cols || r < 0 || r >= level.rows)
      return -1;
    return level.tiles[r * level.cols + c];
  }

  /* a cell outline, rounded where two open sides meet; `grow` pushes closed
     sides outward a pixel so neighbouring fills overlap without seams */
  function cellPath(g, x, y, s, f, rad, grow) {
    const tl = f.u && f.l ? rad : 0, tr = f.u && f.r ? rad : 0, br = f.d && f.r ? rad : 0, bl = f.d && f.l ? rad : 0;
    if (grow) {
      const gl = f.l ? 0 : grow, gr = f.r ? 0 : grow, gu = f.u ? 0 : grow, gd = f.d ? 0 : grow;
      x -= gl;
      y -= gu;
      const w = s + gl + gr, h = s + gu + gd;
      g.beginPath();
      g.moveTo(x + tl, y);
      g.lineTo(x + w - tr, y);
      if (tr) g.arcTo(x + w, y, x + w, y + tr, tr);
      g.lineTo(x + w, y + h - br);
      if (br) g.arcTo(x + w, y + h, x + w - br, y + h, br);
      g.lineTo(x + bl, y + h);
      if (bl) g.arcTo(x, y + h, x, y + h - bl, bl);
      g.lineTo(x, y + tl);
      if (tl) g.arcTo(x, y, x + tl, y, tl);
      g.closePath();
      return;
    }
    g.beginPath();
    g.moveTo(x + tl, y);
    g.lineTo(x + s - tr, y);
    if (tr) g.arcTo(x + s, y, x + s, y + tr, tr);
    g.lineTo(x + s, y + s - br);
    if (br) g.arcTo(x + s, y + s, x + s - br, y + s, br);
    g.lineTo(x + bl, y + s);
    if (bl) g.arcTo(x, y + s, x, y + s - bl, bl);
    g.lineTo(x, y + tl);
    if (tl) g.arcTo(x, y, x + tl, y, tl);
    g.closePath();
  }

  /* the terrain body with rim shading on every exposed side */
  function paintTerrain(g, level, th, c, r, x, y, pattern, ice) {
    const f = {
      u: !terrainAt(level, c, r - 1), d: !terrainAt(level, c, r + 1),
      l: !terrainAt(level, c - 1, r), r: !terrainAt(level, c + 1, r)
    };
    cellPath(g, x, y, TS, f, 12, 1);
    if (ice) {
      const lg = g.createLinearGradient(x, y, x + TS, y + TS);
      lg.addColorStop(0, '#e8fbff');
      lg.addColorStop(0.45, '#9ae0f8');
      lg.addColorStop(1, '#4aa0d8');
      g.fillStyle = lg;
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x + 8, y + TS - 6);
      g.lineTo(x + TS - 10, y + 8);
      g.stroke();
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x + 20, y + TS - 4);
      g.lineTo(x + TS - 4, y + 18);
      g.stroke();
      g.strokeStyle = 'rgba(30,90,150,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 4, y + 20 + cellRand(c, r, 5) * 10);
      g.lineTo(x + 18, y + 26);
      g.lineTo(x + 26, y + 40);
      g.stroke();
      g.restore();
    } else {
      g.fillStyle = pattern;
      g.fill();
    }
    /* depth: cells buried deep get darker so the mass reads as volume */
    let depth = 0;
    for (let k = 1; k <= 5; ++k)
      if (terrainAt(level, c, r - k)) ++depth;
    if (depth >= 2 && !ice && !f.d) {
      g.fillStyle = rgba(th.dark, 0.11 * (depth - 1));
      g.fillRect(x, y, TS, TS);
    }
    if (depth >= 2 && !ice && !f.d && !f.l && !f.r)
      paintBuried(g, th, c, r, x, y, level.world | 0);
    g.save();
    cellPath(g, x, y, TS, f, 12);
    g.clip();
    if (depth >= 2 && !ice && f.d) {
      g.fillStyle = rgba(th.dark, 0.11 * (depth - 1));
      g.fillRect(x, y, TS, TS);
    }
    /* light from above, shade from below and the sides */
    const RIM = 14;
    if (f.l) {
      const lg = g.createLinearGradient(x, 0, x + RIM, 0);
      lg.addColorStop(0, rgba(th.dark, 0.7));
      lg.addColorStop(1, rgba(th.dark, 0));
      g.fillStyle = lg;
      g.fillRect(x, y, RIM, TS);
    }
    if (f.r) {
      const lg = g.createLinearGradient(x + TS, 0, x + TS - RIM, 0);
      lg.addColorStop(0, rgba(th.dark, 0.75));
      lg.addColorStop(1, rgba(th.dark, 0));
      g.fillStyle = lg;
      g.fillRect(x + TS - RIM, y, RIM, TS);
    }
    if (f.d) {
      const lg = g.createLinearGradient(0, y + TS, 0, y + TS - RIM - 4);
      lg.addColorStop(0, rgba(th.dark, 0.85));
      lg.addColorStop(1, rgba(th.dark, 0));
      g.fillStyle = lg;
      g.fillRect(x, y + TS - RIM - 4, TS, RIM + 4);
    }
    g.restore();
    /* outline on the exposed sides */
    g.strokeStyle = th.outline;
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    if (f.l) { g.moveTo(x + 1, y + (f.u ? 12 : 0)); g.lineTo(x + 1, y + TS - (f.d ? 12 : 0)); }
    if (f.r) { g.moveTo(x + TS - 1, y + (f.u ? 12 : 0)); g.lineTo(x + TS - 1, y + TS - (f.d ? 12 : 0)); }
    if (f.d) { g.moveTo(x + (f.l ? 12 : 0), y + TS - 1); g.lineTo(x + TS - (f.r ? 12 : 0), y + TS - 1); }
    g.stroke();
    if (f.d && f.l) { g.beginPath(); g.arc(x + 12, y + TS - 12, 11, Math.PI / 2, Math.PI); g.stroke(); }
    if (f.d && f.r) { g.beginPath(); g.arc(x + TS - 12, y + TS - 12, 11, 0, Math.PI / 2); g.stroke(); }
    return f;
  }

  /* the surface band on top of exposed cells: grass, moss, snow, ash or gilding */
  function paintCap(g, level, th, c, r, x, y, f, world) {
    if (!f.u)
      return;
    const ice = codeAt(level, c, r) === ICE;
    if (ice && world !== 2)
      return;
    const depth = ice ? 7 : th.brick ? 9 : 13;
    const wave = (k) => depth + Math.sin((c * TS + k) * 0.21) * 2.5 + (cellRand(c, r, k) - 0.5) * 3;
    /* the band: hangs slightly over open sides */
    const x0 = x - (f.l ? 3 : 0), x1 = x + TS + (f.r ? 3 : 0);
    g.beginPath();
    g.moveTo(x0, y + (f.l ? 10 : 0));
    if (f.l) g.quadraticCurveTo(x0, y - 3, x0 + 12, y - 3);
    else g.lineTo(x0, y - 3);
    g.lineTo(x1 - (f.r ? 12 : 0), y - 3);
    if (f.r) g.quadraticCurveTo(x1, y - 3, x1, y + 10);
    else g.lineTo(x1, y - 3);
    for (let k = 0; k <= 6; ++k) {
      const px = x1 - (x1 - x0) * k / 6;
      let py = y + wave(k * 8);
      if ((k === 0 && f.r) || (k === 6 && f.l)) py = y + depth + 6;
      g.lineTo(px, py);
    }
    g.closePath();
    const lg = g.createLinearGradient(0, y - 3, 0, y + depth + 4);
    lg.addColorStop(0, th.capLight);
    lg.addColorStop(0.35, th.cap);
    lg.addColorStop(1, th.capDark);
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = rgba(th.outline, 0.85);
    g.lineWidth = 2;
    g.stroke();
    /* a bright lip along the very top */
    g.strokeStyle = rgba(th.capLight, 0.9);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0 + (f.l ? 8 : 0), y - 1.5);
    g.lineTo(x1 - (f.r ? 8 : 0), y - 1.5);
    g.stroke();
    if (world === 0) {
      /* grass blades poking up and over the lip */
      for (let k = 0; k < 9; ++k) {
        const bx = x + 2 + k * 5.2 + cellRand(c, r, 30 + k) * 3;
        const bh = 4 + cellRand(c, r, 40 + k) * 7;
        const lean = (cellRand(c, r, 50 + k) - 0.5) * 6;
        g.fillStyle = k % 3 ? th.capLight : th.cap;
        g.beginPath();
        g.moveTo(bx - 2, y + 1);
        g.quadraticCurveTo(bx + lean * 0.3, y - bh * 0.6, bx + lean, y - bh);
        g.quadraticCurveTo(bx + 1, y - bh * 0.4, bx + 2.2, y + 1);
        g.closePath();
        g.fill();
      }
    } else if (world === 2) {
      /* snow drifts with a cold shadow and sparkles */
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(x + TS * (0.3 + cellRand(c, r, 3) * 0.4), y - 1, 14, 5, 0, Math.PI, TWO_PI);
      g.fill();
      for (let k = 0; k < 3; ++k) {
        g.fillStyle = 'rgba(200,240,255,0.95)';
        g.fillRect(x + cellRand(c, r, 60 + k) * TS, y + 2 + cellRand(c, r, 70 + k) * 6, 1.5, 1.5);
      }
    } else if (world === 3) {
      /* glowing embers in the ash */
      for (let k = 0; k < 3; ++k) {
        if (cellRand(c, r, 80 + k) < 0.5) continue;
        const ex = x + cellRand(c, r, 90 + k) * TS, ey = y + 3 + cellRand(c, r, 100 + k) * 6;
        g.fillStyle = 'rgba(255,140,40,0.35)';
        g.beginPath();
        g.arc(ex, ey, 4, 0, TWO_PI);
        g.fill();
        g.fillStyle = '#ffb04a';
        g.fillRect(ex - 1, ey - 1, 2, 2);
      }
    } else if (world === 4) {
      /* a gilded trim with studs */
      g.fillStyle = th.capDark;
      for (let k = 0; k < 3; ++k) {
        g.beginPath();
        g.arc(x + 8 + k * 16, y + 4, 2, 0, TWO_PI);
        g.fill();
      }
    } else if (world === 1) {
      /* moss tendrils */
      for (let k = 0; k < 4; ++k) {
        const mx = x + 4 + k * 11 + cellRand(c, r, 110 + k) * 5;
        g.strokeStyle = rgba(th.capLight, 0.8);
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(mx, y + depth - 2);
        g.quadraticCurveTo(mx + 2, y + depth + 4, mx - 1, y + depth + 6 + cellRand(c, r, 120 + k) * 6);
        g.stroke();
      }
    }
  }

  /* decorations standing on a surface cell */
  function paintDeco(g, th, c, r, x, y, world) {
    const roll = cellRand(c, r, 7);
    if (roll > 0.42)
      return;
    const k = cellRand(c, r, 8);
    const cx = x + 8 + cellRand(c, r, 9) * (TS - 16);
    if (world === 0) {
      if (k < 0.45) {
        /* a flower */
        const petal = ['#ff7aa8', '#ffe14a', '#ffffff', '#b88aff'][(cellRand(c, r, 10) * 4) | 0];
        g.strokeStyle = '#2e7a24';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(cx, y);
        g.quadraticCurveTo(cx - 2, y - 7, cx, y - 13);
        g.stroke();
        for (let p = 0; p < 5; ++p) {
          const a = p * TWO_PI / 5;
          g.fillStyle = petal;
          g.beginPath();
          g.ellipse(cx + Math.cos(a) * 3.2, y - 14 + Math.sin(a) * 3.2, 2.6, 2.6, 0, 0, TWO_PI);
          g.fill();
        }
        g.fillStyle = '#ffb02a';
        g.beginPath();
        g.arc(cx, y - 14, 1.8, 0, TWO_PI);
        g.fill();
      } else if (k < 0.7) {
        /* a tuft */
        g.fillStyle = th.cap;
        for (let b = 0; b < 5; ++b) {
          g.beginPath();
          g.moveTo(cx - 6 + b * 3, y);
          g.lineTo(cx - 5 + b * 3 + (b - 2) * 1.5, y - 8 - (b % 2) * 4);
          g.lineTo(cx - 3 + b * 3, y);
          g.fill();
        }
      } else if (k < 0.85) {
        /* a mushroom */
        g.fillStyle = '#f4e8d0';
        g.fillRect(cx - 1.5, y - 7, 3, 7);
        g.fillStyle = '#e8402a';
        g.beginPath();
        g.ellipse(cx, y - 7, 6, 4.5, 0, Math.PI, TWO_PI);
        g.fill();
        g.fillStyle = '#ffffff';
        g.fillRect(cx - 3, y - 10, 1.6, 1.6);
        g.fillRect(cx + 1.5, y - 9, 1.4, 1.4);
      } else {
        paintPebble(g, th, cx, y);
      }
    } else if (world === 1) {
      if (k < 0.5) {
        /* glowing crystal cluster */
        const col = k < 0.25 ? '#6ae0ff' : '#c08aff';
        g.fillStyle = rgba(col, 0.18);
        g.beginPath();
        g.arc(cx, y - 8, 14, 0, TWO_PI);
        g.fill();
        for (let p = 0; p < 3; ++p) {
          const h = 10 + p * 4 - (p === 2 ? 6 : 0), w = 4;
          const bx = cx - 5 + p * 5;
          g.fillStyle = mix(col, '#ffffff', 0.25);
          g.beginPath();
          g.moveTo(bx - w / 2, y);
          g.lineTo(bx - w / 2 + (p - 1), y - h);
          g.lineTo(bx + (p - 1) * 1.5, y - h - 4);
          g.lineTo(bx + w / 2, y);
          g.closePath();
          g.fill();
          g.strokeStyle = rgba('#0c0e1a', 0.7);
          g.lineWidth = 1;
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.7)';
          g.fillRect(bx - 1, y - h + 2, 1, h - 4);
        }
      } else if (k < 0.75) {
        /* glow mushrooms */
        g.fillStyle = '#c8f0e0';
        g.fillRect(cx - 1, y - 6, 2, 6);
        g.fillStyle = '#5ae8c8';
        g.beginPath();
        g.ellipse(cx, y - 6, 5, 3.5, 0, Math.PI, TWO_PI);
        g.fill();
        g.fillStyle = 'rgba(90,232,200,0.2)';
        g.beginPath();
        g.arc(cx, y - 6, 10, 0, TWO_PI);
        g.fill();
      } else {
        paintPebble(g, th, cx, y);
      }
    } else if (world === 2) {
      if (k < 0.4) {
        /* a snowy little fir */
        g.fillStyle = '#5a3a2a';
        g.fillRect(cx - 1.5, y - 5, 3, 5);
        for (let p = 0; p < 3; ++p) {
          const w = 10 - p * 3, yy = y - 4 - p * 6;
          g.fillStyle = '#2e5a4a';
          g.beginPath();
          g.moveTo(cx - w, yy);
          g.lineTo(cx, yy - 9);
          g.lineTo(cx + w, yy);
          g.closePath();
          g.fill();
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.moveTo(cx - w * 0.6, yy - 3);
          g.lineTo(cx, yy - 9);
          g.lineTo(cx + w * 0.6, yy - 3);
          g.closePath();
          g.fill();
        }
      } else if (k < 0.7) {
        /* ice shards */
        g.fillStyle = 'rgba(200,240,255,0.9)';
        g.beginPath();
        g.moveTo(cx - 5, y);
        g.lineTo(cx - 2, y - 12);
        g.lineTo(cx + 1, y);
        g.moveTo(cx, y);
        g.lineTo(cx + 4, y - 8);
        g.lineTo(cx + 6, y);
        g.fill();
        g.strokeStyle = 'rgba(40,100,160,0.6)';
        g.lineWidth = 1;
        g.stroke();
      } else {
        paintPebble(g, th, cx, y);
      }
    } else if (world === 3) {
      if (k < 0.4) {
        /* a smouldering vent */
        g.fillStyle = '#1a1012';
        g.beginPath();
        g.ellipse(cx, y - 2, 8, 4, 0, Math.PI, TWO_PI);
        g.fill();
        g.fillStyle = 'rgba(255,120,30,0.35)';
        g.beginPath();
        g.arc(cx, y - 3, 9, 0, TWO_PI);
        g.fill();
        g.fillStyle = '#ffb04a';
        g.fillRect(cx - 3, y - 4, 6, 2);
      } else if (k < 0.7) {
        /* obsidian spires */
        g.fillStyle = '#120a10';
        g.beginPath();
        g.moveTo(cx - 6, y);
        g.lineTo(cx - 3, y - 14);
        g.lineTo(cx, y);
        g.lineTo(cx + 2, y - 9);
        g.lineTo(cx + 5, y);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255,120,60,0.5)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx - 3, y - 13);
        g.lineTo(cx - 1.5, y - 2);
        g.stroke();
      } else {
        paintPebble(g, th, cx, y);
      }
    } else if (world === 4) {
      if (k < 0.35) {
        /* a golden lamp post */
        g.fillStyle = '#a87a2a';
        g.fillRect(cx - 1, y - 16, 2, 16);
        g.fillStyle = 'rgba(255,230,140,0.3)';
        g.beginPath();
        g.arc(cx, y - 18, 8, 0, TWO_PI);
        g.fill();
        g.fillStyle = '#fff0b0';
        g.beginPath();
        g.arc(cx, y - 18, 3, 0, TWO_PI);
        g.fill();
      } else if (k < 0.7) {
        /* a lilac bush */
        for (let p = 0; p < 4; ++p) {
          g.fillStyle = p % 2 ? '#b89aff' : '#d8c8ff';
          g.beginPath();
          g.arc(cx - 5 + p * 3.5, y - 4 - (p % 2) * 3, 4.5, 0, TWO_PI);
          g.fill();
        }
      }
    }
  }

  /* now and then something buried deep in the ground */
  function paintBuried(g, th, c, r, x, y, world) {
    if (cellRand(c, r, 21) > 0.07)
      return;
    const cx = x + 10 + cellRand(c, r, 22) * 28, cy = y + 10 + cellRand(c, r, 23) * 28;
    const kind = Math.floor(cellRand(c, r, 24) * 3);
    g.save();
    g.translate(cx, cy);
    g.rotate(cellRand(c, r, 25) * Math.PI * 2);
    if (world === 1 || world === 4 || kind === 0 && world !== 3) {
      /* a little gem cluster catching light */
      const col = world === 4 ? '#ffe08a' : world === 1 ? '#6ae0ff' : '#c8a0ff';
      g.fillStyle = rgba(col, 0.25);
      g.beginPath();
      g.arc(0, 0, 9, 0, TWO_PI);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, -6); g.lineTo(4, 0); g.lineTo(0, 6); g.lineTo(-4, 0);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(-1, -4, 1.5, 4);
    } else if (world === 3) {
      /* a pocket of glowing slag */
      g.fillStyle = 'rgba(255,110,30,0.35)';
      g.beginPath();
      g.arc(0, 0, 10, 0, TWO_PI);
      g.fill();
      g.fillStyle = '#ffb04a';
      g.beginPath();
      g.ellipse(0, 0, 5, 3, 0, 0, TWO_PI);
      g.fill();
    } else if (kind === 1) {
      /* a fossil shell */
      g.strokeStyle = rgba(th.light, 0.8);
      g.lineWidth = 1.6;
      g.beginPath();
      for (let k = 0; k < 18; ++k) {
        const a = k * 0.55, rr = 1 + k * 0.42;
        if (k === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.stroke();
    } else {
      /* an old bone */
      g.fillStyle = rgba(world === 2 ? '#e8f0ff' : '#e8dcc0', 0.75);
      g.fillRect(-8, -1.5, 16, 3);
      for (const sx of [-8, 8]) {
        g.beginPath();
        g.arc(sx, -2, 2.4, 0, TWO_PI);
        g.arc(sx, 2, 2.4, 0, TWO_PI);
        g.fill();
      }
    }
    g.restore();
  }

  function paintPebble(g, th, cx, y) {
    g.fillStyle = rgba(th.outline, 0.6);
    g.beginPath();
    g.ellipse(cx + 1, y - 2, 6, 3.5, 0, 0, TWO_PI);
    g.fill();
    g.fillStyle = th.stone[2];
    g.beginPath();
    g.ellipse(cx, y - 3, 5.5, 3.5, 0, 0, TWO_PI);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(cx - 2.5, y - 5, 3, 1.4);
  }

  /* hanging growth under a ceiling: roots, stalactites, icicles, drips, cloud puffs */
  function paintHang(g, th, c, r, x, y, kind) {
    const roll = cellRand(c, r, 11);
    if (roll > 0.6)
      return;
    const cx = x + 8 + cellRand(c, r, 12) * (TS - 16);
    const len = 8 + cellRand(c, r, 13) * 16;
    if (kind === 'roots') {
      g.strokeStyle = '#5a3416';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, y);
      g.bezierCurveTo(cx - 4, y + len * 0.4, cx + 4, y + len * 0.7, cx - 1, y + len);
      g.stroke();
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx + 1, y + len * 0.4);
      g.lineTo(cx + 6, y + len * 0.7);
      g.stroke();
    } else if (kind === 'stalactite' || kind === 'icicle' || kind === 'drip') {
      const col = kind === 'icicle' ? '#d8f4ff' : kind === 'drip' ? '#3a2a2c' : th.stone[0];
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx - 5, y);
      g.lineTo(cx + 5, y);
      g.lineTo(cx + 0.5, y + len);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba(th.outline, 0.6);
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = kind === 'icicle' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)';
      g.fillRect(cx - 2, y + 1, 1.2, len * 0.6);
      if (kind === 'drip') {
        g.fillStyle = 'rgba(255,120,40,0.8)';
        g.beginPath();
        g.arc(cx + 0.5, y + len + 2, 1.8, 0, TWO_PI);
        g.fill();
      }
    } else if (kind === 'cloud') {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let p = 0; p < 3; ++p) {
        g.beginPath();
        g.arc(cx - 8 + p * 8, y + 4 + (p % 2) * 3, 6 + (p % 2) * 2, 0, TWO_PI);
        g.fill();
      }
    }
  }

  function paintLedge(g, th, c, r, x, y, left, right) {
    const kind = th.ledge;
    if (kind === 'wood' || kind === 'icewood') {
      const lg = g.createLinearGradient(0, y, 0, y + 14);
      lg.addColorStop(0, kind === 'icewood' ? '#c8a07a' : '#c88a4a');
      lg.addColorStop(1, kind === 'icewood' ? '#6a4a34' : '#6a3a1a');
      g.fillStyle = lg;
      g.fillRect(x, y + 1, TS, 12);
      g.strokeStyle = '#2a1608';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, TS - 2, 12);
      g.strokeStyle = 'rgba(60,30,10,0.5)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 24, y + 2);
      g.lineTo(x + 24, y + 12);
      g.moveTo(x + 4, y + 7);
      g.lineTo(x + 18, y + 7);
      g.stroke();
      g.fillStyle = '#d8d0c0';
      g.fillRect(x + 4, y + 4, 2, 2);
      g.fillRect(x + TS - 6, y + 4, 2, 2);
      g.fillStyle = 'rgba(255,230,180,0.5)';
      g.fillRect(x + 2, y + 2, TS - 4, 2);
      if (kind === 'icewood') {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.ellipse(x + TS / 2, y + 1, TS / 2, 3.5, 0, Math.PI, TWO_PI);
        g.fill();
        g.fillStyle = '#e8f6ff';
        for (let k = 0; k < 3; ++k) {
          g.beginPath();
          g.moveTo(x + 8 + k * 14, y + 13);
          g.lineTo(x + 11 + k * 14, y + 13);
          g.lineTo(x + 9.5 + k * 14, y + 19 + cellRand(c, r, k) * 5);
          g.fill();
        }
      }
      /* rope posts at the ends */
      if (left || right) {
        g.fillStyle = '#5a3416';
        const px = left ? x + 3 : x + TS - 7;
        g.fillRect(px, y + 12, 4, 10);
      }
    } else if (kind === 'slab') {
      const lg = g.createLinearGradient(0, y, 0, y + 16);
      lg.addColorStop(0, '#6a7898');
      lg.addColorStop(1, '#2a3048');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(x + (left ? 4 : 0), y);
      g.lineTo(x + TS - (right ? 4 : 0), y);
      g.lineTo(x + TS - (right ? 8 : 0), y + 15);
      g.lineTo(x + (left ? 8 : 0), y + 15);
      g.closePath();
      g.fill();
      g.strokeStyle = '#0c0e1a';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#3aa88a';
      g.fillRect(x + (left ? 4 : 0), y, TS - (left ? 4 : 0) - (right ? 4 : 0), 3);
      g.fillStyle = 'rgba(106,224,255,0.6)';
      g.fillRect(x + 10 + cellRand(c, r, 1) * 20, y + 7, 6, 1.5);
    } else if (kind === 'girder') {
      g.fillStyle = '#3a3034';
      g.fillRect(x, y, TS, 14);
      g.strokeStyle = '#120a0c';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, TS - 2, 12);
      g.strokeStyle = '#6a5a5a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + 2, y + 12);
      g.lineTo(x + TS / 2, y + 2);
      g.lineTo(x + TS - 2, y + 12);
      g.stroke();
      g.fillStyle = '#ff8a3a';
      g.fillRect(x, y, TS, 2);
      g.fillStyle = '#8a7a7a';
      g.fillRect(x + 4, y + 5, 3, 3);
      g.fillRect(x + TS - 7, y + 5, 3, 3);
    } else {
      /* a cloud ledge */
      g.fillStyle = 'rgba(160,150,210,0.6)';
      g.beginPath();
      g.ellipse(x + TS / 2, y + 12, TS / 2 + 4, 8, 0, 0, TWO_PI);
      g.fill();
      for (let k = 0; k < 3; ++k) {
        const px = x + 8 + k * 16, pr = 9 + cellRand(c, r, k) * 4;
        const rg = g.createRadialGradient(px - 2, y + 2, 1, px, y + 6, pr);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(1, '#d8d0f4');
        g.fillStyle = rg;
        g.beginPath();
        g.arc(px, y + 6, pr, 0, TWO_PI);
        g.fill();
      }
      g.fillStyle = 'rgba(255,224,138,0.8)';
      g.fillRect(x, y - 1, TS, 2);
    }
  }

  function paintSpike(g, th, x, y, dir) {
    g.save();
    g.translate(x + TS / 2, y + TS / 2);
    g.rotate(dir === 'down' ? Math.PI : dir === 'left' ? -Math.PI / 2 : dir === 'right' ? Math.PI / 2 : 0);
    /* a base plate and four teeth, lit from the left */
    g.fillStyle = '#2a2a34';
    g.fillRect(-TS / 2, TS / 2 - 6, TS, 6);
    for (let k = 0; k < 4; ++k) {
      const bx = -TS / 2 + 2 + k * 11;
      g.fillStyle = mix(th.spike, '#000000', 0.45);
      g.beginPath();
      g.moveTo(bx, TS / 2 - 5);
      g.lineTo(bx + 5.5, -TS / 2 + 20);
      g.lineTo(bx + 11, TS / 2 - 5);
      g.closePath();
      g.fill();
      g.fillStyle = th.spike;
      g.beginPath();
      g.moveTo(bx, TS / 2 - 5);
      g.lineTo(bx + 5.5, -TS / 2 + 20);
      g.lineTo(bx + 5.5, TS / 2 - 5);
      g.closePath();
      g.fill();
      g.strokeStyle = '#14141c';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(bx, TS / 2 - 5);
      g.lineTo(bx + 5.5, -TS / 2 + 20);
      g.lineTo(bx + 11, TS / 2 - 5);
      g.stroke();
      g.fillStyle = '#ffffff';
      g.fillRect(bx + 4.6, -TS / 2 + 21, 1.2, 3);
    }
    g.restore();
  }

  function paintLiquidBody(g, th, level, c, r, x, y) {
    const top = codeAt(level, c, r - 1) !== LIQUID;
    const lg = g.createLinearGradient(0, y, 0, y + TS);
    lg.addColorStop(0, top ? th.liquid[0] : th.liquid[1]);
    lg.addColorStop(1, th.liquid[top ? 1 : 2]);
    g.fillStyle = lg;
    g.fillRect(x, y + (top ? 14 : 0), TS, TS - (top ? 14 : 0));
    if (th.hot) {
      g.fillStyle = 'rgba(255,240,160,0.35)';
      for (let k = 0; k < 3; ++k)
        g.fillRect(x + cellRand(c, r, k) * TS, y + 18 + cellRand(c, r, k + 5) * 24, 6, 2);
    } else {
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x + cellRand(c, r, 2) * 30, y + 24, 14, 1.5);
    }
  }

  /* ambient occlusion in open cells under and beside terrain */
  function paintOcclusion(g, level, c, r, x, y) {
    /* only inside pockets: a roof above plus a wall or floor next to the cell */
    const pocket = terrainAt(level, c - 1, r) || terrainAt(level, c + 1, r) || terrainAt(level, c, r + 1);
    if (terrainAt(level, c, r - 1) && pocket && r < level.rows - 1) {
      const lg = g.createLinearGradient(0, y, 0, y + 26);
      lg.addColorStop(0, 'rgba(0,0,0,0.38)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.fillRect(x, y, TS, 26);
    }
    /* walls of an enclosed pocket (a roof above) shade the air beside them */
    if (!terrainAt(level, c, r - 1) || r === 0)
      return;
    if (terrainAt(level, c - 1, r) && c > 0) {
      const lg = g.createLinearGradient(x, 0, x + 16, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0.2)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.fillRect(x, y, 16, TS);
    }
    if (terrainAt(level, c + 1, r) && c < level.cols - 1) {
      const lg = g.createLinearGradient(x + TS, 0, x + TS - 16, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0.2)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg;
      g.fillRect(x + TS - 16, y, 16, TS);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     LIVE BITS: liquid surfaces and secret walls
     ══════════════════════════════════════════════════════════════════ */

  const surfaceCache = {};
  const SURF_FRAMES = 8;

  function surfaceFrames(world) {
    if (surfaceCache[world])
      return surfaceCache[world];
    const th = THEMES[world];
    const frames = [];
    for (let f = 0; f < SURF_FRAMES; ++f) {
      const c = makeCanvas(TS * 2, 40);
      const g = c.getContext('2d');
      g.scale(2, 2);
      const ph = f / SURF_FRAMES * TWO_PI;
      const lg = g.createLinearGradient(0, 8, 0, 20);
      lg.addColorStop(0, th.surface);
      lg.addColorStop(0.3, th.liquid[0]);
      lg.addColorStop(1, rgba(th.liquid[0], 0));
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, 20);
      for (let x = 0; x <= TS; x += 4)
        g.lineTo(x, 13 + Math.sin(x / TS * TWO_PI + ph) * 2 + Math.sin(x / TS * TWO_PI * 2 - ph * 2) * 0.8);
      g.lineTo(TS, 20);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba(th.surface, 0.95);
      g.lineWidth = 1.5;
      g.beginPath();
      for (let x = 0; x <= TS; x += 4) {
        const yy = 13 + Math.sin(x / TS * TWO_PI + ph) * 2 + Math.sin(x / TS * TWO_PI * 2 - ph * 2) * 0.8;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
      if (th.hot) {
        g.fillStyle = 'rgba(255,250,200,0.8)';
        g.beginPath();
        g.arc((f * 7) % TS, 14, 1.6, 0, TWO_PI);
        g.fill();
      }
      frames.push(c);
    }
    surfaceCache[world] = frames;
    return frames;
  }

  const glowCache = {};
  function liquidGlow(world) {
    if (glowCache[world])
      return glowCache[world];
    const th = THEMES[world];
    const c = makeCanvas(96, 96);
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    rg.addColorStop(0, rgba(th.liquid[0], 0.55));
    rg.addColorStop(1, rgba(th.liquid[0], 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, 96, 96);
    glowCache[world] = c;
    return c;
  }

  /* ══════════════════════════════════════════════════════════════════
     THE BAKED LEVEL
     ══════════════════════════════════════════════════════════════════ */

  function create(level, opts) {
    opts = opts || {};
    const world = level.world | 0;
    const th = THEMES[world];
    /* a whole number of device pixels per tile keeps cell edges seamless */
    const snap = (k) => Math.max(1, Math.round(TS * k)) / TS;
    let scale = snap(opts.scale || 1);
    const nChunks = Math.ceil(level.cols / CHUNK_COLS);
    const chunks = new Map();   // index -> { canvas, used }
    let stamp = 0;
    const surfaces = [];        // liquid cells with open air above
    const fakes = [];           // secret wall cells
    for (let r = 0; r < level.rows; ++r) {
      for (let c = 0; c < level.cols; ++c) {
        const code = level.tiles[r * level.cols + c];
        if (code === LIQUID && codeAt(level, c, r - 1) !== LIQUID)
          surfaces.push({ c: c, r: r });
        else if (code === FAKE)
          fakes.push({ c: c, r: r });
      }
    }

    function bake(index) {
      const x0 = index * CHUNK_W;
      const canvas = makeCanvas(CHUNK_W * scale, level.rows * TS * scale);
      const g = canvas.getContext('2d');
      g.scale(scale, scale);
      g.translate(-x0, 0);
      const pattern = g.createPattern(texture(world), 'repeat');
      const c0 = Math.max(0, index * CHUNK_COLS - 1), c1 = Math.min(level.cols - 1, (index + 1) * CHUNK_COLS);
      g.save();
      g.beginPath();
      g.rect(x0, 0, CHUNK_W, level.rows * TS);
      g.clip();
      /* pass 1: occlusion and liquids in open cells */
      for (let r = 0; r < level.rows; ++r) {
        for (let c = c0; c <= c1; ++c) {
          const code = level.tiles[r * level.cols + c];
          const x = c * TS, y = r * TS;
          if (code === LIQUID)
            paintLiquidBody(g, th, level, c, r, x, y);
          else if (!isTerrain(code))
            paintOcclusion(g, level, c, r, x, y);
        }
      }
      /* pass 2: terrain bodies */
      const caps = [];
      for (let r = 0; r < level.rows; ++r) {
        for (let c = c0; c <= c1; ++c) {
          const code = level.tiles[r * level.cols + c];
          if (code === SOLID || code === ICE)
            caps.push({ c: c, r: r, f: paintTerrain(g, level, th, c, r, c * TS, r * TS, pattern, code === ICE) });
        }
      }
      /* pass 3: caps, hanging growth and decorations on top of the bodies */
      for (const k of caps) {
        const x = k.c * TS, y = k.r * TS;
        paintCap(g, level, th, k.c, k.r, x, y, k.f, world);
        if (k.f.d && k.r < level.rows - 1)
          paintHang(g, th, k.c, k.r, x, y + TS, th.hang);
      }
      for (const k of caps) {
        if (!k.f.u || k.r < 2)
          continue;
        const above = codeAt(level, k.c, k.r - 1);
        if (above === EMPTY)
          paintDeco(g, th, k.c, k.r, k.c * TS, k.r * TS, world);
      }
      /* pass 4: ledges and spikes */
      for (let r = 0; r < level.rows; ++r) {
        for (let c = c0; c <= c1; ++c) {
          const code = level.tiles[r * level.cols + c];
          if (code === ONEWAY)
            paintLedge(g, th, c, r, c * TS, r * TS, codeAt(level, c - 1, r) !== ONEWAY, codeAt(level, c + 1, r) !== ONEWAY);
          else if (code === SPIKE)
            paintSpike(g, th, c * TS, r * TS, spikeDir(level, c, r));
        }
      }
      g.restore();
      return canvas;
    }

    function spikeDir(lv, c, r) {
      const solid = (cc, rr) => { const k = codeAt(lv, cc, rr); return k === SOLID || k === ICE || k === -1 && rr >= lv.rows; };
      if (solid(c, r + 1)) return 'up';
      if (solid(c, r - 1)) return 'down';
      if (solid(c - 1, r)) return 'right';
      if (solid(c + 1, r)) return 'left';
      return 'up';
    }

    function chunk(index) {
      let ch = chunks.get(index);
      if (!ch) {
        ch = { canvas: bake(index), used: 0 };
        chunks.set(index, ch);
        if (chunks.size > MAX_CHUNKS) {
          let oldest = -1, best = Infinity;
          for (const [k, v] of chunks)
            if (v.used < best && k !== index) { best = v.used; oldest = k; }
          chunks.delete(oldest);
        }
      }
      ch.used = ++stamp;
      return ch;
    }

    function range(rect) {
      return [Math.max(0, Math.floor(rect.x0 / CHUNK_W)), Math.min(nChunks - 1, Math.floor((rect.x1 - 1) / CHUNK_W))];
    }

    /* bakes at most one chunk ahead of or behind the view per call */
    function prepare(rect) {
      const [a, b] = range(rect);
      for (const k of [b + 1, a - 1]) {
        if (k >= 0 && k < nChunks && !chunks.has(k)) {
          chunk(k);
          return true;
        }
      }
      return false;
    }

    function draw(ctx, rect) {
      const [a, b] = range(rect);
      for (let k = a; k <= b; ++k) {
        const ch = chunk(k);
        ctx.drawImage(ch.canvas, k * CHUNK_W, 0, CHUNK_W, level.rows * TS);
      }
    }

    let fakePattern = null;

    function drawLive(ctx, rect, t, fakeAlpha) {
      if (surfaces.length) {
        const frames = surfaceFrames(world);
        const f = frames[Math.floor(t * 8) % SURF_FRAMES];
        const glow = th.hot ? liquidGlow(world) : null;
        for (const s of surfaces) {
          const x = s.c * TS, y = s.r * TS;
          if (x + TS < rect.x0 || x > rect.x1 || y + TS < rect.y0 || y > rect.y1)
            continue;
          ctx.drawImage(f, x, y, TS, 20);
        }
        if (glow) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 2.3);
          for (let i = 0; i < surfaces.length; i += 2) {
            const s = surfaces[i];
            const x = s.c * TS, y = s.r * TS;
            if (x + 96 < rect.x0 || x - 96 > rect.x1 || y + 96 < rect.y0 || y - 96 > rect.y1)
              continue;
            ctx.drawImage(glow, x - 48 + TS / 2, y - 60, 144, 120);
          }
          ctx.restore();
        }
      }
      if (fakes.length && fakeAlpha > 0.01) {
        if (!fakePattern)
          fakePattern = ctx.createPattern(texture(world), 'repeat');
        ctx.save();
        ctx.globalAlpha = fakeAlpha;
        ctx.fillStyle = fakePattern;
        for (const s of fakes) {
          const x = s.c * TS, y = s.r * TS;
          if (x + TS < rect.x0 || x > rect.x1 || y + TS < rect.y0 || y > rect.y1)
            continue;
          ctx.fillRect(x, y, TS, TS);
        }
        ctx.restore();
      }
    }

    /* a tile changed: drop the chunks that show it so they bake again */
    function refresh(c) {
      const k = Math.floor(c / CHUNK_COLS);
      chunks.delete(k);
      if (c % CHUNK_COLS === 0) chunks.delete(k - 1);
      if (c % CHUNK_COLS === CHUNK_COLS - 1) chunks.delete(k + 1);
    }

    function setScale(s) {
      s = snap(s);
      if (Math.abs(s - scale) > 0.001) {
        scale = s;
        chunks.clear();
      }
    }

    return {
      prepare: prepare, draw: draw, drawLive: drawLive, refresh: refresh, setScale: setScale,
      get cachedChunks() { return chunks.size; },
      get chunkCount() { return nChunks; }
    };
  }

  /* a single tile preview (help pages, tree icons): terrain with a cap */
  const previewCache = {};
  function preview(world, code) {
    const key = world + ':' + code;
    if (previewCache[key])
      return previewCache[key];
    const cols = 3, rows = 3;
    const tiles = new Uint8Array(cols * rows);
    tiles[4] = code;
    if (code === SPIKE || code === ONEWAY)
      tiles[7] = SOLID;
    const lv = { cols: cols, rows: rows, tiles: tiles, world: world };
    const baked = create(lv, { scale: 2 });
    const c = makeCanvas(TS * 2, TS * 2);
    const g = c.getContext('2d');
    g.scale(2, 2);
    g.translate(-TS, -TS);
    baked.draw(g, { x0: 0, y0: 0, x1: cols * TS, y1: rows * TS });
    previewCache[key] = c;
    return c;
  }

  SZ.PlatformerTiles = Object.freeze({ TS, CHUNK_COLS, THEMES, create, preview, texture });
})();
