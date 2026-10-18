/* Canvas sizing, the letterboxed 1280 x 720 view and board-space geometry. Owns G.viewScale, G.TS,
   G.boardX and G.boardY (letterbox offsets stay private); reads G.puzzle. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, BOARD_X0, BOARD_Y0, BOARD_W, BOARD_H, BOARD_FRAME } = NS.consts;
  const { canvas, ctx } = NS.context;

  let viewOffX = 0, viewOffY = 0, dpr = 1;

  function setupCanvas() {
    const cssW = Math.max(1, canvas.clientWidth), cssH = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssW / VIEW_W, cssH / VIEW_H);
    dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5 / Math.max(fit, 0.01)));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    G.viewScale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    viewOffX = Math.round((canvas.width - VIEW_W * G.viewScale) / 2);
    viewOffY = Math.round((canvas.height - VIEW_H * G.viewScale) / 2);
  }

  /* Visible logical area including the letterbox bars */
  function visibleRect() {
    return { x0: -viewOffX / G.viewScale, y0: -viewOffY / G.viewScale, x1: (canvas.width - viewOffX) / G.viewScale, y1: (canvas.height - viewOffY) / G.viewScale };
  }

  /* Start of every frame: clear, then logical 1280 x 720 coordinates */
  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0816';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(G.viewScale, 0, 0, G.viewScale, viewOffX, viewOffY);
  }

  /* Pointer event -> logical 1280 x 720 coordinates */
  function pointerToView(e) {
    const rect = canvas.getBoundingClientRect();
    const d = canvas.width / Math.max(1, rect.width);
    return { x: ((e.clientX - rect.left) * d - viewOffX) / G.viewScale, y: ((e.clientY - rect.top) * d - viewOffY) / G.viewScale };
  }

  function computeBoard() {
    /* the frame scales with the tiles: n tiles plus two frame bands must fit */
    G.TS = Math.min(64, Math.floor(BOARD_W / (G.puzzle.cols + BOARD_FRAME * 2 / 64)), Math.floor(BOARD_H / (G.puzzle.rows + BOARD_FRAME * 2 / 64)));
    G.boardX = BOARD_X0 + (BOARD_W - G.puzzle.cols * G.TS) / 2;
    G.boardY = BOARD_Y0 + (BOARD_H - G.puzzle.rows * G.TS) / 2;
  }

  function rowOf(idx) { return (idx / G.puzzle.cols) | 0; }
  function colOf(idx) { return idx % G.puzzle.cols; }
  function tileCenterX(idx) { return colOf(idx) * 64 + 32; }
  function tileCenterY(idx) { return rowOf(idx) * 64 + 32; }
  function tileVariant(idx) { return (rowOf(idx) * 7 + colOf(idx) * 13) % 4; }

  /* board space (64 px) -> view space */
  function toViewX(x) { return G.boardX + x * G.TS / 64; }
  function toViewY(y) { return G.boardY + y * G.TS / 64; }

  function pointToTile(p) {
    const c = Math.floor((p.x - G.boardX) / G.TS);
    const r = Math.floor((p.y - G.boardY) / G.TS);
    if (c < 0 || c >= G.puzzle.cols || r < 0 || r >= G.puzzle.rows)
      return -1;
    return r * G.puzzle.cols + c;
  }

  NS.view = { setupCanvas, visibleRect, beginFrame, pointerToView, computeBoard, colOf, rowOf, tileCenterX,
    tileCenterY, toViewX, toViewY, pointToTile };
})();
