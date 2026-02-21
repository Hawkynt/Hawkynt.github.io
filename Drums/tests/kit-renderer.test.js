// SynthelicZ Drums — Kit Renderer Tests
// Tests for the procedural SVG drum kit renderer.

(function () {
'use strict';

const { describe, it, expect, beforeEach } = window.TestRunner;
const { INSTRUMENT_COLORS, INSTRUMENT_SHORT, INSTRUMENT_LABEL, INSTRUMENT_X, INSTRUMENT_Y, LANE_ORDER_UD, LANE_ORDER_LR, KitRenderer, Instrument, PlayState } = window.SZDrums;

// ── Exported constants ─────────────────────────────────────

describe('KitRenderer — INSTRUMENT_COLORS', () => {

  it('has a color entry for every instrument', () => {
    for (const instr of Object.values(Instrument))
      expect(INSTRUMENT_COLORS[instr]).toBeTruthy();
  });

  it('every color is a CSS hex string starting with #', () => {
    for (const color of Object.values(INSTRUMENT_COLORS))
      expect(color[0]).toBe('#');
  });
});

describe('KitRenderer — INSTRUMENT_SHORT', () => {

  it('has a short label for every instrument', () => {
    for (const instr of Object.values(Instrument))
      expect(INSTRUMENT_SHORT[instr]).toBeTruthy();
  });

  it('all values are short strings (1-2 characters)', () => {
    for (const label of Object.values(INSTRUMENT_SHORT)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThanOrEqual(1);
      expect(label.length).toBeLessThanOrEqual(2);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(INSTRUMENT_SHORT)).toBe(true);
  });
});

describe('KitRenderer — INSTRUMENT_LABEL', () => {

  it('has a label for every instrument', () => {
    for (const instr of Object.values(Instrument))
      expect(INSTRUMENT_LABEL[instr]).toBeTruthy();
  });

  it('all values are non-empty strings', () => {
    for (const label of Object.values(INSTRUMENT_LABEL)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(INSTRUMENT_LABEL)).toBe(true);
  });
});

describe('KitRenderer — INSTRUMENT_Y', () => {

  it('has a Y-ratio for the same instruments as COLORS', () => {
    for (const key of Object.keys(INSTRUMENT_COLORS))
      expect(typeof INSTRUMENT_Y[key]).toBe('number');
  });

  it('all Y-ratios are between 0 and 1', () => {
    for (const y of Object.values(INSTRUMENT_Y)) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(1);
    }
  });
});

describe('KitRenderer — INSTRUMENT_X', () => {

  it('has an X-ratio for the same instruments as COLORS', () => {
    for (const key of Object.keys(INSTRUMENT_COLORS))
      expect(typeof INSTRUMENT_X[key]).toBe('number');
  });

  it('all X-ratios are between 0 and 1', () => {
    for (const x of Object.values(INSTRUMENT_X)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(INSTRUMENT_X)).toBe(true);
  });
});

describe('KitRenderer — LANE_ORDER_UD', () => {

  it('contains all instruments including RideBell', () => {
    expect(LANE_ORDER_UD.length).toBe(11);
  });

  it('includes all standard Instrument enum values', () => {
    for (const instr of Object.values(Instrument))
      expect(LANE_ORDER_UD).toContain(instr);
  });

  it('is sorted by cy (top to bottom)', () => {
    for (let i = 1; i < LANE_ORDER_UD.length; ++i) {
      const prevY = INSTRUMENT_Y[LANE_ORDER_UD[i - 1]];
      const currY = INSTRUMENT_Y[LANE_ORDER_UD[i]];
      expect(currY).toBeGreaterThanOrEqual(prevY);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(LANE_ORDER_UD)).toBe(true);
  });
});

describe('KitRenderer — LANE_ORDER_LR', () => {

  it('contains all instruments including RideBell', () => {
    expect(LANE_ORDER_LR.length).toBe(11);
  });

  it('includes all standard Instrument enum values', () => {
    for (const instr of Object.values(Instrument))
      expect(LANE_ORDER_LR).toContain(instr);
  });

  it('is sorted by cx (left to right)', () => {
    for (let i = 1; i < LANE_ORDER_LR.length; ++i) {
      const prevX = INSTRUMENT_X[LANE_ORDER_LR[i - 1]];
      const currX = INSTRUMENT_X[LANE_ORDER_LR[i]];
      expect(currX).toBeGreaterThanOrEqual(prevX);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(LANE_ORDER_LR)).toBe(true);
  });

  it('has the same instruments as LANE_ORDER_UD', () => {
    for (const instr of LANE_ORDER_UD)
      expect(LANE_ORDER_LR).toContain(instr);

    for (const instr of LANE_ORDER_LR)
      expect(LANE_ORDER_UD).toContain(instr);
  });

  it('starts with hi-hat family on the left', () => {
    expect(LANE_ORDER_LR[0]).toBe(Instrument.ClosedHiHat);
  });
});

// ── SVG construction ───────────────────────────────────────

describe('KitRenderer — SVG construction', () => {

  let container;
  let renderer;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderer = new KitRenderer(container, () => {});
  });

  it('replaces container innerHTML with an SVG element', () => {
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.id).toBe('drum-kit-svg');
  });

  it('SVG has correct viewBox', () => {
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 400 300');
  });

  it('creates a kit-pad group for each instrument in KIT_PIECES', () => {
    const pads = container.querySelectorAll('.kit-pad');
    expect(pads.length).toBe(11);
  });

  it('contains hardware stand lines', () => {
    const hardware = container.querySelector('.kit-hardware');
    expect(hardware).not.toBeNull();
    const lines = hardware.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('includes a glow-filter definition', () => {
    const filter = container.querySelector('#glow-filter');
    expect(filter).not.toBeNull();
  });

  it('each pad has a data-instrument attribute', () => {
    const pads = container.querySelectorAll('.kit-pad');
    for (const pad of pads)
      expect(pad.getAttribute('data-instrument')).toBeTruthy();
  });

  it('each pad has a label text element', () => {
    const pads = container.querySelectorAll('.kit-pad');
    for (const pad of pads)
      expect(pad.querySelector('text')).not.toBeNull();
  });
});

