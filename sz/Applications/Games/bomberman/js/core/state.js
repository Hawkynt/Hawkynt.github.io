/* Every mutable game value in one place: round state, score and lives, the grid,
   the player and its power-up flags, bombs, fire, enemies, power-ups, the input
   map, the render bookkeeping and the tutorial progress. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const S = NS.state = NS.state || {};

  /* ── Game State ── */
  S.state = C.STATE_READY;
  S.score = 0;
  S.lives = C.MAX_LIVES;
  S.currentLevel = 1;
  S.highScores = [];

  /* Grid */
  S.grid = [];

  /* Player */
  S.player = { col: 1, row: 1, x: 0, y: 0, moveProgress: 0, moveDir: null, targetCol: 0, targetRow: 0, facing: 0, walkFrame: 0, walkTimer: 0 };
  S.playerSpeed = C.PLAYER_SPEED_BASE;
  S.maxBombs = 1;
  S.blastRange = 2;
  S.hasKick = false;
  S.hasRemote = false;
  S.hasPowerKick = false;
  S.hasFly = false;
  S.hasGlove = false;
  S.hasClimb = false;

  /* Bombs */
  S.bombs = [];
  S.fireCells = [];

  /* Enemies */
  S.enemies = [];

  /* Power-ups on the grid */
  S.powerUps = [];

  /* Hidden power-ups under destructible walls */
  S.hiddenPowerUps = {};

  /* Input */
  S.keys = {};

  /* Rendering */
  S.animFrameId = null;
  S.lastTimestamp = 0;
  S.dpr = 1;

  /* Per-level grass detail seed */
  S.grassSeed = [];

  /* Sprites */
  S.spritesReady = 0;

  /* ── Tutorial ── */
  S.tutorialSeen = false;
  S.showTutorial = false;
  S.tutorialPage = 0;
})();
