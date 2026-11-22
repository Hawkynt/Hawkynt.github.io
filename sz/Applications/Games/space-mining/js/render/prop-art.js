/* Prop art, painted once per key: the belt dock (an outpost ring with pylons and pads), pirate
   craft (skimmer, raider, gunship), the convoy freighter, the trading post, the derelict freighter, the gravity-well accretion disc,
   radiation haze, the seismic charge, and the cached vector icon set every menu uses.
   Pure painting into cached canvases (icons may also draw straight into a context). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const K = NS.artKit;
  const TAU = Math.PI * 2;

  function metal(g, x0, y0, x1, y1, base) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, K.shade(base, 0.4));
    gr.addColorStop(0.5, base);
    gr.addColorStop(1, K.shade(base, -0.55));
    return gr;
  }

  /* The dock outpost: a ring of plating with four pylons around a landing pad */
  function dock() {
    return K.sprite('dock', 300, 300, (g, w) => {
      const c = w / 2;
      /* pylons */
      for (let i = 0; i < 4; ++i) {
        const a = i * TAU / 4 + TAU / 8;
        g.save();
        g.translate(c, c);
        g.rotate(a);
        g.fillStyle = metal(g, 0, -10, 0, 10, '#6a7280');
        g.fillRect(96, -9, 46, 18);
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.strokeRect(96, -9, 46, 18);
        g.fillStyle = '#2a2e36';
        g.fillRect(132, -14, 10, 28);
        g.fillStyle = '#ffb44a';
        g.fillRect(100, -2, 30, 4);
        g.restore();
      }
      /* outer ring */
      g.lineWidth = 22;
      g.strokeStyle = '#1a1e26';
      g.beginPath();
      g.arc(c, c, 100, 0, TAU);
      g.stroke();
      g.lineWidth = 18;
      const rg = g.createLinearGradient(c - 100, c - 100, c + 100, c + 100);
      rg.addColorStop(0, '#c8ccd4');
      rg.addColorStop(0.5, '#6a7280');
      rg.addColorStop(1, '#2a2e38');
      g.strokeStyle = rg;
      g.beginPath();
      g.arc(c, c, 100, 0, TAU);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1;
      for (let i = 0; i < 24; ++i) {
        const a = i * TAU / 24;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * 91, c + Math.sin(a) * 91);
        g.lineTo(c + Math.cos(a) * 109, c + Math.sin(a) * 109);
        g.stroke();
      }
      /* hazard band */
      g.lineWidth = 4;
      g.setLineDash([10, 8]);
      g.strokeStyle = '#ffb44a';
      g.beginPath();
      g.arc(c, c, 100, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      /* pad */
      const pg = g.createRadialGradient(c, c, 10, c, c, 70);
      pg.addColorStop(0, 'rgba(60,70,90,0.85)');
      pg.addColorStop(1, 'rgba(20,24,34,0.6)');
      g.fillStyle = pg;
      g.beginPath();
      g.arc(c, c, 70, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(255,180,74,0.5)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(c, c, 46, 0, TAU);
      g.stroke();
      for (let i = 0; i < 4; ++i) {
        const a = i * TAU / 4;
        g.fillStyle = 'rgba(255,180,74,0.55)';
        g.beginPath();
        g.moveTo(c + Math.cos(a) * 30, c + Math.sin(a) * 30);
        g.lineTo(c + Math.cos(a + 0.18) * 40, c + Math.sin(a + 0.18) * 40);
        g.lineTo(c + Math.cos(a - 0.18) * 40, c + Math.sin(a - 0.18) * 40);
        g.closePath();
        g.fill();
      }
    });
  }

  /* Pirate craft, facing +x, in rust red and black */
  function pirate(kind) {
    const S = { gunship: 80, raider: 54, jammer: 48, layer: 52, mine: 28, battery: 76 }[kind] || 40;
    return K.sprite('pirate:' + kind, S, S, (g, w) => {
      const c = w / 2;
      const red = '#c8302a', dark = '#24181a', bone = '#d8c8b0';
      const part = (pts, col) => {
        K.poly(g, pts.map(p => [c + p[0], c + p[1]]));
        g.fillStyle = metal(g, c, c - S / 3, c + S / 6, c + S / 3, col);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.lineWidth = 1;
        g.stroke();
      };
      if (kind === 'skimmer') {
        part([[-14, -4], [-8, -14], [-2, -5]], dark);
        part([[-14, 4], [-8, 14], [-2, 5]], dark);
        part([[-16, -4], [6, -3], [18, 0], [6, 3], [-16, 4]], red);
        part([[-4, -2], [8, -1], [8, 1], [-4, 2]], bone);
      } else if (kind === 'mine') {
        /* a spiked sphere with a red eye */
        g.strokeStyle = '#6a6a72';
        g.lineWidth = 2;
        for (let k = 0; k < 8; ++k) {
          const a = k / 8 * TAU;
          g.beginPath();
          g.moveTo(c + Math.cos(a) * 6, c + Math.sin(a) * 6);
          g.lineTo(c + Math.cos(a) * 13, c + Math.sin(a) * 13);
          g.stroke();
        }
        g.fillStyle = metal(g, c - 8, c - 8, c + 8, c + 8, dark);
        g.beginPath();
        g.arc(c, c, 8, 0, TAU);
        g.fill();
        g.fillStyle = '#ff3a2a';
        g.beginPath();
        g.arc(c, c, 3, 0, TAU);
        g.fill();
        return;
      } else if (kind === 'battery') {
        /* a gun platform: an octagonal base, a turret and twin barrels */
        const base = [];
        for (let k = 0; k < 8; ++k) base.push([Math.cos((k + 0.5) / 8 * TAU) * 30, Math.sin((k + 0.5) / 8 * TAU) * 30]);
        part(base, dark);
        part([[-14, -14], [14, -14], [18, 0], [14, 14], [-14, 14], [-18, 0]], red);
        part([[10, -8], [36, -7], [36, -3], [10, -2]], '#6a6a72');
        part([[10, 2], [36, 3], [36, 7], [10, 8]], '#6a6a72');
        part([[-6, -4], [6, -4], [6, 4], [-6, 4]], bone);
      } else if (kind === 'jammer') {
        /* a slim hull carrying a dish */
        part([[-18, -6], [10, -5], [20, 0], [10, 5], [-18, 6]], red);
        part([[-12, -16], [-2, -16], [-2, 16], [-12, 16]], dark);
        g.strokeStyle = '#7af0ff';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(c + 14, c, 10, -1.1, 1.1);
        g.stroke();
        part([[-4, -2], [8, -2], [8, 2], [-4, 2]], bone);
      } else if (kind === 'layer') {
        /* a boxy hauler with a mine rack at the stern */
        part([[-22, -12], [12, -12], [22, 0], [12, 12], [-22, 12]], red);
        part([[-24, -8], [-14, -8], [-14, 8], [-24, 8]], dark);
        for (let k = -1; k <= 1; ++k) { g.fillStyle = '#ff3a2a'; g.fillRect(c - 22, c + k * 5 - 1.5, 3, 3); }
        part([[-4, -3], [10, -3], [10, 3], [-4, 3]], bone);
      } else if (kind === 'raider') {
        part([[-22, -18], [8, -14], [14, -10], [-18, -8]], dark);
        part([[-22, 18], [8, 14], [14, 10], [-18, 8]], dark);
        part([[-20, -9], [6, -8], [22, 0], [6, 8], [-20, 9], [-24, 0]], red);
        part([[16, -12], [26, -11], [26, -9], [16, -8]], '#6a6a72');
        part([[16, 12], [26, 11], [26, 9], [16, 8]], '#6a6a72');
        part([[-6, -3], [10, -2], [10, 2], [-6, 3]], bone);
      } else {
        part([[-34, -26], [10, -30], [24, -18], [-26, -14]], dark);
        part([[-34, 26], [10, 30], [24, 18], [-26, 14]], dark);
        part([[-30, -14], [16, -16], [34, -6], [34, 6], [16, 16], [-30, 14], [-36, 0]], red);
        part([[-20, -7], [14, -8], [22, 0], [14, 8], [-20, 7]], dark);
        part([[30, -4], [40, -3], [40, 3], [30, 4]], '#6a6a72');
        part([[-4, -24], [6, -24], [6, -20], [-4, -20]], bone);
        part([[-4, 24], [6, 24], [6, 20], [-4, 20]], bone);
      }
      /* the skull mark */
      g.fillStyle = '#ffe8d0';
      g.beginPath();
      g.arc(c - 2, c, S * 0.05, 0, TAU);
      g.fill();
      g.fillStyle = '#ff3a2a';
      g.fillRect(c + S * 0.12, c - 1, 2, 2);
    });
  }

  /* The convoy freighter, facing +x: a cab, a spine with three container blocks, the engine
     block with twin nozzles */
  function freighter() {
    return K.sprite('freighter', 120, 60, (g, w, h) => {
      const cy = h / 2;
      const box = (x0, y0, x1, y1, col) => {
        g.fillStyle = metal(g, x0, y0, x0, y1, col);
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.strokeStyle = 'rgba(0,0,0,0.65)';
        g.lineWidth = 1;
        g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      };
      /* nozzles and engine block */
      box(4, cy - 16, 12, cy - 6, '#3a3e48');
      box(4, cy + 6, 12, cy + 16, '#3a3e48');
      box(10, cy - 18, 26, cy + 18, '#6a7280');
      /* spine */
      box(24, cy - 4, 98, cy + 4, '#4a505a');
      /* containers */
      const cols = ['#c87a2a', '#2a8a9a', '#b8a040'];
      for (let i = 0; i < 3; ++i) {
        const x0 = 30 + i * 22;
        box(x0, cy - 17, x0 + 19, cy - 2, cols[i]);
        box(x0, cy + 2, x0 + 19, cy + 17, cols[(i + 1) % 3]);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 3; ++k) { g.fillRect(x0 + 3 + k * 5, cy - 15, 1.5, 11); g.fillRect(x0 + 3 + k * 5, cy + 4, 1.5, 11); }
      }
      /* cab */
      K.poly(g, [[96, cy - 10], [108, cy - 8], [116, cy], [108, cy + 8], [96, cy + 10]]);
      g.fillStyle = metal(g, 96, cy - 10, 96, cy + 10, '#c8ccd4');
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.stroke();
      g.fillStyle = '#7cf0ff';
      g.fillRect(106, cy - 4, 5, 8);
      /* guild stripe and running lights */
      g.fillStyle = '#ffb44a';
      g.fillRect(12, cy - 2, 12, 4);
      g.fillStyle = '#ff4a4a';
      g.fillRect(28, cy - 19, 2, 2);
      g.fillStyle = '#5cff9a';
      g.fillRect(28, cy + 17, 2, 2);
    });
  }

  /* A trading post at the belt edge: a hex hub on struts, a docking pad, a mast with a beacon */
  function post() {
    return K.sprite('tradepost', 180, 180, (g, w) => {
      const c = w / 2;
      for (let i = 0; i < 3; ++i) {
        const a = i * TAU / 3 + 0.5;
        g.save();
        g.translate(c, c);
        g.rotate(a);
        g.fillStyle = metal(g, 0, -6, 0, 6, '#5a6270');
        g.fillRect(30, -6, 50, 12);
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.strokeRect(30, -6, 50, 12);
        g.fillStyle = metal(g, 70, -16, 70, 16, '#8a7a5a');
        g.fillRect(70, -16, 18, 32);
        g.strokeRect(70, -16, 18, 32);
        g.restore();
      }
      const hex = [];
      for (let i = 0; i < 6; ++i) hex.push([c + Math.cos(i * TAU / 6) * 40, c + Math.sin(i * TAU / 6) * 40]);
      K.poly(g, hex);
      g.fillStyle = metal(g, c - 40, c - 40, c + 40, c + 40, '#8a909c');
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = 'rgba(20,24,34,0.8)';
      g.beginPath();
      g.arc(c, c, 24, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(255,180,74,0.7)';
      g.lineWidth = 2;
      g.setLineDash([6, 5]);
      g.beginPath();
      g.arc(c, c, 24, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#ffb44a';
      g.fillRect(c - 2, c - 12, 4, 24);
      g.fillRect(c - 12, c - 2, 24, 4);
    });
  }

  /* A broken freighter: two hull halves, torn ribs and dead lights */
  function derelict(variant) {
    return K.sprite('derelict:' + variant, 220, 140, (g, w, h) => {
      const cx = w / 2, cy = h / 2;
      g.save();
      g.translate(cx, cy);
      g.rotate(variant ? 0.12 : -0.08);
      const hull = (x0, x1, tilt) => {
        g.save();
        g.rotate(tilt);
        g.fillStyle = metal(g, 0, -34, 0, 34, '#6a6858');
        g.beginPath();
        g.moveTo(x0, -30);
        g.lineTo(x1, -26);
        g.lineTo(x1 + 8, 0);
        g.lineTo(x1, 26);
        g.lineTo(x0, 30);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.lineWidth = 1.5;
        g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 1;
        for (let x = x0 + 8; x < x1; x += 10) {
          g.beginPath();
          g.moveTo(x, -28);
          g.lineTo(x, 28);
          g.stroke();
        }
        g.fillStyle = '#c8a040';
        g.fillRect(x0 + 6, -4, x1 - x0 - 12, 3);
        g.restore();
      };
      hull(-96, -14, -0.05);
      hull(6, 84, 0.08);
      /* torn ribs between the halves */
      g.strokeStyle = '#3a3830';
      g.lineWidth = 3;
      for (let i = -3; i <= 3; ++i) {
        g.beginPath();
        g.moveTo(-14, i * 8);
        g.lineTo(-4 + (i % 2) * 6, i * 9 + 3);
        g.stroke();
      }
      /* scorch */
      const sc = g.createRadialGradient(-6, 0, 2, -6, 0, 40);
      sc.addColorStop(0, 'rgba(0,0,0,0.75)');
      sc.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sc;
      g.fillRect(-50, -40, 90, 80);
      /* bridge windows */
      g.fillStyle = '#3a6a8a';
      for (let i = 0; i < 4; ++i) g.fillRect(60 + i * 5, -10, 3, 5);
      g.restore();
    });
  }

  /* The accretion disc of a gravity well (rotated at draw time) */
  function well() {
    return K.sprite('well', 300, 300, (g, w) => {
      const c = w / 2;
      const n = K.valueNoise(321);
      for (let i = 0; i < 260; ++i) {
        const a = n(i, 1) * TAU, d = 34 + Math.pow(n(i, 2), 0.7) * 110;
        const len = 0.25 + n(i, 3) * 0.6;
        g.strokeStyle = K.rgba(i % 3 ? '#ff9a5a' : '#ffe0b0', 0.08 + (1 - d / 150) * 0.3);
        g.lineWidth = 1 + n(i, 4) * 3;
        g.beginPath();
        g.arc(c, c, d, a, a + len);
        g.stroke();
      }
      const gr = g.createRadialGradient(c, c, 20, c, c, 60);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(0.55, 'rgba(0,0,0,1)');
      gr.addColorStop(0.7, 'rgba(255,200,140,0.9)');
      gr.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(c, c, 60, 0, TAU);
      g.fill();
    });
  }

  /* Radiation haze: a lumpy glowing green cloud (alpha use, scaled to the field) */
  function radCloud(seed) {
    return K.sprite('rad:' + seed, 256, 256, (g, w) => {
      const c = w / 2;
      const n = K.valueNoise(seed);
      /* every puff stays inside the sprite so no edge ever shows */
      for (let i = 0; i < 26; ++i) {
        const a = n(i, 1) * TAU, d = Math.sqrt(n(i, 2)) * 60;
        const r = 30 + n(i, 3) * 36;
        const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(124,255,74,0.16)');
        gr.addColorStop(0.6, 'rgba(60,200,60,0.07)');
        gr.addColorStop(1, 'rgba(40,160,40,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.strokeStyle = 'rgba(160,255,120,0.25)';
      g.lineWidth = 2;
      g.setLineDash([12, 10]);
      g.beginPath();
      g.arc(c, c, 124, 0, TAU);
      g.stroke();
      g.setLineDash([]);
    });
  }

  function charge() {
    return K.sprite('charge', 20, 20, (g) => {
      g.fillStyle = metal(g, 4, 4, 16, 16, '#8a7a5a');
      g.beginPath();
      g.arc(10, 10, 6, 0, TAU);
      g.fill();
      g.strokeStyle = '#ffb44a';
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#ff3a2a';
      g.fillRect(9, 9, 2, 2);
    });
  }

  /* ── icons: simple glyphs, cached per kind and colour at 32 px ── */
  const ICONS = {
    laser(g) { g.beginPath(); g.moveTo(5, 27); g.lineTo(15, 17); g.stroke(); g.fillRect(3, 23, 9, 6); g.beginPath(); g.moveTo(16, 16); g.lineTo(29, 3); g.lineWidth = 3; g.stroke(); g.beginPath(); g.arc(29, 3, 2.5, 0, TAU); g.fill(); },
    cargo(g) { g.strokeRect(5, 9, 22, 17); g.beginPath(); g.moveTo(5, 15); g.lineTo(27, 15); g.moveTo(16, 9); g.lineTo(16, 26); g.stroke(); g.fillRect(9, 5, 14, 4); },
    fuel(g) { g.beginPath(); g.moveTo(16, 4); g.quadraticCurveTo(26, 16, 24, 21); g.arc(16, 21, 8, 0, Math.PI); g.quadraticCurveTo(6, 16, 16, 4); g.fill(); },
    hull(g) { g.beginPath(); g.moveTo(16, 3); g.lineTo(27, 8); g.lineTo(25, 20); g.lineTo(16, 29); g.lineTo(7, 20); g.lineTo(5, 8); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(11, 12); g.lineTo(21, 12); g.moveTo(11, 18); g.lineTo(21, 18); g.stroke(); },
    shield(g) { g.beginPath(); g.moveTo(16, 3); g.lineTo(27, 8); g.lineTo(25, 20); g.lineTo(16, 29); g.lineTo(7, 20); g.lineTo(5, 8); g.closePath(); g.fill(); },
    engine(g) { g.fillRect(4, 11, 14, 10); g.beginPath(); g.moveTo(18, 9); g.lineTo(24, 6); g.lineTo(24, 26); g.lineTo(18, 23); g.closePath(); g.fill(); g.beginPath(); g.moveTo(26, 10); g.lineTo(30, 16); g.lineTo(26, 22); g.stroke(); },
    tractor(g) { for (let i = 0; i < 3; ++i) { g.beginPath(); g.arc(8, 16, 6 + i * 7, -0.7, 0.7); g.stroke(); } g.beginPath(); g.arc(8, 16, 3, 0, TAU); g.fill(); },
    refinery(g) { g.fillRect(5, 14, 10, 14); g.fillRect(17, 8, 10, 20); g.fillRect(8, 6, 4, 8); g.beginPath(); g.arc(10, 4, 3, 0, TAU); g.stroke(); },
    drone(g) { g.beginPath(); g.arc(16, 16, 6, 0, TAU); g.fill(); for (let i = 0; i < 3; ++i) { const a = i * TAU / 3 - Math.PI / 2; g.beginPath(); g.moveTo(16, 16); g.lineTo(16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13); g.stroke(); g.beginPath(); g.arc(16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13, 2.5, 0, TAU); g.fill(); } },
    scan(g) { g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.stroke(); g.beginPath(); g.arc(16, 16, 6, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(16, 16); g.lineTo(26, 8); g.stroke(); g.beginPath(); g.arc(22, 20, 2, 0, TAU); g.fill(); },
    trade(g) { g.beginPath(); g.moveTo(4, 12); g.lineTo(26, 12); g.lineTo(21, 7); g.moveTo(28, 21); g.lineTo(6, 21); g.lineTo(11, 26); g.stroke(); },
    crack(g) { g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(10, 6); g.lineTo(15, 14); g.lineTo(12, 19); g.lineTo(18, 27); g.moveTo(15, 14); g.lineTo(24, 12); g.stroke(); },
    crosshair(g) { g.beginPath(); g.arc(16, 16, 10, 0, TAU); g.moveTo(16, 2); g.lineTo(16, 10); g.moveTo(16, 22); g.lineTo(16, 30); g.moveTo(2, 16); g.lineTo(10, 16); g.moveTo(22, 16); g.lineTo(30, 16); g.stroke(); },
    nugget(g) { g.beginPath(); g.moveTo(16, 4); g.lineTo(26, 13); g.lineTo(21, 27); g.lineTo(10, 27); g.lineTo(6, 13); g.closePath(); g.fill(); },
    gem(g) { g.beginPath(); g.moveTo(8, 6); g.lineTo(24, 6); g.lineTo(29, 13); g.lineTo(16, 28); g.lineTo(3, 13); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(3, 13); g.lineTo(29, 13); g.moveTo(12, 6); g.lineTo(16, 28); g.lineTo(20, 6); g.stroke(); },
    split(g) { g.beginPath(); g.moveTo(3, 16); g.lineTo(13, 16); g.lineTo(28, 6); g.moveTo(13, 16); g.lineTo(28, 26); g.stroke(); },
    blast(g) { g.beginPath(); for (let i = 0; i < 16; ++i) { const r = i % 2 ? 6 : 14; const a = i * TAU / 16; g.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); } g.closePath(); g.fill(); },
    flame(g) { g.beginPath(); g.moveTo(16, 3); g.quadraticCurveTo(28, 16, 22, 26); g.quadraticCurveTo(16, 31, 10, 26); g.quadraticCurveTo(4, 16, 16, 3); g.fill(); },
    vector(g) { g.beginPath(); g.moveTo(4, 26); g.lineTo(16, 6); g.lineTo(28, 26); g.moveTo(10, 20); g.lineTo(22, 20); g.stroke(); },
    warp(g) { for (let i = 0; i < 4; ++i) { g.beginPath(); g.moveTo(3 + i * 3, 8 + i * 5); g.lineTo(29 - i * 3, 8 + i * 5); g.stroke(); } },
    compress(g) { g.strokeRect(8, 8, 16, 16); g.beginPath(); g.moveTo(16, 1); g.lineTo(16, 7); g.moveTo(12, 4); g.lineTo(16, 8); g.lineTo(20, 4); g.moveTo(16, 31); g.lineTo(16, 25); g.moveTo(12, 28); g.lineTo(16, 24); g.lineTo(20, 28); g.stroke(); },
    contract(g) { g.strokeRect(7, 4, 18, 24); g.beginPath(); g.moveTo(11, 10); g.lineTo(21, 10); g.moveTo(11, 15); g.lineTo(21, 15); g.moveTo(11, 20); g.lineTo(17, 20); g.stroke(); },
    chip(g) { g.strokeRect(9, 9, 14, 14); g.beginPath(); for (let i = 0; i < 3; ++i) { g.moveTo(12 + i * 4, 4); g.lineTo(12 + i * 4, 9); g.moveTo(12 + i * 4, 23); g.lineTo(12 + i * 4, 28); g.moveTo(4, 12 + i * 4); g.lineTo(9, 12 + i * 4); g.moveTo(23, 12 + i * 4); g.lineTo(28, 12 + i * 4); } g.stroke(); },
    turret(g) { g.beginPath(); g.arc(16, 20, 8, Math.PI, 0); g.fill(); g.fillRect(6, 20, 20, 6); g.fillRect(15, 4, 3, 14); },
    rad(g) { g.beginPath(); g.arc(16, 16, 3, 0, TAU); g.fill(); for (let i = 0; i < 3; ++i) { const a = i * TAU / 3 - Math.PI / 2; g.beginPath(); g.moveTo(16, 16); g.arc(16, 16, 13, a - 0.5, a + 0.5); g.closePath(); g.fill(); } },
    data(g) { for (let i = 0; i < 3; ++i) { g.beginPath(); g.ellipse(16, 8 + i * 8, 11, 4, 0, 0, TAU); g.stroke(); } },
    geode(g) { g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(10, 20); g.lineTo(14, 10); g.lineTo(17, 18); g.lineTo(21, 9); g.lineTo(23, 20); g.closePath(); g.fill(); },
    derelict(g) { g.beginPath(); g.moveTo(3, 12); g.lineTo(14, 10); g.lineTo(13, 22); g.lineTo(3, 20); g.closePath(); g.moveTo(17, 9); g.lineTo(28, 12); g.lineTo(28, 20); g.lineTo(18, 23); g.closePath(); g.stroke(); },
    station(g) { g.beginPath(); g.arc(16, 16, 11, 0, TAU); g.stroke(); g.fillRect(13, 2, 6, 28); g.fillRect(2, 13, 28, 6); },
    clock(g) { g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.moveTo(16, 8); g.lineTo(16, 16); g.lineTo(22, 19); g.stroke(); },
    calendar(g) { g.strokeRect(5, 7, 22, 20); g.fillRect(5, 7, 22, 5); g.fillRect(9, 3, 3, 6); g.fillRect(20, 3, 3, 6); g.fillRect(10, 16, 4, 4); g.fillRect(18, 20, 4, 4); },
    star(g) { g.beginPath(); for (let i = 0; i < 10; ++i) { const r = i % 2 ? 6 : 14; const a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r); } g.closePath(); g.fill(); },
    map(g) { g.beginPath(); g.moveTo(4, 8); g.lineTo(12, 5); g.lineTo(20, 8); g.lineTo(28, 5); g.lineTo(28, 25); g.lineTo(20, 28); g.lineTo(12, 25); g.lineTo(4, 28); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(12, 5); g.lineTo(12, 25); g.moveTo(20, 8); g.lineTo(20, 28); g.stroke(); },
    tree(g) { g.beginPath(); g.arc(16, 6, 4, 0, TAU); g.arc(7, 25, 4, 0, TAU); g.fill(); g.beginPath(); g.arc(25, 25, 4, 0, TAU); g.fill(); g.beginPath(); g.moveTo(16, 10); g.lineTo(16, 16); g.lineTo(7, 21); g.moveTo(16, 16); g.lineTo(25, 21); g.stroke(); },
    help(g) { g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.stroke(); g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 16, 17); },
    launch(g) { g.beginPath(); g.moveTo(16, 3); g.lineTo(22, 14); g.lineTo(22, 24); g.lineTo(10, 24); g.lineTo(10, 14); g.closePath(); g.fill(); g.beginPath(); g.moveTo(12, 27); g.lineTo(16, 31); g.lineTo(20, 27); g.stroke(); },
    back(g) { g.beginPath(); g.moveTo(14, 6); g.lineTo(4, 16); g.lineTo(14, 26); g.moveTo(4, 16); g.lineTo(28, 16); g.stroke(); },
    trophy(g) { g.beginPath(); g.moveTo(9, 5); g.lineTo(23, 5); g.lineTo(21, 16); g.quadraticCurveTo(16, 21, 11, 16); g.closePath(); g.fill(); g.fillRect(14, 18, 4, 6); g.fillRect(9, 24, 14, 4); },
    coin(g) { g.beginPath(); g.arc(16, 16, 11, 0, TAU); g.fill(); },
    gas(g) { g.beginPath(); g.arc(11, 12, 6, 0, TAU); g.arc(20, 10, 7, 0, TAU); g.arc(24, 17, 5, 0, TAU); g.fill(); g.beginPath(); g.moveTo(8, 29); g.lineTo(14, 21); g.lineTo(20, 21); g.lineTo(26, 29); g.stroke(); },
  };

  function iconSprite(kind, color) {
    return K.sprite('icon:' + kind + ':' + color, 32, 32, (g) => {
      g.strokeStyle = color;
      g.fillStyle = color;
      g.lineWidth = 2.2;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      (ICONS[kind] || ICONS.star)(g);
    });
  }

  function icon(ctx, kind, x, y, size, color) {
    K.blit(ctx, iconSprite(kind, color), x, y, size / 32);
  }

  Object.assign(NS.propArt, {
    dock, pirate, freighter, post, derelict, well, radCloud, charge, iconSprite, icon, ICONS
  });
})();
