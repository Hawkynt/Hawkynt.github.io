/* The electric forcefield paddle: emitter nodes, energy glow, lightning arcs and
   the laser cannons drawn when the L power-up is active. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const FX = NS.effects;

  /* ---- Draw Helpers ---- */
  function drawEmitter(x, y) {
    V.ctx.save();
    const grad = V.ctx.createRadialGradient(x, y, 1, x, y, C.EMITTER_RADIUS);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.4, '#6cf');
    grad.addColorStop(1, '#234');
    V.ctx.fillStyle = grad;
    V.ctx.beginPath();
    V.ctx.arc(x, y, C.EMITTER_RADIUS, 0, Math.PI * 2);
    V.ctx.fill();

    V.ctx.fillStyle = 'rgba(255,255,255,0.6)';
    V.ctx.beginPath();
    V.ctx.arc(x - 1.5, y - 1.5, C.EMITTER_RADIUS * 0.35, 0, Math.PI * 2);
    V.ctx.fill();
    V.ctx.restore();
  }

  function drawElectricPaddle() {
    const lx = S.paddle.x + C.EMITTER_RADIUS;
    const rx = S.paddle.x + S.paddle.width - C.EMITTER_RADIUS;
    const py = S.paddle.y + S.paddle.height / 2;

    /* Energy field glow between arcs */
    V.ctx.save();
    const glow = V.ctx.createLinearGradient(lx, py - 6, lx, py + 6);
    glow.addColorStop(0, 'rgba(80,180,255,0)');
    glow.addColorStop(0.5, 'rgba(80,180,255,0.15)');
    glow.addColorStop(1, 'rgba(80,180,255,0)');
    V.ctx.fillStyle = glow;
    V.ctx.fillRect(lx, py - 6, rx - lx, 12);
    V.ctx.restore();

    /* Draw 2-3 electric arcs */
    ++S.arcFrame;
    if (S.arcFrame % 3 === 0) {
      const colors = ['#6cf', '#4ef', '#adf'];
      const c = colors[Math.floor(Math.random() * colors.length)];
      SZ.GameEffects.drawElectricArc(V.ctx, lx, py, rx, py, {
        segments: 10, jitter: 5, color: c, width: 2, glowWidth: 5
      });
    }
    SZ.GameEffects.drawElectricArc(V.ctx, lx, py - 1, rx, py - 1, {
      segments: 8, jitter: 4, color: '#8df', width: 1.5, glowWidth: 4
    });
    SZ.GameEffects.drawElectricArc(V.ctx, lx, py + 1, rx, py + 1, {
      segments: 8, jitter: 4, color: '#6bf', width: 1.5, glowWidth: 4
    });

    /* Emitter nodes */
    drawEmitter(lx, py);
    drawEmitter(rx, py);

    /* Laser cannons */
    if (S.activePowerUps && S.activePowerUps.L) {
      V.ctx.fillStyle = '#f44';
      V.ctx.fillRect(lx - 2, py - 10, 4, 8);
      V.ctx.fillRect(rx - 2, py - 10, 4, 8);
      V.ctx.fillStyle = '#ff8';
      V.ctx.fillRect(lx - 1, py - 10, 2, 3);
      V.ctx.fillRect(rx - 1, py - 10, 2, 3);
    }

    /* Spark particles along paddle */
    if (Math.random() > 0.7) {
      const sx = lx + Math.random() * (rx - lx);
      FX.particles.trail(sx, py + (Math.random() - 0.5) * 4, {
        color: '#6cf', life: 0.2, size: 1.5, decay: 0.06, shrink: 0.9
      });
    }
  }

  Object.assign(NS.drawPaddle, { drawEmitter, drawElectricPaddle });
})();
