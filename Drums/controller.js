// SynthelicZ Drums — Application Controller
// Entry point: wires model, converter, renderers, abcjs, and the DOM together.

(function (ns) {
'use strict';

const { DrumBit, Bar, DrumGroove, Instrument, PlayState, NoteIndex,
        AbcConverter, KitRenderer, LaneRenderer, SheetBeltRenderer,
        BarEditor, NoteFlightRenderer } = ns;

// ── Cursor Control ─────────────────────────────────────────
// Drives the moving cursor, note highlighting, AND feeds renderers.

class CursorControl {
  constructor() {
    this.beatSubdivisions = 16;   // high subdivision → frequent onBeat → tight sync
    this._onEventCb = null;
    this._onBeatCb = null;
  }

  onReady() {}

  onStart() {
    const svg = document.querySelector('#paper svg');
    if (!svg)
      return;

    const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cursor.setAttribute('class', 'abcjs-cursor');
    cursor.setAttributeNS(null, 'x1', 0);
    cursor.setAttributeNS(null, 'y1', 0);
    cursor.setAttributeNS(null, 'x2', 0);
    cursor.setAttributeNS(null, 'y2', 0);
    svg.appendChild(cursor);

    // Signal play start to renderers
    _setPlayingState(true);
  }

  onBeat(beatNumber, totalBeats, totalTime) {
    if (this._onBeatCb)
      this._onBeatCb(beatNumber, totalBeats, totalTime);
  }

  onEvent(event) {
    // Tied note across a measure line — ignore
    if (event.measureStart && event.left === null)
      return;

    for (const el of document.querySelectorAll('#paper svg .highlight'))
      el.classList.remove('highlight');

    for (const group of event.elements)
      for (const note of group)
        note.classList.add('highlight');

    const cursor = document.querySelector('#paper svg .abcjs-cursor');
    if (cursor) {
      cursor.setAttribute('x1', event.left - 2);
      cursor.setAttribute('x2', event.left - 2);
      cursor.setAttribute('y1', event.top);
      cursor.setAttribute('y2', event.top + event.height);
    }

    if (this._onEventCb)
      this._onEventCb(event);
  }

  onFinished() {
    for (const el of document.querySelectorAll('svg .highlight'))
      el.classList.remove('highlight');

    const cursor = document.querySelector('#paper svg .abcjs-cursor');
    if (cursor) {
      cursor.setAttribute('x1', 0);
      cursor.setAttribute('x2', 0);
      cursor.setAttribute('y1', 0);
      cursor.setAttribute('y2', 0);
    }

    // Signal stop to renderers
    _setPlayingState(false);
  }
}

// ── Helpers ────────────────────────────────────────────────

const getParameterByName = (name, url = window.location.href) => {
  const escaped = name.replace(/[[\]]/g, '\\$&');
  const regex = new RegExp('[?&]' + escaped + '(=([^&#]*)|&|#|$)');
  const results = regex.exec(url);
  if (!results)
    return null;

  return results[2] ? decodeURIComponent(results[2].replace(/\+/g, ' ')) : '';
};

const getRandom = (exclusiveMaximum) => Math.floor(Math.random() * exclusiveMaximum);

// ── Application State ──────────────────────────────────────

const cursorControl = new CursorControl();
let synthControl = null;
let currentNotationInstance = null;
let currentGroove = null;

// Renderers
let kitRenderer = null;
let laneRenderer = null;
let sheetBeltRenderer = null;
let barEditor = null;
let noteFlightRenderer = null;

// Playback tracking
let isPlaying = false;
let currentBpm = 60;
let rafId = null;
let lastKnownBeat = 0;
let lastBeatTimestamp = 0;
let isRecording = false;
let _recordingDirty = false;
let _bpmDirty = false;
let _abcDirty = false;   // bar editor edits deferred until tab switch / play
let _prevEventMs   = 0;   // event.milliseconds from previous abcjs event
let _prevEventWall = 0;   // performance.now() at previous abcjs event
let _prevBeatPos   = 0;   // beat position from previous onBeat
let _prevBeatWall  = 0;   // performance.now() at previous onBeat
let _manualPauseAt = 0;   // timestamp of last user-initiated pause (debounce for auto-restart)

/** Convert a groove to ABC notation using the current BPM. */
const convertGroove = (groove) => new AbcConverter().convert(groove, undefined, undefined, undefined, currentBpm);

/** Sync ABC notation / abcjs synth if deferred bar-editor edits are pending. */
const _syncAbcIfDirty = () => {
  if (!_abcDirty || !currentGroove) return;
  _abcDirty = false;
  displayABC(convertGroove(currentGroove));
};

// ── Click-to-audition ──────────────────────────────────────

const clickListener = (abcElem, _tuneNumber, _classes, _analysis, _drag, _mouseEvent) => {
  const pitches = abcElem.midiPitches;
  if (!pitches || !synthControl?.visualObj)
    return;

  ABCJS.synth
    .playEvent(pitches, abcElem.midiGraceNotePitches, synthControl.visualObj.millisecondsPerMeasure())
    .catch(err => console.error('Error playing note:', err));
};

// ── ABC rendering options ──────────────────────────────────

const abcOptions = {
  add_classes: true,
  clickListener,
  responsive: 'resize',
};

// ── Render loop (60 fps) ───────────────────────────────────
// Only runs when playing or when there are active flight animations.

let _renderLoopActive = false;

const startRenderLoop = () => {
  if (_renderLoopActive)
    return;

  _renderLoopActive = true;

  const tick = (now) => {
    // Continue if playing or if note-flight has active elements
    const flightBusy = noteFlightRenderer ? noteFlightRenderer.hasActiveElements() : false;
    if (!isPlaying && !flightBusy) {
      _renderLoopActive = false;
      rafId = null;
      return;
    }

    rafId = requestAnimationFrame(tick);
    const layout = kitRenderer ? kitRenderer.getLayout() : null;
    if (laneRenderer) {
      laneRenderer.setKitLayout(layout);
      laneRenderer.render(now);
    }
    if (sheetBeltRenderer) {
      sheetBeltRenderer.setKitLayout(layout);
      sheetBeltRenderer.render(now);
    }
    if (noteFlightRenderer)
      noteFlightRenderer.render(now);
  };
  rafId = requestAnimationFrame(tick);
};

const stopRenderLoop = () => {
  _renderLoopActive = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
};

/** Single-frame render (used to paint initial state without starting a loop). */
const renderOnce = (now) => {
  const layout = kitRenderer ? kitRenderer.getLayout() : null;
  const ts = now ?? performance.now();
  if (laneRenderer) {
    laneRenderer.setKitLayout(layout);
    laneRenderer.render(ts);
  }
  if (sheetBeltRenderer) {
    sheetBeltRenderer.setKitLayout(layout);
    sheetBeltRenderer.render(ts);
  }
};

// ── Feed groove data to renderers ──────────────────────────

const feedRenderersGroove = (groove) => {
  if (laneRenderer)
    laneRenderer.loadGroove(groove);
  if (sheetBeltRenderer)
    sheetBeltRenderer.loadGroove(groove);
  if (barEditor)
    barEditor.loadGroove(groove);

  // Paint one frame so the static belt/lanes show the notes immediately
  renderOnce();
};

// ── Display / Load ─────────────────────────────────────────

const displayABC = (abcNotation) => {
  const paperEl = document.getElementById('paper');
  if (!paperEl) {
    console.error('Missing #paper element');
    return;
  }

  currentNotationInstance = ABCJS.renderAbc('paper', abcNotation, abcOptions)[0];
  synthControl.setTune(currentNotationInstance, false);

  // Populate raw ABC text in the ABC tab
  const abcTextEl = document.getElementById('abc-text');
  if (abcTextEl)
    abcTextEl.textContent = abcNotation;

  // feed the current groove to visual renderers
  feedRenderersGroove(currentGroove);

  wireDownloadMidi();

  const dlBtn = document.getElementById('btn-download-midi');
  if (dlBtn)
    dlBtn.disabled = false;
};

const loadAndDisplayABC = (uri) => {
  fetch(uri)
    .then(r => r.text())
    .then(abc => {
      if (!abc) {
        console.error('No ABC notation found at the URI.');
        return;
      }

      // Extract BPM from imported ABC if present (Q:1/4=N or Q:N)
      const qMatch = abc.match(/Q:(?:\d+\/\d+=)?(\d+)/);
      if (qMatch) {
        currentBpm = parseInt(qMatch[1], 10);
        const input = document.getElementById('tempo-input');
        if (input) input.value = currentBpm;
      } else {
        // No Q: field — inject one before K: so abcjs uses our BPM
        // (abcjs defaults to 180 BPM when Q: is absent)
        abc = abc.replace(/^(K:)/m, `Q:1/4=${currentBpm}\n$1`);
      }

      currentGroove = AbcConverter.parseAbc(abc);
      displayABC(abc);
    })
    .catch(err => console.error('Error loading ABC notation:', err));
};

// ── Random groove generator ────────────────────────────────

const generateRandomGroove = () => {
  const groove = new DrumGroove();

  // First bar: a simple rock pattern
  let bar = new Bar();
  groove.addBar(bar);
  bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b00000011));
  bar.setDrumBit(NoteIndex.Beat3, new DrumBit(0b00000011));
  bar.setDrumBit(NoteIndex.Beat2, new DrumBit(0b00010010));
  bar.setDrumBit(NoteIndex.Beat4, new DrumBit(0b00010010));
  bar.setDrumBit(NoteIndex.Beat1Plus, new DrumBit(0b00000010));
  bar.setDrumBit(NoteIndex.Beat2Plus, new DrumBit(0b00000010));
  bar.setDrumBit(NoteIndex.Beat3Plus, new DrumBit(0b00000010));
  bar.setDrumBit(NoteIndex.Beat4Plus, new DrumBit(0b00000010));

  // Second bar: dense pattern
  bar = new Bar();
  groove.addBar(bar);
  bar.setDrumBit(NoteIndex.Beat1, new DrumBit(0b11110101));
  bar.setDrumBit(NoteIndex.Beat1Plus, new DrumBit(0b11111010));
  bar.setDrumBit(NoteIndex.Beat2, new DrumBit(0b11111111));
  bar.setDrumBit(NoteIndex.Beat3, new DrumBit(0b01110111));
  bar.setDrumBit(NoteIndex.Beat4, new DrumBit(0b01111011));

  // Five random bars
  for (let i = 0; i < 5; ++i) {
    bar = new Bar();
    groove.addBar(bar);
    for (let j = 0; j < 16; ++j)
      bar.setDrumBit(j, new DrumBit(getRandom(256)));
  }

  return groove;
};

