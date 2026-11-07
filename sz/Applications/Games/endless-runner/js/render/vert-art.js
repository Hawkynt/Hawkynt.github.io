/* The art of the climbs and drops, painted once and cached: for each world a vertical scene
   in three seamless tiles - a far wall that fills the screen (the bell tower's bricks and arched
   windows with banners, the lava chimney's glowing veins, a frozen waterfall, a skyscraper
   facade, the star-torn void of the Rift), a middle layer (beams, ropes and a bell; rock
   outcrops and lava drips; ice ledges with icicles; neon signs, cables and elevator rails;
   floating rubble) and a near column that frames the open side (an ivy-hung pillar, a jagged
   rock edge, an ice column, a riveted girder, a crystal spire) - plus a light gradient for real
   up and down, and the wall slab and ledge tiles the course uses there. Wall tiles are painted
   in course space (surface on top) with courses across the run, so they read as a wall once
   the view is turned. Paints only; the caches own the canvases. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const K = NS.artKit;
  const { TAU } = NS.constants;

  const TW = 512, TH = 1024, NW = 220;
  const OUT = '#141224';
  const cache = Object.create(null);

  /* per world: the slab (stone, hi, dark, mortar), trim, glow, accent, gap edge, far fog,
     where the real light comes from and its colour */
  const PAL = [
    { stone: '#8c7b6b', hi: '#b8a68e', dk: '#4e4038', mortar: '#3a3030', trim: '#7a4e2a', trimHi: '#c08a48', glow: '#ffd890',
      accent: '#d8483a', edge: '#2a2020', fog: 'rgba(30,20,40,0.5)', light: 'top', lightCol: '#ffe8b0', sky: ['#5aa8f0', '#cdeeff'] },
    { stone: '#5a2a20', hi: '#8a4a32', dk: '#2a120e', mortar: '#1e0c08', trim: '#3a1a14', trimHi: '#a0502a', glow: '#ffb040',
      accent: '#ff6a1a', edge: '#140604', fog: 'rgba(30,6,4,0.42)', light: 'bottom', lightCol: '#ff7a2a' },
    { stone: '#9ac4e8', hi: '#e8f6ff', dk: '#3a5a88', mortar: '#5a80b0', trim: '#5a7aa8', trimHi: '#ffffff', glow: '#bff4ff',
      accent: '#8ae0ff', edge: '#1e3050', fog: 'rgba(20,40,80,0.5)', light: 'top', lightCol: '#d8f4ff' },
    { stone: '#2a2448', hi: '#4a4078', dk: '#120e26', mortar: '#0a0818', trim: '#3a3a5a', trimHi: '#8a8ab0', glow: '#38e0ff',
      accent: '#ff4ab8', edge: '#08060f', fog: 'rgba(10,6,30,0.6)', light: 'bottom', lightCol: '#ff4ab8' },
    { stone: '#3a2260', hi: '#8a5aff', dk: '#140a28', mortar: '#0a0518', trim: '#2a1a4a', trimHi: '#c08cff', glow: '#e0b0ff',
      accent: '#c08cff', edge: '#05020e', fog: 'rgba(8,2,20,0.30)', light: 'top', lightCol: '#c08cff' },
  ];

  function tile(key, w, h, paint) {
    let s = cache[key];
    if (s) return s;
    const c = K.makeCanvas(w, h);
    paint(c.getContext('2d'), w, h);
    s = cache[key] = { canvas: c, w: w, h: h };
    return s;
  }

  function rng(seed) {
    return NS.rng.makeRng(seed);
  }

  /* draw f at (x, y) and at the copies that wrap across the tile's edges */
  function wrap(x, y, sw, sh, w, h, f) {
    for (let dx = -1; dx <= 1; ++dx)
      for (let dy = -1; dy <= 1; ++dy) {
        const xx = x + dx * w, yy = y + dy * h;
        if (xx + sw < 0 || xx - sw > w || yy + sh < 0 || yy - sh > h) continue;
        f(xx, yy);
      }
  }

  function glowLine(g, pts, color, width) {
    for (let pass = 0; pass < 3; ++pass) {
      g.strokeStyle = pass === 2 ? '#fff6d0' : K.rgba(color, pass ? 0.75 : 0.22);
      g.lineWidth = pass === 0 ? width * 4 : pass === 1 ? width * 1.6 : width * 0.5;
      g.beginPath();
      for (let i = 0; i < pts.length; ++i) if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[i][0], pts[i][1]);
      g.stroke();
    }
  }

  function bricks(g, w, h, P, rowH, len, seed) {
    const r = rng(seed);
    g.fillStyle = P.mortar;
    g.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += rowH, ++row)
      for (let x = (row % 2) * -len / 2; x < w; x += len) {
        g.fillStyle = K.mix(P.dk, P.stone, 0.45 + r() * 0.5);
        g.fillRect(x + 2, y + 2, len - 4, rowH - 4);
        g.fillStyle = K.rgba(P.hi, 0.35);
        g.fillRect(x + 2, y + 2, len - 4, 2);
      }
  }

  /* ── far walls (opaque, tile both ways) ── */
  const FAR = [
    (g, w, h, P) => {
      bricks(g, w, h, P, 32, 64, 3);
      /* arched windows onto the sky, with a banner between them */
      const wins = [[128, 230], [384, 740]];
      for (let i = 0; i < wins.length; ++i) {
        const x = wins[i][0], y = wins[i][1];
        wrap(x, y, 70, 140, w, h, (xx, yy) => {
          g.fillStyle = P.dk;
          g.beginPath(); g.moveTo(xx - 58, yy + 120); g.lineTo(xx - 58, yy - 50); g.arc(xx, yy - 50, 58, Math.PI, 0); g.lineTo(xx + 58, yy + 120); g.fill();
          const gr = g.createLinearGradient(0, yy - 100, 0, yy + 110);
          gr.addColorStop(0, P.sky[0]); gr.addColorStop(1, P.sky[1]);
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(xx - 46, yy + 110); g.lineTo(xx - 46, yy - 50); g.arc(xx, yy - 50, 46, Math.PI, 0); g.lineTo(xx + 46, yy + 110); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.85)';
          g.beginPath(); g.ellipse(xx - 8, yy + 10, 26, 10, 0, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(xx + 14, yy + 2, 18, 9, 0, 0, TAU); g.fill();
          g.fillStyle = OUT;
          g.fillRect(xx - 3, yy - 96, 6, 206); g.fillRect(xx - 46, yy + 20, 92, 5);
          g.fillStyle = P.hi;
          g.fillRect(xx - 66, yy + 110, 132, 12);
          g.fillStyle = 'rgba(255,236,180,0.10)';
          K.poly(g, [[xx - 46, yy + 122], [xx + 46, yy + 122], [xx + 90, yy + 300], [xx - 20, yy + 300]]); g.fill();
        });
      }
      const banners = [[384, 250], [128, 760]];
      for (let i = 0; i < banners.length; ++i)
        wrap(banners[i][0], banners[i][1], 50, 130, w, h, (xx, yy) => {
          g.fillStyle = P.trim; g.fillRect(xx - 46, yy - 120, 92, 10);
          g.fillStyle = OUT;
          K.poly(g, [[xx - 38, yy - 112], [xx + 38, yy - 112], [xx + 38, yy + 110], [xx, yy + 80], [xx - 38, yy + 110]]); g.fill();
          g.fillStyle = P.accent;
          K.poly(g, [[xx - 34, yy - 110], [xx + 34, yy - 110], [xx + 34, yy + 102], [xx, yy + 74], [xx - 34, yy + 102]]); g.fill();
          g.fillStyle = '#ffd24a';
          g.fillRect(xx - 34, yy - 110, 68, 6); g.fillRect(xx - 30, yy - 104, 3, 196); g.fillRect(xx + 27, yy - 104, 3, 196);
          K.poly(g, [[xx, yy - 50], [xx + 20, yy - 20], [xx, yy + 10], [xx - 20, yy - 20]]); g.fill();
          g.fillStyle = P.accent;
          g.beginPath(); g.arc(xx, yy - 20, 8, 0, TAU); g.fill();
        });
      g.fillStyle = P.fog;
      g.fillRect(0, 0, w, h);
    },
    (g, w, h, P) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, P.dk); gr.addColorStop(0.5, P.stone); gr.addColorStop(1, P.dk);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 40; ++i) {
        const x = r() * w, y = r() * h, rw = 30 + r() * 70, rh = 20 + r() * 50;
        wrap(x, y, rw, rh, w, h, (xx, yy) => {
          g.fillStyle = K.rgba(r() < 0.5 ? P.hi : '#000000', 0.18);
          g.beginPath(); g.ellipse(xx, yy, rw, rh, r(), 0, TAU); g.fill();
        });
      }
      for (let v = 0; v < 6; ++v) {
        const pts = [];
        let x = (v + 0.5) * w / 6 + r() * 30;
        for (let y = -40; y <= h + 40; y += 32) { pts.push([x, y]); x += (r() - 0.5) * 34; }
        pts[pts.length - 1][0] = pts[0][0];
        glowLine(g, pts, P.accent, 2 + (v % 2));
      }
      g.fillStyle = P.fog;
      g.fillRect(0, 0, w, h);
    },
    (g, w, h, P) => {
      for (let x = 0; x < w; x += 8) {
        const k = 0.5 + 0.5 * Math.sin(x / w * TAU * 3) * Math.sin(x / w * TAU * 7 + 1);
        g.fillStyle = K.mix(P.dk, P.stone, 0.35 + k * 0.6);
        g.fillRect(x, 0, 8, h);
      }
      const r = rng(19);
      for (let i = 0; i < 70; ++i) {
        const x = r() * w, y = r() * h, len = 80 + r() * 240;
        wrap(x, y, 4, len, w, h, (xx, yy) => {
          g.fillStyle = K.rgba(P.hi, 0.12 + r() * 0.2);
          g.fillRect(xx, yy, 2 + r() * 3, len);
        });
      }
      g.strokeStyle = K.rgba('#ffffff', 0.35);
      g.lineWidth = 1.5;
      for (let i = 0; i < 18; ++i) {
        const x = r() * w, y = r() * h;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 - r() * 40, y + 30); g.lineTo(x + 10 - r() * 20, y + 60); g.stroke();
      }
      g.fillStyle = P.fog;
      g.fillRect(0, 0, w, h);
    },
    (g, w, h, P) => {
      g.fillStyle = P.dk;
      g.fillRect(0, 0, w, h);
      const r = rng(23);
      for (let y = 0; y < h; y += 64) {
        g.fillStyle = P.stone;
        g.fillRect(0, y, w, 6);
        for (let x = 8; x < w; x += 32) {
          const lit = r();
          g.fillStyle = lit < 0.32 ? '#ffe8a0' : lit < 0.45 ? '#7af0ff' : lit < 0.5 ? '#ff8ad8' : '#1c1838';
          g.fillRect(x, y + 16, 20, 34);
          if (lit < 0.5) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y + 16, 20, 4); }
        }
      }
      for (let x = 0; x < w; x += 128) { g.fillStyle = P.hi; g.fillRect(x, 0, 4, h); }
      g.fillStyle = P.fog;
      g.fillRect(0, 0, w, h);
    },
    (g, w, h, P) => {
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, '#05020e'); gr.addColorStop(0.5, '#1c0e34'); gr.addColorStop(1, '#05020e');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      const r = rng(37);
      for (let i = 0; i < 9; ++i) {
        const x = r() * w, y = r() * h, rr = 90 + r() * 160, col = r() < 0.5 ? '#8a4aff' : '#ff6ad5';
        wrap(x, y, rr, rr, w, h, (xx, yy) => {
          const rg = g.createRadialGradient(xx, yy, 0, xx, yy, rr);
          rg.addColorStop(0, K.rgba(col, 0.28)); rg.addColorStop(1, K.rgba(col, 0));
          g.fillStyle = rg;
          g.fillRect(xx - rr, yy - rr, rr * 2, rr * 2);
        });
      }
      for (let i = 0; i < 260; ++i) {
        g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7).toFixed(2) + ')';
        g.fillRect(r() * w, r() * h, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1);
      }
      for (let i = 0; i < 3; ++i) {
        const x = 80 + i * 160 + r() * 40, pts = [];
        let xx = x;
        for (let y = -20; y <= h + 20; y += 48) { pts.push([xx, y]); xx += (r() - 0.5) * 40; }
        pts[pts.length - 1][0] = pts[0][0];
        glowLine(g, pts, '#e0b0ff', 1.2);
      }
    },
  ];

  /* ── middle layers (transparent, tile both ways) ── */
  const MID = [
    (g, w, h, P) => {
      const beam = (y) => {
        g.fillStyle = OUT; g.fillRect(0, y - 2, w, 40);
        g.fillStyle = P.trim; g.fillRect(0, y, w, 36);
        g.fillStyle = P.trimHi; g.fillRect(0, y, w, 5);
        g.fillStyle = K.rgba('#000000', 0.25);
        for (let x = 20; x < w; x += 64) g.fillRect(x, y + 12, 18, 3);
      };
      beam(160); beam(680);
      g.strokeStyle = P.trim; g.lineWidth = 14;
      for (let i = 0; i < 2; ++i) {
        const y = i ? 680 : 160;
        g.beginPath(); g.moveTo(40, y + 36); g.lineTo(150, y + 180); g.stroke();
        g.beginPath(); g.moveTo(w - 40, y + 36); g.lineTo(w - 150, y + 180); g.stroke();
      }
      /* bell under the first beam, ropes through */
      g.strokeStyle = '#c8a46a'; g.lineWidth = 4;
      for (const x of [96, 420]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      const bx = 300, by = 196;
      g.fillStyle = OUT;
      g.beginPath(); g.moveTo(bx - 52, by + 112); g.quadraticCurveTo(bx - 44, by + 10, bx, by + 6); g.quadraticCurveTo(bx + 44, by + 10, bx + 52, by + 112); g.closePath(); g.fill();
      const gr = g.createLinearGradient(bx - 48, 0, bx + 48, 0);
      gr.addColorStop(0, '#7a5018'); gr.addColorStop(0.4, '#f0c060'); gr.addColorStop(1, '#8a5a1c');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(bx - 46, by + 106); g.quadraticCurveTo(bx - 38, by + 14, bx, by + 12); g.quadraticCurveTo(bx + 38, by + 14, bx + 46, by + 106); g.closePath(); g.fill();
      g.fillStyle = '#5a3a10'; g.fillRect(bx - 50, by + 100, 100, 8);
      g.fillStyle = OUT; g.beginPath(); g.arc(bx, by + 116, 9, 0, TAU); g.fill();
    },
    (g, w, h, P) => {
      const r = rng(13);
      for (let i = 0; i < 7; ++i) {
        const left = i % 2 === 0, y = i * 150 + r() * 60, d = 50 + r() * 70;
        wrap(left ? 0 : w, y, d + 20, 90, w, h, (xx, yy) => {
          const s = left ? 1 : -1;
          g.fillStyle = P.dk;
          K.poly(g, [[xx, yy - 70], [xx + s * d, yy - 30], [xx + s * (d + 16), yy + 10], [xx + s * d * 0.6, yy + 60], [xx, yy + 80]]); g.fill();
          g.fillStyle = P.hi;
          K.poly(g, [[xx, yy - 70], [xx + s * d, yy - 30], [xx + s * (d - 6), yy - 22], [xx, yy - 58]]); g.fill();
          g.fillStyle = P.accent;
          g.fillRect(xx + s * d * 0.5 - 2, yy + 50, 4, 30 + r() * 50);
          g.beginPath(); g.arc(xx + s * d * 0.5, yy + 100 + r() * 30, 4, 0, TAU); g.fill();
        });
      }
      for (let i = 0; i < 60; ++i) {
        g.fillStyle = r() < 0.5 ? '#ffd04a' : '#ff6a1a';
        g.globalAlpha = 0.4 + r() * 0.5;
        g.fillRect(r() * w, r() * h, 2 + r() * 2, 2 + r() * 2);
      }
      g.globalAlpha = 1;
    },
    (g, w, h, P) => {
      const ledge = (x0, x1, y) => {
        g.fillStyle = P.hi;
        K.roundRect(g, x0, y, x1 - x0, 22, 10); g.fill();
        g.fillStyle = P.stone;
        g.fillRect(x0 + 6, y + 14, x1 - x0 - 12, 8);
        for (let x = x0 + 10; x < x1 - 10; x += 22) {
          const len = 20 + ((x * 7) % 46);
          g.fillStyle = K.rgba('#e8f8ff', 0.9);
          K.poly(g, [[x, y + 20], [x + 10, y + 20], [x + 5, y + 20 + len]]); g.fill();
        }
      };
      ledge(-30, 200, 300); ledge(w - 200, w + 30, 300);
      ledge(260, w + 10, 820); ledge(-10, 40, 820);
      const r = rng(29);
      for (let i = 0; i < 6; ++i) {
        const x = r() * w, y = r() * h, s = 0.6 + r() * 0.8;
        wrap(x, y, 30, 80, w, h, (xx, yy) => {
          g.fillStyle = K.rgba(P.hi, 0.75);
          K.poly(g, [[xx - 12 * s, yy], [xx - 6 * s, yy - 50 * s], [xx, yy - 80 * s], [xx + 8 * s, yy - 46 * s], [xx + 12 * s, yy]]); g.fill();
        });
      }
    },
    (g, w, h, P) => {
      /* elevator rails, cables and two vertical neon signs */
      g.fillStyle = P.trim;
      for (const x of [228, 284]) {
        g.fillRect(x - 3, 0, 6, h);
        for (let y = 20; y < h; y += 96) g.fillRect(x - 10, y, 20, 8);
      }
      g.strokeStyle = 'rgba(10,8,24,0.8)'; g.lineWidth = 3;
      for (const x of [140, 380]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      const sign = (x, y, col, glyphs) => {
        g.fillStyle = 'rgba(10,8,24,0.85)';
        K.roundRect(g, x - 34, y - 10, 68, glyphs * 70 + 20, 8); g.fill();
        for (let i = 0; i < glyphs; ++i) {
          const cy = y + 26 + i * 70, kind = (x + i * 3) % 4;
          const pts = kind === 0 ? [[-16, -18], [16, -18], [16, 18], [-16, 18], [-16, -18]] : kind === 1 ? [[-16, -18], [16, -18], [0, 0], [16, 18], [-16, 18]]
            : kind === 2 ? [[0, -20], [0, 20], [-16, 4], [16, 4]] : [[-16, 18], [-16, -18], [16, 18], [16, -18]];
          glowLine(g, pts.map(q => [x + q[0], cy + q[1]]), col, 1.6);
        }
      };
      sign(64, 120, '#ff4ab8', 4);
      sign(448, 560, '#38e0ff', 5);
    },
    (g, w, h, P) => {
      const r = rng(41);
      for (let i = 0; i < 9; ++i) {
        const x = r() * w, y = r() * h, s = 20 + r() * 40, pillar = i % 3 === 0;
        wrap(x, y, s * 2, s * 3, w, h, (xx, yy) => {
          g.fillStyle = P.dk;
          if (pillar) {
            g.fillRect(xx - s * 0.4, yy - s * 1.6, s * 0.8, s * 3.2);
            g.fillStyle = P.stone; g.fillRect(xx - s * 0.6, yy - s * 1.7, s * 1.2, s * 0.3);
            g.fillStyle = '#e0b0ff'; g.beginPath(); g.arc(xx, yy, s * 0.18, 0, TAU); g.fill();
          } else {
            K.poly(g, [[xx - s, yy - s * 0.3], [xx - s * 0.2, yy - s * 0.8], [xx + s, yy - s * 0.4], [xx + s * 0.6, yy + s * 0.5], [xx - s * 0.5, yy + s * 0.7]]); g.fill();
            g.fillStyle = K.rgba(P.hi, 0.8);
            K.poly(g, [[xx - s, yy - s * 0.3], [xx - s * 0.2, yy - s * 0.8], [xx + s, yy - s * 0.4], [xx - s * 0.2, yy - s * 0.6]]); g.fill();
          }
        });
      }
    },
  ];

  /* ── near columns (transparent, NW wide, tile vertically; drawn on the open side) ── */
  const NEAR = [
    (g, w, h, P) => {
      bricksCol(g, 0, 84, h, P, 32);
      const r = rng(5);
      g.strokeStyle = '#2f6a2a'; g.lineWidth = 5;
      g.beginPath();
      for (let y = 0; y <= h; y += 16) { const x = 84 + Math.sin(y / h * TAU * 4) * 18; if (y) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
      for (let y = 8; y < h; y += 26) {
        const x = 84 + Math.sin(y / h * TAU * 4) * 18;
        g.fillStyle = r() < 0.5 ? '#3f9a3a' : '#5fbf5a';
        g.beginPath(); g.ellipse(x + (y % 52 ? 12 : -12), y, 12, 7, y % 52 ? 0.5 : -0.5, 0, TAU); g.fill();
      }
    },
    (g, w, h, P) => {
      g.fillStyle = P.dk;
      g.beginPath(); g.moveTo(0, 0);
      for (let y = 0; y <= h; y += 32) g.lineTo(70 + Math.abs(((y * 0.37) % 46) - 23) * 2.2 + Math.sin(y / h * TAU * 3) * 20, y);
      g.lineTo(0, h); g.closePath(); g.fill();
      const pts = [];
      for (let y = 0; y <= h; y += 40) pts.push([40 + Math.sin(y / h * TAU * 5) * 16, y]);
      glowLine(g, pts, P.accent, 2);
    },
    (g, w, h, P) => {
      const gr = g.createLinearGradient(0, 0, 110, 0);
      gr.addColorStop(0, P.stone); gr.addColorStop(1, P.hi);
      g.fillStyle = gr;
      g.fillRect(0, 0, 96, h);
      g.fillStyle = K.rgba('#ffffff', 0.5);
      g.fillRect(90, 0, 6, h);
      for (let y = 30; y < h; y += 90) {
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(80, y, 30, 12, 0, 0, TAU); g.fill();
        g.fillStyle = K.rgba('#e8f8ff', 0.95);
        for (let k = 0; k < 4; ++k) K.poly(g, [[60 + k * 12, y + 8], [70 + k * 12, y + 8], [65 + k * 12, y + 34 + (k % 2) * 22]]), g.fill();
      }
    },
    (g, w, h, P) => {
      g.fillStyle = OUT; g.fillRect(0, 0, 92, h);
      g.fillStyle = '#4a4a6a'; g.fillRect(0, 0, 22, h); g.fillRect(70, 0, 22, h);
      g.fillStyle = '#3a3a58'; g.fillRect(22, 0, 48, h);
      g.strokeStyle = '#5a5a80'; g.lineWidth = 6;
      for (let y = 0; y < h; y += 128) {
        g.beginPath(); g.moveTo(22, y); g.lineTo(70, y + 128); g.moveTo(70, y); g.lineTo(22, y + 128); g.stroke();
      }
      g.fillStyle = '#8a8ab0';
      for (let y = 8; y < h; y += 24) { g.fillRect(9, y, 4, 4); g.fillRect(79, y, 4, 4); }
      g.fillStyle = P.glow; g.fillRect(90, 0, 3, h);
    },
    (g, w, h, P) => {
      const r = rng(31);
      for (let y = -40; y < h + 40; y += 70) {
        const s = 0.8 + r() * 0.8;
        wrap(30, y, 60, 120, w, h, (xx, yy) => {
          g.fillStyle = P.stone;
          K.poly(g, [[xx - 30, yy + 60], [xx + 30 + 40 * s, yy - 40 * s], [xx + 50 * s, yy + 50]]); g.fill();
          g.fillStyle = K.rgba(P.hi, 0.85);
          K.poly(g, [[xx - 30, yy + 60], [xx + 30 + 40 * s, yy - 40 * s], [xx + 20, yy + 40]]); g.fill();
        });
      }
    },
  ];

  function bricksCol(g, x0, w, h, P, rowH) {
    g.fillStyle = P.mortar;
    g.fillRect(x0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += rowH, ++row) {
      const half = row % 2 ? w / 2 : 0;
      for (let x = x0 - half; x < x0 + w; x += w) {
        const a = Math.max(x0, x), b = Math.min(x0 + w, x + w);
        g.fillStyle = K.mix(P.dk, P.stone, 0.55 + ((row * 37) % 10) / 25);
        g.fillRect(a + 2, y + 2, b - a - 4, rowH - 4);
      }
    }
    g.fillStyle = K.rgba(P.hi, 0.6);
    g.fillRect(x0 + w - 4, 0, 4, h);
  }

  function layer(name, w) {
    const P = PAL[w];
    if (name === 'near') return tile('vnear:' + w, NW, TH, (g, sw, sh) => NEAR[w](g, sw, sh, P));
    const list = name === 'far' ? FAR : MID;
    return tile('v' + name + ':' + w, TW, TH, (g, sw, sh) => list[w](g, sw, sh, P));
  }

  /* real light from above (or the glow of lava and neon from below), stretched over the screen */
  function light(w) {
    return tile('vlight:' + w, 8, 256, (g, sw, sh) => {
      const P = PAL[w];
      const gr = g.createLinearGradient(0, 0, 0, sh);
      const lit = K.rgba(P.lightCol, 0.22), dark = 'rgba(6,4,16,0.38)';
      gr.addColorStop(0, P.light === 'top' ? lit : dark);
      gr.addColorStop(0.5, 'rgba(0,0,0,0)');
      gr.addColorStop(1, P.light === 'top' ? dark : lit);
      g.fillStyle = gr;
      g.fillRect(0, 0, sw, sh);
    });
  }

  /* ── course pieces for vertical stretches (course space: surface on top) ── */
  function wallTile(w) {
    return K.sprite('wall:' + w, 256, 240, (g, tw, th) => {
      const P = PAL[w];
      g.fillStyle = P.mortar;
      g.fillRect(0, 8, tw, th - 8);
      /* courses run across the slab: on screen they lie level when the run goes up or down */
      const cw = w === 3 ? 64 : 32;
      for (let x = 0, col = 0; x < tw; x += cw, ++col)
        for (let y = 14 + (col % 2) * 30; y < th + 60; y += 60) {
          const y0 = Math.max(14, y - 60), y1 = Math.min(th - 8, y);
          if (y1 - y0 < 4) continue;
          g.fillStyle = K.mix(P.dk, P.stone, 0.45 + ((col * 13 + y) % 9) / 20);
          g.fillRect(x + 2, y0 + 2, cw - 4, y1 - y0 - 4);
          if (w === 3 && (col + y) % 3) {
            g.fillStyle = (col + y) % 2 ? 'rgba(255,232,160,0.85)' : 'rgba(120,240,255,0.7)';
            g.fillRect(x + 12, y0 + 12, cw - 24, Math.max(4, y1 - y0 - 24));
          }
        }
      if (w === 1 || w === 4) {
        const r = rng(50 + w);
        const pts = [];
        let y = 30;
        for (let x = 0; x <= tw; x += 16) { pts.push([x, y]); y = Math.max(24, Math.min(th - 30, y + (r() - 0.5) * 40)); }
        pts[pts.length - 1][1] = pts[0][1];
        glowLine(g, pts, P.accent, 1.5);
      } else if (w === 2) {
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
        for (let x = 20; x < tw; x += 70) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 18, 70); g.lineTo(x + 6, 120); g.stroke(); }
      }
      /* the running face: a trim with studs */
      g.fillStyle = OUT; g.fillRect(0, 0, tw, 16);
      g.fillStyle = P.trim; g.fillRect(0, 1, tw, 12);
      g.fillStyle = P.trimHi; g.fillRect(0, 1, tw, 3);
      g.fillStyle = w === 3 ? P.glow : K.rgba(P.hi, 0.8);
      for (let x = 8; x < tw; x += 32) g.fillRect(x, 6, 6, 4);
      if (w === 3) { g.fillStyle = K.rgba(P.glow, 0.7); g.fillRect(0, 13, tw, 2); }
      /* the far side of the slab */
      g.fillStyle = P.edge;
      g.fillRect(0, th - 10, tw, 10);
      g.fillStyle = K.rgba('#000000', 0.25);
      g.fillRect(0, th - 40, tw, 30);
    });
  }

  function ledgeTile(w) {
    return K.sprite('vledge:' + w, 64, 34, (g, pw, ph) => {
      const P = PAL[w];
      g.fillStyle = OUT;
      K.roundRect(g, 0, 2, pw, ph - 4, 5); g.fill();
      g.fillStyle = P.trim;
      K.roundRect(g, 1, 4, pw - 2, ph - 8, 4); g.fill();
      g.fillStyle = P.trimHi;
      g.fillRect(2, 4, pw - 4, 4);
      g.fillStyle = K.rgba(P.dk, 0.8);
      g.fillRect(14, 12, 4, ph - 18); g.fillRect(46, 12, 4, ph - 18);
      g.fillStyle = w === 3 || w === 4 ? P.glow : K.rgba(P.hi, 0.9);
      g.fillRect(4, ph - 9, pw - 8, 2);
    });
  }

  /* paint the next missing piece of a world's vertical art; false once all are cached */
  const warmed = [0, 0, 0, 0, 0];
  const PIECES = [w => layer('far', w), w => layer('mid', w), w => layer('near', w), wallTile, ledgeTile, light];
  function warm(w) {
    if (warmed[w] >= PIECES.length) return false;
    PIECES[warmed[w]++](w);
    return true;
  }

  Object.assign(NS.vertArt, {
    TW, TH, NW, PAL, layer, light, wallTile, ledgeTile, warm
  });
})();
