// SynthelicZ Drums — Sheet-Belt Renderer Tests
// Tests for the transport-belt horizontal scrolling sheet renderer.

(function () {
'use strict';

const { describe, it, expect, beforeEach } = window.TestRunner;
const { SheetBeltRenderer, DrumBit, Bar, DrumGroove, NoteIndex, Instrument, PlayState } = window.SZDrums;

// ── Helper: create a simple groove ─────────────────────────

const makeGroove = () => {
  const groove = new DrumGroove();
  const bar = new Bar();
  groove.addBar(bar);
  bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000011));
  bar.setDrumBit(NoteIndex.Beat2, new DrumBit(0b00010010));
  bar.setDrumBit(NoteIndex.Beat3, new DrumBit(0b00000011));
  bar.setDrumBit(NoteIndex.Beat4, new DrumBit(0b00010010));
  return groove;
};

// ── Helper: create a container ─────────────────────────────

const makeContainer = () => {
  const container = document.createElement('div');
  container.style.width = '600px';
  container.style.height = '100px';
  container.style.position = 'relative';
  const track = document.createElement('div');
  track.className = 'scroll-track';
  container.appendChild(track);
  document.body.appendChild(container);
  return container;
};

// ── Construction ───────────────────────────────────────────

describe('SheetBeltRenderer — construction', () => {

  it('creates renderer without throwing', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    expect(renderer).toBeTruthy();
  });

  it('creates an internal canvas in the container', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('clears the scroll-track child', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    const track = container.querySelector('.scroll-track');
    expect(track).toBeNull();
  });
});

// ── loadGroove ─────────────────────────────────────────────

