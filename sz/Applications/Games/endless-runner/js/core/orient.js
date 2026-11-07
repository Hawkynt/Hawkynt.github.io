/* Run directions. The simulation always runs along +x with gravity toward the floor; a
   direction (right, left, up, down) is only how the whole playfield is turned on screen: a
   number of quarter turns q and a mirror m, so the screen matrix is rotate(q * 90 deg) times
   scale(m, 1). A course carries a sorted list of direction entries (x where the turn starts,
   its length, the new direction resolved to q and m, the cast's line); the view at any x is a
   pure function of that list, so saves, ghosts and replays need nothing extra. Also maps screen
   arrows and swipes to moves so that "away from the floor" is always a jump. Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;

  const DIRS = ['right', 'left', 'up', 'down'];
  const VERT = { up: 1, down: 1 };
  const OPP = { right: 'left', left: 'right', up: 'down', down: 'up' };
  /* a turn in seconds at the local speed: safe run-in, the rotation itself, safe run-out */
  const PRE = 0.6, TURN = 1.0, POST = 0.7;
  /* vertical views zoom out a little: the screen is shorter than it is wide */
  const VERT_ZOOM = 0.82;
  const HALF_PI = Math.PI / 2;

  /* the view of a direction, given the view before it: no mirror flip unless the runner turns
     right round (right <-> left, up <-> down) */
  function resolve(prev, dir) {
    if (dir === 'right') return { q: 0, m: 1 };
    if (dir === 'left') return { q: 0, m: -1 };
    if (prev && prev.dir === OPP[dir]) return { q: prev.q, m: -prev.m };
    const m = prev ? prev.m : 1;
    const qUp = m > 0 ? -1 : 1;
    return { q: dir === 'up' ? qUp : -qUp, m: m };
  }

  function first(dir, x0) {
    const d = DIRS.indexOf(dir) >= 0 ? dir : 'right';
    const o = resolve(null, d);
    return { x: x0 - 1e6, len: 0, dir: d, q: o.q, m: o.m };
  }

  /* a new entry after the last one in the list */
  function entry(list, x, len, dir, say) {
    const prev = list[list.length - 1];
    const o = resolve(prev, dir);
    const e = { x: x, len: len, dir: dir, q: o.q, m: o.m };
    if (say) { e.who = say.who; e.text = say.text; }
    return e;
  }

  /* index of the entry in force at x */
  function indexAt(list, x) {
    let i = list.length - 1;
    while (i > 0 && list[i].x > x) --i;
    return i;
  }

  function ease(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }

  /* screen anchor of the runner's floor point for a view (plane coordinates, visible rect v) */
  function anchor(q, m, v, out) {
    if (q === 0) {
      out.x = m > 0 ? C.PLAYER_SCREEN_X : C.VIEW_W - C.PLAYER_SCREEN_X;
      out.y = C.GROUND_Y;
      return out;
    }
    /* q = -1 puts the floor on the right, +1 on the left; q * m < 0 runs up the screen */
    out.x = v.x0 + v.w * (q < 0 ? 0.64 : 0.36);
    out.y = q * m < 0 ? v.y1 - 100 : v.y0 + 100;
    return out;
  }

  const A0 = { x: 0, y: 0 }, A1 = { x: 0, y: 0 };
  const FULL = { x0: 0, y0: 0, x1: C.VIEW_W, y1: C.VIEW_H, w: C.VIEW_W, h: C.VIEW_H };

  /* the view at x: angle a, mirror m (passes through 0 in a flip), turn progress t and k (eased),
     how vertical it is, the anchor, the entry index and the direction that dominates */
  function at(list, x, v, out) {
    out = out || {};
    const i = list && list.length ? indexAt(list, x) : -1;
    if (i < 0) {
      out.a = 0; out.m = 1; out.t = 1; out.k = 1; out.i = 0; out.dir = 'right'; out.q = 0; out.mi = 1; out.vert = 0;
      anchor(0, 1, v || FULL, A1);
      out.ax = A1.x; out.ay = A1.y; out.e = null; out.turning = 0;
      return out;
    }
    const e = list[i], p = i > 0 ? list[i - 1] : e;
    const t = e.len > 0 ? Math.max(0, Math.min(1, (x - e.x) / e.len)) : 1;
    const k = ease(t);
    out.a = (p.q + (e.q - p.q) * k) * HALF_PI;
    out.m = p.m + (e.m - p.m) * k;
    out.t = t; out.k = k; out.i = i; out.e = e;
    out.turning = t > 0 && t < 1 ? 1 : 0;
    const dom = k < 0.5 ? p : e;
    out.dir = dom.dir; out.q = dom.q; out.mi = dom.m;
    out.vert = Math.abs(Math.sin(out.a));
    anchor(p.q, p.m, v || FULL, A0);
    anchor(e.q, e.m, v || FULL, A1);
    out.ax = A0.x + (A1.x - A0.x) * k;
    out.ay = A0.y + (A1.y - A0.y) * k;
    return out;
  }

  /* screen vectors of a whole view: forward f and away-from-floor u */
  function vectors(q, m, out) {
    const c = q === 0 ? 1 : 0, s = q;
    out = out || {};
    out.fx = c * m; out.fy = s * m;
    out.ux = s; out.uy = -c;
    return out;
  }

  const VEC = {};
  const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

  /* the move a screen direction means in a view: away from the floor jumps, toward it slides,
     along the run dashes; back against the run is `back` (nothing for keys, slide for swipes) */
  function moveFor(dx, dy, q, m, back) {
    vectors(q, m, VEC);
    if (dx === VEC.ux && dy === VEC.uy) return 'jump';
    if (dx === -VEC.ux && dy === -VEC.uy) return 'slide';
    if (dx === VEC.fx && dy === VEC.fy) return 'dash';
    return back || null;
  }

  function arrowMove(code, q, m) {
    const d = ARROWS[code];
    return d ? moveFor(d[0], d[1], q, m, null) : null;
  }

  /* a swipe (screen delta) to a move */
  function swipeMove(dx, dy, q, m) {
    if (Math.abs(dy) >= Math.abs(dx)) return moveFor(0, dy > 0 ? 1 : -1, q, m, 'slide');
    return moveFor(dx > 0 ? 1 : -1, 0, q, m, 'slide');
  }

  /* the arrow glyph that points along a screen vector */
  function arrowGlyph(dx, dy) {
    return dx < 0 ? '←' : dx > 0 ? '→' : dy < 0 ? '↑' : '↓';
  }

  Object.assign(NS.orient, {
    DIRS, VERT, OPP, PRE, TURN, POST, VERT_ZOOM, resolve, first, entry, indexAt, ease, anchor, at, vectors, moveFor,
    arrowMove, swipeMove, arrowGlyph
  });
})();
