/* app/main.js -- start-up: dialogs, menu bar, first layout, loading scores, progress and the saved game, and the first frame.
   Reads: env, layout, progress, savegame, loop, actions, menu and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { audio, updateWindowTitle } = NS.env;
  const { setupCanvas } = NS.layout;
  const { loadHighScores, loadMeta } = NS.progress;
  const { refreshSavedGameInfo } = NS.savegame;
  const { gameLoop } = NS.loop;
  const { loadMapPreview } = NS.actions;
  const { handleAction } = NS.menu;

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  loadHighScores();
  loadMeta();
  refreshSavedGameInfo();
  if (G.savedGameInfo)
    G.currentMap = G.savedGameInfo.map;
  loadMapPreview();
  updateWindowTitle();
  audio.attachMuteButton();

  G.lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
