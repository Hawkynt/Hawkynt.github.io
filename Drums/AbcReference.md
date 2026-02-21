# ABC Notation Reference for Percussion

Quick reference for ABC notation syntax and abcjs API methods as used by SynthelicZ Drums.

---

## ABC Notation Basics

ABC is a text-based music notation format. A minimal tune looks like:

```abc
X:1
T:My Tune
M:4/4
L:1/16
K:clef=perc
V:drums perc stafflines=5
|: [notes] | [notes] :|
```

### Header Fields

| Field | Meaning                  | Example                     |
| ----- | ------------------------ | --------------------------- |
| `X:`  | Reference number         | `X:1`                       |
| `T:`  | Title                    | `T:Rock Beat`               |
| `C:`  | Composer                 | `C:Anonymous`               |
| `M:`  | Meter (time signature)   | `M:4/4`                     |
| `L:`  | Default note length      | `L:1/16`                    |
| `Q:`  | Tempo                    | `Q:1/4=120`                 |
| `K:`  | Key (with clef override) | `K:clef=perc`               |
| `V:`  | Voice definition         | `V:drums perc stafflines=5` |

### Note Lengths

With `L:1/16` as the default unit:

| ABC   | Duration     | Musical name   |
| ----- | ------------ | -------------- |
| `C`   | 1/16         | Sixteenth note |
| `C2`  | 2/16 = 1/8   | Eighth note    |
| `C3`  | 3/16         | Dotted eighth  |
| `C4`  | 4/16 = 1/4   | Quarter note   |
| `C8`  | 8/16 = 1/2   | Half note      |
| `C16` | 16/16 = 1    | Whole note     |
| `z`   | 1/16 rest    | Sixteenth rest |
| `z4`  | Quarter rest | Quarter rest   |

### Chords (simultaneous notes)

Square brackets group notes sounding together:

```abc
[cF]4    %% snare + kick, quarter note duration
```

### Bar Lines

| Symbol | Meaning      |
| ------ | ------------ |
| `\|`   | Bar line     |
| `\|:`  | Start repeat |
| `:\|`  | End repeat   |
| `\|]`  | Final bar    |

---

## Percussion-Specific Notation

### Clef and Voice

```abc
K:clef=perc
V:drums perc stafflines=5
```

The `perc` keyword tells abcjs to use percussion noteheads (X-heads for cymbals, filled/open ovals for drums). `stafflines=5` gives a standard 5-line staff.

### Note-to-Instrument Mapping

In SynthelicZ Drums, instruments map to ABC note letters as follows:

| Instrument    | ABC Note   | Staff Position      |
| ------------- | ---------- | ------------------- |
| Snare Drum    | `c`        | Space 3-4 (C5)      |
| Bass Drum     | `F`        | Space 1 (F4)        |
| Floor Tom     | `A`        | Space 2-3 (A4)      |
| Mid Tom       | `d`        | Line 4 (D5)         |
| High Tom      | `e`        | Space 4-5 (E5)      |
| Open Hi-Hat   | `!open!ng` | G5 with open marker |
| Closed Hi-Hat | `ng`       | G5 (noteheads type) |
| Hi-Hat Pedal  | `nD`       | Below staff (D4)    |
| Crash         | `na`       | Above staff (A5)    |
| Ride          | `nf`       | F5                  |

The `n` prefix is used for percussion noteheads (X-shaped) in abcjs. The `!open!` decoration adds an "o" above the notehead for open hi-hat.

### Decorations

| Decoration    | Meaning                        | Example                 |
| ------------- | ------------------------------ | ----------------------- |
| `!accent!`    | Accent mark (>)                | `!accent!c`             |
| `!open!`      | Open hi-hat circle             | `!open!ng`              |
| `{/note}`     | Grace note (flam)              | `{/c}c`                 |
| `{/nn}`       | Double grace (ruff)            | `{/cc}c`                |
| `.` prefix    | Staccato (choke)               | `.na`                   |
| `"@x,y(...)"` | Text annotation (ghost parens) | `"@-6,-15(""@10,-15)"c` |

### Rest Notation

| ABC   | Meaning                |
| ----- | ---------------------- |
| `z`   | Single 16th rest       |
| `z2`  | Eighth rest            |
| `z4`  | Quarter rest           |
| `z8`  | Half rest              |
| `z16` | Whole rest (empty bar) |

---

## abcjs API Methods Used

### `ABCJS.renderAbc(target, abc, options)`

Renders ABC notation into an SVG element.

```js
const visualObj = ABCJS.renderAbc('paper', abcNotation, {
  add_classes: true,        // adds CSS classes for styling
  clickListener: fn,        // callback on note click
  responsive: 'resize',     // auto-resize with container
})[0];
```

Returns an array of `TuneObject` instances (one per tune in the string).

### `ABCJS.synth.SynthController`

Manages audio playback with built-in UI controls.

```js
const synthControl = new ABCJS.synth.SynthController();
synthControl.load('#audio', cursorControl, {
  displayLoop: true,
  displayRestart: true,
  displayPlay: true,
  displayProgress: true,
  displayWarp: true,
});
synthControl.setTune(visualObj, false);
```

### `CursorControl` interface

The second argument to `SynthController.load()` is an object with optional callbacks:

| Method                                      | When called                     |
| ------------------------------------------- | ------------------------------- |
| `onReady()`                                 | Audio context ready             |
| `onStart()`                                 | Playback begins                 |
| `onBeat(beatNumber, totalBeats, totalTime)` | Each beat                       |
| `onEvent(event)`                            | Each note event during playback |
| `onFinished()`                              | Playback ends                   |

The `event` object in `onEvent` contains:

- `event.elements` — array of SVG element groups being played
- `event.left`, `event.top`, `event.height` — position in the SVG
- `event.milliseconds` — current playback time in ms
- `event.midiPitches` — array of `{ pitch, volume, ... }`

### `ABCJS.synth.playEvent(pitches, graceNotes, msPerMeasure)`

Plays a single sound event (used for click-to-audition).

```js
ABCJS.synth.playEvent(
  [{ cmd: 'note', pitch: 38, volume: 80, start: 0, duration: 0.25, instrument: 128, gap: 0 }],
  [],    // grace notes
  msPerMeasure
);
```

- `instrument: 128` selects the General MIDI percussion channel.
- `pitch` values follow the GM percussion map (e.g., 36=kick, 38=snare, 42=closed HH).

### `ABCJS.synth.getMidiFile(visualObj)`

Returns a MIDI file as a data string for download.

### `visualObj.millisecondsPerMeasure()`

Returns the duration of one measure in milliseconds at the current tempo.

---

## General MIDI Percussion Map (Channel 10)

| MIDI Pitch | Instrument    |
| ---------- | ------------- |
| 36         | Bass Drum     |
| 38         | Snare Drum    |
| 41         | Floor Tom     |
| 42         | Closed Hi-Hat |
| 44         | Hi-Hat Pedal  |
| 46         | Open Hi-Hat   |
| 48         | Mid Tom       |
| 49         | Crash Cymbal  |
| 50         | High Tom      |
| 51         | Ride Cymbal   |

---

## References

- [ABC notation standard](https://abcnotation.com/wiki/abc:standard:v2.1)
- [abcjs documentation](https://paulrosen.github.io/abcjs/)
- [abcjs GitHub repository](https://github.com/paulrosen/abcjs)
