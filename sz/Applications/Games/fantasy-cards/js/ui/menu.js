/* Menu bar actions: new game, pause, the high-scores dialog with its reset,
   the help dialogs and the exit request to the frame host. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const S = NS.state;

  function handleAction(action) {
    switch (action) {
      case 'new':
        NS.game.startNewGame();
        break;
      case 'pause':
        NS.game.togglePause();
        break;
      case 'high-scores':
        NS.status.renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            S.highScores = [];
            NS.storage.saveHighScores();
            NS.status.renderHighScores();
          }
        });
        break;
      case 'how-to-play':
        SZ.Dialog.show('howToPlayBackdrop');
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  Object.assign(NS.menu, { handleAction });
})();
