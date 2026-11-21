/* Pure supply rules: the basics Kessler Station sells (iron, copper and ice as ore, iron and
   copper as bars) at a markup over the market, buying them into the warehouse, the cargo manifest
   (a standing order of ore, bars and components loaded at every career launch) and its repair,
   the hold slots supplies take (ore packs as usual, a bar or component takes one), fitting a
   manifest into the hold and moving supplies between the warehouse and the hold.
   No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { ORE_BY_ID } = NS.ores;
  const { COMP_BY_ID } = NS.colonyData;

  const BUY = [
    { kind: 'ore', id: 'iron' }, { kind: 'ore', id: 'copper' }, { kind: 'ore', id: 'ice' },
    { kind: 'bar', id: 'iron' }, { kind: 'bar', id: 'copper' },
  ];
  const MARKUP = 1.6;
  const KINDS = ['comp', 'bar', 'ore'];

  function onSale(kind, id) {
    return BUY.some(b => b.kind === kind && b.id === id);
  }

  /* credits per unit; the market's swings count, the broker's sale bonus does not */
  function buyPrice(save, stats, kind, id) {
    const f = NS.economy.oreFactor(save, id) * ORE_BY_ID[id].value;
    return Math.ceil((kind === 'bar' ? f * 3 * NS.economy.BAR_MUL[1] : f) * MARKUP);
  }

  /* Buys up to qty into the warehouse as far as the credits go; returns the units bought */
  function buy(save, stats, kind, id, qty) {
    if (!onSale(kind, id)) return 0;
    const p = buyPrice(save, stats, kind, id);
    const n = Math.max(0, Math.min(Math.floor(qty), Math.floor(save.credits / p)));
    if (!n) return 0;
    save.credits -= n * p;
    save.store[kind][id] = (save.store[kind][id] || 0) + n;
    return n;
  }

  function blank() {
    return { ore: {}, bar: {}, comp: {} };
  }

  function valid(kind, id) {
    return kind === 'comp' ? !!COMP_BY_ID[id] : !!ORE_BY_ID[id];
  }

  /* A repaired manifest (or hold load) from anything stored */
  function repair(src) {
    const out = blank();
    if (!src || typeof src !== 'object') return out;
    for (const kind of ['ore', 'bar', 'comp']) {
      const m = src[kind];
      if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
      for (const id in m) {
        const n = typeof m[id] === 'number' && isFinite(m[id]) ? Math.floor(Math.min(1e6, m[id])) : 0;
        if (n > 0 && valid(kind, id)) out[kind][id] = n;
      }
    }
    return out;
  }

  function oreSlots(stats, id, n) {
    return NS.rules.packedSlots(stats, n) * NS.rules.oreSpace(stats, id);
  }

  /* hold slots a load of supplies takes */
  function slots(stats, load) {
    let n = 0;
    if (!load) return n;
    for (const id in load.ore) n += oreSlots(stats, id, load.ore[id]);
    for (const id in load.bar) n += load.bar[id];
    for (const id in load.comp) n += load.comp[id];
    return n;
  }

  /* What a launch loads: the manifest, as far as the warehouse and `cap` hold slots go -
     components first, then bars, then ore - with the slots it takes */
  function fit(save, stats, cap) {
    const out = blank();
    let used = 0;
    for (const kind of KINDS) {
      const order = save.manifest[kind];
      for (const id in order) {
        let n = Math.min(order[id], save.store[kind][id] || 0);
        if (kind === 'ore') n = Math.min(n, NS.rules.packedRoom(stats, 0, Math.max(0, cap - used) / NS.rules.oreSpace(stats, id)));
        else n = Math.min(n, Math.floor(Math.max(0, cap - used)));
        if (n <= 0) continue;
        out[kind][id] = n;
        used += kind === 'ore' ? oreSlots(stats, id, n) : n;
      }
    }
    out.used = used;
    return out;
  }

  /* Moves up to n units of kind/id from one { ore, bar, comp } to another; returns how many */
  function move(from, to, kind, id, n) {
    const k = Math.max(0, Math.min(Math.floor(n), from[kind][id] || 0));
    if (!k) return 0;
    from[kind][id] -= k;
    if (!from[kind][id]) delete from[kind][id];
    to[kind][id] = (to[kind][id] || 0) + k;
    return k;
  }

  function count(load) {
    let n = 0;
    if (load) for (const kind of ['ore', 'bar', 'comp']) for (const id in load[kind]) n += load[kind][id];
    return n;
  }

  Object.assign(NS.supply, {
    BUY, MARKUP, onSale, buyPrice, buy, blank, repair, slots, fit, move, count
  });
})();
