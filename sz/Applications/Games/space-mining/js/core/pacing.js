/* The pacing director as pure rules: the beat an operation's timeline is at (build-up, peak,
   relief, surprise), a tension score from the hull lost lately and the threats around the ship,
   and from both the wait until the next threat and its size. A player who is crushing it is
   pressed up to a quarter harder, one who is drowning gets up to a quarter more air.
   No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* pace: waves per base interval; size: wave size factor */
  const BEATS = {
    build: { pace: 1, size: 1 },
    peak: { pace: 1.6, size: 1.35 },
    relief: { pace: 0.35, size: 0.6 },
    surprise: { pace: 1.25, size: 1.15 },
  };
  /* seconds for the tension to close half the gap to its target */
  const HALF_LIFE = 4;
  /* hull fraction lost per second that alone means full tension */
  const HURT = 0.2;

  function beatAt(beats, t) {
    let b = 'build';
    if (beats) for (let i = 0; i < beats.length && beats[i][0] <= t; ++i) b = beats[i][1];
    return b;
  }

  function create() {
    return { tension: 0, peak: 0 };
  }

  /* sig: { hullLost (fraction of the hull lost this step), threats (around the ship), cap } */
  function track(p, sig, dt) {
    const hurt = dt > 0 ? Math.min(1, sig.hullLost / dt / HURT) : 0;
    const crowd = Math.min(1, (sig.threats || 0) / Math.max(1, sig.cap || 8));
    const target = Math.min(1, hurt * 0.6 + crowd * 0.55);
    p.tension += (target - p.tension) * (1 - Math.pow(0.5, dt / HALF_LIFE));
    if (p.tension > p.peak) p.peak = p.tension;
    return p.tension;
  }

  /* 1.25 when the player is relaxed, 1 at middle tension, 0.75 when drowning */
  function adjust(tension) {
    return Math.max(0.75, Math.min(1.25, 1.25 - tension * 0.5));
  }

  /* threat: { every, size: [lo, hi] } -> { wait (s), size } */
  function next(threat, beat, tension) {
    const b = BEATS[beat] || BEATS.build;
    const k = adjust(tension);
    const mid = (threat.size[0] + threat.size[1]) / 2;
    return {
      wait: threat.every / (b.pace * k),
      size: Math.max(1, Math.min(threat.size[1] + 2, Math.round(mid * b.size * k))),
    };
  }

  Object.assign(NS.pacing, {
    BEATS, beatAt, create, track, adjust, next
  });
})();
