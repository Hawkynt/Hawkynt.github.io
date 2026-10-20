/* Keyboard and pointer input: the held-key map, F2 new game, tutorial page navigation,
   the H help toggle, Escape pause, key release, and click/tap to start or advance. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  /* ── Input ── */
  document.addEventListener('keydown', (e) => {
    S.keysDown[e.key] = true;

    if (e.key === 'F2') {
      e.preventDefault();
      NS.flow.resetGame();
      return;
    }

    /* Tutorial navigation */
    if (S.showTutorial) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        ++S.tutorialPage;
        if (S.tutorialPage >= C.TUTORIAL_PAGES.length)
          S.showTutorial = false;
        return;
      }
      if (e.code === 'ArrowLeft' && S.tutorialPage > 0) {
        e.preventDefault();
        --S.tutorialPage;
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        S.showTutorial = false;
        return;
      }
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (S.state === C.STATE_PLAYING || S.state === C.STATE_PAUSED || S.state === C.STATE_READY) {
        S.showTutorial = !S.showTutorial;
        S.tutorialPage = 0;
        return;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      NS.flow.togglePause();
      return;
    }
  });

  document.addEventListener('keyup', (e) => {
    S.keysDown[e.key] = false;
  });

  /* ── Click/Tap to start ── */
  V.canvas.addEventListener('pointerdown', () => {
    if (S.showTutorial) {
      ++S.tutorialPage;
      if (S.tutorialPage >= C.TUTORIAL_PAGES.length)
        S.showTutorial = false;
      return;
    }
    if (S.state === C.STATE_READY || S.state === C.STATE_DEAD)
      NS.flow.resetGame();
  });
})();
