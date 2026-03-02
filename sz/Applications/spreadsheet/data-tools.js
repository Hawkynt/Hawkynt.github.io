;(function() {
  'use strict';
  const SS = window.SpreadsheetApp || (window.SpreadsheetApp = {});

  let _S, _cellKey, _parseKey, _colName, _colIndex, _getCellRaw, _getCellValue, _setCellData;
  let _getFormat, _setFormat, _pushUndo, _setDirty, _rebuildGrid, _renderCellContent;
  let _recalcDependents, _getActiveCell, _getSelectionRect, _showDialog;

  function init(ctx) {
    _S = ctx.S;
    _cellKey = ctx.cellKey;
    _parseKey = ctx.parseKey;
    _colName = ctx.colName;
    _colIndex = ctx.colIndex;
    _getCellRaw = ctx.getCellRaw;
    _getCellValue = ctx.getCellValue;
    _setCellData = ctx.setCellData;
    _getFormat = ctx.getFormat;
    _setFormat = ctx.setFormat;
    _pushUndo = ctx.pushUndo;
    _setDirty = ctx.setDirty;
    _rebuildGrid = ctx.rebuildGrid;
    _renderCellContent = ctx.renderCellContent;
    _recalcDependents = ctx.recalcDependents;
    _getActiveCell = ctx.getActiveCell;
    _getSelectionRect = ctx.getSelectionRect;
    _showDialog = ctx.showDialog;
  }

  // ── Auto-Fill Pattern Detection ───────────────────────────────────

  const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const DAY_NAMES_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_NAMES_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function detectFillPattern(values) {
    if (!values.length) return { type: 'repeat', values };

    const strs = values.map(v => String(v));

    // Check for day names
    const dayShortIdx = strs.map(v => DAY_NAMES_SHORT.indexOf(v));
    if (dayShortIdx.every(i => i >= 0))
      return { type: 'day-short', startIdx: dayShortIdx[0], count: values.length };

    const dayLongIdx = strs.map(v => DAY_NAMES_LONG.indexOf(v));
    if (dayLongIdx.every(i => i >= 0))
      return { type: 'day-long', startIdx: dayLongIdx[0], count: values.length };

    // Check for month names
    const monthShortIdx = strs.map(v => MONTH_NAMES_SHORT.indexOf(v));
    if (monthShortIdx.every(i => i >= 0))
      return { type: 'month-short', startIdx: monthShortIdx[0], count: values.length };

    const monthLongIdx = strs.map(v => MONTH_NAMES_LONG.indexOf(v));
    if (monthLongIdx.every(i => i >= 0))
      return { type: 'month-long', startIdx: monthLongIdx[0], count: values.length };

    // Check all values are numbers
    const nums = values.map(v => typeof v === 'number' ? v : parseFloat(v));
    const allNumbers = nums.every(n => !isNaN(n));

    if (allNumbers) {
      if (nums.length === 1)
        return { type: 'number-inc', start: nums[0], step: 1 };
      const diffs = [];
      for (let i = 1; i < nums.length; ++i)
        diffs.push(nums[i] - nums[i - 1]);
      const allSame = diffs.every(d => Math.abs(d - diffs[0]) < 1e-10);
      if (allSame)
        return { type: 'number-seq', start: nums[0], step: diffs[0], count: nums.length };
      return { type: 'number-repeat', values: nums };
    }

    // Check for formulas
    const allFormulas = strs.every(v => v.startsWith('='));
    if (allFormulas)
      return { type: 'formula', formulas: strs };

    // Check for text with trailing number (e.g. "Item1", "Item2")
    const textNumMatch = strs.map(v => v.match(/^(.*?)(\d+)$/));
    if (textNumMatch.every(m => m !== null)) {
      const prefix = textNumMatch[0][1];
      const allSamePrefix = textNumMatch.every(m => m[1] === prefix);
      if (allSamePrefix) {
        const trailingNums = textNumMatch.map(m => parseInt(m[2], 10));
        if (trailingNums.length === 1)
          return { type: 'text-num', prefix, start: trailingNums[0], step: 1 };
        const step = trailingNums[1] - trailingNums[0];
        return { type: 'text-num', prefix, start: trailingNums[0], step };
      }
    }

    // Default: repeat cyclically
    return { type: 'repeat', values: strs };
  }

  function generateFillValue(pattern, index) {
    switch (pattern.type) {
      case 'number-inc':
        return pattern.start + (index + 1) * pattern.step;
      case 'number-seq':
        return pattern.start + (index + pattern.count) * pattern.step;
      case 'number-repeat':
        return pattern.values[index % pattern.values.length];
      case 'day-short':
        return DAY_NAMES_SHORT[(pattern.startIdx + pattern.count + index) % 7];
      case 'day-long':
        return DAY_NAMES_LONG[(pattern.startIdx + pattern.count + index) % 7];
      case 'month-short':
        return MONTH_NAMES_SHORT[(pattern.startIdx + pattern.count + index) % 12];
      case 'month-long':
        return MONTH_NAMES_LONG[(pattern.startIdx + pattern.count + index) % 12];
      case 'text-num':
        return pattern.prefix + (pattern.start + (index + 1) * pattern.step);
      case 'formula':
        return pattern.formulas[index % pattern.formulas.length];
      case 'repeat':
      default:
        return pattern.values[index % pattern.values.length];
    }
  }

  function adjustFormulaReferences(formula, dCol, dRow) {
    return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/gi, (match, abCol, col, abRow, row) => {
      const newCol = abCol === '$' ? col : _colName(_colIndex(col.toUpperCase()) + dCol);
      const newRow = abRow === '$' ? row : String(parseInt(row, 10) + dRow);
      return abCol + newCol + abRow + newRow;
    });
  }

  function performAutoFill(sourceRect, targetRect, direction) {
    const actions = [];

    if (direction === 'down' || direction === 'up') {
      for (let c = sourceRect.c1; c <= sourceRect.c2; ++c) {
        const sourceValues = [];
        const sourceRaws = [];
        for (let r = sourceRect.r1; r <= sourceRect.r2; ++r) {
          sourceValues.push(_getCellValue(c, r));
          sourceRaws.push(_getCellRaw(c, r));
        }
        const pattern = detectFillPattern(sourceValues);
        const rawPattern = detectFillPattern(sourceRaws);

        const startR = direction === 'down' ? sourceRect.r2 + 1 : targetRect.r1;
        const endR = direction === 'down' ? targetRect.r2 : sourceRect.r1 - 1;
        const count = Math.abs(endR - startR) + 1;

        for (let i = 0; i < count; ++i) {
          const r = direction === 'down' ? startR + i : endR - i;
          let val;
          if (rawPattern.type === 'formula') {
            const srcFormula = sourceRaws[i % sourceRaws.length];
            val = adjustFormulaReferences(srcFormula, 0, (direction === 'down' ? i + sourceRaws.length : -(i + sourceRaws.length)));
          } else
            val = generateFillValue(pattern, i);

          const oldVal = _getCellRaw(c, r);
          const oldFmt = Object.assign({}, _getFormat(c, r));
          actions.push({ type: 'cell', col: c, row: r, oldVal, newVal: typeof val === 'number' ? val : String(val), oldFmt, newFmt: Object.assign({}, oldFmt) });
          _setCellData(c, r, typeof val === 'number' ? val : String(val));
          _recalcDependents(_cellKey(c, r));
          const srcFmt = _getFormat(c, sourceRect.r1 + (i % (sourceRect.r2 - sourceRect.r1 + 1)));
          if (Object.keys(srcFmt).length > 0)
            _setFormat(c, r, { ...srcFmt });
        }
      }
    } else {
      for (let r = sourceRect.r1; r <= sourceRect.r2; ++r) {
        const sourceValues = [];
        const sourceRaws = [];
        for (let c = sourceRect.c1; c <= sourceRect.c2; ++c) {
          sourceValues.push(_getCellValue(c, r));
          sourceRaws.push(_getCellRaw(c, r));
        }
        const pattern = detectFillPattern(sourceValues);
        const rawPattern = detectFillPattern(sourceRaws);

        const startC = direction === 'right' ? sourceRect.c2 + 1 : targetRect.c1;
        const endC = direction === 'right' ? targetRect.c2 : sourceRect.c1 - 1;
        const count = Math.abs(endC - startC) + 1;

        for (let i = 0; i < count; ++i) {
          const c = direction === 'right' ? startC + i : endC - i;
          let val;
          if (rawPattern.type === 'formula') {
            const srcFormula = sourceRaws[i % sourceRaws.length];
            val = adjustFormulaReferences(srcFormula, (direction === 'right' ? i + sourceRaws.length : -(i + sourceRaws.length)), 0);
          } else
            val = generateFillValue(pattern, i);

          const oldVal = _getCellRaw(c, r);
          const oldFmt = Object.assign({}, _getFormat(c, r));
          actions.push({ type: 'cell', col: c, row: r, oldVal, newVal: typeof val === 'number' ? val : String(val), oldFmt, newFmt: Object.assign({}, oldFmt) });
          _setCellData(c, r, typeof val === 'number' ? val : String(val));
          _recalcDependents(_cellKey(c, r));
          const srcFmt = _getFormat(sourceRect.c1 + (i % (sourceRect.c2 - sourceRect.c1 + 1)), r);
          if (Object.keys(srcFmt).length > 0)
            _setFormat(c, r, { ...srcFmt });
        }
      }
    }

    if (actions.length) {
      _pushUndo({ type: 'multi', actions });
      _setDirty();
    }
    _rebuildGrid();
  }

  // ── Data Validation ───────────────────────────────────────────────

  function setValidationRule(col, row, rule) {
    const key = _cellKey(col, row);
    if (rule)
      _S().validationRules[key] = rule;
    else
      delete _S().validationRules[key];
  }

  function getValidationRule(col, row) {
    return _S().validationRules[_cellKey(col, row)] || null;
  }

  function validateCellInput(col, row, value) {
    const rule = getValidationRule(col, row);
    if (!rule) return true;
    if (rule.allowBlank && (value === '' || value == null)) return true;

    switch (rule.type) {
      case 'list':
        return rule.list.includes(String(value));
      case 'whole-number': {
        const n = parseInt(value, 10);
        if (isNaN(n) || n !== parseFloat(value)) return false;
        if (rule.min != null && n < rule.min) return false;
        if (rule.max != null && n > rule.max) return false;
        return true;
      }
      case 'decimal': {
        const n = parseFloat(value);
        if (isNaN(n)) return false;
        if (rule.min != null && n < rule.min) return false;
        if (rule.max != null && n > rule.max) return false;
        return true;
      }
      case 'text-length': {
        const len = String(value).length;
        if (rule.min != null && len < rule.min) return false;
        if (rule.max != null && len > rule.max) return false;
        return true;
      }
      default:
        return true;
    }
  }

  function showValidationDropdown(col, row, td) {
    const rule = getValidationRule(col, row);
    if (!rule || rule.type !== 'list') return;

    const old = document.querySelector('.val-dropdown-list');
    if (old) old.remove();

    const rect = td.getBoundingClientRect();
    const list = document.createElement('div');
    list.className = 'val-dropdown-list';
    list.style.position = 'fixed';
    list.style.left = rect.left + 'px';
    list.style.top = rect.bottom + 'px';
    list.style.minWidth = rect.width + 'px';
    list.style.zIndex = '5000';

    for (const item of rule.list) {
      const opt = document.createElement('div');
      opt.className = 'val-dropdown-item';
      opt.textContent = item;
      opt.addEventListener('click', () => {
        _pushUndo({ type: 'cell', col, row, oldVal: _getCellRaw(col, row), newVal: item, oldFmt: Object.assign({}, _getFormat(col, row)), newFmt: Object.assign({}, _getFormat(col, row)) });
        _setCellData(col, row, item);
        _recalcDependents(_cellKey(col, row));
        _renderCellContent(col, row);
        list.remove();
        _setDirty();
      });
      list.appendChild(opt);
    }

    document.body.appendChild(list);

    const closeHandler = (e) => {
      if (!list.contains(e.target)) {
        list.remove();
        document.removeEventListener('pointerdown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler), 0);
  }

  async function showDataValidationDialog() {
    const ac = _getActiveCell();
    const col = ac.col;
    const row = ac.row;
    const existing = getValidationRule(col, row);

    // Populate dialog fields
    const typeSel = document.getElementById('dv-type');
    const listRow = document.getElementById('dv-list-row');
    const rangeRow = document.getElementById('dv-range-row');
    const listInput = document.getElementById('dv-list-items');
    const minInput = document.getElementById('dv-min');
    const maxInput = document.getElementById('dv-max');
    const blankCheck = document.getElementById('dv-allow-blank');
    const errTitleInput = document.getElementById('dv-err-title');
    const errMsgInput = document.getElementById('dv-err-msg');

    typeSel.value = existing ? existing.type : 'none';
    listInput.value = existing && existing.list ? existing.list.join(', ') : '';
    minInput.value = existing && existing.min != null ? String(existing.min) : '';
    maxInput.value = existing && existing.max != null ? String(existing.max) : '';
    blankCheck.checked = existing ? !!existing.allowBlank : true;
    errTitleInput.value = existing ? existing.errorTitle || '' : '';
    errMsgInput.value = existing ? existing.errorMsg || '' : '';

    const updateVisibility = () => {
      const v = typeSel.value;
      listRow.style.display = v === 'list' ? '' : 'none';
      rangeRow.style.display = (v === 'whole-number' || v === 'decimal' || v === 'text-length') ? '' : 'none';
    };
    typeSel.onchange = updateVisibility;
    updateVisibility();

    const result = await _showDialog('dlg-data-validation');
    if (result !== 'ok') return;

    const type = typeSel.value;
    if (type === 'none') {
      setValidationRule(col, row, null);
      _rebuildGrid();
      return;
    }

    const rule = { type, allowBlank: blankCheck.checked };

    if (type === 'list') {
      const items = listInput.value;
      if (!items) return;
      rule.list = items.split(',').map(s => s.trim());
    } else {
      const minV = minInput.value.trim();
      const maxV = maxInput.value.trim();
      if (minV !== '') rule.min = parseFloat(minV);
      if (maxV !== '') rule.max = parseFloat(maxV);
    }

    const errTitle = errTitleInput.value.trim();
    const errMsg = errMsgInput.value.trim();
    if (errTitle) rule.errorTitle = errTitle;
    if (errMsg) rule.errorMsg = errMsg;

    setValidationRule(col, row, rule);
    _rebuildGrid();
  }

  // ── Text to Columns Wizard ─────────────────────────────────────────

  function showTextToColumnsWizard() {
    const rect = _getSelectionRect();
    const dlgOverlay = document.getElementById('dlg-text-to-columns');
    const step1 = document.getElementById('ttc-step1');
    const step2Delim = document.getElementById('ttc-step2-delim');
    const step2Fixed = document.getElementById('ttc-step2-fixed');
    const backBtn = document.getElementById('ttc-back');
    const nextBtn = document.getElementById('ttc-next');
    const finishBtn = document.getElementById('ttc-finish');
    const previewDiv = document.getElementById('ttc-preview');
    const previewFixedDiv = document.getElementById('ttc-preview-fixed');

    // Gather source data
    const sourceRows = [];
    for (let r = rect.r1; r <= rect.r2; ++r)
      sourceRows.push(String(_getCellRaw(rect.c1, r)));

    let currentStep = 1;
    const fixedBreaks = [];

    function showStep(n) {
      currentStep = n;
      step1.style.display = n === 1 ? '' : 'none';
      step2Delim.style.display = n === 2 && getType() === 'delimited' ? '' : 'none';
      step2Fixed.style.display = n === 2 && getType() === 'fixed' ? '' : 'none';
      backBtn.style.display = n > 1 ? '' : 'none';
      nextBtn.style.display = n === 1 ? '' : 'none';
      finishBtn.style.display = n === 2 ? '' : 'none';
      if (n === 2) updatePreview();
    }

    function getType() {
      return document.querySelector('input[name="ttc-type"]:checked').value;
    }

    function getDelimiters() {
      const delims = [];
      if (document.getElementById('ttc-tab').checked) delims.push('\t');
      if (document.getElementById('ttc-comma').checked) delims.push(',');
      if (document.getElementById('ttc-semicolon').checked) delims.push(';');
      if (document.getElementById('ttc-space').checked) delims.push(' ');
      const other = document.getElementById('ttc-other').value;
      if (other) delims.push(other);
      return delims;
    }

    function splitByDelimiters(text, delims, qualifier) {
      if (!delims.length) return [text];
      const result = [];
      let current = '', inQuote = false;
      for (let i = 0; i < text.length; ++i) {
        const ch = text[i];
        if (qualifier && ch === qualifier) {
          inQuote = !inQuote;
          continue;
        }
        if (!inQuote && delims.includes(ch)) {
          result.push(current);
          current = '';
        } else
          current += ch;
      }
      result.push(current);
      return result;
    }

    function splitByFixed(text, breaks) {
      if (!breaks.length) return [text];
      const sorted = [...breaks].sort((a, b) => a - b);
      const parts = [];
      let prev = 0;
      for (const b of sorted) {
        parts.push(text.substring(prev, b));
        prev = b;
      }
      parts.push(text.substring(prev));
      return parts;
    }

    function updatePreview() {
      if (getType() === 'delimited') {
        const delims = getDelimiters();
        const qualifier = document.getElementById('ttc-qualifier').value;
        let html = '';
        for (const row of sourceRows.slice(0, 10)) {
          const parts = splitByDelimiters(row, delims, qualifier);
          html += parts.map(p => p.padEnd(15)).join('|') + '\n';
        }
        previewDiv.textContent = html;
      } else {
        let html = '';
        for (const row of sourceRows.slice(0, 10))
          html += row + '\n';
        previewFixedDiv.textContent = html;
      }
    }

    // Wire delimiter checkboxes to update preview
    for (const id of ['ttc-tab', 'ttc-comma', 'ttc-semicolon', 'ttc-space']) {
      const el = document.getElementById(id);
      el.onchange = updatePreview;
    }
    document.getElementById('ttc-other').oninput = updatePreview;
    document.getElementById('ttc-qualifier').onchange = updatePreview;

    // Fixed width click handler
    previewFixedDiv.onclick = (e) => {
      const charWidth = 7; // approximate monospace char width
      const clickX = e.offsetX;
      const breakPos = Math.round(clickX / charWidth);
      const idx = fixedBreaks.indexOf(breakPos);
      if (idx >= 0) fixedBreaks.splice(idx, 1);
      else fixedBreaks.push(breakPos);
      updatePreview();
    };

    showStep(1);

    backBtn.onclick = () => showStep(1);
    nextBtn.onclick = () => showStep(2);
    finishBtn.onclick = () => {
      // Perform the split
      const actions = [];
      for (let ri = 0; ri < sourceRows.length; ++ri) {
        const r = rect.r1 + ri;
        let parts;
        if (getType() === 'delimited') {
          const delims = getDelimiters();
          const qualifier = document.getElementById('ttc-qualifier').value;
          parts = splitByDelimiters(sourceRows[ri], delims, qualifier);
        } else
          parts = splitByFixed(sourceRows[ri], fixedBreaks);

        for (let i = 0; i < parts.length; ++i) {
          const c = rect.c1 + i;
          const oldVal = _getCellRaw(c, r);
          const oldFmt = Object.assign({}, _getFormat(c, r));
          const newVal = parts[i].trim();
          actions.push({ type: 'cell', col: c, row: r, oldVal, newVal, oldFmt, newFmt: Object.assign({}, oldFmt) });
          _setCellData(c, r, newVal);
          _recalcDependents(_cellKey(c, r));
        }
      }
      if (actions.length) {
        _pushUndo({ type: 'multi', actions });
        _setDirty();
      }
      _rebuildGrid();
      SZ.Dialog.close('dlg-text-to-columns');
    };

    SZ.Dialog.show('dlg-text-to-columns');
  }

  // ── Remove Duplicates Dialog ────────────────────────────────────────

  function showRemoveDuplicatesDialog() {
    const rect = _getSelectionRect();
    const hasHeaders = document.getElementById('rd-headers');
    const colsDiv = document.getElementById('rd-columns');
    hasHeaders.checked = true;

    function buildColumnList() {
      colsDiv.innerHTML = '';
      const headerRow = hasHeaders.checked ? rect.r1 : -1;
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const label = headerRow >= 0 ? String(_getCellValue(c, headerRow) || _colName(c)) : _colName(c);
        const lbl = document.createElement('label');
        lbl.style.display = 'block';
        lbl.style.fontSize = '11px';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.dataset.col = c;
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(' ' + label));
        colsDiv.appendChild(lbl);
      }
    }

    hasHeaders.onchange = buildColumnList;
    buildColumnList();

    document.getElementById('rd-select-all').onclick = () => {
      colsDiv.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = true);
    };
    document.getElementById('rd-unselect-all').onclick = () => {
      colsDiv.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
    };

    document.getElementById('rd-ok').onclick = () => {
      const selectedCols = [];
      colsDiv.querySelectorAll('input[type=checkbox]:checked').forEach(cb => {
        selectedCols.push(parseInt(cb.dataset.col, 10));
      });
      if (!selectedCols.length) return;

      const startRow = hasHeaders.checked ? rect.r1 + 1 : rect.r1;
      const seen = new Set();
      const toRemove = [];

      for (let r = startRow; r <= rect.r2; ++r) {
        let key = '';
        for (const c of selectedCols) key += String(_getCellValue(c, r)) + '\x00';
        if (seen.has(key)) toRemove.push(r);
        else seen.add(key);
      }

      const actions = [];
      // Shift rows up to fill removed rows
      const allRows = [];
      for (let r = startRow; r <= rect.r2; ++r) {
        if (toRemove.includes(r)) continue;
        const row = [];
        for (let c = rect.c1; c <= rect.c2; ++c)
          row.push({ raw: _getCellRaw(c, r), fmt: Object.assign({}, _getFormat(c, r)) });
        allRows.push(row);
      }

      for (let ri = 0; ri < allRows.length; ++ri) {
        const r = startRow + ri;
        for (let ci = 0; ci < allRows[ri].length; ++ci) {
          const c = rect.c1 + ci;
          const oldVal = _getCellRaw(c, r);
          const oldFmt = Object.assign({}, _getFormat(c, r));
          actions.push({ type: 'cell', col: c, row: r, oldVal, newVal: allRows[ri][ci].raw, oldFmt, newFmt: allRows[ri][ci].fmt });
          _setCellData(c, r, allRows[ri][ci].raw);
          _setFormat(c, r, allRows[ri][ci].fmt);
        }
      }

      // Clear remaining rows
      for (let r = startRow + allRows.length; r <= rect.r2; ++r)
        for (let c = rect.c1; c <= rect.c2; ++c) {
          const oldVal = _getCellRaw(c, r);
          if (oldVal !== '') {
            actions.push({ type: 'cell', col: c, row: r, oldVal, newVal: '', oldFmt: Object.assign({}, _getFormat(c, r)), newFmt: {} });
            _setCellData(c, r, '');
          }
        }

      if (actions.length) {
        _pushUndo({ type: 'multi', actions });
        _setDirty();
      }
      _rebuildGrid();
      SZ.Dialog.close('dlg-remove-duplicates');
      alert(toRemove.length + ' duplicate row(s) removed, ' + allRows.length + ' unique row(s) remaining.');
    };

    SZ.Dialog.show('dlg-remove-duplicates');
  }

  // ── Advanced Sort Dialog ────────────────────────────────────────────

  function showAdvancedSortDialog() {
    const rect = _getSelectionRect();
    const levelsDiv = document.getElementById('as-levels');
    const hasHeaders = document.getElementById('as-headers');
    const caseSensitive = document.getElementById('as-case-sensitive');
    hasHeaders.checked = true;
    caseSensitive.checked = false;
    levelsDiv.innerHTML = '';

    const levels = [];

    function getColumnOptions() {
      let opts = '';
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const label = hasHeaders.checked ? String(_getCellValue(c, rect.r1) || _colName(c)) : _colName(c);
        opts += '<option value="' + c + '">' + label + '</option>';
      }
      return opts;
    }

    function addLevel(col, order) {
      const idx = levels.length;
      const row = document.createElement('div');
      row.className = 'as-level-row';
      row.innerHTML = '<span style="font-size:10px;min-width:50px;">Level ' + (idx + 1) + '</span>' +
        '<select class="as-col" style="flex:1;">' + getColumnOptions() + '</select>' +
        '<select class="as-sort-on"><option value="values">Values</option><option value="color">Cell Color</option></select>' +
        '<select class="as-order"><option value="asc">A to Z</option><option value="desc">Z to A</option></select>';
      if (col !== undefined) row.querySelector('.as-col').value = col;
      if (order) row.querySelector('.as-order').value = order;
      row.onclick = () => {
        levelsDiv.querySelectorAll('.as-level-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
      };
      levelsDiv.appendChild(row);
      levels.push(row);
    }

    addLevel(rect.c1, 'asc');

    hasHeaders.onchange = () => {
      const opts = getColumnOptions();
      levelsDiv.querySelectorAll('.as-col').forEach(sel => {
        const val = sel.value;
        sel.innerHTML = opts;
        sel.value = val;
      });
    };

    document.getElementById('as-add-level').onclick = () => addLevel(rect.c1, 'asc');
    document.getElementById('as-delete-level').onclick = () => {
      const selected = levelsDiv.querySelector('.as-level-row.selected');
      if (selected) {
        const idx = levels.indexOf(selected);
        if (idx >= 0) levels.splice(idx, 1);
        selected.remove();
      }
    };

    document.getElementById('as-ok').onclick = () => {
      if (!levels.length) return;
      const startRow = hasHeaders.checked ? rect.r1 + 1 : rect.r1;
      const isCaseSens = caseSensitive.checked;

      // Gather all rows
      const rows = [];
      for (let r = startRow; r <= rect.r2; ++r) {
        let hasData = false;
        for (let c = rect.c1; c <= rect.c2; ++c)
          if (_getCellRaw(c, r) !== '') { hasData = true; break; }
        if (!hasData) continue;
        const rowData = [];
        for (let c = rect.c1; c <= rect.c2; ++c)
          rowData.push({ raw: _getCellRaw(c, r), fmt: Object.assign({}, _getFormat(c, r)), value: _getCellValue(c, r) });
        rows.push(rowData);
      }

      // Sort by each level
      rows.sort((a, b) => {
        for (const lvl of levels) {
          const col = parseInt(lvl.querySelector('.as-col').value, 10) - rect.c1;
          const asc = lvl.querySelector('.as-order').value === 'asc';
          let va = a[col] ? a[col].value : '';
          let vb = b[col] ? b[col].value : '';
          const na = Number(va), nb = Number(vb);
          if (!isNaN(na) && !isNaN(nb)) {
            if (na !== nb) return asc ? na - nb : nb - na;
          } else {
            let sa = String(va), sb = String(vb);
            if (!isCaseSens) { sa = sa.toLowerCase(); sb = sb.toLowerCase(); }
            const cmp = sa.localeCompare(sb);
            if (cmp !== 0) return asc ? cmp : -cmp;
          }
        }
        return 0;
      });

      // Write back
      const actions = [];
      for (let ri = 0; ri < rows.length; ++ri) {
        const r = startRow + ri;
        for (let ci = 0; ci < rows[ri].length; ++ci) {
          const c = rect.c1 + ci;
          const oldVal = _getCellRaw(c, r);
          const oldFmt = Object.assign({}, _getFormat(c, r));
          actions.push({ type: 'cell', col: c, row: r, oldVal, newVal: rows[ri][ci].raw, oldFmt, newFmt: rows[ri][ci].fmt });
          _setCellData(c, r, rows[ri][ci].raw);
          _setFormat(c, r, rows[ri][ci].fmt);
        }
      }
      if (actions.length) {
        _pushUndo({ type: 'multi', actions });
        _setDirty();
      }
      _rebuildGrid();
      SZ.Dialog.close('dlg-advanced-sort');
    };

    SZ.Dialog.show('dlg-advanced-sort');
  }

  // ── Advanced Filter Dialog ──────────────────────────────────────────

  function showAdvancedFilterDialog() {
    const rect = _getSelectionRect();
    const listInput = document.getElementById('af-list-range');
    const criteriaInput = document.getElementById('af-criteria-range');
    const copyToInput = document.getElementById('af-copy-to');
    const copyRow = document.getElementById('af-copy-row');
    const uniqueCheck = document.getElementById('af-unique');

    listInput.value = _colName(rect.c1) + (rect.r1 + 1) + ':' + _colName(rect.c2) + (rect.r2 + 1);
    criteriaInput.value = '';
    copyToInput.value = '';
    uniqueCheck.checked = false;

    const actionRadios = document.querySelectorAll('input[name="af-action"]');
    actionRadios.forEach(r => r.onchange = () => {
      copyRow.style.display = document.querySelector('input[name="af-action"]:checked').value === 'copy-to' ? '' : 'none';
    });
    copyRow.style.display = 'none';

    function parseRange(str) {
      const parts = str.split(':');
      if (parts.length !== 2) return null;
      const p1 = _parseKey(parts[0].trim().toUpperCase());
      const p2 = _parseKey(parts[1].trim().toUpperCase());
      if (!p1 || !p2) return null;
      return { c1: Math.min(p1.col, p2.col), r1: Math.min(p1.row, p2.row), c2: Math.max(p1.col, p2.col), r2: Math.max(p1.row, p2.row) };
    }

    document.getElementById('af-ok').onclick = () => {
      const listRange = parseRange(listInput.value);
      if (!listRange) { alert('Invalid list range.'); return; }
      const critStr = criteriaInput.value.trim();
      const critRange = critStr ? parseRange(critStr) : null;

      // Determine which rows to hide (filter in place)
      const sheet = _S();
      sheet.hiddenRows.clear();

      // Build criteria from criteria range
      // First row = headers, subsequent rows = OR conditions, columns = AND within each row
      const criteriaRows = [];
      if (critRange) {
        const headers = [];
        for (let c = critRange.c1; c <= critRange.c2; ++c)
          headers.push(String(_getCellValue(c, critRange.r1)).toLowerCase());

        for (let r = critRange.r1 + 1; r <= critRange.r2; ++r) {
          const conditions = [];
          for (let ci = 0; ci < headers.length; ++ci) {
            const val = String(_getCellRaw(critRange.c1 + ci, r)).trim();
            if (val === '') continue;
            // Find matching column in list range
            let listColIdx = -1;
            for (let lc = listRange.c1; lc <= listRange.c2; ++lc)
              if (String(_getCellValue(lc, listRange.r1)).toLowerCase() === headers[ci]) { listColIdx = lc; break; }
            if (listColIdx >= 0)
              conditions.push({ col: listColIdx, criteria: val });
          }
          if (conditions.length) criteriaRows.push(conditions);
        }
      }

      const uniqueSeen = new Set();
      const dataStartRow = listRange.r1 + 1;

      for (let r = dataStartRow; r <= listRange.r2; ++r) {
        let matchesAnyRow = criteriaRows.length === 0;
        for (const conditions of criteriaRows) {
          let allMatch = true;
          for (const cond of conditions) {
            const cellVal = String(_getCellValue(cond.col, r));
            if (!matchesCriteria(cellVal, cond.criteria)) { allMatch = false; break; }
          }
          if (allMatch) { matchesAnyRow = true; break; }
        }

        if (uniqueCheck.checked && matchesAnyRow) {
          let rowKey = '';
          for (let c = listRange.c1; c <= listRange.c2; ++c)
            rowKey += String(_getCellValue(c, r)) + '\x00';
          if (uniqueSeen.has(rowKey)) matchesAnyRow = false;
          else uniqueSeen.add(rowKey);
        }

        if (!matchesAnyRow)
          sheet.hiddenRows.add(r);
      }

      _rebuildGrid();
      SZ.Dialog.close('dlg-advanced-filter');
    };

    SZ.Dialog.show('dlg-advanced-filter');
  }

  function matchesCriteria(cellValue, criteria) {
    const c = String(criteria).trim();
    if (c.startsWith('>=')) return Number(cellValue) >= Number(c.slice(2));
    if (c.startsWith('<=')) return Number(cellValue) <= Number(c.slice(2));
    if (c.startsWith('<>')) return String(cellValue).toLowerCase() !== c.slice(2).toLowerCase();
    if (c.startsWith('>')) return Number(cellValue) > Number(c.slice(1));
    if (c.startsWith('<')) return Number(cellValue) < Number(c.slice(1));
    if (c.startsWith('=')) return String(cellValue).toLowerCase() === c.slice(1).toLowerCase();
    // Wildcard match
    if (c.includes('*') || c.includes('?')) {
      const regex = new RegExp('^' + c.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
      return regex.test(String(cellValue));
    }
    return String(cellValue).toLowerCase() === c.toLowerCase();
  }

  // ── Subtotals ───────────────────────────────────────────────────────

  function showSubtotalsDialog() {
    const rect = _getSelectionRect();
    const groupColSel = document.getElementById('st-group-col');
    const colsDiv = document.getElementById('st-columns');
    groupColSel.innerHTML = '';

    for (let c = rect.c1; c <= rect.c2; ++c) {
      const label = String(_getCellValue(c, rect.r1) || _colName(c));
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = label;
      groupColSel.appendChild(opt);
    }

    colsDiv.innerHTML = '';
    for (let c = rect.c1; c <= rect.c2; ++c) {
      const label = String(_getCellValue(c, rect.r1) || _colName(c));
      const lbl = document.createElement('label');
      lbl.style.display = 'block';
      lbl.style.fontSize = '11px';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.col = c;
      if (c !== parseInt(groupColSel.value, 10)) cb.checked = true;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' ' + label));
      colsDiv.appendChild(lbl);
    }

    document.getElementById('st-ok').onclick = () => {
      const groupByCol = parseInt(groupColSel.value, 10);
      const funcNum = parseInt(document.getElementById('st-function').value, 10);
      const subtotalCols = [];
      colsDiv.querySelectorAll('input[type=checkbox]:checked').forEach(cb => {
        subtotalCols.push(parseInt(cb.dataset.col, 10));
      });
      const replaceExisting = document.getElementById('st-replace').checked;
      const summaryBelow = document.getElementById('st-summary-below').checked;

      insertSubtotals(rect, groupByCol, funcNum, subtotalCols, replaceExisting, summaryBelow);
      SZ.Dialog.close('dlg-subtotals');
    };

    SZ.Dialog.show('dlg-subtotals');
  }

  function insertSubtotals(rect, groupByCol, funcNum, subtotalCols, replaceExisting, summaryBelow) {
    const FUNC_NAMES = { 1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT', 9: 'SUM', 11: 'VARP' };
    const funcName = FUNC_NAMES[funcNum] || 'SUM';
    const dataStartRow = rect.r1 + 1; // assuming headers in first row

    // First remove existing subtotal rows if replaceExisting
    if (replaceExisting) {
      for (let r = rect.r2; r >= dataStartRow; --r) {
        const raw = _getCellRaw(rect.c1, r);
        if (typeof raw === 'string' && raw.toUpperCase().includes('SUBTOTAL('))
          // Clear this row
          for (let c = rect.c1; c <= rect.c2; ++c)
            _setCellData(c, r, '');
      }
    }

    // Sort data by group column first
    const rows = [];
    for (let r = dataStartRow; r <= rect.r2; ++r) {
      let hasData = false;
      for (let c = rect.c1; c <= rect.c2; ++c)
        if (_getCellRaw(c, r) !== '') { hasData = true; break; }
      if (!hasData) continue;
      const rowData = [];
      for (let c = rect.c1; c <= rect.c2; ++c)
        rowData.push({ raw: _getCellRaw(c, r), fmt: Object.assign({}, _getFormat(c, r)) });
      rows.push(rowData);
    }

    rows.sort((a, b) => {
      const va = a[groupByCol - rect.c1] ? a[groupByCol - rect.c1].raw : '';
      const vb = b[groupByCol - rect.c1] ? b[groupByCol - rect.c1].raw : '';
      return String(va).localeCompare(String(vb));
    });

    // Write back sorted data + subtotal rows
    const actions = [];
    let writeRow = dataStartRow;
    let groupStart = writeRow;
    let prevGroupVal = rows.length ? String(rows[0][groupByCol - rect.c1].raw) : '';

    for (let ri = 0; ri < rows.length; ++ri) {
      const currentGroupVal = String(rows[ri][groupByCol - rect.c1].raw);
      if (currentGroupVal !== prevGroupVal) {
        // Insert subtotal row for previous group
        if (summaryBelow) {
          for (let c = rect.c1; c <= rect.c2; ++c) {
            let val = '';
            if (c === groupByCol)
              val = prevGroupVal + ' ' + funcName;
            else if (subtotalCols.includes(c))
              val = '=SUBTOTAL(' + funcNum + ',' + _colName(c) + (groupStart + 1) + ':' + _colName(c) + writeRow + ')';
            const oldVal = _getCellRaw(c, writeRow);
            const oldFmt = Object.assign({}, _getFormat(c, writeRow));
            actions.push({ type: 'cell', col: c, row: writeRow, oldVal, newVal: val, oldFmt, newFmt: { bold: true } });
            _setCellData(c, writeRow, val);
            _setFormat(c, writeRow, { bold: true });
          }
          ++writeRow;
        }
        groupStart = writeRow;
        prevGroupVal = currentGroupVal;
      }

      // Write the data row
      for (let ci = 0; ci < rows[ri].length; ++ci) {
        const c = rect.c1 + ci;
        const oldVal = _getCellRaw(c, writeRow);
        const oldFmt = Object.assign({}, _getFormat(c, writeRow));
        actions.push({ type: 'cell', col: c, row: writeRow, oldVal, newVal: rows[ri][ci].raw, oldFmt, newFmt: rows[ri][ci].fmt });
        _setCellData(c, writeRow, rows[ri][ci].raw);
        _setFormat(c, writeRow, rows[ri][ci].fmt);
      }
      ++writeRow;
    }

    // Final group subtotal
    if (rows.length && summaryBelow) {
      for (let c = rect.c1; c <= rect.c2; ++c) {
        let val = '';
        if (c === groupByCol)
          val = prevGroupVal + ' ' + funcName;
        else if (subtotalCols.includes(c))
          val = '=SUBTOTAL(' + funcNum + ',' + _colName(c) + (groupStart + 1) + ':' + _colName(c) + writeRow + ')';
        const oldVal = _getCellRaw(c, writeRow);
        const oldFmt = Object.assign({}, _getFormat(c, writeRow));
        actions.push({ type: 'cell', col: c, row: writeRow, oldVal, newVal: val, oldFmt, newFmt: { bold: true } });
        _setCellData(c, writeRow, val);
        _setFormat(c, writeRow, { bold: true });
      }
      ++writeRow;
    }

    // Clear any remaining rows
    for (let r = writeRow; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const oldVal = _getCellRaw(c, r);
        if (oldVal !== '') {
          actions.push({ type: 'cell', col: c, row: r, oldVal, newVal: '', oldFmt: Object.assign({}, _getFormat(c, r)), newFmt: {} });
          _setCellData(c, r, '');
        }
      }

    if (actions.length) {
      _pushUndo({ type: 'multi', actions });
      _setDirty();
    }
    _rebuildGrid();
  }

  function removeSubtotals() {
    const sheet = _S();
    const actions = [];
    const toRemove = [];

    // Find all rows with SUBTOTAL formulas
    for (const key in sheet.cellData) {
      const d = sheet.cellData[key];
      if (d && typeof d.raw === 'string' && d.raw.toUpperCase().includes('SUBTOTAL(')) {
        const p = _parseKey(key);
        if (p && !toRemove.includes(p.row))
          toRemove.push(p.row);
      }
    }

    toRemove.sort((a, b) => b - a); // reverse order

    for (const r of toRemove) {
      // Find extent of columns
      let maxC = 0;
      for (const key in sheet.cellData) {
        const p = _parseKey(key);
        if (p && p.row === r && p.col > maxC) maxC = p.col;
      }
      for (let c = 0; c <= maxC; ++c) {
        const oldVal = _getCellRaw(c, r);
        if (oldVal !== '') {
          actions.push({ type: 'cell', col: c, row: r, oldVal, newVal: '', oldFmt: Object.assign({}, _getFormat(c, r)), newFmt: {} });
          _setCellData(c, r, '');
        }
      }
    }

    if (actions.length) {
      _pushUndo({ type: 'multi', actions });
      _setDirty();
    }
    _rebuildGrid();
  }

  // ── Consolidate Dialog ──────────────────────────────────────────────

  function showConsolidateDialog() {
    const refInput = document.getElementById('con-ref');
    const refsList = document.getElementById('con-refs');
    refInput.value = '';
    refsList.innerHTML = '';

    document.getElementById('con-add-ref').onclick = () => {
      const val = refInput.value.trim();
      if (!val) return;
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      refsList.appendChild(opt);
      refInput.value = '';
    };

    document.getElementById('con-delete-ref').onclick = () => {
      const sel = refsList.selectedIndex;
      if (sel >= 0) refsList.remove(sel);
    };

    document.getElementById('con-ok').onclick = () => {
      const funcName = document.getElementById('con-function').value;
      const refs = [];
      for (const opt of refsList.options)
        refs.push(opt.value);
      if (!refs.length) return;

      const ac = _getActiveCell();
      const destCol = ac.col;
      const destRow = ac.row;

      function parseRange(str) {
        const parts = str.split(':');
        if (parts.length !== 2) return null;
        const p1 = _parseKey(parts[0].trim().toUpperCase());
        const p2 = _parseKey(parts[1].trim().toUpperCase());
        if (!p1 || !p2) return null;
        return { c1: Math.min(p1.col, p2.col), r1: Math.min(p1.row, p2.row), c2: Math.max(p1.col, p2.col), r2: Math.max(p1.row, p2.row) };
      }

      // Collect all values by position
      const maxRows = {};
      let maxR = 0, maxC = 0;
      const allData = [];

      for (const ref of refs) {
        const range = parseRange(ref);
        if (!range) continue;
        const data = [];
        for (let r = range.r1; r <= range.r2; ++r) {
          const row = [];
          for (let c = range.c1; c <= range.c2; ++c)
            row.push(_getCellValue(c, r));
          data.push(row);
        }
        allData.push(data);
        const rCnt = range.r2 - range.r1 + 1;
        const cCnt = range.c2 - range.c1 + 1;
        if (rCnt > maxR) maxR = rCnt;
        if (cCnt > maxC) maxC = cCnt;
      }

      // Consolidate by position
      const actions = [];
      for (let r = 0; r < maxR; ++r)
        for (let c = 0; c < maxC; ++c) {
          const values = [];
          for (const data of allData)
            if (data[r] && data[r][c] !== undefined && data[r][c] !== '') {
              const n = Number(data[r][c]);
              if (!isNaN(n)) values.push(n);
            }

          if (!values.length) continue;
          let result;
          switch (funcName) {
            case 'SUM': result = values.reduce((a, b) => a + b, 0); break;
            case 'COUNT': result = values.length; break;
            case 'AVERAGE': result = values.reduce((a, b) => a + b, 0) / values.length; break;
            case 'MAX': result = Math.max(...values); break;
            case 'MIN': result = Math.min(...values); break;
            case 'PRODUCT': result = values.reduce((a, b) => a * b, 1); break;
            default: result = values.reduce((a, b) => a + b, 0);
          }

          const dc = destCol + c, dr = destRow + r;
          const oldVal = _getCellRaw(dc, dr);
          const oldFmt = Object.assign({}, _getFormat(dc, dr));
          actions.push({ type: 'cell', col: dc, row: dr, oldVal, newVal: result, oldFmt, newFmt: Object.assign({}, oldFmt) });
          _setCellData(dc, dr, result);
          _recalcDependents(_cellKey(dc, dr));
        }

      if (actions.length) {
        _pushUndo({ type: 'multi', actions });
        _setDirty();
      }
      _rebuildGrid();
      SZ.Dialog.close('dlg-consolidate');
    };

    SZ.Dialog.show('dlg-consolidate');
  }

  SS.DataTools = {
    init,
    performAutoFill,
    detectFillPattern,
    generateFillValue,
    adjustFormulaReferences,
    setValidationRule,
    getValidationRule,
    validateCellInput,
    showValidationDropdown,
    showDataValidationDialog,
    showTextToColumnsWizard,
    showRemoveDuplicatesDialog,
    showAdvancedSortDialog,
    showAdvancedFilterDialog,
    showSubtotalsDialog,
    removeSubtotals,
    showConsolidateDialog,
  };
})();
