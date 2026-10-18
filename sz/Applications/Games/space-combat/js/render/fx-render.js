/* Draws the pooled effects from cached sprites: smoke and tumbling debris (alpha), then glows,
   embers along their colour ramps, sparks batched per colour into one stroke each, shockwave
   rings, and floating score texts. Culled to the visible world rectangle. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { TAU, FONT } = NS.constants;
  const K = NS.artKit;
  const P = NS.propArt;
  const fx = NS.fx;
  const { ctx } = NS.view;

  const sparkColors = [];

  function vis(p, v, m) {
    return p.x > v.x0 - m && p.x < v.x1 + m && p.y > v.y0 - m && p.y < v.y1 + m;
  }

  function rampColor(p) {
    const r = p.ramp;
    const t = 1 - p.life / p.max;
    return r[Math.min(r.length - 1, Math.floor(t * r.length))];
  }

  function draw(v) {
    /* smoke and debris */
    const nl = G.fxNormal;
    for (let i = 0; i < nl.length; ++i) {
      const p = nl[i];
      if (!vis(p, v, p.size * 2)) continue;
      const k = p.life / p.max;
      if (p.kind === fx.SMOKE) {
        ctx.globalAlpha = p.alpha * Math.min(1, k * 1.6) * Math.min(1, (1 - k) * 8);
        K.blitRot(ctx, K.puff(p.color), p.x, p.y, p.rot, p.size / 22);
      } else {
        ctx.globalAlpha = Math.min(1, k * 3);
        K.blitRot(ctx, P.chip(p.shape, p.color), p.x, p.y, p.rot, p.size / 6);
      }
    }
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = 'lighter';
    const al = G.fxAdd;
    sparkColors.length = 0;
    for (let i = 0; i < al.length; ++i) {
      const p = al[i];
      if (p.kind === fx.SPARK) {
        if (sparkColors.indexOf(p.color) < 0) sparkColors.push(p.color);
        continue;
      }
      if (!vis(p, v, p.size * 2)) continue;
      const k = p.life / p.max;
      const c = p.ramp ? rampColor(p) : p.color;
      ctx.globalAlpha = p.kind === fx.EMBER ? Math.min(1, k * 2) : Math.min(1, k * 1.4);
      const s = Math.max(0.05, p.size / 22);
      K.blit(ctx, K.glow(c), p.x, p.y, s);
    }
    /* sparks: one path per colour */
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    for (let c = 0; c < sparkColors.length; ++c) {
      const col = sparkColors[c];
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let i = 0; i < al.length; ++i) {
        const p = al[i];
        if (p.kind !== fx.SPARK || p.color !== col || !vis(p, v, 20)) continue;
        const k = p.life / p.max;
        const len = 0.028 + k * 0.02;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * len, p.y - p.vy * len);
      }
      ctx.stroke();
    }
    /* shockwave rings */
    for (let i = 0; i < G.rings.length; ++i) {
      const r = G.rings[i];
      const t = r.t / r.life;
      const e = 1 - (1 - t) * (1 - t);
      const rad = r.r0 + (r.r1 - r.r0) * e;
      if (!vis(r, v, rad)) continue;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, r.width * (1 - t));
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    /* floating texts */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < G.texts.length; ++i) {
      const t = G.texts[i];
      if (!vis(t, v, 80)) continue;
      const k = t.t / t.life;
      const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.5 : 1.1 - Math.min(0.1, (k - 0.12));
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
      ctx.font = 'bold ' + Math.round(t.size * pop) + 'px ' + FONT;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
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
