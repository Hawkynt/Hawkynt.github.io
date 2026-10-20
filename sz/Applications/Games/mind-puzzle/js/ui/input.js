/* Input: the auto-pause handler, the keyboard map (F2 new game, Escape pause/resume,
   Q perspective shift, E/Space interact, any key restarts a finished run) and the canvas
   pointer-down that starts or restarts the game. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { resetAndStart } = NS.flow;
  const { shiftPerspective, checkPortals, checkObjects } = NS.rules;

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.state === C.STATE_EXPLORING,
    pause: () => {
      S.state = C.STATE_PAUSED;
    }
  });

  window.addEventListener('keydown', (e) => {
    S.keys[e.code] = true;

    if (e.code === 'F2') {
      e.preventDefault();
      resetAndStart();
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (S.state === C.STATE_EXPLORING)
        S.state = C.STATE_PAUSED;
      else if (S.state === C.STATE_PAUSED)
        S.state = C.STATE_EXPLORING;
      return;
    }

    // Perspective shift
    if (e.code === 'KeyQ' && S.state === C.STATE_EXPLORING) {
      shiftPerspective();
      return;
    }

    // Interact
    if ((e.code === 'KeyE' || e.code === 'Space') && S.state === C.STATE_EXPLORING) {
      checkPortals();
      checkObjects();
      return;
    }

    if (S.state === C.STATE_GAME_OVER)
      resetAndStart();
  });

  window.addEventListener('keyup', (e) => {
    S.keys[e.code] = false;
  });

  D.canvas.addEventListener('pointerdown', () => {
    if (S.state === C.STATE_READY || S.state === C.STATE_GAME_OVER)
      resetAndStart();
  });
})();
