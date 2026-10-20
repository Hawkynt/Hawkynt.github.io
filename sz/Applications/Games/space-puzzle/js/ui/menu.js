/* The menu bar actions, the dialog wiring and the OS window hooks — everything that
   connects the game to the desktop shell around it. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const { User32 } = window.SZ?.Dlls ?? {};
  const { resetGame, togglePause } = NS.game;
  const { renderHighScores } = NS.highscores;

  const menuActions = {
    'new': () => resetGame(),
    'pause': togglePause,
    'high-scores': () => {
      renderHighScores();
      SZ.Dialog.show('highScoresBackdrop');
    },
    'exit': () => { if (User32?.DestroyWindow) User32.DestroyWindow(); },
    'controls': () => SZ.Dialog.show('controlsBackdrop'),
    'about': () => SZ.Dialog.show('dlg-about')
  };

  new SZ.MenuBar({ onAction: (action) => menuActions[action]?.() });

  SZ.Dialog.wireAll();

  /* ── OS integration ── */
  function handleResize() {
    // Canvas size is fixed; CSS scales it
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg, wParam, lParam) => {
      if (msg === 'WM_THEMECHANGED') {
        // Theme changed — canvas game needs no action
      }
      if (msg === 'WM_SIZE')
        handleResize();
    });
  }

  Object.assign(NS.menu, { handleResize });
})();
