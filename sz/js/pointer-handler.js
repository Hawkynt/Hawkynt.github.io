;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /** Build the icon context menu items for a given window. */
  function _buildWindowMenu(wm, id) {
    const win = wm.getWindow(id);
    if (!win)
      return [];

    const isNormal = win.state === 'normal' && !win.isRolledUp;
    const isMaximized = win.state === 'maximized';
    const isMinimized = win.state === 'minimized';
    const isRolledUp = win.isRolledUp;

    return [
      {
        label: 'Restore',
        bold: isMaximized || isMinimized,
        disabled: isNormal,
        action: () => {
          if (isMaximized || isMinimized)
            wm.maximizeWindow(id); // toggles restore if maximized
          if (isMinimized)
            wm.focusWindow(id);
        },
      },
      { label: 'Move', disabled: isMaximized, action: () => {} },
      { label: 'Size', disabled: isMaximized || !win.resizable, action: () => {} },
      { separator: true },
      {
        label: 'Minimize',
        disabled: !win.minimizable,
        action: () => wm.minimizeWindow(id),
      },
      {
        label: 'Maximize',
        disabled: !win.maximizable || isMaximized,
        action: () => wm.maximizeWindow(id),
      },
      {
        label: isRolledUp ? 'Roll Down' : 'Roll Up',
        disabled: isMaximized || isMinimized,
        action: () => isRolledUp ? wm.rollDownWindow(id) : wm.rollUpWindow(id),
      },
      { separator: true },
      {
        label: 'Always on Top',
        checked: win.alwaysOnTop,
        action: () => wm.setWindowAlwaysOnTop(id, !win.alwaysOnTop),
      },
      {
        label: 'Set Transparency',
        submenu: [
          { label: '100% (Opaque)', action: () => wm.setWindowOpacity(id, 1.0) },
          { label: '90%', action: () => wm.setWindowOpacity(id, 0.9) },
          { label: '75%', action: () => wm.setWindowOpacity(id, 0.75) },
          { label: '50%', action: () => wm.setWindowOpacity(id, 0.5) },
          { label: '25%', action: () => wm.setWindowOpacity(id, 0.25) },
        ],
      },
      { separator: true },
      { label: 'Restart', disabled: !win.appId, action: () => wm.restartWindow(id) },
      { label: 'Close', bold: true, action: () => wm.closeWindow(id) },
    ];
  }

  function setupPointerHandlers(windowArea, windowManager, snapEngine) {
    let dragState = null;
    let snapOverlay = null;
    let lastMoveTime = 0;
    let lastMoveX = 0;
    let lastMoveY = 0;
    let cursorSpeed = 0;

    // -- Snap overlay element --
    function _getSnapOverlay() {
      if (!snapOverlay) {
        snapOverlay = document.createElement('div');
        snapOverlay.className = 'sz-snap-overlay';
        snapOverlay.style.display = 'none';
        windowArea.parentElement.appendChild(snapOverlay);
      }
      return snapOverlay;
    }

    function _showSnapOverlay(zone) {
      const ol = _getSnapOverlay();
      ol.style.display = '';
      ol.style.left = `${zone.x}px`;
      ol.style.top = `${zone.y}px`;
      ol.style.width = `${zone.width}px`;
      ol.style.height = `${zone.height}px`;
    }

    function _hideSnapOverlay() {
      if (snapOverlay)
        snapOverlay.style.display = 'none';
    }

    // -- Icon click state (for single vs double click) --
    let iconClickTimer = null;
    let iconClickWindowId = null;

    // -- Resize handle double-click detection --
    // We track the last pointerdown on a resize handle to detect double-clicks
    // without conflicting with the drag machinery.
    let resizeClickTime = 0;
    let resizeClickDir = null;
    let resizeClickWindowId = null;
    const DBLCLICK_THRESHOLD = 400; // ms

    /** Get the window-area bounding rect offset for coordinate conversion. */
    function _getWindowAreaOffset() {
      const rect = windowArea.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    }

    windowArea.addEventListener('pointerdown', (e) => {
      const windowEl = e.target.closest('.sz-window');
      if (!windowEl)
        return;

      const windowId = windowEl.dataset.windowId;

      windowManager.focusWindow(windowId);

      // -- Title bar icon click --
      const icon = e.target.closest('.sz-title-icon');
      if (icon) {
        e.preventDefault();
        e.stopPropagation();

        // Handle double-click detection on icon
        if (iconClickTimer && iconClickWindowId === windowId) {
          clearTimeout(iconClickTimer);
          iconClickTimer = null;
          iconClickWindowId = null;
          windowManager.closeWindow(windowId);
          return;
        }

        iconClickWindowId = windowId;
        iconClickTimer = setTimeout(() => {
          iconClickTimer = null;
          iconClickWindowId = null;
          if (!SZ.contextMenu)
            return;
          const rect = icon.getBoundingClientRect();
          SZ.contextMenu.showAt(_buildWindowMenu(windowManager, windowId), rect.left, rect.bottom);
        }, 250);
        return;
      }

      if (e.target.closest('.sz-title-buttons button')) {
        const action = e.target.closest('button').dataset.action;
        if (action)
          windowManager.handleButtonAction(windowId, action);
        return;
      }

      const handle = e.target.closest('.sz-resize-handle');
      if (handle) {
        e.preventDefault();
        const win = windowManager.getWindow(windowId);
        if (!win || win.state === 'maximized' || win.isRolledUp)
          return;

        const dir = handle.dataset.resize;
        const now = performance.now();

        // Detect double-click on resize handle for stretching
        if (resizeClickDir === dir && resizeClickWindowId === windowId &&
            (now - resizeClickTime) < DBLCLICK_THRESHOLD) {
          // This is a double-click on the same resize handle — perform stretch
          resizeClickTime = 0;
          resizeClickDir = null;
          resizeClickWindowId = null;

          if (snapEngine) {
            const mode = snapEngine.config['snap.stretchMode'] || 'disabled';
            if (mode !== 'disabled') {
              const pos = win.getPosition();
              const size = win.getSize();
              const windowRect = { x: pos.x, y: pos.y, width: size.width, height: size.height };
              const otherRects = mode === 'aquastretch'
                ? windowManager.getVisibleWindowRects(windowId)
                : [];
              const target = snapEngine.getStretchTarget(windowRect, dir, otherRects, windowArea.clientWidth, windowArea.clientHeight);
              if (target) {
                win.moveTo(target.x, target.y);
                win.resizeTo(target.width, target.height);
              }
            }
          }
          return; // Don't start a drag
        }

        // Record this click for double-click detection
        resizeClickTime = now;
        resizeClickDir = dir;
        resizeClickWindowId = windowId;

        const pos = win.getPosition();
        const size = win.getSize();
        dragState = {
          windowId,
          startX: e.clientX,
          startY: e.clientY,
          startWinX: pos.x,
          startWinY: pos.y,
          startW: size.width,
          startH: size.height,
          mode: 'resize',
          resizeDir: dir,
          adjacentWindows: null,
        };

        // For AquaGlue: find adjacent windows when Ctrl is held
        if (e.ctrlKey && snapEngine?.config?.['snap.glueEnabled'] && snapEngine?.config?.['snap.glueCtrlResize'])
          dragState.adjacentWindows = _findAdjacentWindows(windowId, dragState.resizeDir);

        windowArea.setPointerCapture(e.pointerId);
        return;
      }

      const titleBar = e.target.closest('.sz-title-bar');
      if (titleBar && !e.target.closest('.sz-title-buttons')) {
        e.preventDefault();
        const win = windowManager.getWindow(windowId);
        if (!win)
          return;

        // Drag-away-from-maximized: restore first then begin drag
        if (win.state === 'maximized') {
          const savedRect = win.savedRect;
          const proportionX = savedRect ? e.clientX / windowArea.clientWidth : 0.5;
          win.restore();
          const size = win.getSize();
          const newX = e.clientX - size.width * proportionX;
          const newY = e.clientY - 10;
          win.moveTo(Math.max(0, newX), Math.max(0, newY));

          const pos = win.getPosition();
          dragState = {
            windowId,
            startX: e.clientX,
            startY: e.clientY,
            startWinX: pos.x,
            startWinY: pos.y,
            mode: 'move',
            preSnapRect: null,
            adjacentWindows: null,
          };
          windowArea.setPointerCapture(e.pointerId);
          return;
        }

        if (win.isRolledUp) {
          // Allow dragging rolled-up windows
        }

        const pos = win.getPosition();
        dragState = {
          windowId,
          startX: e.clientX,
          startY: e.clientY,
          startWinX: pos.x,
          startWinY: pos.y,
          mode: 'move',
          preSnapRect: null,
          adjacentWindows: null,
        };

        // For AquaGlue: find adjacent windows when Ctrl is held at drag start
        if (e.ctrlKey && snapEngine?.config?.['snap.glueEnabled'] && snapEngine?.config?.['snap.glueCtrlDrag'])
          dragState.adjacentWindows = _findAdjacentWindows(windowId, null);

        windowArea.setPointerCapture(e.pointerId);
      }
    });

    windowArea.addEventListener('pointermove', (e) => {
      if (!dragState)
        return;

      // Track cursor speed for magnetic snap speed threshold
      const now = performance.now();
      if (lastMoveTime > 0) {
        const dt = (now - lastMoveTime) / 1000;
        if (dt > 0) {
          const dist = Math.hypot(e.clientX - lastMoveX, e.clientY - lastMoveY);
          cursorSpeed = dist / dt;
        }
      }
      lastMoveTime = now;
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const win = windowManager.getWindow(dragState.windowId);
      if (!win) {
        dragState = null;
        return;
      }

      // AquaGlue: detect Ctrl key press/release during drag (not just at pointerdown)
      if (snapEngine?.config?.['snap.glueEnabled'] && dragState.mode === 'move') {
        if (e.ctrlKey && !dragState.adjacentWindows && snapEngine.config['snap.glueCtrlDrag'])
          dragState.adjacentWindows = _findAdjacentWindows(dragState.windowId, null);
        else if (!e.ctrlKey && dragState.adjacentWindows)
          dragState.adjacentWindows = null;
      }
      if (snapEngine?.config?.['snap.glueEnabled'] && dragState.mode === 'resize') {
        if (e.ctrlKey && !dragState.adjacentWindows && snapEngine.config['snap.glueCtrlResize'])
          dragState.adjacentWindows = _findAdjacentWindows(dragState.windowId, dragState.resizeDir);
        else if (!e.ctrlKey && dragState.adjacentWindows)
          dragState.adjacentWindows = null;
      }

      if (dragState.mode === 'move') {
        let newX = dragState.startWinX + dx;
        let newY = dragState.startWinY + dy;

        // Magnetic snapping
        if (snapEngine && snapEngine.config['snap.magnetEnabled']) {
          const size = win.getSize();
          const windowRect = { x: newX, y: newY, width: size.width, height: size.height };
          const otherRects = windowManager.getVisibleWindowRects(dragState.windowId);
          const screenW = windowArea.clientWidth;
          const screenH = windowArea.clientHeight;
          const speedOk = !snapEngine.config['snap.magnetDisableFast'] ||
            cursorSpeed < (snapEngine.config['snap.magnetSpeedThreshold'] || 1500);

          if (speedOk) {
            const adj = snapEngine.getMagneticSnap(windowRect, otherRects, screenW, screenH);
            newX += adj.dx;
            newY += adj.dy;
          }
        }

        win.moveTo(newX, newY);

        // AquaGlue: move adjacent windows by same delta
        if (dragState.adjacentWindows) {
          for (const aw of dragState.adjacentWindows) {
            const adjWin = windowManager.getWindow(aw.id);
            if (adjWin)
              adjWin.moveTo(aw.startX + dx, aw.startY + dy);
          }
        }

        // Edge snapping overlay — use cursor position relative to the window area
        if (snapEngine && snapEngine.config['snap.enabled']) {
          const offset = _getWindowAreaOffset();
          const relX = e.clientX - offset.x;
          const relY = e.clientY - offset.y;
          const zone = snapEngine.getEdgeSnapZone(relX, relY, windowArea.clientWidth, windowArea.clientHeight);
          if (zone)
            _showSnapOverlay(zone);
          else
            _hideSnapOverlay();
        }

        // Tab merge detection — convert cursor to window-area-relative coordinates
        if (SZ.tabManager && snapEngine?.config?.['snap.tabEnabled']) {
          const size = win.getSize();
          const offset = _getWindowAreaOffset();
          SZ.tabManager.detectMerge(
            dragState.windowId,
            { x: newX, y: newY, width: size.width, height: size.height },
            e.clientX - offset.x,
            e.clientY - offset.y
          );
        }

      } else if (dragState.mode === 'resize') {
        const dir = dragState.resizeDir;
        let x = dragState.startWinX, y = dragState.startWinY;
        let w = dragState.startW, h = dragState.startH;

        if (dir.includes('e'))
          w = Math.max(200, dragState.startW + dx);
        if (dir.includes('w')) {
          w = Math.max(200, dragState.startW - dx);
          x = dragState.startWinX + (dragState.startW - w);
        }
        if (dir.includes('s'))
          h = Math.max(100, dragState.startH + dy);
        if (dir.includes('n')) {
          h = Math.max(100, dragState.startH - dy);
          y = dragState.startWinY + (dragState.startH - h);
        }

        win.moveTo(x, y);
        win.resizeTo(w, h);

        // AquaGlue: resize adjacent windows inversely
        if (dragState.adjacentWindows) {
          for (const aw of dragState.adjacentWindows) {
            const adjWin = windowManager.getWindow(aw.id);
            if (!adjWin)
              continue;
            const adjX = aw.startX + (dir.includes('e') && aw.edge === 'left' ? dx : 0);
            const adjW = aw.startW + (dir.includes('e') && aw.edge === 'left' ? -dx : 0);
            const adjY = aw.startY + (dir.includes('s') && aw.edge === 'top' ? dy : 0);
            const adjH = aw.startH + (dir.includes('s') && aw.edge === 'top' ? -dy : 0);
            if (adjW >= 200 && adjH >= 100) {
              adjWin.moveTo(adjX, adjY);
              adjWin.resizeTo(Math.max(200, adjW), Math.max(100, adjH));
            }
          }
        }
      }
    });

    windowArea.addEventListener('pointerup', (e) => {
      if (dragState) {
        // Apply snap zone if overlay is visible
        if (dragState.mode === 'move' && snapOverlay && snapOverlay.style.display !== 'none') {
          const win = windowManager.getWindow(dragState.windowId);
          if (win) {
            // Save pre-snap rect for restore
            const pos = win.getPosition();
            const size = win.getSize();
            win._preSnapRect = { x: pos.x, y: pos.y, width: size.width, height: size.height };

            const zone = {
              x: parseInt(snapOverlay.style.left),
              y: parseInt(snapOverlay.style.top),
              width: parseInt(snapOverlay.style.width),
              height: parseInt(snapOverlay.style.height),
            };
            win.moveTo(zone.x, zone.y);
            win.resizeTo(zone.width, zone.height);
          }
        }

        // Tab merge on drop
        if (dragState.mode === 'move' && SZ.tabManager && snapEngine?.config?.['snap.tabEnabled'])
          SZ.tabManager.completeMerge(dragState.windowId);

        _hideSnapOverlay();
        try { windowArea.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        dragState = null;
      }
    });

    // Title bar double-click → maximize/restore
    windowArea.addEventListener('dblclick', (e) => {
      // Skip resize handles — double-click on those is handled in pointerdown
      if (e.target.closest('.sz-resize-handle'))
        return;

      const titleBar = e.target.closest('.sz-title-bar');
      if (!titleBar || e.target.closest('.sz-title-buttons') || e.target.closest('.sz-title-icon'))
        return;

      const windowEl = e.target.closest('.sz-window');
      if (!windowEl)
        return;

      windowManager.maximizeWindow(windowEl.dataset.windowId);
    });

    /**
     * Find all windows transitively adjacent to the given window for AquaGlue.
     * Walks the adjacency graph so that if A touches B and B touches C,
     * dragging A will also move B and C.
     */
    function _findAdjacentWindows(windowId, resizeDir) {
      const threshold = 3;
      const visited = new Set([windowId]);
      const results = [];

      // Build a rect lookup for all visible windows (including the dragged one)
      const allRects = new Map();
      const dragWin = windowManager.getWindow(windowId);
      if (!dragWin)
        return results;

      const dragPos = dragWin.getPosition();
      const dragSize = dragWin.getSize();
      allRects.set(windowId, { x: dragPos.x, y: dragPos.y, width: dragSize.width, height: dragSize.height });

      for (const r of windowManager.getVisibleWindowRects(windowId))
        allRects.set(r.id, r);

      // BFS: start from the dragged window, discover all transitively adjacent
      const queue = [windowId];
      while (queue.length > 0) {
        const currentId = queue.shift();
        const cr = allRects.get(currentId);
        if (!cr)
          continue;

        const cx1 = cr.x, cy1 = cr.y;
        const cx2 = cx1 + cr.width, cy2 = cy1 + cr.height;

        for (const [candidateId, r] of allRects) {
          if (visited.has(candidateId))
            continue;

          const rx1 = r.x, ry1 = r.y;
          const rx2 = rx1 + r.width, ry2 = ry1 + r.height;

          const edges = [];
          // current's right edge adjacent to candidate's left
          if (Math.abs(cx2 - rx1) < threshold)
            edges.push('left');
          // current's left edge adjacent to candidate's right
          if (Math.abs(cx1 - rx2) < threshold)
            edges.push('right');
          // current's bottom edge adjacent to candidate's top
          if (Math.abs(cy2 - ry1) < threshold)
            edges.push('top');
          // current's top edge adjacent to candidate's bottom
          if (Math.abs(cy1 - ry2) < threshold)
            edges.push('bottom');

          if (edges.length > 0) {
            visited.add(candidateId);
            queue.push(candidateId);
            for (const edge of edges)
              results.push({ id: candidateId, edge, startX: r.x, startY: r.y, startW: r.width, startH: r.height });
          }
        }
      }

      return results;
    }
  }

  SZ.setupPointerHandlers = setupPointerHandlers;
})();
