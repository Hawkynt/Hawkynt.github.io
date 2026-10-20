/* OS integration: the (no-op) resize handler — the canvas is fixed-size and CSS-scaled
   — and the window-procedure registration that reacts to theme and size messages. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const V = NS.view;

  /* ── OS integration ── */
  function handleResize() {
    // Canvas size is fixed; CSS scales it
  }

  if (V.User32?.RegisterWindowProc) {
    V.User32.RegisterWindowProc((msg, wParam, lParam) => {
      if (msg === 'WM_THEMECHANGED') {
        // Theme changed — canvas game needs no action
      }
      if (msg === 'WM_SIZE')
        handleResize();
    });
  }

  Object.assign(NS.os, { handleResize });
})();
