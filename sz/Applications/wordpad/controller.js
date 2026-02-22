;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // ═══════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════

  let currentFilePath = null;
  let currentFileName = 'Untitled';
  let dirty = false;
  let savedContent = '';
  let currentZoom = 100;
  let currentLineSpacing = 1.15;

  const editor = document.getElementById('editor');
  const editorWrapper = document.getElementById('editor-wrapper');

  const FILE_FILTERS = [
    { name: 'Rich Text', ext: ['html', 'htm'] },
    { name: 'RTF Files', ext: ['rtf'] },
    { name: 'Text Files', ext: ['txt'] },
    { name: 'All Files', ext: ['*'] }
  ];

  const FONT_FAMILIES = [
    'Arial', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas',
    'Courier New', 'Georgia', 'Impact', 'Lucida Console',
    'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman',
    'Trebuchet MS', 'Verdana'
  ];

  const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

  const SYMBOLS = [
    '\u00A9', '\u00AE', '\u2122', '\u00B0', '\u00B1', '\u00D7', '\u00F7',
    '\u2018', '\u2019', '\u201C', '\u201D', '\u2026', '\u2013', '\u2014',
    '\u2190', '\u2191', '\u2192', '\u2193', '\u2194', '\u21D0', '\u21D2',
    '\u2200', '\u2202', '\u2203', '\u2205', '\u2207', '\u2208', '\u2209',
    '\u220F', '\u2211', '\u221A', '\u221E', '\u2227', '\u2228', '\u2229',
    '\u222A', '\u222B', '\u2248', '\u2260', '\u2261', '\u2264', '\u2265',
    '\u2302', '\u2318', '\u2320', '\u2321', '\u2500', '\u2502', '\u250C',
    '\u2510', '\u2514', '\u2518', '\u253C', '\u25A0', '\u25B2', '\u25BC',
    '\u25C6', '\u25CF', '\u2605', '\u2606', '\u2660', '\u2663', '\u2665',
    '\u2666', '\u266A', '\u266B', '\u03B1', '\u03B2', '\u03B3', '\u03B4',
    '\u03B5', '\u03B6', '\u03B7', '\u03B8', '\u03BB', '\u03BC', '\u03C0',
    '\u03C3', '\u03C6', '\u03C8', '\u03C9', '\u0394', '\u03A3', '\u03A9',
  ];

  // ═══════════════════════════════════════════════════════════════
  // Title & Dirty Tracking
  // ═══════════════════════════════════════════════════════════════

  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - WordPad';
    document.title = title;
    User32.SetWindowText(title);
  }

  function markDirty() {
    const nowDirty = editor.innerHTML !== savedContent;
    if (nowDirty !== dirty) {
      dirty = nowDirty;
      updateTitle();
    }
  }

  editor.addEventListener('input', () => {
    markDirty();
    updateStatusBar();
  });

  // ═══════════════════════════════════════════════════════════════
  // Action Router
  // ═══════════════════════════════════════════════════════════════

  function handleAction(action) {
    switch (action) {
      // File
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'print': window.print(); break;
      case 'import-docx': doImportDocx(); break;
      case 'import-rtf': doImportRtf(); break;
      case 'export-txt': doExportTxt(); break;
      case 'export-html': doExportHtml(); break;
      case 'export-docx': doExportDocx(); break;
      case 'export-rtf': doExportRtf(); break;
      case 'export-pdf': doExportPdf(); break;
      case 'exit': doExit(); break;
      case 'about': SZ.Dialog.show('dlg-about'); break;

      // Edit
      case 'undo': document.execCommand('undo'); editor.focus(); break;
      case 'redo': document.execCommand('redo'); editor.focus(); break;
      case 'cut': document.execCommand('cut'); editor.focus(); break;
      case 'copy': document.execCommand('copy'); editor.focus(); break;
      case 'paste': document.execCommand('paste'); editor.focus(); break;
      case 'paste-special': showPasteSpecialPopup(); break;
      case 'select-all': document.execCommand('selectAll'); editor.focus(); break;
      case 'find': showFindReplace('find'); break;
      case 'replace': showFindReplace('replace'); break;
      case 'clear-formatting': doClearFormatting(); break;

      // Paragraph
      case 'line-spacing': showLineSpacingPopup(); break;
      case 'borders': showBordersPopup(); break;
      case 'shading': doShading(); break;

      // Insert
      case 'insert-table': showInsertTableDialog(); break;
      case 'insert-image-url': showInsertImageDialog(); break;
      case 'insert-image-file': doInsertImageFile(); break;
      case 'insert-textbox': doInsertTextbox(); break;
      case 'insert-shape-rect': doInsertShape('rect'); break;
      case 'insert-shape-circle': doInsertShape('circle'); break;
      case 'insert-shape-line': doInsertShape('line'); break;
      case 'insert-link': showInsertLinkDialog(); break;
      case 'insert-bookmark': showInsertBookmarkDialog(); break;
      case 'insert-header': doInsertHeader(); break;
      case 'insert-footer': doInsertFooter(); break;
      case 'insert-page-number': doInsertPageNumber(); break;
      case 'insert-symbol': showSymbolDialog(); break;
      case 'insert-hr': doInsertHR(); break;
      case 'insert-page-break': doInsertPageBreak(); break;
      case 'insert-datetime': doInsertDateTime(); break;

      // Page Layout
      case 'watermark': showWatermarkDialog(); break;

      // View / Zoom
      case 'zoom-in': setZoom(Math.min(500, currentZoom + 10)); break;
      case 'zoom-out': setZoom(Math.max(25, currentZoom - 10)); break;
      case 'zoom-100': setZoom(100); break;
      case 'zoom-page-width': setZoom(calcPageWidthZoom()); break;
      case 'zoom-full-page': setZoom(calcFullPageZoom(1)); break;
      case 'zoom-two-pages': setZoom(calcFullPageZoom(2)); break;
    }
    updateRibbonState();
  }

  // ═══════════════════════════════════════════════════════════════
  // Ribbon wiring (shared module)
  // ═══════════════════════════════════════════════════════════════

  new SZ.Ribbon({ onAction: handleAction });
  SZ.Dialog.wireAll();

  // Prevent ribbon buttons from stealing editor focus
  for (const btn of document.querySelectorAll('.rb-btn[data-action], .rb-btn[data-cmd]'))
    btn.addEventListener('pointerdown', (e) => e.preventDefault());

  // ═══════════════════════════════════════════════════════════════
  // Format Command Buttons (data-cmd)
  // ═══════════════════════════════════════════════════════════════

  for (const btn of document.querySelectorAll('.rb-btn[data-cmd]')) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, null);
      editor.focus();
      updateRibbonState();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Font Family / Size Dropdowns
  // ═══════════════════════════════════════════════════════════════

  const fontFamilySelect = document.getElementById('rb-font-family');
  const fontSizeSelect = document.getElementById('rb-font-size');

  // Populate font families
  for (const family of FONT_FAMILIES) {
    const opt = document.createElement('option');
    opt.value = family;
    opt.textContent = family;
    opt.style.fontFamily = family;
    fontFamilySelect.appendChild(opt);
  }
  fontFamilySelect.value = 'Calibri';

  // Populate font sizes
  for (const size of FONT_SIZES) {
    const opt = document.createElement('option');
    opt.value = size;
    opt.textContent = size;
    fontSizeSelect.appendChild(opt);
  }
  fontSizeSelect.value = '11';

  fontFamilySelect.addEventListener('change', () => {
    document.execCommand('fontName', false, fontFamilySelect.value);
    editor.focus();
  });

  fontSizeSelect.addEventListener('change', () => {
    applyFontSizePt(parseInt(fontSizeSelect.value, 10));
    editor.focus();
  });

  function applyFontSizePt(pt) {
    // execCommand fontSize only supports 1-7; use CSS for precise sizes
    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;

    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      // For collapsed selection, set default for next typing
      document.execCommand('fontSize', false, '7');
      const fontElements = editor.querySelectorAll('font[size="7"]');
      for (const el of fontElements) {
        el.removeAttribute('size');
        el.style.fontSize = pt + 'pt';
      }
      return;
    }

    document.execCommand('fontSize', false, '7');
    const fontElements = editor.querySelectorAll('font[size="7"]');
    for (const el of fontElements) {
      el.removeAttribute('size');
      el.style.fontSize = pt + 'pt';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Color Pickers
  // ═══════════════════════════════════════════════════════════════

  const fontColorInput = document.getElementById('rb-font-color');
  const fontColorSwatch = document.getElementById('rb-font-color-swatch');
  const highlightColorInput = document.getElementById('rb-highlight-color');
  const highlightSwatch = document.getElementById('rb-highlight-swatch');

  // Color inputs are visually hidden; open via parent click
  fontColorSwatch.parentElement.addEventListener('click', () => fontColorInput.click());
  highlightSwatch.parentElement.addEventListener('click', () => highlightColorInput.click());

  fontColorInput.addEventListener('input', () => {
    document.execCommand('foreColor', false, fontColorInput.value);
    fontColorSwatch.style.background = fontColorInput.value;
    editor.focus();
  });

  highlightColorInput.addEventListener('input', () => {
    document.execCommand('hiliteColor', false, highlightColorInput.value);
    highlightSwatch.style.background = highlightColorInput.value;
    editor.focus();
  });

  // ═══════════════════════════════════════════════════════════════
  // Style Dropdown
  // ═══════════════════════════════════════════════════════════════

  const stylesSelect = document.getElementById('rb-styles');

  stylesSelect.addEventListener('change', () => {
    const tag = stylesSelect.value;
    document.execCommand('formatBlock', false, '<' + tag + '>');
    editor.focus();
    updateRibbonState();
  });

  // ═══════════════════════════════════════════════════════════════
  // Ribbon State Updater
  // ═══════════════════════════════════════════════════════════════

  function updateRibbonState() {
    const toggleCmds = [
      'bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript',
      'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
      'insertUnorderedList', 'insertOrderedList'
    ];

    for (const cmd of toggleCmds) {
      const btn = document.querySelector('.rb-btn[data-cmd="' + cmd + '"]');
      if (!btn)
        continue;
      if (document.queryCommandState(cmd))
        btn.classList.add('active');
      else
        btn.classList.remove('active');
    }

    // Font family
    const fontName = document.queryCommandValue('fontName');
    if (fontName) {
      const clean = fontName.replace(/"/g, '').replace(/'/g, '');
      for (const opt of fontFamilySelect.options) {
        if (clean.toLowerCase().indexOf(opt.value.toLowerCase()) !== -1) {
          fontFamilySelect.value = opt.value;
          break;
        }
      }
    }

    // Font size (approximate from computed style)
    const sel = window.getSelection();
    if (sel.rangeCount && sel.focusNode) {
      let node = sel.focusNode;
      if (node.nodeType === 3) node = node.parentElement;
      if (node) {
        const computed = window.getComputedStyle(node);
        const pxSize = parseFloat(computed.fontSize);
        const ptSize = Math.round(pxSize * 0.75);
        let closest = 11;
        let minDiff = 999;
        for (const s of FONT_SIZES) {
          const diff = Math.abs(s - ptSize);
          if (diff < minDiff) {
            minDiff = diff;
            closest = s;
          }
        }
        fontSizeSelect.value = String(closest);
      }
    }

    // Fore color
    const foreColor = document.queryCommandValue('foreColor');
    if (foreColor) {
      const hex = rgbToHex(foreColor);
      if (hex) {
        fontColorInput.value = hex;
        fontColorSwatch.style.background = hex;
      }
    }

    // Block format -> styles dropdown
    const blockVal = document.queryCommandValue('formatBlock');
    if (blockVal) {
      const lower = blockVal.toLowerCase().replace(/[<>]/g, '');
      for (const opt of stylesSelect.options) {
        if (opt.value === lower) {
          stylesSelect.value = lower;
          break;
        }
      }
    }
  }

  function rgbToHex(color) {
    if (!color)
      return null;
    if (color.charAt(0) === '#')
      return color.length === 7 ? color : null;
    const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (!match)
      return null;
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  editor.addEventListener('keyup', updateRibbonState);
  editor.addEventListener('pointerup', () => setTimeout(updateRibbonState, 0));

  // ═══════════════════════════════════════════════════════════════
  // Clear Formatting
  // ═══════════════════════════════════════════════════════════════

  function doClearFormatting() {
    document.execCommand('removeFormat', false, null);
    document.execCommand('formatBlock', false, '<p>');
    editor.focus();
    updateRibbonState();
  }

  // ═══════════════════════════════════════════════════════════════
  // Line Spacing Popup
  // ═══════════════════════════════════════════════════════════════

  const lineSpacingPopup = document.getElementById('popup-line-spacing');

  function showLineSpacingPopup() {
    const btn = document.querySelector('[data-action="line-spacing"]');
    const rect = btn.getBoundingClientRect();
    lineSpacingPopup.style.left = rect.left + 'px';
    lineSpacingPopup.style.top = rect.bottom + 'px';
    lineSpacingPopup.classList.add('visible');
  }

  for (const entry of lineSpacingPopup.querySelectorAll('.popup-entry')) {
    entry.addEventListener('click', () => {
      lineSpacingPopup.classList.remove('visible');
      const val = entry.dataset.spacing;
      if (val === 'custom') {
        const input = prompt('Enter line spacing (e.g. 1.5):', String(currentLineSpacing));
        if (input) {
          const num = parseFloat(input);
          if (!isNaN(num) && num > 0)
            applyLineSpacing(num);
        }
        return;
      }
      applyLineSpacing(parseFloat(val));
    });
  }

  function applyLineSpacing(spacing) {
    currentLineSpacing = spacing;
    const sel = window.getSelection();
    if (!sel.rangeCount) {
      editor.style.lineHeight = String(spacing);
      return;
    }
    // Apply to selected block elements
    const range = sel.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === 3) container = container.parentElement;

    const block = container.closest('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
    if (block) {
      block.style.lineHeight = String(spacing);
    } else {
      editor.style.lineHeight = String(spacing);
    }
    editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // Paste Special Popup
  // ═══════════════════════════════════════════════════════════════

  const pasteSpecialPopup = document.getElementById('popup-paste-special');

  function showPasteSpecialPopup() {
    const btn = document.querySelector('[data-action="paste-special"]');
    const rect = btn.getBoundingClientRect();
    pasteSpecialPopup.style.left = rect.left + 'px';
    pasteSpecialPopup.style.top = rect.bottom + 'px';
    pasteSpecialPopup.classList.add('visible');
  }

  for (const entry of pasteSpecialPopup.querySelectorAll('.popup-entry')) {
    entry.addEventListener('click', () => {
      pasteSpecialPopup.classList.remove('visible');
      const mode = entry.dataset.paste;
      if (mode === 'plain') {
        navigator.clipboard.readText().then((text) => {
          document.execCommand('insertText', false, text);
        }).catch(() => {
          document.execCommand('paste');
        });
      } else {
        document.execCommand('paste');
      }
      editor.focus();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Borders Popup
  // ═══════════════════════════════════════════════════════════════

  const bordersPopup = document.getElementById('popup-borders');

  function showBordersPopup() {
    const btn = document.querySelector('[data-action="borders"]');
    const rect = btn.getBoundingClientRect();
    bordersPopup.style.left = rect.left + 'px';
    bordersPopup.style.top = rect.bottom + 'px';
    bordersPopup.classList.add('visible');
  }

  for (const entry of bordersPopup.querySelectorAll('.popup-entry')) {
    entry.addEventListener('click', () => {
      bordersPopup.classList.remove('visible');
      const type = entry.dataset.border;
      applyBorder(type);
      editor.focus();
    });
  }

  function applyBorder(type) {
    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;
    let container = sel.focusNode;
    if (container.nodeType === 3) container = container.parentElement;
    const block = container.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th');
    if (!block)
      return;

    switch (type) {
      case 'all':
        block.style.border = '1px solid currentColor';
        break;
      case 'none':
        block.style.border = 'none';
        break;
      case 'outside':
        block.style.border = '1px solid currentColor';
        break;
      case 'bottom':
        block.style.borderBottom = '1px solid currentColor';
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Shading
  // ═══════════════════════════════════════════════════════════════

  function doShading() {
    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;
    let container = sel.focusNode;
    if (container.nodeType === 3) container = container.parentElement;
    const block = container.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th');
    if (!block)
      return;

    const current = block.style.backgroundColor;
    if (current && current !== 'transparent') {
      block.style.backgroundColor = '';
    } else {
      block.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    }
    editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // Close all popups on outside click
  // ═══════════════════════════════════════════════════════════════

  document.addEventListener('pointerdown', (e) => {
    for (const popup of document.querySelectorAll('.popup-menu.visible')) {
      if (!popup.contains(e.target))
        popup.classList.remove('visible');
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Page Layout Controls
  // ═══════════════════════════════════════════════════════════════

  const pageSizeSelect = document.getElementById('rb-page-size');
  const pageOrientSelect = document.getElementById('rb-page-orient');
  const pageMarginsSelect = document.getElementById('rb-page-margins');
  const spacingBeforeSelect = document.getElementById('rb-spacing-before');
  const spacingAfterSelect = document.getElementById('rb-spacing-after');
  const paraIndentSelect = document.getElementById('rb-para-indent');
  const pageColorInput = document.getElementById('rb-page-color');

  pageSizeSelect.addEventListener('change', applyPageSetup);
  pageOrientSelect.addEventListener('change', applyPageSetup);
  pageMarginsSelect.addEventListener('change', applyPageSetup);

  function applyPageSetup() {
    const sizes = {
      a4: { w: '210mm', h: '297mm' },
      letter: { w: '8.5in', h: '11in' },
      legal: { w: '8.5in', h: '14in' },
      custom: { w: '8.5in', h: '11in' }
    };
    const margins = { normal: '1in', narrow: '0.5in', wide: '1.25in', custom: '1in' };

    const size = sizes[pageSizeSelect.value] || sizes.letter;
    const orient = pageOrientSelect.value;
    const margin = margins[pageMarginsSelect.value] || margins.normal;

    if (editorWrapper.classList.contains('print-layout')) {
      editor.style.maxWidth = orient === 'landscape' ? size.h : size.w;
      editor.style.minHeight = orient === 'landscape' ? size.w : size.h;
    }
    editor.style.padding = margin;
  }

  spacingBeforeSelect.addEventListener('change', () => {
    applyBlockStyle('marginTop', spacingBeforeSelect.value + 'pt');
  });

  spacingAfterSelect.addEventListener('change', () => {
    applyBlockStyle('marginBottom', spacingAfterSelect.value + 'pt');
  });

  paraIndentSelect.addEventListener('change', () => {
    const inches = parseFloat(paraIndentSelect.value) * 0.5;
    applyBlockStyle('textIndent', inches > 0 ? inches + 'in' : '');
  });

  function applyBlockStyle(prop, value) {
    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;
    let container = sel.focusNode;
    if (container.nodeType === 3) container = container.parentElement;
    const block = container.closest('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
    if (block)
      block.style[prop] = value;
    editor.focus();
  }

  pageColorInput.parentElement.addEventListener('click', () => pageColorInput.click());
  pageColorInput.addEventListener('input', () => {
    editor.style.backgroundColor = pageColorInput.value;
  });

  // ═══════════════════════════════════════════════════════════════
  // View Controls
  // ═══════════════════════════════════════════════════════════════

  // Document views
  for (const radio of document.querySelectorAll('input[name="view-mode"]')) {
    radio.addEventListener('change', () => {
      editorWrapper.classList.remove('print-layout', 'web-layout');
      switch (radio.value) {
        case 'print':
          editorWrapper.classList.add('print-layout');
          break;
        case 'web':
          editorWrapper.classList.add('web-layout');
          break;
        case 'outline':
          editorWrapper.classList.add('web-layout');
          break;
      }
      applyPageSetup();
    });
  }

  // Default to print layout
  editorWrapper.classList.add('print-layout');

  // Ruler
  const ruler = document.getElementById('ruler');
  document.getElementById('view-ruler').addEventListener('change', function() {
    ruler.style.display = this.checked ? 'block' : 'none';
  });

  // Gridlines
  document.getElementById('view-gridlines').addEventListener('change', function() {
    editor.classList.toggle('show-gridlines', this.checked);
  });

  // Navigation pane
  const navPane = document.getElementById('nav-pane');
  const navPaneBody = document.getElementById('nav-pane-body');
  const viewNavPaneCheck = document.getElementById('view-nav-pane');

  viewNavPaneCheck.addEventListener('change', function() {
    navPane.style.display = this.checked ? 'flex' : 'none';
    if (this.checked)
      updateNavPane();
  });

  document.getElementById('nav-pane-close').addEventListener('click', () => {
    navPane.style.display = 'none';
    viewNavPaneCheck.checked = false;
  });

  function updateNavPane() {
    navPaneBody.innerHTML = '';
    const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (const heading of headings) {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = heading.textContent;
      a.className = 'nav-' + heading.tagName.toLowerCase();
      a.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      navPaneBody.appendChild(a);
    }
    if (!headings.length)
      navPaneBody.innerHTML = '<div style="padding:8px;color:var(--sz-color-gray-text);font-size:10px;">No headings found.</div>';
  }

  // Formatting marks
  document.getElementById('view-formatting-marks').addEventListener('change', function() {
    editor.classList.toggle('show-marks', this.checked);
  });

  // ═══════════════════════════════════════════════════════════════
  // Zoom
  // ═══════════════════════════════════════════════════════════════

  const zoomSlider = document.getElementById('rb-zoom-slider');
  const zoomValue = document.getElementById('rb-zoom-value');
  const editorArea = document.getElementById('editor-area');
  const statusZoomCtrl = new SZ.ZoomControl(document.getElementById('status-zoom-ctrl'), {
    min: 25, max: 500, step: 1, value: 100,
    onChange: v => setZoom(v),
    onZoomIn: () => setZoom(Math.min(500, currentZoom + 10)),
    onZoomOut: () => setZoom(Math.max(25, currentZoom - 10)),
  });

  function getPageDimensionsPx() {
    const sizes = {
      a4: { w: 210 * 96 / 25.4, h: 297 * 96 / 25.4 },
      letter: { w: 8.5 * 96, h: 11 * 96 },
      legal: { w: 8.5 * 96, h: 14 * 96 },
      custom: { w: 8.5 * 96, h: 11 * 96 }
    };
    const size = sizes[pageSizeSelect.value] || sizes.letter;
    const orient = pageOrientSelect.value;
    return {
      w: orient === 'landscape' ? size.h : size.w,
      h: orient === 'landscape' ? size.w : size.h
    };
  }

  function calcPageWidthZoom() {
    const page = getPageDimensionsPx();
    const wrapperPadding = editorWrapper.classList.contains('print-layout') ? 32 : 0;
    const available = editorArea.clientWidth - wrapperPadding;
    return Math.round(Math.max(25, Math.min(500, (available / page.w) * 100)));
  }

  function calcFullPageZoom(pageCount) {
    const page = getPageDimensionsPx();
    const wrapperPadding = editorWrapper.classList.contains('print-layout') ? 32 : 0;
    const gap = (pageCount - 1) * 16;
    const availW = editorArea.clientWidth - wrapperPadding;
    const availH = editorArea.clientHeight - wrapperPadding;
    const scaleW = availW / (page.w * pageCount + gap);
    const scaleH = availH / page.h;
    return Math.round(Math.max(25, Math.min(500, Math.min(scaleW, scaleH) * 100)));
  }

  function setZoom(pct) {
    currentZoom = Math.max(25, Math.min(500, pct));
    editor.style.transform = 'scale(' + (currentZoom / 100) + ')';
    editor.style.transformOrigin = 'top center';
    zoomSlider.value = currentZoom;
    zoomValue.textContent = currentZoom + '%';
    statusZoomCtrl.value = currentZoom;
  }

  zoomSlider.addEventListener('input', () => setZoom(parseInt(zoomSlider.value, 10)));

  // ═══════════════════════════════════════════════════════════════
  // Insert Table
  // ═══════════════════════════════════════════════════════════════

  function showInsertTableDialog() {
    // Build grid picker
    const picker = document.getElementById('table-grid-picker');
    const label = document.getElementById('table-grid-label');
    const rowsInput = document.getElementById('tbl-rows');
    const colsInput = document.getElementById('tbl-cols');

    picker.innerHTML = '';
    let pickedRows = 0;
    let pickedCols = 0;

    for (let r = 0; r < 8; ++r) {
      for (let c = 0; c < 10; ++c) {
        const cell = document.createElement('div');
        cell.className = 'tgp-cell';
        cell.dataset.row = r + 1;
        cell.dataset.col = c + 1;
        cell.addEventListener('pointerenter', () => {
          pickedRows = parseInt(cell.dataset.row, 10);
          pickedCols = parseInt(cell.dataset.col, 10);
          label.textContent = pickedRows + ' x ' + pickedCols;
          rowsInput.value = pickedRows;
          colsInput.value = pickedCols;
          updateGridHighlight(picker, pickedRows, pickedCols);
        });
        cell.addEventListener('click', () => {
          rowsInput.value = pickedRows;
          colsInput.value = pickedCols;
        });
        picker.appendChild(cell);
      }
    }

    const overlay = document.getElementById('dlg-insert-table');
    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;
      const rows = parseInt(rowsInput.value, 10) || 3;
      const cols = parseInt(colsInput.value, 10) || 3;
      insertTable(rows, cols);
    });
  }

  function updateGridHighlight(picker, rows, cols) {
    for (const cell of picker.querySelectorAll('.tgp-cell')) {
      const r = parseInt(cell.dataset.row, 10);
      const c = parseInt(cell.dataset.col, 10);
      cell.classList.toggle('tgp-active', r <= rows && c <= cols);
    }
  }

  function insertTable(rows, cols) {
    let html = '<table>';
    for (let r = 0; r < rows; ++r) {
      html += '<tr>';
      for (let c = 0; c < cols; ++c)
        html += '<td><br></td>';
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // Table Context Menu (right-click on tables)
  // ═══════════════════════════════════════════════════════════════

  // Create context menu dynamically
  const tableCtx = document.createElement('div');
  tableCtx.className = 'table-context-menu';
  tableCtx.innerHTML = [
    '<div class="ctx-entry" data-taction="insert-row-above">Insert Row Above</div>',
    '<div class="ctx-entry" data-taction="insert-row-below">Insert Row Below</div>',
    '<div class="ctx-entry" data-taction="insert-col-left">Insert Column Left</div>',
    '<div class="ctx-entry" data-taction="insert-col-right">Insert Column Right</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-entry" data-taction="delete-row">Delete Row</div>',
    '<div class="ctx-entry" data-taction="delete-col">Delete Column</div>',
    '<div class="ctx-entry" data-taction="delete-table">Delete Table</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-entry" data-taction="merge-cells">Merge Cells</div>',
    '<div class="ctx-entry" data-taction="split-cell">Split Cell</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-entry" data-taction="cell-bg">Cell Background Color</div>',
    '<div class="ctx-entry" data-taction="table-borders">Toggle Borders</div>',
  ].join('');
  document.body.appendChild(tableCtx);

  let contextCell = null;

  editor.addEventListener('contextmenu', (e) => {
    const td = e.target.closest('td, th');
    if (!td || !editor.contains(td))
      return;

    e.preventDefault();
    contextCell = td;
    tableCtx.style.left = e.clientX + 'px';
    tableCtx.style.top = e.clientY + 'px';
    tableCtx.classList.add('visible');
  });

  document.addEventListener('pointerdown', (e) => {
    if (!tableCtx.contains(e.target))
      tableCtx.classList.remove('visible');
  });

  for (const entry of tableCtx.querySelectorAll('.ctx-entry')) {
    entry.addEventListener('click', () => {
      tableCtx.classList.remove('visible');
      if (!contextCell)
        return;
      const action = entry.dataset.taction;
      handleTableAction(action, contextCell);
      editor.focus();
    });
  }

  function handleTableAction(action, cell) {
    const tr = cell.closest('tr');
    const table = cell.closest('table');
    if (!tr || !table)
      return;

    const rowIndex = Array.from(table.rows).indexOf(tr);
    const colIndex = Array.from(tr.cells).indexOf(cell);
    const colCount = tr.cells.length;

    switch (action) {
      case 'insert-row-above': {
        const newRow = table.insertRow(rowIndex);
        for (let i = 0; i < colCount; ++i)
          newRow.insertCell().innerHTML = '<br>';
        break;
      }
      case 'insert-row-below': {
        const newRow = table.insertRow(rowIndex + 1);
        for (let i = 0; i < colCount; ++i)
          newRow.insertCell().innerHTML = '<br>';
        break;
      }
      case 'insert-col-left':
        for (const row of table.rows)
          row.insertCell(colIndex).innerHTML = '<br>';
        break;
      case 'insert-col-right':
        for (const row of table.rows) {
          const idx = Math.min(colIndex + 1, row.cells.length);
          row.insertCell(idx).innerHTML = '<br>';
        }
        break;
      case 'delete-row':
        if (table.rows.length > 1)
          table.deleteRow(rowIndex);
        else
          table.remove();
        break;
      case 'delete-col':
        if (colCount > 1) {
          for (const row of table.rows)
            if (colIndex < row.cells.length)
              row.deleteCell(colIndex);
        } else
          table.remove();
        break;
      case 'delete-table':
        table.remove();
        break;
      case 'merge-cells': {
        const sel = window.getSelection();
        if (!sel.rangeCount)
          break;
        // Simple merge: merge cell with the one to its right
        if (colIndex + 1 < tr.cells.length) {
          const next = tr.cells[colIndex + 1];
          cell.innerHTML += ' ' + next.innerHTML;
          const span = parseInt(cell.getAttribute('colspan') || '1', 10);
          cell.setAttribute('colspan', String(span + 1));
          next.remove();
        }
        break;
      }
      case 'split-cell': {
        const span = parseInt(cell.getAttribute('colspan') || '1', 10);
        if (span > 1) {
          cell.setAttribute('colspan', String(span - 1));
          const newCell = document.createElement('td');
          newCell.innerHTML = '<br>';
          cell.after(newCell);
        }
        break;
      }
      case 'cell-bg': {
        const color = prompt('Enter background color (hex or name):', cell.style.backgroundColor || '');
        if (color !== null)
          cell.style.backgroundColor = color;
        break;
      }
      case 'table-borders': {
        const hasNoBorder = table.style.borderCollapse === 'separate';
        if (hasNoBorder) {
          table.style.borderCollapse = 'collapse';
          for (const td of table.querySelectorAll('td, th'))
            td.style.border = '';
        } else {
          table.style.borderCollapse = 'separate';
          for (const td of table.querySelectorAll('td, th'))
            td.style.border = 'none';
        }
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert Image
  // ═══════════════════════════════════════════════════════════════

  function showInsertImageDialog() {
    const overlay = document.getElementById('dlg-insert-image');
    document.getElementById('img-url').value = '';
    document.getElementById('img-alt').value = '';
    document.getElementById('img-width').value = '';
    document.getElementById('img-height').value = '';
    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;
      const url = document.getElementById('img-url').value.trim();
      if (!url)
        return;
      const alt = document.getElementById('img-alt').value.trim();
      const w = document.getElementById('img-width').value;
      const h = document.getElementById('img-height').value;
      let html = '<img src="' + escapeHtml(url) + '"';
      if (alt) html += ' alt="' + escapeHtml(alt) + '"';
      if (w) html += ' width="' + parseInt(w, 10) + '"';
      if (h) html += ' height="' + parseInt(h, 10) + '"';
      html += '>';
      document.execCommand('insertHTML', false, html);
      editor.focus();
    });
  }

  async function doInsertImageFile() {
    const result = await ComDlg32.GetOpenFileName({
      filters: [
        { name: 'Images', ext: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      title: 'Insert Image',
    });
    if (result.cancelled || !result.path)
      return;
    // Try to use the path as src
    const html = '<img src="' + escapeHtml(result.path) + '" style="max-width:100%;">';
    document.execCommand('insertHTML', false, html);
    editor.focus();
  }

  // Image selection
  editor.addEventListener('click', (e) => {
    for (const img of editor.querySelectorAll('img.img-selected'))
      img.classList.remove('img-selected');
    if (e.target.tagName === 'IMG')
      e.target.classList.add('img-selected');
  });

  // ═══════════════════════════════════════════════════════════════
  // Insert Shapes, Text Box
  // ═══════════════════════════════════════════════════════════════

  function doInsertShape(type) {
    let html;
    switch (type) {
      case 'rect':
        html = '<div class="wp-shape wp-shape-rect" contenteditable="false"></div>';
        break;
      case 'circle':
        html = '<div class="wp-shape wp-shape-circle" contenteditable="false"></div>';
        break;
      case 'line':
        html = '<div class="wp-shape wp-shape-line" contenteditable="false"></div>';
        break;
      default:
        return;
    }
    document.execCommand('insertHTML', false, html);
    editor.focus();
  }

  function doInsertTextbox() {
    const html = '<div class="wp-textbox" contenteditable="true">Type here...</div>';
    document.execCommand('insertHTML', false, html);
    editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert Hyperlink
  // ═══════════════════════════════════════════════════════════════

  function showInsertLinkDialog() {
    const sel = window.getSelection();
    const selectedText = sel.rangeCount ? sel.toString() : '';

    document.getElementById('link-text').value = selectedText;
    document.getElementById('link-url').value = 'https://';

    const overlay = document.getElementById('dlg-insert-link');
    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;
      const text = document.getElementById('link-text').value.trim() || 'Link';
      const url = document.getElementById('link-url').value.trim();
      if (!url)
        return;
      const html = '<a href="' + escapeHtml(url) + '">' + escapeHtml(text) + '</a>';
      document.execCommand('insertHTML', false, html);
      editor.focus();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert Bookmark
  // ═══════════════════════════════════════════════════════════════

  function showInsertBookmarkDialog() {
    document.getElementById('bm-name').value = '';
    const overlay = document.getElementById('dlg-insert-bookmark');
    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;
      const name = document.getElementById('bm-name').value.trim();
      if (!name)
        return;
      const html = '<a id="' + escapeHtml(name) + '" name="' + escapeHtml(name) + '"></a>';
      document.execCommand('insertHTML', false, html);
      editor.focus();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert Header, Footer, Page Number
  // ═══════════════════════════════════════════════════════════════

  function doInsertHeader() {
    const existing = editor.querySelector('.wp-header');
    if (existing) {
      existing.focus();
      return;
    }
    const header = document.createElement('div');
    header.className = 'wp-header';
    header.contentEditable = 'true';
    header.textContent = 'Header - click to edit';
    editor.insertBefore(header, editor.firstChild);
  }

  function doInsertFooter() {
    const existing = editor.querySelector('.wp-footer');
    if (existing) {
      existing.focus();
      return;
    }
    const footer = document.createElement('div');
    footer.className = 'wp-footer';
    footer.contentEditable = 'true';
    footer.textContent = 'Footer - click to edit';
    editor.appendChild(footer);
  }

  function doInsertPageNumber() {
    const footer = editor.querySelector('.wp-footer');
    if (footer) {
      footer.textContent = 'Page 1';
    } else {
      doInsertFooter();
      const newFooter = editor.querySelector('.wp-footer');
      if (newFooter) newFooter.textContent = 'Page 1';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert Symbol
  // ═══════════════════════════════════════════════════════════════

  function showSymbolDialog() {
    const grid = document.getElementById('symbol-grid');
    grid.innerHTML = '';
    for (const sym of SYMBOLS) {
      const cell = document.createElement('div');
      cell.className = 'sym-cell';
      cell.textContent = sym;
      cell.title = 'U+' + sym.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
      cell.addEventListener('click', () => {
        document.execCommand('insertText', false, sym);
        editor.focus();
      });
      grid.appendChild(cell);
    }
    const overlay = document.getElementById('dlg-symbol');
    awaitDialogResult(overlay);
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert HR, Page Break, Date/Time
  // ═══════════════════════════════════════════════════════════════

  function doInsertHR() {
    document.execCommand('insertHTML', false, '<hr>');
    editor.focus();
  }

  function doInsertPageBreak() {
    document.execCommand('insertHTML', false, '<div class="wp-page-break"></div><p><br></p>');
    editor.focus();
  }

  function doInsertDateTime() {
    const now = new Date();
    const text = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    document.execCommand('insertText', false, text);
    editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // Watermark
  // ═══════════════════════════════════════════════════════════════

  function showWatermarkDialog() {
    const wmText = document.getElementById('wm-text');
    const wmRemove = document.getElementById('wm-remove');
    wmRemove.checked = false;

    const existing = editor.querySelector('.watermark');
    if (existing)
      wmText.value = existing.textContent;

    const overlay = document.getElementById('dlg-watermark');
    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;
      const old = editor.querySelector('.watermark');
      if (wmRemove.checked) {
        if (old) old.remove();
        return;
      }
      const text = wmText.value.trim();
      if (!text)
        return;
      if (old) {
        old.textContent = text;
      } else {
        const div = document.createElement('div');
        div.className = 'watermark';
        div.textContent = text;
        editor.insertBefore(div, editor.firstChild);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Find & Replace
  // ═══════════════════════════════════════════════════════════════

  const findPanel = document.getElementById('find-panel');
  const fpFindInput = document.getElementById('fp-find-input');
  const fpReplaceInput = document.getElementById('fp-replace-input');
  const fpReplaceRow = document.getElementById('fp-replace-row');
  const fpStatus = document.getElementById('fp-status');
  const fpCaseSensitive = document.getElementById('fp-case-sensitive');
  const fpRegex = document.getElementById('fp-regex');
  const fpReplaceOne = document.getElementById('fp-replace-one');
  const fpReplaceAll = document.getElementById('fp-replace-all');

  function showFindReplace(mode) {
    findPanel.classList.add('visible');
    const isReplace = mode === 'replace';

    fpReplaceRow.style.display = isReplace ? 'flex' : 'none';
    fpReplaceOne.style.display = isReplace ? '' : 'none';
    fpReplaceAll.style.display = isReplace ? '' : 'none';

    for (const tab of findPanel.querySelectorAll('.fp-tab')) {
      tab.classList.toggle('active', tab.dataset.fpTab === mode);
    }

    fpFindInput.focus();
    fpFindInput.select();
    fpStatus.textContent = '';
  }

  // Find/Replace tab switching
  for (const tab of findPanel.querySelectorAll('.fp-tab')) {
    tab.addEventListener('click', () => {
      showFindReplace(tab.dataset.fpTab);
    });
  }

  document.getElementById('fp-close').addEventListener('click', () => {
    findPanel.classList.remove('visible');
    editor.focus();
  });

  function getSearchRegex(needle, flags) {
    if (fpRegex.checked) {
      try {
        return new RegExp(needle, flags);
      } catch (e) {
        fpStatus.textContent = 'Invalid regex: ' + e.message;
        return null;
      }
    }
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, flags);
  }

  function findInEditor(forward) {
    const needle = fpFindInput.value;
    if (!needle) {
      fpStatus.textContent = '';
      return;
    }

    const caseSensitive = fpCaseSensitive.checked;

    if (!fpRegex.checked) {
      // Use window.find for simple text search
      const found = window.find(needle, caseSensitive, !forward, true, false, false, false);
      if (!found) {
        // Wrap around
        const sel = window.getSelection();
        if (forward)
          sel.collapse(editor, 0);
        else
          sel.collapse(editor, editor.childNodes.length);

        const foundAgain = window.find(needle, caseSensitive, !forward, true, false, false, false);
        fpStatus.textContent = foundAgain ? 'Wrapped around.' : 'No matches found.';
      } else {
        fpStatus.textContent = '';
      }
    } else {
      // Regex search
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = getSearchRegex(needle, flags);
      if (!regex)
        return;

      const text = editor.innerText;
      const matches = [...text.matchAll(regex)];
      if (!matches.length) {
        fpStatus.textContent = 'No matches found.';
        return;
      }

      fpStatus.textContent = matches.length + ' match(es) found.';

      // Select first match using TreeWalker
      const match = matches[0];
      selectTextInEditor(match.index, match[0].length);
    }
  }

  function selectTextInEditor(startOffset, length) {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    let charCount = 0;
    let startNode = null, startOff = 0;
    let endNode = null, endOff = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLen = node.textContent.length;
      if (!startNode && charCount + nodeLen > startOffset) {
        startNode = node;
        startOff = startOffset - charCount;
      }
      if (!endNode && charCount + nodeLen >= startOffset + length) {
        endNode = node;
        endOff = startOffset + length - charCount;
        break;
      }
      charCount += nodeLen;
    }

    if (startNode && endNode) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStart(startNode, startOff);
      range.setEnd(endNode, endOff);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  document.getElementById('fp-find-next').addEventListener('click', () => findInEditor(true));
  document.getElementById('fp-find-prev').addEventListener('click', () => findInEditor(false));

  document.getElementById('fp-replace-one').addEventListener('click', () => {
    const sel = window.getSelection();
    if (sel.rangeCount && !sel.isCollapsed) {
      const replacement = fpReplaceInput.value;
      document.execCommand('insertText', false, replacement);
      markDirty();
    }
    findInEditor(true);
  });

  document.getElementById('fp-replace-all').addEventListener('click', () => {
    const needle = fpFindInput.value;
    const replacement = fpReplaceInput.value;
    if (!needle)
      return;

    const caseSensitive = fpCaseSensitive.checked;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = getSearchRegex(needle, flags);
    if (!regex)
      return;

    // Work with innerHTML for replace-all
    const html = editor.innerHTML;
    // We need to be careful: replace in text nodes only
    // Simple approach: use innerText, replace, then deal with it
    // Better approach: iterate text nodes
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    let count = 0;
    const textNodes = [];
    while (walker.nextNode())
      textNodes.push(walker.currentNode);

    for (const node of textNodes) {
      const original = node.textContent;
      const replaced = original.replace(regex, replacement);
      if (replaced !== original) {
        node.textContent = replaced;
        ++count;
      }
    }

    fpStatus.textContent = count > 0 ? count + ' replacement(s) made.' : 'No matches found.';
    markDirty();
    updateStatusBar();
  });

  fpFindInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findInEditor(true);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      findPanel.classList.remove('visible');
      editor.focus();
    }
  });

  fpReplaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      findPanel.classList.remove('visible');
      editor.focus();
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // File Operations
  // ═══════════════════════════════════════════════════════════════

  function getEditorContent() {
    return editor.innerHTML;
  }

  function setEditorContent(html) {
    editor.innerHTML = html;
    savedContent = editor.innerHTML;
    dirty = false;
    updateTitle();
    updateStatusBar();
    updateRibbonState();
  }

  function doNew() {
    if (dirty) {
      promptSaveChanges((result) => {
        if (result === 'yes')
          doSave(() => resetEditor());
        else if (result === 'no')
          resetEditor();
      });
      return;
    }
    resetEditor();
  }

  function resetEditor() {
    editor.innerHTML = '';
    savedContent = '';
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    updateTitle();
    updateStatusBar();
    editor.focus();
  }

  function doOpen() {
    if (dirty) {
      promptSaveChanges((result) => {
        if (result === 'yes')
          doSave(() => showOpenDialog());
        else if (result === 'no')
          showOpenDialog();
      });
      return;
    }
    showOpenDialog();
  }

  async function showOpenDialog() {
    const result = await ComDlg32.GetOpenFileName({
      filters: FILE_FILTERS,
      initialDir: '/user/documents',
      title: 'Open',
    });
    if (!result.cancelled && result.path)
      loadFile(result.path);
  }

  async function loadFile(path, content) {
    if (content == null) {
      try {
        content = await Kernel32.ReadAllText(path);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'WordPad', MB_OK);
        return;
      }
    }
    const text = content != null ? String(content) : '';

    if (path.endsWith('.txt')) {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const lines = escaped.split('\n');
      const html = lines.map(line => '<p>' + (line || '<br>') + '</p>').join('');
      setEditorContent(html);
    } else if (path.endsWith('.rtf'))
      setEditorContent(rtfToHtml(text));
    else
      setEditorContent(text);

    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    updateTitle();
    editor.focus();
  }

  function doSave(callback) {
    if (!currentFilePath) {
      doSaveAs(callback);
      return;
    }
    saveToPath(currentFilePath, callback);
  }

  async function doSaveAs(callback) {
    const content = getEditorContent();
    const result = await ComDlg32.GetSaveFileName({
      filters: FILE_FILTERS,
      initialDir: '/user/documents',
      defaultName: currentFileName || 'Untitled.html',
      title: 'Save As',
      content: content,
    });
    if (!result.cancelled && result.path) {
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';
      await saveToPath(result.path, callback);
    }
  }

  async function saveToPath(path, callback) {
    const content = getEditorContent();
    try {
      await Kernel32.WriteFile(path, content);
    } catch (err) {
      await User32.MessageBox('Could not save file: ' + err.message, 'WordPad', MB_OK);
      return;
    }
    savedContent = editor.innerHTML;
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    updateTitle();
    if (typeof callback === 'function')
      callback();
  }

  async function doExportTxt() {
    const text = editor.innerText;
    const result = await ComDlg32.GetSaveFileName({
      filters: [{ name: 'Text Files', ext: ['txt'] }],
      initialDir: '/user/documents',
      defaultName: (currentFileName.replace(/\.[^.]+$/, '') || 'Untitled') + '.txt',
      title: 'Export as Text',
      content: text,
    });
    if (!result.cancelled && result.path) {
      // Don't change current file tracking for exports
    }
  }

  async function doExportHtml() {
    const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>'
      + escapeHtml(currentFileName) + '</title>\n</head>\n<body>\n'
      + getEditorContent()
      + '\n</body>\n</html>';

    const result = await ComDlg32.GetSaveFileName({
      filters: [{ name: 'HTML Files', ext: ['html', 'htm'] }],
      initialDir: '/user/documents',
      defaultName: (currentFileName.replace(/\.[^.]+$/, '') || 'Untitled') + '.html',
      title: 'Export as HTML',
      content: html,
    });
    if (!result.cancelled && result.path) {
      // Don't change current file tracking for exports
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DOCX Import (via mammoth.js)
  // ═══════════════════════════════════════════════════════════════

  async function doImportDocx() {
    const result = await ComDlg32.ImportFile({ accept: '.docx' });
    if (result.cancelled) return;
    try {
      const mammothResult = await mammoth.convertToHtml(
        { arrayBuffer: result.data },
        {
          styleMap: [
            "p[style-name='Heading 1'] => h1",
            "p[style-name='Heading 2'] => h2",
            "p[style-name='Heading 3'] => h3",
          ]
        }
      );
      setEditorContent(mammothResult.value);
      currentFileName = result.name.replace(/\.docx$/i, '');
      currentFilePath = null;
      updateTitle();
    } catch (err) {
      await User32.MessageBox('Could not import DOCX: ' + err.message, 'WordPad', MB_OK);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DOCX Export (via JSZip — minimal OOXML)
  // ═══════════════════════════════════════════════════════════════

  const CONTENT_TYPES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + '</Types>';

  const RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>';

  const DOC_RELS_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>';

  const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>'
    + '</w:styles>';

  function htmlToOoxml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.style.position = 'absolute';
    tmp.style.left = '-9999px';
    document.body.appendChild(tmp);
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    let body = '';

    function escXml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getRunProps(el) {
      let rPr = '';
      if (!el || !el.style) return rPr;
      const cs = el.nodeType === 1 ? window.getComputedStyle(el) : null;
      if (cs) {
        if (parseInt(cs.fontWeight, 10) >= 700 || cs.fontWeight === 'bold') rPr += '<w:b/>';
        if (cs.fontStyle === 'italic') rPr += '<w:i/>';
        if (cs.textDecorationLine && cs.textDecorationLine.includes('underline')) rPr += '<w:u w:val="single"/>';
        if (cs.textDecorationLine && cs.textDecorationLine.includes('line-through')) rPr += '<w:strike/>';
        const ff = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
        if (ff) rPr += '<w:rFonts w:ascii="' + escXml(ff) + '" w:hAnsi="' + escXml(ff) + '"/>';
        const px = parseFloat(cs.fontSize);
        if (px) rPr += '<w:sz w:val="' + Math.round(px * 1.5) + '"/>';
        const color = rgbToHex(cs.color);
        if (color && color !== '#000000') rPr += '<w:color w:val="' + color.slice(1) + '"/>';
      }
      return rPr;
    }

    function processInline(node) {
      if (node.nodeType === 3) {
        const text = node.textContent;
        if (!text) return '';
        return '<w:r><w:t xml:space="preserve">' + escXml(text) + '</w:t></w:r>';
      }
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') return '<w:r><w:br/></w:r>';
      const rPr = getRunProps(node);
      let runs = '';
      if (node.childNodes.length === 0) {
        const text = node.textContent;
        if (text) runs = '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + escXml(text) + '</w:t></w:r>';
      } else {
        for (const child of node.childNodes) {
          if (child.nodeType === 3) {
            const text = child.textContent;
            if (text) runs += '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + escXml(text) + '</w:t></w:r>';
          } else
            runs += processInline(child);
        }
      }
      return runs;
    }

    function alignmentPPr(el) {
      if (!el || !el.style) return '';
      const align = el.style.textAlign;
      if (align === 'center') return '<w:jc w:val="center"/>';
      if (align === 'right') return '<w:jc w:val="right"/>';
      if (align === 'justify') return '<w:jc w:val="both"/>';
      return '';
    }

    function processBlock(node) {
      if (node.nodeType === 3) {
        const text = node.textContent.trim();
        if (!text) return;
        body += '<w:p><w:r><w:t xml:space="preserve">' + escXml(text) + '</w:t></w:r></w:p>';
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();

      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        const styleId = 'Heading' + Math.min(level, 3);
        const align = alignmentPPr(node);
        body += '<w:p><w:pPr><w:pStyle w:val="' + styleId + '"/>' + align + '</w:pPr>' + processInline(node) + '</w:p>';
        return;
      }

      if (tag === 'p' || tag === 'div') {
        const align = alignmentPPr(node);
        body += '<w:p>' + (align ? '<w:pPr>' + align + '</w:pPr>' : '') + processInline(node) + '</w:p>';
        return;
      }

      if (tag === 'ul' || tag === 'ol') {
        for (const li of node.children) {
          if (li.tagName && li.tagName.toLowerCase() === 'li')
            body += '<w:p><w:pPr><w:ind w:left="720"/></w:pPr>' + processInline(li) + '</w:p>';
        }
        return;
      }

      if (tag === 'table') {
        body += '<w:tbl><w:tblPr><w:tblBorders>'
          + '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          + '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          + '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          + '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          + '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          + '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
          + '</w:tblBorders></w:tblPr>';
        for (const tr of node.querySelectorAll('tr')) {
          body += '<w:tr>';
          for (const td of tr.querySelectorAll('td, th'))
            body += '<w:tc><w:p>' + processInline(td) + '</w:p></w:tc>';
          body += '</w:tr>';
        }
        body += '</w:tbl>';
        return;
      }

      if (tag === 'hr') {
        body += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>';
        return;
      }

      // fallback: recurse children
      for (const child of node.childNodes)
        processBlock(child);
    }

    for (const child of tmp.childNodes)
      processBlock(child);

    document.body.removeChild(tmp);

    if (!body)
      body = '<w:p/>';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
      + '<w:document xmlns:w="' + W + '">'
      + '<w:body>' + body + '</w:body>'
      + '</w:document>';
  }

  async function doExportDocx() {
    const html = getEditorContent();
    const ooxml = htmlToOoxml(html);
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
    zip.file('_rels/.rels', RELS_XML);
    zip.file('word/_rels/document.xml.rels', DOC_RELS_XML);
    zip.file('word/document.xml', ooxml);
    zip.file('word/styles.xml', STYLES_XML);
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    const name = (currentFileName.replace(/\.[^.]+$/, '') || 'Untitled') + '.docx';
    ComDlg32.ExportFile(blob, name);
  }

  // ═══════════════════════════════════════════════════════════════
  // RTF Import (custom parser)
  // ═══════════════════════════════════════════════════════════════

  function rtfToHtml(rtf) {
    const fonts = [];
    const colors = [null]; // index 0 = auto/default

    // Extract font table
    const fontTblMatch = rtf.match(/\{\\fonttbl([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
    if (fontTblMatch) {
      const ftbl = fontTblMatch[1];
      const fontEntries = ftbl.match(/\{\\f(\d+)[^}]*\s([^;{}]+);?\}/g);
      if (fontEntries)
        for (const entry of fontEntries) {
          const m = entry.match(/\\f(\d+).*?\\fcharset\d*\s*([^;{}]+)/);
          if (m)
            fonts[parseInt(m[1], 10)] = m[2].trim().replace(/;$/, '');
          else {
            const m2 = entry.match(/\\f(\d+)[^}]*\s+([^;{}]+);?\}/);
            if (m2) fonts[parseInt(m2[1], 10)] = m2[2].trim().replace(/;$/, '');
          }
        }
    }

    // Extract color table
    const colorTblMatch = rtf.match(/\{\\colortbl\s*;?([^}]*)\}/);
    if (colorTblMatch) {
      const entries = colorTblMatch[1].split(';');
      for (const entry of entries) {
        const rm = entry.match(/\\red(\d+)/);
        const gm = entry.match(/\\green(\d+)/);
        const bm = entry.match(/\\blue(\d+)/);
        if (rm && gm && bm)
          colors.push('rgb(' + rm[1] + ',' + gm[1] + ',' + bm[1] + ')');
        else if (entry.trim() === '')
          colors.push(null);
      }
    }

    // Tokenize and process
    let html = '';
    let bold = false, italic = false, underline = false, strike = false;
    let fontSize = 24; // half-points (12pt default)
    let fontIdx = 0;
    let colorIdx = 0;
    let depth = 0;
    let inFontTbl = false, inColorTbl = false, inHeader = false;
    let align = '';
    let pendingPar = false;
    let firstPar = true;

    function openSpan() {
      let style = '';
      if (bold) style += 'font-weight:bold;';
      if (italic) style += 'font-style:italic;';
      if (underline) style += 'text-decoration:underline;';
      if (strike) style += 'text-decoration:line-through;';
      if (fontSize !== 24) style += 'font-size:' + (fontSize / 2) + 'pt;';
      if (fonts[fontIdx]) style += 'font-family:' + fonts[fontIdx] + ';';
      if (colorIdx > 0 && colors[colorIdx]) style += 'color:' + colors[colorIdx] + ';';
      return style ? '<span style="' + style + '">' : '<span>';
    }

    // Simple tokenizer
    let i = 0;
    const len = rtf.length;

    function readControlWord() {
      let word = '';
      while (i < len && /[a-zA-Z]/.test(rtf[i])) word += rtf[i++];
      let param = '';
      if (i < len && (rtf[i] === '-' || /\d/.test(rtf[i]))) {
        if (rtf[i] === '-') { param += '-'; ++i; }
        while (i < len && /\d/.test(rtf[i])) param += rtf[i++];
      }
      if (i < len && rtf[i] === ' ') ++i; // consume delimiter space
      return { word, param: param !== '' ? parseInt(param, 10) : null };
    }

    while (i < len) {
      const ch = rtf[i];

      if (ch === '{') {
        ++depth; ++i;
        // Check for special groups
        if (rtf.substring(i, i + 8) === '\\fonttbl') { inFontTbl = true; }
        if (rtf.substring(i, i + 9) === '\\colortbl') { inColorTbl = true; }
        if (rtf.substring(i, i + 5) === '\\info') { inHeader = true; }
        if (rtf.substring(i, i + 9) === '\\*\\') { inHeader = true; }
        continue;
      }

      if (ch === '}') {
        if (inFontTbl) inFontTbl = false;
        if (inColorTbl) inColorTbl = false;
        if (inHeader) inHeader = false;
        --depth; ++i;
        continue;
      }

      if (inFontTbl || inColorTbl || inHeader) { ++i; continue; }

      if (ch === '\\') {
        ++i;
        if (i >= len) break;

        // Escaped characters
        if (rtf[i] === '\\' || rtf[i] === '{' || rtf[i] === '}') {
          if (pendingPar) { html += firstPar ? '' : '</p>'; html += '<p' + (align ? ' style="text-align:' + align + '"' : '') + '>'; pendingPar = false; firstPar = false; }
          html += escapeHtml(rtf[i]); ++i; continue;
        }

        if (rtf[i] === "'") {
          // Hex char
          ++i;
          const hex = rtf.substring(i, i + 2);
          i += 2;
          if (pendingPar) { html += firstPar ? '' : '</p>'; html += '<p' + (align ? ' style="text-align:' + align + '"' : '') + '>'; pendingPar = false; firstPar = false; }
          html += escapeHtml(String.fromCharCode(parseInt(hex, 16)));
          continue;
        }

        if (rtf[i] === '~') { html += '&nbsp;'; ++i; continue; }

        const ctrl = readControlWord();
        switch (ctrl.word) {
          case 'par': case 'line': pendingPar = true; break;
          case 'pard': bold = false; italic = false; underline = false; strike = false; fontSize = 24; fontIdx = 0; colorIdx = 0; align = ''; break;
          case 'b': bold = ctrl.param !== 0; break;
          case 'i': italic = ctrl.param !== 0; break;
          case 'ul': case 'ulnone': underline = ctrl.word === 'ul' && ctrl.param !== 0; break;
          case 'strike': strike = ctrl.param !== 0; break;
          case 'fs': if (ctrl.param != null) fontSize = ctrl.param; break;
          case 'f': if (ctrl.param != null) fontIdx = ctrl.param; break;
          case 'cf': if (ctrl.param != null) colorIdx = ctrl.param; break;
          case 'ql': align = 'left'; break;
          case 'qc': align = 'center'; break;
          case 'qr': align = 'right'; break;
          case 'qj': align = 'justify'; break;
          case 'u': {
            // Unicode: \uN? — skip the fallback char
            if (ctrl.param != null) {
              const cp = ctrl.param < 0 ? ctrl.param + 65536 : ctrl.param;
              if (pendingPar) { html += firstPar ? '' : '</p>'; html += '<p' + (align ? ' style="text-align:' + align + '"' : '') + '>'; pendingPar = false; firstPar = false; }
              html += escapeHtml(String.fromCodePoint(cp));
              // Skip fallback character
              if (i < len && rtf[i] !== '\\' && rtf[i] !== '{' && rtf[i] !== '}') ++i;
            }
            break;
          }
          case 'tab': html += '&emsp;'; break;
          // Ignore other control words
        }
        continue;
      }

      // Plain text
      if (ch === '\r' || ch === '\n') { ++i; continue; }
      if (pendingPar) { html += firstPar ? '' : '</p>'; html += '<p' + (align ? ' style="text-align:' + align + '"' : '') + '>'; pendingPar = false; firstPar = false; }
      if (firstPar) { html += '<p>'; firstPar = false; }
      html += openSpan() + escapeHtml(ch) + '</span>';
      ++i;
    }

    if (!firstPar) html += '</p>';
    return html || '<p><br></p>';
  }

  async function doImportRtf() {
    const result = await ComDlg32.ImportFile({ accept: '.rtf', readAs: 'text' });
    if (result.cancelled) return;
    try {
      setEditorContent(rtfToHtml(result.data));
      currentFileName = result.name.replace(/\.rtf$/i, '');
      currentFilePath = null;
      updateTitle();
    } catch (err) {
      await User32.MessageBox('Could not import RTF: ' + err.message, 'WordPad', MB_OK);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RTF Export (custom generator)
  // ═══════════════════════════════════════════════════════════════

  function htmlToRtf(htmlContent) {
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlContent;
    tmp.style.position = 'absolute';
    tmp.style.left = '-9999px';
    document.body.appendChild(tmp);

    const usedFonts = ['Calibri'];
    const usedColors = [[0, 0, 0]];

    function getFontIndex(family) {
      const clean = family.split(',')[0].replace(/['"]/g, '').trim();
      if (!clean) return 0;
      let idx = usedFonts.indexOf(clean);
      if (idx < 0) { idx = usedFonts.length; usedFonts.push(clean); }
      return idx;
    }

    function getColorIndex(cssColor) {
      const hex = rgbToHex(cssColor);
      if (!hex) return 0;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      for (let i = 0; i < usedColors.length; ++i)
        if (usedColors[i][0] === r && usedColors[i][1] === g && usedColors[i][2] === b) return i;
      usedColors.push([r, g, b]);
      return usedColors.length - 1;
    }

    let rtf = '';

    function processNode(node) {
      if (node.nodeType === 3) {
        const text = node.textContent;
        for (const ch of text) {
          const code = ch.charCodeAt(0);
          if (code === 92) rtf += '\\\\';
          else if (code === 123) rtf += '\\{';
          else if (code === 125) rtf += '\\}';
          else if (code > 127) rtf += '\\u' + code + '?';
          else rtf += ch;
        }
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      const cs = window.getComputedStyle(node);

      if (/^h[1-6]$/.test(tag) || tag === 'p' || tag === 'div' || tag === 'li') {
        const isBold = parseInt(cs.fontWeight, 10) >= 700;
        const isItalic = cs.fontStyle === 'italic';
        const isUl = cs.textDecorationLine && cs.textDecorationLine.includes('underline');
        const fontI = getFontIndex(cs.fontFamily);
        const sizeHp = Math.round(parseFloat(cs.fontSize) * 1.5);
        const colorI = getColorIndex(cs.color);
        const align = cs.textAlign;

        rtf += '\\pard';
        if (align === 'center') rtf += '\\qc';
        else if (align === 'right') rtf += '\\qr';
        else if (align === 'justify') rtf += '\\qj';

        rtf += '\\f' + fontI + '\\fs' + sizeHp;
        if (colorI > 0) rtf += '\\cf' + colorI;
        if (isBold) rtf += '\\b';
        if (isItalic) rtf += '\\i';
        if (isUl) rtf += '\\ul';
        rtf += ' ';

        for (const child of node.childNodes)
          processNode(child);

        rtf += '\\par\n';
        return;
      }

      if (tag === 'br') { rtf += '\\line '; return; }
      if (tag === 'hr') { rtf += '\\pard\\brdrb\\brdrs\\brdrw10 \\par\n'; return; }

      if (tag === 'table') {
        for (const tr of node.querySelectorAll('tr')) {
          const cells = tr.querySelectorAll('td, th');
          const cellWidth = 9000 / (cells.length || 1);
          let pos = 0;
          for (const cell of cells) {
            pos += cellWidth;
            rtf += '\\cellx' + Math.round(pos);
          }
          rtf += '\n';
          for (const cell of cells) {
            for (const child of cell.childNodes)
              processNode(child);
            rtf += '\\cell ';
          }
          rtf += '\\row\n';
        }
        return;
      }

      // Inline elements — apply formatting
      if (['b', 'strong', 'i', 'em', 'u', 's', 'span', 'font', 'a', 'sub', 'sup'].includes(tag)) {
        const wasBold = parseInt(cs.fontWeight, 10) >= 700;
        const wasItalic = cs.fontStyle === 'italic';
        const wasUl = cs.textDecorationLine && cs.textDecorationLine.includes('underline');
        const wasStrike = cs.textDecorationLine && cs.textDecorationLine.includes('line-through');

        rtf += '{';
        if (wasBold) rtf += '\\b';
        if (wasItalic) rtf += '\\i';
        if (wasUl) rtf += '\\ul';
        if (wasStrike) rtf += '\\strike';
        const fi = getFontIndex(cs.fontFamily);
        const si = Math.round(parseFloat(cs.fontSize) * 1.5);
        const ci = getColorIndex(cs.color);
        rtf += '\\f' + fi + '\\fs' + si;
        if (ci > 0) rtf += '\\cf' + ci;
        rtf += ' ';
        for (const child of node.childNodes)
          processNode(child);
        rtf += '}';
        return;
      }

      // Fallback: recurse children
      for (const child of node.childNodes)
        processNode(child);
    }

    // First pass to collect fonts/colors
    for (const child of tmp.childNodes)
      processNode(child);

    document.body.removeChild(tmp);

    // Build header
    let fontTbl = '{\\fonttbl';
    for (let i = 0; i < usedFonts.length; ++i)
      fontTbl += '{\\f' + i + '\\fswiss\\fcharset0 ' + usedFonts[i] + ';}';
    fontTbl += '}';

    let colorTbl = '{\\colortbl ;';
    for (let i = 0; i < usedColors.length; ++i)
      colorTbl += '\\red' + usedColors[i][0] + '\\green' + usedColors[i][1] + '\\blue' + usedColors[i][2] + ';';
    colorTbl += '}';

    return '{\\rtf1\\ansi\\deff0\n' + fontTbl + '\n' + colorTbl + '\n' + rtf + '}';
  }

  async function doExportRtf() {
    const html = getEditorContent();
    // We need the editor DOM to get computed styles, so work with editor directly
    const rtfText = htmlToRtf(html);
    const name = (currentFileName.replace(/\.[^.]+$/, '') || 'Untitled') + '.rtf';
    ComDlg32.ExportFile(new Blob([rtfText], { type: 'application/rtf' }), name);
  }

  // ═══════════════════════════════════════════════════════════════
  // PDF Export (via browser print dialog)
  // ═══════════════════════════════════════════════════════════════

  function doExportPdf() {
    window.print();
  }

  // ═══════════════════════════════════════════════════════════════

  function doExit() {
    if (dirty) {
      promptSaveChanges((result) => {
        if (result === 'yes')
          doSave(() => User32.DestroyWindow());
        else if (result === 'no')
          User32.DestroyWindow();
      });
      return;
    }
    User32.DestroyWindow();
  }

  // ═══════════════════════════════════════════════════════════════
  // Dialog Helpers (using shared SZ.Dialog)
  // ═══════════════════════════════════════════════════════════════

  function awaitDialogResult(overlay, callback) {
    SZ.Dialog.show(overlay.id).then((result) => {
      if (typeof callback === 'function')
        callback(result);
    });
  }

  function promptSaveChanges(callback) {
    SZ.Dialog.show('dlg-save-changes').then(callback);
  }

  // ═══════════════════════════════════════════════════════════════
  // Status Bar
  // ═══════════════════════════════════════════════════════════════

  const statusWords = document.getElementById('status-words');
  const statusChars = document.getElementById('status-chars');
  const statusLines = document.getElementById('status-lines');

  function updateStatusBar() {
    const text = editor.innerText || '';
    const trimmed = text.trim();
    const charCount = trimmed.length;
    const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
    const lineCount = text === '' ? 0 : text.split('\n').length;
    statusWords.textContent = 'Words: ' + wordCount;
    statusChars.textContent = 'Characters: ' + charCount;
    statusLines.textContent = 'Lines: ' + lineCount;
  }

  // ═══════════════════════════════════════════════════════════════
  // Keyboard Shortcuts
  // ═══════════════════════════════════════════════════════════════

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey)
      return;

    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        handleAction('new');
        break;
      case 'o':
        e.preventDefault();
        handleAction('open');
        break;
      case 's':
        e.preventDefault();
        handleAction('save');
        break;
      case 'f':
        e.preventDefault();
        handleAction('find');
        break;
      case 'h':
        e.preventDefault();
        handleAction('replace');
        break;
      case 'p':
        e.preventDefault();
        handleAction('print');
        break;
      case 'k':
        e.preventDefault();
        handleAction('insert-link');
        break;
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Paste Handling
  // ═══════════════════════════════════════════════════════════════

  editor.addEventListener('paste', () => {
    setTimeout(() => {
      markDirty();
      updateStatusBar();
      updateRibbonState();
    }, 0);
  });

  // ═══════════════════════════════════════════════════════════════
  // Utility
  // ═══════════════════════════════════════════════════════════════

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════════════

  const cmd = Kernel32.GetCommandLine();
  if (cmd.path)
    loadFile(cmd.path);
  else {
    updateTitle();
    updateStatusBar();
    updateRibbonState();
  }

  // Update nav pane when content changes
  editor.addEventListener('input', () => {
    if (navPane.style.display !== 'none')
      updateNavPane();
  });

  applyPageSetup();
  editor.focus();
})();
