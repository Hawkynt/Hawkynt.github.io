/* Difficulty tables, storage keys, number classes and face names. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const C = NS.constants;

  /* ---- Constants ---- */
  C.DIFFICULTIES = {
    beginner:     { cols:  9, rows:  9, mines:  10 },
    intermediate: { cols: 16, rows: 16, mines:  40 },
    expert:       { cols: 30, rows: 16, mines:  99 }
  };

  C.STORAGE_KEY = 'sz-minesweeper-best-times';
  C.STATS_KEY = 'sz-minesweeper-stats';
  C.NUMBER_COLORS = ['', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];

  C.FACE_NORMAL = 'normal';
  C.FACE_CLICK  = 'click';
  C.FACE_WIN    = 'win';
  C.FACE_DEAD   = 'dead';
})();
