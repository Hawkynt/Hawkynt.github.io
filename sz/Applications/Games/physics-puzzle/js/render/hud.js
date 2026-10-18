;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * The in-level HUD: the tray with its part cards, the launcher readout,
   * Reset and Menu buttons, the level, shot, star and target chips, the
   * Bullet Time meter, the fast-forward chip, selection handles, the first
   * shot hint, the level intro card and the toast. Owns G.toast; reads
   * G.run, G.stats, G.time and the pointer and registers hit areas.
   */

  const G = NS.G;
  const ctx = G.ctx, ui = G.ui, Art = G.Art, Lv = G.Lv, Parts = G.Parts;
  const VIEW_W = NS.C.VIEW_W, VIEW_H = NS.C.VIEW_H, BAR_Y = NS.C.BAR_Y, FAST_RATE = NS.C.FAST_RATE;
  const WORLDS = NS.C.WORLDS, TARGET_COLOR = NS.C.TARGET_COLOR;

  function showToast(text, color) {
    G.toast = { text: text, color: color || '#ffffff', t: 0 };
  }

  function trayCards() {
    const types = Parts.PART_ORDER.filter(t => (G.run.inv[t] || 0) > 0);
    const cw = 104, gap = 10;
    const total = types.length * cw + Math.max(0, types.length - 1) * gap;
    const x0 = Math.max(250, VIEW_W / 2 - total / 2 - 40);
    return types.map((t, i) => ({ type: t, x: x0 + i * (cw + gap), y: BAR_Y + 8, w: cw, h: 64 }));
  }

  function drawHUD() {
    const run = G.run, stats = G.stats, time = G.time;
    const mouseX = G.mouseX, mouseY = G.mouseY;
    const registerHit = G.registerHit;
    const v = G.visibleRect();
    /* the tray */
    const ty = BAR_Y;
    ctx.save();
    const lg = ctx.createLinearGradient(0, ty, 0, VIEW_H);
    lg.addColorStop(0, 'rgba(14,26,36,0.92)');
    lg.addColorStop(1, 'rgba(6,12,18,0.96)');
    ctx.fillStyle = lg;
    ctx.fillRect(v.x0, ty, v.x1 - v.x0, v.y1 - ty);
    ctx.fillStyle = 'rgba(232,196,106,0.55)';
    ctx.fillRect(v.x0, ty, v.x1 - v.x0, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(v.x0, ty + 2, v.x1 - v.x0, 2);
    ctx.restore();
    /* launcher readout */
    ui.drawPanel(14, ty + 10, 220, 60, { radius: 10, noStuds: true, accent: run.theme.color });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText((stats.steady ? run.aimAngle.toFixed(1) : Math.round(run.aimAngle)) + '°', 28, ty + 30, 80, 20, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.fitText('angle', 28, ty + 52, 80, 11, { color: ui.UI.textDim });
    ui.drawMeter(96, ty + 22, 124, 14, run.aimPower, run.aimPower > 0.85 ? '#ff7a3a' : run.aimPower > 0.5 ? '#ffd84a' : '#7ae8ff',
      { label: Math.round(run.aimPower * 100) + '%', labelPx: 10 });
    const extra = run.mode === 'trick' ? 0 : stats.extraBalls;
    ui.fitText(extra ? (extra + 1) + ' balls (M)' : 'power', 96, ty + 52, 124, 11, { color: extra ? '#ffe9a0' : ui.UI.textDim });
    /* part cards */
    const cards = trayCards();
    for (const c of cards) {
      const left = NS.run.partsLeft(c.type);
      const hot = mouseX >= c.x && mouseX <= c.x + c.w && mouseY >= c.y && mouseY <= c.y + c.h;
      registerHit('card-' + c.type, c.x, c.y, c.w, c.h, null);
      ui.drawPanel(c.x, c.y, c.w, c.h, { radius: 10, noStuds: true, glow: hot && left > 0, accent: left > 0 ? '#7ae8ff' : '#5a6070',
        top: hot ? 'rgba(40,90,110,0.96)' : 'rgba(22,48,62,0.94)', bottom: 'rgba(8,18,26,0.96)' });
      ctx.save();
      if (left <= 0)
        ctx.globalAlpha = 0.35;
      const icon = Art.partIcon(c.type, run.world);
      const k = Math.min((c.w - 20) / icon.w, 34 / icon.h, 1.2);
      ctx.drawImage(icon.c, c.x + c.w / 2 - icon.w * k / 2, c.y + 24 - icon.h * k / 2, icon.w * k, icon.h * k);
      ctx.restore();
      ctx.textAlign = 'center';
      ui.fitText(Parts.PARTS[c.type].name, c.x + c.w / 2, c.y + 50, c.w - 30, 12, { weight: 'bold', color: left > 0 ? '#e4f4ff' : ui.UI.textMute });
      if (run.mode !== 'sandbox')
        ui.drawChip('x' + left, c.x + c.w - 6, c.y - 8, 20, { align: 'right', px: 12, color: left > 0 ? '#ffe066' : ui.UI.textMute });
    }
    if (!cards.length) {
      ctx.textAlign = 'center';
      ui.fitText(run.mode === 'trick' && run.level.rule.noParts ? 'No parts allowed - pure skill' : 'No parts here - aim true', VIEW_W / 2 - 40, ty + 40, 400, 15, { color: ui.UI.textDim, weight: 'bold' });
    }
    /* right side buttons */
    drawSmallButton('reset', 'Reset', 'R', 1052, ty + 14, 104, 52, NS.run.restartLevel);
    drawSmallButton('pause', 'Menu', 'Esc', 1164, ty + 14, 104, 52, NS.flow.pauseGame);
    /* top chips: level, shots, stars */
    const name = run.mode === 'sandbox' ? 'Sandbox' : run.level.name;
    ui.drawPanel(14, 12, 330, 46, { radius: 12, noStuds: true, accent: run.theme.color });
    ctx.textAlign = 'left';
    const tag = run.mode === 'campaign' ? WORLDS[run.world].name + ' ' + run.level.id.slice(1).replace('-', '-') : run.mode === 'trick' ? 'Trick Shot' : run.mode === 'daily' ? 'Daily ' + G.localDate() : WORLDS[run.world].name;
    ui.fitText(name, 28, 30, 300, 18, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.fitText(tag, 28, 49, 300, 11, { color: run.theme.accent });
    if (run.mode !== 'sandbox') {
      const pw = 344;
      const px = VIEW_W - 14 - pw;
      ui.drawPanel(px, 12, pw, 46, { radius: 12, noStuds: true, accent: run.theme.color });
      const shots = run.att.shots;
      ctx.textAlign = 'left';
      ui.fitText('Shots ' + shots + (run.level.par < 99 ? ' / par ' + run.level.par : ''), px + 14, 35, 130, 15, { weight: 'bold', color: shots > run.level.par ? '#ffb0a0' : '#ffffff' });
      const total = run.att.stars.length;
      const got = run.att.stars.filter(s => s.got).length;
      for (let i = 0; i < total; ++i) {
        const s = Art.starSprite();
        ctx.save();
        ctx.globalAlpha = i < got ? 1 : 0.25;
        ctx.drawImage(s.c, px + 154 + i * 28, 20, 28, 28);
        ctx.restore();
      }
      const lit = run.att.targets.filter(t => t.lit).length;
      const ts = Art.targetSprite(TARGET_COLOR, lit === run.att.targets.length);
      ctx.drawImage(ts.c, px + 252, 21, 26, 26);
      ctx.textAlign = 'right';
      ui.fitText(lit + '/' + run.att.targets.length, px + pw - 14, 35, 44, 15, { weight: 'bold', color: lit ? '#ffe066' : ui.UI.textDim });
    }
    if (run.mode === 'trick') {
      ctx.textAlign = 'center';
      ui.drawChip(run.level.trick.desc, VIEW_W / 2, 18, 30, { align: 'center', px: 14, color: '#ffe9a0' });
    }
    /* bullet time meter */
    if (stats.bulletTime && run.phase === 'flight') {
      ui.drawMeter(VIEW_W / 2 - 100, 60, 200, 10, run.bulletLeft / stats.bulletTime, '#8affd0', {});
      ctx.textAlign = 'center';
      ui.fitText('Hold Space: slow motion', VIEW_W / 2, 80, 220, 11, { color: '#bfffe8', outline: 'rgba(0,0,0,0.6)' });
    }
    /* fast-forward while a shot rolls out; aiming fires the next one right away */
    if (run.phase === 'flight' && run.fastForward) {
      ctx.textAlign = 'center';
      ui.drawChip('\u25B6\u25B6 ' + FAST_RATE + 'x  -  aim to fire again', VIEW_W / 2, 104, 30, { align: 'center', px: 14, color: '#bfe8ff' });
    }
    /* handles of the selected part */
    for (const h of NS.build.selectionHandles()) {
      registerHit(h.id, h.x - h.r, h.y - h.r, h.r * 2, h.r * 2, h.action);
      const hot = (mouseX - h.x) * (mouseX - h.x) + (mouseY - h.y) * (mouseY - h.y) < h.r * h.r;
      ui.drawPanel(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2, { radius: h.r, noStuds: true, glow: hot, accent: h.id === 'del' ? '#ff6a6a' : '#7ae8ff' });
      drawGlyph(h.id, h.x, h.y, h.r * 0.55, h.id === 'del' ? '#ffb0b0' : '#d8f6ff');
    }
    if (run.phase === 'aim' && run.att.shots === 0 && !run.drag && time % 1 < 0.95 && !run.aiming && run.mode !== 'sandbox') {
      const L = run.level.launcher;
      const k = (time * 0.8) % 1;
      ctx.save();
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85;
      drawGlyph('hand', L[0] + 80 - k * 60, L[1] - 70 + k * 40, 16, '#ffffff');
      ctx.restore();
      ctx.textAlign = 'left';
      ui.fitText('Drag anywhere to pull back - release to fire', L[0] + 40, L[1] - 120, 380, 13, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.75)' });
    }
    if (run.drag && run.drag.reason && run.drag.moved) {
      ctx.textAlign = 'center';
      ui.drawChip(run.drag.reason, run.drag.x, Math.max(20, run.drag.y - 70), 26, { align: 'center', px: 12, color: '#ffb0a0' });
    }
    if (run.phase === 'intro')
      drawIntroCard();
    if (G.toast)
      drawToast();
  }

  function drawSmallButton(id, label, key, x, y, w, h, action) {
    const idx = G.registerHit(id, x, y, w, h, action);
    const hot = G.isHot(idx, x, y, w, h);
    ui.drawButtonFrame(x, y, w, h, hot, G.run ? G.run.theme.color : ui.UI.accent, G.time);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, x + w / 2, y + h / 2 - 5, w - 20, 16, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.fitText(key, x + w / 2, y + h / 2 + 13, w - 20, 10, { color: ui.UI.textDim });
  }

  /* small vector glyphs for handles and hints */
  function drawGlyph(name, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.28);
    ctx.lineCap = 'round';
    if (name === 'rotL' || name === 'rotR') {
      const d = name === 'rotR' ? 1 : -1;
      ctx.scale(d, 1);
      ctx.beginPath();
      ctx.arc(0, 0, s, Math.PI * 0.9, Math.PI * 2.25);
      ctx.stroke();
      const ax = Math.cos(Math.PI * 2.25) * s, ay = Math.sin(Math.PI * 2.25) * s;
      ctx.beginPath();
      ctx.moveTo(ax + s * 0.5, ay - s * 0.1);
      ctx.lineTo(ax, ay + s * 0.05);
      ctx.lineTo(ax + s * 0.1, ay - s * 0.55);
      ctx.stroke();
    } else if (name === 'del') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.7);
      ctx.lineTo(s * 0.7, s * 0.7);
      ctx.moveTo(s * 0.7, -s * 0.7);
      ctx.lineTo(-s * 0.7, s * 0.7);
      ctx.stroke();
    } else if (name === 'hand') {
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.globalAlpha *= 0.4;
      ctx.fill();
      ctx.globalAlpha /= 0.4;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawIntroCard() {
    const run = G.run;
    const k = run.introT;
    const a = k < 0.25 ? k / 0.25 : k > 1.9 ? Math.max(0, (2.2 - k) / 0.3) : 1;
    const slide = k < 0.25 ? (1 - k / 0.25) * 40 : 0;
    ctx.save();
    ctx.globalAlpha = a;
    const w = 640, h = 170, x = VIEW_W / 2 - w / 2, y = 200 - slide;
    ui.drawPanel(x, y, w, h, { accent: run.theme.color, glow: true });
    const label = run.mode === 'campaign' ? WORLDS[run.world].name + '  -  Level ' + (Lv.worldLevels(run.world).indexOf(run.level) + 1) :
      run.mode === 'trick' ? 'Trick Shot' : run.mode === 'daily' ? 'Daily Challenge  ' + G.localDate() : 'Sandbox';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, VIEW_W / 2, y + 28, w - 40, 14, { weight: 'bold', color: run.theme.accent });
    ui.drawHeadline(run.level.name, VIEW_W / 2, y + 70, w - 60, 44, '#ffffff', run.theme.color);
    ui.drawTextBlock(run.level.tip || '', x + 40, y + 102, w - 80, 40, 15, { align: 'center', color: '#d8e4f0' });
    if (run.mode !== 'sandbox')
      ui.fitText('Par ' + run.level.par + (run.level.stars.length ? '   •   ' + run.level.stars.length + ' stars to grab' : '') + '   •   click to start',
        VIEW_W / 2, y + h - 18, w - 40, 12, { color: ui.UI.textDim });
    ctx.restore();
  }

  function drawToast() {
    const toast = G.toast;
    toast.t += G.frameDt;
    if (toast.t > 2.4) {
      G.toast = null;
      return;
    }
    const k = toast.t;
    const a = k < 0.2 ? k / 0.2 : k > 2 ? (2.4 - k) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = ui.uiFont(18, 'bold');
    const w = Math.min(700, ctx.measureText(toast.text).width + 60);
    const y = G.state === 'play' ? 584 : 650;
    ui.drawPanel(VIEW_W / 2 - w / 2, y, w, 40, { radius: 18, noStuds: true, accent: toast.color, glow: true });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(toast.text, VIEW_W / 2, y + 21, w - 30, 17, { weight: 'bold', color: toast.color });
    ctx.restore();
  }

  G.showToast = showToast;
  G.drawHUD = drawHUD;

  NS.hud = { showToast: showToast, trayCards: trayCards, drawHUD: drawHUD, drawToast: drawToast };
})();