// ── MIDI download ──────────────────────────────────────────

let midiWired = false;

const wireDownloadMidi = () => {
  if (midiWired)
    return;

  const btn = document.getElementById('btn-download-midi');
  if (!btn)
    return;

  btn.addEventListener('click', () => {
    if (!currentNotationInstance)
      return;

    const midi = ABCJS.synth.getMidiFile(currentNotationInstance);
    const a = document.createElement('a');
    a.setAttribute('href', 'data:audio/midi;charset=utf-8,' + encodeURIComponent(midi));
    a.setAttribute('download', 'music.mid');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  midiWired = true;
};

// ── Random button ──────────────────────────────────────────

const wireRandomButton = () => {
  const btn = document.getElementById('btn-random');
  if (!btn)
    return;

  btn.addEventListener('click', () => {
    currentGroove = generateRandomGroove();
    const abc = convertGroove(currentGroove);
    displayABC(abc);
  });
};

// ── New (empty groove) button ──────────────────────────────

const wireNewButton = () => {
  const btn = document.getElementById('btn-new');
  if (!btn)
    return;

  btn.addEventListener('click', () => {
    currentGroove = new DrumGroove();
    currentGroove.addBar(new Bar());
    const abc = convertGroove(currentGroove);
    displayABC(abc);

    // Switch to bar editor tab for immediate editing
    _switchToTab('tab-bar-editor');
  });
};

/** Programmatically activate a tab by pane id. */
const _switchToTab = (paneId) => {
  const tabBar = document.getElementById('editor-tabs');
  if (!tabBar)
    return;

  for (const b of tabBar.querySelectorAll('.tab-btn'))
    b.classList.remove('active');

  for (const p of document.querySelectorAll('#tab-panes .tab-pane'))
    p.classList.remove('active');

  const btn = tabBar.querySelector(`.tab-btn[data-tab="${paneId}"]`);
  if (btn)
    btn.classList.add('active');

  const pane = document.getElementById(paneId);
  if (pane)
    pane.classList.add('active');
};

// ── Initialize ABCJS SynthController ───────────────────────

const initializeSynthControl = () => {
  synthControl = new ABCJS.synth.SynthController();
  synthControl.load('#audio', cursorControl, {
    displayLoop: true,
    displayRestart: true,
    displayPlay: true,
    displayProgress: true,
    displayWarp: true,
  });

  // Hook into the abcjs play/pause button directly.
  // onStart() fires when play begins, but there is NO onPause callback —
  // so we intercept clicks on the abcjs play button to detect pause immediately.
  const audioEl = document.getElementById('audio');
  if (audioEl)
    audioEl.addEventListener('click', (e) => {
      if (e.target.closest('.abcjs-midi-start') && isPlaying) {
        _manualPauseAt = performance.now();
        _setPlayingState(false);
      }
    });
};

// ── Initialize visual renderers ────────────────────────────

const initializeRenderers = () => {
  // SVG drum kit
  const kitViewport = document.getElementById('kit-viewport');
  if (kitViewport) {
    kitRenderer = new KitRenderer(kitViewport, (instrument) => {
      // click-to-play: audition a single drum hit via abcjs
      if (!currentNotationInstance)
        return;

      // Map instrument to its MIDI pitch for playback
      const midiPitch = _instrumentToMidiPitch(instrument);
      if (midiPitch < 0)
        return;

      ABCJS.synth.playEvent(
        [{ cmd: 'note', pitch: midiPitch, volume: 80, start: 0, duration: 0.25, instrument: 128, gap: 0 }],
        [],
        currentNotationInstance.millisecondsPerMeasure()
      ).catch(err => console.error('Kit audition error:', err));
    });
  }

  // ── Note-flight overlay (flying projectiles from belt / lanes → kit) ──
  const particlesCanvas = document.getElementById('particles');
  if (particlesCanvas) {
    noteFlightRenderer = new NoteFlightRenderer(particlesCanvas, (instrument) => {
      // projectile arrived at kit pad — trigger hit animation + sound
      if (kitRenderer)
        kitRenderer.triggerHit(instrument);
    });
  }

  // Helper: spawn a projectile from (sx,sy) toward the kit pad
  const _spawnProjectile = (instrument, sx, sy, origin) => {
    if (!noteFlightRenderer || !kitRenderer)
      return;

    const target = kitRenderer.getPadScreenPosition(instrument);
    if (!target)
      return;

    noteFlightRenderer.spawn(sx, sy, target.x, target.y, instrument, origin);
  };

  // Falling lanes canvas
  const laneCanvas = document.getElementById('lane-canvas');
  if (laneCanvas) {
    laneRenderer = new LaneRenderer(laneCanvas, (instrument, screenX, screenY) => {
      _spawnProjectile(instrument, screenX, screenY, 'lane');
    });
  }

  // Sheet-belt (horizontal scrolling)
  const sheetBelt = document.getElementById('sheet-belt');
  if (sheetBelt) {
    sheetBeltRenderer = new SheetBeltRenderer(sheetBelt, (instrument, screenX, screenY) => {
      _spawnProjectile(instrument, screenX, screenY, 'belt');
    });
  }

  // Bar editor grid
  const barEditorViewport = document.getElementById('bar-editor-viewport');
  if (barEditorViewport) {
    barEditor = new BarEditor(barEditorViewport, (groove) => {
      // Lightweight update: refresh visual renderers only, defer heavy ABC/synth rebuild
      currentGroove = groove;
      if (laneRenderer) laneRenderer.loadGroove(groove);
      if (sheetBeltRenderer) sheetBeltRenderer.loadGroove(groove);
      renderOnce();
      _abcDirty = true;
    });
  }
};

// ── Map Instrument enum to General MIDI percussion pitch ───

const _instrumentToMidiPitch = (instrument) => {
  switch (instrument) {
    case Instrument.BassDrum:    return 36;
    case Instrument.SnareDrum:   return 38;
    case Instrument.FloorTom:    return 41;
    case Instrument.MidTom:      return 48;
    case Instrument.HighTom:     return 50;
    case Instrument.ClosedHiHat: return 42;
    case Instrument.OpenHiHat:   return 46;
    case Instrument.HiHatPedal:  return 44;
    case Instrument.Crash:       return 49;
    case Instrument.Ride:        return 51;
    case Instrument.RideBell:    return 53;
    default:                     return -1;
  }
};

// ── Play / Pause SVG icons ────────────────────────────────

const PLAY_SVG  = '<path d="M4 2 L4 22 L20 12 Z"/>';
const PAUSE_SVG = '<rect x="4" y="2" width="5" height="20"/><rect x="13" y="2" width="5" height="20"/>';

// ── Wire cursor control to renderers ───────────────────────

const _setPlayingState = (playing) => {
  isPlaying = playing;
  _prevEventMs = 0;
  _prevEventWall = 0;
  _prevBeatPos = 0;
  _prevBeatWall = 0;

  if (laneRenderer)
    laneRenderer.setPlaying(playing);
  if (sheetBeltRenderer)
    sheetBeltRenderer.setPlaying(playing);

  // Swap play/pause icon on the abcjs play button
  const playBtn = document.querySelector('.abcjs-midi-start');
  if (playBtn) {
    const svg = playBtn.querySelector('svg');
    if (svg)
      svg.innerHTML = playing ? PAUSE_SVG : PLAY_SVG;
  }

  if (playing) {
    _syncAbcIfDirty();
    startRenderLoop();
  } else if ((_recordingDirty || _bpmDirty) && currentGroove) {
    // Sync ABC notation with notes recorded or BPM changed during playback
    _recordingDirty = false;
    _bpmDirty = false;
    const abc = convertGroove(currentGroove);
    displayABC(abc);
  }
};

const wireCursorToRenderers = () => {
  cursorControl._onEventCb = (event) => {
    const now = performance.now();

    // Auto-restart: if abcjs is sending events but we think we're paused,
    // the render loop has stopped and the display is frozen.  This happens
    // when abcjs internally restarts (e.g., warp-slider change) without
    // calling onStart().  Restore playing state unless the user just clicked
    // pause (300 ms debounce to avoid fighting with manual pause).
    if (!isPlaying && now - _manualPauseAt > 300) {
      isPlaying = true;
      if (laneRenderer) laneRenderer.setPlaying(true);
      if (sheetBeltRenderer) sheetBeltRenderer.setPlaying(true);
      startRenderLoop();
    }

    // Estimate beat position from event.milliseconds / ms-per-beat
    if (!currentNotationInstance)
      return;

    const msPerMeasure = currentNotationInstance.millisecondsPerMeasure();
    const msPerBeat = msPerMeasure / 4;
    const eventMs = event.milliseconds ?? 0;
    const beatPos = eventMs / msPerBeat;

    // Derive actual playback rate from consecutive abcjs events.
    // event.milliseconds is the piece-time position (at nominal tempo);
    // comparing its delta to wall-clock delta reveals the effective warp.
    const wallDt = now - _prevEventWall;
    const msDt   = eventMs - _prevEventMs;
    if (_prevEventWall > 0 && wallDt > 5 && msDt > 0) {
      const beatsPerMs = (msDt / msPerBeat) / wallDt;
      if (laneRenderer)
        laneRenderer.setPlaybackRate(beatsPerMs);
      if (sheetBeltRenderer)
        sheetBeltRenderer.setPlaybackRate(beatsPerMs);
    }
    _prevEventMs   = eventMs;
    _prevEventWall = now;

    // Wrap beat position for repeating grooves
    const totalBeats = currentGroove ? currentGroove.bars.length * 4 : 0;
    const wrappedBeat = totalBeats > 0 ? beatPos % totalBeats : beatPos;

    // NOTE: We intentionally do NOT call setCurrentBeat() on the renderers
    // here.  onBeat (with beatSubdivisions=16) is the sole source for
    // crossing detection.  Having two sources (onEvent + onBeat) causes
    // _eventBeat to ping-pong at slow warp speeds: onEvent can send a
    // value slightly behind the latest onBeat, resetting _eventBeat
    // backward, and the next onBeat then re-crosses notes, producing
    // duplicate projectiles.
    lastKnownBeat = wrappedBeat;
    lastBeatTimestamp = now;

    // Track current bar in bar editor so it follows playback
    const currentBarIdx = Math.floor(wrappedBeat / 4);
    if (barEditor && currentGroove && currentBarIdx >= 0 && currentBarIdx < currentGroove.bars.length)
      if (barEditor._currentBarIndex !== currentBarIdx) {
        barEditor._currentBarIndex = currentBarIdx;
        barEditor.refresh();
      }

    // Lane hit-flashes are now triggered internally by the lane renderer
    // when gems cross the hit-line (_fireNote), keeping them in sync with
    // the visual gem positions rather than abcjs event timing.
  };

  cursorControl._onBeatCb = (beatNumber, _totalBeats, _totalTime) => {
    const now = performance.now();

    // Auto-restart (same logic as _onEventCb — see comment there)
    if (!isPlaying && now - _manualPauseAt > 300) {
      isPlaying = true;
      if (laneRenderer) laneRenderer.setPlaying(true);
      if (sheetBeltRenderer) sheetBeltRenderer.setPlaying(true);
      startRenderLoop();
    }

    if (!currentNotationInstance) return;

    // beatNumber is in quarter-note beats (subdivisions just increase frequency)
    const totalBeats = currentGroove ? currentGroove.bars.length * 4 : 0;
    const wrappedBeat = totalBeats > 0 ? beatNumber % totalBeats : beatNumber;

    // Derive playback rate from consecutive onBeat calls
    if (_prevBeatWall > 0) {
      const wallDt = now - _prevBeatWall;
      let beatDt = wrappedBeat - _prevBeatPos;
      if (beatDt < 0 && totalBeats > 0) beatDt += totalBeats;
      if (wallDt > 5 && beatDt > 0 && beatDt < 4) {
        const beatsPerMs = beatDt / wallDt;
        if (laneRenderer) laneRenderer.setPlaybackRate(beatsPerMs);
        if (sheetBeltRenderer) sheetBeltRenderer.setPlaybackRate(beatsPerMs);
      }
    }
    _prevBeatPos  = wrappedBeat;
    _prevBeatWall = now;

    // Feed position to renderers (keeps them synced even during rests)
    if (laneRenderer) laneRenderer.setCurrentBeat(wrappedBeat);
    if (sheetBeltRenderer) sheetBeltRenderer.setCurrentBeat(wrappedBeat);

    lastKnownBeat = wrappedBeat;
    lastBeatTimestamp = now;
  };
};

// ── Map MIDI pitch → Instrument enum ───────────────────────

const _midiPitchToInstrument = (pitch) => {
  switch (pitch) {
    case 36: return Instrument.BassDrum;
    case 38: return Instrument.SnareDrum;
    case 41: return Instrument.FloorTom;
    case 45: return Instrument.MidTom;
    case 48: return Instrument.MidTom;
    case 50: return Instrument.HighTom;
    case 42: return Instrument.ClosedHiHat;
    case 46: return Instrument.OpenHiHat;
    case 44: return Instrument.HiHatPedal;
    case 49: return Instrument.Crash;
    case 51: return Instrument.Ride;
    case 53: return Instrument.RideBell;
    default: return null;
  }
};

// ── Key-to-instrument mapping for recording ─────────────

const KEY_INSTRUMENT_MAP = Object.freeze({
  'q': Instrument.Crash,
  'w': Instrument.ClosedHiHat,
  'e': Instrument.Ride,
  'E': Instrument.RideBell,
  'r': Instrument.OpenHiHat,
  't': Instrument.HiHatPedal,
  'a': Instrument.HighTom,
  's': Instrument.SnareDrum,
  'd': Instrument.MidTom,
  'f': Instrument.FloorTom,
  ' ': Instrument.BassDrum,
});

// ── Recording logic ──────────────────────────────────────

const _recordTap = (instrument) => {
  if (!currentGroove || !isPlaying) return;

  // Interpolate current beat for best timing accuracy
  const now = performance.now();
  const elapsed = lastBeatTimestamp > 0 ? now - lastBeatTimestamp : 0;
  const beatsPerMs = currentBpm / 60000;
  const currentBeat = lastKnownBeat + elapsed * beatsPerMs;

  const totalBeats = currentGroove.bars.length * 4;
  const wrappedBeat = totalBeats > 0 ? currentBeat % totalBeats : currentBeat;
  const quantizedBeat = Math.round(wrappedBeat * 4) / 4;

  const barIdx = Math.floor(quantizedBeat / 4);
  if (barIdx < 0 || barIdx >= currentGroove.bars.length) return;

  const beatIndexes = AbcConverter._beatIndexes;
  const slotIdx = Math.round((quantizedBeat - barIdx * 4) * 4);
  if (slotIdx < 0 || slotIdx >= beatIndexes.length) return;

  const storageIdx = beatIndexes[slotIdx];
  const bar = currentGroove.bars[barIdx];
  let drumBit = bar.getDrumBit(storageIdx);
  if (!drumBit) {
    drumBit = new DrumBit(0);
    bar.setDrumBit(storageIdx, drumBit);
  }
  drumBit.setInstrument(instrument, PlayState.Stroke);
  _recordingDirty = true;

  // Reload renderers to show the new note
  if (laneRenderer) laneRenderer.loadGroove(currentGroove);
  if (sheetBeltRenderer) sheetBeltRenderer.loadGroove(currentGroove);

  // Visual feedback: trigger kit hit
  if (kitRenderer) kitRenderer.triggerHit(instrument);

  // Audio feedback: play the drum sound
  if (currentNotationInstance) {
    const midiPitch = _instrumentToMidiPitch(instrument);
    if (midiPitch >= 0)
      ABCJS.synth.playEvent(
        [{ cmd: 'note', pitch: midiPitch, volume: 80, start: 0, duration: 0.25, instrument: 128, gap: 0 }],
        [],
        currentNotationInstance.millisecondsPerMeasure()
      ).catch(() => {});
  }
};

// ── Record button ────────────────────────────────────────

const wireRecordButton = () => {
  const btn = document.getElementById('btn-record');
  if (!btn) return;

  btn.addEventListener('click', () => {
    isRecording = !isRecording;
    btn.classList.toggle('active', isRecording);
    btn.textContent = isRecording ? '\u23F9 Stop Rec' : '\u23FA Record';

    // When stopping recording while playback is stopped, sync immediately
    if (!isRecording && _recordingDirty && !isPlaying && currentGroove) {
      _recordingDirty = false;
      const abc = convertGroove(currentGroove);
      displayABC(abc);
    }
  });

  // Key handler for recording taps
  document.addEventListener('keydown', (e) => {
    if (!isRecording || !isPlaying) return;
    if (e.repeat) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const instrument = KEY_INSTRUMENT_MAP[e.key] ?? KEY_INSTRUMENT_MAP[e.key.toLowerCase()];
    if (!instrument) return;

    e.preventDefault();
    _recordTap(instrument);
  });
};

// ── Beam-per-instrument toggle ───────────────────────────

const wireBeamToggle = () => {
  const chk = document.getElementById('chk-beam-per-instrument');
  if (!chk) return;

  chk.addEventListener('change', () => {
    if (sheetBeltRenderer) {
      sheetBeltRenderer.setBeamPerInstrument(chk.checked);
      if (currentGroove)
        sheetBeltRenderer.loadGroove(currentGroove);
      renderOnce();
    }
  });
};

// ── Light mode toggle ────────────────────────────────────

const _applyLightMode = (on) => {
  document.documentElement.classList.toggle('light-mode', on);
  if (laneRenderer)
    laneRenderer.setLightMode(on);
  if (sheetBeltRenderer)
    sheetBeltRenderer.setLightMode(on);
};

const wireLightModeToggle = () => {
  const btn = document.getElementById('btn-light-mode');
  if (!btn)
    return;

  // Restore from localStorage
  const stored = localStorage.getItem('szdrums-light-mode');
  let lightOn = stored === 'true';
  if (lightOn) {
    _applyLightMode(true);
    btn.textContent = 'Dark';
  }

  btn.addEventListener('click', () => {
    lightOn = !lightOn;
    _applyLightMode(lightOn);
    btn.textContent = lightOn ? 'Dark' : 'Light';
    localStorage.setItem('szdrums-light-mode', String(lightOn));
    renderOnce();
  });
};

// ── BPM input wiring ───────────────────────────────────────

const wireTempoInput = () => {
  const input = document.getElementById('tempo-input');
  if (!input)
    return;

  input.addEventListener('change', () => {
    const bpm = parseInt(input.value, 10);
    if (!isNaN(bpm) && bpm >= 30 && bpm <= 300) {
      currentBpm = bpm;
      if (laneRenderer)
        laneRenderer.setBpm(bpm);
      if (sheetBeltRenderer)
        sheetBeltRenderer.setBpm(bpm);
      if (isPlaying)
        _bpmDirty = true;
      else if (currentGroove)
        displayABC(convertGroove(currentGroove));
    }
  });
};

// ── Tab switching ──────────────────────────────────────────

const wireTabs = () => {
  const tabBar = document.getElementById('editor-tabs');
  if (!tabBar)
    return;

  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn)
      return;

    const targetId = btn.dataset.tab;
    if (!targetId)
      return;

    // Sync deferred bar-editor changes before showing sheet / ABC
    if (targetId !== 'tab-bar-editor')
      _syncAbcIfDirty();

    // deactivate all tabs + panes
    for (const b of tabBar.querySelectorAll('.tab-btn'))
      b.classList.remove('active');

    for (const p of document.querySelectorAll('#tab-panes .tab-pane'))
      p.classList.remove('active');

    // activate selected
    btn.classList.add('active');
    const pane = document.getElementById(targetId);
    if (pane)
      pane.classList.add('active');
  });
};

