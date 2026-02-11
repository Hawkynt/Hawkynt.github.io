;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  function setupPointerHandlers(windowArea, windowManager) {
    let dragState = null;

    windowArea.addEventListener('pointerdown', (e) => {
      const windowEl = e.target.closest('.sz-window');
      if (!windowEl)
        return;

      const windowId = windowEl.dataset.windowId;

      windowManager.focusWindow(windowId);

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
        if (!win || win.state === 'maximized')
          return;

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
          resizeDir: handle.dataset.resize,
        };
        windowArea.setPointerCapture(e.pointerId);
        return;
      }

      const titleBar = e.target.closest('.sz-title-bar');
      if (titleBar && !e.target.closest('.sz-title-buttons')) {
        e.preventDefault();
        const win = windowManager.getWindow(windowId);
        if (!win || win.state === 'maximized')
          return;

        const pos = win.getPosition();
        dragState = {
          windowId,
          startX: e.clientX,
          startY: e.clientY,
          startWinX: pos.x,
          startWinY: pos.y,
          mode: 'move',
        };
        windowArea.setPointerCapture(e.pointerId);
      }
    });

    windowArea.addEventListener('pointermove', (e) => {
      if (!dragState)
        return;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const win = windowManager.getWindow(dragState.windowId);
      if (!win) {
        dragState = null;
        return;
      }

      if (dragState.mode === 'move') {
        win.moveTo(dragState.startWinX + dx, dragState.startWinY + dy);
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
      }
    });

    windowArea.addEventListener('pointerup', (e) => {
      if (dragState) {
        try { windowArea.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        dragState = null;
      }
    });

    windowArea.addEventListener('dblclick', (e) => {
      const titleBar = e.target.closest('.sz-title-bar');
      if (!titleBar || e.target.closest('.sz-title-buttons'))
        return;

      const windowEl = e.target.closest('.sz-window');
      if (!windowEl)
        return;

      windowManager.maximizeWindow(windowEl.dataset.windowId);
    });
  }

  SZ.setupPointerHandlers = setupPointerHandlers;
})();
