;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.walltile.drawWallTileOnCtx = function drawWallTileOnCtx(c, tx, ty, color) {
    const ref = T.MAZE_TEMPLATE;
    const x = tx * C.TILE;
    const y = ty * C.TILE;

    const up    = ty > 0 && ref[ty - 1][tx] === C.T_WALL;
    const down  = ty < C.ROWS - 1 && ref[ty + 1][tx] === C.T_WALL;
    const left  = tx > 0 && ref[ty][tx - 1] === C.T_WALL;
    const right = tx < C.COLS - 1 && ref[ty][tx + 1] === C.T_WALL;

    c.strokeStyle = color;
    c.lineWidth = 2;

    const cx = x + C.TILE / 2;
    const cy = y + C.TILE / 2;
    const r = C.TILE / 2 - 1;

    if (!up) {
      c.beginPath();
      c.moveTo(left ? x : cx, cy - r);
      c.lineTo(right ? x + C.TILE : cx, cy - r);
      c.stroke();
    }
    if (!down) {
      c.beginPath();
      c.moveTo(left ? x : cx, cy + r);
      c.lineTo(right ? x + C.TILE : cx, cy + r);
      c.stroke();
    }
    if (!left) {
      c.beginPath();
      c.moveTo(cx - r, up ? y : cy);
      c.lineTo(cx - r, down ? y + C.TILE : cy);
      c.stroke();
    }
    if (!right) {
      c.beginPath();
      c.moveTo(cx + r, up ? y : cy);
      c.lineTo(cx + r, down ? y + C.TILE : cy);
      c.stroke();
    }

    /* Rounded outer corners -- quarter-circle arcs connecting adjacent edge endpoints */
    if (!up && !left) {
      c.beginPath();
      c.arc(cx, cy, r, Math.PI, Math.PI * 1.5);
      c.stroke();
    }
    if (!up && !right) {
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 1.5, Math.PI * 2);
      c.stroke();
    }
    if (!down && !left) {
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.5, Math.PI);
      c.stroke();
    }
    if (!down && !right) {
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 0.5);
      c.stroke();
    }

    /* Inner corners */
    const upLeft    = ty > 0 && tx > 0 && ref[ty - 1][tx - 1] === C.T_WALL;
    const upRight   = ty > 0 && tx < C.COLS - 1 && ref[ty - 1][tx + 1] === C.T_WALL;
    const downLeft  = ty < C.ROWS - 1 && tx > 0 && ref[ty + 1][tx - 1] === C.T_WALL;
    const downRight = ty < C.ROWS - 1 && tx < C.COLS - 1 && ref[ty + 1][tx + 1] === C.T_WALL;

    if (up && left && !upLeft) {
      c.beginPath();
      c.arc(cx - r, cy - r, r, 0, Math.PI * 0.5);
      c.stroke();
    }
    if (up && right && !upRight) {
      c.beginPath();
      c.arc(cx + r, cy - r, r, Math.PI * 0.5, Math.PI);
      c.stroke();
    }
    if (down && left && !downLeft) {
      c.beginPath();
      c.arc(cx - r, cy + r, r, Math.PI * 1.5, Math.PI * 2);
      c.stroke();
    }
    if (down && right && !downRight) {
      c.beginPath();
      c.arc(cx + r, cy + r, r, Math.PI, Math.PI * 1.5);
      c.stroke();
    }
  }

})();
