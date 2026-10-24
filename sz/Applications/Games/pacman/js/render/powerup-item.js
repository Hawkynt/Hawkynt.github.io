;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.powerupview.drawPowerupItem = function drawPowerupItem(timestamp) {
    if (!S.fieldPowerup)
      return;

    const x = S.fieldPowerup.tileX * C.TILE + C.TILE / 2;
    const y = S.fieldPowerup.tileY * C.TILE + C.TILE / 2;
    const type = S.fieldPowerup.type;
    const ts = timestamp || performance.now();
    const age = ts - S.fieldPowerup.spawnTime;

    /* Blinking when about to expire */
    if (age >= C.POWERUP_BLINK_START) {
      if (Math.floor(ts / 150) % 2 === 0)
        return;
    }

    const pulse = Math.sin(ts * 0.005) * 0.3 + 0.7;

    SZ.GameEffects.drawGlow(D.ctx, c => {
      c.fillStyle = type.color;
      c.strokeStyle = type.color;
      NS.powerupview.drawPowerupIcon(c, x, y, type.icon, C.TILE * pulse);
    }, type.color, 8 * pulse);
  }

  NS.powerupview.drawPowerupIcon = function drawPowerupIcon(c, x, y, icon, size) {
    const s = size * 0.3;
    switch (icon) {
      case 'lightning':
        c.beginPath();
        c.moveTo(x + s * 0.1, y - s);
        c.lineTo(x - s * 0.3, y + s * 0.1);
        c.lineTo(x + s * 0.1, y + s * 0.1);
        c.lineTo(x - s * 0.1, y + s);
        c.lineTo(x + s * 0.3, y - s * 0.1);
        c.lineTo(x - s * 0.1, y - s * 0.1);
        c.closePath();
        c.fill();
        break;
      case 'snowflake':
        c.lineWidth = 1.5;
        for (let i = 0; i < 6; ++i) {
          const a = i * Math.PI / 3;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
          c.stroke();
        }
        break;
      case 'star':
        c.beginPath();
        for (let i = 0; i < 5; ++i) {
          const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
          if (i === 0) c.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
          else c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        }
        c.closePath();
        c.fill();
        break;
      case 'heart':
        c.beginPath();
        c.moveTo(x, y + s * 0.6);
        c.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.5, y - s, x, y - s * 0.3);
        c.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.2, x, y + s * 0.6);
        c.fill();
        break;
      case 'diamond':
        c.beginPath();
        c.moveTo(x, y - s);
        c.lineTo(x + s * 0.6, y);
        c.lineTo(x, y + s);
        c.lineTo(x - s * 0.6, y);
        c.closePath();
        c.fill();
        break;
      case 'circle':
        c.beginPath();
        c.arc(x, y, s * 0.7, 0, Math.PI * 2);
        c.fill();
        break;
    }
  }

})();
