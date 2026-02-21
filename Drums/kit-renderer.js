// SynthelicZ Drums — SVG Drum Kit Renderer
// Procedural SVG drum kit with clickable hit-zones and hit animations.

(function (ns) {
'use strict';

const { Instrument, PlayState } = ns;

// ── Instrument visual definitions ──────────────────────────
// Positions are derived from a 10×10 matrix: the x-axis uses the left-to-right
// lane order (matching the physical kit) and the y-axis uses the top-to-bottom
// staff order.  ViewBox is 400×300; we map column/row indices to
// cx = round(30 + col * 37.78) and cy = round(20 + row * 28.89).
//
//        LR order (col): HH OH CH SN CR HT BD MD LT RI   (0–9)
//        TB order (row): CR OH HH RI HT MT SN LT BD CH   (0–9)
//
// This produces a realistic kit layout: hi-hat family left, ride right,
// cymbals high, kick low, pedal at the bottom-left.

const KIT_PIECES = Object.freeze([
  { id: Instrument.ClosedHiHat, label: 'Hi-Hat',    short: 'HH', cx:  60, cy:  70, rx: 36, ry: 10, color: ['#b2ff59', '#4a8c00'], type: 'cymbal' },
  { id: Instrument.OpenHiHat,   label: 'Open HH',   short: 'OH', cx:  60, cy:  60, rx: 36, ry: 10, color: ['#a5d6a7', '#2e7d32'], type: 'cymbal' },
  { id: Instrument.HiHatPedal,  label: 'Pedal',     short: 'HP', cx: 100, cy: 280, rx: 16, ry: 8,  color: ['#69f0ae', '#00894a'], type: 'pedal'  },
  { id: Instrument.SnareDrum,   label: 'Snare',     short: 'SN', cx: 140, cy: 160, rx: 36, ry: 22, color: ['#ff5252', '#c62828'], type: 'drum'   },
  { id: Instrument.Crash,       label: 'Crash',     short: 'CR', cx: 180, cy:  40, rx: 48, ry: 12, color: ['#ffd740', '#b8860b'], type: 'cymbal' },
  { id: Instrument.HighTom,     label: 'Hi Tom',    short: 'HT', cx: 220, cy: 120, rx: 30, ry: 20, color: ['#40c4ff', '#0277bd'], type: 'drum'   },
  { id: Instrument.BassDrum,    label: 'Bass-Drum', short: 'BD', cx: 260, cy: 260, rx: 56, ry: 40, color: ['#ff6e40', '#bf360c'], type: 'drum'   },
  { id: Instrument.MidTom,      label: 'Mid Tom',   short: 'MT', cx: 300, cy: 140, rx: 30, ry: 20, color: ['#448aff', '#1a47b8'], type: 'drum'   },
  { id: Instrument.FloorTom,    label: 'Floor Tom', short: 'FT', cx: 340, cy: 180, rx: 38, ry: 24, color: ['#7c4dff', '#4a148c'], type: 'drum'   },
  { id: Instrument.RideBell,    label: 'Ride Bell', short: 'RB', cx: 380, cy:  90, rx: 48, ry: 12, color: ['#ffcb86', '#884a03'], type: 'cymbal' },
  { id: Instrument.Ride,        label: 'Ride',      short: 'RD', cx: 380, cy: 100, rx: 48, ry: 12, color: ['#ffab40', '#c66900'], type: 'cymbal' },
]);

// lane-color map exported for use by lane-renderer.
// All 10 instruments are now in KIT_PIECES, so the spread covers everything.
// RideBell shares the Ride pad — same color.
const INSTRUMENT_COLORS = Object.freeze({
  ...Object.fromEntries(KIT_PIECES.map(p => [p.id, p.color[0]]))
});

// ── Light-mode instrument colors (darker / more saturated for white backgrounds)
const INSTRUMENT_COLORS_LIGHT = Object.freeze({
  ...Object.fromEntries(KIT_PIECES.map(p => [p.id, p.color[1]]))
});

// ── Short instrument labels (2-char abbreviations) ───────────
const INSTRUMENT_SHORT = Object.freeze({
  ...Object.fromEntries(KIT_PIECES.map(p => [p.id, p.short]))
});

// ── Full instrument labels ───────────────────────────────────
const INSTRUMENT_LABEL = Object.freeze({
  ...Object.fromEntries(KIT_PIECES.map(p => [p.id, p.label]))
});

// ── Horizontal position for the lane renderer ───────────────────
// Derived from the SVG cx / viewBox-width (400) so that the lane's
// horizontal proportions match the drum-kit SVG exactly.
const INSTRUMENT_X = Object.freeze({
  ...Object.fromEntries(KIT_PIECES.map(p => [p.id, p.cx / 400]))
});


// ── Vertical position for the sheet belt ───────────────────
// Derived from the SVG cy / viewBox-height (300) so that the belt's
// vertical proportions match the drum-kit SVG exactly.
const INSTRUMENT_Y = Object.freeze({
  ...Object.fromEntries(KIT_PIECES.map(p => [p.id, p.cy / 300]))
});

// Ordered list of instruments for the bar editor & sheet-belt labels
// (top → bottom, derived from cy position in KIT_PIECES)
const LANE_ORDER_UD = Object.freeze(
  [...KIT_PIECES].sort((a, b) => a.cy - b.cy).map(p => p.id)
);

// Ordered list for the falling-lane renderer (left → right matching the
// physical drum kit layout, derived from cx position in KIT_PIECES)
const LANE_ORDER_LR = Object.freeze(
  [...KIT_PIECES].sort((a, b) => a.cx - b.cx).map(p => p.id)
);

// ── SVG namespace ──────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

const _el = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs))
    e.setAttribute(k, v);
  return e;
};

