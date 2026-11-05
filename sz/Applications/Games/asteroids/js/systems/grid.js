/* A toroidal spatial grid for broad-phase collision on the wrapping field: objects with x, y, r
   are bucketed per step and circle queries wrap across the edges, returning each candidate once.
   Also object pools and the in-place compaction of entity lists. Pure; owns only what it creates. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  function createGrid(w, h, cell) {
    const cols = Math.max(1, Math.ceil(w / cell));
    const rows = Math.max(1, Math.ceil(h / cell));
    const cells = [];
    for (let i = 0; i < cols * rows; ++i) cells.push([]);
    const used = [];
    let stamp = 1;

    function idx(cx, cy) {
      cx %= cols; if (cx < 0) cx += cols;
      cy %= rows; if (cy < 0) cy += rows;
      return cy * cols + cx;
    }

    const g = { cols: cols, rows: rows, cell: cell, count: 0 };

    g.clear = function() {
      for (let i = 0; i < used.length; ++i) cells[used[i]].length = 0;
      used.length = 0;
      g.count = 0;
    };

    g.insert = function(o) {
      const r = o.r || 0;
      const c0 = Math.floor((o.x - r) / cell), c1 = Math.floor((o.x + r) / cell);
      const r0 = Math.floor((o.y - r) / cell), r1 = Math.floor((o.y + r) / cell);
      for (let ry = r0; ry <= r1 && ry - r0 < rows; ++ry)
        for (let cx = c0; cx <= c1 && cx - c0 < cols; ++cx) {
          const i = idx(cx, ry);
          const b = cells[i];
          /* a big object can wrap onto the same cell twice */
          if (b.length && b[b.length - 1] === o) continue;
          if (!b.length) used.push(i);
          b.push(o);
        }
      ++g.count;
    };

    /* every object whose buckets touch the circle; `out` is reused by the caller */
    g.query = function(x, y, r, out) {
      out.length = 0;
      const s = ++stamp;
      const c0 = Math.floor((x - r) / cell), c1 = Math.floor((x + r) / cell);
      const r0 = Math.floor((y - r) / cell), r1 = Math.floor((y + r) / cell);
      for (let ry = r0; ry <= r1 && ry - r0 < rows; ++ry)
        for (let cx = c0; cx <= c1 && cx - c0 < cols; ++cx) {
          const b = cells[idx(cx, ry)];
          for (let i = 0; i < b.length; ++i) {
            const o = b[i];
            if (o._q !== s) {
              o._q = s;
              out.push(o);
            }
          }
        }
      return out;
    };

    return g;
  }

  function createPool(make) {
    const free = [];
    return {
      get() { return free.length ? free.pop() : make(); },
      put(o) { if (free.length < 4096) free.push(o); },
      size() { return free.length; },
    };
  }

  /* removes dead entries (alive === false) keeping order; recycle gets each removed one */
  function compact(list, recycle) {
    let j = 0;
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (o.alive === false) {
        if (recycle) recycle(o);
      } else
        list[j++] = o;
    }
    list.length = j;
  }

  Object.assign(NS.grid, {
    createGrid, createPool, compact
  });
})();
