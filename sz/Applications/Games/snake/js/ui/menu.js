/* The menu bar and its actions. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  new SZ.MenuBar({ onAction: handleMenuAction });

  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        NS.options.showOptionsDialog();
        break;
      case 'pause':
        NS.game.togglePause();
        break;
      case 'high-scores':
        NS.highscores.showHighScores();
        break;
      case 'exit':
        if (SZ.Dlls.Kernel32.IsInsideOS())
          SZ.Dlls.User32.DestroyWindow();
        else
          window.close();
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
    }
  }

  Object.assign(NS.menu, { handleMenuAction });
})();
