;(function() {
  'use strict';

  /* The pause overlay and the day-end results panel with stars, rows and
     the next / retry / menu buttons. Reads G. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, STATE_TITLE, STATE_PLAYING } = NS.C;
  const { ctx, ui, fillVisibleRect } = NS.view;
  const { careerUnlocked, bestForMode } = NS.persist;
  const { updateWindowTitle, updateStatus } = NS.status;
  const { startDay } = NS.day;
  const { drawRibbon } = NS.sprites;
  const { setScreen, drawButton } = NS.menu;

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(10,4,0,0.62)';
    fillVisibleRect();
    const pw = 460, ph = 200;
    const px = VIEW_W / 2 - pw / 2, py = VIEW_H / 2 - ph / 2;
    ui.drawPanel(px, py, pw, ph, { accent: '#ff7a3a' });
    ui.drawHeadline('PAUSED', VIEW_W / 2, py + 54, pw - 48, 54, '#ffffff', '#ff8a3a');
    /* one row of equal-width buttons: side padding 28, gap 16, 56 high,
       24 px above the panel bottom */
    const btnW = (pw - 2 * 28 - 2 * 16) / 3;
    const btnY = py + ph - 24 - 56;
    drawButton('pause-resume', 'Resume', px + 28, btnY, btnW, 56,
      { px: 17, color: 'green', action: () => { G.state = STATE_PLAYING; updateWindowTitle(); updateStatus(); } });
    drawButton('pause-restart', 'Restart Day', px + 28 + btnW + 16, btnY, btnW, 56,
      { px: 15, color: 'orange', action: () => startDay(G.mode, G.mode === 'career' ? G.dayIndex : 0) });
    drawButton('pause-menu', 'Menu', px + 28 + 2 * (btnW + 16), btnY, btnW, 56,
      { px: 17, color: 'wood', action: () => setScreen(STATE_TITLE) });
  }

  function drawDayOver() {
    const appear = Math.min(1, G.dayOverT / 0.35);
    ctx.fillStyle = 'rgba(10,4,0,' + (0.68 * appear).toFixed(3) + ')';
    fillVisibleRect();
    const px = 390, py = 96, pw = 500, ph = 470;
    const won = G.mode === 'career' ? G.dayResult.stars > 0 : G.dayResult.newBest;
    /* the panel drops in with a little overshoot */
    const e = appear < 1 ? 1 - Math.pow(1 - appear, 3) * Math.cos(appear * 7) : 1;
    ctx.save();
    ctx.translate(0, (1 - e) * -220);
    if (won) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4;
      ctx.translate(VIEW_W / 2, py + 150);
      ctx.rotate(G.animT * 0.25);
      ui.drawGlow(0, 0, 760, '#ffb040', 16);
      ctx.restore();
    }
    const what = G.mode === 'career' ? 'Day ' : G.mode === 'daily' ? 'Daily ' : 'Rush ';
    ui.drawPanel(px, py, pw, ph, { accent: G.location.color });
    drawRibbon(VIEW_W / 2, py + 4, pw - 120, 46, what + G.dayInfo.id + ' — ' + G.location.name, won ? '#c8302a' : '#6a5a4a');
    const headline = G.mode === 'career' ? (G.dayResult.stars > 0 ? 'Day complete!' : 'Closed at a loss')
      : G.mode === 'daily' ? 'Daily Special over!' : 'Rush over!';
    ui.drawHeadline(headline, VIEW_W / 2, py + 76, pw - 60, 38, won ? '#ffd23f' : '#f2e6d0', won ? '#ff6a1a' : '#8a7a68');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (G.mode === 'career') {
      for (let i = 0; i < 3; ++i) {
        const sx = VIEW_W / 2 - 92 + i * 92, sy = py + 150 - (i === 1 ? 12 : 0);
        const size = i === 1 ? 84 : 70;
        ui.drawStar(sx, sy, size, false);
        if (i >= G.dayResult.stars) continue;
        /* the star slams in at 2x, settles, and keeps a glow */
        const k = G.dayOverT - (0.45 + i * 0.4);
        if (k < 0) continue;
        const s = k < 0.18 ? 2.2 - 1.3 * (k / 0.18) : k < 0.3 ? 0.9 + 0.1 * ((k - 0.18) / 0.12) : 1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, k * 4) * (0.7 + 0.2 * Math.sin(G.animT * 3 + i));
        ctx.translate(sx, sy);
        ctx.rotate(G.animT * 0.6 + i);
        ui.drawGlow(0, 0, size * 2.4, '#ffc840', 10);
        ctx.restore();
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate((1 - Math.min(1, k / 0.18)) * -0.6);
        ctx.scale(s, s);
        ui.drawStar(0, 0, size, true);
        ctx.restore();
      }
    } else {
      const bestLine = 'Best $' + bestForMode() + (G.dayResult.newBest ? '  ·  NEW BEST' : '');
      ui.drawHeadline(bestLine, VIEW_W / 2, py + 146, pw - 120, 36, '#ffd23f', G.location.color);
    }
    const rows = G.mode === 'career' ? [
      ['Earned', '$' + Math.round(G.earnedShown)],
      ['Goals', '$' + G.dayInfo.goals.join(' / $')],
      ['Served', String(G.served)],
      ['Walkouts', String(G.walkouts)],
      ['Best combo', '×' + (1 + Math.min(1, G.bestCombo * 0.1)).toFixed(1)]
    ] : [
      ['Earned', '$' + Math.round(G.earnedShown)],
      ['Served', String(G.served)],
      ['Walkouts', String(G.walkouts)],
      ['Ruined dishes', String(G.ruinedServed)],
      ['Best combo', '×' + (1 + Math.min(1, G.bestCombo * 0.1)).toFixed(1)]
    ];
    for (let i = 0; i < rows.length; ++i) {
      const ry = py + 214 + i * 30;
      const k = Math.min(1, Math.max(0, (G.dayOverT - 0.3 - i * 0.08) / 0.25));
      if (k <= 0) continue;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate((1 - k) * 30, 0);
      ui.roundRectPath(px + 44, ry - 13, pw - 88, 26, 6);
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,220,160,0.06)';
      ctx.fill();
      ctx.textAlign = 'left';
      ui.fitText(rows[i][0], px + 60, ry, 200, 16, { weight: 'bold', color: ui.UI.textDim });
      ctx.textAlign = 'right';
      ui.fitText(rows[i][1], px + pw - 60, ry, 220, i === 0 ? 20 : 16, { weight: 'bold', color: i === 0 ? '#ffe060' : '#fff', outline: i === 0 ? '#3a1a04' : null });
      ctx.restore();
    }
    const nextEnabled = G.mode === 'career' && G.dayResult.stars >= 1 &&
      careerUnlocked(G.dayIndex + 1) && G.dayIndex + 1 < SZ.KitchenData.CAREER.length;
    /* one row of equal-width buttons: side padding 28, gap 16, 58 high,
       24 px above the panel bottom */
    const btnN = G.mode === 'career' ? 3 : 2;
    const btnW = (pw - 2 * 28 - (btnN - 1) * 16) / btnN;
    const btnY = py + ph - 24 - 58;
    if (G.mode === 'career') {
      drawButton('do-next', 'Next Day', px + 28, btnY, btnW, 58,
        { px: 19, color: 'green', disabled: !nextEnabled, action: () => startDay('career', G.dayIndex + 1) });
      drawButton('do-retry', 'Retry', px + 28 + btnW + 16, btnY, btnW, 58,
        { px: 19, color: 'orange', action: () => startDay('career', G.dayIndex) });
      drawButton('do-menu', 'Menu', px + 28 + 2 * (btnW + 16), btnY, btnW, 58,
        { px: 19, color: 'wood', action: () => setScreen(STATE_TITLE) });
    } else {
      drawButton('do-retry', 'Retry', px + 28, btnY, btnW, 58,
        { px: 19, color: 'orange', action: () => startDay(G.mode, 0) });
      drawButton('do-menu', 'Menu', px + 28 + btnW + 16, btnY, btnW, 58,
        { px: 19, color: 'wood', action: () => setScreen(STATE_TITLE) });
    }
    if (G.mode === 'career' && !nextEnabled) {
      ctx.textAlign = 'center';
      ui.fitText(G.dayResult.stars < 1 ? 'Earn at least one star to move on.'
        : 'The career ends here — try endless later.', VIEW_W / 2, py + ph - 100, pw - 60, 13, { weight: 'bold', color: ui.UI.textDim });
    }
    ctx.restore();
  }

  NS.results = { drawPauseOverlay, drawDayOver };

})();
