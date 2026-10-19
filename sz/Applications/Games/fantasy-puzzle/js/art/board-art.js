;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Board renderer of the Fantasy Puzzle. A whole board is baked into a few
   * cached canvases whenever its tiles change:
   *
   *   ground  floor flagstones, realm decor, scorch marks, channel beds, chasm pits,
   *           rune circles, the portal dais and the light/vignette pass
   *   water   drawn per frame per flooded cell from eight cached caustic frames
   *   upper   soft ambient occlusion and cast shadows, the props (wood, boulders,
   *           raised stone, ice), the walls as one continuous raised mass with a
   *           lit rim and a tall front face, and the ornate realm frame
   *   glow    an additive layer (embers in the grout, arcane glyphs, ice light)
   *           that pulses per frame with a single blit
   *
   * The textures (noise grain, moss, snow, marble veins, obsidian veins) are
   * computed once per realm, pixel by pixel, at 2x resolution and tiled as
   * patterns, so every board looks hand-painted without stamped tiles.
   * Per frame: three board blits, one blit per water cell and per glow source.
   */

  const TILE = 64;
  const WALL_H = 20;          // front face height of a wall, board units
  const MARGIN = 64;          // bake margin around the board: frame and shadows
  const FRAME_W = 22;         // ornate frame band
  const TEX = 2;              // texture pixels per board unit
  const TWO_PI = Math.PI * 2;

  const T = {
    FLOOR: 0, WALL: 1, WOOD: 2, CHANNEL: 3, WATER: 4,
    BOULDER: 5, STONE: 6, CHASM: 7, ICE: 8, GOAL: 9, RUNE: 10
  };

  /* ── realm styles ── */

  const STYLES = [
    {
      name: 'Ember Grove',
      floor: ['#8e7457', '#7d6449', '#9a8264'], grout: '#2e2118', moss: '#66702e',
      top: 'turf', topA: '#3a2216', topB: '#5a3420', topC: ['#c4521e', '#e0782a', '#9a3418', '#d8a03a', '#6a7a2a'],
      faceA: '#6e4c32', faceB: '#24160e', strata: '#8a6440',
      rim: '#ffd9a0', shadow: '#160a0c', light: '#ffb070',
      decor: 'leaves', glow: '#ff8a3a',
      frame: '#3c2618', frameHi: '#6a4428', trim: '#e0a84e', gem: '#ff6a2a',
      water: ['#123a58', '#2a76a6', '#a8e4ff']
    },
    {
      name: 'Tide Caverns',
      floor: ['#566f78', '#4a636c', '#5f7a82'], grout: '#101c24', moss: '#2a6e6c',
      top: 'wetrock', topA: '#1a2a34', topB: '#2c4a56', topC: ['#5ab8c8', '#9ad8e0'],
      faceA: '#2a4654', faceB: '#070f16', strata: '#3a6070',
      rim: '#a8ecff', shadow: '#020a16', light: '#7ad8ff',
      decor: 'puddles', glow: '#4ae0ff',
      frame: '#14242e', frameHi: '#2c4a58', trim: '#8ad0dc', gem: '#3ab4ff',
      water: ['#06304e', '#167ab4', '#8af0ff']
    },
    {
      name: 'Stone Peaks',
      floor: ['#8c877c', '#7c776c', '#999488'], grout: '#2c2924', moss: '#66705a',
      top: 'snow', topA: '#58544e', topB: '#7a766c', topC: ['#f0f6fc', '#bccce0'],
      faceA: '#6c675e', faceB: '#22201e', strata: '#8a857a',
      rim: '#ffffff', shadow: '#121628', light: '#fff0d8',
      decor: 'snow', glow: '#bfe4ff',
      frame: '#34343c', frameHi: '#5a5a66', trim: '#d0aa6c', gem: '#d8b070',
      water: ['#1a4870', '#3a88c4', '#d0f4ff']
    },
    {
      name: 'Sky Ruins',
      floor: ['#d6cebe', '#c6bead', '#e0d8c8'], grout: '#857c6a', moss: '#78a04a',
      top: 'grass', topA: '#2e5a26', topB: '#4e8a34', topC: ['#e8e2d4', '#fff6c0', '#ffffff'],
      faceA: '#bcb6aa', faceB: '#5c5c6c', strata: '#d0cabe',
      rim: '#ffffff', shadow: '#28305a', light: '#fff6e0',
      decor: 'grass', glow: '#bfe8ff',
      frame: '#4e5672', frameHi: '#7a84a4', trim: '#ecdca4', gem: '#7ad0ff',
      water: ['#20649a', '#4eaae6', '#eafaff']
    },
    {
      name: 'Elemental Sanctum',
      floor: ['#5a4a70', '#4e4064', '#66567c'], grout: '#140c20', moss: '#5a2a7a',
      top: 'obsidian', topA: '#140e1e', topB: '#261c36', topC: ['#c04cff', '#ffb0ff'],
      faceA: '#2c2040', faceB: '#07040c', strata: '#3a2a54',
      rim: '#e4b0ff', shadow: '#05020c', light: '#d08aff',
      decor: 'glyphs', glow: '#c86aff',
      frame: '#18101f', frameHi: '#3a2a4a', trim: '#cfa0ff', gem: '#c04cff',
      water: ['#141e6a', '#3466dc', '#c8d4ff']
    }
  ];

  function styleOf(theme) {
    const n = theme | 0;
    return STYLES[n >= 0 && n < STYLES.length ? n : 0];
  }

  /* ── small helpers ── */

  function rgb(hex) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    const c = rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function smooth(e0, e1, v) {
    const t = clamp01((v - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

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

  function roundRect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ── tileable value noise ── */

  function fbmField(size, period, octaves, seed) {
    const out = new Float32Array(size * size);
    const rng = mulberry32(seed);
    let total = 0, amp = 1;
    for (let o = 0; o < octaves; ++o) {
      const p = period << o;
      const lat = new Float32Array(p * p);
      for (let i = 0; i < lat.length; ++i)
        lat[i] = rng();
      const k = p / size;
      for (let y = 0; y < size; ++y) {
        const fy = y * k, yi = Math.floor(fy), ty = fy - yi;
        const sy = ty * ty * (3 - 2 * ty);
        const r0 = (yi % p) * p, r1 = ((yi + 1) % p) * p;
        for (let x = 0; x < size; ++x) {
          const fx = x * k, xi = Math.floor(fx), tx = fx - xi;
          const sx = tx * tx * (3 - 2 * tx);
          const x0 = xi % p, x1 = (xi + 1) % p;
          const a = lat[r0 + x0] + (lat[r0 + x1] - lat[r0 + x0]) * sx;
          const b = lat[r1 + x0] + (lat[r1 + x1] - lat[r1 + x0]) * sx;
          out[y * size + x] += (a + (b - a) * sy) * amp;
        }
      }
      total += amp;
      amp *= 0.5;
    }
    for (let i = 0; i < out.length; ++i)
      out[i] /= total;
    return out;
  }

  /* relief lighting from a height field: light from the top left */
  function relief(h, size, i, x, y) {
    const xl = (x + size - 1) % size, xr = (x + 1) % size;
    const yu = (y + size - 1) % size, yd = (y + 1) % size;
    return (h[y * size + xl] - h[y * size + xr]) + (h[yu * size + x] - h[yd * size + x]);
  }

  function imageCanvas(w, h, painter) {
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    painter(img.data);
    g.putImageData(img, 0, 0);
    return c;
  }

  /* ══════════════════════════════════════════════════════════════════
     REALM TEXTURES (computed once per realm)
     ══════════════════════════════════════════════════════════════════ */

  const texCache = {};

  /* the flagstone floor: 4 x 4 cells per texture, every cell split its own way,
     stones bevelled toward the light, grain, wear and moss in the joints */
  function paintFloor(st, seed) {
    const S = 512, CELL = 128;   // 4 x 4 cells at 2x
    const rng = mulberry32(seed);
    const stones = [];
    const id = new Int16Array(S * S).fill(-1);
    const LAYOUTS = [
      [[0, 0, 1, 1]],
      [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
      [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
      [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
      [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.45], [0.6, 0.45, 0.4, 0.55]],
      [[0, 0, 1, 0.38], [0, 0.38, 0.45, 0.62], [0.45, 0.38, 0.55, 0.62]],
      [[0, 0, 0.35, 0.6], [0.35, 0, 0.65, 0.6], [0, 0.6, 0.7, 0.4], [0.7, 0.6, 0.3, 0.4]]
    ];
    for (let cy = 0; cy < 4; ++cy) {
      for (let cx = 0; cx < 4; ++cx) {
        const lay = LAYOUTS[Math.floor(rng() * LAYOUTS.length)];
        for (const r of lay) {
          const g = 3;
          const x0 = cx * CELL + r[0] * CELL + g, y0 = cy * CELL + r[1] * CELL + g;
          const w = r[2] * CELL - 2 * g, h = r[3] * CELL - 2 * g;
          const s = {
            x: x0, y: y0, w: w, h: h, cx: x0 + w / 2, cy: y0 + h / 2,
            rad: 5 + rng() * 7, tone: 0.86 + rng() * 0.24, pick: rng(), tilt: (rng() - 0.5) * 0.12
          };
          const k = stones.length;
          stones.push(s);
          for (let y = Math.floor(y0); y < Math.ceil(y0 + h); ++y)
            for (let x = Math.floor(x0); x < Math.ceil(x0 + w); ++x)
              id[y * S + x] = k;
        }
      }
    }
    const grain = fbmField(S, 32, 4, seed + 1);
    const blot = fbmField(S, 8, 4, seed + 2);
    const moss = fbmField(S, 16, 3, seed + 3);
    const cols = st.floor.map(rgb), grout = rgb(st.grout), mossC = rgb(st.moss);
    return imageCanvas(S, S, function(d) {
      for (let y = 0; y < S; ++y) {
        for (let x = 0; x < S; ++x) {
          const i = y * S + x, o = i * 4;
          const k = id[i];
          const g = grain[i], b = blot[i];
          let r, gg, bb, sdf = 4;
          if (k >= 0) {
            const s = stones[k];
            const qx = Math.abs(x + 0.5 - s.cx) - (s.w / 2 - s.rad), qy = Math.abs(y + 0.5 - s.cy) - (s.h / 2 - s.rad);
            const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
            sdf = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - s.rad;
          }
          if (sdf < 0) {
            const s = stones[k];
            const c = s.pick < 0.5 ? cols[0] : s.pick < 0.82 ? cols[1] : cols[2];
            /* bevel toward the light: top/left edges bright, bottom/right dark */
            const edge = 1 - smooth(0, 7, -sdf);
            const nx = (x + 0.5 - s.cx) / (s.w / 2), ny = (y + 0.5 - s.cy) / (s.h / 2);
            const lit = (-nx * 0.6 - ny * 0.8);
            let f = s.tone * (0.8 + 0.34 * g) * (0.92 + 0.16 * b) + edge * lit * 0.32 + (1 - edge) * 0.04 + s.tilt * ny;
            /* worn pits */
            if (g < 0.3)
              f *= 0.88;
            r = c[0] * f; gg = c[1] * f; bb = c[2] * f;
            /* moss creeping in from the joints */
            const m = smooth(0.58, 0.72, moss[i]) * smooth(-9, -1, sdf);
            if (m > 0) {
              r += (mossC[0] * (0.7 + 0.5 * g) - r) * m;
              gg += (mossC[1] * (0.7 + 0.5 * g) - gg) * m;
              bb += (mossC[2] * (0.7 + 0.5 * g) - bb) * m;
            }
            /* a hair-thin dark outline where the stone meets the joint */
            const line = smooth(-1.6, 0, sdf);
            r *= 1 - line * 0.45; gg *= 1 - line * 0.45; bb *= 1 - line * 0.45;
          } else {
            const f = 0.7 + 0.5 * g;
            r = grout[0] * f; gg = grout[1] * f; bb = grout[2] * f;
            const m = smooth(0.55, 0.7, moss[i]);
            r += (mossC[0] * 0.6 - r) * m * 0.7;
            gg += (mossC[1] * 0.6 - gg) * m * 0.7;
            bb += (mossC[2] * 0.6 - bb) * m * 0.7;
          }
          d[o] = r; d[o + 1] = gg; d[o + 2] = bb; d[o + 3] = 255;
        }
      }
    });
  }

  /* the top of the wall mass, per realm material */
  function paintTop(st, seed) {
    const S = 512;   // 4 x 4 cells, so the pattern repeats rarely
    const n1 = fbmField(S, 8, 5, seed + 11);
    const n2 = fbmField(S, 32, 3, seed + 12);
    const n3 = fbmField(S, 16, 4, seed + 13);
    const fine = fbmField(S, 128, 2, seed + 14);
    const A = rgb(st.topA), B = rgb(st.topB), C = st.topC.map(rgb), rim = rgb(st.rim);
    const kind = st.top;
    return imageCanvas(S, S, function(d) {
      for (let y = 0; y < S; ++y) {
        for (let x = 0; x < S; ++x) {
          const i = y * S + x, o = i * 4;
          const h = n1[i] * 0.7 + n2[i] * 0.3;
          let lit = relief(n1, S, i, x, y) * 5 + relief(n2, S, i, x, y) * 2.5;
          const t = clamp01((h - 0.3) * 2.2);
          let r = A[0] + (B[0] - A[0]) * t, g = A[1] + (B[1] - A[1]) * t, b = A[2] + (B[2] - A[2]) * t;
          if (kind === 'turf') {
            /* a deep litter of autumn leaves, piled in drifts */
            const drift = smooth(0.35, 0.65, n3[i]);
            const sp = fine[i];
            if (sp > 0.5 - drift * 0.12) {
              const c = C[Math.floor(sp * 97) % C.length];
              const f = (0.45 + 0.4 * drift) * (0.75 + 0.4 * n2[i]);
              const k = smooth(0.5 - drift * 0.12, 0.56 - drift * 0.12, sp) * (0.5 + 0.5 * drift);
              r += (c[0] * f - r) * k; g += (c[1] * f - g) * k; b += (c[2] * f - b) * k;
            }
            lit *= 0.6;
          } else if (kind === 'grass') {
            /* lush turf over the ruins, marble showing through, a few flowers */
            const blade = 0.85 + 0.25 * Math.sin(x * 1.7 + n1[i] * 30 + fine[i] * 6);
            r *= blade; g *= blade; b *= blade;
            if (fine[i] > 0.9 && n3[i] > 0.66) {
              const c = n2[i] > 0.5 ? C[1] : C[2];
              const k = smooth(0.9, 0.94, fine[i]);
              r += (c[0] - r) * k; g += (c[1] - g) * k; b += (c[2] - b) * k;
            }
            lit *= 0.7;
          } else if (kind === 'wetrock') {
            lit = relief(n1, S, i, x, y) * 4;
            const sheen = smooth(0.06, 0.25, lit);
            r += (C[0][0] - r) * sheen * 0.45; g += (C[0][1] - g) * sheen * 0.45; b += (C[0][2] - b) * sheen * 0.45;
            if (n2[i] > 0.74) {
              const f = smooth(0.74, 0.8, n2[i]);
              r += (C[1][0] - r) * f * 0.6; g += (C[1][1] - g) * f * 0.6; b += (C[1][2] - b) * f * 0.6;
            }
          } else if (kind === 'snow') {
            const snow = smooth(0.2, 0.27, n1[i] + (n2[i] - 0.5) * 0.25);
            if (snow > 0) {
              const rip = Math.sin((x * 0.35 + y * 0.9) * 0.18 + n1[i] * 14) * 0.08;
              const sh = clamp01(0.82 + lit * 1.6 + rip);
              const sr = C[1][0] + (C[0][0] - C[1][0]) * sh, sg = C[1][1] + (C[0][1] - C[1][1]) * sh, sb = C[1][2] + (C[0][2] - C[1][2]) * sh;
              r += (sr - r) * snow; g += (sg - g) * snow; b += (sb - b) * snow;
              lit *= 1 - snow * 0.8;
            }
          } else if (kind === 'marble') {
            /* ashlar blocks with veins and grass in the joints */
            const row = Math.floor(y / 43);
            const bx = (x + (row % 2) * 64) % 128, by = y % 43;
            const joint = Math.min(bx, 128 - bx, by, 43 - by);
            const v = Math.abs(Math.sin((x * 0.6 + y * 0.35) * 0.06 + n1[i] * 9));
            if (v < 0.05) {
              const f = 1 - v / 0.05;
              r += (C[0][0] - r) * f * 0.5; g += (C[0][1] - g) * f * 0.5; b += (C[0][2] - b) * f * 0.5;
            }
            if (joint < 2) {
              r *= 0.62; g *= 0.62; b *= 0.64;
            } else if (joint < 4) {
              lit += (bx < 4 || by < 4) ? 0.25 : -0.25;
            }
            const grass = smooth(0.62, 0.7, n3[i]) * smooth(10, 2, joint);
            if (grass > 0) {
              const c = n2[i] > 0.5 ? C[1] : C[2];
              const f = 0.7 + 0.6 * n2[i];
              r += (c[0] * f - r) * grass; g += (c[1] * f - g) * grass; b += (c[2] * f - b) * grass;
            }
          } else if (kind === 'obsidian') {
            const vein = 1 - Math.abs(n3[i] * 2 - 1);
            const v = smooth(0.955, 0.985, vein) * smooth(0.45, 0.6, n1[i]);
            if (v > 0) {
              r += (C[0][0] - r) * v; g += (C[0][1] - g) * v; b += (C[0][2] - b) * v;
              const core = smooth(0.98, 0.995, vein) * v;
              r += (C[1][0] - r) * core; g += (C[1][1] - g) * core; b += (C[1][2] - b) * core;
            }
          }
          const L = clamp01(0.5 + lit) - 0.5;
          if (L > 0) {
            r += (rim[0] - r) * L * 0.5; g += (rim[1] - g) * L * 0.5; b += (rim[2] - b) * L * 0.5;
          } else {
            r *= 1 + L * 0.9; g *= 1 + L * 0.9; b *= 1 + L * 0.9;
          }
          d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
        }
      }
    });
  }

  /* the front face of the walls: horizontal strata, cracks, ashlar or bricks */
  function paintFace(st, seed) {
    const W = 256, H = WALL_H * TEX;
    const n = fbmField(W, 8, 4, seed + 21);
    const A = rgb(st.faceA), B = rgb(st.faceB), S = rgb(st.strata);
    const kind = st.top;
    return imageCanvas(W, H, function(d) {
      for (let y = 0; y < H; ++y) {
        const v = y / (H - 1);
        for (let x = 0; x < W; ++x) {
          const o = (y * W + x) * 4;
          const nn = n[((y * 3) % W) * W + x];
          let r = A[0] + (B[0] - A[0]) * v, g = A[1] + (B[1] - A[1]) * v, b = A[2] + (B[2] - A[2]) * v;
          const band = Math.sin((y + nn * 18) * 0.55);
          const f = 0.86 + 0.18 * nn + band * 0.06;
          r *= f; g *= f; b *= f;
          if (band > 0.9) {
            r += (S[0] - r) * 0.35 * (1 - v); g += (S[1] - g) * 0.35 * (1 - v); b += (S[2] - b) * 0.35 * (1 - v);
          }
          if (kind === 'marble' || kind === 'obsidian') {
            const bx = (x + (y > H / 2 ? 32 : 0)) % 64;
            if (bx < 2 || Math.abs(y - H / 2) < 1) {
              r *= 0.6; g *= 0.6; b *= 0.62;
            }
          }
          if (kind === 'wetrock' && nn > 0.62 && ((x * 7) % 23) < 2) {
            r += 40; g += 60; b += 70;
          }
          d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
        }
      }
    });
  }

  /* eight caustic frames of a 2 x 2 cell water patch; loops seamlessly */
  function paintWater(st, seed) {
    const S = 256, frames = [];
    const warp = fbmField(S, 4, 4, seed + 31);
    const fine = fbmField(S, 16, 2, seed + 32);
    const deep = rgb(st.water[0]), mid = rgb(st.water[1]), hi = rgb(st.water[2]);
    for (let f = 0; f < 8; ++f) {
      const ph = f / 8 * TWO_PI;
      frames.push(imageCanvas(S, S, function(d) {
        for (let y = 0; y < S; ++y) {
          const v = y / S;
          for (let x = 0; x < S; ++x) {
            const u = x / S, i = y * S + x, o = i * 4;
            const w = warp[i];
            const s1 = Math.sin(TWO_PI * (2 * u + v) + ph + w * 6);
            const s2 = Math.sin(TWO_PI * (-u + 3 * v) - ph + w * 5);
            const s3 = Math.sin(TWO_PI * (3 * u - 2 * v) + 2 * ph);
            const c1 = Math.pow(1 - Math.abs(Math.sin(Math.PI * (w * 3 + 0.35 * s1 + 0.25 * s2))), 7);
            const c2 = Math.pow(1 - Math.abs(Math.sin(Math.PI * (w * 4 + 0.3 * s2 + 0.3 * s3 + 0.5))), 9);
            const tone = clamp01(0.45 + 0.25 * s1 + 0.15 * s3 + (fine[i] - 0.5) * 0.3);
            const c = Math.min(1, c1 * 0.75 + c2 * 0.5);
            d[o] = deep[0] + (mid[0] - deep[0]) * tone + (hi[0] - mid[0]) * c;
            d[o + 1] = deep[1] + (mid[1] - deep[1]) * tone + (hi[1] - mid[1]) * c;
            d[o + 2] = deep[2] + (mid[2] - deep[2]) * tone + (hi[2] - mid[2]) * c;
            d[o + 3] = 240;
          }
        }
      }));
    }
    return frames;
  }

  function texturesOf(theme) {
    const key = theme | 0;
    let t = texCache[key];
    if (t)
      return t;
    const st = styleOf(key);
    const seed = 1000 + key * 7919;
    t = { floor: paintFloor(st, seed), top: paintTop(st, seed), face: paintFace(st, seed), water: null, props: {} };
    texCache[key] = t;
    return t;
  }

  function waterFrames(theme) {
    const t = texturesOf(theme);
    if (!t.water)
      t.water = paintWater(styleOf(theme), 4242 + (theme | 0) * 17);
    return t.water;
  }

  /* ══════════════════════════════════════════════════════════════════
     SOFT SPRITES (shadows and glows, built once)
     ══════════════════════════════════════════════════════════════════ */

  const softCache = {};

  /* a black rectangle w x h with a soft falloff of b around it (board units, 2x) */
  function softRect(w, h, b) {
    const key = w + 'x' + h + 'b' + b;
    if (softCache[key])
      return softCache[key];
    const W = (w + 2 * b) * TEX, H = (h + 2 * b) * TEX;
    const hw = w * TEX / 2, hh = h * TEX / 2, bb = b * TEX;
    const c = imageCanvas(W, H, function(d) {
      for (let y = 0; y < H; ++y) {
        for (let x = 0; x < W; ++x) {
          const dx = Math.max(0, Math.abs(x + 0.5 - W / 2) - hw), dy = Math.max(0, Math.abs(y + 0.5 - H / 2) - hh);
          const a = 1 - smooth(0, bb, Math.sqrt(dx * dx + dy * dy));
          d[(y * W + x) * 4 + 3] = a * 255;
        }
      }
    });
    softCache[key] = c;
    return c;
  }

  /* a soft round blob (white, alpha falls off), for glows and contact shadows */
  function softDot(color, size) {
    const key = 'dot' + color + size;
    if (softCache[key])
      return softCache[key];
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    rg.addColorStop(0, rgba(color, 1));
    rg.addColorStop(0.35, rgba(color, 0.55));
    rg.addColorStop(0.7, rgba(color, 0.14));
    rg.addColorStop(1, rgba(color, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, size, size);
    softCache[key] = c;
    return c;
  }

  /* ══════════════════════════════════════════════════════════════════
     PROPS (2x sprites, 64 x 64 board units plus headroom)
     ══════════════════════════════════════════════════════════════════ */

  const PROP = 128;   // sprite canvas, 64 board units at 2x

  /* a raised block: rounded footprint inset, top shifted up by `lift`, a front face */
  function paintBlock(d, S, opts) {
    const { inset, lift, radius, top, face, rim, noise, alpha } = opts;
    const x0 = inset, x1 = S - inset;
    const topY0 = inset - lift + opts.dy, topY1 = S - inset - lift + opts.dy;
    const faceY1 = topY1 + lift;
    for (let y = 0; y < S; ++y) {
      for (let x = 0; x < S; ++x) {
        const o = (y * S + x) * 4;
        const n = noise[y * S + x];
        /* top: rounded rect SDF */
        const cx = (x0 + x1) / 2, cy = (topY0 + topY1) / 2;
        const qx = Math.abs(x + 0.5 - cx) - ((x1 - x0) / 2 - radius), qy = Math.abs(y + 0.5 - cy) - ((topY1 - topY0) / 2 - radius);
        const sd = Math.sqrt(Math.max(qx, 0) * Math.max(qx, 0) + Math.max(qy, 0) * Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
        /* face: the same footprint dropped by lift, only below the top */
        const fy = cy + lift;
        const fq = Math.abs(y + 0.5 - fy) - ((topY1 - topY0) / 2 - radius);
        const fsd = Math.sqrt(Math.max(qx, 0) * Math.max(qx, 0) + Math.max(fq, 0) * Math.max(fq, 0)) + Math.min(Math.max(qx, fq), 0) - radius;
        let r, g, b, a = 0;
        if (sd < 0.5) {
          a = clamp01(0.5 - sd);
          const edge = 1 - smooth(0, 6, -sd);
          const nx = (x + 0.5 - cx) / ((x1 - x0) / 2), ny = (y + 0.5 - cy) / ((topY1 - topY0) / 2);
          const lit = -nx * 0.6 - ny * 0.8;
          const f = (0.82 + 0.32 * n) + edge * lit * 0.35;
          r = top[0] * f; g = top[1] * f; b = top[2] * f;
          if (edge > 0.6 && lit > 0.2) {
            const k = (edge - 0.6) * lit * 0.9;
            r += (rim[0] - r) * k; g += (rim[1] - g) * k; b += (rim[2] - b) * k;
          }
        } else if (fsd < 0.5 && y + 0.5 > cy && y < faceY1 + radius) {
          a = clamp01(0.5 - fsd);
          const v = clamp01((y - (topY1 - radius)) / (lift + radius));
          const f = (0.8 + 0.3 * n) * (1 - v * 0.55);
          r = face[0] * f; g = face[1] * f; b = face[2] * f;
        }
        if (a > 0) {
          d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a * (alpha || 255);
        }
      }
    }
  }

  function propNoise(seed) {
    return fbmField(PROP, 8, 4, seed);
  }

  /* raised stone: a rough pillar block with an amber earth rune */
  function paintStoneProp(st, seed) {
    const top = rgb(st.faceA).map(function(v) { return Math.min(255, v * 1.35 + 20); });
    const c = imageCanvas(PROP, PROP, function(d) {
      paintBlock(d, PROP, {
        inset: 12, lift: 22, radius: 12, dy: 6, top: top, face: rgb(st.faceA), rim: rgb(st.rim),
        noise: propNoise(seed)
      });
    });
    const g = c.getContext('2d');
    g.scale(TEX, TEX);
    const rng = mulberry32(seed);
    /* cracks */
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 0.8;
    for (let k = 0; k < 3; ++k) {
      let x = 16 + rng() * 32, y = 6 + rng() * 26;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 4; ++s) {
        x += (rng() - 0.5) * 9;
        y += 2 + rng() * 4;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    /* the earth rune, carved and faintly glowing */
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(24, 30);
    g.lineTo(32, 16);
    g.lineTo(40, 30);
    g.moveTo(27, 25);
    g.lineTo(37, 25);
    g.lineWidth = 3.2;
    g.strokeStyle = 'rgba(30,18,8,0.55)';
    g.stroke();
    g.lineWidth = 1.4;
    g.strokeStyle = 'rgba(255,200,120,0.75)';
    g.stroke();
    return c;
  }

  /* the ice block: translucent facets, frost cap and an inner light */
  function paintIceProp(st, seed) {
    const c = imageCanvas(PROP, PROP, function(d) {
      paintBlock(d, PROP, {
        inset: 9, lift: 18, radius: 10, dy: 4, top: [120, 200, 240], face: [30, 96, 170], rim: [235, 252, 255],
        noise: propNoise(seed), alpha: 235
      });
    });
    const g = c.getContext('2d');
    g.scale(TEX, TEX);
    g.globalCompositeOperation = 'source-atop';
    const rg = g.createRadialGradient(30, 26, 2, 32, 30, 30);
    rg.addColorStop(0, 'rgba(255,255,255,0.32)');
    rg.addColorStop(0.5, 'rgba(160,230,255,0.08)');
    rg.addColorStop(1, 'rgba(40,110,200,0.25)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    /* facets */
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(14, 18); g.lineTo(28, 28); g.lineTo(50, 14);
    g.moveTo(28, 28); g.lineTo(26, 46);
    g.moveTo(40, 34); g.lineTo(50, 44);
    g.stroke();
    g.strokeStyle = 'rgba(30,90,160,0.4)';
    g.beginPath();
    g.moveTo(16, 36); g.lineTo(30, 30); g.lineTo(46, 40);
    g.stroke();
    /* frost on the cap */
    const rng = mulberry32(seed + 5);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let k = 0; k < 26; ++k) {
      const x = 12 + rng() * 40, y = 4 + rng() * 10;
      g.fillRect(x, y, 1 + rng() * 2, 1);
    }
    /* bright glints */
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.moveTo(18, 12); g.lineTo(20, 9); g.lineTo(22, 12); g.lineTo(20, 15);
    g.closePath();
    g.fill();
    return c;
  }

  /* a boulder lit as a sphere, with surface noise, moss and a carved wind spiral */
  function paintBoulderProp(st, seed) {
    const n = fbmField(PROP, 8, 4, seed);
    const m = fbmField(PROP, 4, 3, seed + 3);
    const base = [128, 110, 94];
    const moss = rgb(st.moss), rim = rgb(st.glow);
    const cx = 64, cy = 64, R = 50;
    const L = [-0.5, -0.65, 0.58];
    const c = imageCanvas(PROP, PROP, function(d) {
      for (let y = 0; y < PROP; ++y) {
        for (let x = 0; x < PROP; ++x) {
          const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / (R * 0.94);
          const rr = dx * dx + dy * dy;
          const dist = Math.sqrt(rr);
          const a = clamp01((1 - dist) * R);
          if (a <= 0)
            continue;
          const i = y * PROP + x, o = i * 4;
          let nz = Math.sqrt(Math.max(0, 1 - rr));
          const bx = relief(n, PROP, i, x, y) * 3, by = bx * 0.6;
          let nx = dx + bx, ny = dy + by;
          const ln = Math.sqrt(nx * nx + ny * ny + nz * nz);
          nx /= ln; ny /= ln; nz /= ln;
          const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
          const rimL = Math.pow(1 - nz, 3) * (dx > 0.2 || dy > 0.2 ? 0.55 : 0.1);
          let f = 0.22 + diff * 1.0;
          f *= 0.85 + 0.3 * n[i];
          /* a dark rim so the boulder reads against any floor */
          f *= 0.45 + 0.55 * smooth(0.0, 0.35, nz);
          let r = base[0] * f, g = base[1] * f, b = base[2] * f;
          const mo = smooth(0.52, 0.62, m[i]) * smooth(0.1, -0.5, dy);
          if (mo > 0) {
            r += (moss[0] * f - r) * mo; g += (moss[1] * f - g) * mo; b += (moss[2] * f - b) * mo;
          }
          r += rim[0] * rimL * 0.5; g += rim[1] * rimL * 0.5; b += rim[2] * rimL * 0.5;
          d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a * 255;
        }
      }
    });
    const g = c.getContext('2d');
    g.scale(TEX, TEX);
    g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k <= 30; ++k) {
      const p = k / 30, ang = p * 9 + 0.5, rad = 1.5 + p * 11;
      const px = 33 + Math.cos(ang) * rad, py = 34 + Math.sin(ang) * rad * 0.9;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.lineWidth = 2.6;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.stroke();
    g.lineWidth = 1.1;
    g.strokeStyle = 'rgba(220,245,255,0.55)';
    g.stroke();
    return c;
  }

  /* a barricade of three logs, bark, rings and a sprig of leaves */
  function paintWoodProp(st, seed) {
    const c = makeCanvas(PROP, PROP);
    const g = c.getContext('2d');
    g.scale(TEX, TEX);
    const rng = mulberry32(seed);
    function log(x, y, w, h) {
      const lg = g.createLinearGradient(0, y, 0, y + h);
      lg.addColorStop(0, '#a87a4a');
      lg.addColorStop(0.35, '#7a5230');
      lg.addColorStop(1, '#2e1c10');
      roundRect(g, x, y, w, h, h / 2);
      g.fillStyle = lg;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = '#1e120a';
      g.stroke();
      /* bark */
      g.save();
      roundRect(g, x, y, w, h, h / 2);
      g.clip();
      g.strokeStyle = 'rgba(30,16,8,0.45)';
      g.lineWidth = 0.8;
      for (let k = 0; k < 7; ++k) {
        const yy = y + 2 + rng() * (h - 4);
        g.beginPath();
        g.moveTo(x + rng() * 8, yy);
        g.lineTo(x + w * (0.4 + rng() * 0.5), yy + (rng() - 0.5) * 2);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,220,170,0.18)';
      g.fillRect(x, y + 1.5, w, 1.5);
      g.restore();
      /* the cut end */
      const ex = x + w - h * 0.45, ey = y + h / 2;
      g.beginPath();
      g.ellipse(ex, ey, h * 0.42, h * 0.48, 0, 0, TWO_PI);
      g.fillStyle = '#d8b07a';
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = '#5a3a1c';
      g.stroke();
      g.strokeStyle = 'rgba(120,80,40,0.7)';
      g.lineWidth = 0.7;
      for (let k = 1; k <= 2; ++k) {
        g.beginPath();
        g.ellipse(ex, ey, h * 0.42 * k / 3, h * 0.48 * k / 3, 0, 0, TWO_PI);
        g.stroke();
      }
    }
    log(4, 30, 54, 18);
    log(8, 45, 52, 17);
    log(10, 14, 48, 18);
    /* leaves */
    const leaf = ['#6a8a2e', '#8aa83a', '#c4521e'];
    for (let k = 0; k < 4; ++k) {
      const x = 12 + rng() * 30, y = 20 + rng() * 10;
      g.save();
      g.translate(x, y);
      g.rotate(rng() * TWO_PI);
      g.beginPath();
      g.ellipse(0, 0, 4.5, 2, 0, 0, TWO_PI);
      g.fillStyle = leaf[k % leaf.length];
      g.fill();
      g.restore();
    }
    return c;
  }

  function propOf(theme, code) {
    const t = texturesOf(theme);
    let p = t.props[code];
    if (p)
      return p;
    const st = styleOf(theme);
    const seed = 77 + (theme | 0) * 31 + code;
    if (code === T.STONE) p = paintStoneProp(st, seed);
    else if (code === T.ICE) p = paintIceProp(st, seed);
    else if (code === T.BOULDER) p = paintBoulderProp(st, seed);
    else p = paintWoodProp(st, seed);
    t.props[code] = p;
    return p;
  }

  /* ══════════════════════════════════════════════════════════════════
     BOARD BAKE
     ══════════════════════════════════════════════════════════════════ */

  function isTrench(code) {
    return code === T.CHANNEL || code === T.WATER;
  }

  function isTall(code) {
    return code === T.WALL;
  }

  function isProp(code) {
    return code === T.WOOD || code === T.BOULDER || code === T.STONE || code === T.ICE;
  }

  /* the inset rectangle of a connected feature (channel network, chasm) in a cell */
  function insetRect(tiles, cols, rows, idx, same, inset) {
    const r = (idx / cols) | 0, c = idx % cols;
    const L = c > 0 && same(tiles[idx - 1]), R = c + 1 < cols && same(tiles[idx + 1]);
    const U = r > 0 && same(tiles[idx - cols]), D = r + 1 < rows && same(tiles[idx + cols]);
    const x0 = c * TILE + (L ? 0 : inset), x1 = (c + 1) * TILE - (R ? 0 : inset);
    const y0 = r * TILE + (U ? 0 : inset), y1 = (r + 1) * TILE - (D ? 0 : inset);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, L: L, R: R, U: U, D: D };
  }

  function decorCell(g, st, rng, x, y, glow) {
    if (st.decor === 'leaves') {
      const n = Math.floor(rng() * 4);
      const cols = ['#c4521e', '#e07a2a', '#9a3418', '#d8a03a', '#7a8a2a'];
      for (let k = 0; k < n; ++k) {
        g.save();
        g.translate(x + 8 + rng() * 48, y + 8 + rng() * 48);
        g.rotate(rng() * TWO_PI);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.beginPath();
        g.ellipse(1, 1.5, 5, 2.4, 0, 0, TWO_PI);
        g.fill();
        g.fillStyle = cols[Math.floor(rng() * cols.length)];
        g.beginPath();
        g.ellipse(0, 0, 5, 2.4, 0, 0, TWO_PI);
        g.fill();
        g.strokeStyle = 'rgba(60,20,8,0.5)';
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(-5, 0);
        g.lineTo(5, 0);
        g.stroke();
        g.restore();
      }
      if (rng() < 0.35) {
        /* an ember glowing in a joint */
        const ex = x + 4 + rng() * 56, ey = y + 4 + rng() * 56;
        glow.push([ex, ey, 10 + rng() * 6, '#ff7a2a']);
        g.fillStyle = '#ffb060';
        g.fillRect(ex - 0.8, ey - 0.8, 1.6, 1.6);
      }
    } else if (st.decor === 'puddles') {
      if (rng() < 0.32) {
        const px = x + 14 + rng() * 36, py = y + 14 + rng() * 36, rx = 8 + rng() * 9, ry = 5 + rng() * 5;
        g.fillStyle = 'rgba(8,30,44,0.5)';
        g.beginPath();
        g.ellipse(px, py, rx, ry, 0, 0, TWO_PI);
        g.fill();
        g.strokeStyle = 'rgba(160,230,255,0.35)';
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(px, py, rx, ry, 0, 0.2, 1.9);
        g.stroke();
        g.fillStyle = 'rgba(200,245,255,0.35)';
        g.fillRect(px - rx * 0.5, py - 1, rx * 0.6, 1);
      }
      if (rng() < 0.3) {
        const ex = x + 6 + rng() * 52, ey = y + 6 + rng() * 52;
        g.fillStyle = '#9af0ff';
        g.beginPath();
        g.arc(ex, ey, 1.4, 0, TWO_PI);
        g.fill();
        glow.push([ex, ey, 9, '#4ae0ff']);
      }
    } else if (st.decor === 'snow') {
      const n = 10 + Math.floor(rng() * 14);
      g.fillStyle = 'rgba(240,248,255,0.55)';
      for (let k = 0; k < n; ++k)
        g.fillRect(x + rng() * 64, y + rng() * 64, 1 + rng() * 1.5, 1);
      if (rng() < 0.35) {
        g.fillStyle = 'rgba(236,244,252,0.6)';
        g.beginPath();
        g.ellipse(x + 10 + rng() * 44, y + 10 + rng() * 44, 6 + rng() * 6, 3 + rng() * 2, 0, 0, TWO_PI);
        g.fill();
      }
    } else if (st.decor === 'grass') {
      const n = Math.floor(rng() * 3);
      for (let k = 0; k < n; ++k) {
        const gx = x + 4 + rng() * 56, gy = y + 8 + rng() * 52;
        g.strokeStyle = rng() < 0.5 ? '#5a9a38' : '#7ab848';
        g.lineWidth = 1.2;
        g.beginPath();
        for (let b = 0; b < 5; ++b) {
          g.moveTo(gx + b * 1.6, gy);
          g.quadraticCurveTo(gx + b * 1.6 + (rng() - 0.5) * 4, gy - 4, gx + b * 1.6 + (rng() - 0.5) * 6, gy - 6 - rng() * 4);
        }
        g.stroke();
        if (rng() < 0.4) {
          g.fillStyle = rng() < 0.5 ? '#fff6c0' : '#ffffff';
          g.beginPath();
          g.arc(gx + 3, gy - 8, 1.4, 0, TWO_PI);
          g.fill();
        }
      }
    } else if (st.decor === 'glyphs') {
      if (rng() < 0.22) {
        const gx = x + 32, gy = y + 32;
        g.strokeStyle = 'rgba(10,4,18,0.55)';
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(gx, gy, 17, 0, TWO_PI);
        g.stroke();
        g.strokeStyle = 'rgba(200,120,255,0.35)';
        g.lineWidth = 0.9;
        g.beginPath();
        g.arc(gx, gy, 17, 0, TWO_PI);
        g.moveTo(gx, gy - 11);
        g.lineTo(gx + 9.5, gy + 5.5);
        g.lineTo(gx - 9.5, gy + 5.5);
        g.closePath();
        g.stroke();
        glow.push([gx, gy, 46, '#b04cff', 'ring']);
      }
      if (rng() < 0.3) {
        const ex = x + 6 + rng() * 52, ey = y + 6 + rng() * 52;
        glow.push([ex, ey, 8, '#d080ff']);
      }
    }
  }

  function create(theme) {
    const th = (theme | 0) >= 0 && (theme | 0) < STYLES.length ? theme | 0 : 0;
    const st = styleOf(th);
    const tex = texturesOf(th);
    /* everything a level can need is painted up front, under the screen fade */
    waterFrames(th);
    propOf(th, T.WOOD);
    propOf(th, T.BOULDER);
    propOf(th, T.STONE);
    propOf(th, T.ICE);
    let framed = true, key = '', staticKey = '', scale = 1, cols = 0, rows = 0, prevTiles = null, prevDecals = [];
    let ground = null, upper = null, glow = null, glowCount = 0;
    let waterCells = [], iceCells = [], gemSpots = [];
    let scratch = [];

    function scratchCanvas(i, w, h) {
      let c = scratch[i];
      if (!c || c.width !== w || c.height !== h) {
        c = makeCanvas(w, h);
        scratch[i] = c;
      }
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, w, h);
      return c;
    }

    /* a context in board units with the margin offset applied */
    function boardCtx(c) {
      const g = c.getContext('2d');
      g.setTransform(scale, 0, 0, scale, MARGIN * scale, MARGIN * scale);
      return g;
    }

    function fillTexture(g, img, x, y, w, h, ox, oy) {
      const pat = g.createPattern(img, 'repeat');
      g.save();
      g.translate(ox || 0, oy || 0);
      g.scale(1 / TEX, 1 / TEX);
      g.fillStyle = pat;
      g.fillRect((x - (ox || 0)) * TEX, (y - (oy || 0)) * TEX, w * TEX, h * TEX);
      g.restore();
    }

    /* the parts that never change inside a level: floor, decor, walls, frame */
    function bakeStatic(tiles, W, H, CW, CH) {
      const n = cols * rows;
      const wall = function(i) { return tiles[i] === T.WALL; };
      const wallAt = function(r, c) { return r >= 0 && r < rows && c >= 0 && c < cols && tiles[r * cols + c] === T.WALL; };
      for (const c of [sGround, sUpper]) {
        const g0 = c.getContext('2d');
        g0.setTransform(1, 0, 0, 1, 0, 0);
        g0.clearRect(0, 0, CW, CH);
      }
      staticGlow = [];
      for (const k in dynGlow)
        delete dynGlow[k];
      const g = boardCtx(sGround);
      /* the frame's drop shadow onto the backdrop */
      for (let k = 0; k < 10; ++k) {
        roundRect(g, -FRAME_W - 4 - k * 2 + 4, -FRAME_W - 4 - k * 2 + 8, W + 2 * FRAME_W + 8 + k * 4, H + 2 * FRAME_W + 8 + k * 4, 16 + k * 2);
        g.fillStyle = 'rgba(0,0,0,0.07)';
        g.fill();
      }
      fillTexture(g, tex.floor, 0, 0, W, H);
      for (let i = 0; i < n; ++i) {
        const code = tiles[i];
        if (code === T.WALL || isTrench(code) || code === T.CHASM)
          continue;
        const rng = mulberry32(i * 7919 + th * 104729 + 17);
        decorCell(g, st, rng, (i % cols) * TILE, ((i / cols) | 0) * TILE, staticGlow);
      }
      const u = boardCtx(sUpper);
      /* shadows: ambient occlusion around every wall plus a cast shadow to the
         bottom right, collected opaque then laid down once so overlaps never stack */
      const sh = scratchCanvas(0, CW, CH);
      const sg = boardCtx(sh);
      const ao = softRect(64, 64 + WALL_H, 14);
      const cast = softRect(64, 64 + WALL_H, 7);
      for (let i = 0; i < n; ++i) {
        if (!wall(i))
          continue;
        const x = (i % cols) * TILE, y = ((i / cols) | 0) * TILE - WALL_H;
        sg.drawImage(ao, x - 14, y - 14, 64 + 28, 64 + WALL_H + 28);
      }
      sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = rgba(st.shadow, 1);
      sg.fillRect(-MARGIN, -MARGIN, W + 2 * MARGIN, H + 2 * MARGIN);
      u.save();
      u.setTransform(1, 0, 0, 1, 0, 0);
      u.globalAlpha = 0.42;
      u.drawImage(sh, 0, 0);
      u.restore();
      const sh2 = scratchCanvas(0, CW, CH);
      const sg2 = boardCtx(sh2);
      for (let i = 0; i < n; ++i) {
        const code = tiles[i];
        const x = (i % cols) * TILE, y = ((i / cols) | 0) * TILE;
        if (code === T.WALL)
          sg2.drawImage(cast, x + 12 - 7, y - WALL_H + 14 - 7, 64 + 14, 64 + WALL_H + 14);
      }
      sg2.globalCompositeOperation = 'source-in';
      sg2.fillStyle = rgba(st.shadow, 1);
      sg2.fillRect(-MARGIN, -MARGIN, W + 2 * MARGIN, H + 2 * MARGIN);
      u.save();
      u.setTransform(1, 0, 0, 1, 0, 0);
      u.globalAlpha = 0.5;
      u.drawImage(sh2, 0, 0);
      u.restore();

      /* walls: one continuous raised mass */
      const topMask = scratchCanvas(1, CW, CH);
      const tm = boardCtx(topMask);
      const faceMask = scratchCanvas(2, CW, CH);
      const fm = boardCtx(faceMask);
      const RAD = 12;
      tm.fillStyle = '#fff';
      fm.fillStyle = '#fff';
      for (let i = 0; i < n; ++i) {
        if (!wall(i))
          continue;
        const r = (i / cols) | 0, c = i % cols;
        const x = c * TILE, y = r * TILE - WALL_H;
        const up = wallAt(r - 1, c), dn = wallAt(r + 1, c), lf = wallAt(r, c - 1), rt = wallAt(r, c + 1);
        /* the top, with rounded convex corners at the back */
        tm.beginPath();
        const tl = !up && !lf ? RAD : 0, tr = !up && !rt ? RAD : 0;
        tm.moveTo(x + tl, y);
        tm.lineTo(x + 64 - tr, y);
        if (tr) tm.arcTo(x + 64, y, x + 64, y + tr, tr); else tm.lineTo(x + 64, y);
        tm.lineTo(x + 64, y + 64);
        tm.lineTo(x, y + 64);
        if (tl) { tm.lineTo(x, y + tl); tm.arcTo(x, y, x + tl, y, tl); } else tm.lineTo(x, y);
        tm.closePath();
        tm.fill();
        if (!dn) {
          const fy = y + 64;
          const bl = !lf ? RAD * 0.6 : 0, br = !rt ? RAD * 0.6 : 0;
          fm.beginPath();
          fm.moveTo(x, fy - 2);
          fm.lineTo(x + 64, fy - 2);
          if (br) { fm.lineTo(x + 64, fy + WALL_H - br); fm.arcTo(x + 64, fy + WALL_H, x + 64 - br, fy + WALL_H, br); } else fm.lineTo(x + 64, fy + WALL_H);
          if (bl) { fm.lineTo(x + bl, fy + WALL_H); fm.arcTo(x, fy + WALL_H, x, fy + WALL_H - bl, bl); } else fm.lineTo(x, fy + WALL_H);
          fm.closePath();
          fm.fill();
        }
      }
      /* faces: texture, darkening downward, a lit lip */
      const faceL = scratchCanvas(3, CW, CH);
      const fl = boardCtx(faceL);
      for (let r = 0; r < rows; ++r) {
        let any = false;
        for (let c = 0; c < cols; ++c)
          if (wallAt(r, c) && !wallAt(r + 1, c)) any = true;
        if (any)
          fillTexture(fl, tex.face, 0, r * TILE + TILE - WALL_H - 2, W, WALL_H + 2, 0, r * TILE + TILE - WALL_H);
      }
      fl.globalCompositeOperation = 'destination-in';
      fl.setTransform(1, 0, 0, 1, 0, 0);
      fl.drawImage(faceMask, 0, 0);
      u.save();
      u.setTransform(1, 0, 0, 1, 0, 0);
      u.drawImage(faceL, 0, 0);
      u.restore();

      const topL = scratchCanvas(3, CW, CH);
      const tl2 = boardCtx(topL);
      fillTexture(tl2, tex.top, -MARGIN, -MARGIN, W + 2 * MARGIN, H + 2 * MARGIN);
      tl2.globalCompositeOperation = 'destination-in';
      tl2.setTransform(1, 0, 0, 1, 0, 0);
      tl2.drawImage(topMask, 0, 0);
      /* bevel bands: the mask minus itself shifted gives the lit and the shaded rim */
      const band = scratchCanvas(4, CW, CH);
      const bg = band.getContext('2d');
      const off = 3 * scale;
      bg.drawImage(topMask, 0, 0);
      bg.globalCompositeOperation = 'destination-out';
      bg.drawImage(topMask, off, off);
      bg.globalCompositeOperation = 'source-in';
      bg.fillStyle = st.rim;
      bg.fillRect(0, 0, CW, CH);
      tl2.globalCompositeOperation = 'source-atop';
      tl2.globalAlpha = 0.4;
      tl2.drawImage(band, 0, 0);
      const band2 = scratchCanvas(4, CW, CH);
      const bg2 = band2.getContext('2d');
      bg2.drawImage(topMask, 0, 0);
      bg2.globalCompositeOperation = 'destination-out';
      bg2.drawImage(topMask, -off * 1.4, -off * 1.4);
      bg2.globalCompositeOperation = 'source-in';
      bg2.fillStyle = '#000';
      bg2.fillRect(0, 0, CW, CH);
      tl2.globalAlpha = 0.45;
      tl2.drawImage(band2, 0, 0);
      /* a soft inner glow of the rim light a few units deeper */
      const band3 = scratchCanvas(4, CW, CH);
      const bg3 = band3.getContext('2d');
      bg3.drawImage(topMask, 0, 0);
      bg3.globalCompositeOperation = 'destination-out';
      bg3.drawImage(topMask, off * 3, off * 3);
      bg3.globalCompositeOperation = 'source-in';
      bg3.fillStyle = st.rim;
      bg3.fillRect(0, 0, CW, CH);
      tl2.globalAlpha = 0.08;
      tl2.drawImage(band3, 0, 0);
      u.save();
      u.setTransform(1, 0, 0, 1, 0, 0);
      u.drawImage(topL, 0, 0);
      u.restore();
      /* the crease where the top meets the face */
      u.fillStyle = rgba(st.rim, 0.22);
      for (let i = 0; i < n; ++i) {
        const r = (i / cols) | 0, c = i % cols;
        if (wall(i) && !wallAt(r + 1, c))
          u.fillRect(c * TILE + 2, r * TILE + TILE - WALL_H, TILE - 4, 1.2);
      }

      if (framed) {
        paintFrame(u, W, H);
      } else {
        /* a slim gilded edge for single sample tiles */
        roundRect(u, -2, -2, W + 4, H + 4, 6);
        u.lineWidth = 2;
        u.strokeStyle = st.trim;
        u.stroke();
        gemSpots = [];
      }

    }

    let sGround = null, sUpper = null, staticGlow = [], glowKey = '';

    const dynGlow = {};

    function bake(tiles, decals, staticChanged, dirty) {
      const W = cols * TILE, H = rows * TILE;
      const CW = Math.ceil((W + 2 * MARGIN) * scale), CH = Math.ceil((H + 2 * MARGIN) * scale);
      ground = ground && ground.width === CW && ground.height === CH ? ground : makeCanvas(CW, CH);
      upper = upper && upper.width === CW && upper.height === CH ? upper : makeCanvas(CW, CH);
      if (staticChanged || !sGround || sGround.width !== CW || sGround.height !== CH) {
        sGround = sGround && sGround.width === CW && sGround.height === CH ? sGround : makeCanvas(CW, CH);
        sUpper = sUpper && sUpper.width === CW && sUpper.height === CH ? sUpper : makeCanvas(CW, CH);
        bakeStatic(tiles, W, H, CW, CH);
        dirty = null;
      }
      /* only the cells around a change are repainted: the region is clipped,
         cleared and refilled from the static layers */
      const c0 = dirty ? Math.max(0, dirty.c0 - 1) : 0, c1 = dirty ? Math.min(cols - 1, dirty.c1 + 1) : cols - 1;
      const r0 = dirty ? Math.max(0, dirty.r0 - 1) : 0, r1 = dirty ? Math.min(rows - 1, dirty.r1 + 1) : rows - 1;
      const clipX = dirty ? c0 * TILE - (c0 === 0 ? MARGIN : 0) : -MARGIN;
      const clipY = dirty ? r0 * TILE - WALL_H - (r0 === 0 ? MARGIN : 0) : -MARGIN;
      const clipX1 = dirty ? (c1 + 1) * TILE + (c1 === cols - 1 ? MARGIN : 0) : W + MARGIN;
      const clipY1 = dirty ? (r1 + 1) * TILE + (r1 === rows - 1 ? MARGIN : 0) : H + MARGIN;
      for (const c of [ground, upper]) {
        const g0 = boardCtx(c);
        g0.save();
        g0.beginPath();
        g0.rect(clipX, clipY, clipX1 - clipX, clipY1 - clipY);
        g0.clip();
        g0.clearRect(clipX, clipY, clipX1 - clipX, clipY1 - clipY);
      }
      const inR = function(i) {
        const r = (i / cols) | 0, c = i % cols;
        return r >= r0 && r <= r1 && c >= c0 && c <= c1;
      };
      const n = cols * rows;
      waterCells = [];
      iceCells = [];
      for (let i = 0; i < n; ++i) {
        if (tiles[i] === T.WATER)
          waterCells.push(insetRect(tiles, cols, rows, i, isTrench, 9));
        else if (tiles[i] === T.ICE)
          iceCells.push([(i % cols) * TILE + 32, ((i / cols) | 0) * TILE + 28]);
      }
      const wall = function(i) { return tiles[i] === T.WALL; };
      const wallAt = function(r, c) { return r >= 0 && r < rows && c >= 0 && c < cols && tiles[r * cols + c] === T.WALL; };

      /* ── ground ── */
      const g = boardCtx(ground);
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(sGround, 0, 0);
      g.restore();
      for (let i = 0; i < n; ++i) {
        if (!inR(i))
          continue;
        const code = tiles[i];
        const r = (i / cols) | 0, c = i % cols;
        const glowSpots = dynGlow[i] = [];
        const x = c * TILE, y = r * TILE;
        const rng = mulberry32(i * 7919 + th * 104729 + 17);
        const dk = decals && decals[i];
        if (dk && (code === T.FLOOR || code === T.WATER || code === T.RUNE)) {
          if (dk === 'scorch') {
            const sg = g.createRadialGradient(x + 32, y + 34, 2, x + 32, y + 34, 30);
            sg.addColorStop(0, 'rgba(14,8,6,0.72)');
            sg.addColorStop(0.6, 'rgba(24,12,8,0.4)');
            sg.addColorStop(1, 'rgba(24,12,8,0)');
            g.fillStyle = sg;
            g.fillRect(x, y, TILE, TILE);
            g.fillStyle = 'rgba(200,190,180,0.35)';
            for (let k = 0; k < 12; ++k)
              g.fillRect(x + 12 + rng() * 40, y + 12 + rng() * 40, 1.2, 1.2);
            if (rng() < 0.7)
              glowSpots.push([x + 20 + rng() * 24, y + 20 + rng() * 24, 12, '#ff5a1a']);
          } else if (dk === 'rubble') {
            for (let k = 0; k < 7; ++k) {
              g.fillStyle = k % 2 ? 'rgba(40,30,20,0.5)' : rgba(st.faceA, 0.9);
              g.beginPath();
              g.arc(x + 10 + rng() * 44, y + 10 + rng() * 44, 1.5 + rng() * 2.5, 0, TWO_PI);
              g.fill();
            }
          }
        }
        if (isTrench(code)) {
          const rc = insetRect(tiles, cols, rows, i, isTrench, 9);
          /* a dry bed of cracked mud and pebbles */
          g.fillStyle = '#4a3a2a';
          g.fillRect(rc.x, rc.y, rc.w, rc.h);
          g.strokeStyle = 'rgba(24,16,10,0.6)';
          g.lineWidth = 1;
          g.beginPath();
          for (let k = 0; k < 5; ++k) {
            let px = rc.x + rng() * rc.w, py = rc.y + rng() * rc.h;
            g.moveTo(px, py);
            for (let q = 0; q < 3; ++q) {
              px = Math.max(rc.x, Math.min(rc.x + rc.w, px + (rng() - 0.5) * 22));
              py = Math.max(rc.y, Math.min(rc.y + rc.h, py + (rng() - 0.5) * 22));
              g.lineTo(px, py);
            }
          }
          g.stroke();
          for (let k = 0; k < 9; ++k) {
            const px = rc.x + 3 + rng() * (rc.w - 6), py = rc.y + 3 + rng() * (rc.h - 6), pr = 1.5 + rng() * 2.5;
            g.fillStyle = 'rgba(20,14,10,0.5)';
            g.beginPath();
            g.arc(px + 0.6, py + 0.8, pr, 0, TWO_PI);
            g.fill();
            g.fillStyle = k % 2 ? '#8a7a68' : '#6a5a48';
            g.beginPath();
            g.arc(px, py, pr, 0, TWO_PI);
            g.fill();
          }
        } else if (code === T.CHASM) {
          const rc = insetRect(tiles, cols, rows, i, function(v) { return v === T.CHASM; }, 5);
          g.fillStyle = '#050307';
          g.fillRect(rc.x, rc.y, rc.w, rc.h);
          if (!rc.U) {
            /* the far cliff wall falling into the dark */
            const fg = g.createLinearGradient(0, rc.y, 0, rc.y + 30);
            fg.addColorStop(0, st.faceA);
            fg.addColorStop(0.5, rgba(st.faceB, 0.9));
            fg.addColorStop(1, 'rgba(5,3,7,0)');
            g.fillStyle = fg;
            g.fillRect(rc.x, rc.y, rc.w, 30);
            g.strokeStyle = rgba(st.strata, 0.35);
            g.lineWidth = 1;
            for (let k = 0; k < 3; ++k) {
              g.beginPath();
              g.moveTo(rc.x, rc.y + 5 + k * 6 + rng() * 2);
              g.lineTo(rc.x + rc.w, rc.y + 5 + k * 6 + rng() * 2);
              g.stroke();
            }
          }
          /* a faint deep glow far below */
          const dg = g.createRadialGradient(rc.x + rc.w / 2, rc.y + rc.h * 0.7, 1, rc.x + rc.w / 2, rc.y + rc.h * 0.7, rc.w * 0.6);
          dg.addColorStop(0, rgba(st.glow, 0.12));
          dg.addColorStop(1, rgba(st.glow, 0));
          g.fillStyle = dg;
          g.fillRect(rc.x, rc.y, rc.w, rc.h);
          /* crumbling lip */
          g.fillStyle = rgba(st.floor[1], 1);
          const lip = function(x0, y0, x1, y1) {
            const steps = 6;
            for (let k = 0; k <= steps; ++k) {
              const px = x0 + (x1 - x0) * k / steps, py = y0 + (y1 - y0) * k / steps;
              g.beginPath();
              g.arc(px, py, 1.5 + rng() * 2.4, 0, TWO_PI);
              g.fill();
            }
          };
          if (!rc.U) lip(rc.x, rc.y, rc.x + rc.w, rc.y);
          if (!rc.D) lip(rc.x, rc.y + rc.h, rc.x + rc.w, rc.y + rc.h);
          if (!rc.L) lip(rc.x, rc.y, rc.x, rc.y + rc.h);
          if (!rc.R) lip(rc.x + rc.w, rc.y, rc.x + rc.w, rc.y + rc.h);
        } else if (code === T.RUNE) {
          const cx = x + 32, cy = y + 32;
          g.lineWidth = 3.5;
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.beginPath();
          g.arc(cx, cy + 0.8, 20, 0, TWO_PI);
          g.stroke();
          g.lineWidth = 1.2;
          g.strokeStyle = rgba(st.rim, 0.35);
          g.beginPath();
          g.arc(cx, cy, 21.5, Math.PI * 1.05, Math.PI * 1.95);
          g.stroke();
          g.strokeStyle = 'rgba(0,0,0,0.35)';
          g.lineWidth = 1.2;
          for (let k = 0; k < 8; ++k) {
            const a = k * TWO_PI / 8;
            g.beginPath();
            g.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
            g.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17);
            g.stroke();
          }
        } else if (code === T.GOAL) {
          const cx = x + 32, cy = y + 34;
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.beginPath();
          g.ellipse(cx + 2, cy + 3, 29, 25, 0, 0, TWO_PI);
          g.fill();
          const dg = g.createLinearGradient(0, cy - 26, 0, cy + 26);
          dg.addColorStop(0, '#d8d0c4');
          dg.addColorStop(1, '#6a6460');
          g.fillStyle = dg;
          g.beginPath();
          g.ellipse(cx, cy, 28, 24, 0, 0, TWO_PI);
          g.fill();
          g.fillStyle = rgba(st.frame, 1);
          g.beginPath();
          g.ellipse(cx, cy - 1, 23, 19, 0, 0, TWO_PI);
          g.fill();
          g.fillStyle = '#08060c';
          g.beginPath();
          g.ellipse(cx, cy - 1, 19, 15.5, 0, 0, TWO_PI);
          g.fill();
          g.fillStyle = st.trim;
          for (let k = 0; k < 8; ++k) {
            const a = k * TWO_PI / 8 + 0.2;
            g.beginPath();
            g.arc(cx + Math.cos(a) * 25.5, cy + Math.sin(a) * 21.5, 1.6, 0, TWO_PI);
            g.fill();
          }
        }
      }
      /* light pass: a warm pool from the top left, darker corners */
      const lg = g.createRadialGradient(W * 0.3, H * 0.2, 10, W * 0.45, H * 0.45, Math.max(W, H) * 0.85);
      lg.addColorStop(0, rgba(st.light, 0.12));
      lg.addColorStop(0.5, rgba(st.light, 0));
      lg.addColorStop(0.8, rgba(st.shadow, 0.18));
      lg.addColorStop(1, rgba(st.shadow, 0.42));
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);

      /* ── upper ── */
      const u = boardCtx(upper);
      /* trench rims: depth shadow inside the top/left banks, foam on the water */
      for (let i = 0; i < n; ++i) {
        if (!isTrench(tiles[i]) || !inR(i))
          continue;
        const rc = insetRect(tiles, cols, rows, i, isTrench, 9);
        u.fillStyle = 'rgba(0,0,0,0.38)';
        if (!rc.U) u.fillRect(rc.x, rc.y, rc.w, 5);
        if (!rc.L) u.fillRect(rc.x, rc.y + (rc.U ? 0 : 5), 4, rc.h - (rc.U ? 0 : 5));
        u.fillStyle = 'rgba(0,0,0,0.18)';
        if (!rc.U) u.fillRect(rc.x, rc.y + 5, rc.w, 4);
        u.fillStyle = rgba(st.rim, 0.3);
        if (!rc.D) u.fillRect(rc.x, rc.y + rc.h - 1, rc.w, 1);
        if (!rc.R) u.fillRect(rc.x + rc.w - 1, rc.y, 1, rc.h);
        if (tiles[i] === T.WATER) {
          const rng = mulberry32(i * 31 + 5);
          u.strokeStyle = 'rgba(235,250,255,0.55)';
          u.lineWidth = 1.4;
          const foam = function(x0, y0, x1, y1, nx, ny) {
            u.beginPath();
            for (let k = 0; k <= 8; ++k) {
              const p = k / 8, w = Math.sin(p * 9 + rng() * 2) * 1.2 + 2.5;
              const px = x0 + (x1 - x0) * p + nx * w, py = y0 + (y1 - y0) * p + ny * w;
              if (k === 0) u.moveTo(px, py); else u.lineTo(px, py);
            }
            u.stroke();
          };
          if (!rc.U) foam(rc.x, rc.y + 6, rc.x + rc.w, rc.y + 6, 0, 1);
          if (!rc.D) foam(rc.x, rc.y + rc.h - 3, rc.x + rc.w, rc.y + rc.h - 3, 0, -1);
          if (!rc.L) foam(rc.x + 4, rc.y, rc.x + 4, rc.y + rc.h, 1, 0);
          if (!rc.R) foam(rc.x + rc.w - 3, rc.y, rc.x + rc.w - 3, rc.y + rc.h, -1, 0);
        }
      }

      /* contact shadows under the props */
      u.globalAlpha = 0.45;
      for (let i = 0; i < n; ++i) {
        if (isProp(tiles[i]) && inR(i))
          u.drawImage(softRect(40, 26, 8), (i % cols) * TILE + 10, ((i / cols) | 0) * TILE + 28, 56, 42);
      }
      u.globalAlpha = 1;
      /* props, row by row */
      for (let i = 0; i < n; ++i) {
        const code = tiles[i];
        if (!isProp(code) || !inR(i))
          continue;
        const x = (i % cols) * TILE, y = ((i / cols) | 0) * TILE;
        u.drawImage(propOf(th, code), x, y, TILE, TILE);
      }

      u.save();
      u.setTransform(1, 0, 0, 1, 0, 0);
      u.drawImage(sUpper, 0, 0);
      u.restore();
      g.restore();
      u.restore();

      /* ── glow layer: rebuilt only when the glowing spots change ── */
      let glowSpots = staticGlow;
      for (const k in dynGlow)
        if (dynGlow[k].length)
          glowSpots = glowSpots.concat(dynGlow[k]);
      const gk = glowSpots.length + ':' + Object.keys(dynGlow).filter(function(k) { return dynGlow[k].length; }).join(',') + '@' + CW;
      if (gk === glowKey)
        return;
      glowKey = gk;
      glowCount = glowSpots.length;
      if (glowCount) {
        glow = glow && glow.width === CW && glow.height === CH ? glow : makeCanvas(CW, CH);
        const gg = boardCtx(glow);
        gg.setTransform(1, 0, 0, 1, 0, 0);
        gg.clearRect(0, 0, CW, CH);
        gg.setTransform(scale, 0, 0, scale, MARGIN * scale, MARGIN * scale);
        gg.globalCompositeOperation = 'lighter';
        for (const s of glowSpots) {
          if (s[4] === 'ring') {
            gg.strokeStyle = rgba(s[3], 0.5);
            gg.lineWidth = 2;
            gg.beginPath();
            gg.arc(s[0], s[1], 17, 0, TWO_PI);
            gg.stroke();
            gg.drawImage(softDot(s[3], 64), s[0] - s[2] / 2, s[1] - s[2] / 2, s[2], s[2]);
          } else {
            gg.drawImage(softDot(s[3], 64), s[0] - s[2] / 2, s[1] - s[2] / 2, s[2], s[2]);
          }
        }
      }
    }

    /* the ornate frame: a bevelled band in the realm material, gilded trims,
       studs and four medallions with the realm gem */
    function paintFrame(g, W, H) {
      const F = FRAME_W;
      g.save();
      g.beginPath();
      roundRect(g, -F, -F, W + 2 * F, H + 2 * F, 14);
      g.rect(W, 0, -W, H);
      const fg = g.createLinearGradient(0, -F, 0, H + F);
      fg.addColorStop(0, st.frameHi);
      fg.addColorStop(0.5, st.frame);
      fg.addColorStop(1, st.frame);
      g.fillStyle = fg;
      g.fill('evenodd');
      /* grain across the band */
      g.clip('evenodd');
      g.globalAlpha = 0.35;
      fillTexture(g, tex.face, -F, -F, W + 2 * F, H + 2 * F);
      g.globalAlpha = 1;
      g.restore();
      /* outer bevel */
      g.lineWidth = 2;
      roundRect(g, -F + 1, -F + 1, W + 2 * F - 2, H + 2 * F - 2, 13);
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.stroke();
      roundRect(g, -F - 0.5, -F - 0.5, W + 2 * F + 1, H + 2 * F + 1, 14);
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.lineWidth = 1.5;
      g.stroke();
      /* gilded trims */
      const gold = g.createLinearGradient(0, -F, 0, H + F);
      gold.addColorStop(0, '#fff2c0');
      gold.addColorStop(0.2, st.trim);
      gold.addColorStop(0.55, rgba(st.trim, 0.85));
      gold.addColorStop(1, '#6a4a1a');
      g.strokeStyle = gold;
      g.lineWidth = 2;
      roundRect(g, -F + 5, -F + 5, W + 2 * F - 10, H + 2 * F - 10, 10);
      g.stroke();
      g.lineWidth = 1.5;
      roundRect(g, -3.5, -3.5, W + 7, H + 7, 3);
      g.stroke();
      /* inner edge: a dark lip and an inner shadow on the board */
      g.strokeStyle = 'rgba(0,0,0,0.8)';
      g.lineWidth = 2;
      g.strokeRect(-1, -1, W + 2, H + 2);
      const ish = function(x, y, w, h, x0, y0, x1, y1, a) {
        const sg = g.createLinearGradient(x0, y0, x1, y1);
        sg.addColorStop(0, 'rgba(0,0,0,' + a + ')');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sg;
        g.fillRect(x, y, w, h);
      };
      ish(0, 0, W, 12, 0, 0, 0, 12, 0.5);
      ish(0, 0, 9, H, 0, 0, 9, 0, 0.4);
      ish(W - 6, 0, 6, H, W, 0, W - 6, 0, 0.25);
      /* studs along the band */
      const stud = function(x, y) {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.beginPath();
        g.arc(x + 0.6, y + 0.8, 2.6, 0, TWO_PI);
        g.fill();
        const sgd = g.createRadialGradient(x - 0.8, y - 0.8, 0.2, x, y, 2.6);
        sgd.addColorStop(0, '#fff8d8');
        sgd.addColorStop(0.5, st.trim);
        sgd.addColorStop(1, '#5a3a10');
        g.fillStyle = sgd;
        g.beginPath();
        g.arc(x, y, 2.4, 0, TWO_PI);
        g.fill();
      };
      for (let x = TILE; x < W; x += TILE) {
        stud(x, -F / 2 - 1);
        stud(x, H + F / 2 + 1);
      }
      for (let y = TILE; y < H; y += TILE) {
        stud(-F / 2 - 1, y);
        stud(W + F / 2 + 1, y);
      }
      /* corner medallions */
      gemSpots = [];
      const corners = [[-F / 2 - 1, -F / 2 - 1], [W + F / 2 + 1, -F / 2 - 1], [-F / 2 - 1, H + F / 2 + 1], [W + F / 2 + 1, H + F / 2 + 1]];
      for (const p of corners) {
        const x = p[0], y = p[1];
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.beginPath();
        g.arc(x + 1.5, y + 2.5, 17, 0, TWO_PI);
        g.fill();
        const mg = g.createRadialGradient(x - 5, y - 6, 1, x, y, 17);
        mg.addColorStop(0, '#fff4c8');
        mg.addColorStop(0.35, st.trim);
        mg.addColorStop(1, '#4a3010');
        g.fillStyle = mg;
        g.beginPath();
        g.arc(x, y, 16, 0, TWO_PI);
        g.fill();
        g.strokeStyle = 'rgba(40,24,6,0.8)';
        g.lineWidth = 1;
        g.stroke();
        /* filigree petals */
        g.fillStyle = 'rgba(60,36,8,0.45)';
        for (let k = 0; k < 8; ++k) {
          const a = k * TWO_PI / 8;
          g.beginPath();
          g.ellipse(x + Math.cos(a) * 11.5, y + Math.sin(a) * 11.5, 3, 1.4, a, 0, TWO_PI);
          g.fill();
        }
        /* the gem */
        const gg = g.createRadialGradient(x - 3, y - 3, 0.5, x, y, 8.5);
        gg.addColorStop(0, '#ffffff');
        gg.addColorStop(0.3, st.gem);
        gg.addColorStop(1, rgba(st.gem, 0.35));
        g.fillStyle = '#100810';
        g.beginPath();
        g.arc(x, y, 8.5, 0, TWO_PI);
        g.fill();
        g.fillStyle = gg;
        g.beginPath();
        g.moveTo(x, y - 8);
        g.lineTo(x + 7, y);
        g.lineTo(x, y + 8);
        g.lineTo(x - 7, y);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.6)';
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x - 7, y);
        g.lineTo(x, y - 8);
        g.lineTo(x + 7, y);
        g.stroke();
        gemSpots.push([x, y]);
      }
    }

    function update(opts) {
      const c = opts.cols | 0, r = opts.rows | 0;
      const s = Math.max(0.5, Math.min(2, +opts.scale || 1));
      const tiles = opts.tiles;
      let k = c + 'x' + r + '@' + s + ':';
      for (let i = 0; i < tiles.length; ++i)
        k += String.fromCharCode(65 + tiles[i]);
      const decals = opts.decals || null;
      if (decals)
        for (const idx in decals)
          k += '|' + idx + decals[idx].charAt(0);
      if (k === key)
        return false;
      key = k;
      framed = opts.frame !== false;
      let sk = c + 'x' + r + '@' + s + '#' + (opts.id || '') + (framed ? 'F' : 'P') + ':';
      for (let i = 0; i < tiles.length; ++i)
        sk += tiles[i] === T.WALL ? '1' : '0';
      const staticChanged = sk !== staticKey;
      staticKey = sk;
      let dirty = null;
      if (!staticChanged && prevTiles && prevTiles.length === tiles.length && s === scale) {
        for (let i = 0; i < tiles.length; ++i) {
          const dk = decals && decals[i] ? decals[i] : '';
          if (prevTiles[i] === tiles[i] && prevDecals[i] === dk)
            continue;
          const rr = (i / c) | 0, cc = i % c;
          if (!dirty) dirty = { c0: cc, c1: cc, r0: rr, r1: rr };
          dirty.c0 = Math.min(dirty.c0, cc); dirty.c1 = Math.max(dirty.c1, cc);
          dirty.r0 = Math.min(dirty.r0, rr); dirty.r1 = Math.max(dirty.r1, rr);
        }
      }
      prevTiles = Array.prototype.slice.call(tiles);
      prevDecals = [];
      for (let i = 0; i < tiles.length; ++i)
        prevDecals.push(decals && decals[i] ? decals[i] : '');
      cols = c;
      rows = r;
      scale = s;
      bake(tiles, decals, staticChanged, dirty);
      return true;
    }

    function blit(ctx, c) {
      ctx.drawImage(c, -MARGIN, -MARGIN, c.width / scale, c.height / scale);
    }

    function drawGround(ctx) {
      if (ground)
        blit(ctx, ground);
    }

    function drawUpper(ctx) {
      if (upper)
        blit(ctx, upper);
    }

    /* the flooded cells: two caustic frames cross-faded, texture continuous across cells */
    function drawWater(ctx, t) {
      if (!waterCells.length)
        return;
      const frames = waterFrames(th);
      const ft = (t || 0) * 5;
      const f0 = Math.floor(ft) & 7, f1 = (f0 + 1) & 7, mixK = ft - Math.floor(ft);
      const a = ctx.globalAlpha;
      for (const rc of waterCells) {
        const sx = (rc.x % 128) * TEX, sy = (rc.y % 128) * TEX;
        const sw = Math.min(rc.w * TEX, 256 - sx), sh = Math.min(rc.h * TEX, 256 - sy);
        ctx.globalAlpha = a;
        ctx.drawImage(frames[f0], sx, sy, sw, sh, rc.x, rc.y, sw / TEX, sh / TEX);
        ctx.globalAlpha = a * mixK;
        ctx.drawImage(frames[f1], sx, sy, sw, sh, rc.x, rc.y, sw / TEX, sh / TEX);
      }
      ctx.globalAlpha = a;
    }

    /* the additive pulse: embers, glyphs, ice light and the frame gems */
    function drawGlow(ctx, t) {
      const time = t || 0;
      const prev = ctx.globalCompositeOperation;
      const a = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter';
      if (glowCount && glow) {
        ctx.globalAlpha = a * (0.55 + 0.3 * Math.sin(time * 1.7) + 0.1 * Math.sin(time * 5.3));
        blit(ctx, glow);
      }
      const ice = softDot('#8ae0ff', 64);
      for (let i = 0; i < iceCells.length; ++i) {
        const p = iceCells[i];
        ctx.globalAlpha = a * (0.16 + 0.08 * Math.sin(time * 2.2 + i * 1.7));
        ctx.drawImage(ice, p[0] - 44, p[1] - 44, 88, 88);
      }
      /* the realm light: a warm pool from the top left; torchlight flickers in the grove */
      const W = cols * TILE, H = rows * TILE, big = Math.max(W, H) * 1.3;
      const flick = th === 0 ? 0.13 + 0.035 * Math.sin(time * 7.3) + 0.025 * Math.sin(time * 13.1 + 1) : 0.08 + 0.02 * Math.sin(time * 0.9);
      ctx.globalAlpha = a * flick;
      ctx.drawImage(softDot(st.light, 64), -big * 0.35, -big * 0.4, big, big);
      if (th === 3) {
        /* cloud shadows drifting over the ruins */
        ctx.globalCompositeOperation = 'source-over';
        const cloud = softDot('#1a2040', 64);
        for (let k = 0; k < 2; ++k) {
          const cx = ((time * 18 + k * (W * 0.7 + 300)) % (W + 700)) - 350;
          ctx.globalAlpha = a * 0.16;
          ctx.drawImage(cloud, cx - 220, H * (0.25 + k * 0.45) - 120, 440, 240);
        }
        ctx.globalCompositeOperation = 'lighter';
      }
      const gem = softDot(st.gem, 64);
      for (let i = 0; i < gemSpots.length; ++i) {
        const p = gemSpots[i];
        ctx.globalAlpha = a * (0.45 + 0.25 * Math.sin(time * 2.6 + i * 1.3));
        ctx.drawImage(gem, p[0] - 22, p[1] - 22, 44, 44);
      }
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = prev;
    }

    return {
      theme: th,
      update: update,
      drawGround: drawGround,
      drawWater: drawWater,
      drawUpper: drawUpper,
      drawGlow: drawGlow,
      get waterCount() { return waterCells.length; }
    };
  }

  /* a single prop for animations (the rolling boulder, menus); cx, cy = tile centre */
  function drawProp(ctx, theme, code, cx, cy, rot, size) {
    const s = size || TILE;
    const img = propOf((theme | 0) >= 0 && (theme | 0) < STYLES.length ? theme | 0 : 0, code);
    if (rot) {
      ctx.save();
      ctx.translate(cx, cy + 2);
      ctx.rotate(rot);
      ctx.drawImage(img, -s / 2, -s / 2 - 2, s, s);
      ctx.restore();
    } else {
      ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
    }
  }

  SZ.PuzzleBoard = Object.freeze({
    TILE: TILE, MARGIN: MARGIN, WALL_H: WALL_H, STYLES: STYLES,
    create: create, drawProp: drawProp, softDot: softDot
  });
})();
