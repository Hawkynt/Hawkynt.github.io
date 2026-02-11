;(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let parsedJson = undefined;
  let parseError = null;
  let currentFilePath = null;
  let currentFileName = 'Untitled.json';
  let dirty = false;
  let selectedPath = '$';
  let collapsedPaths = new Set();
  let nodeCount = 0;

  // Search state
  let searchMatches = [];
  let searchIndex = -1;

  // Debounce timer
  let parseTimer = null;

  // DOM references
  const menuBar = document.getElementById('menu-bar');
  const toolbar = document.getElementById('toolbar');
  const editor = document.getElementById('editor');
  const errorBar = document.getElementById('error-bar');
  const treePanel = document.getElementById('tree-panel');
  const splitter = document.getElementById('splitter');
  const editorPanel = document.getElementById('editor-panel');
  const mainSplit = document.getElementById('main-split');
  const statusValid = document.getElementById('status-valid');
  const statusSize = document.getElementById('status-size');
  const statusNodes = document.getElementById('status-nodes');
  const statusPath = document.getElementById('status-path');
  const copyTooltip = document.getElementById('copy-tooltip');
  const searchBar = document.getElementById('search-bar');
  const searchInput = document.getElementById('search-input');
  const searchInfo = document.getElementById('search-info');
  let openMenu = null;

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function truncate(str, max) {
    if (str.length <= max)
      return str;
    return str.substring(0, max) + '...';
  }

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - JSON Viewer';
    document.title = title;
    SZ.Dlls.User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // JSON parsing
  // -----------------------------------------------------------------------
  function tryParse(text) {
    if (!text.trim()) {
      parsedJson = undefined;
      parseError = null;
      return;
    }
    try {
      parsedJson = JSON.parse(text);
      parseError = null;
    } catch (err) {
      parsedJson = undefined;
      parseError = err;
    }
  }

  function getErrorLineCol(text, err) {
    const match = err.message.match(/position\s+(\d+)/i);
    if (!match)
      return null;
    const pos = parseInt(match[1], 10);
    let line = 1;
    let col = 1;
    for (let i = 0; i < pos && i < text.length; ++i) {
      if (text[i] === '\n') {
        ++line;
        col = 1;
      } else
        ++col;
    }
    return { line, col, pos };
  }

  // -----------------------------------------------------------------------
  // Node counting
  // -----------------------------------------------------------------------
  function countNodes(val) {
    if (val === null || val === undefined || typeof val !== 'object')
      return 1;
    let count = 1;
    if (Array.isArray(val))
      for (const item of val)
        count += countNodes(item);
    else
      for (const k of Object.keys(val))
        count += countNodes(val[k]);
    return count;
  }

  // -----------------------------------------------------------------------
  // Tree rendering
  // -----------------------------------------------------------------------
  function renderTree() {
    if (parsedJson === undefined) {
      treePanel.innerHTML = '<div style="color:#999;padding:8px;font-style:italic;">No valid JSON to display.</div>';
      return;
    }
    nodeCount = countNodes(parsedJson);
    const html = renderValue(parsedJson, '$', '', false);
    treePanel.innerHTML = html;
    updateStatusBar();
  }

  function renderValue(val, path, keyHtml, trailingComma) {
    const comma = trailingComma ? '<span class="tree-comma">,</span>' : '';

    if (val === null)
      return '<div class="tree-line" data-path="' + escapeHtml(path) + '">' + keyHtml + '<span class="tree-val-null" data-copyval="null">null</span>' + comma + '</div>';

    if (typeof val === 'string') {
      const display = escapeHtml(truncate(val, 120));
      const full = escapeHtml(val);
      return '<div class="tree-line" data-path="' + escapeHtml(path) + '">' + keyHtml + '<span class="tree-val-string" data-copyval="' + full + '">"' + display + '"</span>' + comma + '</div>';
    }

    if (typeof val === 'number') {
      const str = String(val);
      return '<div class="tree-line" data-path="' + escapeHtml(path) + '">' + keyHtml + '<span class="tree-val-number" data-copyval="' + escapeHtml(str) + '">' + escapeHtml(str) + '</span>' + comma + '</div>';
    }

    if (typeof val === 'boolean') {
      const str = String(val);
      return '<div class="tree-line" data-path="' + escapeHtml(path) + '">' + keyHtml + '<span class="tree-val-boolean" data-copyval="' + str + '">' + str + '</span>' + comma + '</div>';
    }

    if (Array.isArray(val))
      return renderArray(val, path, keyHtml, comma);

    if (typeof val === 'object')
      return renderObject(val, path, keyHtml, comma);

    return '<div class="tree-line" data-path="' + escapeHtml(path) + '">' + keyHtml + escapeHtml(String(val)) + comma + '</div>';
  }

  function renderArray(arr, path, keyHtml, comma) {
    const collapsed = collapsedPaths.has(path);
    const toggle = '<span class="tree-toggle" data-toggle="' + escapeHtml(path) + '">' + (collapsed ? '\u25B6' : '\u25BC') + '</span>';

    if (collapsed) {
      const count = '<span class="tree-count"> // ' + arr.length + ' item' + (arr.length !== 1 ? 's' : '') + '</span>';
      return '<div class="tree-line" data-path="' + escapeHtml(path) + '">' + toggle + keyHtml + '<span class="tree-bracket">[...]</span>' + count + comma + '</div>';
    }

    let html = '<div class="tree-line" data-path="' + escapeHtml(path) + '">' + toggle + keyHtml + '<span class="tree-bracket">[</span></div>';
    html += '<div class="tree-node">';
    for (let i = 0; i < arr.length; ++i) {
      const childPath = path + '[' + i + ']';
      const idxHtml = '<span class="tree-key">' + i + '</span>: ';
      html += renderValue(arr[i], childPath, idxHtml, i < arr.length - 1);
    }
    html += '</div>';
    html += '<div class="tree-line" data-path="' + escapeHtml(path) + '"><span class="tree-bracket">]</span>' + comma + '</div>';
    return html;
  }

  function renderObject(obj, path, keyHtml, comma) {
    const keys = Object.keys(obj);
    const collapsed = collapsedPaths.has(path);
    const toggle = '<span class="tree-toggle" data-toggle="' + escapeHtml(path) + '">' + (collapsed ? '\u25B6' : '\u25BC') + '</span>';

    if (collapsed) {
      const count = '<span class="tree-count"> // ' + keys.length + ' key' + (keys.length !== 1 ? 's' : '') + '</span>';
      return '<div class="tree-line" data-path="' + escapeHtml(path) + '">' + toggle + keyHtml + '<span class="tree-bracket">{...}</span>' + count + comma + '</div>';
    }

    let html = '<div class="tree-line" data-path="' + escapeHtml(path) + '">' + toggle + keyHtml + '<span class="tree-bracket">{</span></div>';
    html += '<div class="tree-node">';
    for (let i = 0; i < keys.length; ++i) {
      const k = keys[i];
      const childPath = path + '.' + k;
      const kHtml = '<span class="tree-key">"' + escapeHtml(k) + '"</span>: ';
      html += renderValue(obj[k], childPath, kHtml, i < keys.length - 1);
    }
    html += '</div>';
    html += '<div class="tree-line" data-path="' + escapeHtml(path) + '"><span class="tree-bracket">}</span>' + comma + '</div>';
    return html;
  }

  // -----------------------------------------------------------------------
  // Tree interaction
  // -----------------------------------------------------------------------
  treePanel.addEventListener('click', (e) => {
    // Toggle collapse
    const toggle = e.target.closest('.tree-toggle');
    if (toggle) {
      const path = toggle.dataset.toggle;
      if (collapsedPaths.has(path))
        collapsedPaths.delete(path);
      else
        collapsedPaths.add(path);
      renderTree();
      applySearchHighlights();
      return;
    }

    // Copy value
    const copyEl = e.target.closest('[data-copyval]');
    if (copyEl) {
      const val = copyEl.dataset.copyval;
      navigator.clipboard.writeText(val).then(() => {
        showCopyTooltip(e.clientX, e.clientY);
      }).catch(() => {});
    }

    // Select line for path display
    const line = e.target.closest('.tree-line');
    if (line) {
      const path = line.dataset.path;
      if (path) {
        selectedPath = path;
        const prev = treePanel.querySelector('.tree-line.selected');
        if (prev)
          prev.classList.remove('selected');
        line.classList.add('selected');
        statusPath.textContent = path;
      }
    }
  });

  function showCopyTooltip(x, y) {
    copyTooltip.style.left = (x + 10) + 'px';
    copyTooltip.style.top = (y - 20) + 'px';
    copyTooltip.classList.add('visible');
    setTimeout(() => copyTooltip.classList.remove('visible'), 800);
  }

  // -----------------------------------------------------------------------
  // Editor input -> parse
  // -----------------------------------------------------------------------
  editor.addEventListener('input', () => {
    dirty = true;
    updateTitle();
    clearTimeout(parseTimer);
    parseTimer = setTimeout(parseAndUpdate, 300);
  });

  function parseAndUpdate() {
    const text = editor.value;
    tryParse(text);

    if (parseError) {
      const info = getErrorLineCol(text, parseError);
      let msg = parseError.message;
      if (info)
        msg = 'Line ' + info.line + ', Col ' + info.col + ': ' + msg;
      errorBar.textContent = msg;
      errorBar.classList.add('visible');
      statusValid.textContent = 'Invalid';
      statusValid.className = 'status-section status-valid invalid';
    } else {
      errorBar.classList.remove('visible');
      errorBar.textContent = '';
      if (text.trim()) {
        statusValid.textContent = 'Valid';
        statusValid.className = 'status-section status-valid valid';
      } else {
        statusValid.textContent = 'Ready';
        statusValid.className = 'status-section status-valid';
      }
    }

    renderTree();
    updateStatusBar();
  }

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------
  function updateStatusBar() {
    const text = editor.value;
    const bytes = new Blob([text]).size;
    statusSize.textContent = bytes.toLocaleString() + ' bytes';
    if (parsedJson !== undefined)
      statusNodes.textContent = nodeCount + ' node' + (nodeCount !== 1 ? 's' : '');
    else
      statusNodes.textContent = '';
  }

  // -----------------------------------------------------------------------
  // JSON transformations
  // -----------------------------------------------------------------------
  function doPrettify() {
    const text = editor.value.trim();
    if (!text)
      return;
    try {
      const obj = JSON.parse(text);
      editor.value = JSON.stringify(obj, null, 2);
      dirty = true;
      updateTitle();
      parseAndUpdate();
    } catch (_) {}
  }

  function doMinify() {
    const text = editor.value.trim();
    if (!text)
      return;
    try {
      const obj = JSON.parse(text);
      editor.value = JSON.stringify(obj);
      dirty = true;
      updateTitle();
      parseAndUpdate();
    } catch (_) {}
  }

  function doValidate() {
    parseAndUpdate();
    if (parseError) {
      const info = getErrorLineCol(editor.value, parseError);
      if (info) {
        editor.focus();
        editor.setSelectionRange(info.pos, info.pos + 1);
      }
    }
  }

  function doSortKeys() {
    const text = editor.value.trim();
    if (!text)
      return;
    try {
      const obj = JSON.parse(text);
      const sorted = sortKeysDeep(obj);
      editor.value = JSON.stringify(sorted, null, 2);
      dirty = true;
      updateTitle();
      parseAndUpdate();
    } catch (_) {}
  }

  function sortKeysDeep(val) {
    if (val === null || typeof val !== 'object')
      return val;
    if (Array.isArray(val))
      return val.map(sortKeysDeep);
    const keys = Object.keys(val).sort();
    const result = {};
    for (const k of keys)
      result[k] = sortKeysDeep(val[k]);
    return result;
  }

  function doFlatten() {
    const text = editor.value.trim();
    if (!text)
      return;
    try {
      const obj = JSON.parse(text);
      const flat = flattenObject(obj);
      editor.value = JSON.stringify(flat, null, 2);
      dirty = true;
      updateTitle();
      parseAndUpdate();
    } catch (_) {}
  }

  function flattenObject(obj, prefix, result) {
    if (!prefix)
      prefix = '';
    if (!result)
      result = {};
    if (obj === null || typeof obj !== 'object') {
      result[prefix] = obj;
      return result;
    }
    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        result[prefix] = [];
        return result;
      }
      for (let i = 0; i < obj.length; ++i) {
        const key = prefix ? prefix + '[' + i + ']' : String(i);
        flattenObject(obj[i], key, result);
      }
      return result;
    }
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      result[prefix] = {};
      return result;
    }
    for (const k of keys) {
      const key = prefix ? prefix + '.' + k : k;
      flattenObject(obj[k], key, result);
    }
    return result;
  }

  function doUnflatten() {
    const text = editor.value.trim();
    if (!text)
      return;
    try {
      const obj = JSON.parse(text);
      if (typeof obj !== 'object' || Array.isArray(obj) || obj === null)
        return;
      const unflat = unflattenObject(obj);
      editor.value = JSON.stringify(unflat, null, 2);
      dirty = true;
      updateTitle();
      parseAndUpdate();
    } catch (_) {}
  }

  function unflattenObject(flat) {
    const result = {};
    for (const fullKey of Object.keys(flat)) {
      const parts = [];
      let current = '';
      for (let i = 0; i < fullKey.length; ++i) {
        const ch = fullKey[i];
        if (ch === '.') {
          if (current)
            parts.push(current);
          current = '';
        } else if (ch === '[') {
          if (current)
            parts.push(current);
          current = '';
        } else if (ch === ']') {
          parts.push(current);
          current = '';
        } else
          current += ch;
      }
      if (current)
        parts.push(current);

      let target = result;
      for (let i = 0; i < parts.length - 1; ++i) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        const nextIsIndex = /^\d+$/.test(nextPart);
        if (!(part in target))
          target[part] = nextIsIndex ? [] : {};
        target = target[part];
      }
      if (parts.length > 0)
        target[parts[parts.length - 1]] = flat[fullKey];
    }
    return result;
  }

  function doCopyAll() {
    navigator.clipboard.writeText(editor.value).catch(() => {});
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------
  function toggleSearch() {
    if (searchBar.classList.contains('visible')) {
      closeSearch();
    } else {
      searchBar.classList.add('visible');
      searchInput.focus();
      searchInput.select();
    }
  }

  function closeSearch() {
    searchBar.classList.remove('visible');
    searchMatches = [];
    searchIndex = -1;
    searchInfo.textContent = '';
    clearSearchHighlights();
    editor.focus();
  }

  function performSearch() {
    const query = searchInput.value.trim().toLowerCase();
    searchMatches = [];
    searchIndex = -1;

    if (!query || parsedJson === undefined) {
      searchInfo.textContent = '';
      clearSearchHighlights();
      return;
    }

    const lines = treePanel.querySelectorAll('.tree-line');
    for (const line of lines) {
      const text = line.textContent.toLowerCase();
      if (text.includes(query))
        searchMatches.push(line);
    }

    searchInfo.textContent = searchMatches.length + ' match' + (searchMatches.length !== 1 ? 'es' : '');
    applySearchHighlights();

    if (searchMatches.length > 0)
      navigateSearch(0);
  }

  function applySearchHighlights() {
    clearSearchHighlights();
    for (let i = 0; i < searchMatches.length; ++i) {
      searchMatches[i].classList.add('search-match');
      if (i === searchIndex)
        searchMatches[i].classList.add('search-active');
    }
  }

  function clearSearchHighlights() {
    const matches = treePanel.querySelectorAll('.search-match');
    for (const m of matches) {
      m.classList.remove('search-match');
      m.classList.remove('search-active');
    }
  }

  function navigateSearch(idx) {
    if (searchMatches.length === 0)
      return;
    if (searchIndex >= 0 && searchIndex < searchMatches.length)
      searchMatches[searchIndex].classList.remove('search-active');

    searchIndex = ((idx % searchMatches.length) + searchMatches.length) % searchMatches.length;
    searchMatches[searchIndex].classList.add('search-active');
    searchMatches[searchIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
    searchInfo.textContent = (searchIndex + 1) + '/' + searchMatches.length;
  }

  searchInput.addEventListener('input', () => performSearch());

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey)
        navigateSearch(searchIndex - 1);
      else
        navigateSearch(searchIndex + 1);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  });

  document.getElementById('search-prev').addEventListener('click', () => navigateSearch(searchIndex - 1));
  document.getElementById('search-next').addEventListener('click', () => navigateSearch(searchIndex + 1));
  document.getElementById('search-close').addEventListener('click', () => closeSearch());

  // -----------------------------------------------------------------------
  // Expand / Collapse All
  // -----------------------------------------------------------------------
  function expandAll() {
    collapsedPaths.clear();
    renderTree();
    applySearchHighlights();
  }

  function collapseAll() {
    if (parsedJson === undefined)
      return;
    collapsedPaths.clear();
    collectCollapsible(parsedJson, '$');
    renderTree();
    applySearchHighlights();
  }

  function collectCollapsible(val, path) {
    if (val === null || typeof val !== 'object')
      return;
    collapsedPaths.add(path);
    if (Array.isArray(val))
      for (let i = 0; i < val.length; ++i)
        collectCollapsible(val[i], path + '[' + i + ']');
    else
      for (const k of Object.keys(val))
        collectCollapsible(val[k], path + '.' + k);
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
  function doNew() {
    editor.value = '';
    parsedJson = undefined;
    parseError = null;
    currentFilePath = null;
    currentFileName = 'Untitled.json';
    dirty = false;
    collapsedPaths.clear();
    selectedPath = '$';
    updateTitle();
    parseAndUpdate();
    editor.focus();
  }

  async function doOpen() {
    const result = await SZ.Dlls.ComDlg32.GetOpenFileName({
      filters: [
        { name: 'JSON Files', ext: ['json'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      title: 'Open',
    });
    if (!result.cancelled && result.path)
      loadFile(result.path, result.content);
  }

  async function loadFile(path, content) {
    let text = '';
    if (typeof content === 'string')
      text = content;
    else if (content == null) {
      try {
        text = await SZ.Dlls.Kernel32.ReadFile(path);
        if (text == null)
          text = '';
      } catch (err) {
        await SZ.Dlls.User32.MessageBox('Could not open file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
        return;
      }
    }

    editor.value = text;
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled.json';
    dirty = false;
    collapsedPaths.clear();
    selectedPath = '$';
    updateTitle();
    parseAndUpdate();
    editor.focus();
  }

  function doSave() {
    if (!currentFilePath) {
      doSaveAs();
      return;
    }
    saveToPath(currentFilePath);
  }

  async function doSaveAs() {
    const result = await SZ.Dlls.ComDlg32.GetSaveFileName({
      filters: [
        { name: 'JSON Files', ext: ['json'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      defaultName: currentFileName || 'Untitled.json',
      title: 'Save As',
      content: editor.value,
    });
    if (!result.cancelled && result.path) {
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled.json';
      dirty = false;
      updateTitle();
    }
  }

  async function saveToPath(path) {
    try {
      await SZ.Dlls.Kernel32.WriteFile(path, editor.value);
      dirty = false;
      updateTitle();
    } catch (err) {
      await SZ.Dlls.User32.MessageBox('Could not save file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
    }
  }

  // -----------------------------------------------------------------------
  // Splitter drag
  // -----------------------------------------------------------------------
  let splitting = false;

  splitter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitting = true;
    splitter.setPointerCapture(e.pointerId);
  });

  splitter.addEventListener('pointermove', (e) => {
    if (!splitting)
      return;
    const rect = mainSplit.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    const clamped = Math.max(15, Math.min(85, pct));
    editorPanel.style.flex = 'none';
    editorPanel.style.width = clamped + '%';
  });

  splitter.addEventListener('pointerup', () => {
    splitting = false;
  });

  splitter.addEventListener('lostpointercapture', () => {
    splitting = false;
  });

  // -----------------------------------------------------------------------
  // Menu system
  // -----------------------------------------------------------------------
  function closeMenus() {
    for (const item of menuBar.querySelectorAll('.menu-item'))
      item.classList.remove('open');
    openMenu = null;
  }

  for (const menuItem of menuBar.querySelectorAll('.menu-item')) {
    menuItem.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.menu-entry') || e.target.closest('.menu-separator'))
        return;
      if (openMenu === menuItem) {
        closeMenus();
        return;
      }
      closeMenus();
      menuItem.classList.add('open');
      openMenu = menuItem;
    });

    menuItem.addEventListener('pointerenter', () => {
      if (openMenu && openMenu !== menuItem) {
        closeMenus();
        menuItem.classList.add('open');
        openMenu = menuItem;
      }
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !menuBar.contains(e.target))
      closeMenus();
  });

  // -----------------------------------------------------------------------
  // Action dispatcher
  // -----------------------------------------------------------------------
  function handleAction(action) {
    switch (action) {
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'exit': SZ.Dlls.User32.DestroyWindow(); break;
      case 'prettify': doPrettify(); break;
      case 'minify': doMinify(); break;
      case 'validate': doValidate(); break;
      case 'sort-keys': doSortKeys(); break;
      case 'flatten': doFlatten(); break;
      case 'unflatten': doUnflatten(); break;
      case 'copy-all': doCopyAll(); break;
      case 'find': toggleSearch(); break;
      case 'expand-all': expandAll(); break;
      case 'collapse-all': collapseAll(); break;
      case 'about': showAbout(); break;
    }
  }

  // Menu entries
  for (const entry of document.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.action;
      closeMenus();
      handleAction(action);
    });
  }

  // Toolbar buttons
  for (const btn of toolbar.querySelectorAll('button[data-action]')) {
    btn.addEventListener('click', () => {
      handleAction(btn.dataset.action);
    });
  }

  // -----------------------------------------------------------------------
  // About dialog
  // -----------------------------------------------------------------------
  function showAbout() {
    const dlg = document.getElementById('dlg-about');
    dlg.classList.add('visible');
    const okBtn = document.getElementById('about-ok');
    okBtn.focus();
    function handler() {
      dlg.classList.remove('visible');
      okBtn.removeEventListener('click', handler);
    }
    okBtn.addEventListener('click', handler);
  }

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      e.preventDefault();
      doValidate();
      return;
    }

    if (!e.ctrlKey)
      return;

    if (e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'f':
          e.preventDefault();
          doPrettify();
          return;
        case 'c':
          e.preventDefault();
          doCopyAll();
          return;
      }
    }

    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        doNew();
        break;
      case 'o':
        e.preventDefault();
        doOpen();
        break;
      case 's':
        e.preventDefault();
        doSave();
        break;
      case 'f':
        e.preventDefault();
        toggleSearch();
        break;
    }
  });

  // -----------------------------------------------------------------------
  // Drag and drop file support
  // -----------------------------------------------------------------------
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file)
      return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.value = reader.result;
      currentFilePath = null;
      currentFileName = file.name;
      dirty = false;
      collapsedPaths.clear();
      selectedPath = '$';
      updateTitle();
      parseAndUpdate();
    };
    reader.readAsText(file);
  });

  // -----------------------------------------------------------------------
  // Resize observer
  // -----------------------------------------------------------------------
  const resizeObserver = new ResizeObserver(() => {
    // No-op for now, layout handled by flexbox
  });
  resizeObserver.observe(treePanel);

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    // Check for file path on command line
    const cmd = SZ.Dlls.Kernel32.GetCommandLine();
    if (cmd.path) {
      loadFile(cmd.path, null);
    } else {
      // Start with sample data
      const sampleJson = {
        "name": "SynthelicZ",
        "version": "2.0",
        "features": ["windows", "skins", "taskbar", "apps"],
        "settings": {
          "theme": "LUNAX",
          "resolution": { "width": 1024, "height": 768 },
          "fullscreen": false
        },
        "authors": null
      };

      editor.value = JSON.stringify(sampleJson, null, 2);
    }

    updateTitle();
    parseAndUpdate();
    editor.focus();
  }

  init();
})();
