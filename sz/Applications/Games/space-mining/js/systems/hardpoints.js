/* The ship's weapon hardpoints in flight (career and Siege): the weapons mounted on the flown
   hull, triggers from keys and touch buttons, cooldowns and the lance's charge, a soft lock on
   the hostile nearest the aim; bolts, pellets and homing missiles (G.wshots) that hit pirates
   and invaders through the combat model and stop at rocks; the rail lance's piercing line; EMP
   mines that strip shields and stun; gravity nets that pin what they catch; the cloak; the tether
   that grabs a rock, trails it and flings it; and the drone swarm. Firing anything breaks the
   cloak. Owns G.wshots and the weapon state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { WEAPON_BY_ID, LEVEL_DMG, LEVEL_CD } = NS.weaponData;
  const { angleDiff, clamp } = NS.rng;
  const R = NS.rng.fx;
  const CB = NS.combat;

  const LOCK_CONE = 0.35;
  const near = [], rocksNear = [];
  const W = { cd: [0, 0, 0], held: [false, false, false], charge: [0, 0, 0], shots: 0, rails: [], mines: [], nets: [], tow: null, flung: [], swarm: [] };

  /* drops the entries a predicate rejects, in place */
  function keep(list, pred) {
    let j = 0;
    for (let i = 0; i < list.length; ++i) if (pred(list[i])) list[j++] = list[i];
    list.length = j;
  }

  function clear() {
    G.wshots.length = 0;
    for (let i = 0; i < 3; ++i) { W.cd[i] = 0; W.held[i] = false; W.charge[i] = 0; }
    W.shots = 0;
    W.rails.length = W.mines.length = W.nets.length = W.flung.length = W.swarm.length = 0;
    W.tow = null;
    if (G.ship) G.ship.cloak = 0;
  }

  /* the mounted weapons by hardpoint; Gold Rush and the Daily Belt fly unarmed */
  function slots() {
    const run = G.run;
    if (!run || (run.mode !== 'career' && run.mode !== 'siege')) return [];
    return CB.mounted(G.save);
  }

  function weapon(i) {
    const id = slots()[i];
    return id ? WEAPON_BY_ID[id] : null;
  }

  const lvl = (w) => Math.max(1, CB.level(G.save, w.id));
  const dmgOf = (w) => w.dmg * LEVEL_DMG[lvl(w) - 1];
  const cdOf = (w) => w.cd * LEVEL_CD[lvl(w) - 1];

  /* ── targets ── */
  function foes(fn) {
    for (let i = 0; i < G.pirates.length; ++i) if (G.pirates[i].alive) fn(G.pirates[i]);
    for (let i = 0; i < G.enemies.length; ++i) { const e = G.enemies[i]; if (e.alive && !e.dormant) fn(e); }
  }

  /* the hostile nearest the line of `a` inside `cone` and `range` of a point */
  function seek(x, y, a, range, cone) {
    let best = null, bs = Infinity;
    foes((f) => {
      const dx = f.x - x, dy = f.y - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > range + f.r) return;
      const off = Math.abs(angleDiff(a, Math.atan2(dy, dx)));
      if (off > cone) return;
      const score = d * (1 + off * 2);
      if (score < bs) { bs = score; best = f; }
    });
    return best;
  }

  /* where a weapon points: the mouse aim or the nose, bent onto a hostile close to that line */
  function aim(range) {
    const s = G.ship, inp = G.input;
    const a0 = inp.aimMode === 'mouse' ? Math.atan2(inp.aimWY - s.y, inp.aimWX - s.x) : s.angle;
    const t = seek(s.x, s.y, a0, range, LOCK_CONE);
    return { a: t ? Math.atan2(t.y - s.y, t.x - s.x) : a0, t: t };
  }

  /* a hit through the combat model: pirates and invaders by their armour */
  function hit(t, dmg, type, x, y) {
    if (!t || !t.alive || dmg <= 0) return;
    if (t.def) NS.enemies.damage(t, dmg, null, type);
    else NS.pirates.damage(t, dmg, x, y, type);
  }

  function breakCloak() {
    if (G.ship && G.ship.cloak > 0) {
      G.ship.cloak = 0;
      NS.fx.ring(G.ship.x, G.ship.y, 10, 90, 0.4, '#a0b4d0', 3);
    }
  }

  /* ── triggers ── */
  function trigger(i, down) {
    const w = weapon(i), s = G.ship;
    if (!w || !s || !s.alive || G.cine) { W.held[i] = false; W.charge[i] = 0; return false; }
    if (down) {
      if (W.held[i]) return true;
      W.held[i] = true;
      if (w.mode === 'press' || w.mode === 'toggle') use(i, w);
    } else {
      if (w.mode === 'charge' && W.held[i]) release(i, w);
      W.held[i] = false;
    }
    return true;
  }

  function shot(kind, a, speed, dmg, w, extra) {
    const s = G.ship;
    const o = Object.assign({ kind: kind, x: s.x + Math.cos(a) * s.r, y: s.y + Math.sin(a) * s.r, vx: Math.cos(a) * speed + s.vx * 0.5, vy: Math.sin(a) * speed + s.vy * 0.5,
      angle: a, speed: speed, dmg: dmg, type: w.type, color: w.color, life: (w.range || 600) / speed, target: null, turn: 0, splash: 0 }, extra || {});
    G.wshots.push(o);
    return o;
  }

  /* pulse, flak, missiles: fire while held */
  function fireAuto(i, w) {
    const s = G.ship;
    const t = aim(w.range);
    if (w.id === 'pulse') {
      shot('bolt', t.a, w.speed, dmgOf(w), w);
      NS.audio.sfx('shoot', { volume: 0.25, pitch: 1.7 });
    } else if (w.id === 'flak') {
      for (let k = 0; k < w.pellets; ++k) {
        const a = t.a + (k / (w.pellets - 1) - 0.5) * w.spread + (R() - 0.5) * 0.04;
        shot('pellet', a, w.speed * (0.9 + R() * 0.2), dmgOf(w), w);
      }
      NS.audio.sfx('shoot', { volume: 0.35, pitch: 0.8 });
    } else if (w.id === 'missile') {
      for (let k = 0; k < w.salvo; ++k)
        shot('missile', t.a + (k - (w.salvo - 1) / 2) * 0.35, w.speed, dmgOf(w), w, { target: t.t, turn: w.turn, splash: w.splash, life: w.range / w.speed * 1.4 });
      NS.audio.sfx('whoosh', { volume: 0.4, pitch: 1.2 });
    }
    W.cd[i] = cdOf(w);
    ++W.shots;
    breakCloak();
    s.vx -= Math.cos(t.a) * 4;
    s.vy -= Math.sin(t.a) * 4;
  }

  /* the rail lance: fires on release, at the charge it reached */
  function release(i, w) {
    const c = W.charge[i];
    W.charge[i] = 0;
    if (c < w.charge * 0.3 || W.cd[i] > 0) return;
    const s = G.ship, k = c / w.charge;
    const t = aim(w.range);
    const x0 = s.x, y0 = s.y, x1 = x0 + Math.cos(t.a) * w.range, y1 = y0 + Math.sin(t.a) * w.range;
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
    foes((f) => {
      const u = clamp(((f.x - x0) * dx + (f.y - y0) * dy) / len2, 0, 1);
      const px = x0 + dx * u, py = y0 + dy * u;
      if ((f.x - px) * (f.x - px) + (f.y - py) * (f.y - py) < (f.r + 14) * (f.r + 14)) {
        hit(f, dmgOf(w) * k, w.type, f.x, f.y);
        NS.fx.hitSpark(f.x, f.y, t.a + Math.PI, '#e0e8ff');
      }
    });
    W.rails.push({ x0: x0, y0: y0, x1: x1, y1: y1, t: 0.35, k: k });
    W.cd[i] = cdOf(w);
    ++W.shots;
    breakCloak();
    s.vx -= Math.cos(t.a) * 60 * k;
    s.vy -= Math.sin(t.a) * 60 * k;
    NS.fx.shake(6 * k);
    NS.audio.sfx('zap', { volume: 0.7, pitch: 0.5 });
  }

  /* EMP mine, net, cloak, swarm on a press; the tether grabs and flings */
  function use(i, w) {
    const s = G.ship;
    if (W.cd[i] > 0) return;
    if (w.id === 'tether') { tetherPress(w); W.cd[i] = cdOf(w); return; }
    if (w.id === 'emp') {
      W.mines.push({ x: s.x, y: s.y, arm: w.arm, t: 15, w: w });
      NS.audio.sfx('drop', { volume: 0.5 });
    } else if (w.id === 'net') {
      const t = aim(w.range);
      shot('net', t.a, w.speed, 0, w, { life: w.range / w.speed });
      NS.audio.sfx('whoosh', { volume: 0.4, pitch: 0.7 });
    } else if (w.id === 'cloak') {
      s.cloak = w.dur;
      NS.fx.ring(s.x, s.y, 80, 10, 0.4, '#a0b4d0', 3);
      NS.audio.sfx('powerup', { volume: 0.5, pitch: 0.6 });
      W.cd[i] = cdOf(w);
      return;
    } else if (w.id === 'swarm') {
      for (let k = 0; k < w.drones; ++k) {
        const a = k / w.drones * TAU;
        W.swarm.push({ x: s.x + Math.cos(a) * 30, y: s.y + Math.sin(a) * 30, vx: s.vx, vy: s.vy, angle: a, t: w.dur, fireT: R() * w.rof, orbit: a, w: w });
      }
      NS.audio.sfx('powerup', { volume: 0.5, pitch: 1.3 });
    }
    W.cd[i] = cdOf(w);
    ++W.shots;
    breakCloak();
  }

  /* ── per step ── */
  function update(dt) {
    const s = G.ship;
    if (!s || !G.run) return;
    if (s.cloak > 0) {
      s.cloak -= dt;
      if (G.run.lasering) breakCloak();
    }
    for (let i = 0; i < 3; ++i) {
      W.cd[i] -= dt;
      const w = weapon(i);
      if (!w) { W.held[i] = false; continue; }
      if (!W.held[i] || !s.alive || G.cine) continue;
      if (w.mode === 'auto' && W.cd[i] <= 0) fireAuto(i, w);
      else if (w.mode === 'charge' && W.cd[i] <= 0) W.charge[i] = Math.min(w.charge, W.charge[i] + dt);
    }
    shots(dt);
    for (let i = 0; i < W.rails.length; ++i) W.rails[i].t -= dt;
    keep(W.rails, (r) => r.t > 0);
    mines(dt);
    held(dt);
    tether(dt);
    swarm(dt);
  }

  function foeAt(x, y, pad) {
    for (let i = 0; i < G.pirates.length; ++i) {
      const p = G.pirates[i];
      if (p.alive && (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < (p.r + pad) * (p.r + pad)) return p;
    }
    const list = NS.enemies.queryHostile(x, y, 60, near);
    for (let i = 0; i < list.length; ++i) {
      const e = list[i];
      if (e.alive && !e.dormant && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) < (e.r + pad) * (e.r + pad)) return e;
    }
    return null;
  }

  function rockAt(x, y) {
    const list = NS.asteroids.queryRocks(x, y, 8, rocksNear);
    for (let i = 0; i < list.length; ++i) {
      const r = list[i];
      if (r.alive && (r.x - x) * (r.x - x) + (r.y - y) * (r.y - y) < r.r * r.r * 0.8) return r;
    }
    return null;
  }

  function shots(dt) {
    for (let i = 0; i < G.wshots.length; ++i) {
      const o = G.wshots[i];
      if (o.kind === 'missile') {
        if (!o.target || !o.target.alive) o.target = seek(o.x, o.y, o.angle, 900, 1.2);
        if (o.target) {
          o.angle += clamp(angleDiff(o.angle, Math.atan2(o.target.y - o.y, o.target.x - o.x)), -o.turn * dt, o.turn * dt);
          o.vx = Math.cos(o.angle) * o.speed;
          o.vy = Math.sin(o.angle) * o.speed;
        }
        if (R() < dt * 30) NS.fx.exhaust(o.x, o.y, -o.vx * 0.2, -o.vy * 0.2, 4, '#ffd0a0', null);
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      const f = foeAt(o.x, o.y, o.kind === 'net' ? 10 : 4);
      if (f || o.life <= 0 || rockAt(o.x, o.y)) {
        o.dead = true;
        if (o.kind === 'net') net(o);
        else if (o.splash && (f || o.life > 0 || o.kind === 'missile')) burst(o);
        else if (f) {
          hit(f, o.dmg, o.type, o.x, o.y);
          NS.fx.hitSpark(o.x, o.y, o.angle + Math.PI, o.color);
        }
      }
    }
    keep(G.wshots, (o) => !o.dead);
  }

  function burst(o) {
    const r = o.splash;
    foes((f) => {
      const d = Math.sqrt((f.x - o.x) * (f.x - o.x) + (f.y - o.y) * (f.y - o.y));
      if (d < r + f.r) hit(f, o.dmg * (1 - 0.5 * d / (r + f.r)), o.type, f.x, f.y);
    });
    NS.fx.explode(o.x, o.y, Math.max(10, r * 0.35), NS.fx.FIRE, { noDebris: true });
    NS.audio.sfxAt('explode', o.x, o.y, { volume: 0.35, pitch: 1.3 });
  }

  function net(o) {
    const w = WEAPON_BY_ID.net;
    foes((f) => {
      if ((f.x - o.x) * (f.x - o.x) + (f.y - o.y) * (f.y - o.y) > (w.radius + f.r) * (w.radius + f.r)) return;
      f.held = w.hold * (0.85 + 0.15 * lvl(w));
      f.heldX = f.x;
      f.heldY = f.y;
    });
    W.nets.push({ x: o.x, y: o.y, t: w.hold, r: w.radius });
    NS.fx.ring(o.x, o.y, 10, w.radius, 0.4, w.color, 3);
  }

  /* what a net caught stays close to where it was caught */
  function held(dt) {
    const k = Math.min(1, dt * 14);
    foes((f) => {
      if (!(f.held > 0)) return;
      f.held -= dt;
      f.x += (f.heldX - f.x) * k;
      f.y += (f.heldY - f.y) * k;
      f.vx *= 0.5;
      f.vy *= 0.5;
    });
    for (let i = 0; i < W.nets.length; ++i) W.nets[i].t -= dt;
    keep(W.nets, (n) => n.t > 0);
  }

  function mines(dt) {
    for (let i = 0; i < W.mines.length; ++i) {
      const m = W.mines[i], w = m.w;
      m.arm -= dt;
      m.t -= dt;
      if (m.arm > 0) continue;
      let trip = m.t <= 0;
      if (!trip) foes((f) => { if ((f.x - m.x) * (f.x - m.x) + (f.y - m.y) * (f.y - m.y) < (w.radius * 0.7 + f.r) * (w.radius * 0.7 + f.r)) trip = true; });
      if (!trip) continue;
      m.dead = true;
      foes((f) => {
        if ((f.x - m.x) * (f.x - m.x) + (f.y - m.y) * (f.y - m.y) > (w.radius + f.r) * (w.radius + f.r)) return;
        if (f.def) {
          f.shield = 0;
          f.stun = Math.max(f.stun || 0, w.stun);
        } else {
          f.fireT = Math.max(f.fireT, w.stun);
          f.vx *= 0.2;
          f.vy *= 0.2;
        }
        hit(f, dmgOf(w), w.type, f.x, f.y);
      });
      NS.fx.shockwave(m.x, m.y, w.radius * 1.4, w.color);
      NS.audio.sfx('zap', { volume: 0.8, pitch: 1.4 });
    }
    keep(W.mines, (m) => !m.dead);
  }

  /* ── the tether ── */
  function tetherPress(w) {
    const s = G.ship;
    if (!W.tow) {
      let best = null, bd = w.grab * w.grab;
      for (let i = 0; i < G.rocks.length; ++i) {
        const r = G.rocks[i];
        if (!r.alive || r.kind !== 'rock' || r.tier > 2) continue;
        const d = (r.x - s.x) * (r.x - s.x) + (r.y - s.y) * (r.y - s.y);
        if (d < bd) { bd = d; best = r; }
      }
      if (best) {
        W.tow = best;
        best.towed = true;
        NS.audio.sfx('thud', { volume: 0.5, pitch: 1.4 });
      }
      return;
    }
    /* fling: the rock whips round to the front and flies at the aim */
    const r = W.tow, t = aim(w.range || 900);
    W.tow = null;
    r.towed = false;
    const d = s.r + r.r + 24;
    r.x = s.x + Math.cos(t.a) * d;
    r.y = s.y + Math.sin(t.a) * d;
    r.vx = Math.cos(t.a) * w.fling + s.vx;
    r.vy = Math.sin(t.a) * w.fling + s.vy;
    NS.asteroids.rebuildGrid();
    W.flung.push({ rock: r, t: 2, home: 0.6, target: t.t, dmg: dmgOf(w) * (1 + r.tier * 0.5), hit: [] });
    ++W.shots;
    breakCloak();
    NS.fx.ring(r.x, r.y, 10, 70, 0.3, w.color, 3);
    NS.audio.sfx('whoosh', { volume: 0.6, pitch: 0.9 });
  }

  function tether(dt) {
    const s = G.ship, r = W.tow;
    if (r) {
      if (!r.alive || !s.alive) { r.towed = false; W.tow = null; }
      else {
        const d = s.r + r.r + 50;
        const tx = s.x - Math.cos(s.angle) * d, ty = s.y - Math.sin(s.angle) * d;
        r.vx = (tx - r.x) * 6 + s.vx;
        r.vy = (ty - r.y) * 6 + s.vy;
      }
    }
    for (let i = 0; i < W.flung.length; ++i) {
      const f = W.flung[i], rk = f.rock;
      f.t -= dt;
      f.home -= dt;
      if (!rk.alive || f.t <= 0) { f.dead = true; continue; }
      if (f.home > 0 && f.target && f.target.alive) {
        const sp = Math.sqrt(rk.vx * rk.vx + rk.vy * rk.vy);
        let a = Math.atan2(rk.vy, rk.vx);
        a += clamp(angleDiff(a, Math.atan2(f.target.y - rk.y, f.target.x - rk.x)), -3 * dt, 3 * dt);
        rk.vx = Math.cos(a) * sp;
        rk.vy = Math.sin(a) * sp;
      }
      foes((e) => {
        if (f.hit.indexOf(e) >= 0) return;
        if ((e.x - rk.x) * (e.x - rk.x) + (e.y - rk.y) * (e.y - rk.y) < (e.r + rk.r) * (e.r + rk.r)) {
          f.hit.push(e);
          hit(e, f.dmg, 'kinetic', e.x, e.y);
          NS.fx.shake(4);
          NS.fx.hitSpark(e.x, e.y, Math.atan2(rk.vy, rk.vx) + Math.PI, '#9ac4ff');
        }
      });
    }
    keep(W.flung, (f) => !f.dead);
  }

  /* ── the drone swarm ── */
  function swarm(dt) {
    const s = G.ship;
    for (let i = 0; i < W.swarm.length; ++i) {
      const d = W.swarm[i], w = d.w;
      d.t -= dt;
      if (d.t <= 0) { d.dead = true; NS.fx.sparks(d.x, d.y, 0, TAU, 6, w.color, 120, 0.3); continue; }
      let best = null, bd = 900 * 900;
      foes((f) => {
        const q = (f.x - s.x) * (f.x - s.x) + (f.y - s.y) * (f.y - s.y);
        if (q < bd) { bd = q; best = f; }
      });
      d.orbit += dt * 2.4;
      const cx = best ? best.x : s.x, cy = best ? best.y : s.y, rad = best ? 150 : 70;
      const tx = cx + Math.cos(d.orbit) * rad, ty = cy + Math.sin(d.orbit) * rad;
      d.vx += ((tx - d.x) * 4 - d.vx) * Math.min(1, dt * 3);
      d.vy += ((ty - d.y) * 4 - d.vy) * Math.min(1, dt * 3);
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.angle = Math.atan2(d.vy, d.vx);
      d.fireT -= dt;
      if (best && d.fireT <= 0 && (best.x - d.x) * (best.x - d.x) + (best.y - d.y) * (best.y - d.y) < 420 * 420) {
        d.fireT = w.rof;
        const a = Math.atan2(best.y - d.y, best.x - d.x);
        G.wshots.push({ kind: 'bolt', x: d.x, y: d.y, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, angle: a, speed: 1000, dmg: dmgOf(w), type: w.type,
          color: w.color, life: 0.5, target: null, turn: 0, splash: 0 });
      }
    }
    keep(W.swarm, (d) => !d.dead);
  }

  /* hardpoint i for the HUD: { w, ready (0..1), charge (0..1), level } */
  function hud(i) {
    const w = weapon(i);
    if (!w) return null;
    return { w: w, ready: W.cd[i] > 0 ? 1 - W.cd[i] / cdOf(w) : 1, charge: w.mode === 'charge' ? W.charge[i] / w.charge : 0, level: lvl(w), towing: w.id === 'tether' && !!W.tow };
  }

  Object.assign(NS.hardpoints, {
    clear, slots, trigger, update, hit, hud, state: () => W
  });
})();
