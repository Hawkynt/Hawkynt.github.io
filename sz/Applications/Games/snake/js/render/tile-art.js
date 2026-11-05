/* Board tiles, painted once per theme: floor variants (grass, sand, ice, basalt, circuit, LCD,
   light-cycle grid), walls in each world's material (hedges, sandstone, ice blocks, basalt with
   glowing cracks, neon panels), crates, boulders, quicksand, ice, and the bases of spike traps,
   lava vents, laser gates and portals. The whole static board is composed into one cached layer
   with a framed rim and wall shadows, rebuilt only when a tile changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const { CELL, COLS, ROWS, TAU } = NS.constants;
  const { THEMES } = NS.worlds;
  const { T } = NS.items;
  const K = NS.artKit;

  const S = CELL;
  const RIM = 16;
  const LAYER_SCALE = 1.5;

  function noiseDots(g, seed, n, color, alpha, size) {
    const r = NS.rng.makeRng(seed);
    g.fillStyle = K.rgba(color, alpha);
    for (let k = 0; k < n; ++k) {
      const s = size * (0.5 + r());
      g.fillRect(r() * S, r() * S, s, s);
    }
  }

  function floor(th, variant) {
    const t = THEMES[th];
    return K.sprite('floor:' + th + ':' + variant, S, S, (g) => {
      const base = variant % 2 ? t.floorB : t.floorA;
      const gr = g.createLinearGradient(0, 0, S, S);
      gr.addColorStop(0, K.shade(base, 0.05));
      gr.addColorStop(1, K.shade(base, -0.06));
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      const seed = th * 131 + variant * 17 + 5;
      switch (t.deco) {
        case 'flowers': {
          const r = NS.rng.makeRng(seed);
          g.strokeStyle = K.rgba(K.shade(base, 0.3), 0.6);
          g.lineWidth = 1.2;
          for (let k = 0; k < 7; ++k) {
            const x = r() * S, y = r() * S;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 4 - r() * 3); g.stroke();
          }
          if (variant === 3) {
            const cols = ['#ffffff', '#ffe07a', '#ff9ac0'];
            for (let k = 0; k < 3; ++k) {
              const x = 6 + r() * (S - 12), y = 6 + r() * (S - 12);
              g.fillStyle = cols[k % 3];
              for (let p = 0; p < 5; ++p) { g.beginPath(); g.arc(x + Math.cos(p * 1.26) * 2.2, y + Math.sin(p * 1.26) * 2.2, 1.6, 0, TAU); g.fill(); }
              g.fillStyle = '#ffd23a';
              g.beginPath(); g.arc(x, y, 1.2, 0, TAU); g.fill();
            }
          }
          break;
        }
        case 'dunes': {
          g.strokeStyle = K.rgba(K.shade(base, -0.25), 0.35);
          g.lineWidth = 1.2;
          for (let k = 0; k < 3; ++k) {
            const y = 8 + k * 11 + (variant % 3) * 2;
            g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(S / 2, y - 4, S, y); g.stroke();
          }
          noiseDots(g, seed, 10, '#7a5a2a', 0.25, 1.4);
          break;
        }
        case 'ice': {
          g.strokeStyle = 'rgba(255,255,255,0.45)';
          g.lineWidth = 1;
          const r = NS.rng.makeRng(seed);
          g.beginPath();
          const x0 = r() * S;
          g.moveTo(x0, 0); g.lineTo(x0 + (r() - 0.5) * 14, S * 0.5); g.lineTo(x0 + (r() - 0.5) * 20, S);
          g.stroke();
          noiseDots(g, seed, 6, '#ffffff', 0.4, 1.2);
          break;
        }
        case 'lava': {
          noiseDots(g, seed, 12, '#000000', 0.25, 2);
          if (variant === 2) {
            g.strokeStyle = 'rgba(255,110,30,0.35)';
            g.lineWidth = 1.4;
            g.beginPath(); g.moveTo(4, S * 0.7); g.lineTo(S * 0.4, S * 0.55); g.lineTo(S * 0.7, S * 0.8); g.stroke();
          }
          break;
        }
        case 'neon':
        case 'tron':
          g.strokeStyle = K.rgba(t.accent, t.deco === 'tron' ? 0.22 : 0.12);
          g.lineWidth = 1;
          g.strokeRect(0.5, 0.5, S - 1, S - 1);
          if (variant === 1) { g.fillStyle = K.rgba(t.accent, 0.15); g.fillRect(S / 2 - 1, S / 2 - 1, 2, 2); }
          break;
        case 'lcd':
          g.fillStyle = 'rgba(15,56,15,0.06)';
          g.fillRect(1, 1, S - 2, S - 2);
          break;
      }
      g.strokeStyle = t.line;
      g.lineWidth = 1;
      g.strokeRect(0, 0, S, S);
    });
  }

  function wall(th) {
    const t = THEMES[th];
    return K.sprite('wall:' + th, S, S, (g) => {
      switch (t.deco) {
        case 'flowers': {
          /* a clipped hedge: layered leafy lobes */
          g.fillStyle = t.wallDark;
          K.roundRect(g, 1, 3, S - 2, S - 3, 8); g.fill();
          const r = NS.rng.makeRng(th + 77);
          for (let k = 0; k < 14; ++k) {
            const x = 5 + r() * (S - 10), y = 5 + r() * (S - 14), rr = 5 + r() * 4;
            const gr = g.createRadialGradient(x - 2, y - 2, 1, x, y, rr);
            gr.addColorStop(0, K.shade(t.wallTop, 0.25));
            gr.addColorStop(1, t.wall);
            g.fillStyle = gr;
            g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
          }
          break;
        }
        case 'dunes': {
          const gr = g.createLinearGradient(0, 0, 0, S);
          gr.addColorStop(0, t.wallTop); gr.addColorStop(1, t.wall);
          g.fillStyle = gr;
          g.fillRect(0, 0, S, S);
          g.strokeStyle = K.rgba(t.wallDark, 0.55);
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(0, S / 2); g.lineTo(S, S / 2);
          g.moveTo(S / 2, 0); g.lineTo(S / 2, S / 2);
          g.moveTo(S / 4, S / 2); g.lineTo(S / 4, S);
          g.moveTo(S * 0.75, S / 2); g.lineTo(S * 0.75, S);
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(0, 0, S, 3);
          break;
        }
        case 'ice': {
          const gr = g.createLinearGradient(0, 0, S, S);
          gr.addColorStop(0, '#f4fcff'); gr.addColorStop(0.5, t.wall); gr.addColorStop(1, t.wallDark);
          g.fillStyle = gr;
          K.roundRect(g, 1, 1, S - 2, S - 2, 5); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.6)';
          g.beginPath(); g.moveTo(5, 5); g.lineTo(S * 0.55, 5); g.lineTo(5, S * 0.55); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.8)';
          g.lineWidth = 1.2;
          K.roundRect(g, 1.5, 1.5, S - 3, S - 3, 5); g.stroke();
          break;
        }
        case 'lava': {
          const gr = g.createLinearGradient(0, 0, 0, S);
          gr.addColorStop(0, t.wallTop); gr.addColorStop(1, t.wallDark);
          g.fillStyle = gr;
          K.roundRect(g, 1, 1, S - 2, S - 2, 6); g.fill();
          g.strokeStyle = '#ff7a2a';
          g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(6, S * 0.3); g.lineTo(S * 0.45, S * 0.5); g.lineTo(S * 0.35, S * 0.85);
          g.moveTo(S * 0.45, S * 0.5); g.lineTo(S - 6, S * 0.4); g.stroke();
          g.strokeStyle = 'rgba(255,220,120,0.6)';
          g.lineWidth = 0.6;
          g.stroke();
          break;
        }
        case 'neon':
        case 'tron': {
          g.fillStyle = t.wallDark;
          g.fillRect(1, 1, S - 2, S - 2);
          g.strokeStyle = K.rgba(t.wallTop, 0.35);
          g.lineWidth = 5;
          g.strokeRect(4, 4, S - 8, S - 8);
          g.strokeStyle = t.wallTop;
          g.lineWidth = 1.6;
          g.strokeRect(4, 4, S - 8, S - 8);
          g.fillStyle = K.rgba(t.wallTop, 0.4);
          g.fillRect(S / 2 - 3, S / 2 - 3, 6, 6);
          break;
        }
        default:
          g.fillStyle = t.wallDark;
          g.fillRect(2, 2, S - 4, S - 4);
          g.fillStyle = t.wall;
          g.fillRect(6, 6, S - 12, S - 12);
      }
    });
  }

  function crate(th) {
    const t = THEMES[th];
    return K.sprite('crate:' + th, S, S, (g) => {
      if (t.deco === 'neon' || t.deco === 'tron') {
        g.fillStyle = K.rgba(t.accent, 0.25);
        K.roundRect(g, 5, 5, S - 10, S - 10, 4); g.fill();
        g.strokeStyle = t.accent;
        g.lineWidth = 2;
        K.roundRect(g, 5, 5, S - 10, S - 10, 4); g.stroke();
        g.beginPath(); g.moveTo(5, S / 2); g.lineTo(S - 5, S / 2); g.moveTo(S / 2, 5); g.lineTo(S / 2, S - 5); g.stroke();
        return;
      }
      const c = t.deco === 'ice' ? '#8ab8dc' : '#a8743c';
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(4, 7, S - 6, S - 6);
      const gr = g.createLinearGradient(0, 3, 0, S - 3);
      gr.addColorStop(0, K.shade(c, 0.2)); gr.addColorStop(1, K.shade(c, -0.25));
      g.fillStyle = gr;
      g.fillRect(3, 3, S - 7, S - 7);
      g.strokeStyle = K.shade(c, -0.5);
      g.lineWidth = 2;
      g.strokeRect(4, 4, S - 9, S - 9);
      g.beginPath(); g.moveTo(5, 5); g.lineTo(S - 6, S - 6); g.moveTo(S - 6, 5); g.lineTo(5, S - 6); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(4, 4); g.lineTo(S - 5, 4); g.stroke();
    });
  }

  function rock() {
    return K.sprite('rock', S, S, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(S / 2 + 2, S * 0.62, S * 0.42, S * 0.3, 0, 0, TAU); g.fill();
      const gr = g.createRadialGradient(S * 0.38, S * 0.32, 2, S / 2, S / 2, S * 0.48);
      gr.addColorStop(0, '#c8a880'); gr.addColorStop(0.6, '#7a5a3a'); gr.addColorStop(1, '#4a3420');
      g.fillStyle = gr;
      K.poly(g, [[6, S * 0.55], [S * 0.25, 7], [S * 0.62, 5], [S - 5, S * 0.4], [S - 7, S - 7], [S * 0.3, S - 5]]);
      g.fill();
      g.strokeStyle = 'rgba(40,24,10,0.6)';
      g.lineWidth = 1.2;
      g.stroke();
    });
  }

  function soft(kind) {
    return K.sprite('soft:' + kind, S, S, (g) => {
      if (kind === 'sand') {
        const gr = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S * 0.62);
        gr.addColorStop(0, '#8a6a3a'); gr.addColorStop(0.7, '#b8925a'); gr.addColorStop(1, 'rgba(200,160,100,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
        g.strokeStyle = 'rgba(70,45,15,0.55)';
        g.lineWidth = 1.4;
        g.beginPath();
        for (let a = 0; a < 9; a += 0.2) {
          const r = 2 + a * 1.6;
          const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
          if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      } else {
        const gr = g.createLinearGradient(0, 0, S, S);
        gr.addColorStop(0, '#f4fcff'); gr.addColorStop(0.5, '#bfe6ff'); gr.addColorStop(1, '#8ac4ec');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath(); g.moveTo(S * 0.15, S); g.lineTo(S * 0.55, 0); g.lineTo(S * 0.68, 0); g.lineTo(S * 0.28, S); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(70,140,200,0.4)';
        g.strokeRect(0.5, 0.5, S - 1, S - 1);
      }
    });
  }

  function hazardBase(kind, th) {
    const t = THEMES[th];
    return K.sprite('hbase:' + kind + ':' + th, S, S, (g) => {
      if (kind === '^') {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        K.roundRect(g, 4, 4, S - 8, S - 8, 4); g.fill();
        g.fillStyle = '#6a6a72';
        K.roundRect(g, 5, 5, S - 10, S - 10, 4); g.fill();
        g.fillStyle = '#26262c';
        for (let y = 0; y < 3; ++y) for (let x = 0; x < 3; ++x) { g.beginPath(); g.arc(11 + x * 8, 11 + y * 8, 2, 0, TAU); g.fill(); }
      } else if (kind === '*') {
        const gr = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
        gr.addColorStop(0, '#ff8a2a'); gr.addColorStop(0.35, '#5a1a0a'); gr.addColorStop(0.7, '#2a1410'); gr.addColorStop(1, 'rgba(40,20,16,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
        g.strokeStyle = '#1a0a06';
        g.lineWidth = 3;
        g.beginPath(); g.arc(S / 2, S / 2, S * 0.3, 0, TAU); g.stroke();
      } else if (kind === '=') {
        g.fillStyle = K.rgba(t.accent, 0.15);
        g.fillRect(0, S / 2 - 3, S, 6);
        g.fillStyle = '#2a2a3a';
        g.fillRect(0, S / 2 - 6, 6, 12);
        g.fillRect(S - 6, S / 2 - 6, 6, 12);
        g.fillStyle = '#ff3a6a';
        g.fillRect(1, S / 2 - 2, 4, 4);
        g.fillRect(S - 5, S / 2 - 2, 4, 4);
      } else {
        const gr = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
        gr.addColorStop(0, '#1a0a2a'); gr.addColorStop(0.7, '#5a3aa0'); gr.addColorStop(1, 'rgba(90,58,160,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, S, S);
      }
    });
  }

  /* ── the composed static layer ── */
  let layer = null, layerLevel = null, layerVer = -1, layerTheme = -1;

  function variantAt(i) {
    const x = i % COLS, y = (i / COLS) | 0;
    return ((x + y) % 2) + (((x * 7 + y * 13) % 11) === 0 ? 2 : 0);
  }

  function boardLayer(level) {
    const th = level.theme;
    if (layer && layerLevel === level && layerVer === (level.ver || 0) && layerTheme === th) return layer;
    const t = THEMES[th];
    const W = COLS * S + RIM * 2, H = ROWS * S + RIM * 2;
    if (!layer) layer = { canvas: K.makeCanvas(W * LAYER_SCALE, H * LAYER_SCALE), w: W, h: H };
    const g = layer.canvas.getContext('2d');
    g.setTransform(LAYER_SCALE, 0, 0, LAYER_SCALE, 0, 0);
    g.clearRect(0, 0, W, H);
    /* rim: a soft frame in the theme's ground colour */
    g.fillStyle = 'rgba(0,0,0,0.35)';
    K.roundRect(g, 2, 6, W - 4, H - 4, 18); g.fill();
    const rg = g.createLinearGradient(0, 0, 0, H);
    rg.addColorStop(0, K.shade(t.ground, 0.2)); rg.addColorStop(1, K.shade(t.ground, -0.3));
    g.fillStyle = rg;
    K.roundRect(g, 0, 0, W, H, 16); g.fill();
    g.strokeStyle = K.rgba(t.accent, 0.5);
    g.lineWidth = 2;
    K.roundRect(g, 3, 3, W - 6, H - 6, 14); g.stroke();
    g.translate(RIM, RIM);
    const tiles = level.tiles;
    for (let i = 0; i < tiles.length; ++i) {
      const x = (i % COLS) * S, y = ((i / COLS) | 0) * S;
      g.drawImage(floor(th, variantAt(i)).canvas, x, y, S, S);
    }
    /* wall shadows first, then everything standing on the floor */
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < tiles.length; ++i)
      if (tiles[i] === T.WALL || tiles[i] === T.CRATE || tiles[i] === T.ROCK) g.fillRect((i % COLS) * S + 5, ((i / COLS) | 0) * S + 6, S, S);
    for (let i = 0; i < tiles.length; ++i) {
      const ch = tiles[i];
      const x = (i % COLS) * S, y = ((i / COLS) | 0) * S;
      let spr = null;
      if (ch === T.WALL) spr = wall(th);
      else if (ch === T.CRATE) spr = crate(th);
      else if (ch === T.ROCK) spr = rock();
      else if (ch === T.SAND) spr = soft('sand');
      else if (ch === T.ICE) spr = soft('ice');
      else if (ch === T.SPIKE || ch === T.VENT || ch === T.GATE) spr = hazardBase(ch, th);
      else if (ch === T.P1 || ch === T.P2 || ch === T.P3 || ch === T.P4) spr = hazardBase('o', th);
      if (spr) g.drawImage(spr.canvas, x, y, S, S);
    }
    /* a soft inner shade along the board edges gives it depth */
    const bw = COLS * S, bh = ROWS * S;
    const edges = [[0, 0, bw, 26, 0, 0, 0, 26], [0, bh - 26, bw, 26, 0, bh, 0, bh - 26], [0, 0, 26, bh, 0, 0, 26, 0], [bw - 26, 0, 26, bh, bw, 0, bw - 26, 0]];
    for (let e = 0; e < edges.length; ++e) {
      const d = edges[e];
      const eg = g.createLinearGradient(d[4], d[5], d[6], d[7]);
      eg.addColorStop(0, 'rgba(0,0,0,0.28)');
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = eg;
      g.fillRect(d[0], d[1], d[2], d[3]);
    }
    layerLevel = level;
    layerVer = level.ver || 0;
    layerTheme = th;
    return layer;
  }

  function invalidate() {
    layerLevel = null;
  }

  Object.assign(NS.tileArt, {
    RIM, LAYER_SCALE, floor, wall, crate, rock, soft, hazardBase, boardLayer, invalidate
  });
})();
