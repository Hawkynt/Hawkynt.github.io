/* Space Farming - composes one frame: world, HUD, dialogs, screens and tooltips, the cursor
   preview, and the status bar.
   Reads: G.uiS, G.UW, G.UH, G.state, G.credits, G.selectedCropIndex, G.selectedTool, G.dayCount, G.farmGrid,
     G.tileTypes, G.buildings, G.selectedBuildingIndex, G.currentSeason, G.dayPhase, G.viewZoom, G.isPanning,
     G.isDragging, G.spriteScale, G.uiRegions, G.frameRegions, G.uiTime, G.screenFade, G.hudFrame, G.dialog,
     G.dialogT, G.inspect, G.pointerX, G.pointerY, G.pointerUX, G.pointerUY, G.pointerInside */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TILE_ROCK, TILE_WATER, STATE_READY, STATE_PLAYING, STATE_PAUSED, CROPS, TOOL_HOE, BUILDINGS,
    TOOL_BUILD, SEASONS, ctx, statusCredits, statusTool, statusWeather, statusDay, screenShake, drawSprite,
    UI, hexToRgba, roundRectPath, drawChip, hitRegion, getSeedCost, getBuildingCost, isAdjacentToWater,
    gridToScreen, ROCK_CLEAR_COST, drawExpandChip, drawWorldScene, drawWeatherOverlay, drawDragSelection,
    uiParticles, drawFlyers, drawTreeDialog, drawQuickPanel, drawGoalPanel, drawMarketDialog, hudLayout,
    drawFarmPanel, drawStoragePanel, weatherInfo, drawClockPanel, drawDock, drawSoilLegend, drawZoomChip,
    drawBanner, drawPops, drawToasts, drawLivestockDialog, drawHelpDialog, drawInspector, drawPauseScreen,
    drawTitleScreen, drawTooltip, kbCursor, canvasToGrid, isInsideGrid } = NS;

  function drawHUD() {
    const L = hudLayout();
    drawPops();
    drawExpandChip();
    drawFarmPanel(L);
    drawStoragePanel(L);
    drawClockPanel(L);
    drawQuickPanel();
    drawGoalPanel(L);
    drawDock(L);
    drawZoomChip(L);
    drawSoilLegend(L);
    drawBanner(L);
    drawToasts(L);
    if (G.inspect)
      drawInspector();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusCredits) statusCredits.textContent = `Credits: ${G.credits}`;
    if (statusTool) {
      if (G.selectedTool === TOOL_BUILD && G.selectedBuildingIndex >= 0)
        statusTool.textContent = `Tool: Build (${BUILDINGS[G.selectedBuildingIndex].name})`;
      else if (G.selectedTool === TOOL_HOE)
        statusTool.textContent = 'Tool: Hoe';
      else
        statusTool.textContent = `Tool: Plant (${CROPS[G.selectedCropIndex].name})`;
    }
    if (statusWeather) statusWeather.textContent = `Weather: ${weatherInfo().name}`;
    if (statusDay) statusDay.textContent = `Day: ${G.dayCount} | ${SEASONS[G.currentSeason]} | ${G.dayPhase < 0.5 ? 'Day' : 'Night'}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW FRAME
     ══════════════════════════════════════════════════════════════════ */

  function drawWorld() {
    drawWorldScene();
    drawCursorPreview();
    drawDragSelection();
    drawWeatherOverlay();
  }

  function drawFrame() {
    G.frameRegions = [];
    ++G.hudFrame;
    const playing = G.state === STATE_PLAYING || G.state === STATE_PAUSED;
    // the tech tree covers the whole screen once it is open
    const covered = G.dialog === 'tree' && G.dialogT >= 1;
    ctx.save();
    screenShake.apply(ctx);
    if (playing && !covered)
      drawWorld();
    screenShake.restore(ctx);
    ctx.restore();

    ctx.save();
    ctx.scale(G.uiS, G.uiS);
    G.spriteScale = G.uiS * (window.devicePixelRatio || 1);
    if (G.state === STATE_READY)
      drawTitleScreen();
    else if (playing && !covered) {
      drawHUD();
      if (G.dialog === 'livestock')
        drawLivestockDialog();
      else if (G.dialog === 'market')
        drawMarketDialog();
      if (G.state === STATE_PAUSED && G.dialog !== 'help')
        drawPauseScreen();
    }
    if (G.dialog === 'tree')
      drawTreeDialog();
    if (playing) {
      drawFlyers();
      uiParticles.draw(ctx);
    }
    if (G.dialog === 'help')
      drawHelpDialog();
    drawTooltip();
    if (G.screenFade > 0) {
      ctx.fillStyle = `rgba(3,5,12,${G.screenFade})`;
      ctx.fillRect(0, 0, G.UW, G.UH);
    }
    ctx.restore();
    G.uiRegions = G.frameRegions;
  }

  /* Ghost of the selected crop or building on the tile under the pointer */
  /* What the selected tool would do on a tile: { ok, ghost, blocked, hint } */
  function toolPreview(row, col) {
    const tt = G.tileTypes[row][col];
    const bld = G.buildings[row][col];
    const cell = G.farmGrid[row][col];
    if (G.selectedTool === TOOL_BUILD && G.selectedBuildingIndex >= 0) {
      const b = BUILDINGS[G.selectedBuildingIndex];
      if (tt === TILE_WATER) return { ok: false, blocked: true, hint: 'Water: nothing can be built here' };
      if (bld) return { ok: true, ghost: null, hint: null };
      return { ok: G.credits >= getBuildingCost(b), ghost: b.sprite, range: b.range, hint: G.credits >= getBuildingCost(b) ? null : `Need ${getBuildingCost(b)} cr` };
    }
    if (G.selectedTool === TOOL_HOE) {
      if (tt === TILE_ROCK)
        return bld ? { ok: false, blocked: true, hint: 'A building stands on this rock' }
          : { ok: G.credits >= ROCK_CLEAR_COST, pick: true, hint: G.credits >= ROCK_CLEAR_COST ? `Clear rock: ${ROCK_CLEAR_COST} cr` : `Clearing needs ${ROCK_CLEAR_COST} cr` };
      if (tt === TILE_WATER) return { ok: true, hint: null };
      if (bld) return { ok: false, blocked: true, hint: null };
      return isAdjacentToWater(row, col) ? { ok: true, hint: null } : { ok: false, hint: 'Too far from water to enrich' };
    }
    if (bld) return { ok: true, hint: null };
    if (tt === TILE_WATER) return { ok: false, blocked: true, hint: 'Water: crops can\'t grow here' };
    if (tt === TILE_ROCK) return { ok: false, blocked: true, hint: `Rock: clear it with the hoe (T) for ${ROCK_CLEAR_COST} cr` };
    if (cell) return { ok: cell.growthStage >= CROPS[cell.cropIndex].stages - 1, ripe: true, hint: null };
    const cost = getSeedCost(CROPS[G.selectedCropIndex]);
    return { ok: G.credits >= cost, ghost: CROPS[G.selectedCropIndex].sprite, hint: G.credits >= cost ? null : `Need ${cost} cr` };
  }

  /* Ghost of the selected crop or building on the tile under the pointer */
  function drawCursorPreview() {
    if (G.state !== STATE_PLAYING || G.dialog || G.isDragging || G.isPanning) return;
    let col, row;
    if (kbCursor.active) {
      col = kbCursor.col;
      row = kbCursor.row;
    } else {
      if (!G.pointerInside || hitRegion(G.pointerUX, G.pointerUY)) return;
      ({ col, row } = canvasToGrid(G.pointerX, G.pointerY));
    }
    if (!isInsideGrid(col, row)) return;
    const g = gridToScreen(col, row);
    const pv = toolPreview(row, col);
    if (pv.range > 0) {
      const r0 = gridToScreen(col - pv.range, row - pv.range);
      ctx.fillStyle = 'rgba(90,184,255,0.10)';
      ctx.fillRect(r0.x, r0.y, g.size * (pv.range * 2 + 1), g.size * (pv.range * 2 + 1));
      ctx.strokeStyle = 'rgba(90,184,255,0.55)';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r0.x, r0.y, g.size * (pv.range * 2 + 1), g.size * (pv.range * 2 + 1));
      ctx.setLineDash([]);
    }
    const color = pv.ok ? (pv.ripe ? '#ffd75a' : '#7ee06a') : '#ff6a6a';
    const pulse = 0.6 + Math.sin(G.uiTime * 6) * 0.25;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hexToRgba(color, pulse);
    roundRectPath(g.x + 2, g.y + 2, g.size - 4, g.size - 4, Math.max(3, 6 * G.viewZoom));
    ctx.stroke();
    if (pv.blocked) {
      // a red cross over tiles where the tool can't act
      ctx.fillStyle = 'rgba(255,60,60,0.16)';
      ctx.fillRect(g.x + 2, g.y + 2, g.size - 4, g.size - 4);
      const m = g.size * 0.3;
      ctx.strokeStyle = 'rgba(255,90,90,0.9)';
      ctx.lineWidth = Math.max(2, 3 * G.viewZoom);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(g.x + m, g.y + m);
      ctx.lineTo(g.x + g.size - m, g.y + g.size - m);
      ctx.moveTo(g.x + g.size - m, g.y + m);
      ctx.lineTo(g.x + m, g.y + g.size - m);
      ctx.stroke();
    }
    if (pv.pick)
      drawSprite('pick', g.x + g.size * 0.78, g.y + g.size * 0.24, 22 * G.viewZoom + 6);
    if (pv.ghost && pv.ok) {
      ctx.globalAlpha = 0.55;
      drawSprite(pv.ghost, g.x + g.size / 2, g.y + g.size / 2 - 2 * G.viewZoom, 40 * G.viewZoom);
    }
    ctx.restore();
    if (pv.hint) {
      // hint chip above the tile, in HUD units
      ctx.save();
      ctx.scale(G.uiS, G.uiS);
      const ux = (g.x + g.size / 2) / G.uiS, uy = g.y / G.uiS - 16;
      drawChip(pv.hint, ux, Math.max(4, uy - 11), 22, { align: 'center', px: 12, weight: '', bg: 'rgba(30,8,8,0.88)', border: pv.ok ? 'rgba(255,255,255,0.25)' : 'rgba(255,106,106,0.7)', color: pv.ok ? UI.text : '#ffc0b8', maxW: 360 });
      ctx.restore();
    }
  }

  Object.assign(NS, { updateStatusBar, drawFrame });

})();