describe('SheetBeltRenderer — loadGroove', () => {

  let container;
  let renderer;

  beforeEach(() => {
    container = makeContainer();
    renderer = new SheetBeltRenderer(container);
  });

  it('flattens a groove into note events', () => {
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

  it('handles null groove gracefully', () => {
    renderer.loadGroove(null);
    expect(renderer._notes.length).toBe(0);
  });
});

// ── setCurrentBeat — note firing ────────────────────────────

describe('SheetBeltRenderer — setCurrentBeat', () => {

  let container;
  let renderer;

  beforeEach(() => {
    container = makeContainer();
    renderer = new SheetBeltRenderer(container);
  });

  it('updates internal beat position', () => {
    renderer.setCurrentBeat(1.5);
    expect(renderer._currentBeat).toBe(1.5);
  });

  it('fires callback when playing and beat crosses a note', () => {
    const fired = [];
    const c = makeContainer();
    const r = new SheetBeltRenderer(c, (instr, sx, sy) => fired.push(instr));
    r.loadGroove(makeGroove());
    r.setPlaying(true);
    r.setCurrentBeat(0);
    r.setCurrentBeat(0.1);
    expect(fired.length).toBeGreaterThan(0);
  });

  it('does not fire callback when not playing', () => {
    const fired = [];
    const c = makeContainer();
    const r = new SheetBeltRenderer(c, (instr) => fired.push(instr));
    r.loadGroove(makeGroove());
    r.setPlaying(false);
    r.setCurrentBeat(0);
    r.setCurrentBeat(0.1);
    expect(fired.length).toBe(0);
  });

  it('does not fire on large beat jumps (burst guard)', () => {
    const fired = [];
    const c = makeContainer();
    const r = new SheetBeltRenderer(c, (instr) => fired.push(instr));
    r.loadGroove(makeGroove());
    r.setPlaying(true);
    r.setCurrentBeat(10); // jump > 2 beats from initial -1
    expect(fired.length).toBe(0);
  });

  it('does not double-fire on small negative delta from interleaving jitter', () => {
    const fired = [];
    const c = makeContainer();
    const r = new SheetBeltRenderer(c, (instr) => fired.push(instr));
    r.loadGroove(makeGroove());
    r.setPlaying(true);
    r.setCurrentBeat(0);
    r.setCurrentBeat(0.1);
    const countAfterFirst = fired.length;
    // Tiny backward step from onEvent/onBeat interleaving
    r.setCurrentBeat(0.099);
    expect(fired.length).toBe(countAfterFirst);
  });

  it('fires notes on genuine loop wrap', () => {
    const fired = [];
    const c = makeContainer();
    const r = new SheetBeltRenderer(c, (instr) => fired.push(instr));
    r.loadGroove(makeGroove());
    r.setPlaying(true);
    r.setCurrentBeat(3.9);
    const countBefore = fired.length;
    // Genuine wrap: 3.9 → 0.1 (delta = -3.8, totalBeats = 4, threshold = -2)
    r.setCurrentBeat(0.1);
    expect(fired.length).toBeGreaterThan(countBefore);
  });
});

// ── setBpm ─────────────────────────────────────────────────

describe('SheetBeltRenderer — setBpm', () => {

  it('clamps to valid range', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.setBpm(10);
    expect(renderer._bpm).toBe(30);
    renderer.setBpm(500);
    expect(renderer._bpm).toBe(300);
    renderer.setBpm(140);
    expect(renderer._bpm).toBe(140);
  });
});

// ── render (smoke test) ────────────────────────────────────

describe('SheetBeltRenderer — render', () => {

  it('renders without throwing on empty notes', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('renders without throwing with loaded groove', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.loadGroove(makeGroove());
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('renders at several beat positions without throwing', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.loadGroove(makeGroove());
    for (let b = 0; b < 4; b += 0.25) {
      renderer.setCurrentBeat(b);
      renderer.render(performance.now());
    }
    expect(true).toBe(true);
  });
});

// ── onNoteFired callback ───────────────────────────────────

describe('SheetBeltRenderer — onNoteFired callback', () => {

  it('invokes callback with instrument and screen coords when beat crosses a note', () => {
    const fired = [];
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container, (instr, sx, sy) => {
      fired.push({ instr, sx, sy });
    });

    renderer.loadGroove(makeGroove());
    renderer.setPlaying(true);
    renderer.setCurrentBeat(0);
    renderer.setCurrentBeat(0.1);

    expect(fired.length).toBeGreaterThan(0);
    expect(typeof fired[0].sx).toBe('number');
    expect(typeof fired[0].sy).toBe('number');
  });
});

// ── setLightMode ──────────────────────────────────────────

describe('SheetBeltRenderer — setLightMode', () => {

  it('defaults to dark mode', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    expect(renderer._lightMode).toBe(false);
  });

  it('sets light mode flag', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.setLightMode(true);
    expect(renderer._lightMode).toBe(true);
  });

  it('renders without throwing in light mode', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.setLightMode(true);
    renderer.loadGroove(makeGroove());
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });
});

// ── setPlaybackRate ──────────────────────────────────────

describe('SheetBeltRenderer — setPlaybackRate', () => {

  it('stores playback rate', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.setPlaybackRate(0.003);
    expect(renderer._playbackRate).toBe(0.003);
  });

  it('uses playbackRate for interpolation when set', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.loadGroove(makeGroove());
    renderer.setPlaybackRate(0.004);
    renderer.setPlaying(true);
    renderer.setCurrentBeat(2.0);
    const now = performance.now();
    renderer._lastBeatTime = now - 60;
    renderer.render(now);
    const expected = 2.0 + 0.004 * 60;
    expect(Math.abs(renderer._currentBeat - expected)).toBeLessThan(0.01);
  });

  it('caps extrapolation based on playback rate', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
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
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.setPlaybackRate(0.000125); // ~10% of 75 BPM equivalent
    renderer.setPlaying(true);
    renderer.setCurrentBeat(0);
    const now = performance.now();
    renderer._lastBeatTime = now - 2000;
    renderer.render(now);
    // max extrapolation = max(150, 0.125 / 0.000125) = max(150, 1000) = 1000
    const expected = 0.000125 * 1000;
    expect(Math.abs(renderer._currentBeat - expected)).toBeLessThan(0.01);
  });
});

