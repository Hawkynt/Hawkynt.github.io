/* The menu bar: new game, pause, high scores, exit, controls, how-to-play and about,
   dispatched from the shared MenuBar's onAction callback. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const S = NS.state;
  const V = NS.view;

  /* ── Menu bar ── */
  const menuActions = {
    'new': () => NS.flow.resetGame(),
    'pause': NS.flow.togglePause,
    'high-scores': () => {
      NS.highscores.renderHighScores();
      SZ.Dialog.show('highScoresBackdrop');
    },
    'exit': () => { if (V.User32?.DestroyWindow) V.User32.DestroyWindow(); },
    'controls': () => SZ.Dialog.show('controlsBackdrop'),
    'tutorial': () => { S.showTutorial = true; S.tutorialPage = 0; },
    'about': () => SZ.Dialog.show('dlg-about')
  };

  new SZ.MenuBar({ onAction: (action) => menuActions[action]?.() });
})();
