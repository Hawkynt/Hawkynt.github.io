/* The game flow: the per-frame update order, the new-game reset and the
   auto-pause when the window is hidden or loses focus. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const F = NS.flow;

  /* ── Update ── */
  F.updateGame = function updateGame(dt) {
    if (S.state !== C.STATE_PLAYING) return;
    if (S.showTutorial) return;

    S.gameTime += dt;

    if (!S.shopOpen) {
      NS.ship.updateShip(dt);
      NS.mining.updateDrilling(dt);
    }
    NS.mining.updateAsteroidRotations(dt);
    NS.mining.checkAsteroidRespawn();
    NS.powerups.updatePowerups(dt);
    NS.world.updateBgAsteroids(dt);
    NS.world.updateShootingStars(dt);
    NS.world.updateNebulae(dt);
    NS.hints.updateHints(dt);
    NS.world.updateCamera();
    NS.app.updateStatusBar();
    NS.app.updateWindowTitle();
  };

  /* ── Reset ── */
  F.resetGame = function resetGame() {
    S.credits = 0;
    S.totalOreMined = 0;
    S.gameTime = 0;
    S.ship = { x: C.STATION_X, y: C.STATION_Y - 100, vx: 0, vy: 0, angle: -Math.PI / 2 };
    S.upgradeLevels = { drillSpeed: 0, cargoCapacity: 0, enginePower: 0, hullStrength: 0, scannerRange: 0 };
    NS.economy.applyUpgrades();
    S.hull = S.hullMax;
    NS.economy.resetCargo();
    S.isDrilling = false;
    S.drillTarget = null;
    S.drillTimer = 0;
    S.shopOpen = false;
    S.shopSelection = 0;
    S.powerups = [];
    S.powerupSpawnTimer = 0;
    S.activePowerups = {};
    S.hintsShown = {};
    S.mouseDown = false;
    S.mouseActive = false;
    S.mouseDrilling = false;
    NS.economy.randomizePrices();
    NS.mining.spawnAsteroids();
    NS.world.initStars();
    NS.world.initNebulae();
    NS.world.initBgAsteroids();
    S.shootingStars = [];
    S.shootingStarTimer = 0;
    D.particles.clear();
    D.floatingText.clear();
    S.state = C.STATE_PLAYING;
    NS.app.updateWindowTitle();
    SZ.GameAudio.play('select');

    if (!S.tutorialSeen) {
      S.showTutorial = true;
      S.tutorialPage = 0;
      S.tutorialSeen = true;
      NS.highscores.saveTutorialSeen();
    }
  };

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.state === C.STATE_PLAYING,
    pause: () => {
      S.state = C.STATE_PAUSED;
    }
  });
})();
