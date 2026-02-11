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
  let wordWrap = true;

  const editor = document.getElementById('editor');
  const menuBar = document.getElementById('menu-bar');
  let openMenu = null;

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - Notepad';
    document.title = title;
    User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Dirty tracking
  // -----------------------------------------------------------------------
  editor.addEventListener('input', () => {
    const nowDirty = editor.value !== savedContent;
    if (nowDirty !== dirty) {
      dirty = nowDirty;
      updateTitle();
    }
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
  // Menu actions
  // -----------------------------------------------------------------------
  for (const entry of document.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.action;
      closeMenus();
      handleAction(action, entry);
    });
  }

  function handleAction(action, entry) {
    switch (action) {
      case 'new':
        doNew();
        break;
      case 'open':
        doOpen();
        break;
      case 'save':
        doSave();
        break;
      case 'save-as':
        doSaveAs();
        break;
      case 'exit':
        doExit();
        break;
      case 'undo':
        document.execCommand('undo');
        editor.focus();
        break;
      case 'cut':
        document.execCommand('cut');
        editor.focus();
        break;
      case 'copy':
        document.execCommand('copy');
        editor.focus();
        break;
      case 'paste':
        navigator.clipboard.readText().then(text => {
          const start = editor.selectionStart;
          const end = editor.selectionEnd;
          editor.setRangeText(text, start, end, 'end');
          editor.dispatchEvent(new Event('input'));
          editor.focus();
        }).catch(() => {
          document.execCommand('paste');
          editor.focus();
        });
        break;
      case 'delete': {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        if (start !== end) {
          editor.setRangeText('', start, end, 'start');
          editor.dispatchEvent(new Event('input'));
        }
        editor.focus();
        break;
      }
      case 'select-all':
        editor.select();
        editor.focus();
        break;
      case 'time-date': {
        const now = new Date();
        const timeStr = now.toLocaleTimeString() + ' ' + now.toLocaleDateString();
        const pos = editor.selectionStart;
        editor.setRangeText(timeStr, pos, editor.selectionEnd, 'end');
        editor.dispatchEvent(new Event('input'));
        editor.focus();
        break;
      }
      case 'word-wrap':
        wordWrap = !wordWrap;
        if (entry)
          entry.classList.toggle('checked', wordWrap);
        editor.className = wordWrap ? 'word-wrap' : 'no-wrap';
        break;
      case 'find':
        showFindReplace(false);
        break;
      case 'replace':
        showFindReplace(true);
        break;
      case 'font':
        showFontDialog();
        break;
      case 'about':
        showDialog('dlg-about');
        break;
    }
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
    editor.value = '';
    savedContent = '';
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    updateTitle();
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
      filters: [
        { name: 'Text Files', ext: ['txt', 'md', 'log', 'cfg'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      title: 'Open',
    });
    if (!result.cancelled && result.path)
      loadFile(result.path, result.content);
  }

  async function loadFile(path, content) {
    if (content == null) {
      try {
        content = await Kernel32.ReadFile(path);
      } catch (err) {
        await User32.MessageBox('Could not open file: ' + err.message, 'Notepad', MB_OK);
        return;
      }
    }
    editor.value = content != null ? String(content) : '';
    savedContent = editor.value;
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
    const result = await ComDlg32.GetSaveFileName({
      filters: [
        { name: 'Text Files', ext: ['txt', 'md', 'log', 'cfg'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      defaultName: currentFileName || 'Untitled.txt',
      title: 'Save As',
      content: editor.value,
    });
    if (!result.cancelled && result.path) {
      savedContent = editor.value;
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
      await Kernel32.WriteFile(path, editor.value);
    } catch (err) {
      await User32.MessageBox('Could not save file: ' + err.message, 'Notepad', MB_OK);
      return;
    }
    savedContent = editor.value;
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
  // Font dialog
  // -----------------------------------------------------------------------
  function showFontDialog() {
    const familySelect = document.getElementById('font-family');
    const sizeInput = document.getElementById('font-size');
    const boldCheck = document.getElementById('font-bold');
    const italicCheck = document.getElementById('font-italic');
    const preview = document.getElementById('font-preview');

    const cs = getComputedStyle(editor);
    const currentSize = Math.round(parseFloat(cs.fontSize));
    sizeInput.value = currentSize || 13;
    boldCheck.checked = cs.fontWeight === 'bold' || parseInt(cs.fontWeight, 10) >= 700;
    italicCheck.checked = cs.fontStyle === 'italic';

    const currentFamily = cs.fontFamily;
    let matched = false;
    for (const opt of familySelect.options) {
      const primary = opt.value.split(',')[0].replace(/'/g, '').trim().toLowerCase();
      if (currentFamily.toLowerCase().includes(primary)) {
        opt.selected = true;
        matched = true;
        break;
      }
    }
    if (!matched)
      familySelect.selectedIndex = 0;

    function updatePreview() {
      preview.style.fontFamily = familySelect.value;
      preview.style.fontSize = sizeInput.value + 'px';
      preview.style.fontWeight = boldCheck.checked ? 'bold' : 'normal';
      preview.style.fontStyle = italicCheck.checked ? 'italic' : 'normal';
    }

    updatePreview();
    familySelect.addEventListener('change', updatePreview);
    sizeInput.addEventListener('input', updatePreview);
    boldCheck.addEventListener('change', updatePreview);
    italicCheck.addEventListener('change', updatePreview);

    const overlay = document.getElementById('dlg-font');
    overlay.classList.add('visible');

    awaitDialogResult(overlay, (result) => {
      familySelect.removeEventListener('change', updatePreview);
      sizeInput.removeEventListener('input', updatePreview);
      boldCheck.removeEventListener('change', updatePreview);
      italicCheck.removeEventListener('change', updatePreview);

      if (result !== 'ok')
        return;

      let size = parseInt(sizeInput.value, 10);
      if (isNaN(size) || size < 8)
        size = 8;
      if (size > 72)
        size = 72;

      editor.style.fontFamily = familySelect.value;
      editor.style.fontSize = size + 'px';
      editor.style.fontWeight = boldCheck.checked ? 'bold' : 'normal';
      editor.style.fontStyle = italicCheck.checked ? 'italic' : 'normal';
      editor.focus();
    });
  }

  // -----------------------------------------------------------------------
  // Find / Replace (non-modal panel)
  // -----------------------------------------------------------------------
  const frPanel = document.getElementById('find-replace-panel');
  const frFindInput = document.getElementById('fr-find-input');
  const frReplaceInput = document.getElementById('fr-replace-input');
  const frStatus = document.getElementById('fr-status');
  let frLastIndex = 0;

  function showFindReplace(showReplace) {
    frPanel.classList.add('visible');
    const replaceRow = frReplaceInput.closest('.fr-field');
    const replaceBtn = document.getElementById('fr-replace-btn');
    const replaceAllBtn = document.getElementById('fr-replace-all');
    replaceRow.style.display = showReplace ? '' : 'none';
    replaceBtn.style.display = showReplace ? '' : 'none';
    replaceAllBtn.style.display = showReplace ? '' : 'none';

    const titleSpan = frPanel.querySelector('.find-replace-title span');
    titleSpan.textContent = showReplace ? 'Find and Replace' : 'Find';

    frFindInput.focus();
    frFindInput.select();
    frStatus.textContent = '';
  }

  function closeFindReplace() {
    frPanel.classList.remove('visible');
    editor.focus();
  }

  document.getElementById('fr-close').addEventListener('click', closeFindReplace);

  function findNext() {
    const needle = frFindInput.value;
    if (!needle) {
      frStatus.textContent = '';
      return false;
    }

    const text = editor.value;
    const startPos = editor.selectionEnd > frLastIndex ? editor.selectionEnd : frLastIndex;
    let idx = text.indexOf(needle, startPos);

    if (idx === -1 && startPos > 0)
      idx = text.indexOf(needle, 0);

    if (idx === -1) {
      frStatus.textContent = 'No matches found.';
      return false;
    }

    editor.focus();
    editor.setSelectionRange(idx, idx + needle.length);
    frLastIndex = idx + needle.length;
    frStatus.textContent = '';
    updateStatusBar();
    return true;
  }

  function replaceCurrent() {
    const needle = frFindInput.value;
    if (!needle)
      return;

    const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    if (selected !== needle) {
      findNext();
      return;
    }

    const replacement = frReplaceInput.value;
    editor.setRangeText(replacement, editor.selectionStart, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input'));
    frLastIndex = editor.selectionEnd;
    findNext();
  }

  function replaceAll() {
    const needle = frFindInput.value;
    if (!needle)
      return;

    const replacement = frReplaceInput.value;
    const text = editor.value;
    let count = 0;
    let result = '';
    let pos = 0;
    let idx;

    while ((idx = text.indexOf(needle, pos)) !== -1) {
      result += text.substring(pos, idx) + replacement;
      pos = idx + needle.length;
      ++count;
    }
    result += text.substring(pos);

    if (count === 0) {
      frStatus.textContent = 'No matches found.';
      return;
    }

    editor.value = result;
    editor.dispatchEvent(new Event('input'));
    frStatus.textContent = count + ' replacement' + (count !== 1 ? 's' : '') + ' made.';
    frLastIndex = 0;
    updateStatusBar();
  }

  document.getElementById('fr-find-next').addEventListener('click', findNext);
  document.getElementById('fr-replace-btn').addEventListener('click', replaceCurrent);
  document.getElementById('fr-replace-all').addEventListener('click', replaceAll);

  frFindInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findNext();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFindReplace();
    }
  });

  frReplaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFindReplace();
    }
  });

  frFindInput.addEventListener('input', () => {
    frLastIndex = 0;
    frStatus.textContent = '';
  });

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------
  const statusPos = document.getElementById('status-pos');
  const statusChars = document.getElementById('status-chars');

  function updateStatusBar() {
    const text = editor.value;
    const pos = editor.selectionStart;
    const before = text.substring(0, pos);
    const lines = before.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    statusPos.textContent = 'Ln ' + line + ', Col ' + col;
    statusChars.textContent = text.length + ' character' + (text.length !== 1 ? 's' : '');
  }

  editor.addEventListener('input', updateStatusBar);
  editor.addEventListener('click', updateStatusBar);
  editor.addEventListener('keyup', updateStatusBar);

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      handleAction('time-date');
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
      case 'a':
        break;
      case 'f':
        e.preventDefault();
        handleAction('find');
        break;
      case 'h':
        e.preventDefault();
        handleAction('replace');
        break;
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
    updateStatusBar();
  }
  editor.focus();
})();