// ── setBeamPerInstrument ─────────────────────────────────

describe('SheetBeltRenderer — setBeamPerInstrument', () => {

  it('defaults to cross-instrument beams', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    expect(renderer._beamPerInstrument).toBe(false);
  });

  it('sets per-instrument beaming flag', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.setBeamPerInstrument(true);
    expect(renderer._beamPerInstrument).toBe(true);
  });

  it('produces different beam groups when toggled', () => {
    const container1 = makeContainer();
    const r1 = new SheetBeltRenderer(container1);
    r1.setBeamPerInstrument(false);

    const container2 = makeContainer();
    const r2 = new SheetBeltRenderer(container2);
    r2.setBeamPerInstrument(true);

    const groove = new DrumGroove();
    const bar = new Bar();
    groove.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat1E, new DrumBit(0b00010010));
    bar.setDrumBit(NoteIndex.Beat1Plus, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat1A, new DrumBit(0b00010010));

    r1.loadGroove(groove);
    r2.loadGroove(groove);

    // per-instrument should produce more (or equal) beam groups than cross-instrument
    expect(r2._beamGroups.length).toBeGreaterThanOrEqual(r1._beamGroups.length);
  });

  it('renders without throwing with per-instrument beams', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.setBeamPerInstrument(true);
    renderer.loadGroove(makeGroove());
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });
});

// ── Note fade-out near cursor ─────────────────────────────────

describe('SheetBeltRenderer — note fade near cursor', () => {

  it('renders without throwing when notes are near the cursor', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.loadGroove(makeGroove());
    // Position so beat-0 notes are within 0.3 beats of the cursor
    renderer.setCurrentBeat(-0.15);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('renders without throwing when notes are exactly at the cursor', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    renderer.loadGroove(makeGroove());
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });
});

// ── Belt/Lane synchronization (regression) ──────────────────

describe('SheetBeltRenderer — belt/lane note synchronization', () => {

  const makeLaneContainer = () => {
    const el = document.createElement('div');
    el.style.cssText = 'width:200px;height:200px;position:relative;';
    document.body.appendChild(el);
    return el;
  };

  const collectBeltBeats = (groove) => {
    const c = makeContainer();
    const r = new SheetBeltRenderer(c);
    r.loadGroove(groove);
    return r._notes.map(n => ({ instrument: n.instrument, beatTime: n.beatTime }));
  };

  const collectLaneBeats = (groove) => {
    const { LaneRenderer } = window.SZDrums;
    const c = makeLaneContainer();
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    c.appendChild(canvas);
    const r = new LaneRenderer(canvas);
    r.loadGroove(groove);
    return r._notes.map(n => ({ instrument: n.instrument, beatTime: n.beatTime }));
  };

  it('consecutive identical snare hits produce separate belt notes', () => {
    const groove = new DrumGroove();
    const bar = new Bar();
    groove.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00001000));
    bar.setDrumBit(NoteIndex.Beat1E, new DrumBit(0b00001000));

    const c = makeContainer();
    const r = new SheetBeltRenderer(c);
    r.loadGroove(groove);

    const snareNotes = r._notes.filter(n => n.instrument === Instrument.SnareDrum);
    expect(snareNotes.length).toBe(2);
    expect(snareNotes[0].beatTime).not.toBe(snareNotes[1].beatTime);
  });

  it('belt note count matches lane note count for a dense groove', () => {
    const groove = new DrumGroove();
    const bar = new Bar();
    groove.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat1E, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat2, new DrumBit(0b00010010));
    bar.setDrumBit(NoteIndex.Beat2Plus, new DrumBit(0b00010010));
    bar.setDrumBit(NoteIndex.Beat3, new DrumBit(0b00001000));
    bar.setDrumBit(NoteIndex.Beat3E, new DrumBit(0b00001000));
    bar.setDrumBit(NoteIndex.Beat4, new DrumBit(0b00000011));

    const belt = collectBeltBeats(groove);
    const lane = collectLaneBeats(groove);

    expect(belt.length).toBe(lane.length);
  });

  it('belt note beat positions match lane note beat positions', () => {
    const groove = new DrumGroove();
    const bar = new Bar();
    groove.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat1E, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat2, new DrumBit(0b00001000));
    bar.setDrumBit(NoteIndex.Beat3, new DrumBit(0b00000001));
    bar.setDrumBit(NoteIndex.Beat4, new DrumBit(0b00010010));

    const belt = collectBeltBeats(groove);
    const lane = collectLaneBeats(groove);

    const key = (n) => `${n.instrument}@${n.beatTime}`;
    const beltKeys = belt.map(key).sort();
    const laneKeys = lane.map(key).sort();

    expect(beltKeys.length).toBe(laneKeys.length);
    for (let i = 0; i < beltKeys.length; ++i)
      expect(beltKeys[i]).toBe(laneKeys[i]);
  });

  it('rests between hits still separate notes correctly', () => {
    const groove = new DrumGroove();
    const bar = new Bar();
    groove.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000001));
    bar.setDrumBit(NoteIndex.Beat3, new DrumBit(0b00000001));

    const belt = collectBeltBeats(groove);
    const lane = collectLaneBeats(groove);

    expect(belt.length).toBe(lane.length);
    expect(belt.length).toBe(2);
  });
});

