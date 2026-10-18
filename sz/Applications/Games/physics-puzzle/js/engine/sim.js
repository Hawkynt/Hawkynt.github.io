;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * The puzzle rules on top of the physics: an attempt builds a world from
   * the level's fixtures and the player's parts; each shot fires the ball (or
   * a spread of balls) from the launcher and steps until every target is
   * lit, or the balls are gone, stuck or out of time and the world has come
   * to rest. The world carries over from shot to shot. Also replays stored
   * solutions and builds the seeded Daily challenge from a level's solution
   * path. Deterministic and pure: the game, the tests and the solver tools
   * all run the same code.
   */

  const Ph = SZ.PhysicsPuzzlePhysics;
  const Parts = SZ.PhysicsPuzzleParts;
  const DEG = Math.PI / 180;

  const MAX_TIME = 12;            // seconds a shot may run
  const STUCK_TIME = 2.5;         // a ball crawling this long counts as stopped
  const SETTLE_TIME = 4;          // after the balls stop, the rest of the world gets this long to come to rest
  const BASE_MAX_SPEED = 1400;
  const MIN_SPEED = 200;
  const MUZZLE = 36;
  const ANGLE_MIN = -25;
  const ANGLE_MAX = 205;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /*
   * An attempt is one live world that persists across shots: crates stay
   * where they fell, broken glass stays broken, lit targets stay lit and
   * taken stars stay taken. Nothing moves between shots (machines run only
   * while a shot is in flight), so a replay is exact.
   * opts: { theme, rubber (extra restitution), record (sample the first
   * ball's path per shot), oneShot (targets reset every shot), minBounces }
   */
  function createAttempt(level, placed, opts) {
    opts = opts || {};
    const theme = opts.theme || {};
    const g = level.gravity !== undefined ? level.gravity : theme.gravity !== undefined ? theme.gravity : 1200;
    const world = Ph.createWorld({ gravity: [0, g], bounds: { x0: -120, y0: -1400, x1: Parts.FIELD_W + 120, y1: Parts.FIELD_H + 140 } });
    for (const item of level.items)
      Parts.addSpecs(world, Parts.fixtureSpecs(item, theme));
    const att = {
      level: level, world: world, theme: theme, partBodies: [], placed: [],
      targets: [], stars: [], shots: 0, shot: null, won: false,
      rubber: opts.rubber || 0, record: !!opts.record, oneShot: !!opts.oneShot, minBounces: opts.minBounces || 0,
      paths: []
    };
    att.targets = (level.targets || []).map((t, i) => {
      const b = Ph.addBody(world, { shape: 'circle', x: t[0], y: t[1], r: Parts.TARGET_R, sensor: true, tag: 'target', data: { kind: 'target', index: i } });
      return { x: t[0], y: t[1], lit: false, body: b, litAt: -1 };
    });
    att.stars = (level.stars || []).map((s, i) => {
      const b = Ph.addBody(world, { shape: 'circle', x: s[0], y: s[1], r: Parts.STAR_R, sensor: true, tag: 'star', data: { kind: 'star', index: i } });
      return { x: s[0], y: s[1], got: false, body: b };
    });
    setParts(att, placed || []);
    return att;
  }

  /* swaps the player's parts in the live world */
  function setParts(att, placed) {
    for (const b of att.partBodies)
      b.alive = false;
    att.partBodies = [];
    for (const z of att.world.zones.slice())
      if (z.data && z.data.part)
        att.world.zones.splice(att.world.zones.indexOf(z), 1);
    att.placed = placed.map(p => ({ type: p.type, x: p.x, y: p.y, a: p.a || 0 }));
    att.placed.forEach((p, i) => {
      const specs = Parts.partSpecs(p);
      specs.bodies.forEach(b => { b.data = Object.assign({}, b.data, { placedIndex: i }); });
      specs.zones.forEach(z => { z.data = Object.assign({}, z.data, { placedIndex: i }); });
      const made = Parts.addSpecs(att.world, specs);
      for (const b of made)
        att.partBodies.push(b);
    });
    /* resting bodies feel the new parts */
    for (const b of att.world.bodies)
      if (b.type === 'dynamic')
        Ph.wake(b);
  }

  function launcherDir(angleDeg) {
    const a = clamp(angleDeg, ANGLE_MIN, ANGLE_MAX) * DEG;
    return [Math.cos(a), -Math.sin(a)];
  }

  /* fires one ball, or extra balls fanned out by spreadDeg; earlier balls are cleared away */
  function fire(att, angleDeg, speed, extra, spreadDeg) {
    const L = att.level.launcher;
    for (const b of att.world.bodies)
      if (b.tag === 'ball')
        b.alive = false;
    if (att.oneShot)
      for (const t of att.targets)
        t.lit = false;
    const shot = { time: 0, balls: [], done: null, phase: 'fly', slow: 0, settle: 0, bounces: 0, maxBounces: 0, events: [],
      path: att.record ? [] : null, angle: angleDeg, speed: 0 };
    const n = 1 + (extra || 0);
    const sp = clamp(speed, MIN_SPEED, BASE_MAX_SPEED * 2);
    shot.speed = sp;
    for (let i = 0; i < n; ++i) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * (spreadDeg || 4);
      const d = launcherDir(angleDeg + off);
      const b = Ph.addBody(att.world, {
        shape: 'circle', r: Parts.BALL_R, x: L[0] + d[0] * MUZZLE, y: L[1] + d[1] * MUZZLE,
        vx: d[0] * sp, vy: d[1] * sp, type: 'dynamic', mat: 'ball', tag: 'ball',
        rest: Ph.MATERIALS.ball.rest + att.rubber, data: { kind: 'ball', index: i }
      });
      b.bounces = 0;
      shot.balls.push(b);
    }
    ++att.shots;
    att.shot = shot;
    if (shot.path)
      att.paths.push(shot.path);
    return shot;
  }

  function allLit(att) {
    for (const t of att.targets)
      if (!t.lit)
        return false;
    return att.targets.length > 0;
  }

  /* one physics step plus the rules; game events land in att.shot.events */
  function stepAttempt(att) {
    const shot = att.shot;
    if (!shot || shot.done)
      return;
    const world = att.world;
    Ph.step(world);
    shot.time += Ph.STEP;
    const evs = Ph.takeEvents(world);
    for (const e of evs) {
      if (e.type === 'sensor') {
        const s = e.sensor, b = e.body;
        if (!s.alive)
          continue;
        const kind = s.data && s.data.kind;
        if (kind === 'target' && (b.tag === 'ball' || att.level.anyHits)) {
          const t = att.targets[s.data.index];
          if (!t.lit && (!att.minBounces || (b.bounces || 0) >= att.minBounces)) {
            t.lit = true;
            t.litAt = shot.time;
            shot.events.push({ type: 'target', x: t.x, y: t.y, index: s.data.index, body: b, bounces: b.bounces || 0 });
          }
        } else if (kind === 'star' && b.tag === 'ball') {
          const st = att.stars[s.data.index];
          if (!st.got) {
            st.got = true;
            s.alive = false;
            shot.events.push({ type: 'star', x: st.x, y: st.y, index: s.data.index });
          }
        } else if (s.tag === 'lava' && b.alive && b.type === 'dynamic') {
          b.alive = false;
          shot.events.push({ type: 'burn', x: b.x, y: b.y, body: b });
        }
        continue;
      }
      if ((e.type === 'impact' || e.type === 'boost') && e.speed > 110) {
        const ball = e.a.tag === 'ball' ? e.a : e.b.tag === 'ball' ? e.b : null;
        if (ball) {
          const other = ball === e.a ? e.b : e.a;
          if (other.tag !== 'ball') {
            ball.bounces = (ball.bounces || 0) + 1;
            if (ball.bounces > shot.maxBounces)
              shot.maxBounces = ball.bounces;
            ++shot.bounces;
          }
        }
      }
      shot.events.push(e);
    }
    if (shot.path && world.steps % 4 === 0) {
      const b = shot.balls[0];
      if (b.alive && shot.phase === 'fly')
        shot.path.push(b.x, b.y);
    }
    if (allLit(att)) {
      shot.done = 'win';
      att.won = true;
      return;
    }
    if (world.steps % 12 !== 0)
      return;
    const dt = 12 * Ph.STEP;
    if (shot.phase === 'fly') {
      let alive = 0, moving = 0;
      for (const b of shot.balls) {
        if (!b.alive)
          continue;
        ++alive;
        if (!b.sleeping && b.vx * b.vx + b.vy * b.vy > 30 * 30)
          ++moving;
      }
      shot.slow = moving ? 0 : shot.slow + dt;
      if (!alive || shot.slow > STUCK_TIME || shot.time > MAX_TIME)
        shot.phase = 'settle';
    } else {
      /* the balls are done: let the rest of the world come to rest */
      shot.settle += dt;
      if (Ph.settled(world) || shot.settle > SETTLE_TIME)
        shot.done = 'over';
    }
  }

  /* runs a shot to its end without drawing */
  function runShot(att, angle, speed, extra, spread) {
    const shot = fire(att, angle, speed, extra, spread);
    while (!shot.done)
      stepAttempt(att);
    return shot;
  }

  /*
   * replays solution { parts: [[type, x, y, a]], shots: [[angle, speed]] } in
   * one attempt. opts: { theme, record, oneShot, minBounces }.
   */
  function playSolution(level, solution, opts) {
    opts = opts || {};
    const placed = solution.parts.map(p => ({ type: p[0], x: p[1], y: p[2], a: p[3] || 0 }));
    const att = createAttempt(level, placed, opts);
    let last = null;
    for (const s of solution.shots) {
      last = runShot(att, s[0], s[1]);
      if (last.done === 'win')
        break;
    }
    return { win: att.won, shots: att.shots, stars: att.stars.filter(s => s.got).length, starsTotal: att.stars.length,
      placed: placed, attempt: att, paths: att.paths, bounces: last ? last.maxBounces : 0 };
  }

  /* ── seeded helpers ── */

  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; ++i) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return function() {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  }

  /*
   * The Daily challenge: a level picked by the date, with fresh stars hung
   * along its known solution path (so it stays solvable) and a spare part.
   * Returns a level object (same shape as the campaign's).
   */
  function buildDaily(dateKey, levels, solutions, themes) {
    const r = rng(hashString('daily:' + dateKey));
    const pool = levels.filter(l => solutions[l.id]);
    const base = pool[Math.floor(r() * pool.length)];
    const theme = themes[base.world];
    const sol = solutions[base.id];
    const out = playSolution(base, sol, { theme: theme, record: true });
    /* candidate points: every path sample before the winning moment, away from the launcher and the targets */
    const pts = [];
    out.paths.forEach((p) => {
      for (let i = 0; i + 1 < p.length; i += 2) {
        const x = p[i], y = p[i + 1];
        if (Math.hypot(x - base.launcher[0], y - base.launcher[1]) < 140 || y < 40 || y > Parts.FIELD_H - 30 || x < 30 || x > Parts.FIELD_W - 30)
          continue;
        if (base.targets.some(t => Math.hypot(x - t[0], y - t[1]) < 90))
          continue;
        pts.push([Math.round(x), Math.round(y)]);
      }
    });
    const stars = [];
    const want = 3;
    for (let k = 0; k < want && pts.length; ++k) {
      const lo = Math.floor(pts.length * k / want), hi = Math.floor(pts.length * (k + 1) / want);
      const pick = pts[Math.min(pts.length - 1, lo + Math.floor(r() * Math.max(1, hi - lo)))];
      if (!stars.some(s => Math.hypot(s[0] - pick[0], s[1] - pick[1]) < 60))
        stars.push(pick);
    }
    const inv = Object.assign({}, base.inv);
    const spare = ['plank', 'spring', 'block', 'bumper'][Math.floor(r() * 4)];
    inv[spare] = (inv[spare] || 0) + 1;
    return Object.assign({}, base, {
      id: 'daily-' + dateKey, name: 'Daily: ' + base.name, stars: stars, inv: inv, par: sol.shots.length,
      daily: true, baseId: base.id, spare: spare
    });
  }

  SZ.PhysicsPuzzleSim = Object.freeze({
    MAX_TIME: MAX_TIME, BASE_MAX_SPEED: BASE_MAX_SPEED, MIN_SPEED: MIN_SPEED, MUZZLE: MUZZLE,
    ANGLE_MIN: ANGLE_MIN, ANGLE_MAX: ANGLE_MAX,
    createAttempt: createAttempt, setParts: setParts, fire: fire, stepAttempt: stepAttempt, runShot: runShot, playSolution: playSolution,
    launcherDir: launcherDir, buildDaily: buildDaily, hashString: hashString, rng: rng, allLit: allLit
  });
})();
