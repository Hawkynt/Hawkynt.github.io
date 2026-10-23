/* OS integration: window title, window-procedure registration and resize. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const OS = NS.os = NS.os || {};

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  OS.handleResize = function() {
    D.setupCanvas();
  };

  OS.updateWindowTitle = function() {
    const variant = S.currentVariant?.name || 'Card Games Suite';
    const suffix = S.state === K.STATE_PAUSED ? ' \u2014 Paused'
      : S.state === K.STATE_GAME_OVER ? ' \u2014 Game Over'
      : S.state === K.STATE_ROUND_OVER ? ' \u2014 Round Over'
      : '';
    const title = variant + suffix;
    document.title = title;
    if (D.User32?.SetWindowText)
      D.User32.SetWindowText(title);
  };

  if (D.User32?.RegisterWindowProc) {
    D.User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        OS.handleResize();
      else if (msg === 'WM_THEMECHANGED')
        D.setupCanvas();
    });
  }

  window.addEventListener('resize', OS.handleResize);
})();
