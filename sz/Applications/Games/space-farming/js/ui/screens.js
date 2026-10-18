/* Space Farming - building inspector, pause screen and title screen.
   Owns: G.inspect
   Reads: G.uiS, G.UW, G.UH, G.credits, G.buildings, G.savedGameAvailable, G.saveNotice, G.uiTime */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, CROPS, BUILDINGS, BUILDING_MAX_LEVEL, ctx, drawSprite, fitText, UI, drawPanel, drawChip,
    drawHeadline, drawScrim, addRegion, drawButton, continueSavedGame, requestNewGame,
    getBuildingUpgradeCost, canUpgradeBuilding, upgradeBuilding, resetGame, gridToScreen, removeBuilding,
    dockHeight, openHelp, buildingStatLines, togglePause } = NS;

  function drawInspector() {
    const bld = G.buildings[G.inspect.row]?.[G.inspect.col];
    if (!bld) {
      G.inspect = null;
      return;
    }
    const bdef = BUILDINGS[bld.typeIndex];
    const lvl = bld.level || 1;
    const stats = buildingStatLines(bld, G.inspect.row, G.inspect.col);
    const w = 270;
    const h = 52 + 16 + stats.length * 20 + 50;
    const g = gridToScreen(G.inspect.col, G.inspect.row);
    let x = (g.x + g.size) / G.uiS + 12, y = g.y / G.uiS - 10;
    if (x + w > G.UW - 10) x = g.x / G.uiS - w - 12;
    x = Math.max(10, Math.min(G.UW - w - 10, x));
    y = Math.max(84, Math.min(G.UH - dockHeight() - 30 - h, y));
    addRegion({ id: 'insp-panel', x, y, w, h });
    const top = drawPanel(x, y, w, h, { title: bdef.name, icon: bdef.sprite, accent: '#4cc4ff', headerH: 40, titlePx: 16, titleRight: `Lv ${lvl}/${BUILDING_MAX_LEVEL}`, titleRightColor: UI.gold, closeId: 'insp-close', onClose: () => { G.inspect = null; } });
    // Level pips
    const pw = 16;
    for (let i = 0; i < BUILDING_MAX_LEVEL; ++i) {
      ctx.fillStyle = i < lvl ? '#4cc4ff' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 14 + i * (pw + 3), top, pw, 5);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    stats.forEach((s, i) => fitText(s, x + 14, top + 22 + i * 20, w - 28, 12, { color: i === 0 ? UI.textDim : UI.text }));
    const by = y + h - 42;
    if (canUpgradeBuilding(bld)) {
      const cost = getBuildingUpgradeCost(bld);
      drawButton({ id: 'insp-upgrade', x: x + 12, y: by, w: w - 24 - 96, h: 30 }, { label: `Upgrade · ${cost} [[coin]]`, primary: G.credits >= cost, color: '#4cc4ff', px: 12, disabled: G.credits < cost, onClick: () => upgradeBuilding(G.inspect.row, G.inspect.col), onDisabled: () => SZ.GameAudio.play('error'), tip: () => [`Upgrade to level ${lvl + 1}`, G.credits >= cost ? `✔ Costs ${cost} credits` : `✘ Needs ${cost} credits`, 'Shortcut: right-click the building'] });
    } else
      drawChip('Max level', x + 12, by + 5, 20, { px: 11, bg: 'rgba(111,224,138,0.18)', border: 'rgba(111,224,138,0.6)', color: UI.good });
    drawButton({ id: 'insp-remove', x: x + w - 12 - 88, y: by, w: 88, h: 30 }, { label: 'Remove', px: 12, color: UI.bad, onClick: () => { removeBuilding(G.inspect.row, G.inspect.col); G.inspect = null; }, tip: () => ['Remove building', '⚠ No refund.', 'Shortcut: Shift+right-click'] });
  }

  /* ── Pause and title screens ── */

  function drawPauseScreen() {
    drawScrim(0.55);
    addRegion({ id: 'pause-scrim', x: 0, y: 0, w: G.UW, h: G.UH, modal: true });
    const w = 340, h = 250;
    const x = G.UW / 2 - w / 2, y = G.UH / 2 - h / 2;
    drawPanel(x, y, w, h, { accent: UI.gold, radius: 14 });
    drawHeadline('Paused', G.UW / 2, y + 44, w - 40, 36, UI.gold, '#ff9a3a');
    const bw = w - 60;
    drawButton({ id: 'pause-resume', x: x + 30, y: y + 84, w: bw, h: 40 }, { label: 'Resume', key: 'Esc', primary: true, color: UI.leaf, px: 15, onClick: togglePause });
    drawButton({ id: 'pause-help', x: x + 30, y: y + 134, w: bw, h: 36 }, { label: 'How to play', icon: 'book', key: 'H', px: 14, onClick: () => openHelp(0) });
    drawButton({ id: 'pause-new', x: x + 30, y: y + 180, w: bw, h: 36 }, { label: 'New farm', icon: 'seedbag', key: 'F2', px: 14, onClick: requestNewGame });
  }

  const titleStars = [];
  for (let i = 0; i < 160; ++i)
    titleStars.push({ x: Math.random(), y: Math.random(), s: Math.random(), p: Math.random() * TWO_PI });

  function drawTitleBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, G.UH);
    g.addColorStop(0, '#070a1c');
    g.addColorStop(0.6, '#1a1640');
    g.addColorStop(1, '#3a2050');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.UW, G.UH);
    for (const s of titleStars) {
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(G.uiTime * (0.5 + s.s) + s.p));
      ctx.fillStyle = s.s > 0.85 ? '#ffe8b0' : '#cfe0ff';
      const sz = s.s > 0.9 ? 2 : 1;
      ctx.fillRect(s.x * G.UW, s.y * G.UH * 0.8, sz, sz);
    }
    ctx.globalAlpha = 1;
    // Ringed planet
    const px = G.UW * 0.84, py = G.UH * 0.17, pr = Math.min(G.UW, G.UH) * 0.11;
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, '#ffd7a0');
    pg.addColorStop(0.6, '#d0705a');
    pg.addColorStop(1, '#4a2040');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TWO_PI);
    ctx.fill();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.35);
    ctx.scale(1, 0.28);
    ctx.lineWidth = pr * 0.25;
    ctx.strokeStyle = 'rgba(255,220,170,0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, pr * 1.6, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
    // Rolling hills
    const hills = [['#1d3a3a', 0.72, 30, 0.004], ['#16302a', 0.8, 22, 0.006], ['#0f2420', 0.88, 16, 0.009]];
    for (const [col, base, amp, f] of hills) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, G.UH);
      for (let x = 0; x <= G.UW; x += 8)
        ctx.lineTo(x, G.UH * base + Math.sin(x * f + G.uiTime * 0.1) * amp + Math.sin(x * f * 2.7) * amp * 0.4);
      ctx.lineTo(G.UW, G.UH);
      ctx.closePath();
      ctx.fill();
    }
    // Crops on the front hill
    for (let i = 0; i < 18; ++i) {
      const cx = (i + 0.5) * G.UW / 18;
      const cy = G.UH * 0.9 + Math.sin(cx * 0.009) * 16 - 6;
      const crop = CROPS[i % CROPS.length];
      drawSprite(crop.sprite, cx, cy + Math.sin(G.uiTime * 1.5 + i) * 1.5, 34);
    }
  }

  function drawTitleScreen() {
    drawTitleBackground();
    addRegion({ id: 'title-bg', x: 0, y: 0, w: G.UW, h: G.UH, modal: true, onClick: G.savedGameAvailable ? null : resetGame });
    const cx = G.UW / 2;
    drawHeadline('SPACE FARMING', cx, G.UH * 0.24, G.UW - 60, 64, '#9df08a', '#2a9a5a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText('Grow alien crops, raise space critters and build the finest farm in the galaxy.', cx, G.UH * 0.24 + 52, G.UW - 80, 16, { color: '#c8d6f0' });
    const bw = 260, bh = 46;
    let y = G.UH * 0.42;
    if (G.savedGameAvailable) {
      drawButton({ id: 'title-continue', x: cx - bw / 2, y, w: bw, h: bh }, { label: 'Continue', icon: 'seedbag', key: 'Enter', primary: true, color: UI.leaf, px: 17, onClick: continueSavedGame });
      y += bh + 12;
    }
    drawButton({ id: 'title-new', x: cx - bw / 2, y, w: bw, h: bh }, { label: G.savedGameAvailable ? 'New farm' : 'Start farming', icon: 'hammer', key: 'F2', primary: !G.savedGameAvailable, color: UI.leaf, px: 17, onClick: requestNewGame });
    y += bh + 12;
    drawButton({ id: 'title-help', x: cx - bw / 2, y, w: bw, h: 40 }, { label: 'How to play', icon: 'book', key: 'H', px: 15, onClick: () => openHelp(0) });
    y += 52;
    if (G.saveNotice)
      drawChip(G.saveNotice, cx, y + 4, 24, { align: 'center', px: 12, weight: '', bg: 'rgba(80,20,10,0.75)', border: 'rgba(255,140,90,0.6)', color: '#ffb48a', maxW: G.UW - 40 });
  }

  Object.assign(NS, { drawInspector, drawPauseScreen, drawTitleScreen });

})();
