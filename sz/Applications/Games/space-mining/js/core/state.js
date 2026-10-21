/* The one shared mutable state object every module reads and writes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const S = NS.state = NS.state || {};

  /* ── Game State ── */
  S.state = C.STATE_READY;
  S.credits = 0;
  S.totalOreMined = 0;
  S.highScores = [];
  S.gameTime = 0;

  /* Ship */
  S.ship = { x: C.STATION_X, y: C.STATION_Y - 100, vx: 0, vy: 0, angle: 0 };
  S.thrustPower = C.BASE_THRUST;
  S.drillSpeed = C.BASE_DRILL_RATE;
  S.cargoMax = C.BASE_CARGO_MAX;
  S.scannerLevel = 0;
  S.hullMax = C.BASE_HULL;
  S.hull = C.BASE_HULL;

  /* Upgrade levels */
  S.upgradeLevels = { drillSpeed: 0, cargoCapacity: 0, enginePower: 0, hullStrength: 0, scannerRange: 0 };

  /* Cargo contents: { iron: 0, gold: 0, platinum: 0, crystal: 0 } */
  S.cargo = {};

  /* Drilling state */
  S.isDrilling = false;
  S.drillTarget = null;
  S.drillTimer = 0;

  /* Market prices (fluctuate) */
  S.marketPrices = {};

  /* Asteroids */
  S.asteroids = [];

  /* Stars -- three parallax layers */
  S.starLayers = [[], [], []];

  /* Nebula patches */
  S.nebulae = [];

  /* Background asteroids (decorative, far layer) */
  S.bgAsteroids = [];

  /* Shooting stars */
  S.shootingStars = [];
  S.shootingStarTimer = 0;

  /* Powerups */
  S.powerups = [];
  S.powerupSpawnTimer = 0;
  S.activePowerups = {};

  /* Shop state */
  S.shopOpen = false;
  S.shopSelection = 0;

  /* Tutorial */
  S.tutorialSeen = false;
  S.showTutorial = false;
  S.tutorialPage = 0;

  /* Contextual hints */
  S.hintTimer = 0;
  S.currentHint = '';
  S.hintAlpha = 0;
  S.lastHintId = '';
  S.hintsShown = {};

  /* Camera */
  S.camera = { x: 0, y: 0 };

  /* Input */
  S.keys = {};

  /* Mouse input */
  S.mouseDown = false;
  S.mouseWorldX = 0;
  S.mouseWorldY = 0;
  S.mouseCanvasX = 0;
  S.mouseCanvasY = 0;
  S.mouseActive = false;       /* true while pointer is held on the game canvas */
  S.mouseDrilling = false;     /* true when mouse-hold targets an asteroid in drill range */

  /* Animation */
  S.animFrameId = null;
  S.lastTimestamp = 0;
  S.dpr = 1;
  S.thrusterTimer = 0;
})();
