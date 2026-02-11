;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const TOTAL_COLS = 26;
  const TOTAL_ROWS = 100;
  const DEFAULT_COL_WIDTH = 80;
  const ROW_HEIGHT = 20;
  const VISIBLE_ROW_BUFFER = 5;

  const PALETTE_COLORS = [
    '#000000','#993300','#333300','#003300','#003366','#000080','#333399','#333333',
    '#800000','#ff6600','#808000','#008000','#008080','#0000ff','#666699','#808080',
    '#ff0000','#ff9900','#99cc00','#339966','#33cccc','#3366ff','#800080','#999999',
    '#ff00ff','#ffcc00','#ffff00','#00ff00','#00ffff','#00ccff','#993366','#c0c0c0',
    '#ff99cc','#ffcc99','#ffff99','#ccffcc','#ccffff','#99ccff','#cc99ff','#ffffff',
  ];

  const FILE_FILTERS = [
    { name: 'CSV Files', ext: ['csv'] },
    { name: 'All Files', ext: ['*'] }
  ];

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  const cellData = {};
  const cellFormats = {};
  const colWidths = [];
  let currentFilePath = null;
  let currentFileName = 'Untitled';
  let dirty = false;

  let activeCell = { col: 0, row: 0 };
  let selectionStart = null;
  let selectionEnd = null;
  let multiSelections = [];
  let isEditing = false;

  const undoStack = [];
  const redoStack = [];
  const MAX_UNDO = 100;

  let visibleRowStart = 0;
  let visibleRowEnd = 0;
  const renderedRows = new Map();

  let resizingCol = -1;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  for (let i = 0; i < TOTAL_COLS; ++i)
    colWidths[i] = DEFAULT_COL_WIDTH;

  // -----------------------------------------------------------------------
  // DOM references
  // -----------------------------------------------------------------------
  const menuBar = document.getElementById('menu-bar');
  const gridScroll = document.getElementById('grid-scroll');
  const gridHead = document.getElementById('grid-head');
  const gridBody = document.getElementById('grid-body');
  const gridTable = document.getElementById('grid-table');
  const cellRefInput = document.getElementById('cell-ref');
  const formulaInput = document.getElementById('formula-input');
  const statusCell = document.getElementById('status-cell');
  const statusSummary = document.getElementById('status-summary');
  const colorPalette = document.getElementById('color-palette');

  let openMenu = null;
  let colorCallback = null;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  function colName(index) {
    return String.fromCharCode(65 + index);
  }

  function cellKey(col, row) {
    return colName(col) + (row + 1);
  }

  function parseKey(key) {
    const m = key.match(/^([A-Z])(\d+)$/);
    if (!m)
      return null;
    return { col: m[1].charCodeAt(0) - 65, row: parseInt(m[2], 10) - 1 };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function getSelectionRect() {
    if (!selectionStart || !selectionEnd)
      return { c1: activeCell.col, r1: activeCell.row, c2: activeCell.col, r2: activeCell.row };
    const c1 = Math.min(selectionStart.col, selectionEnd.col);
    const c2 = Math.max(selectionStart.col, selectionEnd.col);
    const r1 = Math.min(selectionStart.row, selectionEnd.row);
    const r2 = Math.max(selectionStart.row, selectionEnd.row);
    return { c1, r1, c2, r2 };
  }

  function isCellInSelection(col, row) {
    const r = getSelectionRect();
    if (col >= r.c1 && col <= r.c2 && row >= r.r1 && row <= r.r2)
      return true;
    for (const s of multiSelections)
      if (col >= s.c1 && col <= s.c2 && row >= s.r1 && row <= s.r2)
        return true;
    return false;
  }

  // -----------------------------------------------------------------------
  // Cell data access
  // -----------------------------------------------------------------------
  function getCellRaw(col, row) {
    const d = cellData[cellKey(col, row)];
    return d ? d.raw : '';
  }

  function getCellValue(col, row) {
    const d = cellData[cellKey(col, row)];
    return d ? d.value : '';
  }

  function getCellError(col, row) {
    const d = cellData[cellKey(col, row)];
    return d ? d.error : false;
  }

  function getFormat(col, row) {
    return cellFormats[cellKey(col, row)] || {};
  }

  function setFormat(col, row, props) {
    const key = cellKey(col, row);
    const fmt = cellFormats[key] || {};
    Object.assign(fmt, props);
    cellFormats[key] = fmt;
  }

  // -----------------------------------------------------------------------
  // Formula engine
  // -----------------------------------------------------------------------
  const depGraph = {};

  function setCellData(col, row, raw) {
    const key = cellKey(col, row);
    const old = cellData[key];
    const entry = { raw: raw, value: '', error: false, deps: [] };

    if (old && old.deps)
      for (const dep of old.deps) {
        const s = depGraph[dep];
        if (s)
          s.delete(key);
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
      if (!depGraph[dep])
        depGraph[dep] = new Set();
      depGraph[dep].add(key);
    }

    cellData[key] = entry;
    return entry;
  }

  function recalcDependents(key) {
    const visited = new Set();
    const queue = [key];
    while (queue.length > 0) {
      const k = queue.shift();
      const dependents = depGraph[k];
      if (!dependents)
        continue;
      for (const dep of [...dependents]) {
        if (visited.has(dep))
          continue;
        visited.add(dep);
        const d = cellData[dep];
        if (d && typeof d.raw === 'string' && d.raw.startsWith('=')) {
          if (d.deps)
            for (const oldDep of d.deps) {
              const s = depGraph[oldDep];
              if (s)
                s.delete(dep);
            }

          const result = evaluateFormula(d.raw.substring(1), dep);
          d.value = result.value;
          d.error = result.error;
          d.deps = result.deps;

          for (const newDep of result.deps) {
            if (!depGraph[newDep])
              depGraph[newDep] = new Set();
            depGraph[newDep].add(dep);
          }

          queue.push(dep);
        }
      }
    }
    for (const dep of visited) {
      const parsed = parseKey(dep);
      if (parsed)
        renderCellContent(parsed.col, parsed.row);
    }
  }

  function evaluateFormula(expr, selfKey) {
    const deps = [];
    const result = { value: '', error: false, deps };

    try {
      const evaluated = evalExpression(expr, deps, selfKey);
      result.value = evaluated;
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

    processed = processed.replace(/\b([A-Z])(\d+)\b/gi, (match, col, row) => {
      const key = col.toUpperCase() + row;
      if (key === selfKey)
        return '0';
      deps.push(key);
      const parsed = parseKey(key);
      if (!parsed)
        return '0';
      return _cellValueToJS(getCellValue(parsed.col, parsed.row));
    });

    processed = processed.replace(/(\d+(?:\.\d+)?)%/g, (_, n) => String(Number(n) / 100));

    const fn = new Function('"use strict"; return (' + processed + ');');
    const val = fn();
    return val;
  }

  function _cellValueToJS(val) {
    if (typeof val === 'number')
      return String(val);
    if (typeof val === 'string' && val !== '') {
      const n = Number(val);
      if (!isNaN(n) && val.trim() !== '')
        return String(n);
      return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return '0';
  }

  function _resolveAllFunctions(expr, deps, selfKey) {
    const MAX_ITERATIONS = 50;
    for (let iter = 0; iter < MAX_ITERATIONS; ++iter) {
      const match = expr.match(/([A-Z]+)\s*\(([^()]*)\)/i);
      if (!match)
        break;
      const fullMatch = match[0];
      const fn = match[1].toUpperCase();
      const args = match[2];
      const replacement = _evalFunction(fn, args, deps, selfKey);
      expr = expr.substring(0, match.index) + replacement + expr.substring(match.index + fullMatch.length);
    }
    return expr;
  }

  function _evalFunction(fname, args, deps, selfKey) {
    switch (fname) {
      case 'SUM':
        return String(_fnRange(args, deps, selfKey, (vals) => vals.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)));
      case 'AVERAGE': {
        const vals = _collectRangeValues(args, deps, selfKey);
        const nums = vals.filter(v => typeof v === 'number');
        return nums.length > 0 ? String(nums.reduce((a, b) => a + b, 0) / nums.length) : '0';
      }
      case 'MIN':
        return String(_fnRange(args, deps, selfKey, (vals) => {
          const nums = vals.filter(v => typeof v === 'number');
          return nums.length > 0 ? Math.min(...nums) : 0;
        }));
      case 'MAX':
        return String(_fnRange(args, deps, selfKey, (vals) => {
          const nums = vals.filter(v => typeof v === 'number');
          return nums.length > 0 ? Math.max(...nums) : 0;
        }));
      case 'COUNT':
        return String(_fnRange(args, deps, selfKey, (vals) => vals.filter(v => typeof v === 'number').length));
      case 'IF': {
        const ifArgs = _splitArgs(args);
        if (ifArgs.length < 2)
          return '0';
        const cond = _evalSub(ifArgs[0], deps, selfKey);
        if (cond && cond !== 0 && cond !== '0' && cond !== '' && cond !== false)
          return _cellValueToJS(_evalSub(ifArgs[1], deps, selfKey));
        return ifArgs.length > 2 ? _cellValueToJS(_evalSub(ifArgs[2], deps, selfKey)) : '0';
      }
      case 'ABS':
        return String(Math.abs(Number(_evalSub(args, deps, selfKey))));
      case 'ROUND': {
        const rArgs = _splitArgs(args);
        const val = Number(_evalSub(rArgs[0], deps, selfKey));
        const dec = rArgs.length > 1 ? Number(_evalSub(rArgs[1], deps, selfKey)) : 0;
        const factor = Math.pow(10, dec);
        return String(Math.round(val * factor) / factor);
      }
      case 'CONCAT': {
        const cArgs = _splitArgs(args);
        return '"' + cArgs.map(a => String(_evalSub(a, deps, selfKey))).join('') + '"';
      }
      case 'LEN':
        return String(String(_evalSub(args, deps, selfKey)).length);
      case 'UPPER':
        return '"' + String(_evalSub(args, deps, selfKey)).toUpperCase() + '"';
      case 'LOWER':
        return '"' + String(_evalSub(args, deps, selfKey)).toLowerCase() + '"';
      default:
        return '0';
    }
  }

  function _evalSub(expr, deps, selfKey) {
    try {
      return evalExpression(expr.trim(), deps, selfKey);
    } catch {
      return 0;
    }
  }

  function _splitArgs(argsStr) {
    const result = [];
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let current = '';
    for (let i = 0; i < argsStr.length; ++i) {
      const ch = argsStr[i];
      if (inString) {
        current += ch;
        if (ch === stringChar)
          inString = false;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        current += ch;
        continue;
      }
      if (ch === '(')
        ++depth;
      else if (ch === ')')
        --depth;
      if (ch === ',' && depth === 0) {
        result.push(current);
        current = '';
      } else
        current += ch;
    }
    if (current.length > 0)
      result.push(current);
    return result;
  }

  function _collectRangeValues(argsStr, deps, selfKey) {
    const values = [];
    const parts = _splitArgs(argsStr);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed)
        continue;
      const rangeMatch = trimmed.match(/^([A-Z])(\d+):([A-Z])(\d+)$/i);
      if (rangeMatch) {
        const c1 = rangeMatch[1].toUpperCase().charCodeAt(0) - 65;
        const r1 = parseInt(rangeMatch[2], 10) - 1;
        const c2 = rangeMatch[3].toUpperCase().charCodeAt(0) - 65;
        const r2 = parseInt(rangeMatch[4], 10) - 1;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); ++r)
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); ++c) {
            const key = cellKey(c, r);
            if (key !== selfKey)
              deps.push(key);
            values.push(getCellValue(c, r));
          }
      } else {
        const val = _evalSub(trimmed, deps, selfKey);
        if (typeof val === 'number')
          values.push(val);
        else if (typeof val === 'string' && val !== '') {
          const n = Number(val);
          values.push(isNaN(n) ? val : n);
        } else
          values.push(val);
      }
    }
    return values;
  }

  function _fnRange(argsStr, deps, selfKey, reducer) {
    const values = _collectRangeValues(argsStr, deps, selfKey);
    return reducer(values);
  }

  // -----------------------------------------------------------------------
  // Number formatting
  // -----------------------------------------------------------------------
  function formatDisplayValue(val, fmt) {
    if (val === '' || val === null || val === undefined)
      return '';
    const nfmt = (fmt && fmt.numberFmt) || 'general';
    if (nfmt === 'general')
      return String(val);

    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num))
      return String(val);

    switch (nfmt) {
      case 'number':
        return num.toFixed(2);
      case 'currency':
        return '$' + num.toFixed(2);
      case 'percent':
        return (num * 100).toFixed(2) + '%';
      default:
        return String(val);
    }
  }

  // -----------------------------------------------------------------------
  // Undo / Redo
  // -----------------------------------------------------------------------
  function pushUndo(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO)
      undoStack.shift();
    redoStack.length = 0;
  }

  function doUndo() {
    if (undoStack.length === 0)
      return;
    const action = undoStack.pop();
    redoStack.push(action);
    applyUndoAction(action, false);
  }

  function doRedo() {
    if (redoStack.length === 0)
      return;
    const action = redoStack.pop();
    undoStack.push(action);
    applyUndoAction(action, true);
  }

  function applyUndoAction(action, isRedo) {
    if (action.type === 'cell') {
      const val = isRedo ? action.newVal : action.oldVal;
      const fmt = isRedo ? action.newFmt : action.oldFmt;
      setCellData(action.col, action.row, val);
      if (fmt)
        cellFormats[cellKey(action.col, action.row)] = Object.assign({}, fmt);
      recalcDependents(cellKey(action.col, action.row));
      renderCellContent(action.col, action.row);
      setDirty(true);
    } else if (action.type === 'multi') {
      for (const sub of (isRedo ? action.actions : [...action.actions].reverse()))
        applyUndoAction(sub, isRedo);
    }
  }

  // -----------------------------------------------------------------------
  // Grid rendering - column headers
  // -----------------------------------------------------------------------
  function buildColumnHeaders() {
    gridHead.innerHTML = '';
    const tr = document.createElement('tr');

    const corner = document.createElement('th');
    corner.className = 'corner';
    tr.appendChild(corner);

    for (let c = 0; c < TOTAL_COLS; ++c) {
      const th = document.createElement('th');
      th.className = 'col-header';
      th.textContent = colName(c);
      th.style.width = colWidths[c] + 'px';
      th.dataset.col = c;

      const handle = document.createElement('div');
      handle.className = 'col-resize-handle';
      handle.dataset.col = c;
      th.appendChild(handle);

      tr.appendChild(th);
    }

    gridHead.appendChild(tr);
  }

  // -----------------------------------------------------------------------
  // Virtual scrolling
  // -----------------------------------------------------------------------
  function calcVisibleRows() {
    const scrollTop = gridScroll.scrollTop;
    const viewHeight = gridScroll.clientHeight;
    const headerHeight = 20;
    const start = Math.max(0, Math.floor((scrollTop - headerHeight) / ROW_HEIGHT) - VISIBLE_ROW_BUFFER);
    const end = Math.min(TOTAL_ROWS - 1, Math.ceil((scrollTop - headerHeight + viewHeight) / ROW_HEIGHT) + VISIBLE_ROW_BUFFER);
    return { start, end };
  }

  function renderVisibleRows() {
    const { start, end } = calcVisibleRows();

    if (start === visibleRowStart && end === visibleRowEnd)
      return;

    for (const [rowIdx, tr] of renderedRows) {
      if (rowIdx < start || rowIdx > end) {
        tr.remove();
        renderedRows.delete(rowIdx);
      }
    }

    for (let r = start; r <= end; ++r) {
      if (!renderedRows.has(r)) {
        const tr = createRow(r);
        let inserted = false;
        for (const child of gridBody.children) {
          const childRow = parseInt(child.dataset.row, 10);
          if (childRow > r) {
            gridBody.insertBefore(tr, child);
            inserted = true;
            break;
          }
        }
        if (!inserted)
          gridBody.appendChild(tr);
        renderedRows.set(r, tr);
      }
    }

    updateSpacers(start, end);

    visibleRowStart = start;
    visibleRowEnd = end;
  }

  function updateSpacers(start, end) {
    let topSpacer = gridBody.querySelector('.spacer-top');
    if (!topSpacer) {
      topSpacer = document.createElement('tr');
      topSpacer.className = 'spacer-top';
      const td = document.createElement('td');
      td.colSpan = TOTAL_COLS + 1;
      td.style.padding = '0';
      td.style.border = 'none';
      topSpacer.appendChild(td);
    }
    topSpacer.firstChild.style.height = (start * ROW_HEIGHT) + 'px';
    if (gridBody.firstChild !== topSpacer)
      gridBody.insertBefore(topSpacer, gridBody.firstChild);

    let botSpacer = gridBody.querySelector('.spacer-bottom');
    if (!botSpacer) {
      botSpacer = document.createElement('tr');
      botSpacer.className = 'spacer-bottom';
      const td = document.createElement('td');
      td.colSpan = TOTAL_COLS + 1;
      td.style.padding = '0';
      td.style.border = 'none';
      botSpacer.appendChild(td);
    }
    botSpacer.firstChild.style.height = ((TOTAL_ROWS - 1 - end) * ROW_HEIGHT) + 'px';
    gridBody.appendChild(botSpacer);
  }

  function createRow(r) {
    const tr = document.createElement('tr');
    tr.dataset.row = r;

    const rh = document.createElement('td');
    rh.className = 'row-header';
    rh.textContent = r + 1;
    tr.appendChild(rh);

    for (let c = 0; c < TOTAL_COLS; ++c) {
      const td = document.createElement('td');
      td.className = 'cell';
      td.dataset.col = c;
      td.dataset.row = r;
      td.style.width = colWidths[c] + 'px';
      applyCellStyle(td, c, r);
      updateCellDisplay(td, c, r);
      td.appendChild(document.createTextNode(''));
      tr.appendChild(td);
    }

    return tr;
  }

  function applyCellStyle(td, col, row) {
    const fmt = getFormat(col, row);
    td.style.fontWeight = fmt.bold ? 'bold' : '';
    td.style.fontStyle = fmt.italic ? 'italic' : '';
    td.style.textDecoration = fmt.underline ? 'underline' : '';
    td.style.textAlign = fmt.align || '';
    td.style.fontSize = fmt.fontSize ? fmt.fontSize + 'px' : '';
    if (fmt.bgColor)
      td.style.backgroundColor = fmt.bgColor;
    else
      td.style.backgroundColor = '';
    if (fmt.textColor)
      td.style.color = fmt.textColor;
    else
      td.style.color = '';
  }

  function updateCellDisplay(td, col, row) {
    const val = getCellValue(col, row);
    const err = getCellError(col, row);
    const fmt = getFormat(col, row);
    const display = err ? String(val) : formatDisplayValue(val, fmt);
    td.textContent = display;
    td.classList.toggle('error', !!err);
  }

  function renderCellContent(col, row) {
    const td = getCellElement(col, row);
    if (!td)
      return;
    applyCellStyle(td, col, row);
    updateCellDisplay(td, col, row);
  }

  function getCellElement(col, row) {
    const tr = renderedRows.get(row);
    if (!tr)
      return null;
    return tr.children[col + 1] || null;
  }

  // -----------------------------------------------------------------------
  // Selection rendering
  // -----------------------------------------------------------------------
  function updateSelectionDisplay() {
    const rect = getSelectionRect();

    for (const [, tr] of renderedRows) {
      const rIdx = parseInt(tr.dataset.row, 10);
      const rh = tr.children[0];
      rh.classList.toggle('selected', rIdx >= rect.r1 && rIdx <= rect.r2);

      for (let c = 0; c < TOTAL_COLS; ++c) {
        const td = tr.children[c + 1];
        if (!td)
          continue;
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
  }

  function updateToolbarState() {
    const fmt = getFormat(activeCell.col, activeCell.row);
    document.getElementById('btn-bold').classList.toggle('active', !!fmt.bold);
    document.getElementById('btn-italic').classList.toggle('active', !!fmt.italic);
    document.getElementById('btn-underline').classList.toggle('active', !!fmt.underline);
    document.getElementById('btn-align-left').classList.toggle('active', fmt.align === 'left');
    document.getElementById('btn-align-center').classList.toggle('active', fmt.align === 'center');
    document.getElementById('btn-align-right').classList.toggle('active', fmt.align === 'right');
    document.getElementById('sel-font-size').value = fmt.fontSize || '11';
    document.getElementById('sel-number-format').value = fmt.numberFmt || 'general';
  }

  function updateStatusSummary() {
    const rect = getSelectionRect();
    const vals = [];
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const v = getCellValue(c, r);
        if (typeof v === 'number')
          vals.push(v);
        else if (typeof v === 'string' && v !== '') {
          const n = parseFloat(v);
          if (!isNaN(n))
            vals.push(n);
        }
      }

    if (vals.length > 1) {
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / vals.length;
      statusSummary.textContent = 'Sum: ' + sum.toFixed(2) + '  Avg: ' + avg.toFixed(2) + '  Count: ' + vals.length;
    } else
      statusSummary.textContent = '';
  }

  // -----------------------------------------------------------------------
  // Cell editing
  // -----------------------------------------------------------------------
  function startEditing(col, row, initialValue) {
    if (isEditing)
      finishEditing();

    isEditing = true;
    const td = getCellElement(col, row);
    if (!td)
      return;

    td.classList.add('editing');
    td.textContent = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-editor';
    input.value = initialValue !== undefined ? initialValue : getCellRaw(col, row);
    td.appendChild(input);
    input.focus();

    formulaInput.value = input.value;

    input.addEventListener('input', () => {
      formulaInput.value = input.value;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEditing();
        moveCursor(0, 1);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        finishEditing();
        moveCursor(e.shiftKey ? -1 : 1, 0);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing();
      }
    });

    statusCell.textContent = 'Edit';
  }

  function finishEditing() {
    if (!isEditing)
      return;

    isEditing = false;
    const td = getCellElement(activeCell.col, activeCell.row);
    if (!td)
      return;

    const input = td.querySelector('.cell-editor');
    if (!input)
      return;

    const newVal = input.value;
    const oldVal = getCellRaw(activeCell.col, activeCell.row);
    const oldFmt = Object.assign({}, getFormat(activeCell.col, activeCell.row));

    if (newVal !== oldVal) {
      pushUndo({
        type: 'cell',
        col: activeCell.col,
        row: activeCell.row,
        oldVal,
        newVal,
        oldFmt,
        newFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)),
      });
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
    if (!isEditing)
      return;

    isEditing = false;
    const td = getCellElement(activeCell.col, activeCell.row);
    if (!td)
      return;

    const input = td.querySelector('.cell-editor');
    if (input)
      input.remove();
    td.classList.remove('editing');
    renderCellContent(activeCell.col, activeCell.row);
    formulaInput.value = getCellRaw(activeCell.col, activeCell.row);
    statusCell.textContent = 'Ready';
  }

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  function moveCursor(dc, dr) {
    const newCol = clamp(activeCell.col + dc, 0, TOTAL_COLS - 1);
    const newRow = clamp(activeCell.row + dr, 0, TOTAL_ROWS - 1);
    selectCell(newCol, newRow);
    scrollCellIntoView(newCol, newRow);
  }

  function selectCell(col, row) {
    activeCell = { col, row };
    selectionStart = { col, row };
    selectionEnd = { col, row };
    multiSelections = [];
    updateSelectionDisplay();
  }

  function scrollCellIntoView(col, row) {
    const scrollArea = gridScroll;
    const headerHeight = 20;
    const rowHeaderWidth = 40;

    const cellTop = row * ROW_HEIGHT + headerHeight;
    const cellBottom = cellTop + ROW_HEIGHT;
    if (cellTop < scrollArea.scrollTop + headerHeight)
      scrollArea.scrollTop = cellTop - headerHeight;
    else if (cellBottom > scrollArea.scrollTop + scrollArea.clientHeight)
      scrollArea.scrollTop = cellBottom - scrollArea.clientHeight;

    let colLeft = rowHeaderWidth;
    for (let c = 0; c < col; ++c)
      colLeft += colWidths[c];
    const colRight = colLeft + colWidths[col];
    if (colLeft < scrollArea.scrollLeft + rowHeaderWidth)
      scrollArea.scrollLeft = colLeft - rowHeaderWidth;
    else if (colRight > scrollArea.scrollLeft + scrollArea.clientWidth)
      scrollArea.scrollLeft = colRight - scrollArea.clientWidth;

    renderVisibleRows();
  }

  // -----------------------------------------------------------------------
  // Pointer events on grid
  // -----------------------------------------------------------------------
  gridScroll.addEventListener('pointerdown', (e) => {
    const td = e.target.closest('td.cell');
    if (!td)
      return;

    const col = parseInt(td.dataset.col, 10);
    const row = parseInt(td.dataset.row, 10);

    if (isEditing)
      finishEditing();

    if (e.ctrlKey) {
      const rect = getSelectionRect();
      multiSelections.push(rect);
      activeCell = { col, row };
      selectionStart = { col, row };
      selectionEnd = { col, row };
    } else if (e.shiftKey) {
      selectionEnd = { col, row };
    } else
      selectCell(col, row);

    updateSelectionDisplay();

    const onMove = (me) => {
      const target = document.elementFromPoint(me.clientX, me.clientY);
      const moveTd = target && target.closest('td.cell');
      if (moveTd) {
        selectionEnd = {
          col: parseInt(moveTd.dataset.col, 10),
          row: parseInt(moveTd.dataset.row, 10),
        };
        updateSelectionDisplay();
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  gridScroll.addEventListener('dblclick', (e) => {
    const td = e.target.closest('td.cell');
    if (!td)
      return;

    const col = parseInt(td.dataset.col, 10);
    const row = parseInt(td.dataset.row, 10);
    activeCell = { col, row };
    startEditing(col, row);
  });

  // -----------------------------------------------------------------------
  // Column resize
  // -----------------------------------------------------------------------
  gridHead.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.col-resize-handle');
    if (!handle)
      return;

    e.preventDefault();
    resizingCol = parseInt(handle.dataset.col, 10);
    resizeStartX = e.clientX;
    resizeStartWidth = colWidths[resizingCol];

    handle.setPointerCapture(e.pointerId);

    const onMove = (me) => {
      const delta = me.clientX - resizeStartX;
      colWidths[resizingCol] = Math.max(30, resizeStartWidth + delta);
      updateColumnWidth(resizingCol);
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      resizingCol = -1;
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });

  gridHead.addEventListener('dblclick', (e) => {
    const handle = e.target.closest('.col-resize-handle');
    if (!handle)
      return;

    const col = parseInt(handle.dataset.col, 10);
    autoResizeColumn(col);
  });

  function updateColumnWidth(col) {
    const th = gridHead.querySelector('th[data-col="' + col + '"]');
    if (th)
      th.style.width = colWidths[col] + 'px';

    for (const [, tr] of renderedRows) {
      const td = tr.children[col + 1];
      if (td)
        td.style.width = colWidths[col] + 'px';
    }
  }

  function autoResizeColumn(col) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '11px Tahoma, Verdana, sans-serif';
    let maxWidth = 30;

    for (let r = 0; r < TOTAL_ROWS; ++r) {
      const val = getCellValue(col, r);
      if (val === '')
        continue;
      const fmt = getFormat(col, r);
      const display = formatDisplayValue(val, fmt);
      const w = ctx.measureText(display).width + 10;
      if (w > maxWidth)
        maxWidth = w;
    }

    colWidths[col] = Math.min(300, Math.max(30, Math.ceil(maxWidth)));
    updateColumnWidth(col);
  }

  // -----------------------------------------------------------------------
  // Keyboard handling
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.target === formulaInput || e.target.closest('.find-panel'))
      return;

    if (isEditing)
      return;

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
        case 'f': e.preventDefault(); handleAction('find'); return;
        case 'a': e.preventDefault(); handleAction('select-all'); return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (e.shiftKey)
          extendSelection(0, -1);
        else
          moveCursor(0, -1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (e.shiftKey)
          extendSelection(0, 1);
        else
          moveCursor(0, 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey)
          extendSelection(-1, 0);
        else
          moveCursor(-1, 0);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey)
          extendSelection(1, 0);
        else
          moveCursor(1, 0);
        break;
      case 'Tab':
        e.preventDefault();
        moveCursor(e.shiftKey ? -1 : 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        moveCursor(0, 1);
        break;
      case 'Delete':
        e.preventDefault();
        deleteSelection();
        break;
      case 'F2':
        e.preventDefault();
        startEditing(activeCell.col, activeCell.row);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          startEditing(activeCell.col, activeCell.row, e.key);
        }
        break;
    }
  });

  function extendSelection(dc, dr) {
    if (!selectionEnd)
      selectionEnd = { col: activeCell.col, row: activeCell.row };
    selectionEnd.col = clamp(selectionEnd.col + dc, 0, TOTAL_COLS - 1);
    selectionEnd.row = clamp(selectionEnd.row + dr, 0, TOTAL_ROWS - 1);
    updateSelectionDisplay();
    scrollCellIntoView(selectionEnd.col, selectionEnd.row);
  }

  // -----------------------------------------------------------------------
  // Formula bar interaction
  // -----------------------------------------------------------------------
  formulaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newVal = formulaInput.value;
      const oldVal = getCellRaw(activeCell.col, activeCell.row);
      if (newVal !== oldVal) {
        pushUndo({
          type: 'cell',
          col: activeCell.col,
          row: activeCell.row,
          oldVal,
          newVal,
          oldFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)),
          newFmt: Object.assign({}, getFormat(activeCell.col, activeCell.row)),
        });
        setCellData(activeCell.col, activeCell.row, newVal);
        recalcDependents(cellKey(activeCell.col, activeCell.row));
        renderCellContent(activeCell.col, activeCell.row);
        setDirty(true);
      }
      gridScroll.focus();
      updateSelectionDisplay();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      formulaInput.value = getCellRaw(activeCell.col, activeCell.row);
      gridScroll.focus();
    }
  });

  formulaInput.addEventListener('focus', () => {
    statusCell.textContent = 'Edit';
  });

  formulaInput.addEventListener('blur', () => {
    statusCell.textContent = 'Ready';
  });

  // -----------------------------------------------------------------------
  // Clipboard
  // -----------------------------------------------------------------------
  let clipboard = null;
  let clipboardIsCut = false;

  function doCopy() {
    const rect = getSelectionRect();
    clipboard = [];
    clipboardIsCut = false;
    for (let r = rect.r1; r <= rect.r2; ++r) {
      const row = [];
      for (let c = rect.c1; c <= rect.c2; ++c)
        row.push({
          raw: getCellRaw(c, r),
          fmt: Object.assign({}, getFormat(c, r)),
        });
      clipboard.push(row);
    }

    const lines = [];
    for (let r = rect.r1; r <= rect.r2; ++r) {
      const cols = [];
      for (let c = rect.c1; c <= rect.c2; ++c)
        cols.push(String(getCellValue(c, r)));
      lines.push(cols.join('\t'));
    }
    try {
      navigator.clipboard.writeText(lines.join('\n'));
    } catch { /* ignore */ }
  }

  function doCut() {
    doCopy();
    clipboardIsCut = true;
    deleteSelection();
  }

  function doPaste() {
    if (!clipboard)
      return;

    const actions = [];
    for (let dr = 0; dr < clipboard.length; ++dr) {
      const row = clipboard[dr];
      for (let dc = 0; dc < row.length; ++dc) {
        const c = activeCell.col + dc;
        const r = activeCell.row + dr;
        if (c >= TOTAL_COLS || r >= TOTAL_ROWS)
          continue;

        const oldVal = getCellRaw(c, r);
        const oldFmt = Object.assign({}, getFormat(c, r));
        const newVal = row[dc].raw;
        const newFmt = Object.assign({}, row[dc].fmt);

        actions.push({ type: 'cell', col: c, row: r, oldVal, newVal, oldFmt, newFmt });
        setCellData(c, r, newVal);
        cellFormats[cellKey(c, r)] = newFmt;
        recalcDependents(cellKey(c, r));
        renderCellContent(c, r);
      }
    }

    if (actions.length > 0) {
      pushUndo({ type: 'multi', actions });
      setDirty(true);
    }
  }

  function deleteSelection() {
    const rect = getSelectionRect();
    const actions = [];
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const oldVal = getCellRaw(c, r);
        if (oldVal === '')
          continue;
        actions.push({
          type: 'cell', col: c, row: r,
          oldVal, newVal: '',
          oldFmt: Object.assign({}, getFormat(c, r)),
          newFmt: Object.assign({}, getFormat(c, r)),
        });
        setCellData(c, r, '');
        recalcDependents(cellKey(c, r));
        renderCellContent(c, r);
      }

    if (actions.length > 0) {
      pushUndo({ type: 'multi', actions });
      setDirty(true);
    }
  }

  // -----------------------------------------------------------------------
  // Formatting actions
  // -----------------------------------------------------------------------
  function applyFormatToSelection(prop, value) {
    const rect = getSelectionRect();
    const actions = [];
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const oldFmt = Object.assign({}, getFormat(c, r));
        const newFmt = Object.assign({}, oldFmt);
        if (typeof value === 'function')
          newFmt[prop] = value(oldFmt[prop]);
        else
          newFmt[prop] = value;
        actions.push({
          type: 'cell', col: c, row: r,
          oldVal: getCellRaw(c, r), newVal: getCellRaw(c, r),
          oldFmt, newFmt,
        });
        cellFormats[cellKey(c, r)] = newFmt;
        renderCellContent(c, r);
      }

    if (actions.length > 0) {
      pushUndo({ type: 'multi', actions });
      setDirty(true);
    }
    updateSelectionDisplay();
  }

  function toggleFormat(prop) {
    const current = getFormat(activeCell.col, activeCell.row)[prop];
    applyFormatToSelection(prop, !current);
  }

  // -----------------------------------------------------------------------
  // Color palette
  // -----------------------------------------------------------------------
  function buildColorPalette() {
    colorPalette.innerHTML = '';
    for (const color of PALETTE_COLORS) {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color;
      swatch.dataset.color = color;
      swatch.addEventListener('click', () => {
        hideColorPalette();
        if (colorCallback)
          colorCallback(color);
      });
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

  function hideColorPalette() {
    colorPalette.classList.remove('visible');
    colorCallback = null;
  }

  document.addEventListener('pointerdown', (e) => {
    if (!colorPalette.contains(e.target) && !e.target.closest('#btn-bg-color') && !e.target.closest('#btn-text-color'))
      hideColorPalette();
  });

  buildColorPalette();

  // -----------------------------------------------------------------------
  // Toolbar event handlers
  // -----------------------------------------------------------------------
  document.getElementById('btn-bold').addEventListener('click', () => toggleFormat('bold'));
  document.getElementById('btn-italic').addEventListener('click', () => toggleFormat('italic'));
  document.getElementById('btn-underline').addEventListener('click', () => toggleFormat('underline'));

  document.getElementById('btn-align-left').addEventListener('click', () => applyFormatToSelection('align', 'left'));
  document.getElementById('btn-align-center').addEventListener('click', () => applyFormatToSelection('align', 'center'));
  document.getElementById('btn-align-right').addEventListener('click', () => applyFormatToSelection('align', 'right'));

  document.getElementById('sel-font-size').addEventListener('change', (e) => {
    applyFormatToSelection('fontSize', parseInt(e.target.value, 10));
  });

  document.getElementById('sel-number-format').addEventListener('change', (e) => {
    applyFormatToSelection('numberFmt', e.target.value);
    const rect = getSelectionRect();
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c)
        renderCellContent(c, r);
  });

  document.getElementById('btn-bg-color').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    showColorPalette(btn, (color) => {
      applyFormatToSelection('bgColor', color);
      btn.querySelector('.color-indicator').style.backgroundColor = color;
    });
  });

  document.getElementById('btn-text-color').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    showColorPalette(btn, (color) => {
      applyFormatToSelection('textColor', color);
      btn.querySelector('.color-indicator').style.backgroundColor = color;
    });
  });

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
      case 'exit': User32.DestroyWindow(); break;
      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'cut': doCut(); break;
      case 'copy': doCopy(); break;
      case 'paste': doPaste(); break;
      case 'delete': deleteSelection(); break;
      case 'select-all': doSelectAll(); break;
      case 'find': showFindPanel(); break;
      case 'bold': toggleFormat('bold'); break;
      case 'italic': toggleFormat('italic'); break;
      case 'underline': toggleFormat('underline'); break;
      case 'fmt-general': applyFormatToSelection('numberFmt', 'general'); break;
      case 'fmt-number': applyFormatToSelection('numberFmt', 'number'); break;
      case 'fmt-currency': applyFormatToSelection('numberFmt', 'currency'); break;
      case 'fmt-percent': applyFormatToSelection('numberFmt', 'percent'); break;
      case 'cell-color-menu':
        showColorPalette(document.getElementById('btn-bg-color'), (color) => {
          applyFormatToSelection('bgColor', color);
        });
        break;
      case 'text-color-menu':
        showColorPalette(document.getElementById('btn-text-color'), (color) => {
          applyFormatToSelection('textColor', color);
        });
        break;
      case 'about': showDialog('dlg-about'); break;
    }
  }

  function doSelectAll() {
    selectionStart = { col: 0, row: 0 };
    selectionEnd = { col: TOTAL_COLS - 1, row: TOTAL_ROWS - 1 };
    multiSelections = [];
    updateSelectionDisplay();
  }

  // -----------------------------------------------------------------------
  // Find panel
  // -----------------------------------------------------------------------
  const findPanel = document.getElementById('find-panel');
  const fpInput = document.getElementById('fp-input');
  const fpStatus = document.getElementById('fp-status');
  let findLastRow = 0;
  let findLastCol = 0;

  function showFindPanel() {
    findPanel.classList.add('visible');
    fpInput.focus();
    fpInput.select();
    fpStatus.textContent = '';
  }

  function closeFindPanel() {
    findPanel.classList.remove('visible');
  }

  document.getElementById('fp-close').addEventListener('click', closeFindPanel);

  document.getElementById('fp-find-next').addEventListener('click', findNext);

  fpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findNext();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFindPanel();
    }
  });

  fpInput.addEventListener('input', () => {
    findLastRow = 0;
    findLastCol = 0;
    fpStatus.textContent = '';
  });

  function findNext() {
    const needle = fpInput.value.toLowerCase();
    if (!needle) {
      fpStatus.textContent = '';
      return;
    }

    let r = findLastRow;
    let c = findLastCol;
    for (let i = 0; i < TOTAL_ROWS * TOTAL_COLS; ++i) {
      const val = String(getCellValue(c, r)).toLowerCase();
      const raw = String(getCellRaw(c, r)).toLowerCase();
      if (val.includes(needle) || raw.includes(needle)) {
        selectCell(c, r);
        scrollCellIntoView(c, r);
        renderVisibleRows();
        updateSelectionDisplay();
        fpStatus.textContent = 'Found at ' + cellKey(c, r);
        ++c;
        if (c >= TOTAL_COLS) {
          c = 0;
          ++r;
          if (r >= TOTAL_ROWS)
            r = 0;
        }
        findLastRow = r;
        findLastCol = c;
        return;
      }
      ++c;
      if (c >= TOTAL_COLS) {
        c = 0;
        ++r;
        if (r >= TOTAL_ROWS)
          r = 0;
      }
    }

    fpStatus.textContent = 'No matches found.';
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
  function setDirty(d) {
    dirty = d;
    updateTitle();
  }

  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - Spreadsheet';
    document.title = title;
    User32.SetWindowText(title);
  }

  function doNew() {
    if (isEditing)
      finishEditing();
    resetSheet();
  }

  function resetSheet() {
    for (const key in cellData)
      delete cellData[key];
    for (const key in cellFormats)
      delete cellFormats[key];
    for (const key in depGraph)
      delete depGraph[key];
    undoStack.length = 0;
    redoStack.length = 0;
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    activeCell = { col: 0, row: 0 };
    selectionStart = { col: 0, row: 0 };
    selectionEnd = { col: 0, row: 0 };
    multiSelections = [];
    for (let i = 0; i < TOTAL_COLS; ++i)
      colWidths[i] = DEFAULT_COL_WIDTH;
    rebuildGrid();
    updateTitle();
  }

  function rebuildGrid() {
    renderedRows.clear();
    gridBody.innerHTML = '';
    buildColumnHeaders();
    visibleRowStart = -1;
    visibleRowEnd = -1;
    renderVisibleRows();
    updateSelectionDisplay();
  }

  async function doOpen() {
    if (isEditing)
      finishEditing();
    const result = await ComDlg32.GetOpenFileName({
      filters: FILE_FILTERS,
      initialDir: '/user/documents',
      title: 'Open',
    });
    if (!result.cancelled && result.path)
      loadCSV(result.path, result.content);
  }

  function loadCSV(path, content) {
    resetSheet();
    if (content) {
      const lines = content.split('\n');
      for (let r = 0; r < lines.length && r < TOTAL_ROWS; ++r) {
        const cols = parseCSVLine(lines[r]);
        for (let c = 0; c < cols.length && c < TOTAL_COLS; ++c)
          setCellData(c, r, cols[c]);
      }
    }
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    rebuildGrid();
    updateTitle();
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; ++i) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            ++i;
          } else
            inQuotes = false;
        } else
          current += ch;
      } else {
        if (ch === '"')
          inQuotes = true;
        else if (ch === ',') {
          result.push(current);
          current = '';
        } else
          current += ch;
      }
    }
    result.push(current);
    return result;
  }

  function toCSV() {
    const lines = [];
    let maxRow = 0;
    let maxCol = 0;
    for (const key in cellData) {
      const parsed = parseKey(key);
      if (parsed && cellData[key].raw !== '') {
        if (parsed.row > maxRow)
          maxRow = parsed.row;
        if (parsed.col > maxCol)
          maxCol = parsed.col;
      }
    }

    for (let r = 0; r <= maxRow; ++r) {
      const cols = [];
      for (let c = 0; c <= maxCol; ++c) {
        const raw = getCellRaw(c, r);
        if (raw.includes(',') || raw.includes('"') || raw.includes('\n'))
          cols.push('"' + raw.replace(/"/g, '""') + '"');
        else
          cols.push(raw);
      }
      lines.push(cols.join(','));
    }
    return lines.join('\n');
  }

  async function doSave() {
    if (!currentFilePath) {
      doSaveAs();
      return;
    }
    try {
      await Kernel32.WriteFile(currentFilePath, toCSV());
    } catch (err) {
      await User32.MessageBox('Could not save file: ' + err.message, 'Spreadsheet', MB_OK);
      return;
    }
    setDirty(false);
  }

  async function doSaveAs() {
    const result = await ComDlg32.GetSaveFileName({
      filters: FILE_FILTERS,
      initialDir: '/user/documents',
      defaultName: currentFileName || 'Untitled.csv',
      title: 'Save As',
      content: toCSV(),
    });
    if (!result.cancelled && result.path) {
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';
      setDirty(false);
    }
  }

  // -----------------------------------------------------------------------
  // Dialog helper
  // -----------------------------------------------------------------------
  function showDialog(id) {
    const overlay = document.getElementById(id);
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

  // -----------------------------------------------------------------------
  // Scroll handler
  // -----------------------------------------------------------------------
  gridScroll.addEventListener('scroll', () => {
    renderVisibleRows();
  });

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------
  buildColumnHeaders();
  renderVisibleRows();
  selectCell(0, 0);
  updateTitle();
  statusCell.textContent = 'Ready';

  gridScroll.setAttribute('tabindex', '0');
  gridScroll.style.outline = 'none';
  gridScroll.focus();

  // Check command line for file to open
  const cmd = Kernel32.GetCommandLine();
  if (cmd.path) {
    (async () => {
      try {
        const content = await Kernel32.ReadFile(cmd.path);
        loadCSV(cmd.path, content);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'Spreadsheet', MB_OK);
      }
    })();
  }

})();
