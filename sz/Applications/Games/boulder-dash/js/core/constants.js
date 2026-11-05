/* Fixed numbers of the game: the 1280 x 720 view plane, the cell size, the 60 Hz step and the
   cave tick cadence, the cell type ids and their physical traits, directions, storage keys,
   scoring and the UI palette. Pure data, owns no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;

  /* ── View and timing ── */
  C.VIEW_W = 1280;
  C.VIEW_H = 720;
  C.TILE = 40;
  C.HUD_H = 64;
  C.STEP = 1 / 60;
  C.STEP_MS = 1000 / 60;
  C.STEP_SNAP_MS = 1.5;
  C.MAX_STEPS = 6;
  C.WORLD_PERIOD = 8;            /* steps per cave tick: 7.5 ticks per second, the classic pace */
  C.PLAYER_PERIOD = 8;           /* steps per player move */
  C.BOOTS_PERIOD = 5;
  C.SLOW_PERIOD = 16;
  C.AUTOSAVE_EVERY = 4;          /* seconds */
  C.TAU = Math.PI * 2;

  /* ── Cell types ── */
  C.EMPTY = 0;
  C.DIRT = 1;
  C.BRICK = 2;
  C.STEEL = 3;
  C.BOULDER = 4;
  C.GEM = 5;
  C.EXIT = 6;           /* aux 0 closed, 1 open */
  C.MAGIC = 7;
  C.AMOEBA = 8;
  C.LAVA = 9;
  C.ICE = 10;
  C.TNT = 11;
  C.ITEM = 12;          /* kind in run.item */
  C.EXPLODE = 13;       /* aux: ticks left, dir: what it leaves (EMPTY or GEM) */
  C.PLAYER = 14;
  C.FIREFLY = 15;       /* dir 0 up 1 right 2 down 3 left */
  C.BUTTERFLY = 16;
  C.MOLE = 17;
  C.BAT = 18;
  C.BOSS = 19;
  C.BIGGEM = 20;        /* crystal worth five gems */
  C.CELL_TYPES = 21;

  C.CELL_NAMES = ['empty', 'dirt', 'brick', 'steel', 'boulder', 'gem', 'exit', 'magic', 'amoeba', 'lava',
    'ice', 'tnt', 'item', 'explode', 'player', 'firefly', 'butterfly', 'mole', 'bat', 'boss', 'biggem'];

  /* things that fall when nothing is beneath them */
  C.FALLS = new Uint8Array(C.CELL_TYPES);
  C.FALLS[C.BOULDER] = C.FALLS[C.GEM] = C.FALLS[C.ICE] = C.FALLS[C.TNT] = C.FALLS[C.BIGGEM] = 1;
  /* things a falling object rolls off */
  C.ROUNDED = new Uint8Array(C.CELL_TYPES);
  C.ROUNDED[C.BOULDER] = C.ROUNDED[C.GEM] = C.ROUNDED[C.BRICK] = C.ROUNDED[C.BIGGEM] = 1;
  /* falling objects that roll off rounded things themselves */
  C.ROLLS = new Uint8Array(C.CELL_TYPES);
  C.ROLLS[C.BOULDER] = C.ROLLS[C.GEM] = C.ROLLS[C.BIGGEM] = 1;
  /* creatures */
  C.CREATURE = new Uint8Array(C.CELL_TYPES);
  C.CREATURE[C.FIREFLY] = C.CREATURE[C.BUTTERFLY] = C.CREATURE[C.MOLE] = C.CREATURE[C.BAT] = 1;
  /* survives explosions */
  C.BLASTPROOF = new Uint8Array(C.CELL_TYPES);
  C.BLASTPROOF[C.STEEL] = C.BLASTPROOF[C.EXIT] = C.BLASTPROOF[C.BOSS] = 1;
  /* cells the player can step into (with the effect the move rules apply) */
  C.WALKABLE = new Uint8Array(C.CELL_TYPES);
  C.WALKABLE[C.EMPTY] = C.WALKABLE[C.DIRT] = C.WALKABLE[C.GEM] = C.WALKABLE[C.ITEM] = C.WALKABLE[C.BIGGEM] = 1;

  /* ── Directions: up, right, down, left ── */
  C.DX = [0, 1, 0, -1];
  C.DY = [-1, 0, 1, 0];

  /* ── Storage ── */
  C.STORAGE_PREFIX = 'sz-boulder-dash';
  C.SAVE_KEY = C.STORAGE_PREFIX + '-save-v2';
  C.RUN_KEY = C.STORAGE_PREFIX + '-run-v2';
  C.OLD_SCORES_KEY = C.STORAGE_PREFIX + '-highscores';
  C.OLD_TUTORIAL_KEY = C.STORAGE_PREFIX + '-tutorial-seen';
  C.MAX_HIGH_SCORES = 10;

  /* ── Scoring ── */
  C.GEM_SCORE = 10;
  C.BIGGEM_SCORE = 60;
  C.KILL_SCORE = 120;
  C.BOSS_SCORE = 2500;
  C.TIME_BONUS = 5;
  C.COMBO_WINDOW = 1.6;
  C.COMBO_MAX = 8;
  C.SHIELD_GRACE = 1.2;

  /* ── UI palette ── */
  C.FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';
  C.UI = {
    text: '#f4ead8',
    dim: '#b7a88f',
    faint: '#7d705e',
    accent: '#ffb347',
    accent2: '#5fd6ff',
    good: '#7dff8a',
    bad: '#ff5d5d',
    gold: '#ffd54a',
    panelTop: 'rgba(48,36,28,0.94)',
    panelBottom: 'rgba(22,16,13,0.96)',
    shade: 'rgba(8,6,4,0.62)'
  };
})();
