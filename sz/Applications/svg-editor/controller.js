;(function() {
  'use strict';

  // ---- Section 1: Constants & Config ----
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MAX_UNDO = 30;
  const GRID_SIZE = 20;
  const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
  const TOOL_SHORTCUTS = { v: 'select', r: 'rect', e: 'ellipse', c: 'circle', l: 'line', p: 'path', t: 'text', h: 'pan' };
  const TOOL_LABELS = { select: 'Select', rect: 'Rectangle', ellipse: 'Ellipse', circle: 'Circle', line: 'Line', path: 'Freehand', text: 'Text', pan: 'Pan' };

  // ---- Section 2: SZ Dll imports + DOM refs ----
  const { Kernel32, ComDlg32, User32 } = SZ.Dlls;

  const refs = {
    menuBar: document.getElementById('menu-bar'),
    toolbar: document.getElementById('toolbar'),
    toolGrid: document.getElementById('tool-grid'),
    workspace: document.getElementById('workspace'),
    svgHost: document.getElementById('svgHost'),
    svg: document.getElementById('svgCanvas'),
    scene: document.getElementById('sceneRoot'),
    gridOverlay: document.getElementById('gridOverlay'),
    gridPattern: document.getElementById('gridPattern'),
    sidebar: document.getElementById('sidebar'),
    inpFill: document.getElementById('inpFill'),
    inpStroke: document.getElementById('inpStroke'),
    inpStrokeWidth: document.getElementById('inpStrokeWidth'),
    inpOpacity: document.getElementById('inpOpacity'),
    inpDocW: document.getElementById('inpDocW'),
    inpDocH: document.getElementById('inpDocH'),
    layerList: document.getElementById('layerList'),
    sourceBox: document.getElementById('sourceBox'),
    btnResizeDoc: document.getElementById('btnResizeDoc'),
    btnBringFront: document.getElementById('btnBringFront'),
    btnBringForward: document.getElementById('btnBringForward'),
    btnSendBackward: document.getElementById('btnSendBackward'),
    btnSendBack: document.getElementById('btnSendBack'),
    btnApplySource: document.getElementById('btnApplySource'),
    btnReloadSource: document.getElementById('btnReloadSource'),
    statusCoords: document.getElementById('statusCoords'),
    statusTool: document.getElementById('statusTool'),
    statusDoc: document.getElementById('statusDoc'),
    statusElements: document.getElementById('statusElements')
  };

  // ---- Section 3: State ----
  const state = {
    tool: 'select',
    active: null,
    dragMode: 'none',      // 'none' | 'move' | 'draw' | 'pan' | 'resize'
    drawing: null,
    start: null,
    last: null,
    transformBase: '',
    filePath: null,
    fileName: 'Untitled.svg',
    dirty: false,
    uid: 1,
    panStart: null,
    zoom: 1,
    undoStack: [],
    redoStack: [],
    clipboard: null,
    grid: { visible: false, snap: false },
    openMenu: null,
    resizeHandle: null,     // current handle being dragged
    resizeOrigin: null,     // original bbox at resize start
    colorPickerRequest: null // pending color picker app request
  };

  function _closestZoomIndex(z) {
    let best = 0;
    for (let i = 1; i < ZOOM_LEVELS.length; ++i)
      if (Math.abs(ZOOM_LEVELS[i] - z) < Math.abs(ZOOM_LEVELS[best] - z))
        best = i;
    return best;
  }

  const statusZoomCtrl = new SZ.ZoomControl(document.getElementById('status-zoom-ctrl'), {
    min: 0, max: ZOOM_LEVELS.length - 1, step: 1,
    value: _closestZoomIndex(1),
    formatLabel: idx => Math.round(ZOOM_LEVELS[idx] * 100) + '%',
    parseLabel: text => {
      const raw = parseInt(text, 10);
      if (isNaN(raw) || raw < 1) return null;
      return _closestZoomIndex(raw / 100);
    },
    onChange: idx => setZoom(ZOOM_LEVELS[idx]),
    onZoomIn: () => zoomIn(),
    onZoomOut: () => zoomOut(),
  });

  // ---- Section 4: Utility functions ----
  function updateTitle() {
    const mark = state.dirty ? '* ' : '';
    const title = `${mark}${state.fileName} - SVG Editor`;
    document.title = title;
    try { User32.SetWindowText(title); } catch {}
  }

  function setDirty(v = true) {
    state.dirty = !!v;
    updateTitle();
  }

  function nextId() {
    return `shape-${++state.uid}`;
  }

  function getSvgPoint(evt) {
    const p = refs.svg.createSVGPoint();
    p.x = evt.clientX;
    p.y = evt.clientY;
    const matrix = refs.svg.getScreenCTM();
    if (!matrix)
      return { x: 0, y: 0 };

    const pt = p.matrixTransform(matrix.inverse());
    if (state.grid.snap)
      return { x: Math.round(pt.x / GRID_SIZE) * GRID_SIZE, y: Math.round(pt.y / GRID_SIZE) * GRID_SIZE };

    return pt;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function applyStyle(el) {
    el.setAttribute('fill', refs.inpFill.value);
    el.setAttribute('stroke', refs.inpStroke.value);
    el.setAttribute('stroke-width', String(Math.max(0, Number(refs.inpStrokeWidth.value) || 0)));
    el.setAttribute('opacity', String(clamp(Number(refs.inpOpacity.value) || 1, 0, 1)));
    el.setAttribute('vector-effect', 'non-scaling-stroke');
  }

  function decodeDataUrlIfNeeded(text) {
    if (!/^data:/i.test(text))
      return text;

    const comma = text.indexOf(',');
    if (comma < 0)
      return text;

    const meta = text.slice(0, comma);
    const payload = text.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      try { return atob(payload); } catch { return text; }
    }
    try { return decodeURIComponent(payload); } catch { return payload; }
  }

  function elementCount() {
    return refs.scene.children.length;
  }

  // ---- Section 5: Status bar ----
  function updateStatusCoords(x, y) {
    refs.statusCoords.textContent = `x=${Math.round(x)} y=${Math.round(y)}`;
  }

  function updateStatusTool() {
    refs.statusTool.textContent = `Tool: ${TOOL_LABELS[state.tool] || state.tool}`;
  }

  function updateStatusZoom() {
    statusZoomCtrl.value = _closestZoomIndex(state.zoom);
  }

  function updateStatusDoc() {
    const w = refs.svg.getAttribute('width');
    const h = refs.svg.getAttribute('height');
    refs.statusDoc.textContent = `${w} \u00d7 ${h}`;
  }

  function updateStatusElements() {
    const n = elementCount();
    refs.statusElements.textContent = `${n} element${n === 1 ? '' : 's'}`;
  }

  function updateAllStatus() {
    updateStatusTool();
    updateStatusZoom();
    updateStatusDoc();
    updateStatusElements();
  }

  // ---- Section 6: Undo/Redo ----
  function pushUndo() {
    state.undoStack.push(refs.scene.innerHTML);
    if (state.undoStack.length > MAX_UNDO)
      state.undoStack.shift();
    state.redoStack = [];
  }

  function doUndo() {
    if (!state.undoStack.length)
      return;

    state.redoStack.push(refs.scene.innerHTML);
    refs.scene.innerHTML = state.undoStack.pop();
    clearSelection();
    rebuildLayers();
    updateSource();
    updateStatusElements();
    setDirty();
  }

  function doRedo() {
    if (!state.redoStack.length)
      return;

    state.undoStack.push(refs.scene.innerHTML);
    refs.scene.innerHTML = state.redoStack.pop();
    clearSelection();
    rebuildLayers();
    updateSource();
    updateStatusElements();
    setDirty();
  }

  // ---- Section 7: Zoom & Pan ----
  function setZoom(z) {
    state.zoom = clamp(z, 0.1, 10);
    refs.svgHost.style.transform = `scale(${state.zoom})`;
    updateStatusZoom();
  }

  function zoomIn() {
    for (const z of ZOOM_LEVELS)
      if (z > state.zoom + 0.001) {
        setZoom(z);
        return;
      }
  }

  function zoomOut() {
    for (let i = ZOOM_LEVELS.length - 1; i >= 0; --i)
      if (ZOOM_LEVELS[i] < state.zoom - 0.001) {
        setZoom(ZOOM_LEVELS[i]);
        return;
      }
  }

  function zoomReset() {
    setZoom(1);
  }

  function zoomFit() {
    const ww = refs.workspace.clientWidth - 40;
    const wh = refs.workspace.clientHeight - 40;
    const sw = Number(refs.svg.getAttribute('width')) || 1024;
    const sh = Number(refs.svg.getAttribute('height')) || 768;
    setZoom(Math.min(ww / sw, wh / sh, 1));
  }

  // ---- Section 8: Selection & Handles ----
  function removeHandles() {
    for (const h of refs.svgHost.querySelectorAll('.handle'))
      h.remove();
  }

  function createHandles(el) {
    removeHandles();
    if (!el)
      return;

    const bbox = el.getBBox();
    const ctm = el.getCTM();
    const svgCtm = refs.svg.getCTM();
    if (!ctm || !svgCtm)
      return;

    const rel = svgCtm.inverse().multiply(ctm);
    const corners = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      { x: bbox.x, y: bbox.y + bbox.height }
    ].map(p => {
      const sp = refs.svg.createSVGPoint();
      sp.x = p.x;
      sp.y = p.y;
      const tp = sp.matrixTransform(rel);
      return { x: tp.x, y: tp.y };
    });

    const minX = Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
    const minY = Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y);
    const maxX = Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
    const maxY = Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y);

    const positions = [
      { pos: 'nw', x: minX, y: minY },
      { pos: 'n',  x: (minX + maxX) / 2, y: minY },
      { pos: 'ne', x: maxX, y: minY },
      { pos: 'e',  x: maxX, y: (minY + maxY) / 2 },
      { pos: 'se', x: maxX, y: maxY },
      { pos: 's',  x: (minX + maxX) / 2, y: maxY },
      { pos: 'sw', x: minX, y: maxY },
      { pos: 'w',  x: minX, y: (minY + maxY) / 2 }
    ];

    const zoom = state.zoom;
    for (const { pos, x, y } of positions) {
      const div = document.createElement('div');
      div.className = 'handle';
      div.dataset.pos = pos;
      div.style.left = `${20 + x * zoom - 4}px`;
      div.style.top = `${20 + y * zoom - 4}px`;
      refs.svgHost.appendChild(div);
    }
  }

  function updateHandles() {
    if (state.active)
      createHandles(state.active);
  }

  function clearSelection() {
    if (state.active)
      state.active.classList.remove('sel');
    state.active = null;
    removeHandles();
    rebuildLayers();
  }

  function selectElement(el) {
    clearSelection();
    if (!el)
      return;

    state.active = el;
    el.classList.add('sel');

    const fill = el.getAttribute('fill');
    const stroke = el.getAttribute('stroke');
    const strokeWidth = el.getAttribute('stroke-width');
    const opacity = el.getAttribute('opacity');
    if (fill && /^#([0-9a-f]{6})$/i.test(fill))
      refs.inpFill.value = fill;
    if (stroke && /^#([0-9a-f]{6})$/i.test(stroke))
      refs.inpStroke.value = stroke;
    if (strokeWidth)
      refs.inpStrokeWidth.value = strokeWidth;
    if (opacity)
      refs.inpOpacity.value = opacity;

    createHandles(el);
    rebuildLayers();
  }

  // ---- Section 9: Shape creation & updating ----
  function createShape(tool, pt) {
    let el = null;
    if (tool === 'rect') {
      el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('x', pt.x);
      el.setAttribute('y', pt.y);
      el.setAttribute('width', '1');
      el.setAttribute('height', '1');
    } else if (tool === 'ellipse') {
      el = document.createElementNS(SVG_NS, 'ellipse');
      el.setAttribute('cx', pt.x);
      el.setAttribute('cy', pt.y);
      el.setAttribute('rx', '0.5');
      el.setAttribute('ry', '0.5');
    } else if (tool === 'circle') {
      el = document.createElementNS(SVG_NS, 'circle');
      el.setAttribute('cx', pt.x);
      el.setAttribute('cy', pt.y);
      el.setAttribute('r', '0.5');
    } else if (tool === 'line') {
      el = document.createElementNS(SVG_NS, 'line');
      el.setAttribute('x1', pt.x);
      el.setAttribute('y1', pt.y);
      el.setAttribute('x2', pt.x);
      el.setAttribute('y2', pt.y);
      el.setAttribute('fill', 'none');
    } else if (tool === 'path') {
      el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', `M ${pt.x} ${pt.y}`);
      el.setAttribute('fill', 'none');
    }
    if (!el)
      return null;

    el.setAttribute('id', nextId());
    applyStyle(el);
    refs.scene.appendChild(el);
    return el;
  }

  function updateShape(el, tool, from, to) {
    if (!el)
      return;

    if (tool === 'rect') {
      const x = Math.min(from.x, to.x);
      const y = Math.min(from.y, to.y);
      const w = Math.max(1, Math.abs(to.x - from.x));
      const h = Math.max(1, Math.abs(to.y - from.y));
      el.setAttribute('x', String(x));
      el.setAttribute('y', String(y));
      el.setAttribute('width', String(w));
      el.setAttribute('height', String(h));
    } else if (tool === 'ellipse') {
      el.setAttribute('cx', String((from.x + to.x) / 2));
      el.setAttribute('cy', String((from.y + to.y) / 2));
      el.setAttribute('rx', String(Math.max(0.5, Math.abs(to.x - from.x) / 2)));
      el.setAttribute('ry', String(Math.max(0.5, Math.abs(to.y - from.y) / 2)));
    } else if (tool === 'circle') {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const r = Math.max(0.5, Math.sqrt(dx * dx + dy * dy));
      el.setAttribute('cx', String(from.x));
      el.setAttribute('cy', String(from.y));
      el.setAttribute('r', String(r));
    } else if (tool === 'line') {
      el.setAttribute('x2', String(to.x));
      el.setAttribute('y2', String(to.y));
    } else if (tool === 'path') {
      const d = el.getAttribute('d') || '';
      el.setAttribute('d', `${d} L ${to.x} ${to.y}`);
    }
  }

  function moveActive(dx, dy) {
    if (!state.active)
      return;
    const base = state.transformBase || '';
    state.active.setAttribute('transform', `translate(${dx} ${dy}) ${base}`.trim());
  }

  function normalizeTransforms() {
    if (!state.active)
      return;
    const current = state.active.getAttribute('transform') || '';
    state.active.setAttribute('transform', current || state.transformBase);
    state.transformBase = '';
  }

  // ---- Section 10: Resize via handles ----
  function getElementGeometry(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'rect')
      return { type: 'rect', x: +el.getAttribute('x'), y: +el.getAttribute('y'), w: +el.getAttribute('width'), h: +el.getAttribute('height') };
    if (tag === 'ellipse')
      return { type: 'ellipse', cx: +el.getAttribute('cx'), cy: +el.getAttribute('cy'), rx: +el.getAttribute('rx'), ry: +el.getAttribute('ry') };
    if (tag === 'circle')
      return { type: 'circle', cx: +el.getAttribute('cx'), cy: +el.getAttribute('cy'), r: +el.getAttribute('r') };
    if (tag === 'line')
      return { type: 'line', x1: +el.getAttribute('x1'), y1: +el.getAttribute('y1'), x2: +el.getAttribute('x2'), y2: +el.getAttribute('y2') };

    return null;
  }

  function applyResize(el, geo, pos, dx, dy) {
    if (!geo)
      return;

    if (geo.type === 'rect') {
      let nx = geo.x, ny = geo.y, nw = geo.w, nh = geo.h;
      if (pos.includes('n')) { ny += dy; nh -= dy; }
      if (pos.includes('s')) nh += dy;
      if (pos.includes('w')) { nx += dx; nw -= dx; }
      if (pos.includes('e')) nw += dx;
      if (nw < 1) nw = 1;
      if (nh < 1) nh = 1;
      el.setAttribute('x', nx);
      el.setAttribute('y', ny);
      el.setAttribute('width', nw);
      el.setAttribute('height', nh);
    } else if (geo.type === 'ellipse') {
      let ncx = geo.cx, ncy = geo.cy, nrx = geo.rx, nry = geo.ry;
      if (pos.includes('e')) { nrx += dx / 2; ncx += dx / 2; }
      if (pos.includes('w')) { nrx -= dx / 2; ncx += dx / 2; }
      if (pos.includes('s')) { nry += dy / 2; ncy += dy / 2; }
      if (pos.includes('n')) { nry -= dy / 2; ncy += dy / 2; }
      el.setAttribute('cx', ncx);
      el.setAttribute('cy', ncy);
      el.setAttribute('rx', Math.max(0.5, nrx));
      el.setAttribute('ry', Math.max(0.5, nry));
    } else if (geo.type === 'circle') {
      const dr = Math.max(Math.abs(dx), Math.abs(dy));
      const sign = (pos.includes('e') || pos.includes('s')) ? 1 : -1;
      el.setAttribute('r', Math.max(0.5, geo.r + sign * dr / 2));
    }
  }

  // ---- Section 11: Copy/Paste/Duplicate ----
  function doCopy() {
    if (!state.active)
      return;
    state.clipboard = state.active.outerHTML;
  }

  function doCut() {
    if (!state.active)
      return;
    doCopy();
    pushUndo();
    const dead = state.active;
    clearSelection();
    dead.remove();
    setDirty();
    rebuildLayers();
    updateSource();
    updateStatusElements();
  }

  function doPaste() {
    if (!state.clipboard)
      return;

    pushUndo();
    const temp = document.createElement('div');
    temp.innerHTML = state.clipboard;
    const src = temp.firstElementChild;
    if (!src)
      return;

    const imported = document.importNode(src, true);
    imported.setAttribute('id', nextId());

    // Offset by 10,10
    const existingTransform = imported.getAttribute('transform') || '';
    imported.setAttribute('transform', `translate(10, 10) ${existingTransform}`.trim());
    refs.scene.appendChild(imported);
    selectElement(imported);
    setDirty();
    rebuildLayers();
    updateSource();
    updateStatusElements();
  }

  function doDuplicate() {
    if (!state.active)
      return;
    doCopy();
    doPaste();
  }

  function doDelete() {
    if (!state.active)
      return;
    pushUndo();
    const dead = state.active;
    clearSelection();
    dead.remove();
    setDirty();
    rebuildLayers();
    updateSource();
    updateStatusElements();
  }

  // ---- Section 12: Grid ----
  function updateGrid() {
    refs.gridOverlay.style.display = state.grid.visible ? '' : 'none';
    const w = Number(refs.svg.getAttribute('width')) || 1024;
    const h = Number(refs.svg.getAttribute('height')) || 768;
    refs.gridOverlay.setAttribute('width', w);
    refs.gridOverlay.setAttribute('height', h);
  }

  function toggleGrid() {
    state.grid.visible = !state.grid.visible;
    updateGrid();
    updateCheckableMenu('toggle-grid', state.grid.visible);
  }

  function toggleSnap() {
    state.grid.snap = !state.grid.snap;
    updateCheckableMenu('toggle-snap', state.grid.snap);
  }

  // ---- Section 13: Layer management ----
  function layerLabel(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.getAttribute('id') || '(no-id)';
    return `${tag} : ${id}`;
  }

  function rebuildLayers() {
    refs.layerList.innerHTML = '';
    const nodes = Array.from(refs.scene.children).reverse();
    for (const el of nodes) {
      const row = document.createElement('div');
      row.className = 'layer-item';
      if (el === state.active)
        row.classList.add('active');

      const vis = document.createElement('input');
      vis.type = 'checkbox';
      vis.checked = el.style.display !== 'none';
      vis.addEventListener('change', (e) => {
        e.stopPropagation();
        el.style.display = vis.checked ? '' : 'none';
        setDirty();
      });

      const name = document.createElement('span');
      name.textContent = layerLabel(el);

      const type = document.createElement('span');
      type.textContent = el.tagName.toLowerCase();
      type.style.opacity = '0.7';

      row.append(vis, name, type);
      row.addEventListener('click', () => selectElement(el));
      refs.layerList.appendChild(row);
    }
  }

  function bringToFront() {
    if (!state.active)
      return;
    pushUndo();
    refs.scene.appendChild(state.active);
    setDirty();
    rebuildLayers();
    updateSource();
    updateHandles();
  }

  function sendToBack() {
    if (!state.active)
      return;
    pushUndo();
    refs.scene.prepend(state.active);
    setDirty();
    rebuildLayers();
    updateSource();
    updateHandles();
  }

  function bringForward() {
    if (!state.active)
      return;
    const next = state.active.nextElementSibling;
    if (!next)
      return;
    pushUndo();
    next.after(state.active);
    setDirty();
    rebuildLayers();
    updateSource();
    updateHandles();
  }

  function sendBackward() {
    if (!state.active)
      return;
    const prev = state.active.previousElementSibling;
    if (!prev)
      return;
    pushUndo();
    prev.before(state.active);
    setDirty();
    rebuildLayers();
    updateSource();
    updateHandles();
  }

  // ---- Section 14: Text tool ----
  function createTextElement(pt) {
    const value = prompt('Text value:');
    if (!value || !value.trim())
      return;

    pushUndo();
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('id', nextId());
    t.setAttribute('x', String(pt.x));
    t.setAttribute('y', String(pt.y));
    t.setAttribute('font-family', 'Tahoma, Segoe UI, sans-serif');
    t.setAttribute('font-size', '18');
    applyStyle(t);
    t.textContent = value;
    refs.scene.appendChild(t);
    selectElement(t);
    setDirty();
    rebuildLayers();
    updateSource();
    updateStatusElements();
  }

  function editTextElement(el) {
    if (el.tagName.toLowerCase() !== 'text')
      return;

    const value = prompt('Edit text:', el.textContent);
    if (value == null)
      return;

    pushUndo();
    el.textContent = value;
    setDirty();
    updateSource();
    updateHandles();
  }

  // ---- Section 15: Document operations ----
  function setDocumentSize(w, h) {
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    refs.svg.setAttribute('width', String(w));
    refs.svg.setAttribute('height', String(h));
    refs.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    refs.inpDocW.value = String(w);
    refs.inpDocH.value = String(h);
    updateGrid();
    updateStatusDoc();
  }

  function newDocument() {
    refs.scene.innerHTML = '';
    clearSelection();
    setDocumentSize(1024, 768);
    refs.workspace.scrollLeft = 0;
    refs.workspace.scrollTop = 0;
    state.filePath = null;
    state.fileName = 'Untitled.svg';
    state.undoStack = [];
    state.redoStack = [];
    setDirty(false);
    rebuildLayers();
    updateSource();
    updateAllStatus();
  }

  function loadSvgText(text, nameHint = null, pathHint = null) {
    const src = decodeDataUrlIfNeeded(String(text || ''));
    const parser = new DOMParser();
    const doc = parser.parseFromString(src, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'svg')
      throw new Error('Not a valid SVG document.');

    const imported = document.importNode(root, true);
    const w = Number(imported.getAttribute('width')) || 1024;
    const h = Number(imported.getAttribute('height')) || 768;
    setDocumentSize(w, h);

    refs.scene.innerHTML = '';
    for (const c of Array.from(imported.children)) {
      // Skip defs if present (we have our own)
      if (c.tagName.toLowerCase() === 'defs')
        continue;
      const clone = document.importNode(c, true);
      if (!clone.getAttribute('id'))
        clone.setAttribute('id', nextId());
      refs.scene.appendChild(clone);
    }

    clearSelection();
    state.filePath = pathHint;
    state.fileName = nameHint || 'Untitled.svg';
    state.undoStack = [];
    state.redoStack = [];
    setDirty(false);
    rebuildLayers();
    updateSource();
    updateAllStatus();
  }

  function serializeSvg() {
    // Clone SVG and remove grid overlay + handles for clean export
    const clone = refs.svg.cloneNode(true);
    const gridEl = clone.querySelector('#gridOverlay');
    if (gridEl)
      gridEl.remove();
    const defsEl = clone.querySelector('defs');
    if (defsEl)
      defsEl.remove();
    // Remove selection class from exported elements
    for (const sel of clone.querySelectorAll('.sel'))
      sel.classList.remove('sel');

    return new XMLSerializer().serializeToString(clone);
  }

  function updateSource() {
    refs.sourceBox.value = new XMLSerializer().serializeToString(refs.svg);
  }

  // ---- Section 16: File operations ----
  async function openFileDialog() {
    const result = await ComDlg32.GetOpenFileName({
      filters: [{ name: 'SVG', ext: ['svg'] }, { name: 'All Files', ext: ['*'] }],
      initialDir: '/user/documents',
      title: 'Open SVG'
    });
    if (result.cancelled || !result.path)
      return;

    let content = result.content;
    if (content == null)
      content = await Kernel32.ReadFile(result.path);
    const name = result.path.split('/').pop() || 'Untitled.svg';
    loadSvgText(content, name, result.path);
  }

  async function saveToPath(path) {
    const data = serializeSvg();
    await Kernel32.WriteFile(path, data);
    state.filePath = path;
    state.fileName = path.split('/').pop() || state.fileName;
    setDirty(false);
    updateSource();
  }

  async function saveFile() {
    if (!state.filePath)
      return saveAsFile();
    await saveToPath(state.filePath);
  }

  async function saveAsFile() {
    const content = serializeSvg();
    const result = await ComDlg32.GetSaveFileName({
      filters: [{ name: 'SVG', ext: ['svg'] }, { name: 'All Files', ext: ['*'] }],
      initialDir: '/user/documents',
      defaultName: state.fileName || 'Untitled.svg',
      title: 'Save SVG As',
      content
    });
    if (result.cancelled || !result.path)
      return;
    await saveToPath(result.path);
  }

  async function exportPng() {
    const svgText = serializeSvg();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const w = Number(refs.svg.getAttribute('width')) || 1024;
    const h = Number(refs.svg.getAttribute('height')) || 768;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const pngData = canvas.toDataURL('image/png');
    const result = await ComDlg32.GetSaveFileName({
      filters: [{ name: 'PNG', ext: ['png'] }, { name: 'All Files', ext: ['*'] }],
      initialDir: '/user/documents',
      defaultName: (state.fileName || 'export.svg').replace(/\.svg$/i, '.png'),
      title: 'Export PNG',
      content: pngData
    });
    if (result.cancelled || !result.path)
      return;
    await Kernel32.WriteFile(result.path, pngData);
  }

  // ---- Section 17: Menu system ----
  function closeMenus() {
    for (const item of refs.menuBar.querySelectorAll('.menu-item'))
      item.classList.remove('open');
    state.openMenu = null;
  }

  function updateCheckableMenu(action, checked) {
    const entry = refs.menuBar.querySelector(`.menu-entry[data-action="${action}"]`);
    if (entry)
      entry.classList.toggle('checked', checked);
  }

  function bindMenuBar() {
    for (const menuItem of refs.menuBar.querySelectorAll('.menu-item')) {
      menuItem.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.menu-entry') || e.target.closest('.menu-separator'))
          return;

        if (state.openMenu === menuItem) {
          closeMenus();
          return;
        }
        closeMenus();
        menuItem.classList.add('open');
        state.openMenu = menuItem;
      });

      menuItem.addEventListener('pointerenter', () => {
        if (state.openMenu && state.openMenu !== menuItem) {
          closeMenus();
          menuItem.classList.add('open');
          state.openMenu = menuItem;
        }
      });
    }

    document.addEventListener('pointerdown', (e) => {
      if (state.openMenu && !refs.menuBar.contains(e.target))
        closeMenus();
    });

    for (const entry of document.querySelectorAll('.menu-entry')) {
      entry.addEventListener('click', () => {
        const action = entry.dataset.action;
        closeMenus();
        handleAction(action);
      });
    }
  }

  // ---- Section 18: Action handler ----
  function handleAction(action) {
    switch (action) {
      case 'new': newDocument(); break;
      case 'open': openFileDialog().catch(() => {}); break;
      case 'save': saveFile().catch(() => {}); break;
      case 'save-as': saveAsFile().catch(() => {}); break;
      case 'export-png': exportPng().catch(() => {}); break;
      case 'exit': User32.DestroyWindow(); break;

      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'cut': doCut(); break;
      case 'copy': doCopy(); break;
      case 'paste': doPaste(); break;
      case 'delete': doDelete(); break;
      case 'select-all': doSelectAll(); break;
      case 'deselect': clearSelection(); break;
      case 'duplicate': doDuplicate(); break;

      case 'zoom-in': zoomIn(); break;
      case 'zoom-out': zoomOut(); break;
      case 'zoom-100': zoomReset(); break;
      case 'zoom-fit': zoomFit(); break;
      case 'toggle-grid': toggleGrid(); break;
      case 'toggle-snap': toggleSnap(); break;
      case 'toggle-dark': toggleDarkMode(); break;

      case 'tool-select': setTool('select'); break;
      case 'tool-rect': setTool('rect'); break;
      case 'tool-ellipse': setTool('ellipse'); break;
      case 'tool-circle': setTool('circle'); break;
      case 'tool-line': setTool('line'); break;
      case 'tool-path': setTool('path'); break;
      case 'tool-text': setTool('text'); break;
      case 'tool-pan': setTool('pan'); break;

      case 'shortcuts': showDialog('dlg-shortcuts'); break;
      case 'about': showDialog('dlg-about'); break;
    }
  }

  function doSelectAll() {
    const first = refs.scene.lastElementChild;
    if (first)
      selectElement(first);
  }

  // ---- Section 19: Dark mode ----
  function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    updateCheckableMenu('toggle-dark', isDark);
    try { localStorage.setItem('svg-editor-dark', isDark ? '1' : '0'); } catch {}
  }

  function restoreDarkMode() {
    try {
      if (localStorage.getItem('svg-editor-dark') === '1') {
        document.body.classList.add('dark');
        updateCheckableMenu('toggle-dark', true);
      }
    } catch {}
  }

  // ---- Section 20: Dialog system ----
  function showDialog(id) {
    const overlay = document.getElementById(id);
    if (!overlay)
      return;
    overlay.classList.add('visible');

    function handleClick(e) {
      const btn = e.target.closest('[data-result]');
      if (!btn)
        return;
      overlay.classList.remove('visible');
      overlay.removeEventListener('click', handleClick);
    }
    overlay.addEventListener('click', handleClick);
  }

  // ---- Section 21: Tool switching ----
  function setTool(tool) {
    state.tool = tool;
    for (const b of refs.toolGrid.querySelectorAll('.tool-btn'))
      b.classList.remove('active');
    const btn = refs.toolGrid.querySelector(`[data-tool="${tool}"]`);
    if (btn)
      btn.classList.add('active');
    updateStatusTool();
  }

  // ---- Section 22: Toolbar & sidebar binding ----
  function bindToolbar() {
    for (const btn of refs.toolGrid.querySelectorAll('.tool-btn')) {
      btn.addEventListener('pointerdown', () => {
        setTool(btn.dataset.tool);
      });
    }

    const styleInputs = [refs.inpFill, refs.inpStroke, refs.inpStrokeWidth, refs.inpOpacity];
    for (const inp of styleInputs) {
      inp.addEventListener('input', () => {
        if (!state.active)
          return;
        pushUndo();
        applyStyle(state.active);
        setDirty();
        updateSource();
      });
    }

    refs.btnResizeDoc.addEventListener('click', () => {
      pushUndo();
      setDocumentSize(Number(refs.inpDocW.value) || 1024, Number(refs.inpDocH.value) || 768);
      setDirty();
      updateSource();
    });

    refs.btnBringFront.addEventListener('click', bringToFront);
    refs.btnBringForward.addEventListener('click', bringForward);
    refs.btnSendBackward.addEventListener('click', sendBackward);
    refs.btnSendBack.addEventListener('click', sendToBack);

    refs.btnApplySource.addEventListener('click', () => {
      try {
        loadSvgText(refs.sourceBox.value, state.fileName, state.filePath);
        setDirty();
      } catch (err) {
        alert(`Invalid SVG source: ${err.message}`);
      }
    });

    refs.btnReloadSource.addEventListener('click', updateSource);
  }

  // ---- Section 23: Pointer events ----
  function bindScene() {
    refs.svg.addEventListener('pointerdown', (e) => {
      const pt = getSvgPoint(e);
      state.start = pt;
      state.last = pt;

      if (state.tool === 'pan') {
        state.dragMode = 'pan';
        state.panStart = {
          x: e.clientX,
          y: e.clientY,
          left: refs.workspace.scrollLeft,
          top: refs.workspace.scrollTop
        };
        refs.svg.setPointerCapture(e.pointerId);
        return;
      }

      if (state.tool === 'select') {
        const target = e.target.closest('#sceneRoot > *');
        if (target) {
          selectElement(target);
          state.dragMode = 'move';
          state.transformBase = target.getAttribute('transform') || '';
          refs.svg.setPointerCapture(e.pointerId);
        } else {
          clearSelection();
        }
        return;
      }

      if (state.tool === 'text') {
        createTextElement(pt);
        return;
      }

      // Drawing tools
      pushUndo();
      const el = createShape(state.tool, pt);
      if (!el)
        return;
      state.drawing = el;
      state.dragMode = 'draw';
      refs.svg.setPointerCapture(e.pointerId);
      selectElement(el);
    });

    refs.svg.addEventListener('pointermove', (e) => {
      const pt = getSvgPoint(e);
      state.last = pt;
      updateStatusCoords(pt.x, pt.y);

      if (state.dragMode === 'pan' && state.panStart) {
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;
        refs.workspace.scrollLeft = state.panStart.left - dx;
        refs.workspace.scrollTop = state.panStart.top - dy;
        return;
      }

      if (state.dragMode === 'move' && state.active && state.start) {
        moveActive(pt.x - state.start.x, pt.y - state.start.y);
        updateHandles();
        return;
      }

      if (state.dragMode === 'draw' && state.drawing && state.start) {
        updateShape(state.drawing, state.tool, state.start, pt);
        updateHandles();
      }

      if (state.dragMode === 'resize' && state.active && state.resizeHandle && state.resizeOrigin) {
        const dx = pt.x - state.start.x;
        const dy = pt.y - state.start.y;
        applyResize(state.active, state.resizeOrigin, state.resizeHandle, dx, dy);
        updateHandles();
      }
    });

    refs.svg.addEventListener('pointerup', (e) => {
      if (state.dragMode === 'move') {
        normalizeTransforms();
        setDirty();
        updateSource();
        updateHandles();
      } else if (state.dragMode === 'draw' && state.drawing) {
        const box = state.drawing.getBBox();
        if (box.width < 0.5 && box.height < 0.5)
          state.drawing.remove();
        else {
          setDirty();
          updateSource();
        }
        state.drawing = null;
        rebuildLayers();
        updateStatusElements();
        updateHandles();
      } else if (state.dragMode === 'resize') {
        setDirty();
        updateSource();
        updateHandles();
        state.resizeHandle = null;
        state.resizeOrigin = null;
      }

      if (state.dragMode === 'pan')
        state.panStart = null;

      state.dragMode = 'none';
      try { refs.svg.releasePointerCapture(e.pointerId); } catch {}
    });

    // Double-click to edit text
    refs.svg.addEventListener('dblclick', (e) => {
      const target = e.target.closest('#sceneRoot > text');
      if (target)
        editTextElement(target);
    });

    // Handle resize via handle divs
    refs.svgHost.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.handle');
      if (!handle || !state.active)
        return;

      e.stopPropagation();
      const pt = getSvgPoint(e);
      state.start = pt;
      state.dragMode = 'resize';
      state.resizeHandle = handle.dataset.pos;
      state.resizeOrigin = getElementGeometry(state.active);
      pushUndo();
      refs.svgHost.setPointerCapture(e.pointerId);
    });

    refs.svgHost.addEventListener('pointermove', (e) => {
      if (state.dragMode !== 'resize')
        return;
      const pt = getSvgPoint(e);
      updateStatusCoords(pt.x, pt.y);
      if (state.active && state.resizeHandle && state.resizeOrigin) {
        const dx = pt.x - state.start.x;
        const dy = pt.y - state.start.y;
        applyResize(state.active, state.resizeOrigin, state.resizeHandle, dx, dy);
        updateHandles();
      }
    });

    refs.svgHost.addEventListener('pointerup', (e) => {
      if (state.dragMode !== 'resize')
        return;
      state.dragMode = 'none';
      state.resizeHandle = null;
      state.resizeOrigin = null;
      setDirty();
      updateSource();
      updateHandles();
      try { refs.svgHost.releasePointerCapture(e.pointerId); } catch {}
    });

    // Ctrl+wheel zoom
    refs.workspace.addEventListener('wheel', (e) => {
      if (!e.ctrlKey)
        return;
      e.preventDefault();
      if (e.deltaY < 0)
        zoomIn();
      else
        zoomOut();
    }, { passive: false });
  }

  // ---- Section 24: Keyboard shortcuts ----
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement || {}).tagName || '';
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Ctrl+key shortcuts work everywhere
      if (e.ctrlKey) {
        const key = e.key.toLowerCase();
        switch (key) {
          case 'z': e.preventDefault(); handleAction('undo'); return;
          case 'y': e.preventDefault(); handleAction('redo'); return;
          case 'n': e.preventDefault(); handleAction('new'); return;
          case 'o': e.preventDefault(); handleAction('open'); return;
          case 's': e.preventDefault(); handleAction('save'); return;
          case 'c': e.preventDefault(); handleAction('copy'); return;
          case 'x': e.preventDefault(); handleAction('cut'); return;
          case 'v': e.preventDefault(); handleAction('paste'); return;
          case 'd': e.preventDefault(); handleAction('duplicate'); return;
          case 'a': e.preventDefault(); handleAction('select-all'); return;
          case 'g': e.preventDefault(); handleAction('toggle-grid'); return;
          case '0': e.preventDefault(); handleAction('zoom-100'); return;
        }
        if (key === '=' || key === '+') { e.preventDefault(); handleAction('zoom-in'); return; }
        if (key === '-') { e.preventDefault(); handleAction('zoom-out'); return; }
        return;
      }

      // Non-Ctrl shortcuts only when not in input fields
      if (inInput)
        return;

      // Tool shortcuts
      const toolKey = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (toolKey) {
        e.preventDefault();
        setTool(toolKey);
        return;
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleAction('delete');
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        clearSelection();
        closeMenus();
        return;
      }

      // Arrow nudge
      const step = e.shiftKey ? 10 : 1;
      if (state.active) {
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        if (dx || dy) {
          e.preventDefault();
          pushUndo();
          const existing = state.active.getAttribute('transform') || '';
          // Parse existing translate if any
          const match = existing.match(/^translate\(([^)]+)\)\s*(.*)$/);
          if (match) {
            const parts = match[1].split(/[\s,]+/).map(Number);
            dx += parts[0] || 0;
            dy += parts[1] || 0;
            state.active.setAttribute('transform', `translate(${dx} ${dy}) ${match[2]}`.trim());
          } else {
            state.active.setAttribute('transform', `translate(${dx} ${dy}) ${existing}`.trim());
          }
          setDirty();
          updateSource();
          updateHandles();
        }
      }
    });
  }

  // ---- Section 25: Color picker integration ----
  function openColorPicker(target) {
    const hex = target.value || '#000000';
    const returnKey = 'sz:svg-editor:colorpick:' + Date.now() + ':' + Math.random().toString(36).slice(2);
    state.colorPickerRequest = { returnKey, target };
    try {
      User32.PostMessage('sz:launchApp', {
        appId: 'color-picker',
        urlParams: { returnKey, hex }
      });
    } catch (_) {
      state.colorPickerRequest = null;
    }
  }

  function bindColorPicker() {
    for (const inp of [refs.inpFill, refs.inpStroke]) {
      inp.addEventListener('click', (e) => {
        e.preventDefault();
        openColorPicker(inp);
      });
    }

    window.addEventListener('storage', (e) => {
      if (!state.colorPickerRequest || !e || e.key !== state.colorPickerRequest.returnKey || !e.newValue)
        return;

      let payload = null;
      try { payload = JSON.parse(e.newValue); } catch { return; }
      if (!payload || payload.type !== 'color-picker-result')
        return;

      const r = clamp(payload.r || 0, 0, 255);
      const g = clamp(payload.g || 0, 0, 255);
      const b = clamp(payload.b || 0, 0, 255);
      const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      state.colorPickerRequest.target.value = hex;

      if (state.active) {
        pushUndo();
        applyStyle(state.active);
        setDirty();
        updateSource();
      }

      try { localStorage.removeItem(state.colorPickerRequest.returnKey); } catch {}
      state.colorPickerRequest = null;
    });
  }

  // ---- Section 26: Boot from command line ----
  function bootFromCommandLine() {
    const cmd = Kernel32.GetCommandLine();
    if (!cmd || !cmd.path)
      return;

    Kernel32.ReadFile(cmd.path)
      .then((txt) => {
        const name = String(cmd.path).split('/').pop() || 'Opened.svg';
        loadSvgText(txt, name, cmd.path);
      })
      .catch(() => {});
  }

  // ---- Section 28: Initialization ----
  bindMenuBar();
  bindToolbar();
  bindScene();
  bindKeyboard();
  bindColorPicker();
  restoreDarkMode();
  newDocument();
  bootFromCommandLine();
})();
