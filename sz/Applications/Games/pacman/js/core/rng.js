/* Seeded randomness and small helpers: mulberry32 generators, string hashing, local day and
   week keys for the daily challenge and quests, clamping and easing. Pure; owns nothing but the
   unseeded cosmetic generator. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  /* A small fast generator with good spread; returns floats in [0, 1) */
  function makeRng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    const rng = function() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    rng.state = () => a;
    return rng;
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

  /* 2026-11-05 in the player's local time */
  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* Whole local days since 1970 (for streaks) */
  function dayNumber(date) {
    const d = date || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  /* ISO-like week key: the Monday that starts the week */
  function weekKey(date) {
    const d = date ? new Date(date.getTime()) : new Date();
    const wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    return 'w' + dayKey(d);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOut(t) {
    t = clamp(t, 0, 1);
    return 1 - (1 - t) * (1 - t) * (1 - t);
  }

  function easeInOut(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* overshooting ease for pop-in animations */
  function easeBack(t) {
    t = clamp(t, 0, 1);
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  /* The unseeded generator for cosmetic randomness (particles, shake) */
  const fx = makeRng((Date.now() ^ 0x5bd1e995) >>> 0);

  Object.assign(NS.rng, {
    makeRng, hashString, dayKey, dayNumber, weekKey, clamp, lerp, easeOut, easeInOut, easeBack, fx
  });
})();
