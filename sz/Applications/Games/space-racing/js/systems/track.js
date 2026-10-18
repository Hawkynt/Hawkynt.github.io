/*
 * Track progress of a racer: arc position, distance raced, off-road drag and the
 * soft barrier at the track edge. Reads G.geo; touches only the racer passed in.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { frameScale } = NS.util;
  const { particles, screenShake } = NS.runtime;
  const { treeLevel } = NS.progress;

  /* Where a racer is along the track: arc position, search hint and total distance raced */
  function trackStateAt(x, y) {
    const r = G.geo.locate(x, y);
    const L = G.geo.length;
    return { s: r.s, hint: r.index, dist: r.s > L / 2 ? r.s - L : r.s, off: r.dist, lateral: r.lateral, lapsDone: 0 };
  }

  function advanceTrackState(st, x, y) {
    const r = G.geo.locate(x, y, st.hint);
    st.dist += G.geo.progress(st.s, r.s);
    st.s = r.s;
    st.hint = r.index;
    st.off = r.dist;
    st.lateral = r.lateral;
    return r;
  }

  /* Off the road: drag; far off: a soft barrier pushes back toward the road */
  function applyTrackLimits(racer, dt, isPlayer) {
    const st = racer.ts;
    const half = G.geo.width / 2;
    if (st.off <= half) return;
    const dragBase = isPlayer ? 0.965 + 0.0105 * treeLevel('h_grip') : 0.965;
    const drag = Math.pow(dragBase, frameScale(dt));
    racer.vx *= drag;
    racer.vy *= drag;
    const c = G.geo.sampleAt(st.s);
    const dx = racer.x - c.x, dy = racer.y - c.y;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    if (isPlayer && Math.random() < 0.4)
      particles.trail(racer.x, racer.y, { color: '#8a7a6a', speed: 0.6, life: 0.5, count: 1 });
    const wall = half + 40;
    if (d > wall) {
      // put the racer back onto the barrier line and bounce the outward speed
      if (isPlayer)
        G.bonusCleanRace = false;
      racer.x = c.x + dx / d * wall;
      racer.y = c.y + dy / d * wall;
      const out = (racer.vx * dx + racer.vy * dy) / d;
      if (out > 0) {
        const speedBefore = Math.sqrt(racer.vx * racer.vx + racer.vy * racer.vy);
        racer.vx -= dx / d * out * 1.4;
        racer.vy -= dy / d * out * 1.4;
        if (isPlayer) {
          // shock bumpers: keep a bigger share of the speed, never more than before the hit
          const speedAfter = Math.sqrt(racer.vx * racer.vx + racer.vy * racer.vy);
          if (speedAfter > 1) {
            const keep = Math.min(speedBefore, speedAfter * (1 + 0.25 * treeLevel('u_bumper'))) / speedAfter;
            racer.vx *= keep;
            racer.vy *= keep;
          }
        }
        if (isPlayer && out > 80) {
          particles.burst(racer.x, racer.y, 10, { color: '#9cf', speed: 3, life: 0.35 });
          screenShake.trigger(5, 200);
          SZ.GameAudio.play('thud', { volume: 0.6 });
        }
      }
    }
  }

  Object.assign(NS.module('track'), {
    trackStateAt, advanceTrackState, applyTrackLimits
  });
})();
