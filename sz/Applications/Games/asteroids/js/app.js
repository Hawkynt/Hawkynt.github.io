/* The main loop with its fixed-step clock, the mode-select and new-game entry
   points, and the boot sequence that starts everything. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function gameLoop(timestamp) {
    S.animFrameId = requestAnimationFrame(gameLoop);

    if (!S.lastTime) S.lastTime = timestamp;
    let elapsed = timestamp - S.lastTime;
    S.lastTime = timestamp;

    /* Snap refresh jitter around 60 Hz to exactly one step; cap catch-up after stalls */
    if (Math.abs(elapsed - C.SIM_STEP) < C.SIM_SNAP)
      elapsed = C.SIM_STEP;
    S.simAccumulator = Math.min(S.simAccumulator + elapsed, C.SIM_STEP * C.SIM_MAX_STEPS);
    while (S.simAccumulator >= C.SIM_STEP) {
      S.simAccumulator -= C.SIM_STEP;
      if (S.gameActive && !S.gamePaused && !S.gameOverFlag && !S.modeSelectActive)
        NS.flow.update(C.SIM_STEP);
    }

    NS.scene.render();
  }

  function showModeSelect() {
    if (S.animFrameId) {
      cancelAnimationFrame(S.animFrameId);
      S.animFrameId = null;
    }
    S.gameActive = false;
    S.gamePaused = false;
    S.gameOverFlag = false;
    S.modeSelectActive = true;
    S.warpState = null;
    S.gameTime = 0;
    S.lastTime = null;
    S.animFrameId = requestAnimationFrame(gameLoop);
  }

  function newGame(mode) {
    if (S.animFrameId) {
      cancelAnimationFrame(S.animFrameId);
      S.animFrameId = null;
    }

    S.gameMode = mode || 'classic';
    const cfg = NS.rules.modeConfig();
    SZ.GameAudio.play('select');

    S.score = 0;
    S.lives = cfg.lives;
    S.level = 1;
    S.gameActive = true;
    S.gamePaused = false;
    S.gameOverFlag = false;
    S.modeSelectActive = false;
    S.invulnTimer = C.INVULN_DURATION;
    S.hyperspaceCooldown = 0;
    S.enemySpawnTimer = cfg.ufoInterval;
    S.shootCooldownTimer = 0;
    S.respawnTimer = 0;
    S.lastTime = null;
    S.simAccumulator = 0;
    S.gameTime = 0;
    S.warpState = null;

    S.bullets = [];
    S.enemies = [];
    S.enemyBullets = [];
    S.allies = [];
    S.allyBullets = [];
    S.zones = [];
    S.collectiblePowerups = [];
    S.powerupState = NS.powerups.initPowerupState();
    S.combo = { count: 0, timer: 0, displayScale: 0 };
    S.shockwaves = [];
    S.screenFlashAlpha = 0;
    S.empActive = false;
    S.empTimer = 0;
    S.fireDamageCooldown = 0;
    S.bossActive = false;
    S.allySpawnedForLevel = false;

    S.stats = {
      asteroidsDestroyed: 0,
      shotsFired: 0,
      shotsHit: 0,
      powerupsCollected: 0,
      maxCombo: 0
    };

    if (S.gameMode === 'zen')
      S.zenTimer = cfg.timeLimit;
    if (S.gameMode === 'survival')
      S.survivalSpawnTimer = cfg.spawnInterval;

    S.nextExtraLife = cfg.bonusLifeEvery || 0;

    D.particles.clear();
    D.floatingText.clear();

    S.ship = NS.entities.createShip();
    NS.flow.spawnLevelAsteroids();
    NS.status.updateDisplays();

    S.animFrameId = requestAnimationFrame(gameLoop);
  }

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    NS.os.setupField();
    NS.os.setupCanvasScaling();
    NS.highscores.loadHighScores();
    showModeSelect();
    NS.os.requestWindowResize();
    SZ.GameAudio.attachMuteButton();
  }

  Object.assign(NS.app, { gameLoop, showModeSelect, newGame, init });

  init();
})();
