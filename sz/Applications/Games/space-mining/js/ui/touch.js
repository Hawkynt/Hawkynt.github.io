/* Touch controls for flight: a floating move stick on the left half, an aim-and-drill stick on
   the right, and buttons for boost, scanner pulse, seismic charge and drones above the right
   stick (only the unlocked ones). Shown once the screen has been touched. Owns the touch
   pointers; writes intents into G.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;

  const STICK_R = 70;
  const left = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  const right = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  const held = {};

  function active() {
    return G.input.touch && G.screen === 'playing';
  }

  function buttons() {
    const v = visible();
    const st = G.stats;
    const bx = v.x1 - 90, by = v.y1 - 300;
    const out = [];
    if (st.boost) out.push({ id: 'boost', icon: 'flame', x: bx - 150, y: by + 50, r: 34 });
    if (st.scan) out.push({ id: 'pulse', icon: 'scan', x: bx - 70, y: by - 20, r: 32 });
    if (st.seismic) out.push({ id: 'charge', icon: 'blast', x: bx + 20, y: by - 60, r: 30 });
    if (G.drones.length) out.push({ id: 'drones', icon: 'drone', x: bx - 200, y: by - 40, r: 30 });
    return out;
  }

  function down(id, x, y) {
    G.input.touch = true;
    const bs = buttons();
    for (let i = 0; i < bs.length; ++i) {
      const b = bs[i];
      if ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) < b.r * b.r * 1.4) {
        held[b.id] = id;
        if (b.id === 'pulse') NS.mining.pulse();
        if (b.id === 'charge') NS.mining.dropCharge();
        if (b.id === 'drones') NS.drones.toggle();
        return;
      }
    }
    const v = visible();
    const s = x < (v.x0 + v.x1) / 2 ? left : right;
    if (s.id !== -1) return;
    s.id = id;
    s.ox = s.x = x;
    s.oy = s.y = y;
  }

  function move(id, x, y) {
    const s = left.id === id ? left : right.id === id ? right : null;
    if (!s) return;
    s.x = x;
    s.y = y;
  }

  function up(id) {
    if (left.id === id) left.id = -1;
    if (right.id === id) right.id = -1;
    for (const k in held)
      if (held[k] === id) delete held[k];
  }

  function axis(s) {
    if (s.id === -1) return null;
    let dx = (s.x - s.ox) / STICK_R, dy = (s.y - s.oy) / STICK_R;
    const l = Math.sqrt(dx * dx + dy * dy);
    if (l > 1) { dx /= l; dy /= l; }
    return { x: dx, y: dy, len: Math.min(1, l) };
  }

  /* writes this step's touch intents */
  function sample(inp) {
    if (!inp.touch) return false;
    const m = axis(left), a = axis(right);
    if (m && m.len > 0.12) { inp.moveX = m.x; inp.moveY = m.y; }
    if (a && a.len > 0.25 && G.ship) {
      inp.aimWX = G.ship.x + a.x * 260;
      inp.aimWY = G.ship.y + a.y * 260;
      inp.firing = true;
    }
    inp.boost = inp.boost || held.boost !== undefined;
    return true;
  }

  function drawStick(s, defX, defY, label) {
    const on = s.id !== -1;
    const ox = on ? s.ox : defX, oy = on ? s.oy : defY;
    ctx.globalAlpha = on ? 0.8 : 0.35;
    ctx.fillStyle = 'rgba(10,20,40,0.5)';
    ctx.beginPath();
    ctx.arc(ox, oy, STICK_R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = K.rgba(UI.accent, 0.7);
    ctx.lineWidth = 2;
    ctx.stroke();
    const a = axis(s);
    ctx.fillStyle = K.rgba(UI.accent, 0.6);
    ctx.beginPath();
    ctx.arc(ox + (a ? a.x * STICK_R : 0), oy + (a ? a.y * STICK_R : 0), 28, 0, TAU);
    ctx.fill();
    kit.text(label, ox, oy + STICK_R + 16, 12, UI.textDim, { align: 'center' });
    ctx.globalAlpha = 1;
  }

  function draw() {
    const v = visible();
    drawStick(left, v.x0 + 150, v.y1 - 150, 'FLY');
    drawStick(right, v.x1 - 150, v.y1 - 150, 'AIM + DRILL');
    const bs = buttons();
    for (let i = 0; i < bs.length; ++i) {
      const b = bs[i];
      const on = held[b.id] !== undefined;
      ctx.globalAlpha = on ? 0.9 : 0.55;
      ctx.fillStyle = on ? 'rgba(200,120,40,0.6)' : 'rgba(10,20,40,0.55)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = UI.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      kit.icon(b.icon, b.x, b.y, b.r, '#ffffff');
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.touch, {
    active, down, move, up, sample, draw
  });
})();
