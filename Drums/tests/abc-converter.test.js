// Tests for abc-converter.js

(function () {
'use strict';

const { describe, it, expect } = window.TestRunner;
const { DrumBit, Bar, DrumGroove, NoteIndex, PlayState, Instrument, AbcConverter } = window.SZDrums;

// ────────────────────────────────────────────────────────────
// drumBitToAbc — individual note rendering
// ────────────────────────────────────────────────────────────

describe('AbcConverter.drumBitToAbc', () => {
  it('silence produces empty string', () => {
    const bit = new DrumBit(0b00000000);
    expect(AbcConverter.drumBitToAbc(bit)).toBe('');
  });

  it('bass drum only produces "F"', () => {
    const bit = new DrumBit(0b00000001);
    expect(AbcConverter.drumBitToAbc(bit)).toContain('F');
  });

  it('snare stroke produces "c"', () => {
    const bit = new DrumBit(0b00010000);
    expect(AbcConverter.drumBitToAbc(bit)).toContain('c');
  });

  it('closed hi-hat produces "ng"', () => {
    const bit = new DrumBit(0b00000010);
    expect(AbcConverter.drumBitToAbc(bit)).toContain('ng');
  });

  it('snare ghost contains parentheses markers', () => {
    // ghost = snare state 011 → 0b00110000
    const bit = new DrumBit(0b00110000);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('"@-6,-15("');
  });

  it('snare flam contains grace note syntax', () => {
    // flam is in SnareFlamRuff mode: 10000000
    const bit = new DrumBit(0b10000000);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('{/c}c');
  });

  it('snare ruff contains double grace note', () => {
    // ruff is in SnareFlamRuff mode: 10000010
    const bit = new DrumBit(0b10000010);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('{/cc}c');
  });

  it('crash stroke produces "na"', () => {
    // crash = snare state 101 → 0b01010000
    const bit = new DrumBit(0b01010000);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('na');
  });

  it('crash choke contains dot prefix', () => {
    // crashChoke = snare state 111 → 0b01110000
    const bit = new DrumBit(0b01110000);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('.na');
  });

  it('crash accent contains !accent! prefix', () => {
    // crashAccent = snare state 110 → 0b01100000
    const bit = new DrumBit(0b01100000);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('!accent!');
    expect(abc).toContain('na');
  });

  it('open hi-hat contains !open! prefix', () => {
    const bit = new DrumBit(0b00000110);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('!open!ng');
  });

  it('ride produces "nf"', () => {
    // ride = rrr state 100 → 0b00001000
    const bit = new DrumBit(0b00001000);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('nf');
  });

  it('ride bell produces "mf"', () => {
    // ride bell = rrr state 110 → 0b00001100
    const bit = new DrumBit(0b00001100);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('mf');
  });

  it('combined bass + snare + closed hi-hat', () => {
    const bit = new DrumBit(0b00010011);
    const abc = AbcConverter.drumBitToAbc(bit);
    expect(abc).toContain('c');
    expect(abc).toContain('F');
    expect(abc).toContain('ng');
  });
});

// ────────────────────────────────────────────────────────────
// drumBitToSymbol — wrapped notation
// ────────────────────────────────────────────────────────────

describe('AbcConverter.drumBitToSymbol', () => {
  it('silence produces "z"', () => {
    const bit = new DrumBit(0b00000000);
    expect(AbcConverter.drumBitToSymbol(bit)).toBe('z');
  });

  it('non-silence wraps in square brackets', () => {
    const bit = new DrumBit(0b00000001);
    const sym = AbcConverter.drumBitToSymbol(bit);
    expect(sym).toContain('[');
    expect(sym).toContain(']');
  });

  it('modifiers are moved before brackets', () => {
    // crash accent = snare state 110 → 0b01100000
    const bit = new DrumBit(0b01100000);
    const sym = AbcConverter.drumBitToSymbol(bit);
    // !accent! should appear before [
    const bracketPos = sym.indexOf('[');
    const accentPos = sym.indexOf('!accent!');
    expect(accentPos).toBeLessThan(bracketPos);
  });
});

// ────────────────────────────────────────────────────────────
// barToAbc — bar conversion
// ────────────────────────────────────────────────────────────

describe('AbcConverter.barToAbc', () => {
  it('empty bar produces z16', () => {
    const bar = new Bar();
    const converter = new AbcConverter();
    const abc = converter.barToAbc(bar);
    expect(abc).toContain('z');
  });

  it('single note at beat 1 does not produce just "z"', () => {
    const bar = new Bar();
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000001));
    const converter = new AbcConverter();
    const abc = converter.barToAbc(bar);
    expect(abc).toContain('F');
  });
});

