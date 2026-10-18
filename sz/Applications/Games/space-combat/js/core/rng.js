/* Seeded randomness and small math helpers: mulberry32 generators, string hashing, the local
   day key for the daily challenge, angle and vector helpers. Pure; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

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

  function dayKey(date) {
    const d = date || new Date();
    const p = n => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
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

  /* Turn angle a toward b by at most maxStep */
  function turnToward(a, b, maxStep) {
    const d = angleDiff(a, b);
    if (d > maxStep) return a + maxStep;
    if (d < -maxStep) return a - maxStep;
    return b;
  }

  function dist2(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  }

  /* Squared distance from point (px, py) to segment (ax, ay)-(bx, by), and the segment parameter */
  function segPointDist2(ax, ay, bx, by, px, py, out) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cy = ay + dy * t;
    if (out) out.t = t;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy);
  }

  Object.assign(NS.rng, {
    makeRng, hashString, dayKey, fx, clamp, lerp, angleDiff, turnToward, dist2, segPointDist2
  });
})();
