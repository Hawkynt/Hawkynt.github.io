# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SynthelicZ Drums** is a browser-based drum groove editor and player. Users create, visualize, and play drum patterns through four synchronized views: a sheet-music editor (powered by abcjs), Guitar Hero-style falling lanes, a procedural SVG drum kit, and a horizontal transport-belt sheet. No build step or server required -- runs directly from `file://`.

## Running & Testing

| Action | How |
|--------|-----|
| Run the app | Open `ABCPlayer.html` in a browser |
| Run all tests | Open `tests/index.html` in a browser |
| Deploy | Push to `main`; GitHub Pages serves from repo root |

There is no `package.json`, no npm, no build tooling. The test framework is a custom browser-based xUnit runner (`tests/test-runner.js`) using `describe()`/`it()`/`expect()` with async support. Test results render as collapsible HTML and the page title becomes `[PASS]` or `[FAIL]`.

## Architecture

### Namespace & Module System

All files use IIFE-based namespacing onto `window.SZDrums` (no ES modules, to support `file://`). Scripts must be loaded in dependency order via `<script>` tags:

1. `model.js` -- `DrumBit`, `Bar`, `DrumGroove`, enums (`Instrument`, `PlayState`, `NoteIndex`)
2. `abc-converter.js` -- bidirectional ABC notation conversion: `convert` (model→ABC) and `parseAbc` (ABC→model)
3. `kit-renderer.js` -- procedural SVG drum kit; also exports shared constants (`INSTRUMENT_COLORS`, `INSTRUMENT_COLORS_LIGHT`, `INSTRUMENT_SHORT`, `INSTRUMENT_LABEL`, `INSTRUMENT_X`, `INSTRUMENT_Y`, `LANE_ORDER_UD`, `LANE_ORDER_UD_LR`)
4. `lane-renderer.js` -- Canvas falling-lanes renderer (uses `INSTRUMENT_X` for kit-aligned horizontal gem positioning)
5. `belt-renderer.js` -- Canvas horizontal-scroll transport belt (uses `INSTRUMENT_Y` from kit-renderer for vertical note positioning, matching the drum-kit SVG layout; 2x-scaled note geometry for readability; configurable per-instrument beaming via `setBeamPerInstrument()`, toggled by a checkbox in the transport bar)
6. `bar-editor.js` -- interactive 11x16 grid editor
7. `note-flight.js` -- full-screen projectile overlay (Bezier curves, particles)
8. `controller.js` (loaded with `defer`) -- wires everything; owns the render loop, `currentGroove` state, keyboard recording, abcjs SynthController sync, beam-per-instrument checkbox, and play/pause icon swap

### Data Flow

```
User Input (grid click / kit pad / keyboard recording)
  -> Controller updates DrumGroove model
  -> AbcConverter generates ABC notation string
  -> abcjs renders sheet music + provides Web Audio playback
  -> All renderers read from model via shared rAF loop (60 fps)

Playback Sync (controller ↔ abcjs SynthController):
  CursorControl.onStart()      -> _setPlayingState(true)
  CursorControl.onFinished()   -> _setPlayingState(false)
  Click on .abcjs-midi-start   -> _setPlayingState(false) (pause detection)
  CursorControl.onBeat(beat)   -> wrappedBeat -> setCurrentBeat on renderers (sole source for crossing detection)
  CursorControl.onEvent(event) -> cursor highlighting + rate derivation (NO setCurrentBeat — avoids beat ping-pong)
  Rate derivation: beatsPerMs from both onEvent + onBeat -> setPlaybackRate on renderers
  Renderers interpolate between updates using playbackRate, capped dynamically (max(150ms, 0.125/rate))

  Renderer setCurrentBeat -> _eventBeat crossing detection (separate from interpolated _currentBeat)
  Note crossing cursor -> onNoteFired callback -> projectile spawns toward kit

Recording:
  keydown (while isRecording + isPlaying) -> KEY_INSTRUMENT_MAP -> _recordTap
  _recordTap -> quantize to nearest 16th -> drumBit.setInstrument -> reload renderers
  On playback stop (if dirty) -> re-render ABC notation
```

### DrumBit Encoding

Each 1/16th note is a single byte (`DrumBit`). Bit 7 selects mode:
- **Mode 0** (`0lllrrrb`): left-hand snare/crash (`lll`), right-hand cymbal (`rrr`), bass drum (`b`)
- **Mode 1** (`1mmmllrr`): tom selection (3 bits), left-hand state (2 bits), right-hand state (2 bits)

**Hand-based channel model**: right hand plays Hi-Hat OR Ride (never both, `rrr`); left hand plays Snare OR Crash (never both, `lll`). Bass is foot-independent (`b`).

**`rrr` values**: Off(000), Closed(001), Pedal(010), Open(011), Ride(100), RideAccent(101), RideBell(110), RideBellAccent(111)

**`lll` values**: Off(000), Stroke(001), Click(010), Ghost(011), Rimshot(100), Crash(101), CrashAccent(110), CrashChoke(111)

**SnareFlamRuff** (Toms mode `1 000 00 rr`): Snare Flam/Ruff with optional bass drum. rr bit 1 = articulation (0=Flam, 1=Ruff), rr bit 0 = bass drum.

**Single-tom Flam/Ruff**: rr=01 → Flam, rr=10 → Ruff (for any single-tom selection).

`Bar` = 16 DrumBits. `DrumGroove` = array of Bars. All support `.clone()`.

### Layout (2x2 Grid)

```
Transport Bar (play/stop/bpm/new/random/midi)
+-----------------+----------------------------+
| Falling Lanes   | Tabbed Editor              |
| (Canvas)        |  Sheet | Bar Editor | ABC  |
+-----------------+----------------------------+
| SVG Drum Kit    | Transport-Belt Sheet       |
| (10 pads)       | (horizontal scroll canvas) |
+-----------------+----------------------------+
```

### Belt & Lane Positioning

Both the belt renderer and the lane renderer use the kit-SVG positions directly from `KIT_PIECES` (via `INSTRUMENT_Y` and `INSTRUMENT_X`). Notes on the belt are positioned vertically at `(cy / 300) * canvasHeight`, and gems in the lanes are positioned horizontally at `(cx / 400) * canvasWidth`. This means the belt, lanes, and drum-kit SVG all share the same coordinate proportions with no additional stretching or remapping. Five staff lines pass through Ride, MidTom, FloorTom, and two interpolated lower positions.

### External Dependency

Only **abcjs v6.2.3** from CDN (`cdn.jsdelivr.net`). No other libraries.

## Code Conventions

- K&R braces; `const` by default, `let` for mutations
- `// --` bars as section dividers
- PascalCase for classes, camelCase for functions/variables, UPPER_SNAKE_CASE for constants
- Test names describe behavior, not implementation; no AAA comments
- CSS uses custom properties at `:root` for theming (dark-neon palette)

## Test Suites

Tests live in `tests/*.test.js` and self-register via `describe()`/`it()`. Each source file has a corresponding test file:
`model.test.js`, `abc-converter.test.js`, `controller.test.js`, `kit-renderer.test.js`, `lane-renderer.test.js`, `sheet-belt.test.js`, `bar-editor.test.js`, `note-flight.test.js`

## URL Parameters

| Param | Example | Effect |
|-------|---------|--------|
| `mode` | `?mode=random` | Generate random groove on load |
| `uri` | `?uri=<url>` | Load external ABC file |
