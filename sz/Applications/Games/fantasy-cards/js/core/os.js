/* OS integration: the desktop window procedure (resize and theme change), the
   browser resize event and the window title that tracks the game state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function handleResize() {
    D.setupCanvas();
  }

  function updateWindowTitle() {
    const title = S.state === C.STATE_VICTORY
      ? 'Fantasy Cards — Victory!'
      : S.state === C.STATE_GAME_OVER
        ? 'Fantasy Cards — Game Over'
        : `Fantasy Cards — Turn ${S.turnNumber}`;
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
