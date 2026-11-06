/* A look-ahead planner over the real physics step: a beam search that tries running on,
   jumping, sliding, dashing and fast-falling every few frames, drops every branch that would hit
   something or fall, merges branches that end in the same place, and returns the input plan of a
   survivor. The title-screen demo runner steers with it, and the tests use it to prove that every
   generated pattern and whole courses can be finished. Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const PH = NS.physics;
  const { A } = PH;

  const GROUND_ACTS = [0, A.JUMP, A.SLIDE | A.HOLD_DOWN, A.DASH];
  const AIR_ACTS = [0, A.JUMP, A.SLIDE | A.HOLD_DOWN, A.DASH];
  const noop = function() {};

  /* states that land in the same bucket are merged (one number per bucket) */
  function key(p, x0) {
    let k = ((p.x - x0) / 10) | 0;
    k = k * 256 + (((p.y + 300) / 5) | 0);
    k = k * 64 + (((p.vy + 2000) / 70) | 0);
    k = k * 4 + p.jumps;
    k = k * 8 + (p.slideT > 0 ? 1 : 0) + (p.dashT > 0 ? 2 : 0) + (p.airDash ? 4 : 0);
    k = k * 8 + (p.dashCd > 0 ? Math.min(7, Math.ceil(p.dashCd * 3)) : 0);
    return k * 2 + p.ground;
  }

  /* how good a surviving state is to keep exploring from: resources left, standing on something */
  function value(p, maxJumps) {
    return (maxJumps - p.jumps) * 2 + (p.dashCd <= 0 ? 1.5 : 0) + (p.ground ? 1 : 0) - (p.slideT > 0 ? 0.3 : 0) + p.x * 0.002;
  }

  /* Plan from player p over `frames` steps of dt deciding every `every` frames.
     env: { course, speedAt, mods, projs }. Returns an array of action bits (one per decision)
     or null when every branch dies. */
  function plan(p0, env, frames, opts) {
    opts = opts || {};
    const every = opts.every || 3;
    const beam = opts.beam || 40;
    const dt = opts.dt || C.STEP;
    const push = opts.push || 0;
    const maxJumps = env.mods.maxJumps || 2;
    const senv = { course: env.course, speedAt: env.speedAt, mods: env.mods, projs: env.projs, t: 0, onSmash: noop };
    let nodes = [{ p: PH.clonePlayer(p0), parent: null, act: 0 }];
    const levels = Math.ceil(frames / every);
    const seen = new Set();
    for (let lv = 0; lv < levels; ++lv) {
      seen.clear();
      const next = [];
      for (let n = 0; n < nodes.length; ++n) {
        const node = nodes[n];
        const acts = node.p.ground ? GROUND_ACTS : AIR_ACTS;
        for (let a = 0; a < acts.length; ++a) {
          const act = acts[a];
          if (act === A.DASH && node.p.dashCd > 0) continue;
          if (act === A.JUMP && !node.p.ground && node.p.jumps >= maxJumps && node.p.coyote <= 0) continue;
          if ((act & A.SLIDE) && !node.p.ground && node.p.vy >= C.DROP_V) continue;
          const p = PH.clonePlayer(node.p);
          let dead = false;
          for (let f = 0; f < every; ++f) {
            senv.t = (lv * every + f) * dt;
            const bits = f === 0 ? act : (act & A.HOLD_DOWN);
            if (PH.step(p, bits, senv, dt)) { dead = true; break; }
          }
          if (dead) continue;
          const k = key(p, p0.x);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ p: p, parent: node, act: act, v: value(p, maxJumps) - (act ? 0.05 : 0) + (p.x - p0.x) * push });
        }
      }
      if (!next.length) return null;
      if (next.length > beam) {
        next.sort((a, b) => b.v - a.v);
        next.length = beam;
      }
      nodes = next;
    }
    /* the survivor with the most resources left; read its inputs back */
    let best = nodes[0];
    for (let i = 1; i < nodes.length; ++i) if (nodes[i].v > best.v) best = nodes[i];
    const out = [];
    for (let n = best; n.parent; n = n.parent) out.push(n.act);
    out.reverse();
    return out;
  }

  /* Drive a whole course with receding-horizon planning until toX (or the finish).
     Returns { ok, x, frames, why }. */
  function run(course, env, p0, toX, opts) {
    opts = opts || {};
    const every = opts.every || 3;
    const horizon = opts.horizon || 84;
    const keep = opts.keep || 4;
    const dt = C.STEP;
    const p = PH.clonePlayer(p0);
    const genv = { course: course, speedAt: env.speedAt, mods: env.mods, projs: null, onSmash: noop };
    let frames = 0;
    while (p.x < toX) {
      if (opts.ensure) opts.ensure(p.x);
      const pl = plan(p, genv, horizon, { every: every, beam: opts.beam || 40 });
      if (!pl) return { ok: false, x: p.x, frames: frames, why: 'no plan' };
      for (let i = 0; i < Math.min(keep, pl.length); ++i)
        for (let f = 0; f < every; ++f) {
          const res = PH.step(p, f === 0 ? pl[i] : (pl[i] & A.HOLD_DOWN), genv, dt);
          ++frames;
          if (res) return { ok: false, x: p.x, frames: frames, why: res === 'fall' ? 'fall' : res.kind };
        }
    }
    return { ok: true, x: p.x, frames: frames };
  }

  Object.assign(NS.solver, {
    plan, run
  });
})();
