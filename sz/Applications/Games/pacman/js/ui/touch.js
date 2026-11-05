/* Touch controls in play: swipe anywhere to steer (each swipe re-arms, so you can chain turns
   without lifting), an on-screen D-pad in the bottom-left corner and a pause button, shown once
   the screen has been touched. Owns the touch pointers; writes the wanted direction. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { ctx, visible } = NS.view;

  const PAD_R = 78, SWIPE = 22;
  const swipes = {};
  let padId = -1, padDir = -1;

  function pad() {
    const v = visible();
    return { x: v.x0 + 30 + PAD_R, y: v.y1 - 30 - PAD_R };
  }

  function pauseBtn() {
    const v = visible();
    return { x: v.x1 - 50, y: v.y0 + 50, r: 34 };
  }

  function dirFrom(dx, dy) {
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 2) : (dy < 0 ? 1 : 3);
  }

  function want(d) {
    G.input.want = d;
    G.input.wantT = 0;
    G.input.held = padId >= 0;
  }

  function down(id, x, y) {
    G.input.touch = true;
    const pb = pauseBtn();
    if ((x - pb.x) * (x - pb.x) + (y - pb.y) * (y - pb.y) < pb.r * pb.r * 1.5) {
      NS.screens.pause();
      return;
    }
    const p = pad();
    const dx = x - p.x, dy = y - p.y;
    if (dx * dx + dy * dy < PAD_R * PAD_R * 1.4) {
      padId = id;
      if (dx * dx + dy * dy > 100) { padDir = dirFrom(dx, dy); want(padDir); }
      return;
    }
    swipes[id] = { x: x, y: y };
  }

  function move(id, x, y) {
    if (id === padId) {
      const p = pad();
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy > 100) {
        const d = dirFrom(dx, dy);
        if (d !== padDir) { padDir = d; want(d); }
      }
      return;
    }
    const s = swipes[id];
    if (!s) return;
    const dx = x - s.x, dy = y - s.y;
    if (dx * dx + dy * dy < SWIPE * SWIPE) return;
    want(dirFrom(dx, dy));
    s.x = x;
    s.y = y;
  }

  function up(id) {
    if (id === padId) { padId = -1; padDir = -1; G.input.held = false; }
    delete swipes[id];
  }

  function draw() {
    const p = pad();
    ctx.globalAlpha = padId >= 0 ? 0.85 : 0.45;
    ctx.fillStyle = 'rgba(10,10,40,0.6)';
    ctx.beginPath(); ctx.arc(p.x, p.y, PAD_R, 0, TAU); ctx.fill();
    ctx.strokeStyle = UI.accent2;
    ctx.lineWidth = 2;
    ctx.stroke();
    const DX = [-1, 0, 1, 0], DY = [0, -1, 0, 1];
    for (let d = 0; d < 4; ++d) {
      const on = padDir === d;
      const cx = p.x + DX[d] * PAD_R * 0.6, cy = p.y + DY[d] * PAD_R * 0.6;
      ctx.fillStyle = on ? UI.accent : 'rgba(255,255,255,0.7)';
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate([Math.PI, -Math.PI / 2, 0, Math.PI / 2][d]);
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -13); ctx.lineTo(-8, 13); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const pb = pauseBtn();
    ctx.fillStyle = 'rgba(10,10,40,0.6)';
    ctx.beginPath(); ctx.arc(pb.x, pb.y, pb.r, 0, TAU); ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pb.x - 10, pb.y - 12, 7, 24);
    ctx.fillRect(pb.x + 3, pb.y - 12, 7, 24);
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.touch, {
    down, move, up, draw
  });
})();
