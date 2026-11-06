/* Formation maths: slot offsets for line, wedge, box and circle around an anchor (x along the
   facing, y to its right), turning them into world points, matching units to slots so paths
   do not cross (shortest pairs first), and the speed a group keeps to stay in shape. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const KINDS = ['line', 'wedge', 'box', 'circle'];

  /* local offsets { x: forward, y: right } for n units, centred on the anchor */
  function slots(kind, n, spacing) {
    const sp = spacing || 40;
    const out = [];
    if (n <= 0) return out;
    if (kind === 'line') {
      for (let i = 0; i < n; ++i) out.push({ x: 0, y: (i - (n - 1) / 2) * sp });
    } else if (kind === 'wedge') {
      out.push({ x: 0, y: 0 });
      for (let i = 1; i < n; ++i) {
        const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
        out.push({ x: -row * sp * 0.85, y: side * row * sp * 0.75 });
      }
      /* centre the wedge on the anchor */
      let mx = 0, my = 0;
      for (let i = 0; i < n; ++i) { mx += out[i].x; my += out[i].y; }
      mx /= n;
      my /= n;
      for (let i = 0; i < n; ++i) { out[i].x -= mx; out[i].y -= my; }
    } else if (kind === 'box') {
      const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      for (let i = 0; i < n; ++i) {
        const c = i % cols, r = Math.floor(i / cols);
        const inRow = r === rows - 1 ? n - r * cols : cols;
        out.push({ x: ((rows - 1) / 2 - r) * sp, y: (c - (inRow - 1) / 2) * sp });
      }
    } else {
      if (n === 1) out.push({ x: 0, y: 0 });
      else {
        const rad = Math.max(sp * 0.8, n * sp / (Math.PI * 2));
        for (let i = 0; i < n; ++i) {
          const a = i / n * Math.PI * 2;
          out.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
        }
      }
    }
    return out;
  }

  /* local offset -> world point for an anchor facing `facing` (radians) */
  function place(off, ax, ay, facing, out) {
    const c = Math.cos(facing), s = Math.sin(facing);
    out = out || {};
    out.x = ax + off.x * c - off.y * s;
    out.y = ay + off.x * s + off.y * c;
    return out;
  }

  function worldSlots(kind, n, ax, ay, facing, spacing) {
    const loc = slots(kind, n, spacing);
    const out = [];
    for (let i = 0; i < loc.length; ++i) {
      const p = place(loc[i], ax, ay, facing);
      p.ox = loc[i].x;
      p.oy = loc[i].y;
      out.push(p);
    }
    return out;
  }

  /* unit i takes slot result[i]: the shortest unit-slot pairs are matched first */
  function assign(units, points) {
    const pairs = [];
    for (let i = 0; i < units.length; ++i)
      for (let k = 0; k < points.length; ++k) {
        const dx = units[i].x - points[k].x, dy = units[i].y - points[k].y;
        pairs.push({ i: i, k: k, d: dx * dx + dy * dy });
      }
    pairs.sort((a, b) => a.d - b.d || a.i - b.i || a.k - b.k);
    const res = new Array(units.length), usedU = {}, usedP = {};
    for (let i = 0; i < res.length; ++i) res[i] = -1;
    let left = Math.min(units.length, points.length);
    for (let p = 0; p < pairs.length && left > 0; ++p) {
      const q = pairs[p];
      if (usedU[q.i] || usedP[q.k]) continue;
      usedU[q.i] = usedP[q.k] = true;
      res[q.i] = q.k;
      --left;
    }
    return res;
  }

  /* spacing that suits the biggest hull in the group */
  function spacing(units) {
    let r = 10;
    for (let i = 0; i < units.length; ++i) r = Math.max(r, units[i].r || 10);
    return r * 2 + 26;
  }

  function groupSpeed(units) {
    let s = Infinity;
    for (let i = 0; i < units.length; ++i) s = Math.min(s, units[i].speed);
    return isFinite(s) ? s : 0;
  }

  function centroid(units) {
    let x = 0, y = 0;
    for (let i = 0; i < units.length; ++i) { x += units[i].x; y += units[i].y; }
    const n = Math.max(1, units.length);
    return { x: x / n, y: y / n };
  }

  Object.assign(NS.formations, {
    KINDS, slots, place, worldSlots, assign, spacing, groupSpeed, centroid
  });
})();
