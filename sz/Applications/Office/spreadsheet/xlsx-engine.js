;(function() {
  'use strict';
  const SS = window.SpreadsheetApp || (window.SpreadsheetApp = {});

  let _S, _cellKey, _parseKey, _colName, _colIndex, _getCellValue, _setCellData, _setFormat, _getFormat;
  let _evaluateFormula, _sheets, _createSheet;
  let _Kernel32, _User32, _MB_OK, _DEFAULT_COL_WIDTH;

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
    _evaluateFormula = ctx.evaluateFormula;
    _sheets = ctx.sheets;
    _createSheet = ctx.createSheet;
    _Kernel32 = ctx.Kernel32;
    _User32 = ctx.User32;
    _MB_OK = ctx.MB_OK;
    _DEFAULT_COL_WIDTH = ctx.DEFAULT_COL_WIDTH;
  }

  // ── XLSX Native Save ─────────────────────────────────────────────

  async function saveAsXlsx(path, callback) {
    try {
      const wb = buildXlsxWorkbook();
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      await _Kernel32.WriteFile(path, new Uint8Array(wbout));
    } catch (err) {
      await _User32.MessageBox('Could not save XLSX: ' + err.message, 'Spreadsheet', _MB_OK);
      return false;
    }
    if (typeof callback === 'function')
      callback();
    return true;
  }

  function buildXlsxWorkbook() {
    const wb = XLSX.utils.book_new();

    for (const sheet of _sheets()) {
      const ws = {};
      let maxCol = -1, maxRow = -1;

      for (const [key, data] of Object.entries(sheet.cellData)) {
        if (data.raw === '' && !sheet.cellFormats[key]) continue;
        const parsed = _parseKey(key);
        if (!parsed) continue;

        const { col, row } = parsed;
        if (col > maxCol) maxCol = col;
        if (row > maxRow) maxRow = row;

        const cellRef = XLSX.utils.encode_cell({ c: col, r: row });
        const cell = { v: data.value, t: 's' };

        if (typeof data.value === 'number') {
          cell.t = 'n';
          cell.v = data.value;
        } else if (typeof data.value === 'boolean')
          cell.t = 'b';
        else if (data.value instanceof Date)
          cell.t = 'd';
        else {
          cell.t = 's';
          cell.v = data.value != null ? String(data.value) : '';
        }

        if (typeof data.raw === 'string' && data.raw.startsWith('='))
          cell.f = data.raw.substring(1);

        const fmt = sheet.cellFormats[key];
        if (fmt) cell.s = _buildXlsxCellStyle(fmt);

        ws[cellRef] = cell;
      }

      if (maxCol >= 0 && maxRow >= 0)
        ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: maxCol, r: maxRow } });
      else
        ws['!ref'] = 'A1';

      if (sheet.mergedCells.length > 0) {
        ws['!merges'] = sheet.mergedCells.map(m => ({
          s: { c: m.c1, r: m.r1 },
          e: { c: m.c2, r: m.r2 }
        }));
      }

      const cols = [];
      for (const [colStr, width] of Object.entries(sheet.colWidths)) {
        const ci = parseInt(colStr, 10);
        if (!cols[ci]) cols[ci] = {};
        cols[ci].wpx = width;
      }
      if (cols.length > 0) ws['!cols'] = cols;

      const rows = [];
      for (const [rowStr, height] of Object.entries(sheet.rowHeights)) {
        const ri = parseInt(rowStr, 10);
        if (!rows[ri]) rows[ri] = {};
        rows[ri].hpx = height;
      }
      if (rows.length > 0) ws['!rows'] = rows;

      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    return wb;
  }

  function _buildXlsxCellStyle(fmt) {
    const s = {};

    const font = {};
    if (fmt.bold) font.bold = true;
    if (fmt.italic) font.italic = true;
    if (fmt.underline) font.underline = true;
    if (fmt.strikethrough) font.strike = true;
    if (fmt.fontSize) font.sz = fmt.fontSize;
    if (fmt.fontFamily) font.name = fmt.fontFamily.split(',')[0].trim();
    if (fmt.textColor) font.color = { rgb: fmt.textColor.replace('#', '') };
    if (Object.keys(font).length > 0) s.font = font;

    if (fmt.bgColor) {
      s.fill = {
        patternType: 'solid',
        fgColor: { rgb: fmt.bgColor.replace('#', '') }
      };
    }

    const alignment = {};
    if (fmt.hAlign || fmt.align) alignment.horizontal = fmt.hAlign || fmt.align;
    if (fmt.vAlign || fmt.valign) alignment.vertical = fmt.vAlign || fmt.valign;
    if (fmt.wrapText) alignment.wrapText = true;
    if (fmt.textRotation) {
      if (fmt.textRotation === 'vertical') alignment.textRotation = 255;
      else alignment.textRotation = parseInt(fmt.textRotation, 10) || 0;
    }
    if (Object.keys(alignment).length > 0) s.alignment = alignment;

    if (fmt.numFmt) s.numFmt = fmt.numFmt;

    if (fmt.borderAll || fmt.borderTop || fmt.borderRight || fmt.borderBottom || fmt.borderLeft) {
      const border = {};
      const allBorder = fmt.borderAll;
      if (allBorder || fmt.borderTop) border.top = { style: (fmt.borderTop || allBorder).style || 'thin', color: { rgb: ((fmt.borderTop || allBorder).color || '#000000').replace('#', '') } };
      if (allBorder || fmt.borderRight) border.right = { style: (fmt.borderRight || allBorder).style || 'thin', color: { rgb: ((fmt.borderRight || allBorder).color || '#000000').replace('#', '') } };
      if (allBorder || fmt.borderBottom) border.bottom = { style: (fmt.borderBottom || allBorder).style || 'thin', color: { rgb: ((fmt.borderBottom || allBorder).color || '#000000').replace('#', '') } };
      if (allBorder || fmt.borderLeft) border.left = { style: (fmt.borderLeft || allBorder).style || 'thin', color: { rgb: ((fmt.borderLeft || allBorder).color || '#000000').replace('#', '') } };
      s.border = border;
    }

    return s;
  }

  // ── XLSX Native Load ─────────────────────────────────────────────

  function loadXlsxWorkbook(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true, cellFormula: true });

    const sheetsArr = _sheets();
    sheetsArr.length = 0;

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const sheet = _createSheet(sheetName);

      if (!ws['!ref']) {
        sheetsArr.push(sheet);
        continue;
      }

      const range = XLSX.utils.decode_range(ws['!ref']);

      for (let r = range.s.r; r <= range.e.r; ++r) {
        for (let c = range.s.c; c <= range.e.c; ++c) {
          const cellRef = XLSX.utils.encode_cell({ c, r });
          const wsCell = ws[cellRef];
          if (!wsCell) continue;

          const key = _cellKey(c, r);
          let raw;
          if (wsCell.f)
            raw = '=' + wsCell.f;
          else if (wsCell.v != null)
            raw = String(wsCell.v);
          else
            raw = '';

          sheet.cellData[key] = { raw, value: wsCell.v != null ? wsCell.v : '', error: false, deps: [] };
          if (c > sheet.maxUsedCol) sheet.maxUsedCol = c;
          if (r > sheet.maxUsedRow) sheet.maxUsedRow = r;

          if (wsCell.s) _importXlsxCellStyle(sheet, key, wsCell.s);
        }
      }

      if (ws['!merges']) {
        sheet.mergedCells = ws['!merges'].map(m => ({
          c1: m.s.c, r1: m.s.r, c2: m.e.c, r2: m.e.r
        }));
      }

      if (ws['!cols']) {
        for (let i = 0; i < ws['!cols'].length; ++i) {
          const col = ws['!cols'][i];
          if (col && col.wpx) sheet.colWidths[i] = col.wpx;
          else if (col && col.wch) sheet.colWidths[i] = Math.round(col.wch * 7 + 12);
        }
      }

      if (ws['!rows']) {
        for (let i = 0; i < ws['!rows'].length; ++i) {
          const row = ws['!rows'][i];
          if (row && row.hpx) sheet.rowHeights[i] = row.hpx;
          else if (row && row.hpt) sheet.rowHeights[i] = Math.round(row.hpt * 4 / 3);
        }
      }

      sheetsArr.push(sheet);
    }

    if (sheetsArr.length === 0) sheetsArr.push(_createSheet());
  }

  function _importXlsxCellStyle(sheet, key, style) {
    const fmt = {};

    if (style.font) {
      if (style.font.bold) fmt.bold = true;
      if (style.font.italic) fmt.italic = true;
      if (style.font.underline) fmt.underline = true;
      if (style.font.strike) fmt.strikethrough = true;
      if (style.font.sz) fmt.fontSize = style.font.sz;
      if (style.font.name) fmt.fontFamily = style.font.name;
      if (style.font.color && style.font.color.rgb) fmt.textColor = '#' + style.font.color.rgb;
    }

    if (style.fill && style.fill.fgColor && style.fill.fgColor.rgb)
      fmt.bgColor = '#' + style.fill.fgColor.rgb;

    if (style.alignment) {
      if (style.alignment.horizontal) fmt.align = style.alignment.horizontal;
      if (style.alignment.vertical) fmt.valign = style.alignment.vertical;
      if (style.alignment.wrapText) fmt.wrapText = true;
      if (style.alignment.textRotation != null) {
        if (style.alignment.textRotation === 255) fmt.textRotation = 'vertical';
        else fmt.textRotation = String(style.alignment.textRotation);
      }
    }

    if (style.numFmt) fmt.numFmt = style.numFmt;

    if (style.border) {
      const mapBorder = (b) => b ? { style: b.style || 'thin', color: b.color && b.color.rgb ? '#' + b.color.rgb : '#000000' } : null;
      const top = mapBorder(style.border.top);
      const right = mapBorder(style.border.right);
      const bottom = mapBorder(style.border.bottom);
      const left = mapBorder(style.border.left);
      if (top) fmt.borderTop = top;
      if (right) fmt.borderRight = right;
      if (bottom) fmt.borderBottom = bottom;
      if (left) fmt.borderLeft = left;
    }

    if (Object.keys(fmt).length > 0) sheet.cellFormats[key] = fmt;
  }

  SS.XlsxEngine = { init, buildXlsxWorkbook, loadXlsxWorkbook, saveAsXlsx };
})();
