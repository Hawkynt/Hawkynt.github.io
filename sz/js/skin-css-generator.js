;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const _STYLE_ID = 'sz-skin-frames';

  /**
   * Process all border BMPs from a skin and inject a <style> element that
   * drives the 9-cell window frame entirely through CSS.
   *
   * For static skins (frameCount <= 2) generates simple active/inactive rules.
   * For animated skins (frameCount >= 3) generates @keyframes for active state
   * and a static last-frame rule for inactive state.
   *
   * Returns { startButtonImage: string|null } with the processed start button
   * data URL (magenta transparency applied).
   */
  async function generateSkinCSS(skin) {
    if (!skin?.personality)
      return { startButtonImage: null };

    const p = skin.personality;
    const useTrans = !!p.usestran;

    const borders = [
      { name: 'top', path: p.top, mask: p.topmask, frameCount: p.topframe || 1, zoneA: p.toptopheight || 0, zoneC: p.topbotheight || 0, stretch: !!p.topstretch, horizontal: true },
      { name: 'left', path: p.left, mask: p.leftmask, frameCount: p.leftframe || 1, zoneA: p.lefttopheight || 0, zoneC: p.leftbotheight || 0, stretch: !!p.leftstretch, horizontal: false },
      { name: 'right', path: p.right, mask: p.rightmask, frameCount: p.rightframe || 1, zoneA: p.righttopheight || 0, zoneC: p.rightbotheight || 0, stretch: !!p.rightstretch, horizontal: false },
      { name: 'bottom', path: p.bottom, mask: p.bottommask, frameCount: p.bottomframe || 1, zoneA: p.bottomtopheight || 0, zoneC: p.bottombotheight || 0, stretch: !!p.bottomstretch, horizontal: true },
    ];

    // Load and process all borders in parallel
    const processed = await Promise.all(borders.map(b => _processBorder(b, useTrans)));

    // Process start button
    const startButtonImage = await _processStartButton(skin, useTrans);

    // Build and inject CSS
    const css = _buildCSS(processed, p.anirate || 300);
    _injectStyle(css);

    return { startButtonImage };
  }

  // -------------------------------------------------------------------------
  // Image loading
  // -------------------------------------------------------------------------

  function _loadImage(src) {
    if (!src)
      return Promise.resolve(null);
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // -------------------------------------------------------------------------
  // Magenta transparency
  // -------------------------------------------------------------------------

  function _applyMagentaTransparency(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4)
      if (px[i] === 255 && px[i + 1] === 0 && px[i + 2] === 255)
        px[i + 3] = 0;
    ctx.putImageData(data, 0, 0);
  }

  // -------------------------------------------------------------------------
  // Border processing pipeline
  // -------------------------------------------------------------------------

  async function _processBorder(border, useTrans) {
    const { name, path, mask, frameCount, zoneA, zoneC, stretch, horizontal } = border;

    const [img, maskImg] = await Promise.all([_loadImage(path), _loadImage(mask)]);
    if (!img)
      return { name, frames: [], frameWidth: 0, frameHeight: 0, zoneA: 0, zoneC: 0, stretch, horizontal };

    // TOP/BOTTOM stack frames vertically; LEFT/RIGHT horizontally
    const isVerticalStack = horizontal;
    let fw, fh;
    if (isVerticalStack) {
      fw = img.width;
      fh = Math.floor(img.height / frameCount);
    } else {
      fw = Math.floor(img.width / frameCount);
      fh = img.height;
    }

    const dim = horizontal ? fw : fh;
    const aSize = Math.min(zoneA, dim);
    const cSize = Math.min(zoneC, Math.max(0, dim - aSize));
    const bSize = Math.max(0, dim - aSize - cSize);

    let frames;
    try {
      frames = [];
      for (let i = 0; i < frameCount; ++i) {
        const fc = _extractFrameCanvas(img, i, frameCount, isVerticalStack, useTrans, maskImg);
        frames.push({
          a: _extractZoneURL(fc, 0, aSize, horizontal),
          b: _extractZoneURL(fc, aSize, bSize, horizontal),
          c: _extractZoneURL(fc, aSize + bSize, cSize, horizontal),
        });
      }
    } catch (e) {
      // Canvas tainted (file:// + Chrome) — use raw image as fallback
      console.warn(`[SZ] Canvas processing failed for ${name}, using raw fallback:`, e.message);
      frames = null;
    }

    return { name, frames, frameWidth: fw, frameHeight: fh, zoneA: aSize, zoneC: cSize, bSize, stretch, horizontal, rawPath: path, frameCount };
  }

  function _extractFrameCanvas(img, frameIndex, frameCount, isVerticalStack, useTrans, maskImg) {
    const canvas = document.createElement('canvas');
    let fw, fh, sx, sy;
    if (isVerticalStack) {
      fw = img.width;
      fh = Math.floor(img.height / frameCount);
      sx = 0;
      sy = frameIndex * fh;
    } else {
      fw = Math.floor(img.width / frameCount);
      fh = img.height;
      sx = frameIndex * fw;
      sy = 0;
    }
    canvas.width = fw;
    canvas.height = fh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);

    if (useTrans)
      _applyMagentaTransparency(ctx, fw, fh);

    if (maskImg) {
      // Extract corresponding mask frame
      const mc = document.createElement('canvas');
      mc.width = fw;
      mc.height = fh;
      const mctx = mc.getContext('2d');
      mctx.drawImage(maskImg, sx, sy, fw, fh, 0, 0, fw, fh);
      // Build greyscale alpha from mask frame
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = fw;
      maskCanvas.height = fh;
      const maskCtx = maskCanvas.getContext('2d');
      maskCtx.drawImage(mc, 0, 0);
      const maskData = maskCtx.getImageData(0, 0, fw, fh);
      const mp = maskData.data;
      for (let i = 0; i < mp.length; i += 4) {
        const grey = Math.round(mp[i] * 0.299 + mp[i + 1] * 0.587 + mp[i + 2] * 0.114);
        mp[i] = mp[i + 1] = mp[i + 2] = 255;
        mp[i + 3] = grey;
      }
      maskCtx.putImageData(maskData, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    return canvas;
  }

  function _extractZoneURL(frameCanvas, start, size, isHorizontalCut) {
    if (size <= 0)
      return null;
    const c = document.createElement('canvas');
    if (isHorizontalCut) {
      c.width = size;
      c.height = frameCanvas.height;
      c.getContext('2d').drawImage(frameCanvas, start, 0, size, frameCanvas.height, 0, 0, size, frameCanvas.height);
    } else {
      c.width = frameCanvas.width;
      c.height = size;
      c.getContext('2d').drawImage(frameCanvas, 0, start, frameCanvas.width, size, 0, 0, frameCanvas.width, size);
    }
    return c.toDataURL();
  }

  // -------------------------------------------------------------------------
  // CSS generation
  // -------------------------------------------------------------------------

  /** Map border name + zone to CSS cell class */
  const _CELL_MAP = {
    'top-a': 'nw', 'top-b': 'n', 'top-c': 'ne',
    'bottom-a': 'sw', 'bottom-b': 's', 'bottom-c': 'se',
    'left-a': 'nw', 'left-b': 'w', 'left-c': 'sw',
    'right-a': 'ne', 'right-b': 'e', 'right-c': 'se',
  };

  function _buildCSS(processedBorders, anirate) {
    const rules = [];

    // Determine frame dimensions for CSS custom properties
    const top = processedBorders.find(b => b.name === 'top');
    const left = processedBorders.find(b => b.name === 'left');
    const right = processedBorders.find(b => b.name === 'right');
    const bottom = processedBorders.find(b => b.name === 'bottom');

    // Compute corner extensions: if the horizontal border's fixed zones (A/C)
    // are wider than the vertical border frames, corners need extra columns
    // so the full zone artwork is visible without clipping.
    const topZA = top?.zoneA || 0;
    const topZC = top?.zoneC || 0;
    const botZA = bottom?.zoneA || 0;
    const botZC = bottom?.zoneC || 0;
    const leftFW = left?.frameWidth || 4;
    const rightFW = right?.frameWidth || 4;
    const nwExt = Math.max(0, Math.max(topZA, botZA) - leftFW);
    const neExt = Math.max(0, Math.max(topZC, botZC) - rightFW);

    rules.push(`.sz-window {
  --sz-frame-top-h: ${top?.frameHeight || 30}px;
  --sz-frame-left-w: ${leftFW}px;
  --sz-frame-right-w: ${rightFW}px;
  --sz-frame-bottom-h: ${bottom?.frameHeight || 4}px;
  --sz-frame-nw-ext: ${nwExt}px;
  --sz-frame-ne-ext: ${neExt}px;
}`);

    // Track which cells already have CSS rules
    const handledCells = new Set();

    // Phase 1: cells from borders with canvas-extracted data URL frames
    const cells = {};

    for (const border of processedBorders) {
      if (!border.frames || border.frames.length === 0)
        continue;

      for (const zone of ['a', 'b', 'c']) {
        const cellName = _CELL_MAP[`${border.name}-${zone}`];
        if (!cellName)
          continue;

        if (!cells[cellName])
          cells[cellName] = { layers: [] };

        cells[cellName].layers.push({
          border,
          zone,
          frameCount: border.frameCount,
        });
      }
    }

    for (const [cellName, cell] of Object.entries(cells)) {
      const isCorner = ['nw', 'ne', 'sw', 'se'].includes(cellName);

      if (isCorner)
        _buildCornerCSS(rules, cellName, cell.layers, anirate);
      else {
        const layer = cell.layers[0];
        if (layer)
          _buildEdgeCSS(rules, cellName, layer, anirate);
      }
      handledCells.add(cellName);
    }

    // Phase 2: raw image fallback for borders where canvas processing failed.
    // Collect all raw contributions per cell first — corners need two borders
    // (one horizontal, one vertical) composited via CSS multi-background.
    const rawCells = {};
    for (const border of processedBorders) {
      if (border.frames || !border.rawPath)
        continue;

      for (const zone of ['a', 'b', 'c']) {
        const cellName = _CELL_MAP[`${border.name}-${zone}`];
        if (!cellName || handledCells.has(cellName))
          continue;

        if (!rawCells[cellName])
          rawCells[cellName] = {};

        if (border.horizontal) {
          rawCells[cellName].horiz = border;
          rawCells[cellName].hZone = zone;
        } else {
          rawCells[cellName].vert = border;
          rawCells[cellName].vZone = zone;
        }
      }
    }

    for (const [cellName, cell] of Object.entries(rawCells)) {
      if (['nw', 'ne', 'sw', 'se'].includes(cellName))
        _buildRawCornerCSS(rules, cellName, cell, anirate);
      else {
        const border = cell.horiz || cell.vert;
        const zone = cell.horiz ? cell.hZone : cell.vZone;
        _buildRawEdgeCSS(rules, cellName, border, zone, anirate);
      }
    }

    return rules.join('\n\n');
  }

  function _buildEdgeCSS(rules, cellName, layer, anirate) {
    const { border, zone } = layer;
    const fc = border.frameCount;
    const stretch = border.stretch;
    const isHoriz = border.horizontal;

    // Determine repeat/size for this cell
    let bgRepeat, bgSize;
    if (zone === 'a' || zone === 'c') {
      bgRepeat = 'no-repeat';
      bgSize = '100% 100%';
    } else {
      // Zone B — middle, can tile or stretch
      if (stretch) {
        bgRepeat = 'no-repeat';
        bgSize = '100% 100%';
      } else {
        bgRepeat = isHoriz ? 'repeat-x' : 'repeat-y';
        bgSize = 'auto';
      }
    }

    const activeIdx = 0;
    const inactiveIdx = fc - 1;

    if (fc <= 2) {
      // Static: active rule + inactive rule
      const activeURL = border.frames[activeIdx]?.[zone];
      const inactiveURL = border.frames[inactiveIdx]?.[zone];

      if (activeURL)
        rules.push(`.sz-window-active .sz-frame-${cellName} { background-image: url('${activeURL}'); background-repeat: ${bgRepeat}; background-size: ${bgSize}; }`);

      if (inactiveURL)
        rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { background-image: url('${inactiveURL}'); background-repeat: ${bgRepeat}; background-size: ${bgSize}; }`);
    } else {
      // Animated: @keyframes for active, static for inactive
      const activeFrameCount = fc - 1; // last frame is inactive
      const duration = anirate * activeFrameCount;
      const animName = `sz-frame-${cellName}-active`;

      let keyframes = `@keyframes ${animName} {\n`;
      for (let i = 0; i < activeFrameCount; ++i) {
        const pct = ((i / activeFrameCount) * 100).toFixed(2);
        const url = border.frames[i]?.[zone];
        if (url)
          keyframes += `  ${pct}% { background-image: url('${url}'); }\n`;
      }
      keyframes += '}';
      rules.push(keyframes);

      rules.push(`.sz-window-active .sz-frame-${cellName} { background-repeat: ${bgRepeat}; background-size: ${bgSize}; animation: ${animName} ${duration}ms steps(1) infinite; }`);

      const inactiveURL = border.frames[inactiveIdx]?.[zone];
      if (inactiveURL)
        rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { background-image: url('${inactiveURL}'); background-repeat: ${bgRepeat}; background-size: ${bgSize}; animation: none; }`);
    }
  }

  // Background-position for each corner: places zone images at the correct
  // corner so overflow is clipped by the cell's overflow:hidden.
  const _CORNER_POSITION = {
    nw: '0 0',
    ne: 'right 0',
    sw: '0 bottom',
    se: 'right bottom',
  };

  function _buildCornerCSS(rules, cellName, layers, anirate) {
    // Corner cells receive contributions from two borders (e.g. nw = top-a + left-a).
    // CSS multi-background composites the horizontal border on top of the vertical
    // border, both at natural size, positioned at the corner edge.  overflow:hidden
    // clips any excess from zones larger than the cell.
    const horizLayer = layers.find(l => l.border.horizontal);
    const vertLayer = layers.find(l => !l.border.horizontal);
    const primary = horizLayer || vertLayer;
    if (!primary)
      return;

    const pos = _CORNER_POSITION[cellName] || '0 0';
    const fc = primary.border.frameCount;
    const activeIdx = 0;
    const inactiveIdx = fc - 1;

    // Helper: build multi-bg value string from horiz + vert URLs
    const bgImg = (hURL, vURL) => {
      if (hURL && vURL)
        return `url('${hURL}'), url('${vURL}')`;
      if (hURL)
        return `url('${hURL}')`;
      if (vURL)
        return `url('${vURL}')`;
      return 'none';
    };

    const bgProps = (hURL, vURL) => {
      const img = bgImg(hURL, vURL);
      const layers = (hURL && vURL) ? 2 : 1;
      const posVal = layers === 2 ? `${pos}, ${pos}` : pos;
      const sizeVal = layers === 2 ? 'auto, auto' : 'auto';
      const repVal = layers === 2 ? 'no-repeat, no-repeat' : 'no-repeat';
      return `background-image: ${img}; background-position: ${posVal}; background-size: ${sizeVal}; background-repeat: ${repVal};`;
    };

    if (fc <= 2) {
      const hActive = horizLayer?.border.frames[activeIdx]?.[horizLayer.zone];
      const vActive = vertLayer?.border.frames[activeIdx]?.[vertLayer.zone];
      const hInactive = horizLayer?.border.frames[inactiveIdx]?.[horizLayer.zone];
      const vInactive = vertLayer?.border.frames[inactiveIdx]?.[vertLayer.zone];

      if (hActive || vActive)
        rules.push(`.sz-window-active .sz-frame-${cellName} { ${bgProps(hActive, vActive)} }`);
      if (hInactive || vInactive)
        rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { ${bgProps(hInactive, vInactive)} }`);
    } else {
      // Animated: @keyframes cycling background-image
      const activeFrameCount = fc - 1;
      const duration = anirate * activeFrameCount;
      const animName = `sz-frame-${cellName}-active`;

      let keyframes = `@keyframes ${animName} {\n`;
      for (let i = 0; i < activeFrameCount; ++i) {
        const pct = ((i / activeFrameCount) * 100).toFixed(2);
        const hURL = horizLayer?.border.frames[i]?.[horizLayer.zone];
        const vURL = vertLayer?.border.frames[i]?.[vertLayer.zone];
        keyframes += `  ${pct}% { ${bgProps(hURL, vURL)} }\n`;
      }
      keyframes += '}';
      rules.push(keyframes);

      const layers2 = (horizLayer && vertLayer) ? 2 : 1;
      const posVal = layers2 === 2 ? `${pos}, ${pos}` : pos;
      const sizeVal = layers2 === 2 ? 'auto, auto' : 'auto';
      const repVal = layers2 === 2 ? 'no-repeat, no-repeat' : 'no-repeat';
      rules.push(`.sz-window-active .sz-frame-${cellName} { background-position: ${posVal}; background-size: ${sizeVal}; background-repeat: ${repVal}; animation: ${animName} ${duration}ms steps(1) infinite; }`);

      const hInactive = horizLayer?.border.frames[inactiveIdx]?.[horizLayer.zone];
      const vInactive = vertLayer?.border.frames[inactiveIdx]?.[vertLayer.zone];
      if (hInactive || vInactive)
        rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { ${bgProps(hInactive, vInactive)} animation: none; }`);
    }
  }

  // -------------------------------------------------------------------------
  // Raw image fallback (used when canvas is tainted on file:// protocol)
  // -------------------------------------------------------------------------
  //
  // Without canvas we cannot extract individual zones from the full BMP, so
  // we show the full border image in each cell and use CSS background-size +
  // background-position to reveal only the desired zone.
  //
  // Zone A / C: fixed-size corners/ends — natural size, positioned at the
  //   matching edge, overflow:hidden clips the rest.
  //
  // Zone B: middle section — for stretch mode we use a percentage-based
  //   background-size so that zone B alone fills the cell width (horizontal)
  //   or cell height (vertical).  Tiling degrades to stretch in raw mode
  //   because we can't isolate zone B for repeat.
  //
  // Corner cells (nw/ne/sw/se) composite two raw images via CSS
  // multi-background: horizontal border on top, vertical behind.

  /**
   * Raw fallback for edge cells (N, S, W, E) — always zone B.
   */
  function _buildRawEdgeCSS(rules, cellName, border, zone, anirate) {
    const { rawPath, frameCount: fc, horizontal: isHoriz, zoneA, zoneC, bSize, frameWidth, frameHeight } = border;

    // Full stacked image dimensions
    const imgW = isHoriz ? frameWidth : frameWidth * fc;
    const imgH = isHoriz ? frameHeight * fc : frameHeight;

    let bgSize, posForFrame;

    if (zone === 'b') {
      if (bSize <= 0) {
        // Degenerate case: no zone B content
        return;
      }

      if (isHoriz) {
        // Scale width so zone B fills 100% of cell, keep stacked height explicit
        const scaleX = (frameWidth / bSize) * 100;
        const xPct = (zoneA + zoneC > 0) ? (100 * zoneA / (zoneA + zoneC)) : 0;
        bgSize = `${scaleX.toFixed(4)}% ${imgH}px`;
        posForFrame = (fi) => `${xPct.toFixed(4)}% ${fi > 0 ? '-' + (fi * frameHeight) + 'px' : '0'}`;
      } else {
        // Scale height so zone B fills 100% of cell, keep stacked width explicit
        const scaleY = (frameHeight / bSize) * 100;
        const yPct = (zoneA + zoneC > 0) ? (100 * zoneA / (zoneA + zoneC)) : 0;
        bgSize = `${imgW}px ${scaleY.toFixed(4)}%`;
        posForFrame = (fi) => `${fi > 0 ? '-' + (fi * frameWidth) + 'px' : '0'} ${yPct.toFixed(4)}%`;
      }
    } else if (zone === 'a') {
      bgSize = 'auto';
      posForFrame = (fi) => isHoriz
        ? `0 ${fi > 0 ? '-' + (fi * frameHeight) + 'px' : '0'}`
        : `${fi > 0 ? '-' + (fi * frameWidth) + 'px' : '0'} 0`;
    } else {
      // zone === 'c'
      bgSize = 'auto';
      posForFrame = (fi) => isHoriz
        ? `right ${fi > 0 ? '-' + (fi * frameHeight) + 'px' : '0'}`
        : `${fi > 0 ? '-' + (fi * frameWidth) + 'px' : '0'} bottom`;
    }

    const activeIdx = 0;
    const inactiveIdx = fc - 1;

    if (fc <= 2) {
      rules.push(`.sz-window-active .sz-frame-${cellName} { background-image: url('${rawPath}'); background-position: ${posForFrame(activeIdx)}; background-repeat: no-repeat; background-size: ${bgSize}; }`);
      rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { background-image: url('${rawPath}'); background-position: ${posForFrame(inactiveIdx)}; background-repeat: no-repeat; background-size: ${bgSize}; }`);
    } else {
      const activeFrameCount = fc - 1;
      const duration = anirate * activeFrameCount;
      const animName = `sz-frame-${cellName}-active`;

      let keyframes = `@keyframes ${animName} {\n`;
      for (let i = 0; i < activeFrameCount; ++i) {
        const pct = ((i / activeFrameCount) * 100).toFixed(2);
        keyframes += `  ${pct}% { background-position: ${posForFrame(i)}; }\n`;
      }
      keyframes += '}';
      rules.push(keyframes);

      rules.push(`.sz-window-active .sz-frame-${cellName} { background-image: url('${rawPath}'); background-repeat: no-repeat; background-size: ${bgSize}; animation: ${animName} ${duration}ms steps(1) infinite; }`);
      rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { background-image: url('${rawPath}'); background-position: ${posForFrame(inactiveIdx)}; background-repeat: no-repeat; background-size: ${bgSize}; animation: none; }`);
    }
  }

  /**
   * Raw fallback for corner cells (NW, NE, SW, SE).
   *
   * Without canvas we cannot apply magenta transparency, so multi-background
   * compositing fails — the top layer completely covers the bottom one.
   * Instead we use:
   *   - main background:  horizontal border image (top/bottom)
   *   - ::before pseudo:  vertical border strip (left/right) on the side edge
   *
   * The ::before is painted above the parent's background but below the
   * ::after sub-skin tinting overlay, giving correct layer order.
   */
  function _buildRawCornerCSS(rules, cellName, cell, anirate) {
    const { horiz, vert } = cell;
    if (!horiz && !vert)
      return;

    const isLeft = cellName === 'nw' || cellName === 'sw';
    const isTop  = cellName === 'nw' || cellName === 'ne';

    const primary = horiz || vert;
    const fc = primary.frameCount;
    const activeIdx = 0;
    const inactiveIdx = fc - 1;

    // --- Horizontal border as main cell background ---
    if (horiz) {
      const horizPos = (fi) => {
        const x = isLeft ? '0' : 'right';
        const y = fc > 1 ? `-${fi * horiz.frameHeight}px` : '0';
        return `${x} ${y}`;
      };

      if (fc <= 2) {
        rules.push(`.sz-window-active .sz-frame-${cellName} { background-image: url('${horiz.rawPath}'); background-position: ${horizPos(activeIdx)}; background-size: auto; background-repeat: no-repeat; }`);
        rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { background-image: url('${horiz.rawPath}'); background-position: ${horizPos(inactiveIdx)}; background-size: auto; background-repeat: no-repeat; }`);
      } else {
        const activeFrameCount = fc - 1;
        const duration = anirate * activeFrameCount;
        const animName = `sz-frame-${cellName}-active`;
        let kf = `@keyframes ${animName} {\n`;
        for (let i = 0; i < activeFrameCount; ++i)
          kf += `  ${((i / activeFrameCount) * 100).toFixed(2)}% { background-position: ${horizPos(i)}; }\n`;
        kf += '}';
        rules.push(kf);
        rules.push(`.sz-window-active .sz-frame-${cellName} { background-image: url('${horiz.rawPath}'); background-size: auto; background-repeat: no-repeat; animation: ${animName} ${duration}ms steps(1) infinite; }`);
        rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { background-image: url('${horiz.rawPath}'); background-position: ${horizPos(inactiveIdx)}; background-size: auto; background-repeat: no-repeat; animation: none; }`);
      }
    } else {
      // Only vertical border — use it as the main background directly
      const vertBgPos = (fi) => {
        const x = vert.frameCount > 1 ? `-${fi * vert.frameWidth}px` : '0';
        const y = isTop ? '0' : 'bottom';
        return `${x} ${y}`;
      };

      if (fc <= 2) {
        rules.push(`.sz-window-active .sz-frame-${cellName} { background-image: url('${vert.rawPath}'); background-position: ${vertBgPos(activeIdx)}; background-size: auto; background-repeat: no-repeat; }`);
        rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { background-image: url('${vert.rawPath}'); background-position: ${vertBgPos(inactiveIdx)}; background-size: auto; background-repeat: no-repeat; }`);
      } else {
        const activeFrameCount = fc - 1;
        const duration = anirate * activeFrameCount;
        const animName = `sz-frame-${cellName}-active`;
        let kf = `@keyframes ${animName} {\n`;
        for (let i = 0; i < activeFrameCount; ++i)
          kf += `  ${((i / activeFrameCount) * 100).toFixed(2)}% { background-position: ${vertBgPos(i)}; }\n`;
        kf += '}';
        rules.push(kf);
        rules.push(`.sz-window-active .sz-frame-${cellName} { background-image: url('${vert.rawPath}'); background-size: auto; background-repeat: no-repeat; animation: ${animName} ${duration}ms steps(1) infinite; }`);
        rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName} { background-image: url('${vert.rawPath}'); background-position: ${vertBgPos(inactiveIdx)}; background-size: auto; background-repeat: no-repeat; animation: none; }`);
      }
      return; // No ::before needed when only vertical border
    }

    // --- Vertical border as ::before strip on the side edge ---
    if (!vert)
      return;

    const vertFW = vert.frameWidth;
    const side = isLeft ? 'left: 0;' : 'right: 0;';
    const beforeBase = `content: ''; position: absolute; top: 0; ${side} width: ${vertFW}px; height: 100%; background-repeat: no-repeat; background-size: auto; pointer-events: none;`;

    const vertBeforePos = (fi) => {
      const x = vert.frameCount > 1 ? `-${fi * vertFW}px` : '0';
      const y = isTop ? '0' : 'bottom';
      return `${x} ${y}`;
    };

    if (fc <= 2) {
      rules.push(`.sz-window-active .sz-frame-${cellName}::before { ${beforeBase} background-image: url('${vert.rawPath}'); background-position: ${vertBeforePos(activeIdx)}; }`);
      rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName}::before { ${beforeBase} background-image: url('${vert.rawPath}'); background-position: ${vertBeforePos(inactiveIdx)}; }`);
    } else {
      const activeFrameCount = fc - 1;
      const duration = anirate * activeFrameCount;
      const animName = `sz-frame-${cellName}-before-active`;
      let kf = `@keyframes ${animName} {\n`;
      for (let i = 0; i < activeFrameCount; ++i)
        kf += `  ${((i / activeFrameCount) * 100).toFixed(2)}% { background-position: ${vertBeforePos(i)}; }\n`;
      kf += '}';
      rules.push(kf);
      rules.push(`.sz-window-active .sz-frame-${cellName}::before { ${beforeBase} background-image: url('${vert.rawPath}'); animation: ${animName} ${duration}ms steps(1) infinite; }`);
      rules.push(`.sz-window:not(.sz-window-active) .sz-frame-${cellName}::before { ${beforeBase} background-image: url('${vert.rawPath}'); background-position: ${vertBeforePos(inactiveIdx)}; animation: none; }`);
    }
  }

  // -------------------------------------------------------------------------
  // Start button processing
  // -------------------------------------------------------------------------

  async function _processStartButton(skin, useTrans) {
    const sb = skin.startButton;
    if (!sb?.image)
      return null;

    const img = await _loadImage(sb.image);
    if (!img)
      return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      if (useTrans)
        _applyMagentaTransparency(ctx, img.width, img.height);

      return canvas.toDataURL();
    } catch (_) {
      // Canvas tainted — return raw path
      return sb.image;
    }
  }

  // -------------------------------------------------------------------------
  // Style injection
  // -------------------------------------------------------------------------

  function _injectStyle(css) {
    let el = document.getElementById(_STYLE_ID);
    if (el) {
      el.textContent = css;
    } else {
      el = document.createElement('style');
      el.id = _STYLE_ID;
      el.textContent = css;
      document.head.appendChild(el);
    }
  }

  SZ.generateSkinCSS = generateSkinCSS;
})();
