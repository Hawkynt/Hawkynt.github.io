/* The heads-up display: cargo and hull bars, credit readout, the drilling
   status line, active powerup meters and the fading hint banner. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const H = NS.hud;

  H.drawHUD = function drawHUD() {
    /* Cargo fill indicator */
    const barW = 120, barH = 10;
    const barX = 8, barY = 8;
    const fillRatio = NS.economy.totalCargo() / S.cargoMax;

    D.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    D.ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    D.ctx.fillStyle = fillRatio >= 1 ? '#f44' : fillRatio > 0.8 ? '#fa0' : '#0a0';
    D.ctx.fillRect(barX, barY, barW * fillRatio, barH);
    D.ctx.strokeStyle = '#666';
    D.ctx.lineWidth = 1;
    D.ctx.strokeRect(barX, barY, barW, barH);

    D.ctx.fillStyle = '#fff';
    D.ctx.font = '10px sans-serif';
    D.ctx.textAlign = 'left';
    D.ctx.fillText('Cargo: ' + Math.floor(NS.economy.totalCargo()) + '/' + S.cargoMax, barX, barY + barH + 12);
    D.ctx.fillText('Credits: ' + S.credits, barX, barY + barH + 24);

    /* Hull bar */
    const hullBarY = barY + barH + 30;
    const hullRatio = S.hull / S.hullMax;
    D.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    D.ctx.fillRect(barX - 1, hullBarY - 1, barW + 2, barH + 2);
    D.ctx.fillStyle = hullRatio < 0.3 ? '#f44' : hullRatio < 0.6 ? '#fa0' : '#4a4';
    D.ctx.fillRect(barX, hullBarY, barW * hullRatio, barH);
    D.ctx.strokeStyle = '#666';
    D.ctx.strokeRect(barX, hullBarY, barW, barH);
    D.ctx.fillStyle = '#fff';
    D.ctx.fillText('Hull: ' + Math.round(S.hull) + '/' + S.hullMax, barX, hullBarY + barH + 12);

    /* Show drill speed and proximity */
    if (S.isDrilling && S.drillTarget) {
      D.ctx.fillStyle = T.ORE_TYPES[S.drillTarget.oreType].glowColor;
      D.ctx.font = 'bold 12px sans-serif';
      D.ctx.textAlign = 'center';
      const pct = Math.round((S.drillTarget.resources / S.drillTarget.maxResources) * 100);
      D.ctx.fillText('DRILLING ' + T.ORE_TYPES[S.drillTarget.oreType].label + ' (' + pct + '%)', C.CANVAS_W / 2, C.CANVAS_H - 20);
    }
  };

  H.drawActivePowerupIndicators = function drawActivePowerupIndicators() {
    const activeKeys = Object.keys(S.activePowerups);
    if (!activeKeys.length) return;

    let py = 120;
    D.ctx.save();
    D.ctx.font = '10px sans-serif';
    D.ctx.textAlign = 'left';
    for (const key of activeKeys) {
      const remaining = S.activePowerups[key];
      if (remaining <= 0) continue;
      const def = T.POWERUP_DEFS[key];
      const barW = 60;
      const ratio = Math.min(remaining / def.duration, 1);

      D.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      D.ctx.fillRect(7, py - 1, barW + 2, 10);
      D.ctx.fillStyle = def.color;
      D.ctx.fillRect(8, py, barW * ratio, 8);
      D.ctx.strokeStyle = '#666';
      D.ctx.lineWidth = 0.5;
      D.ctx.strokeRect(8, py, barW, 8);
      D.ctx.fillStyle = '#fff';
      D.ctx.fillText(def.icon + ' ' + Math.ceil(remaining) + 's', barW + 14, py + 8);
      py += 14;
    }
    D.ctx.restore();
  };

  H.drawHintOverlay = function drawHintOverlay() {
    if (S.hintTimer <= 0 || !S.currentHint) return;
    D.ctx.save();
    D.ctx.globalAlpha = S.hintAlpha * 0.9;
    D.ctx.font = '12px sans-serif';
    D.ctx.textAlign = 'center';

    const textW = D.ctx.measureText(S.currentHint).width;
    const px = C.CANVAS_W / 2;
    const py = C.CANVAS_H - 50;

    D.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    D.ctx.fillRect(px - textW / 2 - 8, py - 14, textW + 16, 22);
    D.ctx.fillStyle = '#ffe';
    D.ctx.fillText(S.currentHint, px, py);
    D.ctx.globalAlpha = 1;
    D.ctx.restore();
  };
})();
