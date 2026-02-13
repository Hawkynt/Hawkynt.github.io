;(function() {
  'use strict';

  const { User32, Kernel32, ComDlg32 } = SZ.Dlls;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let currentFilePath = null;
  let currentFileName = 'Untitled';
  let dirty = false;
  let savedContent = '';
  let updateTimer = null;
  const UPDATE_DELAY = 300;

  const source = document.getElementById('source');
  const preview = document.getElementById('preview');
  const menuBar = document.getElementById('menu-bar');
  const splitContainer = document.getElementById('split-container');
  const splitter = document.getElementById('splitter');
  let openMenu = null;

  const FILE_FILTERS = [
    { name: 'Markdown Files', ext: ['md', 'markdown', 'mkd'] },
    { name: 'Text Files', ext: ['txt'] },
    { name: 'All Files', ext: ['*'] }
  ];

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - Markdown Editor';
    document.title = title;
    User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Dirty tracking
  // -----------------------------------------------------------------------
  source.addEventListener('input', () => {
    const nowDirty = source.value !== savedContent;
    if (nowDirty !== dirty) {
      dirty = nowDirty;
      updateTitle();
    }
    schedulePreviewUpdate();
    updateStatusBar();
  });

  // -----------------------------------------------------------------------
  // Markdown rendering
  // -----------------------------------------------------------------------
  function schedulePreviewUpdate() {
    if (updateTimer)
      clearTimeout(updateTimer);
    updateTimer = setTimeout(renderPreview, UPDATE_DELAY);
  }

  function renderPreview() {
    updateTimer = null;
    preview.innerHTML = markdownToHtml(source.value);
  }

  function markdownToHtml(md) {
    if (!md)
      return '';

    let html = md;

    // Escape HTML entities
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Fenced code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return '<pre><code>' + code.replace(/\n$/, '') + '</code></pre>';
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Horizontal rule
    html = html.replace(/^(?:---|\*\*\*|___)$/gm, '<hr>');

    // Headers
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Blockquotes
    html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Bold + italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Tables
    html = html.replace(/^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)*)/gm, (_, headerLine, sepLine, bodyLines) => {
      const headers = headerLine.split('|').filter(c => c.trim());
      const rows = bodyLines.trim().split('\n');
      let table = '<table><thead><tr>';
      for (const h of headers)
        table += '<th>' + h.trim() + '</th>';
      table += '</tr></thead><tbody>';
      for (const row of rows) {
        const cells = row.split('|').filter(c => c.trim());
        table += '<tr>';
        for (const c of cells)
          table += '<td>' + c.trim() + '</td>';
        table += '</tr>';
      }
      table += '</tbody></table>';
      return table;
    });

    // Unordered lists
    html = html.replace(/(?:^[*\-+]\s+.+$\n?)+/gm, (block) => {
      const items = block.trim().split('\n');
      const lis = items.map(line => '<li>' + line.replace(/^[*\-+]\s+/, '') + '</li>');
      return '<ul>' + lis.join('') + '</ul>';
    });

    // Ordered lists
    html = html.replace(/(?:^\d+\.\s+.+$\n?)+/gm, (block) => {
      const items = block.trim().split('\n');
      const lis = items.map(line => '<li>' + line.replace(/^\d+\.\s+/, '') + '</li>');
      return '<ol>' + lis.join('') + '</ol>';
    });

    // Paragraphs: wrap remaining lines that aren't already tags
    const lines = html.split('\n');
    const result = [];
    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed === '') {
        result.push('');
        continue;
      }
      if (/^<(h[1-6]|hr|pre|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|div|p)/.test(trimmed)) {
        result.push(line);
        continue;
      }
      result.push('<p>' + trimmed + '</p>');
    }

    return result.join('\n');
  }

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
  // Menu actions
  // -----------------------------------------------------------------------
  for (const entry of document.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.action;
      closeMenus();
      handleAction(action);
    });
  }

  function handleAction(action) {
    switch (action) {
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'exit': doExit(); break;
      case 'undo': document.execCommand('undo'); source.focus(); break;
      case 'redo': document.execCommand('redo'); source.focus(); break;
      case 'cut': document.execCommand('cut'); source.focus(); break;
      case 'copy': document.execCommand('copy'); source.focus(); break;
      case 'paste':
        navigator.clipboard.readText().then(text => {
          const start = source.selectionStart;
          const end = source.selectionEnd;
          source.setRangeText(text, start, end, 'end');
          source.dispatchEvent(new Event('input'));
          source.focus();
        }).catch(() => {
          document.execCommand('paste');
          source.focus();
        });
        break;
      case 'select-all': source.select(); source.focus(); break;
      case 'view-split': setViewMode('split'); break;
      case 'view-source': setViewMode('source-only'); break;
      case 'view-preview': setViewMode('preview-only'); break;
      case 'insert-heading': insertAtCursor('# '); break;
      case 'insert-bold': wrapSelection('**'); break;
      case 'insert-italic': wrapSelection('*'); break;
      case 'insert-code': wrapSelection('`'); break;
      case 'insert-link': insertLink(); break;
      case 'insert-image': insertImage(); break;
      case 'insert-list': insertAtCursor('- '); break;
      case 'insert-olist': insertAtCursor('1. '); break;
      case 'insert-hr': insertAtCursor('\n---\n'); break;
      case 'insert-blockquote': insertAtCursor('> '); break;
      case 'insert-code-block': wrapSelection('\n```\n', '\n```\n'); break;
      case 'insert-table':
        insertAtCursor('\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell 1 | Cell 2 | Cell 3 |\n');
        break;
      case 'about': showDialog('dlg-about'); break;
    }
  }

  // -----------------------------------------------------------------------
  // Text insertion helpers
  // -----------------------------------------------------------------------
  function insertAtCursor(text) {
    const pos = source.selectionStart;
    source.setRangeText(text, pos, source.selectionEnd, 'end');
    source.dispatchEvent(new Event('input'));
    source.focus();
  }

  function wrapSelection(wrap, wrapEnd) {
    const start = source.selectionStart;
    const end = source.selectionEnd;
    const selected = source.value.substring(start, end);
    const endWrap = wrapEnd || wrap;
    const replacement = wrap + (selected || 'text') + endWrap;
    source.setRangeText(replacement, start, end, 'select');
    if (!selected)
      source.setSelectionRange(start + wrap.length, start + wrap.length + 4);
    source.dispatchEvent(new Event('input'));
    source.focus();
  }

  function insertLink() {
    const start = source.selectionStart;
    const end = source.selectionEnd;
    const selected = source.value.substring(start, end);
    const text = selected || 'link text';
    const md = '[' + text + '](url)';
    source.setRangeText(md, start, end, 'end');
    source.dispatchEvent(new Event('input'));
    source.focus();
  }

  function insertImage() {
    const start = source.selectionStart;
    const end = source.selectionEnd;
    const selected = source.value.substring(start, end);
    const alt = selected || 'alt text';
    const md = '![' + alt + '](url)';
    source.setRangeText(md, start, end, 'end');
    source.dispatchEvent(new Event('input'));
    source.focus();
  }

  // -----------------------------------------------------------------------
  // View mode
  // -----------------------------------------------------------------------
  let currentViewMode = 'split';

  function setViewMode(mode) {
    splitContainer.className = 'split-container ' + mode;
    currentViewMode = mode;
    if (mode === 'preview-only')
      renderPreview();
    for (const btn of document.querySelectorAll('.toolbar button[data-action^="view-"]')) {
      btn.classList.toggle('active', btn.dataset.action === 'view-' + mode.replace('-only', ''));
    }
  }

  // -----------------------------------------------------------------------
  // Splitter drag
  // -----------------------------------------------------------------------
  splitter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitter.setPointerCapture(e.pointerId);

    const containerRect = splitContainer.getBoundingClientRect();
    const sourcePane = document.querySelector('.source-pane');

    const onMove = (me) => {
      const x = me.clientX - containerRect.left;
      const ratio = x / containerRect.width;
      const clamped = Math.max(0.2, Math.min(0.8, ratio));
      sourcePane.style.flex = 'none';
      sourcePane.style.width = (clamped * 100) + '%';
    };

    const onUp = () => {
      splitter.removeEventListener('pointermove', onMove);
      splitter.removeEventListener('pointerup', onUp);
    };

    splitter.addEventListener('pointermove', onMove);
    splitter.addEventListener('pointerup', onUp);
  });

  // -----------------------------------------------------------------------
  // Toolbar buttons
  // -----------------------------------------------------------------------
  for (const btn of document.querySelectorAll('.toolbar button[data-action]')) {
    btn.addEventListener('click', () => {
      handleAction(btn.dataset.action);
    });
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
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
    source.value = '';
    savedContent = '';
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    updateTitle();
    renderPreview();
    updateStatusBar();
    source.focus();
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
        await User32.MessageBox('Could not open file: ' + err.message, 'Markdown Editor', MB_OK);
        return;
      }
    }
    source.value = content != null ? String(content) : '';
    savedContent = source.value;
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    updateTitle();
    renderPreview();
    updateStatusBar();
    source.focus();
  }

  function doSave(callback) {
    if (!currentFilePath) {
      doSaveAs(callback);
      return;
    }
    saveToPath(currentFilePath, callback);
  }

  async function doSaveAs(callback) {
    const result = await ComDlg32.GetSaveFileName({
      filters: FILE_FILTERS,
      initialDir: '/user/documents',
      defaultName: currentFileName || 'Untitled.md',
      title: 'Save As',
      content: source.value,
    });
    if (!result.cancelled && result.path) {
      savedContent = source.value;
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';
      dirty = false;
      updateTitle();
      if (typeof callback === 'function')
        callback();
    }
  }

  async function saveToPath(path, callback) {
    try {
      await Kernel32.WriteFile(path, source.value);
    } catch (err) {
      await User32.MessageBox('Could not save file: ' + err.message, 'Markdown Editor', MB_OK);
      return;
    }
    savedContent = source.value;
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    updateTitle();
    if (typeof callback === 'function')
      callback();
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

  // -----------------------------------------------------------------------
  // Dialog helpers
  // -----------------------------------------------------------------------
  function showDialog(id) {
    const overlay = document.getElementById(id);
    overlay.classList.add('visible');
    awaitDialogResult(overlay);
  }

  function awaitDialogResult(overlay, callback) {
    function handleClick(e) {
      const btn = e.target.closest('[data-result]');
      if (!btn)
        return;
      overlay.classList.remove('visible');
      overlay.removeEventListener('click', handleClick);
      if (typeof callback === 'function')
        callback(btn.dataset.result);
    }
    overlay.addEventListener('click', handleClick);
  }

  function promptSaveChanges(callback) {
    const overlay = document.getElementById('dlg-save-changes');
    overlay.classList.add('visible');
    awaitDialogResult(overlay, callback);
  }

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------
  const statusPos = document.getElementById('status-pos');
  const statusWords = document.getElementById('status-words');

  function updateStatusBar() {
    const text = source.value;
    const pos = source.selectionStart;
    const before = text.substring(0, pos);
    const lines = before.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    statusPos.textContent = 'Ln ' + line + ', Col ' + col;

    const trimmed = text.trim();
    const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
    statusWords.textContent = 'Words: ' + wordCount;
  }

  source.addEventListener('click', updateStatusBar);
  source.addEventListener('keyup', updateStatusBar);

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
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
      case 'b':
        e.preventDefault();
        handleAction('insert-bold');
        break;
      case 'i':
        e.preventDefault();
        handleAction('insert-italic');
        break;
      case 'k':
        e.preventDefault();
        handleAction('insert-link');
        break;
    }
  });

  // -----------------------------------------------------------------------
  // Tab key inserts spaces in source
  // -----------------------------------------------------------------------
  source.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const pos = source.selectionStart;
      source.setRangeText('  ', pos, source.selectionEnd, 'end');
      source.dispatchEvent(new Event('input'));
    }
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  const cmd = Kernel32.GetCommandLine();
  if (cmd.path)
    loadFile(cmd.path);
  else {
    updateTitle();
    renderPreview();
    updateStatusBar();
  }
  source.focus();
})();
