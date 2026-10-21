/* OS integration: the device-pixel-ratio canvas setup, the window title that
   tracks the game phase, and the window-procedure/resize hooks that re-setup. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    D.canvas.width = C.CANVAS_W * dpr;
    D.canvas.height = C.CANVAS_H * dpr;
    D.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function updateWindowTitle() {
    const suffix = S.state === C.STATE_PAUSED ? ' — Paused'
      : S.state === C.STATE_RESULTS ? ' — Results'
      : S.state === C.STATE_SONG_SELECT ? ' — Song Select'
      : S.currentSong ? ` — ${S.currentSong.name}`
      : '';
    const title = `Rhythm Game${suffix}`;
    document.title = title;
    if (D.User32?.SetWindowText)
      D.User32.SetWindowText(title);
  }

  if (D.User32?.RegisterWindowProc) {
    D.User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE' || msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }

  window.addEventListener('resize', setupCanvas);

  Object.assign(NS.os, { setupCanvas, updateWindowTitle });
})();
