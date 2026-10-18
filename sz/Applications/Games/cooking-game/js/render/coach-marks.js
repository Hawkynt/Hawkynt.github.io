;(function() {
  'use strict';

  /* Drawing the coach marks: pulsing outline, arrow and the hint panel.
     Writes G.coachSkip (the Skip button as drawn) for the click handler. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, RAIL_Y } = NS.C;
  const { ctx, ui } = NS.view;
  const { coachTarget } = NS.coach;

  /* ── coach marks: pulsing outline, bobbing arrow and the hint panel ── */
  const COACH_PW = 340, COACH_PH = 88;

  function drawCoachOutline(tg) {
    const pulse = 0.5 + 0.5 * Math.sin(G.animT * 5);
    const g = 3 + pulse * 4;
    ctx.save();
    ui.roundRectPath(tg.x - g, tg.y - g, tg.w + g * 2, tg.h + g * 2, 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,90,' + (0.25 + 0.2 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,235,150,' + (0.75 + 0.25 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  /* a fat gold arrow from (x0, y0) to the tip at (x1, y1), nudging forward */
  function drawCoachArrow(x0, y0, x1, y1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 12) return;
    const bob = (Math.sin(G.animT * 6) + 1) * 4;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    ctx.translate(-bob, 0);
    const l = Math.max(18, len - 8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-18, -13);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-l, -5);
    ctx.lineTo(-l, 5);
    ctx.lineTo(-18, 5);
    ctx.lineTo(-18, 13);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    const g = ctx.createLinearGradient(0, -13, 0, 13);
    g.addColorStop(0, '#fff2b8');
    g.addColorStop(0.5, ui.UI.gold);
    g.addColorStop(1, ui.UI.goldDeep);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function drawCoach() {
    const tg = coachTarget();
    if (!tg) return;
    const pw = COACH_PW, ph = COACH_PH;
    let px, py, ax0 = 0, ay0 = 0, ax1 = 0, ay1 = 0;
    if (tg.place === 'side') {
      const cy = tg.y + tg.h / 2;
      py = Math.max(16, Math.min(VIEW_H - 16 - ph, cy - ph / 2));
      px = tg.x + tg.w + 46;
      ax0 = px - 4;
      ax1 = tg.x + tg.w + 8;
      if (px + pw > VIEW_W - 16) {
        px = tg.x - 46 - pw;
        ax0 = px + pw + 4;
        ax1 = tg.x - 8;
      }
      ay0 = ay1 = cy;
    } else if (tg.place === 'station') {
      /* level with the ticket rail beside the station, pointing down at it */
      py = RAIL_Y - 8;
      px = tg.x + tg.w + 40;
      ax0 = px - 4;
      ax1 = tg.x + tg.w + 6;
      if (px + pw > VIEW_W - 16) {
        px = tg.x - 40 - pw;
        ax0 = px + pw + 4;
        ax1 = tg.x - 6;
      }
      ay0 = py + ph / 2;
      ay1 = tg.y + tg.h * 0.45;
    } else {
      px = VIEW_W / 2 - pw / 2;
      py = 150;
    }
    ctx.save();
    let a = Math.min(1, G.coach.t / 0.25);
    if (G.coach.step === 5) a = Math.min(a, G.coach.hideT / 0.4);
    ctx.globalAlpha = Math.max(0, a);
    if (tg.w) {
      drawCoachOutline(tg);
      drawCoachArrow(ax0, ay0, ax1, ay1);
    }
    ui.drawPanel(px, py, pw, ph, { title: 'Chef\'s tip  ' + G.coach.step + ' / 5', accent: ui.UI.gold, glow: true, headerH: 28, titlePx: 14, titleRightPad: 84 });
    /* the 'Skip tips' button in the header */
    const bw = 76, bh = 20, bx = px + pw - 8 - bw, by = py + 4;
    const hot = G.mouseX >= bx && G.mouseX <= bx + bw && G.mouseY >= by && G.mouseY <= by + bh;
    ui.roundRectPath(bx, by, bw, bh, bh / 2);
    ctx.fillStyle = hot ? 'rgba(255,215,90,0.28)' : 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hot ? 'rgba(255,215,90,0.9)' : 'rgba(255,215,90,0.45)';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Skip tips', bx + bw / 2, by + bh / 2 + 1, bw - 12, 11, { weight: 'bold', color: hot ? '#fff' : ui.UI.textDim });
    G.coachSkip = { x: bx, y: by, w: bw, h: bh };
    ui.drawTextBlock(tg.text, px + 16, py + 34, pw - 32, ph - 42, 16, { color: ui.UI.text, weight: 'bold', valign: 'middle' });
    ctx.restore();
  }

  NS.coachMarks = { drawCoach };

})();
