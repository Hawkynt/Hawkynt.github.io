/* Draws the pooled effects in world space from cached sprites: glows additively, speed streaks
   as lines along their motion, shaped flakes (leaves, petals, stars, snow, squares, bats,
   bubbles) and dots with alpha, in two layers (behind and in front of the runner); then
   shockwave rings and floating score texts with a pop-in scale. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const { TAU, FONT } = NS.constants;
  const K = NS.artKit;
  const PA = NS.propArt;
  const fx = NS.fx;
  const { ctx } = NS.view;

  function draw(layer) {
    const P = fx.P;
    const n = P.n;
    for (let k = 0; k < n; ++k) {
      if (P.layer[k] !== layer) continue;
      const kind = P.kind[k];
      if (kind === fx.GLOW || kind === fx.RIBBON) continue;
      const a = Math.min(1, P.life[k] / P.max[k] * 2.2);
      ctx.globalAlpha = a;
      const s = P.size[k];
      if (kind === fx.DOT) {
        ctx.fillStyle = P.color[k];
        ctx.fillRect(P.x[k] - s / 2, P.y[k] - s / 2, s, s);
        continue;
      }
      if (kind === fx.STREAK) {
        const vx = P.vx[k], vy = P.vy[k];
        const len = Math.sqrt(vx * vx + vy * vy) || 1;
        ctx.strokeStyle = P.color[k];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(P.x[k], P.y[k]);
        ctx.lineTo(P.x[k] - vx / len * s, P.y[k] - vy / len * s);
        ctx.stroke();
        continue;
      }
      const spr = PA.shape(kind, P.color[k]);
      ctx.translate(P.x[k], P.y[k]);
      ctx.rotate(P.rot[k]);
      ctx.drawImage(spr.canvas, -s / 2, -s / 2, s, s);
      ctx.rotate(-P.rot[k]);
      ctx.translate(-P.x[k], -P.y[k]);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < n; ++k) {
      if (P.layer[k] !== layer || (P.kind[k] !== fx.GLOW && P.kind[k] !== fx.RIBBON)) continue;
      ctx.globalAlpha = Math.min(1, P.life[k] / P.max[k] * 1.6) * (P.kind[k] === fx.RIBBON ? 0.7 : 1);
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
    ctx.lineJoin = 'round';
    for (let k = 0; k < fx.texts.length; ++k) {
      const t = fx.texts[k];
      const pop = t.t < 0.15 ? 0.6 + t.t / 0.15 * 0.6 : t.t < 0.25 ? 1.2 - (t.t - 0.15) * 2 : 1;
      ctx.globalAlpha = Math.min(1, (t.life - t.t) * 3);
      ctx.font = 'bold ' + Math.round(t.size * pop) + 'px ' + FONT;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(10,8,24,0.75)';
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
