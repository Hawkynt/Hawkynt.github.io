/* Effect overlays: crackling arcs between electric rocks and nearby bodies, and
   the expanding shockwave rings. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;
  const ctx = NS.dom.ctx;

  function drawElectricArcs() {
    const { drawElectricArc } = SZ.GameEffects;
    for (const a of S.asteroids) {
      if (a.rockType !== 'electric') continue;
      for (const other of S.asteroids) {
        if (other === a) continue;
        const d = NS.rules.distWrapped(a, other);
        if (d < 100)
          drawElectricArc(ctx, a.x, a.y, other.x, other.y, {
            segments: 8, jitter: 6, color: '#ffff88', glowColor: '#aaaa44', width: 1.2, glowWidth: 3
          });
      }
      for (const e of S.enemies) {
        const d = NS.rules.distWrapped(a, e);
        if (d < 100)
          drawElectricArc(ctx, a.x, a.y, e.x, e.y, {
            segments: 8, jitter: 6, color: '#ffff88', glowColor: '#aaaa44', width: 1.2, glowWidth: 3
          });
      }
    }
  }

  function drawShockwaves() {
    for (const s of S.shockwaves) {
      ctx.save();
      ctx.globalAlpha = s.life * 0.5;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth * s.life;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  Object.assign(NS.effectView, { drawElectricArcs, drawShockwaves });
})();
