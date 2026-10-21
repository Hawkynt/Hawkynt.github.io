/* The element refs the controller queries once at load time. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const D = NS.dom = NS.dom || {};

  /* ---- DOM ---- */
  D.minefield    = document.getElementById('minefield');
  D.mineCounter  = document.getElementById('mineCounter');
  D.timerDisplay = document.getElementById('timer');
  D.smileyBtn    = document.getElementById('smileyBtn');
  D.gameFrame    = document.getElementById('gameFrame');
  D.scaleWrapper = document.getElementById('scaleWrapper');
  D.flashOverlay = document.getElementById('flashOverlay');

  /* ---- Custom Field Dialog ---- */
  D.customRowsInput  = document.getElementById('customRows');
  D.customColsInput  = document.getElementById('customCols');
  D.customMinesInput = document.getElementById('customMines');
  D.customError      = document.getElementById('customError');
})();
