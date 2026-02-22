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

  const DrawingQuantization = SZ.System && SZ.System.Drawing && SZ.System.Drawing.Quantization
    ? SZ.System.Drawing.Quantization
    : null;
  const IconCodec = SZ.System && SZ.System.Drawing && SZ.System.Drawing.IconCodec
    ? SZ.System.Drawing.IconCodec
    : null;
  const QUANTIZER_OPTIONS = DrawingQuantization
    ? DrawingQuantization.getQuantizers()
    : [{ id: 'median-cut', name: 'Median Cut (Adaptive)' }];
  const DITHER_OPTIONS = DrawingQuantization
    ? DrawingQuantization.getDitherers()
    : [{ id: 'none', name: 'None' }];

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
  let foregroundColor = { r: 0, g: 0, b: 0, a: 255 };
  let backgroundColor = { r: 255, g: 255, b: 255, a: 255 };
  let activeColorSlot = 'fg';
  let currentColor = { r: 0, g: 0, b: 0, a: 255 };
  let zoom = 8;
  let showGrid = true;
  let showCheckerboard = true;
  let dirty = false;
  let currentFilePath = null;
  let currentFileName = 'Untitled';

  let isDrawing = false;
  let activePointerButton = 0;
  let pickerMode = 'slot';
  let pickerPaletteIndex = -1;
  let colorPickerRequest = null;
  let lastPaletteTouchTap = { idx: -1, ts: 0 };
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

  // ── DOM refs ──────────────────────────────────────────────────────
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

  const systemColorPicker = document.getElementById('system-color-picker');
  const fgColorSlot = document.getElementById('fg-color-slot');
  const bgColorSlot = document.getElementById('bg-color-slot');
  const backstage = document.getElementById('backstage');
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
  const statusImageInfo = document.getElementById('status-image-info');
  const statusFilename = document.getElementById('status-filename');
  const infoSize = document.getElementById('info-size');
  const infoDepth = document.getElementById('info-depth');

  const ICON_ZOOM_LEVELS = [1, 2, 4, 8, 16, 32];

  function _closestIconZoomIndex(z) {
    let best = 0;
    for (let i = 1; i < ICON_ZOOM_LEVELS.length; ++i)
      if (Math.abs(ICON_ZOOM_LEVELS[i] - z) < Math.abs(ICON_ZOOM_LEVELS[best] - z))
        best = i;
    return best;
  }

  const statusZoomCtrl = new SZ.ZoomControl(document.getElementById('status-zoom-ctrl'), {
    min: 0, max: ICON_ZOOM_LEVELS.length - 1, step: 1,
    value: _closestIconZoomIndex(8),
    formatLabel: idx => ICON_ZOOM_LEVELS[idx] + 'x',
    parseLabel: text => {
      const raw = parseInt(text, 10);
      if (isNaN(raw) || raw < 1) return null;
      return _closestIconZoomIndex(raw);
    },
    onChange: idx => setZoom(ICON_ZOOM_LEVELS[idx]),
  });

  // ══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ══════════════════════════════════════════════════════════════════

  addImage(DEFAULT_SIZE, DEFAULT_SIZE, DEFAULT_BPP);
  selectImage(0);
  buildPalette();
  updateColorUI();
  setTool('pencil');
  updateTitle();
  // Defer initial ribbon state update to after all DOM bindings
  setTimeout(updateMenuStates, 0);

  // ── Open file from command line ───────────────────────────────────
  const cmdLine = Kernel32.GetCommandLine();
  if (cmdLine.path) {
    Kernel32.ReadAllBytes(cmdLine.path).then(content => {
      if (content)
        loadFile(cmdLine.path, content);
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
    iconDocument.images.push({ width: w, height: h, bpp, imageData, palette: createDefaultPaletteForBpp(bpp) });
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
      palette: clonePalette(src.palette)
    });
    refreshImageList();
    selectImage(iconDocument.images.length - 1);
    dirty = true;
    updateTitle();
  }

  function currentImage() {
    return iconDocument.images[selectedIndex] || null;
  }

  function clonePalette(palette) {
    if (!palette)
      return null;
    return palette.map(c => [c[0] | 0, c[1] | 0, c[2] | 0, (c[3] ?? 255) | 0]);
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
    buildPalette();
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
    statusZoomCtrl.value = _closestIconZoomIndex(zoom);
    renderChecker();
    renderOverlayGrid();

    // Update zoom button states in View ribbon panel
    const zoomMap = { 1: 'zoom-1', 4: 'zoom-4', 8: 'zoom-8', 16: 'zoom-16' };
    const viewPanel = document.getElementById('ribbon-view');
    if (viewPanel)
      viewPanel.querySelectorAll('[data-action^="zoom-"]').forEach(el => {
        if (el.dataset.action !== 'zoom-fit')
          el.classList.toggle('active', el.dataset.action === zoomMap[zoom]);
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

  function cloneColor(c) {
    return { r: c.r | 0, g: c.g | 0, b: c.b | 0, a: c.a | 0 };
  }

  function setSlotColor(slot, c) {
    if (slot === 'bg')
      backgroundColor = cloneColor(c);
    else
      foregroundColor = cloneColor(c);
    if (activeColorSlot === slot)
      currentColor = cloneColor(c);
  }

  function getSlotColor(slot) {
    return slot === 'bg' ? backgroundColor : foregroundColor;
  }

  function setActiveColorSlot(slot) {
    activeColorSlot = slot === 'bg' ? 'bg' : 'fg';
    currentColor = cloneColor(getSlotColor(activeColorSlot));
    updateColorUI();
  }

  function getEffectiveColorFor(base) {
    const img = currentImage();
    if (!img)
      return cloneColor(base);
    if (img.bpp <= 8) {
      ensureImagePalette(img);
      const idx = nearestPaletteIndex(img.palette, base.r, base.g, base.b, 255);
      const p = img.palette[idx];
      return { r: p[0], g: p[1], b: p[2], a: base.a < 128 ? 0 : 255 };
    }
    if (img.bpp === 24)
      return { r: base.r, g: base.g, b: base.b, a: base.a < 128 ? 0 : 255 };
    return cloneColor(base);
  }

  function updateColorUI() {
    const { r, g, b } = currentColor;
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    if (systemColorPicker)
      systemColorPicker.value = hex;
    const fgBg = 'rgba(' + foregroundColor.r + ',' + foregroundColor.g + ',' + foregroundColor.b + ',' + (foregroundColor.a / 255) + ')';
    const bgBgStr = 'rgba(' + backgroundColor.r + ',' + backgroundColor.g + ',' + backgroundColor.b + ',' + (backgroundColor.a / 255) + ')';
    if (fgColorSlot)
      fgColorSlot.style.background = fgBg;
    if (bgColorSlot)
      bgColorSlot.style.background = bgBgStr;
    if (fgColorSlot)
      fgColorSlot.classList.toggle('active', activeColorSlot === 'fg');
    if (bgColorSlot)
      bgColorSlot.classList.toggle('active', activeColorSlot === 'bg');
    refreshPaletteMarkers();
  }

  function refreshPaletteMarkers() {
    const swatches = paletteGrid ? paletteGrid.querySelectorAll('.palette-swatch') : [];
    swatches.forEach((swatch) => {
      const parsed = parseHexColor(swatch.dataset.color || '');
      if (!parsed)
        return;
      swatch.classList.toggle('fg',
        parsed.r === foregroundColor.r &&
        parsed.g === foregroundColor.g &&
        parsed.b === foregroundColor.b);
      swatch.classList.toggle('bg',
        parsed.r === backgroundColor.r &&
        parsed.g === backgroundColor.g &&
        parsed.b === backgroundColor.b);
    });
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

  function getPaletteSizeForBpp(bpp) {
    if (bpp <= 1) return 2;
    if (bpp <= 4) return 16;
    if (bpp <= 8) return 256;
    return 0;
  }

  function clamp8(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : (v | 0));
  }

  function createDefaultPaletteForBpp(bpp) {
    const size = getPaletteSizeForBpp(bpp);
    if (size === 0)
      return null;

    const palette = [];
    if (size === 2) {
      palette.push([0, 0, 0, 255], [255, 255, 255, 255]);
      return palette;
    }

    const base = PALETTE_COLORS.slice(0, Math.min(16, size));
    for (const c of base) {
      const p = parseHexColor(c);
      palette.push([p.r, p.g, p.b, 255]);
    }

    while (palette.length < size) {
      const i = palette.length;
      const r = ((i >> 5) & 0x07) * 255 / 7;
      const g = ((i >> 2) & 0x07) * 255 / 7;
      const b = (i & 0x03) * 255 / 3;
      palette.push([Math.round(r), Math.round(g), Math.round(b), 255]);
    }

    return palette;
  }

  function ensureImagePalette(img) {
    const size = getPaletteSizeForBpp(img.bpp);
    if (!size) {
      img.palette = null;
      return;
    }
    if (!img.palette || img.palette.length < size) {
      const base = createDefaultPaletteForBpp(img.bpp);
      if (!img.palette)
        img.palette = base;
      else {
        const merged = img.palette.slice(0, size).map(c => [c[0] | 0, c[1] | 0, c[2] | 0, (c[3] ?? 255) | 0]);
        while (merged.length < size)
          merged.push(base[merged.length]);
        img.palette = merged;
      }
    } else if (img.palette.length > size)
      img.palette = img.palette.slice(0, size);
  }

  function nearestPaletteIndex(palette, r, g, b, a = 255) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; ++i) {
      const p = palette[i];
      const dr = r - p[0];
      const dg = g - p[1];
      const db = b - p[2];
      const da = a - (p[3] ?? 255);
      const d = dr * dr + dg * dg + db * db + da * da;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function countDistinctOpaqueColors(img) {
    if (!img || !img.imageData)
      return 0;
    if (DrawingQuantization && DrawingQuantization.countDistinctOpaqueColors)
      return DrawingQuantization.countDistinctOpaqueColors(img.imageData, 4096);
    const seen = new Set();
    const d = img.imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128)
        continue;
      seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      if (seen.size > 4096)
        return seen.size;
    }
    return seen.size;
  }

  function collectOpaquePixels(img, maxSamples = 16384) {
    const d = img.imageData.data;
    const pixelCount = d.length >> 2;
    const step = Math.max(1, Math.ceil(pixelCount / maxSamples));
    const out = [];
    for (let p = 0; p < pixelCount; p += step) {
      const i = p << 2;
      if (d[i + 3] < 128)
        continue;
      out.push([d[i], d[i + 1], d[i + 2]]);
    }
    return out;
  }

  function dedupePalette(colors, maxColors) {
    const out = [];
    const seen = new Set();
    for (const c of colors) {
      const key = (clamp8(c[0]) << 16) | (clamp8(c[1]) << 8) | clamp8(c[2]);
      if (seen.has(key))
        continue;
      seen.add(key);
      out.push([clamp8(c[0]), clamp8(c[1]), clamp8(c[2]), 255]);
      if (out.length >= maxColors)
        break;
    }
    return out;
  }

  function buildPopularityPalette(img, maxColors) {
    const pixels = collectOpaquePixels(img, 65536);
    if (pixels.length === 0)
      return [];
    const bins = new Map();
    for (const p of pixels) {
      const key = ((p[0] >> 3) << 10) | ((p[1] >> 3) << 5) | (p[2] >> 3);
      let b = bins.get(key);
      if (!b) {
        b = { count: 0, r: 0, g: 0, b: 0 };
        bins.set(key, b);
      }
      b.count++;
      b.r += p[0];
      b.g += p[1];
      b.b += p[2];
    }
    const ranked = [...bins.values()].sort((a, b) => b.count - a.count);
    const colors = [];
    for (let i = 0; i < ranked.length && colors.length < maxColors; ++i) {
      const bin = ranked[i];
      colors.push([
        Math.round(bin.r / bin.count),
        Math.round(bin.g / bin.count),
        Math.round(bin.b / bin.count)
      ]);
    }
    return dedupePalette(colors, maxColors);
  }

  function buildMedianCutPalette(img, maxColors) {
    const pixels = collectOpaquePixels(img, 65536);
    if (pixels.length === 0)
      return [];

    const boxes = [{ pixels }];
    const getRange = (arr, c) => {
      let lo = 255, hi = 0;
      for (const p of arr) {
        if (p[c] < lo) lo = p[c];
        if (p[c] > hi) hi = p[c];
      }
      return hi - lo;
    };

    while (boxes.length < maxColors) {
      let bestIdx = -1;
      let bestRange = -1;
      let bestChannel = 0;
      for (let i = 0; i < boxes.length; ++i) {
        const arr = boxes[i].pixels;
        if (arr.length < 2)
          continue;
        const rr = getRange(arr, 0);
        const rg = getRange(arr, 1);
        const rb = getRange(arr, 2);
        const range = Math.max(rr, rg, rb);
        if (range > bestRange) {
          bestRange = range;
          bestIdx = i;
          bestChannel = rr >= rg && rr >= rb ? 0 : (rg >= rb ? 1 : 2);
        }
      }
      if (bestIdx < 0)
        break;

      const bucket = boxes[bestIdx].pixels.slice().sort((a, b) => a[bestChannel] - b[bestChannel]);
      const mid = bucket.length >> 1;
      const left = bucket.slice(0, mid);
      const right = bucket.slice(mid);
      if (left.length === 0 || right.length === 0)
        break;
      boxes.splice(bestIdx, 1, { pixels: left }, { pixels: right });
    }

    const colors = boxes.map(box => {
      let r = 0, g = 0, b = 0;
      for (const p of box.pixels) {
        r += p[0];
        g += p[1];
        b += p[2];
      }
      const n = Math.max(1, box.pixels.length);
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    });
    return dedupePalette(colors, maxColors);
  }

  function buildPaletteForImage(img, paletteSize, quantizer = 'keep') {
    let palette = [];
    if (quantizer === 'keep') {
      ensureImagePalette(img);
      palette = clonePalette(img.palette) || [];
    } else if (quantizer === 'uniform')
      palette = createDefaultPaletteForBpp(img.bpp) || [];
    else if (quantizer === 'popularity')
      palette = buildPopularityPalette(img, paletteSize);
    else
      palette = buildMedianCutPalette(img, paletteSize);

    palette = dedupePalette(palette, paletteSize);
    const fallback = createDefaultPaletteForBpp(img.bpp) || [];
    for (let i = 0; palette.length < paletteSize && i < fallback.length; ++i)
      palette.push([fallback[i][0], fallback[i][1], fallback[i][2], 255]);
    while (palette.length < paletteSize)
      palette.push([0, 0, 0, 255]);
    if (palette.length > paletteSize)
      palette = palette.slice(0, paletteSize);
    return palette;
  }

  function quantizeImageToPalette(img, palette, dither = 'none') {
    if (!palette || palette.length === 0)
      return;
    if (DrawingQuantization && DrawingQuantization.quantizeToPalette) {
      DrawingQuantization.quantizeToPalette({
        imageData: img.imageData,
        palette,
        dither
      });
      return;
    }
    const d = img.imageData.data;
    const w = img.width;
    const h = img.height;

    if (dither === 'bayer4') {
      const bayer4 = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
      ];
      const strength = 48;
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const i = (y * w + x) * 4;
          if (d[i + 3] < 128) {
            d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0;
            continue;
          }
          const t = ((bayer4[y & 3][x & 3] - 7.5) / 16) * strength;
          const r = clamp8(d[i] + t);
          const g = clamp8(d[i + 1] + t);
          const b = clamp8(d[i + 2] + t);
          const idx = nearestPaletteIndex(palette, r, g, b, 255);
          const p = palette[idx];
          d[i] = p[0];
          d[i + 1] = p[1];
          d[i + 2] = p[2];
          d[i + 3] = 255;
        }
      return;
    }

    const useDiffusion = dither === 'floyd-steinberg' || dither === 'atkinson';
    if (!useDiffusion) {
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) {
          d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0;
          continue;
        }
        const idx = nearestPaletteIndex(palette, d[i], d[i + 1], d[i + 2], 255);
        const p = palette[idx];
        d[i] = p[0];
        d[i + 1] = p[1];
        d[i + 2] = p[2];
        d[i + 3] = 255;
      }
      return;
    }

    const errR = new Float32Array(w * h);
    const errG = new Float32Array(w * h);
    const errB = new Float32Array(w * h);
    const kernel = dither === 'atkinson'
      ? { divisor: 8, data: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] }
      : { divisor: 16, data: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] };

    for (let y = 0; y < h; ++y) {
      const reverse = (y & 1) === 1;
      const xStart = reverse ? (w - 1) : 0;
      const xEnd = reverse ? -1 : w;
      const xStep = reverse ? -1 : 1;
      for (let x = xStart; x !== xEnd; x += xStep) {
        const pi = y * w + x;
        const i = pi * 4;
        if (d[i + 3] < 128) {
          d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0;
          continue;
        }
        const rr = clamp8(d[i] + errR[pi]);
        const gg = clamp8(d[i + 1] + errG[pi]);
        const bb = clamp8(d[i + 2] + errB[pi]);
        const idx = nearestPaletteIndex(palette, rr, gg, bb, 255);
        const p = palette[idx];
        d[i] = p[0];
        d[i + 1] = p[1];
        d[i + 2] = p[2];
        d[i + 3] = 255;

        const er = rr - p[0];
        const eg = gg - p[1];
        const eb = bb - p[2];
        for (const k of kernel.data) {
          const dx = reverse ? -k[0] : k[0];
          const nx = x + dx;
          const ny = y + k[1];
          if (nx < 0 || nx >= w || ny < 0 || ny >= h)
            continue;
          const ni = ny * w + nx;
          const wgt = k[2] / kernel.divisor;
          errR[ni] += er * wgt;
          errG[ni] += eg * wgt;
          errB[ni] += eb * wgt;
        }
      }
    }
  }

  function applyBppConstraints(img, options = {}) {
    if (!img)
      return;
    const quantizer = options.quantizer || 'keep';
    const dither = options.dither || 'none';
    if (img.bpp <= 8) {
      const paletteSize = getPaletteSizeForBpp(img.bpp);
      const palette = DrawingQuantization && DrawingQuantization.createIndexedPalette
        ? DrawingQuantization.createIndexedPalette({
          imageData: img.imageData,
          quantizer,
          paletteSize,
          currentPalette: img.palette || [],
          fallbackPalette: createDefaultPaletteForBpp(img.bpp) || []
        })
        : buildPaletteForImage(img, paletteSize, quantizer);
      img.palette = palette;
      quantizeImageToPalette(img, palette, dither);
    } else if (img.bpp === 24) {
      const d = img.imageData.data;
      for (let i = 0; i < d.length; i += 4)
        d[i + 3] = d[i + 3] < 128 ? 0 : 255;
      img.palette = null;
    } else
      img.palette = null;
  }

  function cloneImageForProcessing(img) {
    return {
      width: img.width,
      height: img.height,
      bpp: img.bpp,
      imageData: new ImageData(new Uint8ClampedArray(img.imageData.data), img.width, img.height),
      palette: clonePalette(img.palette)
    };
  }

  function scaleImageData(srcImageData, targetW, targetH, mode) {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcImageData.width;
    srcCanvas.height = srcImageData.height;
    srcCanvas.getContext('2d').putImageData(srcImageData, 0, 0);
    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = targetW;
    dstCanvas.height = targetH;
    const dctx = dstCanvas.getContext('2d');
    dctx.imageSmoothingEnabled = mode !== 'nearest';
    dctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
    return dctx.getImageData(0, 0, targetW, targetH);
  }

  function drawPreviewFit(canvas, imageData) {
    const cctx = canvas.getContext('2d');
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    const tmp = document.createElement('canvas');
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    tmp.getContext('2d').putImageData(imageData, 0, 0);
    const scale = Math.min(canvas.width / imageData.width, canvas.height / imageData.height);
    const dw = Math.round(imageData.width * scale);
    const dh = Math.round(imageData.height * scale);
    const dx = Math.floor((canvas.width - dw) * 0.5);
    const dy = Math.floor((canvas.height - dh) * 0.5);
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(tmp, dx, dy, dw, dh);
  }

  function drawImageDataPreview(canvas, imageData) {
    if (!canvas || !imageData)
      return;
    const cctx = canvas.getContext('2d');
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    const tmp = document.createElement('canvas');
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    tmp.getContext('2d').putImageData(imageData, 0, 0);
    const scale = Math.max(1, Math.floor(Math.min(canvas.width / imageData.width, canvas.height / imageData.height)));
    const dw = imageData.width * scale;
    const dh = imageData.height * scale;
    const dx = Math.floor((canvas.width - dw) * 0.5);
    const dy = Math.floor((canvas.height - dh) * 0.5);
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(tmp, dx, dy, dw, dh);
  }

  function getEffectiveCurrentColor(button = 0) {
    return getEffectiveColorFor(button === 2 ? backgroundColor : foregroundColor);
  }

  // ── Unified Quantizer / Ditherer picker ────────────────────────
  //
  // Used by both depth-reduction and add-image-with-fill.
  // Shows two independent panels: a quantizer list with thumbnails
  // on the left and a ditherer grid with thumbnails on the right.
  // A combined preview updates when either selection changes.
  //
  // To avoid timeouts the source image is downscaled to at most
  // 64x64 for all preview operations (palette computation and
  // per-cell quantization).
  // Ditherers whose thumbnail rendering exceeded 2 s are remembered
  // so that subsequent dialog opens skip their thumbnails entirely.
  const _slowDitherIds = new Set();

  async function showQuantizeDitherDialog(sourceImageData, targetBpp, description) {
    const dlg = document.getElementById('dlg-dq-picker');
    const infoEl = document.getElementById('dq-picker-info');
    const quantList = document.getElementById('dq-quant-list');
    const ditherGrid = document.getElementById('dq-dither-grid');
    const previewCanvas = document.getElementById('dq-combined-preview');
    const okBtn = document.getElementById('dq-btn-ok');

    infoEl.textContent = description || '';

    // Downscale source for fast preview generation
    const MAX_PREVIEW = 64;
    let previewSrc = sourceImageData;
    if (sourceImageData.width > MAX_PREVIEW || sourceImageData.height > MAX_PREVIEW) {
      const s = Math.min(MAX_PREVIEW / sourceImageData.width, MAX_PREVIEW / sourceImageData.height);
      previewSrc = scaleImageData(sourceImageData, Math.max(1, Math.round(sourceImageData.width * s)), Math.max(1, Math.round(sourceImageData.height * s)), 'nearest');
    }

    const paletteSize = getPaletteSizeForBpp(targetBpp);
    const paletteCache = new Map();
    let selectedQuantizer = null;
    let selectedDither = null;
    let ditherGenId = 0;
    let quantGenId = 0;
    let previewGenId = 0;

    okBtn.disabled = true;

    function computePalette(quantizerId) {
      if (paletteCache.has(quantizerId))
        return paletteCache.get(quantizerId);
      let palette;
      try {
        const srcImg = { width: previewSrc.width, height: previewSrc.height, bpp: targetBpp, imageData: previewSrc, palette: createDefaultPaletteForBpp(targetBpp) };
        palette = DrawingQuantization && DrawingQuantization.createIndexedPalette
          ? DrawingQuantization.createIndexedPalette({ imageData: previewSrc, quantizer: quantizerId, paletteSize, currentPalette: [], fallbackPalette: createDefaultPaletteForBpp(targetBpp) || [] })
          : buildPaletteForImage(srcImg, paletteSize, quantizerId);
      } catch (e) {
        palette = createDefaultPaletteForBpp(targetBpp) || [];
      }
      paletteCache.set(quantizerId, palette);
      return palette;
    }

    function renderQuantized(canvas, palette, ditherId) {
      try {
        const clone = { width: previewSrc.width, height: previewSrc.height, imageData: new ImageData(new Uint8ClampedArray(previewSrc.data), previewSrc.width, previewSrc.height) };
        quantizeImageToPalette(clone, palette, ditherId);
        drawPreviewFit(canvas, clone.imageData);
      } catch (e) {}
    }

    function updateCombinedPreview() {
      if (!selectedQuantizer || !selectedDither) return;
      const gen = ++previewGenId;
      const ctx = previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      ctx.fillStyle = '#999';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '10px sans-serif';
      ctx.fillText('Rendering\u2026', previewCanvas.width / 2, previewCanvas.height / 2);
      setTimeout(() => {
        if (gen !== previewGenId) return;
        const palette = computePalette(selectedQuantizer);
        renderQuantized(previewCanvas, palette, selectedDither);
      }, 0);
    }

    function updateOkState() {
      okBtn.disabled = !selectedQuantizer || !selectedDither;
    }

    // ── Build quantizer list ──────────────────────────────────────
    quantList.innerHTML = '';
    const defaultDitherId = DITHER_OPTIONS[0] ? DITHER_OPTIONS[0].id : 'none';

    for (const q of QUANTIZER_OPTIONS) {
      const item = document.createElement('div');
      item.className = 'dq-quant-item';
      item.dataset.id = q.id;
      item.title = q.name;

      const cvs = document.createElement('canvas');
      cvs.width = 48;
      cvs.height = 48;
      item.appendChild(cvs);

      const lbl = document.createElement('span');
      lbl.textContent = q.name;
      item.appendChild(lbl);

      item.addEventListener('click', () => {
        quantList.querySelectorAll('.dq-quant-item.selected').forEach(c => c.classList.remove('selected'));
        item.classList.add('selected');
        selectedQuantizer = q.id;
        updateOkState();
        regenerateDitherPreviews();
        updateCombinedPreview();
      });

      item.addEventListener('dblclick', () => {
        selectedQuantizer = q.id;
        if (selectedDither) {
          okBtn.disabled = false;
          dlg.querySelector('[data-result="ok"]').click();
        }
      });

      quantList.appendChild(item);
    }

    // Generate quantizer thumbnails in batches
    (function generateQuantThumbs() {
      const items = Array.from(quantList.children);
      const currentGen = ++quantGenId;
      let idx = 0;
      function batch() {
        if (currentGen !== quantGenId) return;
        const end = Math.min(idx + 2, items.length);
        for (let i = idx; i < end; ++i) {
          if (currentGen !== quantGenId) return;
          const item = items[i];
          const qId = item.dataset.id;
          const cvs = item.querySelector('canvas');
          const palette = computePalette(qId);
          renderQuantized(cvs, palette, defaultDitherId);
        }
        idx = end;
        if (idx < items.length)
          setTimeout(batch, 16);
      }
      batch();
    })();

    // ── Build ditherer grid ───────────────────────────────────────
    ditherGrid.innerHTML = '';

    for (const d of DITHER_OPTIONS) {
      const cell = document.createElement('div');
      cell.className = 'dq-cell';
      cell.dataset.id = d.id;
      cell.title = d.name;

      const cvs = document.createElement('canvas');
      cvs.width = 48;
      cvs.height = 48;
      cell.appendChild(cvs);

      const lbl = document.createElement('div');
      lbl.className = 'dq-cell-label';
      lbl.textContent = d.name;
      cell.appendChild(lbl);

      cell.addEventListener('click', () => {
        ditherGrid.querySelectorAll('.dq-cell.selected').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        selectedDither = d.id;
        updateOkState();
        updateCombinedPreview();
      });

      cell.addEventListener('dblclick', () => {
        selectedDither = d.id;
        if (selectedQuantizer) {
          okBtn.disabled = false;
          dlg.querySelector('[data-result="ok"]').click();
        }
      });

      ditherGrid.appendChild(cell);
    }

    function _drawPlaceholder(canvas, line1, line2) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#999';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '9px sans-serif';
      if (line2) {
        ctx.fillText(line1, canvas.width / 2, canvas.height / 2 - 6);
        ctx.fillText(line2, canvas.width / 2, canvas.height / 2 + 6);
      } else
        ctx.fillText(line1, canvas.width / 2, canvas.height / 2);
    }

    function regenerateDitherPreviews() {
      if (!selectedQuantizer) return;
      const currentGen = ++ditherGenId;
      const palette = computePalette(selectedQuantizer);
      const cells = Array.from(ditherGrid.children);
      let idx = 0;
      function step() {
        if (currentGen !== ditherGenId || idx >= cells.length) return;
        const cell = cells[idx];
        const cvs = cell.querySelector('canvas');
        const dId = cell.dataset.id;
        if (_slowDitherIds.has(dId)) {
          _drawPlaceholder(cvs, '(select to', 'preview)');
        } else {
          const t0 = performance.now();
          renderQuantized(cvs, palette, dId);
          if (performance.now() - t0 > 2000)
            _slowDitherIds.add(dId);
        }
        ++idx;
        if (idx < cells.length)
          setTimeout(step, 0);
      }
      step();
    }

    // Pre-select a sensible default quantizer
    const defaultQId = (function () {
      for (const id of ['MedianCut', 'median-cut', 'Wu', 'Popularity']) {
        const match = QUANTIZER_OPTIONS.find(q => q.id.toLowerCase() === id.toLowerCase());
        if (match) return match.id;
      }
      return QUANTIZER_OPTIONS[0] ? QUANTIZER_OPTIONS[0].id : null;
    })();

    if (defaultQId) {
      const defaultItem = quantList.querySelector('[data-id="' + defaultQId + '"]');
      if (defaultItem) {
        defaultItem.classList.add('selected');
        defaultItem.scrollIntoView({ block: 'nearest' });
        selectedQuantizer = defaultQId;
        regenerateDitherPreviews();
      }
    }

    const result = await SZ.Dialog.show('dlg-dq-picker');
    ++ditherGenId;
    ++quantGenId;
    ++previewGenId;
    if (result !== 'ok' || !selectedQuantizer || !selectedDither)
      return { cancelled: true };
    return { cancelled: false, quantizer: selectedQuantizer, dither: selectedDither };
  }

  async function applyDepthChange(targetBpp) {
    const img = currentImage();
    if (!img)
      return;
    const oldBpp = img.bpp;
    if (targetBpp === oldBpp) {
      depthSelect.value = String(oldBpp);
      return;
    }

    let options = {};
    const decreasing = targetBpp < oldBpp;
    if (decreasing) {
      syncImageData();
      const maxColorsAfter = getPaletteSizeForBpp(targetBpp) || 16777216;
      const colorsBefore = countDistinctOpaqueColors(img);
      const desc = 'Reducing ' + oldBpp + 'bpp \u2192 ' + targetBpp + 'bpp (up to ' + maxColorsAfter + ' colors, ' + colorsBefore + ' detected).';
      const result = await showQuantizeDitherDialog(img.imageData, targetBpp, desc);
      if (result.cancelled) {
        depthSelect.value = String(oldBpp);
        return;
      }
      options = { quantizer: result.quantizer, dither: result.dither };
    } else if (targetBpp <= 8)
      options = { quantizer: 'keep', dither: 'none' };

    pushUndo();
    img.bpp = targetBpp;
    applyBppConstraints(img, options);
    ctx.putImageData(img.imageData, 0, 0);
    buildPalette();
    refreshImageList();
    infoDepth.textContent = img.bpp + '-bit';
    statusImageInfo.textContent = img.width + ' x ' + img.height + ', ' + img.bpp + 'bpp';
    foregroundColor = getEffectiveColorFor(foregroundColor);
    backgroundColor = getEffectiveColorFor(backgroundColor);
    currentColor = cloneColor(getSlotColor(activeColorSlot));
    updateColorUI();
    dirty = true;
    updateTitle();
  }

  function applyPaletteSlotColor(idx, rgb) {
    const img = currentImage();
    if (!img || !img.palette || idx < 0 || idx >= img.palette.length)
      return;
    pushUndo();
    const old = img.palette[idx];
    const next = [rgb.r, rgb.g, rgb.b, 255];
    img.palette[idx] = next;
    const d = img.imageData.data;
    for (let j = 0; j < d.length; j += 4) {
      if (d[j] === old[0] && d[j + 1] === old[1] && d[j + 2] === old[2] && d[j + 3] >= 128) {
        d[j] = next[0];
        d[j + 1] = next[1];
        d[j + 2] = next[2];
        d[j + 3] = 255;
      }
    }
    ctx.putImageData(img.imageData, 0, 0);
    refreshImageList();
    dirty = true;
    updateTitle();
    buildPalette();
  }

  function openSystemColorPicker(hex, mode = 'slot', paletteIndex = -1) {
    const returnKey = 'sz:icon-editor:colorpick:' + Date.now() + ':' + Math.random().toString(36).slice(2);
    colorPickerRequest = {
      returnKey,
      mode,
      paletteIndex,
      slot: activeColorSlot
    };
    try {
      User32.PostMessage('sz:launchApp', {
        appId: 'color-picker',
        urlParams: {
          returnKey,
          hex: hex || '#000000'
        }
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function openPaletteSlotEditor(idx) {
    const img = currentImage();
    if (!systemColorPicker || !img || !img.palette || idx < 0 || idx >= img.palette.length)
      return;
    const p = img.palette[idx];
    const hex = '#' + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
    openSystemColorPicker(hex, 'palette', idx);
  }

  window.addEventListener('storage', (e) => {
    if (!colorPickerRequest || !e || e.key !== colorPickerRequest.returnKey || !e.newValue)
      return;
    let payload = null;
    try {
      payload = JSON.parse(e.newValue);
    } catch (_) {
      return;
    }
    if (!payload || payload.type !== 'color-picker-result')
      return;
    const r = clamp8(payload.r);
    const g = clamp8(payload.g);
    const b = clamp8(payload.b);
    const a = clamp8(payload.a == null ? 255 : payload.a);

    if (colorPickerRequest.mode === 'palette' && Number.isInteger(colorPickerRequest.paletteIndex))
      applyPaletteSlotColor(colorPickerRequest.paletteIndex, { r, g, b, a });
    else {
      const slot = colorPickerRequest.slot === 'bg' ? 'bg' : 'fg';
      setSlotColor(slot, getEffectiveColorFor({ r, g, b, a }));
      setActiveColorSlot(slot);
      updateColorUI();
      buildPalette();
    }

    try {
      localStorage.removeItem(colorPickerRequest.returnKey);
    } catch (_) {
    }
    colorPickerRequest = null;
  });

  function buildPalette() {
    paletteGrid.innerHTML = '';
    const img = currentImage();
    const indexed = img && img.bpp <= 8;
    if (indexed)
      ensureImagePalette(img);
    const colors = indexed
      ? img.palette.map(c => '#' + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1))
      : PALETTE_COLORS;

    for (let i = 0; i < colors.length; ++i) {
      const c = colors[i];
      const swatch = document.createElement('div');
      swatch.className = 'palette-swatch';
      swatch.style.background = c;
      swatch.dataset.color = c;
      const parsed = parseHexColor(c);
      if (parsed) {
        if (parsed.r === foregroundColor.r && parsed.g === foregroundColor.g && parsed.b === foregroundColor.b)
          swatch.classList.add('fg');
        if (parsed.r === backgroundColor.r && parsed.g === backgroundColor.g && parsed.b === backgroundColor.b)
          swatch.classList.add('bg');
      }
      if (indexed)
        swatch.dataset.index = String(i);
      swatch.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.button !== 2)
          return;
        if (parsed) {
          const slot = e.button === 2 ? 'bg' : 'fg';
          const alpha = slot === 'bg' ? backgroundColor.a : foregroundColor.a;
          setActiveColorSlot(slot);
          setSlotColor(slot, { r: parsed.r, g: parsed.g, b: parsed.b, a: indexed ? 255 : alpha });
          updateColorUI();
        }
      });
      swatch.addEventListener('contextmenu', (e) => e.preventDefault());
      swatch.addEventListener('dblclick', (e) => {
        if (!indexed || !systemColorPicker)
          return;
        e.preventDefault();
        const idx = parseInt(swatch.dataset.index, 10);
        if (isNaN(idx))
          return;
        openPaletteSlotEditor(idx);
      });
      swatch.addEventListener('pointerup', (e) => {
        if (!indexed || !systemColorPicker || e.pointerType !== 'touch')
          return;
        const idx = parseInt(swatch.dataset.index, 10);
        if (isNaN(idx))
          return;
        const now = Date.now();
        const isDoubleTap = lastPaletteTouchTap.idx === idx && (now - lastPaletteTouchTap.ts) <= 420;
        lastPaletteTouchTap = { idx, ts: now };
        if (!isDoubleTap)
          return;
        e.preventDefault();
        openPaletteSlotEditor(idx);
      });
      paletteGrid.appendChild(swatch);
    }
  }

  if (systemColorPicker) {
    systemColorPicker.addEventListener('input', () => {
      const parsed = parseHexColor(systemColorPicker.value);
      if (!parsed)
        return;
      if (pickerMode === 'palette' && pickerPaletteIndex >= 0) {
        applyPaletteSlotColor(pickerPaletteIndex, parsed);
        pickerPaletteIndex = -1;
        pickerMode = 'slot';
        return;
      }
      currentColor.r = parsed.r;
      currentColor.g = parsed.g;
      currentColor.b = parsed.b;
      currentColor = getEffectiveColorFor(currentColor);
      setSlotColor(activeColorSlot, currentColor);
      updateColorUI();
      buildPalette();
    });
  }

  if (fgColorSlot)
    fgColorSlot.addEventListener('pointerdown', (e) => {
      if (e.button !== 0)
        return;
      e.preventDefault();
      setActiveColorSlot('fg');
    });
  if (fgColorSlot)
    fgColorSlot.addEventListener('dblclick', (e) => {
      e.preventDefault();
      setActiveColorSlot('fg');
      const c = foregroundColor;
      const hex = '#' + ((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1);
      openSystemColorPicker(hex, 'slot', -1);
    });

  if (bgColorSlot)
    bgColorSlot.addEventListener('pointerdown', (e) => {
      if (e.button !== 0)
        return;
      e.preventDefault();
      setActiveColorSlot('bg');
    });
  if (bgColorSlot)
    bgColorSlot.addEventListener('dblclick', (e) => {
      e.preventDefault();
      setActiveColorSlot('bg');
      const c = backgroundColor;
      const hex = '#' + ((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1);
      openSystemColorPicker(hex, 'slot', -1);
    });

  depthSelect.addEventListener('change', async () => {
    const img = currentImage();
    if (!img)
      return;
    const targetBpp = parseInt(depthSelect.value, 10);
    if (!Number.isFinite(targetBpp)) {
      depthSelect.value = String(img.bpp);
      return;
    }
    await applyDepthChange(targetBpp);
  });

  // ══════════════════════════════════════════════════════════════════
  // UNDO / REDO
  // ══════════════════════════════════════════════════════════════════

  function pushUndo() {
    const img = currentImage();
    if (!img)
      return;
    undoStack.push({
      imageData: new ImageData(new Uint8ClampedArray(img.imageData.data), img.width, img.height),
      bpp: img.bpp,
      palette: clonePalette(img.palette)
    });
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
    redoStack.push({
      imageData: new ImageData(new Uint8ClampedArray(img.imageData.data), img.width, img.height),
      bpp: img.bpp,
      palette: clonePalette(img.palette)
    });
    const state = undoStack.pop();
    const sizeChanged = img.width !== state.imageData.width || img.height !== state.imageData.height;
    img.imageData = state.imageData;
    img.width = state.imageData.width;
    img.height = state.imageData.height;
    img.bpp = state.bpp || img.bpp;
    img.palette = clonePalette(state.palette);
    if (sizeChanged) {
      mainCanvas.width = state.imageData.width;
      mainCanvas.height = state.imageData.height;
      overlayCanvas.width = state.imageData.width;
      overlayCanvas.height = state.imageData.height;
    }
    ctx.putImageData(state.imageData, 0, 0);
    if (sizeChanged) {
      setZoom(zoom);
      renderChecker();
      updateImageInfoDisplay();
    }
    depthSelect.value = String(img.bpp);
    buildPalette();
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
    undoStack.push({
      imageData: new ImageData(new Uint8ClampedArray(img.imageData.data), img.width, img.height),
      bpp: img.bpp,
      palette: clonePalette(img.palette)
    });
    const state = redoStack.pop();
    const sizeChanged = img.width !== state.imageData.width || img.height !== state.imageData.height;
    img.imageData = state.imageData;
    img.width = state.imageData.width;
    img.height = state.imageData.height;
    img.bpp = state.bpp || img.bpp;
    img.palette = clonePalette(state.palette);
    if (sizeChanged) {
      mainCanvas.width = state.imageData.width;
      mainCanvas.height = state.imageData.height;
      overlayCanvas.width = state.imageData.width;
      overlayCanvas.height = state.imageData.height;
    }
    ctx.putImageData(state.imageData, 0, 0);
    if (sizeChanged) {
      setZoom(zoom);
      renderChecker();
      updateImageInfoDisplay();
    }
    depthSelect.value = String(img.bpp);
    buildPalette();
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
    const c = getEffectiveCurrentColor(activePointerButton);
    paintBrush(img.imageData, x, y, c.r, c.g, c.b, c.a, brushSize);
    ctx.putImageData(img.imageData, 0, 0);
  }

  function erasePixel(x, y) {
    const img = currentImage();
    if (!img)
      return;
    paintBrush(img.imageData, x, y, 0, 0, 0, 0, brushSize);
    ctx.putImageData(img.imageData, 0, 0);
  }

  function eyedropperAt(x, y, button = 0) {
    const img = currentImage();
    if (!img)
      return;
    const px = getPixel(img.imageData, x, y);
    const slot = button === 2 ? 'bg' : 'fg';
    const sampled = { r: px[0], g: px[1], b: px[2], a: px[3] };
    setSlotColor(slot, sampled);
    if (activeColorSlot === slot)
      currentColor = cloneColor(sampled);
    updateColorUI();
    buildPalette();
  }

  function floodFill(startX, startY) {
    const img = currentImage();
    if (!img)
      return;
    const w = img.width;
    const h = img.height;
    const data = img.imageData.data;
    const target = getPixel(img.imageData, startX, startY);
    const c = getEffectiveCurrentColor(activePointerButton);
    const fill = [c.r, c.g, c.b, c.a];

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
    const { r, g, b, a } = getEffectiveCurrentColor(activePointerButton);
    drawShapeToImageData(oImg, tool, x0, y0, x1, y1, r, g, b, a);
    octx.putImageData(oImg, 0, 0);
  }

  function commitShapeOverlay(tool, x0, y0, x1, y1) {
    const img = currentImage();
    if (!img)
      return;
    const { r, g, b, a } = getEffectiveCurrentColor(activePointerButton);
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
    if (e.button !== 0 && e.button !== 2)
      return;
    if (currentTool === 'select' && e.button !== 0)
      return;
    e.preventDefault();
    activePointerButton = e.button;
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
      eyedropperAt(x, y, activePointerButton);
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
      eyedropperAt(x, y, activePointerButton);
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
    if (IconCodec && IconCodec.parseICO) {
      return IconCodec.parseICO(buffer, {
        imageDataFactory: (w, h) => new ImageData(w, h)
      });
    }
    throw new Error('Icon codec not available');
  }

  function decodeBmpEntry(data, wHint, hHint, bppHint) {
    if (IconCodec && IconCodec.decodeBmpEntry) {
      return IconCodec.decodeBmpEntry(data, wHint, hHint, bppHint, {
        imageDataFactory: (w, h) => new ImageData(w, h)
      });
    }
    throw new Error('Icon codec not available');
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
    if (IconCodec && IconCodec.writeICO) {
      return IconCodec.writeICO(doc, {
        encodePngEntry,
        ensureImagePalette,
        createDefaultPaletteForBpp,
        nearestPaletteIndex
      });
    }
    throw new Error('Icon codec not available');
  }

  function encodeBmpEntry(img) {
    if (IconCodec && IconCodec.encodeBmpEntry) {
      return IconCodec.encodeBmpEntry(img, {
        ensureImagePalette,
        createDefaultPaletteForBpp,
        nearestPaletteIndex
      });
    }
    throw new Error('Icon codec not available');
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
    if (!result.cancelled && (result.path || result.content != null))
      loadFile(result.path || null, result.content);
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

    currentFilePath = path || null;
    if (path) {
      const parts = String(path).split(/[\\/]/);
      currentFileName = parts[parts.length - 1] || 'Untitled';
    } else
      currentFileName = 'Untitled.ico';
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
      await saveToPath(result.path, callback);
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
    if (result.cancelled || (!result.path && result.content == null))
      return;

    let content = result.content;
    if (content == null) {
      try {
        content = await Kernel32.ReadAllBytes(result.path);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
        return;
      }
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

    const sourcePath = result.path || 'extracted';
    if (docs.length === 1) {
      loadExtractedDoc(docs[0], sourcePath);
      return;
    }

    const chosen = await showPEBrowserDialog(docs, sourcePath);
    if (chosen === 'export-all')
      exportAllIconGroups(docs, sourcePath);
    else if (chosen)
      loadExtractedDoc(chosen, sourcePath);
  }

  function loadExtractedDoc(doc, sourcePath) {
    iconDocument = doc;
    if (iconDocument.images.length === 0)
      addImage(DEFAULT_SIZE, DEFAULT_SIZE, DEFAULT_BPP);
    const parts = String(sourcePath || 'extracted').split(/[\\/]/);
    currentFileName = (parts[parts.length - 1] || 'extracted').replace(/\.(exe|dll)$/i, '') + '.ico';
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
        SZ.Dialog.close('dlg-pe-browser');
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

      SZ.Dialog.show('dlg-pe-browser').then((result) => {
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
    const parts = String(sourcePath || 'extracted').split(/[\\/]/);
    const baseName = (parts[parts.length - 1] || 'extracted').replace(/\.(exe|dll)$/i, '');
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
    if (result.cancelled || (!result.path && result.content == null))
      return;

    let content = result.content;
    if (content == null) {
      try {
        content = await Kernel32.ReadAllBytes(result.path);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
        return;
      }
    }

    function detectImageMime(path, bytes, text) {
      const fileName = String(path || '').toLowerCase();
      if (fileName.endsWith('.png')) return 'image/png';
      if (fileName.endsWith('.bmp')) return 'image/bmp';
      if (fileName.endsWith('.gif')) return 'image/gif';
      if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
      if (fileName.endsWith('.svg')) return 'image/svg+xml';
      if (bytes && bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47)
        return 'image/png';
      if (bytes && bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4D)
        return 'image/bmp';
      if (bytes && bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF)
        return 'image/jpeg';
      if (bytes && bytes.length >= 6) {
        const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
        if (sig === 'GIF87a' || sig === 'GIF89a')
          return 'image/gif';
      }
      if (typeof text === 'string' && /<svg[\s>]/i.test(text))
        return 'image/svg+xml';
      return 'application/octet-stream';
    }

    let imageSrc = null;
    let tempObjectUrl = null;
    if (typeof content === 'string' && content.startsWith('data:image'))
      imageSrc = content;
    else {
      const buffer = decodeBinaryContent(content, 'binary');
      if (buffer) {
        const bytes = new Uint8Array(buffer);
        const mime = detectImageMime(result.path, bytes, null);
        tempObjectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        imageSrc = tempObjectUrl;
      } else if (typeof content === 'string') {
        const mime = detectImageMime(result.path, null, content);
        if (mime === 'image/svg+xml') {
          tempObjectUrl = URL.createObjectURL(new Blob([content], { type: mime }));
          imageSrc = tempObjectUrl;
        }
      }
    }

    if (!imageSrc) {
      await User32.MessageBox('Not a valid image file.', 'Error', MB_OK | MB_ICONERROR);
      return;
    }

    // Load the image
    const img = new Image();
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSrc;
      });
    } catch (_) {
      await User32.MessageBox('Not a valid image file.', 'Error', MB_OK | MB_ICONERROR);
      return;
    } finally {
      if (tempObjectUrl)
        URL.revokeObjectURL(tempObjectUrl);
    }

    // Show import dialog to select sizes
    const dlg = document.getElementById('dlg-import');
    const resultStr = await SZ.Dialog.show('dlg-import');
    let chosen = null;
    if (resultStr === 'ok') {
      const checks = dlg.querySelectorAll('#import-sizes input[type="checkbox"]:checked');
      chosen = Array.from(checks).map(c => parseInt(c.value, 10));
    }

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

    const faviconResult = await SZ.Dialog.show('dlg-favicon');
    let chosen = null;
    if (faviconResult === 'ok') {
      const checks = dlg.querySelectorAll('#favicon-sizes input[type="checkbox"]:checked');
      chosen = Array.from(checks).map(c => parseInt(c.value, 10));
    }

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

  async function confirmSave() {
    const result = await SZ.Dialog.show('dlg-save-changes');
    if (result === 'yes') {
      await doSave();
      return 'saved';
    }
    if (result === 'no')
      return 'no';
    return 'cancel';
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
  // RIBBON SYSTEM
  // ══════════════════════════════════════════════════════════════════

  function updateMenuStates() {
    const setEnabled = (action, enabled) => {
      document.querySelectorAll('[data-action="' + action + '"]').forEach(el => {
        el.classList.toggle('disabled', !enabled);
      });
    };
    const hasSelection = !!selection;
    const hasClipboard = !!clipboardImageData;
    const hasUndo = undoStack.length > 0;
    const hasRedo = redoStack.length > 0;

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

  // ── Ribbon wiring (shared module) ──────────────────────────────
  new SZ.Ribbon({ onAction: handleAction });
  SZ.Dialog.wireAll();

  // ── Mini palette in ribbon ──────────────────────────────────────
  (function buildMiniPalette() {
    const mini = document.getElementById('mini-palette');
    if (!mini)
      return;
    const first14 = PALETTE_COLORS.slice(0, 14);
    first14.forEach(hex => {
      const sw = document.createElement('div');
      sw.className = 'color-swatch';
      sw.style.background = hex;
      sw.title = hex;
      sw.addEventListener('click', () => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const c = { r, g, b, a: currentColor.a };
        if (activeColorSlot === 'fg') {
          foregroundColor = c;
          currentColor = { ...c };
        } else {
          backgroundColor = c;
          currentColor = { ...c };
        }
        updateColorUI();
      });
      mini.appendChild(sw);
    });
  })();

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
        if (entry)
          entry.classList.toggle('active', showGrid);
        renderOverlayGrid();
        break;
      case 'toggle-checkerboard':
        showCheckerboard = !showCheckerboard;
        if (entry)
          entry.classList.toggle('active', showCheckerboard);
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
        SZ.Dialog.show('dlg-about');
        break;
    }
    updateMenuStates();
  }

  // ══════════════════════════════════════════════════════════════════
  // TOOL SELECTION
  // ══════════════════════════════════════════════════════════════════

  function setTool(tool) {
    if (currentTool === 'select' && tool !== 'select')
      commitSelection();
    currentTool = tool;

    // Update toolbar (ribbon tool grid uses .rb-btn)
    toolGrid.querySelectorAll('.rb-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
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
    const btn = e.target.closest('[data-tool]');
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

  async function showAddImageDialog() {
    const dlg = document.getElementById('dlg-add-image');
    const fillCheck = document.getElementById('add-fill-current');
    const fillMethodRow = document.getElementById('add-fill-method-row');

    document.getElementById('add-width').value = 32;
    document.getElementById('add-height').value = 32;
    fillCheck.checked = false;
    fillMethodRow.style.display = 'none';

    fillCheck.onchange = () => {
      fillMethodRow.style.display = fillCheck.checked ? '' : 'none';
      if (fillCheck.checked) {
        const src = currentImage();
        if (src) {
          document.getElementById('add-width').value = src.width;
          document.getElementById('add-height').value = src.height;
        }
      }
    };

    dlg.querySelectorAll('.preset-sizes button').forEach(btn => {
      btn.onclick = () => {
        const s = parseInt(btn.dataset.size, 10);
        document.getElementById('add-width').value = s;
        document.getElementById('add-height').value = s;
      };
    });

    const result = await SZ.Dialog.show('dlg-add-image');
    if (result !== 'ok')
      return;
    let w = parseInt(document.getElementById('add-width').value, 10);
    let h = parseInt(document.getElementById('add-height').value, 10);
    const bpp = parseInt(document.getElementById('add-depth').value, 10);
    w = Math.max(1, Math.min(256, w || 32));
    h = Math.max(1, Math.min(256, h || 32));
    syncImageData();

    const srcImg = currentImage();
    if (fillCheck.checked && srcImg) {
      const method = document.getElementById('add-fill-method').value;
      const scaledData = scaleImageData(srcImg.imageData, w, h, method);

      let options = {};
      if (bpp <= 8 && bpp < srcImg.bpp) {
        const dqResult = await showQuantizeDitherDialog(scaledData, bpp);
        if (dqResult.cancelled)
          return;
        options = { quantizer: dqResult.quantizer, dither: dqResult.dither };
      } else if (bpp <= 8)
        options = { quantizer: 'keep', dither: 'none' };

      const idx = addImage(w, h, bpp);
      const newImg = iconDocument.images[idx];
      newImg.imageData = scaledData;
      applyBppConstraints(newImg, options);
      selectImage(idx);
    } else {
      const idx = addImage(w, h, bpp);
      selectImage(idx);
    }
    dirty = true;
    updateTitle();
  }

  // ══════════════════════════════════════════════════════════════════
  // DIALOGS
  // ══════════════════════════════════════════════════════════════════

  async function showResizeDialog() {
    const img = currentImage();
    if (!img)
      return;
    const wInput = document.getElementById('resize-w');
    const hInput = document.getElementById('resize-h');
    wInput.value = img.width;
    hInput.value = img.height;
    wInput.focus();

    const result = await SZ.Dialog.show('dlg-resize');
    if (result !== 'ok')
      return;
    let nw = parseInt(wInput.value, 10);
    let nh = parseInt(hInput.value, 10);
    nw = Math.max(1, Math.min(256, nw || img.width));
    nh = Math.max(1, Math.min(256, nh || img.height));
    const mode = document.getElementById('resize-mode').value;
    if (nw !== img.width || nh !== img.height)
      doResize(nw, nh, mode);
  }

  async function showHslDialog() {
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

    const result = await SZ.Dialog.show('dlg-hsl');
    if (result !== 'ok')
      return;
    const h = parseInt(hueInput.value, 10);
    const s = parseInt(satInput.value, 10);
    const b = parseInt(briInput.value, 10);
    if (h !== 0 || s !== 0 || b !== 0)
      doHslAdjust(h, s, b);
  }

  async function showReplaceColorDialog() {
    const { r, g, b, a } = currentColor;
    const fromHex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    document.getElementById('replace-from').value = fromHex;
    document.getElementById('replace-from-a').value = a;
    const result = await SZ.Dialog.show('dlg-replace-color');
    if (result !== 'ok')
      return;
    const from = parseHexColor(document.getElementById('replace-from').value);
    const fromA = parseInt(document.getElementById('replace-from-a').value, 10);
    const to = parseHexColor(document.getElementById('replace-to').value);
    const toA = parseInt(document.getElementById('replace-to-a').value, 10);
    const tolerance = parseInt(document.getElementById('replace-tolerance').value, 10);
    if (from && to)
      doReplaceColor(from.r, from.g, from.b, fromA, to.r, to.g, to.b, toA, tolerance);
  }

  async function showShiftDialog() {
    const img = currentImage();
    if (!img)
      return;
    document.getElementById('shift-dx').value = 0;
    document.getElementById('shift-dy').value = 0;
    document.getElementById('shift-wrap').checked = true;
    const result = await SZ.Dialog.show('dlg-shift');
    if (result !== 'ok')
      return;
    const dx = parseInt(document.getElementById('shift-dx').value, 10) || 0;
    const dy = parseInt(document.getElementById('shift-dy').value, 10) || 0;
    const wrap = document.getElementById('shift-wrap').checked;
    if (dx !== 0 || dy !== 0)
      doShiftImage(dx, dy, wrap);
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
      if (backstage.classList.contains('visible')) {
        backstage.classList.remove('visible');
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
    function pickOption(select, preferredIds) {
      for (const id of preferredIds) {
        const match = Array.from(select.options).find(o => String(o.value).toLowerCase() === String(id).toLowerCase());
        if (match)
          return match.value;
      }
      return select.options[0] ? select.options[0].value : '';
    }
