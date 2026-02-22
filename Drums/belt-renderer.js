// SynthelicZ Drums — Sheet-Belt Renderer
// Renders the groove as a scrolling percussion staff (Notenzeile) moving
// right-to-left.  Notes use oval/X noteheads, stems (Hals), flags (Fähnchen),
// and beams (Balken) that mirror the ABC converter's note-value grouping.
// When a note crosses the cursor it fires a callback so the overlay can
// animate a projectile toward the drum kit.

(function (ns) {
'use strict';

const { Instrument, PlayState, LANE_ORDER_UD, INSTRUMENT_COLORS, INSTRUMENT_COLORS_LIGHT, INSTRUMENT_LABEL, INSTRUMENT_Y, AbcConverter } = ns;

// ── Tunables ───────────────────────────────────────────────

const LOOK_AHEAD_BEATS  = 8;
const LOOK_BEHIND_BEATS = 0.25; // small margin so the first note at beat 0 is visible
const CURSOR_WIDTH      = 2;
const CURSOR_X          = 2;   // pink line sits at left edge, flush with the drum kit

// ── Note-head geometry ─────────────────────────────────────

const HEAD_RX   = 10;
const HEAD_RY   = 7;
const HEAD_TILT = -0.35;   // radians (slight leftward lean)
const X_SIZE    = 9;       // half-size of the cymbal X cross

// ── Stem / beam / flag geometry ────────────────────────────

const STEM_LENGTH   = 52;
const STEM_WIDTH    = 3.2;
const FLAG_WIDTH    = 16;
const FLAG_GAP      = 10;
const BEAM_THICKNESS = 5.6;
const BEAM_GAP       = 8;   // vertical gap between beam lines

// ── Cymbal set (X noteheads) ───────────────────────────────

const CYMBAL_SET = new Set([
  Instrument.Crash,
  Instrument.Ride,
  Instrument.ClosedHiHat,
  Instrument.OpenHiHat,
  Instrument.HiHatPedal,
]);

// ── Triangle notehead set (ride bell) ────────────────────

const TRIANGLE_SET = new Set([
  Instrument.RideBell,
]);

// ── Open indicator set ("o" above the note) ──────────────

const OPEN_INDICATOR_SET = new Set([
  Instrument.OpenHiHat,
]);

// ── Ledger-line set (instruments above / below the staff) ──

const LEDGER_LINE_SET = new Set([
  Instrument.Crash,
]);

// ── Staff layout ────────────────────────────────────────────
// Note Y positions come directly from INSTRUMENT_Y (cy / 300 in KIT_PIECES)
// so the belt's vertical positioning mirrors the drum-kit SVG exactly.
// Staff lines pass through five representative instrument rows.

const STAFF_LINE_POSITIONS = [
  INSTRUMENT_Y[Instrument.Ride],
  INSTRUMENT_Y[Instrument.MidTom],
  INSTRUMENT_Y[Instrument.FloorTom],
  (INSTRUMENT_Y[Instrument.FloorTom] + INSTRUMENT_Y[Instrument.BassDrum]) / 2,
  (INSTRUMENT_Y[Instrument.BassDrum] + INSTRUMENT_Y[Instrument.HiHatPedal]) / 2,
];

// ── Data types ─────────────────────────────────────────────

/**
 * A note event with duration derived from the ABC converter's RLE logic.
 * @typedef {Object} BeltNote
 * @property {string}  instrument
 * @property {string}  playState
 * @property {number}  beatTime    — absolute beat position (quarter-note units)
 * @property {number}  slotDur     — duration in 16th-note slots (1/2/3/4/…)
 * @property {number}  flagCount   — 0 = quarter+, 1 = 8th, 2 = 16th
 */

/**
 * A group of notes that share a beam.
 * @typedef {Object} BeamGroup
 * @property {BeltNote[]} notes
 * @property {number}     maxFlags — deepest beam level in the group
 */

// ── SheetBeltRenderer class ────────────────────────────────

class SheetBeltRenderer {

  constructor(container, onNoteFired) {
    this._container = container;
    this._onNoteFired = onNoteFired ?? (() => {});
    this._notes = [];          // flat list of BeltNote
    this._beamGroups = [];     // BeamGroup[]
    this._currentBeat = 0;
    this._eventBeat = 0;
    this._totalBeats = 0;
    this._bpm = 60;
    this._playing = false;
    this._lastBeatTime = 0;    // timestamp of last setCurrentBeat call
    this._lastBeat = 0;        // beat value at that timestamp
    this._playbackRate = 0;    // beats-per-ms, set by controller from abcjs event timing

    this._lightMode = false;
    this._beamPerInstrument = false; // false = cross-instrument beams, true = per-instrument

    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this._container.style.position = 'relative';
    this._container.innerHTML = '';
    this._container.appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');

    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(this._container);
    this._handleResize();
  }

  // ── Public API ─────────────────────────────────────────

  setLightMode(on) { this._lightMode = !!on; }

  /** Accept the kit SVG's meet-scaling layout so note Y positions match the pads. */
  setKitLayout(layout) { this._kitLayout = layout; }

  loadGroove(groove) {
    this._notes = [];
    this._beamGroups = [];
    this._totalBeats = groove ? groove.bars.length * 4 : 0;
    if (!groove) return;

    const beatIndexes = AbcConverter._beatIndexes;
    const totalSlots  = groove.bars.length * 16;

    // ── Step 1: Build a per-slot "symbol signature" (like barToAbc RLE)
    // and collect which instruments are active per slot.
    const slotData = [];  // { barIdx, slotIdx, beatTime, instruments: Map<instrument, playState> }

    for (let barIdx = 0; barIdx < groove.bars.length; ++barIdx) {
      const bar = groove.bars[barIdx];
      for (let slotIdx = 0; slotIdx < beatIndexes.length; ++slotIdx) {
        const storageIdx = beatIndexes[slotIdx];
        const drumBit = bar.getDrumBit(storageIdx);
        const beatTime = barIdx * 4 + slotIdx / 4;

        const instruments = new Map();
        if (drumBit) {
          for (const instr of LANE_ORDER_UD) {
            const state = drumBit.getInstrument(instr);
            if (state !== PlayState.Silence)
              instruments.set(instr, state);
          }
        }

        // Build a signature string that mirrors drumBitToSymbol
        const sig = drumBit ? AbcConverter.drumBitToSymbol(drumBit) : 'z';
        slotData.push({ barIdx, slotIdx, beatTime, instruments, sig });
      }
    }

    // ── Step 2: RLE merge (mirrors barToAbc logic) to get slot durations.
    //    slotDurations[i] = how many 16th-note slots this event spans
    //    (only the first slot of a merged run gets a value > 0;
    //     continuation slots get 0 = "skip, already merged").
    const slotDurations = new Array(slotData.length).fill(0);

    let runStart = 0;
    for (let i = 1; i <= slotData.length; ++i) {
      const curSig   = i < slotData.length ? slotData[i].sig : null;
      // Break runs at bar boundaries; only rests extend the preceding note
      const sameBar  = i < slotData.length && slotData[i].barIdx === slotData[i - 1].barIdx;
      const sameRun  = sameBar && curSig === 'z';

      if (!sameRun || i === slotData.length) {
        // The run from runStart..i-1 has length (i - runStart).
        // Only the first slot with instruments gets the full duration;
        // rests that follow extend it.
        // However if the whole run is rests, skip it.
        if (slotData[runStart].sig !== 'z')
          slotDurations[runStart] = i - runStart;

        runStart = i;
      }
    }

    // ── Step 3: Expand into BeltNote objects with slotDur & flagCount.
    for (let i = 0; i < slotData.length; ++i) {
      const dur = slotDurations[i];
      if (dur === 0) continue;

      const { beatTime, instruments } = slotData[i];
      const flagCount = _durationToFlags(dur);

      for (const [instr, playState] of instruments)
        this._notes.push({ instrument: instr, playState, beatTime, slotDur: dur, flagCount });
    }

    // ── Step 4: Build beam groups per beat.
    this._beamGroups = _buildBeamGroups(this._notes, this._beamPerInstrument);
  }

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

  setBeamPerInstrument(on) { this._beamPerInstrument = !!on; }

  // ── Main render ────────────────────────────────────────

  render(now) {
    const { _canvas: canvas, _ctx: ctx } = this;
    const W = canvas._logicalW || canvas.width;
    const H = canvas._logicalH || canvas.height;
    if (W === 0 || H === 0) return;

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

    if (this._lightMode) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    } else
      ctx.clearRect(0, 0, W, H);

    const pxPerBeat = (W - CURSOR_X) / LOOK_AHEAD_BEATS;

    // Kit-aligned Y positioning: use the same meet-scaling as the SVG kit
    const kit = this._kitLayout;
    const yScale = kit ? 300 * kit.scale : H;
    const yOff = kit ? kit.offsetY : 0;
    const _y = (instr) => yOff + (INSTRUMENT_Y[instr] ?? 0.5) * yScale;

    this._drawStaffLines(ctx, W, yOff, yScale);
    this._drawBeatGrid(ctx, W, H, CURSOR_X, pxPerBeat);
    this._drawBarLines(ctx, W, H, CURSOR_X, pxPerBeat);
    this._drawBeams(ctx, CURSOR_X, pxPerBeat, _y, this._lightMode);
    this._drawNotes(ctx, W, CURSOR_X, pxPerBeat, _y);
    this._drawCursor(ctx, H, CURSOR_X);
    this._drawLabels(ctx, W, _y);
  }

  // ── Standard 5-line staff ──────────────────────────────────

  _drawStaffLines(ctx, W, yOff, yScale) {
    ctx.strokeStyle = this._lightMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.8;
    for (const ratio of STAFF_LINE_POSITIONS) {
      const y = yOff + ratio * yScale;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  // ── Vertical beat grid ─────────────────────────────────

  _drawBeatGrid(ctx, W, H, cursorX, pxPerBeat) {
    ctx.strokeStyle = this._lightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
    const start = Math.floor(this._currentBeat - LOOK_BEHIND_BEATS);
    const end   = this._currentBeat + LOOK_AHEAD_BEATS;
    for (let b = start; b < end; b += 0.25) {
      if (b < 0) continue;
      const x = cursorX + (b - this._currentBeat) * pxPerBeat;
      if (x < 0 || x > W) continue;
      const isQuarter = Math.abs(b - Math.round(b)) < 0.01;
      ctx.lineWidth = isQuarter ? 0.8 : 0.3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  }

  // ── Bar lines ──────────────────────────────────────────

  _drawBarLines(ctx, W, H, cursorX, pxPerBeat) {
    const start = Math.floor((this._currentBeat - LOOK_BEHIND_BEATS) / 4) * 4;
    const end   = this._currentBeat + LOOK_AHEAD_BEATS;
    ctx.strokeStyle = this._lightMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let b = start; b <= end; b += 4) {
      if (b < 0) continue;
      const x = cursorX + (b - this._currentBeat) * pxPerBeat;
      if (x < -5 || x > W + 5) continue;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  }

  // ── Cursor line ────────────────────────────────────────

  _drawCursor(ctx, H, cursorX) {
    ctx.strokeStyle = 'rgba(240, 64, 160, 0.7)';
    ctx.lineWidth = CURSOR_WIDTH;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, H);
    ctx.stroke();

    const grad = ctx.createLinearGradient(cursorX - 20, 0, cursorX + 20, 0);
    grad.addColorStop(0, 'rgba(240,64,160,0)');
    grad.addColorStop(0.5, 'rgba(240,64,160,0.08)');
    grad.addColorStop(1, 'rgba(240,64,160,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cursorX - 20, 0, 40, H);
  }

  // ── Labels on right edge ───────────────────────────────

  _drawLabels(ctx, W, _y) {
    const colorMap = this._lightMode ? INSTRUMENT_COLORS_LIGHT : INSTRUMENT_COLORS;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.6;
    for (const instr of LANE_ORDER_UD) {
      ctx.fillStyle = colorMap[instr] ?? '#888';
      ctx.fillText(INSTRUMENT_LABEL[instr] ?? '', W - 4, _y(instr));
    }
    ctx.globalAlpha = 1;
  }

  // ── Draw beams (horizontal bars connecting stems) ──────

  _drawBeams(ctx, cursorX, pxPerBeat, _y, lightMode) {
    // Clear previous beam info so _drawNotes knows which stems to extend
    for (const note of this._notes)
      delete note._beamTipY;

    for (const group of this._beamGroups) {
      if (group.notes.length < 2) continue;

      // Visibility check
      const first = group.notes[0];
      const last  = group.notes[group.notes.length - 1];
      if (first.beatTime - this._currentBeat > LOOK_AHEAD_BEATS) continue;
      if (last.beatTime  - this._currentBeat < -LOOK_BEHIND_BEATS) continue;

      const stemUp = true;   // drum notation: all stems up

      // Find the topmost note position (smallest Y) so beams sit flat
      let minNoteY = Infinity;
      for (const n of group.notes) {
        const ny = _y(n.instrument);
        if (ny < minNoteY) minNoteY = ny;
      }
      const beamLevel = minNoteY - STEM_LENGTH;

      // Store beam level on each note so _drawNotes extends their stems
      for (const n of group.notes)
        n._beamTipY = beamLevel;

      // Collect beam endpoints at the common flat beam level
      const beamPts = [];
      for (const n of group.notes) {
        const bx = cursorX + (n.beatTime - this._currentBeat) * pxPerBeat;
        const sx = bx + HEAD_RX - 1;
        beamPts.push({ sx, tipY: beamLevel, flagCount: n.flagCount });
      }

      // Draw beam lines: level 1 (8th-note beam) connects all;
      // level 2 (16th-note beam) connects only notes with flagCount >= 2.
      const fallback = lightMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
      // Use instrument color only when beaming per-instrument; otherwise generic
      const allSame = group.notes.every(n => n.instrument === first.instrument);
      const colorMap = lightMode ? INSTRUMENT_COLORS_LIGHT : INSTRUMENT_COLORS;
      const beamColor = allSame ? (colorMap[first.instrument] ?? fallback) : fallback;
      for (let level = 1; level <= group.maxFlags; ++level) {
        ctx.fillStyle = beamColor;

        let segStart = null;
        for (let i = 0; i <= beamPts.length; ++i) {
          const hasThisLevel = i < beamPts.length && beamPts[i].flagCount >= level;

          if (hasThisLevel) {
            if (segStart === null) segStart = i;
          } else if (segStart !== null) {
            // Draw beam segment from segStart to i-1
            const segEnd = i - 1;
            if (segStart === segEnd) {
              // Isolated note at this level — draw a short partial beam
              _drawPartialBeam(ctx, beamPts, segStart, level, stemUp);
            } else {
              _drawBeamSegment(ctx, beamPts, segStart, segEnd, level, stemUp);
            }
            segStart = null;
          }
        }
      }
    }
  }

  // ── Draw individual notes (heads, stems, flags) ────────

  _drawNotes(ctx, W, cursorX, pxPerBeat, _y) {
    const FADE_BEATS = 0.3;  // notes fade out over the last 0.3 beats before the cursor
    const colorMap = this._lightMode ? INSTRUMENT_COLORS_LIGHT : INSTRUMENT_COLORS;
    for (const note of this._notes) {
      const beatDelta = note.beatTime - this._currentBeat;
      if (beatDelta < -LOOK_BEHIND_BEATS || beatDelta > LOOK_AHEAD_BEATS) continue;

      const x = cursorX + beatDelta * pxPerBeat;
      const y = _y(note.instrument);
      const color  = colorMap[note.instrument] ?? '#888';
      const alpha  = _noteAlpha(note.playState);
      const isCymbal = CYMBAL_SET.has(note.instrument);
      const stemUp = true;   // drum notation: all stems up

      // fade out near the cursor so the note smoothly becomes the projectile
      // only fade during playback; when stopped, show all notes at full opacity
      const fadeFactor = (!this._playing || beatDelta >= FADE_BEATS) ? 1 : Math.max(0, beatDelta / FADE_BEATS);
      ctx.globalAlpha = alpha * fadeFactor;

      // Stem — beamed notes extend to the group's flat beam level
      if (note._beamTipY !== undefined)
        _drawStem(ctx, x, y, stemUp, color, y - note._beamTipY);
      else
        _drawStem(ctx, x, y, stemUp, color);

      // Flags — only for notes NOT in a beam group (isolated beamable notes)
      if (note.flagCount > 0 && !note._beamed)
        _drawFlags(ctx, x, y, stemUp, color, note.flagCount);

      // Ledger line for notes above / below the staff
      if (LEDGER_LINE_SET.has(note.instrument))
        _drawLedgerLine(ctx, x, y, this._lightMode);

      // Notehead
      if (TRIANGLE_SET.has(note.instrument))
        _drawTriangleHead(ctx, x, y, color);
      else if (isCymbal || note.playState === PlayState.Click)
        _drawXHead(ctx, x, y, color);
      else if (note.flagCount < 0)
        _drawOpenOvalHead(ctx, x, y, color);
      else
        _drawOvalHead(ctx, x, y, color, this._lightMode);

      // Accent / ghost decorations
      if (note.playState === PlayState.Accent || note.playState === PlayState.Rimshot)
        _drawAccentMark(ctx, x, y, stemUp, this._lightMode);

      if (note.playState === PlayState.Ghost)
        _drawGhostParens(ctx, x, y, this._lightMode);

      // Open indicator ("o" above cymbal)
      if (OPEN_INDICATOR_SET.has(note.instrument))
        _drawOpenIndicator(ctx, x, y, this._lightMode);

      // Flam / ruff grace notes
      if (note.playState === PlayState.Flam)
        _drawGraceNote(ctx, x, y, color, 1, this._lightMode);
      else if (note.playState === PlayState.Ruff)
        _drawGraceNote(ctx, x, y, color, 2, this._lightMode);

      // Dot for dotted notes (slotDur = 3, 6, 12)
      if (_isDotted(note.slotDur))
        _drawDot(ctx, x, y, this._lightMode);
    }
    ctx.globalAlpha = 1;
  }

  // ── Fire note callback ─────────────────────────────────

  _fireNote(note) {
    const canvas = this._canvas;
    const H = canvas._logicalH || canvas.height;
    if (H === 0) return;

    const kit = this._kitLayout;
    const yScale = kit ? 300 * kit.scale : H;
    const yOff = kit ? kit.offsetY : 0;
    const localY = yOff + (INSTRUMENT_Y[note.instrument] ?? 0.5) * yScale;

    const rect    = this._container.getBoundingClientRect();
    const screenX = rect.left + CURSOR_X;
    const screenY = rect.top + localY;
    this._onNoteFired(note.instrument, screenX, screenY);
  }

  _handleResize() {
    const dpr  = window.devicePixelRatio || 1;
    const rect = this._container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this._canvas.width  = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._canvas._logicalW = rect.width;
    this._canvas._logicalH = rect.height;
    this.render(performance.now());
  }
}

// ════════════════════════════════════════════════════════════
// Note-value helpers
// ════════════════════════════════════════════════════════════

/**
 * Convert a duration in 16th-note slots to a flag count.
 *   16  → -2 (whole note, no stem)
 *    8  → -1 (half note, open head)
 *    6  → -1 (dotted half)
 *    4  →  0 (quarter note — stem, no flag)
 *    3  →  0 (dotted quarter)
 *    2  →  1 (eighth note — 1 flag/beam)
 *    1  →  2 (sixteenth note — 2 flags/beams)
 */
function _durationToFlags(slotDur) {
  if (slotDur >= 8) return -1;   // half note or longer (open head)
  if (slotDur >= 4) return  0;   // quarter
  if (slotDur >= 2) return  1;   // eighth
  return 2;                      // sixteenth
}

/** Whether the duration is dotted (3, 6, 12 slots). */
function _isDotted(slotDur) {
  return slotDur === 3 || slotDur === 6 || slotDur === 12;
}

// ════════════════════════════════════════════════════════════
// Beam-group builder
// ════════════════════════════════════════════════════════════

/**
 * Build beam groups from a flat list of BeltNotes.
 * Rules:
 *  - Only notes with flagCount >= 1 (8th or 16th) can be beamed.
 *  - Notes within the same beat (integer quarter note) are grouped.
 *  - A beam group must have >= 2 notes.
 *  - Notes in a beam group get `_beamed = true` (mutates the note).
 */
function _buildBeamGroups(notes, perInstrument) {
  // Bucket notes by beat (and optionally by instrument).
  // perInstrument = true  → each instrument gets its own beam group (short stems)
  // perInstrument = false → all instruments at the same beat share a beam group
  const buckets = new Map();
  for (const n of notes) {
    if (n.flagCount < 1) continue;          // not beamable
    const beat = Math.floor(n.beatTime);     // integer quarter-note beat
    const key = perInstrument ? `${beat}:${n.instrument}` : String(beat);
    if (!buckets.has(key))
      buckets.set(key, []);
    buckets.get(key).push(n);
  }

  const groups = [];
  for (const [, bucket] of buckets) {
    // Sort by beatTime (already should be, but be safe)
    bucket.sort((a, b) => a.beatTime - b.beatTime);

    // Collect unique beat positions within this beat
    const positions = [];
    let lastBeat = -1;
    for (const n of bucket) {
      if (n.beatTime !== lastBeat) {
        positions.push({ beatTime: n.beatTime, notes: [] });
        lastBeat = n.beatTime;
      }
      positions[positions.length - 1].notes.push(n);
    }

    // A beam group needs >= 2 time positions
    if (positions.length < 2) continue;

    // All notes in this beat form one beam group
    const allNotes = positions.flatMap(p => p.notes);
    let maxFlags = 0;
    for (const n of allNotes) {
      if (n.flagCount > maxFlags) maxFlags = n.flagCount;
      n._beamed = true;
    }
    groups.push({ notes: allNotes, maxFlags });
  }

  return groups;
}

// ════════════════════════════════════════════════════════════
// Drawing primitives
// ════════════════════════════════════════════════════════════

/** Filled oval notehead (drums). */
function _drawOvalHead(ctx, x, y, color, lightMode) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(HEAD_TILT);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, HEAD_RX, HEAD_RY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lightMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/** Open (unfilled) oval notehead for half notes. */
function _drawOpenOvalHead(ctx, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(HEAD_TILT);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, HEAD_RX, HEAD_RY, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** X-shaped notehead (cymbals). */
function _drawXHead(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - X_SIZE, y - X_SIZE);
  ctx.lineTo(x + X_SIZE, y + X_SIZE);
  ctx.moveTo(x + X_SIZE, y - X_SIZE);
  ctx.lineTo(x - X_SIZE, y + X_SIZE);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Vertical stem.  Optional `customLength` overrides STEM_LENGTH (for beamed notes). */
function _drawStem(ctx, x, y, stemUp, color, customLength) {
  ctx.strokeStyle = color;
  ctx.lineWidth = STEM_WIDTH;
  const len = customLength ?? STEM_LENGTH;
  const endY = stemUp ? y - len : y + len;
  const sx = stemUp ? x + HEAD_RX - 1 : x - HEAD_RX + 1;
  ctx.beginPath();
  ctx.moveTo(sx, y);
  ctx.lineTo(sx, endY);
  ctx.stroke();
}

/** Draw individual flags (only for un-beamed notes). */
function _drawFlags(ctx, x, y, stemUp, color, count) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';

  const sx   = stemUp ? x + HEAD_RX - 1 : x - HEAD_RX + 1;
  const tipY = stemUp ? y - STEM_LENGTH : y + STEM_LENGTH;
  const dir  = stemUp ? 1 : -1;

  for (let f = 0; f < count; ++f) {
    const baseY = tipY + dir * f * FLAG_GAP;
    const cpX   = sx + FLAG_WIDTH * 0.6;
    const cpY   = baseY + dir * FLAG_GAP * 0.7;
    const endX  = sx + FLAG_WIDTH;
    const endY  = baseY + dir * FLAG_GAP * 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, baseY);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** Draw a beam segment (thick horizontal bar) between two points. */
function _drawBeamSegment(ctx, pts, iStart, iEnd, level, stemUp) {
  const yOffset = stemUp ? (level - 1) * BEAM_GAP : -(level - 1) * BEAM_GAP;
  const x1 = pts[iStart].sx;
  const x2 = pts[iEnd].sx;
  const y1 = pts[iStart].tipY + yOffset;
  const y2 = pts[iEnd].tipY + yOffset;

  ctx.beginPath();
  ctx.moveTo(x1, y1 - BEAM_THICKNESS / 2);
  ctx.lineTo(x2, y2 - BEAM_THICKNESS / 2);
  ctx.lineTo(x2, y2 + BEAM_THICKNESS / 2);
  ctx.lineTo(x1, y1 + BEAM_THICKNESS / 2);
  ctx.closePath();
  ctx.fill();
}

/** Draw a short partial beam for an isolated 16th within a beam group. */
function _drawPartialBeam(ctx, pts, idx, level, stemUp) {
  const yOffset = stemUp ? (level - 1) * BEAM_GAP : -(level - 1) * BEAM_GAP;
  const sx = pts[idx].sx;
  const ty = pts[idx].tipY + yOffset;
  // Extend toward the neighbouring note (or leftward by default)
  const dir = idx > 0 ? -1 : 1;
  const len = 12;

  ctx.beginPath();
  ctx.moveTo(sx, ty - BEAM_THICKNESS / 2);
  ctx.lineTo(sx + dir * len, ty - BEAM_THICKNESS / 2);
  ctx.lineTo(sx + dir * len, ty + BEAM_THICKNESS / 2);
  ctx.lineTo(sx, ty + BEAM_THICKNESS / 2);
  ctx.closePath();
  ctx.fill();
}

/** Accent mark (>) beyond the stem tip. */
function _drawAccentMark(ctx, x, y, stemUp, lightMode) {
  const offset = stemUp ? STEM_LENGTH + 16 : -(STEM_LENGTH + 16);
  const ay = y - offset;
  ctx.strokeStyle = lightMode ? '#222' : '#fff';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 10, ay - 4);
  ctx.lineTo(x, ay + 4);
  ctx.lineTo(x + 10, ay - 4);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Ghost-note parentheses. */
function _drawGhostParens(ctx, x, y, lightMode) {
  ctx.strokeStyle = lightMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  const r = HEAD_RY + 4;
  const sweep = 1.2;
  const cx = HEAD_RX + 2 - r * Math.cos(sweep); // inner edge clears notehead by 2px
  ctx.beginPath();
  ctx.arc(x - cx, y, r, Math.PI - sweep, Math.PI + sweep); // ( left of note
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + cx, y, r, -sweep, sweep);                     // ) right of note
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Augmentation dot (for dotted rhythms). */
function _drawDot(ctx, x, y, lightMode) {
  ctx.fillStyle = lightMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(x + HEAD_RX + 8, y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** Short horizontal ledger line through a notehead above/below the staff. */
function _drawLedgerLine(ctx, x, y, lightMode) {
  ctx.strokeStyle = lightMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2.4;
  const extend = HEAD_RX + 4;
  ctx.beginPath();
  ctx.moveTo(x - extend, y);
  ctx.lineTo(x + extend, y);
  ctx.stroke();
}

/** Triangle notehead (ride bell). */
function _drawTriangleHead(ctx, x, y, color) {
  const s = X_SIZE;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y + s * 0.7);
  ctx.lineTo(x - s, y + s * 0.7);
  ctx.closePath();
  ctx.stroke();
  ctx.lineJoin = 'miter';
}

/** Open indicator — small "o" above the notehead (open hi-hat). */
function _drawOpenIndicator(ctx, x, y, lightMode) {
  ctx.strokeStyle = lightMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.6;
  const oy = y - HEAD_RY - 8;
  ctx.beginPath();
  ctx.arc(x, oy, 4, 0, Math.PI * 2);
  ctx.stroke();
}

/** Grace note(s) before the main note — flam (1) or ruff (2). */
function _drawGraceNote(ctx, x, y, color, count, lightMode) {
  const graceR = 4;
  const spacing = 12;
  const stemTop = y - 18;
  const stemX = (gx) => gx + graceR - 0.5;

  for (let i = 0; i < count; ++i) {
    const gx = x - 8 - spacing * (count - i);
    // small filled notehead
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(gx, y, graceR, graceR * 0.7, -0.35, 0, Math.PI * 2);
    ctx.fill();
    // small stem
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(stemX(gx), y);
    ctx.lineTo(stemX(gx), stemTop);
    ctx.stroke();
    // slash through stem (grace note convention)
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(gx + graceR - 4, y - 8);
    ctx.lineTo(gx + graceR + 3, y - 16);
    ctx.stroke();
  }

  // beam connecting stems (ruff: 2 grace notes)
  if (count > 1) {
    const x1 = stemX(x - 8 - spacing * count);
    const x2 = stemX(x - 8 - spacing);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(x1, stemTop);
    ctx.lineTo(x2, stemTop);
    ctx.stroke();
  }

  // slur arc from last grace note to main note
  const lastGx = x - 8 - spacing;
  const slurY = y + HEAD_RY + 3;
  const cpY = slurY + 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(lastGx, slurY);
  ctx.quadraticCurveTo((lastGx + x) / 2, cpY, x, slurY);
  ctx.stroke();
}

// ── Helpers ──────────────────────────────────────────────

function _noteAlpha(playState) {
  switch (playState) {
    case PlayState.Ghost:  return 0.4;
    case PlayState.Accent: return 1.0;
    case PlayState.Stroke: return 0.85;
    default:               return 0.7;
  }
}

ns.SheetBeltRenderer = SheetBeltRenderer;

})(window.SZDrums = window.SZDrums || {});
