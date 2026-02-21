// SynthelicZ Drums — Bar Editor
// Interactive grid editor for composing drum patterns bar-by-bar.
// Features: left-click to cycle states, right-click for context menu,
// serialization display (hex bytes), and bar management.

(function (ns) {
'use strict';

const { Instrument, PlayState, DrumBit, Bar, DrumGroove, AbcConverter,
        LANE_ORDER_UD, INSTRUMENT_COLORS, INSTRUMENT_SHORT } = ns;

// ── Constants ──────────────────────────────────────────────

const _BEAT_INDEXES = AbcConverter._beatIndexes; // chronological 16th-note order

const _COL_HEADERS = Object.freeze([
  '1', 'e', '+', 'a',
  '2', 'e', '+', 'a',
  '3', 'e', '+', 'a',
  '4', 'e', '+', 'a',
]);

const _PLAY_STATE_SYMBOLS = Object.freeze({
  [PlayState.Silence]:  '',
  [PlayState.Stroke]:   '●',
  [PlayState.Ghost]:    '○',
  [PlayState.Accent]:   '▲',
  [PlayState.Click]:    '×',
  [PlayState.Flam]:     '◆',
  [PlayState.Ruff]:     '⬥',
  [PlayState.Rimshot]:  '◈',
  [PlayState.Choke]:    '✕',
});

const _PLAY_STATE_NAMES = Object.freeze({
  [PlayState.Silence]:  'Silence',
  [PlayState.Stroke]:   'Stroke ●',
  [PlayState.Ghost]:    'Ghost ○',
  [PlayState.Accent]:   'Accent ▲',
  [PlayState.Click]:    'Click ×',
  [PlayState.Flam]:     'Flam ◆',
  [PlayState.Ruff]:     'Ruff ⬥',
  [PlayState.Rimshot]:  'Rimshot ◈',
  [PlayState.Choke]:    'Choke ✕',
});

// Per-instrument valid PlayState cycles (order matters — Silence is always first)
const _VALID_STATES = Object.freeze({
  [Instrument.BassDrum]:    [PlayState.Silence, PlayState.Stroke],
  [Instrument.SnareDrum]:   [PlayState.Silence, PlayState.Stroke, PlayState.Click, PlayState.Ghost, PlayState.Rimshot, PlayState.Flam, PlayState.Ruff],
  [Instrument.ClosedHiHat]: [PlayState.Silence, PlayState.Stroke],
  [Instrument.OpenHiHat]:   [PlayState.Silence, PlayState.Stroke],
  [Instrument.HiHatPedal]:  [PlayState.Silence, PlayState.Stroke],
  [Instrument.Crash]:       [PlayState.Silence, PlayState.Stroke, PlayState.Accent, PlayState.Choke],
  [Instrument.Ride]:        [PlayState.Silence, PlayState.Stroke, PlayState.Accent],
  [Instrument.RideBell]:    [PlayState.Silence, PlayState.Stroke, PlayState.Accent],
  [Instrument.HighTom]:     [PlayState.Silence, PlayState.Stroke, PlayState.Ghost, PlayState.Accent, PlayState.Flam, PlayState.Ruff, PlayState.Rimshot],
  [Instrument.MidTom]:      [PlayState.Silence, PlayState.Stroke, PlayState.Ghost, PlayState.Accent, PlayState.Flam, PlayState.Ruff, PlayState.Rimshot],
  [Instrument.FloorTom]:    [PlayState.Silence, PlayState.Stroke, PlayState.Ghost, PlayState.Accent, PlayState.Flam, PlayState.Ruff, PlayState.Rimshot],
});

// ── BarEditor class ────────────────────────────────────────

class BarEditor {

  /** @param {HTMLElement} containerEl  The #bar-editor-viewport element.
   *  @param {function}    onGrooveChanged  Called after every edit with the updated groove. */
  constructor(containerEl, onGrooveChanged) {
    this._container = containerEl;
    this._onGrooveChanged = onGrooveChanged || (() => {});
    this._groove = null;
    this._currentBarIndex = 0;
    this._cells = []; // 2-D array [rowIdx][colIdx] → <td>
    this._hexCells = []; // 1-D array [colIdx] → <td> for hex row
    this._counterEl = null;
    this._barSerialEl = null;
    this._prevBtn = null;
    this._nextBtn = null;
    this._delBtn = null;
    this._built = false;
    this._contextMenu = null;
    this._copiedBar = null; // clipboard for bar copy/paste
  }

  // ── Public API ───────────────────────────────────────────

  /** Load a groove and display the current bar (clamped to valid range). */
  loadGroove(groove) {
    this._groove = groove;
    const maxIdx = groove ? groove.bars.length - 1 : 0;
    if (this._currentBarIndex > maxIdx)
      this._currentBarIndex = Math.max(0, maxIdx);

    if (!this._built)
      this._buildDOM();

    this._refreshGrid();
    this._refreshToolbar();
  }

  /** Update the grid without changing the groove reference (e.g., after external edits). */
  refresh() {
    this._refreshGrid();
    this._refreshToolbar();
  }

  // ── DOM construction (once) ──────────────────────────────

  _buildDOM() {
    this._container.innerHTML = '';
    this._container.classList.add('bar-editor');

    // instructions banner (shows once, until groove is loaded)
    const instr = document.createElement('div');
    instr.className = 'bar-editor-instructions';
    instr.innerHTML =
      '<strong>How to use:</strong> ' +
      '<b>Left-click</b> a cell to cycle through play states. ' +
      '<b>Right-click</b> for more options. ' +
      'Use <b>◀ ▶</b> to navigate bars, <b>＋ Add</b> to insert new bars, ' +
      '<b>📋 Dup</b> to duplicate, <b>🗑 Del</b> to remove. ' +
      'The <b>hex row</b> at the bottom shows each slot\'s serialized byte.';
    this._container.appendChild(instr);

    // toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'bar-toolbar';
    this._container.appendChild(toolbar);
    this._buildToolbar(toolbar);

    // grid wrapper
    const gridWrap = document.createElement('div');
    gridWrap.className = 'bar-grid';
    this._container.appendChild(gridWrap);
    this._buildGrid(gridWrap);

    // bar serialization display
    const serialWrap = document.createElement('div');
    serialWrap.className = 'bar-serial';
    this._container.appendChild(serialWrap);
    this._barSerialEl = document.createElement('code');
    this._barSerialEl.className = 'bar-serial-code';
    serialWrap.appendChild(this._barSerialEl);

    // context menu (hidden, positioned absolutely)
    this._buildContextMenu();

    this._built = true;
  }

  _buildToolbar(toolbar) {
    const _btn = (cls, text, title, handler) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = text;
      b.title = title;
      b.addEventListener('click', handler);
      toolbar.appendChild(b);
      return b;
    };

    this._prevBtn = _btn('bar-nav-btn', '◀', 'Previous bar', () => this._navigate(-1));
    this._counterEl = document.createElement('span');
    this._counterEl.className = 'bar-counter';
    toolbar.appendChild(this._counterEl);
    this._nextBtn = _btn('bar-nav-btn', '▶', 'Next bar', () => this._navigate(1));

    // spacer
    const spacer = document.createElement('span');
    spacer.className = 'bar-toolbar-spacer';
    toolbar.appendChild(spacer);

    _btn('bar-action-btn', '＋ Add', 'Add empty bar after current', () => this._addBar());
    _btn('bar-action-btn', '📋 Dup', 'Duplicate current bar', () => this._duplicateBar());
    _btn('bar-action-btn', '📄 Copy', 'Copy current bar to clipboard', () => this._copyBar());
    _btn('bar-action-btn', '📋 Paste', 'Paste bar from clipboard after current', () => this._pasteBar());
    this._delBtn = _btn('bar-action-btn bar-del-btn', '🗑 Del', 'Delete current bar', () => this._deleteBar());
  }

  _buildGrid(gridWrap) {
    const table = document.createElement('table');
    table.className = 'bar-grid-table';
    gridWrap.appendChild(table);

    // thead
    const thead = document.createElement('thead');
    table.appendChild(thead);
    const headerRow = document.createElement('tr');
    thead.appendChild(headerRow);

    // empty corner cell
    const corner = document.createElement('th');
    corner.className = 'grid-corner';
    headerRow.appendChild(corner);

    for (let col = 0; col < 16; ++col) {
      const th = document.createElement('th');
      th.className = 'grid-col-header';
      if (col % 4 === 0)
        th.classList.add('beat-start');

      th.textContent = _COL_HEADERS[col];
      headerRow.appendChild(th);
    }

    // tbody — one row per instrument
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    this._cells = [];

    for (let row = 0; row < LANE_ORDER_UD.length; ++row) {
      const instrument = LANE_ORDER_UD[row];
      const tr = document.createElement('tr');
      tbody.appendChild(tr);

      // row label
      const th = document.createElement('th');
      th.className = 'grid-row-header';
      th.textContent = INSTRUMENT_SHORT[instrument] || '??';
      th.style.color = INSTRUMENT_COLORS[instrument] || '#ccc';
      tr.appendChild(th);

      const rowCells = [];
      for (let col = 0; col < 16; ++col) {
        const td = document.createElement('td');
        td.className = 'grid-cell';
        if (col % 4 === 0)
          td.classList.add('beat-start');

        td.dataset.row = row;
        td.dataset.col = col;
        td.addEventListener('click', () => this._onCellClick(row, col));
        td.addEventListener('contextmenu', (e) => this._onCellContext(e, row, col));
        tr.appendChild(td);
        rowCells.push(td);
      }
      this._cells.push(rowCells);
    }

    // tfoot — hex serialization row
    const tfoot = document.createElement('tfoot');
    table.appendChild(tfoot);
    const hexRow = document.createElement('tr');
    hexRow.className = 'hex-row';
    tfoot.appendChild(hexRow);

    const hexCorner = document.createElement('th');
    hexCorner.className = 'grid-corner hex-label';
    hexCorner.textContent = 'Hex';
    hexRow.appendChild(hexCorner);

    this._hexCells = [];
    for (let col = 0; col < 16; ++col) {
      const td = document.createElement('td');
      td.className = 'hex-cell';
      if (col % 4 === 0)
        td.classList.add('beat-start');

      td.title = 'DrumBit byte value for this 16th-note slot';
      hexRow.appendChild(td);
      this._hexCells.push(td);
    }
  }

  // ── Context Menu ─────────────────────────────────────────

  _buildContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'bar-context-menu';
    menu.style.display = 'none';
    document.body.appendChild(menu);
    this._contextMenu = menu;

    // close on click outside
    document.addEventListener('click', () => this._closeContextMenu());
    document.addEventListener('contextmenu', (e) => {
      // Only close if the right-click wasn't on a grid cell (grid cells handle their own)
      if (!e.target.closest('.grid-cell'))
        this._closeContextMenu();
    });
  }

  _onCellContext(e, row, col) {
    e.preventDefault();
    this._closeContextMenu();

    const instrument = LANE_ORDER_UD[row];
    const validStates = _VALID_STATES[instrument];
    if (!validStates)
      return;

    const menu = this._contextMenu;
    menu.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'ctx-header';
    header.textContent = `${INSTRUMENT_SHORT[instrument]} — ${_COL_HEADERS[col]}`;
    menu.appendChild(header);

    // Separator
    menu.appendChild(_ctxSep());

    // State items
    for (const state of validStates) {
      const item = document.createElement('div');
      item.className = 'ctx-item';
      item.textContent = _PLAY_STATE_NAMES[state] || state;
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this._setCellState(row, col, state);
        this._closeContextMenu();
      });
      menu.appendChild(item);
    }

    // Separator + bulk actions
    menu.appendChild(_ctxSep());

    _ctxAction(menu, '🧹 Clear this column', () => {
      this._clearColumn(col);
      this._closeContextMenu();
    });

    _ctxAction(menu, '🧹 Clear this row', () => {
      this._clearRow(row);
      this._closeContextMenu();
    });

    _ctxAction(menu, '🧹 Clear entire bar', () => {
      this._clearBar();
      this._closeContextMenu();
    });

    // Position the menu near the pointer
    menu.style.display = 'block';
    const mx = e.clientX;
    const my = e.clientY;
    // Prevent overflow off-screen
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      menu.style.left = Math.min(mx, window.innerWidth - rect.width - 8) + 'px';
      menu.style.top = Math.min(my, window.innerHeight - rect.height - 8) + 'px';
    });
    menu.style.left = mx + 'px';
    menu.style.top = my + 'px';
  }

  _closeContextMenu() {
    if (this._contextMenu)
      this._contextMenu.style.display = 'none';
  }

  // ── Refresh helpers ──────────────────────────────────────

  _refreshGrid() {
    const bar = this._currentBar();
    if (!bar)
      return;

    for (let row = 0; row < LANE_ORDER_UD.length; ++row) {
      const instrument = LANE_ORDER_UD[row];
      const color = INSTRUMENT_COLORS[instrument] || '#ccc';

      for (let col = 0; col < 16; ++col) {
        const noteIdx = _BEAT_INDEXES[col];
        const drumBit = bar.getDrumBit(noteIdx);
        const state = drumBit ? drumBit.getInstrument(instrument) : PlayState.Silence;
        const td = this._cells[row][col];

        td.textContent = _PLAY_STATE_SYMBOLS[state] || '';
        td.dataset.state = state;

        // colour active cells with the instrument's colour
        if (state !== PlayState.Silence) {
          td.style.backgroundColor = color;
          td.style.color = '#000';
        } else {
          td.style.backgroundColor = '';
          td.style.color = '';
        }
      }
    }

    // Update hex row
    this._refreshHexRow();
  }

  _refreshHexRow() {
    const bar = this._currentBar();
    if (!bar)
      return;

    // Build full bar serial string
    const hexParts = [];
    for (let col = 0; col < 16; ++col) {
      const noteIdx = _BEAT_INDEXES[col];
      const drumBit = bar.getDrumBit(noteIdx);
      const val = drumBit ? drumBit.bitPattern : 0;
      const hex = val.toString(16).toUpperCase().padStart(2, '0');
      hexParts.push(hex);

      const td = this._hexCells[col];
      td.textContent = hex;
      td.title = `Slot ${_COL_HEADERS[col]}: 0x${hex} (${val})`;

      // Highlight non-zero bytes
      if (val !== 0) {
        td.style.color = 'var(--accent-cyan)';
        td.style.opacity = '1';
      } else {
        td.style.color = '';
        td.style.opacity = '0.35';
      }
    }

    // Bar serial string
    if (this._barSerialEl)
      this._barSerialEl.textContent = `Bar ${this._currentBarIndex + 1} bytes: ${hexParts.join(' ')}`;
  }

  _refreshToolbar() {
    if (!this._groove) {
      if (this._counterEl)
        this._counterEl.textContent = 'No groove';
      return;
    }

    const total = this._groove.bars.length;
    if (this._counterEl)
      this._counterEl.textContent = `Bar ${this._currentBarIndex + 1} / ${total}`;
    if (this._prevBtn)
      this._prevBtn.disabled = this._currentBarIndex <= 0;
    if (this._nextBtn)
      this._nextBtn.disabled = this._currentBarIndex >= total - 1;
    if (this._delBtn)
      this._delBtn.disabled = total <= 1;
  }

  // ── Current bar helper ──────────────────────────────────

  _currentBar() {
    return this._groove ? this._groove.getBar(this._currentBarIndex) : null;
  }

  // ── Cell interaction ─────────────────────────────────────

  _onCellClick(row, col) {
    const bar = this._currentBar();
    if (!bar)
      return;

    const instrument = LANE_ORDER_UD[row];
    const noteIdx = _BEAT_INDEXES[col];
    const drumBit = bar.getDrumBit(noteIdx);
    if (!drumBit)
      return;

    // current state → next in cycle
    const currentState = drumBit.getInstrument(instrument);
    const validStates = _VALID_STATES[instrument];
    if (!validStates)
      return;

    const idx = validStates.indexOf(currentState);
    const nextState = validStates[(idx + 1) % validStates.length];
    drumBit.setInstrument(instrument, nextState);

    this._refreshColumn(col);
    this._onGrooveChanged(this._groove);
  }

  _setCellState(row, col, state) {
    const bar = this._currentBar();
    if (!bar)
      return;

    const instrument = LANE_ORDER_UD[row];
    const noteIdx = _BEAT_INDEXES[col];
    const drumBit = bar.getDrumBit(noteIdx);
    if (!drumBit)
      return;

    drumBit.setInstrument(instrument, state);
    this._refreshColumn(col);
    this._onGrooveChanged(this._groove);
  }

  /** Refresh every instrument cell in one column (a single DrumBit changed). */
  _refreshColumn(col) {
    const bar = this._currentBar();
    if (!bar)
      return;

    const noteIdx = _BEAT_INDEXES[col];
    const drumBit = bar.getDrumBit(noteIdx);

    for (let row = 0; row < LANE_ORDER_UD.length; ++row) {
      const instrument = LANE_ORDER_UD[row];
      const color = INSTRUMENT_COLORS[instrument] || '#ccc';
      const state = drumBit ? drumBit.getInstrument(instrument) : PlayState.Silence;
      const td = this._cells[row][col];

      td.textContent = _PLAY_STATE_SYMBOLS[state] || '';
      td.dataset.state = state;

      if (state !== PlayState.Silence) {
        td.style.backgroundColor = color;
        td.style.color = '#000';
      } else {
        td.style.backgroundColor = '';
        td.style.color = '';
      }
    }

    // Update hex for this column
    const val = drumBit ? drumBit.bitPattern : 0;
    const hex = val.toString(16).toUpperCase().padStart(2, '0');
    const td = this._hexCells[col];
    td.textContent = hex;
    td.title = `Slot ${_COL_HEADERS[col]}: 0x${hex} (${val})`;
    td.style.color = val !== 0 ? 'var(--accent-cyan)' : '';
    td.style.opacity = val !== 0 ? '1' : '0.35';

    this._refreshHexRow(); // update serial string too
  }

  // ── Bulk operations ──────────────────────────────────────

  _clearColumn(col) {
    const bar = this._currentBar();
    if (!bar)
      return;

    const noteIdx = _BEAT_INDEXES[col];
    bar.setDrumBit(noteIdx, new DrumBit());
    this._refreshColumn(col);
    this._onGrooveChanged(this._groove);
  }

  _clearRow(row) {
    const bar = this._currentBar();
    if (!bar)
      return;

    const instrument = LANE_ORDER_UD[row];
    for (let col = 0; col < 16; ++col) {
      const noteIdx = _BEAT_INDEXES[col];
      const drumBit = bar.getDrumBit(noteIdx);
      if (drumBit)
        drumBit.setInstrument(instrument, PlayState.Silence);
    }
    this._refreshGrid();
    this._onGrooveChanged(this._groove);
  }

  _clearBar() {
    const bar = this._currentBar();
    if (!bar)
      return;

    for (let col = 0; col < 16; ++col) {
      const noteIdx = _BEAT_INDEXES[col];
      bar.setDrumBit(noteIdx, new DrumBit());
    }
    this._refreshGrid();
    this._onGrooveChanged(this._groove);
  }

  // ── Navigation ───────────────────────────────────────────

  _navigate(delta) {
    if (!this._groove)
      return;

    const newIdx = this._currentBarIndex + delta;
    if (newIdx < 0 || newIdx >= this._groove.bars.length)
      return;

    this._currentBarIndex = newIdx;
    this._refreshGrid();
    this._refreshToolbar();
  }

  // ── Bar management ───────────────────────────────────────

  _addBar() {
    if (!this._groove)
      return;

    this._groove.addBar(new Bar(), this._currentBarIndex + 1);
    this._currentBarIndex += 1;
    this._refreshGrid();
    this._refreshToolbar();
    this._onGrooveChanged(this._groove);
  }

  _duplicateBar() {
    if (!this._groove)
      return;

    const cloned = this._groove.cloneBar(this._currentBarIndex);
    if (!cloned)
      return;

    this._groove.addBar(cloned, this._currentBarIndex + 1);
    this._currentBarIndex += 1;
    this._refreshGrid();
    this._refreshToolbar();
    this._onGrooveChanged(this._groove);
  }

  _copyBar() {
    if (!this._groove)
      return;

    this._copiedBar = this._groove.cloneBar(this._currentBarIndex);
  }

  _pasteBar() {
    if (!this._groove || !this._copiedBar)
      return;

    const pasted = new Bar();
    pasted.bits = this._copiedBar.bits.map(bit => new DrumBit(bit._bitPattern));
    this._groove.addBar(pasted, this._currentBarIndex + 1);
    this._currentBarIndex += 1;
    this._refreshGrid();
    this._refreshToolbar();
    this._onGrooveChanged(this._groove);
  }

  _deleteBar() {
    if (!this._groove || this._groove.bars.length <= 1)
      return;

    this._groove.removeBar(this._currentBarIndex);
    if (this._currentBarIndex >= this._groove.bars.length)
      this._currentBarIndex = this._groove.bars.length - 1;

    this._refreshGrid();
    this._refreshToolbar();
    this._onGrooveChanged(this._groove);
  }
}

// ── Module-level helpers ─────────────────────────────────

function _ctxSep() {
  const sep = document.createElement('div');
  sep.className = 'ctx-separator';
  return sep;
}

function _ctxAction(menu, label, handler) {
  const item = document.createElement('div');
  item.className = 'ctx-item ctx-action';
  item.textContent = label;
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    handler();
  });
  menu.appendChild(item);
}

// ── Exports ────────────────────────────────────────────────

ns.BarEditor = BarEditor;

// Also export internals for testing
ns._BAR_EDITOR_INTERNALS = Object.freeze({
  COL_HEADERS: _COL_HEADERS,
  INSTRUMENT_LABELS: INSTRUMENT_SHORT,
  PLAY_STATE_SYMBOLS: _PLAY_STATE_SYMBOLS,
  PLAY_STATE_NAMES: _PLAY_STATE_NAMES,
  VALID_STATES: _VALID_STATES,
});

})(window.SZDrums = window.SZDrums || {});
