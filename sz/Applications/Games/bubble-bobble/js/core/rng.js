/* Seeded randomness with saveable state (mulberry32), string hashing, local day and week keys
   and easing helpers. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});

  /* a generator whose whole state is one number, so it can be saved with a run */
  function makeRng(seed) {
    const r = { s: seed >>> 0 };
    r.next = function() {
      r.s = (r.s + 0x6D2B79F5) >>> 0;
      let t = r.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = n => Math.floor(r.next() * n);
    r.range = (a, b) => a + r.next() * (b - a);
    r.pick = arr => arr[Math.floor(r.next() * arr.length)];
    return r;
  }

  /* one step of a saved state -> [value, nextState] */
  function stepState(s) {
    const r = makeRng(s);
    const v = r.next();
    return [v, r.s];
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; ++i) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayGap(a, b) {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }

  function weekKey(d) {
    d = d || new Date();
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return t.getUTCFullYear() + '-W' + Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }

  const ease = {
    out: t => 1 - (1 - t) * (1 - t),
    inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  };

  /* shared generator for effects (not part of any run) */
  const fx = makeRng(1234567);

  Object.assign(NS.rng, { makeRng, stepState, hashString, dayKey, dayGap, weekKey, ease, fx });
})();
