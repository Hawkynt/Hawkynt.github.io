/* OS integration: window resize and theme-change handling through the
   desktop window procedure and the browser resize event. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const D = NS.dom;

  /* ── OS Integration ── */
  function handleResize() {
    D.setupCanvas();
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
})();
