/* Invaders and every shot of the outpost war: swarmers that bite, raiders that strafe, bombers
   that dive on buildings, shielded frigates, brood carriers and the hive nests that spawn
   swarmers, siege ships shelling from beyond turret range, nanoprobe swarms that corrupt what
   they touch, Lattice drones, and the hive mothership; migrating broods that only bite what
   crosses them; the hostile grid (invaders plus deserters) and target picking; bolts, shells,
   flak, homing missiles, lobbed artillery and bombs with their hits and blasts; deaths, loot
   and the EMP. Owns G.enemies and G.shots. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU } = C;
  const { ENEMY_BY_ID } = NS.fleetData;
  const { createGrid, compact, createPool } = NS.grid;
  const { angleDiff, clamp } = NS.rng;
  const R = NS.rng.fx;

  const grid = createGrid(C.WORLD_W, C.WORLD_H, 160);
  const near = [];
  const shotPool = createPool(() => ({ alive: false }));
  let nextId = 1;

  function spawn(type, x, y, opts) {
    opts = opts || {};
    const def = ENEMY_BY_ID[type];
    const zone = G.run ? G.run.zone : { danger: 1 };
    const hpMul = (1 + 0.3 * (zone.danger - 1)) * (opts.hpMul || 1);
    const e = {
      alive: true, id: nextId++, type: type, def: def, x: x, y: y, vx: 0, vy: 0, angle: opts.angle || 0, r: def.r,
      hp: def.hp * hpMul, maxHp: def.hp * hpMul, shield: (def.shield || 0) * hpMul, maxShield: (def.shield || 0) * hpMul, shieldT: 0,
      speed: def.speed * (0.9 + R() * 0.2), fireT: 0.5 + R() * def.rof, target: null, retarget: 0, spawnT: 2 + R() * 2,
      wave: opts.wave || 0, migrate: opts.migrate || null, guard: opts.guard || null, dormant: !!opts.dormant, home: opts.home || '', flash: 0, bank: 0,
      exT: R() * 0.1, stun: 0, children: 0, parent: opts.parent || null, wob: R() * TAU, gun: 0, bombed: 0,
    };
    G.enemies.push(e);
    return e;
  }

  /* ── queries ── */
  function rebuild() {
    grid.reset(G.world.w, G.world.h);
    for (let i = 0; i < G.enemies.length; ++i) if (G.enemies[i].alive) grid.insert(G.enemies[i]);
    for (let i = 0; i < G.units.length; ++i) if (G.units[i].alive && G.units[i].side === 'rogue') grid.insert(G.units[i]);
  }

  /* the hostile a defender should shoot: pref small | big | swarm | any (rogue buildings too) */
  function nearest(x, y, range, pref) {
    const list = grid.query(x, y, range, near);
    let best = null, bs = Infinity;
    const r2 = range * range;
    for (let i = 0; i < list.length; ++i) {
      const e = list[i];
      if (!e.alive || e.dormant) continue;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d > r2) continue;
      let s = Math.sqrt(d);
      if (pref === 'small' && e.r < 22) s *= 0.6;
      else if (pref === 'big' && e.r >= 26) s *= 0.5;
      else if (pref === 'swarm' && e.type === 'swarmer') s *= 0.5;
      if (s < bs) { bs = s; best = e; }
    }
    const b = G.base;
    if (b) for (let i = 0; i < b.data.buildings.length; ++i) {
      const o = b.data.buildings[i];
      if (!o.rogue) continue;
      const d = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y);
      if (d < r2 && Math.sqrt(d) * 1.2 < bs) { bs = Math.sqrt(d) * 1.2; best = o; }
    }
    return best;
  }

  function queryHostile(x, y, r, out) {
    return grid.query(x, y, r, out || near);
  }

  /* the nearest building, optionally skipping turrets (bombers love soft targets) */
  function nearestBuilding(x, y, soft) {
    const b = G.base;
    if (!b) return null;
    let best = null, bd = Infinity;
    for (let i = 0; i < b.data.buildings.length; ++i) {
      const o = b.data.buildings[i];
      if (!o.alive || o.rogue) continue;
      let d = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y);
      if (soft && NS.colonyData.BUILDING_BY_ID[o.type].range) d *= 2.2;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /* ── damage ── */
  function hitTarget(t, dmg, side, by) {
    if (!t || !t.alive) return;
    if (t === G.ship) { NS.ship.hurt(dmg, 'bolt'); return; }
    if (t.cx !== undefined) {
      if (side === 'player' && !t.rogue) return;
      NS.base.damage(t, dmg, side);
      return;
    }
    if (t.side) { NS.units.damage(t, dmg, by); return; }
    damage(t, dmg, by);
  }

  function damage(e, amount, by) {
    if (!e.alive || amount <= 0) return;
    if (e.dormant) wake(e);
    e.flash = 0.08;
    e.shieldT = 3;
    if (e.shield > 0) {
      const a = Math.min(e.shield, amount * 0.9);
      e.shield -= a;
      amount -= a;
      e.shieldHit = 0.2;
    }
    e.hp -= amount;
    if (e.hp <= 0) die(e, by);
  }

  function die(e, by) {
    e.alive = false;
    const d = e.def;
    const big = e.r > 30;
    const ramp = d.faction === 'lattice' ? NS.fx.TOXIC : d.faction === 'alien' ? NS.fx.VIOLET : NS.fx.FIRE;
    NS.fx.explode(e.x, e.y, e.r * (d.boss ? 2.4 : 1.3), ramp, { debrisColor: d.faction === 'alien' ? '#5a2a6a' : '#5a4a4a' });
    if (big) NS.fx.shockwave(e.x, e.y, e.r * 6, d.color);
    NS.audio.sfxAt(big ? 'explode' : 'smallExplode', e.x, e.y, { volume: big ? 0.9 : 0.5 });
    if (by && by.side) NS.units.credit(by);
    if (d.loot) NS.mining.spawnSalvage(e.x, e.y, Math.round(d.loot * (G.stats.salvage || 1)), Math.min(6, 1 + Math.floor(e.r / 12)));
    if (d.faction === 'pirate' && R() < 0.5) NS.mining.spawnNugget(e.x, e.y, 'scrap', 1 + Math.floor(e.r / 14), null, 140);
    if (d.faction === 'lattice') NS.mining.spawnNugget(e.x, e.y, 'scrap', 1, null, 120);
    if (d.faction === 'alien' && R() < 0.25) NS.mining.spawnNugget(e.x, e.y, 'biomass', 1, null, 120);
    if (d.jelly) for (let i = 0; i < d.jelly; ++i) NS.mining.spawnNugget(e.x, e.y, 'hiveJelly', 1, null, 220);
    if (G.run && G.run.mode !== 'rush' && G.run.mode !== 'daily') {
      ++G.run.invaders;
      if (G.run.mode === 'career') NS.rules.bump(G.save, 'invaders', 1);
    }
    if (e.parent) e.parent.children = Math.max(0, e.parent.children - 1);
    if (d.boss) NS.waves.bossDown(e);
    if (e.type === 'hive') NS.events.hiveDown(e);
  }

  function wake(e) {
    if (!e.dormant) return;
    e.dormant = false;
    e.spawnT = 0.5;
    NS.events.hiveWakes(e);
  }

  /* ── shots ── */
  function fire(side, kind, x, y, target, dmg, speed, opts) {
    if (G.shots.length > 900) return null;
    opts = opts || {};
    const s = shotPool.get();
    let tx = target ? target.x : x, ty = target ? target.y : y;
    if (target && (kind === 'bolt' || kind === 'shell' || kind === 'flak' || kind === 'nanobolt')) {
      const lead = Math.sqrt((tx - x) * (tx - x) + (ty - y) * (ty - y)) / speed;
      tx += (target.vx || 0) * lead * 0.8;
      ty += (target.vy || 0) * lead * 0.8;
    }
    const a = Math.atan2(ty - y, tx - x) + (kind === 'bolt' || kind === 'nanobolt' ? (R() - 0.5) * 0.05 : 0);
    s.alive = true;
    s.side = side;
    s.kind = kind;
    s.x = x; s.y = y; s.x0 = x; s.y0 = y;
    s.vx = Math.cos(a) * speed;
    s.vy = Math.sin(a) * speed;
    s.angle = a;
    s.speed = speed;
    s.target = target;
    s.dmg = dmg;
    s.tx = tx; s.ty = ty;
    s.splash = opts.splash || 0;
    s.turn = opts.turn || 0;
    s.delay = opts.delay || 0;
    s.from = opts.from || null;
    s.corrupt = opts.corrupt || 0;
    s.t = 0;
    const dist = Math.sqrt((tx - x) * (tx - x) + (ty - y) * (ty - y));
    s.flight = kind === 'artillery' || kind === 'flak' || kind === 'bomb' ? Math.max(0.15, dist / speed) : 0;
    s.life = kind === 'missile' ? 3.2 : kind === 'artillery' || kind === 'flak' || kind === 'bomb' ? s.flight + 0.05 : 1.4;
    s.trailT = 0;
    G.shots.push(s);
    return s;
  }

  function burst(s) {
    const r = s.splash;
    NS.fx.explode(s.x, s.y, Math.max(10, r * 0.35), s.side === 'enemy' ? NS.fx.FIRE : NS.fx.PLASMA, { noDebris: true });
    if (r > 70) NS.fx.shockwave(s.x, s.y, r * 1.6, s.side === 'enemy' ? '#ffb070' : '#9ae0ff');
    if (s.side === 'player') {
      const list = grid.query(s.x, s.y, r, near);
      for (let i = 0; i < list.length; ++i) {
        const e = list[i];
        const d = Math.sqrt((e.x - s.x) * (e.x - s.x) + (e.y - s.y) * (e.y - s.y));
        if (e.alive && d < r + e.r) hitTarget(e, s.dmg * (1 - 0.5 * d / (r + e.r)), 'player', s.from);
      }
      if (s.target && s.target.cx !== undefined && s.target.rogue) hitTarget(s.target, s.dmg, 'player');
    } else {
      const b = G.base;
      if (b) for (let i = 0; i < b.data.buildings.length; ++i) {
        const o = b.data.buildings[i];
        const d = Math.sqrt((o.x - s.x) * (o.x - s.x) + (o.y - s.y) * (o.y - s.y));
        if (o.alive && !o.rogue && d < r + o.r) NS.base.damage(o, s.dmg * (1 - 0.5 * d / (r + o.r)), 'blast');
      }
      const list = NS.units.queryPlayer(s.x, s.y, r);
      for (let i = 0; i < list.length; ++i) {
        const u = list[i];
        if (u.alive && (u.x - s.x) * (u.x - s.x) + (u.y - s.y) * (u.y - s.y) < (r + u.r) * (r + u.r)) NS.units.damage(u, s.dmg * 0.6);
      }
      const sh = G.ship;
      if (sh && sh.alive && (sh.x - s.x) * (sh.x - s.x) + (sh.y - s.y) * (sh.y - s.y) < r * r) NS.ship.hurt(s.dmg * 0.4, 'blast');
    }
  }

  /* a direct hit of a travelling shot against the other side */
  function collide(s) {
    if (s.side === 'player') {
      const list = grid.query(s.x, s.y, 40, near);
      for (let i = 0; i < list.length; ++i) {
        const e = list[i];
        if (!e.alive || e.dormant) continue;
        if ((e.x - s.x) * (e.x - s.x) + (e.y - s.y) * (e.y - s.y) < (e.r + 3) * (e.r + 3)) return e;
      }
      const t = s.target;
      if (t && t.cx !== undefined && t.rogue && (t.x - s.x) * (t.x - s.x) + (t.y - s.y) * (t.y - s.y) < t.r * t.r) return t;
      return null;
    }
    const list = NS.units.queryPlayer(s.x, s.y, 30);
    for (let i = 0; i < list.length; ++i) {
      const u = list[i];
      if (u.alive && (u.x - s.x) * (u.x - s.x) + (u.y - s.y) * (u.y - s.y) < (u.r + 3) * (u.r + 3)) return u;
    }
    const sh = G.ship;
    if (sh && sh.alive && !sh.hidden && (sh.x - s.x) * (sh.x - s.x) + (sh.y - s.y) * (sh.y - s.y) < sh.r * sh.r) return sh;
    const o = NS.base.buildingAt(s.x, s.y);
    if (o && !o.rogue && (o.x - s.x) * (o.x - s.x) + (o.y - s.y) * (o.y - s.y) < o.r * o.r * 1.2) return o;
    return null;
  }

  function updateShots(dt) {
    for (let i = 0; i < G.shots.length; ++i) {
      const s = G.shots[i];
      if (s.delay > 0) { s.delay -= dt; continue; }
      s.t += dt;
      s.life -= dt;
      if (s.kind === 'missile' && s.target && s.target.alive) {
        const want = Math.atan2(s.target.y - s.y, s.target.x - s.x);
        s.angle += clamp(angleDiff(s.angle, want), -s.turn * dt, s.turn * dt);
        s.vx = Math.cos(s.angle) * s.speed;
        s.vy = Math.sin(s.angle) * s.speed;
        s.trailT -= dt;
        if (s.trailT <= 0) {
          s.trailT = 1 / 30;
          NS.fx.exhaust(s.x, s.y, -s.vx * 0.2, -s.vy * 0.2, 4, s.side === 'enemy' ? '#ff8a5a' : '#ffd0a0', null);
        }
      }
      if (s.kind === 'artillery' || s.kind === 'flak' || s.kind === 'bomb') {
        const k = Math.min(1, s.t / s.flight);
        s.x = s.x0 + (s.tx - s.x0) * k;
        s.y = s.y0 + (s.ty - s.y0) * k;
        if (s.kind === 'flak' && s.side === 'player' && s.t > 0.1) {
          const list = grid.query(s.x, s.y, 26, near);
          for (let k2 = 0; k2 < list.length; ++k2) if (list[k2].alive && !list[k2].dormant) { s.life = 0; break; }
        }
        if (s.life <= 0 || k >= 1) {
          s.alive = false;
          burst(s);
        }
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0 || s.x < -100 || s.y < -100 || s.x > G.world.w + 100 || s.y > G.world.h + 100) { s.alive = false; continue; }
      const hit = collide(s);
      if (hit) {
        s.alive = false;
        NS.fx.hitSpark(s.x, s.y, s.angle + Math.PI, s.side === 'enemy' ? (s.corrupt ? '#3affd0' : '#ff8a5a') : '#9ae0ff');
        if (s.splash) burst(s);
        else hitTarget(hit, s.dmg, s.side, s.from);
        if (s.corrupt && hit.side === 'player') NS.units.corrupt(hit, s.corrupt);
      }
    }
    compact(G.shots, (s) => shotPool.put(s));
  }

  /* ── behaviour ── */
  function steer(e, tx, ty, speed, dt, stop) {
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const want = Math.min(speed, Math.max(0, d - (stop || 0)) * 2.2);
    const k = Math.min(1, dt * (e.r > 40 ? 0.8 : 2.6));
    e.vx += (dx / d * want - e.vx) * k;
    e.vy += (dy / d * want - e.vy) * k;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    return d;
  }

  function face(e, a, dt) {
    const turn = clamp(angleDiff(e.angle, a), -(e.r > 40 ? 1.2 : 6) * dt, (e.r > 40 ? 1.2 : 6) * dt);
    e.bank = clamp(turn / Math.max(dt, 1e-4) / 6, -1, 1);
    e.angle += turn;
  }

  /* who an invader goes for: per its taste, refreshed a few times a second. Raiders of a wave
     come for the outpost: they only turn on ships and units near it or right next to them */
  function pickTarget(e) {
    const d = e.def;
    if (d.target === 'units' || d.target === 'any') {
      const u = NS.units.nearestPlayer(e.x, e.y, d.target === 'units' ? 700 : 520, true);
      if (u && (!e.wave || nearOutpost(u, 900) || (u.x - e.x) * (u.x - e.x) + (u.y - e.y) * (u.y - e.y) < 320 * 320)) return u;
    }
    return nearestBuilding(e.x, e.y, e.type === 'bomber') || (G.ship && G.ship.alive ? G.ship : null);
  }

  function nearOutpost(t, r) {
    const h = NS.base.hub();
    return !!h && (t.x - h.x) * (t.x - h.x) + (t.y - h.y) * (t.y - h.y) < r * r;
  }

  /* what is left of a wave that drags on breaks off and flies away */
  function retreat(wave, x, y) {
    let n = 0;
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || e.wave !== wave) continue;
      e.wave = 0;
      e.migrate = { x: x, y: y };
      e.target = null;
      ++n;
    }
    return n;
  }

  function update(dt) {
    rebuild();
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.shieldHit > 0) e.shieldHit -= dt;
      if (e.maxShield > 0) {
        e.shieldT -= dt;
        if (e.shieldT <= 0) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.08 * dt);
      }
      if (e.stun > 0) {
        e.stun -= dt;
        e.vx *= 0.95;
        e.vy *= 0.95;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        continue;
      }
      think(e, dt);
      e.x = clamp(e.x, -200, G.world.w + 200);
      e.y = clamp(e.y, -200, G.world.h + 200);
      exhaust(e, dt);
    }
    compact(G.enemies);
    updateShots(dt);
  }

  function think(e, dt) {
    const d = e.def;
    if (e.type === 'hive') { hive(e, dt); return; }
    if (e.migrate) {
      const t = NS.units.nearestPlayer(e.x, e.y, 240, true);
      if (t) { bite(e, t, dt); return; }
      if (steer(e, e.migrate.x, e.migrate.y, e.speed * 0.6, dt, 0) < 80) e.alive = false;
      face(e, Math.atan2(e.vy, e.vx), dt);
      return;
    }
    e.retarget -= dt;
    if (!e.target || !e.target.alive || e.retarget <= 0) {
      e.retarget = 0.4 + R() * 0.3;
      e.target = e.guard ? NS.units.nearestPlayer(e.x, e.y, 460, true) : pickTarget(e);
      if (e.target && e.guard && (e.target.x - e.guard.x) * (e.target.x - e.guard.x) + (e.target.y - e.guard.y) * (e.target.y - e.guard.y) > 650 * 650) e.target = null;
    }
    if (e.guard && !e.target) {
      e.wob += dt * 0.6;
      steer(e, e.guard.x + Math.cos(e.wob) * 170, e.guard.y + Math.sin(e.wob) * 170, e.speed * 0.4, dt, 0);
      face(e, Math.atan2(e.vy, e.vx), dt);
      return;
    }
    const t = e.target;
    if (!t) {
      steer(e, G.world.w / 2, G.world.h / 2, e.speed * 0.5, dt, 300);
      return;
    }
    const dx = t.x - e.x, dy = t.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const a = Math.atan2(dy, dx);
    switch (e.type) {
      case 'swarmer': bite(e, t, dt); break;
      case 'nanoswarm': {
        steer(e, t.x, t.y, e.speed, dt, 0);
        face(e, a, dt);
        if (dist < e.r + (t.r || 10) + 4) {
          if (t.cx !== undefined) {
            if (NS.outbreak.inject(t, d.corrupt * (1 - (G.stats.firewall || 0)))) NS.events.rogue(t);
            NS.events.corrupted(t);
          } else if (t.side) NS.units.corrupt(t, 0.35);
          else NS.ship.hurt(8, 'bolt');
          e.alive = false;
          NS.fx.explode(e.x, e.y, 14, NS.fx.TOXIC, { noDebris: true });
          NS.fx.ring(t.x, t.y, 10, (t.r || 20) * 2.4, 0.5, '#3affd0', 3);
          NS.audio.sfxAt('zap', e.x, e.y, { volume: 0.4, pitch: 1.8 });
        }
        break;
      }
      case 'bomber': {
        /* dive across the target, bombs away, swing round */
        const over = dist < t.r + 30;
        const ax = t.x + Math.cos(e.wob) * 260, ay = t.y + Math.sin(e.wob) * 260;
        if (e.bombed > 0) { e.bombed -= dt; steer(e, ax, ay, e.speed, dt, 0); }
        else steer(e, t.x, t.y, e.speed, dt, 0);
        face(e, Math.atan2(e.vy, e.vx), dt);
        e.fireT -= dt;
        if (over && e.fireT <= 0) {
          e.fireT = d.rof;
          e.bombed = 2.4;
          e.wob = a + (R() - 0.5) * 1.2;
          fire('enemy', 'bomb', e.x, e.y, t, d.dmg, 160, { splash: 60 });
          NS.audio.sfxAt('drop', e.x, e.y, { volume: 0.5 });
        }
        break;
      }
      case 'carrier': {
        const keep = 600;
        steer(e, t.x - Math.cos(a) * keep, t.y - Math.sin(a) * keep, e.speed, dt, 0);
        face(e, a, dt);
        e.spawnT -= dt;
        if (e.spawnT <= 0 && e.children < 12) {
          e.spawnT = d.rof;
          for (let k = 0; k < 3; ++k) {
            const c = spawn('swarmer', e.x + Math.cos(e.angle + 2) * e.r, e.y + Math.sin(e.angle + 2) * e.r, { wave: e.wave, parent: e });
            c.vx = Math.cos(e.angle + 2 + k * 0.4) * 200;
            c.vy = Math.sin(e.angle + 2 + k * 0.4) * 200;
            ++e.children;
          }
          NS.fx.ring(e.x, e.y, e.r * 0.5, e.r * 1.6, 0.4, d.color, 3);
        }
        break;
      }
      case 'mothership': mothership(e, t, dt, dist, a); break;
      default: {
        /* raiders orbit, frigates and siege ships stand off, Lattice drones dart */
        const keep = e.type === 'siege' ? d.range * 0.88 : e.type === 'frigate' ? 300 : e.type === 'raider' ? 220 : 170;
        const side = e.id % 2 ? 1 : -1;
        const orbit = e.type === 'raider' || e.type === 'nanodrone' ? 0.8 * side : 0.15 * side;
        steer(e, t.x - Math.cos(a + orbit) * keep, t.y - Math.sin(a + orbit) * keep, e.speed, dt, 0);
        face(e, a, dt);
        e.fireT -= dt;
        if (e.fireT <= 0 && dist < d.range + (t.r || 0)) {
          e.fireT = d.rof * (0.85 + R() * 0.3);
          const mx = e.x + Math.cos(a) * e.r, my = e.y + Math.sin(a) * e.r;
          if (e.type === 'siege') {
            fire('enemy', 'artillery', mx, my, t, d.dmg, 340, { splash: 70 });
            NS.audio.sfxAt('explode', e.x, e.y, { volume: 0.25, pitch: 1.8 });
          } else if (e.type === 'frigate') fire('enemy', 'shell', mx, my, t, d.dmg, 560);
          else fire('enemy', e.type === 'nanodrone' ? 'nanobolt' : 'bolt', mx, my, t, d.dmg, 640, { corrupt: d.corrupt || 0 });
          NS.fx.muzzle(mx, my, a, d.color);
        }
      }
    }
  }

  function bite(e, t, dt) {
    const a = Math.atan2(t.y - e.y, t.x - e.x);
    e.wob += dt * 7;
    const w = Math.sin(e.wob) * 40;
    steer(e, t.x - Math.sin(a) * w, t.y + Math.cos(a) * w, e.speed, dt, 0);
    face(e, a, dt);
    e.fireT -= dt;
    const reach = e.r + (t.r || 10) + e.def.range;
    if (e.fireT <= 0 && (t.x - e.x) * (t.x - e.x) + (t.y - e.y) * (t.y - e.y) < reach * reach) {
      e.fireT = e.def.rof;
      hitTarget(t, e.def.dmg, 'enemy', e);
      NS.fx.sparks(t.x, t.y, a + Math.PI, 1.2, 4, '#e0a0ff', 200, 0.25);
      /* Bloom swarmers carry spores into what they bite */
      if (t.cx !== undefined && G.run.zone.life > 0 && R() < 0.12 * G.run.zone.life * (1 - (G.stats.vaccine || 0))) {
        const fresh = !(t.inf > 0);
        NS.outbreak.seedInfection(t, 0.06);
        if (fresh) NS.events.infected(t);
      }
    }
  }

  function hive(e, dt) {
    e.wob += dt;
    if (e.dormant) {
      const s = G.ship;
      if (s && s.alive && (s.x - e.x) * (s.x - e.x) + (s.y - e.y) * (s.y - e.y) < 230 * 230) wake(e);
      return;
    }
    e.spawnT -= dt;
    if (e.spawnT <= 0 && e.children < 8) {
      e.spawnT = e.def.rof;
      for (let k = 0; k < 2; ++k) {
        const a = R() * TAU;
        const c = spawn('swarmer', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, { parent: e });
        c.vx = Math.cos(a) * 160;
        c.vy = Math.sin(a) * 160;
        ++e.children;
      }
      NS.fx.ring(e.x, e.y, e.r * 0.6, e.r * 1.5, 0.5, '#ff8ae0', 3);
    }
  }

  /* the hive mothership: slow approach, broadside guns, broods, rage at half health */
  function mothership(e, t, dt, dist, a) {
    const h = NS.base.hub() || t;
    const ha = Math.atan2(h.y - e.y, h.x - e.x);
    steer(e, h.x - Math.cos(ha) * 460, h.y - Math.sin(ha) * 460, e.speed, dt, 0);
    face(e, ha, dt);
    const rage = e.hp < e.maxHp * 0.5;
    e.fireT -= dt * (rage ? 1.5 : 1);
    if (e.fireT <= 0) {
      e.fireT = e.def.rof;
      e.gun = (e.gun + 1) % 3;
      const ga = e.angle + (e.gun - 1) * 1.2;
      const gx = e.x + Math.cos(ga) * e.r * 0.7, gy = e.y + Math.sin(ga) * e.r * 0.7;
      const tt = NS.units.nearestPlayer(gx, gy, e.def.range, true) || nearestBuilding(gx, gy, false);
      if (tt) {
        fire('enemy', 'shell', gx, gy, tt, e.def.dmg, 520);
        NS.fx.muzzle(gx, gy, Math.atan2(tt.y - gy, tt.x - gx), '#e080ff');
      }
    }
    e.spawnT -= dt * (rage ? 1.6 : 1);
    if (e.spawnT <= 0 && e.children < 16) {
      e.spawnT = 7;
      for (let k = 0; k < 4; ++k) {
        const sa = e.angle + Math.PI + (k - 1.5) * 0.5;
        const c = spawn('swarmer', e.x + Math.cos(sa) * e.r, e.y + Math.sin(sa) * e.r, { wave: e.wave, parent: e });
        c.vx = Math.cos(sa) * 220;
        c.vy = Math.sin(sa) * 220;
        ++e.children;
      }
      NS.fx.ring(e.x, e.y, e.r * 0.6, e.r * 1.4, 0.5, '#d050ff', 4);
    }
  }

  function exhaust(e, dt) {
    if (e.type === 'hive' || e.speed <= 0) return;
    e.exT -= dt;
    if (e.exT > 0) return;
    e.exT = e.r > 30 ? 1 / 20 : 1 / 10;
    const r = NS.world.rect;
    if (e.x < r.x0 - 80 || e.x > r.x1 + 80 || e.y < r.y0 - 80 || e.y > r.y1 + 80) return;
    if (e.vx * e.vx + e.vy * e.vy < 900) return;
    NS.fx.exhaust(e.x - Math.cos(e.angle) * e.r, e.y - Math.sin(e.angle) * e.r, -e.vx * 0.3, -e.vy * 0.3, e.r * 0.4, e.def.color, null);
  }

  /* the hub's pulse: nanoprobes fry, everything else is stunned */
  function emp(x, y, r) {
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) > r * r) continue;
      if (e.def.faction === 'lattice') die(e, null);
      else e.stun = 3;
    }
  }

  function clear() {
    G.enemies.length = 0;
    for (let i = 0; i < G.shots.length; ++i) shotPool.put(G.shots[i]);
    G.shots.length = 0;
  }

  function count(filter) {
    let n = 0;
    for (let i = 0; i < G.enemies.length; ++i) if (G.enemies[i].alive && (!filter || filter(G.enemies[i]))) ++n;
    return n;
  }

  Object.assign(NS.enemies, {
    spawn, nearest, queryHostile, nearestBuilding, hitTarget, damage, wake, fire, update, emp, clear, count, retreat
  });
})();