// ── Boot ───────────────────────────────────────────────────

const boot = () => {
  initializeSynthControl();
  initializeRenderers();
  wireCursorToRenderers();
  wireRandomButton();
  wireNewButton();
  wireRecordButton();
  wireBeamToggle();
  wireTempoInput();
  wireTabs();
  wireLightModeToggle();

  // Repaint renderers with fresh kit layout after any resize
  window.addEventListener('resize', () => requestAnimationFrame(() => renderOnce()));

  // Paint initial state of lane + belt renderers (loop starts on play)
  renderOnce();

  // Handle URL parameters
  const uri = getParameterByName('uri');
  if (uri) {
    loadAndDisplayABC(uri);
    return;
  }

  const mode = getParameterByName('mode');
  if (mode === 'random') {
    currentGroove = generateRandomGroove();
    const abc = convertGroove(currentGroove);
    displayABC(abc);
    return;
  }

  // Default: create an empty 1-bar groove so the editor is usable immediately
  currentGroove = new DrumGroove();
  currentGroove.addBar(new Bar());
  const abc = convertGroove(currentGroove);
  displayABC(abc);
  console.info('SynthelicZ Drums ready. Use ?uri=<file> or ?mode=random, or click Random, or edit in the Bar Editor.');
};

// Wait for the DOM (and abcjs global) to be available
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', boot);
else
  boot();

})(window.SZDrums = window.SZDrums || {});
