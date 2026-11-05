/* Seeded randomness and calendar helpers: a small 32-bit generator whose whole state is one
   number (so a saved run resumes the exact same sequence), string hashing for seeds, and the
   local-date keys that drive the daily challenge, quests, streaks and seasons. Pure functions. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});

  /* mulberry32 over a state object { s } so the state can be stored and restored */
  function make(seed) {
    return { s: (seed >>> 0) || 0x9e3779b9 };
  }

  function next(r) {
    r.s = (r.s + 0x6D2B79F5) >>> 0;
    let t = r.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(r, n) {
    return Math.floor(next(r) * n);
  }

  function range(r, a, b) {
    return a + next(r) * (b - a);
  }

  function pick(r, arr) {
    return arr[Math.floor(next(r) * arr.length)];
  }

  function chance(r, p) {
    return next(r) < p;
  }

  function shuffle(r, arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(next(r) * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* FNV-1a over a string */
  function hash(str) {
    let h = 0x811c9dc5;
    str = String(str);
    for (let i = 0; i < str.length; ++i) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /* YYYY-MM-DD in local time */
  function dateKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* whole local days since 1970-01-01, robust against daylight saving */
  function dayNumber(d) {
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  function daysBetween(keyA, keyB) {
    const a = keyA.split('-'), b = keyB.split('-');
    return Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000);
  }

  /* weeks start on Monday; the key is the date of that Monday */
  function weekKey(d) {
    const day = (d.getDay() + 6) % 7;
    const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return dateKey(m);
  }

  Object.assign(NS.rng, { make, next, int, range, pick, chance, shuffle, hash, dateKey, dayNumber, daysBetween, weekKey });
})();
