;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      NS.flow.newGame();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      NS.pause.togglePause();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (S.gameState === 'idle' || S.gameState === 'gameover')
        NS.flow.newGame();
      return;
    }

    if (S.gameState !== 'playing')
      return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        S.pacman.nextDir = C.DIR_LEFT;
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        S.pacman.nextDir = C.DIR_UP;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        S.pacman.nextDir = C.DIR_RIGHT;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        S.pacman.nextDir = C.DIR_DOWN;
        break;
    }
  });

  /* ---- Touch / click controls ---- */
  {
    let touchStartX = 0, touchStartY = 0, touchId = null;
    const SWIPE_THRESHOLD = 20;

    D.canvas.addEventListener('pointerdown', (e) => {
      if (S.gameState === 'idle' || S.gameState === 'gameover') {
        NS.flow.newGame();
        return;
      }
      touchStartX = e.clientX;
      touchStartY = e.clientY;
      touchId = e.pointerId;
    });

    D.canvas.addEventListener('pointerup', (e) => {
      if (e.pointerId !== touchId) return;
      touchId = null;
      if (S.gameState !== 'playing') return;

      const dx = e.clientX - touchStartX;
      const dy = e.clientY - touchStartY;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

      if (Math.abs(dx) > Math.abs(dy))
        S.pacman.nextDir = dx > 0 ? C.DIR_RIGHT : C.DIR_LEFT;
      else
        S.pacman.nextDir = dy > 0 ? C.DIR_DOWN : C.DIR_UP;
    });
  }

})();
