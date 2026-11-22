/* Draws the unit abilities in the belt: the Herder's tethers to the rocks it pulls and the
   clump's centre, the Minelayer's mines blinking once armed, Aegis bubbles flaring where they
   soak a hit, the Lancer's overcharged rail lines fading and the marks where a barrage lands.
   Reads only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const K = NS.artKit;
  const { ctx } = NS.view;

  function draw() {
    const A = NS.abilities.state();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    /* herds */
    for (let i = 0; i < A.herds.length; ++i) {
      const h = A.herds[i];
      ctx.strokeStyle = K.rgba('#d8b060', 0.35);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -G.time * 40;
      ctx.beginPath();
      for (const o of h.rocks) if (o.alive) { ctx.moveTo(h.u.x, h.u.y); ctx.lineTo(o.x, o.y); }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = K.rgba('#ffd890', 0.5 + Math.sin(G.time * 6) * 0.2);
      ctx.beginPath();
      ctx.arc(h.x, h.y, 40 + Math.sin(G.time * 4) * 6, 0, TAU);
      ctx.stroke();
    }
    /* mines */
    for (let i = 0; i < A.mines.length; ++i) {
      const m = A.mines[i];
      ctx.globalAlpha = m.arm > 0 ? 0.35 : 0.55 + Math.sin(G.time * 9 + i) * 0.35;
      K.blit(ctx, K.glow('#ff9a4a'), m.x, m.y, 0.3);
      ctx.fillStyle = '#ffd0a0';
      ctx.fillRect(m.x - 2, m.y - 2, 4, 4);
    }
    /* bubbles */
    for (let i = 0; i < A.bubbles.length; ++i) {
      const b = A.bubbles[i];
      const k = b.hp / b.maxHp;
      ctx.globalAlpha = 0.18 + (b.hit > 0 ? 0.35 : 0) + Math.sin(G.time * 5) * 0.04;
      const gr = ctx.createRadialGradient(b.x, b.y, b.r * 0.6, b.x, b.y, b.r);
      gr.addColorStop(0, 'rgba(88,200,255,0)');
      gr.addColorStop(1, 'rgba(88,200,255,0.8)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#9ae0ff';
      ctx.lineWidth = 1 + 2 * k;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
    }
    /* rails */
    for (let i = 0; i < A.rails.length; ++i) {
      const r = A.rails[i], k = r.t / 0.4;
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#e0e8ff';
      ctx.lineWidth = 2 + 7 * k;
      ctx.beginPath();
      ctx.moveTo(r.x0, r.y0);
      ctx.lineTo(r.x1, r.y1);
      ctx.stroke();
    }
    /* barrage marks */
    for (let i = 0; i < A.barrages.length; ++i) {
      const s = A.barrages[i];
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#ff8a5a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 18 + Math.max(0, s.t) * 20, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  Object.assign(NS.abilityRender, {
    draw
  });
})();
