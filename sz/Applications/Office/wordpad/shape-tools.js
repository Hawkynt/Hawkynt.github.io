;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _editor, _editorWrapper, _markDirty;
  let selectedShape = null;
  let resizeOverlay = null;
  let resizingHandle = null;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartW = 0;
  let resizeStartH = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOrigLeft = 0;
  let dragOrigTop = 0;
  let _pickerEl = null;

  // ═══════════════════════════════════════════════════════════════
  // Shape Definitions -- SVG path generators (viewBox 0 0 100 100)
  // ═══════════════════════════════════════════════════════════════

  const SHAPE_DEFS = {
    'Basic Shapes': {
      'rect':             { label: 'Rectangle',       icon: '\u25AD', path: () => 'M2,2 L98,2 L98,98 L2,98 Z' },
      'rounded-rect':     { label: 'Rounded Rect',    icon: '\u25A2', path: () => 'M15,2 L85,2 Q98,2 98,15 L98,85 Q98,98 85,98 L15,98 Q2,98 2,85 L2,15 Q2,2 15,2 Z' },
      'ellipse':          { label: 'Ellipse',         icon: '\u2B2D', path: () => 'M50,2 C76,2 98,24 98,50 C98,76 76,98 50,98 C24,98 2,76 2,50 C2,24 24,2 50,2 Z' },
      'triangle':         { label: 'Triangle',        icon: '\u25B3', path: () => 'M50,2 L98,98 L2,98 Z' },
      'right-triangle':   { label: 'Right Triangle',  icon: '\u25F9', path: () => 'M2,2 L2,98 L98,98 Z' },
      'diamond':          { label: 'Diamond',         icon: '\u25C7', path: () => 'M50,2 L98,50 L50,98 L2,50 Z' },
      'pentagon':         { label: 'Pentagon',         icon: '\u2B1F', path: () => 'M50,2 L97,38 L79,98 L21,98 L3,38 Z' },
      'hexagon':          { label: 'Hexagon',          icon: '\u2B22', path: () => 'M25,2 L75,2 L98,50 L75,98 L25,98 L2,50 Z' },
      'octagon':          { label: 'Octagon',          icon: '\u2BC2', path: () => 'M30,2 L70,2 L98,30 L98,70 L70,98 L30,98 L2,70 L2,30 Z' },
      'trapezoid':        { label: 'Trapezoid',        icon: '\u23E2', path: () => 'M20,2 L80,2 L98,98 L2,98 Z' },
      'parallelogram':    { label: 'Parallelogram',    icon: '\u25B1', path: () => 'M25,2 L98,2 L75,98 L2,98 Z' },
      'cross':            { label: 'Cross',            icon: '\u271A', path: () => 'M35,2 L65,2 L65,35 L98,35 L98,65 L65,65 L65,98 L35,98 L35,65 L2,65 L2,35 L35,35 Z' },
    },
    'Arrows': {
      'arrow-right':      { label: 'Right Arrow',      icon: '\u27A1', path: () => 'M2,35 L60,35 L60,10 L98,50 L60,90 L60,65 L2,65 Z' },
      'arrow-left':       { label: 'Left Arrow',       icon: '\u2B05', path: () => 'M98,35 L40,35 L40,10 L2,50 L40,90 L40,65 L98,65 Z' },
      'arrow-up':         { label: 'Up Arrow',         icon: '\u2B06', path: () => 'M35,98 L35,40 L10,40 L50,2 L90,40 L65,40 L65,98 Z' },
      'arrow-down':       { label: 'Down Arrow',       icon: '\u2B07', path: () => 'M35,2 L35,60 L10,60 L50,98 L90,60 L65,60 L65,2 Z' },
      'arrow-double':     { label: 'Double Arrow',     icon: '\u2194', path: () => 'M2,50 L25,20 L25,38 L75,38 L75,20 L98,50 L75,80 L75,62 L25,62 L25,80 Z' },
      'chevron':          { label: 'Chevron',          icon: '\u276F', path: () => 'M2,2 L70,2 L98,50 L70,98 L2,98 L30,50 Z' },
      'notched-arrow':    { label: 'Notched Arrow',    icon: '\u27A4', path: () => 'M2,35 L60,35 L60,10 L98,50 L60,90 L60,65 L2,65 L18,50 Z' },
    },
    'Flowchart': {
      'process':          { label: 'Process',           icon: '\u25AD', path: () => 'M2,2 L98,2 L98,98 L2,98 Z' },
      'decision':         { label: 'Decision',          icon: '\u25C7', path: () => 'M50,2 L98,50 L50,98 L2,50 Z' },
      'terminator':       { label: 'Terminator',        icon: '\u2B2D', path: () => 'M25,2 L75,2 Q98,2 98,50 Q98,98 75,98 L25,98 Q2,98 2,50 Q2,2 25,2 Z' },
      'data':             { label: 'Data',               icon: '\u25B1', path: () => 'M20,2 L98,2 L80,98 L2,98 Z' },
      'document-shape':   { label: 'Document',          icon: '\u25AD', path: () => 'M2,2 L98,2 L98,82 C75,98 25,72 2,88 Z' },
      'predefined-process': { label: 'Predefined',     icon: '\u25A3', path: () => 'M2,2 L98,2 L98,98 L2,98 Z M12,2 L12,98 M88,2 L88,98' },
    },
    'Stars & Banners': {
      'star-4':           { label: '4-Point Star',      icon: '\u2726', path: () => _starPath(4) },
      'star-5':           { label: '5-Point Star',      icon: '\u2605', path: () => _starPath(5) },
      'star-6':           { label: '6-Point Star',      icon: '\u2736', path: () => _starPath(6) },
      'explosion':        { label: 'Explosion',         icon: '\u1F4A5', path: () => _explosionPath() },
      'ribbon-banner':    { label: 'Banner',            icon: '\u1F3F4', path: () => 'M2,25 L15,25 L15,2 L85,2 L85,25 L98,25 L88,50 L98,75 L85,75 L85,98 L15,98 L15,75 L2,75 L12,50 Z' },
    },
    'Callouts': {
      'callout-rect':     { label: 'Rect Callout',      icon: '\u1F4AC', path: () => 'M2,2 L98,2 L98,72 L40,72 L20,98 L30,72 L2,72 Z' },
      'callout-rounded':  { label: 'Rounded Callout',   icon: '\u1F4AC', path: () => 'M12,2 L88,2 Q98,2 98,12 L98,62 Q98,72 88,72 L40,72 L20,98 L30,72 L12,72 Q2,72 2,62 L2,12 Q2,2 12,2 Z' },
      'callout-cloud':    { label: 'Cloud Callout',     icon: '\u2601', path: () => 'M25,90 C2,90 2,65 15,55 C2,45 10,25 28,25 C28,10 45,2 58,10 C65,2 85,2 90,18 C98,22 98,45 88,52 C98,62 95,80 80,82 C80,95 60,98 50,90 Z M30,90 L22,98 L28,92' },
    },
  };

  // ── Star path generator ──

  function _starPath(points) {
    const cx = 50, cy = 50;
    const outerR = 48, innerR = points === 4 ? 20 : points === 5 ? 20 : 24;
    const parts = [];
    for (let i = 0; i < points * 2; ++i) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i / points) - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      parts.push((i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1));
    }
    parts.push('Z');
    return parts.join(' ');
  }

  // ── Explosion path generator ──

  function _explosionPath() {
    const cx = 50, cy = 50;
    const points = 12;
    const parts = [];
    for (let i = 0; i < points * 2; ++i) {
      const r = i % 2 === 0 ? 48 : 18 + (i % 4 === 1 ? 8 : 0);
      const angle = (Math.PI * i / points) - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      parts.push((i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1));
    }
    parts.push('Z');
    return parts.join(' ');
  }

  // ═══════════════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════════════

  function init(ctx) {
    _editor = ctx.editor;
    _editorWrapper = ctx.editorWrapper;
    _markDirty = ctx.markDirty;

    _editor.addEventListener('click', (e) => {
      const shape = e.target.closest('.wp-shape');
      if (!shape) {
        deselectShape();
        return;
      }
      // Ignore clicks on the inner text div
      if (e.target.closest('.wp-shape-text'))
        return;
      e.preventDefault();
      e.stopPropagation();
      selectShape(shape);
    });

    document.addEventListener('pointerdown', (e) => {
      if (selectedShape && !e.target.closest('.wp-shape-resize-overlay') && !e.target.closest('.wp-shape'))
        deselectShape();
      // Close shape picker on outside click
      if (_pickerEl && _pickerEl.style.display !== 'none' && !e.target.closest('.wp-shape-picker') && !e.target.closest('[data-action="insert-shape"]'))
        _pickerEl.style.display = 'none';
    });

    _editorWrapper.addEventListener('scroll', () => {
      if (selectedShape) positionOverlay(selectedShape);
    });

    window.addEventListener('resize', () => {
      if (selectedShape) positionOverlay(selectedShape);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Shape Selection / Overlay
  // ═══════════════════════════════════════════════════════════════

  function selectShape(shape) {
    deselectShape();
    selectedShape = shape;
    shape.classList.add('wp-shape-selected');
    createOverlay();
    positionOverlay(shape);
  }

  function deselectShape() {
    if (!selectedShape) return;
    selectedShape.classList.remove('wp-shape-selected');
    selectedShape = null;
    hideOverlay();
  }

  function createOverlay() {
    if (resizeOverlay) return;
    resizeOverlay = document.createElement('div');
    resizeOverlay.className = 'wp-shape-resize-overlay';
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (const dir of handles) {
      const h = document.createElement('div');
      h.className = 'wp-shape-handle ' + dir;
      h.dataset.dir = dir;
      h.addEventListener('pointerdown', onResizeDown);
      resizeOverlay.appendChild(h);
    }

    // Drag area
    resizeOverlay.addEventListener('pointerdown', onDragDown);
    document.body.appendChild(resizeOverlay);
  }

  function positionOverlay(shape) {
    if (!resizeOverlay) createOverlay();
    const rect = shape.getBoundingClientRect();
    resizeOverlay.style.display = 'block';
    resizeOverlay.style.left = rect.left + 'px';
    resizeOverlay.style.top = rect.top + 'px';
    resizeOverlay.style.width = rect.width + 'px';
    resizeOverlay.style.height = rect.height + 'px';
  }

  function hideOverlay() {
    if (resizeOverlay)
      resizeOverlay.style.display = 'none';
  }

  // ── Drag ──

  function onDragDown(e) {
    if (e.target.dataset.dir || !selectedShape) return;
    e.preventDefault();
    e.stopPropagation();

    // Make shape position:relative if not already positioned for dragging
    const cs = window.getComputedStyle(selectedShape);
    if (cs.position === 'static')
      selectedShape.style.position = 'relative';

    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOrigLeft = parseInt(selectedShape.style.left, 10) || 0;
    dragOrigTop = parseInt(selectedShape.style.top, 10) || 0;
    resizeOverlay.setPointerCapture(e.pointerId);
    resizeOverlay.addEventListener('pointermove', onDragMove);
    resizeOverlay.addEventListener('pointerup', onDragUp);
  }

  function onDragMove(e) {
    if (!selectedShape) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    selectedShape.style.left = (dragOrigLeft + dx) + 'px';
    selectedShape.style.top = (dragOrigTop + dy) + 'px';
    positionOverlay(selectedShape);
  }

  function onDragUp(e) {
    resizeOverlay.releasePointerCapture(e.pointerId);
    resizeOverlay.removeEventListener('pointermove', onDragMove);
    resizeOverlay.removeEventListener('pointerup', onDragUp);
    _markDirty();
  }

  // ── Resize ──

  function onResizeDown(e) {
    if (!selectedShape) return;
    e.preventDefault();
    e.stopPropagation();
    resizingHandle = e.target.dataset.dir;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartW = selectedShape.offsetWidth;
    resizeStartH = selectedShape.offsetHeight;
    e.target.setPointerCapture(e.pointerId);
    e.target.addEventListener('pointermove', onResizeMove);
    e.target.addEventListener('pointerup', onResizeUp);
  }

  function onResizeMove(e) {
    if (!resizingHandle || !selectedShape) return;
    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;
    let newW = resizeStartW;
    let newH = resizeStartH;
    const dir = resizingHandle;

    if (dir.includes('e')) newW = resizeStartW + dx;
    if (dir.includes('w')) newW = resizeStartW - dx;
    if (dir.includes('s')) newH = resizeStartH + dy;
    if (dir.includes('n')) newH = resizeStartH - dy;

    newW = Math.max(16, newW);
    newH = Math.max(16, newH);

    selectedShape.style.width = newW + 'px';
    selectedShape.style.height = newH + 'px';
    positionOverlay(selectedShape);
  }

  function onResizeUp(e) {
    resizingHandle = null;
    e.target.releasePointerCapture(e.pointerId);
    e.target.removeEventListener('pointermove', onResizeMove);
    e.target.removeEventListener('pointerup', onResizeUp);
    _markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // Shape Picker Flyout
  // ═══════════════════════════════════════════════════════════════

  function _ensurePicker() {
    if (_pickerEl) return _pickerEl;

    _pickerEl = document.createElement('div');
    _pickerEl.className = 'wp-shape-picker';
    _pickerEl.style.display = 'none';

    for (const [catName, shapes] of Object.entries(SHAPE_DEFS)) {
      const catLabel = document.createElement('div');
      catLabel.className = 'wp-shape-picker-cat';
      catLabel.textContent = catName;
      _pickerEl.appendChild(catLabel);

      const grid = document.createElement('div');
      grid.className = 'wp-shape-picker-grid';

      for (const [type, def] of Object.entries(shapes)) {
        const cell = document.createElement('div');
        cell.className = 'wp-shape-picker-cell';
        cell.title = def.label;
        cell.dataset.shapeType = type;

        // Render a small SVG preview
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.width = '100%';
        svg.style.height = '100%';
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', def.path());
        p.setAttribute('fill', '#4472C4');
        p.setAttribute('stroke', '#2F5496');
        p.setAttribute('stroke-width', '2');
        svg.appendChild(p);
        cell.appendChild(svg);

        cell.addEventListener('click', () => {
          insertShape(type);
          _pickerEl.style.display = 'none';
        });

        grid.appendChild(cell);
      }

      _pickerEl.appendChild(grid);
    }

    document.body.appendChild(_pickerEl);
    return _pickerEl;
  }

  function showShapePicker(anchorEl) {
    const picker = _ensurePicker();
    const rect = anchorEl.getBoundingClientRect();

    picker.style.display = 'block';
    picker.style.left = rect.left + 'px';
    picker.style.top = (rect.bottom + 2) + 'px';

    // Clamp to viewport
    requestAnimationFrame(() => {
      const pr = picker.getBoundingClientRect();
      if (pr.right > window.innerWidth)
        picker.style.left = Math.max(0, window.innerWidth - pr.width - 4) + 'px';
      if (pr.bottom > window.innerHeight)
        picker.style.top = Math.max(0, rect.top - pr.height - 2) + 'px';
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert Shape into Editor
  // ═══════════════════════════════════════════════════════════════

  function insertShape(type) {
    // Find definition
    let def = null;
    for (const shapes of Object.values(SHAPE_DEFS)) {
      if (shapes[type]) {
        def = shapes[type];
        break;
      }
    }
    if (!def) return;

    const pathD = def.path();
    const fillColor = '#4472C4';
    const strokeColor = '#2F5496';

    // Build HTML string for insertion via execCommand
    const html =
      '<div class="wp-shape" contenteditable="false" data-shape-type="' + type + '" style="width:120px;height:80px;display:inline-block;position:relative;">' +
        '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:100%;">' +
          '<path d="' + pathD + '" fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="2"/>' +
        '</svg>' +
        '<div class="wp-shape-text" contenteditable="true" style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;box-sizing:border-box;color:#fff;font-size:11px;outline:none;z-index:1;overflow:hidden;pointer-events:auto;">' +
        '</div>' +
      '</div>';

    _editor.focus();
    document.execCommand('insertHTML', false, html);
    _markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════

  WP.ShapeTools = { init, showShapePicker, insertShape, SHAPE_DEFS };
})();
