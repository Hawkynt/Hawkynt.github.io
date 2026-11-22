/* Pure Syndicate rules: a base's income, the next structure its order asks for, the build spots
   round the core and its relays and the free one to use (nearest the core, or nearest a point
   the base is reaching for), and when its gathered units set off as an attack group.
   No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const D = NS.syndicateData;
  const { ENEMY_BY_ID } = NS.fleetData;

  /* credits per second: the core's trickle and every finished harvester */
  function income(structures) {
    let n = D.INCOME;
    for (let i = 0; i < structures.length; ++i) {
      const s = structures[i];
      if (s.alive && s.built >= 1 && ENEMY_BY_ID[s.type].income) n += ENEMY_BY_ID[s.type].income;
    }
    return n;
  }

  /* the order's k-th structure, then the loop */
  function nextBuild(order, k) {
    const list = D.ORDERS[order] || D.ORDERS.standard;
    return k < list.length ? list[k] : D.LOOP[(k - list.length) % D.LOOP.length];
  }

  /* every build spot: the core's rings and a ring round each relay */
  function spots(core, relays) {
    const out = [];
    for (let i = 0; i < D.RINGS.length; ++i) {
      const g = D.RINGS[i];
      for (let k = 0; k < g.n; ++k) {
        const a = (k + (i % 2) * 0.5) / g.n * Math.PI * 2;
        out.push({ x: core.x + Math.cos(a) * g.r, y: core.y + Math.sin(a) * g.r });
      }
    }
    for (let i = 0; i < relays.length; ++i) {
      const rl = relays[i], reach = ENEMY_BY_ID.syn_relay.reach;
      for (let k = 0; k < D.RELAY_RING.n; ++k) {
        const a = k / D.RELAY_RING.n * Math.PI * 2 + i;
        out.push({ x: rl.x + Math.cos(a) * reach * 0.75, y: rl.y + Math.sin(a) * reach * 0.75 });
        out.push({ x: rl.x + Math.cos(a) * reach, y: rl.y + Math.sin(a) * reach });
      }
    }
    return out;
  }

  /* the free spot for a structure of radius r: clear of the others (and of what `blocked` says),
     nearest the core - or, for a base reaching out, nearest the point it reaches for */
  function pickSpot(list, taken, r, core, toward, blocked) {
    const aim = toward || core;
    let best = null, bd = Infinity;
    for (let i = 0; i < list.length; ++i) {
      const p = list[i];
      let free = !(blocked && blocked(p.x, p.y, r));
      for (let k = 0; free && k < taken.length; ++k)
        if (Math.hypot(p.x - taken[k].x, p.y - taken[k].y) < r + taken[k].r + 18) free = false;
      if (!free) continue;
      const d = Math.hypot(p.x - aim.x, p.y - aim.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /* an attack group sets off when the gathering is full, or after its wait with half of it */
  function wantAttack(army, since, spec) {
    if (!spec) return false;
    return army >= spec.size || (since >= spec.every && army >= Math.ceil(spec.size / 2));
  }

  /* a unit from a factory's mix by weight; roll in [0, 1) */
  function pickUnit(mix, roll) {
    const m = D.MIX[mix] || D.MIX.standard;
    let tot = 0;
    for (const k in m) tot += m[k];
    let x = roll * tot;
    for (const k in m) if ((x -= m[k]) < 0) return k;
    return Object.keys(m)[0];
  }

  Object.assign(NS.syndicate, {
    income, nextBuild, spots, pickSpot, wantAttack, pickUnit
  });
})();
