/* Prop art: lit cratered asteroids in four shapes per size, debris chips, scrap, the five
   power-up capsules with icons, data cores, space mines, missiles and rockets, nebula fog
   clouds and the black hole's accretion disc. All painted once and cached. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const K = NS.artKit;
  const TAU = Math.PI * 2;
  const { POWERUPS } = NS.ships;

  const ROCK_TONES = {
    kepler: ['#8a7a6a', '#2a221c'], crimson: ['#8a5a52', '#2a1412'], helios: ['#9a7a5a', '#2a1a10'],
    abyss: ['#5a6a7a', '#141a22'], void: ['#6a5a7a', '#1a1222'],
  };

  function rock(size, variant, tone) {
    const r = [0, 22, 42, 70][size];
    const pad = 6;
    const w = r * 2 + pad * 2;
    return K.sprite('rock:' + size + ':' + variant + ':' + tone, w, w, (g) => {
      const c = w / 2;
      const n = K.valueNoise(size * 131 + variant * 17 + 7);
      const col = ROCK_TONES[tone] || ROCK_TONES.kepler;
      const pts = [];
      const N = 18 + size * 4;
      for (let i = 0; i < N; ++i) {
        const a = i * TAU / N;
        const k = 0.78 + n(Math.cos(a) * 1.6 + variant * 3, Math.sin(a) * 1.6) * 0.3;
        pts.push([c + Math.cos(a) * r * k, c + Math.sin(a) * r * k]);
      }
      K.poly(g, pts);
      const gr = g.createRadialGradient(c - r * 0.4, c - r * 0.45, r * 0.1, c, c, r * 1.1);
      gr.addColorStop(0, K.shade(col[0], 0.35));
      gr.addColorStop(0.5, col[0]);
      gr.addColorStop(1, col[1]);
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      /* craters with lit rims */
      const craters = 3 + size * 3;
      for (let i = 0; i < craters; ++i) {
        const a = n(i * 2.3, 9.1) * TAU, d = n(i * 1.7, 4.4) * r * 0.7;
        const cx = c + Math.cos(a) * d, cy = c + Math.sin(a) * d;
        const cr = r * (0.08 + n(i, 7) * 0.16);
        g.fillStyle = K.rgba(col[1], 0.7);
        g.beginPath();
        g.arc(cx, cy, cr, 0, TAU);
        g.fill();
        g.strokeStyle = K.rgba(K.shade(col[0], 0.5), 0.6);
        g.lineWidth = Math.max(1, cr * 0.18);
        g.beginPath();
        g.arc(cx, cy, cr, 0.4, 2.6);
        g.stroke();
      }
      /* grain */
      for (let i = 0; i < 40 * size; ++i) {
        const x = c + (n(i, 1.3) - 0.5) * r * 2, y = c + (n(1.3, i) - 0.5) * r * 2;
        g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
        g.fillRect(x, y, 1.5, 1.5);
      }
      /* terminator shadow */
      const sh = g.createLinearGradient(c - r, c - r, c + r, c + r);
      sh.addColorStop(0.45, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,6,0.55)');
      g.fillStyle = sh;
      g.fillRect(0, 0, w, w);
      g.restore();
      K.poly(g, pts);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1.2;
      g.stroke();
    });
  }

  function chip(shape, color) {
    return K.sprite('chip:' + shape + ':' + color, 12, 12, (g) => {
      const pts = [
        [[1, 4], [7, 1], [11, 5], [6, 11], [2, 9]],
        [[2, 2], [10, 3], [8, 10], [3, 8]],
        [[1, 6], [6, 1], [11, 7], [5, 10]],
        [[3, 1], [9, 2], [11, 9], [1, 10]],
      ][shape];
      K.poly(g, pts);
      const gr = g.createLinearGradient(0, 0, 12, 12);
      gr.addColorStop(0, K.shade(color, 0.4));
      gr.addColorStop(1, K.shade(color, -0.6));
      g.fillStyle = gr;
      g.fill();
    });
  }

  function scrap() {
    return K.sprite('scrap', 18, 18, (g) => {
      const c = 9;
      g.beginPath();
      for (let i = 0; i < 6; ++i) g.lineTo(c + Math.cos(i * TAU / 6) * 6, c + Math.sin(i * TAU / 6) * 6);
      g.closePath();
      const gr = g.createLinearGradient(3, 3, 15, 15);
      gr.addColorStop(0, '#fff6c0');
      gr.addColorStop(0.5, '#ffc030');
      gr.addColorStop(1, '#8a5a00');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = 'rgba(80,40,0,0.8)';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(c - 2.5, c - 3.5, 2, 2);
    });
  }

  /* Small glyphs for capsules, tree nodes and help pages */
  function icon(g, kind, x, y, s, color) {
    g.save();
    g.translate(x, y);
    g.scale(s / 20, s / 20);
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    switch (kind) {
      case 'shield':
        g.moveTo(0, -9); g.lineTo(8, -5); g.lineTo(6, 4); g.lineTo(0, 9); g.lineTo(-6, 4); g.lineTo(-8, -5); g.closePath(); g.stroke();
        break;
      case 'repair':
      case 'heart':
        g.moveTo(-7, 0); g.lineTo(7, 0); g.moveTo(0, -7); g.lineTo(0, 7); g.stroke();
        break;
      case 'overcharge':
      case 'bolt':
        g.moveTo(2, -9); g.lineTo(-5, 1); g.lineTo(1, 1); g.lineTo(-2, 9); g.lineTo(6, -2); g.lineTo(0, -2); g.closePath(); g.fill();
        break;
      case 'magnet':
        g.arc(0, 0, 6, Math.PI, 0, true); g.moveTo(-6, 0); g.lineTo(-6, -7); g.moveTo(6, 0); g.lineTo(6, -7); g.stroke();
        break;
      case 'ammo':
      case 'missile':
        g.moveTo(-8, 6); g.lineTo(4, -6); g.lineTo(8, -8); g.lineTo(6, -4); g.lineTo(-6, 8); g.closePath(); g.fill();
        break;
      case 'gun':
        g.rect(-8, -3, 12, 6); g.moveTo(4, 0); g.lineTo(9, 0); g.stroke();
        break;
      case 'rate':
        g.moveTo(-8, -5); g.lineTo(-2, 0); g.lineTo(-8, 5); g.moveTo(0, -5); g.lineTo(6, 0); g.lineTo(0, 5); g.stroke();
        break;
      case 'crosshair':
        g.arc(0, 0, 6, 0, TAU); g.moveTo(0, -9); g.lineTo(0, -3); g.moveTo(0, 3); g.lineTo(0, 9); g.moveTo(-9, 0); g.lineTo(-3, 0); g.moveTo(3, 0); g.lineTo(9, 0); g.stroke();
        break;
      case 'blast':
        for (let i = 0; i < 8; ++i) { const a = i * TAU / 8; g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); g.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); }
        g.stroke();
        break;
      case 'star':
        for (let i = 0; i < 10; ++i) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4 : 9; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath(); g.fill();
        break;
      case 'hull':
      case 'plate':
        g.rect(-7, -7, 14, 14); g.moveTo(-7, 0); g.lineTo(7, 0); g.moveTo(0, -7); g.lineTo(0, 7); g.stroke();
        break;
      case 'wrench':
        g.moveTo(-7, 7); g.lineTo(3, -3); g.stroke(); g.beginPath(); g.arc(5, -5, 4, 0, TAU); g.stroke();
        break;
      case 'engine':
      case 'flame':
        g.moveTo(0, -9); g.quadraticCurveTo(8, 0, 0, 9); g.quadraticCurveTo(-8, 0, 0, -9); g.fill();
        break;
      case 'roll':
        g.arc(0, 0, 7, 0.6, Math.PI * 1.7); g.stroke(); g.beginPath(); g.moveTo(4, -9); g.lineTo(7, -4); g.lineTo(1, -4); g.closePath(); g.fill();
        break;
      case 'heat':
        g.rect(-3, -9, 6, 13); g.stroke(); g.beginPath(); g.arc(0, 6, 4, 0, TAU); g.fill();
        break;
      case 'vector':
        g.moveTo(-8, 6); g.lineTo(0, -8); g.lineTo(8, 6); g.moveTo(0, -8); g.lineTo(0, 8); g.stroke();
        break;
      case 'radar':
        g.arc(0, 0, 8, 0, TAU); g.moveTo(0, 0); g.lineTo(6, -5); g.stroke(); g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill();
        break;
      case 'scrap':
        for (let i = 0; i < 6; ++i) g.lineTo(Math.cos(i * TAU / 6) * 8, Math.sin(i * TAU / 6) * 8);
        g.closePath(); g.stroke();
        break;
      case 'drone':
        g.arc(0, 0, 4, 0, TAU); g.moveTo(-9, -5); g.lineTo(-4, -2); g.moveTo(9, -5); g.lineTo(4, -2); g.moveTo(-9, 5); g.lineTo(-4, 2); g.moveTo(9, 5); g.lineTo(4, 2); g.stroke();
        break;
      case 'clover':
        for (let i = 0; i < 4; ++i) { g.moveTo(0, 0); g.arc(Math.cos(i * TAU / 4) * 4, Math.sin(i * TAU / 4) * 4, 4, 0, TAU); }
        g.fill();
        break;
      case 'skin':
      case 'brush':
        g.moveTo(-8, 8); g.lineTo(2, -2); g.stroke(); g.beginPath(); g.arc(5, -5, 5, 0, TAU); g.fill();
        break;
      case 'trail':
        g.moveTo(-9, 4); g.quadraticCurveTo(0, 6, 8, -6); g.moveTo(-9, -2); g.quadraticCurveTo(-2, 0, 4, -8); g.stroke();
        break;
      case 'clock':
        g.arc(0, 0, 8, 0, TAU); g.moveTo(0, 0); g.lineTo(0, -5); g.moveTo(0, 0); g.lineTo(4, 2); g.stroke();
        break;
      case 'target':
        g.arc(0, 0, 8, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
        break;
      case 'convoy':
        g.rect(-9, -4, 12, 8); g.moveTo(3, 0); g.lineTo(9, 0); g.stroke();
        break;
      case 'core':
        g.moveTo(0, -9); g.lineTo(8, 0); g.lineTo(0, 9); g.lineTo(-8, 0); g.closePath(); g.stroke();
        break;
      case 'skull':
        g.arc(0, -2, 7, 0, TAU); g.stroke(); g.beginPath(); g.arc(-3, -2, 2, 0, TAU); g.arc(3, -2, 2, 0, TAU); g.fill();
        g.fillRect(-4, 5, 8, 3);
        break;
      case 'infinity':
        g.moveTo(0, 0); g.bezierCurveTo(4, -7, 10, -3, 8, 0); g.bezierCurveTo(10, 3, 4, 7, 0, 0);
        g.bezierCurveTo(-4, -7, -10, -3, -8, 0); g.bezierCurveTo(-10, 3, -4, 7, 0, 0); g.stroke();
        break;
      default:
        g.arc(0, 0, 6, 0, TAU); g.stroke();
    }
    g.restore();
  }

  function capsule(type) {
    return K.sprite('cap:' + type, 40, 40, (g) => {
      const c = 20;
      const col = POWERUPS[type].color;
      const gl = g.createRadialGradient(c, c, 4, c, c, 20);
      gl.addColorStop(0, K.rgba(col, 0.5));
      gl.addColorStop(1, K.rgba(col, 0));
      g.fillStyle = gl;
      g.fillRect(0, 0, 40, 40);
      g.beginPath();
      for (let i = 0; i < 6; ++i) g.lineTo(c + Math.cos(i * TAU / 6 + TAU / 12) * 13, c + Math.sin(i * TAU / 6 + TAU / 12) * 13);
      g.closePath();
      const gr = g.createLinearGradient(c - 13, c - 13, c + 13, c + 13);
      gr.addColorStop(0, '#2a3450');
      gr.addColorStop(1, '#0a0e1a');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = col;
      g.lineWidth = 2.2;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(c, c, 10, -2.6, -1.2);
      g.stroke();
      icon(g, type, c, c, 14, col);
    });
  }

  function dataCore() {
    return K.sprite('datacore', 48, 48, (g) => {
      const c = 24;
      const gl = g.createRadialGradient(c, c, 2, c, c, 24);
      gl.addColorStop(0, 'rgba(122,255,208,0.6)');
      gl.addColorStop(1, 'rgba(122,255,208,0)');
      g.fillStyle = gl;
      g.fillRect(0, 0, 48, 48);
      const pts = [[c, c - 15], [c + 11, c], [c, c + 15], [c - 11, c]];
      K.poly(g, pts);
      const gr = g.createLinearGradient(c - 11, c - 15, c + 11, c + 15);
      gr.addColorStop(0, '#e0fff4');
      gr.addColorStop(0.5, '#3ad0a0');
      gr.addColorStop(1, '#0a3a2a');
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = '#c8fff0';
      g.lineWidth = 1.4;
      g.stroke();
      g.strokeStyle = 'rgba(0,40,30,0.6)';
      g.beginPath();
      g.moveTo(c, c - 15); g.lineTo(c, c + 15); g.moveTo(c - 11, c); g.lineTo(c + 11, c);
      g.stroke();
    });
  }

  function mine(friendly) {
    return K.sprite(friendly ? 'pmine' : 'hmine', 40, 40, (g) => {
      const c = 20;
      g.fillStyle = friendly ? '#2a3a4a' : '#3a2a2a';
      for (let i = 0; i < 8; ++i) {
        const a = i * TAU / 8;
        g.beginPath();
        g.moveTo(c + Math.cos(a) * 16, c + Math.sin(a) * 16);
        g.lineTo(c + Math.cos(a + 0.3) * 9, c + Math.sin(a + 0.3) * 9);
        g.lineTo(c + Math.cos(a - 0.3) * 9, c + Math.sin(a - 0.3) * 9);
        g.closePath();
        g.fill();
      }
      const gr = g.createRadialGradient(c - 3, c - 3, 1, c, c, 11);
      gr.addColorStop(0, friendly ? '#9ad0ff' : '#c8a0a0');
      gr.addColorStop(0.5, friendly ? '#3a5a7a' : '#6a3a3a');
      gr.addColorStop(1, '#100808');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(c, c, 10, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.stroke();
    });
  }

  function missile(hostile) {
    return K.sprite(hostile ? 'rocket' : 'missile', 24, 12, (g) => {
      g.fillStyle = hostile ? '#6a2a2a' : '#c8ccd8';
      g.beginPath();
      g.moveTo(22, 6); g.lineTo(16, 3); g.lineTo(4, 3); g.lineTo(4, 9); g.lineTo(16, 9); g.closePath();
      g.fill();
      g.fillStyle = hostile ? '#ff6a3a' : '#ff9a2a';
      g.fillRect(4, 1, 4, 10);
      g.fillStyle = hostile ? '#ffb090' : '#3a8cff';
      g.fillRect(16, 4.5, 3, 3);
    });
  }

  /* A lumpy fog cloud of the sector's colour (drawn over the battle); painted at a quarter of
     its size - blit it with scale 4 */
  function nebula(seed, r, colors) {
    const size = Math.round(r * 2.3 / 4);
    const lo = Math.max(48, Math.min(120, Math.round(size / 2)));
    return K.sprite('neb:' + seed + ':' + r, size, size, (g, w) => {
      const c = K.makeCanvas(lo, lo);
      const cg = c.getContext('2d');
      const img = cg.createImageData(lo, lo);
      const n = K.valueNoise(seed);
      const a = K.parse(colors[1]), b = K.parse(colors[2]);
      for (let y = 0; y < lo; ++y)
        for (let x = 0; x < lo; ++x) {
          const dx = x / lo - 0.5, dy = y / lo - 0.5;
          const d = Math.sqrt(dx * dx + dy * dy) * 2;
          const v = K.fbm(n, x / lo * 4, y / lo * 4, 4);
          const dens = K.smooth(1, 0.35, d + (v - 0.5) * 0.7) * K.smooth(0.25, 0.75, v + 0.15);
          const t = Math.min(1, v * 1.3);
          const i = (y * lo + x) * 4;
          img.data[i] = a[0] + (b[0] - a[0]) * t;
          img.data[i + 1] = a[1] + (b[1] - a[1]) * t;
          img.data[i + 2] = a[2] + (b[2] - a[2]) * t;
          img.data[i + 3] = dens * 200;
        }
      cg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(c, 0, 0, w, w);
    });
  }

  function blackHole(r) {
    const size = r * 9;
    return K.sprite('hole:' + r, size, size, (g, w) => {
      const c = w / 2;
      const halo = g.createRadialGradient(c, c, r, c, c, w / 2);
      halo.addColorStop(0, 'rgba(255,200,140,0.5)');
      halo.addColorStop(0.25, 'rgba(255,140,80,0.22)');
      halo.addColorStop(0.6, 'rgba(90,160,255,0.08)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, w, w);
      /* accretion disc: hot streaks spiralling in */
      g.save();
      g.translate(c, c);
      g.scale(1, 0.42);
      for (let i = 0; i < 70; ++i) {
        const rr = r * (1.3 + (i % 14) * 0.18);
        const a0 = i * 2.39;
        g.strokeStyle = i % 3 ? 'rgba(255,180,110,0.35)' : 'rgba(255,240,210,0.55)';
        g.lineWidth = 1.5 + (i % 4);
        g.beginPath();
        g.arc(0, 0, rr, a0, a0 + 1.2);
        g.stroke();
      }
      g.restore();
      /* lensed photon ring */
      g.strokeStyle = 'rgba(255,230,190,0.9)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(c, c, r * 1.12, 0, TAU);
      g.stroke();
      const core = g.createRadialGradient(c, c, 0, c, c, r * 1.1);
      core.addColorStop(0, '#000000');
      core.addColorStop(0.85, '#000000');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = core;
      g.beginPath();
      g.arc(c, c, r * 1.1, 0, TAU);
      g.fill();
    });
  }

  Object.assign(NS.propArt, {
    rock, chip, scrap, capsule, dataCore, mine, missile, nebula, blackHole, icon
  });
})();
