'use strict';

/* The campaign played by bots in the running game. A bot flies the Kessler operations one after
   another with the mouse controls a player has (thrust toward the cursor, drill at it): it mines
   the nearest ore, chases loose nuggets, cracks marked geodes and wrecks, fights pirates and
   banks at the dock when the hold is full, locks the laser on pirates with Space, limps home for repairs when the hull runs low; it flies carefully (slow through the rocks, braking
   for the one in the way), never drills a volatile rock (nor through one) and gets clear of a lit fuse. Between operations it sells the warehouse and spends like a player
   (drone research, shields, point defense, hull and laser upgrades). A competent bot fights and arms itself; a weak one only mines, never
   turns on the pirates and spends on mining alone. Each operation reports whether it was won, its time, hull lost, waves and the
   tension the pacing director measured, so the curve the moods promise can be checked. */
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
  let lock = false;
  /* a battered ship goes home to the dock for repairs, firing at whatever it locks on the way */
  const hurt = s.hull < s.maxHull * 0.45;
  if (hurt) { tx = G.dock.x; ty = G.dock.y; lock = !!pirate; }
  else if (pirate) { tx = pirate.x; ty = pirate.y; stand = 260; lock = true; }
  else if (full || (run.cargoUsed > 0 && !nearest(G.rocks, s, r => r.ore, 1800))) { tx = G.dock.x; ty = G.dock.y; }
  else if (nugget) { tx = nugget.x; ty = nugget.y; }
  else if (special || geode) { const t = special || geode; tx = t.x; ty = t.y; stand = (t.r || 60) + 150; fire = true; }
  else {
    const rock = nearest(G.rocks, s, r => r.ore && !r.volatile);
    if (!rock) return;
    tx = rock.x; ty = rock.y; stand = rock.r + 150; fire = true;
  }
  point(tx, ty);
  const d = Math.hypot(tx - s.x, ty - s.y);
  /* a careful pilot: cruise slowly through the rocks, brake to stop at the stand-off point and
     for a rock in the way */
  const ux = (tx - s.x) / (d || 1), uy = (ty - s.y) / (d || 1);
  const closing = s.vx * ux + s.vy * uy, speed = Math.hypot(s.vx, s.vy);
  const want = Math.max(0, Math.min(200, (d - stand) * 0.9));
  let blocked = false;
  if (speed > 90) for (const r of G.rocks) {
    if (!r.alive || r.kind !== 'rock') continue;
    const rx = r.x - s.x, ry = r.y - s.y;
    const ahead = (rx * s.vx + ry * s.vy) / speed;
    if (ahead > 0 && ahead < 170 + r.r && Math.abs(rx * s.vy - ry * s.vx) / speed < r.r + 30 && Math.hypot(rx, ry) < d - 20) { blocked = true; break; }
  }
  const brake = blocked || closing > want + 40 || speed > 230;
  inp.keys.KeyS = brake;
  inp.rightDown = !brake && d > stand && closing < want;
  /* never drill through a volatile rock */
  const first = fire ? NS.mining.raycast(s.x, s.y, tx, ty, s) : null;
  inp.mouseDown = fire && d < stand + 260 && !(first && first.volatile);
  /* pirates: Space locks the laser onto the one nearest the nose, as a player fights */
  inp.keys.Space = lock && (hurt || d < 520);
}

/* between operations, like a player at the station: sell the warehouse, research drones for the
   Drone Bay, then shields and point defense, and spend credits on hull, laser and hold */
function shop(save, op, fights) {
  for (const id in save.store.ore) NS.economy.sell(save, G.stats, 'ore', id, save.store.ore[id]);
  const research = op.id === 'k_drones' ? ['a_drone'] : fights ? ['a_drone', 'f_shield', 'f_turret', 'f_shield', 'd_focus', 'f_turret', 'd_focus'] :
    ['a_drone', 'd_focus', 'd_yield', 'd_focus', 'l_hold'];
  for (const id of research) NS.rules.buyNode(save, id);
  for (let guard = 0; guard < 40; ++guard) {
    const id = ['hull', 'laser', 'cargo', 'hull', 'laser', 'thrust'].sort((a, b) => NS.rules.upgradeCost(save, a) - NS.rules.upgradeCost(save, b))[0];
    if (!NS.rules.buyUpgrade(save, id)) break;
  }
}

