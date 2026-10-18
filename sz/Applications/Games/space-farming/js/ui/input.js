/* Space Farming - keyboard, pointer, touch and wheel input: shortcuts, planting by keyboard
   cursor, drag actions, panning, pinch zoom and region clicks.
   Owns: G.isPanning, G.panLastX, G.panLastY, G.panButton, G.rightClickStartX, G.rightClickStartY,
     G.isDragging, G.dragStartX, G.dragStartY, G.dragCurrentX, G.dragCurrentY, G.dragStartedOnGrid
   Reads: G.canvasW, G.canvasH, G.uiS, G.state, G.credits, G.selectedTool, G.gridRows, G.farmGrid,
     G.tileTypes, G.buildings, G.selectedBuildingIndex, G.wildAnimals, G.gridCols, G.viewPanX, G.viewPanY,
     G.savedGameAvailable, G.newGameConfirmOpen, G.uiRegions, G.hoverRegionId, G.pressRegionId,
     G.treePanning, G.dockFollow, G.dialog, G.helpPage, G.inspect, G.pointerX, G.pointerY, G.pointerUX,
     G.pointerUY, G.pointerInside, G.pinch, G.pressStart */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TILE_FARMLAND, TILE_WATER, STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_GAME_OVER, CROPS, TOOL_HOE, BUILDINGS,
    TOOL_BUILD, canvas, particles, screenShake, hitRegion, saveGame, continueSavedGame, requestNewGame,
    upgradeBuilding, resetGame, tileCenter, plantCrop, harvestCrop, hoeFertilize, hoeUproot, feedAndCollect,
    sellAllProduce, placeBuilding, removeBuilding, expansionAt, expandField, worldToUI, flyCoins,
    isBuildingUnlocked, handleTreeKey, hudPassThrough, dockItems, selectCrop, selectBuilding, setTool,
    toggleSoilOverlay, popText, closeDialog, toggleDialog, toggleTree, helpNext, openHelp, clearTooltip,
    nearestAnimalAt, penAt, kbCursor, touches, togglePause, revealTile, zoomAt, pointerToCanvas,
    canvasToGrid, isInsideGrid, getDragGridRect, clampPan, resetView } = NS;

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  const keys = {};

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => G.state === STATE_PLAYING,
    pause: () => {
      G.state = STATE_PAUSED;
      saveGame();
    }
  });

  /* Keep the farm when the window is closed or the page goes away */
  window.addEventListener('pagehide', saveGame);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden)
      saveGame();
  });

  /* Plants, harvests or hoes the tile under the keyboard cursor */
  function actOnTile(row, col) {
    if (G.selectedTool === TOOL_BUILD && G.selectedBuildingIndex >= 0) {
      if (G.buildings[row][col])
        G.inspect = { row, col };
      else
        placeBuilding(row, col);
      return;
    }
    if (G.selectedTool === TOOL_HOE) {
      hoeFertilize(row, col);
      return;
    }
    if (G.buildings[row][col]) {
      G.inspect = G.inspect && G.inspect.row === row && G.inspect.col === col ? null : { row, col };
      return;
    }
    const cell = G.farmGrid[row][col];
    if (!cell)
      plantCrop(row, col);
    else if (cell.growthStage >= CROPS[cell.cropIndex].stages - 1)
      harvestCrop(row, col);
    else
      SZ.GameAudio.play('error', { volume: 0.4 });
  }

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (G.newGameConfirmOpen)
      return;

    if (e.code === 'F2') {
      e.preventDefault();
      requestNewGame();
      return;
    }

    if (G.dialog === 'help') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        helpNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (G.helpPage > 0) {
          --G.helpPage;
          SZ.GameAudio.play('click');
        }
      } else if (e.code === 'Escape' || e.code === 'KeyH') {
        e.preventDefault();
        closeDialog();
      }
      return;
    }

    if (e.code === 'KeyH') {
      openHelp(0);
      return;
    }

    if (G.state === STATE_READY) {
      if (G.savedGameAvailable && (e.code === 'Enter' || e.code === 'KeyC')) {
        e.preventDefault();
        continueSavedGame();
      } else if (!G.savedGameAvailable && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        resetGame();
      }
      return;
    }

    if (G.state === STATE_GAME_OVER) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        requestNewGame();
      }
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (G.dialog)
        closeDialog();
      else if (G.inspect)
        G.inspect = null;
      else if (kbCursor.active)
        kbCursor.active = false;
      else
        togglePause();
      return;
    }

    if (G.state === STATE_PAUSED) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        togglePause();
      }
      return;
    }
    if (G.state !== STATE_PLAYING)
      return;

    if (G.dialog) {
      if (G.dialog === 'tree' && e.code !== 'KeyU' && handleTreeKey(e)) {
        e.preventDefault();
        return;
      }
      if ((e.code === 'KeyU' && G.dialog === 'tree') || (e.code === 'KeyL' && G.dialog === 'livestock') || (e.code === 'KeyM' && G.dialog === 'market'))
        closeDialog();
      else if (e.code === 'KeyS' && G.dialog === 'market')
        sellAllProduce();
      return;
    }

    // Number keys pick crops (or buildings in build mode); 0 is the tenth
    const digit = /^Digit(\d)$/.exec(e.code) || /^Numpad(\d)$/.exec(e.code);
    if (digit) {
      const n = parseInt(digit[1], 10);
      const idx = n === 0 ? 9 : n - 1;
      const items = dockItems(G.selectedTool === TOOL_BUILD ? 'build' : 'plant');
      if (idx < items.length) {
        if (G.selectedTool === TOOL_BUILD)
          selectBuilding(items[idx].index);
        else
          selectCrop(items[idx].index);
      }
      G.dockFollow = true;
      return;
    }

    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.code]) {
      e.preventDefault();
      const [dx, dy] = arrows[e.code];
      if (e.shiftKey) {
        G.viewPanX -= dx * 60;
        G.viewPanY -= dy * 60;
        clampPan();
        return;
      }
      if (!kbCursor.active) {
        const c = canvasToGrid(G.canvasW / 2, G.canvasH / 2);
        kbCursor.col = Math.max(0, Math.min(G.gridCols - 1, c.col));
        kbCursor.row = Math.max(0, Math.min(G.gridRows - 1, c.row));
        kbCursor.active = true;
      } else {
        kbCursor.col = Math.max(0, Math.min(G.gridCols - 1, kbCursor.col + dx));
        kbCursor.row = Math.max(0, Math.min(G.gridRows - 1, kbCursor.row + dy));
      }
      revealTile(kbCursor.col, kbCursor.row);
      SZ.GameAudio.play('click', { volume: 0.3 });
      return;
    }
    if ((e.code === 'Space' || e.code === 'Enter') && kbCursor.active) {
      e.preventDefault();
      actOnTile(kbCursor.row, kbCursor.col);
      return;
    }

    switch (e.code) {
      case 'KeyS': sellAllProduce(); break;
      case 'KeyU': toggleTree(); break;
      case 'KeyL': toggleDialog('livestock'); break;
      case 'KeyM': toggleDialog('market'); break;
      case 'KeyP': setTool('plant'); G.dockFollow = true; break;
      case 'KeyB':
        if (G.selectedTool === TOOL_BUILD) {
          let i = G.selectedBuildingIndex;
          do i = (i + 1) % BUILDINGS.length; while (!isBuildingUnlocked(i));
          selectBuilding(i);
        } else
          setTool('build');
        G.dockFollow = true;
        break;
      case 'KeyT': setTool(G.selectedTool === TOOL_HOE ? 'plant' : 'hoe'); break;
      case 'Home': resetView(); break;
      case 'KeyN': toggleSoilOverlay(); break;
      case 'KeyE': expandField(); break;
      case 'Equal': case 'NumpadAdd': zoomAt(G.canvasW / 2, G.canvasH / 2, 1.15); break;
      case 'Minus': case 'NumpadSubtract': zoomAt(G.canvasW / 2, G.canvasH / 2, 1 / 1.15); break;
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* Applies plant / harvest / hoe to every tile inside the drag selection */
  function applyDragAction() {
    if (G.selectedTool === TOOL_BUILD) return;
    const { r0, c0, r1, c1 } = getDragGridRect();
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        if (G.selectedTool === TOOL_HOE) {
          hoeFertilize(r, c);
          continue;
        }
        const tt = G.tileTypes[r]?.[c] ?? TILE_FARMLAND;
        if (tt === TILE_WATER || G.buildings[r]?.[c]) continue;
        const cell = G.farmGrid[r][c];
        if (cell === null)
          plantCrop(r, c);
        else if (cell.growthStage >= CROPS[cell.cropIndex].stages - 1)
          harvestCrop(r, c);
      }
  }

  function updatePointer(e) {
    const { x, y } = pointerToCanvas(e);
    G.pointerX = x;
    G.pointerY = y;
    G.pointerUX = x / G.uiS;
    G.pointerUY = y / G.uiS;
    G.pointerInside = true;
  }

  function chaseMouse(i) {
    const animal = G.wildAnimals[i];
    G.credits += 10;
    const { x: tx, y: ty } = tileCenter(animal.rx !== undefined ? animal.rx : animal.x, animal.ry !== undefined ? animal.ry : animal.y);
    popText(tx, ty - 10, 'Chased off! +10', { color: '#ffd75a', font: 'bold 13px' });
    const up = worldToUI(tx, ty);
    flyCoins(2, up.x, up.y, { size: 18 });
    particles.burst(tx, ty, 10, { color: '#ffd0a0', speed: 3, life: 0.4 });
    screenShake.trigger(2, 100);
    SZ.GameAudio.play('hit');
    G.wildAnimals.splice(i, 1);
  }

  canvas.addEventListener('pointerdown', (e) => {
    updatePointer(e);
    kbCursor.active = false;
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: G.pointerX, y: G.pointerY });
      if (touches.size === 2 && G.state === STATE_PLAYING && !G.dialog) {
        // second finger: switch to pinch zoom / two-finger pan
        G.isDragging = false;
        const [a, b] = [...touches.values()];
        G.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        return;
      }
    }

    const region = hitRegion(G.pointerUX, G.pointerUY);
    const through = region && !region.modal && hudPassThrough(G.pointerUX, G.pointerUY);
    if (region && !through && region.onDragStart) {
      dragRegion = region;
      region.onDragStart(e.button);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (region && !through) {
      if (e.button !== 0 && e.pointerType === 'mouse') {
        if (!region.modal && G.state === STATE_PLAYING && !G.dialog && (e.button === 1 || e.button === 2))
          startPan(e);
        return;
      }
      G.pressRegionId = region.id;
      G.pressStart = { region };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (G.state !== STATE_PLAYING || G.dialog) return;

    // Middle mouse, right-click or Ctrl+left pans
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      startPan(e);
      return;
    }

    const ai = nearestAnimalAt(G.pointerX, G.pointerY);
    if (ai >= 0) {
      chaseMouse(ai);
      return;
    }

    const { col, row } = canvasToGrid(G.pointerX, G.pointerY);
    if (isInsideGrid(col, row)) {
      if (G.selectedTool === TOOL_BUILD && G.selectedBuildingIndex >= 0) {
        if (G.buildings[row][col])
          G.inspect = { row, col };
        else
          placeBuilding(row, col);
        return;
      }
      G.isDragging = true;
      G.dragStartedOnGrid = true;
      G.dragStartX = G.dragCurrentX = G.pointerX;
      G.dragStartY = G.dragCurrentY = G.pointerY;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const pi = penAt(G.pointerX, G.pointerY);
    if (pi >= 0) {
      feedAndCollect(pi);
      return;
    }
    if (expansionAt(G.pointerX, G.pointerY)) {
      expandField();
      return;
    }
    G.inspect = null;
  });

  function startPan(e) {
    G.isPanning = true;
    G.panButton = e.button;
    G.panLastX = G.pointerX;
    G.panLastY = G.pointerY;
    if (e.button === 2) {
      G.rightClickStartX = G.pointerX;
      G.rightClickStartY = G.pointerY;
    }
    canvas.setPointerCapture(e.pointerId);
  }

  let dragRegion = null;

  canvas.addEventListener('pointermove', (e) => {
    updatePointer(e);
    if (dragRegion) {
      dragRegion.onDrag();
      return;
    }
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: G.pointerX, y: G.pointerY });
      if (G.pinch && touches.size >= 2) {
        const [a, b] = [...touches.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        G.viewPanX += cx - G.pinch.cx;
        G.viewPanY += cy - G.pinch.cy;
        zoomAt(cx, cy, dist / G.pinch.dist);
        G.pinch.dist = dist;
        G.pinch.cx = cx;
        G.pinch.cy = cy;
        return;
      }
    }
    if (e.pointerType === 'mouse')
      kbCursor.active = false;
    if (G.isPanning) {
      G.viewPanX += G.pointerX - G.panLastX;
      G.viewPanY += G.pointerY - G.panLastY;
      clampPan();
      G.panLastX = G.pointerX;
      G.panLastY = G.pointerY;
      return;
    }
    if (G.isDragging) {
      G.dragCurrentX = G.pointerX;
      G.dragCurrentY = G.pointerY;
    }
  });

  canvas.addEventListener('pointerleave', () => {
    G.pointerInside = false;
    G.hoverRegionId = null;
    clearTooltip();
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerup', (e) => {
    updatePointer(e);
    if (dragRegion) {
      const r = dragRegion;
      dragRegion = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      r.onDragEnd(e.button);
      return;
    }
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (G.pinch) {
        if (touches.size < 2)
          G.pinch = null;
        return;
      }
    }
    if (G.pressStart) {
      const r = G.pressStart.region;
      G.pressStart = null;
      G.pressRegionId = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      const now = hitRegion(G.pointerUX, G.pointerUY);
      if (now && now.id === r.id) {
        if (r.onClick)
          r.onClick();
        else if (r.disabledClick)
          r.disabledClick();
      }
      return;
    }
    if (G.isPanning) {
      G.isPanning = false;
      const releasedButton = G.panButton;
      G.panButton = -1;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      // a short right-click upgrades a building, Shift removes it, a mouse gets chased off
      if (releasedButton === 2 && G.state === STATE_PLAYING && !G.dialog && Math.hypot(G.pointerX - G.rightClickStartX, G.pointerY - G.rightClickStartY) < 5) {
        const ai = nearestAnimalAt(G.pointerX, G.pointerY);
        if (ai >= 0) {
          chaseMouse(ai);
          return;
        }
        const { col, row } = canvasToGrid(G.pointerX, G.pointerY);
        if (isInsideGrid(col, row)) {
          if (G.selectedTool === TOOL_HOE && G.farmGrid[row]?.[col])
            hoeUproot(row, col);
          else if (e.shiftKey)
            removeBuilding(row, col);
          else if (G.buildings[row]?.[col])
            upgradeBuilding(row, col);
        }
      }
      return;
    }
    if (!G.isDragging) return;
    G.isDragging = false;
    G.dragStartedOnGrid = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    if (G.state !== STATE_PLAYING) return;
    // A plain click on a building opens its inspector
    if (Math.hypot(G.dragCurrentX - G.dragStartX, G.dragCurrentY - G.dragStartY) < 6) {
      const { col, row } = canvasToGrid(G.dragStartX, G.dragStartY);
      if (isInsideGrid(col, row) && G.buildings[row][col] && G.selectedTool !== TOOL_HOE) {
        G.inspect = G.inspect && G.inspect.row === row && G.inspect.col === col ? null : { row, col };
        SZ.GameAudio.play('click');
        return;
      }
    }
    G.inspect = null;
    applyDragAction();
  });

  canvas.addEventListener('pointercancel', (e) => {
    if (dragRegion) {
      dragRegion = null;
      G.treePanning = null;
    }
    touches.delete(e.pointerId);
    G.pinch = null;
    G.pressStart = null;
    G.pressRegionId = null;
    G.isPanning = false;
    G.panButton = -1;
    G.isDragging = false;
    G.dragStartedOnGrid = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { x, y } = pointerToCanvas(e);
    const region = hitRegion(x / G.uiS, y / G.uiS);
    if (region) {
      if (region.onWheel)
        region.onWheel(e.deltaY);
      else {
        for (let i = G.uiRegions.length - 1; i >= 0; --i) {
          const r = G.uiRegions[i];
          if (r.onWheel && x / G.uiS >= r.x && x / G.uiS <= r.x + r.w && y / G.uiS >= r.y && y / G.uiS <= r.y + r.h) {
            r.onWheel(e.deltaY);
            break;
          }
        }
      }
      if (!hudPassThrough(x / G.uiS, y / G.uiS) || region.modal)
        return;
    }
    if (G.state !== STATE_PLAYING || G.dialog) return;
    zoomAt(x, y, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

})();
