/* Pure economy rules: the home market (a mean-reverting random walk per ore, saturation from
   your own sales that recovers each cycle, booms and busts with a news line, price history),
   selling ore and bars, refining 3 ore into 1 bar, delivery contracts, and the service bill
   for fuel and repairs. A cycle passes every time the ship docks. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { ORES, ORE_BY_ID, ZONES, ZONE_BY_ID } = NS.ores;
  const rules = NS.rules;

  const BAR_MUL = [1, 1.3, 1.45, 1.6];
  const DEPOT_MUL = [1, 0.65, 0.35, 0];
  const HISTORY = 16;
  const SAT_MAX = 0.55;

  function initMarket(save) {
    if (save.market && typeof save.market === 'object') {
      let ok = true;
      for (let i = 0; i < ORES.length; ++i) {
        const m = save.market[ORES[i].id];
        if (!m || typeof m.f !== 'number' || typeof m.sat !== 'number' || !Array.isArray(m.hist)) ok = false;
      }
      if (ok) return save.market;
    }
    const market = {};
    for (let i = 0; i < ORES.length; ++i) market[ORES[i].id] = { f: 1, sat: 0, hist: [] };
    save.market = market;
    for (let i = 0; i < ORES.length; ++i) market[ORES[i].id].hist.push(ORES[i].value);
    return market;
  }

  function oreFactor(save, oreId) {
    const m = save.market && save.market[oreId];
    return m ? m.f * (1 - m.sat) : 1;
  }

  /* credits for one unit of ore */
  function price(save, stats, oreId) {
    return Math.max(1, Math.round(ORE_BY_ID[oreId].value * oreFactor(save, oreId) * stats.priceMul));
  }

  /* credits for one refined bar (made of three ore) */
  function barPrice(save, stats, oreId) {
    return Math.max(1, Math.round(ORE_BY_ID[oreId].value * 3 * BAR_MUL[Math.min(3, stats.refinery)] * oreFactor(save, oreId) * stats.priceMul));
  }

  /* Sells up to qty of store[kind][oreId]; returns the credits earned */
  function sell(save, stats, kind, oreId, qty) {
    const have = save.store[kind][oreId] || 0;
    const n = Math.min(have, Math.max(0, Math.floor(qty)));
    if (!n) return 0;
    let total = 0;
    const m = save.market[oreId];
    const ore = ORE_BY_ID[oreId];
    const weight = (kind === 'bar' ? 3 : 1) * 0.004 / (1 + ore.rarity * 0.5);
    /* each unit lowers the price a little for the next */
    for (let i = 0; i < n; ++i) {
      total += kind === 'bar' ? barPrice(save, stats, oreId) : price(save, stats, oreId);
      m.sat = Math.min(SAT_MAX, m.sat + weight);
    }
    save.store[kind][oreId] = have - n;
    if (!save.store[kind][oreId]) delete save.store[kind][oreId];
    save.credits += total;
    rules.bump(save, 'earned', total);
    return total;
  }

  /* Smelts up to maxBars bars of one ore; returns the bars made */
  function refine(save, stats, oreId, maxBars) {
    if (stats.refinery < 1) return 0;
    const have = save.store.ore[oreId] || 0;
    const bars = Math.min(Math.floor(have / 3), maxBars === undefined ? Infinity : maxBars);
    if (bars <= 0) return 0;
    save.store.ore[oreId] = have - bars * 3;
    if (!save.store.ore[oreId]) delete save.store.ore[oreId];
    save.store.bar[oreId] = (save.store.bar[oreId] || 0) + bars;
    rules.bump(save, 'bars', bars);
    return bars;
  }

  /* ore the player can reach: every ore of every licensed belt */
  function reachableOres(save) {
    const out = [];
    for (let i = 0; i < save.licenses.length; ++i) {
      const z = ZONE_BY_ID[save.licenses[i]];
      for (const id in z.ores) if (out.indexOf(id) < 0) out.push(id);
    }
    out.sort((a, b) => ORE_BY_ID[a].index - ORE_BY_ID[b].index);
    return out;
  }

  function makeContract(save, stats, rng) {
    const pool = reachableOres(save);
    const id = pool[Math.floor(rng() * pool.length)];
    const ore = ORE_BY_ID[id];
    const bar = stats.refinery >= 1 && rng() < 0.4;
    const scale = 1 + save.licenses.length * 0.6;
    let qty = Math.round((bar ? 4 : 14) * scale * (0.6 + rng() * 0.8) / (1 + ore.rarity * 0.35));
    qty = Math.max(bar ? 2 : 5, qty);
    const unit = ore.value * (bar ? 3 * BAR_MUL[Math.min(3, stats.refinery)] : 1);
    const reward = Math.round(qty * unit * (1.55 + rng() * 0.6) * stats.contractMul / 10) * 10;
    return {
      id: 'c' + save.cycle + '_' + Math.floor(rng() * 1e6), kind: bar ? 'bar' : 'ore', ore: id, qty: qty,
      reward: reward, rd: 1 + Math.floor(ore.rarity / 2), trips: 3 + Math.floor(rng() * 4),
    };
  }

  function refillContracts(save, stats, rng) {
    while (save.contracts.length < stats.contracts) save.contracts.push(makeContract(save, stats, rng));
  }

  function canFulfil(save, c) {
    return (save.store[c.kind][c.ore] || 0) >= c.qty;
  }

  function fulfil(save, index) {
    const c = save.contracts[index];
    if (!c || !canFulfil(save, c)) return null;
    save.store[c.kind][c.ore] -= c.qty;
    if (!save.store[c.kind][c.ore]) delete save.store[c.kind][c.ore];
    save.credits += c.reward;
    save.rd += c.rd;
    rules.bump(save, 'earned', c.reward);
    rules.bump(save, 'contracts', 1);
    save.contracts.splice(index, 1);
    return c;
  }

  /* One market cycle: prices drift, saturation eases, an event may hit, contracts age */
  function tickMarket(save, stats, rng) {
    initMarket(save);
    save.cycle += 1;
    for (let i = 0; i < ORES.length; ++i) {
      const m = save.market[ORES[i].id];
      m.f += (1 - m.f) * 0.2 + (rng() - 0.5) * 0.24;
      m.f = Math.max(0.55, Math.min(1.7, m.f));
      m.sat *= 0.55;
    }
    save.news = '';
    if (rng() < 0.3) {
      const pool = reachableOres(save);
      const id = pool[Math.floor(rng() * pool.length)];
      const boom = rng() < 0.6;
      const m = save.market[id];
      m.f = Math.max(0.55, Math.min(1.9, m.f * (boom ? 1.55 : 0.62)));
      save.news = boom ? ORE_BY_ID[id].name + ' shortage in the inner colonies - prices soar'
        : ORE_BY_ID[id].name + ' glut after a big strike - prices slump';
    }
    for (let i = 0; i < ORES.length; ++i) {
      const m = save.market[ORES[i].id];
      m.hist.push(price(save, stats, ORES[i].id));
      if (m.hist.length > HISTORY) m.hist.shift();
    }
    for (let i = save.contracts.length - 1; i >= 0; --i)
      if (--save.contracts[i].trips <= 0) save.contracts.splice(i, 1);
    refillContracts(save, stats, rng);
  }

  /* -1 falling, 0 flat, 1 rising: where the walk tends next cycle */
  function forecast(save, oreId) {
    const m = save.market[oreId];
    const d = (1 - m.f) * 0.2 + m.sat * 0.45;
    return d > 0.03 ? 1 : d < -0.03 ? -1 : 0;
  }

  function serviceCost(stats, fuelMissing, hullMissing) {
    return Math.round((Math.max(0, fuelMissing) * 1.4 + Math.max(0, hullMissing) * 3.5) * DEPOT_MUL[Math.min(3, stats.depot)]);
  }

  /* market value of a hold ({ oreId: units }) at today's prices */
  function cargoValue(save, stats, cargo) {
    let v = 0;
    for (const id in cargo) v += cargo[id] * price(save, stats, id);
    return v;
  }

  function storeValue(save, stats) {
    let v = cargoValue(save, stats, save.store.ore);
    for (const id in save.store.bar) v += save.store.bar[id] * barPrice(save, stats, id);
    return v;
  }

  Object.assign(NS.economy, {
    BAR_MUL, DEPOT_MUL, HISTORY, initMarket, price, barPrice, sell, refine, reachableOres, makeContract,
    refillContracts, canFulfil, fulfil, tickMarket, forecast, serviceCost, cargoValue, storeValue, ZONES
  });
})();
