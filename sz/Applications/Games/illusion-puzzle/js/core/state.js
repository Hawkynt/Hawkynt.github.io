/* S, the one shared mutable state object: the game phase, the current level, the
   player and its move animation, the collected gems, moves and trail, the high
   scores and level progress, and the perspective rotation animation. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;

  NS.state = NS.state || {
    state: C.STATE_READY,
    currentLevel: 0,
    player: { row: 0, col: 0, x: 0, y: 0, targetX: 0, targetY: 0, moveProgress: 1 },
    collected: [],
    moves: 0,
    trail: [],
    highScores: [],
    levelProgress: {},

    /* ── Perspective rotation ── */
    perspective: 0,
    rotationProgress: 1,
    rotationFrom: 0,
    rotationTo: 0
  };
})();
