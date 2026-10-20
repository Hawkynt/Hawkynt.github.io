/* Canvas size, physics tuning, scoring, the game-state names, storage keys, the
   life/high-score limits and the tutorial pages. Pure data, owns no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants || (NS.constants = {});

  C.CANVAS_W = 512;
  C.CANVAS_H = 448;
  C.MAX_DT = 0.05;
  C.GRAVITY = 600;
  C.JUMP_FORCE = -320;
  C.PLAYER_SPEED = 150;
  C.BUBBLE_SPEED = 200;
  C.BUBBLE_FLOAT_SPEED = -30;
  C.BUBBLE_LIFESPAN = 8;
  C.TRAP_ESCAPE_TIME = 6;
  C.WALL_THICKNESS = 16;
  C.POP_SCORE = 100;
  C.FRUIT_SCORE = 200;

  /* States */
  C.STATE_READY = 'READY';
  C.STATE_PLAYING = 'PLAYING';
  C.STATE_PAUSED = 'PAUSED';
  C.STATE_DEAD = 'DEAD';

  /* Storage */
  C.STORAGE_PREFIX = 'sz-bubble-bobble';
  C.STORAGE_HIGHSCORES = C.STORAGE_PREFIX + '-highscores';
  C.STORAGE_TUTORIAL = C.STORAGE_PREFIX + '-tutorial-seen';
  C.MAX_HIGH_SCORES = 5;
  C.MAX_LIVES = 3;

  /* Tutorial */
  C.TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Shoot bubbles to trap enemies, then pop', 'the bubbles to defeat them!', '', 'Left/Right or A/D = Move', 'Up or W = Jump', 'Space / Z / X = Shoot bubble'] },
    { title: 'Tips', lines: ['Pop multiple enemies at once for bonus points.', 'Collect fruit items for big score bonuses.', 'Bubbles float up -- use them as platforms!', '', 'Watch for power-ups that enhance your bubbles.', 'Press H anytime to see this help again.'] }
  ];
})();