// ────────────────────────────────────────────────────────────
// convert — full groove
// ────────────────────────────────────────────────────────────

describe('AbcConverter.convert', () => {
  it('produces valid ABC header', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    const converter = new AbcConverter();
    const abc = converter.convert(groove);
    expect(abc).toContain('%abc');
    expect(abc).toContain('X:1');
    expect(abc).toContain('M:4/4');
    expect(abc).toContain('K:clef=perc');
    expect(abc).toContain('L:1/16');
  });

  it('includes title and artist', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    const converter = new AbcConverter();
    const abc = converter.convert(groove, 'Test Title', 'Test Artist');
    expect(abc).toContain('T:Test Title');
    expect(abc).toContain('C:Test Artist');
  });

  it('wraps body in repeat markers', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    const converter = new AbcConverter();
    const abc = converter.convert(groove);
    expect(abc).toContain('|:');
    expect(abc).toContain(':|');
  });

  it('multiple bars are separated by |', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    groove.addBar(new Bar());
    const converter = new AbcConverter();
    const abc = converter.convert(groove);
    expect(abc).toContain(' | ');
  });

  it('default BPM produces Q:1/4=60', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    const converter = new AbcConverter();
    const abc = converter.convert(groove);
    expect(abc).toContain('Q:1/4=60');
  });

  it('explicit BPM 120 produces Q:1/4=120', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    const converter = new AbcConverter();
    const abc = converter.convert(groove, undefined, undefined, undefined, 120);
    expect(abc).toContain('Q:1/4=120');
    expect(abc).not.toContain('Q:1/4=60');
  });

  it('includes MIDI drum map directives', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    const converter = new AbcConverter();
    const abc = converter.convert(groove);
    expect(abc).toContain('%%MIDI drummap c 38');
    expect(abc).toContain('%%MIDI drummap F 36');
    expect(abc).toContain('%%MIDI drummap g 42');
    expect(abc).toContain('%%MIDI channel 10');
  });
});

// ────────────────────────────────────────────────────────────
// _extractBody — header stripping
// ────────────────────────────────────────────────────────────

describe('AbcConverter._extractBody', () => {
  it('strips header lines and returns body', () => {
    const abc = '%abc\nX:1\nT:Test\nM:4/4\nK:clef=perc\nL:1/16\n|: z16 :|';
    const body = AbcConverter._extractBody(abc);
    expect(body).not.toContain('X:1');
    expect(body).not.toContain('%abc');
    expect(body).toContain('z16');
  });

  it('strips repeat markers from body', () => {
    const abc = 'X:1\nL:1/16\n|: [Fng]2[ng]2 :|';
    const body = AbcConverter._extractBody(abc);
    expect(body).not.toContain('|:');
    expect(body).not.toContain(':|');
    expect(body).toContain('[Fng]2');
  });

  it('preserves bar separators between bars', () => {
    const abc = 'X:1\nL:1/16\n|: z16 | z16 :|';
    const body = AbcConverter._extractBody(abc);
    expect(body).toContain('|');
  });

  it('strips MIDI directives', () => {
    const abc = '%%MIDI channel 10\n%%MIDI drummap c 38\n|: z16 :|';
    const body = AbcConverter._extractBody(abc);
    expect(body).not.toContain('MIDI');
  });

  it('returns empty string for header-only input', () => {
    const abc = 'X:1\nT:Test\nM:4/4';
    const body = AbcConverter._extractBody(abc);
    expect(body).toBe('');
  });

  it('converts :: double repeat to bar separator', () => {
    const abc = 'X:1\nL:1/16\n|: z16 :: z16 :|';
    const body = AbcConverter._extractBody(abc);
    const bars = body.split('|').map(s => s.trim()).filter(s => s.length > 0);
    expect(bars.length).toBe(2);
  });

  it('filters P: part label lines', () => {
    const abc = 'X:1\nL:1/16\nP:Grooves\n|: z16 :|';
    const body = AbcConverter._extractBody(abc);
    expect(body).not.toContain('Grooves');
    expect(body).toContain('z16');
  });
});

