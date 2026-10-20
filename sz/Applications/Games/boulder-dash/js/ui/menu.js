/* The menu bar: the action table behind the Game and Help menus, the MenuBar
   construction and the dialog wiring. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.state;
  const { resetGame } = NS.game;
  const { User32 } = window.SZ?.Dlls ?? {};

  /* ── Menu bar ── */
  const menuActions = {
    'new': () => resetGame(),
    'pause': () => {
      if (S.state === C.STATE_PLAYING) S.state = C.STATE_PAUSED;
      else if (S.state === C.STATE_PAUSED) S.state = C.STATE_PLAYING;
    },
    'high-scores': () => {
      NS.highscores.renderHighScores();
      SZ.Dialog.show('highScoresBackdrop');
    },
    'exit': () => { if (User32?.DestroyWindow) User32.DestroyWindow(); },
    'controls': () => SZ.Dialog.show('controlsBackdrop'),
    'tutorial': () => { S.showTutorial = true; S.tutorialPage = 0; },
    'about': () => SZ.Dialog.show('dlg-about')
  };

  new SZ.MenuBar({ onAction: (action) => menuActions[action]?.() });

  /* ── Dialog wiring ── */
  SZ.Dialog.wireAll();
})();
