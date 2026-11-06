/* Colony art, painted once per key: the 23 outpost buildings seen from above (bevelled steel
   plinths, panel seams, hazard trim, glass, coloured running lights and each building's own
   machinery), richer at higher levels; the moving parts drawn on top each frame (turret
   heads, the radar dish, the drill bit, the fusion torus); dark (unpowered or abandoned) and
   hijacked variants; deposits of ore, gas and crystal; and the strategy icon glyphs added to
   the shared icon set. Pure painting into cached canvases. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const K = NS.artKit;
  const { BUILDING_BY_ID } = NS.colonyData;
  const { ORE_BY_ID } = NS.ores;
  const TAU = Math.PI * 2;
  const CELL = 48;

  function metal(g, x0, y0, x1, y1, base) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, K.shade(base, 0.38));
    gr.addColorStop(0.45, base);
    gr.addColorStop(1, K.shade(base, -0.55));
    return gr;
  }

  /* a bevelled plate with seams */
  function plate(g, x, y, w, h, base, r) {
    const rr = r === undefined ? 4 : r;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    round(g, x + 2, y + 3, w, h, rr);
    g.fill();
    g.fillStyle = metal(g, x, y, x + w * 0.4, y + h, base);
    round(g, x, y, w, h, rr);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    round(g, x + 1, y + 1, w - 2, h - 2, rr);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    round(g, x + 0.5, y + 0.5, w - 1, h - 1, rr);
    g.stroke();
  }

  function round(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function disc(g, x, y, r, base) {
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(x + 1.5, y + 2.5, r, 0, TAU);
    g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r);
    gr.addColorStop(0, K.shade(base, 0.45));
    gr.addColorStop(0.6, base);
    gr.addColorStop(1, K.shade(base, -0.6));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.lineWidth = 1;
    g.stroke();
  }

  function glass(g, x, y, r, tint) {
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.05, x, y, r);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.25, K.shade(tint, 0.5));
    gr.addColorStop(0.7, tint);
    gr.addColorStop(1, K.shade(tint, -0.6));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1;
    g.stroke();
  }

  function light(g, x, y, r, color) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.3, color);
    gr.addColorStop(1, K.rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  }

  function seams(g, x, y, w, h, step, vertical) {
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    if (vertical) for (let xx = x + step; xx < x + w - 1; xx += step) { g.moveTo(xx, y + 2); g.lineTo(xx, y + h - 2); }
    else for (let yy = y + step; yy < y + h - 1; yy += step) { g.moveTo(x + 2, yy); g.lineTo(x + w - 2, yy); }
    g.stroke();
  }

  function hazard(g, x, y, w, h) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.fillStyle = '#1a1a1a';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#ffb000';
    for (let i = -h; i < w + h; i += 8) {
      g.beginPath();
      g.moveTo(x + i, y + h);
      g.lineTo(x + i + 4, y + h);
      g.lineTo(x + i + 4 + h, y);
      g.lineTo(x + i + h, y);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function pipe(g, pts, w, color) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = w + 2;
    g.beginPath();
    for (let i = 0; i < pts.length; ++i) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]);
    g.stroke();
    g.strokeStyle = color;
    g.lineWidth = w;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.lineWidth = Math.max(1, w * 0.3);
    g.stroke();
  }

  function crate(g, x, y, s, color) {
    g.fillStyle = metal(g, x, y, x + s, y + s, color);
    g.fillRect(x, y, s, s);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + s, y + s);
    g.moveTo(x + s, y);
    g.lineTo(x, y + s);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.stroke();
  }

  /* ── the buildings ── */
  const STEEL = '#5a6270', DARK = '#2a2e36', MID = '#454c58';

  const PAINT = {
    hub(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, DARK, 14);
      /* four arms with pads */
      for (let i = 0; i < 4; ++i) {
        g.save();
        g.translate(c, c);
        g.rotate(i * TAU / 4);
        plate(g, 18, -13, S / 2 - 26, 26, STEEL, 4);
        seams(g, 18, -13, S / 2 - 26, 26, 8, true);
        hazard(g, S / 2 - 16, -13, 6, 26);
        light(g, S / 2 - 20, -9, 1.6, col);
        light(g, S / 2 - 20, 9, 1.6, col);
        g.restore();
      }
      disc(g, c, c, 34 + lvl * 2, '#6a7484');
      g.strokeStyle = K.rgba(col, 0.8);
      g.lineWidth = 2;
      g.setLineDash([6, 4]);
      g.beginPath();
      g.arc(c, c, 28 + lvl * 2, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      glass(g, c, c, 18, '#3a7aa8');
      for (let i = 0; i < 8; ++i) {
        const a = i * TAU / 8 + TAU / 16;
        light(g, c + Math.cos(a) * (34 + lvl * 2), c + Math.sin(a) * (34 + lvl * 2), 1.5, i % 2 ? col : '#4fd8ff');
      }
      if (lvl >= 2) for (let i = 0; i < 4; ++i) {
        const a = i * TAU / 4 + TAU / 8;
        disc(g, c + Math.cos(a) * 46, c + Math.sin(a) * 46, 7, '#8a94a4');
        light(g, c + Math.cos(a) * 46, c + Math.sin(a) * 46, 1.4, '#ff5c6c');
      }
    },
    warehouse(g, S, c, lvl, col) {
      plate(g, 4, 4, S - 8, S - 8, MID, 5);
      const cols = ['#b88a4a', '#6a8aa8', '#a85a4a', '#7a9a5a'];
      for (let i = 0; i < 3 + lvl; ++i)
        for (let k = 0; k < 3; ++k) crate(g, 12 + k * 24, 12 + i * (64 / (3 + lvl)), 18, cols[(i + k) % 4]);
      hazard(g, 6, S - 14, S - 12, 6);
      light(g, S - 12, 10, 1.6, col);
    },
    habitat(g, S, c, lvl, col) {
      disc(g, c, c, S / 2 - 6, STEEL);
      disc(g, c, c, S / 2 - 18, DARK);
      for (let i = 0; i < 16; ++i) {
        const a = i * TAU / 16;
        g.fillStyle = i % 3 ? '#ffd890' : '#ffefc8';
        g.fillRect(c + Math.cos(a) * (S / 2 - 12) - 1.5, c + Math.sin(a) * (S / 2 - 12) - 1.5, 3, 3);
      }
      glass(g, c, c, S / 2 - 22, '#3a8a4a');
      g.fillStyle = 'rgba(160,255,140,0.5)';
      for (let i = 0; i < 6; ++i) g.fillRect(c - 10 + (i % 3) * 7, c - 6 + Math.floor(i / 3) * 8, 4, 4);
      if (lvl >= 2) { light(g, c - S / 2 + 10, c, 1.6, col); light(g, c + S / 2 - 10, c, 1.6, col); }
    },
    relay(g, S, c, lvl, col) {
      disc(g, c, c, 15, MID);
      g.strokeStyle = '#8a94a4';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(c - 13, c - 13); g.lineTo(c + 13, c + 13);
      g.moveTo(c + 13, c - 13); g.lineTo(c - 13, c + 13);
      g.stroke();
      glass(g, c, c, 7, col);
    },
    depot(g, S, c, lvl, col) {
      plate(g, 4, 4, S - 8, S - 8, MID, 5);
      g.strokeStyle = K.rgba(col, 0.7);
      g.lineWidth = 2;
      g.strokeRect(12, 12, 40, 40);
      for (let i = 0; i < 4; ++i) crate(g, 16 + (i % 2) * 18, 16 + Math.floor(i / 2) * 18, 14, i % 2 ? '#c8a040' : '#5a8ab0');
      pipe(g, [[S - 16, 14], [S - 16, S - 22], [S - 38, S - 22]], 5, '#8a7050');
      disc(g, S - 16, 14, 7, '#c8a040');
      light(g, S - 12, S - 12, 1.8, col);
    },
    rig(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, MID, 6);
      for (let i = 0; i < 4; ++i) {
        const x = i % 2 ? S - 16 : 8, y = i < 2 ? 8 : S - 16;
        plate(g, x, y, 8, 8, '#8a6a3a', 1);
      }
      g.strokeStyle = '#b07a3a';
      g.lineWidth = 3;
      g.strokeRect(16, 16, S - 32, S - 32);
      g.beginPath();
      g.moveTo(16, 16); g.lineTo(S - 16, S - 16);
      g.moveTo(S - 16, 16); g.lineTo(16, S - 16);
      g.stroke();
      const gr = g.createRadialGradient(c, c, 2, c, c, 18);
      gr.addColorStop(0, '#000');
      gr.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(c, c, 18, 0, TAU);
      g.fill();
      hazard(g, 8, S - 6, S - 16, 4);
      light(g, 12, 12, 1.5, col);
    },
    siphon(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, MID, 6);
      disc(g, c - 10, c - 8, 18, '#6a7a9a');
      glass(g, c - 10, c - 8, 9, col);
      disc(g, c + 16, c + 14, 11, '#5a6a8a');
      pipe(g, [[c - 10, c + 10], [c - 10, c + 24], [c + 6, c + 24], [c + 6, c + 14]], 4, '#8a94b0');
      pipe(g, [[c + 16, c + 2], [c + 16, c - 18], [S - 12, c - 18]], 4, '#8a94b0');
      light(g, S - 12, 12, 1.5, col);
    },
    harvester(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, MID, 6);
      for (let i = 0; i < 4; ++i) {
        const x = 18 + (i % 2) * 28, y = 18 + Math.floor(i / 2) * 28;
        disc(g, x, y, 10, '#4a5060');
        g.fillStyle = K.rgba(col, 0.85);
        g.beginPath();
        g.moveTo(x, y - 8); g.lineTo(x + 5, y); g.lineTo(x, y + 8); g.lineTo(x - 5, y);
        g.closePath();
        g.fill();
      }
      pipe(g, [[18, c], [S - 18, c]], 3, '#9a8aa0');
      pipe(g, [[c, 18], [c, S - 18]], 3, '#9a8aa0');
      light(g, c, c, 2.4, col);
    },
    smelter(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, '#4a4440', 6);
      plate(g, 14, 14, 40, 40, '#3a3430', 8);
      const gr = g.createRadialGradient(34, 34, 2, 34, 34, 16);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.3, '#ffd070');
      gr.addColorStop(0.7, '#ff5a1a');
      gr.addColorStop(1, '#3a0a00');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(34, 34, 14, 0, TAU);
      g.fill();
      disc(g, S - 18, 18, 8, '#5a5450');
      disc(g, S - 18, 36, 8, '#5a5450');
      g.fillStyle = '#111';
      g.beginPath(); g.arc(S - 18, 18, 4, 0, TAU); g.arc(S - 18, 36, 4, 0, TAU); g.fill();
      hazard(g, 14, S - 12, 40, 5);
    },
    refinery(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, MID, 6);
      const cols = [[22, 22, 12], [48, 24, 10], [26, 50, 10], [50, 50, 12]];
      pipe(g, [[22, 22], [48, 24], [50, 50], [26, 50], [22, 22]], 3, '#a08a50');
      for (let i = 0; i < cols.length; ++i) {
        disc(g, cols[i][0], cols[i][1], cols[i][2], '#8a8070');
        disc(g, cols[i][0], cols[i][1], cols[i][2] * 0.5, '#c8b070');
      }
      light(g, c, c, 2, col);
    },
    fabricator(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, MID, 6);
      g.fillStyle = '#1e2228';
      g.fillRect(12, c - 7, S - 24, 14);
      g.strokeStyle = 'rgba(255,255,255,0.15)';
      for (let x = 14; x < S - 14; x += 6) { g.beginPath(); g.moveTo(x, c - 7); g.lineTo(x, c + 7); g.stroke(); }
      for (let i = 0; i < 2; ++i) {
        const x = 22 + i * 26;
        disc(g, x, c - 18, 6, '#7a8494');
        pipe(g, [[x, c - 18], [x + 6, c - 8]], 3, '#9aa4b4');
        disc(g, x + 4, c + 18, 6, '#7a8494');
        pipe(g, [[x + 4, c + 18], [x - 2, c + 8]], 3, '#9aa4b4');
      }
      light(g, 12, 12, 1.5, col);
      light(g, S - 12, S - 12, 1.5, col);
    },
    solar(g, S, c, lvl, col) {
      plate(g, 4, 4, S - 8, S - 8, '#3a404a', 3);
      const n = 2 + lvl;
      const cw = (S - 16) / 2, ch = (S - 16) / n;
      for (let i = 0; i < 2; ++i)
        for (let k = 0; k < n; ++k) {
          const x = 8 + i * cw, y = 8 + k * ch;
          const gr = g.createLinearGradient(x, y, x + cw, y + ch);
          gr.addColorStop(0, '#5a9aff');
          gr.addColorStop(0.5, '#1a3a8a');
          gr.addColorStop(1, '#0a1a4a');
          g.fillStyle = gr;
          g.fillRect(x + 1, y + 1, cw - 2, ch - 2);
          g.strokeStyle = 'rgba(160,200,255,0.25)';
          g.lineWidth = 0.6;
          for (let q = 1; q < 4; ++q) {
            g.beginPath();
            g.moveTo(x + 1 + q * (cw - 2) / 4, y + 1); g.lineTo(x + 1 + q * (cw - 2) / 4, y + ch - 1);
            g.stroke();
          }
        }
      g.fillStyle = '#8a94a4';
      g.fillRect(c - 1.5, 6, 3, S - 12);
    },
    fusion(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, DARK, 10);
      disc(g, c, c, 28, '#6a7080');
      disc(g, c, c, 14, '#2a2e36');
      for (let i = 0; i < 12; ++i) {
        const a = i * TAU / 12;
        g.fillStyle = '#9aa4b4';
        g.fillRect(c + Math.cos(a) * 21 - 2, c + Math.sin(a) * 21 - 2, 4, 4);
      }
      for (let i = 0; i < 4; ++i) light(g, i % 2 ? S - 10 : 10, i < 2 ? 10 : S - 10, 1.4, col);
    },
    laser(g, S, c, lvl, col) {
      disc(g, c, c, S / 2 - 4, MID);
      hazard(g, c - 14, c + S / 2 - 9, 28, 4);
      for (let i = 0; i < 6; ++i) {
        const a = i * TAU / 6;
        g.fillStyle = '#1a1e24';
        g.beginPath(); g.arc(c + Math.cos(a) * (S / 2 - 8), c + Math.sin(a) * (S / 2 - 8), 1.6, 0, TAU); g.fill();
      }
    },
    flak(g, S, c, lvl, col) {
      plate(g, 4, 4, S - 8, S - 8, MID, 6);
      hazard(g, 6, 6, S - 12, 4);
      disc(g, c, c, 15, '#4a5260');
    },
    missile(g, S, c, lvl, col) {
      plate(g, 4, 4, S - 8, S - 8, MID, 6);
      plate(g, 12, 12, S - 24, S - 24, '#3a4048', 4);
      const n = 3;
      for (let i = 0; i < n; ++i)
        for (let k = 0; k < n; ++k) {
          const x = 20 + i * 14, y = 20 + k * 14;
          disc(g, x, y, 5, '#1a1e24');
          g.fillStyle = '#ff4a5a';
          g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
        }
      hazard(g, 6, S - 10, S - 12, 4);
    },
    shield(g, S, c, lvl, col) {
      disc(g, c, c, S / 2 - 6, MID);
      for (let i = 0; i < 3; ++i) {
        const a = i * TAU / 3 - Math.PI / 2;
        plate(g, c + Math.cos(a) * 22 - 6, c + Math.sin(a) * 22 - 6, 12, 12, '#7a8494', 3);
        light(g, c + Math.cos(a) * 22, c + Math.sin(a) * 22, 1.6, col);
      }
      glass(g, c, c, 12, '#58c8ff');
    },
    dronefactory(g, S, c, lvl, col) {
      plate(g, 4, 4, S - 8, S - 8, MID, 6);
      g.fillStyle = '#1a1e24';
      g.fillRect(12, 12, S - 24, 28);
      for (let i = 0; i < 4; ++i) { g.fillStyle = i % 2 ? '#3a4048' : '#4a5058'; g.fillRect(14 + i * 10, 14, 9, 24); }
      for (let i = 0; i < 2; ++i) {
        const x = 24 + i * 24, y = S - 20;
        g.strokeStyle = K.rgba(col, 0.8);
        g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, 8, 0, TAU); g.stroke();
        g.fillStyle = K.rgba(col, 0.4);
        g.fillRect(x - 1, y - 6, 2, 12);
      }
      light(g, S - 10, 10, 1.5, col);
    },
    shipyard(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, DARK, 8);
      g.fillStyle = '#14181e';
      g.fillRect(22, 22, S - 44, S - 44);
      /* gantries */
      for (let i = 0; i < 4; ++i) {
        const y = 26 + i * (S - 52) / 3;
        plate(g, 12, y - 4, S - 24, 8, '#6a7484', 2);
        hazard(g, 14, y - 1, 8, 2);
      }
      /* a hull taking shape */
      g.save();
      g.translate(c, c);
      g.fillStyle = 'rgba(120,180,220,0.35)';
      g.beginPath();
      g.moveTo(-40, -12); g.lineTo(30, -10); g.lineTo(44, 0); g.lineTo(30, 10); g.lineTo(-40, 12);
      g.closePath();
      g.fill();
      g.strokeStyle = K.rgba(col, 0.8);
      g.lineWidth = 1;
      g.stroke();
      g.restore();
      for (let i = 0; i < 6; ++i) light(g, 10 + (i % 2) * (S - 20), 18 + Math.floor(i / 2) * (S - 36) / 2, 1.5, col);
    },
    repairbay(g, S, c, lvl, col) {
      plate(g, 4, 4, S - 8, S - 8, MID, 6);
      disc(g, c, c, 24, '#3a4048');
      g.fillStyle = K.rgba(col, 0.85);
      g.fillRect(c - 4, c - 15, 8, 30);
      g.fillRect(c - 15, c - 4, 30, 8);
      for (let i = 0; i < 4; ++i) {
        const a = i * TAU / 4 + TAU / 8;
        pipe(g, [[c + Math.cos(a) * 28, c + Math.sin(a) * 28], [c + Math.cos(a) * 18, c + Math.sin(a) * 18]], 4, '#9aa4b4');
      }
      hazard(g, 6, 6, S - 12, 4);
    },
    radar(g, S, c, lvl, col) {
      disc(g, c, c, S / 2 - 6, MID);
      disc(g, c, c, 6, '#8a94a4');
    },
    lab(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, '#4a4e5a', 8);
      glass(g, 26, 28, 14, '#6a4ab8');
      glass(g, 50, 46, 10, '#5a3a9a');
      pipe(g, [[26, 28], [50, 46]], 4, '#9a8ab4');
      g.strokeStyle = '#c8b8f0';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(S - 16, 12); g.lineTo(S - 16, 30); g.stroke();
      light(g, S - 16, 12, 1.8, col);
    },
    medbay(g, S, c, lvl, col) {
      plate(g, 6, 6, S - 12, S - 12, '#8a929e', 10);
      plate(g, 14, 14, S - 28, S - 28, '#c8ced8', 8);
      g.fillStyle = col;
      g.fillRect(c - 4, c - 14, 8, 28);
      g.fillRect(c - 14, c - 4, 28, 8);
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.strokeRect(c - 4, c - 14, 8, 28);
      for (let i = 0; i < 4; ++i) light(g, i % 2 ? S - 12 : 12, i < 2 ? 12 : S - 12, 1.3, '#ffffff');
    },
  };

  /* a building sprite: footprint size x 48, one per type and level */
  function building(type, lvl) {
    const def = BUILDING_BY_ID[type];
    const S = def.size * CELL;
    return K.sprite('bld:' + type + ':' + lvl, S, S, (g) => {
      PAINT[type](g, S, S / 2, lvl, def.color);
      /* level badges on the rim */
      for (let i = 1; i < lvl; ++i) {
        g.fillStyle = '#ffd25a';
        g.beginPath();
        g.moveTo(S - 8 - i * 7, 3); g.lineTo(S - 4 - i * 7, 7); g.lineTo(S - 8 - i * 7, 11); g.lineTo(S - 12 - i * 7, 7);
        g.closePath();
        g.fill();
      }
    });
  }

  /* dark: unpowered or abandoned (no lights, cold steel) */
  function dark(type, lvl) {
    const base = building(type, lvl);
    return K.sprite('bldDark:' + type + ':' + lvl, base.w, base.h, (g, w, h) => {
      g.drawImage(base.canvas, 0, 0, w, h);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(6,8,16,0.62)';
      g.fillRect(0, 0, w, h);
    });
  }

  /* hijacked: Lattice green-teal, scan lines */
  function rogue(type, lvl) {
    const base = building(type, lvl);
    return K.sprite('bldRogue:' + type + ':' + lvl, base.w, base.h, (g, w, h) => {
      g.drawImage(base.canvas, 0, 0, w, h);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(20,90,80,0.45)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(58,255,208,0.35)';
      for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
      const n = K.valueNoise(NS.rng.hashString(type));
      g.fillStyle = 'rgba(58,255,208,0.8)';
      for (let i = 0; i < 18; ++i) g.fillRect(n(i, 1) * w, n(i, 2) * h, 2 + n(i, 3) * 6, 1.5);
    });
  }

  /* ── moving parts, facing +x ── */
  function head(kind) {
    return K.sprite('head:' + kind, 48, 48, (g) => {
      const c = 24;
      if (kind === 'laser') {
        plate(g, c - 6, c - 3, 22, 6, '#8a94a4', 2);
        g.fillStyle = '#ff6a3a';
        g.fillRect(c + 14, c - 1.5, 4, 3);
        disc(g, c, c, 9, '#6a7484');
        glass(g, c - 1, c, 4, '#ff6a3a');
      } else if (kind === 'flak') {
        plate(g, c, c - 7, 20, 4, '#8a94a4', 1);
        plate(g, c, c + 3, 20, 4, '#8a94a4', 1);
        disc(g, c, c, 11, '#7a6a4a');
        hazard(g, c - 6, c - 2, 10, 4);
      } else if (kind === 'radar') {
        g.fillStyle = metal(g, c - 18, c - 6, c + 4, c + 6, '#c8d0dc');
        g.beginPath();
        g.ellipse(c - 2, c, 6, 18, 0, -Math.PI / 2, Math.PI / 2);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.stroke();
        g.strokeStyle = '#8a94a4';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(c - 2, c); g.lineTo(c + 12, c); g.stroke();
        light(g, c + 12, c, 1.6, '#4fd8ff');
      } else if (kind === 'drill') {
        for (let i = 0; i < 3; ++i) {
          g.save();
          g.translate(c, c);
          g.rotate(i * TAU / 3);
          g.fillStyle = metal(g, 0, -4, 16, 4, '#c8a060');
          g.beginPath();
          g.moveTo(0, -4); g.lineTo(16, 0); g.lineTo(0, 4);
          g.closePath();
          g.fill();
          g.restore();
        }
        disc(g, c, c, 6, '#8a94a4');
      } else if (kind === 'torus') {
        const gr = g.createRadialGradient(c, c, 8, c, c, 22);
        gr.addColorStop(0, 'rgba(255,240,160,0)');
        gr.addColorStop(0.45, 'rgba(255,224,138,0.9)');
        gr.addColorStop(0.6, 'rgba(255,255,255,1)');
        gr.addColorStop(0.75, 'rgba(255,180,80,0.7)');
        gr.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 48, 48);
      }
    });
  }

  /* ── deposits ── */
  function deposit(kind, res) {
    const o = ORE_BY_ID[res];
    return K.sprite('dep:' + kind + ':' + res, 56, 56, (g) => {
      const c = 28;
      const n = K.valueNoise(NS.rng.hashString(res + kind));
      if (kind === 'gas') {
        for (let i = 0; i < 9; ++i) {
          const a = n(i, 1) * TAU, d = n(i, 2) * 12, r = 8 + n(i, 3) * 10;
          const gr = g.createRadialGradient(c + Math.cos(a) * d, c + Math.sin(a) * d, 0, c + Math.cos(a) * d, c + Math.sin(a) * d, r);
          gr.addColorStop(0, K.rgba(o.glow, 0.5));
          gr.addColorStop(1, K.rgba(o.color, 0));
          g.fillStyle = gr;
          g.fillRect(0, 0, 56, 56);
        }
        disc(g, c, c, 7, '#2a2e36');
        g.fillStyle = K.rgba(o.glow, 0.9);
        g.beginPath(); g.arc(c, c, 3.5, 0, TAU); g.fill();
      } else if (kind === 'crystal') {
        for (let i = 0; i < 7; ++i) {
          const a = n(i, 1) * TAU, d = 4 + n(i, 2) * 12, s = 6 + n(i, 3) * 9;
          const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
          g.fillStyle = K.mix(o.glow, o.color, n(i, 4));
          g.beginPath();
          g.moveTo(x, y - s); g.lineTo(x + s * 0.4, y); g.lineTo(x, y + s * 0.5); g.lineTo(x - s * 0.4, y);
          g.closePath();
          g.fill();
          g.strokeStyle = K.rgba(o.dark, 0.8);
          g.lineWidth = 0.8;
          g.stroke();
        }
      } else {
        for (let i = 0; i < 6; ++i) {
          const a = n(i, 1) * TAU, d = n(i, 2) * 14, r = 6 + n(i, 3) * 8;
          disc(g, c + Math.cos(a) * d, c + Math.sin(a) * d, r, '#5a5450');
          g.fillStyle = K.rgba(o.color, 0.9);
          g.beginPath(); g.arc(c + Math.cos(a) * d + 1, c + Math.sin(a) * d - 1, r * 0.4, 0, TAU); g.fill();
        }
      }
    });
  }

  /* ── strategy icons, added to the shared set ── */
  const P = NS.propArt.ICONS;
  Object.assign(P, {
    bolt(g) { g.beginPath(); g.moveTo(18, 2); g.lineTo(7, 18); g.lineTo(15, 18); g.lineTo(12, 30); g.lineTo(25, 13); g.lineTo(17, 13); g.closePath(); g.fill(); },
    habitat(g) { g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.stroke(); g.beginPath(); g.arc(16, 16, 5, 0, TAU); g.fill(); for (let i = 0; i < 6; ++i) { const a = i * TAU / 6; g.fillRect(16 + Math.cos(a) * 12 - 1.5, 16 + Math.sin(a) * 12 - 1.5, 3, 3); } },
    relay(g) { g.beginPath(); g.moveTo(16, 3); g.lineTo(8, 29); g.moveTo(16, 3); g.lineTo(24, 29); g.moveTo(10, 20); g.lineTo(22, 20); g.moveTo(12, 12); g.lineTo(20, 12); g.stroke(); g.beginPath(); g.arc(16, 4, 3, 0, TAU); g.fill(); },
    drill(g) { g.beginPath(); g.moveTo(9, 4); g.lineTo(23, 4); g.lineTo(23, 14); g.lineTo(16, 29); g.lineTo(9, 14); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(9, 10); g.lineTo(23, 14); g.moveTo(10, 16); g.lineTo(22, 19); g.stroke(); },
    siphon(g) { g.beginPath(); g.ellipse(16, 10, 10, 5, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(8, 12); g.lineTo(14, 26); g.lineTo(18, 26); g.lineTo(24, 12); g.stroke(); g.beginPath(); g.arc(16, 28, 2.5, 0, TAU); g.fill(); },
    flask(g) { g.beginPath(); g.moveTo(12, 4); g.lineTo(20, 4); g.moveTo(13, 4); g.lineTo(13, 13); g.lineTo(5, 27); g.lineTo(27, 27); g.lineTo(19, 13); g.lineTo(19, 4); g.stroke(); g.beginPath(); g.moveTo(9, 21); g.lineTo(23, 21); g.lineTo(26, 27); g.lineTo(6, 27); g.closePath(); g.fill(); },
    solar(g) { g.strokeRect(4, 8, 24, 16); g.beginPath(); g.moveTo(12, 8); g.lineTo(12, 24); g.moveTo(20, 8); g.lineTo(20, 24); g.moveTo(4, 16); g.lineTo(28, 16); g.moveTo(16, 24); g.lineTo(16, 30); g.stroke(); },
    missile(g) { g.beginPath(); g.moveTo(16, 2); g.lineTo(21, 10); g.lineTo(21, 24); g.lineTo(11, 24); g.lineTo(11, 10); g.closePath(); g.fill(); g.beginPath(); g.moveTo(11, 20); g.lineTo(6, 28); g.moveTo(21, 20); g.lineTo(26, 28); g.stroke(); },
    wrench(g) { g.beginPath(); g.moveTo(6, 26); g.lineTo(18, 14); g.stroke(); g.beginPath(); g.arc(22, 10, 7, 0.9, Math.PI * 2 + 0.2); g.stroke(); g.lineWidth = 4; g.beginPath(); g.moveTo(5, 27); g.lineTo(11, 21); g.stroke(); },
    serum(g) { g.beginPath(); g.moveTo(22, 4); g.lineTo(28, 10); g.moveTo(25, 7); g.lineTo(10, 22); g.lineTo(6, 26); g.moveTo(14, 12); g.lineTo(20, 18); g.stroke(); g.fillRect(9, 15, 7, 7); },
    fighter(g) { g.beginPath(); g.moveTo(28, 16); g.lineTo(6, 6); g.lineTo(11, 16); g.lineTo(6, 26); g.closePath(); g.fill(); },
    swarm(g) { for (let i = 0; i < 5; ++i) { const x = 7 + (i * 7) % 20, y = 8 + (i * 11) % 18; g.beginPath(); g.moveTo(x + 5, y); g.lineTo(x - 2, y - 3); g.lineTo(x, y); g.lineTo(x - 2, y + 3); g.closePath(); g.fill(); } },
    glitch(g) { g.fillRect(4, 6, 14, 3); g.fillRect(10, 11, 18, 3); g.fillRect(4, 16, 10, 3); g.fillRect(14, 21, 14, 3); g.fillRect(6, 26, 8, 2); },
    hive(g) { g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.stroke(); for (let i = 0; i < 5; ++i) { const a = i * TAU / 5; g.beginPath(); g.arc(16 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 2.6, 0, TAU); g.fill(); } },
    fLine(g) { for (let i = 0; i < 5; ++i) { g.beginPath(); g.arc(4 + i * 6, 16, 2.6, 0, TAU); g.fill(); } },
    fWedge(g) { const p = [[24, 16], [17, 11], [17, 21], [10, 6], [10, 26]]; for (let i = 0; i < p.length; ++i) { g.beginPath(); g.arc(p[i][0], p[i][1], 2.6, 0, TAU); g.fill(); } },
    fBox(g) { for (let i = 0; i < 9; ++i) { g.beginPath(); g.arc(8 + (i % 3) * 8, 8 + Math.floor(i / 3) * 8, 2.6, 0, TAU); g.fill(); } },
    fCircle(g) { for (let i = 0; i < 8; ++i) { const a = i * TAU / 8; g.beginPath(); g.arc(16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10, 2.6, 0, TAU); g.fill(); } },
    patrol(g) { g.beginPath(); g.moveTo(6, 11); g.lineTo(24, 11); g.lineTo(20, 6); g.moveTo(26, 21); g.lineTo(8, 21); g.lineTo(12, 26); g.stroke(); g.beginPath(); g.arc(6, 11, 2.5, 0, TAU); g.arc(26, 21, 2.5, 0, TAU); g.fill(); },
    move(g) { g.beginPath(); g.moveTo(4, 16); g.lineTo(26, 16); g.moveTo(19, 9); g.lineTo(26, 16); g.lineTo(19, 23); g.stroke(); },
    attack(g) { g.beginPath(); g.moveTo(5, 27); g.lineTo(23, 9); g.moveTo(17, 7); g.lineTo(25, 7); g.lineTo(25, 15); g.moveTo(9, 19); g.lineTo(13, 23); g.stroke(); },
    escort(g) { g.beginPath(); g.moveTo(16, 4); g.lineTo(23, 16); g.lineTo(9, 16); g.closePath(); g.fill(); g.beginPath(); g.arc(8, 25, 3, 0, TAU); g.arc(24, 25, 3, 0, TAU); g.fill(); },
    home(g) { g.beginPath(); g.moveTo(4, 16); g.lineTo(16, 5); g.lineTo(28, 16); g.moveTo(8, 13); g.lineTo(8, 27); g.lineTo(24, 27); g.lineTo(24, 13); g.stroke(); g.fillRect(13, 19, 6, 8); },
    hold(g) { g.fillRect(8, 6, 5, 20); g.fillRect(19, 6, 5, 20); },
    upgrade(g) { g.beginPath(); g.moveTo(16, 4); g.lineTo(27, 16); g.lineTo(20, 16); g.lineTo(20, 28); g.lineTo(12, 28); g.lineTo(12, 16); g.lineTo(5, 16); g.closePath(); g.fill(); },
    demolish(g) { g.beginPath(); g.moveTo(6, 6); g.lineTo(26, 26); g.moveTo(26, 6); g.lineTo(6, 26); g.stroke(); },
    quarantine(g) { g.strokeRect(5, 5, 22, 22); g.beginPath(); g.moveTo(5, 5); g.lineTo(27, 27); g.stroke(); },
    pause(g) { g.fillRect(9, 6, 5, 20); g.fillRect(18, 6, 5, 20); },
    command(g) { g.strokeRect(4, 4, 24, 24); g.beginPath(); g.moveTo(16, 4); g.lineTo(16, 28); g.moveTo(4, 16); g.lineTo(28, 16); g.stroke(); g.beginPath(); g.arc(22, 10, 2.5, 0, TAU); g.arc(10, 22, 2.5, 0, TAU); g.fill(); },
    crew(g) { g.beginPath(); g.arc(16, 10, 5, 0, TAU); g.fill(); g.beginPath(); g.moveTo(6, 28); g.quadraticCurveTo(16, 12, 26, 28); g.closePath(); g.fill(); },
    lock(g) { g.beginPath(); g.arc(16, 12, 6, Math.PI, 0); g.stroke(); g.fillRect(8, 13, 16, 13); },
    log(g) { g.strokeRect(7, 4, 18, 24); g.beginPath(); for (let i = 0; i < 4; ++i) { g.moveTo(11, 10 + i * 5); g.lineTo(21, 10 + i * 5); } g.stroke(); },
  });

  Object.assign(NS.colonyArt, {
    CELL, building, dark, rogue, head, deposit, plate, disc, glass, light, metal, hazard, pipe
  });
})();
