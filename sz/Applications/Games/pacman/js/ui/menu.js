;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.menu.handleMenuAction = function handleMenuAction(action) {
    switch (action) {
      case 'new':
        NS.flow.newGame();
        break;
      case 'pause':
        NS.pause.togglePause();
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

  new SZ.MenuBar({ onAction: NS.menu.handleMenuAction });

})();
