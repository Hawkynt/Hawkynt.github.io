;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const MAX_UNDO = 20;
  const PALETTE_COLORS = [
    '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
    '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff',
    '#ffff80', '#00ff80', '#80ffff', '#0080ff', '#ff0080', '#ff8000'
  ];

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let currentTool = 'pencil';
  let fgColor = '#000000';
  let bgColor = '#ffffff';
  let lineWidth = 1;
  let fillMode = 'outline';
  let zoom = 1;
  let dirty = false;
  let currentFilePath = null;
  let currentFileName = 'Untitled';

  const undoStack = [];
  let redoStack = [];

  let isDrawing = false;
  let drawButton = 0;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  let selectionData = null;
  let selectionX = 0;
  let selectionY = 0;
  let selDragOffX = 0;
  let selDragOffY = 0;
  let isDraggingSelection = false;

  // -----------------------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------------------
  const menuBar = document.getElementById('menu-bar');
  const canvas = document.getElementById('main-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const overlay = document.getElementById('overlay-canvas');
  const octx = overlay.getContext('2d');
  const selCanvas = document.getElementById('selection-canvas');
  const sctx = selCanvas.getContext('2d');
  const container = document.getElementById('canvas-container');
  const canvasArea = document.getElementById('canvas-area');
  const textOverlay = document.getElementById('text-overlay');
  const textInput = document.getElementById('text-input');
  const activeFg = document.getElementById('active-fg');
  const activeBg = document.getElementById('active-bg');
  const statusPos = document.getElementById('status-pos');
  const statusSize = document.getElementById('status-size');

  let openMenu = null;

  // -----------------------------------------------------------------------
  // Init canvas
  // -----------------------------------------------------------------------
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  octx.imageSmoothingEnabled = false;

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - Paint';
    document.title = title;
    User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Undo / Redo
  // -----------------------------------------------------------------------
  function pushUndo() {
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.length > MAX_UNDO)
      undoStack.shift();
    redoStack = [];
  }

  function doUndo() {
    if (undoStack.length === 0)
      return;
    redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const state = undoStack.pop();
    canvas.width = state.width;
    canvas.height = state.height;
    syncOverlaySize();
    ctx.putImageData(state, 0, 0);
    dirty = true;
    updateTitle();
    updateStatusSize();
  }

  function doRedo() {
    if (redoStack.length === 0)
      return;
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    const state = redoStack.pop();
    canvas.width = state.width;
    canvas.height = state.height;
    syncOverlaySize();
    ctx.putImageData(state, 0, 0);
    dirty = true;
    updateTitle();
    updateStatusSize();
  }

  // -----------------------------------------------------------------------
  // Zoom
  // -----------------------------------------------------------------------
  function setZoom(z) {
    zoom = z;
    canvas.style.width = (canvas.width * zoom) + 'px';
    canvas.style.height = (canvas.height * zoom) + 'px';
    overlay.style.width = (canvas.width * zoom) + 'px';
    overlay.style.height = (canvas.height * zoom) + 'px';
  }

  function syncOverlaySize() {
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    setZoom(zoom);
  }

  // -----------------------------------------------------------------------
  // Color palette
  // -----------------------------------------------------------------------
  function updateActiveColors() {
    activeFg.style.background = fgColor;
    activeBg.style.background = bgColor;
  }

  function buildPalette() {
    const grid = document.getElementById('color-grid');
    grid.innerHTML = '';
    for (const color of PALETTE_COLORS) {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.background = color;
      swatch.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (e.button === 2)
          bgColor = color;
        else
          fgColor = color;
        updateActiveColors();
      });
      swatch.addEventListener('contextmenu', (e) => e.preventDefault());
      grid.appendChild(swatch);
    }
  }

  buildPalette();
  updateActiveColors();

  // -----------------------------------------------------------------------
  // Tool selection
  // -----------------------------------------------------------------------
  for (const btn of document.querySelectorAll('.tool-btn[data-tool]')) {
    btn.addEventListener('pointerdown', () => {
      commitText();
      commitSelection();
      for (const b of document.querySelectorAll('.tool-btn'))
        b.classList.remove('active');
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    });
  }

  // -----------------------------------------------------------------------
  // Line width selection
  // -----------------------------------------------------------------------
  for (const btn of document.querySelectorAll('.line-width-btn[data-width]')) {
    btn.addEventListener('pointerdown', () => {
      for (const b of document.querySelectorAll('.line-width-btn'))
        b.classList.remove('active');
      btn.classList.add('active');
      lineWidth = parseInt(btn.dataset.width, 10);
    });
  }

  // -----------------------------------------------------------------------
  // Fill mode toggle
  // -----------------------------------------------------------------------
  for (const btn of document.querySelectorAll('.fill-btn[data-fill]')) {
    btn.addEventListener('pointerdown', () => {
      for (const b of document.querySelectorAll('.fill-btn'))
        b.classList.remove('active');
      btn.classList.add('active');
      fillMode = btn.dataset.fill;
    });
  }

  // -----------------------------------------------------------------------
  // Menu system
  // -----------------------------------------------------------------------
  function closeMenus() {
    for (const item of menuBar.querySelectorAll('.menu-item'))
      item.classList.remove('open');
    openMenu = null;
  }

  for (const menuItem of menuBar.querySelectorAll('.menu-item')) {
    menuItem.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.menu-entry') || e.target.closest('.menu-separator'))
        return;
      if (openMenu === menuItem) {
        closeMenus();
        return;
      }
      closeMenus();
      menuItem.classList.add('open');
      openMenu = menuItem;
    });
    menuItem.addEventListener('pointerenter', () => {
      if (openMenu && openMenu !== menuItem) {
        closeMenus();
        menuItem.classList.add('open');
        openMenu = menuItem;
      }
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !menuBar.contains(e.target))
      closeMenus();
  });

  for (const entry of document.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.action;
      closeMenus();
      handleAction(action);
    });
  }

  // -----------------------------------------------------------------------
  // Menu actions
  // -----------------------------------------------------------------------
  function handleAction(action) {
    switch (action) {
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'exit': doExit(); break;
      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'clear': doClear(); break;
      case 'zoom-1': setZoom(1); break;
      case 'zoom-2': setZoom(2); break;
      case 'zoom-4': setZoom(4); break;
      case 'zoom-8': setZoom(8); break;
      case 'flip-h': doFlipH(); break;
      case 'flip-v': doFlipV(); break;
      case 'rotate-cw': doRotateCW(); break;
      case 'rotate-ccw': doRotateCCW(); break;
      case 'resize': doResize(); break;
      case 'about': showDialog('dlg-about'); break;
    }
  }

  // -----------------------------------------------------------------------
  // Canvas coordinate helpers
  // -----------------------------------------------------------------------
  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / zoom),
      y: Math.floor((e.clientY - rect.top) / zoom)
    };
  }

  function getDrawColor(button) {
    return button === 2 ? bgColor : fgColor;
  }

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------
  function updateStatusPos(x, y) {
    statusPos.textContent = x + ', ' + y + ' px';
  }

  function updateStatusSize() {
    statusSize.textContent = canvas.width + ' x ' + canvas.height;
  }

  // -----------------------------------------------------------------------
  // Drawing helpers
  // -----------------------------------------------------------------------
  function setupCtx(context, color, width) {
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }

  function drawLine(context, x1, y1, x2, y2) {
    context.beginPath();
    context.moveTo(x1 + 0.5, y1 + 0.5);
    context.lineTo(x2 + 0.5, y2 + 0.5);
    context.stroke();
  }

  function drawRect(context, x1, y1, x2, y2, filled) {
    const lx = Math.min(x1, x2);
    const ly = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (filled)
      context.fillRect(lx, ly, w, h);
    else
      context.strokeRect(lx + 0.5, ly + 0.5, w, h);
  }

  function drawEllipse(context, x1, y1, x2, y2, filled) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    context.beginPath();
    context.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
    if (filled)
      context.fill();
    else
      context.stroke();
  }

  // -----------------------------------------------------------------------
  // Flood fill (scanline)
  // -----------------------------------------------------------------------
  function floodFill(sx, sy, fillColor) {
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const idx = (sy * w + sx) * 4;
    const tr = data[idx];
    const tg = data[idx + 1];
    const tb = data[idx + 2];
    const ta = data[idx + 3];

    const tmp = document.createElement('canvas');
    tmp.width = 1;
    tmp.height = 1;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = fillColor;
    tctx.fillRect(0, 0, 1, 1);
    const fc = tctx.getImageData(0, 0, 1, 1).data;
    const fr = fc[0], fg2 = fc[1], fb = fc[2], fa = fc[3];

    if (tr === fr && tg === fg2 && tb === fb && ta === fa)
      return;

    const tolerance = 0;

    function matchTarget(i) {
      return Math.abs(data[i] - tr) <= tolerance
        && Math.abs(data[i + 1] - tg) <= tolerance
        && Math.abs(data[i + 2] - tb) <= tolerance
        && Math.abs(data[i + 3] - ta) <= tolerance;
    }

    function setPixel(i) {
      data[i] = fr;
      data[i + 1] = fg2;
      data[i + 2] = fb;
      data[i + 3] = fa;
    }

    const stack = [[sx, sy]];
    const visited = new Uint8Array(w * h);

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      let pi = cy * w + cx;
      if (visited[pi])
        continue;

      let i4 = pi * 4;
      if (!matchTarget(i4))
        continue;

      let lx = cx;
      while (lx > 0 && matchTarget(((cy * w) + (lx - 1)) * 4))
        --lx;

      let rx = cx;
      while (rx < w - 1 && matchTarget(((cy * w) + (rx + 1)) * 4))
        ++rx;

      for (let x = lx; x <= rx; ++x) {
        const si = (cy * w + x) * 4;
        setPixel(si);
        visited[cy * w + x] = 1;
      }

      for (let x = lx; x <= rx; ++x) {
        if (cy > 0 && !visited[(cy - 1) * w + x] && matchTarget(((cy - 1) * w + x) * 4))
          stack.push([x, cy - 1]);
        if (cy < h - 1 && !visited[(cy + 1) * w + x] && matchTarget(((cy + 1) * w + x) * 4))
          stack.push([x, cy + 1]);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // -----------------------------------------------------------------------
  // Text tool
  // -----------------------------------------------------------------------
  function showTextInput(x, y) {
    textOverlay.style.display = 'block';
    textOverlay.style.left = (x * zoom) + 'px';
    textOverlay.style.top = (y * zoom) + 'px';
    textInput.value = '';
    textInput.style.color = fgColor;
    textInput.style.fontSize = Math.max(12, 14 * zoom) + 'px';
    textInput.focus();
  }

  function commitText() {
    if (textOverlay.style.display === 'none' || !textInput.value.trim()) {
      textOverlay.style.display = 'none';
      return;
    }
    pushUndo();
    const x = parseInt(textOverlay.style.left, 10) / zoom;
    const y = parseInt(textOverlay.style.top, 10) / zoom;
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = fgColor;
    ctx.textBaseline = 'top';
    const lines = textInput.value.split('\n');
    for (let i = 0; i < lines.length; ++i)
      ctx.fillText(lines[i], x, y + i * 16);
    textOverlay.style.display = 'none';
    textInput.value = '';
    dirty = true;
    updateTitle();
  }

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      textOverlay.style.display = 'none';
      textInput.value = '';
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      commitText();
    }
  });

  // -----------------------------------------------------------------------
  // Selection tool
  // -----------------------------------------------------------------------
  function commitSelection() {
    if (!selectionData)
      return;
    pushUndo();
    ctx.drawImage(selCanvas, selectionX, selectionY);
    selCanvas.style.display = 'none';
    selectionData = null;
    dirty = true;
    updateTitle();
  }

  // -----------------------------------------------------------------------
  // Canvas pointer events
  // -----------------------------------------------------------------------
  container.addEventListener('pointerdown', (e) => {
    if (e.target === textInput)
      return;

    const { x, y } = canvasCoords(e);
    drawButton = e.button;
    const color = getDrawColor(drawButton);

    if (currentTool === 'select' && selectionData) {
      const sx = selectionX * zoom;
      const sy = selectionY * zoom;
      const sw = selCanvas.width * zoom;
      const sh = selCanvas.height * zoom;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (mx >= sx && mx < sx + sw && my >= sy && my < sy + sh) {
        isDraggingSelection = true;
        selDragOffX = x - selectionX;
        selDragOffY = y - selectionY;
        container.setPointerCapture(e.pointerId);
        return;
      }
      commitSelection();
    }

    isDrawing = true;
    startX = x;
    startY = y;
    lastX = x;
    lastY = y;

    container.setPointerCapture(e.pointerId);

    if (currentTool === 'pencil' || currentTool === 'eraser') {
      pushUndo();
      const c = currentTool === 'eraser' ? bgColor : color;
      setupCtx(ctx, c, currentTool === 'eraser' ? lineWidth * 3 : lineWidth);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y + 0.5);
      ctx.lineTo(x + 0.5, y + 0.5);
      ctx.stroke();
      dirty = true;
      updateTitle();
    }

    if (currentTool === 'fill') {
      pushUndo();
      floodFill(
        Math.max(0, Math.min(x, canvas.width - 1)),
        Math.max(0, Math.min(y, canvas.height - 1)),
        color
      );
      isDrawing = false;
      dirty = true;
      updateTitle();
    }

    if (currentTool === 'picker') {
      const px = ctx.getImageData(
        Math.max(0, Math.min(x, canvas.width - 1)),
        Math.max(0, Math.min(y, canvas.height - 1)),
        1, 1
      ).data;
      const picked = '#' + ((1 << 24) + (px[0] << 16) + (px[1] << 8) + px[2]).toString(16).slice(1);
      if (drawButton === 2)
        bgColor = picked;
      else
        fgColor = picked;
      updateActiveColors();
      isDrawing = false;
    }

    if (currentTool === 'text') {
      commitText();
      showTextInput(x, y);
      isDrawing = false;
    }
  });

  container.addEventListener('pointermove', (e) => {
    const { x, y } = canvasCoords(e);
    updateStatusPos(
      Math.max(0, Math.min(x, canvas.width - 1)),
      Math.max(0, Math.min(y, canvas.height - 1))
    );

    if (isDraggingSelection) {
      selectionX = x - selDragOffX;
      selectionY = y - selDragOffY;
      selCanvas.style.left = (selectionX * zoom) + 'px';
      selCanvas.style.top = (selectionY * zoom) + 'px';
      return;
    }

    if (!isDrawing)
      return;

    const color = getDrawColor(drawButton);

    if (currentTool === 'pencil' || currentTool === 'eraser') {
      const c = currentTool === 'eraser' ? bgColor : color;
      setupCtx(ctx, c, currentTool === 'eraser' ? lineWidth * 3 : lineWidth);
      drawLine(ctx, lastX, lastY, x, y);
      lastX = x;
      lastY = y;
    }

    if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'ellipse' || currentTool === 'select') {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      setupCtx(octx, color, lineWidth);
      const filled = fillMode === 'filled';

      if (currentTool === 'line')
        drawLine(octx, startX, startY, x, y);
      else if (currentTool === 'rect')
        drawRect(octx, startX, startY, x, y, filled);
      else if (currentTool === 'ellipse')
        drawEllipse(octx, startX, startY, x, y, filled);
      else if (currentTool === 'select') {
        octx.setLineDash([4, 4]);
        octx.strokeStyle = '#000';
        octx.lineWidth = 1;
        const lx = Math.min(startX, x);
        const ly = Math.min(startY, y);
        const w = Math.abs(x - startX);
        const h = Math.abs(y - startY);
        octx.strokeRect(lx + 0.5, ly + 0.5, w, h);
        octx.setLineDash([]);
      }
    }

    if (currentTool === 'picker') {
      const px = ctx.getImageData(
        Math.max(0, Math.min(x, canvas.width - 1)),
        Math.max(0, Math.min(y, canvas.height - 1)),
        1, 1
      ).data;
      const picked = '#' + ((1 << 24) + (px[0] << 16) + (px[1] << 8) + px[2]).toString(16).slice(1);
      if (drawButton === 2)
        bgColor = picked;
      else
        fgColor = picked;
      updateActiveColors();
    }
  });

  container.addEventListener('pointerup', (e) => {
    if (isDraggingSelection) {
      isDraggingSelection = false;
      container.releasePointerCapture(e.pointerId);
      return;
    }

    if (!isDrawing)
      return;
    isDrawing = false;
    container.releasePointerCapture(e.pointerId);

    const { x, y } = canvasCoords(e);
    const color = getDrawColor(drawButton);

    if (currentTool === 'line') {
      pushUndo();
      setupCtx(ctx, color, lineWidth);
      drawLine(ctx, startX, startY, x, y);
      octx.clearRect(0, 0, overlay.width, overlay.height);
      dirty = true;
      updateTitle();
    }

    if (currentTool === 'rect') {
      pushUndo();
      setupCtx(ctx, color, lineWidth);
      drawRect(ctx, startX, startY, x, y, fillMode === 'filled');
      octx.clearRect(0, 0, overlay.width, overlay.height);
      dirty = true;
      updateTitle();
    }

    if (currentTool === 'ellipse') {
      pushUndo();
      setupCtx(ctx, color, lineWidth);
      drawEllipse(ctx, startX, startY, x, y, fillMode === 'filled');
      octx.clearRect(0, 0, overlay.width, overlay.height);
      dirty = true;
      updateTitle();
    }

    if (currentTool === 'select') {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      const lx = Math.min(startX, x);
      const ly = Math.min(startY, y);
      const w = Math.abs(x - startX);
      const h = Math.abs(y - startY);
      if (w > 1 && h > 1) {
        pushUndo();
        selectionData = ctx.getImageData(lx, ly, w, h);
        selCanvas.width = w;
        selCanvas.height = h;
        selCanvas.style.width = (w * zoom) + 'px';
        selCanvas.style.height = (h * zoom) + 'px';
        sctx.putImageData(selectionData, 0, 0);
        selectionX = lx;
        selectionY = ly;
        selCanvas.style.left = (lx * zoom) + 'px';
        selCanvas.style.top = (ly * zoom) + 'px';
        selCanvas.style.display = 'block';

        ctx.fillStyle = bgColor;
        ctx.fillRect(lx, ly, w, h);
        dirty = true;
        updateTitle();
      }
    }
  });

  container.addEventListener('contextmenu', (e) => e.preventDefault());

  // -----------------------------------------------------------------------
  // Zoom via Ctrl+Scroll
  // -----------------------------------------------------------------------
  canvasArea.addEventListener('wheel', (e) => {
    if (!e.ctrlKey)
      return;
    e.preventDefault();
    const levels = [1, 2, 4, 8];
    let idx = levels.indexOf(zoom);
    if (idx === -1)
      idx = 0;
    if (e.deltaY < 0)
      idx = Math.min(idx + 1, levels.length - 1);
    else
      idx = Math.max(idx - 1, 0);
    setZoom(levels[idx]);
  }, { passive: false });

  // -----------------------------------------------------------------------
  // Image operations
  // -----------------------------------------------------------------------
  function doFlipH() {
    pushUndo();
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext('2d');
    tctx.putImageData(imgData, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    dirty = true;
    updateTitle();
  }

  function doFlipV() {
    pushUndo();
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext('2d');
    tctx.putImageData(imgData, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    dirty = true;
    updateTitle();
  }

  function doRotateCW() {
    pushUndo();
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext('2d');
    tctx.putImageData(imgData, 0, 0);

    const oldW = canvas.width;
    const oldH = canvas.height;
    canvas.width = oldH;
    canvas.height = oldW;
    syncOverlaySize();
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    dirty = true;
    updateTitle();
    updateStatusSize();
  }

  function doRotateCCW() {
    pushUndo();
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext('2d');
    tctx.putImageData(imgData, 0, 0);

    const oldW = canvas.width;
    const oldH = canvas.height;
    canvas.width = oldH;
    canvas.height = oldW;
    syncOverlaySize();
    ctx.save();
    ctx.translate(0, canvas.height);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    dirty = true;
    updateTitle();
    updateStatusSize();
  }

  function doResize() {
    const wInput = document.getElementById('resize-w');
    const hInput = document.getElementById('resize-h');
    wInput.value = canvas.width;
    hInput.value = canvas.height;
    const dlgOverlay = document.getElementById('dlg-resize');
    dlgOverlay.classList.add('visible');
    wInput.focus();
    wInput.select();

    awaitDialogResult(dlgOverlay, (result) => {
      if (result !== 'ok')
        return;
      let nw = parseInt(wInput.value, 10);
      let nh = parseInt(hInput.value, 10);
      if (isNaN(nw) || nw < 1) nw = 1;
      if (isNaN(nh) || nh < 1) nh = 1;
      if (nw > 4096) nw = 4096;
      if (nh > 4096) nh = 4096;
      if (nw === canvas.width && nh === canvas.height)
        return;

      pushUndo();
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tctx = tmp.getContext('2d');
      tctx.putImageData(imgData, 0, 0);

      canvas.width = nw;
      canvas.height = nh;
      syncOverlaySize();
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, nw, nh);
      ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, nw, nh);
      dirty = true;
      updateTitle();
      updateStatusSize();
    });
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
  function doNew() {
    commitText();
    commitSelection();
    pushUndo();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    updateTitle();
  }

  function doClear() {
    commitText();
    commitSelection();
    pushUndo();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    dirty = true;
    updateTitle();
  }

  async function doOpen() {
    commitText();
    commitSelection();
    const result = await ComDlg32.GetOpenFileName({
      filters: [
        { name: 'Images', ext: ['png', 'bmp', 'jpg', 'gif'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      title: 'Open',
    });
    if (!result.cancelled && result.path)
      loadFile(result.path, result.content);
  }

  async function loadFile(path, contentArg) {
    let content = contentArg;
    if (content == null) {
      try {
        content = await Kernel32.ReadFile(path);
      } catch (err) {
        alert('Could not open file: ' + err.message);
        return;
      }
      content = content != null ? String(content) : '';
    } else
      content = String(content);

    if (!content.startsWith('data:image')) {
      alert('Not a valid image file.');
      return;
    }
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      syncOverlaySize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      currentFilePath = path;
      const parts = path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';
      dirty = false;
      undoStack.length = 0;
      redoStack = [];
      updateTitle();
      updateStatusSize();
    };
    img.onerror = () => alert('Could not decode image.');
    img.src = content;
  }

  function doSave(callback) {
    commitText();
    commitSelection();
    if (!currentFilePath) {
      doSaveAs(callback);
      return;
    }
    saveToPath(currentFilePath, callback);
  }

  async function doSaveAs(callback) {
    const dataUrl = canvas.toDataURL('image/png');
    const result = await ComDlg32.GetSaveFileName({
      filters: [
        { name: 'Images', ext: ['png', 'bmp', 'jpg', 'gif'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      defaultName: currentFileName || 'Untitled.png',
      title: 'Save As',
      content: dataUrl,
    });
    if (!result.cancelled && result.path) {
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';
      dirty = false;
      updateTitle();
      if (typeof callback === 'function')
        callback();
    }
  }

  async function saveToPath(path, callback) {
    const dataUrl = canvas.toDataURL('image/png');
    try {
      await Kernel32.WriteFile(path, dataUrl);
    } catch (err) {
      alert('Could not save file: ' + err.message);
      return;
    }
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    updateTitle();
    if (typeof callback === 'function')
      callback();
  }

  function doExit() {
    User32.DestroyWindow();
  }

  // -----------------------------------------------------------------------
  // Dialog helpers
  // -----------------------------------------------------------------------
  function showDialog(id) {
    const dlgOverlay = document.getElementById(id);
    dlgOverlay.classList.add('visible');
    awaitDialogResult(dlgOverlay);
  }

  function awaitDialogResult(dlgOverlay, callback) {
    function handleClick(e) {
      const btn = e.target.closest('[data-result]');
      if (!btn)
        return;
      dlgOverlay.classList.remove('visible');
      dlgOverlay.removeEventListener('click', handleClick);
      if (typeof callback === 'function')
        callback(btn.dataset.result);
    }
    dlgOverlay.addEventListener('click', handleClick);
  }

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === textInput && !e.ctrlKey)
      return;

    if (!e.ctrlKey)
      return;

    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        handleAction('new');
        break;
      case 'o':
        e.preventDefault();
        handleAction('open');
        break;
      case 's':
        e.preventDefault();
        handleAction('save');
        break;
      case 'z':
        e.preventDefault();
        handleAction('undo');
        break;
      case 'y':
        e.preventDefault();
        handleAction('redo');
        break;
      case '1':
        e.preventDefault();
        setZoom(1);
        break;
      case '2':
        e.preventDefault();
        setZoom(2);
        break;
      case '3':
        e.preventDefault();
        setZoom(4);
        break;
      case '4':
        e.preventDefault();
        setZoom(8);
        break;
    }
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  updateTitle();
  updateStatusSize();
  setZoom(1);
})();
