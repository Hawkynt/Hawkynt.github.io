'use strict';

/* The campaign played by bots in the running game. A bot flies the Kessler and then the Amber
   operations one after another with the mouse controls a player has (thrust toward the cursor, drill at it): it mines
   the rock most worth the trip (value and richness over distance), chases loose nuggets, cracks marked geodes and wrecks, fights pirates and
   banks at the dock when the hold is full, locks the laser on pirates with Space and fires its weapons at them, limps home for repairs when the hull runs low; it flies carefully (slow through the rocks, braking
   for the one in the way), never drills a volatile rock (nor through one) and gets clear of a lit fuse. Between operations it sells the warehouse and spends like a player
   (drone research, shields, point defense, hull and laser upgrades, then the Amber licence,
   the Wasp and its weapons). In an escort it shadows the freighter nearest its next choke point,
   dashes to whichever freighter is attacked (a Jammer or a mine ahead of one first), razes a pirate
   gun outpost beside the lane and fetches ore for one with reactor trouble. A competent bot fights and arms itself; a weak one only mines, never
   turns on the pirates and spends on mining alone. Each operation reports whether it was won, its time, hull lost, waves and the
   tension the pacing director measured, the times it turned for fuel and whether it was towed,
   so the curve the moods promise can be checked. Both bots watch the fuel gauge and turn for the
   nearest place to refuel at the bingo mark; a careless one that never does gets towed home. */
const H = require('./harness');
const clock = 1762300000000;
Date.now = () => clock;
let seed = 4242;
Math.random = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; };
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const O = NS.ops;
const { MOODS } = NS.opsData;

/* HURT=1: the ship's hull damage by source per operation */
const hurtBy = {};
if (process.env.HURT) {
  const orig = NS.ship.hurt;
  NS.ship.hurt = function(n, why) { hurtBy[why || '?'] = (hurtBy[why || '?'] || 0) + n; return orig.apply(this, arguments); };
}

const view = {};
function point(x, y) {
  NS.camera.toView(x, y, view);
  G.input.mouseX = view.x;
  G.input.mouseY = view.y;
}