// ── Kit Renderer class ─────────────────────────────────────

class KitRenderer {

  /** @param {HTMLElement} container — the #kit-viewport element */
  constructor(container, onPadClick) {
    this._container = container;
    this._onPadClick = onPadClick ?? (() => {});
    this._pads = new Map();     // Instrument → SVG group
    this._timeouts = new Map(); // Instrument → timeout id
    this._build();
  }

  // ── Build the SVG ──────────────────────────────────────

  _build() {
    // remove any existing content (e.g. the <img>)
    this._container.innerHTML = '';

    const svg = _el('svg', {
      viewBox: '0 0 400 300',
      preserveAspectRatio: 'xMidYMid meet',
      width: '100%',
      height: '100%',
      id: 'drum-kit-svg',
    });

    // background
    svg.appendChild(_el('rect', {
      x: 0, y: 0, width: 400, height: 300,
      fill: 'transparent',
    }));

    // glow filter definition
    const defs = _el('defs');
    const filter = _el('filter', { id: 'glow-filter', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    const blur = _el('feGaussianBlur', { stdDeviation: '4', result: 'coloredBlur' });
    filter.appendChild(blur);
    const merge = _el('feMerge');
    merge.appendChild(_el('feMergeNode', { in: 'coloredBlur' }));
    merge.appendChild(_el('feMergeNode', { in: 'SourceGraphic' }));
    filter.appendChild(merge);
    defs.appendChild(filter);
    svg.appendChild(defs);

    // hardware: hi-hat stand, kick pedal, cymbal stands
    svg.appendChild(this._buildHardware());

    // kit pieces (all 10 instruments have their own pad)
    for (const piece of KIT_PIECES) {
      const group = this._buildPad(piece);
      svg.appendChild(group);
      this._pads.set(piece.id, group);
    }

    this._container.appendChild(svg);
  }

  _buildHardware() {
    const g = _el('g', { class: 'kit-hardware', opacity: '0.25' });
    const p = (id) => KIT_PIECES.find(k => k.id === id);

    const CH = p(Instrument.ClosedHiHat);
    const OH = p(Instrument.OpenHiHat);
    const HP = p(Instrument.HiHatPedal);
    const CR = p(Instrument.Crash);
    const RI = p(Instrument.Ride);
    const BD = p(Instrument.BassDrum);
    const SN = p(Instrument.SnareDrum);
    const FT = p(Instrument.FloorTom);

    const standBottom = 300 - 32;

    // hi-hat stand (from closed hi-hat cymbal down to near bottom)
    g.appendChild(_el('line', { x1: CH.cx, y1: CH.cy - CH.ry, x2: CH.cx, y2: standBottom, stroke: '#888', 'stroke-width': 2 }));
    // hi-hat rod to pedal
    g.appendChild(_el('line', { x1: CH.cx, y1: standBottom, x2: HP.cx, y2: HP.cy, stroke: '#888', 'stroke-width': 2 }));
    // open hi-hat arm (angled bracket from OH cymbal down to HH stand)
    g.appendChild(_el('line', { x1: OH.cx, y1: OH.cy + OH.ry, x2: CH.cx, y2: CH.cy - CH.ry, stroke: '#888', 'stroke-width': 1.5 }));
    // crash stand (from below the cymbal down to the floor)
    g.appendChild(_el('line', { x1: CR.cx, y1: CR.cy + CR.ry, x2: CR.cx, y2: standBottom, stroke: '#888', 'stroke-width': 2 }));
    // ride stand (from below the cymbal down to the floor)
    g.appendChild(_el('line', { x1: RI.cx, y1: RI.cy + RI.ry, x2: RI.cx, y2: standBottom, stroke: '#888', 'stroke-width': 2 }));
    // kick pedal
    g.appendChild(_el('line', { x1: BD.cx, y1: BD.cy + BD.ry, x2: BD.cx, y2: BD.cy + BD.ry + 7, stroke: '#aaa', 'stroke-width': 3 }));
    // snare stand
    g.appendChild(_el('line', { x1: SN.cx, y1: SN.cy + SN.ry, x2: SN.cx, y2: SN.cy + SN.ry + 50, stroke: '#888', 'stroke-width': 2 }));
    // floor tom legs
    g.appendChild(_el('line', { x1: FT.cx - FT.rx / 2, y1: FT.cy + FT.ry, x2: FT.cx - FT.rx / 2 - 10, y2: standBottom, stroke: '#888', 'stroke-width': 2 }));
    g.appendChild(_el('line', { x1: FT.cx + FT.rx / 2, y1: FT.cy + FT.ry, x2: FT.cx + FT.rx / 2 + 10, y2: standBottom, stroke: '#888', 'stroke-width': 2 }));

    return g;
  }

  _buildPad(piece) {
    const color = piece.color[0];
    const g = _el('g', {
      class: 'kit-pad',
      'data-instrument': piece.id,
      style: `transform-origin: ${piece.cx}px ${piece.cy}px; cursor: pointer;`,
    });

    if (piece.type === 'cymbal') {
      // outer ring
      g.appendChild(_el('ellipse', {
        cx: piece.cx, cy: piece.cy, rx: piece.rx, ry: piece.ry,
        fill: 'none', stroke: color, 'stroke-width': 2, opacity: '0.6',
      }));
      // inner fill
      g.appendChild(_el('ellipse', {
        cx: piece.cx, cy: piece.cy, rx: piece.rx * 0.85, ry: piece.ry * 0.85,
        fill: color, opacity: '0.18',
      }));
      // bell
      g.appendChild(_el('ellipse', {
        cx: piece.cx, cy: piece.cy, rx: 6, ry: 4,
        fill: color, opacity: '0.5',
      }));
    } else if (piece.type === 'pedal') {
      // pedal board (rounded rectangle)
      g.appendChild(_el('rect', {
        x: piece.cx - piece.rx, y: piece.cy - piece.ry,
        width: piece.rx * 2, height: piece.ry * 2,
        rx: 3, fill: color, opacity: '0.25',
        stroke: color, 'stroke-width': 1.5,
      }));
      // hinge dot
      g.appendChild(_el('circle', {
        cx: piece.cx, cy: piece.cy - piece.ry + 3, r: 2,
        fill: color, opacity: '0.5',
      }));
    } else {
      // drum shell (side)
      const shellDepth = piece.id === Instrument.BassDrum ? 35 : 14;
      g.appendChild(_el('ellipse', {
        cx: piece.cx, cy: piece.cy + shellDepth, rx: piece.rx, ry: piece.ry * 0.6,
        fill: color, opacity: '0.12',
      }));
      g.appendChild(_el('rect', {
        x: piece.cx - piece.rx, y: piece.cy,
        width: piece.rx * 2, height: shellDepth,
        fill: color, opacity: '0.10', rx: 2,
      }));
      // drum head (top ellipse)
      g.appendChild(_el('ellipse', {
        cx: piece.cx, cy: piece.cy, rx: piece.rx, ry: piece.ry,
        fill: color, opacity: '0.15',
        stroke: color, 'stroke-width': 2,
      }));
      // head highlight
      g.appendChild(_el('ellipse', {
        cx: piece.cx, cy: piece.cy - 2, rx: piece.rx * 0.6, ry: piece.ry * 0.5,
        fill: color, opacity: '0.08',
      }));
    }

    // glow filter on hit (applied via class)
    const glow = _el('ellipse', {
      cx: piece.cx, cy: piece.cy, rx: piece.rx + 6, ry: piece.ry + 4,
      fill: color, opacity: '0', class: 'pad-glow',
      filter: `url(#glow-filter)`,
    });
    g.appendChild(glow);

    // label
    const label = _el('text', {
      x: piece.cx, y: piece.cy + 4,
      fill: '#ccc', 'font-size': '9', 'text-anchor': 'middle',
      'font-family': 'system-ui, sans-serif', 'pointer-events': 'none',
      opacity: '0.6',
    });
    label.textContent = piece.label;
    g.appendChild(label);

    // click handler
    g.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.triggerHit(piece.id);
      this._onPadClick(piece.id);
    });

    return g;
  }

