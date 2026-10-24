;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.mazeview.drawMaze = function drawMaze() {
    /* Draw cached walls (at physical resolution, mapped to logical coords) */
    D.ctx.drawImage(S.mazeCache, 0, 0, C.CANVAS_W, C.CANVAS_H);

    /* Draw dots and power pellets */
    for (let y = 0; y < C.ROWS; ++y)
      for (let x = 0; x < C.COLS; ++x) {
        const t = S.maze[y][x];
        const cx = x * C.TILE + C.TILE / 2;
        const cy = y * C.TILE + C.TILE / 2;
        if (t === C.T_DOT) {
          D.ctx.fillStyle = S.currentTheme.dotColor;
          D.ctx.beginPath();
          D.ctx.arc(cx, cy, 2, 0, Math.PI * 2);
          D.ctx.fill();
        } else if (t === C.T_POWER) {
          const pulse = Math.sin(performance.now() * 0.005) * 0.3 + 0.7;
          SZ.GameEffects.drawGlow(D.ctx, c => {
            c.fillStyle = S.currentTheme.dotColor;
            c.beginPath();
            c.arc(cx, cy, 5 * pulse, 0, Math.PI * 2);
            c.fill();
          }, '#FFFFFF', 8 * pulse);
        }
      }
  }

  NS.mazeview.drawMazeFlash = function drawMazeFlash() {
    for (let y = 0; y < C.ROWS; ++y)
      for (let x = 0; x < C.COLS; ++x)
        if (T.MAZE_TEMPLATE[y][x] === C.T_WALL)
          NS.walltile.drawWallTileOnCtx(D.ctx, x, y, '#FFFFFF');
  }

})();
