/* The five titans and their fights. Glacier Titan: an ice core behind orbiting plates, shard
   rings and calved rocks. Magma Wyrm: a burning head trailing armoured segments, fireball fans
   and dripping fire. Prism Warden: facets and sweeping telegraphed beams. Tempest Core: shielded
   until its three pylons fall, lightning between them, spiral fire. The Maw: a mouth that opens
   to pull you in and spit rocks, watched by two firing eyes. Entry, phases, parts, damage and
   the death sequence. Owns G.boss. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { TAU, FIELD_W, FIELD_H } = NS.constants;
  const { BOSSES } = NS.enemyData;
  const { wrap, wrapD, turnToward, fx: R } = NS.rng;
  const fx = NS.fx;
  const W = NS.weapons;
  const { sfx } = NS.audio;

  function rng() {
    return NS.sim.rng();
  }

  function part(kind, r, hp) {
    return { kind: kind, r: r, hp: hp, maxHp: hp, alive: true, x: 0, y: 0, hitT: 0, ox: 0, oy: 0 };
  }

  function spawn(kind, scale) {
    const D = BOSSES[kind];
    const k = scale || 1;
    const b = {
      kind: kind, alive: true, x: FIELD_W / 2, y: -D.r * 2, vx: 0, vy: 0, r: D.r, a: 0,
      hp: Math.round(D.hp * k), maxHp: Math.round(D.hp * k), t: 0, phase: 1, hitT: 0, intro: 2.6, dying: 0,
      atk: [2, 4, 6], parts: [], trail: [], open: 0, shield: false, beams: [], beamT: 0, cycle: 0,
    };
    const ph = Math.round(k * 10) / 10;
    switch (kind) {
      case 'glacier':
        for (let i = 0; i < 5; ++i) b.parts.push(part('plate', 28, Math.round(10 * ph)));
        break;
      case 'wyrm':
        b.y = FIELD_H / 2;
        b.x = -60;
        b.a = 0;
        for (let i = 0; i < 10; ++i) b.parts.push(part('segment', 24 - i * 0.8, Math.round(5 * ph)));
        break;
      case 'prism':
        for (let i = 0; i < 6; ++i) b.parts.push(part('facet', 20, Math.round(8 * ph)));
        break;
      case 'tempest':
        for (let i = 0; i < 3; ++i) b.parts.push(part('pylon', 26, Math.round(14 * ph)));
        b.shield = true;
        break;
      case 'maw':
        b.parts.push(part('eye', 22, Math.round(25 * ph)), part('eye', 22, Math.round(25 * ph)));
        break;
    }
    G.boss = b;
    place(b);
    sfx('levelup', { pitch: 0.5 });
    return b;
  }

  /* part positions from the boss body */
  function place(b) {
    const n = b.parts.length;
    for (let i = 0; i < n; ++i) {
      const p = b.parts[i];
      switch (b.kind) {
        case 'glacier': {
          const a = b.t * (b.phase >= 2 ? 1.1 : 0.6) + i * TAU / n;
          p.ox = Math.cos(a) * 118; p.oy = Math.sin(a) * 118;
          break;
        }
        case 'prism': {
          const a = -b.t * 0.8 + i * TAU / n;
          p.ox = Math.cos(a) * 100; p.oy = Math.sin(a) * 100;
          break;
        }
        case 'tempest': {
          const a = -Math.PI / 2 + i * TAU / 3 + b.t * 0.12;
          p.x = FIELD_W / 2 + Math.cos(a) * 250; p.y = FIELD_H / 2 + Math.sin(a) * 250;
          continue;
        }
        case 'maw':
          p.ox = (i === 0 ? -70 : 70); p.oy = -62;
          break;
        case 'wyrm': {
          const tr = b.trail;
          const at = Math.min(tr.length - 1, (i + 1) * 9);
          if (at >= 0 && tr.length) { p.x = tr[at].x; p.y = tr[at].y; }
          else { p.x = b.x; p.y = b.y; }
          continue;
        }
      }
      p.x = wrap(b.x + p.ox, FIELD_W);
      p.y = wrap(b.y + p.oy, FIELD_H);
    }
  }

  function toShip(b) {
    const s = G.ship;
    if (!s || s.dead) return { dx: 0, dy: 1, d: 1, a: Math.PI / 2 };
    const dx = wrapD(s.x - b.x, FIELD_W), dy = wrapD(s.y - b.y, FIELD_H);
    return { dx: dx, dy: dy, d: Math.sqrt(dx * dx + dy * dy) || 1, a: Math.atan2(dy, dx) };
  }

  function update(dt) {
    const b = G.boss;
    if (!b) return;
    const kdt = dt * NS.sim.worldScale();
    b.hitT = Math.max(0, b.hitT - dt);
    for (let i = 0; i < b.parts.length; ++i) b.parts[i].hitT = Math.max(0, b.parts[i].hitT - dt);
    if (b.dying > 0) {
      dyingStep(b, dt);
      return;
    }
    b.t += kdt;
    const frac = b.hp / b.maxHp;
    const ph = frac < 0.3 ? 3 : frac < 0.65 ? 2 : 1;
    if (ph !== b.phase) {
      b.phase = ph;
      fx.banner(BOSSES[b.kind].name.toUpperCase(), ph === 3 ? 'is enraged' : 'grows stronger', BOSSES[b.kind].pal[3], 1.6);
      fx.shake(0.5);
      fx.flash(BOSSES[b.kind].pal[1], 0.3);
      sfx('hurt', { pitch: 0.5 });
    }
    if (b.intro > 0) {
      b.intro -= dt;
      if (b.kind !== 'wyrm') b.y += (entryY(b) - b.y) * Math.min(1, dt * 1.6);
      else { b.x += 160 * dt; b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 120) b.trail.length = 120; }
      place(b);
      return;
    }
    for (let i = 0; i < b.atk.length; ++i) b.atk[i] -= kdt;
    const to = toShip(b);
    switch (b.kind) {
      case 'glacier': glacier(b, kdt, to); break;
      case 'wyrm': wyrm(b, kdt, to); break;
      case 'prism': prism(b, kdt, to); break;
      case 'tempest': tempest(b, kdt, to); break;
      case 'maw': maw(b, kdt, to); break;
    }
    if (b.kind !== 'wyrm') {
      b.x = wrap(b.x + b.vx * kdt, FIELD_W);
      b.y = wrap(b.y + b.vy * kdt, FIELD_H);
    }
    place(b);
  }

  function entryY(b) {
    return b.kind === 'maw' ? 230 : FIELD_H / 2 - 40;
  }

  function ring(b, n, speed, kind, off) {
    for (let i = 0; i < n; ++i) W.enemyShot(b.x, b.y, (off || 0) + i * TAU / n, speed, kind, 6);
  }

  function glacier(b, dt, to) {
    b.vx += (to.dx / to.d * 30 - b.vx) * dt;
    b.vy += (to.dy / to.d * 30 - b.vy) * dt;
    b.a += dt * 0.2;
    if (b.atk[0] <= 0) {
      b.atk[0] = b.phase === 1 ? 2.8 : 2;
      ring(b, b.phase === 1 ? 8 : 11, 150, 'shard', b.t);
      sfx('zap', { pitch: 1.6, volume: 0.4 });
    }
    if (b.atk[1] <= 0) {
      b.atk[1] = 7;
      for (let i = 0; i < 2; ++i) {
        const a = to.a + (i ? 1 : -1) * 0.9;
        NS.rocks.spawn('ice', 2, wrap(b.x + Math.cos(a) * b.r, FIELD_W), wrap(b.y + Math.sin(a) * b.r, FIELD_H), Math.cos(a) * 90, Math.sin(a) * 90);
      }
      fx.shake(0.25);
    }
    if (b.phase === 3 && b.atk[2] <= 0) {
      b.atk[2] = 1.3;
      for (let s = -1; s <= 1; ++s) W.enemyShot(b.x, b.y, to.a + s * 0.2, 260, 'shard', 6);
    }
  }

  function wyrm(b, dt, to) {
    const sp = [0, 150, 190, 235][b.phase];
    b.a = turnToward(b.a, to.a + Math.sin(b.t * 1.3) * 0.7, dt * 1.5);
    b.x = wrap(b.x + Math.cos(b.a) * sp * dt, FIELD_W);
    b.y = wrap(b.y + Math.sin(b.a) * sp * dt, FIELD_H);
    b.trail.unshift({ x: b.x, y: b.y });
    if (b.trail.length > 120) b.trail.length = 120;
    if (R() < 0.5) fx.embers(b.x - Math.cos(b.a) * 20, b.y - Math.sin(b.a) * 20, 1, 60, fx.FIRE);
    if (b.atk[0] <= 0) {
      b.atk[0] = b.phase === 3 ? 1.4 : 2.2;
      for (let s = -1; s <= 1; ++s) W.enemyShot(b.x, b.y, to.a + s * 0.25, 240, 'fire', 7);
      sfx('shoot', { pitch: 0.5, volume: 0.5 });
    }
    if (b.atk[1] <= 0) {
      b.atk[1] = 3.5;
      const alive = b.parts.filter(p => p.alive);
      if (alive.length) {
        const p = alive[Math.floor(rng() * alive.length)];
        NS.hazards.zone('fire', p.x, p.y, 30, 4);
      }
    }
  }

  function prism(b, dt, to) {
    b.vx = Math.cos(b.t * 0.4) * 60;
    b.vy = Math.sin(b.t * 0.55) * 40;
    b.a += dt * 0.5;
    /* beams: telegraph, then fire while turning */
    b.beamT -= dt;
    if (b.beamT <= 0 && b.beams.length === 0) {
      const n = b.phase === 3 ? 4 : 3;
      const a0 = to.a + 0.5;
      for (let i = 0; i < n; ++i) b.beams.push({ a: a0 + i * TAU / n, warn: 1.1, on: 1.8 });
      b.spin = (rng() < 0.5 ? -1 : 1) * (b.phase === 1 ? 0.45 : 0.7);
      sfx('powerup', { pitch: 0.4, volume: 0.4 });
    }
    for (let i = 0; i < b.beams.length; ++i) {
      const bm = b.beams[i];
      if (bm.warn > 0) bm.warn -= dt;
      else {
        bm.on -= dt;
        bm.a += b.spin * dt;
        if (rng() < 0.3) sfx('laser', { volume: 0.2, pitch: 0.6 });
      }
    }
    if (b.beams.length && b.beams[0].on <= 0) {
      b.beams.length = 0;
      b.beamT = b.phase === 1 ? 3.5 : 2.5;
    }
    if (b.atk[1] <= 0) {
      b.atk[1] = 9;
      NS.rocks.spawn('crystal', 2, wrap(b.x + 90, FIELD_W), b.y, 80, 40);
    }
    if (b.atk[0] <= 0) {
      b.atk[0] = 1.8;
      W.enemyShot(b.x, b.y, to.a, 280, 'orb', 7);
    }
  }

  function tempest(b, dt, to) {
    b.vx = Math.cos(b.t * 0.5) * 50;
    b.vy = Math.sin(b.t * 0.37) * 40;
    const pylons = b.parts.filter(p => p.alive).length;
    b.shield = pylons > 0;
    b.cycle += dt;
    if (!b.shield) {
      b.open += dt;
      if (b.open > 10) {
        /* the pylons rebuild */
        for (let i = 0; i < b.parts.length; ++i) { b.parts[i].alive = true; b.parts[i].hp = b.parts[i].maxHp; }
        b.open = 0;
        fx.banner('PYLONS REBUILT', 'Bring them down again', '#e0e060', 1.4);
        sfx('powerup', { pitch: 0.5 });
      }
    }
    if (b.atk[0] <= 0) {
      b.atk[0] = b.phase === 1 ? 0.3 : 0.2;
      W.enemyShot(b.x, b.y, b.t * 2.2, 190, 'orb', 5);
      if (b.phase === 3) W.enemyShot(b.x, b.y, b.t * 2.2 + Math.PI, 190, 'orb', 5);
    }
    if (b.atk[1] <= 0) {
      b.atk[1] = 3;
      const s = G.ship;
      if (s && !s.dead) NS.hazards.strike(s.x + (rng() - 0.5) * 80, s.y + (rng() - 0.5) * 80);
    }
  }

  /* lightning between living pylons: on for 3 s, off for 2 s, flickering before it strikes */
  function tempestLinks(b) {
    const out = [];
    if (!b || b.kind !== 'tempest' || b.intro > 0) return out;
    const c = b.cycle % 5;
    const state = c < 3 ? 'on' : c > 4.4 ? 'warn' : 'off';
    if (state === 'off') return out;
    const ps = b.parts;
    for (let i = 0; i < ps.length; ++i) {
      const a = ps[i], q = ps[(i + 1) % ps.length];
      if (a.alive && q.alive) out.push({ x0: a.x, y0: a.y, x1: q.x, y1: q.y, live: state === 'on' });
    }
    return out;
  }

  function maw(b, dt, to) {
    b.vx = Math.cos(b.t * 0.3) * 70;
    b.vy = (230 - b.y) * 0.5;
    /* blinded (both eyes gone) it gapes longer */
    const blind = !b.parts.some(p => p.alive);
    const cyc = b.t % 7;
    const opening = cyc > (blind ? 1.5 : 3);
    b.open += ((opening ? 1 : 0) - b.open) * Math.min(1, dt * 4);
    if (b.open > 0.6) {
      NS.hazards.pullTo(b.x, b.y + 20, 480, b.phase === 1 ? 100 : 140, dt);
      if (b.atk[1] <= 0 && NS.rocks.count() < 7) {
        b.atk[1] = b.phase === 3 ? 1.4 : 2;
        const a = to.a + (rng() - 0.5) * 0.5;
        const r = rng();
        NS.rocks.spawn(r < 0.45 ? 'void' : r < 0.8 ? 'normal' : 'explosive', 2, wrap(b.x + Math.cos(a) * 60, FIELD_W), wrap(b.y + 40, FIELD_H), Math.cos(a) * 140, Math.sin(a) * 140);
        sfx('thud', { pitch: 0.5 });
      }
      if (b.phase === 3 && b.atk[2] <= 0) {
        b.atk[2] = 0.1;
        W.enemyShot(b.x, b.y + 30, b.t * 3, 210, 'fire', 6);
      }
    }
    if (b.atk[0] <= 0) {
      b.atk[0] = 1.6;
      for (let i = 0; i < b.parts.length; ++i) {
        const e = b.parts[i];
        if (e.alive) W.enemyShot(e.x, e.y, W.aimAt(e.x, e.y, 300, 0.1), 300, 'orb', 6);
      }
    }
  }

  /* whether the core takes damage right now */
  function coreOpen(b) {
    if (b.intro > 0 || b.dying > 0) return false;
    if (b.kind === 'tempest') return !b.shield;
    if (b.kind === 'maw') return b.open > 0.6;
    return true;
  }

  function damagePart(b, p, dmg) {
    if (!p.alive || b.intro > 0 || b.dying > 0) return;
    p.hp -= dmg;
    p.hitT = 0.1;
    if (p.hp <= 0) {
      p.alive = false;
      const pal = BOSSES[b.kind].pal;
      fx.explode(p.x, p.y, p.r * 1.5, b.kind === 'wyrm' ? fx.FIRE : fx.ICE, { pal: pal });
      sfx('explode', { pitch: 1.1, volume: 0.6 });
      if (G.run) NS.progress.kill(p.x, p.y, 500, pal[3]);
      NS.powerups.motes(p.x, p.y, 8, pal[3]);
      if (b.kind === 'tempest') { fx.flash('#e0e060', 0.25); b.open = 0; }
    } else
      sfx('hit', { volume: 0.25, pitch: 1.5 });
  }

  function damageCore(b, dmg, x, y) {
    if (!coreOpen(b)) {
      fx.hitSpark(x, y, R() * TAU, '#bff4ff');
      return;
    }
    b.hp -= dmg;
    b.hitT = 0.08;
    fx.hitSpark(x, y, R() * TAU, BOSSES[b.kind].pal[3]);
    sfx('hit', { volume: 0.3, pitch: 0.8 });
    if (b.hp <= 0) {
      b.hp = 0;
      b.dying = 2.6;
      b.beams.length = 0;
      G.eBullets.length = 0;
      fx.slowMo(2.4, 0.35);
      fx.flash('#ffffff', 0.6);
      sfx('explode', { pitch: 0.5 });
    }
  }

  function dyingStep(b, dt) {
    b.dying -= dt;
    const pal = BOSSES[b.kind].pal;
    if (R() < 0.35) {
      const a = R() * TAU, d = R() * b.r;
      fx.explode(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 24 + R() * 30, fx.FIRE, { pal: pal });
      sfx('smallExplode', { volume: 0.5 });
    }
    fx.shake(0.04);
    if (b.dying <= 0) {
      fx.explode(b.x, b.y, b.r * 2.2, fx.FIRE, { pal: pal });
      fx.shockwave(b.x, b.y, b.r * 5, pal[3]);
      fx.flash('#ffffff', 0.9);
      fx.shake(1);
      sfx('explode', { pitch: 0.4 });
      sfx('win', { volume: 0.6 });
      G.boss = null;
      for (let i = 0; i < b.parts.length; ++i)
        if (b.parts[i].alive) fx.explode(b.parts[i].x, b.parts[i].y, 30, fx.FIRE, { pal: pal });
      if (G.run) NS.progress.bossDown(b);
    }
  }

  Object.assign(NS.bosses, {
    spawn, update, place, coreOpen, damagePart, damageCore, tempestLinks
  });
})();
