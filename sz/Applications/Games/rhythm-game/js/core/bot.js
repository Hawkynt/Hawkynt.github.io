/* A player bot over the engine with a human-like hand: every press lands on its note plus a timing
   spread, the spread and the chance to drop a note grow when the notes come faster than the bot can
   read (its cap in notes per second), on drift notes and under a duel's attacks, it presses Hush
   notes now and then, lets go
   of holds early now and then and unleashes Surge when it is ready. plan() turns a chart into a list
   of actions; step() feeds them into an engine state up to a song time; run() plays a whole song.
   The title demo and the tests (every stage beatable, the difficulty curve) use it. Pure apart from
   its seeded randomness. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const E = NS.engine;
  const { makeRng } = NS.rng;

  /* sigma: timing spread (s), cap: notes per second it reads cleanly, lapse: chance to drop a note,
     hush: chance to press a Hush note, holds: chance to keep a hold to its tail */
  const PROFILES = {
    perfect: { sigma: 0.004, cap: 99, lapse: 0, hush: 0, holds: 1 },
    pro: { sigma: 0.022, cap: 9.5, lapse: 0.006, hush: 0.02, holds: 0.98 },
    regular: { sigma: 0.032, cap: 6.5, lapse: 0.015, hush: 0.06, holds: 0.94 },
    casual: { sigma: 0.042, cap: 4.4, lapse: 0.03, hush: 0.12, holds: 0.88 },
    rookie: { sigma: 0.055, cap: 3, lapse: 0.05, hush: 0.2, holds: 0.8 },
  };

  function gauss(r) {
    let u = 0, v = 0;
    while (u === 0) u = r.next();
    v = r.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* notes per second around each note (a one-second window) */
  function density(notes) {
    const out = new Array(notes.length).fill(0);
    let lo = 0, hi = 0;
    for (let i = 0; i < notes.length; ++i) {
      const t = notes[i].t;
      while (notes[lo].t < t - 0.5) ++lo;
      while (hi < notes.length && notes[hi].t <= t + 0.5) ++hi;
      let c = 0;
      for (let k = lo; k < hi; ++k) if (notes[k].kind !== 'hush') ++c;
      out[i] = c;
    }
    return out;
  }

  function plan(chart, profile, seed) {
    const p = typeof profile === 'string' ? PROFILES[profile] : profile;
    const r = makeRng(seed || 1);
    const dens = density(chart.notes);
    const acts = [];
    /* what a duel's attacks do to reading: fog hides, rush hurries, sway moves, silence takes the
       music away (the bot assumes every major attack fires) */
    const HARM = { rush: 1.25, fog: 1.4, sway: 1.3, silence: 1.35, hammer: 1.05 };
    const harm = t => { for (const a of chart.attacks || []) if (a.major && t >= a.t1 && t < a.t2) return HARM[a.kind] || 1; return 1; };
    for (let i = 0; i < chart.notes.length; ++i) {
      const n = chart.notes[i];
      const load = dens[i] / p.cap, over = Math.max(0, load - 1);
      if (n.kind === 'hush') {
        if (r.next() < p.hush * (1 + over)) acts.push({ t: n.t + gauss(r) * p.sigma, type: 'press', lane: n.lane }, { t: n.t + 0.08, type: 'release', lane: n.lane });
        continue;
      }
      const drift = n.kind === 'drift' ? 1.35 : 1;
      const hm = harm(n.t);
      const sigma = p.sigma * (0.7 + 0.5 * Math.min(1, load) + over * 2.2) * drift * (n.chord ? 1.15 : 1) * hm;
      const lapse = p.lapse * (0.4 + Math.min(1, load)) + over * 0.28 + (drift > 1 ? 0.03 : 0) + (hm - 1) * 0.08;
      if (r.next() < lapse) continue;
      const at = n.t + gauss(r) * sigma;
      acts.push({ t: at, type: 'press', lane: n.lane });
      const up = n.end ? (r.next() < p.holds ? n.end + 0.02 : n.t + (n.end - n.t) * r.next() * 0.7) : at + 0.07;
      acts.push({ t: up, type: 'release', lane: n.lane });
    }
    acts.sort((a, b) => a.t - b.t || (a.type === 'release' ? -1 : 1));
    return { acts: acts, i: 0, surge: p.cap > 0 };
  }

  /* feeds the plan's actions up to song time t into the engine, then updates it */
  function step(state, chart, pl, t) {
    while (pl.i < pl.acts.length && pl.acts[pl.i].t <= t) {
      const a = pl.acts[pl.i++];
      E.update(state, chart, Math.max(state.t, a.t));
      if (a.type === 'press') E.press(state, chart, a.lane, a.t);
      else E.release(state, chart, a.lane, a.t);
    }
    if (pl.surge && state.surge >= 0.5) E.surge(state, chart);
    E.update(state, chart, t);
  }

  function run(chart, opts, profile, seed) {
    const s = E.create(chart, opts);
    const pl = plan(chart, profile, seed);
    for (let t = -1; !s.done && t < chart.length + 2; t += 1 / 30) {
      step(s, chart, pl, t);
      s.events.length = 0;
    }
    return s;
  }

  Object.assign(NS.bot, { PROFILES, density, plan, step, run });
})();
