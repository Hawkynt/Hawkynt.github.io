/* The menu-bar action handler: new game, pause toggle, the high-scores dialog (with its
   reset branch), the controls and about dialogs, and exit (posting a close message to the
   embedding frame). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const { renderHighScores, saveHighScores } = NS.persist;
  const { resetAndStart } = NS.flow;

  function handleAction(action) {
    switch (action) {
      case 'new':
        resetAndStart();
        break;
      case 'pause':
        if (S.state === C.STATE_EXPLORING)
          S.state = C.STATE_PAUSED;
        else if (S.state === C.STATE_PAUSED)
          S.state = C.STATE_EXPLORING;
        break;
      case 'high-scores':
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            S.highScores = [];
            saveHighScores();
            renderHighScores();
          }
        });
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
