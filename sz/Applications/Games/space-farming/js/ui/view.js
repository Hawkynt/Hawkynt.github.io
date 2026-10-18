/* Space Farming - the camera and pointer: world <-> screen conversion, zoom and pan, fitting
   the farm on screen, the keyboard tile cursor and pointer coordinates.
   Owns: G.viewZoom, G.viewPanX, G.viewPanY, G.pointerX, G.pointerY, G.pointerUX, G.pointerUY,
     G.pointerInside, G.pinch, G.pressStart
   Reads: G.canvasW, G.canvasH, G.uiS, G.gridRows, G.gridCols, G.dragStartX, G.dragStartY, G.dragCurrentX,
     G.dragCurrentY */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { BASE_TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, canvas, VIEW_ZOOM_MIN, VIEW_ZOOM_MAX } = NS;

  function gridToScreen(col, row) {
    const ts = BASE_TILE_SIZE * G.viewZoom;
    return {
      x: (GRID_OFFSET_X + col * BASE_TILE_SIZE) * G.viewZoom + G.viewPanX,
      y: (GRID_OFFSET_Y + row * BASE_TILE_SIZE) * G.viewZoom + G.viewPanY,
      size: ts
    };
  }

  /* Centre of a tile in world units */
  function tileCenter(col, row) {
    return { x: GRID_OFFSET_X + (col + 0.5) * BASE_TILE_SIZE, y: GRID_OFFSET_Y + (row + 0.5) * BASE_TILE_SIZE };
  }

  function penCenter(pen) {
    return tileCenter(pen.gridCol, pen.gridRow);
  }

  /** Convert a livestock pen's grid position to screen coordinates (center of pen tile). */
  function livestockPenToScreen(pen) {
    const ts = BASE_TILE_SIZE * G.viewZoom;
    return {
      x: (GRID_OFFSET_X + pen.gridCol * BASE_TILE_SIZE) * G.viewZoom + G.viewPanX + ts / 2,
      y: (GRID_OFFSET_Y + pen.gridRow * BASE_TILE_SIZE) * G.viewZoom + G.viewPanY + ts / 2,
      size: ts
    };
  }

  /* World y of the horizon line (a few tiles above the field) */
  function horizonWorldY() {
    return GRID_OFFSET_Y - BASE_TILE_SIZE * 2.2;
  }

  function worldToUI(wx, wy) {
    return { x: (G.viewPanX + wx * G.viewZoom) / G.uiS, y: (G.viewPanY + wy * G.viewZoom) / G.uiS };
  }

  /* ── Keyboard tile cursor and touch points ── */
  const kbCursor = { col: 0, row: 0, active: false };
  const touches = new Map();                 // pointerId -> { x, y }

  /* Pans the view so a tile stays inside the area between the HUD panels */
  function revealTile(col, row) {
    const g = gridToScreen(col, row);
    const { left, right, top, bottom } = NS.fieldViewRect(50);
    if (g.x < left) G.viewPanX += left - g.x;
    else if (g.x + g.size > right) G.viewPanX -= g.x + g.size - right;
    if (g.y < top) G.viewPanY += top - g.y;
    else if (g.y + g.size > bottom) G.viewPanY -= g.y + g.size - bottom;
    clampPan();
  }

  function zoomAt(sx, sy, factor) {
    const oldZoom = G.viewZoom;
    G.viewZoom = Math.max(VIEW_ZOOM_MIN, Math.min(VIEW_ZOOM_MAX, G.viewZoom * factor));
    const ratio = G.viewZoom / oldZoom;
    G.viewPanX = sx - (sx - G.viewPanX) * ratio;
    G.viewPanY = sy - (sy - G.viewPanY) * ratio;
    clampPan();
  }

  /* ── Pointer coordinate helpers ── */

  function pointerToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (G.canvasW / rect.width),
      y: (e.clientY - rect.top) * (G.canvasH / rect.height)
    };
  }

  function canvasToGrid(cx, cy) {
    const wx = (cx - G.viewPanX) / G.viewZoom;
    const wy = (cy - G.viewPanY) / G.viewZoom;
    return {
      col: Math.floor((wx - GRID_OFFSET_X) / BASE_TILE_SIZE),
      row: Math.floor((wy - GRID_OFFSET_Y) / BASE_TILE_SIZE)
    };
  }

  function isInsideGrid(col, row) {
    return col >= 0 && col < G.gridCols && row >= 0 && row < G.gridRows;
  }

  function getDragGridRect() {
    const a = canvasToGrid(G.dragStartX, G.dragStartY);
    const b = canvasToGrid(G.dragCurrentX, G.dragCurrentY);
    return {
      c0: Math.max(0, Math.min(a.col, b.col)),
      r0: Math.max(0, Math.min(a.row, b.row)),
      c1: Math.min(G.gridCols - 1, Math.max(a.col, b.col)),
      r1: Math.min(G.gridRows - 1, Math.max(a.row, b.row))
    };
  }

  /* ── Zoom & pan helpers ── */

  function clampPan() {
    const ts = BASE_TILE_SIZE * G.viewZoom;
    const gridW = G.gridCols * ts;
    const gridH = G.gridRows * ts;
    const ox = GRID_OFFSET_X * G.viewZoom;
    const oy = GRID_OFFSET_Y * G.viewZoom;
    const margin = 80;
    G.viewPanX = Math.max(-gridW - ox + margin, Math.min(G.canvasW - ox - margin, G.viewPanX));
    G.viewPanY = Math.max(-gridH - oy + margin, Math.min(G.canvasH - oy - margin, G.viewPanY));
  }

  /* Fits the whole farm between the HUD panels, with a strip of sky above it */
  function resetView() {
    const T = BASE_TILE_SIZE;
    const R = NS.fieldViewRect(56);
    const left = R.left, right = R.right, bottom = R.bottom;
    const top = NS.isNarrowHud() ? R.top : G.canvasH * 0.03;
    const wx0 = GRID_OFFSET_X - T * 1.2, wx1 = GRID_OFFSET_X + (G.gridCols + 1.2) * T;
    const wy0 = horizonWorldY() - T * 2.4, wy1 = GRID_OFFSET_Y + (G.gridRows + 1.3) * T;
    G.viewZoom = Math.max(VIEW_ZOOM_MIN, Math.min(1.5, (right - left) / (wx1 - wx0), (bottom - top) / (wy1 - wy0)));
    G.viewPanX = (left + right) / 2 - (wx0 + wx1) / 2 * G.viewZoom;
    G.viewPanY = (top + bottom) / 2 - (wy0 + wy1) / 2 * G.viewZoom;
    clampPan();
  }

  Object.assign(NS, { gridToScreen, tileCenter, penCenter, livestockPenToScreen, horizonWorldY, worldToUI,
    kbCursor, touches, revealTile, zoomAt, pointerToCanvas, canvasToGrid, isInsideGrid, getDragGridRect,
    clampPan, resetView });

})();
