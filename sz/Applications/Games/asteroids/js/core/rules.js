/* Shared rules and helpers: field wrapping, distances (with wrap), mode lookup,
   scaled fonts, the effective level and the procedural asteroid shapes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;

  function wrap(obj) {
    if (obj.x < 0) obj.x += S.W;
    if (obj.x > S.W) obj.x -= S.W;
    if (obj.y < 0) obj.y += S.H;
    if (obj.y > S.H) obj.y -= S.H;
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distWrapped(a, b) {
    let dx = Math.abs(a.x - b.x);
    let dy = Math.abs(a.y - b.y);
    if (dx > S.W / 2) dx = S.W - dx;
    if (dy > S.H / 2) dy = S.H - dy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function randomAngle() { return Math.random() * Math.PI * 2; }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function randomPowerupType() {
    return T.POWERUP_POOL[Math.floor(Math.random() * T.POWERUP_POOL.length)];
  }

  function modeConfig() { return T.MODE_CONFIGS[S.gameMode] || T.MODE_CONFIGS.classic; }

  function scaledFont(size, weight) {
    return (weight || 'bold') + ' ' + Math.round(size * S.uiS) + 'px sans-serif';
  }

  function getEffectiveLevel() {
    if (S.gameMode === 'survival')
      return Math.floor((S.gameTime || 0) / 30000) + 1;
    return S.level;
  }

  function generateAsteroidShape(vertexCount) {
    const shape = [];
    for (let i = 0; i < vertexCount; ++i) {
      const angle = (i / vertexCount) * Math.PI * 2;
      const jitter = 0.6 + Math.random() * 0.4;
      shape.push({ angle, jitter });
    }
    return shape;
  }

  function generateCraters(radius, count) {
    const craters = [];
    for (let i = 0; i < count; ++i) {
      const d = Math.random() * radius * 0.55;
      const a = randomAngle();
      craters.push({
        x: Math.cos(a) * d,
        y: Math.sin(a) * d,
        r: radius * (0.07 + Math.random() * 0.1)
      });
    }
    return craters;
  }

  function generateCrackPattern(radius) {
    const cracks = [];
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; ++i) {
      const startAngle = randomAngle();
      const points = [{ r: 0, a: startAngle }];
      let r = radius * 0.1;
      let a = startAngle;
      const segments = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < segments; ++j) {
        r += radius * (0.12 + Math.random() * 0.2);
        a += (Math.random() - 0.5) * 0.8;
        points.push({ r: Math.min(r, radius * 0.85), a });
      }
      cracks.push(points);
    }
    return cracks;
  }

  Object.assign(NS.rules, {
    wrap, dist, distWrapped, randomAngle, clamp, randomPowerupType, modeConfig,
    scaledFont, getEffectiveLevel,
    generateAsteroidShape, generateCraters, generateCrackPattern
  });
})();
