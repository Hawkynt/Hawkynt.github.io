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

  const editor = document.getElementById('editor');
  const menuBar = document.getElementById('menu-bar');
  let openMenu = null;

  const FILE_FILTERS = [
    { name: 'Rich Text', ext: ['html', 'htm'] },
    { name: 'Text Files', ext: ['txt'] },
    { name: 'All Files', ext: ['*'] }
  ];

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - WordPad';
    document.title = title;
    User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Dirty tracking
  // -----------------------------------------------------------------------
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
      case 'redo':
        document.execCommand('redo');
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
        document.execCommand('paste');
        editor.focus();
        break;
      case 'find':
        showFind();
        break;
      case 'select-all':
        document.execCommand('selectAll');
        editor.focus();
        break;
      case 'font-dialog':
        showFontDialog();
        break;
      case 'paragraph-dialog':
        showParagraphDialog();
        break;
      case 'about':
        showDialog('dlg-about');
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Formatting toolbar
  // -----------------------------------------------------------------------
  const fontFamilySelect = document.getElementById('tb-font-family');
  const fontSizeSelect = document.getElementById('tb-font-size');
  const textColorInput = document.getElementById('tb-text-color');

  for (const btn of document.querySelectorAll('.tb-btn[data-cmd]')) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      document.execCommand(cmd, false, null);
      editor.focus();
      updateToolbarState();
    });
  }

  fontFamilySelect.addEventListener('change', () => {
    document.execCommand('fontName', false, fontFamilySelect.value);
    editor.focus();
  });

  fontSizeSelect.addEventListener('change', () => {
    document.execCommand('fontSize', false, fontSizeSelect.value);
    editor.focus();
  });

  textColorInput.addEventListener('input', () => {
    document.execCommand('foreColor', false, textColorInput.value);
    editor.focus();
  });

  function updateToolbarState() {
    const cmds = ['bold', 'italic', 'underline', 'strikeThrough',
                  'justifyLeft', 'justifyCenter', 'justifyRight',
                  'insertUnorderedList', 'insertOrderedList'];
    for (const cmd of cmds) {
      const btn = document.querySelector('.tb-btn[data-cmd="' + cmd + '"]');
      if (btn) {
        if (document.queryCommandState(cmd))
          btn.classList.add('active');
        else
          btn.classList.remove('active');
      }
    }

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

    const fontSize = document.queryCommandValue('fontSize');
    if (fontSize)
      fontSizeSelect.value = fontSize;

    const foreColor = document.queryCommandValue('foreColor');
    if (foreColor) {
      const hex = rgbToHex(foreColor);
      if (hex)
        textColorInput.value = hex;
    }
  }

  function rgbToHex(color) {
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

  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('pointerup', () => {
    setTimeout(updateToolbarState, 0);
  });

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
  function getEditorContent() {
    return editor.innerHTML;
  }

  function setEditorContent(html) {
    editor.innerHTML = html;
    savedContent = editor.innerHTML;
    dirty = false;
    updateTitle();
    updateStatusBar();
    updateToolbarState();
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
      loadFile(result.path, result.content);
  }

  async function loadFile(path, content) {
    if (content == null) {
      try {
        content = await Kernel32.ReadFile(path);
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
    } else
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
      savedContent = editor.innerHTML;
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
    const familySelect = document.getElementById('dlg-font-family');
    const sizeInput = document.getElementById('dlg-font-size');
    const boldCheck = document.getElementById('dlg-font-bold');
    const italicCheck = document.getElementById('dlg-font-italic');
    const underlineCheck = document.getElementById('dlg-font-underline');
    const strikeCheck = document.getElementById('dlg-font-strike');
    const colorInput = document.getElementById('dlg-font-color');
    const preview = document.getElementById('dlg-font-preview');

    boldCheck.checked = document.queryCommandState('bold');
    italicCheck.checked = document.queryCommandState('italic');
    underlineCheck.checked = document.queryCommandState('underline');
    strikeCheck.checked = document.queryCommandState('strikeThrough');

    const currentFont = document.queryCommandValue('fontName');
    if (currentFont) {
      const clean = currentFont.replace(/"/g, '').replace(/'/g, '');
      let matched = false;
      for (const opt of familySelect.options) {
        if (clean.toLowerCase().indexOf(opt.value.toLowerCase()) !== -1) {
          opt.selected = true;
          matched = true;
          break;
        }
      }
      if (!matched)
        familySelect.selectedIndex = 0;
    }

    const sizeMap = { '1': 8, '2': 10, '3': 12, '4': 14, '5': 18, '6': 24, '7': 36 };
    const currentSize = document.queryCommandValue('fontSize');
    sizeInput.value = sizeMap[currentSize] || 12;

    const foreColor = document.queryCommandValue('foreColor');
    const hex = rgbToHex(foreColor);
    colorInput.value = hex || '#000000';

    function updatePreview() {
      preview.style.fontFamily = familySelect.value;
      preview.style.fontSize = sizeInput.value + 'pt';
      preview.style.fontWeight = boldCheck.checked ? 'bold' : 'normal';
      preview.style.fontStyle = italicCheck.checked ? 'italic' : 'normal';
      preview.style.textDecoration =
        (underlineCheck.checked ? 'underline ' : '') +
        (strikeCheck.checked ? 'line-through' : '') || 'none';
      preview.style.color = colorInput.value;
    }

    updatePreview();
    familySelect.addEventListener('change', updatePreview);
    sizeInput.addEventListener('input', updatePreview);
    boldCheck.addEventListener('change', updatePreview);
    italicCheck.addEventListener('change', updatePreview);
    underlineCheck.addEventListener('change', updatePreview);
    strikeCheck.addEventListener('change', updatePreview);
    colorInput.addEventListener('input', updatePreview);

    const overlay = document.getElementById('dlg-font');
    overlay.classList.add('visible');

    awaitDialogResult(overlay, (result) => {
      familySelect.removeEventListener('change', updatePreview);
      sizeInput.removeEventListener('input', updatePreview);
      boldCheck.removeEventListener('change', updatePreview);
      italicCheck.removeEventListener('change', updatePreview);
      underlineCheck.removeEventListener('change', updatePreview);
      strikeCheck.removeEventListener('change', updatePreview);
      colorInput.removeEventListener('input', updatePreview);

      if (result !== 'ok')
        return;

      document.execCommand('fontName', false, familySelect.value);

      let ptSize = parseInt(sizeInput.value, 10);
      if (isNaN(ptSize) || ptSize < 8) ptSize = 8;
      if (ptSize > 72) ptSize = 72;

      const ptValues = [8, 10, 12, 14, 18, 24, 36];
      let closest = 3;
      let minDiff = 999;
      for (let i = 0; i < ptValues.length; ++i) {
        const diff = Math.abs(ptValues[i] - ptSize);
        if (diff < minDiff) {
          minDiff = diff;
          closest = i + 1;
        }
      }
      document.execCommand('fontSize', false, String(closest));

      if (document.queryCommandState('bold') !== boldCheck.checked)
        document.execCommand('bold');
      if (document.queryCommandState('italic') !== italicCheck.checked)
        document.execCommand('italic');
      if (document.queryCommandState('underline') !== underlineCheck.checked)
        document.execCommand('underline');
      if (document.queryCommandState('strikeThrough') !== strikeCheck.checked)
        document.execCommand('strikeThrough');

      document.execCommand('foreColor', false, colorInput.value);

      editor.focus();
      updateToolbarState();
    });
  }

  // -----------------------------------------------------------------------
  // Paragraph dialog
  // -----------------------------------------------------------------------
  function showParagraphDialog() {
    const alignSelect = document.getElementById('dlg-para-align');

    if (document.queryCommandState('justifyCenter'))
      alignSelect.value = 'justifyCenter';
    else if (document.queryCommandState('justifyRight'))
      alignSelect.value = 'justifyRight';
    else if (document.queryCommandState('justifyFull'))
      alignSelect.value = 'justifyFull';
    else
      alignSelect.value = 'justifyLeft';

    const overlay = document.getElementById('dlg-paragraph');
    overlay.classList.add('visible');

    awaitDialogResult(overlay, (result) => {
      if (result !== 'ok')
        return;
      document.execCommand(alignSelect.value, false, null);
      editor.focus();
      updateToolbarState();
    });
  }

  // -----------------------------------------------------------------------
  // Find panel
  // -----------------------------------------------------------------------
  const findPanel = document.getElementById('find-panel');
  const fpFindInput = document.getElementById('fp-find-input');
  const fpStatus = document.getElementById('fp-status');

  function showFind() {
    findPanel.classList.add('visible');
    fpFindInput.focus();
    fpFindInput.select();
    fpStatus.textContent = '';
  }

  function closeFind() {
    findPanel.classList.remove('visible');
    editor.focus();
  }

  document.getElementById('fp-close').addEventListener('click', closeFind);

  function findNext() {
    const needle = fpFindInput.value;
    if (!needle) {
      fpStatus.textContent = '';
      return;
    }

    const found = window.find(needle, false, false, true, false, false, false);
    if (!found) {
      const sel = window.getSelection();
      sel.collapse(editor, 0);
      const foundAgain = window.find(needle, false, false, true, false, false, false);
      if (!foundAgain)
        fpStatus.textContent = 'No matches found.';
      else
        fpStatus.textContent = 'Wrapped to beginning.';
    } else
      fpStatus.textContent = '';
  }

  document.getElementById('fp-find-next').addEventListener('click', findNext);

  fpFindInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      findNext();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFind();
    }
  });

  fpFindInput.addEventListener('input', () => {
    fpStatus.textContent = '';
  });

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------
  const statusWords = document.getElementById('status-words');
  const statusChars = document.getElementById('status-chars');

  function updateStatusBar() {
    const text = editor.innerText || '';
    const trimmed = text.trim();
    const charCount = trimmed.length;
    const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
    statusWords.textContent = 'Words: ' + wordCount;
    statusChars.textContent = 'Characters: ' + charCount;
  }

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
      case 'f':
        e.preventDefault();
        handleAction('find');
        break;
      case 'a':
        break;
    }
  });

  // -----------------------------------------------------------------------
  // Paste: clean up pasted content
  // -----------------------------------------------------------------------
  editor.addEventListener('paste', () => {
    setTimeout(() => {
      markDirty();
      updateStatusBar();
      updateToolbarState();
    }, 0);
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
    updateToolbarState();
  }
  editor.focus();
})();
