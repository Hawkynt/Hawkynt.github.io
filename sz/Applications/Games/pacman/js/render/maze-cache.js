;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.mazecache.buildMazeCache = function buildMazeCache() {
    const mc = document.createElement('D.canvas');
    mc.width = C.CANVAS_W * D.dpr;
    mc.height = C.CANVAS_H * D.dpr;
    const mctx = mc.getContext('2d');
    mctx.setTransform(D.dpr, 0, 0, D.dpr, 0, 0);

    /* Draw walls with glow */
    mctx.save();
    mctx.shadowColor = S.currentTheme.wallGlow;
    mctx.shadowBlur = 6;

    for (let y = 0; y < C.ROWS; ++y)
      for (let x = 0; x < C.COLS; ++x)
        if (T.MAZE_TEMPLATE[y][x] === C.T_WALL)
          NS.walltile.drawWallTileOnCtx(mctx, x, y, S.currentTheme.wall);

    /* Second pass for stronger glow */
    for (let y = 0; y < C.ROWS; ++y)
      for (let x = 0; x < C.COLS; ++x)
        if (T.MAZE_TEMPLATE[y][x] === C.T_WALL)
          NS.walltile.drawWallTileOnCtx(mctx, x, y, S.currentTheme.wall);

    mctx.restore();

    /* Draw gate */
    for (let y = 0; y < C.ROWS; ++y)
      for (let x = 0; x < C.COLS; ++x)
        if (T.MAZE_TEMPLATE[y][x] === C.T_GATE) {
          mctx.fillStyle = '#FFB8FF';
          mctx.fillRect(x * C.TILE, y * C.TILE + C.TILE / 2 - 1, C.TILE, 2);
        }

    S.mazeCache = mc;
  }

})();
