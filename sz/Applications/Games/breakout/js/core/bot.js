/* A paddle bot over the real engine: predicts where the most urgent falling ball meets the
   paddle line (reflecting off the side walls), places the paddle so the bounce angle sends the
   ball toward the lowest breakable brick (or the guardian), launches, fires lasers and catches
   good drops when no ball needs it. It plays the title demo and proves in the tests that stages,
   guardians and modes can be finished. Pure. */
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

  Object.assign(NS.bot, { landX, aim, input });
})();
