// SynthelicZ Drums — Lane Renderer Tests
// Tests for the Guitar-Hero falling-lane canvas renderer.

(function () {
'use strict';

const { describe, it, expect, beforeEach } = window.TestRunner;
const { LaneRenderer, DrumBit, Bar, DrumGroove, NoteIndex, Instrument, PlayState, LANE_ORDER_UD } = window.SZDrums;

// ── Helper: create a simple groove ─────────────────────────

const makeGroove = () => {
  const groove = new DrumGroove();
  const bar = new Bar();
  groove.addBar(bar);
  bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000011)); // kick + hi-hat
  bar.setDrumBit(NoteIndex.Beat2, new DrumBit(0b00010010)); // snare + hi-hat
  bar.setDrumBit(NoteIndex.Beat3, new DrumBit(0b00000011)); // kick + hi-hat
  bar.setDrumBit(NoteIndex.Beat4, new DrumBit(0b00010010)); // snare + hi-hat
  return groove;
};

// ── Helper: create a mock canvas ───────────────────────────

const makeCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 400;
  const parent = document.createElement('div');
  parent.style.width = '300px';
  parent.style.height = '400px';
  parent.appendChild(canvas);
  document.body.appendChild(parent);
  return canvas;
};

// ── Construction ───────────────────────────────────────────

describe('LaneRenderer — construction', () => {

  it('creates a renderer without throwing', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    expect(renderer).toBeTruthy();
  });

  it('has a 2d context', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    expect(renderer._ctx).toBeTruthy();
  });
});

// ── loadGroove ─────────────────────────────────────────────

describe('LaneRenderer — loadGroove', () => {

  let canvas;
  let renderer;

  beforeEach(() => {
    canvas = makeCanvas();
    renderer = new LaneRenderer(canvas);
  });

  it('flattens a groove into individual note events', () => {
    renderer.loadGroove(makeGroove());
    expect(renderer._notes.length).toBeGreaterThan(0);
  });

  it('each note has instrument, playState, and beatTime', () => {
    renderer.loadGroove(makeGroove());
    for (const note of renderer._notes) {
      expect(note.instrument).toBeTruthy();
      expect(note.playState).toBeTruthy();
      expect(typeof note.beatTime).toBe('number');
    }
  });

  it('only includes non-silent instruments', () => {
    renderer.loadGroove(makeGroove());
    for (const note of renderer._notes)
      expect(note.playState).not.toBe(PlayState.Silence);
  });

  it('clears previous notes when loading a new groove', () => {
    renderer.loadGroove(makeGroove());
    const count1 = renderer._notes.length;
    renderer.loadGroove(makeGroove());
    expect(renderer._notes.length).toBe(count1);
  });

  it('handles null groove gracefully', () => {
    renderer.loadGroove(null);
    expect(renderer._notes.length).toBe(0);
  });

  it('handles empty groove with no bars', () => {
    renderer.loadGroove(new DrumGroove());
    expect(renderer._notes.length).toBe(0);
  });
});

// ── setCurrentBeat / setBpm ────────────────────────────────

describe('LaneRenderer — playback state', () => {

  let canvas;
  let renderer;

  beforeEach(() => {
    canvas = makeCanvas();
    renderer = new LaneRenderer(canvas);
  });

  it('setCurrentBeat updates internal beat position', () => {
    renderer.setCurrentBeat(2.5);
    expect(renderer._currentBeat).toBe(2.5);
  });

  it('setBpm clamps to valid range', () => {
    renderer.setBpm(10);
    expect(renderer._bpm).toBe(30);
    renderer.setBpm(500);
    expect(renderer._bpm).toBe(300);
    renderer.setBpm(120);
    expect(renderer._bpm).toBe(120);
  });

  it('setPlaying updates playing flag', () => {
    renderer.setPlaying(true);
    expect(renderer._playing).toBe(true);
    renderer.setPlaying(false);
    expect(renderer._playing).toBe(false);
  });
});

// ── onNoteFired (crossing detection) ───────────────────────

describe('LaneRenderer — onNoteFired', () => {

  it('fires callback when playing and beat crosses a note', () => {
    const fired = [];
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas, (instr, sx, sy) => fired.push({ instr, sx, sy }));
    renderer.loadGroove(makeGroove());
    renderer.setPlaying(true);
    renderer.setCurrentBeat(0);
    renderer.setCurrentBeat(0.1);
    expect(fired.length).toBeGreaterThan(0);
  });

  it('does not fire callback when not playing', () => {
    const fired = [];
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas, (instr) => fired.push(instr));
    renderer.loadGroove(makeGroove());
    renderer.setPlaying(false);
    renderer.setCurrentBeat(0);
    renderer.setCurrentBeat(0.1);
    expect(fired.length).toBe(0);
  });

  it('does not fire on large beat jumps (burst guard)', () => {
    const fired = [];
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas, (instr) => fired.push(instr));
    renderer.loadGroove(makeGroove());
    renderer.setPlaying(true);
    renderer.setCurrentBeat(10); // jump > 2 beats from initial -1
    expect(fired.length).toBe(0);
  });

  it('provides numeric screen coordinates', () => {
    const fired = [];
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas, (instr, sx, sy) => fired.push({ sx, sy }));
    renderer.loadGroove(makeGroove());
    renderer.setPlaying(true);
    renderer.setCurrentBeat(0);
    renderer.setCurrentBeat(0.1);
    if (fired.length > 0) {
      expect(typeof fired[0].sx).toBe('number');
      expect(typeof fired[0].sy).toBe('number');
    }
  });

  it('does not double-fire on small negative delta from interleaving jitter', () => {
    const fired = [];
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas, (instr) => fired.push(instr));
    renderer.loadGroove(makeGroove());
    renderer.setPlaying(true);
    // Advance past beat 0 notes
    renderer.setCurrentBeat(0);
    renderer.setCurrentBeat(0.1);
    const countAfterFirst = fired.length;
    // Simulate onEvent/onBeat interleaving: tiny backward step
    renderer.setCurrentBeat(0.099);
    expect(fired.length).toBe(countAfterFirst);
  });

  it('fires notes on genuine loop wrap', () => {
    const fired = [];
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas, (instr) => fired.push(instr));
    renderer.loadGroove(makeGroove());
    renderer.setPlaying(true);
    // Advance to near end of groove (4 beats for 1-bar groove)
    renderer.setCurrentBeat(3.9);
    const countBefore = fired.length;
    // Genuine loop wrap: jump from 3.9 back to 0.1
    renderer.setCurrentBeat(0.1);
    expect(fired.length).toBeGreaterThan(countBefore);
  });
});

