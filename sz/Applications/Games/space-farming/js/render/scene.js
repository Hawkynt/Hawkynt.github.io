/* Space Farming - the world pass that draws the farm in order, and the drag selection.
   Reads: G.selectedTool, G.gridRows, G.farmGrid, G.tileTypes, G.buildings, G.livestockPens, G.gridCols,
     G.viewZoom, G.viewPanX, G.viewPanY, G.isDragging, G.dragStartedOnGrid, G.spriteScale */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { BASE_TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, TILE_FARMLAND, TILE_ROCK, TILE_WATER, TILE_SAND,
    CROPS, TOOL_HOE, ctx, particles, drawWeatherWorld, drawMeteorsWorld, drawAurora, drawSky, viewWorldRect,
    drawGround, drawDecor, drawFieldFence, drawTiles, drawNutrients, drawCrop, drawRock, drawExpansionStrip,
    drawBuilding, drawPen, drawZapArcs, drawMice, drawLighting, drawAmbient, getDragGridRect } = NS;

  /* ── World pass ── */

  function drawWorldScene() {
    const v = viewWorldRect();
    drawSky();
    drawAurora();
    drawGround(v);
    ctx.save();
    ctx.translate(G.viewPanX, G.viewPanY);
    ctx.scale(G.viewZoom, G.viewZoom);
    G.spriteScale = G.viewZoom * (window.devicePixelRatio || 1);
    drawDecor(v, 'live');
    drawTiles(v);
    drawNutrients(v);
    drawWeatherWorld();
    drawFieldFence();
    drawExpansionStrip();
    // Row by row so taller sprites overlap the row behind them
    const T = BASE_TILE_SIZE;
    const r0 = Math.max(-1, Math.floor((v.y0 - GRID_OFFSET_Y) / T) - 1), r1 = Math.min(G.gridRows, Math.ceil((v.y1 - GRID_OFFSET_Y) / T) + 1);
    const c0 = Math.max(0, Math.floor((v.x0 - GRID_OFFSET_X) / T) - 1), c1 = Math.min(G.gridCols - 1, Math.ceil((v.x1 - GRID_OFFSET_X) / T) + 1);
    const pensByRow = {};
    for (const pen of G.livestockPens)
      (pensByRow[pen.gridRow] = pensByRow[pen.gridRow] || []).push(pen);
    for (let r = r0; r <= r1; ++r) {
      if (pensByRow[r])
        for (const pen of pensByRow[r]) drawPen(pen);
      if (r < 0 || r >= G.gridRows) continue;
      for (let c = c0; c <= c1; ++c) {
        const bld = G.buildings[r][c];
        if (bld)
          drawBuilding(r, c, bld);
        else if (G.tileTypes[r][c] === TILE_ROCK)
          drawRock(r, c);
        else if (G.farmGrid[r][c] && G.tileTypes[r][c] !== TILE_WATER)
          drawCrop(r, c, G.farmGrid[r][c]);
      }
    }
    drawMice();
    drawZapArcs();
    drawMeteorsWorld();
    particles.draw(ctx);
    ctx.restore();
    G.spriteScale = window.devicePixelRatio || 1;
    drawLighting();
    drawAmbient();
  }

  function drawDragSelection() {
    if (!G.isDragging || !G.dragStartedOnGrid) return;

    const { r0, c0, r1, c1 } = getDragGridRect();
    const ts = BASE_TILE_SIZE * G.viewZoom;

    // Highlight individual tiles within the selection
    const hoeMode = G.selectedTool === TOOL_HOE;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tt = G.tileTypes[r]?.[c] ?? TILE_FARMLAND;
        const tx = (GRID_OFFSET_X + c * BASE_TILE_SIZE) * G.viewZoom + G.viewPanX;
        const ty = (GRID_OFFSET_Y + r * BASE_TILE_SIZE) * G.viewZoom + G.viewPanY;

        if (hoeMode) {
          // Hoe drag: highlight water tiles (fertilize 8 neighbors) and sand (convert to soil)
          if (tt === TILE_WATER) {
            ctx.fillStyle = 'rgba(0,150,255,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else if (tt === TILE_SAND) {
            ctx.fillStyle = 'rgba(160,130,60,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else if (tt === TILE_ROCK && !G.buildings[r]?.[c]) {
            ctx.fillStyle = 'rgba(220,210,190,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else if (tt !== TILE_ROCK && !G.buildings[r]?.[c]) {
            ctx.fillStyle = 'rgba(80,200,60,0.15)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          }
          continue;
        }

        // Water and rock take no crops
        if (tt === TILE_WATER) continue;
        if (tt === TILE_ROCK) {
          ctx.fillStyle = 'rgba(255,60,60,0.22)';
          ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          continue;
        }
        // Skip tiles with buildings
        if (G.buildings[r]?.[c]) continue;

        const cell = G.farmGrid[r][c];

        if (cell === null) {
          ctx.fillStyle = 'rgba(0,200,0,0.2)';
          ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
        } else {
          const crop = CROPS[cell.cropIndex];
          if (cell.growthStage >= crop.stages - 1) {
            ctx.fillStyle = 'rgba(255,200,0,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else {
            ctx.fillStyle = 'rgba(255,50,50,0.12)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          }
        }
      }

    // Draw outer selection rectangle border
    const rx = (GRID_OFFSET_X + c0 * BASE_TILE_SIZE) * G.viewZoom + G.viewPanX;
    const ry = (GRID_OFFSET_Y + r0 * BASE_TILE_SIZE) * G.viewZoom + G.viewPanY;
    const rw = (c1 - c0 + 1) * ts;
    const rh = (r1 - r0 + 1) * ts;

    ctx.strokeStyle = 'rgba(0,255,128,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  Object.assign(NS, { drawWorldScene, drawDragSelection });

})();
