/* Unit orders: issuing move, attack-move, attack, escort, patrol, hold, mine, return, repair
   and purge to a selection - shaped into the chosen formation around the target point, facing
   the way the group travels, kept at the slowest member's speed - either replacing each unit's
   queue or appended as a waypoint; where a unit should head for its current order, and when an
   order is done (patrols bounce between their ends forever). Pure: works on unit objects. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const F = NS.formations;

  const ARRIVE = 14;
  const TARGETED = { attack: 1, escort: 1, repair: 1, purge: 1 };

  /* where the group will be when the queue so far is done (for chaining waypoints) */
  function lastPoint(units) {
    let x = 0, y = 0;
    for (let i = 0; i < units.length; ++i) {
      const u = units[i];
      const q = u.orders && u.orders.length ? u.orders[u.orders.length - 1] : null;
      if (q && typeof q.x === 'number' && !TARGETED[q.kind]) { x += q.x; y += q.y; }
      else { x += u.x; y += u.y; }
    }
    return { x: x / units.length, y: y / units.length };
  }

  /* Give units an order. opts: { x, y, target, queue, formation, home } -> the orders made */
  function issue(units, kind, opts) {
    opts = opts || {};
    const n = units.length;
    if (!n) return [];
    const form = opts.formation || 'wedge';
    const from = opts.queue ? lastPoint(units) : F.centroid(units);
    const speed = F.groupSpeed(units);
    const sp = F.spacing(units);
    const made = [];
    let tx = opts.x, ty = opts.y;
    if (kind === 'return' && opts.home) { tx = opts.home.x; ty = opts.home.y; }
    if (TARGETED[kind] && opts.target) { tx = opts.target.x; ty = opts.target.y; }
    let facing = Math.atan2(ty - from.y, tx - from.x);
    if (!isFinite(facing) || (Math.abs(ty - from.y) + Math.abs(tx - from.x) < 1)) facing = opts.facing || -Math.PI / 2;
    if (kind === 'attack' || kind === 'repair' || kind === 'purge') {
      for (let i = 0; i < n; ++i) made.push({ kind: kind, target: opts.target, x: tx, y: ty, speed: speed });
    } else if (kind === 'escort') {
      const loc = F.slots(form, n, sp);
      const back = (opts.target.r || 20) + sp;
      const pts = [];
      for (let i = 0; i < n; ++i) pts.push(F.place({ x: loc[i].x - back, y: loc[i].y }, opts.target.x, opts.target.y, opts.target.angle || 0));
      const pick = F.assign(units, pts);
      for (let i = 0; i < n; ++i) made.push({ kind: 'escort', target: opts.target, ox: loc[pick[i]].x - back, oy: loc[pick[i]].y, formation: form, speed: speed });
    } else {
      const pts = F.worldSlots(form, n, tx, ty, facing, sp);
      const pick = F.assign(units, pts);
      let starts = null;
      if (kind === 'patrol') starts = F.worldSlots(form, n, from.x, from.y, facing + Math.PI, sp);
      for (let i = 0; i < n; ++i) {
        const p = pts[pick[i]];
        const o = { kind: kind, x: p.x, y: p.y, formation: form, speed: speed, facing: facing };
        if (kind === 'patrol') {
          const s = starts[pick[i]];
          o.ax = s.x; o.ay = s.y; o.bx = p.x; o.by = p.y; o.leg = 1;
        }
        made.push(o);
      }
    }
    for (let i = 0; i < n; ++i) {
      const u = units[i];
      if (!u.orders) u.orders = [];
      if (opts.queue) u.orders.push(made[i]);
      else u.orders = [made[i]];
    }
    return made;
  }

  /* the point a unit heads for under order o */
  function point(u, o, out) {
    out = out || {};
    if (o.kind === 'escort') {
      const t = o.target;
      F.place({ x: o.ox, y: o.oy }, t.x, t.y, t.angle || 0, out);
    } else if (TARGETED[o.kind]) {
      out.x = o.target.x;
      out.y = o.target.y;
    } else if (o.kind === 'patrol') {
      out.x = o.leg ? o.bx : o.ax;
      out.y = o.leg ? o.by : o.ay;
    } else {
      out.x = o.x;
      out.y = o.y;
    }
    return out;
  }

  const tmp = {};

  /* Advance a unit's queue when its order is done; returns the current order (or null) */
  function current(u) {
    while (u.orders && u.orders.length) {
      const o = u.orders[0];
      if (TARGETED[o.kind] && (!o.target || o.target.alive === false || (o.kind === 'repair' && o.target.hp >= o.target.maxHp) ||
          (o.kind === 'purge' && !o.target.cor && !o.target.inf && !o.target.rogue))) {
        u.orders.shift();
        continue;
      }
      if (o.kind === 'move' || o.kind === 'amove' || o.kind === 'return') {
        point(u, o, tmp);
        if ((u.x - tmp.x) * (u.x - tmp.x) + (u.y - tmp.y) * (u.y - tmp.y) < ARRIVE * ARRIVE) {
          u.orders.shift();
          continue;
        }
      } else if (o.kind === 'patrol') {
        point(u, o, tmp);
        if ((u.x - tmp.x) * (u.x - tmp.x) + (u.y - tmp.y) * (u.y - tmp.y) < ARRIVE * ARRIVE) o.leg = o.leg ? 0 : 1;
      }
      return o;
    }
    return null;
  }

  function clear(u) {
    if (u.orders) u.orders.length = 0;
  }

  Object.assign(NS.orders, {
    ARRIVE, issue, point, current, clear, lastPoint
  });
})();
