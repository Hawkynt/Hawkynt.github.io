// Tests for model.js — DrumBit, Bar, DrumGroove

(function () {
'use strict';

const { describe, it, expect, beforeEach } = window.TestRunner;
const { Instrument, PlayState, NoteIndex, DrumBit, Bar, DrumGroove } = window.SZDrums;

// ────────────────────────────────────────────────────────────
// DrumBit — construction & silence
// ────────────────────────────────────────────────────────────

describe('DrumBit — construction', () => {
  it('defaults to silence pattern (0x00)', () => {
    const bit = new DrumBit();
    expect(bit.bitPattern).toBe(0b00000000);
  });

  it('accepts a bit pattern in constructor', () => {
    const bit = new DrumBit(0b01010101);
    expect(bit.bitPattern).toBe(0b01010101);
  });

  it('masks to 8 bits', () => {
    const bit = new DrumBit(0x1FF);
    expect(bit.bitPattern).toBe(0xFF);
  });

  it('silence returns Silence for all instruments', () => {
    const bit = new DrumBit(0b00000000);
    for (const instr of Object.values(Instrument))
      expect(bit.getInstrument(instr)).toBe(PlayState.Silence);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — DrumKit mode: bass drum
// ────────────────────────────────────────────────────────────

describe('DrumBit — bass drum', () => {
  it('bit 0 set = bass drum stroke', () => {
    const bit = new DrumBit(0b00000001);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('bit 0 clear = bass drum silence', () => {
    const bit = new DrumBit(0b00000000);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
  });

  it('bass drum with closed hi-hat', () => {
    const bit = new DrumBit(0b00000011); // hi-hat closed (001<<1) + bass (1)
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Stroke);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — DrumKit mode: right-hand cymbal (rrr bits 3-1)
// ────────────────────────────────────────────────────────────

describe('DrumBit — right-hand cymbal channel', () => {
  it('closed hi-hat (001)', () => {
    const bit = new DrumBit(0b00000010);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Stroke);
  });

  it('pedal hi-hat (010)', () => {
    const bit = new DrumBit(0b00000100);
    expect(bit.getInstrument(Instrument.HiHatPedal)).toBe(PlayState.Stroke);
  });

  it('open hi-hat (011)', () => {
    const bit = new DrumBit(0b00000110);
    expect(bit.getInstrument(Instrument.OpenHiHat)).toBe(PlayState.Stroke);
  });

  it('ride (100)', () => {
    const bit = new DrumBit(0b00001000);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
  });

  it('ride accent (101)', () => {
    const bit = new DrumBit(0b00001010);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Accent);
  });

  it('ride bell (110)', () => {
    const bit = new DrumBit(0b00001100);
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Stroke);
  });

  it('ride bell accent (111)', () => {
    const bit = new DrumBit(0b00001110);
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Accent);
  });

  it('no cymbal (000) = silence for all right-hand instruments', () => {
    const bit = new DrumBit(0b00000000);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.OpenHiHat)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.HiHatPedal)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Silence);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — DrumKit mode: left-hand snare/crash (lll bits 6-4)
// ────────────────────────────────────────────────────────────

describe('DrumBit — left-hand snare/crash channel', () => {
  it('snare stroke (001)', () => {
    const bit = new DrumBit(0b00010000);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
  });

  it('snare click/sidestick (010)', () => {
    const bit = new DrumBit(0b00100000);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Click);
  });

  it('snare ghost (011)', () => {
    const bit = new DrumBit(0b00110000);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ghost);
  });

  it('snare rimshot (100)', () => {
    const bit = new DrumBit(0b01000000);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Rimshot);
  });

  it('crash (101)', () => {
    const bit = new DrumBit(0b01010000);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Stroke);
  });

  it('crash accent (110)', () => {
    const bit = new DrumBit(0b01100000);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Accent);
  });

  it('crash choke (111)', () => {
    const bit = new DrumBit(0b01110000);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Choke);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — combined drum-kit patterns
// ────────────────────────────────────────────────────────────

describe('DrumBit — combined drum-kit', () => {
  it('snare stroke + closed hi-hat + bass drum (0b00010011)', () => {
    const bit = new DrumBit(0b00010011);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('crash + ride + bass drum', () => {
    // crash=101 in lll, ride=100 in rrr, bass=1
    const bit = new DrumBit(0b01011001);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('ride + snare + bass on same beat', () => {
    // snare stroke=001 in lll, ride=100 in rrr, bass=1
    const bit = new DrumBit(0b00011001);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('crash accent + ride bell accent + bass', () => {
    // crashAccent=110 in lll, rideBellAccent=111 in rrr, bass=1
    const bit = new DrumBit(0b01101111);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Accent);
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Accent);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — Toms mode: single toms
// ────────────────────────────────────────────────────────────

describe('DrumBit — single toms', () => {
  it('low tom only — stroke (left=01, right=00)', () => {
    // 1 001 01 00 = 0b10010100
    const bit = new DrumBit(0b10010100);
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Silence);
  });

  it('mid tom only — ghost (left=10, right=00)', () => {
    // 1 010 10 00 = 0b10101000
    const bit = new DrumBit(0b10101000);
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Ghost);
  });

  it('high tom only — accent (left=11, right=00)', () => {
    // 1 100 11 00 = 0b11001100
    const bit = new DrumBit(0b11001100);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Accent);
  });

  it('low tom only — flam (left=01, right=11)', () => {
    // 1 001 01 11 = 0b10010111
    const bit = new DrumBit(0b10010111);
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Flam);
  });

  it('mid tom only — ruff (left=10, right=11)', () => {
    // 1 010 10 11 = 0b10101011
    const bit = new DrumBit(0b10101011);
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Ruff);
  });

  it('high tom only — rimshot (left=11, right=11)', () => {
    // 1 100 11 11 = 0b11001111
    const bit = new DrumBit(0b11001111);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Rimshot);
  });

  it('single tom flam via right=01 (repurposed pattern)', () => {
    // 1 001 01 01 = 0b10010101 — low tom, left=stroke, right=stroke → Flam
    const bit = new DrumBit(0b10010101);
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Flam);
  });

  it('single tom ruff via right=10 (repurposed pattern)', () => {
    // 1 001 01 10 = 0b10010110 — low tom, left=stroke, right=quiet → Ruff
    const bit = new DrumBit(0b10010110);
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Ruff);
  });

  it('high tom flam via right=01', () => {
    // 1 100 01 01 = 0b11000101
    const bit = new DrumBit(0b11000101);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Flam);
  });

  it('mid tom ruff via right=10', () => {
    // 1 010 01 10 = 0b10100110
    const bit = new DrumBit(0b10100110);
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Ruff);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — Toms mode: dual toms
// ────────────────────────────────────────────────────────────

describe('DrumBit — dual toms', () => {
  it('high+mid tom — left stroke, right ghost', () => {
    // 1 110 01 10 = 0b11100110
    const bit = new DrumBit(0b11100110);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Ghost);
  });

  it('mid+low tom — left accent, right stroke', () => {
    // 1 011 11 01 = 0b10111101 — mmm=011, ll=11
    const bit = new DrumBit(0b10111101);
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Accent);
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Stroke);
  });

  it('snare+low tom — left stroke, right stroke', () => {
    // 1 000 01 01 = 0b10000101
    const bit = new DrumBit(0b10000101);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Stroke);
  });

  it('snare+high tom — left ghost, right accent', () => {
    // 1 111 10 11 = 0b11111011
    const bit = new DrumBit(0b11111011);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ghost);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Accent);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — SnareFlamRuff toms mode pattern (1 000 00 rr)
// ────────────────────────────────────────────────────────────

describe('DrumBit — SnareFlamRuff pattern', () => {
  it('snare flam alone (10000000)', () => {
    const bit = new DrumBit(0b10000000);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Flam);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
  });

  it('snare flam + bass (10000001)', () => {
    const bit = new DrumBit(0b10000001);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Flam);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('snare ruff alone (10000010)', () => {
    const bit = new DrumBit(0b10000010);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ruff);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
  });

  it('snare ruff + bass (10000011)', () => {
    const bit = new DrumBit(0b10000011);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ruff);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('SnareFlamRuff reports silence for toms', () => {
    const bit = new DrumBit(0b10000000);
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Silence);
  });

  it('SnareFlamRuff reports silence for cymbals', () => {
    const bit = new DrumBit(0b10000001);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Silence);
  });

  it('setInstrument(SnareDrum, Flam) + setInstrument(BassDrum, Stroke) round-trip', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Flam);
    bit.setInstrument(Instrument.BassDrum, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Flam);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    expect(bit.bitPattern).toBe(0b10000001);
  });

  it('setInstrument(SnareDrum, Ruff) + setInstrument(BassDrum, Stroke) round-trip', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Ruff);
    bit.setInstrument(Instrument.BassDrum, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ruff);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    expect(bit.bitPattern).toBe(0b10000011);
  });

  it('setInstrument preserves bass when switching flam to ruff', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Flam);
    bit.setInstrument(Instrument.BassDrum, PlayState.Stroke);
    expect(bit.bitPattern).toBe(0b10000001);
    bit.setInstrument(Instrument.SnareDrum, PlayState.Ruff);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ruff);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('silence clears SnareFlamRuff pattern', () => {
    const bit = new DrumBit(0b10000001);
    bit.setInstrument(Instrument.SnareDrum, PlayState.Silence);
    expect(bit.bitPattern).toBe(0b00000000);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — Toms mode does not report drum-kit instruments
// ────────────────────────────────────────────────────────────

describe('DrumBit — toms mode isolation', () => {
  it('toms mode returns silence for bass drum', () => {
    const bit = new DrumBit(0b10010100); // low tom stroke
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
  });

  it('toms mode returns silence for hi-hat and ride', () => {
    const bit = new DrumBit(0b10010100);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.OpenHiHat)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Silence);
  });

  it('drum-kit mode returns silence for toms', () => {
    const bit = new DrumBit(0b00010011); // snare+hh+bass
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Silence);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — setInstrument round-trip
// ────────────────────────────────────────────────────────────

describe('DrumBit — setInstrument round-trip', () => {
  it('set and get bass drum', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.BassDrum, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('set and get snare stroke', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
  });

  it('set and get snare ghost', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Ghost);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ghost);
  });

  it('set and get snare accent maps to rimshot', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Accent);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Rimshot);
  });

  it('set and get snare flam', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Flam);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Flam);
  });

  it('set and get snare ruff', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Ruff);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ruff);
  });

  it('set and get snare rimshot', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Rimshot);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Rimshot);
  });

  it('set and get snare click', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Click);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Click);
  });

  it('set and get closed hi-hat', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.ClosedHiHat, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Stroke);
  });

  it('set and get open hi-hat', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.OpenHiHat, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.OpenHiHat)).toBe(PlayState.Stroke);
  });

  it('set and get hi-hat pedal', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.HiHatPedal, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.HiHatPedal)).toBe(PlayState.Stroke);
  });

  it('set and get crash stroke', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Crash, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Stroke);
  });

  it('set and get crash accent', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Crash, PlayState.Accent);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Accent);
  });

  it('set and get crash choke', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Crash, PlayState.Choke);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Choke);
  });

  it('set and get ride stroke', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Ride, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
  });

  it('set and get ride accent', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Ride, PlayState.Accent);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Accent);
  });

  it('set and get ride bell stroke', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.RideBell, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Stroke);
  });

  it('set and get ride bell accent', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.RideBell, PlayState.Accent);
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Accent);
  });

  it('set bass + snare + hi-hat simultaneously', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.BassDrum, PlayState.Stroke);
    bit.setInstrument(Instrument.SnareDrum, PlayState.Stroke);
    bit.setInstrument(Instrument.ClosedHiHat, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Stroke);
  });

  it('silence clears bass drum', () => {
    const bit = new DrumBit(0b00000001);
    bit.setInstrument(Instrument.BassDrum, PlayState.Silence);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
  });

  it('silence clears snare', () => {
    const bit = new DrumBit(0b00010000);
    bit.setInstrument(Instrument.SnareDrum, PlayState.Silence);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Silence);
  });

  it('set and get floor tom stroke', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.FloorTom, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Stroke);
  });

  it('set and get mid tom ghost', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.MidTom, PlayState.Ghost);
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Ghost);
  });

  it('set and get high tom accent', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.HighTom, PlayState.Accent);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Accent);
  });

  it('set and get high tom flam', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.HighTom, PlayState.Flam);
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Flam);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — mutual exclusion
// ────────────────────────────────────────────────────────────

