/* Touch controls while digging: a direction pad bottom left (slide a finger across it to
   steer), swipe-and-hold anywhere else on the cave, and BOMB, GRAB and pause buttons bottom
   right. Shown once the screen has been touched. Owns the touch pointers; feeds the intent. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;

  const pads = {};          /* pointerId -> { kind, x0, y0, dir } */
  let grabHeld = false;

  function layout() {
    const v = visible();
    return {
      pad: { x: v.x0 + 140, y: v.y1 - 140, r: 110 },
      bomb: { x: v.x1 - 110, y: v.y1 - 190, r: 52 },
      grab: { x: v.x1 - 220, y: v.y1 - 100, r: 46 },
      pause: { x: v.x1 - 60, y: v.y0 + C.HUD_H + 50, r: 30 }
    };
  }

  function padDir(L, x, y) {
    const dx = x - L.pad.x, dy = y - L.pad.y;
    if (dx * dx + dy * dy < 18 * 18) return -1;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  }

  function inCircle(b, x, y, k) {
    return (x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) < b.r * b.r * (k || 1.3);
  }

  function down(id, x, y) {
    const L = layout();
    if (inCircle(L.pause, x, y)) { NS.screens.pause(); return; }
    if (inCircle(L.bomb, x, y)) { G.input.bombQ = true; pads[id] = { kind: 'bomb' }; return; }
    if (inCircle(L.grab, x, y)) { grabHeld = true; pads[id] = { kind: 'grab' }; return; }
    if (inCircle(L.pad, x, y, 1.6)) { pads[id] = { kind: 'pad', dir: padDir(L, x, y) }; return; }
    pads[id] = { kind: 'swipe', x0: x, y0: y, dir: -1 };
  }

  function move(id, x, y) {
    const p = pads[id];
    if (!p) return;
    if (p.kind === 'pad') p.dir = padDir(layout(), x, y);
    else if (p.kind === 'swipe') {
      const dx = x - p.x0, dy = y - p.y0;
      if (dx * dx + dy * dy > 26 * 26) p.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    }
  }

  function up(id) {
    const p = pads[id];
    if (p && p.kind === 'grab') grabHeld = false;
    delete pads[id];
  }

  function dir() {
    for (const id in pads) if (pads[id].dir >= 0 && (pads[id].kind === 'pad' || pads[id].kind === 'swipe')) return pads[id].dir;
    return -1;
  }

  function grab() {
    return grabHeld;
  }

  function button(b, label, active, col) {
    ctx.globalAlpha = active ? 0.85 : 0.5;
    ctx.fillStyle = 'rgba(20,14,10,0.8)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, C.TAU); ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.stroke();
    kit.text(label, b.x, b.y, 16, col, { align: 'center', weight: 'bold' });
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!G.input.touch || G.screen !== 'playing') return;
    const L = layout();
    const d = dir();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(20,14,10,0.8)';
    ctx.beginPath(); ctx.arc(L.pad.x, L.pad.y, L.pad.r, 0, C.TAU); ctx.fill();
    ctx.globalAlpha = 1;
    for (let k = 0; k < 4; ++k) {
      const a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][k];
      const x = L.pad.x + Math.cos(a) * 66, y = L.pad.y + Math.sin(a) * 66;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.globalAlpha = d === k ? 0.95 : 0.5;
      ctx.fillStyle = d === k ? '#ffd54a' : '#f4ead8';
      K.poly(ctx, [22, 0, -12, -20, -12, 20]);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    button(L.bomb, 'BOMB', false, '#ff7a5a');
    button(L.grab, 'GRAB', grabHeld, '#7dff8a');
    button(L.pause, 'II', false, '#f4ead8');
  }

  Object.assign(NS.touch, { down, move, up, dir, grab, draw, layout });
})();
