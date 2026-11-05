/* Raider ships and how each fights: saucers crossing and firing at random, sniper saucers that
   aim, hunter packs that ram, gunships that strafe and burst, mine-layers that sow the field,
   phantoms that cloak and blink, splitters that burst into hunters. Spawning, damage, death
   and loot. Owns G.enemies. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { TAU, FIELD_W, FIELD_H } = NS.constants;
  const { ENEMIES } = NS.enemyData;
  const { wrap, wrapD, turnToward } = NS.rng;
  const fx = NS.fx;
  const W = NS.weapons;
  const { sfx } = NS.audio;
  const { compact } = NS.grid;

  function rng() {
    return NS.sim.rng();
  }

  function spawn(kind, x, y) {
    const D = ENEMIES[kind];
    const fromLeft = rng() < 0.5;
    const e = {
      alive: true, id: G.nextId++, kind: kind, r: D.r, hp: D.hp, maxHp: D.hp, a: 0, t: 0, hitT: 0,
      fireT: D.fire * (0.6 + rng() * 0.6), dir: fromLeft ? 1 : -1, vx: 0, vy: 0, travel: 0, cloak: 0, phase: 0, baseY: 0,
      x: x !== undefined ? x : fromLeft ? 0 : FIELD_W - 1, y: y !== undefined ? y : 60 + rng() * (FIELD_H - 120),
      enterT: 0.6,
    };
    e.baseY = e.y;
    if (kind === 'hunter' || kind === 'gunship' || kind === 'splitter' || kind === 'phantom') {
      if (x === undefined) {
        const side = Math.floor(rng() * 4);
        e.x = side < 2 ? rng() * FIELD_W : side === 2 ? 0 : FIELD_W - 1;
        e.y = side >= 2 ? rng() * FIELD_H : side === 0 ? 0 : FIELD_H - 1;
      }
    }
    G.enemies.push(e);
    if (kind === 'hunter' && x === undefined)
      for (let i = 0; i < 2; ++i) {
        const h = spawn('hunter', wrap(e.x + (rng() - 0.5) * 60, FIELD_W), wrap(e.y + (rng() - 0.5) * 60, FIELD_H));
        h.fireT = 99;
      }
    sfx('whoosh', { volume: 0.25, pitch: 0.8 });
    return e;
  }

  function toShip(e) {
    const s = G.ship;
    if (!s || s.dead) return null;
    const dx = wrapD(s.x - e.x, FIELD_W), dy = wrapD(s.y - e.y, FIELD_H);
    return { dx: dx, dy: dy, d: Math.sqrt(dx * dx + dy * dy) || 1 };
  }

  function update(dt) {
    const k = NS.sim.worldScale();
    const kdt = dt * k;
    const list = G.enemies;
    for (let i = 0; i < list.length; ++i) {
      const e = list[i];
      if (!e.alive) continue;
      const D = ENEMIES[e.kind];
      e.t += kdt;
      e.hitT = Math.max(0, e.hitT - dt);
      e.enterT = Math.max(0, e.enterT - dt);
      const to = toShip(e);
      switch (e.kind) {
        case 'saucer':
        case 'sniper': {
          e.vx = D.speed * e.dir;
          e.vy = Math.sin(e.t * 1.6 + e.id) * 60;
          if (Math.floor(e.t / 2.2) % 3 === 2) e.vy = (e.id % 2 ? 1 : -1) * D.speed * 0.5;
          e.travel += Math.abs(e.vx) * kdt;
          if (e.travel > FIELD_W * 1.4) e.alive = false;
          e.fireT -= kdt;
          if (e.fireT <= 0) {
            e.fireT = D.fire * (0.8 + rng() * 0.4);
            const a = e.kind === 'sniper' ? W.aimAt(e.x, e.y, 330, 0.12) : rng() * TAU;
            W.enemyShot(e.x, e.y, a, e.kind === 'sniper' ? 330 : 260, 'bolt', 4);
            sfx('laser', { volume: 0.25, pitch: e.kind === 'sniper' ? 1.5 : 1 });
          }
          break;
        }
        case 'hunter': {
          const want = to ? Math.atan2(to.dy, to.dx) : e.a;
          e.a = turnToward(e.a, want, kdt * 2.6);
          const sp = D.speed * Math.min(1, 0.4 + e.t * 0.5);
          e.vx += (Math.cos(e.a) * sp - e.vx) * Math.min(1, kdt * 3);
          e.vy += (Math.sin(e.a) * sp - e.vy) * Math.min(1, kdt * 3);
          if (NS.rng.fx() < 0.4) fx.exhaust(e.x - Math.cos(e.a) * 8, e.y - Math.sin(e.a) * 8, -e.vx * 0.3, -e.vy * 0.3, 6, '#ff6a3a');
          break;
        }
        case 'gunship': {
          if (to) {
            e.a = Math.atan2(to.dy, to.dx);
            const ideal = 260;
            const radial = to.d > ideal + 40 ? 1 : to.d < ideal - 40 ? -1 : 0;
            const px = -to.dy / to.d, py = to.dx / to.d;
            const side = Math.sin(e.t * 0.7 + e.id) > 0 ? 1 : -1;
            e.vx += ((to.dx / to.d) * radial * D.speed + px * side * D.speed * 0.7 - e.vx) * Math.min(1, kdt * 1.5);
            e.vy += ((to.dy / to.d) * radial * D.speed + py * side * D.speed * 0.7 - e.vy) * Math.min(1, kdt * 1.5);
          }
          e.fireT -= kdt;
          if (e.fireT <= 0) {
            e.phase = 3;
            e.fireT = D.fire;
          }
          if (e.phase > 0 && (e.t * 8 | 0) !== (e._b | 0)) {
            e._b = e.t * 8;
            --e.phase;
            W.enemyShot(e.x, e.y, W.aimAt(e.x, e.y, 300, 0.18), 300, 'bolt', 5);
            sfx('shoot', { volume: 0.25, pitch: 0.7 });
          }
          break;
        }
        case 'layer': {
          e.vx = D.speed * e.dir;
          e.vy = Math.cos(e.t * 0.9 + e.id) * 110;
          e.travel += Math.abs(e.vx) * kdt;
          if (e.travel > FIELD_W * 2.2) e.alive = false;
          e.fireT -= kdt;
          if (e.fireT <= 0) {
            e.fireT = D.fire;
            NS.hazards.mine(e.x, e.y);
          }
          break;
        }
        case 'phantom': {
          e.cloak += kdt;
          const cyc = e.cloak % 4.4;
          const was = e.phase;
          e.phase = cyc < 2.4 ? 0 : 1;
          if (was === 1 && e.phase === 0) {
            /* reappear somewhere near the ship and fire */
            if (to) {
              const a = rng() * TAU;
              e.x = wrap(G.ship.x + Math.cos(a) * 240, FIELD_W);
              e.y = wrap(G.ship.y + Math.sin(a) * 240, FIELD_H);
            }
            fx.ring(e.x, e.y, 40, 4, 0.3, D.col, 3);
            for (let s = -1; s <= 1; ++s) W.enemyShot(e.x, e.y, W.aimAt(e.x, e.y, 320, 0) + s * 0.18, 320, 'orb', 5);
            sfx('zap', { volume: 0.35, pitch: 1.4 });
          }
          if (to) e.a = Math.atan2(to.dy, to.dx);
          e.vx = Math.cos(e.t * 0.8 + e.id) * D.speed * 0.6;
          e.vy = Math.sin(e.t * 1.1 + e.id) * D.speed * 0.6;
          break;
        }
        case 'splitter': {
          if (to) {
            e.vx += (to.dx / to.d * D.speed - e.vx) * Math.min(1, kdt);
            e.vy += (to.dy / to.d * D.speed - e.vy) * Math.min(1, kdt);
          }
          e.a += kdt * 1.5;
          e.fireT -= kdt;
          if (e.fireT <= 0) {
            e.fireT = D.fire;
            for (let s = 0; s < 6; ++s) W.enemyShot(e.x, e.y, e.a + s * TAU / 6, 200, 'shard', 5);
            sfx('laser', { volume: 0.25, pitch: 0.8 });
          }
          break;
        }
      }
      if (e.kind !== 'hunter' && e.kind !== 'phantom' && e.kind !== 'gunship' && e.kind !== 'splitter') e.a = Math.atan2(e.vy, e.vx);
      NS.hazards.bend(e, dt, 0.3);
      e.x = wrap(e.x + e.vx * kdt, FIELD_W);
      e.y = wrap(e.y + e.vy * kdt, FIELD_H);
    }
    compact(list);
  }

  /* phantoms can only be hit while visible */
  function hittable(e) {
    return !(e.kind === 'phantom' && e.phase === 1) && e.enterT <= 0.3;
  }

  function damage(e, dmg) {
    if (!e.alive || !hittable(e)) return false;
    e.hp -= dmg;
    e.hitT = 0.1;
    if (e.hp > 0) {
      fx.hitSpark(e.x, e.y, NS.rng.fx() * TAU, ENEMIES[e.kind].col);
      sfx('hit', { volume: 0.3, pitch: 1.3 });
      return false;
    }
    destroy(e);
    return true;
  }

  function destroy(e, quiet) {
    const D = ENEMIES[e.kind];
    e.alive = false;
    fx.explode(e.x, e.y, e.r * 1.3, e.kind === 'phantom' ? fx.VIOLET : e.kind === 'saucer' ? fx.TOXIC : fx.FIRE, { pal: ['#ffffff', '#8a90a0', '#3a3e48', D.col] });
    sfx('explode', { volume: 0.55, pitch: 1.2 });
    if (quiet || !G.run) return;
    if (e.kind === 'splitter')
      for (let i = 0; i < 3; ++i) {
        const h = spawn('hunter', wrap(e.x + Math.cos(i * 2.1) * 30, FIELD_W), wrap(e.y + Math.sin(i * 2.1) * 30, FIELD_H));
        h.enterT = 0;
        h.a = i * 2.1;
      }
    const bounty = G.run.mods && G.run.mods.indexOf('bounty') >= 0 ? 3 : 1;
    NS.progress.kill(e.x, e.y, D.score * bounty, D.col);
    NS.progress.count('raiders', 1);
    NS.powerups.motes(e.x, e.y, D.dust, '#ffd25a');
    if (NS.sim.rng() < 0.28 * G.stats.luck) NS.powerups.drop(e.x, e.y);
  }

  function countKinds() {
    let n = 0;
    for (let i = 0; i < G.enemies.length; ++i) if (G.enemies[i].alive && G.enemies[i].kind !== 'hunter') ++n;
    return n;
  }

  Object.assign(NS.enemies, {
    spawn, update, damage, destroy, hittable, countKinds
  });
})();
