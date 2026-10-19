/* The game run: game over, pause (also from the window losing focus) and the new-game
   reset that rebuilds the queues and starts the loop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { nextFromBag } = NS.rules;
  const { render, renderHold, renderPreview, updateDisplays } = NS.board;
  const { spawnPiece } = NS.pieces;
  const { checkHighScore } = NS.highscores;

  /* ---- Game Over ---- */
  function doGameOver() {
    S.gameActive = false;
    S.gameOverFlag = true;
    render();
    D.finalScoreEl.textContent = 'Score: ' + S.score;
    D.gameOverOverlay.classList.add('visible');
    SZ.GameAudio.play('lose');
    checkHighScore();
  }

  /* ---- Pause ---- */
  function togglePause() {
    if (!S.gameActive || S.gameOverFlag)
      return;
    S.gamePaused = !S.gamePaused;
    SZ.GameAudio.play('click');
    if (S.gamePaused) {
      D.pauseOverlay.classList.add('visible');
    } else {
      D.pauseOverlay.classList.remove('visible');
      S.lastDropTime = performance.now();
      if (S.lockStart !== null)
        S.lockStart = S.lastDropTime;
    }
  }

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.gameActive && !S.gamePaused && !S.gameOverFlag,
    pause: togglePause
  });

  /* ---- New Game ---- */
  function newGame() {
    if (S.animFrameId) {
      cancelAnimationFrame(S.animFrameId);
      S.animFrameId = null;
    }

    S.board = [];
    for (let r = 0; r < C.ROWS; ++r)
      S.board.push(new Array(C.COLS).fill(null));

    S.score = 0;
    S.level = 0;
    S.lines = 0;
    S.gameActive = true;
    S.gamePaused = false;
    S.gameOverFlag = false;
    S.clearingRows = null;
    S.clearingRowsSnapshot = [];
    S.clearAnimStart = 0;
    S.softDropping = false;
    S.bag = null;
    S.heldType = null;
    S.holdUsed = false;
    S.currentPiece = null;

    D.pauseOverlay.classList.remove('visible');
    D.gameOverOverlay.classList.remove('visible');

    S.nextQueue = [];
    for (let i = 0; i < C.NEXT_COUNT; ++i)
      S.nextQueue.push(nextFromBag());
    renderHold();
    if (!spawnPiece())
      return;

    updateDisplays();
    render();
    renderPreview();

    S.lastDropTime = performance.now();
    S.animFrameId = requestAnimationFrame(gameLoop);
  }

  /* the loop lives in app.js; newGame starts it through the namespace */
  function gameLoop(timestamp) {
    NS.app.gameLoop(timestamp);
  }

  Object.assign(NS.game, { doGameOver, togglePause, newGame });
})();
