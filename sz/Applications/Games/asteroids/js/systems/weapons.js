/* Player and enemy fire: the cannon with every modifier (twin barrels, tri-shot, rapid, lance,
   seekers, ricochet, criticals), the Sunbeam laser, wingdrones that fly in formation and shoot,
   orbit blades, and the motion of player and enemy shots across the wrapping field (seekers
   steer, void rocks bend shots). Owns G.bullets, G.eBullets, G.beams and G.drones. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU, FIELD_W, FIELD_H } = C;
  const { wrap, wrapD, turnToward, fx: R } = NS.rng;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { compact } = NS.grid;

  const near = [];

  function shotRamp() {
    const s = NS.cosmetics.find('shot', G.save.look.shot) || NS.cosmetics.SHOTS[0];
    return s.ramp;
  }

  function bullet(x, y, a, speedMul, opts) {
    const st = G.stats;
    const sp = C.BULLET_SPEED * st.shotSpeed * (speedMul || 1);
    const s = G.ship;
    const b = {
      alive: true, x: x, y: y, vx: Math.cos(a) * sp + (s ? s.vx * 0.35 : 0), vy: Math.sin(a) * sp + (s ? s.vy * 0.35 : 0),
      life: C.BULLET_LIFE * (0.85 + st.shotSpeed * 0.15), r: 3, dmg: st.dmg, pierce: 0, homing: false, ric: st.ricochet, last: -1, drone: false,
    };
    if (opts) Object.assign(b, opts);
    G.bullets.push(b);
    return b;
  }

  function maxBullets() {
    const s = G.ship;
    let n = G.stats.bullets;
    if (s.power.rapid) n *= 2;
    if (s.power.triple) n *= 3;
    if (G.stats.twin) n *= 2;
    return n;
  }

  /* the player's guns, called every step */
  function update(dt, intent) {
    const s = G.ship;
    G.beams.length = 0;
    if (s && !s.dead && s.hyperT <= 0) {
      s.fireT -= dt;
      s.beamOn = !!(s.power.laser && intent.fire);
      if (s.beamOn) beam(dt);
      else if (intent.fire && s.fireT <= 0) fire();
    }
    updateDrones(dt, intent);
    moveBullets(dt);
    moveEnemyBullets(dt);
  }

  function fire() {
    const s = G.ship;
    let delay = C.FIRE_DELAY / G.stats.rate;
    if (s.power.rapid) delay *= 0.5;
    if (G.run && G.run.mods && G.run.mods.indexOf('glass') >= 0) delay *= 0.9;
    let mine = 0;
    for (let i = 0; i < G.bullets.length; ++i) if (!G.bullets[i].drone) ++mine;
    if (mine >= maxBullets()) return;
    s.fireT = delay;
    const opts = { pierce: s.power.pierce ? 3 : 0, homing: !!s.power.homing };
    const nx = Math.cos(s.a), ny = Math.sin(s.a);
    const tip = s.r + 2;
    const angles = s.power.triple ? [-0.2, 0, 0.2] : [0];
    const offs = G.stats.twin ? [-5, 5] : [0];
    for (let i = 0; i < angles.length; ++i)
      for (let k = 0; k < offs.length; ++k)
        bullet(s.x + nx * tip - ny * offs[k], s.y + ny * tip + nx * offs[k], s.a + angles[i], 1, opts);
    s.vx -= nx * 6;
    s.vy -= ny * 6;
    fx.muzzle(s.x + nx * tip, s.y + ny * tip, shotRamp()[1]);
    sfx('shoot', { volume: 0.35, pitch: 1.1 + R() * 0.15 });
    if (G.run) NS.progress.count('shots', angles.length * offs.length);
  }

  /* the Sunbeam: a 900 px beam that damages everything along it every step */
  function beam(dt) {
    const s = G.ship;
    const len = 900;
    const nx = Math.cos(s.a), ny = Math.sin(s.a);
    const x0 = s.x + nx * (s.r + 2), y0 = s.y + ny * (s.r + 2);
    const end = NS.collision.beamHit(x0, y0, nx, ny, len, 9 * G.stats.dmg * dt);
    G.beams.push({ x0: x0, y0: y0, x1: x0 + nx * end, y1: y0 + ny * end });
    if (R() < 0.6) fx.sparks(x0 + nx * end, y0 + ny * end, s.a + Math.PI, 1.6, 2, '#fff0a0', 300, 0.25);
    sfx('laser', { volume: 0.18, pitch: 1.6 });
  }

  /* ── wingdrones ── */
  function updateDrones(dt, intent) {
    const s = G.ship;
    const want = s && !s.dead ? G.stats.drones : 0;
    while (G.drones.length < want) G.drones.push({ x: s.x, y: s.y, a: s.a, fireT: 0.5 + G.drones.length * 0.25, slot: G.drones.length });
    if (G.drones.length > want) G.drones.length = want;
    for (let i = 0; i < G.drones.length; ++i) {
      const d = G.drones[i];
      const side = d.slot === 0 ? 1 : -1;
      const tx = s.x - Math.cos(s.a) * 22 + Math.cos(s.a + Math.PI / 2) * 34 * side;
      const ty = s.y - Math.sin(s.a) * 22 + Math.sin(s.a + Math.PI / 2) * 34 * side;
      d.x += wrapD(tx - d.x, FIELD_W) * Math.min(1, dt * 8);
      d.y += wrapD(ty - d.y, FIELD_H) * Math.min(1, dt * 8);
      d.x = wrap(d.x, FIELD_W);
      d.y = wrap(d.y, FIELD_H);
      const target = NS.collision.nearestTarget(d.x, d.y, 420);
      d.a = turnToward(d.a, target ? Math.atan2(wrapD(target.y - d.y, FIELD_H), wrapD(target.x - d.x, FIELD_W)) : s.a, dt * 6);
      d.fireT -= dt;
      if (target && d.fireT <= 0) {
        d.fireT = 0.55;
        bullet(d.x + Math.cos(d.a) * 10, d.y + Math.sin(d.a) * 10, d.a, 0.9, { dmg: G.stats.dmg * 0.6, drone: true, ric: 0 });
        fx.muzzle(d.x + Math.cos(d.a) * 10, d.y + Math.sin(d.a) * 10, '#d08aff');
      }
    }
  }

  /* ── shot motion ── */
  function moveBullets(dt) {
    const list = G.bullets;
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      b.life -= dt;
      if (b.life <= 0) { b.alive = false; continue; }
      if (b.homing) {
        const t = NS.collision.nearestTarget(b.x, b.y, 280);
        if (t) {
          const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          const a = turnToward(Math.atan2(b.vy, b.vx), Math.atan2(wrapD(t.y - b.y, FIELD_H), wrapD(t.x - b.x, FIELD_W)), dt * 7);
          b.vx = Math.cos(a) * sp;
          b.vy = Math.sin(a) * sp;
        }
      }
      NS.hazards.bend(b, dt, 0.6);
      b.x = wrap(b.x + b.vx * dt, FIELD_W);
      b.y = wrap(b.y + b.vy * dt, FIELD_H);
    }
    compact(list);
  }

  function moveEnemyBullets(dt) {
    const list = G.eBullets;
    const k = NS.sim.worldScale();
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      b.life -= dt * k;
      if (b.life <= 0) { b.alive = false; continue; }
      b.x = wrap(b.x + b.vx * dt * k, FIELD_W);
      b.y = wrap(b.y + b.vy * dt * k, FIELD_H);
      b.spin = (b.spin || 0) + dt * 8;
    }
    compact(list);
  }

  /* an enemy shot; kind picks the look (bolt, shard, fire, orb) */
  function enemyShot(x, y, a, speed, kind, r) {
    G.eBullets.push({ alive: true, x: x, y: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 3.2, r: r || 5, kind: kind || 'bolt', spin: 0 });
  }

  /* aimed at the ship with a little lead and spread */
  function aimAt(x, y, speed, spread) {
    const s = G.ship;
    if (!s || s.dead) return R() * TAU;
    const dx = wrapD(s.x - x, FIELD_W), dy = wrapD(s.y - y, FIELD_H);
    const t = Math.sqrt(dx * dx + dy * dy) / speed;
    return Math.atan2(dy + s.vy * t * 0.5, dx + s.vx * t * 0.5) + (NS.sim.rng() - 0.5) * (spread || 0);
  }

  /* orbit blade positions around the ship (three, spinning) */
  function bladeAt(i, out) {
    const s = G.ship;
    const a = G.time * 4.2 + i * TAU / 3;
    out.x = wrap(s.x + Math.cos(a) * 52, FIELD_W);
    out.y = wrap(s.y + Math.sin(a) * 52, FIELD_H);
    out.a = a;
    return out;
  }

  Object.assign(NS.weapons, {
    update, fire, bullet, enemyShot, aimAt, bladeAt, shotRamp, maxBullets, near
  });
})();
