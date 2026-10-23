/* The OS window integration: the window procedure reacting to theme changes
   and resizing, and the initial window title. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const D = NS.dom;

  /* ── OS Integration ── */
  SZ.Dlls.User32.RegisterWindowProc(function(msg) {
    if (msg === WM_THEMECHANGED) {
      // Theme changed — CSS handles it
    }
    if (msg === WM_SIZE) {
      D.setupCanvas();
    }
  });

  SZ.Dlls.User32.SetWindowText('Bomberman');
})();
