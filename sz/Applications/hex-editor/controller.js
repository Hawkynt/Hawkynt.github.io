;(function() {
  'use strict';

  const { User32, Kernel32, Shell32, ComDlg32 } = SZ.Dlls;
  const HexEngine = SZ.StructEngine;

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const ROW_HEIGHT = 18;
  const OVERSCAN = 5;
  const HEX_CHARS = '0123456789abcdef';

  // 16 pastel colors for struct field colorization
  const FIELD_COLORS = [
    '#FFD6D6', '#FFE8CC', '#FFFACD', '#D6FFD6',
    '#D6F5FF', '#D6D6FF', '#F0D6FF', '#FFD6F0',
    '#FFE0B2', '#C8E6C9', '#B3E5FC', '#D1C4E9',
    '#F8BBD0', '#DCEDC8', '#B2EBF2', '#E1BEE7',
  ];

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
  let bprMode = 'auto';
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

  // Struct template state
  let appliedTemplates = [];
  let fieldMap = new Map();

  // -----------------------------------------------------------------------
  // DOM references
  // -----------------------------------------------------------------------
  const hexMain = document.getElementById('hex-main');
  const hexContainer = document.getElementById('hex-container');
  const hexHeader = document.getElementById('hex-header');
  const hexViewport = document.getElementById('hex-viewport');
  const hexScrollContent = document.getElementById('hex-scroll-content');
  const hexRows = document.getElementById('hex-rows');
  const statusSize = document.getElementById('status-size');
  const statusOffset = document.getElementById('status-offset');
  const statusSelection = document.getElementById('status-selection');
  const statusMode = document.getElementById('status-mode');
  const structPanel = document.getElementById('struct-panel');
  const structTree = document.getElementById('struct-tree');
  const dataInspector = document.getElementById('data-inspector');
  const inspectorEndian = document.getElementById('inspector-endian');
  const templateSelect = document.getElementById('template-select');
  const chkStructPanel = document.getElementById('chk-struct-panel');

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
  // Auto bytes-per-row calculation
  // -----------------------------------------------------------------------
  function calculateAutoBpr() {
    const available = hexViewport.clientWidth - getOffsetColWidth() - 1 - 24 - 17;
    // Each byte needs: 22px hex + ~3px avg group space + 8px ascii = ~33px
    const byteCost = 33;
    let bpr = Math.floor(available / byteCost);
    bpr = bpr & ~7; // round down to multiple of 8
    return Math.max(8, Math.min(64, bpr));
  }

  function applyBprMode() {
    if (bprMode === 'auto') {
      const newBpr = calculateAutoBpr();
      if (newBpr !== bytesPerRow) {
        bytesPerRow = newBpr;
        renderHeader();
        updateScrollHeight();
        render();
        ensureCursorVisible();
      }
    }
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
    reEvaluateTemplates();
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

          // Struct field coloring
          let style = '';
          const fieldEntries = fieldMap.get(offset);
          if (fieldEntries && fieldEntries.length > 0) {
            cls += ' struct-field';
            if (fieldEntries.length === 1)
              style = ' style="background:' + fieldEntries[0].color + '"';
            else {
              const colors = fieldEntries.map(e => e.color);
              const pct = 100 / colors.length;
              const stops = colors.map((c, idx) => c + ' ' + (idx * pct) + '%,' + c + ' ' + ((idx + 1) * pct) + '%').join(',');
              style = ' style="background:linear-gradient(135deg,' + stops + ')"';
            }
          }

          html += '<span class="' + cls + '" data-offset="' + offset + '"' + style + '>' + toHex2(data[offset]) + '</span>';
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
    renderDataInspector();
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

    // Ctrl+click: rebase existing templates or apply new one
    if (e.ctrlKey && !e.shiftKey) {
      const byteEl = target.closest('[data-offset]');
      if (byteEl) {
        const offset = parseInt(byteEl.dataset.offset, 10);
        if (appliedTemplates.length > 0) {
          for (const entry of appliedTemplates) {
            entry.baseOffset = offset;
            entry.result = entry.template.evaluate(data, offset);
          }
          rebuildFieldMap();
          renderStructPanel();
          render();
          e.preventDefault();
          return;
        }
        if (templateSelect.value) {
          applyTemplate(templateSelect.value, offset);
          e.preventDefault();
          return;
        }
      }
    }

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
      renderDataInspector();
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
      renderDataInspector();
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
        reEvaluateTemplates();
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
        reEvaluateTemplates();
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
      reEvaluateTemplates();
      render();
      updateStatusBar();
      return;
    }

    if (insertMode && nibbleHigh) {
      insertByte(cursorOffset, nibbleValue << 4);
      nibbleHigh = false;
      reEvaluateTemplates();
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
    reEvaluateTemplates();
    render();
    updateStatusBar();
  }

  function typeAsciiChar(charCode) {
    if (data.length === 0) {
      insertByte(0, charCode);
      cursorOffset = 0;
      reEvaluateTemplates();
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
    reEvaluateTemplates();
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
  // Ribbon system
  // -----------------------------------------------------------------------
  const ribbon = new SZ.Ribbon({ onAction: handleAction });

  // BPR radio buttons
  function updateBprRadios() {
    for (const radio of document.querySelectorAll('input[name="bpr"]'))
      radio.checked = radio.value === bprMode;
  }

  for (const radio of document.querySelectorAll('input[name="bpr"]')) {
    radio.addEventListener('change', () => {
      if (!radio.checked)
        return;
      bprMode = radio.value;
      if (bprMode === 'auto')
        applyBprMode();
      else {
        bytesPerRow = parseInt(bprMode, 10);
        renderHeader();
        updateScrollHeight();
        render();
        ensureCursorVisible();
      }
      hexViewport.focus();
    });
  }

  // Struct panel toggle
  chkStructPanel.addEventListener('change', () => {
    toggleStructPanel(chkStructPanel.checked);
  });

  document.getElementById('struct-panel-close').addEventListener('click', () => {
    toggleStructPanel(false);
    chkStructPanel.checked = false;
  });

  function toggleStructPanel(show) {
    structPanel.style.display = show ? '' : 'none';
    chkStructPanel.checked = show;
    if (show)
      renderDataInspector();
    // Trigger resize recalculation
    setTimeout(() => applyBprMode(), 0);
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
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
      case 'auto-detect-template':
        doAutoDetectTemplate();
        break;
      case 'apply-template':
        doApplySelectedTemplate();
        break;
      case 'clear-templates':
        appliedTemplates = [];
        rebuildFieldMap();
        renderStructPanel();
        render();
        break;
      case 'import-c-header':
        doImportStruct('c');
        break;
      case 'import-cs-struct':
        doImportStruct('cs');
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Struct template operations
  // -----------------------------------------------------------------------
  function populateTemplateDropdown() {
    const templates = HexEngine.allTemplates();
    templateSelect.innerHTML = '<option value="">(none)</option>';
    for (const tmpl of templates) {
      const opt = document.createElement('option');
      opt.value = tmpl.id;
      opt.textContent = tmpl.label;
      templateSelect.appendChild(opt);
    }
  }

  function applyTemplate(id, baseOffset) {
    const tmpl = HexEngine.getTemplate(id);
    if (!tmpl)
      return;
    const result = tmpl.evaluate(data, baseOffset);
    appliedTemplates.push({ id, label: tmpl.label, template: tmpl, baseOffset, result });
    rebuildFieldMap();
    if (!chkStructPanel.checked)
      toggleStructPanel(true);
    renderStructPanel();
    render();
  }

  function removeTemplate(index) {
    appliedTemplates.splice(index, 1);
    rebuildFieldMap();
    renderStructPanel();
    render();
  }

  function reEvaluateTemplates() {
    for (const entry of appliedTemplates)
      entry.result = entry.template.evaluate(data, entry.baseOffset);
    rebuildFieldMap();
    renderStructPanel();
  }

  function doAutoDetectTemplate() {
    if (data.length === 0)
      return;
    const tmpl = HexEngine.detectTemplate(data, currentFileName);
    if (tmpl) {
      templateSelect.value = tmpl.id;
      applyTemplate(tmpl.id, tmpl.headerOffset);
    }
  }

  function doApplySelectedTemplate() {
    const id = templateSelect.value;
    if (!id)
      return;
    applyTemplate(id, cursorOffset);
  }

  // -----------------------------------------------------------------------
  // Field map + coloring
  // -----------------------------------------------------------------------
  function assignFieldColors(nodes, colorStart) {
    let colorIdx = colorStart;
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        colorIdx = assignFieldColors(node.children, colorIdx);
      } else {
        node._color = FIELD_COLORS[colorIdx % FIELD_COLORS.length];
        ++colorIdx;
      }
    }
    return colorIdx;
  }

  function rebuildFieldMap() {
    fieldMap = new Map();
    let colorStart = 0;
    for (const entry of appliedTemplates) {
      assignFieldColors(entry.result, colorStart);
      _addToFieldMap(entry.result);
      colorStart += 5; // offset palette per template
    }
  }

  function _addToFieldMap(nodes) {
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        _addToFieldMap(node.children);
      } else {
        const color = node._color || '#ddd';
        for (let i = 0; i < node.size; ++i) {
          const byteOff = node.offset + i;
          if (!fieldMap.has(byteOff))
            fieldMap.set(byteOff, []);
          fieldMap.get(byteOff).push({ node, color });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Struct panel rendering
  // -----------------------------------------------------------------------
  function renderStructPanel() {
    if (structPanel.style.display === 'none')
      return;

    if (appliedTemplates.length === 0) {
      structTree.innerHTML = '<div class="struct-panel-empty">No templates applied.<br>Use Templates tab to apply a format.</div>';
      return;
    }

    let html = '';
    for (let ti = 0; ti < appliedTemplates.length; ++ti) {
      const entry = appliedTemplates[ti];
      html += '<div class="struct-template-section" data-tmpl-idx="' + ti + '">';
      html += '<div class="struct-template-header">';
      html += '<span class="struct-tmpl-label">' + _escHtml(entry.label) + '</span>';
      html += '<span class="struct-tmpl-offset">@ 0x' + toHex8(entry.baseOffset) + '</span>';
      html += '<button class="struct-tmpl-remove" data-remove-tmpl="' + ti + '" title="Remove">&times;</button>';
      html += '</div>';
      html += _renderNodes(entry.result, ti);
      html += '</div>';
    }

    structTree.innerHTML = html;
    _wireStructPanelEvents();
  }

  function _renderNodes(nodes, tmplIdx) {
    let html = '';
    for (let ni = 0; ni < nodes.length; ++ni) {
      const node = nodes[ni];
      const hasChildren = node.children && node.children.length > 0;
      const nodeId = tmplIdx + '-' + node.offset + '-' + ni;

      html += '<div class="struct-node" data-node-id="' + nodeId + '">';
      html += '<div class="struct-node-row" data-offset="' + node.offset + '" data-size="' + node.size + '" data-node-id="' + nodeId + '">';

      // Toggle
      if (hasChildren)
        html += '<span class="struct-node-toggle" data-toggle="' + nodeId + '">&#9660;</span>';
      else
        html += '<span class="struct-node-toggle"></span>';

      // Color swatch
      const color = node._color || '';
      if (color)
        html += '<span class="struct-node-swatch" style="background:' + color + '"></span>';
      else
        html += '<span class="struct-node-swatch" style="background:transparent;border-color:transparent"></span>';

      // Name
      html += '<span class="struct-node-name">' + _escHtml(node.field.name) + '</span>';

      // Bitfield indicator
      if (node.bitSize != null)
        html += '<span class="struct-node-bits">[:' + node.bitSize + ']</span>';

      // Type
      html += '<span class="struct-node-type">' + _escHtml(node.field.type) + '</span>';

      // Value
      if (!hasChildren) {
        const display = _formatValue(node);
        html += '<span class="struct-node-value" data-editable="' + nodeId + '">' + _escHtml(display) + '</span>';
      }

      html += '</div>';

      // Children
      if (hasChildren) {
        html += '<div class="struct-node-children" data-children-of="' + nodeId + '">';
        html += _renderNodes(node.children, tmplIdx);
        html += '</div>';
      }

      html += '</div>';
    }
    return html;
  }

  function _formatValue(node) {
    if (node.value == null)
      return '';
    if (node.displayValue != null)
      return node.displayValue + ' (' + node.value + ')';

    // Check for type-level format callback
    const endian = node.field.endian || 'le';
    const resolvedName = HexEngine.resolveType(node.field.type, endian);
    const typeInfo = resolvedName ? HexEngine.TYPES[resolvedName] : null;
    if (typeInfo && typeInfo.format && typeof node.value === 'number')
      return typeInfo.format(node.value);

    const display = node.field.display || 'hex';
    switch (display) {
      case 'hex':
        if (typeof node.value === 'number')
          return '0x' + (node.value >>> 0).toString(16).toUpperCase();
        return String(node.value);
      case 'dec':
        return String(node.value);
      case 'string':
        return '"' + node.value + '"';
      default:
        return String(node.value);
    }
  }

  function _escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _wireStructPanelEvents() {
    // Remove template buttons
    for (const btn of structTree.querySelectorAll('[data-remove-tmpl]'))
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeTemplate(parseInt(btn.dataset.removeTmpl, 10));
      });

    // Toggle expand/collapse
    for (const toggle of structTree.querySelectorAll('[data-toggle]'))
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = toggle.dataset.toggle;
        const children = structTree.querySelector('[data-children-of="' + id + '"]');
        if (children) {
          const collapsed = children.style.display === 'none';
          children.style.display = collapsed ? '' : 'none';
          toggle.innerHTML = collapsed ? '&#9660;' : '&#9654;';
        }
      });

    // Click node to select bytes
    for (const row of structTree.querySelectorAll('.struct-node-row[data-offset]'))
      row.addEventListener('click', () => {
        const offset = parseInt(row.dataset.offset, 10);
        const size = parseInt(row.dataset.size, 10);
        cursorOffset = offset;
        selectionStart = offset;
        selectionEnd = offset + size;
        nibbleHigh = true;
        ensureCursorVisible();
        render();
        updateStatusBar();

        // Highlight active node row
        for (const r of structTree.querySelectorAll('.struct-node-row.active'))
          r.classList.remove('active');
        row.classList.add('active');
      });

    // Double-click value to edit
    for (const val of structTree.querySelectorAll('[data-editable]'))
      val.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        _startInlineEdit(val);
      });
  }

  function _startInlineEdit(valueEl) {
    if (valueEl.querySelector('.struct-node-edit'))
      return;
    const nodeId = valueEl.dataset.editable;
    const node = _findNodeById(nodeId);
    if (!node || node.value == null)
      return;

    const currentText = _formatValue(node);
    const input = document.createElement('input');
    input.className = 'struct-node-edit';
    input.type = 'text';
    input.value = currentText;
    valueEl.textContent = '';
    valueEl.appendChild(input);
    input.focus();
    input.select();

    const finish = (commit) => {
      if (commit) {
        let newValue = input.value.trim();
        // Parse the value
        if (node.field.type.startsWith('char')) {
          // String value — strip quotes
          newValue = newValue.replace(/^"|"$/g, '');
        } else if (newValue.startsWith('0x') || newValue.startsWith('0X'))
          newValue = parseInt(newValue, 16);
        else if (newValue.startsWith('0b') || newValue.startsWith('0B'))
          newValue = parseInt(newValue.substring(2), 2);
        else
          newValue = parseFloat(newValue);

        if (!isNaN(newValue) || typeof newValue === 'string') {
          // Find the template that owns this node
          const tmplIdx = parseInt(nodeId.split('-')[0], 10);
          const entry = appliedTemplates[tmplIdx];
          if (entry) {
            entry.template.writeValue(data, node, newValue);
            // Mark bytes as modified
            for (let i = 0; i < node.size; ++i) {
              const off = node.offset + i;
              if (off < data.length) {
                if (data[off] !== originalData[off])
                  modified.add(off);
                else
                  modified.delete(off);
              }
            }
            dirty = modified.size > 0 || data.length !== originalData.length;
            updateTitle();
            reEvaluateTemplates();
            render();
          }
        }
      }
      valueEl.textContent = _formatValue(node);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
  }

  function _findNodeById(nodeId) {
    const parts = nodeId.split('-');
    const tmplIdx = parseInt(parts[0], 10);
    const targetOffset = parseInt(parts[1], 10);
    const targetNi = parseInt(parts[2], 10);
    if (tmplIdx >= appliedTemplates.length)
      return null;
    return _searchNodes(appliedTemplates[tmplIdx].result, targetOffset, targetNi);
  }

  function _searchNodes(nodes, targetOffset, targetNi) {
    for (let i = 0; i < nodes.length; ++i) {
      const node = nodes[i];
      if (node.offset === targetOffset && i === targetNi)
        return node;
      if (node.children) {
        const found = _searchNodes(node.children, targetOffset, targetNi);
        if (found)
          return found;
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Accordion expand/collapse
  // -----------------------------------------------------------------------
  for (const header of document.querySelectorAll('.struct-accordion-header')) {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.inspector-endian-toggle'))
        return;
      const body = header.nextElementSibling;
      if (!body)
        return;
      const collapsed = body.classList.toggle('collapsed');
      const toggle = header.querySelector('.struct-accordion-toggle');
      if (toggle)
        toggle.innerHTML = collapsed ? '&#9654;' : '&#9660;';
    });
  }

  // Endian toggle for inspector
  inspectorEndian.addEventListener('change', () => renderDataInspector());

  // -----------------------------------------------------------------------
  // Data Inspector
  // -----------------------------------------------------------------------
  const INSPECTOR_TYPES = [
    { cat: 'Integers', items: [
      { label: 'int8',     le: 'int8',      be: 'int8' },
      { label: 'uint8',    le: 'uint8',     be: 'uint8' },
      { label: 'int16',    le: 'int16le',   be: 'int16be' },
      { label: 'uint16',   le: 'uint16le',  be: 'uint16be' },
      { label: 'int24',    le: 'int24le',   be: 'int24be' },
      { label: 'uint24',   le: 'uint24le',  be: 'uint24be' },
      { label: 'int32',    le: 'int32le',   be: 'int32be' },
      { label: 'uint32',   le: 'uint32le',  be: 'uint32be' },
      { label: 'int64',    le: 'int64le',   be: 'int64be' },
      { label: 'uint64',   le: 'uint64le',  be: 'uint64be' },
    ]},
    { cat: 'Floats', items: [
      { label: 'float16',  le: 'float16le', be: 'float16be' },
      { label: 'float32',  le: 'float32le', be: 'float32be' },
      { label: 'float64',  le: 'float64le', be: 'float64be' },
    ]},
    { cat: 'Binary', items: [
      { label: 'bin8',     le: 'bin8',      be: 'bin8' },
      { label: 'bin16',    le: 'bin16le',   be: 'bin16be' },
      { label: 'bin32',    le: 'bin32le',   be: 'bin32be' },
      { label: 'oct8',     le: 'oct8',      be: 'oct8' },
      { label: 'oct16',    le: 'oct16le',   be: 'oct16be' },
      { label: 'oct32',    le: 'oct32le',   be: 'oct32be' },
    ]},
    { cat: 'Characters', items: [
      { label: 'ASCII',    le: 'char',      be: 'char' },
      { label: 'UTF-16LE', le: 'wchar',     be: 'wchar' },
      { label: 'UTF-8',    le: 'utf8',      be: 'utf8' },
    ]},
    { cat: 'Date/Time', items: [
      { label: 'Unix32',   le: 'unix32le',  be: 'unix32be' },
      { label: 'DOS Date', le: 'dosdate',   be: 'dosdate' },
      { label: 'FILETIME', le: 'filetime',  be: 'filetime' },
      { label: '.NET',     le: 'dotnet_ticks', be: 'dotnet_ticks' },
    ]},
    { cat: 'Colors', items: [
      { label: 'RGB24',    le: 'rgb24',     be: 'rgb24' },
      { label: 'RGBA32',   le: 'rgba32le',  be: 'rgba32le' },
      { label: 'RGB565',   le: 'rgb565le',  be: 'rgb565le' },
    ]},
    { cat: 'Special', items: [
      { label: 'IPv4',     le: 'ipv4',      be: 'ipv4' },
      { label: 'FourCC',   le: 'fourcc',    be: 'fourcc' },
      { label: 'GUID',     le: 'guid',      be: 'guid' },
    ]},
  ];

  const _inspectorCollapsed = {};

  function renderDataInspector() {
    if (structPanel.style.display === 'none')
      return;
    if (dataInspector.classList.contains('collapsed'))
      return;

    if (data.length === 0) {
      dataInspector.innerHTML = '<div class="inspector-empty">No data loaded.</div>';
      return;
    }

    const endian = inspectorEndian.value;
    const TYPES = HexEngine.TYPES;
    let html = '';

    for (const group of INSPECTOR_TYPES) {
      const collapsed = !!_inspectorCollapsed[group.cat];
      const arrow = collapsed ? '&#9654;' : '&#9660;';
      html += '<div class="inspector-group-header" data-insp-cat="' + _escHtml(group.cat) + '">';
      html += '<span class="inspector-group-toggle">' + arrow + '</span>';
      html += _escHtml(group.cat);
      html += '</div>';
      html += '<div class="inspector-group-body' + (collapsed ? ' collapsed' : '') + '" data-insp-cat-body="' + _escHtml(group.cat) + '">';

      for (const item of group.items) {
        const typeName = endian === 'be' ? item.be : item.le;
        const typeInfo = TYPES[typeName];
        if (!typeInfo) {
          html += '<div class="inspector-row"><span class="inspector-type">' + _escHtml(item.label) + '</span><span class="inspector-value na">N/A</span></div>';
          continue;
        }

        const remaining = data.length - cursorOffset;
        if (remaining < typeInfo.size) {
          html += '<div class="inspector-row"><span class="inspector-type">' + _escHtml(item.label) + '</span><span class="inspector-value na">N/A</span></div>';
          continue;
        }

        const rawValue = typeInfo.read(data, cursorOffset);
        let display;
        if (typeInfo.format)
          display = typeInfo.format(rawValue);
        else if (typeof rawValue === 'string')
          display = rawValue;
        else if (typeof rawValue === 'number') {
          if (Number.isInteger(rawValue) && rawValue >= 0)
            display = rawValue + ' (0x' + rawValue.toString(16).toUpperCase() + ')';
          else
            display = String(rawValue);
        } else
          display = String(rawValue);

        let swatch = '';
        if (typeInfo.colorFormat)
          swatch = '<span class="inspector-swatch" style="background:' + typeInfo.colorFormat(rawValue) + '"></span>';

        html += '<div class="inspector-row" data-insp-type="' + typeName + '">';
        html += '<span class="inspector-type">' + _escHtml(item.label) + '</span>';
        html += '<span class="inspector-value">' + swatch + _escHtml(display) + '</span>';
        html += '</div>';
      }

      html += '</div>';
    }

    dataInspector.innerHTML = html;

    // Wire category collapse/expand
    for (const hdr of dataInspector.querySelectorAll('[data-insp-cat]')) {
      hdr.addEventListener('click', () => {
        const cat = hdr.dataset.inspCat;
        const body = dataInspector.querySelector('[data-insp-cat-body="' + cat + '"]');
        if (!body)
          return;
        const nowCollapsed = body.classList.toggle('collapsed');
        _inspectorCollapsed[cat] = nowCollapsed;
        const toggle = hdr.querySelector('.inspector-group-toggle');
        if (toggle)
          toggle.innerHTML = nowCollapsed ? '&#9654;' : '&#9660;';
      });
    }

    // Wire double-click editing
    for (const row of dataInspector.querySelectorAll('[data-insp-type]'))
      row.addEventListener('dblclick', () => _startInspectorEdit(row));
  }

  const _TYPE_RANGES = {
    int8:      [-128, 127],
    uint8:     [0, 255],
    int16le:   [-32768, 32767],       int16be:   [-32768, 32767],
    uint16le:  [0, 65535],            uint16be:  [0, 65535],
    int24le:   [-8388608, 8388607],   int24be:   [-8388608, 8388607],
    uint24le:  [0, 16777215],         uint24be:  [0, 16777215],
    int32le:   [-2147483648, 2147483647],   int32be:   [-2147483648, 2147483647],
    uint32le:  [0, 4294967295],       uint32be:  [0, 4294967295],
    int64le:   [-9007199254740991, 9007199254740991],
    int64be:   [-9007199254740991, 9007199254740991],
    uint64le:  [0, 9007199254740991], uint64be:  [0, 9007199254740991],
    bin8:      [0, 255],
    bin16le:   [0, 65535],            bin16be:   [0, 65535],
    bin32le:   [0, 4294967295],       bin32be:   [0, 4294967295],
    oct8:      [0, 255],
    oct16le:   [0, 65535],            oct16be:   [0, 65535],
    oct32le:   [0, 4294967295],       oct32be:   [0, 4294967295],
    unix32le:  [0, 4294967295],       unix32be:  [0, 4294967295],
    unix64le:  [0, 9007199254740991], unix64be:  [0, 9007199254740991],
    dosdate:   [0, 4294967295],
    filetime:  [0, 9007199254740991],
    dotnet_ticks: [0, 9007199254740991],
    rgb24:     [0, 16777215],
    rgba32le:  [0, 4294967295],
    rgb565le:  [0, 65535],
    bgr24:     [0, 16777215],
    bgra32le:  [0, 4294967295],
    ipv4:      [0, 4294967295],
    bcd8:      [0, 255],
    bcd16le:   [0, 65535],
    bcd32le:   [0, 4294967295],
    wchar:     [0, 65535],
  };

  const _CHAR_TYPES = { char: 1, wchar: 2 };
  const _COLOR_TYPES = new Set(['rgb24', 'rgba32le', 'bgr24', 'bgra32le', 'rgb565le']);
  let _colorPickerRequest = null;

  // Listen for color picker results
  window.addEventListener('storage', (e) => {
    if (!_colorPickerRequest || !e || e.key !== _colorPickerRequest.returnKey || !e.newValue)
      return;
    let payload;
    try { payload = JSON.parse(e.newValue); } catch { return; }
    if (!payload || payload.type !== 'color-picker-result')
      return;

    const r = Math.max(0, Math.min(255, payload.r || 0));
    const g = Math.max(0, Math.min(255, payload.g || 0));
    const b = Math.max(0, Math.min(255, payload.b || 0));
    const a = Math.max(0, Math.min(255, payload.a == null ? 255 : payload.a));
    const off = _colorPickerRequest.offset;
    const tn = _colorPickerRequest.typeName;
    const ti = HexEngine.TYPES[tn];

    if (ti && off + ti.size <= data.length) {
      let packed;
      if (tn === 'rgb24')
        packed = (r << 16) | (g << 8) | b;
      else if (tn === 'rgba32le')
        packed = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
      else if (tn === 'bgr24')
        packed = (b << 16) | (g << 8) | r;
      else if (tn === 'bgra32le')
        packed = ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
      else if (tn === 'rgb565le')
        packed = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
      else
        packed = 0;

      for (let i = 0; i < ti.size; ++i) {
        const o = off + i;
        if (o < data.length)
          pushUndo({ type: 'modify', offset: o, oldValue: data[o], newValue: data[o] });
      }
      ti.write(data, off, packed);
      for (let i = 0; i < ti.size; ++i) {
        const o = off + i;
        if (o < data.length) {
          undoStack[undoStack.length - ti.size + i].newValue = data[o];
          if (data[o] !== originalData[o])
            modified.add(o);
          else
            modified.delete(o);
        }
      }
      dirty = modified.size > 0 || data.length !== originalData.length;
      updateTitle();
      reEvaluateTemplates();
      render();
      renderDataInspector();
    }

    try { localStorage.removeItem(_colorPickerRequest.returnKey); } catch {}
    _colorPickerRequest = null;
  });

  function _startInspectorEdit(row) {
    const typeName = row.dataset.inspType;
    const typeInfo = HexEngine.TYPES[typeName];
    if (!typeInfo || cursorOffset + typeInfo.size > data.length)
      return;
    const valueEl = row.querySelector('.inspector-value');
    if (!valueEl)
      return;

    // Color types: open SZ Color Picker
    if (_COLOR_TYPES.has(typeName)) {
      const rawValue = typeInfo.read(data, cursorOffset);
      const hex = typeInfo.colorFormat ? typeInfo.colorFormat(rawValue) : '#000000';
      const returnKey = 'sz:hex-editor:colorpick:' + Date.now() + ':' + Math.random().toString(36).slice(2);
      _colorPickerRequest = { returnKey, typeName, offset: cursorOffset };
      try {
        User32.PostMessage('sz:launchApp', {
          appId: 'color-picker',
          urlParams: { returnKey, hex },
        });
      } catch {
        _colorPickerRequest = null;
      }
      return;
    }

    if (valueEl.querySelector('input'))
      return;

    const isChar = typeName in _CHAR_TYPES;
    const isUtf8 = typeName === 'utf8';
    const isFourCC = typeName === 'fourcc';
    const rawValue = typeInfo.read(data, cursorOffset);
    const range = _TYPE_RANGES[typeName];
    const input = document.createElement('input');
    input.className = 'struct-node-edit';
    input.type = 'text';
    input.style.width = '100%';

    if (isUtf8) {
      const cp = typeof rawValue === 'object' ? rawValue.cp : rawValue;
      input.value = String.fromCodePoint(cp);
    } else if (isChar) {
      const charVal = typeName === 'char' ? String.fromCharCode(data[cursorOffset]) : String.fromCharCode(data[cursorOffset] | (data[cursorOffset + 1] << 8));
      input.value = charVal;
    } else if (isFourCC) {
      input.value = String(rawValue);
      input.maxLength = 4;
    } else
      input.value = typeof rawValue === 'string' ? rawValue : String(rawValue);

    valueEl.textContent = '';
    valueEl.appendChild(input);
    input.focus();
    input.select();

    // Live-clamp ranged integer inputs as the user types
    if (range && !isChar && !isUtf8 && !isFourCC) {
      input.addEventListener('input', () => {
        const text = input.value.trim();
        if (text === '' || text === '-')
          return;
        const isHex = text.startsWith('0x') || text.startsWith('0X');
        const isBin = text.startsWith('0b') || text.startsWith('0B');
        const isOct = text.startsWith('0o') || text.startsWith('0O');
        let num;
        if (isHex) num = parseInt(text.slice(2), 16);
        else if (isBin) num = parseInt(text.slice(2), 2);
        else if (isOct) num = parseInt(text.slice(2), 8);
        else num = parseFloat(text);
        if (isNaN(num))
          return;
        if (num > range[1]) {
          const clamped = Math.floor(range[1]);
          if (isHex) input.value = '0x' + clamped.toString(16).toUpperCase();
          else if (isBin) input.value = '0b' + (clamped >>> 0).toString(2);
          else if (isOct) input.value = '0o' + (clamped >>> 0).toString(8);
          else input.value = String(clamped);
        } else if (num < range[0]) {
          const clamped = Math.ceil(range[0]);
          input.value = String(clamped);
        }
      });
    }

    const finish = (commit) => {
      if (commit) {
        const text = input.value;

        // UTF-8: encode typed character(s) as UTF-8 bytes
        if (isUtf8) {
          if (text.length === 0) {
            renderDataInspector();
            return;
          }
          const encoded = new TextEncoder().encode(text);
          const endOff = Math.min(cursorOffset + encoded.length, data.length);
          for (let off = cursorOffset; off < endOff; ++off)
            pushUndo({ type: 'modify', offset: off, oldValue: data[off], newValue: data[off] });
          for (let i = 0; i < encoded.length && cursorOffset + i < data.length; ++i)
            data[cursorOffset + i] = encoded[i];
          for (let off = cursorOffset; off < endOff; ++off) {
            const idx = undoStack.length - (endOff - off);
            if (idx >= 0)
              undoStack[idx].newValue = data[off];
            if (data[off] !== originalData[off])
              modified.add(off);
            else
              modified.delete(off);
          }
          dirty = modified.size > 0 || data.length !== originalData.length;
          updateTitle();
          reEvaluateTemplates();
          render();
          renderDataInspector();
          return;
        }

        // Character types: write multi-char string to consecutive bytes
        if (isChar) {
          const bytesPerChar = _CHAR_TYPES[typeName];
          if (text.length === 0) {
            renderDataInspector();
            return;
          }
          const totalBytes = text.length * bytesPerChar;
          const endOff = Math.min(cursorOffset + totalBytes, data.length);
          for (let off = cursorOffset; off < endOff; ++off)
            pushUndo({ type: 'modify', offset: off, oldValue: data[off], newValue: data[off] });
          for (let i = 0; i < text.length; ++i) {
            const off = cursorOffset + i * bytesPerChar;
            if (off + bytesPerChar > data.length)
              break;
            const code = text.charCodeAt(i);
            if (bytesPerChar === 1)
              data[off] = code & 0xff;
            else {
              data[off] = code & 0xff;
              data[off + 1] = (code >> 8) & 0xff;
            }
          }
          for (let off = cursorOffset; off < endOff; ++off) {
            const idx = undoStack.length - (endOff - off);
            if (idx >= 0)
              undoStack[idx].newValue = data[off];
            if (data[off] !== originalData[off])
              modified.add(off);
            else
              modified.delete(off);
          }
          dirty = modified.size > 0 || data.length !== originalData.length;
          updateTitle();
          reEvaluateTemplates();
          render();
          renderDataInspector();
          return;
        }

        // FourCC: require exactly 4 characters
        if (isFourCC) {
          const str = text;
          if (str.length !== 4) {
            renderDataInspector();
            return;
          }
          for (let i = 0; i < typeInfo.size; ++i) {
            const off = cursorOffset + i;
            if (off < data.length)
              pushUndo({ type: 'modify', offset: off, oldValue: data[off], newValue: data[off] });
          }
          typeInfo.write(data, cursorOffset, str);
          for (let i = 0; i < typeInfo.size; ++i) {
            const off = cursorOffset + i;
            if (off < data.length) {
              undoStack[undoStack.length - typeInfo.size + i].newValue = data[off];
              if (data[off] !== originalData[off])
                modified.add(off);
              else
                modified.delete(off);
            }
          }
          dirty = modified.size > 0 || data.length !== originalData.length;
          updateTitle();
          reEvaluateTemplates();
          render();
          renderDataInspector();
          return;
        }

        // Numeric / special types
        let newValue = text.trim();
        if (typeof rawValue === 'string')
          newValue = newValue.replace(/^"|"$/g, '');
        else if (newValue.startsWith('0x') || newValue.startsWith('0X'))
          newValue = parseInt(newValue.slice(2), 16);
        else if (newValue.startsWith('0b') || newValue.startsWith('0B'))
          newValue = parseInt(newValue.slice(2), 2);
        else if (newValue.startsWith('0o') || newValue.startsWith('0O'))
          newValue = parseInt(newValue.slice(2), 8);
        else
          newValue = parseFloat(newValue);

        if (typeof newValue === 'number') {
          if (isNaN(newValue)) {
            renderDataInspector();
            return;
          }
          if (range)
            newValue = Math.max(range[0], Math.min(range[1], newValue));
        } else if (typeof rawValue !== 'string') {
          renderDataInspector();
          return;
        }

        for (let i = 0; i < typeInfo.size; ++i) {
          const off = cursorOffset + i;
          if (off < data.length)
            pushUndo({ type: 'modify', offset: off, oldValue: data[off], newValue: data[off] });
        }
        typeInfo.write(data, cursorOffset, newValue);
        for (let i = 0; i < typeInfo.size; ++i) {
          const off = cursorOffset + i;
          if (off < data.length) {
            undoStack[undoStack.length - typeInfo.size + i].newValue = data[off];
            if (data[off] !== originalData[off])
              modified.add(off);
            else
              modified.delete(off);
          }
        }
        dirty = modified.size > 0 || data.length !== originalData.length;
        updateTitle();
        reEvaluateTemplates();
        render();
      }
      renderDataInspector();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }

  // -----------------------------------------------------------------------
  // Import struct files
  // -----------------------------------------------------------------------
  async function doImportStruct(lang) {
    const filters = lang === 'c'
      ? [{ name: 'C/C++ Headers', ext: ['h', 'hpp', 'c', 'cpp'] }, { name: 'All Files', ext: ['*'] }]
      : [{ name: 'C# Files', ext: ['cs'] }, { name: 'All Files', ext: ['*'] }];

    const result = await ComDlg32.GetOpenFileName({
      filters,
      initialDir: '/user/documents',
      title: 'Import ' + (lang === 'c' ? 'C/C++ Header' : 'C# Struct'),
    });

    if (result.cancelled || !result.path)
      return;

    let content;
    try {
      content = await Kernel32.ReadAllBytes(result.path);
    } catch (err) {
      alert('Could not read file: ' + err.message);
      return;
    }

    // Decode to text
    let text;
    if (typeof content === 'string') {
      try { text = atob(content); } catch (_) { text = content; }
    } else if (content instanceof ArrayBuffer)
      text = new TextDecoder().decode(content);
    else if (content instanceof Uint8Array)
      text = new TextDecoder().decode(content);
    else
      text = String(content);

    const structs = lang === 'c'
      ? HexEngine.parseCHeader(text)
      : HexEngine.parseCSharpStruct(text);

    if (structs.length === 0) {
      alert('No structures found in the file.');
      return;
    }

    if (structs.length === 1) {
      // Apply directly
      const def = structs[0];
      const id = 'import-' + Date.now();
      HexEngine.registerTemplate(id, def);
      populateTemplateDropdown();
      templateSelect.value = id;
      applyTemplate(id, cursorOffset);
      return;
    }

    // Multiple structs — show selection dialog
    const selectEl = document.getElementById('import-struct-select');
    selectEl.innerHTML = '';
    for (let i = 0; i < structs.length; ++i) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = structs[i].label;
      selectEl.appendChild(opt);
    }

    const dlgResult = await SZ.Dialog.show('dlg-import-struct');
    if (dlgResult !== 'ok')
      return;

    const idx = parseInt(selectEl.value, 10);
    const endian = document.querySelector('input[name="import-endian"]:checked').value;
    const def = structs[idx];
    def.endian = endian;
    const id = 'import-' + Date.now();
    HexEngine.registerTemplate(id, def);
    populateTemplateDropdown();
    templateSelect.value = id;
    applyTemplate(id, cursorOffset);
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
    reEvaluateTemplates();
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
      reEvaluateTemplates();
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
    appliedTemplates = [];
    rebuildFieldMap();
    updateTitle();
    updateScrollHeight();
    render();
    renderStructPanel();
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
    appliedTemplates = [];
    rebuildFieldMap();
    updateTitle();
    applyBprMode();
    updateScrollHeight();
    render();
    renderStructPanel();
    updateStatusBar();
    doAutoDetectTemplate();
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
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Untitled';
      await saveToPath(result.path, callback);
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
    SZ.Dialog.show('dlg-goto');
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
      SZ.Dialog.close('dlg-goto');
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
    SZ.Dialog.show('dlg-find');
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
      SZ.Dialog.close('dlg-find');
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
        SZ.Dialog.show('dlg-find');
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
    applyBprMode();
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
      appliedTemplates = [];
      rebuildFieldMap();
      updateTitle();
      applyBprMode();
      updateScrollHeight();
      render();
      renderStructPanel();
      updateStatusBar();
      doAutoDetectTemplate();
      hexViewport.focus();
    };
    reader.readAsArrayBuffer(file);
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  populateTemplateDropdown();
  updateBprRadios();
  applyBprMode();
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
