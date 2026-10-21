/* C, the frozen game constants: canvas size, storage keys, lanes, player, speed and
   speed tiers, obstacles, coins, power-ups, scrolling, state names and tutorial pages. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  const C = NS.constants || (NS.constants = {});

  /* ── Constants ── */
  C.CANVAS_W = 400;
  C.CANVAS_H = 600;
  C.MAX_DT = 0.05;

  /* Storage */
  C.STORAGE_PREFIX = 'sz-endless-runner';
  C.STORAGE_HIGHSCORES = C.STORAGE_PREFIX + '-highscores';
  C.STORAGE_COINS = C.STORAGE_PREFIX + '-coins';
  C.STORAGE_TUTORIAL = C.STORAGE_PREFIX + '-tutorial-seen';
  C.MAX_HIGH_SCORES = 5;

  /* Lanes */
  C.NUM_LANES = 3;
  C.LANE_WIDTH = 80;
  C.LANE_Y_BOTTOM = C.CANVAS_H - 80;
  C.LANE_SWITCH_DURATION = 0.15;

  /* Player */
  C.PLAYER_W = 30;
  C.PLAYER_H = 50;
  C.JUMP_DURATION = 0.7;
  C.SLIDE_DURATION = 0.5;
  C.JUMP_HEIGHT = 130;

  /* Speed */
  C.BASE_SPEED = 8;
  C.SPEED_ACCELERATION = 0.08;
  C.MAX_SPEED = 24;

  /* Speed tiers — visual themes change at these thresholds */
  C.SPEED_TIERS = [
    { name: 'day',    minSpeed: 0,  skyTop: '#87ceeb', skyBot: '#e0f0ff', ground: '#8fbc8f', road: '#666' },
    { name: 'sunset', minSpeed: 12, skyTop: '#ff6b35', skyBot: '#ffd700', ground: '#9b7653', road: '#555' },
    { name: 'night',  minSpeed: 16, skyTop: '#191970', skyBot: '#2f2f4f', ground: '#2d4a2d', road: '#333' },
    { name: 'neon',   minSpeed: 20, skyTop: '#0a0a2e', skyBot: '#1a0a3e', ground: '#0d1a0d', road: '#111' }
  ];

  /* Obstacles */
  C.OBSTACLE_TYPES = ['barrier-low', 'barrier-high', 'full-block'];
  C.OBSTACLE_MIN_GAP = 18;
  C.OBSTACLE_SPAWN_RANGE = 12;

  /* Coins */
  C.COIN_VALUE = 10;
  C.COIN_RADIUS = 8;
  C.COIN_SPAWN_CHANCE = 0.4;

  /* Power-ups */
  C.POWERUP_TYPES = ['magnet', 'shield', 'multiplier'];
  C.POWERUP_SPAWN_CHANCE = 0.08;
  C.MAGNET_DURATION = 8;
  C.SHIELD_DURATION = 15;
  C.MULTIPLIER_DURATION = 10;
  C.MAGNET_RANGE = 120;

  /* Scrolling */
  C.SPAWN_Y = -60;
  C.SCROLL_FACTOR = 10;

  /* States */
  C.STATE_READY = 'READY';
  C.STATE_RUNNING = 'RUNNING';
  C.STATE_PAUSED = 'PAUSED';
  C.STATE_DEAD = 'DEAD';

  /* ── Tutorial ── */
  C.TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Run as far as you can!', 'Dodge obstacles by switching lanes,', 'jumping, and sliding.', '', 'Left/Right or A/D = Switch lanes', 'Up / W / Space = Jump  |  Down / S = Slide'] },
    { title: 'Tips', lines: ['Collect coins for your total score.', 'Grab power-ups: magnet, shield, multiplier.', 'Speed increases over time -- stay alert!', '', 'The visual theme shifts as you progress.', 'Press H anytime to see this help again.'] }
  ];
})();
