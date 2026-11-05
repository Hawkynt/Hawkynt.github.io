/* Seeded randomness and small math helpers: mulberry32 generators whose state can be saved and
   restored, string hashing, local day and ISO week keys, toroidal deltas for the wrapping field,
   angle helpers. Pure; owns nothing but the cosmetic generator. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  /* A small fast generator; returns floats in [0, 1). getState/setState make runs resumable. */
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
    rng.getState = () => a;
    rng.setState = (s) => { a = s >>> 0; };
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

  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* Whole local days between two day keys (b - a) */
  function dayDiff(a, b) {
    const pa = a.split('-'), pb = b.split('-');
    const ta = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]), tb = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((tb - ta) / 86400000);
  }

  /* ISO-8601 week key, e.g. 2026-W45 */
  function weekKey(date) {
    const d = date || new Date();
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
    return t.getUTCFullYear() + '-W' + pad(w);
  }

  /* The unseeded generator for cosmetic randomness (particles, shake) */
  const fx = makeRng((Date.now() ^ 0x5bd1e995) >>> 0);

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /* Shortest signed difference between two angles, in (-PI, PI] */
  function angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    else if (d <= -Math.PI) d += Math.PI * 2;
    return d;
  }

  function turnToward(a, b, maxStep) {
    const d = angleDiff(a, b);
    if (d > maxStep) return a + maxStep;
    if (d < -maxStep) return a - maxStep;
    return b;
  }

  /* The shortest delta across the wrapping field */
  function wrapD(d, size) {
    if (d > size / 2) return d - size;
    if (d < -size / 2) return d + size;
    return d;
  }

  function wrap(v, size) {
    return v < 0 ? v + size * Math.ceil(-v / size) : v >= size ? v % size : v;
  }

  Object.assign(NS.rng, {
    makeRng, hashString, dayKey, dayDiff, weekKey, fx, clamp, lerp, angleDiff, turnToward, wrapD, wrap
  });
})();
