/* The title demo: a silent run of a story song played by the pro bot behind the logo, moving on to
   the next district's song when it ends. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;

  let index = 0;
  function reset() {
    const r = G.run = NS.play.start('demo', { index: (index % 5) * 6 + 1 });
    /* four bars in, with nothing owed for the bars skipped */
    const t = 4 * r.chart.barLen;
    r.cond.t = t;
    r.eng.noFail = true;
    r.plan = NS.bot.plan(r.chart, 'pro', 5);
    while (r.plan.i < r.plan.acts.length && r.plan.acts[r.plan.i].t < t) ++r.plan.i;
    for (let i = 0; i < r.chart.notes.length && r.chart.notes[i].t < t + 0.2; ++i) r.eng.res[i] = 5;
    NS.engine.update(r.eng, r.chart, t);
    NS.engine.take(r.eng);
    return r;
  }

  function next() {
    ++index;
    return reset();
  }

  Object.assign(NS.demo, { reset, next });
})();
