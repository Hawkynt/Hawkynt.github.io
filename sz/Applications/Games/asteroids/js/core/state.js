/* The one shared state object: field geometry, entity lists, score and lives,
   mode flags, timers, input state and the high-score table. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  NS.state = NS.state || {
    /* field geometry, set by setupField */
    W: undefined, H: undefined, uiS: undefined,
    fieldSizeKey: 'small',
    bgCanvas: undefined,
    stars: [],
    resizeCanvasFn: null,

    /* transient effect state */
    shockwaves: [],
    screenFlashAlpha: 0,

    /* entities */
    ship: undefined,
    asteroids: undefined,
    bullets: undefined,
    enemies: undefined,
    enemyBullets: undefined,
    enemySpawnTimer: undefined,
    allies: undefined,
    allyBullets: undefined,
    zones: undefined,
    collectiblePowerups: undefined,
    powerupState: undefined,
    combo: undefined,
    stats: undefined,
    warpState: undefined,

    /* score, lives, level and mode */
    score: undefined,
    lives: undefined,
    level: undefined,
    gameActive: undefined,
    gamePaused: undefined,
    gameOverFlag: undefined,
    gameMode: undefined,
    modeSelectActive: undefined,

    /* timers */
    invulnTimer: undefined,
    hyperspaceCooldown: undefined,
    animFrameId: undefined,
    lastTime: undefined,
    simAccumulator: 0,
    respawnTimer: 0,
    zenTimer: undefined,
    survivalSpawnTimer: undefined,
    nextExtraLife: undefined,
    gameTime: undefined,
    shootCooldownTimer: undefined,
    empActive: undefined,
    empTimer: undefined,
    fireDamageCooldown: undefined,
    bossActive: undefined,
    allySpawnedForLevel: undefined,

    /* input */
    keys: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseRightDown: false,
    mouseActive: false,

    /* high scores */
    highScores: []
  };
})();
