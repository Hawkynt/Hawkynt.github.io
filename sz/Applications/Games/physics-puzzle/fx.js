;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Particles and camera juice for the Physics Puzzle. Every particle is one
   * drawImage of a cached sprite (glow, spark, ember, flame, smoke, droplet,
   * chip, glass shard, splinter, leaf, flake, wisp, ring, streak, confetti,
   * star) or an afterimage of any cached sprite; normal sprites draw first,
   * glowing ones afterwards in one additive pass, and particles outside the
   * view are skipped. A system is capped and reuses its particle objects.
   * Presets turn impacts, glass, explosions, springs, bumpers, portals,
   * splashes, targets, stars, ball trails and each world's air into
   * particles; the shake, slow-motion, flash and floating-text helpers live
   * here too.
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

  const TWO = TWO_PI;

  /* ── sprites, one canvas per kind and colour ── */

  const ADDITIVE = { glow: true, spark: true, flame: true, wisp: true, star: true, ember: true, ring: true, streak: true };
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
    } else if (kind === 'shard') {
      /* a sliver of glass: pale, translucent, with a bright edge */
      g.translate(h, h);
      g.beginPath();
      g.moveTo(-22, -10);
      g.lineTo(24, -4);
      g.lineTo(-6, 18);
      g.closePath();
      g.fillStyle = rgba(color, 0.55);
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.moveTo(-22, -10);
      g.lineTo(24, -4);
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = rgba(color, 0.9);
      g.beginPath();
      g.moveTo(24, -4);
      g.lineTo(-6, 18);
      g.lineTo(-22, -10);
      g.stroke();
    } else if (kind === 'splinter') {
      g.translate(h, h);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(-26, -4);
      g.lineTo(24, -2);
      g.lineTo(26, 3);
      g.lineTo(-24, 5);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(-22, -3, 44, 2);
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
    } else if (kind === 'ring') {
      /* a soft shockwave ring */
      for (let k = 0; k < 4; ++k) {
        g.strokeStyle = rgba(color, [0.18, 0.35, 0.8, 0.35][k]);
        g.lineWidth = [10, 6, 2.5, 1][k];
        g.beginPath();
        g.arc(h, h, h - 7, 0, TWO_PI);
        g.stroke();
      }
    } else if (kind === 'streak') {
      const lg = g.createLinearGradient(0, 0, SPRITE, 0);
      lg.addColorStop(0, rgba(color, 0));
      lg.addColorStop(0.7, rgba(color, 0.7));
      lg.addColorStop(1, 'rgba(255,255,255,0.95)');
      g.fillStyle = lg;
      g.beginPath();
      g.ellipse(h, h, h - 2, 5, 0, 0, TWO_PI);
      g.fill();
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
      if (q.kind === 'image') {
        /* an afterimage: any cached sprite { c, w, h, ax, ay } */
        q.img = p.img.c;
        q.iw = p.img.w; q.ih = p.img.h; q.iax = p.img.ax; q.iay = p.img.ay;
        q.flipX = !!p.flipX;
        q.add = !!p.add;
      } else {
        q.img = sprite(q.kind, q.color);
        q.add = ADDITIVE[q.kind] === true;
      }
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

    let cull = null;

    function drawSet(ctx, additive) {
      const base = ctx.globalAlpha;
      for (let i = 0; i < live.length; ++i) {
        const q = live[i];
        if (q.add !== additive)
          continue;
        if (cull && (q.x < cull.x0 - 80 || q.x > cull.x1 + 80 || q.y < cull.y0 - 80 || q.y > cull.y1 + 80))
          continue;
        const k = 1 - q.life / q.max;
        let a = q.alpha * (k > 0.6 ? (1 - k) / 0.4 : 1);
        if (q.fadeIn && q.age < q.fadeIn)
          a *= q.age / q.fadeIn;
        if (a <= 0.004)
          continue;
        const s = q.size + (q.size1 - q.size) * k;
        ctx.globalAlpha = base * Math.min(1, a);
        if (q.kind === 'image') {
          if (q.flipX) {
            ctx.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
            ctx.translate(q.x, q.y);
            ctx.scale(-1, 1);
            ctx.drawImage(q.img, -q.iax, -q.iay, q.iw, q.ih);
            ctx.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
          } else {
            ctx.drawImage(q.img, q.x - q.iax, q.y - q.iay, q.iw, q.ih);
          }
        } else if (q.stretch) {
          const sp = Math.sqrt(q.vx * q.vx + q.vy * q.vy);
          const len = s + sp * q.stretch;
          ctx.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
          ctx.translate(q.x, q.y);
          ctx.rotate(Math.atan2(q.vy, q.vx));
          ctx.drawImage(q.img, -len / 2, -s / 2, len, s);
          ctx.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
        } else if (q.kind === 'chunk' || q.kind === 'leaf' || q.kind === 'confetti' || q.kind === 'wisp' || q.kind === 'flame' || q.kind === 'shard' || q.kind === 'splinter') {
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

    /* rect (optional): { x0, y0, x1, y1 } in the system's space; particles outside are skipped */
    function draw(ctx, rect) {
      if (!live.length)
        return;
      cull = rect || null;
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
     PRESETS (field space, y down)
     ══════════════════════════════════════════════════════════════════ */

  function flash(sys, x, y, color, size, life) {
    sys.spawn({ kind: 'glow', color: color, x: x, y: y, size: size * 0.6, size1: size, life: life || 0.35, alpha: 0.9 });
  }

  /* a ball hitting something: sparks off metal, dust off wood and stone, glints off ice; strength 0..1 */
  function impact(sys, x, y, nx, ny, mat, strength) {
    const s = Math.max(0.15, Math.min(1, strength));
    const metal = mat === 'metal' || mat === 'tnt';
    const ice = mat === 'ice' || mat === 'glass';
    const n = Math.round(3 + 9 * s);
    const base = Math.atan2(-ny, -nx);
    for (let k = 0; k < n; ++k) {
      const a = base + rnd(-1.2, 1.2), v = rnd(80, 320) * (0.5 + s);
      sys.spawn({ kind: 'spark', color: metal ? (k % 2 ? '#fff0b0' : '#ffb84a') : ice ? '#d8f6ff' : '#ffe0b0', x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 600, drag: 2.5, life: rnd(0.2, 0.45), size: rnd(4, 7), size1: 1, stretch: 0.03 });
    }
    if (!metal) {
      for (let k = 0; k < 2 + Math.round(3 * s); ++k)
        sys.spawn({ kind: 'smoke', color: ice ? '#e8f8ff' : mat === 'stone' ? '#c8bca8' : '#d8b890', x: x + rnd(-6, 6), y: y + rnd(-6, 6),
          vx: -nx * rnd(20, 60) + rnd(-20, 20), vy: -ny * rnd(20, 60) + rnd(-20, 10), drag: 3, life: rnd(0.35, 0.6), size: rnd(6, 10), size1: rnd(18, 28), alpha: 0.45 });
    }
    if (s > 0.55)
      sys.spawn({ kind: 'ring', color: metal ? '#ffe9b0' : '#ffffff', x: x, y: y, size: 8, size1: 46 * s, life: 0.22, alpha: 0.7 });
    flash(sys, x, y, metal ? '#ffcf6a' : '#ffffff', 40 + 50 * s, 0.18);
  }

  /* glass shattering across a pane of width w, angle a */
  function shatter(sys, x, y, w, a, color) {
    const c = color || '#bfeaff';
    const ca = Math.cos(a), sa = Math.sin(a);
    flash(sys, x, y, '#e8fbff', 160, 0.3);
    for (let k = 0; k < 26; ++k) {
      const t = rnd(-0.5, 0.5) * w;
      const v = rnd(80, 300), ang = rnd(0, TWO);
      sys.spawn({ kind: 'shard', color: c, x: x + ca * t, y: y + sa * t, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 120, ay: 1300,
        vr: rnd(-16, 16), flip: rnd(4, 10), life: rnd(0.8, 1.4), size: rnd(12, 26), size1: 6 });
    }
    for (let k = 0; k < 16; ++k) {
      const t = rnd(-0.5, 0.5) * w;
      sys.spawn({ kind: 'spark', color: '#ffffff', x: x + ca * t, y: y + sa * t, vx: rnd(-120, 120), vy: rnd(-200, 40), drag: 2, life: rnd(0.3, 0.6), size: rnd(4, 7), size1: 1 });
    }
  }

  function explosion(sys, x, y, radius) {
    const s = (radius || 170) / 170;
    flash(sys, x, y, '#fff0c0', 120 * s, 0.16);
    flash(sys, x, y, '#ff8a2a', 380 * s, 0.7);
    sys.spawn({ kind: 'ring', color: '#ffd08a', x: x, y: y, size: 30, size1: radius * 2.3, life: 0.4, alpha: 0.95 });
    sys.spawn({ kind: 'ring', color: '#ffffff', x: x, y: y, size: 20, size1: radius * 1.5, life: 0.25, alpha: 0.7 });
    for (let k = 0; k < 22; ++k) {
      const a = rnd(0, TWO), v = rnd(120, 420) * s;
      sys.spawn({ kind: 'flame', color: k % 3 ? '#ff7a2a' : '#ffcf4a', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3.2, life: rnd(0.3, 0.6), size: rnd(22, 40) * s, size1: 6 });
    }
    for (let k = 0; k < 14; ++k) {
      const a = rnd(0, TWO), v = rnd(200, 520);
      sys.spawn({ kind: 'chunk', color: k % 2 ? '#c83a2a' : '#3a2a22', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, ay: 1300, vr: rnd(-14, 14),
        life: rnd(0.6, 1.0), size: rnd(6, 12), size1: 3 });
    }
    for (let k = 0; k < 10; ++k)
      sys.spawn({ kind: 'smoke', color: '#3a3034', x: x + rnd(-30, 30), y: y + rnd(-30, 30), vx: rnd(-50, 50), vy: rnd(-90, -20), drag: 1.4,
        life: rnd(1.0, 1.6), size: 36 * s, size1: 110 * s, alpha: 0.55 });
  }

  /* a crate or plank bursting: splinters and dust */
  function splinters(sys, x, y, color, n) {
    for (let k = 0; k < (n || 10); ++k) {
      const a = rnd(0, TWO), v = rnd(100, 300);
      sys.spawn({ kind: 'splinter', color: color || '#b07a40', x: x + rnd(-14, 14), y: y + rnd(-14, 14), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, ay: 1200,
        vr: rnd(-14, 14), life: rnd(0.6, 1.0), size: rnd(10, 18), size1: 6 });
    }
    sys.spawn({ kind: 'smoke', color: '#d8c8b0', x: x, y: y, vy: -20, life: 0.6, size: 24, size1: 70, alpha: 0.4 });
  }

  /* a body landing: a flat dust fan */
  function dust(sys, x, y, color, strength) {
    const n = 3 + Math.round(6 * strength);
    for (let k = 0; k < n; ++k) {
      const side = k % 2 ? 1 : -1;
      sys.spawn({ kind: 'smoke', color: color, x: x + side * rnd(2, 14), y: y - 2, vx: side * rnd(40, 140) * (0.5 + strength), vy: rnd(-40, -8),
        drag: 3.5, life: rnd(0.35, 0.65), size: rnd(7, 11), size1: rnd(20, 32), alpha: 0.5 });
    }
  }

  function springPop(sys, x, y, ux, uy) {
    sys.spawn({ kind: 'ring', color: '#b8ffb0', x: x, y: y, size: 10, size1: 80, life: 0.25, alpha: 0.8 });
    for (let k = 0; k < 10; ++k) {
      const a = Math.atan2(uy, ux) + rnd(-0.6, 0.6), v = rnd(140, 340);
      sys.spawn({ kind: 'spark', color: k % 2 ? '#d8ffb0' : '#ffffff', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: rnd(0.25, 0.45), size: 6, size1: 1, stretch: 0.04 });
    }
  }

  function bumperPop(sys, x, y, r, color) {
    sys.spawn({ kind: 'ring', color: color || '#ff7ad0', x: x, y: y, size: r * 2, size1: r * 4.5, life: 0.3, alpha: 0.9 });
    flash(sys, x, y, color || '#ff7ad0', r * 4, 0.25);
    for (let k = 0; k < 12; ++k) {
      const a = k / 12 * TWO, v = rnd(160, 260);
      sys.spawn({ kind: 'spark', color: k % 2 ? color || '#ff7ad0' : '#ffffff', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3.5, life: rnd(0.25, 0.4), size: 6, size1: 1 });
    }
  }

  function portal(sys, x, y, color) {
    sys.spawn({ kind: 'ring', color: color, x: x, y: y, size: 70, size1: 10, life: 0.3, alpha: 0.9 });
    flash(sys, x, y, color, 140, 0.35);
    for (let k = 0; k < 16; ++k) {
      const a = k / 16 * TWO, r = 44;
      sys.spawn({ kind: 'spark', color: k % 2 ? color : '#ffffff', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        vx: -Math.cos(a) * 160, vy: -Math.sin(a) * 160, drag: 2, life: 0.3, size: 6, size1: 1 });
    }
  }

  function splash(sys, x, y, hot) {
    flash(sys, x, y, hot ? '#ff8a2a' : '#bfeaff', 110, 0.3);
    for (let k = 0; k < 16; ++k) {
      const a = -Math.PI / 2 + rnd(-1.0, 1.0), v = rnd(160, 380);
      sys.spawn({ kind: hot ? 'ember' : 'drop', color: hot ? '#ff8a2a' : '#7ad0ff', x: x + rnd(-10, 10), y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 1100,
        life: rnd(0.5, 0.9), size: rnd(6, 10), size1: 3, stretch: hot ? 0 : 0.02 });
    }
    for (let k = 0; k < 4; ++k)
      sys.spawn({ kind: 'smoke', color: hot ? '#5a4a40' : '#e8f6ff', x: x + rnd(-16, 16), y: y - 4, vx: rnd(-20, 20), vy: rnd(-60, -20),
        life: rnd(0.7, 1.2), size: 20, size1: 60, alpha: 0.45 });
  }

  /* a ball melting in lava */
  function sizzle(sys, x, y) {
    splash(sys, x, y, true);
    for (let k = 0; k < 8; ++k)
      sys.spawn({ kind: 'smoke', color: '#6a5a58', x: x + rnd(-10, 10), y: y - 6, vx: rnd(-20, 20), vy: rnd(-120, -60), drag: 1,
        life: rnd(0.9, 1.5), size: 14, size1: 50, alpha: 0.6 });
  }

  function targetHit(sys, x, y, color) {
    flash(sys, x, y, '#ffffff', 160, 0.35);
    flash(sys, x, y, color, 300, 0.8);
    sys.spawn({ kind: 'ring', color: color, x: x, y: y, size: 30, size1: 260, life: 0.6 });
    sys.spawn({ kind: 'ring', color: '#ffffff', x: x, y: y, size: 20, size1: 160, life: 0.4, alpha: 0.8 });
    sys.spawn({ kind: 'star', color: color, x: x, y: y, size: 40, size1: 120, life: 0.6, vr: 3 });
    for (let k = 0; k < 30; ++k) {
      const a = k / 30 * TWO, v = rnd(140, 340);
      sys.spawn({ kind: k % 3 ? 'spark' : 'star', color: k % 2 ? color : '#ffffff', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.4,
        life: rnd(0.6, 1.1), size: rnd(6, 12), size1: 1, stretch: k % 3 ? 0.04 : 0 });
    }
  }

  function starPickup(sys, x, y) {
    flash(sys, x, y, '#ffe066', 120, 0.35);
    sys.spawn({ kind: 'ring', color: '#ffe066', x: x, y: y, size: 16, size1: 110, life: 0.4 });
    for (let k = 0; k < 16; ++k) {
      const a = k / 16 * TWO, v = rnd(120, 240);
      sys.spawn({ kind: k % 2 ? 'spark' : 'star', color: k % 2 ? '#fff4c0' : '#ffd84a', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3,
        life: rnd(0.4, 0.8), size: rnd(6, 12), size1: 1 });
    }
  }

  function muzzle(sys, x, y, ux, uy, power) {
    flash(sys, x, y, '#ffe9b0', 70 + 60 * power, 0.2);
    for (let k = 0; k < 8 + Math.round(8 * power); ++k) {
      const a = Math.atan2(uy, ux) + rnd(-0.5, 0.5), v = rnd(120, 420) * (0.5 + power);
      sys.spawn({ kind: k % 3 ? 'smoke' : 'spark', color: k % 3 ? '#d8d0c8' : '#ffe0a0', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 4,
        life: rnd(0.3, 0.6), size: k % 3 ? rnd(8, 12) : 5, size1: k % 3 ? rnd(22, 34) : 1, alpha: 0.6 });
    }
  }

  function poof(sys, x, y) {
    for (let k = 0; k < 8; ++k) {
      const a = k / 8 * TWO;
      sys.spawn({ kind: 'smoke', color: '#e8e0f0', x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20, drag: 3,
        life: rnd(0.35, 0.55), size: 8, size1: 24, alpha: 0.6 });
    }
  }

  /* a part dropped onto the field */
  function placeBurst(sys, x, y, color) {
    sys.spawn({ kind: 'ring', color: color || '#7ae8ff', x: x, y: y, size: 20, size1: 120, life: 0.3, alpha: 0.8 });
    for (let k = 0; k < 10; ++k) {
      const a = k / 10 * TWO, v = rnd(90, 160);
      sys.spawn({ kind: 'spark', color: color || '#7ae8ff', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 4, life: 0.35, size: 5, size1: 1 });
    }
  }

  const RAINBOW = ['#ff5a5a', '#ffa83a', '#ffe14a', '#6ae06a', '#4ab8ff', '#a87aff'];

  /* cosmetic ball trails; speed in px/s */
  function trail(sys, kind, x, y, vx, vy, dt, t) {
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp < 60)
      return;
    if (kind === 'spark') {
      if (Math.random() < 40 * dt)
        sys.spawn({ kind: 'spark', color: Math.random() < 0.5 ? '#ffd75a' : '#fff4c0', x: x + rnd(-5, 5), y: y + rnd(-5, 5),
          vx: -vx * 0.1 + rnd(-30, 30), vy: -vy * 0.1 + rnd(-30, 30), ay: 300, drag: 2, life: rnd(0.3, 0.6), size: rnd(4, 7), size1: 1 });
    } else if (kind === 'comet') {
      if (Math.random() < 70 * dt)
        sys.spawn({ kind: 'flame', color: '#ff8a2a', x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: -vx * 0.15, vy: -vy * 0.15, drag: 4,
          life: rnd(0.2, 0.35), size: rnd(18, 26), size1: 4 });
    } else if (kind === 'rainbow') {
      if (Math.random() < 60 * dt)
        sys.spawn({ kind: 'glow', color: RAINBOW[Math.floor((t * 12) % RAINBOW.length)], x: x + rnd(-2, 2), y: y + rnd(-2, 2),
          life: 0.5, size: 20, size1: 6, alpha: 0.85 });
    }
  }

  /* each world's own air inside rect r = { x0, y0, x1, y1 } */
  const AMBIENT = [
    function(sys, r, dt) {
      /* sawdust motes drifting in lamp light */
      if (Math.random() < 6 * dt)
        sys.spawn({ kind: 'glow', color: '#ffe0a0', x: rnd(r.x0, r.x1), y: rnd(r.y0, r.y1), vx: rnd(-8, 8), vy: rnd(-8, 6), wobble: 14,
          life: rnd(4, 7), size: rnd(3, 6), alpha: 0.5, ambient: true, fadeIn: 1.2 });
    },
    function(sys, r, dt) {
      if (Math.random() < 2.2 * dt)
        sys.spawn({ kind: 'leaf', color: ['#7ed060', '#a8e070', '#e8f0a0', '#ffc0d8'][(Math.random() * 4) | 0], x: rnd(r.x0 - 60, r.x1), y: r.y0 - 20,
          vx: rnd(20, 50), vy: rnd(20, 40), wobble: 40, vr: rnd(-3, 3), flip: 5, life: rnd(9, 13), size: rnd(7, 10), alpha: 0.9, ambient: true, fadeIn: 0.5 });
      if (Math.random() < 3 * dt)
        sys.spawn({ kind: 'glow', color: '#f8ffb0', x: rnd(r.x0, r.x1), y: rnd(r.y0, r.y1), vx: rnd(-10, 10), vy: rnd(-12, -2), wobble: 20,
          life: rnd(3, 5), size: rnd(4, 7), alpha: 0.6, ambient: true, fadeIn: 1 });
    },
    function(sys, r, dt) {
      if (Math.random() < 10 * dt)
        sys.spawn({ kind: 'flake', x: rnd(r.x0 - 100, r.x1), y: r.y0 - 20, vx: rnd(10, 30), vy: rnd(25, 50), wobble: 24,
          life: rnd(10, 14), size: rnd(3, 6), alpha: 0.8, ambient: true, fadeIn: 0.5 });
    },
    function(sys, r, dt) {
      if (Math.random() < 12 * dt)
        sys.spawn({ kind: 'ember', color: Math.random() < 0.6 ? '#ff8a2a' : '#ffcf4a', x: rnd(r.x0, r.x1), y: r.y1 + 10,
          vx: rnd(-14, 14), vy: rnd(-90, -40), wobble: 30, life: rnd(4, 8), size: rnd(4, 8), size1: 2, alpha: 0.9, ambient: true, fadeIn: 0.6 });
    },
    function(sys, r, dt) {
      if (Math.random() < 4 * dt)
        sys.spawn({ kind: 'spark', color: Math.random() < 0.6 ? '#e8d0ff' : '#a8e8ff', x: rnd(r.x0, r.x1), y: rnd(r.y0, r.y1),
          vx: rnd(-6, 6), vy: rnd(-12, -4), wobble: 16, life: rnd(2, 4), size: rnd(3, 6), size1: 1, alpha: 0.8, ambient: true, fadeIn: 0.8 });
    }
  ];

  function ambient(sys, world, rect, dt) {
    AMBIENT[(world | 0) % AMBIENT.length](sys, rect, dt);
  }

  /* ══════════════════════════════════════════════════════════════════
     SCREEN PRESETS (view space)
     ══════════════════════════════════════════════════════════════════ */

  const FIREWORK_COLORS = ['#ffd75a', '#ff7a3a', '#3ab4ff', '#6fe08a', '#c04cff', '#ff6a9a'];

  function firework(sys, x, y, color) {
    const c = color || FIREWORK_COLORS[(Math.random() * FIREWORK_COLORS.length) | 0];
    const rocket = sys.spawn({ kind: 'spark', color: c, x: x, y: y, vx: rnd(-30, 30), vy: rnd(-520, -420), ay: 380, life: rnd(0.75, 0.95), size: 10,
      onDeath: function(s, q) {
        s.spawn({ kind: 'glow', color: c, x: q.x, y: q.y, size: 60, size1: 200, life: 0.4, alpha: 0.8 });
        const n = 40;
        for (let k = 0; k < n; ++k) {
          const a = k / n * TWO + rnd(-0.05, 0.05), v = rnd(180, 260);
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
      const a = -Math.PI / 2 + rnd(-1.0, 1.0), v = rnd(220, 520);
      sys.spawn({ kind: 'confetti', color: FIREWORK_COLORS[k % FIREWORK_COLORS.length], x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        ay: 420, drag: 2, vr: rnd(-10, 10), flip: rnd(6, 12), wobble: 40, life: rnd(1.6, 2.6), size: rnd(9, 14) });
    }
  }

  function starBurst(sys, x, y) {
    sys.spawn({ kind: 'glow', color: '#ffd75a', x: x, y: y, size: 40, size1: 180, life: 0.45, alpha: 0.9 });
    sys.spawn({ kind: 'ring', color: '#fff4c0', x: x, y: y, size: 20, size1: 150, life: 0.4, alpha: 0.9 });
    for (let k = 0; k < 18; ++k) {
      const a = k / 18 * TWO, v = rnd(140, 260);
      sys.spawn({ kind: 'spark', color: k % 2 ? '#ffd75a' : '#fff4c0', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3,
        life: rnd(0.4, 0.7), size: rnd(6, 9), size1: 1, stretch: 0.03 });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CAMERA JUICE: trauma shake, slow motion, screen flashes, texts
     ══════════════════════════════════════════════════════════════════ */

  /* eases game time toward a target rate: slow motion on near misses and wins */
  function createTimeScale() {
    let scale = 1, target = 1, hold = 0;
    return {
      slow(rate, seconds) { target = Math.min(target, rate); scale = Math.min(scale, Math.max(rate, scale * 0.6)); hold = Math.max(hold, seconds); },
      update(dt) {
        if (hold > 0) {
          hold -= dt;
          scale += (target - scale) * Math.min(1, dt * 10);
        } else {
          target = 1;
          scale += (1 - scale) * Math.min(1, dt * 4);
        }
        return scale;
      },
      get scale() { return scale; },
      get active() { return hold > 0 || scale < 0.98; },
      reset() { scale = 1; target = 1; hold = 0; }
    };
  }

  function createShake() {
    let trauma = 0, t = 0;
    const out = { x: 0, y: 0, a: 0 };
    return {
      add(amount) { trauma = Math.min(1, trauma + amount); },
      update(dt) {
        t += dt;
        trauma = Math.max(0, trauma - dt * 1.6);
        const s = trauma * trauma;
        out.x = s * 22 * (Math.sin(t * 61.3) * 0.6 + Math.sin(t * 23.7) * 0.4);
        out.y = s * 16 * (Math.sin(t * 57.1 + 1.3) * 0.6 + Math.sin(t * 31.9) * 0.4);
        out.a = s * 0.025 * Math.sin(t * 43.3);
        return out;
      },
      get offset() { return out; },
      get trauma() { return trauma; },
      reset() { trauma = 0; out.x = out.y = out.a = 0; }
    };
  }

  /* full-view colour flashes, fading out */
  function createFlash() {
    let color = '#ffffff', a = 0, rate = 4;
    return {
      fire(c, alpha, fade) { color = c; a = Math.max(a, alpha); rate = fade || 4; },
      update(dt) { a = Math.max(0, a - dt * rate); },
      draw(ctx, v) {
        if (a <= 0.003)
          return;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = color;
        ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
        ctx.restore();
      },
      reset() { a = 0; }
    };
  }

  /* pooled floating texts ("+50", "x3 COMBO") */
  function createTexts(max) {
    const cap = max || 24;
    const live = [];
    const FONT = "'Trebuchet MS', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
    return {
      add(x, y, text, opts) {
        opts = opts || {};
        if (live.length >= cap)
          live.shift();
        live.push({ x: x, y: y, text: String(text), color: opts.color || '#ffffff', size: opts.size || 20, life: opts.life || 0.9, max: opts.life || 0.9, vy: opts.vy || -60 });
      },
      update(dt) {
        for (let i = live.length - 1; i >= 0; --i) {
          const q = live[i];
          q.life -= dt;
          q.y += q.vy * dt;
          q.vy *= Math.max(0, 1 - dt * 2.5);
          if (q.life <= 0)
            live.splice(i, 1);
        }
      },
      draw(ctx) {
        if (!live.length)
          return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        for (const q of live) {
          const k = 1 - q.life / q.max;
          const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.55 : k < 0.25 ? 1.15 - (k - 0.15) / 0.1 * 0.15 : 1;
          ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
          ctx.font = 'bold ' + Math.round(q.size * pop) + 'px ' + FONT;
          ctx.lineWidth = Math.max(3, q.size / 5);
          ctx.strokeStyle = 'rgba(20,10,30,0.85)';
          ctx.strokeText(q.text, q.x, q.y);
          ctx.fillStyle = q.color;
          ctx.fillText(q.text, q.x, q.y);
        }
        ctx.restore();
      },
      clear() { live.length = 0; },
      get count() { return live.length; }
    };
  }

  SZ.PhysicsPuzzleFx = Object.freeze({
    create: create, sprite: sprite,
    flash: flash, impact: impact, shatter: shatter, explosion: explosion, splinters: splinters, dust: dust,
    springPop: springPop, bumperPop: bumperPop, portal: portal, splash: splash, sizzle: sizzle, targetHit: targetHit, starPickup: starPickup,
    muzzle: muzzle, poof: poof, placeBurst: placeBurst, trail: trail, ambient: ambient,
    firework: firework, confetti: confetti, starBurst: starBurst,
    createShake: createShake, createTimeScale: createTimeScale, createFlash: createFlash, createTexts: createTexts
  });
})();
