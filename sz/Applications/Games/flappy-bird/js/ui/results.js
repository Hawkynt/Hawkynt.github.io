;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Result panels over the frozen run: the pause menu (with the Nest and the Wardrobe),
     Game Over with medal, new best, the Arcade rank and the coins paid, and Stage Clear
     with the popping stars. Reads G. */

  const { CANVAS_W, CANVAS_H, CLEAR_PW, CLEAR_HEAD_H, CLEAR_STARS_H, CLEAR_PH, CLEAR_STAR_CY, STATE_PLAYING } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const Run = NS.run;
  const Shapes = NS.shapes;
  const Menu = NS.menu;
  const Nav = NS.nav;

  function slideIn() {
    const pt = Math.min(1, (G.globalTime - G.panelAt) / 0.3);
    const e = 1 - Math.pow(1 - pt, 3);
    return { a: e, off: (1 - e) * 60 };
  }

  // Paused overlay — resume, restart, the Nest and the Wardrobe, quit (the run stays saved)
  function drawPausePanel() {
    Shapes.dimBackdrop();
    const pw = 380, ph = G.mode === 'zen' ? 392 : 346;
    const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2;
    ui.drawPanel(px, py, pw, ph);
    ui.drawHeadline('PAUSED', CANVAS_W / 2, py + 46, pw - 40, 40, ui.UI.text);
    let y = py + 84;
    const bw = pw - 80, bh = 40, step = 46;
    Menu.drawButton('p-resume', 'Resume', px + 40, y, bw, bh, { action: () => { G.state = STATE_PLAYING; G.invuln = Math.max(G.invuln, 0.4); Nav.updateStatus(); } });
    y += step;
    if (G.mode === 'zen') {
      Menu.drawButton('p-end', 'End flight', px + 40, y, bw, bh, { accent: '#bff4ff', action: () => Run.finishRun('quit') });
      y += step;
    }
    Menu.drawButton('p-nest', 'Nest - Tech Tree', px + 40, y, bw, bh, { sub: G.save.coins + ' coins to spend', action: Nav.goNest });
    y += step;
    Menu.drawButton('p-wardrobe', 'Wardrobe', px + 40, y, bw, bh, { action: Nav.goAviary });
    y += step;
    Menu.drawButton('p-restart', 'Restart', px + 40, y, bw, bh, { action: () => Run.startRun() });
    y += step;
    Menu.drawButton('p-quit', 'Quit to Menu', px + 40, y, bw, bh, { sub: 'The run stays saved for Continue', action: Nav.quitToMenu });
  }

  function deathTitle() {
    if (G.mode === 'time')
      return 'Time!';
    if (G.mode === 'zen')
      return 'Flight complete';
    if (G.mode === 'bossrush')
      return 'Boss Rush over';
    return 'Game Over';
  }

  // Death screen — the panel is only as tall as the rows it actually shows
  function drawDeathPanel() {
    Shapes.dimBackdrop();
    const pw = 420;
    const medal = (G.mode === 'classic' || G.mode === 'daily') ? Rules.getMedal(G.score) : null;
    const headH = 36, scoreH = 40, bestH = 30, coinH = 28, comboH = 26, medalH = 118, chipH = 44, padH = 14;
    let ph = headH + scoreH + bestH + coinH + comboH + padH;
    if (medal)
      ph += medalH;
    if (G.newBest || G.rankArcade >= 0)
      ph += chipH;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 20;
    const rowsH = headH + scoreH + bestH + coinH + comboH;
    const medalCY = py + rowsH + 52;
    const chipCY = py + rowsH + (medal ? medalH : 0) + chipH / 2;
    const sl = slideIn();
    ctx.save();
    ctx.globalAlpha *= sl.a;
    ctx.translate(0, sl.off);
    ui.drawPanel(px, py, pw, ph, { title: deathTitle(), titlePx: 24 });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ramp = Math.min(1, (G.globalTime - G.panelAt) / 0.8);
    const main = G.mode === 'arcade' ? Math.round(G.points * ramp).toLocaleString('en-US') + ' pts' : 'Score: ' + Math.round(G.score * ramp);
    ui.fitText(main, CANVAS_W / 2, py + headH + scoreH / 2, pw - 60, 30, { weight: 'bold', color: ui.UI.text });
    let bestText;
    if (G.mode === 'adventure') {
      const st = SZ.FlappyCourse.STAGES[G.stageIndex];
      const stars = Math.min(3, G.save.stars[st.id] || 0);
      bestText = 'Stage ' + st.id + ' - best ' + '★'.repeat(stars) + '☆'.repeat(3 - stars);
    } else if (G.mode === 'bossrush') {
      bestText = 'Reached round ' + ((G.bossRush ? G.bossRush.index : 0) + 1);
    } else {
      bestText = 'Best: ' + Prog.modeBest().toLocaleString('en-US');
    }
    ui.fitText(bestText, CANVAS_W / 2, py + headH + scoreH + bestH / 2, pw - 60, 18, { color: G.mode === 'adventure' ? ui.UI.gold : ui.UI.textDim });
    const rw = G.runReward || { coins: G.coinsRun, interest: 0 };
    ui.fitText('+' + Math.round(rw.coins * ramp) + ' coins' + (rw.interest ? '  +' + rw.interest + ' interest' : '') + (G.tokensRun ? '  +' + G.tokensRun + ' tokens' : '') + '  -  ' + G.save.coins + ' total',
      CANVAS_W / 2, py + headH + scoreH + bestH + coinH / 2, pw - 40, 17, { color: ui.UI.gold });
    ui.fitText(G.mode === 'zen' ? 'Longest flow ' + G.flow + '  -  bumps ' + G.zenBumps : 'Best combo ' + G.bestCombo + '  -  Perfect passes ' + G.perfects,
      CANVAS_W / 2, py + rowsH - comboH / 2, pw - 60, 15, { color: ui.UI.textDim });

    if (medal) {
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
      ctx.fillStyle = medal.color;
      ctx.globalAlpha *= 0.3;
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, medalCY, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha /= 0.3;
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, medalCY, 40, 0, Math.PI * 2);
      ctx.fill();
      Shapes.drawStarShape(CANVAS_W / 2, medalCY, 20, true);
      ui.fitText(medal.name, CANVAS_W / 2, medalCY + 54, pw - 60, 20, { weight: 'bold', color: ui.UI.text });
    }

    if (G.newBest || G.rankArcade >= 0) {
      const cs = 1 + 0.06 * Math.sin(G.globalTime * 6);
      ctx.save();
      ctx.translate(CANVAS_W / 2, chipCY);
      ctx.scale(cs, cs);
      ctx.translate(-CANVAS_W / 2, -chipCY);
      const label = G.newBest ? 'NEW BEST!' : 'Arcade table: #' + (G.rankArcade + 1);
      ui.drawChip(label, CANVAS_W / 2, chipCY - 15, 30, { align: 'center', color: '#1a1200', bg: ui.UI.gold, border: ui.UI.goldDeep });
      ctx.restore();
    }
    ctx.restore();

    const by = py + ph + 16 + sl.off;
    Menu.drawButton('d-retry', G.mode === 'zen' ? 'Fly again' : 'Retry', CANVAS_W / 2 - 250, by, 160, 50, { action: () => Run.startRun() });
    Menu.drawButton('d-nest', 'Nest', CANVAS_W / 2 - 80, by, 160, 50, { sub: G.save.coins + ' coins', action: Nav.goNest });
    Menu.drawButton('d-menu', 'Menu', CANVAS_W / 2 + 90, by, 160, 50, { action: Nav.quitToMenu });
  }

  // Stage clear — the panel slides in and the stars pop in one by one
  function drawClearPanel() {
    Shapes.dimBackdrop();
    const pw = CLEAR_PW, ph = CLEAR_PH;
    const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2 - 20;
    const linesY = py + CLEAR_HEAD_H + CLEAR_STARS_H;
    const panelT = G.globalTime - G.panelAt;
    const sl = slideIn();
    const rush = G.mode === 'bossrush';
    ctx.save();
    ctx.globalAlpha *= sl.a;
    ctx.translate(0, sl.off);
    ui.drawPanel(px, py, pw, ph, { title: rush ? 'Boss Rush cleared!' : G.bossBeaten ? 'Boss defeated!' : 'Stage Clear!', titlePx: 24, accent: ui.UI.gold, glow: true });

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

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ramp = Math.min(1, panelT / 0.8);
    if (rush) {
      ui.fitText('Time: ' + G.runTime.toFixed(1) + ' s' + (G.newBest ? '  NEW BEST!' : ''), CANVAS_W / 2, linesY + 16, pw - 60, 22, { weight: 'bold', color: ui.UI.gold });
      ui.fitText('Bosses beaten: ' + G.bossRush.list.length, CANVAS_W / 2, linesY + 44, pw - 60, 18, { color: ui.UI.text });
    } else {
      ui.fitText('Coins: ' + Math.round(G.coinsPicked * ramp) + ' / ' + G.course.totalCoins, CANVAS_W / 2, linesY + 16, pw - 60, 22, { color: ui.UI.gold });
    }
    const rw = G.runReward || { coins: G.coinsRun, interest: 0 };
    ui.fitText('+' + Math.round(rw.coins * ramp) + ' coins earned' + (rw.interest ? '  +' + rw.interest + ' interest' : ''), CANVAS_W / 2, linesY + 44 + (rush ? 26 : 0), pw - 60, 19, { color: ui.UI.gold });
    ui.fitText('Total coins: ' + G.save.coins, CANVAS_W / 2, linesY + 70 + (rush ? 20 : 0), pw - 60, 16, { color: ui.UI.textDim });
    ui.fitText('Hits taken: ' + G.hitsTaken, CANVAS_W / 2, linesY + 100, pw - 60, 18, { color: G.hitsTaken === 0 ? ui.UI.good : ui.UI.textDim });
    ui.fitText('Best combo ' + G.bestCombo + '  -  Perfect passes ' + G.perfects, CANVAS_W / 2, linesY + 128, pw - 60, 15, { color: ui.UI.textDim });
    ctx.restore();

    const by = py + ph + 16 + sl.off;
    if (rush) {
      Menu.drawButton('c-again', 'Again', CANVAS_W / 2 - 170, by, 160, 50, { action: () => Run.startRun() });
      Menu.drawButton('c-menu', 'Menu', CANVAS_W / 2 + 10, by, 160, 50, { action: Nav.quitToMenu });
      return;
    }
    const next = G.stageIndex + 1;
    const hasNext = next < SZ.FlappyCourse.STAGES.length;
    Menu.drawButton('c-next', 'Next Stage', CANVAS_W / 2 - 255, by, 160, 50, { action: () => Nav.startStage(next), disabled: !hasNext });
    Menu.drawButton('c-replay', 'Replay', CANVAS_W / 2 - 80, by, 160, 50, { action: () => Run.startRun() });
    Menu.drawButton('c-map', 'World Map', CANVAS_W / 2 + 95, by, 160, 50, { action: Nav.goWorlds });
  }

  Object.assign(NS.results, { drawPausePanel, drawDeathPanel, drawClearPanel });
})();
