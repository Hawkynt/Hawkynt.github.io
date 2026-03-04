;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _editor, _markDirty, _escapeHtml;
  let _sectionIdCounter = 0;

  // ═══════════════════════════════════════════════════════════════
  // Default Section Properties
  // ═══════════════════════════════════════════════════════════════

  function getDefaultSectionProps() {
    return {
      id: null,
      breakType: 'continuous',
      margins: { top: 1, right: 1, bottom: 1, left: 1, gutter: 0 },
      orientation: 'portrait',
      pageSize: { w: 8.5, h: 11 },
      headersDifferentFirst: false,
      headersDifferentOddEven: false,
      headers: { default: '', first: '', odd: '', even: '' },
      footers: { default: '', first: '', odd: '', even: '' },
      pageBorders: null,
      lineNumbering: null,
      columns: 1,
      mirrorMargins: false
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════════════

  function init(ctx) {
    _editor = ctx.editor;
    _markDirty = ctx.markDirty;
    _escapeHtml = ctx.escapeHtml;
  }

  // ═══════════════════════════════════════════════════════════════
  // Create Section
  // ═══════════════════════════════════════════════════════════════

  function createSection(options) {
    const props = Object.assign(getDefaultSectionProps(), options || {});
    const id = props.id || ('section-' + (++_sectionIdCounter));

    const div = document.createElement('div');
    div.className = 'wp-section';
    div.setAttribute('data-section-id', id);
    div.setAttribute('data-break-type', props.breakType);

    // Store properties as JSON data attribute
    div.setAttribute('data-section-props', JSON.stringify(props));

    applySectionProperties(div, props);

    return div;
  }

  // ═══════════════════════════════════════════════════════════════
  // Get Sections
  // ═══════════════════════════════════════════════════════════════

  function getSections() {
    if (!_editor)
      return [];
    return Array.from(_editor.querySelectorAll('.wp-section'));
  }

  // ═══════════════════════════════════════════════════════════════
  // Get Section For Element
  // ═══════════════════════════════════════════════════════════════

  function getSectionForElement(el) {
    if (!el)
      return null;
    return el.closest('.wp-section');
  }

  // ═══════════════════════════════════════════════════════════════
  // Get Section Properties
  // ═══════════════════════════════════════════════════════════════

  function getSectionProps(sectionEl) {
    if (!sectionEl)
      return getDefaultSectionProps();
    try {
      const raw = sectionEl.getAttribute('data-section-props');
      if (raw)
        return JSON.parse(raw);
    } catch (e) {
      // ignore parse errors
    }
    return getDefaultSectionProps();
  }

  function setSectionProps(sectionEl, props) {
    if (!sectionEl)
      return;
    sectionEl.setAttribute('data-section-props', JSON.stringify(props));
    applySectionProperties(sectionEl, props);
  }

  // ═══════════════════════════════════════════════════════════════
  // Apply Section Properties
  // ═══════════════════════════════════════════════════════════════

  function applySectionProperties(sectionEl, props) {
    if (!sectionEl)
      return;

    // Margins
    if (props.margins) {
      const m = props.margins;
      const gutter = m.gutter || 0;
      if (props.mirrorMargins) {
        // For mirror margins, we alternate left/right gutter
        // In the editor, just show gutter on the left (odd page default)
        sectionEl.style.paddingTop = m.top + 'in';
        sectionEl.style.paddingRight = m.right + 'in';
        sectionEl.style.paddingBottom = m.bottom + 'in';
        sectionEl.style.paddingLeft = (m.left + gutter) + 'in';
      } else {
        sectionEl.style.paddingTop = m.top + 'in';
        sectionEl.style.paddingRight = m.right + 'in';
        sectionEl.style.paddingBottom = m.bottom + 'in';
        sectionEl.style.paddingLeft = (m.left + gutter) + 'in';
      }
    }

    // Columns
    if (props.columns && props.columns > 1) {
      sectionEl.style.columnCount = String(props.columns);
      sectionEl.style.columnGap = '0.5in';
    } else {
      sectionEl.style.columnCount = '';
      sectionEl.style.columnGap = '';
    }

    // Line numbering
    if (props.lineNumbering) {
      sectionEl.classList.add('wp-line-numbers');
    } else {
      sectionEl.classList.remove('wp-line-numbers');
    }

    // Page borders
    if (props.pageBorders) {
      const pb = props.pageBorders;
      sectionEl.classList.add('wp-page-border');
      sectionEl.style.outlineStyle = pb.style || 'none';
      sectionEl.style.outlineWidth = (pb.width || 1) + 'px';
      sectionEl.style.outlineColor = pb.color || '#000000';
      sectionEl.style.outlineOffset = '-8px';
    } else {
      sectionEl.classList.remove('wp-page-border');
      sectionEl.style.outlineStyle = '';
      sectionEl.style.outlineWidth = '';
      sectionEl.style.outlineColor = '';
      sectionEl.style.outlineOffset = '';
    }

    // Break type visual indicator
    sectionEl.setAttribute('data-break-type', props.breakType || 'continuous');
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert Section Break
  // ═══════════════════════════════════════════════════════════════

  function insertSectionBreak(type) {
    if (!_editor)
      return;

    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;

    const range = sel.getRangeAt(0);

    // Create the break indicator
    const breakDiv = document.createElement('div');
    breakDiv.className = 'wp-section-break';
    const labelMap = {
      nextPage: 'Section Break (Next Page)',
      continuous: 'Section Break (Continuous)',
      evenPage: 'Section Break (Even Page)',
      oddPage: 'Section Break (Odd Page)'
    };
    breakDiv.setAttribute('data-break-label', labelMap[type] || 'Section Break');
    breakDiv.contentEditable = 'false';

    // Create the new section that follows
    const newSection = createSection({ breakType: type });

    // Determine what content goes into the new section
    // If inside an existing section, split it
    const currentSection = range.commonAncestorContainer.nodeType === 3
      ? range.commonAncestorContainer.parentElement.closest('.wp-section')
      : (range.commonAncestorContainer.closest ? range.commonAncestorContainer.closest('.wp-section') : null);

    if (currentSection) {
      // Split the current section at the cursor position
      const afterRange = document.createRange();
      afterRange.setStart(range.endContainer, range.endOffset);
      afterRange.setEnd(currentSection, currentSection.childNodes.length);

      const afterContent = afterRange.extractContents();
      newSection.appendChild(afterContent);

      // Insert break and new section after current section
      currentSection.after(newSection);
      currentSection.after(breakDiv);
    } else {
      // Not inside a section -- insert break at cursor, then new section
      const afterRange = document.createRange();
      afterRange.setStart(range.endContainer, range.endOffset);
      afterRange.setEnd(_editor, _editor.childNodes.length);

      const afterContent = afterRange.extractContents();

      // Add remaining content to new section
      if (afterContent.childNodes.length > 0)
        newSection.appendChild(afterContent);
      else
        newSection.innerHTML = '<p><br></p>';

      // Insert break and section at cursor position
      range.deleteContents();
      range.insertNode(newSection);
      newSection.before(breakDiv);
    }

    // Place cursor at start of new section
    const firstChild = newSection.firstChild;
    if (firstChild) {
      const newRange = document.createRange();
      newRange.setStart(firstChild, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    if (_markDirty)
      _markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // Header/Footer per Section
  // ═══════════════════════════════════════════════════════════════

  function getSectionHeader(sectionEl, pageType) {
    if (!sectionEl)
      return '';
    const props = getSectionProps(sectionEl);
    if (pageType === 'first' && props.headersDifferentFirst)
      return props.headers.first || '';
    if (props.headersDifferentOddEven) {
      if (pageType === 'odd')
        return props.headers.odd || props.headers.default || '';
      if (pageType === 'even')
        return props.headers.even || props.headers.default || '';
    }
    return props.headers.default || '';
  }

  function getSectionFooter(sectionEl, pageType) {
    if (!sectionEl)
      return '';
    const props = getSectionProps(sectionEl);
    if (pageType === 'first' && props.headersDifferentFirst)
      return props.footers.first || '';
    if (props.headersDifferentOddEven) {
      if (pageType === 'odd')
        return props.footers.odd || props.footers.default || '';
      if (pageType === 'even')
        return props.footers.even || props.footers.default || '';
    }
    return props.footers.default || '';
  }

  function setSectionHeader(sectionEl, pageType, text) {
    if (!sectionEl)
      return;
    const props = getSectionProps(sectionEl);
    if (pageType === 'first')
      props.headers.first = text;
    else if (pageType === 'odd')
      props.headers.odd = text;
    else if (pageType === 'even')
      props.headers.even = text;
    else
      props.headers.default = text;
    setSectionProps(sectionEl, props);
  }

  function setSectionFooter(sectionEl, pageType, text) {
    if (!sectionEl)
      return;
    const props = getSectionProps(sectionEl);
    if (pageType === 'first')
      props.footers.first = text;
    else if (pageType === 'odd')
      props.footers.odd = text;
    else if (pageType === 'even')
      props.footers.even = text;
    else
      props.footers.default = text;
    setSectionProps(sectionEl, props);
  }

  // ═══════════════════════════════════════════════════════════════
  // Toggle Different First Page / Odd-Even
  // ═══════════════════════════════════════════════════════════════

  function toggleDifferentFirstPage(sectionEl) {
    if (!sectionEl)
      return false;
    const props = getSectionProps(sectionEl);
    props.headersDifferentFirst = !props.headersDifferentFirst;
    setSectionProps(sectionEl, props);
    return props.headersDifferentFirst;
  }

  function toggleDifferentOddEven(sectionEl) {
    if (!sectionEl)
      return false;
    const props = getSectionProps(sectionEl);
    props.headersDifferentOddEven = !props.headersDifferentOddEven;
    setSectionProps(sectionEl, props);
    return props.headersDifferentOddEven;
  }

  // ═══════════════════════════════════════════════════════════════
  // Page Borders
  // ═══════════════════════════════════════════════════════════════

  function applyPageBorders(target, borderProps) {
    if (target === 'document') {
      // Apply to entire editor
      if (!borderProps || borderProps.style === 'none') {
        _editor.classList.remove('wp-page-border');
        _editor.style.outlineStyle = '';
        _editor.style.outlineWidth = '';
        _editor.style.outlineColor = '';
        _editor.style.outlineOffset = '';
      } else {
        _editor.classList.add('wp-page-border');
        _editor.style.outlineStyle = borderProps.style;
        _editor.style.outlineWidth = borderProps.width + 'px';
        _editor.style.outlineColor = borderProps.color;
        _editor.style.outlineOffset = '-8px';
      }
    } else if (target === 'section') {
      // Apply to current section
      const sel = window.getSelection();
      if (!sel.rangeCount)
        return;
      let node = sel.focusNode;
      if (node.nodeType === 3) node = node.parentElement;
      const section = node.closest('.wp-section');
      if (section) {
        const props = getSectionProps(section);
        props.pageBorders = (!borderProps || borderProps.style === 'none') ? null : borderProps;
        setSectionProps(section, props);
      }
    } else if (target === 'first') {
      // Apply to first section only
      const sections = getSections();
      if (sections.length > 0) {
        const props = getSectionProps(sections[0]);
        props.pageBorders = (!borderProps || borderProps.style === 'none') ? null : borderProps;
        setSectionProps(sections[0], props);
      } else {
        // No sections, apply to editor
        applyPageBorders('document', borderProps);
      }
    }
    if (_markDirty)
      _markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // Line Numbering
  // ═══════════════════════════════════════════════════════════════

  function toggleLineNumbering(target) {
    if (!_editor)
      return false;

    if (target) {
      // Toggle on specific section
      const props = getSectionProps(target);
      props.lineNumbering = props.lineNumbering ? null : { start: 1, increment: 1, distance: 30 };
      setSectionProps(target, props);
      if (_markDirty)
        _markDirty();
      return !!props.lineNumbering;
    }

    // Toggle on editor (no sections)
    const isOn = _editor.classList.contains('wp-line-numbers');
    _editor.classList.toggle('wp-line-numbers', !isOn);
    if (_markDirty)
      _markDirty();
    return !isOn;
  }

  // ═══════════════════════════════════════════════════════════════
  // Gutter / Mirror Margins
  // ═══════════════════════════════════════════════════════════════

  function setGutter(sectionEl, gutterInches) {
    if (!sectionEl)
      return;
    const props = getSectionProps(sectionEl);
    props.margins.gutter = parseFloat(gutterInches) || 0;
    setSectionProps(sectionEl, props);
    if (_markDirty)
      _markDirty();
  }

  function setMirrorMargins(sectionEl, mirror) {
    if (!sectionEl)
      return;
    const props = getSectionProps(sectionEl);
    props.mirrorMargins = !!mirror;
    setSectionProps(sectionEl, props);
    if (_markDirty)
      _markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // Get Current Section
  // ═══════════════════════════════════════════════════════════════

  function getCurrentSection() {
    const sel = window.getSelection();
    if (!sel.rangeCount)
      return null;
    let node = sel.focusNode;
    if (node && node.nodeType === 3)
      node = node.parentElement;
    if (!node)
      return null;
    return node.closest('.wp-section');
  }

  // ═══════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════

  WP.Sections = {
    init,
    createSection,
    getSections,
    getSectionForElement,
    applySectionProperties,
    insertSectionBreak,
    getDefaultSectionProps,
    getSectionProps,
    setSectionProps,
    getSectionHeader,
    getSectionFooter,
    setSectionHeader,
    setSectionFooter,
    toggleDifferentFirstPage,
    toggleDifferentOddEven,
    applyPageBorders,
    toggleLineNumbering,
    setGutter,
    setMirrorMargins,
    getCurrentSection
  };
})();
