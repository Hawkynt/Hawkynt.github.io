/* Space Farming - world art helpers: seeded hashes, easing, colour mixing, light by time of day,
   baked tile textures, meadow decorations and glow sprites.
   Owns: G.animT
   Reads: G.dayPhase */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TILE_FARMLAND, TILE_ROCK, TILE_WATER, TILE_SAND, ctx, shadeColor, bakeSprite, spriteCache, parseHex } = NS;

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */



  /* ══════════════════════════════════════════════════════════════════
     WORLD ART — sky, ground, tiles, crops, buildings, animals, light
     Everything below the HUD is drawn in world units inside the view
     transform; tile textures and decorations are baked once per season
     ══════════════════════════════════════════════════════════════════ */

  const TEX = 14;                    // texels per tile edge (4 world units each)

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function mixHex(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    const m = (i) => Math.round(A[i] + (B[i] - A[i]) * t);
    return '#' + ((1 << 24) | (m(0) << 16) | (m(1) << 8) | m(2)).toString(16).slice(1);
  }

  /* 0 at noon .. 1 at midnight, with soft dusk and dawn */
  function nightAmount() {
    const p = G.dayPhase;
    if (p < 0.42) return p < 0.04 ? 1 - smoothstep(-0.04, 0.04, p) : 0;
    if (p < 0.54) return smoothstep(0.42, 0.54, p);
    if (p < 0.92) return 1;
    return 1 - smoothstep(0.92, 1.04, p);
  }

  /* 0..1 how golden the light is (sunrise and sunset) */
  function duskAmount() {
    const p = G.dayPhase;
    return Math.max(0, 1 - Math.abs(p - 0.48) / 0.07, 1 - Math.abs(p - 0.97) / 0.06, p < 0.03 ? 1 - p / 0.06 : 0);
  }

  const SEASON_PAL = [
    { name: 'spring', turf: ['#1f6a54', '#2a8a62', '#3aa872', '#62c88a'], flower: ['#ff9ad0', '#ffffff', '#c890ff'], soil: ['#4e3220', '#64412a', '#7d5634'] },
    { name: 'summer', turf: ['#3a6a2a', '#4f8a32', '#6aa83a', '#9cc85a'], flower: ['#ffd23f', '#ff7a4a', '#ffffff'], soil: ['#5a3a20', '#73502c', '#906a3a'] },
    { name: 'autumn', turf: ['#5a4a26', '#7a6430', '#9a7a36', '#c49a4a'], flower: ['#ff7a2a', '#e23b3b', '#ffb648'], soil: ['#4a3020', '#62402a', '#7a5434'] },
    { name: 'winter', turf: ['#a8b8d0', '#c8d6ea', '#dfe9f5', '#ffffff'], flower: ['#8fd3ff', '#ffffff', '#c8d6ea'], soil: ['#40302a', '#54403a', '#6a564c'] }
  ];

  /* Bakes a TEX x TEX texture scaled to the full tile size with crisp pixels */
  const texCache = {};
  function bakeTexture(key, w, h, scale, paint) {
    let cv = texCache[key];
    if (cv) return cv;
    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const g = src.getContext('2d');
    const put = (x, y, c) => {
      if (x < 0 || y < 0 || x >= w || y >= h || !c) return;
      g.fillStyle = c;
      g.fillRect(x, y, 1, 1);
    };
    paint(put, g);
    cv = document.createElement('canvas');
    cv.width = w * scale;
    cv.height = h * scale;
    const g2 = cv.getContext('2d');
    g2.imageSmoothingEnabled = false;
    g2.drawImage(src, 0, 0, w * scale, h * scale);
    texCache[key] = cv;
    return cv;
  }

  function tileTexture(type, variant, season, flags) {
    const pal = SEASON_PAL[season];
    const winter = season === 3;
    const key = `t${type}:${variant}:${season}:${flags}`;
    return bakeTexture(key, TEX, TEX, 4, (put) => {
      const rnd = mulberry32(variant * 7919 + type * 131 + season * 17 + flags * 3);
      const wet = flags & 1, rich = flags & 2;
      if (type === TILE_FARMLAND) {
        let [dk, md, lt] = pal.soil;
        if (wet) {
          dk = shadeColor(dk, -0.28); md = shadeColor(md, -0.28); lt = shadeColor(lt, -0.25);
        }
        if (rich) {
          dk = mixHex(dk, '#2a2a18', 0.3); md = mixHex(md, '#3a3420', 0.3);
        }
        for (let y = 0; y < TEX; ++y)
          for (let x = 0; x < TEX; ++x) {
            const row = (y + 1) % 4;
            let c = row === 0 ? lt : (row === 2 ? dk : md);
            if (rnd() < 0.08) c = row === 0 ? md : lt;
            put(x, y, c);
          }
        for (let i = 0; i < 3; ++i)
          put(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), wet ? '#7a6a62' : '#a8927a');
        if (wet)
          for (let i = 0; i < 4; ++i)
            put(Math.floor(rnd() * TEX), (Math.floor(rnd() * 4) * 4 + 1) % TEX, '#8ab0d0');
        if (rich)
          for (let i = 0; i < 3; ++i)
            put(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), '#5aa040');
        if (winter)
          for (let y = 3; y < TEX; y += 4)
            for (let x = 0; x < TEX; ++x)
              if (rnd() < 0.55) put(x, y, rnd() < 0.7 ? '#eef4ff' : '#c8d6ea');
      } else if (type === TILE_SAND) {
        const base = winter ? '#d8d0c0' : '#d6b46a', dark = winter ? '#bab4aa' : '#c09a52', light = winter ? '#f4f4f8' : '#ecd08c';
        for (let y = 0; y < TEX; ++y)
          for (let x = 0; x < TEX; ++x)
            put(x, y, base);
        for (let k = 0; k < 3; ++k) {
          const y0 = 2 + k * 4 + Math.floor(rnd() * 2);
          for (let x = 0; x < TEX; ++x) {
            const y = y0 + Math.round(Math.sin((x + k * 3) * 0.7));
            put(x, y, dark);
            put(x, y - 1, light);
          }
        }
        for (let i = 0; i < 4; ++i)
          put(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), rnd() < 0.5 ? '#f8e6b0' : '#a88a4a');
      } else if (type === TILE_ROCK) {
        // grey gravel bed; the boulders on it are drawn as objects
        const base = winter ? '#9aa0ae' : '#6e6a66', dark = winter ? '#7e8494' : '#55514e', light = winter ? '#d8dee8' : '#8e8984';
        for (let y = 0; y < TEX; ++y)
          for (let x = 0; x < TEX; ++x) {
            const r = rnd();
            put(x, y, r < 0.25 ? dark : (r > 0.85 ? light : base));
          }
        for (let x = 0; x < TEX; ++x) {
          put(x, 0, dark);
          put(0, x, dark);
        }
      } else if (type === TILE_WATER) {
        // flags carries the animation frame for water
        const frame = flags;
        if (winter) {
          for (let y = 0; y < TEX; ++y)
            for (let x = 0; x < TEX; ++x)
              put(x, y, (x + y) % 7 === 0 ? '#c8e8f8' : '#9ccbe8');
          for (let i = 0; i < 6; ++i)
            put(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), '#eef8ff');
          let x = Math.floor(rnd() * TEX), y = 0;
          while (y < TEX) {
            put(x, y, '#6a9cc0');
            x += Math.floor(rnd() * 3) - 1;
            ++y;
          }
        } else {
          for (let y = 0; y < TEX; ++y)
            for (let x = 0; x < TEX; ++x)
              put(x, y, y < 3 ? '#2f6ac8' : (y > 10 ? '#20509e' : '#2a5fb8'));
          for (let k = 0; k < 5; ++k) {
            const wx = (Math.floor(rnd() * TEX) + frame * 2) % TEX, wy = Math.floor(rnd() * TEX);
            put(wx, wy, '#8fd3ff');
            put((wx + 1) % TEX, wy, '#5aa8f0');
          }
        }
      }
    });
  }

  function turfPattern(season) {
    const key = 'turfpat:' + season;
    if (texCache[key]) return texCache[key];
    const pal = SEASON_PAL[season];
    const S = TEX * 4;
    const tex = bakeTexture('turf:' + season, S, S, 4, (put) => {
      const rnd = mulberry32(4242 + season);
      for (let y = 0; y < S; ++y)
        for (let x = 0; x < S; ++x) {
          const n = Math.sin(x * 0.31) + Math.cos(y * 0.27) + Math.sin((x + y) * 0.13);
          put(x, y, n > 1 ? pal.turf[2] : (n < -1 ? pal.turf[0] : pal.turf[1]));
        }
      for (let i = 0; i < 260; ++i) {
        const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
        put(x, y, pal.turf[3]);
        put(x, y + 1, pal.turf[2]);
      }
      for (let i = 0; i < 14; ++i) {
        const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
        const c = pal.flower[Math.floor(rnd() * pal.flower.length)];
        put(x, y, c);
        if (season !== 3) {
          put(x - 1, y, c); put(x + 1, y, c); put(x, y - 1, c); put(x, y + 1, '#2a5a3a');
          put(x, y, '#ffe48a');
        }
      }
    });
    const pat = ctx.createPattern(tex, 'repeat');
    texCache[key] = pat;
    return pat;
  }

  /* ── Decorations scattered on the meadow around the field ── */

  const DECOR_PAINTERS = {
    tree: (p, P, s) => {
      p.rect(7, 9, 2, 6, P.dbrown);
      const leaf = [P.teal, P.green, P.orange, '#e8f0ff'][s];
      const leaf2 = [P.cyan, P.lime, P.yellow, '#ffffff'][s];
      p.disc(8, 6, 5, leaf);
      p.disc(5, 8, 3, leaf); p.disc(11, 8, 3, leaf);
      p.disc(7, 4, 2, leaf2, true);
      if (s === 0) { p.px(5, 5, P.pink, true); p.px(10, 7, P.pink, true); p.px(8, 9, P.pink, true); }
      if (s === 1) { p.px(5, 6, P.red, true); p.px(10, 5, P.red, true); }
    },
    crystal: (p, P) => {
      p.poly([[6, 15], [4, 7], [7, 2], [9, 7], [8, 15]], P.cyan);
      p.poly([[9, 15], [10, 9], [13, 6], [13, 12], [11, 15]], P.violet);
      p.poly([[3, 15], [2, 11], [5, 10], [6, 15]], P.sky);
      p.line(6, 4, 6, 12, P.white, true);
    },
    boulder: (p, P, s) => {
      p.ell(8, 11, 6, 4, P.grey);
      p.ell(7, 9, 4, 3, P.steel);
      if (s === 3) p.ell(7, 8, 4, 1.5, P.white);
      else if (s < 2) p.px(4, 12, P.leaf, true);
    },
    shroom: (p, P) => {
      p.rect(4, 10, 2, 5, P.cream); p.rect(10, 8, 2, 7, P.cream); p.rect(13, 12, 1, 3, P.cream);
      p.ell(5, 9, 3.5, 1.5, P.teal); p.ell(11, 7, 3.5, 2, P.cyan); p.ell(13.5, 11.5, 1.5, 1, P.teal);
      p.px(4, 8, P.white, true); p.px(10, 6, P.white, true); p.px(12, 6, P.white, true);
    },
    reeds: (p, P, s) => {
      const c = [P.leaf, P.green, P.tan, P.steel][s];
      for (const x of [4, 7, 10, 12]) p.line(x, 15, x + 1, 5 + (x % 3), c);
      p.ell(5, 5, 0.8, 1.6, P.brown); p.ell(11, 6, 0.8, 1.6, P.brown);
    },
    bloom: (p, P, s) => {
      const col = [[P.pink, P.white], [P.yellow, P.orange], [P.orange, P.red], [P.sky, P.white]][s];
      for (const [x, y, i] of [[4, 8, 0], [9, 6, 1], [12, 10, 0], [6, 12, 1]]) {
        p.line(x, y + 1, x, 15, P.leaf);
        p.disc(x, y, 1.5, col[i]);
        p.px(x, y, P.yellow, true);
      }
    }
  };
  const DECOR_KINDS = ['tree', 'crystal', 'boulder', 'shroom', 'reeds', 'bloom', 'bloom', 'tree'];

  function decorSprite(kind, season) {
    const key = 'decor:' + kind + ':' + season;
    if (!spriteCache[key])
      spriteCache[key] = bakeSprite((p, P) => DECOR_PAINTERS[kind](p, P, season));
    return spriteCache[key];
  }

  /* Soft round glow (white or tinted), baked once and scaled with drawImage */
  const glowCache = {};
  function glowSprite(color) {
    const key = color || '#ffffff';
    let cv = glowCache[key];
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      const [r, gg, b] = parseHex(key);
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
      grad.addColorStop(0.35, `rgba(${r},${gg},${b},0.55)`);
      grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glowCache[key] = cv;
    }
    return cv;
  }

  /* Draws a glow of radius rad and opacity a (in the current transform) */
  function drawGlow(x, y, rad, color, a) {
    if (a <= 0.01 || rad <= 0.5) return;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * Math.min(1, a);
    ctx.drawImage(glowSprite(color), x - rad, y - rad, rad * 2, rad * 2);
    ctx.globalAlpha = prev;
  }

  Object.assign(NS, { mulberry32, hash2, mixHex, nightAmount, duskAmount, SEASON_PAL, tileTexture,
    turfPattern, DECOR_KINDS, decorSprite, glowSprite, drawGlow });

})();
