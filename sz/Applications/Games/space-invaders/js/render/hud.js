/* The in-game HUD: score and combo, mode chip or boss health, lives, power-up timers, special meter.
   Reads G only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { GAME_W, PLAYER_W, COMBO_TIMEOUT } = NS.constants;
  const { POWERUPS, MODES, SHIP_DEFS, TREE_BRANCHES } = NS.data;
  const { currentShipId, maxSpecialCharges } = NS.progress;
  const { ctx, ui } = NS.view;

  function drawHud() {
    /* Score panel, top left */
    ui.drawPanel(16, 12, 300, 64, { accent: ui.UI.accent });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ui.UI.textDim;
    ctx.font = ui.uiFont(11, 'bold');
    ctx.fillText('SCORE', 30, 26);
    ctx.fillStyle = ui.UI.text;
    ctx.font = ui.uiFont(30, 'bold');
    ctx.fillText(String(G.score), 30, 52);
    if (G.comboMultiplier > 1 && G.comboTimer > 0) {
      ui.drawChip('COMBO x' + G.comboMultiplier, 302, 22, 24, {
        align: 'right',
        color: ui.UI.gold,
        bg: 'rgba(255,215,90,0.14)',
        border: 'rgba(255,215,90,0.5)',
      });
      ui.drawMeter(206, 54, 96, 6, G.comboTimer / COMBO_TIMEOUT, ui.UI.gold);
    }

    /* Mode / level / wave chip, top centre; a boss fight replaces it with the boss panel */
    const bossHud = G.boss && G.bossActive && G.gameState === 'playing';
    if (!bossHud) {
      let chipText;
      if (G.gameMode === 'campaign' && G.stageInfo)
        chipText = G.stageInfo.id + ' ' + G.stageInfo.name;
      else if (G.gameMode === 'daily')
        chipText = 'Daily · Level ' + G.level;
      else if (G.gameMode === 'survival')
        chipText = 'Survival · Wave ' + G.wave;
      else if (G.gameMode === 'bossRush')
        chipText = 'Boss Rush · Boss ' + Math.ceil(G.level / (MODES.bossRush.bossEvery || 1));
      else
        chipText = 'Classic · Level ' + G.level;
      ui.drawChip(chipText, GAME_W / 2, 16, 28, {
        align: 'center',
        color: ui.UI.text,
        bg: 'rgba(24,32,56,0.9)',
        border: ui.UI.rim,
      });
    }

    /* Lives + active power-ups panel, top right */
    ui.drawPanel(964, 12, 300, 64, { accent: ui.UI.accent });
    const shipId = currentShipId();
    const shownLives = Math.min(G.lives, 5);
    for (let i = 0; i < shownLives; ++i) {
      ctx.save();
      ctx.translate(980 + i * 30, 22);
      ctx.scale(0.55, 0.55);
      SZ.InvaderArt.drawShip(ctx, shipId, PLAYER_W / 2, 0, 1, 0, 1);
      ctx.restore();
    }
    if (G.lives > 5) {
      ctx.fillStyle = ui.UI.textDim;
      ctx.font = ui.uiFont(13, 'bold');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('+' + (G.lives - 5), 980 + 5 * 30, 30);
    }

    let capX = 1250;
    for (const id of Object.keys(G.activePowerups)) {
      const def = POWERUPS.find(p => p.id === id);
      if (!def || def.duration === 0 || G.activePowerups[id] <= 0) continue;
      const ratio = Math.min(1, G.activePowerups[id] / def.duration);
      ctx.save();
      ctx.translate(capX, 46);
      ctx.scale(0.8, 0.8);
      SZ.InvaderArt.drawCapsule(ctx, id, 0, 0, G.gameTime / 1000);
      ctx.restore();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(capX, 46, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
      capX -= 36;
    }

    /* Boss health panel, in place of the mode chip */
    if (bossHud) {
      const phase2 = G.boss.hp <= G.boss.maxHp / 2;
      const spec = SZ.InvaderArt.BOSSES[G.boss.design] || SZ.InvaderArt.BOSSES[0];
      const meterColor = phase2 ? (Math.sin(G.gameTime * 0.012) > 0 ? '#ff4a3a' : '#ff9a4a') : '#ffb03a';
      ui.drawPanel(400, 12, 480, 60, { accent: spec.color });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(G.boss.name || spec.name, 416, 28, 448, 20, { weight: 'bold', color: spec.color });
      ui.drawMeter(416, 46, 448, 14, G.boss.hp / G.boss.maxHp, meterColor);
    }

    /* Special ability meter, bottom left */
    const shipDef = SHIP_DEFS[currentShipId()];
    const maxCharges = maxSpecialCharges();
    const chargeReady = G.specialCharges > 0;
    const specialColor = TREE_BRANCHES.special.color;
    ui.drawPanel(16, 650, 260, 56, { accent: chargeReady ? specialColor : ui.UI.textMute });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ui.UI.textDim;
    ctx.font = ui.uiFont(11, 'bold');
    ctx.fillText('SPECIAL', 30, 664);
    ctx.fillStyle = chargeReady ? specialColor : ui.UI.text;
    ctx.font = ui.uiFont(15, 'bold');
    ctx.fillText(shipDef.specialName, 92, 664);
    ui.drawMeter(30, 680, 170, 10, G.special / 100, specialColor);
    for (let i = 0; i < maxCharges; ++i) {
      ctx.beginPath();
      ctx.arc(222 + i * 20, 685, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < G.specialCharges ? specialColor : 'rgba(255,255,255,0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (chargeReady) {
      ctx.save();
      ui.roundRectPath(17.5, 651.5, 257, 53, 8);
      ctx.strokeStyle = ui.hexToRgba(specialColor, 0.35 + 0.35 * Math.sin(G.gameTime * 0.01));
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ui.drawKeycap('E', 236, 656, 12);
    }
  }

  Object.assign(NS.hud, {
    drawHud
  });
})();
