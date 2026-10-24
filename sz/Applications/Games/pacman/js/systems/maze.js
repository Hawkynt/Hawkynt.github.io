;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.maze.cloneMaze = function cloneMaze() {
    return T.MAZE_TEMPLATE.map(row => [...row]);
  }

  NS.maze.countDots = function countDots(m) {
    let count = 0;
    for (let y = 0; y < C.ROWS; ++y)
      for (let x = 0; x < C.COLS; ++x)
        if (m[y][x] === C.T_DOT || m[y][x] === C.T_POWER)
          ++count;
    return count;
  }

  NS.maze.isWall = function isWall(tx, ty) {
    if (ty < 0 || ty >= C.ROWS)
      return true;
    if (tx < 0 || tx >= C.COLS)
      return false;
    return S.maze[ty][tx] === C.T_WALL;
  }

  NS.maze.isWalkable = function isWalkable(tx, ty, allowGate) {
    if (ty < 0 || ty >= C.ROWS)
      return false;
    if (tx < 0 || tx >= C.COLS)
      return true; // tunnel
    const t = S.maze[ty][tx];
    if (t === C.T_WALL)
      return false;
    if (t === C.T_GATE)
      return !!allowGate;
    return true;
  }

  NS.maze.wrapX = function wrapX(tx) {
    if (tx < 0)
      return C.COLS - 1;
    if (tx >= C.COLS)
      return 0;
    return tx;
  }

})();
