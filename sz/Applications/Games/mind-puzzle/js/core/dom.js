/* D, the long-lived page objects: the game canvas with its 2d context, the status bar
   displays and the high-scores table body. setupCanvas scales the 700x500 room floor to
   fit the window, letterboxed. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;

  const D = NS.dom = NS.dom || {
    canvas: document.getElementById('gameCanvas'),
    ctx: null,
    statusRoom: document.getElementById('statusRoom'),
    statusDiscovered: document.getElementById('statusDiscovered'),
    statusProgress: document.getElementById('statusProgress'),
    highScoresBody: document.getElementById('highScoresBody')
  };
  D.ctx = D.canvas.getContext('2d');

  /* ── Canvas Setup ── */
  function setupCanvas() {
    // the rooms are laid out on a 700 x 500 floor: scale it to fit the window, letterboxed
    const parent = D.canvas.parentElement;
    const fit = parent ? Math.min(parent.clientWidth / C.canvasW, parent.clientHeight / C.canvasH) || 1 : 1;
    const cssW = Math.max(1, Math.floor(C.canvasW * fit));
    const cssH = Math.max(1, Math.floor(C.canvasH * fit));
    const dpr = window.devicePixelRatio || 1;
    D.canvas.width = Math.round(cssW * dpr);
    D.canvas.height = Math.round(cssH * dpr);
    D.canvas.style.width = cssW + 'px';
    D.canvas.style.height = cssH + 'px';
    D.ctx.setTransform(D.canvas.width / C.canvasW, 0, 0, D.canvas.height / C.canvasH, 0, 0);
  }

  Object.assign(NS.dom, { setupCanvas });
})();