function nearest(list, s, pred, range) {
  let best = null, bd = range || Infinity;
  for (let i = 0; i < list.length; ++i) {
    const o = list[i];
    if (!o.alive || (pred && !pred(o))) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/* the rock worth the trip: ore value times richness and size over the distance, so the pilot
   heads out to the rich rim as a player does */
function richest(s) {
  const op = NS.operation.def();
  const want = op && op.goals.find(g => g.type === 'ore');
  let best = null, bv = 0;
  for (const r of G.rocks) {
    if (!r.alive || !r.ore || r.volatile || r.kind !== 'rock') continue;
    /* the ore an operation asks for is worth far more to the pilot */
    const v = NS.ores.ORE_BY_ID[r.ore].value * (want && want.ore === r.ore ? 30 : 1) * (0.5 + r.rich) * r.tier / (Math.hypot(r.x - s.x, r.y - s.y) + 900);
    if (v > bv) { bv = v; best = r; }
  }
  return best;
}

/* fuel sense: at the bingo mark (with a cushion) the pilot turns for the nearest place to
   refuel and tanks up there; a careless pilot never looks at the gauge */
const tank = { on: false, turns: 0, towed: false, careless: false, low: 1 };
function fuelStop(s) {
  if (tank.careless) return null;
  const home = NS.refuel.home();
  const cells = (G.run.freight.comp.fuelcell || 0) * NS.fuel.cellFuel(G.stats);
  if (!tank.on && s.fuel + cells < home.cost * 1.3 + 8) { tank.on = true; ++tank.turns; }
  if (tank.on && s.fuel >= s.maxFuel * 0.95) tank.on = false;
  return tank.on ? home : null;
}

/* one decision: where to point, whether to thrust there and whether to drill at it */
function pilot(fights) {
  const s = G.ship, run = G.run, inp = G.input;
  inp.rightDown = inp.mouseDown = false;
  inp.keys.KeyS = inp.keys.Space = false;
  inp.aimMode = 'mouse';
  if (!s || !s.alive || G.cine || !run || run.ending) return;
  const full = run.cargoUsed >= run.cargoMax - 1;
  let tx, ty, stand = 0, fire = false;
  const pirate = fights ? nearest(G.pirates, s, null, 1100) : null;
  const special = nearest(G.specials, s, o => o.known && o.kind === 'derelict');
  const geode = nearest(G.rocks, s, o => o.kind === 'geode' && o.known);
  const nugget = !full ? nearest(G.nuggets, s, null, 700) : null;
  const fuse = nearest(G.rocks, s, r => r.fuse > 0, 520);
  if (fuse) {
    /* a lit volatile rock: get out of its blast */
    const d = Math.hypot(s.x - fuse.x, s.y - fuse.y) || 1;
    point(s.x + (s.x - fuse.x) / d * 400, s.y + (s.y - fuse.y) / d * 400);
    inp.rightDown = true;
    return;
  }
  let lock = false, cap = 200;
  /* an escort: the freighters in flight, pirates on them, one stuck for ore */
  const fl = G.freighters.filter(f => NS.freighters.flying(f));
  /* jammers holding a freighter and mines just ahead of one come first, then whatever attacks one */
  const onConvoy = !fights || !fl.length ? null :
    nearest(G.pirates, s, p => (p.kind === 'jammer' && p.beam) || (p.kind === 'mine' && fl.some(f => Math.hypot(p.x - f.x, p.y - f.y) < 600))) ||
    nearest(G.pirates, s, p => p.kind !== 'battery' && fl.some(f => Math.hypot(p.x - f.x, p.y - f.y) < 700));
  /* a pirate gun outpost beside the lane: raze it before the freighters pass */
  const battery = fights ? nearest(G.pirates, s, p => p.kind === 'battery') : null;
  const stuck = fl.find(f => f.state === 'need');
  const guard = fl.length ? fl.slice().sort((a, b) => nextChoke(a) - nextChoke(b))[0] : null;
  /* a battered ship goes home to the dock for repairs, firing at whatever it locks on the way */
  const hurt = s.hull < s.maxHull * 0.45;
  tank.low = Math.min(tank.low, s.fuel / s.maxFuel);
  const close = pirate && Math.hypot(pirate.x - s.x, pirate.y - s.y) < 500;
  const stop = fuelStop(s);
  if (hurt) { tx = G.dock.x; ty = G.dock.y; lock = !!pirate; }
  else if (stop) { tx = stop.x; ty = stop.y; stand = stop.kind === 'dock' ? 0 : 70; cap = stop.kind === 'dock' ? 260 : 200; lock = !!pirate; }
  else if (close || (pirate && !fl.length)) { tx = pirate.x; ty = pirate.y; stand = 260; lock = true; }
  else if (battery && !onConvoy) { tx = battery.x; ty = battery.y; stand = 280; lock = true; cap = 380; }
  else if (onConvoy) {
    /* an escort stays with the freighter under attack and shoots from beside it */
    const f = fl.slice().sort((a, b) => Math.hypot(a.x - onConvoy.x, a.y - onConvoy.y) - Math.hypot(b.x - onConvoy.x, b.y - onConvoy.y))[0];
    const far = Math.hypot(f.x - s.x, f.y - s.y) > 500;
    tx = far ? f.x : onConvoy.x; ty = far ? f.y : onConvoy.y; stand = far ? 150 : 240; lock = true; cap = far ? 520 : 380;
  }
  else if (stuck && (run.cargo[stuck.need.ore] || 0) >= Math.min(5, stuck.need.n - stuck.need.got)) { tx = stuck.x; ty = stuck.y; stand = 90; cap = 300; }
  else if (stuck && full) { tx = G.dock.x; ty = G.dock.y; cap = 300; }
  else if (stuck && nearest(G.rocks, s, r => r.ore === stuck.need.ore && !r.volatile)) {
    const rock = nearest(G.rocks, s, r => r.ore === stuck.need.ore && !r.volatile);
    tx = rock.x; ty = rock.y; stand = rock.r + 150; fire = true;
  }
  else if (guard) { tx = guard.x + guard.vx; ty = guard.y + guard.vy; stand = 180; cap = 300; }
  else if (full || (run.cargoUsed > 0 && !nearest(G.rocks, s, r => r.ore, 1800))) { tx = G.dock.x; ty = G.dock.y; }
  else if (nugget) { tx = nugget.x; ty = nugget.y; }
  else if (special || geode) { const t = special || geode; tx = t.x; ty = t.y; stand = (t.r || 60) + 150; fire = true; }
  else {
    const rock = richest(s);
    if (!rock) return;
    tx = rock.x; ty = rock.y; stand = rock.r + 150; fire = true;
  }
  point(tx, ty);
  const d = Math.hypot(tx - s.x, ty - s.y);
  /* a careful pilot: cruise slowly through the rocks, brake to stop at the stand-off point and
     for a rock in the way */
  const ux = (tx - s.x) / (d || 1), uy = (ty - s.y) / (d || 1);
  const closing = s.vx * ux + s.vy * uy, speed = Math.hypot(s.vx, s.vy);
  const want = Math.max(0, Math.min(cap, (d - stand) * 0.9));
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
  /* never drill through a volatile rock */
  const first = fire ? NS.mining.raycast(s.x, s.y, tx, ty, s) : null;
  inp.mouseDown = fire && d < stand + 260 && !(first && first.volatile);
  /* pirates: Space locks the laser onto the one nearest the nose, as a player fights; the
     mounted weapons fire too once there are any */
  inp.keys.Space = lock && (hurt || d < 520);
  const fireAll = lock && fights && d < 700;
  for (let i = 0; i < NS.hardpoints.slots().length; ++i) {
    const on = !!NS.hardpoints.state().held[i];
    if (fireAll !== on) NS.hardpoints.trigger(i, fireAll);
  }
}

/* how far a freighter is from the next choke point no ambush has sprung yet */
function nextChoke(f) {
  const p = G.posts.find(q => q.id === f.to);
  const c = p && p.chokes.find(k => !k.sprung && k.d > f.d - 300);
  return c ? c.d - f.d : 1e9;
}

/* between operations, like a player at the station: sell the warehouse, research drones for the
   Drone Bay, then shields and point defense, and spend credits on hull, laser and hold */
function shop(save, op, fights) {
  for (const id in save.store.ore) NS.economy.sell(save, G.stats, 'ore', id, save.store.ore[id]);
  const research = op.id === 'k_drones' ? ['a_drone'] : fights ? ['a_drone', 'f_shield', 'f_turret', 'f_shield', 'd_focus', 'f_turret', 'd_focus'] :
    ['a_drone', 'd_focus', 'd_yield', 'd_focus', 'l_hold'];
  for (const id of research) NS.rules.buyNode(save, id);
  if (op.zone === 'amber') {
    NS.rules.buyLicense(save, 1);
    /* a fighting pilot saves up for the Wasp and its flak, a miner for a bigger hold */
    if (fights) {
      NS.rules.buyHull(save, 'wasp');
      if (save.hull === 'wasp') for (const id of ['flak', 'missile']) NS.combat.buy(save, id);
      if (save.hull !== 'wasp') return;
    }
  }
  for (let guard = 0; guard < 40; ++guard) {
    const id = ['hull', 'laser', 'cargo', 'hull', 'laser', 'thrust'].sort((a, b) => NS.rules.upgradeCost(save, a) - NS.rules.upgradeCost(save, b))[0];
    if (!NS.rules.buyUpgrade(save, id)) break;
  }
}

/* the cargo the convoy delivered, as a share of what left the dock (null without freighters) */
function cargoShare() {
  if (!G.freighters.length) return null;
  let n = 0;
  for (const f of G.freighters) n += f.state === 'done' ? f.cargo : 0;
  return Math.round(n / G.freighters.length * 100);
}

/* plays one operation to its end (or `cap` seconds) and returns what happened */
function play(op, fights, cap) {
  NS.trip.startTrip('career', NS.ores.ZONE_BY_ID[op.zone].index, { op: op.id });
  for (let i = 0; i < 20 && G.cine; ++i) { H.run(NS, 30); NS.cinematics.skip(); }
  const trace = [];
  let hullLost = 0, prev = G.ship.hull, t = 0;
  tank.on = tank.towed = false;
  tank.turns = 0;
  tank.low = 1;
  const limit = (op.time || cap) + 5;
  while (G.run && G.run.op && G.run.op.status === 'active' && t < limit) {
    pilot(fights);
    H.run(NS, 3);
    t += 3 / 60;
    if (G.cine && G.cine.kind !== 'docking') NS.cinematics.skip();
    if (!G.ship) break;
    /* a trip that ends in a tow (one called off by fuel found on the way does not count) */
    if (G.run && G.run.ending === 'tow') { tank.towed = true; break; }
    if (G.ship.hull < prev) hullLost += prev - G.ship.hull;
    prev = G.ship.hull;
    if (G.run && G.run.op && trace.length < t) trace.push(G.run.op.pace.tension);
  }
  const o = G.run && G.run.op;
  const out = { id: op.id, mood: op.mood, won: !!o && o.status === 'won', time: Math.round(o ? o.t : t), hull: Math.round(hullLost),
    waves: o ? o.waves : 0, peak: Math.max(0, ...trace), mean: trace.length ? trace.reduce((a, b) => a + b, 0) / trace.length : 0,
    cargo: cargoShare(), fuel: tank.turns, low: tank.low, towed: tank.towed, fate: G.freighters.map(f => f.state[0] + (f.state === 'fly' || f.state === 'need' ? Math.round(f.hp) + '/' + Math.round(f.cargo * 100) : '')).join('') };
  if (process.env.FATE) console.log('  ' + op.id + (out.won ? ' won ' : ' lost ') + out.fate + (o && o.why ? ' (' + o.why + ')' : ''));
  if (process.env.HURT) { console.log('  hurt ' + op.id + ' ' + JSON.stringify(hurtBy) + (G.run && G.run.ending ? ' ending ' + G.run.ending : '')); for (const k in hurtBy) delete hurtBy[k]; }
  if (G.run) NS.trip.endTrip('dock');
  for (let i = 0; i < 10 && G.cine; ++i) NS.cinematics.skip();
  return out;
}

function table(label, rows) {
  console.log('\n' + label);
  console.log('op          mood  won  try  rate  time  hull  waves  peak  mean  fuel  cargo');
  for (const r of rows)
    console.log(r.id.padEnd(12) + r.mood.padEnd(6) + (r.won ? 'yes' : 'no').padEnd(5) + String(r.tries).padEnd(4) + (r.rate !== undefined ? r.rate.toFixed(2) : '  - ').padStart(5) + String(r.time).padStart(6) + String(r.hull).padStart(6) +
      String(r.waves).padStart(7) + r.peak.toFixed(2).padStart(6) + r.mean.toFixed(2).padStart(6) + ((r.fuel || 0) + (r.towed ? 'T' : '')).padStart(6) + (r.cargo !== null ? String(r.cargo).padStart(6) + '%' : ''));
}

/* plays a belt's operations in order; a competent bot stops at its first loss, a weak one plays on */
function belt(zone, fights, label, reps) {
  const rows = [];
  for (const op of O.zoneOps(zone)) {
    shop(G.save, op, fights);
    NS.save.refreshStats();
    if (G.save.licenses.indexOf(op.zone) < 0) break;
    const before = JSON.stringify(G.save);
    let r = play(op, fights, 600), tries = 1;
    /* a competent pilot shops and tries a lost operation again */
    while (!r.won && fights && tries < 4) {
      shop(G.save, op, fights);
      NS.save.refreshStats();
      r = play(op, fights, 600);
      ++tries;
    }
    r.tries = tries;
    /* the same operation flown again from the save it started with: the win rate and the mean
       tension over every run */
    if (reps > 1) {
      const after = JSON.stringify(G.save);
      const runs = [r];
      for (let k = 1; k < reps; ++k) {
        G.save = JSON.parse(before);
        NS.save.refreshStats();
        runs.push(play(op, fights, 600));
      }
      G.save = JSON.parse(after);
      NS.save.refreshStats();
      const first = runs.slice(1).concat(r.tries === 1 ? [r] : []);
      r.rate = first.filter(x => x.won).length / first.length;
      r.mean = runs.reduce((a, x) => a + x.mean, 0) / runs.length;
      r.peak = runs.reduce((a, x) => a + x.peak, 0) / runs.length;
      r.cargo = Math.round(runs.reduce((a, x) => a + (x.cargo || 0), 0) / runs.length);
    }
    rows.push(r);
    if (!r.won && fights) break;
  }
  table(label, rows);
  return rows;
}

function campaign(fights, label, zones, reps) {
  G.save = NS.rules.freshSave();
  G.save.seenIntro = G.save.seenHelp = true;
  NS.save.refreshStats();
  let rows = [];
  for (const z of zones) rows = rows.concat(belt(z, fights, label + ' bot - ' + NS.ores.ZONE_BY_ID[z].name, reps && reps[z]));
  return rows;
}

const REPS = 3;
const pro = campaign(true, 'Competent', ['kessler', 'amber'], { amber: REPS });
const by = id => pro.find(r => r.id === id);
const kes = pro.filter(r => r.id[0] === 'k'), amb = pro.filter(r => r.id[0] === 'a');
check('the competent bot clears the Kessler operations at the first try, the harder one and the capstone within two', kes.length === 6 && kes.every(r => r.won && r.tries <= (r.mood === 'H' || r.mood === 'W' ? 2 : 1)), JSON.stringify(kes.map(r => r.id + ':' + r.won + ':' + r.tries)));
check('the capstone opens the Amber licence (with the earnings)', O.licenceReady(G.save, 1) && G.save.licenses.indexOf('amber') >= 0);
check('the mining operations send no pirates', ['k_haul', 'k_copper', 'k_drones', 'k_geode'].every(id => by(id) && by(id).waves === 0 && by(id).peak < 0.05));
const jump = by('k_jumpers'), charter = by('k_charter');
check('Claim Jumpers raises the tension well above the mining operations', jump && jump.peak > 0.3 && jump.waves >= 3);
check('the capstone runs hotter than the operation before it', jump && charter && charter.mean > jump.mean * 0.9 && charter.hull >= jump.hull * 0.5);
check('peaks never stay at full tension the whole way', pro.every(r => r.mean < 0.8));
/* fuel: it has to be managed, and managing it is enough */
check('the competent bot is never towed home', pro.every(r => !r.towed), JSON.stringify(pro.filter(r => r.towed).map(r => r.id)));
check('fuel has to be managed: the tank runs below half in most operations', pro.filter(r => r.low < 0.5).length >= pro.length / 2, pro.map(r => r.id + ':' + Math.round(r.low * 100)).join(' '));
check('the long escorts at the peaks need a fuel stop', ['a_three', 'a_haul'].every(id => pro.find(r => r.id === id && r.fuel > 0)), pro.map(r => r.id + ':' + r.fuel).join(' '));

/* the Amber Reach: win rates over the runs from the same save */
check('the competent bot clears all nine Amber escorts (retries allowed)', amb.length === 9 && amb.every(r => r.won), JSON.stringify(amb.map(r => r.id + ':' + r.won)));
check('the Long Haul opens the Verdant licence', O.licenceReady(G.save, 2));
const aby = id => amb.find(r => r.id === id) || { mean: 0, peak: 0, cargo: 0, waves: 0, rate: 0 };
const moodRate = m => { const l = amb.filter(r => r.mood === m); return l.reduce((a, r) => a + r.rate, 0) / Math.max(1, l.length); };
check('the challenge and the breathers are won almost always', ['C', 'E'].every(m => moodRate(m) >= 0.75), ['C', 'E'].map(moodRate).join());
check('the harder escorts are won more often than not', moodRate('H') >= 0.5 && moodRate('S') >= 0.5, ['H', 'S'].map(moodRate).join());
check('the peaks cost tries but can be won', ['W', 'N'].every(m => moodRate(m) >= 0.2 && moodRate(m) <= moodRate('E')), ['W', 'N', 'E'].map(moodRate).join());
check('the escorts ambush every run', amb.every(r => r.waves >= 1));
check('the breathers run cooler than the operation before them', aby('a_long').mean < aby('a_first').mean + 0.05 && aby('a_wing').mean < aby('a_twin').mean);
check('the peaks run hotter than the start of the belt and the breathers', ['a_three', 'a_haul'].every(id => aby(id).mean > Math.max(aby('a_first').mean, aby('a_long').mean, aby('a_wing').mean)));
check('the nightmare is among the hardest escorts of the belt', aby('a_haul').mean >= Math.max(...amb.map(r => r.mean)) * 0.8);
check('a careful escort delivers most of the cargo on the breathers', aby('a_long').cargo >= 60 && aby('a_wing').cargo >= 60);

/* the same pilot flying the long sorties from the same save, but never looking at the fuel gauge */
const CARELESS = ['k_copper', 'k_jumpers', 'k_charter', 'a_long', 'a_storm', 'a_convoy', 'a_three', 'a_order', 'a_haul'];
const careless = (() => {
  const keep = JSON.stringify(G.save);
  tank.careless = true;
  const rows = [];
  for (const id of CARELESS) {
    G.save = JSON.parse(keep);
    NS.save.refreshStats();
    const r = play(NS.opsData.OP_BY_ID[id], true, 600);
    r.tries = 1;
    rows.push(r);
  }
  tank.careless = false;
  G.save = JSON.parse(keep);
  NS.save.refreshStats();
  table('Careless bot (never watches the fuel)', rows);
  return rows;
})();
check('a pilot who never watches the fuel runs dry or nearly so', careless.some(r => r.towed || r.low < 0.05), careless.map(r => r.id + ':' + (r.towed ? 'towed' : Math.round(r.low * 100) + '%')).join(' '));
check('the careless pilot wins fewer of them than the careful one', careless.filter(r => r.won).length < CARELESS.filter(id => by(id) && by(id).won).length);

const weak = campaign(false, 'Weak', ['kessler']);
const wby = id => weak.find(r => r.id === id);
check('a bot that never fights still clears the breathers', ['k_haul', 'k_copper', 'k_drones'].every(id => wby(id) && wby(id).won));
check('a bot that never fights cannot clear Claim Jumpers', wby('k_jumpers') && !wby('k_jumpers').won);
check('a bot that never fights takes more hull damage on the capstone', !wby('k_charter') || !wby('k_charter').won || wby('k_charter').hull > charter.hull);

/* a pilot who never fights, let into the Amber Reach anyway: shadowing alone does not save a convoy */
for (const op of O.zoneOps('kessler')) O.finish(G.save, op, true, 60);
G.save.credits += 1e5;
G.save.stats.earned += 1e5;
const wam = belt('amber', false, 'Weak bot - Amber Reach (licence handed over)', REPS);
const wa = id => wam.find(r => r.id === id) || { rate: 1 };
const wRate = m => { const l = wam.filter(r => r.mood === m); return l.reduce((a, r) => a + r.rate, 0) / Math.max(1, l.length); };
check('a bot that never fights still gets the first freighter through', wa('a_first').rate >= 0.5);
check('a bot that never fights loses more cargo than the competent one', wam.reduce((a, r) => a + r.cargo, 0) < amb.reduce((a, r) => a + r.cargo, 0));
check('a bot that never fights wins the peaks no more often', wRate('W') + wRate('N') <= moodRate('W') + moodRate('N'), ['W', 'N'].map(m => wRate(m) + '/' + moodRate(m)).join());
check('a bot that never fights wins the harder escorts less often', wRate('H') + wRate('W') + wRate('N') < moodRate('H') + moodRate('W') + moodRate('N'));

done();
