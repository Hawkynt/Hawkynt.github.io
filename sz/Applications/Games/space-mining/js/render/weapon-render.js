/* Draws the hardpoint weapons in the world: pulse bolts and flak pellets as glowing streaks,
   missiles with a hot nose, gravity nets in flight and holding, rail lance lines fading out, EMP
   mines blinking until they arm, the tether line to a towed rock, the swarm drones, and the ship
   as a shimmering ghost while it is cloaked. Reads only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const K = NS.artKit;
  const { ctx } = NS.view;

  function draw() {
    const W = NS.hardpoints.state();
    const s = G.ship;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    /* shots */
    for (let i = 0; i < G.wshots.length; ++i) {
      const o = G.wshots[i];
      if (o.kind === 'net') {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 10, 0, TAU);
        ctx.moveTo(o.x - 10, o.y); ctx.lineTo(o.x + 10, o.y);
        ctx.moveTo(o.x, o.y - 10); ctx.lineTo(o.x, o.y + 10);
        ctx.stroke();
        continue;
      }
      const len = o.kind === 'pellet' ? 6 : o.kind === 'missile' ? 10 : 16;
      const c = Math.cos(o.angle), sn = Math.sin(o.angle);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = o.color;
      ctx.lineWidth = o.kind === 'pellet' ? 2 : 3;
      ctx.beginPath();
      ctx.moveTo(o.x - c * len, o.y - sn * len);
      ctx.lineTo(o.x, o.y);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      K.blit(ctx, K.glow(o.color), o.x, o.y, o.kind === 'pellet' ? 0.18 : 0.3);
    }
    /* rail lines */
    for (let i = 0; i < W.rails.length; ++i) {
      const r = W.rails[i], k = r.t / 0.35;
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#e0e8ff';
      ctx.lineWidth = 2 + 6 * k * r.k;
      ctx.beginPath();
      ctx.moveTo(r.x0, r.y0);
      ctx.lineTo(r.x1, r.y1);
      ctx.stroke();
    }
    /* nets holding */
    for (let i = 0; i < W.nets.length; ++i) {
      const n = W.nets[i];
      ctx.globalAlpha = Math.min(1, n.t) * 0.5;
      ctx.strokeStyle = '#c88aff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 6; ++k) {
        const a = k / 6 * TAU + G.time * 0.6;
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(n.x + Math.cos(a) * n.r, n.y + Math.sin(a) * n.r);
      }
      ctx.moveTo(n.x + n.r, n.y);
      ctx.arc(n.x, n.y, n.r, 0, TAU);
      ctx.moveTo(n.x + n.r * 0.55, n.y);
      ctx.arc(n.x, n.y, n.r * 0.55, 0, TAU);
      ctx.stroke();
    }
    /* mines */
    for (let i = 0; i < W.mines.length; ++i) {
      const m = W.mines[i];
      const blink = m.arm > 0 ? 0.4 : 0.6 + Math.sin(G.time * 10) * 0.4;
      ctx.globalAlpha = blink;
      K.blit(ctx, K.glow('#3affd0'), m.x, m.y, 0.45);
      ctx.strokeStyle = '#3affd0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.w.radius * 0.7, 0, TAU);
      ctx.globalAlpha = 0.15;
      ctx.stroke();
    }
    /* the tether */
    if (W.tow && s && W.tow.alive) {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#9ac4ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -G.time * 40;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(W.tow.x, W.tow.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    /* swarm drones */
    for (let i = 0; i < W.swarm.length; ++i) {
      const d = W.swarm[i];
      const c = Math.cos(d.angle), sn = Math.sin(d.angle);
      ctx.globalAlpha = 0.5;
      K.blit(ctx, K.glow('#5cff9a'), d.x, d.y, 0.3);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5cff9a';
      ctx.beginPath();
      ctx.moveTo(d.x + c * 9, d.y + sn * 9);
      ctx.lineTo(d.x - c * 6 - sn * 5, d.y - sn * 6 + c * 5);
      ctx.lineTo(d.x - c * 6 + sn * 5, d.y - sn * 6 - c * 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* the cloaked ship: a faint, wavering ghost of the hull */
  function drawCloaked(s) {
    const st = G.stats;
    ctx.save();
    ctx.globalAlpha = 0.16 + Math.sin(G.time * 13) * 0.05;
    K.blitRot(ctx, NS.shipArt.shipSprite(st.hullId, st.colors, s.bank), s.x + Math.sin(G.time * 31) * 1.5, s.y, s.angle, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.12;
    K.blit(ctx, K.glow('#a0b4d0'), s.x, s.y, 1.1);
    ctx.restore();
  }

  Object.assign(NS.weaponRender, {
    draw, drawCloaked
  });
})();
