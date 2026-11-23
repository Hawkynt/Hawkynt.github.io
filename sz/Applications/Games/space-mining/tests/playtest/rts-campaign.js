'use strict';

/* The Crimson Maw played by bots in the running game, from a save that has cleared the first
   three belts. A commander bot founds an outpost (hub, power, habitats, turrets, a shipyard),
   orders supply freighters when short, keeps its factories busy with fighters, gunboats and
   Lancers, and once enough craft have gathered attack-moves them at what the operation wants
   razed (the nearest such structure, else the base's core); its ship scouts, raids harvesters,
   intercepts haulers and fights beside the fleet. A weak bot only flies its ship and builds no
   fleet. Each operation reports won, tries, time, kills and the tension the director measured.
   FATE=1 logs how each run ended. The difficulty level adapts as in a career (each loss eases the
   next try); an operation not cleared in five tries counts as cleared so the rest is still played.
   After the Crimson Maw it flies the Void Crown's fighting operations. A playtest tool, not part of
   the test run (run: node tests/playtest/rts-campaign.js). */
const H = require('../harness');
Date.now = () => 1762300000000;
let seed = 31337;
Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const B = NS.base;
const O = NS.ops;

const hurtBy = {};
{
  const orig = NS.ship.hurt;
  NS.ship.hurt = function(n, why) {
    hurtBy[why] = (hurtBy[why] || 0) + n;
    if (process.env.WHO && why === 'bolt' && !hurtBy._who) {
      const sh = G.ship;
      const e = G.enemies.filter(o => o.alive).sort((a, b) => dist(a, sh) - dist(b, sh))[0];
      hurtBy._who = e ? e.type + '@' + Math.round(dist(e, sh)) + (e.base !== undefined ? ' base' : '') : 'none';
      hurtBy._where = Math.round(sh.x) + ',' + Math.round(sh.y) + ' pir ' + G.pirates.filter(p => p.alive).length;
    }
    return orig.apply(this, arguments);
  };
}
const view = {};
function point(x, y) {
  NS.camera.toView(x, y, view);
  G.input.mouseX = view.x;
  G.input.mouseY = view.y;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function nearest(list, p, pred, range) {
  let best = null, bd = range || Infinity;
  for (const o of list) {
    if (!o.alive || (pred && !pred(o))) continue;
    const d = dist(o, p);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/* what the operation wants razed: the nearest structure of its goal types, else a core */
function objective(op, from) {
  const want = [];
  for (const g of op.goals) if (g.type === 'raze') want.push(...g.of);
  const seen = o => !o.def.cloaked || o.seenT > 0;
  /* an operation that only wants the outpost held sends nobody out */
  if (!want.length && !op.goals.some(g => g.type === 'scout')) return null;
  /* what is wanted and out of the core's gun first (a structure that is not the core itself) */
  const core = nearest(G.enemies, from, o => o.type === 'syn_core' || o.type === 'citadel');
  const safe = o => !core || isCore(o) || dist(o, core) > core.def.range + 60;
  return nearest(G.enemies, from, o => want.indexOf(o.type) >= 0 && seen(o) && safe(o)) ||
    nearest(G.enemies, from, o => want.indexOf(o.type) >= 0 && seen(o)) || core;
}

const isCore = o => o.type === 'syn_core' || o.type === 'citadel';

/* the ship: haulers first in a freighter hunt, then threats to the outpost, then the objective */
let tanking = false;
function pilot(op, fights) {
  const s = G.ship, run = G.run, inp = G.input;
  inp.rightDown = inp.mouseDown = false;
  inp.keys.KeyS = inp.keys.Space = false;
  inp.aimMode = 'mouse';
  if (!s || !s.alive || G.cine || !run || run.ending) return;
  /* an abandoned outpost is no home: it has gone to the Bloom */
  const h = G.base && G.base.data.abandoned ? null : B.hub();
  const fleet = G.units.filter(u => u.alive && u.side === 'player' && u.def.dmg);
  let tx, ty, stand = 260, cap = 300, lock = false;
  const hauler = nearest(G.enemies, s, o => o.type === 'hauler');
  const raid = h ? nearest(G.enemies, h, o => !o.def.structure && o.wave > 5000 && (!o.def.cloaked || o.seenT > 0), 1200) : null;
  const obj = objective(op, s);
  const hurt = s.hull < s.maxHull * 0.5;
  /* fuel: at the bingo mark (with a cushion) to the nearest place to refuel - the hub refuels free -
     and stay till the tank is nearly full */
  const home = NS.refuel.home();
  if (!tanking && s.fuel < home.cost * 1.4 + 10) tanking = true;
  if (tanking && s.fuel >= s.maxFuel * 0.95) tanking = false;
  /* low on hull: the dock repairs */
  if (hurt || (s.hull < s.maxHull * 0.8 && Math.hypot(s.x - G.dock.x, s.y - G.dock.y) < 300)) { tx = G.dock.x; ty = G.dock.y; stand = 0; cap = 260; lock = hurt; }
  else if (tanking) { tx = home.x; ty = home.y; stand = home.kind === 'dock' ? 0 : 70; cap = home.kind === 'dock' ? 260 : 200; lock = true; }
  else if (hauler && op.goals.some(g => g.type === 'raze' && g.of.indexOf('hauler') >= 0)) { tx = hauler.x; ty = hauler.y; stand = 200; lock = true; cap = 520; }
  else if (raid && fights) { tx = raid.x; ty = raid.y; lock = true; }
  else if (obj && (fights ? fleet.filter(u => u.orders.length).length >= 3 || (!NS.aiBase.scouted() && op.goals.some(g => g.type === 'scout')) : true)) {
    const moving = fleet.filter(u => u.orders.length);
    const c = moving.length ? { x: moving.reduce((a, u) => a + u.x, 0) / moving.length, y: moving.reduce((a, u) => a + u.y, 0) / moving.length } : obj;
    /* with the fleet: a little behind its middle; alone: go for it */
    const go = moving.length >= 3 ? c : obj;
    tx = go.x; ty = go.y; stand = moving.length >= 3 ? 120 : 320; lock = true;
  } else if (h) { tx = h.x + 150; ty = h.y + 150; stand = 40; }
  else { tx = G.dock.x; ty = G.dock.y + 200; stand = 40; }
  /* round a gravity well, never through it */
  for (const w of G.wells) {
    const dw = Math.hypot(s.x - w.x, s.y - w.y);
    if (dw < w.r * 0.55) { tx = w.x + (s.x - w.x) / dw * w.r; ty = w.y + (s.y - w.y) / dw * w.r; stand = 0; cap = 420; break; }
    const vx = tx - s.x, vy = ty - s.y, L = Math.hypot(vx, vy) || 1;
    const along = ((w.x - s.x) * vx + (w.y - s.y) * vy) / L;
    const off = Math.abs((w.y - s.y) * vx - (w.x - s.x) * vy) / L;
    if (along > 0 && along < L && off < w.r * 0.6) {
      const side = ((w.y - s.y) * vx - (w.x - s.x) * vy) > 0 ? -1 : 1;
      tx = w.x - vy / L * w.r * 0.9 * side; ty = w.y + vx / L * w.r * 0.9 * side; stand = 0;
      break;
    }
  }
  point(tx, ty);
  const d = Math.hypot(tx - s.x, ty - s.y);
  const ux = (tx - s.x) / (d || 1), uy = (ty - s.y) / (d || 1);
  const closing = s.vx * ux + s.vy * uy, speed = Math.hypot(s.vx, s.vy);
  const want = Math.max(0, Math.min(cap, (d - stand) * 0.9));
  /* a careful pilot brakes for a rock in the way */
  let blocked = false;
  if (speed > 90) for (const r of G.rocks) {
    if (!r.alive || r.kind !== 'rock') continue;
    const rx = r.x - s.x, ry = r.y - s.y;
    const ahead = (rx * s.vx + ry * s.vy) / speed;
    if (ahead > 0 && ahead < 170 + r.r && Math.abs(rx * s.vy - ry * s.vx) / speed < r.r + 30 && Math.hypot(rx, ry) < d - 20) { blocked = true; break; }
  }
  const brake = blocked || closing > want + 40 || speed > cap + 30;
  inp.keys.KeyS = brake;
  inp.rightDown = !brake && d > stand && closing < want;
  const aim = lock ? nearest(G.enemies, s, o => !o.dormant && (!o.def.cloaked || o.seenT > 0), 650) : null;
  inp.keys.Space = !!aim;
  for (let i = 0; i < NS.hardpoints.slots().length; ++i) {
    const on = !!NS.hardpoints.state().held[i];
    if (!!aim !== on) NS.hardpoints.trigger(i, !!aim);
  }
}

const PLAN = ['solar', 'solar', 'laser', 'habitat', 'solar', 'shipyard', 'laser', 'habitat', 'solar', 'flak', 'repairbay', 'laser', 'tesla', 'solar', 'habitat', 'laser', 'missile'];
const FLEET = ['fighter', 'gunboat', 'lancer', 'fighter', 'gunboat', 'bulwark', 'fighter', 'aegis', 'lancer'];

/* the commander: build, supply, produce, attack */
function command(op, fights) {
  if (!G.base || G.cine) return;
  const b = G.base;
  if (!B.claimed()) { B.place('hub', b.site.hubX, b.site.hubY); return; }
  const h = B.hub();
  if (!h || h.prog < 1) return;
  if (b.data.crew + 2 <= NS.colony.housing(b.data) && G.save.credits > 1500) B.recruit();
  /* Lattice corruption: purge what has turned or is far gone (a circuit each), as a player would */
  for (const o of b.data.buildings) if ((o.rogue || (o.cor || 0) > 0.5) && (b.data.stock.comp.circuit || 0) > 0) B.purge(o);
  if ((b.data.stock.comp.circuit || 0) < 2 && b.data.buildings.some(o => (o.cor || 0) > 0.2) && NS.freighters.shipments() < NS.supply.SHIP_MAX) NS.freighters.order('parts');
  if (fights) {
    const yard = b.data.buildings.find(o => o.type === 'shipyard' && o.prog >= 1);
    if (yard && (yard.queue || []).length < 2) {
      /* the next craft of the list it can pay for; short of everything, iron for fighters */
      const n = G.units.filter(u => u.alive && u.side === 'player').length;
      let queued = false;
      for (let k = 0; k < FLEET.length && !queued; ++k) queued = B.queueUnit(yard, FLEET[(n + k) % FLEET.length]).ok;
      if (!queued && G.save.credits > 6000 && NS.freighters.shipments() < 1) NS.freighters.order('parts');
    }
    /* the fleet goes once enough have gathered */
    const fleet = G.units.filter(u => u.alive && u.side === 'player' && u.def.dmg);
    const idle = fleet.filter(u => !u.orders.length);
    const obj = objective(op, h);
    /* a core takes a real fleet: eight, or whatever there is after five minutes */
    const need = obj && isCore(obj) ? 8 : 4, wait = obj && isCore(obj) ? 300 : 150;
    if (obj && (idle.length >= need || (idle.length >= 2 && G.run.t > wait))) NS.command.order('amove', obj.x, obj.y, null, false, idle);
  }
  if (b.data.buildings.filter(o => o.prog < 1).length >= 2) return;
  const plan = fights ? PLAN : ['solar', 'laser'];
  const have = {}, want = {};
  for (const o of b.data.buildings) have[o.type] = (have[o.type] || 0) + 1;
  for (const type of plan) {
    want[type] = (want[type] || 0) + 1;
    if ((have[type] || 0) >= want[type]) continue;
    const spot = B.findSpot(type);
    if (!spot) continue;
    if (B.place(type, spot.cx, spot.cy).ok) return;
    const miss = B.lack(NS.colony.buildCost(type, G.stats));
    if (miss && NS.freighters.shipments() < NS.supply.SHIP_MAX) {
      const o = Object.assign({}, miss.ore, miss.bar);
      NS.freighters.order(miss.comp && Object.keys(miss.comp).length ? 'parts' : o.copper && !o.iron ? 'copper' : o.iron && !o.copper && !o.ice ? 'iron' : 'mix');
    }
    return;
  }
}

function play(op, fights, cap) {
  NS.trip.startTrip('career', NS.ores.ZONE_BY_ID[op.zone].index, { op: op.id });
  for (let i = 0; i < 20 && G.cine; ++i) { H.run(NS, 30); NS.cinematics.skip(); }
  const trace = [];
  let t = 0, tick = 0;
  while (G.run && G.run.op && G.run.op.status === 'active' && t < cap) {
    pilot(op, fights);
    if (++tick % 20 === 0) command(op, fights);
    H.run(NS, 3);
    t += 3 / 60;
    if (G.cine && G.cine.kind !== 'docking') NS.cinematics.skip();
    if (G.run && G.run.ending && !hurtBy._end) hurtBy._end = G.run.ending + '@' + Math.round(t);
    if (!G.ship) break;
    if (G.run && G.run.op && trace.length < t) trace.push(G.run.op.pace.tension);
    if (process.env.TRACE === op.id && fights && Math.floor(t / 15) !== Math.floor((t - 0.05) / 15) && G.ship) {
      const bs = NS.aiBase.state().bases[0];
      console.log('T', Math.round(t), 'ship', Math.round(G.ship.x), Math.round(G.ship.y), 'hull', Math.round(G.ship.hull) + '/' + G.ship.maxHull, 'fuel', Math.round(G.ship.fuel),
        'base', bs && Math.round(bs.x), bs && Math.round(bs.y), 'dist', bs && Math.round(dist(G.ship, bs)), 'fleet', G.units.filter(u => u.alive && u.def.dmg).length,
        'cr', Math.round(G.save.credits), 'bld', G.base ? G.base.data.buildings.map(o => o.type.slice(0, 4) + (o.prog < 1 ? '*' : '')).join(',') : '-',
        'yardq', G.base && (G.base.data.buildings.find(o => o.type === 'shipyard') || {}).queue, 'stock', G.base && JSON.stringify(G.base.data.stock.bar), 'hold', JSON.stringify(G.run.freight.bar) + JSON.stringify(G.run.freight.comp),
        'hub', !!B.hub(), 'docked', G.run.docked, 'raid', (G.enemies.filter(o => o.alive && !o.def.structure && o.wave > 5000).map(o => o.type + '@' + Math.round(dist(o, G.ship))).join(',')), 'obj', (objective(op, G.ship) || {}).type);
    }
  }
  const o = G.run && G.run.op;
  let kills = 0;
  if (G.run) for (const k in G.run.razed) kills += G.run.razed[k];
  if (G.run) hurtBy._razed = JSON.stringify(G.run.razed);
  if (G.run && G.run.op) hurtBy._goals = NS.operation.progress().map(p => p.have + '/' + p.n).join(' ');
  const out = { id: op.id, mood: op.mood, won: !!o && o.status === 'won', why: o ? o.why : 'lost', time: Math.round(o ? o.t : t), kills: kills,
    fleet: G.units.filter(u => u.alive && u.side === 'player').length, peak: Math.max(0, ...trace), mean: trace.length ? trace.reduce((a, b) => a + b, 0) / trace.length : 0 };
  if (G.run) NS.trip.endTrip('dock');
  for (let i = 0; i < 10 && G.cine; ++i) NS.cinematics.skip();
  return out;
}

/* a pilot who has flown three belts: their operations cleared, credits, research and a warehouse */
function veteran(fights) {
  const s = G.save = NS.rules.freshSave();
  s.seenIntro = s.seenHelp = true;
  for (const z of ['kessler', 'amber', 'verdant']) for (const op of O.zoneOps(z)) O.finish(s, op, true, 60);
  s.licenses.push('amber', 'verdant', 'crimson');
  s.credits = 60000;
  s.stats.earned = 200000;
  s.unlocks.push('wing');
  s.store.comp = { alloy: 40, circuit: 20 };
  s.store.bar = { iron: 60, copper: 40, titanium: 30 };
  s.manifest.comp = { alloy: 8 };
  s.manifest.bar = { titanium: 8 };
  if (fights) {
    /* a fourth-belt pilot: the Wasp, its hull built up, lead lining against the storms */
    s.hulls.push('wasp');
    s.hull = 'wasp';
    s.weapons.owned = { pulse: 1, flak: 1, missile: 2 };
    s.weapons.slots = ['pulse', 'missile', null];
    s.credits += 40000;
    for (const id of ['hull', 'hull', 'hull', 'hull', 'laser', 'laser', 'thrust', 'fuel', 'fuel', 'fuel', 'fuel', 'fuel']) NS.rules.buyUpgrade(s, id);
    /* and the fuel kit the outer belts ask for: cells in the manifest */
    s.store.comp.fuelcell = 24;
    s.manifest.comp.fuelcell = 6;
    s.credits = 60000;
    s.rd = 160;
    s.rd = 300;
    for (const id of ['e_eff', 'e_eff', 'e_grip', 'e_scoop', 'e_scoop', 'e_cells', 'f_shield', 'f_shield', 'f_turret', 'f_impact', 'f_rad', 'f_rad', 'b_vaccine', 'b_vaccine', 't_dmg', 't_dmg', 't_range', 'c_build', 'b_firewall', 'b_emp', 'u_hp', 'u_dmg']) NS.rules.buyNode(s, id);
  }
  NS.save.refreshStats();
}

function campaign(fights, label, ops) {
  if (!ops) veteran(fights);
  const rows = [];
  for (const op of ops || O.zoneOps('crimson')) {
    let r = play(op, fights, 900), tries = 1;
    /* a loss eases the difficulty, so a few more tries find the level the bot can win at */
    while (!r.won && fights && tries < 5) { r = play(op, fights, 900); ++tries; }
    r.tries = tries;
    rows.push(r);
    if (process.env.FATE) console.log('  ' + op.id + ' ' + (r.won ? 'won' : 'lost ' + r.why) + ' kills ' + r.kills + ' fleet ' + r.fleet + ' hurt ' + JSON.stringify(hurtBy));
    for (const k in hurtBy) delete hurtBy[k];
    /* a wall it could not climb: counted as cleared so the rest of the belt is still played */
    if (!r.won && fights) { r.forced = true; O.finish(G.save, op, true, 900); }
  }
  console.log('\n' + label);
  console.log('op          mood  won  try  time  kills  fleet  peak  mean');
  for (const r of rows)
    console.log(r.id.padEnd(12) + r.mood.padEnd(6) + (r.won ? 'yes' : 'no').padEnd(5) + String(r.tries).padEnd(4) + String(r.time).padStart(5) + String(r.kills).padStart(7) +
      String(r.fleet).padStart(7) + r.peak.toFixed(2).padStart(6) + r.mean.toFixed(2).padStart(6));
  return rows;
}

const pro = campaign(true, 'Competent bot - Crimson Maw');
const by = id => pro.find(r => r.id === id) || { mean: 0, won: false, tries: 9 };
check('the competent bot clears at least six Crimson operations (retries allowed), the challenge and the breather among them', pro.length === 8 && pro.filter(r => r.won).length >= 6 && by('c_scout').won && by('c_raid').won, JSON.stringify(pro.map(r => r.id + ':' + r.won + ':' + r.why)));
check('the Citadel opens the Void Crown licence', O.licenceReady(G.save, 4));
check('the challenge and the breather are won at the first try', by('c_scout').tries === 1 && by('c_raid').tries === 1);
check('the peaks run hotter than the start of the belt', by('c_twin').mean > by('c_scout').mean && by('c_citadel').mean > by('c_scout').mean);

/* the Void Crown's fighting operations, flown on from the same career (the commander does not mine,
   escort or drill the Crown Heart, so Void Crystals, Survivors and The Crown are left out) */
if (G.save.licenses.indexOf('void') < 0) G.save.licenses.push('void');
const voidRows = campaign(true, 'Competent bot - Void Crown (fighting operations)', ['vc_ally', 'vc_base', 'vc_front', 'vc_war'].map(id => NS.opsData.OP_BY_ID[id]));
check('the commander holds out for the allied station or builds its Void base', voidRows.some(r => (r.id === 'vc_ally' || r.id === 'vc_base') && r.won), JSON.stringify(voidRows.map(r => r.id + ':' + r.won + ':' + r.tries)));
console.log('  difficulty level at the end: ' + G.save.skill.level.toFixed(2));

const weak = campaign(false, 'Weak bot - Crimson Maw (no fleet)');
const wby = id => weak.find(r => r.id === id) || { won: false };
check('a lone ship cannot take a fortress', !wby('c_twin').won && !wby('c_citadel').won);
check('a lone ship clears fewer operations than a commander with a fleet', weak.filter(r => r.won).length < pro.filter(r => r.won).length);

done();
