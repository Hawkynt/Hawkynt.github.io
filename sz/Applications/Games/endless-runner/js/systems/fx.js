/* Pooled visual effects in world coordinates: particles in flat typed arrays (glows, dots,
   streaks and shaped flakes - leaves, petals, stars, snow, squares, bats, bubbles - removed by
   swapping with the last), shockwave rings, floating texts, and the feel controls: screen shake,
   flash, hit-stop and slow motion. Owns the pools; the renderer reads them. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { MAX_PARTICLES, MAX_TEXTS, MAX_RINGS, MAX_SHAKE, TAU } = NS.constants;
  const R = NS.rng.fx;

  /* particle kinds */
  const GLOW = 0, DOT = 1, LEAF = 2, PETAL = 3, STAR = 4, SNOW = 5, SQUARE = 6, BAT = 7, BUBBLE = 8, STREAK = 9, RIBBON = 10;
  const SHAPES = { dot: DOT, glow: GLOW, leaf: LEAF, petal: PETAL, star: STAR, snow: SNOW, square: SQUARE, bat: BAT, bubble: BUBBLE, ribbon: RIBBON };

  const N = MAX_PARTICLES;
  const P = {
    n: 0,
    x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N),
    life: new Float32Array(N), max: new Float32Array(N), size: new Float32Array(N), rot: new Float32Array(N),
    vr: new Float32Array(N), grav: new Float32Array(N), drag: new Float32Array(N), kind: new Uint8Array(N),
    color: new Array(N), layer: new Uint8Array(N),
  };
  const texts = [];
  const rings = [];

  /* one particle; layer 1 draws in front of the runner, 0 behind */
  function spawn(kind, x, y, vx, vy, life, size, color, grav, layer) {
    if (P.n >= N) return -1;
    const k = P.n++;
    P.kind[k] = kind;
    P.x[k] = x; P.y[k] = y; P.vx[k] = vx; P.vy[k] = vy;
    P.life[k] = life; P.max[k] = life; P.size[k] = size;
    P.rot[k] = R() * TAU; P.vr[k] = (R() - 0.5) * 6;
    P.grav[k] = grav || 0; P.drag[k] = 1.6;
    P.color[k] = color;
    P.layer[k] = layer === undefined ? 1 : layer;
    return k;
  }

  function burst(x, y, n, color, speed, life, size, kind, grav) {
    for (let j = 0; j < n; ++j) {
      const a = R() * TAU, s = speed * (0.35 + R() * 0.65);
      spawn(kind === undefined ? GLOW : kind, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + R() * 0.5),
        size * (0.6 + R() * 0.6), Array.isArray(color) ? color[j % color.length] : color, grav);
    }
  }

  /* a fan of particles in a direction */
  function spray(x, y, ang, spread, n, color, speed, life, size, kind, grav) {
    for (let j = 0; j < n; ++j) {
      const a = ang + (R() - 0.5) * spread, s = speed * (0.4 + R() * 0.6);
      spawn(kind === undefined ? GLOW : kind, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + R() * 0.5),
        size * (0.6 + R() * 0.6), Array.isArray(color) ? color[j % color.length] : color, grav);
    }
  }

  /* chunks of a smashed obstacle: tumbling squares in its colours */
  function debris(x, y, colors, n, power) {
    for (let j = 0; j < n; ++j) {
      const a = -Math.PI / 2 + (R() - 0.3) * 2.2, s = (power || 520) * (0.4 + R() * 0.6);
      const k = spawn(SQUARE, x + (R() - 0.5) * 30, y + (R() - 0.5) * 30, Math.cos(a) * s + 200, Math.sin(a) * s, 0.9 + R() * 0.5,
        8 + R() * 10, colors[j % colors.length], 1600, 1);
      if (k >= 0) P.drag[k] = 0.3;
    }
  }

  function text(x, y, str, color, size, life) {
    if (texts.length >= MAX_TEXTS) texts.shift();
    texts.push({ x: x, y: y, vy: -90, str: str, color: color || '#ffffff', size: size || 22, t: 0, life: life || 1.0 });
  }

  function ring(x, y, r0, r1, life, color, width) {
    if (rings.length >= MAX_RINGS) rings.shift();
    rings.push({ x: x, y: y, r0: r0, r1: r1, t: 0, life: life, color: color, width: width || 4 });
  }

  function shake(amount) {
    if (G.save && G.save.opts && G.save.opts.shake === 0) return;
    G.shake = Math.min(MAX_SHAKE, G.shake + amount);
  }

  function flash(color, a) {
    G.flash.color = color || '#ffffff';
    G.flash.a = Math.max(G.flash.a, a || 0.5);
  }

  function hitstop(t) {
    G.hitstop = Math.max(G.hitstop, t);
  }

  function slowmo(t) {
    G.slowmo = Math.max(G.slowmo, t);
  }

  function update(dt) {
    let n = P.n;
    for (let k = 0; k < n; ++k) {
      P.life[k] -= dt;
      if (P.life[k] <= 0) {
        --n;
        if (k !== n) {
          P.kind[k] = P.kind[n]; P.x[k] = P.x[n]; P.y[k] = P.y[n]; P.vx[k] = P.vx[n]; P.vy[k] = P.vy[n];
          P.life[k] = P.life[n]; P.max[k] = P.max[n]; P.size[k] = P.size[n]; P.rot[k] = P.rot[n]; P.vr[k] = P.vr[n];
          P.grav[k] = P.grav[n]; P.drag[k] = P.drag[n]; P.color[k] = P.color[n]; P.layer[k] = P.layer[n];
        }
        --k;
        continue;
      }
      const d = 1 - P.drag[k] * dt;
      P.vx[k] *= d;
      P.vy[k] = P.vy[k] * d + P.grav[k] * dt;
      P.x[k] += P.vx[k] * dt;
      P.y[k] += P.vy[k] * dt;
      P.rot[k] += P.vr[k] * dt;
    }
    P.n = n;
    for (let i = texts.length - 1; i >= 0; --i) {
      const t = texts[i];
      t.t += dt;
      t.y += t.vy * dt;
      t.vy *= 1 - 2.8 * dt;
      if (t.t >= t.life) texts.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; --i) {
      rings[i].t += dt;
      if (rings[i].t >= rings[i].life) rings.splice(i, 1);
    }
    G.shake = Math.max(0, G.shake - dt * 34);
    const s = G.shake;
    G.shakeX = s > 0.3 ? (R() - 0.5) * s : 0;
    G.shakeY = s > 0.3 ? (R() - 0.5) * s : 0;
    if (G.flash.a > 0) G.flash.a = Math.max(0, G.flash.a - dt * 2.6);
  }

  function clear() {
    P.n = 0;
    texts.length = 0;
    rings.length = 0;
    G.shake = 0;
    G.flash.a = 0;
    G.hitstop = 0;
    G.slowmo = 0;
  }

  Object.assign(NS.fx, {
    GLOW, DOT, LEAF, PETAL, STAR, SNOW, SQUARE, BAT, BUBBLE, STREAK, RIBBON, SHAPES, P, texts, rings,
    spawn, burst, spray, debris, text, ring, shake, flash, hitstop, slowmo, update, clear
  });
})();
