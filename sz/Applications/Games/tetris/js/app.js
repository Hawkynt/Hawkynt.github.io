/* Bootstrap: the requestAnimationFrame game loop (drop timing, lock delay, clear
   animation), window fitting and start-up. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { getDropInterval } = NS.rules;
  const { isGrounded, lockAndAdvance, moveDown, advanceAfterClear } = NS.pieces;

  /* ---- Game Loop ---- */
  function gameLoop(timestamp) {
    S.animFrameId = requestAnimationFrame(gameLoop);

    if (!S.gameActive || S.gamePaused || S.gameOverFlag)
      return;

    if (S.clearingRows) {
      if (timestamp - S.clearAnimStart >= 500) {
        const count = S.clearingRows.length;
        S.clearingRowsSnapshot = [...S.clearingRows];
        NS.rules.removeRows(S.clearingRows);
        S.clearingRows = null;
        S.clearAnimStart = 0;
        advanceAfterClear(count);
      }
      return;
    }

    if (!S.currentPiece)
      return;

    if (isGrounded()) {
      if (S.lockStart === null)
        S.lockStart = timestamp;
      if (timestamp - S.lockStart >= C.LOCK_DELAY_MS || S.lockResets >= C.MAX_LOCK_RESETS)
        lockAndAdvance();
      S.lastDropTime = timestamp;
      return;
    }

    S.lockStart = null;
    const interval = getDropInterval(S.level);
    if (timestamp - S.lastDropTime >= interval) {
      moveDown();
      S.lastDropTime = timestamp;
    }
  }

  /* ---- Window Resize ---- */
  function requestWindowResize() {
    requestAnimationFrame(() => {
      // ask for the unscaled size; a smaller screen shrinks the window and fitToWindow scales the game down
      D.gameFrame.style.transform = '';
      const w = document.documentElement.scrollWidth;
      const h = document.documentElement.scrollHeight;
      fitToWindow();
      SZ.Dlls.User32.MoveWindow(w, h);
    });
  }

  /* A window smaller than the game (a phone screen) shows all of it, scaled down */
  function fitToWindow() {
    D.gameFrame.style.transform = '';
    const top = D.gameFrame.offsetTop;
    const needW = document.documentElement.scrollWidth;
    const needH = document.documentElement.scrollHeight - top;
    const scale = Math.min(1, window.innerWidth / needW, (window.innerHeight - top) / needH);
    D.gameFrame.style.transformOrigin = '0 0';
    D.gameFrame.style.transform = scale < 1 ? `scale(${scale})` : '';
  }

  window.addEventListener('resize', fitToWindow);

  /* ---- Init ---- */
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    NS.board.buildBoard();
    NS.board.buildPreview();
    SZ.GameAudio.attachMuteButton();
    NS.highscores.loadHighScores();
    NS.game.newGame();
    requestWindowResize();
  }

  Object.assign(NS.app, { gameLoop, requestWindowResize, fitToWindow, init });

  init();
})();
