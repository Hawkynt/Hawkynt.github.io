/* OS integration: the window-title update (also pushed to the native window via
   SetWindowText), the resize handler that rescales the canvas, and the native window
   procedure registration for WM_SIZE / WM_THEMECHANGED. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const ROOMS = NS.rooms;

  /* ── API: Windows integration ── */
  const { User32 } = SZ?.Dlls ?? {};

  function handleResize() {
    D.setupCanvas();
  }

  function updateWindowTitle() {
    const roomName = ROOMS[S.currentRoom]?.name || '';
    const title = S.state === C.STATE_GAME_OVER
      ? 'Mind-Bending Puzzle — Awakened!'
      : `Mind-Bending Puzzle — Room ${S.currentRoom + 1}: ${roomName}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        D.setupCanvas();
    });
  }

  window.addEventListener('resize', handleResize);

  Object.assign(NS.os, { handleResize, updateWindowTitle });
})();
