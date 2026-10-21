/* Every tunable number in the game: canvas and world size, storage keys, ship and
   drill physics, cargo, station geometry, powerup timing and the state names. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants = NS.constants || {};

  /* ── Constants ── */
  C.CANVAS_W = 700;
  C.CANVAS_H = 500;
  C.MAX_DT = 0.05;
  C.WORLD_W = 3000;
  C.WORLD_H = 3000;

  /* Storage */
  C.STORAGE_PREFIX = 'sz-space-mining';
  C.STORAGE_HIGHSCORES = C.STORAGE_PREFIX + '-highscores';
  C.STORAGE_TUTORIAL = C.STORAGE_PREFIX + '-tutorial-seen';
  C.MAX_HIGH_SCORES = 5;

  /* Ship */
  C.BASE_THRUST = 200;
  C.DRAG = 0.97;
  C.ROTATION_SPEED = 4;
  C.SHIP_SIZE = 14;
  C.BASE_HULL = 100;

  /* Drill */
  C.BASE_DRILL_RATE = 1.0;
  C.DRILL_RANGE = 60;

  /* Cargo */
  C.BASE_CARGO_MAX = 10;

  C.ASTEROID_COUNT = 40;

  /* Station */
  C.STATION_X = C.WORLD_W / 2;
  C.STATION_Y = C.WORLD_H / 2;
  C.STATION_RADIUS = 40;
  C.STATION_DOCK_RANGE = 80;

  /* Powerups */
  C.POWERUP_SPAWN_INTERVAL = 15;
  C.POWERUP_LIFETIME = 20;
  C.POWERUP_RADIUS = 12;
  C.POWERUP_COLLECT_RANGE = 30;
  C.MAX_POWERUPS = 5;

  /* Background */
  C.BG_ASTEROID_COUNT = 20;

  /* States */
  C.STATE_READY = 'READY';
  C.STATE_PLAYING = 'PLAYING';
  C.STATE_PAUSED = 'PAUSED';
  C.STATE_GAME_OVER = 'GAME_OVER';
})();
