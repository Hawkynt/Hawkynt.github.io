/* Draws the effect pools: solid particles (chunks, confetti, shapes) then an additive pass for
   glows, sparks and shockwave rings, and the floating score texts with a pop-in. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const FX = NS.fx;
  const K = NS.artKit;
  const IA = NS.itemArt;
  const { FONT } = NS.constants;
  const { ctx } = NS.view;

  function particles() {
    const P = FX.P;
    for (let i = 0; i < P.length; ++i) {
      const p = P[i];
      if (!p.on || p.kind < 2) continue;
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      if (p.kind === 2) {
        ctx.fillStyle = p.color;
        const s = p.size * (0.5 + k * 0.5);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.kind === 3) {
        ctx.fillStyle = p.color;
        const w = p.size * Math.abs(Math.cos(p.rot)) + 1;
        ctx.fillRect(p.x - w / 2, p.y - p.size * 0.3, w, p.size * 0.6);
      } else if (p.kind === 4 && p.shape) {
        K.blitEx(ctx, IA.shape(p.shape), p.x, p.y, p.rot * 0.3, p.size / 10, p.size / 10);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < P.length; ++i) {
      const p = P[i];
      if (!p.on || p.kind > 1) continue;
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      if (p.kind === 0) {
        K.blit(ctx, K.glow(p.color), p.x, p.y, p.size / 14 * (0.6 + k * 0.4));
      } else {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      }
    }
    const rings = FX.rings;
    for (let i = 0; i < rings.length; ++i) {
      const r = rings[i];
      if (!r.on) continue;
      const k = r.t / r.dur;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      ctx.globalAlpha = (1 - k) * 0.9;
      K.blit(ctx, K.ringSprite(r.color), r.x, r.y, rad / 52);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function floaters() {
    const F = FX.floaters;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < F.length; ++i) {
      const f = F[i];
      if (!f.on) continue;
      const k = f.t / f.dur;
      const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : k < 0.25 ? 1.2 - (k - 0.15) * 2 : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = 'bold ' + Math.round(f.size * pop) + 'px ' + FONT;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    particles();
    floaters();
  }

  Object.assign(NS.fxRender, {
    draw, particles, floaters
  });
})();
