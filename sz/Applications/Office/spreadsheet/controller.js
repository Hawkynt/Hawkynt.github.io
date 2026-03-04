;(function() {
  'use strict';

  const { FormulaEngine, ChartEngine, XlsxEngine, PivotEngine, DataTools, GoalSeek, Protection, PrintLayout, WhatIf } = window.SpreadsheetApp;
  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // ── Constants ──────────────────────────────────────────────────────
  const INIT_COLS = 26;
  const INIT_ROWS = 100;
  const DEFAULT_COL_WIDTH = 80;
  const DEFAULT_ROW_HEIGHT = 20;
  const VISIBLE_ROW_BUFFER = 5;
  const MAX_UNDO = 100;

  const FILE_FILTERS = [
    { name: 'Excel Workbook', ext: ['xlsx'] },
    { name: 'CSV Files', ext: ['csv'] },
    { name: 'TSV Files', ext: ['tsv'] },
    { name: 'All Files', ext: ['*'] }
  ];

  const CELL_STYLES = [
    { name: 'Normal', fmt: {} },
    { name: 'Good', fmt: { bgColor: '#c6efce', textColor: '#006100' } },
    { name: 'Bad', fmt: { bgColor: '#ffc7ce', textColor: '#9c0006' } },
    { name: 'Neutral', fmt: { bgColor: '#ffeb9c', textColor: '#9c5700' } },
    { name: 'Heading 1', fmt: { bold: true, fontSize: 16, textColor: '#003366' } },
    { name: 'Heading 2', fmt: { bold: true, fontSize: 13, textColor: '#003366' } },
    { name: 'Title', fmt: { bold: true, fontSize: 18 } },
    { name: 'Total', fmt: { bold: true, borderBottom: { style: 'double', color: '#000000' } } },
    { name: 'Input', fmt: { bgColor: '#ffffcc', borderAll: { style: 'thin', color: '#999999' } } },
    { name: 'Calculation', fmt: { italic: true, bgColor: '#f2f2f2', borderBottom: { style: 'thin', color: '#999999' } } },
    { name: 'Check Cell', fmt: { bgColor: '#a9d18e', borderAll: { style: 'thin', color: '#548235' } } },
    { name: 'Explanatory', fmt: { italic: true, textColor: '#7f7f7f' } },
    { name: 'Linked Cell', fmt: { textColor: '#0563c1', borderBottom: { style: 'thin', color: '#0563c1' } } },
    { name: 'Note', fmt: { bgColor: '#fff2cc', borderAll: { style: 'thin', color: '#ffc000' } } },
    { name: 'Output', fmt: { bold: true, borderAll: { style: 'thin', color: '#333333' } } },
    { name: 'Warning', fmt: { textColor: '#c00000', bold: true } },
    { name: 'Accent 1', fmt: { bgColor: '#4472c4', textColor: '#ffffff', bold: true } },
    { name: 'Accent 2', fmt: { bgColor: '#ed7d31', textColor: '#ffffff', bold: true } },
    { name: 'Accent 3', fmt: { bgColor: '#70ad47', textColor: '#ffffff', bold: true } },
  ];

  const TABLE_STYLES = [
    { name: 'Blue Medium 2', header: { bg: '#4472c4', fg: '#fff', bold: true },
      bandEven: { bg: '#d9e2f3' }, bandOdd: { bg: '#fff' },
      border: { style: 'thin', color: '#4472c4' } },
    { name: 'Orange Medium 3', header: { bg: '#ed7d31', fg: '#fff', bold: true },
      bandEven: { bg: '#fce4d6' }, bandOdd: { bg: '#fff' },
      border: { style: 'thin', color: '#ed7d31' } },
    { name: 'Gray Medium 4', header: { bg: '#a5a5a5', fg: '#fff', bold: true },
      bandEven: { bg: '#ededed' }, bandOdd: { bg: '#fff' },
      border: { style: 'thin', color: '#a5a5a5' } },
    { name: 'Green Medium 6', header: { bg: '#70ad47', fg: '#fff', bold: true },
      bandEven: { bg: '#e2efda' }, bandOdd: { bg: '#fff' },
      border: { style: 'thin', color: '#70ad47' } },
    { name: 'Gold Medium 7', header: { bg: '#ffc000', fg: '#000', bold: true },
      bandEven: { bg: '#fff2cc' }, bandOdd: { bg: '#fff' },
      border: { style: 'thin', color: '#ffc000' } },
    { name: 'Red Medium 9', header: { bg: '#c00000', fg: '#fff', bold: true },
      bandEven: { bg: '#fce4ec' }, bandOdd: { bg: '#fff' },
      border: { style: 'thin', color: '#c00000' } },
  ];

  // ── Sheet state ────────────────────────────────────────────────────
  const sheets = [];
  let activeSheetIdx = 0;
  let sheetCounter = 0;

  function createSheet(name) {
    return {
      name: name || ('Sheet' + (++sheetCounter)),
      cellData: {},
      cellFormats: {},
      depGraph: {},
      colWidths: {},
      rowHeights: {},
      maxUsedCol: -1,
      maxUsedRow: -1,
      hiddenCols: new Set(),
      hiddenRows: new Set(),
      mergedCells: [],
      conditionalRules: [],
      comments: {},
      hyperlinks: {},
      namedRanges: {},
      filterCol: -1,
      filterValues: null,
      freezeRow: 0,
      freezeCol: 0,
      tabColor: null,
      validationRules: {},
      pivotTables: [],
      inlineCharts: [],
      outlineGroups: { rows: [], cols: [] },
    };
  }

  function S() { return sheets[activeSheetIdx]; }

  function totalCols() { return Math.max(INIT_COLS, (S().maxUsedCol >= 0 ? S().maxUsedCol + 2 : 0)); }
  function totalRows() { return Math.max(INIT_ROWS, (S().maxUsedRow >= 0 ? S().maxUsedRow + 2 : 0)); }
  function getColWidth(col) { return S().colWidths[col] ?? DEFAULT_COL_WIDTH; }
  function getRowHeight(row) { return S().rowHeights[row] ?? DEFAULT_ROW_HEIGHT; }

  function updateSheetExtent(col, row) {
    const s = S();
    if (col > s.maxUsedCol) s.maxUsedCol = col;
    if (row > s.maxUsedRow) s.maxUsedRow = row;
  }

  function recalcSheetExtent() {
    const s = S();
    s.maxUsedCol = -1;
    s.maxUsedRow = -1;
    for (const key in s.cellData) {
      if (s.cellData[key].raw === '') continue;
      const p = parseKey(key);
      if (!p) continue;
      if (p.col > s.maxUsedCol) s.maxUsedCol = p.col;
      if (p.row > s.maxUsedRow) s.maxUsedRow = p.row;
    }
  }

  sheets.push(createSheet());

  // ── Global state ───────────────────────────────────────────────────
  let currentFilePath = null;
  let currentFileName = 'Untitled';
  let dirty = false;
  let currentFileFormat = 'xlsx';
  let activeCell = { col: 0, row: 0 };
  let selectionStart = null;
  let selectionEnd = null;
  let multiSelections = [];
  let isEditing = false;
  let showFormulas = false;

  const undoStack = [];
  const redoStack = [];

  let visibleRowStart = 0;
  let visibleRowEnd = 0;
  const renderedRows = new Map();

  let resizingCol = -1;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  let clipboard = null;
  let clipboardIsCut = false;

  let colorCallback = null;

  // ── Custom cell styles ────────────────────────────────────────────
  const customCellStyles = [];

  // ── DOM refs ───────────────────────────────────────────────────────
  const gridScroll = document.getElementById('grid-scroll');
  const gridHead = document.getElementById('grid-head');
  const gridBody = document.getElementById('grid-body');
  const cellRefInput = document.getElementById('cell-ref');
  const formulaInput = document.getElementById('formula-input');
  const statusCell = document.getElementById('status-cell');
  const statusSummary = document.getElementById('status-summary');
  const colorPalette = document.getElementById('color-palette');
  const sheetTabsEl = document.getElementById('sheet-tabs');

  // ── Helpers ────────────────────────────────────────────────────────
  function colName(index) {
    let s = '';
    let n = index;
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
  }

  function colIndex(name) {
    let idx = 0;
    for (let i = 0; i < name.length; ++i)
      idx = idx * 26 + (name.charCodeAt(i) - 64);
    return idx - 1;
  }

  function cellKey(col, row) { return colName(col) + (row + 1); }

  function parseKey(key) {
    const m = key.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);
    if (!m) return null;
    return { col: colIndex(m[2]), row: parseInt(m[4], 10) - 1 };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getSelectionRect() {
    if (!selectionStart || !selectionEnd)
      return { c1: activeCell.col, r1: activeCell.row, c2: activeCell.col, r2: activeCell.row };
    return {
      c1: Math.min(selectionStart.col, selectionEnd.col),
      r1: Math.min(selectionStart.row, selectionEnd.row),
      c2: Math.max(selectionStart.col, selectionEnd.col),
      r2: Math.max(selectionStart.row, selectionEnd.row),
    };
  }

  function isCellInSelection(col, row) {
    const r = getSelectionRect();
    if (col >= r.c1 && col <= r.c2 && row >= r.r1 && row <= r.r2) return true;
    for (const s of multiSelections)
      if (col >= s.c1 && col <= s.c2 && row >= s.r1 && row <= s.r2) return true;
    return false;
  }

  function getMergedRegion(col, row) {
    for (const m of S().mergedCells)
      if (col >= m.c1 && col <= m.c2 && row >= m.r1 && row <= m.r2) return m;
    return null;
  }

  // ── Cell data access ───────────────────────────────────────────────
  function getCellRaw(col, row) { const d = S().cellData[cellKey(col, row)]; return d ? d.raw : ''; }
  function getCellValue(col, row) { const d = S().cellData[cellKey(col, row)]; return d ? d.value : ''; }
  function getCellError(col, row) { const d = S().cellData[cellKey(col, row)]; return d ? d.error : false; }
  function getFormat(col, row) { return S().cellFormats[cellKey(col, row)] || {}; }

  function setFormat(col, row, props) {
    const key = cellKey(col, row);
    const fmt = S().cellFormats[key] || {};
    Object.assign(fmt, props);
    S().cellFormats[key] = fmt;
  }

  // ── Formula engine ─────────────────────────────────────────────────
  function setCellData(col, row, raw) {
    const key = cellKey(col, row);
    const sheet = S();
    const old = sheet.cellData[key];
    const entry = { raw, value: '', error: false, deps: [] };
    if (raw !== '') updateSheetExtent(col, row);

    if (old && old.deps)
      for (const dep of old.deps) {
        const s = sheet.depGraph[dep];
        if (s) s.delete(key);
      }

    if (typeof raw === 'string' && raw.startsWith('=')) {
      const result = evaluateFormula(raw.substring(1), key);
      entry.value = result.value;
      entry.error = result.error;
      entry.deps = result.deps;
    } else {
      const trimmed = typeof raw === 'string' ? raw.trim() : String(raw);
      const num = Number(trimmed);
      entry.value = (trimmed !== '' && !isNaN(num)) ? num : raw;
      entry.deps = [];
    }

    for (const dep of entry.deps) {
      if (!sheet.depGraph[dep]) sheet.depGraph[dep] = new Set();
      sheet.depGraph[dep].add(key);
    }

    sheet.cellData[key] = entry;
    return entry;
  }

  function recalcDependents(key) {
    const sheet = S();
    const visited = new Set();
    const queue = [key];
    while (queue.length > 0) {
      const k = queue.shift();
      const dependents = sheet.depGraph[k];
      if (!dependents) continue;
      for (const dep of [...dependents]) {
        if (visited.has(dep)) {
          // Circular reference detected
          const d = sheet.cellData[dep];
          if (d) { d.value = '#CIRC!'; d.error = true; }
          continue;
        }
        visited.add(dep);
        const d = sheet.cellData[dep];
        if (d && typeof d.raw === 'string' && d.raw.startsWith('=')) {
          if (d.deps)
            for (const oldDep of d.deps) {
              const s = sheet.depGraph[oldDep];
              if (s) s.delete(dep);
            }
          const result = evaluateFormula(d.raw.substring(1), dep);
          d.value = result.value;
          d.error = result.error;
          d.deps = result.deps;
          for (const newDep of result.deps) {
            if (!sheet.depGraph[newDep]) sheet.depGraph[newDep] = new Set();
            sheet.depGraph[newDep].add(dep);
          }
          queue.push(dep);
        }
      }
    }
    for (const dep of visited) {
      const parsed = parseKey(dep);
      if (parsed) renderCellContent(parsed.col, parsed.row);
    }
  }

  function evaluateFormula(expr, selfKey) {
    return FormulaEngine.evaluateFormula(expr, selfKey);
  }

  function recalcAll() {
    const sheet = S();
    for (const key in sheet.cellData) {
      const d = sheet.cellData[key];
      if (d && typeof d.raw === 'string' && d.raw.startsWith('=')) {
        if (d.deps)
          for (const dep of d.deps) {
            const s = sheet.depGraph[dep];
            if (s) s.delete(key);
          }
        const result = evaluateFormula(d.raw.substring(1), key);
        d.value = result.value;
        d.error = result.error;
        d.deps = result.deps;
        for (const dep of result.deps) {
          if (!sheet.depGraph[dep]) sheet.depGraph[dep] = new Set();
          sheet.depGraph[dep].add(key);
        }
      }
    }
  }

  // ── Number formatting ──────────────────────────────────────────────
  function formatDisplayValue(val, fmt) {
    if (val === '' || val === null || val === undefined) return '';
    const nfmt = (fmt && fmt.numberFmt) || 'general';
    const decimals = (fmt && typeof fmt.decimals === 'number') ? fmt.decimals : 2;
    const thousands = fmt && fmt.thousands;

    // Custom format code support
    if (fmt && fmt.customFormat) {
      try { return FormulaEngine.formatNumberCustom(val, fmt.customFormat); }
      catch { return String(val); }
    }

    if (nfmt === 'general') return String(val);

    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num) && nfmt !== 'text') return String(val);

    switch (nfmt) {
      case 'number': {
        let s = num.toFixed(decimals);
        if (thousands) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        return s;
      }
      case 'currency': {
        let s = num.toFixed(decimals);
        if (thousands) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        return '$' + s;
      }
      case 'percent': return (num * 100).toFixed(decimals) + '%';
      case 'date': { const d = new Date(num); return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString(); }
      case 'time': { const d = new Date(num); return isNaN(d.getTime()) ? String(val) : d.toLocaleTimeString(); }
      case 'scientific': return num.toExponential(decimals);
      case 'fraction': { const whole = Math.floor(Math.abs(num)); const frac = Math.abs(num) - whole; if (frac === 0) return String(num < 0 ? -whole : whole); let bestNum = 0, bestDen = 1, bestErr = frac; for (let d = 1; d <= 100; ++d) { const n = Math.round(frac * d); const err = Math.abs(frac - n / d); if (err < bestErr) { bestErr = err; bestNum = n; bestDen = d; } } const sign = num < 0 ? '-' : ''; return whole ? sign + whole + ' ' + bestNum + '/' + bestDen : sign + bestNum + '/' + bestDen; }
      case 'text': return String(val);
      case 'custom': return fmt.customFormat ? FormulaEngine.formatNumberCustom(val, fmt.customFormat) : String(val);
      default: return String(val);
    }
  }

  // ── Undo / Redo ─────────────────────────────────────────────────
  function pushUndo(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
  }

  function doUndo() {
    if (!undoStack.length) return;
    const action = undoStack.pop();
    redoStack.push(action);
    applyUndoAction(action, false);
  }

  function doRedo() {
    if (!redoStack.length) return;
    const action = redoStack.pop();
    undoStack.push(action);
    applyUndoAction(action, true);
  }

  function applyUndoAction(action, isRedo) {
    if (action.type === 'cell') {
      const val = isRedo ? action.newVal : action.oldVal;
      const fmt = isRedo ? action.newFmt : action.oldFmt;
      setCellData(action.col, action.row, val);
      if (fmt) S().cellFormats[cellKey(action.col, action.row)] = Object.assign({}, fmt);
      recalcDependents(cellKey(action.col, action.row));
      renderCellContent(action.col, action.row);
      setDirty(true);
    } else if (action.type === 'multi')
      for (const sub of (isRedo ? action.actions : [...action.actions].reverse()))
        applyUndoAction(sub, isRedo);
  }

  // ── Grid rendering ─────────────────────────────────────────────────
  function buildColumnHeaders() {
    gridHead.innerHTML = '';
    const tr = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'corner';
    tr.appendChild(corner);
    for (let c = 0; c < totalCols(); ++c) {
      const th = document.createElement('th');
      th.className = 'col-header';
      if (S().hiddenCols.has(c)) th.classList.add('hidden-col');
      th.textContent = colName(c);
      th.style.width = getColWidth(c) + 'px';
      th.dataset.col = c;
      if (S().filterCol === c) th.classList.add('filtered');
      const handle = document.createElement('div');
      handle.className = 'col-resize-handle';
      handle.dataset.col = c;
      th.appendChild(handle);
      tr.appendChild(th);
    }
    gridHead.appendChild(tr);
  }

  function calcVisibleRows() {
    const scrollTop = gridScroll.scrollTop;
    const viewHeight = gridScroll.clientHeight;
    const headerHeight = 20;
    const start = Math.max(0, Math.floor((scrollTop - headerHeight) / DEFAULT_ROW_HEIGHT) - VISIBLE_ROW_BUFFER);
    const end = Math.min(totalRows() - 1, Math.ceil((scrollTop - headerHeight + viewHeight) / DEFAULT_ROW_HEIGHT) + VISIBLE_ROW_BUFFER);
    return { start, end };
  }

  function renderVisibleRows() {
    const { start, end } = calcVisibleRows();
    if (start === visibleRowStart && end === visibleRowEnd) return;
    for (const [rowIdx, tr] of renderedRows) {
      if (rowIdx < start || rowIdx > end) { tr.remove(); renderedRows.delete(rowIdx); }
    }
    for (let r = start; r <= end; ++r) {
      if (!renderedRows.has(r)) {
        const tr = createRow(r);
        let inserted = false;
        for (const child of gridBody.children) {
          const childRow = parseInt(child.dataset.row, 10);
          if (!isNaN(childRow) && childRow > r) { gridBody.insertBefore(tr, child); inserted = true; break; }
        }
        if (!inserted) gridBody.appendChild(tr);
        renderedRows.set(r, tr);
      }
    }
    updateSpacers(start, end);
    visibleRowStart = start;
    visibleRowEnd = end;
  }

  function updateSpacers(start, end) {
    const cols = totalCols() + 1;
    let topSpacer = gridBody.querySelector('.spacer-top');
    if (!topSpacer) {
      topSpacer = document.createElement('tr');
      topSpacer.className = 'spacer-top';
      const td = document.createElement('td');
      td.style.padding = '0'; td.style.border = 'none';
      topSpacer.appendChild(td);
    }
    topSpacer.firstChild.colSpan = cols;
    topSpacer.firstChild.style.height = (start * DEFAULT_ROW_HEIGHT) + 'px';
    if (gridBody.firstChild !== topSpacer) gridBody.insertBefore(topSpacer, gridBody.firstChild);

    let botSpacer = gridBody.querySelector('.spacer-bottom');
    if (!botSpacer) {
      botSpacer = document.createElement('tr');
      botSpacer.className = 'spacer-bottom';
      const td = document.createElement('td');
      td.style.padding = '0'; td.style.border = 'none';
      botSpacer.appendChild(td);
    }
    botSpacer.firstChild.colSpan = cols;
    botSpacer.firstChild.style.height = ((totalRows() - 1 - end) * DEFAULT_ROW_HEIGHT) + 'px';
    gridBody.appendChild(botSpacer);
  }

  function createRow(r) {
    const tr = document.createElement('tr');
    tr.dataset.row = r;
    if (S().hiddenRows.has(r)) tr.classList.add('hidden-row');

    const rh = document.createElement('td');
    rh.className = 'row-header';
    rh.textContent = r + 1;
    rh.style.position = 'relative';
    const rhandle = document.createElement('div');
    rhandle.className = 'row-resize-handle';
    rhandle.dataset.row = r;
    rh.appendChild(rhandle);
    tr.appendChild(rh);

    for (let c = 0; c < totalCols(); ++c) {
      const td = document.createElement('td');
      td.className = 'cell';
      td.dataset.col = c;
      td.dataset.row = r;
      td.style.width = getColWidth(c) + 'px';
      if (S().hiddenCols.has(c)) td.classList.add('hidden-col-cell');
      const merged = getMergedRegion(c, r);
      if (merged && (c !== merged.c1 || r !== merged.r1)) {
        td.classList.add('merged-hidden');
      } else if (merged) {
        td.colSpan = merged.c2 - merged.c1 + 1;
        td.rowSpan = merged.r2 - merged.r1 + 1;
      }
      applyCellStyle(td, c, r);
      updateCellDisplay(td, c, r);
      applyConditionalFormat(td, c, r);
      renderValidationDropdown(td, c, r);
      if (S().comments[cellKey(c, r)]) td.classList.add('has-comment');
      if (S().hyperlinks[cellKey(c, r)]) td.classList.add('has-hyperlink');
      PrintLayout.applyCellBreakIndicators(td, c, r);
      tr.appendChild(td);
    }
    return tr;
  }

  function applyCellStyle(td, col, row) {
    const fmt = getFormat(col, row);
    td.style.fontWeight = fmt.bold ? 'bold' : '';
    td.style.fontStyle = fmt.italic ? 'italic' : '';
    td.style.textDecoration = (fmt.underline ? 'underline ' : '') + (fmt.strikethrough ? 'line-through' : '');
    td.style.textAlign = fmt.align || '';
    td.style.verticalAlign = fmt.valign || '';
    td.style.fontSize = fmt.fontSize ? fmt.fontSize + 'px' : '';
    td.style.fontFamily = fmt.fontFamily || '';
    td.style.backgroundColor = fmt.bgColor || '';
    td.style.color = fmt.textColor || '';
    td.classList.toggle('wrap-text', !!fmt.wrapText);
    if (fmt.textRotation && fmt.textRotation !== '0' && fmt.textRotation !== 0) {
      if (fmt.textRotation === 'vertical') {
        td.style.writingMode = 'vertical-rl';
        td.style.transform = '';
      } else {
        td.style.writingMode = '';
        td.style.transform = 'rotate(' + fmt.textRotation + 'deg)';
      }
    } else {
      td.style.writingMode = '';
      td.style.transform = '';
    }
    applyBorderStyle(td, fmt);
  }

  function applyBorderStyle(td, fmt) {
    const bs = (b) => {
      if (!b) return '';
      const styles = { thin: '1px solid', medium: '2px solid', thick: '3px solid', double: '3px double', dotted: '1px dotted', dashed: '1px dashed' };
      return (styles[b.style] || '1px solid') + ' ' + (b.color || '#000');
    };
    td.style.borderTop = bs(fmt.borderTop || fmt.borderAll);
    td.style.borderBottom = bs(fmt.borderBottom || fmt.borderAll);
    td.style.borderLeft = bs(fmt.borderLeft || fmt.borderAll);
    td.style.borderRight = bs(fmt.borderRight || fmt.borderAll);
  }

  function applyConditionalFormat(td, col, row) {
    const existing = td.querySelector('.cf-data-bar');
    if (existing) existing.remove();
    delete td.dataset.cfIcon;
    const val = getCellValue(col, row);
    for (const rule of S().conditionalRules) {
      if (col < rule.c1 || col > rule.c2 || row < rule.r1 || row > rule.r2) continue;
      let match = false;
      const nv = Number(val);
      switch (rule.type) {
        case 'greater': match = !isNaN(nv) && nv > Number(rule.value1); break;
        case 'less': match = !isNaN(nv) && nv < Number(rule.value1); break;
        case 'equal': match = String(val) === String(rule.value1); break;
        case 'between': match = !isNaN(nv) && nv >= Number(rule.value1) && nv <= Number(rule.value2); break;
        case 'text-contains': match = String(val).toLowerCase().includes(String(rule.value1).toLowerCase()); break;
        case 'duplicate': {
          let cnt = 0;
          for (let r = rule.r1; r <= rule.r2 && cnt < 2; ++r)
            for (let c = rule.c1; c <= rule.c2 && cnt < 2; ++c)
              if (String(getCellValue(c, r)) === String(val)) ++cnt;
          match = cnt > 1;
          break;
        }
        case 'top10': {
          const allVals = [];
          for (let r2 = rule.r1; r2 <= rule.r2; ++r2)
            for (let c2 = rule.c1; c2 <= rule.c2; ++c2) {
              const v2 = Number(getCellValue(c2, r2));
              if (!isNaN(v2)) allVals.push(v2);
            }
          allVals.sort((a, b) => b - a);
          const n = Number(rule.value1) || 10;
          const threshold = allVals[Math.min(n, allVals.length) - 1];
          match = !isNaN(nv) && nv >= threshold;
          break;
        }
        case 'bottom10': {
          const allVals = [];
          for (let r2 = rule.r1; r2 <= rule.r2; ++r2)
            for (let c2 = rule.c1; c2 <= rule.c2; ++c2) {
              const v2 = Number(getCellValue(c2, r2));
              if (!isNaN(v2)) allVals.push(v2);
            }
          allVals.sort((a, b) => a - b);
          const n = Number(rule.value1) || 10;
          const threshold = allVals[Math.min(n, allVals.length) - 1];
          match = !isNaN(nv) && nv <= threshold;
          break;
        }
        case 'data-bar': {
          if (isNaN(nv)) break;
          let minVal = Infinity, maxVal = -Infinity;
          for (let r2 = rule.r1; r2 <= rule.r2; ++r2)
            for (let c2 = rule.c1; c2 <= rule.c2; ++c2) {
              const v2 = Number(getCellValue(c2, r2));
              if (!isNaN(v2)) { if (v2 < minVal) minVal = v2; if (v2 > maxVal) maxVal = v2; }
            }
          const range = maxVal - minVal;
          if (range > 0) {
            const pct = ((nv - minVal) / range) * 100;
            const existing = td.querySelector('.cf-data-bar');
            if (existing) existing.remove();
            const bar = document.createElement('div');
            bar.className = 'cf-data-bar';
            bar.style.width = pct + '%';
            bar.style.backgroundColor = rule.color || '#638ec6';
            td.appendChild(bar);
          }
          break;
        }
        case 'color-scale-2': case 'color-scale-3': {
          if (isNaN(nv)) break;
          let minVal = Infinity, maxVal = -Infinity;
          for (let r2 = rule.r1; r2 <= rule.r2; ++r2)
            for (let c2 = rule.c1; c2 <= rule.c2; ++c2) {
              const v2 = Number(getCellValue(c2, r2));
              if (!isNaN(v2)) { if (v2 < minVal) minVal = v2; if (v2 > maxVal) maxVal = v2; }
            }
          const range = maxVal - minVal;
          if (range > 0) {
            const t = (nv - minVal) / range;
            if (rule.type === 'color-scale-2')
              td.style.backgroundColor = _interpolateColor(rule.colorMin || '#f8696b', rule.colorMax || '#63be7b', t);
            else {
              if (t < 0.5)
                td.style.backgroundColor = _interpolateColor(rule.colorMin || '#f8696b', rule.colorMid || '#ffeb84', t * 2);
              else
                td.style.backgroundColor = _interpolateColor(rule.colorMid || '#ffeb84', rule.colorMax || '#63be7b', (t - 0.5) * 2);
            }
          }
          break;
        }
        case 'icon-3-arrows': case 'icon-4-arrows': case 'icon-3-traffic': case 'icon-3-flags': case 'icon-3-symbols': case 'icon-3-stars': case 'icon-5-rating': {
          if (isNaN(nv)) break;
          let minVal = Infinity, maxVal = -Infinity;
          for (let r2 = rule.r1; r2 <= rule.r2; ++r2)
            for (let c2 = rule.c1; c2 <= rule.c2; ++c2) {
              const v2 = Number(getCellValue(c2, r2));
              if (!isNaN(v2)) { if (v2 < minVal) minVal = v2; if (v2 > maxVal) maxVal = v2; }
            }
          const range = maxVal - minVal;
          if (range > 0) {
            const pct = (nv - minVal) / range;
            let icon = '';
            switch (rule.type) {
              case 'icon-3-arrows': icon = pct >= 0.67 ? '\u25B2' : pct >= 0.33 ? '\u25BA' : '\u25BC'; break;
              case 'icon-4-arrows': icon = pct >= 0.75 ? '\u25B2' : pct >= 0.5 ? '\u2197' : pct >= 0.25 ? '\u2198' : '\u25BC'; break;
              case 'icon-3-traffic': icon = pct >= 0.67 ? '\uD83D\uDFE2' : pct >= 0.33 ? '\uD83D\uDFE1' : '\uD83D\uDD34'; break;
              case 'icon-3-flags': icon = pct >= 0.67 ? '\uD83D\uDFE9' : pct >= 0.33 ? '\uD83D\uDFE8' : '\uD83D\uDFE5'; break;
              case 'icon-3-symbols': icon = pct >= 0.67 ? '\u2714' : pct >= 0.33 ? '\u26A0' : '\u2718'; break;
              case 'icon-3-stars': {
                const starCount = pct >= 0.67 ? 3 : pct >= 0.33 ? 2 : pct > 0 ? 1 : 0;
                icon = '\u2605'.repeat(starCount) + '\u2606'.repeat(3 - starCount);
                break;
              }
              case 'icon-5-rating': {
                const stars = Math.ceil(pct * 5) || 1;
                icon = '\u2605'.repeat(stars) + '\u2606'.repeat(5 - stars);
                break;
              }
            }
            td.dataset.cfIcon = icon;
          }
          break;
        }
        case 'formula': {
          try {
            // Adjust formula references relative to the cell's position within the rule range
            let formula = rule.formula || rule.value1 || '';
            if (!formula) break;
            const dRow = row - rule.r1;
            const dCol = col - rule.c1;
            const adjusted = formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/gi, (m, abCol, colStr, abRow, rowStr) => {
              const newC = abCol === '$' ? colStr : colName(colIndex(colStr.toUpperCase()) + dCol);
              const newR = abRow === '$' ? rowStr : String(parseInt(rowStr, 10) + dRow);
              return abCol + newC + abRow + newR;
            });
            const evalExpr = adjusted.startsWith('=') ? adjusted.substring(1) : adjusted;
            const result = FormulaEngine.evaluateFormula(evalExpr, cellKey(col, row));
            if (result.value === true || result.value === 1 || result.value === 'TRUE') {
              if (rule.fmtBgColor) td.style.backgroundColor = rule.fmtBgColor;
              if (rule.fmtTextColor) td.style.color = rule.fmtTextColor;
              if (rule.fmtBold) td.style.fontWeight = 'bold';
              if (rule.fmtItalic) td.style.fontStyle = 'italic';
              match = true;
            }
          } catch (e) { /* formula evaluation failed, skip */ }
          break;
        }
      }
      if (match && rule.type !== 'formula') td.style.backgroundColor = rule.color;
      if (match && rule.stopIfTrue) return;
    }
  }

  function _interpolateColor(c1, c2, t) {
    const parse = (hex) => {
      const h = hex.replace('#', '');
      return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
    };
    const [r1, g1, b1] = parse(c1);
    const [r2, g2, b2] = parse(c2);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function updateCellDisplay(td, col, row) {
    const key = cellKey(col, row);
    const data = S().cellData[key];
    const val = getCellValue(col, row);
    const err = getCellError(col, row);
    const fmt = getFormat(col, row);
    let display;
    if (showFormulas) {
      const raw = getCellRaw(col, row);
      // Show array formula braces
      if (data && data.isArray) display = '{' + raw + '}';
      else display = raw;
    } else {
      // Check for spill cell
      if (data && data.spillSource) {
        const srcData = S().cellData[data.spillSource];
        if (srcData && srcData.spillResults) {
          const srcParsed = parseKey(data.spillSource);
          if (srcParsed) {
            const dr = row - srcParsed.row, dc = col - srcParsed.col;
            if (srcData.spillResults[dr] && srcData.spillResults[dr][dc] !== undefined) {
              td.textContent = formatDisplayValue(srcData.spillResults[dr][dc], fmt);
              td.classList.toggle('error', false);
              return;
            }
          }
        }
      }
      display = err ? String(val) : formatDisplayValue(val, fmt);
      // Apply color from custom format
      if (fmt && fmt.customFormat) {
        const colorMatch = fmt.customFormat.match(/\[(Red|Blue|Green|Yellow|Magenta|Cyan|White|Black)\]/i);
        if (colorMatch) {
          const colorMap = { red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00', magenta: '#ff00ff', cyan: '#00ffff', white: '#ffffff', black: '#000000' };
          td.style.color = colorMap[colorMatch[1].toLowerCase()] || '';
        }
      }
    }
    td.textContent = display;
    td.classList.toggle('error', !!err);
  }

  function renderCellContent(col, row) {
    const td = getCellElement(col, row);
    if (!td) return;
    applyCellStyle(td, col, row);
    updateCellDisplay(td, col, row);
    applyConditionalFormat(td, col, row);
    renderValidationDropdown(td, col, row);
    renderSparkline(td, col, row);
  }

  function renderValidationDropdown(td, col, row) {
    const existing = td.querySelector('.val-dropdown-arrow');
    const rule = getValidationRule(col, row);
    if (!rule || rule.type !== 'list') {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const arrow = document.createElement('span');
    arrow.className = 'val-dropdown-arrow';
    arrow.textContent = '\u25BC';
    arrow.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      showValidationDropdown(col, row, td);
    });
    td.style.position = 'relative';
    td.appendChild(arrow);
  }

  function getCellElement(col, row) {
    const tr = renderedRows.get(row);
    if (!tr) return null;
    return tr.querySelector('td[data-col="' + col + '"]') || null;
  }

  // ── Selection ──────────────────────────────────────────────────────
  function updateSelectionDisplay() {
    const rect = getSelectionRect();
    for (const [, tr] of renderedRows) {
      const rIdx = parseInt(tr.dataset.row, 10);
      const rh = tr.children[0];
      if (rh) rh.classList.toggle('selected', rIdx >= rect.r1 && rIdx <= rect.r2);
      for (let c = 0; c < totalCols(); ++c) {
        const td = tr.querySelector('td[data-col="' + c + '"]');
        if (!td) continue;
        const isActive = c === activeCell.col && rIdx === activeCell.row;
        const inRange = isCellInSelection(c, rIdx);
        td.classList.toggle('selected', isActive);
        td.classList.toggle('in-range', inRange && !isActive);
      }
    }
    const ths = gridHead.querySelectorAll('.col-header');
    for (let c = 0; c < ths.length; ++c)
      ths[c].classList.toggle('selected', c >= rect.c1 && c <= rect.c2);

    cellRefInput.value = cellKey(activeCell.col, activeCell.row);
    const activeData = S().cellData[cellKey(activeCell.col, activeCell.row)];
    if (activeData && activeData.isArray) formulaInput.value = '{' + getCellRaw(activeCell.col, activeCell.row) + '}';
    else formulaInput.value = getCellRaw(activeCell.col, activeCell.row);
    updateToolbarState();
    updateStatusSummary();

    // Fill handle on active cell
    document.querySelectorAll('.fill-handle').forEach(h => h.remove());
    const activeTd = getCellElement(activeCell.col, activeCell.row);
    if (activeTd && !isEditing) {
      const handle = document.createElement('div');
      handle.className = 'fill-handle';
      activeTd.appendChild(handle);
    }
  }

  function updateToolbarState() {
    const fmt = getFormat(activeCell.col, activeCell.row);
    document.getElementById('btn-bold').classList.toggle('active', !!fmt.bold);
    document.getElementById('btn-italic').classList.toggle('active', !!fmt.italic);
    document.getElementById('btn-underline').classList.toggle('active', !!fmt.underline);
    document.getElementById('btn-strikethrough').classList.toggle('active', !!fmt.strikethrough);
    document.getElementById('btn-align-left').classList.toggle('active', fmt.align === 'left');
    document.getElementById('btn-align-center').classList.toggle('active', fmt.align === 'center');
    document.getElementById('btn-align-right').classList.toggle('active', fmt.align === 'right');
    document.getElementById('btn-valign-top').classList.toggle('active', fmt.valign === 'top');
    document.getElementById('btn-valign-middle').classList.toggle('active', fmt.valign === 'middle');
    document.getElementById('btn-valign-bottom').classList.toggle('active', fmt.valign === 'bottom');
    document.getElementById('btn-wrap-text').classList.toggle('active', !!fmt.wrapText);
    document.getElementById('sel-text-rotation').value = fmt.textRotation || '0';
    document.getElementById('sel-font-size').value = fmt.fontSize || '11';
    document.getElementById('sel-font-family').value = fmt.fontFamily || 'Tahoma, Verdana, sans-serif';
    document.getElementById('sel-number-format').value = fmt.numberFmt || 'general';
    document.getElementById('btn-show-formulas').classList.toggle('active', showFormulas);
  }

  function updateStatusSummary() {
    const rect = getSelectionRect();
    const vals = [];
    let cellCount = 0;
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const v = getCellValue(c, r);
        if (v !== '' && v !== undefined && v !== null) ++cellCount;
        if (typeof v === 'number') vals.push(v);
        else if (typeof v === 'string' && v !== '') { const n = parseFloat(v); if (!isNaN(n)) vals.push(n); }
      }
    if (vals.length > 0 || cellCount > 1) {
      const parts = [];
      if (vals.length > 0) {
        const sum = vals.reduce((a, b) => a + b, 0);
        if (statusBarItems.average) parts.push('Avg: ' + (sum / vals.length).toFixed(2));
        if (statusBarItems.count) parts.push('Count: ' + cellCount);
        if (statusBarItems.numericalCount) parts.push('Num: ' + vals.length);
        if (statusBarItems.sum) parts.push('Sum: ' + sum.toFixed(2));
        if (statusBarItems.min) parts.push('Min: ' + Math.min(...vals).toFixed(2));
        if (statusBarItems.max) parts.push('Max: ' + Math.max(...vals).toFixed(2));
      } else if (statusBarItems.count) parts.push('Count: ' + cellCount);
      statusSummary.textContent = parts.join('  ');
    } else statusSummary.textContent = '';
  }

  // ── Cell editing ───────────────────────────────────────────────────
  function startEditing(col, row, initialValue) {
    if (Protection.isActionBlocked('edit')) return;
    if (isEditing) finishEditing();
    isEditing = true;
    const td = getCellElement(col, row);
    if (!td) return;
    td.classList.add('editing');
    td.textContent = '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-editor';
    input.value = initialValue !== undefined ? initialValue : getCellRaw(col, row);
    td.appendChild(input);
    input.focus();
    formulaInput.value = input.value;
    input.addEventListener('input', () => { formulaInput.value = input.value; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (e.ctrlKey && e.shiftKey) finishEditing(true);
        else finishEditing(false);
        moveCursor(0, 1);
      } else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); finishEditing(); moveCursor(e.shiftKey ? -1 : 1, 0); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
    });
    statusCell.textContent = 'Edit';
  }

  function finishEditing(asArray) {
    if (!isEditing) return;
    const td = getCellElement(activeCell.col, activeCell.row);
    if (!td) return;
    const input = td.querySelector('.cell-editor');
    if (!input) return;
    const newVal = input.value;

    // Validate input before committing
    if (!validateCellInput(activeCell.col, activeCell.row, newVal)) {
      const rule = getValidationRule(activeCell.col, activeCell.row);
      const title = rule.errorTitle || 'Validation Error';
      const msg = rule.errorMsg || 'The value you entered is not valid.';
      User32.MessageBox(msg, title, 0);
      return;
    }

    isEditing = false;
    const oldVal = getCellRaw(activeCell.col, activeCell.row);
    const oldFmt = Object.assign({}, getFormat(activeCell.col, activeCell.row));
    if (newVal !== oldVal || asArray) {
      pushUndo({ type: 'cell', col: activeCell.col, row: activeCell.row, oldVal, newVal, oldFmt, newFmt: Object.assign({}, oldFmt) });
      setCellData(activeCell.col, activeCell.row, newVal);
      // Mark as array formula if Ctrl+Shift+Enter
      if (asArray && newVal.startsWith('=')) {
        const key = cellKey(activeCell.col, activeCell.row);
        S().cellData[key].isArray = true;
        // Attempt to spill array results
        spillArrayFormula(activeCell.col, activeCell.row);
      }
      recalcDependents(cellKey(activeCell.col, activeCell.row));
      setDirty(true);
    }
    td.classList.remove('editing');
    input.remove();
    renderCellContent(activeCell.col, activeCell.row);
    if (S().inlineCharts.length)
      renderAllInlineCharts();
    formulaInput.value = getCellRaw(activeCell.col, activeCell.row);
    // Show array formula braces in formula bar
    const data = S().cellData[cellKey(activeCell.col, activeCell.row)];
    if (data && data.isArray) formulaInput.value = '{' + formulaInput.value + '}';
    statusCell.textContent = 'Ready';
  }

  function spillArrayFormula(col, row) {
    const key = cellKey(col, row);
    const data = S().cellData[key];
    if (!data || !data.isArray) return;
    const val = data.value;
    // If value is an array of arrays, spill into adjacent cells
    if (Array.isArray(val)) {
      data.spillResults = val;
      for (let r = 0; r < val.length; ++r)
        for (let c = 0; c < (Array.isArray(val[r]) ? val[r].length : 1); ++c) {
          if (r === 0 && c === 0) continue;
          const spillKey = cellKey(col + c, row + r);
          if (!S().cellData[spillKey]) S().cellData[spillKey] = { raw: '', value: '', error: false, deps: [] };
          S().cellData[spillKey].spillSource = key;
          S().cellData[spillKey].value = Array.isArray(val[r]) ? val[r][c] : val[r];
          renderCellContent(col + c, row + r);
        }
    }
  }

  function cancelEditing() {
    if (!isEditing) return;
    isEditing = false;
    const td = getCellElement(activeCell.col, activeCell.row);
    if (!td) return;
    const input = td.querySelector('.cell-editor');
    if (input) input.remove();
    td.classList.remove('editing');
    renderCellContent(activeCell.col, activeCell.row);
    formulaInput.value = getCellRaw(activeCell.col, activeCell.row);
    statusCell.textContent = 'Ready';
  }

  // ── Navigation ─────────────────────────────────────────────────────
  function moveCursor(dc, dr) {
    const newCol = Math.max(0, activeCell.col + dc);
    const newRow = Math.max(0, activeCell.row + dr);
    const needRebuild = newCol >= totalCols() || newRow >= totalRows();
    if (newCol > S().maxUsedCol) S().maxUsedCol = newCol;
    if (newRow > S().maxUsedRow) S().maxUsedRow = newRow;
    if (needRebuild) rebuildGrid();
    selectCell(newCol, newRow);
    scrollCellIntoView(activeCell.col, activeCell.row);
  }

  function selectCell(col, row) {
    activeCell = { col, row };
    selectionStart = { col, row };
    selectionEnd = { col, row };
    multiSelections = [];
    updateSelectionDisplay();
  }

  function scrollCellIntoView(col, row) {
    const headerHeight = 20, rowHeaderWidth = 40;
    const cellTop = row * DEFAULT_ROW_HEIGHT + headerHeight;
    const cellBottom = cellTop + DEFAULT_ROW_HEIGHT;
    if (cellTop < gridScroll.scrollTop + headerHeight) gridScroll.scrollTop = cellTop - headerHeight;
    else if (cellBottom > gridScroll.scrollTop + gridScroll.clientHeight) gridScroll.scrollTop = cellBottom - gridScroll.clientHeight;
    let colLeft = rowHeaderWidth;
    for (let c = 0; c < col; ++c) colLeft += getColWidth(c);
    const colRight = colLeft + getColWidth(col);
    if (colLeft < gridScroll.scrollLeft + rowHeaderWidth) gridScroll.scrollLeft = colLeft - rowHeaderWidth;
    else if (colRight > gridScroll.scrollLeft + gridScroll.clientWidth) gridScroll.scrollLeft = colRight - gridScroll.clientWidth;
    renderVisibleRows();
  }

  function extendSelection(dc, dr) {
    if (!selectionEnd) selectionEnd = { col: activeCell.col, row: activeCell.row };
    selectionEnd.col = Math.max(0, selectionEnd.col + dc);
    selectionEnd.row = Math.max(0, selectionEnd.row + dr);
    const needRebuild = selectionEnd.col >= totalCols() || selectionEnd.row >= totalRows();
    if (selectionEnd.col > S().maxUsedCol) S().maxUsedCol = selectionEnd.col;
    if (selectionEnd.row > S().maxUsedRow) S().maxUsedRow = selectionEnd.row;
    if (needRebuild) rebuildGrid();
    updateSelectionDisplay();
    scrollCellIntoView(selectionEnd.col, selectionEnd.row);
  }

  // ── Clipboard ──────────────────────────────────────────────────────
  function doCopy() {
    const rect = getSelectionRect();
    clipboard = [];
    clipboardIsCut = false;
    for (let r = rect.r1; r <= rect.r2; ++r) {
      const row = [];
      for (let c = rect.c1; c <= rect.c2; ++c)
        row.push({ raw: getCellRaw(c, r), value: getCellValue(c, r), fmt: Object.assign({}, getFormat(c, r)) });
      clipboard.push(row);
    }
    const lines = [];
    for (let r = rect.r1; r <= rect.r2; ++r) {
      const cols = [];
      for (let c = rect.c1; c <= rect.c2; ++c) cols.push(String(getCellValue(c, r)));
      lines.push(cols.join('\t'));
    }
    try { navigator.clipboard.writeText(lines.join('\n')); } catch {}
  }

  function doCut() { doCopy(); clipboardIsCut = true; deleteSelection(); }

  function doPaste(mode) {
    if (!clipboard) {
      if (navigator.clipboard && navigator.clipboard.readText)
        navigator.clipboard.readText().then(text => {
          if (!text) return;
          pasteTextAsCells(text);
        }).catch(() => {});
      return;
    }
    const actions = [];
    for (let dr = 0; dr < clipboard.length; ++dr) {
      const row = clipboard[dr];
      for (let dc = 0; dc < row.length; ++dc) {
        const c = activeCell.col + dc, r = activeCell.row + dr;
        const oldVal = getCellRaw(c, r);
        const oldFmt = Object.assign({}, getFormat(c, r));
        let newVal, newFmt;
        if (mode === 'values') { newVal = String(row[dc].value); newFmt = Object.assign({}, oldFmt); }
        else if (mode === 'formulas') { newVal = row[dc].raw; newFmt = Object.assign({}, oldFmt); }
        else if (mode === 'formats') { newVal = oldVal; newFmt = Object.assign({}, row[dc].fmt); }
        else { newVal = row[dc].raw; newFmt = Object.assign({}, row[dc].fmt); }
        actions.push({ type: 'cell', col: c, row: r, oldVal, newVal, oldFmt, newFmt });
        setCellData(c, r, newVal);
        S().cellFormats[cellKey(c, r)] = newFmt;
        recalcDependents(cellKey(c, r));
        renderCellContent(c, r);
      }
    }
    if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
  }

  function pasteTextAsCells(text) {
    const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (rows.length && rows[rows.length - 1] === '') rows.pop();
    const actions = [];
    for (let dr = 0; dr < rows.length; ++dr) {
      const cols = rows[dr].split('\t');
      for (let dc = 0; dc < cols.length; ++dc) {
        const c = activeCell.col + dc, r = activeCell.row + dr;
        const oldVal = getCellRaw(c, r);
        const oldFmt = Object.assign({}, getFormat(c, r));
        const newVal = cols[dc];
        actions.push({ type: 'cell', col: c, row: r, oldVal, newVal, oldFmt, newFmt: Object.assign({}, oldFmt) });
        setCellData(c, r, newVal);
        recalcDependents(cellKey(c, r));
        renderCellContent(c, r);
      }
    }
    if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
  }

  function deleteSelection() {
    const rect = getSelectionRect();
    const actions = [];
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const oldVal = getCellRaw(c, r);
        if (oldVal === '') continue;
        actions.push({ type: 'cell', col: c, row: r, oldVal, newVal: '', oldFmt: Object.assign({}, getFormat(c, r)), newFmt: Object.assign({}, getFormat(c, r)) });
        setCellData(c, r, '');
        recalcDependents(cellKey(c, r));
        renderCellContent(c, r);
      }
    if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
  }

  // ── Formatting ─────────────────────────────────────────────────────
  function applyFormatToSelection(prop, value) {
    const rect = getSelectionRect();
    const actions = [];
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const oldFmt = Object.assign({}, getFormat(c, r));
        const newFmt = Object.assign({}, oldFmt);
        newFmt[prop] = typeof value === 'function' ? value(oldFmt[prop]) : value;
        actions.push({ type: 'cell', col: c, row: r, oldVal: getCellRaw(c, r), newVal: getCellRaw(c, r), oldFmt, newFmt });
        S().cellFormats[cellKey(c, r)] = newFmt;
        renderCellContent(c, r);
      }
    if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
    updateSelectionDisplay();
  }

  function toggleFormat(prop) {
    const current = getFormat(activeCell.col, activeCell.row)[prop];
    applyFormatToSelection(prop, !current);
  }

  // ── Color palette (shared module) ──────────────────────────────────
  const sharedColorPalette = new SZ.ColorPalette(colorPalette, { storageKey: 'sz-spreadsheet-recent-colors' });

  function showColorPalette(anchorEl, callback) {
    sharedColorPalette.show(anchorEl, callback);
  }

  function hideColorPalette() { sharedColorPalette.hide(); }

  // ── Format Painter (shared module) ─────────────────────────────────
  const spreadsheetFormatPainter = new SZ.FormatPainter({
    buttonEl: null,
    cursorTarget: gridScroll,
    cursorClass: 'format-painter-active',
    activeClass: 'active',
    onCapture() {
      return Object.assign({}, getFormat(activeCell.col, activeCell.row));
    },
    onApply(fmt) {
      const sel = getSelectionRect();
      for (let r = sel.top; r <= sel.bottom; ++r)
        for (let c = sel.left; c <= sel.right; ++c) {
          S().cellFormats[cellKey(c, r)] = Object.assign({}, fmt);
          renderCellContent(c, r);
        }
      setDirty(true);
    }
  });

  // ── Column / Row resize ────────────────────────────────────────────
  function updateColumnWidth(col) {
    const th = gridHead.querySelector('th[data-col="' + col + '"]');
    if (th) th.style.width = getColWidth(col) + 'px';
    for (const [, tr] of renderedRows) {
      const td = tr.querySelector('td[data-col="' + col + '"]');
      if (td) td.style.width = getColWidth(col) + 'px';
    }
  }

  function autoResizeColumn(col) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '11px Tahoma, Verdana, sans-serif';
    let maxWidth = 30;
    for (let r = 0; r < totalRows(); ++r) {
      const val = getCellValue(col, r);
      if (val === '') continue;
      const display = formatDisplayValue(val, getFormat(col, r));
      const w = ctx.measureText(display).width + 10;
      if (w > maxWidth) maxWidth = w;
    }
    S().colWidths[col] = Math.min(300, Math.max(30, Math.ceil(maxWidth)));
    updateColumnWidth(col);
  }

  function autoResizeRow(row) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '11px Tahoma, Verdana, sans-serif';
    let maxHeight = DEFAULT_ROW_HEIGHT;
    for (let c = 0; c < totalCols(); ++c) {
      const val = getCellValue(c, row);
      if (val === '') continue;
      const fmt = getFormat(c, row);
      const display = formatDisplayValue(val, fmt);
      if (fmt.wrapText) {
        const colW = getColWidth(c) - 8;
        const textW = ctx.measureText(display).width;
        const lines = Math.ceil(textW / colW) || 1;
        const h = lines * 16 + 4;
        if (h > maxHeight) maxHeight = h;
      } else {
        const h = 20;
        if (h > maxHeight) maxHeight = h;
      }
    }
    S().rowHeights[row] = Math.min(400, Math.max(DEFAULT_ROW_HEIGHT, Math.ceil(maxHeight)));
    rebuildGrid();
  }

  gridHead.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.col-resize-handle');
    if (!handle) return;
    e.preventDefault();
    resizingCol = parseInt(handle.dataset.col, 10);
    resizeStartX = e.clientX;
    resizeStartWidth = getColWidth(resizingCol);
    handle.setPointerCapture(e.pointerId);
    const onMove = (me) => { S().colWidths[resizingCol] = Math.max(30, resizeStartWidth + me.clientX - resizeStartX); updateColumnWidth(resizingCol); };
    const onUp = () => { handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); resizingCol = -1; };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });

  gridHead.addEventListener('dblclick', (e) => {
    const handle = e.target.closest('.col-resize-handle');
    if (handle) autoResizeColumn(parseInt(handle.dataset.col, 10));
  });

  // Row resize via row header handle
  gridBody.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.row-resize-handle');
    if (!handle) return;
    e.preventDefault();
    const row = parseInt(handle.dataset.row, 10);
    const startY = e.clientY;
    const startHeight = getRowHeight(row);
    handle.setPointerCapture(e.pointerId);
    const onMove = (me) => { S().rowHeights[row] = Math.max(12, startHeight + me.clientY - startY); const tr = renderedRows.get(row); if (tr) tr.style.height = getRowHeight(row) + 'px'; };
    const onUp = () => { handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });

  // ── Grid pointer events ────────────────────────────────────────────
  gridScroll.addEventListener('pointerdown', (e) => {
    // Fill handle drag with auto-fill pattern detection
    if (e.target.closest('.fill-handle')) {
      e.preventDefault();
      const sourceRect = getSelectionRect();
      const onMove = (me) => {
        const target = document.elementFromPoint(me.clientX, me.clientY);
        const td = target && target.closest('td.cell');
        if (td) selectionEnd = { col: parseInt(td.dataset.col, 10), row: parseInt(td.dataset.row, 10) };
        updateSelectionDisplay();
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const fullRect = getSelectionRect();
        // Determine fill direction based on where the user dragged
        let direction;
        if (fullRect.r2 > sourceRect.r2) direction = 'down';
        else if (fullRect.r1 < sourceRect.r1) direction = 'up';
        else if (fullRect.c2 > sourceRect.c2) direction = 'right';
        else if (fullRect.c1 < sourceRect.c1) direction = 'left';
        else return; // No expansion
        performAutoFill(sourceRect, fullRect, direction);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      return;
    }

    const td = e.target.closest('td.cell');
    if (!td) return;
    const col = parseInt(td.dataset.col, 10), row = parseInt(td.dataset.row, 10);
    if (isEditing) finishEditing();

    // Format painter apply
    if (spreadsheetFormatPainter.isActive) {
      selectCell(col, row);
      spreadsheetFormatPainter.tryApply();
      return;
    }

    // Hyperlink click
    if (S().hyperlinks[cellKey(col, row)]) {
      const url = S().hyperlinks[cellKey(col, row)];
      if (url) window.open(url, '_blank');
      return;
    }

    if (e.ctrlKey) {
      multiSelections.push(getSelectionRect());
      activeCell = { col, row };
      selectionStart = { col, row };
      selectionEnd = { col, row };
    } else if (e.shiftKey)
      selectionEnd = { col, row };
    else selectCell(col, row);
    updateSelectionDisplay();

    const onMove = (me) => {
      const target = document.elementFromPoint(me.clientX, me.clientY);
      const moveTd = target && target.closest('td.cell');
      if (moveTd) {
        selectionEnd = { col: parseInt(moveTd.dataset.col, 10), row: parseInt(moveTd.dataset.row, 10) };
        updateSelectionDisplay();
      }
    };
    const onUp = () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  gridScroll.addEventListener('dblclick', (e) => {
    const td = e.target.closest('td.cell');
    if (!td) return;
    activeCell = { col: parseInt(td.dataset.col, 10), row: parseInt(td.dataset.row, 10) };
    startEditing(activeCell.col, activeCell.row);
  });

  // ── Cell context menu (right-click on grid) ────────────────────────
  {
    let cellCtxMenu = null;

    const closeCellCtx = () => {
      if (cellCtxMenu && cellCtxMenu.parentNode)
        cellCtxMenu.parentNode.removeChild(cellCtxMenu);
      cellCtxMenu = null;
    };

    gridScroll.addEventListener('contextmenu', (e) => {
      const td = e.target.closest('td.cell');
      if (!td)
        return;
      e.preventDefault();
      closeCellCtx();

      const col = parseInt(td.dataset.col, 10);
      const row = parseInt(td.dataset.row, 10);
      activeCell = { col, row };
      updateSelectionDisplay();

      const menu = document.createElement('div');
      menu.className = 'sheet-context-menu';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';

      const items = [
        { label: 'Cut', action: 'cut' },
        { label: 'Copy', action: 'copy' },
        { label: 'Paste', action: 'paste' },
        { label: 'Paste Special...', action: 'paste-special' },
        { sep: true },
        { label: 'Delete Contents', action: 'delete' },
        { label: 'Clear Formatting', action: 'clear-formatting' },
        { sep: true },
        { label: 'Insert Row Above', action: 'insert-row-above' },
        { label: 'Insert Row Below', action: 'insert-row-below' },
        { label: 'Insert Column Left', action: 'insert-col-left' },
        { label: 'Insert Column Right', action: 'insert-col-right' },
        { sep: true },
        { label: 'Delete Row', action: 'delete-row' },
        { label: 'Delete Column', action: 'delete-col' },
        { sep: true },
        { label: 'Sort A\u2192Z', action: 'sort-asc' },
        { label: 'Sort Z\u2192A', action: 'sort-desc' },
      ];

      for (const item of items) {
        if (item.sep) {
          const sep = document.createElement('div');
          sep.className = 'sheet-ctx-sep';
          menu.appendChild(sep);
          continue;
        }
        const btn = document.createElement('div');
        btn.className = 'sheet-ctx-item';
        btn.textContent = item.label;
        btn.addEventListener('click', () => {
          closeCellCtx();
          handleAction(item.action);
        });
        menu.appendChild(btn);
      }

      document.body.appendChild(menu);
      cellCtxMenu = menu;

      const closeHandler = (ev) => {
        if (!menu.contains(ev.target)) {
          closeCellCtx();
          document.removeEventListener('pointerdown', closeHandler, true);
        }
      };
      setTimeout(() => document.addEventListener('pointerdown', closeHandler, true), 0);
    });
  }

  // ── Keyboard ───────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target === formulaInput || e.target.closest('.find-panel') || e.target.closest('.dialog')) return;
    if (isEditing) return;
    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'n': e.preventDefault(); handleAction('new'); return;
        case 'o': e.preventDefault(); handleAction('open'); return;
        case 's': e.preventDefault(); handleAction('save'); return;
        case 'z': e.preventDefault(); handleAction('undo'); return;
        case 'y': e.preventDefault(); handleAction('redo'); return;
        case 'x': e.preventDefault(); handleAction('cut'); return;
        case 'c': e.preventDefault(); handleAction('copy'); return;
        case 'v': e.preventDefault(); handleAction('paste'); return;
        case 'b': e.preventDefault(); handleAction('bold'); return;
        case 'i': e.preventDefault(); handleAction('italic'); return;
        case 'u': e.preventDefault(); handleAction('underline'); return;
        case 'f': e.preventDefault(); handleAction('find-replace'); return;
        case 'a': e.preventDefault(); handleAction('select-all'); return;
        case ';': {
          e.preventDefault();
          const now = new Date();
          const val = e.shiftKey
            ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : now.toLocaleDateString();
          const oldVal = getCellRaw(activeCell.col, activeCell.row);
          pushUndo({ type: 'cell', col: activeCell.col, row: activeCell.row, oldVal, newVal: val, oldFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)), newFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)) });
          setCellData(activeCell.col, activeCell.row, val);
          recalcDependents(cellKey(activeCell.col, activeCell.row));
          renderCellContent(activeCell.col, activeCell.row);
          setDirty(true);
          return;
        }
      }
      if (e.key === 'Home') {
        e.preventDefault();
        selectCell(0, 0);
        scrollCellIntoView(0, 0);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        const s = S();
        const lastCol = Math.max(0, s.maxUsedCol);
        const lastRow = Math.max(0, s.maxUsedRow);
        selectCell(lastCol, lastRow);
        scrollCellIntoView(lastCol, lastRow);
        return;
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        if (spreadsheetFormatPainter.isActive) {
          e.preventDefault();
          spreadsheetFormatPainter.deactivate();
        }
        break;
      case 'ArrowUp': e.preventDefault(); e.shiftKey ? extendSelection(0, -1) : moveCursor(0, -1); break;
      case 'ArrowDown': e.preventDefault(); e.shiftKey ? extendSelection(0, 1) : moveCursor(0, 1); break;
      case 'ArrowLeft': e.preventDefault(); e.shiftKey ? extendSelection(-1, 0) : moveCursor(-1, 0); break;
      case 'ArrowRight': e.preventDefault(); e.shiftKey ? extendSelection(1, 0) : moveCursor(1, 0); break;
      case 'Tab': e.preventDefault(); moveCursor(e.shiftKey ? -1 : 1, 0); break;
      case 'Enter': e.preventDefault(); moveCursor(0, 1); break;
      case 'PageUp': e.preventDefault(); moveCursor(0, -20); break;
      case 'PageDown': e.preventDefault(); moveCursor(0, 20); break;
      case 'Delete': e.preventDefault(); deleteSelection(); break;
      case 'F2': e.preventDefault(); startEditing(activeCell.col, activeCell.row); break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); startEditing(activeCell.col, activeCell.row, e.key); }
        break;
    }
  });

  // ── Formula bar ────────────────────────────────────────────────────
  formulaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const asArray = e.ctrlKey && e.shiftKey;
      const newVal = formulaInput.value, oldVal = getCellRaw(activeCell.col, activeCell.row);
      if (newVal !== oldVal || asArray) {
        pushUndo({ type: 'cell', col: activeCell.col, row: activeCell.row, oldVal, newVal, oldFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)), newFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)) });
        setCellData(activeCell.col, activeCell.row, newVal);
        if (asArray && newVal.startsWith('=')) {
          S().cellData[cellKey(activeCell.col, activeCell.row)].isArray = true;
          spillArrayFormula(activeCell.col, activeCell.row);
        }
        recalcDependents(cellKey(activeCell.col, activeCell.row));
        renderCellContent(activeCell.col, activeCell.row);
        setDirty(true);
      }
      gridScroll.focus();
      updateSelectionDisplay();
    } else if (e.key === 'Escape') { e.preventDefault(); formulaInput.value = getCellRaw(activeCell.col, activeCell.row); gridScroll.focus(); }
  });
  formulaInput.addEventListener('focus', () => { statusCell.textContent = 'Edit'; });
  formulaInput.addEventListener('blur', () => { statusCell.textContent = 'Ready'; });

  const nameBoxDropdown = document.getElementById('name-box-dropdown');
  cellRefInput.removeAttribute('readonly');

  function navigateToRef(ref) {
    const nr = S().namedRanges[ref];
    const target = nr || ref.toUpperCase();
    const rangeParts = target.split(':');
    const p = parseKey(rangeParts[0]);
    if (p) {
      if (p.col >= totalCols()) S().maxUsedCol = p.col;
      if (p.row >= totalRows()) S().maxUsedRow = p.row;
      if (p.col >= totalCols() || p.row >= totalRows()) rebuildGrid();
      selectCell(p.col, p.row);
      if (rangeParts.length === 2) {
        const p2 = parseKey(rangeParts[1]);
        if (p2) { selectionEnd = { col: p2.col, row: p2.row }; updateSelectionDisplay(); }
      }
      scrollCellIntoView(p.col, p.row);
    }
  }

  function showNameBoxDropdown() {
    const names = Object.entries(S().namedRanges);
    if (!names.length) { nameBoxDropdown.style.display = 'none'; return; }
    nameBoxDropdown.innerHTML = '';
    for (const [name, range] of names) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:3px 6px;cursor:pointer;';
      item.textContent = name + ' (' + range + ')';
      item.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        cellRefInput.value = name;
        nameBoxDropdown.style.display = 'none';
        navigateToRef(name);
        gridScroll.focus();
      });
      item.addEventListener('pointerenter', () => { item.style.backgroundColor = 'var(--sz-color-highlight)'; item.style.color = 'var(--sz-color-highlight-text)'; });
      item.addEventListener('pointerleave', () => { item.style.backgroundColor = ''; item.style.color = ''; });
      nameBoxDropdown.appendChild(item);
    }
    nameBoxDropdown.style.display = '';
  }

  cellRefInput.addEventListener('focus', () => showNameBoxDropdown());
  cellRefInput.addEventListener('blur', () => { setTimeout(() => { nameBoxDropdown.style.display = 'none'; }, 150); });

  cellRefInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameBoxDropdown.style.display = 'none';
      navigateToRef(cellRefInput.value.trim());
      gridScroll.focus();
    }
  });

  // ── Ribbon + Backstage + QAT (shared module) ──────────────────────
  new SZ.Ribbon({ onAction: handleAction });
  SZ.Dialog.wireAll();

  // ── Format Painter double-click for sticky mode ───────────────────
  const fpBtn = document.querySelector('[data-action="format-painter"]');
  if (fpBtn) {
    fpBtn.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleAction('format-painter-dbl');
    });
  }

  // ── Zoom slider (status bar) ──────────────────────────────────────
  const gridContainer = document.getElementById('grid-container');

  let currentZoomPct = 100;
  const statusZoomCtrl = new SZ.ZoomControl(document.getElementById('status-zoom-ctrl'), {
    min: 25, max: 500, step: 1, value: 100,
    onChange: v => setSpreadsheetZoom(v),
  });

  function setSpreadsheetZoom(pct) {
    currentZoomPct = Math.max(25, Math.min(500, pct));
    statusZoomCtrl.value = currentZoomPct;
    gridContainer.style.zoom = currentZoomPct === 100 ? '' : (currentZoomPct / 100);
    visibleRowStart = -1; visibleRowEnd = -1;
    renderVisibleRows();
  }

  // ── Ribbon selects ─────────────────────────────────────────────────
  document.getElementById('sel-font-size').addEventListener('change', (e) => applyFormatToSelection('fontSize', parseInt(e.target.value, 10)));
  document.getElementById('sel-font-family').addEventListener('change', (e) => applyFormatToSelection('fontFamily', e.target.value));
  document.getElementById('sel-number-format').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      showPrompt('Custom Number Format', 'Format code:', '#,##0.00').then(code => {
        if (code && code.trim()) {
          applyFormatToSelection('numberFmt', 'custom');
          applyFormatToSelection('customFormat', code.trim());
          const rect = getSelectionRect();
          for (let r = rect.r1; r <= rect.r2; ++r)
            for (let c = rect.c1; c <= rect.c2; ++c) renderCellContent(c, r);
        }
      });
      return;
    }
    applyFormatToSelection('numberFmt', val);
    const rect = getSelectionRect();
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) renderCellContent(c, r);
  });

  document.getElementById('sel-text-rotation').addEventListener('change', (e) => handleAction('text-rotation'));
  document.getElementById('sel-merge-type').addEventListener('change', (e) => {
    handleAction(e.target.value);
    e.target.value = 'merge-toggle';
  });

  // ── Sheet tabs ─────────────────────────────────────────────────────
  function renderSheetTabs() {
    const tabs = sheetTabsEl.querySelectorAll('.sheet-tab');
    tabs.forEach(t => t.remove());
    const addBtn = document.getElementById('sheet-add');
    for (let i = 0; i < sheets.length; ++i) {
      if (sheets[i].hidden) continue;
      const tab = document.createElement('div');
      tab.className = 'sheet-tab' + (i === activeSheetIdx ? ' active' : '');
      tab.textContent = sheets[i].name;
      tab.dataset.idx = i;
      if (sheets[i].tabColor) {
        const bar = document.createElement('div');
        bar.className = 'tab-color-bar';
        bar.style.backgroundColor = sheets[i].tabColor;
        tab.appendChild(bar);
      }
      tab.addEventListener('click', () => switchSheet(i));
      tab.addEventListener('dblclick', () => {
        const newName = prompt('Rename sheet:', sheets[i].name);
        if (newName && newName.trim()) { sheets[i].name = newName.trim(); renderSheetTabs(); setDirty(true); }
      });
      tab.addEventListener('contextmenu', (e) => showSheetContextMenu(e, i));
      sheetTabsEl.insertBefore(tab, addBtn);
    }
  }

  document.getElementById('sheet-add').addEventListener('click', () => {
    sheets.push(createSheet());
    switchSheet(sheets.length - 1);
    setDirty(true);
  });

  function switchSheet(idx) {
    if (isEditing) finishEditing();
    activeSheetIdx = idx;
    activeCell = { col: 0, row: 0 };
    selectionStart = { col: 0, row: 0 };
    selectionEnd = { col: 0, row: 0 };
    multiSelections = [];
    rebuildGrid();
    renderSheetTabs();
  }

  document.getElementById('formula-fx').addEventListener('click', () => handleAction('insert-function'));

  // ── Scroll ─────────────────────────────────────────────────────────
  gridScroll.addEventListener('scroll', () => renderVisibleRows());

  // ── Find & Replace ─────────────────────────────────────────────────
  const findPanel = document.getElementById('find-panel');
  const fpInput = document.getElementById('fp-input');
  const fpReplaceInput = document.getElementById('fp-replace-input');
  const fpStatus = document.getElementById('fp-status');
  let findLastRow = 0, findLastCol = 0;

  function showFindPanel() { findPanel.classList.add('visible'); fpInput.focus(); fpInput.select(); fpStatus.textContent = ''; }
  function closeFindPanel() { findPanel.classList.remove('visible'); }
  document.getElementById('fp-close').addEventListener('click', closeFindPanel);

  function findNext() {
    const needle = fpInput.value.toLowerCase();
    if (!needle) { fpStatus.textContent = ''; return; }
    let r = findLastRow, c = findLastCol;
    for (let i = 0; i < totalRows() * totalCols(); ++i) {
      const val = String(getCellValue(c, r)).toLowerCase(), raw = String(getCellRaw(c, r)).toLowerCase();
      if (val.includes(needle) || raw.includes(needle)) {
        selectCell(c, r); scrollCellIntoView(c, r); renderVisibleRows(); updateSelectionDisplay();
        fpStatus.textContent = 'Found at ' + cellKey(c, r);
        if (++c >= totalCols()) { c = 0; if (++r >= totalRows()) r = 0; }
        findLastRow = r; findLastCol = c;
        return;
      }
      if (++c >= totalCols()) { c = 0; if (++r >= totalRows()) r = 0; }
    }
    fpStatus.textContent = 'No matches found.';
  }

  function replaceOne() {
    const needle = fpInput.value, replacement = fpReplaceInput.value;
    if (!needle) return;
    const raw = getCellRaw(activeCell.col, activeCell.row);
    if (raw.toLowerCase().includes(needle.toLowerCase())) {
      const newVal = raw.replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), replacement);
      pushUndo({ type: 'cell', col: activeCell.col, row: activeCell.row, oldVal: raw, newVal, oldFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)), newFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)) });
      setCellData(activeCell.col, activeCell.row, newVal);
      recalcDependents(cellKey(activeCell.col, activeCell.row));
      renderCellContent(activeCell.col, activeCell.row);
      setDirty(true);
    }
    findNext();
  }

  function replaceAll() {
    const needle = fpInput.value, replacement = fpReplaceInput.value;
    if (!needle) return;
    const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const actions = [];
    for (let r = 0; r < totalRows(); ++r)
      for (let c = 0; c < totalCols(); ++c) {
        const raw = getCellRaw(c, r);
        if (!re.test(raw)) continue;
        re.lastIndex = 0;
        const newVal = raw.replace(re, replacement);
        actions.push({ type: 'cell', col: c, row: r, oldVal: raw, newVal, oldFmt: Object.assign({}, getFormat(c, r)), newFmt: Object.assign({}, getFormat(c, r)) });
        setCellData(c, r, newVal);
        recalcDependents(cellKey(c, r));
        renderCellContent(c, r);
      }
    if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
    fpStatus.textContent = actions.length + ' replacement(s) made.';
  }

  document.getElementById('fp-find-next').addEventListener('click', findNext);
  document.getElementById('fp-replace-one').addEventListener('click', replaceOne);
  document.getElementById('fp-replace-all').addEventListener('click', replaceAll);
  fpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findNext(); } if (e.key === 'Escape') { e.preventDefault(); closeFindPanel(); } });
  fpInput.addEventListener('input', () => { findLastRow = 0; findLastCol = 0; fpStatus.textContent = ''; });

  // ── Charts (delegated to ChartEngine) ──────────────────────────────
  function drawChartOnCanvas(ctx, W, H, type, data, labels, options) { return ChartEngine.drawChartOnCanvas(ctx, W, H, type, data, labels, options); }
  function getChartDataFromRange(rangeStr) { return ChartEngine.getChartDataFromRange(rangeStr); }
  function createInlineChart(type, sourceRange, options) { return ChartEngine.createInlineChart(type, sourceRange, options); }
  function renderInlineChart(chart) { return ChartEngine.renderInlineChart(chart); }
  function renderAllInlineCharts() { return ChartEngine.renderAllInlineCharts(); }
  function renderSparkline(td, col, row) { return ChartEngine.renderSparkline(td, col, row); }
  function insertSparkline(type) { return ChartEngine.insertSparkline(type); }

  let _lastChartDraw = null;

  function drawChart(type) {
    const rect = getSelectionRect();
    const data = [];
    const labels = [];
    for (let r = rect.r1; r <= rect.r2; ++r) {
      const v = getCellValue(rect.c2 > rect.c1 ? rect.c1 + 1 : rect.c1, r);
      data.push(typeof v === 'number' ? v : (Number(v) || 0));
      labels.push(String(getCellValue(rect.c1, r) || ('Row ' + (r + 1))));
    }
    if (!data.length) return;
    SZ.Dialog.show('dlg-chart').then((result) => {
      if (result !== 'ok' || !_lastChartDraw) return;
      const rect = getSelectionRect();
      const sourceRange = cellKey(rect.c1, rect.r1) + ':' + cellKey(rect.c2, rect.r2);
      createInlineChart(_lastChartDraw.type, sourceRange, _lastChartDraw.opts);
    });
    const title = type.charAt(0).toUpperCase() + type.slice(1) + ' Chart';
    document.getElementById('chart-title').textContent = title;
    document.getElementById('chart-trendline-enable').checked = false;
    document.getElementById('chart-dl-value').checked = false;
    document.getElementById('chart-dl-percent').checked = false;
    document.getElementById('chart-dl-category').checked = false;
    const opts = { title };
    _lastChartDraw = { type, data, labels, opts };
    const canvas = document.getElementById('chart-canvas');
    const ctx = canvas.getContext('2d');
    drawChartOnCanvas(ctx, canvas.width, canvas.height, type, data, labels, opts);
  }

  document.getElementById('chart-apply-opts').addEventListener('click', () => {
    if (!_lastChartDraw) return;
    const { type, data, labels, opts } = _lastChartDraw;
    if (document.getElementById('chart-trendline-enable').checked) {
      opts.trendline = {
        type: document.getElementById('chart-trendline-type').value,
        degree: parseInt(document.getElementById('chart-trendline-degree').value, 10) || 2,
      };
    } else
      delete opts.trendline;

    const dlVal = document.getElementById('chart-dl-value').checked;
    const dlPct = document.getElementById('chart-dl-percent').checked;
    const dlCat = document.getElementById('chart-dl-category').checked;
    if (dlVal || dlPct || dlCat)
      opts.dataLabels = { showValue: dlVal, showPercent: dlPct, showCategory: dlCat };
    else
      delete opts.dataLabels;

    const canvas = document.getElementById('chart-canvas');
    const ctx = canvas.getContext('2d');
    drawChartOnCanvas(ctx, canvas.width, canvas.height, type, data, labels, opts);
  });

  function showInsertChartDialog(type) {
    const rect = getSelectionRect();
    const sourceRange = cellKey(rect.c1, rect.r1) + ':' + cellKey(rect.c2, rect.r2);
    createInlineChart(type, sourceRange, { title: type.charAt(0).toUpperCase() + type.slice(1) + ' Chart' });
  }

  // ── Data Tools (delegated) ─────────────────────────────────────────
  function performAutoFill(sourceRect, targetRect, direction) { return DataTools.performAutoFill(sourceRect, targetRect, direction); }
  function setValidationRule(col, row, rule) { return DataTools.setValidationRule(col, row, rule); }
  function getValidationRule(col, row) { return DataTools.getValidationRule(col, row); }
  function validateCellInput(col, row, value) { return DataTools.validateCellInput(col, row, value); }
  function showValidationDropdown(col, row, td) { return DataTools.showValidationDropdown(col, row, td); }
  function showDataValidationDialog() { return DataTools.showDataValidationDialog(); }

  // ── Pivot (delegated) ──────────────────────────────────────────────
  function showPivotTableDialog() { return PivotEngine.showPivotTableDialog(); }
  function refreshPivotTables() { return PivotEngine.refreshPivotTables(); }

  // ── XLSX (delegated) ───────────────────────────────────────────────
  function saveAsXlsx(path, callback) { return XlsxEngine.saveAsXlsx(path, callback); }
  function loadXlsxWorkbook(data) { return XlsxEngine.loadXlsxWorkbook(data); }

  // ── Function catalog ───────────────────────────────────────────────
  const FUNCTION_CATALOG = [
    { name: 'SUM', cat: 'math', desc: 'SUM(range) - Adds all numbers in a range' },
    { name: 'AVERAGE', cat: 'math', desc: 'AVERAGE(range) - Arithmetic mean of a range' },
    { name: 'MIN', cat: 'math', desc: 'MIN(range) - Smallest number in a range' },
    { name: 'MAX', cat: 'math', desc: 'MAX(range) - Largest number in a range' },
    { name: 'COUNT', cat: 'math', desc: 'COUNT(range) - Count numeric cells' },
    { name: 'COUNTA', cat: 'math', desc: 'COUNTA(range) - Count non-empty cells' },
    { name: 'COUNTBLANK', cat: 'math', desc: 'COUNTBLANK(range) - Count empty cells' },
    { name: 'ROUND', cat: 'math', desc: 'ROUND(number, decimals)' },
    { name: 'ROUNDUP', cat: 'math', desc: 'ROUNDUP(number, decimals)' },
    { name: 'ROUNDDOWN', cat: 'math', desc: 'ROUNDDOWN(number, decimals)' },
    { name: 'CEILING', cat: 'math', desc: 'CEILING(number, significance)' },
    { name: 'FLOOR', cat: 'math', desc: 'FLOOR(number, significance)' },
    { name: 'ABS', cat: 'math', desc: 'ABS(number) - Absolute value' },
    { name: 'SQRT', cat: 'math', desc: 'SQRT(number) - Square root' },
    { name: 'POWER', cat: 'math', desc: 'POWER(base, exponent)' },
    { name: 'MOD', cat: 'math', desc: 'MOD(number, divisor) - Remainder' },
    { name: 'INT', cat: 'math', desc: 'INT(number) - Integer part' },
    { name: 'RAND', cat: 'math', desc: 'RAND() - Random number 0..1' },
    { name: 'RANDBETWEEN', cat: 'math', desc: 'RANDBETWEEN(low, high)' },
    { name: 'PI', cat: 'math', desc: 'PI() - Returns pi' },
    { name: 'SIN', cat: 'math', desc: 'SIN(angle) - Sine' },
    { name: 'COS', cat: 'math', desc: 'COS(angle) - Cosine' },
    { name: 'TAN', cat: 'math', desc: 'TAN(angle) - Tangent' },
    { name: 'LOG', cat: 'math', desc: 'LOG(number, base)' },
    { name: 'LOG10', cat: 'math', desc: 'LOG10(number)' },
    { name: 'LN', cat: 'math', desc: 'LN(number) - Natural log' },
    { name: 'EXP', cat: 'math', desc: 'EXP(number) - e^number' },
    { name: 'FACT', cat: 'math', desc: 'FACT(number) - Factorial' },
    { name: 'COMBIN', cat: 'math', desc: 'COMBIN(n, k) - Combinations' },
    { name: 'PERMUT', cat: 'math', desc: 'PERMUT(n, k) - Permutations' },
    { name: 'PRODUCT', cat: 'math', desc: 'PRODUCT(range)' },
    { name: 'SUMPRODUCT', cat: 'math', desc: 'SUMPRODUCT(range1, range2)' },
    { name: 'SUMIF', cat: 'math', desc: 'SUMIF(range, criteria, sum_range)' },
    { name: 'COUNTIF', cat: 'math', desc: 'COUNTIF(range, criteria)' },
    { name: 'AVERAGEIF', cat: 'math', desc: 'AVERAGEIF(range, criteria, avg_range)' },
    { name: 'MEDIAN', cat: 'stat', desc: 'MEDIAN(range) - Middle value' },
    { name: 'MODE', cat: 'stat', desc: 'MODE(range) - Most frequent value' },
    { name: 'STDEV', cat: 'stat', desc: 'STDEV(range) - Standard deviation (sample)' },
    { name: 'STDEVP', cat: 'stat', desc: 'STDEVP(range) - Standard deviation (population)' },
    { name: 'VAR', cat: 'stat', desc: 'VAR(range) - Variance (sample)' },
    { name: 'VARP', cat: 'stat', desc: 'VARP(range) - Variance (population)' },
    { name: 'LARGE', cat: 'stat', desc: 'LARGE(range, k) - k-th largest' },
    { name: 'SMALL', cat: 'stat', desc: 'SMALL(range, k) - k-th smallest' },
    { name: 'RANK', cat: 'stat', desc: 'RANK(number, range)' },
    { name: 'PERCENTILE', cat: 'stat', desc: 'PERCENTILE(range, k)' },
    { name: 'QUARTILE', cat: 'stat', desc: 'QUARTILE(range, quart)' },
    { name: 'CORREL', cat: 'stat', desc: 'CORREL(range1, range2) - Correlation' },
    { name: 'FORECAST', cat: 'stat', desc: 'FORECAST(x, y_range, x_range)' },
    { name: 'LEFT', cat: 'text', desc: 'LEFT(text, n) - First n characters' },
    { name: 'RIGHT', cat: 'text', desc: 'RIGHT(text, n) - Last n characters' },
    { name: 'MID', cat: 'text', desc: 'MID(text, start, length)' },
    { name: 'LEN', cat: 'text', desc: 'LEN(text) - Length of text' },
    { name: 'FIND', cat: 'text', desc: 'FIND(find_text, within_text)' },
    { name: 'SEARCH', cat: 'text', desc: 'SEARCH(find_text, within_text) - Case-insensitive' },
    { name: 'SUBSTITUTE', cat: 'text', desc: 'SUBSTITUTE(text, old, new)' },
    { name: 'REPLACE', cat: 'text', desc: 'REPLACE(text, start, len, new)' },
    { name: 'TRIM', cat: 'text', desc: 'TRIM(text) - Remove extra spaces' },
    { name: 'UPPER', cat: 'text', desc: 'UPPER(text) - To uppercase' },
    { name: 'LOWER', cat: 'text', desc: 'LOWER(text) - To lowercase' },
    { name: 'PROPER', cat: 'text', desc: 'PROPER(text) - Title case' },
    { name: 'CONCATENATE', cat: 'text', desc: 'CONCATENATE(text1, text2, ...)' },
    { name: 'TEXT', cat: 'text', desc: 'TEXT(value, format)' },
    { name: 'VALUE', cat: 'text', desc: 'VALUE(text) - Convert to number' },
    { name: 'NOW', cat: 'date', desc: 'NOW() - Current date and time' },
    { name: 'TODAY', cat: 'date', desc: 'TODAY() - Current date' },
    { name: 'DATE', cat: 'date', desc: 'DATE(year, month, day)' },
    { name: 'YEAR', cat: 'date', desc: 'YEAR(date) - Extract year' },
    { name: 'MONTH', cat: 'date', desc: 'MONTH(date) - Extract month' },
    { name: 'DAY', cat: 'date', desc: 'DAY(date) - Extract day' },
    { name: 'WEEKDAY', cat: 'date', desc: 'WEEKDAY(date)' },
    { name: 'DATEDIF', cat: 'date', desc: 'DATEDIF(start, end, unit)' },
    { name: 'EOMONTH', cat: 'date', desc: 'EOMONTH(start, months) - End of month' },
    { name: 'NETWORKDAYS', cat: 'date', desc: 'NETWORKDAYS(start, end)' },
    { name: 'IF', cat: 'logical', desc: 'IF(condition, true_val, false_val)' },
    { name: 'AND', cat: 'logical', desc: 'AND(cond1, cond2, ...) - All true' },
    { name: 'OR', cat: 'logical', desc: 'OR(cond1, cond2, ...) - Any true' },
    { name: 'NOT', cat: 'logical', desc: 'NOT(value) - Negate' },
    { name: 'IFERROR', cat: 'logical', desc: 'IFERROR(value, value_if_error)' },
    { name: 'IFS', cat: 'logical', desc: 'IFS(cond1, val1, cond2, val2, ...)' },
    { name: 'SWITCH', cat: 'logical', desc: 'SWITCH(expr, val1, result1, ...)' },
    { name: 'VLOOKUP', cat: 'lookup', desc: 'VLOOKUP(value, range, col_index)' },
    { name: 'HLOOKUP', cat: 'lookup', desc: 'HLOOKUP(value, range, row_index)' },
    { name: 'INDEX', cat: 'lookup', desc: 'INDEX(range, row, col)' },
    { name: 'MATCH', cat: 'lookup', desc: 'MATCH(value, range)' },
    { name: 'INDIRECT', cat: 'lookup', desc: 'INDIRECT(ref_text)' },
    { name: 'ROW', cat: 'lookup', desc: 'ROW(ref) - Row number' },
    { name: 'COLUMN', cat: 'lookup', desc: 'COLUMN(ref) - Column number' },
    { name: 'PMT', cat: 'financial', desc: 'PMT(rate, nper, pv) - Payment' },
    { name: 'PV', cat: 'financial', desc: 'PV(rate, nper, pmt) - Present value' },
    { name: 'FV', cat: 'financial', desc: 'FV(rate, nper, pmt) - Future value' },
    { name: 'NPV', cat: 'financial', desc: 'NPV(rate, cf1, cf2, ...)' },
    { name: 'IRR', cat: 'financial', desc: 'IRR(range) - Internal rate of return' },
    { name: 'SLN', cat: 'financial', desc: 'SLN(cost, salvage, life)' },
    { name: 'ISBLANK', cat: 'info', desc: 'ISBLANK(value)' },
    { name: 'ISERROR', cat: 'info', desc: 'ISERROR(value)' },
    { name: 'ISNUMBER', cat: 'info', desc: 'ISNUMBER(value)' },
    { name: 'ISTEXT', cat: 'info', desc: 'ISTEXT(value)' },
    { name: 'TYPE', cat: 'info', desc: 'TYPE(value) - Returns type code' },
    { name: 'XLOOKUP', cat: 'lookup', desc: 'XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found], [match_mode], [search_mode])' },
    { name: 'XMATCH', cat: 'lookup', desc: 'XMATCH(lookup_value, lookup_array, [match_mode], [search_mode]) - Position in array' },
    { name: 'FILTER', cat: 'lookup', desc: 'FILTER(array, include, [if_empty]) - Filter rows by condition' },
    { name: 'SORT', cat: 'lookup', desc: 'SORT(array, [sort_index], [sort_order], [by_col]) - Sort array' },
    { name: 'UNIQUE', cat: 'lookup', desc: 'UNIQUE(array, [by_col], [exactly_once]) - Distinct values' },
    { name: 'TEXTJOIN', cat: 'text', desc: 'TEXTJOIN(delimiter, ignore_empty, text1, ...) - Join with delimiter' },
    { name: 'MINIFS', cat: 'math', desc: 'MINIFS(min_range, criteria_range, criteria) - Conditional MIN' },
    { name: 'MAXIFS', cat: 'math', desc: 'MAXIFS(max_range, criteria_range, criteria) - Conditional MAX' },
    { name: 'CEILING.MATH', cat: 'math', desc: 'CEILING.MATH(number, [significance], [mode]) - Round up to multiple' },
    { name: 'FLOOR.MATH', cat: 'math', desc: 'FLOOR.MATH(number, [significance], [mode]) - Round down to multiple' },
    { name: 'AGGREGATE', cat: 'math', desc: 'AGGREGATE(function_num, options, ref1, ...) - Multi-function with options' },
    { name: 'ROMAN', cat: 'math', desc: 'ROMAN(number) - Convert to Roman numeral' },
    { name: 'ARABIC', cat: 'math', desc: 'ARABIC(text) - Convert Roman numeral to number' },
    { name: 'BASE', cat: 'math', desc: 'BASE(number, radix, [min_length]) - Convert to text in base' },
    { name: 'DECIMAL', cat: 'math', desc: 'DECIMAL(text, radix) - Convert text from base to decimal' },
    { name: 'SUBTOTAL', cat: 'math', desc: 'SUBTOTAL(function_num, ref1, ...) - Subtotal ignoring hidden rows' },
  ];

  function showInsertFunctionDialog(filterCat) {
    showDialog('dlg-insert-function');
    const catSel = document.getElementById('fn-category');
    const searchInp = document.getElementById('fn-search');
    const listSel = document.getElementById('fn-list');
    const descDiv = document.getElementById('fn-desc');
    if (filterCat) catSel.value = filterCat;
    searchInp.value = '';

    function populate() {
      listSel.innerHTML = '';
      const cat = catSel.value;
      const search = searchInp.value.toUpperCase();
      for (const fn of FUNCTION_CATALOG) {
        if (cat !== 'all' && fn.cat !== cat) continue;
        if (search && !fn.name.includes(search)) continue;
        const opt = document.createElement('option');
        opt.value = fn.name; opt.textContent = fn.name;
        listSel.appendChild(opt);
      }
      descDiv.textContent = '';
    }
    populate();
    catSel.onchange = populate;
    searchInp.oninput = populate;
    listSel.onchange = () => {
      const fn = FUNCTION_CATALOG.find(f => f.name === listSel.value);
      descDiv.textContent = fn ? fn.desc : '';
    };
  }

  // ── Dialog helper (delegates to shared SZ.Dialog) ──────────────────
  function showDialog(id) { return SZ.Dialog.show(id); }

  async function showPrompt(title, msg, defaultVal) {
    document.getElementById('dlg-prompt-title').textContent = title;
    document.getElementById('dlg-prompt-msg').textContent = msg;
    document.getElementById('dlg-prompt-input').value = defaultVal || '';
    const result = await showDialog('dlg-prompt');
    return result === 'ok' ? document.getElementById('dlg-prompt-input').value : null;
  }

  // ── File operations ────────────────────────────────────────────────
  function setDirty(d) { dirty = d; updateTitle(); }
  function updateTitle() {
    const title = (dirty ? '*' : '') + currentFileName + ' - Spreadsheet';
    document.title = title;
    User32.SetWindowText(title);
  }

  function doNew() { if (isEditing) finishEditing(); resetAllSheets(); }

  function resetAllSheets() {
    sheets.length = 0;
    sheetCounter = 0;
    sheets.push(createSheet());
    activeSheetIdx = 0;
    undoStack.length = 0; redoStack.length = 0;
    currentFilePath = null; currentFileName = 'Untitled'; dirty = false; currentFileFormat = 'xlsx';
    activeCell = { col: 0, row: 0 }; selectionStart = { col: 0, row: 0 }; selectionEnd = { col: 0, row: 0 }; multiSelections = [];
    rebuildGrid(); renderSheetTabs(); updateTitle();
  }

  function rebuildGrid() {
    renderedRows.clear(); gridBody.innerHTML = '';
    buildColumnHeaders();
    visibleRowStart = -1; visibleRowEnd = -1;
    renderVisibleRows(); updateSelectionDisplay();
    renderAllInlineCharts();
    renderOutlineGutter();
    renderFreezePanes();
  }

  // ── Freeze Pane Rendering ──────────────────────────────────────────
  function renderFreezePanes() {
    // Remove old freeze indicators and frozen containers
    for (const el of gridScroll.querySelectorAll('.freeze-indicator-col, .freeze-indicator-row, .frozen-corner, .frozen-rows, .frozen-cols'))
      el.remove();

    const freezeRow = S().freezeRow;
    const freezeCol = S().freezeCol;
    if (!freezeRow && !freezeCol) {
      gridScroll.removeEventListener('scroll', _syncFrozenScroll);
      return;
    }

    const headerHeight = 21; // col header row height including border

    // Calculate freeze boundary positions
    let freezeColX = 41; // row header width
    for (let c = 0; c < freezeCol; ++c)
      freezeColX += getColWidth(c);

    let freezeRowY = headerHeight;
    for (let r = 0; r < freezeRow; ++r)
      freezeRowY += (S().rowHeights[r] || DEFAULT_ROW_HEIGHT);

    // Draw freeze indicator lines
    if (freezeCol > 0) {
      const lineCol = document.createElement('div');
      lineCol.className = 'freeze-indicator-col';
      lineCol.style.left = freezeColX + 'px';
      gridScroll.appendChild(lineCol);
    }

    if (freezeRow > 0) {
      const lineRow = document.createElement('div');
      lineRow.className = 'freeze-indicator-row';
      lineRow.style.top = freezeRowY + 'px';
      gridScroll.appendChild(lineRow);
    }

    // Build frozen row container (top, scrolls horizontally with main grid)
    if (freezeRow > 0) {
      const frozenRowsDiv = document.createElement('div');
      frozenRowsDiv.className = 'frozen-rows';
      frozenRowsDiv.style.left = '0px';
      frozenRowsDiv.style.top = '0px';
      frozenRowsDiv.style.width = '100%';
      frozenRowsDiv.style.height = freezeRowY + 'px';

      const table = document.createElement('table');
      table.className = 'grid-table';

      // Duplicate column headers
      const headTr = document.createElement('tr');
      const corner = document.createElement('th');
      corner.className = 'corner';
      corner.style.cssText = 'background:var(--sz-color-button-face);border:1px solid var(--sz-color-button-shadow);border-top:none;padding:2px 4px;font-weight:normal;font-size:11px;text-align:center;min-width:40px;width:40px;height:20px;';
      headTr.appendChild(corner);
      for (let c = 0; c < totalCols(); ++c) {
        const th = document.createElement('th');
        th.className = 'col-header';
        th.textContent = colName(c);
        th.style.cssText = 'background:var(--sz-color-button-face);border:1px solid var(--sz-color-button-shadow);border-top:none;padding:2px 4px;font-weight:normal;font-size:11px;text-align:center;min-width:64px;height:20px;white-space:nowrap;overflow:hidden;';
        th.style.width = getColWidth(c) + 'px';
        if (S().hiddenCols.has(c)) {
          th.style.width = '4px';
          th.style.minWidth = '4px';
          th.style.maxWidth = '4px';
          th.style.padding = '0';
          th.style.overflow = 'hidden';
          th.style.fontSize = '0';
        }
        headTr.appendChild(th);
      }
      const thead = document.createElement('thead');
      thead.appendChild(headTr);
      table.appendChild(thead);

      // Duplicate frozen rows
      const tbody = document.createElement('tbody');
      for (let r = 0; r < freezeRow; ++r) {
        const tr = _buildFreezeRow(r);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      frozenRowsDiv.appendChild(table);
      gridScroll.appendChild(frozenRowsDiv);

      // Sync horizontal scroll (use remove+add to avoid duplicates)
      gridScroll.removeEventListener('scroll', _syncFrozenScroll);
      gridScroll.addEventListener('scroll', _syncFrozenScroll);
    }

    // Build frozen column container (left, scrolls vertically with main grid)
    if (freezeCol > 0) {
      const frozenColsDiv = document.createElement('div');
      frozenColsDiv.className = 'frozen-cols';
      frozenColsDiv.style.left = '0px';
      frozenColsDiv.style.top = '0px';
      frozenColsDiv.style.width = freezeColX + 'px';
      frozenColsDiv.style.height = '100%';

      const table = document.createElement('table');
      table.className = 'grid-table';

      // Column headers for frozen cols
      const headTr = document.createElement('tr');
      const corner = document.createElement('th');
      corner.className = 'corner';
      corner.style.cssText = 'background:var(--sz-color-button-face);border:1px solid var(--sz-color-button-shadow);border-top:none;padding:2px 4px;font-weight:normal;font-size:11px;text-align:center;min-width:40px;width:40px;height:20px;';
      headTr.appendChild(corner);
      for (let c = 0; c < freezeCol; ++c) {
        const th = document.createElement('th');
        th.className = 'col-header';
        th.textContent = colName(c);
        th.style.cssText = 'background:var(--sz-color-button-face);border:1px solid var(--sz-color-button-shadow);border-top:none;padding:2px 4px;font-weight:normal;font-size:11px;text-align:center;min-width:64px;height:20px;white-space:nowrap;overflow:hidden;';
        th.style.width = getColWidth(c) + 'px';
        headTr.appendChild(th);
      }
      const thead = document.createElement('thead');
      thead.appendChild(headTr);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (let r = 0; r < totalRows(); ++r) {
        if (S().hiddenRows.has(r)) continue;
        const tr = document.createElement('tr');
        const rh = document.createElement('td');
        rh.className = 'row-header';
        rh.textContent = r + 1;
        rh.style.cssText = 'background:var(--sz-color-button-face);border:1px solid var(--sz-color-button-shadow);border-left:none;padding:2px 4px;font-size:11px;text-align:center;width:40px;min-width:40px;white-space:nowrap;';
        tr.appendChild(rh);
        for (let c = 0; c < freezeCol; ++c) {
          const td = document.createElement('td');
          td.className = 'cell';
          td.style.width = getColWidth(c) + 'px';
          td.style.cssText += 'border:1px solid var(--sz-color-button-shadow);padding:1px 3px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--sz-color-window);color:var(--sz-color-window-text);height:20px;max-height:20px;';
          applyCellStyle(td, c, r);
          updateCellDisplay(td, c, r);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      frozenColsDiv.appendChild(table);
      gridScroll.appendChild(frozenColsDiv);

      // Sync vertical scroll
      gridScroll.removeEventListener('scroll', _syncFrozenScroll);
      gridScroll.addEventListener('scroll', _syncFrozenScroll);
    }

    // Build frozen corner (top-left, fixed position, doesn't scroll)
    if (freezeRow > 0 && freezeCol > 0) {
      const frozenCorner = document.createElement('div');
      frozenCorner.className = 'frozen-corner';
      frozenCorner.style.left = '0px';
      frozenCorner.style.top = '0px';
      frozenCorner.style.width = freezeColX + 'px';
      frozenCorner.style.height = freezeRowY + 'px';

      const table = document.createElement('table');
      table.className = 'grid-table';

      const headTr = document.createElement('tr');
      const corner = document.createElement('th');
      corner.className = 'corner';
      corner.style.cssText = 'background:var(--sz-color-button-face);border:1px solid var(--sz-color-button-shadow);border-top:none;padding:2px 4px;font-weight:normal;font-size:11px;text-align:center;min-width:40px;width:40px;height:20px;';
      headTr.appendChild(corner);
      for (let c = 0; c < freezeCol; ++c) {
        const th = document.createElement('th');
        th.className = 'col-header';
        th.textContent = colName(c);
        th.style.cssText = 'background:var(--sz-color-button-face);border:1px solid var(--sz-color-button-shadow);border-top:none;padding:2px 4px;font-weight:normal;font-size:11px;text-align:center;min-width:64px;height:20px;white-space:nowrap;overflow:hidden;';
        th.style.width = getColWidth(c) + 'px';
        headTr.appendChild(th);
      }
      const thead = document.createElement('thead');
      thead.appendChild(headTr);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (let r = 0; r < freezeRow; ++r) {
        const tr = document.createElement('tr');
        const rh = document.createElement('td');
        rh.className = 'row-header';
        rh.textContent = r + 1;
        rh.style.cssText = 'background:var(--sz-color-button-face);border:1px solid var(--sz-color-button-shadow);border-left:none;padding:2px 4px;font-size:11px;text-align:center;width:40px;min-width:40px;white-space:nowrap;';
        tr.appendChild(rh);
        for (let c = 0; c < freezeCol; ++c) {
          const td = document.createElement('td');
          td.className = 'cell';
          td.style.width = getColWidth(c) + 'px';
          td.style.cssText += 'border:1px solid var(--sz-color-button-shadow);padding:1px 3px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--sz-color-window);color:var(--sz-color-window-text);height:20px;max-height:20px;';
          applyCellStyle(td, c, r);
          updateCellDisplay(td, c, r);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      frozenCorner.appendChild(table);
      gridScroll.appendChild(frozenCorner);
    }
  }

  function _buildFreezeRow(r) {
    const tr = document.createElement('tr');
    if (S().hiddenRows.has(r)) tr.style.display = 'none';
    const rh = document.createElement('td');
    rh.className = 'row-header';
    rh.textContent = r + 1;
    rh.style.cssText = 'background:var(--sz-color-button-face);border:1px solid var(--sz-color-button-shadow);border-left:none;padding:2px 4px;font-size:11px;text-align:center;width:40px;min-width:40px;white-space:nowrap;';
    tr.appendChild(rh);
    for (let c = 0; c < totalCols(); ++c) {
      const td = document.createElement('td');
      td.className = 'cell';
      td.style.width = getColWidth(c) + 'px';
      td.style.cssText += 'border:1px solid var(--sz-color-button-shadow);padding:1px 3px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--sz-color-window);color:var(--sz-color-window-text);height:20px;max-height:20px;';
      if (S().hiddenCols.has(c)) {
        td.style.width = '4px';
        td.style.minWidth = '4px';
        td.style.maxWidth = '4px';
        td.style.padding = '0';
        td.style.overflow = 'hidden';
        td.style.fontSize = '0';
      }
      applyCellStyle(td, c, r);
      updateCellDisplay(td, c, r);
      tr.appendChild(td);
    }
    return tr;
  }

  function _syncFrozenScroll() {
    const frozenRows = gridScroll.querySelector('.frozen-rows');
    if (frozenRows)
      frozenRows.scrollLeft = gridScroll.scrollLeft;
    const frozenCols = gridScroll.querySelector('.frozen-cols');
    if (frozenCols)
      frozenCols.scrollTop = gridScroll.scrollTop;
  }

  async function doOpen() {
    if (isEditing) finishEditing();
    const result = await ComDlg32.GetOpenFileName({ filters: FILE_FILTERS, initialDir: '/user/documents', title: 'Open' });
    if (!result.cancelled && result.path) {
      const path = result.path;
      if (/\.xlsx$/i.test(path)) {
        try {
          const data = await Kernel32.ReadFile(path, { encoding: 'binary' });
          loadXlsxWorkbook(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
        } catch (err) {
          await User32.MessageBox('Could not open file: ' + err.message, 'Spreadsheet', MB_OK);
          return;
        }
        currentFilePath = path;
        const parts = path.split('/');
        currentFileName = parts[parts.length - 1] || 'Untitled';
        currentFileFormat = 'xlsx';
        dirty = false;
        rebuildGrid(); renderSheetTabs(); updateTitle();
      } else {
        let content = '';
        try { content = await Kernel32.ReadFile(result.path); } catch (err) { await User32.MessageBox('Could not open file: ' + err.message, 'Spreadsheet', MB_OK); return; }
        currentFileFormat = /\.tsv$/i.test(path) ? 'tsv' : 'csv';
        loadDelimited(result.path, content);
      }
    }
  }

  function loadDelimited(path, content) {
    resetAllSheets();
    const isTsv = path && /\.tsv$/i.test(path);
    if (content) {
      const lines = content.split('\n');
      for (let r = 0; r < lines.length; ++r) {
        const cols = isTsv ? parseTSVLine(lines[r]) : parseCSVLine(lines[r]);
        for (let c = 0; c < cols.length; ++c) setCellData(c, r, cols[c]);
      }
    }
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    rebuildGrid(); renderSheetTabs(); updateTitle();
  }

  function parseCSVLine(line) {
    const result = []; let current = '', inQuotes = false;
    for (let i = 0; i < line.length; ++i) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') { if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; ++i; } else inQuotes = false; }
        else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { result.push(current); current = ''; }
        else current += ch;
      }
    }
    result.push(current);
    return result;
  }

  function toCSV() {
    const lines = [];
    let maxRow = 0, maxCol = 0;
    for (const key in S().cellData) {
      const parsed = parseKey(key);
      if (parsed && S().cellData[key].raw !== '') { if (parsed.row > maxRow) maxRow = parsed.row; if (parsed.col > maxCol) maxCol = parsed.col; }
    }
    for (let r = 0; r <= maxRow; ++r) {
      const cols = [];
      for (let c = 0; c <= maxCol; ++c) {
        const raw = getCellRaw(c, r);
        cols.push((raw.includes(',') || raw.includes('"') || raw.includes('\n')) ? '"' + raw.replace(/"/g, '""') + '"' : raw);
      }
      lines.push(cols.join(','));
    }
    return lines.join('\n');
  }

  async function doSave() {
    if (!currentFilePath) { doSaveAs(); return; }
    if (/\.xlsx$/i.test(currentFilePath) || currentFileFormat === 'xlsx') {
      await saveAsXlsx(currentFilePath);
      return;
    }
    const content = /\.tsv$/i.test(currentFilePath) ? toTSV() : toCSV();
    try { await Kernel32.WriteFile(currentFilePath, content); } catch (err) { await User32.MessageBox('Could not save: ' + err.message, 'Spreadsheet', MB_OK); return; }
    setDirty(false);
  }

  async function doSaveAs() {
    const baseName = (currentFileName || 'Untitled').replace(/\.[^.]+$/, '');
    const defaultName = baseName + '.xlsx';
    const result = await ComDlg32.GetSaveFileName({ filters: FILE_FILTERS, initialDir: '/user/documents', defaultName, title: 'Save As' });
    if (!result.cancelled && result.path) {
      const path = result.path;
      if (/\.xlsx$/i.test(path)) {
        currentFileFormat = 'xlsx';
        await saveAsXlsx(path);
      } else {
        currentFilePath = path;
        const parts = path.split('/');
        currentFileName = parts[parts.length - 1] || 'Untitled';
        currentFileFormat = /\.tsv$/i.test(path) ? 'tsv' : 'csv';
        const content = currentFileFormat === 'tsv' ? toTSV() : toCSV();
        try { await Kernel32.WriteFile(currentFilePath, content); } catch (err) { await User32.MessageBox('Could not save: ' + err.message, 'Spreadsheet', MB_OK); return; }
        setDirty(false);
      }
    }
  }

  // ── XLSX Import (via SheetJS) ──────────────────────────────────────

  async function doImportXlsx() {
    if (isEditing) finishEditing();
    const result = await ComDlg32.ImportFile({ accept: '.xlsx,.xls' });
    if (result.cancelled) return;
    try {
      const workbook = XLSX.read(result.data, { type: 'array' });
      sheets.length = 0;
      sheetCounter = 0;
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        ++sheetCounter;
        const sheet = createSheet(sheetName);
        if (ws['!ref']) {
          const range = XLSX.utils.decode_range(ws['!ref']);
          for (let r = range.s.r; r <= range.e.r; ++r)
            for (let c = range.s.c; c <= range.e.c; ++c) {
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = ws[addr];
              if (cell) {
                const key = cellKey(c, r);
                const raw = cell.f ? '=' + cell.f : String(cell.v ?? '');
                sheet.cellData[key] = { raw, value: cell.v ?? '', error: false, deps: [] };
                if (c > sheet.maxUsedCol) sheet.maxUsedCol = c;
                if (r > sheet.maxUsedRow) sheet.maxUsedRow = r;
              }
            }
        }
        if (ws['!cols'])
          for (let c = 0; c < ws['!cols'].length; ++c)
            if (ws['!cols'][c]?.wpx) sheet.colWidths[c] = ws['!cols'][c].wpx;
        sheets.push(sheet);
      }
      if (sheets.length === 0) { ++sheetCounter; sheets.push(createSheet()); }
      activeSheetIdx = 0;
      undoStack.length = 0; redoStack.length = 0;
      currentFileName = result.name.replace(/\.xlsx?$/i, '');
      currentFilePath = null;
      activeCell = { col: 0, row: 0 }; selectionStart = { col: 0, row: 0 }; selectionEnd = { col: 0, row: 0 }; multiSelections = [];
      dirty = false;
      rebuildGrid(); renderSheetTabs(); updateTitle();
    } catch (err) {
      await User32.MessageBox('Could not import XLSX: ' + err.message, 'Spreadsheet', MB_OK);
    }
  }

  // ── XLSX Export (via SheetJS) ─────────────────────────────────────

  function doExportXlsx() {
    if (isEditing) finishEditing();
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      let maxRow = 0, maxCol = 0;
      for (const key in sheet.cellData) {
        const p = parseKey(key);
        if (p && sheet.cellData[key].raw !== '') {
          if (p.row > maxRow) maxRow = p.row;
          if (p.col > maxCol) maxCol = p.col;
        }
      }
      // Build plain value array for aoa_to_sheet
      const aoa = [];
      for (let r = 0; r <= maxRow; ++r) {
        const row = [];
        for (let c = 0; c <= maxCol; ++c) {
          const d = sheet.cellData[cellKey(c, r)];
          row.push(d ? (d.raw.startsWith('=') ? (d.value ?? '') : d.raw) : '');
        }
        aoa.push(row);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Overlay formula cells
      for (let r = 0; r <= maxRow; ++r)
        for (let c = 0; c <= maxCol; ++c) {
          const d = sheet.cellData[cellKey(c, r)];
          if (d && d.raw.startsWith('=')) {
            const addr = XLSX.utils.encode_cell({ r, c });
            ws[addr] = { t: 'n', f: d.raw.slice(1), v: d.value ?? 0 };
          }
        }
      const colsArr = [];
      for (let c = 0; c <= maxCol; ++c) colsArr.push({ wpx: sheet.colWidths[c] ?? DEFAULT_COL_WIDTH });
      ws['!cols'] = colsArr;
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const name = (currentFileName.replace(/\.[^.]+$/, '') || 'Untitled') + '.xlsx';
    ComDlg32.ExportFile(
      new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      name
    );
  }

  // ── TSV Import/Export ─────────────────────────────────────────────

  function parseTSVLine(line) {
    return line.split('\t');
  }

  function loadTSV(content, name) {
    resetAllSheets();
    if (content) {
      const lines = content.split('\n');
      for (let r = 0; r < lines.length; ++r) {
        const cols = parseTSVLine(lines[r]);
        for (let c = 0; c < cols.length; ++c)
          setCellData(c, r, cols[c]);
      }
    }
    currentFilePath = null;
    currentFileName = name ? name.replace(/\.tsv?$/i, '') : 'Untitled';
    dirty = false;
    rebuildGrid(); renderSheetTabs(); updateTitle();
  }

  function toTSV() {
    const lines = [];
    let maxRow = 0, maxCol = 0;
    for (const key in S().cellData) {
      const parsed = parseKey(key);
      if (parsed && S().cellData[key].raw !== '') { if (parsed.row > maxRow) maxRow = parsed.row; if (parsed.col > maxCol) maxCol = parsed.col; }
    }
    for (let r = 0; r <= maxRow; ++r) {
      const cols = [];
      for (let c = 0; c <= maxCol; ++c)
        cols.push(getCellRaw(c, r));
      lines.push(cols.join('\t'));
    }
    return lines.join('\n');
  }

  async function doImportTsv() {
    if (isEditing) finishEditing();
    const result = await ComDlg32.ImportFile({ accept: '.tsv,.tab', readAs: 'text' });
    if (result.cancelled) return;
    loadTSV(result.data, result.name);
  }

  function doExportTsv() {
    if (isEditing) finishEditing();
    const name = (currentFileName.replace(/\.[^.]+$/, '') || 'Untitled') + '.tsv';
    ComDlg32.ExportFile(new Blob([toTSV()], { type: 'text/tab-separated-values' }), name);
  }

  // ── Trace Arrows (SVG overlay) ──────────────────────────────────

  function removeTraceArrows() {
    const existing = gridScroll.querySelector('.trace-arrow-overlay');
    if (existing) existing.remove();
  }

  function drawTraceArrows(fromCol, fromRow, refs) {
    removeTraceArrows();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('trace-arrow-overlay');
    svg.style.width = gridScroll.scrollWidth + 'px';
    svg.style.height = gridScroll.scrollHeight + 'px';

    // Arrowhead marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'trace-arrowhead');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L8,3 L0,6 Z');
    path.setAttribute('fill', '#0066cc');
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);

    function getCellCenter(col, row) {
      const headerHeight = 20;
      const rowHeaderWidth = 40;
      let x = rowHeaderWidth;
      for (let c = 0; c < col; ++c) x += getColWidth(c);
      x += getColWidth(col) / 2;
      const y = headerHeight + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
      return { x, y };
    }

    const from = getCellCenter(fromCol, fromRow);

    // Draw dot on source cell
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', from.x);
    circle.setAttribute('cy', from.y);
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', '#0066cc');
    svg.appendChild(circle);

    for (const ref of refs) {
      const p = parseKey(ref);
      if (!p) continue;
      const to = getCellCenter(p.col, p.row);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('stroke', '#0066cc');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('marker-end', 'url(#trace-arrowhead)');
      svg.appendChild(line);

      // Draw dot on target cell
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', to.x);
      dot.setAttribute('cy', to.y);
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', '#0066cc');
      svg.appendChild(dot);
    }

    gridScroll.style.position = 'relative';
    gridScroll.appendChild(svg);
  }

  // ── Error Checking Panel ──────────────────────────────────────────

  function showErrorCheckingPanel() {
    const panel = document.getElementById('error-panel');
    const body = document.getElementById('error-panel-body');
    body.innerHTML = '';

    const errors = [];
    for (const key in S().cellData)
      if (S().cellData[key].error) errors.push(key);

    // Also check for circular references
    const circErrors = detectCircularReferences();
    for (const key of circErrors)
      if (!errors.includes(key)) errors.push(key);

    if (!errors.length) {
      body.innerHTML = '<p style="padding:8px;">No errors found.</p>';
    } else {
      for (const key of errors) {
        const item = document.createElement('div');
        item.className = 'error-item';
        const d = S().cellData[key];
        const val = d ? String(d.value) : '';
        const raw = d ? d.raw : '';
        item.textContent = key + ': ' + val + ' (' + raw + ')';
        item.addEventListener('click', () => {
          const p = parseKey(key);
          if (p) {
            selectCell(p.col, p.row);
            scrollCellIntoView(p.col, p.row);
          }
        });
        body.appendChild(item);
      }
    }

    panel.classList.add('visible');

    document.getElementById('error-panel-close').onclick = () => {
      panel.classList.remove('visible');
    };
  }

  function detectCircularReferences() {
    const sheet = S();
    const circCells = [];

    for (const key in sheet.cellData) {
      const d = sheet.cellData[key];
      if (!d || typeof d.raw !== 'string' || !d.raw.startsWith('=')) continue;

      // Walk the dependency chain from this cell and see if we visit it again
      const visited = new Set();
      const queue = d.deps ? [...d.deps] : [];
      let isCircular = false;

      while (queue.length > 0) {
        const dep = queue.shift();
        if (dep === key) { isCircular = true; break; }
        if (visited.has(dep)) continue;
        visited.add(dep);
        const depData = sheet.cellData[dep];
        if (depData && depData.deps)
          for (const dd of depData.deps)
            queue.push(dd);
      }

      if (isCircular) {
        circCells.push(key);
        // Mark the cell with a #CIRC! error
        d.value = '#CIRC!';
        d.error = true;
        const p = parseKey(key);
        if (p) renderCellContent(p.col, p.row);
      }
    }

    return circCells;
  }

  // ── Evaluate Formula Dialog ────────────────────────────────────────

  function showEvaluateFormulaDialog() {
    const key = cellKey(activeCell.col, activeCell.row);
    const d = S().cellData[key];
    const raw = d ? d.raw : '';

    document.getElementById('eval-cell-ref').textContent = key;
    document.getElementById('eval-formula').textContent = raw;
    const stepsDiv = document.getElementById('eval-steps');
    stepsDiv.innerHTML = '';

    if (!raw || !raw.startsWith('=')) {
      stepsDiv.innerHTML = '<div class="eval-step">Cell does not contain a formula.</div>';
      document.getElementById('eval-result').textContent = String(d ? d.value : '');
      showDialog('dlg-evaluate-formula');
      return;
    }

    const formula = raw.substring(1);
    const steps = [];

    // Find all cell references and show their resolved values
    const refPattern = /(\$?[A-Z]+\$?\d+)/gi;
    let match;
    const seenRefs = new Set();
    while ((match = refPattern.exec(formula)) !== null) {
      const ref = match[1].toUpperCase();
      if (seenRefs.has(ref)) continue;
      seenRefs.add(ref);
      const p = parseKey(ref);
      if (p) {
        const refVal = getCellValue(p.col, p.row);
        const refRaw = getCellRaw(p.col, p.row);
        steps.push({ ref, rawVal: refRaw, resolvedVal: refVal });
      }
    }

    // Also find range references
    const rangePattern = /(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?\d+)/gi;
    while ((match = rangePattern.exec(formula)) !== null) {
      const rangeStr = match[0];
      steps.push({ ref: rangeStr, rawVal: '(range)', resolvedVal: '{range data}' });
    }

    // Show each reference resolution as a step
    let stepNum = 1;
    for (const step of steps) {
      const div = document.createElement('div');
      div.className = 'eval-step';
      div.textContent = stepNum + '. ' + step.ref + ' = ' + (step.rawVal.startsWith('=') ? step.rawVal + ' -> ' : '') + JSON.stringify(step.resolvedVal);
      stepsDiv.appendChild(div);
      ++stepNum;
    }

    // Show the substituted formula
    let substituted = formula;
    for (const step of steps) {
      if (step.resolvedVal !== '{range data}') {
        const val = typeof step.resolvedVal === 'number' ? step.resolvedVal : '"' + step.resolvedVal + '"';
        substituted = substituted.replace(new RegExp(step.ref.replace(/\$/g, '\\$'), 'gi'), String(val));
      }
    }
    const substDiv = document.createElement('div');
    substDiv.className = 'eval-step';
    substDiv.textContent = stepNum + '. Substituted: =' + substituted;
    stepsDiv.appendChild(substDiv);

    // Show final result
    const result = d ? d.value : '';
    document.getElementById('eval-result').textContent = d && d.error ? String(result) + ' (ERROR)' : String(result);

    showDialog('dlg-evaluate-formula');
  }

  // ── Manage CF Rules Dialog ────────────────────────────────────────

  function showManageCFRulesDialog() {
    const listDiv = document.getElementById('cf-rules-list');
    let selectedIdx = -1;

    function renderRulesList() {
      listDiv.innerHTML = '';
      const rules = S().conditionalRules;
      if (!rules.length) {
        listDiv.innerHTML = '<div style="padding:12px;text-align:center;color:var(--sz-color-gray-text);">No conditional formatting rules defined.</div>';
        return;
      }

      for (let i = 0; i < rules.length; ++i) {
        const rule = rules[i];
        const row = document.createElement('div');
        row.className = 'cf-rule-row' + (i === selectedIdx ? ' selected' : '');
        row.dataset.idx = i;

        // Format preview
        const preview = document.createElement('div');
        preview.className = 'cf-rule-preview';
        if (rule.type === 'formula') {
          preview.style.backgroundColor = rule.fmtBgColor || '#ffcccc';
          preview.style.color = rule.fmtTextColor || '#000';
          if (rule.fmtBold) preview.style.fontWeight = 'bold';
          preview.textContent = 'Ab';
        } else if (rule.type.startsWith('color-scale')) {
          preview.style.background = 'linear-gradient(to right, ' + (rule.colorMin || '#f8696b') + ', ' + (rule.colorMax || '#63be7b') + ')';
        } else if (rule.type.startsWith('icon-')) {
          const iconPreviews = { 'icon-3-arrows': '\u25B2\u25BA\u25BC', 'icon-4-arrows': '\u25B2\u2197\u2198\u25BC', 'icon-3-traffic': '\uD83D\uDFE2\uD83D\uDFE1\uD83D\uDD34', 'icon-3-flags': '\uD83D\uDFE9\uD83D\uDFE8\uD83D\uDFE5', 'icon-3-symbols': '\u2714\u26A0\u2718', 'icon-3-stars': '\u2605\u2605\u2606', 'icon-5-rating': '\u2605\u2605\u2605\u2606\u2606' };
          preview.textContent = iconPreviews[rule.type] || '\u25B2\u25BA\u25BC';
          preview.style.fontSize = '9px';
        } else
          preview.style.backgroundColor = rule.color || '#ffcccc';

        // Info
        const info = document.createElement('div');
        info.className = 'cf-rule-info';
        const rangeStr = colName(rule.c1) + (rule.r1 + 1) + ':' + colName(rule.c2) + (rule.r2 + 1);
        let desc = rule.type;
        if (rule.type === 'formula') desc = 'Formula: ' + (rule.formula || '');
        else if (rule.value1) desc += ' ' + rule.value1;
        if (rule.value2) desc += ' and ' + rule.value2;
        info.innerHTML = '<div style="font-weight:bold;">' + escapeHtml(desc) + '</div><div style="font-size:10px;color:var(--sz-color-gray-text);">Range: ' + escapeHtml(rangeStr) + ' | Priority: ' + (i + 1) + '</div>';

        // Stop if true checkbox
        const stopLabel = document.createElement('label');
        stopLabel.className = 'cf-rule-stop';
        const stopCb = document.createElement('input');
        stopCb.type = 'checkbox';
        stopCb.checked = !!rule.stopIfTrue;
        stopCb.addEventListener('change', () => {
          rule.stopIfTrue = stopCb.checked;
          setDirty(true);
        });
        stopLabel.appendChild(stopCb);
        stopLabel.appendChild(document.createTextNode(' Stop'));

        row.appendChild(preview);
        row.appendChild(info);
        row.appendChild(stopLabel);

        row.addEventListener('click', () => {
          selectedIdx = i;
          renderRulesList();
        });

        listDiv.appendChild(row);
      }
    }

    renderRulesList();

    document.getElementById('cf-move-up').onclick = () => {
      const rules = S().conditionalRules;
      if (selectedIdx <= 0 || selectedIdx >= rules.length) return;
      const temp = rules[selectedIdx];
      rules[selectedIdx] = rules[selectedIdx - 1];
      rules[selectedIdx - 1] = temp;
      --selectedIdx;
      renderRulesList();
      rebuildGrid();
      setDirty(true);
    };

    document.getElementById('cf-move-down').onclick = () => {
      const rules = S().conditionalRules;
      if (selectedIdx < 0 || selectedIdx >= rules.length - 1) return;
      const temp = rules[selectedIdx];
      rules[selectedIdx] = rules[selectedIdx + 1];
      rules[selectedIdx + 1] = temp;
      ++selectedIdx;
      renderRulesList();
      rebuildGrid();
      setDirty(true);
    };

    document.getElementById('cf-edit-rule').onclick = () => {
      if (selectedIdx < 0 || selectedIdx >= S().conditionalRules.length) return;
      SZ.Dialog.close('dlg-manage-cf');
      // Open the CF dialog with the existing rule pre-populated
      const rule = S().conditionalRules[selectedIdx];
      const cfRuleSel = document.getElementById('cf-rule');
      cfRuleSel.value = rule.type;
      cfRuleSel.dispatchEvent(new Event('change'));
      document.getElementById('cf-value1').value = rule.value1 || '';
      document.getElementById('cf-value2').value = rule.value2 || '';
      document.getElementById('cf-color').value = rule.color || '#ffcccc';
      if (rule.type === 'formula') {
        document.getElementById('cf-formula').value = rule.formula || '';
        document.getElementById('cf-fmt-text-color').value = rule.fmtTextColor || '#000000';
        document.getElementById('cf-fmt-bg-color').value = rule.fmtBgColor || '#ffcccc';
        document.getElementById('cf-fmt-bold').checked = !!rule.fmtBold;
        document.getElementById('cf-fmt-italic').checked = !!rule.fmtItalic;
      }
      if (rule.colorMin) document.getElementById('cf-color-min').value = rule.colorMin;
      if (rule.colorMid) document.getElementById('cf-color-mid').value = rule.colorMid;
      if (rule.colorMax) document.getElementById('cf-color-max').value = rule.colorMax;
      showDialog('dlg-cond-format').then(r => {
        if (r === 'ok') {
          const ruleType = cfRuleSel.value;
          const newRule = {
            c1: rule.c1, r1: rule.r1, c2: rule.c2, r2: rule.r2,
            type: ruleType,
            value1: document.getElementById('cf-value1').value,
            value2: document.getElementById('cf-value2').value,
            color: document.getElementById('cf-color').value,
            stopIfTrue: rule.stopIfTrue,
          };
          if (ruleType === 'color-scale-2' || ruleType === 'color-scale-3') {
            newRule.colorMin = document.getElementById('cf-color-min').value;
            newRule.colorMid = document.getElementById('cf-color-mid').value;
            newRule.colorMax = document.getElementById('cf-color-max').value;
          }
          if (ruleType === 'formula') {
            newRule.formula = document.getElementById('cf-formula').value;
            newRule.fmtTextColor = document.getElementById('cf-fmt-text-color').value;
            newRule.fmtBgColor = document.getElementById('cf-fmt-bg-color').value;
            newRule.fmtBold = document.getElementById('cf-fmt-bold').checked;
            newRule.fmtItalic = document.getElementById('cf-fmt-italic').checked;
          }
          S().conditionalRules[selectedIdx] = newRule;
          rebuildGrid();
          setDirty(true);
        }
      });
    };

    document.getElementById('cf-delete-rule').onclick = () => {
      if (selectedIdx < 0 || selectedIdx >= S().conditionalRules.length) return;
      S().conditionalRules.splice(selectedIdx, 1);
      selectedIdx = -1;
      renderRulesList();
      rebuildGrid();
      setDirty(true);
    };

    showDialog('dlg-manage-cf');
  }

  // ── Outline Group Rendering ───────────────────────────────────────

  function renderOutlineGutter() {
    const groups = S().outlineGroups;
    if (!groups) return;

    // Remove old gutter
    const oldGutter = gridScroll.querySelector('.outline-gutter-rows');
    if (oldGutter) oldGutter.remove();
    const oldColGutter = document.querySelector('.outline-gutter-cols');
    if (oldColGutter) oldColGutter.remove();

    // Row outline gutter
    if (groups.rows.length) {
      const maxLevel = groups.rows.reduce((m, g) => Math.max(m, g.level), 0);
      const gutterWidth = maxLevel * 16 + 16;
      const gutter = document.createElement('div');
      gutter.className = 'outline-gutter-rows outline-gutter';
      gutter.style.position = 'absolute';
      gutter.style.left = '0';
      gutter.style.top = '20px'; // below header
      gutter.style.width = gutterWidth + 'px';
      gutter.style.zIndex = '5';

      // Level buttons at top
      for (let l = 1; l <= maxLevel + 1; ++l) {
        const btn = document.createElement('button');
        btn.className = 'outline-level-btn';
        btn.textContent = String(l);
        btn.style.position = 'absolute';
        btn.style.left = ((l - 1) * 16) + 'px';
        btn.style.top = '-16px';
        btn.addEventListener('click', () => {
          for (const g of groups.rows)
            g.collapsed = g.level >= l;
          applyOutlineCollapse();
        });
        gutter.appendChild(btn);
      }

      // +/- buttons for each group
      for (const group of groups.rows) {
        const btn = document.createElement('button');
        btn.className = 'outline-btn';
        const midRow = Math.floor((group.start + group.end) / 2);
        btn.style.position = 'absolute';
        btn.style.left = ((group.level - 1) * 16) + 'px';
        btn.style.top = (midRow * DEFAULT_ROW_HEIGHT) + 'px';
        btn.textContent = group.collapsed ? '+' : '-';
        btn.addEventListener('click', () => {
          group.collapsed = !group.collapsed;
          applyOutlineCollapse();
        });
        gutter.appendChild(btn);

        // Draw tree line
        const line = document.createElement('div');
        line.style.position = 'absolute';
        line.style.left = ((group.level - 1) * 16 + 6) + 'px';
        line.style.top = (group.start * DEFAULT_ROW_HEIGHT) + 'px';
        line.style.height = ((group.end - group.start + 1) * DEFAULT_ROW_HEIGHT) + 'px';
        line.style.width = '1px';
        line.style.background = '#aaa';
        gutter.appendChild(line);
      }

      gridScroll.appendChild(gutter);
    }

    // Column outline gutter
    if (groups.cols.length) {
      const maxLevel = groups.cols.reduce((m, g) => Math.max(m, g.level), 0);
      const gutterHeight = maxLevel * 16 + 16;
      const gutter = document.createElement('div');
      gutter.className = 'outline-gutter-cols outline-gutter';
      gutter.style.position = 'absolute';
      gutter.style.left = '40px';
      gutter.style.top = '0';
      gutter.style.height = gutterHeight + 'px';
      gutter.style.zIndex = '5';

      for (const group of groups.cols) {
        const btn = document.createElement('button');
        btn.className = 'outline-btn';
        let midX = 40;
        for (let c = 0; c < group.start; ++c) midX += getColWidth(c);
        midX += ((group.end - group.start + 1) * getColWidth(group.start)) / 2;
        btn.style.position = 'absolute';
        btn.style.left = midX + 'px';
        btn.style.top = ((group.level - 1) * 16) + 'px';
        btn.textContent = group.collapsed ? '+' : '-';
        btn.addEventListener('click', () => {
          group.collapsed = !group.collapsed;
          applyOutlineCollapse();
        });
        gutter.appendChild(btn);
      }

      gridScroll.appendChild(gutter);
    }
  }

  function applyOutlineCollapse() {
    const groups = S().outlineGroups;
    if (!groups) return;

    S().hiddenRows.clear();
    for (const g of groups.rows)
      if (g.collapsed)
        for (let r = g.start + 1; r <= g.end; ++r) S().hiddenRows.add(r);

    S().hiddenCols.clear();
    for (const g of groups.cols)
      if (g.collapsed)
        for (let c = g.start + 1; c <= g.end; ++c) S().hiddenCols.add(c);

    rebuildGrid();
  }

  // ── Sheet Tab Context Menu ──────────────────────────────────────

  function showSheetContextMenu(e, sheetIdx) {
    e.preventDefault();
    const existing = document.querySelector('.sheet-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'sheet-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    function addItem(label, action) {
      const item = document.createElement('div');
      item.className = 'sheet-ctx-item';
      item.textContent = label;
      item.addEventListener('click', () => { menu.remove(); action(); });
      menu.appendChild(item);
    }

    function addSep() {
      const sep = document.createElement('div');
      sep.className = 'sheet-ctx-sep';
      menu.appendChild(sep);
    }

    addItem('Rename', () => {
      showPrompt('Rename Sheet', 'New name:', sheets[sheetIdx].name).then(n => {
        if (n && n.trim()) { sheets[sheetIdx].name = n.trim(); renderSheetTabs(); setDirty(true); }
      });
    });

    addItem('Tab Color', () => {
      showColorPalette(sheetTabsEl, (c) => { sheets[sheetIdx].tabColor = c; renderSheetTabs(); });
    });

    addSep();

    if (!sheets[sheetIdx].hidden) {
      addItem('Hide', () => {
        if (sheets.filter(s => !s.hidden).length <= 1) {
          User32.MessageBox('Cannot hide the only visible sheet.', 'Spreadsheet', 0);
          return;
        }
        sheets[sheetIdx].hidden = true;
        if (activeSheetIdx === sheetIdx) {
          const vis = sheets.findIndex(s => !s.hidden);
          if (vis >= 0) switchSheet(vis);
        }
        renderSheetTabs();
        setDirty(true);
      });
    }

    // Unhide sub-items
    const hiddenSheets = sheets.filter(s => s.hidden);
    if (hiddenSheets.length) {
      addItem('Unhide...', async () => {
        const names = hiddenSheets.map(s => s.name).join(', ');
        const name = await showPrompt('Unhide Sheet', 'Enter sheet name to unhide:\n(' + names + ')', hiddenSheets[0].name);
        if (name) {
          const idx = sheets.findIndex(s => s.hidden && s.name === name.trim());
          if (idx >= 0) {
            sheets[idx].hidden = false;
            renderSheetTabs();
            setDirty(true);
          }
        }
      });
    }

    addSep();

    addItem('Move/Copy...', async () => {
      const pos = await showPrompt('Move/Copy Sheet', 'Insert before position (1-' + sheets.length + '):', String(sheetIdx + 1));
      if (pos !== null) {
        const toIdx = Math.max(0, Math.min(sheets.length, parseInt(pos, 10) - 1));
        const sheet = sheets.splice(sheetIdx, 1)[0];
        sheets.splice(toIdx, 0, sheet);
        activeSheetIdx = toIdx;
        renderSheetTabs();
        setDirty(true);
      }
    });

    addItem('Protect Sheet', () => { switchSheet(sheetIdx); handleAction('protect-sheet'); });

    addSep();

    addItem('Delete', () => {
      if (sheets.length <= 1) {
        User32.MessageBox('Cannot delete the only sheet.', 'Spreadsheet', 0);
        return;
      }
      sheets.splice(sheetIdx, 1);
      if (activeSheetIdx >= sheets.length) activeSheetIdx = sheets.length - 1;
      rebuildGrid();
      renderSheetTabs();
      setDirty(true);
    });

    document.body.appendChild(menu);

    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', closeMenu); }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeMenu), 0);
  }

  // ── Status Bar Customization ──────────────────────────────────

  let statusBarItems = { average: true, count: true, sum: true, min: false, max: false, numericalCount: false };

  function showStatusBarContextMenu(e) {
    e.preventDefault();
    const existing = document.querySelector('.statusbar-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'statusbar-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = (e.clientY - 200) + 'px';

    const items = [
      { key: 'average', label: 'Average' },
      { key: 'count', label: 'Count' },
      { key: 'numericalCount', label: 'Numerical Count' },
      { key: 'sum', label: 'Sum' },
      { key: 'min', label: 'Min' },
      { key: 'max', label: 'Max' },
    ];

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'statusbar-ctx-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!statusBarItems[item.key];
      cb.addEventListener('change', () => {
        statusBarItems[item.key] = cb.checked;
        updateStatusSummary();
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(item.label));
      row.addEventListener('click', (ev) => {
        if (ev.target !== cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); }
      });
      menu.appendChild(row);
    }

    document.body.appendChild(menu);
    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', closeMenu); }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeMenu), 0);
  }

  // ── Workbook Themes ───────────────────────────────────────────

  const WORKBOOK_THEMES = [
    {
      name: 'Office',
      colors: { accent1: '#4472c4', accent2: '#ed7d31', accent3: '#a5a5a5', accent4: '#ffc000', accent5: '#5b9bd5', accent6: '#70ad47', background: '#ffffff', text: '#000000' },
      headingFont: 'Calibri, sans-serif',
      bodyFont: 'Calibri, sans-serif',
    },
    {
      name: 'Dark',
      colors: { accent1: '#5b9bd5', accent2: '#ff6384', accent3: '#36a2eb', accent4: '#ffce56', accent5: '#4bc0c0', accent6: '#9966ff', background: '#2d2d2d', text: '#e0e0e0' },
      headingFont: 'Segoe UI, sans-serif',
      bodyFont: 'Segoe UI, sans-serif',
    },
    {
      name: 'Nature',
      colors: { accent1: '#2e7d32', accent2: '#8bc34a', accent3: '#ff9800', accent4: '#795548', accent5: '#607d8b', accent6: '#009688', background: '#f1f8e9', text: '#1b5e20' },
      headingFont: 'Georgia, serif',
      bodyFont: 'Verdana, sans-serif',
    },
    {
      name: 'Classic',
      colors: { accent1: '#003366', accent2: '#990000', accent3: '#336699', accent4: '#cccc00', accent5: '#666699', accent6: '#993366', background: '#ffffff', text: '#000000' },
      headingFont: 'Times New Roman, serif',
      bodyFont: 'Arial, sans-serif',
    },
  ];

  function showThemeDialog() {
    const grid = document.getElementById('theme-grid');
    grid.innerHTML = '';
    const currentTheme = sheets.__theme || 'Office';

    for (const theme of WORKBOOK_THEMES) {
      const item = document.createElement('div');
      item.className = 'theme-item' + (theme.name === currentTheme ? ' active' : '');

      const colorsDiv = document.createElement('div');
      colorsDiv.className = 'theme-colors';
      for (const key of ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']) {
        const swatch = document.createElement('div');
        swatch.className = 'theme-swatch';
        swatch.style.backgroundColor = theme.colors[key];
        colorsDiv.appendChild(swatch);
      }
      item.appendChild(colorsDiv);

      const nameDiv = document.createElement('div');
      nameDiv.textContent = theme.name;
      nameDiv.style.fontWeight = 'bold';
      item.appendChild(nameDiv);

      const fontDiv = document.createElement('div');
      fontDiv.textContent = theme.headingFont.split(',')[0];
      fontDiv.style.fontSize = '10px';
      fontDiv.style.color = '#666';
      item.appendChild(fontDiv);

      item.addEventListener('click', () => {
        applyWorkbookTheme(theme);
        SZ.Dialog.close('dlg-themes');
      });
      grid.appendChild(item);
    }

    showDialog('dlg-themes');
  }

  function applyWorkbookTheme(theme) {
    sheets.__theme = theme.name;

    // Apply theme to chart inline colors
    for (const chart of (S().inlineCharts || [])) {
      chart.options = chart.options || {};
      chart.options.themeColors = Object.values(theme.colors).filter(c => c !== '#ffffff' && c !== '#000000');
    }

    setDirty(true);
    rebuildGrid();
  }

  // ── Template Support ──────────────────────────────────────────

  function doSaveTemplate() {
    showPrompt('Save as Template', 'Template name:', currentFileName || 'My Template').then(name => {
      if (!name || !name.trim()) return;
      const templates = JSON.parse(localStorage.getItem('ss-templates') || '{}');
      const templateData = {
        sheets: sheets.map(s => ({
          name: s.name,
          cellData: Object.assign({}, s.cellData),
          cellFormats: Object.assign({}, s.cellFormats),
          colWidths: Object.assign({}, s.colWidths),
          rowHeights: Object.assign({}, s.rowHeights),
          maxUsedCol: s.maxUsedCol,
          maxUsedRow: s.maxUsedRow,
          mergedCells: [...s.mergedCells],
        })),
      };
      templates[name.trim()] = templateData;
      localStorage.setItem('ss-templates', JSON.stringify(templates));
      User32.MessageBox('Template "' + name.trim() + '" saved.', 'Spreadsheet', 0);
    });
  }

  function doLoadTemplate() {
    const overlay = document.getElementById('dlg-templates');
    if (!overlay) return;

    const listEl = document.getElementById('tpl-list');
    const templates = JSON.parse(localStorage.getItem('ss-templates') || '{}');

    function refreshList() {
      listEl.innerHTML = '';
      for (const name of Object.keys(templates)) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        listEl.appendChild(opt);
      }
    }
    refreshList();

    // Wire built-in template buttons
    overlay.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = () => {
        handleAction(btn.dataset.action);
        SZ.Dialog.close('dlg-templates');
      };
    });

    document.getElementById('tpl-load').onclick = () => {
      const selected = listEl.value;
      if (!selected || !templates[selected]) return;
      loadTemplate(templates[selected]);
      SZ.Dialog.close('dlg-templates');
    };

    document.getElementById('tpl-delete').onclick = () => {
      const selected = listEl.value;
      if (!selected) return;
      delete templates[selected];
      localStorage.setItem('ss-templates', JSON.stringify(templates));
      refreshList();
    };

    showDialog('dlg-templates');
  }

  function loadTemplate(templateData) {
    resetAllSheets();
    sheets.length = 0;
    sheetCounter = 0;
    for (const ts of templateData.sheets) {
      const sheet = createSheet(ts.name);
      sheet.cellData = ts.cellData || {};
      sheet.cellFormats = ts.cellFormats || {};
      sheet.colWidths = ts.colWidths || {};
      sheet.rowHeights = ts.rowHeights || {};
      sheet.maxUsedCol = ts.maxUsedCol || 0;
      sheet.maxUsedRow = ts.maxUsedRow || 0;
      sheet.mergedCells = ts.mergedCells || [];
      sheets.push(sheet);
    }
    if (!sheets.length) sheets.push(createSheet());
    activeSheetIdx = 0;
    rebuildGrid();
    renderSheetTabs();
    updateTitle();
  }

  function applyBuiltInTemplate(name) {
    resetAllSheets();

    if (name === 'invoice') {
      setCellData(0, 0, 'INVOICE'); setFormat(0, 0, { bold: true, fontSize: 24, textColor: '#4472c4' });
      setCellData(0, 2, 'Invoice Number:'); setCellData(1, 2, 'INV-001'); setFormat(0, 2, { bold: true });
      setCellData(0, 3, 'Date:'); setCellData(1, 3, new Date().toLocaleDateString()); setFormat(0, 3, { bold: true });
      setCellData(0, 4, 'Due Date:'); setCellData(1, 4, ''); setFormat(0, 4, { bold: true });
      setCellData(0, 6, 'Bill To:'); setFormat(0, 6, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
      setCellData(0, 7, 'Company Name');
      setCellData(0, 8, 'Address');
      setCellData(0, 10, 'Description'); setFormat(0, 10, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
      setCellData(1, 10, 'Quantity'); setFormat(1, 10, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
      setCellData(2, 10, 'Unit Price'); setFormat(2, 10, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
      setCellData(3, 10, 'Amount'); setFormat(3, 10, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
      for (let r = 11; r <= 15; ++r) {
        setCellData(3, r, '=B' + (r + 1) + '*C' + (r + 1));
        setFormat(3, r, { numberFmt: 'currency' });
        setFormat(2, r, { numberFmt: 'currency' });
        const bg = (r - 11) % 2 === 0 ? '#d9e2f3' : '#ffffff';
        for (let c = 0; c <= 3; ++c) setFormat(c, r, Object.assign({}, getFormat(c, r), { bgColor: bg }));
      }
      setCellData(2, 17, 'Subtotal:'); setFormat(2, 17, { bold: true, align: 'right' });
      setCellData(3, 17, '=SUM(D12:D16)'); setFormat(3, 17, { numberFmt: 'currency', bold: true });
      setCellData(2, 18, 'Tax (10%):'); setFormat(2, 18, { align: 'right' });
      setCellData(3, 18, '=D18*0.1'); setFormat(3, 18, { numberFmt: 'currency' });
      setCellData(2, 19, 'Total:'); setFormat(2, 19, { bold: true, align: 'right', fontSize: 14 });
      setCellData(3, 19, '=D18+D19'); setFormat(3, 19, { numberFmt: 'currency', bold: true, fontSize: 14 });
      S().name = 'Invoice';
    } else if (name === 'budget') {
      setCellData(0, 0, 'MONTHLY BUDGET'); setFormat(0, 0, { bold: true, fontSize: 18, textColor: '#2e7d32' });
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total'];
      for (let c = 0; c < months.length; ++c) {
        setCellData(c + 1, 2, months[c]);
        setFormat(c + 1, 2, { bold: true, bgColor: '#2e7d32', textColor: '#ffffff', align: 'center' });
      }
      setCellData(0, 2, 'Category'); setFormat(0, 2, { bold: true, bgColor: '#2e7d32', textColor: '#ffffff' });
      const categories = ['Income', 'Housing', 'Utilities', 'Food', 'Transport', 'Insurance', 'Healthcare', 'Entertainment', 'Savings'];
      for (let r = 0; r < categories.length; ++r) {
        setCellData(0, r + 3, categories[r]);
        setFormat(0, r + 3, { bold: r === 0 });
        // Total formula for each category
        const row = r + 4;
        setCellData(13, r + 3, '=SUM(B' + row + ':M' + row + ')');
        setFormat(13, r + 3, { numberFmt: 'currency', bold: true });
        for (let c = 1; c <= 12; ++c)
          setFormat(c, r + 3, { numberFmt: 'currency' });
        const bg = r % 2 === 0 ? '#e8f5e9' : '#ffffff';
        for (let c = 0; c <= 13; ++c) setFormat(c, r + 3, Object.assign({}, getFormat(c, r + 3), { bgColor: bg }));
      }
      const netRow = categories.length + 4;
      setCellData(0, netRow - 1, 'Net'); setFormat(0, netRow - 1, { bold: true, fontSize: 13 });
      for (let c = 1; c <= 13; ++c) {
        const colLetter = colName(c);
        setCellData(c, netRow - 1, '=' + colLetter + '4-SUM(' + colLetter + '5:' + colLetter + (netRow - 1) + ')');
        setFormat(c, netRow - 1, { numberFmt: 'currency', bold: true });
      }
      S().name = 'Budget';
    } else if (name === 'calendar') {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
      setCellData(0, 0, monthName + ' ' + year);
      setFormat(0, 0, { bold: true, fontSize: 18, textColor: '#003366' });
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let c = 0; c < 7; ++c) {
        setCellData(c, 2, days[c]);
        setFormat(c, 2, { bold: true, bgColor: '#003366', textColor: '#ffffff', align: 'center' });
        S().colWidths[c] = 100;
      }
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let row = 3;
      let col = firstDay;
      for (let d = 1; d <= daysInMonth; ++d) {
        setCellData(col, row, String(d));
        setFormat(col, row, { align: 'right', valign: 'top' });
        S().rowHeights[row] = 60;
        if (++col > 6) { col = 0; ++row; }
      }
      S().name = 'Calendar';
    }

    currentFileName = name.charAt(0).toUpperCase() + name.slice(1);
    recalcAll();
    rebuildGrid();
    renderSheetTabs();
    updateTitle();
    setDirty(false);
  }

  // ── JSON Import/Export ────────────────────────────────────────

  async function doImportJson() {
    if (isEditing) finishEditing();
    const result = await ComDlg32.ImportFile({ accept: '.json', readAs: 'text' });
    if (result.cancelled) return;

    try {
      const json = JSON.parse(result.data);
      resetAllSheets();

      if (Array.isArray(json)) {
        if (json.length > 0 && typeof json[0] === 'object' && json[0] !== null) {
          // Array of objects: keys as headers
          const keys = Object.keys(json[0]);
          for (let c = 0; c < keys.length; ++c) {
            setCellData(c, 0, keys[c]);
            setFormat(c, 0, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
          }
          for (let r = 0; r < json.length; ++r)
            for (let c = 0; c < keys.length; ++c) {
              const val = json[r][keys[c]];
              if (typeof val === 'object' && val !== null)
                setCellData(c, r + 1, JSON.stringify(val));
              else
                setCellData(c, r + 1, val === null || val === undefined ? '' : String(val));
            }
        } else {
          // Simple array
          for (let r = 0; r < json.length; ++r)
            setCellData(0, r, String(json[r]));
        }
      } else if (typeof json === 'object' && json !== null) {
        // Single object: flatten
        const entries = flattenObject(json);
        setCellData(0, 0, 'Key'); setFormat(0, 0, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
        setCellData(1, 0, 'Value'); setFormat(1, 0, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
        let r = 1;
        for (const [key, val] of entries) {
          setCellData(0, r, key);
          setCellData(1, r, val === null || val === undefined ? '' : String(val));
          ++r;
        }
      }

      currentFileName = (result.name || 'data').replace(/\.json$/i, '');
      currentFilePath = null;
      dirty = false;
      rebuildGrid();
      renderSheetTabs();
      updateTitle();
    } catch (err) {
      await User32.MessageBox('Could not import JSON: ' + err.message, 'Spreadsheet', 0);
    }
  }

  function flattenObject(obj, prefix) {
    const result = [];
    prefix = prefix || '';
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? prefix + '.' + key : key;
      const val = obj[key];
      if (typeof val === 'object' && val !== null && !Array.isArray(val))
        result.push(...flattenObject(val, fullKey));
      else if (Array.isArray(val))
        result.push([fullKey, JSON.stringify(val)]);
      else
        result.push([fullKey, val]);
    }
    return result;
  }

  function doExportJson() {
    if (isEditing) finishEditing();
    const sheet = S();
    let maxRow = 0, maxCol = 0;
    for (const key in sheet.cellData) {
      const p = parseKey(key);
      if (p && sheet.cellData[key].raw !== '') {
        if (p.row > maxRow) maxRow = p.row;
        if (p.col > maxCol) maxCol = p.col;
      }
    }

    // First row as keys
    const keys = [];
    for (let c = 0; c <= maxCol; ++c)
      keys.push(getCellValue(c, 0) || colName(c));

    const data = [];
    for (let r = 1; r <= maxRow; ++r) {
      const obj = {};
      let hasData = false;
      for (let c = 0; c <= maxCol; ++c) {
        const val = getCellValue(c, r);
        if (val !== '' && val !== undefined) hasData = true;
        obj[keys[c]] = typeof val === 'number' ? val : val;
      }
      if (hasData) data.push(obj);
    }

    const jsonStr = JSON.stringify(data, null, 2);
    const name = (currentFileName.replace(/\.[^.]+$/, '') || 'data') + '.json';
    ComDlg32.ExportFile(new Blob([jsonStr], { type: 'application/json' }), name);
  }

  // ═══════════════════════════════════════════════════════════════

  // ── Main action handler ────────────────────────────────────────────
  function handleAction(action) {
    if (Protection.isActionBlocked(action)) {
      User32.MessageBox('This action is not allowed on a protected sheet.', 'Spreadsheet', 0);
      return;
    }
    switch (action) {
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'import-csv': doOpen(); break;
      case 'export-csv': doSaveAs(); break;
      case 'import-xlsx': doImportXlsx(); break;
      case 'export-xlsx': doExportXlsx(); break;
      case 'import-tsv': doImportTsv(); break;
      case 'export-tsv': doExportTsv(); break;
      case 'print': window.print(); break;
      case 'exit': User32.DestroyWindow(); break;
      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'cut': doCut(); break;
      case 'copy': doCopy(); break;
      case 'paste': doPaste('all'); break;
      case 'paste-special': showDialog('dlg-paste-special').then(r => { if (r === 'ok') { const mode = document.querySelector('input[name="paste-what"]:checked').value; doPaste(mode); } }); break;
      case 'format-painter':
        spreadsheetFormatPainter.isActive ? spreadsheetFormatPainter.deactivate() : spreadsheetFormatPainter.activate(false);
        break;
      case 'format-painter-dbl':
        spreadsheetFormatPainter.activate(true);
        break;
      case 'clear-format': {
        const rect = getSelectionRect();
        const actions = [];
        for (let r = rect.r1; r <= rect.r2; ++r)
          for (let c = rect.c1; c <= rect.c2; ++c) {
            const oldFmt = Object.assign({}, getFormat(c, r));
            actions.push({ type: 'cell', col: c, row: r, oldVal: getCellRaw(c, r), newVal: getCellRaw(c, r), oldFmt, newFmt: {} });
            S().cellFormats[cellKey(c, r)] = {};
            renderCellContent(c, r);
          }
        if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
        updateSelectionDisplay();
        break;
      }
      case 'delete': deleteSelection(); break;
      case 'select-all': selectionStart = { col: 0, row: 0 }; selectionEnd = { col: totalCols() - 1, row: totalRows() - 1 }; multiSelections = []; updateSelectionDisplay(); break;
      case 'find-replace': showFindPanel(); break;
      case 'bold': toggleFormat('bold'); break;
      case 'italic': toggleFormat('italic'); break;
      case 'underline': toggleFormat('underline'); break;
      case 'strikethrough': toggleFormat('strikethrough'); break;
      case 'font-color': showColorPalette(document.getElementById('btn-font-color'), (c) => { applyFormatToSelection('textColor', c); document.getElementById('font-color-ind').style.backgroundColor = c; }); break;
      case 'bg-color': showColorPalette(document.getElementById('btn-bg-color'), (c) => { applyFormatToSelection('bgColor', c); document.getElementById('bg-color-ind').style.backgroundColor = c; }); break;
      case 'align-left': applyFormatToSelection('align', 'left'); break;
      case 'align-center': applyFormatToSelection('align', 'center'); break;
      case 'align-right': applyFormatToSelection('align', 'right'); break;
      case 'valign-top': applyFormatToSelection('valign', 'top'); break;
      case 'valign-middle': applyFormatToSelection('valign', 'middle'); break;
      case 'valign-bottom': applyFormatToSelection('valign', 'bottom'); break;
      case 'wrap-text': toggleFormat('wrapText'); break;
      case 'text-rotation': {
        const rotVal = document.getElementById('sel-text-rotation').value;
        applyFormatToSelection('textRotation', rotVal === '0' ? undefined : rotVal);
        break;
      }
      case 'merge-cells': case 'merge-toggle': {
        const rect = getSelectionRect();
        const existing = S().mergedCells.findIndex(m => m.c1 === rect.c1 && m.r1 === rect.r1 && m.c2 === rect.c2 && m.r2 === rect.r2);
        if (existing >= 0) S().mergedCells.splice(existing, 1);
        else S().mergedCells.push(rect);
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'merge-center': {
        const rect = getSelectionRect();
        const existing = S().mergedCells.findIndex(m => m.c1 === rect.c1 && m.r1 === rect.r1 && m.c2 === rect.c2 && m.r2 === rect.r2);
        if (existing < 0) S().mergedCells.push(rect);
        applyFormatToSelection('align', 'center');
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'merge-across': {
        const rect = getSelectionRect();
        for (let r = rect.r1; r <= rect.r2; ++r) {
          const rowRect = { c1: rect.c1, r1: r, c2: rect.c2, r2: r };
          const existing = S().mergedCells.findIndex(m => m.c1 === rowRect.c1 && m.r1 === rowRect.r1 && m.c2 === rowRect.c2 && m.r2 === rowRect.r2);
          if (existing < 0) S().mergedCells.push(rowRect);
        }
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'unmerge': {
        const rect = getSelectionRect();
        S().mergedCells = S().mergedCells.filter(m =>
          !(m.c1 >= rect.c1 && m.c2 <= rect.c2 && m.r1 >= rect.r1 && m.r2 <= rect.r2)
        );
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'decimal-increase': applyFormatToSelection('decimals', (v) => Math.min(15, (v || 2) + 1)); break;
      case 'decimal-decrease': applyFormatToSelection('decimals', (v) => Math.max(0, (v || 2) - 1)); break;
      case 'thousands-sep': toggleFormat('thousands'); break;
      case 'autosum': {
        let sum = '=SUM(';
        if (activeCell.row > 0) sum += cellKey(activeCell.col, 0) + ':' + cellKey(activeCell.col, activeCell.row - 1);
        sum += ')';
        setCellData(activeCell.col, activeCell.row, sum);
        recalcDependents(cellKey(activeCell.col, activeCell.row));
        renderCellContent(activeCell.col, activeCell.row);
        setDirty(true);
        break;
      }
      case 'fill-down': {
        const rect = getSelectionRect();
        const srcRow = rect.r1;
        const actions = [];
        for (let c = rect.c1; c <= rect.c2; ++c) {
          const raw = getCellRaw(c, srcRow);
          for (let r = srcRow + 1; r <= rect.r2; ++r) {
            actions.push({ type: 'cell', col: c, row: r, oldVal: getCellRaw(c, r), newVal: raw, oldFmt: Object.assign({}, getFormat(c, r)), newFmt: Object.assign({}, getFormat(c, r)) });
            setCellData(c, r, raw); recalcDependents(cellKey(c, r)); renderCellContent(c, r);
          }
        }
        if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
        break;
      }
      case 'fill-right': {
        const rect = getSelectionRect();
        const srcCol = rect.c1;
        const actions = [];
        for (let r = rect.r1; r <= rect.r2; ++r) {
          const raw = getCellRaw(srcCol, r);
          for (let c = srcCol + 1; c <= rect.c2; ++c) {
            actions.push({ type: 'cell', col: c, row: r, oldVal: getCellRaw(c, r), newVal: raw, oldFmt: Object.assign({}, getFormat(c, r)), newFmt: Object.assign({}, getFormat(c, r)) });
            setCellData(c, r, raw); recalcDependents(cellKey(c, r)); renderCellContent(c, r);
          }
        }
        if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
        break;
      }
      case 'sort-asc': case 'sort-desc': {
        const rect = getSelectionRect();
        const asc = action === 'sort-asc';
        const rows = [];
        for (let r = rect.r1; r <= rect.r2; ++r) {
          const row = [];
          for (let c = rect.c1; c <= rect.c2; ++c) row.push({ raw: getCellRaw(c, r), fmt: Object.assign({}, getFormat(c, r)) });
          rows.push(row);
        }
        rows.sort((a, b) => {
          const va = a[0].raw, vb = b[0].raw;
          const na = Number(va), nb = Number(vb);
          if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
          return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
        const actions = [];
        for (let r = 0; r < rows.length; ++r)
          for (let c = 0; c < rows[r].length; ++c) {
            const ac = rect.c1 + c, ar = rect.r1 + r;
            actions.push({ type: 'cell', col: ac, row: ar, oldVal: getCellRaw(ac, ar), newVal: rows[r][c].raw, oldFmt: Object.assign({}, getFormat(ac, ar)), newFmt: rows[r][c].fmt });
            setCellData(ac, ar, rows[r][c].raw); S().cellFormats[cellKey(ac, ar)] = rows[r][c].fmt; renderCellContent(ac, ar);
          }
        if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
        break;
      }
      case 'insert-row': {
        const row = activeCell.row;
        for (let r = totalRows() - 1; r > row; --r)
          for (let c = 0; c < totalCols(); ++c) {
            const above = getCellRaw(c, r - 1);
            setCellData(c, r, above);
            S().cellFormats[cellKey(c, r)] = Object.assign({}, getFormat(c, r - 1));
          }
        for (let c = 0; c < totalCols(); ++c) { setCellData(c, row, ''); S().cellFormats[cellKey(c, row)] = {}; }
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'insert-col': {
        const col = activeCell.col;
        for (let c = totalCols() - 1; c > col; --c)
          for (let r = 0; r < totalRows(); ++r) {
            setCellData(c, r, getCellRaw(c - 1, r));
            S().cellFormats[cellKey(c, r)] = Object.assign({}, getFormat(c - 1, r));
          }
        for (let r = 0; r < totalRows(); ++r) { setCellData(col, r, ''); S().cellFormats[cellKey(col, r)] = {}; }
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'delete-row': {
        const row = activeCell.row;
        const tc = totalCols(), tr = totalRows();
        for (let r = row; r < tr - 1; ++r)
          for (let c = 0; c < tc; ++c) {
            setCellData(c, r, getCellRaw(c, r + 1));
            S().cellFormats[cellKey(c, r)] = Object.assign({}, getFormat(c, r + 1));
          }
        for (let c = 0; c < tc; ++c) { setCellData(c, tr - 1, ''); S().cellFormats[cellKey(c, tr - 1)] = {}; }
        recalcSheetExtent();
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'delete-col': {
        const col = activeCell.col;
        const tc = totalCols(), tr = totalRows();
        for (let c = col; c < tc - 1; ++c)
          for (let r = 0; r < tr; ++r) {
            setCellData(c, r, getCellRaw(c + 1, r));
            S().cellFormats[cellKey(c, r)] = Object.assign({}, getFormat(c + 1, r));
          }
        for (let r = 0; r < tr; ++r) { setCellData(tc - 1, r, ''); S().cellFormats[cellKey(tc - 1, r)] = {}; }
        recalcSheetExtent();
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'insert-chart-bar': drawChart('bar'); break;
      case 'insert-chart-line': drawChart('line'); break;
      case 'insert-chart-pie': drawChart('pie'); break;
      case 'insert-chart-scatter': drawChart('scatter'); break;
      case 'insert-chart-area': drawChart('area'); break;
      case 'chart-bar': showInsertChartDialog('bar'); break;
      case 'chart-line': showInsertChartDialog('line'); break;
      case 'chart-pie': showInsertChartDialog('pie'); break;
      case 'chart-area': showInsertChartDialog('area'); break;
      case 'chart-doughnut': showInsertChartDialog('doughnut'); break;
      case 'chart-radar': showInsertChartDialog('radar'); break;
      case 'chart-histogram': showInsertChartDialog('histogram'); break;
      case 'chart-stacked-bar': showInsertChartDialog('stacked-bar'); break;
      case 'chart-stacked-area': showInsertChartDialog('stacked-area'); break;
      case 'chart-combo': showInsertChartDialog('combo'); break;
      case 'sparkline-line': insertSparkline('line'); break;
      case 'sparkline-column': insertSparkline('column'); break;
      case 'sparkline-winloss': insertSparkline('win-loss'); break;
      case 'sparkline-options': ChartEngine.showSparklineOptions(activeCell.col, activeCell.row); break;
      case 'insert-function': {
        showInsertFunctionDialog('all');
        document.getElementById('fn-insert-ok').onclick = () => {
          const sel = document.getElementById('fn-list').value;
          if (sel) { startEditing(activeCell.col, activeCell.row, '=' + sel + '('); }
          SZ.Dialog.close('dlg-insert-function');
        };
        break;
      }
      case 'fn-cat-math': showInsertFunctionDialog('math'); break;
      case 'fn-cat-stat': showInsertFunctionDialog('stat'); break;
      case 'fn-cat-text': showInsertFunctionDialog('text'); break;
      case 'fn-cat-date': showInsertFunctionDialog('date'); break;
      case 'fn-cat-logical': showInsertFunctionDialog('logical'); break;
      case 'fn-cat-lookup': showInsertFunctionDialog('lookup'); break;
      case 'fn-cat-financial': showInsertFunctionDialog('financial'); break;
      case 'fn-cat-info': showInsertFunctionDialog('info'); break;
      case 'insert-hyperlink': showPrompt('Insert Hyperlink', 'URL:', 'https://').then(url => { if (url) { S().hyperlinks[cellKey(activeCell.col, activeCell.row)] = url; renderCellContent(activeCell.col, activeCell.row); setDirty(true); } }); break;
      case 'insert-comment': showPrompt('Add Comment', 'Comment:', S().comments[cellKey(activeCell.col, activeCell.row)] || '').then(c => { if (c !== null) { S().comments[cellKey(activeCell.col, activeCell.row)] = c; rebuildGrid(); setDirty(true); } }); break;
      case 'name-manager': case 'define-name': {
        showDialog('dlg-name-manager');
        const nmRefresh = () => {
          const tbody = document.getElementById('nm-list-body');
          tbody.innerHTML = '';
          for (const [name, range] of Object.entries(S().namedRanges)) {
            const tr = document.createElement('tr');
            tr.style.cursor = 'default';
            const tdName = document.createElement('td'); tdName.textContent = name;
            const tdRange = document.createElement('td'); tdRange.textContent = range;
            const tdScope = document.createElement('td'); tdScope.textContent = 'Sheet';
            const tdUsed = document.createElement('td');
            const usedCells = [];
            for (const key in S().cellData) {
              const d = S().cellData[key];
              if (d && typeof d.raw === 'string' && d.raw.startsWith('=') && d.raw.toLowerCase().includes(name.toLowerCase()))
                usedCells.push(key);
            }
            tdUsed.textContent = usedCells.length ? usedCells.join(', ') : '-';
            tr.appendChild(tdName); tr.appendChild(tdRange); tr.appendChild(tdScope); tr.appendChild(tdUsed);
            tr.addEventListener('click', () => {
              document.getElementById('nm-name').value = name;
              document.getElementById('nm-range').value = range;
              const parsed = parseKey(range.split(':')[0]);
              if (parsed) { selectCell(parsed.col, parsed.row); scrollCellIntoView(parsed.col, parsed.row); }
            });
            tbody.appendChild(tr);
          }
        };
        nmRefresh();
        document.getElementById('nm-add').onclick = () => {
          const name = document.getElementById('nm-name').value.trim();
          const range = document.getElementById('nm-range').value.trim();
          if (name && range) { S().namedRanges[name] = range; nmRefresh(); setDirty(true); }
        };
        document.getElementById('nm-delete').onclick = () => {
          const name = document.getElementById('nm-name').value.trim();
          if (name && S().namedRanges[name]) { delete S().namedRanges[name]; nmRefresh(); setDirty(true); document.getElementById('nm-name').value = ''; document.getElementById('nm-range').value = ''; }
        };
        break;
      }
      case 'trace-precedents': case 'trace-dependents': {
        const key = cellKey(activeCell.col, activeCell.row);
        const d = S().cellData[key];
        let refs = [];
        if (action === 'trace-precedents' && d && d.deps) refs = [...d.deps];
        else if (action === 'trace-dependents' && S().depGraph[key]) refs = [...S().depGraph[key]];
        if (refs.length) {
          multiSelections = [];
          for (const ref of refs) { const p = parseKey(ref); if (p) multiSelections.push({ c1: p.col, r1: p.row, c2: p.col, r2: p.row }); }
          updateSelectionDisplay();
          drawTraceArrows(activeCell.col, activeCell.row, refs);
        }
        break;
      }
      case 'remove-arrows': removeTraceArrows(); break;
      case 'show-formulas': showFormulas = !showFormulas; rebuildGrid(); break;
      case 'error-checking': showErrorCheckingPanel(); break;
      case 'evaluate-formula': showEvaluateFormulaDialog(); break;
      case 'custom-sort': {
        const sel = document.getElementById('sort-col');
        sel.innerHTML = '';
        for (let c = 0; c < totalCols(); ++c) { const opt = document.createElement('option'); opt.value = c; opt.textContent = colName(c); sel.appendChild(opt); }
        sel.value = activeCell.col;
        showDialog('dlg-custom-sort').then(r => {
          if (r === 'ok') {
            const col = parseInt(document.getElementById('sort-col').value, 10);
            const asc = document.getElementById('sort-order').value === 'asc';
            const hasHeader = document.getElementById('sort-has-header').checked;
            const startRow = hasHeader ? 1 : 0;
            const rows = [];
            for (let r = startRow; r < totalRows(); ++r) {
              let hasData = false;
              for (let c = 0; c < totalCols(); ++c) if (getCellRaw(c, r) !== '') { hasData = true; break; }
              if (!hasData) continue;
              const row = [];
              for (let c = 0; c < totalCols(); ++c) row.push({ raw: getCellRaw(c, r), fmt: Object.assign({}, getFormat(c, r)) });
              rows.push(row);
            }
            rows.sort((a, b) => {
              const va = a[col].raw, vb = b[col].raw;
              const na = Number(va), nb = Number(vb);
              if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
              return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            });
            for (let r = 0; r < rows.length; ++r)
              for (let c = 0; c < totalCols(); ++c) {
                setCellData(c, startRow + r, rows[r][c].raw);
                S().cellFormats[cellKey(c, startRow + r)] = rows[r][c].fmt;
              }
            rebuildGrid(); setDirty(true);
          }
        });
        break;
      }
      case 'auto-filter': {
        if (S().filterCol >= 0) { S().filterCol = -1; S().filterValues = null; S().hiddenRows.clear(); }
        else S().filterCol = activeCell.col;
        rebuildGrid();
        break;
      }
      case 'clear-filter': S().filterCol = -1; S().filterValues = null; S().hiddenRows.clear(); rebuildGrid(); break;
      case 'text-to-columns': DataTools.showTextToColumnsWizard(); break;
      case 'remove-duplicates': DataTools.showRemoveDuplicatesDialog(); break;
      case 'data-validation': showDataValidationDialog(); break;
      case 'advanced-sort': DataTools.showAdvancedSortDialog(); break;
      case 'advanced-filter': DataTools.showAdvancedFilterDialog(); break;
      case 'subtotals': DataTools.showSubtotalsDialog(); break;
      case 'remove-subtotals': DataTools.removeSubtotals(); break;
      case 'consolidate': DataTools.showConsolidateDialog(); break;
      case 'manage-cf-rules': showManageCFRulesDialog(); break;
      case 'group-rows': {
        const rect = getSelectionRect();
        if (!S().outlineGroups) S().outlineGroups = { rows: [], cols: [] };
        const existing = S().outlineGroups.rows.find(g => g.start === rect.r1 && g.end === rect.r2);
        if (!existing) {
          const maxLevel = S().outlineGroups.rows.reduce((m, g) => {
            if ((g.start >= rect.r1 && g.start <= rect.r2) || (g.end >= rect.r1 && g.end <= rect.r2))
              return Math.max(m, g.level);
            return m;
          }, 0);
          S().outlineGroups.rows.push({ start: rect.r1, end: rect.r2, level: Math.min(8, maxLevel + 1), collapsed: false });
        }
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'ungroup-rows': {
        if (!S().outlineGroups) break;
        const rect = getSelectionRect();
        const idx = S().outlineGroups.rows.findIndex(g => g.start === rect.r1 && g.end === rect.r2);
        if (idx >= 0) S().outlineGroups.rows.splice(idx, 1);
        else if (S().outlineGroups.rows.length) S().outlineGroups.rows.pop();
        S().hiddenRows.clear();
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'group-cols': {
        const rect = getSelectionRect();
        if (!S().outlineGroups) S().outlineGroups = { rows: [], cols: [] };
        const existing = S().outlineGroups.cols.find(g => g.start === rect.c1 && g.end === rect.c2);
        if (!existing) {
          const maxLevel = S().outlineGroups.cols.reduce((m, g) => {
            if ((g.start >= rect.c1 && g.start <= rect.c2) || (g.end >= rect.c1 && g.end <= rect.c2))
              return Math.max(m, g.level);
            return m;
          }, 0);
          S().outlineGroups.cols.push({ start: rect.c1, end: rect.c2, level: Math.min(8, maxLevel + 1), collapsed: false });
        }
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'ungroup-cols': {
        if (!S().outlineGroups) break;
        const rect = getSelectionRect();
        const idx = S().outlineGroups.cols.findIndex(g => g.start === rect.c1 && g.end === rect.c2);
        if (idx >= 0) S().outlineGroups.cols.splice(idx, 1);
        else if (S().outlineGroups.cols.length) S().outlineGroups.cols.pop();
        S().hiddenCols.clear();
        rebuildGrid(); setDirty(true);
        break;
      }
      case 'cond-format': {
        const cfRuleSel = document.getElementById('cf-rule');
        const cfUpdateVisibility = () => {
          const v = cfRuleSel.value;
          const isIcon = v.startsWith('icon-');
          const isDataBar = v === 'data-bar';
          const isColorScale = v === 'color-scale-2' || v === 'color-scale-3';
          const isFormula = v === 'formula';
          const needsValue = !isIcon && !isDataBar && !isColorScale && !isFormula && v !== 'duplicate';
          document.getElementById('cf-value1-row').style.display = needsValue ? '' : 'none';
          document.getElementById('cf-value2-row').style.display = v === 'between' ? '' : 'none';
          document.getElementById('cf-color-row').style.display = (!isIcon && !isColorScale && !isFormula) ? '' : 'none';
          document.getElementById('cf-color-scale-row').style.display = isColorScale ? '' : 'none';
          document.getElementById('cf-color-mid-row').style.display = v === 'color-scale-3' ? '' : 'none';
          document.getElementById('cf-formula-row').style.display = isFormula ? '' : 'none';
          document.getElementById('cf-format-options-row').style.display = isFormula ? '' : 'none';
        };
        cfRuleSel.onchange = cfUpdateVisibility;
        cfUpdateVisibility();
        showDialog('dlg-cond-format').then(r => {
          if (r === 'ok') {
            const rect = getSelectionRect();
            const ruleType = cfRuleSel.value;
            const rule = {
              ...rect, type: ruleType,
              value1: document.getElementById('cf-value1').value,
              value2: document.getElementById('cf-value2').value,
              color: document.getElementById('cf-color').value,
            };
            if (ruleType === 'color-scale-2' || ruleType === 'color-scale-3') {
              rule.colorMin = document.getElementById('cf-color-min').value;
              rule.colorMid = document.getElementById('cf-color-mid').value;
              rule.colorMax = document.getElementById('cf-color-max').value;
            }
            if (ruleType === 'formula') {
              rule.formula = document.getElementById('cf-formula').value;
              rule.fmtTextColor = document.getElementById('cf-fmt-text-color').value;
              rule.fmtBgColor = document.getElementById('cf-fmt-bg-color').value;
              rule.fmtBold = document.getElementById('cf-fmt-bold').checked;
              rule.fmtItalic = document.getElementById('cf-fmt-italic').checked;
            }
            S().conditionalRules.push(rule);
            rebuildGrid(); setDirty(true);
          } else if (r === 'clear') { S().conditionalRules.length = 0; rebuildGrid(); setDirty(true); }
        });
        break;
      }
      case 'cell-styles': {
        const grid = document.getElementById('cell-styles-grid');
        grid.innerHTML = '';
        const allStyles = [...CELL_STYLES, ...customCellStyles];
        for (const style of allStyles) {
          const item = document.createElement('div');
          item.className = 'cell-style-item';
          item.textContent = style.name;
          Object.assign(item.style, {
            backgroundColor: style.fmt.bgColor || '',
            color: style.fmt.textColor || '',
            fontWeight: style.fmt.bold ? 'bold' : '',
            fontStyle: style.fmt.italic ? 'italic' : '',
            fontSize: style.fmt.fontSize ? style.fmt.fontSize + 'px' : '',
          });
          item.addEventListener('click', () => {
            const rect = getSelectionRect();
            for (let r = rect.r1; r <= rect.r2; ++r)
              for (let c = rect.c1; c <= rect.c2; ++c) {
                S().cellFormats[cellKey(c, r)] = Object.assign({}, getFormat(c, r), style.fmt);
                renderCellContent(c, r);
              }
            SZ.Dialog.close('dlg-cell-styles');
            setDirty(true);
          });
          grid.appendChild(item);
        }
        // "New Style" button
        const newStyleBtn = document.createElement('div');
        newStyleBtn.className = 'cell-style-item';
        newStyleBtn.textContent = '+ New Style...';
        newStyleBtn.style.fontStyle = 'italic';
        newStyleBtn.style.color = 'var(--sz-color-highlight)';
        newStyleBtn.addEventListener('click', () => {
          SZ.Dialog.close('dlg-cell-styles');
          handleAction('new-cell-style');
        });
        grid.appendChild(newStyleBtn);
        showDialog('dlg-cell-styles');
        break;
      }
      case 'new-cell-style': {
        showDialog('dlg-new-cell-style').then(r => {
          if (r !== 'ok') return;
          const name = document.getElementById('ncs-name').value.trim();
          if (!name) return;
          const fmt = {};
          const fontFamily = document.getElementById('ncs-font').value;
          if (fontFamily) fmt.fontFamily = fontFamily;
          const fontSize = parseInt(document.getElementById('ncs-size').value, 10);
          if (fontSize && fontSize !== 11) fmt.fontSize = fontSize;
          if (document.getElementById('ncs-bold').checked) fmt.bold = true;
          if (document.getElementById('ncs-italic').checked) fmt.italic = true;
          const textColor = document.getElementById('ncs-text-color').value;
          if (textColor && textColor !== '#000000') fmt.textColor = textColor;
          const bgColor = document.getElementById('ncs-bg-color').value;
          if (bgColor && bgColor !== '#ffffff') fmt.bgColor = bgColor;
          const borderStyle = document.getElementById('ncs-border-style').value;
          if (borderStyle && borderStyle !== 'none') {
            const borderColor = document.getElementById('ncs-border-color').value;
            fmt.borderAll = { style: borderStyle, color: borderColor };
          }
          customCellStyles.push({ name, fmt });
        });
        break;
      }
      case 'format-table': {
        const tsGrid = document.getElementById('table-styles-grid');
        tsGrid.innerHTML = '';
        for (const style of TABLE_STYLES) {
          const item = document.createElement('div');
          item.className = 'table-style-item';
          item.innerHTML = '<div class="ts-header" style="background:' + style.header.bg + ';color:' + style.header.fg + ';font-weight:bold;">Header</div>'
            + '<div class="ts-band" style="background:' + style.bandEven.bg + ';">Row 1</div>'
            + '<div class="ts-band" style="background:' + style.bandOdd.bg + ';">Row 2</div>'
            + '<div class="ts-band" style="background:' + style.bandEven.bg + ';">Row 3</div>'
            + '<div class="ts-name">' + style.name + '</div>';
          item.addEventListener('click', () => {
            const rect = getSelectionRect();
            const border = style.border;
            const actions = [];
            for (let r = rect.r1; r <= rect.r2; ++r)
              for (let c = rect.c1; c <= rect.c2; ++c) {
                const oldFmt = Object.assign({}, getFormat(c, r));
                const newFmt = Object.assign({}, oldFmt);
                newFmt.borderAll = border;
                if (r === rect.r1) {
                  newFmt.bgColor = style.header.bg;
                  newFmt.textColor = style.header.fg;
                  newFmt.bold = style.header.bold;
                } else {
                  const band = (r - rect.r1) % 2 === 1 ? style.bandOdd : style.bandEven;
                  newFmt.bgColor = band.bg;
                  newFmt.textColor = '';
                  newFmt.bold = false;
                }
                actions.push({ type: 'cell', col: c, row: r, oldVal: getCellRaw(c, r), newVal: getCellRaw(c, r), oldFmt, newFmt });
                S().cellFormats[cellKey(c, r)] = newFmt;
              }
            if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
            rebuildGrid();
            SZ.Dialog.close('dlg-table-styles');
          });
          tsGrid.appendChild(item);
        }
        showDialog('dlg-table-styles');
        break;
      }
      case 'format-cells': {
        const fcTabs = document.querySelectorAll('.fc-tab');
        const fcPanels = document.querySelectorAll('.fc-panel');
        fcTabs.forEach(t => {
          t.onclick = () => {
            fcTabs.forEach(tt => tt.classList.remove('active'));
            fcPanels.forEach(p => p.classList.remove('active'));
            t.classList.add('active');
            document.getElementById('fcp-' + t.dataset.fctab).classList.add('active');
          };
        });
        const fmt = getFormat(activeCell.col, activeCell.row);
        document.getElementById('fc-numfmt').value = fmt.numberFmt || 'general';
        document.getElementById('fc-decimals').value = fmt.decimals || 2;
        document.getElementById('fc-halign').value = fmt.align || '';
        document.getElementById('fc-valign').value = fmt.valign || '';
        document.getElementById('fc-wrap').checked = !!fmt.wrapText;
        document.getElementById('fc-rotation').value = fmt.textRotation || '0';
        document.getElementById('fc-font-family').value = fmt.fontFamily || '';
        document.getElementById('fc-font-size').value = fmt.fontSize || 11;
        document.getElementById('fc-bold').checked = !!fmt.bold;
        document.getElementById('fc-italic').checked = !!fmt.italic;
        document.getElementById('fc-underline').checked = !!fmt.underline;
        document.getElementById('fc-strikethrough').checked = !!fmt.strikethrough;
        document.getElementById('fc-fill-color').value = fmt.bgColor || '#ffffff';
        document.getElementById('fc-fill-none').onclick = () => { document.getElementById('fc-fill-color').value = '#ffffff'; };
        // Custom number format
        const fcCustomRow = document.getElementById('fc-custom-row');
        const fcCustomInput = document.getElementById('fc-custom-code');
        if (fcCustomInput) fcCustomInput.value = fmt.customFormat || '';
        const fcNumFmt = document.getElementById('fc-numfmt');
        const toggleCustomRow = () => {
          if (fcCustomRow) fcCustomRow.style.display = fcNumFmt.value === 'custom' ? '' : 'none';
        };
        fcNumFmt.onchange = toggleCustomRow;
        toggleCustomRow();
        showDialog('dlg-format-cells').then(r => {
          if (r !== 'ok') return;
          const newFmt = {
            numberFmt: document.getElementById('fc-numfmt').value,
            decimals: parseInt(document.getElementById('fc-decimals').value, 10),
            align: document.getElementById('fc-halign').value || undefined,
            valign: document.getElementById('fc-valign').value || undefined,
            wrapText: document.getElementById('fc-wrap').checked || undefined,
            textRotation: document.getElementById('fc-rotation').value !== '0' ? document.getElementById('fc-rotation').value : undefined,
            fontFamily: document.getElementById('fc-font-family').value || undefined,
            fontSize: parseInt(document.getElementById('fc-font-size').value, 10) || undefined,
            bold: document.getElementById('fc-bold').checked || undefined,
            italic: document.getElementById('fc-italic').checked || undefined,
            underline: document.getElementById('fc-underline').checked || undefined,
            strikethrough: document.getElementById('fc-strikethrough').checked || undefined,
          };
          // Custom format code
          if (newFmt.numberFmt === 'custom') {
            const customCode = document.getElementById('fc-custom-code');
            if (customCode && customCode.value.trim()) newFmt.customFormat = customCode.value.trim();
          }
          const fillColor = document.getElementById('fc-fill-color').value;
          if (fillColor && fillColor !== '#ffffff') newFmt.bgColor = fillColor;
          const bStyle = document.getElementById('fc-border-style').value;
          const bColor = document.getElementById('fc-border-color').value;
          const bApply = document.getElementById('fc-border-apply').value;
          const border = { style: bStyle, color: bColor };
          if (bApply === 'all') newFmt.borderAll = border;
          else if (bApply === 'outline') { newFmt.borderTop = border; newFmt.borderBottom = border; newFmt.borderLeft = border; newFmt.borderRight = border; }
          else if (bApply === 'top') newFmt.borderTop = border;
          else if (bApply === 'bottom') newFmt.borderBottom = border;
          else if (bApply === 'left') newFmt.borderLeft = border;
          else if (bApply === 'right') newFmt.borderRight = border;
          else if (bApply === 'none') { newFmt.borderAll = null; newFmt.borderTop = null; newFmt.borderBottom = null; newFmt.borderLeft = null; newFmt.borderRight = null; }
          const rect = getSelectionRect();
          const actions = [];
          for (let r = rect.r1; r <= rect.r2; ++r)
            for (let c = rect.c1; c <= rect.c2; ++c) {
              const oldFmt = Object.assign({}, getFormat(c, r));
              const merged = Object.assign({}, oldFmt, newFmt);
              actions.push({ type: 'cell', col: c, row: r, oldVal: getCellRaw(c, r), newVal: getCellRaw(c, r), oldFmt, newFmt: merged });
              S().cellFormats[cellKey(c, r)] = merged;
              renderCellContent(c, r);
            }
          if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
        });
        break;
      }
      case 'col-width': showPrompt('Column Width', 'Width (pixels):', String(getColWidth(activeCell.col))).then(v => { if (v) { S().colWidths[activeCell.col] = Math.max(10, parseInt(v, 10) || 80); updateColumnWidth(activeCell.col); } }); break;
      case 'col-autofit': autoResizeColumn(activeCell.col); break;
      case 'col-hide': S().hiddenCols.add(activeCell.col); rebuildGrid(); break;
      case 'col-unhide': S().hiddenCols.clear(); rebuildGrid(); break;
      case 'row-height': showPrompt('Row Height', 'Height (pixels):', String(getRowHeight(activeCell.row))).then(v => { if (v) { S().rowHeights[activeCell.row] = Math.max(10, parseInt(v, 10) || 20); rebuildGrid(); } }); break;
      case 'row-autofit': autoResizeRow(activeCell.row); break;
      case 'row-hide': S().hiddenRows.add(activeCell.row); rebuildGrid(); break;
      case 'row-unhide': S().hiddenRows.clear(); rebuildGrid(); break;
      case 'sheet-rename': showPrompt('Rename Sheet', 'New name:', S().name).then(n => { if (n && n.trim()) { S().name = n.trim(); renderSheetTabs(); setDirty(true); } }); break;
      case 'sheet-tab-color': showColorPalette(sheetTabsEl, (c) => { S().tabColor = c; renderSheetTabs(); }); break;
      case 'freeze-panes': S().freezeRow = activeCell.row; S().freezeCol = activeCell.col; rebuildGrid(); setDirty(true); break;
      case 'unfreeze-panes': S().freezeRow = 0; S().freezeCol = 0; rebuildGrid(); setDirty(true); break;
      case 'borders-all': applyFormatToSelection('borderAll', { style: 'thin', color: '#000000' }); break;
      case 'borders-outer': {
        const rect = getSelectionRect();
        for (let r = rect.r1; r <= rect.r2; ++r)
          for (let c = rect.c1; c <= rect.c2; ++c) {
            const fmt = {};
            if (r === rect.r1) fmt.borderTop = { style: 'thin', color: '#000' };
            if (r === rect.r2) fmt.borderBottom = { style: 'thin', color: '#000' };
            if (c === rect.c1) fmt.borderLeft = { style: 'thin', color: '#000' };
            if (c === rect.c2) fmt.borderRight = { style: 'thin', color: '#000' };
            setFormat(c, r, fmt); renderCellContent(c, r);
          }
        setDirty(true);
        break;
      }
      case 'borders-none': applyFormatToSelection('borderAll', null); applyFormatToSelection('borderTop', null); applyFormatToSelection('borderBottom', null); applyFormatToSelection('borderLeft', null); applyFormatToSelection('borderRight', null); break;
      case 'borders-bottom': applyFormatToSelection('borderBottom', { style: 'thin', color: '#000000' }); break;
      case 'pivot-table': showPivotTableDialog(); break;
      case 'refresh-pivot': refreshPivotTables(); break;
      case 'pivot-slicer': PivotEngine.showSlicerDialog(); break;
      case 'pivot-group-field': PivotEngine.showGroupFieldDialog(); break;
      case 'pivot-drill-down': PivotEngine.showDrillDownDialog(); break;
      case 'about': showDialog('dlg-about'); break;
      case 'goal-seek': GoalSeek.showGoalSeekDialog(); break;
      case 'protect-sheet': Protection.showProtectSheetDialog(); break;
      case 'lock-cell': Protection.toggleCellLock(); break;
      case 'set-print-area': PrintLayout.setPrintArea(); break;
      case 'clear-print-area': PrintLayout.clearPrintArea(); break;
      case 'page-break-h': PrintLayout.insertPageBreakH(); break;
      case 'page-break-v': PrintLayout.insertPageBreakV(); break;
      case 'remove-breaks': PrintLayout.removeAllPageBreaks(); break;
      case 'break-preview': PrintLayout.togglePageBreakPreview(); break;
      case 'data-table': WhatIf.showDataTableDialog(); break;
      case 'scenario-manager': WhatIf.showScenarioManager(); break;
      case 'solver': WhatIf.showSolverDialog(); break;
      case 'freeze-top-row': S().freezeRow = 1; S().freezeCol = 0; rebuildGrid(); setDirty(true); break;
      case 'freeze-first-col': S().freezeRow = 0; S().freezeCol = 1; rebuildGrid(); setDirty(true); break;
      case 'unfreeze': S().freezeRow = 0; S().freezeCol = 0; rebuildGrid(); setDirty(true); break;
      case 'export-pdf': PrintLayout.exportToPdf(); break;
      case 'page-setup': PrintLayout.showPageSetupDialog(); break;
      case 'save-template': doSaveTemplate(); break;
      case 'load-template': doLoadTemplate(); break;
      case 'template-invoice': applyBuiltInTemplate('invoice'); break;
      case 'template-budget': applyBuiltInTemplate('budget'); break;
      case 'template-calendar': applyBuiltInTemplate('calendar'); break;
      case 'apply-theme': showThemeDialog(); break;
      case 'import-json': doImportJson(); break;
      case 'export-json': doExportJson(); break;
    }
  }

  // ── Module initialization ────────────────────────────────────────
  FormulaEngine.init({
    S, cellKey, parseKey, colName, colIndex, getCellRaw, getCellValue,
    getSheets: () => sheets,
    getActiveSheetIdx: () => activeSheetIdx,
    setActiveSheetIdx: (v) => { activeSheetIdx = v; },
  });
  ChartEngine.init({
    S, cellKey, parseKey, colName, colIndex, getCellValue,
    getSelectionRect, showDialog: SZ.Dialog.show, rebuildGrid,
    setFormat, getFormat, setDirty: () => { dirty = true; updateTitle(); },
    getActiveCell: () => activeCell, gridScroll,
  });
  XlsxEngine.init({
    S, cellKey, parseKey, colName, colIndex, getCellValue,
    setCellData, setFormat, getFormat, evaluateFormula,
    sheets: () => sheets, createSheet,
    Kernel32, User32, MB_OK: 0, DEFAULT_COL_WIDTH,
  });
  PivotEngine.init({
    S, cellKey, parseKey, colName, colIndex, getCellValue,
    setCellData, setFormat, getFormat,
    getSelectionRect, showDialog: SZ.Dialog.show, rebuildGrid,
    setDirty: () => { dirty = true; updateTitle(); },
    getActiveCell: () => activeCell, escapeHtml,
    sheets: () => sheets, createSheet,
    activeSheetIdx: Object.assign(() => activeSheetIdx, { set: (v) => { activeSheetIdx = v; renderSheetTabs(); } }),
  });
  DataTools.init({
    S, cellKey, parseKey, colName, colIndex,
    getCellRaw, getCellValue, setCellData,
    getFormat, setFormat, pushUndo,
    setDirty: () => { dirty = true; updateTitle(); },
    rebuildGrid, renderCellContent, recalcDependents,
    getActiveCell: () => activeCell, getSelectionRect,
    showDialog: SZ.Dialog.show,
  });
  GoalSeek.init({
    S, cellKey, parseKey, colName, colIndex,
    getCellRaw, getCellValue, setCellData,
    getFormat, setFormat, pushUndo,
    setDirty: () => { dirty = true; updateTitle(); },
    rebuildGrid, recalcAll, recalcDependents,
    getActiveCell: () => activeCell, User32,
  });
  Protection.init({
    S, cellKey, parseKey,
    getCellRaw, getFormat, setFormat, pushUndo,
    setDirty: () => { dirty = true; updateTitle(); },
    rebuildGrid,
    getActiveCell: () => activeCell, getSelectionRect, User32,
  });
  PrintLayout.init({
    S, cellKey, parseKey, pushUndo,
    setDirty: () => { dirty = true; updateTitle(); },
    rebuildGrid,
    getActiveCell: () => activeCell, getSelectionRect, User32,
    getCellRaw, getCellValue, getFormat, formatDisplayValue,
    totalRows, totalCols, getColWidth, DEFAULT_ROW_HEIGHT,
    currentFileName: () => currentFileName,
  });
  WhatIf.init({
    S, cellKey, parseKey, colName, colIndex,
    getCellRaw, getCellValue, setCellData,
    getFormat, setFormat, pushUndo,
    setDirty: () => { dirty = true; updateTitle(); },
    rebuildGrid, recalcAll, recalcDependents,
    getActiveCell: () => activeCell, getSelectionRect, User32,
    showPrompt,
    sheets: () => sheets, createSheet,
    activeSheetIdx: Object.assign(() => activeSheetIdx, { set: (v) => { activeSheetIdx = v; renderSheetTabs(); } }),
  });

  // ── Initialization ─────────────────────────────────────────────────
  buildColumnHeaders();
  renderVisibleRows();
  selectCell(0, 0);
  renderSheetTabs();
  updateTitle();
  statusCell.textContent = 'Ready';

  // ── Status bar right-click ──────────────────────────────────
  const statusBarEl = document.querySelector('.status-bar');
  if (statusBarEl)
    statusBarEl.addEventListener('contextmenu', (e) => showStatusBarContextMenu(e));

  gridScroll.setAttribute('tabindex', '0');
  gridScroll.style.outline = 'none';
  gridScroll.focus();

  const cmd = Kernel32.GetCommandLine();
  if (cmd.path) {
    (async () => {
      try {
        if (/\.xlsx$/i.test(cmd.path)) {
          const data = await Kernel32.ReadFile(cmd.path, { encoding: 'binary' });
          loadXlsxWorkbook(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
          currentFilePath = cmd.path;
          const parts = cmd.path.split('/');
          currentFileName = parts[parts.length - 1] || 'Untitled';
          currentFileFormat = 'xlsx';
          dirty = false;
          rebuildGrid(); renderSheetTabs(); updateTitle();
        } else {
          const content = await Kernel32.ReadFile(cmd.path);
          currentFileFormat = /\.tsv$/i.test(cmd.path) ? 'tsv' : 'csv';
          loadDelimited(cmd.path, content);
        }
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'Spreadsheet', MB_OK);
      }
    })();
  }

})();
