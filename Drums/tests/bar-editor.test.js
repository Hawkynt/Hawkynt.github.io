// Tests for bar-editor.js — BarEditor grid, cell cycling, navigation, bar management

(function () {
'use strict';

const { describe, it, expect, beforeEach } = window.TestRunner;
const { Instrument, PlayState, NoteIndex, DrumBit, Bar, DrumGroove,
        AbcConverter, BarEditor, LANE_ORDER_UD, INSTRUMENT_COLORS,
        _BAR_EDITOR_INTERNALS } = window.SZDrums;

const { COL_HEADERS, INSTRUMENT_LABELS, PLAY_STATE_SYMBOLS, VALID_STATES, PLAY_STATE_NAMES } = _BAR_EDITOR_INTERNALS;
const BEAT_INDEXES = AbcConverter._beatIndexes;

// ── Helpers ──────────────────────────────────────────────────

/** Create a disposable container element. */
const makeContainer = () => {
  const el = document.createElement('div');
  el.id = 'bar-editor-viewport';
  el.style.display = 'none'; // keep it off-screen
  document.body.appendChild(el);
  return el;
};

/** Tear down container after test. */
const destroyContainer = (el) => {
  if (el && el.parentNode)
    el.parentNode.removeChild(el);
};

/** Convert a hex color like "#ffd740" to the "rgb(r, g, b)" form the browser returns. */
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff})`;
};

/** Build a simple 1-bar groove (all silence). */
const makeSilentGroove = (barCount = 1) => {
  const groove = new DrumGroove();
  for (let i = 0; i < barCount; ++i)
    groove.addBar(new Bar());
  return groove;
};

// ────────────────────────────────────────────────────────────
// Constants sanity checks
// ────────────────────────────────────────────────────────────

describe('BarEditor — constants', () => {
  it('COL_HEADERS has 16 entries', () => {
    expect(COL_HEADERS.length).toBe(16);
  });

  it('INSTRUMENT_LABELS covers every LANE_ORDER_UD instrument', () => {
    for (const instr of LANE_ORDER_UD)
      expect(INSTRUMENT_LABELS[instr]).not.toBe(undefined);
  });

  it('VALID_STATES covers every LANE_ORDER_UD instrument', () => {
    for (const instr of LANE_ORDER_UD)
      expect(VALID_STATES[instr]).not.toBe(undefined);
  });

  it('every VALID_STATES cycle starts with Silence', () => {
    for (const instr of LANE_ORDER_UD)
      expect(VALID_STATES[instr][0]).toBe(PlayState.Silence);
  });

  it('PLAY_STATE_SYMBOLS has a key for every PlayState value', () => {
    for (const ps of Object.values(PlayState))
      expect(PLAY_STATE_SYMBOLS[ps] !== undefined).toBe(true);
  });

  it('PLAY_STATE_NAMES has a key for every PlayState value', () => {
    for (const ps of Object.values(PlayState))
      expect(PLAY_STATE_NAMES[ps] !== undefined).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// Construction & DOM structure
// ────────────────────────────────────────────────────────────

describe('BarEditor — construction', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('can be constructed without errors', () => {
    const editor = new BarEditor(container, () => {});
    expect(editor).not.toBe(null);
    destroyContainer(container);
  });

  it('does not build DOM until loadGroove is called', () => {
    const editor = new BarEditor(container, () => {});
    expect(container.querySelector('.bar-toolbar')).toBe(null);
    destroyContainer(container);
  });

  it('builds toolbar and grid on loadGroove', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    expect(container.querySelector('.bar-toolbar')).not.toBe(null);
    expect(container.querySelector('.bar-grid-table')).not.toBe(null);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Grid dimensions
// ────────────────────────────────────────────────────────────

describe('BarEditor — grid dimensions', () => {
  let container, editor;

  beforeEach(() => {
    container = makeContainer();
    editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
  });

  it('grid has 10 instrument rows', () => {
    const rows = container.querySelectorAll('.bar-grid-table tbody tr');
    expect(rows.length).toBe(LANE_ORDER_UD.length);
    destroyContainer(container);
  });

  it('each row has 16 cells plus a header', () => {
    const firstRow = container.querySelector('.bar-grid-table tbody tr');
    const cells = firstRow.querySelectorAll('td.grid-cell');
    expect(cells.length).toBe(16);
    const header = firstRow.querySelector('th.grid-row-header');
    expect(header).not.toBe(null);
    destroyContainer(container);
  });

  it('column header row has 16 column headers + corner', () => {
    const ths = container.querySelectorAll('.bar-grid-table thead th');
    expect(ths.length).toBe(17); // 1 corner + 16 columns
    destroyContainer(container);
  });

  it('row headers match INSTRUMENT_LABELS in LANE_ORDER_UD', () => {
    const headers = container.querySelectorAll('.bar-grid-table tbody .grid-row-header');
    for (let i = 0; i < LANE_ORDER_UD.length; ++i)
      expect(headers[i].textContent).toBe(INSTRUMENT_LABELS[LANE_ORDER_UD[i]]);
    destroyContainer(container);
  });

  it('column headers follow the "1 e + a" pattern', () => {
    const ths = container.querySelectorAll('.bar-grid-table thead .grid-col-header');
    for (let i = 0; i < 16; ++i)
      expect(ths[i].textContent).toBe(COL_HEADERS[i]);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Silence state rendering
// ────────────────────────────────────────────────────────────

describe('BarEditor — silence rendering', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('all cells are empty for a silent bar', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const cells = container.querySelectorAll('.grid-cell');
    for (const cell of cells) {
      expect(cell.textContent).toBe('');
      expect(cell.dataset.state).toBe(PlayState.Silence);
    }
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Pre-populated bar rendering
// ────────────────────────────────────────────────────────────

describe('BarEditor — pre-populated bar', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('renders bass drum stroke in the correct cell', () => {
    const groove = makeSilentGroove();
    const bar = groove.getBar(0);
    const bit = bar.getDrumBit(NoteIndex.Beat1);
    bit.setInstrument(Instrument.BassDrum, PlayState.Stroke);

    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    // Beat1 is column 0 (chronological index 0), BassDrum is row 9 (last in LANE_ORDER_UD)
    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[bdRow]
                          .querySelectorAll('.grid-cell')[0];
    expect(cell.textContent).toBe(PLAY_STATE_SYMBOLS[PlayState.Stroke]);
    expect(cell.dataset.state).toBe(PlayState.Stroke);
    destroyContainer(container);
  });

  it('renders snare ghost note with the correct symbol', () => {
    const groove = makeSilentGroove();
    const bar = groove.getBar(0);
    const bit = bar.getDrumBit(NoteIndex.Beat2);
    bit.setInstrument(Instrument.SnareDrum, PlayState.Ghost);

    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    const snRow = LANE_ORDER_UD.indexOf(Instrument.SnareDrum);
    // Beat2 is chronological index 4
    const col = BEAT_INDEXES.indexOf(NoteIndex.Beat2);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[snRow]
                          .querySelectorAll('.grid-cell')[col];
    expect(cell.textContent).toBe(PLAY_STATE_SYMBOLS[PlayState.Ghost]);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Cell click — state cycling
// ────────────────────────────────────────────────────────────

describe('BarEditor — cell click cycling', () => {
  let container, changedCount;

  beforeEach(() => {
    container = makeContainer();
    changedCount = 0;
  });

  it('clicking a silent bass drum cell toggles to Stroke', () => {
    const groove = makeSilentGroove();
    const editor = new BarEditor(container, () => { ++changedCount; });
    editor.loadGroove(groove);

    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[bdRow]
                          .querySelectorAll('.grid-cell')[0];
    cell.click();
    expect(cell.dataset.state).toBe(PlayState.Stroke);
    expect(cell.textContent).toBe(PLAY_STATE_SYMBOLS[PlayState.Stroke]);
    expect(changedCount).toBe(1);
    destroyContainer(container);
  });

  it('clicking bass drum Stroke cycles back to Silence', () => {
    const groove = makeSilentGroove();
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[bdRow]
                          .querySelectorAll('.grid-cell')[0];
    cell.click(); // → Stroke
    cell.click(); // → Silence
    expect(cell.dataset.state).toBe(PlayState.Silence);
    destroyContainer(container);
  });

  it('snare cycles through all 8 states', () => {
    const groove = makeSilentGroove();
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    const snRow = LANE_ORDER_UD.indexOf(Instrument.SnareDrum);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[snRow]
                          .querySelectorAll('.grid-cell')[0];
    const expected = VALID_STATES[Instrument.SnareDrum];

    for (let i = 1; i < expected.length; ++i) {
      cell.click();
      expect(cell.dataset.state).toBe(expected[i]);
    }
    // one more click wraps back to silence
    cell.click();
    expect(cell.dataset.state).toBe(PlayState.Silence);
    destroyContainer(container);
  });

  it('crash cycles: Silence → Stroke → Choke → Silence', () => {
    const groove = makeSilentGroove();
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    const crRow = LANE_ORDER_UD.indexOf(Instrument.Crash);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[crRow]
                          .querySelectorAll('.grid-cell')[0];

    cell.click();
    expect(cell.dataset.state).toBe(PlayState.Stroke);
    cell.click();
    expect(cell.dataset.state).toBe(PlayState.Choke);
    cell.click();
    expect(cell.dataset.state).toBe(PlayState.Silence);
    destroyContainer(container);
  });

  it('clicking updates the model (DrumBit)', () => {
    const groove = makeSilentGroove();
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[bdRow]
                          .querySelectorAll('.grid-cell')[0];
    cell.click(); // Silence → Stroke

    const bit = groove.getBar(0).getDrumBit(BEAT_INDEXES[0]);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    destroyContainer(container);
  });

  it('fires onGrooveChanged callback on each click', () => {
    let callCount = 0;
    const groove = makeSilentGroove();
    const editor = new BarEditor(container, () => { ++callCount; });
    editor.loadGroove(groove);

    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[bdRow]
                          .querySelectorAll('.grid-cell')[0];
    cell.click();
    cell.click();
    cell.click();
    expect(callCount).toBe(3);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Column refresh (mode-switch side-effects)
// ────────────────────────────────────────────────────────────

describe('BarEditor — column refresh on mode switch', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('setting a tom clears hi-hat state in the same column', () => {
    const groove = makeSilentGroove();
    const bar = groove.getBar(0);
    const bit = bar.getDrumBit(NoteIndex.Beat1);
    bit.setInstrument(Instrument.ClosedHiHat, PlayState.Stroke);

    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    // click high tom (should switch DrumBit mode to Toms, clearing hi-hat)
    const htRow = LANE_ORDER_UD.indexOf(Instrument.HighTom);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[htRow]
                          .querySelectorAll('.grid-cell')[0];
    cell.click(); // Silence → Stroke → switches to Toms mode

    // hi-hat cell in same column should now be silence
    const hhRow = LANE_ORDER_UD.indexOf(Instrument.ClosedHiHat);
    const hhCell = container.querySelectorAll('.bar-grid-table tbody tr')[hhRow]
                            .querySelectorAll('.grid-cell')[0];
    expect(hhCell.dataset.state).toBe(PlayState.Silence);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Toolbar counter & navigation
// ────────────────────────────────────────────────────────────

describe('BarEditor — toolbar & navigation', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('displays "Bar 1 / 1" for a single-bar groove', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove(1));
    const counter = container.querySelector('.bar-counter');
    expect(counter.textContent).toBe('Bar 1 / 1');
    destroyContainer(container);
  });

  it('displays "Bar 1 / 3" for a three-bar groove', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove(3));
    const counter = container.querySelector('.bar-counter');
    expect(counter.textContent).toBe('Bar 1 / 3');
    destroyContainer(container);
  });

  it('prev button is disabled on bar 1', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove(3));
    const prev = container.querySelectorAll('.bar-nav-btn')[0];
    expect(prev.disabled).toBe(true);
    destroyContainer(container);
  });

  it('next button navigates to bar 2', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove(3));
    const next = container.querySelectorAll('.bar-nav-btn')[1];
    next.click();
    const counter = container.querySelector('.bar-counter');
    expect(counter.textContent).toBe('Bar 2 / 3');
    destroyContainer(container);
  });

  it('prev button navigates back to bar 1', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove(3));
    const next = container.querySelectorAll('.bar-nav-btn')[1];
    const prev = container.querySelectorAll('.bar-nav-btn')[0];
    next.click(); // → bar 2
    prev.click(); // → bar 1
    const counter = container.querySelector('.bar-counter');
    expect(counter.textContent).toBe('Bar 1 / 3');
    destroyContainer(container);
  });

  it('next button is disabled on last bar', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove(2));
    const next = container.querySelectorAll('.bar-nav-btn')[1];
    next.click(); // → bar 2 (last)
    expect(next.disabled).toBe(true);
    destroyContainer(container);
  });

  it('delete button is disabled when only one bar', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove(1));
    const del = container.querySelector('.bar-del-btn');
    expect(del.disabled).toBe(true);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Bar management (add / duplicate / delete)
// ────────────────────────────────────────────────────────────

describe('BarEditor — bar management', () => {
  let container, changed;

  beforeEach(() => {
    container = makeContainer();
    changed = 0;
  });

  it('Add inserts a new bar after current and advances', () => {
    const groove = makeSilentGroove(1);
    const editor = new BarEditor(container, () => { ++changed; });
    editor.loadGroove(groove);

    const addBtn = container.querySelectorAll('.bar-action-btn')[0]; // first action button = Add
    addBtn.click();

    expect(groove.bars.length).toBe(2);
    const counter = container.querySelector('.bar-counter');
    expect(counter.textContent).toBe('Bar 2 / 2');
    expect(changed).toBe(1);
    destroyContainer(container);
  });

  it('Duplicate copies current bar data and advances', () => {
    const groove = makeSilentGroove(1);
    const bar = groove.getBar(0);
    bar.getDrumBit(NoteIndex.Beat1).setInstrument(Instrument.BassDrum, PlayState.Stroke);

    const editor = new BarEditor(container, () => { ++changed; });
    editor.loadGroove(groove);

    const dupBtn = container.querySelectorAll('.bar-action-btn')[1]; // second action = Dup
    dupBtn.click();

    expect(groove.bars.length).toBe(2);
    // The duplicated bar should have the same bass drum stroke at Beat1
    const newBit = groove.getBar(1).getDrumBit(NoteIndex.Beat1);
    expect(newBit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    expect(changed).toBe(1);
    destroyContainer(container);
  });

  it('Delete removes the current bar', () => {
    const groove = makeSilentGroove(3);
    const editor = new BarEditor(container, () => { ++changed; });
    editor.loadGroove(groove);

    const next = container.querySelectorAll('.bar-nav-btn')[1];
    next.click(); // → bar 2

    const delBtn = container.querySelector('.bar-del-btn');
    delBtn.click();

    expect(groove.bars.length).toBe(2);
    const counter = container.querySelector('.bar-counter');
    // should stay on bar 2 (now last) or clamp
    expect(counter.textContent).toBe('Bar 2 / 2');
    expect(changed).toBe(1);
    destroyContainer(container);
  });

  it('Delete on last bar clamps index', () => {
    const groove = makeSilentGroove(2);
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    const next = container.querySelectorAll('.bar-nav-btn')[1];
    next.click(); // → bar 2

    const delBtn = container.querySelector('.bar-del-btn');
    delBtn.click();

    const counter = container.querySelector('.bar-counter');
    expect(counter.textContent).toBe('Bar 1 / 1');
    destroyContainer(container);
  });

  it('cannot delete the last remaining bar', () => {
    const groove = makeSilentGroove(1);
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    const delBtn = container.querySelector('.bar-del-btn');
    delBtn.click(); // should be no-op

    expect(groove.bars.length).toBe(1);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Navigation shows correct bar data
// ────────────────────────────────────────────────────────────

describe('BarEditor — navigation shows correct data', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('switching bars shows the correct bar content', () => {
    const groove = makeSilentGroove(2);
    // Put bass drum stroke on bar 2, beat 1
    groove.getBar(1).getDrumBit(NoteIndex.Beat1)
          .setInstrument(Instrument.BassDrum, PlayState.Stroke);

    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    // bar 1 — bass drum cell should be silence
    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    const bdCell = () => container.querySelectorAll('.bar-grid-table tbody tr')[bdRow]
                                  .querySelectorAll('.grid-cell')[0];

    expect(bdCell().dataset.state).toBe(PlayState.Silence);

    // navigate to bar 2
    const next = container.querySelectorAll('.bar-nav-btn')[1];
    next.click();
    expect(bdCell().dataset.state).toBe(PlayState.Stroke);

    // navigate back to bar 1
    const prev = container.querySelectorAll('.bar-nav-btn')[0];
    prev.click();
    expect(bdCell().dataset.state).toBe(PlayState.Silence);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// refresh() public method
// ────────────────────────────────────────────────────────────

describe('BarEditor — refresh()', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('refresh updates cells after external model change', () => {
    const groove = makeSilentGroove(1);
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    // externally poke a bass drum stroke
    groove.getBar(0).getDrumBit(NoteIndex.Beat1)
          .setInstrument(Instrument.BassDrum, PlayState.Stroke);
    editor.refresh();

    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[bdRow]
                          .querySelectorAll('.grid-cell')[0];
    expect(cell.dataset.state).toBe(PlayState.Stroke);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Edge cases
// ────────────────────────────────────────────────────────────

describe('BarEditor — edge cases', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('loadGroove resets to bar 0', () => {
    const groove = makeSilentGroove(5);
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    // navigate to bar 3
    for (let i = 0; i < 2; ++i)
      container.querySelectorAll('.bar-nav-btn')[1].click();

    // reload a new groove
    editor.loadGroove(makeSilentGroove(2));
    const counter = container.querySelector('.bar-counter');
    expect(counter.textContent).toBe('Bar 1 / 2');
    destroyContainer(container);
  });

  it('beat-start class is on every 4th column', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const cells = container.querySelectorAll('.bar-grid-table tbody tr:first-child .grid-cell');
    for (let i = 0; i < 16; ++i) {
      if (i % 4 === 0)
        expect(cells[i].classList.contains('beat-start')).toBe(true);
      else
        expect(cells[i].classList.contains('beat-start')).toBe(false);
    }
    destroyContainer(container);
  });

  it('row header colors match INSTRUMENT_COLORS', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const headers = container.querySelectorAll('.grid-row-header');
    for (let i = 0; i < LANE_ORDER_UD.length; ++i)
      expect(headers[i].style.color).toBe(INSTRUMENT_COLORS[LANE_ORDER_UD[i]]);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Instructions banner
// ────────────────────────────────────────────────────────────

describe('BarEditor — instructions banner', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('shows instructions banner on build', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const banner = container.querySelector('.bar-editor-instructions');
    expect(banner).not.toBe(null);
    expect(banner.textContent.length).toBeGreaterThan(0);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Hex serialization row
// ────────────────────────────────────────────────────────────

describe('BarEditor — hex row', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('has 16 hex cells in tfoot', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const hexCells = container.querySelectorAll('.hex-cell');
    expect(hexCells.length).toBe(16);
    destroyContainer(container);
  });

  it('all hex cells show "00" for a silent bar', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const hexCells = container.querySelectorAll('.hex-cell');
    for (const cell of hexCells)
      expect(cell.textContent).toBe('00');
    destroyContainer(container);
  });

  it('hex cell updates when a note is set', () => {
    const groove = makeSilentGroove();
    const bar = groove.getBar(0);
    bar.getDrumBit(NoteIndex.Beat1).setInstrument(Instrument.BassDrum, PlayState.Stroke);

    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    // Beat1 is the first slot in chronological order → col 0
    const hexCells = container.querySelectorAll('.hex-cell');
    expect(hexCells[0].textContent).not.toBe('00');
    destroyContainer(container);
  });

  it('hex cell updates after click', () => {
    const groove = makeSilentGroove();
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(groove);

    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[bdRow]
                          .querySelectorAll('.grid-cell')[0];
    cell.click(); // Silence → Stroke

    const hexCells = container.querySelectorAll('.hex-cell');
    expect(hexCells[0].textContent).not.toBe('00');
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Bar serialization string
// ────────────────────────────────────────────────────────────

describe('BarEditor — bar serial display', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('displays bar serial code element', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const serial = container.querySelector('.bar-serial-code');
    expect(serial).not.toBe(null);
    expect(serial.textContent.length).toBeGreaterThan(0);
    destroyContainer(container);
  });

  it('serial string contains hex bytes', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const serial = container.querySelector('.bar-serial-code');
    expect(serial.textContent).toContain('00');
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Context menu
// ────────────────────────────────────────────────────────────

describe('BarEditor — context menu', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
  });

  it('creates a context menu element in the document body', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const menu = document.querySelector('.bar-context-menu');
    expect(menu).not.toBe(null);
    destroyContainer(container);
    if (menu) menu.remove();
  });

  it('context menu is hidden by default', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());
    const menu = document.querySelector('.bar-context-menu');
    expect(menu.style.display).toBe('none');
    destroyContainer(container);
    if (menu) menu.remove();
  });

  it('right-clicking a cell populates the menu with state items', () => {
    const editor = new BarEditor(container, () => {});
    editor.loadGroove(makeSilentGroove());

    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    const cell = container.querySelectorAll('.bar-grid-table tbody tr')[bdRow]
                          .querySelectorAll('.grid-cell')[0];

    const event = new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 });
    cell.dispatchEvent(event);

    const menu = document.querySelector('.bar-context-menu');
    expect(menu.style.display).toBe('block');
    const items = menu.querySelectorAll('.ctx-item');
    expect(items.length).toBeGreaterThan(0);

    // Clean up
    editor._closeContextMenu();
    destroyContainer(container);
    if (menu) menu.remove();
  });
});

// ────────────────────────────────────────────────────────────
// Clear operations
// ────────────────────────────────────────────────────────────

describe('BarEditor — clear operations', () => {
  let container, changed;

  beforeEach(() => {
    container = makeContainer();
    changed = 0;
  });

  it('clearColumn sets the column to silence', () => {
    const groove = makeSilentGroove();
    const bar = groove.getBar(0);
    bar.getDrumBit(NoteIndex.Beat1).setInstrument(Instrument.BassDrum, PlayState.Stroke);
    bar.getDrumBit(NoteIndex.Beat1).setInstrument(Instrument.ClosedHiHat, PlayState.Stroke);

    const editor = new BarEditor(container, () => { ++changed; });
    editor.loadGroove(groove);
    editor._clearColumn(0);

    const bit = groove.getBar(0).getDrumBit(NoteIndex.Beat1);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Silence);
    expect(changed).toBe(1);
    destroyContainer(container);
  });

  it('clearRow silences one instrument across all 16 slots', () => {
    const groove = makeSilentGroove();
    const bar = groove.getBar(0);
    bar.getDrumBit(NoteIndex.Beat1).setInstrument(Instrument.BassDrum, PlayState.Stroke);
    bar.getDrumBit(NoteIndex.Beat2).setInstrument(Instrument.BassDrum, PlayState.Stroke);
    bar.getDrumBit(NoteIndex.Beat3).setInstrument(Instrument.BassDrum, PlayState.Stroke);

    const editor = new BarEditor(container, () => { ++changed; });
    editor.loadGroove(groove);
    const bdRow = LANE_ORDER_UD.indexOf(Instrument.BassDrum);
    editor._clearRow(bdRow);

    expect(bar.getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
    expect(bar.getDrumBit(NoteIndex.Beat2).getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
    expect(bar.getDrumBit(NoteIndex.Beat3).getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
    expect(changed).toBe(1);
    destroyContainer(container);
  });

  it('clearBar resets all 16 slots to silence', () => {
    const groove = makeSilentGroove();
    const bar = groove.getBar(0);
    for (let i = 0; i < 4; ++i)
      bar.getDrumBit(i).setInstrument(Instrument.BassDrum, PlayState.Stroke);

    const editor = new BarEditor(container, () => { ++changed; });
    editor.loadGroove(groove);
    editor._clearBar();

    for (let i = 0; i < 16; ++i) {
      const bit = bar.getDrumBit(i);
      expect(bit.bitPattern).toBe(0);
    }
    expect(changed).toBe(1);
    destroyContainer(container);
  });
});

// ────────────────────────────────────────────────────────────
// Copy / Paste bar
// ────────────────────────────────────────────────────────────

describe('BarEditor — copy / paste', () => {
  let container, changed;

  beforeEach(() => {
    container = makeContainer();
    changed = 0;
  });

  it('copy stores a bar clone in the clipboard', () => {
    const groove = makeSilentGroove();
    groove.getBar(0).getDrumBit(NoteIndex.Beat1).setInstrument(Instrument.BassDrum, PlayState.Stroke);

    const editor = new BarEditor(container, () => { ++changed; });
    editor.loadGroove(groove);
    editor._copyBar();

    expect(editor._copiedBar).not.toBe(null);
    expect(editor._copiedBar.getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    destroyContainer(container);
  });

  it('paste inserts a copy after current bar', () => {
    const groove = makeSilentGroove();
    groove.getBar(0).getDrumBit(NoteIndex.Beat1).setInstrument(Instrument.BassDrum, PlayState.Stroke);

    const editor = new BarEditor(container, () => { ++changed; });
    editor.loadGroove(groove);
    editor._copyBar();
    editor._pasteBar();

    expect(groove.bars.length).toBe(2);
    expect(groove.getBar(1).getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    expect(changed).toBe(1);
    destroyContainer(container);
  });

  it('paste does nothing when clipboard is empty', () => {
    const groove = makeSilentGroove();
    const editor = new BarEditor(container, () => { ++changed; });
    editor.loadGroove(groove);
    editor._pasteBar();

    expect(groove.bars.length).toBe(1);
    expect(changed).toBe(0);
    destroyContainer(container);
  });
});

})();
