;(function() {
  'use strict';

  /* The play HUD: the earnings panel with goals and combo, the Rush Hour
     Bell, and the ticket rail with its order slips. Reads G only. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { RAIL_X0, RAIL_Y, RAIL_W, RAIL_H, RAIL_GAP, RAIL_MAX, HUD_PX, HUD_PY, HUD_PW, HUD_PH,
    BELL } = NS.C;
  const { ctx, ui } = NS.view;
  const { fx } = NS.juice;
  const { treeLevel, bestForMode } = NS.persist;
  const { comboMult, spawnLimit } = NS.rules;
  const { ticketInSlot } = NS.stations;
  const { patienceColor, drawFlame } = NS.sprites;

  function drawRushBell() {
    const spent = G.rushUsed && G.rushTimer <= 0;
    const ring = G.rushTimer > 0 ? Math.sin(G.animT * 30) * 0.25 : 0;
    ctx.save();
    ctx.globalAlpha = spent ? 0.4 : 1;
    if (!spent) SZ.FoodArt.drawHalo(ctx, BELL.x, BELL.y, 60, 60, 'gold', G.rushTimer > 0 ? 0.9 : 0.4 + 0.2 * Math.sin(G.animT * 4));
    ctx.translate(BELL.x, BELL.y - 10);
    ctx.rotate(ring);
    ctx.translate(-BELL.x, -(BELL.y - 10));
    const g = ctx.createLinearGradient(BELL.x - 13, 0, BELL.x + 13, 0);
    g.addColorStop(0, '#a8741c');
    g.addColorStop(0.35, '#fff2b0');
    g.addColorStop(1, '#a8741c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(BELL.x, BELL.y - 2, 11, Math.PI, 0);
    ctx.lineTo(BELL.x + 14, BELL.y + 8);
    ctx.lineTo(BELL.x - 14, BELL.y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a3a0a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#5a3a0a';
    ctx.beginPath();
    ctx.arc(BELL.x, BELL.y + 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(G.rushTimer > 0 ? Math.ceil(G.rushTimer) + 's' : 'B', BELL.x, BELL.y + 24, 30, 11, { weight: 'bold', color: spent ? 'rgba(255,255,255,0.4)' : '#fff', outline: '#3a1a06' });
  }

  function drawHUD() {
    const px = HUD_PX, py = HUD_PY, pw = HUD_PW, ph = HUD_PH;
    ui.drawPanel(px, py, pw, ph, { title: 'Day ' + G.dayInfo.id, titleRight: G.location.name, accent: G.location.color, titleRightColor: G.location.color });
    const seated = G.customers.filter(c => c.state !== 'leaving').length;
    const limit = spawnLimit();
    const left = (isFinite(limit) ? Math.max(0, limit - G.spawned) : 0) + seated;
    /* the coin counter: spinning coin and a number that rolls and bumps */
    const coin = fx.coinFrame(G.hudBump > 0 || G.animT % 4 < 0.75 ? Math.floor(G.animT * 10) : 0);
    const bump = G.hudBump > 0 ? Math.sin(G.hudBump / 0.3 * Math.PI) * 0.22 : 0;
    if (coin) ctx.drawImage(coin, px + 12, py + 36, 30, 30);
    ctx.save();
    ctx.translate(px + 48, py + 52);
    ctx.scale(1 + bump, 1 + bump);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText('$' + Math.round(G.earnedShown), 0, 0, 110, 24, { weight: '900', color: '#ffe060', outline: '#3a1a04' });
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const line = G.mode === 'career'
      ? 'Served ' + G.served + '  ·  Left ' + left + (G.walkouts ? '  ·  Out ' + G.walkouts : '')
      : 'Served ' + G.served + '  ·  Out ' + G.walkouts + '/3  ·  Ruined ' + G.ruinedServed + '/3';
    ui.fitText(line, px + pw - 14, py + 52, pw - 180, 12, { weight: 'bold', color: ui.UI.textDim });
    if (G.dayInfo.goals[2] > 0) {
      const meterX = px + 16, meterY = py + 84, meterW = pw - 32, meterH = 14;
      const top = Math.max(1, G.dayInfo.goals[2]);
      ui.drawMeter(meterX, meterY, meterW, meterH, G.earnedShown / top, '#ffc928', { t: G.animT });
      if (G.meterTick > 0) {
        ui.roundRectPath(meterX - 2, meterY - 2, meterW + 4, meterH + 4, (meterH + 4) / 2);
        ctx.strokeStyle = 'rgba(255,255,220,' + (0.9 * G.meterTick / 0.25).toFixed(3) + ')';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      for (let i = 0; i < 3; ++i) {
        const gx = meterX + Math.min(1, G.dayInfo.goals[i] / top) * meterW;
        const got = G.earned >= G.dayInfo.goals[i];
        if (got) ui.drawGlow(gx - (i === 2 ? 6 : 0), meterY + meterH / 2, 44, '#ffd23f');
        ui.drawStar(gx - (i === 2 ? 6 : 0), meterY + meterH / 2, got ? 24 : 20, got);
      }
    } else {
      ctx.textAlign = 'left';
      ui.fitText('Best $' + bestForMode(), px + 16, py + 92, pw - 64, 13, { weight: 'bold', color: ui.UI.textDim });
    }
    if (G.combo > 0) {
      const flames = G.combo >= 10 ? 3 : G.combo >= 6 ? 2 : G.combo >= 3 ? 1 : 0;
      for (let i = 0; i < flames; ++i)
        drawFlame(px + 26 + i * 16, py + ph + 24, 12);
      const chipW = ui.drawChip('COMBO ×' + comboMult().toFixed(1), px + 10, py + ph + 8, 28,
        { px: 15, bg: 'rgba(120,30,4,0.88)', border: '#ffb048', color: '#ffe080' });
      if (flames) for (let i = 0; i < flames; ++i) drawFlame(px + chipW + 22 + i * 16, py + ph + 26, 10);
    }
    if (treeLevel('p_rush') > 0) drawRushBell();
  }

  /* Ticket rail between the pass and the stations: a brass bar with paper
     order slips clipped to it, oldest first, max 9 visible. New slips drop
     in and swing; the next step's station key blinks. */
  function drawTicketRail() {
    if (G.tickets.length === 0) return;
    const barX0 = 40, barX1 = 1240;
    ui.roundRectPath(barX0, RAIL_Y - 4, barX1 - barX0, 8, 4);
    ctx.fillStyle = '#7a5214';
    ctx.fill();
    ui.roundRectPath(barX0, RAIL_Y - 4, barX1 - barX0, 5, 2.5);
    ctx.fillStyle = '#e8c060';
    ctx.fill();
    const shown = Math.min(G.tickets.length, RAIL_MAX);
    for (let i = 0; i < shown; ++i) {
      const t = G.tickets[i];
      if (t.slot === undefined) t.slot = i;
      t.slot += (i - t.slot) * Math.min(1, 0.18);
      const age = t.born !== undefined ? G.animT - t.born : 9;
      const drop = age < 0.35 ? (1 - age / 0.35) : 0;
      const swing = age < 1.2 ? Math.sin(age * 14) * 0.06 * (1 - age / 1.2) : Math.sin(G.animT * 1.3 + i) * 0.006;
      const x = RAIL_X0 + t.slot * (RAIL_W + RAIL_GAP), y = RAIL_Y - drop * drop * 60;
      ctx.save();
      ctx.translate(x + RAIL_W / 2, y);
      ctx.rotate(swing);
      ctx.translate(-(x + RAIL_W / 2), -y);
      const f = Math.max(0, t.customer.patience / t.customer.patienceMax);
      ui.drawPanel(x, y + 2, RAIL_W, RAIL_H, { style: 'paper', radius: 3, accent: G.location.color });
      /* brass clip */
      ui.roundRectPath(x + RAIL_W / 2 - 11, y - 6, 22, 14, 3);
      ctx.fillStyle = '#c8962e';
      ctx.fill();
      ctx.fillStyle = '#fff0b0';
      ctx.fillRect(x + RAIL_W / 2 - 9, y - 4, 18, 3);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText('#' + t.id, x + 6, y + 14, 30, 10, { weight: 'bold', color: ui.UI.inkDim });
      SZ.FoodArt.drawDish(ctx, t.recipe.id, x + RAIL_W / 2, y + 26, 44, 1, 'good');
      /* the guest's patience */
      ui.roundRectPath(x + 10, y + 47, RAIL_W - 20, 6, 3);
      ctx.fillStyle = 'rgba(80,50,20,0.25)';
      ctx.fill();
      if (f > 0) {
        ui.roundRectPath(x + 10, y + 47, (RAIL_W - 20) * f, 6, 3);
        ctx.fillStyle = patienceColor(f);
        ctx.fill();
      }
      /* step icons: done steps ticked, current step highlighted with its key */
      const steps = t.recipe.steps;
      const running = !t.done && ticketInSlot(t);
      const blocked = !t.done && !running && t.waitingFor !== null && G.stations[t.waitingFor].slots.every(s => s.ticket);
      const sx0 = x + RAIL_W / 2 - (steps.length - 1) * 13;
      for (let j = 0; j < steps.length; ++j) {
        const ix = sx0 + j * 26;
        if (j === t.stepIndex) {
          ui.roundRectPath(ix - 12, y + 56, 24, 28, 5);
          ctx.fillStyle = running ? 'rgba(255,190,40,0.35)' : 'rgba(120,90,40,0.15)';
          ctx.fill();
          ctx.strokeStyle = running ? '#d8901a' : 'rgba(120,90,40,0.5)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.save();
        if (j < t.stepIndex) ctx.globalAlpha *= 0.45;
        SZ.FoodArt.drawStepIcon(ctx, steps[j].station, ix, y + 66, 20);
        ctx.restore();
        if (j < t.stepIndex) {
          ctx.strokeStyle = '#2e9a2a';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ix - 6, y + 66);
          ctx.lineTo(ix - 1, y + 71);
          ctx.lineTo(ix + 7, y + 60);
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
        if (j === t.stepIndex) {
          /* runnable at its station: the key number blinks */
          const blink = running && Math.sin(G.animT * 10) > 0;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = ui.uiFont(10, 'bold');
          ctx.fillStyle = blink ? '#c83a1a' : ui.UI.ink;
          ctx.fillText(String(SZ.KitchenData.STATION_ORDER.indexOf(steps[j].station) + 1), ix, y + 79);
        }
      }
      if (blocked) drawRailClock(x + RAIL_W - 14, y + 16);
      ctx.restore();
    }
  }

  /* the little wait clock on a ticket whose station is busy */
  function drawRailClock(cx, cy) {
    ctx.save();
    ctx.fillStyle = '#fff4d8';
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8781a';
    ctx.lineWidth = 2;
    ctx.stroke();
    const a = G.animT * 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#5a3a1e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
    ctx.stroke();
    ctx.restore();
  }

  NS.hud = { drawHUD, drawTicketRail };

})();
