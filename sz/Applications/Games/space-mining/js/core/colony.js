/* Pure colony rules: the outpost site of each belt (a build grid with seeded ore, gas and
   crystal deposits), the saved outpost shape and its repair, footprints and placement rules,
   the link network from the hub through relays, the power balance, crew assignment, storage,
   housing and fleet supply, building costs and upgrades, paying from credits and stock, the
   outpost's value, upkeep, and wave scaling and composition. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { ORES, ORE_BY_ID, ZONES, ZONE_BY_ID } = NS.ores;
  const { BUILDINGS, BUILDING_BY_ID, COMP_BY_ID, MAX_LEVEL, UPGRADE_MUL } = NS.colonyData;
  const { UNIT_BY_ID, ENEMY_BY_ID, WAVE_UNLOCK, BOSS_WAVE } = NS.fleetData;

  const CELL = 48, COLS = 20, ROWS = 16;

  /* where each belt's site sits (fraction of the 6400 x 4600 sector, top-left corner) */
  const SITE_POS = [[0.16, 0.6], [0.66, 0.1], [0.14, 0.12], [0.64, 0.62], [0.12, 0.58]];

  function site(zoneIndex, worldW, worldH) {
    const p = SITE_POS[zoneIndex] || SITE_POS[0];
    const x0 = Math.round((worldW || 6400) * p[0]), y0 = Math.round((worldH || 4600) * p[1]);
    return { x0: x0, y0: y0, cols: COLS, rows: ROWS, cell: CELL, w: COLS * CELL, h: ROWS * CELL,
      cx: x0 + COLS * CELL / 2, cy: y0 + ROWS * CELL / 2, hubX: Math.floor(COLS / 2) - 1, hubY: Math.floor(ROWS / 2) - 1 };
  }

  function seededRng(seed) {
    return NS.rng.makeRng(seed);
  }

  /* The deposits of a belt's site: ore patches, gas pockets and a crystal cluster, one cell each,
     clear of the hub block and the edges, at least three cells apart */
  function deposits(zone) {
    const r = seededRng(NS.rng.hashString('site:' + zone.id));
    const out = [];
    const rockOres = Object.keys(zone.ores).filter(id => ORE_BY_ID[id].kind === 'bulk' || ORE_BY_ID[id].kind === 'precious');
    rockOres.sort((a, b) => zone.ores[b] - zone.ores[a]);
    const crystals = Object.keys(zone.ores).filter(id => ORE_BY_ID[id].kind === 'crystal' || ORE_BY_ID[id].kind === 'exotic');
    crystals.sort((a, b) => ORE_BY_ID[b].value - ORE_BY_ID[a].value);
    const gases = Object.keys(zone.gases || {});
    const want = [];
    for (let i = 0; i < Math.min(4, rockOres.length); ++i) want.push({ kind: 'ore', res: rockOres[i] });
    if (rockOres.length > 4) want.push({ kind: 'ore', res: rockOres[4] });
    for (let i = 0; i < gases.length && i < 2; ++i) want.push({ kind: 'gas', res: gases[i] });
    want.push({ kind: 'crystal', res: crystals.length ? crystals[crystals.length > 1 ? 1 : 0] : 'quartz' });
    if (crystals.length > 1) want.push({ kind: 'crystal', res: crystals[0] });
    const hx = Math.floor(COLS / 2) - 1, hy = Math.floor(ROWS / 2) - 1;
    for (let i = 0; i < want.length; ++i) {
      for (let tries = 0; tries < 200; ++tries) {
        const cx = 1 + Math.floor(r() * (COLS - 2)), cy = 1 + Math.floor(r() * (ROWS - 2));
        if (cx >= hx - 2 && cx <= hx + 4 && cy >= hy - 2 && cy <= hy + 4) continue;
        let ok = true;
        for (let k = 0; k < out.length; ++k)
          if (Math.abs(out[k].cx - cx) < 3 && Math.abs(out[k].cy - cy) < 3) ok = false;
        if (!ok) continue;
        out.push({ cx: cx, cy: cy, kind: want[i].kind, res: want[i].res });
        break;
      }
    }
    return out;
  }

  /* ── the saved outpost ── */
  function newBase(zoneId) {
    return {
      v: 1, zone: zoneId, buildings: [], stock: { ore: {}, bar: {}, comp: {} }, units: [], crew: 0,
      wave: 0, bossDone: false, abandoned: false, hive: false, idleCycles: 0, nextId: 1, infected: 0, recipe: 'alloy',
    };
  }

  function num(v, lo, hi, def) {
    return typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
  }

  function cleanStock(src) {
    const out = { ore: {}, bar: {}, comp: {} };
    if (!src || typeof src !== 'object') return out;
    for (const kind in out) {
      const m = src[kind];
      if (!m || typeof m !== 'object') continue;
      for (const id in m) {
        const known = kind === 'comp' ? COMP_BY_ID[id] : ORE_BY_ID[id];
        const n = Math.floor(num(m[id], 0, 1e9, 0));
        if (known && n > 0) out[kind][id] = n;
      }
    }
    return out;
  }

  /* A repaired map of outposts by belt id from anything stored (missing = no outposts) */
  function repairBases(src) {
    const out = {};
    if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
    for (const zid in src) {
      const b = src[zid];
      if (!ZONE_BY_ID[zid] || !b || typeof b !== 'object') continue;
      const base = newBase(zid);
      base.stock = cleanStock(b.stock);
      base.crew = Math.floor(num(b.crew, 0, 999, 0));
      base.wave = Math.floor(num(b.wave, 0, 9999, 0));
      base.bossDone = !!b.bossDone;
      base.abandoned = !!b.abandoned;
      base.hive = !!b.hive && base.abandoned;
      base.idleCycles = Math.floor(num(b.idleCycles, 0, 1e6, 0));
      base.infected = num(b.infected, 0, 1, 0);
      base.recipe = typeof b.recipe === 'string' && NS.colonyData.RECIPE_BY_ID[b.recipe] ? b.recipe : 'alloy';
      let next = 1;
      const used = {};
      if (Array.isArray(b.buildings))
        for (let i = 0; i < b.buildings.length && base.buildings.length < 160; ++i) {
          const r = b.buildings[i];
          const def = r && BUILDING_BY_ID[r.type];
          if (!def) continue;
          const cx = Math.floor(num(r.cx, -1, COLS, -1)), cy = Math.floor(num(r.cy, -1, ROWS, -1));
          if (cx < 0 || cy < 0 || cx + def.size > COLS || cy + def.size > ROWS) continue;
          let clash = false;
          for (let y = cy; y < cy + def.size; ++y)
            for (let x = cx; x < cx + def.size; ++x) if (used[x + ',' + y]) clash = true;
          if (clash) continue;
          if (def.id === 'hub' && base.buildings.some(o => o.type === 'hub')) continue;
          for (let y = cy; y < cy + def.size; ++y)
            for (let x = cx; x < cx + def.size; ++x) used[x + ',' + y] = 1;
          const id = Math.floor(num(r.id, 1, 1e9, 0)) || next;
          const rec = {
            id: id, type: def.id, cx: cx, cy: cy, lvl: Math.floor(num(r.lvl, 1, MAX_LEVEL, 1)),
            hp: num(r.hp, 1, 1e7, def.hp), prog: num(r.prog, 0, 1, 1), inf: num(r.inf, 0, 1, 0), cor: num(r.cor, 0, 1, 0),
            rogue: !!r.rogue, quarantine: !!r.quarantine,
          };
          if (typeof r.recipe === 'string' && NS.colonyData.RECIPE_BY_ID[r.recipe]) rec.recipe = r.recipe;
          if (Array.isArray(r.queue)) rec.queue = r.queue.filter(u => UNIT_BY_ID[u]).slice(0, 8);
          if (r.rally && typeof r.rally.x === 'number' && typeof r.rally.y === 'number') rec.rally = { x: num(r.rally.x, -1e5, 1e5, 0), y: num(r.rally.y, -1e5, 1e5, 0) };
          base.buildings.push(rec);
          next = Math.max(next, id + 1);
        }
      base.nextId = Math.max(next, Math.floor(num(b.nextId, 1, 1e9, 1)));
      if (Array.isArray(b.units))
        for (let i = 0; i < b.units.length && base.units.length < 120; ++i) {
          const u = b.units[i];
          if (!u || !UNIT_BY_ID[u.type]) continue;
          base.units.push({ type: u.type, kills: Math.floor(num(u.kills, 0, 1e6, 0)), hp: num(u.hp, 0, 1, 1) });
        }
      if (!base.buildings.some(o => o.type === 'hub')) {
        base.buildings.length = 0;
        base.units.length = 0;
      }
      out[zid] = base;
    }
    return out;
  }

  /* ── grid ── */
  function occupancy(base, deps) {
    const g = new Array(COLS * ROWS);
    for (let i = 0; i < g.length; ++i) g[i] = null;
    for (let i = 0; i < deps.length; ++i) g[deps[i].cy * COLS + deps[i].cx] = deps[i];
    for (let i = 0; i < base.buildings.length; ++i) {
      const b = base.buildings[i];
      const s = BUILDING_BY_ID[b.type].size;
      for (let y = b.cy; y < b.cy + s; ++y)
        for (let x = b.cx; x < b.cx + s; ++x) g[y * COLS + x] = b;
    }
    return g;
  }

  /* centre of a building in cell units */
  function centre(b) {
    const s = BUILDING_BY_ID[b.type].size;
    return { x: b.cx + s / 2, y: b.cy + s / 2 };
  }

  function linkRange(type, lvl, stats) {
    const def = BUILDING_BY_ID[type];
    return (def.link || 0) + (lvl - 1) + (stats ? stats.linkRange || 0 : 0);
  }

  /* The link network: hub and finished, unquarantined relays chain together; every other
     building links to the nearest node in reach. Returns per-building parent index (-1 none),
     connected flags and the edges infection and nanoprobes travel along. */
  function links(base, stats) {
    const list = base.buildings;
    const n = list.length;
    const parent = new Array(n), on = new Array(n);
    for (let i = 0; i < n; ++i) { parent[i] = -1; on[i] = false; }
    const nodes = [];
    let hub = -1;
    for (let i = 0; i < n; ++i) if (list[i].type === 'hub') hub = i;
    if (hub < 0) return { parent: parent, on: on, edges: [], hub: -1 };
    on[hub] = true;
    nodes.push(hub);
    /* relays join breadth-first */
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < n; ++i) {
        const b = list[i];
        if (on[i] || b.type !== 'relay' || b.prog < 1 || b.quarantine) continue;
        const c = centre(b);
        for (let k = 0; k < nodes.length; ++k) {
          const nb = list[nodes[k]];
          const nc = centre(nb);
          const reach = linkRange(nb.type, nb.lvl, stats);
          if (Math.abs(nc.x - c.x) <= reach && Math.abs(nc.y - c.y) <= reach) {
            on[i] = true;
            parent[i] = nodes[k];
            nodes.push(i);
            grew = true;
            break;
          }
        }
      }
    }
    for (let i = 0; i < n; ++i) {
      if (on[i] || list[i].quarantine) continue;
      const c = centre(list[i]);
      let best = -1, bd = Infinity;
      for (let k = 0; k < nodes.length; ++k) {
        const nb = list[nodes[k]];
        const nc = centre(nb);
        const reach = linkRange(nb.type, nb.lvl, stats);
        const dx = Math.abs(nc.x - c.x), dy = Math.abs(nc.y - c.y);
        if (dx <= reach && dy <= reach && dx + dy < bd) { bd = dx + dy; best = nodes[k]; }
      }
      if (best >= 0) { on[i] = true; parent[i] = best; }
    }
    const edges = [];
    for (let i = 0; i < n; ++i) if (parent[i] >= 0) edges.push([parent[i], i]);
    return { parent: parent, on: on, edges: edges, hub: hub };
  }

  /* Could a point (cell units) be linked by the current network? */
  function inReach(base, stats, x, y) {
    const net = links(base, stats);
    for (let i = 0; i < base.buildings.length; ++i) {
      const b = base.buildings[i];
      if (!net.on[i] || (b.type !== 'hub' && b.type !== 'relay') || (b.type === 'relay' && b.prog < 1)) continue;
      const c = centre(b);
      const reach = linkRange(b.type, b.lvl, stats);
      if (Math.abs(c.x - x) <= reach && Math.abs(c.y - y) <= reach) return true;
    }
    return false;
  }

  /* Placement rules: { ok, reason } */
  function canPlace(base, deps, type, cx, cy, stats) {
    const def = BUILDING_BY_ID[type];
    if (!def) return { ok: false, reason: 'Unknown building' };
    if (base.abandoned) return { ok: false, reason: 'The outpost is abandoned' };
    const hasHub = base.buildings.some(b => b.type === 'hub');
    if (type === 'hub' && hasHub) return { ok: false, reason: 'One command hub per outpost' };
    if (type !== 'hub' && !hasHub) return { ok: false, reason: 'Found the outpost with a command hub first' };
    if (cx < 0 || cy < 0 || cx + def.size > COLS || cy + def.size > ROWS) return { ok: false, reason: 'Outside the build grid' };
    const g = occupancy(base, deps);
    let dep = null;
    for (let y = cy; y < cy + def.size; ++y)
      for (let x = cx; x < cx + def.size; ++x) {
        const o = g[y * COLS + x];
        if (!o) continue;
        if (o.type) return { ok: false, reason: 'Blocked by ' + BUILDING_BY_ID[o.type].name };
        if (!def.deposit) return { ok: false, reason: 'Keep deposits free for extractors' };
        if (o.kind !== def.deposit) return { ok: false, reason: 'Needs a ' + def.deposit + ' deposit underneath' };
        dep = o;
      }
    if (def.deposit && !dep) return { ok: false, reason: 'Place it on a ' + (def.deposit === 'ore' ? 'ore deposit' : def.deposit === 'gas' ? 'gas pocket' : 'crystal cluster') };
    if (type !== 'hub' && !inReach(base, stats, cx + def.size / 2, cy + def.size / 2)) return { ok: false, reason: 'Out of link range - build a power relay' };
    return { ok: true, reason: '', deposit: dep };
  }

  /* the deposit under an extractor */
  function depositUnder(b, deps) {
    const s = BUILDING_BY_ID[b.type].size;
    for (let i = 0; i < deps.length; ++i) {
      const d = deps[i];
      if (d.cx >= b.cx && d.cx < b.cx + s && d.cy >= b.cy && d.cy < b.cy + s) return d;
    }
    return null;
  }

  /* ── costs ── */
  function scaleCost(cost, k) {
    const out = { cr: Math.round((cost.cr || 0) * k / 5) * 5 };
    for (const kind of ['ore', 'bar', 'comp']) {
      if (!cost[kind]) continue;
      out[kind] = {};
      for (const id in cost[kind]) out[kind][id] = Math.max(1, Math.round(cost[kind][id] * k));
    }
    return out;
  }

  function buildCost(type, stats) {
    return scaleCost(BUILDING_BY_ID[type].cost, stats ? stats.buildCost : 1);
  }

  function upgradeCost(b, stats) {
    if (b.lvl >= MAX_LEVEL) return null;
    return scaleCost(BUILDING_BY_ID[b.type].cost, UPGRADE_MUL[b.lvl] * (stats ? stats.buildCost : 1));
  }

  function unitCost(type) {
    return UNIT_BY_ID[type].cost;
  }

  /* wallet: { credits } (career save or siege run); stock: { ore, bar, comp } */
  function missing(wallet, stock, cost) {
    if ((cost.cr || 0) > wallet.credits) return 'credits';
    for (const kind of ['ore', 'bar', 'comp'])
      if (cost[kind]) for (const id in cost[kind]) if ((stock[kind][id] || 0) < cost[kind][id]) return kind + ':' + id;
    return '';
  }

  function canAfford(wallet, stock, cost) {
    return !missing(wallet, stock, cost);
  }

  function pay(wallet, stock, cost) {
    if (!canAfford(wallet, stock, cost)) return false;
    wallet.credits -= cost.cr || 0;
    for (const kind of ['ore', 'bar', 'comp'])
      if (cost[kind]) for (const id in cost[kind]) {
        stock[kind][id] -= cost[kind][id];
        if (!stock[kind][id]) delete stock[kind][id];
      }
    return true;
  }

  function refund(wallet, stock, cost, share) {
    wallet.credits += Math.round((cost.cr || 0) * share);
    for (const kind of ['ore', 'bar', 'comp'])
      if (cost[kind]) for (const id in cost[kind]) {
        const n = Math.floor(cost[kind][id] * share);
        if (n > 0) stock[kind][id] = (stock[kind][id] || 0) + n;
      }
  }

  /* ── capacities ── */
  function levelMul(lvl) {
    return 1 + 0.5 * (lvl - 1);
  }

  function sumDone(base, field) {
    let s = 0;
    for (let i = 0; i < base.buildings.length; ++i) {
      const b = base.buildings[i];
      const def = BUILDING_BY_ID[b.type];
      if (b.prog >= 1 && def[field] && !b.rogue) s += def[field] * (field === 'housing' || field === 'storage' || field === 'supply' ? b.lvl : 1);
    }
    return s;
  }

  function storageCap(base, stats) {
    return Math.round(sumDone(base, 'storage') * (stats ? stats.storageMul : 1));
  }

  /* the hub houses its founding crew while it is still going up */
  function housing(base) {
    let h = sumDone(base, 'housing');
    for (let i = 0; i < base.buildings.length; ++i) {
      const b = base.buildings[i];
      if (b.type === 'hub' && b.prog < 1 && !b.rogue) h += BUILDING_BY_ID.hub.housing;
    }
    return h;
  }

  function supplyCap(base, stats) {
    return sumDone(base, 'supply') + (stats ? stats.supply || 0 : 0);
  }

  function stockCount(stock) {
    let n = 0;
    for (const kind in stock) for (const id in stock[kind]) n += stock[kind][id];
    return n;
  }

  /* ── power ── */
  function hasSun(zone) {
    return !!(zone && zone.theme && zone.theme.sun);
  }

  /* The power one building makes (+) or draws (-) given whether it has fuel */
  function buildingPower(b, zone, stats, fueled) {
    const def = BUILDING_BY_ID[b.type];
    if (b.prog < 1) return 0;
    const lm = levelMul(b.lvl);
    if (b.rogue && def.power > 0) return -Math.abs(def.power) * lm;
    if (def.power <= 0) return def.power * lm;
    let p = def.power * lm * (stats ? stats.powerMul : 1);
    if (b.type === 'solar' && hasSun(zone)) p *= 1.33;
    if (b.type === 'fusion' && !fueled) p = 6 * lm;
    return p;
  }

  /* make, use and the ratio every consumer runs at; only linked buildings count */
  function power(base, zone, stats, net, fuel) {
    let make = 0, use = 0;
    for (let i = 0; i < base.buildings.length; ++i) {
      const b = base.buildings[i];
      if (!net.on[i] || b.prog < 1) continue;
      const p = buildingPower(b, zone, stats, fuel ? fuel[b.id] !== false : true);
      if (p > 0) make += p;
      else use -= p;
    }
    return { make: make, use: use, ratio: use <= 0 ? 1 : Math.min(1, make / use) };
  }

  /* ── crew ── */
  function crewNeed(b) {
    return b.prog >= 1 && !b.quarantine ? BUILDING_BY_ID[b.type].crew : 0;
  }

  /* Hands crew to buildings by priority (defense and power first); returns the staffing map */
  function assignCrew(base) {
    const order = base.buildings.slice().sort((a, b) => BUILDING_BY_ID[b.type].prio - BUILDING_BY_ID[a.type].prio || a.id - b.id);
    let left = base.abandoned ? 0 : base.crew;
    const staff = {};
    for (let i = 0; i < order.length; ++i) {
      const b = order[i];
      const need = crewNeed(b);
      const got = Math.min(need, left);
      left -= got;
      staff[b.id] = need ? got / need : 1;
      b._staff = got;
    }
    return staff;
  }

  /* ── value, upkeep, waves ── */
  function costValue(cost) {
    let v = cost.cr || 0;
    if (cost.ore) for (const id in cost.ore) v += cost.ore[id] * ORE_BY_ID[id].value;
    if (cost.bar) for (const id in cost.bar) v += cost.bar[id] * ORE_BY_ID[id].value * 3;
    if (cost.comp) for (const id in cost.comp) v += cost.comp[id] * COMP_BY_ID[id].value;
    return v;
  }

  function baseValue(base) {
    let v = 0;
    for (let i = 0; i < base.buildings.length; ++i) {
      const b = base.buildings[i];
      v += costValue(BUILDING_BY_ID[b.type].cost) * (1 + (b.lvl - 1) * 0.9) * b.prog;
    }
    for (let i = 0; i < base.units.length; ++i) v += costValue(UNIT_BY_ID[base.units[i].type].cost);
    return Math.round(v);
  }

  function upkeep(base) {
    let u = 0;
    for (let i = 0; i < base.buildings.length; ++i) if (base.buildings[i].prog >= 1) u += BUILDING_BY_ID[base.buildings[i].type].upkeep * base.buildings[i].lvl;
    return u;
  }

  /* seconds between waves while you are in the belt (Siege presses harder) */
  function waveInterval(zone, mode) {
    return mode === 'siege' ? 62 : 120 - zone.danger * 6;
  }

  /* wave points: grow with the wave number, the belt's danger and what the outpost is worth */
  function waveBudget(waveNo, danger, value, mul) {
    const v = (6 + waveNo * 4) * (0.7 + danger * 0.3) * (1 + Math.sqrt(Math.max(0, value)) / 400) * (mul || 1);
    return Math.max(4, Math.round(v));
  }

  function isBossWave(waveNo, mode, bossDone) {
    if (mode === 'siege') return waveNo === 10 || waveNo === 15;
    return waveNo >= BOSS_WAVE && !bossDone && waveNo % BOSS_WAVE === 0;
  }

  /* A wave: faction and groups of invaders bought with the budget (pure, seeded) */
  function composeWave(waveNo, zone, value, seed, opts) {
    opts = opts || {};
    const r = seededRng((seed ^ (waveNo * 2654435761)) >>> 0);
    const budget = waveBudget(waveNo, zone.danger, value, opts.mul);
    const nano = (zone.nano || 0) * (opts.nano || 1);
    let faction = waveNo % 2 === 1 ? 'pirate' : 'alien';
    if (nano > 0 && waveNo >= WAVE_UNLOCK.nanoswarm && r() < Math.min(0.45, nano * 0.4)) faction = 'lattice';
    const pool = [];
    for (const id in WAVE_UNLOCK) {
      const e = ENEMY_BY_ID[id];
      if (WAVE_UNLOCK[id] > waveNo) continue;
      if (faction === 'lattice' ? e.faction !== 'lattice' && id !== 'raider' : e.faction !== faction && !(faction === 'alien' && id === 'swarmer')) continue;
      pool.push(id);
    }
    if (faction === 'lattice') pool.push('nanodrone');
    if (!pool.length) pool.push('raider');
    const groups = {};
    let left = budget;
    const boss = isBossWave(waveNo, opts.mode, opts.bossDone);
    if (boss) left = Math.max(6, Math.round(left * 0.4));
    let guard = 0, total = 0;
    const MAX = 60;
    while (left > 0 && total < MAX && guard++ < 400) {
      const id = pool[Math.floor(r() * pool.length)];
      const n = id === 'swarmer' ? Math.min(3, MAX - total) : 1;
      const pts = ENEMY_BY_ID[id].pts * n;
      if (pts > left && pts > 1) {
        if (pool.every(p => ENEMY_BY_ID[p].pts * (p === 'swarmer' ? 3 : 1) > left)) break;
        continue;
      }
      groups[id] = (groups[id] || 0) + n;
      total += n;
      left -= pts;
    }
    const list = [];
    for (const id in groups) list.push({ type: id, n: groups[id] });
    list.sort((a, b) => ENEMY_BY_ID[a.type].index - ENEMY_BY_ID[b.type].index);
    if (boss) list.push({ type: 'mothership', n: 1 });
    let count = 0;
    for (let i = 0; i < list.length; ++i) count += list[i].n;
    return { wave: waveNo, faction: boss ? 'alien' : faction, groups: list, boss: boss, budget: budget, count: count, angle: r() * Math.PI * 2 };
  }

  /* the stock most worth shipping home: bars and components by value */
  function bestCargo(stock, max) {
    const items = [];
    for (const id in stock.comp) items.push({ kind: 'comp', id: id, n: stock.comp[id], v: COMP_BY_ID[id].value });
    for (const id in stock.bar) items.push({ kind: 'bar', id: id, n: stock.bar[id], v: ORE_BY_ID[id].value * 3 });
    items.sort((a, b) => b.v - a.v);
    const out = [];
    let left = max;
    for (let i = 0; i < items.length && left > 0; ++i) {
      const n = Math.min(items[i].n, left);
      out.push({ kind: items[i].kind, id: items[i].id, n: n, v: items[i].v });
      left -= n;
    }
    return out;
  }

  function takeCargo(stock, list) {
    let v = 0;
    for (let i = 0; i < list.length; ++i) {
      const it = list[i];
      const have = stock[it.kind][it.id] || 0;
      const n = Math.min(have, it.n);
      stock[it.kind][it.id] = have - n;
      if (!stock[it.kind][it.id]) delete stock[it.kind][it.id];
      it.n = n;
      v += n * it.v;
    }
    return v;
  }

  Object.assign(NS.colony, {
    CELL, COLS, ROWS, site, deposits, newBase, repairBases, occupancy, centre, linkRange, links, inReach, canPlace,
    depositUnder, buildCost, upgradeCost, unitCost, missing, canAfford, pay, refund, levelMul, storageCap, housing,
    supplyCap, stockCount, buildingPower, power, crewNeed, assignCrew, costValue, baseValue, upkeep, waveInterval,
    waveBudget, isBossWave, composeWave, bestCargo, takeCargo, ORES, ZONES
  });
})();
