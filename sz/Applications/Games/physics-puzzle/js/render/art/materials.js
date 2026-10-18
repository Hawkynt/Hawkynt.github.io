;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});
  const A = NS.art || (NS.art = {});

  /*
   * Material fills for the field art, painted inside a clip of a body's
   * shape: wood boards with grain and knots, stone blocks, riveted steel,
   * frosted ice, bevels, and each world's ground slab with its decorated top.
   * Reads the sprite kit; owns no state.
   */

  const TWO_PI = A.TWO_PI, rgba = A.rgba, shade = A.shade, roundRect = A.roundRect;

  /* ══════════════════════════════════════════════════════════════════
     MATERIAL FILLS (painted inside a clip of the body's shape)
     ══════════════════════════════════════════════════════════════════ */

  const WOOD = [
    { base: '#b8783e', dark: '#6a3e1a', light: '#e0a868' },   // workshop oak
    { base: '#a8743a', dark: '#5a3a18', light: '#d8a060' },   // garden cedar
    { base: '#8a8a90', dark: '#3a3a44', light: '#c8c8d0' },
    { base: '#7a4a2a', dark: '#3a2010', light: '#b07040' },
    { base: '#9a9aa8', dark: '#40404c', light: '#d0d0dc' }
  ];

  const METAL = [
    { base: '#8a96a8', dark: '#3a4250', light: '#dce4f0', rivet: '#c8d0dc' },   // workshop steel
    { base: '#7a8a7a', dark: '#2e3a30', light: '#c8d8c0', rivet: '#c8d0b8' },   // garden green iron
    { base: '#8ab0cc', dark: '#2a4258', light: '#e8f6ff', rivet: '#dceeff' },   // lab blue steel
    { base: '#4a4044', dark: '#16100e', light: '#9a8a84', rivet: '#c8a888' },   // forge black iron
    { base: '#b8c0d0', dark: '#4a5266', light: '#ffffff', rivet: '#e8ecf4' }    // station white panel
  ];

  function woodFill(g, x, y, w, h, world, rand, vertical) {
    const p = WOOD[world] || WOOD[0];
    g.fillStyle = p.base;
    g.fillRect(x, y, w, h);
    /* boards */
    const along = vertical ? h : w, across = vertical ? w : h;
    const boardW = across > 40 ? 18 + Math.floor(rand() * 6) : across;
    for (let b = 0; b < across; b += boardW) {
      const tint = (rand() - 0.5) * 0.18;
      g.fillStyle = shade(p.base, tint);
      if (vertical)
        g.fillRect(x + b, y, Math.min(boardW, across - b), h);
      else
        g.fillRect(x, y + b, w, Math.min(boardW, across - b));
      /* grain */
      g.strokeStyle = rgba(p.dark, 0.28);
      g.lineWidth = 0.8;
      const lines = Math.max(2, Math.floor(Math.min(boardW, across - b) / 3));
      for (let l = 0; l < lines; ++l) {
        const off = b + (l + 0.5) * Math.min(boardW, across - b) / lines;
        const amp = 0.6 + rand() * 1.4, freq = 0.02 + rand() * 0.04, ph = rand() * 6;
        g.beginPath();
        for (let t = 0; t <= along; t += 6) {
          const d = off + Math.sin(t * freq + ph) * amp;
          if (vertical) {
            if (t === 0) g.moveTo(x + d, y + t); else g.lineTo(x + d, y + t);
          } else {
            if (t === 0) g.moveTo(x + t, y + d); else g.lineTo(x + t, y + d);
          }
        }
        g.stroke();
      }
      /* a knot now and then */
      if (along > 60 && rand() < 0.5) {
        const kt = rand() * along, kc = b + Math.min(boardW, across - b) * (0.3 + rand() * 0.4);
        const kx = vertical ? x + kc : x + kt, ky = vertical ? y + kt : y + kc;
        g.fillStyle = rgba(p.dark, 0.5);
        g.beginPath();
        g.ellipse(kx, ky, vertical ? 2.2 : 4, vertical ? 4 : 2.2, 0, 0, TWO_PI);
        g.fill();
      }
      /* the seam between boards */
      if (b > 0) {
        g.fillStyle = rgba(p.dark, 0.55);
        if (vertical)
          g.fillRect(x + b - 0.6, y, 1.2, h);
        else
          g.fillRect(x, y + b - 0.6, w, 1.2);
      }
    }
    /* end joints along long boards */
    if (along > 160) {
      g.fillStyle = rgba(p.dark, 0.5);
      for (let b = 0; b < across; b += boardW) {
        const j = 60 + rand() * (along - 120);
        if (vertical)
          g.fillRect(x + b, y + j, Math.min(boardW, across - b), 1.2);
        else
          g.fillRect(x + j, y + b, 1.2, Math.min(boardW, across - b));
      }
    }
  }

  function stoneFill(g, x, y, w, h, world, rand) {
    const base = world === 3 ? '#4a3c38' : world === 1 ? '#8a7a64' : '#7a7470';
    g.fillStyle = shade(base, -0.35);
    g.fillRect(x, y, w, h);
    const bh = 22;
    for (let row = 0, yy = y; yy < y + h; ++row, yy += bh) {
      let xx = x - (row % 2 ? 18 : 0);
      while (xx < x + w) {
        const bw = 30 + rand() * 26;
        const tint = (rand() - 0.5) * 0.2;
        g.fillStyle = shade(base, tint);
        roundRect(g, xx + 1.2, yy + 1.2, bw - 2.4, bh - 2.4, 4);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(xx + 3, yy + 2, bw - 8, 2);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(xx + 3, yy + bh - 5, bw - 6, 2.4);
        /* speckles */
        for (let k = 0; k < 4; ++k) {
          g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
          g.fillRect(xx + rand() * bw, yy + 3 + rand() * (bh - 6), 1.6, 1.6);
        }
        xx += bw;
      }
    }
    if (world === 3) {
      /* glowing cracks in the forge's basalt */
      g.strokeStyle = 'rgba(255,120,40,0.55)';
      g.lineWidth = 1.2;
      for (let k = 0; k < Math.max(1, w / 90); ++k) {
        let cx = x + rand() * w, cy = y + 6 + rand() * Math.min(h - 6, 60);
        g.beginPath();
        g.moveTo(cx, cy);
        for (let s = 0; s < 4; ++s) {
          cx += (rand() - 0.5) * 22;
          cy += 4 + rand() * 8;
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
    }
  }

  function metalFill(g, x, y, w, h, world, rand) {
    const p = METAL[world] || METAL[0];
    const lg = g.createLinearGradient(x, y, x, y + h);
    lg.addColorStop(0, p.light);
    lg.addColorStop(0.18, p.base);
    lg.addColorStop(0.75, shade(p.base, -0.2));
    lg.addColorStop(1, p.dark);
    g.fillStyle = lg;
    g.fillRect(x, y, w, h);
    /* brushed streaks */
    for (let k = 0; k < Math.min(60, (w + h) / 4); ++k) {
      g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
      if (w >= h)
        g.fillRect(x + rand() * w, y + rand() * h, 20 + rand() * 60, 0.8);
      else
        g.fillRect(x + rand() * w, y + rand() * h, 0.8, 20 + rand() * 60);
    }
    /* panel seams on long pieces */
    const long = Math.max(w, h);
    if (long > 120) {
      const n = Math.round(long / 110);
      g.fillStyle = rgba(p.dark, 0.6);
      for (let i = 1; i < n; ++i) {
        if (w >= h)
          g.fillRect(x + i * w / n - 0.7, y, 1.4, h);
        else
          g.fillRect(x, y + i * h / n - 0.7, w, 1.4);
      }
    }
    if (world === 4 && w > 80 && h > 18) {
      /* hazard stripes along the station's panels */
      g.save();
      g.beginPath();
      g.rect(x, y + h - 7, w, 5);
      g.clip();
      g.fillStyle = '#2a2a30';
      g.fillRect(x, y + h - 7, w, 5);
      g.fillStyle = '#ffcf3a';
      for (let sx = x - 10; sx < x + w; sx += 14) {
        g.beginPath();
        g.moveTo(sx, y + h - 2);
        g.lineTo(sx + 7, y + h - 2);
        g.lineTo(sx + 12, y + h - 7);
        g.lineTo(sx + 5, y + h - 7);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
  }

  function rivets(g, x, y, w, h, world) {
    const p = METAL[world] || METAL[0];
    const pts = [];
    if (w >= 24 && h >= 24) {
      pts.push([x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]);
    } else if (w > h) {
      for (let xx = x + 8; xx < x + w - 4; xx += 40)
        pts.push([xx, y + h / 2]);
    } else {
      for (let yy = y + 8; yy < y + h - 4; yy += 40)
        pts.push([x + w / 2, yy]);
    }
    for (const q of pts) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.arc(q[0] + 0.6, q[1] + 0.8, 2.6, 0, TWO_PI);
      g.fill();
      const rg = g.createRadialGradient(q[0] - 0.8, q[1] - 0.8, 0, q[0], q[1], 2.6);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.5, p.rivet);
      rg.addColorStop(1, p.dark);
      g.fillStyle = rg;
      g.beginPath();
      g.arc(q[0], q[1], 2.4, 0, TWO_PI);
      g.fill();
    }
  }

  function iceFill(g, x, y, w, h, rand) {
    const lg = g.createLinearGradient(x, y, x + w * 0.3, y + h);
    lg.addColorStop(0, 'rgba(230,250,255,0.95)');
    lg.addColorStop(0.5, 'rgba(150,215,245,0.85)');
    lg.addColorStop(1, 'rgba(90,160,210,0.9)');
    g.fillStyle = lg;
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 0.9;
    for (let k = 0; k < Math.max(2, w / 40); ++k) {
      let cx = x + rand() * w, cy = y + rand() * h;
      g.beginPath();
      g.moveTo(cx, cy);
      for (let s = 0; s < 3; ++s) {
        cx += (rand() - 0.5) * 26;
        cy += (rand() - 0.5) * 12;
        g.lineTo(cx, cy);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(x + 2, y + 1.5, w - 4, 2.2);
  }

  /* bevel: light from the top left */
  function bevel(g, x, y, w, h, strength) {
    const s = strength || 1;
    g.fillStyle = 'rgba(255,255,255,' + (0.28 * s) + ')';
    g.fillRect(x, y, w, 2);
    g.fillRect(x, y, 2, h);
    g.fillStyle = 'rgba(0,0,0,' + (0.32 * s) + ')';
    g.fillRect(x, y + h - 2.5, w, 2.5);
    g.fillRect(x + w - 2.5, y, 2.5, h);
    g.lineWidth = 1.4;
    g.strokeStyle = 'rgba(10,6,4,0.85)';
    g.strokeRect(x + 0.7, y + 0.7, w - 1.4, h - 1.4);
  }

  function materialBox(g, w, h, mat, world, rand) {
    if (mat === 'wood')
      woodFill(g, 0, 0, w, h, world, rand, h > w * 1.6);
    else if (mat === 'stone')
      stoneFill(g, 0, 0, w, h, world, rand);
    else if (mat === 'ice')
      iceFill(g, 0, 0, w, h, rand);
    else
      metalFill(g, 0, 0, w, h, world, rand);
    bevel(g, 0, 0, w, h, mat === 'ice' ? 0.6 : 1);
    if (mat === 'metal')
      rivets(g, 0, 0, w, h, world);
  }

  /* ══════════════════════════════════════════════════════════════════
     GROUND: per-world slabs with a decorated top
     ══════════════════════════════════════════════════════════════════ */

  function paintGround(g, w, h, world, rand) {
    if (world === 0) {
      /* floorboards over a dark joist */
      woodFill(g, 0, 0, w, 26, 0, rand, false);
      g.fillStyle = '#3a2412';
      g.fillRect(0, 26, w, h - 26);
      for (let x = 0; x < w; x += 64) {
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x, 26, 18, h - 26);
      }
      g.fillStyle = 'rgba(255,230,180,0.35)';
      g.fillRect(0, 0, w, 2);
    } else if (world === 1) {
      /* soil with a grassy top */
      const lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, '#6a4a2a');
      lg.addColorStop(1, '#2a1a0e');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < w / 6; ++k) {
        g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.2)' : 'rgba(255,220,160,0.12)';
        g.beginPath();
        g.arc(rand() * w, 10 + rand() * (h - 10), 1 + rand() * 3, 0, TWO_PI);
        g.fill();
      }
      g.fillStyle = '#3a8a2a';
      g.fillRect(0, 0, w, 7);
      for (let x = 0; x < w; x += 3) {
        const bh = 4 + rand() * 9;
        g.fillStyle = rand() < 0.5 ? '#5ab83a' : '#3e9a2c';
        g.beginPath();
        g.moveTo(x, 6);
        g.lineTo(x + 1.5 + (rand() - 0.5) * 3, 6 - bh);
        g.lineTo(x + 3, 6);
        g.closePath();
        g.fill();
      }
      g.fillStyle = 'rgba(200,255,150,0.35)';
      g.fillRect(0, 0, w, 1.5);
    } else if (world === 2) {
      /* frosted grating */
      metalFill(g, 0, 0, w, h, 2, rand);
      g.fillStyle = 'rgba(10,30,50,0.55)';
      for (let x = 6; x < w; x += 12)
        g.fillRect(x, 6, 5, 14);
      g.fillStyle = 'rgba(240,252,255,0.85)';
      for (let x = 0; x < w; x += 4)
        g.fillRect(x, 0, 4, 2 + rand() * 3);
      bevel(g, 0, 0, w, h, 0.7);
    } else if (world === 3) {
      stoneFill(g, 0, 0, w, h, 3, rand);
      g.fillStyle = 'rgba(255,140,60,0.35)';
      g.fillRect(0, 0, w, 2);
    } else {
      /* deck plates with running lights */
      metalFill(g, 0, 0, w, h, 4, rand);
      for (let x = 0; x < w; x += 80) {
        g.fillStyle = 'rgba(40,50,70,0.6)';
        g.fillRect(x, 0, 1.5, h);
        g.fillStyle = '#7ad8ff';
        g.fillRect(x + 36, 10, 8, 3);
      }
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(0, 0, w, 2);
    }
  }

  A.WOOD = WOOD; A.METAL = METAL; A.woodFill = woodFill; A.stoneFill = stoneFill; A.metalFill = metalFill; A.rivets = rivets; A.iceFill = iceFill;
  A.bevel = bevel; A.materialBox = materialBox; A.paintGround = paintGround;
})();
