/* The dusk sky gradient, the twinkling stars and the soft glow behind the board. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const D = NS.dom;
  const P = NS.palette;

  function drawBackground() {
    const g = D.ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    g.addColorStop(0, P.PAL.skyTop);
    g.addColorStop(0.6, P.PAL.skyMid);
    g.addColorStop(1, P.PAL.skyLow);
    D.ctx.fillStyle = g;
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    const t = performance.now() / 1000;
    for (const s of P.STARS) {
      const a = 0.35 + 0.35 * Math.sin(t * 1.3 + s.p);
      D.ctx.fillStyle = P.PAL.star + a.toFixed(2) + ')';
      D.ctx.beginPath();
      D.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      D.ctx.fill();
    }

    // Soft glow behind the board
    const glow = D.ctx.createRadialGradient(C.CANVAS_W / 2, C.CANVAS_H * 0.55, 20, C.CANVAS_W / 2, C.CANVAS_H * 0.55, 330);
    glow.addColorStop(0, 'rgba(255,200,170,0.20)');
    glow.addColorStop(1, 'rgba(255,200,170,0)');
    D.ctx.fillStyle = glow;
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  }

  Object.assign(NS.background, { drawBackground });
})();
