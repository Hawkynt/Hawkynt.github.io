/* The player ship: engine flame, hull, cockpit and the shield bubble. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;
  const ctx = NS.dom.ctx;

  function drawShip() {
    if (!S.ship) return;
    if (S.invulnTimer > 0 && Math.floor(S.invulnTimer / 100) % 2 === 0) return;

    ctx.save();
    ctx.translate(S.ship.x, S.ship.y);
    ctx.rotate(S.ship.angle);

    /* Engine flame */
    if (S.ship.thrusting) {
      const flicker = 0.7 + Math.random() * 0.3;
      const flameLen = C.SHIP_SIZE * (0.7 + Math.random() * 0.5);

      const fg = ctx.createLinearGradient(-C.SHIP_SIZE * 0.45, 0, -C.SHIP_SIZE * 0.5 - flameLen, 0);
      fg.addColorStop(0, 'rgba(255,220,100,' + flicker * 0.9 + ')');
      fg.addColorStop(0.3, 'rgba(255,130,30,' + flicker * 0.7 + ')');
      fg.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-C.SHIP_SIZE * 0.35, -C.SHIP_SIZE * 0.22);
      ctx.lineTo(-C.SHIP_SIZE * 0.5 - flameLen, 0);
      ctx.lineTo(-C.SHIP_SIZE * 0.35, C.SHIP_SIZE * 0.22);
      ctx.closePath();
      ctx.fill();

      const ig = ctx.createLinearGradient(-C.SHIP_SIZE * 0.4, 0, -C.SHIP_SIZE * 0.4 - flameLen * 0.35, 0);
      ig.addColorStop(0, 'rgba(255,255,240,' + flicker * 0.7 + ')');
      ig.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.moveTo(-C.SHIP_SIZE * 0.35, -C.SHIP_SIZE * 0.1);
      ctx.lineTo(-C.SHIP_SIZE * 0.4 - flameLen * 0.35, 0);
      ctx.lineTo(-C.SHIP_SIZE * 0.35, C.SHIP_SIZE * 0.1);
      ctx.closePath();
      ctx.fill();
    }

    /* Ship body */
    ctx.beginPath();
    ctx.moveTo(C.SHIP_SIZE, 0);
    ctx.lineTo(-C.SHIP_SIZE * 0.7, -C.SHIP_SIZE * 0.6);
    ctx.lineTo(-C.SHIP_SIZE * 0.4, 0);
    ctx.lineTo(-C.SHIP_SIZE * 0.7, C.SHIP_SIZE * 0.6);
    ctx.closePath();

    const bg = ctx.createLinearGradient(-C.SHIP_SIZE, -C.SHIP_SIZE * 0.6, C.SHIP_SIZE, C.SHIP_SIZE * 0.3);
    bg.addColorStop(0, '#3a4555');
    bg.addColorStop(0.4, '#7888a0');
    bg.addColorStop(0.7, '#99aabc');
    bg.addColorStop(1, '#6a7a8c');
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.strokeStyle = '#aabbdd';
    ctx.lineWidth = 1;
    ctx.stroke();

    /* Cockpit */
    ctx.shadowColor = '#66ccff';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#66bbff';
    ctx.beginPath();
    ctx.arc(C.SHIP_SIZE * 0.15, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    /* Shield bubble */
    if (S.powerupState.shield.active) {
      const shimmer = Math.sin(S.gameTime / 1000 * 3) * 0.15;
      const empDim = S.empActive ? 0.3 : 1;
      ctx.save();
      ctx.strokeStyle = `rgba(68,170,255,${(0.35 + shimmer) * empDim})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#44aaff';
      ctx.shadowBlur = S.empActive ? 2 : 12;
      ctx.setLineDash(S.empActive ? [4, 4] : []);
      ctx.beginPath();
      ctx.arc(S.ship.x, S.ship.y, C.SHIP_SIZE + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  Object.assign(NS.shipView, { drawShip });
})();
