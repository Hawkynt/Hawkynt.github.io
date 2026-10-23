/* Keyboard and pointer: the key map, tutorial paging keys, pause and bomb keys,
   the start/restart gesture on tap and the window resize hook. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const I = NS.input = NS.input || {};

  I.handleStart = function handleStart() {
    if (S.state === C.STATE_READY) {
      S.state = C.STATE_PLAYING;
      SZ.GameAudio.play('select');
      NS.flow.updateStatus();
    } else if (S.state === C.STATE_DEAD) {
      NS.flow.resetGame();
    }
  };

  document.addEventListener('keydown', function(e) {
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
        if (S.tutorialPage >= T.TUTORIAL_PAGES.length)
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

    S.keys[e.code] = true;

    if (e.code === 'Space') {
      e.preventDefault();
      if (S.state === C.STATE_READY || S.state === C.STATE_DEAD)
        I.handleStart();
      else if (S.state === C.STATE_PLAYING)
        NS.bombs.placeBomb();
    }
  });

  document.addEventListener('keyup', function(e) {
    S.keys[e.code] = false;
  });

  /* ── Click/Tap to start / advance tutorial ── */
  D.canvas.addEventListener('pointerdown', () => {
    if (S.showTutorial) {
      ++S.tutorialPage;
      if (S.tutorialPage >= T.TUTORIAL_PAGES.length)
        S.showTutorial = false;
      return;
    }
    if (S.state === C.STATE_READY || S.state === C.STATE_DEAD)
      I.handleStart();
  });

  /* ── Resize ── */
  window.addEventListener('resize', D.setupCanvas);
})();
