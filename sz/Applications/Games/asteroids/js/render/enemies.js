/* Enemy silhouettes: saucers with running lights, kamikaze drones, gunships,
   minelayers, cloaking scouts and the boss with shield aura and HP bar -- plus
   the friendly escort ship. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const T = NS.tables;
  const ctx = NS.dom.ctx;

  function drawEnemy(e) {
    const glow = 0.4 + Math.sin(e.pulsePhase) * 0.2;
    const r = e.radius;
    const color = T.ENEMY_TYPES[e.type]?.color ?? '#0f0';

    ctx.save();
    ctx.translate(e.x, e.y);

    /* Hit flash */
    if (e.hitFlash > 0) {
      ctx.globalAlpha = 0.5 + 0.5 * (e.hitFlash / 150);
      ctx.fillStyle = '#fff';
    }

    switch (e.type) {
      case 'ufo':
      case 'ufoSmall': {
        const large = e.type === 'ufo';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 8 + glow * 6;
        ctx.fillStyle = `rgba(0,180,80,${0.3 + glow * 0.2})`;
        ctx.strokeStyle = '#00ff88';
        ctx.globalAlpha = 0.7 + glow * 0.3;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = `rgba(0,255,120,${0.15 + glow * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.15, r * 0.5, r * 0.35, 0, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, r * 0.2);
        ctx.lineTo(r * 0.5, r * 0.2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        const lightCount = large ? 5 : 3;
        for (let i = 0; i < lightCount; ++i) {
          const la = (i / lightCount) * Math.PI * 2 + e.lightPhase;
          const lx = Math.cos(la) * r * 0.7;
          const ly = Math.sin(la) * r * 0.2;
          const lb = (Math.sin(la + e.lightPhase) + 1) * 0.5;
          ctx.fillStyle = `rgba(255,255,100,${lb * 0.8})`;
          ctx.beginPath();
          ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'drone':
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 6;
        ctx.fillStyle = `rgba(200,40,40,${0.6 + glow * 0.3})`;
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.6, -r * 0.7);
        ctx.lineTo(-r * 0.3, 0);
        ctx.lineTo(-r * 0.6, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        break;

      case 'gunship':
        ctx.shadowColor = '#88ff44';
        ctx.shadowBlur = 6;
        ctx.fillStyle = `rgba(80,160,40,${0.5 + glow * 0.2})`;
        ctx.strokeStyle = '#88ff44';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(r * 0.3, -r * 0.6);
        ctx.lineTo(-r, -r * 0.4);
        ctx.lineTo(-r * 0.7, 0);
        ctx.lineTo(-r, r * 0.4);
        ctx.lineTo(r * 0.3, r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        /* Turret glow */
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(r * 0.5, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;

      case 'minelayer':
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 5;
        ctx.fillStyle = `rgba(160,120,20,${0.5 + glow * 0.2})`;
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.rect(-r, -r * 0.5, r * 2, r);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#332200';
        ctx.fillRect(-r * 0.3, r * 0.2, r * 0.6, r * 0.3);
        ctx.shadowBlur = 0;
        break;

      case 'stealth': {
        const vis = e.visible ? 1 : 0.08;
        const flicker = e.visible ? 1 : (Math.random() < 0.1 ? 0.3 : 0.05);
        ctx.globalAlpha = vis * flicker;
        ctx.shadowColor = '#aa44ff';
        ctx.shadowBlur = 6 * vis;
        ctx.fillStyle = `rgba(120,40,200,${0.5 * vis})`;
        ctx.strokeStyle = `rgba(170,68,255,${0.8 * vis})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r * 0.5, -r * 0.8);
        ctx.lineTo(-r * 0.8, 0);
        ctx.lineTo(-r * 0.5, r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        break;
      }

      case 'boss': {
        /* Shield aura */
        const shieldGlow = e.shieldFlash > 0 ? 0.4 : 0.15;
        ctx.globalAlpha = shieldGlow + glow * 0.1;
        ctx.strokeStyle = '#ff88ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.8;
        ctx.shadowColor = '#ff44ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(160,40,160,${0.5 + glow * 0.2})`;
        ctx.strokeStyle = '#ff44ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(r * 0.5, -r * 0.7);
        ctx.lineTo(-r * 0.2, -r * 0.9);
        ctx.lineTo(-r, -r * 0.4);
        ctx.lineTo(-r * 0.8, 0);
        ctx.lineTo(-r, r * 0.4);
        ctx.lineTo(-r * 0.2, r * 0.9);
        ctx.lineTo(r * 0.5, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        /* HP bar */
        const barW = r * 2;
        const barH = 4;
        const barY = -r - 12;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-barW / 2, barY, barW, barH);
        ctx.fillStyle = '#ff44ff';
        ctx.fillRect(-barW / 2, barY, barW * (e.hp / e.maxHp), barH);
        ctx.strokeStyle = '#ff88ff';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-barW / 2, barY, barW, barH);
        break;
      }
    }

    ctx.restore();
  }

  function drawAlly(ally) {
    ctx.save();
    ctx.translate(ally.x, ally.y);
    ctx.rotate(ally.angle);

    ctx.shadowColor = '#44ffaa';
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(40,180,120,0.7)';
    ctx.strokeStyle = '#44ffaa';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();

    /* HP pips */
    if (ally.maxHp > 1) {
      const pipY = ally.y + 10;
      const pipGap = 5;
      const totalW = (ally.maxHp - 1) * pipGap;
      const startX = ally.x - totalW / 2;
      for (let i = 0; i < ally.maxHp; ++i) {
        ctx.fillStyle = i < ally.hp ? '#44ffaa' : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(startX + i * pipGap, pipY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  Object.assign(NS.enemyView, { drawEnemy, drawAlly });
})();
