/* Escort rules as pure functions: the four trading posts at the belt edges (placed by the seed),
   the lanes from the dock to them with seeded bends, points and distances along a lane, choke
   points where ambushes wait, where each freighter of a schedule goes ('near', 'far', 'opp',
   'side', 'side2'), the pay for a delivery by the cargo still aboard (none under half) and the
   cargo latched skimmers drain. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const POSTS = [
    { id: 'n', name: 'Halden Post', opp: 's' },
    { id: 'e', name: 'Ochre Spire', opp: 'w' },
    { id: 's', name: 'Bracken Yard', opp: 'n' },
    { id: 'w', name: 'Cinder Hook', opp: 'e' },
  ];
  /* hp, speed in px/s, radius; drain: cargo share per second per latched skimmer, take: what
     one skimmer carries off; storm: speed factor in an active storm; reach and slow: how close
     and how slow the ship hands over ore; margin: posts from the belt edge; min: the cargo share
     a post accepts - one that docks with less voids its contract; leash: how close the ship must
     be for a freighter to fly on; raidFirst, raidEvery: seconds alone before pirates raid it;
     patience: seconds a due freighter waits at the dock for its escort before it leaves alone */
  const FREIGHTER = { hp: 320, speed: 48, r: 34, drain: 0.05, take: 0.15, storm: 0.5, reach: 170, slow: 140, margin: 380, min: 0.5, leash: 1200, raidFirst: 12, raidEvery: 20, patience: 120 };

  /* cruising speed in a belt of width w: the lanes grow with the belt, so freighters fly faster
     and a run takes as long as in the classic sector */
  function pace(w) {
    return FREIGHTER.speed * Math.max(1, (w || 6400) / 6400);
  }

  function posts(rnd, w, h, dock) {
    const m = FREIGHTER.margin;
    return POSTS.map(p => {
      const j = (rnd() - 0.5) * 0.9;
      let x, y;
      if (p.id === 'n' || p.id === 's') { x = dock.x + j * (w / 2 - m); y = p.id === 'n' ? m : h - m; }
      else { x = p.id === 'w' ? m : w - m; y = dock.y + j * (h / 2 - m); }
      return { id: p.id, name: p.name, opp: p.opp, x: Math.round(x), y: Math.round(y) };
    });
  }

  /* dock to post: off the dock ring, two bends to the side, short of the post's pad */
  function lane(dock, post, rnd) {
    const dx = post.x - dock.x, dy = post.y - dock.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const out = [{ x: dock.x + ux * 190, y: dock.y + uy * 190 }];
    const sign = rnd() < 0.5 ? -1 : 1;
    for (let k = 1; k <= 2; ++k) {
      const off = sign * (k === 1 ? 1 : -0.6) * (160 + rnd() * 220);
      const t = k / 3;
      out.push({ x: dock.x + dx * t + nx * off, y: dock.y + dy * t + ny * off });
    }
    out.push({ x: post.x - ux * 110, y: post.y - uy * 110 });
    return out;
  }

  function length(path) {
    let n = 0;
    for (let i = 1; i < path.length; ++i) n += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    return n;
  }

  /* the point d along the path, facing along it */
  function at(path, d, out) {
    out = out || {};
    for (let i = 1; i < path.length; ++i) {
      const a = path[i - 1], b = path[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= seg || i === path.length - 1) {
        const t = seg ? Math.max(0, Math.min(1, d / seg)) : 1;
        out.x = a.x + (b.x - a.x) * t;
        out.y = a.y + (b.y - a.y) * t;
        out.angle = Math.atan2(b.y - a.y, b.x - a.x);
        return out;
      }
      d -= seg;
    }
    out.x = path[0].x; out.y = path[0].y; out.angle = 0;
    return out;
  }

  /* the distance from a point to the path */
  function distance(path, x, y) {
    let best = Infinity;
    for (let i = 1; i < path.length; ++i) {
      const a = path[i - 1], b = path[i];
      const vx = b.x - a.x, vy = b.y - a.y;
      const q = vx * vx + vy * vy;
      const t = q ? Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / q)) : 0;
      best = Math.min(best, Math.hypot(x - a.x - vx * t, y - a.y - vy * t));
    }
    return best;
  }

  /* n choke points between 30% and 85% of the way, in order, spread apart */
  function chokes(path, n, rnd) {
    const len = length(path), out = [];
    for (let i = 0; i < n; ++i) {
      const lo = 0.3 + 0.55 * i / n, hi = 0.3 + 0.55 * (i + 1) / n;
      const d = len * (lo + (hi - lo) * (0.2 + rnd() * 0.6));
      const p = at(path, d);
      out.push({ d: d, x: p.x, y: p.y });
    }
    return out;
  }

  /* the post each token names: near and far by lane length from the dock, opp across from
     near, side and side2 the other two (the nearer first) */
  function resolve(tokens, list, dock) {
    const dist = p => Math.hypot(p.x - dock.x, p.y - dock.y);
    const sorted = list.slice().sort((a, b) => dist(a) - dist(b));
    const near = sorted[0];
    const opp = list.find(p => p.id === near.opp);
    const rest = sorted.filter(p => p !== near && p !== opp);
    const by = { near: near, far: sorted[sorted.length - 1], opp: opp, side: rest[0], side2: rest[1] || rest[0] };
    return tokens.map(t => by[t] || near);
  }

  /* the fee times the cargo share still aboard; nothing under the share a post accepts */
  function pay(fee, cargo) {
    return cargo < FREIGHTER.min ? 0 : Math.round(fee * Math.max(0, Math.min(1, cargo)));
  }

  function accepted(cargo) {
    return cargo >= FREIGHTER.min;
  }

  /* what n latched skimmers drain in dt, never more than is aboard */
  function drain(cargo, n, dt) {
    return Math.max(0, Math.min(cargo, FREIGHTER.drain * n * dt));
  }

  Object.assign(NS.escort, {
    POSTS, FREIGHTER, pace, posts, lane, length, at, distance, chokes, resolve, pay, accepted, drain
  });
})();
