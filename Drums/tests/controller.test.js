// SynthelicZ Drums — Controller Tests
// Tests for the pure-logic parts of controller.js.
// DOM-dependent integration tests are exercised by opening ABCPlayer.html?mode=random.

(function () {
'use strict';

const { describe, it, expect, beforeEach } = window.TestRunner;
const { DrumBit, Bar, DrumGroove, NoteIndex, AbcConverter } = window.SZDrums;

// ── Random groove generation (mirrors controller.js logic) ──

describe('Random groove generation', () => {

  it('first bar has rock pattern with correct bit patterns', () => {
    const bar = new Bar();
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat3, new DrumBit(0b00000011));
    bar.setDrumBit(NoteIndex.Beat2, new DrumBit(0b00010010));
    bar.setDrumBit(NoteIndex.Beat4, new DrumBit(0b00010010));
    bar.setDrumBit(NoteIndex.Beat1Plus, new DrumBit(0b00000010));
    bar.setDrumBit(NoteIndex.Beat2Plus, new DrumBit(0b00000010));
    bar.setDrumBit(NoteIndex.Beat3Plus, new DrumBit(0b00000010));
    bar.setDrumBit(NoteIndex.Beat4Plus, new DrumBit(0b00000010));

    expect(bar.getDrumBit(NoteIndex.Beat1).bitPattern).toBe(0b00000011);
    expect(bar.getDrumBit(NoteIndex.Beat2).bitPattern).toBe(0b00010010);
    expect(bar.getDrumBit(NoteIndex.Beat1Plus).bitPattern).toBe(0b00000010);
  });

  it('seven-bar groove converts to valid ABC', () => {
    const groove = new DrumGroove();

    let bar = new Bar();
    groove.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000011));

    bar = new Bar();
    groove.addBar(bar);
    bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b11110101));

    for (let i = 0; i < 5; ++i) {
      bar = new Bar();
      groove.addBar(bar);
      for (let j = 0; j < 16; ++j)
        bar.setDrumBit(j, new DrumBit(Math.floor(Math.random() * 256)));
    }

    const abc = new AbcConverter().convert(groove);
    expect(abc).toContain('X:1');
    expect(abc).toContain('M:4/4');
    expect(abc).toContain('K:clef=perc');
    expect(abc).toContain('|:');
    expect(abc).toContain(':|');
  });
});

// ── AbcConverter round-trip smoke tests ─────────────────────

describe('AbcConverter round-trip', () => {

  it('empty groove produces minimal ABC', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    const abc = new AbcConverter().convert(groove);
    expect(abc).toContain('z16');
  });

  it('title and artist appear in header', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    const abc = new AbcConverter().convert(groove, 'My Song', 'Me');
    expect(abc).toContain('T:My Song');
    expect(abc).toContain('C:Me');
  });

  it('multiple bars separated by pipe', () => {
    const groove = new DrumGroove();
    groove.addBar(new Bar());
    groove.addBar(new Bar());
    const abc = new AbcConverter().convert(groove);
    expect(abc).toContain(' | ');
  });
});

// ── URL parameter helper (pure function mirror) ────────────

describe('getParameterByName (pure logic)', () => {
  const getParameterByName = (name, url) => {
    const escaped = name.replace(/[[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + escaped + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results)
      return null;

    return results[2] ? decodeURIComponent(results[2].replace(/\+/g, ' ')) : '';
  };

  it('returns null for missing param', () => {
    expect(getParameterByName('missing', 'http://x.com/')).toBeNull();
  });

  it('returns value for present param', () => {
    expect(getParameterByName('uri', 'http://x.com/?uri=test.abc')).toBe('test.abc');
  });

  it('returns empty string for flag param', () => {
    expect(getParameterByName('mode', 'http://x.com/?mode')).toBe('');
  });

  it('decodes encoded characters', () => {
    expect(getParameterByName('uri', 'http://x.com/?uri=a%20b')).toBe('a b');
  });

  it('handles second param after ampersand', () => {
    expect(getParameterByName('mode', 'http://x.com/?uri=x&mode=random')).toBe('random');
  });
});

})();
