/* Pooled visual effects: glow and spark particles (additive), smoke, debris and rock chips
   (alpha), colour ramps over life, shockwave rings, floating score texts, and the feel controls -
   screen shake trauma, camera punch, hit-stop, slow motion and screen flash. Cosmetic randomness
   only. Owns G.fxAdd, G.fxNormal, G.rings, G.texts. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { MAX_PARTICLES, TAU } = NS.constants;
  const R = NS.rng.fx;
  const { createPool, compact } = NS.grid;

  /* particle kinds */
  const GLOW = 0, SPARK = 1, SMOKE = 2, DEBRIS = 3, EMBER = 4, CHIP = 5, SHAPE = 6;

  const FIRE = ['#ffffff', '#fff2b0', '#ffc050', '#ff7a20', '#c03010', '#401008'];
  const PLASMA = ['#ffffff', '#c8f4ff', '#60c8ff', '#2a60ff', '#101a60'];
  const TOXIC = ['#ffffff', '#e0ffd0', '#80ff70', '#20a040', '#083010'];
  const VIOLET = ['#ffffff', '#f0d0ff', '#c070ff', '#7020c0', '#200840'];
  const ICE = ['#ffffff', '#e8faff', '#9ae0ff', '#4a9ad0', '#1a3a5a'];
  const GOLD = ['#ffffff', '#fff4c0', '#ffd25a', '#e0a020', '#6a4a08'];
  const BLOOD = ['#ffffff', '#ffd0d8', '#ff5a7a', '#a01838', '#300410'];

  const pool = createPool(() => ({ alive: false }));

  function count() {
    return G.fxAdd.length + G.fxNormal.length;
  }

  function spawn(kind, x, y, vx, vy, life, size, color) {
    if (count() >= MAX_PARTICLES) return null;
    const p = pool.get();
    p.alive = true;
    p.kind = kind;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life;
    p.size = size; p.grow = 0;
    p.color = color; p.ramp = null;
    p.drag = 2;
    p.rot = 0; p.vr = 0;
    p.alpha = 1;
    p.shape = 0;
    p.grav = 0;
    (kind === SMOKE || kind === DEBRIS || kind === CHIP || kind === SHAPE ? G.fxNormal : G.fxAdd).push(p);
    return p;
  }

  function update(dt) {
    updateList(G.fxAdd, dt);
    updateList(G.fxNormal, dt);
    for (let i = 0; i < G.rings.length; ++i) {
      const r = G.rings[i];
      r.t += dt;
      if (r.t >= r.life) r.alive = false;
    }
    compact(G.rings);
    for (let i = 0; i < G.texts.length; ++i) {
      const t = G.texts[i];
      t.t += dt;
      t.y += t.vy * dt;
      t.vy *= 1 - 2.5 * dt;
      if (t.t >= t.life) t.alive = false;
    }
    compact(G.texts);
    const cam = G.cam;
    cam.trauma = Math.max(0, cam.trauma - dt * 1.7);
    cam.punch = Math.max(0, cam.punch - dt * 4);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 3.2);
  }

  function updateList(list, dt) {
    for (let i = 0; i < list.length; ++i) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      if (p.size < 0) p.size = 0;
      p.rot += p.vr * dt;
    }
    compact(list, recycle);
  }

  function recycle(p) {
    pool.put(p);
  }

  function clear() {
    for (let i = 0; i < G.fxAdd.length; ++i) pool.put(G.fxAdd[i]);
    for (let i = 0; i < G.fxNormal.length; ++i) pool.put(G.fxNormal[i]);
    G.fxAdd.length = 0;
    G.fxNormal.length = 0;
    G.rings.length = 0;
    G.texts.length = 0;
  }

  /* ── building blocks ── */
  function sparks(x, y, angle, spread, n, color, speed, life) {
    for (let i = 0; i < n; ++i) {
      const a = angle + (R() - 0.5) * spread;
      const s = (speed || 420) * (0.4 + R() * 0.8);
      const p = spawn(SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s, (life || 0.35) * (0.6 + R() * 0.7), 1.5 + R() * 2, color || '#ffd27a');
      if (p) p.drag = 3.2;
    }
  }

  function glow(x, y, size, color, life, vx, vy, grow) {
    const p = spawn(GLOW, x, y, vx || 0, vy || 0, life, size, color);
    if (p) {
      p.grow = grow || 0;
      p.drag = 3;
    }
    return p;
  }

  function smoke(x, y, n, size, color) {
    for (let i = 0; i < n; ++i) {
      const a = R() * TAU;
      const s = 20 + R() * 60;
      const p = spawn(SMOKE, x + Math.cos(a) * size * 0.3, y + Math.sin(a) * size * 0.3,
        Math.cos(a) * s, Math.sin(a) * s, 0.8 + R() * 1, size * (0.4 + R() * 0.4), color || '#3a3c48');
      if (p) {
        p.grow = size * (0.5 + R() * 0.6);
        p.drag = 1.4;
        p.alpha = 0.45 + R() * 0.25;
        p.rot = R() * TAU;
        p.vr = (R() - 0.5) * 1.2;
      }
    }
  }

  /* tumbling rock chips in the rock's own colours */
  function chips(x, y, n, speed, pal, size) {
    for (let i = 0; i < n; ++i) {
      const a = R() * TAU;
      const s = speed * (0.3 + R() * 0.9);
      const p = spawn(CHIP, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.7 + R() * 1.1, (size || 4) * (0.6 + R() * 0.9), pal[1 + Math.floor(R() * 2)]);
      if (p) {
        p.drag = 1.1;
        p.rot = R() * TAU;
        p.vr = (R() - 0.5) * 14;
        p.shape = Math.floor(R() * 4);
      }
    }
  }

  function embers(x, y, n, speed, ramp) {
    for (let i = 0; i < n; ++i) {
      const a = R() * TAU;
      const s = speed * (0.2 + R() * 1);
      const p = spawn(EMBER, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + R() * 0.9, 2 + R() * 2.5, (ramp || FIRE)[2]);
      if (p) {
        p.drag = 1.6;
        p.ramp = ramp || FIRE;
      }
    }
  }

  /* a drifting decorative shape (snowflake, petal, leaf, star) for seasonal bursts */
  function shapes(x, y, n, speed, shape, color) {
    for (let i = 0; i < n; ++i) {
      const a = R() * TAU;
      const s = speed * (0.3 + R() * 0.8);
      const p = spawn(SHAPE, x, y, Math.cos(a) * s, Math.sin(a) * s, 1 + R() * 1.2, 5 + R() * 5, color);
      if (p) {
        p.drag = 1.4;
        p.shape = shape;
        p.rot = R() * TAU;
        p.vr = (R() - 0.5) * 5;
        p.grav = 30;
      }
    }
  }

  function ring(x, y, r0, r1, life, color, width) {
    G.rings.push({ alive: true, x: x, y: y, r0: r0, r1: r1, t: 0, life: life, color: color || '#ffd8a0', width: width || 6 });
  }

  function text(x, y, str, color, size, life) {
    if (G.texts.length > 50) G.texts.shift();
    G.texts.push({ alive: true, x: x, y: y, vy: -70, t: 0, life: life || 1, str: str, color: color || '#ffffff', size: size || 16 });
  }

  /* ── composite effects ── */
  function explode(x, y, size, ramp, opts) {
    ramp = ramp || FIRE;
    const big = size > 40;
    const f = glow(x, y, size * 2, ramp[0], 0.12, 0, 0, size * 3);
    if (f) f.drag = 0;
    const balls = Math.min(16, 4 + Math.round(size / 5));
    for (let i = 0; i < balls; ++i) {
      const a = R() * TAU;
      const d = R() * size * 0.6;
      const s = (40 + R() * 110) * (size / 30);
      const p = glow(x + Math.cos(a) * d, y + Math.sin(a) * d, size * (0.4 + R() * 0.5), ramp[1],
        0.3 + R() * 0.45, Math.cos(a) * s, Math.sin(a) * s, size * (0.6 + R()));
      if (p) p.ramp = ramp;
    }
    sparks(x, y, 0, TAU, Math.min(30, 8 + Math.round(size / 2)), ramp[1], 260 + size * 6, 0.45);
    embers(x, y, Math.min(20, 4 + Math.round(size / 4)), 120 + size * 4, ramp);
    smoke(x, y, Math.min(10, 2 + Math.round(size / 8)), size * 0.9, opts && opts.smoke);
    if (opts && opts.pal) chips(x, y, Math.min(18, 3 + Math.round(size / 4)), 140 + size * 4, opts.pal, 3 + size / 10);
    ring(x, y, size * 0.3, size * (big ? 3.6 : 2.6), big ? 0.55 : 0.4, ramp[1], big ? 9 : 5);
    if (big) ring(x, y, size * 0.2, size * 2, 0.35, '#ffffff', 3);
    shake(Math.min(0.6, size / 100));
  }

  /* a rock shattering: chips and dust rather than fire */
  function shatter(x, y, size, pal, glowCol) {
    chips(x, y, Math.min(20, 4 + Math.round(size / 3)), 90 + size * 4, pal, 2.5 + size / 9);
    smoke(x, y, Math.min(6, 1 + Math.round(size / 12)), size * 0.8, pal[2]);
    sparks(x, y, 0, TAU, Math.min(16, 4 + Math.round(size / 4)), glowCol || pal[3], 180 + size * 5, 0.35);
    const g = glow(x, y, size * 1.4, glowCol || pal[3], 0.18, 0, 0, size * 2);
    if (g) g.drag = 0;
    ring(x, y, size * 0.4, size * 1.9, 0.32, glowCol || pal[3], size > 30 ? 5 : 3);
    shake(Math.min(0.35, size / 160));
  }

  function hitSpark(x, y, angle, color) {
    sparks(x, y, angle, 1.4, 4, color, 280, 0.2);
    glow(x, y, 12, color || '#ffd27a', 0.1);
  }

  function muzzle(x, y, color) {
    const p = glow(x, y, 14, color, 0.07);
    if (p) p.drag = 0;
  }

  function exhaust(x, y, vx, vy, size, color, ramp) {
    const p = spawn(GLOW, x, y, vx, vy, 0.26 + R() * 0.14, size, color);
    if (p) {
      p.grow = -size * 2.2;
      p.drag = 2.5;
      p.ramp = ramp || null;
    }
    return p;
  }

  function shockwave(x, y, radius, color) {
    ring(x, y, 10, radius, 0.5, color || '#bfe8ff', 14);
    ring(x, y, 5, radius * 0.7, 0.4, '#ffffff', 4);
    glow(x, y, radius * 0.6, color || '#bfe8ff', 0.25, 0, 0, radius);
  }

  /* ── feel ── */
  function shake(amount) {
    const k = G.save ? G.save.settings.shake : 1;
    G.cam.trauma = Math.min(1, G.cam.trauma + amount * k);
  }

  function punch(amount) {
    G.cam.punch = Math.min(0.06, G.cam.punch + amount);
  }

  function hitStop(t) {
    G.hitStop = Math.max(G.hitStop, t);
  }

  function slowMo(t, scale) {
    G.slowMo = Math.max(G.slowMo, t);
    G.slowScale = scale;
  }

  function flash(color, amount) {
    G.flashColor = color;
    G.flash = Math.max(G.flash, amount);
  }

  function banner(title, sub, color, life) {
    G.banner = { title: title, sub: sub || '', color: color || '#ffffff', t: 0, life: life || 2.4 };
  }

  Object.assign(NS.fx, {
    GLOW, SPARK, SMOKE, DEBRIS, EMBER, CHIP, SHAPE, FIRE, PLASMA, TOXIC, VIOLET, ICE, GOLD, BLOOD,
    spawn, update, clear, count, sparks, glow, smoke, chips, embers, shapes, ring, text, explode, shatter, hitSpark,
    muzzle, exhaust, shockwave, shake, punch, hitStop, slowMo, flash, banner
  });
})();
