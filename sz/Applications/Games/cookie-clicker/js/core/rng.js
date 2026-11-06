/* Seeded random numbers (mulberry32) for daily quests, daily Bake-Off modifiers and art
   variation, a string hash for seeds, and Math.random wrappers for cosmetic jitter. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; ++i) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function create(seed) {
    let a = (typeof seed === 'string' ? hash(seed) : seed >>> 0) || 1;
    function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      range: (lo, hi) => lo + next() * (hi - lo),
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      pick: arr => arr[Math.floor(next() * arr.length)],
      chance: p => next() < p,
    };
  }

  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  Object.assign(NS.rng, { hash, create, rand, pick });
})();
