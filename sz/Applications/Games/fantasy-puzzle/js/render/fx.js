;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Sprite particles for the Fantasy Puzzle. Every particle is one drawImage of
   * a cached sprite (glow, flame, smoke, droplet, rock chunk, leaf, flake, wisp,
   * confetti, star); normal sprites are drawn first, glowing ones afterwards in
   * one additive pass. A system is capped (400 by default) and reuses its
   * particle objects, emitters keep spawning for a while (a burning tile, a
   * rising rocket), and the presets below turn the four elements, runes, the
   * portal, footsteps and the realm air into particles.
   *
   * Units are whatever space the system is drawn in; y grows downward.
   */

  const TWO_PI = Math.PI * 2;
  const SPRITE = 64;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function rgb(hex) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    const c = rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function rnd(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  /* ── sprites, one canvas per kind and colour ── */

  const ADDITIVE = { glow: true, spark: true, flame: true, wisp: true, star: true, ember: true };
  const spriteCache = {};

  function paintSprite(kind, color) {
    const c = makeCanvas(SPRITE, SPRITE);
    const g = c.getContext('2d');
    const h = SPRITE / 2;
    if (kind === 'glow' || kind === 'spark' || kind === 'ember') {
      const rg = g.createRadialGradient(h, h, 0, h, h, h);
      rg.addColorStop(0, kind === 'glow' ? rgba(color, 0.9) : '#ffffff');
      rg.addColorStop(kind === 'glow' ? 0.3 : 0.12, rgba(color, kind === 'glow' ? 0.45 : 1));
      rg.addColorStop(kind === 'glow' ? 0.65 : 0.35, rgba(color, kind === 'glow' ? 0.12 : 0.35));
      rg.addColorStop(1, rgba(color, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, SPRITE, SPRITE);
    } else if (kind === 'flame') {
      /* a teardrop: white-yellow core into the colour, tip up */
      const rg = g.createRadialGradient(h, h + 10, 0, h, h + 6, h);
      rg.addColorStop(0, '#fff8d0');
      rg.addColorStop(0.25, '#ffd060');
      rg.addColorStop(0.55, rgba(color, 0.8));
      rg.addColorStop(1, rgba(color, 0));
      g.fillStyle = rg;
      g.beginPath();
      g.moveTo(h, 2);
      g.bezierCurveTo(h + 12, h - 8, h + 26, h + 14, h, SPRITE - 4);
      g.bezierCurveTo(h - 26, h + 14, h - 12, h - 8, h, 2);
      g.fill();
    } else if (kind === 'smoke') {
      const rg = g.createRadialGradient(h, h, 0, h, h, h);
      rg.addColorStop(0, rgba(color, 0.75));
      rg.addColorStop(0.5, rgba(color, 0.4));
      rg.addColorStop(1, rgba(color, 0));
      g.fillStyle = rg;
      for (let k = 0; k < 4; ++k) {
        g.beginPath();
        g.arc(h + Math.cos(k * 1.7) * 8, h + Math.sin(k * 2.3) * 7, h * 0.7, 0, TWO_PI);
        g.fill();
      }
    } else if (kind === 'drop') {
      g.fillStyle = rgba(color, 0.85);
      g.beginPath();
      g.moveTo(h, 8);
      g.quadraticCurveTo(h + 18, h + 10, h, SPRITE - 8);
      g.quadraticCurveTo(h - 18, h + 10, h, 8);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.ellipse(h - 5, h + 6, 3.5, 6, -0.3, 0, TWO_PI);
      g.fill();
    } else if (kind === 'chunk') {
      g.translate(h, h);
      g.beginPath();
      const n = 6;
      for (let k = 0; k < n; ++k) {
        const a = k * TWO_PI / n, r = 18 + ((k * 7) % 5) * 3;
        if (k === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = color;
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.beginPath();
      g.moveTo(-14, -8);
      g.lineTo(0, -18);
      g.lineTo(8, -10);
      g.lineTo(-6, -2);
      g.closePath();
      g.fill();
    } else if (kind === 'leaf') {
      g.translate(h, h);
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(0, 0, 26, 12, 0, 0, TWO_PI);
      g.fill();
      g.strokeStyle = 'rgba(40,16,4,0.5)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-26, 0);
      g.lineTo(26, 0);
      g.stroke();
    } else if (kind === 'flake') {
      const rg = g.createRadialGradient(h, h, 0, h, h, h);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.4, 'rgba(240,248,255,0.8)');
      rg.addColorStop(1, 'rgba(220,235,255,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, SPRITE, SPRITE);
    } else if (kind === 'bubble') {
      g.strokeStyle = rgba(color, 0.9);
      g.lineWidth = 4;
      g.beginPath();
      g.arc(h, h, h - 6, 0, TWO_PI);
      g.stroke();
      g.fillStyle = rgba(color, 0.15);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.arc(h - 9, h - 9, 5, 0, TWO_PI);
      g.fill();
    } else if (kind === 'wisp') {
      g.lineCap = 'round';
      for (let k = 0; k < 3; ++k) {
        g.strokeStyle = rgba(color, k === 0 ? 0.9 : 0.35);
        g.lineWidth = k === 0 ? 3 : 7 - k;
        g.beginPath();
        g.arc(h, h + 18, 24, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      }
    } else if (kind === 'confetti') {
      g.fillStyle = color;
      g.fillRect(12, 22, 40, 20);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(12, 22, 40, 6);
    } else if (kind === 'star') {
      g.translate(h, h);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, h);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.2, rgba(color, 0.9));
      rg.addColorStop(1, rgba(color, 0));
      g.fillStyle = rg;
      g.beginPath();
      for (let k = 0; k < 8; ++k) {
        const a = k * Math.PI / 4, r = k % 2 ? 7 : h;
        if (k === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    }
    return c;
  }

  function sprite(kind, color) {
    const key = kind + color;
    let c = spriteCache[key];
    if (!c) {
      c = paintSprite(kind, color);
      spriteCache[key] = c;
    }
    return c;
  }

  /* ══════════════════════════════════════════════════════════════════
     SYSTEM
     ══════════════════════════════════════════════════════════════════ */

  function create(max) {
    const cap = max || 400;
    const live = [];
    const pool = [];
    const emitters = [];

    /* p: { kind, color, x, y, vx, vy, ay, drag, life, size, size1, rot, vr,
            alpha, fadeIn, wobble, stretch, ambient, onDeath } */
    function spawn(p) {
      if (live.length >= cap) {
        if (p.ambient)
          return null;
        /* make room: drop the oldest ambient particle, else the oldest one */
        let k = -1;
        for (let i = 0; i < live.length; ++i)
          if (live[i].ambient) { k = i; break; }
        const old = live.splice(k >= 0 ? k : 0, 1)[0];
        pool.push(old);
      }
      const q = pool.pop() || {};
      q.kind = p.kind || 'glow';
      q.color = p.color || '#ffffff';
      q.img = sprite(q.kind, q.color);
      q.add = ADDITIVE[q.kind] === true;
      q.x = p.x; q.y = p.y;
      q.vx = p.vx || 0; q.vy = p.vy || 0;
      q.ay = p.ay || 0;
      q.drag = p.drag || 0;
      q.life = q.max = p.life || 1;
      q.size = p.size || 8;
      q.size1 = p.size1 !== undefined ? p.size1 : q.size;
      q.rot = p.rot !== undefined ? p.rot : Math.random() * TWO_PI;
      q.vr = p.vr || 0;
      q.alpha = p.alpha !== undefined ? p.alpha : 1;
      q.fadeIn = p.fadeIn || 0;
      q.wobble = p.wobble || 0;
      q.phase = Math.random() * TWO_PI;
      q.stretch = p.stretch || 0;
      q.flip = p.flip || 0;
      q.ambient = !!p.ambient;
      q.onDeath = p.onDeath || null;
      q.age = 0;
      live.push(q);
      return q;
    }

    /* an emitter calls fn(sys, k, dt, e) every frame for dur seconds, k = 0..1 */
    function emit(dur, fn, data) {
      emitters.push({ t: 0, dur: dur, fn: fn, data: data || null });
    }

    function update(dt) {
      if (!(dt > 0))
        return;
      for (let i = emitters.length - 1; i >= 0; --i) {
        const e = emitters[i];
        e.t += dt;
        e.fn(api, Math.min(1, e.t / e.dur), dt, e);
        if (e.t >= e.dur)
          emitters.splice(i, 1);
      }
      for (let i = live.length - 1; i >= 0; --i) {
        const q = live[i];
        q.age += dt;
        q.life -= dt;
        if (q.life <= 0) {
          live.splice(i, 1);
          pool.push(q);
          if (q.onDeath)
            q.onDeath(api, q);
          continue;
        }
        if (q.drag) {
          const f = Math.max(0, 1 - q.drag * dt);
          q.vx *= f;
          q.vy *= f;
        }
        q.vy += q.ay * dt;
        q.x += q.vx * dt + (q.wobble ? Math.sin(q.age * 3 + q.phase) * q.wobble * dt : 0);
        q.y += q.vy * dt;
        q.rot += q.vr * dt;
      }
    }

    function drawSet(ctx, additive) {
      const base = ctx.globalAlpha;
      for (let i = 0; i < live.length; ++i) {
        const q = live[i];
        if (q.add !== additive)
          continue;
        const k = 1 - q.life / q.max;
        let a = q.alpha * (k > 0.6 ? (1 - k) / 0.4 : 1);
        if (q.fadeIn && q.age < q.fadeIn)
          a *= q.age / q.fadeIn;
        if (a <= 0.004)
          continue;
        const s = q.size + (q.size1 - q.size) * k;
        ctx.globalAlpha = base * Math.min(1, a);
        if (q.stretch) {
          const sp = Math.sqrt(q.vx * q.vx + q.vy * q.vy);
          const len = s + sp * q.stretch;
          ctx.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
          ctx.translate(q.x, q.y);
          ctx.rotate(Math.atan2(q.vy, q.vx));
          ctx.drawImage(q.img, -len / 2, -s / 2, len, s);
          ctx.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
        } else if (q.kind === 'chunk' || q.kind === 'leaf' || q.kind === 'confetti' || q.kind === 'wisp' || q.kind === 'flame') {
          ctx.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
          ctx.translate(q.x, q.y);
          ctx.rotate(q.kind === 'flame' ? Math.sin(q.age * 9 + q.phase) * 0.18 : q.rot);
          if (q.flip)
            ctx.scale(1, Math.cos(q.age * q.flip + q.phase));
          ctx.drawImage(q.img, -s / 2, -s / 2, s, s);
          ctx.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
        } else {
          ctx.drawImage(q.img, q.x - s / 2, q.y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = base;
    }

    const tf = [1, 0, 0, 1, 0, 0];

    function draw(ctx) {
      if (!live.length)
        return;
      const m = ctx.getTransform ? ctx.getTransform() : null;
      if (m) {
        tf[0] = m.a; tf[1] = m.b; tf[2] = m.c; tf[3] = m.d; tf[4] = m.e; tf[5] = m.f;
      }
      drawSet(ctx, false);
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      drawSet(ctx, true);
      ctx.globalCompositeOperation = prev;
    }

    function clear() {
      while (live.length)
        pool.push(live.pop());
      emitters.length = 0;
    }

    const api = {
      spawn: spawn,
      emit: emit,
      update: update,
      draw: draw,
      clear: clear,
      get count() { return live.length; },
      get busy() { return emitters.length > 0; }
    };
    return api;
  }

  /* ══════════════════════════════════════════════════════════════════
     PRESETS (board space: 64 units per tile)
     ══════════════════════════════════════════════════════════════════ */

  function flash(sys, x, y, color, size, life) {
    sys.spawn({ kind: 'glow', color: color, x: x, y: y, size: size * 0.6, size1: size, life: life || 0.35, alpha: 0.9 });
  }

  /* a tile catching fire: flames licking up, embers, rolling smoke */
  function fire(sys, x, y, dur) {
    flash(sys, x, y, '#ff8a2a', 150, 0.5);
    sys.emit(dur || 1.4, function(s, k, dt) {
      const rate = (1 - k * 0.7);
      if (Math.random() < 70 * dt * rate)
        s.spawn({ kind: 'flame', color: Math.random() < 0.5 ? '#ff5a1a' : '#ff8a2a', x: x + rnd(-22, 22), y: y + rnd(-4, 20),
          vx: rnd(-8, 8), vy: rnd(-80, -45), life: rnd(0.4, 0.7), size: rnd(24, 40), size1: 6 });
      if (Math.random() < 18 * dt)
        s.spawn({ kind: 'ember', color: '#ff9a3a', x: x + rnd(-18, 18), y: y + rnd(-4, 14),
          vx: rnd(-25, 25), vy: rnd(-120, -60), drag: 0.8, wobble: 40, life: rnd(0.8, 1.5), size: rnd(4, 7), size1: 1 });
      if (Math.random() < 9 * dt * (0.4 + k))
        s.spawn({ kind: 'smoke', color: '#3a3430', x: x + rnd(-14, 14), y: y - 10,
          vx: rnd(-6, 10), vy: rnd(-40, -25), life: rnd(1.0, 1.6), size: 18, size1: 52, alpha: 0.45, fadeIn: 0.2 });
    });
  }

  /* ice cracking into steam and meltwater */
  function melt(sys, x, y) {
    flash(sys, x, y, '#8ae0ff', 110, 0.4);
    for (let k = 0; k < 12; ++k) {
      const a = rnd(0, TWO_PI), v = rnd(60, 150);
      sys.spawn({ kind: 'chunk', color: '#bfeaff', x: x, y: y - 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, ay: 380,
        drag: 0.6, vr: rnd(-8, 8), life: rnd(0.5, 0.8), size: rnd(6, 11), size1: 3 });
    }
    sys.emit(1.2, function(s, k, dt) {
      if (Math.random() < 30 * dt * (1 - k * 0.6))
        s.spawn({ kind: 'smoke', color: '#eef8ff', x: x + rnd(-20, 20), y: y + rnd(-6, 12),
          vx: rnd(-10, 10), vy: rnd(-55, -30), life: rnd(1.1, 1.7), size: 20, size1: 72, alpha: 0.5, fadeIn: 0.15 });
    });
    splashDrops(sys, x, y, 8, '#9ad8ff', 0.7);
  }

  function splashDrops(sys, x, y, n, color, power) {
    for (let k = 0; k < n; ++k) {
      const a = -Math.PI / 2 + rnd(-1.2, 1.2), v = rnd(90, 170) * (power || 1);
      sys.spawn({ kind: 'drop', color: color, x: x + rnd(-10, 10), y: y + rnd(-4, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        ay: 520, life: rnd(0.45, 0.75), size: rnd(5, 8), size1: 3, stretch: 0.03 });
    }
  }

  /* water bursting into a channel: a splash crown, droplets and mist */
  function splash(sys, x, y) {
    flash(sys, x, y, '#5ac8ff', 90, 0.3);
    for (let k = 0; k < 14; ++k) {
      const a = k / 14 * TWO_PI;
      sys.spawn({ kind: 'drop', color: '#bdeaff', x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 9,
        vx: Math.cos(a) * rnd(40, 90), vy: rnd(-230, -150), ay: 560, life: rnd(0.6, 0.85), size: rnd(7, 11), size1: 3, stretch: 0.03 });
    }
    splashDrops(sys, x, y, 6, '#e8f8ff', 1.1);
    for (let k = 0; k < 4; ++k)
      sys.spawn({ kind: 'smoke', color: '#dff4ff', x: x + rnd(-16, 16), y: y + rnd(-4, 8), vx: rnd(-15, 15), vy: rnd(-25, -10),
        life: rnd(0.8, 1.3), size: 22, size1: 64, alpha: 0.4 });
    for (let k = 0; k < 5; ++k)
      sys.spawn({ kind: 'bubble', color: '#cfefff', x: x + rnd(-20, 20), y: y + rnd(-10, 14), vy: rnd(-25, -10), wobble: 20,
        life: rnd(0.6, 1.1), size: rnd(4, 8), alpha: 0.8 });
  }

  /* the ground heaving: rock debris thrown up, dust rolling out */
  function quake(sys, x, y, rock, dust) {
    flash(sys, x, y, '#ffd08a', 80, 0.25);
    for (let k = 0; k < 22; ++k) {
      const a = -Math.PI / 2 + rnd(-1.3, 1.3), v = rnd(110, 250);
      sys.spawn({ kind: 'chunk', color: k % 3 ? rock : '#5a4a3a', x: x + rnd(-14, 14), y: y + rnd(-6, 10),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 620, vr: rnd(-10, 10), life: rnd(0.7, 1.0), size: rnd(8, 16), size1: 5 });
    }
    dustRing(sys, x, y + 12, dust, 16, 1.4);
    sys.spawn({ kind: 'smoke', color: dust, x: x, y: y, vy: -30, life: 1.2, size: 40, size1: 110, alpha: 0.5 });
  }

  function dustRing(sys, x, y, color, n, power) {
    for (let k = 0; k < n; ++k) {
      const a = k / n * TWO_PI + rnd(-0.2, 0.2), v = rnd(40, 80) * (power || 1);
      sys.spawn({ kind: 'smoke', color: color, x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 4,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.45 - 8, drag: 2.2, life: rnd(0.9, 1.4), size: 22, size1: 58, alpha: 0.6 });
    }
  }

  /* a gust: wind arcs streaming along dir, leaves caught in it */
  function gust(sys, x, y, dx, dy, leaf) {
    const ang = Math.atan2(dy, dx);
    for (let k = 0; k < 10; ++k) {
      const off = rnd(-24, 24);
      const sp = rnd(260, 380);
      sys.spawn({ kind: 'wisp', color: '#eaf8ff', x: x - dx * rnd(30, 50) - dy * off, y: y - dy * rnd(30, 50) + dx * off,
        vx: dx * sp, vy: dy * sp, drag: 1.5, rot: ang + Math.PI / 2 + (Math.random() < 0.5 ? Math.PI : 0), vr: rnd(-2, 2),
        life: rnd(0.35, 0.55), size: rnd(26, 40), size1: 46, alpha: 0.75 });
    }
    for (let k = 0; k < 6; ++k)
      sys.spawn({ kind: 'leaf', color: leaf || '#8ac050', x: x - dx * 30 + rnd(-16, 16), y: y - dy * 30 + rnd(-16, 16),
        vx: dx * rnd(140, 240) + rnd(-20, 20), vy: dy * rnd(140, 240) + rnd(-30, 10), drag: 1.2, ay: 30, vr: rnd(-12, 12), flip: 8,
        life: rnd(0.7, 1.1), size: rnd(8, 12) });
  }

  /* a rune taken: violet sparks spiralling up around a bright flash */
  function rune(sys, x, y, color) {
    flash(sys, x, y, color, 130, 0.5);
    sys.spawn({ kind: 'star', color: color, x: x, y: y, size: 30, size1: 80, life: 0.5, vr: 3 });
    for (let k = 0; k < 22; ++k) {
      const a = k / 22 * TWO_PI;
      sys.spawn({ kind: 'spark', color: color, x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10,
        vx: Math.cos(a) * rnd(60, 140) - Math.sin(a) * 60, vy: Math.sin(a) * rnd(60, 140) + Math.cos(a) * 60 - 60, drag: 2.2,
        life: rnd(0.6, 1.0), size: rnd(6, 10), size1: 1, stretch: 0.04 });
    }
  }

  /* the portal waking: a burst of light and sparks */
  function portal(sys, x, y, color) {
    flash(sys, x, y, '#ffffff', 160, 0.5);
    flash(sys, x, y, color, 220, 0.8);
    for (let k = 0; k < 36; ++k) {
      const a = rnd(0, TWO_PI), v = rnd(80, 260);
      sys.spawn({ kind: k % 3 ? 'spark' : 'star', color: k % 2 ? color : '#ffe9a0', x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.4, life: rnd(0.6, 1.2), size: rnd(6, 12), size1: 1, stretch: k % 3 ? 0.04 : 0 });
    }
  }

  /* motes swirling into the open portal */
  function portalIdle(sys, x, y, color, dt) {
    if (Math.random() < 14 * dt) {
      const a = rnd(0, TWO_PI), r = rnd(30, 44);
      sys.spawn({ kind: 'spark', color: color, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.85,
        vx: -Math.cos(a) * 38 - Math.sin(a) * 60, vy: -Math.sin(a) * 34 + Math.cos(a) * 50, life: 0.7, size: rnd(4, 7), size1: 1, ambient: true, fadeIn: 0.15 });
    }
  }

  /* footfall: a puff of the floor's dust, or a splash on water */
  function step(sys, x, y, color, wet) {
    if (wet) {
      for (let k = 0; k < 5; ++k)
        sys.spawn({ kind: 'drop', color: '#d8f4ff', x: x + rnd(-6, 6), y: y, vx: rnd(-50, 50), vy: rnd(-90, -50), ay: 420,
          life: rnd(0.3, 0.45), size: rnd(3, 5), size1: 2 });
      return;
    }
    for (let k = 0; k < 3; ++k)
      sys.spawn({ kind: 'smoke', color: color, x: x + rnd(-6, 6), y: y + rnd(-2, 2), vx: rnd(-26, 26), vy: rnd(-12, -2), drag: 3,
        life: rnd(0.4, 0.6), size: 6, size1: 18, alpha: 0.4 });
  }

  /* power gathering at the staff gem while the mage casts */
  function charge(sys, x, y, color, dt) {
    if (Math.random() < 40 * dt) {
      const a = rnd(0, TWO_PI), r = rnd(18, 30);
      sys.spawn({ kind: 'spark', color: color, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 3.2, life: 0.3, size: rnd(4, 7), size1: 1.5 });
    }
  }

  /* the realm's own air, spawned over the board rectangle (w x h) */
  const AMBIENT = [
    function(sys, w, h, dt) {
      if (Math.random() < 9 * dt)
        sys.spawn({ kind: 'ember', color: Math.random() < 0.6 ? '#ff8a2a' : '#ffb84a', x: rnd(-30, w + 30), y: h + 20,
          vx: rnd(-10, 10), vy: rnd(-45, -25), wobble: 30, life: rnd(5, 9), size: rnd(4, 7), size1: 2, alpha: 0.85, ambient: true, fadeIn: 0.8 });
      if (Math.random() < 0.9 * dt)
        sys.spawn({ kind: 'leaf', color: ['#c4521e', '#e07a2a', '#d8a03a'][(Math.random() * 3) | 0], x: rnd(-40, w), y: -30,
          vx: rnd(10, 30), vy: rnd(18, 32), wobble: 50, vr: rnd(-2, 2), flip: 3, life: rnd(8, 12), size: rnd(9, 13), alpha: 0.9, ambient: true, fadeIn: 0.6 });
    },
    function(sys, w, h, dt) {
      if (Math.random() < 5 * dt)
        sys.spawn({ kind: 'bubble', color: '#9ae8ff', x: rnd(0, w), y: h + 10, vy: rnd(-30, -16), wobble: 22,
          life: rnd(6, 10), size: rnd(4, 8), alpha: 0.55, ambient: true, fadeIn: 1 });
      if (Math.random() < 5 * dt)
        sys.spawn({ kind: 'glow', color: '#4ae0ff', x: rnd(0, w), y: rnd(0, h), vx: rnd(-6, 6), vy: rnd(-8, -2),
          life: rnd(3, 6), size: rnd(8, 16), alpha: 0.45, ambient: true, fadeIn: 1.2 });
      if (Math.random() < 1.2 * dt)
        sys.spawn({ kind: 'drop', color: '#bfeaff', x: rnd(0, w), y: -20, vy: 160, ay: 300, life: rnd(1.4, 2.2), size: 5, size1: 4, alpha: 0.7, stretch: 0.04, ambient: true });
    },
    function(sys, w, h, dt) {
      if (Math.random() < 22 * dt)
        sys.spawn({ kind: 'flake', x: rnd(-80, w), y: -20, vx: rnd(14, 34), vy: rnd(30, 55), wobble: 26,
          life: rnd(9, 14), size: rnd(3, 7), alpha: 0.85, ambient: true, fadeIn: 0.5 });
    },
    function(sys, w, h, dt) {
      if (Math.random() < 1.6 * dt)
        sys.spawn({ kind: 'wisp', color: '#ffffff', x: -50, y: rnd(0, h), vx: rnd(60, 100), vy: rnd(-6, 6), rot: rnd(1.2, 1.9), vr: rnd(-0.3, 0.3),
          life: rnd(7, 10), size: rnd(40, 70), alpha: 0.3, ambient: true, fadeIn: 1 });
      if (Math.random() < 3 * dt)
        sys.spawn({ kind: 'leaf', color: Math.random() < 0.5 ? '#ffd0e0' : '#ffffff', x: -30, y: rnd(-20, h), vx: rnd(40, 70), vy: rnd(-6, 14), wobble: 30,
          vr: rnd(-3, 3), flip: 5, life: rnd(8, 12), size: rnd(6, 9), alpha: 0.9, ambient: true, fadeIn: 0.5 });
    },
    function(sys, w, h, dt) {
      if (Math.random() < 9 * dt)
        sys.spawn({ kind: 'spark', color: Math.random() < 0.7 ? '#c86aff' : '#7ad0ff', x: rnd(0, w), y: rnd(h * 0.2, h + 20),
          vx: rnd(-8, 8), vy: rnd(-34, -16), wobble: 36, life: rnd(3, 6), size: rnd(5, 9), size1: 2, alpha: 0.85, ambient: true, fadeIn: 0.8 });
      if (Math.random() < 0.8 * dt)
        sys.spawn({ kind: 'star', color: '#e0a8ff', x: rnd(0, w), y: rnd(0, h), vr: 1.5, life: 1.2, size: 6, size1: 22, alpha: 0.7, ambient: true, fadeIn: 0.4 });
    }
  ];

  function ambient(sys, realm, w, h, dt) {
    const f = AMBIENT[(realm | 0) >= 0 && (realm | 0) < AMBIENT.length ? realm | 0 : 0];
    f(sys, w, h, dt);
  }

  /* ══════════════════════════════════════════════════════════════════
     SCREEN PRESETS (view space)
     ══════════════════════════════════════════════════════════════════ */

  const FIREWORK_COLORS = ['#ffd75a', '#ff7a3a', '#3ab4ff', '#6fe08a', '#c04cff', '#ff6a9a'];

  /* a rocket climbing on a spark trail, bursting into a sphere of stars */
  function firework(sys, x, y, color) {
    const c = color || FIREWORK_COLORS[(Math.random() * FIREWORK_COLORS.length) | 0];
    const rocket = sys.spawn({ kind: 'spark', color: c, x: x, y: y, vx: rnd(-30, 30), vy: rnd(-520, -420), ay: 380, life: rnd(0.75, 0.95), size: 10,
      onDeath: function(s, q) {
        s.spawn({ kind: 'glow', color: c, x: q.x, y: q.y, size: 60, size1: 200, life: 0.4, alpha: 0.8 });
        const n = 44;
        for (let k = 0; k < n; ++k) {
          const a = k / n * TWO_PI + rnd(-0.05, 0.05), v = rnd(180, 260);
          s.spawn({ kind: 'spark', color: k % 4 ? c : '#ffffff', x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 120, drag: 1.8,
            life: rnd(0.9, 1.4), size: rnd(7, 10), size1: 2, stretch: 0.03 });
        }
      } });
    if (rocket)
      sys.emit(0.8, function(s) {
        if (rocket.life > 0 && rocket.age < 0.9)
          s.spawn({ kind: 'ember', color: '#ffd08a', x: rocket.x, y: rocket.y, vx: rnd(-20, 20), vy: rnd(10, 40), ay: 80, life: 0.45, size: 6, size1: 1 });
      });
  }

  function confetti(sys, x, y, n) {
    for (let k = 0; k < n; ++k) {
      const a = -Math.PI / 2 + rnd(-1.0, 1.0), v = rnd(220, 480);
      sys.spawn({ kind: 'confetti', color: FIREWORK_COLORS[k % FIREWORK_COLORS.length], x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        ay: 420, drag: 2, vr: rnd(-10, 10), flip: rnd(6, 12), wobble: 40, life: rnd(1.6, 2.6), size: rnd(9, 14) });
    }
  }

  /* a star landing on the result panel: a ring of gold sparks */
  function starBurst(sys, x, y) {
    sys.spawn({ kind: 'glow', color: '#ffd75a', x: x, y: y, size: 40, size1: 160, life: 0.45, alpha: 0.9 });
    for (let k = 0; k < 18; ++k) {
      const a = k / 18 * TWO_PI, v = rnd(140, 240);
      sys.spawn({ kind: 'spark', color: k % 2 ? '#ffd75a' : '#fff4c0', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3,
        life: rnd(0.4, 0.7), size: rnd(6, 9), size1: 1, stretch: 0.03 });
    }
  }

  SZ.PuzzleFx = Object.freeze({
    create: create, sprite: sprite,
    fire: fire, melt: melt, splash: splash, quake: quake, dustRing: dustRing, gust: gust, rune: rune,
    portal: portal, portalIdle: portalIdle, step: step, charge: charge, ambient: ambient, flash: flash,
    firework: firework, confetti: confetti, starBurst: starBurst
  });
})();
