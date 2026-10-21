/* The menu bar, its action dispatch, difficulty switching and window resize requests. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const S = NS.state;
  const ME = NS.menu;
  const DL = NS.dialogs;
  const MK = NS.marks;
  const G = NS.game;

  /* ---- Menu System ---- */
  new SZ.MenuBar({ onAction: handleMenuAction });

  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        G.newGame();
        break;
      case 'beginner':
      case 'intermediate':
      case 'expert':
        S.customConfig = null;
        ME.setDifficulty(action);
        break;
      case 'custom':
        DL.showCustomDialog();
        break;
      case 'marks':
        MK.toggleMarks();
        break;
      case 'best-times':
        DL.showBestTimes();
        break;
      case 'statistics':
        DL.showStatsDialog();
        break;
      case 'exit':
        SZ.Dlls.User32.DestroyWindow();
        break;
      case 'about':
        DL.showAboutDialog();
        break;
    }
  }
  ME.handleMenuAction = handleMenuAction;

  ME.setDifficulty = function setDifficulty(level) {
    S.difficulty = level;
    ME.updateDifficultyChecks();
    G.newGame();
    ME.requestWindowResize();
  };

  ME.requestWindowResize = function requestWindowResize() {
    requestAnimationFrame(() => {
      const w = document.documentElement.scrollWidth;
      const h = document.documentElement.scrollHeight;
      SZ.Dlls.User32.MoveWindow(w, h);
    });
  };

  ME.updateDifficultyChecks = function updateDifficultyChecks() {
    const levels = ['beginner', 'intermediate', 'expert', 'custom'];
    levels.forEach(level => {
      const el = document.querySelector('.menu-entry[data-action="' + level + '"]');
      if (!el)
        return;
      if (level === 'custom')
        el.classList.toggle('checked', S.customConfig !== null);
      else
        el.classList.toggle('checked', S.difficulty === level && S.customConfig === null);
    });
  };
})();