// ── Hit animation ──────────────────────────────────────────

describe('KitRenderer — triggerHit', () => {

  let container;
  let renderer;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderer = new KitRenderer(container, () => {});
  });

  it('adds .hit class to the pad on triggerHit', () => {
    renderer.triggerHit(Instrument.SnareDrum);
    const pad = container.querySelector(`[data-instrument="${Instrument.SnareDrum}"]`);
    expect(pad.classList.contains('hit')).toBe(true);
  });

  it('handles unknown instrument without throwing', () => {
    renderer.triggerHit('nonexistent-instrument');
    // should simply not throw
    expect(true).toBe(true);
  });

  it('triggers OpenHiHat on its own dedicated pad', () => {
    renderer.triggerHit(Instrument.OpenHiHat);
    const ohPad = container.querySelector(`[data-instrument="${Instrument.OpenHiHat}"]`);
    expect(ohPad.classList.contains('hit')).toBe(true);
  });
});

// ── triggerInstruments batch ────────────────────────────────

describe('KitRenderer — triggerInstruments', () => {

  let container;
  let renderer;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    renderer = new KitRenderer(container, () => {});
  });

  it('triggers hits for non-silent instruments', () => {
    const states = new Map([
      [Instrument.BassDrum, PlayState.Stroke],
      [Instrument.ClosedHiHat, PlayState.Silence],
      [Instrument.SnareDrum, PlayState.Accent],
    ]);
    renderer.triggerInstruments(states);

    const kick = container.querySelector(`[data-instrument="${Instrument.BassDrum}"]`);
    expect(kick.classList.contains('hit')).toBe(true);

    const snare = container.querySelector(`[data-instrument="${Instrument.SnareDrum}"]`);
    expect(snare.classList.contains('hit')).toBe(true);

    const hh = container.querySelector(`[data-instrument="${Instrument.ClosedHiHat}"]`);
    expect(hh.classList.contains('hit')).toBe(false);
  });
});

// ── Click callback ─────────────────────────────────────────

describe('KitRenderer — pad click callback', () => {

  it('calls onPadClick with the instrument id on pointerdown', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    let clicked = null;
    const renderer = new KitRenderer(container, (instr) => { clicked = instr; });

    const pad = container.querySelector(`[data-instrument="${Instrument.Crash}"]`);
    pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(clicked).toBe(Instrument.Crash);
  });
});

// ── getPadScreenPosition ───────────────────────────────────

describe('KitRenderer — getPadScreenPosition', () => {

  it('returns {x, y} for a valid instrument', () => {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.body.appendChild(container);
    const renderer = new KitRenderer(container, () => {});
    const pos = renderer.getPadScreenPosition(Instrument.SnareDrum);
    expect(pos).not.toBeNull();
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  it('returns null for an unknown instrument', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderer = new KitRenderer(container, () => {});
    const pos = renderer.getPadScreenPosition('nonexistent');
    expect(pos).toBeNull();
  });

  it('returns a position for every known instrument', () => {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.body.appendChild(container);
    const renderer = new KitRenderer(container, () => {});
    for (const instr of Object.values(Instrument)) {
      const pos = renderer.getPadScreenPosition(instr);
      expect(pos).not.toBeNull();
    }
  });
});

})();
