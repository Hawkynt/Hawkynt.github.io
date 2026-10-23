/* Every tunable number in the game: grid and tile size, cell types, storage keys,
   player and bomb physics, directions, power-up type names, enemy and power-up
   gating, the state names and the sprite-sheet geometry. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants = NS.constants || {};

  /* ── Constants ── */
  C.COLS = 15;
  C.ROWS = 13;
  C.TILE_SIZE = 40;
  C.MAX_DT = 0.05;

  /* Cell types */
  C.EMPTY = 0;
  C.WALL = 1;           // indestructible
  C.DESTRUCTIBLE = 2;   // breakable brick

  /* Storage */
  C.STORAGE_PREFIX = 'sz-bomberman';
  C.STORAGE_HIGHSCORES = C.STORAGE_PREFIX + '-highscores';
  C.STORAGE_TUTORIAL = C.STORAGE_PREFIX + '-tutorial-seen';
  C.MAX_HIGH_SCORES = 5;

  /* Player */
  C.PLAYER_SPEED_BASE = 4.0;
  C.MAX_LIVES = 3;

  /* Bombs */
  C.BOMB_TIME = 2.5;
  C.FIRE_DURATION = 0.6;
  C.NUM_ENEMIES = 3;

  /* Directions: cardinal (up, down, left, right) */
  C.DIRS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];

  /* Power-up types */
  C.POWERUP_BOMB_UP = 'bomb_up';
  C.POWERUP_FIRE_UP = 'fire_up';
  C.POWERUP_SPEED_UP = 'speed_up';
  C.POWERUP_KICK = 'kick';
  C.POWERUP_REMOTE = 'remote';
  C.POWERUP_POWER_KICK = 'power_kick';
  C.POWERUP_FLY = 'fly';
  C.POWERUP_GLOVE = 'glove';
  C.POWERUP_CLIMB = 'climb';

  /* Bomb sliding speed */
  C.BOMB_SLIDE_SPEED = 8;

  /* States */
  C.STATE_READY = 'READY';
  C.STATE_PLAYING = 'PLAYING';
  C.STATE_PAUSED = 'PAUSED';
  C.STATE_DEAD = 'DEAD';

  /* ── Sprites ── */
  const SP = 16; // sprite tile size on sheet
  C.SP = SP;

  // Terrain sprites (from bomb_party_v4 sheet)
  C.S_GRASS = { x: SP * 2, y: SP };        // row 1 col 2 — green grass tile
  C.S_WALL = { x: 0, y: 0 };              // row 0 col 0 — grey stone wall
  C.S_BOX = { x: 0, y: 13 * SP };         // row 13 col 0 — brown destructible block

  // Character frames: [direction] → { stand, walk: [frameA, frameB] }
  // 0=down 1=up 2=left 3=right
  // Each character row has 10 cols laid out as:
  //   col 0=stand top, col 1=stand bottom, cols 2-3=walk bottom,
  //   col 4=stand right, cols 5-7=walk right, cols 8-9=walk top
  // There are NO dedicated left-facing sprites; left is drawn by flipping right.
  // Direction 2 (left) reuses the right sprite coords; the draw call mirrors them.
  function _buildCharFrames(startRow) {
    const y = startRow * SP;
    return [
      // dir 0 = down: stand=col1, walk=[col2, col3]
      { stand: { x: 1 * SP, y }, walk: [{ x: 2 * SP, y }, { x: 3 * SP, y }] },
      // dir 1 = up: stand=col0, walk=[col8, col9]
      { stand: { x: 0 * SP, y }, walk: [{ x: 8 * SP, y }, { x: 9 * SP, y }] },
      // dir 2 = left: same sprites as right, drawn flipped horizontally
      { stand: { x: 4 * SP, y }, walk: [{ x: 5 * SP, y }, { x: 6 * SP, y }] },
      // dir 3 = right: stand=col4, walk=[col5, col6]
      { stand: { x: 4 * SP, y }, walk: [{ x: 5 * SP, y }, { x: 6 * SP, y }] }
    ];
  }

  // Character rows (14-17): green mob, blue mob, mage mob, player
  C.S_PLAYER = _buildCharFrames(17);             // row 17 — player (last character row)
  C.S_ENEMY_ROWS = {
    slow: _buildCharFrames(14),    // row 14 — green mob
    normal: _buildCharFrames(15),  // row 15 — blue mob
    fast: _buildCharFrames(16),    // row 16 — mage mob
    climber: _buildCharFrames(14),
    chaser: _buildCharFrames(16),
    tank: _buildCharFrames(15),
    ghost: _buildCharFrames(15)
  };

  // Bomb animation frames (row 18, cols 4–9: grey body + brown fuse)
  C.S_BOMB = [];
  for (let i = 0; i < 6; ++i)
    C.S_BOMB[i] = { x: (4 + i) * SP, y: 18 * SP };

  // Fire piece sprites (row 18, cols 0–3)
  C.S_FIRE_CENTER = { x: 2 * SP, y: 18 * SP };  // centre cross piece
  C.S_FIRE_H = { x: SP, y: 18 * SP };            // horizontal beam mid
  C.S_FIRE_END_L = { x: 0, y: 18 * SP };         // left end cap
  C.S_FIRE_END_R = { x: 3 * SP, y: 18 * SP };    // right end cap

  // Explosion sheet frame layout (BomberManEffect.png: 336×134)
  C.EXPL_FW = 48;
  C.EXPL_FH = 67;
  C.EXPL_COLS = 7;
})();
