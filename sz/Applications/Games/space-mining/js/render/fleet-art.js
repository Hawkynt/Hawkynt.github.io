/* Fleet art, painted once per key and facing +x: the seven outpost craft in steel with their
   role colour, the deserter (Lattice) tint, the invaders - Bloom organisms (swarmer, brood
   carrier, hive nest, mothership) grown over Lattice frames, rust-red pirate craft (raider,
   bomber, shielded frigate, siege ship) and the cyan Lattice drone - plus nebula gas and Bloom
   clouds and the silent distress station. Pure painting into cached canvases. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const K = NS.artKit;
  const { UNIT_BY_ID, ENEMY_BY_ID } = NS.fleetData;
  const { ORE_BY_ID } = NS.ores;
  const TAU = Math.PI * 2;

  function metal(g, x0, y0, x1, y1, base) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, K.shade(base, 0.45));
    gr.addColorStop(0.5, base);
    gr.addColorStop(1, K.shade(base, -0.55));
    return gr;
  }

  function part(g, c, pts, col, edge) {
    K.poly(g, pts.map(p => [c + p[0], c + p[1]]));
    g.fillStyle = metal(g, c, c - 20, c + 6, c + 20, col);
    g.fill();
    g.strokeStyle = edge || 'rgba(0,0,0,0.7)';
    g.lineWidth = 1;
    g.stroke();
  }

  function dot(g, x, y, r, color) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.35, color);
    gr.addColorStop(1, K.rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  }

  function canopy(g, x, y, rx, ry, tint) {
    const gr = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.3, tint);
    gr.addColorStop(1, K.shade(tint, -0.6));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
  }

  const STEEL = '#7a8494', DARK = '#3a404a';

  /* ── outpost craft ── */
  const UNIT_PAINT = {
    miner(g, c, col) {
      part(g, c, [[-9, -6], [6, -5], [10, 0], [6, 5], [-9, 6]], STEEL);
      part(g, c, [[-4, -10], [2, -10], [2, -6], [-4, -6]], DARK);
      part(g, c, [[-4, 10], [2, 10], [2, 6], [-4, 6]], DARK);
      canopy(g, c + 3, c, 3, 2.4, col);
      dot(g, c - 8, c, 1.4, col);
    },
    mender(g, c, col) {
      part(g, c, [[-8, -7], [6, -7], [9, 0], [6, 7], [-8, 7]], '#9aa4b0');
      g.fillStyle = col;
      g.fillRect(c - 3, c - 5, 3, 10);
      g.fillRect(c - 6, c - 1.5, 9, 3);
      part(g, c, [[6, -9], [11, -8], [11, -5], [6, -5]], DARK);
      part(g, c, [[6, 9], [11, 8], [11, 5], [6, 5]], DARK);
    },
    purger(g, c, col) {
      part(g, c, [[-12, -8], [6, -8], [12, -3], [12, 3], [6, 8], [-12, 8]], '#c8d0dc');
      part(g, c, [[12, -2], [18, -1], [18, 1], [12, 2]], '#8a94a4');
      g.fillStyle = '#ffb000';
      g.fillRect(c - 10, c - 8, 14, 2);
      g.fillRect(c - 10, c + 6, 14, 2);
      canopy(g, c, c, 4, 3, col);
    },
    fighter(g, c, col) {
      part(g, c, [[-12, -4], [-4, -12], [2, -12], [-2, -4]], DARK);
      part(g, c, [[-12, 4], [-4, 12], [2, 12], [-2, 4]], DARK);
      part(g, c, [[-12, -4], [6, -3], [15, 0], [6, 3], [-12, 4], [-14, 0]], STEEL);
      g.fillStyle = col;
      g.fillRect(c - 6, c - 11, 6, 2);
      g.fillRect(c - 6, c + 9, 6, 2);
      canopy(g, c + 4, c, 4, 2, '#7ac8ff');
    },
    gunboat(g, c, col) {
      part(g, c, [[-16, -12], [8, -12], [16, -6], [16, 6], [8, 12], [-16, 12], [-19, 0]], '#6a7080');
      part(g, c, [[-12, -8], [6, -8], [6, 8], [-12, 8]], DARK);
      g.fillStyle = col;
      g.fillRect(c - 14, c - 12, 18, 2.5);
      g.fillRect(c - 14, c + 9.5, 18, 2.5);
      g.fillStyle = metal(g, c, c - 3, c + 20, c + 3, '#9aa4b4');
      g.fillRect(c, c - 2.5, 22, 5);
      g.beginPath();
      g.arc(c - 2, c, 6, 0, TAU);
      g.fillStyle = metal(g, c - 8, c - 6, c + 4, c + 6, '#8a94a4');
      g.fill();
    },
    escort(g, c, col) {
      part(g, c, [[-20, -10], [10, -12], [22, -4], [22, 4], [10, 12], [-20, 10], [-23, 0]], '#8a94a4');
      part(g, c, [[-14, -18], [4, -18], [8, -12], [-14, -12]], DARK);
      part(g, c, [[-14, 18], [4, 18], [8, 12], [-14, 12]], DARK);
      for (let i = -1; i <= 1; i += 2) {
        g.beginPath();
        g.arc(c - 4, c + i * 15, 3.5, 0, TAU);
        g.fillStyle = col;
        g.fill();
      }
      canopy(g, c + 12, c, 5, 3, '#9ac4ff');
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = -14; x < 8; x += 6) g.fillRect(c + x, c - 8, 1, 16);
    },
    transport(g, c, col) {
      part(g, c, [[-22, -12], [14, -12], [22, -5], [22, 5], [14, 12], [-22, 12]], '#6a6a72');
      for (let i = 0; i < 3; ++i)
        for (let k = 0; k < 2; ++k) {
          const x = c - 19 + i * 10, y = c - 10 + k * 10;
          g.fillStyle = metal(g, x, y, x + 8, y + 8, k ? '#c8a040' : '#5a8ab0');
          g.fillRect(x, y, 8, 8);
          g.strokeStyle = 'rgba(0,0,0,0.5)';
          g.strokeRect(x + 0.5, y + 0.5, 7, 7);
        }
      canopy(g, c + 16, c, 4, 4, '#ffe0a0');
      g.fillStyle = col;
      g.fillRect(c + 10, c - 12, 3, 24);
    },
  };

  function unit(type, rogue) {
    const def = UNIT_BY_ID[type];
    const S = Math.ceil(def.r * 3.2 + 12);
    return K.sprite('unit:' + type + (rogue ? ':r' : ''), S, S, (g, w) => {
      UNIT_PAINT[type](g, w / 2, rogue ? '#3affd0' : def.color);
      if (rogue) {
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(30,140,120,0.45)';
        g.fillRect(0, 0, w, w);
        g.fillStyle = 'rgba(58,255,208,0.5)';
        for (let y = 0; y < w; y += 3) g.fillRect(0, y, w, 0.8);
      }
    });
  }

  /* ── invaders ── */
  function organic(g, c, rx, ry, base, dark, n) {
    const gr = g.createRadialGradient(c - rx * 0.3, c - ry * 0.3, 1, c, c, Math.max(rx, ry));
    gr.addColorStop(0, K.shade(base, 0.35));
    gr.addColorStop(0.6, base);
    gr.addColorStop(1, dark);
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i <= 32; ++i) {
      const a = i / 32 * TAU;
      const wob = 1 + (n ? (n(i % 32, 3) - 0.5) * 0.18 : 0);
      const x = c + Math.cos(a) * rx * wob, y = c + Math.sin(a) * ry * wob;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(20,0,30,0.7)';
    g.lineWidth = 1.2;
    g.stroke();
  }

  function veins(g, c, r, color, n, count) {
    g.strokeStyle = K.rgba(color, 0.6);
    g.lineWidth = 1;
    for (let i = 0; i < count; ++i) {
      const a = n(i, 1) * TAU;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * r * 0.2, c + Math.sin(a) * r * 0.2);
      g.quadraticCurveTo(c + Math.cos(a + 0.4) * r * 0.6, c + Math.sin(a + 0.4) * r * 0.6, c + Math.cos(a) * r * 0.9, c + Math.sin(a) * r * 0.9);
      g.stroke();
    }
  }

  function lattice(g, c, r) {
    g.strokeStyle = 'rgba(58,255,208,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < 6; ++i) {
      const a = i * TAU / 6;
      g.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      g.lineTo(c + Math.cos(a + TAU / 3) * r, c + Math.sin(a + TAU / 3) * r);
    }
    g.stroke();
  }

  const RUST = '#b03028', BLACK = '#24181a', BONE = '#d8c8b0';

  const ENEMY_PAINT = {
    swarmer(g, c, d, n) {
      g.fillStyle = 'rgba(200,140,255,0.35)';
      g.beginPath(); g.ellipse(c - 2, c - 7, 7, 3, -0.5, 0, TAU); g.ellipse(c - 2, c + 7, 7, 3, 0.5, 0, TAU); g.fill();
      organic(g, c, 9, 5, '#9a40d0', '#2a0a3a', n);
      dot(g, c + 6, c - 2, 1.2, '#ff8ae0');
      dot(g, c + 6, c + 2, 1.2, '#ff8ae0');
    },
    raider(g, c) {
      part(g, c, [[-20, -16], [6, -13], [12, -9], [-16, -7]], BLACK);
      part(g, c, [[-20, 16], [6, 13], [12, 9], [-16, 7]], BLACK);
      part(g, c, [[-18, -8], [6, -7], [20, 0], [6, 7], [-18, 8], [-22, 0]], RUST);
      part(g, c, [[-6, -3], [8, -2], [8, 2], [-6, 3]], BONE);
    },
    bomber(g, c) {
      part(g, c, [[-14, -26], [10, -10], [14, 0], [10, 10], [-14, 26], [-20, 20], [-10, 0], [-20, -20]], BLACK);
      part(g, c, [[-16, -8], [14, -6], [22, 0], [14, 6], [-16, 8]], RUST);
      g.fillStyle = '#1a1010';
      g.fillRect(c - 8, c - 4, 12, 8);
      g.fillStyle = '#ffb000';
      for (let i = 0; i < 3; ++i) g.fillRect(c - 7 + i * 4, c - 3, 2, 6);
    },
    frigate(g, c) {
      part(g, c, [[-30, -18], [14, -22], [30, -8], [30, 8], [14, 22], [-30, 18], [-36, 0]], RUST);
      part(g, c, [[-22, -10], [16, -12], [24, 0], [16, 12], [-22, 10]], BLACK);
      for (let i = -1; i <= 1; i += 2) {
        g.beginPath();
        g.arc(c - 6, c + i * 18, 5, 0, TAU);
        g.fillStyle = metal(g, c - 11, c + i * 18 - 5, c - 1, c + i * 18 + 5, '#58a8ff');
        g.fill();
      }
      part(g, c, [[24, -3], [38, -2], [38, 2], [24, 3]], '#6a6a72');
      g.fillStyle = BONE;
      g.fillRect(c - 16, c - 2, 18, 4);
    },
    carrier(g, c, d, n) {
      organic(g, c, 42, 30, '#7a2aa8', '#1a0628', n);
      lattice(g, c, 30);
      veins(g, c, 40, '#ff8ae0', n, 9);
      for (let i = 0; i < 5; ++i) {
        const a = Math.PI * 0.6 + i * 0.25;
        const x = c + Math.cos(a) * 30, y = c + Math.sin(a) * 22;
        const gr = g.createRadialGradient(x, y, 0, x, y, 7);
        gr.addColorStop(0, '#ffd0f4');
        gr.addColorStop(0.5, '#d050c0');
        gr.addColorStop(1, 'rgba(80,0,60,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill();
      }
      dot(g, c + 30, c, 3, '#ff8ae0');
    },
    siege(g, c) {
      part(g, c, [[-34, -14], [20, -16], [28, -8], [28, 8], [20, 16], [-34, 14], [-40, 0]], RUST);
      part(g, c, [[-28, -22], [0, -22], [6, -16], [-28, -16]], BLACK);
      part(g, c, [[-28, 22], [0, 22], [6, 16], [-28, 16]], BLACK);
      part(g, c, [[0, -5], [44, -4], [44, 4], [0, 5]], '#7a7a82');
      part(g, c, [[38, -6], [46, -6], [46, 6], [38, 6]], '#4a4a52');
      g.fillStyle = '#ffb000';
      g.fillRect(c - 26, c - 2, 20, 4);
    },
    nanoswarm(g, c, d, n) {
      for (let i = 0; i < 40; ++i) {
        const a = n(i, 1) * TAU, r = Math.pow(n(i, 2), 0.6) * 15;
        g.fillStyle = K.rgba(i % 4 ? '#3affd0' : '#ffffff', 0.6 + n(i, 3) * 0.4);
        g.fillRect(c + Math.cos(a) * r - 1, c + Math.sin(a) * r - 1, 2, 2);
      }
      lattice(g, c, 9);
    },
    nanodrone(g, c) {
      part(g, c, [[-9, -9], [10, 0], [-9, 9], [-5, 0]], '#1e5a52', 'rgba(58,255,208,0.9)');
      part(g, c, [[-12, -3], [-6, -3], [-6, 3], [-12, 3]], '#0e2a28', 'rgba(58,255,208,0.7)');
      dot(g, c + 2, c, 1.6, '#3affd0');
    },
    hive(g, c, d, n) {
      const pal = ['#5a4a52', '#3a2a34', '#1a1018'];
      organic(g, c, 46, 44, pal[0], pal[2], n);
      for (let i = 0; i < 9; ++i) {
        const a = n(i, 1) * TAU, r = 8 + n(i, 2) * 26;
        const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r, s = 3 + n(i, 3) * 5;
        const gr = g.createRadialGradient(x, y, 0, x, y, s);
        gr.addColorStop(0, '#ffe0f8');
        gr.addColorStop(0.4, '#ff6ad0');
        gr.addColorStop(1, '#2a0a20');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
      }
      veins(g, c, 44, '#ff8ae0', n, 12);
    },
    mothership(g, c, d, n) {
      organic(g, c, 100, 62, '#6a2a90', '#14041e', n);
      /* the Lattice frame under the growth */
      g.strokeStyle = 'rgba(58,255,208,0.5)';
      g.lineWidth = 2;
      for (let i = -3; i <= 3; ++i) {
        g.beginPath();
        g.moveTo(c - 80, c + i * 14);
        g.lineTo(c + 80, c + i * 14 * 0.6);
        g.stroke();
      }
      veins(g, c, 96, '#ff8ae0', n, 22);
      for (let i = 0; i < 3; ++i) {
        const a = (i - 1) * 1.2;
        const x = c + Math.cos(a) * 70, y = c + Math.sin(a) * 44;
        g.fillStyle = metal(g, x - 10, y - 10, x + 10, y + 10, '#4a3a5a');
        g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
        dot(g, x, y, 3, '#e080ff');
      }
      for (let i = 0; i < 7; ++i) {
        const x = c - 70 + i * 10, y = c + (i % 2 ? 26 : -26);
        dot(g, x, y, 3, '#ff8ae0');
      }
      /* the brood heart: a ribbed sac with a hot core */
      const gr = g.createRadialGradient(c + 18, c, 2, c + 18, c, 26);
      gr.addColorStop(0, '#ffe0f8');
      gr.addColorStop(0.25, '#e060c8');
      gr.addColorStop(0.7, '#6a1a7a');
      gr.addColorStop(1, 'rgba(60,10,70,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(c + 18, c, 26, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,0,40,0.6)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 5; ++i) { g.beginPath(); g.arc(c + 18, c, 8 + i * 4, -1.2, 1.2); g.stroke(); }
      /* armour plates on the flanks */
      for (let i = -1; i <= 1; i += 2)
        for (let k = 0; k < 5; ++k) {
          const x = c - 60 + k * 22, y = c + i * (40 - Math.abs(k - 2) * 4);
          g.fillStyle = metal(g, x - 9, y - 6, x + 9, y + 6, '#5a3a6a');
          g.beginPath(); g.ellipse(x, y, 10, 6, 0, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(20,0,30,0.7)';
          g.lineWidth = 1;
          g.stroke();
        }
    },
  };

  function enemy(type, tint) {
    const def = ENEMY_BY_ID[type];
    const S = Math.ceil(def.r * 2.6 + 16);
    return K.sprite('enemy:' + type + (tint ? ':' + tint : ''), S, S, (g, w) => {
      const n = K.valueNoise(NS.rng.hashString(type + (tint || '')));
      ENEMY_PAINT[type](g, w / 2, def, n);
      if (tint) {
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = K.rgba(tint, 0.28);
        g.fillRect(0, 0, w, w);
      }
    });
  }

  /* ── clouds and the silent station ── */
  function cloud(res, bio, seed) {
    const o = ORE_BY_ID[res];
    return K.sprite('cloud:' + res + ':' + (seed % 4), 200, 200, (g, w) => {
      const c = w / 2;
      const n = K.valueNoise(seed % 4 + (bio ? 50 : 10));
      for (let i = 0; i < 22; ++i) {
        const a = n(i, 1) * TAU, d = Math.sqrt(n(i, 2)) * 48;
        const r = 26 + n(i, 3) * 30;
        const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, K.rgba(o.glow, bio ? 0.22 : 0.16));
        gr.addColorStop(0.6, K.rgba(o.color, bio ? 0.1 : 0.07));
        gr.addColorStop(1, K.rgba(o.color, 0));
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (bio) for (let i = 0; i < 40; ++i) {
        const a = n(i, 5) * TAU, d = Math.sqrt(n(i, 6)) * 70;
        g.fillStyle = K.rgba(i % 3 ? '#e0ffb0' : '#9ae04a', 0.7);
        g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 0.8 + n(i, 7) * 1.6, 0, TAU); g.fill();
      }
    });
  }

  function station(kind) {
    return K.sprite('silent:' + kind, 220, 220, (g, w) => {
      const c = w / 2;
      const A = NS.colonyArt;
      g.save();
      g.translate(c - 72, c - 72);
      g.drawImage(A.dark('hub', 2).canvas, 0, 0, 144, 144);
      g.restore();
      g.drawImage(A.dark('habitat', 1).canvas, c + 50, c - 90, 96, 96);
      g.drawImage(A.dark('solar', 1).canvas, c - 140, c + 30, 96, 96);
      const n = K.valueNoise(kind === 'bloom' ? 77 : 99);
      if (kind === 'bloom') {
        for (let i = 0; i < 30; ++i) {
          const a = n(i, 1) * TAU, d = n(i, 2) * 90, r = 4 + n(i, 3) * 12;
          const gr = g.createRadialGradient(c + Math.cos(a) * d, c + Math.sin(a) * d, 0, c + Math.cos(a) * d, c + Math.sin(a) * d, r);
          gr.addColorStop(0, 'rgba(200,255,140,0.7)');
          gr.addColorStop(0.5, 'rgba(110,190,60,0.5)');
          gr.addColorStop(1, 'rgba(40,80,20,0)');
          g.fillStyle = gr;
          g.fillRect(0, 0, w, w);
        }
      } else {
        g.fillStyle = 'rgba(58,255,208,0.55)';
        for (let i = 0; i < 40; ++i) g.fillRect(n(i, 1) * w, n(i, 2) * w, 2 + n(i, 3) * 14, 1.5);
        g.strokeStyle = 'rgba(58,255,208,0.35)';
        for (let i = 0; i < 8; ++i) {
          g.beginPath();
          g.moveTo(n(i, 4) * w, n(i, 5) * w);
          g.lineTo(n(i, 6) * w, n(i, 7) * w);
          g.stroke();
        }
      }
    });
  }

  Object.assign(NS.fleetArt, {
    unit, enemy, cloud, station
  });
})();