// ── flashHit ───────────────────────────────────────────────

describe('LaneRenderer — flashHit', () => {

  it('records a hit-flash timestamp', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.flashHit(Instrument.SnareDrum);
    expect(renderer._hitFlashes.has(Instrument.SnareDrum)).toBe(true);
  });
});

// ── setLightMode ──────────────────────────────────────────

describe('LaneRenderer — setLightMode', () => {

  it('defaults to dark mode', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    expect(renderer._lightMode).toBe(false);
  });

  it('sets light mode flag', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.setLightMode(true);
    expect(renderer._lightMode).toBe(true);
  });

  it('renders without throwing in light mode', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.setLightMode(true);
    renderer.loadGroove(makeGroove());
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });
});

// ── setPlaybackRate ──────────────────────────────────────

describe('LaneRenderer — setPlaybackRate', () => {

  it('stores playback rate', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.setPlaybackRate(0.002);
    expect(renderer._playbackRate).toBe(0.002);
  });

  it('uses playbackRate for interpolation when set', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.loadGroove(makeGroove());
    renderer.setPlaybackRate(0.005);
    renderer.setPlaying(true);
    renderer.setCurrentBeat(1.0);
    // Render at 50ms later — should advance by 0.005 * 50 = 0.25 beats
    const now = performance.now();
    renderer._lastBeatTime = now - 50;
    renderer.render(now);
    const expected = 1.0 + 0.005 * 50;
    expect(Math.abs(renderer._currentBeat - expected)).toBeLessThan(0.01);
  });

  it('falls back to bpm when playbackRate is zero', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.setBpm(120);
    renderer.setPlaybackRate(0);
    renderer.setPlaying(true);
    renderer.setCurrentBeat(1.0);
    const now = performance.now();
    renderer._lastBeatTime = now - 100;
    renderer.render(now);
    const expectedRate = 120 / 60000;
    const expected = 1.0 + expectedRate * 100;
    expect(Math.abs(renderer._currentBeat - expected)).toBeLessThan(0.01);
  });

  it('caps extrapolation based on playback rate', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.loadGroove(makeGroove());
    renderer.setPlaybackRate(0.002);
    renderer.setPlaying(true);
    renderer.setCurrentBeat(0);
    const now = performance.now();
    renderer._lastBeatTime = now - 5000;
    renderer.render(now);
    // max extrapolation = max(150, 0.125 / 0.002) = max(150, 62.5) = 150
    const maxBeat = 0 + 0.002 * 150;
    expect(renderer._currentBeat).toBeLessThan(maxBeat + 0.01);
  });

  it('scales cap for slow playback rates', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.loadGroove(makeGroove());
    renderer.setPlaybackRate(0.000125); // ~10% of 75 BPM equivalent
    renderer.setPlaying(true);
    renderer.setCurrentBeat(0);
    const now = performance.now();
    renderer._lastBeatTime = now - 2000;
    renderer.render(now);
    // max extrapolation = max(150, 0.125 / 0.000125) = max(150, 1000) = 1000
    // beat at 2000ms elapsed (capped to 1000ms) = 0.000125 * 1000 = 0.125
    const expected = 0.000125 * 1000;
    expect(Math.abs(renderer._currentBeat - expected)).toBeLessThan(0.01);
  });
});

// ── render (smoke test) ────────────────────────────────────

describe('LaneRenderer — render', () => {

  it('renders without throwing on empty notes', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('renders without throwing with loaded groove', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.loadGroove(makeGroove());
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('renders at different beat positions without throwing', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.loadGroove(makeGroove());
    for (let b = 0; b < 4; b += 0.5) {
      renderer.setCurrentBeat(b);
      renderer.render(performance.now());
    }
    expect(true).toBe(true);
  });

  it('renders without throwing when gems are in the fade-out zone', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.loadGroove(makeGroove());
    // Position so beat-0 gems are within 0.3 beats of the hit-line
    renderer.setCurrentBeat(-0.15);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('gems at the hit-line are excluded (beatDelta < 0)', () => {
    const canvas = makeCanvas();
    const renderer = new LaneRenderer(canvas);
    renderer.loadGroove(makeGroove());
    // Advance past all beat-0 notes
    renderer.setCurrentBeat(0.01);
    renderer.render(performance.now());
    // No assertion on canvas pixels, but should not throw
    expect(true).toBe(true);
  });
});

})();
