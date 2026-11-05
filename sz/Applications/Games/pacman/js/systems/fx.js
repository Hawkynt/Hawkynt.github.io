/* Effects in plane coordinates: a pooled particle system (glows, sparks, chunks, confetti,
   seasonal shapes), shockwave rings, floating score text, screen shake, flashes, hit-stop and
   slow motion. Particles never allocate after start-up. Owns the pools and the shake. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { MAX_PARTICLES, MAX_FLOATERS, TAU } = NS.constants;
  const R = NS.rng.fx;

  /* kind: 0 glow (additive), 1 spark (streak), 2 chunk (square), 3 confetti, 4 shape sprite (shape id) */
  const P = [];
  for (let i = 0; i < MAX_PARTICLES; ++i)
    P.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#fff', kind: 0, grav: 0, drag: 0, rot: 0, vr: 0, shape: '' });
  let live = 0, cursor = 0;

  const rings = [];
  for (let i = 0; i < 24; ++i) rings.push({ on: false, x: 0, y: 0, r0: 0, r1: 0, t: 0, dur: 1, color: '#fff', w: 3 });

  const floaters = [];
  for (let i = 0; i < MAX_FLOATERS; ++i) floaters.push({ on: false, x: 0, y: 0, text: '', color: '#fff', t: 0, size: 16, dur: 1 });

  const shake = { a: 0, x: 0, y: 0 };

  function spawn() {
    for (let k = 0; k < MAX_PARTICLES; ++k) {
      cursor = (cursor + 1) % MAX_PARTICLES;
      if (!P[cursor].on) return P[cursor];
    }
    /* full: reuse the oldest-ish slot */
    cursor = (cursor + 1) % MAX_PARTICLES;
    return P[cursor];
  }

  function particle(x, y, vx, vy, life, size, color, kind, grav, drag) {
    const p = spawn();
    if (!p.on) ++live;
    p.on = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = p.max = life;
    p.size = size; p.color = color; p.kind = kind || 0;
    p.grav = grav || 0; p.drag = drag || 0;
    p.rot = R() * TAU; p.vr = (R() - 0.5) * 10;
    p.shape = '';
    return p;
  }

  function burst(x, y, n, color, speed, life, size, kind) {
    for (let i = 0; i < n; ++i) {
      const a = R() * TAU, s = speed * (0.3 + R() * 0.7);
      particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + R() * 0.6), size * (0.6 + R() * 0.6), color, kind, 0, 2.5);
    }
  }

  function sparks(x, y, n, color, speed) {
    for (let i = 0; i < n; ++i) {
      const a = R() * TAU, s = speed * (0.4 + R() * 0.8);
      particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + R() * 0.3, 2 + R() * 2, color, 1, 0, 3);
    }
  }

  function chunks(x, y, n, color, speed) {
    for (let i = 0; i < n; ++i) {
      const a = R() * TAU, s = speed * (0.4 + R() * 0.8);
      particle(x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.4, 0.7 + R() * 0.5, 3 + R() * 4, color, 2, 900, 1);
    }
  }

  const CONFETTI = ['#ff4a6a', '#ffd23a', '#4ad8ff', '#5aff9a', '#ff7ad8', '#ffffff'];
  function confetti(x, y, n, spread) {
    for (let i = 0; i < n; ++i) {
      const a = -Math.PI / 2 + (R() - 0.5) * (spread || 2.4), s = 250 + R() * 420;
      particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 1.4 + R() * 1.2, 4 + R() * 4, CONFETTI[i % CONFETTI.length], 3, 520, 1.6);
    }
  }

  /* a drifting decorative shape (seasonal and trail art): shape id drawn by the item art */
  function shape(x, y, vx, vy, life, size, shapeId, color, grav) {
    const p = particle(x, y, vx, vy, life, size, color, 4, grav || 0, 0.6);
    p.shape = shapeId;
    return p;
  }

  function ring(x, y, r0, r1, dur, color, w) {
    for (let i = 0; i < rings.length; ++i) {
      const r = rings[i];
      if (r.on) continue;
      r.on = true; r.x = x; r.y = y; r.r0 = r0; r.r1 = r1; r.t = 0; r.dur = dur; r.color = color; r.w = w || 3;
      return;
    }
  }

  function floater(x, y, text, color, size, dur) {
    let f = null;
    for (let i = 0; i < floaters.length; ++i) if (!floaters[i].on) { f = floaters[i]; break; }
    if (!f) f = floaters[0];
    f.on = true; f.x = x; f.y = y; f.text = text; f.color = color || '#ffffff'; f.t = 0; f.size = size || 16; f.dur = dur || 1;
  }

  function addShake(a) {
    shake.a = Math.min(18, Math.max(shake.a, a));
  }

  function flash(color, a) {
    G.ui.flash = Math.max(G.ui.flash, a);
    G.ui.flashColor = color;
  }

  function hitStop(t) {
    G.hitStop = Math.max(G.hitStop, t);
  }

  function slowMo(t, scale) {
    G.slowMo = t;
    G.slowScale = scale;
  }

  function update(dt) {
    if (live > 0) {
      let n = 0;
      for (let i = 0; i < MAX_PARTICLES; ++i) {
        const p = P[i];
        if (!p.on) continue;
        p.life -= dt;
        if (p.life <= 0) { p.on = false; continue; }
        ++n;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      live = n;
    }
    for (let i = 0; i < rings.length; ++i) {
      const r = rings[i];
      if (!r.on) continue;
      r.t += dt;
      if (r.t >= r.dur) r.on = false;
    }
    for (let i = 0; i < floaters.length; ++i) {
      const f = floaters[i];
      if (!f.on) continue;
      f.t += dt;
      f.y -= dt * 34;
      if (f.t >= f.dur) f.on = false;
    }
    if (shake.a > 0.05) {
      shake.x = (R() - 0.5) * shake.a * 2;
      shake.y = (R() - 0.5) * shake.a * 2;
      shake.a *= Math.pow(0.0015, dt);
    } else {
      shake.a = shake.x = shake.y = 0;
    }
    if (G.ui.flash > 0) G.ui.flash = Math.max(0, G.ui.flash - dt * 2.4);
  }

  function clear() {
    for (let i = 0; i < MAX_PARTICLES; ++i) P[i].on = false;
    for (let i = 0; i < rings.length; ++i) rings[i].on = false;
    for (let i = 0; i < floaters.length; ++i) floaters[i].on = false;
    live = 0;
    shake.a = 0;
  }

  function count() {
    return live;
  }

  Object.assign(NS.fx, {
    P, rings, floaters, shake, particle, burst, sparks, chunks, confetti, shape, ring, floater, addShake, flash, hitStop, slowMo, update, clear, count
  });
})();
