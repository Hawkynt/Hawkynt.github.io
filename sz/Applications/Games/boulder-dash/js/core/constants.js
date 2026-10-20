/* Grid geometry, cell types, states, storage keys, gameplay tuning, the direction
   map, the animation speeds, the tile colors and the tutorial pages. Pure data, owns no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants || (NS.constants = {});

  /* ── Constants ── */
  C.COLS = 40;
  C.ROWS = 22;
  C.TILE_SIZE = 24;
  C.HALF_TILE = C.TILE_SIZE / 2;
  C.MAX_DT = 0.05;

  /* Cell types */
  C.EMPTY = 0;
  C.WALL = 1;
  C.DIRT = 2;
  C.BOULDER = 3;
  C.GEM = 4;
  C.EXIT = 5;

  /* States */
  C.STATE_READY = 'READY';
  C.STATE_PLAYING = 'PLAYING';
  C.STATE_PAUSED = 'PAUSED';
  C.STATE_DEAD = 'DEAD';

  /* Storage */
  C.STORAGE_PREFIX = 'sz-boulder-dash';
  C.STORAGE_HIGHSCORES = C.STORAGE_PREFIX + '-highscores';
  C.STORAGE_TUTORIAL = C.STORAGE_PREFIX + '-tutorial-seen';
  C.MAX_HIGH_SCORES = 5;

  /* Gameplay */
  C.MAX_LIVES = 3;
  C.MOVE_SPEED = 8;
  C.GEM_SCORE = 100;
  C.ENEMY_KILL_SCORE = 500;
  C.TIME_BONUS_FACTOR = 5;

  /* Directions */
  C.DIRS = {
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
    w: { dx: 0, dy: -1 },
    s: { dx: 0, dy: 1 },
    a: { dx: -1, dy: 0 },
    d: { dx: 1, dy: 0 }
  };

  /* Boulder physics animation speeds */
  C.FALL_ANIM_SPEED = 10;
  C.SLIDE_ANIM_SPEED = 8;
  C.FADE_SPEED = 4;

  /* Level generator */
  C.MAX_LEVEL_REPAIRS = 400;

  /* ── Tutorial ── */
  C.TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Dig through caves and collect gems.', 'Reach the gem quota to unlock the exit.', '', 'Arrow Keys / WASD = Move & dig', 'Avoid falling boulders and enemies!'] },
    { title: 'Tips', lines: ['Boulders fall when unsupported -- use this', 'to crush enemies or clear paths.', '', 'Watch the timer! Collect gems quickly.', 'Press H anytime to see this help again.'] }
  ];

  /* ── Rendering ── */
  C.COLORS = {
    [C.EMPTY]: '#111',
    [C.WALL]: '#555',
    [C.DIRT]: '#8B4513',
    [C.BOULDER]: '#888',
    [C.GEM]: '#00e5ff',
    [C.EXIT]: '#ffd700'
  };
})();
