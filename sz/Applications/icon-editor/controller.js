;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // ── Constants ─────────────────────────────────────────────────────
  const MAX_UNDO = 30;
  const CHECKER_SIZE = 8;
  const CHECKER_LIGHT = '#ffffff';
  const CHECKER_DARK = '#cccccc';
  const DEFAULT_SIZE = 32;
  const DEFAULT_BPP = 32;

  const PALETTE_COLORS = [
    '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080',
    '#c0c0c0', '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff',
    '#00ffff', '#ffffff', '#ff8000', '#804000', '#408000', '#004080', '#8000ff',
    '#ff0080', '#80ff00', '#0080ff', '#ff80c0', '#c080ff', '#80c0ff', '#c0ff80'
  ];

  const ICO_FILTERS = [
    { name: 'Icon Files', ext: ['ico', 'cur'] },
    { name: 'All Files', ext: ['*'] }
  ];

  const IMAGE_FILTERS = [
    { name: 'Images', ext: ['png', 'bmp', 'jpg', 'gif', 'svg'] },
    { name: 'All Files', ext: ['*'] }
  ];

  const EXE_FILTERS = [
    { name: 'Executables', ext: ['exe', 'dll'] },
    { name: 'All Files', ext: ['*'] }
  ];

  // ── State ─────────────────────────────────────────────────────────
  let iconDocument = { type: 1, images: [] };
  let selectedIndex = 0;
  let currentTool = 'pencil';
  let currentColor = { r: 0, g: 0, b: 0, a: 255 };
  let zoom = 8;
  let showGrid = true;
  let showCheckerboard = true;
  let dirty = false;
  let currentFilePath = null;
  let currentFileName = 'Untitled';

  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let lastX = -1;
  let lastY = -1;

  let shapeFillMode = 'outline';
  let brushSize = 1;

  let selection = null;
  let selectionDragMode = null;
  let selectionDragStart = null;
  let selectionAnimFrame = 0;
  let selectionAnimTimer = null;

  const undoStack = [];
  let redoStack = [];

  let openMenu = null;

  // ── DOM refs ──────────────────────────────────────────────────────
  const menuBar = document.getElementById('menu-bar');
  const imageList = document.getElementById('image-list');
  const canvasArea = document.getElementById('canvas-area');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const canvasContainer = document.getElementById('canvas-container');
  const checkerCanvas = document.getElementById('checker-canvas');
  const mainCanvas = document.getElementById('main-canvas');
  const overlayCanvas = document.getElementById('overlay-canvas');
  const checkerCtx = checkerCanvas.getContext('2d');
  const ctx = mainCanvas.getContext('2d', { willReadFrequently: true });
  const octx = overlayCanvas.getContext('2d');

  const colorPreview = document.getElementById('color-preview');
  const alphaLabel = document.getElementById('alpha-label');
  const colorR = document.getElementById('color-r');
  const colorG = document.getElementById('color-g');
  const colorB = document.getElementById('color-b');
  const colorA = document.getElementById('color-a');
  const colorHex = document.getElementById('color-hex');
  const alphaSlider = document.getElementById('alpha-slider');
  const depthSelect = document.getElementById('depth-select');
  const toolGrid = document.getElementById('tool-grid');
  const paletteGrid = document.getElementById('palette-grid');

  const toolOptionsPanel = document.getElementById('tool-options');
  const shapeFillOptions = document.getElementById('shape-fill-options');
  const brushSizePanel = document.getElementById('brush-size-options');
  const brushSizeSlider = document.getElementById('brush-size-slider');
  const brushSizeLabel = document.getElementById('brush-size-label');
  const brushPreview = document.getElementById('brush-preview');

  const statusPos = document.getElementById('status-pos');
  const statusZoom = document.getElementById('status-zoom');
  const statusImageInfo = document.getElementById('status-image-info');
  const statusFilename = document.getElementById('status-filename');
  const infoSize = document.getElementById('info-size');
  const infoDepth = document.getElementById('info-depth');

  // ══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ══════════════════════════════════════════════════════════════════

  addImage(DEFAULT_SIZE, DEFAULT_SIZE, DEFAULT_BPP);
  selectImage(0);
  buildPalette();
  updateColorUI();
  setTool('pencil');
  updateTitle();

  // ── Open file from command line ───────────────────────────────────
  const cmdLine = Kernel32.GetCommandLine();
  if (cmdLine.file) {
    Kernel32.ReadAllBytes(cmdLine.file).then(content => {
      if (content)
        loadFile(cmdLine.file, content);
    }).catch(() => {});
  }

  // ══════════════════════════════════════════════════════════════════
  // ICON DOCUMENT MODEL
  // ══════════════════════════════════════════════════════════════════

  function addImage(w, h, bpp) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const imgCtx = canvas.getContext('2d');
    const imageData = imgCtx.createImageData(w, h);
    iconDocument.images.push({ width: w, height: h, bpp, imageData, palette: null });
    refreshImageList();
    return iconDocument.images.length - 1;
  }

  function removeImage(index) {
    if (iconDocument.images.length <= 1)
      return;
    iconDocument.images.splice(index, 1);
    if (selectedIndex >= iconDocument.images.length)
      selectedIndex = iconDocument.images.length - 1;
    refreshImageList();
    selectImage(selectedIndex);
    dirty = true;
    updateTitle();
  }

  function duplicateImage(index) {
    const src = iconDocument.images[index];
    if (!src)
      return;
    const newData = new ImageData(new Uint8ClampedArray(src.imageData.data), src.width, src.height);
    iconDocument.images.push({
      width: src.width,
      height: src.height,
      bpp: src.bpp,
      imageData: newData,
      palette: src.palette ? [...src.palette] : null
    });
    refreshImageList();
    selectImage(iconDocument.images.length - 1);
    dirty = true;
    updateTitle();
  }

  function currentImage() {
    return iconDocument.images[selectedIndex] || null;
  }

  function selectImage(index) {
    if (index < 0 || index >= iconDocument.images.length)
      return;
    commitSelection();
    selectedIndex = index;
    const img = currentImage();
    if (!img)
      return;

    mainCanvas.width = img.width;
    mainCanvas.height = img.height;
    overlayCanvas.width = img.width;
    overlayCanvas.height = img.height;
    ctx.putImageData(img.imageData, 0, 0);

    depthSelect.value = String(img.bpp);
    infoSize.textContent = img.width + ' x ' + img.height;
    infoDepth.textContent = img.bpp + '-bit';
    statusImageInfo.textContent = img.width + ' x ' + img.height + ', ' + img.bpp + 'bpp';

    setZoom(zoom);
    renderChecker();
    refreshImageList();
    undoStack.length = 0;
    redoStack = [];
  }

  // ── Sync imageData from canvas ────────────────────────────────────
  function syncImageData() {
    const img = currentImage();
    if (!img)
      return;
    img.imageData = ctx.getImageData(0, 0, img.width, img.height);
  }

  // ── Refresh sidebar thumbnails ────────────────────────────────────
  function refreshImageList() {
    imageList.innerHTML = '';
    for (let i = 0; i < iconDocument.images.length; ++i) {
      const img = iconDocument.images[i];
      const item = document.createElement('div');
      item.className = 'image-list-item' + (i === selectedIndex ? ' selected' : '');
      item.dataset.index = i;

      const thumb = document.createElement('canvas');
      thumb.className = 'image-list-thumb';
      thumb.width = 36;
      thumb.height = 36;
      const tctx = thumb.getContext('2d');
      tctx.imageSmoothingEnabled = false;

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = img.width;
      tmpCanvas.height = img.height;
      tmpCanvas.getContext('2d').putImageData(img.imageData, 0, 0);

      const scale = Math.min(36 / img.width, 36 / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (36 - dw) / 2;
      const dy = (36 - dh) / 2;
      tctx.drawImage(tmpCanvas, 0, 0, img.width, img.height, dx, dy, dw, dh);

      const label = document.createElement('div');
      label.className = 'image-list-label';
      label.textContent = img.width + 'x' + img.height + '\n' + img.bpp + 'bpp';

      item.appendChild(thumb);
      item.appendChild(label);
      imageList.appendChild(item);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // CANVAS RENDERING
  // ══════════════════════════════════════════════════════════════════

  function setZoom(z) {
    zoom = z;
    const img = currentImage();
    if (!img)
      return;
    const w = img.width * zoom;
    const h = img.height * zoom;
    checkerCanvas.style.width = w + 'px';
    checkerCanvas.style.height = h + 'px';
    mainCanvas.style.width = w + 'px';
    mainCanvas.style.height = h + 'px';
    overlayCanvas.style.width = w + 'px';
    overlayCanvas.style.height = h + 'px';
    canvasContainer.style.width = w + 'px';
    canvasContainer.style.height = h + 'px';
    statusZoom.textContent = 'Zoom: ' + zoom + 'x';
    renderChecker();
    renderOverlayGrid();

    // Update zoom radio states in View menu
    const zoomMap = { 1: 'zoom-1', 4: 'zoom-4', 8: 'zoom-8', 16: 'zoom-16' };
    menuBar.querySelectorAll('[data-action^="zoom-"]').forEach(el => {
      el.classList.toggle('checked', el.dataset.action === zoomMap[zoom]);
    });
  }

  function renderChecker() {
    const img = currentImage();
    if (!img)
      return;
    checkerCanvas.width = img.width;
    checkerCanvas.height = img.height;
    if (!showCheckerboard) {
      checkerCtx.fillStyle = '#ffffff';
      checkerCtx.fillRect(0, 0, img.width, img.height);
      return;
    }
    for (let y = 0; y < img.height; ++y)
      for (let x = 0; x < img.width; ++x) {
        checkerCtx.fillStyle = ((x + y) & 1) ? CHECKER_DARK : CHECKER_LIGHT;
        checkerCtx.fillRect(x, y, 1, 1);
      }
  }

  function renderOverlayGrid() {
    if (showGrid && zoom >= 4) {
      canvasContainer.classList.add('show-grid');
      canvasContainer.style.setProperty('--grid-size', zoom + 'px');
    } else
      canvasContainer.classList.remove('show-grid');
  }

  // ══════════════════════════════════════════════════════════════════
  // COLOR MANAGEMENT
  // ══════════════════════════════════════════════════════════════════

  function updateColorUI() {
    const { r, g, b, a } = currentColor;
    colorR.value = r;
    colorG.value = g;
    colorB.value = b;
    colorA.value = a;
    alphaSlider.value = a;
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    colorHex.value = a < 255 ? hex + ((1 << 8) + a).toString(16).slice(1) : hex;
    colorPreview.style.background = 'rgba(' + r + ',' + g + ',' + b + ',' + (a / 255) + ')';
    alphaLabel.textContent = 'A: ' + a;
  }

  function parseHexColor(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 255
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16)
      };
    }
    return null;
  }

  function buildPalette() {
    paletteGrid.innerHTML = '';
    for (const c of PALETTE_COLORS) {
      const swatch = document.createElement('div');
      swatch.className = 'palette-swatch';
      swatch.style.background = c;
      swatch.dataset.color = c;
      swatch.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const parsed = parseHexColor(c);
        if (parsed) {
          currentColor = { ...parsed, a: currentColor.a };
          updateColorUI();
        }
      });
      paletteGrid.appendChild(swatch);
    }
  }

  // Color input event handlers
  function onColorInputChange() {
    currentColor.r = Math.max(0, Math.min(255, parseInt(colorR.value, 10) || 0));
    currentColor.g = Math.max(0, Math.min(255, parseInt(colorG.value, 10) || 0));
    currentColor.b = Math.max(0, Math.min(255, parseInt(colorB.value, 10) || 0));
    currentColor.a = Math.max(0, Math.min(255, parseInt(colorA.value, 10) || 0));
    updateColorUI();
  }

  colorR.addEventListener('change', onColorInputChange);
  colorG.addEventListener('change', onColorInputChange);
  colorB.addEventListener('change', onColorInputChange);
  colorA.addEventListener('change', onColorInputChange);

  alphaSlider.addEventListener('input', () => {
    currentColor.a = parseInt(alphaSlider.value, 10);
    updateColorUI();
  });

  colorHex.addEventListener('change', () => {
    const parsed = parseHexColor(colorHex.value);
    if (parsed) {
      currentColor = parsed;
      updateColorUI();
    }
  });

  depthSelect.addEventListener('change', () => {
    const img = currentImage();
    if (img) {
      img.bpp = parseInt(depthSelect.value, 10);
      infoDepth.textContent = img.bpp + '-bit';
      statusImageInfo.textContent = img.width + ' x ' + img.height + ', ' + img.bpp + 'bpp';
      dirty = true;
      updateTitle();
    }
  });

  // ══════════════════════════════════════════════════════════════════
  // UNDO / REDO
  // ══════════════════════════════════════════════════════════════════

  function pushUndo() {
    const img = currentImage();
    if (!img)
      return;
    undoStack.push(new ImageData(new Uint8ClampedArray(img.imageData.data), img.width, img.height));
    if (undoStack.length > MAX_UNDO)
      undoStack.shift();
    redoStack = [];
  }

  function doUndo() {
    if (undoStack.length === 0)
      return;
    selection = null;
    stopSelectionAnimation();
    clearSelectionOverlay();
    const img = currentImage();
    if (!img)
      return;
    redoStack.push(new ImageData(new Uint8ClampedArray(img.imageData.data), img.width, img.height));
    const state = undoStack.pop();
    const sizeChanged = img.width !== state.width || img.height !== state.height;
    img.imageData = state;
    img.width = state.width;
    img.height = state.height;
    if (sizeChanged) {
      mainCanvas.width = state.width;
      mainCanvas.height = state.height;
      overlayCanvas.width = state.width;
      overlayCanvas.height = state.height;
    }
    ctx.putImageData(state, 0, 0);
    if (sizeChanged) {
      setZoom(zoom);
      renderChecker();
      updateImageInfoDisplay();
    }
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function doRedo() {
    if (redoStack.length === 0)
      return;
    selection = null;
    stopSelectionAnimation();
    clearSelectionOverlay();
    const img = currentImage();
    if (!img)
      return;
    undoStack.push(new ImageData(new Uint8ClampedArray(img.imageData.data), img.width, img.height));
    const state = redoStack.pop();
    const sizeChanged = img.width !== state.width || img.height !== state.height;
    img.imageData = state;
    img.width = state.width;
    img.height = state.height;
    if (sizeChanged) {
      mainCanvas.width = state.width;
      mainCanvas.height = state.height;
      overlayCanvas.width = state.width;
      overlayCanvas.height = state.height;
    }
    ctx.putImageData(state, 0, 0);
    if (sizeChanged) {
      setZoom(zoom);
      renderChecker();
      updateImageInfoDisplay();
    }
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  // ══════════════════════════════════════════════════════════════════
  // DRAWING TOOLS
  // ══════════════════════════════════════════════════════════════════

  function canvasCoords(e) {
    const rect = canvasContainer.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    return { x, y };
  }

  function setPixel(imgData, x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= imgData.width || y >= imgData.height)
      return;
    const i = (y * imgData.width + x) * 4;
    imgData.data[i] = r;
    imgData.data[i + 1] = g;
    imgData.data[i + 2] = b;
    imgData.data[i + 3] = a;
  }

  function getPixel(imgData, x, y) {
    if (x < 0 || y < 0 || x >= imgData.width || y >= imgData.height)
      return [0, 0, 0, 0];
    const i = (y * imgData.width + x) * 4;
    return [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2], imgData.data[i + 3]];
  }

  function paintBrush(imgData, cx, cy, r, g, b, a, size) {
    if (size <= 1) {
      setPixel(imgData, cx, cy, r, g, b, a);
      return;
    }
    const rad = size / 2;
    const r2 = rad * rad;
    const lo = -Math.floor(rad);
    const hi = Math.ceil(rad);
    for (let dy = lo; dy < hi; ++dy)
      for (let dx = lo; dx < hi; ++dx) {
        const d = (dx + 0.5) * (dx + 0.5) + (dy + 0.5) * (dy + 0.5);
        if (d <= r2)
          setPixel(imgData, cx + dx, cy + dy, r, g, b, a);
      }
  }

  function drawPixel(x, y) {
    const img = currentImage();
    if (!img)
      return;
    paintBrush(img.imageData, x, y, currentColor.r, currentColor.g, currentColor.b, currentColor.a, brushSize);
    ctx.putImageData(img.imageData, 0, 0);
  }

  function erasePixel(x, y) {
    const img = currentImage();
    if (!img)
      return;
    paintBrush(img.imageData, x, y, 0, 0, 0, 0, brushSize);
    ctx.putImageData(img.imageData, 0, 0);
  }

  function eyedropperAt(x, y) {
    const img = currentImage();
    if (!img)
      return;
    const px = getPixel(img.imageData, x, y);
    currentColor = { r: px[0], g: px[1], b: px[2], a: px[3] };
    updateColorUI();
  }

  function floodFill(startX, startY) {
    const img = currentImage();
    if (!img)
      return;
    const w = img.width;
    const h = img.height;
    const data = img.imageData.data;
    const target = getPixel(img.imageData, startX, startY);
    const fill = [currentColor.r, currentColor.g, currentColor.b, currentColor.a];

    if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === fill[3])
      return;

    const stack = [[startX, startY]];
    const visited = new Uint8Array(w * h);

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= w || cy >= h)
        continue;
      const idx = cy * w + cx;
      if (visited[idx])
        continue;
      const i = idx * 4;
      if (data[i] !== target[0] || data[i + 1] !== target[1] || data[i + 2] !== target[2] || data[i + 3] !== target[3])
        continue;

      visited[idx] = 1;
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = fill[3];

      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    ctx.putImageData(img.imageData, 0, 0);
  }

  // ── Bresenham line ────────────────────────────────────────────────
  function bresenhamLine(x0, y0, x1, y1, callback) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      callback(x0, y0);
      if (x0 === x1 && y0 === y1)
        break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // ── Bresenham ellipse ─────────────────────────────────────────────
  function bresenhamEllipse(cx, cy, rx, ry, callback) {
    if (rx === 0 || ry === 0)
      return;
    let x = 0;
    let y = ry;
    let rx2 = rx * rx;
    let ry2 = ry * ry;
    let p = ry2 - rx2 * ry + 0.25 * rx2;

    while (ry2 * x <= rx2 * y) {
      callback(cx + x, cy + y);
      callback(cx - x, cy + y);
      callback(cx + x, cy - y);
      callback(cx - x, cy - y);
      if (p < 0)
        p += ry2 * (2 * x + 3);
      else {
        p += ry2 * (2 * x + 3) + rx2 * (-2 * y + 2);
        --y;
      }
      ++x;
    }

    p = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
    while (y >= 0) {
      callback(cx + x, cy + y);
      callback(cx - x, cy + y);
      callback(cx + x, cy - y);
      callback(cx - x, cy - y);
      if (p > 0)
        p += rx2 * (-2 * y + 3);
      else {
        p += ry2 * (2 * x + 2) + rx2 * (-2 * y + 3);
        ++x;
      }
      --y;
    }
  }

  // ── Fill helpers ─────────────────────────────────────────────────
  function fillRect(imgData, x0, y0, x1, y1, r, g, b, a) {
    const lx = Math.max(0, Math.min(x0, x1));
    const ly = Math.max(0, Math.min(y0, y1));
    const rx = Math.min(imgData.width - 1, Math.max(x0, x1));
    const ry = Math.min(imgData.height - 1, Math.max(y0, y1));
    for (let y = ly; y <= ry; ++y)
      for (let x = lx; x <= rx; ++x)
        setPixel(imgData, x, y, r, g, b, a);
  }

  function fillEllipse(imgData, cx, cy, rx, ry, r, g, b, a) {
    if (rx <= 0 || ry <= 0)
      return;
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    for (let y = -ry; y <= ry; ++y) {
      const yf = y * y;
      for (let x = -rx; x <= rx; ++x) {
        if (x * x * ry2 + yf * rx2 <= rx2 * ry2)
          setPixel(imgData, cx + x, cy + y, r, g, b, a);
      }
    }
  }

  function drawShapeToImageData(imgData, tool, x0, y0, x1, y1, r, g, b, a) {
    if (tool === 'line') {
      bresenhamLine(x0, y0, x1, y1, (px, py) => setPixel(imgData, px, py, r, g, b, a));
      return;
    }
    if (tool === 'rect') {
      const lx = Math.min(x0, x1);
      const ly = Math.min(y0, y1);
      const rx = Math.max(x0, x1);
      const ry = Math.max(y0, y1);
      const mode = shapeFillMode;
      if (mode === 'filled' || mode === 'both')
        fillRect(imgData, lx, ly, rx, ry, r, g, b, a);
      if (mode === 'outline' || mode === 'both') {
        bresenhamLine(lx, ly, rx, ly, (px, py) => setPixel(imgData, px, py, r, g, b, a));
        bresenhamLine(rx, ly, rx, ry, (px, py) => setPixel(imgData, px, py, r, g, b, a));
        bresenhamLine(rx, ry, lx, ry, (px, py) => setPixel(imgData, px, py, r, g, b, a));
        bresenhamLine(lx, ry, lx, ly, (px, py) => setPixel(imgData, px, py, r, g, b, a));
      }
    } else if (tool === 'ellipse') {
      const cx = Math.round((x0 + x1) / 2);
      const cy = Math.round((y0 + y1) / 2);
      const erx = Math.abs(Math.round((x1 - x0) / 2));
      const ery = Math.abs(Math.round((y1 - y0) / 2));
      const mode = shapeFillMode;
      if (mode === 'filled' || mode === 'both')
        fillEllipse(imgData, cx, cy, erx, ery, r, g, b, a);
      if (mode === 'outline' || mode === 'both')
        bresenhamEllipse(cx, cy, erx, ery, (px, py) => setPixel(imgData, px, py, r, g, b, a));
    }
  }

  function drawShapeOverlay(tool, x0, y0, x1, y1) {
    octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const oImg = octx.createImageData(overlayCanvas.width, overlayCanvas.height);
    const { r, g, b, a } = currentColor;
    drawShapeToImageData(oImg, tool, x0, y0, x1, y1, r, g, b, a);
    octx.putImageData(oImg, 0, 0);
  }

  function commitShapeOverlay(tool, x0, y0, x1, y1) {
    const img = currentImage();
    if (!img)
      return;
    const { r, g, b, a } = currentColor;
    drawShapeToImageData(img.imageData, tool, x0, y0, x1, y1, r, g, b, a);
    ctx.putImageData(img.imageData, 0, 0);
    octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  // ══════════════════════════════════════════════════════════════════
  // SELECTION TOOL
  // ══════════════════════════════════════════════════════════════════

  function commitSelection() {
    if (!selection)
      return;
    if (selection.floating) {
      const img = currentImage();
      if (img) {
        const fw = selection.floating.width;
        const fh = selection.floating.height;
        for (let y = 0; y < fh; ++y)
          for (let x = 0; x < fw; ++x) {
            const si = (y * fw + x) * 4;
            const a = selection.floating.data[si + 3];
            if (a > 0)
              setPixel(img.imageData, selection.x + x, selection.y + y,
                selection.floating.data[si], selection.floating.data[si + 1],
                selection.floating.data[si + 2], a);
          }
        ctx.putImageData(img.imageData, 0, 0);
        refreshImageList();
        dirty = true;
        updateTitle();
      }
    }
    selection = null;
    selectionDragMode = null;
    selectionDragStart = null;
    stopSelectionAnimation();
    clearSelectionOverlay();
  }

  function liftSelection() {
    if (!selection || selection.floating)
      return;
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const { x: sx, y: sy, w, h } = selection;
    const floatData = new ImageData(w, h);
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        const px = sx + x;
        const py = sy + y;
        if (px >= 0 && px < img.width && py >= 0 && py < img.height) {
          const si = (py * img.width + px) * 4;
          const di = (y * w + x) * 4;
          floatData.data[di] = img.imageData.data[si];
          floatData.data[di + 1] = img.imageData.data[si + 1];
          floatData.data[di + 2] = img.imageData.data[si + 2];
          floatData.data[di + 3] = img.imageData.data[si + 3];
          img.imageData.data[si] = 0;
          img.imageData.data[si + 1] = 0;
          img.imageData.data[si + 2] = 0;
          img.imageData.data[si + 3] = 0;
        }
      }
    ctx.putImageData(img.imageData, 0, 0);
    selection.floating = floatData;
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function isInsideSelection(x, y) {
    if (!selection)
      return false;
    return x >= selection.x && x < selection.x + selection.w &&
           y >= selection.y && y < selection.y + selection.h;
  }

  function doSelectAll() {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    setTool('select');
    selection = { x: 0, y: 0, w: img.width, h: img.height, floating: null };
    startSelectionAnimation();
  }

  function doDeselect() {
    commitSelection();
  }

  function doDeleteSelection() {
    if (!selection)
      return;
    const img = currentImage();
    if (!img)
      return;
    if (selection.floating) {
      selection.floating = null;
      selection = null;
      stopSelectionAnimation();
      clearSelectionOverlay();
      dirty = true;
      updateTitle();
      return;
    }
    pushUndo();
    const { x: sx, y: sy, w, h } = selection;
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        const px = sx + x;
        const py = sy + y;
        if (px >= 0 && px < img.width && py >= 0 && py < img.height)
          setPixel(img.imageData, px, py, 0, 0, 0, 0);
      }
    ctx.putImageData(img.imageData, 0, 0);
    refreshImageList();
    selection = null;
    stopSelectionAnimation();
    clearSelectionOverlay();
    dirty = true;
    updateTitle();
  }

  function renderSelectionOverlay() {
    octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!selection)
      return;

    if (selection.floating) {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = selection.floating.width;
      tmpCanvas.height = selection.floating.height;
      tmpCanvas.getContext('2d').putImageData(selection.floating, 0, 0);
      octx.drawImage(tmpCanvas, selection.x, selection.y);
    }

    const { x, y, w, h } = selection;
    octx.save();
    octx.strokeStyle = '#000000';
    octx.lineWidth = 1 / zoom;
    octx.setLineDash([4 / zoom, 4 / zoom]);
    octx.lineDashOffset = -selectionAnimFrame / zoom;
    octx.strokeRect(x + 0.5 / zoom, y + 0.5 / zoom, w - 1 / zoom, h - 1 / zoom);
    octx.strokeStyle = '#ffffff';
    octx.lineDashOffset = -(selectionAnimFrame + 4) / zoom;
    octx.strokeRect(x + 0.5 / zoom, y + 0.5 / zoom, w - 1 / zoom, h - 1 / zoom);
    octx.restore();
  }

  function clearSelectionOverlay() {
    octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  function startSelectionAnimation() {
    stopSelectionAnimation();
    selectionAnimFrame = 0;
    selectionAnimTimer = setInterval(() => {
      selectionAnimFrame = (selectionAnimFrame + 1) % 8;
      renderSelectionOverlay();
    }, 200);
    renderSelectionOverlay();
  }

  function stopSelectionAnimation() {
    if (selectionAnimTimer) {
      clearInterval(selectionAnimTimer);
      selectionAnimTimer = null;
    }
  }

  // ── Pointer events on canvas ──────────────────────────────────────
  canvasContainer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0)
      return;
    e.preventDefault();
    const { x, y } = canvasCoords(e);
    isDrawing = true;
    startX = x;
    startY = y;
    lastX = x;
    lastY = y;
    canvasContainer.setPointerCapture(e.pointerId);

    if (currentTool === 'pencil') {
      pushUndo();
      drawPixel(x, y);
    } else if (currentTool === 'eraser') {
      pushUndo();
      erasePixel(x, y);
    } else if (currentTool === 'eyedropper') {
      eyedropperAt(x, y);
    } else if (currentTool === 'fill') {
      pushUndo();
      floodFill(x, y);
      dirty = true;
      updateTitle();
      refreshImageList();
      isDrawing = false;
    } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'ellipse') {
      pushUndo();
    } else if (currentTool === 'select') {
      if (selection && isInsideSelection(x, y)) {
        if (!selection.floating)
          liftSelection();
        selectionDragMode = 'move';
        selectionDragStart = { mx: x, my: y, sx: selection.x, sy: selection.y };
      } else {
        commitSelection();
        selectionDragMode = 'create';
        selectionDragStart = { mx: x, my: y, sx: x, sy: y };
      }
    }
  });

  canvasContainer.addEventListener('pointermove', (e) => {
    const { x, y } = canvasCoords(e);
    statusPos.textContent = x + ', ' + y;

    if (currentTool === 'select' && !isDrawing)
      canvasContainer.style.cursor = isInsideSelection(x, y) ? 'move' : 'crosshair';

    if (!isDrawing)
      return;

    if (currentTool === 'pencil') {
      bresenhamLine(lastX, lastY, x, y, drawPixel);
      lastX = x;
      lastY = y;
      dirty = true;
      updateTitle();
    } else if (currentTool === 'eraser') {
      bresenhamLine(lastX, lastY, x, y, erasePixel);
      lastX = x;
      lastY = y;
      dirty = true;
      updateTitle();
    } else if (currentTool === 'eyedropper') {
      eyedropperAt(x, y);
    } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'ellipse') {
      drawShapeOverlay(currentTool, startX, startY, x, y);
    } else if (currentTool === 'select' && selectionDragMode) {
      const img = currentImage();
      if (selectionDragMode === 'create' && img) {
        const sx = Math.max(0, Math.min(selectionDragStart.sx, x));
        const sy = Math.max(0, Math.min(selectionDragStart.sy, y));
        const ex = Math.min(img.width, Math.max(selectionDragStart.sx, x) + 1);
        const ey = Math.min(img.height, Math.max(selectionDragStart.sy, y) + 1);
        selection = { x: sx, y: sy, w: ex - sx, h: ey - sy, floating: null };
        renderSelectionOverlay();
      } else if (selectionDragMode === 'move' && selection) {
        selection.x = selectionDragStart.sx + (x - selectionDragStart.mx);
        selection.y = selectionDragStart.sy + (y - selectionDragStart.my);
        renderSelectionOverlay();
      }
    }
  });

  canvasContainer.addEventListener('pointerup', (e) => {
    if (!isDrawing)
      return;
    isDrawing = false;
    canvasContainer.releasePointerCapture(e.pointerId);
    const { x, y } = canvasCoords(e);

    if (currentTool === 'pencil' || currentTool === 'eraser') {
      syncImageData();
      refreshImageList();
      dirty = true;
      updateTitle();
    } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'ellipse') {
      commitShapeOverlay(currentTool, startX, startY, x, y);
      dirty = true;
      updateTitle();
      refreshImageList();
    } else if (currentTool === 'select') {
      if (selectionDragMode === 'create') {
        if (!selection || selection.w <= 1 || selection.h <= 1) {
          selection = null;
          clearSelectionOverlay();
        } else
          startSelectionAnimation();
      }
      selectionDragMode = null;
    }
  });

  canvasContainer.addEventListener('lostpointercapture', () => {
    if (!isDrawing)
      return;
    isDrawing = false;
    if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'ellipse')
      octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (currentTool === 'select')
      selectionDragMode = null;
  });

  canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());

  // Zoom via Ctrl+Scroll
  canvasArea.addEventListener('wheel', (e) => {
    if (!e.ctrlKey)
      return;
    e.preventDefault();
    const levels = [1, 2, 4, 8, 16, 32];
    let idx = levels.indexOf(zoom);
    if (idx === -1) idx = 3;
    if (e.deltaY < 0)
      idx = Math.min(idx + 1, levels.length - 1);
    else
      idx = Math.max(idx - 1, 0);
    setZoom(levels[idx]);
  }, { passive: false });

  // ══════════════════════════════════════════════════════════════════
  // IMAGE OPERATIONS
  // ══════════════════════════════════════════════════════════════════

  function doFlipH() {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const d = img.imageData;
    const w = d.width;
    const h = d.height;
    const copy = new Uint8ClampedArray(d.data);
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        const si = (y * w + x) * 4;
        const di = (y * w + (w - 1 - x)) * 4;
        d.data[di] = copy[si];
        d.data[di + 1] = copy[si + 1];
        d.data[di + 2] = copy[si + 2];
        d.data[di + 3] = copy[si + 3];
      }
    ctx.putImageData(d, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function doFlipV() {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const d = img.imageData;
    const w = d.width;
    const h = d.height;
    const copy = new Uint8ClampedArray(d.data);
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        const si = (y * w + x) * 4;
        const di = ((h - 1 - y) * w + x) * 4;
        d.data[di] = copy[si];
        d.data[di + 1] = copy[si + 1];
        d.data[di + 2] = copy[si + 2];
        d.data[di + 3] = copy[si + 3];
      }
    ctx.putImageData(d, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function doRotateCW() {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const oldW = img.width;
    const oldH = img.height;
    const oldData = new Uint8ClampedArray(img.imageData.data);
    img.width = oldH;
    img.height = oldW;
    img.imageData = new ImageData(img.width, img.height);
    for (let y = 0; y < oldH; ++y)
      for (let x = 0; x < oldW; ++x) {
        const si = (y * oldW + x) * 4;
        const nx = oldH - 1 - y;
        const ny = x;
        const di = (ny * img.width + nx) * 4;
        img.imageData.data[di] = oldData[si];
        img.imageData.data[di + 1] = oldData[si + 1];
        img.imageData.data[di + 2] = oldData[si + 2];
        img.imageData.data[di + 3] = oldData[si + 3];
      }
    mainCanvas.width = img.width;
    mainCanvas.height = img.height;
    overlayCanvas.width = img.width;
    overlayCanvas.height = img.height;
    ctx.putImageData(img.imageData, 0, 0);
    setZoom(zoom);
    renderChecker();
    refreshImageList();
    updateImageInfoDisplay();
    dirty = true;
    updateTitle();
  }

  function doRotateCCW() {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const oldW = img.width;
    const oldH = img.height;
    const oldData = new Uint8ClampedArray(img.imageData.data);
    img.width = oldH;
    img.height = oldW;
    img.imageData = new ImageData(img.width, img.height);
    for (let y = 0; y < oldH; ++y)
      for (let x = 0; x < oldW; ++x) {
        const si = (y * oldW + x) * 4;
        const nx = y;
        const ny = oldW - 1 - x;
        const di = (ny * img.width + nx) * 4;
        img.imageData.data[di] = oldData[si];
        img.imageData.data[di + 1] = oldData[si + 1];
        img.imageData.data[di + 2] = oldData[si + 2];
        img.imageData.data[di + 3] = oldData[si + 3];
      }
    mainCanvas.width = img.width;
    mainCanvas.height = img.height;
    overlayCanvas.width = img.width;
    overlayCanvas.height = img.height;
    ctx.putImageData(img.imageData, 0, 0);
    setZoom(zoom);
    renderChecker();
    refreshImageList();
    updateImageInfoDisplay();
    dirty = true;
    updateTitle();
  }

  function doRotate180() {
    const img = currentImage();
    if (!img)
      return;
    commitSelection();
    pushUndo();
    const d = img.imageData.data;
    const w = img.width;
    const h = img.height;
    const copy = new Uint8ClampedArray(d);
    const total = w * h;
    for (let i = 0; i < total; ++i) {
      const si = i * 4;
      const di = (total - 1 - i) * 4;
      d[di] = copy[si];
      d[di + 1] = copy[si + 1];
      d[di + 2] = copy[si + 2];
      d[di + 3] = copy[si + 3];
    }
    ctx.putImageData(img.imageData, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function doCropToSelection() {
    if (!selection)
      return;
    const img = currentImage();
    if (!img)
      return;
    const { x: sx, y: sy, w, h } = selection;
    if (w <= 0 || h <= 0)
      return;
    // If floating, stamp it first so pixels are on the canvas
    if (selection.floating)
      commitSelection();
    else {
      selection = null;
      stopSelectionAnimation();
      clearSelectionOverlay();
    }
    pushUndo();
    const cropped = new ImageData(w, h);
    for (let cy = 0; cy < h; ++cy)
      for (let cx = 0; cx < w; ++cx) {
        const px = sx + cx;
        const py = sy + cy;
        if (px >= 0 && px < img.width && py >= 0 && py < img.height) {
          const si = (py * img.width + px) * 4;
          const di = (cy * w + cx) * 4;
          cropped.data[di] = img.imageData.data[si];
          cropped.data[di + 1] = img.imageData.data[si + 1];
          cropped.data[di + 2] = img.imageData.data[si + 2];
          cropped.data[di + 3] = img.imageData.data[si + 3];
        }
      }
    img.width = w;
    img.height = h;
    img.imageData = cropped;
    mainCanvas.width = w;
    mainCanvas.height = h;
    overlayCanvas.width = w;
    overlayCanvas.height = h;
    ctx.putImageData(cropped, 0, 0);
    setZoom(zoom);
    renderChecker();
    refreshImageList();
    updateImageInfoDisplay();
    dirty = true;
    updateTitle();
  }

  function doShiftImage(dx, dy, wrap) {
    const img = currentImage();
    if (!img)
      return;
    commitSelection();
    pushUndo();
    const w = img.width;
    const h = img.height;
    const src = new Uint8ClampedArray(img.imageData.data);
    const d = img.imageData.data;
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        let sx = x - dx;
        let sy = y - dy;
        if (wrap) {
          sx = ((sx % w) + w) % w;
          sy = ((sy % h) + h) % h;
        }
        const di = (y * w + x) * 4;
        if (!wrap && (sx < 0 || sx >= w || sy < 0 || sy >= h)) {
          d[di] = 0;
          d[di + 1] = 0;
          d[di + 2] = 0;
          d[di + 3] = 0;
        } else {
          const si = (sy * w + sx) * 4;
          d[di] = src[si];
          d[di + 1] = src[si + 1];
          d[di + 2] = src[si + 2];
          d[di + 3] = src[si + 3];
        }
      }
    ctx.putImageData(img.imageData, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function doGrayscale() {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const d = img.imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
    ctx.putImageData(img.imageData, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function doInvert() {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const d = img.imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    ctx.putImageData(img.imageData, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function doHslAdjust(hueShift, satShift, briShift) {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const d = img.imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      let [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      h = ((h + hueShift) % 360 + 360) % 360;
      s = Math.max(0, Math.min(100, s + satShift));
      l = Math.max(0, Math.min(100, l + briShift));
      const [r, g, b] = hslToRgb(h, s, l);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    ctx.putImageData(img.imageData, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function doReplaceColor(fromR, fromG, fromB, fromA, toR, toG, toB, toA, tolerance) {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const d = img.imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const dr = Math.abs(d[i] - fromR);
      const dg = Math.abs(d[i + 1] - fromG);
      const db = Math.abs(d[i + 2] - fromB);
      const da = Math.abs(d[i + 3] - fromA);
      if (dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance) {
        d[i] = toR;
        d[i + 1] = toG;
        d[i + 2] = toB;
        d[i + 3] = toA;
      }
    }
    ctx.putImageData(img.imageData, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  function doResize(newW, newH, mode) {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.width;
    srcCanvas.height = img.height;
    srcCanvas.getContext('2d').putImageData(img.imageData, 0, 0);

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = newW;
    dstCanvas.height = newH;
    const dctx = dstCanvas.getContext('2d');
    dctx.imageSmoothingEnabled = mode !== 'nearest';
    if (mode === 'nearest')
      dctx.imageSmoothingQuality = 'low';
    dctx.drawImage(srcCanvas, 0, 0, newW, newH);

    img.width = newW;
    img.height = newH;
    img.imageData = dctx.getImageData(0, 0, newW, newH);

    mainCanvas.width = newW;
    mainCanvas.height = newH;
    overlayCanvas.width = newW;
    overlayCanvas.height = newH;
    ctx.putImageData(img.imageData, 0, 0);
    setZoom(zoom);
    renderChecker();
    refreshImageList();
    updateImageInfoDisplay();
    dirty = true;
    updateTitle();
  }

  function updateImageInfoDisplay() {
    const img = currentImage();
    if (!img)
      return;
    infoSize.textContent = img.width + ' x ' + img.height;
    infoDepth.textContent = img.bpp + '-bit';
    statusImageInfo.textContent = img.width + ' x ' + img.height + ', ' + img.bpp + 'bpp';
  }

  // ── HSL helpers ───────────────────────────────────────────────────
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // ══════════════════════════════════════════════════════════════════
  // ICO FORMAT: PARSER
  // ══════════════════════════════════════════════════════════════════

  function parseICO(buffer) {
    const view = new DataView(buffer);
    const fileSize = buffer.byteLength;
    const reserved = view.getUint16(0, true);
    const type = view.getUint16(2, true);
    const count = view.getUint16(4, true);

    if (reserved !== 0 || (type !== 1 && type !== 2))
      throw new Error('Not a valid ICO/CUR file');

    const doc = { type, images: [] };

    for (let i = 0; i < count; ++i) {
      const offset = 6 + i * 16;
      if (offset + 16 > fileSize)
        break;

      const w = view.getUint8(offset) || 256;
      const h = view.getUint8(offset + 1) || 256;
      const colorCount = view.getUint8(offset + 2);
      const planes = view.getUint16(offset + 4, true);
      const bpp = view.getUint16(offset + 6, true);
      const dataSize = view.getUint32(offset + 8, true);
      const dataOffset = view.getUint32(offset + 12, true);

      if (dataOffset >= fileSize)
        continue;

      const maxAvailable = fileSize - dataOffset;
      const safeSize = dataSize > 0 ? Math.min(dataSize, maxAvailable) : maxAvailable;
      if (safeSize <= 0)
        continue;

      const entryData = new Uint8Array(buffer, dataOffset, safeSize);
      if (entryData.length < 4)
        continue;

      try {
        // Check for PNG magic
        if (entryData[0] === 0x89 && entryData[1] === 0x50 && entryData[2] === 0x4E && entryData[3] === 0x47) {
          // PNG entry - decode asynchronously
          doc.images.push({
            width: w, height: h, bpp: bpp || 32,
            imageData: null,
            palette: null,
            pngData: new Uint8Array(entryData)
          });
        } else {
          // BMP entry
          const decoded = decodeBmpEntry(entryData, w, h, bpp || (colorCount > 0 ? (colorCount <= 2 ? 1 : colorCount <= 16 ? 4 : 8) : 32));
          const imageData = decoded.imageData;
          doc.images.push({
            width: imageData.width, height: imageData.height,
            bpp: bpp || decoded.bpp || (colorCount > 0 ? (colorCount <= 2 ? 1 : colorCount <= 16 ? 4 : 8) : 32),
            imageData,
            palette: null
          });
        }
      } catch (_) {
        // Skip malformed entries; keep loading remaining images.
      }
    }

    return doc;
  }

  function decodeBmpEntry(data, wHint, hHint, bppHint) {
    if (!data || data.length < 16)
      throw new Error('BMP entry too small');

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const headerSize = view.getUint32(0, true);
    let w = Math.max(1, wHint | 0);
    let h = Math.max(1, hHint | 0);
    let actualBpp = bppHint || 32;
    let topDown = false;
    let paletteSize = 0;
    let paletteEntrySize = 4;
    let paletteOffset = headerSize;

    if (headerSize === 12 && data.length >= 12) {
      const cw = view.getUint16(4, true);
      const ch = view.getUint16(6, true);
      const cbpp = view.getUint16(10, true) || actualBpp;
      if (cw > 0)
        w = cw;
      if (ch > 0)
        h = Math.max(1, Math.floor(ch / 2));
      actualBpp = cbpp;
      paletteEntrySize = 3;
      paletteOffset = 12;
      if (actualBpp <= 8)
        paletteSize = (1 << actualBpp);
    } else if (headerSize >= 40 && data.length >= headerSize) {
      const bw = view.getInt32(4, true);
      const bh = view.getInt32(8, true);
      const bbpp = view.getUint16(14, true) || actualBpp;
      const clrUsed = headerSize >= 36 ? view.getUint32(32, true) : 0;
      if (bw !== 0)
        w = Math.max(1, Math.abs(bw));
      if (bh !== 0) {
        topDown = bh < 0;
        const absH = Math.abs(bh);
        h = Math.max(1, Math.floor(absH / 2));
      }
      actualBpp = bbpp;
      paletteEntrySize = 4;
      paletteOffset = headerSize;
      if (actualBpp <= 8)
        paletteSize = clrUsed > 0 ? clrUsed : (1 << actualBpp);
    }

    const palette = [];
    for (let i = 0; i < paletteSize; ++i) {
      const off = paletteOffset + i * paletteEntrySize;
      if (off + paletteEntrySize > data.length)
        break;
      if (paletteEntrySize === 3)
        palette.push([data[off + 2], data[off + 1], data[off]]);
      else
        palette.push([data[off + 2], data[off + 1], data[off]]);
    }

    const xorOffset = paletteOffset + paletteSize * paletteEntrySize;
    const xorRowSize = Math.ceil((w * actualBpp) / 8);
    const xorRowPadded = (xorRowSize + 3) & ~3;
    const andRowSize = Math.ceil(w / 8);
    const andRowPadded = (andRowSize + 3) & ~3;

    if (xorOffset >= data.length)
      throw new Error('Invalid BMP entry offsets');

    if (xorOffset + xorRowPadded * h + andRowPadded * h > data.length) {
      const maxRowsWithMask = Math.floor((data.length - xorOffset) / (xorRowPadded + andRowPadded));
      const maxRowsNoMask = Math.floor((data.length - xorOffset) / xorRowPadded);
      h = Math.max(1, Math.min(h, maxRowsWithMask > 0 ? maxRowsWithMask : maxRowsNoMask));
    }

    const andOffset = xorOffset + xorRowPadded * h;
    const hasAndMask = andOffset + andRowPadded * h <= data.length;

    const imageData = new ImageData(w, h);
    const out = imageData.data;

    for (let y = 0; y < h; ++y) {
      const srcRow = topDown ? y : (h - 1 - y);
      const xorRowOff = xorOffset + srcRow * xorRowPadded;

      for (let x = 0; x < w; ++x) {
        const dstIdx = (y * w + x) * 4;
        let r = 0, g = 0, b = 0, a = 255;

        if (actualBpp === 32) {
          const off = xorRowOff + x * 4;
          b = data[off] || 0;
          g = data[off + 1] || 0;
          r = data[off + 2] || 0;
          a = data[off + 3] ?? 255;
        } else if (actualBpp === 24) {
          const off = xorRowOff + x * 3;
          b = data[off] || 0;
          g = data[off + 1] || 0;
          r = data[off + 2] || 0;
        } else if (actualBpp === 8) {
          const idx = data[xorRowOff + x] || 0;
          if (idx < palette.length)
            [r, g, b] = palette[idx];
        } else if (actualBpp === 4) {
          const byteOff = xorRowOff + (x >> 1);
          const v = data[byteOff] || 0;
          const idx = (x & 1) === 0 ? (v >> 4) : (v & 0x0F);
          if (idx < palette.length)
            [r, g, b] = palette[idx];
        } else if (actualBpp === 1) {
          const byteOff = xorRowOff + (x >> 3);
          const bit = 7 - (x & 7);
          const idx = ((data[byteOff] || 0) >> bit) & 1;
          if (idx < palette.length)
            [r, g, b] = palette[idx];
        } else if (actualBpp === 16) {
          const off = xorRowOff + x * 2;
          const px = (data[off] || 0) | ((data[off + 1] || 0) << 8);
          r = ((px >> 10) & 0x1F) * 255 / 31;
          g = ((px >> 5) & 0x1F) * 255 / 31;
          b = (px & 0x1F) * 255 / 31;
        }

        if (actualBpp < 32 && hasAndMask) {
          const andByteOff = andOffset + srcRow * andRowPadded + (x >> 3);
          const andBit = 7 - (x & 7);
          if (andByteOff < data.length && (((data[andByteOff] || 0) >> andBit) & 1))
            a = 0;
        }

        out[dstIdx] = r;
        out[dstIdx + 1] = g;
        out[dstIdx + 2] = b;
        out[dstIdx + 3] = a;
      }
    }

    return { imageData, bpp: actualBpp };
  }

  async function resolvePngEntries(doc) {
    for (const img of doc.images) {
      if (img.pngData && !img.imageData) {
        const blob = new Blob([img.pngData], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        try {
          const bmp = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          const tctx = canvas.getContext('2d');
          tctx.drawImage(bmp, 0, 0);
          img.imageData = tctx.getImageData(0, 0, bmp.width, bmp.height);
          img.width = bmp.width;
          img.height = bmp.height;
          bmp.close();
        } finally {
          URL.revokeObjectURL(url);
        }
        delete img.pngData;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // ICO FORMAT: WRITER
  // ══════════════════════════════════════════════════════════════════

  function writeICO(doc) {
    const entries = [];

    for (const img of doc.images) {
      let entryData;
      if (img.width === 256 && img.height === 256)
        entryData = encodePngEntry(img);
      else
        entryData = encodeBmpEntry(img);
      entries.push({ img, data: entryData });
    }

    // Calculate total size
    const headerSize = 6 + doc.images.length * 16;
    let totalSize = headerSize;
    for (const e of entries)
      totalSize += e.data.length;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // ICONDIR
    view.setUint16(0, 0, true);           // reserved
    view.setUint16(2, doc.type, true);     // type (1=ICO, 2=CUR)
    view.setUint16(4, doc.images.length, true); // count

    // ICONDIRENTRY + data
    let dataOffset = headerSize;
    for (let i = 0; i < entries.length; ++i) {
      const e = entries[i];
      const entryOff = 6 + i * 16;
      view.setUint8(entryOff, e.img.width >= 256 ? 0 : e.img.width);
      view.setUint8(entryOff + 1, e.img.height >= 256 ? 0 : e.img.height);
      view.setUint8(entryOff + 2, 0); // color count
      view.setUint8(entryOff + 3, 0); // reserved
      view.setUint16(entryOff + 4, 1, true); // planes
      view.setUint16(entryOff + 6, e.img.bpp, true); // bpp
      view.setUint32(entryOff + 8, e.data.length, true); // size
      view.setUint32(entryOff + 12, dataOffset, true); // offset

      bytes.set(e.data, dataOffset);
      dataOffset += e.data.length;
    }

    return buffer;
  }

  function encodeBmpEntry(img) {
    const w = img.width;
    const h = img.height;
    const bpp = img.bpp;
    const data = img.imageData.data;

    // For simplicity, always write as 32bpp BMP with AND mask
    const headerSize = 40;
    const xorRowSize = w * 4;
    const xorRowPadded = (xorRowSize + 3) & ~3;
    const andRowSize = Math.ceil(w / 8);
    const andRowPadded = (andRowSize + 3) & ~3;
    const totalSize = headerSize + xorRowPadded * h + andRowPadded * h;

    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);

    // BITMAPINFOHEADER
    view.setUint32(0, 40, true);        // header size
    view.setInt32(4, w, true);           // width
    view.setInt32(8, h * 2, true);       // height (doubled for AND mask)
    view.setUint16(12, 1, true);         // planes
    view.setUint16(14, 32, true);        // bpp (always write 32)
    view.setUint32(16, 0, true);         // compression
    view.setUint32(20, xorRowPadded * h + andRowPadded * h, true); // image size
    // rest is 0

    // XOR data (bottom-up, BGRA)
    for (let y = 0; y < h; ++y) {
      const srcRow = h - 1 - y;
      const dstOff = headerSize + srcRow * xorRowPadded;
      for (let x = 0; x < w; ++x) {
        const si = (y * w + x) * 4;
        const di = dstOff + x * 4;
        buf[di] = data[si + 2];     // B
        buf[di + 1] = data[si + 1]; // G
        buf[di + 2] = data[si];     // R
        buf[di + 3] = data[si + 3]; // A
      }
    }

    // AND mask (bottom-up)
    const andStart = headerSize + xorRowPadded * h;
    for (let y = 0; y < h; ++y) {
      const srcRow = h - 1 - y;
      const dstOff = andStart + srcRow * andRowPadded;
      for (let x = 0; x < w; ++x) {
        const si = (y * w + x) * 4;
        const alpha = data[si + 3];
        if (alpha < 128) {
          const byteIdx = x >> 3;
          const bit = 7 - (x & 7);
          buf[dstOff + byteIdx] |= (1 << bit);
        }
      }
    }

    return buf;
  }

  function encodePngEntry(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const tctx = canvas.getContext('2d');
    tctx.putImageData(img.imageData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; ++i)
      bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // ══════════════════════════════════════════════════════════════════
  // PE (EXE/DLL) ICON EXTRACTION
  // ══════════════════════════════════════════════════════════════════

  function extractIconsFromPE(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // MZ header check
    if (view.getUint16(0) !== 0x5A4D)
      throw new Error('Not a valid PE file (missing MZ signature)');

    const peOffset = view.getUint32(0x3C, true);
    if (peOffset + 4 > buffer.byteLength)
      throw new Error('Invalid PE offset');

    // PE signature
    if (view.getUint32(peOffset, true) !== 0x00004550)
      throw new Error('Not a valid PE file (missing PE signature)');

    const coffOffset = peOffset + 4;
    const numberOfSections = view.getUint16(coffOffset + 2, true);
    const optionalHeaderSize = view.getUint16(coffOffset + 16, true);
    const optionalOffset = coffOffset + 20;

    // Determine PE32 or PE32+
    const magic = view.getUint16(optionalOffset, true);
    let dataDirectoryOffset;
    if (magic === 0x10B) // PE32
      dataDirectoryOffset = optionalOffset + 96;
    else if (magic === 0x20B) // PE32+
      dataDirectoryOffset = optionalOffset + 112;
    else
      throw new Error('Unknown optional header magic: 0x' + magic.toString(16));

    // Resource table is data directory entry #2
    const resourceRVA = view.getUint32(dataDirectoryOffset + 8, true);
    const resourceSize = view.getUint32(dataDirectoryOffset + 12, true);

    if (resourceRVA === 0)
      throw new Error('No resource directory found');

    // Parse section headers to find resource section
    const sectionsOffset = optionalOffset + optionalHeaderSize;
    let rsrcFileOffset = 0;
    let rsrcVA = 0;

    for (let i = 0; i < numberOfSections; ++i) {
      const secOff = sectionsOffset + i * 40;
      const virtualAddress = view.getUint32(secOff + 12, true);
      const virtualSize = view.getUint32(secOff + 8, true);
      const rawDataPtr = view.getUint32(secOff + 20, true);

      if (resourceRVA >= virtualAddress && resourceRVA < virtualAddress + virtualSize) {
        rsrcFileOffset = rawDataPtr + (resourceRVA - virtualAddress);
        rsrcVA = virtualAddress;
        break;
      }
    }

    if (rsrcFileOffset === 0)
      throw new Error('Could not locate resource section');

    const RT_ICON = 3;
    const RT_GROUP_ICON = 14;

    // Parse resource directory
    function parseDir(offset) {
      const namedCount = view.getUint16(offset + 12, true);
      const idCount = view.getUint16(offset + 14, true);
      const entries = [];
      for (let i = 0; i < namedCount + idCount; ++i) {
        const entryOff = offset + 16 + i * 8;
        const id = view.getUint32(entryOff, true);
        const dataOrDir = view.getUint32(entryOff + 4, true);
        entries.push({ id: id & 0xFFFF, isDirectory: !!(dataOrDir & 0x80000000), offset: dataOrDir & 0x7FFFFFFF });
      }
      return entries;
    }

    function getDataEntry(offset) {
      const realOff = rsrcFileOffset + offset;
      const dataRVA = view.getUint32(realOff, true);
      const size = view.getUint32(realOff + 4, true);
      const fileOff = rsrcFileOffset + (dataRVA - resourceRVA);
      return { offset: fileOff, size };
    }

    // Find RT_GROUP_ICON and RT_ICON entries
    const rootEntries = parseDir(rsrcFileOffset);
    const iconEntries = new Map();
    const groupEntries = [];

    for (const rootEntry of rootEntries) {
      if (!rootEntry.isDirectory)
        continue;

      const typeDir = parseDir(rsrcFileOffset + rootEntry.offset);

      if (rootEntry.id === RT_ICON) {
        for (const nameEntry of typeDir) {
          const langDir = nameEntry.isDirectory
            ? parseDir(rsrcFileOffset + nameEntry.offset)
            : [nameEntry];
          for (const langEntry of langDir) {
            const de = langEntry.isDirectory ? null : getDataEntry(langEntry.offset);
            if (de)
              iconEntries.set(nameEntry.id, de);
          }
        }
      }

      if (rootEntry.id === RT_GROUP_ICON) {
        for (const nameEntry of typeDir) {
          const langDir = nameEntry.isDirectory
            ? parseDir(rsrcFileOffset + nameEntry.offset)
            : [nameEntry];
          for (const langEntry of langDir) {
            const de = langEntry.isDirectory ? null : getDataEntry(langEntry.offset);
            if (de)
              groupEntries.push({ id: nameEntry.id, ...de });
          }
        }
      }
    }

    if (groupEntries.length === 0)
      throw new Error('No icon groups found in PE file');

    // Reconstruct ICO from first group
    const allDocs = [];

    for (const group of groupEntries) {
      const grpData = new DataView(buffer, group.offset, group.size);
      const grpType = grpData.getUint16(2, true);
      const grpCount = grpData.getUint16(4, true);

      // Build ICO buffer
      const icoEntryHeaders = [];
      const icoEntryData = [];

      for (let i = 0; i < grpCount; ++i) {
        const off = 6 + i * 14;
        const w = grpData.getUint8(off) || 256;
        const h = grpData.getUint8(off + 1) || 256;
        const colorCount = grpData.getUint8(off + 2);
        const planes = grpData.getUint16(off + 4, true);
        const bpp = grpData.getUint16(off + 6, true);
        const dataSize = grpData.getUint32(off + 8, true);
        const nID = grpData.getUint16(off + 12, true);

        const iconDE = iconEntries.get(nID);
        if (!iconDE)
          continue;

        const actualSize = Math.min(iconDE.size, buffer.byteLength - iconDE.offset);
        const rawData = new Uint8Array(buffer, iconDE.offset, actualSize);
        icoEntryHeaders.push({ w, h, colorCount, planes, bpp, dataSize: actualSize });
        icoEntryData.push(rawData);
      }

      // Assemble ICO file in memory
      const headerTotal = 6 + icoEntryHeaders.length * 16;
      let totalDataSize = headerTotal;
      for (const d of icoEntryData)
        totalDataSize += d.length;

      const icoBuf = new ArrayBuffer(totalDataSize);
      const icoView = new DataView(icoBuf);
      const icoBytes = new Uint8Array(icoBuf);

      icoView.setUint16(0, 0, true);
      icoView.setUint16(2, grpType, true);
      icoView.setUint16(4, icoEntryHeaders.length, true);

      let currentOffset = headerTotal;
      for (let i = 0; i < icoEntryHeaders.length; ++i) {
        const eh = icoEntryHeaders[i];
        const entryOff = 6 + i * 16;
        icoView.setUint8(entryOff, eh.w >= 256 ? 0 : eh.w);
        icoView.setUint8(entryOff + 1, eh.h >= 256 ? 0 : eh.h);
        icoView.setUint8(entryOff + 2, eh.colorCount);
        icoView.setUint8(entryOff + 3, 0);
        icoView.setUint16(entryOff + 4, eh.planes, true);
        icoView.setUint16(entryOff + 6, eh.bpp, true);
        icoView.setUint32(entryOff + 8, icoEntryData[i].length, true);
        icoView.setUint32(entryOff + 12, currentOffset, true);

        icoBytes.set(icoEntryData[i], currentOffset);
        currentOffset += icoEntryData[i].length;
      }

      try {
        const doc = parseICO(icoBuf);
        doc._groupId = group.id;
        allDocs.push(doc);
      } catch (ex) {
        // Skip malformed groups
      }
    }

    return allDocs;
  }

  // ══════════════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ══════════════════════════════════════════════════════════════════

  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - Icon Editor';
    document.title = title;
    User32.SetWindowText(title);
    statusFilename.textContent = (dirty ? '*' : '') + currentFileName;
  }

  async function doExit() {
    if (dirty) {
      const proceed = await confirmSave();
      if (proceed === 'cancel')
        return;
    }
    User32.DestroyWindow();
  }

  async function doNew() {
    if (dirty) {
      const proceed = await confirmSave();
      if (proceed === 'cancel')
        return;
    }
    iconDocument = { type: 1, images: [] };
    addImage(DEFAULT_SIZE, DEFAULT_SIZE, DEFAULT_BPP);
    selectedIndex = 0;
    selectImage(0);
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    updateTitle();
  }

  async function doOpen() {
    if (dirty) {
      const proceed = await confirmSave();
      if (proceed === 'cancel')
        return;
    }
    const result = await ComDlg32.GetOpenFileName({
      filters: ICO_FILTERS,
      initialDir: '/user/documents',
      title: 'Open Icon',
    });
    if (!result.cancelled && result.path)
      loadFile(result.path);
  }

  function isIcoBuffer(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 6)
      return false;
    const view = new DataView(buffer);
    const reserved = view.getUint16(0, true);
    const type = view.getUint16(2, true);
    const count = view.getUint16(4, true);
    return reserved === 0 && (type === 1 || type === 2) && count > 0;
  }

  function getIcoBufferScore(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 6)
      return 0;

    const view = new DataView(buffer);
    const fileSize = buffer.byteLength;
    const reserved = view.getUint16(0, true);
    const type = view.getUint16(2, true);
    const count = view.getUint16(4, true);
    if (reserved !== 0 || (type !== 1 && type !== 2) || count <= 0 || count > 512)
      return 0;

    if (6 + count * 16 > fileSize)
      return 0;

    let validEntries = 0;
    for (let i = 0; i < count; ++i) {
      const off = 6 + i * 16;
      const dataSize = view.getUint32(off + 8, true);
      const dataOffset = view.getUint32(off + 12, true);
      if (dataOffset >= fileSize)
        continue;
      const avail = fileSize - dataOffset;
      const size = dataSize > 0 ? Math.min(dataSize, avail) : avail;
      if (size < 4)
        continue;

      const b0 = view.getUint8(dataOffset);
      const b1 = view.getUint8(dataOffset + 1);
      const b2 = view.getUint8(dataOffset + 2);
      const b3 = view.getUint8(dataOffset + 3);
      const isPng = b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47;
      const dibSize = view.getUint32(dataOffset, true);
      const isDib = dibSize === 12 || dibSize === 40 || dibSize === 52 || dibSize === 56 || dibSize === 108 || dibSize === 124;
      if (isPng || isDib)
        ++validEntries;
    }

    return validEntries > 0 ? (1000 + validEntries) : 0;
  }

  function isPeBuffer(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 2)
      return false;
    const bytes = new Uint8Array(buffer);
    if (bytes[0] !== 0x4D || bytes[1] !== 0x5A) // 'M' 'Z'
      return false;
    if (buffer.byteLength < 0x40)
      return true;
    const view = new DataView(buffer);
    const peOff = view.getUint32(0x3C, true);
    if (peOff + 4 > buffer.byteLength)
      return false;
    return bytes[peOff] === 0x50 && bytes[peOff + 1] === 0x45 && bytes[peOff + 2] === 0x00 && bytes[peOff + 3] === 0x00; // 'PE\0\0'
  }

  function decodeBinaryContent(content, expectedKind = 'binary') {
    if (content instanceof ArrayBuffer)
      return content;

    if (content instanceof Uint8Array)
      return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);

    if (typeof content === 'string') {
      const dataUrlMatch = content.match(/^data:([^,]*),(.*)$/i);
      let payload = dataUrlMatch ? dataUrlMatch[2] : content;
      let base64Candidate = null;
      let rawCandidate = null;

      // Try base64 first (data URLs and plain base64 strings).
      const compact = payload.replace(/\s+/g, '');
      try {
        const binary = atob(compact);
        const buffer = new ArrayBuffer(binary.length);
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; ++i)
          bytes[i] = binary.charCodeAt(i);
        base64Candidate = buffer;
      } catch (_) {
        // Not base64.
      }

      if (payload.length > 0) {
        const buffer = new ArrayBuffer(payload.length);
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < payload.length; ++i)
          bytes[i] = payload.charCodeAt(i) & 0xff;
        rawCandidate = buffer;
      }

      if (expectedKind === 'ico') {
        const b64Score = getIcoBufferScore(base64Candidate);
        const rawScore = getIcoBufferScore(rawCandidate);
        if (b64Score === 0 && rawScore === 0)
          return null;
        return b64Score >= rawScore ? base64Candidate : rawCandidate;
      }

      if (expectedKind === 'pe') {
        const b64Ok = isPeBuffer(base64Candidate);
        const rawOk = isPeBuffer(rawCandidate);
        if (!b64Ok && !rawOk)
          return null;
        if (b64Ok && !rawOk)
          return base64Candidate;
        if (rawOk && !b64Ok)
          return rawCandidate;
        return base64Candidate || rawCandidate;
      }

      if (base64Candidate)
        return base64Candidate;
      if (rawCandidate)
        return rawCandidate;

      if (dataUrlMatch && dataUrlMatch[1] && !/;\s*base64/i.test(dataUrlMatch[1])) {
        try {
          payload = decodeURIComponent(payload);
          const buffer = new ArrayBuffer(payload.length);
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < payload.length; ++i)
            bytes[i] = payload.charCodeAt(i) & 0xff;
          return buffer;
        } catch (_) {
          // fall through
        }
      }

      return null;
    }

    return null;
  }

  async function loadFile(path, contentArg) {
    let content = contentArg;
    if (content == null) {
      try {
        content = await Kernel32.ReadAllBytes(path);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
        return;
      }
    }

    const buffer = decodeBinaryContent(content, 'ico');
    if (!buffer) {
      await User32.MessageBox('Unsupported file format.', 'Error', MB_OK | MB_ICONERROR);
      return;
    }

    try {
      iconDocument = parseICO(buffer);
      await resolvePngEntries(iconDocument);
    } catch (err) {
      await User32.MessageBox('Failed to parse ICO: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
      return;
    }

    if (iconDocument.images.length === 0) {
      addImage(DEFAULT_SIZE, DEFAULT_SIZE, DEFAULT_BPP);
    }

    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    selectedIndex = 0;
    selectImage(0);
    dirty = false;
    updateTitle();
  }

  async function doSave(callback) {
    if (!currentFilePath) {
      doSaveAs(callback);
      return;
    }
    await saveToPath(currentFilePath, callback);
  }

  async function doSaveAs(callback) {
    commitSelection();
    syncImageData();
    const icoBuffer = writeICO(iconDocument);
    const base64 = arrayBufferToBase64(icoBuffer);
    const dataUrl = 'data:application/octet-stream;base64,' + base64;

    const result = await ComDlg32.GetSaveFileName({
      filters: ICO_FILTERS,
      initialDir: '/user/documents',
      defaultName: currentFileName || 'Untitled.ico',
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
    commitSelection();
    syncImageData();
    const icoBuffer = writeICO(iconDocument);
    try {
      await Kernel32.WriteAllBytes(path, new Uint8Array(icoBuffer));
    } catch (err) {
      await User32.MessageBox('Could not save file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
      return;
    }
    dirty = false;
    updateTitle();
    if (typeof callback === 'function')
      callback();
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; ++i)
      binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function doOpenExe() {
    if (dirty) {
      const proceed = await confirmSave();
      if (proceed === 'cancel')
        return;
    }
    const result = await ComDlg32.GetOpenFileName({
      filters: EXE_FILTERS,
      initialDir: '/user/documents',
      title: 'Extract Icons from EXE/DLL',
    });
    if (result.cancelled || !result.path)
      return;

    let content;
    try {
      content = await Kernel32.ReadAllBytes(result.path);
    } catch (err) {
      await User32.MessageBox('Could not open file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
      return;
    }

    const buffer = decodeBinaryContent(content, 'pe');
    if (!buffer) {
      await User32.MessageBox('Unsupported file format.', 'Error', MB_OK | MB_ICONERROR);
      return;
    }

    let docs;
    try {
      docs = extractIconsFromPE(buffer);
    } catch (err) {
      await User32.MessageBox('Failed to extract icons: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
      return;
    }

    if (!docs || docs.length === 0) {
      await User32.MessageBox('No icons found in the file.', 'Information', MB_OK | MB_ICONINFORMATION);
      return;
    }

    // Resolve PNG entries for all docs
    for (const doc of docs) {
      try {
        await resolvePngEntries(doc);
      } catch (e) {
        // Continue with what we have
      }
    }

    if (docs.length === 1) {
      loadExtractedDoc(docs[0], result.path);
      return;
    }

    const chosen = await showPEBrowserDialog(docs, result.path);
    if (chosen === 'export-all')
      exportAllIconGroups(docs, result.path);
    else if (chosen)
      loadExtractedDoc(chosen, result.path);
  }

  function loadExtractedDoc(doc, sourcePath) {
    iconDocument = doc;
    if (iconDocument.images.length === 0)
      addImage(DEFAULT_SIZE, DEFAULT_SIZE, DEFAULT_BPP);
    const parts = sourcePath.split('/');
    currentFileName = parts[parts.length - 1].replace(/\.(exe|dll)$/i, '') + '.ico';
    currentFilePath = null;
    selectedIndex = 0;
    selectImage(0);
    dirty = true;
    updateTitle();
  }

  function showPEBrowserDialog(docs, sourcePath) {
    return new Promise((resolve) => {
      const dlg = document.getElementById('dlg-pe-browser');
      const grid = document.getElementById('pe-browser-grid');
      const countSpan = document.getElementById('pe-group-count');
      const openBtn = document.getElementById('pe-btn-open');

      grid.innerHTML = '';
      countSpan.textContent = docs.length;
      openBtn.disabled = true;

      let selectedCard = null;
      let selectedDoc = null;
      let resolved = false;

      function finish(value) {
        if (resolved)
          return;
        resolved = true;
        dlg.classList.remove('visible');
        resolve(value);
      }

      // Batch-render cards for performance
      let batchIdx = 0;
      function renderBatch() {
        const end = Math.min(batchIdx + 20, docs.length);
        for (; batchIdx < end; ++batchIdx) {
          const doc = docs[batchIdx];
          const docIndex = batchIdx;
          const card = document.createElement('div');
          card.className = 'pe-browser-card';

          // Thumbnail: use largest image
          const thumb = document.createElement('canvas');
          thumb.className = 'pe-browser-thumb';
          thumb.width = 48;
          thumb.height = 48;
          const tctx = thumb.getContext('2d');
          tctx.imageSmoothingEnabled = false;

          if (doc.images.length > 0) {
            const largest = doc.images.reduce((a, b) => a.width * a.height >= b.width * b.height ? a : b);
            if (largest.imageData) {
              const tmp = document.createElement('canvas');
              tmp.width = largest.width;
              tmp.height = largest.height;
              tmp.getContext('2d').putImageData(largest.imageData, 0, 0);
              const scale = Math.min(48 / largest.width, 48 / largest.height);
              const dw = largest.width * scale;
              const dh = largest.height * scale;
              tctx.drawImage(tmp, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
            }
          }

          const label = document.createElement('div');
          label.className = 'pe-browser-label';
          const sizes = doc.images.map(im => im.width + 'x' + im.height).join(', ');
          label.textContent = '#' + (doc._groupId || docIndex) + ' (' + doc.images.length + ')\n' + sizes;

          card.appendChild(thumb);
          card.appendChild(label);

          card.addEventListener('click', () => {
            if (selectedCard)
              selectedCard.classList.remove('selected');
            card.classList.add('selected');
            selectedCard = card;
            selectedDoc = doc;
            openBtn.disabled = false;
          });

          card.addEventListener('dblclick', () => finish(doc));

          grid.appendChild(card);
        }
        if (batchIdx < docs.length)
          requestAnimationFrame(renderBatch);
      }
      requestAnimationFrame(renderBatch);

      dlg.classList.add('visible');

      awaitDialogResult(dlg, (result) => {
        if (result === 'open' && selectedDoc)
          finish(selectedDoc);
        else if (result === 'export-all')
          finish('export-all');
        else
          finish(null);
      });
    });
  }

  function exportAllIconGroups(docs, sourcePath) {
    const parts = sourcePath.split('/');
    const baseName = parts[parts.length - 1].replace(/\.(exe|dll)$/i, '');
    let i = 0;
    function exportNext() {
      if (i >= docs.length)
        return;
      const doc = docs[i];
      const icoBuffer = writeICO(doc);
      const base64 = arrayBufferToBase64(icoBuffer);
      const a = document.createElement('a');
      a.href = 'data:application/octet-stream;base64,' + base64;
      a.download = baseName + '_' + (doc._groupId || i) + '.ico';
      a.click();
      ++i;
      setTimeout(exportNext, 100);
    }
    exportNext();
  }

  async function doImportImage() {
    if (dirty) {
      const proceed = await confirmSave();
      if (proceed === 'cancel')
        return;
    }
    const result = await ComDlg32.GetOpenFileName({
      filters: IMAGE_FILTERS,
      initialDir: '/user/documents',
      title: 'Import Image',
    });
    if (result.cancelled || !result.path)
      return;

    let content = result.content;
    if (content == null) {
      try {
        content = await Kernel32.ReadFile(result.path);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
        return;
      }
    }

    if (typeof content !== 'string' || !content.startsWith('data:image')) {
      await User32.MessageBox('Not a valid image file.', 'Error', MB_OK | MB_ICONERROR);
      return;
    }

    // Load the image
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = content;
    });

    // Show import dialog to select sizes
    const dlg = document.getElementById('dlg-import');
    dlg.classList.add('visible');

    const chosen = await new Promise((resolve) => {
      awaitDialogResult(dlg, (resultStr) => {
        if (resultStr !== 'ok') {
          resolve(null);
          return;
        }
        const checks = dlg.querySelectorAll('#import-sizes input[type="checkbox"]:checked');
        const sizes = Array.from(checks).map(c => parseInt(c.value, 10));
        resolve(sizes);
      });
    });

    if (!chosen || chosen.length === 0)
      return;

    iconDocument = { type: 1, images: [] };

    for (const size of chosen) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const tctx = canvas.getContext('2d');
      tctx.imageSmoothingEnabled = size < img.width;
      tctx.drawImage(img, 0, 0, size, size);
      const imageData = tctx.getImageData(0, 0, size, size);
      iconDocument.images.push({
        width: size, height: size, bpp: 32,
        imageData, palette: null
      });
    }

    currentFilePath = null;
    currentFileName = 'Untitled.ico';
    selectedIndex = 0;
    selectImage(0);
    dirty = true;
    updateTitle();
  }

  async function doExportFavicon() {
    commitSelection();
    syncImageData();
    const dlg = document.getElementById('dlg-favicon');

    // Populate checkboxes based on available images
    const container = document.getElementById('favicon-sizes');
    container.innerHTML = '';
    const availableSizes = new Set(iconDocument.images.map(i => i.width));
    for (const s of [16, 32, 48, 64]) {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = s;
      cb.checked = s <= 48;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + s + 'x' + s + (availableSizes.has(s) ? '' : ' (scaled)')));
      container.appendChild(label);
    }

    dlg.classList.add('visible');

    const chosen = await new Promise((resolve) => {
      awaitDialogResult(dlg, (resultStr) => {
        if (resultStr !== 'ok') {
          resolve(null);
          return;
        }
        const checks = dlg.querySelectorAll('#favicon-sizes input[type="checkbox"]:checked');
        resolve(Array.from(checks).map(c => parseInt(c.value, 10)));
      });
    });

    if (!chosen || chosen.length === 0)
      return;

    // Build a temporary icon document with the requested sizes
    const faviconDoc = { type: 1, images: [] };
    for (const size of chosen) {
      const existing = iconDocument.images.find(i => i.width === size && i.height === size);
      if (existing) {
        faviconDoc.images.push({ ...existing, imageData: new ImageData(new Uint8ClampedArray(existing.imageData.data), existing.width, existing.height) });
      } else {
        // Scale from nearest available
        const sorted = [...iconDocument.images].sort((a, b) => Math.abs(a.width - size) - Math.abs(b.width - size));
        const src = sorted[0];
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const tctx = canvas.getContext('2d');
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = src.width;
        srcCanvas.height = src.height;
        srcCanvas.getContext('2d').putImageData(src.imageData, 0, 0);
        tctx.imageSmoothingEnabled = size < src.width;
        tctx.drawImage(srcCanvas, 0, 0, size, size);
        faviconDoc.images.push({
          width: size, height: size, bpp: 32,
          imageData: tctx.getImageData(0, 0, size, size),
          palette: null
        });
      }
    }

    const icoBuffer = writeICO(faviconDoc);
    const base64 = arrayBufferToBase64(icoBuffer);

    // Trigger browser download
    const a = document.createElement('a');
    a.href = 'data:application/octet-stream;base64,' + base64;
    a.download = 'favicon.ico';
    a.click();
  }

  function confirmSave() {
    return new Promise((resolve) => {
      const dlg = document.getElementById('dlg-save-changes');
      dlg.classList.add('visible');
      awaitDialogResult(dlg, async (result) => {
        if (result === 'yes') {
          await doSave();
          resolve('saved');
        } else if (result === 'no')
          resolve('no');
        else
          resolve('cancel');
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // COPY / PASTE
  // ══════════════════════════════════════════════════════════════════

  let clipboardImageData = null;

  function doCopyImage() {
    if (selection && selection.floating) {
      clipboardImageData = new ImageData(
        new Uint8ClampedArray(selection.floating.data), selection.floating.width, selection.floating.height
      );
      return;
    }
    if (selection) {
      const img = currentImage();
      if (!img)
        return;
      const { x: sx, y: sy, w, h } = selection;
      const clip = new ImageData(w, h);
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const px = sx + x;
          const py = sy + y;
          if (px >= 0 && px < img.width && py >= 0 && py < img.height) {
            const si = (py * img.width + px) * 4;
            const di = (y * w + x) * 4;
            clip.data[di] = img.imageData.data[si];
            clip.data[di + 1] = img.imageData.data[si + 1];
            clip.data[di + 2] = img.imageData.data[si + 2];
            clip.data[di + 3] = img.imageData.data[si + 3];
          }
        }
      clipboardImageData = clip;
      return;
    }
    const img = currentImage();
    if (!img)
      return;
    clipboardImageData = new ImageData(new Uint8ClampedArray(img.imageData.data), img.width, img.height);
  }

  function doPasteImage() {
    if (!clipboardImageData)
      return;
    commitSelection();
    setTool('select');
    const w = clipboardImageData.width;
    const h = clipboardImageData.height;
    selection = {
      x: 0, y: 0, w, h,
      floating: new ImageData(new Uint8ClampedArray(clipboardImageData.data), w, h)
    };
    startSelectionAnimation();
  }

  function doCutImage() {
    if (!selection) {
      doCopyImage();
      doClearImage();
      return;
    }
    doCopyImage();
    doDeleteSelection();
  }

  function doPasteAsNewImage() {
    if (!clipboardImageData)
      return;
    commitSelection();
    syncImageData();
    const w = clipboardImageData.width;
    const h = clipboardImageData.height;
    const newData = new ImageData(new Uint8ClampedArray(clipboardImageData.data), w, h);
    iconDocument.images.push({ width: w, height: h, bpp: 32, imageData: newData, palette: null });
    refreshImageList();
    selectImage(iconDocument.images.length - 1);
    dirty = true;
    updateTitle();
  }

  function doClearImage() {
    commitSelection();
    const img = currentImage();
    if (!img)
      return;
    pushUndo();
    const d = img.imageData.data;
    for (let i = 0; i < d.length; ++i)
      d[i] = 0;
    ctx.putImageData(img.imageData, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
  }

  // ══════════════════════════════════════════════════════════════════
  // MENU SYSTEM
  // ══════════════════════════════════════════════════════════════════

  function updateMenuStates() {
    const setEnabled = (action, enabled) => {
      const el = menuBar.querySelector('[data-action="' + action + '"]');
      if (el)
        el.classList.toggle('disabled', !enabled);
    };
    const hasSelection = !!selection;
    const hasClipboard = !!clipboardImageData;
    const hasUndo = undoStack.length > 0;
    const hasRedo = redoStack.length > 0;
    const hasImages = iconDocument.images.length > 1;

    setEnabled('undo', hasUndo);
    setEnabled('redo', hasRedo);
    setEnabled('cut-image', true);
    setEnabled('paste-image', hasClipboard);
    setEnabled('paste-as-new', hasClipboard);
    setEnabled('select-all', true);
    setEnabled('deselect', hasSelection);
    setEnabled('delete-selection', hasSelection);
    setEnabled('crop-to-selection', hasSelection);
  }

  menuBar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.menu-entry') || e.target.closest('.menu-separator'))
      return;
    const item = e.target.closest('.menu-item');
    if (!item)
      return;
    if (openMenu === item) {
      item.classList.remove('open');
      openMenu = null;
      return;
    }
    if (openMenu)
      openMenu.classList.remove('open');
    item.classList.add('open');
    openMenu = item;
    updateMenuStates();
  });

  menuBar.addEventListener('pointerover', (e) => {
    if (!openMenu)
      return;
    const item = e.target.closest('.menu-item');
    if (item && item !== openMenu) {
      openMenu.classList.remove('open');
      item.classList.add('open');
      openMenu = item;
      updateMenuStates();
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!openMenu)
      return;
    if (!e.target.closest('.menu-bar')) {
      openMenu.classList.remove('open');
      openMenu = null;
    }
  });

  menuBar.addEventListener('click', (e) => {
    const entry = e.target.closest('.menu-entry');
    if (!entry || entry.classList.contains('disabled'))
      return;
    const action = entry.dataset.action;
    if (action)
      handleAction(action, entry);
    if (openMenu) {
      openMenu.classList.remove('open');
      openMenu = null;
    }
  });

  function handleAction(action, entry) {
    switch (action) {
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'open-exe': doOpenExe(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'import-image': doImportImage(); break;
      case 'export-favicon': doExportFavicon(); break;
      case 'exit': doExit(); break;

      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'cut-image': doCutImage(); break;
      case 'copy-image': doCopyImage(); break;
      case 'paste-image': doPasteImage(); break;
      case 'paste-as-new': doPasteAsNewImage(); break;
      case 'select-all': doSelectAll(); break;
      case 'deselect': doDeselect(); break;
      case 'delete-selection': doDeleteSelection(); break;
      case 'clear-image': doClearImage(); break;

      case 'toggle-grid':
        showGrid = !showGrid;
        entry.classList.toggle('checked', showGrid);
        renderOverlayGrid();
        break;
      case 'toggle-checkerboard':
        showCheckerboard = !showCheckerboard;
        entry.classList.toggle('checked', showCheckerboard);
        renderChecker();
        break;
      case 'zoom-1': setZoom(1); break;
      case 'zoom-4': setZoom(4); break;
      case 'zoom-8': setZoom(8); break;
      case 'zoom-16': setZoom(16); break;
      case 'zoom-fit': {
        const img = currentImage();
        if (img) {
          const rect = canvasArea.getBoundingClientRect();
          const fitZ = Math.max(1, Math.min(
            Math.floor((rect.width - 40) / img.width),
            Math.floor((rect.height - 40) / img.height)
          ));
          setZoom(fitZ);
        }
        break;
      }

      case 'flip-h': doFlipH(); break;
      case 'flip-v': doFlipV(); break;
      case 'rotate-cw': doRotateCW(); break;
      case 'rotate-ccw': doRotateCCW(); break;
      case 'rotate-180': doRotate180(); break;
      case 'crop-to-selection': doCropToSelection(); break;
      case 'resize-image': showResizeDialog(); break;
      case 'shift-image': showShiftDialog(); break;
      case 'grayscale': doGrayscale(); break;
      case 'invert': doInvert(); break;
      case 'hsl-adjust': showHslDialog(); break;
      case 'replace-color': showReplaceColorDialog(); break;

      case 'tool':
        if (entry && entry.dataset.tool)
          setTool(entry.dataset.tool);
        break;

      case 'about':
        showDialog('dlg-about');
        break;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // TOOL SELECTION
  // ══════════════════════════════════════════════════════════════════

  function setTool(tool) {
    if (currentTool === 'select' && tool !== 'select')
      commitSelection();
    currentTool = tool;

    // Update toolbar
    toolGrid.querySelectorAll('.tool-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });

    // Update menu
    menuBar.querySelectorAll('[data-action="tool"]').forEach(e => {
      e.classList.toggle('checked', e.dataset.tool === tool);
    });

    // Show/hide shape fill options
    const isShape = tool === 'rect' || tool === 'ellipse';
    toolOptionsPanel.classList.toggle('visible', isShape);

    // Show/hide brush size options
    const isBrush = tool === 'pencil' || tool === 'eraser';
    brushSizePanel.classList.toggle('visible', isBrush);

    // Cursor
    const cursorMap = {
      pencil: 'crosshair',
      eraser: 'crosshair',
      eyedropper: 'crosshair',
      fill: 'crosshair',
      line: 'crosshair',
      rect: 'crosshair',
      ellipse: 'crosshair',
      select: 'crosshair'
    };
    canvasContainer.style.cursor = cursorMap[tool] || 'default';
  }

  toolGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.tool-btn');
    if (btn && btn.dataset.tool)
      setTool(btn.dataset.tool);
  });

  // ══════════════════════════════════════════════════════════════════
  // IMAGE LIST INTERACTIONS
  // ══════════════════════════════════════════════════════════════════

  imageList.addEventListener('click', (e) => {
    const item = e.target.closest('.image-list-item');
    if (!item)
      return;
    syncImageData();
    selectImage(parseInt(item.dataset.index, 10));
  });

  document.getElementById('btn-add-image').addEventListener('click', () => {
    showAddImageDialog();
  });

  document.getElementById('btn-remove-image').addEventListener('click', () => {
    removeImage(selectedIndex);
  });

  document.getElementById('btn-duplicate-image').addEventListener('click', () => {
    syncImageData();
    duplicateImage(selectedIndex);
  });

  function showAddImageDialog() {
    const dlg = document.getElementById('dlg-add-image');
    document.getElementById('add-width').value = 32;
    document.getElementById('add-height').value = 32;
    dlg.classList.add('visible');

    // Preset size buttons
    dlg.querySelectorAll('.preset-sizes button').forEach(btn => {
      btn.onclick = () => {
        const s = parseInt(btn.dataset.size, 10);
        document.getElementById('add-width').value = s;
        document.getElementById('add-height').value = s;
      };
    });

    awaitDialogResult(dlg, (result) => {
      if (result !== 'ok')
        return;
      let w = parseInt(document.getElementById('add-width').value, 10);
      let h = parseInt(document.getElementById('add-height').value, 10);
      const bpp = parseInt(document.getElementById('add-depth').value, 10);
      w = Math.max(1, Math.min(256, w || 32));
      h = Math.max(1, Math.min(256, h || 32));
      syncImageData();
      const idx = addImage(w, h, bpp);
      selectImage(idx);
      dirty = true;
      updateTitle();
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // DIALOGS
  // ══════════════════════════════════════════════════════════════════

  function showDialog(id) {
    const dlg = document.getElementById(id);
    dlg.classList.add('visible');
    awaitDialogResult(dlg);
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

  function showResizeDialog() {
    const img = currentImage();
    if (!img)
      return;
    const wInput = document.getElementById('resize-w');
    const hInput = document.getElementById('resize-h');
    wInput.value = img.width;
    hInput.value = img.height;
    const dlg = document.getElementById('dlg-resize');
    dlg.classList.add('visible');
    wInput.focus();

    awaitDialogResult(dlg, (result) => {
      if (result !== 'ok')
        return;
      let nw = parseInt(wInput.value, 10);
      let nh = parseInt(hInput.value, 10);
      nw = Math.max(1, Math.min(256, nw || img.width));
      nh = Math.max(1, Math.min(256, nh || img.height));
      const mode = document.getElementById('resize-mode').value;
      if (nw !== img.width || nh !== img.height)
        doResize(nw, nh, mode);
    });
  }

  function showHslDialog() {
    const dlg = document.getElementById('dlg-hsl');
    const hueInput = document.getElementById('hsl-hue');
    const satInput = document.getElementById('hsl-sat');
    const briInput = document.getElementById('hsl-bri');
    const hueVal = document.getElementById('hsl-hue-val');
    const satVal = document.getElementById('hsl-sat-val');
    const briVal = document.getElementById('hsl-bri-val');

    hueInput.value = 0;
    satInput.value = 0;
    briInput.value = 0;
    hueVal.textContent = '0';
    satVal.textContent = '0';
    briVal.textContent = '0';

    hueInput.oninput = () => { hueVal.textContent = hueInput.value; };
    satInput.oninput = () => { satVal.textContent = satInput.value; };
    briInput.oninput = () => { briVal.textContent = briInput.value; };

    dlg.classList.add('visible');
    awaitDialogResult(dlg, (result) => {
      if (result !== 'ok')
        return;
      const h = parseInt(hueInput.value, 10);
      const s = parseInt(satInput.value, 10);
      const b = parseInt(briInput.value, 10);
      if (h !== 0 || s !== 0 || b !== 0)
        doHslAdjust(h, s, b);
    });
  }

  function showReplaceColorDialog() {
    const dlg = document.getElementById('dlg-replace-color');
    const { r, g, b, a } = currentColor;
    const fromHex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    document.getElementById('replace-from').value = fromHex;
    document.getElementById('replace-from-a').value = a;
    dlg.classList.add('visible');
    awaitDialogResult(dlg, (result) => {
      if (result !== 'ok')
        return;
      const from = parseHexColor(document.getElementById('replace-from').value);
      const fromA = parseInt(document.getElementById('replace-from-a').value, 10);
      const to = parseHexColor(document.getElementById('replace-to').value);
      const toA = parseInt(document.getElementById('replace-to-a').value, 10);
      const tolerance = parseInt(document.getElementById('replace-tolerance').value, 10);
      if (from && to)
        doReplaceColor(from.r, from.g, from.b, fromA, to.r, to.g, to.b, toA, tolerance);
    });
  }

  function showShiftDialog() {
    const img = currentImage();
    if (!img)
      return;
    const dlg = document.getElementById('dlg-shift');
    document.getElementById('shift-dx').value = 0;
    document.getElementById('shift-dy').value = 0;
    document.getElementById('shift-wrap').checked = true;
    dlg.classList.add('visible');
    awaitDialogResult(dlg, (result) => {
      if (result !== 'ok')
        return;
      const dx = parseInt(document.getElementById('shift-dx').value, 10) || 0;
      const dy = parseInt(document.getElementById('shift-dy').value, 10) || 0;
      const wrap = document.getElementById('shift-wrap').checked;
      if (dx !== 0 || dy !== 0)
        doShiftImage(dx, dy, wrap);
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ══════════════════════════════════════════════════════════════════

  document.addEventListener('keydown', (e) => {
    // Escape: close dialog → cancel drawing → deselect → close menu
    if (e.key === 'Escape') {
      const openDlg = document.querySelector('.dialog-overlay.visible');
      if (openDlg) {
        const cancelBtn = openDlg.querySelector('[data-result="cancel"]') || openDlg.querySelector('[data-result="ok"]');
        if (cancelBtn)
          cancelBtn.click();
        return;
      }
      if (isDrawing) {
        isDrawing = false;
        if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'ellipse') {
          octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          doUndo();
        }
        return;
      }
      if (selection) {
        e.preventDefault();
        doDeselect();
        return;
      }
      if (openMenu) {
        openMenu.classList.remove('open');
        openMenu = null;
        return;
      }
    }

    // Single key tool shortcuts (only when not in an input)
    if (!e.ctrlKey && !e.altKey && !e.metaKey && e.target === document.body) {
      const toolMap = { p: 'pencil', e: 'eraser', i: 'eyedropper', g: 'fill', l: 'line', r: 'rect', o: 'ellipse', s: 'select' };
      const tool = toolMap[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        setTool(tool);
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        doDeleteSelection();
        return;
      }
    }

    if (!e.ctrlKey)
      return;

    switch (e.key.toLowerCase()) {
      case 'n': e.preventDefault(); handleAction('new'); break;
      case 'o': e.preventDefault(); handleAction('open'); break;
      case 's': e.preventDefault(); handleAction(e.shiftKey ? 'save-as' : 'save'); break;
      case 'z': e.preventDefault(); handleAction('undo'); break;
      case 'y': e.preventDefault(); handleAction('redo'); break;
      case 'x': e.preventDefault(); handleAction('cut-image'); break;
      case 'c': e.preventDefault(); handleAction('copy-image'); break;
      case 'v': e.preventDefault(); handleAction('paste-image'); break;
      case 'a': e.preventDefault(); doSelectAll(); break;
      case 'd': e.preventDefault(); doDeselect(); break;
      case '1': e.preventDefault(); setZoom(1); break;
      case '2': e.preventDefault(); setZoom(4); break;
      case '3': e.preventDefault(); setZoom(8); break;
      case '4': e.preventDefault(); setZoom(16); break;
    }
  });

  // ── Shape fill option listener ───────────────────────────────────
  shapeFillOptions.addEventListener('change', (e) => {
    if (e.target.name === 'shape-fill')
      shapeFillMode = e.target.value;
  });

  // ── Brush size listener ─────────────────────────────────────────
  function updateBrushPreview() {
    brushSizeLabel.textContent = brushSize + 'px';
    const size = Math.max(brushSize * 2, 8);
    let canvas = brushPreview.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      brushPreview.appendChild(canvas);
    }
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = (size * 2) + 'px';
    canvas.style.height = (size * 2) + 'px';
    const bctx = canvas.getContext('2d');
    bctx.clearRect(0, 0, size, size);
    const imgData = bctx.createImageData(size, size);
    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);
    paintBrush(imgData, cx, cy, 0, 0, 0, 255, brushSize);
    bctx.putImageData(imgData, 0, 0);
  }

  brushSizeSlider.addEventListener('input', () => {
    brushSize = parseInt(brushSizeSlider.value, 10);
    updateBrushPreview();
  });

  updateBrushPreview();

})();