  // ── Hit animation ──────────────────────────────────────

  triggerHit(instrument) {
    // RideBell shares the Ride pad
    const resolved = instrument === Instrument.RideBell ? Instrument.Ride : instrument;
    const pad = this._pads.get(resolved);
    if (!pad)
      return;

    // clear previous animation timeout
    const prev = this._timeouts.get(instrument);
    if (prev)
      clearTimeout(prev);

    // apply hit class
    pad.classList.add('hit');

    // animate the glow ellipse
    const glow = pad.querySelector('.pad-glow');
    if (glow) {
      glow.setAttribute('opacity', '0.55');
      glow.style.transition = 'opacity 0.3s ease-out';
      requestAnimationFrame(() => {
        glow.style.transition = 'opacity 0.3s ease-out';
        glow.setAttribute('opacity', '0');
      });
    }

    // remove hit class after animation
    const timeout = setTimeout(() => {
      pad.classList.remove('hit');
      this._timeouts.delete(instrument);
    }, 180);
    this._timeouts.set(instrument, timeout);
  }

  // ── Batch trigger (from playback event) ────────────────

  triggerInstruments(instrumentPlayStates) {
    for (const [instrument, state] of instrumentPlayStates) {
      if (state !== PlayState.Silence)
        this.triggerHit(instrument);
    }
  }

