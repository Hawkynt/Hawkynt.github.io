/* The ship's supplies in a trip (G.run.freight, loaded from the cargo manifest): the hold as a
   source for outpost costs (supplies and mined ore together), taking a payment out of it -
   supplies first, then mined ore - with cargo pods flying to the site, and unloading the
   supplies into a hub's stock as far as it has room. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { ORE_BY_ID } = NS.ores;
  const { COMP_BY_ID } = NS.colonyData;
  const KINDS = ['ore', 'bar', 'comp'];

  const color = (kind, id) => kind === 'comp' ? COMP_BY_ID[id].color : ORE_BY_ID[id].color;

  /* everything aboard as { ore, bar, comp } (null without a ship in flight) */
  function hold() {
    const run = G.run;
    if (!run || !G.ship || !G.ship.alive) return null;
    const f = run.freight || NS.supply.blank();
    const ore = Object.assign({}, run.cargo);
    for (const id in f.ore) ore[id] = (ore[id] || 0) + f.ore[id];
    return { ore: ore, bar: f.bar, comp: f.comp };
  }

  /* takes what a payment owed the hold out of the ship */
  function take(took, tx, ty) {
    const f = G.run.freight, s = G.ship;
    let units = 0, k = 0;
    for (const kind of KINDS)
      for (const id in took[kind]) {
        const n = took[kind][id];
        const fromSupplies = Math.min(n, f[kind][id] || 0);
        if (fromSupplies) {
          f[kind][id] -= fromSupplies;
          if (!f[kind][id]) delete f[kind][id];
        }
        if (n > fromSupplies && kind === 'ore') NS.mining.changeCargo(id, fromSupplies - n);
        units += n;
        if (s && tx != null) NS.base.pod(s.x, s.y, tx, ty, color(kind, id), 0.1 * k++);
      }
    NS.mining.refreshCargoSpace();
    if (units && s) NS.fx.text(s.x, s.y - 40, units + ' FROM HOLD', '#7cf0ff', 16, 1.4);
    return units;
  }

  /* flying over the hub: supplies into the stock; returns the units unloaded */
  function unload(s) {
    const f = G.run.freight, d = G.base.data, h = NS.base.cargoHub();
    let units = 0;
    for (const id in f.ore) {
      /* receiveOre puts it into the stock and flies the pods */
      const n = NS.base.receiveOre(id, f.ore[id], s);
      f.ore[id] -= n;
      if (!f.ore[id]) delete f.ore[id];
      units += n;
    }
    for (const kind of ['bar', 'comp'])
      for (const id in f[kind]) {
        const n = NS.supply.move(f, d.stock, kind, id, Math.min(f[kind][id], NS.colony.stockRoom(d, G.stats, kind, id)));
        for (let k = 0; k < Math.min(3, n); ++k) NS.base.pod(s.x, s.y, h.x, h.y, color(kind, id), 0.4 + k * 0.12);
        units += n;
      }
    if (units) NS.mining.refreshCargoSpace();
    return units;
  }

  Object.assign(NS.supplies, {
    hold, take, unload
  });
})();
