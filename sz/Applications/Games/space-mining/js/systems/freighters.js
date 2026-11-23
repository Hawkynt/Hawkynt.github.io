/* Escort in a trip: the trading posts at the belt edges and the lanes to them (cleared of rocks),
   freighters undocking on the operation's schedule and following their lane (slowed by an
   active storm), ambushes sprung at choke points as the first freighter nears them, reactor
   stops that wait for ore from the ship's hold, hull damage, cargo drained by latched skimmers
   and won back, delivery with pay by the cargo still aboard (under half voids the contract and
   counts as a loss), losses, supply freighters the hub orders (a lane from the dock to the
   hub, one ambush in a belt with pirates, the load into the outpost stock, back to the
   warehouse when the trip ends first), and the hired wing of two fighters that guards the ship
   and dives on attackers of a freighter.
   Owns G.posts, G.freighters and G.wing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const E = NS.escort;
  const F = E.FREIGHTER;
  const { ORE_BY_ID } = NS.ores;
  const { angleDiff, clamp } = NS.rng;
  const R = NS.rng.fx;
  const near = [];
  const pt = { x: 0, y: 0, angle: 0 };
  const LETTERS = 'ABCDEFGH';
  const WING = { hp: 160, speed: 470, accel: 900, r: 12, range: 320, dmg: 9, rof: 0.3, guard: 700 };

  function clear() {
    G.posts.length = 0;
    G.freighters.length = 0;
    G.wing.length = 0;
  }

  function convoy() {
    const op = NS.operation.def();
    return op && op.convoy ? op.convoy : null;
  }

  function post(id) {
    for (let i = 0; i < G.posts.length; ++i) if (G.posts[i].id === id) return G.posts[i];
    return null;
  }

  /* the commonest ore of the belt: what a stranded freighter asks for */
  function commonOre(zone) {
    let best = null, bw = 0;
    for (const id in zone.ores) if (zone.ores[id] > bw) { bw = zone.ores[id]; best = id; }
    return best;
  }

  /* ── setup ── */
  function setup(op) {
    clear();
    const cv = op.convoy;
    const r = NS.rng.makeRng((G.run.seed ^ 0x5e5c0) >>> 0);
    const list = E.posts(r, G.world.w, G.world.h, G.dock);
    for (let i = 0; i < list.length; ++i) G.posts.push(list[i]);
    /* Double convoy: every freighter comes with a twin eight seconds behind */
    const cl = NS.operation.mod('doubled') ? cv.list.reduce((a, c) => a.concat([c, Object.assign({}, c, { at: c.at + 8 })]), []) : cv.list;
    const dests = E.resolve(cl.map(c => c.to), list, G.dock);
    /* freighters for the outpost fly to its hub (or the site, while there is none) */
    const home = cl.some(c => c.to === 'hub') && G.base ? hubLane(NS.base.hub() || { x: G.base.site.cx, y: G.base.site.cy }) : null;
    if (home) home.chokes = E.chokes(home.path, cv.ambush ? cv.ambush.chokes : 0, r).map(c => ({ d: c.d, x: c.x, y: c.y, sprung: false }));
    for (let i = 0; i < dests.length; ++i) {
      if (cl[i].to === 'hub' && home) dests[i] = home;
      const p = dests[i];
      if (p.path) continue;
      p.path = E.lane(G.dock, p, r);
      p.len = E.length(p.path);
      p.chokes = E.chokes(p.path, cv.ambush ? cv.ambush.chokes : 0, r).map(c => ({ d: c.d, x: c.x, y: c.y, sprung: false }));
      clearLane(p.path);
    }
    const ore = commonOre(G.run.zone);
    for (let i = 0; i < cl.length; ++i) {
      const c = cl[i], p = dests[i];
      E.at(p.path, 0, pt);
      const f = {
        alive: true, id: i + 1, name: 'Freighter ' + LETTERS[i], to: p.id, state: 'wait', wait: c.at, d: 0, x: pt.x, y: pt.y, vx: 0, vy: 0,
        angle: pt.angle, r: F.r, hp: c.hp || hullHp(), maxHp: c.hp || hullHp(), cargo: 1, hitT: 0, flash: 0, exT: 0, paid: 0, pace: c.speed || 1, jam: 0,
        need: c.need ? { d: p.len * c.need.at, n: c.need.n, ore: ore, got: 0, done: false } : null,
      };
      /* an operation's supply freighter: it unloads at the hub and counts for the operation */
      if (p.hub) Object.assign(f, { kind: 'supply', op: true, name: 'Supply ' + LETTERS[i], pack: c.pack, load: JSON.parse(JSON.stringify(NS.supply.PACK_BY_ID[c.pack || 'mix'].load)) });
      G.freighters.push(f);
    }
    if (cv.wing || G.save.unlocks.indexOf('wing') >= 0) hireWing();
    if (cv.battery && dests[0]) batteries(dests[0].path, cv.battery.n, r);
  }

  function leash(f, dt) {
    const s = G.ship;
    if (s && s.alive && Math.hypot(s.x - f.x, s.y - f.y) < F.leash) { f.alone = 0; return; }
    if (!f.alone) f.raidT = F.raidFirst;
    f.alone = (f.alone || 0) + dt;
    f.raidT -= dt;
    if (f.raidT > 0) return;
    f.raidT = F.raidEvery;
    raid(f);
  }

  /* pirates jump a freighter left alone: skimmers and a raider, sized by the difficulty */
  function raid(f) {
    const n = NS.operation.sized(3, true);
    const a = R() * TAU;
    for (let i = 0; i < n; ++i) {
      const aa = a + (R() - 0.5) * 0.8, d = 850 + R() * 150;
      const p = NS.pirates.spawn(i === 0 ? 'raider' : 'skimmer', clamp(f.x + Math.cos(aa) * d, 60, G.world.w - 60), clamp(f.y + Math.sin(aa) * d, 60, G.world.h - 60));
      p.prey = f;
    }
    NS.trip.banner('RAID', f.name + ' waits alone - pirates close in', '#ff5c6c');
    NS.audio.sfx('zap', { volume: 0.6, pitch: 0.4 });
  }

  /* a pirate outpost beside the lane: gun batteries at even spacing, alternating sides */
  function batteries(path, n, r) {
    const len = E.length(path);
    for (let k = 0; k < n; ++k) {
      const d = len * (0.32 + 0.36 * k / Math.max(1, n - 1));
      const a = E.at(path, d, {});
      const side = k % 2 ? 1 : -1, off = 300 + r() * 60;
      const x = clamp(a.x - Math.sin(a.angle) * off * side, 80, G.world.w - 80), y = clamp(a.y + Math.cos(a.angle) * off * side, 80, G.world.h - 80);
      const b = NS.pirates.spawn('battery', x, y);
      b.angle = a.angle + Math.PI / 2 * side;
    }
  }

  /* the point dist ahead of a freighter on its lane */
  function ahead(f, dist) {
    const p = post(f.to);
    if (!p || !p.path) return { x: f.x, y: f.y, angle: f.angle };
    return E.at(p.path, Math.min(p.len - 20, f.d + dist), {});
  }

  /* rocks on a lane drift out of the way before the first freighter */
  function clearLane(path) {
    for (let i = 0; i < G.rocks.length; ++i) {
      const o = G.rocks[i];
      if (o.alive && o.kind === 'rock' && E.distance(path, o.x, o.y) < o.r + F.r + 50) o.alive = false;
    }
    NS.grid.compact(G.rocks);
    NS.asteroids.rebuildGrid();
  }

  /* the Arsenal's Armoured Freighters and Tuned Haulers */
  function hullHp() {
    return Math.round(F.hp * (G.stats && G.stats.freighterHp || 1));
  }

  function speed() {
    return E.pace(G.world.w) * (G.stats && G.stats.freighterSpeed || 1);
  }

  /* two fighters, more with Bigger Wing, flying on alternate sides */
  function hireWing() {
    const n = 2 + (G.stats && G.stats.wing || 0);
    for (let k = 0; k < n; ++k)
      G.wing.push({ alive: true, slot: (k % 2 ? 1 : -1) * (1 + Math.floor(k / 2) * 0.7), x: G.dock.x + (k % 2 ? 60 : -60), y: G.dock.y + 200 + Math.floor(k / 2) * 40, vx: 0, vy: 0, angle: -Math.PI / 2, bank: 0,
        r: WING.r, hp: WING.hp, maxHp: WING.hp, fireT: R() * 0.3, target: null, flash: 0, exT: 0 });
  }

  /* ── queries ── */
  function flying(f) {
    return f.alive && (f.state === 'fly' || f.state === 'need');
  }

  function nearest(x, y, range) {
    let best = null, bd = range * range;
    for (let i = 0; i < G.freighters.length; ++i) {
      const f = G.freighters[i];
      if (!flying(f)) continue;
      const q = (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y);
      if (q < bd) { bd = q; best = f; }
    }
    return best;
  }

  /* a freighter whose hull covers the point (an elongated hull: two circles along it) */
  function hitAt(x, y) {
    for (let i = 0; i < G.freighters.length; ++i) {
      const f = G.freighters[i];
      if (!flying(f)) continue;
      const c = Math.cos(f.angle) * f.r * 0.8, s = Math.sin(f.angle) * f.r * 0.8;
      const rr = f.r * f.r * 0.6;
      if ((x - f.x - c) * (x - f.x - c) + (y - f.y - s) * (y - f.y - s) < rr || (x - f.x + c) * (x - f.x + c) + (y - f.y + s) * (y - f.y + s) < rr) return f;
    }
    return null;
  }

  function wingAt(x, y) {
    for (let i = 0; i < G.wing.length; ++i) {
      const w = G.wing[i];
      if (w.alive && (w.x - x) * (w.x - x) + (w.y - y) * (w.y - y) < 196) return w;
    }
    return null;
  }

  /* a flying freighter, picked at random (where the director sends raiders in an escort) */
  function anyFlying() {
    const list = G.freighters.filter(flying);
    return list.length ? list[Math.floor(R() * list.length)] : null;
  }

  function active() {
    for (let i = 0; i < G.freighters.length; ++i) if (G.freighters[i].alive) return true;
    return false;
  }

  /* ── damage, cargo ── */
  function hurt(f, dmg) {
    if (!flying(f)) return;
    f.hp -= dmg;
    f.flash = 0.08;
    f.hitT = 3;
    if (f.hp <= 0) lose(f);
  }

  function hurtWing(w, dmg) {
    if (!w.alive) return;
    w.hp -= dmg;
    w.flash = 0.08;
    if (w.hp > 0) return;
    w.alive = false;
    NS.fx.explode(w.x, w.y, 22, NS.fx.FIRE, { debrisColor: '#4a5a6a' });
    NS.audio.sfxAt('explode', w.x, w.y, { volume: 0.5 });
    NS.screens.toast('A wing fighter is down', '#ff8a5a');
  }

  /* a latched skimmer drinks from the hold; returns what it took */
  function drain(f, dt) {
    const n = E.drain(f.cargo, 1, dt);
    f.cargo -= n;
    f.hitT = 3;
    return n;
  }

  /* cargo carried off by a skimmer comes back when it is shot down */
  function recover(f, amount, x, y) {
    if (!f || !f.alive || amount <= 0) return;
    f.cargo = Math.min(1, f.cargo + amount);
    NS.fx.text(x, y - 30, '+' + Math.round(amount * 100) + '% CARGO', '#ffd25a', 15, 1.3);
  }

  /* ── supply freighters ── */
  function wallet() {
    return G.run.mode === 'siege' ? G.run : G.save;
  }

  function shipments() {
    let n = 0;
    for (let i = 0; i < G.freighters.length; ++i) if (G.freighters[i].alive && G.freighters[i].kind === 'supply' && !G.freighters[i].op) ++n;
    return n;
  }

  /* the lane from the dock to the hub, laid once per trip */
  function hubLane(hub) {
    let p = post('hub');
    if (p) return p;
    p = { id: 'hub', name: 'the outpost', hub: true, x: hub.x, y: hub.y, chokes: [] };
    p.path = E.lane(G.dock, p, R);
    p.len = E.length(p.path);
    G.posts.push(p);
    clearLane(p.path);
    return p;
  }

  /* the hub orders a pack: paid now, flown from the dock; false when it cannot */
  function order(packId) {
    const pack = NS.supply.PACK_BY_ID[packId];
    const hub = G.base && NS.base.hub();
    const run = G.run;
    if (!pack || !hub || !run || (run.mode !== 'career' && run.mode !== 'siege') || shipments() >= NS.supply.SHIP_MAX) return false;
    const price = NS.supply.packPrice(G.save, G.stats, pack);
    const w = wallet();
    if (w.credits < price) return false;
    w.credits -= price;
    const p = hubLane(hub);
    const z = run.zone;
    E.at(p.path, 0, pt);
    let n = 0;
    for (let i = 0; i < G.freighters.length; ++i) if (G.freighters[i].kind === 'supply') ++n;
    /* pirates wait for some shipments: the more pirates the belt has, the likelier */
    const jumped = z.pirates > 0 && R() < Math.min(0.8, z.pirates);
    G.freighters.push({
      alive: true, id: G.freighters.length + 1, kind: 'supply', name: 'Supply ' + LETTERS[n % LETTERS.length], to: 'hub', state: 'wait', wait: 3, d: 0, x: pt.x, y: pt.y,
      vx: 0, vy: 0, angle: pt.angle, r: F.r, hp: hullHp(), maxHp: hullHp(), cargo: 1, hitT: 0, flash: 0, exT: 0, paid: 0, need: null, pack: pack.id,
      load: JSON.parse(JSON.stringify(pack.load)),
      chokes: jumped ? E.chokes(p.path, 1, R).map(c => ({ d: c.d, x: c.x, y: c.y, sprung: false })) : [],
      ambush: jumped ? { kinds: { skimmer: 2, raider: 1 + Math.floor(z.danger / 2) }, size: [1 + Math.floor(z.danger / 3), 2 + Math.floor(z.danger / 3)], chokes: 1 } : null,
    });
    NS.audio.sfx('coin', { volume: 0.5 });
    NS.screens.toast(pack.name + ' ordered - a supply freighter undocks at the station', '#7cf0ff');
    return true;
  }

  /* a supply freighter at the hub: the load that is left goes into the stock */
  function unload(f) {
    f.state = 'done';
    f.alive = false;
    const o = G.run.op;
    if (f.op && o) o.delivered = (o.delivered || 0) + 1;
    const got = NS.supply.scaleLoad(f.load, f.cargo);
    const st = G.base && G.base.data.stock;
    let n = 0;
    if (st) for (const kind of ['ore', 'bar', 'comp']) for (const id in got[kind]) { st[kind][id] = (st[kind][id] || 0) + got[kind][id]; n += got[kind][id]; }
    if (G.base) NS.base.refresh();
    NS.fx.text(f.x, f.y - 60, 'SUPPLIES +' + n, '#7cf0ff', 20, 2);
    NS.fx.ring(f.x, f.y, 30, 200, 0.6, '#7cf0ff', 6);
    NS.audio.sfx('coin', { volume: 0.5 });
    NS.trip.banner('SUPPLIES DELIVERED', f.name + ' unloaded ' + n + ' units at the hub', '#5cff9a');
  }

  /* the trip ends: shipments still on their way turn back to the station warehouse (career) */
  function settle() {
    if (!G.run || G.run.mode !== 'career') return;
    for (let i = 0; i < G.freighters.length; ++i) {
      const f = G.freighters[i];
      if (f.kind !== 'supply' || !f.alive) continue;
      const got = NS.supply.scaleLoad(f.load, f.cargo);
      for (const kind of ['ore', 'bar', 'comp']) for (const id in got[kind]) G.save.store[kind][id] = (G.save.store[kind][id] || 0) + got[kind][id];
      f.alive = false;
    }
  }

  function lose(f) {
    f.state = 'lost';
    f.alive = false;
    NS.fx.explode(f.x, f.y, 90, NS.fx.FIRE, { debrisColor: '#6a5a40' });
    NS.fx.shake(0.4);
    NS.audio.sfxAt('explode', f.x, f.y, { volume: 1 });
    NS.trip.banner('FREIGHTER LOST', f.name + ' broke apart', '#ff5c6c');
    for (let i = 0; i < G.pirates.length; ++i) if (G.pirates[i].latch === f) NS.pirates.unlatch(G.pirates[i]);
    const o = G.run.op;
    if (o && (f.kind !== 'supply' || f.op)) o.lost = (o.lost || 0) + 1;
  }

  function deliver(f, cv) {
    if (f.kind === 'supply') { unload(f); return; }
    f.alive = false;
    const p = post(f.to);
    const o = G.run.op;
    if (!E.accepted(f.cargo)) {
      /* under half the cargo: the post voids the contract, and it counts as lost */
      f.state = 'short';
      if (o) o.lost = (o.lost || 0) + 1;
      NS.fx.text(f.x, f.y - 60, 'SHORT: ' + Math.round(f.cargo * 100) + '% - CONTRACT VOID', '#ff5c6c', 18, 2);
      NS.audio.sfx('error', { volume: 0.6 });
      NS.trip.banner('SHORT DELIVERY', f.name + ' docked with under half its cargo - the contract is void', '#ff5c6c');
      return;
    }
    f.state = 'done';
    const cr = E.pay(cv.fee, f.cargo);
    f.paid = cr;
    if (o) { o.delivered = (o.delivered || 0) + 1; o.paid = (o.paid || 0) + cr; }
    if (G.run.mode === 'career') {
      G.save.credits += cr;
      NS.rules.bump(G.save, 'earned', cr);
      NS.rules.bump(G.save, 'freighters', 1);
    }
    NS.fx.text(f.x, f.y - 60, 'DELIVERED ' + Math.round(f.cargo * 100) + '%  +' + cr + ' cr', '#ffd25a', 20, 2);
    NS.fx.ring(f.x, f.y, 30, 200, 0.6, '#ffd25a', 6);
    NS.audio.sfx('coin', { volume: 0.6 });
    NS.trip.banner('DELIVERED', f.name + ' docked at ' + (p ? p.name : 'its post'), '#5cff9a');
  }

  /* ── per step ── */
  function update(dt) {
    if (G.freighters.length) {
      const cv = convoy();
      for (let i = 0; i < G.freighters.length; ++i) {
        const f = G.freighters[i];
        if (f.alive) step(f, cv, dt);
      }
    }
    if (G.wing.length) wing(dt);
  }

  function step(f, cv, dt) {
    const p = post(f.to);
    if (!p || !p.path) { f.alive = false; return; }
    if (f.flash > 0) f.flash -= dt;
    if (f.hitT > 0) f.hitT -= dt;
    if (f.state === 'wait') {
      if (G.cine) return;
      f.wait -= dt;
      if (f.wait > 0) return;
      /* due: an escort's freighter undocks once the ship is close - or, its patience gone, alone */
      /* one escort covers one lane: it waits while the ship is away, or a freighter in flight is
         beyond the ship's reach or bound for another post; patience runs only while none flies */
      const s = G.ship, mine = f.kind !== 'supply' || f.op;
      const flying2 = G.freighters.filter(o => o !== f && flying(o) && (o.kind !== 'supply' || o.op));
      const near = (a) => s && s.alive && Math.hypot(s.x - a.x, s.y - a.y) < F.leash;
      const escorted = !mine || (near(f) && flying2.every(o => near(o) && o.to === f.to));
      if (!escorted) {
        if (!f.due) NS.trip.banner('FREIGHTER READY', f.name + ' waits at the dock for its escort', '#ffb44a');
        f.due = (f.due || 0) + (flying2.length ? 0 : dt) + 1e-6;
        if (f.due < F.patience) return;
      }
      f.state = 'fly';
      NS.trip.banner(escorted ? 'FREIGHTER UNDOCKS' : 'FREIGHTER LEAVES ALONE', f.name + ' for ' + p.name + (escorted ? ' - escort it' : ' - no escort came'), escorted ? '#7cf0ff' : '#ff5c6c');
      NS.audio.sfx('whoosh', { volume: 0.5, pitch: 0.6 });
      return;
    }
    if (f.state === 'need') { handover(f); return; }
    const storm = G.storm && G.storm.phase === 'active';
    const x0 = f.x, y0 = f.y;
    /* an escort's freighter flies only with the ship close by; alone it waits and gets raided */
    if (f.kind !== 'supply' || f.op) leash(f, dt);
    /* a jammer's beam holds it dead in space */
    if (f.jam > 0) f.jam -= dt;
    else if (!f.alone) f.d += speed() * (f.pace || 1) * (storm ? F.storm : 1) * dt;
    if (f.need && !f.need.done && f.d >= f.need.d) {
      f.d = f.need.d;
      f.state = 'need';
      NS.trip.banner('REACTOR TROUBLE', f.name + ' needs ' + f.need.n + ' ' + ORE_BY_ID[f.need.ore].name + ' - fly alongside slowly', '#ffb44a');
      NS.audio.sfx('zap', { volume: 0.5, pitch: 0.7 });
    }
    E.at(p.path, f.d, pt);
    f.x = pt.x;
    f.y = pt.y;
    f.vx = (f.x - x0) / dt;
    f.vy = (f.y - y0) / dt;
    f.angle += clamp(angleDiff(f.angle, pt.angle), -1.2 * dt, 1.2 * dt);
    shove(f);
    const chokes = f.chokes || p.chokes;
    for (let k = 0; k < chokes.length; ++k) {
      const c = chokes[k];
      if (!c.sprung && f.d >= c.d - 260) spring(c, f, f.ambush || (cv && cv.ambush), p);
    }
    f.exT -= dt;
    if (f.exT <= 0) {
      f.exT = 1 / 20;
      const c = Math.cos(f.angle), s = Math.sin(f.angle);
      NS.fx.exhaust(f.x - c * f.r * 1.4, f.y - s * f.r * 1.4, -c * 120, -s * 120, 9, '#7cc8ff', null);
    }
    if (f.d >= p.len) deliver(f, cv);
  }

  /* the ship alongside, slow, with the ore aboard: the reactor gets patched */
  function handover(f) {
    const s = G.ship, nd = f.need;
    f.vx = f.vy = 0;
    if (!s || !s.alive) return;
    const d = Math.hypot(s.x - f.x, s.y - f.y), sp = Math.hypot(s.vx, s.vy);
    const have = G.run.cargo[nd.ore] || 0;
    if (d > F.reach || sp > F.slow || have <= 0) return;
    const n = Math.min(have, nd.n - nd.got);
    NS.mining.changeCargo(nd.ore, -n);
    nd.got += n;
    NS.fx.text(f.x, f.y - 50, '+' + n + ' ' + ORE_BY_ID[nd.ore].name + '  (' + nd.got + '/' + nd.n + ')', ORE_BY_ID[nd.ore].color, 16, 1.4);
    NS.audio.sfx('pickup', { volume: 0.5 });
    if (nd.got < nd.n) return;
    nd.done = true;
    f.state = 'fly';
    NS.trip.banner('REACTOR PATCHED', f.name + ' flies on', '#5cff9a');
  }

  /* small rocks drifting into a freighter are pushed aside */
  function shove(f) {
    const list = NS.asteroids.queryRocks(f.x, f.y, f.r + 60, near);
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (!o.alive) continue;
      const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy) || 1;
      const min = o.r + f.r;
      if (d >= min) continue;
      o.x = f.x + dx / d * min;
      o.y = f.y + dy / d * min;
      if (o.vx !== undefined) { o.vx += dx / d * 30; o.vy += dy / d * 30; }
    }
  }

  /* pirates jump the first freighter to near a choke point, from the side of the lane */
  function spring(c, f, amb, p) {
    c.sprung = true;
    if (!amb) return;
    let n = amb.size[0] + Math.floor(R() * (amb.size[1] - amb.size[0] + 1));
    if (NS.operation.mod('swarm')) n = Math.ceil(n * 1.5);
    n = NS.operation.sized(n, true);
    const side = R() < 0.5 ? -1 : 1;
    const a = f.angle + side * Math.PI / 2;
    const kinds = Object.keys(amb.kinds);
    let tot = 0;
    for (let i = 0; i < kinds.length; ++i) tot += amb.kinds[kinds[i]];
    for (let i = 0; i < n + (amb.lead ? 1 : 0); ++i) {
      let kind = kinds[0];
      if (amb.lead && i === n) kind = amb.lead;
      else {
        let roll = R() * tot;
        for (let k = 0; k < kinds.length; ++k) if ((roll -= amb.kinds[kinds[k]]) < 0) { kind = kinds[k]; break; }
      }
      /* a fast courier is met head on: the ambush waits ahead of it on its lane */
      const at = (f.pace || 1) > 1.5 ? ahead(f, 900) : c;
      const aa = a + (R() - 0.5) * 0.9, d = (f.pace || 1) > 1.5 ? 150 + R() * 150 : 820 + R() * 200;
      const x = clamp(at.x + Math.cos(aa) * d, 60, G.world.w - 60), y = clamp(at.y + Math.sin(aa) * d, 60, G.world.h - 60);
      /* pirate kinds come from the pirate clans; anything else (Lattice drones) from the factions */
      const pr = NS.ships.PIRATES[kind] ? NS.pirates.spawn(kind, x, y) : NS.enemies.spawn(kind, x, y, {});
      pr.prey = f;
      if (amb.lead && i === n) {
        pr.lead = true;
        pr.hp = pr.maxHp = pr.hp * 1.6;
      }
    }
    const o = G.run.op;
    if (o && (f.kind !== 'supply' || f.op)) { o.waves += 1; o.ambushes = (o.ambushes || 0) + 1; }
    NS.trip.banner('AMBUSH', 'Pirates jump ' + f.name + ' on the way to ' + p.name, '#ff5c6c');
    NS.audio.sfx('zap', { volume: 0.7, pitch: 0.4 });
  }

  /* ── the hired wing ── */
  function wing(dt) {
    const s = G.ship;
    for (let i = 0; i < G.wing.length; ++i) {
      const w = G.wing[i];
      if (!w.alive) continue;
      if (w.flash > 0) w.flash -= dt;
      w.fireT -= dt;
      const t = pickTarget(w);
      let tx, ty;
      if (t) {
        const a = Math.atan2(t.y - w.y, t.x - w.x) + w.slot * 0.9;
        tx = t.x - Math.cos(a) * WING.range * 0.7;
        ty = t.y - Math.sin(a) * WING.range * 0.7;
        const d = Math.hypot(t.x - w.x, t.y - w.y);
        if (d < WING.range && w.fireT <= 0) shoot(w, t);
      } else if (s && s.alive) {
        const c = Math.cos(s.angle), sn = Math.sin(s.angle);
        tx = s.x - c * 90 - sn * 70 * w.slot;
        ty = s.y - sn * 90 + c * 70 * w.slot;
      } else continue;
      fly(w, tx, ty, dt, t);
    }
  }

  /* what a wing fighter goes for: a pirate on a freighter first, then one near the ship */
  function pickTarget(w) {
    if (w.target && w.target.alive && R() > 0.02) return w.target;
    const s = G.ship;
    let best = null, bd = Infinity;
    for (let i = 0; i < G.pirates.length; ++i) {
      const p = G.pirates[i];
      if (!p.alive) continue;
      const f = nearest(p.x, p.y, WING.guard);
      const byShip = s && s.alive && Math.hypot(p.x - s.x, p.y - s.y) < WING.guard;
      if (!f && !byShip) continue;
      const d = Math.hypot(p.x - w.x, p.y - w.y) * (p.latch || (f && p.prey === f) ? 0.5 : 1);
      if (d < bd) { bd = d; best = p; }
    }
    w.target = best;
    return best;
  }

  function shoot(w, t) {
    w.fireT = WING.rof * (0.9 + R() * 0.2);
    const a = Math.atan2(t.y - w.y, t.x - w.x) + (R() - 0.5) * 0.06;
    G.bolts.push({ alive: true, friendly: true, x: w.x + Math.cos(a) * w.r, y: w.y + Math.sin(a) * w.r, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, life: 0.5, dmg: WING.dmg, angle: a });
    NS.fx.muzzle(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r, a, '#9ae0ff');
    NS.audio.sfxAt('shoot', w.x, w.y, { volume: 0.15, pitch: 1.6 });
  }

  function fly(w, tx, ty, dt, t) {
    const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy) || 1;
    const want = Math.min(WING.speed, d * 2.2);
    let ax = (dx / d * want - w.vx) * 3, ay = (dy / d * want - w.vy) * 3;
    const list = NS.asteroids.queryRocks(w.x, w.y, 90, near);
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      const ox = w.x - o.x, oy = w.y - o.y, od = Math.hypot(ox, oy) || 1, clr = o.r + w.r + 30;
      if (od < clr) { ax += ox / od * WING.accel * 2 * (1 - od / clr); ay += oy / od * WING.accel * 2 * (1 - od / clr); }
    }
    const am = Math.hypot(ax, ay);
    if (am > WING.accel) { ax *= WING.accel / am; ay *= WING.accel / am; }
    w.vx += ax * dt;
    w.vy += ay * dt;
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    const face = t ? Math.atan2(t.y - w.y, t.x - w.x) : Math.atan2(w.vy, w.vx);
    const turn = clamp(angleDiff(w.angle, face), -8 * dt, 8 * dt);
    w.bank = clamp(turn / Math.max(dt, 1e-4) / 8, -1, 1);
    w.angle += turn;
    w.exT -= dt;
    if (w.exT <= 0 && w.vx * w.vx + w.vy * w.vy > 2500) {
      w.exT = 1 / 30;
      NS.fx.exhaust(w.x - Math.cos(w.angle) * w.r, w.y - Math.sin(w.angle) * w.r, -Math.cos(w.angle) * 140, -Math.sin(w.angle) * 140, 5, '#7cc8ff', null);
    }
  }

  /* ── autosave ── */
  function capture() {
    const strip = o => {
      const c = Object.assign({}, o);
      delete c.target;
      return c;
    };
    return { posts: JSON.parse(JSON.stringify(G.posts)), freighters: G.freighters.map(strip), wing: G.wing.map(strip) };
  }

  function restore(data) {
    clear();
    if (!data || !Array.isArray(data.posts) || !Array.isArray(data.freighters)) return;
    for (const p of data.posts) if (p && typeof p.x === 'number') G.posts.push(p);
    for (const f of data.freighters) if (f && typeof f.d === 'number' && post(f.to)) G.freighters.push(Object.assign({}, f));
    if (Array.isArray(data.wing)) for (const w of data.wing) if (w && typeof w.x === 'number') G.wing.push(Object.assign({}, w, { target: null }));
  }

  Object.assign(NS.freighters, {
    WING, hullHp, speed, hireWing, ahead, clear, setup, order, shipments, settle, flying, nearest, hitAt, wingAt, anyFlying, active, hurt, hurtWing, drain, recover, update, capture, restore, commonOre
  });
})();
