/* The frame composition: the back-to-front tile pass with its rotation wobble, the
   entities on top of it, and the whole scene (background, board, HUD). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const L = NS.levels;
  const S = NS.state;
  const D = NS.dom;
  const P = NS.palette;
  const { drawBackground } = NS.background;
  const { drawIsometricTile } = NS.tiles;
  const { drawTrail, drawCollectibles, drawPlayer } = NS.entities;
  const { drawHUD } = NS.hud;

  function drawGrid() {
    const def = L.LEVELS[S.currentLevel];
    const rows = def.grid.length;
    const cols = def.grid[0].length;

    // Apply perspective rotation visual
    if (S.rotationProgress < 1) {
      D.ctx.save();
      const angle = (S.rotationTo - S.rotationFrom) * (1 - S.rotationProgress) * Math.PI * 0.02;
      D.ctx.translate(C.CANVAS_W / 2, C.CANVAS_H / 2);
      D.ctx.rotate(angle);
      D.ctx.translate(-C.CANVAS_W / 2, -C.CANVAS_H / 2);
    }

    // Draw tiles back-to-front for proper isometric overlap
    for (let r = 0; r < rows; ++r)
      for (let c = 0; c < cols; ++c) {
        const cell = def.grid[r][c];
        if (cell === 0) continue;
        const elevation = cell === 2 ? P.ELEVATION_RAISED : 0;
        drawIsometricTile(c, r, cell, elevation);
      }

    drawTrail();
    drawCollectibles();
    drawPlayer();

    if (S.rotationProgress < 1)
      D.ctx.restore();
  }

  function drawGame() {
    drawBackground();

    if (S.state === C.STATE_PLAYING || S.state === C.STATE_PAUSED || S.state === C.STATE_LEVEL_COMPLETE || S.state === C.STATE_GAME_OVER)
      drawGrid();

    drawHUD();
  }

  Object.assign(NS.board, { drawGrid, drawGame });
})();
