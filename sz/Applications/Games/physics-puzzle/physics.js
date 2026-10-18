;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Rigid-body physics for the Physics Puzzle. Circles and convex polygons
   * with mass, rotation, restitution and friction per material; separating-
   * axis collision with clipped two-point manifolds (after Randy Gaul's
   * Impulse Engine), sequential impulses with accumulated clamping, linear
   * position projection and per-body sleeping. On top of the solver sit the
   * puzzle gadgets: springs and bumpers, conveyor surfaces, glass that
   * shatters, TNT that explodes, kinematic paddles, sensors, and force zones
   * (fans, water, magnets, portals) plus rope joints.
   *
   * Fixed step (STEP seconds), no randomness and a fixed iteration order, so
   * the same inputs always give the same result. Units are pixels and seconds,
   * y grows downward. Pure logic: no DOM.
   */

  const STEP = 1 / 240;
  const ITERATIONS = 8;
  const SLOP = 0.4;
  const PERCENT = 0.45;
  const REST_THRESHOLD = 55;     // slower impacts do not bounce
  const MAX_SPEED = 2600;
  const SLEEP_LINEAR = 9;
  const SLEEP_ANGULAR = 0.12;
  const SLEEP_TIME = 0.45;
  const WAKE_SPEED = 24;
  const MASS_SCALE = 1 / 1000;

  const MATERIALS = Object.freeze({
    wood: { rest: 0.32, fric: 0.55, density: 0.7 },
    metal: { rest: 0.28, fric: 0.32, density: 2.4 },
    stone: { rest: 0.22, fric: 0.7, density: 2.0 },
    rubber: { rest: 0.78, fric: 0.9, density: 1.0 },
    glass: { rest: 0.2, fric: 0.18, density: 1.2 },
    ice: { rest: 0.12, fric: 0.02, density: 0.9 },
    tnt: { rest: 0.2, fric: 0.6, density: 0.8 },
    ball: { rest: 0.5, fric: 0.35, density: 2.2 },
    sensor: { rest: 0, fric: 0, density: 1 }
  });

  /* ── vector helpers on plain numbers (no allocation in the hot loop) ── */

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /* ══════════════════════════════════════════════════════════════════
     SHAPES
     ══════════════════════════════════════════════════════════════════ */

  /* points: [[x, y], ...] around the centroid or not; returns { verts, norms, cx, cy, area, inertiaPerMass } */
  function polyShape(points) {
    let pts = points.map(p => [p[0], p[1]]);
    /* signed area, centroid */
    let area = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; ++i) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const cr = a[0] * b[1] - b[0] * a[1];
      area += cr;
      cx += (a[0] + b[0]) * cr;
      cy += (a[1] + b[1]) * cr;
    }
    area /= 2;
    cx /= 6 * area;
    cy /= 6 * area;
    /* winding: with y down, positive area means clockwise on screen; outward normal (dy, -dx) needs it */
    if (area < 0) {
      pts.reverse();
      area = -area;
    }
    pts = pts.map(p => [p[0] - cx, p[1] - cy]);
    const n = pts.length;
    const verts = new Float64Array(n * 2), norms = new Float64Array(n * 2);
    let inertia = 0, radius = 0;
    for (let i = 0; i < n; ++i) {
      const a = pts[i], b = pts[(i + 1) % n];
      verts[i * 2] = a[0];
      verts[i * 2 + 1] = a[1];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const len = Math.sqrt(ex * ex + ey * ey) || 1;
      norms[i * 2] = ey / len;
      norms[i * 2 + 1] = -ex / len;
      const cr = Math.abs(a[0] * b[1] - b[0] * a[1]);
      inertia += cr * (a[0] * a[0] + a[0] * b[0] + b[0] * b[0] + a[1] * a[1] + a[1] * b[1] + b[1] * b[1]);
      radius = Math.max(radius, Math.sqrt(a[0] * a[0] + a[1] * a[1]));
    }
    /* sum(cr * (...)) / 12 is the area moment; divided by the area it is per unit mass */
    const inertiaPerMass = inertia / 12 / Math.max(1e-9, area);
    return { verts: verts, norms: norms, count: n, cx: cx, cy: cy, area: area, inertiaPerMass: inertiaPerMass, radius: radius };
  }

  function boxPoints(w, h) {
    const hw = w / 2, hh = h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  }

  /* ══════════════════════════════════════════════════════════════════
     WORLD
     ══════════════════════════════════════════════════════════════════ */

  /*
   * opts: { gravity: [gx, gy], bounds: { x0, y0, x1, y1 } }  bodies leaving the
   * bounds are removed with a 'lost' event.
   */
  function createWorld(opts) {
    opts = opts || {};
    const g = opts.gravity || [0, 1200];
    const world = {
      gx: g[0], gy: g[1],
      bounds: opts.bounds || { x0: -200, y0: -1600, x1: 1480, y1: 800 },
      bodies: [],
      zones: [],
      joints: [],
      events: [],
      time: 0,
      steps: 0,
      nextId: 1,
      pendingBlasts: [],
      contacts: 0
    };
    return world;
  }

  /*
   * spec: {
   *   shape: 'circle' (r) | 'box' (w, h) | 'poly' (points),
   *   x, y, a, vx, vy, av (angular velocity),
   *   type: 'static' | 'dynamic' | 'kinematic',
   *   mat: material name, rest / fric overrides,
   *   tag, sensor, boost (spring/bumper outgoing speed), boostDir: 'up' | 'any',
   *   surface (conveyor speed along the local x axis), breakImpulse (glass),
   *   tnt: { radius, power }, motor: { spin } | { swing, amp, freq, phase },
   *   data: anything for the game
   * }
   */
  function addBody(world, spec) {
    const mat = MATERIALS[spec.mat || 'wood'] || MATERIALS.wood;
    const b = {
      id: world.nextId++,
      tag: spec.tag || '',
      type: spec.type || 'static',
      sensor: !!spec.sensor,
      alive: true,
      x: spec.x || 0, y: spec.y || 0, a: spec.a || 0,
      vx: spec.vx || 0, vy: spec.vy || 0, w: spec.av || 0,
      fx: 0, fy: 0,
      rest: spec.rest !== undefined ? spec.rest : mat.rest,
      fric: spec.fric !== undefined ? spec.fric : mat.fric,
      mat: spec.mat || 'wood',
      boost: spec.boost || 0,
      boostDir: spec.boostDir || 'up',
      surface: spec.surface || 0,
      breakImpulse: spec.breakImpulse || 0,
      tnt: spec.tnt || null,
      motor: spec.motor || null,
      a0: spec.a || 0,
      gravityScale: spec.gravityScale !== undefined ? spec.gravityScale : 1,
      sleeping: false, sleepTime: 0,
      portalCool: 0,
      data: spec.data || null,
      circle: false, r: 0, poly: null,
      wv: null, wn: null,
      x0: 0, y0: 0, x1: 0, y1: 0,
      invM: 0, invI: 0, mass: 0, inertia: 0,
      touches: 0,
      lastHitId: 0
    };
    let area, ipm;
    if (spec.shape === 'circle') {
      b.circle = true;
      b.r = spec.r;
      area = Math.PI * spec.r * spec.r;
      ipm = spec.r * spec.r / 2;
      b.radius = spec.r;
    } else {
      const shape = polyShape(spec.shape === 'box' ? boxPoints(spec.w, spec.h) : spec.points);
      b.poly = shape;
      if (spec.shape === 'poly') {
        /* points were given in local space around (x, y); keep the centroid at the body origin */
        const ca = Math.cos(b.a), sa = Math.sin(b.a);
        b.x += shape.cx * ca - shape.cy * sa;
        b.y += shape.cx * sa + shape.cy * ca;
      }
      area = shape.area;
      ipm = shape.inertiaPerMass;
      b.radius = shape.radius;
      b.wv = new Float64Array(shape.count * 2);
      b.wn = new Float64Array(shape.count * 2);
    }
    b.area = area;
    if (b.type === 'dynamic') {
      const density = spec.density !== undefined ? spec.density : mat.density;
      b.mass = area * density * MASS_SCALE;
      b.inertia = b.mass * ipm;
      b.invM = 1 / b.mass;
      b.invI = spec.fixedRotation ? 0 : 1 / b.inertia;
    }
    updateGeometry(b);
    world.bodies.push(b);
    return b;
  }

  function removeBody(world, b) {
    b.alive = false;
  }

  function updateGeometry(b) {
    if (b.circle) {
      b.x0 = b.x - b.r; b.y0 = b.y - b.r; b.x1 = b.x + b.r; b.y1 = b.y + b.r;
      return;
    }
    const ca = Math.cos(b.a), sa = Math.sin(b.a);
    const p = b.poly, v = p.verts, n = p.norms, wv = b.wv, wn = b.wn;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.count; ++i) {
      const lx = v[i * 2], ly = v[i * 2 + 1];
      const wx = b.x + lx * ca - ly * sa, wy = b.y + lx * sa + ly * ca;
      wv[i * 2] = wx;
      wv[i * 2 + 1] = wy;
      wn[i * 2] = n[i * 2] * ca - n[i * 2 + 1] * sa;
      wn[i * 2 + 1] = n[i * 2] * sa + n[i * 2 + 1] * ca;
      if (wx < x0) x0 = wx;
      if (wx > x1) x1 = wx;
      if (wy < y0) y0 = wy;
      if (wy > y1) y1 = wy;
    }
    b.x0 = x0; b.y0 = y0; b.x1 = x1; b.y1 = y1;
  }

  /* zones: { kind: 'fan', x, y, len, width, a, strength } (blows along angle a from (x, y)),
            { kind: 'water', x0, y0, x1, y1, density, drag },
            { kind: 'magnet', x, y, radius, strength } (negative repels),
            { kind: 'portal', ax, ay, aa, bx, by, ba, r } (enter either mouth, leave the other along its angle) */
  function addZone(world, z) {
    const zone = Object.assign({ id: world.nextId++, on: true }, z);
    world.zones.push(zone);
    return zone;
  }

  /* a rope or rod from a fixed anchor to a body's centre */
  function addJoint(world, j) {
    const joint = { ax: j.ax, ay: j.ay, body: j.body, len: j.len, rope: j.rope !== false, alive: true };
    world.joints.push(joint);
    return joint;
  }

  function wake(b) {
    if (b.type === 'dynamic') {
      b.sleeping = false;
      b.sleepTime = 0;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     COLLISION
     ══════════════════════════════════════════════════════════════════ */

  /* manifold: { a, b, nx, ny, count, px[2], py[2], pen[2] } with the normal from a to b */
  function makeManifold() {
    return { a: null, b: null, nx: 0, ny: 0, count: 0, px: [0, 0], py: [0, 0], pen: [0, 0],
      mn: [0, 0], mt: [0, 0], bias: [0, 0], pn: [0, 0], pt: [0, 0], rest: 0, fric: 0, sx: 0, sy: 0, approach: 0 };
  }

  function circleCircle(m, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const r = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r)
      return false;
    const d = Math.sqrt(d2);
    if (d < 1e-9) {
      m.nx = 0; m.ny = 1;
    } else {
      m.nx = dx / d; m.ny = dy / d;
    }
    m.count = 1;
    m.pen[0] = r - d;
    m.px[0] = a.x + m.nx * a.r;
    m.py[0] = a.y + m.ny * a.r;
    return true;
  }

  /* a circle against a polygon; normal points from the circle into the polygon */
  function circlePoly(m, c, p) {
    const wv = p.wv, wn = p.wn, n = p.poly.count;
    let sep = -Infinity, face = 0;
    for (let i = 0; i < n; ++i) {
      const s = wn[i * 2] * (c.x - wv[i * 2]) + wn[i * 2 + 1] * (c.y - wv[i * 2 + 1]);
      if (s > c.r)
        return false;
      if (s > sep) {
        sep = s;
        face = i;
      }
    }
    const i2 = (face + 1) % n;
    const v1x = wv[face * 2], v1y = wv[face * 2 + 1], v2x = wv[i2 * 2], v2y = wv[i2 * 2 + 1];
    if (sep < 1e-6) {
      m.nx = -wn[face * 2];
      m.ny = -wn[face * 2 + 1];
      m.count = 1;
      m.pen[0] = c.r - sep;
      m.px[0] = c.x + m.nx * c.r;
      m.py[0] = c.y + m.ny * c.r;
      return true;
    }
    const d1 = (c.x - v1x) * (v2x - v1x) + (c.y - v1y) * (v2y - v1y);
    const d2 = (c.x - v2x) * (v1x - v2x) + (c.y - v2y) * (v1y - v2y);
    let vx, vy;
    if (d1 <= 0) {
      vx = v1x; vy = v1y;
    } else if (d2 <= 0) {
      vx = v2x; vy = v2y;
    } else {
      m.nx = -wn[face * 2];
      m.ny = -wn[face * 2 + 1];
      m.count = 1;
      m.pen[0] = c.r - sep;
      m.px[0] = c.x + m.nx * (c.r - m.pen[0] / 2);
      m.py[0] = c.y + m.ny * (c.r - m.pen[0] / 2);
      return true;
    }
    const dx = vx - c.x, dy = vy - c.y;
    const dd = dx * dx + dy * dy;
    if (dd > c.r * c.r)
      return false;
    const d = Math.sqrt(dd) || 1e-9;
    m.nx = dx / d;
    m.ny = dy / d;
    m.count = 1;
    m.pen[0] = c.r - d;
    m.px[0] = vx;
    m.py[0] = vy;
    return true;
  }

  const axisOut = [0, 0];
  /* the face of A along which B penetrates least; returns separation (>= 0 means apart) */
  function leastPenetration(A, B) {
    const av = A.wv, an = A.wn, bv = B.wv, na = A.poly.count, nb = B.poly.count;
    let best = -Infinity, bestI = 0;
    for (let i = 0; i < na; ++i) {
      const nx = an[i * 2], ny = an[i * 2 + 1];
      /* support of B in direction -n */
      let min = Infinity;
      for (let k = 0; k < nb; ++k) {
        const d = bv[k * 2] * nx + bv[k * 2 + 1] * ny;
        if (d < min)
          min = d;
      }
      const s = min - (av[i * 2] * nx + av[i * 2 + 1] * ny);
      if (s > best) {
        best = s;
        bestI = i;
      }
    }
    axisOut[0] = best;
    axisOut[1] = bestI;
    return best;
  }

  const clipIn = [0, 0, 0, 0], clipOut = [0, 0, 0, 0];
  /* clips segment clipIn against n.p <= c into clipOut; returns the point count */
  function clip(nx, ny, c) {
    let sp = 0;
    const d1 = nx * clipIn[0] + ny * clipIn[1] - c;
    const d2 = nx * clipIn[2] + ny * clipIn[3] - c;
    if (d1 <= 0) {
      clipOut[sp * 2] = clipIn[0];
      clipOut[sp * 2 + 1] = clipIn[1];
      ++sp;
    }
    if (d2 <= 0) {
      clipOut[sp * 2] = clipIn[2];
      clipOut[sp * 2 + 1] = clipIn[3];
      ++sp;
    }
    if (d1 * d2 < 0 && sp < 2) {
      const t = d1 / (d1 - d2);
      clipOut[sp * 2] = clipIn[0] + t * (clipIn[2] - clipIn[0]);
      clipOut[sp * 2 + 1] = clipIn[1] + t * (clipIn[3] - clipIn[1]);
      ++sp;
    }
    clipIn[0] = clipOut[0]; clipIn[1] = clipOut[1]; clipIn[2] = clipOut[2]; clipIn[3] = clipOut[3];
    return sp;
  }

  function polyPoly(m, A, B) {
    if (leastPenetration(A, B) >= 0)
      return false;
    const pa = axisOut[0], fa = axisOut[1];
    if (leastPenetration(B, A) >= 0)
      return false;
    const pb = axisOut[0], fb = axisOut[1];
    let ref, inc, refI, flip;
    if (pa >= pb * 0.95 + pa * 0.01) {
      ref = A; inc = B; refI = fa; flip = false;
    } else {
      ref = B; inc = A; refI = fb; flip = true;
    }
    const rn = ref.wn, rv = ref.wv, rc = ref.poly.count;
    const nx = rn[refI * 2], ny = rn[refI * 2 + 1];
    /* incident face: the face of inc most anti-parallel to the reference normal */
    const inn = inc.wn, inv = inc.wv, ic = inc.poly.count;
    let incI = 0, minDot = Infinity;
    for (let i = 0; i < ic; ++i) {
      const d = nx * inn[i * 2] + ny * inn[i * 2 + 1];
      if (d < minDot) {
        minDot = d;
        incI = i;
      }
    }
    const i2 = (incI + 1) % ic;
    clipIn[0] = inv[incI * 2]; clipIn[1] = inv[incI * 2 + 1];
    clipIn[2] = inv[i2 * 2]; clipIn[3] = inv[i2 * 2 + 1];
    const r2 = (refI + 1) % rc;
    const v1x = rv[refI * 2], v1y = rv[refI * 2 + 1], v2x = rv[r2 * 2], v2y = rv[r2 * 2 + 1];
    let sx = v2x - v1x, sy = v2y - v1y;
    const sl = Math.sqrt(sx * sx + sy * sy) || 1;
    sx /= sl;
    sy /= sl;
    const neg = -(sx * v1x + sy * v1y);
    const pos = sx * v2x + sy * v2y;
    if (clip(-sx, -sy, neg) < 2)
      return false;
    if (clip(sx, sy, pos) < 2)
      return false;
    const refC = nx * v1x + ny * v1y;
    let count = 0;
    for (let k = 0; k < 2; ++k) {
      const px = clipIn[k * 2], py = clipIn[k * 2 + 1];
      const s = nx * px + ny * py - refC;
      if (s <= 0) {
        m.px[count] = px;
        m.py[count] = py;
        m.pen[count] = -s;
        ++count;
      }
    }
    if (!count)
      return false;
    m.count = count;
    m.nx = flip ? -nx : nx;
    m.ny = flip ? -ny : ny;
    return true;
  }

  function collide(m, a, b) {
    m.count = 0;
    if (a.circle && b.circle)
      return circleCircle(m, a, b);
    if (a.circle)
      return circlePoly(m, a, b);
    if (b.circle) {
      if (!circlePoly(m, b, a))
        return false;
      m.nx = -m.nx;
      m.ny = -m.ny;
      return true;
    }
    return polyPoly(m, a, b);
  }

  /* ══════════════════════════════════════════════════════════════════
     STEP
     ══════════════════════════════════════════════════════════════════ */

  const manifolds = [];
  let manifoldCount = 0;

  function nextManifold() {
    if (manifoldCount >= manifolds.length)
      manifolds.push(makeManifold());
    return manifolds[manifoldCount++];
  }

  function emit(world, type, d) {
    if (world.events.length < 400) {
      d.type = type;
      world.events.push(d);
    }
  }

  function isSolid(b) {
    return b.alive && !b.sensor;
  }

  function moving(b) {
    return b.type === 'dynamic' && !b.sleeping;
  }

  /* outgoing speed for a spring or bumper hit, 0 when the gadget does not fire */
  function boostFor(gadget, nx, ny, fromGadget) {
    if (!gadget.boost)
      return 0;
    if (gadget.boostDir === 'any')
      return gadget.boost;
    /* 'up' fires along the gadget's local -y axis */
    const ux = Math.sin(gadget.a), uy = -Math.cos(gadget.a);
    /* normal pointing from the gadget toward the other body */
    const ox = fromGadget ? nx : -nx, oy = fromGadget ? ny : -ny;
    return ux * ox + uy * oy > 0.7 ? gadget.boost : 0;
  }

  function applyImpulse(b, ix, iy, rx, ry) {
    b.vx += ix * b.invM;
    b.vy += iy * b.invM;
    b.w += (rx * iy - ry * ix) * b.invI;
  }

  /* a body counts as immovable while asleep against an awake one */
  function effInvM(b) {
    return b.type === 'dynamic' && !b.sleeping ? b.invM : 0;
  }

  function effInvI(b) {
    return b.type === 'dynamic' && !b.sleeping ? b.invI : 0;
  }

  function prepare(world, m, dt) {
    const a = m.a, b = m.b;
    const ima = effInvM(a), imb = effInvM(b), iia = effInvI(a), iib = effInvI(b);
    m.rest = Math.max(a.rest, b.rest);
    m.fric = Math.sqrt(a.fric * b.fric);
    /* conveyor surfaces move along their local x axis */
    m.sx = 0;
    m.sy = 0;
    if (a.surface) {
      m.sx += Math.cos(a.a) * a.surface;
      m.sy += Math.sin(a.a) * a.surface;
    }
    if (b.surface) {
      m.sx -= Math.cos(b.a) * b.surface;
      m.sy -= Math.sin(b.a) * b.surface;
    }
    const nx = m.nx, ny = m.ny, tx = -ny, ty = nx;
    const boostA = boostFor(a, nx, ny, true), boostB = boostFor(b, nx, ny, false);
    const boost = Math.max(boostA, boostB);
    let approach = 0;
    for (let k = 0; k < m.count; ++k) {
      const rax = m.px[k] - a.x, ray = m.py[k] - a.y, rbx = m.px[k] - b.x, rby = m.py[k] - b.y;
      const rnA = rax * ny - ray * nx, rnB = rbx * ny - rby * nx;
      const rtA = rax * ty - ray * tx, rtB = rbx * ty - rby * tx;
      const kn = ima + imb + iia * rnA * rnA + iib * rnB * rnB;
      const kt = ima + imb + iia * rtA * rtA + iib * rtB * rtB;
      m.mn[k] = kn > 0 ? 1 / kn : 0;
      m.mt[k] = kt > 0 ? 1 / kt : 0;
      const rvx = b.vx - b.w * rby - a.vx + a.w * ray;
      const rvy = b.vy + b.w * rbx - a.vy - a.w * rax;
      const vn = rvx * nx + rvy * ny;
      if (-vn > approach)
        approach = -vn;
      let bias = vn < -REST_THRESHOLD ? -m.rest * vn : 0;
      if (boost)
        bias = Math.max(bias, boost + 0);
      m.bias[k] = bias;
      m.pn[k] = 0;
      m.pt[k] = 0;
    }
    m.approach = approach;
    m.boosted = boost > 0;
  }

  function solveManifold(m) {
    const a = m.a, b = m.b;
    const ima = effInvM(a), imb = effInvM(b), iia = effInvI(a), iib = effInvI(b);
    const nx = m.nx, ny = m.ny, tx = -ny, ty = nx;
    for (let k = 0; k < m.count; ++k) {
      const rax = m.px[k] - a.x, ray = m.py[k] - a.y, rbx = m.px[k] - b.x, rby = m.py[k] - b.y;
      let rvx = b.vx - b.w * rby - a.vx + a.w * ray;
      let rvy = b.vy + b.w * rbx - a.vy - a.w * rax;
      /* normal */
      const vn = rvx * nx + rvy * ny;
      let dp = m.mn[k] * (m.bias[k] - vn);
      const p0 = m.pn[k];
      m.pn[k] = Math.max(p0 + dp, 0);
      dp = m.pn[k] - p0;
      let ix = dp * nx, iy = dp * ny;
      a.vx -= ix * ima; a.vy -= iy * ima; a.w -= (rax * iy - ray * ix) * iia;
      b.vx += ix * imb; b.vy += iy * imb; b.w += (rbx * iy - rby * ix) * iib;
      /* friction, relative to a moving conveyor surface */
      rvx = b.vx - b.w * rby - a.vx + a.w * ray - m.sx;
      rvy = b.vy + b.w * rbx - a.vy - a.w * rax - m.sy;
      const vt = rvx * tx + rvy * ty;
      let dt = m.mt[k] * -vt;
      const maxF = m.fric * m.pn[k];
      const t0 = m.pt[k];
      m.pt[k] = clamp(t0 + dt, -maxF, maxF);
      dt = m.pt[k] - t0;
      ix = dt * tx;
      iy = dt * ty;
      a.vx -= ix * ima; a.vy -= iy * ima; a.w -= (rax * iy - ray * ix) * iia;
      b.vx += ix * imb; b.vy += iy * imb; b.w += (rbx * iy - rby * ix) * iib;
    }
  }

  function correct(m) {
    const a = m.a, b = m.b;
    const ima = effInvM(a), imb = effInvM(b);
    const sum = ima + imb;
    if (sum <= 0)
      return;
    let pen = 0;
    for (let k = 0; k < m.count; ++k)
      if (m.pen[k] > pen)
        pen = m.pen[k];
    const c = Math.max(pen - SLOP, 0) / sum * PERCENT;
    if (c <= 0)
      return;
    a.x -= m.nx * c * ima;
    a.y -= m.ny * c * ima;
    b.x += m.nx * c * imb;
    b.y += m.ny * c * imb;
  }

  /* ── force zones ── */

  function applyZones(world, dt) {
    const zones = world.zones, bodies = world.bodies;
    for (let zi = 0; zi < zones.length; ++zi) {
      const z = zones[zi];
      if (!z.on)
        continue;
      for (let i = 0; i < bodies.length; ++i) {
        const b = bodies[i];
        if (!b.alive || b.type !== 'dynamic' || b.sensor)
          continue;
        if (z.kind === 'fan') {
          const ux = Math.cos(z.a), uy = Math.sin(z.a);
          const dx = b.x - z.x, dy = b.y - z.y;
          const along = dx * ux + dy * uy, side = -dx * uy + dy * ux;
          if (along < 0 || along > z.len || Math.abs(side) > z.width / 2)
            continue;
          const f = z.strength * (1 - 0.6 * along / z.len);
          wake(b);
          b.vx += ux * f * dt;
          b.vy += uy * f * dt;
        } else if (z.kind === 'water') {
          if (b.x < z.x0 || b.x > z.x1 || b.y + b.radius < z.y0 || b.y > z.y1 + b.radius)
            continue;
          const depth = clamp((b.y + b.radius - z.y0) / (2 * b.radius), 0, 1);
          wake(b);
          /* buoyancy against gravity, scaled by how deep the body sits */
          b.vy -= world.gy * (z.density || 1.6) * depth * dt;
          const drag = Math.max(0, 1 - (z.drag || 2.4) * depth * dt);
          b.vx *= drag;
          b.vy *= drag;
          b.w *= drag;
          if (!b.wet && depth > 0.2) {
            b.wet = true;
            emit(world, 'splash', { x: b.x, y: z.y0, speed: Math.abs(b.vy), body: b });
          }
        } else if (z.kind === 'magnet') {
          if (b.tag !== 'ball' && b.mat !== 'metal')
            continue;
          const dx = z.x - b.x, dy = z.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > z.radius || d < 1)
            continue;
          const f = z.strength * (1 - d / z.radius);
          wake(b);
          b.vx += dx / d * f * dt;
          b.vy += dy / d * f * dt;
        } else if (z.kind === 'portal') {
          if (b.portalCool > 0 || !b.circle)
            continue;
          for (let side = 0; side < 2; ++side) {
            const px = side ? z.bx : z.ax, py = side ? z.by : z.ay;
            const dx = b.x - px, dy = b.y - py;
            if (dx * dx + dy * dy > z.r * z.r)
              continue;
            const ox = side ? z.ax : z.bx, oy = side ? z.ay : z.by, oa = side ? z.aa : z.ba;
            const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
            const ux = Math.cos(oa), uy = Math.sin(oa);
            b.x = ox + ux * (z.r * 0.6);
            b.y = oy + uy * (z.r * 0.6);
            b.vx = ux * sp;
            b.vy = uy * sp;
            b.portalCool = 0.3;
            emit(world, 'portal', { x: px, y: py, x2: ox, y2: oy, body: b });
            break;
          }
        }
      }
    }
  }

  function solveJoints(world, dt) {
    for (const j of world.joints) {
      const b = j.body;
      if (!j.alive || !b.alive || b.type !== 'dynamic')
        continue;
      const dx = b.x - j.ax, dy = b.y - j.ay;
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-9;
      const c = d - j.len;
      if (j.rope && c <= 0)
        continue;
      const nx = dx / d, ny = dy / d;
      const vn = b.vx * nx + b.vy * ny;
      const target = -0.2 * c / dt;
      const dv = target - vn;
      if (j.rope && dv > 0 && c <= 0)
        continue;
      b.vx += nx * dv;
      b.vy += ny * dv;
    }
  }

  function explode(world, x, y, radius, power, source) {
    emit(world, 'explode', { x: x, y: y, radius: radius, body: source });
    for (const b of world.bodies) {
      if (!b.alive || b === source || b.sensor)
        continue;
      const dx = b.x - x, dy = b.y - y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-9;
      if (d > radius + b.radius)
        continue;
      const k = 1 - Math.min(1, Math.max(0, d - b.radius * 0.5) / radius);
      if (b.breakImpulse) {
        breakGlass(world, b, x, y);
        continue;
      }
      if (b.tnt && !b.fuse) {
        b.fuse = 0.12;
        continue;
      }
      if (b.type !== 'dynamic')
        continue;
      wake(b);
      const dv = power * k;
      b.vx += dx / d * dv;
      b.vy += dy / d * dv;
      b.w += (dx >= 0 ? 1 : -1) * k * 2.5;
    }
  }

  function breakGlass(world, b, hx, hy) {
    if (!b.alive)
      return;
    b.alive = false;
    emit(world, 'break', { x: b.x, y: b.y, hx: hx, hy: hy, body: b });
  }

  function detonate(world, b) {
    if (!b.alive)
      return;
    b.alive = false;
    explode(world, b.x, b.y, b.tnt.radius || 160, b.tnt.power || 900, b);
  }

  function step(world) {
    const dt = STEP;
    const bodies = world.bodies;
    world.time += dt;
    ++world.steps;

    /* kinematic motors */
    for (let i = 0; i < bodies.length; ++i) {
      const b = bodies[i];
      if (b.type !== 'kinematic' || !b.alive || !b.motor)
        continue;
      const mo = b.motor;
      if (mo.spin !== undefined) {
        b.w = mo.spin;
      } else if (mo.swing !== undefined) {
        const ph = world.time * mo.freq * Math.PI * 2 + (mo.phase || 0);
        const target = b.a0 + mo.amp * Math.sin(ph);
        b.w = (target - b.a) / dt;
      }
    }

    /* forces */
    for (let i = 0; i < bodies.length; ++i) {
      const b = bodies[i];
      if (!b.alive || b.type !== 'dynamic' || b.sleeping)
        continue;
      b.vx += world.gx * b.gravityScale * dt;
      b.vy += world.gy * b.gravityScale * dt;
      if (b.portalCool > 0)
        b.portalCool -= dt;
    }
    applyZones(world, dt);

    /* narrow phase over all pairs that can interact */
    manifoldCount = 0;
    const n = bodies.length;
    for (let i = 0; i < n; ++i) {
      const a = bodies[i];
      if (!a.alive)
        continue;
      for (let k = i + 1; k < n; ++k) {
        const b = bodies[k];
        if (!b.alive)
          continue;
        const am = moving(a), bm = moving(b);
        if (!am && !bm)
          continue;
        if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0)
          continue;
        const m = nextManifold();
        if (!collide(m, a, b)) {
          --manifoldCount;
          continue;
        }
        m.a = a;
        m.b = b;
        if (a.sensor || b.sensor) {
          --manifoldCount;
          const s = a.sensor ? a : b, o = a.sensor ? b : a;
          if (o.type === 'dynamic' && !o.sensor)
            emit(world, 'sensor', { sensor: s, body: o, x: s.x, y: s.y });
          continue;
        }
        /* wake sleepers that are hit hard enough */
        if (a.sleeping || b.sleeping) {
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          if (rvx * rvx + rvy * rvy > WAKE_SPEED * WAKE_SPEED || a.type === 'kinematic' || b.type === 'kinematic') {
            wake(a);
            wake(b);
          }
        }
      }
    }

    for (let i = 0; i < manifoldCount; ++i)
      prepare(world, manifolds[i], dt);

    /* gadgets react to the approach: glass shatters, TNT goes off, impacts are reported */
    for (let i = 0; i < manifoldCount; ++i) {
      const m = manifolds[i];
      const a = m.a, b = m.b;
      const glass = a.breakImpulse ? a : b.breakImpulse ? b : null;
      if (glass && glass.alive) {
        const other = glass === a ? b : a;
        const mass = other.type === 'dynamic' ? other.mass : 0;
        if (m.approach * mass >= glass.breakImpulse) {
          breakGlass(world, glass, m.px[0], m.py[0]);
          other.vx *= 0.82;
          other.vy *= 0.82;
          m.count = 0;
          continue;
        }
      }
      const tnt = a.tnt ? a : b.tnt ? b : null;
      if (tnt && !tnt.fuse && m.approach > (tnt.tnt.trigger || 320)) {
        tnt.fuse = 0.06;
      }
      if (m.approach > 70 && world.steps - (a.lastHit === b.id ? a.lastHitStep : -999) > 12) {
        a.lastHit = b.id;
        a.lastHitStep = world.steps;
        emit(world, m.boosted ? 'boost' : 'impact', { a: a, b: b, x: m.px[0], y: m.py[0], nx: m.nx, ny: m.ny, speed: m.approach });
      } else if (m.boosted && world.steps - (a.lastHit === b.id ? a.lastHitStep : -999) > 12) {
        a.lastHit = b.id;
        a.lastHitStep = world.steps;
        emit(world, 'boost', { a: a, b: b, x: m.px[0], y: m.py[0], nx: m.nx, ny: m.ny, speed: m.approach });
      }
      ++a.touches;
      ++b.touches;
    }

    for (let it = 0; it < ITERATIONS; ++it) {
      for (let i = 0; i < manifoldCount; ++i)
        if (manifolds[i].count)
          solveManifold(manifolds[i]);
      if (world.joints.length)
        solveJoints(world, dt);
    }

    /* integrate */
    for (let i = 0; i < n; ++i) {
      const b = bodies[i];
      if (!b.alive)
        continue;
      if (b.type === 'kinematic') {
        b.a += b.w * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        updateGeometry(b);
        continue;
      }
      if (b.type !== 'dynamic' || b.sleeping)
        continue;
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 > MAX_SPEED * MAX_SPEED) {
        const k = MAX_SPEED / Math.sqrt(sp2);
        b.vx *= k;
        b.vy *= k;
      }
      const lin = 1 / (1 + dt * 0.04);
      b.vx *= lin;
      b.vy *= lin;
      b.w *= 1 / (1 + dt * (b.circle ? 0.35 : 0.8));
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += b.w * dt;
      updateGeometry(b);
    }

    for (let i = 0; i < manifoldCount; ++i)
      if (manifolds[i].count)
        correct(manifolds[i]);
    for (let i = 0; i < n; ++i) {
      const b = bodies[i];
      if (b.alive && b.type === 'dynamic' && !b.sleeping)
        updateGeometry(b);
    }

    /* fuses, sleeping, bounds */
    const bd = world.bounds;
    for (let i = 0; i < n; ++i) {
      const b = bodies[i];
      if (!b.alive)
        continue;
      if (b.fuse) {
        b.fuse -= dt;
        if (b.fuse <= 0)
          detonate(world, b);
        continue;
      }
      if (b.type !== 'dynamic')
        continue;
      if (b.x < bd.x0 || b.x > bd.x1 || b.y < bd.y0 || b.y > bd.y1) {
        b.alive = false;
        emit(world, 'lost', { body: b, x: b.x, y: b.y });
        continue;
      }
      if (b.sleeping)
        continue;
      if (b.vx * b.vx + b.vy * b.vy < SLEEP_LINEAR * SLEEP_LINEAR && Math.abs(b.w) < SLEEP_ANGULAR) {
        b.sleepTime += dt;
        if (b.sleepTime > SLEEP_TIME) {
          b.sleeping = true;
          b.vx = b.vy = b.w = 0;
          emit(world, 'sleep', { body: b, x: b.x, y: b.y });
        }
      } else {
        b.sleepTime = 0;
      }
    }

    /* drop dead bodies from the list now and then to keep the loops short */
    if (world.steps % 60 === 0) {
      let w = 0;
      for (let i = 0; i < bodies.length; ++i)
        if (bodies[i].alive)
          bodies[w++] = bodies[i];
      bodies.length = w;
    }
    world.contacts = manifoldCount;
  }

  /* do two bodies overlap (touching counts)? for placement checks */
  const overlapManifold = makeManifold();
  function overlap(a, b, margin) {
    const mg = margin || 0;
    if (a.x1 + mg < b.x0 || b.x1 + mg < a.x0 || a.y1 + mg < b.y0 || b.y1 + mg < a.y0)
      return false;
    if (!collide(overlapManifold, a, b))
      return false;
    for (let k = 0; k < overlapManifold.count; ++k)
      if (overlapManifold.pen[k] > -mg)
        return true;
    return overlapManifold.count > 0;
  }

  /* any awake dynamic body left? */
  function settled(world) {
    for (const b of world.bodies)
      if (b.alive && b.type === 'dynamic' && !b.sleeping && !b.sensor)
        return false;
    for (const b of world.bodies)
      if (b.alive && b.fuse)
        return false;
    return true;
  }

  function takeEvents(world) {
    const e = world.events;
    world.events = [];
    return e;
  }

  /* total kinetic + potential energy of the dynamic bodies, for tests */
  function energy(world) {
    let e = 0;
    for (const b of world.bodies) {
      if (!b.alive || b.type !== 'dynamic')
        continue;
      e += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy) + 0.5 * b.inertia * b.w * b.w - b.mass * (world.gy * b.y + world.gx * b.x);
    }
    return e;
  }

  /* a compact fingerprint of the dynamic state, for determinism checks */
  function hash(world) {
    let h = 2166136261 >>> 0;
    for (const b of world.bodies) {
      if (!b.alive)
        continue;
      const vals = [b.x, b.y, b.a, b.vx, b.vy];
      for (const v of vals) {
        const q = Math.round(v * 1000) | 0;
        h ^= q;
        h = Math.imul(h, 16777619) >>> 0;
      }
    }
    return h;
  }

  /* world vertices of a polygon body as [[x, y], ...] */
  function vertices(b) {
    const out = [];
    for (let i = 0; i < b.poly.count; ++i)
      out.push([b.wv[i * 2], b.wv[i * 2 + 1]]);
    return out;
  }

  /* first intersection of a ray with any solid body; for aim guides. returns { t, x, y, nx, ny, body } or null */
  function raycast(world, ox, oy, dx, dy, maxT, radius, skip) {
    let best = null, bestT = maxT;
    const r = radius || 0;
    for (const b of world.bodies) {
      if (!b.alive || b.sensor || b === skip)
        continue;
      if (b.circle) {
        const R = b.r + r;
        const fx = ox - b.x, fy = oy - b.y;
        const bb = fx * dx + fy * dy, cc = fx * fx + fy * fy - R * R;
        const disc = bb * bb - cc;
        if (disc < 0)
          continue;
        const t = -bb - Math.sqrt(disc);
        if (t >= 0 && t < bestT) {
          bestT = t;
          const hx = ox + dx * t, hy = oy + dy * t;
          best = { t: t, x: hx, y: hy, nx: (hx - b.x) / R, ny: (hy - b.y) / R, body: b };
        }
      } else {
        /* expanded polygon: clip the ray against each face plane pushed out by r */
        let tIn = 0, tOut = bestT, nIn = -1;
        const wv = b.wv, wn = b.wn;
        let hit = true;
        for (let i = 0; i < b.poly.count; ++i) {
          const nx = wn[i * 2], ny = wn[i * 2 + 1];
          const dist = nx * (ox - wv[i * 2]) + ny * (oy - wv[i * 2 + 1]) - r;
          const den = nx * dx + ny * dy;
          if (Math.abs(den) < 1e-12) {
            if (dist > 0) { hit = false; break; }
            continue;
          }
          const t = -dist / den;
          if (den < 0) {
            if (t > tIn) { tIn = t; nIn = i; }
          } else if (t < tOut) {
            tOut = t;
          }
          if (tIn > tOut) { hit = false; break; }
        }
        if (hit && nIn >= 0 && tIn < bestT) {
          bestT = tIn;
          best = { t: tIn, x: ox + dx * tIn, y: oy + dy * tIn, nx: wn[nIn * 2], ny: wn[nIn * 2 + 1], body: b };
        }
      }
    }
    return best;
  }

  SZ.PhysicsPuzzlePhysics = Object.freeze({
    STEP: STEP, MATERIALS: MATERIALS, MAX_SPEED: MAX_SPEED,
    createWorld: createWorld, addBody: addBody, removeBody: removeBody, addZone: addZone, addJoint: addJoint,
    step: step, settled: settled, takeEvents: takeEvents, energy: energy, hash: hash, vertices: vertices,
    raycast: raycast, overlap: overlap, explode: explode, wake: wake, updateGeometry: updateGeometry, polyShape: polyShape, boxPoints: boxPoints
  });
})();
