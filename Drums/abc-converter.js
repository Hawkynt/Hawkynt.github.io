// SynthelicZ Drums — ABC Notation Converter
// Converts the internal DrumGroove model to ABC notation for rendering via abcjs.

(function (ns) {
'use strict';

const { DrumBit, Bar, DrumGroove, Instrument, PlayState, NoteIndex } = ns;

class AbcConverter {

  static _instrumentMapping = Object.freeze([
    [Instrument.SnareDrum, "c"],
    [Instrument.BassDrum, "F"],
    [Instrument.FloorTom, "A"],
    [Instrument.MidTom, "d"],
    [Instrument.HighTom, "e"],
    [Instrument.OpenHiHat, "!open!ng"],
    [Instrument.ClosedHiHat, "ng"],
    [Instrument.HiHatPedal, "nD"],
    [Instrument.Crash, "na"],
    [Instrument.Ride, "nf"],
    [Instrument.RideBell, "mf"],
  ]);

  // Convert a DrumBit to an ABC notation string (raw, not yet grouped)
  static drumBitToAbc = (drumBit) => {
    let result = "";
    for (const [instrument, notation] of AbcConverter._instrumentMapping) {
      switch (drumBit.getInstrument(instrument)) {
        case PlayState.Stroke:
          result += notation;
          break;
        case PlayState.Accent:
        case PlayState.Rimshot:
          result += `!accent!${notation}`;
          break;
        case PlayState.Ghost:
          result += `"@-6,-15(""@10,-15)"${notation}`;
          break;
        case PlayState.Click:
          if (notation.startsWith("n"))
            result += `"@-6,-15(""@10,-15)"${notation}`;
          else
            result += `n${notation}`;
          break;
        case PlayState.Flam:
          result += `{/${notation}}${notation}`;
          break;
        case PlayState.Ruff:
          result += `{/${notation}${notation}}${notation}`;
          break;
        case PlayState.Choke:
          result += `.${notation}`;
          break;
      }
    }
    return result;
  };

  static drumBitToSymbol = (drumBit) => {
    let abcNotation = AbcConverter.drumBitToAbc(drumBit);
    let result = 'z';
    if (abcNotation) {
      // HACK: ABC renders some stuff inside square-brackets wrong
      // so we need to move them before the brackets
      let prefix = '';
      const enclosedRegex = /(![^!]+!|{[^{}]+}|"[^"]+"|\.)/g;
      const enclosedParts = abcNotation.match(enclosedRegex);
      if (enclosedParts) {
        const uniqueEnclosedParts = [...new Set(enclosedParts)];
        for (const part of uniqueEnclosedParts) {
          prefix += part;
          abcNotation = abcNotation.replaceAll(part, '');
        }
      }

      abcNotation = abcNotation.replaceAll('[', '');
      abcNotation = abcNotation.replaceAll(']', '');

      result = `${prefix}[${abcNotation}]`;
    }
    return result;
  };

  static _beatIndexes = Object.freeze([
    NoteIndex.Beat1,
    NoteIndex.Beat1E,
    NoteIndex.Beat1Plus,
    NoteIndex.Beat1A,
    NoteIndex.Beat2,
    NoteIndex.Beat2E,
    NoteIndex.Beat2Plus,
    NoteIndex.Beat2A,
    NoteIndex.Beat3,
    NoteIndex.Beat3E,
    NoteIndex.Beat3Plus,
    NoteIndex.Beat3A,
    NoteIndex.Beat4,
    NoteIndex.Beat4E,
    NoteIndex.Beat4Plus,
    NoteIndex.Beat4A,
  ]);

  // Convert a Bar to ABC notation
  barToAbc = (bar) => {
    let result = "";
    let lastSymbol = "z";
    let symbolCount = 0;

    for (let i = 0; i < AbcConverter._beatIndexes.length; ++i) {
      const drumBit = bar.bits[AbcConverter._beatIndexes[i]];
      const currentSymbol = AbcConverter.drumBitToSymbol(drumBit);

      if (lastSymbol === currentSymbol) {
        ++symbolCount;
      } else {
        if (symbolCount >= 1) {
          if (symbolCount === 1)
            result += lastSymbol;
          else
            result += lastSymbol + symbolCount;
        }

        if (i % 4 === 0)
          result += " ";

        lastSymbol = currentSymbol;
        symbolCount = 1;
      }
    }

    if (symbolCount === 1)
      result += lastSymbol;
    else
      result += lastSymbol + symbolCount;

    return result;
  };

  // Convert the entire DrumGroove to ABC notation
  convert = (drumGroove, title = "Auto-Generated", artist = "CPU", barsPerLine = 4, bpm = 60) => {
    const application = "ABCPlayer";
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString("en-GB", {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\//g, '.');

    const abcHeader = `%abc
X:1
T:${title}
C:${artist}
Z:${application} (${formattedDate})
M:4/4
Q:1/4=${bpm}
K:clef=perc
U:n=!style=x!
U:m=!style=triangle!
%%stretchlast 1
%%flatbeams 1
%%ornament up
%%partsbox 1
%%staffsep 5cm % separation of lines
%%MIDI channel 10
%%MIDI program 0
%%MIDI drummap D 44 %pedal hi-hat
%%MIDI drummap F 36 %bass drum 1
%%MIDI drummap A 41 %low floor tom
%%MIDI drummap B 45 %low tom
%%MIDI drummap c 38 %acoustic snare
%%MIDI drummap d 48 %hi mid tom
%%MIDI drummap e 50 %high tom
%%MIDI drummap f 51 %ride cymbal 1
%%MIDI drummap g 42 %closed hi hat
%%MIDI drummap a 49 %crash cymbal 1
%%MIDI drummap b 52 %chinese cymbal
V:drums stem=up
L:1/16
`;
    let abcBody = '';
    for (let i = 0; i < drumGroove.bars.length; ++i) {
      abcBody += this.barToAbc(drumGroove.bars[i]);

      if (i < drumGroove.bars.length - 1)
        abcBody += " | ";

      if ((i + 1) % barsPerLine === 0 && i < drumGroove.bars.length - 1)
        abcBody += "\n";
    }

    return abcHeader + '|: ' + abcBody + ' :|';
  };

  // --
  // Reverse parser: ABC string → DrumGroove
  // --

  static parseAbc = (abcString) => {
    const body = AbcConverter._extractBody(abcString);
    const barStrings = body.split('|').map(s => s.trim()).filter(s => s.length > 0);
    const groove = new DrumGroove();

    // Parse global L: header for default note length
    let unitMultiplier = 1;
    const lengthMatch = abcString.match(/^L:(\d+)\/(\d+)/m);
    if (lengthMatch) {
      const den = parseInt(lengthMatch[2], 10);
      if (den > 0)
        unitMultiplier = Math.max(1, Math.round(16 * parseInt(lengthMatch[1], 10) / den));
    }

    for (const barStr of barStrings) {
      const result = AbcConverter._tokenizeBar(barStr, unitMultiplier);
      unitMultiplier = result.unitMultiplier;
      const bar = new Bar();
      let slot = 0;

      for (const tok of result.tokens) {
        const bit = tok.isRest ? new DrumBit(0) : AbcConverter._tokenToDrumBit(tok);

        if (slot < 16)
          bar.setDrumBit(AbcConverter._beatIndexes[slot], bit);
        ++slot;

        for (let d = 1; d < tok.duration && slot < 16; ++d, ++slot)
          bar.setDrumBit(AbcConverter._beatIndexes[slot], new DrumBit(0));
      }

      groove.addBar(bar);
    }

    return groove;
  };

  static _extractBody = (abcString) => {
    const lines = abcString.split('\n');
    const bodyLines = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed)
        continue;
      if (/^[A-Za-z]:/.test(trimmed))
        continue;
      if (trimmed.startsWith('%'))
        continue;

      bodyLines.push(trimmed);
    }

    let body = bodyLines.join(' ');
    body = body.replace(/::/g, '|');
    body = body.replace(/\|:/g, '|').replace(/:\|/g, '|').replace(/\|\|/g, '|');
    body = body.replace(/\[\d/g, '');
    body = body.replace(/^\|+\s*/, '').replace(/\s*\|+$/, '').trim();
    return body;
  };

  static _tokenizeBar = (barStr, unitMultiplier = 1) => {
    const tokens = [];
    let i = 0;
    let mult = unitMultiplier;

    while (i < barStr.length) {
      if (barStr[i] === ' ' || barStr[i] === '\t') {
        ++i;
        continue;
      }

      const prefix = [];
      while (i < barStr.length) {
        if (barStr[i] === '!') {
          const end = barStr.indexOf('!', i + 1);
          if (end < 0)
            break;

          prefix.push(barStr.substring(i, end + 1));
          i = end + 1;
        } else if (barStr[i] === '{') {
          const end = barStr.indexOf('}', i + 1);
          if (end < 0)
            break;

          prefix.push(barStr.substring(i, end + 1));
          i = end + 1;
        } else if (barStr[i] === '"') {
          const end = barStr.indexOf('"', i + 1);
          if (end < 0)
            break;

          prefix.push(barStr.substring(i, end + 1));
          i = end + 1;
        } else if (barStr[i] === '.') {
          prefix.push('.');
          ++i;
        } else
          break;
      }

      if (i >= barStr.length)
        break;

      let notes = '';
      let isRest = false;

      if (barStr[i] === 'z') {
        isRest = true;
        ++i;
      } else if (barStr[i] === '[') {
        // Check for inline field [letter:...]
        if (i + 2 < barStr.length && /[A-Za-z]/.test(barStr[i + 1]) && barStr[i + 2] === ':') {
          const end = barStr.indexOf(']', i);
          if (end >= 0) {
            const field = barStr.substring(i + 1, end);
            if (field.startsWith('L:')) {
              const lMatch = field.match(/^L:(\d+)\/(\d+)$/);
              if (lMatch)
                mult = Math.max(1, Math.round(16 * parseInt(lMatch[1], 10) / parseInt(lMatch[2], 10)));
            }
            i = end + 1;
            continue;
          }
        }

        ++i;
        const end = barStr.indexOf(']', i);
        if (end >= 0) {
          notes = barStr.substring(i, end);
          i = end + 1;
        }
      } else if (barStr[i] === 'n' || barStr[i] === 'm') {
        // Cross notehead (n) or triangle notehead (m), followed by optional accidental + note letter
        let ahead = i + 1;
        if (ahead < barStr.length && /[\^_=]/.test(barStr[ahead]))
          ++ahead;
        if (ahead < barStr.length && /[A-Ga-g]/.test(barStr[ahead])) {
          notes = barStr.substring(i, ahead + 1);
          i = ahead + 1;
        } else {
          ++i;
          continue;
        }
      } else if (/[\^_=]/.test(barStr[i])) {
        // Accidental (sharp/flat/natural) before a note letter
        if (i + 1 < barStr.length && /[A-Ga-g]/.test(barStr[i + 1])) {
          notes = barStr.substring(i, i + 2);
          i += 2;
        } else {
          ++i;
          continue;
        }
      } else if (/[A-Ga-g]/.test(barStr[i])) {
        notes = barStr[i];
        ++i;
      } else {
        ++i;
        continue;
      }

      // Parse duration: optional numerator, optional /denominator
      let numStr = '';
      while (i < barStr.length && barStr[i] >= '0' && barStr[i] <= '9') {
        numStr += barStr[i];
        ++i;
      }
      let numerator = numStr ? parseInt(numStr, 10) : 1;
      let denominator = 1;
      if (i < barStr.length && barStr[i] === '/') {
        ++i;
        let denStr = '';
        while (i < barStr.length && barStr[i] >= '0' && barStr[i] <= '9') {
          denStr += barStr[i];
          ++i;
        }
        denominator = denStr ? parseInt(denStr, 10) : 2;
      }

      const rawDuration = Math.max(1, Math.round(numerator * mult / denominator));
      tokens.push({ prefix, notes, isRest, duration: rawDuration });
    }

    return { tokens, unitMultiplier: mult };
  };

  static _tokenToDrumBit = (tok) => {
    if (tok.isRest)
      return new DrumBit(0);

    const bit = new DrumBit(0);
    const hasAccent = tok.prefix.some(p => p === '!accent!');
    const hasOpen = tok.prefix.some(p => p === '!open!');
    const hasGhost = tok.prefix.some(p => p.startsWith('"@'));
    const hasChoke = tok.prefix.some(p => p === '.');

    let flamNote = null;
    let ruffNote = null;
    for (const p of tok.prefix) {
      if (p.startsWith('{/') && p.endsWith('}')) {
        const inner = p.substring(2, p.length - 1);
        if (inner.length >= 1) {
          const letter = inner[0];
          if (inner.length >= 2 && inner[1] === letter)
            ruffNote = letter;
          else
            flamNote = letter;
        }
      }
    }

    let j = 0;
    while (j < tok.notes.length) {
      let isCross = false;
      let isTriangle = false;

      // Handle n (cross notehead) and m (triangle notehead) prefixes
      if ((tok.notes[j] === 'n' || tok.notes[j] === 'm') && j + 1 < tok.notes.length) {
        isCross = tok.notes[j] === 'n';
        isTriangle = tok.notes[j] === 'm';
        ++j;
      }

      // Skip accidentals (^=sharp, _=flat, ==natural)
      if (j < tok.notes.length && /[\^_=]/.test(tok.notes[j]))
        ++j;

      if (j >= tok.notes.length)
        break;

      const letter = tok.notes[j];
      ++j;

      if (!/[A-Ga-g]/.test(letter))
        continue;

      let instrument = null;
      let playState = PlayState.Stroke;

      switch (letter) {
        case 'c':
          instrument = Instrument.SnareDrum;
          if (isCross)
            playState = PlayState.Click;
          else if (flamNote === 'c')
            playState = PlayState.Flam;
          else if (ruffNote === 'c')
            playState = PlayState.Ruff;
          else if (hasAccent)
            playState = PlayState.Accent;
          else if (hasGhost)
            playState = PlayState.Ghost;
          break;
        case 'F':
          instrument = Instrument.BassDrum;
          break;
        case 'A':
          instrument = Instrument.FloorTom;
          if (flamNote === 'A')
            playState = PlayState.Flam;
          else if (ruffNote === 'A')
            playState = PlayState.Ruff;
          else if (hasAccent)
            playState = PlayState.Accent;
          else if (hasGhost)
            playState = PlayState.Ghost;
          break;
        case 'd':
          instrument = Instrument.MidTom;
          if (flamNote === 'd')
            playState = PlayState.Flam;
          else if (ruffNote === 'd')
            playState = PlayState.Ruff;
          else if (hasAccent)
            playState = PlayState.Accent;
          else if (hasGhost)
            playState = PlayState.Ghost;
          break;
        case 'e':
          instrument = Instrument.HighTom;
          if (flamNote === 'e')
            playState = PlayState.Flam;
          else if (ruffNote === 'e')
            playState = PlayState.Ruff;
          else if (hasAccent)
            playState = PlayState.Accent;
          else if (hasGhost)
            playState = PlayState.Ghost;
          break;
        case 'g':
          if (hasOpen)
            instrument = Instrument.OpenHiHat;
          else
            instrument = Instrument.ClosedHiHat;
          break;
        case 'D':
          instrument = Instrument.HiHatPedal;
          break;
        case 'a':
          instrument = Instrument.Crash;
          if (hasChoke)
            playState = PlayState.Choke;
          else if (hasAccent)
            playState = PlayState.Accent;
          break;
        case 'f':
          if (isTriangle)
            instrument = Instrument.RideBell;
          else
            instrument = Instrument.Ride;
          if (hasAccent)
            playState = PlayState.Accent;
          break;
        case 'B':
          // Low tom (MIDI 45) — mapped to FloorTom (closest available)
          instrument = Instrument.FloorTom;
          if (hasAccent)
            playState = PlayState.Accent;
          else if (hasGhost)
            playState = PlayState.Ghost;
          break;
        case 'b':
          // Chinese cymbal (MIDI 52) — mapped to Crash (closest available)
          instrument = Instrument.Crash;
          if (hasChoke)
            playState = PlayState.Choke;
          break;
      }

      if (instrument)
        bit.setInstrument(instrument, playState);
    }

    return bit;
  };
}

ns.AbcConverter = AbcConverter;

})(window.SZDrums = window.SZDrums || {});
