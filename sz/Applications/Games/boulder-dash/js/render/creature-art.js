/* Cached art for everything that is not the miner or a tile: creature frames (spinning
   fireflies, flapping butterflies, digging moles, ice bats), the five bosses in two frames plus
   a white hit flash, the power-up and seasonal-token icons, and the glowing item bubbles placed
   in the cave. Owns its cache. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const I = NS.items;
  const T = C.TILE;

  const cache = {};

  function firefly(f) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.drawImage(K.glow('#ff8a2a'), -4, -4, T + 8, T + 8);
    x.save();
    x.translate(T / 2, T / 2);
    x.rotate(f / 4 * Math.PI / 2);
    x.strokeStyle = '#ffd08a';
    x.lineWidth = 3;
    x.strokeRect(-11, -11, 22, 22);
    x.rotate(Math.PI / 4);
    x.strokeStyle = '#ff6a1a';
    x.lineWidth = 2;
    x.strokeRect(-8, -8, 16, 16);
    x.restore();
    K.orb(x, T / 2, T / 2, 5, '#ffe2a0', '#ffffff', '#ff8a2a');
    return c;
  }

  function butterfly(f) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.drawImage(K.glow('#5fd6ff'), 0, 0, T, T);
    const open = [1, 0.7, 0.35, 0.7][f];
    x.save();
    x.translate(T / 2, T / 2);
    for (const s of [-1, 1]) {
      x.save();
      x.scale(s * open, 1);
      const g = x.createLinearGradient(0, -14, 16, 10);
      g.addColorStop(0, '#bff4ff'); g.addColorStop(0.5, '#3ab8f0'); g.addColorStop(1, '#2a4ad0');
      x.fillStyle = g;
      x.beginPath(); x.moveTo(0, -2); x.quadraticCurveTo(18, -20, 17, -3); x.quadraticCurveTo(14, 2, 0, 0); x.fill();
      x.beginPath(); x.moveTo(0, 1); x.quadraticCurveTo(15, 4, 11, 13); x.quadraticCurveTo(5, 13, 0, 3); x.fill();
      x.fillStyle = '#ffffff';
      x.beginPath(); x.arc(11, -8, 2, 0, C.TAU); x.fill();
      x.restore();
    }
    x.fillStyle = '#1a1a2a';
    x.fillRect(-1.5, -8, 3, 16);
    x.strokeStyle = '#1a1a2a'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, -8); x.lineTo(-4, -14); x.moveTo(0, -8); x.lineTo(4, -14); x.stroke();
    x.restore();
    return c;
  }

  function mole(f) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.3)';
    x.beginPath(); x.ellipse(T / 2, T - 5, 14, 3, 0, 0, C.TAU); x.fill();
    K.orb(x, T / 2, T / 2 + 3, 14, '#8a6448', '#c9a27a', '#4a3020');
    x.fillStyle = '#ff9ab0';
    x.beginPath(); x.arc(T / 2, T / 2 + 6, 4, 0, C.TAU); x.fill();
    x.fillStyle = '#10080a';
    x.beginPath(); x.arc(T / 2 - 6, T / 2 - 2, 1.6, 0, C.TAU); x.arc(T / 2 + 6, T / 2 - 2, 1.6, 0, C.TAU); x.fill();
    x.fillStyle = '#f0e6d0';
    const o = f ? 2 : 0;
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(T / 2 + s * 10, T / 2 + 8 - o); x.lineTo(T / 2 + s * 18, T / 2 + 6 - o); x.lineTo(T / 2 + s * 16, T / 2 + 10); x.lineTo(T / 2 + s * 19, T / 2 + 12 + o); x.lineTo(T / 2 + s * 11, T / 2 + 13);
      x.fill();
    }
    return c;
  }

  function bat(f) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.drawImage(K.glow('#bfe6ff'), 4, 4, T - 8, T - 8);
    const lift = [-8, 0, 7][f];
    x.fillStyle = '#5a7aa8';
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(T / 2, T / 2);
      x.lineTo(T / 2 + s * 18, T / 2 + lift - 4);
      x.lineTo(T / 2 + s * 14, T / 2 + lift + 3);
      x.lineTo(T / 2 + s * 10, T / 2 + lift / 2 + 2);
      x.lineTo(T / 2 + s * 6, T / 2 + 5);
      x.fill();
    }
    K.orb(x, T / 2, T / 2 + 1, 7, '#9ab8e0', '#e8f6ff', '#3a5a88');
    x.fillStyle = '#9ab8e0';
    K.poly(x, [T / 2 - 6, T / 2 - 4, T / 2 - 4, T / 2 - 11, T / 2 - 1, T / 2 - 5]); x.fill();
    K.poly(x, [T / 2 + 6, T / 2 - 4, T / 2 + 4, T / 2 - 11, T / 2 + 1, T / 2 - 5]); x.fill();
    x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(T / 2 - 2.5, T / 2, 1.5, 0, C.TAU); x.arc(T / 2 + 2.5, T / 2, 1.5, 0, C.TAU); x.fill();
    return c;
  }

  function creature(type, f) {
    const key = 'c' + type + '-' + f;
    if (cache[key]) return cache[key];
    let c;
    switch (type) {
      case C.FIREFLY: c = firefly(f % 4); break;
      case C.BUTTERFLY: c = butterfly(f % 4); break;
      case C.MOLE: c = mole(f % 2); break;
      default: c = bat(f % 3);
    }
    cache[key] = c;
    return c;
  }

  /* ── Bosses: 2x2 cells, 80 x 80 ── */
  function drawBoss(kind, f, flash) {
    const S = T * 2;
    const c = K.canvas(S, S), x = c.getContext('2d');
    const def = I.BOSSES[kind];
    const col = flash ? '#ffffff' : def.color;
    const hi = flash ? '#ffffff' : K.lighten(def.color, 0.45), lo = flash ? '#dddddd' : K.darken(def.color, 0.5);
    const eye = def.eye;
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.beginPath(); x.ellipse(S / 2, S - 6, 34, 7, 0, 0, C.TAU); x.fill();
    const b = f ? 2 : 0;
    if (kind === 'grub') {
      for (let k = 3; k >= 0; --k) K.orb(x, 18 + k * 13, 46 + (k % 2 ? b : -b), 16 - k, col, hi, lo);
      x.fillStyle = lo;
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(18, 54); x.quadraticCurveTo(10 + s * 4, 66, 4, 60 + s * 6); x.lineTo(14, 58); x.fill(); }
      x.fillStyle = eye;
      x.beginPath(); x.arc(14, 40, 4, 0, C.TAU); x.arc(24, 38, 4, 0, C.TAU); x.fill();
      x.fillStyle = '#000';
      x.beginPath(); x.arc(13, 40, 1.8, 0, C.TAU); x.arc(23, 38, 1.8, 0, C.TAU); x.fill();
    } else if (kind === 'wyrm') {
      x.strokeStyle = col; x.lineWidth = 16; x.lineCap = 'round';
      x.beginPath(); x.moveTo(70, 66); x.quadraticCurveTo(60, 30 + b, 34, 40); x.stroke();
      K.orb(x, 28, 38, 18, col, hi, lo);
      x.fillStyle = hi;
      for (let k = 0; k < 4; ++k) K.poly(x, [30 + k * 9, 24 - b, 34 + k * 9, 10 - b, 38 + k * 9, 26 - b]), x.fill();
      x.fillStyle = '#e8f8ff';
      K.poly(x, [12, 44, 4, 50, 14, 50]); x.fill();
      x.fillStyle = eye;
      x.beginPath(); x.arc(22, 32, 4.5, 0, C.TAU); x.fill();
      x.fillStyle = '#1a3a60';
      x.beginPath(); x.ellipse(21, 32, 1.5, 3.5, 0, 0, C.TAU); x.fill();
    } else if (kind === 'spore') {
      x.fillStyle = flash ? '#ffffff' : '#e8dcc8';
      K.roundRect(x, 26, 40, 28, 34, 8); x.fill();
      K.orb(x, S / 2, 34 + b, 32, col, hi, lo);
      x.fillStyle = flash ? '#ffffff' : '#9dff6a';
      for (const [dx, dy, r] of [[-16, -6, 5], [4, -14, 6], [18, -2, 4], [-4, 2, 3.5], [10, 8, 3]]) {
        x.beginPath(); x.arc(S / 2 + dx, 34 + dy + b, r, 0, C.TAU); x.fill();
      }
      x.fillStyle = eye;
      x.beginPath(); x.arc(33, 56, 3.5, 0, C.TAU); x.arc(47, 56, 3.5, 0, C.TAU); x.fill();
    } else if (kind === 'titan') {
      K.orb(x, S / 2, 46, 30, flash ? '#ffffff' : '#3a2a26', flash ? '#ffffff' : '#6a5048', flash ? '#cccccc' : '#1a1210');
      x.strokeStyle = flash ? '#ffffff' : '#ff7a2f';
      x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(22, 30); x.lineTo(32, 44); x.lineTo(28, 58); x.moveTo(58, 26); x.lineTo(50, 42); x.lineTo(60, 56); x.stroke();
      x.fillStyle = flash ? '#ffffff' : '#ffd54a';
      x.fillRect(26, 58 - b, 28, 7 + b * 2);
      x.fillStyle = '#1a1210';
      for (let k = 0; k < 5; ++k) K.poly(x, [27 + k * 6, 58 - b, 30 + k * 6, 63, 33 + k * 6, 58 - b]), x.fill();
      x.fillStyle = eye;
      x.beginPath(); x.arc(30, 38, 5, 0, C.TAU); x.arc(50, 38, 5, 0, C.TAU); x.fill();
    } else {
      x.fillStyle = col;
      K.poly(x, [S / 2, 6, 72, 34, 64, 76, 16, 76, 8, 34]); x.fill();
      x.fillStyle = hi;
      K.poly(x, [S / 2, 6, 72, 34, S / 2, 44, 8, 34]); x.fill();
      x.fillStyle = lo;
      K.poly(x, [S / 2, 44, 64, 76, 16, 76]); x.fill();
      x.fillStyle = '#ffd54a';
      K.poly(x, [24, 16, 28, 2, 34, 12, 40, -2, 46, 12, 52, 2, 56, 16]); x.fill();
      x.fillStyle = eye;
      x.beginPath(); x.ellipse(30, 34, 5, 3, 0.3, 0, C.TAU); x.ellipse(50, 34, 5, 3, -0.3, 0, C.TAU); x.fill();
      x.fillStyle = flash ? '#ffffff' : (f ? '#3a1a60' : '#1a0a30');
      K.poly(x, [S / 2, 48, 48, 58, S / 2, 68, 32, 58]); x.fill();
    }
    return c;
  }

  function boss(kind, f, flash) {
    const key = 'b' + kind + f + (flash ? 'w' : '');
    if (!cache[key]) cache[key] = drawBoss(kind, f, flash);
    return cache[key];
  }

  /* ── Icons (32 x 32) ── */
  function drawIcon(key) {
    const c = K.canvas(32, 32), x = c.getContext('2d');
    x.lineCap = 'round';
    switch (key) {
      case 'bomb':
        x.save(); x.translate(16, 17); x.rotate(-0.5);
        x.fillStyle = '#c8301a'; K.roundRect(x, -5, -11, 10, 22, 3); x.fill();
        x.fillStyle = '#f4e6c8'; x.fillRect(-5, -3, 10, 5);
        x.restore();
        x.strokeStyle = '#3a2a20'; x.lineWidth = 2; x.beginPath(); x.moveTo(21, 6); x.quadraticCurveTo(25, 2, 28, 4); x.stroke();
        x.fillStyle = '#ffd54a'; K.star(x, 28, 4, 4, 1.5, 5); x.fill();
        break;
      case 'shield':
        K.orb(x, 16, 18, 11, '#ffd54a', '#fff6b0', '#b08a10');
        x.fillStyle = '#b08a10'; x.fillRect(3, 18, 26, 4);
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(16, 12, 3, 0, C.TAU); x.fill();
        break;
      case 'time':
        x.strokeStyle = '#c8a050'; x.lineWidth = 3; x.beginPath(); x.moveTo(8, 4); x.lineTo(24, 4); x.moveTo(8, 28); x.lineTo(24, 28); x.stroke();
        x.fillStyle = 'rgba(220,240,255,0.7)'; K.poly(x, [9, 6, 23, 6, 17, 16, 23, 26, 9, 26, 15, 16]); x.fill();
        x.fillStyle = '#ffd54a'; K.poly(x, [11, 26, 21, 26, 16, 20]); x.fill(); K.poly(x, [12, 8, 20, 8, 16, 13]); x.fill();
        break;
      case 'magnet':
        x.strokeStyle = '#ff4fa0'; x.lineWidth = 7; x.beginPath(); x.arc(16, 14, 8, Math.PI, 0); x.stroke();
        x.beginPath(); x.moveTo(8, 14); x.lineTo(8, 22); x.moveTo(24, 14); x.lineTo(24, 22); x.stroke();
        x.strokeStyle = '#e8e8f0'; x.beginPath(); x.moveTo(8, 23); x.lineTo(8, 27); x.moveTo(24, 23); x.lineTo(24, 27); x.stroke();
        break;
      case 'drill':
        x.fillStyle = '#5d6b80'; K.roundRect(x, 3, 11, 13, 10, 3); x.fill();
        x.fillStyle = '#c0c8d8'; K.poly(x, [16, 9, 30, 16, 16, 23]); x.fill();
        x.strokeStyle = '#7a8498'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(19, 11); x.lineTo(21, 21); x.moveTo(24, 13); x.lineTo(25, 19); x.stroke();
        break;
      case 'freeze':
        x.strokeStyle = '#8fe8ff'; x.lineWidth = 2.5;
        for (let k = 0; k < 3; ++k) {
          const a = k * Math.PI / 3;
          x.beginPath(); x.moveTo(16 - Math.cos(a) * 12, 16 - Math.sin(a) * 12); x.lineTo(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12); x.stroke();
        }
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(16, 16, 3, 0, C.TAU); x.fill();
        break;
      case 'lantern':
        x.drawImage(K.glow('#fff2a8'), 0, 0, 32, 32);
        x.strokeStyle = '#7a5a2a'; x.lineWidth = 2; x.strokeRect(10, 9, 12, 16); x.beginPath(); x.arc(16, 8, 4, Math.PI, 0); x.stroke();
        K.orb(x, 16, 17, 5, '#ffe36a', '#ffffff', '#ff9a2a');
        break;
      case 'boots':
        x.fillStyle = '#3aa84a'; K.poly(x, [8, 6, 16, 6, 16, 20, 27, 22, 27, 27, 6, 27]); x.fill();
        x.fillStyle = '#ffffff'; K.poly(x, [3, 12, 8, 10, 8, 14]); x.fill(); K.poly(x, [2, 18, 7, 16, 7, 20]); x.fill();
        x.fillStyle = '#1a5a2a'; x.fillRect(6, 25, 21, 3);
        break;
      case 'clover':
        x.fillStyle = '#44e070';
        for (let k = 0; k < 4; ++k) { const a = k * Math.PI / 2 + Math.PI / 4; x.beginPath(); x.arc(16 + Math.cos(a) * 6, 14 + Math.sin(a) * 6, 6, 0, C.TAU); x.fill(); }
        x.strokeStyle = '#1a8a3a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(16, 16); x.quadraticCurveTo(18, 24, 22, 29); x.stroke();
        break;
      case 'slow':
        K.orb(x, 16, 18, 11, '#e8e0ff', '#ffffff', '#8a7ac0');
        x.strokeStyle = '#4a3a80'; x.lineWidth = 2; x.beginPath(); x.moveTo(16, 18); x.lineTo(16, 10); x.moveTo(16, 18); x.lineTo(21, 20); x.stroke();
        x.fillStyle = '#b39dff'; x.fillRect(13, 3, 6, 4);
        break;
      case 'life':
        x.drawImage(K.glow('#ffb347'), 0, 0, 32, 32);
        x.fillStyle = '#ff5d7a';
        x.beginPath(); x.moveTo(16, 27); x.bezierCurveTo(2, 18, 6, 4, 16, 11); x.bezierCurveTo(26, 4, 30, 18, 16, 27); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.arc(11, 12, 2.5, 0, C.TAU); x.fill();
        break;
      /* seasonal tokens */
      case 'yearend':
        x.fillStyle = '#ffd54a'; K.star(x, 16, 16, 13, 5, 5); x.fill();
        x.fillStyle = '#ffffff'; K.star(x, 16, 16, 6, 2.5, 5); x.fill();
        break;
      case 'halloween':
        x.fillStyle = '#ffffff'; K.poly(x, [16, 3, 26, 27, 6, 27]); x.fill();
        x.fillStyle = '#ff8a1a'; K.poly(x, [12.5, 11, 19.5, 11, 23, 20, 9, 20]); x.fill();
        x.fillStyle = '#ffd54a'; K.poly(x, [9, 20, 23, 20, 26, 27, 6, 27]); x.fill();
        break;
      case 'winter':
        x.strokeStyle = '#ffffff'; x.lineWidth = 2.2;
        for (let k = 0; k < 6; ++k) {
          const a = k * Math.PI / 3;
          x.beginPath(); x.moveTo(16, 16); x.lineTo(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12);
          x.moveTo(16 + Math.cos(a) * 7, 16 + Math.sin(a) * 7); x.lineTo(16 + Math.cos(a + 0.5) * 10, 16 + Math.sin(a + 0.5) * 10);
          x.stroke();
        }
        break;
      case 'spring':
        x.fillStyle = '#ff9ac8'; x.beginPath(); x.ellipse(16, 17, 9, 12, 0, 0, C.TAU); x.fill();
        x.strokeStyle = '#7dff8a'; x.lineWidth = 3; x.beginPath(); x.moveTo(8, 14); x.lineTo(13, 18); x.lineTo(18, 13); x.lineTo(24, 17); x.stroke();
        x.fillStyle = '#ffe066'; x.beginPath(); x.arc(14, 23, 2, 0, C.TAU); x.arc(20, 24, 2, 0, C.TAU); x.fill();
        break;
      case 'summer':
        x.fillStyle = '#ffe0b0';
        x.beginPath(); x.moveTo(16, 27); x.lineTo(3, 12); x.quadraticCurveTo(16, 0, 29, 12); x.closePath(); x.fill();
        x.strokeStyle = '#e0a060'; x.lineWidth = 1.5;
        for (let k = -2; k <= 2; ++k) { x.beginPath(); x.moveTo(16, 27); x.lineTo(16 + k * 6, 6 + Math.abs(k) * 2); x.stroke(); }
        break;
      default:
        x.fillStyle = '#8a5a2a'; x.beginPath(); x.ellipse(16, 19, 9, 10, 0, 0, C.TAU); x.fill();
        x.fillStyle = '#c9962a'; x.beginPath(); x.ellipse(16, 10, 11, 5, 0, 0, C.TAU); x.fill();
        x.strokeStyle = '#5a3a1a'; x.lineWidth = 2; x.beginPath(); x.moveTo(16, 6); x.lineTo(17, 1); x.stroke();
    }
    return c;
  }

  function icon(key) {
    const k = 'i-' + key;
    if (!cache[k]) cache[k] = drawIcon(key);
    return cache[k];
  }

  function iconForKind(kind) {
    if (kind === I.TOKEN) return icon(NS.state.season ? NS.state.season.id : 'autumn');
    const def = I.POWERUPS[kind];
    return icon(def ? def.key : 'bomb');
  }

  /* the glowing bubble an item rests in */
  function itemTile(kind, f) {
    const key = 'it' + kind + '-' + f + (kind === I.TOKEN && NS.state.season ? NS.state.season.id : '');
    if (cache[key]) return cache[key];
    const c = K.canvas(T, T), x = c.getContext('2d');
    const col = kind === I.TOKEN ? (NS.state.season ? NS.state.season.color : '#ffd54a') : I.POWERUPS[kind].color;
    x.drawImage(K.glow(col), -6, -6, T + 12, T + 12);
    x.fillStyle = 'rgba(10,8,14,0.55)';
    x.beginPath(); x.arc(T / 2, T / 2, 15, 0, C.TAU); x.fill();
    x.strokeStyle = K.rgba(col, 0.9);
    x.lineWidth = 2;
    x.beginPath(); x.arc(T / 2, T / 2, 15, f * 0.8, f * 0.8 + 4.6); x.stroke();
    x.drawImage(iconForKind(kind), 6, 6, 28, 28);
    cache[key] = c;
    return c;
  }

  Object.assign(NS.creatureArt, { creature, boss, icon, iconForKind, itemTile });
})();
