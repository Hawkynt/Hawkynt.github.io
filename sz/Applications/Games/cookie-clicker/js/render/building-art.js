/* Procedural art for the eighteen producers, all cached: one unit painter per producer
   (cursor, grandma, barn, mine shaft, factory, bank, temple, wizard tower, rocket, alchemy
   flask, portal, time machine, antimatter condenser, prism, fractal oven, dream engine, sugar
   nebula, cake singularity) used for the round store icon and the bakery-scene units, and the
   scene strip backdrop (indoor, outdoor, underground or space) each producer stands in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const { TAU } = NS.constants;
  const K = NS.artKit;
  const { BUILDINGS, BY_ID } = NS.buildingData;

  const SETTING = {
    cursor: 'indoor', grandma: 'indoor', farm: 'outdoor', mine: 'cave', factory: 'outdoor', bank: 'outdoor', temple: 'desert',
    'wizard-tower': 'night', shipment: 'space', 'alchemy-lab': 'indoor', portal: 'void', 'time-machine': 'indoor', condenser: 'space',
    prism: 'space', 'fractal-oven': 'indoor', 'dream-engine': 'night', 'sugar-nebula': 'space', 'cake-singularity': 'void',
  };

  function grad(g, x0, y0, x1, y1, a, b) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    return gr;
  }

  /* unit painters: origin at bottom centre, about 48 x 56 */
  const UNITS = {
    cursor(g, d) {
      g.beginPath();
      g.moveTo(-8, -50); g.lineTo(-8, -14); g.lineTo(0, -21); g.lineTo(6, -6); g.lineTo(12, -9); g.lineTo(6, -24); g.lineTo(16, -26);
      g.closePath();
      g.fillStyle = grad(g, -8, -50, 14, -6, '#ffffff', '#c8ccd8');
      g.fill();
      g.strokeStyle = '#2a2a3a';
      g.lineWidth = 2.5;
      g.stroke();
      K.circle(g, -2, -42, 2, d.accent);
    },
    grandma(g, d) {
      g.beginPath();
      g.moveTo(-15, 0); g.lineTo(-10, -30); g.lineTo(10, -30); g.lineTo(15, 0); g.closePath();
      g.fillStyle = grad(g, -15, 0, 15, 0, K.shade(d.main, -0.2), d.main);
      g.fill();
      g.fillStyle = '#fff8f0';
      g.fillRect(-7, -26, 14, 20);
      K.circle(g, 0, -38, 10, '#f2c8a8');
      K.circle(g, 0, -47, 7, '#eeeaf4');
      K.circle(g, -9, -42, 5, '#eeeaf4');
      K.circle(g, 9, -42, 5, '#eeeaf4');
      g.strokeStyle = '#4a3a3a';
      g.lineWidth = 1.5;
      K.circle(g, -4, -38, 3);
      g.stroke();
      K.circle(g, 4, -38, 3);
      g.stroke();
      K.circle(g, -6, -33, 2, 'rgba(255,120,140,0.6)');
      K.circle(g, 6, -33, 2, 'rgba(255,120,140,0.6)');
      g.fillStyle = '#c8945a';
      K.roundRect(g, -18, -20, 36, 6, 3);
      g.fill();
    },
    farm(g, d) {
      g.fillStyle = grad(g, -20, -30, 20, 0, d.main, K.shade(d.main, -0.3));
      g.fillRect(-20, -30, 40, 30);
      g.beginPath(); g.moveTo(-24, -28); g.lineTo(0, -48); g.lineTo(24, -28); g.closePath();
      g.fillStyle = K.shade(d.main, -0.35);
      g.fill();
      g.fillStyle = '#f4ece0';
      g.fillRect(-8, -18, 16, 18);
      g.strokeStyle = d.main;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(-8, -18); g.lineTo(8, 0); g.moveTo(8, -18); g.lineTo(-8, 0); g.stroke();
      K.circle(g, 0, -34, 4, '#f4ece0');
    },
    mine(g, d) {
      g.beginPath(); g.moveTo(-24, 0); g.quadraticCurveTo(-22, -40, 0, -44); g.quadraticCurveTo(22, -40, 24, 0); g.closePath();
      g.fillStyle = grad(g, 0, -44, 0, 0, K.shade(d.main, 0.15), K.shade(d.main, -0.35));
      g.fill();
      g.beginPath(); g.moveTo(-11, 0); g.lineTo(-11, -20); g.quadraticCurveTo(0, -30, 11, -20); g.lineTo(11, 0); g.closePath();
      g.fillStyle = '#140c0a';
      g.fill();
      g.strokeStyle = '#8a5a2a';
      g.lineWidth = 4;
      g.stroke();
      K.circle(g, 15, -26, 4, d.accent);
    },
    factory(g, d) {
      g.fillStyle = grad(g, 0, -34, 0, 0, d.main, K.shade(d.main, -0.35));
      g.fillRect(-22, -30, 44, 30);
      g.beginPath(); g.moveTo(-22, -30); g.lineTo(-11, -38); g.lineTo(-11, -30); g.lineTo(0, -38); g.lineTo(0, -30); g.lineTo(11, -38); g.lineTo(11, -30); g.closePath();
      g.fillStyle = K.shade(d.main, -0.2);
      g.fill();
      g.fillStyle = '#5a5a62';
      g.fillRect(12, -52, 7, 22);
      for (let i = 0; i < 3; ++i) {
        g.fillStyle = '#ffd25a';
        g.fillRect(-17 + i * 13, -22, 8, 8);
      }
      g.fillStyle = '#3a2a2a';
      g.fillRect(-5, -10, 10, 10);
    },
    bank(g, d) {
      g.fillStyle = K.shade(d.main, -0.15);
      g.fillRect(-23, -6, 46, 6);
      g.beginPath(); g.moveTo(-24, -34); g.lineTo(0, -48); g.lineTo(24, -34); g.closePath();
      g.fillStyle = d.main;
      g.fill();
      for (let i = 0; i < 4; ++i) {
        g.fillStyle = grad(g, -18 + i * 12, 0, -12 + i * 12, 0, '#ffffff', K.shade(d.main, -0.25));
        g.fillRect(-19 + i * 12, -32, 6, 26);
      }
      K.circle(g, 0, -40, 4, d.accent);
    },
    temple(g, d) {
      for (let i = 0; i < 4; ++i) {
        g.fillStyle = K.shade(d.main, -0.1 - i * 0.05);
        g.fillRect(-24 + i * 6, -10 - i * 10, 48 - i * 12, 10);
      }
      g.fillStyle = d.accent;
      g.fillRect(-4, -40, 8, 8);
      g.fillStyle = '#3a2a1a';
      g.fillRect(-5, -10, 10, 10);
    },
    'wizard-tower'(g, d) {
      g.fillStyle = grad(g, -10, 0, 10, 0, K.shade(d.main, -0.3), d.main);
      g.fillRect(-10, -36, 20, 36);
      g.beginPath(); g.moveTo(-15, -34); g.lineTo(0, -60); g.lineTo(15, -34); g.closePath();
      g.fillStyle = K.shade(d.main, -0.4);
      g.fill();
      K.star(g, 0, -22, 5, 0.45);
      g.fillStyle = d.accent;
      g.fill();
      K.star(g, 3, -50, 3, 0.45);
      g.fillStyle = '#ffd25a';
      g.fill();
    },
    shipment(g, d) {
      g.beginPath(); g.moveTo(0, -58); g.quadraticCurveTo(12, -40, 10, -10); g.lineTo(-10, -10); g.quadraticCurveTo(-12, -40, 0, -58); g.closePath();
      g.fillStyle = grad(g, -10, 0, 10, 0, '#ffffff', K.shade(d.main, -0.3));
      g.fill();
      g.fillStyle = d.accent;
      g.beginPath(); g.moveTo(-10, -22); g.lineTo(-18, -4); g.lineTo(-10, -10); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(10, -22); g.lineTo(18, -4); g.lineTo(10, -10); g.closePath(); g.fill();
      K.circle(g, 0, -36, 5, '#5ab4ff');
      K.circle(g, -1.5, -37.5, 1.6, '#ffffff');
    },
    'alchemy-lab'(g, d) {
      g.beginPath(); g.moveTo(-5, -50); g.lineTo(-5, -32); g.lineTo(-20, -4); g.quadraticCurveTo(0, 4, 20, -4); g.lineTo(5, -32); g.lineTo(5, -50); g.closePath();
      g.fillStyle = 'rgba(220,240,255,0.5)';
      g.fill();
      g.strokeStyle = '#e0f0ff';
      g.lineWidth = 2;
      g.stroke();
      g.beginPath(); g.moveTo(-14, -14); g.lineTo(-19, -4); g.quadraticCurveTo(0, 3, 19, -4); g.lineTo(14, -14); g.closePath();
      g.fillStyle = d.main;
      g.fill();
      K.circle(g, -4, -10, 2.5, '#ffffff');
      K.circle(g, 5, -8, 1.8, '#ffffff');
    },
    portal(g, d) {
      K.ellipse(g, 0, -28, 20, 26, d.main);
      K.ellipse(g, 0, -28, 14, 20, '#1a0a2a');
      const gr = g.createRadialGradient(0, -28, 1, 0, -28, 16);
      gr.addColorStop(0, d.accent);
      gr.addColorStop(1, K.rgba(d.accent, 0));
      K.ellipse(g, 0, -28, 14, 20, gr);
      g.fillStyle = '#4a3a5a';
      g.fillRect(-16, -4, 32, 4);
    },
    'time-machine'(g, d) {
      g.fillStyle = '#5a4a3a';
      g.fillRect(-16, -8, 32, 8);
      K.circle(g, 0, -30, 20, grad(g, -20, -50, 20, -10, K.shade(d.main, 0.3), K.shade(d.main, -0.3)));
      K.circle(g, 0, -30, 15, '#f4ece0');
      g.strokeStyle = '#3a2a1a';
      g.lineWidth = 1.5;
      for (let i = 0; i < 12; ++i) {
        const a = i / 12 * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * 12, -30 + Math.sin(a) * 12);
        g.lineTo(Math.cos(a) * 14, -30 + Math.sin(a) * 14);
        g.stroke();
      }
    },
    condenser(g, d) {
      g.fillStyle = '#3a4a5a';
      g.fillRect(-14, -6, 28, 6);
      g.fillRect(-14, -52, 28, 6);
      g.fillStyle = 'rgba(160,220,255,0.25)';
      g.fillRect(-11, -46, 22, 40);
      const gr = g.createRadialGradient(0, -26, 1, 0, -26, 12);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.4, d.main);
      gr.addColorStop(1, K.rgba(d.main, 0));
      K.circle(g, 0, -26, 12, gr);
      g.strokeStyle = d.accent;
      g.lineWidth = 2;
      K.ellipse(g, 0, -26, 13, 4);
      g.stroke();
    },
    prism(g, d) {
      g.beginPath(); g.moveTo(0, -54); g.lineTo(20, -4); g.lineTo(-20, -4); g.closePath();
      g.fillStyle = grad(g, -20, -54, 20, -4, '#ffffff', K.shade(d.main, -0.25));
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.5;
      g.stroke();
      const cols = ['#ff4a4a', '#ffa03a', '#ffe03a', '#4ae07a', '#4ab4ff', '#a05aff'];
      for (let i = 0; i < cols.length; ++i) {
        g.strokeStyle = K.rgba(cols[i], 0.7);
        g.beginPath();
        g.moveTo(4, -28 + i);
        g.lineTo(16, -20 + i * 3);
        g.stroke();
      }
    },
    'fractal-oven'(g, d) {
      for (let i = 0; i < 4; ++i) {
        const s = 46 * Math.pow(0.68, i);
        g.fillStyle = i % 2 ? '#2a1a14' : grad(g, 0, -s, 0, 0, d.main, K.shade(d.main, -0.35));
        g.fillRect(-s / 2, -s - i * 3, s, s);
      }
      K.circle(g, 0, -24, 3, d.accent);
    },
    'dream-engine'(g, d) {
      const pts = [[-14, -18, 12], [0, -26, 15], [14, -18, 12], [-6, -12, 11], [8, -10, 10]];
      for (let i = 0; i < pts.length; ++i) K.circle(g, pts[i][0], pts[i][1], pts[i][2], i % 2 ? K.shade(d.main, -0.1) : d.main);
      K.circle(g, 10, -44, 7, '#fff4c0');
      K.circle(g, 13, -46, 6, K.shade(d.main, -0.1));
    },
    'sugar-nebula'(g, d) {
      const gr = g.createRadialGradient(0, -28, 2, 0, -28, 26);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.3, d.main);
      gr.addColorStop(0.7, K.rgba(d.accent, 0.5));
      gr.addColorStop(1, K.rgba(d.accent, 0));
      K.circle(g, 0, -28, 26, gr);
      for (let i = 0; i < 6; ++i) K.circle(g, Math.cos(i * 2.1) * 14, -28 + Math.sin(i * 2.1) * 10, 1.5, '#ffffff');
    },
    'cake-singularity'(g, d) {
      g.save();
      g.translate(0, -28);
      g.scale(1, 0.4);
      g.lineWidth = 6;
      g.strokeStyle = d.main;
      K.circle(g, 0, 0, 22);
      g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = d.accent;
      K.circle(g, 0, 0, 26);
      g.stroke();
      g.restore();
      K.circle(g, 0, -28, 12, '#000000');
      g.strokeStyle = 'rgba(255,210,90,0.8)';
      g.lineWidth = 1.5;
      K.circle(g, 0, -28, 12.5);
      g.stroke();
    },
  };

  function unit(id) {
    const d = BY_ID[id];
    return K.sprite('unit:' + id, 60, 68, (g) => {
      g.translate(30, 64);
      g.lineJoin = 'round';
      K.ellipse(g, 0, 0, 20, 4, 'rgba(0,0,0,0.3)');
      UNITS[id](g, d);
    });
  }

  /* the round store icon */
  function icon(id) {
    const d = BY_ID[id];
    return K.sprite('bicon:' + id, 64, 64, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, K.shade(d.sky, 0.15));
      gr.addColorStop(1, K.shade(d.sky, -0.3));
      K.circle(g, 32, 32, 30, gr);
      g.save();
      K.circle(g, 32, 32, 30);
      g.clip();
      g.fillStyle = d.ground;
      g.fillRect(0, 50, 64, 14);
      g.translate(32, 56);
      g.scale(0.85, 0.85);
      UNITS[id](g, d);
      g.restore();
      g.lineWidth = 2.5;
      g.strokeStyle = K.shade(d.accent, -0.1);
      K.circle(g, 32, 32, 30);
      g.stroke();
    });
  }

  /* the 440 x 88 scene strip */
  function backdrop(id) {
    const d = BY_ID[id];
    const set = SETTING[id];
    return K.sprite('bscene:' + id, 440, 88, (g) => {
      const rng = NS.rng.create('scene-' + id);
      g.fillStyle = grad(g, 0, 0, 0, 88, K.shade(d.sky, 0.12), K.shade(d.sky, -0.25));
      g.fillRect(0, 0, 440, 88);
      if (set === 'space' || set === 'night' || set === 'void')
        for (let i = 0; i < 40; ++i) K.circle(g, rng.range(0, 440), rng.range(0, 66), rng.range(0.4, 1.4), K.rgba('#ffffff', rng.range(0.3, 0.9)));
      if (set === 'outdoor' || set === 'desert') {
        K.circle(g, 400, 18, 10, set === 'desert' ? '#ffe08a' : '#fff4c0');
        g.fillStyle = K.shade(d.ground, 0.15);
        g.beginPath();
        g.moveTo(0, 70);
        for (let x = 0; x <= 440; x += 20) g.lineTo(x, 58 + Math.sin(x * 0.03 + 1) * 8);
        g.lineTo(440, 88);
        g.lineTo(0, 88);
        g.closePath();
        g.fill();
      }
      if (set === 'indoor') {
        g.fillStyle = 'rgba(0,0,0,0.12)';
        for (let x = 0; x < 440; x += 40) g.fillRect(x, 0, 2, 66);
        g.fillStyle = K.rgba(d.accent, 0.12);
        g.fillRect(0, 22, 440, 3);
      }
      if (set === 'cave')
        for (let i = 0; i < 14; ++i) {
          g.beginPath();
          const x = rng.range(0, 440);
          g.moveTo(x - 10, 0);
          g.lineTo(x, rng.range(10, 24));
          g.lineTo(x + 10, 0);
          g.fillStyle = K.shade(d.sky, 0.1);
          g.fill();
        }
      if (set === 'void') {
        const vg = g.createRadialGradient(220, 44, 4, 220, 44, 220);
        vg.addColorStop(0, K.rgba(d.main, 0.25));
        vg.addColorStop(1, K.rgba(d.main, 0));
        g.fillStyle = vg;
        g.fillRect(0, 0, 440, 88);
      }
      g.fillStyle = grad(g, 0, 66, 0, 88, d.ground, K.shade(d.ground, -0.35));
      g.fillRect(0, 66, 440, 22);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, 66, 440, 2);
    });
  }

  Object.assign(NS.buildingArt, { SETTING, UNITS, unit, icon, backdrop, list: BUILDINGS });
})();
