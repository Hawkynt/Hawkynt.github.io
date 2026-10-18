/* app/menu.js -- menu-bar actions, resizing and desktop window messages.
   Reads: constants, env, layout, progress, savegame, researchScreen, relicsPanel, mapSelect, help, actions and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_RESEARCH } = NS.constants;
  const { User32 } = NS.env;
  const { setupCanvas } = NS.layout;
  const { saveHighScores, renderHighScores } = NS.progress;
  const { isInGameState, runIsOpen, requestNewGame } = NS.savegame;
  const { openResearchFromMap, openResearch, closeResearch } = NS.researchScreen;
  const { openRelics } = NS.relicsPanel;
  const { openMapSelect } = NS.mapSelect;
  const { openHelp } = NS.help;
  const { togglePause, quitToTitle, toggleAutoWave } = NS.actions;

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    // Run-changing actions first close a research tree opened from a map
    const treeOverRun = G.state === STATE_RESEARCH && runIsOpen();
    if (treeOverRun && (action === 'new' || action === 'pause' || action === 'auto-wave' || action === 'campaign'))
      closeResearch();
    switch (action) {
      case 'new':
        requestNewGame();
        break;
      case 'pause':
        if (!treeOverRun)
          togglePause();
        break;
      case 'auto-wave':
        toggleAutoWave();
        break;
      case 'campaign':
        if (isInGameState()) quitToTitle();
        openMapSelect();
        break;
      case 'research':
        if (G.state === STATE_RESEARCH)
          break;
        if (isInGameState()) openResearchFromMap();
        else openResearch();
        break;
      case 'howto':
        openHelp();
        break;
      case 'relics':
        openRelics();
        break;
      case 'high-scores':
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            G.highScores = [];
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

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleResize() {
    setupCanvas();
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }

  window.addEventListener('resize', handleResize);

  NS.menu = { handleAction };

})();
