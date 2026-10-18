;(function() {
  'use strict';

  /* Drawing the kitchen line: the pass and the bin, station art with
     halos, jitter and presses, gauges, keys, labels and burn alerts.
     Reads G only (plus emitting the pass sparkle). */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { PASS_Y, STATION_Y, STATION_W, STATION_H, BAR_Y, BAR_H, TRASH, RAIL_Y, RAIL_H,
    STATION_ART } = NS.C;
  const { ctx, ui } = NS.view;
  const { fx } = NS.juice;
  const { stationX, stationCX, passX, zoneFor, burnAt } = NS.rules;
  const { serveTarget } = NS.serving;
  const { shadowSprite, trashSprite } = NS.sprites;

  function drawTrash() {
    const hot = G.mouseX >= TRASH.x - 30 && G.mouseX <= TRASH.x + 30 && G.mouseY >= TRASH.y - 36 && G.mouseY <= TRASH.y + 30;
    const wob = G.trashWobble > 0 ? Math.sin(G.trashWobble * 40) * G.trashWobble * 0.3 : 0;
    ctx.save();
    ctx.translate(TRASH.x, TRASH.y + 22);
    ctx.rotate(wob);
    if (hot && G.pass.some(d => d.quality === 'ruined')) SZ.FoodArt.drawHalo(ctx, 0, -26, 110, 90, 'red', 0.5);
    ctx.drawImage(trashSprite(), -28, -63, 56, 63);
    ctx.restore();
  }

  function drawPass() {
    const sh = shadowSprite();
    for (let i = 0; i < G.pass.length; ++i) {
      const d = G.pass[i];
      const px = passX(i);
      const hot = Math.abs(G.mouseX - px) <= 40 && Math.abs(G.mouseY - PASS_Y) <= 40;
      ctx.drawImage(sh, px - 44, PASS_Y + 14, 88, 24);
      if (hot) SZ.FoodArt.drawHalo(ctx, px, PASS_Y, 130, 110, d.quality === 'ruined' ? 'red' : 'gold', 0.55);
      /* squash-pop as an arced dish settles on the pass */
      const bounce = d.bounce > 0 ? 1 + 0.22 * Math.sin((d.bounce / 0.3) * Math.PI) : 1;
      const lift = hot ? -4 : 0;
      ctx.save();
      ctx.translate(px, PASS_Y + 24 + lift);
      ctx.scale(2 - bounce, bounce);
      ctx.translate(-px, -(PASS_Y + 24));
      SZ.FoodArt.drawDish(ctx, d.recipe, px, PASS_Y, 88, 1, d.quality);
      ctx.restore();
      /* a serveable dish sparkles now and then */
      if (d.quality !== 'ruined' && serveTarget(d) && Math.sin(G.animT * 3 + i * 2) > 0.97)
        fx.emit('star', px + (Math.random() - 0.5) * 50, PASS_Y - 10, 1, { color: '#fff6c0', speed: 20, gravity: -10 });
    }
    drawTrash();
  }

  /* The progress gauge on the station's instrument plate: dark track, the
     cooked part filling amber, a glowing green zone, a hazard-red burn field
     and a bright needle. */
  function drawSlotBar(x, w, slot) {
    const t = slot.ticket;
    const step = t && !t.done ? t.recipe.steps[t.stepIndex] : null;
    if (!step) return;
    const burn = burnAt();
    const scale = w / burn;
    const zone = zoneFor(step);
    const y = BAR_Y, h = BAR_H;
    ui.roundRectPath(x, y, w, h, h / 2);
    ctx.fillStyle = '#0a0604';
    ctx.fill();
    ctx.save();
    ui.roundRectPath(x, y, w, h, h / 2);
    ctx.clip();
    const nx = x + Math.min(slot.progress, burn) * scale;
    ctx.fillStyle = slot.state === 'burning' ? '#a8401a' : '#c88a2a';
    ctx.fillRect(x, y, nx - x, h);
    ctx.fillStyle = 'rgba(255,230,160,0.35)';
    ctx.fillRect(x, y + 2, nx - x, 3);
    const live = slot.state === 'ready';
    const zg = live ? 0.75 + 0.25 * Math.sin(G.animT * 12) : 0.6;
    ctx.fillStyle = 'rgba(80,230,100,' + zg.toFixed(3) + ')';
    ctx.fillRect(x + zone[0] * scale, y, (zone[1] - zone[0]) * scale, h);
    ctx.fillStyle = 'rgba(220,255,220,0.5)';
    ctx.fillRect(x + zone[0] * scale, y + 2, (zone[1] - zone[0]) * scale, 3);
    ctx.fillStyle = '#c8281e';
    ctx.fillRect(x + scale, y, (burn - 1) * scale, h);
    ctx.fillStyle = 'rgba(30,0,0,0.45)';
    for (let sx = x + scale - h; sx < x + w; sx += 8) {
      ctx.beginPath();
      ctx.moveTo(sx, y + h);
      ctx.lineTo(sx + 4, y + h);
      ctx.lineTo(sx + 4 + h, y);
      ctx.lineTo(sx + h, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ui.roundRectPath(x, y, w, h, h / 2);
    ctx.strokeStyle = 'rgba(255,220,150,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (live) SZ.FoodArt.drawHalo(ctx, nx, y + h / 2, 60, 44, 'green', 0.8);
    else if (slot.state === 'burning') SZ.FoodArt.drawHalo(ctx, nx, y + h / 2, 60, 44, 'red', 0.7);
    ctx.fillStyle = '#2a1408';
    ui.roundRectPath(nx - 3.5, y - 5, 7, h + 10, 3);
    ctx.fill();
    ctx.fillStyle = slot.state === 'burning' ? '#ff7a5a' : live ? '#b8ffb0' : '#ffffff';
    ui.roundRectPath(nx - 2, y - 4, 4, h + 8, 2);
    ctx.fill();
  }

  function drawIdleTrack(x, w) {
    ui.roundRectPath(x, BAR_Y, w, BAR_H, BAR_H / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,150,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* The station's key number; it bounces and glows green while a step
     sits in its perfect zone. */
  function drawStationKey(i, x, ready) {
    const kx = x + 4, ky = BAR_Y - 22;
    if (!ready) {
      ui.drawKeycap(String(i + 1), kx, ky, 12);
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(G.animT * 12);
    const s = 1 + 0.25 * pulse;
    SZ.FoodArt.drawHalo(ctx, kx + 9, ky + 9, 56, 56, 'green', 0.6 + 0.4 * pulse);
    ctx.save();
    ctx.translate(kx + 9, ky + 9);
    ctx.scale(s, s);
    ctx.translate(-(kx + 9), -(ky + 9));
    ui.drawKeycap(String(i + 1), kx, ky, 12);
    ctx.restore();
  }

  /* a red '!' bubble bobbing over a station that started to burn */
  function drawBurnBubble(cx, y) {
    const by = y + Math.sin(G.animT * 8) * 3;
    const r = 15 + (Math.sin(G.animT * 10) > 0 ? 2 : 0);
    SZ.FoodArt.drawHalo(ctx, cx, by, 90, 90, 'red', 0.8);
    ctx.save();
    ctx.fillStyle = '#e03a2e';
    ctx.beginPath();
    ctx.arc(cx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 6, by + r - 3);
    ctx.lineTo(cx + 6, by + r - 3);
    ctx.lineTo(cx, by + r + 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, by, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = ui.uiFont(22, '900');
    ctx.fillStyle = '#fff';
    ctx.fillText('!', cx, by + 1);
    ctx.restore();
  }

  /* Burn alerts are drawn after the ticket rail, just under its cards, so
     no card hides them. */
  function drawBurnAlerts() {
    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i) {
      const id = SZ.KitchenData.STATION_ORDER[i];
      if (G.stations[id].slots.some(s => s.ticket && !s.ticket.done && s.state === 'burning'))
        drawBurnBubble(stationCX(id), RAIL_Y + RAIL_H + 14);
    }
  }

  function drawStationBar(i, id, slot, ready) {
    const x = stationX(i);
    const t = slot.ticket;
    const step = t && !t.done ? t.recipe.steps[t.stepIndex] : null;
    drawStationKey(i, x, ready);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(step ? step.label : SZ.KitchenData.STATIONS[id].name, x + 28, BAR_Y - 13, STATION_W - 30, 13,
      { weight: 'bold', color: step ? '#ffe6b0' : 'rgba(255,230,190,0.55)' });
    drawSlotBar(x, STATION_W, slot);
  }

  function stationArtState(slot) {
    return slot.ticket ? (slot.ticket.done ? 'ready' : slot.state) : 'idle';
  }

  function slotProgress(slot) {
    return slot.ticket ? (slot.ticket.done ? 1 : slot.progress) : 0;
  }

  /* station art, halos and per-frame life (bars come later, above the chef) */
  function drawStations() {
    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i) {
      const id = SZ.KitchenData.STATION_ORDER[i];
      const slots = G.stations[id].slots;
      const x = stationX(i);
      let anyReady = false, anyBurning = false;
      for (const s of slots) {
        if (!s.ticket || s.ticket.done) continue;
        if (s.state === 'ready') anyReady = true;
        else if (s.state === 'burning') anyBurning = true;
      }
      const hot = G.mouseX >= x && G.mouseX <= x + STATION_W && G.mouseY >= STATION_Y && G.mouseY <= STATION_Y + STATION_H &&
        slots.some(s => s.ticket && !s.ticket.done);
      if (anyReady) SZ.FoodArt.drawHalo(ctx, x + STATION_W / 2, STATION_Y + 70, 260, 170, 'green', 0.55 + 0.3 * Math.sin(G.animT * 9));
      if (anyBurning) SZ.FoodArt.drawHalo(ctx, x + STATION_W / 2, STATION_Y + 70, 260, 170, 'red', 0.45 + 0.35 * (Math.sin(G.animT * 14) > 0 ? 1 : 0));
      if (hot) SZ.FoodArt.drawHalo(ctx, x + STATION_W / 2, STATION_Y + 70, 230, 150, 'gold', 0.35);
      /* a burning station sizzles: its art jitters a pixel or two */
      const jx = anyBurning ? Math.sin(G.animT * 47 + i * 2.1) * 1.5 : 0;
      const jy = anyBurning ? Math.cos(G.animT * 39 + i * 1.7) * 1.2 : 0;
      /* a station that just took a click squashes down for a beat */
      const press = G.stationPress[i] > 0 ? Math.sin(G.stationPress[i] / 0.18 * Math.PI) * 0.05 : 0;
      ctx.save();
      ctx.translate(x + STATION_W / 2 + jx, STATION_Y + 100 + jy);
      ctx.scale((1 + press) * STATION_ART, (1 - press) * STATION_ART);
      ctx.translate(-(x + STATION_W / 2), -(STATION_Y + 100));
      if (slots.length === 1) {
        const st = stationArtState(slots[0]);
        SZ.FoodArt.drawStation(ctx, id, x, STATION_Y, st, G.animT, slots[0].ticket ? slots[0].ticket.recipe.id : null, slotProgress(slots[0]));
        SZ.FoodArt.drawStationFx(ctx, id, x, STATION_Y, st, G.animT + i, slotProgress(slots[0]));
      } else {
        /* Upgraded station: the art twice side by side at 70% scale */
        for (let j = 0; j < slots.length; ++j) {
          const slot = slots[j];
          const st = stationArtState(slot);
          ctx.save();
          ctx.translate(x - 4 + j * 82, STATION_Y + 36);
          ctx.scale(0.7, 0.7);
          SZ.FoodArt.drawStation(ctx, id, 0, 0, st, G.animT + j * 0.3, slot.ticket ? slot.ticket.recipe.id : null, slotProgress(slot));
          SZ.FoodArt.drawStationFx(ctx, id, 0, 0, st, G.animT + i + j, slotProgress(slot));
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  /* keys, step labels and gauges on the instrument plates */
  function drawStationBars() {
    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i) {
      const id = SZ.KitchenData.STATION_ORDER[i];
      const slots = G.stations[id].slots;
      const x = stationX(i);
      const anyReady = slots.some(s => s.ticket && !s.ticket.done && s.state === 'ready');
      if (slots.length === 1) {
        if (!slots[0].ticket || slots[0].ticket.done) drawIdleTrack(x, STATION_W);
        drawStationBar(i, id, slots[0], anyReady);
      }
      else {
        for (let j = 0; j < slots.length; ++j) {
          if (!slots[j].ticket || slots[j].ticket.done) drawIdleTrack(x + j * 77, (STATION_W - 4) / 2);
          drawSlotBar(x + j * 77, (STATION_W - 4) / 2, slots[j]);
        }
        drawStationKey(i, x, anyReady);
        const run = slots.find(s => s.ticket && !s.ticket.done);
        const step0 = run ? run.ticket.recipe.steps[run.ticket.stepIndex] : null;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ui.fitText(step0 ? step0.label : SZ.KitchenData.STATIONS[id].name, x + 28, BAR_Y - 13, STATION_W - 30, 13,
          { weight: 'bold', color: step0 ? '#ffe6b0' : 'rgba(255,230,190,0.55)' });
      }
    }
  }

  NS.kitchenView = { drawPass, drawBurnAlerts, drawStations, drawStationBars };

})();
