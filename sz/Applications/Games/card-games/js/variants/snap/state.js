/* Snap: layout constants and the one state object of the variant (SZ.CardGames.v.snap). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const V = SZ.CardGames.v.snap = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const FLIP_INTERVAL = 1.5;
  const SNAP_WINDOW_DURATION = 1.5;
  const PAUSE_DURATION = 1.2;
  const SNAP_RESULT_DURATION = 1.5;

  /* ── Button positions ── */
  const SNAP_BTN = { x: CANVAS_W / 2 - 70, y: CANVAS_H / 2 - 22, w: 140, h: 44 };

  const S = V.S = {
    /* ── Game state ── */
    playerDeck: [],
    aiDeck: [],
    centralPile: [],
    score: 26,
    roundOver: false,
    gameOver: false,
    resultMsg: '',
    /* ── Timing state ── */
    flipTimer: 0,
    isPlayerTurn: true,
    snapWindowOpen: false,
    snapWindowTimer: 0,
    aiReactionDelay: 0,
    aiReactionTimer: 0,
    aiWillSnap: false,
    pauseTimer: 0,
    isPaused: false,
    /* ── Feedback state ── */
    lastSnapResult: '',
    lastSnapResultTimer: 0,
    lastReactionTime: 0,
    showReactionTime: false,
    reactionDisplayTimer: 0,
    snapPulsePhase: 0,
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, FLIP_INTERVAL, SNAP_WINDOW_DURATION, PAUSE_DURATION,
    SNAP_RESULT_DURATION, SNAP_BTN });

})();
