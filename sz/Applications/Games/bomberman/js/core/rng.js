/* Seeded randomness and small helpers: mulberry32 generators (seedable and resumable, since
   the generator state is a plain number a save can hold), string hashing, local day and week
   keys, clamp and lerp. Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});

  /* One step of mulberry32 on a state number; returns [value, nextState] packed in an object */
  function stepState(a) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return { v: ((t ^ (t >>> 14)) >>> 0) / 4294967296, s: a };
  }

  function makeRng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    const rng = function() {
      const r = stepState(a);
      a = r.s;
      return r.v;
    };
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    rng.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; --i) {
        const j = Math.floor(rng() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };
    rng.state = () => a;
    return rng;
  }

  /* A generator whose state lives in obj[key], so a saved run resumes the same sequence */
  function holder(obj, key) {
    return function() {
      const r = stepState(obj[key] >>> 0);
      obj[key] = r.s;
      return r.v;
    };
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

  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* Whole days since 1970 in local time, for streaks */
  function dayNumber(date) {
    const d = date || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  /* Monday-based week number since 1970 in local time */
  function weekNumber(date) {
    return Math.floor((dayNumber(date) + 3) / 7);
  }

  /* Cosmetic randomness (particles, shake) that never touches a seeded sequence */
  const fx = makeRng((Date.now() ^ 0x5bd1e995) >>> 0);

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

  Object.assign(NS.rng, {
    makeRng, holder, hashString, dayKey, dayNumber, weekNumber, fx, clamp, lerp, ease, easeOutBack
  });
})();