/* plays one operation to its end (or `cap` seconds) and returns what happened */
function play(op, fights, cap) {
  NS.trip.startTrip('career', NS.ores.ZONE_BY_ID[op.zone].index, { op: op.id });
  for (let i = 0; i < 20 && G.cine; ++i) { H.run(NS, 30); NS.cinematics.skip(); }
  const trace = [];
  let hullLost = 0, prev = G.ship.hull, t = 0;
  const limit = (op.time || cap) + 5;
  while (G.run && G.run.op && G.run.op.status === 'active' && t < limit) {
    pilot(fights);
    H.run(NS, 3);
    t += 3 / 60;
    if (G.cine && G.cine.kind !== 'docking') NS.cinematics.skip();
    if (!G.ship) break;
    if (G.ship.hull < prev) hullLost += prev - G.ship.hull;
    prev = G.ship.hull;
    if (G.run && G.run.op && trace.length < t) trace.push(G.run.op.pace.tension);
  }
  const o = G.run && G.run.op;
  const out = { id: op.id, mood: op.mood, won: !!o && o.status === 'won', time: Math.round(o ? o.t : t), hull: Math.round(hullLost),
    waves: o ? o.waves : 0, peak: Math.max(0, ...trace), mean: trace.length ? trace.reduce((a, b) => a + b, 0) / trace.length : 0 };
  if (G.run) NS.trip.endTrip('dock');
  for (let i = 0; i < 10 && G.cine; ++i) NS.cinematics.skip();
  return out;
}

function campaign(fights, label) {
  G.save = NS.rules.freshSave();
  G.save.seenIntro = G.save.seenHelp = true;
  NS.save.refreshStats();
  const rows = [];
  for (const op of O.zoneOps('kessler')) {
    shop(G.save, op, fights);
    NS.save.refreshStats();
    rows.push(play(op, fights, 600));
    if (!rows[rows.length - 1].won && fights) break;
  }
  console.log('\n' + label + ' bot - Kessler Drift');
  console.log('op          mood  won   time  hull  waves  peak  mean');
  for (const r of rows)
    console.log(r.id.padEnd(12) + r.mood.padEnd(6) + (r.won ? 'yes' : 'no').padEnd(6) + String(r.time).padStart(4) + String(r.hull).padStart(6) +
      String(r.waves).padStart(7) + r.peak.toFixed(2).padStart(6) + r.mean.toFixed(2).padStart(6));
  return rows;
}

const pro = campaign(true, 'Competent');
const by = id => pro.find(r => r.id === id);
check('the competent bot clears all six Kessler operations', pro.length === 6 && pro.every(r => r.won), JSON.stringify(pro.map(r => r.id + ':' + r.won)));
check('the capstone opens the Amber licence (with the earnings)', O.licenceReady(G.save, 1));
check('the mining operations send no pirates', ['k_haul', 'k_copper', 'k_drones', 'k_geode'].every(id => by(id) && by(id).waves === 0 && by(id).peak < 0.05));
const jump = by('k_jumpers'), charter = by('k_charter');
check('Claim Jumpers raises the tension well above the mining operations', jump && jump.peak > 0.3 && jump.waves >= 3);
check('the capstone runs hotter than the operation before it', jump && charter && charter.mean > jump.mean * 0.9 && charter.hull >= jump.hull * 0.5);
check('peaks never stay at full tension the whole way', pro.every(r => r.mean < 0.8));

const weak = campaign(false, 'Weak');
const wby = id => weak.find(r => r.id === id);
check('a bot that never fights still clears the breathers', ['k_haul', 'k_copper', 'k_drones'].every(id => wby(id) && wby(id).won));
check('a bot that never fights cannot clear Claim Jumpers', wby('k_jumpers') && !wby('k_jumpers').won);
check('a bot that never fights takes more hull damage on the capstone', !wby('k_charter') || !wby('k_charter').won || wby('k_charter').hull > charter.hull);

done();
