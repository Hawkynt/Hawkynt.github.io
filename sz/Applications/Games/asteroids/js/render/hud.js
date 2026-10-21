/* In-game HUD: the combo multiplier banner, the active-powerup timer bars with
   the EMP warning, and the LEVEL banner shown during warps. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const T = NS.tables;
  const S = NS.state;
  const ctx = NS.dom.ctx;

  function drawComboHUD() {
    if (S.combo.count < 2) return;
    const mult = NS.combo.getComboMultiplier();
    const scale = 1 + S.combo.displayScale * 0.4;
    const colors = ['#fff', '#ffd700', '#ff8c00', '#ff4500', '#ff0044', '#ff00aa', '#aa44ff', '#ff44ff'];
    const color = colors[Math.min(mult - 1, colors.length - 1)];

    ctx.save();
    ctx.translate(S.W / 2, 35 * S.uiS);
    ctx.scale(scale, scale);
    ctx.font = NS.rules.scaledFont(22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillStyle = color;
    ctx.fillText('×' + mult + ' COMBO', 0, 0);
    ctx.restore();
  }

  function drawPowerupHUD() {
    /* EMP warning */
    if (S.empActive) {
      const pulse = 0.5 + Math.sin(S.gameTime / 1000 * 6) * 0.3;
      ctx.save();
      ctx.font = NS.rules.scaledFont(14);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(136,204,255,${pulse})`;
      ctx.fillText('EMP ACTIVE -- POWERUPS DISABLED', S.W / 2, S.H - 40 * S.uiS);
      ctx.restore();
    }

    const active = [];
    for (const key of T.DURATION_POWERUPS)
      if (S.powerupState[key].active) {
        const def = T.POWERUP_TYPES[key];
        active.push({ ...def, timer: S.powerupState[key].timer, key });
      }
    if (active.length === 0) return;

    const barW = 50 * S.uiS;
    const barH = 14 * S.uiS;
    let x = 8 * S.uiS;
    const y = S.H - (22 * S.uiS);
    ctx.save();
    ctx.font = NS.rules.scaledFont(10);
    for (const p of active) {
      const pct = p.timer / p.duration;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = p.color + '88';
      ctx.fillRect(x, y, barW * pct, barH);

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barW, barH);

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.icon, x + barW / 2, y + barH / 2);

      x += barW + 4 * S.uiS;
    }
    ctx.restore();
  }

  function drawWarpText() {
    if (!S.warpState) return;
    const progress = 1 - S.warpState.timer / S.warpState.duration;

    if (progress < 0.2 || progress > 0.9) return;

    const alpha = progress < 0.3 ? (progress - 0.2) / 0.1 : progress > 0.8 ? (0.9 - progress) / 0.1 : 1;
    const scale = 0.5 + Math.min((progress - 0.2) / 0.3, 1) * 0.5;

    ctx.save();
    ctx.translate(S.W / 2, S.H / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.font = NS.rules.scaledFont(42);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#88ccff';
    ctx.fillText('LEVEL ' + S.level, 0, 0);
    ctx.restore();
  }

  Object.assign(NS.hud, { drawComboHUD, drawPowerupHUD, drawWarpText });
})();
