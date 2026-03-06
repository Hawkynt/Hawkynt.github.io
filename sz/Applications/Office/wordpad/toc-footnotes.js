;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _editor, _markDirty, _escapeHtml;
  let footnoteCounter = 0;
  let endnoteCounter = 0;

  function init(ctx) {
    _editor = ctx.editor;
    _markDirty = ctx.markDirty;
    _escapeHtml = ctx.escapeHtml;

    // Columns selector (extended: 1-6 + custom)
    const columnsSelect = document.getElementById('rb-columns');
    const columnGapInput = document.getElementById('rb-column-gap');

    columnsSelect.addEventListener('change', () => {
      const val = columnsSelect.value;
      if (val === 'custom') {
        // Show custom columns dialog
        const overlay = document.getElementById('dlg-custom-columns');
        if (overlay && typeof SZ !== 'undefined' && SZ.Dialog) {
          SZ.Dialog.show('dlg-custom-columns').then((result) => {
            if (result !== 'ok') {
              columnsSelect.value = '1';
              return;
            }
            const count = parseInt(document.getElementById('cc-count').value, 10) || 1;
            const gap = document.getElementById('cc-gap').value || '0.5in';
            applyColumns(count, gap);
            if (columnGapInput) columnGapInput.value = gap;
          });
        }
        return;
      }
      const n = parseInt(val, 10);
      const gap = columnGapInput ? columnGapInput.value : '0.5in';
      applyColumns(n, gap);
    });

    if (columnGapInput) {
      columnGapInput.addEventListener('change', () => {
        const n = parseInt(columnsSelect.value, 10) || 1;
        if (n > 1)
          applyColumns(n, columnGapInput.value);
      });
    }

    // Auto-update TOC (debounced)
    let tocUpdateTimer = null;
    _editor.addEventListener('input', () => {
      if (!_editor.querySelector('.wp-toc')) return;
      clearTimeout(tocUpdateTimer);
      tocUpdateTimer = setTimeout(() => {
        const oldToc = _editor.querySelector('.wp-toc');
        if (!oldToc) return;
        const newToc = generateTOC();
        if (newToc) oldToc.replaceWith(newToc);
      }, 500);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Table of Contents
  // ═══════════════════════════════════════════════════════════════

  function generateTOC() {
    const headings = _editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (!headings.length) return null;

    const toc = document.createElement('div');
    toc.className = 'wp-toc';
    toc.contentEditable = 'false';

    const title = document.createElement('div');
    title.className = 'wp-toc-title';
    title.textContent = 'Table of Contents';
    toc.appendChild(title);

    const counters = [0, 0, 0, 0, 0, 0];
    const editorTop = _editor.getBoundingClientRect().top;
    const editorHeight = _editor.scrollHeight;

    for (const heading of headings) {
      const level = parseInt(heading.tagName[1], 10);

      // Update counters
      counters[level - 1]++;
      for (let i = level; i < 6; ++i) counters[i] = 0;

      // Build numbering string
      let numStr = '';
      for (let i = 0; i < level; ++i) {
        if (counters[i] > 0) numStr += (numStr ? '.' : '') + counters[i];
      }

      // Estimate page number from position
      const rect = heading.getBoundingClientRect();
      const posRatio = (rect.top - editorTop + _editor.scrollTop) / editorHeight;
      const pageEstimate = Math.max(1, Math.ceil(posRatio * Math.ceil(editorHeight / (11 * 96))));

      const entry = document.createElement('div');
      entry.className = 'wp-toc-entry toc-level-' + level;

      entry.innerHTML = '<span class="toc-num">' + _escapeHtml(numStr) + '</span>'
        + '<span class="toc-text">' + _escapeHtml(heading.textContent) + '</span>'
        + '<span class="toc-dots"></span>'
        + '<span class="toc-page">' + pageEstimate + '</span>';

      entry.addEventListener('click', () => {
        heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      toc.appendChild(entry);
    }

    return toc;
  }

  function insertTOC() {
    // Remove existing TOC
    const old = _editor.querySelector('.wp-toc');
    if (old) old.remove();

    const toc = generateTOC();
    if (!toc) {
      alert('No headings found in the document.');
      return;
    }

    // Insert at top of document (after header if present)
    const header = _editor.querySelector('.wp-header');
    if (header)
      header.after(toc);
    else
      _editor.insertBefore(toc, _editor.firstChild);

    _markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // Footnotes
  // ═══════════════════════════════════════════════════════════════

  function insertFootnote() {
    const text = prompt('Footnote text:');
    if (!text) return;

    ++footnoteCounter;
    const id = footnoteCounter;

    // Insert reference in text
    const ref = document.createElement('sup');
    ref.className = 'wp-footnote-ref';
    ref.dataset.footnoteId = id;
    ref.innerHTML = '<a href="#wp-fn-' + id + '">' + id + '</a>';

    const sel = window.getSelection();
    if (sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      range.insertNode(ref);
      range.setStartAfter(ref);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Add or update footnotes section
    let container = _editor.querySelector('.wp-footnotes');
    if (!container) {
      container = document.createElement('div');
      container.className = 'wp-footnotes';
      container.contentEditable = 'true';
      _editor.appendChild(container);
    }

    const fn = document.createElement('div');
    fn.className = 'wp-footnote';
    fn.id = 'wp-fn-' + id;
    fn.innerHTML = '<span class="wp-footnote-num">' + id + '.</span><span class="wp-footnote-text" contenteditable="true">' + _escapeHtml(text) + '</span>';
    container.appendChild(fn);

    renumberFootnotes();
    _markDirty();
    _editor.focus();
  }

  function renumberFootnotes() {
    const refs = _editor.querySelectorAll('.wp-footnote-ref');
    const container = _editor.querySelector('.wp-footnotes');
    if (!container) return;

    let num = 0;
    for (const ref of refs) {
      ++num;
      const id = ref.dataset.footnoteId;
      ref.innerHTML = '<a href="#wp-fn-' + id + '">' + num + '</a>';
    }

    const footnotes = container.querySelectorAll('.wp-footnote');
    num = 0;
    for (const fn of footnotes) {
      ++num;
      const numSpan = fn.querySelector('.wp-footnote-num');
      if (numSpan) numSpan.textContent = num + '.';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Endnotes
  // ═══════════════════════════════════════════════════════════════

  function toRomanLower(num) {
    const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const syms = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
    let result = '';
    let n = Math.max(1, Math.floor(num));
    for (let i = 0; i < vals.length; ++i) {
      while (n >= vals[i]) {
        result += syms[i];
        n -= vals[i];
      }
    }
    return result;
  }

  function insertEndnote() {
    const text = prompt('Endnote text:');
    if (!text) return;

    ++endnoteCounter;
    const id = endnoteCounter;
    const marker = toRomanLower(id);

    // Insert reference in text
    const ref = document.createElement('sup');
    ref.className = 'wp-endnote-ref';
    ref.dataset.endnoteId = String(id);
    ref.innerHTML = '<a href="#wp-en-' + id + '">' + _escapeHtml(marker) + '</a>';

    const sel = window.getSelection();
    if (sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      range.insertNode(ref);
      range.setStartAfter(ref);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Add or update endnotes section
    let container = _editor.querySelector('.wp-endnotes-section');
    if (!container) {
      container = document.createElement('div');
      container.className = 'wp-endnotes-section';
      container.contentEditable = 'true';

      // Insert after footnotes if present, otherwise at end
      const footnotes = _editor.querySelector('.wp-footnotes');
      const footer = _editor.querySelector('.wp-footer');
      if (footnotes)
        footnotes.after(container);
      else if (footer)
        footer.before(container);
      else
        _editor.appendChild(container);
    }

    const en = document.createElement('div');
    en.className = 'wp-endnote';
    en.id = 'wp-en-' + id;
    en.innerHTML = '<span class="wp-endnote-num">' + _escapeHtml(marker) + '.</span><span class="wp-endnote-text" contenteditable="true">' + _escapeHtml(text) + '</span>';
    container.appendChild(en);

    renumberEndnotes();
    _markDirty();
    _editor.focus();
  }

  function renumberEndnotes() {
    const refs = _editor.querySelectorAll('.wp-endnote-ref');
    const container = _editor.querySelector('.wp-endnotes-section');
    if (!container) return;

    let num = 0;
    for (const ref of refs) {
      ++num;
      const id = ref.dataset.endnoteId;
      const marker = toRomanLower(num);
      ref.innerHTML = '<a href="#wp-en-' + id + '">' + marker + '</a>';
    }

    const endnotes = container.querySelectorAll('.wp-endnote');
    num = 0;
    for (const en of endnotes) {
      ++num;
      const numSpan = en.querySelector('.wp-endnote-num');
      if (numSpan) numSpan.textContent = toRomanLower(num) + '.';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Multi-Level Lists
  // ═══════════════════════════════════════════════════════════════

  function insertMultiLevelList() {
    const html = '<ol class="wp-multilevel" data-ml-style="decimal">'
      + '<li>Item 1</li>'
      + '<li>Item 2</li>'
      + '<li>Item 3</li>'
      + '</ol><p><br></p>';
    document.execCommand('insertHTML', false, html);
    _editor.focus();
    _markDirty();
  }

  function _getListItemAtCursor() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.focusNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    if (!node) return null;
    const li = node.closest('.wp-multilevel li');
    return li;
  }

  function demoteListItem() {
    const li = _getListItemAtCursor();
    if (!li) return;
    const parentOl = li.parentElement;
    if (!parentOl) return;

    // Determine current nesting depth - don't go beyond 3 levels
    let depth = 0;
    let el = parentOl;
    while (el) {
      if (el.matches && el.matches('ol'))
        ++depth;
      el = el.parentElement;
    }
    if (depth >= 3) return;

    // Find or create a nested <ol> inside the previous sibling <li>
    const prevLi = li.previousElementSibling;
    if (!prevLi) return; // Cannot demote the first item in a list level

    let childOl = prevLi.querySelector(':scope > ol');
    if (!childOl) {
      childOl = document.createElement('ol');
      prevLi.appendChild(childOl);
    }

    childOl.appendChild(li);
    _markDirty();

    // Restore cursor to the item
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(li);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function promoteListItem() {
    const li = _getListItemAtCursor();
    if (!li) return;
    const parentOl = li.parentElement;
    if (!parentOl || !parentOl.matches('ol')) return;

    // Must be nested (parent ol must be inside a li)
    const parentLi = parentOl.parentElement;
    if (!parentLi || !parentLi.matches('li')) return;

    const grandparentOl = parentLi.parentElement;
    if (!grandparentOl || !grandparentOl.matches('ol')) return;

    // Move remaining siblings into a new ol staying at current level
    const remaining = [];
    let next = li.nextElementSibling;
    while (next) {
      remaining.push(next);
      next = next.nextElementSibling;
    }

    if (remaining.length) {
      let childOl = li.querySelector(':scope > ol');
      if (!childOl) {
        childOl = document.createElement('ol');
        li.appendChild(childOl);
      }
      for (const r of remaining)
        childOl.appendChild(r);
    }

    // Insert li after parentLi in grandparentOl
    grandparentOl.insertBefore(li, parentLi.nextSibling);

    // Clean up empty nested ol
    if (!parentOl.children.length)
      parentOl.remove();

    _markDirty();

    // Restore cursor
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(li);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function setMultilevelStyle(style) {
    const lists = _editor.querySelectorAll('.wp-multilevel');
    for (const list of lists)
      list.dataset.mlStyle = style;
    _markDirty();
  }

  // ═══════════════════════════════════════════════════════════════
  // Columns
  // ═══════════════════════════════════════════════════════════════

  function applyColumns(n, gap) {
    // Remove old column classes
    for (let i = 2; i <= 12; ++i)
      _editor.classList.remove('columns-' + i);
    // Remove inline column styles
    _editor.style.columnCount = '';
    _editor.style.columnGap = '';

    if (n <= 1) return;
    if (n <= 6) {
      _editor.classList.add('columns-' + n);
    } else {
      _editor.style.columnCount = String(n);
    }
    if (gap)
      _editor.style.columnGap = gap;
  }

  function insertColumnBreak() {
    document.execCommand('insertHTML', false, '<div class="wp-column-break"></div>');
    _editor.focus();
    _markDirty();
  }

  WP.TocFootnotes = {
    init,
    insertTOC,
    insertFootnote,
    renumberFootnotes,
    insertEndnote,
    renumberEndnotes,
    insertMultiLevelList,
    promoteListItem,
    demoteListItem,
    setMultilevelStyle,
    insertColumnBreak,
  };
})();
