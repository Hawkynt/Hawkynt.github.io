;(function() {
  'use strict';
  const SS = window.SpreadsheetApp || (window.SpreadsheetApp = {});

  let ctx;
  let pageBreakPreview = false;

  function init(c) { ctx = c; }

  // ── Print Area ────────────────────────────────────────────

  function setPrintArea() {
    const rect = ctx.getSelectionRect();
    const sheet = ctx.S();
    ctx.pushUndo();
    sheet.printArea = { c1: rect.c1, r1: rect.r1, c2: rect.c2, r2: rect.r2 };
    ctx.rebuildGrid();
    ctx.setDirty();
  }

  function clearPrintArea() {
    const sheet = ctx.S();
    if (!sheet.printArea) return;
    ctx.pushUndo();
    sheet.printArea = null;
    ctx.rebuildGrid();
    ctx.setDirty();
  }

  async function showSetPrintAreaDialog() {
    const overlay = document.getElementById('dlg-print-area');
    if (!overlay) return;

    // Pre-fill from current selection
    const rect = ctx.getSelectionRect();
    const rangeInput = document.getElementById('pa-range');
    rangeInput.value = ctx.cellKey(rect.c1, rect.r1) + ':' + ctx.cellKey(rect.c2, rect.r2);

    const result = await SZ.Dialog.show(overlay.id);
    if (result !== 'ok') return;

    const rangeStr = rangeInput.value.trim().toUpperCase();
    const parts = rangeStr.split(':');
    if (parts.length !== 2) {
      await ctx.User32.MessageBox('Invalid range format. Use A1:Z100 format.', 'Print Area', 0);
      return;
    }

    const start = ctx.parseKey(parts[0]);
    const end = ctx.parseKey(parts[1]);
    if (!start || !end) {
      await ctx.User32.MessageBox('Invalid cell reference.', 'Print Area', 0);
      return;
    }

    const sheet = ctx.S();
    ctx.pushUndo();
    sheet.printArea = { c1: start.col, r1: start.row, c2: end.col, r2: end.row };
    ctx.rebuildGrid();
    ctx.setDirty();
  }

  // ── Page Breaks ───────────────────────────────────────────

  function insertPageBreakH() {
    const ac = ctx.getActiveCell();
    const sheet = ctx.S();
    if (!sheet.pageBreaksH) sheet.pageBreaksH = [];
    if (!sheet.pageBreaksH.includes(ac.row)) {
      ctx.pushUndo();
      sheet.pageBreaksH.push(ac.row);
      sheet.pageBreaksH.sort((a, b) => a - b);
      ctx.rebuildGrid();
      ctx.setDirty();
    }
  }

  function insertPageBreakV() {
    const ac = ctx.getActiveCell();
    const sheet = ctx.S();
    if (!sheet.pageBreaksV) sheet.pageBreaksV = [];
    if (!sheet.pageBreaksV.includes(ac.col)) {
      ctx.pushUndo();
      sheet.pageBreaksV.push(ac.col);
      sheet.pageBreaksV.sort((a, b) => a - b);
      ctx.rebuildGrid();
      ctx.setDirty();
    }
  }

  function removeAllPageBreaks() {
    const sheet = ctx.S();
    if ((!sheet.pageBreaksH || !sheet.pageBreaksH.length) &&
        (!sheet.pageBreaksV || !sheet.pageBreaksV.length))
      return;
    ctx.pushUndo();
    sheet.pageBreaksH = [];
    sheet.pageBreaksV = [];
    ctx.rebuildGrid();
    ctx.setDirty();
  }

  function togglePageBreakPreview() {
    pageBreakPreview = !pageBreakPreview;
    const grid = document.getElementById('grid-table');
    if (grid)
      grid.classList.toggle('page-break-preview', pageBreakPreview);
    ctx.rebuildGrid();
  }

  // ── Cell rendering helper ─────────────────────────────────

  function applyCellBreakIndicators(td, col, row) {
    const sheet = ctx.S();

    // Page break indicators
    if (sheet.pageBreaksH && sheet.pageBreaksH.includes(row))
      td.classList.add('page-break-h');

    if (sheet.pageBreaksV && sheet.pageBreaksV.includes(col))
      td.classList.add('page-break-v');

    // Print area overlay
    if (pageBreakPreview && sheet.printArea) {
      const pa = sheet.printArea;
      if (col < pa.c1 || col > pa.c2 || row < pa.r1 || row > pa.r2)
        td.classList.add('outside-print-area');
    }
  }

  function isPageBreakPreview() { return pageBreakPreview; }

  // ── Page Setup ──────────────────────────────────────────────

  let pageSetup = {
    orientation: 'portrait',
    paper: 'letter',
    scale: 100,
    marginTop: 0.75,
    marginBottom: 0.75,
    marginLeft: 0.7,
    marginRight: 0.7,
    centerH: false,
    centerV: false,
    header: '',
    footer: '',
    repeatRows: '',
    repeatCols: '',
    gridlines: false,
    headings: false,
  };

  async function showPageSetupDialog() {
    const overlay = document.getElementById('dlg-page-setup');
    if (!overlay) return;

    // Wire tab switching
    const tabs = overlay.querySelectorAll('.ps-tab');
    const panels = overlay.querySelectorAll('.ps-panel');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
        tab.classList.add('active');
        const panel = overlay.querySelector('.ps-panel[data-panel="' + tab.dataset.tab + '"]');
        if (panel) { panel.classList.add('active'); panel.style.display = ''; }
      };
    });

    // Pre-fill from current settings
    const orientRadios = overlay.querySelectorAll('input[name="ps-orient"]');
    for (const r of orientRadios) r.checked = r.value === pageSetup.orientation;
    document.getElementById('ps-paper').value = pageSetup.paper;
    document.getElementById('ps-scale').value = pageSetup.scale;
    document.getElementById('ps-margin-top').value = pageSetup.marginTop;
    document.getElementById('ps-margin-bottom').value = pageSetup.marginBottom;
    document.getElementById('ps-margin-left').value = pageSetup.marginLeft;
    document.getElementById('ps-margin-right').value = pageSetup.marginRight;
    document.getElementById('ps-center-h').checked = pageSetup.centerH;
    document.getElementById('ps-center-v').checked = pageSetup.centerV;
    document.getElementById('ps-header').value = pageSetup.header;
    document.getElementById('ps-footer').value = pageSetup.footer;
    document.getElementById('ps-repeat-rows').value = pageSetup.repeatRows;
    document.getElementById('ps-repeat-cols').value = pageSetup.repeatCols;
    document.getElementById('ps-gridlines').checked = pageSetup.gridlines;
    document.getElementById('ps-headings').checked = pageSetup.headings;

    // Reset to first tab
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
    tabs[0].classList.add('active');
    panels[0].classList.add('active');
    panels[0].style.display = '';

    const result = await SZ.Dialog.show(overlay.id);
    if (result !== 'ok') return;

    // Read values back
    for (const r of orientRadios)
      if (r.checked) pageSetup.orientation = r.value;
    pageSetup.paper = document.getElementById('ps-paper').value;
    pageSetup.scale = parseInt(document.getElementById('ps-scale').value, 10) || 100;
    pageSetup.marginTop = parseFloat(document.getElementById('ps-margin-top').value) || 0.75;
    pageSetup.marginBottom = parseFloat(document.getElementById('ps-margin-bottom').value) || 0.75;
    pageSetup.marginLeft = parseFloat(document.getElementById('ps-margin-left').value) || 0.7;
    pageSetup.marginRight = parseFloat(document.getElementById('ps-margin-right').value) || 0.7;
    pageSetup.centerH = document.getElementById('ps-center-h').checked;
    pageSetup.centerV = document.getElementById('ps-center-v').checked;
    pageSetup.header = document.getElementById('ps-header').value;
    pageSetup.footer = document.getElementById('ps-footer').value;
    pageSetup.repeatRows = document.getElementById('ps-repeat-rows').value;
    pageSetup.repeatCols = document.getElementById('ps-repeat-cols').value;
    pageSetup.gridlines = document.getElementById('ps-gridlines').checked;
    pageSetup.headings = document.getElementById('ps-headings').checked;
  }

  // ── PDF Export ──────────────────────────────────────────────

  function exportToPdf() {
    // Apply print-specific CSS
    const style = document.createElement('style');
    style.id = 'pdf-export-style';

    const paperSizes = {
      letter: { w: '8.5in', h: '11in' },
      a4: { w: '210mm', h: '297mm' },
      legal: { w: '8.5in', h: '14in' },
    };
    const paper = paperSizes[pageSetup.paper] || paperSizes.letter;

    style.textContent = '@media print {\n' +
      '  @page {\n' +
      '    size: ' + paper.w + ' ' + paper.h + (pageSetup.orientation === 'landscape' ? ' landscape' : '') + ';\n' +
      '    margin: ' + pageSetup.marginTop + 'in ' + pageSetup.marginRight + 'in ' + pageSetup.marginBottom + 'in ' + pageSetup.marginLeft + 'in;\n' +
      '  }\n' +
      '  body { zoom: ' + (pageSetup.scale / 100) + '; }\n' +
      (pageSetup.gridlines ? '  .grid-table tbody td.cell { border: 1px solid #ccc !important; }\n' : '') +
      (!pageSetup.headings ? '  .grid-table thead th.corner, .grid-table tbody td.row-header { display: none !important; }\n' : '') +
      (pageSetup.centerH ? '  .grid-table { margin-left: auto; margin-right: auto; }\n' : '') +
      '}\n';

    document.head.appendChild(style);

    // Add header/footer elements
    let headerEl, footerEl;
    const now = new Date();
    const fileName = ctx.currentFileName ? ctx.currentFileName() : 'Untitled';

    function processPlaceholders(text) {
      return text
        .replace(/&P/gi, '1')
        .replace(/&N/gi, '1')
        .replace(/&D/gi, now.toLocaleDateString())
        .replace(/&T/gi, now.toLocaleTimeString())
        .replace(/&F/gi, fileName);
    }

    if (pageSetup.header) {
      headerEl = document.createElement('div');
      headerEl.className = 'ps-print-header';
      headerEl.textContent = processPlaceholders(pageSetup.header);
      document.body.appendChild(headerEl);
    }

    if (pageSetup.footer) {
      footerEl = document.createElement('div');
      footerEl.className = 'ps-print-footer';
      footerEl.textContent = processPlaceholders(pageSetup.footer);
      document.body.appendChild(footerEl);
    }

    window.print();

    // Clean up
    style.remove();
    if (headerEl) headerEl.remove();
    if (footerEl) footerEl.remove();
  }

  SS.PrintLayout = { init, setPrintArea, clearPrintArea, showSetPrintAreaDialog, insertPageBreakH, insertPageBreakV, removeAllPageBreaks, togglePageBreakPreview, applyCellBreakIndicators, isPageBreakPreview, exportToPdf, showPageSetupDialog };
})();
