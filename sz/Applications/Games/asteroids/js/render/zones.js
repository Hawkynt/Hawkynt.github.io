/* Zone visuals: ice fields, lava patches and pulsing mines. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;
  const ctx = NS.dom.ctx;

  function drawZones() {
    const time = performance.now() / 1000;
    for (const z of S.zones) {
      const life = z.timer / z.duration;
      ctx.save();
      ctx.translate(z.x, z.y);

      if (z.type === 'ice') {
        ctx.globalAlpha = 0.15 * life;
        ctx.fillStyle = '#88ddff';
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3 * life;
        ctx.strokeStyle = '#aaeeff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        for (let i = 0; i < 3; ++i) {
          const a = time * 0.5 + i * Math.PI * 2 / 3;
          const r = z.radius * (0.3 + Math.random() * 0.5);
          ctx.fillStyle = `rgba(200,240,255,${0.5 * life})`;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (z.type === 'fire') {
        const flicker = 0.7 + Math.sin(time * 8 + z.x) * 0.3;
        ctx.globalAlpha = 0.2 * life * flicker;
        const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, z.radius);
        fg.addColorStop(0, '#ff6600');
        fg.addColorStop(0.6, '#ff330066');
        fg.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4 * life;
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (z.type === 'mine') {
        const pulse = 0.6 + Math.sin(time * 6) * 0.4;
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#332200';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,0,0,${pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.1;
        ctx.strokeStyle = '#ff6600';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  Object.assign(NS.zoneView, { drawZones });
})();
