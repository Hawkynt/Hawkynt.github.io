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
   After the Crimson Maw it flies the Void Crown: the ship mines, escorts or drills the Crown Heart
   as each operation asks; the commander gathers an army (gunboats, Bulwarks, Lancers) at a staging
   point and takes a base apart - factories, batteries, towers, pylons, then the goal. A playtest tool, not part of
   the test run (run: node tests/playtest/rts-campaign.js). */
const H = require('../harness');
Date.now = () => 1762300000000;
let seed = 31337;
Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
H.installEnv();
const NS = H.load();
const { done } = H;
let check = H.check;
const G = NS.state;
const B = NS.base;
const O = NS.ops;

const hurtBy = {};
{
  const orig = NS.ship.hurt;
  NS.ship.hurt = function(n, why) {
    hurtBy[why] = (hurtBy[why] || 0) + n;
    if (process.env.WHO === '2' && G.ship && G.ship.hull - n <= 0) {
      const sh = G.ship;
      console.log('    DEATH by ' + why + ' at ' + Math.round(sh.x) + ',' + Math.round(sh.y) + ' near ' + G.enemies.concat(G.pirates).filter(o => o.alive && dist(o, sh) < 900).map(o => (o.type || o.kind) + '@' + Math.round(dist(o, sh)) + (o.front ? 'F' : '') + (o.wave ? 'W' + o.wave : '') + (o.base !== undefined ? 'B' : '') + (o.def ? o.def.faction : '')).join(',').slice(0, 300) + ' hub ' + (B.hub() ? Math.round(dist(B.hub(), sh)) : '-') + ' tanking ' + tanking + ' fuel ' + Math.round(sh.fuel));
    }
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
const goalOf = (op, type) => op.goals.find(g => g.type === type);

/* the ship: haulers first in a freighter hunt, then threats to the outpost, then the objective */
let tanking = false;
let lastWhy = '';
const saved = {};
function pilot(op, fights) {
  const s = G.ship, run = G.run, inp = G.input;
  inp.rightDown = inp.mouseDown = false;
  inp.keys.KeyS = inp.keys.Space = false;
  inp.aimMode = 'mouse';
  if (!s || !s.alive || G.cine || !run || run.ending) return;
  /* an abandoned outpost is no home: it has gone to the Bloom */
  /* an abandoned outpost, or one whose turrets have turned on you, is no home */
  const rogueGuns = G.base && G.base.data.buildings.some(o => o.rogue && NS.colonyData.BUILDING_BY_ID[o.type].range);
  const h = G.base && (G.base.data.abandoned || rogueGuns) ? null : B.hub();
  const fleet = G.units.filter(u => u.alive && u.side === 'player' && u.def.dmg);
  let tx, ty, stand = 260, cap = 300, lock = false, fire = false;
  const crown = G.rocks.find(r => r.kind === 'crown' && r.alive);
  const fl = G.freighters.filter(f => NS.freighters.flying(f));
  const guardF = fl.find(f => !f.alone) || fl.find(f => f.alone > 0);
  const dueF = G.freighters.find(f => f.state === 'wait' && f.wait < 8);
  const hauler = nearest(G.enemies, s, o => o.type === 'hauler');
  /* raiders at home: attack groups, and pirates that jumped a supply freighter */
  const raid = h ? nearest(G.enemies, h, o => !o.def.structure && o.wave > 5000 && (!o.def.cloaked || o.seenT > 0), 1200) || nearest(G.pirates, h, o => o.alive && o.kind !== 'mine', 1000) : null;
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
  else if (hauler && (op.goals.some(g => g.type === 'raze' && g.of.indexOf('hauler') >= 0) || (op.syndicate && op.syndicate.escape))) { tx = hauler.x; ty = hauler.y; stand = 200; lock = true; cap = 520; }
  else if (goalOf(op, 'crown') && crown) {
    /* drill the Crown Heart; turn on whatever closes in */
    const foe = nearest(G.enemies, s, o => !o.dormant && !o.def.structure && (!o.def.cloaked || o.seenT > 0), 320);
    if (foe) { tx = foe.x; ty = foe.y; stand = 200; lock = true; } else { tx = crown.x; ty = crown.y; stand = crown.r + 150; fire = true; }
  }
  else if (goalOf(op, 'hold') && G.allies.some(a => a.alive)) {
    /* a station under siege: stand by it, shoot what closes in on it */
    const st = nearest(G.allies, s, a => a.alive);
    const foe = nearest(G.enemies.concat(G.pirates), st, o => o.alive && !o.dormant && (!o.def || !o.def.structure) && (!o.def || !o.def.cloaked || o.seenT > 0), 800);
    if (foe) { tx = foe.x; ty = foe.y; stand = 220; lock = true; cap = 420; } else { tx = st.x; ty = st.y; stand = st.r + 160; cap = 320; }
  }
  else if (goalOf(op, 'deliver') && (guardF || dueF)) {
    /* escort: stay with the freighter in flight, shoot what goes for it; be there when one is due */
    const f = guardF || dueF;
    const foe = nearest(G.enemies.concat(G.pirates), f, o => o.alive && !o.dormant && (!o.def || !o.def.structure), 700);
    if (foe) { tx = foe.x; ty = foe.y; stand = 220; lock = true; cap = 420; } else { tx = f.x + (f.vx || 0); ty = f.y + (f.vy || 0); stand = 180; cap = 320; }
  }
  else if (goalOf(op, 'ore')) {
    /* mine the ore the operation asks for; bank it when the hold is full */
    const want = goalOf(op, 'ore').ore;
    const foe = nearest(G.enemies.concat(G.pirates), s, o => o.alive && !o.dormant && (!o.def || !o.def.structure), 450);
    const rock = nearest(G.rocks, s, r => r.kind === 'rock' && r.ore === want && !r.volatile) || nearest(G.rocks, s, r => r.kind === 'rock' && r.ore && !r.volatile);
    const nug = nearest(G.nuggets || [], s, n => n.alive, 600);
    if (foe) { tx = foe.x; ty = foe.y; stand = 220; lock = true; }
    else if (run.cargoUsed >= run.cargoMax - 1) { tx = G.dock.x; ty = G.dock.y; stand = 0; cap = 260; }
    else if (nug) { tx = nug.x; ty = nug.y; stand = 0; cap = 220; }
    else if (rock) { tx = rock.x; ty = rock.y; stand = rock.r + 150; fire = true; }
  }
  else if (raid && fights) { tx = raid.x; ty = raid.y; lock = true; }
  else if (obj && (fights ? fleet.filter(u => u.orders.length).length >= 3 || (!NS.aiBase.scouted() && op.goals.some(g => g.type === 'scout')) || (!isCore(obj) && defenders(obj) === 0) : true)) {
    const moving = fleet.filter(u => u.orders.length);
    const c = moving.length ? { x: moving.reduce((a, u) => a + u.x, 0) / moving.length, y: moving.reduce((a, u) => a + u.y, 0) / moving.length } : obj;
    /* with the fleet: a little behind its middle; alone: go for it */
    let go = moving.length >= 3 ? c : obj;
    /* against a defended goal the ship hangs back behind the fleet, out of the towers' reach */
    if (moving.length >= 3 && (isCore(obj) || defenders(obj) > 0)) {
      const back = h || G.dock, bd = Math.hypot(back.x - c.x, back.y - c.y) || 1;
      go = { x: c.x + (back.x - c.x) / bd * 450, y: c.y + (back.y - c.y) / bd * 450 };
    }
    tx = go.x; ty = go.y; stand = moving.length >= 3 ? 80 : 320; lock = true;
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
  /* the laser and the weapons answer whatever hostile comes in reach, always */
  const aim = nearest(G.enemies.concat(G.pirates), s, o => o.alive && !o.dormant && (!o.def || !o.def.structure || lock) && (!o.def || !o.def.cloaked || o.seenT > 0), lock ? 650 : 520);
  inp.keys.Space = !!aim;
  /* drilling: the laser at the rock (never through a volatile one) */
  if (fire && !aim) {
    const first = NS.mining.raycast(s.x, s.y, tx, ty, s);
    inp.mouseDown = d < stand + 260 && !(first && first.volatile);
  }
  for (let i = 0; i < NS.hardpoints.slots().length; ++i) {
    const on = !!NS.hardpoints.state().held[i];
    if (!!aim !== on) NS.hardpoints.trigger(i, !!aim);
  }
}

const PLAN = ['solar', 'solar', 'laser', 'habitat', 'solar', 'shipyard', 'laser', 'habitat', 'solar', 'flak', 'repairbay', 'laser', 'tesla', 'solar', 'habitat', 'laser', 'missile'];
/* an army that outranges the defences: Bulwarks (640 px siege) and Lancers to break structures,
   gunboats to hold, an Aegis to shield the push, a few fighters for the Stalkers */
const HEAVY = ['bulwark', 'gunboat', 'lancer', 'bulwark', 'gunboat', 'aegis', 'lancer'];
let supplyShort = false;

/* the order a base is taken apart in: what makes units, what outranges, what shoots, what shields */
const PRIORITY = ['syn_factory', 'syn_battery', 'syn_tower', 'syn_pylon'];
const war = { attacking: false, marching: false, start: 0, since: 0 };

/* the next thing to hit on the way to the goal: its defences first, then the goal itself */
function stepTarget(goal, from) {
  /* peel the base from the outside: the defence nearest the approach (factories, batteries, towers,
     pylons within 900 px of the goal), then the goal itself */
  const near = G.enemies.filter(o => o.alive && PRIORITY.indexOf(o.type) >= 0 && dist(o, goal) < 900 && (!o.def.cloaked || o.seenT > 0));
  if (!near.length) return goal;
  const p = from || goal;
  return near.sort((a, b) => dist(a, p) - dist(b, p))[0];
}

/* where the army stops before the push: 1,400 px short of the goal, on the way from home */
function staging(goal, home) {
  const d = dist(goal, home) || 1;
  const k = Math.min(1, 1400 / d);
  return { x: goal.x + (home.x - goal.x) * k, y: goal.y + (home.y - goal.y) * k };
}

/* defenders round a goal: towers and batteries within 900 px */
function defenders(goal) {
  return G.enemies.filter(o => o.alive && (o.type === 'syn_tower' || o.type === 'syn_battery' || o.type === 'citadel') && dist(o, goal) < 900).length;
}

/* the army: defend the outpost (or the allied station), else gather and break the goal */
function army(op, h) {
  const fleet = G.units.filter(u => u.alive && u.side === 'player' && u.def.dmg);
  if (!fleet.length) { war.attacking = false; return; }
  const idle = fleet.filter(u => !u.orders.length);
  const ally = G.allies.find(a => a.alive);
  const guard = ally || h;
  /* raiders at home or at the station come first */
  const raid = nearest(G.enemies, guard, o => !o.def.structure && !o.dormant && (!o.def.cloaked || o.seenT > 0), ally ? 1000 : 900);
  /* while gathering, idle craft see off raiders; once marching or pushing, the turrets hold home */
  if (raid && !war.attacking && !war.marching && idle.length) NS.command.order('amove', raid.x, raid.y, null, false, idle);
  if (raid && !objective(op, h)) return;
  /* haulers getting away lose the run: the fast craft chase them (all of them when that is the goal) */
  const huntOnly = op.goals.some(g => g.type === 'raze' && g.of.indexOf('hauler') >= 0);
  if (huntOnly || (op.syndicate && op.syndicate.escape)) {
    const hauler = nearest(G.enemies, h, o => o.type === 'hauler');
    if (hauler) {
      const fast = fleet.slice().sort((a, b) => b.def.speed - a.def.speed).slice(0, huntOnly ? fleet.length : 3);
      const free = fast.filter(u => !u.orders.length || u.orders[0].kind !== 'attack' || !u.orders[0].target || !u.orders[0].target.alive);
      if (free.length) NS.command.order('attack', hauler.x, hauler.y, hauler, false, free);
      if (huntOnly) return;
    }
    if (huntOnly) return;
  }
  const goal = objective(op, h);
  if (!goal) {
    /* nothing to break: hold by the station or the hub */
    if (idle.length && guard && idle.some(u => dist(u, guard) > 350)) NS.command.order('move', guard.x, guard.y + 120, null, false, idle);
    return;
  }
  const st = staging(goal, h);
  /* the force a goal takes: a core a real army, a lone structure a few craft */
  const def = defenders(goal);
  const need = isCore(goal) ? Math.min(14, 5 + 2 * def) : def ? Math.min(10, 4 + def) : 3;
  const patience = op.time ? 60 : 150;
  if (!war.attacking) {
    war.since += 1;
    if (!war.marching) {
      /* gather at home, out of the enemy's reach */
      const home = fleet.filter(u => dist(u, h) < 1100);
      if (idle.length && !raid) NS.command.order('move', h.x, h.y + 160, null, false, idle.filter(u => dist(u, h) > 400));
      /* at the supply cap no more craft come: go with what gathered */
      const capped = supplyShort && home.length >= Math.ceil(fleet.length * 0.8) && home.length >= 6;
      if (home.length >= need || capped || (home.length >= Math.ceil(need * 0.7) && war.since > patience)) { war.marching = true; war.since = 0; NS.command.order('move', st.x, st.y, null, false, home); }
      return;
    }
    /* march together; push once most have arrived (or after forty seconds) */
    const there = fleet.filter(u => dist(u, st) < 600);
    if (there.length >= Math.ceil(fleet.length * 0.7) || war.since > 40) { war.attacking = true; war.marching = false; war.start = fleet.length; war.since = 0; }
    else if (idle.length) NS.command.order('move', st.x, st.y, null, false, idle);
    return;
  }
  /* the push: everyone on the next target; fall back to regroup when it has bled out */
  const alive = fleet.length;
  /* fall back to regroup when the push has bled out - unless the goal is nearly down */
  if (alive < Math.max(3, war.start * 0.4) && goal.hp > goal.maxHp * 0.35) { war.attacking = false; war.marching = false; war.since = 0; NS.command.order('move', h.x, h.y + 160, null, false, fleet); return; }
  const t = stepTarget(goal, st);
  /* siege craft fire on the structure itself; the rest attack-move alongside and screen them */
  const siege = fleet.filter(u => (u.type === 'bulwark' || u.type === 'lancer') && !(u.orders[0] && u.orders[0].kind === 'attack' && u.orders[0].target === t));
  if (siege.length) NS.command.order('attack', t.x, t.y, t, false, siege);
  const lazy = fleet.filter(u => u.type !== 'bulwark' && u.type !== 'lancer' && (!u.orders.length || u.orders[0].kind === 'move'));
  if (lazy.length) NS.command.order('amove', t.x, t.y, null, false, lazy);
}

/* the commander: build, supply, produce, attack */
function command(op, fights) {
  if (!G.base || G.cine) return;
  const b = G.base;
  /* an outpost lost and abandoned: reclaim it first (800 credits), as a player would from the hub */
  if (b.data.abandoned) { B.reclaim(); return; }
  if (!B.claimed()) { B.place('hub', b.site.hubX, b.site.hubY); return; }
  const h = B.hub();
  if (!h || h.prog < 1) return;
  if (b.data.crew + 2 <= NS.colony.housing(b.data) && G.save.credits > 1500) B.recruit();
  /* Lattice corruption: purge what has turned or is far gone (a circuit each), as a player would */
  for (const o of b.data.buildings) if ((o.rogue || (o.cor || 0) > 0.5) && (b.data.stock.comp.circuit || 0) > 0) B.purge(o);
  /* no circuit to spare and a turret turned on you: tear it down */
  for (const o of b.data.buildings.slice()) if (o.rogue && NS.colonyData.BUILDING_BY_ID[o.type].range && !(b.data.stock.comp.circuit > 0)) B.demolish(o);
  if ((b.data.stock.comp.circuit || 0) < 2 && b.data.buildings.some(o => o.rogue || (o.cor || 0) > 0.2) && NS.freighters.shipments() < NS.supply.SHIP_MAX) NS.freighters.order('parts');
  if (fights) {
    const yard = b.data.buildings.find(o => o.type === 'shipyard' && o.prog >= 1);
    /* titanium bars and alloy plate for the heavy craft: keep a parts shipment coming */
    const st = b.data.stock;
    if ((st.bar.titanium || 0) < 8 && G.save.credits > 1500 && NS.freighters.shipments() < NS.supply.SHIP_MAX) NS.freighters.order('parts');
    if (yard && (yard.queue || []).length < 2) {
      /* heavy craft first; fighters only as a small screen against the Stalkers */
      const n = G.units.filter(u => u.alive && u.side === 'player').length;
      let queued = false, why = '';
      for (let k = 0; k < HEAVY.length && !queued; ++k) { const r = B.queueUnit(yard, HEAVY[(n + k) % HEAVY.length]); queued = r.ok; why = why || r.reason || ''; }
      const fighters = G.units.filter(u => u.alive && u.side === 'player' && u.type === 'fighter').length;
      if (!queued && fighters < 4) queued = B.queueUnit(yard, 'fighter').ok;
      supplyShort = /supply/i.test(why);
      lastWhy = queued ? '' : why;
    }
    army(op, h);
  }
  if (b.data.buildings.filter(o => o.prog < 1).length >= 2) return;
  /* the yard waits on titanium: the army comes before more buildings */
  if (fights && (b.data.stock.bar.titanium || 0) < 4 && G.save.credits < 8000 && b.data.buildings.some(o => o.type === 'shipyard') && !supplyShort) return;
  /* fleet supply full: another habitat (and the power for it) */
  const plan = fights ? PLAN.concat(supplyShort ? ['habitat', 'solar', 'habitat', 'solar', 'habitat'] : []) : ['solar', 'laser'];
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
  /* SAVE_AT=c_citadel,vc_war writes the career to SAVE_DIR (default .) as the commander first reaches those operations */
  if (process.env.SAVE_AT && fights && !saved[op.id] && process.env.SAVE_AT.split(',').indexOf(op.id) >= 0 && (saved[op.id] = true))
    require('fs').writeFileSync(require('path').join(process.env.SAVE_DIR || '.', 'save-' + op.id + '.json'), JSON.stringify(G.save));
  NS.trip.startTrip('career', NS.ores.ZONE_BY_ID[op.zone].index, { op: op.id });
  for (let i = 0; i < 20 && G.cine; ++i) { H.run(NS, 30); NS.cinematics.skip(); }
  const trace = [];
  let t = 0, tick = 0;
  war.attacking = false; war.marching = false; war.since = 0; tanking = false;
  /* craft from the last trip still carry its orders: a new operation, new orders */
  for (const u of G.units) if (u.side === 'player') u.orders.length = 0;
  while (G.run && G.run.op && G.run.op.status === 'active' && t < cap) {
    pilot(op, fights);
    if (++tick % 20 === 0) command(op, fights);
    H.run(NS, 3);
    t += 3 / 60;
    if (G.cine && G.cine.kind !== 'docking') NS.cinematics.skip();
    if (G.run && G.run.ending && !hurtBy._end) hurtBy._end = G.run.ending + '@' + Math.round(t);
    /* FATE=2: the first seconds of every try, to see what greets the ship */
    if (process.env.FATE === '2' && t < 20 && Math.floor(t / 4) !== Math.floor((t - 0.05) / 4) && G.ship) {
      const sh = G.ship, near = G.enemies.concat(G.pirates).filter(e => e.alive && dist(e, sh) < 800).map(e => (e.type || e.kind) + '@' + Math.round(dist(e, sh))).join(',');
      console.log('    open ' + op.id + ' ' + Math.round(t) + ' hull ' + Math.round(sh.hull) + ' at ' + Math.round(sh.x) + ',' + Math.round(sh.y) + ' near ' + near.slice(0, 140) + ' hub ' + !!B.hub() + ' base ' + (G.base && G.base.data.abandoned ? 'abandoned' : 'ok'));
    }
    if (!G.ship) break;
    if (G.run && G.run.op && trace.length < t) trace.push(G.run.op.pace.tension);
    if (process.env.TRACE2 === op.id && Math.floor(t / 30) !== Math.floor((t - 0.05) / 30)) {
      const cit = G.enemies.find(o => o.alive && (o.type === 'citadel' || o.type === 'syn_core'));
      const syn = G.enemies.filter(o => o.alive && o.def.faction === 'syndicate');
      console.log('T2', Math.round(t), 'units', JSON.stringify(G.units.filter(u => u.alive && u.side === 'player').reduce((m, u) => (m[u.type] = (m[u.type] || 0) + 1, m), {})), 'war', war.attacking ? 'atk' : war.marching ? 'march' : 'home',
        'cit', cit ? Math.round(cit.hp) + '/' + Math.round(cit.shield || 0) : '-', 'syn', JSON.stringify(syn.reduce((m, o) => (m[o.type] = (m[o.type] || 0) + 1, m), {})),
        'cr', Math.round(G.save.credits), 'ti', G.base && G.base.data.stock.bar.titanium, 'yq', G.base && JSON.stringify((G.base.data.buildings.find(o => o.type === 'shipyard') || {}).queue), 'ship', G.ship && Math.round(G.ship.hull), 'why', lastWhy, 'bld', G.base ? G.base.data.buildings.length : 0, 'sup', G.base ? NS.colony.supplyCap(G.base.data, G.stats) : 0);
    }
    if (process.env.TRACE === op.id && fights && Math.floor(t / 15) !== Math.floor((t - 0.05) / 15) && G.ship) {
      const bs = NS.aiBase.state().bases[0];
      console.log('T', Math.round(t), 'ship', Math.round(G.ship.x), Math.round(G.ship.y), 'hull', Math.round(G.ship.hull) + '/' + G.ship.maxHull, 'fuel', Math.round(G.ship.fuel),
        'base', bs && Math.round(bs.x), bs && Math.round(bs.y), 'dist', bs && Math.round(dist(G.ship, bs)), 'fleet', G.units.filter(u => u.alive && u.def.dmg).length,
        'cr', Math.round(G.save.credits), 'bld', G.base ? G.base.data.buildings.map(o => o.type.slice(0, 4) + (o.prog < 1 ? '*' : '')).join(',') : '-',
        'yardq', G.base && (G.base.data.buildings.find(o => o.type === 'shipyard') || {}).queue, 'stock', G.base && JSON.stringify(G.base.data.stock.bar), 'hold', JSON.stringify(G.run.freight.bar) + JSON.stringify(G.run.freight.comp),
        'hub', !!B.hub(), 'docked', G.run.docked, 'raid', (G.enemies.filter(o => o.alive && !o.def.structure && o.wave > 5000).map(o => o.type + '@' + Math.round(dist(o, G.ship))).join(',')), 'obj', (objective(op, G.ship) || {}).type, 'war', JSON.stringify(war), 'units', JSON.stringify(G.units.filter(u => u.alive && u.side === 'player').reduce((m, u) => (m[u.type] = (m[u.type] || 0) + 1, m), {})),
        'supply', NS.base.supply ? JSON.stringify(NS.base.supply()) : '', 'ore', G.base && JSON.stringify(G.base.data.stock.ore), 'comp', G.base && JSON.stringify(G.base.data.stock.comp));
    }
  }
  const o = G.run && G.run.op;
  if (process.env.FATE) console.log('    try ' + op.id + ' ' + Math.round(t) + ' s ' + (o ? o.status + (o.why ? ' ' + o.why : '') : 'trip over') + (hurtBy._end ? ' ' + hurtBy._end : '') + ' lvl ' + (G.save.skill || {}).level);
  delete hurtBy._end;
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
  s.credits = 120000;
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
    s.credits = 120000;
    s.rd = 160;
    s.rd = 300;
    for (const id of ['e_eff', 'e_eff', 'e_grip', 'e_scoop', 'e_scoop', 'e_cells', 'f_shield', 'f_shield', 'f_turret', 'f_impact', 'f_rad', 'f_rad', 'b_vaccine', 'b_vaccine', 't_dmg', 't_dmg', 't_range', 'c_build', 'b_firewall', 'b_emp', 'u_hp', 'u_dmg']) NS.rules.buyNode(s, id);
  }
  NS.save.refreshStats();
}

/* ONLY=c_citadel,vc_war plays just those operations (the rest count as cleared), LVL=1.6 starts there */
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
function campaign(fights, label, ops) {
  if (!ops) {
    veteran(fights);
    /* FROM=save-c_citadel.json plays on from a written career */
    if (process.env.FROM && fights) { G.save = NS.rules.migrateSave(JSON.parse(require('fs').readFileSync(process.env.FROM, 'utf8'))); NS.save.refreshStats(); }
    if (process.env.LVL) G.save.skill.level = +process.env.LVL;
  }
  const rows = [];
  for (const op of ops || O.zoneOps('crimson')) {
    if (ONLY && ONLY.indexOf(op.id) < 0) { O.finish(G.save, op, true, 60); continue; }
    /* peaks get longer budgets: no clock of their own, and a fortress takes time */
    const cap = op.mood === 'N' ? 1500 : op.mood === 'W' ? 1200 : 900;
    /* between operations a pilot flies mining trips and comes back with some 30,000 credits; the bot
       does not mine, so it is paid them */
    const topUp = () => {
      const sv = G.save;
      while (sv.credits < 30000) { sv.credits += 10000; sv.stats.earned += 10000; }
      /* and banks what a fleet needs: titanium and iron bars, alloy, circuits, fuel cells - and loads them */
      const need = { bar: { titanium: 30, iron: 60 }, comp: { alloy: 40, circuit: 20, fuelcell: 24 } };
      for (const k in need) for (const id in need[k]) sv.store[k][id] = Math.max(sv.store[k][id] || 0, need[k][id]);
      sv.manifest.bar.titanium = Math.max(sv.manifest.bar.titanium || 0, 8);
      sv.manifest.comp.alloy = Math.max(sv.manifest.comp.alloy || 0, 8);
      sv.manifest.comp.fuelcell = Math.max(sv.manifest.comp.fuelcell || 0, 6);
    };
    topUp();
    let r = play(op, fights, cap), tries = 1;
    /* a loss eases the difficulty, so a few more tries find the level the bot can win at */
    while (!r.won && fights && tries < 5) { topUp(); r = play(op, fights, cap); ++tries; }
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
if (ONLY) check = () => {};
const by = id => pro.find(r => r.id === id) || { mean: 0, peak: 0, won: false, tries: 9 };
check('the competent bot clears at least six Crimson operations (retries allowed), the challenge and the breather among them', pro.length === 8 && pro.filter(r => r.won).length >= 6 && by('c_scout').won && by('c_raid').won, JSON.stringify(pro.map(r => r.id + ':' + r.won + ':' + r.why)));
check('the Citadel opens the Void Crown licence', O.licenceReady(G.save, 4));
check('the challenge and the breather are won at the first try', by('c_scout').tries === 1 && by('c_raid').tries === 1);
check('the peaks run hotter than the start of the belt (peak tension: a siege gathers quietly between its battles)', by('c_twin').peak > by('c_scout').peak && by('c_citadel').peak > by('c_scout').peak);

/* the Void Crown, flown on from the same career: the ship mines, escorts and drills the Crown Heart
   as the operation asks, the commander builds, defends and breaks bases */
if (G.save.licenses.indexOf('void') < 0) G.save.licenses.push('void');
/* a pilot reaching the Void flies the Leviathan, its hull and laser built up */
{
  const sv = G.save;
  if (sv.hulls.indexOf('leviathan') < 0) sv.hulls.push('leviathan');
  sv.hull = 'leviathan';
  sv.credits += 200000;
  for (const id of ['hull', 'hull', 'hull', 'hull', 'hull', 'laser', 'laser', 'laser', 'fuel', 'fuel']) NS.rules.buyUpgrade(sv, id);
  sv.credits = Math.max(sv.credits - 150000, 40000);
  NS.save.refreshStats();
}
const voidRows = campaign(true, 'Competent bot - Void Crown', O.zoneOps('void'));
const vby = id => voidRows.find(r => r.id === id) || { won: false };
check('the commander clears at least five of the seven Void operations (retries allowed)', voidRows.filter(r => r.won).length >= 5, JSON.stringify(voidRows.map(r => r.id + ':' + r.won + ':' + r.tries)));
check('the challenge and the breather of the Void are won', vby('vc_hunt').won && vby('vc_base').won);
console.log('  difficulty level at the end: ' + G.save.skill.level.toFixed(2));

const weak = ONLY ? [] : campaign(false, 'Weak bot - Crimson Maw (no fleet)');
const wby = id => weak.find(r => r.id === id) || { won: false };
check('a lone ship cannot take a fortress', !wby('c_twin').won && !wby('c_citadel').won);
check('a lone ship clears fewer operations than a commander with a fleet', weak.filter(r => r.won).length < pro.filter(r => r.won).length);

done();
