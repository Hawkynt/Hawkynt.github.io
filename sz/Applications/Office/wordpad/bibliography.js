;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _editor, _markDirty, _escapeHtml;
  const STORAGE_KEY = 'sz-wordpad-bibliography-sources';
  let sources = [];
  let nextSourceId = 1;

  function init(ctx) {
    _editor = ctx.editor;
    _markDirty = ctx.markDirty;
    _escapeHtml = ctx.escapeHtml;

    // Load sources from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        sources = parsed.sources || [];
        nextSourceId = parsed.nextId || 1;
      }
    } catch (e) { /* ignore */ }

    wireManageSourcesDialog();
  }

  function saveSources() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sources, nextId: nextSourceId }));
    } catch (e) { /* ignore */ }
  }

  // ═══════════════════════════════════════════════════════════════
  // Source Management
  // ═══════════════════════════════════════════════════════════════

  function addSource(data) {
    const source = {
      id: nextSourceId++,
      type: data.type || 'Book',
      author: data.author || '',
      title: data.title || '',
      year: data.year || '',
      publisher: data.publisher || '',
      url: data.url || ''
    };
    sources.push(source);
    saveSources();
    return source;
  }

  function updateSource(id, data) {
    const source = sources.find(s => s.id === id);
    if (!source)
      return;
    if (data.type !== undefined) source.type = data.type;
    if (data.author !== undefined) source.author = data.author;
    if (data.title !== undefined) source.title = data.title;
    if (data.year !== undefined) source.year = data.year;
    if (data.publisher !== undefined) source.publisher = data.publisher;
    if (data.url !== undefined) source.url = data.url;
    saveSources();
  }

  function deleteSource(id) {
    sources = sources.filter(s => s.id !== id);
    saveSources();
  }

  function getSources() {
    return sources.slice();
  }

  function getSourceById(id) {
    return sources.find(s => s.id === id) || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // Citation Formatting
  // ═══════════════════════════════════════════════════════════════

  function formatCitationInline(source, style) {
    if (!source)
      return '[?]';
    const author = source.author.split(',')[0].trim();
    const lastName = author.split(' ').pop();
    switch (style) {
      case 'mla':
        return '(' + lastName + ')';
      case 'chicago':
        return '(' + lastName + ' ' + source.year + ')';
      case 'apa':
      default:
        return '(' + lastName + ', ' + source.year + ')';
    }
  }

  function formatBibliographyEntry(source, style) {
    if (!source)
      return '';
    const author = source.author || 'Unknown';
    const title = source.title || 'Untitled';
    const year = source.year || 'n.d.';
    const publisher = source.publisher || '';
    const url = source.url || '';

    switch (style) {
      case 'mla': {
        let entry = author + '. <i>' + _escapeHtml(title) + '</i>.';
        if (publisher) entry += ' ' + _escapeHtml(publisher) + ',';
        entry += ' ' + _escapeHtml(year) + '.';
        if (url) entry += ' <a href="' + _escapeHtml(url) + '">' + _escapeHtml(url) + '</a>.';
        return entry;
      }
      case 'chicago': {
        let entry = author + '. <i>' + _escapeHtml(title) + '</i>.';
        if (publisher) entry += ' ' + _escapeHtml(publisher) + ',';
        entry += ' ' + _escapeHtml(year) + '.';
        if (url) entry += ' ' + _escapeHtml(url) + '.';
        return entry;
      }
      case 'apa':
      default: {
        let entry = _escapeHtml(author) + ' (' + _escapeHtml(year) + '). <i>' + _escapeHtml(title) + '</i>.';
        if (publisher) entry += ' ' + _escapeHtml(publisher) + '.';
        if (url) entry += ' Retrieved from <a href="' + _escapeHtml(url) + '">' + _escapeHtml(url) + '</a>';
        return entry;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert Citation
  // ═══════════════════════════════════════════════════════════════

  function insertCitation(sourceId) {
    const source = getSourceById(sourceId);
    if (!source) {
      alert('Source not found.');
      return;
    }

    const style = document.getElementById('bib-style')
      ? document.getElementById('bib-style').value
      : 'apa';

    const span = document.createElement('span');
    span.className = 'wp-citation';
    span.setAttribute('data-source-id', String(source.id));
    span.setAttribute('data-citation-style', style);
    span.contentEditable = 'false';
    span.textContent = formatCitationInline(source, style);
    span.title = source.author + ' - ' + source.title;

    const sel = window.getSelection();
    if (sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(span);
      range.setStartAfter(span);
      range.setEndAfter(span);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      _editor.appendChild(span);
    }

    _markDirty();
    _editor.focus();
  }

  function showInsertCitationPrompt() {
    if (!sources.length) {
      alert('No sources defined. Use "Sources" to add sources first.');
      return;
    }

    // Build a simple selection prompt
    let msg = 'Select a source to cite:\n';
    for (let i = 0; i < sources.length; ++i)
      msg += (i + 1) + '. ' + sources[i].author + ' - ' + sources[i].title + ' (' + sources[i].year + ')\n';
    msg += '\nEnter number:';
    const input = prompt(msg);
    if (!input)
      return;
    const idx = parseInt(input, 10) - 1;
    if (idx >= 0 && idx < sources.length)
      insertCitation(sources[idx].id);
  }

  // ═══════════════════════════════════════════════════════════════
  // Generate Bibliography
  // ═══════════════════════════════════════════════════════════════

  function generateBibliography(style) {
    if (!style)
      style = document.getElementById('bib-style') ? document.getElementById('bib-style').value : 'apa';

    // Collect all cited source IDs
    const citedIds = new Set();
    const citations = _editor.querySelectorAll('.wp-citation[data-source-id]');
    for (const c of citations)
      citedIds.add(parseInt(c.getAttribute('data-source-id'), 10));

    // If no citations, use all sources
    const usedSources = citedIds.size > 0
      ? sources.filter(s => citedIds.has(s.id))
      : sources.slice();

    if (!usedSources.length) {
      alert('No sources to include in bibliography.');
      return;
    }

    // Sort by author last name
    usedSources.sort((a, b) => {
      const aLast = (a.author.split(',')[0] || a.author).split(' ').pop();
      const bLast = (b.author.split(',')[0] || b.author).split(' ').pop();
      return aLast.localeCompare(bLast);
    });

    // Remove existing bibliography
    const existing = _editor.querySelector('.wp-bibliography');
    if (existing) existing.remove();

    // Build bibliography section
    const bib = document.createElement('div');
    bib.className = 'wp-bibliography';
    bib.contentEditable = 'false';

    for (const source of usedSources) {
      const entry = document.createElement('div');
      entry.className = 'wp-bibliography-entry';
      entry.innerHTML = formatBibliographyEntry(source, style);
      bib.appendChild(entry);
    }

    // Insert before endnotes/footnotes if present, otherwise at end
    const endnotes = _editor.querySelector('.wp-endnotes-section');
    const footnotes = _editor.querySelector('.wp-footnotes');
    const footer = _editor.querySelector('.wp-footer');

    if (endnotes)
      endnotes.before(bib);
    else if (footnotes)
      footnotes.before(bib);
    else if (footer)
      footer.before(bib);
    else
      _editor.appendChild(bib);

    _markDirty();
    _editor.focus();
  }

  // ═══════════════════════════════════════════════════════════════
  // Manage Sources Dialog
  // ═══════════════════════════════════════════════════════════════

  let selectedSourceId = null;

  function wireManageSourcesDialog() {
    const dlg = document.getElementById('dlg-manage-sources');
    if (!dlg)
      return;

    const sourcesList = document.getElementById('sources-list');
    const sourceForm = document.getElementById('source-form');
    const addBtn = document.getElementById('src-add');
    const editBtn = document.getElementById('src-edit');
    const deleteBtn = document.getElementById('src-delete');
    const saveBtn = document.getElementById('src-save');

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        selectedSourceId = null;
        clearSourceForm();
        sourceForm.style.display = '';
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (selectedSourceId === null) return;
        const source = getSourceById(selectedSourceId);
        if (!source) return;
        fillSourceForm(source);
        sourceForm.style.display = '';
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (selectedSourceId === null) return;
        deleteSource(selectedSourceId);
        selectedSourceId = null;
        refreshSourcesList();
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const data = readSourceForm();
        if (!data.author && !data.title) return;

        if (selectedSourceId !== null) {
          updateSource(selectedSourceId, data);
        } else {
          const newSource = addSource(data);
          selectedSourceId = newSource.id;
        }
        sourceForm.style.display = 'none';
        refreshSourcesList();
      });
    }
  }

  function clearSourceForm() {
    document.getElementById('src-type').value = 'Book';
    document.getElementById('src-author').value = '';
    document.getElementById('src-title').value = '';
    document.getElementById('src-year').value = '';
    document.getElementById('src-publisher').value = '';
    document.getElementById('src-url').value = '';
  }

  function fillSourceForm(source) {
    document.getElementById('src-type').value = source.type || 'Book';
    document.getElementById('src-author').value = source.author || '';
    document.getElementById('src-title').value = source.title || '';
    document.getElementById('src-year').value = source.year || '';
    document.getElementById('src-publisher').value = source.publisher || '';
    document.getElementById('src-url').value = source.url || '';
  }

  function readSourceForm() {
    return {
      type: document.getElementById('src-type').value,
      author: document.getElementById('src-author').value.trim(),
      title: document.getElementById('src-title').value.trim(),
      year: document.getElementById('src-year').value.trim(),
      publisher: document.getElementById('src-publisher').value.trim(),
      url: document.getElementById('src-url').value.trim()
    };
  }

  function refreshSourcesList() {
    const list = document.getElementById('sources-list');
    if (!list) return;
    list.innerHTML = '';

    for (const source of sources) {
      const row = document.createElement('div');
      row.className = 'source-row' + (source.id === selectedSourceId ? ' selected' : '');
      row.textContent = source.author + ' (' + source.year + ') - ' + source.title;
      row.addEventListener('click', () => {
        selectedSourceId = source.id;
        for (const r of list.querySelectorAll('.source-row'))
          r.classList.remove('selected');
        row.classList.add('selected');
      });
      list.appendChild(row);
    }

    if (!sources.length)
      list.innerHTML = '<div style="padding:8px;color:#999;font-size:10px;">No sources defined.</div>';
  }

  function showManageSourcesDialog() {
    selectedSourceId = null;
    const sourceForm = document.getElementById('source-form');
    if (sourceForm) sourceForm.style.display = 'none';
    refreshSourcesList();

    const overlay = document.getElementById('dlg-manage-sources');
    overlay.style.display = 'flex';

    const closeBtn = overlay.querySelector('.wp-dlg-ok');
    const handler = () => {
      overlay.style.display = 'none';
      closeBtn.removeEventListener('click', handler);
    };
    closeBtn.addEventListener('click', handler);
  }

  // ═══════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════

  WP.Bibliography = {
    init,
    insertCitation: showInsertCitationPrompt,
    generateBibliography,
    addSource,
    updateSource,
    deleteSource,
    getSources,
    showManageSourcesDialog,
    formatCitationInline,
    formatBibliographyEntry
  };
})();
