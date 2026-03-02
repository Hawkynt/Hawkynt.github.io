;(function() {
  'use strict';
  const SS = window.SpreadsheetApp || (window.SpreadsheetApp = {});

  let _S, _cellKey, _parseKey, _colName, _colIndex, _getCellValue, _setCellData, _setFormat, _getFormat;
  let _getSelectionRect, _showDialog, _rebuildGrid, _setDirty, _getActiveCell, _escapeHtml;
  let _sheets, _createSheet, _activeSheetIdx;

  function init(ctx) {
    _S = ctx.S;
    _cellKey = ctx.cellKey;
    _parseKey = ctx.parseKey;
    _colName = ctx.colName;
    _colIndex = ctx.colIndex;
    _getCellValue = ctx.getCellValue;
    _setCellData = ctx.setCellData;
    _setFormat = ctx.setFormat;
    _getFormat = ctx.getFormat;
    _getSelectionRect = ctx.getSelectionRect;
    _showDialog = ctx.showDialog;
    _rebuildGrid = ctx.rebuildGrid;
    _setDirty = ctx.setDirty;
    _getActiveCell = ctx.getActiveCell;
    _escapeHtml = ctx.escapeHtml;
    _sheets = ctx.sheets;
    _createSheet = ctx.createSheet;
    _activeSheetIdx = ctx.activeSheetIdx;
  }

  function computePivotTable(pt) {
    const allSheets = _sheets();
    const srcSheet = allSheets[pt.sourceSheetIdx];
    if (!srcSheet) return;
    const { c1, r1, c2, r2 } = pt.sourceRange;

    // Extract headers from first row
    const headers = [];
    for (let c = c1; c <= c2; ++c) {
      const key = _cellKey(c, r1);
      const d = srcSheet.cellData[key];
      headers.push(d ? String(d.value) : _colName(c));
    }

    // Extract data rows
    const dataRows = [];
    for (let r = r1 + 1; r <= r2; ++r) {
      const row = {};
      for (let c = c1; c <= c2; ++c) {
        const key = _cellKey(c, r);
        const d = srcSheet.cellData[key];
        row[headers[c - c1]] = d ? d.value : '';
      }
      dataRows.push(row);
    }

    // Identify field assignments
    const rowFields = pt.fields.filter(f => f.zone === 'rows').map(f => f.name);
    const colFields = pt.fields.filter(f => f.zone === 'cols').map(f => f.name);
    const valFields = pt.fields.filter(f => f.zone === 'values');
    const filterFields = pt.fields.filter(f => f.zone === 'filters');

    // Apply filters
    let filtered = dataRows;
    for (const ff of filterFields) {
      if (ff.filterValue != null)
        filtered = filtered.filter(row => String(row[ff.name]) === String(ff.filterValue));
      if (ff.filterValues != null)
        filtered = filtered.filter(row => ff.filterValues.includes(String(row[ff.name])));
    }

    // Group by row fields x column fields
    const groups = {};
    const rowKeys = new Set();
    const colKeys = new Set();

    for (const row of filtered) {
      const rKey = rowFields.map(f => String(row[f] || '')).join('|');
      const cKey = colFields.map(f => String(row[f] || '')).join('|');
      rowKeys.add(rKey);
      colKeys.add(cKey);
      const groupKey = rKey + '~' + cKey;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(row);
    }

    const sortedRowKeys = [...rowKeys].sort();
    const sortedColKeys = [...colKeys].sort();

    // Build output
    const output = { headers: [], rows: [], rowHeaderCount: rowFields.length };

    // Header row
    for (const rf of rowFields) output.headers.push(rf);
    for (const ck of sortedColKeys) {
      for (const vf of valFields)
        output.headers.push((ck ? ck + ' - ' : '') + vf.name + ' (' + (vf.aggregation || 'sum') + ')');
    }
    if (sortedColKeys.length === 0) {
      for (const vf of valFields)
        output.headers.push(vf.name + ' (' + (vf.aggregation || 'sum') + ')');
    }

    // Data rows
    for (const rk of sortedRowKeys) {
      const outRow = [];
      const parts = rk.split('|');
      for (let i = 0; i < rowFields.length; ++i)
        outRow.push(parts[i] || '');

      const colKeysList = sortedColKeys.length > 0 ? sortedColKeys : [''];
      for (const ck of colKeysList) {
        const groupKey = rk + '~' + ck;
        const groupRows = groups[groupKey] || [];
        for (const vf of valFields) {
          const values = groupRows.map(r => {
            const v = r[vf.name];
            return typeof v === 'number' ? v : parseFloat(v);
          }).filter(n => !isNaN(n));
          outRow.push(extractAgg(values, vf.aggregation || 'sum'));
        }
      }
      output.rows.push(outRow);
    }

    // Grand total row
    const totalRow = [];
    for (let i = 0; i < rowFields.length; ++i)
      totalRow.push(i === 0 ? 'Grand Total' : '');
    const colKeysList = sortedColKeys.length > 0 ? sortedColKeys : [''];
    for (const ck of colKeysList) {
      for (const vf of valFields) {
        const allVals = filtered.map(r => {
          const v = r[vf.name];
          return typeof v === 'number' ? v : parseFloat(v);
        }).filter(n => !isNaN(n));
        totalRow.push(extractAgg(allVals, vf.aggregation || 'sum'));
      }
    }
    output.rows.push(totalRow);

    pt.output = output;
  }

  function extractAgg(values, method) {
    if (!values.length) return 0;
    switch (method) {
      case 'sum': return values.reduce((a, b) => a + b, 0);
      case 'count': return values.length;
      case 'average': return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min': return Math.min(...values);
      case 'max': return Math.max(...values);
      default: return values.reduce((a, b) => a + b, 0);
    }
  }

  function renderPivotTable(pt) {
    if (!pt.output) return;
    const { anchorCell } = pt;
    const output = pt.output;

    // Write headers
    for (let c = 0; c < output.headers.length; ++c) {
      const col = anchorCell.col + c;
      const row = anchorCell.row;
      _setCellData(col, row, output.headers[c]);
      _setFormat(col, row, {
        bold: true,
        bgColor: pt.style ? pt.style.headerBg : '#4472c4',
        textColor: pt.style ? pt.style.headerFg : '#ffffff',
      });
    }

    // Write data rows
    for (let r = 0; r < output.rows.length; ++r) {
      const dataRow = output.rows[r];
      const isTotal = r === output.rows.length - 1;
      for (let c = 0; c < dataRow.length; ++c) {
        const col = anchorCell.col + c;
        const row = anchorCell.row + r + 1;
        _setCellData(col, row, dataRow[c]);
        const even = r % 2 === 0;
        const fmt = {};
        if (isTotal) {
          fmt.bold = true;
          fmt.bgColor = pt.style ? pt.style.headerBg : '#4472c4';
          fmt.textColor = pt.style ? pt.style.headerFg : '#ffffff';
        } else if (pt.style) {
          fmt.bgColor = even ? (pt.style.bandEven || '#d9e2f3') : (pt.style.bandOdd || '#ffffff');
        }
        _setFormat(col, row, fmt);
      }
    }
  }

  function showPivotTableDialog() {
    const sel = _getSelectionRect();
    const sourceRange = _cellKey(sel.c1, sel.r1) + ':' + _cellKey(sel.c2, sel.r2);
    document.getElementById('pivot-source').value = sourceRange;

    // Parse source range to get headers
    const fieldsDiv = document.getElementById('pivot-fields-list');
    const rowsZone = document.getElementById('pivot-rows-zone');
    const colsZone = document.getElementById('pivot-cols-zone');
    const valuesZone = document.getElementById('pivot-values-zone');
    fieldsDiv.innerHTML = '';
    rowsZone.innerHTML = '';
    colsZone.innerHTML = '';
    valuesZone.innerHTML = '';

    const pivotFieldAssignments = [];

    function updateFieldsFromRange() {
      const rangeStr = document.getElementById('pivot-source').value.trim();
      const parts = rangeStr.split(':');
      if (parts.length !== 2) return;
      const start = _parseKey(parts[0]);
      const end = _parseKey(parts[1]);
      if (!start || !end) return;

      fieldsDiv.innerHTML = '';
      pivotFieldAssignments.length = 0;

      for (let c = start.col; c <= end.col; ++c) {
        const key = _cellKey(c, start.row);
        const d = _S().cellData[key];
        const name = d ? String(d.value) : _colName(c);
        pivotFieldAssignments.push({ name, zone: null, aggregation: 'sum' });

        const fieldEl = document.createElement('div');
        fieldEl.style.cssText = 'display:flex;align-items:center;gap:4px;margin:2px 0;font-size:10px;';
        fieldEl.innerHTML = '<span style="flex:1;">' + _escapeHtml(name) + '</span>'
          + '<button class="pf-btn" data-zone="rows" style="font-size:9px;padding:0 4px;">Rows</button>'
          + '<button class="pf-btn" data-zone="cols" style="font-size:9px;padding:0 4px;">Cols</button>'
          + '<button class="pf-btn" data-zone="values" style="font-size:9px;padding:0 4px;">Values</button>';

        const idx = pivotFieldAssignments.length - 1;
        for (const btn of fieldEl.querySelectorAll('.pf-btn')) {
          btn.addEventListener('click', () => {
            pivotFieldAssignments[idx].zone = btn.dataset.zone;
            updateZoneDisplays();
          });
        }
        fieldsDiv.appendChild(fieldEl);
      }
    }

    function updateZoneDisplays() {
      rowsZone.innerHTML = pivotFieldAssignments.filter(f => f.zone === 'rows').map(f => '<div style="background:var(--sz-color-highlight);color:var(--sz-color-highlight-text);padding:1px 4px;margin:1px;border-radius:2px;font-size:9px;">' + _escapeHtml(f.name) + '</div>').join('');
      colsZone.innerHTML = pivotFieldAssignments.filter(f => f.zone === 'cols').map(f => '<div style="background:var(--sz-color-highlight);color:var(--sz-color-highlight-text);padding:1px 4px;margin:1px;border-radius:2px;font-size:9px;">' + _escapeHtml(f.name) + '</div>').join('');
      valuesZone.innerHTML = pivotFieldAssignments.filter(f => f.zone === 'values').map(f => {
        return '<div style="background:var(--sz-color-highlight);color:var(--sz-color-highlight-text);padding:1px 4px;margin:1px;border-radius:2px;font-size:9px;display:flex;align-items:center;gap:2px;">'
          + _escapeHtml(f.name)
          + ' <select class="pf-agg" data-name="' + _escapeHtml(f.name) + '" style="font-size:8px;padding:0;">'
          + '<option value="sum">Sum</option><option value="count">Count</option><option value="average">Avg</option><option value="min">Min</option><option value="max">Max</option>'
          + '</select></div>';
      }).join('');

      // Wire aggregation selects
      for (const sel of valuesZone.querySelectorAll('.pf-agg')) {
        sel.addEventListener('change', () => {
          const field = pivotFieldAssignments.find(f => f.name === sel.dataset.name && f.zone === 'values');
          if (field) field.aggregation = sel.value;
        });
      }
    }

    updateFieldsFromRange();
    document.getElementById('pivot-source').addEventListener('change', updateFieldsFromRange);

    const overlay = document.getElementById('dlg-pivot-table');
    _showDialog(overlay.id).then((result) => {
      if (result !== 'ok') return;

      const rangeStr = document.getElementById('pivot-source').value.trim();
      const parts = rangeStr.split(':');
      if (parts.length !== 2) return;
      const start = _parseKey(parts[0]);
      const end = _parseKey(parts[1]);
      if (!start || !end) return;

      const assignedFields = pivotFieldAssignments.filter(f => f.zone);
      if (!assignedFields.length) return;

      const dest = document.getElementById('pivot-dest').value;
      let anchorCell;
      const sourceSheetIdx = _activeSheetIdx();

      if (dest === 'new') {
        const allSheets = _sheets();
        const newSheet = _createSheet();
        allSheets.push(newSheet);
        _activeSheetIdx.set(allSheets.length - 1);
        anchorCell = { col: 0, row: 0 };
      } else {
        const ac = _getActiveCell();
        anchorCell = { col: ac.col, row: ac.row };
      }

      const pt = {
        id: Date.now(),
        sourceSheetIdx: sourceSheetIdx,
        sourceRange: { c1: start.col, r1: start.row, c2: end.col, r2: end.row },
        fields: assignedFields,
        output: null,
        anchorCell,
        style: { headerBg: '#4472c4', headerFg: '#ffffff', bandEven: '#d9e2f3', bandOdd: '#ffffff' },
      };

      computePivotTable(pt);
      _S().pivotTables.push(pt);
      renderPivotTable(pt);
      _rebuildGrid();
      _setDirty();
    });
  }

  function refreshPivotTables() {
    for (const pt of _S().pivotTables) {
      computePivotTable(pt);
      renderPivotTable(pt);
    }
    _rebuildGrid();
  }

  // ── Slicers ──────────────────────────────────────────────────

  const activeSlicers = [];

  function createSlicer(pivotId, fieldName) {
    const pt = _S().pivotTables.find(p => p.id === pivotId);
    if (!pt || !pt.output) return;

    const allSheets = _sheets();
    const srcSheet = allSheets[pt.sourceSheetIdx];
    if (!srcSheet) return;
    const { c1, r1, c2, r2 } = pt.sourceRange;

    // Find column index for this field
    const headers = [];
    for (let c = c1; c <= c2; ++c) {
      const key = _cellKey(c, r1);
      const d = srcSheet.cellData[key];
      headers.push(d ? String(d.value) : _colName(c));
    }
    const fieldCol = headers.indexOf(fieldName);
    if (fieldCol < 0) return;

    // Collect unique values
    const uniqueVals = new Set();
    for (let r = r1 + 1; r <= r2; ++r) {
      const key = _cellKey(c1 + fieldCol, r);
      const d = srcSheet.cellData[key];
      uniqueVals.add(d ? String(d.value) : '');
    }

    // Create slicer panel -- stagger position based on active slicer count
    const panel = document.createElement('div');
    panel.className = 'slicer-panel';
    panel.style.top = (100 + activeSlicers.length * 30) + 'px';
    panel.style.right = (20 + activeSlicers.length * 15) + 'px';

    const title = document.createElement('div');
    title.className = 'slicer-panel-title';
    title.textContent = fieldName;

    // Drag support for slicer panel
    let dragOffsetX = 0, dragOffsetY = 0;
    title.addEventListener('pointerdown', (e) => {
      if (e.target === closeBtn) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      title.setPointerCapture(e.pointerId);
    });
    title.addEventListener('pointermove', (e) => {
      if (!title.hasPointerCapture(e.pointerId)) return;
      panel.style.left = (e.clientX - dragOffsetX) + 'px';
      panel.style.top = (e.clientY - dragOffsetY) + 'px';
      panel.style.right = 'auto';
    });
    title.addEventListener('pointerup', (e) => {
      if (title.hasPointerCapture(e.pointerId))
        title.releasePointerCapture(e.pointerId);
    });

    const closeBtn = document.createElement('span');
    closeBtn.className = 'slicer-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', () => {
      panel.remove();
      const idx = activeSlicers.indexOf(slicer);
      if (idx >= 0) activeSlicers.splice(idx, 1);
      // Remove filter and refresh
      const filterField = pt.fields.find(f => f.name === fieldName && f.zone === 'filters');
      if (filterField) {
        const fi = pt.fields.indexOf(filterField);
        pt.fields.splice(fi, 1);
      }
      computePivotTable(pt);
      renderPivotTable(pt);
      _rebuildGrid();
    });
    title.appendChild(closeBtn);
    panel.appendChild(title);

    const body = document.createElement('div');
    body.className = 'slicer-panel-body';

    const selectedValues = new Set([...uniqueVals]);

    for (const val of [...uniqueVals].sort()) {
      const item = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.addEventListener('change', () => {
        if (cb.checked) {
          selectedValues.add(val);
          item.classList.remove('slicer-item-deselected');
        } else {
          selectedValues.delete(val);
          item.classList.add('slicer-item-deselected');
        }

        // Update pivot filter
        let filterField = pt.fields.find(f => f.name === fieldName && f.zone === 'filters');
        if (!filterField) {
          filterField = { name: fieldName, zone: 'filters', filterValues: null };
          pt.fields.push(filterField);
        }
        if (selectedValues.size === uniqueVals.size)
          filterField.filterValues = null;
        else
          filterField.filterValues = [...selectedValues];

        // Re-compute with filter
        const filteredData = filterPivotData(pt);
        computePivotTable(pt);
        renderPivotTable(pt);
        _rebuildGrid();
      });
      item.appendChild(cb);
      item.appendChild(document.createTextNode(' ' + (val || '(Blank)')));
      body.appendChild(item);
    }
    panel.appendChild(body);

    // Clear filter button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'slicer-clear-btn';
    clearBtn.textContent = 'Clear Filter';
    clearBtn.addEventListener('click', () => {
      selectedValues.clear();
      for (const v of uniqueVals) selectedValues.add(v);
      for (const cb of body.querySelectorAll('input[type="checkbox"]'))
        cb.checked = true;
      for (const lbl of body.querySelectorAll('label'))
        lbl.classList.remove('slicer-item-deselected');
      let filterField = pt.fields.find(f => f.name === fieldName && f.zone === 'filters');
      if (filterField) filterField.filterValues = null;
      computePivotTable(pt);
      renderPivotTable(pt);
      _rebuildGrid();
    });
    panel.appendChild(clearBtn);

    document.body.appendChild(panel);

    const slicer = { pivotId, fieldName, panel, selectedValues };
    activeSlicers.push(slicer);
    return slicer;
  }

  function filterPivotData(pt) {
    // Filters are already handled inside computePivotTable via filterFields
    return null;
  }

  // ── Pivot Chart ─────────────────────────────────────────────

  function createPivotChart(pivotId, chartType) {
    const pt = _S().pivotTables.find(p => p.id === pivotId);
    if (!pt || !pt.output) return;

    const output = pt.output;
    if (!output.rows.length || !output.headers.length) return;

    // Extract labels (row keys) and data columns
    const labels = output.rows.slice(0, -1).map(r => r.slice(0, output.rowHeaderCount).join(' - '));
    const dataCols = output.headers.slice(output.rowHeaderCount);
    const datasets = [];

    for (let ci = 0; ci < dataCols.length; ++ci) {
      const data = output.rows.slice(0, -1).map(r => {
        const v = r[output.rowHeaderCount + ci];
        return typeof v === 'number' ? v : parseFloat(v) || 0;
      });
      datasets.push({ label: dataCols[ci], data });
    }

    // Use ChartEngine to render
    const ChartEngine = SS.ChartEngine;
    if (ChartEngine && ChartEngine.showInlineChart) {
      const chartData = { labels, datasets, type: chartType || 'bar' };
      ChartEngine.renderPivotChart(chartData);
    }
  }

  // ── Field Grouping ──────────────────────────────────────────

  function groupField(pivotId, fieldName, groupBy) {
    const pt = _S().pivotTables.find(p => p.id === pivotId);
    if (!pt) return;

    // Store grouping configuration on the field
    const field = pt.fields.find(f => f.name === fieldName);
    if (!field) return;
    field.groupBy = groupBy;

    // Re-compute: the grouping is applied during data extraction
    const allSheets = _sheets();
    const srcSheet = allSheets[pt.sourceSheetIdx];
    if (!srcSheet) return;
    const { c1, r1, c2, r2 } = pt.sourceRange;

    const headers = [];
    for (let c = c1; c <= c2; ++c) {
      const key = _cellKey(c, r1);
      const d = srcSheet.cellData[key];
      headers.push(d ? String(d.value) : _colName(c));
    }
    const fieldCol = headers.indexOf(fieldName);
    if (fieldCol < 0) return;

    // Apply grouping to source data by modifying values temporarily
    for (let r = r1 + 1; r <= r2; ++r) {
      const key = _cellKey(c1 + fieldCol, r);
      const d = srcSheet.cellData[key];
      if (!d) continue;
      const val = d.value;

      if (groupBy === 'year' || groupBy === 'quarter' || groupBy === 'month' || groupBy === 'day') {
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          if (!d._originalValue) d._originalValue = val;
          if (groupBy === 'year') d.value = String(date.getFullYear());
          else if (groupBy === 'quarter') d.value = 'Q' + (Math.floor(date.getMonth() / 3) + 1) + ' ' + date.getFullYear();
          else if (groupBy === 'month') d.value = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear();
          else if (groupBy === 'day') d.value = date.toLocaleDateString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }
      }
    }

    computePivotTable(pt);
    renderPivotTable(pt);
    _rebuildGrid();
    _setDirty();
  }

  // ── Drill-Down ──────────────────────────────────────────────

  function drillDown(pivotId, rowIdx, colIdx) {
    const pt = _S().pivotTables.find(p => p.id === pivotId);
    if (!pt || !pt.output) return;

    const output = pt.output;
    if (rowIdx >= output.rows.length - 1) return; // Skip grand total

    const rowFields = pt.fields.filter(f => f.zone === 'rows').map(f => f.name);
    const colFields = pt.fields.filter(f => f.zone === 'cols').map(f => f.name);
    const rowValues = output.rows[rowIdx].slice(0, rowFields.length);

    // Get source data
    const allSheets = _sheets();
    const srcSheet = allSheets[pt.sourceSheetIdx];
    if (!srcSheet) return;
    const { c1, r1, c2, r2 } = pt.sourceRange;

    const headers = [];
    for (let c = c1; c <= c2; ++c) {
      const key = _cellKey(c, r1);
      const d = srcSheet.cellData[key];
      headers.push(d ? String(d.value) : _colName(c));
    }

    // Filter source rows matching the drill-down criteria
    const matchingRows = [];
    for (let r = r1 + 1; r <= r2; ++r) {
      let match = true;
      for (let i = 0; i < rowFields.length; ++i) {
        const fi = headers.indexOf(rowFields[i]);
        if (fi < 0) continue;
        const key = _cellKey(c1 + fi, r);
        const d = srcSheet.cellData[key];
        const val = d ? String(d.value) : '';
        if (val !== String(rowValues[i])) { match = false; break; }
      }
      if (!match) continue;

      const rowData = [];
      for (let c = c1; c <= c2; ++c) {
        const key = _cellKey(c, r);
        const d = srcSheet.cellData[key];
        rowData.push(d ? d.value : '');
      }
      matchingRows.push(rowData);
    }

    // Create new sheet with detail data
    const newSheet = _createSheet('Detail - ' + rowValues.join(', '));
    allSheets.push(newSheet);
    const newIdx = allSheets.length - 1;
    _activeSheetIdx.set(newIdx);

    // Write headers
    for (let c = 0; c < headers.length; ++c) {
      _setCellData(c, 0, headers[c]);
      _setFormat(c, 0, { bold: true, bgColor: '#4472c4', textColor: '#ffffff' });
    }

    // Write data
    for (let r = 0; r < matchingRows.length; ++r)
      for (let c = 0; c < matchingRows[r].length; ++c)
        _setCellData(c, r + 1, matchingRows[r][c] === '' ? '' : String(matchingRows[r][c]));

    _rebuildGrid();
    _setDirty();
  }

  // ── Slicer Dialog ────────────────────────────────────────────

  function showSlicerDialog() {
    const pts = _S().pivotTables;
    if (!pts.length) {
      alert('No pivot tables on this sheet. Create a pivot table first.');
      return;
    }
    const pt = pts[pts.length - 1];
    if (!pt.output) {
      computePivotTable(pt);
      if (!pt.output) return;
    }

    // Get headers from source
    const allSheets = _sheets();
    const srcSheet = allSheets[pt.sourceSheetIdx];
    if (!srcSheet) return;
    const { c1, r1, c2, r2 } = pt.sourceRange;
    const headers = [];
    for (let c = c1; c <= c2; ++c) {
      const key = _cellKey(c, r1);
      const d = srcSheet.cellData[key];
      headers.push(d ? String(d.value) : _colName(c));
    }

    // Try proper dialog first, fall back to prompt
    const dlg = document.getElementById('dlg-pivot-slicer');
    if (dlg) {
      const sel = document.getElementById('slicer-field-select');
      const preview = document.getElementById('slicer-field-preview');
      sel.innerHTML = '';
      for (const h of headers) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h;
        sel.appendChild(opt);
      }

      // Show preview of unique values for selected field
      function updatePreview() {
        const fieldName = sel.value;
        const fieldCol = headers.indexOf(fieldName);
        if (fieldCol < 0) { preview.innerHTML = ''; return; }
        const vals = new Set();
        for (let r = r1 + 1; r <= r2; ++r) {
          const key = _cellKey(c1 + fieldCol, r);
          const d = srcSheet.cellData[key];
          vals.add(d ? String(d.value) : '');
        }
        const sorted = [...vals].sort();
        preview.innerHTML = '<b>' + sorted.length + ' unique values:</b><br>' + sorted.slice(0, 20).map(v => _escapeHtml(v || '(Blank)')).join(', ') + (sorted.length > 20 ? ', ...' : '');
      }
      sel.onchange = updatePreview;
      updatePreview();

      _showDialog(dlg.id).then((result) => {
        if (result !== 'ok') return;
        const fieldName = sel.value;
        if (!fieldName || !headers.includes(fieldName)) return;
        createSlicer(pt.id, fieldName);
      });
    } else {
      // Fallback to prompt
      const fieldName = prompt('Enter field name for slicer:\n\nAvailable fields: ' + headers.join(', '));
      if (!fieldName || !fieldName.trim()) return;
      const trimmed = fieldName.trim();
      if (!headers.includes(trimmed)) {
        alert('Field "' + trimmed + '" not found in source data.');
        return;
      }
      createSlicer(pt.id, trimmed);
    }
  }

  // ── Group Field Dialog ─────────────────────────────────────

  function showGroupFieldDialog() {
    const pts = _S().pivotTables;
    if (!pts.length) {
      alert('No pivot tables on this sheet. Create a pivot table first.');
      return;
    }
    const pt = pts[pts.length - 1];

    // Get assigned row/col fields
    const assignedFields = pt.fields.filter(f => f.zone === 'rows' || f.zone === 'cols');
    if (!assignedFields.length) {
      alert('No row or column fields assigned to the pivot table.');
      return;
    }

    const fieldNames = assignedFields.map(f => f.name);

    // Try proper dialog first, fall back to prompt
    const dlg = document.getElementById('dlg-pivot-group-field');
    if (dlg) {
      const fieldSel = document.getElementById('group-field-select');
      const typeSel = document.getElementById('group-type-select');
      const numOpts = document.getElementById('group-numeric-opts');
      const rangeSizeInput = document.getElementById('group-range-size');

      fieldSel.innerHTML = '';
      for (const fn of fieldNames) {
        const opt = document.createElement('option');
        opt.value = fn;
        opt.textContent = fn;
        fieldSel.appendChild(opt);
      }

      typeSel.value = 'year';
      rangeSizeInput.value = '10';
      numOpts.style.display = 'none';

      typeSel.onchange = () => {
        numOpts.style.display = typeSel.value === 'numeric' ? 'block' : 'none';
      };

      _showDialog(dlg.id).then((result) => {
        if (result !== 'ok') return;
        const fieldName = fieldSel.value;
        if (!fieldName || !fieldNames.includes(fieldName)) return;
        const type = typeSel.value;

        if (type === 'numeric') {
          const rangeSize = parseInt(rangeSizeInput.value, 10) || 10;
          groupFieldNumeric(pt.id, fieldName, rangeSize);
        } else {
          groupField(pt.id, fieldName, type);
        }
      });
    } else {
      // Fallback to prompt
      const fieldName = prompt('Enter field name to group:\n\nRow/Column fields: ' + fieldNames.join(', '));
      if (!fieldName || !fieldName.trim()) return;
      const trimmed = fieldName.trim();
      if (!fieldNames.includes(trimmed)) {
        alert('Field "' + trimmed + '" is not a row or column field.');
        return;
      }

      const groupType = prompt('Enter group type:\n\n- year (group dates by year)\n- quarter (group dates by quarter)\n- month (group dates by month)\n- day (group dates by day)\n- numeric (group numbers into ranges)', 'year');
      if (!groupType || !groupType.trim()) return;

      const type = groupType.trim().toLowerCase();
      if (type === 'numeric') {
        const rangeSize = prompt('Enter range size (e.g., 10 for 0-10, 10-20, ...):', '10');
        if (!rangeSize) return;
        groupFieldNumeric(pt.id, trimmed, parseInt(rangeSize, 10) || 10);
      } else {
        groupField(pt.id, trimmed, type);
      }
    }
  }

  // ── Numeric field grouping ─────────────────────────────────

  function groupFieldNumeric(pivotId, fieldName, rangeSize) {
    const pt = _S().pivotTables.find(p => p.id === pivotId);
    if (!pt) return;

    const field = pt.fields.find(f => f.name === fieldName);
    if (!field) return;
    field.groupBy = 'numeric';
    field.groupRangeSize = rangeSize;

    const allSheets = _sheets();
    const srcSheet = allSheets[pt.sourceSheetIdx];
    if (!srcSheet) return;
    const { c1, r1, c2, r2 } = pt.sourceRange;

    const headers = [];
    for (let c = c1; c <= c2; ++c) {
      const key = _cellKey(c, r1);
      const d = srcSheet.cellData[key];
      headers.push(d ? String(d.value) : _colName(c));
    }
    const fieldCol = headers.indexOf(fieldName);
    if (fieldCol < 0) return;

    for (let r = r1 + 1; r <= r2; ++r) {
      const key = _cellKey(c1 + fieldCol, r);
      const d = srcSheet.cellData[key];
      if (!d) continue;
      const val = d.value;
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (!isNaN(num)) {
        if (!d._originalValue) d._originalValue = val;
        const bucket = Math.floor(num / rangeSize) * rangeSize;
        d.value = bucket + '-' + (bucket + rangeSize);
      }
    }

    computePivotTable(pt);
    renderPivotTable(pt);
    _rebuildGrid();
    _setDirty();
  }

  // ── Drill-Down from UI ─────────────────────────────────────

  function showDrillDownDialog() {
    const pts = _S().pivotTables;
    if (!pts.length) {
      alert('No pivot tables on this sheet.');
      return;
    }
    const pt = pts[pts.length - 1];
    if (!pt.output || !pt.output.rows.length) {
      alert('Pivot table has no data. Refresh first.');
      return;
    }

    const ac = _getActiveCell();
    const anchorRow = pt.anchorCell.row;
    const anchorCol = pt.anchorCell.col;
    const rowIdx = ac.row - anchorRow - 1;
    const colIdx = ac.col - anchorCol;

    if (rowIdx < 0 || rowIdx >= pt.output.rows.length - 1) {
      alert('Click on a pivot data cell, then use Drill-Down.\nCurrent cell is not inside the pivot data area.');
      return;
    }

    drillDown(pt.id, rowIdx, colIdx);
  }

  SS.PivotEngine = { init, showPivotTableDialog, refreshPivotTables, computePivotTable, renderPivotTable, createSlicer, createPivotChart, groupField, drillDown, showSlicerDialog, showGroupFieldDialog, showDrillDownDialog };
})();
