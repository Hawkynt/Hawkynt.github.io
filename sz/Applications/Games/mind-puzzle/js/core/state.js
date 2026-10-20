/* S, the one shared mutable state object: the game-state name, the current room and
   player position, the discovered/visited room maps, the high scores and run timings,
   the held-key map, the perspective-transition and reality-warp bookkeeping, the
   ambient-particle timer, the throttled-sound and hint-touch bookkeeping and the loop
   clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;

  NS.state = NS.state || {
    state: C.STATE_READY,
    currentRoom: 0,
    player: { x: 100, y: 400 },
    discoveredRules: {},
    roomsVisited: {},
    highScores: [],
    startTime: 0,
    elapsedTime: 0,

    /* ── Input ── */
    keys: {},

    /* ── Perspective / view transition ── */
    currentView: C.VIEW_NORMAL,
    transitionProgress: 1,
    transitionTo: C.VIEW_NORMAL,
    shiftTimer: 0,

    /* ── Warp effect ── */
    warpActive: false,
    warpEffect: 0,
    waveAmplitude: 0,

    /* ── Ambient particles ── */
    ambientTimer: 0,

    /* ── Throttled sound bookkeeping ── */
    lastSoundAt: {},

    /* ── Hint-touch bookkeeping ── */
    touchedHint: null,
    hintTouchedNow: false,

    /* ── Loop clock ── */
    lastTimestamp: 0,
    animFrameId: null
  };
})();