describe('DrumBit — mutual exclusion', () => {
  it('ride replaces closed hi-hat on same rrr bits', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.ClosedHiHat, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Stroke);
    bit.setInstrument(Instrument.Ride, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Silence);
  });

  it('crash replaces snare on same lll bits', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    bit.setInstrument(Instrument.Crash, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Silence);
  });

  it('crash + ride can coexist', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Crash, PlayState.Stroke);
    bit.setInstrument(Instrument.Ride, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
  });

  it('ride bell replaces ride on same rrr bits', () => {
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Ride, PlayState.Stroke);
    bit.setInstrument(Instrument.RideBell, PlayState.Stroke);
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Silence);
  });
});

// ────────────────────────────────────────────────────────────
// DrumBit — edge cases
// ────────────────────────────────────────────────────────────

describe('DrumBit — edge cases', () => {
  it('reserved pattern 0xC0 returns silence for all drumkit instruments', () => {
    const bit = new DrumBit(DrumBit.ReservedPattern);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Silence);
  });

  it('max drum-kit pattern 0x7F', () => {
    // lll=111 (CrashChoke), rrr=111 (RideBellAccent), b=1
    const bit = new DrumBit(0b01111111);
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Choke);
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Accent);
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('max toms pattern 0xFF', () => {
    const bit = new DrumBit(0b11111111);
    expect(bit.getInstrument(Instrument.SnareDrum)).not.toBe(PlayState.Silence);
    expect(bit.getInstrument(Instrument.HighTom)).not.toBe(PlayState.Silence);
  });
});

