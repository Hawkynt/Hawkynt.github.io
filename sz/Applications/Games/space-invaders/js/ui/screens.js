/* Screen flow: switching screens, restart, quit and help.
   Writes G.gameState, G.menuCursor, G.fade, G.helpPage, G.helpFrom. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { isMenuState } = NS.data;
  const { updateStatusBar } = NS.statusBar;
  const { newGame } = NS.waves;
  const { startStage } = NS.stages;

  function setScreen(name) {
    G.gameState = name;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    G.fade = 1;
    updateStatusBar();
  }

  function restartRun() {
    if (G.gameMode === 'campaign')
      startStage(G.stageIndex);
    else
      newGame(G.gameMode);
  }

  function quitToMenu() {
    setScreen(G.gameMode === 'campaign' ? 'campaignMap' : 'title');
  }

  function openHelp() {
    G.helpFrom = isMenuState(G.gameState) ? G.gameState : 'title';
    G.helpPage = 0;
    setScreen('help');
  }

  Object.assign(NS.screens, {
    restartRun, quitToMenu, setScreen, openHelp
  });
})();
