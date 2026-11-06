/* Seeded randomness and small helpers: mulberry32 generators whose state is a plain number
   (so a run can be saved and restored mid-game), string hashing, local day and week keys for the
   daily and weekly content, day distances for streaks, and clamp/lerp. Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  /* returns floats in [0, 1); r.s is the whole state */
  function makeRng(seed) {
    const r = function() {
      r.s = (r.s + 0x6d2b79f5) >>> 0;
      let t = r.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.s = (seed >>> 0) || 0x9e3779b9;
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  }

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; ++i) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /* YYYY-MM-DD in local time */
  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ISO week: YYYY-Www, the week that holds the Thursday */
  function weekKey(date) {
    const d = date || new Date();
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const wd = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - wd);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const wk = Math.ceil(((t - y0) / 86400000 + 1) / 7);
    return t.getUTCFullYear() + '-W' + pad(wk);
  }

  /* whole days from key a to key b (both YYYY-MM-DD) */
  function daysBetween(a, b) {
    if (!a || !b) return Infinity;
    const pa = a.split('-'), pb = b.split('-');
    const ta = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]), tb = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((tb - ta) / 86400000);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function ease(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function easeOutBack(t) {
    t = clamp(t, 0, 1);
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  /* cosmetic randomness (particles, shake): never touches saved state */
  const fx = makeRng((Date.now() ^ 0x5bd1e995) >>> 0);

  Object.assign(NS.rng, {
    makeRng, hashString, dayKey, weekKey, daysBetween, clamp, lerp, ease, easeOutBack, fx
  });
})();
