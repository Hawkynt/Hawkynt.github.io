/* The desktop menu bar: dialog wiring and the action dispatch for new game,
   pause, high scores, tutorial, controls, about and exit. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const S = NS.state;

  /* ── Menu Actions ── */
  function handleAction(action) {
    switch (action) {
      case 'new':
        NS.flow.resetGame();
        break;
      case 'pause':
        if (S.state === C.STATE_PLAYING)
          S.state = C.STATE_PAUSED;
        else if (S.state === C.STATE_PAUSED)
          S.state = C.STATE_PLAYING;
        break;
      case 'high-scores':
        NS.highscores.renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            S.highScores = [];
            NS.highscores.saveHighScores();
            NS.highscores.renderHighScores();
          }
        });
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'tutorial':
        S.showTutorial = true;
        S.tutorialPage = 0;
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

  /* ── Dialog wiring ── */
  SZ.Dialog.wireAll();

  /* ── MenuBar ── */
  const menu = new SZ.MenuBar({
    onAction: handleAction
  });
})();
