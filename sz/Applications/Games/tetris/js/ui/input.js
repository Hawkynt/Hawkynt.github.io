/* Keyboard and touch/click input: the key map, dialog closing on Escape and the
   swipe/tap controls on the board. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const S = NS.state;
  const D = NS.dom;
  const { moveLeft, moveRight, softDrop, rotateCW, rotateCCW, hardDrop, holdPiece } = NS.pieces;

  /* ---- Keyboard Input ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      return;
    }

    if (e.key === 'Enter' && S.gameOverFlag) {
      e.preventDefault();
      NS.game.newGame();
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      NS.game.newGame();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      NS.game.togglePause();
      return;
    }

    if (!S.gameActive || S.gamePaused || S.gameOverFlag || S.clearingRows)
      return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        moveLeft();
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveRight();
        break;
      case 'ArrowDown':
        e.preventDefault();
        softDrop();
        S.softDropping = true;
        break;
      case 'ArrowUp':
      case 'z':
      case 'Z':
        e.preventDefault();
        rotateCW();
        break;
      case 'x':
      case 'X':
        e.preventDefault();
        rotateCCW();
        break;
      case ' ':
        e.preventDefault();
        hardDrop();
        break;
      case 'c':
      case 'C':
      case 'Shift':
        e.preventDefault();
        holdPiece();
        break;
    }
  });

  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowDown')
      S.softDropping = false;
  });

  /* ---- Touch / click controls ---- */
  D.holdBox.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    holdPiece();
  });

  {
    let touchStartX = 0, touchStartY = 0, touchId = null;
    const SWIPE_THRESHOLD = 30;

    D.boardWrapper.addEventListener('pointerdown', (e) => {
      if (S.gameOverFlag || !S.gameActive) {
        NS.game.newGame();
        return;
      }
      touchStartX = e.clientX;
      touchStartY = e.clientY;
      touchId = e.pointerId;
    });

    D.boardWrapper.addEventListener('pointerup', (e) => {
      if (e.pointerId !== touchId) return;
      touchId = null;
      if (!S.gameActive || S.gamePaused || S.gameOverFlag) return;

      const dx = e.clientX - touchStartX;
      const dy = e.clientY - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < SWIPE_THRESHOLD) {
        rotateCW();
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) moveRight();
        else moveLeft();
      } else {
        if (dy > 0) softDrop();
        else hardDrop();
      }
    });
  }

  Object.assign(NS.input, {});
})();
