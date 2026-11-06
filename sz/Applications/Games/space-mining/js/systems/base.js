/* The outpost in a running trip: the belt's site and deposits, the saved outpost brought to
   life (world positions, hit points, turrets, shields), founding with the command hub,
   placing, upgrading, demolishing, quarantining, sterilising and purging buildings,
   construction (two sites at a time), the link network, crew, power and production refreshed
   on a short beat, infection and corruption, turrets (rogue ones fire on you), shield domes,
   repair bays, factory queues, the trade depot, unloading the ship at the hub, damage and the
   loss of the hub, cargo pods and alerts. Owns G.base and G.pods. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { ORE_BY_ID, ZONES } = NS.ores;
  const { BUILDING_BY_ID, COMP_BY_ID } = NS.colonyData;
  const { UNIT_BY_ID } = NS.fleetData;
  const C = NS.colony;
  const P = NS.production;
  const OB = NS.outbreak;
  const rules = NS.rules;
  const R = NS.rng.fx;
  const BEAT = 0.25;

  function wallet() {
    return G.run && G.run.mode === 'siege' ? G.run : G.save;
  }

  /* The site of a belt for this trip (before the rocks are laid out, so they keep clear) */
  function prepare(zone, mode) {
    G.pods.length = 0;
    G.tbeams.length = 0;
    if (mode !== 'career' && mode !== 'siege') { G.base = null; return null; }
    const site = C.site(zone.index, G.world.w, G.world.h);
    let data;
    if (mode === 'siege') data = C.newBase(zone.id);
    else data = G.save.bases[zone.id] || C.newBase(zone.id);
    G.base = {
      data: data, zone: zone, site: site, deps: C.deposits(zone), mode: mode, net: null, pw: { make: 0, use: 0, ratio: 1 },
      staff: {}, fuel: {}, beat: 0, alerts: {}, attackT: 0, value: 0, empCd: 0, hubVisit: false, waveT: 0, next: null,
      active: false, waveLeft: 0, prodT: 0, mods: null, ev: [],
    };
    for (let i = 0; i < data.buildings.length; ++i) wake(data.buildings[i]);
    refresh();
    return G.base;
  }

  /* rocks keep clear of the site */
  function blocks(x, y, pad) {
    const b = G.base;
    if (!b) return false;
    const s = b.site, m = pad || 140;
    return x > s.x0 - m && x < s.x0 + s.w + m && y > s.y0 - m && y < s.y0 + s.h + m;
  }

  function claimed() {
    const b = G.base;
    return !!b && b.data.buildings.some(o => o.type === 'hub');
  }

  function hub() {
    const b = G.base;
    if (!b) return null;
    for (let i = 0; i < b.data.buildings.length; ++i) if (b.data.buildings[i].type === 'hub') return b.data.buildings[i];
    return null;
  }

  /* runtime fields of a saved building */
  function wake(b) {
    const def = BUILDING_BY_ID[b.type];
    const s = G.base.site;
    b.x = s.x0 + (b.cx + def.size / 2) * s.cell;
    b.y = s.y0 + (b.cy + def.size / 2) * s.cell;
    b.r = def.size * s.cell * 0.46;
    b.maxHp = Math.round(def.hp * C.levelMul(b.lvl) * G.stats.buildingHp);
    b.hp = Math.min(b.hp, b.maxHp);
    b.alive = true;
    b._fireT = R() * 0.5;
    b._ang = -Math.PI / 2;
    b._flash = 0;
    if (def.cap) b._shield = def.cap * C.levelMul(b.lvl) * G.stats.shieldMul;
    if (b.type === 'fusion') G.base.fuel[b.id] = true;
    b._qt = 0;
    return b;
  }

  function refresh() {
    const b = G.base;
    b.net = C.links(b.data, G.stats);
    b.staff = C.assignCrew(b.data);
    b.pw = C.power(b.data, b.zone, G.stats, b.net, b.fuel);
    b.value = C.baseValue(b.data);
    b.cells = C.occupancy(b.data, []);
  }

  /* ── building actions ── */
  function place(type, cx, cy) {
    const b = G.base;
    if (!b) return { ok: false, reason: 'No outpost site here' };
    const chk = C.canPlace(b.data, b.deps, type, cx, cy, G.stats);
    if (!chk.ok) return chk;
    const cost = C.buildCost(type, G.stats);
    const miss = C.missing(wallet(), b.data.stock, cost);
    if (miss) return { ok: false, reason: 'Not enough ' + missName(miss) };
    C.pay(wallet(), b.data.stock, cost);
    const def = BUILDING_BY_ID[type];
    const rec = { id: b.data.nextId++, type: type, cx: cx, cy: cy, lvl: 1, hp: def.hp, prog: 0, inf: 0, cor: 0, rogue: false, quarantine: false };
    if (type === 'fabricator') rec.recipe = 'auto';
    if (def.makes) rec.queue = [];
    b.data.buildings.push(rec);
    wake(rec);
    rec.hp = rec.maxHp * 0.1;
    if (type === 'hub') found(rec);
    refresh();
    NS.audio.sfx('thud', { volume: 0.5 });
    NS.fx.ring(rec.x, rec.y, 10, rec.r * 2, 0.5, '#7cf0ff', 3);
    return { ok: true, b: rec };
  }

  /* a finished building for free (Siege starter kit, tests) */
  function grant(type, cx, cy) {
    const b = G.base;
    const def = BUILDING_BY_ID[type];
    const rec = { id: b.data.nextId++, type: type, cx: cx, cy: cy, lvl: 1, hp: def.hp, prog: 1, inf: 0, cor: 0, rogue: false, quarantine: false };
    if (type === 'fabricator') rec.recipe = 'auto';
    if (def.makes) rec.queue = [];
    b.data.buildings.push(rec);
    wake(rec);
    rec.hp = rec.maxHp;
    if (type === 'hub') b.data.crew = Math.max(b.data.crew, 4);
    refresh();
    return rec;
  }

  /* the free spot nearest the hub where a building may go */
  function findSpot(type) {
    const b = G.base;
    const def = BUILDING_BY_ID[type];
    const h = hub();
    const hx = h ? h.cx + 1 : b.site.hubX, hy = h ? h.cy + 1 : b.site.hubY;
    let best = null, bd = Infinity;
    for (let cy = 0; cy <= C.ROWS - def.size; ++cy)
      for (let cx = 0; cx <= C.COLS - def.size; ++cx) {
        const d = Math.abs(cx - hx) + Math.abs(cy - hy);
        if (d >= bd) continue;
        if (C.canPlace(b.data, b.deps, type, cx, cy, G.stats).ok) { bd = d; best = { cx: cx, cy: cy }; }
      }
    return best;
  }

  /* take over an outpost from a snapshot (Siege resume) */
  function adopt(data) {
    const b = G.base;
    const fixed = C.repairBases(JSON.parse(JSON.stringify({ [b.zone.id]: data })))[b.zone.id];
    if (!fixed) return;
    b.data = fixed;
    for (let i = 0; i < fixed.buildings.length; ++i) wake(fixed.buildings[i]);
    refresh();
  }

  function missName(m) {
    if (m === 'credits') return 'credits';
    const p = m.split(':');
    if (p[0] === 'comp') return COMP_BY_ID[p[1]].name;
    return p[0] === 'bar' ? ORE_BY_ID[p[1]].bar : ORE_BY_ID[p[1]].name;
  }

  /* the hub goes down: the outpost is claimed */
  function found(rec) {
    const b = G.base;
    rec.prog = 0.35;
    b.data.crew = Math.max(b.data.crew, 4);
    b.data.abandoned = false;
    if (b.mode === 'career') {
      G.save.bases[b.zone.id] = b.data;
      rules.bump(G.save, 'bases', 1);
      NS.cinematics.play('founded', { x: rec.x, y: rec.y, zone: b.zone });
    }
    b.waveT = C.waveInterval(b.zone, b.mode) + (b.mode === 'siege' ? -20 : 60);
  }

  function upgrade(rec) {
    const b = G.base;
    const cost = C.upgradeCost(rec, G.stats);
    if (!cost || rec.prog < 1 || rec.rogue) return { ok: false, reason: cost ? 'Busy' : 'Fully upgraded' };
    const miss = C.missing(wallet(), b.data.stock, cost);
    if (miss) return { ok: false, reason: 'Not enough ' + missName(miss) };
    C.pay(wallet(), b.data.stock, cost);
    rec.lvl += 1;
    rec.prog = 0.4;
    const k = rec.hp / rec.maxHp;
    wake(rec);
    rec.hp = rec.maxHp * k;
    refresh();
    NS.audio.sfx('levelup', { volume: 0.4, pitch: 1.2 });
    return { ok: true };
  }

  function demolish(rec) {
    const b = G.base;
    if (rec.type === 'hub') return false;
    const i = b.data.buildings.indexOf(rec);
    if (i < 0) return false;
    if (!rec.rogue) C.refund(wallet(), b.data.stock, C.buildCost(rec.type, G.stats), 0.5 * rec.prog);
    b.data.buildings.splice(i, 1);
    rec.alive = false;
    NS.fx.explode(rec.x, rec.y, rec.r * 0.6, NS.fx.FIRE, { debrisColor: '#6a7280' });
    refresh();
    return true;
  }

  function quarantine(rec) {
    rec.quarantine = !rec.quarantine;
    refresh();
    return rec.quarantine;
  }

  function sterilize(rec) {
    const killed = OB.sterilize(G.base.data, rec);
    NS.fx.ring(rec.x, rec.y, rec.r, rec.r * 3, 0.6, '#c8ffd0', 4);
    NS.fx.sparks(rec.x, rec.y, 0, TAU, 20, '#e0ffe8', 260, 0.5);
    NS.audio.sfx('zap', { volume: 0.5, pitch: 1.3 });
    refresh();
    return killed;
  }

  /* EMP purge of one building: costs a circuit (free for the hub's pulse) */
  function purge(rec, free) {
    const st = G.base.data.stock;
    if (!free) {
      if (!st.comp.circuit) return false;
      if (--st.comp.circuit <= 0) delete st.comp.circuit;
    }
    if (OB.purge(rec) && G.run.mode === 'career') rules.bump(G.save, 'purges', 1);
    NS.fx.ring(rec.x, rec.y, rec.r, rec.r * 3.2, 0.5, '#3affd0', 4);
    NS.audio.sfx('zap', { volume: 0.5, pitch: 0.7 });
    refresh();
    return true;
  }

  /* the hub's EMP: purges every building near the hub and fries nanoprobes in reach */
  function empPulse() {
    const b = G.base, h = hub();
    if (!b || !h || !G.stats.emp || b.empCd > 0) return false;
    b.empCd = 60;
    const n = OB.emp(b.data, 7);
    if (n && G.run.mode === 'career') rules.bump(G.save, 'purges', n);
    NS.fx.shockwave(h.x, h.y, 7 * b.site.cell * 1.4, '#3affd0');
    NS.fx.flash('#3affd0', 0.25);
    NS.audio.sfx('zap', { volume: 0.9, pitch: 0.4 });
    NS.enemies.emp(h.x, h.y, 7 * b.site.cell * 1.4);
    refresh();
    return true;
  }

  function setRecipe(rec, id) {
    rec.recipe = id;
  }

  /* Queue a unit at a factory: paid now, built in turn */
  function queueUnit(rec, type) {
    const b = G.base;
    const def = UNIT_BY_ID[type];
    if (!def || !BUILDING_BY_ID[rec.type].makes || BUILDING_BY_ID[rec.type].makes.indexOf(type) < 0) return { ok: false, reason: 'Wrong factory' };
    if (rec.prog < 1 || rec.rogue) return { ok: false, reason: 'Factory offline' };
    if (rec.queue.length >= 6) return { ok: false, reason: 'Queue full' };
    if (supplyUsed() + def.supply > C.supplyCap(b.data, G.stats)) return { ok: false, reason: 'Not enough fleet supply - build habitats' };
    const miss = C.missing(wallet(), b.data.stock, def.cost);
    if (miss) return { ok: false, reason: 'Not enough ' + missName(miss) };
    C.pay(wallet(), b.data.stock, def.cost);
    rec.queue.push(type);
    return { ok: true };
  }

  function supplyUsed() {
    let n = 0;
    for (let i = 0; i < G.units.length; ++i) if (G.units[i].alive && G.units[i].side === 'player') n += G.units[i].def.supply;
    const b = G.base;
    if (b) for (let i = 0; i < b.data.buildings.length; ++i) {
      const q = b.data.buildings[i].queue;
      if (q) for (let k = 0; k < q.length; ++k) n += UNIT_BY_ID[q[k]].supply;
    }
    return n;
  }

  /* hire two crew at the hub (needs housing) */
  function recruit() {
    const b = G.base;
    if (!b || b.data.abandoned) return false;
    if (b.data.crew + 2 > C.housing(b.data) || wallet().credits < 200) return false;
    wallet().credits -= 200;
    b.data.crew += 2;
    refresh();
    return true;
  }

  /* bring an abandoned outpost back: new crew (or the survivors aboard), sterilised */
  function reclaim(crew) {
    const b = G.base;
    if (!b || !b.data.abandoned) return false;
    if (G.enemies.some(e => e.alive && e.type === 'hive' && e.home === 'base')) return false;
    if (!crew) {
      if (wallet().credits < 800) return false;
      wallet().credits -= 800;
    }
    OB.reclaim(b.data, Math.max(4, crew || 0));
    if (G.run.mode === 'career') {
      rules.bump(G.save, 'reclaims', 1);
      NS.events.log('silence');
    }
    refresh();
    NS.trip.banner('OUTPOST RECLAIMED', 'The lights come back on', '#ffd25a');
    return true;
  }

  /* ── damage ── */
  function damage(rec, amount, kind) {
    if (!rec.alive || amount <= 0) return;
    const b = G.base;
    /* a shield dome over the building soaks it first */
    for (let i = 0; i < b.data.buildings.length; ++i) {
      const g = b.data.buildings[i];
      if (g.type !== 'shield' || !(g._shield > 0) || g.prog < 1 || g.rogue) continue;
      const rad = BUILDING_BY_ID.shield.radius * (1 + (g.lvl - 1) * 0.2);
      if ((g.x - rec.x) * (g.x - rec.x) + (g.y - rec.y) * (g.y - rec.y) > rad * rad) continue;
      const a = Math.min(g._shield, amount);
      g._shield -= a;
      g._hit = 0.25;
      g._down = g._shield <= 0 ? 4 : g._down || 0;
      amount -= a;
      if (amount <= 0) return;
    }
    rec.hp -= amount;
    rec._flash = 0.12;
    b.attackT = 4;
    if (rec.hp <= 0) destroy(rec);
  }

  function destroy(rec) {
    const b = G.base;
    rec.alive = false;
    rec.hp = 0;
    const i = b.data.buildings.indexOf(rec);
    if (i >= 0) b.data.buildings.splice(i, 1);
    NS.fx.explode(rec.x, rec.y, rec.r * 1.1, NS.fx.FIRE, { debrisColor: '#5a6070' });
    NS.fx.shockwave(rec.x, rec.y, rec.r * 4, '#ffb070');
    NS.fx.shake(0.4);
    NS.audio.sfxAt('explode', rec.x, rec.y, { volume: 0.9, pitch: 0.7 });
    if (rec.type === 'hub') hubLost();
    refresh();
  }

  /* the hub falls: Siege is lost; in the career the outpost is razed and must be founded anew */
  function hubLost() {
    const b = G.base;
    NS.trip.banner('OUTPOST LOST', 'The command hub is gone', '#ff5c6c');
    NS.fx.slowMo(1.4, 0.3);
    for (let i = b.data.buildings.length - 1; i >= 0; --i) {
      const o = b.data.buildings[i];
      o.alive = false;
      NS.fx.explode(o.x, o.y, o.r, NS.fx.FIRE, { debrisColor: '#5a6070' });
    }
    b.data.buildings.length = 0;
    b.data.crew = 0;
    b.data.stock = { ore: {}, bar: {}, comp: {} };
    b.active = false;
    if (b.mode === 'siege') NS.trip.finish('fallen', 2.5);
  }

  /* ── the ship at the hub: unload the hold, drop off survivors, quick repairs ── */
  function shipAtHub(dt) {
    const b = G.base, s = G.ship, h = hub();
    if (!h || !s || !s.alive || G.cine) return;
    const d2 = (s.x - h.x) * (s.x - h.x) + (s.y - h.y) * (s.y - h.y);
    if (d2 > 260 * 260) { b.hubVisit = false; return; }
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (b.hubVisit || d2 > 95 * 95 || sp > 200 || h.prog < 1) return;
    b.hubVisit = true;
    const run = G.run;
    if (run.survivors > 0) {
      const n = run.survivors;
      run.survivors = 0;
      if (b.data.abandoned) reclaim(n);
      else b.data.crew = Math.min(C.housing(b.data) + n, b.data.crew + n);
      NS.fx.text(h.x, h.y - 70, '+' + n + ' CREW', '#ffd25a', 22, 2);
      if (run.mode === 'career') rules.bump(G.save, 'rescued', n);
    }
    if (b.data.abandoned) return;
    let units = 0;
    const cap = C.storageCap(b.data, G.stats);
    let used = C.stockCount(b.data.stock);
    for (const id in run.cargo) {
      const n = Math.min(run.cargo[id], Math.max(0, cap - used));
      if (n <= 0) continue;
      b.data.stock.ore[id] = (b.data.stock.ore[id] || 0) + n;
      run.cargo[id] -= n;
      run.cargoUsed -= NS.rules.oreSpace(G.stats, id) * n;
      if (!run.cargo[id]) delete run.cargo[id];
      used += n;
      units += n;
      for (let k = 0; k < Math.min(4, n); ++k) pod(s.x, s.y, h.x, h.y, ORE_BY_ID[id].color, 0.4 + k * 0.12);
    }
    run.cargoUsed = Math.max(0, run.cargoUsed);
    if (units) {
      NS.fx.text(h.x, h.y - 50, 'UNLOADED ' + units, '#7cf0ff', 20, 1.6);
      NS.audio.sfx('coin', { volume: 0.5, pitch: 0.8 });
    } else if (used >= cap) NS.fx.text(h.x, h.y - 50, 'STORAGE FULL', '#ff6a5c', 18, 1.4);
    /* contaminated cargo: a scan catches it, else the spores get in */
    if (run.contam > 0 && units) {
      const scanned = G.stats.cargoScan || b.data.buildings.some(o => (o.type === 'radar' || o.type === 'medbay') && o.prog >= 1 && !o.rogue);
      if (scanned) NS.fx.text(h.x, h.y - 90, 'CARGO SCAN: spores purged', '#9ae04a', 16, 2);
      else {
        OB.seedInfection(h, Math.min(0.5, 0.12 + run.contam * 0.01));
        NS.events.infected(h);
      }
      run.contam = 0;
    }
    /* the hub tops up fuel and patches the hull */
    s.fuel = Math.min(s.maxFuel, s.fuel + s.maxFuel * 0.5);
    if (b.data.buildings.some(o => o.type === 'repairbay' && o.prog >= 1)) s.hull = s.maxHull;
  }

  /* ── cargo pods (visual flows) ── */
  function pod(x0, y0, x1, y1, color, delay) {
    if (G.pods.length >= 160) return;
    G.pods.push({ x0: x0, y0: y0, x1: x1, y1: y1, t: -(delay || 0), dur: 0.8 + Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) / 260, color: color });
  }

  /* the store a pod goes to or comes from: the nearest finished warehouse, else the hub */
  function storeFor(rec) {
    const b = G.base;
    let best = hub(), bd = Infinity;
    for (let i = 0; i < b.data.buildings.length; ++i) {
      const o = b.data.buildings[i];
      if (o.type !== 'warehouse' || o.prog < 1) continue;
      const d = (o.x - rec.x) * (o.x - rec.x) + (o.y - rec.y) * (o.y - rec.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  function colorOf(kind, id) {
    return kind === 'comp' ? COMP_BY_ID[id].color : ORE_BY_ID[id].color;
  }

  function flows(ev) {
    const run = G.run;
    for (let i = 0; i < ev.length; ++i) {
      const e = ev[i];
      if (e.type === 'make') {
        const to = storeFor(e.b);
        if (to && to !== e.b) pod(e.b.x, e.b.y, to.x, to.y, colorOf(e.kind, e.id), 0);
        if (e.comp && run.mode === 'career') rules.bump(G.save, 'components', 1);
        if (e.bar && run.mode === 'career') rules.bump(G.save, 'bars', 1);
      } else if (e.type === 'use') {
        const from = storeFor(e.b);
        if (from && from !== e.b) pod(from.x, from.y, e.b.x, e.b.y, colorOf(e.kind, e.id), 0);
      } else if (e.type === 'rd') {
        run.rd += e.n;
        NS.fx.text(e.b.x, e.b.y - 30, '+' + e.n + ' DATA', '#b48aff', 14, 1.2);
      } else if (e.type === 'export') {
        if (run.mode === 'career') {
          for (let k = 0; k < e.items.length; ++k) {
            const it = e.items[k];
            G.save.store[it.kind][it.id] = (G.save.store[it.kind][it.id] || 0) + it.n;
          }
          NS.fx.text(e.b.x, e.b.y - 34, 'SHIPPED HOME  ' + NS.kit.group(e.v), '#ffd25a', 14, 1.4);
        } else {
          wallet().credits += Math.round(e.v * 0.6);
          NS.fx.text(e.b.x, e.b.y - 34, '+' + NS.kit.group(Math.round(e.v * 0.6)) + ' cr', '#ffd25a', 14, 1.4);
        }
        NS.fx.ring(e.b.x, e.b.y, 10, 80, 0.5, '#ffd25a', 3);
      }
    }
  }

  /* ── per step ── */
  function update(dt) {
    const b = G.base;
    if (!b) return;
    updatePods(dt);
    for (let i = 0; i < G.tbeams.length; ++i) G.tbeams[i].t -= dt;
    for (let i = G.tbeams.length - 1; i >= 0; --i) if (G.tbeams[i].t <= 0) G.tbeams.splice(i, 1);
    if (!claimed() && !b.data.abandoned) return;
    if (b.empCd > 0) b.empCd -= dt;
    if (b.attackT > 0) b.attackT -= dt;
    b.beat -= dt;
    if (b.beat <= 0) {
      b.beat += BEAT;
      beat(BEAT);
    }
    construct(dt);
    const list = b.data.buildings;
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (o._flash > 0) o._flash -= dt;
      if (o._stun > 0) o._stun -= dt;
      if (o.prog < 1) continue;
      const def = BUILDING_BY_ID[o.type];
      if (def.range) turret(o, def, dt);
      else if (o.type === 'shield') shieldGen(o, def, dt);
      else if (o.type === 'repairbay') repairBay(o, def, dt);
      else if (def.makes) factory(o, dt);
    }
    shipAtHub(dt);
  }

  /* the slow beat: network, crew, power, production, infection, corruption, alerts */
  function beat(dt) {
    const b = G.base;
    refresh();
    if (b.data.abandoned) { alerts(); return; }
    const ev = P.step({ base: b.data, deps: b.deps, zone: b.zone, stats: G.stats, net: b.net, pw: b.pw, staff: b.staff, dt: dt, fuel: b.fuel, mods: b.mods });
    flows(ev);
    const w = { base: b.data, net: b.net, stats: G.stats, dt: dt };
    const ce = OB.crewStep(b.data, dt, G.stats);
    const ie = OB.infectionStep(w);
    const ke = OB.corruptionStep(w);
    NS.events.outbreakEvents(ie.concat(ke, ce));
    alerts();
  }

  function construct(dt) {
    const b = G.base;
    const h = hub();
    let busy = 0;
    for (let i = 0; i < b.data.buildings.length && busy < 2; ++i) {
      const o = b.data.buildings[i];
      if (o.prog >= 1) continue;
      ++busy;
      const def = BUILDING_BY_ID[o.type];
      const crew = h && h.prog >= 1 ? 1 : 0.6;
      const k = dt / def.build * G.stats.buildSpeed * crew * (o.lvl > 1 ? 1.6 : 1);
      o.prog = Math.min(1, o.prog + k);
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * k * 0.9);
      if (R() < dt * 8) NS.fx.sparks(o.x + (R() - 0.5) * o.r * 1.6, o.y + (R() - 0.5) * o.r * 1.6, R() * TAU, 1.5, 2, '#bfe8ff', 160, 0.3);
      if (o.prog >= 1) {
        o.hp = Math.max(o.hp, o.maxHp * 0.9);
        NS.fx.ring(o.x, o.y, o.r * 0.5, o.r * 2.4, 0.6, '#7cf0ff', 4);
        NS.audio.sfxAt('levelup', o.x, o.y, { volume: 0.35, pitch: 1.4 });
        if (G.run.mode === 'career') rules.bump(G.save, 'buildings', 1);
        refresh();
      }
    }
  }

  function powered(o) {
    return (o._eff || 0) > 0.05;
  }

  /* turrets: nearest invader in range (rogue turrets fire at you); lasers, flak, missiles */
  function turret(o, def, dt) {
    if (!o.rogue && !powered(o)) return;
    const rangeMul = G.stats.turretRange * (radarNear(o) ? 1.1 : 1);
    const range = def.range * rangeMul * (1 + (o.lvl - 1) * 0.12);
    o._fireT -= dt * (o.rogue ? 1 : Math.max(0.25, o._eff));
    let t = o._target;
    if (o._side !== o.rogue) { t = null; o._side = o.rogue; }
    if (!t || !t.alive || (t.x - o.x) * (t.x - o.x) + (t.y - o.y) * (t.y - o.y) > range * range) {
      t = o.rogue ? NS.units.nearestHostileToBase(o.x, o.y, range) : NS.enemies.nearest(o.x, o.y, range, def.id === 'missile' ? 'big' : def.id === 'flak' ? 'swarm' : 'small');
      o._target = t;
    }
    if (!t) return;
    o._ang += NS.rng.clamp(NS.rng.angleDiff(o._ang, Math.atan2(t.y - o.y, t.x - o.x)), -6 * dt, 6 * dt);
    if (o._fireT > 0) return;
    o._fireT = def.rof;
    const dmg = def.dmg * C.levelMul(o.lvl) * (o.rogue ? 0.6 : G.stats.turretDmg);
    const side = o.rogue ? 'enemy' : 'player';
    const mx = o.x + Math.cos(o._ang) * o.r * 0.7, my = o.y + Math.sin(o._ang) * o.r * 0.7;
    if (def.id === 'laser') {
      NS.enemies.hitTarget(t, dmg, side);
      G.tbeams.push({ x0: mx, y0: my, x1: t.x, y1: t.y, t: 0.09, color: o.rogue ? '#3affd0' : '#ff6a3a' });
      NS.audio.sfxAt('laser', o.x, o.y, { volume: 0.12, pitch: 1.6 });
    } else if (def.id === 'flak') {
      NS.enemies.fire(side, 'flak', mx, my, t, dmg, 620, { splash: def.splash });
      NS.audio.sfxAt('shoot', o.x, o.y, { volume: 0.25, pitch: 0.6 });
    } else {
      NS.enemies.fire(side, 'missile', mx, my, t, dmg, 420, { turn: 3.2 });
      NS.enemies.fire(side, 'missile', mx, my, t, dmg, 400, { turn: 3, delay: 0.2 });
      NS.audio.sfxAt('whoosh', o.x, o.y, { volume: 0.3, pitch: 1.4 });
    }
    NS.fx.muzzle(mx, my, o._ang, o.rogue ? '#3affd0' : '#ffb070');
  }

  function radarNear(o) {
    const list = G.base.data.buildings;
    for (let i = 0; i < list.length; ++i) {
      const r = list[i];
      if (r.type === 'radar' && r.prog >= 1 && !r.rogue && Math.abs(r.cx - o.cx) <= 6 && Math.abs(r.cy - o.cy) <= 6) return true;
    }
    return false;
  }

  function shieldGen(o, def, dt) {
    if (o._hit > 0) o._hit -= dt;
    if (o._down > 0) { o._down -= dt; return; }
    const cap = def.cap * C.levelMul(o.lvl) * G.stats.shieldMul;
    const regen = def.regen * C.levelMul(o.lvl) * (G.base.mods ? G.base.mods.shieldRegen : 1);
    if (powered(o) && !o.rogue) o._shield = Math.min(cap, (o._shield || 0) + regen * o._eff * dt);
    else o._shield = Math.max(0, (o._shield || 0) - regen * dt);
  }

  function repairBay(o, def, dt) {
    if (!powered(o) || o.rogue) return;
    const heal = def.heal * C.levelMul(o.lvl) * G.stats.repairMul * o._eff * dt;
    const rad = def.radius;
    let n = 0;
    const list = G.base.data.buildings;
    for (let i = 0; i < list.length && n < 3; ++i) {
      const t = list[i];
      if (t.hp >= t.maxHp || t.prog < 1 || (t.x - o.x) * (t.x - o.x) + (t.y - o.y) * (t.y - o.y) > rad * rad) continue;
      t.hp = Math.min(t.maxHp, t.hp + heal * 3);
      ++n;
      if (R() < dt * 6) G.tbeams.push({ x0: o.x, y0: o.y, x1: t.x, y1: t.y, t: 0.15, color: '#7cff9a', soft: true });
    }
    n += NS.units.healNear(o.x, o.y, rad, heal * 2, 3 - n);
    const s = G.ship;
    if (s && s.alive && s.hull < s.maxHull && (s.x - o.x) * (s.x - o.x) + (s.y - o.y) * (s.y - o.y) < rad * rad) {
      s.hull = Math.min(s.maxHull, s.hull + heal * 1.5);
      if (R() < dt * 6) G.tbeams.push({ x0: o.x, y0: o.y, x1: s.x, y1: s.y, t: 0.15, color: '#7cff9a', soft: true });
    }
  }

  /* factories: build the first queued unit; rogue factories turn out Lattice drones */
  function factory(o, dt) {
    if (o.rogue) {
      o._qt += dt;
      if (o._qt > 9) {
        o._qt = 0;
        NS.enemies.spawn('nanodrone', o.x, o.y, { from: o });
      }
      return;
    }
    if (!o.queue || !o.queue.length || !powered(o)) return;
    const def = UNIT_BY_ID[o.queue[0]];
    o._qt += dt * o._eff * C.levelMul(o.lvl);
    if (o._qt < def.build) return;
    o._qt = 0;
    const type = o.queue.shift();
    const u = NS.units.spawn(type, o.x, o.y + o.r * 0.6, 'player');
    if (o.rally) NS.orders.issue([u], 'move', { x: o.rally.x, y: o.rally.y, formation: 'box' });
    NS.fx.ring(o.x, o.y, o.r * 0.4, o.r * 1.6, 0.4, '#4fd8ff', 3);
    NS.audio.sfxAt('powerup', o.x, o.y, { volume: 0.4, pitch: 1.3 });
  }

  function updatePods(dt) {
    for (let i = 0; i < G.pods.length; ++i) G.pods[i].t += dt;
    let j = 0;
    for (let i = 0; i < G.pods.length; ++i) if (G.pods[i].t < G.pods[i].dur) G.pods[j++] = G.pods[i];
    G.pods.length = j;
  }

  /* alerts the HUD lists: id -> { text, color } */
  function alerts() {
    const b = G.base, a = b.alerts, d = b.data;
    for (const k in a) delete a[k];
    if (d.abandoned) { a.abandoned = { text: 'Outpost abandoned - bring crew or reclaim it', color: '#ff5c6c' }; return; }
    if (b.attackT > 0) a.attack = { text: 'Outpost under attack', color: '#ff5c6c' };
    const h = hub();
    if (h && h.hp < h.maxHp * 0.4) a.hub = { text: 'Command hub critical', color: '#ff3a3a' };
    if (b.pw.use > 0 && b.pw.ratio < 0.95) a.power = { text: 'Low power - ' + Math.round(b.pw.ratio * 100) + '%', color: '#ffb347' };
    let blocked = false, need = 0, inf = 0, cor = 0, rogue = 0, off = 0;
    for (let i = 0; i < d.buildings.length; ++i) {
      const o = d.buildings[i];
      if (o._blocked) blocked = true;
      need += C.crewNeed(o);
      if (o.inf > 0.02) ++inf;
      if (o.cor > 0.05) ++cor;
      if (o.rogue) ++rogue;
      if (o.prog >= 1 && !b.net.on[i] && !o.quarantine) ++off;
    }
    if (blocked) a.full = { text: 'Storage full - build warehouses', color: '#ffb347' };
    if (need > d.crew) a.crew = { text: 'Understaffed - ' + d.crew + ' of ' + need + ' crew', color: '#ffd25a' };
    if (inf) a.outbreak = { text: 'Infection in ' + inf + ' building' + (inf > 1 ? 's' : ''), color: '#9ae04a' };
    if (rogue) a.rogue = { text: rogue + ' building' + (rogue > 1 ? 's' : '') + ' hijacked by the Lattice', color: '#3affd0' };
    else if (cor) a.corrupt = { text: 'Nanoprobe corruption spreading', color: '#3affd0' };
    if (off) a.unlinked = { text: off + ' building' + (off > 1 ? 's' : '') + ' out of link range', color: '#a4b2c8' };
  }

  /* write the field units back into the outpost roster (before a save) */
  function sync() {
    const b = G.base;
    if (!b || b.mode !== 'career' || !claimed()) return;
    const roster = [];
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (u.alive && u.side === 'player') roster.push({ type: u.type, kills: u.kills, hp: Math.round(u.hp / u.maxHp * 100) / 100 });
    }
    b.data.units = roster;
  }

  /* spawn the saved roster around the hub at the start of a trip */
  function muster() {
    const b = G.base, h = hub();
    if (!b || !h || b.data.abandoned) return;
    const list = b.data.units;
    for (let i = 0; i < list.length; ++i) {
      const a = i / Math.max(1, list.length) * TAU;
      const u = NS.units.spawn(list[i].type, h.x + Math.cos(a) * 140, h.y + Math.sin(a) * 140, 'player');
      u.kills = list[i].kills;
      NS.units.rank(u);
      u.hp = u.maxHp * Math.max(0.2, list[i].hp);
    }
  }

  function buildingAt(x, y) {
    const b = G.base;
    if (!b || !b.cells) return null;
    const cx = Math.floor((x - b.site.x0) / b.site.cell), cy = Math.floor((y - b.site.y0) / b.site.cell);
    if (cx < 0 || cy < 0 || cx >= b.site.cols || cy >= b.site.rows) return null;
    const o = b.cells[cy * b.site.cols + cx];
    return o && o.alive !== false && o.type ? o : null;
  }

  function cellAt(x, y, size) {
    const s = G.base.site;
    const k = (size || 1) / 2;
    return { cx: Math.round((x - s.x0) / s.cell - k), cy: Math.round((y - s.y0) / s.cell - k) };
  }

  Object.assign(NS.base, {
    wallet, prepare, blocks, claimed, hub, wake, refresh, place, grant, findSpot, adopt, missName, upgrade, demolish, quarantine, sterilize, purge, empPulse,
    setRecipe, queueUnit, supplyUsed, recruit, reclaim, damage, destroy, update, pod, sync, muster, buildingAt, cellAt, ZONES
  });
})();
