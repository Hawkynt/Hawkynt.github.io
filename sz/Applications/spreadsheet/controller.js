;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // ── Constants ──────────────────────────────────────────────────────
  const INIT_COLS = 26;
  const INIT_ROWS = 100;
  const DEFAULT_COL_WIDTH = 80;
  const DEFAULT_ROW_HEIGHT = 20;
  const VISIBLE_ROW_BUFFER = 5;
  const MAX_UNDO = 100;

  const PALETTE_COLORS = [
    '#000000','#993300','#333300','#003300','#003366','#000080','#333399','#333333',
    '#800000','#ff6600','#808000','#008000','#008080','#0000ff','#666699','#808080',
    '#ff0000','#ff9900','#99cc00','#339966','#33cccc','#3366ff','#800080','#999999',
    '#ff00ff','#ffcc00','#ffff00','#00ff00','#00ffff','#00ccff','#993366','#c0c0c0',
    '#ff99cc','#ffcc99','#ffff99','#ccffcc','#ccffff','#99ccff','#cc99ff','#ffffff',
  ];

  const FILE_FILTERS = [
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

  // ── DOM refs ───────────────────────────────────────────────────────
  const ribbonTabs = document.getElementById('ribbon-tabs');
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
        if (visited.has(dep)) continue;
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
    const deps = [];
    const result = { value: '', error: false, deps };
    try {
      result.value = evalExpression(expr, deps, selfKey);
    } catch (e) {
      result.value = '#ERROR!';
      result.error = true;
    }
    return result;
  }

  function evalExpression(expr, deps, selfKey) {
    let processed = expr;
    processed = _resolveAllFunctions(processed, deps, selfKey);
    processed = processed.replace(/&/g, '+');
    processed = processed.replace(/\^/g, '**');
    processed = processed.replace(/<>/g, '!==');
    processed = processed.replace(/(?<![<>=!])=(?!=)/g, '===');

    // Named ranges
    const nr = S().namedRanges;
    for (const [name, range] of Object.entries(nr))
      processed = processed.replace(new RegExp('\\b' + name + '\\b', 'gi'), range);

    // Sheet references like Sheet1!A1
    processed = processed.replace(/([A-Za-z0-9_]+)!([A-Z]+\d+(?::[A-Z]+\d+)?)/gi, (match, sheetName, ref) => {
      const si = sheets.findIndex(s => s.name.toLowerCase() === sheetName.toLowerCase());
      if (si < 0) return '0';
      const saved = activeSheetIdx;
      activeSheetIdx = si;
      const val = _resolveRef(ref, deps, selfKey);
      activeSheetIdx = saved;
      return val;
    });

    processed = processed.replace(/\b([A-Z]+)(\d+)\b/gi, (match, col, row) => {
      const key = col.toUpperCase() + row;
      if (key === selfKey) return '0';
      deps.push(key);
      const parsed = parseKey(key);
      if (!parsed) return '0';
      return _cellValueToJS(getCellValue(parsed.col, parsed.row));
    });

    processed = processed.replace(/(\d+(?:\.\d+)?)%/g, (_, n) => String(Number(n) / 100));

    const fn = new Function('"use strict"; return (' + processed + ');');
    return fn();
  }

  function _resolveRef(ref, deps, selfKey) {
    const rm = ref.match(/^([A-Z]+)(\d+)$/i);
    if (rm) {
      const key = rm[1].toUpperCase() + rm[2];
      deps.push(key);
      const p = parseKey(key);
      if (!p) return '0';
      return _cellValueToJS(getCellValue(p.col, p.row));
    }
    return '0';
  }

  function _cellValueToJS(val) {
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string' && val !== '') {
      const n = Number(val);
      if (!isNaN(n) && val.trim() !== '') return String(n);
      return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return '0';
  }

  function _resolveAllFunctions(expr, deps, selfKey) {
    for (let iter = 0; iter < 80; ++iter) {
      const match = expr.match(/([A-Z_][A-Z0-9_]*)\s*\(([^()]*)\)/i);
      if (!match) break;
      const fn = match[1].toUpperCase();
      const args = match[2];
      const replacement = _evalFunction(fn, args, deps, selfKey);
      expr = expr.substring(0, match.index) + replacement + expr.substring(match.index + match[0].length);
    }
    return expr;
  }

  function _splitArgs(argsStr) {
    const result = [];
    let depth = 0, inString = false, stringChar = '', current = '';
    for (let i = 0; i < argsStr.length; ++i) {
      const ch = argsStr[i];
      if (inString) { current += ch; if (ch === stringChar) inString = false; continue; }
      if (ch === '"' || ch === "'") { inString = true; stringChar = ch; current += ch; continue; }
      if (ch === '(') ++depth; else if (ch === ')') --depth;
      if (ch === ',' && depth === 0) { result.push(current); current = ''; }
      else current += ch;
    }
    if (current.length > 0) result.push(current);
    return result;
  }

  function _evalSub(expr, deps, selfKey) {
    try { return evalExpression(expr.trim(), deps, selfKey); }
    catch { return 0; }
  }

  function _evalSubStr(expr, deps, selfKey) {
    const v = _evalSub(expr, deps, selfKey);
    return typeof v === 'string' ? v : String(v);
  }

  function _evalSubNum(expr, deps, selfKey) {
    const v = _evalSub(expr, deps, selfKey);
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function _collectRangeValues(argsStr, deps, selfKey) {
    const values = [];
    const parts = _splitArgs(argsStr);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const rangeMatch = trimmed.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (rangeMatch) {
        const c1 = colIndex(rangeMatch[1].toUpperCase());
        const r1 = parseInt(rangeMatch[2], 10) - 1;
        const c2 = colIndex(rangeMatch[3].toUpperCase());
        const r2 = parseInt(rangeMatch[4], 10) - 1;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); ++r)
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); ++c) {
            const key = cellKey(c, r);
            if (key !== selfKey) deps.push(key);
            values.push(getCellValue(c, r));
          }
      } else {
        const val = _evalSub(trimmed, deps, selfKey);
        values.push(typeof val === 'number' ? val : (typeof val === 'string' && val !== '' ? (isNaN(Number(val)) ? val : Number(val)) : val));
      }
    }
    return values;
  }

  function _collectRangeNumericValues(argsStr, deps, selfKey) {
    return _collectRangeValues(argsStr, deps, selfKey).filter(v => typeof v === 'number' && !isNaN(v));
  }

  function _fnRange(argsStr, deps, selfKey, reducer) {
    return reducer(_collectRangeValues(argsStr, deps, selfKey));
  }

  function _getRangeArray(rangeStr, deps, selfKey) {
    const trimmed = rangeStr.trim();
    const rangeMatch = trimmed.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
    if (!rangeMatch) return [];
    const c1 = colIndex(rangeMatch[1].toUpperCase());
    const r1 = parseInt(rangeMatch[2], 10) - 1;
    const c2 = colIndex(rangeMatch[3].toUpperCase());
    const r2 = parseInt(rangeMatch[4], 10) - 1;
    const rows = [];
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); ++r) {
      const row = [];
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); ++c) {
        const key = cellKey(c, r);
        if (key !== selfKey) deps.push(key);
        row.push(getCellValue(c, r));
      }
      rows.push(row);
    }
    return rows;
  }

  function _conditionMatch(criteria, value) {
    const cs = String(criteria).trim();
    let op = '===', cv = cs;
    const om = cs.match(/^(>=|<=|<>|!=|>|<|=)(.*)$/);
    if (om) {
      op = om[1]; cv = om[2].trim();
      if (op === '=') op = '===';
      if (op === '<>' || op === '!=') op = '!==';
    }
    const nv = Number(cv), numVal = Number(value);
    if (!isNaN(nv) && !isNaN(numVal)) {
      switch (op) {
        case '===': return numVal === nv;
        case '!==': return numVal !== nv;
        case '>': return numVal > nv;
        case '<': return numVal < nv;
        case '>=': return numVal >= nv;
        case '<=': return numVal <= nv;
      }
    }
    const sv = String(value).toLowerCase(), scv = cv.toLowerCase();
    if (op === '===') return sv === scv;
    if (op === '!==') return sv !== scv;
    return false;
  }

  function _evalFunction(fname, args, deps, selfKey) {
    const a = () => _splitArgs(args);
    const nums = () => _collectRangeNumericValues(args, deps, selfKey);
    const vals = () => _collectRangeValues(args, deps, selfKey);

    switch (fname) {
      // ── Math ──
      case 'SUM': return String(nums().reduce((s, v) => s + v, 0));
      case 'AVERAGE': { const n = nums(); return n.length ? String(n.reduce((s, v) => s + v, 0) / n.length) : '0'; }
      case 'MIN': { const n = nums(); return n.length ? String(Math.min(...n)) : '0'; }
      case 'MAX': { const n = nums(); return n.length ? String(Math.max(...n)) : '0'; }
      case 'COUNT': return String(vals().filter(v => typeof v === 'number').length);
      case 'COUNTA': return String(vals().filter(v => v !== '' && v !== null && v !== undefined).length);
      case 'COUNTBLANK': return String(vals().filter(v => v === '' || v === null || v === undefined).length);
      case 'ROUND': { const p = a(); return String(Math.round(_evalSubNum(p[0], deps, selfKey) * Math.pow(10, _evalSubNum(p[1] || '0', deps, selfKey))) / Math.pow(10, _evalSubNum(p[1] || '0', deps, selfKey))); }
      case 'ROUNDUP': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), d = _evalSubNum(p[1] || '0', deps, selfKey), f = Math.pow(10, d); return String(Math.ceil(Math.abs(v) * f) / f * Math.sign(v)); }
      case 'ROUNDDOWN': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), d = _evalSubNum(p[1] || '0', deps, selfKey), f = Math.pow(10, d); return String(Math.floor(Math.abs(v) * f) / f * Math.sign(v)); }
      case 'CEILING': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), s = _evalSubNum(p[1] || '1', deps, selfKey); return String(s ? Math.ceil(v / s) * s : 0); }
      case 'FLOOR': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), s = _evalSubNum(p[1] || '1', deps, selfKey); return String(s ? Math.floor(v / s) * s : 0); }
      case 'ABS': return String(Math.abs(_evalSubNum(args, deps, selfKey)));
      case 'SQRT': return String(Math.sqrt(_evalSubNum(args, deps, selfKey)));
      case 'POWER': { const p = a(); return String(Math.pow(_evalSubNum(p[0], deps, selfKey), _evalSubNum(p[1], deps, selfKey))); }
      case 'MOD': { const p = a(); const b = _evalSubNum(p[1], deps, selfKey); return String(b ? _evalSubNum(p[0], deps, selfKey) % b : 0); }
      case 'INT': return String(Math.floor(_evalSubNum(args, deps, selfKey)));
      case 'RAND': return String(Math.random());
      case 'RANDBETWEEN': { const p = a(); const lo = _evalSubNum(p[0], deps, selfKey), hi = _evalSubNum(p[1], deps, selfKey); return String(Math.floor(Math.random() * (hi - lo + 1)) + lo); }
      case 'PI': return String(Math.PI);
      case 'SIN': return String(Math.sin(_evalSubNum(args, deps, selfKey)));
      case 'COS': return String(Math.cos(_evalSubNum(args, deps, selfKey)));
      case 'TAN': return String(Math.tan(_evalSubNum(args, deps, selfKey)));
      case 'LOG': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey), b = p.length > 1 ? _evalSubNum(p[1], deps, selfKey) : 10; return String(Math.log(v) / Math.log(b)); }
      case 'LOG10': return String(Math.log10(_evalSubNum(args, deps, selfKey)));
      case 'LN': return String(Math.log(_evalSubNum(args, deps, selfKey)));
      case 'EXP': return String(Math.exp(_evalSubNum(args, deps, selfKey)));
      case 'FACT': { let n = _evalSubNum(args, deps, selfKey), r = 1; for (let i = 2; i <= n; ++i) r *= i; return String(r); }
      case 'COMBIN': { const p = a(); const n = _evalSubNum(p[0], deps, selfKey), k = _evalSubNum(p[1], deps, selfKey); let r = 1; for (let i = 0; i < k; ++i) r = r * (n - i) / (i + 1); return String(Math.round(r)); }
      case 'PERMUT': { const p = a(); const n = _evalSubNum(p[0], deps, selfKey), k = _evalSubNum(p[1], deps, selfKey); let r = 1; for (let i = 0; i < k; ++i) r *= (n - i); return String(r); }
      case 'PRODUCT': return String(nums().reduce((p, v) => p * v, 1));
      case 'SUMPRODUCT': {
        const p = a();
        const arrays = p.map(r => _collectRangeNumericValues(r.trim(), deps, selfKey));
        const len = Math.min(...arrays.map(a => a.length));
        let sum = 0;
        for (let i = 0; i < len; ++i) { let prod = 1; for (const arr of arrays) prod *= arr[i]; sum += prod; }
        return String(sum);
      }
      case 'SUMIF': case 'SUMIFS': {
        const p = a();
        const rangeVals = _collectRangeValues(p[0].trim(), deps, selfKey);
        const criteria = _evalSub(p[1].trim(), deps, selfKey);
        const sumVals = p.length > 2 ? _collectRangeNumericValues(p[2].trim(), deps, selfKey) : rangeVals.map(v => typeof v === 'number' ? v : (Number(v) || 0));
        let sum = 0;
        for (let i = 0; i < rangeVals.length && i < sumVals.length; ++i)
          if (_conditionMatch(criteria, rangeVals[i])) sum += sumVals[i] || 0;
        return String(sum);
      }
      case 'AVERAGEIF': case 'AVERAGEIFS': {
        const p = a();
        const rangeVals = _collectRangeValues(p[0].trim(), deps, selfKey);
        const criteria = _evalSub(p[1].trim(), deps, selfKey);
        const sumVals = p.length > 2 ? _collectRangeNumericValues(p[2].trim(), deps, selfKey) : rangeVals.map(v => typeof v === 'number' ? v : (Number(v) || 0));
        let sum = 0, cnt = 0;
        for (let i = 0; i < rangeVals.length && i < sumVals.length; ++i)
          if (_conditionMatch(criteria, rangeVals[i])) { sum += sumVals[i] || 0; ++cnt; }
        return String(cnt ? sum / cnt : 0);
      }
      case 'COUNTIF': case 'COUNTIFS': {
        const p = a();
        const rangeVals = _collectRangeValues(p[0].trim(), deps, selfKey);
        const criteria = _evalSub(p[1].trim(), deps, selfKey);
        let cnt = 0;
        for (const v of rangeVals) if (_conditionMatch(criteria, v)) ++cnt;
        return String(cnt);
      }

      // ── Statistical ──
      case 'MEDIAN': { const n = nums().sort((a, b) => a - b); const m = Math.floor(n.length / 2); return String(n.length % 2 ? n[m] : (n.length ? (n[m - 1] + n[m]) / 2 : 0)); }
      case 'MODE': { const n = nums(); const freq = {}; for (const v of n) freq[v] = (freq[v] || 0) + 1; let best = n[0], bestCnt = 0; for (const [k, c] of Object.entries(freq)) if (c > bestCnt) { best = Number(k); bestCnt = c; } return String(best || 0); }
      case 'STDEV': case 'STDEVS': { const n = nums(); if (n.length < 2) return '0'; const avg = n.reduce((s, v) => s + v, 0) / n.length; return String(Math.sqrt(n.reduce((s, v) => s + (v - avg) ** 2, 0) / (n.length - 1))); }
      case 'STDEVP': { const n = nums(); if (!n.length) return '0'; const avg = n.reduce((s, v) => s + v, 0) / n.length; return String(Math.sqrt(n.reduce((s, v) => s + (v - avg) ** 2, 0) / n.length)); }
      case 'VAR': case 'VARS': { const n = nums(); if (n.length < 2) return '0'; const avg = n.reduce((s, v) => s + v, 0) / n.length; return String(n.reduce((s, v) => s + (v - avg) ** 2, 0) / (n.length - 1)); }
      case 'VARP': { const n = nums(); if (!n.length) return '0'; const avg = n.reduce((s, v) => s + v, 0) / n.length; return String(n.reduce((s, v) => s + (v - avg) ** 2, 0) / n.length); }
      case 'LARGE': { const p = a(); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => b - a); const k = _evalSubNum(p[1], deps, selfKey); return String(n[k - 1] || 0); }
      case 'SMALL': { const p = a(); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => a - b); const k = _evalSubNum(p[1], deps, selfKey); return String(n[k - 1] || 0); }
      case 'RANK': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey); const n = _collectRangeNumericValues(p[1].trim(), deps, selfKey).sort((a, b) => b - a); return String(n.indexOf(v) + 1 || 0); }
      case 'PERCENTILE': { const p = a(); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => a - b); const k = _evalSubNum(p[1], deps, selfKey); const idx = k * (n.length - 1); const lo = Math.floor(idx), hi = Math.ceil(idx); return String(lo === hi ? n[lo] : n[lo] + (n[hi] - n[lo]) * (idx - lo)); }
      case 'PERCENTRANK': { const p = a(); const v = _evalSubNum(p[1], deps, selfKey); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => a - b); if (!n.length) return '0'; let rank = 0; for (let i = 0; i < n.length; ++i) if (n[i] <= v) rank = i; return String(rank / (n.length - 1)); }
      case 'QUARTILE': { const p = a(); const n = _collectRangeNumericValues(p[0].trim(), deps, selfKey).sort((a, b) => a - b); const q = _evalSubNum(p[1], deps, selfKey); const idx = (q / 4) * (n.length - 1); const lo = Math.floor(idx), hi = Math.ceil(idx); return String(lo === hi ? n[lo] : n[lo] + (n[hi] - n[lo]) * (idx - lo)); }
      case 'CORREL': { const p = a(); const x = _collectRangeNumericValues(p[0].trim(), deps, selfKey), y = _collectRangeNumericValues(p[1].trim(), deps, selfKey); const len = Math.min(x.length, y.length); if (len < 2) return '0'; const mx = x.reduce((s, v) => s + v, 0) / len, my = y.reduce((s, v) => s + v, 0) / len; let num = 0, dx = 0, dy = 0; for (let i = 0; i < len; ++i) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return String(dx && dy ? num / Math.sqrt(dx * dy) : 0); }
      case 'FORECAST': { const p = a(); const xv = _evalSubNum(p[0], deps, selfKey); const yArr = _collectRangeNumericValues(p[1].trim(), deps, selfKey), xArr = _collectRangeNumericValues(p[2].trim(), deps, selfKey); const len = Math.min(xArr.length, yArr.length); if (!len) return '0'; const mx = xArr.reduce((s, v) => s + v, 0) / len, my = yArr.reduce((s, v) => s + v, 0) / len; let num = 0, den = 0; for (let i = 0; i < len; ++i) { num += (xArr[i] - mx) * (yArr[i] - my); den += (xArr[i] - mx) ** 2; } const b = den ? num / den : 0; return String(my + b * (xv - mx)); }
      case 'TREND': { const p = a(); const yArr = _collectRangeNumericValues(p[0].trim(), deps, selfKey); const xArr = p.length > 1 ? _collectRangeNumericValues(p[1].trim(), deps, selfKey) : yArr.map((_, i) => i + 1); const len = Math.min(xArr.length, yArr.length); const mx = xArr.reduce((s, v) => s + v, 0) / len, my = yArr.reduce((s, v) => s + v, 0) / len; let num = 0, den = 0; for (let i = 0; i < len; ++i) { num += (xArr[i] - mx) * (yArr[i] - my); den += (xArr[i] - mx) ** 2; } const b = den ? num / den : 0, a2 = my - b * mx; return String(a2 + b * (len + 1)); }
      case 'GROWTH': { const p = a(); const yArr = _collectRangeNumericValues(p[0].trim(), deps, selfKey); if (!yArr.length) return '0'; const last = yArr[yArr.length - 1], first = yArr[0]; return String(first ? last * (last / first) : 0); }

      // ── Text ──
      case 'LEFT': { const p = a(); const s = _evalSubStr(p[0], deps, selfKey); const n = p.length > 1 ? _evalSubNum(p[1], deps, selfKey) : 1; return '"' + s.substring(0, n) + '"'; }
      case 'RIGHT': { const p = a(); const s = _evalSubStr(p[0], deps, selfKey); const n = p.length > 1 ? _evalSubNum(p[1], deps, selfKey) : 1; return '"' + s.substring(s.length - n) + '"'; }
      case 'MID': { const p = a(); const s = _evalSubStr(p[0], deps, selfKey); const start = _evalSubNum(p[1], deps, selfKey) - 1; const n = _evalSubNum(p[2], deps, selfKey); return '"' + s.substring(start, start + n) + '"'; }
      case 'LEN': return String(String(_evalSub(args, deps, selfKey)).length);
      case 'FIND': { const p = a(); const needle = _evalSubStr(p[0], deps, selfKey), haystack = _evalSubStr(p[1], deps, selfKey); const start = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) - 1 : 0; const idx = haystack.indexOf(needle, start); return String(idx >= 0 ? idx + 1 : -1); }
      case 'SEARCH': { const p = a(); const needle = _evalSubStr(p[0], deps, selfKey).toLowerCase(), haystack = _evalSubStr(p[1], deps, selfKey).toLowerCase(); const start = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) - 1 : 0; const idx = haystack.indexOf(needle, start); return String(idx >= 0 ? idx + 1 : -1); }
      case 'SUBSTITUTE': { const p = a(); let s = _evalSubStr(p[0], deps, selfKey); const old = _evalSubStr(p[1], deps, selfKey), rep = _evalSubStr(p[2], deps, selfKey); if (p.length > 3) { const n = _evalSubNum(p[3], deps, selfKey); let cnt = 0, idx = 0; while ((idx = s.indexOf(old, idx)) >= 0) { if (++cnt === n) { s = s.substring(0, idx) + rep + s.substring(idx + old.length); break; } idx += old.length; } } else s = s.split(old).join(rep); return '"' + s + '"'; }
      case 'REPLACE': { const p = a(); const s = _evalSubStr(p[0], deps, selfKey); const start = _evalSubNum(p[1], deps, selfKey) - 1, len = _evalSubNum(p[2], deps, selfKey); const rep = _evalSubStr(p[3], deps, selfKey); return '"' + s.substring(0, start) + rep + s.substring(start + len) + '"'; }
      case 'TRIM': return '"' + _evalSubStr(args, deps, selfKey).trim().replace(/\s+/g, ' ') + '"';
      case 'CLEAN': return '"' + _evalSubStr(args, deps, selfKey).replace(/[\x00-\x1F]/g, '') + '"';
      case 'UPPER': return '"' + _evalSubStr(args, deps, selfKey).toUpperCase() + '"';
      case 'LOWER': return '"' + _evalSubStr(args, deps, selfKey).toLowerCase() + '"';
      case 'PROPER': return '"' + _evalSubStr(args, deps, selfKey).replace(/\b\w/g, c => c.toUpperCase()) + '"';
      case 'TEXT': { const p = a(); const v = _evalSubNum(p[0], deps, selfKey); const fmt = _evalSubStr(p[1], deps, selfKey); return '"' + formatNumberWithPattern(v, fmt) + '"'; }
      case 'VALUE': return String(Number(_evalSubStr(args, deps, selfKey)) || 0);
      case 'CONCATENATE': case 'CONCAT': { const p = a(); return '"' + p.map(x => _evalSubStr(x, deps, selfKey)).join('') + '"'; }
      case 'REPT': { const p = a(); return '"' + _evalSubStr(p[0], deps, selfKey).repeat(_evalSubNum(p[1], deps, selfKey)) + '"'; }
      case 'EXACT': { const p = a(); return String(_evalSubStr(p[0], deps, selfKey) === _evalSubStr(p[1], deps, selfKey)); }
      case 'CHAR': return '"' + String.fromCharCode(_evalSubNum(args, deps, selfKey)) + '"';
      case 'CODE': return String((_evalSubStr(args, deps, selfKey)).charCodeAt(0) || 0);
      case 'T': { const v = _evalSub(args, deps, selfKey); return typeof v === 'string' ? '"' + v + '"' : '""'; }

      // ── Date/Time ──
      case 'NOW': return String(Date.now());
      case 'TODAY': { const d = new Date(); d.setHours(0, 0, 0, 0); return String(d.getTime()); }
      case 'DATE': { const p = a(); return String(new Date(_evalSubNum(p[0], deps, selfKey), _evalSubNum(p[1], deps, selfKey) - 1, _evalSubNum(p[2], deps, selfKey)).getTime()); }
      case 'TIME': { const p = a(); return String((_evalSubNum(p[0], deps, selfKey) * 3600 + _evalSubNum(p[1], deps, selfKey) * 60 + _evalSubNum(p[2], deps, selfKey)) * 1000); }
      case 'YEAR': return String(new Date(_evalSubNum(args, deps, selfKey)).getFullYear());
      case 'MONTH': return String(new Date(_evalSubNum(args, deps, selfKey)).getMonth() + 1);
      case 'DAY': return String(new Date(_evalSubNum(args, deps, selfKey)).getDate());
      case 'HOUR': return String(new Date(_evalSubNum(args, deps, selfKey)).getHours());
      case 'MINUTE': return String(new Date(_evalSubNum(args, deps, selfKey)).getMinutes());
      case 'SECOND': return String(new Date(_evalSubNum(args, deps, selfKey)).getSeconds());
      case 'WEEKDAY': return String(new Date(_evalSubNum(args, deps, selfKey)).getDay() + 1);
      case 'WEEKNUM': { const d = new Date(_evalSubNum(args, deps, selfKey)); const start = new Date(d.getFullYear(), 0, 1); return String(Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)); }
      case 'DATEDIF': { const p = a(); const d1 = new Date(_evalSubNum(p[0], deps, selfKey)), d2 = new Date(_evalSubNum(p[1], deps, selfKey)); const unit = _evalSubStr(p[2], deps, selfKey).toUpperCase(); if (unit === 'D') return String(Math.floor((d2 - d1) / 86400000)); if (unit === 'M') return String((d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth()); if (unit === 'Y') return String(d2.getFullYear() - d1.getFullYear()); return '0'; }
      case 'DATEVALUE': return String(new Date(_evalSubStr(args, deps, selfKey)).getTime() || 0);
      case 'TIMEVALUE': { const p = _evalSubStr(args, deps, selfKey).split(':'); return String(((Number(p[0]) || 0) * 3600 + (Number(p[1]) || 0) * 60 + (Number(p[2]) || 0)) * 1000); }
      case 'EOMONTH': { const p = a(); const d = new Date(_evalSubNum(p[0], deps, selfKey)); const months = _evalSubNum(p[1], deps, selfKey); d.setMonth(d.getMonth() + months + 1, 0); return String(d.getTime()); }
      case 'EDATE': { const p = a(); const d = new Date(_evalSubNum(p[0], deps, selfKey)); d.setMonth(d.getMonth() + _evalSubNum(p[1], deps, selfKey)); return String(d.getTime()); }
      case 'NETWORKDAYS': { const p = a(); const d1 = new Date(_evalSubNum(p[0], deps, selfKey)), d2 = new Date(_evalSubNum(p[1], deps, selfKey)); let cnt = 0; const cur = new Date(d1); while (cur <= d2) { const dow = cur.getDay(); if (dow !== 0 && dow !== 6) ++cnt; cur.setDate(cur.getDate() + 1); } return String(cnt); }
      case 'WORKDAY': { const p = a(); const d = new Date(_evalSubNum(p[0], deps, selfKey)); let days = _evalSubNum(p[1], deps, selfKey); while (days > 0) { d.setDate(d.getDate() + 1); const dow = d.getDay(); if (dow !== 0 && dow !== 6) --days; } return String(d.getTime()); }

      // ── Logical ──
      case 'IF': { const p = a(); const cond = _evalSub(p[0], deps, selfKey); return (cond && cond !== 0 && cond !== '0' && cond !== '' && cond !== false) ? _cellValueToJS(_evalSub(p[1], deps, selfKey)) : (p.length > 2 ? _cellValueToJS(_evalSub(p[2], deps, selfKey)) : '0'); }
      case 'AND': { const p = a(); for (const x of p) { const v = _evalSub(x, deps, selfKey); if (!v || v === 0 || v === '0' || v === false) return 'false'; } return 'true'; }
      case 'OR': { const p = a(); for (const x of p) { const v = _evalSub(x, deps, selfKey); if (v && v !== 0 && v !== '0' && v !== false) return 'true'; } return 'false'; }
      case 'NOT': { const v = _evalSub(args, deps, selfKey); return (!v || v === 0 || v === '0' || v === false) ? 'true' : 'false'; }
      case 'TRUE': return 'true';
      case 'FALSE': return 'false';
      case 'IFERROR': { const p = a(); try { const v = evalExpression(p[0].trim(), deps, selfKey); if (typeof v === 'string' && v.startsWith('#')) return _cellValueToJS(_evalSub(p[1], deps, selfKey)); return _cellValueToJS(v); } catch { return _cellValueToJS(_evalSub(p[1], deps, selfKey)); } }
      case 'IFNA': { const p = a(); try { const v = evalExpression(p[0].trim(), deps, selfKey); if (v === '#N/A') return _cellValueToJS(_evalSub(p[1], deps, selfKey)); return _cellValueToJS(v); } catch { return _cellValueToJS(_evalSub(p[1], deps, selfKey)); } }
      case 'IFS': { const p = a(); for (let i = 0; i < p.length - 1; i += 2) { const c = _evalSub(p[i], deps, selfKey); if (c && c !== 0 && c !== '0' && c !== false) return _cellValueToJS(_evalSub(p[i + 1], deps, selfKey)); } return '"#N/A"'; }
      case 'SWITCH': { const p = a(); const v = _evalSub(p[0], deps, selfKey); for (let i = 1; i < p.length - 1; i += 2) if (_evalSub(p[i], deps, selfKey) == v) return _cellValueToJS(_evalSub(p[i + 1], deps, selfKey)); return p.length % 2 === 0 ? _cellValueToJS(_evalSub(p[p.length - 1], deps, selfKey)) : '"#N/A"'; }

      // ── Lookup ──
      case 'VLOOKUP': { const p = a(); const sv = _evalSub(p[0], deps, selfKey); const rows = _getRangeArray(p[1].trim(), deps, selfKey); const ci = _evalSubNum(p[2], deps, selfKey) - 1; for (const row of rows) if (row[0] == sv && ci < row.length) return _cellValueToJS(row[ci]); return '"#N/A"'; }
      case 'HLOOKUP': { const p = a(); const sv = _evalSub(p[0], deps, selfKey); const rows = _getRangeArray(p[1].trim(), deps, selfKey); const ri = _evalSubNum(p[2], deps, selfKey) - 1; if (!rows.length) return '"#N/A"'; for (let c = 0; c < rows[0].length; ++c) if (rows[0][c] == sv && ri < rows.length) return _cellValueToJS(rows[ri][c]); return '"#N/A"'; }
      case 'INDEX': { const p = a(); const rows = _getRangeArray(p[0].trim(), deps, selfKey); const ri = _evalSubNum(p[1], deps, selfKey) - 1; const ci = p.length > 2 ? _evalSubNum(p[2], deps, selfKey) - 1 : 0; return (rows[ri] && rows[ri][ci] !== undefined) ? _cellValueToJS(rows[ri][ci]) : '0'; }
      case 'MATCH': { const p = a(); const sv = _evalSub(p[0], deps, selfKey); const v = _collectRangeValues(p[1].trim(), deps, selfKey); for (let i = 0; i < v.length; ++i) if (v[i] == sv) return String(i + 1); return '"#N/A"'; }
      case 'OFFSET': return '0';
      case 'INDIRECT': { const ref = _evalSubStr(args, deps, selfKey); const p = parseKey(ref); if (!p) return '0'; deps.push(ref); return _cellValueToJS(getCellValue(p.col, p.row)); }
      case 'CHOOSE': { const p = a(); const idx = _evalSubNum(p[0], deps, selfKey); return (idx >= 1 && idx < p.length) ? _cellValueToJS(_evalSub(p[idx], deps, selfKey)) : '0'; }
      case 'ROW': { if (!args.trim()) return String(parseKey(selfKey)?.row + 1 || 0); const p = parseKey(args.trim()); return String(p ? p.row + 1 : 0); }
      case 'COLUMN': { if (!args.trim()) return String(parseKey(selfKey)?.col + 1 || 0); const p = parseKey(args.trim()); return String(p ? p.col + 1 : 0); }
      case 'ROWS': { const rm = args.trim().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i); return String(rm ? Math.abs(parseInt(rm[4], 10) - parseInt(rm[2], 10)) + 1 : 1); }
      case 'COLUMNS': { const rm = args.trim().match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i); return String(rm ? Math.abs(colIndex(rm[3].toUpperCase()) - colIndex(rm[1].toUpperCase())) + 1 : 1); }
      case 'TRANSPOSE': return '0';

      // ── Financial ──
      case 'PMT': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey), n = _evalSubNum(p[1], deps, selfKey), pv = _evalSubNum(p[2], deps, selfKey); if (r === 0) return String(-pv / n); return String(-pv * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)); }
      case 'PV': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey), n = _evalSubNum(p[1], deps, selfKey), pmt = _evalSubNum(p[2], deps, selfKey); if (r === 0) return String(-pmt * n); return String(-pmt * (1 - Math.pow(1 + r, -n)) / r); }
      case 'FV': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey), n = _evalSubNum(p[1], deps, selfKey), pmt = _evalSubNum(p[2], deps, selfKey); const pv = p.length > 3 ? _evalSubNum(p[3], deps, selfKey) : 0; if (r === 0) return String(-pv - pmt * n); return String(-pv * Math.pow(1 + r, n) - pmt * (Math.pow(1 + r, n) - 1) / r); }
      case 'NPER': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey), pmt = _evalSubNum(p[1], deps, selfKey), pv = _evalSubNum(p[2], deps, selfKey); if (r === 0) return String(-pv / pmt); return String(Math.log(-pmt / (pv * r - pmt)) / Math.log(1 + r)); }
      case 'RATE': { const p = a(); const n = _evalSubNum(p[0], deps, selfKey), pmt = _evalSubNum(p[1], deps, selfKey), pv = _evalSubNum(p[2], deps, selfKey); let rate = 0.1; for (let i = 0; i < 100; ++i) { const f = pv * Math.pow(1 + rate, n) + pmt * (Math.pow(1 + rate, n) - 1) / rate; const df = n * pv * Math.pow(1 + rate, n - 1) + pmt * (n * Math.pow(1 + rate, n - 1) * rate - Math.pow(1 + rate, n) + 1) / (rate * rate); rate -= f / df; } return String(rate); }
      case 'NPV': { const p = a(); const r = _evalSubNum(p[0], deps, selfKey); const cf = p.slice(1).map(x => _evalSubNum(x, deps, selfKey)); let npv = 0; for (let i = 0; i < cf.length; ++i) npv += cf[i] / Math.pow(1 + r, i + 1); return String(npv); }
      case 'IRR': { const p = a(); const cf = _collectRangeNumericValues(p[0].trim(), deps, selfKey); let rate = 0.1; for (let iter = 0; iter < 200; ++iter) { let f = 0, df = 0; for (let i = 0; i < cf.length; ++i) { f += cf[i] / Math.pow(1 + rate, i); df -= i * cf[i] / Math.pow(1 + rate, i + 1); } if (Math.abs(f) < 1e-10) break; rate -= f / df; } return String(rate); }
      case 'SLN': { const p = a(); const cost = _evalSubNum(p[0], deps, selfKey), salvage = _evalSubNum(p[1], deps, selfKey), life = _evalSubNum(p[2], deps, selfKey); return String(life ? (cost - salvage) / life : 0); }
      case 'DB': { const p = a(); const cost = _evalSubNum(p[0], deps, selfKey), salvage = _evalSubNum(p[1], deps, selfKey), life = _evalSubNum(p[2], deps, selfKey), period = _evalSubNum(p[3], deps, selfKey); const rate = 1 - Math.pow(salvage / cost, 1 / life); let val = cost; for (let i = 1; i < period; ++i) val -= val * rate; return String(val * rate); }
      case 'DDB': { const p = a(); const cost = _evalSubNum(p[0], deps, selfKey), salvage = _evalSubNum(p[1], deps, selfKey), life = _evalSubNum(p[2], deps, selfKey), period = _evalSubNum(p[3], deps, selfKey); const factor = p.length > 4 ? _evalSubNum(p[4], deps, selfKey) : 2; let val = cost; for (let i = 1; i < period; ++i) { const dep = val * factor / life; val -= Math.min(dep, val - salvage); } return String(Math.min(val * factor / life, val - salvage)); }

      // ── Info ──
      case 'ISBLANK': { const v = _evalSub(args, deps, selfKey); return String(v === '' || v === null || v === undefined); }
      case 'ISERROR': { try { const v = evalExpression(args.trim(), deps, selfKey); return String(typeof v === 'string' && v.startsWith('#')); } catch { return 'true'; } }
      case 'ISNUMBER': return String(typeof _evalSub(args, deps, selfKey) === 'number');
      case 'ISTEXT': return String(typeof _evalSub(args, deps, selfKey) === 'string');
      case 'ISLOGICAL': { const v = _evalSub(args, deps, selfKey); return String(v === true || v === false); }
      case 'TYPE': { const v = _evalSub(args, deps, selfKey); if (typeof v === 'number') return '1'; if (typeof v === 'string') return '2'; if (typeof v === 'boolean') return '4'; return '0'; }
      case 'NA': return '"#N/A"';
      case 'ERROR.TYPE': case 'ERRORTYPE': { try { const v = evalExpression(args.trim(), deps, selfKey); if (typeof v === 'string') { if (v === '#N/A') return '7'; if (v === '#VALUE!') return '3'; if (v === '#REF!') return '4'; if (v === '#NAME?') return '5'; if (v === '#DIV/0!') return '2'; if (v === '#NULL!') return '1'; } return '"#N/A"'; } catch { return '1'; } }

      default: return '0';
    }
  }

  function formatNumberWithPattern(val, fmt) {
    if (fmt === '0.00') return val.toFixed(2);
    if (fmt === '#,##0') return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (fmt === '#,##0.00') return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (fmt === '0%') return (val * 100).toFixed(0) + '%';
    if (fmt === '0.00%') return (val * 100).toFixed(2) + '%';
    return String(val);
  }

  // ── Number formatting ──────────────────────────────────────────────
  function formatDisplayValue(val, fmt) {
    if (val === '' || val === null || val === undefined) return '';
    const nfmt = (fmt && fmt.numberFmt) || 'general';
    const decimals = (fmt && typeof fmt.decimals === 'number') ? fmt.decimals : 2;
    const thousands = fmt && fmt.thousands;
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
      if (S().comments[cellKey(c, r)]) td.classList.add('has-comment');
      if (S().hyperlinks[cellKey(c, r)]) td.classList.add('has-hyperlink');
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
        case 'icon-3-arrows': case 'icon-3-traffic': case 'icon-3-flags': case 'icon-5-rating': {
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
              case 'icon-3-traffic': icon = pct >= 0.67 ? '\uD83D\uDFE2' : pct >= 0.33 ? '\uD83D\uDFE1' : '\uD83D\uDD34'; break;
              case 'icon-3-flags': icon = pct >= 0.67 ? '\uD83D\uDFE9' : pct >= 0.33 ? '\uD83D\uDFE8' : '\uD83D\uDFE5'; break;
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
      }
      if (match) td.style.backgroundColor = rule.color;
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
    const val = getCellValue(col, row);
    const err = getCellError(col, row);
    const fmt = getFormat(col, row);
    let display;
    if (showFormulas) display = getCellRaw(col, row);
    else display = err ? String(val) : formatDisplayValue(val, fmt);
    td.textContent = display;
    td.classList.toggle('error', !!err);
  }

  function renderCellContent(col, row) {
    const td = getCellElement(col, row);
    if (!td) return;
    applyCellStyle(td, col, row);
    updateCellDisplay(td, col, row);
    applyConditionalFormat(td, col, row);
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
    formulaInput.value = getCellRaw(activeCell.col, activeCell.row);
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
    document.getElementById('sel-font-size').value = fmt.fontSize || '11';
    document.getElementById('sel-font-family').value = fmt.fontFamily || 'Tahoma, Verdana, sans-serif';
    document.getElementById('sel-number-format').value = fmt.numberFmt || 'general';
    document.getElementById('btn-show-formulas').classList.toggle('active', showFormulas);
  }

  function updateStatusSummary() {
    const rect = getSelectionRect();
    const vals = [];
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const v = getCellValue(c, r);
        if (typeof v === 'number') vals.push(v);
        else if (typeof v === 'string' && v !== '') { const n = parseFloat(v); if (!isNaN(n)) vals.push(n); }
      }
    if (vals.length > 1) {
      const sum = vals.reduce((a, b) => a + b, 0);
      statusSummary.textContent = 'Sum: ' + sum.toFixed(2) + '  Avg: ' + (sum / vals.length).toFixed(2) + '  Count: ' + vals.length;
    } else statusSummary.textContent = '';
  }

  // ── Cell editing ───────────────────────────────────────────────────
  function startEditing(col, row, initialValue) {
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
      if (e.key === 'Enter') { e.preventDefault(); finishEditing(); moveCursor(0, 1); }
      else if (e.key === 'Tab') { e.preventDefault(); finishEditing(); moveCursor(e.shiftKey ? -1 : 1, 0); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
    });
    statusCell.textContent = 'Edit';
  }

  function finishEditing() {
    if (!isEditing) return;
    isEditing = false;
    const td = getCellElement(activeCell.col, activeCell.row);
    if (!td) return;
    const input = td.querySelector('.cell-editor');
    if (!input) return;
    const newVal = input.value;
    const oldVal = getCellRaw(activeCell.col, activeCell.row);
    const oldFmt = Object.assign({}, getFormat(activeCell.col, activeCell.row));
    if (newVal !== oldVal) {
      pushUndo({ type: 'cell', col: activeCell.col, row: activeCell.row, oldVal, newVal, oldFmt, newFmt: Object.assign({}, oldFmt) });
      setCellData(activeCell.col, activeCell.row, newVal);
      recalcDependents(cellKey(activeCell.col, activeCell.row));
      setDirty(true);
    }
    td.classList.remove('editing');
    input.remove();
    renderCellContent(activeCell.col, activeCell.row);
    formulaInput.value = getCellRaw(activeCell.col, activeCell.row);
    statusCell.textContent = 'Ready';
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
    if (!clipboard) return;
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

  // ── Color palette ──────────────────────────────────────────────────
  function buildColorPalette() {
    colorPalette.innerHTML = '';
    for (const color of PALETTE_COLORS) {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color;
      swatch.addEventListener('click', () => { hideColorPalette(); if (colorCallback) colorCallback(color); });
      colorPalette.appendChild(swatch);
    }
  }

  function showColorPalette(anchorEl, callback) {
    colorCallback = callback;
    const rect = anchorEl.getBoundingClientRect();
    colorPalette.style.left = rect.left + 'px';
    colorPalette.style.top = rect.bottom + 'px';
    colorPalette.classList.add('visible');
  }

  function hideColorPalette() { colorPalette.classList.remove('visible'); colorCallback = null; }

  document.addEventListener('pointerdown', (e) => {
    if (!colorPalette.contains(e.target) && !e.target.closest('.ribbon-color-btn')) hideColorPalette();
  });
  buildColorPalette();

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
    // Fill handle drag
    if (e.target.closest('.fill-handle')) {
      e.preventDefault();
      const startCol = activeCell.col, startRow = activeCell.row;
      const startVal = getCellRaw(startCol, startRow);
      const onMove = (me) => {
        const target = document.elementFromPoint(me.clientX, me.clientY);
        const td = target && target.closest('td.cell');
        if (td) selectionEnd = { col: parseInt(td.dataset.col, 10), row: parseInt(td.dataset.row, 10) };
        updateSelectionDisplay();
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const rect = getSelectionRect();
        const actions = [];
        for (let r = rect.r1; r <= rect.r2; ++r)
          for (let c = rect.c1; c <= rect.c2; ++c) {
            if (c === startCol && r === startRow) continue;
            const oldVal = getCellRaw(c, r);
            actions.push({ type: 'cell', col: c, row: r, oldVal, newVal: startVal, oldFmt: Object.assign({}, getFormat(c, r)), newFmt: Object.assign({}, getFormat(c, r)) });
            setCellData(c, r, startVal);
            recalcDependents(cellKey(c, r));
            renderCellContent(c, r);
          }
        if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      return;
    }

    const td = e.target.closest('td.cell');
    if (!td) return;
    const col = parseInt(td.dataset.col, 10), row = parseInt(td.dataset.row, 10);
    if (isEditing) finishEditing();

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
      }
      return;
    }
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); e.shiftKey ? extendSelection(0, -1) : moveCursor(0, -1); break;
      case 'ArrowDown': e.preventDefault(); e.shiftKey ? extendSelection(0, 1) : moveCursor(0, 1); break;
      case 'ArrowLeft': e.preventDefault(); e.shiftKey ? extendSelection(-1, 0) : moveCursor(-1, 0); break;
      case 'ArrowRight': e.preventDefault(); e.shiftKey ? extendSelection(1, 0) : moveCursor(1, 0); break;
      case 'Tab': e.preventDefault(); moveCursor(e.shiftKey ? -1 : 1, 0); break;
      case 'Enter': e.preventDefault(); moveCursor(0, 1); break;
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
      const newVal = formulaInput.value, oldVal = getCellRaw(activeCell.col, activeCell.row);
      if (newVal !== oldVal) {
        pushUndo({ type: 'cell', col: activeCell.col, row: activeCell.row, oldVal, newVal, oldFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)), newFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)) });
        setCellData(activeCell.col, activeCell.row, newVal);
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

  cellRefInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const p = parseKey(cellRefInput.value.trim().toUpperCase());
      if (p) {
        if (p.col >= totalCols()) S().maxUsedCol = p.col;
        if (p.row >= totalRows()) S().maxUsedRow = p.row;
        if (p.col >= totalCols() || p.row >= totalRows()) rebuildGrid();
        selectCell(p.col, p.row);
        scrollCellIntoView(p.col, p.row);
      }
      gridScroll.focus();
    }
  });

  // ── Ribbon tab switching ───────────────────────────────────────────
  for (const tab of ribbonTabs.querySelectorAll('.ribbon-tab')) {
    tab.addEventListener('click', () => {
      ribbonTabs.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.ribbon-panel').forEach(p => p.classList.remove('active'));
      const panel = document.querySelector('.ribbon-panel[data-panel="' + tab.dataset.tab + '"]');
      if (panel) panel.classList.add('active');
    });
  }

  // ── Backstage ──────────────────────────────────────────────────────
  const backstage = document.getElementById('backstage');
  const ribbonFileBtn = document.getElementById('ribbon-file-btn');
  const backstageBack = document.getElementById('backstage-back');

  ribbonFileBtn.addEventListener('click', () => backstage.classList.add('visible'));
  backstageBack.addEventListener('click', () => backstage.classList.remove('visible'));
  backstage.addEventListener('pointerdown', (e) => {
    if (e.target === backstage)
      backstage.classList.remove('visible');
  });
  for (const item of backstage.querySelectorAll('.backstage-item')) {
    item.addEventListener('click', () => {
      backstage.classList.remove('visible');
      handleAction(item.dataset.action);
    });
  }

  // ── QAT buttons ───────────────────────────────────────────────────
  for (const btn of document.querySelectorAll('.qat-btn[data-action]'))
    btn.addEventListener('click', () => handleAction(btn.dataset.action));

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

  // All ribbon buttons with data-action
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.rb-btn[data-action]');
    if (!btn) return;
    handleAction(btn.dataset.action);
  });

  // ── Ribbon selects ─────────────────────────────────────────────────
  document.getElementById('sel-font-size').addEventListener('change', (e) => applyFormatToSelection('fontSize', parseInt(e.target.value, 10)));
  document.getElementById('sel-font-family').addEventListener('change', (e) => applyFormatToSelection('fontFamily', e.target.value));
  document.getElementById('sel-number-format').addEventListener('change', (e) => {
    applyFormatToSelection('numberFmt', e.target.value);
    const rect = getSelectionRect();
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) renderCellContent(c, r);
  });

  // ── Sheet tabs ─────────────────────────────────────────────────────
  function renderSheetTabs() {
    const tabs = sheetTabsEl.querySelectorAll('.sheet-tab');
    tabs.forEach(t => t.remove());
    const addBtn = document.getElementById('sheet-add');
    for (let i = 0; i < sheets.length; ++i) {
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

  // ── Charts ─────────────────────────────────────────────────────────
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

    showDialog('dlg-chart');
    document.getElementById('chart-title').textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' Chart';
    const canvas = document.getElementById('chart-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width, H = canvas.height;
    const pad = 40;
    const maxVal = Math.max(...data.map(Math.abs), 1);
    const colors = ['#4472c4','#ed7d31','#a5a5a5','#ffc000','#5b9bd5','#70ad47','#264478','#9b57a0'];

    if (type === 'bar') {
      const barW = (W - 2 * pad) / data.length;
      for (let i = 0; i < data.length; ++i) {
        const barH = (data[i] / maxVal) * (H - 2 * pad);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(pad + i * barW + 4, H - pad - barH, barW - 8, barH);
        ctx.fillStyle = '#333'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(labels[i], pad + i * barW + barW / 2, H - pad + 12);
      }
    } else if (type === 'line') {
      ctx.beginPath(); ctx.strokeStyle = colors[0]; ctx.lineWidth = 2;
      for (let i = 0; i < data.length; ++i) {
        const x = pad + i * (W - 2 * pad) / (data.length - 1 || 1);
        const y = H - pad - (data[i] / maxVal) * (H - 2 * pad);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let i = 0; i < data.length; ++i) {
        const x = pad + i * (W - 2 * pad) / (data.length - 1 || 1);
        const y = H - pad - (data[i] / maxVal) * (H - 2 * pad);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = colors[0]; ctx.fill();
      }
    } else if (type === 'pie') {
      const total = data.reduce((s, v) => s + Math.abs(v), 0) || 1;
      let angle = -Math.PI / 2;
      const cx = W / 2, cy = H / 2, radius = Math.min(W, H) / 2 - pad;
      for (let i = 0; i < data.length; ++i) {
        const slice = (Math.abs(data[i]) / total) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, angle, angle + slice); ctx.closePath();
        ctx.fillStyle = colors[i % colors.length]; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        angle += slice;
      }
    } else if (type === 'scatter') {
      for (let i = 0; i < data.length; ++i) {
        const x = pad + (i / (data.length - 1 || 1)) * (W - 2 * pad);
        const y = H - pad - (data[i] / maxVal) * (H - 2 * pad);
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      }
    } else if (type === 'area') {
      ctx.beginPath(); ctx.moveTo(pad, H - pad);
      for (let i = 0; i < data.length; ++i) {
        const x = pad + i * (W - 2 * pad) / (data.length - 1 || 1);
        const y = H - pad - (data[i] / maxVal) * (H - 2 * pad);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(pad + (data.length - 1) * (W - 2 * pad) / (data.length - 1 || 1), H - pad);
      ctx.closePath(); ctx.fillStyle = 'rgba(68,114,196,0.3)'; ctx.fill();
      ctx.strokeStyle = colors[0]; ctx.lineWidth = 2; ctx.stroke();
    }
  }

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

  // ── Dialog helper ──────────────────────────────────────────────────
  function showDialog(id) {
    const overlay = document.getElementById(id);
    overlay.classList.add('visible');
    return new Promise((resolve) => {
      function handleClick(e) {
        const btn = e.target.closest('[data-result]');
        if (!btn) return;
        overlay.classList.remove('visible');
        overlay.removeEventListener('click', handleClick);
        resolve(btn.dataset.result);
      }
      overlay.addEventListener('click', handleClick);
    });
  }

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
    currentFilePath = null; currentFileName = 'Untitled'; dirty = false;
    activeCell = { col: 0, row: 0 }; selectionStart = { col: 0, row: 0 }; selectionEnd = { col: 0, row: 0 }; multiSelections = [];
    rebuildGrid(); renderSheetTabs(); updateTitle();
  }

  function rebuildGrid() {
    renderedRows.clear(); gridBody.innerHTML = '';
    buildColumnHeaders();
    visibleRowStart = -1; visibleRowEnd = -1;
    renderVisibleRows(); updateSelectionDisplay();
  }

  async function doOpen() {
    if (isEditing) finishEditing();
    const result = await ComDlg32.GetOpenFileName({ filters: FILE_FILTERS, initialDir: '/user/documents', title: 'Open' });
    if (!result.cancelled && result.path) {
      let content = '';
      try { content = await Kernel32.ReadFile(result.path); } catch (err) { await User32.MessageBox('Could not open file: ' + err.message, 'Spreadsheet', MB_OK); return; }
      loadDelimited(result.path, content);
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
    try { await Kernel32.WriteFile(currentFilePath, toCSV()); } catch (err) { await User32.MessageBox('Could not save: ' + err.message, 'Spreadsheet', MB_OK); return; }
    setDirty(false);
  }

  async function doSaveAs() {
    const result = await ComDlg32.GetSaveFileName({ filters: FILE_FILTERS, initialDir: '/user/documents', defaultName: currentFileName || 'Untitled.csv', title: 'Save As' });
    if (!result.cancelled && result.path) {
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';
      try { await Kernel32.WriteFile(currentFilePath, toCSV()); } catch (err) { await User32.MessageBox('Could not save: ' + err.message, 'Spreadsheet', MB_OK); return; }
      setDirty(false);
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

  // ── Main action handler ────────────────────────────────────────────
  function handleAction(action) {
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
      case 'merge-cells': {
        const rect = getSelectionRect();
        const existing = S().mergedCells.findIndex(m => m.c1 === rect.c1 && m.r1 === rect.r1 && m.c2 === rect.c2 && m.r2 === rect.r2);
        if (existing >= 0) S().mergedCells.splice(existing, 1);
        else S().mergedCells.push(rect);
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
      case 'insert-function': {
        showInsertFunctionDialog('all');
        document.getElementById('fn-insert-ok').onclick = () => {
          const sel = document.getElementById('fn-list').value;
          if (sel) { startEditing(activeCell.col, activeCell.row, '=' + sel + '('); }
          document.getElementById('dlg-insert-function').classList.remove('visible');
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
        if (action === 'trace-precedents' && d && d.deps) refs = d.deps;
        else if (action === 'trace-dependents' && S().depGraph[key]) refs = [...S().depGraph[key]];
        if (refs.length) {
          multiSelections = [];
          for (const ref of refs) { const p = parseKey(ref); if (p) multiSelections.push({ c1: p.col, r1: p.row, c2: p.col, r2: p.row }); }
          updateSelectionDisplay();
        }
        break;
      }
      case 'show-formulas': showFormulas = !showFormulas; rebuildGrid(); break;
      case 'error-checking': {
        let errors = [];
        for (const key in S().cellData) if (S().cellData[key].error) errors.push(key);
        User32.MessageBox(errors.length ? 'Errors found in: ' + errors.join(', ') : 'No errors found.', 'Error Checking', MB_OK);
        break;
      }
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
      case 'text-to-columns': {
        showPrompt('Text to Columns', 'Delimiter (e.g. , or ;):', ',').then(delim => {
          if (!delim) return;
          const rect = getSelectionRect();
          for (let r = rect.r1; r <= rect.r2; ++r) {
            const raw = getCellRaw(rect.c1, r);
            const parts = raw.split(delim);
            for (let i = 0; i < parts.length; ++i) {
              setCellData(rect.c1 + i, r, parts[i].trim());
              renderCellContent(rect.c1 + i, r);
            }
          }
          setDirty(true);
        });
        break;
      }
      case 'remove-duplicates': {
        const rect = getSelectionRect();
        const seen = new Set();
        const toHide = [];
        for (let r = rect.r1; r <= rect.r2; ++r) {
          let key = '';
          for (let c = rect.c1; c <= rect.c2; ++c) key += getCellRaw(c, r) + '\x00';
          if (seen.has(key)) toHide.push(r); else seen.add(key);
        }
        const actions = [];
        for (const r of toHide)
          for (let c = rect.c1; c <= rect.c2; ++c) {
            actions.push({ type: 'cell', col: c, row: r, oldVal: getCellRaw(c, r), newVal: '', oldFmt: Object.assign({}, getFormat(c, r)), newFmt: Object.assign({}, getFormat(c, r)) });
            setCellData(c, r, '');
          }
        if (actions.length) { pushUndo({ type: 'multi', actions }); setDirty(true); }
        rebuildGrid();
        User32.MessageBox(toHide.length + ' duplicate row(s) removed.', 'Remove Duplicates', MB_OK);
        break;
      }
      case 'data-validation': User32.MessageBox('Data validation rules can be set via Format Cells dialog.', 'Data Validation', MB_OK); break;
      case 'group-rows': { const rect = getSelectionRect(); for (let r = rect.r1 + 1; r <= rect.r2; ++r) S().hiddenRows.add(r); rebuildGrid(); break; }
      case 'ungroup-rows': { S().hiddenRows.clear(); rebuildGrid(); break; }
      case 'group-cols': { const rect = getSelectionRect(); for (let c = rect.c1 + 1; c <= rect.c2; ++c) S().hiddenCols.add(c); rebuildGrid(); break; }
      case 'ungroup-cols': { S().hiddenCols.clear(); rebuildGrid(); break; }
      case 'cond-format': {
        const cfRuleSel = document.getElementById('cf-rule');
        const cfUpdateVisibility = () => {
          const v = cfRuleSel.value;
          const isIcon = v.startsWith('icon-');
          const isDataBar = v === 'data-bar';
          const isColorScale = v === 'color-scale-2' || v === 'color-scale-3';
          const needsValue = !isIcon && !isDataBar && !isColorScale && v !== 'duplicate';
          document.getElementById('cf-value1-row').style.display = needsValue ? '' : 'none';
          document.getElementById('cf-value2-row').style.display = v === 'between' ? '' : 'none';
          document.getElementById('cf-color-row').style.display = (!isIcon && !isColorScale) ? '' : 'none';
          document.getElementById('cf-color-scale-row').style.display = isColorScale ? '' : 'none';
          document.getElementById('cf-color-mid-row').style.display = v === 'color-scale-3' ? '' : 'none';
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
            S().conditionalRules.push(rule);
            rebuildGrid(); setDirty(true);
          } else if (r === 'clear') { S().conditionalRules.length = 0; rebuildGrid(); setDirty(true); }
        });
        break;
      }
      case 'cell-styles': {
        const grid = document.getElementById('cell-styles-grid');
        grid.innerHTML = '';
        for (const style of CELL_STYLES) {
          const item = document.createElement('div');
          item.className = 'cell-style-item';
          item.textContent = style.name;
          Object.assign(item.style, {
            backgroundColor: style.fmt.bgColor || '',
            color: style.fmt.textColor || '',
            fontWeight: style.fmt.bold ? 'bold' : '',
            fontSize: style.fmt.fontSize ? style.fmt.fontSize + 'px' : '',
          });
          item.addEventListener('click', () => {
            const rect = getSelectionRect();
            for (let r = rect.r1; r <= rect.r2; ++r)
              for (let c = rect.c1; c <= rect.c2; ++c) {
                S().cellFormats[cellKey(c, r)] = Object.assign({}, getFormat(c, r), style.fmt);
                renderCellContent(c, r);
              }
            document.getElementById('dlg-cell-styles').classList.remove('visible');
            setDirty(true);
          });
          grid.appendChild(item);
        }
        showDialog('dlg-cell-styles');
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
            document.getElementById('dlg-table-styles').classList.remove('visible');
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
        document.getElementById('fc-font-family').value = fmt.fontFamily || '';
        document.getElementById('fc-font-size').value = fmt.fontSize || 11;
        document.getElementById('fc-bold').checked = !!fmt.bold;
        document.getElementById('fc-italic').checked = !!fmt.italic;
        document.getElementById('fc-underline').checked = !!fmt.underline;
        document.getElementById('fc-strikethrough').checked = !!fmt.strikethrough;
        document.getElementById('fc-fill-color').value = fmt.bgColor || '#ffffff';
        document.getElementById('fc-fill-none').onclick = () => { document.getElementById('fc-fill-color').value = '#ffffff'; };
        showDialog('dlg-format-cells').then(r => {
          if (r !== 'ok') return;
          const newFmt = {
            numberFmt: document.getElementById('fc-numfmt').value,
            decimals: parseInt(document.getElementById('fc-decimals').value, 10),
            align: document.getElementById('fc-halign').value || undefined,
            valign: document.getElementById('fc-valign').value || undefined,
            wrapText: document.getElementById('fc-wrap').checked || undefined,
            fontFamily: document.getElementById('fc-font-family').value || undefined,
            fontSize: parseInt(document.getElementById('fc-font-size').value, 10) || undefined,
            bold: document.getElementById('fc-bold').checked || undefined,
            italic: document.getElementById('fc-italic').checked || undefined,
            underline: document.getElementById('fc-underline').checked || undefined,
            strikethrough: document.getElementById('fc-strikethrough').checked || undefined,
          };
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
      case 'row-autofit': break;
      case 'row-hide': S().hiddenRows.add(activeCell.row); rebuildGrid(); break;
      case 'row-unhide': S().hiddenRows.clear(); rebuildGrid(); break;
      case 'sheet-rename': showPrompt('Rename Sheet', 'New name:', S().name).then(n => { if (n && n.trim()) { S().name = n.trim(); renderSheetTabs(); setDirty(true); } }); break;
      case 'sheet-tab-color': showColorPalette(sheetTabsEl, (c) => { S().tabColor = c; renderSheetTabs(); }); break;
      case 'freeze-panes': S().freezeRow = activeCell.row; S().freezeCol = activeCell.col; break;
      case 'unfreeze-panes': S().freezeRow = 0; S().freezeCol = 0; break;
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
      case 'about': showDialog('dlg-about'); break;
    }
  }

  // ── Initialization ─────────────────────────────────────────────────
  buildColumnHeaders();
  renderVisibleRows();
  selectCell(0, 0);
  renderSheetTabs();
  updateTitle();
  statusCell.textContent = 'Ready';

  gridScroll.setAttribute('tabindex', '0');
  gridScroll.style.outline = 'none';
  gridScroll.focus();

  const cmd = Kernel32.GetCommandLine();
  if (cmd.path) {
    (async () => {
      try {
        const content = await Kernel32.ReadFile(cmd.path);
        loadDelimited(cmd.path, content);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'Spreadsheet', MB_OK);
      }
    })();
  }

})();
