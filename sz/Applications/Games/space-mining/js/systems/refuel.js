/* Refuelling in flight: hovering slowly beside a trading post (billed like the dock) or the
   outpost's hub (free), a fuel cell from the supplies burning by itself when the tank runs low,
   the Ramscoop turning gas into fuel, the places to refuel, the nearest one with the fuel it
   takes to get there (the bingo mark) and the bingo warning. Reads G.posts and G.base; owns
   nothing but its timers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const F = NS.fuel;

  let cellCd = 0, bill = 0, glowT = 0;
  const near = { kind: 'dock', x: 0, y: 0, cost: 0, name: 'the dock' };

  function clear() {
    cellCd = bill = glowT = 0;
  }

  function fill() {
    return G.run && G.run.cargoMax ? G.run.cargoUsed / G.run.cargoMax : 0;
  }

  function add(s, n) {
    const before = s.fuel;
    s.fuel = Math.min(s.maxFuel, s.fuel + n);
    return s.fuel - before;
  }

  /* a refuelling station within reach of a slow ship: rate, billed */
  function station(s) {
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > F.REFUEL.slow) return null;
    const reach2 = F.REFUEL.reach * F.REFUEL.reach;
    for (let i = 0; i < G.posts.length; ++i) {
      const p = G.posts[i];
      if ((p.x - s.x) * (p.x - s.x) + (p.y - s.y) * (p.y - s.y) < reach2) return { at: p, rate: F.REFUEL.post, billed: true };
    }
    const h = NS.base.hub();
    if (h && h.hp > 0 && (h.x - s.x) * (h.x - s.x) + (h.y - s.y) * (h.y - s.y) < reach2 * 1.6) return { at: h, rate: F.REFUEL.hub, billed: false };
    return null;
  }

  function update(dt) {
    const s = G.ship, run = G.run;
    if (!s || !s.alive || !run || run.ending) return;
    if (cellCd > 0) cellCd -= dt;
    /* a fuel cell burns by itself when the tank runs low */
    const cells = run.freight && run.freight.comp.fuelcell || 0;
    if (cells > 0 && cellCd <= 0 && s.fuel < s.maxFuel * F.CELL_AT) {
      if (--run.freight.comp.fuelcell <= 0) delete run.freight.comp.fuelcell;
      add(s, F.cellFuel(G.stats));
      cellCd = 1;
      NS.mining.refreshCargoSpace();
      NS.fx.text(s.x, s.y - 46, 'FUEL CELL +' + Math.round(F.cellFuel(G.stats)), '#ffc84a', 16, 1.4);
      NS.fx.ring(s.x, s.y, 20, 90, 0.4, '#ffc84a', 4);
    }
    if (s.fuel >= s.maxFuel) return;
    const st = station(s);
    if (!st) return;
    const got = add(s, st.rate * dt);
    if (st.billed && run.mode === 'career') {
      bill += NS.economy.serviceCost(G.stats, got * 1000, 0) / 1000;
      if (bill >= 1) {
        const n = Math.min(Math.floor(bill), G.save.credits);
        G.save.credits -= n;
        bill -= Math.floor(bill);
      }
    }
    glowT -= dt;
    if (glowT <= 0) {
      glowT = 0.25;
      NS.fx.glow(s.x, s.y, 18, '#ffc84a', 0.4);
    }
  }

  /* the Ramscoop: fuel from one unit of gas, 0 when it cannot take it or the tank is full */
  function scoop(gas) {
    const s = G.ship;
    if (!s || s.fuel >= s.maxFuel - 0.01) return 0;
    const n = F.scoopFuel(G.stats.scoop || 0, gas);
    return n ? add(s, n) || 0.001 : 0;
  }

  /* the places to refuel: the dock, the trading posts, the hub */
  function places(out) {
    out.length = 0;
    out.push({ kind: 'dock', x: G.dock.x, y: G.dock.y, name: 'the dock' });
    for (let i = 0; i < G.posts.length; ++i) out.push({ kind: 'post', x: G.posts[i].x, y: G.posts[i].y, name: G.posts[i].name || 'a post' });
    const h = NS.base.hub();
    if (h && h.hp > 0) out.push({ kind: 'hub', x: h.x, y: h.y, name: 'the hub' });
    return out;
  }

  const list = [];
  /* the nearest place to refuel and the fuel it takes to get there */
  function home() {
    const s = G.ship;
    places(list);
    let best = list[0], bd = Infinity;
    for (let i = 0; i < list.length; ++i) {
      const d = Math.hypot(list[i].x - s.x, list[i].y - s.y);
      if (d < bd) { bd = d; best = list[i]; }
    }
    near.kind = best.kind; near.x = best.x; near.y = best.y; near.name = best.name;
    near.dist = bd;
    near.cost = F.homeCost(Math.max(0, bd - F.REFUEL.reach), G.stats, G.run.zone, fill());
    return near;
  }

  /* fuel under the mark it takes to reach the nearest place to refuel, cells not counted */
  function bingo() {
    const s = G.ship;
    if (!s || !s.alive || !G.run) return false;
    const h = home();
    const spare = (G.run.freight && G.run.freight.comp.fuelcell || 0) * F.cellFuel(G.stats);
    return s.fuel + spare < h.cost && h.dist > F.REFUEL.reach;
  }

  Object.assign(NS.refuel, {
    clear, update, scoop, places, home, bingo, fill
  });
})();
