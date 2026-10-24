/* Every tunable number in the game: maze geometry, tile and direction codes, ghost modes,
   colors and scatter corners, mode timings, chain and powerup timing, world themes, boss numbers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants = NS.constants || {};

  const COLS = 28;
  const ROWS = 31;
  const TILE = 16;
  const CANVAS_W = COLS * TILE;   // 448
  const CANVAS_H = ROWS * TILE;   // 496

  const STORAGE_KEY = 'sz-pacman-high-scores';
  const MAX_HIGH_SCORES = 5;

  /* Tile types */
  const T_WALL  = 0;
  const T_DOT   = 1;
  const T_POWER = 2;
  const T_EMPTY = 3;
  const T_GHOST_HOUSE = 4;
  const T_GATE  = 5;

  /* Directions */
  const DIR_LEFT  = 0;
  const DIR_UP    = 1;
  const DIR_RIGHT = 2;
  const DIR_DOWN  = 3;
  const DIR_NONE  = -1;

  const DX = [-1, 0, 1, 0];
  const DY = [0, -1, 0, 1];

  /* Ghost modes */
  const MODE_SCATTER    = 0;
  const MODE_CHASE      = 1;
  const MODE_FRIGHTENED = 2;
  const MODE_EATEN      = 3;

  /* Ghost colors */
  const GHOST_COLORS = ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'];
  const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

  /* Scatter corners (tile coords) */
  const SCATTER_TARGETS = [
    { x: 25, y: -3 },  // Blinky: top-right
    { x: 2,  y: -3 },  // Pinky: top-left
    { x: 27, y: 34 },  // Inky: bottom-right
    { x: 0,  y: 34 }   // Clyde: bottom-left
  ];

  /* Ghost house entry/exit */
  const GHOST_HOUSE_DOOR = { x: 13, y: 11 };
  const GHOST_HOUSE_EXIT = { x: 13, y: 14 };
  const GHOST_START_POS = [
    { x: 13, y: 11 },  // Blinky starts outside
    { x: 13, y: 14 },  // Pinky in house center
    { x: 11, y: 14 },  // Inky in house left
    { x: 15, y: 14 }   // Clyde in house right
  ];

  /* Pac-Man start */
  const PACMAN_START = { x: 13, y: 23 };

  /* Mode alternation timings (seconds): [scatter, chase, scatter, chase, ...] */
  const MODE_TIMINGS = [7, 20, 7, 20, 5, 20, 5, Infinity];

  /* Frightened flash warning time */
  const FRIGHTENED_FLASH_TIME = 2000;

  /* Ghost eating sequence points */
  const GHOST_EAT_POINTS = [200, 400, 800, 1600];

  /* --- World Themes --- */
  const WORLD_THEMES = [
    { wall: '#2121DE', wallGlow: '#4444FF', bg: '#000000', dotColor: '#FFB8AE' },
    { wall: '#DE2121', wallGlow: '#FF4444', bg: '#0A0000', dotColor: '#FFDDAA' },
    { wall: '#21DE21', wallGlow: '#44FF44', bg: '#000A00', dotColor: '#FFFFAA' },
    { wall: '#DE21DE', wallGlow: '#FF44FF', bg: '#0A000A', dotColor: '#FFB8FF' },
    { wall: '#DEDE21', wallGlow: '#FFFF44', bg: '#0A0A00', dotColor: '#FFFFFF' },
    { wall: '#21DEDE', wallGlow: '#44FFFF', bg: '#000A0A', dotColor: '#FFE0B8' },
    { wall: '#FF6600', wallGlow: '#FF8844', bg: '#0A0500', dotColor: '#FFD700' },
    { wall: '#8844FF', wallGlow: '#AA66FF', bg: '#050008', dotColor: '#EEDDFF' }
  ];
  const WORLD_SIZE = 4;
  const TRAIL_INTERVAL = 3;

  /* --- Dot Chains --- */
  const DOT_CHAIN_WINDOW = 500;
  const DOT_CHAIN_THRESHOLDS = [5, 10, 20, 50];

  const POWERUP_SPAWN_INTERVAL = 15000;
  const POWERUP_LIFETIME = 10000;
  const POWERUP_BLINK_START = 7000;
  const POWERUP_MIN_DOTS = 30;

  const INTERMISSION_DURATION = 4000;

  /* --- Boss --- */
  const BOSS_EVERY = 4;
  const BOSS_BASE_HP = 8;
  const BOSS_HP_PER_BOSS = 4;
  const BOSS_SIZE = 2.5;
  const BOSS_SPEED_BASE = 1.2;
  const BOSS_WARNING_DURATION = 2500;
  const BOSS_VICTORY_DURATION = 3000;

  Object.assign(C, {
    COLS, ROWS, TILE, CANVAS_W, CANVAS_H, STORAGE_KEY, MAX_HIGH_SCORES, T_WALL,
    T_DOT, T_POWER, T_EMPTY, T_GHOST_HOUSE, T_GATE, DIR_LEFT, DIR_UP,
    DIR_RIGHT, DIR_DOWN, DIR_NONE, DX, DY, MODE_SCATTER, MODE_CHASE,
    MODE_FRIGHTENED, MODE_EATEN, GHOST_COLORS, GHOST_NAMES, SCATTER_TARGETS,
    GHOST_HOUSE_DOOR, GHOST_HOUSE_EXIT, GHOST_START_POS, PACMAN_START,
    MODE_TIMINGS, FRIGHTENED_FLASH_TIME, GHOST_EAT_POINTS, WORLD_THEMES,
    WORLD_SIZE, TRAIL_INTERVAL, DOT_CHAIN_WINDOW, DOT_CHAIN_THRESHOLDS,
    POWERUP_SPAWN_INTERVAL, POWERUP_LIFETIME, POWERUP_BLINK_START,
    POWERUP_MIN_DOTS, INTERMISSION_DURATION, BOSS_EVERY, BOSS_BASE_HP,
    BOSS_HP_PER_BOSS, BOSS_SIZE, BOSS_SPEED_BASE, BOSS_WARNING_DURATION,
    BOSS_VICTORY_DURATION
  });
})();
