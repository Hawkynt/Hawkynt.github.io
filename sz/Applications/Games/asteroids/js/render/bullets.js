/* Bullet trails: player shots (cyan, teal when homing), enemy red and ally green. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;
  const ctx = NS.dom.ctx;

  function drawBullet(b) {
    const isHoming = S.powerupState.homing.active && !S.empActive;
    const angle = Math.atan2(b.vy, b.vx);
    const trailLen = 8;
    const tx = b.x - Math.cos(angle) * trailLen;
    const ty = b.y - Math.sin(angle) * trailLen;
    const glowColor = isHoming ? '#00ffff' : '#88ffff';
    const dotColor = isHoming ? '#aff' : '#dff';

    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;

    const tg = ctx.createLinearGradient(tx, ty, b.x, b.y);
    tg.addColorStop(0, isHoming ? 'rgba(0,255,255,0)' : 'rgba(136,255,255,0)');
    tg.addColorStop(1, isHoming ? 'rgba(0,255,255,0.7)' : 'rgba(136,255,255,0.7)');
    ctx.strokeStyle = tg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.fillStyle = dotColor;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawUFOBullet(b) {
    const angle = Math.atan2(b.vy, b.vx);
    const trailLen = 6;
    const tx = b.x - Math.cos(angle) * trailLen;
    const ty = b.y - Math.sin(angle) * trailLen;

    ctx.save();
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 8;

    const tg = ctx.createLinearGradient(tx, ty, b.x, b.y);
    tg.addColorStop(0, 'rgba(255,68,68,0)');
    tg.addColorStop(1, 'rgba(255,68,68,0.7)');
    ctx.strokeStyle = tg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.fillStyle = '#faa';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawAllyBullet(b) {
    const angle = Math.atan2(b.vy, b.vx);
    const trailLen = 6;
    const tx = b.x - Math.cos(angle) * trailLen;
    const ty = b.y - Math.sin(angle) * trailLen;

    ctx.save();
    ctx.shadowColor = '#44ffaa';
    ctx.shadowBlur = 8;
    const tg = ctx.createLinearGradient(tx, ty, b.x, b.y);
    tg.addColorStop(0, 'rgba(68,255,170,0)');
    tg.addColorStop(1, 'rgba(68,255,170,0.7)');
    ctx.strokeStyle = tg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#aaffdd';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  Object.assign(NS.bulletView, { drawBullet, drawUFOBullet, drawAllyBullet });
})();
