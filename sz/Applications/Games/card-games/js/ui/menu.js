/* Menu-bar actions: new game, pause, back to menu, high scores, exit. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const S = NS.state;
  const OS = NS.os;
  const G = NS.game;
  const ST = NS.status;
  const ME = NS.menu = NS.menu || {};

  /* ══════════════════════════════════════════════════════════════════
     MENU BAR ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  ME.handleAction = function(action) {
    switch (action) {
      case 'new':
        if (S.currentVariant)
          G.selectGame(S.currentVariant.id);
        else
          G.initGame();
        break;
      case 'pause':
        if (S.state === K.STATE_PLAYING)
          S.state = K.STATE_PAUSED;
        else if (S.state === K.STATE_PAUSED)
          S.state = K.STATE_PLAYING;
        OS.updateWindowTitle();
        break;
      case 'back-to-menu':
        G.initGame();
        break;
      case 'high-scores':
        ST.showHighScores();
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  };
})();