// ────────────────────────────────────────────────────────────
// Bar
// ────────────────────────────────────────────────────────────

describe('Bar', () => {
  it('has 16 DrumBit slots', () => {
    const bar = new Bar();
    expect(bar.bits.length).toBe(16);
  });

  it('all bits default to silence', () => {
    const bar = new Bar();
    for (let i = 0; i < 16; ++i)
      expect(bar.getDrumBit(i).bitPattern).toBe(0);
  });

  it('setDrumBit and getDrumBit round-trip', () => {
    const bar = new Bar();
    const bit = new DrumBit(0b00010011);
    bar.setDrumBit(NoteIndex.Beat1, bit);
    expect(bar.getDrumBit(NoteIndex.Beat1).bitPattern).toBe(0b00010011);
  });

  it('getDrumBit returns null for out-of-range index', () => {
    const bar = new Bar();
    expect(bar.getDrumBit(-1)).toBeNull();
    expect(bar.getDrumBit(16)).toBeNull();
  });

  it('clone produces independent copy', () => {
    const bar = new Bar();
    bar.setDrumBit(0, new DrumBit(0b01110111));
    const cloned = bar.clone();
    expect(cloned.getDrumBit(0).bitPattern).toBe(0b01110111);

    // mutate original, clone should not change
    bar.setDrumBit(0, new DrumBit(0));
    expect(cloned.getDrumBit(0).bitPattern).toBe(0b01110111);
  });
});

