/* Painted, cached art for the Sugar Garden: a soil plot tile per soil, and every plant in four
   growth phases (seed mound, sprout, young plant, mature) - wheat ears, reeds, weeds, bushes
   with pods, flowers and lilies, tulips, roses and orchids, sprigs, mushrooms, ferns, peppers,
   melons and gourds on the ground, and a star-bearing vine. Drawn once into 96 x 96 sprites
   anchored at the bottom centre; the screen only blits them with a gentle sway. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const K = NS.artKit;
  const { TAU } = NS.constants;
  const { BY_ID, SOIL_BY_ID } = NS.gardenData;

  const S = 96;

  function soilTile(id) {
    const so = SOIL_BY_ID[id] || SOIL_BY_ID.dirt;
    return K.sprite('soil:' + so.id, S, S, (g) => {
      const r = NS.rng.create('soil-' + so.id);
      const gr = g.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, K.shade ? K.shade(so.color, 0.15) : so.color);
      gr.addColorStop(1, K.shade ? K.shade(so.color, -0.25) : so.color);
      g.fillStyle = gr;
      roundRect(g, 3, 3, S - 6, S - 6, 12);
      g.fill();
      /* furrows and crumbs */
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = 2;
      for (let k = 0; k < 4; ++k) {
        g.beginPath();
        g.moveTo(12, 20 + k * 18);
        g.quadraticCurveTo(S / 2, 16 + k * 18 + r.range(-3, 3), S - 12, 20 + k * 18);
        g.stroke();
      }
      for (let i = 0; i < 40; ++i) K.circle(g, r.range(8, S - 8), r.range(8, S - 8), r.range(0.6, 2), 'rgba(' + (r.range(0, 1) < 0.5 ? '255,230,200,' : '0,0,0,') + r.range(0.08, 0.25) + ')');
      if (so.id === 'woodchips')
        for (let i = 0; i < 14; ++i) {
          g.fillStyle = 'rgba(240,210,150,0.55)';
          g.save();
          g.translate(r.range(10, S - 10), r.range(10, S - 10));
          g.rotate(r.range(0, TAU));
          g.fillRect(-5, -1.5, 10, 3);
          g.restore();
        }
      g.strokeStyle = 'rgba(255,240,220,0.18)';
      g.lineWidth = 2;
      roundRect(g, 3, 3, S - 6, S - 6, 12);
      g.stroke();
    });
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function leafShape(g, x, y, len, ang, w, color) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -w, len, 0);
    g.quadraticCurveTo(len * 0.5, w, 0, 0);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(len * 0.9, 0);
    g.stroke();
    g.restore();
  }

  function stem(g, x0, y0, x1, y1, color, width) {
    g.strokeStyle = color;
    g.lineWidth = width || 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2 + 4, (y0 + y1) / 2, x1, y1);
    g.stroke();
  }

  function bloom(g, x, y, r, petals, color, center, pointy) {
    g.fillStyle = color;
    for (let i = 0; i < petals; ++i) {
      const a = i / petals * TAU;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      g.moveTo(0, 0);
      if (pointy) { g.quadraticCurveTo(r * 0.5, -r * 0.45, r, 0); g.quadraticCurveTo(r * 0.5, r * 0.45, 0, 0); }
      else g.ellipse(r * 0.55, 0, r * 0.55, r * 0.36, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    K.circle(g, x, y, r * 0.3, center);
    K.circle(g, x - r * 0.08, y - r * 0.1, r * 0.12, 'rgba(255,255,255,0.6)');
  }

  function shine(g, x, y, r) {
    K.circle(g, x - r * 0.35, y - r * 0.35, r * 0.28, 'rgba(255,255,255,0.45)');
  }

  /* the mature plant (phase 3) or a smaller, unfinished version (phase 2) */
  function grown(g, d, k) {
    const bx = S / 2, by = S - 10;
    const L = d.leaf, c = d.color;
    const h = 64 * k;
    switch (d.shape) {
      case 'wheat':
        for (let i = -2; i <= 2; ++i) {
          const tx = bx + i * 8, ty = by - h + Math.abs(i) * 6;
          stem(g, bx + i * 3, by, tx, ty, L, 2);
          if (k > 0.8) for (let e = 0; e < 5; ++e) { g.fillStyle = c; g.beginPath(); g.ellipse(tx + (e % 2 ? 3 : -3), ty + e * 4, 3, 5, e % 2 ? 0.5 : -0.5, 0, TAU); g.fill(); }
        }
        break;
      case 'reed':
        for (let i = -1; i <= 1; ++i) {
          g.strokeStyle = c;
          g.lineWidth = 5;
          g.beginPath();
          g.moveTo(bx + i * 12, by);
          g.lineTo(bx + i * 12 + i * 3, by - h - (i ? 0 : 10));
          g.stroke();
          g.fillStyle = 'rgba(0,0,0,0.15)';
          for (let s = 1; s < 5; ++s) g.fillRect(bx + i * 12 - 3 + i * s * 0.6, by - s * h / 5, 6, 2);
          leafShape(g, bx + i * 12, by - h * 0.4, 22, -1.2 + i * 0.9, 5, L);
        }
        break;
      case 'weed':
        for (let i = 0; i < 9; ++i) leafShape(g, bx, by, 18 + (i % 3) * 8 * k, -Math.PI / 2 + (i - 4) * 0.32, 4, i % 2 ? L : K.shade ? K.shade(L, -0.2) : L);
        if (k > 0.8) for (let i = 0; i < 3; ++i) K.circle(g, bx - 12 + i * 12, by - 30 - (i % 2) * 8, 3, c);
        break;
      case 'bush':
        for (let i = 0; i < 7; ++i) K.circle(g, bx + Math.cos(i * 0.9) * 20 * k, by - 22 * k - Math.sin(i * 0.9) * 14 * k, 14 * k, i % 2 ? L : K.shade ? K.shade(L, 0.12) : L);
        if (k > 0.8) for (let i = 0; i < 5; ++i) { g.fillStyle = c; g.beginPath(); g.ellipse(bx - 20 + i * 10, by - 18 - (i % 2) * 16, 4, 7, 0.3, 0, TAU); g.fill(); }
        break;
      case 'flower': case 'lily': case 'tulip': case 'rose': case 'orchid': {
        const top = by - h;
        stem(g, bx, by, bx + 2, top, L, 3);
        leafShape(g, bx, by - h * 0.3, 22 * k, -0.5, 6, L);
        leafShape(g, bx, by - h * 0.45, 20 * k, -2.6, 6, L);
        if (k < 0.8) { K.circle(g, bx + 2, top, 6, K.shade ? K.shade(L, 0.15) : L); break; }
        if (d.shape === 'flower') bloom(g, bx + 2, top, 16, 6, c, '#ffb43a');
        else if (d.shape === 'lily') bloom(g, bx + 2, top, 18, 6, c, '#ffffff', true);
        else if (d.shape === 'tulip') {
          g.fillStyle = c;
          g.beginPath();
          g.moveTo(bx - 12, top - 8);
          g.lineTo(bx - 6, top + 6);
          g.lineTo(bx + 10, top + 6);
          g.lineTo(bx + 16, top - 8);
          g.lineTo(bx + 8, top - 2);
          g.lineTo(bx + 2, top - 14);
          g.lineTo(bx - 4, top - 2);
          g.closePath();
          g.fill();
          shine(g, bx + 2, top - 2, 12);
        } else if (d.shape === 'rose') {
          for (let r = 18; r > 4; r -= 4) K.circle(g, bx + 2, top, r, r % 8 ? c : K.shade ? K.shade(c, -0.15) : c);
          g.strokeStyle = 'rgba(255,255,255,0.5)';
          g.lineWidth = 1.5;
          g.beginPath(); g.arc(bx + 2, top, 9, 0.3, 4); g.stroke();
          shine(g, bx + 2, top, 18);
        } else {
          bloom(g, bx + 2, top, 20, 5, c, '#e59cff', true);
          K.circle(g, bx + 2, top, 5, '#9affea');
        }
        break;
      }
      case 'sprig':
        stem(g, bx, by, bx, by - h, '#7a4a2a', 4);
        for (let i = 1; i < 4; ++i) {
          stem(g, bx, by - h * i / 4, bx + (i % 2 ? 18 : -18) * k, by - h * i / 4 - 12, '#7a4a2a', 2);
          leafShape(g, bx + (i % 2 ? 18 : -18) * k, by - h * i / 4 - 12, 12, i % 2 ? -0.6 : -2.5, 4, L);
        }
        if (k > 0.8) for (let i = 0; i < 4; ++i) { g.fillStyle = c; g.fillRect(bx - 14 + i * 9, by - 14, 4, 12); }
        break;
      case 'mushroom':
        g.fillStyle = '#f0e8d8';
        g.fillRect(bx - 5, by - 30 * k, 10, 30 * k);
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(bx, by - 30 * k, 26 * k, 18 * k, 0, Math.PI, 0);
        g.fill();
        for (let i = 0; i < 4; ++i) K.circle(g, bx - 14 * k + i * 9 * k, by - 38 * k + (i % 2) * 5, 3 * k, 'rgba(255,255,255,0.7)');
        if (k > 0.8) { K.circle(g, bx + 26, by - 10, 8, d.color); g.fillStyle = '#f0e8d8'; g.fillRect(bx + 24, by - 10, 4, 10); }
        break;
      case 'fern':
        for (let i = -2; i <= 2; ++i) {
          const a = -Math.PI / 2 + i * 0.45;
          const ex = bx + Math.cos(a) * h, ey = by + Math.sin(a) * h * 0.9;
          stem(g, bx, by, ex, ey, L, 2);
          for (let f = 1; f < 6; ++f) {
            const fx = bx + (ex - bx) * f / 6, fy = by + (ey - by) * f / 6;
            leafShape(g, fx, fy, 8, a - 1.1, 2.5, c);
            leafShape(g, fx, fy, 8, a + 1.1, 2.5, c);
          }
        }
        break;
      case 'pepper':
        for (let i = 0; i < 6; ++i) K.circle(g, bx + Math.cos(i) * 18 * k, by - 26 * k - Math.sin(i) * 12 * k, 12 * k, L);
        if (k > 0.8) for (let i = 0; i < 4; ++i) {
          g.fillStyle = c;
          g.beginPath();
          const px = bx - 18 + i * 12, py = by - 30 + (i % 2) * 12;
          g.moveTo(px - 4, py);
          g.quadraticCurveTo(px + 6, py + 6, px + 2, py + 18);
          g.quadraticCurveTo(px - 6, py + 8, px - 4, py);
          g.fill();
          shine(g, px, py + 6, 6);
        }
        break;
      case 'melon': case 'gourd': {
        g.strokeStyle = L;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(10, by - 4);
        g.bezierCurveTo(30, by - 24, 60, by + 4, S - 10, by - 10);
        g.stroke();
        leafShape(g, 22, by - 12, 18, -1.2, 7, L);
        leafShape(g, S - 22, by - 12, 18, -2.2, 7, L);
        const r = 22 * k;
        if (d.shape === 'melon') {
          K.circle(g, bx, by - r, r, c);
          g.strokeStyle = 'rgba(100,90,180,0.35)';
          g.lineWidth = 2;
          for (let i = -1; i <= 1; ++i) { g.beginPath(); g.ellipse(bx + i * r * 0.45, by - r, r * 0.25, r * 0.95, 0, 0, TAU); g.stroke(); }
        } else {
          K.circle(g, bx, by - r * 0.8, r, c);
          K.circle(g, bx, by - r * 1.8, r * 0.6, c);
          g.fillStyle = '#6a5a2a';
          g.fillRect(bx - 2, by - r * 2.5, 4, 8);
        }
        shine(g, bx, by - r, r);
        break;
      }
      case 'vine':
        g.strokeStyle = '#6a5a3a';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx, by - h - 4);
        g.stroke();
        g.strokeStyle = L;
        g.lineWidth = 3;
        g.beginPath();
        for (let t = 0; t <= 1; t += 0.05) g.lineTo(bx + Math.sin(t * 12) * 14, by - t * h);
        g.stroke();
        if (k > 0.8) for (let i = 0; i < 4; ++i) {
          g.fillStyle = c;
          K.star(g, bx + (i % 2 ? 16 : -16), by - 14 - i * 14, 8, 0.45, 5);
          g.fill();
        }
        break;
    }
  }

  /* phase: 0 seed mound, 1 sprout, 2 young, 3 mature */
  function plant(id, phase) {
    const d = BY_ID[id];
    return K.sprite('plant:' + id + ':' + phase, S, S, (g) => {
      const bx = S / 2, by = S - 10;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(bx, by + 2, 26, 6, 0, 0, TAU);
      g.fill();
      if (phase === 0) {
        g.fillStyle = '#5a3a22';
        g.beginPath();
        g.ellipse(bx, by, 16, 7, 0, Math.PI, 0);
        g.fill();
        K.circle(g, bx, by - 6, 3, d.color);
      } else if (phase === 1) {
        stem(g, bx, by, bx, by - 18, d.leaf, 3);
        leafShape(g, bx, by - 14, 12, -0.4, 5, d.leaf);
        leafShape(g, bx, by - 14, 12, -2.7, 5, d.leaf);
      } else grown(g, d, phase === 2 ? 0.6 : 1);
    });
  }

  function phaseOf(plot) {
    const d = BY_ID[plot.p];
    const f = plot.age / d.grow;
    return f >= 1 ? 3 : f >= 0.6 ? 2 : f >= 0.2 ? 1 : 0;
  }

  Object.assign(NS.gardenArt, { soilTile, plant, phaseOf, SIZE: S });
})();
