/* Juice: a fixed pool of particles (shards, squares, stars, hearts, bubbles, snow, petals,
   leaves, confetti, sparks, embers, bats) with gravity, spin and fade; a pool of floating texts;
   expanding rings; screen shake, flash and hit-stop. Nothing is allocated per frame. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const { TAU } = NS.constants;

  const KINDS = { shard: 0, square: 1, star: 2, heart: 3, bubble: 4, snow: 5, petal: 6, leaf: 7, confetti: 8, spark: 9, ember: 10, bat: 11 };
  const MAX_P = NS.constants.MAX_PARTICLES, MAX_T = NS.constants.MAX_TEXTS, MAX_R = NS.constants.MAX_RINGS;
  const parts = [], texts = [], rings = [];
  for (let i = 0; i < MAX_P; ++i) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#fff', kind: 0, rot: 0, vr: 0, g: 0, drag: 0 });
  for (let i = 0; i < MAX_T; ++i) texts.push({ on: false, x: 0, y: 0, vy: 0, life: 0, max: 1, text: '', color: '#fff', size: 20, pop: 0 });
  for (let i = 0; i < MAX_R; ++i) rings.push({ on: false, x: 0, y: 0, r0: 0, r1: 0, life: 0, max: 1, color: '#fff', w: 3 });
  let pNext = 0, tNext = 0, rNext = 0, alive = 0;
  let hitStop = 0;

  function spawn(x, y, vx, vy, life, size, color, kind, g) {
    const p = parts[pNext];
    pNext = (pNext + 1) % MAX_P;
    p.on = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.color = color;
    p.kind = typeof kind === 'number' ? kind : (KINDS[kind] || 0);
    p.rot = Math.random() * TAU; p.vr = (Math.random() - 0.5) * 10; p.g = g == null ? 600 : g; p.drag = 0.6;
    return p;
  }

  /* a radial burst of n particles */
  function burst(x, y, n, colors, kind, speed, g, size) {
    speed = speed || 260;
    for (let i = 0; i < n; ++i) {
      const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.8);
      spawn(x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.35, 0.6 + Math.random() * 0.7, (size || 5) * (0.6 + Math.random() * 0.8),
        colors[i % colors.length], kind, g);
    }
  }

  function text(x, y, str, color, size, life) {
    const t = texts[tNext];
    tNext = (tNext + 1) % MAX_T;
    t.on = true;
    t.x = x; t.y = y; t.vy = -70; t.life = life || 1.1; t.max = t.life; t.text = str; t.color = color || '#fff'; t.size = size || 22; t.pop = 1;
    return t;
  }

  function ring(x, y, r0, r1, life, color, w) {
    const r = rings[rNext];
    rNext = (rNext + 1) % MAX_R;
    r.on = true;
    r.x = x; r.y = y; r.r0 = r0; r.r1 = r1; r.life = life; r.max = life; r.color = color; r.w = w || 3;
  }

  function shake(a) {
    G.shake = Math.max(G.shake, a);
  }

  function flash(a, color) {
    G.flash = Math.max(G.flash, a);
    G.flashColor = color || '#ffffff';
  }

  function stop(sec) {
    hitStop = Math.max(hitStop, sec);
  }

  /* returns the dt the game should use (0 during hit-stop) */
  function update(dt) {
    alive = 0;
    for (let i = 0; i < MAX_P; ++i) {
      const p = parts[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      ++alive;
      const k = 1 - p.drag * dt;
      p.vx *= k;
      p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if ((p.kind >= 5 && p.kind <= 7) || p.kind === 11) p.x += Math.sin(p.life * 4 + i) * 30 * dt;
    }
    for (let i = 0; i < MAX_T; ++i) {
      const t = texts[i];
      if (!t.on) continue;
      t.life -= dt;
      if (t.life <= 0) { t.on = false; continue; }
      t.y += t.vy * dt;
      t.vy *= 1 - 1.8 * dt;
      t.pop = Math.max(0, t.pop - dt * 6);
    }
    for (let i = 0; i < MAX_R; ++i) {
      const r = rings[i];
      if (!r.on) continue;
      r.life -= dt;
      if (r.life <= 0) r.on = false;
    }
    G.shake = Math.max(0, G.shake - dt * 30);
    G.flash = Math.max(0, G.flash - dt * 2.5);
    if (hitStop > 0) {
      hitStop -= dt;
      return 0;
    }
    return dt;
  }

  function clear() {
    for (let i = 0; i < MAX_P; ++i) parts[i].on = false;
    for (let i = 0; i < MAX_T; ++i) texts[i].on = false;
    for (let i = 0; i < MAX_R; ++i) rings[i].on = false;
  }

  Object.assign(NS.fx, { KINDS, parts, texts, rings, spawn, burst, text, ring, shake, flash, stop, update, clear, count: () => alive });
})();
