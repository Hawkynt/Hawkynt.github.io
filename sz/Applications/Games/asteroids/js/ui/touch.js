/* Touch controls for flight, shown once the screen has been touched: a floating stick anywhere on
   the left two thirds turns the ship toward the stick and thrusts when pushed far, the guns fire
   on their own, and three buttons on the right for hyperspace, overdrive and pause. Owns the touch
   pointers; writes intents into G.input. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const { ctx, visible } = NS.view;

  const stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  const held = {};

  function active() {
    return G.input.touch && G.screen === 'playing';
  }

  function buttons() {
    const v = visible();
    const x = Math.min(v.x1, 1480) - 90, y = Math.min(v.y1, 840) - 110;
    return [
      { id: 'hyper', label: 'HYPER', x: x, y: y, r: 50 },
      { id: 'over', label: 'OVER', x: x - 120, y: y + 30, r: 42 },
      { id: 'pause', label: 'II', x: Math.min(v.x1, 1480) - 40, y: Math.max(v.y0, -120) + 150, r: 26 },
    ];
  }

  function down(id, x, y) {
    G.input.touch = true;
    const bs = buttons();
    for (let i = 0; i < bs.length; ++i) {
      const b = bs[i];
      if ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) < b.r * b.r * 1.5) {
        held[b.id] = id;
        if (b.id === 'hyper') G.input.hyperQ = true;
        if (b.id === 'over') G.input.overQ = true;
        if (b.id === 'pause') NS.screens.pause();
        return;
      }
    }
    if (stick.id !== -1) return;
    stick.id = id;
    stick.ox = stick.x = x;
    stick.oy = stick.y = y;
  }

  function move(id, x, y) {
    if (stick.id !== id) return;
    stick.x = x;
    stick.y = y;
    /* the stick base follows a finger that drags far away */
    const dx = x - stick.ox, dy = y - stick.oy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 90) {
      stick.ox = x - dx / d * 90;
      stick.oy = y - dy / d * 90;
    }
  }

  function up(id) {
    if (stick.id === id) stick.id = -1;
    for (const k in held) if (held[k] === id) delete held[k];
  }

  /* writes this step's touch intents; returns whether touch is steering */
  function sample(inp) {
    if (!inp.touch) return false;
    inp.fire = true;
    if (stick.id !== -1) {
      const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 12) inp.aimAngle = Math.atan2(dy, dx);
      inp.thrust = d > 45;
    }
    return true;
  }

  function draw() {
    const bs = buttons();
    for (let i = 0; i < bs.length; ++i) {
      const b = bs[i];
      const on = held[b.id] !== undefined;
      let ready = true;
      if (b.id === 'hyper' && G.ship) ready = G.ship.hyperCd <= 0;
      if (b.id === 'over') ready = G.overdrive >= 1;
      ctx.globalAlpha = on ? 0.9 : 0.6;
      ctx.fillStyle = on ? 'rgba(80,120,200,0.6)' : 'rgba(10,20,40,0.6)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = ready ? (b.id === 'over' ? '#d08aff' : UI.accent) : UI.textMute;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      kit.text(b.label, b.x, b.y, b.id === 'pause' ? 16 : 13, '#ffffff', { align: 'center', weight: 'bold' });
    }
    if (stick.id !== -1) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = K.rgba(UI.accent, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(stick.ox, stick.oy, 60, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = K.rgba(UI.accent, 0.5);
      ctx.beginPath();
      ctx.arc(stick.x, stick.y, 26, 0, TAU);
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.45;
      kit.text('Drag on the left to steer - push far to thrust - the guns fire on their own', 640, Math.min(visible().y1, 840) - 20, 13, UI.textDim, { align: 'center' });
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.touch, {
    active, down, move, up, sample, draw, buttons
  });
})();
