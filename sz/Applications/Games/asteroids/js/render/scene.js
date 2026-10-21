/* One frame: background and stars, then entities, ship, effects and HUD in
   draw order, the screen flash and the pause / game-over overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;
  const D = NS.dom;
  const ctx = D.ctx;

  function render() {
    ctx.save();
    ctx.clearRect(0, 0, S.W, S.H);

    if (S.modeSelectActive) {
      ctx.drawImage(S.bgCanvas, 0, 0);
      NS.starfield.drawStars();
      NS.screens.drawModeSelect();
      ctx.restore();
      return;
    }

    D.shake.apply(ctx);

    /* Background */
    ctx.drawImage(S.bgCanvas, 0, 0);
    NS.starfield.drawStars();

    /* Entities (not during warp) */
    if (!S.warpState) {
      NS.zoneView.drawZones();
      for (const a of S.asteroids) NS.asteroidView.drawAsteroid(a);
      NS.effectView.drawElectricArcs();
      for (const p of S.collectiblePowerups) NS.powerupView.drawCollectiblePowerup(p);
      for (const e of S.enemies) NS.enemyView.drawEnemy(e);
      for (const a of S.allies) NS.enemyView.drawAlly(a);
      for (const b of S.bullets) NS.bulletView.drawBullet(b);
      for (const b of S.enemyBullets) NS.bulletView.drawUFOBullet(b);
      for (const b of S.allyBullets) NS.bulletView.drawAllyBullet(b);
    }

    /* Ship (always visible) */
    NS.shipView.drawShip();

    /* Effects */
    D.particles.draw(ctx);
    D.floatingText.draw(ctx);
    NS.effectView.drawShockwaves();

    /* HUD (not during warp) */
    if (!S.warpState) {
      NS.hud.drawComboHUD();
      NS.hud.drawPowerupHUD();
    }

    /* Warp text */
    NS.hud.drawWarpText();

    /* Screen flash */
    if (S.screenFlashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${S.screenFlashAlpha})`;
      ctx.fillRect(-10, -10, S.W + 20, S.H + 20);
    }

    /* Overlays */
    if (S.gamePaused) NS.screens.drawPauseOverlay();
    else if (S.gameOverFlag) NS.screens.drawGameOver();

    ctx.restore();
  }

  Object.assign(NS.scene, { render });
})();
