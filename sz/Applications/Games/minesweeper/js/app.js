/* Loaded last: the start-up sequence -- icons, saved scores, menu checks,
   the first game and the mute button. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const ST = NS.store;
  const ME = NS.menu;
  const MK = NS.marks;
  const IC = NS.icons;
  const G = NS.game;
  const A = NS.app;

  /* ---- Init ---- */
  A.init = function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    IC.injectIcons();
    ST.loadBestTimes();
    ST.loadStats();
    ME.updateDifficultyChecks();
    MK.updateMarksCheck();
    G.newGame();
    ME.requestWindowResize();

    const muteBtn = SZ.GameAudio.attachMuteButton(document.getElementById('menuBar'));
    muteBtn.style.position = 'static';
    muteBtn.style.margin = '0 2px 0 auto';
    muteBtn.style.width = muteBtn.style.height = '18px';
    muteBtn.style.font = '11px/16px sans-serif';
  };

  A.init();
})();
