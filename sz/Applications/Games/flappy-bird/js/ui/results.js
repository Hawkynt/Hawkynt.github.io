;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Result panels over the frozen run: pause menu, Game Over with medal and new best,
     and Stage Clear with the popping stars. Reads G. */

  const {
    CANVAS_W, CANVAS_H, CLEAR_PW, CLEAR_HEAD_H, CLEAR_STARS_H, CLEAR_PH, CLEAR_STAR_CY, STATE_PLAYING
  } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const Run = NS.run;
  const Shapes = NS.shapes;
  const Menu = NS.menu;
  const Nav = NS.nav;

  // Paused overlay
  function drawPausePanel() {
    Shapes.dimBackdrop();
    const pw = 360;
    const ph = 240;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 60;
    ui.drawPanel(px, py, pw, ph);
    ui.drawHeadline('PAUSED', CANVAS_W / 2, py + 52, pw - 40, 44, ui.UI.text);
    Menu.drawButton('p-resume', 'Resume', px + 40, py + 96, pw - 80, 40, { action: () => { G.state = STATE_PLAYING; Nav.updateStatus(); } });
    Menu.drawButton('p-restart', 'Restart', px + 40, py + 144, pw - 80, 40, { action: () => Run.startRun() });
    Menu.drawButton('p-quit', 'Quit to Menu', px + 40, py + 192, pw - 80, 40, { action: Nav.quitToMenu });
  }

  // Death screen — the panel is only as tall as the rows it actually shows
  function drawDeathPanel() {
    Shapes.dimBackdrop();
    const pw = 380;
    const medal = (G.mode === 'classic' || G.mode === 'daily') ? Rules.getMedal(G.score) : null;
    const headH = 36, scoreH = 34, bestH = 32, coinH = 28, comboH = 28, medalH = 118, chipH = 44, padH = 14;
    let ph = headH + scoreH + bestH + coinH + comboH + padH;
    if (medal)
      ph += medalH;
    if (G.newBest)
      ph += chipH;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2;
    const rowsH = headH + scoreH + bestH + coinH + comboH;
    const medalCY = py + rowsH + 52;
    const chipCY = py + rowsH + (medal ? medalH : 0) + chipH / 2;
    const pt = Math.min(1, (G.globalTime - G.panelAt) / 0.3);
    const pEase = 1 - Math.pow(1 - pt, 3);
    const pOff = (1 - pEase) * 60;
    ctx.save();
    ctx.globalAlpha *= pEase;
    ctx.translate(0, pOff);
    ui.drawPanel(px, py, pw, ph, { title: G.mode === 'time' ? 'Time!' : 'Game Over', titlePx: 24 });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Score: ' + G.score, CANVAS_W / 2, py + headH + scoreH / 2, pw - 60, 26, { weight: 'bold', color: ui.UI.text });
    if (G.mode === 'adventure') {
      // Adventure has no running best score — the stage and its saved stars stand in for it
      const st = SZ.FlappyCourse.STAGES[G.stageIndex];
      const stars = Math.min(3, G.save.stars[st.id] || 0);
      ui.fitText('Stage ' + st.id + ' · best ' + '★'.repeat(stars) + '☆'.repeat(3 - stars), CANVAS_W / 2, py + headH + scoreH + bestH / 2, pw - 60, 20, { color: ui.UI.gold });
    } else {
      ui.fitText('Best: ' + Prog.modeBest(), CANVAS_W / 2, py + headH + scoreH + bestH / 2, pw - 60, 20, { color: ui.UI.textDim });
    }
    ui.fitText('+' + G.coinsRun + ' coins  ·  ' + G.save.coins + ' total', CANVAS_W / 2, py + headH + scoreH + bestH + coinH / 2, pw - 60, 20, { color: ui.UI.gold });
    ui.fitText('Best combo ' + G.bestCombo + '  ·  Perfect passes ' + G.perfects, CANVAS_W / 2, py + rowsH - comboH / 2, pw - 60, 18, { color: ui.UI.textDim });

    if (medal) {
      // Slowly rotating light rays behind the medal
      ctx.save();
      ctx.translate(CANVAS_W / 2, medalCY);
      ctx.rotate(G.globalTime * 0.5);
      ctx.globalAlpha *= 0.12;
      ctx.fillStyle = medal.color;
      for (let i = 0; i < 8; ++i) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(78, -7);
        ctx.lineTo(78, 7);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // The medal disc, with a wider translucent fill in place of a blur shadow
      ctx.save();
      ctx.fillStyle = medal.color;
      ctx.globalAlpha *= 0.3;
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, medalCY, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha /= 0.3;
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, medalCY, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ui.fitText(medal.name, CANVAS_W / 2, medalCY + 54, pw - 60, 20, { weight: 'bold', color: ui.UI.text });
    }

    if (G.newBest) {
      // The NEW BEST! chip breathes
      const cs = 1 + 0.06 * Math.sin(G.globalTime * 6);
      ctx.save();
      ctx.translate(CANVAS_W / 2, chipCY);
      ctx.scale(cs, cs);
      ctx.translate(-CANVAS_W / 2, -chipCY);
      ui.drawChip('NEW BEST!', CANVAS_W / 2, chipCY - 15, 30, {
        align: 'center',
        color: '#1a1200',
        bg: ui.UI.gold,
        border: ui.UI.goldDeep
      });
      ctx.restore();
    }

    ctx.restore();
    ctx.restore();

    Menu.drawButton('d-retry', 'Retry', CANVAS_W / 2 - 178, py + ph + 16 + pOff, 170, 50, { action: () => Run.startRun() });
    Menu.drawButton('d-menu', 'Menu', CANVAS_W / 2 + 8, py + ph + 16 + pOff, 170, 50, { action: Nav.quitToMenu });
  }

  // Adventure stage clear screen — the panel slides in and the stars pop in one by one
  function drawClearPanel() {
    Shapes.dimBackdrop();
    const pw = CLEAR_PW;
    const ph = CLEAR_PH;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2;
    const linesY = py + CLEAR_HEAD_H + CLEAR_STARS_H;
    const panelT = G.globalTime - G.panelAt;
    const pt = Math.min(1, panelT / 0.3);
    const pEase = 1 - Math.pow(1 - pt, 3);
    const pOff = (1 - pEase) * 60;
    ctx.save();
    ctx.globalAlpha *= pEase;
    ctx.translate(0, pOff);
    ui.drawPanel(px, py, pw, ph, { title: 'Stage Clear!', titlePx: 24, accent: ui.UI.gold, glow: true });

    for (let i = 0; i < 3; ++i) {
      const sx = CANVAS_W / 2 + (i - 1) * 92, sy = py + CLEAR_STAR_CY;
      const st = panelT - (0.4 + i * 0.35);
      if (st < 0) {
        Shapes.drawStarShape(sx, sy, 34, false);
        continue;
      }
      // Each star overshoots at 1.6 and settles to 1
      const su = Math.min(1, st / 0.25);
      const sScale = 1.6 - 0.6 * (1 - Math.pow(1 - su, 3));
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(sScale, sScale);
      ctx.translate(-sx, -sy);
      Shapes.drawStarShape(sx, sy, 34, i < G.lastStars);
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Both coin tallies count up over the first second — the pickups and the paid-out value differ
    const ramp = Math.min(1, panelT / 0.8);
    const shownPicked = Math.round(G.coinsPicked * ramp);
    const shownEarned = Math.round(G.coinsRun * ramp);
    ui.fitText('Coins: ' + shownPicked + ' / ' + G.course.totalCoins, CANVAS_W / 2, linesY + 16, pw - 60, 22, { color: ui.UI.gold });
    ui.fitText('+' + shownEarned + ' coins earned', CANVAS_W / 2, linesY + 44, pw - 60, 20, { color: ui.UI.gold });
    ui.fitText('Total coins: ' + G.save.coins, CANVAS_W / 2, linesY + 70, pw - 60, 18, { color: ui.UI.textDim });
    ui.fitText('Hits taken: ' + G.hitsTaken, CANVAS_W / 2, linesY + 100, pw - 60, 20, { color: G.hitsTaken === 0 ? ui.UI.good : ui.UI.textDim });
    ui.fitText('Best combo ' + G.bestCombo + '  ·  Perfect passes ' + G.perfects, CANVAS_W / 2, linesY + 128, pw - 60, 18, { color: ui.UI.textDim });
    ctx.restore();
    ctx.restore();

    const next = G.stageIndex + 1;
    const hasNext = next < SZ.FlappyCourse.STAGES.length;
    Menu.drawButton('c-next', 'Next Stage', CANVAS_W / 2 - 207, py + ph + 16 + pOff, 130, 50, { action: () => { G.stageIndex = next; Run.startRun(); }, disabled: !hasNext });
    Menu.drawButton('c-replay', 'Replay', CANVAS_W / 2 - 65, py + ph + 16 + pOff, 130, 50, { action: () => Run.startRun() });
    Menu.drawButton('c-map', 'World Map', CANVAS_W / 2 + 77, py + ph + 16 + pOff, 130, 50, { action: Nav.goWorlds });
  }

  Object.assign(NS.results, { drawPausePanel, drawDeathPanel, drawClearPanel });
})();