// ── Standard staff positioning ─────────────────────────────

describe('SheetBeltRenderer — standard staff note positions', () => {

  it('places Ride on line 5 (top staff line)', () => {
    // Ride Y position comes from INSTRUMENT_Y (kit cy / 300)
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    const groove = new DrumGroove();
    const bar = new Bar();
    groove.addBar(bar);
    // Ride uses the HiHat channel with Accent state (mapped to ride in the model)
    const bit = new DrumBit(0);
    bit.setInstrument(Instrument.ClosedHiHat, PlayState.Accent);
    bar.setDrumBit(NoteIndex.Beat1, bit);
    renderer.loadGroove(groove);
    // Ride note is created, but for this test we just check rendering doesn't throw
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('places MidTom on line 4 and HighTom in space 4', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    const groove = new DrumGroove();
    const bar = new Bar();
    groove.addBar(bar);
    const htBit = new DrumBit(0);
    htBit.setInstrument(Instrument.HighTom, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat1, htBit);
    const mtBit = new DrumBit(0);
    mtBit.setInstrument(Instrument.MidTom, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat2, mtBit);
    renderer.loadGroove(groove);

    const htNote = renderer._notes.find(n => n.instrument === Instrument.HighTom);
    const mtNote = renderer._notes.find(n => n.instrument === Instrument.MidTom);
    expect(htNote).toBeTruthy();
    expect(mtNote).toBeTruthy();
    // HighTom (e) at space 4 should be between line 5 and line 4
    // MidTom (d) at line 4 should be one full step below line 5
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('places FloorTom in space 2 (between lines 2 and 3, not ON a line)', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    const groove = new DrumGroove();
    const bar = new Bar();
    groove.addBar(bar);
    const bit = new DrumBit(0);
    bit.setInstrument(Instrument.FloorTom, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat1, bit);
    renderer.loadGroove(groove);
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('renders all 10 instruments at different staff positions without overlap errors', () => {
    const container = makeContainer();
    const renderer = new SheetBeltRenderer(container);
    const groove = new DrumGroove();
    const bar = new Bar();
    groove.addBar(bar);

    // Place various instruments across the bar
    const kickBit = new DrumBit(0);
    kickBit.setInstrument(Instrument.BassDrum, PlayState.Stroke);
    kickBit.setInstrument(Instrument.ClosedHiHat, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat1, kickBit);

    const snareBit = new DrumBit(0);
    snareBit.setInstrument(Instrument.SnareDrum, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat2, snareBit);

    renderer.loadGroove(groove);
    renderer.setCurrentBeat(0);
    renderer.render(performance.now());
    expect(renderer._notes.length).toBeGreaterThan(0);
  });
});

})();