// ────────────────────────────────────────────────────────────
// _tokenizeBar — bar string tokenization
// ────────────────────────────────────────────────────────────

describe('AbcConverter._tokenizeBar', () => {
  it('tokenizes a rest with duration', () => {
    const { tokens } = AbcConverter._tokenizeBar('z16');
    expect(tokens.length).toBe(1);
    expect(tokens[0].isRest).toBe(true);
    expect(tokens[0].duration).toBe(16);
  });

  it('tokenizes a chord with duration', () => {
    const { tokens } = AbcConverter._tokenizeBar('[Fng]2');
    expect(tokens.length).toBe(1);
    expect(tokens[0].notes).toBe('Fng');
    expect(tokens[0].duration).toBe(2);
    expect(tokens[0].isRest).toBe(false);
  });

  it('tokenizes multiple chords with whitespace', () => {
    const { tokens } = AbcConverter._tokenizeBar('[Fng]2[ng]2 [cng]2[ng]2');
    expect(tokens.length).toBe(4);
    expect(tokens[0].notes).toBe('Fng');
    expect(tokens[2].notes).toBe('cng');
  });

  it('tokenizes prefix decorations', () => {
    const { tokens } = AbcConverter._tokenizeBar('!accent![cng]');
    expect(tokens.length).toBe(1);
    expect(tokens[0].prefix.length).toBeGreaterThan(0);
    expect(tokens[0].prefix[0]).toBe('!accent!');
  });

  it('tokenizes grace note prefix', () => {
    const { tokens } = AbcConverter._tokenizeBar('{/c}[cF]');
    expect(tokens.length).toBe(1);
    expect(tokens[0].prefix).toContain('{/c}');
  });

  it('tokenizes choke (dot) prefix', () => {
    const { tokens } = AbcConverter._tokenizeBar('.[na]');
    expect(tokens.length).toBe(1);
    expect(tokens[0].prefix).toContain('.');
  });

  it('tokenizes single note without brackets', () => {
    const { tokens } = AbcConverter._tokenizeBar('c2');
    expect(tokens.length).toBe(1);
    expect(tokens[0].notes).toBe('c');
    expect(tokens[0].duration).toBe(2);
  });

  it('tokenizes cross-notehead single note', () => {
    const { tokens } = AbcConverter._tokenizeBar('nD');
    expect(tokens.length).toBe(1);
    expect(tokens[0].notes).toBe('nD');
  });

  it('default duration is 1', () => {
    const { tokens } = AbcConverter._tokenizeBar('[cF]');
    expect(tokens[0].duration).toBe(1);
  });

  it('skips [P:...] inline part markers', () => {
    const { tokens } = AbcConverter._tokenizeBar('[P:Basic Lead Right]c c c c');
    expect(tokens.length).toBe(4);
    expect(tokens[0].notes).toBe('c');
  });

  it('handles [L:1/8] by doubling durations', () => {
    const { tokens, unitMultiplier } = AbcConverter._tokenizeBar('[L:1/8][Fng]ng');
    expect(unitMultiplier).toBe(2);
    expect(tokens.length).toBe(2);
    expect(tokens[0].duration).toBe(2);
    expect(tokens[1].duration).toBe(2);
  });

  it('handles [L:1/16] restoring single-sixteenth durations', () => {
    const { tokens } = AbcConverter._tokenizeBar('[L:1/16]cccc');
    expect(tokens.length).toBe(4);
    expect(tokens[0].duration).toBe(1);
  });

  it('handles mid-bar [L:] change', () => {
    const { tokens } = AbcConverter._tokenizeBar('[Fng]ng [L:1/16]cccc');
    // First two notes at default mult=1, last four at mult=1
    expect(tokens.length).toBe(6);
    expect(tokens[0].duration).toBe(1);
    expect(tokens[4].duration).toBe(1);
  });

  it('carries incoming unitMultiplier into durations', () => {
    const { tokens } = AbcConverter._tokenizeBar('[Fng]ng', 2);
    expect(tokens[0].duration).toBe(2);
    expect(tokens[1].duration).toBe(2);
  });

  it('sticking annotations are harmless prefix entries', () => {
    const { tokens } = AbcConverter._tokenizeBar('"R"c"L"c');
    expect(tokens.length).toBe(2);
    expect(tokens[0].notes).toBe('c');
    expect(tokens[1].notes).toBe('c');
  });

  it('skips [K:...] and other inline fields', () => {
    const { tokens } = AbcConverter._tokenizeBar('[K:clef=perc]c');
    expect(tokens.length).toBe(1);
    expect(tokens[0].notes).toBe('c');
  });

  it('tokenizes triangle notehead prefix (m)', () => {
    const { tokens } = AbcConverter._tokenizeBar('mf');
    expect(tokens.length).toBe(1);
    expect(tokens[0].notes).toBe('mf');
  });
});

