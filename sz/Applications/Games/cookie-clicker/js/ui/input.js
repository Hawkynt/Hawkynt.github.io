/* Pointer input on the canvas: cookie clicks, building and upgrade purchases by
   row/slot hit-test, panel scrolling with the wheel, mouse tracking for tooltips
   and the F2/Escape keys; registers all canvas, document and window listeners. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { CANVAS_W, CANVAS_H, BLDG_PANEL_X, BLDG_PANEL_W, BLDG_HEADER_H, BLDG_VISIBLE_H, BLDG_ROW_TOTAL, BLDG_ROW_H, COOKIE_CX, COOKIE_CY, COOKIE_R } = NS.constants;
  const BUILDING_DEFS = NS.buildingDefs;
  const UPGRADE_DEFS = NS.upgradeDefs;
  const canvas = NS.dom.canvas;
  /* ── Coordinate helpers ── */
  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }
  /* ── Click / Pointer Input ── */
  function handleCanvasClick(e) {
    const { x, y } = canvasCoords(e);

    // Check cookie click
    const dx = x - COOKIE_CX;
    const dy = y - COOKIE_CY;
    if (dx * dx + dy * dy <= COOKIE_R * COOKIE_R) {
      NS.purchasing.handleCookieClick(x, y);
      return;
    }

    // Check building click (within scrollable content area)
    const panelX = BLDG_PANEL_X;
    const panelW = BLDG_PANEL_W;
    const contentTop = 10 + BLDG_HEADER_H;

    if (x >= panelX && x <= panelX + panelW && y >= contentTop && y <= contentTop + BLDG_VISIBLE_H) {
      for (let i = 0; i < BUILDING_DEFS.length; ++i) {
        const by = contentTop + i * BLDG_ROW_TOTAL - S.buildingScrollOffset;
        if (by + BLDG_ROW_H < contentTop || by > contentTop + BLDG_VISIBLE_H)
          continue;
        if (y >= by && y <= by + BLDG_ROW_H) {
          NS.purchasing.buyBuilding(i);
          return;
        }
      }
    }

    // Check upgrade click
    if (x >= 10 && x <= 410 && y >= 420) {
      const ownedCounts = NS.economy.getOwnedCounts();
      let drawn = 0;
      for (let i = 0; i < UPGRADE_DEFS.length && drawn < 6; ++i) {
        const def = UPGRADE_DEFS[i];
        if (S.upgradePurchased[def.id])
          continue;
        if (!def.condition(ownedCounts))
          continue;
        const ux = 10 + 10 + (drawn % 3) * 130;
        const uy = 420 + 30 + Math.floor(drawn / 3) * 55;
        if (x >= ux && x <= ux + 120 && y >= uy && y <= uy + 48) {
          NS.purchasing.buyUpgrade(i);
          return;
        }
        ++drawn;
      }
    }
  }
  canvas.addEventListener('pointerdown', handleCanvasClick);

  /* ── Mouse move for tooltip ── */
  canvas.addEventListener('pointermove', function(e) {
    const { x, y } = canvasCoords(e);
    S.mouseX = x;
    S.mouseY = y;
  });

  canvas.addEventListener('pointerleave', function() {
    S.mouseX = -1000;
    S.mouseY = -1000;
    S.tooltip = null;
  });

  /* ── Scroll on buildings panel ── */
  canvas.addEventListener('wheel', function(e) {
    const { x, y } = canvasCoords(e);
    const panelX = BLDG_PANEL_X;
    const panelW = BLDG_PANEL_W;
    const contentTop = 10 + BLDG_HEADER_H;

    if (x >= panelX && x <= panelX + panelW && y >= contentTop && y <= contentTop + BLDG_VISIBLE_H) {
      e.preventDefault();
      S.buildingScrollOffset += e.deltaY > 0 ? 55 : -55;
      const maxScroll = NS.draw.getMaxBuildingScroll();
      if (S.buildingScrollOffset < 0)
        S.buildingScrollOffset = 0;
      if (S.buildingScrollOffset > maxScroll)
        S.buildingScrollOffset = maxScroll;
    }
  }, { passive: false });

  /* ── Keyboard ── */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F2') {
      e.preventDefault();
      NS.saveload.newGame();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
    }
  });

  /* ── Resize ── */
  window.addEventListener('resize', NS.dom.setupCanvas);

  Object.assign(NS.input, { canvasCoords, handleCanvasClick });
})();
