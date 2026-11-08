/* A paddle bot over the real engine: predicts where the most urgent falling ball meets the
   paddle line (reflecting off the side walls), places the paddle so the bounce angle sends the
   ball toward the lowest breakable brick (or the guardian), launches, fires lasers and catches
   good drops when no ball needs it. It plays the title demo and proves in the tests that stages,
   guardians and modes can be finished. It also steers the CPU partner paddles of the team modes:
   each mate looks again every tenth of a second, predicts where the most urgent ball heading its
   way crosses its face and stands so the bounce sends the ball back toward the bricks. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const E = NS.engine;

  function landX(g, b) {
    const r = E.ballR(g);
    const t = (C.PADDLE_Y - r - b.y) / b.vy;
    let x = b.x + b.vx * t - r;
    const span = g.w - 2 * r, period = 2 * span;
    x = ((x % period) + period) % period;
    if (x > span) x = period - x;
    return { x: x + r, t: t };
  }

  function aim(g) {
    if (g.boss) return g.boss.x;
    let best = null;
    for (const br of g.bricks)
      if (br.alive && br.kind !== 'wall' && (!best || br.kind === 'gold' && best.kind !== 'gold' || br.y > best.y && !(best.kind === 'gold' && br.kind !== 'gold'))) best = br;
    return best ? best.x + best.w / 2 : g.w / 2;
  }

  /* -> input for one step */
  function input(g, jitter) {
    const p = g.paddle;
    const inp = { px: p.x, launch: false, fire: p.laserT > 0 };
    if (g.balls.some(b => b.stuck)) {
      inp.launch = true;
      inp.px = aim(g) + (jitter || 0);
      return inp;
    }
    let urgent = null, ut = Infinity;
    for (const b of g.balls) {
      if (b.vy <= 0) continue;
      const l = landX(g, b);
      if (l.t < ut) { ut = l.t; urgent = l; }
    }
    if (urgent) {
      const tx = aim(g);
      const off = Math.max(-0.7, Math.min(0.7, (tx - urgent.x) / 320));
      inp.px = urgent.x - off * p.w / 2 + (jitter || 0);
      if (ut > 1.2) {
        const d = g.drops.find(d => C.POWER_BY_ID[d.type].good && d.y > C.PADDLE_Y - 200);
        if (d) inp.px = d.x;
      }
    } else if (g.balls.length) inp.px = g.balls[0].x;
    return inp;
  }

  function reflect(v, lo, hi) {
    const span = hi - lo, period = 2 * span;
    let x = ((v - lo) % period + period) % period;
    if (x > span) x = period - x;
    return x + lo;
  }

  /* the middle of what is left to break, for aiming team bounces */
  function brickCenter(g) {
    let sx = 0, sy = 0, n = 0;
    for (const br of g.bricks) if (br.alive && br.kind !== 'wall') { sx += br.x + br.w / 2; sy += br.y + br.h / 2; ++n; }
    return n ? { x: sx / n, y: sy / n } : { x: g.w / 2, y: g.h / 2 };
  }

  /* where a mate wants to stand */
  function mateTarget(g, m) {
    const r = E.ballR(g);
    const f = E.mateFace(g, m);
    const span = m.side === 'top' ? g.w : g.h;
    let best = null, bt = Infinity;
    for (const b of g.balls) {
      if (b.stuck) continue;
      let t, c;
      if (m.side === 'top') {
        if (b.vy >= 0) continue;
        t = Math.max(0, (b.y - f - r) / -b.vy);
        c = b.x + b.vx * t;
        c = g.open.left || g.open.right ? Math.max(0, Math.min(g.w, c)) : reflect(c, r, g.w - r);
      } else {
        const toward = m.side === 'left' ? b.vx < 0 : b.vx > 0;
        if (!toward) continue;
        t = Math.max(0, m.side === 'left' ? (b.x - f - r) / -b.vx : (f - r - b.x) / b.vx);
        c = b.y + b.vy * t;
        c = g.open.top ? Math.max(0, Math.min(g.h, c)) : reflect(c, r, g.h * 2);
        c = Math.min(g.h, c);
      }
      if (t < bt) { bt = t; best = c; }
    }
    if (best == null) {
      const bc = brickCenter(g);
      return m.side === 'top' ? bc.x : bc.y;
    }
    const bc = brickCenter(g);
    const goal = m.side === 'top' ? bc.x : bc.y;
    const off = Math.max(-0.6, Math.min(0.6, (goal - best) / 320));
    return Math.max(m.w / 2, Math.min(span - m.w / 2, best - off * m.w / 2));
  }

  /* -> the mates' targets for one step, looking again after the reaction time */
  function mateInputs(g, dt) {
    const out = [];
    for (const m of g.mates) {
      m.reT -= dt;
      if (m.reT <= 0) { m.reT = C.MATE_REACT; m.tgt = mateTarget(g, m); }
      out.push(m.tgt);
    }
    return out;
  }

  Object.assign(NS.bot, { landX, aim, input, reflect, brickCenter, mateTarget, mateInputs });
})();
