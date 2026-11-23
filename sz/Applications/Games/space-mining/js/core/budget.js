/* Pure frame-budget rules: the work of a frame (simulation and drawing) averaged over time, the
   visual detail level it sets (2 full, 1 reduced, 0 lowest: a step down after a second past
   12 ms, a step up after five seconds under 6 ms), the share of the particle budget each level
   allows, and the hard caps on pirates and enemies. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const HIGH = 12, LOW = 6, DOWN_AFTER = 1, UP_AFTER = 5, EMA = 0.08;
  const CAPS = { pirates: 60, enemies: 220 };
  const SHARE = [0.35, 0.65, 1];

  function create() {
    return { quality: 2, avg: 0, over: 0, under: 0 };
  }

  /* one frame's work in ms over dt seconds; returns the detail level */
  function step(st, workMs, dt) {
    st.avg += (workMs - st.avg) * EMA;
    if (st.avg > HIGH) { st.over += dt; st.under = 0; } else if (st.avg < LOW) { st.under += dt; st.over = 0; } else { st.over = 0; st.under = 0; }
    if (st.over >= DOWN_AFTER && st.quality > 0) { st.quality -= 1; st.over = 0; }
    if (st.under >= UP_AFTER && st.quality < 2) { st.quality += 1; st.under = 0; }
    return st.quality;
  }

  function particles(quality) {
    return SHARE[Math.max(0, Math.min(2, quality))];
  }

  Object.assign(NS.budget, {
    HIGH, LOW, CAPS, create, step, particles
  });
})();
