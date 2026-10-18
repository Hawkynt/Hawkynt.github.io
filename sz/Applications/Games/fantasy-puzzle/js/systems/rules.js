/* Rule helpers over G.puzzle: cached reach and valid actions, walking paths, stand tiles and
   pointer-to-action mapping. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { T } = NS.consts;
  const { colOf, rowOf, tileCenterX, tileCenterY, toViewX, toViewY } = NS.view;

  function invalidateCaches() {
    G.reachCache = null;
    G.actionsCache = null;
  }

  function reach() {
    if (!G.reachCache)
      G.reachCache = SZ.PuzzleCore.reachSet(G.puzzle);
    return G.reachCache;
  }

  function actions() {
    if (!G.actionsCache)
      G.actionsCache = SZ.PuzzleCore.validActions(G.puzzle);
    return G.actionsCache;
  }

  function isWalkable(tile) {
    return tile === T.FLOOR || tile === T.WATER || tile === T.GOAL || tile === T.RUNE;
  }

  function goalIndex() {
    const tiles = G.puzzle.tiles;
    for (let i = 0; i < tiles.length; ++i)
      if (tiles[i] === T.GOAL)
        return i;
    return -1;
  }

  function neighbours4(idx, out) {
    const rows = G.puzzle.rows, cols = G.puzzle.cols;
    const r = rowOf(idx), c = colOf(idx);
    out.length = 0;
    if (r > 0) out.push(idx - cols);
    if (r + 1 < rows) out.push(idx + cols);
    if (c > 0) out.push(idx - 1);
    if (c + 1 < cols) out.push(idx + 1);
    return out;
  }

  /* shortest walking route over walkable tiles, as tile indices from -> to */
  function walkPath(from, to) {
    if (from === to)
      return [from];
    const prev = new Map([[from, -1]]);
    const queue = [from];
    const nb = [];
    for (let head = 0; head < queue.length; ++head) {
      const idx = queue[head];
      neighbours4(idx, nb);
      for (const n of nb) {
        if (prev.has(n) || !isWalkable(G.puzzle.tiles[n]))
          continue;
        prev.set(n, idx);
        if (n === to) {
          const path = [n];
          let cur = n;
          while (prev.get(cur) >= 0) {
            cur = prev.get(cur);
            path.push(cur);
          }
          path.reverse();
          return path;
        }
        queue.push(n);
      }
    }
    return null;
  }

  /* the reachable tile next to `target` that the mage reaches first */
  function nearestStandTo(target) {
    const prev = new Map([[G.puzzle.hero, -1]]);
    const queue = [G.puzzle.hero];
    const nb = [];
    for (let head = 0; head < queue.length; ++head) {
      const idx = queue[head];
      neighbours4(idx, nb);
      for (const n of nb) {
        if (n === target)
          continue;
        if (prev.has(n) || !isWalkable(G.puzzle.tiles[n]))
          continue;
        prev.set(n, idx);
        queue.push(n);
      }
    }
    neighbours4(target, nb);
    let best = -1, bestDist = Infinity;
    for (const n of nb) {
      if (!reach().has(n))
        continue;
      let d = 0, cur = n;
      while (prev.get(cur) >= 0) { ++d; cur = prev.get(cur); }
      if (d < bestDist) { bestDist = d; best = n; }
    }
    return best;
  }

  function dirBetween(from, to) {
    const dr = rowOf(to) - rowOf(from), dc = colOf(to) - colOf(from);
    if (Math.abs(dr) >= Math.abs(dc))
      return dr < 0 ? 'up' : 'down';
    return dc < 0 ? 'left' : 'right';
  }

  /* the push direction the pointer asks for on a boulder: the mage stands
     on the side the pointer points at and shoves the boulder away from it */
  function airDirForPointer(idx, p) {
    const cx = toViewX(tileCenterX(idx)), cy = toViewY(tileCenterY(idx));
    const dx = p.x - cx, dy = p.y - cy;
    if (Math.abs(dx) >= Math.abs(dy))
      return dx >= 0 ? 'left' : 'right';
    return dy >= 0 ? 'up' : 'down';
  }

  function actionsForTile(idx, element, p) {
    const list = actions();
    const out = [];
    for (const a of list) {
      if (a.index !== idx || a.element !== element)
        continue;
      if (element === 'air' && p && a.dir !== airDirForPointer(idx, p))
        continue;
      out.push(a);
    }
    return out;
  }

  NS.rules = { reach, invalidateCaches, isWalkable, goalIndex, neighbours4, walkPath, nearestStandTo, dirBetween,
    actionsForTile };
})();
