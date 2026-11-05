/* Draws the pooled effects from cached sprites: glows additively, shaped flakes (leaves, petals,
   stars, hearts, snow, confetti, bats, bubbles) and dots with alpha, in two layers (under and over
   the snake); then shockwave rings and floating score texts with a pop-in scale. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const { TAU, FONT } = NS.constants;
  const K = NS.artKit;
  const IA = NS.itemArt;
  const fx = NS.fx;
  const { ctx } = NS.view;

  function draw(layer) {
    const P = fx.P;
    const n = P.n;
    /* shaped and dotted particles with alpha */
    for (let k = 0; k < n; ++k) {
      if (P.layer[k] !== layer || P.kind[k] === fx.GLOW) continue;
      const a = Math.min(1, P.life[k] / P.max[k] * 2.2);
      ctx.globalAlpha = a;
      const s = P.size[k];
      if (P.kind[k] === fx.DOT) {
        ctx.fillStyle = P.color[k];
        ctx.fillRect(P.x[k] - s / 2, P.y[k] - s / 2, s, s);
        continue;
      }
      const spr = IA.shape(P.kind[k], P.color[k]);
      ctx.translate(P.x[k], P.y[k]);
      ctx.rotate(P.rot[k]);
      ctx.drawImage(spr.canvas, -s / 2, -s / 2, s, s);
      ctx.rotate(-P.rot[k]);
      ctx.translate(-P.x[k], -P.y[k]);
    }
    ctx.globalAlpha = 1;
    /* glows */
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < n; ++k) {
      if (P.layer[k] !== layer || P.kind[k] !== fx.GLOW) continue;
      ctx.globalAlpha = Math.min(1, P.life[k] / P.max[k] * 1.6);
      K.blit(ctx, K.glow(P.color[k]), P.x[k], P.y[k], P.size[k] / 22);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (layer !== 1) return;
    for (let k = 0; k < fx.rings.length; ++k) {
      const r = fx.rings[k];
      const f = r.t / r.life;
      ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - f * 0.7);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - f) * (1 - f)), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k < fx.texts.length; ++k) {
      const t = fx.texts[k];
      const pop = t.t < 0.15 ? 0.6 + t.t / 0.15 * 0.6 : t.t < 0.25 ? 1.2 - (t.t - 0.15) * 2 : 1;
      ctx.globalAlpha = Math.min(1, (t.life - t.t) * 3);
      ctx.font = 'bold ' + Math.round(t.size * pop) + 'px ' + FONT;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineJoin = 'round';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.fxRender, {
    draw
  });
})();