// ────────────────────────────────────────────────────────────
// DrumGroove
// ────────────────────────────────────────────────────────────

describe('DrumGroove', () => {
  it('starts with no bars', () => {
    const groove = new DrumGroove();
    expect(groove.bars.length).toBe(0);
  });

  it('addBar appends a bar', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    expect(groove.bars.length).toBe(1);
  });

  it('addBar inserts at index', () => {
    const groove = new DrumGroove();
    const bar0 = new Bar();
    bar0.setDrumBit(0, new DrumBit(0b00000001));
    const bar1 = new Bar();
    bar1.setDrumBit(0, new DrumBit(0b00000010));
    groove.addBar(bar0);
    groove.addBar(bar1, 0);
    expect(groove.getBar(0).getDrumBit(0).bitPattern).toBe(0b00000010);
    expect(groove.getBar(1).getDrumBit(0).bitPattern).toBe(0b00000001);
  });

  it('removeBar removes by index', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    groove.addBar(new Bar());
    groove.removeBar(0);
    expect(groove.bars.length).toBe(1);
  });

  it('removeBar ignores out-of-range', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    groove.removeBar(-1);
    groove.removeBar(5);
    expect(groove.bars.length).toBe(1);
  });

  it('getBar returns null for invalid index', () => {
    const groove = new DrumGroove();
    expect(groove.getBar(0)).toBeNull();
  });

  it('cloneBar produces independent copy', () => {
    const groove = new DrumGroove();
    const bar = new Bar();
    bar.setDrumBit(0, new DrumBit(0b01010101));
    groove.addBar(bar);

    const cloned = groove.cloneBar(0);
    expect(cloned.getDrumBit(0).bitPattern).toBe(0b01010101);

    bar.setDrumBit(0, new DrumBit(0));
    expect(cloned.getDrumBit(0).bitPattern).toBe(0b01010101);
  });

  it('cloneBar returns null for invalid index', () => {
    const groove = new DrumGroove();
    expect(groove.cloneBar(0)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// NoteIndex — enumeration completeness
// ────────────────────────────────────────────────────────────

describe('NoteIndex', () => {
  it('has 16 unique values from 0 to 15', () => {
    const values = Object.values(NoteIndex);
    expect(values.length).toBe(16);
    const unique = new Set(values);
    expect(unique.size).toBe(16);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(16);
    }
  });
});

})();
