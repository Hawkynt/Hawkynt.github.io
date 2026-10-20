/* The falling power-up capsule: glowing pill with its letter. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const V = NS.view;

  function drawPowerUpCapsule(pu) {
    const { x, y, type, color, time, rotation } = pu;
    const halfW = C.POWERUP_SIZE / 2;
    const halfH = C.POWERUP_SIZE * 0.35;
    const pulse = 0.7 + 0.3 * Math.sin(time * 0.005);

    V.ctx.save();
    V.ctx.translate(x, y);

    /* Outer glow */
    V.ctx.shadowColor = color;
    V.ctx.shadowBlur = 8 * pulse;

    /* Pill shape */
    V.ctx.fillStyle = color;
    V.ctx.globalAlpha = 0.85 * pulse;
    V.ctx.beginPath();
    V.ctx.roundRect(-halfW, -halfH, C.POWERUP_SIZE, halfH * 2, halfH);
    V.ctx.fill();
    V.ctx.shadowBlur = 0;

    /* Inner glow */
    const inner = V.ctx.createRadialGradient(0, -2, 1, 0, 0, halfW);
    inner.addColorStop(0, 'rgba(255,255,255,0.5)');
    inner.addColorStop(1, 'rgba(255,255,255,0)');
    V.ctx.globalAlpha = pulse;
    V.ctx.fillStyle = inner;
    V.ctx.beginPath();
    V.ctx.roundRect(-halfW, -halfH, C.POWERUP_SIZE, halfH * 2, halfH);
    V.ctx.fill();

    /* Letter */
    V.ctx.globalAlpha = 1;
    V.ctx.fillStyle = '#000';
    V.ctx.font = 'bold 11px sans-serif';
    V.ctx.textAlign = 'center';
    V.ctx.textBaseline = 'middle';
    V.ctx.fillText(type, 0, 0.5);

    V.ctx.restore();
  }

  Object.assign(NS.drawPowerUps, { drawPowerUpCapsule });
})();