  // ── Screen-position helper (for flying-note overlay) ───

  /**
   * Returns the meet-scaling layout: scale factor and container-relative
   * offsets that account for preserveAspectRatio="xMidYMid meet" centering.
   * Other renderers use this to align their positions with the kit pads.
   *
   * @returns {{scale:number, offsetX:number, offsetY:number}|null}
   */
  getLayout() {
    const svg = this._container.querySelector('svg');
    if (!svg)
      return null;

    const svgRect = svg.getBoundingClientRect();
    const scale = Math.min(svgRect.width / 400, svgRect.height / 300);
    return {
      scale,
      offsetX: (svgRect.width - 400 * scale) / 2,
      offsetY: (svgRect.height - 300 * scale) / 2,
    };
  }

  /**
   * Returns the pad centre in CSS-pixel screen coordinates.
   * Accounts for the SVG's preserveAspectRatio="xMidYMid meet"
   * letter-boxing so that projectiles land exactly on the pad.
   *
   * @param  {string} instrument — Instrument enum value
   * @returns {{x:number, y:number}|null}
   */
  getPadScreenPosition(instrument) {
    // RideBell shares the Ride pad
    const resolved = instrument === Instrument.RideBell ? Instrument.Ride : instrument;
    const piece = KIT_PIECES.find(p => p.id === resolved);
    if (!piece)
      return null;

    const layout = this.getLayout();
    if (!layout)
      return null;

    const svgRect = this._container.querySelector('svg').getBoundingClientRect();
    return {
      x: svgRect.left + layout.offsetX + piece.cx * layout.scale,
      y: svgRect.top + layout.offsetY + piece.cy * layout.scale,
    };
  }
}

ns.KitRenderer = KitRenderer;
ns.INSTRUMENT_COLORS = INSTRUMENT_COLORS;
ns.INSTRUMENT_COLORS_LIGHT = INSTRUMENT_COLORS_LIGHT;
ns.INSTRUMENT_SHORT = INSTRUMENT_SHORT;
ns.INSTRUMENT_LABEL = INSTRUMENT_LABEL;
ns.INSTRUMENT_X = INSTRUMENT_X;
ns.INSTRUMENT_Y = INSTRUMENT_Y;
ns.LANE_ORDER_UD = LANE_ORDER_UD;
ns.LANE_ORDER_LR = LANE_ORDER_LR;

})(window.SZDrums = window.SZDrums || {});
