/* Panels and full-screen overlays above the world: wave banner, pause, game over, stage clear,
   level clear, light sweep, combo pop, boss warning, flash and fade. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { GAME_W, GAME_H } = NS.constants;
  const { MODES } = NS.data;
  const { playSfx } = NS.audio;
  const { ctx, visibleRect, fillVisible, ui } = NS.view;
  const { startStage } = NS.stages;
  const { drawStarShape, drawTick, drawCross, drawButton } = NS.widgets;
  const { restartRun, quitToMenu, setScreen } = NS.screens;

  /* Screen flash (in game coordinates) */
  function drawScreenFlash() {
    if (G.screenFlashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = G.screenFlashAlpha;
      ctx.fillStyle = G.screenFlashColor;
      fillVisible();
      ctx.restore();
    }
  }

  function drawOverlays() {
    // Overlays (drawn in game coordinate space)
    ctx.save();

    if (G.waveNameTimer > 0 && G.gameState === 'playing')
      drawWaveBanner();

    if (G.gameState === 'paused')
      drawPausePanel();

    if (G.gameState === 'gameover')
      drawGameOverPanel();

    if (G.gameState === 'stageClear')
      drawStageClearPanel();

    if (G.gameState === 'levelComplete')
      drawLevelClearPanel();

    if (G.sweep > 0)
      drawSweep();

    if (G.comboPop)
      drawComboPop();

    if (G.gameState === 'bossIntro')
      drawBossIntro();

    if (G.gameState === 'bossVictory')
      ui.drawHeadline('BOSS DEFEATED!', GAME_W / 2, GAME_H / 2 - 15, 520, 42, ui.UI.gold, ui.UI.goldDeep);

    ctx.restore();
  }

  /* Wave name announcement */
  function drawWaveBanner() {
    const alpha = Math.min(1, G.waveNameTimer / 500);
    ctx.save();
    ctx.globalAlpha = alpha;
    const bw = 460, bh = 120;
    const bx = GAME_W / 2 - bw / 2, by = GAME_H / 2 - 30 - bh / 2;
    ui.drawPanel(bx, by, bw, bh, { accent: ui.UI.accent });
    ui.drawHeadline(G.waveNameText, GAME_W / 2, by + 44, bw - 48, 26, '#e4eaf6', ui.UI.accent);
    ctx.fillStyle = ui.UI.textDim;
    ctx.font = ui.uiFont(18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Level ' + G.level, GAME_W / 2, by + 84);
    ctx.restore();
  }

  function drawPausePanel() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    fillVisible();
    const pw = 420, ph = 280;
    const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - ph / 2;
    ui.drawPanel(px, py, pw, ph, { accent: ui.UI.accent });
    ui.drawHeadline('PAUSED', GAME_W / 2, py + 48, pw - 48, 42, '#e4eaf6', ui.UI.accent);
    drawButton('pause-resume', 'Resume', GAME_W / 2 - 160, py + 92, 320, 48,
      { action: () => { G.gameState = 'playing'; } });
    drawButton('pause-restart', 'Restart', GAME_W / 2 - 160, py + 148, 320, 48,
      { action: restartRun });
    drawButton('pause-quit', 'Quit to Menu', GAME_W / 2 - 160, py + 204, 320, 48,
      { action: quitToMenu });
  }

  function drawGameOverPanel() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    fillVisible();
    const pw = 520, ph = 360;
    const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - ph / 2;
    ui.drawPanel(px, py, pw, ph, { accent: ui.UI.bad });
    ui.drawHeadline('GAME OVER', GAME_W / 2, py + 56, pw - 48, 48, ui.UI.bad, '#8a1424');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ui.UI.gold;
    ctx.font = ui.uiFont(27, 'bold');
    ctx.fillText('Score: ' + G.score, GAME_W / 2, py + 118);
    ctx.fillStyle = ui.UI.textDim;
    ctx.font = ui.uiFont(21);
    const runLabel = G.gameMode === 'campaign' && G.stageInfo
      ? G.stageInfo.id + ' ' + G.stageInfo.name
      : MODES[G.gameMode].name + ' - Level ' + G.level;
    ctx.fillText(runLabel, GAME_W / 2, py + 158);
    if (G.runResult) {
      ctx.fillStyle = ui.UI.gold;
      ctx.font = ui.uiFont(22, 'bold');
      ctx.fillText('+' + G.runResult.credits + ' credits' + (G.runResult.newBest ? '  ·  NEW BEST' : ''),
        GAME_W / 2, py + 200);
    }
    drawButton('go-retry', 'Retry', GAME_W / 2 - 210, py + 262, 200, 48,
      { px: 18, action: restartRun });
    drawButton('go-menu', 'Menu', GAME_W / 2 + 10, py + 262, 200, 48,
      { px: 18, action: quitToMenu });
  }

  function drawStageClearPanel() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    fillVisible();
    const pw = 560, ph = 440;
    const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - ph / 2;
    ui.drawPanel(px, py, pw, ph, { accent: ui.UI.gold });
    ui.drawHeadline(G.stageInfo.name, GAME_W / 2, py + 52, pw - 48, 36, ui.UI.gold, ui.UI.goldDeep);

    const stars = G.stageResult ? G.stageResult.stars : 0;
    for (let i = 0; i < 3; ++i)
      drawStarShape(GAME_W / 2 + (i - 1) * 64, py + 112, 22, i < stars);
    /* one rising coin pop per earned star, spaced a third of a second apart */
    if (G.stageStarBeats < stars && G.gameTime >= G.stageClearTime + G.stageStarBeats * 300) {
      playSfx('coin', { pitch: 1 + G.stageStarBeats * 0.15 });
      ++G.stageStarBeats;
    }

    const starText = SZ.InvaderCampaign.STAR_TEXT(G.stageInfo);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; ++i) {
      const y = py + 172 + i * 34;
      const earned = i < stars;
      if (earned) drawTick(GAME_W / 2 - 190, y, ui.UI.good);
      else drawCross(GAME_W / 2 - 190, y, ui.UI.bad);
      ctx.fillStyle = earned ? ui.UI.text : ui.UI.textMute;
      ctx.font = ui.uiFont(19);
      ctx.fillText(starText[i], GAME_W / 2 - 166, y);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = ui.UI.text;
    ctx.font = ui.uiFont(24, 'bold');
    ctx.fillText('Score: ' + (G.stageResult ? G.stageResult.score : G.score), GAME_W / 2, py + 292);
    ctx.fillStyle = ui.UI.gold;
    ctx.font = ui.uiFont(22, 'bold');
    ctx.fillText('+' + (G.stageResult ? G.stageResult.credits : 0) + ' credits', GAME_W / 2, py + 326);
    const scButtons = [];
    const nextStageInfo = SZ.InvaderCampaign.nextStage(G.stageInfo.id);
    if (nextStageInfo)
      scButtons.push({ label: 'Next Stage', action: () => startStage(SZ.InvaderCampaign.stageIndexById(nextStageInfo.id)) });
    scButtons.push({ label: 'Replay', action: () => startStage(G.stageIndex) });
    scButtons.push({ label: 'Campaign Map', action: () => setScreen('campaignMap') });
    const scW = 160, scGap = 12;
    const scTotal = scButtons.length * scW + (scButtons.length - 1) * scGap;
    for (let i = 0; i < scButtons.length; ++i)
      drawButton('sc-' + i, scButtons[i].label, GAME_W / 2 - scTotal / 2 + i * (scW + scGap), py + ph - 66, scW, 44,
        { px: 16, action: scButtons[i].action });
  }

  function drawLevelClearPanel() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    fillVisible();
    const pw = 460, ph = 120;
    const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - ph / 2;
    ui.drawPanel(px, py, pw, ph, { accent: ui.UI.accent });
    const text = G.gameMode === 'survival' ? 'WAVE CLEAR' : 'LEVEL CLEAR';
    ui.drawHeadline(text, GAME_W / 2, GAME_H / 2, pw - 48, 36, '#5af2ff', ui.UI.accent);
  }

  /* Wave-clear light sweep, only while visible */
  function drawSweep() {
    const v = visibleRect();
    const sp = 1 - G.sweep / 0.6;
    const scx = (v.x0 - 160) + sp * ((v.x1 - v.x0) + 320);
    const sg = ctx.createLinearGradient(scx - 80, 0, scx + 80, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(scx - 80, v.y0, 160, v.y1 - v.y0);
  }

  /* Combo pop-up: big multiplier scaling down from 1.6 */
  function drawComboPop() {
    const cp = G.comboPop.t / 0.5;
    const cscale = 1.6 - 0.6 * cp;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - cp);
    ctx.translate(GAME_W / 2, GAME_H / 2 - 60);
    ctx.scale(cscale, cscale);
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.strokeText(G.comboPop.text, 0, 0);
    ctx.fillStyle = G.comboPop.color;
    ctx.fillText(G.comboPop.text, 0, 0);
    ctx.restore();
  }

  function drawBossIntro() {
    drawWarningStripes();
    if (G.bossWarningTimer > 1000 && G.boss) {
      const flash = Math.sin(G.gameTime * 0.015) > 0;
      const pulse = 1 + 0.05 * Math.sin(G.gameTime * 0.012);
      const pw = 460, ph = 150;
      const px = GAME_W / 2 - pw / 2, py = GAME_H / 2 - 30 - ph / 2;
      ui.drawPanel(px, py, pw, ph, { accent: flash ? ui.UI.bad : '#800' });
      ctx.save();
      ctx.translate(GAME_W / 2, GAME_H / 2 - 30);
      ctx.scale(pulse, pulse);
      ctx.translate(-GAME_W / 2, -(GAME_H / 2 - 30));
      ui.drawHeadline('WARNING', GAME_W / 2, GAME_H / 2 - 30, pw - 48, 54,
        flash ? '#ff5a5a' : '#aa3333', '#800');
      ctx.restore();
      const bspec = SZ.InvaderArt.BOSSES[G.boss.design] || SZ.InvaderArt.BOSSES[0];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bspec.color || ui.UI.gold;
      ctx.font = ui.uiFont(24, 'bold');
      ctx.fillText(G.boss.name || bspec.name, GAME_W / 2, GAME_H / 2 + 12);
      ctx.fillStyle = ui.UI.textDim;
      ctx.font = ui.uiFont(18);
      ctx.fillText('Boss approaching...', GAME_W / 2, GAME_H / 2 + 36);
    }
  }

  /* Black veil over everything while a screen transition runs */
  function drawFade() {
    if (G.fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = G.fade;
    ctx.fillStyle = '#000';
    fillVisible();
    ctx.restore();
  }

  /* Diagonal red hazard bands scrolling across top and bottom during a boss entrance */
  function drawWarningStripes() {
    const bandH = 44, step = 48;
    const off = (G.gameTime * 0.15) % step;
    const v = visibleRect();
    ctx.save();
    for (let band = 0; band < 2; ++band) {
      const y0 = band === 0 ? v.y0 : v.y1 - bandH;
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(26,2,6,0.75)';
      ctx.fillRect(v.x0, y0, v.x1 - v.x0, bandH);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ff2a2a';
      for (let x = v.x0 - step + off; x < v.x1 + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x + 22, y0);
        ctx.lineTo(x + 8, y0 + bandH);
        ctx.lineTo(x - 14, y0 + bandH);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  Object.assign(NS.overlays, {
    drawScreenFlash, drawFade, drawOverlays
  });
})();
