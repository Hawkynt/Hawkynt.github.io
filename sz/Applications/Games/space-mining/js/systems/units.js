/* Units in the field: spawning from factories and the saved roster, veterancy ranks, steering
   with arrival and separation (kept to the group's speed while in formation), following their
   order queue, auto-engaging invaders, the jobs of the support craft (mining drones drill and
   haul ore to the hub, repair drones mend, purge tenders sterilise and purge, transports haul
   stock to the home dock), nanoprobe corruption that makes a unit desert, and rogue units
   hunting your fleet. Owns G.units and the player-unit grid. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU } = C;
  const { UNIT_BY_ID, VET_KILLS } = NS.fleetData;
  const { ORE_BY_ID } = NS.ores;
  const { createGrid, compact } = NS.grid;
  const { angleDiff, clamp } = NS.rng;
  const O = NS.orders;
  const R = NS.rng.fx;

  const grid = createGrid(C.WORLD_W, C.WORLD_H, 160);
  const near = [];
  const near2 = [];
  const rocksNear = [];
  const pt = { x: 0, y: 0 };
  let nextId = 1;

  function spawn(type, x, y, side) {
    const def = UNIT_BY_ID[type];
    const st = G.stats;
    const u = {
      alive: true, id: nextId++, type: type, def: def, side: side || 'player', x: x, y: y, vx: 0, vy: 0, angle: -Math.PI / 2, r: def.r,
      speed: def.speed * st.unitSpeed, hp: 0, maxHp: 0, dmg: 0, range: def.range, fireT: R() * 0.5, kills: 0, rank: 0, orders: [],
      target: null, retarget: 0, load: 0, ore: null, cargo: null, job: 'idle', cor: 0, flash: 0, exT: R() * 0.1, bank: 0, beam: null,
      rock: null, waitT: 0,
    };
    rank(u, true);
    u.hp = u.maxHp;
    G.units.push(u);
    if (type === 'escort' && G.ship && side !== 'rogue') O.issue([u], 'escort', { target: G.ship, formation: 'wedge' });
    if (G.run && G.run.mode === 'career' && u.side === 'player') {
      let n = 0;
      for (let i = 0; i < G.units.length; ++i) if (G.units[i].alive && G.units[i].side === 'player') ++n;
      NS.rules.record(G.save, 'maxFleet', n);
    }
    return u;
  }

  /* rank from kills: +15% damage and hit points per rank */
  function rank(u, fresh) {
    let r = 0;
    for (let i = 1; i < VET_KILLS.length; ++i) if (u.kills >= VET_KILLS[i]) r = i;
    const up = r > u.rank;
    u.rank = r;
    const k = 1 + 0.15 * r;
    const frac = u.maxHp ? u.hp / u.maxHp : 1;
    u.maxHp = u.def.hp * G.stats.unitHp * k;
    u.hp = fresh ? u.maxHp : Math.min(u.maxHp, u.maxHp * frac + (up ? u.maxHp * 0.2 : 0));
    u.dmg = u.def.dmg * G.stats.unitDmg * k;
    if (up && !fresh) {
      NS.fx.text(u.x, u.y - 24, ['', 'VETERAN', 'ELITE', 'ACE'][r], '#ffd25a', 14, 1.4);
      NS.fx.ring(u.x, u.y, u.r, u.r * 3, 0.5, '#ffd25a', 3);
    }
  }

  function credit(u) {
    if (!u || !u.alive || u.side !== 'player') return;
    ++u.kills;
    rank(u);
  }

  /* ── queries ── */
  function rebuild() {
    grid.reset(G.world.w, G.world.h);
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (u.alive && u.side === 'player') grid.insert(u);
    }
  }

  /* nearest player unit (or the ship) to a point within range */
  function nearestPlayer(x, y, range, withShip) {
    const list = grid.query(x, y, range, near);
    let best = null, bd = range * range;
    for (let i = 0; i < list.length; ++i) {
      const u = list[i];
      if (!u.alive) continue;
      const d = (u.x - x) * (u.x - x) + (u.y - y) * (u.y - y);
      if (d < bd) { bd = d; best = u; }
    }
    const s = G.ship;
    if (withShip !== false && s && s.alive && !s.hidden && (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < bd) best = s;
    return best;
  }

  /* what a rogue turret shoots at */
  function nearestHostileToBase(x, y, range) {
    return nearestPlayer(x, y, range, true);
  }

  function queryPlayer(x, y, r) {
    return grid.query(x, y, r, near2);
  }

  function healNear(x, y, rad, amount, max) {
    let n = 0;
    const list = grid.query(x, y, rad, near);
    for (let i = 0; i < list.length && n < max; ++i) {
      const u = list[i];
      if (!u.alive || u.hp >= u.maxHp) continue;
      if ((u.x - x) * (u.x - x) + (u.y - y) * (u.y - y) > rad * rad) continue;
      u.hp = Math.min(u.maxHp, u.hp + amount);
      ++n;
    }
    return n;
  }

  /* ── damage, corruption ── */
  function damage(u, amount, by) {
    if (!u.alive || amount <= 0) return;
    u.hp -= amount;
    u.flash = 0.1;
    if (u.hp > 0) return;
    u.alive = false;
    NS.fx.explode(u.x, u.y, u.r * 1.4, u.side === 'rogue' ? NS.fx.TOXIC : NS.fx.FIRE, { debrisColor: '#6a7a8a' });
    NS.audio.sfxAt('explode', u.x, u.y, { volume: 0.5, pitch: 1.2 });
    if (u.side === 'rogue') {
      credit(by);
      NS.mining.spawnNugget(u.x, u.y, 'scrap', 2, null, 120);
    }
  }

  function corrupt(u, amount) {
    if (!u.alive || u.side !== 'player') return;
    u.cor = Math.min(1, u.cor + amount * (1 - (G.stats.firewall || 0)));
    if (u.cor < 1) return;
    u.side = 'rogue';
    u.orders = [];
    u.target = null;
    u.sel = false;
    NS.fx.ring(u.x, u.y, u.r, u.r * 4, 0.6, '#3affd0', 3);
    NS.fx.text(u.x, u.y - 30, 'UNIT DESERTED', '#3affd0', 16, 1.6);
    NS.audio.sfx('zap', { volume: 0.5, pitch: 0.5 });
    NS.events.deserted(u);
  }

  /* ── movement ── */
  function steer(u, tx, ty, speed, dt, stop) {
    const dx = tx - u.x, dy = ty - u.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const want = Math.min(speed, Math.max(0, d - (stop || 0)) * 2.6);
    let ax = dx / d * want, ay = dy / d * want;
    /* separation from close friends */
    const list = grid.query(u.x, u.y, u.r * 2.4, near);
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (o === u) continue;
      const ox = u.x - o.x, oy = u.y - o.y;
      const od = Math.sqrt(ox * ox + oy * oy) || 1;
      const clear = u.r + o.r + 6;
      if (od < clear) { ax += ox / od * 90 * (1 - od / clear); ay += oy / od * 90 * (1 - od / clear); }
    }
    /* steer round big rocks (miners at work may touch theirs) */
    const rocks = NS.asteroids.queryRocks(u.x, u.y, u.r + 70, rocksNear);
    for (let i = 0; i < rocks.length; ++i) {
      const o = rocks[i];
      if (!o.alive || o.tier < 2 || o === u.rock) continue;
      const ox = u.x - o.x, oy = u.y - o.y;
      const od = Math.sqrt(ox * ox + oy * oy) || 1;
      const clear = o.r + u.r + 14;
      if (od < clear) {
        ax += ox / od * speed * 1.6 * (1 - od / clear);
        ay += oy / od * speed * 1.6 * (1 - od / clear);
      }
    }
    const k = Math.min(1, dt * 3.4);
    u.vx += (ax - u.vx) * k;
    u.vy += (ay - u.vy) * k;
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    return d;
  }

  function face(u, a, dt) {
    const turn = clamp(angleDiff(u.angle, a), -7 * dt, 7 * dt);
    u.bank = clamp(turn / Math.max(dt, 1e-4) / 7, -1, 1);
    u.angle += turn;
  }

  /* ── combat ── */
  function acquire(u, reach) {
    u.retarget -= 1;
    if (u.target && u.target.alive && u.retarget > 0) return u.target;
    u.retarget = 12;
    u.target = u.side === 'rogue' ? nearestPlayer(u.x, u.y, reach, true) : NS.enemies.nearest(u.x, u.y, reach, u.type === 'fighter' ? 'small' : u.type === 'gunboat' ? 'big' : 'any');
    return u.target;
  }

  function shoot(u, t, dt) {
    u.fireT -= dt;
    if (u.fireT > 0) return;
    u.fireT = u.def.rof * (0.9 + R() * 0.2);
    const side = u.side === 'rogue' ? 'enemy' : 'player';
    const a = Math.atan2(t.y - u.y, t.x - u.x);
    const mx = u.x + Math.cos(a) * u.r, my = u.y + Math.sin(a) * u.r;
    if (u.type === 'gunboat') {
      NS.enemies.fire(side, 'shell', mx, my, t, u.dmg, 640, { from: u });
      NS.audio.sfxAt('shoot', u.x, u.y, { volume: 0.25, pitch: 0.7 });
    } else if (u.type === 'escort') {
      NS.enemies.hitTarget(t, u.dmg, side, u);
      G.tbeams.push({ x0: mx, y0: my, x1: t.x, y1: t.y, t: 0.06, color: side === 'enemy' ? '#3affd0' : '#9ac4ff' });
    } else {
      NS.enemies.fire(side, 'bolt', mx, my, t, u.dmg, 900, { from: u });
      NS.audio.sfxAt('shoot', u.x, u.y, { volume: 0.15, pitch: 1.5 });
    }
    NS.fx.muzzle(mx, my, a, side === 'enemy' ? '#3affd0' : '#9ae0ff');
  }

  /* go for target t and fire from range; returns false when it has none */
  function engage(u, t, dt) {
    if (!t) return false;
    const a = Math.atan2(t.y - u.y, t.x - u.x);
    const keep = u.range * 0.78;
    const d = Math.sqrt((t.x - u.x) * (t.x - u.x) + (t.y - u.y) * (t.y - u.y));
    if (u.type === 'fighter') {
      /* fighters strafe: orbit the target at range */
      const side = (u.id % 2 ? 1 : -1);
      steer(u, t.x - Math.cos(a + side * 0.9) * keep, t.y - Math.sin(a + side * 0.9) * keep, u.speed, dt, 0);
    } else steer(u, t.x - Math.cos(a) * keep, t.y - Math.sin(a) * keep, u.speed, dt, 0);
    face(u, a, dt);
    if (d < u.range + (t.r || 0)) shoot(u, t, dt);
    return true;
  }

  /* ── per step ── */
  function update(dt) {
    rebuild();
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (!u.alive) continue;
      if (u.flash > 0) u.flash -= dt;
      u.beam = null;
      if (u.side === 'rogue') rogueAI(u, dt);
      else think(u, dt);
      if (u.vx * u.vx + u.vy * u.vy > 900 && !u.beam && !(u.target && u.target.alive && u.def.rof)) face(u, Math.atan2(u.vy, u.vx), dt);
      exhaust(u, dt);
    }
    compact(G.units);
  }

  function think(u, dt) {
    const o = O.current(u);
    const def = u.def;
    if (o) u.post = null;
    else if (!u.post) u.post = { x: u.x, y: u.y };
    if (def.dmg > 0) {
      const busy = o && (o.kind === 'move' || o.kind === 'return');
      if (o && o.kind === 'attack') { engage(u, o.target, dt); return; }
      if (!busy) {
        let reach = def.aggro || 400;
        if (o && o.kind === 'escort') {
          O.point(u, o, pt);
          if ((u.x - pt.x) * (u.x - pt.x) + (u.y - pt.y) * (u.y - pt.y) > 420 * 420) reach = 0;
        }
        const t = reach ? acquire(u, reach) : null;
        /* idle units guard their post: they fight what comes near it, then go back */
        const near = !u.post || (t && (t.x - u.post.x) * (t.x - u.post.x) + (t.y - u.post.y) * (t.y - u.post.y) < reach * reach);
        if (t && near && (!o || o.kind !== 'escort' || Math.abs(t.x - o.target.x) + Math.abs(t.y - o.target.y) < 700)) {
          engage(u, t, dt);
          return;
        }
        if (!o && u.post && def.dmg > 0) {
          if ((u.x - u.post.x) * (u.x - u.post.x) + (u.y - u.post.y) * (u.y - u.post.y) > 400) steer(u, u.post.x, u.post.y, u.speed, dt, 0);
          else drift(u, dt);
          return;
        }
      }
    }
    if (o) {
      if (o.kind === 'mine' && def.haul && u.type === 'miner') { mine(u, dt, o.x, o.y); return; }
      if (o.kind === 'repair' || o.kind === 'purge') { support(u, o.target, dt); return; }
      O.point(u, o, pt);
      const d = Math.sqrt((u.x - pt.x) * (u.x - pt.x) + (u.y - pt.y) * (u.y - pt.y));
      const sp = d > 70 && o.speed ? Math.min(u.speed, o.speed) : u.speed;
      steer(u, pt.x, pt.y, o.kind === 'escort' ? Math.max(sp, d > 160 ? u.speed * 1.3 : sp) : sp, dt, 0);
      if (d < 20 && o.facing !== undefined) face(u, o.facing, dt);
      if (o.kind === 'escort' && d < 30) face(u, o.target.angle || 0, dt);
      /* a slot inside a rock or a crowd: close enough counts as there */
      if ((o.kind === 'move' || o.kind === 'amove' || o.kind === 'return') && d < 150 && u.vx * u.vx + u.vy * u.vy < 900) {
        u.stuck = (u.stuck || 0) + dt;
        if (u.stuck > 1.2) { u.orders.shift(); u.stuck = 0; }
      } else u.stuck = 0;
      return;
    }
    idleJob(u, dt);
  }

  /* what a unit with no order does on its own */
  function idleJob(u, dt) {
    const h = NS.base.hub();
    switch (u.type) {
      case 'miner': if (h) mine(u, dt, h.x, h.y); else drift(u, dt); break;
      case 'mender': { const t = findRepair(u); if (t) support(u, t, dt); else drift(u, dt); break; }
      case 'purger': { const t = findPurge(u); if (t) support(u, t, dt); else drift(u, dt); break; }
      case 'transport': haul(u, dt); break;
      default: drift(u, dt);
    }
  }

  function drift(u, dt) {
    const k = Math.max(0, 1 - dt * 2);
    u.vx *= k;
    u.vy *= k;
    u.x += u.vx * dt;
    u.y += u.vy * dt;
  }

  /* mining drones: drill rocks near an anchor, sweep nuggets, haul them to the hub */
  function mine(u, dt, ax, ay) {
    const h = NS.base.hub();
    if (u.load >= u.def.haul || (u.job === 'haul' && u.load > 0)) {
      u.job = 'haul';
      if (!h) { drift(u, dt); return; }
      if (steer(u, h.x, h.y, u.speed, dt, 0) < h.r + 10) {
        const b = G.base;
        const cap = C2().storageCap(b.data, G.stats);
        if (C2().stockCount(b.data.stock) < cap) {
          b.data.stock.ore[u.ore] = (b.data.stock.ore[u.ore] || 0) + u.load;
          NS.base.pod(u.x, u.y, h.x, h.y, ORE_BY_ID[u.ore].color, 0);
        }
        u.load = 0;
        u.ore = null;
        u.job = 'idle';
        u.rock = null;
      }
      return;
    }
    if (!u.rock || !u.rock.alive) {
      /* a half-full basket goes home rather than starting on another ore */
      if (u.rock && u.load >= u.def.haul / 2) {
        u.rock = null;
        u.job = 'haul';
        return;
      }
      u.waitT -= dt;
      if (u.waitT > 0) { drift(u, dt); return; }
      u.waitT = 0.6;
      u.rock = pickRock(u, ax, ay);
      if (!u.rock) { if (u.load > 0) u.job = 'haul'; drift(u, dt); return; }
    }
    const o = u.rock;
    const a = Math.atan2(u.y - o.y, u.x - o.x) + dt * 0.3;
    const d = steer(u, o.x + Math.cos(a) * (o.r + 30), o.y + Math.sin(a) * (o.r + 30), u.speed, dt, 0);
    face(u, a + Math.PI, dt);
    if (d < 60) {
      const hx = o.x + Math.cos(a) * o.r * 0.85, hy = o.y + Math.sin(a) * o.r * 0.85;
      u.beam = { x1: hx, y1: hy, color: '#5cff9a' };
      NS.asteroids.damage(o, 14 * G.stats.unitDmg * dt * (1 + u.rank * 0.15), hx, hy, 'drone');
      if (R() < dt * 8) NS.fx.sparks(hx, hy, a, 1.6, 1, '#b4ffc8', 160, 0.25);
    }
    /* sweep nuggets into the basket */
    for (let i = 0; i < G.nuggets.length && u.load < u.def.haul; ++i) {
      const n = G.nuggets[i];
      if (!n.alive || n.credits || (u.ore && n.ore !== u.ore)) continue;
      if ((n.x - u.x) * (n.x - u.x) + (n.y - u.y) * (n.y - u.y) > 80 * 80) continue;
      n.alive = false;
      u.ore = n.ore;
      u.load += n.units;
    }
  }

  function pickRock(u, ax, ay) {
    const list = NS.asteroids.queryRocks(ax, ay, 900, near2);
    let best = null, bs = -Infinity;
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (!o.alive || !o.ore || o.kind !== 'rock' || o.volatile || o.bio) continue;
      let taken = false;
      for (let k = 0; k < G.units.length; ++k) if (G.units[k] !== u && G.units[k].rock === o) { taken = true; break; }
      if (taken) continue;
      const d = Math.sqrt((o.x - u.x) * (o.x - u.x) + (o.y - u.y) * (o.y - u.y));
      const s = ORE_BY_ID[o.ore].value * 0.6 - d * 0.05 - o.tier * 8 + (u.ore && o.ore === u.ore ? 40 : 0);
      if (s > bs) { bs = s; best = o; }
    }
    return best;
  }

  function C2() {
    return NS.colony;
  }

  function findRepair(u) {
    const b = G.base;
    let best = null, bd = 900 * 900;
    if (b) for (let i = 0; i < b.data.buildings.length; ++i) {
      const o = b.data.buildings[i];
      if (o.hp >= o.maxHp || o.prog < 1 || o.rogue) continue;
      const d = (o.x - u.x) * (o.x - u.x) + (o.y - u.y) * (o.y - u.y);
      if (d < bd) { bd = d; best = o; }
    }
    for (let i = 0; i < G.units.length; ++i) {
      const o = G.units[i];
      if (o === u || !o.alive || o.side !== 'player' || o.hp >= o.maxHp) continue;
      const d = (o.x - u.x) * (o.x - u.x) + (o.y - u.y) * (o.y - u.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  function findPurge(u) {
    const b = G.base;
    let best = null, bs = 0;
    if (b) for (let i = 0; i < b.data.buildings.length; ++i) {
      const o = b.data.buildings[i];
      const s = (o.rogue ? 2 : 0) + (o.cor || 0) * 1.5 + (o.inf || 0);
      if (s > bs) { bs = s; best = o; }
    }
    for (let i = 0; i < G.units.length; ++i) {
      const o = G.units[i];
      if (o.alive && o.side === 'player' && o.cor > 0.1 && o.cor * 1.2 > bs) { bs = o.cor * 1.2; best = o; }
    }
    return bs > 0.02 ? best : null;
  }

  /* menders and purgers working on a building or unit */
  function support(u, t, dt) {
    const d = steer(u, t.x, t.y, u.speed, dt, (t.r || 20) + 60);
    face(u, Math.atan2(t.y - u.y, t.x - u.x), dt);
    if (d > (t.r || 20) + u.def.range) return;
    const k = 1 + u.rank * 0.15;
    if (u.type === 'mender') {
      if (t.hp < t.maxHp) {
        t.hp = Math.min(t.maxHp, t.hp + u.def.heal * G.stats.repairMul * k * dt * (t.cx !== undefined ? 3 : 1));
        u.beam = { x1: t.x, y1: t.y, color: '#7cff9a' };
      }
    } else {
      const p = u.def.purge * k * dt;
      u.beam = { x1: t.x, y1: t.y, color: '#c8f4ff' };
      if (t.cx !== undefined) {
        if (t.inf > 0) {
          t.inf = Math.max(0, t.inf - p);
          if (!t.inf && G.run.mode === 'career') NS.rules.bump(G.save, 'cured', Math.max(1, t._staff || 1));
        }
        if (t.rogue || t.cor > 0) {
          t.cor = Math.max(0, (t.rogue ? 1 : t.cor) - p);
          t.rogue = t.rogue && t.cor > 0.01 ? true : false;
          if (t.cor <= 0.01) NS.base.purge(t, true);
          else if (t.rogue) t._purging = 1;
        }
      } else t.cor = Math.max(0, t.cor - p);
    }
  }

  /* transports: load the best stock at the hub, fly it to the home dock, come back */
  function haul(u, dt) {
    const h = NS.base.hub();
    if (!h) { drift(u, dt); return; }
    if (u.job === 'out') {
      if (steer(u, G.dock.x, G.dock.y, u.speed, dt, 0) < 60) {
        let v = 0;
        for (let i = 0; i < u.cargo.length; ++i) {
          const it = u.cargo[i];
          v += it.n * it.v;
          if (G.run.mode === 'career') G.save.store[it.kind][it.id] = (G.save.store[it.kind][it.id] || 0) + it.n;
        }
        if (G.run.mode !== 'career') NS.base.wallet().credits += Math.round(v * 0.7);
        NS.fx.text(G.dock.x, G.dock.y - 90, 'DELIVERED  ' + NS.kit.group(v), '#ffd25a', 18, 1.6);
        NS.fx.ring(G.dock.x, G.dock.y, 40, 160, 0.5, '#ffd25a', 4);
        u.cargo = null;
        u.job = 'back';
      }
      return;
    }
    if (steer(u, h.x + 70, h.y + 70, u.speed, dt, 0) > 50) return;
    u.job = 'wait';
    u.waitT -= dt;
    if (u.waitT > 0) return;
    u.waitT = 2;
    const stock = G.base.data.stock;
    const items = C2().bestCargo(stock, u.def.haul);
    let n = 0;
    for (let i = 0; i < items.length; ++i) n += items[i].n;
    if (n < 8) return;
    C2().takeCargo(stock, items);
    u.cargo = items;
    u.job = 'out';
    NS.base.pod(h.x, h.y, u.x, u.y, '#ffd25a', 0);
  }

  /* deserters: hunt your units and ship, else head for the hub */
  function rogueAI(u, dt) {
    if (u.def.dmg <= 0) {
      const h = NS.base.hub();
      if (h) steer(u, h.x, h.y, u.speed, dt, 120);
      return;
    }
    const t = acquire(u, 700);
    if (t) engage(u, t, dt);
    else {
      const h = NS.base.hub();
      if (h) steer(u, h.x, h.y, u.speed * 0.7, dt, 300);
      else drift(u, dt);
    }
  }

  function exhaust(u, dt) {
    u.exT -= dt;
    if (u.exT > 0) return;
    u.exT = 1 / 12;
    const sp = u.vx * u.vx + u.vy * u.vy;
    if (sp < 2500) return;
    const r = NS.world.rect;
    if (u.x < r.x0 - 40 || u.x > r.x1 + 40 || u.y < r.y0 - 40 || u.y > r.y1 + 40) return;
    NS.fx.exhaust(u.x - Math.cos(u.angle) * u.r, u.y - Math.sin(u.angle) * u.r, -u.vx * 0.3, -u.vy * 0.3, u.r * 0.45,
      u.side === 'rogue' ? '#3affd0' : u.def.color, null);
  }

  function clear() {
    G.units.length = 0;
  }

  function count(side, type) {
    let n = 0;
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (u.alive && u.side === (side || 'player') && (!type || u.type === type)) ++n;
    }
    return n;
  }

  Object.assign(NS.units, {
    spawn, rank, credit, nearestPlayer, nearestHostileToBase, queryPlayer, healNear, damage, corrupt, steer, update, clear, count, TAU
  });
})();
