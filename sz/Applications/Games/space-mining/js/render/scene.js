/* One frame of the world: background, entities, HUD and the state-dependent
   overlay, drawn back to back in the original order. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const SC = NS.scene;

  /* ── Draw ── */
  SC.drawGame = function drawGame() {
    D.ctx.fillStyle = '#06060f';
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    NS.background.drawNebulae();
    NS.background.drawStars();
    NS.background.drawShootingStars();
    NS.background.drawBgAsteroids();
    NS.entities.drawAsteroids();
    NS.entities.drawPowerups();
    NS.entities.drawStation();
    NS.entities.drawShip();
    NS.entities.drawDrillBeam();
    NS.entities.drawScannerOverlay();
    NS.entities.drawMinimap();
    NS.hud.drawHUD();
    NS.hud.drawActivePowerupIndicators();
    NS.hud.drawHintOverlay();

    if (S.shopOpen && S.state === C.STATE_PLAYING)
      NS.overlays.drawShopPanel();

    if (S.showTutorial)
      NS.overlays.drawTutorialOverlay();
    else if (S.state === C.STATE_READY)
      NS.overlays.drawTitleScreen();
    else if (S.state === C.STATE_PAUSED)
      NS.overlays.drawPauseOverlay();
    else if (S.state === C.STATE_GAME_OVER)
      NS.overlays.drawGameOverScreen();
  };
})();
