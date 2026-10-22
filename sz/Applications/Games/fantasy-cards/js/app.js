/* Loaded last: dialog and menu wiring, the mute button, the canvas setup, the
   high scores, the window title and the requestAnimationFrame game loop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const S = NS.state;
  const D = NS.dom;

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: NS.menu.handleAction
  });

  SZ.GameAudio.attachMuteButton();
  D.setupCanvas();
  NS.storage.loadHighScores();
  NS.os.updateWindowTitle();

  S.lastTimestamp = 0;
  requestAnimationFrame(NS.scene.gameLoop);
})();
