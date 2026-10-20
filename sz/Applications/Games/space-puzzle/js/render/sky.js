/* The deep-space backdrop: nebula patches, the twinkling starfield with glow halos
   on the larger stars, and the epoch-seeded shooting star streaks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function drawBackground() {
    const ctx = D.ctx;

    // Deep space background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Nebula patches — large semi-transparent colored blobs behind everything
    ctx.save();
    const nebulaPatches = [
      { x: 150, y: 120, r: 130, color: 'rgba(80,40,120,0.06)' },
      { x: 480, y: 350, r: 110, color: 'rgba(40,80,120,0.05)' },
      { x: 320, y: 400, r: 100, color: 'rgba(120,40,60,0.04)' },
      { x: 530, y: 100, r: 90, color: 'rgba(40,120,80,0.05)' }
    ];
    for (const neb of nebulaPatches) {
      const nebGrad = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
      nebGrad.addColorStop(0, neb.color);
      nebGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebGrad;
      ctx.beginPath();
      ctx.arc(neb.x, neb.y, neb.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Twinkling stars — enhanced with varied sizes and glow
    const now = Date.now() / 1000;
    for (const star of S.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(now * 2 + star.b * 10);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#fff';
      const size = star.s;
      if (size > 1.5) {
        // Larger stars get a faint glow halo
        ctx.save();
        ctx.globalAlpha = twinkle * 0.25;
        ctx.fillStyle = '#aaccff';
        ctx.beginPath();
        ctx.arc(star.x + size * 0.5, star.y + size * 0.5, size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#fff';
        ctx.fillRect(star.x, star.y, size, size);
      } else
        ctx.fillRect(star.x, star.y, size, size);
    }
    ctx.globalAlpha = 1;

    // Shooting stars — occasional fast-moving streaks
    ctx.save();
    const shootingEpoch = Math.floor(Date.now() / 3000);
    for (let si = 0; si < 3; ++si) {
      const seed = shootingEpoch * 7 + si * 131;
      const sx = ((seed * 37) % C.CANVAS_W);
      const sy = ((seed * 53) % C.CANVAS_H);
      const angle = 0.6 + si * 0.3;
      const len = 30 + (seed % 40);
      const progress = (Date.now() % 3000) / 3000;
      const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = '#cceeff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + progress * 80, sy + progress * 40);
      ctx.lineTo(sx + progress * 80 + Math.cos(angle) * len, sy + progress * 40 + Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  Object.assign(NS.sky, { drawBackground });
})();
