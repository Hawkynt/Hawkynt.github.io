/* A uniform spatial grid over the sector for broad-phase collision: objects with x, y, r are
   bucketed per frame; circle and segment queries return each candidate once. Also the shared
   swap-remove helper for entity lists. Pure; owns only the grids it creates. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  function createGrid(w, h, cell) {
    const g = {
      cell: cell,
      cols: 1,
      rows: 1,
      cells: [],
      used: [],
      stamp: 1,
      count: 0,
    };

    g.reset = function(width, height) {
      g.clear();
      g.cols = Math.max(1, Math.ceil(width / cell) + 2);
      g.rows = Math.max(1, Math.ceil(height / cell) + 2);
      const n = g.cols * g.rows;
      g.cells.length = n;
      for (let i = 0; i < n; ++i)
        g.cells[i] = g.cells[i] || [];
    };

    g.clear = function() {
      for (let i = 0; i < g.used.length; ++i)
        g.cells[g.used[i]].length = 0;
      g.used.length = 0;
      g.count = 0;
    };

    /* column/row of a coordinate; one border cell outside the sector on every side */
    function col(x) {
      const c = Math.floor(x / cell) + 1;
      return c < 0 ? 0 : c >= g.cols ? g.cols - 1 : c;
    }
    function row(y) {
      const r = Math.floor(y / cell) + 1;
      return r < 0 ? 0 : r >= g.rows ? g.rows - 1 : r;
    }

    g.insert = function(o) {
      const r = o.r || 0;
      const c0 = col(o.x - r), c1 = col(o.x + r);
      const r0 = row(o.y - r), r1 = row(o.y + r);
      for (let rr = r0; rr <= r1; ++rr)
        for (let cc = c0; cc <= c1; ++cc) {
          const idx = rr * g.cols + cc;
          const bucket = g.cells[idx];
          if (bucket.length === 0)
            g.used.push(idx);
          bucket.push(o);
        }
      ++g.count;
    };

    /* Every object whose bucket touches the circle; `out` is reused by the caller */
    g.query = function(x, y, r, out) {
      out.length = 0;
      const s = ++g.stamp;
      const c0 = col(x - r), c1 = col(x + r);
      const r0 = row(y - r), r1 = row(y + r);
      for (let rr = r0; rr <= r1; ++rr)
        for (let cc = c0; cc <= c1; ++cc) {
          const bucket = g.cells[rr * g.cols + cc];
          for (let i = 0; i < bucket.length; ++i) {
            const o = bucket[i];
            if (o._q !== s) {
              o._q = s;
              out.push(o);
            }
          }
        }
      return out;
    };

    /* Objects near a segment: the cells swept by the segment widened by `pad` */
    g.querySegment = function(x0, y0, x1, y1, pad, out) {
      out.length = 0;
      const s = ++g.stamp;
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.ceil(len / (cell * 0.5)));
      for (let k = 0; k <= steps; ++k) {
        const px = x0 + dx * k / steps, py = y0 + dy * k / steps;
        const c0 = col(px - pad), c1 = col(px + pad);
        const r0 = row(py - pad), r1 = row(py + pad);
        for (let rr = r0; rr <= r1; ++rr)
          for (let cc = c0; cc <= c1; ++cc) {
            const bucket = g.cells[rr * g.cols + cc];
            for (let i = 0; i < bucket.length; ++i) {
              const o = bucket[i];
              if (o._q !== s) {
                o._q = s;
                out.push(o);
              }
            }
          }
      }
      return out;
    };

    g.reset(w, h);
    return g;
  }

  /* Remove dead entries (alive === false) in place, keeping order; returns the new length */
  function compact(list, onRemove) {
    let j = 0;
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (o.alive) {
        list[j] = o;
        ++j;
      }
      else if (onRemove) onRemove(o);
    }
    list.length = j;
    return j;
  }

  /* A free list per kind so short-lived objects (bullets) are reused, not reallocated */
  function createPool(factory) {
    const free = [];
    return {
      get() {
        return free.length ? free.pop() : factory();
      },
      put(o) {
        if (free.length < 4000) free.push(o);
      },
      get size() {
        return free.length;
      },
    };
  }

  Object.assign(NS.grid, {
    createGrid, compact, createPool
  });
})();
