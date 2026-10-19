/* S, the one shared state object: the board, the current piece, the queues, the
   lock-delay bookkeeping, the run's score/level/lines and the high scores. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});

  NS.state = NS.state || {
    board: null,
    currentPiece: null,
    nextQueue: [],
    heldType: null,
    holdUsed: false,
    lockStart: null,
    lockResets: 0,
    lowestRow: -99,
    bag: null,
    score: 0,
    level: 0,
    lines: 0,
    gameActive: false,
    gamePaused: false,
    gameOverFlag: false,
    lastDropTime: 0,
    animFrameId: null,
    clearingRows: null,
    clearingRowsSnapshot: [],
    clearAnimStart: 0,
    softDropping: false,
    highScores: []
  };
})();