// ────────────────────────────────────────────────────────────
// _tokenToDrumBit — token to DrumBit conversion
// ────────────────────────────────────────────────────────────

describe('AbcConverter._tokenToDrumBit', () => {
  it('rest token produces silence', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: '', isRest: true, duration: 1 });
    expect(bit.bitPattern).toBe(0);
  });

  it('bass drum note "F" produces bass kick', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'F', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('snare note "c" produces snare stroke', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'c', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
  });

  it('closed hi-hat "ng" produces closed HH stroke', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'ng', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Stroke);
  });

  it('chord "cFng" produces bass + snare + closed HH', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'cFng', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(bit.getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Stroke);
  });

  it('!accent! prefix sets accent on snare', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['!accent!'], notes: 'c', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Accent);
  });

  it('ghost markers set ghost on snare', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['"@-6,-15("', '"@10,-15)"'], notes: 'c', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ghost);
  });

  it('cross-notehead "nc" produces snare click', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'nc', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Click);
  });

  it('grace note {/c} produces snare flam', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['{/c}'], notes: 'c', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Flam);
  });

  it('double grace note {/cc} produces snare ruff', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['{/cc}'], notes: 'c', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ruff);
  });

  it('!open! prefix with "ng" produces open hi-hat', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['!open!'], notes: 'ng', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.OpenHiHat)).toBe(PlayState.Stroke);
  });

  it('dot prefix with "na" produces crash choke', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['.'], notes: 'na', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Choke);
  });

  it('"nD" produces hi-hat pedal', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'nD', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.HiHatPedal)).toBe(PlayState.Stroke);
  });

  it('"na" without choke produces crash stroke', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'na', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Stroke);
  });

  it('!accent! "na" produces crash accent', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['!accent!'], notes: 'na', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Accent);
  });

  it('"nf" produces ride stroke', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'nf', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
  });

  it('!accent! "nf" produces ride accent', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['!accent!'], notes: 'nf', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.Ride)).toBe(PlayState.Accent);
  });

  it('"mf" produces ride bell stroke', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'mf', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Stroke);
  });

  it('!accent! "mf" produces ride bell accent', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['!accent!'], notes: 'mf', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Accent);
  });

  it('floor tom "A" produces floor tom stroke', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'A', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Stroke);
  });

  it('mid tom "d" produces mid tom stroke', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'd', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.MidTom)).toBe(PlayState.Stroke);
  });

  it('high tom "e" produces high tom stroke', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'e', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.HighTom)).toBe(PlayState.Stroke);
  });
});

// ────────────────────────────────────────────────────────────
// parseAbc — end-to-end parsing
// ────────────────────────────────────────────────────────────

