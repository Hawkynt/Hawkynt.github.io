;(function() {
  'use strict';

  const { DocxEngine, RtfEngine, CommentsTracking, TocFootnotes, ImageTools, ShapeTools, SpellCheck, StylesGallery, EquationEditor, AutoCorrect, FieldCodes, Sections, Bibliography, AutoText, Templates } = window.WordPadApp;
  const { User32, Kernel32, ComDlg32 } = SZ.Dlls || {};

  // ═══════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════

  let currentFilePath = null;
  let currentFileName = 'Untitled';
  let dirty = false;
  let savedContent = '';
  let currentZoom = 100;
  let currentLineSpacing = 1.15;
  let currentFileFormat = 'docx'; // Track current file format
  let docxMetadata = null; // Store parsed DOCX metadata for round-trip

  // Document Properties state
  let docProperties = { title: '', author: '', subject: '', keywords: '', description: '', created: null, modified: null };

  // Restrict Editing state
  let restrictMode = 'none'; // 'none' | 'tracked' | 'readonly'
  let restrictPasswordHash = null;

  // Custom Margins state (inches)
  let customMargins = { top: 1, bottom: 1, left: 1, right: 1, gutter: 0 };

  // Reading Mode state (W4)
  let readingMode = false;

  // Mail Merge state (W2)
  let mergeDataSource = [];
  let mergeFields = ['FirstName', 'LastName', 'Company', 'Address', 'City', 'State', 'ZipCode', 'Email'];
  let mergePreviewActive = false;
  let mergePreviewIndex = 0;

  // Macro Recorder state (W4)
  let macroRecording = false;
  let macroCurrentActions = [];
  let macroSavedMacros = [];
  let macroRecordingIndicator = null;

  const editor = document.getElementById('editor');
  const editorWrapper = document.getElementById('editor-wrapper');

  const FILE_FILTERS = [
    { name: 'Word Document', ext: ['docx'] },
    { name: 'Rich Text', ext: ['html', 'htm'] },
    { name: 'RTF Files', ext: ['rtf'] },
    { name: 'Text Files', ext: ['txt'] },
    { name: 'All Files', ext: ['*'] }
  ];

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

  const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

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

  // Update status bar on selection change to show selected word count
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === editor || editor.contains(document.activeElement))
      updateStatusBarSelection();
  });

  // ═══════════════════════════════════════════════════════════════
  // Action Router
  // ═══════════════════════════════════════════════════════════════

  function handleAction(action) {
    // Macro recording hook
    if (macroRecording && action !== 'macro-stop' && action !== 'macro-record')
      macroCurrentActions.push(action);

    switch (action) {
      // File
      case 'new': doNew(); break;
      case 'new-from-template': showTemplatePicker(); break;
      case 'open': doOpen(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'print': window.print(); break;
      case 'import-rtf': RtfEngine.doImportRtf(setEditorContent, setCurrentFile); break;
      case 'export-txt': doExportTxt(); break;
      case 'export-html': doExportHtml(); break;
      case 'export-rtf': RtfEngine.doExportRtf(getEditorContent, currentFileName); break;
      case 'export-pdf': doExportPdf(); break;
      case 'exit': doExit(); break;
      case 'about': SZ.Dialog.show('dlg-about'); break;
      case 'doc-properties': showDocPropertiesDialog(); break;

      // Edit
      case 'undo': document.execCommand('undo'); editor.focus(); break;
      case 'redo': document.execCommand('redo'); editor.focus(); break;
      case 'cut': document.execCommand('cut'); editor.focus(); break;
      case 'copy': document.execCommand('copy'); editor.focus(); break;
      case 'paste': document.execCommand('paste'); editor.focus(); break;
      case 'paste-special': showPasteSpecialPopup(); break;
      case 'format-painter': formatPainter.isActive ? formatPainter.deactivate() : formatPainter.activate(false); break;
      case 'select-all': document.execCommand('selectAll'); editor.focus(); break;
      case 'find': showFindReplace('find'); break;
      case 'replace': showFindReplace('replace'); break;
      case 'clear-formatting': doClearFormatting(); break;

      // Paragraph
      case 'line-spacing': showLineSpacingPopup(); break;
      case 'borders': showBordersPopup(); break;
      case 'shading': doShading(); break;
      case 'drop-cap': doDropCap(); break;

      // Insert
      case 'insert-table': showInsertTableDialog(); break;
      case 'insert-image-url': showInsertImageDialog(); break;
      case 'insert-image-file': doInsertImageFile(); break;
      case 'insert-textbox': doInsertTextbox(); break;
      case 'insert-shape': ShapeTools.showShapePicker(document.querySelector('[data-action="insert-shape"]')); break;
      case 'insert-link': showInsertLinkDialog(); break;
      case 'insert-bookmark': showInsertBookmarkDialog(); break;
      case 'insert-header': doInsertHeader(); break;
      case 'insert-footer': doInsertFooter(); break;
      case 'insert-symbol': showSymbolDialog(); break;
      case 'insert-hr': doInsertHR(); break;
      case 'insert-page-break': doInsertPageBreak(); break;
      case 'insert-datetime': doInsertDateTime(); break;
      case 'insert-toc': TocFootnotes.insertTOC(); break;
      case 'insert-footnote': TocFootnotes.insertFootnote(); break;
      case 'insert-column-break': TocFootnotes.insertColumnBreak(); break;
      case 'insert-multilevel-list': TocFootnotes.insertMultiLevelList(); break;
      case 'insert-equation': EquationEditor.insertEquation(); break;

      // Field Codes (Sprint 2)
      case 'insert-page-number': doInsertPageNumberField(); break;
      case 'insert-page-count': FieldCodes.insertField('NUMPAGES'); break;
      case 'insert-caption': showCaptionDialog(); break;
      case 'cross-reference': showCrossReferenceDialog(); break;

      // Section Breaks (Sprint 3)
      case 'section-break-next': Sections.insertSectionBreak('nextPage'); break;
      case 'section-break-continuous': Sections.insertSectionBreak('continuous'); break;
      case 'section-break-even': Sections.insertSectionBreak('evenPage'); break;
      case 'section-break-odd': Sections.insertSectionBreak('oddPage'); break;
      case 'toggle-different-first-page': doToggleDifferentFirstPage(); break;
      case 'toggle-different-odd-even': doToggleDifferentOddEven(); break;
      case 'page-borders': showPageBordersDialog(); break;
      case 'line-numbering': doToggleLineNumbering(); break;

      // Text Effects
      case 'text-effect-shadow': doTextEffect('text-shadow', '1px 1px 2px rgba(0,0,0,0.5)'); break;
      case 'text-effect-outline': doTextEffect('-webkit-text-stroke', '1px currentColor'); break;
      case 'text-effect-glow': doTextEffect('text-shadow', '0 0 8px #4488ff'); break;
      case 'text-effect-none': doRemoveTextEffect(); break;

      // Page Layout
      case 'watermark': showWatermarkDialog(); break;

      // View / Zoom / Preview
      case 'print-preview': showPrintPreview(); break;
      case 'zoom-in': setZoom(Math.min(500, currentZoom + 10)); break;
      case 'zoom-out': setZoom(Math.max(25, currentZoom - 10)); break;
      case 'zoom-100': setZoom(100); break;
      case 'zoom-page-width': setZoom(calcPageWidthZoom()); break;
      case 'zoom-full-page': setZoom(calcFullPageZoom(1)); break;
      case 'zoom-two-pages': setZoom(calcFullPageZoom(2)); break;

      // Review
      case 'word-count': showWordCountDialog(); break;
      case 'new-comment': CommentsTracking.addComment(); break;
      case 'delete-comment': CommentsTracking.deleteCurrentComment(); break;
      case 'prev-comment': CommentsTracking.navigateComment(-1); break;
      case 'next-comment': CommentsTracking.navigateComment(1); break;
      case 'toggle-track-changes': CommentsTracking.toggleTrackChanges(); break;
      case 'accept-change': CommentsTracking.acceptCurrentChange(); break;
      case 'reject-change': CommentsTracking.rejectCurrentChange(); break;
      case 'accept-all-changes': CommentsTracking.acceptAllChanges(); break;
      case 'reject-all-changes': CommentsTracking.rejectAllChanges(); break;
      case 'toggle-comments-pane': CommentsTracking.toggleCommentsSidebar(); break;
      case 'restrict-editing': showRestrictEditingDialog(); break;

      // Image
      case 'crop-image': ImageTools.startCrop(); break;
      case 'img-shadow': toggleImageEffect('data-img-shadow'); break;
      case 'img-glow': toggleImageEffect('data-img-glow'); break;
      case 'img-soft-edges': toggleImageEffect('data-img-soft'); break;
      case 'img-grayscale': toggleImageFilter('grayscale'); break;
      case 'img-sepia': toggleImageFilter('sepia'); break;
      case 'img-reset': resetImageEffects(); break;

      // Spell Check & Styles
      case 'spell-check': SpellCheck.runSpellCheck(); break;
      case 'grammar-check': SpellCheck.runGrammarCheck(); break;
      case 'manage-styles': StylesGallery.showManageStylesDialog(); break;

      // Paragraph Flow Controls (Sprint 4)
      case 'keep-with-next': doToggleParagraphFlow('keep-with-next', 'breakAfter', 'avoid'); break;
      case 'keep-together': doToggleParagraphFlow('keep-together', 'breakInside', 'avoid'); break;
      case 'page-break-before': doToggleParagraphFlow('page-break-before', 'breakBefore', 'page'); break;
      case 'widow-orphan': doToggleWidowOrphan(); break;

      // Advanced List Management (Sprint 5)
      case 'restart-numbering': doRestartNumbering(); break;
      case 'continue-numbering': doContinueNumbering(); break;
      case 'define-list-style': doDefineListStyle(); break;

      // Endnotes (Sprint 5)
      case 'insert-endnote': TocFootnotes.insertEndnote(); break;

      // Comment Replies (Sprint 5)
      // Handled within CommentsTracking module

      // Bibliography / Citations (Sprint 6)
      case 'insert-citation': Bibliography.insertCitation(); break;
      case 'manage-sources': Bibliography.showManageSourcesDialog(); break;
      case 'insert-bibliography': Bibliography.generateBibliography(); break;

      // Quick Parts / AutoText (Sprint 6)
      case 'quick-parts': AutoText.showQuickPartsMenu(); break;
      case 'save-to-quick-parts': AutoText.saveSelectionToQuickParts(); break;
      case 'manage-building-blocks': AutoText.showManageBuildingBlocks(); break;

      // Find All (Sprint 5)
      case 'find-all': doFindAll(); break;

      // Word Art (W1)
      case 'insert-wordart': showWordArtDialog(); break;

      // Quick Tables (W2)
      case 'quick-tables': showQuickTableDialog(); break;

      // Document Inspector (W3)
      case 'document-inspector': showDocumentInspector(); break;

      // Reading Mode (W4)
      case 'reading-mode': toggleReadingMode(); break;

      // Form Fields (W5)
      case 'insert-text-field': insertFormField('text'); break;
      case 'insert-checkbox-field': insertFormField('checkbox'); break;
      case 'insert-dropdown-field': insertFormField('dropdown'); break;

      // Table Styles Gallery (W1)
      case 'table-styles': showTableStyleGallery(); break;

      // Mail Merge (W2)
      case 'merge-insert-field': showMergeFieldDialog(); break;
      case 'merge-edit-data': showMergeDataDialog(); break;
      case 'merge-preview': toggleMergePreview(); break;
      case 'merge-prev-record': navigateMergeRecord(-1); break;
      case 'merge-next-record': navigateMergeRecord(1); break;
      case 'merge-finish': doFinishMerge(); break;

      // Compare Documents (W3)
      case 'compare-documents': showCompareDialog(); break;

      // Macro Recorder (W4)
      case 'macro-record': doMacroRecord(); break;
      case 'macro-stop': doMacroStop(); break;
      case 'macro-play': doMacroPlay(); break;
      case 'macro-manager': showMacroManager(); break;

      // Accessibility Checker (W5)
      case 'check-accessibility': showAccessibilityChecker(); break;

      // Table Tools Contextual Tab actions
      case 'tbl-insert-row-above':
      case 'tbl-insert-row-below':
      case 'tbl-insert-col-left':
      case 'tbl-insert-col-right':
      case 'tbl-delete-row':
      case 'tbl-delete-col':
      case 'tbl-delete-table':
      case 'tbl-merge-cells':
      case 'tbl-split-cell':
      case 'tbl-formula':
      case 'tbl-cell-bg':
      case 'tbl-properties':
      case 'tbl-toggle-banded':
      case 'tbl-toggle-header':
      case 'tbl-toggle-repeat-header':
        handleTableToolsAction(action);
        break;
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

  // Wire dropdown menu buttons (text effects, etc.)
  for (const btn of document.querySelectorAll('.rb-dropdown-menu button[data-action]')) {
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleAction(btn.dataset.action);
    });
  }

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

  const fontPicker = new SZ.FontPicker({
    familySelectEl: fontFamilySelect,
    sizeSelectEl: fontSizeSelect,
    defaultFamily: 'Calibri',
    defaultSize: 11,
    onFamilyChange(family) {
      document.execCommand('fontName', false, family);
      editor.focus();
    },
    onSizeChange(size) {
      applyFontSizePt(size);
      editor.focus();
    }
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
  // Color Palette (shared module)
  // ═══════════════════════════════════════════════════════════════

  const sharedColorPalette = new SZ.ColorPalette(document.getElementById('color-palette'), { storageKey: 'sz-wordpad-recent-colors' });
  function showColorPalette(anchorEl, callback) { sharedColorPalette.show(anchorEl, callback); }

  // ═══════════════════════════════════════════════════════════════
  // Color Pickers
  // ═══════════════════════════════════════════════════════════════

  const fontColorSwatch = document.getElementById('rb-font-color');
  const highlightSwatch = document.getElementById('rb-highlight-color');

  fontColorSwatch.parentElement.addEventListener('click', () => {
    const sel = window.getSelection();
    const savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    showColorPalette(fontColorSwatch, (color) => {
      if (savedRange) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
      editor.focus();
      document.execCommand('foreColor', false, color);
      fontColorSwatch.dataset.color = color;
      fontColorSwatch.style.background = color;
    });
  });

  highlightSwatch.parentElement.addEventListener('click', () => {
    const sel = window.getSelection();
    const savedRange = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    showColorPalette(highlightSwatch, (color) => {
      if (savedRange) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
      editor.focus();
      document.execCommand('hiliteColor', false, color);
      highlightSwatch.dataset.color = color;
      highlightSwatch.style.background = color;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Character Spacing Select
  // ═══════════════════════════════════════════════════════════════

  const charSpacingSelect = document.getElementById('rb-char-spacing');
  charSpacingSelect.addEventListener('change', () => {
    const val = charSpacingSelect.value;
    const spacing = parseFloat(val);
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    if (range.collapsed) {
      // Apply to next typed text by wrapping insertion point
      const span = document.createElement('span');
      span.style.letterSpacing = spacing === 0 ? '' : spacing + 'px';
      range.insertNode(span);
      sel.collapse(span, 0);
    } else {
      // Wrap selection in span with letter-spacing
      const fragment = range.extractContents();
      const span = document.createElement('span');
      span.style.letterSpacing = spacing === 0 ? '' : spacing + 'px';
      span.appendChild(fragment);
      range.insertNode(span);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
    }
    editor.focus();
    markDirty();
  });

  // ═══════════════════════════════════════════════════════════════
  // Format Painter
  // ═══════════════════════════════════════════════════════════════

  const formatPainterBtn = document.getElementById('btn-format-painter');

  const formatPainter = new SZ.FormatPainter({
    buttonEl: formatPainterBtn,
    cursorTarget: editor,
    cursorClass: 'format-painter-cursor',
    activeClass: 'active',
    onCapture() {
      const sel = window.getSelection();
      if (!sel.rangeCount || !sel.focusNode) return null;
      let node = sel.focusNode;
      if (node.nodeType === 3) node = node.parentElement;
      if (!node) return null;
      const cs = window.getComputedStyle(node);
      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontStyle: cs.fontStyle,
        textDecoration: cs.textDecoration,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        letterSpacing: cs.letterSpacing
      };
    },
    onApply(fmt) {
      const sel = window.getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const fragment = range.extractContents();
      const span = document.createElement('span');
      span.style.fontFamily = fmt.fontFamily;
      span.style.fontSize = fmt.fontSize;
      span.style.fontWeight = fmt.fontWeight;
      span.style.fontStyle = fmt.fontStyle;
      span.style.textDecoration = fmt.textDecoration;
      span.style.color = fmt.color;
      span.style.backgroundColor = fmt.backgroundColor;
      span.style.letterSpacing = fmt.letterSpacing;
      span.appendChild(fragment);
      range.insertNode(span);
      markDirty();
    }
  });

  editor.addEventListener('pointerup', () => {
    formatPainter.tryApply();
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
        fontColorSwatch.dataset.color = hex;
        fontColorSwatch.style.background = hex;
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
  // Drop Cap
  // ═══════════════════════════════════════════════════════════════

  function doDropCap() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let node = sel.focusNode;
    if (node.nodeType === 3) node = node.parentElement;
    const block = node.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, li');
    if (!block || !editor.contains(block)) return;

    // Toggle: if first child is already a drop cap, remove it
    const existing = block.querySelector('.wp-drop-cap');
    if (existing) {
      const text = existing.textContent;
      existing.replaceWith(document.createTextNode(text));
      markDirty();
      editor.focus();
      return;
    }

    // Find first text node with content
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null, false);
    let textNode = null;
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim().length > 0) {
        textNode = walker.currentNode;
        break;
      }
    }
    if (!textNode || textNode.textContent.length < 1) return;

    const firstChar = textNode.textContent.charAt(0);
    const rest = textNode.textContent.slice(1);

    const span = document.createElement('span');
    span.className = 'wp-drop-cap';
    span.textContent = firstChar;

    textNode.textContent = rest;
    textNode.parentNode.insertBefore(span, textNode);
    markDirty();
    editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // Document Properties Dialog
  // ═══════════════════════════════════════════════════════════════

  function showDocPropertiesDialog() {
    document.getElementById('dp-title').value = docProperties.title;
    document.getElementById('dp-author').value = docProperties.author;
    document.getElementById('dp-subject').value = docProperties.subject;
    document.getElementById('dp-keywords').value = docProperties.keywords;
    document.getElementById('dp-description').value = docProperties.description;
    document.getElementById('dp-created').textContent = docProperties.created
      ? new Date(docProperties.created).toLocaleString() : '\u2014';
    document.getElementById('dp-modified').textContent = docProperties.modified
      ? new Date(docProperties.modified).toLocaleString() : '\u2014';

    const overlay = document.getElementById('dlg-doc-properties');
    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok') return;
      docProperties.title = document.getElementById('dp-title').value.trim();
      docProperties.author = document.getElementById('dp-author').value.trim();
      docProperties.subject = document.getElementById('dp-subject').value.trim();
      docProperties.keywords = document.getElementById('dp-keywords').value.trim();
      docProperties.description = document.getElementById('dp-description').value.trim();
      if (!docProperties.created)
        docProperties.created = new Date().toISOString();
      docProperties.modified = new Date().toISOString();
      markDirty();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Word Count Dialog
  // ═══════════════════════════════════════════════════════════════

  function showWordCountDialog() {
    const text = editor.innerText || '';
    const trimmed = text.trim();

    // Words
    const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;

    // Characters
    const charsWithSpaces = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;

    // Paragraphs: count block-level children
    const blocks = editor.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div:not(.watermark):not(.wp-watermark-image):not(.wp-page-break), blockquote, pre, li');
    const paragraphs = Math.max(1, blocks.length);

    // Lines: estimate from line height
    const editorStyle = window.getComputedStyle(editor);
    const lineHeight = parseFloat(editorStyle.lineHeight) || (parseFloat(editorStyle.fontSize) * 1.15);
    const contentHeight = editor.scrollHeight - parseFloat(editorStyle.paddingTop) - parseFloat(editorStyle.paddingBottom);
    const lines = Math.max(1, Math.round(contentHeight / lineHeight));

    // Pages: estimate from page dimensions
    const pageSizeVal = document.getElementById('rb-page-size').value;
    const orientVal = document.getElementById('rb-page-orient').value;
    const sizes = {
      a4: { h: 297 * 96 / 25.4 },
      letter: { h: 11 * 96 },
      legal: { h: 14 * 96 },
      custom: { h: 11 * 96 }
    };
    let pageH = (sizes[pageSizeVal] || sizes.letter).h;
    if (orientVal === 'landscape') {
      const sizeW = { a4: 210 * 96 / 25.4, letter: 8.5 * 96, legal: 8.5 * 96, custom: 8.5 * 96 };
      pageH = (sizeW[pageSizeVal] || sizeW.letter);
    }
    const pages = Math.max(1, Math.ceil(editor.scrollHeight / pageH));

    document.getElementById('wc-pages').textContent = pages;
    document.getElementById('wc-words').textContent = words;
    document.getElementById('wc-chars-no-space').textContent = charsNoSpaces;
    document.getElementById('wc-chars').textContent = charsWithSpaces;
    document.getElementById('wc-paragraphs').textContent = paragraphs;
    document.getElementById('wc-lines').textContent = lines;

    SZ.Dialog.show('dlg-word-count');
  }

  // ═══════════════════════════════════════════════════════════════
  // Text Effects
  // ═══════════════════════════════════════════════════════════════

  function doTextEffect(prop, value) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    if (range.collapsed) return;

    const fragment = range.extractContents();
    const span = document.createElement('span');
    span.setAttribute('data-text-effect', prop);
    span.style.setProperty(prop, value);
    span.appendChild(fragment);
    range.insertNode(span);

    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);

    editor.focus();
    markDirty();
  }

  function doRemoveTextEffect() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === 3) container = container.parentElement;

    // Find and unwrap text effect spans
    const effectSpans = [];
    if (container.hasAttribute && container.hasAttribute('data-text-effect'))
      effectSpans.push(container);
    for (const span of (container.querySelectorAll ? container.querySelectorAll('[data-text-effect]') : []))
      effectSpans.push(span);

    for (const span of effectSpans) {
      while (span.firstChild)
        span.parentNode.insertBefore(span.firstChild, span);
      span.remove();
    }

    editor.focus();
    markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // Print Preview
  // ═══════════════════════════════════════════════════════════════

  function showPrintPreview() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'wp-print-preview-overlay';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'wp-print-preview-toolbar';

    const printBtn = document.createElement('button');
    printBtn.textContent = 'Print';
    printBtn.addEventListener('click', () => {
      overlay.remove();
      setTimeout(() => window.print(), 100);
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => overlay.remove());

    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Print Preview - ' + currentFileName;

    toolbar.appendChild(titleSpan);
    toolbar.appendChild(printBtn);
    toolbar.appendChild(closeBtn);
    overlay.appendChild(toolbar);

    // Determine page dimensions
    const pageSizeVal = document.getElementById('rb-page-size').value;
    const orientVal = document.getElementById('rb-page-orient').value;
    const sizes = {
      a4: { w: 210 * 96 / 25.4, h: 297 * 96 / 25.4 },
      letter: { w: 8.5 * 96, h: 11 * 96 },
      legal: { w: 8.5 * 96, h: 14 * 96 },
      custom: { w: 8.5 * 96, h: 11 * 96 }
    };
    const size = sizes[pageSizeVal] || sizes.letter;
    const pageW = orientVal === 'landscape' ? size.h : size.w;
    const pageH = orientVal === 'landscape' ? size.w : size.h;

    // Clone editor content
    const content = editor.cloneNode(true);
    content.removeAttribute('contenteditable');
    content.removeAttribute('id');
    content.style.transform = '';
    content.style.transformOrigin = '';

    // Remove watermarks and non-printable elements from clone
    for (const wm of content.querySelectorAll('.watermark, .wp-watermark-image'))
      wm.remove();

    // Get header/footer text
    const headerEl = editor.querySelector('.wp-header-editor') || editor.querySelector('.wp-header');
    const footerEl = editor.querySelector('.wp-footer-editor') || editor.querySelector('.wp-footer');
    const headerText = headerEl ? headerEl.textContent : '';

    // Remove header/footer from clone (we'll add them per page)
    for (const el of content.querySelectorAll('.wp-header, .wp-footer, .wp-header-editor, .wp-footer-editor'))
      el.remove();

    // Remove header/footer toolbars from clone
    for (const tb of content.querySelectorAll('.wp-hf-toolbar'))
      tb.remove();

    // Create a measuring container
    const measurer = document.createElement('div');
    measurer.style.cssText = 'position:absolute;left:-9999px;top:0;width:' + (pageW - 144) + 'px;font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.15;';
    measurer.innerHTML = content.innerHTML;
    document.body.appendChild(measurer);

    const totalHeight = measurer.scrollHeight;
    const usableHeight = pageH - 192; // subtract padding/margins
    const pageCount = Math.max(1, Math.ceil(totalHeight / usableHeight));

    document.body.removeChild(measurer);

    // Create pages
    for (let i = 0; i < pageCount; ++i) {
      const page = document.createElement('div');
      page.className = 'wp-print-preview-page';
      page.style.width = (pageW / 96) + 'in';
      page.style.minHeight = (pageH / 96) + 'in';

      if (i === 0) {
        // First page gets the full content
        page.innerHTML = content.innerHTML;
      } else {
        // Subsequent pages show continuation indicator
        page.innerHTML = '<p style="color:#999;font-style:italic;">Page ' + (i + 1) + ' continues...</p>';
      }

      // Header
      if (headerText) {
        const hdr = document.createElement('div');
        hdr.className = 'wp-print-preview-header';
        hdr.textContent = headerText;
        page.appendChild(hdr);
      }

      // Page number
      const pageNum = document.createElement('div');
      pageNum.className = 'wp-print-preview-page-number';
      pageNum.textContent = 'Page ' + (i + 1) + ' of ' + pageCount;
      page.appendChild(pageNum);

      overlay.appendChild(page);
    }

    document.body.appendChild(overlay);

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
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
  const pageColorSwatch = document.getElementById('rb-page-color');

  pageSizeSelect.addEventListener('change', () => { applyPageSetup(); updatePageBreakIndicators(); });
  pageOrientSelect.addEventListener('change', () => { applyPageSetup(); updatePageBreakIndicators(); });
  pageMarginsSelect.addEventListener('change', () => {
    if (pageMarginsSelect.value === 'custom') {
      showCustomMarginsDialog();
      return;
    }
    applyPageSetup();
    updatePageBreakIndicators();
  });

  function applyPageSetup() {
    const sizes = {
      a4: { w: '210mm', h: '297mm' },
      letter: { w: '8.5in', h: '11in' },
      legal: { w: '8.5in', h: '14in' },
      custom: { w: '8.5in', h: '11in' }
    };
    const presetMargins = { normal: '1in', narrow: '0.5in', wide: '1.25in' };
    const presetMarginInches = { normal: 1, narrow: 0.5, wide: 1.25 };

    const size = sizes[pageSizeSelect.value] || sizes.letter;
    const orient = pageOrientSelect.value;
    const marginKey = pageMarginsSelect.value;

    if (editorWrapper.classList.contains('print-layout')) {
      const pw = orient === 'landscape' ? size.h : size.w;
      editor.style.width = pw;
      editor.style.maxWidth = pw;
      editor.style.minHeight = orient === 'landscape' ? size.w : size.h;
    }

    if (marginKey === 'custom') {
      const g = customMargins.gutter;
      editor.style.paddingTop = customMargins.top + 'in';
      editor.style.paddingBottom = customMargins.bottom + 'in';
      editor.style.paddingLeft = (customMargins.left + g) + 'in';
      editor.style.paddingRight = customMargins.right + 'in';
      rulerMargins.left = customMargins.left + g;
      rulerMargins.right = customMargins.right;
    } else {
      const margin = presetMargins[marginKey] || presetMargins.normal;
      editor.style.padding = margin;
      const mInch = presetMarginInches[marginKey] || 1;
      rulerMargins.left = mInch;
      rulerMargins.right = mInch;
    }

    // Re-render ruler if visible
    renderRuler();
  }

  function showCustomMarginsDialog() {
    // Pre-fill dialog inputs with current custom margin values
    document.getElementById('cm-top').value = customMargins.top;
    document.getElementById('cm-bottom').value = customMargins.bottom;
    document.getElementById('cm-left').value = customMargins.left;
    document.getElementById('cm-right').value = customMargins.right;
    document.getElementById('cm-gutter').value = customMargins.gutter;

    SZ.Dialog.show('dlg-custom-margins').then((result) => {
      if (result === 'ok') {
        customMargins.top = parseFloat(document.getElementById('cm-top').value) || 0;
        customMargins.bottom = parseFloat(document.getElementById('cm-bottom').value) || 0;
        customMargins.left = parseFloat(document.getElementById('cm-left').value) || 0;
        customMargins.right = parseFloat(document.getElementById('cm-right').value) || 0;
        customMargins.gutter = parseFloat(document.getElementById('cm-gutter').value) || 0;
        applyPageSetup();
        updatePageBreakIndicators();
        markDirty();
      } else {
        // User cancelled -- revert the select to its previous value if needed
        const prev = editor.style.paddingTop ? 'custom' : 'normal';
        if (prev !== 'custom')
          pageMarginsSelect.value = 'normal';
      }
    });
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

  pageColorSwatch.addEventListener('click', () => {
    showColorPalette(pageColorSwatch, (color) => {
      pageColorSwatch.dataset.color = color;
      pageColorSwatch.style.background = color;
      editor.style.backgroundColor = color;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // View Controls
  // ═══════════════════════════════════════════════════════════════

  // Document views
  for (const radio of document.querySelectorAll('input[name="view-mode"]')) {
    radio.addEventListener('change', () => {
      editorWrapper.classList.remove('print-layout', 'web-layout');
      // Clear multi-page styles
      editor.style.backgroundImage = '';
      editor.style.minHeight = '';
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
      updatePageBreakIndicators();
    });
  }

  // Default to print layout
  editorWrapper.classList.add('print-layout');

  // Ruler (horizontal + vertical)
  const ruler = document.getElementById('ruler');
  const vertRuler = document.getElementById('ruler-vertical');
  document.getElementById('view-ruler').addEventListener('change', function() {
    ruler.style.display = this.checked ? 'flex' : 'none';
    if (vertRuler)
      vertRuler.style.display = this.checked ? 'block' : 'none';
    if (this.checked)
      renderRuler();
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

  // updateNavPane defined below in Feature 4.2 section

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
    updatePageBreakIndicators();
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
          const rows = parseInt(cell.dataset.row, 10);
          const cols = parseInt(cell.dataset.col, 10);
          if (rows > 0 && cols > 0) {
            const dlgOverlay = document.getElementById('dlg-insert-table');
            if (dlgOverlay._dialogDone)
              dlgOverlay._dialogDone(null);
            else
              dlgOverlay.classList.remove('visible');
            insertTable(rows, cols);
          }
        });
        picker.appendChild(cell);
      }
    }

    // Reset grid highlight on mouse leave
    picker.addEventListener('pointerleave', () => {
      label.textContent = rowsInput.value + ' x ' + colsInput.value;
      updateGridHighlight(picker, parseInt(rowsInput.value, 10), parseInt(colsInput.value, 10));
    });

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
    const colWidth = Math.floor(100 / cols);
    let html = '<table style="width:100%;border-collapse:collapse;">';
    for (let r = 0; r < rows; ++r) {
      html += '<tr>';
      for (let c = 0; c < cols; ++c)
        html += '<td style="width:' + colWidth + '%"><br></td>';
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    editor.focus();
    markDirty();
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
    '<div class="ctx-sep"></div>',
    '<div class="ctx-entry" data-taction="table-style-banded">Toggle Banded Rows</div>',
    '<div class="ctx-entry" data-taction="table-style-header">Toggle Header Row Style</div>',
    '<div class="ctx-entry" data-taction="table-repeat-header">Toggle Repeat Header</div>',
    '<div class="ctx-entry" data-taction="table-formula">Insert Formula</div>',
    '<div class="ctx-entry" data-taction="table-properties">Table Properties...</div>',
  ].join('');
  document.body.appendChild(tableCtx);

  let contextCell = null;

  // ── Text editing context menu ──
  const textCtx = document.createElement('div');
  textCtx.className = 'table-context-menu';
  textCtx.innerHTML = [
    '<div class="ctx-entry" data-action="cut">Cut</div>',
    '<div class="ctx-entry" data-action="copy">Copy</div>',
    '<div class="ctx-entry" data-action="paste">Paste</div>',
    '<div class="ctx-entry" data-action="paste-special">Paste Special...</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-entry" data-action="select-all">Select All</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-entry" data-action="bold">Bold</div>',
    '<div class="ctx-entry" data-action="italic">Italic</div>',
    '<div class="ctx-entry" data-action="underline">Underline</div>',
    '<div class="ctx-sep"></div>',
    '<div class="ctx-entry" data-action="align-left">Align Left</div>',
    '<div class="ctx-entry" data-action="align-center">Align Center</div>',
    '<div class="ctx-entry" data-action="align-right">Align Right</div>',
  ].join('');
  document.body.appendChild(textCtx);

  for (const entry of textCtx.querySelectorAll('.ctx-entry')) {
    entry.addEventListener('click', () => {
      textCtx.classList.remove('visible');
      handleAction(entry.dataset.action);
      editor.focus();
    });
  }

  editor.addEventListener('contextmenu', (e) => {
    const td = e.target.closest('td, th');
    if (td && editor.contains(td)) {
      e.preventDefault();
      textCtx.classList.remove('visible');
      contextCell = td;
      tableCtx.style.left = e.clientX + 'px';
      tableCtx.style.top = e.clientY + 'px';
      tableCtx.classList.add('visible');
      return;
    }

    e.preventDefault();
    tableCtx.classList.remove('visible');
    textCtx.style.left = e.clientX + 'px';
    textCtx.style.top = e.clientY + 'px';
    textCtx.classList.add('visible');
  });

  document.addEventListener('pointerdown', (e) => {
    if (!tableCtx.contains(e.target))
      tableCtx.classList.remove('visible');
    if (!textCtx.contains(e.target))
      textCtx.classList.remove('visible');
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
        showColorPalette(cell, (color) => {
          cell.style.backgroundColor = color;
          markDirty();
        });
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
      case 'table-style-banded':
        table.classList.toggle('wp-table-banded');
        break;
      case 'table-style-header':
        table.classList.toggle('wp-table-header-row');
        break;
      case 'table-repeat-header': {
        const firstRow = table.rows[0];
        if (firstRow) {
          if (firstRow.hasAttribute('data-repeat-header'))
            firstRow.removeAttribute('data-repeat-header');
          else
            firstRow.setAttribute('data-repeat-header', 'true');
        }
        break;
      }
      case 'table-formula': {
        const formula = prompt('Enter formula (e.g. =SUM(ABOVE)):', '=SUM(ABOVE)');
        if (!formula)
          break;
        const formulaResult = evaluateTableFormula(formula, cell, table);
        cell.innerHTML = '<span class="wp-table-formula" data-formula="' + escapeHtml(formula) + '">' + formulaResult + '</span>';
        break;
      }
      case 'table-properties':
        showTablePropertiesDialog(table);
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Table Tools Contextual Ribbon Tab
  // ═══════════════════════════════════════════════════════════════

  const tableToolsTab = document.getElementById('tab-table-tools');

  function getActiveTableCell() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.focusNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    return node ? node.closest('td, th') : null;
  }

  function updateTableToolsVisibility() {
    const cell = getActiveTableCell();
    if (cell && editor.contains(cell)) {
      if (tableToolsTab) tableToolsTab.style.display = '';
      updateTableToolsCheckboxes(cell);
    } else {
      if (tableToolsTab) tableToolsTab.style.display = 'none';
      // If Table Tools panel is active, switch to Home
      const activePanel = document.querySelector('.ribbon-panel.active');
      if (activePanel && activePanel.id === 'ribbon-table-tools') {
        const homeTab = document.querySelector('.ribbon-tab[data-tab="home"]');
        if (homeTab) homeTab.click();
      }
    }
  }

  function updateTableToolsCheckboxes(cell) {
    const table = cell ? cell.closest('table') : null;
    if (!table) return;
    const bandedCb = document.getElementById('tbl-banded');
    const headerCb = document.getElementById('tbl-header-row');
    const repeatCb = document.getElementById('tbl-repeat-header');
    if (bandedCb) bandedCb.checked = table.classList.contains('wp-table-banded');
    if (headerCb) headerCb.checked = table.classList.contains('wp-table-header-row');
    if (repeatCb) repeatCb.checked = table.rows[0] && table.rows[0].hasAttribute('data-repeat-header');
  }

  function handleTableToolsAction(action) {
    const cell = getActiveTableCell();
    if (!cell) return;
    const tblAction = action.replace('tbl-', '').replace(/-/g, '-');
    // Map ribbon actions to existing table context menu actions
    const actionMap = {
      'tbl-insert-row-above': 'insert-row-above',
      'tbl-insert-row-below': 'insert-row-below',
      'tbl-insert-col-left': 'insert-col-left',
      'tbl-insert-col-right': 'insert-col-right',
      'tbl-delete-row': 'delete-row',
      'tbl-delete-col': 'delete-col',
      'tbl-delete-table': 'delete-table',
      'tbl-merge-cells': 'merge-cells',
      'tbl-split-cell': 'split-cell',
      'tbl-formula': 'table-formula',
      'tbl-cell-bg': 'cell-bg',
      'tbl-properties': 'table-properties',
      'tbl-toggle-banded': 'table-style-banded',
      'tbl-toggle-header': 'table-style-header',
      'tbl-toggle-repeat-header': 'table-repeat-header',
    };
    const mapped = actionMap[action];
    if (mapped) handleTableAction(mapped, cell);
    updateTableToolsCheckboxes(cell);
  }

  // Wire checkbox toggles for Table Tools
  for (const cb of document.querySelectorAll('#ribbon-table-tools input[type="checkbox"][data-action]')) {
    cb.addEventListener('change', (e) => {
      e.preventDefault();
      handleAction(cb.dataset.action);
    });
  }

  editor.addEventListener('click', () => setTimeout(updateTableToolsVisibility, 10));
  editor.addEventListener('keyup', () => setTimeout(updateTableToolsVisibility, 10));

  // ═══════════════════════════════════════════════════════════════
  // Picture Format Contextual Ribbon Tab
  // ═══════════════════════════════════════════════════════════════

  const pictureFormatTab = document.getElementById('tab-picture-format');
  const imgBrightnessSlider = document.getElementById('img-brightness');
  const imgContrastSlider = document.getElementById('img-contrast');

  function updatePictureFormatVisibility() {
    const img = ImageTools.getSelectedImage();
    if (img && editor.contains(img)) {
      if (pictureFormatTab) {
        pictureFormatTab.style.display = '';
        // Auto-switch to Picture Format tab
        pictureFormatTab.click();
      }
      // Sync sliders with current image state
      syncPictureFormatControls(img);
    } else {
      if (pictureFormatTab) pictureFormatTab.style.display = 'none';
      // If Picture Format panel is active, switch to Home
      const activePanel = document.querySelector('.ribbon-panel.active');
      if (activePanel && activePanel.id === 'ribbon-picture-format') {
        const homeTab = document.querySelector('.ribbon-tab[data-tab="home"]');
        if (homeTab) homeTab.click();
      }
    }
  }

  function syncPictureFormatControls(img) {
    if (imgBrightnessSlider) {
      const bVal = img.getAttribute('data-img-brightness');
      imgBrightnessSlider.value = bVal != null ? bVal : '0';
    }
    if (imgContrastSlider) {
      const cVal = img.getAttribute('data-img-contrast');
      imgContrastSlider.value = cVal != null ? cVal : '0';
    }
  }

  function toggleImageEffect(attr) {
    const img = ImageTools.getSelectedImage();
    if (!img) return;
    if (img.hasAttribute(attr))
      img.removeAttribute(attr);
    else
      img.setAttribute(attr, '');
    // Shadow and glow are mutually exclusive (both use box-shadow)
    if (attr === 'data-img-shadow' && img.hasAttribute('data-img-glow'))
      img.removeAttribute('data-img-glow');
    else if (attr === 'data-img-glow' && img.hasAttribute('data-img-shadow'))
      img.removeAttribute('data-img-shadow');
    editor.focus();
    markDirty();
  }

  function toggleImageFilter(filterName) {
    const img = ImageTools.getSelectedImage();
    if (!img) return;
    const attr = 'data-img-' + filterName;
    if (img.hasAttribute(attr))
      img.removeAttribute(attr);
    else
      img.setAttribute(attr, '');
    // Grayscale and sepia are mutually exclusive
    if (filterName === 'grayscale' && img.hasAttribute('data-img-sepia'))
      img.removeAttribute('data-img-sepia');
    else if (filterName === 'sepia' && img.hasAttribute('data-img-grayscale'))
      img.removeAttribute('data-img-grayscale');
    rebuildImageFilter(img);
    editor.focus();
    markDirty();
  }

  function rebuildImageFilter(img) {
    const parts = [];
    if (img.hasAttribute('data-img-grayscale'))
      parts.push('grayscale(100%)');
    if (img.hasAttribute('data-img-sepia'))
      parts.push('sepia(100%)');
    const brightness = parseInt(img.getAttribute('data-img-brightness') || '0', 10);
    if (brightness !== 0)
      parts.push('brightness(' + ((100 + brightness) / 100) + ')');
    const contrast = parseInt(img.getAttribute('data-img-contrast') || '0', 10);
    if (contrast !== 0)
      parts.push('contrast(' + ((100 + contrast) / 100) + ')');
    img.style.filter = parts.length ? parts.join(' ') : '';
  }

  function resetImageEffects() {
    const img = ImageTools.getSelectedImage();
    if (!img) return;
    img.removeAttribute('data-img-shadow');
    img.removeAttribute('data-img-glow');
    img.removeAttribute('data-img-soft');
    img.removeAttribute('data-img-grayscale');
    img.removeAttribute('data-img-sepia');
    img.removeAttribute('data-img-brightness');
    img.removeAttribute('data-img-contrast');
    img.style.filter = '';
    img.style.boxShadow = '';
    img.style.borderRadius = '';
    if (imgBrightnessSlider) imgBrightnessSlider.value = '0';
    if (imgContrastSlider) imgContrastSlider.value = '0';
    editor.focus();
    markDirty();
  }

  // Wire brightness/contrast sliders
  if (imgBrightnessSlider) {
    imgBrightnessSlider.addEventListener('input', () => {
      const img = ImageTools.getSelectedImage();
      if (!img) return;
      img.setAttribute('data-img-brightness', imgBrightnessSlider.value);
      rebuildImageFilter(img);
      markDirty();
    });
  }

  if (imgContrastSlider) {
    imgContrastSlider.addEventListener('input', () => {
      const img = ImageTools.getSelectedImage();
      if (!img) return;
      img.setAttribute('data-img-contrast', imgContrastSlider.value);
      rebuildImageFilter(img);
      markDirty();
    });
  }

  // Update Picture Format visibility on click/keyup (piggyback on existing events)
  editor.addEventListener('click', () => setTimeout(updatePictureFormatVisibility, 20));
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#ribbon-picture-format') && !e.target.closest('#tab-picture-format') && e.target.tagName !== 'IMG')
      setTimeout(updatePictureFormatVisibility, 20);
  });

  // ═══════════════════════════════════════════════════════════════
  // Table Formula Evaluation
  // ═══════════════════════════════════════════════════════════════

  function evaluateTableFormula(formula, cell, table) {
    if (!formula || !cell || !table)
      return '?';

    const upper = formula.toUpperCase().replace(/\s+/g, '');
    const tr = cell.closest('tr');
    const colIndex = Array.from(tr.cells).indexOf(cell);
    const rowIndex = Array.from(table.rows).indexOf(tr);

    function getCellNumericValue(r, c) {
      if (r < 0 || r >= table.rows.length)
        return 0;
      const row = table.rows[r];
      if (c < 0 || c >= row.cells.length)
        return 0;
      const text = row.cells[c].textContent.trim();
      const val = parseFloat(text);
      return isNaN(val) ? 0 : val;
    }

    function getValuesInDirection(direction) {
      const values = [];
      if (direction === 'ABOVE') {
        for (let r = rowIndex - 1; r >= 0; --r)
          values.push(getCellNumericValue(r, colIndex));
      } else if (direction === 'BELOW') {
        for (let r = rowIndex + 1; r < table.rows.length; ++r)
          values.push(getCellNumericValue(r, colIndex));
      } else if (direction === 'LEFT') {
        for (let c = colIndex - 1; c >= 0; --c)
          values.push(getCellNumericValue(rowIndex, c));
      } else if (direction === 'RIGHT') {
        for (let c = colIndex + 1; c < tr.cells.length; ++c)
          values.push(getCellNumericValue(rowIndex, c));
      }
      return values;
    }

    // Parse function(direction) pattern
    const match = upper.match(/^=(\w+)\((\w+)\)$/);
    if (!match)
      return '?';

    const func = match[1];
    const direction = match[2];
    const values = getValuesInDirection(direction);

    if (!values.length)
      return '0';

    switch (func) {
      case 'SUM':
        return String(values.reduce((a, b) => a + b, 0));
      case 'AVERAGE':
      case 'AVG':
        return String(Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100);
      case 'COUNT':
        return String(values.length);
      case 'MAX':
        return String(Math.max(...values));
      case 'MIN':
        return String(Math.min(...values));
      case 'PRODUCT':
        return String(values.reduce((a, b) => a * b, 1));
      default:
        return '?';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Table Properties Dialog
  // ═══════════════════════════════════════════════════════════════

  function showTablePropertiesDialog(table) {
    if (!table)
      return;

    const widthInput = document.getElementById('tp-width');
    const alignSelect = document.getElementById('tp-align');
    const paddingInput = document.getElementById('tp-padding');
    const borderInput = document.getElementById('tp-border');
    const borderColorSwatch = document.getElementById('tp-border-color');
    const bandedCheck = document.getElementById('tp-banded');
    const headerRowCheck = document.getElementById('tp-header-row');
    const repeatHeaderCheck = document.getElementById('tp-repeat-header');

    // Populate from current table state
    const currentWidth = parseInt(table.style.width, 10);
    widthInput.value = !isNaN(currentWidth) ? currentWidth : 100;

    const cs = window.getComputedStyle(table);
    if (cs.marginLeft === 'auto' && cs.marginRight === 'auto')
      alignSelect.value = 'center';
    else if (cs.marginLeft === 'auto')
      alignSelect.value = 'right';
    else
      alignSelect.value = 'left';

    const firstTd = table.querySelector('td, th');
    if (firstTd) {
      const tdCs = window.getComputedStyle(firstTd);
      paddingInput.value = parseInt(tdCs.padding, 10) || 4;
      borderInput.value = parseInt(tdCs.borderWidth, 10) || 1;
      const resolvedColor = rgbToHex(tdCs.borderColor) || '#999999';
      borderColorSwatch.dataset.color = resolvedColor;
      borderColorSwatch.style.backgroundColor = resolvedColor;
    }

    bandedCheck.checked = table.classList.contains('wp-table-banded');
    headerRowCheck.checked = table.classList.contains('wp-table-header-row');
    const firstRow = table.rows[0];
    repeatHeaderCheck.checked = firstRow && firstRow.hasAttribute('data-repeat-header');

    const overlay = document.getElementById('dlg-table-props');
    overlay.style.display = 'flex';

    borderColorSwatch.onclick = () => showColorPalette(borderColorSwatch, (c) => { borderColorSwatch.dataset.color = c; borderColorSwatch.style.backgroundColor = c; });

    const okBtn = overlay.querySelector('.wp-dlg-ok');
    const cancelBtn = overlay.querySelector('.wp-dlg-cancel');

    const applyHandler = () => {
      borderColorSwatch.onclick = null;
      // Apply table properties
      table.style.width = widthInput.value + '%';

      const align = alignSelect.value;
      if (align === 'center') {
        table.style.marginLeft = 'auto';
        table.style.marginRight = 'auto';
      } else if (align === 'right') {
        table.style.marginLeft = 'auto';
        table.style.marginRight = '0';
      } else {
        table.style.marginLeft = '0';
        table.style.marginRight = '';
      }

      const padding = paddingInput.value + 'px';
      const borderW = borderInput.value + 'px';
      const borderColor = borderColorSwatch.dataset.color;
      for (const td of table.querySelectorAll('td, th')) {
        td.style.padding = padding;
        td.style.borderWidth = borderW;
        td.style.borderColor = borderColor;
        td.style.borderStyle = parseInt(borderInput.value, 10) > 0 ? 'solid' : 'none';
      }

      table.classList.toggle('wp-table-banded', bandedCheck.checked);
      table.classList.toggle('wp-table-header-row', headerRowCheck.checked);

      if (firstRow) {
        if (repeatHeaderCheck.checked)
          firstRow.setAttribute('data-repeat-header', 'true');
        else
          firstRow.removeAttribute('data-repeat-header');
      }

      overlay.style.display = 'none';
      okBtn.removeEventListener('click', applyHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
      markDirty();
    };

    const cancelHandler = () => {
      borderColorSwatch.onclick = null;
      overlay.style.display = 'none';
      okBtn.removeEventListener('click', applyHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
    };

    okBtn.addEventListener('click', applyHandler);
    cancelBtn.addEventListener('click', cancelHandler);
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

  // ═══════════════════════════════════════════════════════════════
  // Insert Shapes, Text Box
  // ═══════════════════════════════════════════════════════════════

  function doInsertShape(type) {
    ShapeTools.insertShape(type);
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
    const existing = editor.querySelector('.wp-header-editor');
    if (existing) {
      existing.focus();
      _showHeaderFooterToolbar(existing, 'header');
      return;
    }
    // Remove legacy wp-header if present
    const legacy = editor.querySelector('.wp-header');
    let legacyContent = '';
    if (legacy) {
      legacyContent = legacy.innerHTML;
      legacy.remove();
    }
    const header = document.createElement('div');
    header.className = 'wp-header-editor';
    header.contentEditable = 'true';
    header.setAttribute('data-hf-type', 'header');
    if (legacyContent && legacyContent !== 'Header - click to edit')
      header.innerHTML = legacyContent;

    editor.insertBefore(header, editor.firstChild);
    header.focus();
    _showHeaderFooterToolbar(header, 'header');
    markDirty();
  }

  function doInsertFooter() {
    const existing = editor.querySelector('.wp-footer-editor');
    if (existing) {
      existing.focus();
      _showHeaderFooterToolbar(existing, 'footer');
      return;
    }
    // Remove legacy wp-footer if present
    const legacy = editor.querySelector('.wp-footer');
    let legacyContent = '';
    if (legacy) {
      legacyContent = legacy.innerHTML;
      legacy.remove();
    }
    const footer = document.createElement('div');
    footer.className = 'wp-footer-editor';
    footer.contentEditable = 'true';
    footer.setAttribute('data-hf-type', 'footer');
    if (legacyContent && legacyContent !== 'Footer - click to edit')
      footer.innerHTML = legacyContent;

    editor.appendChild(footer);
    footer.focus();
    _showHeaderFooterToolbar(footer, 'footer');
    markDirty();
  }

  function _showHeaderFooterToolbar(targetEl, type) {
    // Remove existing toolbar if any
    _closeHeaderFooterToolbar();

    const toolbar = document.createElement('div');
    toolbar.className = 'wp-hf-toolbar';
    toolbar.contentEditable = 'false';

    const label = document.createElement('span');
    label.className = 'wp-hf-toolbar-label';
    label.textContent = type === 'header' ? 'Header' : 'Footer';
    toolbar.appendChild(label);

    const fieldCodes = ['PAGE', 'NUMPAGES', 'DATE', 'TIME'];
    for (const code of fieldCodes) {
      const btn = document.createElement('button');
      btn.className = 'wp-hf-toolbar-btn';
      btn.textContent = '{' + code + '}';
      btn.title = 'Insert ' + code + ' field';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Focus the editor div and place cursor at end
        targetEl.focus();
        const sel = window.getSelection();
        if (!sel.rangeCount || !targetEl.contains(sel.focusNode)) {
          const range = document.createRange();
          range.selectNodeContents(targetEl);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        FieldCodes.insertField(code);
      });
      toolbar.appendChild(btn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'wp-hf-toolbar-btn wp-hf-toolbar-close';
    closeBtn.textContent = 'Close Header and Footer';
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      _closeHeaderFooterToolbar();
      editor.focus();
    });
    toolbar.appendChild(closeBtn);

    targetEl.appendChild(toolbar);
  }

  function _closeHeaderFooterToolbar() {
    const existing = editor.querySelector('.wp-hf-toolbar');
    if (existing)
      existing.remove();
  }

  function doInsertPageNumberField() {
    // Use field code instead of static text
    let footer = editor.querySelector('.wp-footer-editor') || editor.querySelector('.wp-footer');
    if (!footer)
      doInsertFooter();
    const target = editor.querySelector('.wp-footer-editor') || editor.querySelector('.wp-footer');
    if (target) {
      // Clear default text if it's the placeholder
      if (target.textContent === 'Footer - click to edit')
        target.textContent = '';
      // Focus the footer, then insert field
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      FieldCodes.insertField('PAGE');
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
  // Caption Dialog (Sprint 2)
  // ═══════════════════════════════════════════════════════════════

  function showCaptionDialog() {
    document.getElementById('cap-text').value = '';
    const overlay = document.getElementById('dlg-caption');
    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;
      const label = document.getElementById('cap-label').value;
      const text = document.getElementById('cap-text').value.trim();
      const position = document.getElementById('cap-position').value;
      const numbering = document.getElementById('cap-numbering').value;

      // Build caption HTML with SEQ field code
      const captionP = document.createElement('p');
      captionP.className = 'wp-caption';

      // Label text
      captionP.appendChild(document.createTextNode(label + ' '));

      // SEQ field for auto-numbering
      const seqSpan = document.createElement('span');
      seqSpan.className = 'wp-field';
      seqSpan.setAttribute('data-field-type', 'SEQ');
      seqSpan.setAttribute('data-field-param', label + ':' + numbering);
      seqSpan.contentEditable = 'false';
      seqSpan.textContent = '0';
      captionP.appendChild(seqSpan);

      // Caption text
      if (text)
        captionP.appendChild(document.createTextNode(': ' + text));

      // Insert at cursor position
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        let container = range.commonAncestorContainer;
        if (container.nodeType === 3) container = container.parentElement;
        const block = container.closest('p, div, h1, h2, h3, h4, h5, h6, img, table, blockquote');

        if (block && editor.contains(block)) {
          if (position === 'above')
            block.before(captionP);
          else
            block.after(captionP);
        } else {
          range.deleteContents();
          range.insertNode(captionP);
        }
      } else {
        editor.appendChild(captionP);
      }

      // Update field codes to assign correct sequence number
      FieldCodes.updateAllFields();
      markDirty();
      editor.focus();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Cross-Reference Dialog (Sprint 2)
  // ═══════════════════════════════════════════════════════════════

  function showCrossReferenceDialog() {
    const typeSelect = document.getElementById('xref-type');
    const formatSelect = document.getElementById('xref-format');
    const targetsList = document.getElementById('xref-targets');

    function populateTargets() {
      targetsList.innerHTML = '';
      const refType = typeSelect.value;

      if (refType === 'heading') {
        const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const h of headings) {
          const opt = document.createElement('option');
          const text = h.textContent.trim();
          opt.value = text;
          opt.textContent = h.tagName + ': ' + text;
          targetsList.appendChild(opt);
        }
      } else if (refType === 'bookmark') {
        const bookmarks = editor.querySelectorAll('a[name]');
        for (const bm of bookmarks) {
          const name = bm.getAttribute('name');
          if (!name)
            continue;
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          targetsList.appendChild(opt);
        }
      } else if (refType === 'figure' || refType === 'table') {
        const label = refType === 'figure' ? 'Figure' : 'Table';
        const captions = editor.querySelectorAll('.wp-caption');
        for (const cap of captions) {
          const text = cap.textContent.trim();
          if (text.startsWith(label)) {
            const opt = document.createElement('option');
            opt.value = text;
            opt.textContent = text;
            targetsList.appendChild(opt);
          }
        }
      }

      if (!targetsList.options.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(No targets found)';
        opt.disabled = true;
        targetsList.appendChild(opt);
      }
    }

    typeSelect.addEventListener('change', populateTargets);
    populateTargets();

    const overlay = document.getElementById('dlg-cross-ref');
    awaitDialogResult(overlay, (result) => {
      typeSelect.removeEventListener('change', populateTargets);
      if (result !== 'ok')
        return;

      const selectedTarget = targetsList.value;
      if (!selectedTarget)
        return;

      const refFormat = formatSelect.value;
      const refType = typeSelect.value;

      if (refFormat === 'page') {
        // Insert PAGE field referencing the target position
        FieldCodes.insertField('REF', selectedTarget);
      } else if (refFormat === 'label-number') {
        // Insert the label and number text
        FieldCodes.insertField('REF', selectedTarget);
      } else {
        // Insert text reference
        FieldCodes.insertField('REF', selectedTarget);
      }

      markDirty();
      editor.focus();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Section Controls (Sprint 3)
  // ═══════════════════════════════════════════════════════════════

  function doToggleDifferentFirstPage() {
    const section = Sections.getCurrentSection();
    const state = Sections.toggleDifferentFirstPage(section);
    const cb = document.querySelector('[data-action="toggle-different-first-page"]');
    if (cb && cb.type === 'checkbox')
      cb.checked = state;
  }

  function doToggleDifferentOddEven() {
    const section = Sections.getCurrentSection();
    const state = Sections.toggleDifferentOddEven(section);
    const cb = document.querySelector('[data-action="toggle-different-odd-even"]');
    if (cb && cb.type === 'checkbox')
      cb.checked = state;
  }

  function showPageBordersDialog() {
    document.getElementById('pb-style').value = 'none';
    document.getElementById('pb-width').value = '1';
    const pbColorSwatch = document.getElementById('pb-color');
    pbColorSwatch.dataset.color = '#000000';
    pbColorSwatch.style.backgroundColor = '#000000';
    document.getElementById('pb-apply').value = 'document';

    const overlay = document.getElementById('dlg-page-borders');
    pbColorSwatch.onclick = () => showColorPalette(pbColorSwatch, (c) => { pbColorSwatch.dataset.color = c; pbColorSwatch.style.backgroundColor = c; });
    awaitDialogResult(overlay, (result) => {
      pbColorSwatch.onclick = null;
      if (result !== 'ok')
        return;
      const style = document.getElementById('pb-style').value;
      const width = parseInt(document.getElementById('pb-width').value, 10) || 1;
      const color = pbColorSwatch.dataset.color;
      const applyTo = document.getElementById('pb-apply').value;

      const borderProps = style === 'none' ? null : { style, width, color };
      Sections.applyPageBorders(applyTo, borderProps);
      editor.focus();
    });
  }

  function doToggleLineNumbering() {
    const section = Sections.getCurrentSection();
    Sections.toggleLineNumbering(section || null);
    editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // Watermark
  // ═══════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════
  // Watermark Dialog (Text + Image tabs)
  // ═══════════════════════════════════════════════════════════════

  // Wire watermark dialog tabs
  const wmTabs = document.querySelectorAll('.wp-wm-tab');
  const wmPanelText = document.getElementById('wm-panel-text');
  const wmPanelImage = document.getElementById('wm-panel-image');
  let wmActiveTab = 'text';

  for (const tab of wmTabs) {
    tab.addEventListener('click', () => {
      for (const t of wmTabs) t.classList.remove('active');
      tab.classList.add('active');
      wmActiveTab = tab.dataset.wmTab;
      wmPanelText.style.display = wmActiveTab === 'text' ? '' : 'none';
      wmPanelImage.style.display = wmActiveTab === 'image' ? '' : 'none';
    });
  }

  function showWatermarkDialog() {
    const wmText = document.getElementById('wm-text');
    const wmRemove = document.getElementById('wm-remove');
    const wmImageFile = document.getElementById('wm-image-file');
    wmRemove.checked = false;
    wmImageFile.value = '';

    const existing = editor.querySelector('.watermark');
    if (existing)
      wmText.value = existing.textContent;

    const overlay = document.getElementById('dlg-watermark');
    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;

      // Handle remove
      if (wmRemove.checked) {
        const oldText = editor.querySelector('.watermark');
        if (oldText) oldText.remove();
        const oldImg = editor.querySelector('.wp-watermark-image');
        if (oldImg) oldImg.remove();
        return;
      }

      if (wmActiveTab === 'image') {
        // Image watermark
        const files = wmImageFile.files;
        if (!files || !files.length) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          // Remove old watermarks
          const oldText = editor.querySelector('.watermark');
          if (oldText) oldText.remove();
          const oldImg = editor.querySelector('.wp-watermark-image');
          if (oldImg) oldImg.remove();

          const img = document.createElement('img');
          img.className = 'wp-watermark-image';
          img.src = ev.target.result;
          img.alt = 'Watermark';
          editor.insertBefore(img, editor.firstChild);
          markDirty();
        };
        reader.readAsDataURL(file);
      } else {
        // Text watermark
        const text = wmText.value.trim();
        if (!text) return;

        // Remove image watermark if present
        const oldImg = editor.querySelector('.wp-watermark-image');
        if (oldImg) oldImg.remove();

        const old = editor.querySelector('.watermark');
        if (old) {
          old.textContent = text;
        } else {
          const div = document.createElement('div');
          div.className = 'watermark';
          div.textContent = text;
          editor.insertBefore(div, editor.firstChild);
        }
      }
      markDirty();
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

  let findCurrentIndex = -1;

  document.getElementById('fp-close').addEventListener('click', () => {
    findPanel.classList.remove('visible');
    clearFindHighlights();
    findCurrentIndex = -1;
    editor.focus();
  });

  function getSearchRegex(needle, flags) {
    const wholeWord = document.getElementById('fr-whole-word') && document.getElementById('fr-whole-word').checked;
    if (fpRegex.checked) {
      try {
        let pat = needle;
        if (wholeWord)
          pat = '\\b' + pat + '\\b';
        return new RegExp(pat, flags);
      } catch (e) {
        fpStatus.textContent = 'Invalid regex: ' + e.message;
        return null;
      }
    }
    let escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord)
      escaped = '\\b' + escaped + '\\b';
    return new RegExp(escaped, flags);
  }

  // Highlight all matches and set the current match index
  function highlightAllMatches() {
    clearFindHighlights();
    findCurrentIndex = -1;

    const needle = fpFindInput.value;
    if (!needle) {
      fpStatus.textContent = '';
      return 0;
    }

    const caseSensitive = fpCaseSensitive.checked;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = getSearchRegex(needle, flags);
    if (!regex)
      return 0;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode())
      textNodes.push(walker.currentNode);

    let matchCount = 0;
    for (let i = textNodes.length - 1; i >= 0; --i) {
      const node = textNodes[i];
      if (!matchesFormatFilter(node))
        continue;

      const text = node.textContent;
      const matches = [...text.matchAll(regex)];
      if (!matches.length)
        continue;

      const parent = node.parentNode;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;

      for (const match of matches) {
        if (match.index > lastIndex)
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

        const span = document.createElement('span');
        span.className = 'wp-find-highlight';
        span.textContent = match[0];
        frag.appendChild(span);

        lastIndex = match.index + match[0].length;
        ++matchCount;
      }

      if (lastIndex < text.length)
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));

      parent.replaceChild(frag, node);
    }

    if (matchCount > 0) {
      fpStatus.textContent = matchCount + ' match(es) found.';
      findCurrentIndex = 0;
      setCurrentHighlight(0);
    } else
      fpStatus.textContent = 'No matches found.';

    return matchCount;
  }

  // Mark a specific highlight span as the "current" match
  function setCurrentHighlight(index) {
    const all = editor.querySelectorAll('.wp-find-highlight');
    for (const h of all)
      h.classList.remove('wp-find-current');
    if (index >= 0 && index < all.length) {
      all[index].classList.add('wp-find-current');
      all[index].scrollIntoView({ block: 'center', behavior: 'smooth' });
      fpStatus.textContent = 'Match ' + (index + 1) + ' of ' + all.length;
    }
  }

  function findInEditor(forward) {
    const needle = fpFindInput.value;
    if (!needle) {
      clearFindHighlights();
      findCurrentIndex = -1;
      fpStatus.textContent = '';
      return;
    }

    const all = editor.querySelectorAll('.wp-find-highlight');
    if (!all.length) {
      // No highlights yet, create them
      const count = highlightAllMatches();
      if (!count)
        return;
      return;
    }

    if (forward) {
      findCurrentIndex = (findCurrentIndex + 1) % all.length;
      if (findCurrentIndex === 0)
        fpStatus.textContent = 'Wrapped to start.';
    } else {
      findCurrentIndex = (findCurrentIndex - 1 + all.length) % all.length;
      if (findCurrentIndex === all.length - 1)
        fpStatus.textContent = 'Wrapped to end.';
    }

    setCurrentHighlight(findCurrentIndex);
  }

  // Live highlighting as user types in the search field
  let findInputTimer = null;
  fpFindInput.addEventListener('input', () => {
    clearTimeout(findInputTimer);
    findInputTimer = setTimeout(() => highlightAllMatches(), 150);
  });

  // Re-highlight when options change
  fpCaseSensitive.addEventListener('change', () => highlightAllMatches());
  fpRegex.addEventListener('change', () => highlightAllMatches());
  const frWholeWord = document.getElementById('fr-whole-word');
  if (frWholeWord)
    frWholeWord.addEventListener('change', () => highlightAllMatches());

  document.getElementById('fp-find-next').addEventListener('click', () => findInEditor(true));
  document.getElementById('fp-find-prev').addEventListener('click', () => findInEditor(false));
  document.getElementById('btn-find-all').addEventListener('click', () => doFindAll());

  document.getElementById('fp-replace-one').addEventListener('click', () => {
    const all = editor.querySelectorAll('.wp-find-highlight');
    if (!all.length) {
      findInEditor(true);
      return;
    }

    if (findCurrentIndex >= 0 && findCurrentIndex < all.length) {
      const current = all[findCurrentIndex];
      const replacement = fpReplaceInput.value;
      current.replaceWith(document.createTextNode(replacement));
      editor.normalize();
      markDirty();
    }

    // Re-highlight and advance
    highlightAllMatches();
  });

  document.getElementById('fp-replace-all').addEventListener('click', () => {
    const needle = fpFindInput.value;
    const replacement = fpReplaceInput.value;
    if (!needle)
      return;

    // Clear any existing highlights first
    clearFindHighlights();

    const caseSensitive = fpCaseSensitive.checked;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = getSearchRegex(needle, flags);
    if (!regex)
      return;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    let totalReplacements = 0;
    const textNodes = [];
    while (walker.nextNode())
      textNodes.push(walker.currentNode);

    for (const node of textNodes) {
      if (!matchesFormatFilter(node))
        continue;
      const original = node.textContent;
      const matchesInNode = original.match(regex);
      if (!matchesInNode)
        continue;
      totalReplacements += matchesInNode.length;
      node.textContent = original.replace(regex, replacement);
    }

    fpStatus.textContent = totalReplacements > 0
      ? 'Replaced ' + totalReplacements + ' occurrence(s).'
      : 'No matches found.';
    findCurrentIndex = -1;
    markDirty();
    updateStatusBar();
  });

  fpFindInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findInEditor(!e.shiftKey);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      findPanel.classList.remove('visible');
      clearFindHighlights();
      findCurrentIndex = -1;
      editor.focus();
    }
  });

  fpReplaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Replace current and move to next
      document.getElementById('fp-replace-one').click();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      findPanel.classList.remove('visible');
      clearFindHighlights();
      findCurrentIndex = -1;
      editor.focus();
    }
  });

  // ── Format-Aware Search ─────────────────────────────────────
  const fpFormatAware = document.getElementById('fp-format-aware');
  const fpFormatFilters = document.getElementById('fp-format-filters');
  if (fpFormatAware && fpFormatFilters) {
    fpFormatAware.addEventListener('change', () => {
      fpFormatFilters.style.display = fpFormatAware.checked ? '' : 'none';
    });
  }

  const fpFmtColorSwatch = document.getElementById('fp-fmt-color');
  if (fpFmtColorSwatch)
    fpFmtColorSwatch.addEventListener('click', () => showColorPalette(fpFmtColorSwatch, (c) => { fpFmtColorSwatch.dataset.color = c; fpFmtColorSwatch.style.backgroundColor = c; }));

  function matchesFormatFilter(node) {
    if (!fpFormatAware || !fpFormatAware.checked) return true;
    // Walk up to the nearest element
    let el = node;
    if (el.nodeType === 3) el = el.parentElement;
    if (!el) return true;
    const cs = window.getComputedStyle(el);
    const fmtBold = document.getElementById('fp-fmt-bold');
    const fmtItalic = document.getElementById('fp-fmt-italic');
    const fmtFont = document.getElementById('fp-fmt-font');
    const fmtColorEnabled = document.getElementById('fp-fmt-color-enabled');
    const fmtColor = document.getElementById('fp-fmt-color');
    if (fmtBold && fmtBold.checked) {
      const w = parseInt(cs.fontWeight, 10);
      if (!(w >= 700 || cs.fontWeight === 'bold')) return false;
    }
    if (fmtItalic && fmtItalic.checked)
      if (cs.fontStyle !== 'italic') return false;
    if (fmtFont && fmtFont.value.trim()) {
      const wanted = fmtFont.value.trim().toLowerCase();
      const actual = cs.fontFamily.toLowerCase();
      if (!actual.includes(wanted)) return false;
    }
    if (fmtColorEnabled && fmtColorEnabled.checked && fmtColor) {
      const wanted = (fmtColor.dataset.color || '#000000').toLowerCase();
      const actual = rgbToHex(cs.color);
      if (actual && actual.toLowerCase() !== wanted) return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // File Operations
  // ═══════════════════════════════════════════════════════════════

  function getEditorContent() {
    return editor.innerHTML;
  }

  function setCurrentFile(name, path) {
    currentFileName = name;
    currentFilePath = path;
    updateTitle();
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
    currentFileFormat = 'docx';
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
    const ext = (path.match(/\.([^.]+)$/) || [])[1] || '';
    const lowerExt = ext.toLowerCase();

    if (content == null) {
      try {
        // DOCX files are ZIP archives -- read as binary to avoid UTF-8 decode corruption
        if (lowerExt === 'docx')
          content = await Kernel32.ReadAllBytes(path);
        else
          content = await Kernel32.ReadAllText(path);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'WordPad', MB_OK);
        return;
      }
    }

    if (lowerExt === 'docx') {
      // DOCX files need an ArrayBuffer for JSZip
      try {
        let arrayBuf;
        if (content instanceof ArrayBuffer)
          arrayBuf = content;
        else if (content instanceof Uint8Array)
          arrayBuf = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
        else if (typeof content === 'string') {
          // Try base64 decode
          const binary = atob(content);
          arrayBuf = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; ++i)
            arrayBuf[i] = binary.charCodeAt(i);
          arrayBuf = arrayBuf.buffer;
        } else if (ArrayBuffer.isView(content))
          arrayBuf = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
        else
          arrayBuf = content;

        const result = await DocxEngine.parseDocxDirect(arrayBuf);
        const html = typeof result === 'string' ? result : result.html;
        setEditorContent(html);
        // Import comments and track changes if available
        if (result && result.comments && result.comments.length && CommentsTracking.importComments)
          CommentsTracking.importComments(result.comments);
        if (result && result.trackChanges && result.trackChanges.length && CommentsTracking.importTrackChanges)
          CommentsTracking.importTrackChanges(result.trackChanges);
        currentFileFormat = 'docx';
      } catch (err) {
        // Fallback to mammoth.js
        try {
          let abForMammoth;
          if (content instanceof ArrayBuffer)
            abForMammoth = content;
          else if (content instanceof Uint8Array || ArrayBuffer.isView(content))
            abForMammoth = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
          else
            abForMammoth = new TextEncoder().encode(String(content)).buffer;
          const mammothResult = await mammoth.convertToHtml(
            { arrayBuffer: abForMammoth },
            { styleMap: ["p[style-name='Heading 1'] => h1", "p[style-name='Heading 2'] => h2", "p[style-name='Heading 3'] => h3"] }
          );
          setEditorContent(mammothResult.value);
          currentFileFormat = 'docx';
        } catch (err2) {
          await User32.MessageBox('Could not open DOCX: ' + err2.message, 'WordPad', MB_OK);
          return;
        }
      }
    } else if (lowerExt === 'txt') {
      const text = content != null ? String(content) : '';
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const lines = escaped.split('\n');
      const html = lines.map(line => '<p>' + (line || '<br>') + '</p>').join('');
      setEditorContent(html);
      currentFileFormat = 'txt';
    } else if (lowerExt === 'rtf') {
      const text = content != null ? String(content) : '';
      setEditorContent(RtfEngine.rtfToHtml(text));
      currentFileFormat = 'rtf';
    } else {
      const text = content != null ? String(content) : '';
      setEditorContent(text);
      currentFileFormat = 'html';
    }

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
    if (currentFileFormat === 'docx' || currentFilePath.endsWith('.docx'))
      saveAsDocx(currentFilePath, callback);
    else
      saveToPath(currentFilePath, callback);
  }

  async function doSaveAs(callback) {
    const defaultExt = currentFileFormat === 'docx' ? '.docx' : '.html';
    const baseName = currentFileName.replace(/\.[^.]+$/, '') || 'Untitled';
    const result = await ComDlg32.GetSaveFileName({
      filters: FILE_FILTERS,
      initialDir: '/user/documents',
      defaultName: baseName + defaultExt,
      title: 'Save As',
    });
    if (result.cancelled || !result.path)
      return;

    currentFilePath = result.path;
    const parts = result.path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    const ext = (result.path.match(/\.([^.]+)$/) || [])[1] || '';

    if (ext.toLowerCase() === 'docx') {
      currentFileFormat = 'docx';
      await saveAsDocx(result.path, callback);
    } else {
      currentFileFormat = ext.toLowerCase() === 'rtf' ? 'rtf' : ext.toLowerCase() === 'txt' ? 'txt' : 'html';
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

  async function saveAsDocx(path, callback) {
    try {
      const html = getEditorContent();
      const zip = DocxEngine.buildDocxPackage(html);
      const bytes = await zip.generateAsync({ type: 'uint8array' });
      await Kernel32.WriteFile(path, bytes);
    } catch (err) {
      await User32.MessageBox('Could not save DOCX: ' + err.message, 'WordPad', MB_OK);
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

  // parseDocxDirect -- delegated to DocxEngine module

  // buildDocxPackage / doExportDocx -- delegated to DocxEngine module

  // ═══════════════════════════════════════════════════════════════
  // RTF -- delegated to RtfEngine module
  // ═══════════════════════════════════════════════════════════════

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
  // Multi-Page Layout (print layout)
  // ═══════════════════════════════════════════════════════════════

  const PAGE_GAP_HEIGHT = 28; // px, visual gap between pages
  let _pageLayoutTimer = null;
  let _lastPageCount = 1;

  function getPageHeightPx() {
    const pageSizeVal = document.getElementById('rb-page-size').value;
    const orientVal = document.getElementById('rb-page-orient').value;
    const pageSizes = {
      a4: { w: 210, h: 297 },
      letter: { w: 8.5 * 25.4, h: 11 * 25.4 },
      legal: { w: 8.5 * 25.4, h: 14 * 25.4 },
      custom: { w: 8.5 * 25.4, h: 11 * 25.4 }
    };
    const size = pageSizes[pageSizeVal] || pageSizes.letter;
    return (orientVal === 'landscape' ? size.w : size.h) * 96 / 25.4;
  }

  function updatePageBreakIndicators() {
    // Remove existing gap overlays
    for (const gap of editor.querySelectorAll('.wp-page-gap-overlay'))
      gap.remove();
    // Remove old-style indicators too
    for (const ind of editor.querySelectorAll('.wp-page-indicator'))
      ind.remove();

    // Only show in print layout mode
    if (!editorWrapper.classList.contains('print-layout')) {
      editor.style.backgroundImage = '';
      editor.style.paddingBottom = '';
      return;
    }

    const pageHeightPx = getPageHeightPx();
    if (pageHeightPx <= 0)
      return;

    // Set editor min-height to one page
    editor.style.minHeight = pageHeightPx + 'px';

    // Get content height (exclude gap overlays which we just removed)
    const contentHeight = editor.scrollHeight;
    const pageCount = Math.max(1, Math.ceil(contentHeight / pageHeightPx));
    _lastPageCount = pageCount;

    if (pageCount <= 1) {
      editor.style.paddingBottom = '';
      return;
    }

    // Add extra padding at the bottom so the last page extends to full page height
    const remainder = contentHeight % pageHeightPx;
    if (remainder > 0) {
      const extraPadding = pageHeightPx - remainder + (pageCount - 1) * PAGE_GAP_HEIGHT;
      editor.style.paddingBottom = extraPadding + 'px';
    } else {
      editor.style.paddingBottom = ((pageCount - 1) * PAGE_GAP_HEIGHT) + 'px';
    }

    // Insert visual page gap overlays at each page boundary
    for (let p = 1; p < pageCount; ++p) {
      const gapTop = pageHeightPx * p + PAGE_GAP_HEIGHT * (p - 1);
      const gap = document.createElement('div');
      gap.className = 'wp-page-gap-overlay';
      gap.style.top = gapTop + 'px';
      gap.dataset.pageLabel = 'Page ' + p + ' | Page ' + (p + 1);
      gap.contentEditable = 'false';
      editor.appendChild(gap);
    }
  }

  function getPageCount() {
    return _lastPageCount;
  }

  // Recalculate page layout on resize
  window.addEventListener('resize', () => {
    clearTimeout(_pageLayoutTimer);
    _pageLayoutTimer = setTimeout(updatePageBreakIndicators, 200);
  });

  // Also recalculate when editor content changes
  const _pageLayoutObserver = new MutationObserver((mutations) => {
    // Ignore mutations caused by our own gap overlays
    const isOwnMutation = mutations.every(m =>
      m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].every(
        n => n.nodeType === 1 && (n.classList.contains('wp-page-gap-overlay') || n.classList.contains('wp-page-indicator'))
      )
    );
    if (isOwnMutation)
      return;

    clearTimeout(_pageLayoutTimer);
    _pageLayoutTimer = setTimeout(updatePageBreakIndicators, 300);
  });

  // ═══════════════════════════════════════════════════════════════
  // Status Bar
  // ═══════════════════════════════════════════════════════════════

  const statusWords = document.getElementById('status-words');
  const statusChars = document.getElementById('status-chars');
  const statusLines = document.getElementById('status-lines');

  function updateStatusBar() {
    const text = editor.innerText || '';
    const trimmed = text.trim();
    const charsWithSpaces = text.replace(/\n/g, '').length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
    const lineCount = text === '' ? 0 : text.split('\n').length;

    // Use the multi-page layout page count
    const pageCount = getPageCount();

    statusWords.textContent = wordCount + ' words';
    statusChars.textContent = charsNoSpaces + ' chars (no spaces) | ' + charsWithSpaces + ' chars';
    statusLines.textContent = 'Ln ' + lineCount + ' | Pg ' + pageCount;

    updatePageBreakIndicators();
  }

  function updateStatusBarSelection() {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
      // No selection -- show total word count
      const text = editor.innerText || '';
      const trimmed = text.trim();
      const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
      statusWords.textContent = wordCount + ' words';
      return;
    }

    const selectedText = sel.toString();
    const selTrimmed = selectedText.trim();
    const selWordCount = selTrimmed === '' ? 0 : selTrimmed.split(/\s+/).length;
    const totalText = (editor.innerText || '').trim();
    const totalWordCount = totalText === '' ? 0 : totalText.split(/\s+/).length;
    statusWords.textContent = selWordCount + ' of ' + totalWordCount + ' words selected';
  }

  // ═══════════════════════════════════════════════════════════════
  // W1 — Word Art
  // ═══════════════════════════════════════════════════════════════

  const WORDART_STYLES = [
    { id: 1, name: 'Blue Gradient', className: 'wordart-style-1', preview: 'Abc' },
    { id: 2, name: 'Gold Outline', className: 'wordart-style-2', preview: 'Abc' },
    { id: 3, name: 'Neon Glow', className: 'wordart-style-3', preview: 'Abc', bgDark: true },
    { id: 4, name: '3D Extrusion', className: 'wordart-style-4', preview: 'Abc' },
    { id: 5, name: 'Rainbow', className: 'wordart-style-5', preview: 'Abc' },
    { id: 6, name: 'Silver Emboss', className: 'wordart-style-6', preview: 'Abc' },
    { id: 7, name: 'Fire', className: 'wordart-style-7', preview: 'Abc' },
    { id: 8, name: 'Ice', className: 'wordart-style-8', preview: 'Abc' },
  ];

  let selectedWordArtStyle = 1;

  function buildWordArtPreview(text, styleId, sizePt, color) {
    const style = WORDART_STYLES.find(s => s.id === styleId) || WORDART_STYLES[0];
    const div = document.createElement('div');
    div.className = 'wp-wordart ' + style.className;
    div.style.fontSize = sizePt + 'pt';
    if (color && styleId === 2)
      div.style.color = color;
    div.textContent = text || 'Word Art';
    return div;
  }

  function showWordArtDialog() {
    const gallery = document.getElementById('wa-style-gallery');
    const preview = document.getElementById('wa-preview');
    const textInput = document.getElementById('wa-text');
    const sizeInput = document.getElementById('wa-size');
    const colorSwatch = document.getElementById('wa-color');

    gallery.innerHTML = '';
    for (const style of WORDART_STYLES) {
      const tile = document.createElement('div');
      tile.className = 'wa-style-tile ' + style.className + (style.id === selectedWordArtStyle ? ' active' : '');
      if (style.bgDark)
        tile.style.background = '#222';
      tile.textContent = style.preview;
      tile.title = style.name;
      tile.addEventListener('click', () => {
        selectedWordArtStyle = style.id;
        for (const t of gallery.querySelectorAll('.wa-style-tile'))
          t.classList.remove('active');
        tile.classList.add('active');
        refreshWordArtPreview();
      });
      gallery.appendChild(tile);
    }

    function refreshWordArtPreview() {
      preview.innerHTML = '';
      const el = buildWordArtPreview(textInput.value, selectedWordArtStyle, parseInt(sizeInput.value, 10) || 36, colorSwatch.dataset.color);
      preview.appendChild(el);
    }

    textInput.value = 'Word Art';
    sizeInput.value = 36;
    colorSwatch.dataset.color = '#0066cc';
    colorSwatch.style.backgroundColor = '#0066cc';
    refreshWordArtPreview();

    colorSwatch.onclick = () => showColorPalette(colorSwatch, (c) => { colorSwatch.dataset.color = c; colorSwatch.style.backgroundColor = c; refreshWordArtPreview(); });

    textInput.addEventListener('input', refreshWordArtPreview);
    sizeInput.addEventListener('input', refreshWordArtPreview);

    const overlay = document.getElementById('dlg-wordart');
    awaitDialogResult(overlay, (result) => {
      textInput.removeEventListener('input', refreshWordArtPreview);
      sizeInput.removeEventListener('input', refreshWordArtPreview);
      colorSwatch.onclick = null;
      if (result !== 'ok')
        return;
      insertWordArt(textInput.value, selectedWordArtStyle, parseInt(sizeInput.value, 10) || 36, colorSwatch.dataset.color);
    });
  }

  function insertWordArt(text, styleId, sizePt, color) {
    if (!text.trim())
      return;
    const el = buildWordArtPreview(text, styleId, sizePt, color);
    el.contentEditable = 'false';
    const html = el.outerHTML + '<p><br></p>';
    editor.focus();
    document.execCommand('insertHTML', false, html);
    markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // W2 — Quick Tables
  // ═══════════════════════════════════════════════════════════════

  const QUICK_TABLE_TEMPLATES = [
    {
      id: 'calendar',
      name: 'Calendar Grid',
      build() {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr>' + days.map(d => '<th style="padding:4px 8px;border:1px solid #999;background:#4472c4;color:#fff;font-weight:bold;text-align:center;">' + d + '</th>').join('') + '</tr>';
        for (let r = 0; r < 5; ++r)
          html += '<tr>' + days.map(() => '<td style="padding:4px 8px;border:1px solid #999;height:40px;vertical-align:top;"><br></td>').join('') + '</tr>';
        html += '</table>';
        return html;
      }
    },
    {
      id: 'matrix',
      name: 'Matrix (Labeled)',
      build() {
        const size = 4;
        let html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr><th style="padding:4px 8px;border:1px solid #999;background:#4472c4;color:#fff;"></th>';
        for (let c = 1; c <= size; ++c)
          html += '<th style="padding:4px 8px;border:1px solid #999;background:#4472c4;color:#fff;text-align:center;">Col ' + c + '</th>';
        html += '</tr>';
        for (let r = 1; r <= size; ++r) {
          html += '<tr><th style="padding:4px 8px;border:1px solid #999;background:#d6e4f0;font-weight:bold;">Row ' + r + '</th>';
          for (let c = 1; c <= size; ++c)
            html += '<td style="padding:4px 8px;border:1px solid #999;text-align:center;"><br></td>';
          html += '</tr>';
        }
        html += '</table>';
        return html;
      }
    },
    {
      id: 'tabular-list',
      name: 'Tabular List',
      build() {
        const headers = ['Item', 'Description', 'Status', 'Notes'];
        let html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr>' + headers.map(h => '<th style="padding:6px 10px;border:1px solid #999;background:#4472c4;color:#fff;font-weight:bold;">' + h + '</th>').join('') + '</tr>';
        for (let r = 0; r < 5; ++r) {
          const bg = r % 2 === 0 ? '' : ' background:#f5f5f5;';
          html += '<tr>' + headers.map(() => '<td style="padding:4px 8px;border:1px solid #999;' + bg + '"><br></td>').join('') + '</tr>';
        }
        html += '</table>';
        return html;
      }
    },
    {
      id: 'double-table',
      name: 'Double Table',
      build() {
        function miniTable(title) {
          let h = '<div style="display:inline-block;vertical-align:top;width:48%;margin-right:2%;">';
          h += '<p style="font-weight:bold;margin-bottom:4px;">' + title + '</p>';
          h += '<table style="width:100%;border-collapse:collapse;">';
          h += '<tr><th style="padding:4px 6px;border:1px solid #999;background:#4472c4;color:#fff;">A</th><th style="padding:4px 6px;border:1px solid #999;background:#4472c4;color:#fff;">B</th></tr>';
          for (let r = 0; r < 3; ++r)
            h += '<tr><td style="padding:4px 6px;border:1px solid #999;"><br></td><td style="padding:4px 6px;border:1px solid #999;"><br></td></tr>';
          h += '</table></div>';
          return h;
        }
        return miniTable('Table 1') + miniTable('Table 2');
      }
    },
    {
      id: 'subheadings',
      name: 'With Subheadings',
      build() {
        let html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr><th colspan="3" style="padding:6px 10px;border:1px solid #999;background:#4472c4;color:#fff;font-weight:bold;text-align:center;">Section Title</th></tr>';
        html += '<tr><td colspan="3" style="padding:4px 8px;border:1px solid #999;background:#d6e4f0;font-weight:bold;">Category A</td></tr>';
        for (let r = 0; r < 2; ++r)
          html += '<tr><td style="padding:4px 8px;border:1px solid #999;"><br></td><td style="padding:4px 8px;border:1px solid #999;"><br></td><td style="padding:4px 8px;border:1px solid #999;"><br></td></tr>';
        html += '<tr><td colspan="3" style="padding:4px 8px;border:1px solid #999;background:#d6e4f0;font-weight:bold;">Category B</td></tr>';
        for (let r = 0; r < 2; ++r)
          html += '<tr><td style="padding:4px 8px;border:1px solid #999;"><br></td><td style="padding:4px 8px;border:1px solid #999;"><br></td><td style="padding:4px 8px;border:1px solid #999;"><br></td></tr>';
        html += '</table>';
        return html;
      }
    }
  ];

  function showQuickTableDialog() {
    const gallery = document.getElementById('qt-gallery');
    gallery.innerHTML = '';

    for (const tpl of QUICK_TABLE_TEMPLATES) {
      const tile = document.createElement('div');
      tile.className = 'qt-tile';

      const name = document.createElement('div');
      name.className = 'qt-tile-name';
      name.textContent = tpl.name;
      tile.appendChild(name);

      const previewDiv = document.createElement('div');
      previewDiv.className = 'qt-tile-preview';
      previewDiv.innerHTML = tpl.build();
      tile.appendChild(previewDiv);

      tile.addEventListener('click', () => {
        const dlgOverlay = document.getElementById('dlg-quick-table');
        if (dlgOverlay._dialogDone)
          dlgOverlay._dialogDone(null);
        else
          dlgOverlay.classList.remove('visible');
        insertQuickTable(tpl.id);
      });

      gallery.appendChild(tile);
    }

    SZ.Dialog.show('dlg-quick-table');
  }

  function insertQuickTable(templateId) {
    const tpl = QUICK_TABLE_TEMPLATES.find(t => t.id === templateId);
    if (!tpl)
      return;
    editor.focus();
    document.execCommand('insertHTML', false, tpl.build() + '<p><br></p>');
    markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // W3 — Document Inspector
  // ═══════════════════════════════════════════════════════════════

  function showDocumentInspector() {
    const text = editor.innerText || '';
    const trimmed = text.trim();

    const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
    const charCount = text.length;
    const charNoSpaces = text.replace(/\s/g, '').length;

    const blocks = editor.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div:not(.watermark):not(.wp-watermark-image):not(.wp-page-break):not(.wp-section-break):not(.wp-page-gap-overlay), blockquote, pre, li');
    const paragraphCount = Math.max(1, blocks.length);

    const images = editor.querySelectorAll('img');
    const imageCount = images.length;
    let estimatedImageSize = 0;
    for (const img of images) {
      const src = img.src || '';
      if (src.startsWith('data:')) {
        const base64 = src.split(',')[1] || '';
        estimatedImageSize += Math.round(base64.length * 0.75);
      } else {
        estimatedImageSize += (img.naturalWidth || 100) * (img.naturalHeight || 100) * 3;
      }
    }

    const tableCount = editor.querySelectorAll('table').length;

    const h1Count = editor.querySelectorAll('h1').length;
    const h2Count = editor.querySelectorAll('h2').length;
    const h3Count = editor.querySelectorAll('h3').length;

    const linkCount = editor.querySelectorAll('a[href]').length;

    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    function formatSize(bytes) {
      if (bytes < 1024)
        return bytes + ' B';
      if (bytes < 1048576)
        return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    }

    const stats = [
      { label: 'Words', value: wordCount.toLocaleString() },
      { label: 'Characters', value: charCount.toLocaleString() },
      { label: 'Characters (no spaces)', value: charNoSpaces.toLocaleString() },
      { label: 'Paragraphs', value: paragraphCount.toLocaleString() },
      { label: 'Images', value: imageCount.toLocaleString() },
      { label: 'Est. Image Size', value: formatSize(estimatedImageSize) },
      { label: 'Tables', value: tableCount.toLocaleString() },
      { label: 'Headings (H1)', value: h1Count.toLocaleString() },
      { label: 'Headings (H2)', value: h2Count.toLocaleString() },
      { label: 'Headings (H3)', value: h3Count.toLocaleString() },
      { label: 'Links', value: linkCount.toLocaleString() },
      { label: 'Est. Reading Time', value: readingTime + ' min' },
    ];

    const container = document.getElementById('di-stats');
    container.innerHTML = '';
    for (const s of stats) {
      const row = document.createElement('div');
      row.className = 'di-stat';
      row.innerHTML = '<span class="di-stat-label">' + s.label + '</span><span class="di-stat-value">' + s.value + '</span>';
      container.appendChild(row);
    }

    SZ.Dialog.show('dlg-document-inspector');
  }

  // ═══════════════════════════════════════════════════════════════
  // W4 — Reading Mode
  // ═══════════════════════════════════════════════════════════════

  const readingModeExitBtn = document.getElementById('reading-mode-exit');

  function toggleReadingMode() {
    readingMode = !readingMode;
    document.body.classList.toggle('reading-mode', readingMode);
    readingModeExitBtn.style.display = readingMode ? '' : 'none';

    if (readingMode)
      editor.setAttribute('contenteditable', 'false');
    else
      editor.setAttribute('contenteditable', 'true');
  }

  readingModeExitBtn.addEventListener('click', () => {
    if (readingMode)
      toggleReadingMode();
  });

  // ═══════════════════════════════════════════════════════════════
  // W5 — Form Fields
  // ═══════════════════════════════════════════════════════════════

  const FORM_FIELD_TYPES = {
    text: {
      label: 'Text Field',
      build() {
        return '<span class="wp-form-field wp-text-field" contenteditable="false">'
          + '<input type="text" placeholder="Enter text..." onclick="this.focus()">'
          + '</span>';
      }
    },
    checkbox: {
      label: 'Checkbox',
      build() {
        return '<span class="wp-form-field wp-checkbox-field" contenteditable="false">'
          + '<input type="checkbox"><span class="wp-checkbox-label">Check</span>'
          + '</span>';
      }
    },
    dropdown: {
      label: 'Dropdown',
      build() {
        return '<span class="wp-form-field wp-dropdown-field" contenteditable="false">'
          + '<select>'
          + '<option value="">-- Select --</option>'
          + '<option value="option1">Option 1</option>'
          + '<option value="option2">Option 2</option>'
          + '<option value="option3">Option 3</option>'
          + '</select>'
          + '</span>';
      }
    }
  };

  function insertFormField(type) {
    const fieldDef = FORM_FIELD_TYPES[type];
    if (!fieldDef)
      return;
    editor.focus();
    document.execCommand('insertHTML', false, fieldDef.build() + '&nbsp;');
    markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // Keyboard Shortcuts
  // ═══════════════════════════════════════════════════════════════

  document.addEventListener('keydown', (e) => {
    // F7 for spell check (no modifier needed)
    if (e.key === 'F7') {
      e.preventDefault();
      handleAction('spell-check');
      return;
    }

    // F11 for reading mode (no modifier needed)
    if (e.key === 'F11') {
      e.preventDefault();
      handleAction('reading-mode');
      return;
    }

    // Escape exits reading mode
    if (e.key === 'Escape' && readingMode) {
      e.preventDefault();
      toggleReadingMode();
      return;
    }

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

  // Comments & Track Changes -- delegated to CommentsTracking module

  // TOC, Footnotes, Multi-Level Lists, Columns -- delegated to TocFootnotes module

  // ═══════════════════════════════════════════════════════════════
  // Paragraph Flow Controls (Sprint 4)
  // ═══════════════════════════════════════════════════════════════

  function doToggleParagraphFlow(attr, cssProp, cssValue) {
    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;
    let container = sel.focusNode;
    if (container.nodeType === 3) container = container.parentElement;
    const block = container.closest('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
    if (!block)
      return;

    const hasAttr = block.hasAttribute('data-' + attr);
    if (hasAttr) {
      block.removeAttribute('data-' + attr);
      block.style[cssProp] = '';
    } else {
      block.setAttribute('data-' + attr, 'true');
      block.style[cssProp] = cssValue;
    }
    markDirty();
    editor.focus();
  }

  function doToggleWidowOrphan() {
    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;
    let container = sel.focusNode;
    if (container.nodeType === 3) container = container.parentElement;
    const block = container.closest('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
    if (!block)
      return;

    const hasAttr = block.hasAttribute('data-widow-orphan');
    if (hasAttr) {
      block.removeAttribute('data-widow-orphan');
      block.style.orphans = '';
      block.style.widows = '';
    } else {
      block.setAttribute('data-widow-orphan', 'true');
      block.style.orphans = '2';
      block.style.widows = '2';
    }
    markDirty();
    editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // MS Word-Style Ruler with Snap Points (Sprint 4 rewrite)
  // ═══════════════════════════════════════════════════════════════

  const TAB_TYPES = ['left', 'center', 'right', 'decimal'];
  let currentTabTypeIndex = 0;
  const DPI = 96; // CSS pixels per inch

  // Ruler state
  let rulerMargins = { left: 1, right: 1 }; // inches
  let rulerIndents = { first: 0, left: 0, right: 0 }; // inches from margin

  function getPageWidthInches() {
    const pageSizeVal = document.getElementById('rb-page-size').value;
    const orientVal = document.getElementById('rb-page-orient').value;
    const sizes = {
      a4: { w: 210 / 25.4, h: 297 / 25.4 },
      letter: { w: 8.5, h: 11 },
      legal: { w: 8.5, h: 14 },
      custom: { w: 8.5, h: 11 }
    };
    const size = sizes[pageSizeVal] || sizes.letter;
    return orientVal === 'landscape' ? size.h : size.w;
  }

  function getMarginInches(side) {
    const val = document.getElementById('rb-page-margins').value;
    if (val === 'custom') {
      if (side === 'top') return customMargins.top;
      if (side === 'bottom') return customMargins.bottom;
      if (side === 'right') return customMargins.right;
      return customMargins.left + customMargins.gutter; // default: left (includes gutter)
    }
    const margins = { normal: 1, narrow: 0.5, wide: 1.25 };
    return margins[val] || 1;
  }

  function initTabStopRuler() {
    const rulerEl = document.getElementById('ruler');
    const rulerInner = document.getElementById('ruler-inner');
    const tabSelector = document.getElementById('ruler-tab-selector');
    const verticalRuler = document.getElementById('ruler-vertical');
    if (!rulerEl || !rulerInner)
      return;

    // Tab type selector: click to cycle through tab types
    if (tabSelector) {
      tabSelector.addEventListener('click', () => {
        currentTabTypeIndex = (currentTabTypeIndex + 1) % TAB_TYPES.length;
        const labels = { left: 'L', center: 'C', right: 'R', decimal: 'D' };
        tabSelector.textContent = labels[TAB_TYPES[currentTabTypeIndex]];
        tabSelector.title = TAB_TYPES[currentTabTypeIndex].charAt(0).toUpperCase()
          + TAB_TYPES[currentTabTypeIndex].slice(1) + ' Tab Stop';
      });
    }

    // Initial ruler render
    renderRuler();

    // Click on ruler to add tab stop
    rulerInner.addEventListener('click', (e) => {
      if (e.target.classList.contains('wp-tab-marker') ||
          e.target.classList.contains('ruler-handle'))
        return;

      const rulerRect = rulerInner.getBoundingClientRect();
      const clickX = e.clientX - rulerRect.left;
      const pageW = getPageWidthInches();
      const inchPos = (clickX / rulerRect.width) * pageW;

      // Only allow tab stops in the content area (between margins)
      const margin = getMarginInches();
      if (inchPos < margin || inchPos > pageW - margin)
        return;

      const sel = window.getSelection();
      if (!sel.rangeCount)
        return;
      let container = sel.focusNode;
      if (container && container.nodeType === 3) container = container.parentElement;
      const block = container ? container.closest('p, div, h1, h2, h3, h4, h5, h6, li') : null;
      if (!block)
        return;

      let tabStops = [];
      try {
        const raw = block.getAttribute('data-tab-stops');
        if (raw) tabStops = JSON.parse(raw);
      } catch (ex) { /* ignore */ }

      // Convert inch position to percentage of content width
      const contentW = pageW - margin * 2;
      const pctPos = Math.round(((inchPos - margin) / contentW) * 1000) / 10;

      const tabType = TAB_TYPES[currentTabTypeIndex];
      tabStops.push({ position: pctPos, type: tabType });
      tabStops.sort((a, b) => a.position - b.position);

      block.setAttribute('data-tab-stops', JSON.stringify(tabStops));
      renderTabMarkers(rulerInner, tabStops);
      markDirty();
    });

    // Update tab markers and indent handles when selection changes
    editor.addEventListener('click', () => {
      updateTabMarkersForSelection(rulerInner);
      updateIndentHandlesForSelection();
    });
    editor.addEventListener('keyup', () => {
      updateTabMarkersForSelection(rulerInner);
      updateIndentHandlesForSelection();
    });

  }

  function renderRuler() {
    const rulerInner = document.getElementById('ruler-inner');
    if (!rulerInner)
      return;

    // Clear previous content
    rulerInner.innerHTML = '';

    const pageW = getPageWidthInches();
    const totalInches = pageW;

    // Draw margin regions (gray areas)
    const leftMarginPct = (rulerMargins.left / totalInches) * 100;
    const rightMarginPct = (rulerMargins.right / totalInches) * 100;

    const leftMargin = document.createElement('div');
    leftMargin.className = 'ruler-margin-left';
    leftMargin.style.width = leftMarginPct + '%';
    rulerInner.appendChild(leftMargin);

    const rightMargin = document.createElement('div');
    rightMargin.className = 'ruler-margin-right';
    rightMargin.style.width = rightMarginPct + '%';
    rulerInner.appendChild(rightMargin);

    // White content track
    const track = document.createElement('div');
    track.className = 'ruler-track';
    track.style.left = leftMarginPct + '%';
    track.style.right = rightMarginPct + '%';
    rulerInner.appendChild(track);

    // Draw tick marks and labels
    // Eighth-inch ticks
    const eighthInch = 1 / 8;
    for (let i = 0; i <= totalInches / eighthInch; ++i) {
      const inches = i * eighthInch;
      if (inches > totalInches)
        break;

      const pct = (inches / totalInches) * 100;
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      tick.style.left = pct + '%';

      if (i % 8 === 0) {
        // Full inch
        tick.classList.add('ruler-tick-major');
        // Add number label (skip 0)
        if (inches > 0 && inches < totalInches) {
          const label = document.createElement('div');
          label.className = 'ruler-label';
          label.style.left = pct + '%';
          label.textContent = Math.round(inches);
          rulerInner.appendChild(label);
        }
      } else if (i % 4 === 0) {
        // Half inch
        tick.classList.add('ruler-tick-half');
      } else if (i % 2 === 0) {
        // Quarter inch
        tick.classList.add('ruler-tick-quarter');
      } else {
        // Eighth inch
        tick.classList.add('ruler-tick-eighth');
      }

      rulerInner.appendChild(tick);
    }

    // Add margin drag handles
    addMarginHandle(rulerInner, 'left');
    addMarginHandle(rulerInner, 'right');

    // Add indent handles
    addIndentHandles(rulerInner);

    // Re-add tab markers for current selection
    updateTabMarkersForSelection(rulerInner);

    // Render vertical ruler too
    renderVerticalRuler();
  }

  function addMarginHandle(rulerInner, side) {
    const handle = document.createElement('div');
    handle.className = 'ruler-handle ruler-handle-margin-' + side;
    const pageW = getPageWidthInches();
    const margin = side === 'left' ? rulerMargins.left : rulerMargins.right;
    const pct = (margin / pageW) * 100;

    if (side === 'left')
      handle.style.left = (pct - 0.3) + '%';
    else
      handle.style.right = (pct - 0.3) + '%';

    handle.title = (side === 'left' ? 'Left' : 'Right') + ' Margin: ' + margin.toFixed(2) + '"';

    // Drag to resize margin
    let dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
      if (!dragging)
        return;
      const rulerRect = rulerInner.getBoundingClientRect();
      const x = e.clientX - rulerRect.left;
      const newMarginInches = Math.round((x / rulerRect.width) * pageW * 8) / 8; // snap to 1/8 inch

      if (side === 'left') {
        rulerMargins.left = Math.max(0, Math.min(pageW / 2, newMarginInches));
        const newPct = (rulerMargins.left / pageW) * 100;
        handle.style.left = (newPct - 0.3) + '%';
        handle.title = 'Left Margin: ' + rulerMargins.left.toFixed(2) + '"';
      } else {
        const fromRight = pageW - ((x / rulerRect.width) * pageW);
        rulerMargins.right = Math.round(Math.max(0, Math.min(pageW / 2, fromRight)) * 8) / 8;
        const newPct = (rulerMargins.right / pageW) * 100;
        handle.style.right = (newPct - 0.3) + '%';
        handle.title = 'Right Margin: ' + rulerMargins.right.toFixed(2) + '"';
      }
    });

    handle.addEventListener('pointerup', (e) => {
      if (!dragging)
        return;
      dragging = false;
      handle.releasePointerCapture(e.pointerId);
      applyMarginsFromRuler();
      renderRuler();
    });

    rulerInner.appendChild(handle);
  }

  function applyMarginsFromRuler() {
    const left = rulerMargins.left;
    const right = rulerMargins.right;
    editor.style.paddingLeft = left + 'in';
    editor.style.paddingRight = right + 'in';
  }

  function addIndentHandles(rulerInner) {
    const pageW = getPageWidthInches();
    const margin = rulerMargins.left;

    // First-line indent handle (top triangle)
    const firstIndent = document.createElement('div');
    firstIndent.className = 'ruler-handle ruler-handle-indent ruler-handle-first-indent';
    firstIndent.id = 'ruler-first-indent';
    const firstPct = ((margin + rulerIndents.first) / pageW) * 100;
    firstIndent.style.left = 'calc(' + firstPct + '% - 5px)';
    firstIndent.title = 'First Line Indent: ' + rulerIndents.first.toFixed(2) + '"';
    setupIndentDrag(firstIndent, 'first', rulerInner);
    rulerInner.appendChild(firstIndent);

    // Hanging indent handle (bottom triangle on left)
    const hangingIndent = document.createElement('div');
    hangingIndent.className = 'ruler-handle ruler-handle-indent ruler-handle-hanging-indent';
    hangingIndent.id = 'ruler-hanging-indent';
    const hangPct = ((margin + rulerIndents.left) / pageW) * 100;
    hangingIndent.style.left = 'calc(' + hangPct + '% - 5px)';
    hangingIndent.title = 'Hanging Indent: ' + rulerIndents.left.toFixed(2) + '"';
    setupIndentDrag(hangingIndent, 'left', rulerInner);
    rulerInner.appendChild(hangingIndent);

    // Left indent handle (rectangle below hanging)
    const leftIndent = document.createElement('div');
    leftIndent.className = 'ruler-handle ruler-handle-indent ruler-handle-left-indent';
    leftIndent.id = 'ruler-left-indent';
    leftIndent.style.left = 'calc(' + hangPct + '% - 5px)';
    leftIndent.title = 'Left Indent (moves both): ' + rulerIndents.left.toFixed(2) + '"';
    setupIndentDrag(leftIndent, 'leftBoth', rulerInner);
    rulerInner.appendChild(leftIndent);

    // Right indent handle (bottom triangle on right)
    const rightIndent = document.createElement('div');
    rightIndent.className = 'ruler-handle ruler-handle-indent ruler-handle-right-indent';
    rightIndent.id = 'ruler-right-indent';
    const rightPct = ((pageW - rulerMargins.right - rulerIndents.right) / pageW) * 100;
    rightIndent.style.left = 'calc(' + rightPct + '% - 5px)';
    rightIndent.title = 'Right Indent: ' + rulerIndents.right.toFixed(2) + '"';
    setupIndentDrag(rightIndent, 'right', rulerInner);
    rulerInner.appendChild(rightIndent);
  }

  function setupIndentDrag(handle, type, rulerInner) {
    let dragging = false;

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
      if (!dragging)
        return;
      const pageW = getPageWidthInches();
      const margin = rulerMargins.left;
      const rulerRect = rulerInner.getBoundingClientRect();
      const x = e.clientX - rulerRect.left;
      const inchPos = (x / rulerRect.width) * pageW;
      // Snap to 1/8 inch
      const snapped = Math.round(inchPos * 8) / 8;

      if (type === 'first') {
        rulerIndents.first = Math.max(-margin, Math.min(pageW - margin - rulerMargins.right, snapped - margin));
        const pct = ((margin + rulerIndents.first) / pageW) * 100;
        handle.style.left = 'calc(' + pct + '% - 5px)';
        handle.title = 'First Line Indent: ' + rulerIndents.first.toFixed(2) + '"';
      } else if (type === 'left') {
        rulerIndents.left = Math.max(0, Math.min(pageW - margin - rulerMargins.right, snapped - margin));
        const pct = ((margin + rulerIndents.left) / pageW) * 100;
        handle.style.left = 'calc(' + pct + '% - 5px)';
        // Also move the left indent rectangle
        const leftIndent = document.getElementById('ruler-left-indent');
        if (leftIndent)
          leftIndent.style.left = 'calc(' + pct + '% - 5px)';
        handle.title = 'Hanging Indent: ' + rulerIndents.left.toFixed(2) + '"';
      } else if (type === 'leftBoth') {
        // Move both first-line and hanging together
        const oldLeft = rulerIndents.left;
        const diff = rulerIndents.first - oldLeft;
        rulerIndents.left = Math.max(0, Math.min(pageW - margin - rulerMargins.right, snapped - margin));
        rulerIndents.first = rulerIndents.left + diff;
        const pct = ((margin + rulerIndents.left) / pageW) * 100;
        handle.style.left = 'calc(' + pct + '% - 5px)';
        // Move hanging indent handle
        const hangHandle = document.getElementById('ruler-hanging-indent');
        if (hangHandle)
          hangHandle.style.left = 'calc(' + pct + '% - 5px)';
        // Move first-line indent handle
        const firstHandle = document.getElementById('ruler-first-indent');
        if (firstHandle) {
          const firstPct = ((margin + rulerIndents.first) / pageW) * 100;
          firstHandle.style.left = 'calc(' + firstPct + '% - 5px)';
        }
        handle.title = 'Left Indent (both): ' + rulerIndents.left.toFixed(2) + '"';
      } else if (type === 'right') {
        const fromRight = pageW - snapped;
        rulerIndents.right = Math.max(0, Math.min(pageW - margin - rulerMargins.right, fromRight - rulerMargins.right));
        const rightPct = ((pageW - rulerMargins.right - rulerIndents.right) / pageW) * 100;
        handle.style.left = 'calc(' + rightPct + '% - 5px)';
        handle.title = 'Right Indent: ' + rulerIndents.right.toFixed(2) + '"';
      }
    });

    handle.addEventListener('pointerup', (e) => {
      if (!dragging)
        return;
      dragging = false;
      handle.releasePointerCapture(e.pointerId);
      applyIndentsToSelection();
    });
  }

  function applyIndentsToSelection() {
    const block = getSelectedBlock();
    if (!block)
      return;
    block.style.marginLeft = rulerIndents.left > 0 ? rulerIndents.left + 'in' : '';
    block.style.marginRight = rulerIndents.right > 0 ? rulerIndents.right + 'in' : '';
    block.style.textIndent = rulerIndents.first !== 0 ? rulerIndents.first + 'in' : '';
    markDirty();
  }

  function updateIndentHandlesForSelection() {
    const block = getSelectedBlock();
    if (!block) return;

    const cs = window.getComputedStyle(block);
    const marginLeft = parseFloat(cs.marginLeft) || 0;
    const marginRight = parseFloat(cs.marginRight) || 0;
    const textIndent = parseFloat(cs.textIndent) || 0;

    // Convert px to inches
    rulerIndents.left = marginLeft / DPI;
    rulerIndents.right = marginRight / DPI;
    rulerIndents.first = textIndent / DPI;

    // Update handle positions
    const pageW = getPageWidthInches();
    const margin = rulerMargins.left;

    const firstHandle = document.getElementById('ruler-first-indent');
    const hangHandle = document.getElementById('ruler-hanging-indent');
    const leftHandle = document.getElementById('ruler-left-indent');
    const rightHandle = document.getElementById('ruler-right-indent');

    if (firstHandle) {
      const pct = ((margin + rulerIndents.first + rulerIndents.left) / pageW) * 100;
      firstHandle.style.left = 'calc(' + pct + '% - 5px)';
      firstHandle.title = 'First Line Indent: ' + (rulerIndents.first).toFixed(2) + '"';
    }
    if (hangHandle) {
      const pct = ((margin + rulerIndents.left) / pageW) * 100;
      hangHandle.style.left = 'calc(' + pct + '% - 5px)';
      hangHandle.title = 'Hanging Indent: ' + rulerIndents.left.toFixed(2) + '"';
    }
    if (leftHandle) {
      const pct = ((margin + rulerIndents.left) / pageW) * 100;
      leftHandle.style.left = 'calc(' + pct + '% - 5px)';
    }
    if (rightHandle) {
      const rightPct = ((pageW - rulerMargins.right - rulerIndents.right) / pageW) * 100;
      rightHandle.style.left = 'calc(' + rightPct + '% - 5px)';
      rightHandle.title = 'Right Indent: ' + rulerIndents.right.toFixed(2) + '"';
    }
  }

  function renderVerticalRuler() {
    const vRuler = document.getElementById('ruler-vertical');
    const viewRulerCheck = document.getElementById('view-ruler');
    if (!vRuler || !viewRulerCheck || !viewRulerCheck.checked)
      return;

    vRuler.innerHTML = '';

    const pageSizeVal = document.getElementById('rb-page-size').value;
    const orientVal = document.getElementById('rb-page-orient').value;
    const sizes = {
      a4: { w: 210 / 25.4, h: 297 / 25.4 },
      letter: { w: 8.5, h: 11 },
      legal: { w: 8.5, h: 14 },
      custom: { w: 8.5, h: 11 }
    };
    const size = sizes[pageSizeVal] || sizes.letter;
    const pageH = orientVal === 'landscape' ? size.w : size.h;

    const topMarginInch = getMarginInches('top');
    const botMarginInch = getMarginInches('bottom');

    // Draw margin regions
    const topPct = (topMarginInch / pageH) * 100;
    const botPct = (botMarginInch / pageH) * 100;

    const topMargin = document.createElement('div');
    topMargin.style.cssText = 'position:absolute;top:0;left:0;right:0;height:' + topPct + '%;background:var(--sz-color-button-face);';
    vRuler.appendChild(topMargin);

    const botMargin = document.createElement('div');
    botMargin.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:' + botPct + '%;background:var(--sz-color-button-face);';
    vRuler.appendChild(botMargin);

    // Content track
    const track = document.createElement('div');
    track.style.cssText = 'position:absolute;top:' + topPct + '%;bottom:' + botPct + '%;left:0;right:0;background:#fff;border-top:1px solid var(--sz-color-button-shadow);border-bottom:1px solid var(--sz-color-button-shadow);';
    vRuler.appendChild(track);

    // Tick marks
    const eighthInch = 1 / 8;
    for (let i = 0; i <= pageH / eighthInch; ++i) {
      const inches = i * eighthInch;
      if (inches > pageH)
        break;
      const pct = (inches / pageH) * 100;
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      tick.style.top = pct + '%';
      tick.style.right = '0';
      tick.style.left = 'auto';
      tick.style.bottom = 'auto';
      tick.style.height = '1px';

      if (i % 8 === 0) {
        tick.style.width = '10px';
        tick.style.opacity = '0.7';
        if (inches > 0 && inches < pageH) {
          const label = document.createElement('div');
          label.style.cssText = 'position:absolute;left:1px;top:' + pct + '%;font-size:7px;color:var(--sz-color-button-text);transform:translateY(-50%);pointer-events:none;opacity:0.7;';
          label.textContent = Math.round(inches);
          vRuler.appendChild(label);
        }
      } else if (i % 4 === 0) {
        tick.style.width = '7px';
        tick.style.opacity = '0.5';
      } else if (i % 2 === 0) {
        tick.style.width = '4px';
        tick.style.opacity = '0.35';
      } else {
        tick.style.width = '3px';
        tick.style.opacity = '0.25';
      }

      vRuler.appendChild(tick);
    }
  }

  function updateTabMarkersForSelection(rulerInner) {
    const sel = window.getSelection();
    if (!sel.rangeCount) {
      clearTabMarkers(rulerInner);
      return;
    }
    let container = sel.focusNode;
    if (container && container.nodeType === 3) container = container.parentElement;
    const block = container ? container.closest('p, div, h1, h2, h3, h4, h5, h6, li') : null;

    let tabStops = [];
    if (block) {
      try {
        const raw = block.getAttribute('data-tab-stops');
        if (raw) tabStops = JSON.parse(raw);
      } catch (ex) { /* ignore */ }
    }
    renderTabMarkers(rulerInner, tabStops);
  }

  function clearTabMarkers(rulerInner) {
    for (const m of rulerInner.querySelectorAll('.wp-tab-marker'))
      m.remove();
  }

  function getSelectedBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let container = sel.focusNode;
    if (container && container.nodeType === 3) container = container.parentElement;
    return container ? container.closest('p, div, h1, h2, h3, h4, h5, h6, li') : null;
  }

  function syncTabStopsToBlock(tabStops) {
    const block = getSelectedBlock();
    if (block) {
      if (tabStops.length)
        block.setAttribute('data-tab-stops', JSON.stringify(tabStops));
      else
        block.removeAttribute('data-tab-stops');
    }
    markDirty();
  }

  function renderTabMarkers(rulerInner, tabStops) {
    clearTabMarkers(rulerInner);
    const pageW = getPageWidthInches();
    const margin = rulerMargins.left;
    const contentW = pageW - margin - rulerMargins.right;

    for (const ts of tabStops) {
      const marker = document.createElement('div');
      marker.className = 'wp-tab-marker';
      marker.setAttribute('data-tab-type', ts.type);
      // Convert percentage of content width back to percentage of full ruler
      const absoluteInches = margin + (ts.position / 100) * contentW;
      const pct = (absoluteInches / pageW) * 100;
      marker.style.left = pct + '%';
      marker.title = ts.type.charAt(0).toUpperCase() + ts.type.slice(1)
        + ' tab at ' + absoluteInches.toFixed(2) + '"'
        + (ts.leader && ts.leader !== 'none' ? ' (' + ts.leader + ')' : '');

      // Drag to reposition / drag off ruler to remove
      let markerDragging = false;

      marker.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        markerDragging = true;
        marker.setPointerCapture(e.pointerId);
      });

      marker.addEventListener('pointermove', (e) => {
        if (!markerDragging)
          return;
        const rulerRect = rulerInner.getBoundingClientRect();
        const isOutside = e.clientY < rulerRect.top - 20 || e.clientY > rulerRect.bottom + 20;
        marker.style.opacity = isOutside ? '0.3' : '1';
        if (!isOutside) {
          const x = e.clientX - rulerRect.left;
          const newInch = (x / rulerRect.width) * pageW;
          const newPct = ((newInch / pageW) * 100);
          marker.style.left = newPct + '%';
        }
      });

      marker.addEventListener('pointerup', (e) => {
        if (!markerDragging)
          return;
        markerDragging = false;
        marker.releasePointerCapture(e.pointerId);

        const rulerRect = rulerInner.getBoundingClientRect();
        const isOutside = e.clientY < rulerRect.top - 20 || e.clientY > rulerRect.bottom + 20;
        if (isOutside) {
          const removeIdx = tabStops.findIndex(t => t.position === ts.position && t.type === ts.type);
          if (removeIdx >= 0) tabStops.splice(removeIdx, 1);
          syncTabStopsToBlock(tabStops);
          marker.remove();
        } else {
          const x = e.clientX - rulerRect.left;
          const newInch = Math.round(((x / rulerRect.width) * pageW) * 8) / 8; // snap to 1/8 inch
          const newPct = Math.round(Math.max(0, Math.min(100, ((newInch - margin) / contentW) * 100)) * 10) / 10;
          ts.position = newPct;
          tabStops.sort((a, b) => a.position - b.position);
          syncTabStopsToBlock(tabStops);
          renderTabMarkers(rulerInner, tabStops);
        }
      });

      // Prevent click propagation
      marker.addEventListener('click', (e) => e.stopPropagation());

      // Double-click to edit tab stop properties
      marker.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        showTabStopDialog(ts, tabStops, rulerInner);
      });

      rulerInner.appendChild(marker);
    }
  }

  function showTabStopDialog(tabStop, tabStops, rulerInner) {
    const typeChoice = prompt(
      'Tab Stop at ' + tabStop.position + '%\n\n'
      + 'Type (enter number):\n'
      + '  1 = Left\n'
      + '  2 = Center\n'
      + '  3 = Right\n'
      + '  4 = Decimal\n\n'
      + 'Leader (append letter after space):\n'
      + '  n = None\n'
      + '  d = Dots\n'
      + '  h = Dashes\n'
      + '  u = Underline\n\n'
      + 'Enter "delete" to remove this tab stop.\n\n'
      + 'Example: "3 d" = Right tab with dot leader',
      String(TAB_TYPES.indexOf(tabStop.type) + 1) + ' ' + (tabStop.leader && tabStop.leader !== 'none' ? tabStop.leader.charAt(0) : 'n')
    );
    if (!typeChoice) return;

    if (typeChoice.trim().toLowerCase() === 'delete') {
      const removeIdx = tabStops.findIndex(t => t.position === tabStop.position && t.type === tabStop.type);
      if (removeIdx >= 0) tabStops.splice(removeIdx, 1);
      syncTabStopsToBlock(tabStops);
      renderTabMarkers(rulerInner, tabStops);
      return;
    }

    const parts = typeChoice.trim().split(/\s+/);
    const typeNum = parseInt(parts[0], 10);
    if (typeNum >= 1 && typeNum <= 4)
      tabStop.type = TAB_TYPES[typeNum - 1];

    const leaderChar = (parts[1] || 'n').charAt(0).toLowerCase();
    switch (leaderChar) {
      case 'd': tabStop.leader = 'dots'; break;
      case 'h': tabStop.leader = 'dashes'; break;
      case 'u': tabStop.leader = 'underline'; break;
      default: tabStop.leader = 'none'; break;
    }

    syncTabStopsToBlock(tabStops);
    renderTabMarkers(rulerInner, tabStops);
  }

  // Handle Tab key in editor to use custom tab stops
  editor.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab')
      return;

    // Multilevel list Tab/Shift+Tab for promote/demote
    const sel = window.getSelection();
    if (sel.rangeCount) {
      let mlNode = sel.focusNode;
      if (mlNode && mlNode.nodeType === 3) mlNode = mlNode.parentElement;
      if (mlNode && mlNode.closest('.wp-multilevel li')) {
        e.preventDefault();
        if (e.shiftKey)
          TocFootnotes.promoteListItem();
        else
          TocFootnotes.demoteListItem();
        return;
      }
    }

    if (!sel.rangeCount)
      return;
    let container = sel.focusNode;
    if (container && container.nodeType === 3) container = container.parentElement;
    const block = container ? container.closest('p, div, h1, h2, h3, h4, h5, h6, li') : null;
    if (!block)
      return;

    let tabStops = [];
    try {
      const raw = block.getAttribute('data-tab-stops');
      if (raw) tabStops = JSON.parse(raw);
    } catch (ex) { /* ignore */ }

    if (!tabStops.length)
      return; // Use default tab behavior

    e.preventDefault();

    // Insert a tab space character
    const tabSpan = document.createElement('span');
    tabSpan.className = 'wp-tab-space';
    tabSpan.innerHTML = '&emsp;&emsp;';
    tabSpan.contentEditable = 'false';

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(tabSpan);
    range.setStartAfter(tabSpan);
    range.setEndAfter(tabSpan);
    sel.removeAllRanges();
    sel.addRange(range);
    markDirty();
  });

  // ═══════════════════════════════════════════════════════════════
  // Advanced Find & Replace (Sprint 5)
  // ═══════════════════════════════════════════════════════════════

  function doFindAll() {
    const needle = fpFindInput.value;
    if (!needle) {
      fpStatus.textContent = '';
      return;
    }

    // Clear previous highlights
    clearFindHighlights();

    const caseSensitive = fpCaseSensitive.checked;
    const wholeWord = document.getElementById('fr-whole-word').checked;

    let flags = caseSensitive ? 'g' : 'gi';
    let pattern;

    if (fpRegex.checked) {
      try {
        pattern = new RegExp(needle, flags);
      } catch (e) {
        fpStatus.textContent = 'Invalid regex: ' + e.message;
        return;
      }
    } else {
      let escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord)
        escaped = '\\b' + escaped + '\\b';
      pattern = new RegExp(escaped, flags);
    }

    // Walk text nodes and highlight matches
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode())
      textNodes.push(walker.currentNode);

    let matchCount = 0;
    // Process in reverse to avoid index shifting
    for (let i = textNodes.length - 1; i >= 0; --i) {
      const node = textNodes[i];

      // Format-aware filtering: skip nodes not matching format criteria
      if (!matchesFormatFilter(node))
        continue;

      const text = node.textContent;
      const matches = [...text.matchAll(pattern)];
      if (!matches.length)
        continue;

      const parent = node.parentNode;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;

      for (const match of matches) {
        // Text before match
        if (match.index > lastIndex)
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

        // Highlighted match
        const span = document.createElement('span');
        span.className = 'wp-find-highlight';
        span.textContent = match[0];
        frag.appendChild(span);

        lastIndex = match.index + match[0].length;
        ++matchCount;
      }

      // Remaining text
      if (lastIndex < text.length)
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));

      parent.replaceChild(frag, node);
    }

    fpStatus.textContent = matchCount > 0 ? matchCount + ' match(es) highlighted.' : 'No matches found.';
  }

  function clearFindHighlights() {
    const highlights = editor.querySelectorAll('.wp-find-highlight, .wp-find-current');
    for (const h of highlights) {
      const text = document.createTextNode(h.textContent);
      h.parentNode.replaceChild(text, h);
    }
    // Normalize adjacent text nodes
    editor.normalize();
  }

  // Clear highlights when closing find panel or changing search
  document.getElementById('fp-close').addEventListener('click', clearFindHighlights);

  // ═══════════════════════════════════════════════════════════════
  // Advanced List Management (Sprint 5)
  // ═══════════════════════════════════════════════════════════════

  function doRestartNumbering() {
    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;
    let container = sel.focusNode;
    if (container.nodeType === 3) container = container.parentElement;
    const li = container.closest('li');
    if (!li)
      return;
    const list = li.closest('ol, ul');
    if (!list || list.tagName.toLowerCase() !== 'ol')
      return;

    // Find the index of this li
    const items = Array.from(list.children);
    let idx = items.indexOf(li);
    if (idx <= 0)
      return;

    // Split the list at this point
    const newList = document.createElement('ol');
    newList.setAttribute('start', '1');
    while (items[idx] && list.contains(items[idx])) {
      newList.appendChild(items[idx]);
      ++idx;
    }
    list.after(newList);
    markDirty();
    editor.focus();
  }

  function doContinueNumbering() {
    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;
    let container = sel.focusNode;
    if (container.nodeType === 3) container = container.parentElement;
    const li = container.closest('li');
    if (!li)
      return;
    const list = li.closest('ol');
    if (!list)
      return;

    // Remove data-list-start if present
    list.removeAttribute('start');

    // If previous sibling is also an ol, merge them
    const prev = list.previousElementSibling;
    if (prev && prev.tagName.toLowerCase() === 'ol') {
      while (list.firstChild)
        prev.appendChild(list.firstChild);
      list.remove();
    }

    markDirty();
    editor.focus();
  }

  function doDefineListStyle() {
    const format = prompt('Enter numbering format:\n  1 = Decimal (1, 2, 3)\n  A = Alpha Upper (A, B, C)\n  a = Alpha Lower (a, b, c)\n  I = Roman Upper (I, II, III)\n  i = Roman Lower (i, ii, iii)', '1');
    if (!format)
      return;

    const startNum = parseInt(prompt('Starting number:', '1'), 10) || 1;

    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;
    let container = sel.focusNode;
    if (container.nodeType === 3) container = container.parentElement;
    const list = container.closest('ol');
    if (!list) {
      // Create a new ordered list
      document.execCommand('insertOrderedList');
      const newList = container.closest('ol') || editor.querySelector('ol:last-of-type');
      if (newList)
        applyListStyle(newList, format, startNum);
      return;
    }
    applyListStyle(list, format, startNum);
  }

  function applyListStyle(list, format, startNum) {
    let styleType;
    switch (format) {
      case 'A': styleType = 'upper-alpha'; break;
      case 'a': styleType = 'lower-alpha'; break;
      case 'I': styleType = 'upper-roman'; break;
      case 'i': styleType = 'lower-roman'; break;
      default: styleType = 'decimal'; break;
    }
    list.style.listStyleType = styleType;
    if (startNum > 1)
      list.setAttribute('start', String(startNum));
    else
      list.removeAttribute('start');
    markDirty();
    editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // Utility
  // ═══════════════════════════════════════════════════════════════

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════════════════════════════════
  // Document Templates (Feature 4.1)
  // ═══════════════════════════════════════════════════════════════

  function showTemplatePicker() {
    const list = document.getElementById('template-list');
    list.innerHTML = '';

    const all = Templates.getAllTemplates();
    for (const [id, tpl] of Object.entries(all)) {
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid var(--sz-color-button-shadow);border-radius:4px;padding:8px 12px;cursor:default;min-width:100px;text-align:center;background:var(--sz-color-button-face);';
      card.innerHTML = '<div style="font-weight:bold;font-size:12px;margin-bottom:4px;">' + escapeHtml(tpl.name) + '</div>'
        + '<div style="font-size:9px;color:var(--sz-color-gray-text);">' + (tpl.builtIn ? 'Built-in' : 'Custom') + '</div>';
      card.addEventListener('click', () => {
        setEditorContent(tpl.html);
        currentFileName = tpl.name;
        currentFilePath = null;
        dirty = false;
        updateTitle();
        SZ.Dialog.close('dlg-template-picker');
      });
      card.addEventListener('pointerenter', () => { card.style.borderColor = 'var(--sz-color-highlight)'; });
      card.addEventListener('pointerleave', () => { card.style.borderColor = 'var(--sz-color-button-shadow)'; });

      if (!tpl.builtIn) {
        const del = document.createElement('span');
        del.textContent = '\u00D7';
        del.title = 'Delete template';
        del.style.cssText = 'float:right;cursor:default;font-size:14px;line-height:1;color:var(--sz-color-gray-text);';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          Templates.deleteCustomTemplate(id);
          showTemplatePicker();
        });
        card.insertBefore(del, card.firstChild);
      }
      list.appendChild(card);
    }

    if (!Object.keys(all).length)
      list.innerHTML = '<div style="padding:8px;color:var(--sz-color-gray-text);font-size:10px;">No templates available.</div>';

    const saveBtn = document.getElementById('tpl-save-btn');
    const saveNameInput = document.getElementById('tpl-save-name');
    saveNameInput.value = '';

    const saveFn = () => {
      const name = saveNameInput.value.trim();
      if (!name) return;
      const id = 'custom-' + Date.now();
      Templates.saveCustomTemplate(id, name, editor.innerHTML);
      saveNameInput.value = '';
      showTemplatePicker();
    };
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.addEventListener('click', saveFn);

    const overlay = document.getElementById('dlg-template-picker');
    awaitDialogResult(overlay);
  }

  // ═══════════════════════════════════════════════════════════════
  // Restrict Editing (Feature 4.3)
  // ═══════════════════════════════════════════════════════════════

  async function simpleHash(str) {
    if (!str) return null;
    const data = new TextEncoder().encode(str);
    if (window.crypto && window.crypto.subtle) {
      const buf = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback simple hash
    let hash = 0;
    for (let i = 0; i < str.length; ++i) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return String(hash);
  }

  function applyRestriction(mode) {
    restrictMode = mode;
    if (mode === 'readonly') {
      editor.contentEditable = 'false';
      editor.style.opacity = '0.85';
    } else {
      editor.contentEditable = 'true';
      editor.style.opacity = '';
    }
    if (mode === 'tracked') {
      // Ensure track changes is enabled
      const btn = document.getElementById('btn-track-changes');
      if (btn && !btn.classList.contains('active'))
        CommentsTracking.toggleTrackChanges();
    }
  }

  function showRestrictEditingDialog() {
    const overlay = document.getElementById('dlg-restrict-editing');
    const pwInput = document.getElementById('restrict-password');
    pwInput.value = '';

    // Set current mode
    for (const radio of overlay.querySelectorAll('input[name="restrict-mode"]'))
      radio.checked = radio.value === restrictMode;

    awaitDialogResult(overlay, async (result) => {
      if (result !== 'ok') return;

      const selected = overlay.querySelector('input[name="restrict-mode"]:checked');
      const mode = selected ? selected.value : 'none';
      const pw = pwInput.value;

      if (restrictPasswordHash && mode === 'none') {
        const check = prompt('Enter password to remove restrictions:');
        const checkHash = await simpleHash(check);
        if (checkHash !== restrictPasswordHash) {
          await User32.MessageBox('Incorrect password.', 'Restrict Editing', MB_OK);
          return;
        }
        restrictPasswordHash = null;
      }

      if (pw) {
        restrictPasswordHash = await simpleHash(pw);
        docProperties.restrictPasswordHash = restrictPasswordHash;
      }

      applyRestriction(mode);
      editor.focus();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Navigation Pane Enhancement (Feature 4.2)
  // ═══════════════════════════════════════════════════════════════

  const navFilter = document.getElementById('nav-pane-filter');

  function updateNavPane() {
    navPaneBody.innerHTML = '';
    const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const filterText = navFilter ? navFilter.value.trim().toLowerCase() : '';

    // Build hierarchical tree
    let currentH1 = null;
    let currentH2 = null;

    for (const heading of headings) {
      const text = heading.textContent.trim();
      if (filterText && text.toLowerCase().indexOf(filterText) === -1)
        continue;

      const level = parseInt(heading.tagName[1], 10);
      const item = document.createElement('div');
      item.className = 'nav-tree-item';
      item.setAttribute('data-level', level);

      const toggle = document.createElement('span');
      toggle.className = 'nav-toggle';
      toggle.textContent = level <= 2 ? '\u25BC' : '';
      toggle.style.cssText = 'display:inline-block;width:12px;font-size:8px;cursor:default;text-align:center;flex-shrink:0;';

      const link = document.createElement('a');
      link.href = '#';
      link.textContent = text;
      link.className = 'nav-' + heading.tagName.toLowerCase();
      link.style.display = 'inline';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.appendChild(toggle);
      item.appendChild(link);

      if (level === 1) {
        navPaneBody.appendChild(item);
        currentH1 = document.createElement('div');
        currentH1.className = 'nav-tree-children';
        currentH1.style.cssText = 'margin-left:4px;';
        navPaneBody.appendChild(currentH1);
        currentH2 = null;

        toggle.addEventListener('click', () => {
          const collapsed = currentH1.style.display === 'none';
          currentH1.style.display = collapsed ? '' : 'none';
          toggle.textContent = collapsed ? '\u25BC' : '\u25B6';
        });
      } else if (level === 2) {
        const container = currentH1 || navPaneBody;
        container.appendChild(item);
        currentH2 = document.createElement('div');
        currentH2.className = 'nav-tree-children';
        currentH2.style.cssText = 'margin-left:4px;';
        container.appendChild(currentH2);

        toggle.addEventListener('click', () => {
          const collapsed = currentH2.style.display === 'none';
          currentH2.style.display = collapsed ? '' : 'none';
          toggle.textContent = collapsed ? '\u25BC' : '\u25B6';
        });
      } else {
        // H3-H6 nest under H2 or H1 or root
        const container = currentH2 || currentH1 || navPaneBody;
        toggle.textContent = '';
        container.appendChild(item);
      }
    }

    if (!headings.length || (filterText && !navPaneBody.children.length))
      navPaneBody.innerHTML = '<div style="padding:8px;color:var(--sz-color-gray-text);font-size:10px;">No headings found.</div>';
  }

  if (navFilter) {
    navFilter.addEventListener('input', () => {
      if (navPane.style.display !== 'none')
        updateNavPane();
    });
  }

  // MutationObserver for auto-refresh nav pane
  const navObserver = new MutationObserver(() => {
    if (navPane.style.display !== 'none')
      updateNavPane();
  });

  // ═══════════════════════════════════════════════════════════════
  // W1 — Table Style Gallery
  // ═══════════════════════════════════════════════════════════════

  const TABLE_STYLE_PRESETS = [
    { id: 'plain', name: 'Plain', headerBg: 'transparent', headerColor: 'inherit', headerBorder: 'none', cellBorder: 'none', rowBg: 'transparent', altRowBg: 'transparent' },
    { id: 'grid', name: 'Grid', headerBg: 'transparent', headerColor: 'inherit', headerBorder: '1px solid #333', cellBorder: '1px solid #333', rowBg: 'transparent', altRowBg: 'transparent' },
    { id: 'light-shading', name: 'Light Shading', headerBg: '#d6e4f0', headerColor: '#222', headerBorder: '1px solid #b0c4de', cellBorder: '1px solid #ddd', rowBg: '#fff', altRowBg: '#f0f5fa' },
    { id: 'medium-shading', name: 'Medium Shading', headerBg: '#4472c4', headerColor: '#fff', headerBorder: '1px solid #3061a0', cellBorder: '1px solid #ccc', rowBg: '#fff', altRowBg: '#e8f0fe' },
    { id: 'dark', name: 'Dark', headerBg: '#2e2e2e', headerColor: '#fff', headerBorder: '1px solid #111', cellBorder: '1px solid #555', rowBg: '#444', altRowBg: '#3a3a3a' },
    { id: 'colorful-green', name: 'Colorful 1', headerBg: '#2e7d32', headerColor: '#fff', headerBorder: '1px solid #1b5e20', cellBorder: '1px solid #c8e6c9', rowBg: '#fff', altRowBg: '#e8f5e9' },
    { id: 'colorful-orange', name: 'Colorful 2', headerBg: '#e65100', headerColor: '#fff', headerBorder: '1px solid #bf360c', cellBorder: '1px solid #ffe0b2', rowBg: '#fff', altRowBg: '#fff3e0' },
    { id: 'colorful-purple', name: 'Colorful 3', headerBg: '#6a1b9a', headerColor: '#fff', headerBorder: '1px solid #4a148c', cellBorder: '1px solid #e1bee7', rowBg: '#fff', altRowBg: '#f3e5f5' },
    { id: 'light-list', name: 'Light List', headerBg: 'transparent', headerColor: '#0d47a1', headerBorder: 'none', cellBorder: 'none', rowBg: 'transparent', altRowBg: 'transparent', special: 'light-list' },
    { id: 'medium-list', name: 'Medium List', headerBg: 'transparent', headerColor: '#222', headerBorder: 'none', cellBorder: 'none', rowBg: 'transparent', altRowBg: '#f5f5f5', special: 'medium-list' },
    { id: 'light-grid', name: 'Light Grid', headerBg: 'transparent', headerColor: 'inherit', headerBorder: '1px solid #bbb', cellBorder: '1px solid #ddd', rowBg: 'transparent', altRowBg: 'transparent' },
    { id: 'medium-grid', name: 'Medium Grid', headerBg: '#e0e0e0', headerColor: '#222', headerBorder: '2px solid #999', cellBorder: '1px solid #bbb', rowBg: 'transparent', altRowBg: 'transparent' },
  ];

  function showTableStyleGallery() {
    const sel = window.getSelection();
    let table = null;
    if (sel.rangeCount) {
      let container = sel.focusNode;
      if (container && container.nodeType === 3) container = container.parentElement;
      if (container)
        table = container.closest('table');
    }
    if (!table) {
      // Try to find any table in the editor
      table = editor.querySelector('table');
    }

    const gallery = document.getElementById('ts-gallery');
    gallery.innerHTML = '';

    for (const preset of TABLE_STYLE_PRESETS) {
      const tile = document.createElement('div');
      tile.className = 'ts-tile';

      const name = document.createElement('div');
      name.className = 'ts-tile-name';
      name.textContent = preset.name;
      tile.appendChild(name);

      // Build a mini preview table
      const preview = document.createElement('div');
      preview.className = 'ts-tile-preview';
      let previewHtml = '<table><tr>';
      for (let c = 0; c < 3; ++c)
        previewHtml += '<th style="padding:1px 3px;background:' + preset.headerBg + ';color:' + preset.headerColor + ';border:' + preset.headerBorder + ';font-size:7px;font-weight:bold;">H' + (c + 1) + '</th>';
      previewHtml += '</tr>';
      for (let r = 0; r < 2; ++r) {
        const bg = r % 2 === 0 ? preset.rowBg : preset.altRowBg;
        previewHtml += '<tr>';
        for (let c = 0; c < 3; ++c)
          previewHtml += '<td style="padding:1px 3px;background:' + bg + ';border:' + preset.cellBorder + ';font-size:7px;">...</td>';
        previewHtml += '</tr>';
      }
      previewHtml += '</table>';
      preview.innerHTML = previewHtml;
      tile.appendChild(preview);

      tile.addEventListener('click', () => {
        if (!table) return;
        applyTableStyle(table, preset);
        const dlgOverlay = document.getElementById('dlg-table-styles');
        if (dlgOverlay._dialogDone)
          dlgOverlay._dialogDone(null);
        else
          dlgOverlay.classList.remove('visible');
        markDirty();
        editor.focus();
      });

      gallery.appendChild(tile);
    }

    if (!table) {
      const notice = document.createElement('p');
      notice.style.cssText = 'color:#c00;font-size:11px;margin:0 0 8px;';
      notice.textContent = 'No table found. Place cursor inside a table first.';
      gallery.insertBefore(notice, gallery.firstChild);
    }

    SZ.Dialog.show('dlg-table-styles');
  }

  function applyTableStyle(table, preset) {
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';

    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < rows.length; ++i) {
      const row = rows[i];
      const isHeader = i === 0;
      const cells = row.querySelectorAll('td, th');

      if (isHeader) {
        row.style.background = preset.headerBg;
        row.style.color = preset.headerColor;
        row.style.fontWeight = 'bold';
      } else {
        const bg = i % 2 === 0 ? preset.altRowBg : preset.rowBg;
        row.style.background = bg;
        row.style.color = preset.id === 'dark' ? '#eee' : '';
        row.style.fontWeight = '';
      }

      for (const cell of cells) {
        cell.style.border = isHeader ? preset.headerBorder : preset.cellBorder;
        cell.style.padding = '4px 8px';

        // Special style: light-list -- left border accent on first column
        if (preset.special === 'light-list' && cell === cells[0] && !isHeader)
          cell.style.borderLeft = '3px solid #0d47a1';

        // Special style: medium-list -- thick bottom border on header
        if (preset.special === 'medium-list' && isHeader)
          cell.style.borderBottom = '3px solid #333';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // W2 — Mail Merge Fields
  // ═══════════════════════════════════════════════════════════════

  function showMergeFieldDialog() {
    const grid = document.getElementById('merge-field-grid');
    grid.innerHTML = '';

    for (const field of mergeFields) {
      const btn = document.createElement('button');
      btn.className = 'merge-field-btn';
      btn.textContent = '{{' + field + '}}';
      btn.title = 'Insert ' + field;
      btn.addEventListener('click', () => {
        const span = '<span class="merge-field" data-field="' + escapeHtml(field) + '" contenteditable="false">{{' + escapeHtml(field) + '}}</span>';
        editor.focus();
        document.execCommand('insertHTML', false, span);
        markDirty();
      });
      grid.appendChild(btn);
    }

    SZ.Dialog.show('dlg-merge-fields');
  }

  function showMergeDataDialog() {
    const textarea = document.getElementById('merge-csv-data');
    // Build CSV from current data or provide sample
    if (mergeDataSource.length) {
      const headers = mergeFields.join(',');
      const rows = mergeDataSource.map(record =>
        mergeFields.map(f => '"' + (record[f] || '').replace(/"/g, '""') + '"').join(',')
      );
      textarea.value = headers + '\n' + rows.join('\n');
    } else {
      textarea.value = mergeFields.join(',') + '\n'
        + 'John,Doe,Acme Corp,123 Main St,Springfield,IL,62701,john@example.com\n'
        + 'Jane,Smith,Widgets Inc,456 Oak Ave,Chicago,IL,60601,jane@example.com\n'
        + 'Bob,Johnson,Tech Ltd,789 Elm Dr,Peoria,IL,61602,bob@example.com';
    }

    awaitDialogResult(document.getElementById('dlg-merge-data'), (result) => {
      if (result !== 'ok')
        return;
      const csv = textarea.value.trim();
      if (!csv)
        return;
      parseMergeCSV(csv);
    });
  }

  function parseMergeCSV(csv) {
    const lines = csv.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2)
      return;

    // Simple CSV parse (handles quoted fields)
    function parseLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; ++i) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            ++i;
          } else
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else
          current += ch;
      }
      result.push(current.trim());
      return result;
    }

    const headers = parseLine(lines[0]);
    mergeFields = headers;
    mergeDataSource = [];
    for (let i = 1; i < lines.length; ++i) {
      const values = parseLine(lines[i]);
      const record = {};
      for (let j = 0; j < headers.length; ++j)
        record[headers[j]] = values[j] || '';
      mergeDataSource.push(record);
    }
  }

  function toggleMergePreview() {
    mergePreviewActive = !mergePreviewActive;
    const btn = document.getElementById('btn-merge-preview');
    if (btn)
      btn.classList.toggle('active', mergePreviewActive);

    if (mergePreviewActive) {
      if (!mergeDataSource.length) {
        mergePreviewActive = false;
        if (btn) btn.classList.remove('active');
        return;
      }
      mergePreviewIndex = 0;
      applyMergePreview();
    } else
      restoreMergeFields();
  }

  function navigateMergeRecord(delta) {
    if (!mergePreviewActive || !mergeDataSource.length)
      return;
    mergePreviewIndex = (mergePreviewIndex + delta + mergeDataSource.length) % mergeDataSource.length;
    applyMergePreview();
  }

  function applyMergePreview() {
    const record = mergeDataSource[mergePreviewIndex];
    if (!record)
      return;
    const fields = editor.querySelectorAll('.merge-field');
    for (const span of fields) {
      const fieldName = span.getAttribute('data-field');
      const value = record[fieldName] || '';
      span.textContent = value;
      span.classList.add('merge-preview-value');
      span.classList.remove('merge-field');
    }
    // Also handle already-previewed spans
    const previewed = editor.querySelectorAll('.merge-preview-value');
    for (const span of previewed) {
      const fieldName = span.getAttribute('data-field');
      const value = record[fieldName] || '';
      span.textContent = value;
    }
  }

  function restoreMergeFields() {
    const previewed = editor.querySelectorAll('.merge-preview-value');
    for (const span of previewed) {
      const fieldName = span.getAttribute('data-field');
      span.textContent = '{{' + fieldName + '}}';
      span.classList.remove('merge-preview-value');
      span.classList.add('merge-field');
    }
  }

  function doFinishMerge() {
    if (!mergeDataSource.length)
      return;

    // Restore fields first if previewing
    if (mergePreviewActive)
      restoreMergeFields();

    const templateHtml = editor.innerHTML;
    let mergedHtml = '';

    for (let i = 0; i < mergeDataSource.length; ++i) {
      const record = mergeDataSource[i];
      let pageHtml = templateHtml;

      // Replace merge field spans with actual values
      for (const field of mergeFields) {
        const spanRegex = new RegExp('<span[^>]*data-field="' + field + '"[^>]*>[^<]*</span>', 'gi');
        pageHtml = pageHtml.replace(spanRegex, escapeHtml(record[field] || ''));
        // Also replace plain {{Field}} text
        pageHtml = pageHtml.replace(new RegExp('\\{\\{' + field + '\\}\\}', 'g'), escapeHtml(record[field] || ''));
      }

      mergedHtml += '<div style="page-break-after:always;margin-bottom:24px;padding-bottom:24px;border-bottom:2px dashed #999;">'
        + '<p style="font-size:10px;color:#999;margin:0 0 8px;">--- Record ' + (i + 1) + ' of ' + mergeDataSource.length + ' ---</p>'
        + pageHtml
        + '</div>';
    }

    // Open merged result in a new overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#666;z-index:10000;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:20px;';

    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'position:sticky;top:0;z-index:1;background:#333;color:white;padding:8px 16px;display:flex;gap:12px;align-items:center;border-radius:4px;margin-bottom:16px;font-size:12px;';
    toolbar.innerHTML = '<span>Merge Results (' + mergeDataSource.length + ' records)</span>';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'background:#555;color:white;border:1px solid #777;padding:4px 16px;border-radius:3px;cursor:pointer;font-size:11px;';
    closeBtn.addEventListener('click', () => overlay.remove());
    toolbar.appendChild(closeBtn);
    overlay.appendChild(toolbar);

    const content = document.createElement('div');
    content.style.cssText = 'background:white;padding:48px;max-width:8.5in;width:100%;box-sizing:border-box;box-shadow:0 2px 8px rgba(0,0,0,0.3);color:black;font-family:Calibri,Arial,sans-serif;font-size:11pt;';
    content.innerHTML = mergedHtml;
    overlay.appendChild(content);

    document.body.appendChild(overlay);
  }

  // ═══════════════════════════════════════════════════════════════
  // W3 — Compare Documents
  // ═══════════════════════════════════════════════════════════════

  function showCompareDialog() {
    document.getElementById('compare-text').value = '';
    awaitDialogResult(document.getElementById('dlg-compare'), (result) => {
      if (result !== 'ok')
        return;
      const revisedText = document.getElementById('compare-text').value;
      if (!revisedText.trim())
        return;
      runCompare(editor.innerText, revisedText);
    });
  }

  function runCompare(originalText, revisedText) {
    const originalLines = originalText.split('\n');
    const revisedLines = revisedText.split('\n');

    // LCS-based diff
    const diff = computeDiff(originalLines, revisedLines);

    // Build display
    const originalPane = document.getElementById('compare-original');
    const revisedPane = document.getElementById('compare-revised');
    originalPane.innerHTML = '';
    revisedPane.innerHTML = '';

    let changeIndex = 0;
    for (const entry of diff) {
      if (entry.type === 'equal') {
        const oLine = document.createElement('div');
        oLine.textContent = entry.value;
        originalPane.appendChild(oLine);

        const rLine = document.createElement('div');
        rLine.textContent = entry.value;
        revisedPane.appendChild(rLine);
      } else if (entry.type === 'delete') {
        const oLine = document.createElement('div');
        oLine.className = 'diff-del';
        oLine.setAttribute('data-change-idx', changeIndex++);
        oLine.textContent = entry.value;
        originalPane.appendChild(oLine);

        // Add empty spacer in revised pane
        const spacer = document.createElement('div');
        spacer.textContent = '\u00A0';
        spacer.style.opacity = '0.3';
        revisedPane.appendChild(spacer);
      } else if (entry.type === 'add') {
        // Add empty spacer in original pane
        const spacer = document.createElement('div');
        spacer.textContent = '\u00A0';
        spacer.style.opacity = '0.3';
        originalPane.appendChild(spacer);

        const rLine = document.createElement('div');
        rLine.className = 'diff-add';
        rLine.setAttribute('data-change-idx', changeIndex++);
        rLine.textContent = entry.value;
        revisedPane.appendChild(rLine);
      }
    }

    const totalChanges = changeIndex;
    let currentChange = -1;
    const statusEl = document.getElementById('compare-change-status');
    statusEl.textContent = totalChanges + ' change(s) found';

    function navigateChange(delta) {
      if (totalChanges === 0)
        return;
      // Clear current highlight
      for (const el of document.querySelectorAll('.diff-current'))
        el.classList.remove('diff-current');

      currentChange = (currentChange + delta + totalChanges) % totalChanges;
      const targets = document.querySelectorAll('[data-change-idx="' + currentChange + '"]');
      for (const t of targets) {
        t.classList.add('diff-current');
        t.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      statusEl.textContent = 'Change ' + (currentChange + 1) + ' of ' + totalChanges;
    }

    document.getElementById('compare-prev-change').onclick = () => navigateChange(-1);
    document.getElementById('compare-next-change').onclick = () => navigateChange(1);

    SZ.Dialog.show('dlg-compare-result');
  }

  function computeDiff(oldLines, newLines) {
    const m = oldLines.length;
    const n = newLines.length;

    // Build LCS table
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; ++i)
      for (let j = 1; j <= n; ++j)
        dp[i][j] = oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);

    // Backtrack to produce diff
    const result = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        result.unshift({ type: 'equal', value: oldLines[i - 1] });
        --i;
        --j;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.unshift({ type: 'add', value: newLines[j - 1] });
        --j;
      } else {
        result.unshift({ type: 'delete', value: oldLines[i - 1] });
        --i;
      }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // W4 — Macro Recorder
  // ═══════════════════════════════════════════════════════════════

  function doMacroRecord() {
    if (macroRecording)
      return;
    macroRecording = true;
    macroCurrentActions = [];

    // Show recording indicator
    macroRecordingIndicator = document.createElement('div');
    macroRecordingIndicator.className = 'macro-recording-indicator';
    macroRecordingIndicator.textContent = 'Recording Macro...';
    document.body.appendChild(macroRecordingIndicator);

    // Toggle button visibility
    const recBtn = document.getElementById('btn-macro-record');
    const stopBtn = document.getElementById('btn-macro-stop');
    if (recBtn) recBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = '';
  }

  function doMacroStop() {
    if (!macroRecording)
      return;
    macroRecording = false;

    // Remove recording indicator
    if (macroRecordingIndicator) {
      macroRecordingIndicator.remove();
      macroRecordingIndicator = null;
    }

    // Toggle button visibility
    const recBtn = document.getElementById('btn-macro-record');
    const stopBtn = document.getElementById('btn-macro-stop');
    if (recBtn) recBtn.style.display = '';
    if (stopBtn) stopBtn.style.display = 'none';

    if (!macroCurrentActions.length)
      return;

    // Ask for macro name
    const nameInput = document.getElementById('macro-name-input');
    nameInput.value = 'Macro ' + (macroSavedMacros.length + 1);

    awaitDialogResult(document.getElementById('dlg-macro-name'), (result) => {
      if (result !== 'ok')
        return;
      const name = nameInput.value.trim();
      if (!name)
        return;
      macroSavedMacros.push({ name, actions: [...macroCurrentActions] });
      macroCurrentActions = [];
    });
  }

  function doMacroPlay() {
    if (macroRecording)
      return;
    if (!macroSavedMacros.length) {
      showMacroManager();
      return;
    }

    // If only one macro, play it directly
    if (macroSavedMacros.length === 1) {
      playMacro(macroSavedMacros[0]);
      return;
    }

    // Show manager to select
    showMacroManager();
  }

  function playMacro(macro) {
    if (!macro || !macro.actions.length)
      return;
    // Disable recording during playback
    const wasRecording = macroRecording;
    macroRecording = false;

    for (const action of macro.actions)
      handleAction(action);

    macroRecording = wasRecording;
    editor.focus();
  }

  function showMacroManager() {
    const list = document.getElementById('macro-list');
    list.innerHTML = '';
    let selectedIdx = -1;

    function renderList() {
      list.innerHTML = '';
      if (!macroSavedMacros.length) {
        list.innerHTML = '<div style="padding:8px;color:var(--sz-color-gray-text);font-size:10px;">No macros recorded yet.</div>';
        return;
      }

      for (let i = 0; i < macroSavedMacros.length; ++i) {
        const macro = macroSavedMacros[i];
        const item = document.createElement('div');
        item.className = 'macro-item' + (i === selectedIdx ? ' selected' : '');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'macro-item-name';
        nameSpan.textContent = macro.name;

        const countSpan = document.createElement('span');
        countSpan.className = 'macro-item-count';
        countSpan.textContent = macro.actions.length + ' action(s)';

        item.appendChild(nameSpan);
        item.appendChild(countSpan);
        item.addEventListener('click', () => {
          selectedIdx = i;
          renderList();
        });
        item.addEventListener('dblclick', () => {
          const dlgOverlay = document.getElementById('dlg-macro-manager');
          if (dlgOverlay._dialogDone)
            dlgOverlay._dialogDone(null);
          playMacro(macro);
        });

        list.appendChild(item);
      }
    }

    renderList();

    const runBtn = document.getElementById('macro-run-btn');
    const deleteBtn = document.getElementById('macro-delete-btn');

    const newRunBtn = runBtn.cloneNode(true);
    runBtn.parentNode.replaceChild(newRunBtn, runBtn);
    newRunBtn.addEventListener('click', () => {
      if (selectedIdx >= 0 && selectedIdx < macroSavedMacros.length) {
        const dlgOverlay = document.getElementById('dlg-macro-manager');
        if (dlgOverlay._dialogDone)
          dlgOverlay._dialogDone(null);
        playMacro(macroSavedMacros[selectedIdx]);
      }
    });

    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    newDeleteBtn.addEventListener('click', () => {
      if (selectedIdx >= 0 && selectedIdx < macroSavedMacros.length) {
        macroSavedMacros.splice(selectedIdx, 1);
        selectedIdx = -1;
        renderList();
      }
    });

    SZ.Dialog.show('dlg-macro-manager');
  }

  // ═══════════════════════════════════════════════════════════════
  // W5 — Accessibility Checker
  // ═══════════════════════════════════════════════════════════════

  function showAccessibilityChecker() {
    const issues = runAccessibilityCheck();
    renderAccessibilityResults(issues);
    SZ.Dialog.show('dlg-accessibility').then((result) => {
      if (result === 'ok') {
        // Re-check was clicked
        showAccessibilityChecker();
      }
    });
  }

  function runAccessibilityCheck() {
    const issues = [];

    // 1. Images without alt text
    const images = editor.querySelectorAll('img');
    for (const img of images) {
      const alt = img.getAttribute('alt');
      if (!alt || !alt.trim())
        issues.push({
          severity: 'error',
          title: 'Image missing alt text',
          desc: 'Screen readers cannot describe this image.',
          element: img,
          fix: 'add-alt'
        });
    }

    // 2. Empty hyperlinks
    const links = editor.querySelectorAll('a[href]');
    for (const link of links) {
      if (!link.textContent.trim())
        issues.push({
          severity: 'error',
          title: 'Empty hyperlink',
          desc: 'Link has no visible text for screen readers.',
          element: link,
          fix: 'fill-link'
        });
    }

    // 3. Empty table headers
    const ths = editor.querySelectorAll('th');
    for (const th of ths) {
      if (!th.textContent.trim())
        issues.push({
          severity: 'tip',
          title: 'Empty table header',
          desc: 'Table header cell has no text.',
          element: th,
          fix: 'fill-header'
        });
    }

    // 4. Skipped heading levels
    const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    for (const h of headings) {
      const level = parseInt(h.tagName[1], 10);
      if (lastLevel > 0 && level > lastLevel + 1)
        issues.push({
          severity: 'warning',
          title: 'Skipped heading level',
          desc: 'H' + level + ' follows H' + lastLevel + '. Consider using H' + (lastLevel + 1) + ' instead.',
          element: h,
          fix: null
        });
      lastLevel = level;
    }

    // 5. Low contrast text (check for light text on white or dark text on dark)
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, null, false);
    let el;
    while (el = walker.nextNode()) {
      if (!el.textContent.trim() || el.tagName === 'IMG' || el.closest('.watermark, .wp-watermark-image'))
        continue;
      if (!['P', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'A', 'STRONG', 'EM', 'B', 'I'].includes(el.tagName))
        continue;

      const cs = window.getComputedStyle(el);
      const fg = cs.color;
      const bg = cs.backgroundColor;

      // Only check if color was explicitly set (not inherited default)
      if (!el.style.color)
        continue;

      const fgRgb = parseRgb(fg);
      const bgRgb = parseRgb(bg) || { r: 255, g: 255, b: 255 }; // assume white bg if transparent

      if (fgRgb) {
        const ratio = contrastRatio(fgRgb, bgRgb);
        if (ratio < 3)
          issues.push({
            severity: 'warning',
            title: 'Low contrast text',
            desc: 'Text may be hard to read (contrast ratio: ' + ratio.toFixed(1) + ':1).',
            element: el,
            fix: null
          });
      }
    }

    // 6. Missing document title
    if (!docProperties.title || !docProperties.title.trim())
      issues.push({
        severity: 'tip',
        title: 'No document title',
        desc: 'Set a document title in File > Properties for accessibility.',
        element: null,
        fix: 'set-title'
      });

    return issues;
  }

  function parseRgb(str) {
    if (!str)
      return null;
    const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match)
      return null;
    return { r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) };
  }

  function luminance(rgb) {
    const a = [rgb.r, rgb.g, rgb.b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function contrastRatio(fg, bg) {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function renderAccessibilityResults(issues) {
    const container = document.getElementById('a11y-results');
    container.innerHTML = '';

    if (!issues.length) {
      container.innerHTML = '<div class="a11y-pass">No accessibility issues found.</div>';
      return;
    }

    const categories = { error: [], warning: [], tip: [] };
    for (const issue of issues)
      categories[issue.severity].push(issue);

    const labels = { error: 'Errors', warning: 'Warnings', tip: 'Tips' };
    const icons = { error: '\u2716', warning: '\u26A0', tip: '\u2139' };

    for (const [sev, list] of Object.entries(categories)) {
      if (!list.length)
        continue;

      const cat = document.createElement('div');
      cat.className = 'a11y-category';

      const title = document.createElement('div');
      title.className = 'a11y-category-title a11y-' + sev;
      title.textContent = labels[sev] + ' (' + list.length + ')';
      cat.appendChild(title);

      for (const issue of list) {
        const row = document.createElement('div');
        row.className = 'a11y-issue';

        const severity = document.createElement('span');
        severity.className = 'a11y-severity ' + sev;
        severity.textContent = icons[sev];
        row.appendChild(severity);

        const textDiv = document.createElement('div');
        textDiv.className = 'a11y-issue-text';

        const titleSpan = document.createElement('div');
        titleSpan.textContent = issue.title;
        titleSpan.style.fontWeight = 'bold';
        textDiv.appendChild(titleSpan);

        const desc = document.createElement('div');
        desc.className = 'a11y-issue-desc';
        desc.textContent = issue.desc;
        textDiv.appendChild(desc);

        row.appendChild(textDiv);

        if (issue.fix) {
          const fixBtn = document.createElement('button');
          fixBtn.className = 'a11y-fix-btn';
          fixBtn.textContent = 'Fix';
          fixBtn.addEventListener('click', () => {
            applyAccessibilityFix(issue);
            // Refresh results
            const refreshed = runAccessibilityCheck();
            renderAccessibilityResults(refreshed);
          });
          row.appendChild(fixBtn);
        }

        // Click to scroll to element
        if (issue.element) {
          row.style.cursor = 'pointer';
          row.addEventListener('click', (e) => {
            if (e.target.closest('.a11y-fix-btn'))
              return;
            issue.element.scrollIntoView({ block: 'center', behavior: 'smooth' });
            // Flash the element
            const orig = issue.element.style.outline;
            issue.element.style.outline = '2px solid #c00';
            setTimeout(() => { issue.element.style.outline = orig; }, 1500);
          });
        }

        cat.appendChild(row);
      }

      container.appendChild(cat);
    }
  }

  function applyAccessibilityFix(issue) {
    if (issue.fix === 'add-alt' && issue.element) {
      const alt = prompt('Enter alt text for this image:', '');
      if (alt != null) {
        issue.element.setAttribute('alt', alt);
        markDirty();
      }
    } else if (issue.fix === 'fill-link' && issue.element) {
      const text = prompt('Enter link text:', issue.element.getAttribute('href') || 'Link');
      if (text != null) {
        issue.element.textContent = text;
        markDirty();
      }
    } else if (issue.fix === 'fill-header' && issue.element) {
      const text = prompt('Enter header text:', 'Header');
      if (text != null) {
        issue.element.textContent = text;
        markDirty();
      }
    } else if (issue.fix === 'set-title') {
      const title = prompt('Enter document title:', docProperties.title || '');
      if (title != null) {
        docProperties.title = title;
        document.title = title + ' - WordPad';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Module Initialization
  // ═══════════════════════════════════════════════════════════════

  const ctx = { editor, editorWrapper, markDirty, escapeHtml, rgbToHex, User32, Kernel32, ComDlg32, showDialog: SZ.Dialog.show, showColorPalette };
  DocxEngine.init(ctx);
  RtfEngine.init(ctx);
  CommentsTracking.init(ctx);
  TocFootnotes.init(ctx);
  ImageTools.init(ctx);
  ShapeTools.init(ctx);
  SpellCheck.init(ctx);
  StylesGallery.init(ctx);
  EquationEditor.init(ctx);
  AutoCorrect.init(ctx);
  FieldCodes.init(ctx);
  Sections.init(ctx);
  Bibliography.init(ctx);
  AutoText.init(ctx);

  // Initialize tab stop ruler
  initTabStopRuler();

  // ═══════════════════════════════════════════════════════════════
  // Gutter & Mirror Margins (Sprint 3)
  // ═══════════════════════════════════════════════════════════════

  const gutterInput = document.getElementById('ps-gutter');
  const mirrorCheck = document.getElementById('ps-mirror');

  if (gutterInput) {
    gutterInput.addEventListener('change', () => {
      const section = Sections.getCurrentSection();
      Sections.setGutter(section, gutterInput.value);
    });
  }

  if (mirrorCheck) {
    mirrorCheck.addEventListener('change', () => {
      const section = Sections.getCurrentSection();
      Sections.setMirrorMargins(section, mirrorCheck.checked);
    });
  }

  // Wire checkbox actions for different first/odd-even
  for (const cb of document.querySelectorAll('input[type="checkbox"][data-action]')) {
    cb.addEventListener('change', () => {
      handleAction(cb.dataset.action);
    });
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

  // Start MutationObserver for auto-refresh nav pane
  navObserver.observe(editor, { childList: true, subtree: true, characterData: true });

  // Start MutationObserver for auto page layout updates
  _pageLayoutObserver.observe(editor, { childList: true, subtree: true, characterData: true });

  applyPageSetup();
  updatePageBreakIndicators();
  editor.focus();
})();
