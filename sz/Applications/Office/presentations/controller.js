;(function() {
  'use strict';

  const PresentationsApp = window.PresentationsApp || (window.PresentationsApp = {});
  const { SlideRenderer, SlideshowMode, AnimationEngine, Comments, PresenterView, ChartElement, SmartArtEngine } = PresentationsApp;
  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // ===============================================================
  // Constants
  // ===============================================================

  const MAX_UNDO = 50;
  const GRID_SIZE = 10;
  const SNAP_THRESHOLD = 5;

  const THEMES = [
    { name: 'Office', colors: { bg: '#ffffff', title: '#1f3864', body: '#333333', accent1: '#4472c4', accent2: '#ed7d31' }, fonts: { title: 'Calibri Light', body: 'Calibri' } },
    { name: 'Dark', colors: { bg: '#2d2d2d', title: '#ffffff', body: '#cccccc', accent1: '#4fc3f7', accent2: '#ff8a65' }, fonts: { title: 'Calibri Light', body: 'Calibri' } },
    { name: 'Nature', colors: { bg: '#faf5ef', title: '#2e5a1c', body: '#3e2723', accent1: '#66bb6a', accent2: '#a5d6a7' }, fonts: { title: 'Georgia', body: 'Calibri' } },
    { name: 'Corporate', colors: { bg: '#ffffff', title: '#1a237e', body: '#37474f', accent1: '#283593', accent2: '#5c6bc0' }, fonts: { title: 'Arial', body: 'Arial' } },
    { name: 'Pastel', colors: { bg: '#fce4ec', title: '#ad1457', body: '#666666', accent1: '#f48fb1', accent2: '#ce93d8' }, fonts: { title: 'Calibri Light', body: 'Calibri' } },
    { name: 'Modern', colors: { bg: '#ffffff', title: '#00695c', body: '#333333', accent1: '#26a69a', accent2: '#ff7043' }, fonts: { title: 'Segoe UI', body: 'Segoe UI' } },
    { name: 'Classic', colors: { bg: '#fffff0', title: '#800020', body: '#000000', accent1: '#8b0000', accent2: '#daa520' }, fonts: { title: 'Georgia', body: 'Times New Roman' } },
    { name: 'Vibrant', colors: { bg: '#ffffff', title: '#0277bd', body: '#333333', accent1: '#03a9f4', accent2: '#ff5722' }, fonts: { title: 'Arial Black', body: 'Arial' } },
  ];

  const FILE_FILTERS = [
    { name: 'PowerPoint Presentation', ext: ['pptx'] },
    { name: 'All Files', ext: ['*'] }
  ];

  const ALL_TRANSITIONS = [
    'none', 'fade', 'cut', 'fade-black', 'fade-white', 'dissolve', 'crossfade',
    'push-left', 'push-right', 'push-up', 'push-down',
    'cover-left', 'cover-right', 'cover-up', 'cover-down',
    'uncover-left', 'uncover-right', 'uncover-up', 'uncover-down',
    'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down',
    'split-horizontal-out', 'split-horizontal-in', 'split-vertical-out', 'split-vertical-in',
    'reveal-left', 'reveal-right',
    'circle-in', 'circle-out', 'diamond-in', 'diamond-out',
    'clock-cw', 'clock-ccw', 'wedge',
    'blinds-horizontal', 'blinds-vertical', 'checkerboard',
    'comb-horizontal', 'comb-vertical', 'pixelate', 'bars-random',
    'zoom-in', 'zoom-out', 'zoom-rotate', 'spin-cw', 'spin-ccw',
    'flip-horizontal', 'flip-vertical',
    'cube-left', 'cube-right', 'cube-up', 'cube-down',
    'blur', 'glitch', 'morph',
  ];

  // ===============================================================
  // State
  // ===============================================================

  let presentation = null;
  let currentSlideIndex = 0;
  let selectedElements = new Set();
  let dirty = false;
  let currentFilePath = null;
  let currentFileName = 'Untitled';
  let undoStack = [];
  let redoStack = [];
  let currentView = 'normal';
  let clipboardElements = [];
  let currentZoom = 100;

  // Feature 3: Snap-to-Grid
  let snapToGrid = true;

  // Feature 5: Format Painter (uses SZ.FormatPainter)
  let presFormatPainter = null;

  // Feature 10: Spell Check
  let spellCheckEnabled = true;

  // Feature 11-13: Animation
  let animationPaneVisible = false;
  let selectedAnimationId = null;

  // Feature 15: Rulers
  let rulersVisible = false;
  let guideLines = { horizontal: [], vertical: [] };

  // Feature 16: Sections
  // presentation.sections managed within presentation object

  // Feature 18: Custom Shows
  // presentation.customShows managed within presentation object

  // Feature 19: Rehearsal
  let rehearsalActive = false;
  let rehearsalStartTime = 0;
  let rehearsalTimings = [];

  // Feature 22: Master Slide Editing
  let masterViewActive = false;

  // Feature 27: Connector mode
  let connectorMode = false;
  let connectorStartElId = null;

  // Double-click detection for text editing
  let _lastPointerDownElId = null;
  let _lastPointerDownTime = 0;

  // ===============================================================
  // DOM References
  // ===============================================================

  let slidePanel, slideThumbs, slideCanvas, editorArea, canvasViewport;
  let notesEditor, slideCountEl, zoomStatusEl;
  let slideSorterEl;

  // ===============================================================
  // Data Model
  // ===============================================================

  function createNewPresentation() {
    return {
      slides: [createNewSlide('title', 0)],
      theme: THEMES[0],
      slideWidth: 960,
      slideHeight: 540,
      metadata: { title: '', author: '', created: new Date().toISOString(), modified: null },
      headerFooter: { showDate: false, dateText: '', showFooter: false, footerText: '', showSlideNumber: false, dontShowOnTitle: true },
      sections: [],
      customShows: [],
      slideMasters: [{ name: 'Default', background: null, elements: [], layouts: [] }]
    };
  }

  function createNewSlide(layout, index) {
    const slide = {
      id: 'slide-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      layout: layout || 'blank',
      background: null,
      transition: { type: 'fade', duration: 0.5 },
      elements: [],
      notes: ''
    };
    const placeholders = SlideRenderer.getLayoutPlaceholders(layout);
    for (const ph of placeholders)
      slide.elements.push(SlideRenderer.createTextbox(ph.x, ph.y, ph.w, ph.h, ph.placeholder || ''));
    return slide;
  }

  function getCurrentSlide() {
    if (!presentation || !presentation.slides.length)
      return null;
    return presentation.slides[currentSlideIndex] || null;
  }

  // ===============================================================
  // Title & Dirty Tracking
  // ===============================================================

  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - Presentations';
    document.title = title;
    User32.SetWindowText(title);
  }

  function markDirty() {
    if (!dirty) {
      dirty = true;
      updateTitle();
    }
  }

  function clearDirty() {
    dirty = false;
    updateTitle();
  }

  // ===============================================================
  // Undo / Redo
  // ===============================================================

  function pushUndo() {
    const snapshot = JSON.parse(JSON.stringify(presentation.slides));
    undoStack.push({ slides: snapshot, index: currentSlideIndex });
    if (undoStack.length > MAX_UNDO)
      undoStack.shift();
    redoStack = [];
  }

  function doUndo() {
    if (!undoStack.length)
      return;
    const snapshot = JSON.parse(JSON.stringify(presentation.slides));
    redoStack.push({ slides: snapshot, index: currentSlideIndex });
    const state = undoStack.pop();
    presentation.slides = state.slides;
    currentSlideIndex = Math.min(state.index, presentation.slides.length - 1);
    selectedElements.clear();
    refreshUI();
    markDirty();
  }

  function doRedo() {
    if (!redoStack.length)
      return;
    const snapshot = JSON.parse(JSON.stringify(presentation.slides));
    undoStack.push({ slides: snapshot, index: currentSlideIndex });
    const state = redoStack.pop();
    presentation.slides = state.slides;
    currentSlideIndex = Math.min(state.index, presentation.slides.length - 1);
    selectedElements.clear();
    refreshUI();
    markDirty();
  }

  // ===============================================================
  // Action Router
  // ===============================================================

  function handleAction(action) {
    // Theme application via 'apply-theme-N'
    if (action.startsWith('apply-theme-')) {
      const idx = parseInt(action.slice('apply-theme-'.length), 10);
      if (!isNaN(idx))
        applyTheme(idx);
      return;
    }

    // Transition setting via 'set-transition-TYPE'
    if (action.startsWith('set-transition-')) {
      const type = action.slice('set-transition-'.length);
      setTransition(type);
      return;
    }

    // Animation preset via 'anim-EFFECT'
    if (action.startsWith('anim-') && action !== 'anim-trigger' && action !== 'anim-duration') {
      const effect = action.slice('anim-'.length);
      if (AnimationEngine && AnimationEngine.PRESETS[effect]) {
        addAnimationToSelected(effect);
        return;
      }
    }

    switch (action) {
      // File
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'export-png': doExportPng(); break;
      case 'export-pdf': doExportPdf(); break;
      case 'print': window.print(); break;
      case 'exit': doExit(); break;
      case 'about':
        User32.MessageBox('Presentations\n\nA presentation editor for SZ Desktop.\n\nCreate, edit, and present slide decks.', 'About Presentations', MB_OK);
        break;

      // Slides
      case 'new-slide': addSlide('title-content'); break;
      case 'new-slide-blank': addSlide('blank'); break;
      case 'new-slide-title': addSlide('title'); break;
      case 'new-slide-section': addSlide('section'); break;
      case 'new-slide-two-content': addSlide('two-content'); break;
      case 'new-slide-comparison': addSlide('comparison'); break;
      case 'duplicate-slide': duplicateSlide(); break;
      case 'delete-slide': deleteSlide(); break;
      case 'move-slide-up': moveSlide(-1); break;
      case 'move-slide-down': moveSlide(1); break;

      // Edit
      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'cut': doCut(); break;
      case 'copy': doCopy(); break;
      case 'paste': doPaste(); break;
      case 'delete-element': deleteSelectedElements(); break;
      case 'select-all': selectAllElements(); break;

      // Insert
      case 'insert-textbox': insertTextbox(); break;
      case 'insert-image': insertImage(); break;
      case 'insert-shape-rect': insertShape('rect'); break;
      case 'insert-shape-ellipse': insertShape('ellipse'); break;
      case 'insert-shape-rounded-rect': insertShape('rounded-rect'); break;
      case 'insert-shape-triangle': insertShape('triangle'); break;
      case 'insert-shape-arrow-right': insertShape('arrow-right'); break;
      case 'insert-shape-arrow-left': insertShape('arrow-left'); break;
      case 'insert-shape-star': insertShape('star'); break;
      case 'insert-shape-diamond': insertShape('diamond'); break;
      case 'insert-shape-pentagon': insertShape('pentagon'); break;
      case 'insert-shape-hexagon': insertShape('hexagon'); break;
      case 'insert-shape-callout': insertShape('callout'); break;
      case 'insert-table': showInsertTableDialog(); break;
      case 'insert-hyperlink': showHyperlinkDialog(); break;
      case 'remove-hyperlink': removeHyperlink(); break;

      // Format
      case 'bold': toggleBold(); break;
      case 'italic': toggleItalic(); break;
      case 'underline': toggleUnderline(); break;

      // Z-order
      case 'bring-front': changeZOrder('front'); break;
      case 'send-back': changeZOrder('back'); break;
      case 'bring-forward': changeZOrder('forward'); break;
      case 'send-backward': changeZOrder('backward'); break;

      // Feature 2: Alignment & Distribution
      case 'elem-align-left': alignElements('left'); break;
      case 'elem-align-center': alignElements('center'); break;
      case 'elem-align-right': alignElements('right'); break;
      case 'elem-align-top': alignElements('top'); break;
      case 'elem-align-middle': alignElements('middle'); break;
      case 'elem-align-bottom': alignElements('bottom'); break;
      case 'distribute-h': distributeElements('horizontal'); break;
      case 'distribute-v': distributeElements('vertical'); break;

      // Feature 3: Snap-to-Grid
      case 'toggle-snap': toggleSnapToGrid(); break;

      // Feature 5: Format Painter
      case 'format-painter': presFormatPainter && presFormatPainter.isActive ? deactivateFormatPainter() : activateFormatPainter(); break;

      // Feature 6: Find & Replace
      case 'find-replace': showFindReplaceDialog(); break;

      // Feature 7: Element Grouping
      case 'group': groupSelectedElements(); break;
      case 'ungroup': ungroupSelectedElement(); break;

      // Feature 8: Hyperlinks (also handled via 'insert-hyperlink' above)

      // Feature 9: Slide Numbering & Footer
      case 'header-footer': showHeaderFooterDialog(); break;

      // Feature 10: Spell Check
      case 'spell-check': runSpellCheckOnSlide(); break;

      // Feature 11-13: Animations
      case 'toggle-animation-pane': toggleAnimationPane(); break;
      case 'remove-animation': removeSelectedAnimation(); break;
      case 'preview-animation': previewCurrentSlideAnimations(); break;
      case 'anim-trigger': updateSelectedAnimationTrigger(); break;
      case 'anim-duration': updateSelectedAnimationDuration(); break;

      // Feature 14: Comments
      case 'add-comment': doAddComment(); break;
      case 'toggle-comments-panel': doToggleCommentsPanel(); break;

      // Feature 15: Rulers
      case 'toggle-rulers': toggleRulers(); break;

      // Feature 16: Sections
      case 'add-section': addSection(); break;
      case 'rename-section': renameSection(); break;
      case 'remove-section': removeSection(); break;

      // Feature 17: Presenter View
      case 'presenter-view': startPresenterView(); break;

      // Feature 18: Custom Shows
      case 'custom-shows': showCustomShowsDialog(); break;

      // Feature 19: Rehearsal Timings
      case 'rehearse-timings': startRehearsalTimings(); break;

      // Feature 20: Action Buttons
      case 'insert-action-button': showInsertActionButtonDialog(); break;

      // Feature 21: Video/Audio
      case 'insert-video': insertVideo(); break;
      case 'insert-audio': insertAudio(); break;

      // Feature 22: Master Slide Editing
      case 'edit-master': toggleMasterView(); break;

      // Feature 23: Charts
      case 'insert-chart': showInsertChartDialog(); break;

      // Feature 24: Element Shadow & 3D
      case 'element-shadow': toggleElementShadow(); break;
      case 'element-3d': showElement3dDialog(); break;

      // Feature 25: Advanced Shape Fills (handled through format panel)

      // Feature 26: Text Effects
      case 'text-shadow': applyTextShadow(); break;
      case 'text-glow': applyTextGlow(); break;
      case 'text-reflection': applyTextReflection(); break;
      case 'text-3d': applyText3d(); break;

      // Feature 27: Connector Lines
      case 'insert-connector': startConnectorMode(); break;

      // Feature 29: SmartArt
      case 'insert-smartart': showInsertSmartArtDialog(); break;

      // Feature 30: Photo Album
      case 'photo-album': showPhotoAlbumDialog(); break;

      // Text alignment (original - for textbox text alignment)
      case 'align-left': setTextAlignment('left'); break;
      case 'align-center': setTextAlignment('center'); break;
      case 'align-right': setTextAlignment('right'); break;

      // Table Design (contextual tab)
      case 'table-style-default': applyTableStyle('default'); break;
      case 'table-style-banded-blue': applyTableStyle('banded-blue'); break;
      case 'table-style-banded-green': applyTableStyle('banded-green'); break;
      case 'table-style-dark': applyTableStyle('dark'); break;
      case 'table-style-minimal': applyTableStyle('minimal'); break;
      case 'table-style-accent-orange': applyTableStyle('accent-orange'); break;
      case 'table-style-header-only': applyTableStyle('header-only'); break;
      case 'table-style-no-banding': applyTableStyle('no-banding'); break;
      case 'table-borders': showTableBorderPicker(); break;

      // Shape Format Panel
      case 'toggle-format-panel': toggleShapeFormatPanel(); break;

      // Alt Text
      case 'edit-alt-text': showAltTextDialog(); break;

      // Design
      case 'format-background': showFormatBackgroundDialog(); break;

      // Transitions
      case 'apply-transition-all': applyTransitionToAll(); break;
      case 'preview-transition': previewTransition(); break;

      // Slideshow
      case 'slideshow-start': startSlideshow(0); break;
      case 'slideshow-current': startSlideshow(currentSlideIndex); break;

      // View
      case 'view-normal': setView('normal'); break;
      case 'view-sorter': setView('sorter'); break;
      case 'view-notes': setView('notes'); break;
      case 'zoom-fit': zoomFit(); break;

      // Layout, Shapes dropdowns & list formatting
      case 'show-layout-dropdown': showLayoutDropdown(); break;
      case 'show-shapes-dropdown': showShapesDropdown(); break;
      case 'bullets': toggleBullets(); break;
      case 'numbering': toggleNumbering(); break;
    }
  }

  // ===============================================================
  // Slide Management
  // ===============================================================

  function addSlide(layout) {
    pushUndo();
    const slide = createNewSlide(layout, presentation.slides.length);
    presentation.slides.splice(currentSlideIndex + 1, 0, slide);
    currentSlideIndex = currentSlideIndex + 1;
    selectedElements.clear();
    refreshUI();
    markDirty();
  }

  function duplicateSlide() {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    pushUndo();
    const clone = JSON.parse(JSON.stringify(slide));
    clone.id = 'slide-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    for (const el of clone.elements)
      el.id = 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    presentation.slides.splice(currentSlideIndex + 1, 0, clone);
    currentSlideIndex = currentSlideIndex + 1;
    selectedElements.clear();
    refreshUI();
    markDirty();
  }

  function deleteSlide() {
    if (presentation.slides.length <= 1) {
      User32.MessageBox('Cannot delete the last slide.', 'Presentations', MB_OK);
      return;
    }
    pushUndo();
    presentation.slides.splice(currentSlideIndex, 1);
    if (currentSlideIndex >= presentation.slides.length)
      currentSlideIndex = presentation.slides.length - 1;
    selectedElements.clear();
    refreshUI();
    markDirty();
  }

  function moveSlide(direction) {
    const newIndex = currentSlideIndex + direction;
    if (newIndex < 0 || newIndex >= presentation.slides.length)
      return;
    pushUndo();
    const slide = presentation.slides.splice(currentSlideIndex, 1)[0];
    presentation.slides.splice(newIndex, 0, slide);
    currentSlideIndex = newIndex;
    refreshUI();
    markDirty();
  }

  function selectSlide(index) {
    if (index < 0 || index >= presentation.slides.length)
      return;
    currentSlideIndex = index;
    selectedElements.clear();
    selectedAnimationId = null;
    refreshSlidePanel();
    renderMainCanvas();
    updateNotesEditor();
    updateStatusBar();
    refreshAnimationPane();
    updateTransitionGalleryActive();
    if (Comments && Comments.isPanelVisible())
      Comments.refreshCommentsPanel(currentSlideIndex);
  }

  // ===============================================================
  // Slide Panel
  // ===============================================================

  let contextMenuEl = null;

  function refreshSlidePanel() {
    slideThumbs.innerHTML = '';

    // Track which sections have been rendered
    const sections = presentation.sections || [];
    let sectionIdx = 0;

    for (let i = 0; i < presentation.slides.length; ++i) {
      // Feature 16: Insert section header if this slide starts a section
      while (sectionIdx < sections.length && sections[sectionIdx].firstSlideIndex === i) {
        const section = sections[sectionIdx];
        const header = document.createElement('div');
        header.className = 'section-header' + (section.collapsed ? ' collapsed' : '');

        const collapseIcon = document.createElement('span');
        collapseIcon.className = 'collapse-icon';
        collapseIcon.textContent = '\u25BC';
        header.appendChild(collapseIcon);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = section.name || 'Untitled Section';
        header.appendChild(nameSpan);

        const capturedSection = section;
        header.addEventListener('click', () => {
          capturedSection.collapsed = !capturedSection.collapsed;
          refreshSlidePanel();
        });

        slideThumbs.appendChild(header);
        ++sectionIdx;
      }

      // Check if the slide is in a collapsed section
      const owningSection = _findSectionForSlide(i);
      if (owningSection && owningSection.collapsed)
        continue;

      const slide = presentation.slides[i];
      const thumb = document.createElement('div');
      thumb.className = 'slide-thumb' + (i === currentSlideIndex ? ' active' : '');
      thumb.dataset.index = i;

      const number = document.createElement('span');
      number.className = 'slide-thumb-number';
      number.textContent = (i + 1);
      thumb.appendChild(number);

      const content = document.createElement('div');
      content.className = 'slide-thumb-content';
      thumb.appendChild(content);

      // Render thumbnail after DOM attach
      setTimeout(() => {
        SlideRenderer.renderThumbnail(slide, content, presentation.theme);
      }, 0);

      thumb.addEventListener('click', () => selectSlide(i));
      thumb.addEventListener('contextmenu', (e) => showSlideContextMenu(e, i));

      // Drag reorder
      thumb.draggable = true;
      thumb.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(i));
        e.dataTransfer.effectAllowed = 'move';
      });
      thumb.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        thumb.classList.add('drag-over');
      });
      thumb.addEventListener('dragleave', () => {
        thumb.classList.remove('drag-over');
      });
      thumb.addEventListener('drop', (e) => {
        e.preventDefault();
        thumb.classList.remove('drag-over');
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIndex = i;
        if (isNaN(fromIndex) || fromIndex === toIndex)
          return;
        pushUndo();
        const movedSlide = presentation.slides.splice(fromIndex, 1)[0];
        presentation.slides.splice(toIndex, 0, movedSlide);
        currentSlideIndex = toIndex;
        refreshUI();
        markDirty();
      });

      slideThumbs.appendChild(thumb);
    }
  }

  function showSlideContextMenu(e, index) {
    e.preventDefault();
    removeContextMenu();

    currentSlideIndex = index;
    refreshSlidePanel();
    renderMainCanvas();

    const menu = document.createElement('div');
    menu.className = 'slide-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const items = [
      { label: 'New Slide', action: () => addSlide('title-content') },
      { label: 'Duplicate Slide', action: () => duplicateSlide() },
      { label: 'Delete Slide', action: () => deleteSlide() },
      { sep: true },
      { label: 'Move Up', action: () => moveSlide(-1) },
      { label: 'Move Down', action: () => moveSlide(1) },
    ];

    for (const item of items) {
      if (item.sep) {
        const sep = document.createElement('div');
        sep.className = 'ctx-sep';
        menu.appendChild(sep);
        continue;
      }
      const btn = document.createElement('button');
      btn.className = 'ctx-item';
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        removeContextMenu();
        item.action();
      });
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    contextMenuEl = menu;

    // Close on outside click
    const closeHandler = (ev) => {
      if (!menu.contains(ev.target)) {
        removeContextMenu();
        document.removeEventListener('pointerdown', closeHandler, true);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler, true), 0);
  }

  function removeContextMenu() {
    if (contextMenuEl && contextMenuEl.parentNode) {
      contextMenuEl.parentNode.removeChild(contextMenuEl);
      contextMenuEl = null;
    }
  }

  // ===============================================================
  // Layout / Shapes Dropdowns & List Formatting
  // ===============================================================

  function showDropdownMenu(anchorAction, items) {
    removeContextMenu();
    const anchor = document.querySelector('[data-action="' + anchorAction + '"]');
    const rect = anchor ? anchor.getBoundingClientRect() : { left: 100, bottom: 100 };
    const menu = document.createElement('div');
    menu.className = 'slide-context-menu';
    menu.style.left = rect.left + 'px';
    menu.style.top = rect.bottom + 'px';
    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'ctx-item';
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        removeContextMenu();
        item.action();
      });
      menu.appendChild(btn);
    }
    document.body.appendChild(menu);
    contextMenuEl = menu;
    const closeHandler = (ev) => {
      if (!menu.contains(ev.target)) {
        removeContextMenu();
        document.removeEventListener('pointerdown', closeHandler, true);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler, true), 0);
  }

  function showLayoutDropdown() {
    const layouts = [
      { label: 'Title Slide', type: 'title' },
      { label: 'Title + Content', type: 'title-content' },
      { label: 'Section Header', type: 'section' },
      { label: 'Two Content', type: 'two-content' },
      { label: 'Comparison', type: 'comparison' },
      { label: 'Blank', type: 'blank' },
    ];
    showDropdownMenu('show-layout-dropdown', layouts.map(l => ({
      label: l.label,
      action: () => changeSlideLayout(l.type),
    })));
  }

  function changeSlideLayout(type) {
    const slide = getCurrentSlide();
    if (!slide) return;
    pushUndo();
    slide.layout = type;
    slide.elements = [];
    const placeholders = SlideRenderer.getLayoutPlaceholders(type);
    for (const ph of placeholders)
      slide.elements.push(SlideRenderer.createTextbox(ph.x, ph.y, ph.w, ph.h, ph.placeholder || ''));
    selectedElements.clear();
    renderMainCanvas();
    refreshSlidePanel();
    markDirty();
  }

  function showShapesDropdown() {
    const shapes = [
      { label: 'Rectangle', type: 'rect' },
      { label: 'Ellipse', type: 'ellipse' },
      { label: 'Rounded Rectangle', type: 'rounded-rect' },
      { label: 'Triangle', type: 'triangle' },
      { label: 'Arrow Right', type: 'arrow-right' },
      { label: 'Arrow Left', type: 'arrow-left' },
      { label: 'Star', type: 'star' },
      { label: 'Diamond', type: 'diamond' },
      { label: 'Pentagon', type: 'pentagon' },
      { label: 'Hexagon', type: 'hexagon' },
      { label: 'Callout', type: 'callout' },
    ];
    showDropdownMenu('show-shapes-dropdown', shapes.map(s => ({
      label: s.label,
      action: () => handleAction('insert-shape-' + s.type),
    })));
  }

  function toggleBullets() {
    const focused = slideCanvas.querySelector('[contenteditable]:focus');
    if (focused)
      document.execCommand('insertUnorderedList');
  }

  function toggleNumbering() {
    const focused = slideCanvas.querySelector('[contenteditable]:focus');
    if (focused)
      document.execCommand('insertOrderedList');
  }

  // ===============================================================
  // Canvas Rendering & Editing
  // ===============================================================

  function renderMainCanvas() {
    const slide = getCurrentSlide();
    if (!slide) {
      slideCanvas.innerHTML = '';
      return;
    }

    const scale = currentZoom / 100;
    SlideRenderer.renderSlide(slide, slideCanvas, {
      editable: true,
      scale: scale,
      showGuides: true,
      headerFooter: presentation.headerFooter,
      slideIndex: currentSlideIndex
    });

    // Feature 14: Render comment markers
    if (Comments && slide.comments && slide.comments.length) {
      const canvas = slideCanvas.querySelector('.slide-canvas');
      if (canvas)
        Comments.renderCommentMarkers(canvas, slide);
    }

    // Feature 15: Render rulers
    renderRulers();

    wireCanvasElements();

    // Update contextual UI
    updateTableDesignTab();
    if (formatPanelVisible)
      syncShapeFormatPanel();
  }

  function wireCanvasElements() {
    const elements = slideCanvas.querySelectorAll('.slide-element');
    for (const domEl of elements) {
      const elId = domEl.dataset.elementId;

      // Show selection state
      if (selectedElements.has(elId)) {
        domEl.classList.add('selected');
        SlideRenderer.renderResizeHandles(domEl);
      }

      domEl.addEventListener('pointerdown', (e) => handleElementPointerDown(e, domEl, elId));
      domEl.addEventListener('dblclick', (e) => handleElementDblClick(e, domEl, elId));

      // Content syncing for editable elements (textboxes and table cells)
      {
        const slide = getCurrentSlide();
        const element = slide ? slide.elements.find(el => el.id === elId) : null;
        if (element && element.type === 'textbox') {
          const inner = domEl.querySelector('[contenteditable]');
          if (inner) {
            inner.addEventListener('input', () => {
              // Once the user types, the content is real (not placeholder)
              domEl.classList.remove('placeholder-empty');
              element.content = inner.innerHTML;
              markDirty();
            });
            inner.addEventListener('blur', () => {
              // Save the content; if empty and has placeholder, restore placeholder state
              const text = inner.textContent.trim();
              if (!text && element.placeholder) {
                element.content = '';
                domEl.classList.add('placeholder-empty');
                inner.innerHTML = element.placeholder;
                inner.style.color = '#999';
              }
              pushUndo();
              refreshSlidePanel();
            });
            inner.addEventListener('focus', () => {
              // If showing placeholder text, clear it on focus
              if (domEl.classList.contains('placeholder-empty') && element.placeholder) {
                domEl.classList.remove('placeholder-empty');
                inner.innerHTML = '';
                inner.style.color = element.color || '#000000';
              }
            });
          }
        }
        if (element && element.type === 'table') {
          const cells = domEl.querySelectorAll('[contenteditable]');
          for (const cell of cells) {
            cell.addEventListener('input', () => {
              const r = parseInt(cell.dataset.row, 10);
              const c = parseInt(cell.dataset.col, 10);
              if (element.cells && element.cells[r])
                element.cells[r][c] = cell.textContent;
              markDirty();
            });
          }
        }
      }

      // Feature 10: Spell check context menu + element context menu
      domEl.addEventListener('contextmenu', (e) => {
        const slide = getCurrentSlide();
        if (!slide)
          return;
        const element = slide.elements.find(el => el.id === elId);
        if (!element)
          return;

        // Spell check for textboxes
        if (element.type === 'textbox' && PresentationsApp.SpellCheck) {
          const handled = PresentationsApp.SpellCheck.showContextMenu(e, domEl, element, () => {
            const inner = domEl.querySelector('[contenteditable]');
            if (inner && element)
              element.content = inner.innerHTML;
            markDirty();
          });
          if (handled)
            return;
        }

        // General element context menu
        e.preventDefault();
        removeContextMenu();
        selectedElements.clear();
        selectedElements.add(elId);
        renderMainCanvas();

        const menu = document.createElement('div');
        menu.className = 'slide-context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';

        const items = [];
        if (element.type === 'image')
          items.push({ label: 'Edit Alt Text...', action: () => showAltTextDialog() }, { sep: true });
        items.push(
          { label: 'Cut', action: () => doCut() },
          { label: 'Copy', action: () => doCopy() },
          { label: 'Paste', action: () => doPaste() },
          { label: 'Duplicate', action: () => duplicateSelectedElements() },
          { sep: true },
          { label: 'Delete', action: () => deleteSelectedElements() },
          { sep: true },
          { label: 'Bring to Front', action: () => changeZOrder('front') },
          { label: 'Send to Back', action: () => changeZOrder('back') }
        );

        for (const item of items) {
          if (item.sep) {
            const sep = document.createElement('div');
            sep.className = 'ctx-sep';
            menu.appendChild(sep);
            continue;
          }
          const btn = document.createElement('button');
          btn.className = 'ctx-item';
          btn.textContent = item.label;
          btn.addEventListener('click', () => {
            removeContextMenu();
            item.action();
          });
          menu.appendChild(btn);
        }

        document.body.appendChild(menu);
        contextMenuEl = menu;

        const closeHandler = (ev) => {
          if (!menu.contains(ev.target)) {
            removeContextMenu();
            document.removeEventListener('pointerdown', closeHandler, true);
          }
        };
        setTimeout(() => document.addEventListener('pointerdown', closeHandler, true), 0);
      });
    }

    // Click on canvas background to deselect
    const canvasInner = slideCanvas.querySelector('.slide-canvas');
    if (canvasInner) {
      canvasInner.addEventListener('pointerdown', (e) => {
        if (e.target === canvasInner || e.target.classList.contains('slide-guides')) {
          selectedElements.clear();
          deactivateFormatPainter();
          renderMainCanvas();
          updateTableDesignTab();
          if (formatPanelVisible && selectedElements.size === 0)
            hideShapeFormatPanel();
        }
      });
    }
  }

  function handleElementPointerDown(e, domEl, elId) {
    e.stopPropagation();

    // If clicking inside an already-focused contenteditable, let the browser handle it
    const activeEl = document.activeElement;
    if (activeEl && activeEl.contentEditable === 'true' && domEl.contains(activeEl) && (activeEl === e.target || activeEl.contains(e.target)))
      return;

    // Detect double-click (two pointerdowns on same element within 400ms)
    const now = Date.now();
    const isDoubleClick = (elId === _lastPointerDownElId && now - _lastPointerDownTime < 400);
    _lastPointerDownElId = elId;
    _lastPointerDownTime = now;

    // Feature 27: Connector mode
    if (connectorMode) {
      _handleConnectorClick(elId);
      return;
    }

    // Check for rotation handle (Feature 1)
    const rotHandle = e.target.closest('.rotation-handle');
    if (rotHandle) {
      handleRotation(elId, e);
      return;
    }

    // Check for resize handle
    const handle = e.target.closest('.resize-handle');
    if (handle) {
      handleResize(elId, handle.dataset.handle, e);
      return;
    }

    // Feature 5: Format Painter -- apply on click
    if (presFormatPainter && presFormatPainter.isActive) {
      applyFormatPainterTo(elId);
      return;
    }

    // Double-click: enter edit mode for textboxes/tables
    if (isDoubleClick) {
      const slide = getCurrentSlide();
      if (slide) {
        const element = slide.elements.find(el => el.id === elId);
        if (element && (element.type === 'textbox' || element.type === 'table')) {
          const currentDomEl = slideCanvas.querySelector(`.slide-element[data-element-id="${elId}"]`);
          const inner = currentDomEl ? currentDomEl.querySelector('[contenteditable]') : null;
          if (inner) {
            inner.focus();
            // Place cursor at click position using caretPositionFromPoint/caretRangeFromPoint
            try {
              let range = null;
              if (document.caretRangeFromPoint)
                range = document.caretRangeFromPoint(e.clientX, e.clientY);
              else if (document.caretPositionFromPoint) {
                const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                if (pos) {
                  range = document.createRange();
                  range.setStart(pos.offsetNode, pos.offset);
                  range.collapse(true);
                }
              }
              if (range) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
              }
            } catch (_) { /* cursor placement is best-effort */ }
            return;
          }
        }
        if (element && element.type === 'chart' && ChartElement) {
          ChartElement.showChartDataEditor(element, () => {
            pushUndo();
            markDirty();
            renderMainCanvas();
          });
          return;
        }
        if (element && element.type === 'connector') {
          showConnectorPropertiesDialog(element.id);
          return;
        }
        if (element && element.type === 'smartart') {
          showSmartArtNodeEditor(element);
          return;
        }
      }
    }

    // Selection
    if (e.shiftKey) {
      if (selectedElements.has(elId))
        selectedElements.delete(elId);
      else
        selectedElements.add(elId);
    } else {
      if (!selectedElements.has(elId)) {
        selectedElements.clear();
        selectedElements.add(elId);
      }
    }

    renderMainCanvas();

    // Start drag
    handleElementDrag(elId, e);
  }

  function handleElementDblClick(e, domEl, elId) {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    const element = slide.elements.find(el => el.id === elId);
    if (!element)
      return;

    if (element.type === 'textbox') {
      // Look up current DOM element (the passed domEl may be stale after re-render)
      const currentDomEl = slideCanvas.querySelector(`.slide-element[data-element-id="${elId}"]`) || domEl;
      const inner = currentDomEl.querySelector('[contenteditable]');
      if (inner) {
        inner.focus();
        // Place cursor at double-click position
        try {
          let range = null;
          if (document.caretRangeFromPoint)
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
          else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            if (pos) {
              range = document.createRange();
              range.setStart(pos.offsetNode, pos.offset);
              range.collapse(true);
            }
          }
          if (range) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch (_) { /* cursor placement is best-effort */ }
      }
    } else if (element.type === 'chart' && ChartElement) {
      // Open chart data editor
      ChartElement.showChartDataEditor(element, () => {
        pushUndo();
        markDirty();
        renderMainCanvas();
      });
    } else if (element.type === 'connector') {
      // Open connector properties dialog
      showConnectorPropertiesDialog(element.id);
    } else if (element.type === 'smartart') {
      // Open SmartArt node editor
      showSmartArtNodeEditor(element);
    }
  }

  // ---------------------------------------------------------------
  // Feature 4: Smart Guides
  // ---------------------------------------------------------------

  function clearSmartGuides() {
    const canvas = slideCanvas.querySelector('.slide-canvas');
    if (!canvas)
      return;
    const guides = canvas.querySelectorAll('.smart-guide');
    for (const g of guides)
      g.parentNode.removeChild(g);
  }

  function showSmartGuides(draggedEl, slide) {
    clearSmartGuides();
    const canvas = slideCanvas.querySelector('.slide-canvas');
    if (!canvas)
      return { snapX: null, snapY: null };

    const dLeft = draggedEl.x;
    const dCenterX = draggedEl.x + draggedEl.w / 2;
    const dRight = draggedEl.x + draggedEl.w;
    const dTop = draggedEl.y;
    const dCenterY = draggedEl.y + draggedEl.h / 2;
    const dBottom = draggedEl.y + draggedEl.h;

    let snapX = null;
    let snapY = null;

    const guidesH = new Set();
    const guidesV = new Set();

    // Check slide center
    const slideCX = SlideRenderer.CANVAS_W / 2;
    const slideCY = SlideRenderer.CANVAS_H / 2;

    if (Math.abs(dCenterX - slideCX) < SNAP_THRESHOLD) {
      guidesV.add(slideCX);
      snapX = slideCX - draggedEl.w / 2;
    }
    if (Math.abs(dCenterY - slideCY) < SNAP_THRESHOLD) {
      guidesH.add(slideCY);
      snapY = slideCY - draggedEl.h / 2;
    }

    // Check against other elements
    for (const other of slide.elements) {
      if (other.id === draggedEl.id)
        continue;
      if (selectedElements.has(other.id))
        continue;

      const oLeft = other.x;
      const oCenterX = other.x + other.w / 2;
      const oRight = other.x + other.w;
      const oTop = other.y;
      const oCenterY = other.y + other.h / 2;
      const oBottom = other.y + other.h;

      // Vertical alignment checks (snap X)
      const vChecks = [
        { d: dLeft, o: oLeft, snap: oLeft },
        { d: dLeft, o: oCenterX, snap: oCenterX },
        { d: dLeft, o: oRight, snap: oRight },
        { d: dCenterX, o: oLeft, snap: oLeft - draggedEl.w / 2 },
        { d: dCenterX, o: oCenterX, snap: oCenterX - draggedEl.w / 2 },
        { d: dCenterX, o: oRight, snap: oRight - draggedEl.w / 2 },
        { d: dRight, o: oLeft, snap: oLeft - draggedEl.w },
        { d: dRight, o: oCenterX, snap: oCenterX - draggedEl.w },
        { d: dRight, o: oRight, snap: oRight - draggedEl.w },
      ];
      for (const vc of vChecks) {
        if (Math.abs(vc.d - vc.o) < SNAP_THRESHOLD) {
          guidesV.add(vc.o);
          if (snapX === null)
            snapX = vc.snap;
        }
      }

      // Horizontal alignment checks (snap Y)
      const hChecks = [
        { d: dTop, o: oTop, snap: oTop },
        { d: dTop, o: oCenterY, snap: oCenterY },
        { d: dTop, o: oBottom, snap: oBottom },
        { d: dCenterY, o: oTop, snap: oTop - draggedEl.h / 2 },
        { d: dCenterY, o: oCenterY, snap: oCenterY - draggedEl.h / 2 },
        { d: dCenterY, o: oBottom, snap: oBottom - draggedEl.h / 2 },
        { d: dBottom, o: oTop, snap: oTop - draggedEl.h },
        { d: dBottom, o: oCenterY, snap: oCenterY - draggedEl.h },
        { d: dBottom, o: oBottom, snap: oBottom - draggedEl.h },
      ];
      for (const hc of hChecks) {
        if (Math.abs(hc.d - hc.o) < SNAP_THRESHOLD) {
          guidesH.add(hc.o);
          if (snapY === null)
            snapY = hc.snap;
        }
      }
    }

    // Render guide lines
    for (const gy of guidesH) {
      const line = document.createElement('div');
      line.className = 'smart-guide smart-guide-h';
      line.style.top = gy + 'px';
      canvas.appendChild(line);
    }
    for (const gx of guidesV) {
      const line = document.createElement('div');
      line.className = 'smart-guide smart-guide-v';
      line.style.left = gx + 'px';
      canvas.appendChild(line);
    }

    return { snapX, snapY };
  }

  // ---------------------------------------------------------------
  // Element drag with snap-to-grid and smart guides
  // ---------------------------------------------------------------

  function handleElementDrag(elId, startEvent) {
    const slide = getCurrentSlide();
    if (!slide)
      return;

    const scale = currentZoom / 100;
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;

    // Collect original positions for all selected elements
    const originals = [];
    for (const selId of selectedElements) {
      const el = slide.elements.find(e => e.id === selId);
      if (el)
        originals.push({ el, origX: el.x, origY: el.y });
    }

    if (!originals.length)
      return;

    const target = startEvent.currentTarget;
    target.setPointerCapture(startEvent.pointerId);

    const onMove = (e) => {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;

      for (const o of originals) {
        o.el.x = Math.round(o.origX + dx);
        o.el.y = Math.round(o.origY + dy);
      }

      // Feature 3: Snap-to-Grid
      if (snapToGrid && !e.altKey) {
        for (const o of originals) {
          o.el.x = Math.round(o.el.x / GRID_SIZE) * GRID_SIZE;
          o.el.y = Math.round(o.el.y / GRID_SIZE) * GRID_SIZE;
        }
      }

      // Feature 4: Smart Guides (only for single element drag)
      if (originals.length === 1) {
        const { snapX, snapY } = showSmartGuides(originals[0].el, slide);
        if (snapX !== null)
          originals[0].el.x = Math.round(snapX);
        if (snapY !== null)
          originals[0].el.y = Math.round(snapY);
      }

      renderMainCanvas();
    };

    const onUp = (e) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);

      clearSmartGuides();

      // Check if actually moved
      let moved = false;
      for (const o of originals) {
        if (o.el.x !== o.origX || o.el.y !== o.origY) {
          moved = true;
          break;
        }
      }
      if (moved) {
        pushUndo();
        markDirty();
      }
      renderMainCanvas();
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }

  function handleResize(elId, handleName, startEvent) {
    const slide = getCurrentSlide();
    if (!slide)
      return;

    const element = slide.elements.find(e => e.id === elId);
    if (!element)
      return;

    const scale = currentZoom / 100;
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const origX = element.x;
    const origY = element.y;
    const origW = element.w;
    const origH = element.h;

    const target = startEvent.target;
    target.setPointerCapture(startEvent.pointerId);

    const onMove = (e) => {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;

      let newX = origX, newY = origY, newW = origW, newH = origH;

      // Apply resize based on handle direction
      if (handleName.includes('e'))
        newW = Math.max(20, origW + dx);
      if (handleName.includes('w')) {
        newW = Math.max(20, origW - dx);
        newX = origX + origW - newW;
      }
      if (handleName.includes('s'))
        newH = Math.max(20, origH + dy);
      if (handleName.includes('n')) {
        newH = Math.max(20, origH - dy);
        newY = origY + origH - newH;
      }

      // Feature 3: Snap-to-Grid for resize
      if (snapToGrid && !e.altKey) {
        newW = Math.round(newW / GRID_SIZE) * GRID_SIZE || GRID_SIZE;
        newH = Math.round(newH / GRID_SIZE) * GRID_SIZE || GRID_SIZE;
        if (handleName.includes('w'))
          newX = origX + origW - newW;
        if (handleName.includes('n'))
          newY = origY + origH - newH;
      }

      element.x = Math.round(newX);
      element.y = Math.round(newY);
      element.w = Math.round(newW);
      element.h = Math.round(newH);
      renderMainCanvas();
    };

    const onUp = (e) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);

      if (element.x !== origX || element.y !== origY || element.w !== origW || element.h !== origH) {
        pushUndo();
        markDirty();
      }
      renderMainCanvas();
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }

  // ---------------------------------------------------------------
  // Feature 1: Element Rotation
  // ---------------------------------------------------------------

  function handleRotation(elId, startEvent) {
    const slide = getCurrentSlide();
    if (!slide)
      return;

    const element = slide.elements.find(e => e.id === elId);
    if (!element)
      return;

    const scale = currentZoom / 100;
    const origRotation = element.rotation || 0;

    // Get element center in client coordinates
    const domEl = slideCanvas.querySelector(`[data-element-id="${elId}"]`);
    if (!domEl)
      return;

    const rect = domEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate start angle
    const startAngle = Math.atan2(startEvent.clientY - centerY, startEvent.clientX - centerX);

    const target = startEvent.target;
    target.setPointerCapture(startEvent.pointerId);

    const onMove = (e) => {
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      let delta = (currentAngle - startAngle) * (180 / Math.PI);
      let newRotation = origRotation + delta;

      // Shift key: snap to 15-degree increments
      if (e.shiftKey)
        newRotation = Math.round(newRotation / 15) * 15;

      // Normalize to 0-360
      newRotation = ((newRotation % 360) + 360) % 360;

      element.rotation = Math.round(newRotation);
      renderMainCanvas();
    };

    const onUp = (e) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);

      if (element.rotation !== origRotation) {
        pushUndo();
        markDirty();
      }
      renderMainCanvas();
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }

  // ===============================================================
  // Element Selection & Clipboard
  // ===============================================================

  function selectAllElements() {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    selectedElements.clear();
    for (const el of slide.elements)
      selectedElements.add(el.id);
    renderMainCanvas();
  }

  function deleteSelectedElements() {
    const slide = getCurrentSlide();
    if (!slide || !selectedElements.size)
      return;
    pushUndo();
    slide.elements = slide.elements.filter(el => !selectedElements.has(el.id));
    selectedElements.clear();
    renderMainCanvas();
    markDirty();
  }

  function doCopy() {
    const slide = getCurrentSlide();
    if (!slide || !selectedElements.size)
      return;
    clipboardElements = slide.elements
      .filter(el => selectedElements.has(el.id))
      .map(el => JSON.parse(JSON.stringify(el)));
  }

  function doCut() {
    doCopy();
    deleteSelectedElements();
  }

  function doPaste() {
    const slide = getCurrentSlide();
    if (!slide || !clipboardElements.length)
      return;
    pushUndo();
    selectedElements.clear();
    for (const el of clipboardElements) {
      const clone = JSON.parse(JSON.stringify(el));
      clone.id = 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      clone.x += 20;
      clone.y += 20;
      slide.elements.push(clone);
      selectedElements.add(clone.id);
    }
    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Insert Functions
  // ===============================================================

  function insertTextbox() {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    pushUndo();
    const tb = SlideRenderer.createTextbox(280, 200, 400, 140, '');
    slide.elements.push(tb);
    selectedElements.clear();
    selectedElements.add(tb.id);
    renderMainCanvas();
    markDirty();
  }

  async function insertImage() {
    const result = await ComDlg32.ImportFile({ accept: 'image/*', readAs: 'dataURL' });
    if (result.cancelled || !result.data)
      return;

    const slide = getCurrentSlide();
    if (!slide)
      return;

    pushUndo();
    const img = SlideRenderer.createImageElement(180, 100, 400, 300, result.data);
    slide.elements.push(img);
    selectedElements.clear();
    selectedElements.add(img.id);
    renderMainCanvas();
    markDirty();
  }

  function insertShape(type) {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    pushUndo();
    const fillColor = presentation.theme.colors.accent1 || '#4472c4';
    const shape = SlideRenderer.createShape(380, 200, 200, 150, type, fillColor);
    slide.elements.push(shape);
    selectedElements.clear();
    selectedElements.add(shape.id);
    renderMainCanvas();
    markDirty();
  }

  function showInsertTableDialog() {
    const overlay = document.getElementById('dlg-insert-table');
    if (!overlay) {
      // Fallback: prompt for rows/cols
      const rowsStr = prompt('Number of rows:', '3');
      if (!rowsStr)
        return;
      const colsStr = prompt('Number of columns:', '3');
      if (!colsStr)
        return;
      const rows = parseInt(rowsStr, 10) || 3;
      const cols = parseInt(colsStr, 10) || 3;
      doInsertTable(rows, cols);
      return;
    }

    SZ.Dialog.show('dlg-insert-table').then((result) => {
      if (result !== 'ok')
        return;
      const rowsInput = document.getElementById('table-rows');
      const colsInput = document.getElementById('table-cols');
      const rows = parseInt(rowsInput?.value, 10) || 3;
      const cols = parseInt(colsInput?.value, 10) || 3;
      doInsertTable(rows, cols);
    });
  }

  function doInsertTable(rows, cols) {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    pushUndo();
    const tbl = SlideRenderer.createTable(200, 150, 560, rows * 30 + 30, rows, cols);
    slide.elements.push(tbl);
    selectedElements.clear();
    selectedElements.add(tbl.id);
    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Format Functions
  // ===============================================================

  function getSelectedTextboxElements() {
    const slide = getCurrentSlide();
    if (!slide)
      return [];
    return slide.elements.filter(el => selectedElements.has(el.id) && el.type === 'textbox');
  }

  function getSelectedElements() {
    const slide = getCurrentSlide();
    if (!slide)
      return [];
    return slide.elements.filter(el => selectedElements.has(el.id));
  }

  function toggleBold() {
    const focused = slideCanvas.querySelector('[contenteditable]:focus');
    if (focused) {
      document.execCommand('bold');
      return;
    }
    const textboxes = getSelectedTextboxElements();
    if (!textboxes.length)
      return;
    pushUndo();
    for (const tb of textboxes)
      tb.fontWeight = tb.fontWeight === 'bold' ? 'normal' : 'bold';
    renderMainCanvas();
    markDirty();
  }

  function toggleItalic() {
    const focused = slideCanvas.querySelector('[contenteditable]:focus');
    if (focused) {
      document.execCommand('italic');
      return;
    }
    const textboxes = getSelectedTextboxElements();
    if (!textboxes.length)
      return;
    pushUndo();
    for (const tb of textboxes)
      tb.fontStyle = tb.fontStyle === 'italic' ? 'normal' : 'italic';
    renderMainCanvas();
    markDirty();
  }

  function toggleUnderline() {
    const focused = slideCanvas.querySelector('[contenteditable]:focus');
    if (focused) {
      document.execCommand('underline');
      return;
    }
    const textboxes = getSelectedTextboxElements();
    if (!textboxes.length)
      return;
    pushUndo();
    for (const tb of textboxes)
      tb.textDecoration = tb.textDecoration === 'underline' ? 'none' : 'underline';
    renderMainCanvas();
    markDirty();
  }

  function setTextAlignment(align) {
    const textboxes = getSelectedTextboxElements();
    if (!textboxes.length)
      return;
    pushUndo();
    for (const tb of textboxes)
      tb.textAlign = align;
    renderMainCanvas();
    markDirty();
  }

  function changeZOrder(direction) {
    const slide = getCurrentSlide();
    if (!slide || selectedElements.size !== 1)
      return;

    const elId = [...selectedElements][0];
    const idx = slide.elements.findIndex(e => e.id === elId);
    if (idx === -1)
      return;

    pushUndo();
    const el = slide.elements[idx];

    switch (direction) {
      case 'front':
        slide.elements.splice(idx, 1);
        slide.elements.push(el);
        break;
      case 'back':
        slide.elements.splice(idx, 1);
        slide.elements.unshift(el);
        break;
      case 'forward':
        if (idx < slide.elements.length - 1) {
          slide.elements.splice(idx, 1);
          slide.elements.splice(idx + 1, 0, el);
        }
        break;
      case 'backward':
        if (idx > 0) {
          slide.elements.splice(idx, 1);
          slide.elements.splice(idx - 1, 0, el);
        }
        break;
    }

    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Feature 2: Alignment & Distribution
  // ===============================================================

  function alignElements(direction) {
    const slide = getCurrentSlide();
    if (!slide || selectedElements.size < 2)
      return;

    const elems = slide.elements.filter(el => selectedElements.has(el.id));
    if (elems.length < 2)
      return;

    pushUndo();

    switch (direction) {
      case 'left': {
        const minX = Math.min(...elems.map(e => e.x));
        for (const el of elems)
          el.x = minX;
        break;
      }
      case 'center': {
        const centers = elems.map(e => e.x + e.w / 2);
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        for (const el of elems)
          el.x = Math.round(avgCenter - el.w / 2);
        break;
      }
      case 'right': {
        const maxRight = Math.max(...elems.map(e => e.x + e.w));
        for (const el of elems)
          el.x = maxRight - el.w;
        break;
      }
      case 'top': {
        const minY = Math.min(...elems.map(e => e.y));
        for (const el of elems)
          el.y = minY;
        break;
      }
      case 'middle': {
        const middles = elems.map(e => e.y + e.h / 2);
        const avgMiddle = middles.reduce((a, b) => a + b, 0) / middles.length;
        for (const el of elems)
          el.y = Math.round(avgMiddle - el.h / 2);
        break;
      }
      case 'bottom': {
        const maxBottom = Math.max(...elems.map(e => e.y + e.h));
        for (const el of elems)
          el.y = maxBottom - el.h;
        break;
      }
    }

    renderMainCanvas();
    markDirty();
  }

  function distributeElements(direction) {
    const slide = getCurrentSlide();
    if (!slide || selectedElements.size < 3)
      return;

    const elems = slide.elements.filter(el => selectedElements.has(el.id));
    if (elems.length < 3)
      return;

    pushUndo();

    if (direction === 'horizontal') {
      elems.sort((a, b) => a.x - b.x);
      const minLeft = elems[0].x;
      const maxRight = elems[elems.length - 1].x + elems[elems.length - 1].w;
      const totalWidth = elems.reduce((sum, e) => sum + e.w, 0);
      const gap = (maxRight - minLeft - totalWidth) / (elems.length - 1);
      let currentX = minLeft;
      for (const el of elems) {
        el.x = Math.round(currentX);
        currentX += el.w + gap;
      }
    } else {
      elems.sort((a, b) => a.y - b.y);
      const minTop = elems[0].y;
      const maxBottom = elems[elems.length - 1].y + elems[elems.length - 1].h;
      const totalHeight = elems.reduce((sum, e) => sum + e.h, 0);
      const gap = (maxBottom - minTop - totalHeight) / (elems.length - 1);
      let currentY = minTop;
      for (const el of elems) {
        el.y = Math.round(currentY);
        currentY += el.h + gap;
      }
    }

    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Feature 3: Snap-to-Grid Toggle
  // ===============================================================

  function toggleSnapToGrid() {
    snapToGrid = !snapToGrid;
    const btn = document.getElementById('btn-toggle-snap');
    if (btn)
      btn.classList.toggle('rb-btn-active', snapToGrid);
  }

  // ===============================================================
  // Feature 5: Format Painter
  // ===============================================================

  function initFormatPainter() {
    const fpBtn = document.querySelector('[data-action="format-painter"]');
    presFormatPainter = new SZ.FormatPainter({
      buttonEl: null,
      cursorTarget: slideCanvas,
      cursorClass: 'format-painter-cursor',
      activeClass: 'rb-btn-active',
      onCapture() {
        const slide = getCurrentSlide();
        if (!slide || selectedElements.size !== 1)
          return null;
        const elId = [...selectedElements][0];
        const element = slide.elements.find(e => e.id === elId);
        if (!element)
          return null;
        const data = {};
        for (const key of ['fillColor','strokeColor','strokeWidth','fontSize','fontFamily','fontWeight','fontStyle','color','backgroundColor','opacity','borderColor','borderWidth','textAlign'])
          if (element[key] != null)
            data[key] = element[key];
        return data;
      },
      onApply(fmt) {
        const slide = getCurrentSlide();
        if (!slide)
          return;
        for (const elId of selectedElements) {
          const element = slide.elements.find(e => e.id === elId);
          if (!element)
            continue;
          pushUndo();
          for (const key of Object.keys(fmt))
            if (element[key] !== undefined || key === 'fillColor' || key === 'strokeColor' || key === 'color' || key === 'backgroundColor')
              element[key] = fmt[key];
        }
        markDirty();
        renderMainCanvas();
      },
      onDeactivate() {
        slideCanvas.style.cursor = '';
      }
    });
    if (fpBtn) {
      fpBtn.addEventListener('click', () => {
        presFormatPainter.isActive ? presFormatPainter.deactivate() : presFormatPainter.activate(false);
      });
      fpBtn.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        presFormatPainter.activate(true);
      });
    }
  }

  function activateFormatPainter() {
    if (presFormatPainter)
      presFormatPainter.activate(false);
  }

  function applyFormatPainterTo(elId) {
    if (!presFormatPainter || !presFormatPainter.isActive)
      return;
    selectedElements.clear();
    selectedElements.add(elId);
    presFormatPainter.tryApply();
  }

  function deactivateFormatPainter() {
    if (presFormatPainter)
      presFormatPainter.deactivate();
  }

  // ===============================================================
  // Feature 6: Find & Replace
  // ===============================================================

  let findReplaceState = {
    matches: [],
    currentMatch: -1
  };

  function showFindReplaceDialog() {
    const overlay = document.getElementById('dlg-find-replace');
    if (!overlay)
      return;
    overlay.style.display = 'flex';

    const findInput = document.getElementById('fr-find-input');
    const replaceInput = document.getElementById('fr-replace-input');
    const matchCase = document.getElementById('fr-match-case');
    const wholeWord = document.getElementById('fr-whole-word');
    const statusEl = document.getElementById('fr-status');

    findReplaceState = { matches: [], currentMatch: -1 };

    function updateStatus() {
      if (statusEl) {
        if (findReplaceState.matches.length)
          statusEl.textContent = 'Match ' + (findReplaceState.currentMatch + 1) + ' of ' + findReplaceState.matches.length;
        else
          statusEl.textContent = findInput.value ? 'No matches found' : '';
      }
    }

    function findAll() {
      findReplaceState.matches = [];
      findReplaceState.currentMatch = -1;

      const query = findInput.value;
      if (!query) {
        updateStatus();
        return;
      }

      const caseSensitive = matchCase && matchCase.checked;
      const whole = wholeWord && wholeWord.checked;

      for (let si = 0; si < presentation.slides.length; ++si) {
        const slide = presentation.slides[si];
        for (const el of slide.elements) {
          if (el.type !== 'textbox')
            continue;
          const plainText = (el.content || '').replace(/<[^>]*>/g, '');
          let searchText = caseSensitive ? plainText : plainText.toLowerCase();
          let searchQuery = caseSensitive ? query : query.toLowerCase();

          let startPos = 0;
          while (true) {
            let idx = searchText.indexOf(searchQuery, startPos);
            if (idx === -1)
              break;

            if (whole) {
              const before = idx > 0 ? searchText[idx - 1] : ' ';
              const after = idx + searchQuery.length < searchText.length ? searchText[idx + searchQuery.length] : ' ';
              if (/\w/.test(before) || /\w/.test(after)) {
                startPos = idx + 1;
                continue;
              }
            }

            findReplaceState.matches.push({
              slideIndex: si,
              elementId: el.id,
              textIndex: idx,
              length: query.length
            });
            startPos = idx + 1;
          }
        }
      }

      updateStatus();
    }

    function findNext() {
      findAll();
      if (!findReplaceState.matches.length)
        return;
      findReplaceState.currentMatch = (findReplaceState.currentMatch + 1) % findReplaceState.matches.length;
      navigateToMatch();
      updateStatus();
    }

    function findPrev() {
      findAll();
      if (!findReplaceState.matches.length)
        return;
      findReplaceState.currentMatch = (findReplaceState.currentMatch - 1 + findReplaceState.matches.length) % findReplaceState.matches.length;
      navigateToMatch();
      updateStatus();
    }

    function navigateToMatch() {
      const match = findReplaceState.matches[findReplaceState.currentMatch];
      if (!match)
        return;

      if (match.slideIndex !== currentSlideIndex) {
        currentSlideIndex = match.slideIndex;
        selectedElements.clear();
      }

      selectedElements.clear();
      selectedElements.add(match.elementId);
      refreshUI();
    }

    function replaceCurrent() {
      if (findReplaceState.currentMatch < 0 || !findReplaceState.matches.length)
        return;

      const match = findReplaceState.matches[findReplaceState.currentMatch];
      if (!match)
        return;

      const replaceText = replaceInput.value;
      const slide = presentation.slides[match.slideIndex];
      const el = slide.elements.find(e => e.id === match.elementId);
      if (!el)
        return;

      pushUndo();
      const plainText = (el.content || '').replace(/<[^>]*>/g, '');
      const before = plainText.substring(0, match.textIndex);
      const after = plainText.substring(match.textIndex + match.length);
      el.content = before + replaceText + after;
      markDirty();

      // Re-search
      findAll();
      if (findReplaceState.matches.length) {
        findReplaceState.currentMatch = Math.min(findReplaceState.currentMatch, findReplaceState.matches.length - 1);
        navigateToMatch();
      }
      updateStatus();
      renderMainCanvas();
    }

    function replaceAll() {
      findAll();
      if (!findReplaceState.matches.length)
        return;

      pushUndo();
      const replaceText = replaceInput.value;
      const query = findInput.value;
      const caseSensitive = matchCase && matchCase.checked;

      for (const slide of presentation.slides) {
        for (const el of slide.elements) {
          if (el.type !== 'textbox')
            continue;
          const plainText = (el.content || '').replace(/<[^>]*>/g, '');
          if (!caseSensitive) {
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            el.content = plainText.replace(regex, replaceText);
          } else {
            el.content = plainText.split(query).join(replaceText);
          }
        }
      }

      markDirty();
      findAll();
      updateStatus();
      renderMainCanvas();
    }

    function closeDialog() {
      overlay.style.display = 'none';
      findReplaceState = { matches: [], currentMatch: -1 };
    }

    // Wire buttons (use cloneNode to remove old listeners)
    const wireButton = (id, handler) => {
      const btn = document.getElementById(id);
      if (!btn)
        return;
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', handler);
    };

    wireButton('fr-find-next', findNext);
    wireButton('fr-find-prev', findPrev);
    wireButton('fr-replace-btn', replaceCurrent);
    wireButton('fr-replace-all', replaceAll);
    wireButton('fr-close', closeDialog);

    if (findInput)
      findInput.focus();
  }

  // ===============================================================
  // Feature 7: Element Grouping
  // ===============================================================

  function groupSelectedElements() {
    const slide = getCurrentSlide();
    if (!slide || selectedElements.size < 2)
      return;

    const elements = slide.elements.filter(el => selectedElements.has(el.id));
    if (elements.length < 2)
      return;

    pushUndo();

    const group = SlideRenderer.createGroup(elements);
    if (!group)
      return;

    // Remove grouped elements from slide
    slide.elements = slide.elements.filter(el => !selectedElements.has(el.id));

    // Add group element
    slide.elements.push(group);

    selectedElements.clear();
    selectedElements.add(group.id);
    renderMainCanvas();
    markDirty();
  }

  function ungroupSelectedElement() {
    const slide = getCurrentSlide();
    if (!slide || selectedElements.size !== 1)
      return;

    const elId = [...selectedElements][0];
    const element = slide.elements.find(e => e.id === elId);
    if (!element || element.type !== 'group')
      return;

    pushUndo();

    const ungrouped = SlideRenderer.ungroupElement(element);
    const idx = slide.elements.indexOf(element);
    slide.elements.splice(idx, 1, ...ungrouped);

    selectedElements.clear();
    for (const el of ungrouped)
      selectedElements.add(el.id);

    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Feature 8: Hyperlinks
  // ===============================================================

  function showHyperlinkDialog() {
    const overlay = document.getElementById('dlg-hyperlink');
    if (!overlay)
      return;

    const slide = getCurrentSlide();
    if (!slide || selectedElements.size !== 1)
      return;

    const elId = [...selectedElements][0];
    const element = slide.elements.find(e => e.id === elId);
    if (!element)
      return;

    // Pre-fill dialog
    const urlInput = document.getElementById('hl-url');
    const tooltipInput = document.getElementById('hl-tooltip');
    if (urlInput)
      urlInput.value = element.hyperlink ? element.hyperlink.url || '' : '';
    if (tooltipInput)
      tooltipInput.value = element.hyperlink ? element.hyperlink.tooltip || '' : '';

    overlay.style.display = 'flex';

    const wireBtn = (id, handler) => {
      const btn = document.getElementById(id);
      if (!btn)
        return;
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', handler);
    };

    wireBtn('hl-ok', () => {
      pushUndo();
      const url = (urlInput?.value || '').trim();
      if (url)
        element.hyperlink = { url, tooltip: tooltipInput?.value || '' };
      else
        delete element.hyperlink;
      overlay.style.display = 'none';
      renderMainCanvas();
      markDirty();
    });

    wireBtn('hl-remove', () => {
      pushUndo();
      delete element.hyperlink;
      overlay.style.display = 'none';
      renderMainCanvas();
      markDirty();
    });

    wireBtn('hl-cancel', () => {
      overlay.style.display = 'none';
    });
  }

  function removeHyperlink() {
    const slide = getCurrentSlide();
    if (!slide || selectedElements.size !== 1)
      return;

    const elId = [...selectedElements][0];
    const element = slide.elements.find(e => e.id === elId);
    if (!element || !element.hyperlink)
      return;

    pushUndo();
    delete element.hyperlink;
    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Feature 9: Slide Numbering & Footer
  // ===============================================================

  function showHeaderFooterDialog() {
    const overlay = document.getElementById('dlg-header-footer');
    if (!overlay)
      return;

    const hf = presentation.headerFooter || {};

    const dateCheck = document.getElementById('hf-date');
    const dateText = document.getElementById('hf-date-text');
    const slideNumCheck = document.getElementById('hf-slide-number');
    const footerCheck = document.getElementById('hf-footer');
    const footerText = document.getElementById('hf-footer-text');
    const notTitleCheck = document.getElementById('hf-not-title');

    if (dateCheck) dateCheck.checked = !!hf.showDate;
    if (dateText) dateText.value = hf.dateText || '';
    if (slideNumCheck) slideNumCheck.checked = !!hf.showSlideNumber;
    if (footerCheck) footerCheck.checked = !!hf.showFooter;
    if (footerText) footerText.value = hf.footerText || '';
    if (notTitleCheck) notTitleCheck.checked = hf.dontShowOnTitle !== false;

    overlay.style.display = 'flex';

    const wireBtn = (id, handler) => {
      const btn = document.getElementById(id);
      if (!btn)
        return;
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', handler);
    };

    wireBtn('hf-apply-all', () => {
      pushUndo();
      presentation.headerFooter = {
        showDate: dateCheck?.checked || false,
        dateText: dateText?.value || '',
        showSlideNumber: slideNumCheck?.checked || false,
        showFooter: footerCheck?.checked || false,
        footerText: footerText?.value || '',
        dontShowOnTitle: notTitleCheck?.checked !== false
      };
      overlay.style.display = 'none';
      renderMainCanvas();
      markDirty();
    });

    wireBtn('hf-cancel', () => {
      overlay.style.display = 'none';
    });
  }

  // ===============================================================
  // Feature 10: Spell Check
  // ===============================================================

  function runSpellCheckOnSlide() {
    if (!PresentationsApp.SpellCheck)
      return;

    const slide = getCurrentSlide();
    if (!slide)
      return;

    spellCheckEnabled = !spellCheckEnabled;
    const btn = document.getElementById('btn-spell-check');
    if (btn)
      btn.classList.toggle('rb-btn-active', spellCheckEnabled);

    renderMainCanvas();

    if (spellCheckEnabled) {
      // Apply spell marks to rendered textboxes
      const elements = slideCanvas.querySelectorAll('.slide-element');
      for (const domEl of elements) {
        const elId = domEl.dataset.elementId;
        const element = slide.elements.find(e => e.id === elId);
        if (element && element.type === 'textbox')
          PresentationsApp.SpellCheck.markSpellErrors(domEl, element);
      }
    }
  }

  // ===============================================================
  // Feature 14: Comments
  // ===============================================================

  function doAddComment() {
    if (!Comments)
      return;
    const text = prompt('Comment text:', '');
    if (!text)
      return;

    pushUndo();
    let x = 480;
    let y = 270;

    // Position at selected element center, or slide center
    if (selectedElements.size === 1) {
      const slide = getCurrentSlide();
      if (slide) {
        const elId = [...selectedElements][0];
        const el = slide.elements.find(e => e.id === elId);
        if (el) {
          x = el.x + el.w / 2;
          y = el.y;
        }
      }
    }

    Comments.addComment(currentSlideIndex, x, y, text);
    markDirty();
    renderMainCanvas();
    if (Comments.isPanelVisible())
      Comments.refreshCommentsPanel(currentSlideIndex);
  }

  function doToggleCommentsPanel() {
    if (!Comments)
      return;
    Comments.toggleCommentsPanel(currentSlideIndex);
    const layout = document.getElementById('app-layout');
    if (layout) {
      if (Comments.isPanelVisible())
        layout.classList.add('with-comments-panel');
      else
        layout.classList.remove('with-comments-panel');
    }
  }

  // ===============================================================
  // Feature 15: Rulers
  // ===============================================================

  function toggleRulers() {
    rulersVisible = !rulersVisible;
    renderMainCanvas();
  }

  function renderRulers() {
    if (!rulersVisible)
      return;

    const viewport = canvasViewport;
    if (!viewport)
      return;

    // Remove existing rulers
    const existing = viewport.querySelectorAll('.ruler-h, .ruler-v');
    for (const r of existing)
      r.parentNode.removeChild(r);

    const scale = currentZoom / 100;
    const ppi = 96; // pixels per inch
    const cmPerInch = 2.54;

    // Horizontal ruler
    const rulerH = document.createElement('div');
    rulerH.className = 'ruler-h';
    const canvasW = SlideRenderer.CANVAS_W * scale;
    rulerH.style.width = canvasW + 'px';

    for (let px = 0; px <= SlideRenderer.CANVAS_W; px += ppi / 4) {
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      tick.style.left = (px * scale) + 'px';
      tick.style.width = '1px';
      const isInch = px % ppi < 2;
      const isHalf = px % (ppi / 2) < 2;
      tick.style.height = isInch ? '12px' : isHalf ? '8px' : '4px';
      tick.style.bottom = '0';
      rulerH.appendChild(tick);

      if (isInch) {
        const label = document.createElement('div');
        label.className = 'ruler-label';
        label.style.left = (px * scale + 2) + 'px';
        label.style.bottom = '6px';
        label.textContent = String(Math.round(px / ppi));
        rulerH.appendChild(label);
      }
    }

    // Guide line creation on click
    rulerH.addEventListener('click', (e) => {
      const rect = rulerH.getBoundingClientRect();
      const y = 0; // guide comes from top ruler - create horizontal guide
      const canvasRect = slideCanvas.getBoundingClientRect();
      const clickY = e.clientY - canvasRect.top;
      guideLines.horizontal.push(clickY / scale);
      renderMainCanvas();
    });

    viewport.style.position = 'relative';
    viewport.appendChild(rulerH);

    // Vertical ruler
    const rulerV = document.createElement('div');
    rulerV.className = 'ruler-v';
    const canvasH = SlideRenderer.CANVAS_H * scale;
    rulerV.style.height = canvasH + 'px';

    for (let px = 0; px <= SlideRenderer.CANVAS_H; px += ppi / 4) {
      const tick = document.createElement('div');
      tick.className = 'ruler-tick';
      tick.style.top = (px * scale) + 'px';
      tick.style.height = '1px';
      const isInch = px % ppi < 2;
      const isHalf = px % (ppi / 2) < 2;
      tick.style.width = isInch ? '12px' : isHalf ? '8px' : '4px';
      tick.style.right = '0';
      rulerV.appendChild(tick);

      if (isInch) {
        const label = document.createElement('div');
        label.className = 'ruler-label';
        label.style.top = (px * scale + 2) + 'px';
        label.style.right = '6px';
        label.textContent = String(Math.round(px / ppi));
        rulerV.appendChild(label);
      }
    }

    rulerV.addEventListener('click', (e) => {
      const canvasRect = slideCanvas.getBoundingClientRect();
      const clickX = e.clientX - canvasRect.left;
      guideLines.vertical.push(clickX / scale);
      renderMainCanvas();
    });

    viewport.appendChild(rulerV);

    // Render guide lines on canvas
    const canvas = slideCanvas.querySelector('.slide-canvas');
    if (canvas) {
      for (const gy of guideLines.horizontal) {
        const line = document.createElement('div');
        line.className = 'guide-line-h';
        line.style.top = gy + 'px';
        line.addEventListener('dblclick', () => {
          guideLines.horizontal = guideLines.horizontal.filter(v => v !== gy);
          renderMainCanvas();
        });
        canvas.appendChild(line);
      }
      for (const gx of guideLines.vertical) {
        const line = document.createElement('div');
        line.className = 'guide-line-v';
        line.style.left = gx + 'px';
        line.addEventListener('dblclick', () => {
          guideLines.vertical = guideLines.vertical.filter(v => v !== gx);
          renderMainCanvas();
        });
        canvas.appendChild(line);
      }
    }
  }

  // ===============================================================
  // Feature 16: Sections
  // ===============================================================

  function addSection() {
    pushUndo();
    if (!presentation.sections)
      presentation.sections = [];

    const name = prompt('Section name:', 'Untitled Section');
    if (!name)
      return;

    presentation.sections.push({
      name: name,
      collapsed: false,
      firstSlideIndex: currentSlideIndex
    });

    // Sort sections by firstSlideIndex
    presentation.sections.sort((a, b) => a.firstSlideIndex - b.firstSlideIndex);

    markDirty();
    refreshSlidePanel();
  }

  function renameSection() {
    if (!presentation.sections || !presentation.sections.length)
      return;

    // Find section that owns current slide
    const section = _findSectionForSlide(currentSlideIndex);
    if (!section) {
      User32.MessageBox('No section found for this slide.', 'Presentations', MB_OK);
      return;
    }

    const name = prompt('Section name:', section.name);
    if (!name)
      return;

    pushUndo();
    section.name = name;
    markDirty();
    refreshSlidePanel();
  }

  function removeSection() {
    if (!presentation.sections || !presentation.sections.length)
      return;

    const section = _findSectionForSlide(currentSlideIndex);
    if (!section)
      return;

    pushUndo();
    presentation.sections = presentation.sections.filter(s => s !== section);
    markDirty();
    refreshSlidePanel();
  }

  function _findSectionForSlide(slideIndex) {
    if (!presentation.sections || !presentation.sections.length)
      return null;

    let found = null;
    for (const s of presentation.sections) {
      if (s.firstSlideIndex <= slideIndex)
        found = s;
    }
    return found;
  }

  // ===============================================================
  // Feature 17: Presenter View
  // ===============================================================

  function startPresenterView() {
    if (!PresenterView)
      return;
    PresenterView.start(currentSlideIndex);
  }

  // ===============================================================
  // Feature 18: Custom Shows
  // ===============================================================

  function showCustomShowsDialog() {
    const overlay = document.getElementById('dlg-custom-shows');
    if (!overlay)
      return;

    overlay.style.display = 'flex';
    if (!presentation.customShows)
      presentation.customShows = [];

    const listEl = document.getElementById('cs-list');
    const refreshList = () => {
      if (!listEl)
        return;
      listEl.innerHTML = '';
      for (let i = 0; i < presentation.customShows.length; ++i) {
        const show = presentation.customShows[i];
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = show.name + ' (' + show.slideIndices.length + ' slides)';
        listEl.appendChild(opt);
      }
    };

    refreshList();

    const wireBtn = (id, handler) => {
      const btn = document.getElementById(id);
      if (!btn)
        return;
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', handler);
    };

    wireBtn('cs-new', () => {
      const name = prompt('Custom show name:', 'Custom Show ' + (presentation.customShows.length + 1));
      if (!name)
        return;
      const indicesStr = prompt('Slide numbers (comma-separated):', '1,2,3');
      if (!indicesStr)
        return;
      const indices = indicesStr.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(n => !isNaN(n) && n >= 0 && n < presentation.slides.length);
      pushUndo();
      presentation.customShows.push({ name, slideIndices: indices });
      markDirty();
      refreshList();
    });

    wireBtn('cs-edit', () => {
      if (!listEl || listEl.selectedIndex < 0)
        return;
      const idx = parseInt(listEl.value, 10);
      const show = presentation.customShows[idx];
      if (!show)
        return;
      const name = prompt('Show name:', show.name);
      if (name)
        show.name = name;
      const indicesStr = prompt('Slide numbers (comma-separated):', show.slideIndices.map(i => i + 1).join(','));
      if (indicesStr) {
        show.slideIndices = indicesStr.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(n => !isNaN(n) && n >= 0 && n < presentation.slides.length);
      }
      pushUndo();
      markDirty();
      refreshList();
    });

    wireBtn('cs-delete', () => {
      if (!listEl || listEl.selectedIndex < 0)
        return;
      const idx = parseInt(listEl.value, 10);
      pushUndo();
      presentation.customShows.splice(idx, 1);
      markDirty();
      refreshList();
    });

    wireBtn('cs-show', () => {
      if (!listEl || listEl.selectedIndex < 0)
        return;
      const idx = parseInt(listEl.value, 10);
      const show = presentation.customShows[idx];
      if (!show || !show.slideIndices.length)
        return;
      overlay.style.display = 'none';
      // Play custom show by starting slideshow with filtered slides
      startSlideshow(show.slideIndices[0]);
    });

    // Close button
    const cancelBtn = overlay.querySelector('.pp-dlg-cancel');
    if (cancelBtn) {
      const newBtn = cancelBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newBtn, cancelBtn);
      newBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
      });
    }
  }

  // ===============================================================
  // Feature 19: Rehearsal Timings
  // ===============================================================

  function startRehearsalTimings() {
    rehearsalActive = true;
    rehearsalTimings = new Array(presentation.slides.length).fill(0);
    rehearsalStartTime = Date.now();

    // Start slideshow with timer overlay
    SlideshowMode.startSlideshow(0);

    // Add rehearsal timer overlay
    setTimeout(() => {
      const overlay = document.getElementById('slideshow-overlay');
      if (!overlay)
        return;

      const timer = document.createElement('div');
      timer.id = 'rehearsal-timer';
      timer.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:20;background:rgba(0,0,0,0.7);color:#fff;padding:8px 16px;border-radius:4px;font-family:Consolas,monospace;font-size:16px;';
      timer.textContent = '00:00';
      overlay.appendChild(timer);

      const updateTimer = setInterval(() => {
        if (!rehearsalActive) {
          clearInterval(updateTimer);
          return;
        }
        const elapsed = Math.floor((Date.now() - rehearsalStartTime) / 1000);
        const min = Math.floor(elapsed / 60);
        const sec = elapsed % 60;
        timer.textContent = String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
      }, 1000);
    }, 100);
  }

  // ===============================================================
  // Feature 20: Action Buttons
  // ===============================================================

  function showInsertActionButtonDialog() {
    const actionType = prompt('Action type (next, prev, first, last, end, url):', 'next');
    if (!actionType)
      return;

    const validActions = ['next', 'prev', 'first', 'last', 'end', 'url'];
    if (!validActions.includes(actionType)) {
      User32.MessageBox('Invalid action type. Use: ' + validActions.join(', '), 'Presentations', MB_OK);
      return;
    }

    const slide = getCurrentSlide();
    if (!slide)
      return;

    pushUndo();
    const btn = SlideRenderer.createActionButton(400, 450, 120, 40, actionType);
    if (actionType === 'url') {
      const url = prompt('URL:', 'https://');
      if (url)
        btn.actionUrl = url;
    }
    slide.elements.push(btn);
    selectedElements.clear();
    selectedElements.add(btn.id);
    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Feature 21: Video/Audio
  // ===============================================================

  async function insertVideo() {
    const result = await ComDlg32.ImportFile({ accept: 'video/*', readAs: 'dataURL' });
    if (result.cancelled || !result.data)
      return;

    const slide = getCurrentSlide();
    if (!slide)
      return;

    pushUndo();
    const video = SlideRenderer.createVideoElement(200, 100, 480, 270, result.data, result.name || 'video');
    slide.elements.push(video);
    selectedElements.clear();
    selectedElements.add(video.id);
    renderMainCanvas();
    markDirty();
  }

  async function insertAudio() {
    const result = await ComDlg32.ImportFile({ accept: 'audio/*', readAs: 'dataURL' });
    if (result.cancelled || !result.data)
      return;

    const slide = getCurrentSlide();
    if (!slide)
      return;

    pushUndo();
    const audio = SlideRenderer.createAudioElement(350, 200, 200, 100, result.data, result.name || 'audio');
    slide.elements.push(audio);
    selectedElements.clear();
    selectedElements.add(audio.id);
    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Feature 22: Master Slide Editing
  // ===============================================================

  function toggleMasterView() {
    masterViewActive = !masterViewActive;

    if (masterViewActive) {
      if (!presentation.slideMasters)
        presentation.slideMasters = [{ name: 'Default', background: null, elements: [], layouts: [] }];

      // Show master elements on canvas
      User32.MessageBox('Master view active. Edit elements that appear on all slides.\nClick "Edit Master" again to exit.', 'Master View', MB_OK);
    }

    renderMainCanvas();
  }

  // ===============================================================
  // Feature 23: Charts
  // ===============================================================

  function showInsertChartDialog() {
    if (!ChartElement)
      return;

    const chartType = prompt('Chart type (bar, line, pie, scatter):', 'bar');
    if (!chartType)
      return;

    const validTypes = ['bar', 'line', 'pie', 'scatter'];
    if (!validTypes.includes(chartType)) {
      User32.MessageBox('Invalid chart type. Use: ' + validTypes.join(', '), 'Presentations', MB_OK);
      return;
    }

    const slide = getCurrentSlide();
    if (!slide)
      return;

    pushUndo();
    const chart = ChartElement.createChartElement(200, 100, 500, 350, chartType);
    slide.elements.push(chart);
    selectedElements.clear();
    selectedElements.add(chart.id);
    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Feature 24: Element Shadow & 3D
  // ===============================================================

  function toggleElementShadow() {
    const elems = getSelectedElements();
    if (!elems.length)
      return;

    pushUndo();
    for (const el of elems) {
      if (el.shadow)
        delete el.shadow;
      else
        el.shadow = { color: 'rgba(0,0,0,0.3)', offsetX: 3, offsetY: 3, blur: 6, inner: false };
    }
    renderMainCanvas();
    markDirty();
  }

  function showElement3dDialog() {
    const elems = getSelectedElements();
    if (!elems.length)
      return;

    const el = elems[0];
    const current = el.effects3d || {};
    const rotateX = prompt('Rotate X (degrees):', String(current.rotateX || 0));
    if (rotateX === null)
      return;
    const rotateY = prompt('Rotate Y (degrees):', String(current.rotateY || 0));
    if (rotateY === null)
      return;
    const perspective = prompt('Perspective (px, 0 to remove):', String(current.perspective || 600));
    if (perspective === null)
      return;

    pushUndo();
    const rx = parseFloat(rotateX) || 0;
    const ry = parseFloat(rotateY) || 0;
    const p = parseFloat(perspective) || 0;

    for (const elem of elems) {
      if (rx === 0 && ry === 0 && p === 0)
        delete elem.effects3d;
      else
        elem.effects3d = { rotateX: rx, rotateY: ry, perspective: p || 600 };
    }

    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Feature 26: Text Effects
  // ===============================================================

  function applyTextShadow() {
    const textboxes = getSelectedTextboxElements();
    if (!textboxes.length)
      return;

    pushUndo();
    for (const tb of textboxes) {
      if (tb.textShadow)
        delete tb.textShadow;
      else
        tb.textShadow = '2px 2px 4px rgba(0,0,0,0.4)';
    }
    renderMainCanvas();
    markDirty();
  }

  function applyTextGlow() {
    const textboxes = getSelectedTextboxElements();
    if (!textboxes.length)
      return;

    pushUndo();
    for (const tb of textboxes) {
      if (tb.textGlow)
        delete tb.textGlow;
      else
        tb.textGlow = '0 0 8px rgba(68,114,196,0.7), 0 0 16px rgba(68,114,196,0.4)';
    }
    renderMainCanvas();
    markDirty();
  }

  function applyTextReflection() {
    const textboxes = getSelectedTextboxElements();
    if (!textboxes.length)
      return;

    pushUndo();
    for (const tb of textboxes)
      tb.textReflection = !tb.textReflection;
    renderMainCanvas();
    markDirty();
  }

  function applyText3d() {
    const textboxes = getSelectedTextboxElements();
    if (!textboxes.length)
      return;

    pushUndo();
    for (const tb of textboxes) {
      if (tb.effects3d)
        delete tb.effects3d;
      else
        tb.effects3d = { rotateX: 15, rotateY: -10, perspective: 600 };
    }
    renderMainCanvas();
    markDirty();
  }

  // ===============================================================
  // Feature 27: Connector Lines
  // ===============================================================

  function startConnectorMode() {
    connectorMode = true;
    connectorStartElId = null;
    slideCanvas.style.cursor = 'crosshair';
    User32.MessageBox('Click the source element, then click the target element to create a connector.', 'Insert Connector', MB_OK);
  }

  function _handleConnectorClick(elId) {
    if (!connectorMode)
      return false;

    if (!connectorStartElId) {
      connectorStartElId = elId;
      // Highlight the selected start element
      const domEl = slideCanvas.querySelector(`[data-element-id="${elId}"]`);
      if (domEl)
        domEl.style.outline = '2px dashed #0078D7';
      return true;
    }

    // Second click: create connector
    const slide = getCurrentSlide();
    if (!slide) {
      _cancelConnectorMode();
      return true;
    }

    const startEl = slide.elements.find(e => e.id === connectorStartElId);
    const endEl = slide.elements.find(e => e.id === elId);
    if (!startEl || !endEl || connectorStartElId === elId) {
      _cancelConnectorMode();
      return true;
    }

    pushUndo();
    const connector = SlideRenderer.createConnector(connectorStartElId, elId, 'straight');

    // Auto-detect best anchor points based on relative positions
    const startCx = startEl.x + startEl.w / 2;
    const startCy = startEl.y + startEl.h / 2;
    const endCx = endEl.x + endEl.w / 2;
    const endCy = endEl.y + endEl.h / 2;
    const dx = endCx - startCx;
    const dy = endCy - startCy;

    if (Math.abs(dx) > Math.abs(dy)) {
      connector.startPoint = dx > 0 ? 'right' : 'left';
      connector.endPoint = dx > 0 ? 'left' : 'right';
    } else {
      connector.startPoint = dy > 0 ? 'bottom' : 'top';
      connector.endPoint = dy > 0 ? 'top' : 'bottom';
    }

    const sp = _getConnAnchorPos(startEl, connector.startPoint);
    const ep = _getConnAnchorPos(endEl, connector.endPoint);
    connector.startX = sp.x;
    connector.startY = sp.y;
    connector.endX = ep.x;
    connector.endY = ep.y;

    slide.elements.push(connector);
    selectedElements.clear();
    selectedElements.add(connector.id);
    markDirty();
    _cancelConnectorMode();
    renderMainCanvas();

    // Show connector properties dialog for the new connector
    showConnectorPropertiesDialog(connector.id);
    return true;
  }

  function _getConnAnchorPos(el, anchor) {
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    switch (anchor) {
      case 'top': return { x: cx, y: el.y };
      case 'bottom': return { x: cx, y: el.y + el.h };
      case 'left': return { x: el.x, y: cy };
      case 'right': return { x: el.x + el.w, y: cy };
      default: return { x: cx, y: cy };
    }
  }

  function _cancelConnectorMode() {
    connectorMode = false;
    connectorStartElId = null;
    slideCanvas.style.cursor = '';
    // Remove any highlight outlines
    const outlinedEls = slideCanvas.querySelectorAll('[style*="outline"]');
    for (const el of outlinedEls)
      el.style.outline = '';
  }

  function showConnectorPropertiesDialog(connectorId) {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    const connector = slide.elements.find(e => e.id === connectorId);
    if (!connector || connector.type !== 'connector')
      return;

    const overlay = document.createElement('div');
    overlay.className = 'pp-dialog-overlay';
    overlay.style.display = 'flex';

    const dlg = document.createElement('div');
    dlg.className = 'pp-dialog';
    dlg.style.width = '380px';

    const title = document.createElement('h3');
    title.textContent = 'Connector Properties';
    dlg.appendChild(title);

    const form = document.createElement('div');
    form.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:8px 0;';

    // Route type
    const routeRow = document.createElement('div');
    routeRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    routeRow.innerHTML = '<label style="font-size:12px;min-width:80px;">Route:</label>';
    const routeSel = document.createElement('select');
    routeSel.style.cssText = 'flex:1;font-size:12px;padding:3px;';
    for (const rt of ['straight', 'elbow', 'curved']) {
      const opt = document.createElement('option');
      opt.value = rt;
      opt.textContent = rt.charAt(0).toUpperCase() + rt.slice(1);
      if (rt === (connector.routeType || 'straight'))
        opt.selected = true;
      routeSel.appendChild(opt);
    }
    routeRow.appendChild(routeSel);
    form.appendChild(routeRow);

    // Line width
    const widthRow = document.createElement('div');
    widthRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    widthRow.innerHTML = '<label style="font-size:12px;min-width:80px;">Width:</label>';
    const widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.min = '1';
    widthInput.max = '10';
    widthInput.value = connector.lineWidth || 2;
    widthInput.style.cssText = 'width:60px;font-size:12px;padding:3px;';
    widthRow.appendChild(widthInput);
    form.appendChild(widthRow);

    // Line color
    const colorRow = document.createElement('div');
    colorRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    colorRow.innerHTML = '<label style="font-size:12px;min-width:80px;">Color:</label>';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = connector.lineColor || '#666666';
    colorInput.style.cssText = 'width:40px;height:24px;border:none;padding:0;';
    colorRow.appendChild(colorInput);
    form.appendChild(colorRow);

    // Line dash
    const dashRow = document.createElement('div');
    dashRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    dashRow.innerHTML = '<label style="font-size:12px;min-width:80px;">Dash:</label>';
    const dashSel = document.createElement('select');
    dashSel.style.cssText = 'flex:1;font-size:12px;padding:3px;';
    for (const ds of ['solid', 'dashed', 'dotted']) {
      const opt = document.createElement('option');
      opt.value = ds;
      opt.textContent = ds.charAt(0).toUpperCase() + ds.slice(1);
      if (ds === (connector.lineDash || 'solid'))
        opt.selected = true;
      dashSel.appendChild(opt);
    }
    dashRow.appendChild(dashSel);
    form.appendChild(dashRow);

    // Start arrow
    const startArrowRow = document.createElement('div');
    startArrowRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    startArrowRow.innerHTML = '<label style="font-size:12px;min-width:80px;">Start Arrow:</label>';
    const startArrowSel = document.createElement('select');
    startArrowSel.style.cssText = 'flex:1;font-size:12px;padding:3px;';
    const currentStartArrow = connector.startArrow === true ? 'arrow' : connector.startArrow === false ? 'none' : (connector.startArrow || 'none');
    for (const at of ['none', 'arrow', 'diamond', 'circle']) {
      const opt = document.createElement('option');
      opt.value = at;
      opt.textContent = at.charAt(0).toUpperCase() + at.slice(1);
      if (at === currentStartArrow)
        opt.selected = true;
      startArrowSel.appendChild(opt);
    }
    startArrowRow.appendChild(startArrowSel);
    form.appendChild(startArrowRow);

    // End arrow
    const endArrowRow = document.createElement('div');
    endArrowRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    endArrowRow.innerHTML = '<label style="font-size:12px;min-width:80px;">End Arrow:</label>';
    const endArrowSel = document.createElement('select');
    endArrowSel.style.cssText = 'flex:1;font-size:12px;padding:3px;';
    const currentEndArrow = connector.endArrow === true ? 'arrow' : connector.endArrow === false ? 'none' : (connector.endArrow || 'arrow');
    for (const at of ['none', 'arrow', 'diamond', 'circle']) {
      const opt = document.createElement('option');
      opt.value = at;
      opt.textContent = at.charAt(0).toUpperCase() + at.slice(1);
      if (at === currentEndArrow)
        opt.selected = true;
      endArrowSel.appendChild(opt);
    }
    endArrowRow.appendChild(endArrowSel);
    form.appendChild(endArrowRow);

    dlg.appendChild(form);

    // Buttons
    const buttons = document.createElement('div');
    buttons.className = 'dlg-buttons';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid #ccc;border-radius:3px;background:#f0f0f0;cursor:pointer;';
    cancelBtn.addEventListener('click', () => overlay.parentNode.removeChild(overlay));

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.className = 'primary';
    okBtn.style.cssText = 'padding:6px 16px;border:1px solid #0078D7;border-radius:3px;background:#0078D7;color:#fff;cursor:pointer;';
    okBtn.addEventListener('click', () => {
      pushUndo();
      connector.routeType = routeSel.value;
      connector.lineWidth = parseInt(widthInput.value, 10) || 2;
      connector.lineColor = colorInput.value;
      connector.lineDash = dashSel.value;
      connector.startArrow = startArrowSel.value;
      connector.endArrow = endArrowSel.value;
      overlay.parentNode.removeChild(overlay);
      markDirty();
      renderMainCanvas();
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(okBtn);
    dlg.appendChild(buttons);
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
  }

  // ===============================================================
  // Feature 29: SmartArt
  // ===============================================================

  function showInsertSmartArtDialog() {
    if (!SmartArtEngine) {
      User32.MessageBox('SmartArt engine not available.', 'Presentations', MB_OK);
      return;
    }

    SmartArtEngine.showTypePickerDialog((type) => {
      const slide = getCurrentSlide();
      if (!slide)
        return;

      pushUndo();
      const element = SmartArtEngine.createSmartArtElement(150, 100, 660, 340, type);
      slide.elements.push(element);
      selectedElements.clear();
      selectedElements.add(element.id);
      renderMainCanvas();
      markDirty();
    });
  }

  function showSmartArtNodeEditor(element) {
    if (!SmartArtEngine || !element || element.type !== 'smartart')
      return;

    SmartArtEngine.showNodeEditorDialog(element, () => {
      pushUndo();
      markDirty();
      renderMainCanvas();
    });
  }

  // ===============================================================
  // Feature 30: Photo Album
  // ===============================================================

  function showPhotoAlbumDialog() {
    // Photo Album dialog with full options
    const overlay = document.createElement('div');
    overlay.className = 'pp-dialog-overlay';
    overlay.style.display = 'flex';

    const dlg = document.createElement('div');
    dlg.className = 'pp-dialog';
    dlg.style.width = '500px';
    dlg.style.maxHeight = '85vh';
    dlg.style.overflowY = 'auto';

    const title = document.createElement('h3');
    title.textContent = 'Photo Album';
    title.style.marginBottom = '12px';
    dlg.appendChild(title);

    // File input
    const fileRow = document.createElement('div');
    fileRow.style.cssText = 'margin:8px 0;';
    const fileLabel = document.createElement('label');
    fileLabel.style.cssText = 'font-size:12px;font-weight:bold;display:block;margin-bottom:4px;';
    fileLabel.textContent = 'Select Images:';
    fileRow.appendChild(fileLabel);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
    fileInput.multiple = true;
    fileInput.style.cssText = 'font-size:12px;';
    fileRow.appendChild(fileInput);
    dlg.appendChild(fileRow);

    // Thumbnail preview area
    const previewLabel = document.createElement('label');
    previewLabel.style.cssText = 'font-size:12px;font-weight:bold;display:block;margin:8px 0 4px;';
    previewLabel.textContent = 'Preview:';
    dlg.appendChild(previewLabel);

    const previewArea = document.createElement('div');
    previewArea.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;min-height:60px;max-height:140px;overflow-y:auto;border:1px solid #ddd;border-radius:4px;padding:6px;background:#f9f9f9;';
    const noPhotosMsg = document.createElement('span');
    noPhotosMsg.style.cssText = 'font-size:11px;color:#999;';
    noPhotosMsg.textContent = 'No images selected.';
    previewArea.appendChild(noPhotosMsg);
    dlg.appendChild(previewArea);

    // Collect loaded images
    const loadedImages = []; // { data: dataURL, name: filename }

    fileInput.addEventListener('change', () => {
      loadedImages.length = 0;
      previewArea.innerHTML = '';

      const selectedFiles = fileInput.files;
      if (!selectedFiles || !selectedFiles.length) {
        previewArea.appendChild(noPhotosMsg);
        return;
      }

      for (let i = 0; i < selectedFiles.length; ++i) {
        const file = selectedFiles[i];
        const reader = new FileReader();
        const idx = i;
        reader.onload = (e) => {
          loadedImages[idx] = { data: e.target.result, name: file.name };

          // Build thumbnail
          const thumb = document.createElement('div');
          thumb.style.cssText = 'width:60px;height:45px;border:1px solid #ccc;border-radius:3px;overflow:hidden;background:#fff;position:relative;';
          const img = document.createElement('img');
          img.src = e.target.result;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          thumb.appendChild(img);

          const nameEl = document.createElement('div');
          nameEl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:8px;padding:1px 2px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;';
          nameEl.textContent = file.name;
          thumb.appendChild(nameEl);

          previewArea.appendChild(thumb);
        };
        reader.readAsDataURL(file);
      }
    });

    // Layout option
    const layoutRow = document.createElement('div');
    layoutRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:10px 0;';
    layoutRow.innerHTML = '<label style="font-size:12px;font-weight:bold;min-width:100px;">Layout:</label>';
    const layoutSel = document.createElement('select');
    layoutSel.style.cssText = 'flex:1;font-size:12px;padding:3px;';
    const layoutOptions = [
      { value: '1', text: '1 picture per slide (full slide)' },
      { value: '2', text: '2 pictures per slide (side by side)' },
      { value: '4', text: '4 pictures per slide (2x2 grid)' },
      { value: '1-title', text: '1 picture with title' }
    ];
    for (const lo of layoutOptions) {
      const opt = document.createElement('option');
      opt.value = lo.value;
      opt.textContent = lo.text;
      layoutSel.appendChild(opt);
    }
    layoutRow.appendChild(layoutSel);
    dlg.appendChild(layoutRow);

    // Frame shape
    const frameRow = document.createElement('div');
    frameRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;';
    frameRow.innerHTML = '<label style="font-size:12px;font-weight:bold;min-width:100px;">Frame Shape:</label>';
    const frameSel = document.createElement('select');
    frameSel.style.cssText = 'flex:1;font-size:12px;padding:3px;';
    const frameOptions = [
      { value: 'rectangle', text: 'Rectangle' },
      { value: 'rounded', text: 'Rounded Rectangle' },
      { value: 'oval', text: 'Oval' }
    ];
    for (const fo of frameOptions) {
      const opt = document.createElement('option');
      opt.value = fo.value;
      opt.textContent = fo.text;
      frameSel.appendChild(opt);
    }
    frameRow.appendChild(frameSel);
    dlg.appendChild(frameRow);

    // Captions
    const captionRow = document.createElement('div');
    captionRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;';
    captionRow.innerHTML = '<label style="font-size:12px;font-weight:bold;min-width:100px;">Captions:</label>';
    const captionSel = document.createElement('select');
    captionSel.style.cssText = 'flex:1;font-size:12px;padding:3px;';
    const captionOptions = [
      { value: 'none', text: 'None' },
      { value: 'filename', text: 'Below picture (filename)' }
    ];
    for (const co of captionOptions) {
      const opt = document.createElement('option');
      opt.value = co.value;
      opt.textContent = co.text;
      captionSel.appendChild(opt);
    }
    captionRow.appendChild(captionSel);
    dlg.appendChild(captionRow);

    // Background color
    const bgRow = document.createElement('div');
    bgRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;';
    bgRow.innerHTML = '<label style="font-size:12px;font-weight:bold;min-width:100px;">Background:</label>';
    const bgColorInput = document.createElement('input');
    bgColorInput.type = 'color';
    bgColorInput.value = '#ffffff';
    bgColorInput.style.cssText = 'width:40px;height:24px;border:none;padding:0;';
    bgRow.appendChild(bgColorInput);
    dlg.appendChild(bgRow);

    // Buttons
    const buttons = document.createElement('div');
    buttons.className = 'dlg-buttons';
    buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid #ccc;border-radius:3px;background:#f0f0f0;cursor:pointer;';
    cancelBtn.addEventListener('click', () => overlay.parentNode.removeChild(overlay));

    const createBtn = document.createElement('button');
    createBtn.textContent = 'Create Album';
    createBtn.className = 'primary';
    createBtn.style.cssText = 'padding:6px 16px;border:1px solid #0078D7;border-radius:3px;background:#0078D7;color:#fff;cursor:pointer;';
    createBtn.addEventListener('click', () => {
      // Collect only loaded images (filter out undefined slots)
      const images = loadedImages.filter(Boolean);
      if (!images.length) {
        User32.MessageBox('Please select at least one image.', 'Photo Album', MB_OK);
        return;
      }

      const layout = layoutSel.value;
      const frame = frameSel.value;
      const caption = captionSel.value;
      const bgColor = bgColorInput.value;

      overlay.parentNode.removeChild(overlay);
      _createPhotoAlbum(images, layout, frame, caption, bgColor);
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(createBtn);
    dlg.appendChild(buttons);

    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
  }

  function _createPhotoAlbum(images, layout, frame, caption, bgColor) {
    pushUndo();

    const canvasW = SlideRenderer.CANVAS_W;
    const canvasH = SlideRenderer.CANVAS_H;
    const padding = 20;
    const captionHeight = caption === 'filename' ? 30 : 0;

    const perSlide = layout === '1-title' ? 1 : parseInt(layout, 10);
    const withTitle = layout === '1-title';

    // Determine frame-specific styling
    const getFrameStyle = (img) => {
      if (frame === 'rounded') {
        img.borderRadius = 12;
        img.borderColor = '#aaa';
        img.borderWidth = 2;
      } else if (frame === 'oval') {
        img.borderRadius = 9999;
        img.borderColor = '#aaa';
        img.borderWidth = 2;
      }
      // rectangle = default, no extra styling
    };

    let fileIndex = 0;
    while (fileIndex < images.length) {
      const slide = createNewSlide('blank', presentation.slides.length);
      slide.background = { type: 'color', value: bgColor };

      const batch = [];
      for (let i = 0; i < perSlide && fileIndex < images.length; ++i, ++fileIndex)
        batch.push(images[fileIndex]);

      if (withTitle && batch.length >= 1) {
        // Title above, image below
        const titleH = 60;
        const titleTb = SlideRenderer.createTextbox(padding, padding, canvasW - 2 * padding, titleH, '');
        titleTb.fontSize = 28;
        titleTb.fontWeight = 'bold';
        titleTb.textAlign = 'center';
        titleTb.color = '#333333';
        const displayName = batch[0].name.replace(/\.[^.]+$/, '');
        titleTb.content = displayName;
        slide.elements.push(titleTb);

        const imgTop = padding + titleH + 10;
        const imgH = canvasH - imgTop - padding - captionHeight;
        const img = SlideRenderer.createImageElement(padding, imgTop, canvasW - 2 * padding, imgH, batch[0].data);
        img.objectFit = 'contain';
        getFrameStyle(img);
        slide.elements.push(img);

        if (caption === 'filename') {
          const capTb = SlideRenderer.createTextbox(padding, imgTop + imgH + 2, canvasW - 2 * padding, captionHeight, '');
          capTb.fontSize = 11;
          capTb.textAlign = 'center';
          capTb.color = '#666666';
          capTb.content = batch[0].name;
          slide.elements.push(capTb);
        }
      } else if (perSlide === 1 && batch.length >= 1) {
        const imgH = canvasH - 2 * padding - captionHeight;
        const img = SlideRenderer.createImageElement(padding, padding, canvasW - 2 * padding, imgH, batch[0].data);
        img.objectFit = 'contain';
        getFrameStyle(img);
        slide.elements.push(img);

        if (caption === 'filename') {
          const capTb = SlideRenderer.createTextbox(padding, padding + imgH + 2, canvasW - 2 * padding, captionHeight, '');
          capTb.fontSize = 11;
          capTb.textAlign = 'center';
          capTb.color = '#666666';
          capTb.content = batch[0].name;
          slide.elements.push(capTb);
        }
      } else if (perSlide === 2) {
        const halfW = (canvasW - 3 * padding) / 2;
        const imgH = canvasH - 2 * padding - captionHeight;
        for (let i = 0; i < batch.length; ++i) {
          const x = padding + i * (halfW + padding);
          const img = SlideRenderer.createImageElement(x, padding, halfW, imgH, batch[i].data);
          img.objectFit = 'contain';
          getFrameStyle(img);
          slide.elements.push(img);

          if (caption === 'filename') {
            const capTb = SlideRenderer.createTextbox(x, padding + imgH + 2, halfW, captionHeight, '');
            capTb.fontSize = 10;
            capTb.textAlign = 'center';
            capTb.color = '#666666';
            capTb.content = batch[i].name;
            slide.elements.push(capTb);
          }
        }
      } else if (perSlide === 4) {
        const halfW = (canvasW - 3 * padding) / 2;
        const cellH = (canvasH - 3 * padding - (captionHeight > 0 ? captionHeight * 2 + padding : 0)) / 2;
        const positions = [
          { x: padding, y: padding },
          { x: padding + halfW + padding, y: padding },
          { x: padding, y: padding + cellH + padding + (captionHeight > 0 ? captionHeight : 0) },
          { x: padding + halfW + padding, y: padding + cellH + padding + (captionHeight > 0 ? captionHeight : 0) }
        ];
        for (let i = 0; i < batch.length; ++i) {
          const pos = positions[i];
          const img = SlideRenderer.createImageElement(pos.x, pos.y, halfW, cellH, batch[i].data);
          img.objectFit = 'contain';
          getFrameStyle(img);
          slide.elements.push(img);

          if (caption === 'filename') {
            const capTb = SlideRenderer.createTextbox(pos.x, pos.y + cellH + 2, halfW, captionHeight, '');
            capTb.fontSize = 9;
            capTb.textAlign = 'center';
            capTb.color = '#666666';
            capTb.content = batch[i].name;
            slide.elements.push(capTb);
          }
        }
      }

      presentation.slides.push(slide);
    }

    currentSlideIndex = presentation.slides.length - 1;
    selectedElements.clear();
    refreshUI();
    markDirty();
  }

  // ===============================================================
  // Theme Application
  // ===============================================================

  function applyTheme(index) {
    if (index < 0 || index >= THEMES.length)
      return;
    pushUndo();
    presentation.theme = THEMES[index];
    const theme = presentation.theme;

    // Update placeholder text colors to match theme
    for (const slide of presentation.slides) {
      for (const el of slide.elements) {
        if (el.type !== 'textbox')
          continue;
        // Title placeholders get title color, body placeholders get body color
        if (el.fontSize >= 24 || el.content === '')
          el.color = theme.colors.title;
        else
          el.color = theme.colors.body;
        el.fontFamily = el.fontSize >= 24 ? theme.fonts.title : theme.fonts.body;
      }
      // Set slide background from theme if not custom
      if (!slide.background)
        slide.background = { type: 'color', value: theme.colors.bg };
    }

    updateThemeGalleryActive();
    refreshUI();
    markDirty();
  }

  function updateThemeGalleryActive() {
    const tiles = document.querySelectorAll('.theme-tile');
    for (let i = 0; i < tiles.length; ++i)
      tiles[i].classList.toggle('active', THEMES[i] && presentation.theme.name === THEMES[i].name);
  }

  // ===============================================================
  // Transitions
  // ===============================================================

  function setTransition(type) {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    pushUndo();
    slide.transition.type = type;
    const durationInput = document.getElementById('transition-duration');
    if (durationInput) {
      const val = parseFloat(durationInput.value);
      if (!isNaN(val) && val >= 0)
        slide.transition.duration = val;
    }
    updateTransitionGalleryActive();
    markDirty();
  }

  function applyTransitionToAll() {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    pushUndo();
    const transition = JSON.parse(JSON.stringify(slide.transition));
    for (const s of presentation.slides)
      s.transition = JSON.parse(JSON.stringify(transition));
    markDirty();
  }

  function previewTransition() {
    const slide = getCurrentSlide();
    if (!slide || !slide.transition)
      return;

    const transitionType = slide.transition.type || 'fade';
    const duration = slide.transition.duration || 0.5;
    const engine = window.parent?.SZ?.TransitionEngine;
    const viewport = canvasViewport;
    if (!viewport)
      return;

    // Create temporary overlay for the preview
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;pointer-events:none;overflow:hidden;';
    viewport.style.position = 'relative';
    viewport.appendChild(overlay);

    const dur = duration * 1000;

    if (engine) {
      // Full engine preview
      const frontLayer = document.createElement('div');
      frontLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
      const backLayer = document.createElement('div');
      backLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
      const canvasClone = slideCanvas.cloneNode(true);
      canvasClone.style.cssText = slideCanvas.style.cssText;
      canvasClone.style.position = 'relative';
      frontLayer.appendChild(canvasClone);
      overlay.appendChild(backLayer);
      overlay.appendChild(frontLayer);
      slideCanvas.style.visibility = 'hidden';
      const subTimers = new Set();
      const resolved = engine.resolveTransition(transitionType);
      engine.runTransition(frontLayer, backLayer, resolved, duration, subTimers);
      setTimeout(() => {
        engine.cancelPending(subTimers);
        for (const id of subTimers) clearInterval(id);
        overlay.remove();
        slideCanvas.style.visibility = '';
      }, dur + 100);
    } else {
      // CSS-based preview fallback for common transition types
      const clone = slideCanvas.cloneNode(true);
      clone.style.cssText = slideCanvas.style.cssText;
      clone.style.position = 'absolute';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.width = '100%';
      clone.style.height = '100%';
      overlay.appendChild(clone);

      const t = transitionType;
      const ms = dur + 'ms';
      const ease = 'cubic-bezier(0.4,0,0.2,1)';

      if (t === 'none' || t === 'cut') {
        clone.style.opacity = '0';
        setTimeout(() => { clone.style.opacity = '1'; }, 50);
      } else if (t.startsWith('fade') || t === 'dissolve' || t === 'crossfade') {
        clone.style.opacity = '0';
        clone.style.transition = `opacity ${ms} ${ease}`;
        requestAnimationFrame(() => { clone.style.opacity = '1'; });
      } else if (t.startsWith('push-') || t.startsWith('cover-')) {
        const dir = t.split('-').pop();
        const from = { left: '100%,0', right: '-100%,0', up: '0,100%', down: '0,-100%' }[dir] || '100%,0';
        clone.style.transform = `translate(${from})`;
        clone.style.transition = `transform ${ms} ${ease}`;
        requestAnimationFrame(() => { clone.style.transform = 'translate(0,0)'; });
      } else if (t.startsWith('wipe-')) {
        const dir = t.split('-').pop();
        const clips = {
          left: ['inset(0 100% 0 0)', 'inset(0 0 0 0)'],
          right: ['inset(0 0 0 100%)', 'inset(0 0 0 0)'],
          up: ['inset(100% 0 0 0)', 'inset(0 0 0 0)'],
          down: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'],
        };
        const [from, to] = clips[dir] || clips.left;
        clone.style.clipPath = from;
        clone.style.transition = `clip-path ${ms} ${ease}`;
        requestAnimationFrame(() => { clone.style.clipPath = to; });
      } else if (t.startsWith('zoom-')) {
        clone.style.transform = t === 'zoom-out' ? 'scale(1.5)' : 'scale(0.3)';
        clone.style.opacity = '0';
        clone.style.transition = `transform ${ms} ${ease}, opacity ${ms} ${ease}`;
        requestAnimationFrame(() => { clone.style.transform = 'scale(1)'; clone.style.opacity = '1'; });
      } else if (t === 'blur') {
        clone.style.filter = 'blur(20px)';
        clone.style.opacity = '0';
        clone.style.transition = `filter ${ms} ${ease}, opacity ${ms} ${ease}`;
        requestAnimationFrame(() => { clone.style.filter = 'blur(0)'; clone.style.opacity = '1'; });
      } else {
        // Generic fade for unsupported types
        clone.style.opacity = '0';
        clone.style.transition = `opacity ${ms} ease`;
        requestAnimationFrame(() => { clone.style.opacity = '1'; });
      }

      setTimeout(() => overlay.remove(), dur + 200);
    }
  }

  function updateTransitionGalleryActive() {
    const slide = getCurrentSlide();
    if (!slide)
      return;
    const tiles = document.querySelectorAll('.transition-tile');
    for (const tile of tiles)
      tile.classList.toggle('active', tile.dataset.transition === slide.transition.type);

    // Sync duration input from current slide's transition duration
    const durationInput = document.getElementById('transition-duration');
    if (durationInput)
      durationInput.value = slide.transition.duration ?? 0.5;
  }

  // ===============================================================
  // Format Background Dialog
  // ===============================================================

  function showFormatBackgroundDialog() {
    const overlay = document.getElementById('dlg-format-bg');
    if (!overlay) {
      // Fallback: prompt for color
      const color = prompt('Background color (hex):', '#ffffff');
      if (color) {
        const slide = getCurrentSlide();
        if (slide) {
          pushUndo();
          slide.background = { type: 'color', value: color };
          renderMainCanvas();
          refreshSlidePanel();
          markDirty();
        }
      }
      return;
    }

    const slide = getCurrentSlide();
    if (!slide)
      return;

    // Pre-fill dialog
    const bgColorInput = document.getElementById('bg-color-input');
    const bgGradient1 = document.getElementById('bg-gradient-1');
    const bgGradient2 = document.getElementById('bg-gradient-2');
    const bgGradientDir = document.getElementById('bg-gradient-dir');

    if (bgColorInput && slide.background?.type === 'color')
      bgColorInput.value = slide.background.value || '#ffffff';

    SZ.Dialog.show('dlg-format-bg').then((result) => {
      if (result !== 'ok')
        return;

      pushUndo();
      const activeTab = document.querySelector('.bg-type-tab.active');
      const bgType = activeTab?.dataset.bgType || 'color';

      if (bgType === 'color') {
        slide.background = { type: 'color', value: bgColorInput?.value || '#ffffff' };
      } else if (bgType === 'gradient') {
        const c1 = bgGradient1?.value || '#ffffff';
        const c2 = bgGradient2?.value || '#000000';
        const dir = bgGradientDir?.value || 'to bottom';
        slide.background = { type: 'gradient', value: 'linear-gradient(' + dir + ', ' + c1 + ', ' + c2 + ')' };
      } else if (bgType === 'image') {
        // Already handled by image picker
      }

      renderMainCanvas();
      refreshSlidePanel();
      markDirty();
    });
  }

  // ===============================================================
  // Slideshow
  // ===============================================================

  function startSlideshow(fromIndex) {
    SlideshowMode.startSlideshow(fromIndex);
  }

  // ===============================================================
  // View Switching
  // ===============================================================

  function setView(view) {
    currentView = view;

    document.body.classList.remove('view-normal', 'view-sorter', 'view-notes');
    document.body.classList.add('view-' + view);

    if (view === 'sorter')
      renderSorterView();
    else if (view === 'notes' || view === 'normal')
      refreshUI();
  }

  function renderSorterView() {
    if (!slideSorterEl)
      return;

    slideSorterEl.innerHTML = '';

    for (let i = 0; i < presentation.slides.length; ++i) {
      const slide = presentation.slides[i];
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;margin-bottom:20px;';

      const thumb = document.createElement('div');
      thumb.className = 'sort-thumb' + (i === currentSlideIndex ? ' active' : '');
      thumb.dataset.index = i;
      thumb.draggable = true;

      const content = document.createElement('div');
      content.style.width = '100%';
      content.style.height = '100%';
      content.style.overflow = 'hidden';
      content.style.pointerEvents = 'none';
      thumb.appendChild(content);

      setTimeout(() => {
        SlideRenderer.renderThumbnail(slide, content, presentation.theme);
      }, 0);

      // Click to select
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        currentSlideIndex = i;
        renderSorterView();
      });

      // Double-click to return to normal view
      thumb.addEventListener('dblclick', () => {
        currentSlideIndex = i;
        setView('normal');
      });

      // Drag-and-drop reorder
      thumb.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(i));
        e.dataTransfer.effectAllowed = 'move';
        thumb.style.opacity = '0.5';
      });

      thumb.addEventListener('dragend', () => {
        thumb.style.opacity = '';
      });

      thumb.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        thumb.classList.add('drag-over');
      });

      thumb.addEventListener('dragleave', () => {
        thumb.classList.remove('drag-over');
      });

      thumb.addEventListener('drop', (e) => {
        e.preventDefault();
        thumb.classList.remove('drag-over');
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIndex = i;
        if (isNaN(fromIndex) || fromIndex === toIndex)
          return;
        pushUndo();
        const movedSlide = presentation.slides.splice(fromIndex, 1)[0];
        presentation.slides.splice(toIndex, 0, movedSlide);
        currentSlideIndex = toIndex;
        renderSorterView();
        markDirty();
      });

      wrapper.appendChild(thumb);

      const label = document.createElement('div');
      label.className = 'sort-thumb-label';
      label.style.position = 'relative';
      label.textContent = 'Slide ' + (i + 1);
      wrapper.appendChild(label);

      slideSorterEl.appendChild(wrapper);
    }
  }

  // ===============================================================
  // Zoom
  // ===============================================================

  function zoomFit() {
    if (!editorArea)
      return;
    const availW = editorArea.clientWidth - 40;
    const availH = editorArea.clientHeight - 40;
    const scaleW = availW / (presentation.slideWidth || 960);
    const scaleH = availH / (presentation.slideHeight || 540);
    currentZoom = Math.round(Math.max(10, Math.min(400, Math.min(scaleW, scaleH) * 100)));
    renderMainCanvas();
    updateStatusBar();
  }

  // ===============================================================
  // Notes Editor
  // ===============================================================

  function updateNotesEditor() {
    if (!notesEditor)
      return;
    const slide = getCurrentSlide();
    notesEditor.value = slide ? (slide.notes || '') : '';
  }

  // ===============================================================
  // Status Bar
  // ===============================================================

  function updateStatusBar() {
    if (slideCountEl)
      slideCountEl.textContent = 'Slide ' + (currentSlideIndex + 1) + ' of ' + (presentation ? presentation.slides.length : 0);
    if (zoomStatusEl)
      zoomStatusEl.textContent = currentZoom + '%';
  }

  // ===============================================================
  // File Operations
  // ===============================================================

  function doNew() {
    if (dirty) {
      promptSaveChanges((result) => {
        if (result === 'yes')
          doSave(() => resetPresentation());
        else if (result === 'no')
          resetPresentation();
      });
      return;
    }
    resetPresentation();
  }

  function resetPresentation() {
    presentation = createNewPresentation();
    currentSlideIndex = 0;
    selectedElements.clear();
    undoStack = [];
    redoStack = [];
    clipboardElements = [];
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    currentZoom = 100;
    refreshUI();
    updateTitle();
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
    const result = await ComDlg32.ImportFile({ accept: '.pptx', readAs: 'arrayBuffer' });
    if (result.cancelled || !result.data)
      return;

    try {
      if (PresentationsApp.PptxEngine) {
        const loaded = await PresentationsApp.PptxEngine.loadPptx(result.data);
        if (loaded) {
          presentation = loaded;
          if (!presentation.headerFooter)
            presentation.headerFooter = { showDate: false, dateText: '', showFooter: false, footerText: '', showSlideNumber: false, dontShowOnTitle: true };
          currentSlideIndex = 0;
          selectedElements.clear();
          undoStack = [];
          redoStack = [];
          currentFileName = result.name || 'Untitled';
          currentFilePath = null;
          dirty = false;
          refreshUI();
          updateTitle();
          return;
        }
      }
    } catch (err) {
      await User32.MessageBox('Could not open PPTX: ' + (err.message || err), 'Presentations', MB_OK);
    }
  }

  function doSave(callback) {
    doSaveAs(callback);
  }

  async function doSaveAs(callback) {
    const baseName = currentFileName.replace(/\.[^.]+$/, '') || 'Untitled';
    let data;

    try {
      if (PresentationsApp.PptxEngine) {
        data = await PresentationsApp.PptxEngine.savePptx(presentation);
      } else {
        // Fallback: save as JSON
        data = JSON.stringify(presentation, null, 2);
      }
    } catch (err) {
      await User32.MessageBox('Could not save presentation: ' + (err.message || err), 'Presentations', MB_OK);
      return;
    }

    if (data) {
      const filename = baseName + '.pptx';
      ComDlg32.ExportFile(data, filename, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      currentFileName = filename;
      dirty = false;
      updateTitle();
    }

    if (typeof callback === 'function')
      callback();
  }

  async function doExportPng() {
    const slide = getCurrentSlide();
    if (!slide)
      return;

    // Render to an off-screen container, then use html2canvas-style approach
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    SlideRenderer.renderSlide(slide, container, { editable: false, scale: 1, showGuides: false });

    // Use a canvas to capture
    try {
      const canvas = document.createElement('canvas');
      canvas.width = presentation.slideWidth || 960;
      canvas.height = presentation.slideHeight || 540;
      const ctx = canvas.getContext('2d');

      // Draw white background
      ctx.fillStyle = '#ffffff';
      if (slide.background?.type === 'color' && slide.background.value)
        ctx.fillStyle = slide.background.value;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw elements as basic rectangles with text (simplified export)
      for (const el of slide.elements) {
        if (el.type === 'textbox') {
          ctx.fillStyle = el.backgroundColor && el.backgroundColor !== 'transparent' ? el.backgroundColor : 'transparent';
          if (ctx.fillStyle !== 'transparent')
            ctx.fillRect(el.x, el.y, el.w, el.h);
          ctx.fillStyle = el.color || '#000000';
          ctx.font = (el.fontStyle === 'italic' ? 'italic ' : '') + (el.fontWeight === 'bold' ? 'bold ' : '') + (el.fontSize || 18) + 'px ' + (el.fontFamily || 'sans-serif');
          ctx.textAlign = el.textAlign || 'left';
          ctx.textBaseline = 'top';
          const textX = el.textAlign === 'center' ? el.x + el.w / 2 : el.textAlign === 'right' ? el.x + el.w : el.x + 8;
          // Strip HTML tags for plain text
          const plainText = (el.content || '').replace(/<[^>]*>/g, '');
          ctx.fillText(plainText, textX, el.y + 8, el.w - 16);
        } else if (el.type === 'shape') {
          ctx.fillStyle = el.fillColor || '#4472c4';
          ctx.fillRect(el.x, el.y, el.w, el.h);
        }
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const baseName = currentFileName.replace(/\.[^.]+$/, '') || 'slide';
          ComDlg32.ExportFile(blob, baseName + '_slide' + (currentSlideIndex + 1) + '.png', 'image/png');
        }
      }, 'image/png');
    } finally {
      document.body.removeChild(container);
    }
  }

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

  // ===============================================================
  // Dialog Helpers
  // ===============================================================

  function promptSaveChanges(callback) {
    const dlg = document.getElementById('dlg-save-changes');
    if (dlg) {
      SZ.Dialog.show('dlg-save-changes').then(callback);
    } else {
      // Fallback: use MessageBox
      User32.MessageBox('Do you want to save changes to ' + currentFileName + '?', 'Presentations', MB_YESNOCANCEL).then((result) => {
        if (result === IDYES)
          callback('yes');
        else if (result === IDNO)
          callback('no');
        // Cancel: do nothing
      });
    }
  }

  // ===============================================================
  // Keyboard Shortcuts
  // ===============================================================

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Escape
      if (e.key === 'Escape') {
        if (SlideshowMode.isActive()) {
          SlideshowMode.stopSlideshow();
        } else if (presFormatPainter && presFormatPainter.isActive) {
          deactivateFormatPainter();
        } else if (selectedElements.size) {
          selectedElements.clear();
          renderMainCanvas();
        }
        return;
      }

      // F5: slideshow from beginning
      if (e.key === 'F5' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        startSlideshow(0);
        return;
      }

      // Shift+F5: slideshow from current
      if (e.key === 'F5' && e.shiftKey) {
        e.preventDefault();
        startSlideshow(currentSlideIndex);
        return;
      }

      // Delete/Backspace: delete selected elements (only if not editing text)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey) {
        const focused = slideCanvas?.querySelector('[contenteditable]:focus');
        if (!focused && selectedElements.size) {
          e.preventDefault();
          deleteSelectedElements();
        }
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
        case 'z':
          e.preventDefault();
          handleAction('undo');
          break;
        case 'y':
          e.preventDefault();
          handleAction('redo');
          break;
        case 'c':
          e.preventDefault();
          handleAction('copy');
          break;
        case 'v':
          e.preventDefault();
          handleAction('paste');
          break;
        case 'x':
          e.preventDefault();
          handleAction('cut');
          break;
        case 'a':
          e.preventDefault();
          handleAction('select-all');
          break;
        case 'f':
          e.preventDefault();
          handleAction('find-replace');
          break;
        case 'h':
          e.preventDefault();
          handleAction('find-replace');
          break;
        case 'g':
          e.preventDefault();
          if (e.shiftKey)
            handleAction('ungroup');
          else
            handleAction('group');
          break;
      }
    });
  }

  // ===============================================================
  // Transition & Theme Gallery Population
  // ===============================================================

  function _transitionIcon(type) {
    // Returns an SVG string representing the transition visually
    const W = 44, H = 28;
    const bg = '#dde4f0', fg = '#4472c4', fg2 = '#ed7d31';
    const rect = (x, y, w, h, fill, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${o ? ' ' + o : ''}/>`;
    const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fg2}" stroke-width="2" marker-end="url(#ah)"/>`;
    const defs = `<defs><marker id="ah" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto"><path d="M0,0 L5,2 L0,4" fill="${fg2}"/></marker></defs>`;
    const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${rect(0, 0, W, H, bg)}${inner}</svg>`;

    const cx = W / 2, cy = H / 2;
    switch (type) {
      case 'none': return wrap(rect(4, 3, 36, 22, '#fff', 'stroke="#bbb" stroke-dasharray="2,2"'));
      case 'fade': case 'dissolve': case 'crossfade':
        return wrap(rect(4, 3, 16, 22, fg, 'opacity="0.8"') + rect(24, 3, 16, 22, fg, 'opacity="0.3"'));
      case 'cut': return wrap(rect(4, 3, 16, 22, fg) + rect(24, 3, 16, 22, fg2));
      case 'fade-black': return wrap(rect(4, 3, 16, 22, fg) + rect(24, 3, 16, 22, '#222'));
      case 'fade-white': return wrap(rect(4, 3, 16, 22, fg) + rect(24, 3, 16, 22, '#fff', 'stroke="#bbb"'));
      case 'push-left': return wrap(rect(6, 5, 14, 18, fg) + rect(26, 5, 14, 18, fg2) + arrow(36, cy, 8, cy));
      case 'push-right': return wrap(rect(6, 5, 14, 18, fg) + rect(26, 5, 14, 18, fg2) + arrow(8, cy, 36, cy));
      case 'push-up': return wrap(rect(8, 3, 12, 10, fg) + rect(24, 3, 12, 10, fg2) + arrow(cx, 24, cx, 5));
      case 'push-down': return wrap(rect(8, 15, 12, 10, fg) + rect(24, 15, 12, 10, fg2) + arrow(cx, 4, cx, 23));
      case 'cover-left': case 'uncover-right': return wrap(rect(6, 5, 18, 18, fg, 'opacity="0.4"') + rect(20, 5, 18, 18, fg2) + arrow(38, cy, 12, cy));
      case 'cover-right': case 'uncover-left': return wrap(rect(20, 5, 18, 18, fg, 'opacity="0.4"') + rect(6, 5, 18, 18, fg2) + arrow(6, cy, 32, cy));
      case 'cover-up': case 'uncover-down': return wrap(rect(10, 3, 24, 12, fg, 'opacity="0.4"') + rect(10, 13, 24, 12, fg2) + arrow(cx, 25, cx, 5));
      case 'cover-down': case 'uncover-up': return wrap(rect(10, 13, 24, 12, fg, 'opacity="0.4"') + rect(10, 3, 24, 12, fg2) + arrow(cx, 3, cx, 23));
      case 'wipe-left': return wrap(rect(4, 3, 18, 22, fg) + rect(22, 3, 18, 22, fg2, 'opacity="0.5"') + `<line x1="22" y1="3" x2="22" y2="25" stroke="${fg2}" stroke-width="2"/>`);
      case 'wipe-right': return wrap(rect(22, 3, 18, 22, fg) + rect(4, 3, 18, 22, fg2, 'opacity="0.5"') + `<line x1="22" y1="3" x2="22" y2="25" stroke="${fg2}" stroke-width="2"/>`);
      case 'wipe-up': return wrap(rect(4, 3, 36, 11, fg) + rect(4, 14, 36, 11, fg2, 'opacity="0.5"') + `<line x1="4" y1="14" x2="40" y2="14" stroke="${fg2}" stroke-width="2"/>`);
      case 'wipe-down': return wrap(rect(4, 14, 36, 11, fg) + rect(4, 3, 36, 11, fg2, 'opacity="0.5"') + `<line x1="4" y1="14" x2="40" y2="14" stroke="${fg2}" stroke-width="2"/>`);
      case 'split-horizontal-out': case 'split-horizontal-in':
        return wrap(rect(4, 3, 36, 8, fg) + rect(4, 17, 36, 8, fg) + rect(4, 11, 36, 6, fg2, 'opacity="0.5"'));
      case 'split-vertical-out': case 'split-vertical-in':
        return wrap(rect(4, 3, 14, 22, fg) + rect(26, 3, 14, 22, fg) + rect(18, 3, 8, 22, fg2, 'opacity="0.5"'));
      case 'circle-in': case 'circle-out':
        return wrap(`<circle cx="${cx}" cy="${cy}" r="10" fill="${fg}"/><circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="${fg2}" stroke-width="1.5"/>`);
      case 'diamond-in': case 'diamond-out':
        return wrap(`<polygon points="${cx},${cy - 10} ${cx + 14},${cy} ${cx},${cy + 10} ${cx - 14},${cy}" fill="${fg}"/><polygon points="${cx},${cy - 10} ${cx + 14},${cy} ${cx},${cy + 10} ${cx - 14},${cy}" fill="none" stroke="${fg2}" stroke-width="1.5"/>`);
      case 'clock-cw': case 'clock-ccw':
        return wrap(`<circle cx="${cx}" cy="${cy}" r="10" fill="${fg}" opacity="0.4"/><path d="M${cx},${cy} L${cx},${cy - 10} A10,10 0 0,1 ${cx + 10},${cy} Z" fill="${fg}"/>`);
      case 'wedge':
        return wrap(`<polygon points="${cx},${cy - 12} ${cx + 16},${cy + 12} ${cx - 16},${cy + 12}" fill="${fg}" opacity="0.6"/>`);
      case 'blinds-horizontal': case 'blinds-vertical': {
        const horiz = type.includes('horizontal');
        let bars = '';
        for (let i = 0; i < 5; ++i)
          bars += horiz ? rect(4, 3 + i * 5, 36, 3, i % 2 ? fg : fg2, 'opacity="0.7"') : rect(4 + i * 8, 3, 4, 22, i % 2 ? fg : fg2, 'opacity="0.7"');
        return wrap(bars);
      }
      case 'checkerboard': {
        let cells = '';
        for (let r = 0; r < 4; ++r)
          for (let c = 0; c < 6; ++c)
            cells += rect(4 + c * 6, 3 + r * 6, 6, 6, (r + c) % 2 ? fg : '#fff');
        return wrap(cells);
      }
      case 'zoom-in': return wrap(`<rect x="10" y="6" width="24" height="16" fill="${fg}" opacity="0.3"/><rect x="15" y="9" width="14" height="10" fill="${fg}"/>`);
      case 'zoom-out': return wrap(`<rect x="15" y="9" width="14" height="10" fill="${fg}" opacity="0.3"/><rect x="10" y="6" width="24" height="16" fill="${fg}"/>`);
      case 'zoom-rotate': case 'spin-cw': case 'spin-ccw':
        return wrap(`<g transform="rotate(15,${cx},${cy})"><rect x="12" y="6" width="20" height="16" fill="${fg}" opacity="0.4"/></g><rect x="12" y="6" width="20" height="16" fill="${fg2}" opacity="0.5"/>`);
      case 'flip-horizontal': return wrap(`<rect x="4" y="3" width="17" height="22" fill="${fg}"/><rect x="23" y="5" width="17" height="18" fill="${fg}" opacity="0.3" transform="skewY(5)"/>`);
      case 'flip-vertical': return wrap(`<rect x="6" y="3" width="32" height="10" fill="${fg}"/><rect x="8" y="15" width="28" height="10" fill="${fg}" opacity="0.3"/>`);
      case 'cube-left': case 'cube-right': case 'cube-up': case 'cube-down':
        return wrap(`<polygon points="6,5 20,3 20,25 6,23" fill="${fg}" opacity="0.6"/><polygon points="20,3 38,5 38,23 20,25" fill="${fg2}" opacity="0.5"/>`);
      case 'blur': return wrap(rect(8, 5, 28, 18, fg, 'opacity="0.3" rx="4"') + rect(10, 7, 24, 14, fg, 'opacity="0.6" rx="3"'));
      case 'glitch':
        return wrap(rect(4, 3, 36, 6, fg) + rect(8, 9, 32, 5, fg2, 'opacity="0.6"') + rect(2, 15, 38, 5, fg) + rect(6, 20, 34, 5, fg2, 'opacity="0.6"'));
      case 'morph': return wrap(`<circle cx="14" cy="${cy}" r="8" fill="${fg}"/><rect x="28" y="6" width="12" height="16" fill="${fg}" rx="2"/><path d="M22,${cy} L26,${cy - 3} L26,${cy + 3} Z" fill="${fg2}"/>`);
      case 'pixelate': {
        let px = '';
        for (let r = 0; r < 4; ++r)
          for (let c = 0; c < 6; ++c)
            px += rect(4 + c * 6, 3 + r * 6, 5, 5, (r * 6 + c) % 3 === 0 ? fg : (r * 6 + c) % 3 === 1 ? fg2 : '#fff', 'opacity="0.7"');
        return wrap(px);
      }
      case 'bars-random': {
        let bars = '';
        const heights = [18, 10, 22, 14, 8, 20];
        for (let i = 0; i < 6; ++i)
          bars += rect(4 + i * 6, 25 - heights[i], 5, heights[i], i % 2 ? fg : fg2, 'opacity="0.7"');
        return wrap(bars);
      }
      case 'comb-horizontal': case 'comb-vertical': {
        const horiz = type.includes('horizontal');
        let teeth = '';
        for (let i = 0; i < 5; ++i)
          teeth += horiz ? rect(4, 3 + i * 5, 20 + (i % 2 ? 10 : 0), 4, fg, 'opacity="0.7"') : rect(4 + i * 8, 3, 6, 12 + (i % 2 ? 8 : 0), fg, 'opacity="0.7"');
        return wrap(teeth);
      }
      case 'reveal-left': case 'reveal-right': {
        const left = type.includes('left');
        return wrap(rect(left ? 4 : 22, 3, 18, 22, fg, 'opacity="0.3"') + rect(left ? 22 : 4, 3, 18, 22, fg2));
      }
      default: return wrap(rect(8, 5, 28, 18, '#ddd', 'stroke="#bbb"') + `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="7" fill="#999">?</text>`);
    }
  }

  function populateTransitionGallery() {
    const gallery = document.querySelector('.transition-gallery');
    if (!gallery)
      return;

    const transitions = ALL_TRANSITIONS;

    gallery.innerHTML = '';
    for (const t of transitions) {
      const tile = document.createElement('div');
      tile.className = 'transition-tile';
      tile.dataset.transition = t;
      tile.innerHTML = _transitionIcon(t);
      tile.title = t.replace(/-/g, ' ');
      tile.addEventListener('click', () => handleAction('set-transition-' + t));
      gallery.appendChild(tile);
    }

    updateTransitionGalleryActive();
  }

  function populateThemeGallery() {
    const gallery = document.querySelector('.theme-gallery');
    if (!gallery)
      return;

    gallery.innerHTML = '';
    for (let i = 0; i < THEMES.length; ++i) {
      const theme = THEMES[i];
      const tile = document.createElement('div');
      tile.className = 'theme-tile';
      tile.title = theme.name;

      const header = document.createElement('div');
      header.className = 'theme-tile-header';
      header.style.backgroundColor = theme.colors.bg;
      header.style.color = theme.colors.title;
      header.textContent = 'Aa';
      tile.appendChild(header);

      const colors = document.createElement('div');
      colors.className = 'theme-tile-colors';
      const colorList = [theme.colors.title, theme.colors.accent1, theme.colors.accent2, theme.colors.body];
      for (const c of colorList) {
        const span = document.createElement('span');
        span.style.backgroundColor = c;
        colors.appendChild(span);
      }
      tile.appendChild(colors);

      tile.addEventListener('click', () => handleAction('apply-theme-' + i));
      gallery.appendChild(tile);
    }

    updateThemeGalleryActive();
  }

  // ===============================================================
  // Duration Input Wiring
  // ===============================================================

  function wireTransitionDuration() {
    const durationInput = document.getElementById('transition-duration');
    if (!durationInput)
      return;

    durationInput.addEventListener('change', () => {
      const slide = getCurrentSlide();
      if (!slide)
        return;
      const val = parseFloat(durationInput.value);
      if (!isNaN(val) && val >= 0) {
        pushUndo();
        slide.transition.duration = val;
        markDirty();
      }
    });
  }

  // ===============================================================
  // Background Dialog Tab Wiring
  // ===============================================================

  function wireBackgroundDialogTabs() {
    const tabs = document.querySelectorAll('.bg-type-tab');
    for (const tab of tabs) {
      tab.addEventListener('click', () => {
        for (const t of tabs)
          t.classList.remove('active');
        tab.classList.add('active');

        const sections = document.querySelectorAll('.bg-section');
        for (const s of sections)
          s.classList.remove('active');

        const target = document.getElementById('bg-section-' + tab.dataset.bgType);
        if (target)
          target.classList.add('active');
      });
    }

    // Gradient preview
    const g1 = document.getElementById('bg-gradient-1');
    const g2 = document.getElementById('bg-gradient-2');
    const gDir = document.getElementById('bg-gradient-dir');
    const preview = document.querySelector('.gradient-preview');

    const updatePreview = () => {
      if (!preview || !g1 || !g2 || !gDir)
        return;
      preview.style.background = 'linear-gradient(' + (gDir.value || 'to bottom') + ', ' + (g1.value || '#fff') + ', ' + (g2.value || '#000') + ')';
    };

    if (g1) g1.addEventListener('input', updatePreview);
    if (g2) g2.addEventListener('input', updatePreview);
    if (gDir) gDir.addEventListener('change', updatePreview);
  }

  // ===============================================================
  // Format Painter Double-Click Wiring
  // ===============================================================

  function wireFormatPainterDblClick() {
    initFormatPainter();
  }

  // ===============================================================
  // Animation System (Features 11-13)
  // ===============================================================

  function addAnimationToSelected(effect) {
    if (!AnimationEngine)
      return;
    const slide = getCurrentSlide();
    if (!slide)
      return;

    if (!selectedElements.size) {
      User32.MessageBox('Please select an element first.', 'Animation', MB_OK);
      return;
    }

    pushUndo();

    const durationSelect = document.getElementById('anim-duration');
    const triggerSelect = document.getElementById('anim-trigger');
    const delayInput = document.getElementById('anim-delay');
    const duration = durationSelect ? parseInt(durationSelect.value, 10) : 500;
    const trigger = triggerSelect ? triggerSelect.value : 'on-click';
    const delay = delayInput ? parseInt(delayInput.value, 10) : 0;

    for (const elId of selectedElements) {
      const element = slide.elements.find(el => el.id === elId);
      if (!element)
        continue;
      const anim = AnimationEngine.addAnimation(element, effect, { duration, trigger, delay });
      if (anim)
        selectedAnimationId = anim.id;
    }

    markDirty();
    refreshAnimationPane();
  }

  function removeSelectedAnimation() {
    if (!AnimationEngine || !selectedAnimationId)
      return;
    const slide = getCurrentSlide();
    if (!slide)
      return;

    pushUndo();

    for (const el of slide.elements) {
      if (el.animations) {
        const idx = el.animations.findIndex(a => a.id === selectedAnimationId);
        if (idx >= 0) {
          el.animations.splice(idx, 1);
          break;
        }
      }
    }

    selectedAnimationId = null;
    markDirty();
    refreshAnimationPane();
  }

  function updateSelectedAnimationTrigger() {
    if (!selectedAnimationId)
      return;
    const slide = getCurrentSlide();
    if (!slide)
      return;
    const triggerSelect = document.getElementById('anim-trigger');
    if (!triggerSelect)
      return;

    pushUndo();

    for (const el of slide.elements) {
      if (!el.animations)
        continue;
      const anim = el.animations.find(a => a.id === selectedAnimationId);
      if (anim) {
        anim.trigger = triggerSelect.value;
        break;
      }
    }

    markDirty();
    refreshAnimationPane();
  }

  function updateSelectedAnimationDuration() {
    if (!selectedAnimationId)
      return;
    const slide = getCurrentSlide();
    if (!slide)
      return;
    const durationSelect = document.getElementById('anim-duration');
    if (!durationSelect)
      return;

    pushUndo();

    for (const el of slide.elements) {
      if (!el.animations)
        continue;
      const anim = el.animations.find(a => a.id === selectedAnimationId);
      if (anim) {
        anim.duration = parseInt(durationSelect.value, 10);
        break;
      }
    }

    markDirty();
    refreshAnimationPane();
  }

  function toggleAnimationPane() {
    animationPaneVisible = !animationPaneVisible;
    const pane = document.getElementById('animation-pane');
    const layout = document.getElementById('app-layout');
    if (pane)
      pane.style.display = animationPaneVisible ? '' : 'none';
    if (layout) {
      if (animationPaneVisible)
        layout.classList.add('with-animation-pane');
      else
        layout.classList.remove('with-animation-pane');
    }
    if (animationPaneVisible)
      refreshAnimationPane();
  }

  function refreshAnimationPane() {
    if (!animationPaneVisible)
      return;
    const list = document.getElementById('animation-pane-list');
    if (!list)
      return;

    list.innerHTML = '';

    if (!AnimationEngine) {
      list.innerHTML = '<div class="anim-empty-msg">Animation engine not loaded.</div>';
      return;
    }

    const slide = getCurrentSlide();
    if (!slide) {
      list.innerHTML = '<div class="anim-empty-msg">No slide selected.</div>';
      return;
    }

    const anims = AnimationEngine.getAnimationsForSlide(slide);
    if (!anims.length) {
      list.innerHTML = '<div class="anim-empty-msg">No animations on this slide.<br>Select an element and add an animation.</div>';
      return;
    }

    const triggerIcons = {
      'on-click': '\u25B6',
      'with-previous': '\u25B6\u25B6',
      'after-previous': '\u23F5'
    };

    const categoryLetters = {
      'entrance': 'E',
      'emphasis': 'M',
      'exit': 'X',
      'motion-path': 'P'
    };

    for (let i = 0; i < anims.length; ++i) {
      const entry = anims[i];
      const { elementId, elementName, anim } = entry;
      const preset = AnimationEngine.PRESETS[anim.effect];

      const item = document.createElement('div');
      item.className = 'anim-item' + (anim.id === selectedAnimationId ? ' selected' : '');
      item.dataset.animId = anim.id;
      item.dataset.elementId = elementId;
      item.draggable = true;

      // Category icon
      const catIcon = document.createElement('span');
      catIcon.className = 'anim-category-icon ' + (preset?.category || 'entrance');
      catIcon.textContent = categoryLetters[preset?.category] || '?';
      item.appendChild(catIcon);

      // Trigger icon
      const trigIcon = document.createElement('span');
      trigIcon.className = 'anim-trigger-icon';
      trigIcon.textContent = triggerIcons[anim.trigger] || '\u25B6';
      trigIcon.title = anim.trigger;
      item.appendChild(trigIcon);

      // Name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'anim-name';
      nameSpan.textContent = (preset?.label || anim.effect) + ' - ' + elementName;
      nameSpan.title = nameSpan.textContent;
      item.appendChild(nameSpan);

      // Duration badge
      const badge = document.createElement('span');
      badge.className = 'anim-badge';
      badge.textContent = (anim.duration / 1000).toFixed(1) + 's';
      item.appendChild(badge);

      // Click to select
      item.addEventListener('click', () => {
        selectedAnimationId = anim.id;
        // Also select the element on the canvas
        selectedElements.clear();
        selectedElements.add(elementId);
        refreshAnimationPane();
        renderMainCanvas();
        _syncAnimationControls(anim);
      });

      // Drag reorder support
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', anim.id);
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.style.borderTopColor = '#4472c4';
        item.style.borderTopWidth = '2px';
      });

      item.addEventListener('dragleave', () => {
        item.style.borderTopColor = '';
        item.style.borderTopWidth = '';
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.style.borderTopColor = '';
        item.style.borderTopWidth = '';
        const draggedAnimId = e.dataTransfer.getData('text/plain');
        if (draggedAnimId && draggedAnimId !== anim.id)
          _reorderAnimationInSlide(draggedAnimId, anim.id);
      });

      list.appendChild(item);
    }
  }

  function _syncAnimationControls(anim) {
    const triggerSelect = document.getElementById('anim-trigger');
    const durationSelect = document.getElementById('anim-duration');
    const delayInput = document.getElementById('anim-delay');

    if (triggerSelect)
      triggerSelect.value = anim.trigger || 'on-click';
    if (durationSelect) {
      // Find closest option
      const opts = Array.from(durationSelect.options);
      const exact = opts.find(o => parseInt(o.value, 10) === anim.duration);
      if (exact)
        durationSelect.value = exact.value;
    }
    if (delayInput)
      delayInput.value = anim.delay || 0;
  }

  function _reorderAnimationInSlide(draggedAnimId, targetAnimId) {
    const slide = getCurrentSlide();
    if (!slide)
      return;

    // Collect all animations in order
    const allAnims = [];
    for (const el of slide.elements) {
      if (el.animations) {
        for (const a of el.animations)
          allAnims.push({ anim: a, element: el });
      }
    }

    const draggedIdx = allAnims.findIndex(e => e.anim.id === draggedAnimId);
    const targetIdx = allAnims.findIndex(e => e.anim.id === targetAnimId);
    if (draggedIdx < 0 || targetIdx < 0 || draggedIdx === targetIdx)
      return;

    pushUndo();

    // Remove from source element
    const draggedEntry = allAnims[draggedIdx];
    const srcEl = draggedEntry.element;
    const srcIdx = srcEl.animations.indexOf(draggedEntry.anim);
    if (srcIdx >= 0)
      srcEl.animations.splice(srcIdx, 1);

    // Insert at target position within target element
    const targetEntry = allAnims[targetIdx];
    const destEl = targetEntry.element;
    const destIdx = destEl.animations.indexOf(targetEntry.anim);
    if (destIdx >= 0)
      destEl.animations.splice(destIdx, 0, draggedEntry.anim);
    else
      destEl.animations.push(draggedEntry.anim);

    markDirty();
    refreshAnimationPane();
  }

  function previewCurrentSlideAnimations() {
    if (!AnimationEngine)
      return;
    const slide = getCurrentSlide();
    if (!slide)
      return;

    const timeline = AnimationEngine.buildTimeline(slide);
    if (!timeline.length)
      return;

    const canvas = slideCanvas.querySelector('.slide-canvas');
    if (!canvas)
      return;

    const player = AnimationEngine.createPlayer(canvas, timeline);
    player.initializeVisibility();

    // Auto-play all steps sequentially
    let step = 0;
    const playNext = () => {
      if (step >= player.getTotalSteps()) {
        // Reset after a short pause
        setTimeout(() => player.reset(), 500);
        return;
      }
      player.playStep(step);
      ++step;
      // Calculate max time for this step
      const stepData = timeline[step - 1];
      let maxTime = 0;
      for (const e of stepData.animations) {
        const end = e.startTime + e.duration;
        if (end > maxTime)
          maxTime = end;
      }
      setTimeout(playNext, maxTime + 100);
    };
    playNext();
  }

  function wireAnimationPane() {
    const closeBtn = document.getElementById('anim-pane-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => toggleAnimationPane());
    }

    const moveUpBtn = document.getElementById('anim-pane-move-up');
    const moveDownBtn = document.getElementById('anim-pane-move-down');

    if (moveUpBtn) {
      moveUpBtn.addEventListener('click', () => {
        if (!selectedAnimationId || !AnimationEngine)
          return;
        const slide = getCurrentSlide();
        if (!slide)
          return;
        pushUndo();
        for (const el of slide.elements) {
          if (el.animations) {
            const idx = el.animations.findIndex(a => a.id === selectedAnimationId);
            if (idx > 0) {
              AnimationEngine.reorderAnimation(el, selectedAnimationId, -1);
              markDirty();
              refreshAnimationPane();
              return;
            }
          }
        }
      });
    }

    if (moveDownBtn) {
      moveDownBtn.addEventListener('click', () => {
        if (!selectedAnimationId || !AnimationEngine)
          return;
        const slide = getCurrentSlide();
        if (!slide)
          return;
        pushUndo();
        for (const el of slide.elements) {
          if (el.animations) {
            const idx = el.animations.findIndex(a => a.id === selectedAnimationId);
            if (idx >= 0 && idx < el.animations.length - 1) {
              AnimationEngine.reorderAnimation(el, selectedAnimationId, 1);
              markDirty();
              refreshAnimationPane();
              return;
            }
          }
        }
      });
    }

    // Wire trigger and duration change events
    const triggerSelect = document.getElementById('anim-trigger');
    const durationSelect = document.getElementById('anim-duration');
    const delayInput = document.getElementById('anim-delay');

    if (triggerSelect) {
      triggerSelect.addEventListener('change', () => {
        if (selectedAnimationId)
          updateSelectedAnimationTrigger();
      });
    }

    if (durationSelect) {
      durationSelect.addEventListener('change', () => {
        if (selectedAnimationId)
          updateSelectedAnimationDuration();
      });
    }

    if (delayInput) {
      delayInput.addEventListener('change', () => {
        if (!selectedAnimationId)
          return;
        const slide = getCurrentSlide();
        if (!slide)
          return;
        pushUndo();
        for (const el of slide.elements) {
          if (!el.animations)
            continue;
          const anim = el.animations.find(a => a.id === selectedAnimationId);
          if (anim) {
            anim.delay = parseInt(delayInput.value, 10) || 0;
            break;
          }
        }
        markDirty();
        refreshAnimationPane();
      });
    }
  }

  // ===============================================================
  // WM_CLOSE Handler
  // ===============================================================

  function registerCloseHandler() {
    User32.RegisterWindowProc((msg) => {
      if (msg === WM_CLOSE) {
        if (dirty) {
          promptSaveChanges((result) => {
            if (result === 'yes')
              doSave(() => User32.DestroyWindow());
            else if (result === 'no')
              User32.DestroyWindow();
          });
        } else {
          User32.DestroyWindow();
        }
      }
    });
  }

  // ===============================================================
  // Feature: PDF Export
  // ===============================================================

  function doExportPdf() {
    if (!presentation || !presentation.slides.length)
      return;

    const container = document.getElementById('print-container');
    if (!container)
      return;

    container.innerHTML = '';

    for (let i = 0; i < presentation.slides.length; ++i) {
      const slide = presentation.slides[i];
      const page = document.createElement('div');
      page.className = 'print-slide-page';
      SlideRenderer.renderSlide(slide, page, {
        editable: false,
        scale: 1,
        showGuides: false,
        headerFooter: presentation.headerFooter,
        slideIndex: i
      });
      container.appendChild(page);
    }

    // Brief delay to allow DOM rendering before printing
    setTimeout(() => {
      window.print();
      // Clean up after print dialog closes
      setTimeout(() => { container.innerHTML = ''; }, 500);
    }, 100);
  }

  // ===============================================================
  // Feature: Table Design Tab (contextual)
  // ===============================================================

  const TABLE_STYLES = {
    'default': { headerBg: '#4472C4', headerColor: '#FFFFFF', altRowBg: '#D6E4F0', cellBg: '#FFFFFF', cellColor: '#000000', borderColor: '#8FAADC', headerRow: true },
    'banded-blue': { headerBg: '#2E75B6', headerColor: '#FFFFFF', altRowBg: '#BDD7EE', cellBg: '#FFFFFF', cellColor: '#000000', borderColor: '#5B9BD5', headerRow: true },
    'banded-green': { headerBg: '#548235', headerColor: '#FFFFFF', altRowBg: '#C6EFCE', cellBg: '#FFFFFF', cellColor: '#000000', borderColor: '#70AD47', headerRow: true },
    'dark': { headerBg: '#333333', headerColor: '#FFFFFF', altRowBg: '#555555', cellBg: '#444444', cellColor: '#FFFFFF', borderColor: '#666666', headerRow: true },
    'minimal': { headerBg: '#F2F2F2', headerColor: '#333333', altRowBg: '#FAFAFA', cellBg: '#FFFFFF', cellColor: '#333333', borderColor: '#E0E0E0', headerRow: true },
    'accent-orange': { headerBg: '#ED7D31', headerColor: '#FFFFFF', altRowBg: '#FBE5D6', cellBg: '#FFFFFF', cellColor: '#000000', borderColor: '#F4B084', headerRow: true },
    'header-only': { headerBg: '#4472C4', headerColor: '#FFFFFF', altRowBg: '#FFFFFF', cellBg: '#FFFFFF', cellColor: '#000000', borderColor: '#BFBFBF', headerRow: true },
    'no-banding': { headerBg: '#4472C4', headerColor: '#FFFFFF', altRowBg: '#FFFFFF', cellBg: '#FFFFFF', cellColor: '#000000', borderColor: '#8FAADC', headerRow: false }
  };

  function applyTableStyle(styleName) {
    const slide = getCurrentSlide();
    if (!slide)
      return;

    const style = TABLE_STYLES[styleName];
    if (!style)
      return;

    const tables = slide.elements.filter(el => selectedElements.has(el.id) && el.type === 'table');
    if (!tables.length)
      return;

    pushUndo();
    for (const tbl of tables) {
      tbl.tableStyle = styleName;
      tbl.headerBg = style.headerBg;
      tbl.headerColor = style.headerColor;
      tbl.altRowBg = style.altRowBg;
      tbl.cellBg = style.cellBg;
      tbl.cellColor = style.cellColor;
      tbl.borderColor = style.borderColor;
      tbl.headerRow = style.headerRow;
    }
    renderMainCanvas();
    markDirty();
  }

  function showTableBorderPicker() {
    if (!SZ.BorderPicker)
      return;

    const slide = getCurrentSlide();
    if (!slide)
      return;

    const tables = slide.elements.filter(el => selectedElements.has(el.id) && el.type === 'table');
    if (!tables.length)
      return;

    const tbl = tables[0];
    SZ.BorderPicker.show({
      target: document.querySelector('[data-action="table-borders"]'),
      currentColor: tbl.borderColor || '#8FAADC',
      currentWidth: tbl.borderWidth || 1,
      onApply: (result) => {
        pushUndo();
        for (const t of tables) {
          if (result.color)
            t.borderColor = result.color;
          if (result.width != null)
            t.borderWidth = result.width;
        }
        renderMainCanvas();
        markDirty();
      }
    });
  }

  function updateTableDesignTab() {
    const tabBtn = document.getElementById('tab-table-design');
    if (!tabBtn)
      return;

    const slide = getCurrentSlide();
    if (!slide) {
      tabBtn.style.display = 'none';
      return;
    }

    const hasTableSelected = slide.elements.some(el => selectedElements.has(el.id) && el.type === 'table');
    tabBtn.style.display = hasTableSelected ? '' : 'none';

    if (hasTableSelected) {
      // Sync checkboxes
      const tbl = slide.elements.find(el => selectedElements.has(el.id) && el.type === 'table');
      if (tbl) {
        const headerCheck = document.getElementById('tbl-header-row');
        const bandedCheck = document.getElementById('tbl-banded-rows');
        if (headerCheck)
          headerCheck.checked = tbl.headerRow !== false;
        if (bandedCheck)
          bandedCheck.checked = tbl.altRowBg !== tbl.cellBg;
      }
    }
  }

  function wireTableDesignOptions() {
    const headerCheck = document.getElementById('tbl-header-row');
    const bandedCheck = document.getElementById('tbl-banded-rows');

    if (headerCheck) {
      headerCheck.addEventListener('change', () => {
        const slide = getCurrentSlide();
        if (!slide)
          return;
        const tables = slide.elements.filter(el => selectedElements.has(el.id) && el.type === 'table');
        if (!tables.length)
          return;
        pushUndo();
        for (const tbl of tables)
          tbl.headerRow = headerCheck.checked;
        renderMainCanvas();
        markDirty();
      });
    }

    if (bandedCheck) {
      bandedCheck.addEventListener('change', () => {
        const slide = getCurrentSlide();
        if (!slide)
          return;
        const tables = slide.elements.filter(el => selectedElements.has(el.id) && el.type === 'table');
        if (!tables.length)
          return;
        pushUndo();
        for (const tbl of tables) {
          if (bandedCheck.checked)
            tbl.altRowBg = tbl.altRowBg !== tbl.cellBg ? tbl.altRowBg : '#D6E4F0';
          else
            tbl.altRowBg = tbl.cellBg || '#FFFFFF';
        }
        renderMainCanvas();
        markDirty();
      });
    }
  }

  // ===============================================================
  // Feature: Shape Format Panel (right sidebar)
  // ===============================================================

  let formatPanelVisible = false;

  function toggleShapeFormatPanel() {
    formatPanelVisible = !formatPanelVisible;
    const panel = document.getElementById('shape-format-panel');
    const layout = document.getElementById('app-layout');
    if (panel)
      panel.style.display = formatPanelVisible ? '' : 'none';
    if (layout)
      layout.classList.toggle('with-format-panel', formatPanelVisible);
    if (formatPanelVisible)
      syncShapeFormatPanel();
  }

  function showShapeFormatPanel() {
    if (formatPanelVisible)
      return;
    formatPanelVisible = true;
    const panel = document.getElementById('shape-format-panel');
    const layout = document.getElementById('app-layout');
    if (panel)
      panel.style.display = '';
    if (layout)
      layout.classList.add('with-format-panel');
    syncShapeFormatPanel();
  }

  function hideShapeFormatPanel() {
    formatPanelVisible = false;
    const panel = document.getElementById('shape-format-panel');
    const layout = document.getElementById('app-layout');
    if (panel)
      panel.style.display = 'none';
    if (layout)
      layout.classList.remove('with-format-panel');
  }

  function syncShapeFormatPanel() {
    if (!formatPanelVisible)
      return;

    const slide = getCurrentSlide();
    if (!slide || selectedElements.size !== 1) {
      hideShapeFormatPanel();
      return;
    }

    const elId = [...selectedElements][0];
    const element = slide.elements.find(e => e.id === elId);
    if (!element)
      return;

    // Fill
    const fillType = document.getElementById('sfp-fill-type');
    const fillColor = document.getElementById('sfp-fill-color');
    const gradFrom = document.getElementById('sfp-grad-from');
    const gradTo = document.getElementById('sfp-grad-to');

    if (fillType) {
      if (element.fill && element.fill.type === 'gradient')
        fillType.value = 'gradient';
      else if (element.fillColor === 'transparent' || element.fillColor === 'none' || (element.fill && element.fill.type === 'none'))
        fillType.value = 'none';
      else
        fillType.value = 'solid';
      _updateFillVisibility(fillType.value);
    }

    if (fillColor)
      fillColor.value = element.fillColor || element.backgroundColor || '#4472c4';
    if (gradFrom && element.fill)
      gradFrom.value = element.fill.color1 || '#4472c4';
    if (gradTo && element.fill)
      gradTo.value = element.fill.color2 || '#ffffff';

    // Line
    const lineColor = document.getElementById('sfp-line-color');
    const lineWidth = document.getElementById('sfp-line-width');
    const lineDash = document.getElementById('sfp-line-dash');
    if (lineColor)
      lineColor.value = element.strokeColor || element.borderColor || '#000000';
    if (lineWidth)
      lineWidth.value = element.strokeWidth || element.borderWidth || 0;
    if (lineDash)
      lineDash.value = element.lineDash || 'solid';

    // Shadow
    const shadowOn = document.getElementById('sfp-shadow-on');
    const shadowOx = document.getElementById('sfp-shadow-ox');
    const shadowOy = document.getElementById('sfp-shadow-oy');
    const shadowBlur = document.getElementById('sfp-shadow-blur');
    if (shadowOn)
      shadowOn.checked = !!element.shadow;
    if (element.shadow) {
      if (shadowOx) shadowOx.value = element.shadow.offsetX || 3;
      if (shadowOy) shadowOy.value = element.shadow.offsetY || 3;
      if (shadowBlur) shadowBlur.value = element.shadow.blur || 6;
    }

    // Size & Position
    const posX = document.getElementById('sfp-pos-x');
    const posY = document.getElementById('sfp-pos-y');
    const sizeW = document.getElementById('sfp-size-w');
    const sizeH = document.getElementById('sfp-size-h');
    if (posX) posX.value = element.x || 0;
    if (posY) posY.value = element.y || 0;
    if (sizeW) sizeW.value = element.w || 0;
    if (sizeH) sizeH.value = element.h || 0;

    // Text Options
    const textAlign = document.getElementById('sfp-text-align');
    const textMargin = document.getElementById('sfp-text-margin');
    if (textAlign)
      textAlign.value = element.textAlign || 'left';
    if (textMargin)
      textMargin.value = element.textMargin || 8;
  }

  function _updateFillVisibility(type) {
    const solidDiv = document.getElementById('sfp-fill-solid');
    const gradDiv = document.getElementById('sfp-fill-gradient');
    if (solidDiv)
      solidDiv.style.display = type === 'solid' ? '' : 'none';
    if (gradDiv)
      gradDiv.style.display = type === 'gradient' ? '' : 'none';
  }

  function _applyFormatPanelChange() {
    const slide = getCurrentSlide();
    if (!slide || selectedElements.size !== 1)
      return;

    const elId = [...selectedElements][0];
    const element = slide.elements.find(e => e.id === elId);
    if (!element)
      return;

    pushUndo();

    // Fill
    const fillType = document.getElementById('sfp-fill-type');
    const fillColor = document.getElementById('sfp-fill-color');
    const gradFrom = document.getElementById('sfp-grad-from');
    const gradTo = document.getElementById('sfp-grad-to');

    if (fillType) {
      const ft = fillType.value;
      if (ft === 'none') {
        element.fillColor = 'transparent';
        element.backgroundColor = 'transparent';
        element.fill = { type: 'none' };
      } else if (ft === 'gradient') {
        element.fill = { type: 'gradient', color1: gradFrom?.value || '#4472c4', color2: gradTo?.value || '#ffffff', direction: 'to bottom' };
        element.fillColor = gradFrom?.value || '#4472c4';
      } else {
        element.fillColor = fillColor?.value || '#4472c4';
        element.backgroundColor = fillColor?.value || '#4472c4';
        element.fill = { type: 'solid', color: fillColor?.value || '#4472c4' };
      }
    }

    // Line
    const lineColor = document.getElementById('sfp-line-color');
    const lineWidth = document.getElementById('sfp-line-width');
    const lineDash = document.getElementById('sfp-line-dash');
    if (lineColor)
      element.strokeColor = element.borderColor = lineColor.value;
    if (lineWidth)
      element.strokeWidth = element.borderWidth = parseFloat(lineWidth.value) || 0;
    if (lineDash)
      element.lineDash = lineDash.value;

    // Shadow
    const shadowOn = document.getElementById('sfp-shadow-on');
    const shadowOx = document.getElementById('sfp-shadow-ox');
    const shadowOy = document.getElementById('sfp-shadow-oy');
    const shadowBlur = document.getElementById('sfp-shadow-blur');
    if (shadowOn) {
      if (shadowOn.checked)
        element.shadow = {
          offsetX: parseInt(shadowOx?.value, 10) || 3,
          offsetY: parseInt(shadowOy?.value, 10) || 3,
          blur: parseInt(shadowBlur?.value, 10) || 6
        };
      else
        element.shadow = null;
    }

    // Size & Position
    const posX = document.getElementById('sfp-pos-x');
    const posY = document.getElementById('sfp-pos-y');
    const sizeW = document.getElementById('sfp-size-w');
    const sizeH = document.getElementById('sfp-size-h');
    if (posX) element.x = parseInt(posX.value, 10) || 0;
    if (posY) element.y = parseInt(posY.value, 10) || 0;
    if (sizeW) element.w = Math.max(1, parseInt(sizeW.value, 10) || 0);
    if (sizeH) element.h = Math.max(1, parseInt(sizeH.value, 10) || 0);

    // Text Options
    const textAlign = document.getElementById('sfp-text-align');
    const textMargin = document.getElementById('sfp-text-margin');
    if (textAlign)
      element.textAlign = textAlign.value;
    if (textMargin)
      element.textMargin = parseInt(textMargin.value, 10) || 8;

    renderMainCanvas();
    markDirty();
  }

  function wireShapeFormatPanel() {
    const panel = document.getElementById('shape-format-panel');
    if (!panel)
      return;

    const closeBtn = document.getElementById('shape-format-close');
    if (closeBtn)
      closeBtn.addEventListener('click', () => hideShapeFormatPanel());

    // Wire all inputs for instant apply
    const inputs = panel.querySelectorAll('input, select, textarea');
    for (const input of inputs) {
      const eventType = input.type === 'color' || input.tagName === 'SELECT' ? 'input' : 'change';
      input.addEventListener(eventType, () => _applyFormatPanelChange());
      if (input.type === 'number')
        input.addEventListener('input', () => _applyFormatPanelChange());
    }

    // Fill type visibility toggle
    const fillType = document.getElementById('sfp-fill-type');
    if (fillType) {
      fillType.addEventListener('change', () => {
        _updateFillVisibility(fillType.value);
        _applyFormatPanelChange();
      });
    }
  }

  // ===============================================================
  // Feature: Alt Text for Images
  // ===============================================================

  function showAltTextDialog() {
    const overlay = document.getElementById('dlg-alt-text');
    if (!overlay)
      return;

    const slide = getCurrentSlide();
    if (!slide || selectedElements.size !== 1)
      return;

    const elId = [...selectedElements][0];
    const element = slide.elements.find(e => e.id === elId);
    if (!element || element.type !== 'image')
      return;

    const titleInput = document.getElementById('alt-text-title');
    const descInput = document.getElementById('alt-text-desc');

    if (titleInput)
      titleInput.value = element.altText ? element.altText.title || '' : '';
    if (descInput)
      descInput.value = element.altText ? element.altText.description || '' : '';

    overlay.style.display = 'flex';

    const wireBtn = (id, handler) => {
      const btn = document.getElementById(id);
      if (!btn)
        return;
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', handler);
    };

    wireBtn('alt-ok', () => {
      pushUndo();
      element.altText = {
        title: titleInput?.value || '',
        description: descInput?.value || ''
      };
      overlay.style.display = 'none';
      renderMainCanvas();
      markDirty();
    });

    wireBtn('alt-cancel', () => {
      overlay.style.display = 'none';
    });
  }

  // ===============================================================
  // Refresh UI
  // ===============================================================

  function refreshUI() {
    refreshSlidePanel();
    renderMainCanvas();
    updateNotesEditor();
    updateStatusBar();
    updateTitle();
    refreshAnimationPane();
    updateTransitionGalleryActive();
    updateTableDesignTab();
    if (formatPanelVisible)
      syncShapeFormatPanel();
    if (Comments && Comments.isPanelVisible())
      Comments.refreshCommentsPanel(currentSlideIndex);
  }

  // ===============================================================
  // Initialization
  // ===============================================================

  document.addEventListener('DOMContentLoaded', () => {
    // DOM references
    slidePanel = document.getElementById('slide-panel');
    slideThumbs = document.getElementById('slide-thumbs');
    slideCanvas = document.getElementById('slide-canvas');
    editorArea = document.getElementById('editor-area');
    canvasViewport = document.getElementById('canvas-viewport');
    notesEditor = document.getElementById('notes-editor');
    slideCountEl = document.getElementById('slide-count');
    zoomStatusEl = document.getElementById('zoom-status');
    slideSorterEl = document.querySelector('.slide-sorter');

    // Create new presentation
    presentation = createNewPresentation();

    // Wire ribbon
    new SZ.Ribbon({ onAction: handleAction });
    if (SZ.Dialog)
      SZ.Dialog.wireAll();

    // Notes editor input
    if (notesEditor) {
      notesEditor.addEventListener('input', () => {
        const slide = getCurrentSlide();
        if (slide) {
          slide.notes = notesEditor.value;
          markDirty();
        }
      });
    }

    // Notes panel toggle via checkbox
    const showNotesCheckbox = document.getElementById('show-notes');
    const notesPanel = document.getElementById('notes-panel');
    if (showNotesCheckbox && notesPanel) {
      showNotesCheckbox.addEventListener('change', () => {
        notesPanel.classList.toggle('collapsed', !showNotesCheckbox.checked);
      });
    }

    // Notes label click to toggle collapse
    const notesLabel = notesPanel ? notesPanel.querySelector('.notes-label') : null;
    if (notesLabel && notesPanel && showNotesCheckbox) {
      notesLabel.addEventListener('click', () => {
        const isCollapsed = notesPanel.classList.toggle('collapsed');
        showNotesCheckbox.checked = !isCollapsed;
      });
    }

    // Keyboard shortcuts
    setupKeyboardShortcuts();

    // Slideshow module
    SlideshowMode.init({
      getPresentation: () => presentation,
      getCurrentSlideIndex: () => currentSlideIndex,
      onExit: () => {
        // Refresh after exiting slideshow
        refreshUI();
      },
      loop: false,
      autoAdvance: false,
      autoAdvanceInterval: 5
    });

    // Populate galleries
    populateTransitionGallery();
    populateThemeGallery();
    wireTransitionDuration();
    wireBackgroundDialogTabs();
    wireFormatPainterDblClick();

    // Feature: Table Design contextual tab
    wireTableDesignOptions();

    // Feature: Shape Format Panel
    wireShapeFormatPanel();

    // Feature 10: Initialize Spell Check
    if (PresentationsApp.SpellCheck)
      PresentationsApp.SpellCheck.init({});

    // Feature 11-13: Initialize Animation Engine & Pane
    if (AnimationEngine)
      AnimationEngine.init();
    wireAnimationPane();

    // Feature 14: Initialize Comments
    if (Comments) {
      Comments.init({
        getPresentation: () => presentation,
        onCommentsChanged: () => {
          pushUndo();
          markDirty();
          renderMainCanvas();
        }
      });

      const commentsCloseBtn = document.getElementById('comments-close');
      if (commentsCloseBtn)
        commentsCloseBtn.addEventListener('click', () => doToggleCommentsPanel());
    }

    // Feature 17: Initialize Presenter View
    if (PresenterView) {
      PresenterView.init({
        getPresentation: () => presentation,
        getCurrentSlideIndex: () => currentSlideIndex,
        onExit: () => refreshUI()
      });
    }

    // WM_CLOSE handler
    registerCloseHandler();

    // Initial render
    zoomFit();
    refreshUI();

    // Command-line file opening
    const cmd = Kernel32.GetCommandLine();
    if (cmd.path) {
      Kernel32.ReadAllBytes(cmd.path).then((content) => {
        if (PresentationsApp.PptxEngine) {
          PresentationsApp.PptxEngine.loadPptx(content).then((loaded) => {
            if (loaded) {
              presentation = loaded;
              if (!presentation.headerFooter)
                presentation.headerFooter = { showDate: false, dateText: '', showFooter: false, footerText: '', showSlideNumber: false, dontShowOnTitle: true };
              currentSlideIndex = 0;
              selectedElements.clear();
              undoStack = [];
              redoStack = [];
              const parts = cmd.path.split('/');
              currentFileName = parts[parts.length - 1] || 'Untitled';
              currentFilePath = cmd.path;
              dirty = false;
              refreshUI();
              updateTitle();
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    // Add slide button in panel
    const addBtn = document.querySelector('.add-slide-btn');
    if (addBtn)
      addBtn.addEventListener('click', () => addSlide('title-content'));
  });

})();
