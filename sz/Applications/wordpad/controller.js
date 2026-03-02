;(function() {
  'use strict';

  const { DocxEngine, RtfEngine, CommentsTracking, TocFootnotes, ImageTools, SpellCheck, StylesGallery, EquationEditor, AutoCorrect, FieldCodes, Sections, Bibliography, AutoText, Templates } = window.WordPadApp;
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
  let currentFileFormat = 'docx'; // Track current file format
  let docxMetadata = null; // Store parsed DOCX metadata for round-trip

  // Document Properties state
  let docProperties = { title: '', author: '', subject: '', keywords: '', description: '', created: null, modified: null };

  // Restrict Editing state
  let restrictMode = 'none'; // 'none' | 'tracked' | 'readonly'
  let restrictPasswordHash = null;

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
      case 'insert-shape-rect': doInsertShape('rect'); break;
      case 'insert-shape-circle': doInsertShape('circle'); break;
      case 'insert-shape-line': doInsertShape('line'); break;
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
        fontColorInput.value = hex;
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
    const headerEl = editor.querySelector('.wp-header');
    const footerEl = editor.querySelector('.wp-footer');
    const headerText = headerEl ? headerEl.textContent : '';

    // Remove header/footer from clone (we'll add them per page)
    for (const el of content.querySelectorAll('.wp-header, .wp-footer'))
      el.remove();

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
    '<div class="ctx-sep"></div>',
    '<div class="ctx-entry" data-taction="table-style-banded">Toggle Banded Rows</div>',
    '<div class="ctx-entry" data-taction="table-style-header">Toggle Header Row Style</div>',
    '<div class="ctx-entry" data-taction="table-repeat-header">Toggle Repeat Header</div>',
    '<div class="ctx-entry" data-taction="table-formula">Insert Formula</div>',
    '<div class="ctx-entry" data-taction="table-properties">Table Properties...</div>',
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
    const borderColorInput = document.getElementById('tp-border-color');
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
      borderColorInput.value = rgbToHex(tdCs.borderColor) || '#999999';
    }

    bandedCheck.checked = table.classList.contains('wp-table-banded');
    headerRowCheck.checked = table.classList.contains('wp-table-header-row');
    const firstRow = table.rows[0];
    repeatHeaderCheck.checked = firstRow && firstRow.hasAttribute('data-repeat-header');

    const overlay = document.getElementById('dlg-table-props');
    overlay.style.display = 'flex';

    const okBtn = overlay.querySelector('.wp-dlg-ok');
    const cancelBtn = overlay.querySelector('.wp-dlg-cancel');

    const applyHandler = () => {
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
      const borderColor = borderColorInput.value;
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

  function doInsertPageNumberField() {
    // Use field code instead of static text
    const footer = editor.querySelector('.wp-footer');
    if (!footer) {
      doInsertFooter();
    }
    const target = editor.querySelector('.wp-footer');
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
    document.getElementById('pb-color').value = '#000000';
    document.getElementById('pb-apply').value = 'document';

    const overlay = document.getElementById('dlg-page-borders');
    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;
      const style = document.getElementById('pb-style').value;
      const width = parseInt(document.getElementById('pb-width').value, 10) || 1;
      const color = document.getElementById('pb-color').value;
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

  document.getElementById('fp-close').addEventListener('click', () => {
    findPanel.classList.remove('visible');
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
  document.getElementById('btn-find-all').addEventListener('click', () => doFindAll());

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

  // ── Format-Aware Search ─────────────────────────────────────
  const fpFormatAware = document.getElementById('fp-format-aware');
  const fpFormatFilters = document.getElementById('fp-format-filters');
  if (fpFormatAware && fpFormatFilters) {
    fpFormatAware.addEventListener('change', () => {
      fpFormatFilters.style.display = fpFormatAware.checked ? '' : 'none';
    });
  }

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
      const wanted = fmtColor.value.toLowerCase();
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
    if (content == null) {
      try {
        content = await Kernel32.ReadAllText(path);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'WordPad', MB_OK);
        return;
      }
    }

    const ext = (path.match(/\.([^.]+)$/) || [])[1] || '';
    const lowerExt = ext.toLowerCase();

    if (lowerExt === 'docx') {
      // DOCX files come as ArrayBuffer from the OS file system
      try {
        let arrayBuf;
        if (content instanceof ArrayBuffer)
          arrayBuf = content;
        else if (typeof content === 'string') {
          // Try base64 decode
          const binary = atob(content);
          arrayBuf = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; ++i)
            arrayBuf[i] = binary.charCodeAt(i);
          arrayBuf = arrayBuf.buffer;
        } else
          arrayBuf = content;

        const html = await DocxEngine.parseDocxDirect(arrayBuf);
        setEditorContent(html);
        currentFileFormat = 'docx';
      } catch (err) {
        // Fallback to mammoth.js
        try {
          const mammothResult = await mammoth.convertToHtml(
            { arrayBuffer: content instanceof ArrayBuffer ? content : new TextEncoder().encode(content).buffer },
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
      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      await Kernel32.WriteFile(path, blob);
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
    // F7 for spell check (no modifier needed)
    if (e.key === 'F7') {
      e.preventDefault();
      handleAction('spell-check');
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
  // Tab Stops with Ruler (Sprint 4)
  // ═══════════════════════════════════════════════════════════════

  const TAB_TYPES = ['left', 'center', 'right', 'decimal'];
  let currentTabTypeIndex = 0;

  function initTabStopRuler() {
    const ruler = document.getElementById('ruler');
    if (!ruler)
      return;

    // Make ruler interactive for tab stops
    ruler.style.position = 'relative';
    ruler.style.cursor = 'crosshair';

    ruler.addEventListener('click', (e) => {
      if (e.target.classList.contains('wp-tab-marker'))
        return;

      const rulerRect = ruler.getBoundingClientRect();
      const clickX = e.clientX - rulerRect.left;
      const positionPercent = (clickX / rulerRect.width) * 100;

      // Get current paragraph
      const sel = window.getSelection();
      if (!sel.rangeCount)
        return;
      let container = sel.focusNode;
      if (container && container.nodeType === 3) container = container.parentElement;
      const block = container ? container.closest('p, div, h1, h2, h3, h4, h5, h6, li') : null;
      if (!block)
        return;

      // Parse existing tab stops
      let tabStops = [];
      try {
        const raw = block.getAttribute('data-tab-stops');
        if (raw) tabStops = JSON.parse(raw);
      } catch (ex) { /* ignore */ }

      // Add new tab stop
      const tabType = TAB_TYPES[currentTabTypeIndex];
      tabStops.push({ position: Math.round(positionPercent * 10) / 10, type: tabType });
      tabStops.sort((a, b) => a.position - b.position);

      block.setAttribute('data-tab-stops', JSON.stringify(tabStops));
      renderTabMarkers(ruler, tabStops);
      markDirty();
    });

    // Update tab markers when selection changes
    editor.addEventListener('click', () => updateTabMarkersForSelection(ruler));
    editor.addEventListener('keyup', () => updateTabMarkersForSelection(ruler));
  }

  function updateTabMarkersForSelection(ruler) {
    const sel = window.getSelection();
    if (!sel.rangeCount) {
      clearTabMarkers(ruler);
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
    renderTabMarkers(ruler, tabStops);
  }

  function clearTabMarkers(ruler) {
    for (const m of ruler.querySelectorAll('.wp-tab-marker'))
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

  function renderTabMarkers(ruler, tabStops) {
    clearTabMarkers(ruler);
    for (const ts of tabStops) {
      const marker = document.createElement('div');
      marker.className = 'wp-tab-marker';
      marker.setAttribute('data-tab-type', ts.type);
      marker.style.left = ts.position + '%';
      marker.title = ts.type.charAt(0).toUpperCase() + ts.type.slice(1) + ' tab at ' + ts.position + '%'
        + (ts.leader && ts.leader !== 'none' ? ' (' + ts.leader + ')' : '');

      // Drag to reposition / drag off ruler to remove
      marker.setAttribute('draggable', 'true');
      marker.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', ts.position + '|' + ts.type);
        e.dataTransfer.effectAllowed = 'move';
      });
      marker.addEventListener('drag', (e) => {
        // Visual feedback while dragging
        if (e.clientY === 0 && e.clientX === 0) return; // Ignore final drag event at 0,0
        const rulerRect = ruler.getBoundingClientRect();
        const isOutsideRuler = e.clientY < rulerRect.top - 20 || e.clientY > rulerRect.bottom + 20;
        marker.style.opacity = isOutsideRuler ? '0.3' : '1';
      });
      marker.addEventListener('dragend', (e) => {
        const rulerRect = ruler.getBoundingClientRect();
        const isOutsideRuler = e.clientY < rulerRect.top - 20 || e.clientY > rulerRect.bottom + 20;
        if (isOutsideRuler) {
          // Remove the tab stop (dragged off ruler)
          const removeIdx = tabStops.findIndex(t => t.position === ts.position && t.type === ts.type);
          if (removeIdx >= 0) tabStops.splice(removeIdx, 1);
          syncTabStopsToBlock(tabStops);
          marker.remove();
        } else {
          // Reposition the tab stop
          const newX = e.clientX - rulerRect.left;
          const newPercent = Math.round(Math.max(0, Math.min(100, (newX / rulerRect.width) * 100)) * 10) / 10;
          ts.position = newPercent;
          tabStops.sort((a, b) => a.position - b.position);
          syncTabStopsToBlock(tabStops);
          renderTabMarkers(ruler, tabStops);
        }
      });

      // Prevent click propagation so ruler click doesn't add a new tab
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      // Double-click to open tab stop properties dialog
      marker.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        showTabStopDialog(ts, tabStops, ruler);
      });

      ruler.appendChild(marker);
    }
  }

  function showTabStopDialog(tabStop, tabStops, ruler) {
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
      renderTabMarkers(ruler, tabStops);
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
    renderTabMarkers(ruler, tabStops);
  }

  // Handle Tab key in editor to use custom tab stops
  editor.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab')
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
  // Module Initialization
  // ═══════════════════════════════════════════════════════════════

  const ctx = { editor, editorWrapper, markDirty, escapeHtml, rgbToHex, User32, Kernel32, ComDlg32, showDialog: SZ.Dialog.show };
  DocxEngine.init(ctx);
  RtfEngine.init(ctx);
  CommentsTracking.init(ctx);
  TocFootnotes.init(ctx);
  ImageTools.init(ctx);
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

  applyPageSetup();
  editor.focus();
})();
