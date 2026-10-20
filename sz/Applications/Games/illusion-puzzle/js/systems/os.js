/* OS integration: the window title naming the current level, and the canvas re-fit
   on window resize, WM_SIZE and WM_THEMECHANGED. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const L = NS.levels;
  const S = NS.state;
  const D = NS.dom;

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleResize() {
    D.setupCanvas();
  }

  function updateWindowTitle() {
    const levelName = L.LEVELS[S.currentLevel]?.name || '';
    const title = S.state === C.STATE_GAME_OVER
      ? 'Optical Illusion Puzzle — All Complete!'
      : `Optical Illusion Puzzle — Level ${S.currentLevel + 1}: ${levelName}`;
    document.title = title;
    if (D.User32?.SetWindowText)
      D.User32.SetWindowText(title);
  }

  if (D.User32?.RegisterWindowProc) {
    D.User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        D.setupCanvas();
    });
  }

  window.addEventListener('resize', handleResize);

  Object.assign(NS.os, { handleResize, updateWindowTitle });
})();
