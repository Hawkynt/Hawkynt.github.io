// SynthelicZ Drums — Guitar-Hero Falling-Lane Renderer
// Draws colored note gems falling downward through per-instrument lanes on a <canvas>.

(function (ns) {
'use strict';

const { Instrument, PlayState, LANE_ORDER_UD, LANE_ORDER_LR, INSTRUMENT_COLORS, INSTRUMENT_COLORS_LIGHT, INSTRUMENT_SHORT, INSTRUMENT_X, AbcConverter } = ns;

// ── Constants ──────────────────────────────────────────────

const HIT_LINE_Y_RATIO = 0.92;          // how far down the hit-line sits (0–1)
const LOOK_AHEAD_BEATS = 4;             // how many beats of notes are visible above hit-line
const GEM_HEIGHT = 10;
const GEM_RADIUS = 5;
const GEM_HALF_W = 14;                  // half-width of a gem (pixels)
const HIT_FLASH_MS = 160;

// Fallback colors if instrument not in map
const DEFAULT_COLOR = '#888';

// ── Note event representation ──────────────────────────────

/**
 * @typedef {Object} LaneNote
 * @property {string}  instrument   — Instrument enum value
 * @property {string}  playState    — PlayState enum value
 * @property {number}  beatTime     — absolute beat position (0-based from groove start)
 * @property {boolean} hit          — has this note been "consumed" by the hit-line?
 */

// ── Lane Renderer class ────────────────────────────────────

class LaneRenderer {

  /**
   * @param {HTMLCanvasElement} canvas      — the #lane-canvas element
   * @param {Function}          onNoteFired — callback(instrument, screenX, screenY) when a gem crosses the hit-line
   */
  constructor(canvas, onNoteFired) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._notes = [];         // LaneNote[]
    this._currentBeat = 0;    // fractional beat position during playback (interpolated for display)
    this._eventBeat = 0;      // beat from last setCurrentBeat (for crossing detection)
    this._totalBeats = 0;     // total beats in groove (for repeat wrap detection)
    this._bpm = 60;
    this._playing = false;
    this._lastBeatTime = 0;   // timestamp of last setCurrentBeat call
    this._lastBeat = 0;       // beat value at that timestamp
    this._playbackRate = 0;   // beats-per-ms, set by controller from abcjs event timing
    this._hitFlashes = new Map(); // instrument → timestamp of last hit
    this._onNoteFired = onNoteFired ?? (() => {});
    this._lightMode = false;

    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(canvas.parentElement);
    this._handleResize();
  }

  // ── Public API ─────────────────────────────────────────

  /** Load a DrumGroove and flatten all notes into LaneNote[] */
  loadGroove(groove) {
    this._notes = [];
    this._totalBeats = groove ? groove.bars.length * 4 : 0;
    if (!groove)
      return;

    const beatIndexOrder = AbcConverter._beatIndexes;   // chronological 16th-note order

    for (let barIdx = 0; barIdx < groove.bars.length; ++barIdx) {
      const bar = groove.bars[barIdx];
      for (let slotIdx = 0; slotIdx < beatIndexOrder.length; ++slotIdx) {
        const storageIdx = beatIndexOrder[slotIdx];
        const drumBit = bar.getDrumBit(storageIdx);
        if (!drumBit)
          continue;

        const beatTime = barIdx * 4 + slotIdx / 4; // 16 slots = 4 beats

        for (const instrument of LANE_ORDER_UD) {
          const state = drumBit.getInstrument(instrument);
          if (state !== PlayState.Silence)
            this._notes.push({ instrument, playState: state, beatTime, hit: false });
        }
      }
    }
  }

  /** Set playback position (in beats, fractional) */
  setCurrentBeat(beat) {
    const prev = this._eventBeat;
    this._eventBeat = beat;
    this._currentBeat = beat;
    this._lastBeat = beat;
    this._lastBeatTime = performance.now();

    if (!this._playing) return;

    const delta = beat - prev;
    if (delta >= 0 && delta < 2) {
      for (const note of this._notes)
        if (note.beatTime > prev && note.beatTime <= beat)
          this._fireNote(note);
    } else if (delta < -(this._totalBeats / 2) && this._totalBeats > 0) {
      // Genuine loop wrap — backward jump ≥ half the groove length.
      // Small negative deltas from onEvent/onBeat interleaving jitter are ignored.
      for (const note of this._notes)
        if (note.beatTime > prev || note.beatTime <= beat)
          this._fireNote(note);
    }
  }

  /** Fallback BPM (used before abcjs sends any events). */
  setBpm(bpm) { this._bpm = Math.max(30, Math.min(300, bpm)); }

  /** Actual playback rate in beats-per-ms, derived from abcjs event timing by the controller. */
  setPlaybackRate(beatsPerMs) { this._playbackRate = beatsPerMs; }

  setPlaying(playing) {
    this._playing = playing;
    if (playing)
      this._lastBeatTime = performance.now();
    else
      this._lastBeatTime = 0;   // freeze position — no interpolation drift while stopped
  }

  /** Register a hit-flash for visual feedback */
  flashHit(instrument) {
    this._hitFlashes.set(instrument, performance.now());
  }

  setLightMode(on) { this._lightMode = !!on; }

  /** Accept the kit SVG's meet-scaling layout so gem X positions match the pads. */
  setKitLayout(layout) { this._kitLayout = layout; }

  /** Call from rAF loop */
  render(now) {
    const { _canvas: canvas, _ctx: ctx } = this;
    const W = canvas._logicalW || canvas.width;
    const H = canvas._logicalH || canvas.height;
    if (W === 0 || H === 0)
      return;

    // Smooth interpolation: advance beat based on elapsed time since last update.
    // Cap extrapolation so the display freezes quickly if updates stop unexpectedly.
    // The cap scales with playback rate: at slow warp (e.g. 10%) onBeat arrives
    // less frequently, so we need a larger window.  0.125 / rate ≈ 2 onBeat intervals.
    if (this._playing && this._lastBeatTime > 0) {
      const rate = this._playbackRate > 0 ? this._playbackRate : (this._bpm / 60000);
      const maxExtrap = rate > 0 ? Math.max(150, 0.125 / rate) : 150;
      const elapsed = Math.min(now - this._lastBeatTime, maxExtrap);
      this._currentBeat = this._lastBeat + elapsed * rate;
    }

    ctx.clearRect(0, 0, W, H);

    const hitLineY = H * HIT_LINE_Y_RATIO;
    const pixelsPerBeat = (hitLineY) / LOOK_AHEAD_BEATS;
    const gemW = GEM_HALF_W * 2;
    const colorMap = this._lightMode ? INSTRUMENT_COLORS_LIGHT : INSTRUMENT_COLORS;

    // Kit-aligned X positioning: use the same meet-scaling as the SVG kit
    const kit = this._kitLayout;
    const xScale = kit ? 400 * kit.scale : W;
    const xOff = kit ? kit.offsetX : 0;
    const _x = (instr) => xOff + (INSTRUMENT_X[instr] ?? 0.5) * xScale;

    // ── draw lane indicator lines ────────────────────────
    ctx.lineWidth = 1;
    for (const instr of LANE_ORDER_LR) {
      const cx = _x(instr);
      const color = colorMap[instr] ?? DEFAULT_COLOR;
      ctx.strokeStyle = color;
      ctx.globalAlpha = this._lightMode ? 0.12 : 0.06;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── draw hit-line ────────────────────────────────────
    ctx.strokeStyle = this._lightMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(W, hitLineY);
    ctx.stroke();

    // ── draw lane labels at bottom ───────────────────────
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const instr of LANE_ORDER_LR) {
      const cx = _x(instr);
      const color = colorMap[instr] ?? DEFAULT_COLOR;
      ctx.fillStyle = color;
      ctx.globalAlpha = this._lightMode ? 0.8 : 0.5;
      ctx.fillText(INSTRUMENT_SHORT[instr] ?? '??', cx, hitLineY + 4);
    }
    ctx.globalAlpha = 1;

    // ── draw hit-flash circles ───────────────────────────
    for (const [instrument, ts] of this._hitFlashes) {
      const elapsed = now - ts;
      if (elapsed > HIT_FLASH_MS) {
        this._hitFlashes.delete(instrument);
        continue;
      }

      const cx = _x(instrument);
      const alpha = 0.35 * (1 - elapsed / HIT_FLASH_MS);
      const color = colorMap[instrument] ?? DEFAULT_COLOR;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(cx - GEM_HALF_W, hitLineY - 12, gemW, 24);
    }
    ctx.globalAlpha = 1;

    // ── draw note gems ───────────────────────────────────
    const FADE_BEATS = 0.3;  // gems fade out over the last 0.3 beats before the hit-line
    for (const note of this._notes) {
      const beatDelta = note.beatTime - this._currentBeat;

      // gems disappear at the hit-line (projectile takes over)
      if (beatDelta < 0 || beatDelta > LOOK_AHEAD_BEATS)
        continue;

      const cx = _x(note.instrument);
      const y = hitLineY - beatDelta * pixelsPerBeat;

      const color = colorMap[note.instrument] ?? DEFAULT_COLOR;

      // fade out near the hit-line so the gem smoothly becomes the projectile
      const fadeFactor = beatDelta < FADE_BEATS ? beatDelta / FADE_BEATS : 1;

      // gem style varies with PlayState
      ctx.globalAlpha = _gemAlpha(note.playState) * fadeFactor;
      ctx.fillStyle = color;

      // rounded rect gem centered on cx
      _roundRect(ctx, cx - GEM_HALF_W + 1, y - GEM_HEIGHT / 2, gemW - 2, GEM_HEIGHT, GEM_RADIUS);
      ctx.fill();

      // accent marker: bright border
      if (note.playState === PlayState.Accent || note.playState === PlayState.Rimshot) {
        ctx.strokeStyle = this._lightMode ? '#000' : '#fff';
        ctx.lineWidth = 1.5;
        _roundRect(ctx, cx - GEM_HALF_W + 1, y - GEM_HEIGHT / 2, gemW - 2, GEM_HEIGHT, GEM_RADIUS);
        ctx.stroke();
      }

      // ghost marker: dashed outline
      if (note.playState === PlayState.Ghost) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        _roundRect(ctx, cx - GEM_HALF_W + 1, y - GEM_HEIGHT / 2, gemW - 2, GEM_HEIGHT, GEM_RADIUS);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── Private helpers ────────────────────────────────────

  /** When a note crosses the hit-line, flash the lane and compute screen position. */
  _fireNote(note) {
    this._hitFlashes.set(note.instrument, performance.now());
    const canvas = this._canvas;
    const W = canvas._logicalW || canvas.width;
    const H = canvas._logicalH || canvas.height;
    if (W === 0 || H === 0)
      return;

    const hitLineY = H * HIT_LINE_Y_RATIO;
    const kit = this._kitLayout;
    const xScale = kit ? 400 * kit.scale : W;
    const xOff = kit ? kit.offsetX : 0;
    const localX = xOff + (INSTRUMENT_X[note.instrument] ?? 0.5) * xScale;

    // Convert canvas-local coords to screen coords
    const parent = canvas.parentElement;
    if (!parent)
      return;

    const rect = parent.getBoundingClientRect();
    const screenX = rect.left + localX;
    const screenY = rect.top + hitLineY;

    this._onNoteFired(note.instrument, screenX, screenY);
  }

  _handleResize() {
    const parent = this._canvas.parentElement;
    if (!parent)
      return;

    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._canvas.style.width = rect.width + 'px';
    this._canvas.style.height = rect.height + 'px';
    // store logical size for rendering
    this._canvas._logicalW = rect.width;
    this._canvas._logicalH = rect.height;
  }
}

// ── Module-level helpers ─────────────────────────────────

function _gemAlpha(playState) {
  switch (playState) {
    case PlayState.Ghost:   return 0.35;
    case PlayState.Accent:  return 1.0;
    case PlayState.Stroke:  return 0.8;
    case PlayState.Flam:    return 0.85;
    case PlayState.Ruff:    return 0.85;
    case PlayState.Rimshot: return 0.95;
    case PlayState.Click:   return 0.5;
    case PlayState.Choke:   return 0.6;
    default:                return 0.7;
  }
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

ns.LaneRenderer = LaneRenderer;

})(window.SZDrums = window.SZDrums || {});
