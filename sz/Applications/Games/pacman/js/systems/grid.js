/* Tile-grid movement shared by Pac-Man and the ghosts: tile lookups with tunnel wrap on the
   current maze, walkability for each kind of walker, wrap-aware distances, the travel routine
   that moves an actor along its direction and lets it decide at every tile centre, breadth-first
   distance maps (pooled buffers) and tile-to-plane conversion. Owns the BFS buffers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { COLS, ROWS, DX, DY, W_OPEN, W_HOUSE, W_GATE, MAZE_X, MAZE_Y, TILE } = C;

  const N = COLS * ROWS;
  const queue = new Int32Array(N + 8);

  function maze() {
    return G.run.lvl.maze;
  }

  function wrapX(x) {
    return ((x % COLS) + COLS) % COLS;
  }

  function wallAt(m, x, y) {
    if (y < 0 || y >= ROWS) return 1;
    if (x < 0 || x >= COLS) return m.tunnels.indexOf(y) >= 0 ? W_OPEN : 1;
    return m.walls[y * COLS + x];
  }

  /* walker kinds: 'pac', 'phase' (Pac through walls), 'ghost', 'eyes' (may use the gate) */
  function canEnter(m, x, y, kind) {
    const w = wallAt(m, x, y);
    if (w === W_OPEN) return true;
    if (kind === 'eyes') return w === W_GATE;
    if (kind === 'phase') return w !== W_HOUSE && w !== W_GATE && y > 0 && y < ROWS - 1 && x > 0 && x < COLS - 1;
    return false;
  }

  function opposite(d) {
    return d < 0 ? d : (d + 2) % 4;
  }

  /* shortest horizontal offset with the tunnel wrap */
  function dxWrap(ax, bx) {
    let d = bx - ax;
    if (d > COLS / 2) d -= COLS;
    else if (d < -COLS / 2) d += COLS;
    return d;
  }

  function dist2(ax, ay, bx, by) {
    const dx = dxWrap(ax, bx), dy = by - ay;
    return dx * dx + dy * dy;
  }

  function atCenter(e) {
    return Math.abs(e.x - Math.floor(e.x) - 0.5) < 1e-4 && Math.abs(e.y - Math.floor(e.y) - 0.5) < 1e-4;
  }

  /* Moves e by dist tiles along e.dir. At every tile centre decide(e, tx, ty) may change e.dir
     (or stop it with -1). Wraps through tunnels. Returns the distance actually covered. */
  function travel(e, dist, decide) {
    let moved = 0;
    for (let guard = 0; guard < 8 && dist > 1e-7; ++guard) {
      const tx = Math.floor(e.x), ty = Math.floor(e.y);
      if (atCenter(e)) {
        e.x = tx + 0.5;
        e.y = ty + 0.5;
        decide(e, wrapX(tx), ty);
        if (e.dir < 0) return moved;
        const step = Math.min(dist, 1);
        e.x += DX[e.dir] * step;
        e.y += DY[e.dir] * step;
        dist -= step;
        moved += step;
      } else {
        if (e.dir < 0) return moved;
        let d = (tx + 0.5 - e.x) * DX[e.dir] + (ty + 0.5 - e.y) * DY[e.dir];
        if (d < -1e-9) d += 1;
        if (d <= 1e-9) d = 1;
        if (d > dist) {
          e.x += DX[e.dir] * dist;
          e.y += DY[e.dir] * dist;
          moved += dist;
          dist = 0;
        } else {
          e.x += DX[e.dir] * d;
          e.y += DY[e.dir] * d;
          /* land exactly on the centre */
          e.x = Math.round(e.x - 0.5) + 0.5;
          e.y = Math.round(e.y - 0.5) + 0.5;
          dist -= d;
          moved += d;
        }
      }
      if (e.x < 0) e.x += COLS;
      else if (e.x >= COLS) e.x -= COLS;
    }
    return moved;
  }

  /* Breadth-first distances from a set of tiles over the walkable grid (out: Int16Array, -1 = unreached) */
  function bfs(m, sources, out, kind, maxD) {
    out.fill(-1);
    let head = 0, tail = 0;
    for (let i = 0; i < sources.length; ++i) {
      const s = sources[i];
      if (s >= 0 && s < N && out[s] < 0) { out[s] = 0; queue[tail++] = s; }
    }
    const lim = maxD || 9999;
    while (head < tail) {
      const i = queue[head++];
      const d = out[i];
      if (d >= lim) continue;
      const x = i % COLS, y = (i - x) / COLS;
      for (let k = 0; k < 4; ++k) {
        let nx = x + DX[k];
        const ny = y + DY[k];
        if (!canEnter(m, nx, ny, kind || 'ghost')) continue;
        nx = wrapX(nx);
        const j = ny * COLS + nx;
        if (out[j] < 0) { out[j] = d + 1; queue[tail++] = j; }
      }
    }
    return out;
  }

  function tileIndex(x, y) {
    return Math.floor(y) * COLS + wrapX(Math.floor(x));
  }

  /* plane coordinates of a tile-space point */
  function px(x) {
    return MAZE_X + x * TILE;
  }

  function py(y) {
    return MAZE_Y + y * TILE;
  }

  Object.assign(NS.grid, {
    N, maze, wrapX, wallAt, canEnter, opposite, dxWrap, dist2, atCenter, travel, bfs, tileIndex, px, py
  });
})();
