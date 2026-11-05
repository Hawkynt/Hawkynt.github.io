/* On-screen touch controls, shown once a touch is seen: a thumb pad over the left side panel
   (drag in any direction to walk), BOMB and BOOM buttons over the right one, plus MEGA and DASH
   when the tech tree grants them; touches elsewhere fall through to tap-to-walk.
   Owns the active touch pointers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const G = NS.state;
  const kit = NS.kit;
  const K = NS.artKit;
  const { ctx } = NS.view;

  const PAD = { x: 92, y: 560, r: 70 };
  const pads = {};
  let stick = null;

  function buttons() {
    const v = NS.view.visible();
    const rx = Math.min(1188, v.x1 - 92);
    const list = [{ id: 'bomb', x: rx, y: 560, r: 52, label: 'BOMB', color: '#ff5d5d' }, { id: 'boom', x: rx - 10, y: 440, r: 36, label: 'BOOM', color: '#c070ff' }];
    if (G.perks.mega) list.push({ id: 'mega', x: rx - 10, y: 350, r: 32, label: 'MEGA', color: '#ffd84a' });
    if (G.perks.dash) list.push({ id: 'dash', x: rx + 60 > v.x1 - 30 ? rx - 80 : rx + 60, y: 470, r: 30, label: 'DASH', color: '#8fe8ff' });
    return list;
  }

  function padPos() {
    const v = NS.view.visible();
    return { x: Math.max(PAD.x, v.x0 + 92), y: PAD.y, r: PAD.r };
  }

  /* Returns true when the touch landed on a control */
  function down(id, x, y) {
    const pp = padPos();
    if (Math.hypot(x - pp.x, y - pp.y) < pp.r * 1.4) {
      stick = { id: id, x: x, y: y, ox: pp.x, oy: pp.y };
      return true;
    }
    const bs = buttons();
    for (let i = 0; i < bs.length; ++i) {
      const b = bs[i];
      if (Math.hypot(x - b.x, y - b.y) < b.r * 1.25) {
        pads[id] = b.id;
        const inp = G.input;
        if (b.id === 'bomb') inp.bombQ = true;
        else if (b.id === 'boom') inp.detonateQ = true;
        else if (b.id === 'mega') inp.megaQ = true;
        else if (b.id === 'dash') inp.dashQ = true;
        if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {}
        return true;
      }
    }
    return false;
  }

  function move(id, x, y) {
    if (stick && stick.id === id) { stick.x = x; stick.y = y; }
  }

  function up(id) {
    if (stick && stick.id === id) stick = null;
    delete pads[id];
  }

  function sample(inp) {
    if (!stick) return false;
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
    if (Math.hypot(dx, dy) < 14) return false;
    if (Math.abs(dx) > Math.abs(dy)) inp.moveX = Math.sign(dx);
    else inp.moveY = Math.sign(dy);
    return true;
  }

  function draw() {
    if (!G.input.touch) return;
    const pp = padPos();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = 'rgba(20,10,20,0.6)';
    ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.stroke();
    for (let d = 0; d < 4; ++d) {
      const a = d * Math.PI / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(pp.x + Math.cos(a) * (pp.r - 10), pp.y + Math.sin(a) * (pp.r - 10));
      ctx.lineTo(pp.x + Math.cos(a + 0.25) * (pp.r - 30), pp.y + Math.sin(a + 0.25) * (pp.r - 30));
      ctx.lineTo(pp.x + Math.cos(a - 0.25) * (pp.r - 30), pp.y + Math.sin(a - 0.25) * (pp.r - 30));
      ctx.fill();
    }
    const kx = stick ? pp.x + Math.max(-pp.r, Math.min(pp.r, stick.x - stick.ox)) : pp.x;
    const ky = stick ? pp.y + Math.max(-pp.r, Math.min(pp.r, stick.y - stick.oy)) : pp.y;
    K.ball(ctx, kx, ky, 28, '#ffb347');
    const bs = buttons();
    for (let i = 0; i < bs.length; ++i) {
      const b = bs[i];
      const pressed = Object.keys(pads).some(k => pads[k] === b.id);
      K.ball(ctx, b.x, b.y, b.r * (pressed ? 0.92 : 1), b.color);
      kit.text(b.label, b.x, b.y + 1, Math.max(11, b.r * 0.34), '#ffffff', { align: 'center', weight: 'bold', stroke: 3 });
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.touch, {
    down, move, up, sample, draw
  });
})();
