/* The menu bar: new game, pause/resume, the high-scores dialog and the exit
   request to the hosting frame, plus the shared dialog wiring. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const { pauseMusic, resumeMusic } = NS.audio;

  function handleAction(action) {
    switch (action) {
      case 'new':
        NS.song.initGame();
        break;
      case 'pause':
        if (S.state === C.STATE_PLAYING) {
          S.state = C.STATE_PAUSED;
          pauseMusic();
        } else if (S.state === C.STATE_PAUSED) {
          S.state = C.STATE_PLAYING;
          resumeMusic();
        }
        NS.os.updateWindowTitle();
        break;
      case 'high-scores':
        NS.highscores.showHighScores();
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  SZ.Dialog.wireAll();

  new SZ.MenuBar({
    onAction: handleAction
  });

  Object.assign(NS.menu, { handleAction });
})();
