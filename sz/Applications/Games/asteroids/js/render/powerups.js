/* Collectible powerup orbs: pulsing glowing ring with its letter icon, fading
   out as their lifetime runs down. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const ctx = NS.dom.ctx;

  function drawCollectiblePowerup(p) {
    const fadeStart = 2000;
    const alpha = p.lifetime < fadeStart ? p.lifetime / fadeStart : 1;
    const pulse = 0.8 + Math.sin(p.phase) * 0.2;
    const r = 11 * pulse;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = alpha;
    ctx.rotate(p.phase * 0.3);

    ctx.shadowColor = p.color;
    ctx.shadowBlur = 15;

    ctx.fillStyle = p.color + '30';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.icon, 0, 1);

    ctx.restore();
  }

  Object.assign(NS.powerupView, { drawCollectiblePowerup });
})();
