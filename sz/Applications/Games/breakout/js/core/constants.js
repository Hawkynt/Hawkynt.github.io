/* Field presets, paddle/ball/brick/power-up geometry, game states and the fixed
   simulation step. Pure data, owns no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants || (NS.constants = {});

  /* ---- Field Size Presets ---- */
  C.FIELD_SMALL = { w: 480, h: 560, cols: 10, label: 'small' };
  C.FIELD_LARGE = { w: 1200, h: 840, cols: 25, label: 'large' };

  C.STORAGE_KEY = 'sz-breakout-high-scores';
  C.MAX_HIGH_SCORES = 5;

  /* Paddle */
  C.PADDLE_Y_OFFSET = 30;
  C.PADDLE_HEIGHT = 14;
  C.PADDLE_WIDTH_DEFAULT = 80;
  C.PADDLE_WIDTH_WIDE = 120;
  C.PADDLE_SPEED = 7;
  C.EMITTER_RADIUS = 7;

  /* Ball */
  C.BALL_RADIUS = 6;
  C.BALL_SPEED_INITIAL = 4.5;
  C.BALL_SPEED_INCREMENT = 0.3;
  C.BALL_SPEED_MAX = 9;

  /* Bricks */
  C.BRICK_WIDTH = 44;
  C.BRICK_HEIGHT = 16;
  C.BRICK_PADDING = 3;
  C.BRICK_OFFSET_TOP = 50;
  C.BRICK_COLORS = ['#e03030', '#e08020', '#e0c020', '#30b030', '#3070e0'];
  C.BRICK_SCORES = [50, 40, 30, 20, 10];

  /* Power-ups */
  C.POWERUP_CHANCE = 0.22;
  C.POWERUP_SPEED = 2;
  C.POWERUP_SIZE = 22;
  C.POWERUP_DURATION = 10000;
  C.POWERUP_TYPES = [
    { type: 'W', label: 'WIDE', color: '#4f4' },
    { type: 'M', label: 'MULTI', color: '#f4f' },
    { type: 'S', label: 'SLOW', color: '#4ff' },
    { type: 'F', label: 'FIRE', color: '#f80' },
    { type: 'L', label: 'LASER', color: '#f44' },
    { type: 'B', label: 'BARRIER', color: '#88f' }
  ];

  /* Game states */
  C.STATE_IDLE = 'IDLE';
  C.STATE_PLAYING = 'PLAYING';
  C.STATE_PAUSED = 'PAUSED';
  C.STATE_GAME_OVER = 'GAME_OVER';
  C.STATE_LEVEL_TRANSITION = 'LEVEL_TRANSITION';

  /* Simulation runs in fixed 60 Hz steps regardless of display refresh rate */
  C.SIM_STEP = 1000 / 60;
  C.SIM_MAX_STEPS = 3;
  C.SIM_SNAP = 0.5;
})();
