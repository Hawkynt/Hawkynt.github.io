/* The menu bar and its actions. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;

  new SZ.MenuBar({ onAction: handleMenuAction });

  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        NS.game.newGame();
        break;
      case 'pause':
        NS.game.togglePause();
        break;
      case 'high-scores':
        NS.highscores.showHighScores();
        break;
      case 'size-small':
        NS.field.setFieldSize(C.FIELD_SMALL);
        break;
      case 'size-large':
        NS.field.setFieldSize(C.FIELD_LARGE);
        break;
      case 'zen':
        NS.field.toggleZenMode();
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
