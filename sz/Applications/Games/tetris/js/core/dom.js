/* D, the long-lived page objects: the board and mini-grid containers, the displays,
   the overlays and the cell arrays the renderer paints into. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});

  NS.dom = NS.dom || {
    boardEl: document.getElementById('board'),
    previewGridEl: document.getElementById('previewGrid'),
    holdGridEl: document.getElementById('holdGrid'),
    holdBox: document.getElementById('holdBox'),
    scoreDisplay: document.getElementById('scoreDisplay'),
    levelDisplay: document.getElementById('levelDisplay'),
    linesDisplay: document.getElementById('linesDisplay'),
    pauseOverlay: document.getElementById('pauseOverlay'),
    gameOverOverlay: document.getElementById('gameOverOverlay'),
    finalScoreEl: document.getElementById('finalScore'),
    boardBorder: document.querySelector('.board-border'),
    boardWrapper: document.querySelector('.board-wrapper'),
    gameFrame: document.querySelector('.game-frame'),
    boardCells: [],
    previewCells: [],
    holdCells: []
  };
})();
