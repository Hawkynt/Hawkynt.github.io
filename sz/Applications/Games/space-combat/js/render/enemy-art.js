/* Hostile and allied art: the ten enemy designs (hull-painter specs plus custom swarmer, sentry
   and outpost), the boss cores and parts (Warden, Hydra, Solaris, Maw with open and shut jaws,
   Overmind and its shards), the convoy freighter and the relay station. All cached. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const K = NS.artKit;
  const S = NS.shipArt;
  const TAU = Math.PI * 2;

  const PAL = {
    fighter: { hull: '#6c7184', dark: '#272a34', trim: '#e0303a', glow: '#ff6a3a' },
    interceptor: { hull: '#857060', dark: '#2e2620', trim: '#ff8a20', glow: '#ffc050' },
    bomber: { hull: '#64705e', dark: '#232a22', trim: '#d0a020', glow: '#ff5a2a' },
    frigate: { hull: '#7a8090', dark: '#2a2e38', trim: '#ff7a2a', glow: '#ffd070' },
    cloaker: { hull: '#463462', dark: '#1a1226', trim: '#c070ff', glow: '#f0b0ff' },
    carrier: { hull: '#6e5258', dark: '#28181c', trim: '#ff4a4a', glow: '#ff9a6a' },
    lancer: { hull: '#c8ccd8', dark: '#3a3e4a', trim: '#ff3a4a', glow: '#ff7a7a' },
    hydra: { hull: '#8a3c3c', dark: '#3a1414', trim: '#e8d4a8', glow: '#ffb040' },
    solaris: { hull: '#c8a466', dark: '#4a3018', trim: '#ff6a20', glow: '#ffe890' },
    freighter: { hull: '#c8d4e4', dark: '#4a5468', trim: '#3a8cff', glow: '#9ad8ff' },
  };

  const SPECS = {
    fighter: {
      size: 56, span: 22,
      layers: [
        { pts: [[10, -6], [19, -18], [13, -22.5], [-4, -16], [-12, -6]], fill: 'dark' },
        { pts: [[19, -18], [13, -22.5], [11, -20.5], [15.5, -17]], fill: 'trim' },
        { pts: [[21, 0], [12, -5], [-8, -7], [-16, -4], [-16, 0]], fill: 'hull' },
        { pts: [[12, 0], [6, -2.4], [-10, -2.4], [-13, 0]], fill: 'dark', ridge: true },
        { lines: [[4, -6, -2, -15], [14, -3.6, -8, -6]] },
        { light: [11, 0, 2.2], mirror: false },
      ],
      engines: [[-16, -3, 2.6], [-16, 3, 2.6]],
    },
    interceptor: {
      size: 50, span: 18,
      layers: [
        { pts: [[22, -5], [10, -4], [-4, -8], [-14, -14.5], [-16.5, -11], [-8, -3]], fill: 'hull' },
        { pts: [[22, -5], [16, -5], [16, -6.8], [22, -6.4]], fill: 'trim' },
        { pts: [[14, 0], [6, -3], [-12, -3], [-18, 0]], fill: 'dark', ridge: true },
        { lines: [[8, -4.5, -10, -12]] },
        { light: [7, 0, 2], mirror: false },
      ],
      engines: [[-18, 0, 2.8]],
    },
    bomber: {
      size: 76, span: 28,
      layers: [
        { pts: [[23, -6], [27, -22], [18, -27], [11, -10]], fill: 'hull' },
        { pts: [[25, -20], [20, -25], [18, -23], [22.5, -18.5]], fill: 'trim' },
        { pts: [[22, 0], [18, -8], [-10, -12.5], [-26, -10], [-28, 0]], fill: 'hull' },
        { pts: [[14, 0], [10, -5], [-18, -6], [-22, 0]], fill: 'dark', ridge: true },
        { lines: [[4, -11, -4, -6], [-12, -12, -20, -6]] },
        { light: [21, -16, 2.4], mirror: true },
        { light: [-6, 0, 3], mirror: false },
      ],
      engines: [[-28, -5, 3.6], [-28, 5, 3.6]],
    },
    frigate: {
      size: 112, span: 40,
      layers: [
        { pts: [[20, -16], [12, -27], [-20, -29], [-29, -18]], fill: 'dark' },
        { pts: [[10, -26], [-14, -27.5], [-14, -25], [10, -24]], fill: 'trim' },
        { pts: [[45, 0], [36, -10], [10, -16.5], [-30, -18], [-42, -12], [-45, 0]], fill: 'hull' },
        { pts: [[30, -11], [22, -13], [22, -15], [30, -13]], fill: 'trim' },
        { pts: [[6, 0], [2, -6], [-14, -6.5], [-18, 0]], fill: 'dark', ridge: true },
        { lines: [[28, -9, -36, -12], [10, -15, 10, -7], [-10, -17, -10, -7], [-26, -17.5, -26, -8]] },
        { light: [37, 0, 2.6], mirror: false },
        { glass: [-4, 0, 4, 2.4] },
      ],
      engines: [[-45, -8, 4.4], [-45, 0, 4.4], [-45, 8, 4.4]],
    },
    cloaker: {
      size: 56, span: 23,
      layers: [
        { pts: [[20, -2], [6, -10], [-6, -22.5], [-14.5, -20.5], [-10, -8], [-18, -4]], fill: 'hull' },
        { pts: [[-6, -22.5], [-14.5, -20.5], [-12, -18.5], [-6, -19.5]], fill: 'trim' },
        { pts: [[22, 0], [10, -4], [-14, -4], [-18, 0]], fill: 'dark', ridge: true },
        { lines: [[4, -9, -10, -18]] },
        { light: [12, 0, 2.2], mirror: false },
      ],
      engines: [[-18, 0, 2.4]],
    },
    carrier: {
      size: 160, span: 32,
      layers: [
        { pts: [[70, 0], [60, -14], [20, -26], [-40, -30], [-66, -22], [-70, 0]], fill: 'hull' },
        { pts: [[0, -14], [-6, -21], [-24, -21], [-28, -14]], fill: 'dark' },
        { pts: [[50, 0], [44, -6], [-50, -8], [-56, 0]], fill: 'dark', ridge: true },
        { pts: [[30, -24], [10, -24.5], [10, -20], [30, -20]], fill: 'glow' },
        { pts: [[-6, -26.5], [-26, -27.5], [-26, -23], [-6, -22.5]], fill: 'glow' },
        { pts: [[64, -10], [56, -14], [56, -16], [64, -12]], fill: 'trim' },
        { lines: [[40, -20, -60, -24], [36, -7, -48, -9], [-40, -28, -40, -9]] },
        { light: [-46, -16, 2], mirror: true },
        { glass: [56, 0, 6, 3] },
      ],
      engines: [[-70, -14, 5], [-70, 0, 6], [-70, 14, 5]],
    },
    lancer: {
      size: 66, span: 20,
      layers: [
        { pts: [[32, -6], [18, -4], [4, -7], [-6, -12], [-10, -10], [2, -4]], fill: 'dark' },
        { pts: [[-12, -4], [-22, -12], [-24.5, -10], [-18, -3]], fill: 'trim' },
        { pts: [[30, 0], [20, -3], [-10, -5], [-20, -3], [-22, 0]], fill: 'hull' },
        { lines: [[16, -3.4, -14, -4.4]] },
        { light: [25, 0, 2.2], mirror: false },
        { light: [32, -6, 1.6], mirror: true },
      ],
      engines: [[-22, 0, 2.6]],
    },
    hydra: {
      size: 124, span: 46,
      layers: [
        { pts: [[54, -14], [40, -10], [26, -16], [34, -30], [50, -26]], fill: 'trim' },
        { pts: [[48, 0], [36, -9], [18, -26], [-8, -34], [-30, -28], [-44, -12], [-46, 0]], fill: 'hull' },
        { pts: [[20, -26], [4, -40], [-10, -38], [-4, -30]], fill: 'dark' },
        { pts: [[-12, -34], [-26, -46], [-36, -42], [-26, -28]], fill: 'dark' },
        { pts: [[30, 0], [16, -10], [-24, -12], [-36, 0]], fill: 'dark', ridge: true },
        { lines: [[10, -24, -6, -12], [-14, -30, -20, -14], [-30, -26, -32, -10], [36, -8, 20, -4]] },
        { light: [26, -14, 4], mirror: true },
      ],
      engines: [],
    },
    solaris: {
      size: 230, span: 100,
      layers: [
        { pts: [[-30, -40], [-60, -98], [-96, -100], [-104, -70], [-80, -36]], fill: 'dark' },
        { pts: [[60, -50], [36, -100], [10, -106], [4, -60]], fill: 'hull' },
        { pts: [[40, -98], [14, -104], [12, -98], [36, -94]], fill: 'trim' },
        { pts: [[104, 0], [90, -22], [40, -50], [-40, -60], [-96, -40], [-108, 0]], fill: 'hull' },
        { pts: [[80, 0], [64, -16], [-30, -26], [-80, -18], [-90, 0]], fill: 'dark', ridge: true },
        { pts: [[96, -12], [70, -28], [66, -24], [90, -8]], fill: 'trim' },
        { lines: [[50, -44, -60, -54], [20, -48, 20, -20], [-20, -56, -20, -24], [-60, -48, -60, -20], [0, -60, 30, -100]] },
        { light: [-10, 0, 14], mirror: false },
        { light: [70, -30, 3], mirror: true },
      ],
      engines: [[-108, -24, 9], [-108, 0, 11], [-108, 24, 9]],
    },
    freighter: {
      size: 132, span: 40,
      layers: [
        { pts: [[58, 0], [50, -12], [30, -16], [-48, -16], [-58, -10], [-60, 0]], fill: 'hull' },
        { pts: [[24, -22], [-8, -22], [-8, -15], [24, -15]], fill: 'dark' },
        { pts: [[-12, -22], [-44, -22], [-44, -15], [-12, -15]], fill: 'dark' },
        { pts: [[22, -21], [-6, -21], [-6, -18], [22, -18]], fill: 'trim' },
        { pts: [[-14, -21], [-42, -21], [-42, -18], [-14, -18]], fill: 'trim' },
        { pts: [[44, 0], [38, -6], [-50, -6], [-54, 0]], fill: 'dark', ridge: true },
        { lines: [[30, -15, 30, -6], [-48, -15, -48, -6]] },
        { glass: [48, 0, 6, 4] },
      ],
      engines: [[-60, -8, 5], [-60, 8, 5]], lights: [[-40, -22], [-40, 22]],
    },
  };

  function specSprite(id) {
    const spec = SPECS[id];
    return K.sprite('enemy:' + id, spec.size, spec.size, (g, w, h) => S.paintSpec(g, spec, PAL[id], 0, w / 2, h / 2));
  }

  /* ── custom painters ── */
  function paintDrone(g, w) {
    const c = w / 2;
    g.fillStyle = '#1e2a18';
    for (let i = 0; i < 6; ++i) {
      const a = i * TAU / 6;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * 15, c + Math.sin(a) * 15);
      g.lineTo(c + Math.cos(a + 0.35) * 8, c + Math.sin(a + 0.35) * 8);
      g.lineTo(c + Math.cos(a - 0.35) * 8, c + Math.sin(a - 0.35) * 8);
      g.closePath();
      g.fill();
    }
    const gr = g.createRadialGradient(c - 3, c - 3, 1, c, c, 11);
    gr.addColorStop(0, '#d8ff9a');
    gr.addColorStop(0.45, '#6ab83a');
    gr.addColorStop(1, '#16300e');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(c, c, 10, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#120a08';
    g.beginPath();
    g.arc(c + 4, c, 4.6, 0, TAU);
    g.fill();
    const eg = g.createRadialGradient(c + 5, c, 0, c + 5, c, 4);
    eg.addColorStop(0, '#ffffff');
    eg.addColorStop(0.4, '#ff5a3a');
    eg.addColorStop(1, 'rgba(255,40,20,0)');
    g.fillStyle = eg;
    g.fillRect(c, c - 5, 10, 10);
  }

  function metalDisc(g, cx, cy, r, base) {
    const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    gr.addColorStop(0, K.shade(base, 0.45));
    gr.addColorStop(0.5, base);
    gr.addColorStop(1, K.shade(base, -0.6));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.lineWidth = 1.2;
    g.stroke();
  }

  function paintTurretBase(g, w) {
    const c = w / 2;
    g.beginPath();
    for (let i = 0; i < 6; ++i) {
      const a = i * TAU / 6 + TAU / 12;
      g.lineTo(c + Math.cos(a) * 22, c + Math.sin(a) * 22);
    }
    g.closePath();
    const gr = g.createLinearGradient(0, 0, w, w);
    gr.addColorStop(0, '#9aa0b0');
    gr.addColorStop(0.5, '#4a4e5c');
    gr.addColorStop(1, '#1c1e26');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.lineWidth = 1.4;
    g.stroke();
    g.strokeStyle = '#d0303a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(c, c, 17, 0, TAU);
    g.stroke();
    for (let i = 0; i < 6; ++i) {
      const a = i * TAU / 6;
      g.fillStyle = '#c8ccd8';
      g.beginPath();
      g.arc(c + Math.cos(a) * 19.5, c + Math.sin(a) * 19.5, 1.2, 0, TAU);
      g.fill();
    }
  }

  function paintBarrel(g, w) {
    const c = w / 2;
    g.fillStyle = '#2a2c34';
    g.fillRect(c, c - 6, 24, 4);
    g.fillRect(c, c + 2, 24, 4);
    g.fillStyle = '#8a90a0';
    g.fillRect(c + 18, c - 6.5, 6, 5);
    g.fillRect(c + 18, c + 1.5, 6, 5);
    metalDisc(g, c, c, 11, '#6a6e7c');
    const gr = g.createRadialGradient(c, c, 0, c, c, 5);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.4, '#ff5a3a');
    gr.addColorStop(1, 'rgba(255,60,30,0)');
    g.fillStyle = gr;
    g.fillRect(c - 6, c - 6, 12, 12);
  }

  function paintRingStation(g, w, opt) {
    const c = w / 2;
    const R = opt.r;
    /* docking arms */
    for (let i = 0; i < opt.arms; ++i) {
      const a = i * TAU / opt.arms;
      g.save();
      g.translate(c, c);
      g.rotate(a);
      g.fillStyle = opt.dark;
      g.fillRect(R * 0.2, -4, R * 1.05, 8);
      g.fillStyle = opt.trim;
      g.fillRect(R * 1.05, -6, 8, 12);
      g.restore();
    }
    /* outer ring */
    g.beginPath();
    g.arc(c, c, R, 0, TAU);
    g.arc(c, c, R * 0.72, 0, TAU, true);
    const gr = g.createLinearGradient(c - R, c - R, c + R, c + R);
    gr.addColorStop(0, K.shade(opt.hull, 0.45));
    gr.addColorStop(0.5, opt.hull);
    gr.addColorStop(1, K.shade(opt.hull, -0.65));
    g.fillStyle = gr;
    g.fill('evenodd');
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
    /* ring segments and windows */
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 1;
    for (let i = 0; i < opt.segs; ++i) {
      const a = i * TAU / opt.segs;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * R * 0.72, c + Math.sin(a) * R * 0.72);
      g.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
      g.stroke();
      const wa = a + TAU / opt.segs / 2;
      g.fillStyle = i % 3 === 0 ? opt.trim : K.rgba(opt.glow, 0.85);
      g.beginPath();
      g.arc(c + Math.cos(wa) * R * 0.86, c + Math.sin(wa) * R * 0.86, 1.8, 0, TAU);
      g.fill();
    }
    /* spokes */
    g.strokeStyle = opt.dark;
    g.lineWidth = 5;
    for (let i = 0; i < 4; ++i) {
      const a = i * TAU / 4 + TAU / 8;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * R * 0.3, c + Math.sin(a) * R * 0.3);
      g.lineTo(c + Math.cos(a) * R * 0.74, c + Math.sin(a) * R * 0.74);
      g.stroke();
    }
    /* hub */
    metalDisc(g, c, c, R * 0.34, opt.hull);
    g.strokeStyle = opt.trim;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(c, c, R * 0.26, 0, TAU);
    g.stroke();
    const core = g.createRadialGradient(c, c, 0, c, c, R * 0.2);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, opt.glow);
    core.addColorStop(1, K.rgba(opt.glow, 0));
    g.fillStyle = core;
    g.fillRect(c - R * 0.2, c - R * 0.2, R * 0.4, R * 0.4);
  }

  function paintEmitter(g, w, color) {
    const c = w / 2;
    metalDisc(g, c, c, 20, '#5a5e6c');
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(c, c, 15, 0, TAU);
    g.stroke();
    g.beginPath();
    for (let i = 0; i < 6; ++i) {
      const a = i * TAU / 6;
      g.lineTo(c + Math.cos(a) * 10, c + Math.sin(a) * 10);
    }
    g.closePath();
    const gr = g.createRadialGradient(c - 3, c - 3, 0, c, c, 11);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.4, color);
    gr.addColorStop(1, K.shade(color, -0.6));
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.stroke();
  }

  function paintWarden(g, w) {
    paintRingStation(g, w, { r: 74, arms: 0, segs: 16, hull: '#7a7f92', dark: '#2a2c36', trim: '#e0303a', glow: '#ff6a3a' });
    const c = w / 2;
    /* armour octagon over the hub */
    g.beginPath();
    for (let i = 0; i < 8; ++i) {
      const a = i * TAU / 8 + TAU / 16;
      g.lineTo(c + Math.cos(a) * 38, c + Math.sin(a) * 38);
    }
    g.closePath();
    const gr = g.createLinearGradient(c - 38, c - 38, c + 38, c + 38);
    gr.addColorStop(0, '#b4b8c8');
    gr.addColorStop(0.5, '#5a5e6e');
    gr.addColorStop(1, '#1e2028');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.lineWidth = 1.5;
    g.stroke();
    for (let i = 0; i < 8; ++i) {
      const a = i * TAU / 8;
      g.fillStyle = '#2a1010';
      g.fillRect(c + Math.cos(a) * 26 - 3, c + Math.sin(a) * 26 - 3, 6, 6);
      g.fillStyle = '#ff5a3a';
      g.fillRect(c + Math.cos(a) * 26 - 1.5, c + Math.sin(a) * 26 - 1.5, 3, 3);
    }
    const eye = g.createRadialGradient(c, c, 0, c, c, 18);
    eye.addColorStop(0, '#ffffff');
    eye.addColorStop(0.25, '#ffd070');
    eye.addColorStop(0.6, '#ff3a20');
    eye.addColorStop(1, '#300808');
    g.fillStyle = eye;
    g.beginPath();
    g.arc(c, c, 16, 0, TAU);
    g.fill();
  }

  function paintSegment(g, w) {
    const c = w / 2;
    const p = PAL.hydra;
    for (let s = -1; s <= 1; s += 2) {
      g.fillStyle = p.dark;
      g.beginPath();
      g.moveTo(c - 6, c + s * 18);
      g.lineTo(c - 18, c + s * 32);
      g.lineTo(c + 4, c + s * 20);
      g.closePath();
      g.fill();
    }
    const gr = g.createRadialGradient(c - 6, c - 8, 2, c, c, 28);
    gr.addColorStop(0, K.shade(p.hull, 0.5));
    gr.addColorStop(0.5, p.hull);
    gr.addColorStop(1, K.shade(p.hull, -0.7));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(c, c, 24, 26, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = p.trim;
    g.beginPath();
    g.moveTo(c + 14, c);
    g.lineTo(c - 12, c - 7);
    g.lineTo(c - 12, c + 7);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.arc(c, c, 17, -1.2, 1.2);
    g.stroke();
    const l = g.createRadialGradient(c - 4, c, 0, c - 4, c, 6);
    l.addColorStop(0, '#ffffff');
    l.addColorStop(0.4, p.glow);
    l.addColorStop(1, K.rgba(p.glow, 0));
    g.fillStyle = l;
    g.fillRect(c - 10, c - 6, 12, 12);
  }

  function paintMaw(g, w, open) {
    const c = w / 2;
    const hull = '#4a3a62', dark = '#1a1226', rim = '#3ad0c0';
    /* carapace plates, back to front */
    for (let i = 5; i >= 0; --i) {
      const x = c - 60 + i * 16, rw = 34 + i * 5, rh = 60 + i * 10;
      const gr = g.createLinearGradient(x, c - rh, x, c + rh);
      gr.addColorStop(0, K.shade(hull, 0.35));
      gr.addColorStop(0.5, hull);
      gr.addColorStop(1, K.shade(hull, -0.7));
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, c, rw, rh, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 1.5;
      g.stroke();
      g.strokeStyle = K.rgba(rim, 0.55);
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, c, rw - 4, rh - 5, 0, -1.2, 1.2);
      g.stroke();
    }
    /* mandibles */
    const spread = open ? 0.55 : 0.12;
    for (let s = -1; s <= 1; s += 2) {
      g.save();
      g.translate(c + 40, c + s * 22);
      g.rotate(s * spread);
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(-10, 0);
      g.quadraticCurveTo(30, s * -4, 58, s * -24);
      g.lineTo(44, s * -6);
      g.quadraticCurveTo(24, s * 10, -10, s * 16);
      g.closePath();
      g.fill();
      g.strokeStyle = K.rgba(rim, 0.6);
      g.lineWidth = 1.4;
      g.stroke();
      g.restore();
    }
    /* the mouth: a glowing gullet when open */
    const mr = open ? 30 : 12;
    const mg = g.createRadialGradient(c + 52, c, 0, c + 52, c, mr);
    mg.addColorStop(0, open ? '#ffffff' : '#ff9a6a');
    mg.addColorStop(0.3, open ? '#ffb070' : '#a02a2a');
    mg.addColorStop(0.7, open ? '#ff3a20' : '#401010');
    mg.addColorStop(1, 'rgba(40,0,0,0)');
    g.fillStyle = mg;
    g.beginPath();
    g.ellipse(c + 52, c, mr * 0.8, mr, 0, 0, TAU);
    g.fill();
    /* eyes */
    for (let s = -1; s <= 1; s += 2) {
      const e = g.createRadialGradient(c + 30, c + s * 40, 0, c + 30, c + s * 40, 7);
      e.addColorStop(0, '#ffffff');
      e.addColorStop(0.4, rim);
      e.addColorStop(1, K.rgba(rim, 0));
      g.fillStyle = e;
      g.fillRect(c + 22, c + s * 40 - 8, 16, 16);
    }
  }

  function paintLauncher(g, w) {
    const c = w / 2;
    for (let i = 0; i < 5; ++i) {
      const a = Math.PI + (i - 2) * 0.45;
      g.strokeStyle = '#2a1e3a';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(c, c);
      g.quadraticCurveTo(c + Math.cos(a) * 14, c + Math.sin(a) * 14 + 4, c + Math.cos(a) * 26, c + Math.sin(a) * 26);
      g.stroke();
    }
    const gr = g.createRadialGradient(c - 4, c - 4, 1, c, c, 18);
    gr.addColorStop(0, '#9a7ac8');
    gr.addColorStop(0.5, '#4a3a62');
    gr.addColorStop(1, '#140c20');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(c, c, 17, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(58,208,192,0.6)';
    g.lineWidth = 1.5;
    g.stroke();
    const e = g.createRadialGradient(c + 5, c, 0, c + 5, c, 8);
    e.addColorStop(0, '#ffffff');
    e.addColorStop(0.4, '#3ad0c0');
    e.addColorStop(1, 'rgba(58,208,192,0)');
    g.fillStyle = e;
    g.fillRect(c - 3, c - 8, 16, 16);
  }

  function paintOvermind(g, w) {
    const c = w / 2;
    for (let i = 0; i < 12; ++i) {
      const a = i * TAU / 12;
      const L = i % 2 ? 70 : 82;
      const gr = g.createLinearGradient(c, c, c + Math.cos(a) * L, c + Math.sin(a) * L);
      gr.addColorStop(0, '#2a1048');
      gr.addColorStop(0.7, '#8a4ae0');
      gr.addColorStop(1, '#e0c0ff');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(c + Math.cos(a - 0.16) * 40, c + Math.sin(a - 0.16) * 40);
      g.lineTo(c + Math.cos(a) * L, c + Math.sin(a) * L);
      g.lineTo(c + Math.cos(a + 0.16) * 40, c + Math.sin(a + 0.16) * 40);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 1;
      g.stroke();
    }
    metalDisc(g, c, c, 50, '#3a2a5a');
    const iris = g.createRadialGradient(c, c, 4, c, c, 38);
    iris.addColorStop(0, '#000000');
    iris.addColorStop(0.25, '#1a0a2a');
    iris.addColorStop(0.4, '#7affc0');
    iris.addColorStop(0.65, '#b04aff');
    iris.addColorStop(1, '#1a0830');
    g.fillStyle = iris;
    g.beginPath();
    g.arc(c, c, 38, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 3; ++i) {
      g.beginPath();
      g.arc(c, c, 22 + i * 7, 0, TAU);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.ellipse(c - 12, c - 14, 9, 5, -0.6, 0, TAU);
    g.fill();
  }

  function paintShard(g, w) {
    const c = w / 2;
    const pts = [[c + 24, c], [c + 2, c - 10], [c - 20, c], [c + 2, c + 10]];
    const gr = g.createLinearGradient(c - 20, c - 10, c + 24, c + 10);
    gr.addColorStop(0, '#3a1a6a');
    gr.addColorStop(0.5, '#b07aff');
    gr.addColorStop(1, '#f0e0ff');
    g.fillStyle = gr;
    K.poly(g, pts);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1.2;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.moveTo(c + 24, c);
    g.lineTo(c - 20, c);
    g.moveTo(c + 2, c - 10);
    g.lineTo(c + 2, c + 10);
    g.stroke();
    const e = g.createRadialGradient(c + 2, c, 0, c + 2, c, 7);
    e.addColorStop(0, '#ffffff');
    e.addColorStop(0.5, '#7affc0');
    e.addColorStop(1, 'rgba(122,255,192,0)');
    g.fillStyle = e;
    g.fillRect(c - 6, c - 8, 16, 16);
  }

  /* ── lookups ── */
  const CUSTOM = {
    drone: { size: 34, paint: paintDrone },
    turret: { size: 56, paint: paintTurretBase },
    barrel: { size: 64, paint: paintBarrel },
    station: { size: 196, paint: (g, w) => paintRingStation(g, w, { r: 70, arms: 6, segs: 12, hull: '#70768a', dark: '#2a2c36', trim: '#e0303a', glow: '#ff6a3a' }) },
    relay: { size: 180, paint: (g, w) => paintRingStation(g, w, { r: 64, arms: 4, segs: 12, hull: '#b8c8dc', dark: '#3a4a64', trim: '#3a8cff', glow: '#9ad8ff' }) },
    warden: { size: 196, paint: paintWarden },
    shield: { size: 56, paint: (g, w) => paintEmitter(g, w, '#58c8ff') },
    beam: { size: 56, paint: (g, w) => paintEmitter(g, w, '#ffb040') },
    segment: { size: 72, paint: paintSegment },
    maw: { size: 240, paint: (g, w) => paintMaw(g, w, false) },
    mawOpen: { size: 240, paint: (g, w) => paintMaw(g, w, true) },
    launcher: { size: 60, paint: paintLauncher },
    overmind: { size: 180, paint: paintOvermind },
    shard: { size: 56, paint: paintShard },
  };

  function enemySprite(id) {
    if (SPECS[id]) return specSprite(id);
    const c = CUSTOM[id];
    return K.sprite('enemy:' + id, c.size, c.size, c.paint);
  }

  function enemyFlash(id) {
    return K.silhouette('enemy:' + id, enemySprite(id));
  }

  /* Sprite id for a boss core or part */
  function bossSprite(b) {
    if (b.id === 'hydra') return 'hydra';
    if (b.id === 'solaris') return 'solaris';
    if (b.id === 'maw') return 'maw';
    return b.id;
  }

  function partSprite(pt) {
    switch (pt.type) {
      case 'turret': return 'turret';
      case 'shield': return 'shield';
      case 'beam': return 'beam';
      case 'launcher': return 'launcher';
      case 'shard': return 'shard';
      default: return 'segment';
    }
  }

  Object.assign(NS.enemyArt, {
    PAL, SPECS, enemySprite, enemyFlash, bossSprite, partSprite
  });
})();
