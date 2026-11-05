/* Game feel: a fixed pool of particles (sparks, embers, smoke, debris, confetti, petals),
   shockwave rings, floating texts, screen shake, hit-stop, flashes and banners, plus the sound
   wrapper (quieter in Zen). Spawners take tile or plane coordinates; nothing is allocated per
   frame once the pool is warm. Owns G.fx and the feel timers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { TILE, ARENA_X, ARENA_Y, TAU } = C;
  const rnd = NS.rng.fx;

  const POOL = 1100;
  const parts = G.fx.parts;
  for (let i = 0; i < POOL; ++i)
    parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, grow: 0, color: '#fff', kind: 0, add: false, g: 0, drag: 0, rot: 0, vr: 0 });
  let cursor = 0;

  /* kind: 0 glow dot, 1 spark streak, 2 debris chip, 3 smoke puff, 4 confetti, 5 leaf/petal, 6 star */
  function emit(x, y, vx, vy, life, size, color, kind, add, g, drag) {
    for (let n = 0; n < POOL; ++n) {
      cursor = (cursor + 1) % POOL;
      const p = parts[cursor];
      if (p.on && n < POOL - 1) continue;
      p.on = true;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.max = life; p.size = size; p.grow = 0;
      p.color = color; p.kind = kind; p.add = !!add;
      p.g = g || 0; p.drag = drag || 0;
      p.rot = rnd() * TAU; p.vr = (rnd() - 0.5) * 10;
      return p;
    }
    return null;
  }

  function px(c) {
    return ARENA_X + (c + 0.5) * TILE;
  }

  function py(r) {
    return ARENA_Y + (r + 0.5) * TILE;
  }

  function burst(x, y, n, color, speed, life, kind, add, g) {
    for (let i = 0; i < n; ++i) {
      const a = rnd() * TAU, s = speed * (0.3 + rnd() * 0.7);
      emit(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + rnd() * 0.6), 2 + rnd() * 3, color, kind || 0, add !== false, g || 0, 2.5);
    }
  }

  /* The blast on one fire cell: hot core, embers and a lazy smoke puff */
  function flame(c, r, strength) {
    const x = px(c), y = py(r);
    const n = strength > 1 ? 4 : 2;
    for (let i = 0; i < n; ++i) {
      const a = rnd() * TAU, s = 40 + rnd() * 120;
      emit(x, y, Math.cos(a) * s, Math.sin(a) * s - 30, 0.35 + rnd() * 0.3, 3 + rnd() * 4, rnd() < 0.5 ? '#ffd23a' : '#ff7a1a', 0, true, -60, 3);
    }
    if (rnd() < 0.6) emit(x + (rnd() - 0.5) * 20, y, (rnd() - 0.5) * 20, -30 - rnd() * 30, 0.9 + rnd() * 0.6, 10 + rnd() * 8, 'rgba(70,60,70,0.5)', 3, false, -20, 1.2);
  }

  function explosion(c, r, range) {
    const x = px(c), y = py(r);
    burst(x, y, 26, '#ffe066', 380, 0.5, 1, true);
    burst(x, y, 12, '#ff5a1a', 200, 0.7, 0, true);
    ring(x, y, 8, TILE * (1.2 + range * 0.35), 0.35, '#fff1b0', 6);
    G.flash = Math.max(G.flash, 0.12);
    G.flashColor = '#ffe9b0';
    shake(4 + range * 1.1);
  }

  function debris(c, r, color, n) {
    const x = px(c), y = py(r);
    for (let i = 0; i < n; ++i) {
      const a = -Math.PI * (0.1 + rnd() * 0.8), s = 120 + rnd() * 220;
      const p = emit(x + (rnd() - 0.5) * 24, y + (rnd() - 0.5) * 24, Math.cos(a) * s, Math.sin(a) * s, 0.7 + rnd() * 0.5, 4 + rnd() * 5, color, 2, false, 900, 0.5);
      if (p) p.vr = (rnd() - 0.5) * 16;
    }
  }

  function crumble(c, r) {
    const pal = NS.story.WORLDS[G.run ? G.run.level.world : 0].palette;
    debris(c, r, pal.softA, 6);
    debris(c, r, pal.softB, 4);
    const x = px(c), y = py(r);
    for (let i = 0; i < 3; ++i)
      emit(x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30, (rnd() - 0.5) * 40, -20 - rnd() * 30, 0.8 + rnd() * 0.4, 12 + rnd() * 8, 'rgba(200,180,160,0.45)', 3, false, -10, 1.5);
  }

  function sparkle(c, r, color, n) {
    const x = px(c), y = py(r);
    for (let i = 0; i < n; ++i) {
      const a = rnd() * TAU, s = 60 + rnd() * 160;
      emit(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + rnd() * 0.5, 3 + rnd() * 3, color, 6, true, 0, 3);
    }
  }

  function confetti(x, y, n) {
    const cols = ['#ff5da0', '#ffd84a', '#4fd0ff', '#7cf08a', '#c58bff', '#ff8a3c'];
    for (let i = 0; i < n; ++i) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2, s = 200 + rnd() * 380;
      emit(x, y, Math.cos(a) * s, Math.sin(a) * s, 1.4 + rnd() * 1.2, 4 + rnd() * 4, cols[i % cols.length], 4, false, 420, 1.6);
    }
  }

  function trail(x, y, color, kind) {
    emit(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 8, (rnd() - 0.5) * 30, -10 - rnd() * 30, 0.6 + rnd() * 0.4, 3 + rnd() * 3, color, kind, kind !== 4 && kind !== 5, kind === 5 ? 30 : 0, 1);
  }

  /* Ambient seasonal particles across the visible plane */
  function ambient(kind, rect) {
    const x = rect.x0 + rnd() * rect.w;
    switch (kind) {
      case 'snow': emit(x, rect.y0 - 10, (rnd() - 0.3) * 30, 30 + rnd() * 40, 14, 2 + rnd() * 3, 'rgba(255,255,255,0.85)', 0, false, 0, 0); break;
      case 'petals': emit(x, rect.y0 - 10, 20 + rnd() * 30, 30 + rnd() * 30, 14, 4 + rnd() * 3, rnd() < 0.5 ? '#ffc0dc' : '#ffe2f0', 5, false, 0, 0); break;
      case 'leaves': emit(x, rect.y0 - 10, 10 + rnd() * 40, 40 + rnd() * 40, 14, 5 + rnd() * 3, rnd() < 0.5 ? '#ff8a2a' : rnd() < 0.5 ? '#d8501a' : '#ffc040', 5, false, 0, 0); break;
      case 'motes': emit(x, rect.y1 + 10, (rnd() - 0.5) * 10, -20 - rnd() * 20, 14, 2 + rnd() * 2, 'rgba(255,240,170,0.7)', 0, true, 0, 0); break;
      case 'confetti': emit(x, rect.y0 - 10, (rnd() - 0.5) * 40, 40 + rnd() * 40, 14, 3 + rnd() * 3, ['#ff5da0', '#ffd84a', '#4fd0ff', '#7cf08a'][(rnd() * 4) | 0], 4, false, 0, 0); break;
      case 'embers': emit(x, rect.y1 + 10, (rnd() - 0.5) * 30, -40 - rnd() * 50, 10, 2 + rnd() * 2, rnd() < 0.5 ? '#ff7a1a' : '#ffc040', 0, true, 0, 0); break;
      case 'dust': emit(x, rect.y0 + rnd() * rect.h, (rnd() - 0.5) * 12, (rnd() - 0.5) * 12, 6, 1.5 + rnd() * 2, 'rgba(255,255,255,0.35)', 0, true, 0, 0); break;
    }
  }

  function ring(x, y, r0, r1, life, color, width) {
    if (G.fx.rings.length > 40) G.fx.rings.shift();
    G.fx.rings.push({ x: x, y: y, r0: r0, r1: r1, life: life, max: life, color: color, w: width || 4 });
  }

  function textAt(x, y, str, color, size) {
    if (G.fx.texts.length > 30) G.fx.texts.shift();
    G.fx.texts.push({ x: x, y: y, str: String(str), color: color || '#fff', size: size || 16, life: 1.1, max: 1.1 });
  }

  function text(c, r, str, color, size) {
    textAt(px(c), py(r) - 18, str, color, size);
  }

  function shake(amount) {
    G.shake = Math.min(24, Math.max(G.shake, amount));
  }

  function hitstop(t) {
    G.hitStop = Math.max(G.hitStop, t);
  }

  function flash(color, amount) {
    G.flash = Math.max(G.flash, amount);
    G.flashColor = color;
  }

  function banner(str, sub, color, dur) {
    G.banner = { text: str, sub: sub || '', color: color || '#ffd84a', t: 0, dur: dur || 1.8 };
  }

  function sfx(name, opts) {
    if (!SZ.GameAudio) return;
    if (G.run && G.run.mode === 'zen') {
      opts = Object.assign({}, opts);
      opts.volume = (opts.volume == null ? 1 : opts.volume) * 0.45;
    }
    SZ.GameAudio.play(name, opts);
  }

  function update(dt) {
    let live = 0;
    for (let i = 0; i < POOL; ++i) {
      const p = parts[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      ++live;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.g * dt;
      if (p.kind === 5) p.vx += Math.sin((G.time + i) * 2) * 30 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    G.fx.live = live;
    const rings = G.fx.rings;
    for (let i = rings.length - 1; i >= 0; --i) if ((rings[i].life -= dt) <= 0) rings.splice(i, 1);
    const texts = G.fx.texts;
    for (let i = texts.length - 1; i >= 0; --i) {
      const t = texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) texts.splice(i, 1);
    }
    G.shake = Math.max(0, G.shake - dt * 30);
    G.shakeX = G.shake ? (rnd() - 0.5) * G.shake : 0;
    G.shakeY = G.shake ? (rnd() - 0.5) * G.shake : 0;
    G.flash = Math.max(0, G.flash - dt * 2.4);
    if (G.banner) {
      G.banner.t += dt;
      if (G.banner.t > G.banner.dur) G.banner = null;
    }
  }

  function clear() {
    for (let i = 0; i < POOL; ++i) parts[i].on = false;
    G.fx.rings.length = 0;
    G.fx.texts.length = 0;
    G.shake = 0;
    G.flash = 0;
    G.banner = null;
  }

  Object.assign(NS.fx, {
    POOL, emit, px, py, burst, flame, explosion, debris, crumble, sparkle, confetti, trail, ambient, ring, textAt, text,
    shake, hitstop, flash, banner, sfx, update, clear
  });
})();
