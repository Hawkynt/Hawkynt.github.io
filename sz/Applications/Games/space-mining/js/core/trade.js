/* Pure outpost trade rules: every outpost buys and sells at its own prices - the local factor from
   the ore's share of its belt's ore mix (1.5 - 4.5 x share, between 0.6 and 1.5), its own
   saturation from your sales that recovers each market cycle, selling an outpost's ore and bars,
   the freight fee per unit (1 credit plus 5% of the unit's base value - a bar's three ore - per belt crossed) and
   shipping stock between two outposts, limited by stock, room and credits. No DOM, no state
   access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { ORE_BY_ID, ZONE_BY_ID } = NS.ores;

  const MIN = 0.6, MAX = 1.5, SLOPE = 4.5, BAR = 3 * 1.3, SAT_MAX = 0.55, RECOVER = 0.6, FEE_BASE = 1, FEE_RATE = 0.05;

  function factor(zoneId, oreId) {
    const mix = ZONE_BY_ID[zoneId].ores;
    let tot = 0;
    for (const k in mix) tot += mix[k];
    const share = tot ? (mix[oreId] || 0) / tot : 0;
    return Math.round(Math.max(MIN, Math.min(MAX, MAX - SLOPE * share)) * 100) / 100;
  }

  /* a founded outpost that is neither abandoned nor overrun */
  function open(save, zoneId) {
    const b = save.bases && save.bases[zoneId];
    return !!b && !b.abandoned && !b.hive && b.buildings.some(o => o.type === 'hub');
  }

  function unitValue(kind, oreId) {
    return ORE_BY_ID[oreId].value * (kind === 'bar' ? BAR : 1);
  }

  /* credits for one unit of ore or one bar at this outpost */
  function price(save, stats, zoneId, kind, oreId) {
    const b = save.bases[zoneId];
    const sat = b && b.sat ? b.sat[oreId] || 0 : 0;
    return Math.max(1, Math.round(unitValue(kind, oreId) * factor(zoneId, oreId) * (1 - sat) * stats.priceMul));
  }

  /* sells up to qty of an outpost's stock at its prices; returns the credits earned */
  function sell(save, stats, zoneId, kind, oreId, qty) {
    if (!open(save, zoneId) || (kind !== 'ore' && kind !== 'bar')) return 0;
    const b = save.bases[zoneId];
    const have = b.stock[kind][oreId] || 0;
    const n = Math.min(have, Math.max(0, Math.floor(qty)));
    if (!n) return 0;
    b.sat = b.sat || {};
    const weight = (kind === 'bar' ? 3 : 1) * 0.004 / (1 + ORE_BY_ID[oreId].rarity * 0.5);
    let total = 0;
    for (let i = 0; i < n; ++i) {
      total += price(save, stats, zoneId, kind, oreId);
      b.sat[oreId] = Math.min(SAT_MAX, (b.sat[oreId] || 0) + weight);
    }
    b.stock[kind][oreId] = have - n;
    if (!b.stock[kind][oreId]) delete b.stock[kind][oreId];
    save.credits += total;
    NS.rules.bump(save, 'earned', total);
    return total;
  }

  /* the freight fee for one unit between two belts */
  function fee(from, to, kind, oreId) {
    const gap = Math.abs(ZONE_BY_ID[from].index - ZONE_BY_ID[to].index);
    return Math.ceil(FEE_BASE + FEE_RATE * ORE_BY_ID[oreId].value * (kind === 'bar' ? 3 : 1) * gap);
  }

  /* ships up to qty from one outpost to another: { moved, fee } */
  function ship(save, stats, from, to, kind, oreId, qty) {
    if (from === to || !open(save, from) || !open(save, to) || (kind !== 'ore' && kind !== 'bar')) return { moved: 0, fee: 0 };
    const a = save.bases[from], b = save.bases[to];
    const each = fee(from, to, kind, oreId);
    const n = Math.max(0, Math.min(Math.floor(qty), a.stock[kind][oreId] || 0, NS.colony.stockRoom(b, stats, kind, oreId), Math.floor(save.credits / each)));
    if (!n) return { moved: 0, fee: 0 };
    a.stock[kind][oreId] -= n;
    if (!a.stock[kind][oreId]) delete a.stock[kind][oreId];
    b.stock[kind][oreId] = (b.stock[kind][oreId] || 0) + n;
    save.credits -= n * each;
    return { moved: n, fee: n * each };
  }

  /* a market cycle: every outpost's market recovers part of the way */
  function recover(save) {
    for (const z in save.bases || {}) {
      const sat = save.bases[z].sat;
      if (!sat) continue;
      for (const id in sat) {
        sat[id] *= RECOVER;
        if (sat[id] < 0.002) delete sat[id];
      }
    }
  }

  /* an outpost's market from anything stored */
  function repairSat(src) {
    const out = {};
    if (!src || typeof src !== 'object') return out;
    for (const id in src) if (ORE_BY_ID[id] && typeof src[id] === 'number' && isFinite(src[id]) && src[id] > 0) out[id] = Math.min(SAT_MAX, src[id]);
    return out;
  }

  Object.assign(NS.trade, {
    MIN, MAX, SAT_MAX, RECOVER, factor, open, price, sell, fee, ship, recover, repairSat
  });
})();
