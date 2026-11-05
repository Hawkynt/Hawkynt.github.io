'use strict';

/* A completability bot for the node tests. It flies the real course, hazard and boss
   modules (SZ.FlappyCourse, SZ.FlappyHazards, SZ.FlappyBoss) with the base bird - no
   upgrades, no power-ups - at a fixed 60 fps, deciding every frame whether to flap. Each
   decision is checked by rollouts: the bot only takes an action when some simple height
   controller can continue from it without a hit for the next second. Reaching the finish
   (or defeating the boss) with no hit is a constructive proof that the stage can be
   completed. */

const GRAVITY = 0.48, FLAP = -9, TERMINAL = 14.4, R = 14, BIRD_X = 360, GROUND = 640, CEIL = 14.5;
const GATE_W = 72, CAP_X = 8, CAP_H = 30;

function circleRect(cx, cy, r, x, y, w, h) {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function makeBot(SZ, course, speed, opts) {
  opts = opts || {};
  const C = SZ.FlappyCourse, Hz = SZ.FlappyHazards, Boss = SZ.FlappyBoss;
  const state = { y: 300, vy: 0, t: 0, dist: 0, hz: course.hazards, boss: null, invuln: 0, hits: 0, frame: 0, orbs: 0 };

  function gatesHit(s) {
    for (const g of course.gates) {
      const sx = g.x - s.dist;
      if (sx + GATE_W < BIRD_X - R && !(g.index < (s.passed || 0)))
        s.passed = g.index + 1;
      if (sx > BIRD_X + 40)
        break;
      if (sx < BIRD_X - GATE_W - 40)
        continue;
      const sh = C.gateShape(g, s.t);
      const top = sh.y - sh.gap / 2, bot = sh.y + sh.gap / 2;
      if (circleRect(BIRD_X, s.y, R, sx, 0, GATE_W, top) || circleRect(BIRD_X, s.y, R, sx, bot, GATE_W, GROUND - bot) ||
        circleRect(BIRD_X, s.y, R, sx - CAP_X, top - CAP_H, GATE_W + CAP_X * 2, CAP_H) ||
        circleRect(BIRD_X, s.y, R, sx - CAP_X, bot, GATE_W + CAP_X * 2, CAP_H))
        return true;
    }
    return false;
  }

  /* one frame; returns 'ok', 'hit' or 'win' */
  function step(s, flap) {
    if (flap)
      s.vy = FLAP;
    s.t += 1 / 60;
    s.dist += typeof speed === 'function' ? speed(s.passed || 0) : speed;
    ++s.frame;
    s.vy = Math.min(s.vy + GRAVITY, TERMINAL);
    s.y += s.vy;
    if (s.y < CEIL) {
      s.y = CEIL;
      s.vy = Math.max(0, s.vy);
    }
    s.invuln = Math.max(0, s.invuln - 1);
    let hit = gatesHit(s) || s.y + R >= GROUND;
    s.cause = hit ? (s.y + R >= GROUND ? 'ground' : 'gate') : '';
    if (s.dist + BIRD_X >= course.finishX) {
      if (!opts.boss)
        return hit ? 'hit' : 'win';
      if (!s.boss) {
        s.boss = Boss.create(opts.boss, opts.seed || 1, opts.bossOpts);
      }
    }
    if (s.boss) {
      Boss.update(s.boss, 1 / 60, s.y);
      if (s.boss.state === 'dead')
        return 'win';
      const res = s.boss.state === 'fight' ? Boss.collide(s.boss, BIRD_X, s.y, R) : '';
      if (res === 'orb')
        ++s.orbs;
      else if (res) {
        hit = true;
        s.cause = 'boss-' + res;
      }
    }
    const w = { dist: s.dist, t: s.t, dt: 1 / 60, step: 1, birdX: BIRD_X, birdY: s.y, birdR: R, windScale: 1, crowScale: 1 };
    for (const h of s.hz) {
      const sx = h.x - s.dist;
      if (sx < -300 || sx > 1580)
        continue;
      if (h.type === 'gust') {
        s.vy += Hz.gustPush(h, w);
        continue;
      }
      Hz.step(h, w);
      if (Hz.hits(h, w)) {
        hit = true;
        s.cause = h.type;
      }
    }
    if (hit && s.invuln > 0)
      hit = false;
    return hit ? 'hit' : 'ok';
  }

  function nextGapY(s) {
    for (const g of course.gates) {
      if (g.x + GATE_W - s.dist > BIRD_X - 24)
        return C.gateShape(g, s.t).y;
    }
    return 320;
  }

  function nextOrbY(s) {
    if (!s.boss)
      return null;
    for (const o of s.boss.orbs)
      if (o.x > BIRD_X - 10)
        return o.y;
    return null;
  }

  function control(s, target) {
    let y = target;
    if (target === 'gap')
      y = nextGapY(s) + 16;
    else if (typeof target === 'string' && target.indexOf('gap') === 0)
      y = nextGapY(s) + Number(target.slice(3));
    else if (target === 'orb') {
      const o = nextOrbY(s);
      y = o === null ? nextGapY(s) + 16 : o + 8;
    }
    return s.y > y && s.vy > -2;
  }

  function clone(s) {
    const near = s.hz.filter(h => h.x - s.dist > -400 && h.x - s.dist < 1800);
    return { y: s.y, vy: s.vy, t: s.t, dist: s.dist, hz: JSON.parse(JSON.stringify(near)), boss: s.boss ? Boss.clone(s.boss) : null,
      invuln: s.invuln, hits: s.hits, frame: s.frame, orbs: s.orbs, passed: s.passed };
  }

  const TARGETS = ['orb', 'gap', 'gap-45', 'gap-20', 'gap40', 'gap60', 100, 180, 260, 340, 420, 500, 570];

  function safe(s, action, target, horizon) {
    const c = clone(s);
    let r = step(c, action);
    if (r === 'hit')
      return false;
    for (let i = 0; i < horizon && r === 'ok'; ++i)
      r = step(c, control(c, target));
    return r !== 'hit';
  }

  /* exhaustive fallback: a depth-first search over flap / no flap for every frame of the
     next `depth` frames, remembering visited (frame, y, vy) cells; returns the first action
     of a hit-free path, or null */
  function search(s, depth, budget) {
    const seen = new Set();
    let nodes = 0;
    function dfs(st, d) {
      if (d >= depth)
        return true;
      if (++nodes > budget)
        return false;
      const key = d + ':' + Math.round(st.y) + ':' + Math.round(st.vy * 2);
      if (seen.has(key))
        return false;
      seen.add(key);
      for (const a of [false, true]) {
        const c = clone(st);
        const r = step(c, a);
        if (r === 'win')
          return true;
        if (r !== 'hit' && dfs(c, d + 1))
          return true;
      }
      return false;
    }
    for (const a of [false, true]) {
      const c = clone(s);
      const r = step(c, a);
      if (r === 'win' || (r !== 'hit' && dfs(c, 1)))
        return a;
    }
    return null;
  }

  /* fly until win or maxFrames; returns { result, hits, frames } */
  function fly(maxFrames) {
    const horizon = opts.horizon || 75;
    for (let f = 0; f < maxFrames; ++f) {
      if (course.ensure && course.gates.length && course.gates[course.gates.length - 1].x < state.dist + 2400)
        course.ensure(state.dist + 1000);
      const preferTarget = state.boss ? 'orb' : 'gap';
      const pref = control(state, preferTarget);
      let action = pref;
      let found = safe(state, pref, preferTarget, horizon);
      if (!found) {
        outer:
        for (const a of [pref, !pref]) {
          for (const t of TARGETS) {
            if (safe(state, a, t, horizon)) {
              action = a;
              found = true;
              break outer;
            }
          }
        }
      }
      if (!found) {
        const a = search(state, opts.searchDepth || 100, opts.searchBudget || 150000);
        if (a !== null)
          action = a;
      }
      const r = step(state, action);
      if (r === 'hit') {
        ++state.hits;
        state.invuln = 72;
        if (state.hits > (opts.maxHits || 0))
          return { result: 'hit', hits: state.hits, frames: state.frame, dist: state.dist, cause: state.cause, y: Math.round(state.y) };
      }
      if (r === 'win')
        return { result: 'win', hits: state.hits, frames: state.frame, orbs: state.orbs };
      if (opts.gates) {
        let passed = 0;
        for (const g of course.gates)
          if (g.x + GATE_W < state.dist + BIRD_X)
            passed = g.index + 1;
        if (passed >= opts.gates)
          return { result: 'win', hits: state.hits, frames: state.frame };
      }
      if (course.prune && f % 60 === 0) {
        course.prune(state.dist);
        state.hz = course.hazards;
      }
    }
    return { result: 'timeout', hits: state.hits, frames: state.frame };
  }

  return { state, step, fly };
}

module.exports = { makeBot };
