/* Pure production chains: each step every finished, linked, staffed building works at its
   efficiency (power, crew, infection, corruption): extractors pull ore, gas and crystal from the
   deposit under them, smelter and refinery turn three ore into a bar, the fabricator turns bars
   into components, the lab writes research data, fusion burns gas for power and the trade depot
   ships the best stock home. Returns the flow events the renderer turns into cargo pods. Also
   the while-you-were-away yield per market cycle. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { ORES, ORE_BY_ID } = NS.ores;
  const { BUILDING_BY_ID, RECIPES, RECIPE_BY_ID, SMELTS } = NS.colonyData;
  const C = NS.colony;

  /* how hard a building works right now, 0..1 */
  function efficiency(b, i, net, pw, staff) {
    if (b.prog < 1 || !net.on[i] || b.rogue || b.quarantine || b._stun > 0) return 0;
    const def = BUILDING_BY_ID[b.type];
    let e = def.power < 0 ? pw.ratio : 1;
    e *= staff[b.id] === undefined ? 1 : staff[b.id];
    e *= 1 - 0.5 * (b.inf || 0);
    e *= 1 - 0.6 * (b.cor || 0);
    return e;
  }

  function add(stock, kind, id, n) {
    stock[kind][id] = (stock[kind][id] || 0) + n;
  }

  function take(stock, kind, id, n) {
    stock[kind][id] -= n;
    if (stock[kind][id] <= 0) delete stock[kind][id];
  }

  /* the ore a plant should smelt next: the one with the most units it may take */
  function pickSmelt(stock, plant) {
    const kinds = SMELTS[plant];
    let best = null, bn = 2;
    for (const id in stock.ore) {
      const o = ORE_BY_ID[id];
      if (!kinds[o.kind]) continue;
      if (stock.ore[id] > bn) { bn = stock.ore[id]; best = id; }
    }
    return best;
  }

  function craftable(stock, rec) {
    for (const id in rec.bar) if ((stock.bar[id] || 0) < rec.bar[id]) return false;
    for (const id in rec.comp) if ((stock.comp[id] || 0) < rec.comp[id]) return false;
    return true;
  }

  /* the fabricator's recipe: its own choice, else the most valuable it can make */
  function pickRecipe(stock, b) {
    if (b.recipe && b.recipe !== 'auto') return craftable(stock, RECIPE_BY_ID[b.recipe]) ? RECIPE_BY_ID[b.recipe] : null;
    for (let i = RECIPES.length - 1; i >= 0; --i) if (craftable(stock, RECIPES[i])) return RECIPES[i];
    return null;
  }

  /* One production step. w: { base, deps, zone, stats, net, pw, staff, dt, fuel } - fuel is a
     map building id -> fueled, kept between steps. Returns the events of this step. */
  function step(w) {
    const base = w.base, stock = base.stock, stats = w.stats, dt = w.dt;
    const cap = C.storageCap(base, stats);
    let used = C.stockCount(stock);
    const events = [];
    for (let i = 0; i < base.buildings.length; ++i) {
      const b = base.buildings[i];
      const def = BUILDING_BY_ID[b.type];
      const eff = efficiency(b, i, w.net, w.pw, w.staff);
      b._eff = eff;
      b._blocked = false;
      if (b.type === 'fusion' && b.prog >= 1) {
        b._fuelT = (b._fuelT || 0) - dt * (eff > 0 ? 1 : 0);
        if (b._fuelT <= 0) {
          let fuelId = null, kind = 'ore';
          for (const id of ['hydrogen', 'helium3']) {
            if (stock.ore[id]) { fuelId = id; kind = 'ore'; break; }
            if (stock.bar[id]) { fuelId = id; kind = 'bar'; break; }
          }
          if (fuelId && eff > 0) {
            take(stock, kind, fuelId, 1);
            --used;
            b._fuelT = def.fuelEvery * (kind === 'bar' ? 3 : 1);
            w.fuel[b.id] = true;
            events.push({ type: 'use', b: b, kind: kind, id: fuelId, n: 1 });
          } else {
            w.fuel[b.id] = false;
            b._fuelT = 2;
          }
        }
        continue;
      }
      if (eff <= 0) continue;
      const lm = C.levelMul(b.lvl);
      if (def.deposit) {
        const d = C.depositUnder(b, w.deps);
        if (!d) continue;
        b._t = (b._t || 0) + dt * eff * lm * stats.extract * (w.mods && w.mods.yield || 1);
        if (b._t >= def.rate) {
          if (used >= cap) { b._blocked = true; b._t = def.rate; continue; }
          b._t -= def.rate;
          add(stock, 'ore', d.res, 1);
          ++used;
          events.push({ type: 'make', b: b, kind: 'ore', id: d.res, n: 1 });
        }
      } else if (b.type === 'smelter' || b.type === 'refinery') {
        b._t = (b._t || 0) + dt * eff * lm * stats.process;
        if (b._t >= def.rate) {
          const id = pickSmelt(stock, b.type);
          if (!id) { b._t = def.rate; b._idle = true; continue; }
          b._idle = false;
          b._t -= def.rate;
          take(stock, 'ore', id, 3);
          add(stock, 'bar', id, 1);
          used -= 2;
          events.push({ type: 'use', b: b, kind: 'ore', id: id, n: 3 });
          events.push({ type: 'make', b: b, kind: 'bar', id: id, n: 1, bar: true });
        }
      } else if (b.type === 'fabricator') {
        const rec = pickRecipe(stock, b);
        if (!rec) { b._idle = true; continue; }
        b._idle = false;
        b._t = (b._t || 0) + dt * eff * lm * stats.process;
        b._making = rec.id;
        if (b._t >= rec.time) {
          b._t -= rec.time;
          for (const id in rec.bar) { take(stock, 'bar', id, rec.bar[id]); used -= rec.bar[id]; }
          for (const id in rec.comp) { take(stock, 'comp', id, rec.comp[id]); used -= rec.comp[id]; }
          add(stock, 'comp', rec.out, 1);
          ++used;
          events.push({ type: 'use', b: b, kind: 'bar', id: Object.keys(rec.bar)[0], n: 1 });
          events.push({ type: 'make', b: b, kind: 'comp', id: rec.out, n: 1, comp: true });
        }
      } else if (b.type === 'lab') {
        b._t = (b._t || 0) + dt * eff * lm;
        if (b._t >= def.rate) {
          b._t -= def.rate;
          let n = 1;
          if (stock.comp.circuit) {
            take(stock, 'comp', 'circuit', 1);
            --used;
            n = 2;
            events.push({ type: 'use', b: b, kind: 'comp', id: 'circuit', n: 1 });
          }
          events.push({ type: 'rd', b: b, n: n });
        }
      } else if (b.type === 'depot') {
        b._t = (b._t || 0) + dt * eff;
        if (b._t >= 12) {
          b._t -= 12;
          const items = C.bestCargo(stock, 6 * b.lvl);
          if (items.length) {
            const v = C.takeCargo(stock, items);
            events.push({ type: 'export', b: b, items: items, v: v });
          }
        }
      }
    }
    return events;
  }

  /* Everything needed to run steps on a saved outpost outside a trip */
  function world(base, zone, stats) {
    return { base: base, deps: C.deposits(zone), zone: zone, stats: stats, net: null, pw: null, staff: null, dt: 1, fuel: {}, mods: null };
  }

  function refresh(w) {
    w.net = C.links(w.base, w.stats);
    w.staff = C.assignCrew(w.base);
    w.pw = C.power(w.base, w.zone, w.stats, w.net, w.fuel);
  }

  /* The while-you-were-away yield: `seconds` of production in two-second steps (no waves, no
     infection). Returns { rd, exported, made } so the caller can book it. */
  function offline(base, zone, stats, seconds) {
    if (!base || base.abandoned || !base.buildings.some(b => b.type === 'hub')) return { rd: 0, exported: 0, made: 0 };
    const w = world(base, zone, stats);
    w.dt = 2;
    const out = { rd: 0, exported: 0, made: 0, items: [] };
    for (let t = 0; t < seconds; t += w.dt) {
      refresh(w);
      const ev = step(w);
      for (let i = 0; i < ev.length; ++i) {
        const e = ev[i];
        if (e.type === 'rd') out.rd += e.n;
        else if (e.type === 'export') { out.exported += e.v; out.items = out.items.concat(e.items); }
        else if (e.type === 'make') out.made += e.n;
      }
    }
    for (let i = 0; i < base.buildings.length; ++i) {
      const b = base.buildings[i];
      for (const k in b) if (k.charAt(0) === '_') delete b[k];
    }
    return out;
  }

  /* One market cycle for every outpost: while-away production (exports reach the home store,
     research data is banked), upkeep, and the decay of abandoned outposts - scavengers strip
     their stock and after three cycles the Bloom turns the hub into a hive. Returns a report. */
  function cycleBases(save, stats, seconds) {
    const rep = { upkeep: 0, rd: 0, exported: 0, scavenged: 0, hives: 0 };
    for (const zid in save.bases) {
      const base = save.bases[zid];
      if (!base.buildings.some(b => b.type === 'hub')) continue;
      if (base.abandoned) {
        base.idleCycles = (base.idleCycles || 0) + 1;
        for (const kind in base.stock)
          for (const id in base.stock[kind]) {
            const lost = Math.ceil(base.stock[kind][id] * 0.25);
            rep.scavenged += lost;
            base.stock[kind][id] -= lost;
            if (base.stock[kind][id] <= 0) delete base.stock[kind][id];
          }
        if (base.idleCycles >= 3 && !base.hive) {
          base.hive = true;
          ++rep.hives;
        }
        continue;
      }
      const zone = NS.ores.ZONE_BY_ID[zid];
      const out = offline(base, zone, stats, seconds === undefined ? 90 : seconds);
      rep.rd += out.rd;
      rep.exported += out.exported;
      for (let i = 0; i < out.items.length; ++i) {
        const it = out.items[i];
        save.store[it.kind][it.id] = (save.store[it.kind][it.id] || 0) + it.n;
      }
      const u = Math.min(save.credits, C.upkeep(base));
      save.credits -= u;
      rep.upkeep += u;
    }
    save.rd += rep.rd;
    return rep;
  }

  Object.assign(NS.production, {
    efficiency, pickSmelt, craftable, pickRecipe, step, world, refresh, offline, cycleBases, ORES
  });
})();
