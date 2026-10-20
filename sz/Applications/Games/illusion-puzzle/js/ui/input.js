/* Keyboard and pointer input: the movement and rotation keys, pause, restart, the
   level-complete advance, and the canvas tap on the ready and end screens. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { movePlayer } = NS.player;
  const { rotatePerspective } = NS.perspective;
  const { nextLevel } = NS.level;
  const { togglePause, resetAndStart } = NS.game;

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2') {
      e.preventDefault();
      resetAndStart();
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (S.state === C.STATE_LEVEL_COMPLETE) {
      nextLevel();
      return;
    }

    if (S.state === C.STATE_GAME_OVER) {
      resetAndStart();
      return;
    }

    if (S.state !== C.STATE_PLAYING) return;

    // Movement
    if (e.code === 'ArrowUp' || e.code === 'KeyW') movePlayer(-1, 0);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') movePlayer(1, 0);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') movePlayer(0, -1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') movePlayer(0, 1);

    // Perspective rotation
    else if (e.code === 'KeyQ') rotatePerspective(-1);
    else if (e.code === 'KeyE') rotatePerspective(1);
  });

  D.canvas.addEventListener('pointerdown', () => {
    if (S.state === C.STATE_READY || S.state === C.STATE_GAME_OVER)
      resetAndStart();
    else if (S.state === C.STATE_LEVEL_COMPLETE)
      nextLevel();
  });
})();
