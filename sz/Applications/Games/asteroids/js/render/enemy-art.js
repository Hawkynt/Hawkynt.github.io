/* Procedural raider and titan art, painted once: saucers with domes and running lights, hunter
   darts, armoured gunships, hazard-striped mine-layers, phantoms, splitters; the Glacier Titan's
   frozen core and plates, the Magma Wyrm's head and segments, the Prism Warden and its facets,
   the Tempest Core and pylons, the Maw's jaw, gullet and eyes. Raiders face +x. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const { TAU } = NS.constants;
  const { BOSSES } = NS.enemyData;
  const K = NS.artKit;
  const { makeRng, hashString } = NS.rng;

  function metal(g, x0, y0, x1, y1, light, dark) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, light);
    gr.addColorStop(0.5, K.mix(light, dark, 0.45));
    gr.addColorStop(1, dark);
    return gr;
  }

  function saucer(g, cx, cy, r, col) {
    g.fillStyle = metal(g, cx, cy - r * 0.4, cx, cy + r * 0.4, '#e8eef8', '#3a4050');
    g.beginPath();
    g.ellipse(cx, cy + r * 0.08, r, r * 0.36, 0, 0, TAU);
    g.fill();
    g.strokeStyle = '#1a1e28';
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(cx, cy + r * 0.2, r * 0.7, r * 0.12, 0, 0, TAU);
    g.fill();
    const dome = g.createRadialGradient(cx - r * 0.15, cy - r * 0.35, 1, cx, cy - r * 0.15, r * 0.5);
    dome.addColorStop(0, '#ffffff');
    dome.addColorStop(0.4, col);
    dome.addColorStop(1, K.shade(col, -0.6));
    g.fillStyle = dome;
    g.beginPath();
    g.ellipse(cx, cy - r * 0.12, r * 0.48, r * 0.4, 0, Math.PI, TAU);
    g.fill();
    for (let i = 0; i < 6; ++i) {
      const a = Math.PI * (0.15 + i * 0.14);
      g.fillStyle = i % 2 ? '#ffe080' : col;
      g.beginPath();
      g.arc(cx + Math.cos(a + Math.PI / 2) * r * 0.82, cy + r * 0.1 + Math.sin(a) * r * 0.06, r * 0.07, 0, TAU);
      g.fill();
    }
  }

  const PAINT = {
    saucer: (g, c) => saucer(g, c, c, 22, '#9ae06a'),
    sniper: (g, c) => saucer(g, c, c, 13, '#ff6a8a'),
    hunter: (g, c) => {
      K.poly(g, [[c + 13, c], [c - 9, c - 9], [c - 4, c], [c - 9, c + 9]]);
      g.fillStyle = metal(g, c, c - 9, c, c + 9, '#ff9a8a', '#5a0a08');
      g.fill();
      g.strokeStyle = '#2a0404';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = '#ffe060';
      g.beginPath();
      g.arc(c + 3, c, 2.2, 0, TAU);
      g.fill();
    },
    gunship: (g, c) => {
      K.poly(g, [[c + 24, c], [c + 10, c - 10], [c - 6, c - 24], [c - 22, c - 22], [c - 16, c - 6], [c - 22, c], [c - 16, c + 6], [c - 22, c + 22], [c - 6, c + 24], [c + 10, c + 10]]);
      g.fillStyle = metal(g, c, c - 24, c, c + 24, '#ffd0a0', '#4a2008');
      g.fill();
      g.strokeStyle = '#1a0a02';
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = '#2a2e38';
      g.fillRect(c - 4, c - 4, 22, 8);
      g.fillStyle = '#ffa040';
      g.beginPath();
      g.arc(c - 2, c, 6, 0, TAU);
      g.fill();
      g.fillStyle = '#fff0c0';
      g.beginPath();
      g.arc(c - 3, c - 1.5, 2, 0, TAU);
      g.fill();
    },
    layer: (g, c) => {
      g.fillStyle = metal(g, c, c - 18, c, c + 18, '#fff0a0', '#5a4a08');
      K.poly(g, [[c + 18, c - 8], [c + 18, c + 8], [c + 8, c + 18], [c - 16, c + 18], [c - 20, c], [c - 16, c - 18], [c + 8, c - 18]]);
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = '#1a1a10';
      for (let i = -4; i < 6; ++i) {
        g.beginPath();
        g.moveTo(c - 20 + i * 9, c + 18); g.lineTo(c - 14 + i * 9, c + 18); g.lineTo(c - 2 + i * 9, c + 6); g.lineTo(c - 8 + i * 9, c + 6);
        g.fill();
      }
      g.restore();
      g.strokeStyle = '#2a2008';
      g.lineWidth = 1.4;
      K.poly(g, [[c + 18, c - 8], [c + 18, c + 8], [c + 8, c + 18], [c - 16, c + 18], [c - 20, c], [c - 16, c - 18], [c + 8, c - 18]]);
      g.stroke();
      g.fillStyle = '#ff4a3a';
      g.beginPath();
      g.arc(c + 6, c - 4, 4, 0, TAU);
      g.fill();
    },
    phantom: (g, c) => {
      K.poly(g, [[c + 18, c], [c + 2, c - 6], [c - 10, c - 16], [c - 6, c - 4], [c - 14, c], [c - 6, c + 4], [c - 10, c + 16], [c + 2, c + 6]]);
      g.fillStyle = metal(g, c, c - 16, c, c + 16, '#e8c8ff', '#2a0a4a');
      g.fill();
      g.strokeStyle = '#c070ff';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(c + 4, c, 4, 1.6, 0, 0, TAU);
      g.fill();
    },
    splitter: (g, c) => {
      for (let i = 0; i < 3; ++i) {
        const a = i * TAU / 3;
        const x = c + Math.cos(a) * 9, y = c + Math.sin(a) * 9;
        K.poly(g, [[x + Math.cos(a) * 13, y + Math.sin(a) * 13], [x + Math.cos(a + 2.2) * 9, y + Math.sin(a + 2.2) * 9], [x + Math.cos(a - 2.2) * 9, y + Math.sin(a - 2.2) * 9]]);
        g.fillStyle = metal(g, x - 9, y - 9, x + 9, y + 9, '#c0fff8', '#0a4a44');
        g.fill();
        g.strokeStyle = '#04201e';
        g.lineWidth = 1;
        g.stroke();
      }
      g.fillStyle = '#40e0d0';
      g.beginPath();
      g.arc(c, c, 6, 0, TAU);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(c - 1.5, c - 1.5, 2, 0, TAU);
      g.fill();
    },
  };

  function enemySprite(kind) {
    return K.sprite('enemy:' + kind, 56, 56, (g, w) => PAINT[kind](g, w / 2));
  }

  function enemyFlash(kind) {
    return K.silhouette('enemy:' + kind, enemySprite(kind));
  }

  /* ── titans ── */
  function boss(kind) {
    const D = BOSSES[kind];
    const size = { glacier: 220, wyrm: 90, prism: 170, tempest: 150, maw: 270 }[kind];
    return K.sprite('boss:' + kind, size, size, (g, w) => BOSS_PAINT[kind](g, w / 2, D.pal, D.r));
  }

  function bossFlash(kind) {
    return K.silhouette('boss:' + kind, boss(kind));
  }

  const BOSS_PAINT = {
    glacier: (g, c, pal, r) => {
      const rng = makeRng(hashString('glacier'));
      K.poly(g, Array.from({ length: 18 }, (_, i) => {
        const a = i * TAU / 18, k = 0.82 + rng() * 0.2;
        return [c + Math.cos(a) * r * k, c + Math.sin(a) * r * k];
      }));
      const gr = g.createRadialGradient(c - r * 0.4, c - r * 0.4, 4, c, c, r);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.4, pal[1]);
      gr.addColorStop(1, pal[2]);
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = '#e8faff';
      g.lineWidth = 2;
      g.stroke();
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 14; ++i) {
        const a = rng() * TAU;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * r * 0.25, c + Math.sin(a) * r * 0.25);
        g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
        g.stroke();
      }
      g.restore();
      eye(g, c, c, r * 0.3, '#bff4ff', '#0a3a5a');
    },
    wyrm: (g, c, pal, r) => {
      const gr = g.createRadialGradient(c - 8, c - 8, 2, c, c, r * 1.1);
      gr.addColorStop(0, pal[0]);
      gr.addColorStop(0.5, pal[1]);
      gr.addColorStop(1, pal[2]);
      g.fillStyle = gr;
      K.poly(g, [[c + r * 1.25, c], [c + r * 0.5, c - r * 0.9], [c - r * 0.6, c - r], [c - r, c - r * 0.4], [c - r, c + r * 0.4], [c - r * 0.6, c + r], [c + r * 0.5, c + r * 0.9]]);
      g.fill();
      g.strokeStyle = '#2a0804';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#2a0804';
      for (const s of [-1, 1]) {
        K.poly(g, [[c - r * 0.3, c + s * r * 0.85], [c - r * 1.3, c + s * r * 1.25], [c - r * 0.7, c + s * r * 0.6]]);
        g.fill();
      }
      eye(g, c + r * 0.45, c - r * 0.42, r * 0.17, '#fff080', '#3a0a00');
      eye(g, c + r * 0.45, c + r * 0.42, r * 0.17, '#fff080', '#3a0a00');
    },
    prism: (g, c, pal, r) => {
      for (let k = 0; k < 2; ++k) {
        const pts = [];
        for (let i = 0; i < 6; ++i) {
          const a = i * TAU / 6 + k * TAU / 12;
          pts.push([c + Math.cos(a) * r * (k ? 0.75 : 1), c + Math.sin(a) * r * (k ? 0.75 : 1)]);
        }
        K.poly(g, pts);
        const gr = g.createLinearGradient(c - r, c - r, c + r, c + r);
        gr.addColorStop(0, k ? '#ffffff' : pal[0]);
        gr.addColorStop(0.5, pal[1]);
        gr.addColorStop(1, pal[2]);
        g.fillStyle = gr;
        g.globalAlpha = k ? 0.6 : 1;
        g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = pal[3];
        g.lineWidth = 1.5;
        g.stroke();
      }
      eye(g, c, c, r * 0.28, '#80ffff', '#1a0a4a');
    },
    tempest: (g, c, pal, r) => {
      const gr = g.createRadialGradient(c - r * 0.3, c - r * 0.3, 2, c, c, r);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.35, pal[1]);
      gr.addColorStop(0.8, pal[2]);
      gr.addColorStop(1, 'rgba(20,20,8,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(c, c, r, 0, TAU);
      g.fill();
      g.strokeStyle = '#a0f0ff';
      g.lineWidth = 2;
      for (let i = 0; i < 3; ++i) {
        g.beginPath();
        g.ellipse(c, c, r * 0.9, r * 0.3, i * TAU / 6, 0, TAU);
        g.stroke();
      }
      eye(g, c, c, r * 0.3, '#ffffe0', '#2a2a08');
    },
    maw: (g, c, pal, r) => {
      const gr = g.createRadialGradient(c, c - r * 0.4, 4, c, c, r);
      gr.addColorStop(0, pal[0]);
      gr.addColorStop(0.45, pal[1]);
      gr.addColorStop(1, pal[2]);
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(c, c, r, r * 0.9, 0, 0, TAU);
      g.fill();
      g.strokeStyle = '#ff8aa0';
      g.lineWidth = 2;
      g.stroke();
      /* ridges */
      g.strokeStyle = 'rgba(40,0,10,0.5)';
      g.lineWidth = 3;
      for (let i = 0; i < 7; ++i) {
        g.beginPath();
        g.arc(c, c + r * 0.3, r * (0.4 + i * 0.1), Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      }
      /* eye sockets and the shut jaw */
      g.fillStyle = '#1a0206';
      g.beginPath();
      g.ellipse(c - 70, c - 62, 30, 26, 0, 0, Math.PI * 2);
      g.ellipse(c + 70, c - 62, 30, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#2a0408';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(c - r * 0.75, c + 30);
      g.quadraticCurveTo(c, c + 58, c + r * 0.75, c + 30);
      g.stroke();
      g.fillStyle = '#f0e0d0';
      for (let i = 0; i < 9; ++i) {
        const x = c - r * 0.6 + i * r * 0.15;
        const y = c + 30 + Math.sin(i / 8 * Math.PI) * 24;
        g.beginPath();
        g.moveTo(x - 5, y - 2); g.lineTo(x + 5, y - 2); g.lineTo(x, y + 9);
        g.fill();
      }
    },
  };

  /* the Maw's open gullet with teeth (drawn under the jaw as it opens) */
  function gullet() {
    return K.sprite('maw:gullet', 200, 120, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.15, '#ff4a6a');
      gr.addColorStop(0.5, '#40040c');
      gr.addColorStop(1, '#100004');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#f0e0d0';
      for (let i = 0; i < 11; ++i) {
        const x = 14 + i * (w - 28) / 10;
        g.beginPath();
        g.moveTo(x - 7, 10 + Math.abs(i - 5) * 3); g.lineTo(x + 7, 10 + Math.abs(i - 5) * 3); g.lineTo(x, 34 + Math.abs(i - 5) * 2);
        g.fill();
        g.beginPath();
        g.moveTo(x - 7, h - 10 - Math.abs(i - 5) * 3); g.lineTo(x + 7, h - 10 - Math.abs(i - 5) * 3); g.lineTo(x, h - 32 - Math.abs(i - 5) * 2);
        g.fill();
      }
    });
  }

  function eye(g, x, y, r, iris, dark) {
    g.fillStyle = '#100408';
    g.beginPath();
    g.arc(x, y, r * 1.15, 0, TAU);
    g.fill();
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.3, iris);
    gr.addColorStop(1, dark);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = '#000000';
    g.beginPath();
    g.ellipse(x, y, r * 0.22, r * 0.6, 0, 0, TAU);
    g.fill();
  }

  /* boss parts: plate, segment, facet, pylon, eye */
  function partSprite(kind, bossKind) {
    const pal = BOSSES[bossKind].pal;
    return K.sprite('part:' + kind, 64, 64, (g, w) => {
      const c = w / 2;
      switch (kind) {
        case 'plate': {
          K.poly(g, [[c + 26, c], [c + 10, c - 22], [c - 18, c - 18], [c - 26, c + 4], [c - 10, c + 22], [c + 16, c + 18]]);
          g.fillStyle = metal(g, c - 20, c - 20, c + 20, c + 20, '#ffffff', pal[2]);
          g.fill();
          g.strokeStyle = pal[3];
          g.lineWidth = 2;
          g.stroke();
          break;
        }
        case 'segment': {
          const gr = g.createRadialGradient(c - 6, c - 6, 2, c, c, 24);
          gr.addColorStop(0, '#ffe080');
          gr.addColorStop(0.35, '#ff6a20');
          gr.addColorStop(0.7, '#4a1208');
          gr.addColorStop(1, '#1a0602');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(c, c, 24, 0, TAU);
          g.fill();
          g.strokeStyle = '#2a0804';
          g.lineWidth = 3;
          g.beginPath();
          g.arc(c, c, 18, 0.4, 2.7);
          g.arc(c, c, 18, 3.5, 5.8);
          g.stroke();
          break;
        }
        case 'facet': {
          K.poly(g, [[c, c - 22], [c + 14, c], [c, c + 22], [c - 14, c]]);
          g.fillStyle = metal(g, c - 14, c - 22, c + 14, c + 22, '#ffffff', pal[1]);
          g.fill();
          g.strokeStyle = pal[3];
          g.lineWidth = 1.5;
          g.stroke();
          break;
        }
        case 'pylon': {
          g.fillStyle = metal(g, c - 16, c, c + 16, c, '#e8e8c0', '#3a3a10');
          K.poly(g, [[c, c - 26], [c + 14, c - 8], [c + 10, c + 24], [c - 10, c + 24], [c - 14, c - 8]]);
          g.fill();
          g.strokeStyle = '#1a1a04';
          g.lineWidth = 1.5;
          g.stroke();
          const gr = g.createRadialGradient(c, c - 8, 0, c, c - 8, 10);
          gr.addColorStop(0, '#ffffff');
          gr.addColorStop(0.5, '#a0f0ff');
          gr.addColorStop(1, 'rgba(160,240,255,0)');
          g.fillStyle = gr;
          g.fillRect(c - 12, c - 20, 24, 24);
          break;
        }
        case 'eye':
          eye(g, c, c, 20, '#ff6a8a', '#300008');
          break;
      }
    });
  }

  Object.assign(NS.enemyArt, {
    enemySprite, enemyFlash, boss, bossFlash, gullet, partSprite, eye
  });
})();
