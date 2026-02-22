;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;
  const { LayerModel, BLEND_MODES, Tools, SelectionEngine, Adjustments, Effects, ImageAnalysis, openEffectDialog, applyEffectToLayer, cloneImageData } = window.PaintApp;

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const MAX_UNDO = 30;
  const PALETTE_COLORS = [
    '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
    '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff',
    '#ffff80', '#00ff80', '#80ffff', '#0080ff', '#ff0080', '#ff8000'
  ];

  // Logarithmic slider mapping: slider 0..1000 ↔ zoom 0.25x..256x
  // zoom = 0.25 * (1024)^(slider/1000)  →  slider = 1000 * log(zoom/0.25) / log(1024)
  const ZOOM_MIN = 0.25, ZOOM_MAX = 256;
  const _LOG_RANGE = Math.log(ZOOM_MAX / ZOOM_MIN);

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let currentTool = 'pencil';
  let fgColor = '#000000';
  let bgColor = '#ffffff';
  let brushSize = 1;
  let brushShape = 'round';
  let fillMode = 'outline';
  let gradientMode = 'linear';
  let cornerRadius = 10;
  let tolerance = 32;
  let zoom = 1;
  let dirty = false;
  let currentFilePath = null;
  let currentFileName = 'Untitled';
  let showPixelGrid = false;

  const undoStack = [];
  let redoStack = [];

  let isDrawing = false;
  let drawButton = 0;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  // -----------------------------------------------------------------------
  // Modules
  // -----------------------------------------------------------------------
  const layerModel = new LayerModel();
  const selection = new SelectionEngine();

  // -----------------------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------------------
  const displayCanvas = document.getElementById('display-canvas');
  const displayCtx = displayCanvas.getContext('2d', { willReadFrequently: true });
  const overlay = document.getElementById('overlay-canvas');
  const octx = overlay.getContext('2d');
  const container = document.getElementById('canvas-container');
  const canvasArea = document.getElementById('canvas-area');
  const textOverlay = document.getElementById('text-overlay');
  const textInput = document.getElementById('text-input');
  const fgSwatch = document.getElementById('fg-swatch');
  const bgSwatch = document.getElementById('bg-swatch');
  const statusPos = document.getElementById('status-pos');
  const statusSize = document.getElementById('status-size');
  const statusZoomCtrl = new SZ.ZoomControl(document.getElementById('status-zoom-ctrl'), {
    min: 0, max: 1000, step: 1, value: _zoomToSlider(1),
    formatLabel: s => Math.round(_sliderToZoom(s) * 100) + '%',
    parseLabel: text => {
      const val = parseInt(text, 10);
      if (isNaN(val) || val < 25 || val > 25600) return null;
      return _zoomToSlider(val / 100);
    },
    onChange: s => setZoom(_sliderToZoom(s)),
    onZoomIn: () => setZoom(zoom * 1.25),
    onZoomOut: () => setZoom(zoom / 1.25),
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  layerModel.init(640, 480);
  selection.init(640, 480);
  displayCtx.imageSmoothingEnabled = false;
  octx.imageSmoothingEnabled = false;
  compositeAndDisplay();

  layerModel.onChange = () => {
    compositeAndDisplay();
    refreshLayerPanel();
  };

  // -----------------------------------------------------------------------
  // Display compositing
  // -----------------------------------------------------------------------
  function compositeAndDisplay() {
    displayCanvas.width = layerModel.width;
    displayCanvas.height = layerModel.height;
    overlay.width = layerModel.width;
    overlay.height = layerModel.height;
    displayCtx.imageSmoothingEnabled = false;
    octx.imageSmoothingEnabled = false;
    layerModel.compositeToDisplay(displayCtx);
    setZoom(zoom);
  }

  function _zoomToSlider(z) { return Math.round(1000 * Math.log(z / ZOOM_MIN) / _LOG_RANGE); }
  function _sliderToZoom(s) { return ZOOM_MIN * Math.exp(s / 1000 * _LOG_RANGE); }

  function setZoom(z) {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    const w = layerModel.width, h = layerModel.height;
    displayCanvas.style.width = (w * zoom) + 'px';
    displayCanvas.style.height = (h * zoom) + 'px';
    overlay.style.width = (w * zoom) + 'px';
    overlay.style.height = (h * zoom) + 'px';
    const label = Math.round(zoom * 100) + '%';
    const sliderPos = _zoomToSlider(zoom);
    statusZoomCtrl.value = sliderPos;
    const zoomSlider = document.getElementById('rb-zoom-slider');
    if (zoomSlider) zoomSlider.value = sliderPos;
    const zoomVal = document.getElementById('rb-zoom-value');
    if (zoomVal) zoomVal.textContent = label;
    drawPixelGrid();
  }

  function drawPixelGrid() {
    if (showPixelGrid && zoom >= 4) {
      overlay.style.backgroundImage =
        'linear-gradient(to right, rgba(0,0,0,0.25) 1px, transparent 1px),' +
        'linear-gradient(to bottom, rgba(0,0,0,0.25) 1px, transparent 1px)';
      overlay.style.backgroundSize = zoom + 'px ' + zoom + 'px';
    } else {
      overlay.style.backgroundImage = '';
      overlay.style.backgroundSize = '';
    }
  }

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - Paint';
    document.title = title;
    User32.SetWindowText(title);
  }

  function updateStatusSize() {
    statusSize.textContent = layerModel.width + ' x ' + layerModel.height;
  }

  function updateStatusPos(x, y) {
    statusPos.textContent = x + ', ' + y + ' px';
  }

  // -----------------------------------------------------------------------
  // Undo / Redo (layer-aware)
  // -----------------------------------------------------------------------
  function pushUndo(structural) {
    if (structural)
      undoStack.push({ type: 'structural', state: layerModel.serializeAll() });
    else
      undoStack.push({
        type: 'draw',
        layerIndex: layerModel.activeIndex,
        imageData: layerModel.serializeLayer(layerModel.activeIndex)
      });
    if (undoStack.length > MAX_UNDO)
      undoStack.shift();
    redoStack = [];
  }

  function pushUndoStructural() { pushUndo(true); }

  function doUndo() {
    if (undoStack.length === 0)
      return;
    const entry = undoStack.pop();
    if (entry.type === 'structural') {
      redoStack.push({ type: 'structural', state: layerModel.serializeAll() });
      layerModel.restoreAll(entry.state);
      selection.init(layerModel.width, layerModel.height);
    } else {
      redoStack.push({
        type: 'draw',
        layerIndex: entry.layerIndex,
        imageData: layerModel.serializeLayer(entry.layerIndex)
      });
      layerModel.restoreLayer(entry.layerIndex, entry.imageData);
    }
    compositeAndDisplay();
    refreshLayerPanel();
    dirty = true;
    updateTitle();
    updateStatusSize();
  }

  function doRedo() {
    if (redoStack.length === 0)
      return;
    const entry = redoStack.pop();
    if (entry.type === 'structural') {
      undoStack.push({ type: 'structural', state: layerModel.serializeAll() });
      layerModel.restoreAll(entry.state);
      selection.init(layerModel.width, layerModel.height);
    } else {
      undoStack.push({
        type: 'draw',
        layerIndex: entry.layerIndex,
        imageData: layerModel.serializeLayer(entry.layerIndex)
      });
      layerModel.restoreLayer(entry.layerIndex, entry.imageData);
    }
    compositeAndDisplay();
    refreshLayerPanel();
    dirty = true;
    updateTitle();
    updateStatusSize();
  }

  // -----------------------------------------------------------------------
  // Color palette
  // -----------------------------------------------------------------------
  function updateActiveColors() {
    fgSwatch.style.background = fgColor;
    bgSwatch.style.background = bgColor;
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

  // Swap colors button
  document.getElementById('swap-colors').addEventListener('click', () => {
    const tmp = fgColor;
    fgColor = bgColor;
    bgColor = tmp;
    updateActiveColors();
  });

  // -----------------------------------------------------------------------
  // Layer panel
  // -----------------------------------------------------------------------
  function buildBlendModeDropdown() {
    const sel = document.getElementById('layer-blend');
    sel.innerHTML = '';
    for (const m of BLEND_MODES) {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.label;
      sel.appendChild(opt);
    }
  }
  buildBlendModeDropdown();

  function refreshLayerPanel() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    const layers = layerModel.layers;
    // Render top-to-bottom (highest index first)
    for (let i = layers.length - 1; i >= 0; --i) {
      const layer = layers[i];
      const entry = document.createElement('div');
      entry.className = 'layer-entry' + (i === layerModel.activeIndex ? ' active' : '');
      entry.dataset.index = i;

      const eye = document.createElement('span');
      eye.className = 'layer-eye' + (layer.visible ? '' : ' hidden');
      eye.textContent = layer.visible ? '\u{1F441}' : '\u25CB';
      eye.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        compositeAndDisplay();
        refreshLayerPanel();
      });

      const thumb = document.createElement('canvas');
      thumb.className = 'layer-thumb';
      thumb.width = 48;
      thumb.height = 36;
      layerModel.renderThumbnail(i, thumb);

      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = layer.name;
      name.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.className = 'layer-name-input';
        input.value = layer.name;
        name.replaceWith(input);
        input.focus();
        input.select();
        const finish = () => {
          layer.name = input.value || layer.name;
          refreshLayerPanel();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') finish();
          if (ke.key === 'Escape') refreshLayerPanel();
        });
      });

      entry.appendChild(eye);
      entry.appendChild(thumb);
      entry.appendChild(name);
      entry.addEventListener('click', () => {
        layerModel.activeIndex = i;
        refreshLayerPanel();
        syncLayerProps();
      });
      list.appendChild(entry);
    }
    syncLayerProps();
  }

  function syncLayerProps() {
    const layer = layerModel.activeLayer;
    if (!layer)
      return;
    const opSlider = document.getElementById('layer-opacity');
    const opVal = document.getElementById('layer-opacity-val');
    const blendSel = document.getElementById('layer-blend');
    opSlider.value = Math.round(layer.opacity * 100);
    opVal.textContent = Math.round(layer.opacity * 100) + '%';
    blendSel.value = layer.blendMode;
  }

  document.getElementById('layer-opacity').addEventListener('input', (e) => {
    const layer = layerModel.activeLayer;
    if (!layer)
      return;
    layer.opacity = parseInt(e.target.value, 10) / 100;
    document.getElementById('layer-opacity-val').textContent = e.target.value + '%';
    compositeAndDisplay();
  });

  document.getElementById('layer-blend').addEventListener('change', (e) => {
    const layer = layerModel.activeLayer;
    if (!layer)
      return;
    layer.blendMode = e.target.value;
    compositeAndDisplay();
  });

  refreshLayerPanel();

  // -----------------------------------------------------------------------
  // Ribbon + Dialog shared wiring
  // -----------------------------------------------------------------------
  new SZ.Ribbon({ onAction: handleAction });
  SZ.Dialog.wireAll();

  // -----------------------------------------------------------------------
  // Tool selection (from tool grid and selection buttons)
  // -----------------------------------------------------------------------
  for (const btn of document.querySelectorAll('[data-tool]')) {
    btn.addEventListener('click', () => {
      commitText();
      cancelMultiClickTool();
      for (const b of document.querySelectorAll('[data-tool]'))
        b.classList.remove('active');
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    });
  }

  function cancelMultiClickTool() {
    const tool = Tools[currentTool];
    if (tool && tool.onCancel)
      tool.onCancel(getToolState());
  }

  // -----------------------------------------------------------------------
  // Ribbon control bindings
  // -----------------------------------------------------------------------
  const brushSizeSlider = document.getElementById('brush-size-slider');
  brushSizeSlider.addEventListener('input', () => {
    brushSize = parseInt(brushSizeSlider.value, 10);
    document.getElementById('brush-size-val').textContent = brushSize;
  });

  document.getElementById('fill-mode-select').addEventListener('change', (e) => {
    fillMode = e.target.value;
  });

  document.getElementById('brush-shape-select').addEventListener('change', (e) => {
    brushShape = e.target.value;
  });

  document.getElementById('gradient-mode-select').addEventListener('change', (e) => {
    gradientMode = e.target.value;
  });

  const cornerRadiusSlider = document.getElementById('corner-radius-slider');
  cornerRadiusSlider.addEventListener('input', () => {
    cornerRadius = parseInt(cornerRadiusSlider.value, 10);
    document.getElementById('corner-radius-val').textContent = cornerRadius;
  });

  const toleranceSlider = document.getElementById('tolerance-slider');
  toleranceSlider.addEventListener('input', () => {
    tolerance = parseInt(toleranceSlider.value, 10);
    document.getElementById('tolerance-val').textContent = tolerance;
  });

  // Zoom slider (ribbon)
  const zoomSlider = document.getElementById('rb-zoom-slider');
  if (zoomSlider) {
    zoomSlider.addEventListener('input', () => {
      setZoom(_sliderToZoom(parseInt(zoomSlider.value, 10)));
    });
  }

  // Pixel grid toggle
  document.getElementById('view-pixel-grid').addEventListener('change', (e) => {
    showPixelGrid = e.target.checked;
    container.classList.toggle('show-pixel-grid', showPixelGrid);
    drawPixelGrid();
  });

  // -----------------------------------------------------------------------
  // Tool state object (passed to tool handlers)
  // -----------------------------------------------------------------------
  function getToolState() {
    return {
      fgColor,
      bgColor,
      drawColor: drawButton === 2 ? bgColor : fgColor,
      brushSize,
      brushShape,
      fillMode,
      gradientMode,
      cornerRadius,
      tolerance,
      zoom,
      startX, startY,
      lastX, lastY,
      altKey: false,
      layerModel,
      selection,
      canvasArea,
      overlayCtx: octx,

      getActiveCtx: () => layerModel.getActiveCtx(),

      pushUndo: () => pushUndo(false),
      pushUndoStructural: () => pushUndo(true),

      setColor(color, button) {
        if (button === 2)
          bgColor = color;
        else
          fgColor = color;
        updateActiveColors();
      },

      showTextInput: (x, y) => showTextInput(x, y),

      selectRect(x, y, w, h) {
        const mode = getSelectionMode();
        selection.selectRect(x, y, w, h, mode);
        selection.startMarchingAnts(octx);
      },

      selectLasso(points) {
        const mode = getSelectionMode();
        selection.selectLasso(points, mode);
        selection.startMarchingAnts(octx);
      },

      selectMagicWand(x, y) {
        const mode = getSelectionMode();
        const imgData = layerModel.getActiveCtx().getImageData(0, 0, layerModel.width, layerModel.height);
        selection.selectMagicWand(x, y, tolerance, imgData, mode);
        selection.startMarchingAnts(octx);
      }
    };
  }

  function getSelectionMode() {
    // Shift+Alt = intersect, Shift = add, Alt = subtract, else replace
    return 'replace';
  }

  // -----------------------------------------------------------------------
  // Canvas coordinate helpers
  // -----------------------------------------------------------------------
  function canvasCoords(e) {
    const rect = displayCanvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / zoom),
      y: Math.floor((e.clientY - rect.top) / zoom),
      clientX: e.clientX,
      clientY: e.clientY,
      button: e.button
    };
  }

  // -----------------------------------------------------------------------
  // Canvas pointer events
  // -----------------------------------------------------------------------
  container.addEventListener('pointerdown', (e) => {
    if (e.target === textInput)
      return;

    const cx = canvasCoords(e);
    drawButton = e.button;
    startX = cx.x;
    startY = cx.y;
    lastX = cx.x;
    lastY = cx.y;

    const tool = Tools[currentTool];
    if (!tool)
      return;

    // Multi-click tools don't set isDrawing on subsequent clicks
    if (tool.isMultiClick && tool.isMultiClick()) {
      const state = getToolState();
      state.altKey = e.altKey;
      tool.onDown(cx, state);
      container.setPointerCapture(e.pointerId);
      return;
    }

    isDrawing = true;
    container.setPointerCapture(e.pointerId);

    const state = getToolState();
    state.altKey = e.altKey;
    tool.onDown(cx, state);

    // Immediate tools that don't need dragging
    if (currentTool === 'fill' || currentTool === 'text' || currentTool === 'magic-wand') {
      isDrawing = false;
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  });

  container.addEventListener('pointermove', (e) => {
    const cx = canvasCoords(e);
    updateStatusPos(
      Math.max(0, Math.min(cx.x, layerModel.width - 1)),
      Math.max(0, Math.min(cx.y, layerModel.height - 1))
    );

    const tool = Tools[currentTool];
    if (!tool)
      return;

    // Multi-click tools always get move events when active
    if (tool.isMultiClick && tool.isMultiClick()) {
      const state = getToolState();
      tool.onMove(cx, state);
      return;
    }

    if (!isDrawing)
      return;

    const state = getToolState();
    state.altKey = e.altKey;
    tool.onMove(cx, state);
    lastX = cx.x;
    lastY = cx.y;

    // Live composite for freehand tools
    if (currentTool === 'pencil' || currentTool === 'eraser' || currentTool === 'airbrush' ||
        currentTool === 'blur-brush' || currentTool === 'sharpen-brush' || currentTool === 'clone')
      compositeAndDisplay();
  });

  container.addEventListener('pointerup', (e) => {
    const tool = Tools[currentTool];
    if (!tool)
      return;

    if (tool.isMultiClick && tool.isMultiClick()) {
      container.releasePointerCapture(e.pointerId);
      return;
    }

    if (!isDrawing)
      return;
    isDrawing = false;
    container.releasePointerCapture(e.pointerId);

    const cx = canvasCoords(e);
    const state = getToolState();
    tool.onUp(cx, state);

    dirty = true;
    compositeAndDisplay();
    updateTitle();
    refreshLayerPanel();
  });

  container.addEventListener('dblclick', (e) => {
    const tool = Tools[currentTool];
    if (tool && tool.onDblClick) {
      const cx = canvasCoords(e);
      const state = getToolState();
      tool.onDblClick(cx, state);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
      refreshLayerPanel();
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
    if (e.deltaY < 0)
      setZoom(zoom * 1.25);
    else
      setZoom(zoom / 1.25);
  }, { passive: false });

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
    const ctx = layerModel.getActiveCtx();
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
    compositeAndDisplay();
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
  // Action dispatcher
  // -----------------------------------------------------------------------
  function handleAction(action) {
    switch (action) {
      // File
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'export-png': doExport('image/png'); break;
      case 'export-jpg': doExport('image/jpeg'); break;
      case 'exit': User32.DestroyWindow(); break;
      case 'about': SZ.Dialog.show('dlg-about'); break;

      // Edit
      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;

      // Clipboard
      case 'copy': doCopy(); break;
      case 'cut': doCut(); break;
      case 'paste': doPaste(); break;
      case 'paste-as-layer': doPasteAsLayer(); break;

      // Selection
      case 'select-all': selection.selectAll(); selection.startMarchingAnts(octx); break;
      case 'deselect': selection.clear(); octx.clearRect(0, 0, overlay.width, overlay.height); break;
      case 'invert-selection': selection.invert(); selection.startMarchingAnts(octx); break;

      // Image
      case 'flip-h': pushUndoStructural(); layerModel.flipAllH(); dirty = true; compositeAndDisplay(); updateTitle(); break;
      case 'flip-v': pushUndoStructural(); layerModel.flipAllV(); dirty = true; compositeAndDisplay(); updateTitle(); break;
      case 'rotate-cw': pushUndoStructural(); layerModel.rotateAllCW(); selection.init(layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); updateStatusSize(); break;
      case 'rotate-ccw': pushUndoStructural(); layerModel.rotateAllCCW(); selection.init(layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); updateStatusSize(); break;
      case 'rotate-180': pushUndoStructural(); layerModel.rotateAll180(); dirty = true; compositeAndDisplay(); updateTitle(); break;
      case 'resize': doResize(); break;
      case 'canvas-size': doCanvasSize(); break;
      case 'crop-to-selection': doCropToSelection(); break;
      case 'flatten-all': pushUndoStructural(); layerModel.flattenAll(); dirty = true; compositeAndDisplay(); refreshLayerPanel(); updateTitle(); break;
      case 'clear-layer': pushUndo(); layerModel.activeLayer.clear(); dirty = true; compositeAndDisplay(); updateTitle(); break;

      // Layers
      case 'layer-add': pushUndoStructural(); layerModel.addLayer(); refreshLayerPanel(); break;
      case 'layer-delete': pushUndoStructural(); layerModel.deleteLayer(); refreshLayerPanel(); compositeAndDisplay(); break;
      case 'layer-up': pushUndoStructural(); layerModel.moveLayer(layerModel.activeIndex, Math.min(layerModel.activeIndex + 1, layerModel.count - 1)); refreshLayerPanel(); compositeAndDisplay(); break;
      case 'layer-down': pushUndoStructural(); layerModel.moveLayer(layerModel.activeIndex, Math.max(layerModel.activeIndex - 1, 0)); refreshLayerPanel(); compositeAndDisplay(); break;
      case 'layer-duplicate': pushUndoStructural(); layerModel.duplicateLayer(); refreshLayerPanel(); compositeAndDisplay(); break;
      case 'layer-merge-down': pushUndoStructural(); layerModel.mergeDown(); refreshLayerPanel(); compositeAndDisplay(); break;

      // Zoom
      case 'zoom-100': setZoom(1); break;
      case 'zoom-200': setZoom(2); break;
      case 'zoom-400': setZoom(4); break;
      case 'zoom-800': setZoom(8); break;
      case 'zoom-in': setZoom(zoom * 1.25); break;
      case 'zoom-out': setZoom(zoom / 1.25); break;

      // Adjustments
      case 'adj-brightness': doAdjBrightness(); break;
      case 'adj-hue-sat': doAdjHueSat(); break;
      case 'adj-levels': doAdjLevels(); break;
      case 'adj-invert': pushUndo(); applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => Adjustments.invert(d), layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); break;
      case 'adj-grayscale': pushUndo(); applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => Adjustments.grayscale(d), layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); break;
      case 'adj-sepia': pushUndo(); applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => Adjustments.sepia(d), layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); break;
      case 'adj-auto-levels': pushUndo(); applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => Adjustments.autoLevels(d), layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); break;

      // Effects
      case 'fx-blur': doFxBlur(); break;
      case 'fx-sharpen': doFxSharpen(); break;
      case 'fx-noise': doFxNoise(); break;
      case 'fx-pixelate': doFxPixelate(); break;
      case 'fx-edge': pushUndo(); applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => Effects.edgeDetect(d), layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); break;
      case 'fx-emboss': pushUndo(); applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => Effects.emboss(d), layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); break;

      // Blurs
      case 'fx-motion-blur': doFxMotionBlur(); break;
      case 'fx-radial-blur': doFxRadialBlur(); break;
      case 'fx-surface-blur': doFxSurfaceBlur(); break;
      case 'fx-box-blur': doFxBoxBlur(); break;
      case 'fx-median': doFxMedian(); break;
      case 'fx-unsharp-mask': doFxUnsharpMask(); break;

      // Distort
      case 'fx-swirl': doFxSwirl(); break;
      case 'fx-spherize': doFxSpherize(); break;
      case 'fx-ripple': doFxRipple(); break;
      case 'fx-polar': pushUndo(); applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => Effects.polarCoordinates(d), layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); break;
      case 'fx-frosted-glass': doFxFrostedGlass(); break;

      // Stylize
      case 'fx-oil-paint': doFxOilPaint(); break;
      case 'fx-posterize': doFxPosterize(); break;
      case 'fx-threshold': doFxThreshold(); break;
      case 'fx-solarize': doFxSolarize(); break;
      case 'fx-relief': pushUndo(); applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => Effects.relief(d), layerModel.width, layerModel.height); dirty = true; compositeAndDisplay(); updateTitle(); break;
      case 'fx-pencil-sketch': doFxPencilSketch(); break;
      case 'fx-vignette': doFxVignette(); break;
      case 'fx-halftone': doFxHalftone(); break;
      case 'fx-crystallize': doFxCrystallize(); break;

      // Auto-Correct
      case 'auto-deskew': doAutoDeskew(); break;
      case 'auto-rotate': doAutoRotate(); break;
      case 'auto-keystone': doAutoKeystone(); break;
    }
  }

  // Wire up layer-panel action buttons (not covered by shared Ribbon)
  for (const btn of document.querySelectorAll('.layer-controls [data-action]'))
    btn.addEventListener('click', () => handleAction(btn.dataset.action));

  // -----------------------------------------------------------------------
  // Clipboard operations
  // -----------------------------------------------------------------------
  function doCopy() {
    selection.copyFromLayer(layerModel.getActiveCtx());
  }

  function doCut() {
    pushUndo();
    selection.cutFromLayer(layerModel.getActiveCtx());
    dirty = true;
    compositeAndDisplay();
    updateTitle();
  }

  function doPaste() {
    const data = selection.getPasteData();
    if (!data)
      return;
    pushUndo();
    const ctx = layerModel.getActiveCtx();
    const imgData = data.imageData || data;
    const x = data.x || 0;
    const y = data.y || 0;
    ctx.putImageData(imgData, x, y);
    dirty = true;
    compositeAndDisplay();
    updateTitle();
  }

  function doPasteAsLayer() {
    const data = selection.getPasteData();
    if (!data)
      return;
    pushUndoStructural();
    layerModel.addLayer('Pasted');
    const ctx = layerModel.getActiveCtx();
    const imgData = data.imageData || data;
    const x = data.x || 0;
    const y = data.y || 0;
    ctx.putImageData(imgData, x, y);
    dirty = true;
    compositeAndDisplay();
    refreshLayerPanel();
    updateTitle();
  }

  // -----------------------------------------------------------------------
  // Effect dialogs
  // -----------------------------------------------------------------------
  function getLayerImageData() {
    return layerModel.getActiveCtx().getImageData(0, 0, layerModel.width, layerModel.height);
  }

  async function doAdjBrightness() {
    resetDialogSliders('dlg-brightness');
    const result = await openEffectDialog('dlg-brightness', (imgData, vals) => {
      Adjustments.brightnessContrast(imgData, vals.brightness || 0, vals.contrast || 0);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Adjustments.brightnessContrast(d, result.values.brightness || 0, result.values.contrast || 0);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doAdjHueSat() {
    resetDialogSliders('dlg-hue-sat');
    const result = await openEffectDialog('dlg-hue-sat', (imgData, vals) => {
      Adjustments.hueSaturation(imgData, vals.hue || 0, vals.saturation || 0, vals.lightness || 0);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Adjustments.hueSaturation(d, result.values.hue || 0, result.values.saturation || 0, result.values.lightness || 0);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doAdjLevels() {
    resetDialogSliders('dlg-levels');
    const result = await openEffectDialog('dlg-levels', (imgData, vals) => {
      Adjustments.levels(imgData, vals.black || 0, vals.white || 255, (vals.gamma || 100) / 100);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Adjustments.levels(d, result.values.black || 0, result.values.white || 255, (result.values.gamma || 100) / 100);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxBlur() {
    resetDialogSliders('dlg-blur');
    const result = await openEffectDialog('dlg-blur', (imgData, vals) => {
      Effects.gaussianBlur(imgData, vals.radius || 3);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.gaussianBlur(d, result.values.radius || 3);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxSharpen() {
    resetDialogSliders('dlg-sharpen');
    const result = await openEffectDialog('dlg-sharpen', (imgData, vals) => {
      Effects.sharpen(imgData, vals.amount || 50);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.sharpen(d, result.values.amount || 50);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxNoise() {
    resetDialogSliders('dlg-noise');
    const result = await openEffectDialog('dlg-noise', (imgData, vals) => {
      Effects.addNoise(imgData, vals.amount || 20);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.addNoise(d, result.values.amount || 20);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxPixelate() {
    resetDialogSliders('dlg-pixelate');
    const result = await openEffectDialog('dlg-pixelate', (imgData, vals) => {
      Effects.pixelate(imgData, vals.size || 8);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.pixelate(d, result.values.size || 8);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxMotionBlur() {
    resetDialogSliders('dlg-motion-blur');
    const result = await openEffectDialog('dlg-motion-blur', (imgData, vals) => {
      Effects.motionBlur(imgData, vals.angle || 0, vals.distance || 10);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.motionBlur(d, result.values.angle || 0, result.values.distance || 10);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxRadialBlur() {
    resetDialogSliders('dlg-radial-blur');
    const result = await openEffectDialog('dlg-radial-blur', (imgData, vals) => {
      Effects.radialBlur(imgData, vals.amount || 10);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.radialBlur(d, result.values.amount || 10);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxSurfaceBlur() {
    resetDialogSliders('dlg-surface-blur');
    const result = await openEffectDialog('dlg-surface-blur', (imgData, vals) => {
      Effects.surfaceBlur(imgData, vals.radius || 5, vals.threshold || 30);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.surfaceBlur(d, result.values.radius || 5, result.values.threshold || 30);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxBoxBlur() {
    resetDialogSliders('dlg-box-blur');
    const result = await openEffectDialog('dlg-box-blur', (imgData, vals) => {
      Effects.boxBlur(imgData, vals.radius || 3);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.boxBlur(d, result.values.radius || 3);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxMedian() {
    resetDialogSliders('dlg-median');
    const result = await openEffectDialog('dlg-median', (imgData, vals) => {
      Effects.median(imgData, vals.radius || 1);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.median(d, result.values.radius || 1);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxUnsharpMask() {
    resetDialogSliders('dlg-unsharp-mask');
    const result = await openEffectDialog('dlg-unsharp-mask', (imgData, vals) => {
      Effects.unsharpMask(imgData, vals.amount || 150, vals.radius || 2, vals.threshold || 4);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.unsharpMask(d, result.values.amount || 150, result.values.radius || 2, result.values.threshold || 4);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxSwirl() {
    resetDialogSliders('dlg-swirl');
    const result = await openEffectDialog('dlg-swirl', (imgData, vals) => {
      Effects.swirl(imgData, vals.angle || 60, vals.radius || 100);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.swirl(d, result.values.angle || 60, result.values.radius || 100);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxSpherize() {
    resetDialogSliders('dlg-spherize');
    const result = await openEffectDialog('dlg-spherize', (imgData, vals) => {
      Effects.spherize(imgData, vals.amount || 100);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.spherize(d, result.values.amount || 100);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxRipple() {
    resetDialogSliders('dlg-ripple');
    const result = await openEffectDialog('dlg-ripple', (imgData, vals) => {
      Effects.ripple(imgData, vals.amplitude || 10, vals.wavelength || 30);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.ripple(d, result.values.amplitude || 10, result.values.wavelength || 30);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxFrostedGlass() {
    resetDialogSliders('dlg-frosted-glass');
    const result = await openEffectDialog('dlg-frosted-glass', (imgData, vals) => {
      Effects.frostedGlass(imgData, vals.amount || 5);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.frostedGlass(d, result.values.amount || 5);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxOilPaint() {
    resetDialogSliders('dlg-oil-paint');
    const result = await openEffectDialog('dlg-oil-paint', (imgData, vals) => {
      Effects.oilPaint(imgData, vals.radius || 4, vals.intensity || 20);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.oilPaint(d, result.values.radius || 4, result.values.intensity || 20);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxPosterize() {
    resetDialogSliders('dlg-posterize');
    const result = await openEffectDialog('dlg-posterize', (imgData, vals) => {
      Effects.posterize(imgData, vals.levels || 4);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.posterize(d, result.values.levels || 4);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxThreshold() {
    resetDialogSliders('dlg-threshold');
    const result = await openEffectDialog('dlg-threshold', (imgData, vals) => {
      Effects.threshold(imgData, vals.level || 128);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.threshold(d, result.values.level || 128);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxSolarize() {
    resetDialogSliders('dlg-solarize');
    const result = await openEffectDialog('dlg-solarize', (imgData, vals) => {
      Effects.solarize(imgData, vals.threshold || 128);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.solarize(d, result.values.threshold || 128);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxPencilSketch() {
    resetDialogSliders('dlg-pencil-sketch');
    const result = await openEffectDialog('dlg-pencil-sketch', (imgData, vals) => {
      Effects.pencilSketch(imgData, vals.strength || 50);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.pencilSketch(d, result.values.strength || 50);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxVignette() {
    resetDialogSliders('dlg-vignette');
    const result = await openEffectDialog('dlg-vignette', (imgData, vals) => {
      Effects.vignette(imgData, vals.amount || 50, vals.radius || 70);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.vignette(d, result.values.amount || 50, result.values.radius || 70);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxHalftone() {
    resetDialogSliders('dlg-halftone');
    const result = await openEffectDialog('dlg-halftone', (imgData, vals) => {
      Effects.halftone(imgData, vals.dotSize || 6);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.halftone(d, result.values.dotSize || 6);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  async function doFxCrystallize() {
    resetDialogSliders('dlg-crystallize');
    const result = await openEffectDialog('dlg-crystallize', (imgData, vals) => {
      Effects.crystallize(imgData, vals.cellSize || 12);
    }, getLayerImageData);
    if (result.result === 'ok') {
      pushUndo();
      applyEffectToLayer(layerModel.getActiveCtx(), selection, (d) => {
        Effects.crystallize(d, result.values.cellSize || 12);
      }, layerModel.width, layerModel.height);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
    }
  }

  function resetDialogSliders(dlgId) {
    const dlg = document.getElementById(dlgId);
    if (!dlg)
      return;
    for (const slider of dlg.querySelectorAll('input[type="range"]')) {
      slider.value = slider.defaultValue;
      const span = slider.parentElement.querySelector('span');
      if (span) span.textContent = slider.defaultValue;
    }
  }

  // -----------------------------------------------------------------------
  // Image operations
  // -----------------------------------------------------------------------
  function doResize() {
    const srcData = layerModel.activeLayer.getImageData();
    PaintApp.ScalerEngine.showScalerDialog(srcData, layerModel.width, layerModel.height)
      .then(({ result, w, h, algorithmId, params }) => {
        if (result !== 'ok')
          return;
        if (w === layerModel.width && h === layerModel.height)
          return;
        pushUndoStructural();
        layerModel.stretchResizeWith(w, h, (layerData) =>
          PaintApp.ScalerEngine.apply(algorithmId, layerData, w, h, params)
        );
        selection.init(w, h);
        dirty = true;
        compositeAndDisplay();
        updateTitle();
        updateStatusSize();
      });
  }

  function doCanvasSize() {
    const wInput = document.getElementById('canvas-w');
    const hInput = document.getElementById('canvas-h');
    wInput.value = layerModel.width;
    hInput.value = layerModel.height;
    wInput.focus();
    wInput.select();
    SZ.Dialog.show('dlg-canvas-size').then((result) => {
      if (result !== 'ok')
        return;
      let nw = parseInt(wInput.value, 10);
      let nh = parseInt(hInput.value, 10);
      if (isNaN(nw) || nw < 1) nw = 1;
      if (isNaN(nh) || nh < 1) nh = 1;
      if (nw > 4096) nw = 4096;
      if (nh > 4096) nh = 4096;
      if (nw === layerModel.width && nh === layerModel.height)
        return;
      pushUndoStructural();
      layerModel.resizeCanvas(nw, nh);
      selection.init(nw, nh);
      dirty = true;
      compositeAndDisplay();
      updateTitle();
      updateStatusSize();
    });
  }

  function doCropToSelection() {
    const bounds = selection.getBounds();
    if (!bounds)
      return;
    pushUndoStructural();
    layerModel.cropTo(bounds.x, bounds.y, bounds.w, bounds.h);
    selection.init(bounds.w, bounds.h);
    dirty = true;
    compositeAndDisplay();
    updateTitle();
    updateStatusSize();
    refreshLayerPanel();
  }

  // -----------------------------------------------------------------------
  // Auto-Correct operations
  // -----------------------------------------------------------------------
  function _flattenForAnalysis() {
    const c = layerModel.flattenToCanvas();
    const ctx = c.getContext('2d');
    return ctx.getImageData(0, 0, c.width, c.height);
  }

  function doAutoDeskew() {
    const imgData = _flattenForAnalysis();
    const angle = ImageAnalysis.detectSkewAngle(imgData);
    if (Math.abs(angle) < 0.001) return; // already straight
    pushUndoStructural();
    layerModel.rotateAllByAngle(-angle);
    selection.init(layerModel.width, layerModel.height);
    dirty = true;
    compositeAndDisplay();
    updateTitle();
    updateStatusSize();
  }

  function doAutoRotate() {
    const imgData = _flattenForAnalysis();
    const degrees = ImageAnalysis.detectDominantRotation(imgData);
    if (degrees === 0) return;
    pushUndoStructural();
    if (degrees === 90) layerModel.rotateAllCW();
    else if (degrees === 180) layerModel.rotateAll180();
    else if (degrees === 270) layerModel.rotateAllCCW();
    selection.init(layerModel.width, layerModel.height);
    dirty = true;
    compositeAndDisplay();
    updateTitle();
    updateStatusSize();
  }

  function doAutoKeystone() {
    const imgData = _flattenForAnalysis();
    const corners = ImageAnalysis.detectKeystoneCorners(imgData);
    if (!corners) return;
    // Check if corners are close to image corners (no correction needed)
    const w = imgData.width, h = imgData.height;
    const expected = [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 0, y: h - 1 }];
    let maxDist = 0;
    for (let i = 0; i < 4; ++i) {
      const dx = corners[i].x - expected[i].x;
      const dy = corners[i].y - expected[i].y;
      maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
    }
    if (maxDist < 3) return; // already corrected
    pushUndoStructural();
    layerModel.transformAllPixels((srcData) => ImageAnalysis.perspectiveWarp(srcData, corners));
    selection.init(layerModel.width, layerModel.height);
    dirty = true;
    compositeAndDisplay();
    updateTitle();
    updateStatusSize();
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
  function doNew() {
    commitText();
    pushUndoStructural();
    layerModel.init(640, 480);
    selection.init(640, 480);
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    undoStack.length = 0;
    redoStack = [];
    compositeAndDisplay();
    refreshLayerPanel();
    updateTitle();
    updateStatusSize();
  }

  async function doOpen() {
    commitText();
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

    // If ReadFile didn't return a data URI (e.g. mounted FSAA binary file),
    // fall back to ReadAllBytes and convert to data URL
    if (!content.startsWith('data:image')) {
      try {
        const bytes = await Kernel32.ReadAllBytes(path);
        if (bytes && bytes.length) {
          const ext = (path.split('.').pop() || '').toLowerCase();
          const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff' };
          const blob = new Blob([bytes], { type: MIME[ext] || 'image/png' });
          const reader = new FileReader();
          content = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (err) {
        alert('Could not open file: ' + err.message);
        return;
      }
    }

    if (!content.startsWith('data:image')) {
      alert('Not a valid image file.');
      return;
    }
    const img = new Image();
    img.onload = () => {
      layerModel.loadFromImage(img);
      selection.init(img.width, img.height);
      currentFilePath = path;
      const parts = path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';
      dirty = false;
      undoStack.length = 0;
      redoStack = [];
      compositeAndDisplay();
      refreshLayerPanel();
      updateTitle();
      updateStatusSize();
    };
    img.onerror = () => alert('Could not decode image.');
    img.src = content;
  }

  function doSave(callback) {
    commitText();
    if (!currentFilePath) {
      doSaveAs(callback);
      return;
    }
    saveToPath(currentFilePath, callback);
  }

  async function doSaveAs(callback) {
    const flat = layerModel.flattenToCanvas();
    const dataUrl = flat.toDataURL('image/png');
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
      await saveToPath(result.path, callback);
    }
  }

  async function saveToPath(path, callback) {
    const flat = layerModel.flattenToCanvas();
    const dataUrl = flat.toDataURL('image/png');
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

  async function doExport(mimeType) {
    const flat = layerModel.flattenToCanvas();
    const dataUrl = flat.toDataURL(mimeType);
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const result = await ComDlg32.GetSaveFileName({
      filters: [
        { name: ext.toUpperCase(), ext: [ext] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      defaultName: (currentFileName.replace(/\.[^.]+$/, '') || 'Untitled') + '.' + ext,
      title: 'Export ' + ext.toUpperCase(),
      content: dataUrl,
    });
    // No need to track path for export
  }

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === textInput && !e.ctrlKey)
      return;

    // Selection mode via modifier keys during selection tools
    if (e.key === 'Delete' && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      handleAction('layer-delete');
      return;
    }

    if (!e.ctrlKey)
      return;

    const key = e.key.toLowerCase();

    if (e.shiftKey) {
      switch (key) {
        case 'n':
          e.preventDefault();
          handleAction('layer-add');
          return;
        case 'i':
          e.preventDefault();
          handleAction('invert-selection');
          return;
        case 'v':
          e.preventDefault();
          handleAction('paste-as-layer');
          return;
      }
    }

    switch (key) {
      case 'n': e.preventDefault(); handleAction('new'); break;
      case 'o': e.preventDefault(); handleAction('open'); break;
      case 's': e.preventDefault(); handleAction('save'); break;
      case 'z': e.preventDefault(); handleAction('undo'); break;
      case 'y': e.preventDefault(); handleAction('redo'); break;
      case 'a': e.preventDefault(); handleAction('select-all'); break;
      case 'd': e.preventDefault(); handleAction('deselect'); break;
      case 'c': e.preventDefault(); handleAction('copy'); break;
      case 'x': e.preventDefault(); handleAction('cut'); break;
      case 'v': e.preventDefault(); handleAction('paste'); break;
      case '1': e.preventDefault(); setZoom(1); break;
      case '2': e.preventDefault(); setZoom(2); break;
      case '3': e.preventDefault(); setZoom(4); break;
      case '4': e.preventDefault(); setZoom(8); break;
      case '0': e.preventDefault(); setZoom(1); break;
    }
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  updateTitle();
  updateStatusSize();
  setZoom(1);

  const cmd = Kernel32.GetCommandLine();
  if (cmd.path)
    loadFile(cmd.path);
})();
