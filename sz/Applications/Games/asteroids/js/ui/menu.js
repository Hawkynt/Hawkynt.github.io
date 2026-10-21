/* The menu bar: new game opens the mode select, pause toggles it, high scores
   opens the dialog, exit closes the window (or destroys it inside the OS shell). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  function handleMenuAction(action) {
    switch (action) {
      case 'new': NS.app.showModeSelect(); break;
      case 'pause': NS.flow.togglePause(); break;
      case 'high-scores': NS.highscores.showHighScores(); break;
      case 'exit':
        if (SZ.Dlls.Kernel32.IsInsideOS())
          SZ.Dlls.User32.DestroyWindow();
        else
          window.close();
        break;
      case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
      case 'about': SZ.Dialog.show('dlg-about'); break;
    }
  }

  new SZ.MenuBar({ onAction: handleMenuAction });

  Object.assign(NS.menu, { handleMenuAction });
})();
