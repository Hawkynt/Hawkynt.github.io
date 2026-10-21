/* All mutable game state in one object: the phase, the song being played and its
   note list, score/combo/judgement counters and the animation values that drive
   lane flashes, glow rings, screen flash and the background beat pulse. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;

  NS.state = NS.state || {
    state: C.STATE_SONG_SELECT,
    selectedSongIndex: 0,
    lastTimestamp: 0,

    /* ── Playing state ── */
    currentSong: null,
    activeNotes: [],
    songTime: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    missCount: 0,
    totalNotes: 0,

    /* ── Streak glow ── */
    comboGlowIntensity: 0,

    /* ── Lane flash / glow ring animations ── */
    laneFlash: [0, 0, 0, 0],           // per-lane flash timer (0..1, decays each frame)
    glowRings: [],                     // expanding glow rings on PERFECT hits
    consecutiveMisses: 0,              // escalating screen shake on repeated misses
    comboPulse: 0,                     // visual pulse for combo display (0..1, decays)

    /* ── Screen flash (triggers on PERFECT hits) ── */
    screenFlashAlpha: 0,
    screenFlashColor: '#fff',

    /* ── Background beat pulse ── */
    bgPulseIntensity: 0,
    bgPulsePhase: 0,

    /* ── Combo bounce (elastic scale for combo text) ── */
    comboBounce: 0,
    comboLastValue: 0
  };
})();
