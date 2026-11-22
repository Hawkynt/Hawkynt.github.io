/* Syndicate bases in a trip: set out where an operation asks (far from your outpost and the
   dock, rocks cleared round them), their income, the build order worked through on rings of
   spots round the core and its relays, construction, factories filling the core's guard, attack
   groups sent at your outpost (or your ship) and counted as repelled once wiped out, haulers
   flown off the belt's edge, shield pylons, the structures' guns, spores rotting structures,
   hijacked towers, scouting, and the autosave. Owns the base list (cleared per trip). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { ENEMY_BY_ID, ABILITIES } = NS.fleetData;
  const D = NS.syndicateData;
  const S = NS.syndicate;
  const R = NS.rng.fx;
  const B = { bases: [], groups: [], repelled: 0, escaped: 0, scouted: false, nextGroup: 1, shieldT: 0 };

  function clear() {
    B.bases.length = 0;
    B.groups.length = 0;
    B.repelled = B.escaped = 0;
    B.scouted = false;
    B.nextGroup = 1;
    B.shieldT = 0;
  }

  function state() {
    return B;
  }

  /* ── setting out ── */
  /* the corners of the belt, the farthest from your outpost site and the dock first */
  function corners() {
    const W = G.world.w, H = G.world.h, m = 750;
    const site = NS.colony.site(G.run.zone.index, W, H);
    const list = [[m, m], [W - m, m], [m, H - m], [W - m, H - m]].map(p => ({ x: p[0], y: p[1] }));
    const score = p => Math.min(Math.hypot(p.x - site.cx, p.y - site.cy), Math.hypot(p.x - G.dock.x, p.y - G.dock.y) * 1.2);
    return list.sort((a, b) => score(b) - score(a));
  }

  function where(at) {
    const c = corners();
    if (at === 'far2') return c[1];
    if (at === 'mid') {
      const site = NS.colony.site(G.run.zone.index, G.world.w, G.world.h);
      return { x: (c[0].x + site.cx) / 2, y: (c[0].y + site.cy) / 2 };
    }
    return c[0];
  }

  function setup(op) {
    clear();
    const spec = op.syndicate;
    for (let i = 0; i < spec.bases.length; ++i) {
      const bs = spec.bases[i];
      const p = where(bs.at);
      clearRocks(p.x, p.y, 600);
      const base = { i: i, x: p.x, y: p.y, spec: bs, credits: bs.credits || 0, k: 0, since: 0, haulT: bs.haul ? bs.haul.first || bs.haul.every : 0,
        attackT: bs.attack ? bs.attack.first : 0, dead: false, toward: null };
      if (bs.toward === 'mid') {
        const site = NS.colony.site(G.run.zone.index, G.world.w, G.world.h);
        base.toward = { x: (p.x + site.cx) / 2, y: (p.y + site.cy) / 2 };
      }
      B.bases.push(base);
      structure(base, bs.citadel ? 'citadel' : 'syn_core', p.x, p.y, 1);
      for (const t of bs.start || []) place(base, t, 1);
      for (const t in bs.guards || {}) for (let k = 0; k < bs.guards[t]; ++k) unit(base, t, null);
    }
  }

  function clearRocks(x, y, r) {
    for (let i = 0; i < G.rocks.length; ++i) {
      const o = G.rocks[i];
      if (o.alive && o.kind === 'rock' && Math.hypot(o.x - x, o.y - y) < r + o.r) o.alive = false;
    }
    NS.grid.compact(G.rocks);
    NS.asteroids.rebuildGrid();
  }

  function structure(base, type, x, y, built) {
    const e = NS.enemies.spawn(type, x, y, {});
    e.base = base.i;
    e.built = built;
    if (built < 1) e.hp = e.maxHp * 0.33;
    e.shieldBase = e.maxShield;
    return e;
  }

  function structures(base) {
    return G.enemies.filter(e => e.alive && e.base === base.i && e.def.structure);
  }

  function core(base) {
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (e.alive && e.base === base.i && (e.type === 'syn_core' || e.type === 'citadel')) return e;
    }
    return null;
  }

  /* a structure on the next free spot (false when there is none) */
  function place(base, type, built) {
    const list = structures(base);
    const relays = list.filter(e => e.type === 'syn_relay' && e.built >= 1);
    const spot = S.pickSpot(S.spots(base, relays), list.map(e => ({ x: e.x, y: e.y, r: e.r })), ENEMY_BY_ID[type].r, base, base.toward, blocked);
    if (!spot) return false;
    clearRocks(spot.x, spot.y, ENEMY_BY_ID[type].r + 30);
    structure(base, type, spot.x, spot.y, built);
    return true;
  }

  /* the world edge, the outpost site and the dock stay clear */
  function blocked(x, y, r) {
    if (x < r + 80 || y < r + 80 || x > G.world.w - r - 80 || y > G.world.h - r - 80) return true;
    if (G.base && NS.base.blocks(x, y, r + 120)) return true;
    return Math.hypot(x - G.dock.x, y - G.dock.y) < 500;
  }

  function unit(base, type, from) {
    const a = R() * TAU;
    const src = from || base;
    const e = NS.enemies.spawn(type, src.x + Math.cos(a) * 80, src.y + Math.sin(a) * 80, { guard: { x: base.x + Math.cos(a) * 150, y: base.y + Math.sin(a) * 150 } });
    e.base = base.i;
    e.spawnT = 0;
    return e;
  }

  /* ── per step ── */
  function update(dt) {
    if (!B.bases.length) return;
    const s = G.ship;
    for (let i = 0; i < B.bases.length; ++i) {
      const base = B.bases[i];
      if (base.dead) continue;
      const c = core(base);
      if (!c) { fall(base); continue; }
      if (!B.scouted && s && s.alive && Math.hypot(s.x - base.x, s.y - base.y) < 900) {
        B.scouted = true;
        NS.trip.banner('SYNDICATE BASE SPOTTED', 'Their core is marked on your radar', '#ff5a3a');
      }
      const list = structures(base);
      base.credits += S.income(list) * dt;
      let building = 0;
      for (const e of list) if (e.built < 1) {
        ++building;
        const t = D.BUILD[e.type] ? D.BUILD[e.type].time : 10;
        e.built = Math.min(1, e.built + dt / t);
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.67 * dt / t);
      }
      build(base, list, building);
      factories(base, list, dt);
      attack(base, dt);
      haul(base, dt);
    }
    groups();
    B.shieldT -= dt;
    if (B.shieldT <= 0) { B.shieldT = 1; pylons(); }
  }

  function build(base, list, building) {
    if (building || list.length >= D.MAX_STRUCTURES) return;
    const type = S.nextBuild(base.spec.order, base.k);
    const cost = D.BUILD[type].cost;
    if (base.credits < cost) return;
    if (place(base, type, 0.01)) base.credits -= cost;
    ++base.k;
  }

  function factories(base, list, dt) {
    const guards = G.enemies.filter(e => e.alive && e.base === base.i && e.guard && !e.def.structure).length;
    for (const f of list) {
      if (!f.def.factory || f.built < 1 || f.sporeT > 0 || f.stun > 0) continue;
      if (guards >= 8 * list.filter(e => e.def.factory && e.built >= 1).length) return;
      f.prodT = (f.prodT || 0) - dt;
      if (f.prodT > 0) continue;
      const type = S.pickUnit(base.spec.mix, R());
      const u = D.UNITS[type];
      if (base.credits < u.cost) { f.prodT = 2; continue; }
      base.credits -= u.cost;
      f.prodT = u.time;
      unit(base, type, f);
      NS.fx.ring(f.x, f.y, f.r * 0.5, f.r * 1.5, 0.4, f.def.color, 3);
    }
  }

  /* the gathered guard sets off for your outpost or your ship */
  function attack(base, dt) {
    const spec = base.spec.attack;
    if (!spec) return;
    base.attackT -= dt;
    base.since += dt;
    if (base.attackT > 0) return;
    const army = G.enemies.filter(e => e.alive && e.base === base.i && e.guard && !e.def.structure);
    if (!S.wantAttack(army.length, base.since, spec)) return;
    const g = { id: B.nextGroup++, members: army.slice(0, spec.size + 2) };
    for (const e of g.members) { e.guard = null; e.wave = 5000 + g.id; e.target = null; }
    B.groups.push(g);
    base.since = 0;
    base.attackT = spec.every;
    NS.trip.banner('SYNDICATE ATTACK', g.members.length + ' craft head for ' + (G.base && NS.base.hub() ? 'your outpost' : 'you'), '#ff5a3a');
    NS.audio.sfx('zap', { volume: 0.7, pitch: 0.4 });
  }

  function groups() {
    for (let i = B.groups.length - 1; i >= 0; --i) {
      const g = B.groups[i];
      if (g.members.some(e => e.alive)) continue;
      B.groups.splice(i, 1);
      ++B.repelled;
      NS.trip.banner('ATTACK REPELLED', 'A Syndicate attack group is down', '#5cff9a');
    }
  }

  /* haulers fly the base's cargo off the nearest edge away from the dock */
  function haul(base, dt) {
    const spec = base.spec.haul;
    if (!spec) return;
    base.haulT -= dt;
    if (base.haulT > 0) return;
    base.haulT = spec.every;
    if (spec.max && (base.hauled || 0) >= spec.max) return;
    base.hauled = (base.hauled || 0) + 1;
    const e = NS.enemies.spawn('hauler', base.x, base.y, {});
    e.base = base.i;
    const W = G.world.w, H = G.world.h;
    const ex = base.x < W / 2 ? 40 : W - 40, ey = base.y < H / 2 ? 40 : H - 40;
    e.route = Math.abs(base.x - ex) < Math.abs(base.y - ey) ? { x: ex, y: base.y + (R() - 0.5) * 600 } : { x: base.x + (R() - 0.5) * 600, y: ey };
    e.route.x = Math.max(40, Math.min(W - 40, e.route.x));
    e.route.y = Math.max(40, Math.min(H - 40, e.route.y));
    NS.trip.banner('HAULER UNDOCKS', 'A Syndicate hauler makes for the edge of the belt', '#d8a060');
  }

  /* a hauler made it off the belt */
  function escaped(e) {
    ++B.escaped;
    const base = B.bases[e.base];
    if (base) base.credits += e.def.cargo;
    NS.trip.banner('HAULER ESCAPED', B.escaped + ' got away', '#ff8a5a');
  }

  /* shield pylons keep the structures round them shielded */
  function pylons() {
    const py = G.enemies.filter(e => e.alive && e.type === 'syn_pylon' && e.built >= 1 && !(e.sporeT > 0));
    for (const e of G.enemies) {
      if (!e.alive || !e.def.structure || e.base === undefined) continue;
      const covered = py.some(p => p !== e && Math.hypot(p.x - e.x, p.y - e.y) < p.def.guard);
      const want = covered ? Math.max(e.shieldBase || 0, e.maxHp * 0.3) : (e.shieldBase || 0);
      if (want !== e.maxShield) { e.maxShield = want; e.shield = Math.min(e.shield, want); }
    }
  }

  function fall(base) {
    base.dead = true;
    NS.trip.banner('SYNDICATE BASE DESTROYED', 'Its core is down', '#5cff9a');
    NS.fx.shake(0.8);
    for (const e of G.enemies) if (e.alive && e.base === base.i && e.guard) { e.guard = null; e.wave = 4999; }
  }

  /* ── the structures each step (called from the invaders' update) ── */
  function think(e, dt) {
    const d = e.def;
    if (e.sporeT > 0) spores(e, dt);
    if (e.hijackT > 0) e.hijackT -= dt;
    if (e.built < 1 || !d.dmg) return;
    e.fireT -= dt * (e.sporeT > 0 ? 0.5 : 1);
    if (e.fireT > 0) return;
    let t = null;
    if (e.hijackT > 0) t = nearestFoe(e, d.range);
    else {
      t = NS.units.nearestPlayer(e.x, e.y, d.range, true);
      if (!t && G.base) {
        const b = NS.enemies.nearestBuilding(e.x, e.y);
        if (b && Math.hypot(b.x - e.x, b.y - e.y) < d.range + b.r) t = b;
      }
    }
    if (!t) { e.fireT = 0.3; return; }
    e.fireT = d.rof * (0.85 + R() * 0.3);
    const side = e.hijackT > 0 ? 'player' : 'enemy';
    const a = Math.atan2(t.y - e.y, t.x - e.x);
    e.angle = a;
    const mx = e.x + Math.cos(a) * e.r * 0.7, my = e.y + Math.sin(a) * e.r * 0.7;
    if (d.artillery && Math.hypot(t.x - e.x, t.y - e.y) > 240) {
      NS.enemies.fire(side, 'artillery', mx, my, t, d.dmg * (e.type === 'citadel' ? 1.6 : 1), 360, { splash: 70, from: e });
      NS.audio.sfxAt('explode', e.x, e.y, { volume: 0.25, pitch: 1.7 });
    } else NS.enemies.fire(side, 'shell', mx, my, t, d.dmg, 620, { from: e });
    NS.fx.muzzle(mx, my, a, side === 'player' ? '#3affd0' : d.color);
  }

  /* a hijacked tower shoots its makers: their craft first, then their structures */
  function nearestFoe(e, range) {
    let best = null, bd = Infinity;
    for (const o of G.enemies) {
      if (!o.alive || o === e || o.def.faction !== 'syndicate') continue;
      const q = Math.hypot(o.x - e.x, o.y - e.y);
      if (q > range) continue;
      const score = q + (o.def.structure ? range : 0);
      if (score < bd) { bd = score; best = o; }
    }
    return best;
  }

  /* spores rot a structure, and halfway jump to the nearest clean one */
  function spores(e, dt) {
    const ab = ABILITIES.spores;
    e.sporeT -= dt;
    e.hp -= e.maxHp * ab.rot * (G.stats && G.stats.sporeMul || 1) * dt;
    if (e.hp <= 0) { NS.enemies.damage(e, 1, null); return; }
    if (!e.sporeJumped && e.sporeT < ab.dur / 2) {
      e.sporeJumped = true;
      let best = null, bd = ab.jump;
      for (const o of G.enemies) {
        if (!o.alive || !o.def.structure || o === e || o.sporeT > 0 || o.def.faction !== 'syndicate') continue;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) infect(best);
    }
  }

  function infect(e) {
    e.sporeT = ABILITIES.spores.dur;
    e.sporeJumped = false;
    NS.fx.ring(e.x, e.y, e.r * 0.5, e.r * 2, 0.6, '#9ae04a', 4);
  }

  /* ── the abilities against them ── */
  function sporeAt(x, y) {
    const ab = ABILITIES.spores;
    let n = 0;
    for (const e of G.enemies) {
      if (e.alive && e.def.structure && e.def.faction === 'syndicate' && Math.hypot(e.x - x, e.y - y) < ab.radius + e.r) { infect(e); ++n; }
    }
    return n;
  }

  function hijack(u) {
    const ab = ABILITIES.hijack;
    let best = null, bd = ab.reach;
    for (const e of G.enemies) {
      if (!e.alive || !e.def.structure || !e.def.dmg || e.type === 'syn_core' || e.def.capital || e.hijackT > 0) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return null;
    best.hijackT = ab.dur * (G.stats && G.stats.hijackDur || 1);
    G.tbeams.push({ x0: u.x, y0: u.y, x1: best.x, y1: best.y, t: 0.5, color: '#3affd0', zig: true });
    NS.fx.ring(best.x, best.y, best.r, best.r * 2.5, 0.6, '#3affd0', 4);
    return best;
  }

  /* the nearest Syndicate structure in reach (what a Sporecaster aims at) */
  function nearestStructure(x, y, reach) {
    let best = null, bd = reach;
    for (const e of G.enemies) {
      if (!e.alive || !e.def.structure || e.def.faction !== 'syndicate') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /* ── autosave ── */
  function capture() {
    if (!B.bases.length) return null;
    return { bases: B.bases.map(b => ({ i: b.i, x: b.x, y: b.y, spec: b.spec, credits: Math.round(b.credits), k: b.k, since: b.since, haulT: b.haulT, attackT: b.attackT,
      dead: b.dead, toward: b.toward, hauled: b.hauled || 0 })), repelled: B.repelled, escaped: B.escaped, scouted: B.scouted };
  }

  function restore(data) {
    clear();
    if (!data || !Array.isArray(data.bases)) return;
    for (const b of data.bases) B.bases.push(Object.assign({}, b));
    B.repelled = data.repelled || 0;
    B.escaped = data.escaped || 0;
    B.scouted = !!data.scouted;
  }

  Object.assign(NS.aiBase, {
    clear, state, setup, update, think, escaped, sporeAt, hijack, nearestStructure, core, capture, restore,
    repelled: () => B.repelled, escapedCount: () => B.escaped, scouted: () => B.scouted
  });
})();