describe('AbcConverter.parseAbc', () => {
  it('parses empty bar into groove with one bar of silence', () => {
    const abc = 'X:1\nL:1/16\n|: z16 :|';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(1);
    for (let i = 0; i < 16; ++i)
      expect(groove.bars[0].bits[i].bitPattern).toBe(0);
  });

  it('parses two bars', () => {
    const abc = 'X:1\nL:1/16\n|: z16 | z16 :|';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(2);
  });

  it('parses bass drum at beat 1', () => {
    const abc = 'X:1\nL:1/16\n|: [F]z15 :|';
    const groove = AbcConverter.parseAbc(abc);
    const bar = groove.bars[0];
    expect(bar.getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    expect(bar.getDrumBit(NoteIndex.Beat1E).getInstrument(Instrument.BassDrum)).toBe(PlayState.Silence);
  });

  it('round-trips a basic rock beat (drumkit mode)', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);

    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat3, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat2, new DrumBit(0b00010010));
    bar.setDrumBit(NoteIndex.Beat4, new DrumBit(0b00010010));
    bar.setDrumBit(NoteIndex.Beat1Plus, new DrumBit(0b00000010));
    bar.setDrumBit(NoteIndex.Beat2Plus, new DrumBit(0b00000010));
    bar.setDrumBit(NoteIndex.Beat3Plus, new DrumBit(0b00000010));
    bar.setDrumBit(NoteIndex.Beat4Plus, new DrumBit(0b00000010));

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);

    expect(parsed.bars.length).toBe(1);
    const parsedBar = parsed.bars[0];

    const checkInstrument = (noteIdx, instrument, expected) => {
      const actual = parsedBar.getDrumBit(noteIdx).getInstrument(instrument);
      expect(actual).toBe(expected);
    };

    checkInstrument(NoteIndex.Beat1, Instrument.BassDrum, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat1, Instrument.ClosedHiHat, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat3, Instrument.BassDrum, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat3, Instrument.ClosedHiHat, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat2, Instrument.SnareDrum, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat2, Instrument.ClosedHiHat, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat4, Instrument.SnareDrum, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat4, Instrument.ClosedHiHat, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat1Plus, Instrument.ClosedHiHat, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat2Plus, Instrument.ClosedHiHat, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat3Plus, Instrument.ClosedHiHat, PlayState.Stroke);
    checkInstrument(NoteIndex.Beat4Plus, Instrument.ClosedHiHat, PlayState.Stroke);

    checkInstrument(NoteIndex.Beat1E, Instrument.BassDrum, PlayState.Silence);
    checkInstrument(NoteIndex.Beat1E, Instrument.ClosedHiHat, PlayState.Silence);
    checkInstrument(NoteIndex.Beat1E, Instrument.SnareDrum, PlayState.Silence);
  });

  it('round-trips snare ghost', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Ghost);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ghost);
  });

  it('round-trips snare flam', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Flam);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Flam);
  });

  it('round-trips snare ruff', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.SnareDrum, PlayState.Ruff);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Ruff);
  });

  it('round-trips snare click', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00100000));

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Click);
  });

  it('round-trips open hi-hat', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000110));

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.OpenHiHat)).toBe(PlayState.Stroke);
  });

  it('round-trips crash stroke', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Crash, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.Crash)).toBe(PlayState.Stroke);
  });

  it('round-trips crash choke', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Crash, PlayState.Choke);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.Crash)).toBe(PlayState.Choke);
  });

  it('round-trips crash accent', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Crash, PlayState.Accent);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.Crash)).toBe(PlayState.Accent);
  });

  it('round-trips hi-hat pedal', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000100));

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.HiHatPedal)).toBe(PlayState.Stroke);
  });

  it('round-trips ride stroke', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Ride, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
  });

  it('round-trips ride bell stroke', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.RideBell, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    expect(parsed.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.RideBell)).toBe(PlayState.Stroke);
  });

  it('round-trips ride + snare + bass on same beat', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Ride, PlayState.Stroke);
    bit.setInstrument(Instrument.SnareDrum, PlayState.Stroke);
    bit.setInstrument(Instrument.BassDrum, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    const pb = parsed.bars[0].getDrumBit(NoteIndex.Beat1);
    expect(pb.getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
    expect(pb.getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(pb.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('round-trips crash + ride + bass on same beat', () => {
    const original = new DrumGroove();
    const bar = new Bar();
    original.addBar(bar);
    const bit = new DrumBit();
    bit.setInstrument(Instrument.Crash, PlayState.Stroke);
    bit.setInstrument(Instrument.Ride, PlayState.Stroke);
    bit.setInstrument(Instrument.BassDrum, PlayState.Stroke);
    bar.setDrumBit(NoteIndex.Beat1, bit);

    const abc = new AbcConverter().convert(original);
    const parsed = AbcConverter.parseAbc(abc);
    const pb = parsed.bars[0].getDrumBit(NoteIndex.Beat1);
    expect(pb.getInstrument(Instrument.Crash)).toBe(PlayState.Stroke);
    expect(pb.getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
    expect(pb.getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
  });

  it('handles multi-line body', () => {
    const abc = 'X:1\nL:1/16\n|: z16 |\nz16 :|';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(2);
  });

  it('returns empty groove for header-only ABC', () => {
    const abc = 'X:1\nT:Test\nM:4/4';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(0);
  });

  it('parses :: double-repeat as bar separator', () => {
    const abc = 'X:1\nL:1/16\n|: c16 :: c16 :|';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(2);
    expect(groove.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(groove.bars[1].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
  });

  it('skips [P:...] inline part markers without producing instruments', () => {
    const abc = 'X:1\nL:1/16\n[P:Basic Lead Right] c16';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(1);
    expect(groove.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(groove.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.Crash)).toBe(PlayState.Silence);
    expect(groove.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.HighTom)).toBe(PlayState.Silence);
  });

  it('handles [L:1/8] doubling duration within a bar', () => {
    const abc = 'X:1\nL:1/16\n[L:1/8] c8';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(1);
    expect(groove.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(groove.bars[0].getDrumBit(NoteIndex.Beat1E).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Silence);
  });

  it('handles [L:1/16] restoring duration after [L:1/8]', () => {
    const abc = 'X:1\nL:1/16\n|: [L:1/8] c8 | [L:1/16] c c c c c c c c c c c c c c c c :|';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(2);
    expect(groove.bars[1].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(groove.bars[1].getDrumBit(NoteIndex.Beat1E).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(groove.bars[1].getDrumBit(NoteIndex.Beat4A).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
  });

  it('ignores sticking annotations "R" and "L"', () => {
    const abc = 'X:1\nL:1/16\n"R"c "L"c z14';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(1);
    expect(groove.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(groove.bars[0].getDrumBit(NoteIndex.Beat1E).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(groove.bars[0].getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.Crash)).toBe(PlayState.Silence);
  });

  it('parses Roll-style Grooves section with :: and [L:1/8]', () => {
    const abc = 'X:1\nT:Roll\nL:1/16\nP:Grooves\n|: [L:1/8] "R"c "L"c "R"c "L"c "R"c "L"c "R"c "L"c :: "R"c "L"c "R"c "L"c "R"c "L"c "R"c "L"c :|';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(2);
    for (let b = 0; b < 2; ++b) {
      const bar = groove.bars[b];
      expect(bar.getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
      expect(bar.getDrumBit(NoteIndex.Beat2).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
      expect(bar.getDrumBit(NoteIndex.Beat3).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
      expect(bar.getDrumBit(NoteIndex.Beat4).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
      expect(bar.getDrumBit(NoteIndex.Beat1Plus).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
      expect(bar.getDrumBit(NoteIndex.Beat2Plus).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
      expect(bar.getDrumBit(NoteIndex.Beat3Plus).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
      expect(bar.getDrumBit(NoteIndex.Beat4Plus).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
      expect(bar.getDrumBit(NoteIndex.Beat1E).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Silence);
    }
  });

  it('parses Roll-style Fills section with [L:1/16] after [L:1/8]', () => {
    const abc = 'X:1\nT:Roll\nL:1/16\n|: [L:1/8] c c c c c c c c | [L:1/16] c c c c c c c c c c c c c c c c :|';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(2);
    const bar1 = groove.bars[0];
    expect(bar1.getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(bar1.getDrumBit(NoteIndex.Beat1E).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Silence);
    expect(bar1.getDrumBit(NoteIndex.Beat1Plus).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    const bar2 = groove.bars[1];
    expect(bar2.getDrumBit(NoteIndex.Beat1).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(bar2.getDrumBit(NoteIndex.Beat1E).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(bar2.getDrumBit(NoteIndex.Beat1Plus).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
    expect(bar2.getDrumBit(NoteIndex.Beat4A).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
  });

  it('P: standalone part labels are filtered from body', () => {
    const abc = 'X:1\nL:1/16\nP:Grooves\nc16\nP:Fills\nc16';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────
// Accidentals, m prefix, B/b notes, fractional durations
// ────────────────────────────────────────────────────────────

describe('AbcConverter — accidentals and extended notes', () => {

  it('tokenizes accidental ^g as a single note', () => {
    const { tokens } = AbcConverter._tokenizeBar('^g');
    expect(tokens.length).toBe(1);
    expect(tokens[0].notes).toBe('^g');
  });

  it('tokenizes n^g (cross notehead with accidental) as a single note', () => {
    const { tokens } = AbcConverter._tokenizeBar('n^g');
    expect(tokens.length).toBe(1);
    expect(tokens[0].notes).toBe('n^g');
  });

  it('preserves !open! prefix on n^g for open hi-hat', () => {
    const { tokens } = AbcConverter._tokenizeBar('!open!n^g');
    expect(tokens.length).toBe(1);
    expect(tokens[0].prefix).toContain('!open!');
    expect(tokens[0].notes).toBe('n^g');
  });

  it('parses !open!n^g as open hi-hat', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: ['!open!'], notes: 'n^g', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.OpenHiHat)).toBe(PlayState.Stroke);
  });

  it('tokenizes m prefix (triangle notehead) with note letter', () => {
    const { tokens } = AbcConverter._tokenizeBar('mf');
    expect(tokens.length).toBe(1);
    expect(tokens[0].notes).toBe('mf');
  });

  it('parses mf as ride bell (triangle notehead)', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'mf', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.RideBell)).toBe(PlayState.Stroke);
  });

  it('parses B as floor tom (low tom mapped to closest)', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'B', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.FloorTom)).toBe(PlayState.Stroke);
  });

  it('parses nb as crash (chinese cymbal mapped to closest)', () => {
    const bit = AbcConverter._tokenToDrumBit({ prefix: [], notes: 'nb', isRest: false, duration: 1 });
    expect(bit.getInstrument(Instrument.Crash)).toBe(PlayState.Stroke);
  });

  it('parses fractional duration c1/2 with L:1/4', () => {
    const { tokens } = AbcConverter._tokenizeBar('c1/2', 4);
    expect(tokens.length).toBe(1);
    expect(tokens[0].duration).toBe(2);
  });

  it('parses fractional duration F3/2 with L:1/4', () => {
    const { tokens } = AbcConverter._tokenizeBar('F3/2', 4);
    expect(tokens.length).toBe(1);
    expect(tokens[0].duration).toBe(6);
  });

  it('parses bare /2 as half default duration with L:1/4', () => {
    const { tokens } = AbcConverter._tokenizeBar('c/2', 4);
    expect(tokens.length).toBe(1);
    expect(tokens[0].duration).toBe(2);
  });

  it('parses bare / as /2 with L:1/4', () => {
    const { tokens } = AbcConverter._tokenizeBar('c/', 4);
    expect(tokens.length).toBe(1);
    expect(tokens[0].duration).toBe(2);
  });

  it('parses Master Drum Key cymbals line', () => {
    const abc = 'X:1\nL:1/4\n"Foot"nD "R"nf "R"mf "L"ng "L"!open!n^g "L"na "R"nb |';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(1);
    const bar = groove.bars[0];
    const b = (idx) => bar.getDrumBit(idx);
    expect(b(NoteIndex.Beat1).getInstrument(Instrument.HiHatPedal)).toBe(PlayState.Stroke);
    expect(b(NoteIndex.Beat2).getInstrument(Instrument.Ride)).toBe(PlayState.Stroke);
    expect(b(NoteIndex.Beat3).getInstrument(Instrument.RideBell)).toBe(PlayState.Stroke);
    expect(b(NoteIndex.Beat4).getInstrument(Instrument.ClosedHiHat)).toBe(PlayState.Stroke);
  });

  it('parses Master Drum Key drums line', () => {
    const abc = 'X:1\nL:1/4\n"Foot"F "R"A "R"B "L"c "L"nc "R"d "L"e |';
    const groove = AbcConverter.parseAbc(abc);
    expect(groove.bars.length).toBe(1);
    const bar = groove.bars[0];
    const b = (idx) => bar.getDrumBit(idx);
    expect(b(NoteIndex.Beat1).getInstrument(Instrument.BassDrum)).toBe(PlayState.Stroke);
    expect(b(NoteIndex.Beat2).getInstrument(Instrument.FloorTom)).toBe(PlayState.Stroke);
    expect(b(NoteIndex.Beat3).getInstrument(Instrument.FloorTom)).toBe(PlayState.Stroke);
    expect(b(NoteIndex.Beat4).getInstrument(Instrument.SnareDrum)).toBe(PlayState.Stroke);
  });
});

})();
