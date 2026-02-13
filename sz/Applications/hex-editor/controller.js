;(function() {
  'use strict';

  const { User32, Kernel32, Shell32, ComDlg32 } = SZ.Dlls;

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const ROW_HEIGHT = 18;
  const OVERSCAN = 5;
  const HEX_CHARS = '0123456789abcdef';

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let data = new Uint8Array(0);
  let originalData = new Uint8Array(0);
  let modified = new Set();
  let cursorOffset = 0;
  let selectionStart = -1;
  let selectionEnd = -1;
  let activeColumn = 'hex';
  let nibbleHigh = true;
  let insertMode = false;
  let bytesPerRow = 16;
  let currentFilePath = null;
  let currentFileName = 'Untitled';
  let dirty = false;

  // Undo/Redo
  const undoStack = [];
  const redoStack = [];
  const MAX_UNDO = 500;

  // Find state
  let findResults = [];
  let findIndex = -1;
  let lastFindQuery = '';
  let lastFindType = 'hex';

  // DOM references
  const menuBar = document.getElementById('menu-bar');
  const hexContainer = document.getElementById('hex-container');
  const hexHeader = document.getElementById('hex-header');
  const hexViewport = document.getElementById('hex-viewport');
  const hexScrollContent = document.getElementById('hex-scroll-content');
  const hexRows = document.getElementById('hex-rows');
  const statusSize = document.getElementById('status-size');
  const statusOffset = document.getElementById('status-offset');
  const statusSelection = document.getElementById('status-selection');
  const statusMode = document.getElementById('status-mode');
  let openMenu = null;

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------
  function toHex8(n) {
    return n.toString(16).padStart(8, '0').toUpperCase();
  }

  function toHex2(n) {
    return n.toString(16).padStart(2, '0').toUpperCase();
  }

  function isPrintable(b) {
    return b >= 0x20 && b <= 0x7e;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - Hex Editor';
    document.title = title;
    User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Undo / Redo
  // -----------------------------------------------------------------------
  function pushUndo(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO)
      undoStack.shift();
    redoStack.length = 0;
  }

  function doUndo() {
    if (undoStack.length === 0)
      return;
    const action = undoStack.pop();
    redoStack.push(action);
    applyUndoAction(action, true);
  }

  function doRedo() {
    if (redoStack.length === 0)
      return;
    const action = redoStack.pop();
    undoStack.push(action);
    applyUndoAction(action, false);
  }

  function applyUndoAction(action, isUndo) {
    if (action.type === 'modify') {
      const { offset, oldValue, newValue } = action;
      data[offset] = isUndo ? oldValue : newValue;
      if (data[offset] === originalData[offset])
        modified.delete(offset);
      else
        modified.add(offset);
    } else if (action.type === 'insert') {
      if (isUndo) {
        const newData = new Uint8Array(data.length - 1);
        newData.set(data.subarray(0, action.offset));
        newData.set(data.subarray(action.offset + 1), action.offset);
        data = newData;
        const newOrig = new Uint8Array(data.length);
        newOrig.set(originalData.subarray(0, Math.min(originalData.length, data.length)));
        originalData = newOrig;
        rebuildModifiedSet();
      } else {
        const newData = new Uint8Array(data.length + 1);
        newData.set(data.subarray(0, action.offset));
        newData[action.offset] = action.value;
        newData.set(data.subarray(action.offset), action.offset + 1);
        data = newData;
        const newOrig = new Uint8Array(data.length);
        newOrig.set(originalData.subarray(0, Math.min(originalData.length, data.length)));
        originalData = newOrig;
        rebuildModifiedSet();
      }
    } else if (action.type === 'delete') {
      if (isUndo) {
        const newData = new Uint8Array(data.length + action.bytes.length);
        newData.set(data.subarray(0, action.offset));
        newData.set(action.bytes, action.offset);
        newData.set(data.subarray(action.offset), action.offset + action.bytes.length);
        data = newData;
        const newOrig = new Uint8Array(data.length);
        newOrig.set(originalData.subarray(0, Math.min(originalData.length, data.length)));
        originalData = newOrig;
        rebuildModifiedSet();
      } else {
        const newData = new Uint8Array(data.length - action.bytes.length);
        newData.set(data.subarray(0, action.offset));
        newData.set(data.subarray(action.offset + action.bytes.length), action.offset);
        data = newData;
        const newOrig = new Uint8Array(data.length);
        newOrig.set(originalData.subarray(0, Math.min(originalData.length, data.length)));
        originalData = newOrig;
        rebuildModifiedSet();
      }
    }
    cursorOffset = clamp(action.offset, 0, Math.max(0, data.length - 1));
    dirty = modified.size > 0 || data.length !== originalData.length;
    updateTitle();
    updateScrollHeight();
    render();
    ensureCursorVisible();
    updateStatusBar();
  }

  function rebuildModifiedSet() {
    modified.clear();
    const len = Math.min(data.length, originalData.length);
    for (let i = 0; i < len; ++i) {
      if (data[i] !== originalData[i])
        modified.add(i);
    }
    for (let i = len; i < data.length; ++i)
      modified.add(i);
  }

  // -----------------------------------------------------------------------
  // Data manipulation
  // -----------------------------------------------------------------------
  function setByte(offset, value) {
    if (offset < 0 || offset >= data.length)
      return;
    const oldValue = data[offset];
    if (oldValue === value)
      return;
    pushUndo({ type: 'modify', offset, oldValue, newValue: value });
    data[offset] = value;
    if (data[offset] === originalData[offset])
      modified.delete(offset);
    else
      modified.add(offset);
    dirty = true;
    updateTitle();
  }

  function insertByte(offset, value) {
    offset = clamp(offset, 0, data.length);
    pushUndo({ type: 'insert', offset, value });
    const newData = new Uint8Array(data.length + 1);
    newData.set(data.subarray(0, offset));
    newData[offset] = value;
    newData.set(data.subarray(offset), offset + 1);
    data = newData;
    const newOrig = new Uint8Array(data.length);
    newOrig.set(originalData.subarray(0, Math.min(originalData.length, data.length)));
    originalData = newOrig;
    rebuildModifiedSet();
    dirty = true;
    updateTitle();
    updateScrollHeight();
  }

  function deleteBytes(offset, count) {
    if (data.length === 0 || count <= 0)
      return;
    offset = clamp(offset, 0, data.length - 1);
    count = Math.min(count, data.length - offset);
    const bytes = data.slice(offset, offset + count);
    pushUndo({ type: 'delete', offset, bytes });
    const newData = new Uint8Array(data.length - count);
    newData.set(data.subarray(0, offset));
    newData.set(data.subarray(offset + count), offset);
    data = newData;
    const newOrig = new Uint8Array(data.length);
    newOrig.set(originalData.subarray(0, Math.min(originalData.length, data.length)));
    originalData = newOrig;
    rebuildModifiedSet();
    dirty = true;
    updateTitle();
    updateScrollHeight();
  }

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------
  function hasSelection() {
    return selectionStart >= 0 && selectionEnd >= 0 && selectionStart !== selectionEnd;
  }

  function getSelectionRange() {
    if (!hasSelection())
      return null;
    const lo = Math.min(selectionStart, selectionEnd);
    const hi = Math.max(selectionStart, selectionEnd);
    return { lo, hi };
  }

  function clearSelection() {
    selectionStart = -1;
    selectionEnd = -1;
  }

  // -----------------------------------------------------------------------
  // Header rendering
  // -----------------------------------------------------------------------
  function renderHeader() {
    const parts = [];
    parts.push('<div class="offset-col" style="width: ' + getOffsetColWidth() + 'px;">Offset</div>');

    let hexParts = [];
    for (let i = 0; i < bytesPerRow; ++i) {
      const cls = (i > 0 && i % 2 === 0) ? 'hex-byte group-space' : 'hex-byte';
      hexParts.push('<span class="' + cls + '">' + toHex2(i) + '</span>');
    }
    parts.push('<div class="hex-col">' + hexParts.join('') + '</div>');
    parts.push('<div class="ascii-sep"></div>');
    parts.push('<div class="ascii-col">ASCII</div>');

    hexHeader.innerHTML = parts.join('');
  }

  function getOffsetColWidth() {
    return 80;
  }

  // -----------------------------------------------------------------------
  // Virtual scrolling + rendering
  // -----------------------------------------------------------------------
  function getTotalRows() {
    if (data.length === 0)
      return 0;
    return Math.ceil(data.length / bytesPerRow);
  }

  function updateScrollHeight() {
    const totalRows = getTotalRows();
    hexScrollContent.style.height = (totalRows * ROW_HEIGHT) + 'px';
  }

  function getVisibleRange() {
    const scrollTop = hexViewport.scrollTop;
    const viewportHeight = hexViewport.clientHeight;
    const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const lastRow = Math.min(getTotalRows() - 1, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
    return { firstRow, lastRow };
  }

  function render() {
    if (data.length === 0) {
      hexRows.innerHTML = '<div class="hex-empty">No file loaded. Use File &rarr; Open or Ctrl+O.</div>';
      hexRows.style.top = '0px';
      return;
    }

    const { firstRow, lastRow } = getVisibleRange();
    if (firstRow > lastRow) {
      hexRows.innerHTML = '';
      return;
    }

    const sel = getSelectionRange();
    const fragments = [];

    for (let row = firstRow; row <= lastRow; ++row) {
      const rowStart = row * bytesPerRow;
      const rowEnd = Math.min(rowStart + bytesPerRow, data.length);

      let html = '<div class="hex-row" data-row="' + row + '">';

      html += '<div class="offset-col" style="width: ' + getOffsetColWidth() + 'px;">' + toHex8(rowStart) + '</div>';

      html += '<div class="hex-col' + (activeColumn === 'hex' ? ' active-column' : '') + '">';
      for (let i = 0; i < bytesPerRow; ++i) {
        const offset = rowStart + i;
        if (offset < rowEnd) {
          let cls = (i > 0 && i % 2 === 0) ? 'hex-byte group-space' : 'hex-byte';
          if (offset === cursorOffset)
            cls += ' cursor';
          if (modified.has(offset))
            cls += ' modified';
          if (sel && offset >= sel.lo && offset < sel.hi && offset !== cursorOffset)
            cls += ' selected';
          if (isInFindResult(offset))
            cls += ' found';
          html += '<span class="' + cls + '" data-offset="' + offset + '">' + toHex2(data[offset]) + '</span>';
        } else {
          const cls = (i > 0 && i % 2 === 0) ? 'hex-byte group-space' : 'hex-byte';
          html += '<span class="' + cls + '">  </span>';
        }
      }
      html += '</div>';

      html += '<div class="ascii-sep"></div>';

      html += '<div class="ascii-col' + (activeColumn === 'ascii' ? ' active-column' : '') + '">';
      for (let i = 0; i < bytesPerRow; ++i) {
        const offset = rowStart + i;
        if (offset < rowEnd) {
          const b = data[offset];
          const ch = isPrintable(b) ? String.fromCharCode(b) : '.';
          let cls = 'ascii-byte';
          if (!isPrintable(b))
            cls += ' non-printable';
          if (offset === cursorOffset)
            cls += ' cursor';
          if (modified.has(offset))
            cls += ' modified';
          if (sel && offset >= sel.lo && offset < sel.hi && offset !== cursorOffset)
            cls += ' selected';
          if (isInFindResult(offset))
            cls += ' found';
          const escaped = ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch === '"' ? '&quot;' : ch;
          html += '<span class="' + cls + '" data-offset="' + offset + '">' + escaped + '</span>';
        }
      }
      html += '</div>';

      html += '</div>';
      fragments.push(html);
    }

    hexRows.innerHTML = fragments.join('');
    hexRows.style.top = (firstRow * ROW_HEIGHT) + 'px';
  }

  function isInFindResult(offset) {
    if (findResults.length === 0 || findIndex < 0)
      return false;
    const matchStart = findResults[findIndex];
    const matchLen = lastFindType === 'text' ? lastFindQuery.length : parseHexPattern(lastFindQuery).length;
    return offset >= matchStart && offset < matchStart + matchLen;
  }

  // -----------------------------------------------------------------------
  // Cursor navigation
  // -----------------------------------------------------------------------
  function ensureCursorVisible() {
    const row = Math.floor(cursorOffset / bytesPerRow);
    const rowTop = row * ROW_HEIGHT;
    const rowBot = rowTop + ROW_HEIGHT;
    const viewTop = hexViewport.scrollTop;
    const viewBot = viewTop + hexViewport.clientHeight;

    if (rowTop < viewTop)
      hexViewport.scrollTop = rowTop;
    else if (rowBot > viewBot)
      hexViewport.scrollTop = rowBot - hexViewport.clientHeight;
  }

  function moveCursor(newOffset, extend) {
    newOffset = clamp(newOffset, 0, Math.max(0, data.length - 1));
    if (extend) {
      if (selectionStart < 0)
        selectionStart = cursorOffset;
      selectionEnd = newOffset + 1;
    } else
      clearSelection();

    cursorOffset = newOffset;
    nibbleHigh = true;
    ensureCursorVisible();
    render();
    updateStatusBar();
  }

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------
  function updateStatusBar() {
    statusSize.textContent = 'Size: ' + data.length.toLocaleString() + ' bytes';
    statusOffset.textContent = 'Offset: ' + toHex8(cursorOffset) + ' (' + cursorOffset + ')';
    statusMode.textContent = insertMode ? 'INS' : 'OVR';

    const sel = getSelectionRange();
    if (sel)
      statusSelection.textContent = 'Selected: ' + (sel.hi - sel.lo) + ' bytes';
    else
      statusSelection.textContent = '';
  }

  // -----------------------------------------------------------------------
  // Click handling
  // -----------------------------------------------------------------------
  hexViewport.addEventListener('pointerdown', (e) => {
    const target = e.target;

    const hexByte = target.closest('.hex-byte[data-offset]');
    if (hexByte) {
      const offset = parseInt(hexByte.dataset.offset, 10);
      activeColumn = 'hex';
      if (e.shiftKey) {
        if (selectionStart < 0)
          selectionStart = cursorOffset;
        selectionEnd = offset + 1;
        cursorOffset = offset;
      } else {
        clearSelection();
        selectionStart = offset;
        cursorOffset = offset;
      }
      nibbleHigh = true;
      hexViewport.focus();
      render();
      updateStatusBar();
      return;
    }

    const asciiByte = target.closest('.ascii-byte[data-offset]');
    if (asciiByte) {
      const offset = parseInt(asciiByte.dataset.offset, 10);
      activeColumn = 'ascii';
      if (e.shiftKey) {
        if (selectionStart < 0)
          selectionStart = cursorOffset;
        selectionEnd = offset + 1;
        cursorOffset = offset;
      } else {
        clearSelection();
        selectionStart = offset;
        cursorOffset = offset;
      }
      nibbleHigh = true;
      hexViewport.focus();
      render();
      updateStatusBar();
      return;
    }

    hexViewport.focus();
  });

  hexViewport.addEventListener('pointermove', (e) => {
    if (!(e.buttons & 1))
      return;
    const target = e.target;
    const byteEl = target.closest('[data-offset]');
    if (!byteEl)
      return;
    const offset = parseInt(byteEl.dataset.offset, 10);
    if (selectionStart >= 0) {
      selectionEnd = offset + 1;
      cursorOffset = offset;
      render();
      updateStatusBar();
    }
  });

  // -----------------------------------------------------------------------
  // Keyboard input
  // -----------------------------------------------------------------------
  hexViewport.addEventListener('keydown', (e) => {
    if (data.length === 0 && !e.ctrlKey)
      return;

    const maxOffset = Math.max(0, data.length - 1);
    const pageSize = Math.floor(hexViewport.clientHeight / ROW_HEIGHT) * bytesPerRow;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        moveCursor(cursorOffset - 1, e.shiftKey);
        return;
      case 'ArrowRight':
        e.preventDefault();
        moveCursor(cursorOffset + 1, e.shiftKey);
        return;
      case 'ArrowUp':
        e.preventDefault();
        moveCursor(cursorOffset - bytesPerRow, e.shiftKey);
        return;
      case 'ArrowDown':
        e.preventDefault();
        moveCursor(cursorOffset + bytesPerRow, e.shiftKey);
        return;
      case 'PageUp':
        e.preventDefault();
        moveCursor(cursorOffset - pageSize, e.shiftKey);
        return;
      case 'PageDown':
        e.preventDefault();
        moveCursor(cursorOffset + pageSize, e.shiftKey);
        return;
      case 'Home':
        e.preventDefault();
        if (e.ctrlKey)
          moveCursor(0, e.shiftKey);
        else
          moveCursor(cursorOffset - (cursorOffset % bytesPerRow), e.shiftKey);
        return;
      case 'End':
        e.preventDefault();
        if (e.ctrlKey)
          moveCursor(maxOffset, e.shiftKey);
        else
          moveCursor(cursorOffset - (cursorOffset % bytesPerRow) + bytesPerRow - 1, e.shiftKey);
        return;
      case 'Insert':
        e.preventDefault();
        insertMode = !insertMode;
        updateStatusBar();
        return;
      case 'Delete':
        e.preventDefault();
        if (hasSelection()) {
          const sel = getSelectionRange();
          deleteBytes(sel.lo, sel.hi - sel.lo);
          cursorOffset = clamp(sel.lo, 0, Math.max(0, data.length - 1));
          clearSelection();
        } else if (data.length > 0)
          deleteBytes(cursorOffset, 1);
        cursorOffset = clamp(cursorOffset, 0, Math.max(0, data.length - 1));
        render();
        updateStatusBar();
        return;
      case 'Backspace':
        e.preventDefault();
        if (hasSelection()) {
          const sel = getSelectionRange();
          deleteBytes(sel.lo, sel.hi - sel.lo);
          cursorOffset = clamp(sel.lo, 0, Math.max(0, data.length - 1));
          clearSelection();
        } else if (cursorOffset > 0) {
          deleteBytes(cursorOffset - 1, 1);
          --cursorOffset;
        }
        cursorOffset = clamp(cursorOffset, 0, Math.max(0, data.length - 1));
        render();
        updateStatusBar();
        return;
      case 'Tab':
        e.preventDefault();
        activeColumn = activeColumn === 'hex' ? 'ascii' : 'hex';
        nibbleHigh = true;
        render();
        return;
      case 'F3':
        e.preventDefault();
        if (e.shiftKey)
          findPrevious();
        else
          findNextResult();
        return;
    }

    if (activeColumn === 'hex' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const ch = e.key.toLowerCase();
      if (HEX_CHARS.includes(ch) && ch.length === 1) {
        e.preventDefault();
        typeHexNibble(parseInt(ch, 16));
        return;
      }
    }

    if (activeColumn === 'ascii' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key.length === 1 && e.key.charCodeAt(0) >= 0x20 && e.key.charCodeAt(0) <= 0x7e) {
        e.preventDefault();
        typeAsciiChar(e.key.charCodeAt(0));
        return;
      }
    }
  });

  function typeHexNibble(nibbleValue) {
    if (data.length === 0) {
      insertByte(0, nibbleValue << 4);
      cursorOffset = 0;
      nibbleHigh = false;
      render();
      updateStatusBar();
      return;
    }

    if (insertMode && nibbleHigh) {
      insertByte(cursorOffset, nibbleValue << 4);
      nibbleHigh = false;
      render();
      updateStatusBar();
      return;
    }

    if (nibbleHigh) {
      const old = data[cursorOffset];
      const newVal = (nibbleValue << 4) | (old & 0x0f);
      setByte(cursorOffset, newVal);
      nibbleHigh = false;
    } else {
      const old = data[cursorOffset];
      const newVal = (old & 0xf0) | nibbleValue;
      setByte(cursorOffset, newVal);
      nibbleHigh = true;
      if (cursorOffset < data.length - 1)
        ++cursorOffset;
    }
    clearSelection();
    render();
    updateStatusBar();
  }

  function typeAsciiChar(charCode) {
    if (data.length === 0) {
      insertByte(0, charCode);
      cursorOffset = 0;
      render();
      updateStatusBar();
      return;
    }

    if (insertMode) {
      insertByte(cursorOffset, charCode);
      ++cursorOffset;
      cursorOffset = clamp(cursorOffset, 0, data.length - 1);
    } else {
      setByte(cursorOffset, charCode);
      if (cursorOffset < data.length - 1)
        ++cursorOffset;
    }
    nibbleHigh = true;
    clearSelection();
    render();
    updateStatusBar();
  }

  // -----------------------------------------------------------------------
  // Scroll handling
  // -----------------------------------------------------------------------
  hexViewport.addEventListener('scroll', () => {
    render();
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

  for (const entry of document.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.action;
      closeMenus();
      handleAction(action, entry);
    });
  }

  function updateBprRadios() {
    for (const entry of document.querySelectorAll('.menu-entry[data-bpr]')) {
      const bpr = parseInt(entry.dataset.bpr, 10);
      entry.classList.toggle('checked', bpr === bytesPerRow);
    }
  }
  updateBprRadios();

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
        doUndo();
        break;
      case 'redo':
        doRedo();
        break;
      case 'cut':
        doCut();
        break;
      case 'copy':
        doCopy();
        break;
      case 'paste':
        doPaste();
        break;
      case 'select-all':
        if (data.length > 0) {
          selectionStart = 0;
          selectionEnd = data.length;
          cursorOffset = 0;
          render();
          updateStatusBar();
        }
        hexViewport.focus();
        break;
      case 'goto':
        showGotoDialog();
        break;
      case 'find':
        showFindDialog();
        break;
      case 'bpr-8':
      case 'bpr-16':
      case 'bpr-32': {
        const bpr = parseInt(entry.dataset.bpr, 10);
        bytesPerRow = bpr;
        updateBprRadios();
        renderHeader();
        updateScrollHeight();
        render();
        ensureCursorVisible();
        hexViewport.focus();
        break;
      }
      case 'about':
        showDialog('dlg-about');
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Clipboard
  // -----------------------------------------------------------------------
  function doCut() {
    if (!hasSelection())
      return;
    doCopy();
    const sel = getSelectionRange();
    deleteBytes(sel.lo, sel.hi - sel.lo);
    cursorOffset = clamp(sel.lo, 0, Math.max(0, data.length - 1));
    clearSelection();
    render();
    updateStatusBar();
  }

  function doCopy() {
    const sel = getSelectionRange();
    if (!sel)
      return;
    const bytes = data.slice(sel.lo, sel.hi);
    const hexStr = Array.from(bytes).map(b => toHex2(b)).join(' ');
    navigator.clipboard.writeText(hexStr).catch(() => {});
  }

  function doPaste() {
    navigator.clipboard.readText().then(text => {
      if (!text)
        return;
      const hexPattern = /^[\s,]*([0-9a-fA-F]{2}[\s,]*)+$/;
      let bytes;
      if (hexPattern.test(text.trim())) {
        const hexParts = text.trim().split(/[\s,]+/).filter(s => s.length > 0);
        bytes = new Uint8Array(hexParts.map(h => parseInt(h, 16)));
      } else {
        bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; ++i)
          bytes[i] = text.charCodeAt(i) & 0xff;
      }

      if (bytes.length === 0)
        return;

      if (hasSelection()) {
        const sel = getSelectionRange();
        deleteBytes(sel.lo, sel.hi - sel.lo);
        cursorOffset = sel.lo;
        clearSelection();
      }

      for (let i = 0; i < bytes.length; ++i)
        insertByte(cursorOffset + i, bytes[i]);

      cursorOffset = clamp(cursorOffset + bytes.length, 0, Math.max(0, data.length - 1));
      render();
      ensureCursorVisible();
      updateStatusBar();
    }).catch(() => {});
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
  function doNew() {
    data = new Uint8Array(0);
    originalData = new Uint8Array(0);
    modified.clear();
    cursorOffset = 0;
    clearSelection();
    undoStack.length = 0;
    redoStack.length = 0;
    findResults = [];
    findIndex = -1;
    currentFilePath = null;
    currentFileName = 'Untitled';
    dirty = false;
    nibbleHigh = true;
    updateTitle();
    updateScrollHeight();
    render();
    updateStatusBar();
    hexViewport.focus();
  }

  function doOpen() {
    showOpenDialog();
  }

  async function showOpenDialog() {
    const result = await ComDlg32.GetOpenFileName({
      filters: [
        { name: 'All Files', ext: ['*'] },
        { name: 'Binary Files', ext: ['bin', 'dat', 'exe', 'dll', 'rom'] }
      ],
      initialDir: '/user/documents',
      title: 'Open',
    });
    if (!result.cancelled && result.path) {
      try {
        const bytes = await Kernel32.ReadAllBytes(result.path);
        loadFile(result.path, bytes);
      } catch (err) {
        alert('Could not open file: ' + err.message);
      }
    }
  }

  function loadFile(path, content) {
    let bytes;
    if (content == null)
      bytes = new Uint8Array(0);
    else if (typeof content === 'string') {
      try {
        const binary = atob(content);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; ++i)
          bytes[i] = binary.charCodeAt(i);
      } catch (_) {
        bytes = new Uint8Array(content.length);
        for (let i = 0; i < content.length; ++i)
          bytes[i] = content.charCodeAt(i) & 0xff;
      }
    } else if (content instanceof ArrayBuffer)
      bytes = new Uint8Array(content);
    else if (content instanceof Uint8Array)
      bytes = content;
    else
      bytes = new Uint8Array(0);

    data = bytes;
    originalData = new Uint8Array(data);
    modified.clear();
    cursorOffset = 0;
    clearSelection();
    undoStack.length = 0;
    redoStack.length = 0;
    findResults = [];
    findIndex = -1;
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    nibbleHigh = true;
    updateTitle();
    updateScrollHeight();
    render();
    updateStatusBar();
    hexViewport.focus();
  }

  function doSave(callback) {
    if (!currentFilePath) {
      doSaveAs(callback);
      return;
    }
    saveToPath(currentFilePath, callback);
  }

  async function doSaveAs(callback) {
    const base64 = uint8ArrayToBase64(data);
    const dataUrl = 'data:application/octet-stream;base64,' + base64;
    const result = await ComDlg32.GetSaveFileName({
      filters: [
        { name: 'All Files', ext: ['*'] },
        { name: 'Binary Files', ext: ['bin', 'dat'] }
      ],
      initialDir: '/user/documents',
      defaultName: currentFileName || 'Untitled.bin',
      title: 'Save As',
      content: dataUrl,
    });
    if (!result.cancelled && result.path) {
      originalData = new Uint8Array(data);
      modified.clear();
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';
      dirty = false;
      updateTitle();
      render();
      if (typeof callback === 'function')
        callback();
    }
  }

  async function saveToPath(path, callback) {
    try {
      await Kernel32.WriteAllBytes(path, data);
    } catch (err) {
      alert('Could not save file: ' + err.message);
      return;
    }
    originalData = new Uint8Array(data);
    modified.clear();
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'Untitled';
    dirty = false;
    updateTitle();
    render();
    if (typeof callback === 'function')
      callback();
  }

  function uint8ArrayToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; ++i)
      binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function doExit() {
    User32.DestroyWindow();
  }

  // -----------------------------------------------------------------------
  // Goto Address dialog
  // -----------------------------------------------------------------------
  function showGotoDialog() {
    const overlay = document.getElementById('dlg-goto');
    const input = document.getElementById('goto-input');
    input.value = toHex8(cursorOffset);
    overlay.classList.add('visible');
    input.focus();
    input.select();

    function handleKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doGoto();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeGoto();
      }
    }

    function doGoto() {
      const val = parseInt(input.value.replace(/\s/g, ''), 16);
      if (!isNaN(val) && val >= 0 && val < data.length) {
        cursorOffset = val;
        clearSelection();
        nibbleHigh = true;
        ensureCursorVisible();
        render();
        updateStatusBar();
      }
      closeGoto();
    }

    function closeGoto() {
      overlay.classList.remove('visible');
      input.removeEventListener('keydown', handleKey);
      hexViewport.focus();
    }

    input.addEventListener('keydown', handleKey);

    awaitDialogResult(overlay, (result) => {
      if (result === 'ok')
        doGoto();
      else
        closeGoto();
    });
  }

  // -----------------------------------------------------------------------
  // Find dialog
  // -----------------------------------------------------------------------
  function showFindDialog() {
    const overlay = document.getElementById('dlg-find');
    const input = document.getElementById('find-input');
    const statusEl = document.getElementById('find-status');
    input.value = lastFindQuery;
    statusEl.textContent = '';
    overlay.classList.add('visible');
    input.focus();
    input.select();

    function handleKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doFind('next');
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFind();
      }
    }

    function closeFind() {
      overlay.classList.remove('visible');
      input.removeEventListener('keydown', handleKey);
      hexViewport.focus();
    }

    input.addEventListener('keydown', handleKey);

    awaitDialogResult(overlay, (result) => {
      if (result === 'next' || result === 'prev') {
        const findType = document.querySelector('input[name="find-type"]:checked').value;
        lastFindQuery = input.value;
        lastFindType = findType;
        performFind(input.value, findType);
        if (findResults.length === 0) {
          statusEl.textContent = 'No matches found.';
        } else {
          if (result === 'next')
            findNextResult();
          else
            findPrevious();
          statusEl.textContent = 'Found ' + findResults.length + ' match' + (findResults.length !== 1 ? 'es' : '') + '.';
        }
        overlay.classList.add('visible');
        awaitDialogResult(overlay, arguments.callee);
      } else
        closeFind();
    });
  }

  function parseHexPattern(str) {
    const parts = str.trim().split(/[\s,]+/).filter(s => s.length > 0);
    const bytes = [];
    for (const part of parts) {
      for (let i = 0; i < part.length; i += 2) {
        const hex = part.substring(i, i + 2);
        const val = parseInt(hex, 16);
        if (isNaN(val))
          return [];
        bytes.push(val);
      }
    }
    return bytes;
  }

  function performFind(query, type) {
    findResults = [];
    findIndex = -1;
    if (!query || data.length === 0)
      return;

    let pattern;
    if (type === 'hex') {
      pattern = parseHexPattern(query);
      if (pattern.length === 0)
        return;
    } else {
      pattern = [];
      for (let i = 0; i < query.length; ++i)
        pattern.push(query.charCodeAt(i) & 0xff);
    }

    for (let i = 0; i <= data.length - pattern.length; ++i) {
      let match = true;
      for (let j = 0; j < pattern.length; ++j) {
        if (data[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match)
        findResults.push(i);
    }
  }

  function findNextResult() {
    if (findResults.length === 0) {
      if (lastFindQuery)
        performFind(lastFindQuery, lastFindType);
      if (findResults.length === 0)
        return;
    }

    let nextIdx = -1;
    for (let i = 0; i < findResults.length; ++i) {
      if (findResults[i] > cursorOffset) {
        nextIdx = i;
        break;
      }
    }
    if (nextIdx === -1)
      nextIdx = 0;

    findIndex = nextIdx;
    cursorOffset = findResults[findIndex];
    clearSelection();
    nibbleHigh = true;
    ensureCursorVisible();
    render();
    updateStatusBar();
  }

  function findPrevious() {
    if (findResults.length === 0) {
      if (lastFindQuery)
        performFind(lastFindQuery, lastFindType);
      if (findResults.length === 0)
        return;
    }

    let prevIdx = -1;
    for (let i = findResults.length - 1; i >= 0; --i) {
      if (findResults[i] < cursorOffset) {
        prevIdx = i;
        break;
      }
    }
    if (prevIdx === -1)
      prevIdx = findResults.length - 1;

    findIndex = prevIdx;
    cursorOffset = findResults[findIndex];
    clearSelection();
    nibbleHigh = true;
    ensureCursorVisible();
    render();
    updateStatusBar();
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
      const result = btn.dataset.result;
      overlay.removeEventListener('click', handleClick);
      if (typeof callback === 'function')
        callback(result);
      else
        overlay.classList.remove('visible');
    }
    overlay.addEventListener('click', handleClick);
  }

  // -----------------------------------------------------------------------
  // Keyboard shortcuts (global)
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey)
        findPrevious();
      else
        findNextResult();
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
        doUndo();
        break;
      case 'y':
        e.preventDefault();
        doRedo();
        break;
      case 'g':
        e.preventDefault();
        handleAction('goto');
        break;
      case 'f':
        e.preventDefault();
        handleAction('find');
        break;
      case 'a':
        e.preventDefault();
        handleAction('select-all');
        break;
      case 'x':
        e.preventDefault();
        doCut();
        break;
      case 'c':
        e.preventDefault();
        doCopy();
        break;
      case 'v':
        e.preventDefault();
        doPaste();
        break;
    }
  });

  // -----------------------------------------------------------------------
  // Resize observer
  // -----------------------------------------------------------------------
  const resizeObserver = new ResizeObserver(() => {
    render();
  });
  resizeObserver.observe(hexViewport);

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
      data = new Uint8Array(reader.result);
      originalData = new Uint8Array(data);
      modified.clear();
      cursorOffset = 0;
      clearSelection();
      undoStack.length = 0;
      redoStack.length = 0;
      findResults = [];
      findIndex = -1;
      currentFilePath = null;
      currentFileName = file.name;
      dirty = false;
      nibbleHigh = true;
      updateTitle();
      updateScrollHeight();
      render();
      updateStatusBar();
      hexViewport.focus();
    };
    reader.readAsArrayBuffer(file);
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  renderHeader();
  updateScrollHeight();
  render();
  updateStatusBar();
  hexViewport.focus();

  // Check command line for file path
  const cmdLine = Kernel32.GetCommandLine();
  if (cmdLine.path) {
    Kernel32.ReadAllBytes(cmdLine.path).then(content => {
      loadFile(cmdLine.path, content);
    }).catch(() => {});
  } else
    updateTitle();

})();
